# 3차 몬스터 12종 원본(art3.py 가 가져다 쓴다) — 모두 왼쪽(마검사 쪽)을 본다
# 칸 = 내용 + 여백(왼쪽 3: 공격 때 2점 내밀 자리 · 위 1 · 오른쪽 1). 발은 맨 아래 줄, 유령만 아래 4줄이 비어 떠 있다
# 그리는 함수는 attack=True 면 입 · 무기를 벌린 공격 모습을 그린다(앞으로 내미는 건 lunge 가 한다)
# 모두 이 프로젝트를 위해 새로 그린 그림이다(메이플스토리 몬스터를 베끼지 않는다).
import math


class Can:
    # 내용 좌표(왼쪽 위 = 0, 0)로 그리면 여백만큼 옮겨 찍는다
    def __init__(self, w, h, below=0):
        self.ox, self.oy = 3, 1
        self.w, self.h = w + 4, h + 1 + below
        self.c = [['.'] * self.w for _ in range(self.h)]

    def put(self, x, y, ch, keep=None):
        X, Y = round(x) + self.ox, round(y) + self.oy
        if 0 <= Y < self.h and 0 <= X < self.w and (keep is None or self.c[Y][X] in keep): self.c[Y][X] = ch

    def pts(self, ps, ch, keep=None):
        for (x, y) in ps: self.put(x, y, ch, keep)

    def rect(self, x0, y0, x1, y1, ch, keep=None):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): self.put(x, y, ch, keep)

    def ell(self, cx, cy, rx, ry, ch, keep=None):
        for y in range(math.floor(cy - ry) - 1, math.ceil(cy + ry) + 2):
            for x in range(math.floor(cx - rx) - 1, math.ceil(cx + rx) + 2):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0: self.put(x, y, ch, keep)

    def line(self, x0, y0, x1, y1, ch, thick=1, keep=None):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            x, y = round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)
            for t in range(thick): self.put(x + t, y, ch, keep)

    def poly(self, ps, ch, keep=None):
        ys = [p[1] for p in ps]
        for y in range(math.floor(min(ys)), math.ceil(max(ys)) + 1):
            yc = y + 0.5
            xs = []
            for i in range(len(ps)):
                (x0, y0), (x1, y1) = ps[i], ps[(i + 1) % len(ps)]
                if (y0 <= yc < y1) or (y1 <= yc < y0):
                    xs.append(x0 + (yc - y0) * (x1 - x0) / (y1 - y0))
            xs.sort()
            for a, b in zip(xs[0::2], xs[1::2]):
                for x in range(math.ceil(a - 0.5), math.floor(b - 0.5) + 1): self.put(x, y, ch, keep)

    def chain(self, ps, ch, keep=None):
        # 굵기가 변하는 몸통 · 꼬리: (x, y, 반지름) 원을 이어 찍는다
        for (x, y, r) in ps: self.ell(x, y, r, r, ch, keep)

    def rows(self): return [''.join(r) for r in self.c]


def eyes(c, xs, y, h=3, w=2):
    # 큰 눈: 왼쪽 위 반짝(w)
    for x in xs:
        c.rect(x, y, x + w - 1, y + h - 1, 'E')
        c.put(x, y, 'w')


