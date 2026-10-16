# 그림 2판(32×32) 원본 데이터 + 미리보기 + art.ts 만들기
#   python3 tools/art/art32.py preview <폴더>   → 5단계 × 자세 PNG (어두운 · 밝은 배경)
#   python3 tools/art/art32.py ts <art.ts 경로>  → plugins/spellblade/hooks/lib/art.ts
# 음영 규칙은 hooks/lib/shade.ts 와 같아야 한다(미리보기용으로 같은 규칙을 파이썬으로 옮김).
import struct, sys, zlib

W, H = 32, 32
MATERIALS = 'SHABCGWPLD'      # 음영을 넣는 재질
DETAILS = 'EmJR'              # 경계로 보지 않는 디테일(눈 · 입 · 머리 윤기 · 룬)

def canvas(): return [['.'] * W for _ in range(H)]
def paint(c, y, x0, x1, ch):
    for x in range(x0, x1 + 1):
        if 0 <= x < W and 0 <= y < H: c[y][x] = ch
def dot(c, x, y, ch):
    if 0 <= x < W and 0 <= y < H: c[y][x] = ch
def rows(c): return [''.join(r) for r in c]
def clear(): return canvas()

# ---------- 몸 ----------
def head(c):
    for y, (a, b) in {2: (12, 18), 3: (10, 20), 4: (9, 21), 5: (8, 22), 6: (8, 22), 7: (8, 22)}.items(): paint(c, y, a, b, 'H')
    for y, (a, b) in {8: (10, 20), 9: (9, 21), 10: (9, 21), 11: (9, 21), 12: (10, 20), 13: (11, 19)}.items(): paint(c, y, a, b, 'S')
    for y in (8, 9, 10, 11): dot(c, 8, y, 'H'); dot(c, 22, y, 'H')
    dot(c, 9, 8, 'H'); dot(c, 21, 8, 'H'); dot(c, 13, 8, 'H'); dot(c, 17, 8, 'H')
    paint(c, 4, 12, 14, 'J'); dot(c, 11, 5, 'J')
    for ex in (12, 18): dot(c, ex, 10, 'E'); dot(c, ex, 11, 'E')
    dot(c, 15, 12, 'm')
    paint(c, 14, 13, 17, 'S')

def torso(c):
    paint(c, 15, 8, 22, 'A'); paint(c, 16, 7, 23, 'A'); paint(c, 17, 7, 23, 'A')
    for y in range(18, 23): paint(c, y, 9, 21, 'A')
    paint(c, 15, 13, 17, 'G'); dot(c, 14, 19, 'G'); dot(c, 16, 19, 'G')
    for y in range(18, 23): dot(c, 15, y, 'B')
    for y in range(17, 22): paint(c, y, 6, 8, 'A')
    paint(c, 22, 6, 8, 'S')
    paint(c, 23, 9, 21, 'L'); paint(c, 23, 14, 16, 'G')

def legs_stand(c):
    paint(c, 24, 9, 21, 'A'); paint(c, 25, 9, 14, 'A'); paint(c, 25, 16, 21, 'A')
    for y in range(26, 29): paint(c, y, 10, 13, 'B'); paint(c, y, 17, 20, 'B')
    paint(c, 27, 10, 13, 'A'); paint(c, 27, 17, 20, 'A')
    for y in (29, 30): paint(c, y, 9, 13, 'L'); paint(c, y, 17, 21, 'L')
    paint(c, 30, 8, 13, 'L'); paint(c, 30, 17, 22, 'L')

def legs_sit(c):
    # 책상다리: 무릎이 양옆으로
    paint(c, 24, 8, 22, 'A')
    paint(c, 25, 6, 24, 'B'); paint(c, 26, 5, 25, 'B'); paint(c, 27, 5, 25, 'B')
    paint(c, 26, 6, 8, 'A'); paint(c, 26, 22, 24, 'A')  # 무릎 보호대
    paint(c, 28, 7, 13, 'L'); paint(c, 28, 17, 23, 'L')  # 발

