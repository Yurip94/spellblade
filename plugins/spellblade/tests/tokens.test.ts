import { expect, test } from 'claude-code/testing'
import { formulaLine, memoryRate, shortNum } from '../hooks/lib/tokens.ts'

test('숫자 줄이기', async () => {
  expect([shortNum(999), shortNum(1_234), shortNum(3_400_000), shortNum(12_000)]).toEqual(['999', '1.2k', '3.4M', '12k'])
})

test('기억력', async () => {
  expect(memoryRate({ in: 2, cw: 50, cr: 52_012 })).toBe(100)
  expect(memoryRate({ in: 500, cw: 500, cr: 1_000 })).toBe(50)
  expect(memoryRate({ in: 0, cw: 0, cr: 0 })).toBe(null)
})

test('W 식', async () => {
  expect(formulaLine({ in: 320, out: 2_140, cw: 12_400 })).toBe('W = 2,140 + 0.1 × (320 + 12,400) = 3,412')
})

test('반올림해서 1,000k 가 되면 M 으로', async () => {
  expect(shortNum(999_999)).toBe('1M')
  expect(shortNum(999_499)).toBe('999k')
})
