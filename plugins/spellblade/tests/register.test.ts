import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import type { On } from 'claude-code'
import { dayKey, sumEntries } from '../hooks/lib/ledger.ts'
import { levelOf } from '../hooks/lib/progress.ts'

// 스트림을 끝까지 읽고 결과를 돌려준다
async function run<R>(stream: AsyncGenerator<unknown, R> & { result: Promise<R> }): Promise<R> {
  for await (const _ of stream) { /* chunks */ }
  return stream.result
}

type Seen = { commands: string[]; toasts: { text: string; timeoutMs?: number }[]; opened: string[]; store: Map<string, unknown>; setCalls: number }

// 키트에는 엔진이 없어서 플러그인이 부르는 $ 호출에 테스트가 맨 아래에서 답한다.
// 테스트의 훅은 모두 첫 $ 호출 전에 걸어야 하므로: beneath → (테스트 훅) → start
type BeneathOpts = { now?: number; store?: Record<string, unknown>; sid?: string; bottomBand?: string; failSet?: boolean; beforeKeys?: () => Promise<void>; limits?: { kind: string; percentUsed: number; resetsAt?: string }[] }

function beneath(on: On, opts: BeneathOpts = {}): { clock: MockClock; seen: Seen } {
  const clock = mock.clock(on, { now: opts.now ?? Date.UTC(2026, 9, 16, 3, 0) })
  const seen: Seen = { commands: [], toasts: [], opened: [], store: new Map(Object.entries(opts.store ?? {})), setCalls: 0 }
  // 저장소는 테스트가 직접 들여다볼 수 있게 Map 으로 답한다(테스트의 $ 에는 store 가 없다)
  on('store.get', async (_$, e) => ({ value: structuredClone(seen.store.get(e.key)) }))
  on('store.set', async (_$, e) => {
    seen.setCalls++
    if (opts.failSet && e.key.startsWith('d:')) throw new Error('저장소가 가득 찼다')
    seen.store.set(e.key, structuredClone(e.value))
    return { value: undefined }
  })
  on('store.delete', async (_$, e) => { seen.store.delete(e.key); return { value: undefined } })
  on('store.keys', async () => {
    if (opts.beforeKeys) await opts.beforeKeys()
    return { value: [...seen.store.keys()] }
  })
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  // $ 메서드(op 이벤트)의 답은 { value } 로 준다
  on('session.id', async () => ({ value: opts.sid ?? 'me' }))
  on('command.register', async (_$, e) => { seen.commands.push(e.name); return { value: { command: e.name } } })
  on('ui.toast', async (_$, e) => { seen.toasts.push({ text: e.text, timeoutMs: e.timeoutMs }); return { value: undefined } })
  on('ui.open', async (_$, e) => { seen.opened.push(e.id); return { value: { isPlaced: true as const } } })
  on('turn.complete', async () => ({ text: '' }))
  on('session.end', async () => ({}))
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, percent: 10 }, rateLimits: opts.limits ?? [] } }))
  on('session.measure', async (_$, e) => ({ changed: e.changed }))
  // 맨 아래 그림: 스피너는 단어 + suffix, 밴드는 다른 Mod 대신 opts.bottomBand
  on('ui.render', { component: 'Spinner' }, async ($, e) => {
    const { Text } = $.ui.resolve(e)
    return Text({ children: [e.props.word + e.props.suffix] })
  })
  on('ui.render', { component: 'AbovePrompt' }, async ($, e) => {
    const { Text } = $.ui.resolve(e)
    return Text({ children: [opts.bottomBand ?? ''] })
  })
  on('ui.render', { component: 'Pane' }, async ($, e) => {
    const { Text } = $.ui.resolve(e)
    return Text({ children: [''] })
  })
  return { clock, seen }
}

async function start($: Engine): Promise<void> {
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
}

const usage = (output: number, input = 0) => ({ input_tokens: input, output_tokens: output, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm' })

function answerStep(on: On, output: number) {
  on('turn.step', async function* () {
    return { turnId: 't', index: 0, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: usage(output) }
  })
}

const SPINNER = { word: 'Forging', message: null, suffix: '…', mode: 'responding' as const }

test('turn.step 사용량이 이번 턴 XP 로 쌓인다', async ($, on) => {
  beneath(on)
  answerStep(on, 34000)
  await start($)
  await $.turn.start({ text: 'hi', turnId: 't' })
  await run($.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1 }))
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'terminal', component: 'Spinner', props: SPINNER })
  expect(await m.find({ text: /Forging….*\+34xp/ })).toBeTruthy()
})

