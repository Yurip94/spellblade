import type { EngineInterface, Register } from 'claude-code'
import { DEFAULT_NAME, FAST_TURN_MS, LOG_MAX, MS, NIGHT_HOURS, STAGES } from './lib/balance.ts'
import { bonusesFor, subjectJosa } from './lib/bonus.ts'
import { skillOf } from './lib/skills.ts'
import { addSum, allowedBonus, dayKey, entryKey, isEntry, isLogEntry, isProfile, parseEntryKey, sumByDay, sumEntries, sumXp, ZERO, type Entry, type LogEntry, type Sum } from './lib/ledger.ts'
import { limitsOf, resetText, type Gauge } from './lib/limits.ts'
import { earnedTitles, longestStreak, statsOf, streakOf, TITLES, titleName, type Lifetime } from './lib/progression.ts'
import { questReward, questStatus } from './lib/quests.ts'
import { memoryRate, shortNum } from './lib/tokens.ts'
import { equipmentAt, levelOf, progressOf, stageOf, weightOf, xpForLevel } from './lib/progress.ts'
import { HEIGHT, WIDTH, type Grid } from './lib/sprites.ts'
import { gridToRaster } from './lib/to-raster.ts'
import { gridToSvg } from './lib/to-svg.ts'
import { demoFrame, poseAt, withFlash, type Activity, type Mood } from './lib/status.ts'
import { bandLineText, bandModeOf, bandPanel, baseView, card, heroArt, spinnerSuffix, stageRoad, type CardView, type Els, type Tab } from './lib/views.ts'

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

// 2차: 전투 기록 · 한도 · 의뢰 · 칭호
let combo = 0 // 메인 대화에서 오류 없이 이어진 도구 호출
let cleanRun = 0 // 반격 없이 이어진 턴
let turnHadError = false
let turnTokens = { in: 0, out: 0, cw: 0, cr: 0 }
let limits: { hp: Gauge | null; mp: Gauge | null } = { hp: null, mp: null }
let contextPercent: number | null = null
let pastQuestXp = 0 // 오늘이 아닌 날들의 의뢰 보상
let pastQuestsDone = 0
let pastWeekQuestXp = 0
let activeDays = new Set<string>() // XP 를 1 이상 얻은 지난 날
let knownTitles = new Set<string>() // 이미 알린 칭호
let questsNotified = new Set<number>() // 오늘 이미 알린 의뢰 번호
let titleOrder: string[] = [] // 얻은 순서
let chosenTitle: string | null = null // /blade title 로 고른 칭호
let lastTurn: CardView['turn'] = null
let banner: { text: string; until: number } | null = null
let tab: Tab = 1 // 카드 창 탭

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

function todayQuestXp(): number {
  const t = todaySum()
  return questReward(today, t, sumXp(t))
}

// 총 XP = W · 보너스 XP + 지난 날 의뢰 보상 + 오늘 의뢰 보상
function totalXp(): number {
  return sumXp(totalSum()) + pastQuestXp + todayQuestXp()
}

function lifetime(): Lifetime {
  const t = todaySum()
  const done = questStatus(today, t, sumXp(t)).filter(q => q.done).length
  const days = sumXp(t) >= 1 ? new Set([...activeDays, today]) : activeDays
  return { sum: totalSum(), questsDone: pastQuestsDone + done, questXp: pastQuestXp + todayQuestXp(), streak: streakOf(days, today), bestStreak: longestStreak(days) }
}

function mood(): Mood {
  return {
    hpLeft: limits.hp?.left ?? null,
    mpLeft: limits.mp?.left ?? null,
    hpReset: resetText(limits.hp?.resetsAt ?? null, clockNow, tz),
    mpReset: resetText(limits.mp?.resetsAt ?? null, clockNow, tz),
  }
}

function demoNow(): ReturnType<typeof demoFrame> {
  if (demoStartedAt === null) return null
  const f = demoFrame(clockNow - demoStartedAt)
  if (!f) demoStartedAt = null
  return f
}

function bannerNow(): string | null {
  return banner && clockNow < banner.until ? banner.text : null
}

