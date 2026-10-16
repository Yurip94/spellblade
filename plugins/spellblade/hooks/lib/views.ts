import { frameFor } from './art.ts'
import { STAGES, type StageId } from './balance.ts'
import type { LogEntry } from './ledger.ts'
import type { Progress } from './progress.ts'

export type { LogEntry }
import { cropTop } from './sprites.ts'
import type { Pose } from './status.ts'
import { gridToRaster } from './to-raster.ts'
import { gridToSvg } from './to-svg.ts'
import { comma } from './tokens.ts'

export { comma }


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

// ---- 그림판 · 카드 ----


// $.ui.resolve(e) 에서 쓰는 요소만
type Make = (props: Record<string, unknown>) => unknown
export type Els = { Box: Make; Text: Make; Svg?: Make; Raster?: Make }

const SVG_PIXEL = { band: 3, pane: 6 } as const

// 터미널은 Raster(▀ 반칸), 그 밖은 Svg. 터미널의 resolve 도 Svg 를 내주지만 그려지지 않으므로 표면으로 고른다
export function heroArt(el: Els, surface: string, stage: StageId, pose: Pose, size: 'band' | 'pane', bodyColumns = 100): unknown {
  const f = frameFor(stage, pose)
  const alt = `${STAGES.find(s => s.id === stage)?.name ?? ''} 마검사`
  if (surface === 'terminal') {
    if (!el.Raster) return null
    // 밴드는 상반신(위 16도트 = 8줄), 카드는 전신(32칸 × 16줄)
    const grid = size === 'band' ? cropTop(f.grid, 16) : f.grid
    return el.Raster(gridToRaster(grid, f.palette, `hero-${size}`))
  }
  if (!el.Svg) return null
  return el.Svg({ source: gridToSvg(f.grid, f.palette, SVG_PIXEL[size]), alt })
}

const text = (el: Els, children: string, extra: Record<string, unknown> = {}) => el.Text({ wrap: 'truncate-end', children: [children], ...extra })

export function bandPanel(el: Els, art: unknown, v: CardView): unknown {
  const p = v.progress
  return el.Box({
    flexDirection: 'row',
    columnGap: 2,
    children: [
      art,
      el.Box({
        flexDirection: 'column',
        justifyContent: 'center',
        children: [
          text(el, `${v.name} · ${p.stage.name} Lv.${p.level}`, { bold: true }),
          text(el, `${xpBar(p.ratio, 13)} ${percent(p.ratio)}%  (다음 레벨까지 ${comma(p.need - p.into)} XP)`),
          text(el, `${p.stage.emoji} ${v.line}   · 오늘 +${comma(v.todayXp)} XP`),
        ],
      }),
    ],
  })
}

function stageRoad(el: Els, v: CardView): unknown[] {
  const now = v.progress.stage.id
  const at = STAGES.findIndex(s => s.id === now)
  return STAGES.map((s, i) => {
    if (i < at) return text(el, `  ✓ ${s.emoji} ${s.name} (Lv.${s.minLevel})`, { dimColor: true })
    if (i === at) return text(el, `  ▶ ${s.emoji} ${s.name} (Lv.${s.minLevel})`, { bold: true })
    return text(el, `  ? ??? (Lv.${s.minLevel})`, { dimColor: true })
  })
}

function journal(el: Els, v: CardView): unknown[] {
  if (v.log.length === 0) return [text(el, '  아직 기록이 없어요', { dimColor: true })]
  return v.log.slice(0, 5).map(l => {
    const s = STAGES.find(x => x.id === l.stage)
    return text(el, `  Lv.${l.level} ${s?.emoji ?? ''} ${s?.name ?? ''}`)
  })
}

export function card(el: Els, art: unknown, v: CardView): unknown {
  const p = v.progress
  return el.Box({
    flexDirection: 'column',
    rowGap: 1,
    children: [
      ...(v.isDemo ? [text(el, '(데모)', { bold: true })] : []),
      ...(art ? [art] : []),
      el.Box({
        flexDirection: 'column',
        children: [
          text(el, `${p.stage.emoji} ${v.name} · ${p.stage.name} Lv.${p.level}`, { bold: true }),
          text(el, `${xpBar(p.ratio, 20)} ${percent(p.ratio)}%  다음 레벨까지 ${comma(p.need - p.into)} XP`),
          text(el, `오늘 +${comma(v.todayXp)} XP · 이번 주 +${comma(v.weekXp)} XP · 오늘 베기 ${comma(v.todaySwings)}번`),
          text(el, `지금: ${v.line}`, { dimColor: true }),
        ],
      }),
      el.Box({ flexDirection: 'column', children: [text(el, '승급의 길', { bold: true }), ...stageRoad(el, v)] }),
      el.Box({ flexDirection: 'column', children: [text(el, '모험 일지', { bold: true }), ...journal(el, v)] }),
    ],
  })
}
