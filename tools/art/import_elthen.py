"""Elthen 무료 그림(저장소 밖)을 마검사 그림 묶음 하나로 만든다 — 표준 라이브러리만.

  python3 tools/art/import_elthen.py check   <elthen 폴더>
  python3 tools/art/import_elthen.py build   <elthen 폴더> <묶음.json>
  python3 tools/art/import_elthen.py preview <elthen 폴더> <확인.png>
  python3 tools/art/import_elthen.py sheet   <시트.png> <칸 폭> <칸 높이> <확인.png>   # 칸 줄을 그어 크게 본다

그림은 Elthen's Pixel Art Shop(elthen.itch.io)의 자유가격 팩이다. 수정해도 재배포 · 재판매 금지라
그림 · 묶음 · 확인 그림은 저장소에 넣지 않는다 — 이 파일에는 「어느 팩 · 어느 줄 · 어느 칸」 좌표만 있다.
묶음 형식은 hooks/lib/pack.ts: 스프라이트마다 색표(글자 → 0xRRGGBB) + 동작별 프레임(글자 줄), 프레임 크기는
스프라이트 안에서 모두 같고 맨 아래 줄이 발, 몬스터는 왼쪽을 본다.
"""
import json
import os
import struct
import sys
import zlib

ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
HERO_ANIMS = ('idle', 'slash1', 'slash2', 'slash3', 'cast', 'hurt', 'jump', 'down')
CAP = {'idle': 4, 'attack': 3, 'hit': 2, 'revive': 3}   # 몬스터 동작마다 고르게 고를 장 수


# ---------- PNG ----------
def decode(path):
    b = open(path, 'rb').read()
    assert b[:8] == b'\x89PNG\r\n\x1a\n', path
    at, idat, w, h, ct = 8, b'', 0, 0, 0
    while at < len(b):
        n = struct.unpack('>I', b[at:at + 4])[0]
        t, d = b[at + 4:at + 8], b[at + 8:at + 8 + n]
        if t == b'IHDR':
            w, h, depth, ct, _, _, il = struct.unpack('>IIBBBBB', d)
            assert depth == 8 and ct == 6 and il == 0, (path, depth, ct, il)
        elif t == b'IDAT':
            idat += d
        at += 12 + n
    raw, stride, rows, prev, i = zlib.decompress(idat), w * 4, [], bytearray(w * 4), 0
    for _ in range(h):
        f, line = raw[i], bytearray(raw[i + 1:i + 1 + stride])
        i += 1 + stride
        for x in range(stride):
            a = line[x - 4] if x >= 4 else 0
            up, c = prev[x], (prev[x - 4] if x >= 4 else 0)
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + up) & 255
            elif f == 3: line[x] = (line[x] + (a + up) // 2) & 255
            elif f == 4:
                p = a + up - c
                pa, pb, pc = abs(p - a), abs(p - up), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else up if pb <= pc else c)) & 255
        rows.append([None if line[x * 4 + 3] < 128 else (line[x * 4] << 16) | (line[x * 4 + 1] << 8) | line[x * 4 + 2] for x in range(w)])
        prev = line
    return rows


