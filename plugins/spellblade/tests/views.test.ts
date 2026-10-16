import { expect, test } from 'claude-code/testing'
import { progressOf } from '../hooks/lib/progress.ts'
import { bandLineText, bandModeOf, baseView, comma, levelLabel, motionOf, spinnerSuffix, xpBar, type CardView } from '../hooks/lib/views.ts'

test('천 단위 쉼표', async () => {
  expect(comma(1240)).toBe('1,240')
  expect(comma(999)).toBe('999')
  expect(comma(116160)).toBe('116,160')
  expect(comma(0)).toBe('0')
})

test('스피너 문구', async () => {
  expect(spinnerSuffix(progressOf(12000), 34)).toBe(' · ⚔️ Lv.15 마검사 +34xp')
})

const view = (o: { xp: number; todayXp?: number; name?: string; hp?: number; mp?: number }): CardView => ({
  ...baseView(progressOf(o.xp)),
  name: o.name ?? '렌',
  todayXp: o.todayXp ?? 0,
  limits: { hp: o.hp === undefined ? null : { left: o.hp, resetsAt: null }, mp: o.mp === undefined ? null : { left: o.mp, resetsAt: null } },
})

test('XP 막대', async () => {
  expect(xpBar(0.62, 8)).toBe('▓▓▓▓▓░░░')
  expect(xpBar(0, 8)).toBe('░░░░░░░░')
  expect(xpBar(1, 8)).toBe('▓▓▓▓▓▓▓▓')
})

test('밴드 한 줄 v2', async () => {
  expect(bandLineText(view({ xp: 12000, todayXp: 1240, hp: 62, mp: 41 }))).toBe('⚔️ 렌 Lv.15 ▓░░░░░░░ 14% · ❤️62 🔷41 · 오늘 +1,240')
})

test('한도가 없으면 한 줄에 체력 · 마나가 없다', async () => {
  expect(bandLineText(view({ xp: 12000, todayXp: 1240 }))).toBe('⚔️ 렌 Lv.15 ▓░░░░░░░ 14% · 오늘 +1,240')
  expect(bandLineText(view({ xp: 12000, mp: 41 }))).toBe('⚔️ 렌 Lv.15 ▓░░░░░░░ 14% · 🔷41 · 오늘 +0')
})

test('만렙 표기', async () => {
  expect(levelLabel(progressOf(208_860 + 12_000))).toBe('만렙 · 명성 ★12')
  expect(levelLabel(progressOf(12_000))).toBe('Lv.15/60')
})

test('band 설정 읽기: 모르는 값은 panel', async () => {
  expect(bandModeOf('off')).toBe('off')
  expect(bandModeOf('line')).toBe('line')
  expect(bandModeOf('panel')).toBe('panel')
  expect(bandModeOf(undefined)).toBe('panel')
  expect(bandModeOf('weird')).toBe('panel')
})

test('motion 설정 읽기: 모르는 값은 smooth', async () => {
  expect(motionOf('frames')).toBe('frames')
  expect(motionOf('smooth')).toBe('smooth')
  expect(motionOf(undefined)).toBe('smooth')
  expect(motionOf('x')).toBe('smooth')
})
