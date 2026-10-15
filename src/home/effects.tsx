// 터치 반응 오버레이(SVG). 원본 그림은 바꾸지 않고 위에 빛·물결·김 등을 덧그린다.
import type { Layout } from '../lib/store';
import { portrait } from '../lib/store';
import type { SpriteBox } from './geometry';

export type EffectKind =
  | 'squash' | 'hop' | 'sparkle' | 'stars' | 'butterfly' | 'ring' | 'sunbeam' | 'leaves' | 'ripple' | 'steam'
  | 'steps' | 'chime' | 'fruit' | 'wind' | 'gold' | 'crown' | 'hope' | 'mirror' | 'ping';

export interface Effect { id: number; uid: string; kind: EffectKind; until: number; amount?: number; anchor?: [number, number]; data?: string }

const GOLD = '#E9C46A', WARM = '#FFE7A3', BLUE = '#BFE3F5', LEAF = '#8DB580';

function Star({ x, y, r, delay = 0, color = WARM }: { x: number; y: number; r: number; delay?: number; color?: string }) {
  const pts = Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI / 4) * i - Math.PI / 2, rr = i % 2 ? r * 0.38 : r;
    return `${x + Math.cos(a) * rr},${y + Math.sin(a) * rr}`;
  }).join(' ');
  return <polygon className="fx-twinkle" points={pts} fill={color} style={{ animationDelay: `${delay}ms` }} />;
}

