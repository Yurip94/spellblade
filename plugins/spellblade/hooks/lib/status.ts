import { MS, STAGES, type StageId } from './balance.ts'

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
    case 'slash': return `베기! (${f.detail ?? ''})`
    case 'victory': return `✓ 승리 +${f.detail ?? '0'} XP`
    case 'loot': return f.detail ?? ''
    case 'hit': return '윽, 반격당했다'
    case 'levelup': return '레벨업!'
  }
}

export function poseAt(a: Activity, now: number): { pose: Pose; line: string } {
  // 전리품(커밋 · PR 보너스)은 승리 자세로 보여 준다
  if (a.flash && now < a.flash.until) return { pose: a.flash.kind === 'loot' ? 'victory' : a.flash.kind, line: flashLine(a.flash) }
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
