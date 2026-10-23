import { useState } from 'react';
import { IconCheck, IconLock } from '@tabler/icons-react';
import { COLLECTION_CARDS, COLLECTION_SETS, cardImage, cardUnlocked, collectedCards, collectionImage, nextCollectionCard, selectedBackdrop, setUnlocked } from '../data/collections';
import type { CollectionSet } from '../data/collections';
import { asset, useGame } from '../lib/store';
import { rpc } from '../lib/api';
import { getLocal, setLocal } from '../lib/local';
import { ErrorLine, Sheet } from '../ui';

export function CollectionsPanel() {
  const { state, profileId, patchState, toast } = useGame();
  const count = state!.quest.completed_count;
  const selected = selectedBackdrop(state!.profile.settings.collectionBackdrop, count);
  const owned = collectedCards(count).length;
  const next = nextCollectionCard(count);
  const [open, setOpen] = useState<CollectionSet | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; image: string; note: string } | null>(null);

  const wear = async (id: string) => {
    if (busy || (id && !selectedBackdrop(id, count))) return;
    setBusy(true); setErr(null);
    try {
      const settings = { ...state!.profile.settings, collectionBackdrop: id };
      await rpc('update_profile', { p: profileId, patch: { settings } });
      // Keep the old preferences and commit the choice only after the server accepts it.
      setLocal(`settings:${profileId}`, { ...getLocal(`settings:${profileId}`, {}), collectionBackdrop: id });
      patchState((s) => s.profile.id === profileId ? { ...s, profile: { ...s.profile, settings: { ...s.profile.settings, collectionBackdrop: id } } } : s);
      toast(id ? '모은 배경을 홈에 펼쳤어요' : '기본 홈 화면으로 바꿨어요');
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <section className="collection-panel" aria-label="신화 여행첩">
      <div className="collection-intro">
        <span className="collection-eyebrow">한 판씩, 신화 속으로</span>
        <h2>나의 신화 여행첩</h2>
        <p>장면 카드 네 장을 모으면 세트 배경을 받아요. 완성한 배경은 홈에 펼칠 수 있어요.</p>
        <div className="collection-totals"><strong>장면 {owned}/{COLLECTION_CARDS.length}</strong><span>배경 {COLLECTION_SETS.filter((s) => setUnlocked(s, count)).length}/{COLLECTION_SETS.length}</span></div>
        <progress aria-label="장면 카드 수집 진행도" max={COLLECTION_CARDS.length} value={owned} />
        <p className="fine">{next ? `다음 카드「${next.name}」까지 ${next.need - count}판` : '여섯 세트의 모든 장면과 배경을 모았어요!'}</p>
      </div>
      <p className="fine">지금까지 끝낸 {count}판이 모두 인정돼요. 별빛을 쓰지 않고 자동으로 모아요.</p>
      {selected && <div className="collection-current"><span>홈 배경: {selected.backgroundName}</span><button className="btn small" disabled={busy} onClick={() => wear('')}>기본으로</button></div>}
      {!open && err && <ErrorLine msg={err} />}
      <div className="collection-sets">
        {COLLECTION_SETS.map((set) => {
          const n = set.cards.filter((c) => cardUnlocked(c, count)).length;
          return <button key={set.id} className={`collection-set${n === 4 ? ' complete' : ''}`} onClick={() => { setOpen(set); setErr(null); }}>
            <div className="collection-cover"><img src={asset(collectionImage(set))} alt="" loading="lazy" /><span>{n === 4 ? '세트 완성' : `${n}/4장`}</span></div>
            <div className="collection-set-text"><h3>{set.name}</h3><p>{set.description}</p><small>{set.cards[0].need}–{set.cards[3].need}판 · 배경「{set.backgroundName}」</small></div>
          </button>;
        })}
      </div>
      {open && <Sheet title={open.name} onClose={() => { if (!busy) { setOpen(null); setErr(null); } }}>
        <p className="fine">{open.description}</p>
        <div className="collection-cards">
          {open.cards.map((card) => {
            const has = cardUnlocked(card, count);
            return <button key={card.id} className={`collection-card${has ? ' owned' : ' locked'}`} onClick={() => setPreview({ name: card.name, image: cardImage(card), note: has ? `${card.need}판 달성으로 모은 장면이에요.` : `미리보기 · ${card.need}판에서 받아요. ${card.need - count}판 남았어요.` })}>
              <img src={asset(cardImage(card))} alt="" loading="lazy" />
              <strong>{card.name}</strong><small>{has ? <><IconCheck size={14} aria-hidden /> 모았어요</> : <><IconLock size={14} aria-hidden /> {card.need}판 · {card.need - count}판 남음</>}</small>
            </button>;
          })}
        </div>
        <div className="collection-background">
          <button className="collection-art-button" onClick={() => setPreview({ name: open.backgroundName, image: collectionImage(open), note: setUnlocked(open, count) ? '세트 완성으로 받은 홈 배경이에요.' : '미리보기 · 이 세트의 장면 네 장을 모두 모으면 받아요.' })} aria-label={`${open.backgroundName} 크게 보기`}><img src={asset(collectionImage(open))} alt={open.backgroundName} loading="lazy" /></button>
          <h3>세트 완성 선물 · {open.backgroundName}</h3>
          <p className="fine">{setUnlocked(open, count) ? '네 장의 장면을 모아 배경을 받았어요.' : `${open.cards[3].need}판에 세트를 완성하면 이 배경을 받아요.`}</p>
          <button className="btn primary" disabled={busy || !setUnlocked(open, count) || selected?.id === open.id} onClick={() => wear(open.id)}>{busy ? '저장 중…' : selected?.id === open.id ? '홈에 펼쳐 둔 배경' : setUnlocked(open, count) ? '홈 배경으로 쓰기' : '세트를 완성하면 열려요'}</button>
          {err && <ErrorLine msg={err} />}
        </div>
      </Sheet>}
      {preview && <Sheet title={preview.name} onClose={() => setPreview(null)} wide><img className="collection-full-art" src={asset(preview.image)} alt={preview.name} /><p>{preview.note}</p></Sheet>}
    </section>
  );
}

export function CollectionHome({ onOpen }: { onOpen: () => void }) {
  const { state } = useGame();
  const count = state!.quest.completed_count;
  const backdrop = selectedBackdrop(state!.profile.settings.collectionBackdrop, count);
  const next = nextCollectionCard(count);
  return <section className="collection-home">
    {backdrop && <figure className="collection-home-art"><img src={asset(collectionImage(backdrop))} alt={backdrop.backgroundName} /><figcaption>{backdrop.backgroundName}</figcaption></figure>}
    <button className="collection-home-link" onClick={onOpen}>
      <span className="grow"><strong>신화 여행첩 · {collectedCards(count).length}/24장</strong><small>{next ? `「${next.name}」까지 ${next.need - count}판` : '여섯 세트 완성 · 배경을 골라 보세요'}</small></span><span aria-hidden>→</span>
    </button>
  </section>;
}
