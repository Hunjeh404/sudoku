// 쿼터뷰 투영: 12×10 논리 격자 ↔ 배경 그림 픽셀.
// 배경별 바닥 사각형(back/right/front/left)에 정규화 좌표를 bilinear로 대응시킨다.
import manifest from '../../assets-src/quarterview-v1/asset-manifest.json';
import calibration from '../data/calibration.json';
import { ITEM_BY_ID, Item, Space } from '../data/catalog';
import type { Layout } from '../lib/store';

export const COLS = 12, ROWS = 10, CANVAS = 1254;
type Pt = { x: number; y: number };
const assets: any[] = (manifest as any).assets;
const byId = Object.fromEntries(assets.map((a) => [a.id, a]));

interface Floor { back: Pt; right: Pt; front: Pt; left: Pt }
function floorOf(envId: string): Floor {
  const cal = (calibration as any).environments[envId];
  const c: number[][] = cal?.floorCornersPx ?? byId[envId].placement.safeFloorCornersPx;
  const [back, right, front, left] = c.map(([x, y]) => ({ x, y }));
  return { back, right, front, left };
}
export const FLOORS: Record<Space, Floor> = { room: floorOf('room_base'), garden: floorOf('garden_base') };
export const ENV_ID: Record<Space, string> = { room: 'room_base', garden: 'garden_base' };

/** (u,v) 논리 좌표(0..12, 0..10) → 배경 픽셀 */
export function project(space: Space, u: number, v: number): Pt {
  const f = FLOORS[space];
  const s = u / COLS, t = v / ROWS;
  return {
    x: (1 - s) * (1 - t) * f.back.x + s * (1 - t) * f.right.x + s * t * f.front.x + (1 - s) * t * f.left.x,
    y: (1 - s) * (1 - t) * f.back.y + s * (1 - t) * f.right.y + s * t * f.front.y + (1 - s) * t * f.left.y,
  };
}

/** 배경 픽셀 → (u,v). 뉴턴 반복으로 bilinear 역변환 */
export function unproject(space: Space, p: Pt): { u: number; v: number } {
  let u = COLS / 2, v = ROWS / 2;
  for (let i = 0; i < 12; i++) {
    const q = project(space, u, v);
    const e = 0.01;
    const qu = project(space, u + e, v), qv = project(space, u, v + e);
    const a = (qu.x - q.x) / e, b = (qv.x - q.x) / e, c = (qu.y - q.y) / e, d = (qv.y - q.y) / e;
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-9) break;
    const dx = p.x - q.x, dy = p.y - q.y;
    u += (d * dx - b * dy) / det;
    v += (-c * dx + a * dy) / det;
  }
  return { u, v };
}

export interface SpriteBox { left: number; top: number; width: number; z: number; hit: { x: number; y: number; w: number; h: number }; anchor: Pt; scale: number }

interface ItemCal { scale?: number; dx?: number; dy?: number; slot?: { dx: number; dy: number }; ground?: Pt; topLift?: number }
const cal = (id: string): ItemCal => (calibration as any).items[id] ?? {};

/** 그림 정보: 쿼터뷰 가구는 접지점(그림의 가장 낮은 점), 보물은 정면 그림(512 기준) */
export function spriteMeta(item: Item) {
  if (item.kind === 'treasure') {
    return { canvas: 512, bounds: { x: 86, y: 86, w: 340, h: 340 }, anchor: { x: 256, y: 420 }, src: `assets/treasure/${item.id}.webp` };
  }
  const a = byId[item.id];
  return { canvas: CANVAS, bounds: a.principalBoundsPx, anchor: cal(item.id).ground ?? a.placement.spriteAnchorPx, src: `assets/furniture/${item.id}.webp` };
}

const floorWidth = (space: Space) => FLOORS[space].right.x - FLOORS[space].left.x;
const suggested = (id: string): number => byId[id]?.placement?.suggestedVisibleWidthFractionOfFloor ?? 0.09;
const spriteScale = (space: Space, item: Item) => (floorWidth(space) * suggested(item.id) * (cal(item.id).scale ?? 1)) / spriteMeta(item).bounds.w;

/** 쌓기 대상: 바닥에 놓는 가구(러그·벽·받침 위 물건 제외) */
export const stackable = (it: Item | undefined) => !!it && it.surface === 'floor';
const overlaps = (a: Layout, ia: Item, b: Layout, ib: Item) =>
  a.x! < b.x! + ib.fw && b.x! < a.x! + ia.fw && a.y! < b.y! + ib.fh && b.y! < a.y! + ia.fh;