# ---------- 0 슬라임: 시안 7판 그대로(물방울 초록 젤리) ----------
def slime(attack=False):
    c = Can(25, 18)
    for (y, x0, x1) in ((0, 11, 12), (1, 10, 13), (2, 9, 14)):
        c.rect(x0, y, x1, y, 'Q')
    for y in range(3, 18):
        for x in range(24):
            dx, dy = (x - 11.5) / 11.8, (y - 12) / 9.0
            if dy > 0.55: dy = 0.55 + (dy - 0.55) * 0.4
            if dx * dx + dy * dy <= 1.0: c.put(x, y, 'Q')
    c.pts(((6, 6), (7, 6), (5, 7), (6, 7), (5, 8), (9, 4), (10, 3)), 'q')
    for ex in (5, 12):
        c.rect(ex, 9, ex + 2, 12, 'E')
        c.pts(((ex, 9), (ex + 1, 9), (ex, 10)), 'w')
        c.rect(ex, 12, ex + 2, 12, 'i')
    c.pts(((3, 14), (4, 14), (16, 14), (17, 14)), 'b')
    if attack:
        c.rect(8, 13, 11, 15, 'm'); c.pts(((9, 15), (10, 15)), 'b')
    else:
        c.pts(((9, 14), (10, 14), (8, 13), (11, 13)), 'm')
    pal = {'Q': 0x5ed64a, 'q': 0xd8ffc8, 'E': 0x1e2a1e, 'w': 0xffffff, 'i': 0x3a6a3a, 'b': 0xff9aa0, 'm': 0x2a5a2a}
    return c.rows(), pal, 'Q', 'qEwibm'


# ---------- 1 달팽이: 주황 소용돌이 껍데기 · 크림 몸 · 짧은 더듬이 ----------
def snail(attack=False):
    c = Can(26, 18)
    c.ell(13, 14.2, 12.5, 3.6, 'Q')                       # 몸(발)
    c.line(3, 5, 2, 2, 'Q'); c.line(7, 5, 8, 2, 'Q')      # 더듬이
    c.rect(1, 0, 2, 1, 'Q'); c.rect(8, 0, 9, 1, 'Q')
    c.ell(5, 10, 5, 5.5, 'Q')                             # 머리
    c.ell(18.5, 7.5, 7.2, 7.0, 'U')                       # 껍데기
    for i in range(160):                                  # 소용돌이
        t = i / 160 * 3.2 * math.pi
        r = 0.8 + t * 0.62
        if r > 6.2: break
        c.put(18.5 + r * math.cos(t), 7.5 + r * math.sin(t), 'V')
    c.pts(((16, 2), (17, 2), (15, 3)), 'q')               # 껍데기 윤기
    eyes(c, (2, 6), 8)
    c.pts(((1, 12), (8, 12)), 'b')
    if attack: c.rect(3, 12, 5, 13, 'm')
    else: c.pts(((3, 12), (4, 13), (5, 12)), 'm')
    pal = {'Q': 0xf4e6c0, 'U': 0xe8823a, 'V': 0x8a4a22, 'q': 0xffd8a8, 'E': 0x2a1c2a, 'w': 0xffffff, 'b': 0xffa8a0, 'm': 0xb0605a}
    return c.rows(), pal, 'QU', 'VqEwbm'


# ---------- 2 버섯: 점박이 주황 갓 · 크림 얼굴 · 작은 발(시안 4판) ----------
def mushroom(attack=False):
    c = Can(26, 24)
    for y in range(0, 13):
        for x in range(26):
            dx, dy = (x - 12.5) / 12.5, (y - 12) / 12
            if dx * dx + dy * dy <= 1.0: c.put(x, y, 'Q')
    c.pts(((7, 4), (8, 4), (7, 5), (8, 5), (16, 3), (17, 3), (16, 4), (17, 4), (12, 8), (13, 8), (20, 8), (21, 8), (4, 9)), 'q')
    for y in range(12, 22):
        for x in range(5, 21):
            if (y == 21 and x in (5, 20)) or (y == 12 and x in (5, 20)): continue
            c.put(x, y, 'O')
    for ex in (7, 13):
        c.rect(ex, 14, ex + 1, 17, 'E'); c.put(ex, 14, 'w')
    c.pts(((5, 18), (6, 18), (15, 18), (16, 18)), 'b')
    if attack: c.rect(9, 19, 12, 20, 'm')
    else: c.pts(((10, 19), (11, 19)), 'm')
    for (x0, x1) in ((6, 10), (15, 19)):
        c.rect(x0, 22, x1 - 1, 22, 'V'); c.rect(x0 + 1, 23, x1 - 2, 23, 'V')
    pal = {'Q': 0xff8a2c, 'q': 0xfff0c8, 'O': 0xfff0d4, 'V': 0xa86a3a, 'E': 0x2a1c2a, 'w': 0xffffff, 'b': 0xffb0a0, 'm': 0xc0605a}
    return c.rows(), pal, 'QOV', 'qEwbm'


