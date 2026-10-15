// 보물 꾸밈효과 배경(위·아래 띠)과 도감 미리보기
import { asset } from './lib/store';
import { TREASURE_FX, BOARD_THEMES, TIER_THEMES, COIN_ART, themeVars } from './data/effects';

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
  if (fx.coin) return <CoinPreview id={id} />;
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
  const t = BOARD_THEMES[id] ?? TIER_THEMES[id];
  if (!t) return null;
  return (
    <div className={`tablet theme-preview${t.art ? ' themed-frame' : ''}`} role="img" aria-label={`${t.name} 미리보기`} style={themeVars(id, t, asset(''))}>
      <div className={`board themed${t.dark ? ' dark' : ''}`} style={{ ['--n' as any]: 3, ['--br' as any]: 3, ['--bc' as any]: 3, ['--size' as any]: '116px' }}>
        {SAMPLE.map((v, i) => (
          <span key={i} className={`cell${v ? ' given' : ''}${i === 4 ? ' same' : ''}`}>{v || SAMPLE_ENTRY[i] || ''}</span>
        ))}
      </div>
    </div>
  );
}

// 숫자 버튼(동전) 모양: 그림이 있으면 그림, 없으면 색으로 만든 임시 동전(styles.css .coin-skin)
export function coinVars(id: string): Record<string, string> {
  const c = TREASURE_FX[id]?.coin;
  if (!c) return {};
  const v: Record<string, string> = { '--coin-base': c.base, '--coin-rim': c.rim, '--coin-text': c.text };
  if (COIN_ART.has(id)) {
    v['--coin-img'] = `url(${asset(`assets/coins/${id}.webp`)})`;
    v['--coin-memo'] = `url(${asset(`assets/coins/${id}_memo.webp`)})`;
  }
  return v;
}

// 도감: 숫자 버튼 미리보기(보통 셋 + 메모 하나)
export function CoinPreview({ id }: { id: string }) {
  return (
    <div className="coin-skin coin-demo" style={coinVars(id)} role="img" aria-label="숫자 버튼 미리보기">
      {[1, 2, 3].map((d) => <span key={d} className="num"><span className="coin-face">{d}</span></span>)}
      <span className="num memo"><span className="coin-face">4</span></span>
      <small>메모할 때</small>
    </div>
  );
}
