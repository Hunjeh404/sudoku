"""스도쿠 화면 장식 그림 6장 → public/assets/ui/*.webp
python3 -I scripts/import-sudoku-ui.py   (원본: assets-src/furniture-v2/images/ui/)
보이는 범위로 잘라 쓸 크기로 줄인다. 늘림 경계(border-image slice)는 src/styles.css 주석에 적은 값과 같다.
board_frame은 지시서 규격(1004 정사각 구멍)과 달라 실측 구멍(약 905)에 맞춰 잘랐다."""
import os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src', 'furniture-v2', 'images', 'ui')
OUT = os.path.join(ROOT, 'public', 'assets', 'ui')
JOBS = {  # 이름: (자를 범위, 출력 배율)
    'board_frame': ((18, 19, 1238, 1238), 0.5),   # 테두리 두께 좌157 우158 위157 아래162 → ×0.5
    'coin_gold': ((51, 47, 1203, 1199), 1 / 6),
    'coin_memo': ((42, 44, 1211, 1208), 1 / 6),
    'plaque': ((35, 103, 2137, 614), 0.5),        # 끝 소용돌이 145, 위아래 띠 100 → ×0.5
    'scroll': ((36, 83, 1904, 725), 0.5),          # 말린 끝 150, 위 132, 아래 142 → ×0.5
    'puzzle_bg': (None, 1.0),
}
for name, (box, k) in JOBS.items():
    im = Image.open(os.path.join(SRC, name + '.png'))
    im = im.convert('RGB') if name == 'puzzle_bg' else im.convert('RGBA')
    if box: im = im.crop(box)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=80 if name == 'puzzle_bg' else 86, method=6)
    print(name, im.size, os.path.getsize(os.path.join(OUT, name + '.webp')) // 1024, 'KB')