# ---------- 3 돼지: 분홍 둥근 몸 · 작은 귀 · 코 · 짧은 다리 · 말린 꼬리 ----------
def pig(attack=False):
    c = Can(32, 22)
    c.ell(16, 11.5, 13, 8.2, 'Q')
    c.ell(17, 15, 9, 3.6, 'O', keep='Q')
    c.poly(((6, 6), (8, 0), (11, 5)), 'U'); c.poly(((12, 4), (15, 0), (17, 5)), 'U')
    c.ell(3, 11.5, 3.2, 2.6, 'U')
    c.pts(((2, 11), (4, 11)), 'n')
    for ex in (7, 12):
        c.rect(ex, 7, ex + 1, 9, 'E'); c.put(ex, 7, 'w')
    c.pts(((6, 11), (7, 11), (13, 11), (14, 11)), 'b')
    if attack: c.rect(5, 14, 8, 15, 'm')
    else: c.pts(((6, 14), (7, 14), (8, 14)), 'm')
    for x0 in (6, 11, 20, 25):
        c.rect(x0, 18, x0 + 2, 19, 'Q'); c.rect(x0, 20, x0 + 2, 21, 'V')
    c.pts(((29, 8), (30, 7), (31, 8), (30, 9), (29, 10)), 'U')
    pal = {'Q': 0xffaabf, 'O': 0xffd4de, 'U': 0xff7f9e, 'V': 0xc0506e, 'n': 0x9a3a56, 'E': 0x2a1c2a, 'w': 0xffffff, 'b': 0xff7a8a, 'm': 0x9a3a56}
    return c.rows(), pal, 'QOUV', 'nEwbm'


# ---------- 4 나무 그루터기: 나이테 윗면 · 새싹 두 잎 · 화난 눈 · 뿌리 발 ----------
def stump(attack=False):
    c = Can(28, 28)
    c.ell(4, 25.5, 4.5, 2.5, 'V'); c.ell(14, 26, 4, 2, 'V'); c.ell(23.5, 25.5, 4.5, 2.5, 'V')   # 뿌리 발
    for y in range(8, 26):                                 # 몸통(아래로 조금 넓게)
        k = max(0, y - 20) * 0.5
        c.rect(round(3 - k), y, round(24 + k), y, 'Q')
    c.ell(13.5, 8, 10.5, 3.5, 'O')                         # 잘린 윗면
    c.ell(13.5, 8, 7.5, 2.4, 'q', keep='O'); c.ell(13.5, 8, 6.5, 1.6, 'O', keep='q')
    c.ell(13.5, 8, 3.5, 1.2, 'q', keep='O'); c.put(13.5, 8, 'q')
    c.line(16, 5, 16, 2, 'U')                              # 새싹
    c.ell(13.5, 1.5, 2.6, 1.3, 'U'); c.ell(18.5, 1.5, 2.6, 1.3, 'U')
    c.line(19, 11, 19, 22, 'n'); c.line(22, 13, 22, 24, 'n'); c.line(4, 20, 4, 24, 'n'); c.line(16, 22, 16, 25, 'n')
    eyes(c, (6, 13), 14)
    c.pts(((5, 12), (6, 12), (7, 13), (8, 13), (12, 13), (13, 13), (14, 12), (15, 12)), 'n')   # 화난 눈썹
    if attack: c.rect(8, 18, 12, 20, 'm'); c.pts(((9, 18), (11, 18)), 't')
    else: c.pts(((8, 19), (9, 18), (10, 18), (11, 18), (12, 19)), 'm')
    pal = {'Q': 0xa8743e, 'O': 0xf0d29a, 'q': 0xc89a5a, 'U': 0x6ccf4a, 'V': 0x7a4e2a, 'n': 0x6a4220,
           'E': 0x2a1c1a, 'w': 0xffffff, 'm': 0x5a2a1a, 't': 0xfff4e0}
    return c.rows(), pal, 'QOUV', 'qnEwmt'