def write_png(path, pixels, w, h):
    raw = b''.join(b'\x00' + bytes(v for p in pixels[y * w:(y + 1) * w] for v in p) for y in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


# ---------- 프레임 표 ----------
# 칸 시트: (줄, 처음 칸, 장 수). json 시트: Aseprite frameTags 이름. flip: 시트가 오른쪽을 보면 True(뒤집어 왼쪽을 보게)
def grid(slug, file, cell, flip, **anims): return {'slug': slug, 'file': file, 'cell': cell, 'flip': flip, 'anims': anims}
def aseprite(slug, file, flip, **tags): return {'slug': slug, 'file': file, 'json': True, 'flip': flip, 'anims': tags}

HERO = grid('pixel-art-adventurer-sprites', 'Adventurer Sprite Sheet v1.5.png', (32, 32), False,
            idle=(0, 0, 13), slash1=(2, 0, 10), slash2=(3, 0, 10), slash3=(4, 0, 10), jump=(5, 0, 6), hurt=(6, 0, 4), down=(7, 0, 7), cast=(10, 0, 6))

# 몬스터: 시트를 보며 정한 줄(2026-10-19). 두 방향 시트(거미 · 임프 · 사이클롭스 · 미노타우로스)는 왼쪽을 보는 반을 쓴다.
# 공격 · 맞기 그림이 없는 몬스터는 그 동작을 빼 두면 장면이 코드로 내밀기 · 흰빛을 입힌다
MONSTERS = {
    'dummy': grid('2d-pixel-art-training-dummy', 'Training Dummy Sprite Sheet.png', (32, 32), False, idle=(0, 0, 1), hit=(1, 0, 5)),
    'slime': grid('2d-pixel-art-small-slime-sprites', 'Slime Sprite Sheet.png', (32, 32), True, idle=(0, 0, 4), attack=(2, 0, 7), hit=(3, 0, 4)),
    'hedgehog': grid('2d-pixel-art-hedgehog-sprites', 'Hedgehog Sprite Sheet.png', (32, 32), True, idle=(0, 0, 4), attack=(2, 0, 4)),
    'bat': grid('bat-sprite-pack', 'Bat_Sprite_Sheet.png', (16, 24), False, idle=(0, 0, 5), hit=(1, 0, 2)),
    'dragonfly': grid('2d-pixel-art-dragonfly-sprites', 'Dragonfly Sprite Sheet.png', (32, 32), True, idle=(0, 0, 4)),
    'leshy': grid('leafy-le', 'Leshy Leaf Sprite Sheet.png', (32, 32), True, idle=(0, 0, 8), attack=(2, 0, 7), hit=(4, 0, 4)),
    'twigBlight': grid('2d-pixel-art-twig-blight', 'Twig Blight Sprite Sheet.png', (32, 32), True, idle=(0, 0, 4), attack=(2, 0, 6), hit=(3, 0, 5)),
    'swampling': grid('2d-pixel-art-swampling-sprites', 'Swampling Sprite Sheet.png', (32, 32), True, idle=(0, 0, 8), attack=(2, 0, 8), hit=(3, 0, 5)),
    'crab': grid('2d-pixel-art-crab-sprites', 'Crab Sprite Sheet.png', (32, 32), True, idle=(0, 0, 4), attack=(3, 0, 4)),
    'octopus': grid('2d-pixel-art-octopus-sprites', 'Octopus Sprite Sheet.png', (32, 32), False, idle=(0, 0, 4)),
    'cobra': grid('2d-pixel-art-cobra-sprites', 'Cobra Sprite Sheet.png', (32, 32), True, idle=(0, 0, 8), attack=(2, 0, 6), hit=(3, 0, 4)),
    'giantFly': grid('2d-pixel-art-giant-fly-sprites', 'Giant Fly Sprite Sheet.png', (32, 32), False, idle=(0, 0, 4), attack=(1, 0, 4), hit=(2, 0, 4)),
    'spider': grid('2d-pixel-art-spider-sprites', 'Spider Sprite Sheet.png', (32, 32), False, idle=(0, 0, 5), attack=(2, 0, 9), hit=(5, 0, 3)),
    'worm': grid('pixel-art-worm-monster-sprites', 'Worm Sprite Sheet - Left.png', (32, 32), False, idle=(0, 0, 8), attack=(1, 0, 8), hit=(2, 0, 4)),
    'armadillo': grid('2d-pixel-art-armadillo-sprites', 'Armadillo Sprite Sheet.png', (32, 32), True, idle=(1, 0, 4), attack=(2, 0, 8), hit=(3, 0, 3)),
    'kobold': grid('2d-pixel-art-kobold-priest-sprites', 'Kobold Priest Sprite Sheet.png', (32, 32), True, idle=(0, 0, 4), attack=(2, 0, 8), hit=(3, 0, 4)),
    'ratAxe': grid('2d-pixel-art-ratfolk-axe-sprites', 'Ratfolk Axe Sprite Sheet.png', (64, 32), True, idle=(0, 0, 4), attack=(2, 0, 12), hit=(3, 0, 4)),
    'ratMage': grid('2d-pixel-art-ratfolk-mage-sprites', 'Ratfolk Mage Sprite Sheet.png', (32, 32), True, idle=(0, 0, 8), attack=(2, 0, 6), hit=(4, 0, 4)),
    'mimic': grid('2d-pixel-art-mimic-sprites', 'Mimic Sprite Sheet.png', (32, 32), False, idle=(1, 0, 4), attack=(0, 0, 4)),
    'dwarf': grid('pixel-art-dwarf-sprites', 'Dwarf Sprite Sheet 1.3v.png', (64, 32), True, idle=(0, 0, 5), attack=(2, 0, 7), hit=(6, 0, 4)),
    'miniGolem': grid('2d-pixel-art-mini-golem-sprites', 'Mini Golem Sprite Sheet.png', (32, 32), True, idle=(0, 0, 5), attack=(2, 0, 7), hit=(3, 0, 5)),
    'imp': grid('2d-pixel-art-imp-sprites', 'Imp Sprite Sheet.png', (32, 32), False, idle=(6, 0, 7), attack=(8, 0, 6), hit=(9, 0, 4)),
    'fireElemental': grid('2d-pixel-art-fire-elemental', 'Fire Elemental Sprite Sheet.png', (32, 32), True, idle=(1, 0, 6), attack=(2, 0, 8), hit=(3, 0, 6)),
    'iceElemental': grid('ice-elemental', 'Ice Elemental Sprite Sheet.png', (32, 32), False, idle=(0, 0, 6), attack=(3, 0, 8), hit=(5, 0, 3)),
    'flyingEye': grid('2d-pixel-art-flying-eye-monster', 'Eye Monster Sprite Sheet.png', (32, 32), True, idle=(0, 0, 8), attack=(2, 0, 8)),
    'flyingBrain': grid('2d-brain-monster', 'Flying Brain Monster Sprite Sheet.png', (32, 32), True, idle=(0, 0, 8), attack=(3, 0, 8), hit=(1, 0, 5)),
    'devourer': grid('intellect-devourer', 'Intellect Devourer Sprites.png', (32, 32), True, idle=(0, 0, 4), attack=(2, 0, 6), hit=(4, 0, 4)),
    'ghoul': grid('2d-pixel-art-ghoul-sprites', 'Ghoul Sprite Sheet.png', (32, 32), True, idle=(0, 0, 4), attack=(2, 0, 6), hit=(3, 0, 4)),
    'akaname': grid('2d-pixel-art-akaname', 'Akaname Sprite Sheet.png', (32, 32), True, idle=(0, 0, 5), attack=(2, 0, 8)),
    'gladiator': grid('2d-pixel-art-gladiator-sprites', 'Gladiator-Sprite Sheet-Left.png', (32, 32), False, idle=(0, 0, 5), attack=(2, 0, 7), hit=(3, 0, 3)),
    # 보스
    'goblinKing': grid('2d-pixel-art-goblin-king-sprites', 'Goblin King Sprite Sheet.png', (64, 64), True, idle=(0, 0, 4), attack=(10, 0, 7), hit=(6, 0, 4)),
    'witch': grid('2d-pixel-art-witch-sprites', 'Witch Sprite Sheet.png', (32, 32), True, idle=(0, 0, 4), attack=(2, 0, 8), hit=(3, 0, 4)),
    'moleMonarch': grid('2d-pixel-art-brain-mole-monarch-sprites', 'Brain Mole Monarch Sprite Sheet.png', (32, 32), True, idle=(0, 0, 4), attack=(1, 0, 4), hit=(2, 0, 4)),
    'cyclops': grid('2d-pixel-art-cyclops-sprites', 'Cyclops Sprite Sheet.png', (64, 64), False, idle=(10, 0, 15), attack=(13, 0, 13), hit=(14, 0, 3)),
    'necromancer': grid('2d-pixel-art-bandit-necromancer-sprites', 'Bandit Necromancer Sprite Sheet.png', (32, 32), True, idle=(0, 0, 8), attack=(2, 0, 8), hit=(4, 0, 4)),
    'minotaur': grid('2d-pixel-art-minotaur-sprites', 'Minotaur - Sprite Sheet.png', (96, 96), False, idle=(10, 0, 5), attack=(13, 0, 9), hit=(17, 0, 3)),
    'cacodaemon': grid('2d-pixel-art-cacodaemon-sprites', 'Cacodaemon Sprite Sheet.png', (64, 64), True, idle=(0, 0, 6), attack=(1, 0, 6), hit=(2, 0, 4)),
    'phoenixling': grid('2d-pixel-art-phoenixling-sprites', 'Phoenixling Sprite Sheet.png', (64, 64), False, idle=(0, 0, 4), attack=(2, 0, 8), hit=(3, 0, 4), revive=(5, 0, 9)),
    'incubus': grid('2d-pixel-art-incubus-sprites', 'Incubus Sprite Sheet.png', (96, 64), True, idle=(0, 0, 8), attack=(2, 0, 8), hit=(3, 0, 5)),
    'shardsoul': grid('2d-pixel-art-shardsoul-slayer-sprites', 'Shardsoul Slayer Sprite Sheet.png', (64, 64), True, idle=(0, 0, 8), attack=(2, 0, 5), hit=(3, 0, 4)),
}


# ---------- 자르기 · 묶기 ----------
def frames_of(spec, root, sheets):
    path = os.path.join(root, spec['slug'], spec['file'])
    rows = sheets.setdefault(path, None) or decode(path)
    sheets[path] = rows
    out = {}
    if spec.get('json'):
        meta = json.load(open(path[:-4] + '.json', encoding='utf-8'))
        fr = meta['frames']
        rects = [f['frame'] for f in (fr.values() if isinstance(fr, dict) else fr)]
        tags = {t['name']: (t['from'], t['to']) for t in meta['meta']['frameTags']}
        for anim, tag in spec['anims'].items():
            a, b = tags[tag]
            out[anim] = [[r[x['x']:x['x'] + x['w']] for r in rows[x['y']:x['y'] + x['h']]] for x in rects[a:b + 1]]
    else:
        cw, ch = spec['cell']
        for anim, (row, first, count) in spec['anims'].items():
            out[anim] = [[r[(first + k) * cw:(first + k + 1) * cw] for r in rows[row * ch:(row + 1) * ch]] for k in range(count)]
    return out


def pick(frames, cap):
    if len(frames) <= cap: return frames
    return [frames[round(i * (len(frames) - 1) / (cap - 1))] for i in range(cap)] if cap > 1 else [frames[len(frames) // 2]]


def pack_sprite(anims, flip):
    allf = [f for fs in anims.values() for f in fs]
    pts = [(x, y) for f in allf for y, r in enumerate(f) for x, v in enumerate(r) if v is not None]
    assert pts, '빈 스프라이트'
    x0, x1 = min(p[0] for p in pts), max(p[0] for p in pts)
    y0, y1 = min(p[1] for p in pts), max(p[1] for p in pts)
    colors, palette = {}, {}
    out = {}
    for name, fs in anims.items():
        grids = []
        for f in fs:
            rows = []
            for y in range(y0, y1 + 1):
                r = f[y][x0:x1 + 1]
                if flip: r = list(reversed(r))
                line = ''
                for v in r:
                    if v is None: line += '.'; continue
                    if v not in colors:
                        assert len(colors) < len(ALPHABET), '색이 62개를 넘는다'
                        colors[v] = ALPHABET[len(colors)]
                        palette[colors[v]] = v
                    line += colors[v]
                rows.append(line)
            grids.append(rows)
        out[name] = grids
    return {'palette': palette, 'anims': out}


def build(root):
    sheets = {}
    hero = pack_sprite(frames_of(HERO, root, sheets), HERO['flip'])
    monsters = {}
    for mid, spec in MONSTERS.items():
        anims = {k: pick(v, CAP.get(k, 3)) for k, v in frames_of(spec, root, sheets).items()}
        monsters[mid] = pack_sprite(anims, spec['flip'])
    return {'version': 1, 'hero': hero, 'monsters': monsters}


# ---------- 확인 ----------
def check(root):
    sheets, bad = {}, []
    for mid, spec in [('hero', HERO)] + list(MONSTERS.items()):
        try:
            for anim, fs in frames_of(spec, root, sheets).items():
                if not fs or any(all(v is None for r in f for v in r) for f in fs): bad.append(f'{mid}.{anim}: 빈 프레임')
        except Exception as e:  # 파일 · 줄 · 칸이 시트 밖
            bad.append(f'{mid}: {e!r}')
    for b in bad: print(b)
    print('ok' if not bad else 'bad', 1 + len(MONSTERS))
    return not bad


def preview(root, out, per=14):
    """스프라이트마다 동작별 가운데 한 장을 3배로 늘어놓은 확인 그림 — per 개씩 나눠 out_1.png, out_2.png … 에"""
    p = build(root)
    sprites = [('hero', p['hero'])] + list(p['monsters'].items())
    k, gap = 3, 6
    for part in range(0, len(sprites), per):
        rows = [[(s['palette'], fs[len(fs) // 2]) for fs in s['anims'].values()] for _, s in sprites[part:part + per]]
        W = max(sum(len(g[0]) * k + gap for _, g in r) for r in rows) + gap
        H = sum(max(len(g) for _, g in r) * k + gap for r in rows) + gap
        px = [(40, 44, 54)] * (W * H)
        y = gap
        for r in rows:
            x, hmax = gap, max(len(g) for _, g in r)
            for pal, g in r:
                top = y + (hmax - len(g)) * k
                for gy, line in enumerate(g):
                    for gx, ch in enumerate(line):
                        if ch == '.': continue
                        v = pal[ch]
                        for dy in range(k):
                            base = (top + gy * k + dy) * W + x + gx * k
                            for dx in range(k): px[base + dx] = ((v >> 16) & 255, (v >> 8) & 255, v & 255)
                x += len(g[0]) * k + gap
            y += hmax * k + gap
        name = f'{out[:-4]}_{part // per + 1}.png'
        write_png(name, px, W, H)
        print('preview', name, W, H, [n for n, _ in sprites[part:part + per]])


def sheet(path, cw, ch, out, k=2):
    rows = decode(path)
    h, w = len(rows), len(rows[0])
    W, H = w * k, h * k
    px = []
    for y in range(H):
        for x in range(W):
            sx, sy = x // k, y // k
            if (sx % cw == 0 and x % k == 0) or (sy % ch == 0 and y % k == 0): px.append((200, 40, 40)); continue
            v = rows[sy][sx]
            px.append((60, 64, 74) if v is None else ((v >> 16) & 255, (v >> 8) & 255, v & 255))
    write_png(out, px, W, H)
    print('sheet', out, f'{w}x{h}', f'{w // cw} cols x {h // ch} rows')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'check': sys.exit(0 if check(os.path.expanduser(sys.argv[2])) else 1)
    elif cmd == 'build':
        data = json.dumps(build(os.path.expanduser(sys.argv[2])), separators=(',', ':'), ensure_ascii=False)
        open(os.path.expanduser(sys.argv[3]), 'w', encoding='utf-8').write(data)
        print('written', sys.argv[3], len(data), 'bytes')
    elif cmd == 'preview': preview(os.path.expanduser(sys.argv[2]), sys.argv[3])
    elif cmd == 'sheet': sheet(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5])
    else: print(__doc__)
