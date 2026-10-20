import { expect, test } from 'claude-code/testing'
import { BACKDROPS } from '../hooks/lib/art3.ts'
import { newBattle as newBattle4, settle as settle4, strike } from '../hooks/lib/battle.ts'

// 3.0 장면 시험: 3.0 그림 단계 t(0 ~ 11)로 보이는 일반 몬스터
const newBattle = (t: number, xp: number) => newBattle4({ index: Math.ceil((t * 33) / 12), boss: 0 }, xp)
const settle = (b: ReturnType<typeof newBattle>, now: number, t: number, xp: number) => settle4(b, now, { index: Math.ceil((t * 33) / 12), boss: 0 }, xp)
import { heroFrame, type HeroPose } from '../hooks/lib/hero3.ts'
import { MONSTERS, monsterFrame } from '../hooks/lib/monsters.ts'
import { rgbToSvg, toRgb, type RgbGrid } from '../hooks/lib/rgb.ts'
import { CAST_TIP, GROUND, HERO_X, HERO_Y, MONSTER_X, SCENE_H, SCENE_W, monsterBox, nameTagSvg, sceneGrid, sceneKey, type SceneInput } from '../hooks/lib/scene.ts'

const ALL: HeroPose[] = ['idle', 'blink', 'slash', 'cast1', 'cast2', 'castHit', 'castFail', 'hit', 'victory', 'levelup', 'sit', 'sleep']
const S = (o: Partial<SceneInput> = {}): SceneInput => ({ mode: 'battle', tier: 0, pose: 'idle', frame: 0, battle: newBattle(0, 0), now: 0, dimMagic: false, ...o })
const firstOpaque = (g: RgbGrid): [number, number] => {
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[y].length; x++) if (g[y][x] !== null) return [x, y]
  return [-1, -1]
}
const DAMAGE_FILL = new Set([0xfff27a, 0xffc23a, 0xff8a1a])
const hasDamageAbove = (g: RgbGrid, t: number) => {
  const box = monsterBox(t)
  for (let y = 0; y < box.head; y++) for (let x = box.x; x < box.x + box.w; x++) if (DAMAGE_FILL.has(g[y][x]!)) return true
  return false
}

test('모든 상태에서 장면은 160×64', async () => {
  const dead = settle(strike(newBattle(3, 0), 9999, 0), 0, 3, 10)
  let hits = newBattle(5, 0)
  for (let i = 0; i < 3; i++) hits = strike(hits, 100 + i, i * 10)
  for (const mode of ['battle', 'rest'] as const)
    for (const pose of ALL)
      for (const battle of [newBattle(0, 0), dead, hits, null])
        for (const frame of [0, 1] as const) {
          const g = sceneGrid(S({ mode, pose, battle, frame, now: 50, tier: 11 }))
          expect(g.length).toBe(SCENE_H)
          expect(g.every(r => r.length === SCENE_W && r.every(v => v !== null))).toBe(true)
        }
  for (let t = 0; t < 12; t++) expect(sceneGrid(S({ tier: t, battle: newBattle(t, 0) })).length).toBe(SCENE_H)
})

test('휴식은 밤 · 모닥불, 전투는 낮 · 몬스터', async () => {
  expect(sceneGrid(S({ mode: 'rest', pose: 'sit' }))[0][0]).toBe(toRgb(BACKDROPS.night)[0][0])
  expect(sceneGrid(S())[0][0]).toBe(toRgb(BACKDROPS.day)[0][0])
  const x = MONSTER_X + 5
  const y = GROUND - 3
  expect(sceneGrid(S({ mode: 'rest', pose: 'sit' }))[y][x]).toBe(sceneGrid(S({ mode: 'rest', pose: 'sit', battle: null }))[y][x])
  expect(sceneGrid(S())[y][x]).not.toBe(sceneGrid(S({ battle: null }))[y][x])
})

test('마검사 · 몬스터 자리는 고정', async () => {
  const head = firstOpaque(toRgb(heroFrame(0, 'idle')))
  for (const pose of ['idle', 'slash', 'castFail', 'hit', 'victory'] as HeroPose[]) {
    const hero = toRgb(heroFrame(0, pose))
    expect(firstOpaque(hero)).toEqual(head)
    expect(sceneGrid(S({ pose }))[HERO_Y + head[1]][HERO_X + head[0]]).toBe(hero[head[1]][head[0]])
  }
  for (let t = 0; t < 12; t++) {
    const box = monsterBox(t)
    expect([box.x, box.y + box.h - 1]).toEqual([MONSTER_X, GROUND])
    const f = toRgb(monsterFrame(t, 'idle0'))
    const row = MONSTERS[t].name === '유령' ? f.length - 5 : f.length - 1
    const col = f[row].findIndex(v => v !== null)
    expect(sceneGrid(S({ tier: t, battle: newBattle(t, 0) }))[box.y + row][box.x + col]).toBe(f[row][col])
  }
})

