# 3차 시안 4판(버리는 그림): 메이플스토리 클래식 느낌 마검사 — 점을 두 배로(장면 160×64, 데스크톱 2px/점)
#   python3 maple_hero.py <출력 폴더>   → hero-poses.png (서기 · 베기 · 영창 실패 · 앉기, 8배 확대)
import sys
sys.path.insert(0, '/Users/yuribee/Documents/spellblade/tools/art')
import art32

# 재질: 음영(위 · 왼쪽 밝게, 아래 · 오른쪽 어둡게)과 sel-out 테두리를 art32.shade 가 넣는다
art32.MATERIALS = 'SHABCGWPLDKaT'
art32.DETAILS = 'EmJRwibs'
PAL = {
    'S': 0xffd9bc, 's': 0xeab08e,           # 피부 · 귀 안쪽 그림자
    'H': 0x2c2c3a, 'J': 0x6a6a88, 'K': 0x14141e,  # 검은 머리카락 · 윤기 · 결
    'E': 0x2a1c2a, 'w': 0xffffff, 'i': 0x7a4a2a, 'e': 0x4a2814,  # 눈 · 반짝 · 눈동자 · 눈썹
    'b': 0xffa8a0, 'm': 0xc0605a,           # 볼 · 입
    'A': 0xc98a4a, 'B': 0x4a5a8a, 'C': 0x3a6ad8, 'G': 0xf0c040,
    'W': 0xe8f0ff, 'P': 0x6a4428, 'L': 0x8a5a32, 'D': 0xb07a40,
    'a': 0x9a6232, 'T': 0xf4ead8,           # 가죽 주름 · 속옷 깃
}

# 머리: 26 × 23, 오른쪽을 보는 반쯤 옆얼굴. 뒤통수(왼쪽)는 머리카락, 귀는 얼굴 왼쪽 끝
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

# 몸: 24 × 17. 앞팔(오른쪽)은 칼을 쥐고, 뒷팔(왼쪽)은 방패 뒤
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

W_, H_ = 44, 48  # 영웅 칸 크기


def blank(w=W_, h=H_): return [['.'] * w for _ in range(h)]


def stamp(c, rows, ox, oy):
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.' and 0 <= oy + y < len(c) and 0 <= ox + x < len(c[0]): c[oy + y][ox + x] = ch


def pts(c, points, ch):
    for (x, y) in points:
        if 0 <= y < len(c) and 0 <= x < len(c[0]): c[y][x] = ch


def shield(c, ox, oy, w=9, h=11):
    # 등 쪽 둥근 방패: 금 테 · 나무 · 가운데 징
    cx, cy = (w - 1) / 2, (h - 1) / 2
    for y in range(h):
        for x in range(w):
            dx, dy = (x - cx) / (w / 2), (y - cy) / (h / 2)
            d = dx * dx + dy * dy
            if d <= 1.0: c[oy + y][ox + x] = 'G' if d > 0.6 else 'D'
    for (x, y) in ((cx, cy), (cx, cy - 1), (cx, cy + 1), (cx - 1, cy), (cx + 1, cy)): c[oy + int(y)][ox + int(x)] = 'G'


def base(sit=False):
    c = blank()
    if sit:
        shield(c, 7, 37)
        stamp(c, HEAD, 9, 11)
        stamp(c, SIT_BODY, 10, 37)
    else:
        shield(c, 8, 33)
        stamp(c, HEAD, 9, 8)
        stamp(c, BODY, 10, 34)
    return c


def blade_line(c, points, thick=2):
    for (x, y) in points:
        for t in range(thick): pts(c, [(x + t, y)], 'W')


def pose_idle():
    c = base()
    # 칼을 앞으로 비스듬히(두 줄 오를 때 한 칸)
    blade_line(c, [(30 + (37 - y) // 2, y) for y in range(21, 38)])
    pts(c, [(x, 38) for x in range(27, 34)], 'G')
    pts(c, [(29, 39), (30, 39), (29, 40), (30, 40)], 'L')
    return c


def pose_slash():
    c = base()
    # 앞팔을 쭉 뻗어 칼을 앞으로 휘두른다
    pts(c, [(x, y) for x in range(26, 31) for y in (38, 39)], 'A')
    pts(c, [(x, y) for x in range(31, 34) for y in (38, 39)], 'L')
    pts(c, [(34, y) for y in range(35, 43)], 'G')
    blade_line(c, [(x, y) for x in range(35, 44) for y in (38, 39)], 1)
    return c


def pose_cast():
    c = base()
    # 칼끝을 앞 위로 겨누고 주문을 외운다
    pts(c, [(26, 38), (27, 38), (27, 37), (28, 37), (28, 36), (29, 36)], 'A')
    pts(c, [(29, 34), (30, 34), (29, 35), (30, 35), (31, 35)], 'L')
    pts(c, [(30, 32), (31, 33), (32, 34)], 'G')
    blade_line(c, [(32 + i, 32 - i) for i in range(0, 9)])
    return c


def pose_sit():
    c = base(sit=True)
    blade_line(c, [(4, y) for y in range(22, 44)])
    pts(c, [(x, 43) for x in range(1, 9)], 'G')
    pts(c, [(4, 44), (5, 44), (4, 45), (5, 45)], 'P')
    return c


def squint(c, oy=8, ox=9):
    # > < 질끈 감은 두 눈 (머리 기준 좌표를 칸 좌표로)
    for x in list(range(13, 17)) + list(range(20, 24)):
        for y in range(15, 21): c[oy + y][ox + x] = 'S'
    for (x, y) in ((13, 15), (14, 16), (15, 16), (16, 17), (15, 18), (14, 18), (13, 19),
                   (23, 15), (22, 16), (21, 16), (20, 17), (21, 18), (22, 18), (23, 19)):
        c[oy + y][ox + x] = 'E'


def render(grid):
    return art32.shade([''.join(r) for r in grid], PAL)


def frames():
    fail = pose_cast(); squint(fail)
    return {'idle': render(pose_idle()), 'slash': render(pose_slash()), 'fail': render(fail), 'sit': render(pose_sit())}


if __name__ == '__main__':
    out = sys.argv[1]
    fs = frames()
    scale, gap = 6, 8
    w = (W_ * scale + gap) * len(fs) + gap
    h = H_ * scale + gap * 2
    px = [(30, 30, 36)] * (w * h)
    for i, rgb in enumerate(fs.values()):
        ox = gap + i * (W_ * scale + gap)
        for y in range(H_):
            for x in range(W_):
                v = rgb[y][x]
                if v is None: continue
                col = ((v >> 16) & 255, (v >> 8) & 255, v & 255)
                for dy in range(scale):
                    base_i = (gap + y * scale + dy) * w + ox + x * scale
                    for dx in range(scale): px[base_i + dx] = col
    art32.png(f'{out}/maple-hero.png', px, w, h)
    print('ok')
