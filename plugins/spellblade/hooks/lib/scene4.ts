import { BACKDROPS4, FX4, GLYPHS4, type Fx4Id } from './art4.ts'
import { MS } from './balance.ts'
import { monsterPoseAt, type Battle } from './battle.ts'
import type { HeroPose } from './hero3.ts'
import { LOOKS, lookPalette } from './looks.ts'
import type { Pack, Sprite } from './pack.ts'
import { tierOf } from './progress.ts'
import { blit, escapeXml, mixRgb, toRgb, type RgbGrid } from './rgb.ts'
import { mapOf, monsterDefOf, ROSTER, type BossDef, type MonsterDef } from './roster.ts'

// 4차 장면 80 × 32 점(4차 설계 5 · 6장): 왼쪽 Elthen 주인공 · 오른쪽 몬스터(맵 5개 낮) 또는 모닥불(밤).
// 주인공 · 몬스터 발은 26행, 주인공 왼쪽은 x 6 고정, 몬스터는 주인공 서기 그림 오른쪽 + 6점. 큰 보스는 위 · 오른쪽이 잘린다.
export const SCENE4_W = 80
export const SCENE4_H = 32
export const GROUND4 = 26
const HERO_LEFT = 6
const MONSTER_GAP = 6

export type Scene4Input = { mode: 'battle' | 'rest'; level: number; pose: HeroPose; battle: Battle | null; now: number; dimMagic: boolean }

// ---- 재료 캐시(묶음마다) ----

type Frame = RgbGrid
type Made = {
  heroBox: { left: number; right: number; width: number; height: number }
  frames: Map<string, Frame>
  grids: Map<string, RgbGrid>
}
const made = new WeakMap<Pack, Made>()

function bounds(g: Frame): { left: number; right: number; top: number; bottom: number } {
  let left = Infinity, right = -1, top = Infinity, bottom = -1
  g.forEach((r, y) => r.forEach((v, x) => {
    if (v === null) return
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y)
  }))
  return right < 0 ? { left: 0, right: 0, top: 0, bottom: 0 } : { left, right, top, bottom }
}

function stateOf(pack: Pack): Made {
  let m = made.get(pack)
  if (!m) {
    const idle = toRgb({ grid: pack.hero.anims.idle[0], palette: pack.hero.palette })
    const b = bounds(idle)
    m = { heroBox: { left: b.left, right: b.right, width: idle[0]?.length ?? 0, height: idle.length }, frames: new Map(), grids: new Map() }
    made.set(pack, m)
  }
  return m
}

const tintOf = (index: number) => [0xff5050, 0x50a0ff, 0xffd040, 0x60e080, 0xc070ff][index % 5]

// 몬스터 그림: 묶음에 있으면 그것, 정예면 원본을 물들여, 없으면 가까운 단계의 있는 몬스터를 물들여(보스는 붉게)
function spriteFor(pack: Pack, def: MonsterDef | BossDef, index: number): { sprite: Sprite; tint: { color: number; k: number } | null; key: string } | null {
  const own = pack.monsters[def.id]
  if (own) return { sprite: own, tint: null, key: def.id }
  if (def.elite && pack.monsters[def.elite.of]) return { sprite: pack.monsters[def.elite.of], tint: { color: def.elite.tint, k: def.elite.k }, key: def.id }
  const boss = 'level' in def
  for (let d = 0; d < ROSTER.length; d++) {
    for (const i of [index - d, index + d]) {
      const m = ROSTER[i]
      const id = m ? (m.elite ? m.elite.of : m.id) : null
      if (id && pack.monsters[id]) return { sprite: pack.monsters[id], tint: boss ? { color: 0xd03030, k: 0.4 } : { color: tintOf(index), k: 0.35 }, key: `${def.id}~${id}` }
    }
  }
  return null
}

function frameOf(pack: Pack, key: string, make: () => Frame): Frame {
  const m = stateOf(pack)
  let f = m.frames.get(key)
  if (!f) m.frames.set(key, (f = make()))
  return f
}

const mixAll = (g: Frame, color: number, k: number): Frame => g.map(r => r.map(v => (v === null ? null : mixRgb(v, color, k))))