test('새 턴이 시작되면 이번 턴 XP 는 0 부터', async ($, on) => {
  beneath(on)
  answerStep(on, 34000)
  await start($)
  await $.turn.start({ text: 'a', turnId: 't' })
  await run($.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1 }))
  await $.turn.start({ text: 'b', turnId: 't2' })
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'terminal', component: 'Spinner', props: SPINNER })
  expect(await m.find({ text: /\+0xp/ })).toBeTruthy()
})

test('/blade 명령이 등록된다', async ($, on) => {
  const { seen } = beneath(on)
  await start($)
  expect(seen.commands).toContain('blade')
})

const PANE = (o = {}) => ({ title: '마검사 시험', isFocused: true, bodyColumns: 60, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 30 }, view: {}, ...o })

test('시험 페인: 터미널에는 Raster', async ($, on) => {
  beneath(on)
  await start($)
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'terminal', component: 'Pane', requestId: 'spellblade-probe', props: PANE() })
  expect(await m.find({ type: 'Raster' })).toBeTruthy()
})

test('시험 페인: 데스크톱에는 Svg', async ($, on) => {
  beneath(on)
  await start($)
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'desktop', component: 'Pane', requestId: 'spellblade-probe', props: PANE() })
  expect(await m.find({ type: 'Svg' })).toBeTruthy()
})

// ---- M1: 저장 · 불러오기 · 밴드 한 줄 ----

const TZ = new Date().getTimezoneOffset()
// 현지 시각으로 날짜 · 시각을 만든다
const local = (y: number, mo: number, d: number, h: number, mi: number) => Date.UTC(y, mo, d, h, mi) + TZ * 60_000
const NOON = local(2026, 9, 16, 12, 0)
const TODAY = dayKey(NOON, TZ)
const YESTERDAY = dayKey(NOON - 86_400_000, TZ)
const entry = (w: number, bonus = 0, swings = 0) => ({ w, bonus, swings, updatedAt: 1 })
const BAND = (o = {}) => ({ hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 12 }, view: {}, ...o })

async function bandText($: Engine, surface: 'terminal' | 'desktop' = 'terminal', props = BAND()): Promise<string> {
  const m = await $.ui.mount({ plugin: 'spellblade', surface, component: 'AbovePrompt', props })
  return JSON.stringify(await m.drawn())
}

async function oneTurn($: Engine, turnId = 't') {
  await $.turn.start({ text: 'hi', turnId })
  await run($.turn.step({ turnId, index: 0, model: 'm', messageCount: 1 }))
  await $.turn.complete({ turnId, answer: '', durationMs: 1, isAborted: false, reason: 'answer' })
}

test('다른 세션 몫과 어제 몫이 합계에 들어간다', async ($, on) => {
  beneath(on, { now: NOON, store: { [`d:${YESTERDAY}:x`]: entry(960_000), [`d:${TODAY}:y`]: entry(500_000) } })
  await start($)
  const text = await bandText($)
  expect(text).toMatch(new RegExp(`Lv\\.${levelOf(1460)}(?!\\d)`))
  expect(text).toMatch(/오늘 \+500 XP/)
})

test('두 세션이 서로 덮어쓰지 않는다', async ($, on) => {
  const { seen } = beneath(on, { now: NOON, store: { [`d:${TODAY}:y`]: entry(500_000) } })
  answerStep(on, 34_000)
  await start($)
  await oneTurn($)
  expect(seen.store.get(`d:${TODAY}:y`)).toEqual(entry(500_000))
  expect(seen.store.get(`d:${TODAY}:me`)).toMatchObject({ w: 34_000, bonus: 0, swings: 0 })
})

test('다시 불러오면 같은 세션 칸을 이어 쓴다', async ($, on) => {
  const { seen } = beneath(on, { now: NOON, store: { [`d:${TODAY}:me`]: entry(10_000) } })
  answerStep(on, 1_000)
  await start($)
  await oneTurn($)
  expect(seen.store.get(`d:${TODAY}:me`)).toMatchObject({ w: 11_000 })
})

test('60초 안에 다른 세션 증가가 보인다', async ($, on) => {
  const { clock, seen } = beneath(on, { now: NOON })
  await start($)
  seen.store.set(`d:${TODAY}:y`, entry(800_000))
  await clock.advance(60_000)
  expect(await bandText($)).toMatch(/오늘 \+800 XP/)
})

