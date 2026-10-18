# 3차 시안 4판(버리는 그림): 메이플스토리 클래식 느낌 장면 — 160 × 64 점(데스크톱 2px/점 = 320 × 128px)
#   python3 maple_scene.py <출력 폴더>   → maple-sheet.png
import math, sys
sys.path.insert(0, '/Users/yuribee/Documents/spellblade/tools/art')
sys.path.insert(0, '/private/tmp/claude-501/-Users-yuribee-Documents/2eecb4e6-4b5f-4e96-bc3f-fd16448e880f/scratchpad/v3mock')
import art32
import maple_hero as mh

SW, SH = 160, 64
GROUND = 52  # 풀 윗줄
HX, HY = 12, 8  # 영웅 칸을 놓는 자리(발끝 44행이 풀 윗줄에 닿게)


def mix(a, b, t): return art32.mix(a, b, max(0.0, min(1.0, t)))


def grid(c=0): return [[c] * SW for _ in range(SH)]


def put(s, rgb, ox, oy, tint=None, k=0.0):
    for y, row in enumerate(rgb):
        for x, v in enumerate(row):
            if v is None: continue
            X, Y = ox + x, oy + y
            if 0 <= X < SW and 0 <= Y < SH: s[Y][X] = mix(v, tint, k) if tint else v


def disc(s, cx, cy, r, color):
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            if 0 <= x < SW and 0 <= y < SH and math.hypot(x - cx, y - cy) <= r: s[y][x] = color


# ---------- 배경 ----------
def tree(s, cx, top, r, night):
    trunk, bark = (0x5a3a24, 0x3e2818) if night else (0x9a6a3e, 0x6e4a2a)
    for y in range(top + r, GROUND + 1):
        for x in range(cx - 2, cx + 3): s[y][x] = bark if x == cx + 2 else trunk
    base, hi, lo, edge = (0x1f4a34, 0x2c6044, 0x163826, 0x0c2016) if night else (0x4fb048, 0x86dc62, 0x2f8a34, 0x1f5a24)
    blobs = [(cx, top + r * 0.9, r), (cx - r * 0.75, top + r * 1.35, r * 0.72), (cx + r * 0.8, top + r * 1.3, r * 0.75)]
    for (bx, by, br) in blobs: disc(s, bx, by, br + 1, edge)
    for (bx, by, br) in blobs: disc(s, bx, by, br, base)
    for (bx, by, br) in blobs:
        for y in range(int(by - br), int(by + br) + 1):
            for x in range(int(bx - br), int(bx + br) + 1):
                if not (0 <= x < SW and 0 <= y < SH): continue
                d = math.hypot(x - bx, y - by)
                if d <= br:
                    if (x - bx) + (y - by) < -br * 0.55: s[y][x] = hi
                    elif (x - bx) + (y - by) > br * 0.75: s[y][x] = lo


def background(night=False):
    s = grid()
    top, bot = (0x141a44, 0x3a3a78) if night else (0x7ccaff, 0xd6f2ff)
    for y in range(SH):
        for x in range(SW): s[y][x] = mix(top, bot, y / 40)
    if night:
        for (x, y) in ((8, 4), (22, 9), (37, 3), (51, 7), (66, 2), (83, 6), (97, 3), (112, 9), (126, 4), (141, 8), (154, 3), (30, 15), (120, 14)):
            s[y][x] = 0xf0f4ff
        disc(s, 140, 10, 5, 0xfff2c0); disc(s, 142, 9, 4, mix(top, bot, 0.2))  # 초승달
    else:
        for (cx, cy) in ((30, 9), (98, 6), (140, 12)):
            for (dx, dy, r) in ((0, 0, 5), (-5, 2, 4), (5, 2, 4), (9, 3, 3)):
                disc(s, cx + dx, cy + dy, r, 0xffffff)
            for x in range(cx - 9, cx + 13):
                if 0 <= x < SW and s[cy + 5][x] == 0xffffff: s[cy + 5][x] = 0xd8ecff
    far, near = (0x1e3a3a, 0x24483a) if night else (0xb4e696, 0x8ed06a)
    for x in range(SW):
        h1 = 32 + round(3 * math.sin(x * 0.07) + 2 * math.sin(x * 0.19 + 1))
        for y in range(h1, GROUND): s[y][x] = far
        h2 = 39 + round(2.5 * math.sin(x * 0.11 + 2) + 1.5 * math.sin(x * 0.27))
        for y in range(h2, GROUND): s[y][x] = near
    for (cx, tp, r) in ((40, 22, 9), (110, 18, 11), (152, 24, 8)):
        tree(s, cx, tp, r, night)
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
    for (x, y) in ((20, 58), (71, 60), (130, 57)):
        disc(s, x, y, 1.6, stone)
    return s


