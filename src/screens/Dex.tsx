// 도감 겸 상점: 초상화(티어별)·보물(티어 없음). 가진 것이 앞에, 아직 없는 것은 흑백. 긴 이야기는 가진 것만. 이야기책
import { useEffect, useMemo, useState } from 'react';
import { IconSearch, IconLock, IconCheck } from '@tabler/icons-react';
import { useGame, tierOpen } from '../lib/store';
import { rpc, newOpId, ApiError } from '../lib/api';
import { loadPeople, loadStories, Person } from '../lib/content';
import { TIERS, tierOfCat, JOURNEY, TREASURE_PRICE, priceFor, storyEvery } from '../data/catalog';
import { StoriesPanel } from './Stories';
import { Sheet, Spinner, ErrorLine, Avatar, tierOf } from '../ui';
import { sfx } from '../lib/sound';
import { josa } from '../lib/josa';
import { TREASURE_FX, BOARD_THEMES, TIER_THEMES, MEMO_GUARD_TEXT } from '../data/effects';
import { FxPreview, ThemePreview } from '../fx';

type Filter = 1 | 2 | 3 | 4 | 'mine';

export function DexScreen() {
  const { state } = useGame();
  const [tab, setTab] = useState<'people' | 'art' | 'book'>('people');
  const [people, setPeople] = useState<Person[] | null>(null);
  const [err, setErr] = useState(false);
  // 처음엔 내 초상화(가진 게 없으면 1티어)
  const [filter, setFilter] = useState<Filter>(() => (state!.owned.some((id) => (tierOf(id) ?? 0) >= 1) ? 'mine' : 1));
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Person | null>(null);
  const [reading, setReading] = useState(false);
  useEffect(() => { loadPeople().then(setPeople).catch(() => setErr(true)); }, []);
  const owned = useMemo(() => new Set(state!.owned), [state]);
  const shown = useMemo(() => {
    if (!people) return [];
    const term = q.trim().toLowerCase();
    const match = (p: Person) => !term || p.ko.includes(term) || p.en.toLowerCase().includes(term);
    let list: Person[];
    if (tab === 'art') list = people.filter((p) => p.cat === 'art' && match(p));
    else {
      list = people.filter((p) => tierOfCat(p.cat) !== null && match(p));
      if (!term) list = filter === 'mine' ? list.filter((p) => owned.has(p.id)) : list.filter((p) => tierOfCat(p.cat) === filter);
    }
    // 가진 것이 먼저, 그다음 아직 없는 것(각각 원래 순서)
    return [...list.filter((p) => owned.has(p.id)), ...list.filter((p) => !owned.has(p.id))];
  }, [people, tab, filter, q, owned]);
  const tierInfo = typeof filter === 'number' ? TIERS[filter - 1] : null;
  const opensAt = (t: number) => JOURNEY.find((j) => j.reward.tier === t)?.need;
  return (
    <div className="page">
      <h1 className="page-title">도감</h1>
      <div className="seg" role="tablist" aria-label="도감 종류">
        {([['people', '초상화'], ['art', '보물'], ['book', '이야기책']] as const).map(([k, l]) =>
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'book' ? (
        <>
          <p className="fine">그리스 신화 이야기 16장을 그림과 함께 읽어요. 1장은 처음부터, 스도쿠 {storyEvery(state!.profile.title)}판마다 한 장씩 열려요.</p>
          <button className="btn primary" onClick={() => setReading(true)}>이야기책 펼치기</button>
          {reading && <StoriesPanel onClose={() => setReading(false)} />}
        </>
      ) : (
        <>
          <label className="search"><IconSearch size={18} aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름으로 찾기" aria-label="이름으로 찾기" /></label>
          {tab === 'people' && !q && (
            <>
              <div className="chips" role="group" aria-label="티어">
                <button className={`chip${filter === 'mine' ? ' on' : ''}`} aria-pressed={filter === 'mine'} onClick={() => setFilter('mine')}>내 초상화 {state!.owned.filter((id) => tierOfCat(people?.find((x) => x.id === id)?.cat ?? '') !== null).length}</button>
                {TIERS.map((t) => (
                  <button key={t.tier} className={`chip${filter === t.tier ? ' on' : ''}`} aria-pressed={filter === t.tier} onClick={() => setFilter(t.tier)}>
                    {!tierOpen(state!, t.tier) && <IconLock size={14} aria-label="잠김" />}{t.tier}티어 {t.name}
                  </button>
                ))}
              </div>
              {tierInfo && !tierOpen(state!, tierInfo.tier) && <p className="fine">여정 {opensAt(tierInfo.tier)}판에서 열려요.</p>}
            </>
          )}
          {err && <ErrorLine msg="도감을 불러오지 못했어요." />}
          {!people && !err && <Spinner />}
          <ul className="dex-grid">
            {shown.map((p) => {
              const t = tierOfCat(p.cat);
              const has = owned.has(p.id);
              return (
                <li key={p.id}><button className={`dex-card${has ? ' owned' : ''}`} onClick={() => setOpen(p)}>
                  <Avatar id={p.id} size={88} />
                  <span>{p.ko}</span>
                  {t ? <small>{has ? <><IconCheck size={13} aria-hidden /> 내 초상화</> : tierOpen(state!, t) ? `✦ ${priceFor(t, TIERS[t - 1].price, state!.profile.title)}` : <><IconLock size={13} aria-hidden /> {t}티어</>}</small>
                    : <small>{has ? <><IconCheck size={13} aria-hidden /> {state!.profile.badge === p.id ? '달아 둔 보물' : '내 보물'}</> : `✦ ${priceFor(0, TREASURE_PRICE, state!.profile.title)}`}</small>}
                </button></li>
              );
            })}
          </ul>
          {people && shown.length === 0 && <p className="fine">{filter === 'mine' && !q ? '아직 모은 초상화가 없어요. 첫 판을 끝내면 선물로 받아요.' : '찾는 이름이 없어요.'}</p>}
        </>
      )}
      {open && <PersonSheet p={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function PersonSheet({ p, onClose }: { p: Person; onClose: () => void }) {
  const { state, profileId, patchState, toast, gotTitles } = useGame();
  const [story, setStory] = useState<[string, string][] | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [op] = useState(newOpId);
  useEffect(() => { if (more) loadStories().then((s) => setStory(s[p.id]?.s ?? [])).catch(() => setStory([])); }, [more, p.id]);
  const t = tierOfCat(p.cat);
  const treasure = p.cat === 'art';
  const s = state!;
  const has = s.owned.includes(p.id);
  const open = treasure || (t !== null && tierOpen(s, t));
  const base = treasure ? TREASURE_PRICE : t ? TIERS[t - 1].price : 0;
  const price = priceFor(treasure ? 0 : t ?? 0, base, s.profile.title); // 칭호 할인
  const buy = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await rpc('purchase_portrait', { p: profileId, portrait: p.id, op_id: op });
      patchState((st) => ({ ...st, balance: r.balance, owned: st.owned.includes(p.id) ? st.owned : [...st.owned, p.id],
        profile: r.badge ? { ...st.profile, badge: r.badge } : st.profile }));
      sfx.success(); toast(`${josa(p.ko, '을/를')} 모았어요`);
      gotTitles(r.titles);
    } catch (e) { setErr((e as ApiError).message); }
    setBusy(false);
  };
  const wear = async () => {
    try {
      await rpc('update_profile', { p: profileId, patch: { avatar_id: p.id } });
      patchState((st) => ({ ...st, profile: { ...st.profile, avatar_id: p.id } }));
      toast('내 초상화를 바꿨어요');
    } catch (e) { setErr((e as ApiError).message); }
  };
  const setBadge = async (id: string) => {
    try {
      await rpc('update_profile', { p: profileId, patch: { badge: id } });
      patchState((st) => ({ ...st, profile: { ...st.profile, badge: id } }));
      toast(id ? '프로필에 보물을 달았어요' : '프로필에서 보물을 뗐어요');
    } catch (e) { setErr((e as ApiError).message); }
  };
  return (
    <Sheet title={p.ko} onClose={onClose}>
      <div className={`person${has ? '' : ' locked'}`}>
        <div className="person-portrait"><Avatar id={p.id} size={150} /></div>
        {treasure && (
          <div className="buy-box">
            <span className="tier-badge">보물</span>
            {has ? (s.profile.badge === p.id
                ? <><span className="fine">프로필에 달려 있어요</span><button className="btn small" onClick={() => setBadge('')}>떼기</button></>
                : <button className="btn primary" onClick={() => setBadge(p.id)}>프로필에 달기</button>)
              : s.balance >= price
                ? <button className="btn primary" onClick={buy} disabled={busy}>✦ {price}로 모으기</button>
                : <span className="fine">✦ {price}. 별빛이 {price - s.balance} 더 필요해요.</span>}
          </div>
        )}
        {t && (
          <div className="buy-box">
            <span className="tier-badge">{t}티어</span>
            {has ? (s.profile.avatar_id === p.id ? <span className="fine">지금 내 초상화예요</span> : <button className="btn primary" onClick={wear}>내 초상화로 쓰기</button>)
              : open ? (s.balance >= price
                ? <button className="btn primary" onClick={buy} disabled={busy}>✦ {price}로 모으기</button>
                : <span className="fine">✦ {price}. 별빛이 {price - s.balance} 더 필요해요.</span>)
              : <span className="fine"><IconLock size={14} aria-hidden /> 여정 {JOURNEY.find((j) => j.reward.tier === t)?.need}판에서 열려요</span>}
          </div>
        )}
        {treasure && TREASURE_FX[p.id] && (
          <div className="fx-box">
            <FxPreview id={p.id} />
            <div><p><strong>꾸밈효과</strong></p><p>프로필에 달면 스도쿠 화면이 바뀌어요. {TREASURE_FX[p.id].text}</p><p className="fine">{MEMO_GUARD_TEXT}</p></div>
          </div>
        )}
        {(t === 2 || t === 3) && (
          <div className="fx-box">
            <ThemePreview id={`tier${t}`} />
            <div><p><strong>{t}티어 판</strong></p><p>{TIER_THEMES[`tier${t}`].text}</p></div>
          </div>
        )}
        {BOARD_THEMES[p.id] && (
          <div className="fx-box">
            <ThemePreview id={p.id} />
            <div><p><strong>테마판</strong></p><p>내 초상화로 쓰면 스도쿠 판이 바뀌어요. {BOARD_THEMES[p.id].text}</p></div>
          </div>
        )}
        {err && <ErrorLine msg={err} />}
        <p className="fine">{p.en}{p.dom ? `, ${p.dom}` : ''}</p>
        {p.sym?.length > 0 && <p className="fine">상징: {p.sym.join(', ')}</p>}
        <p>{p.ep}</p>
        {has
          ? !more && <button className="btn small" onClick={() => setMore(true)}>긴 이야기 읽기</button>
          : <p className="story-lock"><IconLock size={14} aria-hidden /> {treasure ? '이 보물을' : '이 초상화를'} 모으면 긴 이야기를 읽을 수 있어요.</p>}
        {more && !story && <Spinner />}
        {story?.length === 0 && <p className="fine">긴 이야기가 아직 없어요.</p>}
        {story?.map(([tt, b], i) => <section key={i}><h3>{tt}</h3><p>{b}</p></section>)}
        <p className="fine">신화 설명은 옛이야기를 간추린 것이며 이야기마다 내용이 조금씩 달라요.</p>
      </div>
    </Sheet>
  );
}
