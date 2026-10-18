// 게임 숫자는 모두 여기 둔다. 바꾸면 tests/ 의 기대값도 같이 바꾼다.
import type { SkillId } from './skills.ts'

export type StageId = 'trainee' | 'swordsman' | 'spellblade' | 'knight' | 'saint'

export type StageDef = { id: StageId; name: string; minLevel: number; emoji: string }

export const STAGES: readonly StageDef[] = [
  { id: 'trainee', name: '수련생', minLevel: 1, emoji: '🪵' },
  { id: 'swordsman', name: '검사', minLevel: 5, emoji: '🗡️' },
  { id: 'spellblade', name: '마검사', minLevel: 15, emoji: '⚔️' },
  { id: 'knight', name: '마검기사', minLevel: 30, emoji: '🛡️' },
  { id: 'saint', name: '마검성', minLevel: 45, emoji: '🌟' },
]

// 장비 · 몬스터는 5레벨마다 바뀐다(3차 설계 4 · 5장): Lv.1~4 → 0, 5~9 → 1, …, 55~60 → 11
export const TIER_LEVELS = 5
export const TIERS = 12

// 장비 12단계 (3차 설계 4장 표). 투구는 쓰지 않는다
export const EQUIPMENT12: readonly { weapon: string; armor: string; trinket: string }[] = [
  { weapon: '나무 검', armor: '천 옷', trinket: '머리띠' },
  { weapon: '철검', armor: '가죽 갑옷', trinket: '둥근 나무 방패' },
  { weapon: '강철 검', armor: '징 박은 가죽 갑옷', trinket: '쇠테 방패' },
  { weapon: '룬 검', armor: '경갑', trinket: '짧은 망토' },
  { weapon: '푸른 룬 검', armor: '은빛 경갑', trinket: '짧은 망토 · 룬 방패' },
  { weapon: '마력 검', armor: '마법 경갑', trinket: '긴 망토' },
  { weapon: '청뢰검', armor: '문양 판금', trinket: '긴 망토 · 마법진 방패' },
  { weapon: '청뢰검(번개 두름)', armor: '문양 판금 · 어깨 장식', trinket: '마법진 방패 · 서클릿' },
  { weapon: '폭풍검', armor: '은빛 판금', trinket: '큰 마법진 방패' },
  { weapon: '성검', armor: '빛의 갑옷', trinket: '등 뒤 마법진' },
  { weapon: '성검(빛남)', armor: '빛의 갑옷 · 금테', trinket: '떠 있는 검 하나' },
  { weapon: '천공의 성검', armor: '별빛 갑옷', trinket: '떠 있는 검 셋' },
]

// 경고선(남은 %): 체력 = 주간 한도, 마나 = 5시간 한도
export const LIMIT_WARN = { hp: 30, mp: 20 } as const

// 빠른 턴(ms) · 새벽(현지 0~5시)
export const FAST_TURN_MS = 30_000
export const NIGHT_HOURS = [0, 5] as const

// 오늘의 의뢰 보상 (쉬움 · 보통 · 어려움)
export const QUEST_REWARD = { easy: 30, normal: 50, hard: 80 } as const

// 만렙 · 명성: 만렙 뒤 XP 1,000 = 명성 ★1
export const MAX_LEVEL = 60
export const FAME_PER_XP = 1000

// 능력치(힘 · 지력 · 민첩 · 행운)는 1 ~ STAT_MAX
export const STAT_MAX = 99

// 가중 토큰 W 1,000 = 1 XP
export const XP_PER_W = 1000
// 레벨 L 이 되는 누적 XP = LEVEL_BASE × (L − 1)²
export const LEVEL_BASE = 60

export const BONUS = { commit: 20, pr: 50, dailyCap: 300 } as const

export const DEFAULT_NAME = '렌'
export const LOG_MAX = 50

export const MS = {
  castFrame: 400,
  blinkEvery: 3000,
  blinkFor: 400,
  slash: 400,
  victory: 2000,
  hit: 2000,
  levelUp: 3000,
  stageToast: 5000,
  sleepAfter: 1_800_000,
  sync: 60_000,
  tick: 400,
  poof: 800,           // 쓰러진 몬스터 연기
  popup: 1200,         // 데미지 · XP 숫자가 떠 있는 시간
  monsterHit: 300,     // 맞아서 하얗게
  monsterAttack: 600,  // 반격
  breath: 800,         // 숨쉬기 한 박자
} as const

// 3차 전투: 몬스터 체력(장비 단계마다) · 도구 한 번의 데미지(단계마다 25% 씩 더) · 영창 데미지 = W ÷ 10
export const MONSTER_HP = [300, 400, 540, 720, 960, 1280, 1700, 2250, 3000, 4000, 5300, 7000] as const
export const SKILL_DAMAGE: Record<SkillId, number> = { eye: 18, track: 15, forge: 30, create: 36, storm: 40, ranged: 25, clone: 50, tactics: 12, summon: 28, slash: 20 }
export const CAST_DAMAGE_DIV = 10
export const POPUP_MAX = 3