/** 배열 순서대로 쌓기 계산: 겹친 앞선 물건들 위에 올라간다(나중에 놓은 것이 위) */
export function stackInfo(layout: Layout[]) {
  const info = new Map<string, { level: number; under: string[] }>();
  layout.forEach((l, i) => {
    const it = ITEM_BY_ID[l.item];
    if (!stackable(it)) return;
    const under: string[] = [];
    let level = 1;
    for (let j = 0; j < i; j++) {
      const o = layout[j], io = ITEM_BY_ID[o.item];
      if (!stackable(io) || !overlaps(l, it, o, io)) continue;
      under.push(o.uid);
      level = Math.max(level, (info.get(o.uid)?.level ?? 1) + 1);
    }
    info.set(l.uid, { level, under });
  });
  return info;
}

const boxCache = new WeakMap<Layout[], Map<string, SpriteBox | null>>();

/** 한 배치 항목의 화면 위치(배경 픽셀 단위) */
export function placeSprite(space: Space, l: Layout, all: Layout[], depth = 0): SpriteBox | null {
  let cache = boxCache.get(all);
  if (!cache) { cache = new Map(); boxCache.set(all, cache); }
  const key = space + ':' + l.uid;
  if (cache.has(key)) return cache.get(key)!;
  const res = placeSpriteRaw(space, l, all, depth);
  cache.set(key, res);
  return res;
}

function placeSpriteRaw(space: Space, l: Layout, all: Layout[], depth: number): SpriteBox | null {
  const item = ITEM_BY_ID[l.item];
  if (!item) return null;
  const meta = spriteMeta(item);
  const c = cal(item.id);
  const scale = spriteScale(space, item);
  let target: Pt, z: number;
  if (item.surface === 'supportSlot' || item.surface === 'artifact') {
    const parent = all.find((p) => p.uid === l.parent);
    if (!parent || depth > 6) return null;
    const pb = placeSprite(space, parent, all, depth + 1);
    if (!pb) return null;
    const slot = cal(parent.item).slot ?? { dx: 0, dy: -200 };
    target = { x: pb.anchor.x + slot.dx * pb.scale, y: pb.anchor.y + slot.dy * pb.scale };
    z = pb.z + 0.5;
  } else if (item.surface === 'wallRight') {
    // 벽 장식: 그림의 가장 낮은 점 = 벽 밑선 위 오른쪽 끝(발자국 앞 끝)
    target = project(space, (l.x ?? 0) + item.fw, 0);
    z = -2000 + target.y;
  } else {
    // 바닥 가구: 그림의 접지점 = 발자국 앞 꼭짓점
    const x = l.x ?? 0, y = l.y ?? 0;
    target = project(space, x + item.fw, y + item.fh);
    z = item.surface === 'rug' ? -1000 + target.y : target.y;
    const under = stackable(item) ? stackInfo(all).get(l.uid)?.under ?? [] : [];
    let lift = 0;
    for (const u of under) {
      const o = all.find((q) => q.uid === u)!;
      const ob = depth > 6 ? null : placeSprite(space, o, all, depth + 1);
      if (!ob) continue;
      const oLift = ob.anchor.y - project(space, (o.x ?? 0) + ITEM_BY_ID[o.item].fw, (o.y ?? 0) + ITEM_BY_ID[o.item].fh).y;
      lift = Math.min(lift, oLift - (cal(o.item).topLift ?? 0) * ob.scale);
      z = Math.max(z, ob.z + 1);
    }
    target = { x: target.x, y: target.y + lift };
  }
  target = { x: target.x + (c.dx ?? 0), y: target.y + (c.dy ?? 0) };
  const left = target.x - meta.anchor.x * scale;
  const top = target.y - meta.anchor.y * scale;
  return {
    left, top, width: meta.canvas * scale, z, scale, anchor: target,
    hit: { x: left + meta.bounds.x * scale, y: top + meta.bounds.y * scale, w: meta.bounds.w * scale, h: meta.bounds.h * scale },
  };
}

export const MAX_STACK = 3;

