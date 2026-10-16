# 마검사 도트 그림 초안 — 격자 데이터 + PNG 미리보기 + art.ts 생성
import json, struct, sys, zlib

W, H = 20, 16

def g(*rows):
    rows = list(rows)
    assert len(rows) == H, len(rows)
    for i, r in enumerate(rows):
        assert len(r) == W, (i, r, len(r))
    return rows

# 역할 글자: k 윤곽 · s 피부 · h 머리 · A 옷/갑옷 밝은 면 · B 어두운 면 · G 손잡이/장식 · W 칼날 · C 망토
# 효과: M 마법 · L 마법 밝은 빛 · Y 반짝임 · R 불꽃/폭발
POSES = {
  'stand': g(
    "....................",
    "......kkkkk.....W...",
    ".....khhhhhk....W...",
    "....khhhhhhhk...W...",
    "....khhsshhhk...W...",
    "....khskssksk...W...",
    "....kssssssk....W...",
    ".....kssssk....GGG..",
    "....kAAAAAAk....G...",
    "...kAABBBBAAAAAss...",
    "...ksAAAAAAk........",
    "....kBBBBBBk........",
    "....kAAkkAAk........",
    "....kAk..kAk........",
    "....kBk..kBk........",
    "...kkBk..kBkk.......",
  ),
}

def replace(grid, edits):
    out = [list(r) for r in grid]
    for (x, y), c in edits.items():
        out[y][x] = c
    return [''.join(r) for r in out]

def clear_box(grid, x0, y0, x1, y1):
    return replace(grid, {(x, y): '.' for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)})

POSES['stand'] = replace(POSES['stand'], {(17, y): 'k' for y in range(1, 7)})
stand = POSES['stand']
# 눈 감기: 눈 두 칸을 머리색으로
POSES['blink'] = replace(stand, {(7, 5): 'h', (10, 5): 'h'})
# 베기: 칼을 오른쪽으로 뻗는다
slash = clear_box(stand, 13, 1, 19, 9)
slash = replace(slash, {
  (12, 8): 'A', (13, 8): 'A', (14, 8): 's', (15, 8): 's',
  (16, 7): 'G', (16, 8): 'G', (16, 9): 'G',
  (17, 8): 'W', (18, 8): 'W', (19, 8): 'W',
  (17, 9): 'k', (18, 9): 'k', (19, 9): 'k',
  (12, 9): 'A',
})
POSES['slash'] = slash
# 승리: 칼을 땅에 꽂고 손을 손잡이에
victory = clear_box(stand, 13, 1, 19, 15)
victory = replace(victory, {
  (12, 9): 'A', (13, 9): 'A', (14, 9): 's', (15, 9): 's',
  (16, 8): 'G', (15, 10): 'G', (16, 10): 'G', (17, 10): 'G',
  (16, 11): 'W', (16, 12): 'W', (16, 13): 'W', (16, 14): 'W', (16, 15): 'W',
  (17, 11): 'k', (17, 12): 'k', (17, 13): 'k', (17, 14): 'k',
})
POSES['victory'] = victory
# 반격당함: 한 칸 왼쪽으로 밀리고 칼이 기운다
hit = [r[1:] + '.' for r in stand]
hit = clear_box(hit, 12, 0, 19, 9)
hit = replace(hit, {
  (12, 9): 'A', (13, 9): 's', (14, 9): 's',
  (15, 8): 'G', (16, 7): 'W', (17, 6): 'W', (18, 5): 'W', (17, 7): 'k', (18, 6): 'k', (19, 5): 'k',
  (6, 5): 'h', (9, 5): 'h',  # 질끈 감은 눈
})
POSES['hit'] = hit
# 앉기: 다리를 모으고 모닥불 앞에, 칼은 내려놓음
sit = clear_box(stand, 13, 1, 19, 15)
sit = clear_box(sit, 3, 12, 12, 15)
sit = replace(sit, {
  **{(x, 12): c for x, c in zip(range(3, 13), "..kAAAAAAk")},
  **{(x, 13): c for x, c in zip(range(3, 14), ".kAAAAAAAAk")},
  **{(x, 14): c for x, c in zip(range(3, 14), "kBBkkkkkBBk")},
  (7, 5): 'h', (10, 5): 'h',
  # 모닥불
  (16, 11): 'Y', (15, 12): 'R', (16, 12): 'Y', (17, 12): 'R',
  (15, 13): 'R', (16, 13): 'R', (17, 13): 'R',
  (14, 14): 'h', (15, 14): 'h', (16, 14): 'h', (17, 14): 'h', (18, 14): 'h',
  (14, 15): 'h', (18, 15): 'h',
})
POSES['sit'] = sit

