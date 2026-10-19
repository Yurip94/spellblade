# 3차 장면 재료 원본(art3.py 가 가져다 쓴다): 효과 13종 · 금화 · 글꼴 · 배경(낮 · 밤 160 × 64)
# 효과 · 배경은 음영 없이 글자마다 색이 정해진 그림이다. 글꼴은 '#' 칸만 있는 모양이고 색은 장면이 칠한다.
# 효과의 맨 아래 줄은 땅에 놓는 효과(모닥불)라면 땅 줄에 닿는다.
# 모두 이 프로젝트를 위해 새로 그린 그림이다(메이플스토리 그림을 가져오지 않는다).
import math

SW, SH = 160, 64
GROUND = 52          # 풀 윗줄 = 마검사 · 몬스터 발끝 줄


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    m = lambda s: round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t)
    return (m(16) << 16) | (m(8) << 8) | m(0)


def blank(w, h): return [['.'] * w for _ in range(h)]
def rows(c): return [''.join(r) for r in c]


def put(c, x, y, ch):
    x, y = round(x), round(y)
    if 0 <= y < len(c) and 0 <= x < len(c[0]): c[y][x] = ch


def disc(c, cx, cy, r, ch):
    for y in range(math.floor(cy - r) - 1, math.ceil(cy + r) + 2):
        for x in range(math.floor(cx - r) - 1, math.ceil(cx + r) + 2):
            if math.hypot(x - cx, y - cy) <= r: put(c, x, y, ch)


def from_art(art):
    # 손으로 그린 줄 그림 → 격자
    return [list(r) for r in art]


# ---------- 효과 ----------
def slash_arc():
    # 칼 궤적 초승달: 가운데가 두껍고 끝이 가늘다. 원의 중심이 (0, 13) 이다
    r = 12
    c = blank(13, 27)
    for a in range(-80, 81):
        t = math.radians(a)
        thick = max(1, round(1 + 3.2 * math.cos(t) ** 2))
        for k in range(thick):
            put(c, (r - k) * math.cos(t), 13 + (r - k) * math.sin(t), 'WLBD'[min(k, 3)])
    return rows(c), {'W': 0xffffff, 'L': 0xbfe8ff, 'B': 0x7ac8ff, 'D': 0x4a96e0}


def star(c, cx, cy, arm, diag, core):
    for i in range(-arm, arm + 1):
        k = 'W' if abs(i) <= 1 else 'L' if abs(i) <= arm // 2 + 1 else 'B'
        put(c, cx + i, cy, k); put(c, cx, cy + i, k)
    for i in range(-diag, diag + 1):
        k = 'L' if abs(i) <= 1 else 'B'
        put(c, cx + i, cy + i, k); put(c, cx + i, cy - i, k)
    disc(c, cx, cy, core, 'W')


def cast_glow(frame):
    # 영창 빛(칼끝): 1 은 작은 십자 별, 2 는 더 크게 퍼진 별
    c = blank(13, 13)
    if frame == 1:
        disc(c, 6, 6, 3.2, 'B'); disc(c, 6, 6, 2.2, 'L'); star(c, 6, 6, 5, 2, 1.0)
    else:
        disc(c, 6, 6, 4.2, 'B'); disc(c, 6, 6, 3.0, 'L'); star(c, 6, 6, 6, 4, 1.6)
    return rows(c), {'W': 0xffffff, 'L': 0xb8e4ff, 'B': 0x5aa8ff}


def bolt():
    # 마법 탄: 오른쪽(몬스터 쪽)이 머리, 왼쪽으로 꼬리가 옅어진다
    c = blank(20, 9)
    for x in range(0, 15):
        hh = 2.6 * x / 14
        for y in range(9):
            d = abs(y - 4)
            if d <= hh:
                if x < 5 and (x + y) % 2: continue
                put(c, x, y, 'W' if d <= hh * 0.3 and x > 6 else 'L' if d <= hh * 0.65 else 'B')
    disc(c, 15, 4, 4.2, 'B'); disc(c, 15, 4, 3.0, 'L'); disc(c, 15.5, 4, 1.6, 'W')
    return rows(c), {'W': 0xffffff, 'L': 0xb8e4ff, 'B': 0x5aa8ff}


def smoke():
    # 캐스팅 실패 연기: 회색 뭉게 세 덩이
    c = blank(16, 13)
    puffs = ((4.5, 7.5, 3.4), (9.5, 4.5, 3.9), (11, 9, 2.8))
    for (x, y, r) in puffs: disc(c, x, y, r + 1, 'K')
    for (x, y, r) in puffs: disc(c, x, y, r, 'G')
    for (x, y, r) in puffs: disc(c, x - r * 0.35, y - r * 0.35, r * 0.45, 'H')
    return rows(c), {'K': 0x4a4a56, 'G': 0xa8a8b4, 'H': 0xd8d8e0}


