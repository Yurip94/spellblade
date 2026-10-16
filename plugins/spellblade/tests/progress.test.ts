import { expect, test } from 'claude-code/testing'
import { levelOf, progressOf, stageOf, weightOf, xpForLevel, xpOf } from '../hooks/lib/progress.ts'
import { STAGES } from '../hooks/lib/balance.ts'

// 키트에 toBeCloseTo 가 없다
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9

test('캐시 읽기는 W 에서 빠진다', async () => {
  expect(near(weightOf({ input_tokens: 2, cache_read_input_tokens: 41078, output_tokens: 230, cache_creation_input_tokens: 0 }), 230.2)).toBe(true)
  expect(weightOf({ input_tokens: 100, cache_read_input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 900 })).toBe(100)
})

test('XP 는 W 합을 1,000 으로 나눈 몫 + 보너스', async () => {
  expect(xpOf(1999, 0)).toBe(1)
  expect(xpOf(2000, 20)).toBe(22)
})

test('레벨 L 누적 XP 는 60 × (L − 1)²', async () => {
  expect(xpForLevel(1)).toBe(0)
  expect(xpForLevel(5)).toBe(960)
  expect(xpForLevel(45)).toBe(116160)
})

test('레벨 경계', async () => {
  expect(levelOf(0)).toBe(1)
  expect(levelOf(959)).toBe(4)
  expect(levelOf(960)).toBe(5)
  expect(levelOf(11759)).toBe(14)
  expect(levelOf(11760)).toBe(15)
  expect(levelOf(50460)).toBe(30)
  expect(levelOf(116160)).toBe(45)
})

test('단계 구간', async () => {
  expect(stageOf(4).name).toBe('수련생')
  expect(stageOf(5).name).toBe('검사')
  expect(stageOf(14).name).toBe('검사')
  expect(stageOf(15).name).toBe('마검사')
  expect(stageOf(30).name).toBe('마검기사')
  expect(stageOf(45).name).toBe('마검성')
  expect(stageOf(99).name).toBe('마검성')
})

test('단계 정의는 설계서 그대로', async () => {
  expect(STAGES.map(s => [s.id, s.name, s.minLevel, s.emoji])).toEqual([
    ['trainee', '수련생', 1, '🪵'],
    ['swordsman', '검사', 5, '🗡️'],
    ['spellblade', '마검사', 15, '⚔️'],
    ['knight', '마검기사', 30, '🛡️'],
    ['saint', '마검성', 45, '🌟'],
  ])
})

test('다음 레벨까지', async () => {
  expect(progressOf(1000)).toMatchObject({ xp: 1000, level: 5, into: 40, need: 540 })
  expect(progressOf(1000).stage.name).toBe('검사')
  expect(near(progressOf(1000).ratio, 40 / 540)).toBe(true)
})
