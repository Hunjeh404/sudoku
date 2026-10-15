import { ReactNode, useEffect, useRef } from 'react';
import { IconX, IconUser } from '@tabler/icons-react';
import { portrait, asset } from './lib/store';
import { TITLE_NAME, boardName } from './data/catalog';
import TIER_MAP from './data/tiers.json';
import { josa } from './lib/josa';

export function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className={`sheet${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}
        onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="닫기"><IconX size={22} /></button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

// 티어별 테두리: 1티어 없음, 2티어 월계수, 3티어 금빛 월계수, 4티어 별빛 월계수, 보물(0)·빈칸 없음.
// 금빛·별빛 그림이 오기 전까지는 월계수 그림에 색을 입혀 대신 쓴다(tint-*).
const FRAME: Record<number, { src: string; cls: string }> = {
  2: { src: 'assets/ui/frame.webp', cls: '' },
  3: { src: 'assets/ui/frame.webp', cls: ' tint-gold' },
  4: { src: 'assets/ui/frame.webp', cls: ' tint-star' },
};
export const tierOf = (id: string): number | null => (id ? (TIER_MAP as Record<string, number>)[id] ?? null : null);

function Ring({ id, size, frame }: { id: string; size: number; frame: boolean }) {
  const f = frame ? FRAME[tierOf(id) ?? 0] : undefined;
  return (
    <>
      {id
        ? <img className="pt-img" src={portrait(id)} alt="" width={size} height={size} loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
        : <span className="pt-img pt-blank" aria-hidden><IconUser size={Math.round(size * 0.42)} stroke={1.6} /></span>}
      {f && <img className={`pt-frame${f.cls}`} src={asset(f.src)} alt="" aria-hidden />}
    </>
  );
}

/** 원형 초상 + 티어 테두리. id가 비면 빈칸. badge(보물)는 오른쪽 아래 작은 동그라미에 초상과 같은 테두리로. framed=false면 테두리 없이 */
export function Avatar({ id, size = 40, framed = true, badge }: { id: string; size?: number; framed?: boolean; badge?: string }) {
  const bs = Math.round(size * 0.4);
  const tier = tierOf(id);
  return (
    <span className={`portrait${id ? '' : ' blank'}${tier !== null ? ` tier${tier}` : ''}`} style={{ width: size, height: size }}>
      <Ring id={id} size={size} frame={framed} />
      {badge && size >= 28 && (
        <span className={`pt-badge${FRAME[tier ?? 0] ? ' framed' : ''}`} style={{ width: bs, height: bs }} aria-hidden>
          <img className="pt-img" src={portrait(badge)} alt="" loading="lazy" />
          {FRAME[tier ?? 0] && <img className={`pt-frame${FRAME[tier!].cls}`} src={asset(FRAME[tier!].src)} alt="" />}
        </span>
      )}
    </span>
  );
}

export function TitleTag({ id }: { id: string }) {
  return id ? <span className="title-tag">{TITLE_NAME[id] ?? id}</span> : null;
}

export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
/** 문장 속 시간: 2분 30초 */
export const secText = (sec: number) => {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m ? (s ? `${m}분 ${s}초` : `${m}분`) : `${s}초`;
};

/** 친구 소식 한 줄 */
export function activityText(kind: string, p: any) {
  if (kind === 'clears') return `스도쿠 ${p.count}판을 끝냈어요`;
  if (kind === 'points') return `누적 점수 ${p.points.toLocaleString()}점을 넘었어요`;
  if (kind === 'record') return `${boardName(p.size, p.difficulty)} 자기 기록을 ${josa(secText(p.sec), '으로/로')} 앞당겼어요 (전 기록 ${secText(p.prev)})`;
  if (kind === 'title') { const n = p.name ?? TITLE_NAME[p.title] ?? ''; return `칭호「${n}」${josa(n, '을/를').slice(n.length)} 받았어요`; }
  if (kind === 'tier') return `${p.tier}티어 초상화 상점이 열렸어요`;
  return '새 소식이 있어요';
}

export function Starlight({ value }: { value: number }) {
  return <span className="starlight" aria-label={`별빛 ${value}`}><span aria-hidden>✦</span>{value}</span>;
}

export function Spinner({ label = '불러오는 중' }: { label?: string }) {
  return <div className="spinner" role="status"><span className="dot" /><span className="dot" /><span className="dot" /><span className="sr">{label}</span></div>;
}

export function ErrorLine({ msg, onRetry }: { msg: string; onRetry?: () => void }) {
  return <p className="error-line" role="alert">{msg} {onRetry && <button className="link" onClick={onRetry}>다시 시도</button>}</p>;
}

export const timeAgo = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return '방금';
  if (d < 3600) return `${Math.floor(d / 60)}분 전`;
  if (d < 86400) return `${Math.floor(d / 3600)}시간 전`;
  return `${Math.floor(d / 86400)}일 전`;
};
