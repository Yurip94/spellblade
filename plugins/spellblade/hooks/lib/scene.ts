import { BACKDROPS, FX, GLYPHS, MONSTER_ART, type FxId } from './art3.ts'
import { MS } from './balance.ts'
import { legacyMonsterTier, monsterPoseAt, type Battle } from './battle.ts'
import { heroFrame, type HeroPose } from './hero3.ts'
import { monsterFrame } from './monsters.ts'
import { blit, escapeXml, mixRgb, toRgb, type RgbGrid } from './rgb.ts'

// 3차 장면 160 × 64 점: 왼쪽 마검사 · 오른쪽 몬스터(낮 숲) 또는 모닥불(밤 숲)
export const SCENE_W = 160
export const SCENE_H = 64
export const GROUND = 52      // 풀 윗줄 = 마검사 · 몬스터 발끝 줄
export const HERO_X = 12
export const HERO_Y = 8
export const MONSTER_X = 57
export const CAST_TIP = { x: HERO_X + 42, y: HERO_Y + 24 }   // 영창 자세의 칼끝 바로 앞
const FIRE_X = HERO_X + 52

export type SceneInput = { mode: 'battle' | 'rest'; tier: number; pose: HeroPose; frame: 0 | 1; battle: Battle | null; now: number; dimMagic: boolean }

// ---- 재료(한 번만 만든다) ----

let backdrops: { day: RgbGrid; night: RgbGrid } | null = null
const bd = () => (backdrops ??= { day: toRgb(BACKDROPS.day), night: toRgb(BACKDROPS.night) })
const fxCache = new Map<FxId, RgbGrid>()
const fx = (id: FxId) => {
  let g = fxCache.get(id)
  if (!g) fxCache.set(id, (g = toRgb(FX[id])))
  return g
}

// 몬스터 칸의 장면 자리와 몸 범위(idle0 기준): head 는 첫 불투명 줄, feet 는 맨 아래 불투명 세 줄의 좌우
type Box = { x: number; y: number; w: number; h: number; head: number; left: number; right: number; mid: number; footLeft: number; footRight: number }
const boxes = new Map<number, Box>()
const tierAt = (t: number) => Math.max(0, Math.min(MONSTER_ART.length - 1, Math.floor(t)))

export function monsterBox(tier: number): Box {
  const t = tierAt(tier)
  const hit = boxes.get(t)
  if (hit) return hit
  const g = MONSTER_ART[t].frames.idle0
  const h = g.length
  const w = g[0].length
  const y = GROUND - (h - 1)
  let top = h, bottom = -1, left = w, right = -1
  g.forEach((r, gy) => {
    for (let gx = 0; gx < w; gx++) {
      if (r[gx] === '.') continue
      top = Math.min(top, gy); bottom = Math.max(bottom, gy); left = Math.min(left, gx); right = Math.max(right, gx)
    }
  })
  let footLeft = w, footRight = -1
  for (let gy = Math.max(0, bottom - 2); gy <= bottom; gy++) {
    for (let gx = 0; gx < w; gx++) if (g[gy][gx] !== '.') { footLeft = Math.min(footLeft, gx); footRight = Math.max(footRight, gx) }
  }
  const box: Box = {
    x: MONSTER_X, y, w, h, head: y + top, left: MONSTER_X + left, right: MONSTER_X + right,
    mid: y + Math.round((top + bottom) / 2), footLeft: MONSTER_X + footLeft, footRight: MONSTER_X + footRight,
  }
  boxes.set(t, box)
  return box
}

// ---- 열쇠 ----

const poofPhase = (b: Battle, now: number) => {
  const t = now - (b.poofUntil - MS.poof)
  return t < MS.poof / 2 ? 1 : t < MS.poof ? 2 : 3   // 3 = 연기도 끝남
}
const livePopups = (b: Battle, now: number) => b.popups.filter(p => now >= p.at && now - p.at < MS.popup)
const barWidth = (box: Box) => Math.max(16, Math.min(30, box.right - box.left - 1))
const barCells = (b: Battle, w: number) => (b.hp <= 0 ? 0 : Math.max(1, Math.round((w * b.hp) / b.maxHp)))

export function sceneKey(s: SceneInput): string {
  const parts: (string | number)[] = [s.mode, tierAt(s.tier), s.pose, s.frame, s.dimMagic ? 1 : 0]
  if (s.mode === 'battle' && s.battle) {
    const b = s.battle
    const pose = monsterPoseAt(b, s.now)
    const t = legacyMonsterTier(b)
    parts.push(t, pose, pose === 'poof' ? poofPhase(b, s.now) : 0, barCells(b, barWidth(monsterBox(t))))
    for (const p of livePopups(b, s.now)) parts.push(`${p.kind}:${p.text}:${Math.floor((s.now - p.at) / MS.popupRise)}`)
  }
  return parts.join('|')
}

// ---- 그리기 ----

const set = (g: RgbGrid, x: number, y: number, v: number) => {
  if (y >= 0 && y < g.length && x >= 0 && x < g[y].length) g[y][x] = v
}

