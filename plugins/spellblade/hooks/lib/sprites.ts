// 도트 한 장 = 글자 격자. '.' 은 투명, 나머지 글자는 팔레트 색.

export const WIDTH = 20
export const HEIGHT = 16
export const CLEAR = '.'

export type Grid = readonly string[]
export type Palette = Readonly<Record<string, number>>

// 뒤 층의 투명이 아닌 글자가 앞 층을 덮는다
export function compose(...layers: Grid[]): Grid {
  const [first, ...rest] = layers
  const out = first.map(r => r.split(''))
  for (const layer of rest) {
    layer.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) if (r[x] !== CLEAR && out[y]) out[y][x] = r[x]
    })
  }
  return out.map(r => r.join(''))
}

export function gridErrors(grid: Grid, palette: Palette): string[] {
  const errors: string[] = []
  if (grid.length !== HEIGHT) errors.push(`줄 수가 ${grid.length} — ${HEIGHT}줄이어야 한다`)
  grid.forEach((r, y) => {
    if (r.length !== WIDTH) errors.push(`${y}번 줄 길이가 ${r.length} — ${WIDTH}칸이어야 한다`)
    for (const c of r) if (c !== CLEAR && !(c in palette)) errors.push(`${y}번 줄의 '${c}' 가 팔레트에 없다`)
  })
  return errors
}

export function scaleGrid(grid: Grid, k: 1 | 2): Grid {
  if (k === 1) return grid
  return grid.flatMap(r => {
    const wide = r.split('').map(c => c + c).join('')
    return [wide, wide]
  })
}
