import { FX } from './art3.ts'
import { MAX_LEVEL, STAGES, STAT_MAX } from './balance.ts'
import { heroFrame, heroSilhouette, tierOf } from './hero3.ts'
import { ZERO, type LogEntry, type Sum } from './ledger.ts'
import type { Gauge } from './limits.ts'
import { equipmentAt, xpForLevel, type Progress } from './progress.ts'
import { TITLES, type TitleId } from './progression.ts'
import type { Quest } from './quests.ts'
import { rgbToRaster, rgbToSvg, toRgb, type RgbGrid } from './rgb.ts'
import { nameTagSvg } from './scene.ts'
import { comma, formulaLine, hitRate, shortNum } from './tokens.ts'

export type { LogEntry }
export { comma }

// 전투 기록 한 묶음: 토큰(시전 · 주문서 · 외워 둠 · 다시 꺼내 씀), 쏜 마법 · 적중, 위력(W), XP
type Battle = { in: number; out: number; cw: number; cr: number; casts: number; hits: number; w: number; xp: number }

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
  context: number | null // 배낭 용량(컨텍스트 창이 찬 %)
  combo: number
  bestCombo: number
  banner: string | null
  turn: Battle | null // 이번 턴 기록
  session: Battle | null // 이 세션 기록
  today: Sum
  equipment: ReturnType<typeof equipmentAt>
  stats: { str: number; int: number; agi: number; luk: number }
  titles: readonly TitleId[]
  monster: { name: string; emoji: string; hp: number; maxHp: number } | null // 지금 싸우는 몬스터
}

// 비어 있는 화면 데이터 (테스트 · 데모가 필요한 칸만 덮어쓴다)
export function baseView(p: Progress): CardView {
  return {
    name: '렌', title: null, progress: p, todayXp: 0, weekXp: 0, todaySwings: 0, line: '쉬는 중', log: [], isDemo: false,
    limits: { hp: null, mp: null }, resets: { hp: '', mp: '' }, quests: [], streak: 0, context: null,
    combo: 0, bestCombo: 0, banner: null, turn: null, session: null, today: ZERO, equipment: equipmentAt(p.level), stats: { str: 1, int: 1, agi: 1, luk: 1 }, titles: [],
    monster: null,
  }
}

export type BandMode = 'panel' | 'line' | 'off'
export type Motion = 'smooth' | 'frames'

// userConfig.motion: frames(기본) · smooth. 3차 장면에서는 쓰지 않는다(설정만 남겨 둔다)
export function motionOf(v: unknown): Motion {
  return v === 'smooth' ? 'smooth' : 'frames'
}

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
  return p.isMax ? `만렙 · 명성 ★${comma(p.fame)}` : `Lv.${p.level}/${MAX_LEVEL}`
}

function gaugeText(icon: string, g: Gauge, reset: string, width: number): string {
  return `${icon} ${xpBar(g.left / 100, width)} ${g.left}%${reset ? ` ${reset}` : ''}`
}

// 골드 = API 요금으로 친 달러(1 골드 = $1): "1,234.50"
export function gold(usd: number): string {
  const [whole, cents] = Math.max(0, usd).toFixed(2).split('.')
  return `${comma(Number(whole))}.${cents}`
}

// 오늘 경험치 = 오늘 모든 창(세션)에서 쓴 토큰 전부(시전 · 주문서 · 외워 둠 · 꺼내 쓴 것)
const todayTokens = (v: CardView) => v.today.in + v.today.out + v.today.cw + v.today.cr

// 밴드 한 줄: "⚔️ 렌 Lv.15 ▓░░░░░░░ 14% · ❤️62 🔷41 · 🟢 슬라임 ▓▓░ · 오늘 +234M · 🪙 88.44"
export function bandLineText(v: CardView): string {
  const p = v.progress
  const gauges = [v.limits.hp ? `❤️${v.limits.hp.left}` : '', v.limits.mp ? `🔷${v.limits.mp.left}` : ''].filter(Boolean).join(' ')
  const m = v.monster
  const monster = m ? `${m.emoji} ${m.name} ${xpBar(m.hp / m.maxHp, 3)}` : ''
  const today = `오늘 +${shortNum(todayTokens(v))} · 🪙 ${gold(v.today.api)}`
  return [`${p.stage.emoji} ${v.name} Lv.${p.level} ${xpBar(p.ratio, 8)} ${percent(p.ratio)}%`, gauges, monster, today].filter(Boolean).join(' · ')
}

// ---- 그림판 · 카드 ----


