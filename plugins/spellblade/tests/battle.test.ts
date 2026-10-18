import { expect, test } from 'claude-code/testing'
import { MS } from '../hooks/lib/balance.ts'
import { castDamage, monsterPoseAt, newBattle, retaliate, settle, skillDamage, strike } from '../hooks/lib/battle.ts'

test('새 몬스터는 단계 체력으로 시작', async () => {
  const b = newBattle(3, 120)
  expect([b.tier, b.hp, b.maxHp, b.xpAtSpawn, b.popups]).toEqual([3, 720, 720, 120, []])
})

test('strike 는 체력을 줄이고 숫자를 띄운다', async () => {
  const b = strike(newBattle(0, 0), 12, 1000)
  expect([b.hp, b.popups[0]]).toEqual([288, { text: '12', at: 1000, kind: 'damage' }])
  expect(b.hitUntil).toBe(1300)
})

test('체력이 0 이면 펑 → +N XP → 같은 자리에 새 몬스터', async () => {
  let b = settle(strike(newBattle(0, 10), 999, 0), 0, 0, 47)
  expect(b.poofUntil).toBe(800)
  expect(b.popups.some(p => p.text === '+37 XP' && p.kind === 'xp')).toBe(true)
  b = settle(b, 801, 0, 47)
  expect([b.hp, b.maxHp, b.xpAtSpawn, b.poofUntil]).toEqual([300, 300, 47, 0])
  expect(b.popups.some(p => p.text === '+37 XP')).toBe(true)
})

test('쓰러진 몬스터는 더 맞지도 반격하지도 않는다', async () => {
  const dead = settle(strike(newBattle(0, 0), 999, 0), 0, 0, 5)
  expect(strike(dead, 10, 100)).toBe(dead)
  expect(retaliate(dead, 100)).toBe(dead)
})

test('단계가 바뀌면 다음 몬스터부터', async () => {
  let b = settle(strike(newBattle(0, 0), 10, 0), 0, 1, 5)
  expect([b.tier, b.hp]).toEqual([0, 290])
  b = settle(strike(b, 999, 10), 10, 1, 9)
  b = settle(b, 10 + MS.poof, 1, 9)
  expect([b.tier, b.hp, b.maxHp]).toEqual([1, 400, 400])
})

test('숫자는 최대 3개', async () => {
  let b = newBattle(0, 0)
  for (let i = 0; i < 5; i++) b = strike(b, 1, i * 10)
  expect(b.popups.map(p => p.at)).toEqual([20, 30, 40])
  expect(settle(b, 40 + MS.popup, 0, 0).popups.length).toBe(0)
})

test('바뀐 게 없으면 settle 은 같은 객체', async () => {
  const b = strike(newBattle(0, 0), 5, 0)
  expect(settle(b, 100, 0, 0)).toBe(b)
})

test('castDamage: W ÷ 10, 최소 1', async () => {
  expect([castDamage(2140), castDamage(3), castDamage(0)]).toEqual([214, 1, 1])
})

test('skillDamage: 단계마다 25% 씩', async () => {
  expect([skillDamage('slash', 0), skillDamage('slash', 4), skillDamage('clone', 11)]).toEqual([20, 40, 188])
})

test('반격 · 맞음 · 숨쉬기 자세', async () => {
  const b = newBattle(0, 0)
  expect([monsterPoseAt(b, 0), monsterPoseAt(b, MS.breath), monsterPoseAt(b, MS.breath * 2)]).toEqual(['idle0', 'idle1', 'idle0'])
  const hit = strike(b, 1, 5000)
  expect([monsterPoseAt(hit, 5000), monsterPoseAt(hit, 5000 + MS.monsterHit)]).toEqual(['hit', 'idle0'])
  const atk = retaliate(hit, 5100)
  expect([atk.attackUntil, monsterPoseAt(atk, 5100), monsterPoseAt(atk, 5100 + MS.monsterAttack)]).toEqual([5700, 'attack', 'idle1'])
  const dead = settle(strike(b, 999, 0), 0, 0, 0)
  expect(monsterPoseAt(dead, 10)).toBe('poof')
})