// 이름 앞 칭호: 고른 것이 있으면 그것, 없으면 가장 최근에 얻은 것
function currentTitle(earned: readonly string[]): string | null {
  const id = chosenTitle && earned.includes(chosenTitle) ? chosenTitle : [...titleOrder].reverse().find(t => earned.includes(t)) ?? earned[earned.length - 1]
  return id ? titleName(id) : null
}

function snapshot(): CardView {
  const t = todaySum()
  const demo = demoNow()
  if (demo) {
    const stage = STAGES.find(s => s.id === demo.stage) ?? STAGES[0]
    return { ...baseView(progressOf(xpForLevel(stage.minLevel))), name, line: demo.line, log, isDemo: true }
  }
  const progress = progressOf(totalXp())
  const life = lifetime()
  const titles = earnedTitles(life)
  const m = mood()
  return {
    ...baseView(progress),
    name,
    title: currentTitle(titles),
    todayXp: sumXp(t) + todayQuestXp(),
    weekXp: sumXp(addSum(pastWeek, t)) + pastWeekQuestXp + todayQuestXp(),
    todaySwings: t.swings,
    line: poseAt(activity, clockNow, m).line,
    log,
    limits,
    resets: { hp: m.hpReset ?? '', mp: m.mpReset ?? '' },
    quests: questStatus(today, t, sumXp(t)),
    streak: life.streak,
    memory: memoryRate(t),
    context: contextPercent,
    combo,
    bestCombo: t.combo,
    banner: bannerNow(),
    turn: activity.working ? { ...turnTokens, xp: Math.floor(turnW / 1000) } : lastTurn,
    today: t,
    equipment: equipmentAt(progress.level),
    stats: statsOf(life),
    titles,
  }
}