# ---------- 버섯 몬스터 (26 × 24): 주황 갓 · 크림 얼굴 · 동그란 눈 ----------
def mushroom():
    W, H = 26, 24
    g = [['.'] * W for _ in range(H)]
    for y in range(0, 13):
        for x in range(W):
            dx, dy = (x - 12.5) / 12.5, (y - 12) / 12
            if dx * dx + dy * dy <= 1.0: g[y][x] = 'Q'
    for (x, y) in ((7, 4), (8, 4), (7, 5), (8, 5), (16, 3), (17, 3), (16, 4), (17, 4), (12, 8), (13, 8), (20, 8), (21, 8), (4, 9)):
        g[y][x] = 'q'
    for y in range(12, 22):
        for x in range(5, 21):
            if (y == 21 and x in (5, 20)) or (y == 12 and x in (5, 20)): continue
            g[y][x] = 'F'
    for (ex, ey) in ((9, 14), (15, 14)):
        for y in range(ey, ey + 4):
            for x in (ex, ex + 1): g[y][x] = 'E'
        g[ey][ex] = 'w'
    for (x, y) in ((7, 18), (8, 18), (17, 18), (18, 18)): g[y][x] = 'b'
    g[19][12] = 'm'; g[19][13] = 'm'
    for (x0, x1) in ((6, 10), (15, 19)):
        for x in range(x0, x1): g[22][x] = 'f'
        for x in range(x0 + 1, x1 - 1): g[23][x] = 'f'
    keep_m, keep_d = art32.MATERIALS, art32.DETAILS
    art32.MATERIALS, art32.DETAILS = 'QFf', 'qEwbm'
    rgb = art32.shade([''.join(r) for r in g], {'Q': 0xff8a2c, 'q': 0xfff0c8, 'F': 0xfff0d4, 'f': 0xa86a3a, 'E': 0x2a1c2a, 'w': 0xffffff, 'b': 0xffb0a0, 'm': 0xc0605a})
    art32.MATERIALS, art32.DETAILS = keep_m, keep_d
    return rgb


# ---------- 슬라임 (24 × 18): 물방울 모양 초록 젤리 · 큰 눈 · 볼 · 웃는 입 ----------
def slime():
    W, H = 24, 18
    g = [['.'] * W for _ in range(H)]
    for (y, x0, x1) in ((0, 11, 12), (1, 10, 13), (2, 9, 14)):
        for x in range(x0, x1 + 1): g[y][x] = 'Q'
    for y in range(3, 18):
        for x in range(W):
            dx, dy = (x - 11.5) / 11.8, (y - 12) / 9.0
            if dy > 0.55: dy = 0.55 + (dy - 0.55) * 0.4  # 바닥은 납작하게
            if dx * dx + dy * dy <= 1.0: g[y][x] = 'Q'
    for (x, y) in ((6, 6), (7, 6), (5, 7), (6, 7), (5, 8), (9, 4), (10, 3)):
        g[y][x] = 'q'
    for (ex, ey) in ((7, 9), (14, 9)):
        for y in range(ey, ey + 4):
            for x in (ex, ex + 1, ex + 2): g[y][x] = 'E'
        g[ey][ex] = 'w'; g[ey][ex + 1] = 'w'; g[ey + 1][ex] = 'w'
        for x in (ex, ex + 1, ex + 2): g[ey + 3][x] = 'i'
    for (x, y) in ((5, 14), (6, 14), (18, 14), (19, 14)): g[y][x] = 'b'
    for (x, y) in ((11, 14), (12, 14), (10, 13), (13, 13)): g[y][x] = 'm'
    keep_m, keep_d = art32.MATERIALS, art32.DETAILS
    art32.MATERIALS, art32.DETAILS = 'Q', 'qEwibm'
    rgb = art32.shade([''.join(r) for r in g], {'Q': 0x5ed64a, 'q': 0xd8ffc8, 'E': 0x1e2a1e, 'w': 0xffffff, 'i': 0x3a6a3a, 'b': 0xff9aa0, 'm': 0x2a5a2a})
    art32.MATERIALS, art32.DETAILS = keep_m, keep_d
    return rgb