# ---------- 5 늑대: 회색 늑대 웅크림 · 노란 눈 · 꼬리 ----------
def wolf(attack=False):
    c = Can(36, 26)
    c.chain(((31, 14, 2.4), (32.5, 10.5, 2.6), (33, 6.5, 2.3), (32.5, 3.5, 1.6)), 'Q')   # 꼬리
    c.ell(33, 4.5, 1.8, 2.2, 'O', keep='Q')
    c.ell(22, 15, 11, 6.5, 'Q')                            # 몸
    c.ell(23, 11, 10, 3.5, 'U', keep='Q')                  # 등 짙은 털
    for x0 in (10, 15, 25, 30):                            # 다리 · 발
        c.rect(x0, 19, x0 + 2, 24, 'Q'); c.rect(x0 - 1, 25, x0 + 2, 25, 'V')
    c.ell(13, 16, 5, 4.5, 'O', keep='Q')                   # 가슴 털
    c.ell(9, 10, 7, 6, 'Q')                                # 머리
    c.poly(((4, 7), (6, 0), (9.5, 5)), 'Q'); c.poly(((10, 5), (13, 0), (15.5, 7)), 'Q')   # 귀
    c.pts(((6, 3), (6, 4), (7, 4), (13, 3), (13, 4), (12, 4)), 'b')
    c.ell(3, 12.5, 3.5, 2.5, 'O')                          # 주둥이
    c.pts(((0, 11), (1, 11), (0, 12)), 'n')
    for ex in (5, 10):
        c.rect(ex, 8, ex + 1, 10, 'y'); c.put(ex + 1, 8, 'w'); c.rect(ex, 9, ex, 10, 'E')
    if attack:
        c.poly(((0, 14), (6.5, 13.5), (6, 17), (1, 17)), 'm'); c.pts(((1, 14), (3, 14), (5, 14), (2, 16), (4, 16)), 't')
    else:
        c.pts(((1, 15), (2, 15), (3, 15), (4, 14)), 'm')
    pal = {'Q': 0x9ca3b4, 'U': 0x6c7386, 'O': 0xe6eaf2, 'V': 0x4a5060, 'y': 0xffd23a, 'E': 0x1a1a24, 'w': 0xffffff,
           'n': 0x22222c, 'm': 0x7a2a3a, 't': 0xffffff, 'b': 0xff9aa8}
    return c.rows(), pal, 'QUOV', 'yEwnmtb'


