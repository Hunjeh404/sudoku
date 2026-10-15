"""평면 조각 그림(assets-src/tiles-v1)을 쿼터뷰로 기울여 실내·정원 배경을 조립한다.
python3 -I scripts/compose-env.py → public/assets/env/{room_base,garden_base}.webp, src/data/calibration.json environments
- 바닥 한 칸은 화면에서 정사각 마름모(가로 t, 기울기 0.65). 가구 그림과 같은 각도라 선이 맞는다.
- 세로 1칸 = 바닥 모서리 길이(V)라서 정면 조각의 칸이 화면에서도 정사각으로 보인다.
- 2배 크기로 그린 뒤 줄여 가장자리를 부드럽게 한다."""
import json, os, random
import numpy as np
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T_DIR = os.path.join(ROOT, 'assets-src', 'tiles-v1', 'images', 'tiles')
CAN, SS = 1254, 2
COLS, ROWS, SLOPE = 12, 10, 0.65
t = 48.0                                   # 한 칸 가로(1배 기준)
V = t * (1 + SLOPE ** 2) ** 0.5            # 세로 1칸
WALL = 6 * V; CAP = 0.45 * V; THICK = 0.8 * V
B0 = (CAN / 2 - t, 0)                      # 뒤 꼭짓점 x(좌우 기둥 포함 가운데 맞춤), y는 아래에서 정함
top_extent = WALL + 0.12 * V
bottom_extent = (COLS + ROWS) * SLOPE * t + THICK
by = (CAN - (top_extent + bottom_extent)) / 2 + top_extent
BACK = (CAN / 2 - (COLS - ROWS) * t / 2 - 0 * t, by)
ink = (74, 58, 46, 255)

def P(u, v, h=0.0):  # 바닥 (u,v), 높이 h(px, 위로) → 2배 화면 좌표
    return ((BACK[0] + (u - v) * t) * SS, (BACK[1] + (u + v) * SLOPE * t - h) * SS)
def vec(du, dv): return (( du - dv) * t * SS, (du + dv) * SLOPE * t * SS)
def load(n): return Image.open(os.path.join(T_DIR, n + '.png')).convert('RGBA')

def warp(canvas, tex, O, A, B, shade=1.0):
    """tex 왼쪽 위 → O, 가로 끝 → O+A, 세로 끝 → O+B 로 붙인다."""
    W, H = tex.size
    if shade != 1.0:
        arr = np.asarray(tex).astype(np.float32); arr[..., :3] *= shade
        tex = Image.fromarray(arr.clip(0, 255).astype(np.uint8), 'RGBA')
    m = np.array([[A[0] / W, B[0] / H], [A[1] / W, B[1] / H]]); mi = np.linalg.inv(m)
    a, b = mi[0]; d, e = mi[1]
    c = -(a * O[0] + b * O[1]); f = -(d * O[0] + e * O[1])
    layer = tex.transform(canvas.size, Image.AFFINE, (a, b, c, d, e, f), resample=Image.BICUBIC, fillcolor=(0, 0, 0, 0))
    canvas.alpha_composite(layer)

def tiled(tex, cell_px, cells_w, cells_h, tile_cells, rnd=None, variants=None):
    """같은 조각(또는 여러 변형)을 칸 단위로 이어 붙인 평면 그림"""
    tw, th = tile_cells
    out = Image.new('RGBA', (int(round(cells_w * cell_px)), int(round(cells_h * cell_px))))
    pw, ph = int(round(tw * cell_px)), int(round(th * cell_px))
    y = 0
    while y < out.height:
        x = 0
        while x < out.width:
            im = (rnd.choice(variants) if variants else tex)
            if rnd and variants: im = im.rotate(rnd.choice([0, 90, 180, 270]))
            out.paste(im.resize((pw, ph), Image.LANCZOS), (x, y)); x += pw
        y += ph
    return out

def ao(flat, cell_px, strength=0.2, reach=0.9):
    """뒤쪽 두 벽(위·왼쪽 변) 근처를 살짝 어둡게"""
    a = np.asarray(flat).astype(np.float32); h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w] / cell_px
    k = 1 - strength * (np.exp(-yy / reach) + np.exp(-xx / reach)).clip(0, 1)
    a[..., :3] *= k[..., None]
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')

def edge_faces(canvas, tex):
    """바닥판 앞쪽 두 면(두께 THICK). 조각 비율 그대로 이어 붙인다."""
    th = THICK * SS; per = tex.width / tex.height * THICK / V  # 조각 한 장이 덮는 칸 수
    for (O, A, n, shade) in [(P(0, ROWS), vec(COLS, 0), COLS, 1.0), (P(COLS, ROWS), vec(0, -ROWS), ROWS, 0.84)]:
        strip = tiled(tex, 128, n, THICK / V, (per, THICK / V))
        warp(canvas, strip, O, A, (0, th), shade)

def pillar_strip(height_cells):
    cap = load('pillar_capital').resize((256, 256), Image.LANCZOS)
    base = load('pillar_base').resize((256, 256), Image.LANCZOS)
    hpx = int(round(height_cells * 256))
    out = Image.new('RGBA', (256, hpx))
    mid = cap.crop((0, 236, 256, 252)).resize((256, max(1, hpx - 512)), Image.BICUBIC)
    out.paste(cap, (0, 0)); out.paste(mid, (0, 256)); out.paste(base, (0, hpx - 256))
    return out

