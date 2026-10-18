import { expect, test } from 'claude-code/testing'
import { blank, blit, escapeXml, rgbToRaster, rgbToSvg, toRgb } from '../hooks/lib/rgb.ts'

test('같은 색 가로줄은 한 조각', async () => {
  const s = rgbToSvg([[1, 1, null, 2]], 2)
  expect(s).toContain('M0 0h2v1h-2z')
  expect(s).toContain('width="8" height="2"')
  expect(s.match(/<path/g)?.length).toBe(2)
  expect(s).toContain('shape-rendering="crispEdges"')
})

test('그림 크기는 격자 × 점 크기', async () => {
  expect(rgbToSvg(blank(160, 64), 2)).toContain('width="320" height="128"')
})

test('extra 는 svg 끝에 붙는다', async () => {
  expect(rgbToSvg([[1]], 1, '<text>a</text>')).toMatch(/<text>a<\/text><\/svg>$/)
})

test('투명 칸은 터미널 기본색', async () => {
  const r = rgbToRaster([[null], [0xff0000]], 'k')
  expect([r.key, r.columns, r.rows]).toEqual(['k', 1, 1])
  const bytes = Uint8Array.from(atob(r.cells), c => c.charCodeAt(0))
  const words = new Uint32Array(bytes.buffer)
  expect([words[0], words[1], words[2]]).toEqual([0x2584, 0xff0000, 0x01000000])
})

test('XML 특수문자를 막는다', async () => {
  expect(escapeXml('<렌&"\'>')).toBe('&lt;렌&amp;&quot;&apos;&gt;')
})

test('blit 은 투명을 건너뛰고 밖은 자른다', async () => {
  const d = blank(2, 1)
  blit(d, [[null, 5, 6]], 0, 0)
  expect(d).toEqual([[null, 5]])
  blit(d, [[7]], -1, 0) // 왼쪽 밖
  expect(d).toEqual([[null, 5]])
})

test('blit 은 색을 섞을 수 있다', async () => {
  const d = blank(1, 1)
  blit(d, [[0x000000]], 0, 0, { color: 0xffffff, k: 0.5 })
  expect(d[0][0]).toBe(0x808080)
})

test('글자 격자를 색 격자로', async () => {
  expect(toRgb({ grid: ['a.b'], palette: { a: 1, b: 2 } })).toEqual([[1, null, 2]])
})
