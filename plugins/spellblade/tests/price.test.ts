import { expect, test } from 'claude-code/testing'
import { apiCost, estimateCost } from '../hooks/lib/price.ts'

const u = (i: number, o: number, cw: number, cr: number) => ({ input_tokens: i, output_tokens: o, cache_creation_input_tokens: cw, cache_read_input_tokens: cr })
const cents = (usd: number) => Math.round(usd * 100)

test('Opus 5.5: 100만 토큰당 입력 $4 · 출력 $20 · 캐시 쓰기 1.25배 · 캐시 읽기 $0.20', async () => {
  expect(cents(apiCost('claude-opus-5-5', u(1_000_000, 0, 0, 0)))).toBe(400)
  expect(cents(apiCost('claude-opus-5-5', u(0, 1_000_000, 0, 0)))).toBe(2000)
  expect(cents(apiCost('claude-opus-5-5', u(0, 0, 1_000_000, 0)))).toBe(500)
  expect(cents(apiCost('claude-opus-5-5', u(0, 0, 0, 1_000_000)))).toBe(20)
})

test('모델 이름은 가장 길게 맞는 앞부분으로 찾는다', async () => {
  expect(cents(apiCost('claude-opus-5-5[1m]', u(1_000_000, 0, 0, 0)))).toBe(400)
  expect(cents(apiCost('claude-opus-5', u(1_000_000, 0, 0, 0)))).toBe(500)
  expect(cents(apiCost('claude-sonnet-5-5', u(0, 1_000_000, 0, 0)))).toBe(1000)
  expect(cents(apiCost('claude-haiku-4-5-20251001', u(1_000_000, 0, 0, 0)))).toBe(100)
  expect(cents(apiCost('us.anthropic.claude-fable-5-1', u(0, 0, 0, 1_000_000)))).toBe(25)
})

test('모르는 모델은 기본 모델(Opus 5.5) 값으로', async () => {
  expect(cents(apiCost('m', u(1_000_000, 0, 0, 0)))).toBe(400)
  expect(cents(apiCost(undefined, u(1_000_000, 0, 0, 0)))).toBe(400)
})

test('Haiku 5.5 는 10만 토큰이 넘는 요청이면 비싼 값', async () => {
  expect(cents(apiCost('claude-haiku-5-5', u(100_000, 1_000_000, 0, 0)))).toBe(51)
  expect(cents(apiCost('claude-haiku-5-5', u(200_000, 1_000_000, 0, 0)))).toBe(260)
})

test('토큰 합만 있는 칸은 기본 모델 값으로 친다(오늘 기록으로 Vorssaint 와 비교)', async () => {
  expect(cents(estimateCost({ in: 1_238, out: 992_550, cw: 4_573_193, cr: 228_607_190 }))).toBe(8844)
})
