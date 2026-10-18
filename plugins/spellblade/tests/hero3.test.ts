import { expect, test } from 'claude-code/testing'
import { HERO_CHECK, HERO_FEET, HERO_POSES } from '../hooks/lib/art3.ts'
import { heroFrame, tierOf, type HeroPose } from '../hooks/lib/hero3.ts'
import { toRgb } from '../hooks/lib/rgb.ts'

const ALL: HeroPose[] = ['idle', 'blink', 'slash', 'cast1', 'cast2', 'castHit', 'castFail', 'hit', 'victory', 'levelup', 'sit', 'sleep']
const STANDING = ['idle', 'blink', 'slash', 'cast', 'castFail', 'hit', 'victory'] as const

const cells = (g: readonly string[], ch: string) => g.flatMap((r, y) => [...r].flatMap((c, x) => (c === ch ? [`${x},${y}`] : [])))

// art3.py 의 해시와 같은 방식: 칸마다 6자리 색(투명은 '.'), 줄은 '/' 로 이어 FNV-1a 32비트
function fnv(rows: string[]): string {
  let h = 0x811c9dc5
  const s = rows.join('/')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

test('tierOf: 5레벨마다', async () => {
  expect([1, 4, 5, 9, 10, 54, 55, 60].map(tierOf)).toEqual([0, 0, 1, 1, 2, 10, 11, 11])
})

test('모든 단계 · 자세가 44×48', async () => {
  for (let t = 0; t < 12; t++) {
    for (const p of ALL) {
      const g = heroFrame(t, p).grid
      expect(g.length).toBe(48)
      expect(g.every(r => r.length === 44)).toBe(true)
    }
  }
})

test('서 있는 자세는 머리 · 발이 제자리', async () => {
  const hair = cells(HERO_POSES.idle, 'H')
  const feet = (g: readonly string[]) => cells(g, 'L').filter(c => Number(c.split(',')[1]) >= 43)
  for (const p of STANDING) {
    expect(cells(HERO_POSES[p], 'H')).toEqual(hair)
    expect(feet(HERO_POSES[p])).toEqual(feet(HERO_POSES.idle))
  }
})

test('발끝은 44행', async () => {
  for (const p of STANDING) {
    const last = HERO_POSES[p].reduce((n, r, y) => (/[^.]/.test(r) ? y : n), -1)
    expect(last).toBe(HERO_FEET)
  }
})

test('TS 음영이 시안 7판과 같다', async () => {
  const rgb = toRgb(heroFrame(HERO_CHECK.tier, HERO_CHECK.pose as HeroPose))
  expect(fnv(rgb.map(r => r.map(v => (v === null ? '.' : v.toString(16).padStart(6, '0'))).join('')))).toBe(HERO_CHECK.hash)
})

test('장비 단계마다 모습이 다르다', async () => {
  const look = (t: number) => JSON.stringify(toRgb(heroFrame(t, 'idle')))
  expect(new Set(Array.from({ length: 12 }, (_, t) => look(t))).size).toBe(12)
})
