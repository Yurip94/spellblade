import { LEVEL_BASE, STAGES, XP_PER_W, type StageDef } from './balance.ts'

export type Usage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

export type Progress = { xp: number; level: number; stage: StageDef; into: number; need: number; ratio: number }

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
  return level
}

export function stageOf(level: number): StageDef {
  let found = STAGES[0]
  for (const s of STAGES) if (level >= s.minLevel) found = s
  return found
}

export function progressOf(xp: number): Progress {
  const level = levelOf(xp)
  const into = xp - xpForLevel(level)
  const need = xpForLevel(level + 1) - xpForLevel(level)
  return { xp, level, stage: stageOf(level), into, need, ratio: into / need }
}
