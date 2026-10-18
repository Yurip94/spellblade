# 마검사 그림 3판(메이플스토리 클래식풍) 원본 — 재질 글자로 그리고 음영 · 테두리는 shade 규칙(shade.ts 와 같음)이 넣는다
#   python3 tools/art/art3.py preview <폴더>   → 미리보기 PNG
#   python3 tools/art/art3.py ts <art3.ts 경로> → plugins/spellblade/hooks/lib/art3.ts
#   python3 tools/art/art3.py check            → 단계 1 · idle 이 시안 7판(v3-mock/maple_hero.py)과 점 하나까지 같은지
# 몬스터 12종은 art3_monsters.py, 효과 · 글꼴 · 배경은 art3_scene.py 에 있다(이 파일이 모아 art3.ts 로 내보낸다).
# 모두 이 프로젝트를 위해 새로 그린 그림이다(메이플스토리 그림 · 이름을 가져오지 않는다).
import importlib.util, json, math, os, struct, sys, zlib
import art3_monsters as AM, art3_scene as SC

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 44, 48          # 영웅 칸
FEET = 44              # 서 있을 때 발끝 줄(재질 기준)
MATERIALS = 'SHABCGWPLDKaTFI'
DETAILS = 'EmJRwibsNYM'

# ---------- 공통 ----------
def canvas(w=W, h=H): return [['.'] * w for _ in range(h)]
def rows(c): return [''.join(r) for r in c]
def stamp(c, grid, ox, oy):
    for y, r in enumerate(grid):
        for x, ch in enumerate(r):
            if ch != '.' and 0 <= oy + y < len(c) and 0 <= ox + x < len(c[0]): c[oy + y][ox + x] = ch
def pts(c, points, ch):
    for (x, y) in points:
        if 0 <= y < len(c) and 0 <= x < len(c[0]): c[y][x] = ch
def blade(c, points, thick=2):
    for (x, y) in points:
        for t in range(thick): pts(c, [(x + t, y)], 'W')
def shift(grid, dx, dy):
    out = canvas(len(grid[0]), len(grid))
    for y, r in enumerate(grid):
        for x, ch in enumerate(r):
            if ch != '.' and 0 <= x + dx < len(r) and 0 <= y + dy < len(grid): out[y + dy][x + dx] = ch
    return rows(out)

# ---------- 음영(shade.ts 와 같은 규칙) ----------
def ch_(v, s): return (v >> s) & 255
def mix(c, t, k):   # 반올림은 JS Math.round 과 같게(.5 는 올림) — TS 와 점 하나까지 같아야 한다
    m = lambda s: math.floor(ch_(c, s) + (ch_(t, s) - ch_(c, s)) * k + 0.5)
    return (m(16) << 16) | (m(8) << 8) | m(0)
def tones(b): return {'hi': mix(b, 0xfff4d8, 0.35), 'base': b, 'lo': mix(b, 0x1c1830, 0.38), 'out': mix(b, 0x0c0a14, 0.72)}

