// 골드 = 쓴 토큰을 API 요금으로 친 값(달러, 1 골드 = $1) — Vorssaint 의 「API 환산 금액」과 같은 셈.
// 구독이면 실제로 내는 돈이 아니다. 요금은 100만 토큰당 달러(2026-10-06 모델 표 기준)

type Usage = { input_tokens: number; output_tokens: number; cache_creation_input_tokens: number; cache_read_input_tokens: number }
type Rate = readonly [input: number, output: number, cacheRead: number]

// 모델 이름 앞부분(가장 길게 맞는 것)으로 찾는다: claude-opus-5-5[1m] · claude-haiku-4-5-20251001 · us.anthropic.claude-…
const RATES: Record<string, Rate> = {
  'claude-fable-5-1': [10, 50, 0.25],
  'claude-mythos-5-1': [10, 50, 0.25],
  'claude-fable-5': [10, 50, 1],
  'claude-mythos-5': [10, 50, 1],
  'claude-opus-5-5': [4, 20, 0.2],
  'claude-opus-5': [5, 25, 0.5],
  'claude-opus-4-8': [5, 25, 0.5],
  'claude-opus-4-7': [5, 25, 0.5],
  'claude-opus-4-6': [5, 25, 0.5],
  'claude-opus-4-5': [5, 25, 0.5],
  'claude-sonnet-5-5': [2, 10, 0.2],
  'claude-sonnet-5': [2, 10, 0.2],
  'claude-sonnet-4-6': [3, 15, 0.3],
  'claude-sonnet-4-5': [3, 15, 0.3],
  'claude-haiku-5-5': [0.1, 0.5, 0.01],
  'claude-haiku-4-5': [1, 5, 0.1],
}
// 요청 하나의 입력(캐시 포함)이 10만 토큰을 넘으면 비싼 값을 받는 모델
const LONG_PROMPT: Record<string, Rate> = { 'claude-haiku-5-5': [0.5, 2.5, 0.05] }
const LONG_PROMPT_OVER = 100_000
const CACHE_WRITE = 1.25 // 캐시 쓰기는 입력 값의 1.25배(5분 캐시)
// 모르는 모델 · 모델을 모르는 칸(앞 버전이 쌓은 토큰)은 기본 모델 값으로
const DEFAULT_MODEL = 'claude-opus-5-5'

function modelKey(model: string | undefined): string {
  const at = model?.indexOf('claude-') ?? -1
  const id = at >= 0 ? model!.slice(at) : ''
  let best = DEFAULT_MODEL
  let length = 0
  for (const k of Object.keys(RATES)) if (id.startsWith(k) && k.length > length) [best, length] = [k, k.length]
  return best
}

export function apiCost(model: string | undefined, u: Usage): number {
  const key = modelKey(model)
  const prompt = u.input_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens
  const [input, output, cacheRead] = (prompt > LONG_PROMPT_OVER && LONG_PROMPT[key]) || RATES[key]
  return (u.input_tokens * input + u.cache_creation_input_tokens * input * CACHE_WRITE + u.output_tokens * output + u.cache_read_input_tokens * cacheRead) / 1_000_000
}

// 토큰 합만 남은 칸(모델을 모른다)은 기본 모델 값으로 친다
export function estimateCost(s: { in: number; out: number; cw: number; cr: number }): number {
  return apiCost(DEFAULT_MODEL, { input_tokens: s.in, output_tokens: s.out, cache_creation_input_tokens: s.cw, cache_read_input_tokens: s.cr })
}
