import { expect, test } from 'claude-code/testing'
import { bonusesFor, objectJosa, subjectJosa, topicJosa } from '../hooks/lib/bonus.ts'

test('커밋 명령을 알아본다', async () => {
  expect(bonusesFor('git commit -m "x"')).toEqual([{ kind: 'commit', label: '전리품 획득!', amount: 20 }])
  expect(bonusesFor('git add . && git commit -m x')).toEqual([{ kind: 'commit', label: '전리품 획득!', amount: 20 }])
  expect(bonusesFor('git -c user.name=a commit -m x')).toEqual([{ kind: 'commit', label: '전리품 획득!', amount: 20 }])
})

test('PR 명령을 알아본다', async () => {
  expect(bonusesFor('gh pr create --fill')).toEqual([{ kind: 'pr', label: '의뢰 완료!', amount: 50 }])
})

test('둘 다 있으면 둘 다', async () => {
  expect(bonusesFor('git commit -m x && gh pr create --fill').map(b => b.amount)).toEqual([20, 50])
})

test('비슷하지만 아닌 명령', async () => {
  expect(bonusesFor('git commit-tree abc')).toEqual([])
  expect(bonusesFor('git log --grep commit')).toEqual([])
  expect(bonusesFor('gh pr view')).toEqual([])
  expect(bonusesFor('echo git commit')).toEqual([])
})

test('이름 뒤 조사(이/가)', async () => {
  expect(subjectJosa('렌')).toBe('이')
  expect(subjectJosa('마검사')).toBe('가')
  expect(subjectJosa('마검성')).toBe('이')
  expect(subjectJosa('Ren')).toBe('이(가)')
})

test('은/는 · 을/를', async () => {
  expect(topicJosa('천검')).toBe('은'); expect(topicJosa('무결점')).toBe('은'); expect(topicJosa('의뢰 해결사')).toBe('는')
  expect(objectJosa('첫 걸음')).toBe('을'); expect(objectJosa('봉인술사')).toBe('를')
})
