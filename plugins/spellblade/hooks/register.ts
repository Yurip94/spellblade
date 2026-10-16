import type { EngineInterface, Register } from 'claude-code'
import { DEFAULT_NAME, LOG_MAX, MS, STAGES } from './lib/balance.ts'
import { bonusesFor, subjectJosa } from './lib/bonus.ts'
import { skillOf } from './lib/skills.ts'
import { addSum, allowedBonus, dayKey, entryKey, isEntry, isLogEntry, isProfile, parseEntryKey, sumEntries, sumXp, ZERO, type Entry, type Sum } from './lib/ledger.ts'
import { levelOf, progressOf, stageOf, weightOf, xpForLevel } from './lib/progress.ts'
import { HEIGHT, WIDTH, type Grid } from './lib/sprites.ts'
import { gridToRaster } from './lib/to-raster.ts'
import { gridToSvg } from './lib/to-svg.ts'
import { demoFrame, poseAt, withFlash, type Activity } from './lib/status.ts'
import { bandLineText, bandModeOf, bandPanel, card, heroArt, spinnerSuffix, type CardView, type Els, type LogEntry } from './lib/views.ts'

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
let activity: Activity = { working: false, lastActiveAt: 0, flash: null }
let clockNow = 0 // 마지막으로 읽은 시각 (그리기용)
let lastDrawnKey = ''
let demoStartedAt: number | null = null
let syncing = false
let lastSyncAt = 0
let lastSyncFailed = false
// load · flush · refreshToday 를 한 줄로 세워 서로 끼어들지 않게 한다
let chain: Promise<void> = Promise.resolve()

function serial(job: () => Promise<void>): Promise<void> {
  const run = chain.then(job)
  chain = run.catch(() => {})
  return run
}

const PANE = 'spellblade'

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

function demoNow(): ReturnType<typeof demoFrame> {
  if (demoStartedAt === null) return null
  const f = demoFrame(clockNow - demoStartedAt)
  if (!f) demoStartedAt = null
  return f
}

function snapshot(): CardView {
  const t = todaySum()
  const demo = demoNow()
  if (demo) {
    const stage = STAGES.find(s => s.id === demo.stage) ?? STAGES[0]
    return { name, progress: progressOf(xpForLevel(stage.minLevel)), todayXp: 0, weekXp: 0, todaySwings: 0, line: demo.line, log, isDemo: true }
  }
  return {
    name,
    progress: progressOf(sumXp(totalSum())),
    todayXp: sumXp(t),
    weekXp: sumXp(addSum(pastWeek, t)),
    todaySwings: t.swings,
    line: poseAt(activity, clockNow).line,
    log,
    isDemo: false,
  }
}

// 지금 그릴 단계 · 자세. 바뀔 때만 다시 그리려고 열쇠도 같이
function drawState(): { stage: CardView['progress']['stage']; pose: ReturnType<typeof poseAt>['pose']; key: string } {
  const v = snapshot()
  const demo = demoNow()
  const { pose, line } = demo ?? poseAt(activity, clockNow)
  return { stage: v.progress.stage, pose, key: `${demo ? 'demo' : ''}|${v.progress.stage.id}|${pose}|${line}|${v.progress.xp}` }
}

async function readAll($: EngineInterface): Promise<[string, unknown][]> {
  const keys = await $.store.keys()
  const rows: [string, unknown][] = []
  for (const key of keys) if (key.startsWith('d:')) rows.push([key, await $.store.get(key)])
  return rows
}

function load($: EngineInterface): Promise<void> {
  return serial(() => loadNow($))
}

