import { expect, test } from 'claude-code/testing'
import { cacheReuse, formulaLine, hitRate, shortNum } from '../hooks/lib/tokens.ts'

test('숫자 줄이기', async () => {
  expect([shortNum(999), shortNum(1_234), shortNum(3_400_000), shortNum(12_000)]).toEqual(['999', '1.2k', '3.4M', '12k'])
})

test('캐시 재사용', async () => {
  expect(cacheReuse({ in: 2, cw: 50, cr: 52_012 })).toBe(100)
  expect(cacheReuse({ in: 500, cw: 500, cr: 1_000 })).toBe(50)
  expect(cacheReuse({ in: 0, cw: 0, cr: 0 })).toBe(null)
})

test('위력 식은 게임 말로', async () => {
  expect(formulaLine({ in: 320, out: 2_140, cw: 12_400 })).toBe('위력 = 시전 2,140 + 0.1 × (주문서 320 + 외워 둠 12,400)')
})

test('마법 적중률 = 적중 ÷ 쏜 수', async () => {
  expect(hitRate({ casts: 25, hits: 23 })).toBe(92)
  expect(hitRate({ casts: 3, hits: 0 })).toBe(0)
  expect(hitRate({ casts: 0, hits: 0 })).toBe(null)
})

test('반올림해서 1,000k 가 되면 M 으로', async () => {
  expect(shortNum(999_999)).toBe('1M')
  expect(shortNum(999_499)).toBe('999k')
})
