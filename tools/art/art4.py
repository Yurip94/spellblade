"""4차 장면 재료(80 × 32): 맵 5개 × 낮 · 밤 배경, 작은 효과 12종, 3 × 5 글꼴 — 모두 이 프로젝트를 위해 새로 그린 그림.

  python3 tools/art/art4.py ts plugins/spellblade/hooks/lib/art4.ts
  python3 tools/art/art4.py preview <폴더>      # art4-preview.png(4배)

땅 윗줄은 26행(주인공 · 몬스터 발이 닿는 줄), 27 ~ 31행은 땅. 배경은 멈춰 있다.
색은 Elthen 그림(채도 높은 16비트풍)에 맞춰 띠 몇 개로만 칠한다.
"""
import json
import math
import os
import random
import struct
import sys
import zlib

W, H, GROUND = 80, 32, 26
ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    m = lambda s: math.floor(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t + 0.5)
    return (m(16) << 16) | (m(8) << 8) | m(0)


def canvas(c): return [[c] * W for _ in range(H)]


def bands(g, top, bottom, c0, c1, n=5):
    for y in range(top, bottom):
        k = math.floor((y - top) / max(1, bottom - top) * n) / max(1, n - 1)
        for x in range(W): g[y][x] = mix(c0, c1, k)


def put(g, x, y, c):
    if 0 <= x < W and 0 <= y < H: g[y][x] = c


