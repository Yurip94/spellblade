import { expect, test } from 'claude-code/testing'
import { shade, tonesOf } from '../hooks/lib/shade.ts'

test('음영: 빛은 왼쪽 위, 바깥은 테두리', async () => {
  const g = shade(['....', '.AA.', '.AA.', '....'], { A: 0x808080 }, 'A', '')
  const c = (x: number, y: number) => g.palette[g.grid[y][x]]
  const t = tonesOf(0x808080)
  expect(c(1, 1)).toBe(t.hi)
  expect(c(2, 2)).toBe(t.lo)
  expect(c(0, 1)).toBe(t.out)
  expect(g.grid[0][0]).toBe('.') // 대각선만 닿은 칸은 비워 둔다
})

test('음영: 눈 · 입은 피부에 얼룩을 만들지 않는다', async () => {
  const g = shade(['SSS', 'SES', 'SSS'], { S: 0xf2c9a2, E: 0x222244 }, 'S', 'E')
  expect(g.palette[g.grid[1][0]]).toBe(g.palette[g.grid[1][2]])
  expect(g.palette[g.grid[1][1]]).toBe(0x222244) // 디테일은 그대로
})

test('음영: 앞머리 바로 아래 피부는 그림자', async () => {
  const g = shade(['HHH', 'SSS', 'SSS', 'SSS'], { H: 0x5a3a2a, S: 0xf2c9a2 }, 'SH', '')
  expect(g.palette[g.grid[1][1]]).toBe(tonesOf(0xf2c9a2).lo) // 앞머리 아래
  expect(g.palette[g.grid[2][1]]).toBe(0xf2c9a2) // 가운데는 평평
  expect(g.palette[g.grid[3][1]]).toBe(tonesOf(0xf2c9a2).lo) // 턱 아래
})

test('음영 결과 크기는 그대로', async () => {
  const g = shade(['.A', 'A.'], { A: 0x123456 }, 'A', '')
  expect(g.grid.length).toBe(2)
  expect(g.grid.every(r => r.length === 2)).toBe(true)
})
