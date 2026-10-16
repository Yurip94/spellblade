import { expect, test } from 'claude-code/testing'
import { compose, cropTop, gridErrors, HEIGHT, scaleGrid, shiftGrid, WIDTH } from '../hooks/lib/sprites.ts'
import { gridToSvg } from '../hooks/lib/to-svg.ts'
import { gridToRaster } from '../hooks/lib/to-raster.ts'

const P = { a: 0xff0000, b: 0x0000ff }
const row = (s: string) => s.padEnd(WIDTH, '.')
const blank: string[] = Array(HEIGHT).fill(row(''))
const tl = [row('ab'), row('b.'), ...blank.slice(2)]

const decode = (cells: string) => new Uint32Array(Uint8Array.from(atob(cells), c => c.charCodeAt(0)).buffer)

test('합치기는 뒤 층이 덮는다', async () => {
  expect(compose(tl, [row('b'), ...blank.slice(1)])[0].slice(0, 2)).toBe('bb')
  expect(compose(tl, blank)).toEqual(tl)
})

test('크기 · 글자 검사', async () => {
  expect(gridErrors(blank, P)).toEqual([])
  expect(gridErrors(['a'], P).length).toBeGreaterThan(0)
  expect(gridErrors([row('z'), ...blank.slice(1)], P)[0]).toMatch(/z/)
})

test('Svg: 빈 격자에는 path 가 없다', async () => {
  expect(gridToSvg(blank, P, 4)).not.toMatch(/<path/)
})

test('Svg: 이어진 같은 색은 한 조각', async () => {
  const s = gridToSvg([row('aa'), ...blank.slice(1)], P, 4)
  expect(s).toMatch(new RegExp(`width="${WIDTH * 4}"`))
  expect(s).toMatch(new RegExp(`height="${HEIGHT * 4}"`))
  expect(s).toMatch(/M0 0h2v1h-2z/)
  expect(s).toMatch(/#ff0000/)
  expect(s).toMatch(/shape-rendering="crispEdges"/)
})

test('Raster: 반칸 규칙', async () => {
  const r = gridToRaster(tl, P, 'hero')
  expect(r.key).toBe('hero')
  expect([r.columns, r.rows]).toEqual([WIDTH, HEIGHT / 2])
  const u = decode(r.cells)
  expect(u.length).toBe(WIDTH * (HEIGHT / 2) * 3)
  expect([u[0], u[1], u[2]]).toEqual([0x2580, 0xff0000, 0x0000ff])
  expect([u[3], u[4], u[5]]).toEqual([0x2580, 0x0000ff, 0x01000000])
  expect([u[6], u[7], u[8]]).toEqual([0x20, 0x01000000, 0x01000000])
})

test('Raster: 위가 비면 아래 반칸', async () => {
  const u = decode(gridToRaster([row(''), row('a'), ...blank.slice(2)], P, 'k').cells)
  expect([u[0], u[1], u[2]]).toEqual([0x2584, 0xff0000, 0x01000000])
})

test('2배 크기', async () => {
  const big = scaleGrid(tl, 2)
  expect(big.length).toBe(HEIGHT * 2)
  expect(big[0].length).toBe(WIDTH * 2)
  const r = gridToRaster(big, P, 'big')
  expect([r.columns, r.rows]).toEqual([WIDTH * 2, HEIGHT])
})

test('위만 자르기 (터미널 밴드 상반신)', async () => {
  const c = cropTop(tl, 16)
  expect(c.length).toBe(16)
  expect(c[0]).toBe(tl[0])
  expect(gridToRaster(c, P, 'half').rows).toBe(8)
})

test('옮기기: 밖으로 나간 칸은 버린다', async () => {
  const s = shiftGrid(tl, -1, 1)
  expect(s[0]).toBe(row(''))
  expect(s[1].slice(0, 2)).toBe('b.')
  expect(s.length).toBe(HEIGHT)
})