// ---- 자세 → 주인공 그림 ----

function heroAnim(s: Scene4Input): { anim: string; index: (len: number) => number } {
  const loop = (len: number) => Math.floor(s.now / MS.castFrame) % len
  switch (s.pose) {
    case 'idle': case 'blink': return { anim: 'idle', index: loop }
    case 'slash': return { anim: `slash${(Math.floor(s.now / MS.slash) % 3) + 1}`, index: len => Math.floor(len / 3) }
    case 'cast1': return { anim: 'cast', index: len => Math.min(1, len - 1) }
    case 'cast2': return { anim: 'cast', index: len => Math.min(2, len - 1) }
    case 'castHit': return { anim: 'cast', index: len => len - 1 }
    case 'castFail': return { anim: 'hurt', index: () => 0 }
    case 'hit': return { anim: 'hurt', index: len => Math.min(1, len - 1) }
    case 'victory': case 'levelup': return { anim: 'jump', index: len => Math.floor(len / 2) }
    case 'sit': return { anim: 'idle', index: () => 0 }
    case 'sleep': return { anim: 'down', index: len => len - 1 }
  }
}

function heroFrame4(pack: Pack, s: Scene4Input): { key: string; frame: () => Frame } {
  const { anim, index } = heroAnim(s)
  const frames = pack.hero.anims[anim] ?? pack.hero.anims.idle
  const i = index(frames.length)
  const tier = tierOf(s.level)
  const warm = s.mode === 'rest' ? 1 : 0
  const key = `hero|${anim}|${i}|${tier}|${warm}`
  return {
    key,
    frame: () => {
      let g = toRgb({ grid: frames[i], palette: lookPalette(pack.hero.palette, tier) })
      if (warm) g = mixAll(g, 0xffb060, 0.15)
      return g
    },
  }
}

// ---- 몬스터 자세 → 그림 ----

function monsterFrame4(pack: Pack, b: Battle, now: number): { key: string; frame: () => Frame; shift: number } | null {
  const def = monsterDefOf(b)
  const found = spriteFor(pack, def, b.index)
  if (!found) return null
  const { sprite, tint } = found
  const pose = monsterPoseAt(b, now)
  const idle = sprite.anims.idle
  let anim = 'idle'
  let i = Math.floor(now / MS.castFrame) % idle.length
  let flash: { color: number; k: number } | null = null
  let shift = 0
  if (pose === 'attack') {
    if (sprite.anims.attack) [anim, i] = ['attack', Math.floor(sprite.anims.attack.length / 2)]
    else [i, shift] = [0, -2]
  } else if (pose === 'hit') {
    if (sprite.anims.hit) [anim, i] = ['hit', 0]
    else [i, flash] = [0, { color: 0xffffff, k: 0.7 }]
  } else if (pose === 'revive') {
    const r = sprite.anims.revive
    if (r) [anim, i] = ['revive', Math.max(0, Math.min(r.length - 1, Math.floor(((now - (b.reviveUntil - MS.revive)) / MS.revive) * r.length)))]
    else [i, flash] = [0, { color: 0xffd040, k: 0.5 }]
  }
  const frames = sprite.anims[anim]
  const key = `mon|${found.key}|${anim}|${i}|${flash ? flash.color : 0}`
  return {
    key,
    shift,
    frame: () => {
      let g = toRgb({ grid: frames[i], palette: sprite.palette })
      if (tint) g = mixAll(g, tint.color, tint.k)
      if (flash) g = mixAll(g, flash.color, flash.k)
      return g
    },
  }
}

// ---- 그리기 도우미 ----

const set = (g: RgbGrid, x: number, y: number, v: number) => {
  if (y >= 0 && y < g.length && x >= 0 && x < g[y].length) g[y][x] = v
}

function shadow(g: RgbGrid, x0: number, x1: number): void {
  for (let x = x0; x <= x1; x++) {
    const v = g[GROUND4 + 1]?.[x]
    if (v != null) g[GROUND4 + 1][x] = mixRgb(v, 0x000000, 0.3)
  }
}

