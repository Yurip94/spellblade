import { BONUS, STAGES, type StageId } from './balance.ts'
import { xpOf } from './progress.ts'

// 저장 칸: 세션마다 자기 칸(d:<날짜>:<세션>)에만 쓰고, 읽을 때 합친다

export type Entry = { w: number; bonus: number; swings: number; updatedAt: number }
export type Sum = { w: number; bonus: number; swings: number }
export type SumFilter = { day?: string; notDay?: string; excludeSession?: string; onlySession?: string }

export const ZERO: Sum = { w: 0, bonus: 0, swings: 0 }

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
  return count(o.w) && count(o.bonus) && count(o.swings) && count(o.updatedAt)
}

export function addSum(a: Sum, b: Sum): Sum {
  return { w: a.w + b.w, bonus: a.bonus + b.bonus, swings: a.swings + b.swings }
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

export function sumXp(s: Sum): number {
  return xpOf(s.w, s.bonus)
}

export function allowedBonus(todayBonus: number, amount: number): number {
  return Math.min(amount, Math.max(0, BONUS.dailyCap - todayBonus))
}

// ---- 이름 · 모험 일지 ----

export type Profile = { name: string; createdAt: number; lastLevel: number }
export type LogEntry = { at: number; level: number; stage: StageId }

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