async function loadNow($: EngineInterface): Promise<void> {
  // 읽기를 다 끝낸 뒤 상태를 한 번에 바꾼다(읽는 사이 들어온 경험치를 지우지 않게)
  const newSid = await $.session.id()
  const now = await $.clock.now()
  const newToday = dayKey(now, tz)
  const rows = await readAll($)
  const profile = await $.store.get('profile')
  const saved = await $.store.get('log')

  if (newSid !== sid) {
    // 새 세션(/clear 등): 앞 세션 몫은 session.end 에서 이미 저장됐다
    mine.clear()
    dirty.clear()
  }
  sid = newSid
  today = newToday
  const week = new Set(Array.from({ length: 6 }, (_, i) => dayKey(now - (i + 1) * 86_400_000, tz)))
  past = sumEntries(rows, { notDay: today })
  pastWeek = sumEntries(rows.filter(([k]) => week.has(parseEntryKey(k)?.day ?? '')))
  othersToday = sumEntries(rows, { day: today, excludeSession: sid })
  // 지난 날 몫은 저장이 끝났으면 메모리에서 뺀다. 오늘 몫은 메모리 쪽이 더 새것이다
  for (const day of [...mine.keys()]) if (day !== today && !dirty.has(day)) mine.delete(day)
  const own = rows.find(([k]) => k === entryKey(today, sid))?.[1]
  if (isEntry(own) && !mine.has(today)) mine.set(today, { ...own })
  name = isProfile(profile) ? profile.name : DEFAULT_NAME
  log = Array.isArray(saved) ? saved.filter(isLogEntry).slice(0, LOG_MAX) : []
  lastSyncAt = now
  clockNow = now
  activity = { ...activity, lastActiveAt: now }
  $.ui.invalidate('ui.render')

  if (!isProfile(profile)) {
    // 처음: 지금 레벨을 기준으로 둔다(지난 레벨을 한꺼번에 알리지 않으려고)
    await $.store.set('profile', { name, createdAt: now, lastLevel: levelOf(sumXp(totalSum())) })
  }
}

function flush($: EngineInterface): Promise<void> {
  return serial(() => flushNow($))
}

// 턴 끝 · 세션 끝에서: 실패해도 다음 주기에 다시 저장한다
async function flushQuietly($: EngineInterface): Promise<void> {
  try {
    await flush($)
  } catch {
    // 표시는 남아 있다(dirty)
  }
}

async function flushNow($: EngineInterface): Promise<void> {
  if (dirty.size === 0) return
  const now = await $.clock.now()
  for (const day of [...dirty]) {
    dirty.delete(day) // 쓰는 사이 늘어난 몫은 다시 표시된다
    const e = mine.get(day)
    if (!e) continue
    try {
      await $.store.set(entryKey(day, sid), { ...e, updatedAt: now })
    } catch (err) {
      dirty.add(day)
      throw err
    }
  }
}

function refreshToday($: EngineInterface): Promise<void> {
  return serial(() => refreshNow($))
}

async function refreshNow($: EngineInterface): Promise<void> {
  const day = today
  const me = sid
  const keys = await $.store.keys()
  const rows: [string, unknown][] = []
  for (const key of keys) {
    if (key.startsWith(`d:${day}:`) && key !== entryKey(day, me)) rows.push([key, await $.store.get(key)])
  }
  if (day !== today || me !== sid) return // 읽는 사이 날짜 · 세션이 바뀌었다
  othersToday = sumEntries(rows)
  $.ui.invalidate('ui.render')
}

// 400ms 마다: 60초마다 저장 · 남의 몫 다시 읽기, 날짜가 바뀌면 전부 다시
async function tick($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  clockNow = now
  const key = drawState().key
  if (key !== lastDrawnKey) {
    lastDrawnKey = key
    $.ui.invalidate('ui.render')
  }
  if (syncing) return
  const dayChanged = dayKey(now, tz) !== today
  const due = now - lastSyncAt >= MS.sync
  // 날이 바뀌면 바로, 아니면 60초마다. 실패했으면 날이 바뀌었어도 60초 쉬었다가
  if (!due && !(dayChanged && !lastSyncFailed)) return
  syncing = true
  lastSyncAt = now
  try {
    await flush($)
    if (dayChanged) await load($)
    else await refreshToday($)
    lastSyncFailed = false
  } catch {
    lastSyncFailed = true
  } finally {
    syncing = false
  }
}

async function addUsage($: EngineInterface, w: number): Promise<void> {
  const now = await $.clock.now()
  const day = dayKey(now, tz)
  mineOn(day).w += w
  dirty.add(day)
  clockNow = now
  activity = { ...activity, lastActiveAt: now }
}

