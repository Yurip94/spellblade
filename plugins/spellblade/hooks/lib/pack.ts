import { CLEAR, type Grid, type Palette } from './sprites.ts'

// Elthen 그림 묶음(저장소 밖 $HOME/Documents/spellblade-packs/spellblade-pack.json)의 형식과 읽기.
// tools/art/import_elthen.py 가 만든다. 프레임은 글자 줄(Grid) + 색표(Palette, '.' 은 투명)이고,
// 한 스프라이트의 프레임은 모두 같은 크기, 맨 아래 줄이 발이다. 몬스터는 왼쪽(주인공 쪽)을 본다.

export type Sprite = { palette: Palette; anims: Readonly<Record<string, readonly Grid[]>> }
export type Pack = { version: 1; hero: Sprite; monsters: Readonly<Record<string, Sprite>> }

export const HERO_ANIMS = ['idle', 'slash1', 'slash2', 'slash3', 'cast', 'hurt', 'jump', 'down'] as const
export const MONSTER_ANIMS = ['idle', 'attack', 'hit', 'revive'] as const
export const PACK_FILE = 'Documents/spellblade-packs/spellblade-pack.json'
const MAX_SIDE = 128

const isPalette = (v: unknown): v is Palette =>
  typeof v === 'object' && v !== null && !Array.isArray(v) &&
  Object.entries(v).every(([k, c]) => k.length === 1 && k !== CLEAR && Number.isInteger(c) && (c as number) >= 0 && (c as number) <= 0xffffff)

// 스프라이트 하나를 검사한다: 필요한 동작이 있고, 모든 프레임이 같은 크기(128 이하)이고, 글자가 색표에 있다
function sprite(v: unknown, required: readonly string[], known: readonly string[]): Sprite | null {
  if (typeof v !== 'object' || v === null) return null
  const o = v as { palette?: unknown; anims?: unknown }
  if (!isPalette(o.palette) || typeof o.anims !== 'object' || o.anims === null) return null
  const palette = o.palette
  const anims: Record<string, Grid[]> = {}
  let w = -1
  let h = -1
  for (const [name, frames] of Object.entries(o.anims as Record<string, unknown>)) {
    if (!known.includes(name)) continue
    if (!Array.isArray(frames) || frames.length === 0) return null
    for (const f of frames) {
      if (!Array.isArray(f) || f.length === 0 || f.length > MAX_SIDE) return null
      const fw = typeof f[0] === 'string' ? f[0].length : -1
      if (fw <= 0 || fw > MAX_SIDE) return null
      if (w < 0) [w, h] = [fw, f.length]
      if (fw !== w || f.length !== h) return null
      for (const row of f) {
        if (typeof row !== 'string' || row.length !== w) return null
        for (const ch of row) if (ch !== CLEAR && !(ch in palette)) return null
      }
    }
    anims[name] = frames as Grid[]
  }
  return required.every(a => anims[a]) ? { palette, anims } : null
}

// 깨졌거나 판이 다르거나 주인공이 이상하면 null(기본 그림으로). 이상한 몬스터는 그 몬스터만 뺀다
export function parsePack(text: string): Pack | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as { version?: unknown; hero?: unknown; monsters?: unknown }
  if (o.version !== 1) return null
  const hero = sprite(o.hero, HERO_ANIMS, HERO_ANIMS)
  if (!hero) return null
  const monsters: Record<string, Sprite> = {}
  if (typeof o.monsters === 'object' && o.monsters !== null) {
    for (const [id, v] of Object.entries(o.monsters as Record<string, unknown>)) {
      const s = sprite(v, ['idle'], MONSTER_ANIMS)
      if (s) monsters[id] = s
    }
  }
  return { version: 1, hero, monsters }
}
