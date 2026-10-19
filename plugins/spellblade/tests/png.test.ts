import { expect, test } from 'claude-code/testing'
import { pngSvg, rgbToPng } from '../hooks/lib/png.ts'

const bytes = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0))
const u32 = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0

// PNG 를 풀어 필터 바이트가 붙은 원래 줄들로(압축 없는 deflate 만 — 우리 PNG 가 쓰는 것)
function unpack(b64: string): { w: number; h: number; raw: number[] } {
  const b = bytes(b64)
  let at = 8
  let w = 0
  let h = 0
  const z: number[] = []
  while (at < b.length) {
    const len = u32(b, at)
    const type = String.fromCharCode(...b.slice(at + 4, at + 8))
    const data = b.slice(at + 8, at + 8 + len)
    if (type === 'IHDR') [w, h] = [u32(data, 0), u32(data, 4)]
    if (type === 'IDAT') z.push(...data)
    at += 12 + len
  }
  const raw: number[] = []
  let i = 2 // zlib 머리 78 01
  for (;;) {
    const head = z[i]
    const len = z[i + 1] | (z[i + 2] << 8)
    expect(head & 6).toBe(0) // 압축 없는 블록
    expect((z[i + 3] | (z[i + 4] << 8)) ^ 0xffff).toBe(len)
    raw.push(...z.slice(i + 5, i + 5 + len))
    i += 5 + len
    if (head & 1) break
  }
  return { w, h, raw }
}

test('색 격자 → PNG(RGBA · 압축 없는 deflate): Python zlib 으로 만든 것과 같은 바이트', async () => {
  expect(rgbToPng([[0xff0000, null]])).toBe('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAFElEQVR4AQEJAPb/AP8AAP8AAAAADPwB/0DIcroAAAAASUVORK5CYII=')
})

test('큰 그림은 65,535 바이트씩 나눠 담고, 풀면 원래 점이다', async () => {
  // 160 × 120 → 한 줄 641 바이트 × 120 = 76,920 바이트 → 블록 둘
  const g = Array.from({ length: 120 }, (_, y) => Array.from({ length: 160 }, (_, x) => (((x * 7 + y * 13) & 255) << 8) | 0x400001))
  const { w, h, raw } = unpack(rgbToPng(g))
  expect([w, h, raw.length]).toEqual([160, 120, 120 * 641])
  const px = (x: number, y: number) => raw.slice(y * 641 + 1 + x * 4, y * 641 + 5 + x * 4)
  expect(raw[641 * 119]).toBe(0) // 줄마다 필터 없음
  expect(px(0, 0)).toEqual([0x40, 0, 1, 255])
  expect(px(159, 119)).toEqual([0x40, (159 * 7 + 119 * 13) & 255, 1, 255])
})

test('PNG 를 넣은 SVG: 크기 = 격자 × 점, 점이 뭉개지지 않게, href · xlink:href 둘 다 만들 수 있다', async () => {
  const s = pngSvg([[1, 2]], 4, 'href')
  expect(s).toContain('width="8" height="4"')
  expect(s).toContain('<image href="data:image/png;base64,iVBORw0KGgo')
  expect(s).toContain('image-rendering:pixelated')
  const x = pngSvg([[1, 2]], 4, 'xlink:href')
  expect(x).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"')
  expect(x).toContain('<image xlink:href="data:image/png;base64,iVBORw0KGgo')
})
