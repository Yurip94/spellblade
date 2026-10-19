import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import type { On } from 'claude-code'
import { dayKey, isEntry, sumEntries } from '../hooks/lib/ledger.ts'
import { levelOf } from '../hooks/lib/progress.ts'

// 스트림을 끝까지 읽고 결과를 돌려준다
async function run<R>(stream: AsyncGenerator<unknown, R> & { result: Promise<R> }): Promise<R> {
  for await (const _ of stream) { /* chunks */ }
  return stream.result
}

type Seen = { commands: string[]; toasts: { text: string; timeoutMs?: number }[]; opened: string[]; store: Map<string, unknown>; setCalls: number }

// 키트에는 엔진이 없어서 플러그인이 부르는 $ 호출에 테스트가 맨 아래에서 답한다.
// 테스트의 훅은 모두 첫 $ 호출 전에 걸어야 하므로: beneath → (테스트 훅) → start
// failMeta: profile · log · q: 같은 알림 칸 저장만 실패시킨다(테스트 중간에 켤 수 있다)
type BeneathOpts = { now?: number; store?: Record<string, unknown>; sid?: string; bottomBand?: string; failSet?: boolean; failMeta?: boolean; beforeKeys?: () => Promise<void>; limits?: { kind: string; percentUsed: number; resetsAt?: string }[] }

function beneath(on: On, opts: BeneathOpts = {}): { clock: MockClock; seen: Seen } {
  const clock = mock.clock(on, { now: opts.now ?? Date.UTC(2026, 9, 16, 3, 0) })
  const seen: Seen = { commands: [], toasts: [], opened: [], store: new Map(Object.entries(opts.store ?? {})), setCalls: 0 }
  // 저장소는 테스트가 직접 들여다볼 수 있게 Map 으로 답한다(테스트의 $ 에는 store 가 없다)
  on('store.get', async (_$, e) => ({ value: structuredClone(seen.store.get(e.key)) }))
  on('store.set', async (_$, e) => {
    seen.setCalls++
    if (opts.failSet && e.key.startsWith('d:')) throw new Error('저장소가 가득 찼다')
    if (opts.failMeta && !e.key.startsWith('d:')) throw new Error('알림 칸을 쓰지 못했다')
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
  // /clear · /resume 흉내: 설정 훅은 아래에 없으니 테스트가 맨 아래에서 답한다
  on('classic.SessionStart', async () => ({}) as any)
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

async function start($: Engine, surface: 'terminal' | 'desktop' = 'terminal'): Promise<void> {
  await $.session.start({ cwd: '/', surface, isInteractive: true })
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

// 그림판 글(상태 줄 · 체력 · 마나 · 배낭)은 데스크톱 밴드에만 있다 — 터미널 밴드는 한 줄
async function bandText($: Engine, surface: 'terminal' | 'desktop' = 'desktop', props = BAND()): Promise<string> {
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

test('터미널 밴드는 그림 없이 한 줄, 몬스터가 보인다', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  const t = await $.ui.mount({ plugin: 'spellblade', surface: 'terminal', component: 'AbovePrompt', props: BAND() })
  expect(await t.find({ type: 'Raster' })).toBeFalsy()
  expect(await t.find({ type: 'Svg' })).toBeFalsy()
  expect(await t.find({ text: /🟢 슬라임 [▓░]{3}/ })).toBeTruthy()
  const d = await $.ui.mount({ plugin: 'spellblade', surface: 'desktop', component: 'AbovePrompt', props: BAND() })
  expect(await d.find({ type: 'Svg' })).toBeTruthy()
  expect(await d.find({ type: 'Raster' })).toBeFalsy()
})

test('좁으면 한 줄로 바뀐다', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'desktop', component: 'AbovePrompt', props: BAND({ bodyColumns: 50 }) })
  expect(await m.find({ type: 'Svg' })).toBeFalsy()
  expect(await m.find({ text: /Lv\.\d+ .* 오늘 \+/ })).toBeTruthy()
})

test('밴드가 낮아도 한 줄로 바뀐다', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'desktop', component: 'AbovePrompt', props: BAND({ maxRows: 5, scroll: { offset: 0, bodyRows: 5 } }) })
  expect(await m.find({ type: 'Svg' })).toBeFalsy()
})

test('다른 Mod 그림을 가리지 않는다', async ($, on) => {
  beneath(on, { now: NOON, bottomBand: '다른 모드' })
  await start($)
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'desktop', component: 'AbovePrompt', props: BAND() })
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
  expect(await m.find({ type: 'Svg' })).toBeTruthy()
  await m.press({ key: 'tab3' })
  expect(await m.find({ text: /모험 일지/ })).toBeTruthy()
})

test('터미널 카드는 큰 창에서만 장면', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  const big = await $.ui.mount({ plugin: 'spellblade', surface: 'terminal', component: 'Pane', requestId: 'spellblade', props: PANE({ bodyColumns: 160, scroll: { offset: 0, bodyRows: 50 } }) })
  const r = JSON.stringify(await big.find({ type: 'Raster' }))
  expect(r).toMatch(/"columns":160/)
  expect(r).toMatch(/"rows":32/)
  await big.unmount()
  const small = await $.ui.mount({ plugin: 'spellblade', surface: 'terminal', component: 'Pane', requestId: 'spellblade', props: PANE() })
  expect(await small.find({ type: 'Raster' })).toBeFalsy()
  expect(await small.find({ text: /승급의 길/ })).toBeTruthy()
})

test('데스크톱 카드 장면은 480×192', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'desktop', component: 'Pane', requestId: 'spellblade', props: PANE() })
  const svg = JSON.stringify(await m.find({ type: 'Svg' }))
  expect(svg).toMatch(/"width":480/)
  expect(svg).toMatch(/"height":192/)
})

test('일하는 동안 영창 프레임이 바뀐다', async ($, on) => {
  const { clock } = beneath(on, { now: NOON })
  await start($, 'desktop')
  await $.turn.start({ text: 'hi', turnId: 't' })
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'desktop', component: 'AbovePrompt', props: BAND() })
  const first = JSON.stringify(await m.find({ type: 'Svg' }))
  await clock.advance(400)
  const second = JSON.stringify(await m.find({ type: 'Svg' }))
  expect(second).not.toBe(first)
  expect(await m.find({ text: /마법을 두르는 중/ })).toBeTruthy()
})

