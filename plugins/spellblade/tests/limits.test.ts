import { expect, test } from 'claude-code/testing'
import { limitsOf, resetText } from '../hooks/lib/limits.ts'

test('7일 → 체력, 5시간 → 마나', async () => {
  const l = limitsOf([{ kind: 'five_hour', percentUsed: 38 }, { kind: 'seven_day', percentUsed: 59 }])
  expect([l.hp?.left, l.mp?.left]).toEqual([41, 62])
})

test('한도가 없으면 null', async () => {
  expect(limitsOf([])).toEqual({ hp: null, mp: null })
})

test('넘친 값은 0~100', async () => {
  expect(limitsOf([{ kind: 'five_hour', percentUsed: 130 }]).mp?.left).toBe(0)
  expect(limitsOf([{ kind: 'seven_day', percentUsed: -5 }]).hp?.left).toBe(100)
})

test('리셋 시각을 읽는다', async () => {
  expect(limitsOf([{ kind: 'five_hour', percentUsed: 1, resetsAt: '2026-10-16T05:00:00Z' }]).mp?.resetsAt).toBe(Date.UTC(2026, 9, 16, 5))
  expect(limitsOf([{ kind: 'five_hour', percentUsed: 1, resetsAt: 'nope' }]).mp?.resetsAt).toBe(null)
})

test('남은 시간 글자', async () => {
  const now = Date.UTC(2026, 9, 16, 3, 0) // 서울 금요일 12:00
  expect(resetText(now + 42 * 60_000, now, -540)).toBe('42분')
  expect(resetText(now + (2 * 60 + 14) * 60_000, now, -540)).toBe('2:14')
  expect(resetText(Date.UTC(2026, 9, 23, 0, 0), now, -540)).toBe('금 09:00')
  expect(resetText(null, now, -540)).toBe('')
  expect(resetText(now - 1, now, -540)).toBe('곧')
})
