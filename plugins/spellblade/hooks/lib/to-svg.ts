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
