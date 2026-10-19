import { expect, test } from 'claude-code/testing'
import { BOSSES, bossAt, bossDue, mapOf, monsterDefOf, monsterHp, monsterIndexOf, ROSTER, spawnFor } from '../hooks/lib/roster.ts'
import { skillDamage } from '../hooks/lib/battle.ts'
import { tierOf } from '../hooks/lib/progress.ts'

test('일반 33종 · 보스 10 · 이름은 설계 표', async () => {
  expect(ROSTER.length).toBe(33)
  expect([ROSTER[0].name, ROSTER[1].name, ROSTER[32].name]).toEqual(['허수아비', '슬라임', '저주받은 검투사'])
  expect(BOSSES.map(b => b.level)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
  expect(BOSSES.find(b => b.level === 80)).toMatchObject({ name: '피닉슬링', revives: 1 })
  expect(BOSSES.filter(b => b.revives > 0).length).toBe(1)
  expect(new Set([...ROSTER, ...BOSSES].map(m => m.id)).size).toBe(43)
  expect([...ROSTER, ...BOSSES].every(m => m.emoji.length > 0)).toBe(true)
})

test('3레벨마다 · 맵은 20레벨마다', async () => {
  expect([1, 3, 4, 99, 100].map(monsterIndexOf)).toEqual([0, 0, 1, 32, 32])
  expect([1, 19, 20, 40, 60, 80, 100].map(mapOf)).toEqual(['forest', 'forest', 'swamp', 'cave', 'canyon', 'castle', 'castle'])
  expect([ROSTER[6].map, ROSTER[7].map, ROSTER[20].map, ROSTER[27].map]).toEqual(['forest', 'swamp', 'canyon', 'castle'])
})

test('보스: 넘은 문턱 중 가장 높은 것 하나, 잡으면 앞 보스는 없다', async () => {
  expect(bossDue(9, 0)).toBe(null)
  expect(bossDue(10, 0)).toBe(10)
  expect(bossDue(25, 0)).toBe(20)
  expect(bossDue(25, 20)).toBe(null)
  expect(bossDue(100, 90)).toBe(100)
  expect(spawnFor(25, 0)).toEqual({ index: 8, boss: 20 })
  expect(spawnFor(25, 20)).toEqual({ index: 8, boss: 0 })
  expect(bossAt(40).name).toBe('사이클롭스')
})

test('체력: 300 × 1.06^단계, 보스 4배', async () => {
  expect([monsterHp(0, false), monsterHp(10, false), monsterHp(10, true)]).toEqual([300, 537, 2149])
})

test('일반 몬스터는 어느 레벨이든 베기 10~20번에 쓰러진다(3.0 싸움 길이)', async () => {
  for (const level of [1, 10, 25, 50, 75, 99, 100]) {
    const hits = Math.ceil(monsterHp(monsterIndexOf(level), false) / skillDamage('slash', tierOf(level)))
    expect([level, hits >= 10 && hits <= 20]).toEqual([level, true])
  }
})

test('정예는 앞 몬스터 그림을 색만 바꿔 쓴다', async () => {
  expect(ROSTER.filter(m => m.elite).map(m => m.elite!.of)).toEqual(['dwarf', 'miniGolem', 'gladiator'])
})

test('Spawn 으로 몬스터 정의를 찾는다', async () => {
  expect(monsterDefOf({ index: 1, boss: 0 }).name).toBe('슬라임')
  expect(monsterDefOf({ index: 1, boss: 10 }).name).toBe('고블린 왕')
})
