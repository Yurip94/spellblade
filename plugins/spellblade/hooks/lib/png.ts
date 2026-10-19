import type { RgbGrid } from './rgb.ts'
import { toBase64 } from './to-raster.ts'

// 색 격자 → PNG(RGBA 8비트, 투명 칸은 알파 0). 압축은 하지 않고 deflate 의 「저장」 블록에 그대로 담는다 —
// 어느 실행 환경에서나 돌고, 작은 픽셀 그림이라 크기도 괜찮다

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const STORED_MAX = 65_535 // 저장 블록 하나에 담는 최대 바이트

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes: readonly number[]): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function adler32(bytes: Uint8Array): number {
  let a = 1
  let b = 0
  for (const v of bytes) {
    a = (a + v) % 65_521
    b = (b + a) % 65_521
  }
  return ((b << 16) | a) >>> 0
}

const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]

function chunk(type: string, data: readonly number[]): number[] {
  const body = [...type].map(c => c.charCodeAt(0)).concat(data)
  return [...u32(data.length), ...body, ...u32(crc32(body))]
}

// zlib 머리(78 01) + 저장 블록들 + adler32
function zlibStored(raw: Uint8Array): number[] {
  const out = [0x78, 0x01]
  for (let at = 0; at < raw.length || at === 0; at += STORED_MAX) {
    const part = raw.subarray(at, at + STORED_MAX)
    const last = at + STORED_MAX >= raw.length
    out.push(last ? 1 : 0, part.length & 255, part.length >>> 8, ~part.length & 255, (~part.length >>> 8) & 255)
    for (const v of part) out.push(v)
  }
  return [...out, ...u32(adler32(raw))]
}

// base64 PNG 한 장
export function rgbToPng(g: RgbGrid): string {
  const h = g.length
  const w = g[0]?.length ?? 0
  const raw = new Uint8Array(h * (1 + w * 4))
  let i = 0
  for (const row of g) {
    raw[i++] = 0 // 필터 없음
    for (let x = 0; x < w; x++) {
      const v = row[x] ?? null
      if (v !== null) raw.set([(v >> 16) & 255, (v >> 8) & 255, v & 255, 255], i)
      i += 4
    }
  }
  const ihdr = [...u32(w), ...u32(h), 8, 6, 0, 0, 0] // 8비트 · RGBA · 기본 압축 · 기본 필터 · 인터레이스 없음
  return toBase64(Uint8Array.from([...SIGNATURE, ...chunk('IHDR', ihdr), ...chunk('IDAT', zlibStored(raw)), ...chunk('IEND', [])]))
}

// PNG 한 장을 담은 SVG(격자 × 점 크기). 늘려도 점이 뭉개지지 않게 pixelated.
// href 와 옛 xlink:href 중 데스크톱이 어느 쪽을 그리는지 시험 창이 둘 다 보여 준다
export function pngSvg(g: RgbGrid, pixel: number, attr: 'href' | 'xlink:href' = 'href'): string {
  const h = g.length
  const w = g[0]?.length ?? 0
  const ns = attr === 'xlink:href' ? ' xmlns:xlink="http://www.w3.org/1999/xlink"' : ''
  return `<svg xmlns="http://www.w3.org/2000/svg"${ns} viewBox="0 0 ${w} ${h}" width="${w * pixel}" height="${h * pixel}"><image ${attr}="data:image/png;base64,${rgbToPng(g)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" style="image-rendering:pixelated"/></svg>`
}
