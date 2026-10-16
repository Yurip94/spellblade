import { EQUIPMENT, FAME_PER_XP, LEVEL_BASE, MAX_LEVEL, STAGES, XP_PER_W, type StageDef } from './balance.ts'

export type Usage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

export type Progress = { xp: number; level: number; stage: StageDef; into: number; need: number; ratio: number; isMax: boolean; fame: number }

// 토큰 마을과 같은 가중 토큰. 캐시 읽기는 대화가 길수록 부풀어서 뺀다.
export function weightOf(u: Usage): number {
  return u.output_tokens + 0.1 * (u.input_tokens + u.cache_creation_input_tokens)
}

export function xpOf(w: number, bonus: number): number {
  return Math.floor(w / XP_PER_W) + bonus
}

export function xpForLevel(level: number): number {
  return LEVEL_BASE * (level - 1) ** 2
}

export function levelOf(xp: number): number {
  let level = Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / LEVEL_BASE)) + 1)
  // 제곱근 반올림 오차를 경계에서 바로잡는다
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

// 지금 장비와 강화 수치(단계 안에서 오른 레벨 수), 다음 단계 무기
export function equipmentAt(level: number): { weapon: string; armor: string; trinket: string; plus: number; next: { stage: StageDef; weapon: string } | null } {
  const stage = stageOf(level)
  const i = STAGES.findIndex(s => s.id === stage.id)
  const nextStage = STAGES[i + 1]
  return {
    ...EQUIPMENT[stage.id],
    plus: level - stage.minLevel,
    next: nextStage ? { stage: nextStage, weapon: EQUIPMENT[nextStage.id].weapon } : null,
  }
}
