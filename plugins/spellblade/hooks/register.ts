import type { EngineInterface, Register } from 'claude-code'
import { ABORT_GRACE_MS, CAST_FAIL_BELOW, DEFAULT_NAME, FAST_TURN_MS, LIMIT_WARN, LOG_MAX, MS, NIGHT_HOURS, TIER_LEVELS } from './lib/balance.ts'
import { bonusesFor, objectJosa, subjectJosa, topicJosa } from './lib/bonus.ts'
import { skillOf } from './lib/skills.ts'
import { addSum, allowedBonus, dayKey, entryKey, isEntry, isLogEntry, isProfile, sumByDay, sumEntries, sumXp, ZERO, type Entry, type LogEntry, type Sum } from './lib/ledger.ts'
import { limitsOf, liveGauge, resetText, type Gauge } from './lib/limits.ts'
import { earnedTitles, longestStreak, statsOf, streakOf, TITLES, titleName, type Lifetime } from './lib/progression.ts'
import { questReward, questStatus } from './lib/quests.ts'
import { cacheReuse, shortNum } from './lib/tokens.ts'
import { cleanUsage, equipmentAt, levelOf, progressOf, stageOf, tierOf, weightOf, xpForLevel } from './lib/progress.ts'
import { HEIGHT, WIDTH, type Grid } from './lib/sprites.ts'
import { gridToRaster } from './lib/to-raster.ts'
import { gridToSvg } from './lib/to-svg.ts'
import { castDamage, newBattle, retaliate, settle, skillDamage, strike, type Battle } from './lib/battle.ts'
import { MONSTERS } from './lib/monsters.ts'
import { sceneGrid, sceneKey, type SceneInput } from './lib/scene.ts'
import { demoFrame, poseAt, thenFlash, withFlash, type Activity, type Mood } from './lib/status.ts'
import { bandLineText, bandModeOf, bandPanel, baseView, card, sceneArt, spinnerSuffix, stageRoad, type CardView, type Els, type Tab } from './lib/views.ts'

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
let combo = 0 // 메인 대화에서 오류 없이 이어진 도구 호출(부르는 순간 센다 — ×N 표시)
let streak = 0 // 성공으로 끝난 메인 도구 호출의 연속(끝난 순간 센다 — 최고 콤보 기록)
let cleanRun = 0 // 반격 없이 이어진 턴
let runDay = '' // combo · cleanRun 이 쌓이는 날 — 날이 바뀌면 새로 센다
let pastDays = new Map<string, Sum>() // 오늘이 아닌 날마다의 합계(모든 세션)
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
let surface = 'terminal' // session.start 가 알려 준 표면(데스크톱에선 null 일 수 있다)
let battle: Battle | null = null // 지금 싸우는 몬스터(새 세션이면 지금 장비 단계로 새로 만든다)
let pendingHits: number[] = [] // 메인 도구 오류 시각 — Esc 중단인지 가린 뒤(1초 · 다음 호출 · 턴 끝) 반격으로
let loaded = false // 처음 불러오기가 끝났는지 — 그 전에는 날짜 · 합계가 비어 그리지 못한다
let mainTurnSeq = 0 // 메인 턴이 끝날 때마다 1씩 — 끝난 턴의 도구가 늦게 낸 오류를 가린다
let levelSeen = 0 // 이 창이 이미 본 레벨 — 레벨업 알림을 한 번만 내려고 먼저 차지한다
let questsFrom = '' // 이 날부터 의뢰 보상을 센다(2.0 을 처음 켠 날 — 지난날 소급 없음)
let sessionW = 0
let sessionTokens = { in: 0, out: 0, cw: 0, cr: 0 }
// 레벨업 · 의뢰 · 칭호 알림을 한 줄로 세운다(도구를 동시에 불러도 토스트 · 일지가 겹치지 않게)
let announceChain: Promise<void> = Promise.resolve()

function announcing(job: () => Promise<void>): Promise<void> {
  const run = announceChain.then(job)
  announceChain = run.catch(() => {})
  return run
}

