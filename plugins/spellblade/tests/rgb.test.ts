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

// 화면이 그림을 소수 배율(예: 1.15배)로 늘리면 칸 사이 틈으로 바탕(흰색)이 비친다(데스크톱 모닥불 장면의 하얀 점).
// 같은 그림을 반 점 비켜 밑에 한 번 더 깔아 틈에는 옆 칸 색이 보이게 한다 — path 는 색마다 한 번만 쓰고 use 로 두 번 그린다
test('이음매 가리기: 반 점 비킨 그림을 밑에 깐다', async () => {
  const s = rgbToSvg([[0xff0000, 0x00ff00]], 4)
  const id = s.match(/<g id="([^"]+)">/)?.[1] ?? ''
  expect(id).not.toBe('')
  const under = s.indexOf(`<use href="#${id}" transform="translate(.5 .5)"/>`)
  const over = s.indexOf(`<use href="#${id}"/>`)
  expect(under).toBeGreaterThan(s.indexOf('</defs>'))
  expect(over).toBeGreaterThan(under)
  expect(s.match(/<path /g)?.length).toBe(2)
})

test('이음매 가리기: 그림이 다르면 이름도 다르다', async () => {
  const id = (s: string) => s.match(/<g id="([^"]+)">/)?.[1]
  expect(id(rgbToSvg([[1]], 1))).not.toBe(id(rgbToSvg([[2]], 1)))
  expect(id(rgbToSvg([[1]], 1))).toBe(id(rgbToSvg([[1]], 3)))
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

// 이름에 제어 문자가 섞이면 XML 이 깨져 데스크톱 장면 전체가 깨진 그림이 된다
test('XML 에 못 쓰는 글자는 뺀다', async () => {
  expect(escapeXml('렌\u0001\u0008\u000b\u001f\ufffe\uffff!')).toBe('렌!')
  expect(escapeXml('a\tb\nc')).toBe('a\tb\nc')
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
