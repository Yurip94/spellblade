import { EQUIPMENT20, FAME_PER_XP, LEVEL_K, LEVEL_POW, MAX_LEVEL, STAGES, TIER_LEVELS, TIERS, XP_PER_W, type StageDef } from './balance.ts'

export type Usage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

export type Progress = { xp: number; level: number; stage: StageDef; into: number; need: number; ratio: number; isMax: boolean; fame: number }

const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)

// 사용량 칸이 비었거나 숫자가 아니면 0 으로 센다(NaN 하나가 그날 칸 전체를 망가뜨리지 않게)
export function cleanUsage(u: Usage): Usage {
  return {
    input_tokens: count(u.input_tokens),
    output_tokens: count(u.output_tokens),
    cache_read_input_tokens: count(u.cache_read_input_tokens),
    cache_creation_input_tokens: count(u.cache_creation_input_tokens),
  }
}

// 토큰 마을과 같은 가중 토큰. 캐시 읽기는 대화가 길수록 부풀어서 뺀다.
export function weightOf(u: Usage): number {
  return u.output_tokens + 0.1 * (u.input_tokens + u.cache_creation_input_tokens)
}

export function xpOf(w: number, bonus: number): number {
  return Math.floor(w / XP_PER_W) + bonus
}

export function xpForLevel(level: number): number {
  return Math.round(LEVEL_K * Math.max(0, level - 1) ** LEVEL_POW)
}

export function levelOf(xp: number): number {
  let level = Math.max(1, Math.floor((Math.max(0, xp) / LEVEL_K) ** (1 / LEVEL_POW)) + 1)
  // 거듭제곱 반올림 오차를 경계에서 바로잡는다
  while (xpForLevel(level + 1) <= xp) level++
  while (level > 1 && xpForLevel(level) > xp) level--
  return Math.min(level, MAX_LEVEL)
}

export function stageOf(level: number): StageDef {
  let found = STAGES[0]
  for (const s of STAGES) if (level >= s.minLevel) found = s
  return found
}

export function progressOf(xp: number): Progress {
  const level = levelOf(xp)
  const stage = stageOf(level)
  if (level >= MAX_LEVEL) {
    // 만렙: 막대는 꽉 차 있고, 넘친 XP 는 명성으로
    return { xp, level, stage, into: 0, need: 0, ratio: 1, isMax: true, fame: Math.floor((xp - xpForLevel(MAX_LEVEL)) / FAME_PER_XP) }
  }
  const into = xp - xpForLevel(level)
  const need = xpForLevel(level + 1) - xpForLevel(level)
  return { xp, level, stage, into, need, ratio: into / need, isMax: false, fame: 0 }
}

// 장비 단계: 5레벨마다 (Lv.1~4 → 0, 95~100 → 19)
export function tierOf(level: number): number {
  return Math.max(0, Math.min(TIERS - 1, Math.floor(level / TIER_LEVELS)))
}

// 3.0 그림(그림 묶음이 없을 때)의 12단계: 레벨 100 을 비율로 나눈다
export function legacyTierOf(level: number): number {
  return Math.max(0, Math.min(11, Math.floor(((level - 1) * 12) / 100)))
}

// 지금 장비와 강화 수치(그 단계 첫 레벨부터 오른 레벨 수), 다음 단계 무기
export function equipmentAt(level: number): { weapon: string; armor: string; plus: number; next: { level: number; weapon: string } | null } {
  const tier = tierOf(level)
  const first = tier === 0 ? 1 : tier * TIER_LEVELS
  return {
    ...EQUIPMENT20[tier],
    plus: level - first,
    next: tier < TIERS - 1 ? { level: (tier + 1) * TIER_LEVELS, weapon: EQUIPMENT20[tier + 1].weapon } : null,
  }
}
