import type { EngineInterface, Register } from 'claude-code'
import { DEFAULT_NAME, MS } from './lib/balance.ts'
import { addSum, dayKey, entryKey, isEntry, parseEntryKey, sumEntries, sumXp, ZERO, type Entry, type Sum } from './lib/ledger.ts'
import { progressOf, weightOf } from './lib/progress.ts'
import { HEIGHT, WIDTH, type Grid } from './lib/sprites.ts'
import { gridToRaster } from './lib/to-raster.ts'
import { gridToSvg } from './lib/to-svg.ts'
import { bandLineText, bandModeOf, spinnerSuffix, type CardView, type LogEntry } from './lib/views.ts'

// ---- 모듈 상태 (session.start 의 load 가 매번 새로 채운다) ----

let sid = ''
const tz = new Date().getTimezoneOffset()
let today = ''
let past: Sum = ZERO // 오늘이 아닌 모든 날 · 모든 세션
let pastWeek: Sum = ZERO // 최근 6일(오늘 빼고)
let othersToday: Sum = ZERO // 오늘 · 다른 세션
const mine = new Map<string, Entry>() // 이 세션 몫, 날짜별
const dirty = new Set<string>()
let name = DEFAULT_NAME
let log: LogEntry[] = []

let turnW = 0
let working = false
let syncing = false
let sinceSync = 0

const PROBE = 'spellblade-probe'
const PROBE_PALETTE = { r: 0xd23c3c, b: 0x3c64d2, y: 0xf0c83c }
// 왼쪽 반 빨강 · 오른쪽 반 파랑 · 가운데 한 줄 노랑
const PROBE_GRID: Grid = Array.from({ length: HEIGHT }, (_, y) =>
  y === HEIGHT / 2 ? 'y'.repeat(WIDTH) : 'r'.repeat(WIDTH / 2) + 'b'.repeat(WIDTH / 2),
)

const COMMAND = {
  description: '마검사 카드 열기 (name <이름> · demo · reset)',
  argumentHint: '[name <이름> | demo | reset]',
  immediate: true,
} as const

// ---- 저장 · 불러오기 ----

function mineOn(day: string): Entry {
  let e = mine.get(day)
  if (!e) {
    e = { w: 0, bonus: 0, swings: 0, updatedAt: 0 }
    mine.set(day, e)
  }
  return e
}

function todaySum(): Sum {
  const m = mine.get(today)
  return m ? addSum(othersToday, m) : othersToday
}

function totalSum(): Sum {
  return addSum(past, todaySum())
}

function snapshot(): CardView {
  const t = todaySum()
  return {
    name,
    progress: progressOf(sumXp(totalSum())),
    todayXp: sumXp(t),
    weekXp: sumXp(addSum(pastWeek, t)),
    todaySwings: t.swings,
    line: working ? '마법을 두르는 중…' : '쉬는 중',
    log,
    isDemo: false,
  }
}

async function readAll($: EngineInterface): Promise<[string, unknown][]> {
  const keys = await $.store.keys()
  const rows: [string, unknown][] = []
  for (const key of keys) if (key.startsWith('d:')) rows.push([key, await $.store.get(key)])
  return rows
}

async function load($: EngineInterface): Promise<void> {
  sid = await $.session.id()
  const now = await $.clock.now()
  today = dayKey(now, tz)
  const rows = await readAll($)
  const week = new Set(Array.from({ length: 6 }, (_, i) => dayKey(now - (i + 1) * 86_400_000, tz)))
  past = sumEntries(rows, { notDay: today })
  pastWeek = sumEntries(rows.filter(([k]) => week.has(parseEntryKey(k)?.day ?? '')))
  othersToday = sumEntries(rows, { day: today, excludeSession: sid })
  mine.clear()
  dirty.clear()
  const own = rows.find(([k]) => k === entryKey(today, sid))?.[1]
  if (isEntry(own)) mine.set(today, { ...own })
  sinceSync = 0
  $.ui.invalidate('ui.render')
}

async function flush($: EngineInterface): Promise<void> {
  if (dirty.size === 0) return
  const now = await $.clock.now()
  for (const day of [...dirty]) {
    const e = mine.get(day)
    if (e) await $.store.set(entryKey(day, sid), { ...e, updatedAt: now })
    dirty.delete(day)
  }
}

