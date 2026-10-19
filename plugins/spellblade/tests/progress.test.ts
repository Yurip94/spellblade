import { expect, test } from 'claude-code/testing'
import { cleanUsage, equipmentAt, legacyTierOf, levelOf, progressOf, stageOf, tierOf, weightOf, xpForLevel, xpOf } from '../hooks/lib/progress.ts'
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

// ---- 4차: 레벨 100 · 3개월 곡선 · 승급 7단계 · 장비 20단계 ----

test('새 곡선: round(1000 × (L−1)^1.25)', async () => {
  expect([1, 2, 3, 8, 11, 100].map(xpForLevel)).toEqual([0, 1000, 2378, 11386, 17783, 312280])
  expect([0, 999, 1000, 10787, 312279, 312280, 999_999].map(levelOf)).toEqual([1, 1, 2, 7, 99, 100, 100])
})

test('레벨 경계는 곡선과 맞는다', async () => {
  for (let l = 1; l < 100; l++) {
    expect(levelOf(xpForLevel(l + 1) - 1)).toBe(l)
    expect(levelOf(xpForLevel(l + 1))).toBe(l + 1)
  }
})

test('만렙 100 · 명성은 새 곡선 기준', async () => {
  expect(progressOf(312280 + 2500)).toMatchObject({ level: 100, isMax: true, fame: 2, into: 0, need: 0, ratio: 1 })
  expect(progressOf(1000)).toMatchObject({ isMax: false, fame: 0, level: 2, into: 0, need: 1378 })
})

test('승급 7단계', async () => {
  expect([1, 9, 10, 25, 45, 65, 85, 99, 100].map(l => stageOf(l).name)).toEqual(['수련생', '수련생', '검사', '마검사', '마검기사', '마검성', '마검제', '마검제', '검신'])
  expect(STAGES.map(s => [s.id, s.minLevel, s.emoji])).toEqual([
    ['trainee', 1, '🪵'], ['swordsman', 10, '🗡️'], ['spellblade', 25, '⚔️'], ['knight', 45, '🛡️'], ['saint', 65, '🌟'], ['lord', 85, '👑'], ['god', 100, '✨'],
  ])
})

test('장비 20단계 · 5레벨마다 · 강화 +N', async () => {
  expect([1, 4, 5, 94, 95, 100].map(tierOf)).toEqual([0, 0, 1, 18, 19, 19])
  expect(equipmentAt(7)).toMatchObject({ weapon: '철검', armor: '가죽 옷', plus: 2, next: { level: 10, weapon: '강철 검' } })
  expect(equipmentAt(100)).toMatchObject({ weapon: '천공의 성검', armor: '전설의 갑옷', plus: 5, next: null })
  expect([1, 50, 100].map(legacyTierOf)).toEqual([0, 5, 11])
})

test('토큰 수가 숫자가 아니면 0 으로 센다', async () => {
  const u = cleanUsage({ input_tokens: NaN, output_tokens: 100, cache_read_input_tokens: undefined, cache_creation_input_tokens: 50 } as any)
  expect(u).toEqual({ input_tokens: 0, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 50 })
  expect(weightOf(u)).toBe(105)
  expect(cleanUsage({ input_tokens: -5, output_tokens: Infinity, cache_read_input_tokens: 1, cache_creation_input_tokens: 2 })).toEqual({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1, cache_creation_input_tokens: 2 })
})
