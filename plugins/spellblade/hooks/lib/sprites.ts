// 도트 한 장 = 글자 격자. '.' 은 투명, 나머지 글자는 팔레트 색.

export const WIDTH = 32 // /blade probe 시험 무늬 크기
export const HEIGHT = 32
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
