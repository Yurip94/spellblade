import { LIMIT_WARN, MS, REST_AFTER_MS } from './balance.ts'
import type { HeroPose } from './hero3.ts'

export type FlashKind = 'castHit' | 'castFail' | 'slash' | 'victory' | 'loot' | 'hit' | 'levelup'
export type Flash = { kind: FlashKind; from: number; until: number; detail?: string }
// queued: 지금 연출이 끝나면 이어질 연출 하나(강타 · 헛손질 0.7초 뒤의 승리처럼)
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
  castHit: 'slash', castFail: 'castFail', slash: 'slash', victory: 'victory', loot: 'victory', hit: 'hit', levelup: 'levelup',
}

function flashLine(f: Flash): string {
  switch (f.kind) {
    case 'castHit': return '강타!'
    case 'castFail': return '헛손질… 자세를 다시 잡는다'
    case 'slash': return f.detail ?? '베기!' // 기술 이름 + 콤보 (부르는 쪽이 만든다)
    case 'victory': return `✓ 승리 ${f.detail ?? ''}`.trimEnd()
    case 'loot': return f.detail ?? ''
    case 'hit': return '윽, 반격당했다'
    case 'levelup': return '레벨업!'
  }
}

// 체력 = 주간 한도 남은 %, 기력 = 5시간 한도 남은 % (없으면 null — 필드 이름 mp 는 그대로)
export type Mood = { hpLeft: number | null; mpLeft: number | null; hpReset?: string; mpReset?: string }
export type Scene = { pose: HeroPose; line: string; mode: 'battle' | 'rest' }

export function poseAt(a: Activity, now: number, mood?: Mood): Scene {
  // 연출(전리품은 승리 자세)은 전투 장면에서
  const f = currentFlash(a, now)
  if (f) return { pose: FLASH_POSE[f.kind], line: flashLine(f), mode: 'battle' }
  // 한도가 바닥나면 모닥불 앞에서 쉰다 (벌은 없다)
  if (mood?.mpLeft === 0) return { pose: 'sit', line: `기력 소진 — ${mood.mpReset ?? '곧'} 뒤 회복`, mode: 'rest' }
  if (mood?.hpLeft === 0) return { pose: 'sit', line: `기진맥진 — ${mood.hpReset ?? '곧'} 회복`, mode: 'rest' }
  const base = basePose(a, now)
  if (mood?.mpLeft != null && mood.mpLeft < LIMIT_WARN.mp) return { ...base, line: '기력이 바닥나 간다' }
  if (mood?.hpLeft != null && mood.hpLeft < LIMIT_WARN.hp) return { ...base, line: '숨이 차다…' }
  return base
}

// 일하는 중은 칼을 겨누고 집중, 턴이 끝나고 2분은 전투 대기, 그 뒤 모닥불(30분 넘으면 졸기)
function basePose(a: Activity, now: number): Scene {
  if (a.working) return { pose: 'idle', line: '집중하는 중…', mode: 'battle' }
  const idle = now - a.lastActiveAt
  if (idle >= MS.sleepAfter) return { pose: 'sleep', line: 'Zzz', mode: 'rest' }
  if (idle >= REST_AFTER_MS) return { pose: 'sit', line: '모닥불 앞에서 쉬는 중', mode: 'rest' }
  if (now % MS.blinkEvery < MS.blinkFor) return { pose: 'blink', line: '쉬는 중', mode: 'battle' }
  return { pose: 'idle', line: '쉬는 중', mode: 'battle' }
}

// ---- /blade demo: 맵 5개(Lv.1 · 25 · 45 · 65 · 85) × [베기 · 헛손질 · 모닥불] 다음 보스 사이클롭스(Lv.40) 베기 한 장.
// 0.8초씩 16장, 저장소는 건드리지 않는다 ----

const DEMO_STEP = 800
const DEMO_LEVELS = [1, 25, 45, 65, 85] as const
const DEMO_BOSS = 40
const DEMO_SCENES: readonly Scene[] = [
  { pose: 'slash', line: '베기! (데모)', mode: 'battle' },
  { pose: 'castFail', line: '헛손질… (데모)', mode: 'battle' },
  { pose: 'sit', line: '모닥불 앞에서 쉬는 중 (데모)', mode: 'rest' },
]

export function demoFrame(elapsedMs: number): (Scene & { level: number; boss: number }) | null {
  const i = Math.floor(elapsedMs / DEMO_STEP)
  const maps = DEMO_LEVELS.length * DEMO_SCENES.length
  if (elapsedMs < 0 || i > maps) return null
  if (i === maps) return { level: DEMO_BOSS, boss: DEMO_BOSS, pose: 'slash', line: '보스와 맞섰다! (데모)', mode: 'battle' }
  return { level: DEMO_LEVELS[Math.floor(i / DEMO_SCENES.length)], boss: 0, ...DEMO_SCENES[i % DEMO_SCENES.length] }
}
