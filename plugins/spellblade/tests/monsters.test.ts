import { expect, test } from 'claude-code/testing'
import { BACKDROPS, FX, GLYPHS, MONSTER_ART, MONSTER_CHECK } from '../hooks/lib/art3.ts'
import { MONSTERS, monsterFrame, monsterSize } from '../hooks/lib/monsters.ts'
import { toRgb } from '../hooks/lib/rgb.ts'

const lastRow = (g: readonly string[]) => g.reduce((n, r, y) => (/[^.]/.test(r) ? y : n), -1)

// art3.py 의 해시와 같은 방식(hero3.test.ts 와 같음)
function fnv(rows: string[]): string {
  let h = 0x811c9dc5
  const s = rows.join('/')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

test('몬스터 12종 순서', async () => {
  expect(MONSTERS.map(m => m.name)).toEqual(['슬라임', '달팽이', '버섯', '돼지', '나무 그루터기', '늑대', '해골 병사', '골렘', '유령', '와이번', '새끼 용', '드래곤'])
  expect(MONSTER_ART.length).toBe(12)
})

test('몬스터는 장면 안에 들어간다', async () => {
  for (let t = 0; t < 12; t++) {
    const { w, h } = monsterSize(t)
    expect(h <= 50 && w <= 100).toBe(true)
  }
})

test('네 프레임은 같은 크기', async () => {
  for (let t = 0; t < 12; t++) {
    const { w, h } = monsterSize(t)
    for (const p of ['idle0', 'idle1', 'attack', 'hit'] as const) {
      const g = monsterFrame(t, p).grid
      expect(g.length).toBe(h)
      expect(g.every(r => r.length === w)).toBe(true)
    }
  }
})

test('발이 땅에 닿는다(유령만 떠 있다)', async () => {
  for (let t = 0; t < 12; t++) {
    const { h } = monsterSize(t)
    expect(lastRow(MONSTER_ART[t].frames.idle0)).toBe(MONSTERS[t].name === '유령' ? h - 5 : h - 1)
  }
})

test('맞으면 하얗게 번쩍인다', async () => {
  const idle = monsterFrame(0, 'idle0')
  const hit = monsterFrame(0, 'hit')
  expect(hit.grid).toEqual(idle.grid)
  const k = idle.grid[idle.grid.length - 3].replace(/\./g, '')[2]
  expect(hit.palette[k]).toBeGreaterThan(idle.palette[k])
})

test('TS 음영이 미리보기와 같다', async () => {
  for (let t = 0; t < 12; t++) {
    const rgb = toRgb(monsterFrame(t, 'idle0'))
    expect(fnv(rgb.map(r => r.map(v => (v === null ? '.' : v.toString(16).padStart(6, '0'))).join('')))).toBe(MONSTER_CHECK[t])
  }
})

test('글꼴과 배경', async () => {
  for (const d of '0123456789') expect(GLYPHS.damage[d].length).toBe(9)
  for (const c of '0123456789+XP') expect(GLYPHS.small[c].length).toBe(7)
  for (const c of 'LEVUP') expect(GLYPHS.big[c].length).toBe(9)
  for (const b of [BACKDROPS.day, BACKDROPS.night]) {
    expect(b.grid.length).toBe(64)
    expect(b.grid.every(r => r.length === 160 && !r.includes('.'))).toBe(true)
  }
  for (const id of ['slashArc', 'castGlow1', 'castGlow2', 'bolt', 'smoke', 'sweat', 'poof1', 'poof2', 'pillar1', 'pillar2', 'zzz', 'fire1', 'fire2'] as const) {
    expect(FX[id].grid.length > 0).toBe(true)
  }
})