test('턴이 끝나면 승리 문구', async ($, on) => {
  const { clock } = beneath(on, { now: NOON, store: { profile: { name: '렌', createdAt: 1, lastLevel: 1, titles: ['first'] } } })
  answerStep(on, 34_000)
  await start($)
  await oneTurn($)
  await clock.advance(800) // 마지막 단계의 마법 적중 0.7초 뒤에 승리
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'desktop', component: 'AbovePrompt', props: BAND() })
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
  const { clock } = beneath(on, { now: NOON })
  on('tool.call', async () => ({ result: 'boom', isError: true }))
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'false' } as any)
  await clock.advance(1_200) // Esc 중단인지 1초 기다린 뒤
  expect(await bandText($)).toMatch(/윽, 반격당했다/)
})

test('커밋 성공 +20', async ($, on) => {
  beneath(on, { now: NOON, store: { profile: { name: '렌', createdAt: 1, lastLevel: 1, titles: ['first'] } } })
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
  await clock.advance(3_300) // 1초 유예 뒤 반격 문구(2초)가 지나간 뒤
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
  const { clock, seen } = beneath(on, { now: NOON, store: { profile: { name: '렌', createdAt: 1, lastLevel: 1, titles: ['first'] } } })
  on('turn.step', async function* () {
    return { turnId: 't', index: 0, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: { input_tokens: 320, output_tokens: 2_140, cache_read_input_tokens: 410_000, cache_creation_input_tokens: 12_400, model: 'm' } }
  })
  await start($)
  await oneTurn($)
  expect(seen.store.get(`d:${TODAY}:me`)).toMatchObject({ in: 320, out: 2_140, cw: 12_400, cr: 410_000, turns: 1, fast: 1, clean: 1 })
  await clock.advance(800) // 마법 적중 0.7초 뒤에 승리
  const t = await bandText($)
  expect(t).toMatch(/✓ 승리 \+3 XP · 위력 3\.4k/)
  expect(t).not.toMatch(/기억|캐시/)
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

// ---- 2차 Task 9: 밴드 v2 · 연출 ----

test('measure 뒤 밴드에 체력(주간) · 마나(5시간)', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  await $.session.measure({ context: { window: 1_000_000, percent: 62 }, rateLimits: [{ kind: 'five_hour', percentUsed: 38 }, { kind: 'seven_day', percentUsed: 59 }], changed: ['rateLimits'] } as any)
  const t = await bandText($)
  expect(t).toMatch(/❤️ [▓░]+ 41%/)
  expect(t).toMatch(/🔷 [▓░]+ 62%/)
  expect(t).toMatch(/🎒 배낭 용량 62%/)
  expect(t).not.toMatch(/기억|캐시/)
})

test('한도가 없으면 체력 · 마나 줄을 숨긴다', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  const t = await bandText($)
  expect(t).not.toMatch(/❤️/)
  expect(t).not.toMatch(/🔷/)
})

test('그림판은 10줄 이상에서만', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  const low = await $.ui.mount({ plugin: 'spellblade', surface: 'desktop', component: 'AbovePrompt', props: BAND({ maxRows: 9, scroll: { offset: 0, bodyRows: 9 } }) })
  expect(await low.find({ type: 'Svg' })).toBeFalsy()
  const ok = await $.ui.mount({ plugin: 'spellblade', surface: 'desktop', component: 'AbovePrompt', props: BAND({ maxRows: 10, scroll: { offset: 0, bodyRows: 10 } }) })
  expect(await ok.find({ type: 'Svg' })).toBeTruthy()
})

test('레벨업 배너 3초', async ($, on) => {
  const { clock } = beneath(on, { now: NOON, store: { profile: { name: '렌', createdAt: 1, lastLevel: 1, titles: ['first'] } } })
  answerStep(on, 60_000)
  await start($)
  await oneTurn($)
  expect(await bandText($)).toMatch(/LEVEL UP!  Lv\.1 → Lv\.2/)
  await clock.advance(3_100)
  expect(await bandText($)).not.toMatch(/LEVEL UP/)
})

test('승급하면 배너와 카드 창', async ($, on) => {
  const { seen } = beneath(on, { now: NOON, store: { [`d:${YESTERDAY}:x`]: entry(959_000), profile: { name: '렌', createdAt: 1, lastLevel: 4, titles: ['first'] } } })
  answerStep(on, 1_000)
  await start($)
  await oneTurn($)
  expect(seen.opened).toContain('spellblade')
  expect(await bandText($)).toMatch(/승급!  수련생 → 검사/)
})

// ---- 2차 Task 10: 카드 창 탭 ----

async function openCard($: Engine, surface: 'terminal' | 'desktop' = 'desktop') {
  await $.command.run({ command: 'blade', args: '' })
  return $.ui.mount({ plugin: 'spellblade', surface, component: 'Pane', requestId: 'spellblade', props: PANE({ title: '마검사' }) })
}

test('탭 버튼이 셋', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  const m = await openCard($)
  for (const key of ['tab1', 'tab2', 'tab3']) expect(await m.find({ key })).toBeTruthy()
})

test('탭 버튼 이름에 대괄호가 없다', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  const m = await openCard($)
  expect(JSON.stringify(await m.find({ key: 'tab1' }))).toMatch(/"label":"상태"/)
})

test('이름표에 이름이 들어간다', async ($, on) => {
  beneath(on, { now: NOON })
  await start($, 'desktop')
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'desktop', component: 'AbovePrompt', props: BAND() })
  expect(JSON.stringify(await m.find({ type: 'Svg' }))).toMatch(/렌/)
})

test('상태 탭에 몬스터 체력', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  const m = await openCard($)
  expect(await m.find({ text: /🟢 슬라임 HP 300\/300/ })).toBeTruthy()
})

test('2 를 누르면 의뢰 탭', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  const m = await openCard($)
  await m.press({ key: 'tab2' })
  expect(await m.find({ text: /오늘의 의뢰/ })).toBeTruthy()
  expect(await m.find({ text: /🔥/ })).toBeTruthy()
  expect(await m.find({ text: /🔒/ })).toBeTruthy()
})