function renderKind(e: Effect, w: number, h: number) {
  const [ax, ay] = e.anchor ?? [0.5, 0.45];
  const cx = w * ax, cy = h * ay, m = Math.min(w, h);
  switch (e.kind) {
    case 'squash': case 'sparkle': case 'stars': case 'chime':
      return <>{[[-0.3, -0.25], [0.28, -0.1], [0.05, -0.38], [-0.12, 0.08], [0.35, 0.2]].map(([dx, dy], i) =>
        <Star key={i} x={cx + dx * w} y={cy + dy * h} r={m * (0.06 + (i % 2) * 0.03)} delay={i * (e.kind === 'chime' ? 220 : 90)} />)}</>;
    case 'hop': return <ellipse className="fx-fade" cx={cx} cy={h * 0.95} rx={w * 0.3} ry={h * 0.04} fill="#3A3739" opacity={0.15} />;
    case 'butterfly':
      return <>{[0, 1].map((i) => (
        <g key={i} className="fx-flutter" style={{ animationDelay: `${i * 200}ms`, transformOrigin: `${cx}px ${cy}px` }}>
          <path d={`M${cx + i * 20} ${cy} q -12 -14 -18 -2 q 6 10 18 2 q 12 -14 18 -2 q -6 10 -18 2`} fill={i ? '#DCCFE5' : WARM} stroke="#B49AC8" strokeWidth={1} />
        </g>))}
        {[[-0.3, -0.2], [0.3, -0.3], [0, 0.1]].map(([dx, dy], i) => <Star key={i} x={cx + dx * w} y={cy + dy * h} r={m * 0.05} delay={i * 150} />)}</>;
    case 'ring':
      return <ellipse className="fx-ring" cx={cx} cy={h * 0.55} rx={w * 0.42} ry={h * 0.3} fill="none" stroke={GOLD} strokeWidth={3} strokeDasharray="30 400" />;
    case 'sunbeam':
      return <polygon className="fx-fade" points={`${w * 0.42},0 ${w * 0.58},0 ${w * 0.8},${h} ${w * 0.25},${h}`} fill="url(#beam)" />;
    case 'leaves':
      return <>{[0, 1, 2, 3].map((i) => <ellipse key={i} className="fx-fall" style={{ animationDelay: `${i * 90}ms` }}
        cx={cx + (i - 1.5) * w * 0.15} cy={h * 0.25} rx={m * 0.05} ry={m * 0.025} fill={LEAF} transform={`rotate(${i * 40} ${cx} ${h * 0.25})`} />)}</>;
    case 'ripple':
      return <>{[0, 1].map((i) => <ellipse key={i} className="fx-ripple" style={{ animationDelay: `${i * 420}ms`, transformOrigin: `${cx}px ${cy}px` }}
        cx={cx} cy={cy} rx={w * 0.22} ry={h * 0.07} fill="none" stroke={BLUE} strokeWidth={2.5} />)}</>;
    case 'steam':
      return <>{[0, 1, 2].map((i) => <path key={i} className="fx-steam" style={{ animationDelay: `${i * 200}ms` }}
        d={`M${cx + (i - 1) * 6} ${cy} c -8 -10 8 -18 0 -28 c -8 -10 8 -16 0 -26`} fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.8} />)}</>;
    case 'steps':
      return <>{[0.25, 0.5, 0.75].map((f, i) => <ellipse key={i} className="fx-pulse" style={{ animationDelay: `${i * 220}ms` }}
        cx={w * f} cy={h * (0.65 - (f - 0.5) * 0.25)} rx={w * 0.12} ry={h * 0.12} fill={WARM} opacity={0.7} />)}</>;
    case 'fruit':
      return <>{[[-0.3, -0.3, '#E76F51'], [0, -0.42, '#B49AC8'], [0.3, -0.28, '#F4A261'], [-0.15, -0.1, '#8DB580'], [0.2, -0.05, '#F2CC8F']].map(([dx, dy, c], i) =>
        <circle key={i} className="fx-pop" style={{ animationDelay: `${i * 70}ms` }} cx={cx + (dx as number) * w} cy={cy + (dy as number) * h} r={m * 0.06} fill={c as string} stroke="#fff" strokeWidth={1.5} />)}</>;
    case 'wind':
      return <>{[0, 1, 2].map((i) => <path key={i} className="fx-wind" style={{ animationDelay: `${i * 120}ms` }}
        d={`M${-w * 0.1} ${h * (0.3 + i * 0.18)} q ${w * 0.4} ${-h * 0.15} ${w * 0.8} 0 t ${w * 0.4} 0`} fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" />)}</>;
    case 'gold':
      return <rect className="fx-sweep" x={-w * 0.3} y={0} width={w * 0.25} height={h} fill="url(#goldsweep)" />;
    case 'crown': {
      const pts = [[0.2, -0.05], [0.38, -0.25], [0.55, -0.12], [0.72, -0.3], [0.85, -0.08]].map(([x, y]) => [w * x, h * y]);
      return <><polyline className="fx-draw" points={pts.map((q) => q.join(',')).join(' ')} fill="none" stroke={WARM} strokeWidth={1.5} />
        {pts.map(([x, y], i) => <Star key={i} x={x} y={y} r={m * 0.06} delay={i * 120} />)}</>;
    }
    case 'hope':
      return <>{[0, 1, 2, 3, 4].map((i) => <circle key={i} className="fx-orbit" style={{ animationDelay: `${i * -260}ms`, transformOrigin: `${cx}px ${cy}px` }}
        cx={cx + w * 0.38} cy={cy} r={m * 0.035} fill={WARM} />)}</>;
    case 'mirror':
      return e.data ? <image className="fx-fade-long" href={portrait(e.data)} x={cx - m * 0.22} y={cy - m * 0.22} width={m * 0.44} height={m * 0.44} clipPath="url(#mirrorclip)" /> : null;
    case 'ping':
      return <rect x={2} y={2} width={w - 4} height={h - 4} rx={8} fill="none" stroke={GOLD} strokeWidth={3} />;
  }
}

export function EffectLayer({ effects, boxes, toPx, scale, lit, reducedMotion }: {
  effects: Effect[]; boxes: { l: Layout; b: SpriteBox }[]; toPx: (v: number, a: 'x' | 'y') => number; scale: number;
  lit?: Record<string, boolean>; reducedMotion?: boolean;
}) {
  const litBoxes = boxes.filter(({ l }) => lit?.[l.uid]);
  return (
    <>
      {litBoxes.map(({ l, b }) => {
        const r = Math.max(b.hit.w, b.hit.h) * 1.1;
        return <div key={'lit' + l.uid} className="fx-lit" aria-hidden
          style={{ left: toPx(b.hit.x + b.hit.w / 2 - r, 'x'), top: toPx(b.hit.y + b.hit.h * 0.5 - r, 'y'), width: r * 2 * scale, height: r * 2 * scale, zIndex: Math.round(b.z + 3000) - 1 }} />;
      })}
      {effects.map((e) => {
        const box = boxes.find((x) => x.l.uid === e.uid)?.b;
        if (!box) return null;
        const w = box.hit.w * scale, h = box.hit.h * scale;
        const kind = reducedMotion && e.kind !== 'mirror' ? 'ping' : e.kind;
        if (kind === 'squash' && reducedMotion) return null;
        return (
          <svg key={e.id} className="fx" aria-hidden width={w} height={h} viewBox={`0 0 ${w} ${h}`}
            style={{ left: toPx(box.hit.x, 'x'), top: toPx(box.hit.y, 'y'), zIndex: 9000 }}>
            <defs>
              <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFF4C8" stopOpacity="0.9" /><stop offset="1" stopColor="#FFF4C8" stopOpacity="0" /></linearGradient>
              <linearGradient id="goldsweep" x1="0" x2="1"><stop offset="0" stopColor={GOLD} stopOpacity="0" /><stop offset="0.5" stopColor="#FFF1B8" stopOpacity="0.85" /><stop offset="1" stopColor={GOLD} stopOpacity="0" /></linearGradient>
              <clipPath id="mirrorclip"><circle cx={w / 2} cy={h * 0.45} r={Math.min(w, h) * 0.22} /></clipPath>
            </defs>
            {renderKind({ ...e, kind }, w, h)}
          </svg>
        );
      })}
    </>
  );
}
