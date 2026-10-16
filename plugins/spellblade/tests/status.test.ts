import { expect, test } from 'claude-code/testing'
import { demoFrame, poseAt, withFlash, type Activity } from '../hooks/lib/status.ts'

const A = (o: Partial<Activity> = {}): Activity => ({ working: false, lastActiveAt: 0, flash: null, ...o })

test('일하는 중에는 영창 두 프레임', async () => {
  expect(poseAt(A({ working: true }), 0)).toEqual({ pose: 'cast1', line: '마법을 두르는 중…' })
  expect(poseAt(A({ working: true }), 400).pose).toBe('cast2')
  expect(poseAt(A({ working: true }), 800).pose).toBe('cast1')
})

test('깜빡임', async () => {
  expect(poseAt(A(), 3000 * 5 + 100)).toEqual({ pose: 'blink', line: '쉬는 중' })
  expect(poseAt(A(), 3000 * 5 + 500)).toEqual({ pose: 'idle', line: '쉬는 중' })
})

test('30분 쉬면 잠', async () => {
  expect(poseAt(A(), 1_800_000)).toEqual({ pose: 'sleep', line: 'Zzz' })
  expect(poseAt(A(), 1_799_999).pose).not.toBe('sleep')
})

test('일하는 중에는 오래돼도 자지 않는다', async () => {
  expect(poseAt(A({ working: true }), 9_000_000).pose).toMatch(/cast/)
})

test('flash 가 끝나면 원래대로', async () => {
  const a = withFlash(A({ working: true }), 'victory', 1000, '+34 XP')
  expect(poseAt(a, 2999)).toEqual({ pose: 'victory', line: '✓ 승리 +34 XP' })
  expect(poseAt(a, 3000).pose).toBe('cast2')
})

test('flash 문구', async () => {
  expect(poseAt(withFlash(A(), 'slash', 0, '폭풍 베기!'), 100).line).toBe('폭풍 베기!')
  expect(poseAt(withFlash(A(), 'hit', 0), 100).line).toBe('윽, 반격당했다')
  expect(poseAt(withFlash(A(), 'levelup', 0), 100).line).toBe('레벨업!')
})

test('flash 길이', async () => {
  expect(poseAt(withFlash(A(), 'slash', 0, 'Read'), 399).pose).toBe('slash')
  expect(poseAt(withFlash(A(), 'slash', 0, 'Read'), 400).pose).not.toBe('slash')
  expect(poseAt(withFlash(A(), 'hit', 0), 1999).pose).toBe('hit')
  expect(poseAt(withFlash(A(), 'levelup', 0), 2999).pose).toBe('levelup')
})

test('낮은 것이 레벨업을 덮지 않는다', async () => {
  const a = withFlash(withFlash(A(), 'levelup', 0), 'slash', 100, 'Bash')
  expect(poseAt(a, 200).pose).toBe('levelup')
})

test('같은 우선순위는 새것이 덮는다', async () => {
  const a = withFlash(withFlash(A(), 'slash', 0, '탐색의 눈!'), 'slash', 100, '폭풍 베기!')
  expect(poseAt(a, 200).line).toBe('폭풍 베기!')
})

test('끝난 높은 flash 는 낮은 것에 자리를 내준다', async () => {
  const a = withFlash(withFlash(A(), 'hit', 0), 'slash', 2500, 'Edit')
  expect(poseAt(a, 2600).pose).toBe('slash')
})

test('전리품 문구는 승리 자세로', async () => {
  expect(poseAt(withFlash(A(), 'loot', 0, '전리품 획득! +20 XP'), 100)).toEqual({ pose: 'victory', line: '전리품 획득! +20 XP' })
  expect(poseAt(withFlash(A(), 'loot', 0, 'x'), 2000).pose).not.toBe('victory')
})

test('전리품은 승리를 덮고 반격에는 밀린다', async () => {
  expect(poseAt(withFlash(withFlash(A(), 'victory', 0, '1'), 'loot', 10, 'L'), 20).line).toBe('L')
  expect(poseAt(withFlash(withFlash(A(), 'hit', 0), 'loot', 10, 'L'), 20).pose).toBe('hit')
})

test('데모: 5단계 × 6자세를 1초씩, 30초면 끝', async () => {
  expect(demoFrame(0)).toMatchObject({ stage: 'trainee', pose: 'idle' })
  expect(demoFrame(1000)).toMatchObject({ stage: 'trainee', pose: 'cast1' })
  expect(demoFrame(2500)).toMatchObject({ stage: 'trainee', pose: 'slash' })
  expect(demoFrame(6000)).toMatchObject({ stage: 'swordsman', pose: 'idle' })
  expect(demoFrame(29_999)).toMatchObject({ stage: 'saint', pose: 'levelup' })
  expect(demoFrame(30_000)).toBe(null)
  expect(demoFrame(-1)).toBe(null)
})

// ---- 2차: 기술 · 콤보 · 체력(주간) · 마나(5시간) ----

test('기술 · 콤보 문구', async () => {
  expect(poseAt(withFlash(A(), 'slash', 0, '폭풍 베기! ×12 콤보'), 100).line).toBe('폭풍 베기! ×12 콤보')
  expect(poseAt(withFlash(A(), 'slash', 0), 100).line).toBe('베기!')
})

test('승리 요약', async () => {
  expect(poseAt(withFlash(A(), 'victory', 0, '+3 XP · 출력 2.1k · 기억 96%'), 100).line).toBe('✓ 승리 +3 XP · 출력 2.1k · 기억 96%')
})

test('마나 0 이면 쉬는 자세', async () => {
  expect(poseAt(A(), 100, { hpLeft: 50, mpLeft: 0, mpReset: '2:14' })).toEqual({ pose: 'sleep', line: '마나 소진 — 2:14 뒤 회복' })
})

test('체력 0 이면 기진맥진', async () => {
  expect(poseAt(A(), 100, { hpLeft: 0, mpLeft: 50, hpReset: '금 09:00' })).toEqual({ pose: 'sleep', line: '기진맥진 — 금 09:00 회복' })
})

test('마나가 낮으면 바닥나 간다', async () => {
  expect(poseAt(A({ working: true }), 0, { hpLeft: 80, mpLeft: 10 })).toEqual({ pose: 'cast1', line: '마나가 바닥나 간다' })
})

test('체력이 낮으면 숨이 차다', async () => {
  expect(poseAt(A({ working: true }), 0, { hpLeft: 20, mpLeft: 80 }).line).toBe('숨이 차다…')
})

test('한도가 없으면 1차 그대로', async () => {
  expect(poseAt(A(), 15_500, { hpLeft: null, mpLeft: null })).toEqual({ pose: 'idle', line: '쉬는 중' })
})

test('flash 가 한도 문구보다 먼저', async () => {
  expect(poseAt(withFlash(A(), 'hit', 0), 100, { hpLeft: 0, mpLeft: 0 }).pose).toBe('hit')
})