def shade_rgb(grid, pal, materials=MATERIALS, details=DETAILS):
    h, w = len(grid), len(grid[0])
    at = lambda x, y: grid[y][x] if 0 <= x < w and 0 <= y < h else '.'
    out = [[None] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            m = grid[y][x]
            if m in materials and m in pal:
                same = lambda n: n == m or n in details
                up, down = at(x, y - 1), at(x, y + 1)
                top = not same(up) or not same(at(x - 1, y))
                bottom = not same(down) or not same(at(x + 1, y))
                if m == 'S': t = 'lo' if up == 'H' or not same(down) else 'base'
                elif bottom and not top: t = 'lo'
                elif top and not bottom: t = 'hi'
                else: t = 'base'
                out[y][x] = tones(pal[m])[t]
            elif m == '.':
                for nx, ny in ((x, y - 1), (x - 1, y), (x + 1, y), (x, y + 1)):
                    n = at(nx, ny)
                    if n in materials and n in pal:
                        out[y][x] = tones(pal[n])['out']; break
            elif m in pal:
                out[y][x] = pal[m]
    return out

# ---------- 영웅: 시안 7판(검은 짧은 머리 · 1.5등신 · 둥근 큰 눈) ----------
HEAD = [
    '.........KH....KH...........',
    '........KHHH..KHHH..........',
    '......KHHHHHHHHHHHHH........',
    '.....KHHHHHHHHHHHHHHHH......',
    '....KHHHHHJJJJHHHHHHHHH.....',
    '...KHHHHHJJJJHHHHHHHHHHH....',
    '...KHHHHHHJJHHHHHHHHHHHHH...',
    '..KHHHHHHHHHHHHHHHHHHHHHHH..',
    '..KHHHHHHHHHHHHHHHHHHHHHHHH.',
    '.KHHHHHHHHHHHHHHHHHHHHHHHHH.',
    '.KHHHHHHHHHHHHHHHHHHHHHHHHHH',
    '.KHHHHHHHHHHHSHHHHSSHHHHHSHH',
    '.KHHHHHHHHHSSSSHHSSSSSHHSSSH',
    '.KHHHHHHHHSSSSSSSSSSSSSSSSSH',
    '..KHHHHHHSSSSSSSSSSSSSSSSSS.',
    '..KHHHHHsSSSSwwEESSSwwEESSS.',
    '..KHHHHssSSSSwwEESSSwwEESSS.',
    '..KHHHHHsSSSSEEEESSSEEEESSS.',
    '...KHHHHSSSSSEEEESSSEEEESSS.',
    '...KHHHHSSSSSiiiiSSSiiiiSSS.',
    '....KHHHSSSSSiiiiSSSiiiiSS..',
    '.....KHHSSSSbbSSSSSSSSSbbS..',
    '......KSSSSSSSSSSmmSSSSSSS..',
    '.......SSSSSSSSSSSSSSSSSS...',
    '.........SSSSSSSSSSSSSS.....',
    '...........SSSSSSSSSSS......',
]
BODY = [
    '...........SSSS...........',
    '.........TTTTTTT..........',
    '........AATTTTTAA.........',
    '.......AAAAAaAAAAA........',
    '.......AAAAAaAAAAAA.......',
    '.......AAAAAaAAAAAAL......',
    '.......LLLLLGGLLLLLL......',
    '........BBBBBBBBBBB.......',
    '........BBBB...BBBB.......',
    '.......LLLLL...LLLLL......',
    '.......LLLLLL..LLLLLL.....',
]
SIT_BODY = [
    '...........SSSS.............',
    '.........TTTTTTT............',
    '........AATTTTTAA....BBB....',
    '.......AAAAAaAAAAA..BBBBB...',
    '.......AAAAAaAAAALLBBBBBB...',
    '.......LLLLLGGLLLBBBBBBBB...',
    '......BBBBBBBBBBBBB...BBBB..',
    '......BBBBBBBBBBBB....LLLLL.',
]
HEAD_AT = {'stand': (9, 8), 'sit': (9, 11)}
BODY_AT = {'stand': (10, 34), 'sit': (10, 37)}
SIT_DY = 3  # 앉으면 머리 · 몸이 3줄 내려간다(장신구도 같이)

# 머리 기준 눈 자리(두 눈 4 × 6)
EYES = [(x, y) for x in list(range(13, 17)) + list(range(20, 24)) for y in range(15, 21)]
FACE = {
    'closed': ((13, 18), (14, 19), (15, 19), (16, 18), (20, 18), (21, 19), (22, 19), (23, 18)),   # 감은 눈 ‿ ‿
    'squint': ((13, 15), (14, 16), (15, 16), (16, 17), (15, 18), (14, 18), (13, 19),            # > <
               (23, 15), (22, 16), (21, 16), (20, 17), (21, 18), (22, 18), (23, 19)),
    'happy': ((13, 18), (14, 17), (15, 17), (16, 18), (20, 18), (21, 17), (22, 17), (23, 18)),   # ^ ^
}

def face(c, kind, at):
    ox, oy = at
    for (x, y) in EYES: c[oy + y][ox + x] = 'S'
    for (x, y) in FACE[kind]: c[oy + y][ox + x] = 'E'

def body(kind):
    c = canvas()
    stamp(c, HEAD, *HEAD_AT[kind])
    stamp(c, SIT_BODY if kind == 'sit' else BODY, *BODY_AT[kind])
    return c

def weapon_idle(c):
    blade(c, [(30 + (37 - y) // 2, y) for y in range(21, 38)])
    pts(c, [(x, 38) for x in range(27, 34)], 'G')
    pts(c, [(29, 39), (30, 39), (29, 40), (30, 40)], 'L')

def weapon_slash(c):
    pts(c, [(x, y) for x in range(26, 31) for y in (38, 39)], 'A')
    pts(c, [(x, y) for x in range(31, 34) for y in (38, 39)], 'L')
    pts(c, [(34, y) for y in range(35, 43)], 'G')
    blade(c, [(x, y) for x in range(35, 44) for y in (38, 39)], 1)

def weapon_cast(c):
    pts(c, [(26, 38), (27, 38), (27, 37), (28, 37), (28, 36), (29, 36)], 'A')
    pts(c, [(29, 34), (30, 34), (29, 35), (30, 35), (31, 35)], 'L')
    pts(c, [(30, 32), (31, 33), (32, 34)], 'G')
    blade(c, [(32 + i, 32 - i) for i in range(0, 9)])

def weapon_hit(c):
    # 맞고 칼끝이 아래로 처진다
    pts(c, [(30, y) for y in range(37, 42)], 'G')
    blade(c, [(31 + i, 39 + (i + 1) // 2) for i in range(0, 9)])

def weapon_sit(c):
    blade(c, [(4, y) for y in range(22, 44)])
    pts(c, [(x, 43) for x in range(1, 9)], 'G')
    pts(c, [(4, 44), (5, 44), (4, 45), (5, 45)], 'P')

def make_poses():
    p = {}
    c = body('stand'); weapon_idle(c); p['idle'] = c
    c = body('stand'); weapon_idle(c); face(c, 'closed', HEAD_AT['stand']); p['blink'] = c
    c = body('stand'); weapon_slash(c); p['slash'] = c
    c = body('stand'); weapon_cast(c); p['cast'] = c
    c = body('stand'); weapon_cast(c); face(c, 'squint', HEAD_AT['stand']); p['castFail'] = c
    c = body('stand'); weapon_hit(c); face(c, 'squint', HEAD_AT['stand']); p['hit'] = c
    c = body('stand'); weapon_cast(c); face(c, 'happy', HEAD_AT['stand']); p['victory'] = c
    c = body('sit'); weapon_sit(c); p['sit'] = c
    c = body('sit'); weapon_sit(c); face(c, 'closed', HEAD_AT['sit']); p['sleep'] = c
    return {k: rows(v) for k, v in p.items()}

# ---------- 장신구(서기 기준으로 그리고, 앉기는 3줄 내린다) ----------
def oval(c, ox, oy, w, h, rim, fill, boss):
    cx, cy = (w - 1) / 2, (h - 1) / 2
    for y in range(h):
        for x in range(w):
            dx, dy = (x - cx) / (w / 2), (y - cy) / (h / 2)
            d = dx * dx + dy * dy
            if d <= 1.0: c[oy + y][ox + x] = rim if d > 0.6 else fill
    if boss:
        for (x, y) in ((cx, cy), (cx, cy - 1), (cx, cy + 1), (cx - 1, cy), (cx + 1, cy)): c[oy + int(y)][ox + int(x)] = boss

def acc_headband():
    c = canvas()
    for x in range(10, 37):
        if HEAD[10][x - 9] in 'HK': c[18][x] = 'F'
    pts(c, [(9, 18), (8, 19), (7, 20), (8, 20), (6, 21), (9, 19)], 'F')  # 뒤로 날리는 매듭
    return c

def acc_round_shield():   # 시안 7판 방패 그대로
    c = canvas(); oval(c, 8, 33, 9, 11, 'G', 'D', 'G'); return c

def acc_iron_shield():
    c = canvas(); oval(c, 8, 33, 9, 11, 'I', 'D', 'G'); return c

def acc_rune_shield():    # 연 모양 방패 + 룬
    c = canvas()
    for y in range(32, 45):
        half = 5 if y < 40 else 5 - (y - 39)
        for x in range(12 - half, 12 + half):
            c[y][x] = 'I' if (x in (12 - half, 12 + half - 1) or y == 32) else 'D'
    pts(c, [(11, 35), (11, 36), (11, 37), (10, 36), (12, 36)], 'R')
    return c

def acc_magic_shield(big=False):
    c = canvas()
    w, h, ox, oy = (11, 13, 6, 32) if big else (9, 11, 8, 33)
    oval(c, ox, oy, w, h, 'G', 'C', None)
    cx, cy = ox + w // 2, oy + h // 2
    r = 3 if big else 2
    for a in range(0, 360, 30):
        t = math.radians(a)
        pts(c, [(round(cx + r * math.cos(t)), round(cy + r * math.sin(t)))], 'R')
    pts(c, [(cx, cy)], 'R')
    return c

def acc_cape(long):
    # 어깨 뒤에서 흘러내려 뒤로 퍼진다(몸에 가려지는 쪽은 그대로 두고, 등 뒤로 보이는 쐐기). 단은 물결
    c = canvas()
    last = 45 if long else 41
    for y in range(35, last + 1):
        left = max(7, 16 - (y - 35))
        for x in range(left, 19): c[y][x] = 'C'
    for x in range(7, 19):
        if x % 2 == 0: c[last][x] = '.'
    return c

def acc_circlet():
    c = canvas()
    for x in range(19, 36):
        if HEAD[10][x - 9] in 'HK': c[18][x] = 'G'
    pts(c, [(27, 18)], 'R')
    return c

def acc_back_circle():
    c = canvas()
    cx, cy, r = 19, 27, 14
    for a in range(0, 360, 4):
        t = math.radians(a)
        pts(c, [(round(cx + r * math.cos(t)), round(cy + r * math.sin(t)))], 'R')
    for a in range(0, 360, 45):
        t = math.radians(a)
        pts(c, [(round(cx + (r - 3) * math.cos(t)), round(cy + (r - 3) * math.sin(t)))], 'R')
    return c

def float_sword(c, x, top, length=12):
    pts(c, [(x, top + i) for i in range(length)], 'W')
    pts(c, [(x - 1, top + length), (x, top + length), (x + 1, top + length)], 'G')
    pts(c, [(x, top + length + 1), (x, top + length + 2)], 'P')

def acc_float1():
    c = canvas(); float_sword(c, 3, 14); return c

def acc_float3():
    c = canvas(); float_sword(c, 2, 20, 10); float_sword(c, 5, 10, 10); float_sword(c, 8, 1, 9); return c

ACCESSORIES = {   # 이름: (그림 함수, 층)
    'headband': (acc_headband, 'front'),
    'roundShield': (acc_round_shield, 'back'),
    'ironShield': (acc_iron_shield, 'back'),
    'runeShield': (acc_rune_shield, 'back'),
    'magicShield': (lambda: acc_magic_shield(False), 'back'),
    'bigMagicShield': (lambda: acc_magic_shield(True), 'back'),
    'shortCape': (lambda: acc_cape(False), 'back'),
    'longCape': (lambda: acc_cape(True), 'back'),
    'circlet': (acc_circlet, 'front'),
    'backCircle': (acc_back_circle, 'back'),
    'floatSword1': (acc_float1, 'back'),
    'floatSword3': (acc_float3, 'back'),
}

def make_accessories():
    out = {}
    for k, (fn, layer) in ACCESSORIES.items():
        stand = rows(fn())
        out[k] = {'stand': stand, 'sit': shift(stand, 0, SIT_DY), 'layer': layer}
    return out

# ---------- 단계 12개: 색 · 장신구 · 칼 꾸밈 ----------
COMMON = {'S': 0xffd9bc, 's': 0xeab08e, 'H': 0x2c2c3a, 'J': 0x6a6a88, 'K': 0x14141e,
          'E': 0x2a1c2a, 'w': 0xffffff, 'i': 0x7a4a2a, 'b': 0xffa8a0, 'm': 0xc0605a,
          'N': 0xb8e4ff, 'Y': 0xffe060, 'M': 0x3c8cff, 'I': 0x9aa0aa, 'F': 0xd84a3a, 'C': 0x3a6ad8, 'D': 0xb07a40}
TIERS = [
    ({'A': 0xe8dcc0, 'a': 0xc8b896, 'T': 0xf8f4ea, 'L': 0x8a5a32, 'B': 0x6a5a48, 'G': 0xb08850, 'W': 0xb08050, 'P': 0x6a4428, 'R': 0xb08050}, ['headband'], 'plain'),
    ({'A': 0xc98a4a, 'a': 0x9a6232, 'T': 0xf4ead8, 'L': 0x8a5a32, 'B': 0x4a5a8a, 'G': 0xf0c040, 'W': 0xe8f0ff, 'P': 0x6a4428, 'D': 0xb07a40, 'R': 0x4ad8ff}, ['roundShield'], 'plain'),
    ({'A': 0x8a5a32, 'a': 0x6a4224, 'T': 0xe8dcc8, 'L': 0x5a3a20, 'B': 0x3a4060, 'G': 0xf0c040, 'W': 0xd8e0ea, 'P': 0x4a3020, 'D': 0x9a6a3a, 'R': 0x4ad8ff}, ['ironShield'], 'plain'),
    ({'A': 0xb8c4d8, 'a': 0x8a98b0, 'T': 0x3a4a78, 'L': 0x5a4a3a, 'B': 0x3a4a78, 'G': 0xe8b84a, 'W': 0xe8f0ff, 'P': 0x6a4428, 'C': 0x2f56b0, 'R': 0x4ad8ff}, ['shortCape'], 'rune'),
    ({'A': 0xd8dde6, 'a': 0xa8b0c0, 'T': 0x2f4a8a, 'L': 0x4a4050, 'B': 0x2f3a6a, 'G': 0xe8c060, 'W': 0xbfe4ff, 'P': 0x3a2a40, 'C': 0x2f56b0, 'D': 0xc0c8d8, 'R': 0x6ae0ff}, ['shortCape', 'runeShield'], 'rune'),
    ({'A': 0x6a6ac8, 'a': 0x4a4a9a, 'T': 0xd8d0ff, 'L': 0x3a3050, 'B': 0x2a2a5a, 'G': 0xe8c060, 'W': 0xd0c8ff, 'P': 0x3a2a50, 'C': 0x4a2a8a, 'R': 0xb48aff}, ['longCape'], 'rune'),
    ({'A': 0x3a4a8a, 'a': 0x2a3466, 'T': 0xe0b040, 'L': 0x2a2a40, 'B': 0x1a2040, 'G': 0xf0c040, 'W': 0xd8f0ff, 'P': 0x2a2a40, 'C': 0x283070, 'R': 0x6ad0ff}, ['longCape', 'magicShield'], 'glow'),
    ({'A': 0x3a4a8a, 'a': 0x2a3466, 'T': 0xf0c040, 'L': 0x2a2a40, 'B': 0x1a2040, 'G': 0xf0c040, 'W': 0xd8f0ff, 'P': 0x2a2a40, 'C': 0x283070, 'R': 0x9ae8ff}, ['magicShield', 'circlet'], 'bolt'),
    ({'A': 0xd0d8e8, 'a': 0x98a4bc, 'T': 0x4a5a8a, 'L': 0x3a3a4a, 'B': 0x2a3050, 'G': 0xe8c060, 'W': 0xeaf6ff, 'P': 0x3a3a4a, 'C': 0x3a4a8a, 'R': 0x8ae0ff}, ['bigMagicShield'], 'glow'),
    ({'A': 0xf2f0e6, 'a': 0xd8d0b0, 'T': 0xe8c860, 'L': 0xc8a050, 'B': 0xd8cfa8, 'G': 0xffd860, 'W': 0xffffff, 'P': 0xc8a050, 'C': 0xe8c860, 'R': 0xfff0a0}, ['backCircle'], 'holy'),
    ({'A': 0xf6f2e8, 'a': 0xe0c070, 'T': 0xffd860, 'L': 0xc8a050, 'B': 0xe0d4b0, 'G': 0xffe070, 'W': 0xffffff, 'P': 0xd8b060, 'C': 0xe8c860, 'R': 0xfff4b0}, ['backCircle', 'floatSword1'], 'holy'),
    ({'A': 0xeef6ff, 'a': 0x9ad0ff, 'T': 0xffd860, 'L': 0x8ab8e8, 'B': 0xc8e0ff, 'G': 0xffe070, 'W': 0xffffff, 'P': 0x8ab8e8, 'C': 0x9ad0ff, 'R': 0xc8f0ff}, ['backCircle', 'floatSword3'], 'holy'),
]

def tier_palette(t): return {**COMMON, **TIERS[t][0]}

# 칼 꾸밈(hero3.ts 의 decorate 와 같은 규칙)
def decorate(grid, kind):
    if kind == 'plain': return grid
    g = [list(r) for r in grid]
    h, w = len(g), len(g[0])
    if kind in ('glow', 'bolt', 'holy'):
        for y in range(h):
            for x in range(w):
                if grid[y][x] == 'W':
                    for nx, ny in ((x, y - 1), (x - 1, y), (x + 1, y), (x, y + 1)):
                        if 0 <= nx < w and 0 <= ny < h and grid[ny][nx] == '.': g[ny][nx] = 'N'
    n = 0
    for y in range(h):
        for x in range(w):
            if grid[y][x] != 'W': continue
            n += 1
            if kind == 'rune' and n % 3 == 0: g[y][x] = 'R'
            elif kind == 'bolt' and (x + y) % 2 == 0: g[y][x] = 'Y'
            elif kind == 'holy' and n % 3 == 0: g[y][x] = 'Y'
    return rows(g)

def compose(*layers):
    out = [list(r) for r in layers[0]]
    for l in layers[1:]:
        for y, r in enumerate(l):
            for x, ch in enumerate(r):
                if ch != '.': out[y][x] = ch
    return rows(out)

POSE_KEY = {'idle': 'idle', 'blink': 'blink', 'slash': 'slash', 'cast1': 'cast', 'cast2': 'cast', 'castHit': 'cast',
            'castFail': 'castFail', 'hit': 'hit', 'victory': 'victory', 'levelup': 'idle', 'sit': 'sit', 'sleep': 'sleep'}

POSES = make_poses()
ACCS = make_accessories()

def hero_letters(tier, pose):
    pal, accs, kind = TIERS[tier]
    key = POSE_KEY[pose]
    which = 'sit' if key in ('sit', 'sleep') else 'stand'
    back = [ACCS[a][which] for a in accs if ACCS[a]['layer'] == 'back']
    front = [ACCS[a][which] for a in accs if ACCS[a]['layer'] == 'front']
    return decorate(compose(*back, POSES[key], *front), kind)

def hero_rgb(tier, pose):
    return shade_rgb(hero_letters(tier, pose), tier_palette(tier))

# ---------- 몬스터 · 장면 재료 ----------
MONSTER_FRAMES = [AM.frames(fn) for fn in AM.MONSTERS]   # (프레임, 팔레트, 재질, 디테일)
MONSTER_POSES = ['idle0', 'idle1', 'attack', 'hit']
FX = SC.make_fx()
BACKDROPS = SC.make_backdrops()

def monster_rgb(t, pose):
    if pose == 'hit':   # 맞으면 idle0 의 모든 색(테두리 포함)을 흰색 쪽으로 70%
        return [[None if v is None else mix(v, 0xffffff, 0.7) for v in r] for r in monster_rgb(t, 'idle0')]
    fr, pal, mat, det = MONSTER_FRAMES[t]
    return shade_rgb(fr[pose], pal, mat, det)

def flat_rgb(grid, pal): return [[None if ch == '.' else pal[ch] for ch in r] for r in grid]

def fnv(rgb):
    s = '/'.join(''.join('.' if v is None else '%06x' % v for v in r) for r in rgb)
    h = 0x811c9dc5
    for c in s:
        h ^= ord(c)
        h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h

# ---------- PNG ----------
def png(path, pixels, w, h):
    raw = b''.join(b'\x00' + bytes(sum(([*px] for px in pixels[y * w:(y + 1) * w]), [])) for y in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))

def sheet(path, cells, cols, cw, chh, scale=3, gap=6, bg=(30, 30, 36)):
    rows_n = (len(cells) + cols - 1) // cols
    tw, th = (cw * scale + gap) * cols + gap, (chh * scale + gap) * rows_n + gap
    px = [bg] * (tw * th)
    for i, rgb in enumerate(cells):
        ox, oy = gap + (i % cols) * (cw * scale + gap), gap + (i // cols) * (chh * scale + gap)
        for y in range(len(rgb)):
            for x in range(len(rgb[0])):
                v = rgb[y][x]
                if v is None: continue
                col = ((v >> 16) & 255, (v >> 8) & 255, v & 255)
                for dy in range(scale):
                    base = (oy + y * scale + dy) * tw + ox + x * scale
                    for dx in range(scale): px[base + dx] = col
    png(path, px, tw, th)

PREVIEW_POSES = ['idle', 'blink', 'slash', 'cast1', 'castFail', 'hit', 'victory', 'sit', 'sleep']

def preview(out):
    cells = [hero_rgb(t, p) for t in range(12) for p in PREVIEW_POSES]
    sheet(os.path.join(out, 'preview-v3-hero.png'), cells, len(PREVIEW_POSES), W, H)
    cells = [monster_rgb(t, p) for t in range(12) for p in MONSTER_POSES]
    sheet(os.path.join(out, 'preview-v3-monsters.png'), cells, len(MONSTER_POSES), max(len(c[0]) for c in cells), max(len(c) for c in cells), scale=3)
    sheet(os.path.join(out, 'preview-v3-scene.png'), scene_samples(), 2, SC.SW, SC.SH, scale=3, gap=10)

# 장면 견본(실제 배치는 hooks/lib/scene.ts 가 한다): 마검사 칸은 (12, 8), 몬스터 칸 왼쪽은 57, 발끝은 풀 윗줄
def scene_samples():
    def backdrop(k): return [[BACKDROPS[k][1][ch] for ch in r] for r in BACKDROPS[k][0]]
    def put(s, rgb, ox, oy):
        for y, r in enumerate(rgb):
            for x, v in enumerate(r):
                if v is not None and 0 <= ox + x < SC.SW and 0 <= oy + y < SC.SH: s[oy + y][ox + x] = v
    def fx(s, k, ox, oy): put(s, flat_rgb(*FX[k]), ox, oy)
    def monster(s, t, pose='idle0', x=57):
        m = monster_rgb(t, pose); put(s, m, x, SC.GROUND - (len(m) - 1))
    def damage(s, text, ox, oy):
        cells = {}
        for i, ch in enumerate(text):
            for y, r in enumerate(SC.DAMAGE[ch]):
                for x, b in enumerate(r):
                    if b == '#': cells[(ox + i * 7 + x + (i % 2), oy + y - (i % 2))] = y
        for (x, y) in cells:
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    if (x + dx, y + dy) not in cells and 0 <= x + dx < SC.SW and 0 <= y + dy < SC.SH: s[y + dy][x + dx] = 0x6a1408
        for (x, y), row in cells.items(): s[y][x] = 0xfff27a if row < 3 else 0xffc23a if row < 6 else 0xff8a1a
    out = []
    for t in (0, 5, 11):                                     # 낮 전투: 베기 · 칼 궤적 · 데미지
        s = backdrop('day'); put(s, hero_rgb(t, 'slash'), 12, 8); monster(s, t, 'hit' if t == 5 else 'idle0')
        fx(s, 'slashArc', 50, 33); damage(s, '128', 66, 6); out.append(s)
    s = backdrop('night'); put(s, hero_rgb(3, 'sit'), 12, 8)          # 밤 모닥불 휴식
    fx(s, 'fire1', 64, SC.GROUND - 24); fx(s, 'zzz', 48, 6); out.append(s)
    s = backdrop('day'); put(s, hero_rgb(2, 'castFail'), 12, 8)       # 캐스팅 실패: 연기 · 땀
    fx(s, 'smoke', 50, 24); fx(s, 'sweat', 46, 16); monster(s, 3, 'attack'); out.append(s)
    s = backdrop('day'); fx(s, 'pillar1', 22, SC.GROUND - 59)          # 승리 · 레벨업 빛기둥 · 몬스터 연기
    put(s, hero_rgb(6, 'victory'), 12, 8); fx(s, 'poof2', 62, 30); out.append(s)
    return out

# ---------- 시안 7판과 같은지 ----------
def check():
    spec = importlib.util.spec_from_file_location('maple_hero', os.path.join(HERE, 'v3-mock', 'maple_hero.py'))
    mh = importlib.util.module_from_spec(spec); spec.loader.exec_module(mh)
    want = mh.render(mh.pose_idle())
    got = hero_rgb(1, 'idle')
    diff = [(x, y) for y in range(H) for x in range(W) if want[y][x] != got[y][x]]
    if diff:
        print(f'시안 7판과 다른 점 {len(diff)}개: {diff[:12]}'); sys.exit(1)
    print('시안 7판과 같다')

# ---------- art3.ts ----------
def ts_grid(g, ind='  '):
    return '[\n' + ''.join(f"{ind}  '{r}',\n" for r in g) + f'{ind}]'
def hx(v): return '0x%06x' % v
def ts_pal(p): return '{ ' + ', '.join(f"{json.dumps(k) if not k.isalpha() else k}: {hx(v)}" for k, v in p.items()) + ' }'

def emit_ts(path):
    o = ["""// 마검사 그림 3판(메이플스토리 클래식풍) — 재질 글자로 그리고 음영 · 테두리는 shade.ts 가 넣는다.
// 만든 곳: tools/art/art3.py (`python3 tools/art/art3.py ts <이 파일>`). 손으로 고치지 말고 스크립트를 고쳐 다시 만든다.
// 재질: S 피부 · H 머리 · K 머리 결 · A 갑옷 · a 갑옷 주름 · T 속옷 깃 · B 바지 · L 가죽 · G 금 · W 칼날 · P 손잡이 · D 방패 나무 · C 망토 · F 머리띠 천 · I 쇠테
// 디테일(음영 없음): E 눈 · w 눈 반짝 · i 눈동자 · b 볼 · m 입 · s 귀 · J 머리 윤기 · R 룬 빛 · N 칼 빛 · Y 번쩍임 · M 마법
// 모두 이 프로젝트를 위해 새로 그린 그림이다(메이플스토리 그림 · 이름을 가져오지 않는다).
import type { Grid, Palette } from './sprites.ts'
"""]
    o.append(f"export const MATERIALS3 = '{MATERIALS}'")
    o.append(f"export const DETAILS3 = '{DETAILS}'")
    o.append(f"export const HERO_W = {W}")
    o.append(f"export const HERO_H = {H}")
    o.append(f"export const HERO_FEET = {FEET}\n")
    keys = list(POSES)
    o.append("export type HeroPoseKey = " + " | ".join(f"'{k}'" for k in keys))
    o.append("export const HERO_POSES: Record<HeroPoseKey, Grid> = {")
    for k in keys: o.append(f"  {k}: {ts_grid(POSES[k])},")
    o.append("}\n")
    akeys = list(ACCS)
    o.append("export type AccessoryId = " + " | ".join(f"'{k}'" for k in akeys))
    o.append("export const HERO_ACCESSORIES: Record<AccessoryId, { stand: Grid; sit: Grid; layer: 'back' | 'front' }> = {")
    for k in akeys:
        a = ACCS[k]
        o.append(f"  {k}: {{ layer: '{a['layer']}', stand: {ts_grid(a['stand'], '    ')}, sit: {ts_grid(a['sit'], '    ')} }},")
    o.append("}\n")
    o.append("export type BladeKind = 'plain' | 'rune' | 'glow' | 'bolt' | 'holy'")
    o.append("export const HERO_TIERS: readonly { palette: Palette; accessories: readonly AccessoryId[]; blade: BladeKind }[] = [")
    for t, (pal, accs, kind) in enumerate(TIERS):
        o.append(f"  {{ palette: {ts_pal(tier_palette(t))}, accessories: [{', '.join(repr(a) for a in accs)}], blade: '{kind}' }},")
    o.append("]\n")
    o.append(f"// 단계 1 · idle 의 Python 렌더 해시(시안 7판과 같음 — art3.py check). TS 음영이 같은지 테스트가 본다")
    o.append(f"export const HERO_CHECK = {{ tier: 1, pose: 'idle', hash: '{fnv(hero_rgb(1, 'idle'))}' }} as const\n")

    o.append("// ---------- 몬스터 12종(5레벨마다 바뀐다, 모두 왼쪽을 본다) ----------")
    o.append("// 재질: Q 몸 · O 배 · 얼굴 · 윗면 · U 껍데기 · 갓 · 날개 · 이끼 · V 발 · 뿔 · 뿌리 · 소용돌이")
    o.append("// 디테일: E 눈 · w 반짝 · i 눈동자 · b 볼 · m 입 · t 이빨 · n 코 · 금 · q 무늬 · 비늘 · y 노란 눈 · r 붉은 눈빛 · c 하늘 눈빛 · g 금장식")
    o.append("// 칸 여백은 왼쪽 3(공격 때 2점 내민다) · 위 1 · 오른쪽 1, 발은 맨 아래 줄(유령만 아래 4줄이 비어 떠 있다)")
    o.append("export const MONSTER_ART: readonly { frames: { idle0: Grid; idle1: Grid; attack: Grid }; palette: Palette; materials: string; details: string }[] = [")
    for t, (fr, pal, mat, det) in enumerate(MONSTER_FRAMES):
        o.append(f"  {{ // {t} {AM.MONSTERS[t].__name__}")
        o.append(f"    materials: '{mat}', details: '{det}',")
        o.append(f"    palette: {ts_pal(pal)},")
        o.append("    frames: {")
        for k in ('idle0', 'idle1', 'attack'): o.append(f"      {k}: {ts_grid(fr[k], '      ')},")
        o.append("    },")
        o.append("  },")
    o.append("]\n")
    o.append("// 단계마다 idle0 의 Python 렌더 해시. TS 음영이 미리보기와 같은지 테스트가 본다")
    o.append("export const MONSTER_CHECK: readonly string[] = [" + ', '.join(f"'{fnv(monster_rgb(t, 'idle0'))}'" for t in range(len(MONSTER_FRAMES))) + "]\n")

    o.append("// ---------- 효과(음영 없이 글자마다 색) ----------")
    o.append("// 칼 궤적은 원의 중심이 (0, 13), 모닥불은 맨 아래 줄이 땅 줄, 빛기둥은 마검사 뒤에 그린다")
    o.append("export type FxId = " + " | ".join(f"'{k}'" for k in FX))
    o.append("export const FX: Record<FxId, { grid: Grid; palette: Palette }> = {")
    for k, (g, pal) in FX.items(): o.append(f"  {k}: {{ palette: {ts_pal(pal)}, grid: {ts_grid(g, '  ')} }},")
    o.append("}\n")

    o.append("// ---------- 글꼴('#' 칸만 있는 모양, 색은 장면이 칠한다) ----------")
    o.append("// damage 6 × 9 데미지 숫자 · small 5 × 7(「+N XP」) · big 7 × 9(「LEVEL UP」)")
    o.append("export const GLYPHS: { damage: Record<string, Grid>; small: Record<string, Grid>; big: Record<string, Grid> } = {")
    for name, d in (('damage', SC.DAMAGE), ('small', SC.SMALL), ('big', SC.BIG)):
        o.append(f"  {name}: {{")
        for k, g in d.items(): o.append(f"    {json.dumps(k) if not k.isalpha() else k}: [{', '.join(repr(r) for r in g)}],")
        o.append("  },")
    o.append("}\n")

    o.append("// ---------- 배경 160 × 64(시안 7판, 밤은 별 · 초승달) — 투명 칸이 없다 ----------")
    o.append("export const BACKDROPS: Record<'day' | 'night', { grid: Grid; palette: Palette }> = {")
    for k in ('day', 'night'):
        g, pal = BACKDROPS[k]
        o.append(f"  {k}: {{ palette: {ts_pal(pal)}, grid: {ts_grid(g, '  ')} }},")
    o.append("}")
    open(path, 'w', encoding='utf-8').write('\n'.join(o) + '\n')

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'preview': preview(sys.argv[2]); print('ok')
    elif cmd == 'ts': emit_ts(sys.argv[2]); print('written')
    elif cmd == 'check': check()
    else: print(__doc__ or 'preview <폴더> | ts <경로> | check')