test('자정이 지나면 오늘 XP 가 새로 시작한다', async ($, on) => {
  const { clock } = beneath(on, { now: local(2026, 9, 16, 23, 59), store: { [`d:${YESTERDAY}:x`]: entry(960_000) } })
  answerStep(on, 34_000)
  await start($)
  await oneTurn($)
  expect(await bandText($)).toMatch(/오늘 \+34 XP/)
  await clock.advance(120_000)
  const text = await bandText($)
  expect(text).toMatch(/오늘 \+0 XP/)
  expect(text).toMatch(new RegExp(`Lv\\.${levelOf(994)}(?!\\d)`))
})

test('설문 중에는 밴드를 비켜 준다', async ($, on) => {
  beneath(on, { now: NOON, bottomBand: '설문' })
  await start($)
  const text = await bandText($, 'terminal', BAND({ hasSurvey: true }))
  expect(text).toMatch(/설문/)
  expect(text).not.toMatch(/Lv\./)
})


// ---- M2: 밴드 그림판 · 카드 창 · 움직임 ----

test('터미널 밴드에는 Raster, 데스크톱 밴드에는 Svg', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  const t = await $.ui.mount({ plugin: 'spellblade', surface: 'terminal', component: 'AbovePrompt', props: BAND() })
  expect(await t.find({ type: 'Raster' })).toBeTruthy()
  const d = await $.ui.mount({ plugin: 'spellblade', surface: 'desktop', component: 'AbovePrompt', props: BAND() })
  expect(await d.find({ type: 'Svg' })).toBeTruthy()
  expect(await d.find({ type: 'Raster' })).toBeFalsy()
})

test('좁으면 한 줄로 바뀐다', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'terminal', component: 'AbovePrompt', props: BAND({ bodyColumns: 50 }) })
  expect(await m.find({ type: 'Raster' })).toBeFalsy()
  expect(await m.find({ text: /Lv\.\d+ .* 오늘 \+/ })).toBeTruthy()
})

test('밴드가 낮아도 한 줄로 바뀐다', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'terminal', component: 'AbovePrompt', props: BAND({ maxRows: 5, scroll: { offset: 0, bodyRows: 5 } }) })
  expect(await m.find({ type: 'Raster' })).toBeFalsy()
})

test('다른 Mod 그림을 가리지 않는다', async ($, on) => {
  beneath(on, { now: NOON, bottomBand: '다른 모드' })
  await start($)
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'terminal', component: 'AbovePrompt', props: BAND() })
  expect(await m.find({ text: '다른 모드' })).toBeTruthy()
  expect(await m.find({ text: /수련생/ })).toBeTruthy()
})

test('/blade 로 카드 창이 열린다', async ($, on) => {
  const { seen } = beneath(on, { now: NOON })
  await start($)
  await $.command.run({ command: 'blade', args: '' })
  expect(seen.opened).toContain('spellblade')
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'desktop', component: 'Pane', requestId: 'spellblade', props: PANE({ title: '마검사' }) })
  expect(await m.find({ text: /승급의 길/ })).toBeTruthy()
  expect(await m.find({ text: /모험 일지/ })).toBeTruthy()
  expect(await m.find({ type: 'Svg' })).toBeTruthy()
})

test('카드 창: 터미널은 32칸 × 16줄', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'terminal', component: 'Pane', requestId: 'spellblade', props: PANE() })
  const r = JSON.stringify(await m.find({ type: 'Raster' }))
  expect(r).toMatch(/"columns":32/)
  expect(r).toMatch(/"rows":16/)
})

test('터미널 밴드 그림은 상반신 32칸 × 8줄', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'terminal', component: 'AbovePrompt', props: BAND() })
  const r = JSON.stringify(await m.find({ type: 'Raster' }))
  expect(r).toMatch(/"columns":32/)
  expect(r).toMatch(/"rows":8/)
})

test('일하는 동안 영창 프레임이 바뀐다', async ($, on) => {
  const { clock } = beneath(on, { now: NOON })
  await start($)
  await $.turn.start({ text: 'hi', turnId: 't' })
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'terminal', component: 'AbovePrompt', props: BAND() })
  const first = JSON.stringify(await m.find({ type: 'Raster' }))
  await clock.advance(400)
  const second = JSON.stringify(await m.find({ type: 'Raster' }))
  expect(second).not.toBe(first)
  expect(await m.find({ text: /마법을 두르는 중/ })).toBeTruthy()
})

