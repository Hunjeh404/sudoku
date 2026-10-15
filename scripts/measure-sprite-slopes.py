"""가구 그림의 바닥 쪽 볼록 껍질에서 접지 모서리 기울기 측정(왼쪽: 가장 낮은 점→왼쪽 끝, 오른쪽: 가장 낮은 점→오른쪽 끝)."""
import json, os, sys
import numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def bottom_chain(pts):
    # 이미지 좌표(y 아래로 증가)에서 아래쪽 볼록 껍질
    pts = sorted(set(pts)); h = []
    for p in pts:
        while len(h) >= 2:
            o, a = h[-2], h[-1]
            cross = (a[0] - o[0]) * (p[1] - o[1]) - (a[1] - o[1]) * (p[0] - o[0])
            if cross >= 0: h.pop()
            else: break
        h.append(p)
    return h
def measure(path):
    al = np.asarray(Image.open(path).getchannel('A')) >= 128
    cols = np.where(al.any(0))[0]
    pts = [(int(x), int(np.where(al[:, x])[0].max())) for x in cols]
    h = bottom_chain(pts)
    lo = max(range(len(h)), key=lambda i: h[i][1])
    L = h[:lo + 1]; R = h[lo:]
    def fit(ch):
        if len(ch) < 2: return None
        # 가장 낮은 점에 붙은 쪽 절반 구간의 평균 기울기(다리 끝 등 잡음 완화)
        p, q = ch[0], ch[-1]
        return (q[1] - p[1]) / (q[0] - p[0]) if q[0] != p[0] else None
    return fit(L), fit(R), h[lo], (h[0], h[-1])
if __name__ == '__main__':
    man = json.load(open(os.path.join(ROOT, 'assets-src/quarterview-v1/asset-manifest.json')))
    for a in man['assets']:
        if a['kind'] != 'furniture': continue
        l, r, low, ends = measure(os.path.join(ROOT, 'assets-src/quarterview-v1', a['file']))
        print(f"{a['id']:16} left {(-l if l else 0):.3f} right {(r if r else 0):.3f} low {low} ends {ends}")