let turnW = 0
let activity: Activity = { working: false, lastActiveAt: 0, flash: null, queued: null }
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
const LOADING = '마검사를 불러오는 중…'

const PROBE = 'spellblade-probe'
const PROBE_PALETTE = { r: 0xd23c3c, b: 0x3c64d2, y: 0xf0c83c }
// 왼쪽 반 빨강 · 오른쪽 반 파랑 · 가운데 한 줄 노랑
const PROBE_GRID: Grid = Array.from({ length: HEIGHT }, (_, y) =>
  y === HEIGHT / 2 ? 'y'.repeat(WIDTH) : 'r'.repeat(WIDTH / 2) + 'b'.repeat(WIDTH / 2),
)

const COMMAND = {
  description: '마검사 카드 열기 (name <이름> · title [칭호] · demo · reset)',
  argumentHint: '[name <이름> | title [칭호] | demo | reset]',
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

// 콤보 · 반격 없이 연속은 그날 안에서만 잇는다(오늘 의뢰가 어제 몫으로 채워지지 않게)
function runOn(day: string): void {
  if (day === runDay) return
  runDay = day
  combo = 0
  streak = 0
  cleanRun = 0
}

// 지난 날 합계에서: 전체 · 최근 6일 · 의뢰 보상 · 끝낸 의뢰 수 · XP 를 얻은 날
function applyPast(now: number): void {
  const week = new Set(Array.from({ length: 6 }, (_, i) => dayKey(now - (i + 1) * 86_400_000, tz)))
  past = ZERO
  pastWeek = ZERO
  pastQuestXp = 0
  pastQuestsDone = 0
  pastWeekQuestXp = 0
  activeDays = new Set()
  for (const [day, s] of pastDays) {
    past = addSum(past, s)
    if (week.has(day)) pastWeek = addSum(pastWeek, s)
    const dayXp = sumXp(s)
    if (dayXp >= 1) activeDays.add(day)
    if (day < questsFrom) continue // 의뢰가 없던 날(2.0 전)은 보상을 소급하지 않는다
    const status = questStatus(day, s, dayXp)
    const reward = status.reduce((n, q) => n + (q.done ? q.quest.reward : 0), 0)
    pastQuestXp += reward
    pastQuestsDone += status.filter(q => q.done).length
    if (week.has(day)) pastWeekQuestXp += reward
  }
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

// 리셋 시각이 지난 한도는 가득 찬 것으로(다음 measure 가 올 때까지)
function liveLimits(): { hp: Gauge | null; mp: Gauge | null } {
  return { hp: liveGauge(limits.hp, clockNow), mp: liveGauge(limits.mp, clockNow) }
}

function mood(): Mood {
  const l = liveLimits()
  return {
    hpLeft: l.hp?.left ?? null,
    mpLeft: l.mp?.left ?? null,
    hpReset: resetText(l.hp?.resetsAt ?? null, clockNow, tz),
    mpReset: resetText(l.mp?.resetsAt ?? null, clockNow, tz),
  }
}

function demoNow(): ReturnType<typeof demoFrame> {
  if (demoStartedAt === null) return null
  const f = demoFrame(clockNow - demoStartedAt)
  if (!f) demoStartedAt = null
  return f
}

// 마나(5시간 한도)가 경고선 아래면 영창 빛을 어둡게
function magicDim(pose: string): boolean {
  const mp = liveLimits().mp
  return (pose === 'cast1' || pose === 'cast2') && mp !== null && mp.left < LIMIT_WARN.mp
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
    // 데모 단계의 첫 레벨(단계 0 은 Lv.1)과 그 단계 몬스터
    return { ...baseView(progressOf(xpForLevel(Math.max(1, demo.tier * TIER_LEVELS)))), name, line: demo.line, log, isDemo: true, monster: monsterView(newBattle(demo.tier, 0)) }
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
    limits: liveLimits(),
    resets: { hp: m.hpReset ?? '', mp: m.mpReset ?? '' },
    quests: questStatus(today, t, sumXp(t)),
    streak: life.streak,
    context: contextPercent,
    combo: runDay === today ? combo : 0, // 자정을 넘긴 뒤 아직 부른 도구가 없으면 어제 콤보를 보이지 않는다
    bestCombo: t.combo,
    banner: bannerNow(),
    turn: activity.working ? { ...turnTokens, xp: Math.floor(turnW / 1000) } : lastTurn,
    session: sessionW > 0 ? { ...sessionTokens, xp: Math.floor(sessionW / 1000) } : null,
    today: t,
    equipment: equipmentAt(progress.level),
    stats: statsOf(life),
    titles,
    monster: battle ? monsterView(battle) : null,
  }
}

function monsterView(b: Battle): CardView['monster'] {
  const m = MONSTERS[b.tier]
  return { name: m.name, emoji: m.emoji, hp: b.hp, maxHp: b.maxHp }
}

// 지금 그릴 장면. 바뀔 때만 다시 그리려고 열쇠도 같이(장면 열쇠 + 밴드 글)
function sceneState(): { input: SceneInput; key: string } {
  const v = snapshot()
  const demo = demoNow()
  const scene = demo ?? poseAt(activity, clockNow, mood())
  // 빛기둥(0.4초) · 모닥불(0.8초, 잠들면 멈춤)만 두 프레임을 번갈아 — 그 밖에는 0 이라 그것 때문에 다시 그리지 않는다
  const beat = scene.pose === 'levelup' ? MS.castFrame : scene.mode === 'rest' && scene.pose !== 'sleep' ? MS.fireFrame : 0
  const frame: 0 | 1 = beat && Math.floor(clockNow / beat) % 2 === 1 ? 1 : 0
  const input: SceneInput = {
    mode: scene.mode,
    tier: demo ? demo.tier : tierOf(v.progress.level),
    pose: scene.pose,
    frame,
    battle: demo ? newBattle(demo.tier, 0) : battle,
    now: clockNow,
    dimMagic: magicDim(scene.pose),
  }
  const m = v.monster
  return { input, key: `${demo ? 'demo' : ''}|${sceneKey(input)}|${scene.line}|${v.progress.xp}|${v.banner ?? ''}|${v.name}|${m ? `${m.hp}/${m.maxHp}` : ''}` }
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
    // 새 세션(/clear 등): 앞 세션 몫은 session.end 에서 이미 저장됐다. 콤보 · 연속 · 이 세션 기록도 새로
    mine.clear()
    dirty.clear()
    combo = 0
    streak = 0
    cleanRun = 0
    lastTurn = null
    contextPercent = null // 새 대화의 배낭 용량은 다음 measure 가 알려 준다
    sessionW = 0
    sessionTokens = { in: 0, out: 0, cw: 0, cr: 0 }
    pendingHits = []
    battle = null // 아래에서 지금 장비 단계의 몬스터로 새로
  }
  sid = newSid
  today = newToday
  othersToday = sumEntries(rows, { day: today, excludeSession: sid })
  // 지난 날 몫은 저장이 끝났으면 메모리에서 뺀다. 오늘 몫은 메모리 쪽이 더 새것이다
  for (const day of [...mine.keys()]) if (day !== today && !dirty.has(day)) mine.delete(day)
  const own = rows.find(([k]) => k === entryKey(today, sid))?.[1]
  if (isEntry(own) && !mine.has(today)) mine.set(today, { ...own })
  name = isProfile(profile) ? profile.name : DEFAULT_NAME
  log = Array.isArray(saved) ? saved.filter(isLogEntry).slice(0, LOG_MAX) : []
  questsFrom = isProfile(profile) && typeof profile.questsFrom === 'string' ? profile.questsFrom : newToday
  pastDays = new Map([...sumByDay(rows)].filter(([day]) => day !== today))
  applyPast(now)
  questsNotified = new Set(Array.isArray(notified) ? notified.filter((n): n is number => typeof n === 'number') : [])
  titleOrder = isProfile(profile) && Array.isArray(profile.titles) ? profile.titles.filter(t => TITLES.some(x => x.id === t)) : []
  knownTitles = new Set(titleOrder)
  chosenTitle = isProfile(profile) && typeof profile.title === 'string' ? profile.title : null
  lastSyncAt = now
  clockNow = now
  activity = { ...activity, lastActiveAt: now }
  $.ui.invalidate('ui.render')

  // 이 창이 켜지기 전에 오른 레벨은 다시 알리지 않는다
  const levelNow = levelOf(totalXp())
  if (!battle) battle = newBattle(tierOf(levelNow), totalXp())
  loaded = true
  levelSeen = Math.max(isProfile(profile) ? profile.lastLevel : 0, levelNow)

  // 처음 켤 때는 이미 이룬 것을 조용히 기록만 한다(지난 레벨 · 칭호 · 의뢰를 한꺼번에 알리지 않으려고)
  const earned = earnedTitles(lifetime())
  const needTitles = !isProfile(profile) || !Array.isArray(profile.titles)
  const needFrom = !isProfile(profile) || typeof profile.questsFrom !== 'string'
  if (needTitles || needFrom) {
    const base = isProfile(profile) ? profile : { name, createdAt: now, lastLevel: levelNow }
    const titles = needTitles ? earned : (base as { titles?: string[] }).titles ?? []
    if (needTitles) {
      knownTitles = new Set(earned)
      titleOrder = [...earned]
    }
    await $.store.set('profile', { ...base, titles, questsFrom, lastLevel: Math.max(base.lastLevel, levelNow) })
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
  const yesterday = new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
  const keys = await $.store.keys()
  const rows: [string, unknown][] = []
  const late: [string, unknown][] = []
  for (const key of keys) {
    if (key.startsWith(`d:${day}:`) && key !== entryKey(day, me)) rows.push([key, await $.store.get(key)])
    else if (key.startsWith(`d:${yesterday}:`)) late.push([key, await $.store.get(key)])
  }
  if (day !== today || me !== sid) return // 읽는 사이 날짜 · 세션이 바뀌었다
  othersToday = sumEntries(rows)
  // 어제 몫은 자정 뒤에 늦게 저장될 수 있다(다른 창의 마지막 몫) — 다시 합친다
  if (late.length) pastDays.set(yesterday, sumEntries(late))
  else pastDays.delete(yesterday)
  applyPast(clockNow)
  $.ui.invalidate('ui.render')
}

// 미뤄 둔 도구 오류를 반격으로: 콤보 · 연속이 끊기고, 마검사는 맞고, 몬스터는 친다.
// due 가 없으면 모두(다음 호출 · 턴 끝이면 Esc 중단이 아니다), 있으면 유예가 지난 것만
function applyHits(now: number, due?: (at: number) => boolean): void {
  const ready = due ? pendingHits.filter(due) : pendingHits
  if (!ready.length) return
  pendingHits = due ? pendingHits.filter(at => !due(at)) : []
  combo = 0
  streak = 0
  turnHadError = true
  activity = withFlash(activity, 'hit', now)
  if (battle) battle = retaliate(battle, now)
}

// 400ms 마다: 유예가 지난 오류를 반격으로 · 쓰러진 몬스터 정리, 60초마다 저장 · 남의 몫 다시 읽기, 날짜가 바뀌면 전부 다시
async function tick($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  clockNow = now
  applyHits(now, at => now - at >= ABORT_GRACE_MS)
  if (battle) {
    const xp = totalXp()
    battle = settle(battle, now, tierOf(levelOf(xp)), xp)
  }
  const key = sceneState().key
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
  sessionTokens = { in: sessionTokens.in + u.input_tokens, out: sessionTokens.out + u.output_tokens, cw: sessionTokens.cw + u.cache_creation_input_tokens, cr: sessionTokens.cr + u.cache_read_input_tokens }
  sessionW += w
  dirty.add(day)
  clockNow = now
  activity = { ...activity, lastActiveAt: now }
}

// 경험치가 늘어난 뒤: 의뢰 · 칭호 · 레벨업을 알린다. 알림은 한 줄로 세우고, 다른 창이 이미 알렸으면 조용히
// 알림은 덤이라 저장에 실패해도 던지지 않는다(턴 끝 저장이 다음 주기로 밀리지 않게)
function afterGain($: EngineInterface): Promise<void> {
  return announcing(async () => {
    await announceQuests($)
    await announceTitles($)
    await announceLevel($)
  }).catch(() => {})
}

async function announceLevel($: EngineInterface): Promise<void> {
  const after = levelOf(totalXp())
  if (after <= levelSeen) return
  const from = levelSeen
  levelSeen = after // 먼저 차지한다(기다리는 사이 같은 레벨업을 또 알리지 않게)
  const stored = await $.store.get('profile')
  const last = isProfile(stored) ? Math.max(stored.lastLevel, from) : from
  if (after <= last) return // 다른 창이 이미 알렸다
  activity = withFlash(activity, 'levelup', clockNow)
  $.ui.toast(`⬆ ${name} Lv.${after}!`)
  banner = { text: `✨ LEVEL UP!  Lv.${last} → Lv.${after} ✨`, until: clockNow + MS.levelUp }
  const stage = stageOf(after)
  if (stage.id !== stageOf(last).id) {
    $.ui.toast(`🎉 ${name}${subjectJosa(name)} ${stage.name}${subjectJosa(stage.name)} 되었어요!`, { timeoutMs: MS.stageToast })
    banner = { text: `🎉 승급!  ${stageOf(last).name} → ${stage.name}`, until: clockNow + MS.stageToast }
    tab = 1 // 새 단계가 보이는 상태 탭으로
    try {
      // 승급은 카드 창을 저절로 연다(터미널은 넓은 창에서만 보인다)
      await $.ui.open({ id: PANE, title: '마검사', closeOnEscape: true })
    } catch {
      // 못 열어도 배너 · 토스트는 남는다
    }
  }
  await addLog($, { at: clockNow, level: after, stage: stage.id, kind: 'level' })
  const fresh = await $.store.get('profile')
  const base = isProfile(fresh) ? fresh : { name, createdAt: clockNow, lastLevel: last }
  await $.store.set('profile', { ...base, lastLevel: Math.max(base.lastLevel, after) })
}

// 일지에 한 줄 더하기(다른 창이 남긴 것을 지우지 않도록 다시 읽고 앞에 붙인다)
async function addLog($: EngineInterface, entry: LogEntry): Promise<void> {
  const saved = await $.store.get('log')
  const current = Array.isArray(saved) ? saved.filter(isLogEntry) : log
  log = [entry, ...current].slice(0, LOG_MAX)
  await $.store.set('log', log)
}

// 오늘 의뢰를 새로 끝냈으면 한 번만 알린다(q:<오늘> 에 먼저 기록하고 알린다)
async function announceQuests($: EngineInterface): Promise<void> {
  const t = todaySum()
  const fresh = questStatus(today, t, sumXp(t)).filter(q => q.done && !questsNotified.has(q.quest.index))
  if (fresh.length === 0) return
  for (const q of fresh) questsNotified.add(q.quest.index) // 먼저 차지
  const stored = await $.store.get(`q:${today}`)
  const already = new Set(Array.isArray(stored) ? stored : [])
  await $.store.set(`q:${today}`, [...new Set([...already, ...questsNotified])])
  for (const q of fresh) {
    if (already.has(q.quest.index)) continue // 다른 창이 이미 알렸다
    const message = `📜 의뢰 완료! ${q.quest.title} +${q.quest.reward} XP`
    $.ui.toast(message)
    activity = withFlash(activity, 'loot', clockNow, message)
    await addLog($, { at: clockNow, level: levelOf(totalXp()), stage: stageOf(levelOf(totalXp())).id, kind: 'quest', text: `의뢰 완료 · ${q.quest.title}` })
  }
}

// 새 칭호를 얻었으면 한 번만 알린다(profile.titles 에 먼저 기록하고 알린다)
async function announceTitles($: EngineInterface): Promise<void> {
  const fresh = earnedTitles(lifetime()).filter(id => !knownTitles.has(id))
  if (fresh.length === 0) return
  for (const id of fresh) {
    knownTitles.add(id) // 먼저 차지
    titleOrder.push(id)
  }
  const stored = await $.store.get('profile')
  const saved = new Set(isProfile(stored) && Array.isArray(stored.titles) ? stored.titles : [])
  const base = isProfile(stored) ? stored : { name, createdAt: clockNow, lastLevel: levelOf(totalXp()) }
  await $.store.set('profile', { ...base, titles: [...new Set([...saved, ...knownTitles])] })
  for (const id of fresh) {
    if (saved.has(id)) continue // 다른 창이 이미 알렸다
    const title = titleName(id) ?? id
    $.ui.toast(`🏅 칭호 「${title}」${objectJosa(title)} 얻었어요`)
    activity = withFlash(activity, 'loot', clockNow, `🏅 칭호 「${title}」`)
    await addLog($, { at: clockNow, level: levelOf(totalXp()), stage: stageOf(levelOf(totalXp())).id, kind: 'title', text: `칭호 「${title}」` })
  }
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

// "+3 XP · 출력 2.1k"
function victorySummary(): string {
  const parts = [`+${Math.floor(turnW / 1000)} XP`]
  if (turnTokens.out > 0) parts.push(`출력 ${shortNum(turnTokens.out)}`)
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

// /blade title: 얻은 칭호 목록 · /blade title <칭호>: 이름 앞에 달 칭호 고르기
async function chooseTitle($: EngineInterface, wanted: string): Promise<string> {
  const earned = earnedTitles(lifetime())
  if (!wanted) {
    if (earned.length === 0) return '아직 얻은 칭호가 없어요. /blade 카드의 [2] 의뢰 탭에서 조건을 볼 수 있어요'
    const names = earned.map(id => titleName(id)).join(', ')
    const now = currentTitle(earned)
    return `지금: ${now ? `「${now}」` : '없음'} · 얻은 칭호: ${names} · 고르려면 /blade title <칭호>`
  }
  const t = TITLES.find(x => x.name === wanted)
  if (!t) return `그런 칭호는 없어요. 얻은 칭호는 /blade title 로 볼 수 있어요`
  if (!earned.includes(t.id)) return `「${t.name}」${topicJosa(t.name)} 아직 얻지 못했어요`
  const stored = await $.store.get('profile')
  const base = isProfile(stored) ? stored : { name, createdAt: clockNow, lastLevel: levelOf(totalXp()) }
  await $.store.set('profile', { ...base, title: t.id })
  chosenTitle = t.id
  $.ui.invalidate('ui.render')
  return `이제 「${t.name}」${objectJosa(t.name)} 달아요`
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
    if (key.startsWith('d:') || key.startsWith('q:') || key === 'profile' || key === 'log') await $.store.delete(key)
  }
  // 이 창이 메모리에 들고 있던 몫도 지운다(안 지우면 다음 저장 때 되살아난다)
  mine.clear()
  dirty.clear()
  combo = 0
  streak = 0
  cleanRun = 0
  lastTurn = null
  sessionW = 0
  sessionTokens = { in: 0, out: 0, cw: 0, cr: 0 }
  levelSeen = 0
  questsNotified = new Set()
  knownTitles = new Set()
  titleOrder = []
  chosenTitle = null
  banner = null
  pendingHits = []
  battle = null // 몬스터도 처음(슬라임)부터 — load 가 새로 만든다
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
    surface = e.surface ?? 'terminal'
    turnW = 0
    activity = { working: false, lastActiveAt: 0, flash: null, queued: null }
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
      // 칸이 비었거나 숫자가 아니면 0 으로 — NaN 이 그날 칸을 망가뜨리지 않게
      const usage = cleanUsage(result.usage)
      const w = weightOf(usage)
      turnW += w
      await addUsage($, w, usage)
      // 메인 대화의 단계가 끝나면: 캐시 재사용이 낮으면 캐스팅 실패(연출만, 손해 없음), 아니면 마법 적중 — W ÷ 10 데미지.
      // 서브에이전트 단계는 XP 만(새 서브에이전트의 첫 단계는 캐시가 비어 실패가 연달아 뜨기 쉽다)
      if (!e.agentId) {
        const reuse = cacheReuse({ in: usage.input_tokens, cw: usage.cache_creation_input_tokens, cr: usage.cache_read_input_tokens })
        if (reuse !== null && reuse < CAST_FAIL_BELOW) activity = withFlash(activity, 'castFail', clockNow)
        else {
          activity = withFlash(activity, 'castHit', clockNow)
          if (battle) battle = strike(battle, castDamage(w), clockNow)
        }
      }
      await afterGain($)
      $.ui.invalidate('ui.render')
    }
    return result
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) {
      mainTurnSeq += 1
      clockNow = await $.clock.now()
      // Esc 로 끊긴 턴의 도구 오류는 중단이 낸 것이라 반격이 아니다. 아니면 지금 반격으로(「반격 없이 연속」 판정보다 먼저)
      if (e.isAborted) pendingHits = []
      else applyHits(clockNow)
      activity = { ...activity, working: false, lastActiveAt: clockNow }
      // 턴 기록(턴 수 · 빠른 턴 · 새벽 · 반격 없이 연속)과 승리는 정상 답변으로 끝난 턴만 —
      // Esc 로 끊은 턴 · API 오류 · 거절로 의뢰를 채우지 못하게. 반격은 어떻게 끝났든 연속을 끊는다
      const answered = !e.isAborted && e.reason === 'answer'
      runOn(dayKey(clockNow, tz))
      if (turnHadError) cleanRun = 0
      else if (answered) cleanRun += 1
      if (answered) {
        const day = dayKey(clockNow, tz)
        const entry = mineOn(day)
        entry.turns = (entry.turns ?? 0) + 1
        if (e.durationMs <= FAST_TURN_MS) entry.fast = (entry.fast ?? 0) + 1
        const hour = new Date(clockNow - tz * 60_000).getUTCHours()
        if (hour >= NIGHT_HOURS[0] && hour < NIGHT_HOURS[1]) entry.night = (entry.night ?? 0) + 1
        entry.clean = Math.max(entry.clean ?? 0, cleanRun)
        dirty.add(day)
        // 마지막 단계의 적중 · 실패 0.7초가 끝난 뒤에 승리(덮지 않게 이어 붙인다)
        activity = thenFlash(activity, 'victory', clockNow, victorySummary())
      }
      lastTurn = { ...turnTokens, xp: Math.floor(turnW / 1000) }
      await afterGain($)
    }
    await flushQuietly($)
    $.ui.invalidate('ui.render')
    return next(e)
  })

  // 도구 한 번 = 베기 한 번. 오류면 반격, 성공한 커밋 · PR 은 보너스
  on('tool.call', async ($, e, next) => {
    const main = !e.agentId
    const skill = skillOf(e.tool)
    const seq = mainTurnSeq // 이 호출이 시작된 메인 턴
    if (main) {
      // 부르는 순간 베기 — 기술 이름과 콤보, 몬스터에 데미지. 다음 도구를 불렀으면 앞의 오류는 Esc 중단이 아니다
      clockNow = await $.clock.now()
      applyHits(clockNow)
      runOn(dayKey(clockNow, tz))
      combo += 1
      activity = withFlash(activity, 'slash', clockNow, `${skill.name}!${combo >= 3 ? ` ×${combo} 콤보` : ''}`)
      if (battle) battle = strike(battle, skillDamage(skill.id, battle.tier), clockNow)
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
    dirty.add(day)
    if (out.isError) {
      // 반격은 Esc 중단인지 가린 뒤에(1초 · 다음 호출 · 턴 끝 — applyHits).
      // Esc 로 끊기면 엔진은 이 훅을 기다리지 않고 턴을 끝낼 수 있다 — 끊긴 호출이나 이미 끝난 턴의 오류는 반격이 아니다
      if (main && !next.signal.aborted && seq === mainTurnSeq) pendingHits.push(now)
    } else {
      // 최고 콤보는 성공으로 끝난 호출의 연속으로 센다(끝난 날 기준 — 자정 · 병렬 호출에도 어긋나지 않게)
      if (main) {
        applyHits(now) // 성공한 호출이 뒤따랐으면 앞의 오류는 진짜 반격
        runOn(day)
        streak += 1
        entry.combo = Math.max(entry.combo ?? 0, streak)
      }
      if (e.tool === 'Bash') {
        const message = applyBonus(String((e as { command?: unknown }).command ?? ''), day)
        if (message) activity = withFlash(activity, 'loot', now, message)
      }
    }
    await afterGain($)
    $.ui.invalidate('ui.render')
    return out
  }).catch(async ($, e, next) => (next.called ? undefined : next(e))) // 기록에 실패해도 도구 결과는 그대로

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (!loaded) return next(e)
    const suffix = e.props.suffix + spinnerSuffix(snapshot().progress, Math.floor(turnW / 1000))
    return next({ ...e, props: { ...e.props, suffix } })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || band === 'off') return next(e)
    const below = await next(e)
    clockNow = await $.clock.now() // 그리는 순간의 시각(배너 · 자세가 틱을 기다리지 않게)
    const el = $.ui.resolve(e) as unknown as Els
    if (!loaded) return el.Box({ flexDirection: 'column', children: [el.Text({ wrap: 'truncate-end', dimColor: true, children: [LOADING] }), below] }) as any
    const v = snapshot()
    // 터미널은 언제나 한 줄. 데스크톱 그림판(장면 320 × 128 + 글)은 84칸 · 10줄 이상에서만
    const roomy = e.surface !== 'terminal' && band === 'panel' && e.props.bodyColumns >= 84 && e.props.maxRows >= 10
    const art = roomy ? sceneArt(el, e.surface, sceneGrid(sceneState().input), v.name, 'band') : null
    const mine = art ? bandPanel(el, art, v) : el.Text({ wrap: 'truncate-end', children: [bandLineText(v)] })
    return el.Box({ flexDirection: 'column', children: [mine, below] }) as any
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId === PANE) {
      clockNow = await $.clock.now()
      const el = $.ui.resolve(e) as unknown as Els
      if (!loaded) return el.Text({ dimColor: true, children: [LOADING] }) as any
      const v = snapshot()
      const onTab = (t: Tab) => {
        tab = t
        $.ui.invalidate('ui.render')
      }
      // 데스크톱은 장면 480 × 192, 터미널은 장면(160칸 × 32줄)이 들어갈 만큼 큰 창에서만
      const big = e.surface !== 'terminal' || (e.props.bodyColumns >= 160 && e.props.scroll.bodyRows >= 44)
      const art = big ? sceneArt(el, e.surface, sceneGrid(sceneState().input), v.name, 'pane') : null
      return card(el, art, v, tab, onTab, stageRoad(el, e.surface, v.progress.level)) as any
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
    if (word === 'title') return { text: await chooseTitle($, e.args.trim().slice(5).trim()) }
    if (word === 'demo') {
      clockNow = await $.clock.now()
      demoStartedAt = clockNow
      $.ui.invalidate('ui.render')
      return { text: '29초 동안 열두 단계를 차례로 보여 줄게요' }
    }
    if (word === 'reset') return { text: await reset($) }
    if (word === 'probe') {
      await $.ui.open({ id: PROBE, title: '마검사 시험', focus: true, closeOnEscape: true })
      return { text: await probeText($) }
    }
    return { text: '쓸 수 있는 명령: /blade · /blade name <이름> · /blade title [칭호] · /blade demo · /blade reset' }
  }).catch(() => ({ text: '마검사 명령을 처리하지 못했어요' }))
}