test('턴이 끝나면 승리 문구', async ($, on) => {
  beneath(on, { now: NOON })
  answerStep(on, 34_000)
  await start($)
  await oneTurn($)
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'terminal', component: 'AbovePrompt', props: BAND() })
  expect(await m.find({ text: /✓ 승리 \+34 XP/ })).toBeTruthy()
})

// ---- M3: 베기 · 반격 · 보너스 · 레벨업 알림 ----

async function cardText($: Engine): Promise<string> {
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'desktop', component: 'Pane', requestId: 'spellblade', props: PANE() })
  const text = JSON.stringify(await m.drawn())
  await m.unmount() // 같은 테스트에서 다시 그릴 수 있게
  return text
}

test('도구 한 번에 베기 한 번', async ($, on) => {
  beneath(on, { now: NOON })
  on('tool.call', async () => ({ result: 'ok' }))
  await start($)
  await $.tool.call({ tool: 'Read', file_path: '/x' } as any)
  expect(await bandText($)).toMatch(/탐색의 눈!/)
  expect(await cardText($)).toMatch(/오늘 베기 1번/)
})

test('거부된 도구는 베기가 아니다', async ($, on) => {
  beneath(on, { now: NOON })
  on('tool.call', async () => ({ deny: 'no' }))
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'rm -rf /' } as any)
  expect(await cardText($)).toMatch(/오늘 베기 0번/)
})

test('오류면 반격당한다', async ($, on) => {
  beneath(on, { now: NOON })
  on('tool.call', async () => ({ result: 'boom', isError: true }))
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'false' } as any)
  expect(await bandText($)).toMatch(/윽, 반격당했다/)
})

test('커밋 성공 +20', async ($, on) => {
  beneath(on, { now: NOON })
  on('tool.call', async () => ({ result: 'ok' }))
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'git add . && git commit -m x' } as any)
  const text = await bandText($)
  expect(text).toMatch(/다음 레벨까지 40 XP/)
  expect(text).toMatch(/전리품 획득! \+20 XP/)
})

test('커밋이 실패하면 보너스 없음', async ($, on) => {
  beneath(on, { now: NOON })
  on('tool.call', async () => ({ result: 'nothing to commit', isError: true }))
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' } as any)
  expect(await bandText($)).toMatch(/다음 레벨까지 60 XP/)
})

test('PR +50 은 하루 300 에서 멈춘다', async ($, on) => {
  beneath(on, { now: NOON, store: { [`d:${TODAY}:y`]: entry(0, 280) } })
  on('tool.call', async () => ({ result: 'ok' }))
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'gh pr create --fill' } as any)
  // 280 + 20 = 300 XP → Lv.3, 다음 레벨(540)까지 240
  expect(await bandText($)).toMatch(/다음 레벨까지 240 XP/)
})

test('레벨업 토스트', async ($, on) => {
  const { seen } = beneath(on, { now: NOON, store: { profile: { name: '렌', createdAt: 1, lastLevel: 1, titles: ['first'] } } })
  answerStep(on, 60_000)
  await start($)
  await oneTurn($)
  expect(seen.toasts.map(t => t.text)).toContain('⬆ 렌 Lv.2!')
  expect(seen.store.get('profile')).toMatchObject({ lastLevel: 2 })
  expect(seen.store.get('log')).toMatchObject([{ level: 2, stage: 'trainee', kind: 'level' }])
})

test('레벨업 토스트는 한 번만', async ($, on) => {
  const { seen } = beneath(on, { now: NOON, store: { profile: { name: '렌', createdAt: 1, lastLevel: 2, titles: ['first'] } } })
  answerStep(on, 60_000)
  await start($)
  await oneTurn($)
  expect(seen.toasts.length).toBe(0)
})

test('승급 토스트', async ($, on) => {
  const { seen } = beneath(on, { now: NOON, store: { [`d:${YESTERDAY}:x`]: entry(959_000) } })
  answerStep(on, 1_000)
  await start($)
  await oneTurn($)
  expect(seen.toasts).toContainEqual({ text: '🎉 렌이 검사가 되었어요!', timeoutMs: 5000 })
})