# ---------- 6 해골 병사: 뼈 몸 · 녹슨 칼 · 작은 방패 · 붉은 눈빛 ----------
def skeleton(attack=False):
    c = Can(30, 38)
    c.ell(24, 24, 5, 5.5, 'U'); c.ell(24, 24, 3.8, 4.3, 'V')   # 방패(뒤 팔)
    c.rect(23, 23, 25, 25, 'g'); c.put(23, 23, 'w')
    c.rect(13, 30, 14, 36, 'Q'); c.rect(18, 30, 19, 36, 'Q')   # 다리 · 발
    c.rect(11, 37, 14, 37, 'Q'); c.rect(16, 37, 19, 37, 'Q')
    c.rect(12, 28, 20, 29, 'Q'); c.put(16, 29, 'n')            # 골반
    c.ell(16, 24, 5.5, 4.5, 'Q')                               # 갈비뼈
    for (y, x0, x1) in ((22, 12, 20), (24, 11, 21), (26, 12, 20)): c.rect(x0, y, x1, y, 'n', keep='Q')
    c.rect(16, 20, 16, 27, 'Q')                                # 등뼈
    c.ell(17, 9, 8.5, 8, 'Q')                                  # 머리뼈
    c.rect(12, 15, 21, 18, 'Q'); c.pts(((12, 18), (21, 18)), '.')
    for ex in (11, 17):                                        # 눈구멍 · 붉은 눈빛
        c.rect(ex, 8, ex + 2, 11, 'E'); c.pts(((ex, 8), (ex + 2, 8)), 'Q')
        c.pts(((ex + 1, 9), (ex + 1, 10)), 'r')
    c.pts(((15, 13), (15, 14)), 'n')
    c.rect(13, 16, 20, 16, 'n'); c.pts(((14, 15), (16, 15), (18, 15), (14, 17), (16, 17), (18, 17)), 'n')
    if attack:                                                 # 칼을 앞 위로 치켜든다
        c.line(14, 21, 10, 19, 'Q', thick=2)
        c.line(9, 17, 3, 3, 'U', thick=2); c.put(2, 2, 'U')
        c.pts(((5, 8), (7, 12), (4, 6)), 'q')
        c.line(7, 19, 11, 17, 'U'); c.rect(9, 18, 10, 19, 'V')
    else:                                                      # 칼을 세워 든다
        c.line(14, 21, 8, 25, 'Q', thick=2)
        c.rect(5, 11, 6, 23, 'U'); c.put(5, 10, 'U')
        c.pts(((6, 14), (5, 18), (6, 21)), 'q')
        c.rect(3, 24, 8, 24, 'U'); c.rect(5, 25, 6, 27, 'V'); c.rect(4, 25, 7, 25, 'Q')
    pal = {'Q': 0xf0ecd8, 'U': 0xc4bcb0, 'V': 0x8a5a34, 'E': 0x2a2030, 'r': 0xff4a3a, 'n': 0x5a5048,
           'q': 0x8a4a22, 'g': 0xe0b040, 'w': 0xffffff}
    return c.rows(), pal, 'QUV', 'Ernqgw'


# ---------- 7 골렘: 이끼 낀 돌 몸 · 하늘색 눈빛 ----------
def golem(attack=False):
    c = Can(36, 42)
    c.rect(10, 31, 16, 40, 'V'); c.rect(21, 31, 27, 40, 'V')   # 다리 · 발
    c.rect(9, 41, 17, 41, 'V'); c.rect(20, 41, 28, 41, 'V')
    c.ell(31, 14, 5.5, 5, 'V'); c.ell(32, 23, 3.8, 6, 'V'); c.ell(32, 30, 4.5, 4, 'V')   # 뒤 팔
    c.ell(18, 21, 12.5, 11.5, 'Q')                             # 몸통
    c.ell(17, 8, 7.5, 6.5, 'O')                                # 머리
    if attack:                                                 # 앞 주먹을 치켜든다
        c.ell(5, 13, 5.5, 5, 'V'); c.ell(4, 8, 3.6, 4, 'V'); c.ell(5, 3, 4.5, 3.6, 'V')
    else:
        c.ell(5, 14, 5.5, 5, 'V'); c.ell(4, 23, 3.8, 6, 'V'); c.ell(4, 30, 4.5, 4, 'V')
    c.ell(16, 2.5, 6, 2.2, 'U', keep='O')                      # 이끼
    c.ell(31, 10, 4.5, 2, 'U', keep='V'); c.ell(18, 11.5, 9, 2, 'U', keep='Q')
    if not attack: c.ell(5, 10, 4.5, 2, 'U', keep='V')
    c.pts(((14, 1), (17, 2), (30, 9), (11, 11), (22, 11)), 'q')
    for ex in (12, 18):                                        # 눈빛
        c.rect(ex, 7, ex + 2, 8, 'c'); c.put(ex + 1, 7, 'w')
    c.line(14, 17, 17, 22, 'n'); c.line(23, 24, 26, 27, 'n'); c.line(10, 25, 12, 28, 'n')
    pal = {'Q': 0x9a96a6, 'O': 0xb4b0c0, 'U': 0x6abf4a, 'V': 0x7e7a8c, 'q': 0xa8e878, 'c': 0x8ae8ff, 'w': 0xffffff, 'n': 0x4a4656}
    return c.rows(), pal, 'QOUV', 'qcwn'


