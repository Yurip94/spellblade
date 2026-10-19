import { CAST_DAMAGE_DIV, MONSTER_HP, MS, POPUP_MAX, SKILL_DAMAGE, SKILL_TIER_BONUS } from './balance.ts'
import type { SkillId } from './skills.ts'

// 3차 전투 상태: 도구 한 번 = 한 대, 체력이 0 이면 펑 → +N XP → 같은 자리에 새 몬스터.
// 순수 함수만 둔다(시간은 부르는 쪽이 넘긴다). 바뀐 게 없으면 같은 객체를 돌려준다.

export type Popup = { text: string; at: number; kind: 'damage' | 'xp' }
export type Battle = {
  tier: number
  hp: number
  maxHp: number
  xpAtSpawn: number
  hitUntil: number
  attackUntil: number
  poofUntil: number   // 0 이면 살아 있다
  popups: readonly Popup[]
}

const tierAt = (tier: number) => Math.max(0, Math.min(MONSTER_HP.length - 1, Math.floor(tier)))
const down = (b: Battle) => b.hp <= 0 || b.poofUntil > 0

export function newBattle(tier: number, xpNow: number): Battle {
  const t = tierAt(tier)
  return { tier: t, hp: MONSTER_HP[t], maxHp: MONSTER_HP[t], xpAtSpawn: xpNow, hitUntil: 0, attackUntil: 0, poofUntil: 0, popups: [] }
}

// 한 대 친다: 체력을 줄이고 데미지 숫자를 띄운다(숫자는 최근 3개만). 쓰러진 몬스터는 그대로
export function strike(b: Battle, damage: number, now: number): Battle {
  if (down(b)) return b
  const popups = [...b.popups, { text: String(damage), at: now, kind: 'damage' as const }].slice(-POPUP_MAX)
  return { ...b, hp: Math.max(0, b.hp - damage), hitUntil: now + MS.monsterHit, popups }
}

// 반격(도구 오류). 쓰러진 몬스터는 그대로
export function retaliate(b: Battle, now: number): Battle {
  return down(b) ? b : { ...b, attackUntil: now + MS.monsterAttack }
}

// 시간이 흐른 뒤 정리: 오래된 숫자 버리기 · 처치면 펑과 +N XP · 펑이 끝났으면 지금 단계의 새 몬스터(숫자는 넘긴다)
export function settle(b: Battle, now: number, tierNow: number, xpNow: number): Battle {
  let out = b
  const live = b.popups.filter(p => now - p.at < MS.popup)
  if (live.length !== b.popups.length) out = { ...out, popups: live }
  if (out.hp <= 0 && out.poofUntil === 0) {
    const xp: Popup = { text: `+${Math.max(0, xpNow - out.xpAtSpawn)} XP`, at: now, kind: 'xp' }
    out = { ...out, poofUntil: now + MS.poof, popups: [...out.popups, xp].slice(-POPUP_MAX) }
  } else if (out.poofUntil > 0 && now >= out.poofUntil) {
    out = { ...newBattle(tierNow, xpNow), popups: out.popups }
  }
  return out
}

export function skillDamage(skill: SkillId, tier: number): number {
  return Math.round(SKILL_DAMAGE[skill] * (1 + SKILL_TIER_BONUS * tierAt(tier)))
}

export function castDamage(w: number): number {
  return Math.max(1, Math.round(w / CAST_DAMAGE_DIV))
}

// 펑 > 반격 > 맞음 > 숨쉬기
export function monsterPoseAt(b: Battle, now: number): 'idle0' | 'idle1' | 'attack' | 'hit' | 'poof' {
  if (b.poofUntil > 0) return 'poof'
  if (now < b.attackUntil) return 'attack'
  if (now < b.hitUntil) return 'hit'
  return Math.floor(now / MS.breath) % 2 === 0 ? 'idle0' : 'idle1'
}