// 빛 테두리: 그림 둘레 투명 칸(위 · 아래 · 옆)에 빛을 섞는다
function glow(g: RgbGrid, f: Frame, ox: number, oy: number, color: number, k: number): void {
  const at = (x: number, y: number) => f[y]?.[x] ?? null
  f.forEach((r, y) => r.forEach((v, x) => {
    if (v !== null) return
    if ([at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].some(n => n !== null)) {
      const gy = oy + y
      const gx = ox + x
      const bg = g[gy]?.[gx]
      if (bg != null) g[gy][gx] = mixRgb(bg, color, k)
    }
  }))
}

const fxCache = new Map<Fx4Id, RgbGrid>()
const fx = (id: Fx4Id) => {
  let g = fxCache.get(id)
  if (!g) fxCache.set(id, (g = toRgb(FX4[id])))
  return g
}

function textWidth(text: string): number {
  return [...text].reduce((w, c) => w + (c === ' ' ? 2 : 4), 0) - 1
}

// 3 × 5 글자: '#' 칸을 칠하고 8방향 테두리
function drawText(g: RgbGrid, text: string, x: number, y: number, fill: number, edge: number): void {
  const cells = new Set<string>()
  let cx = x
  for (const ch of text) {
    if (ch === ' ') { cx += 2; continue }
    const glyph = GLYPHS4[ch]
    if (glyph) glyph.forEach((r, gy) => [...r].forEach((c, gx) => { if (c === '#') cells.add(`${cx + gx},${y + gy}`) }))
    cx += 4
  }
  for (const p of cells) {
    const [px, py] = p.split(',').map(Number)
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) if (!cells.has(`${px + ox},${py + oy}`)) set(g, px + ox, py + oy, edge)
  }
  for (const p of cells) {
    const [px, py] = p.split(',').map(Number)
    set(g, px, py, fill)
  }
}

const barCells = (b: Battle, w: number) => (b.hp <= 0 ? 0 : Math.max(1, Math.round((w * b.hp) / b.maxHp)))
const livePopups = (b: Battle, now: number) => b.popups.filter(p => now >= p.at && now - p.at < MS.popup)
const poofPhase = (b: Battle, now: number) => {
  const t = now - (b.poofUntil - MS.poof)
  return t < MS.poof / 2 ? 1 : t < MS.poof ? 2 : 3
}

// ---- 열쇠 ----

export function scene4Key(s: Scene4Input): string {
  const rest = s.mode === 'rest'
  const sleeping = s.pose === 'sleep'
  const { anim, index } = heroAnim(s)
  // 그림 수를 모르는 열쇠 단계에서는 시간 조각만 넣는다(같은 시간 조각이면 같은 그림)
  const heroBeat = anim === 'idle' && s.pose !== 'sit' ? Math.floor(s.now / MS.castFrame) : anim.startsWith('slash') ? Math.floor(s.now / MS.slash) % 3 : 0
  const parts: (string | number)[] = [s.mode, mapOf(s.level), tierOf(s.level), s.pose, heroBeat, index(1000), s.dimMagic ? 1 : 0]
  if (rest && !sleeping) parts.push('fire', Math.floor(s.now / MS.fireFrame) % 2)
  if (s.pose === 'levelup') parts.push('pillar', Math.floor(s.now / MS.castFrame) % 2)
  if (!rest && s.battle) {
    const b = s.battle
    const pose = monsterPoseAt(b, s.now)
    parts.push(b.index, b.boss, pose, pose === 'poof' ? poofPhase(b, s.now) : Math.floor(s.now / MS.castFrame), b.hp, b.maxHp)
    if (pose === 'revive') parts.push(Math.floor((s.now - (b.reviveUntil - MS.revive)) / 100))
    for (const p of livePopups(b, s.now)) parts.push(`${p.kind}:${p.text}:${Math.floor((s.now - p.at) / MS.popupRise)}`)
  }
  return parts.join('|')
}

// ---- 그리기 ----