test('3 을 누르면 기록 탭 — 위력 · 마법 적중률을 게임 말로', async ($, on) => {
  beneath(on, { now: NOON })
  on('turn.step', async function* () {
    return { turnId: 't', index: 0, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: { input_tokens: 320, output_tokens: 2_140, cache_read_input_tokens: 410_000, cache_creation_input_tokens: 12_400, model: 'm' } }
  })
  await start($)
  await oneTurn($)
  const m = await openCard($)
  await m.press({ key: 'tab3' })
  expect(await m.find({ text: /이번 턴  💥 위력 3,412 → \+3 XP · 🎯 1발 중 1발 적중/ })).toBeTruthy()
  expect(await m.find({ text: /위력 = 시전 2,140 \+ 0\.1 × \(주문서 320 \+ 외워 둠 12,400\)/ })).toBeTruthy()
  expect(await m.find({ text: /오늘    💥 위력 3\.4k → \+3 XP · 🎯 마법 적중률 100% \(1발 중 1발\)/ })).toBeTruthy()
  expect(await m.find({ text: /🎒 배낭 용량 10%/ })).toBeTruthy()
  expect(JSON.stringify(await m.drawn())).not.toMatch(/캐시 재사용|캐시 읽기|캐시 쓰기|출력 /)
})

test('상태 탭: 장비 · 능력치 · 승급의 길 이름', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  const m = await openCard($, 'terminal')
  expect(await m.find({ text: /나무 검/ })).toBeTruthy()
  expect(await m.find({ text: /💪/ })).toBeTruthy()
  expect(await m.find({ text: /마검성 \(Lv\.45\)/ })).toBeTruthy()
  expect(await m.find({ text: /다음 장비: 철검/ })).toBeTruthy()
})

test('데스크톱 승급의 길은 작은 그림 다섯', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  const m = await openCard($)
  expect((await m.findAll({ type: 'Svg' })).length).toBeGreaterThanOrEqual(6)
})

test('/blade 로 다시 열면 상태 탭부터', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  const m = await openCard($)
  await m.press({ key: 'tab2' })
  await m.unmount()
  const again = await openCard($)
  expect(await again.find({ text: /승급의 길/ })).toBeTruthy()
})

// ---- 2차 Task 11 + 크기 통일: 데스크톱 그림 ----

test('데스크톱 밴드 장면은 320×128 이고 상태가 바뀌어도 같다', async ($, on) => {
  const { clock } = beneath(on, { now: NOON })
  toolMode = 'ok'
  answerTools(on)
  await start($, 'desktop')
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'desktop', component: 'AbovePrompt', props: BAND() })
  const size = async () => {
    const svg = JSON.stringify(await m.find({ type: 'Svg' }))
    return [(svg.match(/"width":(\d+)/) ?? [])[1], (svg.match(/"height":(\d+)/) ?? [])[1]].join('×')
  }
  const idle = await size()
  await $.turn.start({ text: 'hi', turnId: 't' })
  await clock.advance(400)
  const casting = await size()
  await $.tool.call({ tool: 'Bash', command: 'ls' } as any)
  const slashing = await size()
  await $.turn.complete({ turnId: 't', answer: '', durationMs: 1, isAborted: false, reason: 'answer' })
  await clock.advance(121_000)
  const resting = await size()
  expect(await m.find({ text: /모닥불 앞에서 쉬는 중/ })).toBeTruthy()
  expect([idle, casting, slashing, resting]).toEqual(['320×128', '320×128', '320×128', '320×128'])
})

// ---- 2차 Task 12: /blade title ----

const VETERAN_STORE = { [`d:${YESTERDAY}:x`]: { ...entry(5_000), swings: 1_000 } }

test('칭호 목록', async ($, on) => {
  beneath(on, { now: NOON, store: VETERAN_STORE })
  await start($)
  const text = await blade($, 'title')
  expect(text).toMatch(/얻은 칭호: 첫 걸음, 백전노장/)
})

test('칭호 고르기', async ($, on) => {
  const { seen } = beneath(on, { now: NOON, store: VETERAN_STORE })
  await start($)
  expect(await blade($, 'title 첫 걸음')).toBe('이제 「첫 걸음」을 달아요')
  expect(seen.store.get('profile')).toMatchObject({ title: 'first' })
  expect(await bandText($)).toMatch(/「첫 걸음」 렌/)
})

test('못 얻은 칭호는 고를 수 없다', async ($, on) => {
  beneath(on, { now: NOON, store: VETERAN_STORE })
  await start($)
  expect(await blade($, 'title 천검')).toBe('「천검」은 아직 얻지 못했어요')
  expect(await blade($, 'title 없는칭호')).toMatch(/그런 칭호는 없어요/)
})

test('얻은 칭호가 없으면 알려 준다', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  expect(await blade($, 'title')).toMatch(/아직 얻은 칭호가 없어요/)
})

// ---- 최종 검토(2차)에서 나온 것 ----

test('그림판은 84칸 이상에서만', async ($, on) => {
  beneath(on, { now: NOON })
  await start($)
  const narrow = await $.ui.mount({ plugin: 'spellblade', surface: 'desktop', component: 'AbovePrompt', props: BAND({ bodyColumns: 83 }) })
  expect(await narrow.find({ type: 'Svg' })).toBeFalsy()
  const wide = await $.ui.mount({ plugin: 'spellblade', surface: 'desktop', component: 'AbovePrompt', props: BAND({ bodyColumns: 84 }) })
  expect(await wide.find({ type: 'Svg' })).toBeTruthy()
})

test('동시에 여러 도구가 의뢰를 끝내도 토스트 · 일지는 한 번', async ($, on) => {
  const day = swingDay()
  const [y, m, d] = day.split('-').map(Number)
  const { seen } = beneath(on, { now: local(y, m - 1, d, 12, 0), store: { [`d:${day}:other`]: { ...entry(0), swings: 39 }, profile: { name: '렌', createdAt: 1, lastLevel: 1, titles: ['first'] } } })
  toolMode = 'ok'
  answerTools(on)
  await start($)
  await Promise.all([1, 2, 3].map(() => $.tool.call({ tool: 'Read', file_path: '/x' } as any)))
  expect(seen.toasts.filter(t => t.text.startsWith('📜')).length).toBe(1)
  const log = (seen.store.get('log') ?? []) as { kind?: string }[]
  expect(log.filter(l => l.kind === 'quest').length).toBe(1)
})

