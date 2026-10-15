"""가구 재생성용 각도·발자국 기준 그림. 배경과 같은 기울기 0.65(약 33°)의 격자 위에
게임 발자국(카탈로그 fw×fh)을 빨간 마름모로, 세로 모서리를 파란 점선으로 그린다.
결과: assets-src/guides/<id>.png + guide-spec.json(앞 꼭짓점 좌표·칸 크기 → 게임 배치에 그대로 사용)
python3 -I scripts/make-guides.py '<footprints json>'"""
import json, math, os, sys
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets-src', 'guides')
S = 0.65; W = 1254; FRONT_Y = 1130
items = json.loads(sys.argv[1])  # {id: [fw, fh, surface]}
spec = {'slope': S, 'canvas': W, 'items': {}}
for iid, (fw, fh, surface) in items.items():
    if surface in ('artifact', 'supportSlot') and iid != 'picture_frame':
        continue
    wall = surface == 'wallRight'
    span = fw if wall else fw + fh
    a = min(170.0, 0.70 * W / span)
    u = (a, S * a); v = (-a, S * a)
    if wall:
        B = (W / 2 - a * fw / 2, FRONT_Y - S * a * fw)
        corners = [B, (B[0] + fw * u[0], B[1] + fw * u[1])]
        front = corners[1]
    else:
        B = (W / 2 - a * (fw - fh) / 2, FRONT_Y - S * a * (fw + fh))
        R = (B[0] + fw * u[0], B[1] + fw * u[1]); L = (B[0] + fh * v[0], B[1] + fh * v[1])
        F = (R[0] + fh * v[0], R[1] + fh * v[1])
        corners = [B, R, F, L]; front = F
    im = Image.new('RGB', (W, W), 'white'); d = ImageDraw.Draw(im, 'RGBA')
    # 같은 각도의 옅은 격자(칸 크기 a)
    for k in range(-40, 41):
        x0 = B[0] + k * a
        d.line([(x0 - 2000, B[1] - 2000 * S), (x0 + 2000, B[1] + 2000 * S)], fill=(205, 205, 215, 255), width=1)
        d.line([(x0 + 2000, B[1] - 2000 * S), (x0 - 2000, B[1] + 2000 * S)], fill=(205, 205, 215, 255), width=1)
    if wall:
        H = 820
        top = [(p[0], p[1] - H) for p in corners]
        d.polygon([corners[0], corners[1], top[1], top[0]], fill=(120, 160, 230, 50), outline=(60, 110, 220, 255))
        d.line(corners, fill=(220, 40, 40, 255), width=7)
    else:
        d.polygon(corners, fill=(230, 60, 60, 60), outline=(220, 40, 40, 255))
        d.line(corners + [corners[0]], fill=(220, 40, 40, 255), width=6)
        if surface not in ('rug',) and iid not in ('stepping_stones',):
            for p in (corners[1], corners[2], corners[3]):
                for yy in range(0, 520, 28):
                    d.line([(p[0], p[1] - yy), (p[0], p[1] - yy - 14)], fill=(50, 100, 220, 255), width=3)
    im.save(os.path.join(OUT, f'{iid}.png'))
    spec['items'][iid] = {'footprint': [fw, fh], 'surface': surface, 'tilePx': round(a, 2),
                          'frontPx': [round(front[0], 1), round(front[1], 1)], 'cornersPx': [[round(c[0], 1), round(c[1], 1)] for c in corners]}
json.dump(spec, open(os.path.join(OUT, 'guide-spec.json'), 'w'), indent=1)
print(len(spec['items']), 'guides')
