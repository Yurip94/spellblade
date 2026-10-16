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
