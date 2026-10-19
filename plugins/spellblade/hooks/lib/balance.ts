// 게임 숫자는 모두 여기 둔다. 바꾸면 tests/ 의 기대값도 같이 바꾼다.
import type { SkillId } from './skills.ts'

export type StageId = 'trainee' | 'swordsman' | 'spellblade' | 'knight' | 'saint' | 'lord' | 'god'

export type StageDef = { id: StageId; name: string; minLevel: number; emoji: string }

// 승급 7단계(4차 설계 3장)
export const STAGES: readonly StageDef[] = [
  { id: 'trainee', name: '수련생', minLevel: 1, emoji: '🪵' },
  { id: 'swordsman', name: '검사', minLevel: 10, emoji: '🗡️' },
  { id: 'spellblade', name: '마검사', minLevel: 25, emoji: '⚔️' },
  { id: 'knight', name: '마검기사', minLevel: 45, emoji: '🛡️' },
  { id: 'saint', name: '마검성', minLevel: 65, emoji: '🌟' },
  { id: 'lord', name: '마검제', minLevel: 85, emoji: '👑' },
  { id: 'god', name: '검신', minLevel: 100, emoji: '✨' },
]

// 장비는 5레벨마다 20단계(4차 설계 6장): Lv.1~4 → 0, 5~9 → 1, …, 95~100 → 19
export const TIER_LEVELS = 5
export const TIERS = 20

// 장비 20단계 — 무기 · 옷(모습은 looks.ts 의 색 바꾸기)
export const EQUIPMENT20: readonly { weapon: string; armor: string }[] = [
  { weapon: '나무 검', armor: '천 옷' },
  { weapon: '철검', armor: '가죽 옷' },
  { weapon: '강철 검', armor: '징 박은 가죽 옷' },
  { weapon: '룬 검', armor: '경갑' },
  { weapon: '푸른 룬 검', armor: '은빛 경갑' },
  { weapon: '마력 검', armor: '마법 경갑' },
  { weapon: '청뢰검', armor: '문양 판금' },
  { weapon: '청뢰검(번개 두름)', armor: '문양 판금 · 어깨 장식' },
  { weapon: '폭풍검', armor: '은빛 판금' },
  { weapon: '화염검', armor: '불꽃 판금' },
  { weapon: '빙결검', armor: '서리 판금' },
  { weapon: '성검', armor: '빛의 갑옷' },
  { weapon: '성검(빛남)', armor: '빛의 갑옷 · 금테' },
  { weapon: '용살검', armor: '용비늘 갑옷' },
  { weapon: '흑요검', armor: '흑요 판금' },
  { weapon: '별빛검', armor: '별빛 갑옷' },
  { weapon: '천공검', armor: '천공의 갑옷' },
  { weapon: '마검 「여명」', armor: '여명의 갑옷' },
  { weapon: '마검 「황혼」', armor: '황혼의 갑옷' },
  { weapon: '천공의 성검', armor: '전설의 갑옷' },
]

// 경고선(남은 %): 체력 = 주간 한도, 마나 = 5시간 한도
export const LIMIT_WARN = { hp: 30, mp: 20 } as const

// 빠른 턴(ms) · 새벽(현지 0~5시)
export const FAST_TURN_MS = 30_000
export const NIGHT_HOURS = [0, 5] as const

// 오늘의 의뢰 보상 (쉬움 · 보통 · 어려움)
export const QUEST_REWARD = { easy: 30, normal: 50, hard: 80 } as const

// 만렙 · 명성: 만렙 뒤 XP 1,000 = 명성 ★1
export const MAX_LEVEL = 100
export const FAME_PER_XP = 1000

// 능력치(힘 · 지력 · 민첩 · 행운)는 1 ~ STAT_MAX
export const STAT_MAX = 99

// 가중 토큰 W 1,000 = 1 XP
export const XP_PER_W = 1000
// 레벨 L 이 되는 누적 XP = round(LEVEL_K × (L − 1)^LEVEL_POW) — 지금 속도(쓴 날 약 3,600 XP)로 Lv.100 까지 약 87일(4차 설계 3장)
export const LEVEL_K = 1000
export const LEVEL_POW = 1.25
// 레벨 체계 판: profile.curve 가 이것과 다르면 켤 때 한 번 이주한다
export const CURVE_VERSION = 4

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
  popupRise: 400,      // 숫자가 2점씩 오르는 박자
  monsterHit: 300,     // 맞아서 하얗게
  monsterAttack: 600,  // 반격
  breath: 800,         // 숨쉬기 한 박자
  revive: 1200,        // 보스가 되살아나는 연출
  castResult: 700,     // 마법 적중 · 캐스팅 실패 연출
  fireFrame: 800,      // 모닥불이 흔들리는 박자(잠들면 멈춘다)
} as const

// 3차 장면: 턴이 끝나고 2분 동안 다음 턴이 없으면 모닥불 휴식 · 캐시 재사용이 이 % 미만이면 캐스팅 실패(연출만)
export const REST_AFTER_MS = 120_000
export const CAST_FAIL_BELOW = 50
// 도구 오류가 Esc 중단인지 턴 끝을 보고 가리는 유예(중단이면 반격이 아니다)
export const ABORT_GRACE_MS = 1000

// 4차 몬스터(4차 설계 7장): 3레벨마다 새 몬스터, 맵은 20레벨마다, 10레벨마다 보스(체력 4배),
// 체력 = round(MONSTER_HP_BASE × MONSTER_HP_GROWTH^단계), 만렙 뒤에는 일반 FINAL_BOSS_EVERY 마리마다 최종 보스
export const MONSTER_BAND = 3
export const MAP_LEVELS = 20
export const BOSS_EVERY = 10
export const BOSS_HP_MULT = 4
export const MONSTER_HP_BASE = 300
export const MONSTER_HP_GROWTH = 1.1
export const FINAL_BOSS_EVERY = 10

// 전투: 도구 한 번의 데미지(장비 단계마다 25% 씩 더) · 영창 데미지 = W ÷ 10. 몬스터 체력은 roster.ts monsterHp
export const SKILL_TIER_BONUS = 0.25 // 장비 단계마다 도구 데미지 +25%
export const SKILL_DAMAGE: Record<SkillId, number> = { eye: 18, track: 15, forge: 30, create: 36, storm: 40, ranged: 25, clone: 50, tactics: 12, summon: 28, slash: 20 }
export const CAST_DAMAGE_DIV = 10
export const POPUP_MAX = 3