test('동시에 칭호를 얻어도 토스트는 한 번', async ($, on) => {
  const { seen } = beneath(on, { now: NOON, store: { [`d:${YESTERDAY}:x`]: { ...entry(5_000), swings: 998 }, profile: { name: '렌', createdAt: 1, lastLevel: 1, titles: ['first'] } } })
  toolMode = 'ok'
  answerTools(on)
  await start($)
  await Promise.all([1, 2, 3].map(() => $.tool.call({ tool: 'Read', file_path: '/x' } as any)))
  expect(seen.toasts.filter(t => t.text.startsWith('🏅')).map(t => t.text)).toEqual(['🏅 칭호 「백전노장」을 얻었어요'])
})

test('칭호 토스트 조사(을/를)', async ($, on) => {
  const { seen } = beneath(on, { now: NOON, store: { profile: { name: '렌', createdAt: 1, lastLevel: 1, titles: ['first'] } } })
  toolMode = 'ok'
  answerTools(on)
  await start($)
  for (let i = 0; i < 30; i++) await $.tool.call({ tool: 'Read', file_path: '/x' } as any)
  expect(seen.toasts.map(t => t.text)).toContain('🏅 칭호 「콤보 마스터」를 얻었어요')
})

test('의뢰 보상으로 레벨이 오르면 레벨업', async ($, on) => {
  const day = swingDay()
  const [y, m, d] = day.split('-').map(Number)
  const { seen } = beneath(on, { now: local(y, m - 1, d, 12, 0), store: { [`d:${day}:other`]: { ...entry(50_000), swings: 39 }, profile: { name: '렌', createdAt: 1, lastLevel: 1, titles: ['first'], questsFrom: '2000-01-01' } } })
  toolMode = 'ok'
  answerTools(on)
  await start($)
  await $.tool.call({ tool: 'Read', file_path: '/x' } as any)
  expect(seen.toasts.map(t => t.text)).toContain('⬆ 렌 Lv.2!')
  expect(seen.store.get('profile')).toMatchObject({ lastLevel: 2 })
})

test('의뢰를 끝내면 상태 문구에도 2초', async ($, on) => {
  const day = swingDay()
  const [y, m, d] = day.split('-').map(Number)
  beneath(on, { now: local(y, m - 1, d, 12, 0), store: { [`d:${day}:other`]: { ...entry(0), swings: 39 }, profile: { name: '렌', createdAt: 1, lastLevel: 1, titles: ['first'] } } })
  toolMode = 'ok'
  answerTools(on)
  await start($)
  await $.tool.call({ tool: 'Read', file_path: '/x' } as any)
  expect(await bandText($)).toMatch(/📜 의뢰 완료! 베기 40번/)
})

test('2.0 을 처음 켜도 지난날 경험치는 그대로', async ($, on) => {
  // 1.0 저장소: 지난 닷새 동안 베기가 많았다 — 그날들의 의뢰 보상을 소급하지 않는다
  const store: Record<string, unknown> = { profile: { name: '렌', createdAt: 1, lastLevel: 5 } }
  for (let i = 1; i <= 5; i++) store[`d:${dayKey(NOON - i * 86_400_000, TZ)}:x`] = { w: 200_000, bonus: 0, swings: 500, updatedAt: 1 }
  const { seen } = beneath(on, { now: NOON, store })
  await start($)
  // 1,000 XP → Lv.5 (960), 다음 레벨(1,500)까지 500
  expect(await bandText($)).toMatch(/다음 레벨까지 500 XP/)
  expect(seen.store.get('profile')).toMatchObject({ questsFrom: TODAY, lastLevel: 5 })
})

test('의뢰 시작일 뒤의 지난날 보상은 센다', async ($, on) => {
  const day = swingDay()
  const next = new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
  const [y, m, d] = next.split('-').map(Number)
  beneath(on, { now: local(y, m - 1, d, 12, 0), store: { [`d:${day}:x`]: { ...entry(0), swings: 40 }, profile: { name: '렌', createdAt: 1, lastLevel: 1, titles: [], questsFrom: day } } })
  await start($)
  expect(await bandText($)).toMatch(/다음 레벨까지 30 XP/)
})

test('reset 하면 내 세션 몫도 지운다', async ($, on) => {
  const { seen } = beneath(on, { now: NOON, store: { [`d:${TODAY}:me`]: entry(500_000), [`q:${TODAY}`]: [0] } })
  answerAsk(on, '처음부터')
  await start($)
  expect(await blade($, 'reset')).toMatch(/처음부터/)
  await $.turn.complete({ turnId: 't', answer: '', durationMs: 1, isAborted: false, reason: 'answer' })
  expect(await bandText($)).toMatch(/Lv\.1\/60/)
  expect(((seen.store.get(`d:${TODAY}:me`) ?? { w: 0 }) as { w: number }).w).toBe(0)
  expect(seen.store.get(`q:${TODAY}`) ?? []).toEqual([]) // 지난 의뢰 알림 기록은 지워졌다
})

test('승급하면 카드 창은 상태 탭으로 열린다', async ($, on) => {
  beneath(on, { now: NOON, store: { [`d:${YESTERDAY}:x`]: entry(959_000), profile: { name: '렌', createdAt: 1, lastLevel: 4, titles: ['first'] } } })
  answerStep(on, 1_000)
  await start($)
  const m = await openCard($)
  await m.press({ key: 'tab3' })
  await m.unmount()
  await oneTurn($)
  const again = await $.ui.mount({ plugin: 'spellblade', surface: 'desktop', component: 'Pane', requestId: 'spellblade', props: PANE() })
  expect(await again.find({ text: /승급의 길/ })).toBeTruthy()
})

test('기록 탭에 이 세션 줄', async ($, on) => {
  beneath(on, { now: NOON })
  answerStep(on, 2_000)
  await start($)
  await oneTurn($)
  const m = await openCard($)
  await m.press({ key: 'tab3' })
  expect(await m.find({ text: /이 세션  💥 위력 2k → \+2 XP · 🎯 1발 중 1발 적중/ })).toBeTruthy()
})

// ---- 2.0.2: 미룬 작은 것 ----

