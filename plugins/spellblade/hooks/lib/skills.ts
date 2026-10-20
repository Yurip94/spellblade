// 도구마다 기술 이름 (2차 설계 4장). 비트는 '오늘 쓴 기술 가짓수' 의뢰에 쓴다

export type SkillId = 'eye' | 'track' | 'forge' | 'create' | 'storm' | 'ranged' | 'clone' | 'tactics' | 'summon' | 'slash'

const SKILLS: Record<SkillId, { name: string; bit: number }> = {
  eye: { name: '간파', bit: 1 << 0 },
  track: { name: '추적술', bit: 1 << 1 },
  forge: { name: '정밀 베기', bit: 1 << 2 },
  create: { name: '창조의 일격', bit: 1 << 3 },
  storm: { name: '폭풍 베기', bit: 1 << 4 },
  ranged: { name: '검풍', bit: 1 << 5 },
  clone: { name: '동료 부르기', bit: 1 << 6 },
  tactics: { name: '전술 지도', bit: 1 << 7 },
  summon: { name: '지원군', bit: 1 << 8 },
  slash: { name: '베기', bit: 1 << 9 },
}

const BY_TOOL: Record<string, SkillId> = {
  Read: 'eye', NotebookRead: 'eye',
  Grep: 'track', Glob: 'track',
  Edit: 'forge', MultiEdit: 'forge', NotebookEdit: 'forge',
  Write: 'create',
  Bash: 'storm',
  WebFetch: 'ranged', WebSearch: 'ranged',
  Agent: 'clone', Task: 'clone',
  TodoWrite: 'tactics', TaskCreate: 'tactics', TaskUpdate: 'tactics', TaskList: 'tactics',
}

export function skillOf(tool: string): { id: SkillId; name: string; bit: number } {
  const id: SkillId = BY_TOOL[tool] ?? (tool.startsWith('mcp__') ? 'summon' : 'slash')
  return { id, ...SKILLS[id] }
}