# ---------- 8 유령: 흰 · 하늘 반투명 · 꼬리 자락 · 귀여운 얼굴, 4점 떠 있다 ----------
def ghost(attack=False):
    c = Can(28, 34, below=4)
    c.chain(((13, 17, 10.5), (15, 22, 8.5), (17.5, 26, 6.5), (20, 29, 4.6), (22.5, 30.5, 3.2), (24.5, 31.5, 2), (26, 32.5, 1.2)), 'Q')
    c.ell(13, 10.5, 11.5, 10.5, 'Q')
    if attack: c.ell(1.8, 13, 2.2, 1.8, 'Q')                   # 작은 손
    else: c.ell(1.8, 17, 2.2, 1.8, 'Q')
    for y in range(21, 34): c.rect(0, y, 27, y, 'O', keep='Q')
    for y in range(29, 34):                                    # 꼬리 끝은 바둑판으로 비친다
        for x in range(28):
            if (x + y) % 2 == 0: c.put(x, y, '.', keep='O')
    for ex in (7, 13):
        c.rect(ex, 9, ex + 1, 12, 'E'); c.put(ex, 9, 'w')
    c.pts(((5, 14), (6, 14), (15, 14), (16, 14)), 'b')
    if attack: c.rect(9, 14, 11, 16, 'm')
    else: c.pts(((9, 14), (10, 15), (11, 14)), 'm')
    pal = {'Q': 0xf4f8ff, 'O': 0xc8e6ff, 'E': 0x2a2a4a, 'w': 0xffffff, 'b': 0xffb0c8, 'm': 0x5a4a7a}
    return c.rows(), pal, 'QO', 'Ewbm'


# ---------- 9 와이번: 초록 비룡 · 날개 펼침 · 꼬리 ----------
def wyvern(attack=False):
    c = Can(44, 40)
    c.poly(((16, 19), (13, 3), (19, 0), (24, 8), (21, 10), (22, 16)), 'U')        # 먼 날개
    c.line(16, 19, 13, 3, 'V'); c.line(13, 3, 24, 8, 'V')
    c.poly(((24, 22), (27, 4), (36, 0), (43, 8), (39, 12), (40, 18), (34, 16), (31, 23)), 'U')   # 가까운 날개
    c.line(24, 22, 27, 4, 'V'); c.line(27, 4, 36, 0, 'V'); c.line(27, 4, 43, 8, 'V'); c.line(27, 4, 40, 18, 'V')
    c.chain(((33, 31, 3.5), (36.5, 32.5, 3), (39.5, 32, 2.5), (41.5, 29.5, 2)), 'Q')   # 꼬리
    c.poly(((40, 27), (43, 24), (43, 29)), 'V')
    c.ell(25, 27, 9, 7.5, 'Q')                                                  # 몸
    c.ell(22, 29, 5.5, 5.5, 'O', keep='Q')
    for y in (27, 30): c.rect(18, y, 26, y, 'q', keep='O')
    c.ell(21, 33, 3.5, 3, 'Q'); c.ell(29, 33, 3.5, 3, 'Q')                      # 다리 · 발
    c.rect(19, 35, 21, 38, 'Q'); c.rect(28, 35, 30, 38, 'Q')
    c.rect(17, 39, 22, 39, 'V'); c.rect(26, 39, 31, 39, 'V')
    c.chain(((19, 22, 4.5), (15, 18, 4)), 'Q')                                  # 목
    c.ell(10, 13, 7, 6, 'Q')                                                    # 머리
    c.poly(((11, 8), (17, 3), (15, 10)), 'V'); c.poly(((8, 7), (11, 2), (12, 8)), 'V')   # 뿔
    c.ell(3.5, 15, 3.5, 3, 'Q')                                                 # 주둥이
    c.ell(5, 17.5, 4, 1.5, 'O', keep='Q')
    c.rect(7, 10, 8, 12, 'y'); c.rect(7, 11, 7, 12, 'E'); c.put(8, 10, 'w')
    c.put(1, 14, 'n')
    if attack:
        c.poly(((0, 16), (7, 16), (7, 19), (1, 20)), 'm'); c.pts(((1, 16), (3, 16), (5, 16), (2, 19), (4, 19)), 't')
    else:
        c.rect(1, 17, 6, 17, 'm')
    pal = {'Q': 0x5ab84a, 'O': 0xf0e0a0, 'q': 0xd8c080, 'U': 0x3a8a5a, 'V': 0xe8dcb4, 'y': 0xffd23a, 'E': 0x1a2418,
           'w': 0xffffff, 'n': 0x1e3a1e, 'm': 0x6a2a2a, 't': 0xffffff}
    return c.rows(), pal, 'QOUV', 'qyEwnmt'


