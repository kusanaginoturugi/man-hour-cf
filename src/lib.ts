import { createRemoteJWKSet, jwtVerify } from 'jose'

// ---- 日時 (Asia/Tokyo 固定。DB には 'YYYY-MM-DD HH:MM' の JST ローカル時刻で入れる) ----

const JST_OFFSET = 9 * 60 * 60 * 1000

const nowJst = () => new Date(Date.now() + JST_OFFSET).toISOString()

export const currentYm = () => nowJst().slice(0, 7)

export const nowInput = () => nowJst().slice(0, 16)

export const isYm = (s: string | undefined): s is string => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s)

export function addMonths(ym: string, n: number) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)
}

export const monthStart = (ym: string) => `${ym}-01 00:00`

export function ymLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return `${y}年${m}月`
}

// <input type="datetime-local"> の値 → DB 形式
export function fromInput(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) || Number.isNaN(Date.parse(`${s.slice(0, 16)}:00Z`))) return null
  return s.slice(0, 16).replace('T', ' ')
}

export const toInput = (dt: string) => dt.replace(' ', 'T')

export const fmtDate = (dt: string) => dt.replaceAll('-', '/')

export function addMinutes(dt: string, minutes: number) {
  const t = new Date(`${dt.replace(' ', 'T')}:00Z`).getTime() + minutes * 60_000
  return new Date(t).toISOString().slice(0, 16).replace('T', ' ')
}

export const hours = (minutes: number) => minutes / 60

// ---- 月次集計 ----
// 旧版の MonthlySummary と同じ式: 繰越 = 前月繰越 + 当月合計(別予算を除く) - 月予算
// テーブルに保存せず毎回計算する。最初に作業がある月から途切れなく積み上げる

export type Summary = { ym: string; carryover: number; thisMonth: number; amount: number }

export function buildSummaries(
  monthly: { ym: string; minutes: number }[],
  budgetHours: number,
  openingCarryover: number,
  untilYm?: string,
): Summary[] {
  const byYm = new Map(monthly.map((r) => [r.ym, r.minutes]))
  const first = monthly[0]?.ym
  if (!first) return []
  let last = monthly[monthly.length - 1].ym
  if (untilYm && untilYm > last) last = untilYm

  const result: Summary[] = []
  let carry = openingCarryover
  for (let ym = first; ym <= last; ym = addMonths(ym, 1)) {
    const thisMonth = hours(byYm.get(ym) ?? 0)
    const amount = carry + thisMonth - budgetHours
    result.push({ ym, carryover: carry, thisMonth, amount })
    carry = amount
  }
  return result
}

// ---- 認証 (Cloudflare Access の JWT を検証して email をユーザー ID にする) ----

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined

// ACCESS_* は wrangler secret、DEV_USER_EMAIL は .dev.vars で入れる。wrangler types に出ないことがあるので型はここで持つ
declare global {
  interface Env {
    ACCESS_TEAM_DOMAIN?: string
    ACCESS_AUD?: string
    DEV_USER_EMAIL?: string
  }
}

export async function authenticate(req: Request, env: Env): Promise<string | null> {
  const host = new URL(req.url).hostname
  if (env.DEV_USER_EMAIL && (host === 'localhost' || host === '127.0.0.1')) {
    return env.DEV_USER_EMAIL.toLowerCase()
  }
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null

  const token =
    req.headers.get('Cf-Access-Jwt-Assertion') ??
    req.headers.get('Cookie')?.match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1]
  if (!token) return null

  const issuer = env.ACCESS_TEAM_DOMAIN.replace(/\/$/, '')
  jwks ??= createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`))
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer, audience: env.ACCESS_AUD })
    return typeof payload.email === 'string' ? payload.email.toLowerCase() : null
  } catch {
    return null
  }
}
