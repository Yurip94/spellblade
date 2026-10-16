import { frameFor } from './art.ts'
import { STAGES, type StageId } from './balance.ts'
import { ZERO, type LogEntry, type Sum } from './ledger.ts'
import type { Gauge } from './limits.ts'
import { equipmentAt, type Progress } from './progress.ts'
import type { TitleId } from './progression.ts'
import type { Quest } from './quests.ts'
import { cropTop } from './sprites.ts'
import type { Pose } from './status.ts'
import { gridToRaster } from './to-raster.ts'
import { gridToSvg } from './to-svg.ts'
import { comma } from './tokens.ts'

export type { LogEntry }
export { comma }

// 화면이 그리는 데 필요한 것 전부
export type CardView = {
  name: string
  title: string | null // 이름 앞 칭호
  progress: Progress
  todayXp: number
  weekXp: number
  todaySwings: number
  line: string
  log: readonly LogEntry[]
  isDemo: boolean
  limits: { hp: Gauge | null; mp: Gauge | null } // 체력 = 주간, 마나 = 5시간
  resets: { hp: string; mp: string }
  quests: readonly { quest: Quest; value: number; done: boolean }[]
  streak: number
  memory: number | null // 오늘 캐시 적중률
  context: number | null // 배낭(컨텍스트) %
  combo: number
  bestCombo: number
  banner: string | null
  turn: { in: number; out: number; cw: number; cr: number; xp: number } | null
  today: Sum
  equipment: ReturnType<typeof equipmentAt>
  stats: { str: number; int: number; agi: number; luk: number }
  titles: readonly TitleId[]
}

// 비어 있는 화면 데이터 (테스트 · 데모가 필요한 칸만 덮어쓴다)
export function baseView(p: Progress): CardView {
  return {
    name: '렌', title: null, progress: p, todayXp: 0, weekXp: 0, todaySwings: 0, line: '쉬는 중', log: [], isDemo: false,
    limits: { hp: null, mp: null }, resets: { hp: '', mp: '' }, quests: [], streak: 0, memory: null, context: null,
    combo: 0, bestCombo: 0, banner: null, turn: null, today: ZERO, equipment: equipmentAt(p.level), stats: { str: 1, int: 1, agi: 1, luk: 1 }, titles: [],
  }
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

// "Lv.17/60" · 만렙이면 "만렙 · 명성 ★12"
export function levelLabel(p: Progress): string {
  return p.isMax ? `만렙 · 명성 ★${comma(p.fame)}` : `Lv.${p.level}/60`
}

function gaugeText(icon: string, g: Gauge, reset: string, width: number): string {
  return `${icon} ${xpBar(g.left / 100, width)} ${g.left}%${reset ? ` ${reset}` : ''}`
}

// 밴드 한 줄: "⚔️ 렌 Lv.15 ▓░░░░░░░ 14% · ❤️62 🔷41 · 오늘 +1,240"
export function bandLineText(v: CardView): string {
  const p = v.progress
  const gauges = [v.limits.hp ? `❤️${v.limits.hp.left}` : '', v.limits.mp ? `🔷${v.limits.mp.left}` : ''].filter(Boolean).join(' ')
  return [`${p.stage.emoji} ${v.name} Lv.${p.level} ${xpBar(p.ratio, 8)} ${percent(p.ratio)}%`, gauges, `오늘 +${comma(v.todayXp)}`].filter(Boolean).join(' · ')
}

// ---- 그림판 · 카드 ----


// $.ui.resolve(e) 에서 쓰는 요소만
type Make = (props: Record<string, unknown>) => unknown
export type Els = { Box: Make; Text: Make; Svg?: Make; Raster?: Make }

const SVG_PIXEL = { band: 3, pane: 6 } as const

// 터미널은 Raster(▀ 반칸), 그 밖은 Svg. 터미널의 resolve 도 Svg 를 내주지만 그려지지 않으므로 표면으로 고른다
export function heroArt(el: Els, surface: string, stage: StageId, pose: Pose, size: 'band' | 'pane', frame: 0 | 1 = 0): unknown {
  const f = frameFor(stage, pose, frame)
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

function xpLine(p: Progress, width: number): string {
  return p.isMax ? `XP ${xpBar(1, width)} ${levelLabel(p)}` : `XP ${xpBar(p.ratio, width)} ${percent(p.ratio)}%  다음 레벨까지 ${comma(p.need - p.into)} XP`
}

function gaugesLine(v: CardView): string | null {
  const parts = [
    v.limits.hp ? gaugeText('❤️', v.limits.hp, v.resets.hp, 8) : '',
    v.limits.mp ? gaugeText('🔷', v.limits.mp, v.resets.mp, 8) : '',
  ].filter(Boolean)
  return parts.length ? parts.join('   ') : null
}

// 기억(캐시 적중률) · 배낭(컨텍스트). 80% 넘으면 정리 안내
function memoryLine(v: CardView): string | null {
  const parts = [v.memory !== null ? `기억 ${v.memory}%` : '', v.context !== null ? `🎒 ${v.context}%${v.context >= 80 ? ' — /compact 로 정리' : ''}` : ''].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

export function bandPanel(el: Els, art: unknown, v: CardView): unknown {
  const p = v.progress
  const done = v.quests.filter(q => q.done).length
  const lines: unknown[] = []
  if (v.banner) lines.push(text(el, v.banner, { bold: true, color: 'yellow' }))
  lines.push(text(el, `${v.title ? `「${v.title}」 ` : ''}${v.name} · ${p.stage.name} ${levelLabel(p)}`, { bold: true }))
  lines.push(text(el, xpLine(p, 13)))
  const gauges = gaugesLine(v)
  if (gauges) lines.push(text(el, gauges))
  lines.push(text(el, `${p.stage.emoji} ${v.line}`))
  lines.push(text(el, `오늘 +${comma(v.todayXp)} XP${v.quests.length ? ` · 의뢰 ${done}/${v.quests.length}` : ''}${v.streak ? ` · 🔥 ${v.streak}일` : ''}`))
  const memory = memoryLine(v)
  if (memory && !v.banner) lines.push(text(el, memory, { dimColor: true }))
  return el.Box({ flexDirection: 'row', columnGap: 2, children: [art, el.Box({ flexDirection: 'column', justifyContent: 'center', children: lines })] })
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
