import { CLEAR, type Grid, type Palette } from './sprites.ts'
import { DEFAULT, LOWER, SPACE, UPPER, toBase64, type RasterCells } from './to-raster.ts'

// 3차 장면은 색 격자로 합친다: 칸마다 0xRRGGBB, null 은 투명

export type RgbGrid = (number | null)[][]

export function toRgb(f: { grid: Grid; palette: Palette }): RgbGrid {
  return f.grid.map(r => [...r].map(c => (c === CLEAR || !(c in f.palette) ? null : f.palette[c])))
}

export function blank(w: number, h: number): RgbGrid {
  return Array.from({ length: h }, () => Array<number | null>(w).fill(null))
}

const channel = (c: number, shift: number) => (c >> shift) & 255

export function mixRgb(a: number, b: number, k: number): number {
  const m = (s: number) => Math.round(channel(a, s) + (channel(b, s) - channel(a, s)) * k)
  return (m(16) << 16) | (m(8) << 8) | m(0)
}

// src 의 불투명 칸을 dst 의 (ox, oy) 에 얹는다. 밖은 자르고, tint 가 있으면 그 색 쪽으로 k 만큼 섞는다
export function blit(dst: RgbGrid, src: RgbGrid, ox: number, oy: number, tint?: { color: number; k: number }): void {
  for (let y = 0; y < src.length; y++) {
    const row = dst[oy + y]
    if (!row) continue
    for (let x = 0; x < src[y].length; x++) {
      const v = src[y][x]
      const X = ox + x
      if (v === null || X < 0 || X >= row.length) continue
      row[X] = tint ? mixRgb(v, tint.color, tint.k) : v
    }
  }
}

const hex = (rgb: number) => '#' + rgb.toString(16).padStart(6, '0')

// 그림 내용에서 짧은 이름을 만든다(FNV-1a) — 한 화면에 여러 SVG 가 함께 놓여도 use 가 남의 그림을 가리키지 않게
function nameOf(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return 'p' + h.toString(36)
}

// 색마다 path 하나, 가로로 이어진 같은 색은 한 조각. extra(이름표 등)는 viewBox 점 좌표로 </svg> 앞에 붙는다.
// 화면이 그림을 소수 배율로 늘리면 칸 사이 틈으로 바탕(흰색)이 비친다 — 같은 그림을 반 점 비켜 밑에 한 번 더 깔아
// 틈에는 옆 칸 색이 보이게 한다(path 는 한 번만 쓰고 use 로 두 번 그린다)
export function rgbToSvg(g: RgbGrid, pixel: number, extra = ''): string {
  const h = g.length
  const w = g[0]?.length ?? 0
  const runs = new Map<number, string[]>()
  g.forEach((r, y) => {
    let x = 0
    while (x < r.length) {
      const c = r[x]
      let n = 1
      while (x + n < r.length && r[x + n] === c) n++
      if (c !== null) {
        const list = runs.get(c) ?? []
        list.push(`M${x} ${y}h${n}v1h-${n}z`)
        runs.set(c, list)
      }
      x += n
    }
  })
  const paths = [...runs].map(([c, d]) => `<path fill="${hex(c)}" d="${d.join('')}"/>`).join('')
  const id = nameOf(paths)
  const layers = `<defs><g id="${id}">${paths}</g></defs><use href="#${id}" transform="translate(.5 .5)"/><use href="#${id}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * pixel}" height="${h * pixel}" shape-rendering="crispEdges">${layers}${extra}</svg>`
}

// 위아래 점 두 개를 글자 한 칸에(▀ 글자색 = 위, 배경색 = 아래). 투명은 터미널 기본색
export function rgbToRaster(g: RgbGrid, key: string): RasterCells {
  const columns = g[0]?.length ?? 0
  const rows = Math.ceil(g.length / 2)
  const words: number[] = []
  for (let r = 0; r < rows; r++) {
    for (let x = 0; x < columns; x++) {
      const top = g[2 * r]?.[x] ?? null
      const bottom = g[2 * r + 1]?.[x] ?? null
      if (top !== null) words.push(UPPER, top, bottom ?? DEFAULT)
      else if (bottom !== null) words.push(LOWER, bottom, DEFAULT)
      else words.push(SPACE, DEFAULT, DEFAULT)
    }
  }
  return { key, columns, rows, cells: toBase64(new Uint8Array(Uint32Array.from(words).buffer)) }
}

const XML: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }

// XML 에 쓸 수 없는 제어 문자 · U+FFFE · U+FFFF 는 빼고(들어가면 SVG 전체가 깨진다) 특수문자는 막는다
export function escapeXml(s: string): string {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/[&<>"']/g, c => XML[c])
}
