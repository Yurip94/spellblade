import { BONUS, STAGES, type StageId } from './balance.ts'
import { xpOf } from './progress.ts'

// 저장 칸: 세션마다 자기 칸(d:<날짜>:<세션>)에만 쓰고, 읽을 때 합친다

// 1차 칸: w · bonus · swings · updatedAt. 2차에서 더한 칸은 없을 수 있다(없으면 0)
// casts · hits: 메인 대화 단계마다 쏜 마법 수 · 적중 수(3.0.2)
const ADDED = ['in', 'out', 'cw', 'cr', 'turns', 'fast', 'clean', 'combo', 'commits', 'prs', 'agents', 'skills', 'night', 'casts', 'hits'] as const
type Added = (typeof ADDED)[number]

export type Entry = { w: number; bonus: number; swings: number; updatedAt: number } & Partial<Record<Added, number>>
export type Sum = { w: number; bonus: number; swings: number } & Record<Added, number>
export type SumFilter = { day?: string; notDay?: string; excludeSession?: string; onlySession?: string }

// 합칠 때: clean · combo 는 가장 큰 값, skills 는 비트 합, 나머지는 더한다
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

export function normalizeEntry(e: Entry): Required<Entry> {
  return { ...ZERO, ...e, ...Object.fromEntries(ADDED.map(k => [k, e[k] ?? 0])) } as Required<Entry>
}

export function addSum(a: Sum | Entry, b: Sum | Entry): Sum {
  const out = { ...ZERO }
  for (const k of FIELDS) {
    const x = a[k] ?? 0
    const y = b[k] ?? 0
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

export type Profile = { name: string; createdAt: number; lastLevel: number; title?: string; titles?: string[]; questsFrom?: string }
export type LogEntry = { at: number; level: number; stage: StageId; kind?: 'level' | 'quest' | 'title'; text?: string }

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
