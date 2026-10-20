import { expect, test } from 'claude-code/testing'
import { currentFlash, demoFrame, poseAt, thenFlash, withFlash, type Activity } from '../hooks/lib/status.ts'

const A = (o: Partial<Activity> = {}): Activity => ({ working: false, lastActiveAt: 0, flash: null, queued: null, ...o })

test('일하는 중에는 칼을 겨누고 집중(마법 영창 없음)', async () => {
  for (const now of [0, 400, 800]) expect(poseAt(A({ working: true }), now)).toEqual({ pose: 'idle', line: '집중하는 중…', mode: 'battle' })
})

test('단계 끝: 강타는 베기 자세, 헛손질은 휘청(마법 말 없음)', async () => {
  expect(poseAt(withFlash(A(), 'castHit', 0), 100)).toEqual({ pose: 'slash', line: '강타!', mode: 'battle' })
  expect(poseAt(withFlash(A(), 'castFail', 0), 100)).toEqual({ pose: 'castFail', line: '헛손질… 자세를 다시 잡는다', mode: 'battle' })
  expect(poseAt(A(), 0, { hpLeft: 50, mpLeft: 0, mpReset: '30분' }).line).toBe('기력 소진 — 30분 뒤 회복')
  expect(poseAt(A(), 0, { hpLeft: 50, mpLeft: 5 }).line).toBe('기력이 바닥나 간다')
  expect(demoFrame(800)?.line).toBe('헛손질… (데모)')
})

test('깜빡임', async () => {
  expect(poseAt(A(), 3000 * 5 + 100)).toEqual({ pose: 'blink', line: '쉬는 중', mode: 'battle' })
  expect(poseAt(A(), 3000 * 5 + 500)).toEqual({ pose: 'idle', line: '쉬는 중', mode: 'battle' })
})

test('30분 쉬면 잠', async () => {
  expect(poseAt(A(), 1_800_000)).toEqual({ pose: 'sleep', line: 'Zzz', mode: 'rest' })
  expect(poseAt(A(), 1_799_999).pose).not.toBe('sleep')
})

test('일하는 중에는 오래돼도 자지 않는다', async () => {
  expect(poseAt(A({ working: true }), 9_000_000)).toMatchObject({ pose: 'idle', line: '집중하는 중…' })
})

test('flash 가 끝나면 원래대로', async () => {
  const a = withFlash(A({ working: true }), 'victory', 1000, '+34 XP')
  expect(poseAt(a, 2999)).toEqual({ pose: 'victory', line: '✓ 승리 +34 XP', mode: 'battle' })
  expect(poseAt(a, 3000)).toMatchObject({ pose: 'idle', line: '집중하는 중…' })
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
  expect(poseAt(withFlash(A(), 'loot', 0, '전리품 획득! +20 XP'), 100)).toEqual({ pose: 'victory', line: '전리품 획득! +20 XP', mode: 'battle' })
  expect(poseAt(withFlash(A(), 'loot', 0, 'x'), 2000).pose).not.toBe('victory')
})

test('전리품은 승리를 덮고 반격에는 밀린다', async () => {
  expect(poseAt(withFlash(withFlash(A(), 'victory', 0, '1'), 'loot', 10, 'L'), 20).line).toBe('L')
  expect(poseAt(withFlash(withFlash(A(), 'hit', 0), 'loot', 10, 'L'), 20).pose).toBe('hit')
})

test('데모는 맵 5개 × 3장면 + 보스 한 장(0.8초씩, 16장이면 끝)', async () => {
  expect(demoFrame(0)).toMatchObject({ level: 1, boss: 0, pose: 'slash', mode: 'battle' })
  expect(demoFrame(800)).toMatchObject({ level: 1, pose: 'castFail', mode: 'battle' })
  expect(demoFrame(1600)).toMatchObject({ level: 1, pose: 'sit', mode: 'rest' })
  expect(demoFrame(800 * 3)).toMatchObject({ level: 25, pose: 'slash' })
  expect(demoFrame(800 * 14)).toMatchObject({ level: 85, pose: 'sit' })
  expect(demoFrame(800 * 15)).toMatchObject({ level: 40, boss: 40, pose: 'slash', mode: 'battle' })
  expect(demoFrame(0)?.line).toMatch(/\(데모\)/)
  expect([demoFrame(0)?.level, demoFrame(15 * 800)?.boss, demoFrame(16 * 800)]).toEqual([1, 40, null])
  expect(demoFrame(-1)).toBe(null)
})

// ---- 2차: 기술 · 콤보 · 체력(주간) · 기력(5시간) ----

test('기술 · 콤보 문구', async () => {
  expect(poseAt(withFlash(A(), 'slash', 0, '폭풍 베기! ×12 콤보'), 100).line).toBe('폭풍 베기! ×12 콤보')
  expect(poseAt(withFlash(A(), 'slash', 0), 100).line).toBe('베기!')
})