# ---------- 메이플식 데미지 숫자 ----------
DIG = {
    '1': ['..##..', '.###..', '####..', '..##..', '..##..', '..##..', '..##..', '..##..', '######'],
    '2': ['.####.', '##..##', '....##', '...##.', '..##..', '.##...', '##....', '##....', '######'],
}


def damage(s, text, ox, oy):
    cells = {}
    for i, ch in enumerate(text):
        for y, r in enumerate(DIG[ch]):
            for x, b in enumerate(r):
                if b == '#': cells[(ox + i * 7 + x + (i % 2), oy + y - (i % 2))] = y
    for (x, y) in cells:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                X, Y = x + dx, y + dy
                if (X, Y) not in cells and 0 <= X < SW and 0 <= Y < SH: s[Y][X] = 0x6a1408
    for (x, y), row in cells.items():
        s[y][x] = 0xfff27a if row < 3 else 0xffc23a if row < 6 else 0xff8a1a


def hp_bar(s, ox, oy, w, ratio):
    for x in range(w + 2):
        s[oy][ox + x] = 0x101018; s[oy + 3][ox + x] = 0x101018
    for y in (1, 2):
        s[oy + y][ox] = 0x101018; s[oy + y][ox + w + 1] = 0x101018
        for x in range(w): s[oy + y][ox + 1 + x] = (0xff5050 if y == 1 else 0xd02a2a) if x < round(w * ratio) else 0x3a1414


# 이름표 「렌」(9 × 9 글자를 어두운 상자에)
REN = ['####.#.#', '...#.#.#', '####.###', '#....#.#', '####.#.#', '........', '.#......', '.#......', '.#######']


def name_tag(s, cx, top):
    w, h = len(REN[0]) + 4, len(REN) + 2
    x0 = cx - w // 2
    for y in range(h):
        for x in range(w):
            if (y in (0, h - 1)) and x in (0, w - 1): continue
            s[top + y][x0 + x] = 0x24242c
    for y, r in enumerate(REN):
        for x, b in enumerate(r):
            if b == '#': s[top + 1 + y][x0 + 2 + x] = 0xffffff


def shadow(s, x0, x1):
    cx, r = (x0 + x1) / 2, (x1 - x0) / 2
    for y, k in ((GROUND + 1, 0.35), (GROUND + 2, 0.25)):
        for x in range(x0, x1 + 1):
            if abs(x - cx) <= r: s[y][x] = mix(s[y][x], 0x000000, k)


def smoke(s, cx, cy, r):
    disc(s, cx, cy, r + 1, 0x4a4a56)
    disc(s, cx, cy, r, 0xa8a8b4)
    disc(s, cx - r * 0.35, cy - r * 0.35, r * 0.5, 0xd8d8e0)


def slash_arc(s, cx, cy, r):
    for a in range(-70, 75, 2):
        t = math.radians(a)
        for k, col in ((0, 0xffffff), (1, 0xbfe8ff), (2, 0x7ac8ff)):
            x, y = round(cx + (r - k) * math.cos(t)), round(cy + (r - k) * math.sin(t))
            if 0 <= x < SW and 0 <= y < SH: s[y][x] = col


# ---------- 장면 ----------
def battle():
    s = background()
    shadow(s, HX + 15, HX + 33)
    put(s, mh.render(mh.pose_slash()), HX, HY)
    mx = HX + 45
    shadow(s, mx + 2, mx + 21)
    put(s, slime(), mx, GROUND - 17)
    slash_arc(s, HX + 38, HY + 38, 12)
    hp_bar(s, mx, GROUND - 23, 22, 0.55)
    damage(s, '12', mx + 5, 12)
    name_tag(s, HX + 24, GROUND + 1)
    return s


