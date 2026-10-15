import { ReactNode, useEffect, useRef } from 'react';
import { IconX } from '@tabler/icons-react';
import { portrait, asset } from './lib/store';

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

/** 원형 초상 + 그리스 신화 앱의 월계수 원형 테두리(framed=false면 테두리 없이 원만) */
export function Avatar({ id, size = 40, framed = true }: { id: string; size?: number; framed?: boolean }) {
  return (
    <span className="portrait" style={{ width: size, height: size }}>
      <img className="pt-img" src={portrait(id)} alt="" width={size} height={size} loading="lazy"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
      {framed && <img className="pt-frame" src={asset('assets/ui/frame.webp')} alt="" aria-hidden />}
    </span>
  );
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
