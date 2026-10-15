import { ReactNode, useEffect, useRef } from 'react';
import { IconX, IconUser } from '@tabler/icons-react';
import { portrait, asset } from './lib/store';
import { TITLE_NAME, boardName } from './data/catalog';
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

/** 원형 초상 + 월계수 원형 테두리. id가 비어 있으면 아직 초상화가 없는 빈칸 */
export function Avatar({ id, size = 40, framed = true }: { id: string; size?: number; framed?: boolean }) {
  return (
    <span className={`portrait${id ? '' : ' blank'}`} style={{ width: size, height: size }}>
      {id
        ? <img className="pt-img" src={portrait(id)} alt="" width={size} height={size} loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
        : <span className="pt-img pt-blank" aria-hidden><IconUser size={Math.round(size * 0.42)} stroke={1.6} /></span>}
      {framed && <img className="pt-frame" src={asset('assets/ui/frame.webp')} alt="" aria-hidden />}
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