test('서브에이전트 턴 끝은 승리가 아니다', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  await $.turn.start({ text: 'hi', turnId: 't' })
  await $.turn.complete({ turnId: 'a1', answer: '', durationMs: 1, isAborted: false, reason: 'answer', agentId: 'a' })
  const text = await bandText($)
  expect(text).not.toMatch(/승리/)
  expect(text).toMatch(/마법을 두르는 중/)
})

// ---- M3: /blade name · demo · reset ----

async function blade($: Engine, args: string): Promise<string> {
  const out = await $.command.run({ command: 'blade', args })
  return String((out as { text?: string }).text ?? '')
}

function answerAsk(on: On, label: string | null) {
  on('tool.call', { tool: 'AskUserQuestion' }, async (_$, e: any) =>
    label === null ? { deny: '닫힘' } : { result: { questions: e.questions, answers: { [e.questions[0].question]: label } } })
}

test('이름 바꾸기', async ($, on) => {
  const { seen } = beneath(on, { now: NOON })
  await start($)
  expect(await blade($, 'name 아린')).toBe('이제부터 「아린」이에요')
  expect(seen.store.get('profile')).toMatchObject({ name: '아린' })
  expect(await bandText($)).toMatch(/아린 ·/)
})

test('이름 길이 검사', async ($, on) => {
  const { seen } = beneath(on, { now: NOON })
  await start($)
  expect(await blade($, 'name ' + 'x'.repeat(13))).toMatch(/1~12자/)
  expect(await blade($, 'name')).toMatch(/1~12자/)
  expect(seen.store.get('profile')).toMatchObject({ name: '렌' })
})

test('데모는 저장소를 안 바꾼다', async ($, on) => {
  const { clock, seen } = beneath(on, { now: NOON, store: { [`d:${TODAY}:y`]: entry(500_000) } })
  await start($)
  const before = JSON.stringify([...seen.store])
  await blade($, 'demo')
  expect(await cardText($)).toMatch(/\(데모\)/)
  await clock.advance(6_000)
  expect(await cardText($)).toMatch(/검사/)
  await clock.advance(25_000)
  expect(await cardText($)).not.toMatch(/\(데모\)/)
  expect(JSON.stringify([...seen.store])).toBe(before)
})

test('reset: 그만두면 그대로', async ($, on) => {
  const { seen } = beneath(on, { now: NOON, store: { [`d:${TODAY}:y`]: entry(500_000) } })
  answerAsk(on, '그만두기')
  await start($)
  expect(await blade($, 'reset')).toMatch(/그만뒀어요/)
  expect(seen.store.has(`d:${TODAY}:y`)).toBe(true)
})

test('reset: 처음부터를 고르면 지운다', async ($, on) => {
  const { seen } = beneath(on, { now: NOON, store: { [`d:${YESTERDAY}:x`]: entry(959_000), [`d:${TODAY}:y`]: entry(500_000), log: [{ at: 1, level: 4, stage: 'trainee' }] } })
  answerAsk(on, '처음부터')
  await start($)
  expect(await blade($, 'reset')).toMatch(/처음부터/)
  expect([...seen.store.keys()].filter(k => k.startsWith('d:'))).toEqual([])
  expect(seen.store.has('log')).toBe(false)
  expect(await bandText($)).toMatch(/Lv\.1(?!\d)/)
})

test('reset: 묻기가 실패하면 안 지운다', async ($, on) => {
  const { seen } = beneath(on, { now: NOON, store: { [`d:${TODAY}:y`]: entry(500_000) } })
  answerAsk(on, null)
  await start($)
  expect(await blade($, 'reset')).toMatch(/그만뒀어요/)
  expect(seen.store.has(`d:${TODAY}:y`)).toBe(true)
})

test('모르는 인자는 쓸 수 있는 명령을 알려 준다', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  expect(await blade($, 'dance')).toMatch(/\/blade name <이름>/)
})

// ---- 최종 검토에서 나온 것 ----

test('서브에이전트가 시작해도 이번 턴 XP 와 일하는 상태는 그대로', async ($, on) => {
  beneath(on, { now: NOON })
  answerStep(on, 34_000)
  await start($)
  await $.turn.start({ text: 'hi', turnId: 't' })
  await run($.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1 }))
  await $.turn.start({ text: 'sub', turnId: 'a1', agentId: 'a' })
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'terminal', component: 'Spinner', props: SPINNER })
  expect(await m.find({ text: /\+34xp/ })).toBeTruthy()
})

