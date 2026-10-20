// 시험용 작은 그림 묶음: 주인공 8동작 · 몬스터 slime 하나. 색은 알아보기 쉬운 값으로
export const HERO_SKIN = 0xf0c8a0
export const HERO_CLOTH = 0x2d6ac5 // 실제 주인공 옷 색(looks.ts 가 바꾸는 색)
export const SLIME = 0x40c060

const hero4 = (dy = 0) => {
  // 4 × 6: 머리(살색) · 옷(파랑), 맨 아래 줄이 발
  const rows = ['.ss.', '.ss.', 'cccc', '.cc.', '.cc.', 'c..c']
  return dy ? rows.slice(dy).concat(Array(dy).fill('....')) : rows
}

export function fakePack(): any {
  const hero = { palette: { s: HERO_SKIN, c: HERO_CLOTH }, anims: {} as Record<string, string[][]> }
  for (const a of ['idle', 'slash1', 'slash2', 'slash3', 'cast', 'hurt', 'jump', 'down']) hero.anims[a] = [hero4(), hero4()]
  return {
    version: 1,
    hero,
    monsters: {
      slime: { palette: { g: SLIME }, anims: { idle: [['.gg.', 'gggg'], ['....', 'gggg']], attack: [['gggg', 'gggg']], hit: [['gg..', 'gggg']] } },
    },
  }
}

export function withMonster(id: string, o: { ragged?: boolean; size?: number }): any {
  const p = fakePack()
  const n = o.size ?? 4
  const row = 'g'.repeat(n)
  p.monsters[id] = { palette: { g: 0x111111 }, anims: { idle: [o.ragged ? ['gg', 'ggg'] : Array(n).fill(row)] } }
  return p
}

export function withoutHeroAnim(name: string): any {
  const p = fakePack()
  delete p.hero.anims[name]
  return p
}

// 몬스터 하나를 큰 그림으로(보스 시험용)
export function withBigMonster(id: string, h: number, color = 0xaa2222, w = 8): any {
  const p = fakePack()
  p.monsters[id] = { palette: { b: color }, anims: { idle: [Array(h).fill('b'.repeat(w))] } }
  return p
}

// 칼(시험용 색): 주인공 오른쪽 끝 줄에 세운 칼 — 4 × 6 크기는 다른 동작과 같다
export const SWORD = 0xd0e0f0
export const SWORD_FRAME = ['.ssw', '.ssw', 'cccw', '.cc.', '.cc.', 'c..c']
export const PLAIN_FRAME = ['.ss.', '.ss.', 'cccc', '.cc.', '.cc.', 'c..c']

// 주인공 동작 하나를 바꾼(또는 더한) 묶음 — 색표에 칼 색 w 를 넣는다
export function withHeroAnim(name: string, frames: string[][]): any {
  const p = fakePack()
  p.hero.palette.w = SWORD
  p.hero.anims[name] = frames
  return p
}
