import type { Child } from 'hono/jsx'
import { addMonths, fmtDate, hours, nowInput, toInput, ymLabel, type Summary } from './lib'

export type Customer = {
  id: number
  short_name: string
  name: string | null
  post: string | null
  address1: string | null
  address2: string | null
  rep: string | null
  monthly_budget_hours: number
  opening_carryover: number
}
export type JobType = { id: number; name: string }
export type Job = {
  id: number
  customer_id: number
  job_type_id: number
  title: string | null
  detail: string | null
  begin_date: string
  end_date: string
  work_minutes: number
  outside_budget: number
  job_type_name?: string
  customer_short_name?: string
}

const n3 = (v: number) => v.toFixed(3)

const MultiLine = ({ text }: { text: string | null }) => (
  <>{(text ?? '').split(/\r?\n/).map((line, i) => (i ? [<br />, line] : line))}</>
)

const DeleteButton = ({ action }: { action: string }) => (
  <form method="post" action={action} class="d-inline" onsubmit="return confirm('削除していい？')">
    <button class="btn btn-danger btn-sm">削除</button>
  </form>
)

export const Layout = (props: {
  title: string
  user: string
  customer?: Customer | null
  notice?: string
  alert?: string
  children: Child
}) => (
  <html lang="ja">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{props.title} - ManHour</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
      <link href="/app.css" rel="stylesheet" />
    </head>
    <body>
      <nav class="navbar navbar-expand bg-body-tertiary">
        <div class="container-fluid flex-wrap">
          <a class="navbar-brand" href="/jobs">作業時間登録</a>
          <ul class="navbar-nav me-auto flex-wrap">
            <li class="nav-item"><a class="nav-link" href="/customers">顧客</a></li>
            <li class="nav-item"><a class="nav-link" href="/jobs">作業時間一覧</a></li>
            <li class="nav-item"><a class="nav-link" href="/jobs/search">検索</a></li>
            <li class="nav-item"><a class="nav-link" href="/monthly_summaries">月次集計</a></li>
            <li class="nav-item"><a class="nav-link" href="/job_types">ジョブ種類</a></li>
            <li class="nav-item"><a class="nav-link" href="/settings">設定</a></li>
          </ul>
          <span class="navbar-text small">
            {props.customer ? <span class="badge text-bg-primary me-2">{props.customer.short_name}</span> : null}
            {props.user} <a href="/cdn-cgi/access/logout" class="ms-2">ログアウト</a>
          </span>
        </div>
      </nav>
      <main class="container-fluid mt-3">
        {props.notice ? <p class="alert alert-success">{props.notice}</p> : null}
        {props.alert ? <p class="alert alert-danger">{props.alert}</p> : null}
        {props.children}
      </main>
    </body>
  </html>
)

// ---- 顧客 ----

