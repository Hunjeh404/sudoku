"""가구 그림의 접지점과 윗면 높이 측정 → src/data/calibration.json items.*.ground / topLift
접지점: 그림에서 가장 낮은 점(발자국 앞 꼭짓점이 닿는 곳). 정사각 발자국은 가로 가운데를 쓴다.
윗면 높이: 접지점 바로 위 세로줄에서 가장 위 픽셀까지(상자 모양이면 윗면 앞 꼭짓점). 쌓기에 쓴다.
python3 -I scripts/gen-ground-anchors.py"""
import json, os, sys
import numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
man = json.load(open(os.path.join(ROOT, 'assets-src/quarterview-v1/asset-manifest.json')))
cal_p = os.path.join(ROOT, 'src/data/calibration.json')
cal = json.load(open(cal_p))
# 발자국(카탈로그와 같아야 함)
FOOT = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
for a in man['assets']:
    if a['kind'] != 'furniture':
        continue
    al = np.asarray(Image.open(os.path.join(ROOT, 'assets-src/quarterview-v1', a['file'])).getchannel('A')) >= 128
    ys, xs = np.nonzero(al)
    bottom = ys.max()
    low_x = float(xs[ys >= bottom - 4].mean())
    x0, x1, top = xs.min(), xs.max(), ys.min()
    fw, fh = FOOT.get(a['id'], (1, 1))
    wall = a['placement']['surface'].startswith('wall')
    gx = low_x if (fw != fh or wall) else (x0 + x1) / 2
    gxi = int(round(gx))
    colmask = al[:, max(0, gxi - 6):gxi + 7].any(axis=1)
    col_top = int(np.nonzero(colmask)[0].min())
    item = cal['items'].setdefault(a['id'], {})
    item['ground'] = {'x': round(gx, 1), 'y': int(bottom)}
    item.setdefault('topLift', 0)  # 윗면 높이는 눈 보정값을 유지
json.dump(cal, open(cal_p, 'w'), ensure_ascii=False, indent=1)
print('ok')
