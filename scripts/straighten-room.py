"""실내 배경 원근 보정: 원본 실내 그림은 뒤쪽 바닥선 기울기 0.55, 앞쪽 0.72로 원근이 들어가 있어
기울기 0.65로 그린 가구(평행 투영)와 소실점이 맞지 않는다. 세로선은 그대로 두고 열마다 세로 방향만
옮겨 바닥선을 0.65 평행사변형으로 맞춘다. 원본 PNG는 그대로 두고 파생본을 만든다.
python3 -I scripts/straighten-room.py"""
import json, os
import numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src/quarterview-v1/images/environments/room_base.png')
OUT = os.path.join(ROOT, 'assets-src/derived/room_base_parallel.png')
S = 0.65
back, right, front, left = (633, 452), (1135, 738), (622, 1108), (118, 738)  # 원본 바닥 꼭짓점(눈 측정)

def line(a, b):
    m = (b[1] - a[1]) / (b[0] - a[0]); return lambda x: a[1] + m * (x - a[0])
top_l, top_r = line(back, left), line(back, right)
bot_l, bot_r = line(left, front), line(front, right)
# 목표: 뒤 꼭짓점 높이 유지, 기울기 S
t_back = back
t_left = (left[0], back[1] + (back[0] - left[0]) * S)
t_right = (right[0], back[1] + (right[0] - back[0]) * S)
t_front_x = front[0]
t_front = (t_front_x, t_left[1] + (t_front_x - left[0]) * S)
ttop_l, ttop_r = line(t_back, t_left), line(t_back, t_right)
tbot_l, tbot_r = line(t_left, t_front), line(t_front, t_right)

im = np.asarray(Image.open(SRC).convert('RGBA')).astype(np.float32)
H, W = im.shape[:2]
OH = H
out = np.zeros((OH, W, 4), np.float32)
ys = np.arange(OH, dtype=np.float32)
for x in range(W):
    yt = top_l(x) if x <= back[0] else top_r(x)
    yb = bot_l(x) if x <= front[0] else bot_r(x)
    tyt = ttop_l(x) if x <= back[0] else ttop_r(x)
    tyb = tbot_l(x) if x <= t_front[0] else tbot_r(x)
    src_y = np.where(ys <= tyt, ys - (tyt - yt), np.where(ys >= tyb, ys - (tyb - yb), yt + (ys - tyt) * (yb - yt) / max(tyb - tyt, 1)))
    for c in range(4):
        out[:, x, c] = np.interp(src_y, np.arange(H), im[:, x, c], left=0, right=0)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(OUT)
corners = [list(map(round, p)) for p in (t_back, t_right, t_front, t_left)]
print('target corners', corners)
json.dump({'source': 'assets-src/quarterview-v1/images/environments/room_base.png', 'output': 'assets-src/derived/room_base_parallel.png',
           'method': 'column-wise vertical remap, slope 0.65', 'sourceFloorCorners': [back, right, front, left], 'floorCornersPx': corners},
          open(os.path.join(ROOT, 'assets-src/derived/room_base_parallel.json'), 'w'), indent=1)
