# 그림 2판 시안: 자동 음영(밝은 · 기본 · 어두운 톤) + 자동 테두리, 그리고 32×32 새 그림
import sys
sys.path.insert(0, '.')
import art as v1

def hexrgb(v): return ((v >> 16) & 255, (v >> 8) & 255, v & 255)
def rgbhex(r, g, b): return (max(0, min(255, int(r))) << 16) | (max(0, min(255, int(g))) << 8) | max(0, min(255, int(b)))
def mix(c, t, k):  # c 를 t 쪽으로 k 만큼
    a, b = hexrgb(c), hexrgb(t)
    return rgbhex(*(a[i] + (b[i] - a[i]) * k for i in range(3)))

def tones(base):
    # 밝은 톤은 따뜻한 빛 쪽, 어두운 톤은 차가운 그림자 쪽(색이 칙칙해지지 않게)
    return {
        'hi': mix(base, 0xfff4d8, 0.35),
        'base': base,
        'lo': mix(base, 0x1c1830, 0.38),
        'out': mix(base, 0x0c0a14, 0.72),
    }

DETAILS = set('EwmKRJ')

def shade(grid, palette, materials, outline=True):
    """materials: 음영을 넣을 글자들. 결과는 (grid, palette) — 새 글자는 내부적으로 만든다."""
    H, W = len(grid), len(grid[0])
    at = lambda x, y: grid[y][x] if 0 <= x < W and 0 <= y < H else '.'
    out_rows = [[c for c in r] for r in grid]
    newpal = dict(palette)
    keys = {}
    pool = iter('abcdefgijmnopqtuvxyz0123456789!@#$%^&*+=?<>~ABDEFHIJKNOPQSTUVX')
    def key_for(m, t):
        if (m, t) not in keys:
            k = next(pool)
            while k in palette or k in newpal: k = next(pool)
            keys[(m, t)] = k
            newpal[k] = tones(palette[m])[t]
        return keys[(m, t)]
    for y in range(H):
        for x in range(W):
            m = grid[y][x]
            if m in materials:
                same = lambda n: n == m or n in DETAILS
                up, left, down, right = at(x, y - 1), at(x - 1, y), at(x, y + 1), at(x + 1, y)
                top = not same(up) or not same(left)
                bottom = not same(down) or not same(right)
                if m == 'S':
                    # 피부: 평평하게, 앞머리 바로 아래와 턱 아래만 그림자
                    t = 'lo' if up == 'H' or (down not in ('S',) and not same(down)) else 'base'
                elif bottom and not top: t = 'lo'
                elif top and not bottom: t = 'hi'
                else: t = 'base'
                out_rows[y][x] = key_for(m, t)
            elif m == '.' and outline:
                # 투명 칸이 불투명 칸과 붙어 있으면 그 재질의 어두운 테두리(sel-out)
                for nx, ny in ((x, y - 1), (x - 1, y), (x + 1, y), (x, y + 1)):
                    n = at(nx, ny)
                    if n in materials:
                        out_rows[y][x] = key_for(n, 'out')
                        break
    return [''.join(r) for r in out_rows], newpal

# ---------- A안: 1차 20×16 에 자동 음영 ----------
MAT_V1 = set('shABGWC')

def frame_a(stage, pose):
    g, p = v1.frame(stage, pose)
    return shade(g, p, MAT_V1, outline=False)

# ---------- B안: 32×32 새 그림 ----------
W32, H32 = 32, 32
def canvas(): return [['.'] * W32 for _ in range(H32)]
def paint(c, y, x0, x1, ch):
    for x in range(x0, x1 + 1):
        if 0 <= x < W32: c[y][x] = ch
def dot(c, x, y, ch): c[y][x] = ch