export const CustomerList = ({ customers, selectedId }: { customers: Customer[]; selectedId?: number }) => (
  <div class="card">
    <div class="card-header"><h3 class="card-title h5 mb-0">顧客一覧</h3></div>
    <div class="card-body">
      <table class="table table-striped align-middle">
        <thead>
          <tr><th>顧客名</th><th>正式名称</th><th>郵便番号</th><th>住所1</th><th>住所2</th><th>担当</th><th>月予算(h)</th><th></th></tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr class={c.id === selectedId ? 'table-primary' : ''}>
              <td>{c.short_name}</td><td>{c.name}</td><td>{c.post}</td><td>{c.address1}</td><td>{c.address2}</td><td>{c.rep}</td>
              <td>{c.monthly_budget_hours}</td>
              <td class="text-nowrap">
                <form method="post" action={`/customers/${c.id}/select`} class="d-inline">
                  <button class="btn btn-primary btn-sm">選択</button>
                </form>{' '}
                <a href={`/customers/${c.id}/edit`} class="btn btn-secondary btn-sm">編集</a>{' '}
                <DeleteButton action={`/customers/${c.id}/delete`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <a href="/customers/new" class="btn btn-secondary">新規顧客作成</a>
    </div>
  </div>
)

const Field = (p: { label: string; name: string; value?: string | number | null; type?: string; step?: string; required?: boolean }) => (
  <div class="mb-3">
    <label class="form-label" for={p.name}>{p.label}</label>
    <input class="form-control" id={p.name} name={p.name} type={p.type ?? 'text'} step={p.step} value={p.value ?? ''} required={p.required} />
  </div>
)

export const CustomerForm = ({ customer }: { customer?: Customer }) => (
  <div class="card" style="max-width: 40rem">
    <div class="card-header"><h3 class="card-title h5 mb-0">{customer ? '顧客編集' : '新規顧客作成'}</h3></div>
    <div class="card-body">
      <form method="post" action={customer ? `/customers/${customer.id}` : '/customers'}>
        <Field label="顧客名 (略称)" name="short_name" value={customer?.short_name} required />
        <Field label="正式名称" name="name" value={customer?.name} />
        <Field label="郵便番号" name="post" value={customer?.post} />
        <Field label="住所1" name="address1" value={customer?.address1} />
        <Field label="住所2" name="address2" value={customer?.address2} />
        <Field label="担当" name="rep" value={customer?.rep} />
        <Field label="月予算時間 (h)" name="monthly_budget_hours" type="number" step="any" value={customer?.monthly_budget_hours ?? 18} required />
        <Field label="初期繰越 (h)" name="opening_carryover" type="number" step="any" value={customer?.opening_carryover ?? 0} required />
        <button class="btn btn-primary">保存</button> <a href="/customers" class="btn btn-link">戻る</a>
      </form>
    </div>
  </div>
)

// ---- ジョブ種類 ----

export const JobTypeList = ({ jobTypes }: { jobTypes: JobType[] }) => (
  <div class="card" style="max-width: 40rem">
    <div class="card-header"><h3 class="card-title h5 mb-0">ジョブ種類</h3></div>
    <div class="card-body">
      <table class="table table-striped align-middle">
        <tbody>
          {jobTypes.map((t) => (
            <tr>
              <td>
                <form method="post" action={`/job_types/${t.id}`} class="d-flex gap-2">
                  <input class="form-control form-control-sm" name="name" value={t.name} required />
                  <button class="btn btn-secondary btn-sm text-nowrap">更新</button>
                </form>
              </td>
              <td class="text-end"><DeleteButton action={`/job_types/${t.id}/delete`} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <form method="post" action="/job_types" class="d-flex gap-2">
        <input class="form-control" name="name" placeholder="新しいジョブ種類" required />
        <button class="btn btn-primary text-nowrap">追加</button>
      </form>
    </div>
  </div>
)

// ---- 作業 ----

const JobTable = ({ jobs, showActions = true }: { jobs: Job[]; showActions?: boolean }) => (
  <table class="table table-striped align-middle">
    <thead>
      <tr><th>対応</th><th>顧客</th><th>タイトル</th><th>詳細</th><th>別予算</th><th>作業時間</th><th>開始時刻</th><th>終了時刻</th>{showActions ? <th></th> : null}</tr>
    </thead>
    <tbody>
      {jobs.map((j) => (
        <tr>
          <td>{j.job_type_name}</td>
          <td>{j.customer_short_name}</td>
          <td>{j.title}</td>
          <td><MultiLine text={j.detail} /></td>
          <td>{j.outside_budget ? '○' : ''}</td>
          <td class="text-end">{n3(hours(j.work_minutes))}</td>
          <td class="text-nowrap">{fmtDate(j.begin_date)}</td>
          <td class="text-nowrap">{fmtDate(j.end_date)}</td>
          {showActions ? (
            <td class="text-nowrap">
              <a href={`/jobs/${j.id}/edit`} class="btn btn-secondary btn-sm">編集</a>{' '}
              <DeleteButton action={`/jobs/${j.id}/delete`} />
            </td>
          ) : null}
        </tr>
      ))}
    </tbody>
  </table>
)

export const JobList = ({ jobs, ym }: { jobs: Job[]; ym: string }) => (
  <div class="card">
    <div class="card-header"><h3 class="card-title h5 mb-0">作業時間一覧</h3></div>
    <div class="card-body">
      <div class="btn-group mb-2">
        <a href={`/jobs?ym=${addMonths(ym, -1)}`} class="btn btn-secondary">先月</a>
        <a href="/jobs" class="btn btn-secondary">{ymLabel(ym)}</a>
        <a href={`/jobs?ym=${addMonths(ym, 1)}`} class="btn btn-secondary">翌月</a>
      </div>
      <JobTable jobs={jobs} />
      <a href="/jobs/new" class="btn btn-primary">作業報告新規作成</a>{' '}
      <a href={`/jobs/report?ym=${ym}`} class="btn btn-secondary">月次作業報告書</a>
    </div>
  </div>
)

export const JobForm = (p: { job?: Job; customers: Customer[]; jobTypes: JobType[]; selectedCustomerId?: number }) => {
  const customerId = p.job?.customer_id ?? p.selectedCustomerId
  return (
    <div class="card" style="max-width: 48rem">
      <div class="card-header"><h3 class="card-title h5 mb-0">{p.job ? '作業時間編集' : '作業報告新規作成'}</h3></div>
      <div class="card-body">
        <form method="post" action={p.job ? `/jobs/${p.job.id}` : '/jobs'}>
          <div class="row">
            <div class="col-md-6 mb-3">
              <label class="form-label" for="customer_id">顧客</label>
              <select class="form-select" id="customer_id" name="customer_id" required>
                {p.customers.map((c) => <option value={String(c.id)} selected={c.id === customerId}>{c.short_name}</option>)}
              </select>
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label" for="job_type_id">ジョブ種類</label>
              <select class="form-select" id="job_type_id" name="job_type_id" required>
                {p.jobTypes.map((t) => <option value={String(t.id)} selected={t.id === p.job?.job_type_id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <Field label="タイトル" name="title" value={p.job?.title} />
          <div class="mb-3">
            <label class="form-label" for="detail">詳細</label>
            <textarea class="form-control" id="detail" name="detail" rows={8}>{p.job?.detail ?? ''}</textarea>
          </div>
          <div class="row">
            <div class="col-md-6 mb-3">
              <label class="form-label" for="begin_date">開始時刻</label>
              <input class="form-control" type="datetime-local" id="begin_date" name="begin_date" value={p.job ? toInput(p.job.begin_date) : nowInput()} required />
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label" for="work_minutes">作業時間 (分)</label>
              <input class="form-control" type="number" min="0" id="work_minutes" name="work_minutes" value={String(p.job?.work_minutes ?? '')} required />
            </div>
          </div>
          <div class="form-check mb-3">
            <input class="form-check-input" type="checkbox" id="outside_budget" name="outside_budget" value="1" checked={!!p.job?.outside_budget} />
            <label class="form-check-label" for="outside_budget">別予算</label>
          </div>
          <button class="btn btn-primary">保存</button> <a href="/jobs" class="btn btn-link">戻る</a>
        </form>
      </div>
    </div>
  )
}

export const JobSearch = ({ title, detail, jobs }: { title: string; detail: string; jobs: Job[] | null }) => (
  <div class="card">
    <div class="card-header"><h3 class="card-title h5 mb-0">作業報告の検索</h3></div>
    <div class="card-body">
      <form method="get" action="/jobs/search" class="row g-2 mb-3">
        <div class="col-md-4"><input class="form-control" name="title" value={title} placeholder="タイトル" /></div>
        <div class="col-md-4"><input class="form-control" name="detail" value={detail} placeholder="詳細" /></div>
        <div class="col-md-2"><button class="btn btn-primary">検索</button></div>
      </form>
      {jobs ? (jobs.length ? <JobTable jobs={jobs} /> : <p>該当なし</p>) : null}
    </div>
  </div>
)

// ---- 月次集計・報告書 ----

export const SummaryList = ({ customer, summaries }: { customer: Customer; summaries: Summary[] }) => (
  <div class="card" style="max-width: 56rem">
    <div class="card-header"><h3 class="card-title h5 mb-0">月次集計: {customer.short_name} (月予算 {customer.monthly_budget_hours}h)</h3></div>
    <div class="card-body">
      <table class="table table-striped align-middle">
        <thead><tr><th>年月</th><th class="text-end">前月繰越</th><th class="text-end">当月合計</th><th class="text-end">繰越</th><th></th></tr></thead>
        <tbody>
          {summaries.slice().reverse().map((s) => (
            <tr>
              <td>{ymLabel(s.ym)}</td>
              <td class="text-end">{n3(s.carryover)}</td>
              <td class="text-end">{n3(s.thisMonth)}</td>
              <td class="text-end">{n3(s.amount)}</td>
              <td class="text-end"><a href={`/jobs/report?ym=${s.ym}`} class="btn btn-secondary btn-sm">報告書</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)

const ReportBody = ({ customer, ym, jobs, summary }: { customer: Customer; ym: string; jobs: Job[]; summary?: Summary }) => {
  const total = jobs.filter((j) => !j.outside_budget).reduce((a, j) => a + hours(j.work_minutes), 0)
  return (
    <>
      <h1 class="h3">月次作業報告書</h1>
      <h2 class="h5">{customer.short_name} : {ymLabel(ym)}分</h2>
      <table class="table table-sm table-bordered summary">
        <thead><tr><th>前月繰越</th><th>当月合計</th><th>繰越</th></tr></thead>
        <tbody>
          <tr>
            <td class="text-end">{summary ? n3(summary.carryover) : '-'}</td>
            <td class="text-end">{summary ? n3(summary.thisMonth) : '-'}</td>
            <td class="text-end">{summary ? n3(summary.amount) : '-'}</td>
          </tr>
        </tbody>
      </table>
      <table class="table table-sm table-striped report">
        <thead>
          <tr><th>対応</th><th>タイトル</th><th>詳細</th><th>別予算</th><th>開始時刻</th><th>終了時刻</th><th>作業時間</th></tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr>
              <td>{j.job_type_name}</td>
              <td>{j.title}</td>
              <td><MultiLine text={j.detail} /></td>
              <td>{j.outside_budget ? '○' : ''}</td>
              <td class="text-nowrap">{fmtDate(j.begin_date)}</td>
              <td class="text-nowrap">{fmtDate(j.end_date)}</td>
              <td class="text-end">{n3(hours(j.work_minutes))}</td>
            </tr>
          ))}
          <tr><td colspan={5}></td><td>合計</td><td class="text-end">{n3(total)}</td></tr>
        </tbody>
      </table>
    </>
  )
}

export const Report = (p: { customer: Customer; ym: string; jobs: Job[]; summary?: Summary }) => (
  <div>
    <ReportBody {...p} />
    <div class="btn-group">
      <a href={`/jobs/report/print?ym=${p.ym}`} target="_blank" class="btn btn-primary">印刷 / PDF</a>
      <a href={`/jobs/report?ym=${addMonths(p.ym, -1)}`} class="btn btn-secondary">前月</a>
      <a href={`/jobs/report?ym=${addMonths(p.ym, 1)}`} class="btn btn-secondary">翌月</a>
    </div>
  </div>
)

// 印刷用ページ。ブラウザの「PDF に保存」で出力する
// ヘッダ/ページ番号は @page のマージンボックスで出す (Chrome 131+)
// Google Fonts のような unicode-range 分割フォントを読むとマージンボックスの文字が消えるので、フォントは public/fonts から単一ファイルで配る
const cssString = (s: string) => `"${s.replace(/[\\"]/g, '\\$&').replace(/[\r\n]/g, ' ').replace(/</g, '\\3c ')}"`

export const ReportPrint = (p: { customer: Customer; ym: string; jobs: Job[]; summary?: Summary; companyName: string }) => {
  const header = `${p.companyName} 作業報告書 「${ymLabel(p.ym)}」`.trim()
  return (
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <title>作業報告書 {p.customer.short_name} {ymLabel(p.ym)}</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
        <link href="/print.css" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: `@page { @top-left { content: ${cssString(header)}; } }` }} />
      </head>
      <body>
        <div class="toolbar">
          <button class="btn btn-primary" onclick="document.fonts.ready.then(() => window.print())">印刷 / PDF に保存</button>
          <span class="ms-2 small text-muted">送信先で「PDF に保存」を選ぶ。用紙は A4 横</span>
        </div>
        <ReportBody customer={p.customer} ym={p.ym} jobs={p.jobs} summary={p.summary} />
      </body>
    </html>
  )
}

// ---- 設定 ----

export const Settings = ({ companyName }: { companyName: string }) => (
  <div class="card" style="max-width: 40rem">
    <div class="card-header"><h3 class="card-title h5 mb-0">設定</h3></div>
    <div class="card-body">
      <form method="post" action="/settings">
        <Field label="報告書ヘッダの会社名" name="company_name" value={companyName} />
        <button class="btn btn-primary">保存</button>
      </form>
    </div>
  </div>
)