def sweat():
    art = ['.W..', '.WL.', 'WLLB', 'LLBB', '.BB.']
    return art, {'W': 0xe8f6ff, 'L': 0x8cc8f0, 'B': 0x5a9ad0}


def poof(frame):
    # 몬스터가 쓰러질 때: 1 은 뭉친 흰 구름, 2 는 퍼지며 옅어지고 별이 튄다
    if frame == 1:
        c = blank(22, 16)
        puffs = ((7, 9, 4.2), (13, 7, 4.8), (16, 11, 3.6), (10, 12, 3.4))
        for (x, y, r) in puffs: disc(c, x, y, r + 1, 'K')
        for (x, y, r) in puffs: disc(c, x, y, r, 'G')
        for (x, y, r) in puffs: disc(c, x - r * 0.3, y - r * 0.35, r * 0.55, 'W')
        for (x, y) in ((2, 3), (20, 2), (19, 14)): put(c, x, y, 'Y')
    else:
        c = blank(28, 20)
        puffs = ((5, 12, 2.6), (11, 6, 3.0), (19, 5, 2.8), (23, 12, 2.4), (14, 14, 2.6))
        for (x, y, r) in puffs: disc(c, x, y, r + 1, 'K')
        for (x, y, r) in puffs: disc(c, x, y, r, 'G')
        for (x, y, r) in puffs: disc(c, x - r * 0.3, y - r * 0.3, r * 0.5, 'W')
        for (x, y) in ((1, 4), (14, 1), (26, 3), (27, 17), (2, 18), (14, 19)):
            put(c, x, y, 'Y'); put(c, x - 1, y, 'y'); put(c, x + 1, y, 'y'); put(c, x, y - 1, 'y'); put(c, x, y + 1, 'y')
    return rows(c), {'K': 0x8a8aa0, 'G': 0xdcdce8, 'W': 0xffffff, 'Y': 0xfff2a0, 'y': 0xffd040}


def pillar(frame):
    # 레벨업 빛기둥(마검사 뒤에 그린다): 가운데 흰 빛, 가장자리는 바둑판으로 비치고 별가루가 오른다
    w, h = 24, 60
    c = blank(w, h)
    core = 3 if frame == 1 else 4
    for y in range(h):
        for x in range(w):
            d = abs(x - (w - 1) / 2)
            if d <= core: put(c, x, y, 'W')
            elif d <= core + 3: put(c, x, y, 'Y')
            elif d <= core + 6 and (x + y + frame) % 2 == 0: put(c, x, y, 'O')
    spark = ((2, 50), (21, 44), (4, 30), (19, 22), (1, 12), (22, 6)) if frame == 1 else ((3, 40), (20, 52), (1, 20), (22, 28), (4, 4), (19, 12))
    for (x, y) in spark:
        put(c, x, y, 'W'); put(c, x - 1, y, 'Y'); put(c, x + 1, y, 'Y'); put(c, x, y - 1, 'Y'); put(c, x, y + 1, 'Y')
    return rows(c), {'W': 0xfffbe8, 'Y': 0xfff0a0, 'O': 0xffd050}


def zzz():
    art = ['....ZZZZZ', '.......Z.', '......Z..', '.....Z...', '....ZZZZZ', '.........', 'zzzz.....', '..z......', '.z.......', 'zzzz.....']
    return art, {'Z': 0xd8f0ff, 'z': 0xb8e4ff}


FLAME = {
    1: ['....F.....', '...FF..F..', '...FYF.F..', '..FYYFFF..', '..FYWYYF..', '.FFYWWYYF.', '.FYWWWWYF.', '.FYWWWWYYF', '..FYWWYYF.', '...FFFFF..'],
    2: ['.....F....', '..F..FF...', '..F.FYF...', '..FFFYYF..', '..FYYWYF..', '.FYYWWYFF.', '.FYWWWWYF.', 'FYYWWWWYF.', '.FYYWWYF..', '..FFFFF...'],
}


