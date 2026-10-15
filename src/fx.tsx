// 보물 꾸밈효과 배경(위·아래 띠)과 도감 미리보기
import { useEffect, useState } from 'react';
import { asset } from './lib/store';
import { TREASURE_FX, BOARD_THEMES, themeVars } from './data/effects';

export function FxLayers({ id }: { id?: string }) {
  const fx = id ? TREASURE_FX[id] : undefined;
  if (!fx?.scene) return null;
  const img = `url(${asset(`assets/scenes/${fx.scene}.webp`)})`;
  return (
    <div className="fx" aria-hidden>
      <div className="fx-top" style={{ background: `${img} center top / 100% auto no-repeat` }} />
      <div className="fx-bottom" style={{ background: `${img} center bottom / 100% auto no-repeat` }} />
    </div>
  );
}

// 도감: 스도쿠 화면을 작게 줄인 모양(가운데 대리석 판)
export function FxPreview({ id }: { id: string }) {
  const fx = TREASURE_FX[id];
  if (!fx) return null;
  if (fx.board) return <BoardFxPreview id={id} />;
  return (
    <div className="fx-preview" style={{ ['--fx-bg' as any]: fx.bg }} role="img" aria-label="스도쿠 화면 꾸밈 미리보기">
      <FxLayers id={id} />
      <span className="fx-preview-board" />
    </div>
  );
}

// 도감: 테마판 한 구역(3×3) 미리보기
const SAMPLE = [5, 0, 0, 0, 7, 0, 0, 0, 1];
const SAMPLE_ENTRY = [0, 3, 0, 0, 0, 0, 8, 0, 0];
export function ThemePreview({ id }: { id: string }) {
  const t = BOARD_THEMES[id];
  if (!t) return null;
  return (
    <div className={`board themed theme-preview${t.dark ? ' dark' : ''}`} role="img" aria-label={`${t.name} 미리보기`}
      style={{ ['--n' as any]: 3, ['--br' as any]: 3, ['--bc' as any]: 3, ['--size' as any]: '132px', ...themeVars(t) }}>
      {SAMPLE.map((v, i) => (
        <span key={i} className={`cell${v ? ' given' : ''}${i === 4 ? ' same' : ''}`}>{v || SAMPLE_ENTRY[i] || ''}</span>
      ))}
    </div>
  );
}

// 도감: 판 효과 미리보기(3×3 한 구역). 한 번 나오는 효과는 미리보기에서만 1.6초마다 다시 보여 준다
const DEMO = [5, 0, 0, 2, 7, 0, 0, 0, 1];
const DEMO_GIVEN = [true, false, false, false, true, false, false, false, true];
export function BoardFxPreview({ id }: { id: string }) {
  const kind = TREASURE_FX[id]?.board;
  const [n, setN] = useState(0);
  const replay = kind === 'enter' || kind === 'erase' || kind === 'undo' || kind === 'line';
  useEffect(() => {
    if (!replay) return;
    const t = window.setInterval(() => setN((x) => x + 1), 1600);
    return () => window.clearInterval(t);
  }, [replay]);
  const box = kind === 'box' ? [5, 3, 4, 2, 7, 8, 6, 9, 1] : DEMO;
  const pulseCells = kind === 'line' ? [0, 1, 2] : [4];
  const val = (i: number) => (kind === 'line' && i < 3 ? [5, 3, 4][i] : box[i]);
  return (
    <div className={`fx-demo tfx-${id}`} role="img" aria-label="판 효과 미리보기">
      <div className="board" style={{ ['--n' as any]: 3, ['--br' as any]: 3, ['--bc' as any]: 3, ['--size' as any]: '120px' }}>
        {box.map((_, i) => {
          const v = val(i);
          const cls = ['cell', `d${v}`];
          if (DEMO_GIVEN[i]) cls.push('given');
          if (i === 4) cls.push('sel');
          else if (i === 1 || i === 3 || i === 5 || i === 7) cls.push('peer', 'line');
          else cls.push('peer');
          if (v === 7 || v === 5) cls.push('same');
          if (kind === 'box' && i === 2) cls.push('leaf');
          const p = replay && pulseCells.includes(i);
          return (
            <span key={i} className={cls.join(' ')}>
              {p && <span key={`p${n}`} className="fx-pop" />}
              {v ? <span key={p ? `v${n}` : 'v'} className={`v${p ? ' anim' : ''}`}>{v}</span>
                : i === 6 ? <span className="notes" style={{ ['--bc' as any]: 3 }}>{[3, 0, 6, 0, 8, 0, 0, 0, 9].map((d, k) => <i key={k}>{d || ''}</i>)}</span> : null}
            </span>
          );
        })}
      </div>
      {kind === 'pad' && (
        <div className="fx-demo-pad">
          <span className="num"><span className="coin-face">3</span><small>2</small></span>
          <span className="num done"><span className="coin-face">7</span><small /></span>
        </div>
      )}
    </div>
  );
}
