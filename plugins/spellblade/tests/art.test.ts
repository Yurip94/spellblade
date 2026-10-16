import { expect, test } from 'claude-code/testing'
import { EFFECTS, frameFor, POSES, STAGE_LOOKS } from '../hooks/lib/art.ts'
import { gridErrors, HEIGHT, WIDTH } from '../hooks/lib/sprites.ts'
import { gridToSvg } from '../hooks/lib/to-svg.ts'

const STAGES_ = ['trainee', 'swordsman', 'spellblade', 'knight', 'saint'] as const
const POSES_ = ['idle', 'blink', 'cast1', 'cast2', 'slash', 'victory', 'hit', 'levelup', 'sleep'] as const

test('모든 단계 × 자세가 올바른 격자', async () => {
  for (const s of STAGES_) for (const p of POSES_) {
    const f = frameFor(s, p)
    expect(gridErrors(f.grid, f.palette)).toEqual([])
  }
})

test('자세 · 효과 격자 크기', async () => {
  for (const g of [...Object.values(POSES), ...Object.values(EFFECTS)]) {
    expect(g.length).toBe(HEIGHT)
    for (const r of g) expect(r.length).toBe(WIDTH)
  }
})

test('단계마다 팔레트 12색 이하', async () => {
  for (const s of STAGES_) expect(Object.keys(STAGE_LOOKS[s].palette).length).toBeLessThanOrEqual(12)
})

// 두 그림이 색으로 몇 칸 다른지
function diff(a: ReturnType<typeof frameFor>, b: ReturnType<typeof frameFor>): number {
  let n = 0
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const ca = a.grid[y][x] === '.' ? -1 : a.palette[a.grid[y][x]]
    const cb = b.grid[y][x] === '.' ? -1 : b.palette[b.grid[y][x]]
    if (ca !== cb) n++
  }
  return n
}

test('단계끼리 서 있는 모습이 12칸 넘게 다르다', async () => {
  for (let i = 0; i < STAGES_.length; i++) for (let j = i + 1; j < STAGES_.length; j++) {
    expect(diff(frameFor(STAGES_[i], 'idle'), frameFor(STAGES_[j], 'idle'))).toBeGreaterThan(12)
  }
})

test('영창 두 프레임은 서로 다르다', async () => {
  for (const s of STAGES_) expect(diff(frameFor(s, 'cast1'), frameFor(s, 'cast2'))).toBeGreaterThan(0)
})

test('Svg 크기 한도', async () => {
  for (const s of STAGES_) for (const p of POSES_) {
    const f = frameFor(s, p)
    expect(gridToSvg(f.grid, f.palette, 8).length).toBeLessThan(131072)
  }
})