test('한도 창이 끝나면 다음 measure 전에도 회복한다', async ($, on) => {
  const { clock } = beneath(on, { now: NOON })
  await start($)
  const at = new Date(NOON + 30 * 60_000).toISOString()
  await $.session.measure({ context: { window: 1_000_000, percent: 40 }, rateLimits: [{ kind: 'five_hour', percentUsed: 100, resetsAt: at }, { kind: 'seven_day', percentUsed: 30 }], changed: ['rateLimits'] } as any)
  expect(await bandText($)).toMatch(/마나 소진 — 30분 뒤 회복/)
  await clock.advance(31 * 60_000)
  const t = await bandText($)
  expect(t).not.toMatch(/마나 소진/)
  expect(t).toMatch(/🔷 [▓░]+ 100%/)
})

test('토큰 수가 이상해도 그날 칸이 망가지지 않는다', async ($, on) => {
  const { seen } = beneath(on, { now: NOON })
  on('turn.step', async function* () {
    return { turnId: 't', index: 0, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: { input_tokens: NaN, output_tokens: 2_000, cache_read_input_tokens: undefined, cache_creation_input_tokens: 0, model: 'm' } as any }
  })
  await start($)
  await oneTurn($)
  const stored = seen.store.get(`d:${TODAY}:me`)
  expect(isEntry(stored)).toBe(true)
  expect(stored).toMatchObject({ w: 2_000, out: 2_000, in: 0, cr: 0 })
  expect(await bandText($)).not.toMatch(/NaN/)
})

test('턴 끝 알림 저장이 실패해도 턴 기록은 바로 저장된다', async ($, on) => {
  const DAWN = local(2026, 9, 16, 3, 0)
  const opts: BeneathOpts = { now: DAWN, store: { profile: { name: '렌', createdAt: 1, lastLevel: 1, titles: ['first'] } } }
  const { seen } = beneath(on, opts)
  await start($)
  opts.failMeta = true
  // 새벽 턴 → 칭호 「새벽의 검사」를 profile 에 쓰려다 실패한다
  await $.turn.start({ text: 'hi', turnId: 't' })
  await $.turn.complete({ turnId: 't', answer: '', durationMs: 1, isAborted: false, reason: 'answer' })
  expect(seen.store.get(`d:${dayKey(DAWN, TZ)}:me`)).toMatchObject({ turns: 1, night: 1 })
})

test('오류 난 도구는 최고 콤보에 들어가지 않는다', async ($, on) => {
  const { seen } = beneath(on, { now: NOON })
  answerTools(on)
  await start($)
  toolMode = 'ok'
  for (let i = 0; i < 2; i++) await $.tool.call({ tool: 'Read', file_path: '/x' } as any)
  toolMode = 'error'
  await $.tool.call({ tool: 'Bash', command: 'false' } as any)
  toolMode = 'ok'
  await $.turn.complete({ turnId: 't', answer: '', durationMs: 1, isAborted: false, reason: 'answer' })
  expect(seen.store.get(`d:${TODAY}:me`)).toMatchObject({ combo: 2 })
})

test('중단 · 오류 · 거절로 끝난 턴은 턴 기록에 넣지 않는다', async ($, on) => {
  const { seen } = beneath(on, { now: NOON })
  await start($)
  const ends = [
    { isAborted: true, reason: 'aborted' },
    { isAborted: false, reason: 'error' },
    { isAborted: false, reason: 'refusal', refusal: { category: null, explanation: null } },
  ]
  for (const end of ends) {
    await $.turn.start({ text: 'hi', turnId: 't' })
    await $.turn.complete({ turnId: 't', answer: '', durationMs: 1, ...end } as any)
  }
  const e = (seen.store.get(`d:${TODAY}:me`) ?? {}) as Record<string, number>
  expect([e.turns ?? 0, e.fast ?? 0, e.clean ?? 0]).toEqual([0, 0, 0])
})

test('반격이 있었던 중단 턴은 「반격 없이 연속」을 끊는다', async ($, on) => {
  const { clock, seen } = beneath(on, { now: NOON })
  answerTools(on)
  await start($)
  const answered = async () => {
    await $.turn.start({ text: 'hi', turnId: 't' })
    await $.turn.complete({ turnId: 't', answer: '', durationMs: 1, isAborted: false, reason: 'answer' })
  }
  await answered()
  await answered()
  await $.turn.start({ text: 'hi', turnId: 't' })
  toolMode = 'error'
  await $.tool.call({ tool: 'Bash', command: 'false' } as any)
  toolMode = 'ok'
  await clock.advance(1_200) // 1초가 지나 반격이 된 오류(Esc 가 낸 오류가 아님)
  await $.turn.complete({ turnId: 't', answer: '', durationMs: 1, isAborted: true, reason: 'aborted' })
  await answered()
  await answered()
  expect(seen.store.get(`d:${TODAY}:me`)).toMatchObject({ turns: 4, clean: 2 })
})

test('자정이 지나면 콤보와 「반격 없이 연속」을 새로 센다', async ($, on) => {
  const NIGHT = local(2026, 9, 16, 23, 59)
  const { clock, seen } = beneath(on, { now: NIGHT })
  answerTools(on)
  await start($)
  toolMode = 'ok'
  const answered = async () => {
    await $.turn.start({ text: 'hi', turnId: 't' })
    await $.turn.complete({ turnId: 't', answer: '', durationMs: 1, isAborted: false, reason: 'answer' })
  }
  await answered()
  await answered()
  for (let i = 0; i < 3; i++) await $.tool.call({ tool: 'Read', file_path: '/x' } as any)
  await clock.advance(120_000) // 자정을 넘긴다
  await $.tool.call({ tool: 'Read', file_path: '/x' } as any)
  await answered()
  expect(seen.store.get(`d:${dayKey(NIGHT + 120_000, TZ)}:me`)).toMatchObject({ combo: 1, clean: 1 })
})

test('/clear 로 새 세션이 되면 콤보 · 연속 · 이 세션 기록을 새로 센다', async ($, on) => {
  const opts: BeneathOpts = { now: NOON }
  const { seen } = beneath(on, opts)
  answerTools(on)
  answerStep(on, 2_000)
  await start($)
  toolMode = 'ok'
  await oneTurn($)
  for (let i = 0; i < 3; i++) await $.tool.call({ tool: 'Read', file_path: '/x' } as any)
  opts.sid = 'next'
  await $.classic.SessionStart({ source: 'clear' })
  await $.tool.call({ tool: 'Read', file_path: '/x' } as any)
  await $.turn.complete({ turnId: 't', answer: '', durationMs: 1, isAborted: false, reason: 'answer' })
  expect(seen.store.get(`d:${TODAY}:next`)).toMatchObject({ combo: 1, clean: 1 })
  const m = await openCard($)
  await m.press({ key: 'tab3' })
  expect(await m.find({ text: /이 세션  아직 기록이 없어요/ })).toBeTruthy()
})