// 경험치가 늘어난 뒤: 레벨이 올랐으면 알리고 일지에 남긴다. 다른 세션이 이미 알렸으면 조용히
async function afterGain($: EngineInterface, beforeXp: number): Promise<void> {
  const after = levelOf(sumXp(totalSum()))
  if (after <= levelOf(beforeXp)) return
  const stored = await $.store.get('profile')
  const last = isProfile(stored) ? stored.lastLevel : levelOf(beforeXp)
  if (after <= last) return
  activity = withFlash(activity, 'levelup', clockNow)
  $.ui.toast(`⬆ ${name} Lv.${after}!`)
  const stage = stageOf(after)
  if (stage.id !== stageOf(last).id) {
    $.ui.toast(`🎉 ${name}${subjectJosa(name)} ${stage.name}${subjectJosa(stage.name)} 되었어요!`, { timeoutMs: MS.stageToast })
  }
  // 다른 창이 그사이 남긴 일지를 지우지 않도록 저장된 것을 다시 읽고 앞에 붙인다
  const saved = await $.store.get('log')
  const current = Array.isArray(saved) ? saved.filter(isLogEntry) : log
  log = [{ at: clockNow, level: after, stage: stage.id }, ...current].slice(0, LOG_MAX)
  await $.store.set('log', log)
  const base = isProfile(stored) ? stored : { name, createdAt: clockNow, lastLevel: last }
  await $.store.set('profile', { ...base, lastLevel: after })
}

// 성공한 Bash 의 커밋 · PR 보너스(하루 상한 안에서)
function applyBonus(command: string, day: string): string {
  let message = ''
  for (const b of bonusesFor(command)) {
    const got = allowedBonus(todaySum().bonus, b.amount)
    if (got <= 0) continue
    mineOn(day).bonus += got
    dirty.add(day)
    message = `${b.label} +${got} XP`
  }
  return message
}

// ---- 명령 ----

async function rename($: EngineInterface, next: string): Promise<string> {
  const length = [...next].length
  if (length < 1 || length > 12) return '이름은 1~12자로 써 주세요'
  const stored = await $.store.get('profile')
  const base = isProfile(stored) ? stored : { name, createdAt: clockNow, lastLevel: levelOf(sumXp(totalSum())) }
  await $.store.set('profile', { ...base, name: next })
  name = next
  $.ui.invalidate('ui.render')
  return `이제부터 「${next}」이에요`
}

async function reset($: EngineInterface): Promise<string> {
  let answer = ''
  try {
    answer = await $.ui.ask('경험치 · 일지를 모두 지우고 처음부터 할까요?', ['처음부터', '그만두기'])
  } catch {
    return '그만뒀어요'
  }
  if (answer !== '처음부터') return '그만뒀어요'
  for (const key of await $.store.keys()) {
    if (key.startsWith('d:') || key === 'profile' || key === 'log') await $.store.delete(key)
  }
  await load($)
  return `처음부터 다시 시작해요. 수련생 ${name}, 잘 부탁해요!`
}

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
    void tick($).catch(() => {})
  })
}

