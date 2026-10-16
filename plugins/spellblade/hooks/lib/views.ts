import type { StageId } from './balance.ts'
import type { Progress } from './progress.ts'

export type LogEntry = { at: number; level: number; stage: StageId }

// 화면이 그리는 데 필요한 것 전부
export type CardView = {
  name: string
  progress: Progress
  todayXp: number
  weekXp: number
  todaySwings: number
  line: string
  log: readonly LogEntry[]
  isDemo: boolean
}

export type BandMode = 'panel' | 'line' | 'off'

// userConfig.band 값 읽기. 모르는 값은 기본 panel
export function bandModeOf(v: unknown): BandMode {
  return v === 'line' || v === 'off' ? v : 'panel'
}

export function comma(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// 스피너 단어 뒤에 붙는 한 줄: " · ⚔️ Lv.15 마검사 +34xp"
export function spinnerSuffix(p: Progress, turnXp: number): string {
  return ` · ${p.stage.emoji} Lv.${p.level} ${p.stage.name} +${comma(turnXp)}xp`
}

export function xpBar(ratio: number, width: number): string {
  const filled = Math.max(0, Math.min(width, Math.round(ratio * width)))
  return '▓'.repeat(filled) + '░'.repeat(width - filled)
}

const percent = (ratio: number) => Math.round(ratio * 100)

// 밴드 한 줄: "⚔️ 렌 · Lv.15 마검사 ▓░░░░░░░ 7% · 오늘 +1,240 XP"
export function bandLineText(v: CardView): string {
  const p = v.progress
  return `${p.stage.emoji} ${v.name} · Lv.${p.level} ${p.stage.name} ${xpBar(p.ratio, 8)} ${percent(p.ratio)}% · 오늘 +${comma(v.todayXp)} XP`
}
