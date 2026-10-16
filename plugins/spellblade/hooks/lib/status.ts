import { LIMIT_WARN, MS, STAGES, type StageId } from './balance.ts'

export type Pose = 'idle' | 'blink' | 'cast1' | 'cast2' | 'slash' | 'victory' | 'hit' | 'levelup' | 'sleep'

export type FlashKind = 'slash' | 'victory' | 'loot' | 'hit' | 'levelup'
export type Flash = { kind: FlashKind; until: number; detail?: string }
export type Activity = { working: boolean; lastActiveAt: number; flash: Flash | null }

const LENGTH: Record<FlashKind, number> = { slash: MS.slash, victory: MS.victory, loot: MS.victory, hit: MS.hit, levelup: MS.levelUp }
const RANK: Record<FlashKind, number> = { slash: 1, victory: 2, loot: 3, hit: 4, levelup: 5 }

// 아직 안 끝난 더 높은 flash 는 덮지 않는다. 같은 우선순위는 새것이 덮는다.
export function withFlash(a: Activity, kind: FlashKind, now: number, detail?: string): Activity {
  const live = a.flash && now < a.flash.until ? a.flash : null
  if (live && RANK[live.kind] > RANK[kind]) return a
  return { ...a, flash: { kind, until: now + LENGTH[kind], detail } }
}

function flashLine(f: Flash): string {
  switch (f.kind) {
    case 'slash': return f.detail ?? '베기!' // 기술 이름 + 콤보 (부르는 쪽이 만든다)
    case 'victory': return `✓ 승리 ${f.detail ?? ''}`.trimEnd()
    case 'loot': return f.detail ?? ''
    case 'hit': return '윽, 반격당했다'
    case 'levelup': return '레벨업!'
  }
}

// 체력 = 주간 한도 남은 %, 마나 = 5시간 한도 남은 % (없으면 null)
export type Mood = { hpLeft: number | null; mpLeft: number | null; hpReset?: string; mpReset?: string }

export function poseAt(a: Activity, now: number, mood?: Mood): { pose: Pose; line: string } {
  // 전리품(커밋 · PR 보너스)은 승리 자세로 보여 준다
  if (a.flash && now < a.flash.until) return { pose: a.flash.kind === 'loot' ? 'victory' : a.flash.kind, line: flashLine(a.flash) }
  // 한도가 바닥나면 앉아서 쉰다 (벌은 없다)
  if (mood?.mpLeft === 0) return { pose: 'sleep', line: `마나 소진 — ${mood.mpReset ?? '곧'} 뒤 회복` }
  if (mood?.hpLeft === 0) return { pose: 'sleep', line: `기진맥진 — ${mood.hpReset ?? '곧'} 회복` }
  const base = basePose(a, now)
  if (mood?.mpLeft != null && mood.mpLeft < LIMIT_WARN.mp) return { ...base, line: '마나가 바닥나 간다' }
  if (mood?.hpLeft != null && mood.hpLeft < LIMIT_WARN.hp) return { ...base, line: '숨이 차다…' }
  return base
}

function basePose(a: Activity, now: number): { pose: Pose; line: string } {
  if (a.working) return { pose: Math.floor(now / MS.castFrame) % 2 === 0 ? 'cast1' : 'cast2', line: '마법을 두르는 중…' }
  if (now - a.lastActiveAt >= MS.sleepAfter) return { pose: 'sleep', line: 'Zzz' }
  if (now % MS.blinkEvery < MS.blinkFor) return { pose: 'blink', line: '쉬는 중' }
  return { pose: 'idle', line: '쉬는 중' }
}

// ---- /blade demo: 5단계 × 6자세를 1초씩, 저장소는 건드리지 않는다 ----

const DEMO_STEP = 1000
const DEMO_POSES: readonly { pose: Pose; line: string }[] = [
  { pose: 'idle', line: '쉬는 중' },
  { pose: 'cast1', line: '마법을 두르는 중…' },
  { pose: 'slash', line: '베기! (데모)' },
  { pose: 'victory', line: '✓ 승리 +0 XP' },
  { pose: 'hit', line: '윽, 반격당했다' },
  { pose: 'levelup', line: '레벨업!' },
]

export function demoFrame(elapsedMs: number): { stage: StageId; pose: Pose; line: string } | null {
  const i = Math.floor(elapsedMs / DEMO_STEP)
  if (elapsedMs < 0 || i >= STAGES.length * DEMO_POSES.length) return null
  return { stage: STAGES[Math.floor(i / DEMO_POSES.length)].id, ...DEMO_POSES[i % DEMO_POSES.length] }
}