// ---------- 배치 규칙(서버 validate_home과 같은 규칙) ----------
export interface Problem { uid: string; code: 'overlap' | 'too_high' | 'out_of_bounds' | 'no_support' | 'slot_taken' | 'bad_place' | 'not_owned' }

export function checkLayout(space: Space, layout: Layout[], inventoryLeft?: Record<string, number>): Problem[] {
  const out: Problem[] = [];
  const kids = new Set<string>();
  for (const l of layout) {
    const it = ITEM_BY_ID[l.item];
    if (!it || !it.spaces.includes(space)) { out.push({ uid: l.uid, code: 'bad_place' }); continue; }
    if (it.surface === 'floor' || it.surface === 'rug') {
      const x = l.x ?? -1, y = l.y ?? -1;
      if (x < 0 || y < 0 || x + it.fw > COLS || y + it.fh > ROWS) out.push({ uid: l.uid, code: 'out_of_bounds' });
    } else if (it.surface === 'wallRight') {
      const x = l.x ?? -1;
      if (x < 0 || x + it.fw > COLS) out.push({ uid: l.uid, code: 'out_of_bounds' });
    } else {
      const p = layout.find((q) => q.uid === l.parent);
      const pi = p && ITEM_BY_ID[p.item];
      if (!pi || !((pi.supports ?? []).includes(it.surface) || (pi.supports ?? []).includes(it.id))) out.push({ uid: l.uid, code: 'no_support' });
      else if (kids.has(l.parent!)) out.push({ uid: l.uid, code: 'slot_taken' });
      kids.add(l.parent!);
    }
  }
  // 바닥 가구는 겹치면 쌓인다(3층까지). 벽 장식끼리는 겹칠 수 없다.
  for (const [uid, s] of stackInfo(layout)) if (s.level > MAX_STACK) out.push({ uid, code: 'too_high' });
  for (let i = 0; i < layout.length; i++)
    for (let j = i + 1; j < layout.length; j++) {
      const a = layout[i], b = layout[j];
      const ia = ITEM_BY_ID[a.item], ib = ITEM_BY_ID[b.item];
      if (!ia || !ib || ia.surface !== 'wallRight' || ib.surface !== 'wallRight') continue;
      if (a.x! < b.x! + ib.fw && b.x! < a.x! + ia.fw) out.push({ uid: b.uid, code: 'overlap' }, { uid: a.uid, code: 'overlap' });
    }
  if (inventoryLeft) for (const [k, v] of Object.entries(inventoryLeft)) if (v < 0) layout.filter((l) => l.item === k).forEach((l) => out.push({ uid: l.uid, code: 'not_owned' }));
  return out;
}

/** 빈자리 찾기(새 물건을 놓을 때): 다른 물건과 가장 넉넉히 떨어진 자리, 같으면 앞쪽 가운데 */
export function findFreeSpot(space: Space, layout: Layout[], itemId: string): { x: number; y: number } | null {
  const it = ITEM_BY_ID[itemId];
  const wall = it.surface === 'wallRight';
  const tryAt = (x: number, y: number) => checkLayout(space, [...layout, { uid: '__new', item: itemId, x, ...(wall ? {} : { y }) }]).every((p) => p.uid !== '__new');
  const others = layout.map((l) => ({ l, i: ITEM_BY_ID[l.item] }))
    .filter(({ l, i }) => i && l.x !== undefined && (wall ? i.surface === 'wallRight' : i.surface === 'floor'));
  const gap = (x: number, y: number) => {
    let g = 4;
    for (const { l, i } of others) {
      const ox = Math.max(0, Math.max(l.x!, x) - Math.min(l.x! + i.fw, x + it.fw));
      const oy = wall ? 0 : Math.max(0, Math.max(l.y ?? 0, y) - Math.min((l.y ?? 0) + i.fh, y + it.fh));
      g = Math.min(g, Math.max(ox, oy));
    }
    return g;
  };
  let best: { x: number; y: number; score: number } | null = null;
  const cx = (COLS - it.fw) / 2, cy = ROWS - it.fh - 2;
  for (let y = 0; y <= (wall ? 0 : ROWS - it.fh); y++)
    for (let x = 0; x <= COLS - it.fw; x++) {
      if (!tryAt(x, y)) continue;
      const score = gap(x, y) * 100 - (Math.abs(x - cx) + Math.abs(y - cy));
      if (!best || score > best.score) best = { x, y, score };
    }
  return best && { x: best.x, y: best.y };
}
