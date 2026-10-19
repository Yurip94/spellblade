import { expect, test } from 'claude-code/testing'
import { BACKDROPS4 } from '../hooks/lib/art4.ts'
import { newBattle } from '../hooks/lib/battle.ts'
import type { HeroPose } from '../hooks/lib/hero3.ts'
import { LOOKS } from '../hooks/lib/looks.ts'
import { parsePack } from '../hooks/lib/pack.ts'
import { rgbToSvg, toRgb } from '../hooks/lib/rgb.ts'
import { GROUND4, nameTag4Svg, SCENE4_H, SCENE4_W, scene4Grid, scene4Key, type Scene4Input } from '../hooks/lib/scene4.ts'
import { fakePack, HERO_CLOTH, SLIME, withBigMonster } from './fake-pack.ts'

const ALL: HeroPose[] = ['idle', 'blink', 'slash', 'cast1', 'cast2', 'castHit', 'castFail', 'hit', 'victory', 'levelup', 'sit', 'sleep']
const P = parsePack(JSON.stringify(fakePack()))!
const BIG = parsePack(JSON.stringify(withBigMonster('goblinKing', 40)))!
const S = (o: Partial<Scene4Input> = {}): Scene4Input => ({ mode: 'battle', level: 4, pose: 'idle', battle: newBattle({ index: 1, boss: 0 }, 0), now: 0, dimMagic: false, ...o })
const rows = (g: (number | null)[][], color: number) => g.flatMap((r, y) => (r.includes(color) ? [y] : []))
const cols = (g: (number | null)[][], color: number) => g.flatMap(r => r.flatMap((v, x) => (v === color ? [x] : [])))

test('어떤 상태든 80 × 32, 빈 칸 없음', async () => {
  for (const mode of ['battle', 'rest'] as const)
    for (const pose of ALL)
      for (const [pack, battle] of [[P, newBattle({ index: 1, boss: 0 }, 0)], [BIG, newBattle({ index: 3, boss: 10 }, 0)], [P, null]] as const) {
        const g = scene4Grid(pack, S({ mode, pose, battle, now: 1234 }))
        expect([g.length, g.every(r => r.length === SCENE4_W && r.every(v => v !== null))]).toEqual([SCENE4_H, true])
      }
})

test('주인공 발은 26행 · 왼쪽 고정, 몬스터 발도 26행', async () => {
  for (const pose of ['idle', 'slash', 'hit'] as HeroPose[]) {
    const g = scene4Grid(P, S({ pose }))
    expect(Math.max(...rows(g, HERO_CLOTH))).toBe(GROUND4)
    expect(Math.min(...cols(g, HERO_CLOTH))).toBe(6)
    expect(Math.max(...rows(g, SLIME))).toBe(GROUND4)
    expect(Math.min(...cols(g, SLIME))).toBeGreaterThan(Math.max(...cols(g, HERO_CLOTH)))
  }
})

test('보스가 장면보다 크면 위가 잘려도 32줄', async () => {
  // 체력 막대(최소 10칸)보다 넓은 보스여야 0행에 보스가 보인다
  const WIDE = parsePack(JSON.stringify(withBigMonster('goblinKing', 40, 0xaa2222, 30)))!
  const g = scene4Grid(WIDE, S({ battle: newBattle({ index: 3, boss: 10 }, 0) }))
  expect(rows(g, 0xaa2222)[0]).toBe(0)
  expect(g.length).toBe(32)
})

test('Lv.19 는 숲, Lv.20 은 늪 배경', async () => {
  const at = (level: number) => scene4Grid(P, S({ level, battle: null }))[0][79]
  expect(at(19)).toBe(toRgb(BACKDROPS4.forest.day)[0][79])
  expect(at(20)).toBe(toRgb(BACKDROPS4.swamp.day)[0][79])
  expect(scene4Grid(P, S({ level: 19, battle: null, mode: 'rest', pose: 'sit' }))[0][0]).not.toBe(toRgb(BACKDROPS4.forest.day)[0][0])
})

test('장비 단계가 오르면 주인공 옷 색이 바뀐다', async () => {
  expect(cols(scene4Grid(P, S({ level: 1 })), HERO_CLOTH).length).toBeGreaterThan(0)
  const g = scene4Grid(P, S({ level: 50 }))
  expect(cols(g, HERO_CLOTH).length).toBe(0)
  expect(cols(g, LOOKS[10].remap[HERO_CLOTH]).length).toBeGreaterThan(0)
})

test('묶음에 없는 몬스터 · 정예 · 보스도 그린다(던지지 않음)', async () => {
  const empty = scene4Grid(P, S({ battle: null }))
  for (const spawn of [{ index: 0, boss: 0 }, { index: 30, boss: 0 }, { index: 20, boss: 0 }, { index: 5, boss: 60 }]) {
    const g = scene4Grid(P, S({ level: 30, battle: newBattle(spawn, 0) }))
    const changed = g.some((r, y) => r.some((v, x) => x > 10 && v !== scene4Grid(P, S({ level: 30, battle: null }))[y][x]))
    expect(changed).toBe(true)
  }
  expect(empty.length).toBe(32)
})

test('데미지 숫자는 몬스터 위에, 휴식이면 없다', async () => {
  const b = { ...newBattle({ index: 1, boss: 0 }, 0), popups: [{ text: '12', at: 1000, kind: 'damage' as const }] }
  const g = scene4Grid(P, S({ battle: b, now: 1000 }))
  const top = Math.min(...rows(g, SLIME))
  expect(rows(g, 0xffe060).some(y => y < top)).toBe(true)
  expect(rows(scene4Grid(P, S({ mode: 'rest', pose: 'sit', battle: b, now: 1000 })), 0xffe060).length).toBe(0)
})

test('같은 입력은 같은 격자, 잠들면 시간이 가도 그대로', async () => {
  expect(scene4Grid(P, S({ now: 50 }))).toBe(scene4Grid(P, S({ now: 50 })))
  expect(scene4Key(S({ mode: 'rest', pose: 'sleep', now: 0 }))).toBe(scene4Key(S({ mode: 'rest', pose: 'sleep', now: 9_000 })))
})

test('장면 SVG 는 엔진 한도 안', async () => {
  const name = nameTag4Svg('가'.repeat(12), 4)
  for (const s of [S({ mode: 'rest', pose: 'sit', level: 70 }), S({ pose: 'levelup', level: 95, battle: newBattle({ index: 3, boss: 10 }, 0) })]) {
    expect(rgbToSvg(scene4Grid(BIG, s), 4, name).length).toBeLessThan(131_072)
  }
  expect(nameTag4Svg('<렌>', 4)).toContain('&lt;렌&gt;')
})
