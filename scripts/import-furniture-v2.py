"""새 가구 그림(olympus-furniture-ui-26) 들여오기.
python3 -I scripts/import-furniture-v2.py <압축 푼 olympus-furniture-ui-26 경로>
- 원본 PNG는 assets-src/furniture-v2/에 그대로 보존(월계수 벤치만 긴 축이 발자국과 반대라 좌우 뒤집은 파생본을 assets-src/derived/에 둔다).
- 게임용 WebP(긴 변 512)를 public/assets/furniture/에 만든다.
- 그림마다 실제로 보이는 범위를 재서 calibration.json items.*에 기록한다.
  bounds: 보이는 범위(알파 128 이상), fitW: 발자국 가로 폭에 맞출 그림 폭,
  ground: 접지점(바닥 가구는 x=보이는 범위 가운데 → 발자국 좌우 가운데, y=가장 낮은 점 → 발자국 앞 꼭짓점. 벽 장식은 가장 낮은 점), topLift: 쌓을 때 윗면 앞 꼭짓점 높이.
  가이드 좌표(guide-spec.json)는 목표값일 뿐 그림이 거기에 맞춰져 있지 않아 쓰지 않는다.
"""
import json, os, shutil, sys
import numpy as np
from PIL import Image
PACK = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST = os.path.join(ROOT, 'assets-src', 'furniture-v2')
MIRROR = set()
FOOT = {  # src/data/catalog.ts와 같아야 함 [fw, fh, wall]
    'cloud_bed': (3, 2, 0), 'cloud_cushion': (1, 1, 0), 'display_pedestal': (1, 1, 0), 'garden_trellis': (3, 1, 0),
    'laurel_bench': (1, 3, 0), 'laurel_door': (2, 1, 1), 'laurel_rug': (3, 2, 0), 'linen_curtain': (2, 1, 1),
    'music_stand': (1, 1, 0), 'olive_planter': (1, 1, 0), 'owl_mailbox': (1, 1, 0), 'picture_frame': (1, 1, 0),
    'round_stool': (1, 1, 0), 'scroll_bookcase': (2, 1, 0), 'shell_fountain': (3, 3, 0), 'star_lantern': (1, 1, 0),
    'star_mobile': (1, 1, 0), 'stepping_stones': (3, 1, 0), 'tea_table': (2, 2, 0), 'treasure_chest': (2, 1, 0),
}
if not os.path.exists(DST):
    shutil.copytree(PACK, DST)
cal_p = os.path.join(ROOT, 'src/data/calibration.json')
cal = json.load(open(cal_p))
for iid, (fw, fh, wall) in FOOT.items():
    src = os.path.join(DST, 'images', 'furniture', iid + '.png')
    im = Image.open(src).convert('RGBA')
    if iid in MIRROR:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
        im.save(os.path.join(ROOT, 'assets-src', 'derived', iid + '_mirrored.png'))
    assert im.size == (1254, 1254), (iid, im.size)
    al = np.asarray(im.getchannel('A')) >= 128
    ys, xs = np.nonzero(al)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    W = x1 - x0 + 1
    low_x = float(xs[ys >= y1 - 4].mean())
    gx = low_x if wall else (x0 + x1) / 2
    gxi = int(round(gx))
    col_top = int(np.nonzero(al[:, max(0, gxi - 6):gxi + 7].any(axis=1))[0].min())
    top_face = 0 if wall else 1.3 * W * min(fw, fh) / (fw + fh)  # 앞 꼭짓점 위쪽으로 보이는 윗면 깊이
    it = cal['items'].setdefault(iid, {})
    keep = {k: it[k] for k in ('scale', 'dx', 'dy', 'slot', 'topLift', 'topLiftByEye') if k in it and 'fitW' in it}  # 다시 돌릴 때 눈 보정값 유지
    it.clear(); it.update(keep)
    it['bounds'] = {'x': x0, 'y': y0, 'w': W, 'h': y1 - y0 + 1}
    it['fitW'] = W
    it['ground'] = {'x': round(gx, 1), 'y': y1}
    if not it.get('topLiftByEye'):
        it['topLift'] = max(0, int(round(y1 - col_top - top_face)))
    im.thumbnail((512, 512), Image.LANCZOS)
    im.save(os.path.join(ROOT, 'public', 'assets', 'furniture', iid + '.webp'), 'WEBP', quality=84, method=6)
json.dump(cal, open(cal_p, 'w'), ensure_ascii=False, indent=1)
print('ok', len(FOOT))
