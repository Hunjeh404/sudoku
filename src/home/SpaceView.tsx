// 쿼터뷰 한 공간(실내 또는 정원)을 그린다. 놀이 모드에서는 탭 = 반응, 꾸미기 모드에서는 탭 = 선택·드래그 = 이동.
// 터치 판정은 그림의 투명도 마스크로 한다(겹친 가구에서 실제로 그려진 곳의 물건이 눌림).
import { useEffect, useMemo, useRef, useState, PointerEvent as RPE, ReactNode } from 'react';
import { ITEM_BY_ID, Space } from '../data/catalog';
import type { Layout } from '../lib/store';
import { asset } from '../lib/store';
import masksRaw from '../data/alpha-masks.json';
import { CANVAS, ENV_ID, placeSprite, unproject, spriteMeta, Problem, SpriteBox } from './geometry';
import { Effect, EffectLayer } from './effects';

const VIEW: Record<Space, { x: number; y: number; w: number; h: number }> = {
  room: { x: -30, y: 30, w: 1314, h: 1190 },
  garden: { x: -60, y: 130, w: 1374, h: 1010 },
};
const MASK_N = 64;
const masks: Record<string, Uint8Array> = {};
function maskOf(id: string) {
  if (!masks[id]) {
    const b64 = (masksRaw as Record<string, string>)[id];
    masks[id] = b64 ? Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) : new Uint8Array(0);
  }
  return masks[id];
}

export interface SpaceViewProps {
  space: Space;
  layout: Layout[];
  mode: 'play' | 'edit';
  selectedUid?: string | null;
  problems?: Problem[];
  lit?: Record<string, boolean>;
  effects?: Effect[];
  reducedMotion?: boolean;
  onTapItem?: (l: Layout, box: SpriteBox) => void;
  onTapFloor?: (u: number, v: number) => void;
  onDragItem?: (uid: string, u: number, v: number, done: boolean) => void;
  overlay?: ReactNode;
  label: string;
}

export function SpaceView(p: SpaceViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(360);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width || 360);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const view = VIEW[p.space];
  const s = w / view.w;

  const boxes = useMemo(() => {
    const out: { l: Layout; b: SpriteBox }[] = [];
    for (const l of p.layout) {
      const b = placeSprite(p.space, l, p.layout);
      if (b) out.push({ l, b });
    }
    return out.sort((a, b) => a.b.z - b.b.z);
  }, [p.layout, p.space]);
  const bad = new Set((p.problems ?? []).map((x) => x.uid));

  const toCanvas = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / s + view.x, y: (e.clientY - r.top) / s + view.y };
  };
  /** 위에 그려진 것부터 투명도 마스크로 판정. 선택된 물건은 우선(꾸미기에서 끌기 쉽게) */
  const hitTest = (c: { x: number; y: number }) => {
    const order = [...boxes].reverse();
    if (p.mode === 'edit' && p.selectedUid) order.sort((a, b) => (a.l.uid === p.selectedUid ? -1 : b.l.uid === p.selectedUid ? 1 : 0));
    for (const { l, b } of order) {
      const meta = spriteMeta(ITEM_BY_ID[l.item]);
      const sx = (c.x - b.left) / b.scale, sy = (c.y - b.top) / b.scale;
      if (sx < 0 || sy < 0 || sx >= meta.canvas || sy >= meta.canvas) continue;
      const m = maskOf(l.item);
      const i = Math.floor((sy / meta.canvas) * MASK_N) * MASK_N + Math.floor((sx / meta.canvas) * MASK_N);
      if (!m.length || m[i >> 3] & (1 << (i & 7))) return { l, b };
    }
    return null;
  };

  // 드래그는 8px을 넘을 때만 이동으로 본다 → 놀이 반응과 섞이지 않음
  const press = useRef<{ x0: number; y0: number; hit: { l: Layout; b: SpriteBox } | null; moving: boolean } | null>(null);
  const onDown = (e: RPE) => {
    if (e.button !== undefined && e.button > 0) return;
    press.current = { x0: e.clientX, y0: e.clientY, hit: hitTest(toCanvas(e)), moving: false };
    if (p.mode === 'edit' && press.current.hit?.l.uid === p.selectedUid) ref.current?.setPointerCapture(e.pointerId);
  };
  const onMove = (e: RPE) => {
    const d = press.current;
    if (!d || p.mode !== 'edit' || !d.hit || d.hit.l.uid !== p.selectedUid) return;
    if (!d.moving && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 8) return;
    d.moving = true;
    const { u, v } = unproject(p.space, toCanvas(e));
    p.onDragItem?.(d.hit.l.uid, u, v, false);
  };
  const onUp = (e: RPE) => {
    const d = press.current;
    press.current = null;
    if (!d) return;
    if (d.moving && d.hit) {
      const { u, v } = unproject(p.space, toCanvas(e));
      p.onDragItem?.(d.hit.l.uid, u, v, true);
      return;
    }
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 12) return; // 스크롤 등
    if (d.hit) { p.onTapItem?.(d.hit.l, d.hit.b); return; }
    if (p.onTapFloor) {
      const { u, v } = unproject(p.space, toCanvas(e));
      if (u >= -0.5 && v >= -0.5 && u <= 12.5 && v <= 10.5) p.onTapFloor(u, v);
    }
  };

  const px = (v: number, axis: 'x' | 'y') => (v - (axis === 'x' ? view.x : view.y)) * s;

  return (
    <div className={`space space-${p.space} mode-${p.mode}`} ref={ref} style={{ height: view.h * s }}
      role="group" aria-label={p.label} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
      onPointerCancel={() => (press.current = null)}>
      <img className="space-bg" src={asset(`assets/env/${ENV_ID[p.space]}.webp`)} alt=""
        style={{ left: px(0, 'x'), top: px(0, 'y'), width: CANVAS * s }} draggable={false} />
      {boxes.map(({ l, b }) => {
        const it = ITEM_BY_ID[l.item];
        const meta = spriteMeta(it);
        const sel = p.selectedUid === l.uid;
        const anim = p.effects?.find((e) => e.uid === l.uid && (e.kind === 'squash' || e.kind === 'hop'));
        return (
          <button key={l.uid} type="button" data-uid={l.uid}
            className={`sprite${sel ? ' selected' : ''}${bad.has(l.uid) ? ' invalid' : ''}${p.lit?.[l.uid] ? ' lit' : ''}`}
            style={{ left: px(b.hit.x, 'x'), top: px(b.hit.y, 'y'), width: b.hit.w * s, height: b.hit.h * s, zIndex: Math.round(b.z + 3000) }}
            aria-label={`${it.nameKo}${sel ? ' (선택됨)' : ''}`} aria-pressed={p.mode === 'edit' ? sel : undefined}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.onTapItem?.(l, b); } }}>
            <img src={asset(meta.src)} alt="" draggable={false} onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
              className={anim && !p.reducedMotion ? `anim-${anim.kind}` : undefined}
              style={{
                left: (b.left - b.hit.x) * s, top: (b.top - b.hit.y) * s, width: b.width * s,
                transformOrigin: `${(meta.anchor.x / meta.canvas) * 100}% ${(meta.anchor.y / meta.canvas) * 100}%`,
                ['--squash' as any]: anim?.amount ?? 0.95,
              }} />
          </button>
        );
      })}
      <EffectLayer effects={p.effects ?? []} boxes={boxes} toPx={px} scale={s} lit={p.lit} reducedMotion={p.reducedMotion} />
      {p.overlay}
    </div>
  );
}