E = ["." * W for _ in range(H)]
def fx(edits):
    return replace(E, edits)

EFFECTS = {
  # 칼날(x16, y1~6)에 감기는 번개 — 두 프레임이 번갈아
  'cast1': fx({(16, 1): 'L', (15, 2): 'M', (17, 3): 'M', (16, 4): 'L', (15, 5): 'M', (17, 6): 'M', (14, 1): 'M'}),
  'cast2': fx({(16, 0): 'L', (17, 2): 'M', (15, 3): 'M', (16, 2): 'L', (17, 5): 'M', (15, 6): 'M', (18, 1): 'M'}),
  # 베기 궤적
  'arc': fx({(13, 3): 'M', (14, 3): 'L', (15, 3): 'L', (16, 4): 'L', (17, 4): 'L', (18, 5): 'L', (19, 6): 'M', (17, 3): 'M', (19, 7): 'M'}),
  'sparkle': fx({(2, 2): 'Y', (13, 1): 'Y', (14, 3): 'Y', (1, 6): 'Y', (18, 4): 'Y', (19, 2): 'Y', (3, 0): 'Y'}),
  'boom': fx({(16, 1): 'R', (17, 2): 'Y', (18, 3): 'R', (19, 2): 'Y', (17, 4): 'Y', (19, 4): 'R', (18, 1): 'R'}),
  'pillar': fx({**{(1, y): 'L' for y in range(0, 16, 2)}, **{(2, y): 'M' for y in range(1, 16, 2)},
                **{(19, y): 'L' for y in range(1, 16, 2)}, **{(18, y): 'M' for y in range(0, 16, 2)}}),
  'zzz': fx({(13, 1): 'L', (14, 1): 'L', (14, 2): 'L', (13, 3): 'L', (14, 3): 'L',
             (16, 0): 'L', (17, 0): 'L', (17, 1): 'L', (16, 2): 'L', (17, 2): 'L'}),
}

ACC = {
  # 수련생: 머리띠
  'headband': fx({(x, 3): 'G' for x in range(5, 12)}),
  # 검사: 왼팔 둥근 방패
  'shield': fx({(1, 8): 'k', (2, 8): 'G', (3, 8): 'k',
                (0, 9): 'k', (1, 9): 'G', (2, 9): 'B', (3, 9): 'G',
                (0, 10): 'k', (1, 10): 'G', (2, 10): 'G', (3, 10): 'G',
                (0, 11): 'k', (1, 11): 'G', (2, 11): 'B', (3, 11): 'G',
                (1, 12): 'k', (2, 12): 'G', (3, 12): 'k'}),
  # 마검사: 짧은 망토가 몸 양옆으로
  'cloakShort': fx({(3, 8): 'C', (12, 8): 'C', (2, 9): 'C', (2, 10): 'C', (3, 11): 'C', (12, 10): 'C', (12, 11): 'C', (3, 12): 'C', (12, 12): 'C'}),
  # 마검기사: 긴 망토 + 투구
  'cloakLong': fx({**{(2, y): 'C' for y in range(9, 16)}, **{(3, y): 'C' for y in range(8, 16)},
                   **{(12, y): 'C' for y in range(10, 16)}, **{(13, y): 'C' for y in range(11, 16)},
                   (12, 8): 'C', (5, 2): 'A', (6, 1): 'A', (7, 1): 'A', (8, 1): 'A', (9, 1): 'A', (10, 1): 'A', (11, 2): 'A', (8, 0): 'G'}),
  'runeShield': fx({(0, 8): 'k', (1, 8): 'G', (2, 8): 'G', (0, 9): 'G', (1, 9): 'M', (2, 9): 'G',
                    (0, 10): 'G', (1, 10): 'L', (2, 10): 'G', (0, 11): 'G', (1, 11): 'M', (2, 11): 'G',
                    (0, 12): 'k', (1, 12): 'G', (2, 12): 'k'}),
  # 마검성: 등 뒤 마법진 + 떠 있는 검 두 자루 + 머리 위 빛 고리
  'halo': fx({(1, 4): 'M', (2, 3): 'M', (2, 13): 'M', (1, 12): 'M', (3, 14): 'M', (3, 2): 'M',
              (13, 13): 'M', (14, 12): 'M', (13, 14): 'M',
              (7, 0): 'G', (8, 0): 'G', (9, 0): 'G', (10, 0): 'G'}),
  'floatSwords': fx({(0, 1): 'W', (0, 2): 'W', (0, 3): 'W', (0, 4): 'G', (1, 1): 'k', (1, 2): 'k', (1, 3): 'k',
                     (18, 9): 'k', (18, 10): 'k', (18, 11): 'k', (19, 9): 'W', (19, 10): 'W', (19, 11): 'W', (19, 12): 'G'}),
}

