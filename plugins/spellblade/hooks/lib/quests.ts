import { QUEST_REWARD } from './balance.ts'
import type { Sum } from './ledger.ts'
import { comma } from './tokens.ts'

// 오늘의 의뢰: 날짜로 정해지는 3개(모든 창이 같다). 보상은 그날 저장 칸 합계로 계산해 두 번 주지 않는다

export type QuestKind = 'swings' | 'commits' | 'clean' | 'combo' | 'skills' | 'xp' | 'fast' | 'agents'
export type Tier = 'easy' | 'normal' | 'hard'
export type Quest = { index: 0 | 1 | 2; kind: QuestKind; tier: Tier; target: number; reward: number; title: string }

const KINDS: Record<QuestKind, { targets: [number, number, number]; title: (n: number) => string }> = {
  swings: { targets: [40, 80, 120], title: n => `베기 ${n}번` },
  commits: { targets: [1, 2, 3], title: n => `커밋 ${n}번` },
  clean: { targets: [3, 5, 8], title: n => `반격 없이 ${n}턴 연속` },
  combo: { targets: [10, 20, 30], title: n => `×${n} 콤보` },
  skills: { targets: [3, 5, 7], title: n => `기술 ${n}가지 쓰기` },
  xp: { targets: [300, 800, 1500], title: n => `오늘 XP ${comma(n)}` },
  fast: { targets: [5, 10, 20], title: n => `빠른 턴 ${n}번` },
  agents: { targets: [1, 3, 5], title: n => `분신술 ${n}번` },
}
const TIERS: Tier[] = ['easy', 'normal', 'hard']

// 날짜 문자열 → 씨앗(FNV-1a) → 작은 난수(mulberry32)
function seedOf(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function random(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function questsFor(day: string): Quest[] {
  const next = random(seedOf(`spellblade:${day}`))
  const kinds = Object.keys(KINDS) as QuestKind[]
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[kinds[i], kinds[j]] = [kinds[j], kinds[i]]
  }
  return TIERS.map((tier, i) => {
    const kind = kinds[i]
    const target = KINDS[kind].targets[i]
    return { index: i as 0 | 1 | 2, kind, tier, target, reward: QUEST_REWARD[tier], title: KINDS[kind].title(target) }
  })
}

const popcount = (n: number) => {
  let c = 0
  for (let v = n; v; v &= v - 1) c++
  return c
}

// dayXpFromW: 그날 W 로 얻은 XP(의뢰 보상은 빼고 — 제 꼬리를 물지 않게)
export function questValue(kind: QuestKind, daySum: Sum, dayXpFromW: number): number {
  switch (kind) {
    case 'skills': return popcount(daySum.skills)
    case 'xp': return dayXpFromW
    default: return daySum[kind]
  }
}

export function questStatus(day: string, daySum: Sum, dayXpFromW: number): { quest: Quest; value: number; done: boolean }[] {
  return questsFor(day).map(quest => {
    const value = questValue(quest.kind, daySum, dayXpFromW)
    return { quest, value, done: value >= quest.target }
  })
}

export function questReward(day: string, daySum: Sum, dayXpFromW: number): number {
  return questStatus(day, daySum, dayXpFromW).reduce((n, s) => n + (s.done ? s.quest.reward : 0), 0)
}
