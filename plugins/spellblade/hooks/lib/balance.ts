// 게임 숫자는 모두 여기 둔다. 바꾸면 tests/ 의 기대값도 같이 바꾼다.

export type StageId = 'trainee' | 'swordsman' | 'spellblade' | 'knight' | 'saint'

export type StageDef = { id: StageId; name: string; minLevel: number; emoji: string }

export const STAGES: readonly StageDef[] = [
  { id: 'trainee', name: '수련생', minLevel: 1, emoji: '🪵' },
  { id: 'swordsman', name: '검사', minLevel: 5, emoji: '🗡️' },
  { id: 'spellblade', name: '마검사', minLevel: 15, emoji: '⚔️' },
  { id: 'knight', name: '마검기사', minLevel: 30, emoji: '🛡️' },
  { id: 'saint', name: '마검성', minLevel: 45, emoji: '🌟' },
]

// 단계마다 바뀌는 장비 (2차 설계 3장)
export const EQUIPMENT: Record<StageId, { weapon: string; armor: string; trinket: string }> = {
  trainee: { weapon: '나무 검', armor: '천 옷 · 머리띠', trinket: '—' },
  swordsman: { weapon: '철검', armor: '가죽 갑옷', trinket: '둥근 방패' },
  spellblade: { weapon: '룬 검', armor: '경갑', trinket: '짧은 망토' },
  knight: { weapon: '청뢰검', armor: '문양 판금 · 투구', trinket: '긴 망토 · 마법진 방패' },
  saint: { weapon: '성검', armor: '빛의 갑옷', trinket: '등 뒤 마법진 · 떠 있는 검' },
}

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
} as const
