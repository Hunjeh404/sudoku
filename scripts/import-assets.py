"""원본 자료 가져오기.
사용: python3 -I scripts/import-assets.py <greek-myth-map 경로> <쿼터뷰 팩 경로>
- 원본 PNG는 assets-src/에 보존, 게임용은 public/assets/에 WebP로 축소.
- 데이터는 public/data/*.json(지연 로드)과 src/data/*.json(초기 번들)으로 변환.
- 경로 누락을 검사하고 asset-sources.json에 원본 커밋·경로를 기록.
"""
import hashlib, json, os, shutil, subprocess, sys
from PIL import Image

SRC, PACK = sys.argv[1], sys.argv[2]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'assets')
DATA_PUBLIC = os.path.join(ROOT, 'public', 'data')
DATA_SRC = os.path.join(ROOT, 'src', 'data')
for d in (OUT, DATA_PUBLIC, DATA_SRC):
    os.makedirs(d, exist_ok=True)

commit = subprocess.check_output(['git', '-C', SRC, 'rev-parse', 'HEAD'], text=True).strip()
EXPECTED = '286dfbce4bef3a9d4ca09ae6b61956043d792451'
assert commit == EXPECTED, f'원본 커밋이 명세와 다름: {commit}'

def load_js(name, var):
    s = open(os.path.join(SRC, name), encoding='utf-8').read()
    start = s.index('=', s.index(var)) + 1
    body = s[start:].strip().rstrip(';').strip()
    return json.loads(body)

def webp(src, dst, max_side, quality=82):
    im = Image.open(src)
    im = im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P') else im.convert('RGB')
    if im.mode == 'RGBA' and im.getchannel('A').getextrema()[0] == 255:
        im = im.convert('RGB')
    im.thumbnail((max_side, max_side), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, 'WEBP', quality=quality, method=6)
    return im.size

sources = {'sourceRepo': 'https://github.com/Hunjeh404/greek-myth-map', 'sourceCommit': commit, 'files': []}
def record(kind, src_rel, out_rel, size):
    sources['files'].append({'kind': kind, 'source': src_rel, 'output': out_rel, 'size': size})

# ---- 1. 쿼터뷰 팩: 원본 보존 + 파생 WebP ----
pack_dst = os.path.join(ROOT, 'assets-src', 'quarterview-v1')
if not os.path.exists(pack_dst):
    shutil.copytree(PACK, pack_dst)
man = json.load(open(os.path.join(PACK, 'asset-manifest.json'), encoding='utf-8'))
for a in man['assets']:
    src = os.path.join(PACK, a['file'])
    if a['id'] == 'room_base':  # 원근을 편 파생본 사용(scripts/straighten-room.py)
        src = os.path.join(ROOT, 'assets-src', 'derived', 'room_base_parallel.png')
    sub = 'env' if a['kind'] == 'environment' else 'furniture'
    side = 1024 if sub == 'env' else 512
    rel = f'assets/{sub}/{a["id"]}.webp'
    size = webp(src, os.path.join(ROOT, 'public', rel), side, 84)
    record('quarterview', 'sudoku-assets/quarterview-v1/' + a['file'], rel, size)

# ---- 2. 인물 데이터 ----
myth = load_js('data.js', 'window.MYTH')
people = myth['people']
missing = [p['id'] for p in people if not os.path.exists(os.path.join(SRC, 'images/portraits', p['id'] + '.png'))]
assert not missing, f'초상 누락: {missing[:5]}'
slim = [{k: p.get(k) for k in ('id', 'ko', 'en', 'cat', 'dom', 'sym', 'ep')} for p in people]
json.dump(slim, open(os.path.join(DATA_PUBLIC, 'people.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump(myth.get('edges', []), open(os.path.join(DATA_PUBLIC, 'edges.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

# 도감 썸네일 전체(지연 로드) + 보물 10종 확대본
for p in people:
    rel = f'assets/portraits/{p["id"]}.webp'
    size = webp(os.path.join(SRC, 'images/portraits', p['id'] + '.png'), os.path.join(ROOT, 'public', rel), 224, 78)
    record('portrait', f'images/portraits/{p["id"]}.png', rel, size)
TREASURES = ['lyre', 'psyche_lamp', 'ariadne_thread', 'wind_bag', 'cornucopia', 'olive_tree', 'golden_fleece', 'ariadne_crown', 'mirror_shield', 'pandora_jar']
for t in TREASURES:
    rel = f'assets/treasure/{t}.webp'
    size = webp(os.path.join(SRC, 'images/portraits', t + '.png'), os.path.join(ROOT, 'public', rel), 384, 84)
    record('treasure', f'images/portraits/{t}.png', rel, size)

# ---- 3. 이야기책: 첫 출시 공개 3장 ----
book = load_js('book.js', 'window.BOOK')
OPEN_CHAPTERS = [1, 4, 9]
chapters = []
for ch in book:
    entry = {'n': ch['n'], 't': ch['t'], 'sub': ch.get('sub', ''), 'open': ch['n'] in OPEN_CHAPTERS}
    if entry['open']:
        blocks = []
        for b in ch['b']:
            if b['k'] == 'img':
                assert os.path.exists(os.path.join(SRC, b['f'])), b['f']
                name = os.path.basename(b['f']).replace('.png', '.webp')
                rel = f'assets/scenes/{name}'
                size = webp(os.path.join(SRC, b['f']), os.path.join(ROOT, 'public', rel), 900, 80)
                record('scene', b['f'], rel, size)
                blocks.append({'k': 'img', 'f': rel, 'cap': b.get('cap', ''), 'who': b.get('who', [])})
            elif b['k'] == 'p':
                blocks.append({'k': 'p', 't': b['t']})
            elif b['k'] == 'who':
                blocks.append({'k': 'who', 'id': b['id']})
        entry['b'] = blocks
    chapters.append(entry)
json.dump(chapters, open(os.path.join(DATA_PUBLIC, 'book.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

# ---- 4. 인물별 긴 이야기(도감 선택 읽기, 지연 로드) ----
stories = load_js('stories.js', 'window.STORIES')
json.dump(stories, open(os.path.join(DATA_PUBLIC, 'stories.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

# ---- 5. 오디오: 9곡을 96kbps로 줄여 지연 로드 ----
os.makedirs(os.path.join(OUT, 'audio'), exist_ok=True)
for f in sorted(os.listdir(os.path.join(SRC, 'audio'))):
    if not f.endswith('.mp3'):
        continue
    rel = f'assets/audio/{f}'
    dst = os.path.join(ROOT, 'public', rel)
    if not os.path.exists(dst):
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', os.path.join(SRC, 'audio', f), '-b:a', '96k', '-ac', '2', dst], check=True)
    record('audio', f'audio/{f}', rel, None)

# ---- 6. 파비콘 ----
webp(os.path.join(SRC, 'images/ui/favicon.png'), os.path.join(OUT, 'ui', 'favicon.webp'), 128)
record('ui', 'images/ui/favicon.png', 'assets/ui/favicon.webp', None)

json.dump(sources, open(os.path.join(ROOT, 'asset-sources.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('files', len(sources['files']), 'people', len(people), 'chapters open', OPEN_CHAPTERS)