function draw(pack: Pack, s: Scene4Input): RgbGrid {
  const rest = s.mode === 'rest'
  const map = mapOf(s.level)
  const g = toRgb(rest ? BACKDROPS4[map].night : BACKDROPS4[map].day)
  const m = stateOf(pack)
  const heroRight = HERO_LEFT + (m.heroBox.right - m.heroBox.left)
  const heroX = HERO_LEFT - m.heroBox.left
  const heroY = GROUND4 - (m.heroBox.height - 1)
  if (rest) {
    const fire = fx(s.pose === 'sleep' ? 'fire1' : Math.floor(s.now / MS.fireFrame) % 2 ? 'fire2' : 'fire1')
    const fx0 = heroRight + 4
    const cx = fx0 + 3
    const cy = GROUND4 - 4
    for (let y = 0; y < SCENE4_H; y++) for (let x = 0; x < SCENE4_W; x++) {
      const d = Math.hypot(x - cx, (y - cy) * 1.25)
      if (d < 20) g[y][x] = mixRgb(g[y][x]!, 0xff9a3a, (1 - d / 20) * 0.45)
    }
    blit(g, fire, fx0, GROUND4 + 1 - fire.length)
  }
  shadow(g, HERO_LEFT + 1, heroRight - 1)
  if (s.pose === 'levelup') {
    const pillar = fx(Math.floor(s.now / MS.castFrame) % 2 ? 'pillar2' : 'pillar1')
    blit(g, pillar, Math.round((HERO_LEFT + heroRight) / 2 - pillar[0].length / 2), GROUND4 + 1 - pillar.length)
  }
  const hero = heroFrame4(pack, s)
  const heroGrid = frameOf(pack, hero.key, hero.frame)
  const look = LOOKS[tierOf(s.level)]
  if (look.glow) glow(g, heroGrid, heroX, heroY, look.glow.color, look.glow.k)
  blit(g, heroGrid, heroX, heroY)

  let box: { left: number; right: number; head: number; mid: number } | null = null
  if (!rest && s.battle) box = drawMonster(pack, g, s.battle, s.now, heroRight + MONSTER_GAP)
  const tipX = heroRight + 1
  const tipY = heroY + Math.round(m.heroBox.height * 0.45)
  switch (s.pose) {
    case 'cast1':
    case 'cast2':
      blit(g, fx(s.pose === 'cast1' ? 'glow1' : 'glow2'), tipX - 2, tipY - 3, s.dimMagic ? { color: 0x262636, k: 0.55 } : undefined)
      break
    case 'castHit':
      if (box) { const bolt = fx('bolt'); blit(g, bolt, box.left - bolt[0].length + 3, box.mid - 2) }
      break
    case 'castFail':
      blit(g, fx('smoke'), tipX - 2, tipY - 6)
      blit(g, fx('sweat'), HERO_LEFT + 1, heroY + Math.round(m.heroBox.height * 0.3))
      break
    case 'levelup':
      drawText(g, 'LEVEL UP', Math.floor((SCENE4_W - textWidth('LEVEL UP')) / 2), 1, 0xffe060, 0x6a3a08)
      break
    case 'sleep':
      blit(g, fx('zzz'), heroRight - 2, Math.max(0, GROUND4 - 12))
      break
  }
  if (box && s.battle) popups(g, s.battle, s.now, box)
  return g
}

