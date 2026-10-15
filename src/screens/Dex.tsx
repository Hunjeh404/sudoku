// 도감 겸 초상화 상점: 인물(티어별, 가진 것 표시, 별빛으로 모으기)·보물·이야기책
import { useEffect, useMemo, useState } from 'react';
import { IconSearch, IconLock, IconCheck } from '@tabler/icons-react';
import { useGame, tierOpen } from '../lib/store';
import { rpc, newOpId, ApiError } from '../lib/api';
import { loadPeople, loadStories, Person } from '../lib/content';
import { TIERS, tierOfCat, JOURNEY } from '../data/catalog';
import { StoriesPanel } from './Stories';
import { Sheet, Spinner, ErrorLine, Avatar } from '../ui';
import { sfx } from '../lib/sound';
import { josa } from '../lib/josa';

type Filter = 1 | 2 | 3 | 4 | 'mine';

export function DexScreen() {
  const { state } = useGame();
  const [tab, setTab] = useState<'people' | 'art' | 'book'>('people');
  const [people, setPeople] = useState<Person[] | null>(null);
  const [err, setErr] = useState(false);
  const [filter, setFilter] = useState<Filter>(1);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Person | null>(null);
  const [reading, setReading] = useState(false);
  useEffect(() => { loadPeople().then(setPeople).catch(() => setErr(true)); }, []);
  const owned = useMemo(() => new Set(state!.owned), [state]);
  const shown = useMemo(() => {
    if (!people) return [];
    const term = q.trim().toLowerCase();
    if (tab === 'art') return people.filter((p) => p.cat === 'art' && (!term || p.ko.includes(term) || p.en.toLowerCase().includes(term)));
    const list = people.filter((p) => tierOfCat(p.cat) !== null);
    if (term) return list.filter((p) => p.ko.includes(term) || p.en.toLowerCase().includes(term));
    return filter === 'mine' ? list.filter((p) => owned.has(p.id)) : list.filter((p) => tierOfCat(p.cat) === filter);
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
          <p className="fine">그리스 신화 이야기를 그림과 함께 읽어요.</p>
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
                {TIERS.map((t) => (
                  <button key={t.tier} className={`chip${filter === t.tier ? ' on' : ''}`} aria-pressed={filter === t.tier} onClick={() => setFilter(t.tier)}>
                    {!tierOpen(state!, t.tier) && <IconLock size={14} aria-label="잠김" />}{t.tier}티어 {t.name}
                  </button>
                ))}
                <button className={`chip${filter === 'mine' ? ' on' : ''}`} aria-pressed={filter === 'mine'} onClick={() => setFilter('mine')}>내 초상화 {state!.owned.length}</button>
              </div>
              {tierInfo && (
                <p className="fine">{tierOpen(state!, tierInfo.tier)
                  ? `한 장에 별빛 ${tierInfo.price}. 지금 별빛 ${state!.balance}.`
                  : `여정 ${opensAt(tierInfo.tier)}판에서 열려요. 그때부터 한 장에 별빛 ${tierInfo.price}로 모을 수 있어요.`}</p>
              )}
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
                  <Avatar id={p.id} size={88} framed={has} />
                  <span>{p.ko}</span>
                  {t && <small>{has ? <><IconCheck size={13} aria-hidden /> 내 초상화</> : tierOpen(state!, t) ? `✦ ${TIERS[t - 1].price}` : <><IconLock size={13} aria-hidden /> {t}티어</>}</small>}
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
  const { state, profileId, patchState, toast } = useGame();
  const [story, setStory] = useState<[string, string][] | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [op] = useState(newOpId);
  useEffect(() => { if (more) loadStories().then((s) => setStory(s[p.id]?.s ?? [])).catch(() => setStory([])); }, [more, p.id]);
  const t = tierOfCat(p.cat);
  const s = state!;
  const has = s.owned.includes(p.id);
  const open = t !== null && tierOpen(s, t);
  const price = t ? TIERS[t - 1].price : 0;
  const buy = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await rpc('purchase_portrait', { p: profileId, portrait: p.id, op_id: op });
      patchState((st) => ({ ...st, balance: r.balance, owned: st.owned.includes(p.id) ? st.owned : [...st.owned, p.id] }));
      sfx.success(); toast(`${josa(p.ko, '을/를')} 모았어요`);
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
  return (
    <Sheet title={p.ko} onClose={onClose}>
      <div className="person">
        <div className="person-portrait"><Avatar id={p.id} size={150} framed={has} /></div>
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
        {err && <ErrorLine msg={err} />}
        <p className="fine">{p.en}{p.dom ? `, ${p.dom}` : ''}</p>
        {p.sym?.length > 0 && <p className="fine">상징: {p.sym.join(', ')}</p>}
        <p>{p.ep}</p>
        {!more && <button className="btn small" onClick={() => setMore(true)}>긴 이야기 읽기</button>}
        {more && !story && <Spinner />}
        {story?.length === 0 && <p className="fine">긴 이야기가 아직 없어요.</p>}
        {story?.map(([tt, b], i) => <section key={i}><h3>{tt}</h3><p>{b}</p></section>)}
        <p className="fine">신화 설명은 옛이야기를 간추린 것이며 이야기마다 내용이 조금씩 달라요.</p>
      </div>
    </Sheet>
  );
}