test('메인 턴이 끝난 뒤 시작한 서브에이전트는 일하는 상태를 켜지 않는다', async ($, on) => {
  const { clock } = beneath(on, { now: NOON })
  await start($)
  await $.turn.start({ text: 'hi', turnId: 't' })
  await $.turn.complete({ turnId: 't', answer: '', durationMs: 1, isAborted: false, reason: 'answer' })
  await $.turn.start({ text: 'bg', turnId: 'a1', agentId: 'a' })
  await clock.advance(3_000) // 승리 문구가 지나간 뒤
  expect(await bandText($)).not.toMatch(/마법을 두르는 중/)
})

test('저장이 실패해도 0.4초마다 다시 시도하지 않는다', async ($, on) => {
  const { clock, seen } = beneath(on, { now: NOON, failSet: true })
  answerStep(on, 1_000)
  await start($)
  await $.turn.start({ text: 'hi', turnId: 't' })
  await run($.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1 }))
  const before = seen.setCalls
  await clock.advance(120_000)
  expect(seen.setCalls - before).toBeLessThanOrEqual(3)
})

test('다시 불러오는 중에 들어온 경험치를 잃지 않는다', async ($, on) => {
  // 자정 재로드가 저장소 키를 읽는 순간 멈춰 두고, 그사이 응답 하나를 끝낸다
  let release: () => void = () => {}
  let hit: () => void = () => {}
  const loading = new Promise<void>(r => { hit = r })
  let gate = false
  const { clock, seen } = beneath(on, {
    now: local(2026, 9, 16, 23, 59),
    store: { [`d:${YESTERDAY}:x`]: entry(1_000) },
    beforeKeys: () => {
      if (!gate) return Promise.resolve()
      gate = false
      hit()
      return new Promise<void>(r => { release = r })
    },
  })
  answerStep(on, 5_000)
  await start($)
  gate = true
  const crossing = clock.advance(120_000)
  await loading
  await $.turn.start({ text: 'hi', turnId: 't' })
  await run($.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1 }))
  release()
  await crossing
  await $.turn.complete({ turnId: 't', answer: '', durationMs: 1, isAborted: false, reason: 'answer' })
  expect(sumEntries([...seen.store], { onlySession: 'me' }).w).toBe(5_000)
})

test('레벨업 때 다른 창이 남긴 일지를 지우지 않는다', async ($, on) => {
  const { seen } = beneath(on, { now: NOON, store: { profile: { name: '렌', createdAt: 1, lastLevel: 1, titles: ['first'] } } })
  answerStep(on, 60_000)
  await start($)
  seen.store.set('log', [{ at: 5, level: 7, stage: 'swordsman' }])
  await oneTurn($)
  expect(seen.store.get('log')).toMatchObject([{ level: 2 }, { level: 7 }])
})

// ---- 2차 Task 8: 기록 v2 · 의뢰 · 칭호 · 한도 ----

import { questsFor } from '../hooks/lib/quests.ts'

let toolMode: 'ok' | 'error' = 'ok'
function answerTools(on: On, gate?: Promise<void>) {
  on('tool.call', async () => {
    if (gate) await gate
    return toolMode === 'ok' ? { result: 'ok' } : { result: 'boom', isError: true }
  })
}

test('도구를 부르는 순간 베기가 보인다', async ($, on) => {
  let release: () => void = () => {}
  const gate = new Promise<void>(r => { release = r })
  beneath(on, { now: NOON })
  toolMode = 'ok'
  answerTools(on, gate)
  await start($)
  const pending = $.tool.call({ tool: 'Bash', command: 'sleep 30' } as any)
  await new Promise(r => setTimeout(r, 0))
  expect(await bandText($)).toMatch(/폭풍 베기!/)
  release()
  await pending
})

test('콤보는 오류에서 끊긴다', async ($, on) => {
  const { clock } = beneath(on, { now: NOON })
  answerTools(on)
  await start($)
  toolMode = 'ok'
  for (let i = 0; i < 3; i++) await $.tool.call({ tool: 'Read', file_path: '/x' } as any)
  expect(await bandText($)).toMatch(/×3 콤보/)
  toolMode = 'error'
  await $.tool.call({ tool: 'Bash', command: 'false' } as any)
  await clock.advance(2_100) // 반격 문구가 지나간 뒤
  toolMode = 'ok'
  await $.tool.call({ tool: 'Read', file_path: '/x' } as any)
  const t = await bandText($)
  expect(t).toMatch(/탐색의 눈!/)
  expect(t).not.toMatch(/콤보/)
})