test('어제 몫이 늦게 저장돼도 60초 안에 합계에 들어간다', async ($, on) => {
  const { clock, seen } = beneath(on, { now: NOON })
  await start($)
  seen.store.set(`d:${YESTERDAY}:late`, entry(960_000)) // 다른 창이 자정 전 몫을 늦게 저장했다
  await clock.advance(60_000)
  expect(await bandText($)).toMatch(new RegExp(`Lv\\.${levelOf(960)}(?!\\d)`))
})

// ---- 3차 Task 1: 2.0.2 검토에서 넘긴 것 ----

test('자정에 걸친 도구 호출은 어제 콤보를 새 날 칸에 적지 않는다', async ($, on) => {
  const START = local(2026, 9, 16, 23, 59) + 58_000
  const { clock, seen } = beneath(on, { now: START })
  let calls = 0
  let release: () => void = () => {}
  const gate = new Promise<void>(r => { release = r })
  on('tool.call', async () => {
    calls++
    if (calls === 4) await gate
    return { result: 'ok' }
  })
  await start($)
  for (let i = 0; i < 3; i++) await $.tool.call({ tool: 'Read', file_path: '/x' } as any)
  const pending = $.tool.call({ tool: 'Read', file_path: '/x' } as any)
  await clock.advance(5_000) // 자정을 넘긴다
  release()
  await pending
  await $.turn.complete({ turnId: 't', answer: '', durationMs: 1, isAborted: false, reason: 'answer' })
  expect(seen.store.get(`d:${dayKey(START + 5_000, TZ)}:me`)).toMatchObject({ combo: 1 })
})

test('병렬 호출에서 최고 콤보는 성공으로 끝난 것만 센다', async ($, on) => {
  const { seen } = beneath(on, { now: NOON })
  let release: () => void = () => {}
  const gate = new Promise<void>(r => { release = r })
  on('tool.call', async (_$, e: any) => {
    if (e.tool === 'Bash') { await gate; return { result: 'boom', isError: true } }
    return { result: 'ok' }
  })
  await start($)
  const bash = $.tool.call({ tool: 'Bash', command: 'false' } as any)
  await $.tool.call({ tool: 'Read', file_path: '/x' } as any)
  release()
  await bash
  await $.turn.complete({ turnId: 't', answer: '', durationMs: 1, isAborted: false, reason: 'answer' })
  expect(seen.store.get(`d:${TODAY}:me`)).toMatchObject({ combo: 1 })
})

test('자정 뒤 호출이 없으면 의뢰 탭 콤보는 0', async ($, on) => {
  const { clock } = beneath(on, { now: local(2026, 9, 16, 23, 59) })
  toolMode = 'ok'
  answerTools(on)
  await start($)
  for (let i = 0; i < 3; i++) await $.tool.call({ tool: 'Read', file_path: '/x' } as any)
  await clock.advance(120_000)
  const m = await openCard($)
  await m.press({ key: 'tab2' })
  expect(await m.find({ text: /💥 콤보 ×0 / })).toBeTruthy()
})

test('/clear 뒤 배낭 용량은 다음 measure 전까지 비운다', async ($, on) => {
  const opts: BeneathOpts = { now: NOON }
  beneath(on, opts)
  await start($)
  await $.session.measure({ context: { window: 1_000_000, percent: 85 }, rateLimits: [], changed: ['context'] } as any)
  expect(await bandText($)).toMatch(/배낭 용량 85%/)
  opts.sid = 'next'
  await $.classic.SessionStart({ source: 'clear' })
  expect(await bandText($)).not.toMatch(/배낭 용량 85%/)
})

test('쉬는 동안에도 리셋 남은 시간이 바뀐다', async ($, on) => {
  const { clock } = beneath(on, { now: NOON, limits: [{ kind: 'seven_day', percentUsed: 30, resetsAt: new Date(NOON + 2 * 3_600_000).toISOString() }] })
  await start($)
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'desktop', component: 'AbovePrompt', props: BAND() })
  await clock.advance(31 * 60_000) // 30분 넘게 쉬어 자는 자세(자세 · 문구가 더 바뀌지 않음)
  expect(await m.find({ text: /1:29/ })).toBeTruthy()
  await clock.advance(10 * 60_000)
  expect(await m.find({ text: /1:19/ })).toBeTruthy()
})

test('도구 없이 자정을 넘긴 턴은 「반격 없이 연속」을 새로 센다', async ($, on) => {
  const NIGHT = local(2026, 9, 16, 23, 58)
  const { clock, seen } = beneath(on, { now: NIGHT })
  await start($)
  const answered = async () => {
    await $.turn.start({ text: 'hi', turnId: 't' })
    await $.turn.complete({ turnId: 't', answer: '', durationMs: 1, isAborted: false, reason: 'answer' })
  }
  await answered()
  await answered()
  await clock.advance(180_000)
  await answered()
  expect(seen.store.get(`d:${dayKey(NIGHT + 180_000, TZ)}:me`)).toMatchObject({ clean: 1 })
})

test('어제 키가 지워지면 합계에서도 빠진다', async ($, on) => {
  const { clock, seen } = beneath(on, { now: NOON, store: { [`d:${YESTERDAY}:x`]: entry(960_000) } })
  await start($)
  expect(await bandText($)).toMatch(new RegExp(`Lv\\.${levelOf(960)}(?!\\d)`))
  seen.store.delete(`d:${YESTERDAY}:x`)
  await clock.advance(60_000)
  expect(await bandText($)).toMatch(/Lv\.1(?!\d)/)
})

test('/clear 뒤 기록 탭 「이번 턴」은 비어 있다', async ($, on) => {
  const opts: BeneathOpts = { now: NOON }
  beneath(on, opts)
  answerStep(on, 2_000)
  await start($)
  await oneTurn($)
  opts.sid = 'next'
  await $.classic.SessionStart({ source: 'clear' })
  const m = await openCard($)
  await m.press({ key: 'tab3' })
  expect(await m.find({ text: /이번 턴 기록이 아직 없어요/ })).toBeTruthy()
})

