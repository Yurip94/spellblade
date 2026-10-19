import { expect, test } from 'claude-code/testing'
import { BACKDROPS4, FX4, GLYPHS4 } from '../hooks/lib/art4.ts'
import { LOOKS, lookPalette } from '../hooks/lib/looks.ts'

test('맵 5개 × 낮 · 밤은 80 × 32, 투명 칸 없음', async () => {
  for (const m of ['forest', 'swamp', 'cave', 'canyon', 'castle'] as const) for (const t of ['day', 'night'] as const) {
    const g = BACKDROPS4[m][t].grid
    expect([g.length, g.every(r => r.length === 80 && !r.includes('.'))]).toEqual([32, true])
    expect(g.every(r => [...r].every(c => c in BACKDROPS4[m][t].palette))).toBe(true)
  }
})

test('맵마다 다르고 밤은 낮보다 어둡다', async () => {
  const lum = (v: number) => ((v >> 16) & 255) + ((v >> 8) & 255) + (v & 255)
  const avg = (b: { grid: readonly string[]; palette: Readonly<Record<string, number>> }) => b.grid.reduce((s, r) => s + [...r].reduce((t, c) => t + lum(b.palette[c]), 0), 0) / (80 * 32)
  const days = (['forest', 'swamp', 'cave', 'canyon', 'castle'] as const).map(m => avg(BACKDROPS4[m].day))
  expect(new Set(days.map(Math.round)).size).toBe(5)
  for (const m of ['forest', 'swamp', 'cave', 'canyon', 'castle'] as const) expect(avg(BACKDROPS4[m].night)).toBeLessThan(avg(BACKDROPS4[m].day))
})

test('효과 12종 · 크기', async () => {
  expect(Object.keys(FX4).sort()).toEqual(['bolt', 'fire1', 'fire2', 'glow1', 'glow2', 'pillar1', 'pillar2', 'poof1', 'poof2', 'smoke', 'sweat', 'zzz'])
  for (const [id, f] of Object.entries(FX4)) {
    const maxH = id.startsWith('pillar') ? 26 : 12
    expect(f.grid.length <= maxH && f.grid.every(r => r.length === f.grid[0].length && r.length <= 12)).toBe(true)
  }
})

test('작은 글꼴 3 × 5', async () => {
  expect('0123456789+XPLEVU'.split('').every(c => GLYPHS4[c]?.length === 5 && GLYPHS4[c].every(r => r.length === 3))).toBe(true)
})

test('장비 색 20단계: 0단계는 그대로, 단계마다 옷 색이 다르다', async () => {
  expect(LOOKS.length).toBe(20)
  expect(lookPalette({ a: 0x123456 }, 0)).toEqual({ a: 0x123456 })
  expect(new Set(LOOKS.slice(1).map(l => JSON.stringify(l.remap))).size).toBe(19)
  expect([LOOKS[9].glow, LOOKS[10].glow !== null, LOOKS[19].glow !== null]).toEqual([null, true, true])
  expect(lookPalette({ a: 0x2d6ac5, b: 0x111111 }, 1)).toEqual({ a: LOOKS[1].remap[0x2d6ac5], b: 0x111111 })
})
