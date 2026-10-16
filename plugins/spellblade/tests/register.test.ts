import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import type { On } from 'claude-code'

// 스트림을 끝까지 읽고 결과를 돌려준다
async function run<R>(stream: AsyncGenerator<unknown, R> & { result: Promise<R> }): Promise<R> {
  for await (const _ of stream) { /* chunks */ }
  return stream.result
}

type Seen = { commands: string[]; toasts: { text: string; timeoutMs?: number }[]; opened: string[] }

// 키트에는 엔진이 없어서 플러그인이 부르는 $ 호출에 테스트가 맨 아래에서 답한다.
// 테스트의 훅은 모두 첫 $ 호출 전에 걸어야 하므로: beneath → (테스트 훅) → start
function beneath(on: On, opts: { now?: number; store?: Record<string, unknown>; sid?: string } = {}): { clock: MockClock; seen: Seen } {
  const clock = mock.clock(on, { now: opts.now ?? Date.UTC(2026, 9, 16, 3, 0) })
  mock.store(on, opts.store ?? {})
  const seen: Seen = { commands: [], toasts: [], opened: [] }
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  // $ 메서드(op 이벤트)의 답은 { value } 로 준다
  on('session.id', async () => ({ value: opts.sid ?? 'me' }))
  on('ui.invalidate', async () => ({ value: undefined }))
  on('command.register', async (_$, e) => { seen.commands.push(e.name); return { value: { command: e.name } } })
  on('ui.toast', async (_$, e) => { seen.toasts.push({ text: e.text, timeoutMs: e.timeoutMs }); return { value: undefined } })
  on('ui.open', async (_$, e) => { seen.opened.push(e.id); return { value: { isPlaced: true as const } } })
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

// 맨 아래 스피너 그림을 테스트가 정한다(키트의 기본 그림에 기대지 않음)
function plainSpinner(on: On) {
  on('ui.render', { component: 'Spinner' }, async ($, e) => {
    const { Text } = $.ui.resolve(e)
    return Text({ children: [e.props.word + e.props.suffix] })
  })
}

const SPINNER = { word: 'Forging', message: null, suffix: '…', mode: 'responding' as const }

test('turn.step 사용량이 이번 턴 XP 로 쌓인다', async ($, on) => {
  beneath(on)
  plainSpinner(on)
  answerStep(on, 34000)
  await start($)
  await $.turn.start({ text: 'hi', turnId: 't' })
  await run($.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1 }))
  const m = await $.ui.mount({ plugin: 'spellblade', surface: 'terminal', component: 'Spinner', props: SPINNER })
  expect(await m.find({ text: /Forging….*\+34xp/ })).toBeTruthy()
})

test('새 턴이 시작되면 이번 턴 XP 는 0 부터', async ($, on) => {
  beneath(on)
  plainSpinner(on)
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
