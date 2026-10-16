import type { Grid, Palette } from './sprites.ts'

// 재질 글자로 그린 격자에 음영 · 테두리를 자동으로 넣는다 (2차 설계 12장)
// - 재질마다 4톤: 밝은(따뜻한 빛 쪽) · 기본 · 어두운(차가운 그림자 쪽) · 테두리
// - 빛은 왼쪽 위: 위 · 왼쪽이 다른 재질이면 밝은 톤, 아래 · 오른쪽이 다르면 어두운 톤
// - 피부(S)는 평평하게, 머리(H) 바로 아래와 턱 아래만 그림자
// - details(눈 · 입 · 윤기 · 룬)는 경계로 보지 않고 색도 그대로
// - 투명 칸이 재질과 맞닿으면 그 재질의 테두리 톤

type Tone = 'hi' | 'base' | 'lo' | 'out'

const channel = (c: number, shift: number) => (c >> shift) & 255
function mix(c: number, t: number, k: number): number {
  const m = (s: number) => Math.round(channel(c, s) + (channel(t, s) - channel(c, s)) * k)
  return (m(16) << 16) | (m(8) << 8) | m(0)
}

export function tonesOf(base: number): Record<Tone, number> {
  return { hi: mix(base, 0xfff4d8, 0.35), base, lo: mix(base, 0x1c1830, 0.38), out: mix(base, 0x0c0a14, 0.72) }
}

const POOL = 'abcdefghijklnopqrstuvxyz0123456789!@#$%^&*+=?<>~;:,_-|/(){}[]`\'"'

export function shade(grid: Grid, palette: Palette, materials: string, details: string): { grid: Grid; palette: Palette } {
  const h = grid.length
  const w = grid[0]?.length ?? 0
  const at = (x: number, y: number) => (x >= 0 && x < w && y >= 0 && y < h ? grid[y][x] : '.')
  const out: Palette & Record<string, number> = { ...palette }
  const keys = new Map<string, string>()
  let next = 0
  const keyFor = (m: string, t: Tone) => {
    const id = m + t
    let k = keys.get(id)
    if (!k) {
      while (POOL[next] in out) next++
      k = POOL[next++]
      out[k] = tonesOf(palette[m])[t]
      keys.set(id, k)
    }
    return k
  }
  const rows = grid.map((row, y) =>
    [...row]
      .map((m, x) => {
        if (materials.includes(m) && m in palette) {
          const same = (n: string) => n === m || details.includes(n)
          const up = at(x, y - 1)
          const down = at(x, y + 1)
          const top = !same(up) || !same(at(x - 1, y))
          const bottom = !same(down) || !same(at(x + 1, y))
          let t: Tone
          if (m === 'S') t = up === 'H' || !same(down) ? 'lo' : 'base'
          else if (bottom && !top) t = 'lo'
          else if (top && !bottom) t = 'hi'
          else t = 'base'
          return t === 'base' ? m : keyFor(m, t)
        }
        if (m === '.') {
          for (const [nx, ny] of [[x, y - 1], [x - 1, y], [x + 1, y], [x, y + 1]]) {
            const n = at(nx, ny)
            if (materials.includes(n) && n in palette) return keyFor(n, 'out')
          }
        }
        return m
      })
      .join(''),
  )
  return { grid: rows, palette: out }
}
