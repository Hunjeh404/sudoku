// 가구를 눌렀을 때 열리는 창들
import { useEffect, useMemo, useState } from 'react';
import { IconPlayerPlay, IconPlayerStop, IconTrash, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { ITEM_BY_ID, ITEMS, MUSIC, STICKERS } from '../data/catalog';
import { useGame, asset, Layout, HomeData } from '../lib/store';
import { rpc, newOpId, ApiError } from '../lib/api';
import { loadBook, loadPeople, Chapter, Person } from '../lib/content';
import { playMusic, stopMusic, currentTrack, pluck, sfx, LYRE_NOTES } from '../lib/sound';
import { getLocal, setLocal } from '../lib/local';
import { Sheet, Avatar, ErrorLine, Spinner, timeAgo } from '../ui';
import type { PanelKind } from '../home/interactions';

export interface PanelCtx {
  kind: PanelKind;
  item: Layout;
  layout: Layout[]; // 같은 공간의 배치
  home: HomeData;
  ownerId: string;
  ownerName: string;
  isOwner: boolean;
  unlocks: string[]; // 집주인의 해금(방문 시에는 열람용으로 주인 기준 대신 방문자 기준 사용)
  onVisit: (id: string) => void;
  onMirror: (uid: string, face: string) => void;
}

export function PanelHost({ ctx, onClose }: { ctx: PanelCtx; onClose: () => void }) {
  switch (ctx.kind) {
    case 'exhibit': return <ExhibitPanel ctx={ctx} onClose={onClose} />;
    case 'friends': return <FriendsPanel ctx={ctx} onClose={onClose} />;
    case 'music': return <MusicPanel ctx={ctx} onClose={onClose} />;
    case 'guestbook': return <GuestbookPanel ownerId={ctx.ownerId} ownerName={ctx.ownerName} isOwner={ctx.isOwner} onClose={onClose} />;
    case 'gallery': return <GalleryPanel ctx={ctx} onClose={onClose} />;
    case 'stories': return <StoriesPanel unlocks={ctx.unlocks} onClose={onClose} />;
    case 'collection': return <CollectionPanel ctx={ctx} onClose={onClose} />;
    case 'lyre': return <LyrePanel onClose={onClose} />;
    case 'thread': return <ThreadPanel onClose={onClose} />;
    case 'mirror': return <MirrorPanel ctx={ctx} onClose={onClose} />;
  }
}

/** 주인이 창에서 바로 바꾸는 집 설정(전시 그림·음악) 저장 */
export function useHomePatch() {
  const { profileId, state, patchState, toast } = useGame();
  return async (patch: Partial<HomeData>) => {
    if (!state || !profileId) return false;
    const h = { ...state.home, ...patch };
    try {
      const r = await rpc('save_home', { p: profileId, expected_revision: state.home.revision, op_id: newOpId(),
        home: { room_layout: h.room_layout, garden_layout: h.garden_layout, exhibits: h.exhibits, notes: h.notes, featured_uid: h.featured_uid, music: h.music } });
      patchState((s) => ({ ...s, home: { ...h, revision: r.revision, saved_at: r.saved_at } }));
      toast('저장했어요');
      return true;
    } catch (e) {
      toast((e as ApiError).message);
      return false;
    }
  };
}

function ExhibitPanel({ ctx, onClose }: { ctx: PanelCtx; onClose: () => void }) {
  const child = ctx.layout.find((l) => l.parent === ctx.item.uid);
  const it = child && ITEM_BY_ID[child.item];
  const [person, setPerson] = useState<Person | null>(null);
  useEffect(() => { if (it?.sourceId) loadPeople().then((ps) => setPerson(ps.find((p) => p.id === it.sourceId) ?? null)).catch(() => {}); }, [it]);
  return (
    <Sheet title="보물 받침대" onClose={onClose}>
      {it ? (
        <div className="exhibit">
          <img src={asset(`assets/treasure/${it.id}.webp`)} alt={it.nameKo} />
          <h3>{it.nameKo}</h3>
          <p>{it.desc}</p>
          {person && <p className="myth">{person.ep}</p>}
          <p className="fine">신화 이야기는 원래 전해지는 이야기를 간추린 것이고, 터치 반응은 게임에서 만든 연출이에요.</p>
        </div>
      ) : <p>{ctx.isOwner ? '아직 올려 둔 보물이 없어요. 꾸미기에서 보물을 골라 이 받침대에 올려 보세요.' : '비어 있는 받침대예요.'}</p>}
    </Sheet>
  );
}

function FriendsPanel({ ctx, onClose }: { ctx: PanelCtx; onClose: () => void }) {
  const { profileId } = useGame();
  const [list, setList] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { rpc<any[]>('list_connections', { p: profileId }).then(setList).catch((e) => setErr(e.message)); }, [profileId]);
  return (
    <Sheet title="놀러 갈 집" onClose={onClose}>
      {err && <ErrorLine msg={err} />}
      {!list && !err && <Spinner />}
      {list?.length === 0 && <p>아직 연결된 집이 없어요. 친구 탭에서 가족이나 친구를 초대해 보세요.</p>}
      <ul className="conn-list">
        {list?.filter((c) => c.can_visit && c.id !== ctx.ownerId).map((c) => (
          <li key={c.id}><button className="conn" onClick={() => { onClose(); ctx.onVisit(c.id); }}>
            <Avatar id={c.avatar_id} size={44} /><span><strong>{c.home_name || c.nickname}</strong><small>{c.nickname}</small></span>
          </button></li>
        ))}
      </ul>
    </Sheet>
  );
}

