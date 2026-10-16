import type { EngineInterface, Register } from 'claude-code'
import { progressOf, weightOf, xpOf } from './lib/progress.ts'
import { HEIGHT, WIDTH, type Grid } from './lib/sprites.ts'
import { gridToRaster } from './lib/to-raster.ts'
import { gridToSvg } from './lib/to-svg.ts'
import { spinnerSuffix } from './lib/views.ts'

// 이 세션이 쌓은 가중 토큰 W 와 이번 턴 W
let sessionW = 0
let turnW = 0
let working = false

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
  const tz = new Date().getTimezoneOffset()
  const native = 'toBase64' in Uint8Array.prototype
  return `session=${id} surface=${surface} surfaces=${surfaces.join(',')} tz=${tz} toBase64=${native}`
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    const out = await next(e)
    await registerCommand($)
    return out
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
      sessionW += w
      turnW += w
      $.ui.invalidate('ui.render')
    }
    return result
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) working = false
    return next(e)
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const suffix = e.props.suffix + spinnerSuffix(progressOf(xpOf(sessionW, 0)), Math.floor(turnW / 1000))
    return next({ ...e, props: { ...e.props, suffix } })
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