// ---- 3차 Task 9: 전투 · 영창 · 휴식 ----

function answerUsage(on: On, u: Partial<ReturnType<typeof usage>>) {
  on('turn.step', async function* () {
    return { turnId: 't', index: 0, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: { ...usage(0), ...u } }
  })
}

test('도구를 부르면 몬스터 체력이 준다', async ($, on) => {
  beneath(on, { now: NOON })
  toolMode = 'ok'
  answerTools(on)
  await start($)
  await $.tool.call({ tool: 'Read', file_path: '/x' } as any)
  expect(await cardText($)).toMatch(/🟢 슬라임 HP 282\/300/)
})

test('몬스터를 잡으면 연기 뒤 새 슬라임', async ($, on) => {
  const { clock } = beneath(on, { now: NOON })
  toolMode = 'ok'
  answerTools(on)
  await start($)
  for (let i = 0; i < 17; i++) await $.tool.call({ tool: 'Read', file_path: '/x' } as any)
  expect(await cardText($)).toMatch(/HP 0\/300/)
  await clock.advance(1_300)
  expect(await cardText($)).toMatch(/🟢 슬라임 HP 300\/300/)
})

test('캐시 재사용이 낮으면 캐스팅 실패', async ($, on) => {
  beneath(on, { now: NOON, store: { profile: { name: '렌', createdAt: 1, lastLevel: 1, titles: ['first'] } } }) // 첫 칭호 알림이 덮지 않게
  answerUsage(on, { input_tokens: 10_000, cache_read_input_tokens: 100 })
  await start($)
  await $.turn.start({ text: 'hi', turnId: 't' })
  await run($.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1 }))
  expect(await bandText($)).toMatch(/주문이 꼬였다/)
  expect(await cardText($)).toMatch(/HP 300\/300/)
})

test('캐시 재사용이 높으면 마법 적중', async ($, on) => {
  beneath(on, { now: NOON })
  answerUsage(on, { output_tokens: 500, input_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 50_000 })
  await start($)
  await $.turn.start({ text: 'hi', turnId: 't' })
  await run($.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1 }))
  expect(await bandText($)).toMatch(/마법 적중/)
  expect(await cardText($)).toMatch(/HP 249\/300/)
})

test('서브에이전트 단계는 연출 없이 XP 만', async ($, on) => {
  // 첫 XP 의 칭호 알림(전리품, 순위 3)이 마법 연출(순위 0)을 가리지 않게 첫 칭호를 이미 가진 프로필로
  beneath(on, { now: NOON, store: { profile: { name: '렌', createdAt: 1, lastLevel: 1, titles: ['first'] } } })
  answerUsage(on, { output_tokens: 34_000, input_tokens: 10_000 })
  await start($)
  await $.turn.start({ text: 'hi', turnId: 't' })
  await run($.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1, agentId: 'a' } as any))
  const band = await bandText($)
  expect(band).not.toMatch(/마법 적중|주문이 꼬였다/)
  expect(band).toMatch(/오늘 \+35 XP/)
  expect(await cardText($)).toMatch(/🟢 슬라임 HP 300\/300/)
})

test('Esc 로 끊긴 도구는 반격이 아니다', async ($, on) => {
  const { clock, seen } = beneath(on, { now: NOON })
  toolMode = 'ok'
  answerTools(on)
  answerStep(on, 1_000)
  await start($)
  await oneTurn($)
  await $.turn.start({ text: 'b', turnId: 't2' })
  toolMode = 'error'
  await $.tool.call({ tool: 'Bash', command: 'sleep 9' } as any)
  await clock.advance(500)
  await $.turn.complete({ turnId: 't2', answer: '', durationMs: 1, isAborted: true, reason: 'aborted' })
  await clock.advance(1_500)
  expect(await bandText($)).not.toMatch(/반격/)
  toolMode = 'ok'
  await oneTurn($)
  expect(seen.store.get(`d:${TODAY}:me`)).toMatchObject({ clean: 2 })
})

test('그냥 오류는 1초 뒤 반격', async ($, on) => {
  const { clock } = beneath(on, { now: NOON })
  toolMode = 'error'
  answerTools(on)
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'false' } as any)
  expect(await bandText($)).not.toMatch(/반격당했다/)
  await clock.advance(1_200)
  expect(await bandText($)).toMatch(/윽, 반격당했다/)
})

test('레벨 5 가 되면 다음 몬스터는 달팽이', async ($, on) => {
  const { clock } = beneath(on, { now: NOON, store: { [`d:${YESTERDAY}:x`]: entry(959_000) } })
  toolMode = 'ok'
  answerTools(on)
  answerStep(on, 1_000)
  await start($)
  await oneTurn($)
  expect(await cardText($)).toMatch(/🟢 슬라임/)
  for (let i = 0; i < 17; i++) await $.tool.call({ tool: 'Read', file_path: '/x' } as any)
  await clock.advance(1_300)
  expect(await cardText($)).toMatch(/🐌 달팽이 HP 400\/400/)
})

test('높은 레벨로 켜면 그 단계 몬스터로 시작한다', async ($, on) => {
  beneath(on, { now: NOON, store: { [`d:${YESTERDAY}:x`]: entry(77_000_000) } })
  await start($)
  expect(await cardText($)).toMatch(/🗿 골렘 HP 2,250\/2,250/)
})

test('턴이 끝나고 2분 뒤 모닥불', async ($, on) => {
  const { clock } = beneath(on, { now: NOON })
  answerStep(on, 1_000)
  await start($)
  await oneTurn($)
  await clock.advance(119_000)
  expect(await bandText($)).not.toMatch(/모닥불/)
  await clock.advance(2_000)
  expect(await bandText($)).toMatch(/모닥불 앞에서 쉬는 중/)
})

test('아무 일 없으면 다시 그리지 않는다', async ($, on) => {
  const { clock } = beneath(on, { now: NOON })
  let n = 0
  on('ui.invalidate', async () => { n++; return { value: undefined } })
  await start($)
  await clock.advance(121_000) // 모닥불
  n = 0
  await clock.advance(10_000)
  expect(n).toBeLessThanOrEqual(13) // 모닥불 흔들림(0.8초)만
  await clock.advance(31 * 60_000) // 잠들면 모닥불도 멈춘다
  n = 0
  await clock.advance(10_000)
  expect(n).toBe(0)
})