def body(kind):
    c = canvas(); head(c); torso(c)
    (legs_stand if kind == 'stand' else legs_sit)(c)
    return rows(c)

BODIES = {'stand': body('stand'), 'sit': body('sit')}

# ---------- 자세별 위 층 (무기 · 오른팔 · 얼굴 바뀜) ----------
def sword_up(c, x=26, top=1, guard=19):
    for y in range(17, 21): paint(c, y, 22, 24, 'A')
    paint(c, 21, 23, 25, 'S')
    for y in range(top, guard): paint(c, y, x, x + 1, 'W')
    dot(c, x, top - 1, 'W')
    for y in (top + 4, top + 8, top + 12): dot(c, x, y, 'R')
    paint(c, guard, x - 2, x + 3, 'G'); paint(c, guard + 1, x - 1, x + 2, 'G')
    for y in (guard + 2, guard + 3): paint(c, y, x, x + 1, 'P')
    paint(c, guard + 4, x, x + 1, 'G')

def top_stand():
    c = clear(); sword_up(c); return rows(c)

def top_blink():
    c = [list(r) for r in top_stand()]
    for ex in (12, 18): dot(c, ex, 10, 'S')   # 위 칸만 감아 아래 줄만 남김
    return rows(c)

def top_slash():
    # 몸은 frameFor 가 (-3, 0) 옮긴 뒤 이 층을 얹는다 — 칼을 오른쪽으로 길게 뻗는다
    c = clear()
    for y in (16, 17): paint(c, y, 19, 22, 'A')          # 앞으로 뻗은 팔
    paint(c, 16, 23, 24, 'S'); paint(c, 17, 23, 24, 'S')  # 손
    for y in (14, 15, 18, 19): dot(c, 25, y, 'G')         # 가드
    paint(c, 16, 25, 25, 'G'); paint(c, 17, 25, 25, 'G')
    for x in range(26, 32):                               # 칼날 2칸 굵기
        dot(c, x, 16, 'W'); dot(c, x, 17, 'W')
    dot(c, 28, 16, 'R'); dot(c, 31, 16, 'R')
    return rows(c)

def happy_eyes(c):
    for ex in (12, 18):
        dot(c, ex, 11, 'S'); dot(c, ex - 1, 11, 'E'); dot(c, ex, 10, 'E'); dot(c, ex + 1, 11, 'E')
    paint(c, 12, 14, 16, 'm')

def top_victory():
    c = clear()
    for y in range(9, 17): paint(c, y, 23, 24, 'A')      # 팔을 하늘로
    paint(c, 8, 23, 24, 'S')
    paint(c, 7, 21, 26, 'G')
    for y in range(0, 7): paint(c, y, 23, 24, 'W')
    dot(c, 23, 2, 'R'); dot(c, 23, 5, 'R')
    happy_eyes(c)
    return rows(c)

def top_hit():
    # 몸은 frameFor 가 (-1, +1) 옮긴 뒤 이 층을 얹는다 — 좌표는 옮긴 뒤 기준
    c = clear()
    for y in range(18, 21): paint(c, y, 21, 23, 'A')
    paint(c, 21, 22, 24, 'S')
    for i in range(7): dot(c, 24 + i, 22 + i, 'W'); dot(c, 25 + i, 22 + i, 'W')
    dot(c, 23, 22, 'G'); dot(c, 24, 21, 'G')
    for (x, y) in ((11, 11), (11, 12), (17, 11), (17, 12)): dot(c, x, y, 'S')
    for (x, y) in ((10, 10), (11, 11), (10, 12), (18, 10), (17, 11), (18, 12)): dot(c, x, y, 'E')
    dot(c, 14, 13, 'm')
    return rows(c)