# ---------- 10 새끼 용: 빨간 아기 용 · 작은 날개 · 배 비늘 ----------
def baby_dragon(attack=False):
    c = Can(40, 36)
    c.chain(((30, 30, 3), (33.5, 32, 2.6), (36.5, 32, 2.2), (38, 30, 1.6)), 'Q')   # 꼬리
    c.poly(((36.5, 29), (39.5, 25), (39.5, 30)), 'V')
    c.poly(((25, 17), (31, 6), (36, 7), (38, 12), (35, 11), (34, 16), (30, 14), (29, 19)), 'U')   # 날개
    c.line(25, 17, 31, 6, 'V'); c.line(31, 6, 38, 12, 'V')
    c.ell(22, 26, 9, 8.5, 'Q')                                                   # 몸
    c.ell(19.5, 27, 6, 6.5, 'O', keep='Q')
    for y in (24, 27, 30): c.rect(14, y, 26, y, 'q', keep='O')
    c.ell(17, 33, 3.5, 2.5, 'Q'); c.ell(26, 33, 3.5, 2.5, 'Q')                   # 다리 · 발
    c.rect(14, 35, 19, 35, 'V'); c.rect(23, 35, 28, 35, 'V')
    c.ell(12.5, 25, 2.5, 2, 'Q'); c.put(10, 25, 'V'); c.put(10, 26, 'V')        # 팔
    c.ell(13, 12, 11, 10, 'Q')                                                   # 머리
    c.ell(4, 15, 4, 3.2, 'Q')                                                    # 주둥이
    c.poly(((8, 4), (9, 0), (12, 3)), 'V'); c.poly(((15, 3), (18, 0), (19, 4)), 'V')   # 뿔
    eyes(c, (7, 14), 9, h=4)
    c.pts(((5, 14), (6, 14), (17, 14), (18, 14)), 'b')
    c.put(1, 14, 'n')
    if attack: c.rect(3, 16, 7, 18, 'm'); c.pts(((4, 16), (6, 16)), 't'); c.pts(((4, 18), (5, 18)), 'b')
    else: c.pts(((3, 17), (4, 18), (5, 18), (6, 17)), 'm')
    pal = {'Q': 0xe8483a, 'O': 0xffe0a0, 'q': 0xe8b870, 'U': 0xff8a4a, 'V': 0xfff0c8, 'E': 0x2a1418, 'w': 0xffffff,
           'b': 0xff9aa0, 'n': 0x6a1a1a, 'm': 0x6a1a1a, 't': 0xffffff}
    return c.rows(), pal, 'QOUV', 'qEwbnmt'


