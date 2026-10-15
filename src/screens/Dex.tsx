// 도감: 인물·보물·이야기책. 데이터와 그림은 이 화면을 열 때 불러온다.
import { useEffect, useMemo, useState } from 'react';
import { IconSearch } from '@tabler/icons-react';
import { useGame } from '../lib/store';
import { loadPeople, loadStories, Person, CATEGORY_KO } from '../lib/content';
import { ITEMS } from '../data/catalog';
import { StoriesPanel } from '../panels/Panels';
import { Sheet, Spinner, ErrorLine, Avatar } from '../ui';

export function DexScreen() {
  const { state } = useGame();
  const [tab, setTab] = useState<'people' | 'art' | 'book'>('people');
  const [people, setPeople] = useState<Person[] | null>(null);
  const [err, setErr] = useState(false);
  const [cat, setCat] = useState<string>('oly');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Person | null>(null);
  const [reading, setReading] = useState(false);
  useEffect(() => { loadPeople().then(setPeople).catch(() => setErr(true)); }, []);
  const gameTreasures = new Set(ITEMS.filter((i) => i.kind === 'treasure').map((i) => i.id));
  const shown = useMemo(() => {
    if (!people) return [];
    const term = q.trim().toLowerCase();
    return people.filter((p) => (tab === 'art' ? p.cat === 'art' : p.cat !== 'art'))
      .filter((p) => (term ? p.ko.includes(term) || p.en.toLowerCase().includes(term) : tab === 'art' || p.cat === cat));
  }, [people, tab, cat, q]);
  return (
    <div className="page">
      <h1 className="page-title">도감</h1>
      <div className="seg" role="tablist" aria-label="도감 종류">
        {([['people', '인물'], ['art', '보물'], ['book', '이야기책']] as const).map(([k, l]) =>
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'book' ? (
        <>
          <p className="fine">여정을 걸으면 이야기가 하나씩 열려요. 집에 두루마리 책장을 두면 거기서도 읽을 수 있어요.</p>
          <button className="btn primary" onClick={() => setReading(true)}>이야기책 펼치기</button>
          {reading && <StoriesPanel unlocks={state!.unlocks} onClose={() => setReading(false)} />}
        </>
      ) : (
        <>
          <label className="search"><IconSearch size={18} aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'art' ? '보물 이름' : '이름으로 찾기'} aria-label="이름으로 찾기" /></label>
          {tab === 'people' && !q && (
            <div className="chips" role="group" aria-label="분류">
              {Object.entries(CATEGORY_KO).filter(([k]) => k !== 'art').map(([k, l]) =>
                <button key={k} className={`chip${cat === k ? ' on' : ''}`} aria-pressed={cat === k} onClick={() => setCat(k)}>{l}</button>)}
            </div>
          )}
          {err && <ErrorLine msg="도감을 불러오지 못했어요." />}
          {!people && !err && <Spinner />}
          <ul className="dex-grid">
            {shown.map((p) => (
              <li key={p.id}><button className="dex-card" onClick={() => setOpen(p)}>
                <Avatar id={p.id} size={88} />
                <span>{p.ko}</span>
                {tab === 'art' && gameTreasures.has(p.id) && <small>{(state!.inventory[p.id] ?? 0) > 0 ? '내 보물' : '집에 둘 수 있음'}</small>}
              </button></li>
            ))}
          </ul>
          {people && shown.length === 0 && <p className="fine">찾는 이름이 없어요.</p>}
        </>
      )}
      {open && <PersonSheet p={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function PersonSheet({ p, onClose }: { p: Person; onClose: () => void }) {
  const [story, setStory] = useState<[string, string][] | null>(null);
  const [more, setMore] = useState(false);
  useEffect(() => { if (more) loadStories().then((s) => setStory(s[p.id]?.s ?? [])).catch(() => setStory([])); }, [more, p.id]);
  return (
    <Sheet title={p.ko} onClose={onClose}>
      <div className="person">
        <div className="person-portrait"><Avatar id={p.id} size={150} /></div>
        <p className="fine">{p.en}{p.dom ? `, ${p.dom}` : ''}</p>
        {p.sym?.length > 0 && <p className="fine">상징: {p.sym.join(', ')}</p>}
        <p>{p.ep}</p>
        {!more && <button className="btn small" onClick={() => setMore(true)}>긴 이야기 읽기</button>}
        {more && !story && <Spinner />}
        {story?.length === 0 && <p className="fine">긴 이야기가 아직 없어요.</p>}
        {story?.map(([t, b], i) => <section key={i}><h3>{t}</h3><p>{b}</p></section>)}
        <p className="fine">신화 설명은 옛이야기를 간추린 것이며 이야기마다 내용이 조금씩 달라요.</p>
      </div>
    </Sheet>
  );
}
