import type { Progress } from './progress.ts'

export function comma(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// 스피너 단어 뒤에 붙는 한 줄: " · ⚔️ Lv.15 마검사 +34xp"
export function spinnerSuffix(p: Progress, turnXp: number): string {
  return ` · ${p.stage.emoji} Lv.${p.level} ${p.stage.name} +${comma(turnXp)}xp`
}