COMMON = {'k': 0x1a1620, 's': 0xf0c8a0, 'h': 0x4a3020, 'M': 0x3c8cff, 'L': 0xb8e0ff, 'Y': 0xffe060, 'R': 0xff6a3c}
STAGES = {
  'trainee':    {'A': 0xd8c8a0, 'B': 0x7a5230, 'G': 0xc0483a, 'W': 0xa87848, 'C': 0x7a5230, 'acc': ['headband']},
  'swordsman':  {'A': 0xa06c3c, 'B': 0x5a3a20, 'G': 0xc8a040, 'W': 0xd8dde6, 'C': 0x5a3a20, 'acc': ['shield']},
  'spellblade': {'A': 0xc8d0dc, 'B': 0x6a7488, 'G': 0xe0b040, 'W': 0xeef4ff, 'C': 0x2f4f9f, 'acc': ['cloakShort']},
  'knight':     {'A': 0x4a5266, 'B': 0x2a2f40, 'G': 0xe0b040, 'W': 0xeef4ff, 'C': 0x283070, 'acc': ['cloakLong', 'runeShield']},
  'saint':      {'A': 0xf4f2ea, 'B': 0xc8b070, 'G': 0xffd860, 'W': 0xffffff, 'C': 0xe8c860, 'acc': ['halo', 'floatSwords']},
}

MAP = {'idle': ('stand', []), 'blink': ('blink', []), 'cast1': ('stand', ['cast1']), 'cast2': ('stand', ['cast2']),
       'slash': ('slash', ['arc']), 'victory': ('victory', ['sparkle']), 'hit': ('hit', ['boom']),
       'levelup': ('stand', ['pillar']), 'sleep': ('sit', ['zzz'])}

def compose(*layers):
    out = [list(r) for r in layers[0]]
    for l in layers[1:]:
        for y, r in enumerate(l):
            for x, c in enumerate(r):
                if c != '.': out[y][x] = c
    return [''.join(r) for r in out]

def frame(stage, pose):
    base, effects = MAP[pose]
    st = STAGES[stage]
    grid = compose(POSES[base], *[ACC[a] for a in st['acc']], *[EFFECTS[e] for e in effects])
    pal = {**COMMON, **{k: v for k, v in st.items() if k != 'acc'}}
    return grid, pal

def png(path, pixels, w, h):
    raw = b''.join(b'\x00' + bytes(sum(([*px] for px in pixels[y * w:(y + 1) * w]), [])) for y in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
    open(path, 'wb').write(data)

def sheet(path, bg, scale=8, gap=6):
    stages = list(STAGES); poses = list(MAP)
    cw, ch = W * scale + gap, H * scale + gap
    tw, th = cw * len(poses) + gap, ch * len(stages) + gap
    px = [bg] * (tw * th)
    for si, s in enumerate(stages):
        for pi, p in enumerate(poses):
            grid, pal = frame(s, p)
            ox, oy = gap + pi * cw, gap + si * ch
            for y in range(H):
                for x in range(W):
                    c = grid[y][x]
                    if c == '.': continue
                    rgb = pal[c]; col = ((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255)
                    for dy in range(scale):
                        base = (oy + y * scale + dy) * tw + ox + x * scale
                        for dx in range(scale): px[base + dx] = col
    png(path, px, tw, th)

if __name__ == '__main__':
    out = sys.argv[1]
    sheet(out + '/sheet-dark.png', (30, 30, 36))
    sheet(out + '/sheet-light.png', (245, 245, 240))
    print('ok')