function drawMonster(pack: Pack, g: RgbGrid, b: Battle, now: number, left: number): { left: number; right: number; head: number; mid: number } | null {
  const pose = monsterPoseAt(b, now)
  const got = monsterFrame4(pack, b, now)
  if (!got) return null
  // 자리는 언제나 idle 첫 장 기준(자세가 바뀌어도 몬스터가 움직이지 않게)
  const idleKey = got.key.split('|').slice(0, 2).join('|') + '|base'
  const base = frameOf(pack, idleKey, () => {
    const def = monsterDefOf(b)
    const found = spriteFor(pack, def, b.index)!
    return toRgb({ grid: found.sprite.anims.idle[0], palette: found.sprite.palette })
  })
  const bb = bounds(base)
  const y = GROUND4 - (base.length - 1)
  // 오른쪽이 잘린 큰 몬스터는 보이는 부분만 상자로(체력 막대 · 숫자가 화면 안 가운데에)
  const box = { left, right: Math.min(SCENE4_W - 1, left + (bb.right - bb.left)), head: Math.max(0, y + bb.top), mid: Math.min(GROUND4, Math.max(0, y + Math.round((bb.top + bb.bottom) / 2))) }
  if (pose === 'poof') {
    const phase = poofPhase(b, now)
    if (phase < 3) {
      const cloud = fx(phase === 1 ? 'poof1' : 'poof2')
      blit(g, cloud, Math.round((box.left + box.right) / 2 - cloud[0].length / 2), Math.round(box.mid - cloud.length / 2))
    }
    return box
  }
  shadow(g, box.left, box.right)
  const f = frameOf(pack, got.key, got.frame)
  blit(g, f, left - bb.left + got.shift, GROUND4 - (f.length - 1))
  const w = Math.max(10, Math.min(24, box.right - box.left - 1))
  const bx = Math.floor((box.left + box.right + 1) / 2 - (w + 2) / 2)
  const by = Math.max(0, box.head - 4)
  const edge = 0x101018
  for (let i = 0; i < w + 2; i++) { set(g, bx + i, by, edge); set(g, bx + i, by + 2, edge) }
  set(g, bx, by + 1, edge)
  set(g, bx + w + 1, by + 1, edge)
  const filled = barCells(b, w)
  for (let i = 0; i < w; i++) set(g, bx + 1 + i, by + 1, i < filled ? 0xff5050 : 0x3a1414)
  return box
}

// 떠 있는 숫자: 체력 막대 위 가운데, 새것이 아래 · 오래된 것이 7점 위, 0.4초마다 1점씩 오른다.
// 머리가 높아(11행 위) 막대 위에 자리가 없으면 막대 아래에 오래된 것부터 차례로, 오르지 않는다(막대를 가리지 않게)
function popups(g: RgbGrid, b: Battle, now: number, box: { left: number; right: number; head: number }): void {
  const list = livePopups(b, now)
  const cx = (box.left + box.right + 1) / 2
  const above = box.head >= 11
  const under = Math.max(0, box.head - 4) + 4
  list.forEach((p, i) => {
    const text = p.text
    const y = above ? box.head - 10 - Math.floor((now - p.at) / MS.popupRise) - 7 * (list.length - 1 - i) : under + 7 * i
    const x = Math.round(cx - textWidth(text) / 2)
    if (p.kind === 'damage') drawText(g, text, x, y, 0xffe060, 0x6a1408)
    else drawText(g, text, x, y, 0xb4f070, 0x1c4a14)
  })
}

// 같은 묶음 · 같은 열쇠면 같은 격자(최근 32개)
const CACHE_MAX = 32

export function scene4Grid(pack: Pack, s: Scene4Input): RgbGrid {
  const m = stateOf(pack)
  const key = scene4Key(s)
  const hit = m.grids.get(key)
  if (hit) {
    m.grids.delete(key)
    m.grids.set(key, hit)
    return hit
  }
  const g = draw(pack, s)
  m.grids.set(key, g)
  if (m.grids.size > CACHE_MAX) m.grids.delete(m.grids.keys().next().value as string)
  return g
}

// 주인공 발밑 이름표(데스크톱 SVG, viewBox 점 좌표): 밴드 4px 에서 11px 글자
export function nameTag4Svg(name: string, pixel: number): string {
  const size = 2.75
  const wide = (c: string) => {
    const cp = c.codePointAt(0) ?? 0
    return /[ᄀ-ᇿ　-鿿가-힯＀-￯]/.test(c) || cp >= 0x1f000 || (cp >= 0x2600 && cp <= 0x27bf)
  }
  const textW = [...name].reduce((w, c) => w + (wide(c) ? 1 : 0.6) * size, 0)
  const w = Math.ceil(textW + 2)
  const h = size + 1
  const cx = HERO_LEFT + 8
  const top = GROUND4 + 1.5
  const line = 1 / pixel
  return (
    `<rect x="${cx - w / 2}" y="${top}" width="${w}" height="${h}" rx="0.75" fill="#24242c" fill-opacity="0.85" stroke="#0c0c12" stroke-width="${line}"/>` +
    `<text x="${cx}" y="${top + h / 2}" font-size="${size}" fill="#ffffff" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif">${escapeXml(name)}</text>`
  )
}
