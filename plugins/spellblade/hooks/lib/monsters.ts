import { MONSTER_ART } from './art3.ts'
import { mixRgb } from './rgb.ts'
import { shade } from './shade.ts'
import type { Grid, Palette } from './sprites.ts'

// 3차 몬스터 12종: 장비 단계(5레벨마다)와 같은 순서로 바뀐다. 그림은 art3.ts(MONSTER_ART)
export const MONSTERS: readonly { id: string; name: string; emoji: string }[] = [
  { id: 'slime', name: '슬라임', emoji: '🟢' },
  { id: 'snail', name: '달팽이', emoji: '🐌' },
  { id: 'mushroom', name: '버섯', emoji: '🍄' },
  { id: 'pig', name: '돼지', emoji: '🐷' },
  { id: 'stump', name: '나무 그루터기', emoji: '🪵' },
  { id: 'wolf', name: '늑대', emoji: '🐺' },
  { id: 'skeleton', name: '해골 병사', emoji: '💀' },
  { id: 'golem', name: '골렘', emoji: '🗿' },
  { id: 'ghost', name: '유령', emoji: '👻' },
  { id: 'wyvern', name: '와이번', emoji: '🐉' },
  { id: 'babyDragon', name: '새끼 용', emoji: '🐲' },
  { id: 'dragon', name: '드래곤', emoji: '🔥' },
]

export type MonsterPose = 'idle0' | 'idle1' | 'attack' | 'hit'

const tierAt = (tier: number) => Math.max(0, Math.min(MONSTER_ART.length - 1, Math.floor(tier)))
const cache = new Map<string, { grid: Grid; palette: Palette }>()

// 음영을 넣은 그림. 맞은 프레임은 idle0 의 모든 색(테두리 포함)을 흰색 쪽으로 70% 섞는다. 결과는 한 번만 만든다
export function monsterFrame(tier: number, pose: MonsterPose): { grid: Grid; palette: Palette } {
  const t = tierAt(tier)
  const id = `${t}|${pose}`
  const hit = cache.get(id)
  if (hit) return hit
  const art = MONSTER_ART[t]
  let out: { grid: Grid; palette: Palette }
  if (pose === 'hit') {
    const base = monsterFrame(t, 'idle0')
    out = { grid: base.grid, palette: Object.fromEntries(Object.entries(base.palette).map(([k, v]) => [k, mixRgb(v, 0xffffff, 0.7)])) }
  } else {
    out = shade(art.frames[pose], art.palette, art.materials, art.details)
  }
  cache.set(id, out)
  return out
}

export function monsterSize(tier: number): { w: number; h: number } {
  const g = MONSTER_ART[tierAt(tier)].frames.idle0
  return { w: g[0]?.length ?? 0, h: g.length }
}
