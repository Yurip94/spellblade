import { BONUS } from './balance.ts'

export type Bonus = { kind: 'commit' | 'pr'; label: string; amount: number }

// 값을 받는 git 전역 옵션: 다음 토큰까지 건너뛴다
const GIT_VALUE_OPTS = new Set(['-c', '-C', '--git-dir', '--work-tree', '--namespace'])

function segments(command: string): string[][] {
  return command
    .split(/[;&|\n]+/)
    .map(s => s.trim().split(/\s+/).filter(Boolean))
    .filter(t => t.length > 0)
}

function isGitCommit(tokens: string[]): boolean {
  if (tokens[0] !== 'git') return false
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i]
    if (GIT_VALUE_OPTS.has(t)) { i++; continue }
    if (t.startsWith('-')) continue
    return t === 'commit'
  }
  return false
}

const isPrCreate = (tokens: string[]) => tokens[0] === 'gh' && tokens[1] === 'pr' && tokens[2] === 'create'

// 성공한 Bash 명령 한 줄에서 받을 보너스(상한은 부르는 쪽에서)
export function bonusesFor(command: string): Bonus[] {
  const segs = segments(command)
  const out: Bonus[] = []
  if (segs.some(isGitCommit)) out.push({ kind: 'commit', label: '전리품 획득!', amount: BONUS.commit })
  if (segs.some(isPrCreate)) out.push({ kind: 'pr', label: '의뢰 완료!', amount: BONUS.pr })
  return out
}

// "렌이 · 마검사가": 마지막 한글 글자에 받침이 있으면 이, 없으면 가
export function subjectJosa(word: string): string {
  const c = word.charCodeAt(word.length - 1)
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 === 0 ? '가' : '이'
  return '이(가)'
}