test('승리 요약', async () => {
  expect(poseAt(withFlash(A(), 'victory', 0, '+3 XP · 출력 2.1k'), 100).line).toBe('✓ 승리 +3 XP · 출력 2.1k')
})

test('기력 0 이면 쉬는 자세', async () => {
  expect(poseAt(A(), 100, { hpLeft: 50, mpLeft: 0, mpReset: '2:14' })).toEqual({ pose: 'sit', line: '기력 소진 — 2:14 뒤 회복', mode: 'rest' })
})

test('체력 0 이면 기진맥진', async () => {
  expect(poseAt(A(), 100, { hpLeft: 0, mpLeft: 50, hpReset: '금 09:00' })).toEqual({ pose: 'sit', line: '기진맥진 — 금 09:00 회복', mode: 'rest' })
})

test('기력가 낮으면 바닥나 간다', async () => {
  expect(poseAt(A({ working: true }), 0, { hpLeft: 80, mpLeft: 10 })).toEqual({ pose: 'idle', line: '기력이 바닥나 간다', mode: 'battle' })
})

test('체력이 낮으면 숨이 차다', async () => {
  expect(poseAt(A({ working: true }), 0, { hpLeft: 20, mpLeft: 80 }).line).toBe('숨이 차다…')
})

test('한도가 없으면 1차 그대로', async () => {
  expect(poseAt(A(), 15_500, { hpLeft: null, mpLeft: null })).toEqual({ pose: 'idle', line: '쉬는 중', mode: 'battle' })
})

test('flash 가 한도 문구보다 먼저', async () => {
  expect(poseAt(withFlash(A(), 'hit', 0), 100, { hpLeft: 0, mpLeft: 0 }).pose).toBe('hit')
})

// ---- 3차: 마법 결과 · 예약 flash · 모닥불 ----

test('마법 결과는 가장 낮은 순위', async () => {
  expect(poseAt(withFlash(withFlash(A(), 'castFail', 0), 'slash', 100, '베기!'), 200).pose).toBe('slash')
  expect(poseAt(withFlash(withFlash(A(), 'slash', 0, '베기!'), 'castFail', 100), 200).pose).toBe('slash')
})

test('강타 · 헛손질 문구 · 길이 0.7초', async () => {
  expect(poseAt(withFlash(A(), 'castHit', 0), 100)).toEqual({ pose: 'slash', line: '강타!', mode: 'battle' })
  expect(poseAt(withFlash(A(), 'castFail', 0), 699)).toEqual({ pose: 'castFail', line: '헛손질… 자세를 다시 잡는다', mode: 'battle' })
  expect(poseAt(withFlash(A(), 'castFail', 0), 700).pose).not.toBe('castFail')
})

test('승리는 마법 결과 뒤에 이어진다', async () => {
  let a = withFlash(A(), 'castFail', 0)
  a = thenFlash(a, 'victory', 100, '+3 XP')
  expect([poseAt(a, 500).pose, poseAt(a, 800).pose]).toEqual(['castFail', 'victory'])
  expect(poseAt(a, 800).line).toBe('✓ 승리 +3 XP')
  expect(poseAt(a, 2_800)).toMatchObject({ mode: 'battle' })
  expect(poseAt(a, 2_800).pose).not.toBe('victory')
})

test('살아 있는 flash 가 없으면 thenFlash 는 바로', async () => {
  expect(currentFlash(thenFlash(A(), 'victory', 100, '+1 XP'), 100)).toMatchObject({ kind: 'victory', from: 100, until: 2100 })
  expect(currentFlash(A(), 100)).toBe(null)
})

test('예약된 연출이 도는 중이면 그것을 지키고 뒤에 잇는다', async () => {
  let a = thenFlash(withFlash(A(), 'castHit', 0), 'victory', 100, '1')
  a = thenFlash(a, 'castFail', 1000)
  expect([poseAt(a, 1500).pose, poseAt(a, 3000).pose, poseAt(a, 3500).pose]).toEqual(['victory', 'castFail', 'idle'])
})

test('예약된 승리도 낮은 연출에 덮이지 않는다', async () => {
  const a = withFlash(thenFlash(withFlash(A(), 'castHit', 0), 'victory', 100, '1'), 'slash', 800, '베기!')
  expect(poseAt(a, 900).pose).toBe('victory')
})

test('턴이 끝나고 2분 동안은 전투, 그 뒤 모닥불', async () => {
  expect(poseAt(A(), 119_999).mode).toBe('battle')
  expect(poseAt(A(), 120_000)).toEqual({ pose: 'sit', line: '모닥불 앞에서 쉬는 중', mode: 'rest' })
  expect(poseAt(A(), 1_800_000)).toEqual({ pose: 'sleep', line: 'Zzz', mode: 'rest' })
})

test('기력 0 이면 일하는 중에도 모닥불', async () => {
  expect(poseAt(A({ working: true }), 0, { hpLeft: 50, mpLeft: 0, mpReset: '2:14' })).toEqual({ pose: 'sit', line: '기력 소진 — 2:14 뒤 회복', mode: 'rest' })
})