def fire(frame):
    # 모닥불: 맨 아래 두 줄이 장작, 위로 불꽃 · 불티. 맨 아래 줄이 땅 줄에 닿는다
    c = blank(13, 25)
    for (x, y, k) in ((1, 24, 'l'), (2, 23, 'L'), (10, 24, 'l'), (9, 23, 'L')):
        for dx in range(3): put(c, x + dx, y, k)
    for y, r in enumerate(FLAME[frame]):
        for x, ch in enumerate(r):
            if ch != '.': put(c, 1 + x, 12 + y, ch)
    sparks = ((3, 6), (8, 3), (5, 0)) if frame == 1 else ((4, 4), (9, 7), (6, 1))
    for (x, y) in sparks: put(c, x, y, 'S')
    return rows(c), {'F': 0xff6a1a, 'Y': 0xffd040, 'W': 0xfff4b8, 'L': 0x8a5a32, 'l': 0x6a4022, 'S': 0xffc060}


def coin():
    # 밴드 · 기록 탭의 골드 옆 금화(9 × 9, 장면과 같은 2px 점 → 18 × 18): 왼쪽 위가 밝은 테, 가운데 세로 홈
    art = ['..KKKKK..', '.KLLLLLK.', 'KLYYYYYDK', 'KLYWSYYDK', 'KLYWSYYDK', 'KLYWSYYDK', 'KLYYYYYDK', '.KDDDDDK.', '..KKKKK..']
    return art, {'K': 0x5a3606, 'L': 0xffe680, 'Y': 0xffc526, 'D': 0xc87a10, 'S': 0xd88a12, 'W': 0xfff8d0}


def make_fx():
    return {
        'slashArc': slash_arc(), 'castGlow1': cast_glow(1), 'castGlow2': cast_glow(2), 'bolt': bolt(),
        'smoke': smoke(), 'sweat': sweat(), 'poof1': poof(1), 'poof2': poof(2),
        'pillar1': pillar(1), 'pillar2': pillar(2), 'zzz': zzz(), 'fire1': fire(1), 'fire2': fire(2),
        'coin': coin(),
    }