def disc(g, cx, cy, r, c):
    for y in range(math.floor(cy - r), math.ceil(cy + r) + 1):
        for x in range(math.floor(cx - r), math.ceil(cx + r) + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r: put(g, x, y, c)


def ridge(g, base, amp, period, phase, c, top_limit=0):
    for x in range(W):
        h = base - amp * (0.5 + 0.5 * math.sin((x + phase) * 2 * math.pi / period))
        for y in range(max(top_limit, round(h)), GROUND): g[y][x] = c


def ground(g, top, mid, dirt, speck, seed):
    rnd = random.Random(seed)
    for x in range(W):
        g[GROUND][x] = top
        g[GROUND + 1][x] = mid
        for y in range(GROUND + 2, H): g[y][x] = dirt
    for _ in range(18): put(g, rnd.randrange(W), rnd.randrange(GROUND + 2, H), speck)


def cloud(g, x, y, c, shade):
    for dx, dy, r in ((0, 0, 2.2), (3, -1, 2.6), (6, 0, 2.0)):
        disc(g, x + dx, y + dy, r, c)
    for dx in range(-1, 8): put(g, x + dx, y + 2, shade)


def tree(g, cx, top, r, leaf, light, trunk):
    for y in range(top + r, GROUND):
        put(g, cx, y, trunk); put(g, cx + 1, y, trunk)
    disc(g, cx + 0.5, top + r * 0.8, r, leaf)
    disc(g, cx - r * 0.3, top + r * 0.5, r * 0.45, light)


# ---------- 맵 5개(낮). sky 는 별을 찍을 수 있는 칸 ----------
def forest():
    g = canvas(0)
    bands(g, 0, GROUND, 0x6cbcf0, 0xc4ecff, 6)
    sky = {(x, y) for y in range(GROUND) for x in range(W)}
    cloud(g, 8, 5, 0xffffff, 0xd8eefa); cloud(g, 46, 3, 0xffffff, 0xd8eefa)
    ridge(g, 19, 5, 70, 10, 0x9ad89a)
    ridge(g, 22, 3, 40, 3, 0x6cc070)
    tree(g, 60, 9, 6, 0x3a9a48, 0x5cc060, 0x7a4a2a)
    tree(g, 73, 12, 5, 0x34903f, 0x52b85a, 0x6a4024)
    ground(g, 0x8ee060, 0x4caf50, 0x8a5a32, 0x6a4022, 1)
    return g, {p for p in sky if g[p[1]][p[0]] in (mix(0x6cbcf0, 0xc4ecff, k / 5) for k in range(6))}


def swamp():
    g = canvas(0)
    bands(g, 0, GROUND, 0x8a9a80, 0xc8ceb0, 5)
    base = {mix(0x8a9a80, 0xc8ceb0, k / 4) for k in range(5)}
    ridge(g, 20, 4, 55, 20, 0x6a7a5a)
    for cx in (14, 38, 66):   # 죽은 나무
        for y in range(8, GROUND): put(g, cx, y, 0x3a3a2a)
        for i in range(5): put(g, cx - 1 - i, 12 + i // 2 - i, 0x3a3a2a); put(g, cx + 1 + i, 15 - i, 0x3a3a2a)
    for y in range(20, 25):   # 보라 안개 띠
        for x in range(W):
            if (x + y * 3) % 7 < 4: g[y][x] = mix(g[y][x], 0xb8a0c8, 0.45)
    ground(g, 0x6a8a5a, 0x4a6a4a, 0x4a3a28, 0x6a8a5a, 2)
    for x in range(2, W, 9): put(g, x, GROUND - 1, 0x5a7a3a); put(g, x, GROUND - 2, 0x5a7a3a)   # 갈대
    return g, {(x, y) for y in range(GROUND) for x in range(W) if g[y][x] in base}


def cave():
    g = canvas(0x4a4038)
    rnd = random.Random(3)
    for y in range(0, GROUND, 4):   # 바위 벽돌
        off = (y // 4) % 2 * 5
        for x in range(W):
            if (x + off) % 10 == 0: g[y][x] = 0x3a3028
        for x in range(W): g[y][x] = 0x3a3028 if g[y][x] == 0x3a3028 or y % 4 == 0 else g[y][x]
    for y in range(GROUND):
        for x in range(W):
            if g[y][x] == 0x4a4038 and (x * 7 + y * 13) % 11 == 0: g[y][x] = 0x5a5048
    for cx in (6, 19, 33, 47, 61, 74):   # 종유석
        L = rnd.randrange(4, 8)
        for i in range(L):
            for x in range(cx - (L - i) // 3, cx + (L - i) // 3 + 1): put(g, x, i, 0x2a221c)
    for cx, cy in ((24, 18), (55, 15), (70, 20)):   # 보라 수정
        for i in range(3): put(g, cx, cy - i, 0xb080f0); put(g, cx + 1, cy - i + 1, 0x8a5ad0)
    ground(g, 0x7a7068, 0x5a5048, 0x3a3028, 0x6a6058, 4)
    return g, set()


def canyon():
    g = canvas(0)
    for y in range(GROUND):   # 왼쪽 용암 하늘 · 오른쪽 얼음 하늘
        k = math.floor(y / GROUND * 5) / 4
        for x in range(W):
            hot, cold = mix(0xc84a2a, 0xf0a050, k), mix(0x8ac8f0, 0xdcf2ff, k)
            t = min(1, max(0, (x - 30) / 20))
            g[y][x] = mix(hot, cold, math.floor(t * 4) / 4)
    for x in range(0, 36):   # 왼쪽 붉은 바위 · 용암 줄
        h = 12 + 4 * math.sin(x * 0.5)
        for y in range(round(h), GROUND): g[y][x] = 0x6a2a1a
        if x % 6 == 2:
            for y in range(round(h) + 2, GROUND, 2): g[y][x] = 0xff8030
    for x in range(44, W):    # 오른쪽 얼음 기둥
        h = 14 + 5 * math.sin(x * 0.45 + 1)
        for y in range(round(h), GROUND): g[y][x] = 0xb8e4f8 if (x % 5) else 0x6aa8d0
    for x in range(W):
        left = x < 40
        g[GROUND][x] = 0xff6a20 if left and x % 7 == 3 else (0x4a2218 if left else 0xf0faff)
        g[GROUND + 1][x] = 0x3a1a14 if left else 0xc8e8f8
        for y in range(GROUND + 2, H): g[y][x] = (0x2a120e if (x + y) % 9 else 0xc04a18) if left else (0x9ac8e0 if (x + y) % 7 else 0xe8f6ff)
    return g, {(x, y) for y in range(10) for x in range(W)}


def castle():
    g = canvas(0)
    bands(g, 0, GROUND, 0x4a1420, 0x9a3a2a, 5)
    sky = {(x, y) for y in range(GROUND) for x in range(W)}
    for x in range(W):   # 성벽 · 총안
        top = 9 if (x // 4) % 2 == 0 else 11
        for y in range(top, GROUND): g[y][x] = 0x3a3040 if (x + y) % 8 else 0x2a2232
    for wx in (10, 30, 50, 70):   # 불 켜진 창문 · 깃발
        for y in range(15, 19): put(g, wx, y, 0xffc040); put(g, wx + 1, y, 0xffa020)
        for y in range(12, 21): put(g, wx + 6, y, 0xa02020)
    ground(g, 0x8a8094, 0x6a6074, 0x4a4054, 0x5a5064, 5)
    for x in range(0, W, 8): put(g, x, GROUND + 1, 0x4a4054)
    return g, {p for p in sky if g[p[1]][p[0]] in {mix(0x4a1420, 0x9a3a2a, k / 4) for k in range(5)}}


MAPS = {'forest': forest, 'swamp': swamp, 'cave': cave, 'canyon': canyon, 'castle': castle}
BRIGHT = {0xffc040, 0xffa020, 0xff8030, 0xff6a20, 0xc04a18, 0xb080f0, 0x8a5ad0}   # 밤에도 빛나는 칸


def night(g, sky, seed):
    n = [[(mix(v, 0x0a0e22, 0.25) if v in BRIGHT else mix(v, 0x0a0e22, 0.6)) for v in r] for r in g]
    # 별은 찍지 않는다 — 작은 흰 점이 화면에서 깨진 도트처럼 보였다(박정욱 2026-10-22). 초승달만
    cells = sorted(sky)
    if cells:
        for dx, dy in ((0, 0), (1, 0), (2, 1), (2, 2), (1, 3), (0, 3)):   # 초승달
            if (66 + dx, 3 + dy) in sky: n[3 + dy][66 + dx] = 0xfff4c0
    return n


def letters(g):
    pal, rows = {}, []
    for r in g:
        line = ''
        for v in r:
            if v is None: line += '.'; continue
            if v not in pal:
                assert len(pal) < len(ALPHABET), '색이 너무 많다'
                pal[v] = ALPHABET[len(pal)]
            line += pal[v]
        rows.append(line)
    return rows, {c: v for v, c in pal.items()}


# ---------- 작은 효과(글자 그림) ----------
FX = {
    'bolt': (['...LLB..', '.LWWWLB.', 'WWWWWWLB', '.LWWWLB.', '...LLB..'], {'W': 0xffffff, 'L': 0xb8e4ff, 'B': 0x5aa8ff}),
    'glow1': (['..W..', '.LWL.', 'WWWWW', '.LWL.', '..W..'], {'W': 0xffffff, 'L': 0x9ad0ff}),
    'glow2': (['...W...', '..LWL..', '.LBWBL.', 'WWWWWWW', '.LBWBL.', '..LWL..', '...W...'], {'W': 0xffffff, 'L': 0xb8e4ff, 'B': 0x5aa8ff}),
    'smoke': (['..KKK..', '.KGGGK.', 'KGHGGGK', 'KGGGHGK', '.KGGGK.', '..KKK..'], {'K': 0x4a4a56, 'G': 0xa8a8b4, 'H': 0xd8d8e0}),
    'sweat': (['L.', 'LB'], {'L': 0x9ad0ff, 'B': 0x5a9ad0}),
    'poof1': (['..KKK....', '.KGGGKKK.', 'KGWWGGGGK', 'KGWGGGWGK', '.KGGGGGK.', '..KKKKK..', 'Y.......Y'], {'K': 0x8a8aa0, 'G': 0xdcdce8, 'W': 0xffffff, 'Y': 0xfff2a0}),
    'poof2': (['Y....K....Y', '...KGK.K...', '.K.KGK.GK..', 'KGK..KGWGK.', '.K..KGGGK..', '...K.KGK...', '.KGK..K..K.', '..K.....KGK', 'Y.........Y'], {'K': 0x8a8aa0, 'G': 0xdcdce8, 'W': 0xffffff, 'Y': 0xfff2a0}),
    'fire1': (['...S...', '...F...', '..FYF..', '.FYWYF.', '.FYWYF.', 'FYWWWYF', '.FYWYF.', 'LLLLLLL', '.L...L.'], {'F': 0xff6a1a, 'Y': 0xffd040, 'W': 0xfff4b8, 'L': 0x6a4022, 'S': 0xffc060}),
    'fire2': (['.S.....', '..F..F.', '..FYF..', '.FYWWF.', 'FYWWYF.', '.FYWWYF', '.FYWYF.', 'LLLLLLL', '.L...L.'], {'F': 0xff6a1a, 'Y': 0xffd040, 'W': 0xfff4b8, 'L': 0x6a4022, 'S': 0xffc060}),
    'zzz': (['ZZZ..', '..Z..', '.Z...', 'ZZZ.z', '...zz'], {'Z': 0xd8f0ff, 'z': 0xb8e4ff}),
}


def pillar(frame):
    w, h = 8, 26
    rows = []
    for y in range(h):
        line = ''
        for x in range(w):
            d = abs(x - 3.5)
            if d <= 1: line += 'W'
            elif d <= 2.5: line += 'Y'
            elif (x + y + frame) % 2 == 0: line += 'O'
            else: line += '.'
        rows.append(line)
    return rows, {'W': 0xfffbe8, 'Y': 0xfff0a0, 'O': 0xffd050}


FX['pillar1'] = pillar(1)
FX['pillar2'] = pillar(2)

GLYPHS = {
    '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['###', '..#', '###', '#..', '###'],
    '3': ['###', '..#', '###', '..#', '###'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '###', '..#', '###'],
    '6': ['###', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###'],
    '9': ['###', '#.#', '###', '..#', '###'], '+': ['...', '.#.', '###', '.#.', '...'], 'X': ['#.#', '#.#', '.#.', '#.#', '#.#'],
    'P': ['##.', '#.#', '##.', '#..', '#..'], 'L': ['#..', '#..', '#..', '#..', '###'], 'E': ['###', '#..', '##.', '#..', '###'],
    'V': ['#.#', '#.#', '#.#', '#.#', '.#.'], 'U': ['#.#', '#.#', '#.#', '#.#', '###'],
}


def backdrops():
    out = {}
    for i, (k, fn) in enumerate(MAPS.items()):
        g, sky = fn()
        out[k] = {'day': letters(g), 'night': letters(night(g, sky, 10 + i))}
    return out


def ts_grid(g, ind='    '): return '[\n' + ''.join(f"{ind}  '{r}',\n" for r in g) + f'{ind}]'
def ts_pal(p): return '{ ' + ', '.join(f"{k}: 0x{v:06x}" for k, v in p.items()) + ' }'


def emit(path):
    o = ['// 4차 장면 재료(80 × 32) — 만든 곳: tools/art/art4.py (`python3 tools/art/art4.py ts <이 파일>`). 손으로 고치지 말고 스크립트를 고친다.',
         '// 모두 이 프로젝트를 위해 새로 그린 그림이다. 땅 윗줄은 26행.',
         "import type { Grid, Palette } from './sprites.ts'",
         "import type { MapId } from './roster.ts'", '']
    o.append('export const BACKDROPS4: Record<MapId, { day: { grid: Grid; palette: Palette }; night: { grid: Grid; palette: Palette } }> = {')
    for k, v in backdrops().items():
        o.append(f'  {k}: {{')
        for t in ('day', 'night'):
            rows, pal = v[t]
            o.append(f'    {t}: {{ palette: {ts_pal(pal)}, grid: {ts_grid(rows)} }},')
        o.append('  },')
    o.append('}\n')
    ids = list(FX)
    o.append('export type Fx4Id = ' + ' | '.join(f"'{k}'" for k in ids))
    o.append('export const FX4: Record<Fx4Id, { grid: Grid; palette: Palette }> = {')
    for k in ids:
        rows, pal = FX[k]
        o.append(f'  {k}: {{ palette: {ts_pal(pal)}, grid: [{", ".join(repr(r) for r in rows)}] }},')
    o.append('}\n')
    o.append("// 3 × 5 글꼴('#' 칸만, 색은 장면이 칠한다)")
    o.append('export const GLYPHS4: Record<string, Grid> = {')
    for k, g in GLYPHS.items(): o.append(f"  {json.dumps(k)}: [{', '.join(repr(r) for r in g)}],")
    o.append('}')
    open(path, 'w', encoding='utf-8').write('\n'.join(o) + '\n')
    print('written', path)


def preview(folder, k=4):
    bd = backdrops()
    tiles = [(rows, pal) for v in bd.values() for rows, pal in (v['day'], v['night'])]
    gap = 8
    Wp, Hp = 2 * W * k + 3 * gap, len(bd) * (H * k + gap) + gap + 30 * k
    px = [(30, 30, 36)] * (Wp * Hp)
    def stamp(rows, pal, ox, oy, s):
        for y, r in enumerate(rows):
            for x, ch in enumerate(r):
                if ch == '.': continue
                v = pal[ch]
                for dy in range(s):
                    for dx in range(s): px[(oy + y * s + dy) * Wp + ox + x * s + dx] = ((v >> 16) & 255, (v >> 8) & 255, v & 255)
    for i, (rows, pal) in enumerate(tiles):
        stamp(rows, pal, gap + (i % 2) * (W * k + gap), gap + (i // 2) * (H * k + gap), k)
    x = gap
    y = gap + len(bd) * (H * k + gap)
    for key in FX:
        rows, pal = FX[key]
        stamp(rows, pal, x, y, k)
        x += (len(rows[0]) + 2) * k
    raw = b''.join(b'\x00' + bytes(v for p in px[yy * Wp:(yy + 1) * Wp] for v in p) for yy in range(Hp))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    path = os.path.join(folder, 'art4-preview.png')
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', Wp, Hp, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))
    print('preview', path)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'ts': emit(sys.argv[2])
    elif cmd == 'preview': preview(sys.argv[2])
    else: print(__doc__)
