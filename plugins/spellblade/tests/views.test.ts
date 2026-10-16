import { expect, test } from 'claude-code/testing'
import { progressOf } from '../hooks/lib/progress.ts'
import { bandLineText, bandModeOf, bandPanel, baseView, comma, heroArt, levelLabel, motionOf, spinnerSuffix, xpBar, type CardView } from '../hooks/lib/views.ts'

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

test('데스크톱 그림은 자세와 상관없이 같은 크기 · 같은 방식', async () => {
  for (const smooth of [false, true]) {
    const shapes = (['idle', 'blink', 'cast1', 'cast2', 'slash', 'victory', 'hit', 'levelup', 'sleep'] as const).map(p => {
      const a = heroArt(fakeEls, 'desktop', 'spellblade', p, 'band', 0, smooth) as Record<string, unknown>
      return JSON.stringify([a.width, a.height, a.isInteractive ?? false])
    })
    expect(new Set(shapes).size).toBe(1)
    const first = JSON.parse(shapes[0])
    expect(first[0]).toBeGreaterThan(0)
    expect(first[0]).toBe(first[1])
  }
})

test('부드러운 움직임에서 짝 자세는 같은 SVG', async () => {
  const a = heroArt(fakeEls, 'desktop', 'knight', 'cast1', 'band', 0, true) as Record<string, string>
  const b = heroArt(fakeEls, 'desktop', 'knight', 'cast2', 'band', 0, true) as Record<string, string>
  expect(a.source).toBe(b.source)
  expect(a.source).toMatch(/<animate/)
})

test('마나가 낮으면 데스크톱 영창 빛도 어두워진다', async () => {
  const bright = heroArt(fakeEls, 'desktop', 'spellblade', 'cast1', 'band', 0, false, false) as Record<string, string>
  const dim = heroArt(fakeEls, 'desktop', 'spellblade', 'cast1', 'band', 0, false, true) as Record<string, string>
  expect(dim.source).not.toBe(bright.source)
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