function MusicPanel({ ctx, onClose }: { ctx: PanelCtx; onClose: () => void }) {
  const { settings, updateSettings } = useGame();
  const save = useHomePatch();
  const [playing, setPlaying] = useState<string | null>(currentTrack);
  const play = (id: string) => {
    if (!settings.sound) updateSettings({ sound: true });
    playMusic(import.meta.env.BASE_URL, id); setPlaying(id);
  };
  return (
    <Sheet title="악보대" onClose={onClose}>
      <p className="fine">{ctx.home.music ? `${ctx.ownerName}의 음악: ${MUSIC.find((m) => m.id === ctx.home.music)?.title ?? ''}` : '정해 둔 음악이 없어요.'} 재생 버튼을 눌러야 소리가 나요.</p>
      <ul className="music-list">
        {MUSIC.map((m) => (
          <li key={m.id}>
            <button className="icon-btn" aria-label={playing === m.id ? `${m.title} 멈추기` : `${m.title} 재생`}
              onClick={() => (playing === m.id ? (stopMusic(), setPlaying(null)) : play(m.id))}>
              {playing === m.id ? <IconPlayerStop size={20} /> : <IconPlayerPlay size={20} />}
            </button>
            <span className="grow">{m.title}</span>
            {ctx.isOwner && <button className="btn small" disabled={ctx.home.music === m.id} onClick={() => save({ music: m.id })}>
              {ctx.home.music === m.id ? '우리 집 음악' : '우리 집 음악으로'}</button>}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

export function GuestbookPanel({ ownerId, ownerName, isOwner, onClose }: { ownerId: string; ownerName: string; isOwner: boolean; onClose: () => void }) {
  const { profileId, toast } = useGame();
  const [list, setList] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const draftKey = `gbdraft:${profileId}:${ownerId}`;
  const [text, setText] = useState(() => getLocal(draftKey, ''));
  const [sticker, setSticker] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [opId, setOpId] = useState(newOpId);
  const load = () => rpc<any[]>('list_guestbook', { viewer: profileId, owner: ownerId }).then(setList).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [ownerId]);
  useEffect(() => { setLocal(draftKey, text); }, [text]);
  const chars = [...text].length;
  const send = async () => {
    setSending(true); setErr(null);
    try {
      await rpc('post_guestbook', { viewer: profileId, owner: ownerId, body: text, sticker, op_id: opId });
      setText(''); setSticker(null); setOpId(newOpId()); setLocal(draftKey, '');
      toast('방명록을 남겼어요');
      load();
    } catch (e) { setErr((e as ApiError).message); }
    setSending(false);
  };
  const del = async (id: string) => {
    try { await rpc('delete_guestbook', { actor: profileId, entry: id }); load(); } catch (e) { setErr((e as ApiError).message); }
  };
  return (
    <Sheet title={`${ownerName}의 방명록`} onClose={onClose}>
      {!isOwner && (
        <div className="compose">
          <textarea value={text} onChange={(e) => setText([...e.target.value].slice(0, 80).join(''))} rows={2} placeholder="다녀간 인사를 남겨 보세요" aria-label="방명록 글" />
          <div className="sticker-row" role="group" aria-label="스티커">
            {STICKERS.map((s) => <button key={s.id} className={`sticker${sticker === s.id ? ' on' : ''}`} aria-pressed={sticker === s.id} aria-label={s.label}
              onClick={() => setSticker(sticker === s.id ? null : s.id)}>{s.glyph}</button>)}
          </div>
          <div className="row-end"><small>{chars}/80</small>
            <button className="btn primary" onClick={send} disabled={sending || (!text.trim() && !sticker)}>{sending ? '보내는 중' : '남기기'}</button></div>
        </div>
      )}
      {err && <ErrorLine msg={err} />}
      {!list && !err && <Spinner />}
      {list?.length === 0 && <p className="fine">아직 남긴 글이 없어요.</p>}
      <ul className="gb-list">
        {list?.map((g) => (
          <li key={g.id}>
            <Avatar id={g.author.avatar_id} size={36} />
            <div className="grow">
              <div className="gb-meta"><strong>{g.author.nickname}</strong><small>{timeAgo(g.created_at)}</small></div>
              <p>{g.sticker && <span className="gb-sticker" aria-label={STICKERS.find((s) => s.id === g.sticker)?.label}>{STICKERS.find((s) => s.id === g.sticker)?.glyph}</span>}{g.text}</p>
            </div>
            {g.can_delete && <button className="icon-btn" aria-label="지우기" onClick={() => del(g.id)}><IconTrash size={18} /></button>}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function GalleryPanel({ ctx, onClose }: { ctx: PanelCtx; onClose: () => void }) {
  const save = useHomePatch();
  const [book, setBook] = useState<Chapter[] | null>(null);
  useEffect(() => { loadBook().then(setBook).catch(() => setBook([])); }, []);
  const scenes = useMemo(() => (book ?? []).filter((c) => c.open && ctx.unlocks.includes(`chapter:${c.n}`))
    .flatMap((c) => (c.b ?? []).filter((b: any) => b.k === 'img').map((b: any) => ({ f: b.f as string, cap: b.cap as string, ch: c.t }))), [book, ctx.unlocks]);
  const current = ctx.home.exhibits[ctx.item.uid];
  const [pick, setPick] = useState<string | null>(current ?? null);
  const shown = pick ?? current;
  const cap = scenes.find((s) => s.f === shown)?.cap;
  return (
    <Sheet title="신화 액자" onClose={onClose} wide>
      {shown ? <figure className="gallery-big"><img src={asset(shown)} alt={cap ?? '신화 그림'} />{cap && <figcaption>{cap}</figcaption>}</figure>
        : <p>{ctx.isOwner ? '아래에서 액자에 넣을 그림을 골라 보세요.' : '아직 비어 있는 액자예요.'}</p>}
      {ctx.isOwner && (
        <>
          {!book && <Spinner />}
          {book && scenes.length === 0 && <p className="fine">이야기를 열면 그 장의 그림을 걸 수 있어요.</p>}
          <div className="thumb-row">
            {scenes.map((s) => <button key={s.f} className={`thumb${s.f === shown ? ' on' : ''}`} onClick={() => setPick(s.f)} aria-label={s.cap}>
              <img src={asset(s.f)} alt="" loading="lazy" /></button>)}
          </div>
          <div className="row-end"><button className="btn primary" disabled={!pick || pick === current}
            onClick={async () => { if (await save({ exhibits: { ...ctx.home.exhibits, [ctx.item.uid]: pick! } })) onClose(); }}>액자에 걸기</button></div>
        </>
      )}
    </Sheet>
  );
}

export function StoriesPanel({ unlocks, onClose, startChapter }: { unlocks: string[]; onClose: () => void; startChapter?: number }) {
  const [book, setBook] = useState<Chapter[] | null>(null);
  const [err, setErr] = useState(false);
  const [ch, setCh] = useState<number | null>(startChapter ?? null);
  const [page, setPage] = useState(0);
  useEffect(() => { loadBook().then(setBook).catch(() => setErr(true)); }, []);
  const open = (book ?? []).filter((c) => c.open);
  const chapter = open.find((c) => c.n === ch);
  // 쪽 나누기: 그림 하나 + 이어지는 글
  const pages = useMemo(() => {
    if (!chapter?.b) return [];
    const out: { img?: any; text: string[] }[] = [];
    for (const b of chapter.b) {
      if (b.k === 'img') out.push({ img: b, text: [] });
      else if (b.k === 'p') { if (!out.length) out.push({ text: [] }); out[out.length - 1].text.push(b.t); }
    }
    return out;
  }, [chapter]);
  return (
    <Sheet title={chapter ? chapter.t : '두루마리 책장'} onClose={onClose} wide>
      {err && <ErrorLine msg="이야기를 불러오지 못했어요." />}
      {!book && !err && <Spinner />}
      {book && !chapter && (
        <ul className="chapter-list">
          {book.map((c) => {
            const unlocked = c.open && unlocks.includes(`chapter:${c.n}`);
            return <li key={c.n}>
              <button className="chapter" disabled={!unlocked} onClick={() => { setCh(c.n); setPage(0); }}>
                <span className="ch-n">{c.n}장</span><span className="grow">{c.t}</span>
                <small>{unlocked ? '읽기' : c.open ? '여정에서 열려요' : '준비 중'}</small>
              </button></li>;
          })}
        </ul>
      )}
      {chapter && pages[page] && (
        <article className="story-page">
          {pages[page].img && <figure><img src={asset(pages[page].img.f)} alt={pages[page].img.cap} /></figure>}
          {pages[page].text.map((t, i) => <p key={i}>{t}</p>)}
          <nav className="pager">
            <button className="icon-btn" aria-label="이전 쪽" disabled={page === 0} onClick={() => { setPage(page - 1); sfx.tap(); }}><IconChevronLeft /></button>
            <span>{page + 1} / {pages.length}</span>
            {page < pages.length - 1
              ? <button className="icon-btn" aria-label="다음 쪽" onClick={() => { setPage(page + 1); sfx.tap(); }}><IconChevronRight /></button>
              : <button className="btn small" onClick={() => setCh(null)}>목록으로</button>}
          </nav>
        </article>
      )}
    </Sheet>
  );
}

function CollectionPanel({ ctx, onClose }: { ctx: PanelCtx; onClose: () => void }) {
  const { state } = useGame();
  const treasures = ITEMS.filter((i) => i.kind === 'treasure');
  const placed = new Set(ctx.layout.map((l) => l.item));
  const owned = (id: string) => (ctx.isOwner ? (state?.inventory[id] ?? 0) > 0 : placed.has(id));
  return (
    <Sheet title={`${ctx.ownerName}의 보물 상자`} onClose={onClose}>
      <div className="treasure-grid">
        {treasures.map((t) => (
          <div key={t.id} className={`treasure-cell${owned(t.id) ? '' : ' missing'}`}>
            <img src={asset(`assets/treasure/${t.id}.webp`)} alt="" loading="lazy" />
            <span>{owned(t.id) ? t.nameKo : '아직 없음'}</span>
          </div>
        ))}
      </div>
      {!ctx.isOwner && <p className="fine">이 집에 놓인 보물만 보여요.</p>}
    </Sheet>
  );
}

function LyrePanel({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings } = useGame();
  const [hit, setHit] = useState<number | null>(null);
  const strum = (i: number) => { pluck(i); setHit(i); window.setTimeout(() => setHit(null), 200); };
  return (
    <Sheet title="작은 리라" onClose={onClose}>
      {!settings.sound && <p className="fine">소리가 꺼져 있어요. <button className="link" onClick={() => updateSettings({ sound: true })}>소리 켜기</button></p>}
      <div className="lyre">
        <img src={asset('assets/treasure/lyre.webp')} alt="" aria-hidden />
        <div className="strings">
          {LYRE_NOTES.map((_, i) => (
            <button key={i} className={`string${hit === i ? ' hit' : ''}`} aria-label={`${i + 1}번 줄`}
              onPointerDown={() => strum(i)} onPointerEnter={(e) => { if (e.buttons) strum(i); }} onKeyDown={(e) => { if (e.key === 'Enter') strum(i); }} />
          ))}
        </div>
      </div>
      <p className="fine">줄을 누르거나 손가락으로 쓸어 보세요.</p>
    </Sheet>
  );
}

// 아리아드네의 실: 별을 1부터 순서대로 이으면 미궁 길이 완성되는 작은 놀이
function ThreadPanel({ onClose }: { onClose: () => void }) {
  const make = () => Array.from({ length: 7 }, (_, i) => ({ x: 12 + ((i * 37 + 11) % 76), y: 14 + ((i * 53 + 7) % 70), n: i + 1 }))
    .sort(() => Math.random() - 0.5).map((s, i) => ({ ...s, n: i + 1 }));
  const [stars, setStars] = useState(make);
  const [next, setNext] = useState(1);
  const [wrong, setWrong] = useState<number | null>(null);
  const done = next > stars.length;
  const tap = (n: number) => {
    if (n === next) { setNext(n + 1); pluck((n - 1) % 7); if (n === stars.length) sfx.success(); }
    else { setWrong(n); window.setTimeout(() => setWrong(null), 300); }
  };
  const path = stars.filter((s) => s.n < next).sort((a, b) => a.n - b.n);
  return (
    <Sheet title="아리아드네의 실타래" onClose={onClose}>
      <p className="fine">{done ? '미궁을 빠져나오는 길이 생겼어요!' : `${next}번 별을 눌러 실을 이어 보세요.`}</p>
      <svg className="thread-board" viewBox="0 0 100 100" role="group" aria-label="별 잇기">
        <polyline points={path.map((s) => `${s.x},${s.y}`).join(' ')} fill="none" stroke="#C0392B" strokeWidth={1.2} strokeLinecap="round" />
        {stars.map((s) => (
          <g key={s.n} role="button" tabIndex={0} aria-label={`${s.n}번 별`} className={`tstar${s.n < next ? ' done' : ''}${wrong === s.n ? ' wrong' : ''}`}
            onClick={() => tap(s.n)} onKeyDown={(e) => { if (e.key === 'Enter') tap(s.n); }}>
            <circle cx={s.x} cy={s.y} r={6} />
            <text x={s.x} y={s.y + 1.8} textAnchor="middle">{s.n}</text>
          </g>
        ))}
      </svg>
      {done && <div className="row-end"><button className="btn" onClick={() => { setStars(make()); setNext(1); }}>다시 하기</button></div>}
    </Sheet>
  );
}

function MirrorPanel({ ctx, onClose }: { ctx: PanelCtx; onClose: () => void }) {
  const faces = ['perseus', 'athena', 'medusa', 'pegasus', 'hermes', 'andromeda'];
  const [face, setFace] = useState<string | null>(null);
  return (
    <Sheet title="거울 방패" onClose={onClose}>
      <div className="mirror">
        <div className="mirror-face">{face ? <Avatar id={face} size={140} /> : <span>누구를 비춰 볼까요?</span>}</div>
      </div>
      <div className="face-row">
        {faces.map((f) => <button key={f} className={`avatar-pick${face === f ? ' on' : ''}`} aria-pressed={face === f} aria-label={f}
          onClick={() => { setFace(f); sfx.chime(); ctx.onMirror(ctx.item.uid, f); }}><Avatar id={f} size={48} framed={face === f} /></button>)}
      </div>
      <p className="fine">방패를 다시 누르면 고른 얼굴이 잠깐 비쳐요. 이 기기에서만 보여요.</p>
    </Sheet>
  );
}
