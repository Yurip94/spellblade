import { expect, test } from 'claude-code/testing'
import { ZERO } from '../hooks/lib/ledger.ts'
import { questReward, questStatus, questsFor, questValue } from '../hooks/lib/quests.ts'

const day = (m: number, d: number) => `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

test('같은 날은 같은 의뢰', async () => {
  expect(questsFor('2026-10-16')).toEqual(questsFor('2026-10-16'))
})

test('종류는 셋 다 다르고 난이도는 쉬움 · 보통 · 어려움 순서', async () => {
  for (let d = 1; d <= 28; d++) {
    const qs = questsFor(day(11, d))
    expect(new Set(qs.map(q => q.kind)).size).toBe(3)
    expect(qs.map(q => q.tier)).toEqual(['easy', 'normal', 'hard'])
    expect(qs.map(q => q.reward)).toEqual([30, 50, 80])
    expect(qs.map(q => q.index)).toEqual([0, 1, 2])
  }
})

test('여러 날에 걸쳐 여러 종류가 나온다', async () => {
  const kinds = new Set(Array.from({ length: 30 }, (_, i) => questsFor(day(12, i + 1))).flat().map(q => q.kind))
  expect(kinds.size).toBeGreaterThanOrEqual(6)
})

test('의뢰 이름', async () => {
  const titles = new Set(Array.from({ length: 60 }, (_, i) => questsFor(`2027-0${1 + (i % 9)}-${String(1 + (i % 28)).padStart(2, '0')}`)).flat().map(q => q.title))
  expect([...titles].some(t => /^베기 \d+번$/.test(t) || /^반격 없이 \d+턴 연속$/.test(t) || /^×\d+ 콤보$/.test(t))).toBe(true)
})

test('값 세기: 합 · 최대 · 비트 수 · XP', async () => {
  expect(questValue('skills', { ...ZERO, skills: 0b1011 }, 0)).toBe(3)
  expect(questValue('combo', { ...ZERO, combo: 21 }, 0)).toBe(21)
  expect(questValue('xp', ZERO, 812)).toBe(812)
  expect(questValue('swings', { ...ZERO, swings: 57 }, 0)).toBe(57)
})

test('보상은 끝난 것만', async () => {
  const d = '2026-10-16'
  const full = { ...ZERO, swings: 999, commits: 9, clean: 99, combo: 99, skills: 0x3ff, fast: 99, agents: 9 }
  expect(questReward(d, full, 9_999)).toBe(30 + 50 + 80)
  expect(questReward(d, ZERO, 0)).toBe(0)
  expect(questStatus(d, full, 9_999).every(s => s.done)).toBe(true)
})
