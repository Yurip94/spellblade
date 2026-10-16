import { expect, test } from 'claude-code/testing'
import { XP_PER_W } from '../hooks/lib/balance.ts'

test('테스트 키트가 돈다', async () => {
  expect(1 + 1).toBe(2)
})

test('lib 를 상대경로로 불러온다', async () => {
  expect(XP_PER_W).toBe(1000)
})
