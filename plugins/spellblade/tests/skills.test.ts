import { expect, test } from 'claude-code/testing'
import { skillOf } from '../hooks/lib/skills.ts'

test('기술 이름', async () => {
  expect(skillOf('Bash').name).toBe('폭풍 베기')
  expect(skillOf('Read').name).toBe('탐색의 눈')
  expect(skillOf('NotebookRead').name).toBe('탐색의 눈')
  expect(skillOf('Glob').name).toBe('추적술')
  expect(skillOf('Grep').name).toBe('추적술')
  expect(skillOf('Edit').name).toBe('연성 베기')
  expect(skillOf('MultiEdit').name).toBe('연성 베기')
  expect(skillOf('Write').name).toBe('창조의 일격')
  expect(skillOf('WebSearch').name).toBe('원거리 마법')
  expect(skillOf('Agent').name).toBe('분신술')
  expect(skillOf('Task').name).toBe('분신술')
  expect(skillOf('TodoWrite').name).toBe('전술 지도')
  expect(skillOf('TaskUpdate').name).toBe('전술 지도')
  expect(skillOf('mcp__notion__search').name).toBe('소환술')
  expect(skillOf('Weird').name).toBe('베기')
})

test('기술마다 비트가 하나씩 다르다', async () => {
  const names = ['Read', 'Grep', 'Edit', 'Write', 'Bash', 'WebFetch', 'Agent', 'TodoWrite', 'mcp__x__y', 'Weird']
  const bits = names.map(n => skillOf(n).bit)
  expect(new Set(bits).size).toBe(10)
  for (const b of bits) expect(b & (b - 1)).toBe(0)
})
