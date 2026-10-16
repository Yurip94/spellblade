import { expect, test } from 'claude-code/testing'
import { addSum, allowedBonus, dayKey, entryKey, isEntry, parseEntryKey, sumEntries, sumXp, ZERO } from '../hooks/lib/ledger.ts'

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
  expect(sumEntries(rows)).toEqual({ w: 2600, bonus: 20, swings: 3 })
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
  expect(addSum({ w: 1, bonus: 2, swings: 3 }, { w: 10, bonus: 20, swings: 30 })).toEqual({ w: 11, bonus: 22, swings: 33 })
})

test('보너스 하루 상한', async () => {
  expect(allowedBonus(290, 20)).toBe(10)
  expect(allowedBonus(300, 50)).toBe(0)
  expect(allowedBonus(0, 50)).toBe(50)
})