test('API 오류로 끝난 턴은 승리가 아니다', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  await $.turn.start({ text: 'hi', turnId: 't' })
  await $.turn.complete({ turnId: 't', answer: '', durationMs: 1, isAborted: false, reason: 'error' })
  expect(await bandText($)).not.toMatch(/승리/)
})

test('토큰 칸과 턴 기록이 저장된다', async ($, on) => {
  const { seen } = beneath(on, { now: NOON })
  on('turn.step', async function* () {
    return { turnId: 't', index: 0, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: { input_tokens: 320, output_tokens: 2_140, cache_read_input_tokens: 410_000, cache_creation_input_tokens: 12_400, model: 'm' } }
  })
  await start($)
  await oneTurn($)
  expect(seen.store.get(`d:${TODAY}:me`)).toMatchObject({ in: 320, out: 2_140, cw: 12_400, cr: 410_000, turns: 1, fast: 1, clean: 1 })
  expect(await bandText($)).toMatch(/✓ 승리 \+3 XP · 출력 2\.1k · 기억 97%/)
})

// 베기 의뢰(쉬움)가 나오는 날을 찾는다
function swingDay(): string {
  for (let d = 1; d <= 300; d++) {
    const day = new Date(Date.UTC(2026, 0, d)).toISOString().slice(0, 10)
    if (questsFor(day)[0].kind === 'swings') return day
  }
  throw new Error('베기 의뢰가 있는 날을 못 찾음')
}

test('의뢰를 끝내면 보상 XP 와 토스트', async ($, on) => {
  const day = swingDay()
  const [y, m, d] = day.split('-').map(Number)
  const { seen } = beneath(on, { now: local(y, m - 1, d, 12, 0) })
  toolMode = 'ok'
  answerTools(on)
  await start($)
  for (let i = 0; i < 40; i++) await $.tool.call({ tool: 'Read', file_path: '/x' } as any)
  expect(seen.toasts.map(t => t.text)).toContain('📜 의뢰 완료! 베기 40번 +30 XP')
  expect(await bandText($)).toMatch(/다음 레벨까지 30 XP/)
  expect(seen.store.get(`q:${day}`)).toEqual([0])
})

test('두 창이 같은 의뢰를 끝내도 보상은 한 번', async ($, on) => {
  const day = swingDay()
  const [y, m, d] = day.split('-').map(Number)
  const { seen } = beneath(on, { now: local(y, m - 1, d, 12, 0), store: { [`d:${day}:other`]: { ...entry(0), swings: 40 }, [`q:${day}`]: [0], profile: { name: '렌', createdAt: 1, lastLevel: 1, titles: [] } } })
  toolMode = 'ok'
  answerTools(on)
  await start($)
  await $.tool.call({ tool: 'Read', file_path: '/x' } as any)
  expect(seen.toasts.filter(t => t.text.startsWith('📜'))).toEqual([])
  expect(await bandText($)).toMatch(/다음 레벨까지 30 XP/)
})

test('1차 저장소로 켜도 토스트가 쏟아지지 않는다', async ($, on) => {
  const { seen } = beneath(on, { now: NOON, store: { [`d:${YESTERDAY}:x`]: { w: 2_000_000, bonus: 0, swings: 2_000, updatedAt: 1 }, profile: { name: '렌', createdAt: 1, lastLevel: 6 } } })
  await start($)
  expect(seen.toasts).toEqual([])
  expect(seen.store.get('profile')).toMatchObject({ titles: expect.arrayContaining(['first', 'veteran']) })
})

test('한도를 읽어 마나가 바닥나면 쉰다', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  await $.session.measure({ context: { window: 1_000_000, percent: 40 }, rateLimits: [{ kind: 'five_hour', percentUsed: 100 }, { kind: 'seven_day', percentUsed: 30 }], changed: ['rateLimits'] } as any)
  expect(await bandText($)).toMatch(/마나 소진/)
})

test('처음 켤 때 한도를 읽는다', async ($, on) => {
  beneath(on, { now: NOON, limits: [{ kind: 'seven_day', percentUsed: 100 }] })
  await start($)
  expect(await bandText($)).toMatch(/기진맥진/)
})