async function refreshToday($: EngineInterface): Promise<void> {
  const keys = await $.store.keys()
  const rows: [string, unknown][] = []
  for (const key of keys) {
    if (key.startsWith(`d:${today}:`) && key !== entryKey(today, sid)) rows.push([key, await $.store.get(key)])
  }
  othersToday = sumEntries(rows)
  $.ui.invalidate('ui.render')
}

// 400ms 마다: 60초마다 저장 · 남의 몫 다시 읽기, 날짜가 바뀌면 전부 다시
async function tick($: EngineInterface): Promise<void> {
  if (syncing) return
  sinceSync += MS.tick
  const now = await $.clock.now()
  const dayChanged = dayKey(now, tz) !== today
  if (!dayChanged && sinceSync < MS.sync) return
  syncing = true
  try {
    await flush($)
    if (dayChanged) await load($)
    else await refreshToday($)
    sinceSync = 0
  } finally {
    syncing = false
  }
}

async function addUsage($: EngineInterface, w: number): Promise<void> {
  const day = dayKey(await $.clock.now(), tz)
  mineOn(day).w += w
  dirty.add(day)
}

// ---- 명령 ----

async function registerCommand($: EngineInterface): Promise<void> {
  try {
    await $.command.register({ name: 'blade', ...COMMAND })
  } catch {
    // 내장 명령과 겹치면 다른 이름으로
    await $.command.register({ name: 'spellblade', ...COMMAND })
  }
}

async function probeText($: EngineInterface): Promise<string> {
  const id = await $.session.id()
  const surface = await $.session.surface()
  const surfaces = await $.session.surfaces()
  const native = 'toBase64' in Uint8Array.prototype
  return `session=${id} surface=${surface} surfaces=${surfaces.join(',')} tz=${tz} toBase64=${native}`
}

function startTimer($: EngineInterface): void {
  $.clock.every(MS.tick, () => {
    void tick($)
  })
}

export const register: Register = (on, options) => {
  const band = bandModeOf(options.band)

  on('session.start', async ($, e, next) => {
    const out = await next(e)
    turnW = 0
    working = false
    await load($)
    startTimer($)
    await registerCommand($)
    return out
  })

  // /clear · /resume · /branch 뒤에는 session.start 가 오지 않는다
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await load($)
    return next(e)
  }).catch(async ($, e, next) => next(e))

  on('session.end', async ($, e, next) => {
    await flush($)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    turnW = 0
    working = true
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    if (result.usage) {
      const w = weightOf(result.usage)
      turnW += w
      await addUsage($, w)
      $.ui.invalidate('ui.render')
    }
    return result
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) working = false
    await flush($)
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const suffix = e.props.suffix + spinnerSuffix(snapshot().progress, Math.floor(turnW / 1000))
    return next({ ...e, props: { ...e.props, suffix } })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || band === 'off') return next(e)
    const below = await next(e)
    const { Box, Text } = $.ui.resolve(e)
    const mine = Text({ wrap: 'truncate-end', children: [bandLineText(snapshot())] })
    return Box({ flexDirection: 'column', children: [mine, below] })
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PROBE) return next(e)
    const el: any = $.ui.resolve(e)
    // 터미널의 resolve 도 Svg 를 내주지만 그려지지 않는다 — 표면으로 고른다
    if (e.surface === 'terminal' && 'Raster' in el) return el.Raster(gridToRaster(PROBE_GRID, PROBE_PALETTE, 'probe'))
    if (e.surface !== 'terminal' && 'Svg' in el) return el.Svg({ source: gridToSvg(PROBE_GRID, PROBE_PALETTE, 8), alt: '마검사 시험 무늬' })
    return el.Text({ children: ['그림 요소가 없는 화면이에요'] })
  })

  on('command.run', { command: ['blade', 'spellblade'] }, async ($, e) => {
    const [word] = e.args.trim().split(/\s+/)
    if (word === 'probe') {
      await $.ui.open({ id: PROBE, title: '마검사 시험', focus: true, closeOnEscape: true })
      return { text: await probeText($) }
    }
    return { text: '쓸 수 있는 명령: /blade · /blade name <이름> · /blade demo · /blade reset' }
  }).catch(() => ({ text: '마검사 명령을 처리하지 못했어요' }))
}
