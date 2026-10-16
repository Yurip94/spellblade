import sys
sys.path.insert(0, '.')
import art

def grid_ts(rows, indent='  '):
    return '[\n' + ''.join(f"{indent}  '{r}',\n" for r in rows) + f'{indent}]'

def hx(v): return '0x%06x' % v

out = []
out.append("""// 마검사 도트 그림. 격자 20×16, '.' 은 투명.
// 역할 글자: k 윤곽 · s 피부 · h 머리 · A 옷/갑옷 밝은 면 · B 어두운 면 · G 손잡이/장식 · W 칼날 · C 망토
// 효과 글자: M 마법 · L 마법 밝은 빛 · Y 반짝임 · R 불꽃/폭발
// 단계 팔레트가 역할 글자에 색을 준다. 모두 이 프로젝트를 위해 새로 그린 그림이다.
import type { StageId } from './balance.ts'
import { compose, type Grid, type Palette } from './sprites.ts'
import type { Pose } from './status.ts'

type BasePose = 'stand' | 'blink' | 'slash' | 'victory' | 'hit' | 'sit'
type EffectId = 'cast1' | 'cast2' | 'arc' | 'sparkle' | 'boom' | 'pillar' | 'zzz'
""")
out.append("const COMMON = { " + ", ".join(f"{k}: {hx(v)}" for k, v in art.COMMON.items()) + " }\n")
out.append("export const POSES: Record<BasePose, Grid> = {")
for k in ['stand', 'blink', 'slash', 'victory', 'hit', 'sit']:
    out.append(f"  {k}: {grid_ts(art.POSES[k])},")
out.append("}\n")
out.append("// 모든 자세에 같은 자리로 겹치는 장신구(몸 중심은 자세마다 같은 자리)")
out.append("const ACC = {")
for k, v in art.ACC.items():
    out.append(f"  {k}: {grid_ts(v)},")
out.append("} satisfies Record<string, Grid>\n")
out.append("export const EFFECTS: Record<EffectId, Grid> = {")
for k in ['cast1', 'cast2', 'arc', 'sparkle', 'boom', 'pillar', 'zzz']:
    out.append(f"  {k}: {grid_ts(art.EFFECTS[k])},")
out.append("}\n")
out.append("export const STAGE_LOOKS: Record<StageId, { palette: Palette; accessories: readonly Grid[] }> = {")
for sid, st in art.STAGES.items():
    pal = ", ".join(f"{k}: {hx(st[k])}" for k in ['A', 'B', 'G', 'W', 'C'])
    acc = ", ".join(f"ACC.{a}" for a in st['acc'])
    out.append(f"  {sid}: {{ palette: {{ ...COMMON, {pal} }}, accessories: [{acc}] }},")
out.append("}\n")
out.append("const FRAMES: Record<Pose, [BasePose, readonly EffectId[]]> = {")
for p, (b, ef) in art.MAP.items():
    out.append(f"  {p}: ['{b}', [" + ", ".join(f"'{e}'" for e in ef) + "]],")
out.append("}\n")
out.append("""// 자세 → 장신구 → 효과 순서로 겹친다
export function frameFor(stage: StageId, pose: Pose): { grid: Grid; palette: Palette } {
  const look = STAGE_LOOKS[stage]
  const [base, effects] = FRAMES[pose]
  return { grid: compose(POSES[base], ...look.accessories, ...effects.map(e => EFFECTS[e])), palette: look.palette }
}
""")
open(sys.argv[1], 'w', encoding='utf-8').write('\n'.join(out))
print('written')
