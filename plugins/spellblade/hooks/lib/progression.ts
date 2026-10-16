import { STAT_MAX } from './balance.ts'
import { sumXp, type Sum } from './ledger.ts'

// 연속 출석 · 칭호 · 능력치 — 모두 저장 칸 합계에서 계산한다(창이 여러 개여도 같다)

export type Lifetime = { sum: Sum; questsDone: number; questXp: number; streak: number; bestStreak: number }

const DAY_MS = 86_400_000
const shift = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)

// 오늘이 있으면 오늘부터, 없으면 어제부터 거꾸로 이어진 날 수
export function streakOf(activeDays: ReadonlySet<string>, today: string): number {
  let day = activeDays.has(today) ? today : shift(today, -1)
  let n = 0
  while (activeDays.has(day)) {
    n++
    day = shift(day, -1)
  }
  return n
}

export function longestStreak(activeDays: ReadonlySet<string>): number {
  let best = 0
  for (const day of activeDays) {
    if (activeDays.has(shift(day, -1))) continue // 이어진 줄의 첫날에서만 센다
    let n = 0
    for (let d = day; activeDays.has(d); d = shift(d, 1)) n++
    best = Math.max(best, n)
  }
  return best
}

export type TitleId = 'first' | 'veteran' | 'thousand' | 'sealer' | 'combo' | 'flawless' | 'dawn' | 'week' | 'month' | 'solver'

export const TITLES: readonly { id: TitleId; name: string; rule: string; test: (l: Lifetime) => boolean }[] = [
  { id: 'first', name: '첫 걸음', rule: '처음으로 XP 를 얻는다', test: l => sumXp(l.sum) >= 1 },
  { id: 'veteran', name: '백전노장', rule: '베기 누적 1,000번', test: l => l.sum.swings >= 1_000 },
  { id: 'thousand', name: '천검', rule: '베기 누적 10,000번', test: l => l.sum.swings >= 10_000 },
  { id: 'sealer', name: '봉인술사', rule: '커밋 누적 100번', test: l => l.sum.commits >= 100 },
  { id: 'combo', name: '콤보 마스터', rule: '하루에 ×30 콤보', test: l => l.sum.combo >= 30 },
  { id: 'flawless', name: '무결점', rule: '반격 없이 20턴 연속', test: l => l.sum.clean >= 20 },
  { id: 'dawn', name: '새벽의 검사', rule: '0~5시에 턴을 끝낸다', test: l => l.sum.night >= 1 },
  { id: 'week', name: '7일의 맹세', rule: '7일 연속 출석', test: l => l.bestStreak >= 7 },
  { id: 'month', name: '한 달의 맹세', rule: '30일 연속 출석', test: l => l.bestStreak >= 30 },
  { id: 'solver', name: '의뢰 해결사', rule: '의뢰 누적 30개', test: l => l.questsDone >= 30 },
]

export function earnedTitles(l: Lifetime): TitleId[] {
  return TITLES.filter(t => t.test(l)).map(t => t.id)
}

export function titleName(id: string): string | null {
  return TITLES.find(t => t.id === id)?.name ?? null
}

const stat = (v: number) => Math.max(1, Math.min(STAT_MAX, Math.floor(v)))

// 2차 설계 7장
export function statsOf(l: Lifetime): { str: number; int: number; agi: number; luk: number } {
  return {
    str: stat(1 + Math.sqrt(l.sum.swings) / 2),
    int: stat(1 + Math.sqrt(l.sum.out / 1_000)),
    agi: stat(1 + Math.sqrt(l.sum.fast) * 2),
    luk: stat(1 + Math.sqrt(l.sum.bonus + l.questXp) / 2),
  }
}