# ---------- 글꼴 ----------
DAMAGE = {   # 6 × 9 굵은 데미지 숫자
    '0': ['.####.', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
    '1': ['..##..', '.###..', '####..', '..##..', '..##..', '..##..', '..##..', '..##..', '######'],
    '2': ['.####.', '##..##', '....##', '...##.', '..##..', '.##...', '##....', '##....', '######'],
    '3': ['.####.', '##..##', '....##', '....##', '..###.', '....##', '....##', '##..##', '.####.'],
    '4': ['...##.', '..###.', '.####.', '##.##.', '##.##.', '######', '...##.', '...##.', '...##.'],
    '5': ['######', '##....', '##....', '#####.', '....##', '....##', '....##', '##..##', '.####.'],
    '6': ['.####.', '##..##', '##....', '#####.', '##..##', '##..##', '##..##', '##..##', '.####.'],
    '7': ['######', '....##', '....##', '...##.', '...##.', '..##..', '..##..', '..##..', '..##..'],
    '8': ['.####.', '##..##', '##..##', '##..##', '.####.', '##..##', '##..##', '##..##', '.####.'],
    '9': ['.####.', '##..##', '##..##', '##..##', '.#####', '....##', '....##', '##..##', '.####.'],
}
SMALL = {    # 5 × 7 작은 글꼴(「+N XP」)
    '0': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    '3': ['.###.', '#...#', '....#', '..##.', '....#', '#...#', '.###.'],
    '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
    '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
    '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
    'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
}
BIG = {      # 7 × 9 큰 글자(「LEVEL UP」)
    'L': ['##.....', '##.....', '##.....', '##.....', '##.....', '##.....', '##.....', '#######', '#######'],
    'E': ['#######', '#######', '##.....', '##.....', '######.', '##.....', '##.....', '#######', '#######'],
    'V': ['##...##', '##...##', '##...##', '##...##', '##...##', '.##.##.', '.##.##.', '..###..', '...#...'],
    'U': ['##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '#######', '.#####.'],
    'P': ['######.', '##...##', '##...##', '##...##', '######.', '##.....', '##.....', '##.....', '##.....'],
}


# ---------- 배경(시안 7판, 하늘은 2줄마다 한 색) ----------
def tree(s, cx, top, r, night):
    trunk, bark = (0x5a3a24, 0x3e2818) if night else (0x9a6a3e, 0x6e4a2a)
    for y in range(top + r, GROUND + 1):
        for x in range(cx - 2, cx + 3): s[y][x] = bark if x == cx + 2 else trunk
    base, hi, lo, edge = (0x1f4a34, 0x2c6044, 0x163826, 0x0c2016) if night else (0x4fb048, 0x86dc62, 0x2f8a34, 0x1f5a24)
    blobs = [(cx, top + r * 0.9, r), (cx - r * 0.75, top + r * 1.35, r * 0.72), (cx + r * 0.8, top + r * 1.3, r * 0.75)]
    fill = lambda bx, by, br, col: [s[y].__setitem__(x, col) for y in range(SH) for x in range(SW) if math.hypot(x - bx, y - by) <= br]
    for (bx, by, br) in blobs: fill(bx, by, br + 1, edge)
    for (bx, by, br) in blobs: fill(bx, by, br, base)
    for (bx, by, br) in blobs:
        for y in range(int(by - br), int(by + br) + 1):
            for x in range(int(bx - br), int(bx + br) + 1):
                if not (0 <= x < SW and 0 <= y < SH): continue
                if math.hypot(x - bx, y - by) <= br:
                    if (x - bx) + (y - by) < -br * 0.55: s[y][x] = hi
                    elif (x - bx) + (y - by) > br * 0.75: s[y][x] = lo


def background_rgb(night=False):
    top, bot = (0x141a44, 0x3a3a78) if night else (0x7ccaff, 0xd6f2ff)
    sky = lambda y: mix(top, bot, (y - y % 2) / 40)
    s = [[sky(y)] * SW for y in range(SH)]
    fill = lambda cx, cy, r, col: [s[y].__setitem__(x, col if col is not None else sky(y)) for y in range(SH) for x in range(SW) if math.hypot(x - cx, y - cy) <= r]
    if night:
        for (x, y) in ((8, 4), (22, 9), (37, 3), (51, 7), (66, 2), (83, 6), (97, 3), (112, 9), (126, 4), (141, 8), (154, 3), (30, 15), (120, 14)):
            s[y][x] = 0xf0f4ff
        fill(140, 10, 5, 0xfff2c0); fill(142, 9, 4, None)      # 초승달
    else:
        for (cx, cy) in ((30, 9), (98, 6), (140, 12)):
            for (dx, dy, r) in ((0, 0, 5), (-5, 2, 4), (5, 2, 4), (9, 3, 3)): fill(cx + dx, cy + dy, r, 0xffffff)
            for x in range(cx - 9, cx + 13):
                if 0 <= x < SW and s[cy + 5][x] == 0xffffff: s[cy + 5][x] = 0xd8ecff
    far, near = (0x1e3a3a, 0x24483a) if night else (0xb4e696, 0x8ed06a)
    for x in range(SW):
        h1 = 32 + round(3 * math.sin(x * 0.07) + 2 * math.sin(x * 0.19 + 1))
        for y in range(h1, GROUND): s[y][x] = far
        h2 = 39 + round(2.5 * math.sin(x * 0.11 + 2) + 1.5 * math.sin(x * 0.27))
        for y in range(h2, GROUND): s[y][x] = near
    for (cx, tp, r) in ((40, 22, 9), (110, 18, 11), (152, 24, 8)): tree(s, cx, tp, r, night)
    grass, grass_hi, grass_lo = (0x2c6a2a, 0x3c843a, 0x1c4a1c) if night else (0x5ccc34, 0x8ef060, 0x349a22)
    dirt, brick, stone = (0x5a3e26, 0x3e2a1a, 0x4a4450) if night else (0xc08448, 0x8e5a30, 0x9a96a6)
    for x in range(SW):
        tuft = 1 if (x * 7) % 5 == 0 else 0
        for y in range(GROUND - tuft, GROUND + 3): s[y][x] = grass
        s[GROUND - tuft][x] = grass_hi
        s[GROUND + 3][x] = grass_lo
        for y in range(GROUND + 4, SH):
            row = (y - GROUND - 4) // 4
            joint = (x + (row % 2) * 6) % 12 == 0
            s[y][x] = brick if ((y - GROUND - 4) % 4 == 3 or joint) else dirt
    for (x, y) in ((20, 58), (71, 60), (130, 57)): fill(x, y, 1.6, stone)
    return s


# 색 하나에 글자 하나(투명 '.' · 따옴표 · 역슬래시는 쓰지 않는다)
KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&*+-/:;<=>?@^_|~()[]{}'


def to_letters(s):
    pal, key = {}, {}
    out = []
    for r in s:
        line = []
        for v in r:
            if v not in key:
                if len(key) >= len(KEYS): raise SystemExit('배경 색이 너무 많다')
                key[v] = KEYS[len(key)]
                pal[key[v]] = v
            line.append(key[v])
        out.append(''.join(line))
    return out, pal


def make_backdrops():
    return {'day': to_letters(background_rgb(False)), 'night': to_letters(background_rgb(True))}