export const register: Register = (on, options) => {
  const band = bandModeOf(options.band)

  on('session.start', async ($, e, next) => {
    const out = await next(e)
    turnW = 0
    activity = { working: false, lastActiveAt: 0, flash: null }
    lastDrawnKey = ''
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
    await flushQuietly($)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    // 서브에이전트 시작은 메인 턴 상태를 건드리지 않는다
    if (e.agentId) return next(e)
    turnW = 0
    clockNow = await $.clock.now()
    activity = { ...activity, working: true, lastActiveAt: clockNow }
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    if (result.usage) {
      const before = sumXp(totalSum())
      const w = weightOf(result.usage)
      turnW += w
      await addUsage($, w)
      await afterGain($, before)
      $.ui.invalidate('ui.render')
    }
    return result
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) {
      clockNow = await $.clock.now()
      activity = { ...activity, working: false, lastActiveAt: clockNow }
      if (!e.isAborted) activity = withFlash(activity, 'victory', clockNow, `+${Math.floor(turnW / 1000)} XP`)
    }
    await flushQuietly($)
    $.ui.invalidate('ui.render')
    return next(e)
  })

  // 도구 한 번 = 베기 한 번. 오류면 반격, 성공한 커밋 · PR 은 보너스
  on('tool.call', async ($, e, next) => {
    const out = await next(e)
    if (typeof out.deny === 'string') return out
    const now = await $.clock.now()
    clockNow = now
    const day = dayKey(now, tz)
    mineOn(day).swings += 1
    dirty.add(day)
    const main = !e.agentId
    if (main) activity = withFlash(activity, 'slash', now, `${skillOf(e.tool).name}!`)
    if (out.isError) {
      if (main) activity = withFlash(activity, 'hit', now)
    } else if (e.tool === 'Bash') {
      const before = sumXp(totalSum())
      const message = applyBonus(String((e as { command?: unknown }).command ?? ''), day)
      if (message) activity = withFlash(activity, 'loot', now, message)
      await afterGain($, before)
    }
    $.ui.invalidate('ui.render')
    return out
  }).catch(async ($, e, next) => (next.called ? undefined : next(e))) // 기록에 실패해도 도구 결과는 그대로

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const suffix = e.props.suffix + spinnerSuffix(snapshot().progress, Math.floor(turnW / 1000))
    return next({ ...e, props: { ...e.props, suffix } })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || band === 'off') return next(e)
    const below = await next(e)
    const el = $.ui.resolve(e) as unknown as Els
    const v = snapshot()
    const { stage, pose } = drawState()
    const roomy = band === 'panel' && e.props.bodyColumns >= 64 && e.props.maxRows >= 8
    const art = roomy ? heroArt(el, e.surface, stage.id, pose, 'band') : null
    const mine = art ? bandPanel(el, art, v) : el.Text({ wrap: 'truncate-end', children: [bandLineText(v)] })
    return el.Box({ flexDirection: 'column', children: [mine, below] }) as any
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId === PANE) {
      const el = $.ui.resolve(e) as unknown as Els
      const { stage, pose } = drawState()
      return card(el, heroArt(el, e.surface, stage.id, pose, 'pane', e.props.bodyColumns), snapshot()) as any
    }
    if (e.requestId !== PROBE) return next(e)
    const el: any = $.ui.resolve(e)
    // 터미널의 resolve 도 Svg 를 내주지만 그려지지 않는다 — 표면으로 고른다
    if (e.surface === 'terminal' && 'Raster' in el) return el.Raster(gridToRaster(PROBE_GRID, PROBE_PALETTE, 'probe'))
    if (e.surface !== 'terminal' && 'Svg' in el) return el.Svg({ source: gridToSvg(PROBE_GRID, PROBE_PALETTE, 8), alt: '마검사 시험 무늬' })
    return el.Text({ children: ['그림 요소가 없는 화면이에요'] })
  })

  on('command.run', { command: ['blade', 'spellblade'] }, async ($, e) => {
    const [word] = e.args.trim().split(/\s+/)
    if (!word) {
      await $.ui.open({ id: PANE, title: '마검사', focus: true, closeOnEscape: true })
      return {}
    }
    if (word === 'name') return { text: await rename($, e.args.trim().slice(4).trim()) }
    if (word === 'demo') {
      clockNow = await $.clock.now()
      demoStartedAt = clockNow
      $.ui.invalidate('ui.render')
      return { text: '30초 동안 다섯 단계를 차례로 보여 줄게요' }
    }
    if (word === 'reset') return { text: await reset($) }
    if (word === 'probe') {
      await $.ui.open({ id: PROBE, title: '마검사 시험', focus: true, closeOnEscape: true })
      return { text: await probeText($) }
    }
    return { text: '쓸 수 있는 명령: /blade · /blade name <이름> · /blade demo · /blade reset' }
  }).catch(() => ({ text: '마검사 명령을 처리하지 못했어요' }))
}
