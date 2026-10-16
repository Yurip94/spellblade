// 플랜 한도 → ❤️ 체력(주간 7일) · 🔷 마나(5시간). 남은 % 와 리셋 시각

export type Gauge = { left: number; resetsAt: number | null }
type RateLimit = { kind: string; percentUsed: number; resetsAt?: string }

function gauge(r: RateLimit | undefined): Gauge | null {
  if (!r || !Number.isFinite(r.percentUsed)) return null
  const at = r.resetsAt ? Date.parse(r.resetsAt) : NaN
  return { left: Math.round(Math.max(0, Math.min(100, 100 - r.percentUsed))), resetsAt: Number.isFinite(at) ? at : null }
}

export function limitsOf(rateLimits: readonly RateLimit[]): { hp: Gauge | null; mp: Gauge | null } {
  return {
    hp: gauge(rateLimits.find(r => r.kind === 'seven_day')),
    mp: gauge(rateLimits.find(r => r.kind === 'five_hour')),
  }
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토']
const pad = (n: number) => String(n).padStart(2, '0')

// 1시간 안: "42분", 하루 안: "2:14", 그 밖: "금 09:00"(현지 요일 · 시각)
export function resetText(resetsAt: number | null, now: number, tzOffsetMin: number): string {
  if (resetsAt === null) return ''
  const left = resetsAt - now
  if (left <= 0) return '곧'
  if (left < 3_600_000) return `${Math.ceil(left / 60_000)}분`
  if (left < 86_400_000) {
    const m = Math.floor(left / 60_000)
    return `${Math.floor(m / 60)}:${pad(m % 60)}`
  }
  const local = new Date(resetsAt - tzOffsetMin * 60_000)
  return `${DAYS[local.getUTCDay()]} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`
}
