import { expect, test } from 'claude-code/testing'
import { ZERO, type Sum } from '../hooks/lib/ledger.ts'
import { earnedTitles, longestStreak, statsOf, streakOf, TITLES } from '../hooks/lib/progression.ts'

const life = (o: Partial<Sum>, extra = {}) => ({ sum: { ...ZERO, ...o }, questsDone: 0, questXp: 0, streak: 0, bestStreak: 0, ...extra })

test('연속 출석', async () => {
  const days = new Set(['2026-10-14', '2026-10-15', '2026-10-16'])
  expect(streakOf(days, '2026-10-16')).toBe(3)
  expect(streakOf(days, '2026-10-17')).toBe(3) // 오늘 아직 0 이면 어제까지
  expect(streakOf(days, '2026-10-18')).toBe(0)
  expect(streakOf(new Set(['2026-10-31', '2026-11-01']), '2026-11-01')).toBe(2) // 달이 바뀌어도
})

test('가장 길었던 연속 출석', async () => {
  expect(longestStreak(new Set(['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07']))).toBe(3)
  expect(longestStreak(new Set())).toBe(0)
})

test('칭호 10개', async () => {
  expect(TITLES.map(t => t.name)).toEqual(['첫 걸음', '백전노장', '천검', '봉인술사', '콤보 마스터', '무결점', '새벽의 검사', '7일의 맹세', '한 달의 맹세', '의뢰 해결사'])
})

test('칭호 판정', async () => {
  expect(earnedTitles(life({ w: 1000 }))).toEqual(['first'])
  expect(earnedTitles(life({ w: 1000, swings: 1000, night: 1 }))).toEqual(['first', 'veteran', 'dawn'])
  expect(earnedTitles(life({}, { bestStreak: 7 }))).toContain('week')
  expect(earnedTitles(life({}))).toEqual([])
})

test('능력치는 1~99', async () => {
  expect(statsOf(life({ swings: 10_000, out: 2_000_000, fast: 400 }))).toEqual({ str: 51, int: 45, agi: 41, luk: 1 })
  expect(statsOf(life({ swings: 1e9 })).str).toBe(99)
  expect(statsOf(life({ bonus: 400 }, { questXp: 500 })).luk).toBe(16)
})
