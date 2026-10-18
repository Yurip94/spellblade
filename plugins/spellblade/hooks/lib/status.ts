import { LIMIT_WARN, MS, REST_AFTER_MS, TIERS } from './balance.ts'
import type { HeroPose } from './hero3.ts'

// 2.x 그림(art.ts)이 쓰는 자세(Task 10 에서 art.ts 와 함께 지운다)
export type Pose = 'idle' | 'blink' | 'cast1' | 'cast2' | 'slash' | 'victory' | 'hit' | 'levelup' | 'sleep'

export type FlashKind = 'castHit' | 'castFail' | 'slash' | 'victory' | 'loot' | 'hit' | 'levelup'
export type Flash = { kind: FlashKind; from: number; until: number; detail?: string }
// queued: 지금 연출이 끝나면 이어질 연출 하나(마법 결과 0.7초 뒤의 승리처럼)
export type Activity = { working: boolean; lastActiveAt: number; flash: Flash | null; queued: Flash | null }

const LENGTH: Record<FlashKind, number> = {
  castHit: MS.castResult, castFail: MS.castResult, slash: MS.slash, victory: MS.victory, loot: MS.victory, hit: MS.hit, levelup: MS.levelUp,
}
const RANK: Record<FlashKind, number> = { castHit: 0, castFail: 0, slash: 1, victory: 2, loot: 3, hit: 4, levelup: 5 }

const live = (f: Flash | null, now: number): f is Flash => f !== null && f.from <= now && now < f.until

// 지금 보이는 연출: 살아 있는 것 가운데 순위가 높은 것(같으면 flash)
export function currentFlash(a: Activity, now: number): Flash | null {
  const f = live(a.flash, now) ? a.flash : null
  const q = live(a.queued, now) ? a.queued : null
  if (f && q) return RANK[q.kind] > RANK[f.kind] ? q : f
  return f ?? q
}

// 아직 안 끝난 더 높은 연출은 덮지 않는다. 같은 우선순위는 새것이 덮는다.
export function withFlash(a: Activity, kind: FlashKind, now: number, detail?: string): Activity {
  const cur = currentFlash(a, now)
  if (cur && RANK[cur.kind] > RANK[kind]) return a
  return { ...a, flash: { kind, from: now, until: now + LENGTH[kind], detail } }
}

// 살아 있는 연출이 있으면 그것이 끝나는 때부터 이어지게 예약한다(도는 중인 예약은 flash 로 옮겨 지킨다). 없으면 withFlash
export function thenFlash(a: Activity, kind: FlashKind, now: number, detail?: string): Activity {
  const cur = currentFlash(a, now)
  if (!cur) return withFlash(a, kind, now, detail)
  return { ...a, flash: cur, queued: { kind, from: cur.until, until: cur.until + LENGTH[kind], detail } }
}

const FLASH_POSE: Record<FlashKind, HeroPose> = {
  castHit: 'castHit', castFail: 'castFail', slash: 'slash', victory: 'victory', loot: 'victory', hit: 'hit', levelup: 'levelup',
}

function flashLine(f: Flash): string {
  switch (f.kind) {
    case 'castHit': return '✦ 마법 적중!'
    case 'castFail': return '주문이 꼬였다… 처음부터 다시'
    case 'slash': return f.detail ?? '베기!' // 기술 이름 + 콤보 (부르는 쪽이 만든다)
    case 'victory': return `✓ 승리 ${f.detail ?? ''}`.trimEnd()
    case 'loot': return f.detail ?? ''
    case 'hit': return '윽, 반격당했다'
    case 'levelup': return '레벨업!'
  }
}

// 체력 = 주간 한도 남은 %, 마나 = 5시간 한도 남은 % (없으면 null)
export type Mood = { hpLeft: number | null; mpLeft: number | null; hpReset?: string; mpReset?: string }
export type Scene = { pose: HeroPose; line: string; mode: 'battle' | 'rest' }

export function poseAt(a: Activity, now: number, mood?: Mood): Scene {
  // 연출(전리품은 승리 자세)은 전투 장면에서
  const f = currentFlash(a, now)
  if (f) return { pose: FLASH_POSE[f.kind], line: flashLine(f), mode: 'battle' }
  // 한도가 바닥나면 모닥불 앞에서 쉰다 (벌은 없다)
  if (mood?.mpLeft === 0) return { pose: 'sit', line: `마나 소진 — ${mood.mpReset ?? '곧'} 뒤 회복`, mode: 'rest' }
  if (mood?.hpLeft === 0) return { pose: 'sit', line: `기진맥진 — ${mood.hpReset ?? '곧'} 회복`, mode: 'rest' }
  const base = basePose(a, now)
  if (mood?.mpLeft != null && mood.mpLeft < LIMIT_WARN.mp) return { ...base, line: '마나가 바닥나 간다' }
  if (mood?.hpLeft != null && mood.hpLeft < LIMIT_WARN.hp) return { ...base, line: '숨이 차다…' }
  return base
}

// 일하는 중은 영창, 턴이 끝나고 2분은 전투 대기, 그 뒤 모닥불(30분 넘으면 졸기)
function basePose(a: Activity, now: number): Scene {
  if (a.working) return { pose: Math.floor(now / MS.castFrame) % 2 === 0 ? 'cast1' : 'cast2', line: '마법을 두르는 중…', mode: 'battle' }
  const idle = now - a.lastActiveAt
  if (idle >= MS.sleepAfter) return { pose: 'sleep', line: 'Zzz', mode: 'rest' }
  if (idle >= REST_AFTER_MS) return { pose: 'sit', line: '모닥불 앞에서 쉬는 중', mode: 'rest' }
  if (now % MS.blinkEvery < MS.blinkFor) return { pose: 'blink', line: '쉬는 중', mode: 'battle' }
  return { pose: 'idle', line: '쉬는 중', mode: 'battle' }
}

// ---- /blade demo: 12단계 × [베기 · 캐스팅 실패 · 모닥불] 을 0.8초씩, 저장소는 건드리지 않는다 ----

const DEMO_STEP = 800
const DEMO_SCENES: readonly Scene[] = [
  { pose: 'slash', line: '베기! (데모)', mode: 'battle' },
  { pose: 'castFail', line: '주문이 꼬였다… (데모)', mode: 'battle' },
  { pose: 'sit', line: '모닥불 앞에서 쉬는 중 (데모)', mode: 'rest' },
]

export function demoFrame(elapsedMs: number): (Scene & { tier: number }) | null {
  const i = Math.floor(elapsedMs / DEMO_STEP)
  if (elapsedMs < 0 || i >= TIERS * DEMO_SCENES.length) return null
  return { tier: Math.floor(i / DEMO_SCENES.length), ...DEMO_SCENES[i % DEMO_SCENES.length] }
}
