"""터치 판정용 64×64 투명도 마스크(1비트, 한 칸 팽창). python3 -I scripts/gen-alpha-masks.py
겹친 가구에서 실제로 그림이 있는 곳을 누른 물건이 선택되도록 한다."""
import base64, json, os
from PIL import Image, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N = 64
out = {}
srcs = {}
pack = os.path.join(ROOT, 'public', 'assets', 'furniture')  # 게임용 WebP(좌우 뒤집기 반영본)
for f in os.listdir(pack):
    srcs[f[:-5]] = os.path.join(pack, f)
tre = os.path.join(ROOT, 'public', 'assets', 'treasure')
for f in os.listdir(tre):
    srcs[f[:-5]] = os.path.join(tre, f)
for k, p in sorted(srcs.items()):
    a = Image.open(p).convert('RGBA').getchannel('A').resize((N, N), Image.BOX)
    a = a.point(lambda v: 255 if v >= 40 else 0).filter(ImageFilter.MaxFilter(3))
    bits = bytearray(N * N // 8)
    for i, v in enumerate(a.getdata()):
        if v: bits[i >> 3] |= 1 << (i & 7)
    out[k] = base64.b64encode(bytes(bits)).decode()
json.dump(out, open(os.path.join(ROOT, 'src', 'data', 'alpha-masks.json'), 'w'), separators=(',', ':'))
print(len(out), 'masks')