def top_sit():
    c = clear()
    for ex in (12, 18): dot(c, ex, 10, 'S')   # 졸린 눈
    # 모닥불: 장작 P · 불꽃 X · Y
    paint(c, 31, 25, 31, 'P'); paint(c, 30, 26, 30, 'P'); dot(c, 25, 30, 'P'); dot(c, 31, 30, 'P')
    paint(c, 29, 26, 30, 'X'); paint(c, 28, 26, 30, 'X'); paint(c, 27, 27, 29, 'X'); paint(c, 26, 27, 29, 'X'); dot(c, 28, 25, 'X'); dot(c, 28, 24, 'Y')
    paint(c, 28, 27, 29, 'Y'); dot(c, 28, 27, 'Y'); dot(c, 28, 26, 'Y')
    return rows(c)

TOPS = {'stand': top_stand(), 'blink': top_blink(), 'slash': top_slash(), 'victory': top_victory(), 'hit': top_hit(), 'sit': top_sit()}

# ---------- 효과 (음영 뒤에 얹음) ----------
def fx(points):
    c = clear()
    for (x, y), ch in points.items(): dot(c, x, y, ch)
    return rows(c)

def zig(x0, y0, y1, flip):
    pts = {}
    for y in range(y0, y1):
        x = x0 + (1 if ((y // 2) % 2 == 0) ^ flip else -1)
        pts[(x, y)] = 'N' if y % 3 == 0 else 'M'
    return pts

EFFECTS = {
    'cast1': fx({**zig(24, 0, 18, False), **zig(29, 1, 18, True), (26, 0): 'N', (27, 0): 'N'}),
    'cast2': fx({**zig(24, 1, 18, True), **zig(29, 0, 18, False), (25, 0): 'N', (28, 0): 'N'}),
    'arc': fx({**{(x, y): 'N' for x, y in ((18, 4), (19, 4), (20, 4), (21, 5), (22, 5), (23, 6), (24, 6), (25, 7), (26, 8), (27, 9), (28, 10), (29, 11), (30, 12), (30, 13), (31, 14))},
               **{(x, y): 'M' for x, y in ((19, 3), (20, 3), (21, 3), (22, 4), (23, 4), (24, 5), (25, 5), (26, 6), (27, 7), (28, 8), (29, 9), (30, 10), (31, 11), (31, 12))}}),
    'sparkle': fx({(3, 3): 'Y', (2, 4): 'Y', (4, 4): 'Y', (3, 5): 'Y', (28, 12): 'Y', (27, 13): 'Y', (29, 13): 'Y', (28, 14): 'Y',
                   (5, 12): 'Y', (29, 3): 'Y', (19, 0): 'Y', (2, 20): 'Y'}),
    'boom': fx({(27, 4): 'X', (28, 3): 'Y', (29, 4): 'X', (28, 5): 'Y', (26, 2): 'X', (30, 2): 'X', (26, 6): 'X', (30, 6): 'X',
                (28, 1): 'X', (31, 4): 'X', (25, 4): 'X', (28, 7): 'X', (28, 4): 'Y'}),
    'pillar': fx({**{(1, y): ('N' if y % 2 else 'M') for y in range(0, 32, 1)}, **{(30, y): ('M' if y % 2 else 'N') for y in range(0, 32, 1)}}),
    'pillar2': fx({**{(2, y): ('M' if y % 2 else 'N') for y in range(0, 32, 1)}, **{(29, y): ('N' if y % 2 else 'M') for y in range(0, 32, 1)}}),
    'zzz': fx({**{(x, 2): 'N' for x in (24, 25, 26)}, (25, 3): 'N', (24, 4): 'N', **{(x, 4): 'N' for x in (24, 25, 26)},
               **{(x, 7): 'N' for x in (28, 29)}, (28, 8): 'N', **{(x, 9): 'N' for x in (28, 29)}}),
}

# ---------- 단계 장신구 ----------
def cloak(long):
    c = clear()
    last = 31 if long else 26
    for y in range(14, last + 1):
        w = 1 + (y - 14) // (3 if long else 4)
        paint(c, y, 7 - w, 7, 'C'); paint(c, y, 21, 21 + min(w, 3 if long else 2), 'C')
    return rows(c)

def shield(rune):
    c = clear()
    for y, (a, b) in {16: (3, 6), 17: (2, 7), 18: (1, 8), 19: (1, 8), 20: (1, 8), 21: (1, 8), 22: (2, 7), 23: (3, 6)}.items(): paint(c, y, a, b, 'D')
    for y, (a, b) in {16: (3, 6), 23: (3, 6)}.items(): paint(c, y, a, b, 'G')
    for y in range(17, 23): dot(c, 1 if 18 <= y <= 21 else 2, y, 'G'); dot(c, 8 if 18 <= y <= 21 else 7, y, 'G')
    if rune: dot(c, 4, 19, 'R'); dot(c, 5, 20, 'R'); dot(c, 4, 20, 'R'); dot(c, 5, 19, 'R'); dot(c, 3, 19, 'R'); dot(c, 6, 20, 'R')
    else: paint(c, 19, 4, 5, 'G'); paint(c, 20, 4, 5, 'G')
    return rows(c)

def headband():
    c = clear(); paint(c, 7, 8, 22, 'G'); dot(c, 23, 7, 'G'); dot(c, 24, 8, 'G'); return rows(c)

def helmet():
    c = clear()
    for y, (a, b) in {1: (13, 17), 2: (11, 19), 3: (9, 21), 4: (8, 22), 5: (8, 22), 6: (8, 22)}.items(): paint(c, y, a, b, 'A')
    paint(c, 6, 8, 22, 'G'); paint(c, 0, 14, 16, 'G'); dot(c, 15, 1, 'G')
    return rows(c)

def crown():
    c = clear()
    paint(c, 1, 11, 19, 'G'); dot(c, 11, 0, 'G'); dot(c, 15, 0, 'G'); dot(c, 19, 0, 'G'); dot(c, 13, 0, 'R'); dot(c, 17, 0, 'R')
    return rows(c)

def halo():
    c = clear()
    import math
    for t in range(0, 360, 9):
        x = round(15 + 14.5 * math.cos(math.radians(t))); y = round(17 + 14 * math.sin(math.radians(t)))
        dot(c, x, y, 'R')
    return rows(c)

def float_swords():
    c = clear()
    for x0, y0 in ((1, 1), (3, 23)):
        for y in range(y0, y0 + 6): dot(c, x0, y, 'W')
        paint(c, y0 + 6, x0 - 1, x0 + 1, 'G'); dot(c, x0, y0 + 7, 'P')
    return rows(c)

ACC = {'cloakShort': cloak(False), 'cloakLong': cloak(True), 'shield': shield(False), 'runeShield': shield(True),
       'headband': headband(), 'helmet': helmet(), 'crown': crown(), 'halo': halo(), 'floatSwords': float_swords()}

COMMON = {'S': 0xf2c9a2, 'H': 0x5a3a2a, 'J': 0x8a6448, 'E': 0x2a2440, 'm': 0xb0605a,
          'M': 0x3c8cff, 'N': 0xb8e4ff, 'Y': 0xffe060, 'X': 0xff6a3c}
LOOKS = {
    'trainee':    {'pal': {'A': 0xd8c8a0, 'B': 0x7a5a3a, 'C': 0x7a5a3a, 'G': 0xc0483a, 'W': 0xb08050, 'P': 0x6a4428, 'L': 0x7a5232, 'D': 0x9a7a4a, 'R': 0xb08050},
                   'back': [], 'front': ['headband']},
    'swordsman':  {'pal': {'A': 0xa86e3c, 'B': 0x5a3a20, 'C': 0x5a3a20, 'G': 0xc8a040, 'W': 0xd8dde6, 'P': 0x5a3a20, 'L': 0x6a4428, 'D': 0x8a5a30, 'R': 0xd8dde6},
                   'back': [], 'front': ['shield']},
    'spellblade': {'pal': {'A': 0xc4ccd8, 'B': 0x3a4a78, 'C': 0x2f56b0, 'G': 0xe8b84a, 'W': 0xe8f0ff, 'P': 0x6a4428, 'L': 0x7a5232, 'D': 0x3a4a78, 'R': 0x4ad8ff},
                   'back': ['cloakShort'], 'front': []},
    'knight':     {'pal': {'A': 0x5a6276, 'B': 0x2a2f40, 'C': 0x283070, 'G': 0xe0b040, 'W': 0xe8f0ff, 'P': 0x3a2a20, 'L': 0x3a3040, 'D': 0x3a4060, 'R': 0x6ad0ff},
                   'back': ['cloakLong'], 'front': ['helmet', 'runeShield']},
    'saint':      {'pal': {'A': 0xf2f0e6, 'B': 0xc8b070, 'C': 0xe8c860, 'G': 0xffd860, 'W': 0xffffff, 'P': 0xc8a050, 'L': 0xd8c090, 'D': 0xe8e0c8, 'R': 0x9ae8ff},
                   'back': ['halo', 'cloakLong'], 'front': ['crown', 'floatSwords']},
}

FRAMES = {  # 자세: (몸, 위 층, 옮김, 효과)
    'idle': ('stand', 'stand', None, []), 'blink': ('stand', 'blink', None, []),
    'cast1': ('stand', 'stand', None, ['cast1']), 'cast2': ('stand', 'stand', None, ['cast2']),
    'slash': ('stand', 'slash', (-3, 0), ['arc']), 'victory': ('stand', 'victory', None, ['sparkle']),
    'hit': ('stand', 'hit', (-1, 1), ['boom']), 'levelup': ('stand', 'stand', None, ['pillar']), 'sleep': ('sit', 'sit', None, ['zzz']),
}

# ---------- 합치기 · 음영 (shade.ts 와 같은 규칙) ----------
def compose(*layers):
    out = [list(r) for r in layers[0]]
    for l in layers[1:]:
        for y, r in enumerate(l):
            for x, ch in enumerate(r):
                if ch != '.': out[y][x] = ch
    return rows(out)

def shift(grid, dx, dy):
    c = canvas()
    for y, r in enumerate(grid):
        for x, ch in enumerate(r):
            if ch != '.' and 0 <= x + dx < W and 0 <= y + dy < H: c[y + dy][x + dx] = ch
    return rows(c)

def ch_(v, s): return (v >> s) & 255
def mix(c, t, k):
    m = lambda s: round(ch_(c, s) + (ch_(t, s) - ch_(c, s)) * k)
    return (m(16) << 16) | (m(8) << 8) | m(0)
def tones(b): return {'hi': mix(b, 0xfff4d8, 0.35), 'base': b, 'lo': mix(b, 0x1c1830, 0.38), 'out': mix(b, 0x0c0a14, 0.72)}

def shade(grid, pal):
    h, w = len(grid), len(grid[0])
    at = lambda x, y: grid[y][x] if 0 <= x < w and 0 <= y < h else '.'
    out_rgb = [[None] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            m = grid[y][x]
            if m in MATERIALS and m in pal:
                same = lambda n: n == m or n in DETAILS
                up, down = at(x, y - 1), at(x, y + 1)
                top = not same(up) or not same(at(x - 1, y))
                bottom = not same(down) or not same(at(x + 1, y))
                if m == 'S': t = 'lo' if up == 'H' or not same(down) else 'base'
                elif bottom and not top: t = 'lo'
                elif top and not bottom: t = 'hi'
                else: t = 'base'
                out_rgb[y][x] = tones(pal[m])[t]
            elif m == '.':
                for nx, ny in ((x, y - 1), (x - 1, y), (x + 1, y), (x, y + 1)):
                    n = at(nx, ny)
                    if n in MATERIALS and n in pal:
                        out_rgb[y][x] = tones(pal[n])['out']; break
            else:
                out_rgb[y][x] = pal[m]
    return out_rgb

def frame(stage, pose):
    look = LOOKS[stage]; pal = {**COMMON, **look['pal']}
    bodyk, topk, sh, effects = FRAMES[pose]
    g = compose(*[ACC[a] for a in look['back']], BODIES[bodyk], *[ACC[a] for a in look['front']]) if look['back'] else compose(BODIES[bodyk], *[ACC[a] for a in look['front']])
    if sh: g = shift(g, *sh)
    g = compose(g, TOPS[topk])
    rgb = shade(g, pal)
    for e in effects:
        for y, r in enumerate(EFFECTS[e]):
            for x, ch in enumerate(r):
                if ch != '.': rgb[y][x] = pal[ch]
    return rgb

# ---------- PNG ----------
def png(path, pixels, w, h):
    raw = b''.join(b'\x00' + bytes(sum(([*px] for px in pixels[y * w:(y + 1) * w]), [])) for y in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))

def sheet(path, bg, scale=4, gap=8, stages=None, poses=None):
    stages = stages or list(LOOKS); poses = poses or list(FRAMES)
    cw, chh = W * scale + gap, H * scale + gap
    tw, th = cw * len(poses) + gap, chh * len(stages) + gap
    px = [bg] * (tw * th)
    for si, s in enumerate(stages):
        for pi, p in enumerate(poses):
            rgb = frame(s, p); ox, oy = gap + pi * cw, gap + si * chh
            for y in range(H):
                for x in range(W):
                    v = rgb[y][x]
                    if v is None: continue
                    col = ((v >> 16) & 255, (v >> 8) & 255, v & 255)
                    for dy in range(scale):
                        base = (oy + y * scale + dy) * tw + ox + x * scale
                        for dx in range(scale): px[base + dx] = col
    png(path, px, tw, th)

if __name__ == '__main__':
    if sys.argv[1] == 'preview':
        out = sys.argv[2]
        sheet(f'{out}/art32-dark.png', (30, 30, 36))
        sheet(f'{out}/art32-light.png', (245, 245, 240))
        print('ok')

# ---------- art.ts 만들기 ----------
def ts_grid(g, ind='  '):
    return '[\n' + ''.join(f"{ind}  '{r}',\n" for r in g) + f'{ind}]'

def hx(v): return '0x%06x' % v

def emit_ts(path):
    o = []
    o.append("""// 마검사 그림 2판 — 32×32, 재질 글자로 그리고 음영 · 테두리는 shade.ts 가 넣는다.
// 만든 곳: tools/art/art32.py (`python3 tools/art/art32.py ts <이 파일>`). 그림을 고칠 때는 스크립트를 고치고 다시 만든다.
// 재질: S 피부 · H 머리 · A 갑옷/옷 · B 어두운 옷 · C 망토 · G 금 · W 칼날 · P 손잡이 · L 가죽 · D 방패
// 디테일(음영 없음): E 눈 · m 입 · J 머리 윤기 · R 룬 빛 / 효과: M 마법 · N 밝은 빛 · Y 반짝임 · X 불꽃
// 모두 이 프로젝트를 위해 새로 그린 그림이다.
import type { StageId } from './balance.ts'
import { shade } from './shade.ts'
import { compose, shiftGrid, type Grid, type Palette } from './sprites.ts'
import type { Pose } from './status.ts'

const MATERIALS = '%s'
const DETAILS = '%s'
""" % (MATERIALS, DETAILS))
    o.append("const COMMON = { " + ", ".join(f"{k}: {hx(v)}" for k, v in COMMON.items()) + " }\n")
    o.append("const BODIES: Record<'stand' | 'sit', Grid> = {")
    for k, g in BODIES.items(): o.append(f"  {k}: {ts_grid(g)},")
    o.append("}\n")
    o.append("// 자세마다 몸 위에 얹는 층(무기 · 오른팔 · 얼굴)")
    o.append("export const POSES: Record<'stand' | 'blink' | 'slash' | 'victory' | 'hit' | 'sit', Grid> = {")
    for k, g in TOPS.items(): o.append(f"  {k}: {ts_grid(g)},")
    o.append("}\n")
    o.append("const ACC = {")
    for k, g in ACC.items(): o.append(f"  {k}: {ts_grid(g)},")
    o.append("} satisfies Record<string, Grid>\n")
    o.append("export type EffectId = " + " | ".join(f"'{k}'" for k in EFFECTS) )
    o.append("// 음영 뒤에 얹는 효과")
    o.append("export const EFFECTS: Record<EffectId, Grid> = {")
    for k, g in EFFECTS.items(): o.append(f"  {k}: {ts_grid(g)},")
    o.append("}\n")
    o.append("// 단계마다 재질 색 · 뒤 장신구(몸 뒤) · 앞 장신구(몸 위)")
    o.append("export const STAGE_LOOKS: Record<StageId, { palette: Palette; back: readonly Grid[]; front: readonly Grid[] }> = {")
    for sid, lk in LOOKS.items():
        pal = ", ".join(f"{k}: {hx(v)}" for k, v in lk['pal'].items())
        back = ", ".join(f"ACC.{a}" for a in lk['back']); front = ", ".join(f"ACC.{a}" for a in lk['front'])
        o.append(f"  {sid}: {{ palette: {{ ...COMMON, {pal} }}, back: [{back}], front: [{front}] }},")
    o.append("}\n")
    o.append("type FrameDef = { body: 'stand' | 'sit'; top: keyof typeof POSES; shift: readonly [number, number] | null; effects: readonly EffectId[] }")
    o.append("const FRAMES: Record<Pose, FrameDef> = {")
    for p, (b, t, sh, ef) in FRAMES.items():
        shs = f"[{sh[0]}, {sh[1]}]" if sh else 'null'
        o.append(f"  {p}: {{ body: '{b}', top: '{t}', shift: {shs}, effects: [" + ", ".join(f"'{e}'" for e in ef) + "] },")
    o.append("}\n")
    o.append("""const cache = new Map<string, { grid: Grid; palette: Palette }>()

// 몸 뒤 장신구 → 몸 → 앞 장신구 → (옮김) → 자세 층 → 음영 → 효과. 결과는 한 번만 만들어 둔다
// frame 1 은 레벨업 빛기둥의 두 번째 프레임
export function frameFor(stage: StageId, pose: Pose, frame: 0 | 1 = 0): { grid: Grid; palette: Palette } {
  const id = `${stage}|${pose}|${frame}`
  const hit = cache.get(id)
  if (hit) return hit
  const look = STAGE_LOOKS[stage]
  const def = FRAMES[pose]
  let g = compose(...look.back, BODIES[def.body], ...look.front)
  if (def.shift) g = shiftGrid(g, def.shift[0], def.shift[1])
  g = compose(g, POSES[def.top])
  const shaded = shade(g, look.palette, MATERIALS, DETAILS)
  const effects = def.effects.map(e => EFFECTS[pose === 'levelup' && frame === 1 && e === 'pillar' ? 'pillar2' : e])
  const out = { grid: effects.length ? compose(shaded.grid, ...effects) : shaded.grid, palette: shaded.palette }
  cache.set(id, out)
  return out
}

// 아직 못 간 단계: 그림 칸을 모두 어두운 한 색으로
export function silhouette(f: { grid: Grid; palette: Palette }): { grid: Grid; palette: Palette } {
  return { grid: f.grid.map(r => r.replace(/[^.]/g, 'k')), palette: { k: 0x3a3a48 } }
}
""")
    open(path, 'w', encoding='utf-8').write('\n'.join(o))

if __name__ == '__main__' and sys.argv[1] == 'ts':
    emit_ts(sys.argv[2]); print('written')