def rest():
    s = background(night=True)
    fx, fy = HX + 52, GROUND
    for y in range(SH):
        for x in range(SW):
            d = math.hypot(x - (fx + 6), (y - (fy - 6)) * 1.25)
            if d < 40: s[y][x] = mix(s[y][x], 0xff9a3a, (1 - d / 40) * 0.5)
    shadow(s, HX + 12, HX + 40)
    put(s, mh.render(mh.pose_sit()), HX, HY, 0xffb060, 0.12)
    for (x, y, c) in ((fx + 1, fy - 1, 0x6a4022), (fx + 2, fy - 2, 0x8a5a32), (fx + 10, fy - 1, 0x6a4022), (fx + 9, fy - 2, 0x8a5a32)):
        for dx in range(0, 3): s[y][x + dx] = c
    flame = ['....F.....', '...FF..F..', '...FYF.F..', '..FYYFFF..', '..FYWYYF..', '.FFYWWYYF.', '.FYWWWWYF.', '.FYWWWWYYF', '..FYWWYYF.', '...FFFFF..']
    for y, r in enumerate(flame):
        for x, ch in enumerate(r):
            if ch != '.': s[fy - 12 + y][fx + 1 + x] = {'F': 0xff6a1a, 'Y': 0xffd040, 'W': 0xfff4b8}[ch]
    for (x, y) in ((fx + 3, fy - 18), (fx + 8, fy - 21), (fx + 5, fy - 25)): s[y][x] = 0xffc060
    for (x, y) in ((HX + 37, HY + 8), (HX + 38, HY + 7), (HX + 39, HY + 7), (HX + 40, HY + 8), (HX + 41, HY + 7)): s[y][x] = 0xb8e4ff
    name_tag(s, HX + 26, GROUND + 1)
    return s


def cast_fail():
    s = background()
    shadow(s, HX + 15, HX + 33)
    g = mh.pose_cast(); mh.squint(g)
    put(s, mh.render(g), HX, HY)
    for (x, y, c) in ((HX + 38, HY + 16, 0xe8f6ff), (HX + 38, HY + 17, 0x8cc8f0), (HX + 39, HY + 17, 0x5a9ad0), (HX + 38, HY + 18, 0x5a9ad0),
                      (HX + 7, HY + 20, 0xe8f6ff), (HX + 7, HY + 21, 0x8cc8f0), (HX + 6, HY + 21, 0x5a9ad0)):
        s[y][x] = c
    tipx, tipy = HX + 42, HY + 23
    smoke(s, tipx - 1, tipy + 1, 3); smoke(s, tipx + 4, tipy - 3, 4); smoke(s, tipx + 3, tipy + 4, 2.5)
    for (x, y) in ((tipx + 9, tipy - 6), (tipx + 8, tipy + 5), (tipx - 4, tipy - 5), (tipx + 10, tipy)): s[y][x] = 0xffe060
    mx = HX + 60
    shadow(s, mx + 2, mx + 21)
    put(s, slime(), mx, GROUND - 17)
    hp_bar(s, mx, GROUND - 23, 22, 0.55)
    name_tag(s, HX + 24, GROUND + 1)
    return s


def sheet(path, scenes, scale=3, gap=12, bg=(30, 30, 36)):
    w = SW * scale + gap * 2
    h = (SH * scale + gap) * len(scenes) + gap
    px = [bg] * (w * h)
    for i, sc in enumerate(scenes):
        oy = gap + i * (SH * scale + gap)
        for y in range(SH * scale):
            row = sc[y // scale]
            for x in range(SW * scale):
                v = row[x // scale]
                px[(oy + y) * w + gap + x] = ((v >> 16) & 255, (v >> 8) & 255, v & 255)
    art32.png(path, px, w, h)


if __name__ == '__main__':
    out = sys.argv[1]
    sheet(f'{out}/maple-sheet.png', [battle(), rest(), cast_fail()])
    print('ok')