# ---------- 11 드래곤: 보라 · 검정 큰 용 · 뿔 · 날개를 위로 ----------
def dragon(attack=False):
    c = Can(56, 48)
    c.poly(((30, 24), (33, 5), (41, 0), (55, 4), (52, 10), (47, 9), (48, 17), (42, 15), (40, 23)), 'U')   # 먼 날개
    c.line(30, 24, 33, 5, 'Q'); c.line(33, 5, 41, 0, 'Q'); c.line(33, 5, 55, 4, 'Q'); c.line(33, 5, 48, 17, 'Q')
    c.chain(((44, 38, 4.5), (48.5, 41, 3.5), (52.5, 40.5, 2.8), (54.5, 37, 2)), 'Q')   # 꼬리
    c.poly(((53, 34), (55.5, 30), (55.5, 36)), 'V')
    c.ell(32, 33, 14, 9.5, 'Q')                                                  # 몸
    c.ell(28, 36, 8, 6, 'O', keep='Q')
    for y in (33, 36, 39): c.rect(20, y, 36, y, 'q', keep='O')
    c.ell(40, 39, 5, 5, 'Q'); c.rect(38, 42, 43, 46, 'Q'); c.rect(36, 47, 44, 47, 'V')   # 뒷다리
    c.ell(23, 39, 4, 4, 'Q'); c.rect(21, 41, 25, 46, 'Q'); c.rect(19, 47, 26, 47, 'V')   # 앞다리
    c.chain(((22, 28, 6), (18, 23, 5.5), (15, 18, 5)), 'Q')                      # 목
    for (x, y) in ((21, 17), (25, 21), (29, 24)): c.poly(((x - 2, y + 1), (x + 1, y - 3), (x + 2, y + 2)), 'V')   # 등 가시
    c.poly(((26, 25), (22, 6), (29, 2), (37, 10), (33, 12), (34, 19), (29, 18)), 'U')   # 가까운 날개
    c.line(26, 25, 22, 6, 'Q'); c.line(22, 6, 29, 2, 'Q'); c.line(22, 6, 37, 10, 'Q')
    c.ell(12, 13, 8.5, 7, 'Q')                                                   # 머리
    c.poly(((12, 7), (20, 0), (17, 8)), 'V'); c.poly(((16, 9), (25, 4), (20, 11)), 'V')   # 뿔
    c.ell(4.5, 16, 4.5, 3.5, 'Q')                                                # 주둥이
    c.ell(6, 19, 5, 1.5, 'O', keep='Q')
    c.rect(8, 11, 10, 12, 'y'); c.rect(8, 11, 8, 12, 'E'); c.put(10, 11, 'w')
    c.line(7, 10, 11, 9, 'n')
    c.put(1, 15, 'n')
    if attack:
        c.poly(((0, 17), (9, 17), (9, 21), (1, 22)), 'm'); c.pts(((1, 17), (3, 17), (5, 17), (7, 17), (2, 21), (4, 21), (6, 21)), 't')
    else:
        c.rect(1, 18, 8, 18, 'm')
    pal = {'Q': 0x7a46b4, 'O': 0xd6b4f0, 'q': 0xa47ad0, 'U': 0x2e2040, 'V': 0xf2e8cc, 'y': 0xffb82a, 'E': 0x1a0a1a,
           'w': 0xffffff, 'n': 0x2a1838, 'm': 0x4a1830, 't': 0xffffff}
    return c.rows(), pal, 'QOUV', 'qyEwnmt'


MONSTERS = [slime, snail, mushroom, pig, stump, wolf, skeleton, golem, ghost, wyvern, baby_dragon, dragon]


# 숨쉬기: 몸 가운데쯤 디테일이 가장 적은 줄 하나를 빼고 위쪽을 1점 누른다
def breathe(g, details):
    h = len(g)
    lo, hi = int(h * 0.35), int(h * 0.7)
    cut = min(range(lo, hi + 1), key=lambda y: (sum(ch in details for ch in g[y]), abs(y - h * 0.55)))
    out = list(g)
    for y in range(cut, 0, -1): out[y] = g[y - 1]
    out[0] = '.' * len(g[0])
    return out


# 떠 있는 유령은 숨쉬기 대신 1점 내려온다
def bob(g):
    return ['.' * len(g[0])] + list(g[:-1])


# 공격: 발(아래 3줄)은 두고 위를 왼쪽으로 2점
def lunge(g, keep=3, dx=2):
    h = len(g)
    return [r if y >= h - keep else r[dx:] + '.' * dx for y, r in enumerate(g)]


def frames(fn):
    g, pal, mat, det = fn()
    a = fn(True)[0]
    idle1 = bob(g) if fn is ghost else breathe(g, det)
    return {'idle0': g, 'idle1': idle1, 'attack': lunge(a)}, pal, mat, det