// 지금 그릴 단계 · 자세. 바뀔 때만 다시 그리려고 열쇠도 같이
function drawState(): { stage: CardView['progress']['stage']; pose: ReturnType<typeof poseAt>['pose']; frame: 0 | 1; key: string } {
  const v = snapshot()
  const demo = demoNow()
  const { pose, line } = demo ?? poseAt(activity, clockNow, mood())
  // 레벨업 빛기둥은 두 프레임을 번갈아
  const frame: 0 | 1 = pose === 'levelup' && Math.floor(clockNow / MS.castFrame) % 2 === 1 ? 1 : 0
  return { stage: v.progress.stage, pose, frame, key: `${demo ? 'demo' : ''}|${v.progress.stage.id}|${pose}|${frame}|${line}|${v.progress.xp}|${v.banner ?? ''}` }
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
  const notified = await $.store.get(`q:${newToday}`)

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
  // 지난 날: 의뢰 보상 · 끝낸 의뢰 수 · XP 를 얻은 날
  pastQuestXp = 0
  pastQuestsDone = 0
  pastWeekQuestXp = 0
  activeDays = new Set()
  for (const [day, s] of sumByDay(rows)) {
    if (day === today) continue
    const dayXp = sumXp(s)
    const status = questStatus(day, s, dayXp)
    const reward = status.reduce((n, q) => n + (q.done ? q.quest.reward : 0), 0)
    pastQuestXp += reward
    pastQuestsDone += status.filter(q => q.done).length
    if (week.has(day)) pastWeekQuestXp += reward
    if (dayXp >= 1) activeDays.add(day)
  }
  questsNotified = new Set(Array.isArray(notified) ? notified.filter((n): n is number => typeof n === 'number') : [])
  titleOrder = isProfile(profile) && Array.isArray(profile.titles) ? profile.titles.filter(t => TITLES.some(x => x.id === t)) : []
  knownTitles = new Set(titleOrder)
  chosenTitle = isProfile(profile) && typeof profile.title === 'string' ? profile.title : null
  lastSyncAt = now
  clockNow = now
  activity = { ...activity, lastActiveAt: now }
  $.ui.invalidate('ui.render')

  // 처음 켤 때는 이미 이룬 것을 조용히 기록만 한다(지난 레벨 · 칭호 · 의뢰를 한꺼번에 알리지 않으려고)
  const earned = earnedTitles(lifetime())
  if (!isProfile(profile) || !Array.isArray(profile.titles)) {
    const base = isProfile(profile) ? profile : { name, createdAt: now, lastLevel: levelOf(totalXp()) }
    knownTitles = new Set(earned)
    titleOrder = [...earned]
    await $.store.set('profile', { ...base, titles: earned })
  }
  if (!Array.isArray(notified)) {
    const t = todaySum()
    const done = questStatus(today, t, sumXp(t)).filter(q => q.done).map(q => q.quest.index)
    questsNotified = new Set(done)
    await $.store.set(`q:${today}`, done)
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

async function addUsage($: EngineInterface, w: number, u: { input_tokens: number; output_tokens: number; cache_creation_input_tokens: number; cache_read_input_tokens: number }): Promise<void> {
  const now = await $.clock.now()
  const day = dayKey(now, tz)
  const e = mineOn(day)
  e.w += w
  e.in = (e.in ?? 0) + u.input_tokens
  e.out = (e.out ?? 0) + u.output_tokens
  e.cw = (e.cw ?? 0) + u.cache_creation_input_tokens
  e.cr = (e.cr ?? 0) + u.cache_read_input_tokens
  turnTokens = { in: turnTokens.in + u.input_tokens, out: turnTokens.out + u.output_tokens, cw: turnTokens.cw + u.cache_creation_input_tokens, cr: turnTokens.cr + u.cache_read_input_tokens }
  dirty.add(day)
  clockNow = now
  activity = { ...activity, lastActiveAt: now }
}

// 경험치가 늘어난 뒤: 레벨이 올랐으면 알리고 일지에 남긴다. 다른 세션이 이미 알렸으면 조용히
async function afterGain($: EngineInterface, beforeXp: number): Promise<void> {
  await announceQuests($)
  await announceTitles($)
  const after = levelOf(totalXp())
  if (after <= levelOf(beforeXp)) return
  const stored = await $.store.get('profile')
  const last = isProfile(stored) ? stored.lastLevel : levelOf(beforeXp)
  if (after <= last) return
  activity = withFlash(activity, 'levelup', clockNow)
  $.ui.toast(`⬆ ${name} Lv.${after}!`)
  banner = { text: `✨ LEVEL UP!  Lv.${last} → Lv.${after} ✨`, until: clockNow + MS.levelUp }
  const stage = stageOf(after)
  if (stage.id !== stageOf(last).id) {
    $.ui.toast(`🎉 ${name}${subjectJosa(name)} ${stage.name}${subjectJosa(stage.name)} 되었어요!`, { timeoutMs: MS.stageToast })
    banner = { text: `🎉 승급!  ${stageOf(last).name} → ${stage.name}`, until: clockNow + MS.stageToast }
    try {
      // 승급은 카드 창을 저절로 연다(터미널은 넓은 창에서만 보인다)
      await $.ui.open({ id: PANE, title: '마검사', closeOnEscape: true })
    } catch {
      // 못 열어도 배너 · 토스트는 남는다
    }
  }
  // 다른 창이 그사이 남긴 일지를 지우지 않도록 저장된 것을 다시 읽고 앞에 붙인다
  const saved = await $.store.get('log')
  const current = Array.isArray(saved) ? saved.filter(isLogEntry) : log
  log = [{ at: clockNow, level: after, stage: stage.id, kind: 'level' as const }, ...current].slice(0, LOG_MAX)
  await $.store.set('log', log)
  const base = isProfile(stored) ? stored : { name, createdAt: clockNow, lastLevel: last }
  await $.store.set('profile', { ...base, lastLevel: after })
}

// 일지에 한 줄 더하기(다른 창이 남긴 것을 지우지 않도록 다시 읽고 앞에 붙인다)
async function addLog($: EngineInterface, entry: LogEntry): Promise<void> {
  const saved = await $.store.get('log')
  const current = Array.isArray(saved) ? saved.filter(isLogEntry) : log
  log = [entry, ...current].slice(0, LOG_MAX)
  await $.store.set('log', log)
}

// 오늘 의뢰를 새로 끝냈으면 한 번만 알린다(q:<오늘> 에 기록)
async function announceQuests($: EngineInterface): Promise<void> {
  const t = todaySum()
  const fresh = questStatus(today, t, sumXp(t)).filter(q => q.done && !questsNotified.has(q.quest.index))
  if (fresh.length === 0) return
  const stored = await $.store.get(`q:${today}`)
  const already = new Set(Array.isArray(stored) ? stored : [])
  for (const q of fresh) {
    questsNotified.add(q.quest.index)
    if (already.has(q.quest.index)) continue // 다른 창이 이미 알렸다
    $.ui.toast(`📜 의뢰 완료! ${q.quest.title} +${q.quest.reward} XP`)
    await addLog($, { at: clockNow, level: levelOf(totalXp()), stage: stageOf(levelOf(totalXp())).id, kind: 'quest', text: `의뢰 완료 · ${q.quest.title}` })
  }
  await $.store.set(`q:${today}`, [...new Set([...already, ...questsNotified])])
}

// 새 칭호를 얻었으면 한 번만 알린다(profile.titles 에 기록)
async function announceTitles($: EngineInterface): Promise<void> {
  const fresh = earnedTitles(lifetime()).filter(id => !knownTitles.has(id))
  if (fresh.length === 0) return
  const stored = await $.store.get('profile')
  const saved = new Set(isProfile(stored) && Array.isArray(stored.titles) ? stored.titles : [])
  for (const id of fresh) {
    knownTitles.add(id)
    titleOrder.push(id)
    if (saved.has(id)) continue
    $.ui.toast(`🏅 칭호 「${titleName(id)}」을 얻었어요`)
    await addLog($, { at: clockNow, level: levelOf(totalXp()), stage: stageOf(levelOf(totalXp())).id, kind: 'title', text: `칭호 「${titleName(id)}」` })
  }
  const base = isProfile(stored) ? stored : { name, createdAt: clockNow, lastLevel: levelOf(totalXp()) }
  await $.store.set('profile', { ...base, titles: [...new Set([...saved, ...knownTitles])] })
}

// 성공한 Bash 의 커밋 · PR 보너스(하루 상한 안에서)
function applyBonus(command: string, day: string): string {
  let message = ''
  for (const b of bonusesFor(command)) {
    const entry = mineOn(day)
    if (b.kind === 'commit') entry.commits = (entry.commits ?? 0) + 1
    else entry.prs = (entry.prs ?? 0) + 1
    dirty.add(day)
    const got = allowedBonus(todaySum().bonus, b.amount)
    if (got <= 0) continue
    entry.bonus += got
    dirty.add(day)
    message = `${b.label} +${got} XP`
  }
  return message
}

// "+3 XP · 출력 2.1k · 기억 96%"
function victorySummary(): string {
  const parts = [`+${Math.floor(turnW / 1000)} XP`]
  if (turnTokens.out > 0) parts.push(`출력 ${shortNum(turnTokens.out)}`)
  const mem = memoryRate(turnTokens)
  if (mem !== null) parts.push(`기억 ${mem}%`)
  return parts.join(' · ')
}

// ---- 명령 ----

async function rename($: EngineInterface, next: string): Promise<string> {
  const length = [...next].length
  if (length < 1 || length > 12) return '이름은 1~12자로 써 주세요'
  const stored = await $.store.get('profile')
  const base = isProfile(stored) ? stored : { name, createdAt: clockNow, lastLevel: levelOf(totalXp()) }
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
    try {
      const u = await $.session.usage()
      limits = limitsOf(u.rateLimits)
      contextPercent = u.context.percent ?? null
    } catch {
      // 한도를 못 읽으면 체력 · 마나를 숨긴다
    }
    startTimer($)
    await registerCommand($)
    return out
  })

  // 턴이 끝날 때 · 한도가 1%p 움직일 때: 체력(주간) · 마나(5시간) · 배낭(컨텍스트)
  on('session.measure', async ($, e, next) => {
    limits = limitsOf(e.rateLimits)
    contextPercent = e.context.percent ?? null
    $.ui.invalidate('ui.render')
    return next(e)
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
    turnTokens = { in: 0, out: 0, cw: 0, cr: 0 }
    turnHadError = false
    clockNow = await $.clock.now()
    activity = { ...activity, working: true, lastActiveAt: clockNow }
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    if (result.usage) {
      const before = totalXp()
      const w = weightOf(result.usage)
      turnW += w
      await addUsage($, w, result.usage)
      await afterGain($, before)
      $.ui.invalidate('ui.render')
    }
    return result
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) {
      clockNow = await $.clock.now()
      activity = { ...activity, working: false, lastActiveAt: clockNow }
      const before = totalXp()
      const day = dayKey(clockNow, tz)
      const entry = mineOn(day)
      entry.turns = (entry.turns ?? 0) + 1
      if (e.durationMs <= FAST_TURN_MS) entry.fast = (entry.fast ?? 0) + 1
      const hour = new Date(clockNow - tz * 60_000).getUTCHours()
      if (hour >= NIGHT_HOURS[0] && hour < NIGHT_HOURS[1]) entry.night = (entry.night ?? 0) + 1
      cleanRun = turnHadError ? 0 : cleanRun + 1
      entry.clean = Math.max(entry.clean ?? 0, cleanRun)
      dirty.add(day)
      // 정상 답변으로 끝난 턴만 승리 (중단 · API 오류 · 거절은 아님)
      if (!e.isAborted && e.reason === 'answer') activity = withFlash(activity, 'victory', clockNow, victorySummary())
      lastTurn = { ...turnTokens, xp: Math.floor(turnW / 1000) }
      await afterGain($, before)
    }
    await flushQuietly($)
    $.ui.invalidate('ui.render')
    return next(e)
  })

  // 도구 한 번 = 베기 한 번. 오류면 반격, 성공한 커밋 · PR 은 보너스
  on('tool.call', async ($, e, next) => {
    const main = !e.agentId
    const skill = skillOf(e.tool)
    if (main) {
      // 부르는 순간 베기 — 기술 이름과 콤보
      combo += 1
      clockNow = await $.clock.now()
      activity = withFlash(activity, 'slash', clockNow, `${skill.name}!${combo >= 3 ? ` ×${combo} 콤보` : ''}`)
      $.ui.invalidate('ui.render')
    }
    const out = await next(e)
    if (typeof out.deny === 'string') {
      if (main) combo = 0
      return out
    }
    const now = await $.clock.now()
    clockNow = now
    const day = dayKey(now, tz)
    const entry = mineOn(day)
    entry.swings += 1
    entry.skills = (entry.skills ?? 0) | skill.bit
    if (skill.id === 'clone') entry.agents = (entry.agents ?? 0) + 1
    if (main) entry.combo = Math.max(entry.combo ?? 0, combo)
    dirty.add(day)
    const before = totalXp()
    if (out.isError) {
      if (main) {
        combo = 0
        turnHadError = true
        activity = withFlash(activity, 'hit', now)
      }
    } else if (e.tool === 'Bash') {
      const message = applyBonus(String((e as { command?: unknown }).command ?? ''), day)
      if (message) activity = withFlash(activity, 'loot', now, message)
    }
    await afterGain($, before)
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
    clockNow = await $.clock.now() // 그리는 순간의 시각(배너 · 자세가 틱을 기다리지 않게)
    const el = $.ui.resolve(e) as unknown as Els
    const v = snapshot()
    const { stage, pose, frame } = drawState()
    // 그림판은 8줄 그림 + 다른 Mod 줄 여유 2줄 → 10줄 이상에서만
    const roomy = band === 'panel' && e.props.bodyColumns >= 64 && e.props.maxRows >= 10
    const art = roomy ? heroArt(el, e.surface, stage.id, pose, 'band', frame) : null
    const mine = art ? bandPanel(el, art, v) : el.Text({ wrap: 'truncate-end', children: [bandLineText(v)] })
    return el.Box({ flexDirection: 'column', children: [mine, below] }) as any
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId === PANE) {
      clockNow = await $.clock.now()
      const el = $.ui.resolve(e) as unknown as Els
      const { stage, pose, frame } = drawState()
      const onTab = (t: Tab) => {
        tab = t
        $.ui.invalidate('ui.render')
      }
      return card(el, heroArt(el, e.surface, stage.id, pose, 'pane', frame), snapshot(), tab, onTab, stageRoad(el, e.surface, stage.id)) as any
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
      tab = 1
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
