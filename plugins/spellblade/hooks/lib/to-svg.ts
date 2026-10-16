import { CLEAR, type Grid, type Palette } from './sprites.ts'

const hex = (rgb: number) => '#' + rgb.toString(16).padStart(6, '0')

// 색마다 path 하나, 가로로 이어진 같은 색은 한 조각으로 합친다
function paths(grid: Grid, palette: Palette): string {
  const runs = new Map<string, string[]>()
  grid.forEach((r, y) => {
    let x = 0
    while (x < r.length) {
      const c = r[x]
      let n = 1
      while (x + n < r.length && r[x + n] === c) n++
      if (c !== CLEAR && c in palette) {
        const list = runs.get(c) ?? []
        list.push(`M${x} ${y}h${n}v1h-${n}z`)
        runs.set(c, list)
      }
      x += n
    }
  })
  return [...runs].map(([c, d]) => `<path fill="${hex(palette[c])}" d="${d.join('')}"/>`).join('')
}

function open(grid: Grid, pixel: number): string {
  const h = grid.length
  const w = grid[0]?.length ?? 0
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * pixel}" height="${h * pixel}" shape-rendering="crispEdges">`
}

export function gridToSvg(grid: Grid, palette: Palette, pixel: number): string {
  return `${open(grid, pixel)}${paths(grid, palette)}</svg>`
}

// 여러 프레임을 SVG 안에서 번갈아 보이기(데스크톱 isInteractive) — 다시 그리지 않아도 움직인다
// frameMs: 모든 프레임 같은 길이, 또는 프레임마다 길이(ms)
export function framesToSvg(frames: readonly { grid: Grid; palette: Palette }[], pixel: number, frameMs: number | readonly number[]): string {
  if (frames.length === 1) return gridToSvg(frames[0].grid, frames[0].palette, pixel)
  const n = frames.length
  const lengths = typeof frameMs === 'number' ? Array(n).fill(frameMs) : frameMs
  const total = lengths.reduce((a, b) => a + b, 0)
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0) / total)
  const keyTimes = starts.map(t => t.toFixed(4)).join(';')
  const groups = frames.map((f, i) => {
    const values = Array.from({ length: n }, (_, j) => (i === j ? 'visible' : 'hidden')).join(';')
    return `<g visibility="${i === 0 ? 'visible' : 'hidden'}"><animate attributeName="visibility" values="${values}" keyTimes="${keyTimes}" dur="${total}ms" calcMode="discrete" repeatCount="indefinite"/>${paths(f.grid, f.palette)}</g>`
  })
  return `${open(frames[0].grid, pixel)}${groups.join('')}</svg>`
}
