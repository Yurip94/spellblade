import { expect, test } from 'claude-code/testing'
import { addSum, allowedBonus, dayKey, entryKey, isEntry, normalizeEntry, parseEntryKey, sumByDay, sumEntries, sumXp, ZERO } from '../hooks/lib/ledger.ts'

test('dayKey 자정 경계(서울)', async () => {
  expect(dayKey(Date.UTC(2026, 9, 16, 14, 59), -540)).toBe('2026-10-16')
  expect(dayKey(Date.UTC(2026, 9, 16, 15, 0), -540)).toBe('2026-10-17')
})

test('dayKey 는 UTC 시간대도 받는다', async () => {
  expect(dayKey(Date.UTC(2026, 0, 1, 0, 0), 0)).toBe('2026-01-01')
})

test('키 만들기 · 읽기', async () => {
  expect(entryKey('2026-10-16', 'abc')).toBe('d:2026-10-16:abc')
  expect(parseEntryKey('d:2026-10-16:abc')).toEqual({ day: '2026-10-16', sessionId: 'abc' })
  expect(parseEntryKey('profile')).toBe(null)
  expect(parseEntryKey('d:bad')).toBe(null)
})

const e = (w: number, bonus = 0, swings = 0) => ({ w, bonus, swings, updatedAt: 1 })
const rows: [string, unknown][] = [
  ['d:2026-10-15:a', e(1500)],
  ['d:2026-10-16:a', e(600, 20, 3)],
  ['d:2026-10-16:b', e(500)],
  ['profile', { name: '렌' }],
]

test('여러 세션 · 여러 날 합치기', async () => {
  expect(sumEntries(rows)).toMatchObject({ w: 2600, bonus: 20, swings: 3 })
  expect(sumXp(sumEntries(rows))).toBe(22)
  expect(sumEntries(rows, { day: '2026-10-16' }).w).toBe(1100)
  expect(sumEntries(rows, { day: '2026-10-16', excludeSession: 'a' }).w).toBe(500)
  expect(sumEntries(rows, { onlySession: 'a' }).w).toBe(2100)
  expect(sumEntries(rows, { notDay: '2026-10-16' }).w).toBe(1500)
})

test('망가진 값은 건너뛴다', async () => {
  const bad: [string, unknown][] = [
    ['d:2026-10-16:x', { w: 'a' }],
    ['d:2026-10-16:y', null],
    ['d:bad', e(9)],
    ['d:2026-10-16:z', e(-5)],
    ['d:2026-10-16:n', { w: NaN, bonus: 0, swings: 0, updatedAt: 1 }],
  ]
  expect(sumEntries(bad)).toEqual(ZERO)
  expect(isEntry(e(1))).toBe(true)
  expect(isEntry({ w: 1, bonus: 0, swings: 0 })).toBe(false)
})

test('합 더하기', async () => {
  expect(addSum({ w: 1, bonus: 2, swings: 3, updatedAt: 0 }, { w: 10, bonus: 20, swings: 30, updatedAt: 0 })).toMatchObject({ w: 11, bonus: 22, swings: 33 })
})

test('보너스 하루 상한', async () => {
  expect(allowedBonus(290, 20)).toBe(10)
  expect(allowedBonus(300, 50)).toBe(0)
  expect(allowedBonus(0, 50)).toBe(50)
})

// ---- 2차: 새 기록 칸 ----

test('1차 칸도 읽힌다', async () => {
  expect(isEntry({ w: 1, bonus: 0, swings: 0, updatedAt: 1 })).toBe(true)
})

test('새 칸이 이상하면 버린다', async () => {
  expect(isEntry({ w: 1, bonus: 0, swings: 0, updatedAt: 1, out: -1 })).toBe(false)
  expect(isEntry({ w: 1, bonus: 0, swings: 0, updatedAt: 1, combo: 'x' })).toBe(false)
})

test('없는 칸은 0 으로', async () => {
  expect(normalizeEntry({ w: 1, bonus: 2, swings: 3, updatedAt: 4 })).toMatchObject({ in: 0, out: 0, cw: 0, cr: 0, turns: 0, fast: 0, clean: 0, combo: 0, commits: 0, prs: 0, agents: 0, skills: 0, night: 0 })
})

test('합 · 최대 · 비트 합', async () => {
  const s = addSum({ ...ZERO, out: 10, combo: 7, clean: 2, skills: 0b0011 }, { ...ZERO, out: 5, combo: 4, clean: 9, skills: 0b0100 })
  expect([s.out, s.combo, s.clean, s.skills]).toEqual([15, 7, 9, 0b0111])
})

test('1차 칸도 새 칸 0 으로 합친다', async () => {
  const s = sumEntries([['d:2026-10-16:a', e(5)], ['d:2026-10-16:b', { ...e(1), out: 7, combo: 3 }]])
  expect([s.w, s.out, s.combo, s.turns]).toEqual([6, 7, 3, 0])
})

test('날짜별 합', async () => {
  const m = sumByDay([['d:2026-10-15:a', e(1)], ['d:2026-10-16:a', e(2)], ['d:2026-10-16:b', e(3)], ['profile', { name: '렌' }]])
  expect(m.get('2026-10-16')?.w).toBe(5)
  expect(m.get('2026-10-15')?.w).toBe(1)
  expect(m.size).toBe(2)
})

test('마법 쏜 수 · 적중 수도 칸에 넣고 더한다', async () => {
  const a = { w: 1, bonus: 0, swings: 0, updatedAt: 1, casts: 4, hits: 3 }
  const b = { w: 1, bonus: 0, swings: 0, updatedAt: 1, casts: 2, hits: 2 }
  expect(isEntry(a)).toBe(true)
  expect(isEntry({ ...a, hits: -1 })).toBe(false)
  expect(addSum(a, b)).toMatchObject({ casts: 6, hits: 5 })
  expect(ZERO).toMatchObject({ casts: 0, hits: 0 })
})

test('골드(api, 달러)도 칸에 넣고 더한다', async () => {
  const a = { w: 1, bonus: 0, swings: 0, updatedAt: 1, api: 1.25 }
  expect(isEntry(a)).toBe(true)
  expect(isEntry({ ...a, api: -1 })).toBe(false)
  expect(Math.round(addSum(a, { ...a, api: 0.5 }).api * 100)).toBe(175)
})

test('값(api)이 없는 칸은 그 토큰을 기본 모델 값으로 쳐서 더한다', async () => {
  const old = { w: 1, bonus: 0, swings: 0, updatedAt: 1, out: 1_000_000 }
  const priced = { w: 1, bonus: 0, swings: 0, updatedAt: 1, out: 1_000_000, api: 1.5 }
  expect(Math.round(addSum(addSum(ZERO, old), priced).api * 100)).toBe(2150)
})
