import { DETAILS3, HERO_ACCESSORIES, HERO_POSES, HERO_TIERS, MATERIALS3, type BladeKind, type HeroPoseKey } from './art3.ts'
import { shade } from './shade.ts'
import { compose, type Grid, type Palette } from './sprites.ts'

export { tierOf } from './progress.ts'

// 3차 마검사: 장비 단계(0~11) × 자세 → 음영 · 테두리를 넣은 그림. 자세 이름은 장면이 쓰는 이름이다
export type HeroPose = 'idle' | 'blink' | 'slash' | 'cast1' | 'cast2' | 'castHit' | 'castFail' | 'hit' | 'victory' | 'levelup' | 'sit' | 'sleep'

// 영창 두 프레임 · 마법 적중은 같은 칼 자세(빛은 효과), 레벨업은 서기(빛기둥은 효과)
const KEY: Record<HeroPose, HeroPoseKey> = {
  idle: 'idle', blink: 'blink', slash: 'slash', cast1: 'cast', cast2: 'cast', castHit: 'cast',
  castFail: 'castFail', hit: 'hit', victory: 'victory', levelup: 'idle', sit: 'sit', sleep: 'sleep',
}

// 칼 꾸밈(tools/art/art3.py 의 decorate 와 같은 규칙): 빛은 칼날 둘레 빈칸, 룬 · 번쩍임은 칼날 칸 몇 개
function decorate(g: Grid, kind: BladeKind): Grid {
  if (kind === 'plain') return g
  const h = g.length
  const w = g[0]?.length ?? 0
  const out = g.map(r => r.split(''))
  if (kind === 'glow' || kind === 'bolt' || kind === 'holy') {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (g[y][x] !== 'W') continue
        for (const [nx, ny] of [[x, y - 1], [x - 1, y], [x + 1, y], [x, y + 1]]) {
          if (nx >= 0 && nx < w && ny >= 0 && ny < h && g[ny][nx] === '.') out[ny][nx] = 'N'
        }
      }
    }
  }
  let n = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (g[y][x] !== 'W') continue
      n++
      if (kind === 'rune' && n % 3 === 0) out[y][x] = 'R'
      else if (kind === 'bolt' && (x + y) % 2 === 0) out[y][x] = 'Y'
      else if (kind === 'holy' && n % 3 === 0) out[y][x] = 'Y'
    }
  }
  return out.map(r => r.join(''))
}

const cache = new Map<string, { grid: Grid; palette: Palette }>()

// 뒤 장신구 → 자세 → 앞 장신구 → 칼 꾸밈 → 음영. 결과는 한 번만 만든다
export function heroFrame(tier: number, pose: HeroPose): { grid: Grid; palette: Palette } {
  const t = Math.max(0, Math.min(HERO_TIERS.length - 1, tier))
  const id = `${t}|${pose}`
  const hit = cache.get(id)
  if (hit) return hit
  const look = HERO_TIERS[t]
  const key = KEY[pose]
  const which = key === 'sit' || key === 'sleep' ? 'sit' : 'stand'
  const layer = (l: 'back' | 'front') => look.accessories.filter(a => HERO_ACCESSORIES[a].layer === l).map(a => HERO_ACCESSORIES[a][which])
  const out = shade(decorate(compose(...layer('back'), HERO_POSES[key], ...layer('front')), look.blade), look.palette, MATERIALS3, DETAILS3)
  cache.set(id, out)
  return out
}

// 아직 못 간 단계: 그림 칸을 모두 어두운 한 색으로
export function heroSilhouette(f: { grid: Grid; palette: Palette }): { grid: Grid; palette: Palette } {
  return { grid: f.grid.map(r => r.replace(/[^.]/g, 'k')), palette: { k: 0x3a3a48 } }
}
