// 보물 꾸밈효과 배경(위·아래 띠)과 도감 미리보기
import { asset } from './lib/store';
import { TREASURE_FX, BOARD_THEMES, themeVars } from './data/effects';

export function FxLayers({ id }: { id?: string }) {
  const fx = id ? TREASURE_FX[id] : undefined;
  if (!fx) return null;
  const img = fx.scene ? `url(${asset(`assets/scenes/${fx.scene}.webp`)})` : null;
  return (
    <div className="fx" aria-hidden>
      <div className="fx-top" style={{ background: img ? `${img} center top / 100% auto no-repeat` : fx.top }} />
      <div className="fx-bottom" style={{ background: img ? `${img} center bottom / 100% auto no-repeat` : fx.bottom }} />
    </div>
  );
}

// 도감: 스도쿠 화면을 작게 줄인 모양(가운데 대리석 판)
export function FxPreview({ id }: { id: string }) {
  const fx = TREASURE_FX[id];
  if (!fx) return null;
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
