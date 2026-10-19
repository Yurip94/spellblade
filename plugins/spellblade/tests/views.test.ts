import { expect, test } from 'claude-code/testing'
import { newBattle } from '../hooks/lib/battle.ts'
import { progressOf } from '../hooks/lib/progress.ts'
import { sceneGrid } from '../hooks/lib/scene.ts'
import { ZERO } from '../hooks/lib/ledger.ts'
import { bandLineText, bandModeOf, bandPanel, baseView, comma, levelLabel, motionOf, sceneArt, spinnerSuffix, xpBar, type CardView } from '../hooks/lib/views.ts'

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

test('motion 설정 읽기: 모르는 값은 frames', async () => {
  expect(motionOf('frames')).toBe('frames')
  expect(motionOf('smooth')).toBe('smooth')
  expect(motionOf(undefined)).toBe('frames')
  expect(motionOf('x')).toBe('frames')
})

// 요소 생성자 흉내: 받은 props 를 그대로 돌려준다
const fakeEls = {
  Box: (p: Record<string, unknown>) => ({ type: 'Box', ...p }),
  Text: (p: Record<string, unknown>) => ({ type: 'Text', ...p }),
  Svg: (p: Record<string, unknown>) => ({ type: 'Svg', ...p }),
  Raster: (p: Record<string, unknown>) => ({ type: 'Raster', ...p }),
}

test('sceneArt: 데스크톱은 장면 Svg(밴드 2px · 카드 3px)와 이름표, 터미널 카드는 Raster', async () => {
  const g = sceneGrid({ mode: 'battle', tier: 0, pose: 'idle', frame: 0, battle: newBattle(0, 0), now: 0, dimMagic: false })
  const band = sceneArt(fakeEls, 'desktop', g, '<렌>', 'band') as Record<string, unknown>
  expect([band.type, band.width, band.height]).toEqual(['Svg', 320, 128])
  expect(String(band.source)).toContain('&lt;렌&gt;')
  const pane = sceneArt(fakeEls, 'desktop', g, '렌', 'pane') as Record<string, unknown>
  expect([pane.width, pane.height]).toEqual([480, 192])
  const term = sceneArt(fakeEls, 'terminal', g, '렌', 'pane') as Record<string, unknown>
  expect([term.type, term.columns, term.rows]).toEqual(['Raster', 160, 32])
})

test('밴드 한 줄에 몬스터 체력', async () => {
  const v = { ...view({ xp: 12000, hp: 62 }), monster: { name: '슬라임', emoji: '🟢', hp: 150, maxHp: 300 } }
  expect(bandLineText(v)).toBe('⚔️ 렌 Lv.15 ▓░░░░░░░ 14% · ❤️62 · 🟢 슬라임 ▓▓░ · 오늘 +0')
})

// 밴드 오른쪽 글줄 수
function lineCount(v: CardView): number {
  const panel = bandPanel(fakeEls, { type: 'Raster' }, v) as { children: [unknown, { children: unknown[] }] }
  return panel.children[1].children.length
}

test('밴드 글줄 수는 상태와 상관없이 6줄', async () => {
  const plain = view({ xp: 12000 })
  const gauges = view({ xp: 12000, hp: 41, mp: 62 })
  const banner = { ...view({ xp: 12000, hp: 41, mp: 62 }), banner: '✨ LEVEL UP!  Lv.14 → Lv.15 ✨' }
  const memory = { ...view({ xp: 12000 }), context: 62 }
  expect([plain, gauges, banner, memory].map(lineCount)).toEqual([6, 6, 6, 6])
})

// 밴드 글줄 텍스트(Text 의 글자만)
function bandLines(v: CardView): string[] {
  const panel = bandPanel(fakeEls, { type: 'Raster' }, v) as { children: [unknown, { children: { children: string[] }[] }] }
  return panel.children[1].children.map(t => t.children.join(''))
}

test('밴드 첫 줄에 칭호 · 이름 · 단계 · 레벨 · XP 막대(다음 레벨까지는 없음)', async () => {
  const v = { ...view({ xp: 6000 }), title: '백전노장' }
  const lines = bandLines(v)
  expect(lines[0]).toMatch(/^「백전노장」 렌 · 검사 Lv\.11\/60 · XP [▓░]{10} \d+%$/)
  expect(lines.join('\n')).not.toMatch(/다음 레벨까지/)
})

test('밴드에 오늘 전체 DPS(모든 토큰) · 골드(달러)', async () => {
  const today = { ...ZERO, in: 1_200_000, out: 400_000, cw: 2_000_000, cr: 354_000_000, usd: 1_234.5 }
  const lines = bandLines({ ...view({ xp: 6000 }), today })
  expect(lines).toContain('⚔️ 전체 DPS 358M · 🪙 1,234.50 골드')
})