def box(canvas, u0, u1, v0, v1, h_top, h_bot, strip, cap_color):
    """기둥: 앞 두 면 + 윗면. h_top/h_bot은 바닥 기준 높이(px, 1배)"""
    hh = (h_top - h_bot) * SS
    warp(canvas, strip, P(u0, v1, h_top), vec(u1 - u0, 0), (0, hh), 1.0)
    warp(canvas, strip, P(u1, v1, h_top), vec(0, -(v1 - v0)), (0, hh), 0.84)
    d = ImageDraw.Draw(canvas)
    pts = [P(u0, v0, h_top), P(u1, v0, h_top), P(u1, v1, h_top), P(u0, v1, h_top)]
    d.polygon(pts, fill=cap_color, outline=ink, width=2 * SS)

def mean_color(im, box_):
    a = np.asarray(im.crop(box_).convert('RGB')).reshape(-1, 3).mean(0)
    return tuple(int(x) for x in a) + (255,)

def room():
    rnd = random.Random(7)
    can = Image.new('RGBA', (CAN * SS, CAN * SS))
    # 벽(뒤 두 면)
    wall = load('wall_section')
    for (A, n, shade) in [(vec(COLS, 0), COLS, 1.0), (vec(0, ROWS), ROWS, 0.9)]:
        strip = tiled(wall, 128, n, 6, (4, 6))
        warp(can, strip, P(0, 0, WALL), A, (0, WALL * SS), shade)
    # 뒤 모서리 기둥: 반씩 두 벽에 접어 붙인 벽기둥
    ps = pillar_strip(6)
    half = 0.5
    warp(can, ps.crop((128, 0, 256, ps.height)), P(0, 0, WALL), vec(half, 0), (0, WALL * SS), 1.0)
    warp(can, ps.crop((0, 0, 128, ps.height)).transpose(Image.FLIP_LEFT_RIGHT), P(0, 0, WALL), vec(0, half), (0, WALL * SS), 0.9)
    d = ImageDraw.Draw(can)
    d.line([P(0, 0, WALL), P(0, 0, 0)], fill=ink, width=SS)
    # 벽 윗면(두께)
    capc = mean_color(wall, (0, 0, 1024, 30))
    k = 0.3
    d.polygon([P(-k, ROWS, WALL), P(-k, -k, WALL), P(COLS, -k, WALL), P(COLS, 0, WALL), P(0, 0, WALL), P(0, ROWS, WALL)], fill=capc, outline=ink, width=SS * 2)
    # 바닥
    slabs = [load(f'floor_slab_{c}') for c in 'abc']
    flat = ao(tiled(None, 128, COLS, ROWS, (2, 2), rnd, slabs), 128)
    warp(can, flat, P(0, 0), vec(COLS, 0), vec(0, ROWS))
    d.line([P(0, 0), P(COLS, 0)], fill=ink, width=SS * 2); d.line([P(0, 0), P(0, ROWS)], fill=ink, width=SS * 2)
    # 바닥판 앞 두께
    edge_faces(can, load('floor_edge'))
    # 양 끝 기둥(바닥판 아래까지)
    hcells = (WALL + CAP + THICK) / V
    strip = pillar_strip(hcells)
    capc2 = mean_color(load('pillar_capital'), (0, 0, 1254, 120))
    box(can, -0.6, 0.4, ROWS, ROWS + 1, WALL + CAP, -THICK, strip, capc2)
    box(can, COLS, COLS + 1, -0.6, 0.4, WALL + CAP, -THICK, strip, capc2)
    return can

def garden():
    rnd = random.Random(3)
    can = Image.new('RGBA', (CAN * SS, CAN * SS))
    fence = load('garden_fence')
    bb = fence.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    fence = fence.crop(bb)
    fh_cells = 4 * fence.height / fence.width   # 4칸 폭 기준 높이
    fh = fh_cells * V
    for (A, n, shade) in [(vec(COLS, 0), COLS, 1.0), (vec(0, ROWS), ROWS, 0.9)]:
        strip = tiled(fence, 128, n, fh_cells, (4, fh_cells))
        warp(can, strip, P(0, 0, fh), A, (0, fh * SS), shade)
    grass = load('grass')
    flat = ao(tiled(grass, 128, COLS, ROWS, (2, 2)), 128, strength=0.12)
    # 울타리 앞에 바닥을 깔면 울타리 아랫부분이 가려지므로 바닥 먼저 → 울타리 순서로 다시
    can2 = Image.new('RGBA', can.size)
    warp(can2, flat, P(0, 0), vec(COLS, 0), vec(0, ROWS))
    edge_faces(can2, load('garden_edge'))
    can2.alpha_composite(can)
    return can2

out_env = os.path.join(ROOT, 'public', 'assets', 'env')
for name, fn in [('room_base', room), ('garden_base', garden)]:
    im = fn().resize((CAN, CAN), Image.LANCZOS)
    im.save(os.path.join(out_env, name + '.webp'), 'WEBP', quality=86, method=6)
    im.save(os.path.join(ROOT, 'assets-src', 'tiles-v1', name + '.png'))
cal_p = os.path.join(ROOT, 'src', 'data', 'calibration.json')
cal = json.load(open(cal_p))
corners = [[round(c / SS, 1) for c in P(u, v)] for (u, v) in [(0, 0), (COLS, 0), (COLS, ROWS), (0, ROWS)]]
for name in ('room_base', 'garden_base'):
    cal['environments'][name] = {'floorCornersPx': corners, 'image': f'assets-src/tiles-v1/{name}.png', 'note': 'scripts/compose-env.py로 조각을 조립한 배경. 바닥 칸은 화면에서 정사각 마름모.'}
json.dump(cal, open(cal_p, 'w'), ensure_ascii=False, indent=1)
print('corners', corners, 't', t, 'V', round(V, 1))
