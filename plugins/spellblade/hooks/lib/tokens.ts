export function comma(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// 토큰 숫자 줄이기: 999 · 1.2k · 12k · 3.4M
export function shortNum(n: number): string {
  const round = (v: number) => (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10)
  // 반올림해서 1,000k 가 되면 M 으로
  if (n >= 1_000_000 || round(n / 1_000) >= 1_000) return `${round(n / 1_000_000)}M`
  if (n >= 1_000) return `${round(n / 1_000)}k`
  return String(Math.round(n))
}

// 기억력 = 캐시 적중률 = 캐시 읽기 ÷ (입력 + 캐시 쓰기 + 캐시 읽기)
export function memoryRate(s: { in: number; cw: number; cr: number }): number | null {
  const all = s.in + s.cw + s.cr
  return all > 0 ? Math.round((s.cr / all) * 100) : null
}

// "W = 2,140 + 0.1 × (320 + 12,400) = 3,412"
export function formulaLine(u: { in: number; out: number; cw: number }): string {
  const w = Math.round(u.out + 0.1 * (u.in + u.cw))
  return `W = ${comma(u.out)} + 0.1 × (${comma(u.in)} + ${comma(u.cw)}) = ${comma(w)}`
}
