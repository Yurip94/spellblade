import { expect, test } from 'claude-code/testing'
import { progressOf } from '../hooks/lib/progress.ts'
import { comma, spinnerSuffix } from '../hooks/lib/views.ts'

test('천 단위 쉼표', async () => {
  expect(comma(1240)).toBe('1,240')
  expect(comma(999)).toBe('999')
  expect(comma(116160)).toBe('116,160')
  expect(comma(0)).toBe('0')
})

test('스피너 문구', async () => {
  expect(spinnerSuffix(progressOf(12000), 34)).toBe(' · ⚔️ Lv.15 마검사 +34xp')
})
