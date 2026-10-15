// 배치 보정용 화면(로컬 빌드에서 VITE_CALIB=1일 때만): 논리 격자와 발자국을 그림 위에 겹쳐 본다.
import { ITEMS, Space } from '../data/catalog';
import type { Layout } from '../lib/store';
import { SpaceView } from '../home/SpaceView';
import { project, COLS, ROWS, placeSprite } from '../home/geometry';

const SETS: Record<string, { space: Space; layout: Layout[] }> = {
  room1: { space: 'room', layout: [
    { uid: 'a', item: 'cloud_bed', x: 0, y: 0 }, { uid: 'b', item: 'scroll_bookcase', x: 4, y: 0 }, { uid: 'c', item: 'laurel_door', x: 7 },
    { uid: 'd', item: 'tea_table', x: 5, y: 4 }, { uid: 'e', item: 'picture_frame', parent: 'd' }, { uid: 'f', item: 'laurel_rug', x: 4, y: 4 },
    { uid: 'g', item: 'display_pedestal', x: 9, y: 3 }, { uid: 'h', item: 'lyre', parent: 'g' }, { uid: 'i', item: 'cloud_cushion', x: 2, y: 7 },
    { uid: 'j', item: 'round_stool', x: 8, y: 6 }, { uid: 'k', item: 'star_lantern', x: 11, y: 9 }, { uid: 'l', item: 'linen_curtain', x: 2 },
    { uid: 'm', item: 'treasure_chest', x: 9, y: 0 }, { uid: 'n', item: 'star_mobile', x: 0, y: 9 }, { uid: 'o', item: 'music_stand', x: 6, y: 8 },
  ] },
  room2: { space: 'room', layout: [
    { uid: 'a', item: 'owl_mailbox', x: 0, y: 4 }, { uid: 'b', item: 'olive_planter', x: 11, y: 0 }, { uid: 'c', item: 'laurel_bench', x: 4, y: 7 },
    { uid: 'd', item: 'display_pedestal', x: 2, y: 2 }, { uid: 'e', item: 'pandora_jar', parent: 'd' },
    { uid: 'f', item: 'display_pedestal', x: 8, y: 2 }, { uid: 'g', item: 'ariadne_crown', parent: 'f' },
    { uid: 'h', item: 'cloud_bed', x: 10, y: 5 },
  ] },
  stack: { space: 'room', layout: [
    { uid: 'a', item: 'tea_table', x: 4, y: 4 }, { uid: 'b', item: 'round_stool', x: 5, y: 5 }, { uid: 'c', item: 'star_lantern', x: 5, y: 5 },
    { uid: 'd', item: 'treasure_chest', x: 8, y: 2 }, { uid: 'e', item: 'olive_planter', x: 9, y: 2 },
    { uid: 'f', item: 'display_pedestal', x: 1, y: 6 }, { uid: 'g', item: 'cloud_cushion', x: 1, y: 6 },
    { uid: 'h', item: 'scroll_bookcase', x: 2, y: 0 }, { uid: 'i', item: 'owl_mailbox', x: 3, y: 0 },
    { uid: 'j', item: 'cloud_bed', x: 6, y: 7 }, { uid: 'k', item: 'cloud_cushion', x: 7, y: 7 },
    { uid: 'l', item: 'laurel_door', x: 9 }, { uid: 'm', item: 'linen_curtain', x: 5 },
  ] },
  garden: { space: 'garden', layout: [
    { uid: 'a', item: 'shell_fountain', x: 4, y: 3 }, { uid: 'b', item: 'garden_trellis', x: 4, y: 0 }, { uid: 'c', item: 'stepping_stones', x: 4, y: 8 },
    { uid: 'd', item: 'laurel_bench', x: 9, y: 4 }, { uid: 'e', item: 'olive_planter', x: 0, y: 0 }, { uid: 'f', item: 'olive_planter', x: 11, y: 9 },
    { uid: 'g', item: 'owl_mailbox', x: 0, y: 9 }, { uid: 'h', item: 'tea_table', x: 0, y: 4 }, { uid: 'i', item: 'star_lantern', x: 11, y: 0 },
  ] },
};

export function Calib() {
  const key = new URLSearchParams(location.search).get('calib') ?? 'room1';
  const set = SETS[key] ?? SETS.room1;
  const grid: string[] = [];
  for (let u = 0; u <= COLS; u++) { const a = project(set.space, u, 0), b = project(set.space, u, ROWS); grid.push(`M${a.x} ${a.y}L${b.x} ${b.y}`); }
  for (let v = 0; v <= ROWS; v++) { const a = project(set.space, 0, v), b = project(set.space, COLS, v); grid.push(`M${a.x} ${a.y}L${b.x} ${b.y}`); }
  const feet = set.layout.filter((l) => l.x !== undefined).map((l) => {
    const it = ITEMS.find((i) => i.id === l.item)!;
    const y0 = l.y ?? 0, h = it.surface === 'wallRight' ? 0.3 : it.fh;
    const pts = [project(set.space, l.x!, y0), project(set.space, l.x! + it.fw, y0), project(set.space, l.x! + it.fw, y0 + h), project(set.space, l.x!, y0 + h)];
    return { d: `M${pts.map((p) => `${p.x} ${p.y}`).join('L')}Z`, anchor: placeSprite(set.space, l, set.layout)!.anchor };
  });
  const view = set.space === 'room' ? { x: -30, y: 30, w: 1314, h: 1190 } : { x: -60, y: 130, w: 1374, h: 1010 };
  return (
    <div style={{ maxWidth: 520, margin: '0 auto', position: 'relative' }}>
      <SpaceView space={set.space} layout={set.layout} mode="play" label="calib"
        overlay={<svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999 }}>
          <path d={grid.join('')} stroke="rgba(80,40,120,.35)" strokeWidth={2} fill="none" />
          {feet.map((f, i) => <g key={i}><path d={f.d} fill="rgba(255,0,0,.12)" stroke="red" strokeWidth={3} /><circle cx={f.anchor.x} cy={f.anchor.y} r={7} fill="blue" /></g>)}
        </svg>} />
    </div>
  );
}
