import { BONUS, STAGES, type StageId } from './balance.ts'
import { estimateCost } from './price.ts'
import { xpOf } from './progress.ts'

// 저장 칸: 세션마다 자기 칸(d:<날짜>:<세션>)에만 쓰고, 읽을 때 합친다

// 1차 칸: w · bonus · swings · updatedAt. 2차에서 더한 칸은 없을 수 있다(없으면 0)
// casts · hits: 메인 대화 단계마다 강타 수 · 명중 수(3.0.2 — 그때는 「마법」)
// api: 그날 쓴 토큰을 단계마다 그 모델의 API 요금으로 친 값(달러 = 골드, 3.0.4) — 없는 칸(앞 버전)은 토큰을 기본 모델 값으로 친다
const ADDED = ['in', 'out', 'cw', 'cr', 'turns', 'fast', 'clean', 'combo', 'commits', 'prs', 'agents', 'skills', 'night', 'casts', 'hits', 'api'] as const
type Added = (typeof ADDED)[number]

export type Entry = { w: number; bonus: number; swings: number; updatedAt: number } & Partial<Record<Added, number>>
export type Sum = { w: number; bonus: number; swings: number } & Record<Added, number>
export type SumFilter = { day?: string; notDay?: string; excludeSession?: string; onlySession?: string }

// 합칠 때: clean · combo 는 가장 큰 값, skills 는 비트 합, 나머지는 더한다(api 가 없는 칸은 토큰을 기본 모델 값으로 쳐서)
const MAXED = new Set<keyof Sum>(['clean', 'combo'])
const BITS = new Set<keyof Sum>(['skills'])
const FIELDS: (keyof Sum)[] = ['w', 'bonus', 'swings', ...ADDED]

export const ZERO: Sum = Object.fromEntries(FIELDS.map(k => [k, 0])) as Sum

const KEY = /^d:(\d{4}-\d{2}-\d{2}):(.+)$/

// tzOffsetMin 은 Date.getTimezoneOffset() 값(서울 −540)
export function dayKey(ms: number, tzOffsetMin: number): string {
  return new Date(ms - tzOffsetMin * 60_000).toISOString().slice(0, 10)
}

export function entryKey(day: string, sessionId: string): string {
  return `d:${day}:${sessionId}`
}

export function parseEntryKey(key: string): { day: string; sessionId: string } | null {
  const m = KEY.exec(key)
  return m ? { day: m[1], sessionId: m[2] } : null
}

const count = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0

export function isEntry(v: unknown): v is Entry {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  if (!(count(o.w) && count(o.bonus) && count(o.swings) && count(o.updatedAt))) return false
  return ADDED.every(k => o[k] === undefined || count(o[k]))
}

// 값을 매기기 전에 쌓인 칸(3.0.4 전 · 다른 버전의 창)은 모델을 모르니 기본 모델 값으로
export function apiOf(e: Sum | Entry): number {
  return e.api ?? estimateCost({ in: e.in ?? 0, out: e.out ?? 0, cw: e.cw ?? 0, cr: e.cr ?? 0 })
}

export function normalizeEntry(e: Entry): Required<Entry> {
  return { ...ZERO, ...e, ...Object.fromEntries(ADDED.map(k => [k, e[k] ?? 0])), api: apiOf(e) } as Required<Entry>
}

export function addSum(a: Sum | Entry, b: Sum | Entry): Sum {
  const out = { ...ZERO }
  for (const k of FIELDS) {
    const x = k === 'api' ? apiOf(a) : a[k] ?? 0
    const y = k === 'api' ? apiOf(b) : b[k] ?? 0
    out[k] = MAXED.has(k) ? Math.max(x, y) : BITS.has(k) ? x | y : x + y
  }
  return out
}

export function sumEntries(rows: Iterable<readonly [string, unknown]>, filter: SumFilter = {}): Sum {
  let sum = ZERO
  for (const [key, value] of rows) {
    const k = parseEntryKey(key)
    if (!k || !isEntry(value)) continue
    if (filter.day !== undefined && k.day !== filter.day) continue
    if (filter.notDay !== undefined && k.day === filter.notDay) continue
    if (filter.excludeSession !== undefined && k.sessionId === filter.excludeSession) continue
    if (filter.onlySession !== undefined && k.sessionId !== filter.onlySession) continue
    sum = addSum(sum, value)
  }
  return sum
}

// 날짜별 합 (지난 날 의뢰 보상 · 연속 출석 계산용)
export function sumByDay(rows: Iterable<readonly [string, unknown]>): Map<string, Sum> {
  const days = new Map<string, Sum>()
  for (const [key, value] of rows) {
    const k = parseEntryKey(key)
    if (!k || !isEntry(value)) continue
    days.set(k.day, addSum(days.get(k.day) ?? ZERO, value))
  }
  return days
}

export function sumXp(s: Sum): number {
  return xpOf(s.w, s.bonus)
}

export function allowedBonus(todayBonus: number, amount: number): number {
  return Math.min(amount, Math.max(0, BONUS.dailyCap - todayBonus))
}

// ---- 이름 · 모험 일지 ----

// curve: 레벨 곡선 판(4 = 레벨 100 체계, 없으면 옛 곡선) · boss: 잡은 가장 높은 보스 레벨 ·
// level4: 4.0 이 알린 레벨(lastLevel 은 아직 켜 둔 옛 3.x 창이 옛 곡선으로 올릴 수 있어 4.0 은 이것을 본다)
export type Profile = { name: string; createdAt: number; lastLevel: number; title?: string; titles?: string[]; questsFrom?: string; curve?: number; boss?: number; level4?: number }
export type LogEntry = { at: number; level: number; stage: StageId; kind?: 'level' | 'quest' | 'title' | 'boss' | 'note'; text?: string }

export function isProfile(v: unknown): v is Profile {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return typeof o.name === 'string' && o.name.length > 0 && count(o.createdAt) && count(o.lastLevel)
}

export function isLogEntry(v: unknown): v is LogEntry {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return count(o.at) && count(o.level) && STAGES.some(s => s.id === o.stage)
}