function shadow(g: RgbGrid, x0: number, x1: number, k = 1): void {
  for (const [y, a] of [[GROUND + 1, 0.35], [GROUND + 2, 0.25]] as const) {
    for (let x = x0; x <= x1; x++) {
      const v = g[y]?.[x]
      if (v != null) g[y][x] = mixRgb(v, 0x000000, a * k)
    }
  }
}

// 모닥불 둘레 주황빛(가까울수록 진하게)
function campfireGlow(g: RgbGrid): void {
  const cx = FIRE_X + 6
  const cy = GROUND - 6
  for (let y = 0; y < SCENE_H; y++) {
    for (let x = 0; x < SCENE_W; x++) {
      const d = Math.hypot(x - cx, (y - cy) * 1.25)
      const v = g[y][x]
      if (d < 40 && v !== null) g[y][x] = mixRgb(v, 0xff9a3a, (1 - d / 40) * 0.5)
    }
  }
}

function hpBar(g: RgbGrid, x: number, y: number, w: number, filled: number): void {
  const edge = 0x101018
  for (let i = 0; i < w + 2; i++) { set(g, x + i, y, edge); set(g, x + i, y + 3, edge) }
  for (const dy of [1, 2]) {
    set(g, x, y + dy, edge)
    set(g, x + w + 1, y + dy, edge)
    for (let i = 0; i < w; i++) set(g, x + 1 + i, y + dy, i < filled ? (dy === 1 ? 0xff5050 : 0xd02a2a) : 0x3a1414)
  }
}

type Font = keyof typeof GLYPHS
const SPACE: Record<Font, number> = { damage: 4, small: 3, big: 4 }

function textWidth(text: string, font: Font): number {
  let w = 0
  for (const ch of text) w += ch === ' ' ? SPACE[font] : (GLYPHS[font][ch]?.[0].length ?? 0) + 1
  return Math.max(0, w - 1)
}

// '#' 칸을 줄마다 다른 색으로 채우고 8방향 테두리를 두른다. hop 이면 글자마다 1점씩 오르내린다(데미지 숫자)
function drawText(g: RgbGrid, text: string, x: number, y: number, font: Font, fill: (row: number) => number, edge: number, hop = false): void {
  const cells = new Map<string, [number, number, number]>()
  let cx = x
  ;[...text].forEach((ch, i) => {
    if (ch === ' ') { cx += SPACE[font]; return }
    const glyph = GLYPHS[font][ch]
    if (!glyph) return
    const dx = hop ? i % 2 : 0
    const dy = hop ? -(i % 2) : 0
    glyph.forEach((r, gy) => {
      for (let gx = 0; gx < r.length; gx++) if (r[gx] === '#') cells.set(`${cx + gx + dx},${y + gy + dy}`, [cx + gx + dx, y + gy + dy, gy])
    })
    cx += glyph[0].length + 1
  })
  for (const [px, py] of cells.values()) {
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) if (!cells.has(`${px + ox},${py + oy}`)) set(g, px + ox, py + oy, edge)
  }
  for (const [px, py, row] of cells.values()) set(g, px, py, fill(row))
}

const DAMAGE_FILL = (row: number) => (row < 3 ? 0xfff27a : row < 6 ? 0xffc23a : 0xff8a1a)
const XP_FILL = (row: number) => (row < 3 ? 0xe8ffb0 : row < 5 ? 0xb4f070 : 0x7ad040)
const GOLD_FILL = (row: number) => (row < 3 ? 0xfffbe0 : row < 6 ? 0xffe060 : 0xffb020)
const DIM = { color: 0x262636, k: 0.55 }

function drawMonster(g: RgbGrid, b: Battle, now: number): Box {
  const tier = legacyMonsterTier(b)
  const box = monsterBox(tier)
  const raw = monsterPoseAt(b, now)
  const pose = raw === 'revive' ? 'hit' : raw   // 3.0 그림에는 되살아나는 그림이 없다
  if (pose === 'poof') {
    const phase = poofPhase(b, now)
    if (phase < 3) {
      const cloud = fx(phase === 1 ? 'poof1' : 'poof2')
      blit(g, cloud, Math.round((box.left + box.right) / 2 - cloud[0].length / 2), Math.round(box.mid - cloud.length / 2))
    }
    return box
  }
  const floating = !/[^.]/.test(MONSTER_ART[tier].frames.idle0[box.h - 1])   // 유령: 그림자를 옅게
  shadow(g, box.footLeft - 1, box.footRight + 1, floating ? 0.5 : 1)
  blit(g, toRgb(monsterFrame(tier, pose)), box.x, box.y)
  const w = barWidth(box)
  hpBar(g, Math.floor((box.left + box.right + 1) / 2 - (w + 2) / 2), Math.max(1, box.head - 6), w, barCells(b, w))
  return box
}