test('reset 하면 몬스터도 처음부터', async ($, on) => {
  beneath(on, { now: NOON, store: { [`d:${YESTERDAY}:x`]: entry(77_000_000) } })
  answerAsk(on, '처음부터')
  await start($)
  expect(await cardText($)).toMatch(/🗿 골렘/)
  await blade($, 'reset')
  expect(await cardText($)).toMatch(/🟢 슬라임 HP 300\/300/)
})

// 엔진은 터진 그리기 훅을 건너뛰고 아래 것만 그린다 — 우리 글이 실제로 나왔는지 본다(2.0 부터 있던 「Invalid Date」)
test('불러오기 전에 그려도 터지지 않는다', async ($, on) => {
  beneath(on, { now: NOON })
  const band = await $.ui.mount({ plugin: 'spellblade', surface: 'terminal', component: 'AbovePrompt', props: BAND() })
  expect(JSON.stringify(await band.drawn())).toMatch(/불러오는 중/)
  const desk = await $.ui.mount({ plugin: 'spellblade', surface: 'desktop', component: 'AbovePrompt', props: BAND() })
  expect(JSON.stringify(await desk.drawn())).toMatch(/불러오는 중/)
  const card = await $.ui.mount({ plugin: 'spellblade', surface: 'desktop', component: 'Pane', requestId: 'spellblade', props: PANE() })
  expect(JSON.stringify(await card.drawn())).toMatch(/불러오는 중/)
  await start($)
  expect(JSON.stringify(await band.drawn())).toMatch(/Lv\.1/)
})

test('턴 끝 승리는 마지막 단계의 캐스팅 실패 뒤에 이어진다', async ($, on) => {
  const { clock } = beneath(on, { now: NOON, store: { profile: { name: '렌', createdAt: 1, lastLevel: 1, titles: ['first'] } } })
  answerUsage(on, { input_tokens: 10_000, cache_read_input_tokens: 100 })
  await start($)
  await oneTurn($)
  expect(await bandText($)).toMatch(/주문이 꼬였다/)
  await clock.advance(800)
  expect(await bandText($)).toMatch(/✓ 승리/)
})

// Esc 로 끊으면 엔진은 도구 훅을 기다리지 않고 턴을 끝낼 수 있다 — 끊긴 도구의 오류가 턴 끝 뒤에 도착해도 반격이 아니다
function gatedError(on: On): () => void {
  let release: () => void = () => {}
  const gate = new Promise<void>(r => { release = r })
  on('tool.call', async () => {
    await gate
    return { result: 'interrupted', isError: true }
  })
  return () => release()
}

test('Esc 뒤 늦게 도착한 도구 오류도 반격이 아니다', async ($, on) => {
  const { clock, seen } = beneath(on, { now: NOON })
  const release = gatedError(on)
  answerStep(on, 1_000)
  await start($)
  await oneTurn($)
  await $.turn.start({ text: 'b', turnId: 't2' })
  const call = $.tool.call({ tool: 'Bash', command: 'sleep 30' } as any)
  await new Promise(r => setTimeout(r, 0))
  await $.turn.complete({ turnId: 't2', answer: '', durationMs: 1, isAborted: true, reason: 'aborted' })
  release()
  await call
  await clock.advance(1_500)
  expect(await bandText($)).not.toMatch(/반격/)
  await oneTurn($)
  expect(seen.store.get(`d:${TODAY}:me`)).toMatchObject({ clean: 2 })
})

test('Esc 뒤 새 턴에 도착한 늦은 오류도 그 턴을 깨지 않는다', async ($, on) => {
  const { clock, seen } = beneath(on, { now: NOON })
  const release = gatedError(on)
  answerStep(on, 1_000)
  await start($)
  await oneTurn($)
  await $.turn.start({ text: 'b', turnId: 't2' })
  const call = $.tool.call({ tool: 'Bash', command: 'sleep 30' } as any)
  await new Promise(r => setTimeout(r, 0))
  await $.turn.complete({ turnId: 't2', answer: '', durationMs: 1, isAborted: true, reason: 'aborted' })
  await $.turn.start({ text: 'c', turnId: 't' })
  release()
  await call
  await clock.advance(1_200)
  await run($.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1 }))
  await $.turn.complete({ turnId: 't', answer: '', durationMs: 1, isAborted: false, reason: 'answer' })
  expect(seen.store.get(`d:${TODAY}:me`)).toMatchObject({ clean: 2 })
})

test('자정에 다시 불러와도 쉬던 마검사는 그대로 쉰다', async ($, on) => {
  const { clock } = beneath(on, { now: local(2026, 9, 16, 23, 20) })
  await start($)
  await clock.advance(31 * 60_000) // 23:51 — 잠
  expect(await bandText($)).toMatch(/Zzz/)
  await clock.advance(10 * 60_000) // 00:01 — 날이 바뀌어 다시 불러온다
  expect(await bandText($)).toMatch(/Zzz/)
})

test('마법 쏜 수 · 적중 수가 그날 칸에 남는다(서브에이전트는 세지 않음)', async ($, on) => {
  const { seen } = beneath(on, { now: NOON, store: { profile: { name: '렌', createdAt: 1, lastLevel: 1, titles: ['first'] } } })
  let reuse = 'low'
  on('turn.step', async function* () {
    const u = reuse === 'low' ? { input_tokens: 10_000, cache_read_input_tokens: 100 } : { input_tokens: 100, cache_read_input_tokens: 50_000 }
    return { turnId: 't', index: 0, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: { ...usage(0), ...u } }
  })
  await start($)
  await oneTurn($)
  expect(seen.store.get(`d:${TODAY}:me`)).toMatchObject({ casts: 1, hits: 0 })
  reuse = 'high'
  await oneTurn($)
  await $.turn.start({ text: 'hi', turnId: 't' })
  await run($.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1, agentId: 'a' } as any))
  await $.turn.complete({ turnId: 't', answer: '', durationMs: 1, isAborted: false, reason: 'answer' })
  expect(seen.store.get(`d:${TODAY}:me`)).toMatchObject({ casts: 2, hits: 1 })
})

