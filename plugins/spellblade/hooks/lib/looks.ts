import type { Palette } from './sprites.ts'

// 장비 20단계의 모습(4차 설계 6장): Elthen 주인공 그림의 옷 · 스카프 · 칼 색을 바꾸고, 10단계부터 빛 테두리.
// 열쇠는 주인공 시트의 색 값이다(그림이 아니라 색 값만 저장소에 둔다).
const CLOTH = [0x285daa, 0x2d6ac5] as const        // 옷: 어두운 · 밝은
const SCARF = [0x741a33, 0x9e293b] as const        // 스카프: 어두운 · 밝은
const BLADE = [0x50565d, 0x9299a4, 0xd4d4d7] as const // 칼: 어두운 · 가운데 · 밝은

type Pair = readonly [number, number]
type Triple = readonly [number, number, number]
export type Look = { remap: Readonly<Record<number, number>>; glow: { color: number; k: number } | null }

function look(cloth: Pair | null, scarf: Pair | null, blade: Triple | null, glow: Look['glow'] = null): Look {
  const remap: Record<number, number> = {}
  cloth?.forEach((c, i) => (remap[CLOTH[i]] = c))
  scarf?.forEach((c, i) => (remap[SCARF[i]] = c))
  blade?.forEach((c, i) => (remap[BLADE[i]] = c))
  return { remap, glow }
}

const SILVER: Triple = [0x6a7480, 0xb8c2cc, 0xeef2f6]
const GOLD_SCARF: Pair = [0x9a7a20, 0xd0b040]
const faint = (color: number) => ({ color, k: 0.35 })
const bright = (color: number) => ({ color, k: 0.6 })

export const LOOKS: readonly Look[] = [
  look(null, null, null),                                                                    // 0 나무 검 · 천 옷
  look([0x5a3a22, 0x7a5232], null, null),                                                     // 1 갈색 옷
  look([0x3e2a1a, 0x5a3e28], null, SILVER),                                                   // 2 짙은 갈색 · 은빛 칼
  look([0x4a4e56, 0x6a707a], null, [0x2a4a8a, 0x4a7ad0, 0x9ac0ff]),                           // 3 회색 옷 · 푸른 칼
  look([0x7a8494, 0xa6b0bc], [0x1a3a7a, 0x2a5ab0], SILVER),                                   // 4 은빛 옷 · 파란 스카프
  look([0x1a2050, 0x2a3278], null, [0x4a2a7a, 0x7a4ac0, 0xc09aff]),                           // 5 남색 옷 · 보라 칼
  look([0x3a7ab8, 0x5aa0e0], null, [0x8a6a10, 0xd0b030, 0xfff080]),                           // 6 하늘색 옷 · 노란 칼
  look([0x4a8ac8, 0x6ab4f0], GOLD_SCARF, [0x8a6a10, 0xd0b030, 0xfff080]),                     // 7 번개 두름
  look([0xa0a8b4, 0xd0d6de], null, [0x1a6a6a, 0x30b0a8, 0x90f0e8]),                           // 8 흰 은빛 옷 · 청록 칼
  look([0x7a1a1a, 0xb02a2a], GOLD_SCARF, [0x8a3a0a, 0xe07020, 0xffc070]),                     // 9 붉은 옷 · 주황 칼
  look([0x6aa0c8, 0xa8d8f0], null, [0x3a7ab0, 0x7ac0f0, 0xd8f4ff], faint(0x9adcff)),          // 10 얼음색 · 빛 테두리
  look([0xc8b070, 0xf0e6c0], GOLD_SCARF, SILVER, faint(0xfff0b0)),                            // 11 흰 금빛 옷
  look([0xa07818, 0xd8a830], GOLD_SCARF, [0xc0a040, 0xfff0a0, 0xffffff], faint(0xffe070)),    // 12 금빛 옷 · 빛나는 칼
  look([0x1a5a2a, 0x2a8a3a], [0x2a4a1a, 0x4a7a2a], [0x1a6a3a, 0x40c070, 0xb0ffd0], faint(0x80f0a0)), // 13 용비늘
  look([0x1a1028, 0x2e1a46], [0x3a1030, 0x5a1a4a], [0x3a1a5a, 0x6a3aa0, 0xb080f0], faint(0xb080f0)), // 14 흑요
  look([0x101a48, 0x1e2e70], null, [0x4a5ab0, 0x9aa8ff, 0xf0f4ff], bright(0xb0c0ff)),         // 15 별빛
  look([0x9ac8e8, 0xd8f0ff], [0x3a7ab0, 0x5aa0e0], [0x4a8ac8, 0xa8d8ff, 0xffffff], bright(0xd0f0ff)), // 16 천공
  look([0xb0601a, 0xf09a30], GOLD_SCARF, [0xc06020, 0xffb050, 0xfff0c0], bright(0xffc060)),   // 17 여명
  look([0x4a1a6a, 0x7a3aa8], GOLD_SCARF, [0x7a3aa8, 0xd0a0ff, 0xfff0ff], bright(0xd0a0ff)),   // 18 황혼
  look([0xd8c890, 0xfff8e0], GOLD_SCARF, [0xc0c8ff, 0xf0f4ff, 0xffffff], bright(0xfff0b0)),   // 19 천공의 성검 · 별빛
]

// 장비 단계의 색으로 바꾼 색표(바꿀 색이 없는 글자는 그대로)
export function lookPalette(p: Palette, tier: number): Palette {
  const remap = LOOKS[Math.max(0, Math.min(LOOKS.length - 1, Math.floor(tier)))].remap
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(p)) out[k] = remap[v] ?? v
  return out
}
