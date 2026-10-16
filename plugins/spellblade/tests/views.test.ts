import { expect, test } from 'claude-code/testing'
import { progressOf } from '../hooks/lib/progress.ts'
import { bandLineText, bandModeOf, comma, spinnerSuffix, xpBar, type CardView } from '../hooks/lib/views.ts'

test('천 단위 쉼표', async () => {
  expect(comma(1240)).toBe('1,240')
  expect(comma(999)).toBe('999')
  expect(comma(116160)).toBe('116,160')
  expect(comma(0)).toBe('0')
})

test('스피너 문구', async () => {
  expect(spinnerSuffix(progressOf(12000), 34)).toBe(' · ⚔️ Lv.15 마검사 +34xp')
})

const view = (o: { xp: number; todayXp?: number; name?: string }): CardView => ({
  name: o.name ?? '렌',
  progress: progressOf(o.xp),
  todayXp: o.todayXp ?? 0,
  weekXp: 0,
  todaySwings: 0,
  line: '쉬는 중',
  log: [],
  isDemo: false,
})

test('XP 막대', async () => {
  expect(xpBar(0.62, 8)).toBe('▓▓▓▓▓░░░')
  expect(xpBar(0, 8)).toBe('░░░░░░░░')
  expect(xpBar(1, 8)).toBe('▓▓▓▓▓▓▓▓')
})

test('밴드 한 줄', async () => {
  expect(bandLineText(view({ xp: 12000, todayXp: 1240 }))).toBe('⚔️ 렌 · Lv.15 마검사 ▓░░░░░░░ 14% · 오늘 +1,240 XP')
})

test('band 설정 읽기: 모르는 값은 panel', async () => {
  expect(bandModeOf('off')).toBe('off')
  expect(bandModeOf('line')).toBe('line')
  expect(bandModeOf('panel')).toBe('panel')
  expect(bandModeOf(undefined)).toBe('panel')
  expect(bandModeOf('weird')).toBe('panel')
})
