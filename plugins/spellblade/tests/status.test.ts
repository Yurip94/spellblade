import { expect, test } from 'claude-code/testing'
import { poseAt, withFlash, type Activity } from '../hooks/lib/status.ts'

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
  const a = withFlash(A({ working: true }), 'victory', 1000, '34')
  expect(poseAt(a, 2999)).toEqual({ pose: 'victory', line: '✓ 승리 +34 XP' })
  expect(poseAt(a, 3000).pose).toBe('cast2')
})

test('flash 문구', async () => {
  expect(poseAt(withFlash(A(), 'slash', 0, 'Bash'), 100).line).toBe('베기! (Bash)')
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
  const a = withFlash(withFlash(A(), 'slash', 0, 'Read'), 'slash', 100, 'Bash')
  expect(poseAt(a, 200).line).toBe('베기! (Bash)')
})

test('끝난 높은 flash 는 낮은 것에 자리를 내준다', async () => {
  const a = withFlash(withFlash(A(), 'hit', 0), 'slash', 2500, 'Edit')
  expect(poseAt(a, 2600).pose).toBe('slash')
})
