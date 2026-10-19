import { BOSS_EVERY, BOSS_HP_MULT, MAP_LEVELS, MAX_LEVEL, MONSTER_BAND, MONSTER_HP_BASE, MONSTER_HP_GROWTH } from './balance.ts'

// 4차 몬스터 목록(4차 설계 7장): 일반 33종(3레벨마다) · 보스 10(10레벨마다) · 맵 5개(20레벨마다).
// id 는 그림 묶음(spellblade-pack.json)의 몬스터 열쇠와 같다. 정예는 앞 몬스터 그림을 색만 바꿔 쓴다.

export type MapId = 'forest' | 'swamp' | 'cave' | 'canyon' | 'castle'
export type MonsterDef = { id: string; name: string; emoji: string; map: MapId; elite?: { of: string; tint: number; k: number } }
export type BossDef = MonsterDef & { level: number; revives: number }
export type Spawn = { index: number; boss: number } // boss 0 = 일반, 아니면 보스 레벨

const m = (id: string, name: string, emoji: string, map: MapId, elite?: MonsterDef['elite']): MonsterDef => (elite ? { id, name, emoji, map, elite } : { id, name, emoji, map })

export const ROSTER: readonly MonsterDef[] = [
  m('dummy', '허수아비', '🎯', 'forest'),
  m('slime', '슬라임', '🟢', 'forest'),
  m('hedgehog', '고슴도치', '🦔', 'forest'),
  m('bat', '박쥐', '🦇', 'forest'),
  m('dragonfly', '잠자리', '🪰', 'forest'),
  m('leshy', '잎 레시', '🌿', 'forest'),
  m('twigBlight', '가지 마름', '🪵', 'forest'),
  m('swampling', '늪지기', '🐸', 'swamp'),
  m('crab', '게', '🦀', 'swamp'),
  m('octopus', '문어', '🐙', 'swamp'),
  m('cobra', '코브라', '🐍', 'swamp'),
  m('giantFly', '거대 파리', '🪰', 'swamp'),
  m('spider', '거미', '🕷️', 'swamp'),
  m('worm', '지렁이 괴물', '🪱', 'cave'),
  m('armadillo', '아르마딜로', '🛡️', 'cave'),
  m('kobold', '코볼트 사제', '🦎', 'cave'),
  m('ratAxe', '쥐인간 도끼병', '🐀', 'cave'),
  m('ratMage', '쥐인간 마법사', '🐭', 'cave'),
  m('mimic', '미믹', '📦', 'cave'),
  m('dwarf', '드워프', '⛏️', 'cave'),
  m('miniGolem', '미니 골렘', '🗿', 'canyon'),
  m('imp', '임프', '😈', 'canyon'),
  m('fireElemental', '불 정령', '🔥', 'canyon'),
  m('iceElemental', '얼음 정령', '❄️', 'canyon'),
  m('flyingEye', '떠다니는 눈', '👁️', 'canyon'),
  m('flyingBrain', '날아다니는 뇌', '🧠', 'canyon'),
  m('devourer', '지성 포식자', '👾', 'canyon'),
  m('ghoul', '구울', '🧟', 'castle'),
  m('akaname', '아카나메', '👅', 'castle'),
  m('gladiator', '검투사', '⚔️', 'castle'),
  m('shadowDwarf', '그림자 드워프', '⛏️', 'castle', { of: 'dwarf', tint: 0x302048, k: 0.45 }),
  m('lavaGolem', '용암 골렘', '🌋', 'castle', { of: 'miniGolem', tint: 0xff5a1e, k: 0.4 }),
  m('cursedGladiator', '저주받은 검투사', '💀', 'castle', { of: 'gladiator', tint: 0x6a1a8a, k: 0.4 }),
]

const b = (level: number, id: string, name: string, emoji: string, map: MapId, revives = 0): BossDef => ({ id, name, emoji, map, level, revives })

export const BOSSES: readonly BossDef[] = [
  b(10, 'goblinKing', '고블린 왕', '👑', 'forest'),
  b(20, 'witch', '마녀', '🧙', 'swamp'),
  b(30, 'moleMonarch', '두더지 군주', '🐹', 'swamp'),
  b(40, 'cyclops', '사이클롭스', '👁️', 'cave'),
  b(50, 'necromancer', '도적 강령술사', '💀', 'cave'),
  b(60, 'minotaur', '미노타우로스', '🐂', 'canyon'),
  b(70, 'cacodaemon', '카코데몬', '👹', 'canyon'),
  b(80, 'phoenixling', '피닉슬링', '🪶', 'castle', 1),
  b(90, 'incubus', '인큐버스', '🦇', 'castle'),
  b(100, 'shardsoul', '샤드소울 학살자', '🐺', 'castle'),
]

const clampLevel = (level: number) => Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)))

// Lv.1~3 → 0, 4~6 → 1, …, 97~100 → 32
export function monsterIndexOf(level: number): number {
  return Math.min(ROSTER.length - 1, Math.floor((clampLevel(level) - 1) / MONSTER_BAND))
}

const MAPS: readonly MapId[] = ['forest', 'swamp', 'cave', 'canyon', 'castle']

// Lv.1~19 숲 · 20~39 늪 · 40~59 동굴 · 60~79 불과 얼음 협곡 · 80~100 마왕성
export function mapOf(level: number): MapId {
  return MAPS[Math.min(MAPS.length - 1, Math.floor(clampLevel(level) / MAP_LEVELS))]
}

// 지금 레벨까지 넘은 보스 문턱 가운데 가장 높은 것 — 이미 그 레벨 이상의 보스를 잡았으면 없다
export function bossDue(level: number, cleared: number): number | null {
  const top = Math.floor(clampLevel(level) / BOSS_EVERY) * BOSS_EVERY
  return top >= BOSS_EVERY && top > cleared ? top : null
}

export function bossAt(level: number): BossDef {
  const i = Math.max(0, Math.min(BOSSES.length - 1, Math.round(level / BOSS_EVERY) - 1))
  return BOSSES[i]
}

export function monsterHp(index: number, boss: boolean): number {
  return Math.round(MONSTER_HP_BASE * MONSTER_HP_GROWTH ** Math.max(0, index) * (boss ? BOSS_HP_MULT : 1))
}

export function spawnFor(level: number, cleared: number): Spawn {
  return { index: monsterIndexOf(level), boss: bossDue(level, cleared) ?? 0 }
}

export function monsterDefOf(s: Spawn): MonsterDef | BossDef {
  return s.boss > 0 ? bossAt(s.boss) : ROSTER[Math.max(0, Math.min(ROSTER.length - 1, s.index))]
}
