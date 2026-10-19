import { CAST_DAMAGE_DIV, MS, POPUP_MAX, SKILL_DAMAGE, SKILL_TIER_BONUS, TIERS } from './balance.ts'
import { bossAt, monsterHp, type Spawn } from './roster.ts'
import type { SkillId } from './skills.ts'

// 전투 상태: 도구 한 번 = 한 대, 체력이 0 이면 펑 → +N XP → 같은 자리에 다음 몬스터(4차: 몬스터 단계 · 보스 · 부활).
// 순수 함수만 둔다(시간은 부르는 쪽이 넘긴다). 바뀐 게 없으면 같은 객체를 돌려준다.

export type Popup = { text: string; at: number; kind: 'damage' | 'xp' }
export type Battle = {
  index: number        // 몬스터 단계(roster.ts ROSTER 의 자리)
  boss: number         // 0 = 일반, 아니면 보스 레벨(10 · 20 · … · 100)
  hp: number
  maxHp: number
  xpAtSpawn: number
  hitUntil: number
  attackUntil: number
  poofUntil: number    // 0 이면 살아 있다
  revives: number      // 남은 부활 수(피닉슬링 1)
  reviveUntil: number  // 되살아나는 연출이 끝나는 때
  popups: readonly Popup[]
}

const down = (b: Battle) => b.hp <= 0 || b.poofUntil > 0

export function newBattle(spawn: Spawn, xpNow: number): Battle {
  const hp = monsterHp(spawn.index, spawn.boss > 0)
  const revives = spawn.boss > 0 ? bossAt(spawn.boss).revives : 0
  return { index: spawn.index, boss: spawn.boss, hp, maxHp: hp, xpAtSpawn: xpNow, hitUntil: 0, attackUntil: 0, poofUntil: 0, revives, reviveUntil: 0, popups: [] }
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

// 시간이 흐른 뒤 정리: 오래된 숫자 버리기 · 부활이 남았으면 절반 체력으로 되살아남 ·
// 처치면 펑과 +N XP · 펑이 끝났으면 넘겨 받은 Spawn 의 새 몬스터(숫자는 넘긴다)
export function settle(b: Battle, now: number, next: Spawn, xpNow: number): Battle {
  let out = b
  const live = b.popups.filter(p => now - p.at < MS.popup)
  if (live.length !== b.popups.length) out = { ...out, popups: live }
  if (out.hp <= 0 && out.poofUntil === 0 && out.revives > 0) {
    out = { ...out, hp: Math.ceil(out.maxHp / 2), revives: out.revives - 1, reviveUntil: now + MS.revive, hitUntil: 0 }
  } else if (out.hp <= 0 && out.poofUntil === 0) {
    const xp: Popup = { text: `+${Math.max(0, xpNow - out.xpAtSpawn)} XP`, at: now, kind: 'xp' }
    out = { ...out, poofUntil: now + MS.poof, popups: [...out.popups, xp].slice(-POPUP_MAX) }
  } else if (out.poofUntil > 0 && now >= out.poofUntil) {
    out = { ...newBattle(next, xpNow), popups: out.popups }
  }
  return out
}

// 방금 쓰러졌는지(펑이 막 시작됐는지) — 보스 처치 기록용
export function justDefeated(prev: Battle, next: Battle): boolean {
  return prev.poofUntil === 0 && next.poofUntil > 0
}

// 그림 묶음이 없을 때 쓰는 3.0 몬스터 그림 단계(0 ~ 11)
export function legacyMonsterTier(b: Battle): number {
  if (b.boss > 0) return Math.min(11, Math.floor(b.boss / 10))
  return Math.max(0, Math.min(11, Math.floor((b.index * 12) / 33)))
}

// 도구 데미지: 장비 단계(0 ~ 19)마다 25% 씩
export function skillDamage(skill: SkillId, equipTier: number): number {
  const t = Math.max(0, Math.min(TIERS - 1, Math.floor(equipTier)))
  return Math.round(SKILL_DAMAGE[skill] * (1 + SKILL_TIER_BONUS * t))
}

export function castDamage(w: number): number {
  return Math.max(1, Math.round(w / CAST_DAMAGE_DIV))
}

// 펑 > 되살아남 > 반격 > 맞음 > 숨쉬기
export function monsterPoseAt(b: Battle, now: number): 'idle0' | 'idle1' | 'attack' | 'hit' | 'revive' | 'poof' {
  if (b.poofUntil > 0) return 'poof'
  if (now < b.reviveUntil) return 'revive'
  if (now < b.attackUntil) return 'attack'
  if (now < b.hitUntil) return 'hit'
  return Math.floor(now / MS.breath) % 2 === 0 ? 'idle0' : 'idle1'
}
