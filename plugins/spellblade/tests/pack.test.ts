import { expect, test } from 'claude-code/testing'
import { HERO_ANIMS, PACK_FILE, parsePack } from '../hooks/lib/pack.ts'
import { SWORD_FRAME, fakePack, withHeroAnim, withMonster, withoutHeroAnim } from './fake-pack.ts'

test('맞는 묶음을 읽는다', async () => {
  const p = parsePack(JSON.stringify(fakePack()))
  expect(p?.monsters.slime.anims.idle.length).toBe(2)
  expect(p?.hero.palette.c).toBe(0x2d6ac5)
  expect(HERO_ANIMS.length).toBe(8)
  expect(PACK_FILE).toBe('Documents/spellblade-packs/spellblade-pack.json')
})

test('잘린 JSON · 판이 다르면 null', async () => {
  const t = JSON.stringify(fakePack())
  expect(parsePack(t.slice(0, Math.floor(t.length / 2)))).toBe(null)
  expect(parsePack(JSON.stringify({ ...fakePack(), version: 2 }))).toBe(null)
  expect(parsePack('null')).toBe(null)
})

test('주인공 동작이 빠지면 null', async () => {
  expect(parsePack(JSON.stringify(withoutHeroAnim('cast')))).toBe(null)
})

test('이상한 몬스터는 그 몬스터만 뺀다', async () => {
  expect(Object.keys(parsePack(JSON.stringify(withMonster('bad', { ragged: true })))!.monsters)).toEqual(['slime'])
  expect(Object.keys(parsePack(JSON.stringify(withMonster('huge', { size: 129 })))!.monsters)).toEqual(['slime'])
  expect(Object.keys(parsePack(JSON.stringify(withMonster('ok', { size: 128 })))!.monsters).sort()).toEqual(['ok', 'slime'])
})

test('색표에 없는 글자 · 이상한 색이면 뺀다', async () => {
  const p = fakePack()
  p.monsters.x = { palette: { g: 1 }, anims: { idle: [['gz']] } }
  p.monsters.y = { palette: { g: -1 }, anims: { idle: [['g']] } }
  p.monsters.z = { palette: { g: 1 }, anims: { idle: [['g']], hit: [['g', 'gg']] } }
  expect(Object.keys(parsePack(JSON.stringify(p))!.monsters)).toEqual(['slime'])
})

test('주인공 「ready」(검을 든 서기)는 있으면 읽고, 없어도 된다', async () => {
  expect(parsePack(JSON.stringify(withHeroAnim('ready', [SWORD_FRAME])))!.hero.anims.ready.length).toBe(1)
  expect(parsePack(JSON.stringify(fakePack()))!.hero.anims.ready).toBe(undefined)
})
