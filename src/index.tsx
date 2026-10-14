import { Hono, type Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { csrf } from 'hono/csrf'
import type { Child } from 'hono/jsx'
import { addMinutes, authenticate, buildSummaries, currentYm, fromInput, isYm, monthStart, addMonths } from './lib'
import * as V from './views'

type App = { Bindings: Env; Variables: { user: string; flash: { notice?: string; alert?: string } } }
type C = Context<App>

const app = new Hono<App>()

app.use(csrf())

app.use(async (c, next) => {
  const user = await authenticate(c.req.raw, c.env)
  if (!user) return c.text('Unauthorized', 401)
  c.set('user', user)

  const flash = getCookie(c, 'flash')
  let parsed = {}
  try {
    if (flash) parsed = JSON.parse(decodeURIComponent(flash))
  } catch {}
  c.set('flash', parsed)
  if (flash) deleteCookie(c, 'flash', { path: '/' })
  await next()
})

// ---- helpers ----

const db = (c: C) => c.env.DB

function redirect(c: C, url: string, flash: { notice?: string; alert?: string }) {
  setCookie(c, 'flash', encodeURIComponent(JSON.stringify(flash)), { path: '/', httpOnly: true, sameSite: 'Lax', secure: c.req.url.startsWith('https:') })
  return c.redirect(url, 303)
}

async function selectedCustomer(c: C) {
  const user = c.get('user')
  const row = await db(c)
    .prepare(
      `SELECT c.* FROM customers c
       LEFT JOIN user_settings s ON s.user_id = c.user_id AND s.selected_customer_id = c.id
       WHERE c.user_id = ? ORDER BY s.user_id IS NULL, c.id LIMIT 1`,
    )
    .bind(user)
    .first<V.Customer>()
  return row
}

async function render(c: C, title: string, body: Child, status: 200 | 404 | 422 = 200) {
  const customer = await selectedCustomer(c)
  return c.html(
    <V.Layout title={title} user={c.get('user')} customer={customer} {...c.get('flash')}>
      {body}
    </V.Layout>,
    status,
  )
}

const notFound = (c: C) => render(c, 'Not Found', <p>見つからない。</p>, 404)

async function form(c: C) {
  const body = await c.req.parseBody()
  return (key: string) => {
    const v = body[key]
    return typeof v === 'string' ? v.trim() : ''
  }
}

const orNull = (s: string) => (s === '' ? null : s)

const JOB_SELECT = `SELECT j.*, t.name AS job_type_name, c.short_name AS customer_short_name
  FROM jobs j JOIN job_types t ON t.id = j.job_type_id JOIN customers c ON c.id = j.customer_id`

async function monthlyMinutes(c: C, customerId: number) {
  const { results } = await db(c)
    .prepare(
      `SELECT substr(begin_date, 1, 7) AS ym, SUM(CASE WHEN outside_budget = 0 THEN work_minutes ELSE 0 END) AS minutes
       FROM jobs WHERE user_id = ? AND customer_id = ? GROUP BY ym ORDER BY ym`,
    )
    .bind(c.get('user'), customerId)
    .all<{ ym: string; minutes: number }>()
  return results
}

async function summariesFor(c: C, customer: V.Customer, untilYm?: string) {
  return buildSummaries(await monthlyMinutes(c, customer.id), customer.monthly_budget_hours, customer.opening_carryover, untilYm)
}

// ---- routes ----

app.get('/', (c) => c.redirect('/jobs'))

// 顧客

app.get('/customers', async (c) => {
  const { results } = await db(c).prepare('SELECT * FROM customers WHERE user_id = ? ORDER BY id').bind(c.get('user')).all<V.Customer>()
  const selected = await selectedCustomer(c)
  return render(c, '顧客一覧', <V.CustomerList customers={results} selectedId={selected?.id} />)
})

app.get('/customers/new', (c) => render(c, '新規顧客作成', <V.CustomerForm />))

async function findCustomer(c: C, id: string) {
  return db(c).prepare('SELECT * FROM customers WHERE id = ? AND user_id = ?').bind(id, c.get('user')).first<V.Customer>()
}

function customerParams(f: (k: string) => string) {
  const num = (s: string, d: number) => (s === '' || Number.isNaN(Number(s)) ? d : Number(s))
  return [
    f('short_name'),
    orNull(f('name')),
    orNull(f('post')),
    orNull(f('address1')),
    orNull(f('address2')),
    orNull(f('rep')),
    num(f('monthly_budget_hours'), 18),
    num(f('opening_carryover'), 0),
  ]
}

app.post('/customers', async (c) => {
  const p = customerParams(await form(c))
  if (!p[0]) return redirect(c, '/customers/new', { alert: '顧客名は必須' })
  await db(c)
    .prepare(
      `INSERT INTO customers (short_name, name, post, address1, address2, rep, monthly_budget_hours, opening_carryover, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(...p, c.get('user'))
    .run()
  return redirect(c, '/customers', { notice: '顧客を作成した' })
})

app.get('/customers/:id/edit', async (c) => {
  const customer = await findCustomer(c, c.req.param('id'))
  if (!customer) return notFound(c)
  return render(c, '顧客編集', <V.CustomerForm customer={customer} />)
})

app.post('/customers/:id', async (c) => {
  const id = c.req.param('id')
  const p = customerParams(await form(c))
  if (!p[0]) return redirect(c, `/customers/${id}/edit`, { alert: '顧客名は必須' })
  const { meta } = await db(c)
    .prepare(
      `UPDATE customers SET short_name = ?, name = ?, post = ?, address1 = ?, address2 = ?, rep = ?,
       monthly_budget_hours = ?, opening_carryover = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
    )
    .bind(...p, id, c.get('user'))
    .run()
  if (!meta.changes) return notFound(c)
  return redirect(c, '/customers', { notice: '顧客を更新した' })
})

app.post('/customers/:id/delete', async (c) => {
  const id = c.req.param('id')
  const user = c.get('user')
  const used = await db(c).prepare('SELECT 1 FROM jobs WHERE customer_id = ? AND user_id = ? LIMIT 1').bind(id, user).first()
  if (used) return redirect(c, '/customers', { alert: '作業が登録されている顧客は削除できない' })
  await db(c).prepare('DELETE FROM customers WHERE id = ? AND user_id = ?').bind(id, user).run()
  return redirect(c, '/customers', { notice: '顧客を削除した' })
})

app.post('/customers/:id/select', async (c) => {
  const customer = await findCustomer(c, c.req.param('id'))
  if (!customer) return notFound(c)
  await db(c)
    .prepare(
      `INSERT INTO user_settings (user_id, selected_customer_id) VALUES (?, ?)
       ON CONFLICT (user_id) DO UPDATE SET selected_customer_id = excluded.selected_customer_id`,
    )
    .bind(c.get('user'), customer.id)
    .run()
  return redirect(c, '/jobs', { notice: `${customer.short_name} を選択した` })
})

// ジョブ種類

app.get('/job_types', async (c) => {
  const { results } = await db(c).prepare('SELECT * FROM job_types WHERE user_id = ? ORDER BY id').bind(c.get('user')).all<V.JobType>()
  return render(c, 'ジョブ種類', <V.JobTypeList jobTypes={results} />)
})

app.post('/job_types', async (c) => {
  const name = (await form(c))('name')
  if (name) await db(c).prepare('INSERT INTO job_types (name, user_id) VALUES (?, ?)').bind(name, c.get('user')).run()
  return redirect(c, '/job_types', { notice: 'ジョブ種類を追加した' })
})

app.post('/job_types/:id', async (c) => {
  const name = (await form(c))('name')
  if (name) {
    await db(c)
      .prepare(`UPDATE job_types SET name = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`)
      .bind(name, c.req.param('id'), c.get('user'))
      .run()
  }
  return redirect(c, '/job_types', { notice: 'ジョブ種類を更新した' })
})

app.post('/job_types/:id/delete', async (c) => {
  const id = c.req.param('id')
  const user = c.get('user')
  const used = await db(c).prepare('SELECT 1 FROM jobs WHERE job_type_id = ? AND user_id = ? LIMIT 1').bind(id, user).first()
  if (used) return redirect(c, '/job_types', { alert: '使われているジョブ種類は削除できない' })
  await db(c).prepare('DELETE FROM job_types WHERE id = ? AND user_id = ?').bind(id, user).run()
  return redirect(c, '/job_types', { notice: 'ジョブ種類を削除した' })
})

// 作業

app.get('/jobs', async (c) => {
  const customer = await selectedCustomer(c)
  if (!customer) return redirect(c, '/customers/new', { alert: 'まず顧客を作成して' })
  const q = c.req.query('ym')
  const ym = isYm(q) ? q : currentYm()
  const { results } = await db(c)
    .prepare(`${JOB_SELECT} WHERE j.user_id = ? AND j.customer_id = ? AND j.begin_date >= ? AND j.begin_date < ? ORDER BY j.begin_date`)
    .bind(c.get('user'), customer.id, monthStart(ym), monthStart(addMonths(ym, 1)))
    .all<V.Job>()
  return render(c, '作業時間一覧', <V.JobList jobs={results} ym={ym} />)
})

app.get('/jobs/search', async (c) => {
  const title = c.req.query('title')?.trim() ?? ''
  const detail = c.req.query('detail')?.trim() ?? ''
  const customer = await selectedCustomer(c)
  let jobs: V.Job[] | null = null
  if (customer && (title || detail)) {
    const like = (s: string) => `%${s.replace(/[\\%_]/g, '\\$&')}%`
    const conds: string[] = []
    const args: string[] = []
    if (title) conds.push(`j.title LIKE ? ESCAPE '\\'`), args.push(like(title))
    if (detail) conds.push(`j.detail LIKE ? ESCAPE '\\'`), args.push(like(detail))
    const { results } = await db(c)
      .prepare(`${JOB_SELECT} WHERE j.user_id = ? AND j.customer_id = ? AND (${conds.join(' OR ')}) ORDER BY j.begin_date`)
      .bind(c.get('user'), customer.id, ...args)
      .all<V.Job>()
    jobs = results
  }
  return render(c, '作業報告の検索', <V.JobSearch title={title} detail={detail} jobs={jobs} />)
})

async function jobFormData(c: C) {
  const user = c.get('user')
  const [customers, jobTypes] = await Promise.all([
    db(c).prepare('SELECT * FROM customers WHERE user_id = ? ORDER BY id').bind(user).all<V.Customer>(),
    db(c).prepare('SELECT * FROM job_types WHERE user_id = ? ORDER BY id').bind(user).all<V.JobType>(),
  ])
  return { customers: customers.results, jobTypes: jobTypes.results }
}

app.get('/jobs/new', async (c) => {
  const { customers, jobTypes } = await jobFormData(c)
  if (!customers.length) return redirect(c, '/customers/new', { alert: 'まず顧客を作成して' })
  if (!jobTypes.length) return redirect(c, '/job_types', { alert: 'まずジョブ種類を作成して' })
  const selected = await selectedCustomer(c)
  return render(c, '作業報告新規作成', <V.JobForm customers={customers} jobTypes={jobTypes} selectedCustomerId={selected?.id} />)
})

// フォームを検証して bind 用の値を返す。顧客・ジョブ種類が自分のものかも確認する
async function jobParams(c: C) {
  const f = await form(c)
  const user = c.get('user')
  const begin = fromInput(f('begin_date'))
  const minutes = Number(f('work_minutes'))
  if (!begin || !Number.isInteger(minutes) || minutes < 0) return null
  const owned = await db(c)
    .prepare('SELECT (SELECT 1 FROM customers WHERE id = ? AND user_id = ?) AND (SELECT 1 FROM job_types WHERE id = ? AND user_id = ?) AS ok')
    .bind(f('customer_id'), user, f('job_type_id'), user)
    .first<{ ok: number | null }>()
  if (!owned?.ok) return null
  return [
    Number(f('customer_id')),
    Number(f('job_type_id')),
    orNull(f('title')),
    orNull(f('detail')),
    begin,
    addMinutes(begin, minutes),
    minutes,
    f('outside_budget') ? 1 : 0,
  ] as const
}

app.post('/jobs', async (c) => {
  const p = await jobParams(c)
  if (!p) return redirect(c, '/jobs/new', { alert: '入力内容がおかしい' })
  await db(c)
    .prepare(
      `INSERT INTO jobs (customer_id, job_type_id, title, detail, begin_date, end_date, work_minutes, outside_budget, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(...p, c.get('user'))
    .run()
  return redirect(c, `/jobs?ym=${p[4].slice(0, 7)}`, { notice: '作業を登録した' })
})

app.get('/jobs/report', async (c) => {
  const data = await reportData(c)
  if (!data) return redirect(c, '/customers/new', { alert: 'まず顧客を作成して' })
  return render(c, '月次作業報告書', <V.Report {...data} />)
})

app.get('/jobs/report/print', async (c) => {
  const data = await reportData(c)
  if (!data) return notFound(c)
  const settings = await db(c).prepare('SELECT company_name FROM user_settings WHERE user_id = ?').bind(c.get('user')).first<{ company_name: string | null }>()
  return c.html(<V.ReportPrint {...data} companyName={settings?.company_name ?? ''} />)
})

async function reportData(c: C) {
  const customer = await selectedCustomer(c)
  if (!customer) return null
  const q = c.req.query('ym')
  const ym = isYm(q) ? q : currentYm()
  const [{ results: jobs }, summaries] = await Promise.all([
    db(c)
      .prepare(`${JOB_SELECT} WHERE j.user_id = ? AND j.customer_id = ? AND j.begin_date >= ? AND j.begin_date < ? ORDER BY j.begin_date`)
      .bind(c.get('user'), customer.id, monthStart(ym), monthStart(addMonths(ym, 1)))
      .all<V.Job>(),
    summariesFor(c, customer, ym),
  ])
  return { customer, ym, jobs, summary: summaries.find((s) => s.ym === ym) }
}

app.get('/jobs/:id/edit', async (c) => {
  const job = await db(c).prepare('SELECT * FROM jobs WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user')).first<V.Job>()
  if (!job) return notFound(c)
  const { customers, jobTypes } = await jobFormData(c)
  return render(c, '作業時間編集', <V.JobForm job={job} customers={customers} jobTypes={jobTypes} />)
})

app.post('/jobs/:id', async (c) => {
  const id = c.req.param('id')
  const p = await jobParams(c)
  if (!p) return redirect(c, `/jobs/${id}/edit`, { alert: '入力内容がおかしい' })
  const { meta } = await db(c)
    .prepare(
      `UPDATE jobs SET customer_id = ?, job_type_id = ?, title = ?, detail = ?, begin_date = ?, end_date = ?,
       work_minutes = ?, outside_budget = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
    )
    .bind(...p, id, c.get('user'))
    .run()
  if (!meta.changes) return notFound(c)
  return redirect(c, `/jobs?ym=${p[4].slice(0, 7)}`, { notice: '作業を更新した' })
})

app.post('/jobs/:id/delete', async (c) => {
  const job = await db(c).prepare('SELECT begin_date FROM jobs WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user')).first<{ begin_date: string }>()
  if (!job) return notFound(c)
  await db(c).prepare('DELETE FROM jobs WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user')).run()
  return redirect(c, `/jobs?ym=${job.begin_date.slice(0, 7)}`, { notice: '作業を削除した' })
})

// 月次集計

app.get('/monthly_summaries', async (c) => {
  const customer = await selectedCustomer(c)
  if (!customer) return redirect(c, '/customers/new', { alert: 'まず顧客を作成して' })
  return render(c, '月次集計', <V.SummaryList customer={customer} summaries={await summariesFor(c, customer)} />)
})

// 設定

app.get('/settings', async (c) => {
  const s = await db(c).prepare('SELECT company_name FROM user_settings WHERE user_id = ?').bind(c.get('user')).first<{ company_name: string | null }>()
  return render(c, '設定', <V.Settings companyName={s?.company_name ?? ''} />)
})

app.post('/settings', async (c) => {
  const name = orNull((await form(c))('company_name'))
  await db(c)
    .prepare(
      `INSERT INTO user_settings (user_id, company_name) VALUES (?, ?)
       ON CONFLICT (user_id) DO UPDATE SET company_name = excluded.company_name`,
    )
    .bind(c.get('user'), name)
    .run()
  return redirect(c, '/settings', { notice: '設定を保存した' })
})

app.notFound(notFound)

export default app