def body32(pose='stand'):
    c = canvas()
    # 망토(뒤) — 몸보다 먼저
    for y in range(14, 30):
        w = 1 + (y - 14) // 4
        paint(c, y, 7 - w, 7, 'C')
        paint(c, y, 21, 21 + min(w, 2), 'C')
    # 머리카락: 둥근 덩어리
    for y, (a, b) in {2: (12, 18), 3: (10, 20), 4: (9, 21), 5: (8, 22), 6: (8, 22), 7: (8, 22)}.items():
        paint(c, y, a, b, 'H')
    # 얼굴: 앞머리 아래로 둥글게
    for y, (a, b) in {8: (10, 20), 9: (9, 21), 10: (9, 21), 11: (9, 21), 12: (10, 20), 13: (11, 19)}.items():
        paint(c, y, a, b, 'S')
    # 옆머리: 얼굴 양옆 세로로만
    for y in (8, 9, 10, 11):
        dot(c, 8, y, 'H'); dot(c, 22, y, 'H')
    dot(c, 9, 8, 'H'); dot(c, 21, 8, 'H')
    # 앞머리 끝 두 가닥 · 머리 윤기
    dot(c, 13, 8, 'H'); dot(c, 17, 8, 'H')
    paint(c, 4, 12, 14, 'J'); dot(c, 11, 5, 'J')
    # 눈: 좌우 대칭 1×2, 입 한 점
    for ex in (12, 18):
        dot(c, ex, 10, 'E'); dot(c, ex, 11, 'E')
    dot(c, 15, 12, 'm')
    # 목
    paint(c, 14, 13, 17, 'S')
    # 어깨 · 갑옷
    paint(c, 15, 8, 22, 'A'); paint(c, 16, 7, 23, 'A'); paint(c, 17, 7, 23, 'A')
    for y in range(18, 23): paint(c, y, 9, 21, 'A')
    # 가슴 문양 · 금테
    paint(c, 15, 13, 17, 'G'); dot(c, 15, 18, 'R'); dot(c, 15, 19, 'G'); dot(c, 14, 19, 'G'); dot(c, 16, 19, 'G')
    for y in range(18, 23): dot(c, 15, y, 'B')
    # 팔
    for y in range(17, 22): paint(c, y, 6, 8, 'A')
    paint(c, 22, 6, 8, 'S')  # 왼손
    # 허리띠
    paint(c, 23, 9, 21, 'L'); paint(c, 23, 14, 16, 'G')
    # 치마갑 · 다리
    paint(c, 24, 9, 21, 'A'); paint(c, 25, 9, 14, 'A'); paint(c, 25, 16, 21, 'A')
    for y in range(26, 29): paint(c, y, 10, 13, 'B'); paint(c, y, 17, 20, 'B')
    paint(c, 27, 10, 13, 'A'); paint(c, 27, 17, 20, 'A')  # 무릎 보호대
    for y in (29, 30): paint(c, y, 9, 13, 'L'); paint(c, y, 17, 21, 'L')
    paint(c, 30, 8, 13, 'L'); paint(c, 30, 17, 22, 'L')
    if pose == 'stand':
        # 오른팔이 칼을 세워 든다
        for y in range(17, 21): paint(c, y, 22, 24, 'A')
        paint(c, 21, 23, 25, 'S')
        # 칼: 칼날 x26~27, 손잡이, 가드
        for y in range(1, 19): paint(c, y, 26, 27, 'W')
        dot(c, 26, 0, 'W')
        for y in (5, 9, 13): dot(c, 26, y, 'R')  # 룬
        paint(c, 19, 24, 29, 'G'); paint(c, 20, 25, 28, 'G')
        for y in (21, 22): paint(c, y, 26, 27, 'P')
        paint(c, 23, 26, 27, 'G')
    return c

PAL32 = {
    'S': 0xf2c9a2, 'H': 0x5a3a2a, 'J': 0x8a6448, 'E': 0x2a2440, 'w': 0xffffff, 'K': 0xf09a8a, 'm': 0xb0605a,
    'A': 0xc4ccd8, 'B': 0x3a4a78, 'C': 0x2f56b0, 'G': 0xe8b84a, 'W': 0xe8f0ff, 'P': 0x6a4428,
    'L': 0x7a5232, 'R': 0x4ad8ff,
}
MAT32 = set('SHACGWPLB')

def frame_b():
    c = body32()
    return shade([''.join(r) for r in c], PAL32, MAT32, outline=True)

# ---------- PNG ----------
import struct, zlib
def png(path, pixels, w, h):
    raw = b''.join(b'\x00' + bytes(sum(([*px] for px in pixels[y * w:(y + 1) * w]), [])) for y in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))

def sheet(path, items, bg, gap=12):
    # items: [(grid, palette, scale)]
    tw = gap + sum(len(g[0]) * s + gap for g, p, s in items)
    th = gap * 2 + max(len(g) * s for g, p, s in items)
    px = [bg] * (tw * th)
    ox = gap
    for g, p, s in items:
        oy = th - gap - len(g) * s
        for y, r in enumerate(g):
            for x, ch in enumerate(r):
                if ch == '.': continue
                col = hexrgb(p[ch])
                for dy in range(s):
                    base = (oy + y * s + dy) * tw + ox + x * s
                    for dx in range(s): px[base + dx] = col
        ox += len(g[0]) * s + gap
    png(path, px, tw, th)

if __name__ == '__main__':
    out = sys.argv[1]
    old = [v1.frame('spellblade', 'idle')]
    a = [frame_a('spellblade', 'idle')]
    b = [frame_b()]
    for name, bg in (('dark', (30, 30, 36)), ('light', (245, 245, 240))):
        sheet(f'{out}/compare-{name}.png', [(old[0][0], old[0][1], 8), (a[0][0], a[0][1], 8), (b[0][0], b[0][1], 5)], bg)
    print('ok')
