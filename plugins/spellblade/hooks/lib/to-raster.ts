import { CLEAR, type Grid, type Palette } from './sprites.ts'

const UPPER = 0x2580 // ▀
const LOWER = 0x2584 // ▄
const SPACE = 0x20
const DEFAULT = 0x01000000 // 터미널 기본색

export type RasterCells = { key: string; columns: number; rows: number; cells: string }

function toBase64(bytes: Uint8Array): string {
  const native = bytes as Uint8Array & { toBase64?: () => string }
  if (typeof native.toBase64 === 'function') return native.toBase64()
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

// 위아래 도트 두 개를 문자 한 칸에: ▀ 의 글자색이 위, 배경색이 아래
export function gridToRaster(grid: Grid, palette: Palette, key: string): RasterCells {
  const columns = grid[0]?.length ?? 0
  const rows = Math.ceil(grid.length / 2)
  const color = (c: string | undefined) => (c === undefined || c === CLEAR || !(c in palette) ? null : palette[c])
  const words: number[] = []
  for (let r = 0; r < rows; r++) {
    for (let x = 0; x < columns; x++) {
      const top = color(grid[2 * r]?.[x])
      const bottom = color(grid[2 * r + 1]?.[x])
      if (top !== null) words.push(UPPER, top, bottom ?? DEFAULT)
      else if (bottom !== null) words.push(LOWER, bottom, DEFAULT)
      else words.push(SPACE, DEFAULT, DEFAULT)
    }
  }
  return { key, columns, rows, cells: toBase64(new Uint8Array(Uint32Array.from(words).buffer)) }
}
