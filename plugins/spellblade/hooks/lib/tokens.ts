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

// 캐시 재사용 = 이미 읽은 내용을 다시 읽지 않고 넘어간 비율 = 캐시 읽기 ÷ (입력 + 캐시 쓰기 + 캐시 읽기)
export function cacheReuse(s: { in: number; cw: number; cr: number }): number | null {
  const all = s.in + s.cw + s.cr
  return all > 0 ? Math.round((s.cr / all) * 100) : null
}

// 위력(W) 식을 게임 말로: 시전 = 출력, 주문서 = 입력, 외워 둠 = 캐시 쓰기
// "위력 = 시전 2,140 + 0.1 × (주문서 320 + 외워 둠 12,400)"
export function formulaLine(u: { in: number; out: number; cw: number }): string {
  return `위력 = 시전 ${comma(u.out)} + 0.1 × (주문서 ${comma(u.in)} + 외워 둠 ${comma(u.cw)})`
}

// 마법 적중률 = 적중 ÷ 쏜 수(%), 쏜 적이 없으면 null
export function hitRate(s: { casts: number; hits: number }): number | null {
  return s.casts > 0 ? Math.round((s.hits / s.casts) * 100) : null
}
