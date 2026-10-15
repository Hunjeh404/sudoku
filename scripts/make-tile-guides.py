"""집 바닥·벽·기둥·정원 조각 그림의 기준 그림과 규격.
조각은 모두 정면(벽·기둥·턱·울타리) 또는 위에서 내려다본(바닥·잔디) 평평한 그림으로 받고,
게임 각도(기울기 0.65)로 기울이는 일은 코드가 한다. 그래서 각도가 어긋날 일이 없다.
python3 -I scripts/make-tile-guides.py → assets-src/tiles/guides/*.png, assets-src/tiles/tile-spec.json"""
import json, os
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets-src', 'tiles')
GRID = (200, 200, 200, 255)
ZONE = {'gold': (240, 200, 90, 90), 'blue': (120, 170, 230, 70), 'green': (120, 200, 140, 70), 'rose': (235, 130, 150, 80), 'grey': (160, 160, 160, 60)}
SEAM = (220, 0, 160, 255)
# id: 캔버스, 칸 크기(px), 가로 이음(좌우 끝이 이어짐), 세로 이음, 구역[(색, y0, y1)], 투명 배경 여부
PIECES = {
    'floor_slab_a':  dict(size=(1024, 1024), cell=512, seamX=False, seamY=False, zones=[('rose', 'border', 28)], alpha=False, cells=(2, 2)),
    'floor_slab_b':  dict(size=(1024, 1024), cell=512, seamX=False, seamY=False, zones=[('rose', 'border', 28)], alpha=False, cells=(2, 2)),
    'floor_slab_c':  dict(size=(1024, 1024), cell=512, seamX=False, seamY=False, zones=[('rose', 'border', 28)], alpha=False, cells=(2, 2)),
    'wall_section':  dict(size=(1024, 1536), cell=256, seamX=True, seamY=False, zones=[('gold', 0, 56), ('blue', 56, 256), ('grey', 256, 1408), ('green', 1408, 1536)], alpha=False, cells=(4, 6)),
    'pillar_capital': dict(size=(512, 512), cell=512, seamX=False, seamY=False, zones=[], alpha=False, cells=(1, 1)),
    'pillar_shaft':  dict(size=(512, 1024), cell=512, seamX=False, seamY=True, zones=[], alpha=False, cells=(1, 2)),
    'pillar_base':   dict(size=(512, 512), cell=512, seamX=False, seamY=False, zones=[], alpha=False, cells=(1, 1)),
    'floor_edge':    dict(size=(2048, 512), cell=512, seamX=True, seamY=False, zones=[('rose', 'vlines', [1024])], alpha=False, cells=(4, 1)),
    'grass':         dict(size=(1024, 1024), cell=512, seamX=True, seamY=True, zones=[], alpha=False, cells=(2, 2)),
    'garden_edge':   dict(size=(2048, 512), cell=512, seamX=True, seamY=False, zones=[('green', 0, 72)], alpha=False, cells=(4, 1)),
    'garden_fence':  dict(size=(2048, 1024), cell=512, seamX=True, seamY=False, zones=[('blue', 'posts', [512, 1536])], alpha=True, cells=(4, 2)),
}
spec = {'slope': 0.65, 'note': '조각은 평면 그림. cells=그림 한 장이 덮는 칸 수(가로, 세로). 벽 높이 6칸, 기둥 1칸 폭.', 'pieces': {}}
for pid, p in PIECES.items():
    W, H = p['size']
    im = Image.new('RGBA', (W, H), (255, 255, 255, 255)); d = ImageDraw.Draw(im)
    for x in range(0, W + 1, p['cell']): d.line([(x, 0), (x, H)], fill=GRID, width=3)
    for y in range(0, H + 1, p['cell']): d.line([(0, y), (W, y)], fill=GRID, width=3)
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); o = ImageDraw.Draw(ov)
    for z in p['zones']:
        col = ZONE[z[0]]
        if z[1] == 'border':
            b = z[2]; o.rectangle([0, 0, W, H], fill=col); o.rectangle([b, b, W - b, H - b], fill=(0, 0, 0, 0))
        elif z[1] == 'vlines':
            for x in z[2]: o.rectangle([x - 14, 0, x + 14, H], fill=col)
        elif z[1] == 'posts':
            for x in z[2]: o.rectangle([x - 70, 120, x + 70, H], fill=col)
            o.rectangle([0, 200, W, 260], fill=ZONE['gold']); o.rectangle([0, H - 140, W, H], fill=ZONE['gold'])
        else:
            o.rectangle([0, z[1], W, z[2]], fill=col)
    im.alpha_composite(ov); d = ImageDraw.Draw(im)
    if p['seamX']:
        d.rectangle([0, 0, 10, H], fill=SEAM); d.rectangle([W - 11, 0, W, H], fill=SEAM)
    if p['seamY']:
        d.rectangle([0, 0, W, 10], fill=SEAM); d.rectangle([0, H - 11, W, H], fill=SEAM)
    im.convert('RGB').save(os.path.join(OUT, 'guides', pid + '.png'))
    spec['pieces'][pid] = {k: p[k] for k in ('size', 'cell', 'cells', 'seamX', 'seamY', 'alpha')}
json.dump(spec, open(os.path.join(OUT, 'tile-spec.json'), 'w'), ensure_ascii=False, indent=1)
print('guides', len(PIECES))
