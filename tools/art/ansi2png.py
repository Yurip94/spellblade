# tmux capture-pane -e 결과(ANSI)를 PNG 로 — 터미널에서 도트가 실제로 어떻게 보이는지 확인용
#   python3 tools/art/ansi2png.py <입력.ans> <출력.png>
# ▀ ▄ █ 와 공백만 칸 색으로 그리고, 나머지 글자는 회색 점으로 표시한다(글자 모양은 그리지 않음).
import re, struct, sys, zlib

def xterm256(n):
    if n < 16:
        base = [(0,0,0),(205,0,0),(0,205,0),(205,205,0),(0,0,238),(205,0,205),(0,205,205),(229,229,229),
                (127,127,127),(255,0,0),(0,255,0),(255,255,0),(92,92,255),(255,0,255),(0,255,255),(255,255,255)]
        return base[n]
    if n < 232:
        n -= 16; r, g, b = n // 36, (n // 6) % 6, n % 6
        f = lambda v: 0 if v == 0 else 55 + v * 40
        return (f(r), f(g), f(b))
    v = 8 + (n - 232) * 10
    return (v, v, v)

BG = (30, 30, 36)
SGR = re.compile(r'\x1b\[([0-9;:]*)m')

def parse(line):
    cells = []; fg = None; bg = None; i = 0
    while i < len(line):
        m = SGR.match(line, i)
        if m:
            parts = [p for p in re.split('[;:]', m.group(1)) if p != ''] or ['0']
            j = 0
            while j < len(parts):
                p = int(parts[j])
                if p == 0: fg = bg = None
                elif p in (38, 48) and j + 2 < len(parts) and parts[j + 1] == '5':
                    c = xterm256(int(parts[j + 2])); fg, bg = (c, bg) if p == 38 else (fg, c); j += 2
                elif p in (38, 48) and j + 4 < len(parts) and parts[j + 1] == '2':
                    c = tuple(int(x) for x in parts[j + 2:j + 5]); fg, bg = (c, bg) if p == 38 else (fg, c); j += 4
                elif p == 39: fg = None
                elif p == 49: bg = None
                elif 30 <= p <= 37: fg = xterm256(p - 30)
                elif 40 <= p <= 47: bg = xterm256(p - 40)
                elif 90 <= p <= 97: fg = xterm256(p - 90 + 8)
                j += 1
            i = m.end(); continue
        cells.append((line[i], fg, bg)); i += 1
    return cells

def main(src, dst, sx=6, sy=6):
    lines = open(src, encoding='utf-8', errors='replace').read().split('\n')
    grid = [parse(l) for l in lines]
    w = max(len(r) for r in grid); h = len(grid)
    W, H = w * sx, h * sy * 2 // 2
    px = [BG] * (w * sx * h * sy)
    def put(x, y, half, col):
        y0 = y * sy + (0 if half == 0 else sy // 2); y1 = y0 + (sy // 2 if half in (0, 1) else sy)
        if half == 2: y0, y1 = y * sy, y * sy + sy
        for yy in range(y0, y1):
            for xx in range(x * sx, x * sx + sx): px[yy * w * sx + xx] = col
    for y, row in enumerate(grid):
        for x, (ch, fg, bg) in enumerate(row):
            if bg: put(x, y, 2, bg)
            if ch == '▀' and fg: put(x, y, 0, fg)
            elif ch == '▄' and fg: put(x, y, 1, fg)
            elif ch == '█' and fg: put(x, y, 2, fg)
            elif ch.strip() and ch not in '▀▄█':
                c = fg or (150, 150, 160)
                for yy in range(y * sy + 2, y * sy + sy - 2):
                    for xx in range(x * sx + 2, x * sx + sx - 2): px[yy * w * sx + xx] = tuple(v // 2 + 40 for v in c)
    raw = b''.join(b'\x00' + bytes(sum(([*p] for p in px[r * w * sx:(r + 1) * w * sx]), [])) for r in range(h * sy))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(dst, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w * sx, h * sy, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