test('데미지 숫자는 몬스터 위에 뜬다', async () => {
  const b = { ...newBattle(0, 0), popups: [{ text: '12', at: 1000, kind: 'damage' as const }] }
  expect(hasDamageAbove(sceneGrid(S({ battle: b, now: 1000 })), 0)).toBe(true)
  expect(hasDamageAbove(sceneGrid(S({ battle: newBattle(0, 0), now: 1000 })), 0)).toBe(false)
  expect(hasDamageAbove(sceneGrid(S({ mode: 'rest', pose: 'sit', battle: b, now: 1000 })), 0)).toBe(false)
})

test('쓰러지면 연기 두 장면, 끝나면 빈자리', async () => {
  const dead = settle(strike(newBattle(0, 0), 999, 0), 0, 0, 3)
  expect(new Set([100, 500, 900].map(now => sceneKey(S({ battle: dead, now })))).size).toBe(3)
  const x = MONSTER_X + 5
  const y = GROUND - 3
  expect(sceneGrid(S({ battle: dead, now: 900 }))[y][x]).toBe(sceneGrid(S({ battle: null, now: 900 }))[y][x])
})

test('같은 입력은 같은 열쇠 · 캐시', async () => {
  const x = S({ pose: 'slash', now: 123 })
  expect(sceneKey(x)).toBe(sceneKey({ ...x }))
  expect(sceneGrid(x)).toBe(sceneGrid({ ...x }))
  expect(sceneKey(S({ now: 0 }))).not.toBe(sceneKey(S({ now: 800 })))
})

test('이모지 이름표 상자는 한글처럼 넓다', async () => {
  const w = (s: string) => Number(nameTagSvg(s, 2).match(/width="([\d.]+)"/)?.[1])
  expect(w('🔥🔥🔥')).toBe(w('렌렌렌'))
})

test('이름표는 글자를 막는다', async () => {
  expect(nameTagSvg('<렌>', 2)).toContain('&lt;렌&gt;')
  expect(nameTagSvg('렌', 2)).toContain('font-size="5.5"')
})

test('마나가 낮으면 영창 빛이 어둡다', async () => {
  const lit = sceneGrid(S({ pose: 'cast1' }))
  const dim = sceneGrid(S({ pose: 'cast1', dimMagic: true }))
  expect(dim[CAST_TIP.y][CAST_TIP.x]).not.toBe(lit[CAST_TIP.y][CAST_TIP.x])
  expect(dim[0][0]).toBe(lit[0][0])
})

// 엔진의 Svg 한도는 131072자 — 색이 가장 많은 장면(모닥불 빛 · 큰 몬스터 · 빛기둥)과 가장 긴 이름표도 그 안에
test('장면 SVG 는 엔진 한도 안', async () => {
  const name = '가'.repeat(12)
  const worst = [
    S({ mode: 'rest', pose: 'sit', tier: 11, frame: 0 }),
    S({ mode: 'rest', pose: 'sleep', tier: 11, frame: 1 }),
    S({ pose: 'levelup', tier: 11, battle: newBattle(11, 0), frame: 1 }),
    S({ pose: 'castHit', tier: 11, battle: strike(newBattle(11, 0), 999, 0), now: 10 }),
  ]
  for (const x of worst) for (const px of [2, 3]) expect(rgbToSvg(sceneGrid(x), px, nameTagSvg(name, px)).length).toBeLessThan(131_072)
})

test('헛손질에는 연기가 없다(기본 그림)', async () => {
  const smoke = [0x4a4a56, 0xa8a8b4, 0xd8d8e0]
  const g = sceneGrid({ mode: 'battle', tier: 0, pose: 'castFail', frame: 0, battle: newBattle(0, 0), now: 0, dimMagic: false })
  let n = 0
  for (let y = CAST_TIP.y - 7; y < CAST_TIP.y + 2; y++) for (let x = CAST_TIP.x - 5; x < CAST_TIP.x + 3; x++) if (smoke.includes(g[y]?.[x] as number)) n++
  expect(n).toBe(0)
})