function effects(g: RgbGrid, s: SceneInput, box: Box | null): void {
  const tip = CAST_TIP
  switch (s.pose) {
    case 'slash':
      blit(g, fx('slashArc'), HERO_X + 38, HERO_Y + 38 - 13)   // 원의 중심이 칼 앞
      break
    case 'cast1':
    case 'cast2':
      blit(g, fx(s.pose === 'cast1' ? 'castGlow1' : 'castGlow2'), tip.x - 6, tip.y - 6, s.dimMagic ? DIM : undefined)
      break
    case 'castHit':
      blit(g, fx('castGlow2'), tip.x - 6, tip.y - 6)
      if (box) blit(g, fx('bolt'), box.left + 1 - 15, box.mid - 4)   // 탄 머리가 몬스터 몸에 닿는다
      break
    case 'castFail':
      blit(g, fx('sweat'), HERO_X + 37, HERO_Y + 15)
      blit(g, fx('sweat'), HERO_X + 5, HERO_Y + 18)
      for (const [dx, dy] of [[9, -6], [8, 5], [-4, -5], [10, 0]]) set(g, tip.x + dx, tip.y + dy, 0xffe060)   // 반동 불꽃
      break
    case 'levelup':
      drawText(g, 'LEVEL UP', Math.floor((SCENE_W - textWidth('LEVEL UP', 'big')) / 2), 2, 'big', GOLD_FILL, 0x6a3a08)
      break
    case 'sleep':
      blit(g, fx('zzz'), HERO_X + 36, HERO_Y - 2)
      break
  }
}

// 떠 있는 숫자: 몬스터 체력 막대 위 가운데(큰 몬스터는 몸 위), 새것이 아래 · 오래된 것이 10점 위, 0.4초마다 2점씩 오른다
function popups(g: RgbGrid, b: Battle, now: number, box: Box): void {
  const list = livePopups(b, now)
  const cx = (box.left + box.right + 1) / 2
  const base = Math.max(11, box.head - 17)
  list.forEach((p, i) => {
    const font: Font = p.kind === 'damage' ? 'damage' : 'small'
    const y = base - 2 * Math.floor((now - p.at) / MS.popupRise) - 10 * (list.length - 1 - i)
    const x = Math.round(cx - textWidth(p.text, font) / 2)
    if (p.kind === 'damage') drawText(g, p.text, x, y, font, DAMAGE_FILL, 0x6a1408, true)
    else drawText(g, p.text, x, y, font, XP_FILL, 0x1c4a14)
  })
}

function draw(s: SceneInput): RgbGrid {
  const rest = s.mode === 'rest'
  const g = (rest ? bd().night : bd().day).map(r => r.slice())
  if (rest) {
    campfireGlow(g)
    const fire = fx(s.frame ? 'fire2' : 'fire1')
    blit(g, fire, FIRE_X, GROUND - fire.length)   // 장작이 풀 윗줄 바로 위
  }
  const sitting = s.pose === 'sit' || s.pose === 'sleep'
  shadow(g, HERO_X + (sitting ? 12 : 15), HERO_X + (sitting ? 40 : 33))
  if (s.pose === 'levelup') {
    const pillar = fx(s.frame ? 'pillar2' : 'pillar1')
    blit(g, pillar, HERO_X + 22 - Math.round(pillar[0].length / 2), GROUND + 1 - pillar.length)   // 마검사 뒤
  }
  blit(g, toRgb(heroFrame(s.tier, s.pose)), HERO_X, HERO_Y, rest ? { color: 0xffb060, k: 0.12 } : undefined)
  const box = !rest && s.battle ? drawMonster(g, s.battle, s.now) : null
  effects(g, s, box)
  if (box && s.battle) popups(g, s.battle, s.now, box)
  return g
}

// 같은 열쇠면 같은 격자(최근 32개)
const CACHE_MAX = 32
const cache = new Map<string, RgbGrid>()

export function sceneGrid(s: SceneInput): RgbGrid {
  const key = sceneKey(s)
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const g = draw(s)
  cache.set(key, g)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string)
  return g
}

// 마검사 발밑 이름표(데스크톱 SVG 에만, viewBox 점 좌표). 글자는 2px 기준 11px 로 장면과 같이 커지고, 테두리는 화면 1px
export function nameTagSvg(name: string, pixel: number): string {
  const size = 5.5
  // 한글 · 한자 · 전각과 이모지(그림 글자)는 한 칸 폭, 그 밖은 0.6 칸
  const wide = (c: string) => {
    const cp = c.codePointAt(0) ?? 0
    return /[\u1100-\u11ff\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/.test(c) || cp >= 0x1f000 || (cp >= 0x2600 && cp <= 0x27bf)
  }
  const textW = [...name].reduce((w, c) => w + (wide(c) ? 1 : 0.6) * size, 0)
  const w = Math.ceil(textW + 4)
  const h = size + 2
  const cx = HERO_X + 24
  const top = GROUND + 2
  const line = 1 / pixel
  return (
    `<rect x="${cx - w / 2}" y="${top}" width="${w}" height="${h}" rx="1.5" fill="#24242c" fill-opacity="0.85" stroke="#0c0c12" stroke-width="${line}"/>` +
    `<text x="${cx}" y="${top + h / 2}" font-size="${size}" fill="#ffffff" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif">${escapeXml(name)}</text>`
  )
}