// $.ui.resolve(e) 에서 쓰는 요소만
type Make = (props: Record<string, unknown>) => unknown
export type Els = { Box: Make; Text: Make; Button?: Make; Svg?: Make; Raster?: Make }

// 데스크톱 장면의 점 하나 크기(px): 밴드 2 · 카드 3 — 상태와 상관없이 고정(320 × 128 · 480 × 192)
const SCENE_PIXEL = { band: 2, pane: 3 } as const

// 같은 장면 격자(sceneGrid 가 캐시한 것)는 SVG · Raster 도 한 번만 만든다 — 모닥불처럼 두 장면을 번갈아도 다시 계산하지 않게
const svgMemo = new WeakMap<RgbGrid, Map<string, string>>()
const rasterMemo = new WeakMap<RgbGrid, ReturnType<typeof rgbToRaster>>()

function sceneSvg(grid: RgbGrid, px: number, name: string): string {
  let byName = svgMemo.get(grid)
  if (!byName) svgMemo.set(grid, (byName = new Map()))
  const key = `${px}|${name}`
  let svg = byName.get(key)
  if (svg === undefined) byName.set(key, (svg = rgbToSvg(grid, px, nameTagSvg(name, px))))
  return svg
}

// 장면 그림. 데스크톱은 Svg(이름표 포함), 터미널은 Raster(▀ 반칸, 큰 카드에서만 부른다).
// 터미널의 resolve 도 Svg 를 내주지만 그려지지 않으므로 표면으로 고른다
export function sceneArt(el: Els, surface: string, grid: RgbGrid, name: string, size: 'band' | 'pane'): unknown {
  if (surface === 'terminal') {
    if (!el.Raster) return null
    let cells = rasterMemo.get(grid)
    if (!cells) rasterMemo.set(grid, (cells = rgbToRaster(grid, 'scene')))
    return el.Raster(cells)
  }
  if (!el.Svg) return null
  const px = SCENE_PIXEL[size]
  const width = (grid[0]?.length ?? 0) * px
  const height = grid.length * px
  return el.Svg({ source: sceneSvg(grid, px, name), alt: `${name} — 마검사 장면`, width, height })
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

// 배낭 용량(컨텍스트 창이 찬 %). 80% 넘으면 정리 안내
function backpackLine(v: CardView): string | null {
  return v.context !== null ? `🎒 배낭 용량 ${v.context}%${v.context >= 80 ? ' — /compact 로 정리' : ''}` : null
}

// 밴드 오른쪽 글은 언제나 6줄 — 줄이 생겼다 사라지며 밴드 높이가 들썩이지 않게 빈 줄로 자리를 지킨다
export const BAND_LINES = 6

// 금화 그림(9 × 9 를 장면처럼 2px 로 → 18 × 18). 데스크톱만 — 터미널은 글자 🪙
let coinSvg: string | null = null
export function coinArt(el: Els, surface: string): unknown {
  if (surface === 'terminal' || !el.Svg) return null
  coinSvg ??= rgbToSvg(toRgb(FX.coin), 2)
  return el.Svg({ source: coinSvg, alt: '금화', width: 18, height: 18 })
}

// "오늘 경험치 +234M · (금화) 88.44 골드" — 금화 그림이 없으면 글자 🪙
function goldRow(el: Els, indent: string, v: CardView, coin: unknown): unknown {
  const tokens = `${indent}오늘 경험치 +${shortNum(todayTokens(v))} · `
  const money = `${gold(v.today.api)} 골드`
  if (!coin) return text(el, `${tokens}🪙 ${money}`)
  return el.Box({ flexDirection: 'row', alignItems: 'center', children: [text(el, tokens), coin, text(el, ` ${money}`)] })
}

export function bandPanel(el: Els, art: unknown, v: CardView, coin: unknown = null): unknown {
  const p = v.progress
  const done = v.quests.filter(q => q.done).length
  const blank = () => text(el, ' ')
  const gauges = gaugesLine(v)
  const backpack = backpackLine(v)
  const quests = [v.quests.length ? `의뢰 ${done}/${v.quests.length}` : '', v.streak ? `🔥 ${v.streak}일` : ''].filter(Boolean).join(' · ')
  // 첫 줄에 칭호 · 이름 · 단계 · 레벨과 XP 막대(다음 레벨까지 남은 XP 는 카드 상태 탭에만)
  const xp = p.isMax ? '' : ` · XP ${xpBar(p.ratio, 10)} ${percent(p.ratio)}%`
  const lines: unknown[] = [
    text(el, `${v.title ? `「${v.title}」 ` : ''}${v.name} · ${p.stage.name} ${levelLabel(p)}${xp}`, { bold: true }),
    gauges ? text(el, gauges) : blank(),
    // 배너는 상태 줄 자리에 — 줄 수를 늘리지 않는다
    v.banner ? text(el, v.banner, { bold: true, color: 'yellow' }) : text(el, `${p.stage.emoji} ${v.line}`),
    // 오늘 경험치는 토큰(레벨 XP 는 카드 상태 탭) · 금화 · 골드, 그 아래 의뢰 · 출석
    goldRow(el, '', v, coin),
    quests ? text(el, quests) : blank(),
    backpack ? text(el, backpack, { dimColor: true }) : blank(),
  ]
  return el.Box({ flexDirection: 'row', columnGap: 2, children: [art, el.Box({ flexDirection: 'column', justifyContent: 'center', children: lines })] })
}

// ---- 카드 창: [1] 상태 · [2] 의뢰 · [3] 기록 ----

export type Tab = 1 | 2 | 3

const QUEST_ICON: Record<string, string> = { swings: '⚔️', commits: '📦', clean: '🛡️', combo: '💥', skills: '📚', xp: '⭐', fast: '💨', agents: '👥' }

function section(el: Els, title: string, rows: unknown[]): unknown {
  return el.Box({ flexDirection: 'column', children: [text(el, title, { bold: true }), ...rows] })
}

function statBar(el: Els, icon: string, label: string, value: number): unknown {
  return text(el, `  ${icon} ${label} ${String(value).padStart(2, ' ')} ${xpBar(value / STAT_MAX, 12)}`)
}

function statusTab(el: Els, v: CardView, road?: unknown[]): unknown[] {
  const p = v.progress
  const eq = v.equipment
  const gauges = gaugesLine(v)
  const nextLine = eq.next
    ? `  다음 장비: ${eq.next.weapon} — Lv.${eq.next.level}, 앞으로 ${comma(Math.max(0, xpForLevel(eq.next.level) - p.xp))} XP`
    : '  다음 장비: 없음 — 마지막 단계예요'
  const at = STAGES.findIndex(s => s.id === p.stage.id)
  const names = STAGES.map((s, i) =>
    text(el, `  ${i < at ? '✓' : i === at ? '▶' : '·'} ${s.emoji} ${s.name} (Lv.${s.minLevel})`, i === at ? { bold: true } : { dimColor: i > at }),
  )
  return [
    el.Box({
      flexDirection: 'column',
      children: [
        text(el, `${p.stage.emoji} ${v.title ? `「${v.title}」 ` : ''}${v.name} · ${p.stage.name} ${levelLabel(p)}`, { bold: true }),
        text(el, xpLine(p, 20)),
        text(el, gauges ?? ' '),
        ...(v.monster ? [text(el, `${v.monster.emoji} ${v.monster.name} HP ${comma(v.monster.hp)}/${comma(v.monster.maxHp)}`)] : []),
        text(el, `오늘 +${comma(v.todayXp)} XP · 이번 주 +${comma(v.weekXp)} XP · 오늘 베기 ${comma(v.todaySwings)}번`),
        text(el, `지금: ${v.line}`, { dimColor: true }),
      ],
    }),
    section(el, '장비', [
      text(el, `  무기 ${eq.weapon}${eq.plus ? ` +${eq.plus}` : ''} · 방어구 ${eq.armor} · 장신구 ${eq.trinket}`),
      text(el, nextLine, { dimColor: true }),
    ]),
    section(el, '능력치', [
      statBar(el, '💪', '힘  ', v.stats.str),
      statBar(el, '🧠', '지력', v.stats.int),
      statBar(el, '💨', '민첩', v.stats.agi),
      statBar(el, '🍀', '행운', v.stats.luk),
    ]),
    section(el, '승급의 길', [...(road && road.length ? [el.Box({ flexDirection: 'row', columnGap: 1, children: road })] : []), ...names]),
  ]
}

function questTab(el: Els, v: CardView): unknown[] {
  const quests = v.quests.map(q => {
    const icon = QUEST_ICON[q.quest.kind] ?? '•'
    const shown = Math.min(q.value, q.quest.target)
    return text(el, `  ${q.done ? '✓' : icon} ${q.quest.title}  ${xpBar(shown / q.quest.target, 8)} ${comma(shown)}/${comma(q.quest.target)}  +${q.quest.reward} XP`, q.done ? { dimColor: true } : {})
  })
  const earned = new Set(v.titles)
  const titles = TITLES.map(t =>
    earned.has(t.id) ? text(el, `  🏅 ${t.name}${v.title === t.name ? ' (지금)' : ''}`) : text(el, `  🔒 ${t.name} — ${t.rule}`, { dimColor: true }),
  )
  return [
    section(el, '오늘의 의뢰', quests.length ? quests : [text(el, '  오늘 의뢰가 없어요', { dimColor: true })]),
    el.Box({
      flexDirection: 'column',
      children: [text(el, `🔥 ${v.streak}일 연속`), text(el, `💥 콤보 ×${v.combo} (오늘 최고 ×${v.bestCombo})`)],
    }),
    section(el, '칭호', titles),
  ]
}

// 쏜 마법: 「🎯 4발 중 4발 적중」
const shots = (s: { casts: number; hits: number }) => (s.casts > 0 ? `🎯 ${s.casts}발 중 ${s.hits}발 적중` : '🎯 아직 쏜 마법이 없어요')

function recordTab(el: Els, v: CardView, coin: unknown): unknown[] {
  const t = v.turn
  const turnRows = t
    ? [
        text(el, `  이번 턴  💥 위력 ${comma(t.w)} → +${comma(t.xp)} XP · ${shots(t)}`),
        text(el, `           ${formulaLine(t)}`, { dimColor: true }),
      ]
    : [text(el, '  이번 턴 기록이 아직 없어요', { dimColor: true }), text(el, ' ')]
  const se = v.session
  const sessionRow = se
    ? text(el, `  이 세션  💥 위력 ${shortNum(se.w)} → +${comma(se.xp)} XP · ${shots(se)}`)
    : text(el, '  이 세션  아직 기록이 없어요', { dimColor: true })
  const d = v.today
  const rate = hitRate(d)
  const backpack = backpackLine(v)
  const journal = v.log.length
    ? v.log.slice(0, 8).map(l => {
        if (l.text) return text(el, `  ${l.kind === 'title' ? '🏅' : '📜'} ${l.text}`)
        const st = STAGES.find(x => x.id === l.stage)
        return text(el, `  ⬆ Lv.${l.level} ${st?.emoji ?? ''} ${st?.name ?? ''}`)
      })
    : [text(el, '  아직 기록이 없어요', { dimColor: true })]
  return [
    section(el, '전투 기록', [
      ...turnRows,
      sessionRow,
      text(el, `  오늘    💥 위력 ${shortNum(d.w)} → +${comma(v.todayXp)} XP · 🎯 마법 적중률 ${rate !== null ? `${rate}% (${d.casts}발 중 ${d.hits}발)` : '—'}`),
      goldRow(el, '           ', v, coin),
      ...(backpack ? [text(el, `  ${backpack}`)] : []),
    ]),
    section(el, '모험 일지', journal),
  ]
}

export function card(el: Els, art: unknown, v: CardView, tab: Tab = 1, onTab: (t: Tab) => void = () => {}, road?: unknown[], coin: unknown = null): unknown {
  const tabs = ([1, 2, 3] as const).map(t =>
    el.Button
      ? el.Button({ key: `tab${t}`, label: ['상태', '의뢰', '기록'][t - 1], hotkey: String(t), variant: t === tab ? 'primary' : 'secondary', onPress: () => onTab(t) })
      : text(el, `[${t}] ${['상태', '의뢰', '기록'][t - 1]}`, t === tab ? { bold: true } : { dimColor: true }),
  )
  const body = tab === 1 ? statusTab(el, v, road) : tab === 2 ? questTab(el, v) : recordTab(el, v, coin)
  return el.Box({
    flexDirection: 'column',
    rowGap: 1,
    children: [
      ...(v.isDemo ? [text(el, '(데모)', { bold: true })] : []),
      el.Box({ flexDirection: 'row', columnGap: 2, children: tabs }),
      ...(tab === 1 && art ? [art] : []),
      ...body,
    ],
  })
}

// 데스크톱 승급의 길: 단계 첫 레벨의 장비 모습을 1px 로, 아직 못 간 단계는 실루엣
export function stageRoad(el: Els, surface: string, level: number): unknown[] {
  if (surface === 'terminal' || !el.Svg) return []
  return STAGES.map(s => {
    const f = heroFrame(tierOf(s.minLevel), 'idle')
    const open = level >= s.minLevel
    const g = toRgb(open ? f : heroSilhouette(f))
    return el.Svg!({ source: rgbToSvg(g, 1), alt: open ? s.name : `${s.name} (잠김)`, width: g[0].length, height: g.length })
  })
}
