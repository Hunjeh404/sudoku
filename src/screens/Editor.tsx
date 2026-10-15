// 꾸미기: 보관함·상점·배치 편집. 완료는 서버 저장이 성공해야 닫히고, 실패하면 초안을 유지한다.
import { useEffect, useMemo, useState } from 'react';
import {
  IconArrowBackUp, IconArrowForwardUp, IconArrowUpRight, IconArrowDownRight, IconArrowDownLeft, IconArrowUpLeft,
  IconArchive, IconLock, IconTarget, IconCheck,
} from '@tabler/icons-react';
import { ITEMS, ITEM_BY_ID, Space, JOURNEY } from '../data/catalog';
import { useGame, asset, Layout, HomeData } from '../lib/store';
import { rpc, newOpId, ApiError } from '../lib/api';
import { getLocal, setLocal, delLocal } from '../lib/local';
import { SpaceView } from '../home/SpaceView';
import { checkLayout, findFreeSpot, stackInfo, COLS, ROWS } from '../home/geometry';
import { Sheet, Starlight, ErrorLine } from '../ui';
import { sfx } from '../lib/sound';
import { josa } from '../lib/josa';

type Draft = Pick<HomeData, 'room_layout' | 'garden_layout' | 'exhibits' | 'notes' | 'featured_uid' | 'music'>;
const PROBLEM_KO: Record<string, string> = {
  overlap: '다른 물건과 겹쳐요', out_of_bounds: '바닥 밖으로 나갔어요', no_support: '받침 위에 놓아야 해요',
  slot_taken: '받침에 이미 다른 물건이 있어요', bad_place: '이 공간에는 놓을 수 없어요', not_owned: '가진 것보다 많아요',
  too_high: '3층까지만 쌓을 수 있어요',
};

export function Editor({ initialSpace, onClose }: { initialSpace: Space; onClose: () => void }) {
  const { state, profileId, session, patchState, toast } = useGame();
  const draftKey = `homedraft:${session?.user.id}:${profileId}`;
  const fromState = (): Draft => {
    const h = state!.home;
    return { room_layout: h.room_layout, garden_layout: h.garden_layout, exhibits: h.exhibits, notes: h.notes, featured_uid: h.featured_uid, music: h.music };
  };
  const saved = getLocal<{ base: number; draft: Draft } | null>(draftKey, null);
  const [space, setSpace] = useState<Space>(initialSpace);
  const [hist, setHist] = useState<{ list: Draft[]; i: number }>(() => ({ list: [saved && saved.base === state!.home.revision ? saved.draft : fromState()], i: 0 }));
  const draft = hist.list[hist.i];
  const [sel, setSel] = useState<string | null>(null);
  const [tray, setTray] = useState<'storage' | 'shop'>('storage');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [buying, setBuying] = useState<{ id: string; op: string } | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);

  useEffect(() => { setLocal(draftKey, { base: state!.home.revision, draft }); }, [draft]);

  const key = space === 'room' ? 'room_layout' : 'garden_layout';
  const layout = draft[key];
  const commit = (next: Draft) => setHist((h) => ({ list: [...h.list.slice(0, h.i + 1), next].slice(-50), i: Math.min(h.i + 1, 49) }));
  const setLayout = (l: Layout[]) => commit({ ...draft, [key]: l });

  const placedCount = useMemo(() => {
    const c: Record<string, number> = {};
    [...draft.room_layout, ...draft.garden_layout].forEach((l) => (c[l.item] = (c[l.item] ?? 0) + 1));
    return c;
  }, [draft]);
  const left = (id: string) => (state!.inventory[id] ?? 0) - (placedCount[id] ?? 0);
  const problems = useMemo(() => checkLayout(space, layout), [space, layout]);
  const allProblems = useMemo(() => [...checkLayout('room', draft.room_layout), ...checkLayout('garden', draft.garden_layout)], [draft]);

  /** 옮기기: 위에 쌓인 물건은 함께 옮기고, 옮긴 묶음은 배열 맨 뒤로(나중에 놓은 것이 위로 쌓임) */
  const relocate = (uid: string, nx: number, ny: number | undefined) => {
    const l = layout.find((q) => q.uid === uid);
    if (!l || l.x === undefined) return null;
    const it = ITEM_BY_ID[l.item];
    if (it.surface === 'wallRight' || it.surface === 'rug') {
      return layout.map((q) => (q.uid === uid ? { ...q, x: nx, ...(ny !== undefined && it.surface === 'rug' ? { y: ny } : {}) } : q));
    }
    const info = stackInfo(layout);
    const carried = new Set<string>([uid]);
    for (const q of layout) if ((info.get(q.uid)?.under ?? []).some((u) => carried.has(u))) carried.add(q.uid);
    let dx = nx - l.x, dy = (ny ?? l.y ?? 0) - (l.y ?? 0);
    for (const q of layout) {
      if (!carried.has(q.uid)) continue;
      const qi = ITEM_BY_ID[q.item];
      dx = Math.max(-q.x!, Math.min(COLS - qi.fw - q.x!, dx));
      dy = Math.max(-(q.y ?? 0), Math.min(ROWS - qi.fh - (q.y ?? 0), dy));
    }
    const moved = layout.filter((q) => carried.has(q.uid)).map((q) => ({ ...q, x: q.x! + dx, y: (q.y ?? 0) + dy }));
    return [...layout.filter((q) => !carried.has(q.uid)), ...moved];
  };
  const moveTo = (uid: string, u: number, v: number) => {
    const l = layout.find((x) => x.uid === uid);
    if (!l) return null;
    const it = ITEM_BY_ID[l.item];
    if (it.surface === 'supportSlot' || it.surface === 'artifact') return null;
    const x = Math.max(0, Math.min(COLS - it.fw, Math.round(u - it.fw / 2)));
    const y = it.surface === 'wallRight' ? undefined : Math.max(0, Math.min(ROWS - it.fh, Math.round(v - it.fh / 2)));
    return relocate(uid, x, y);
  };
  const [dragPreview, setDragPreview] = useState<Layout[] | null>(null);
  const shown = dragPreview ?? layout;

  const nudge = (du: number, dv: number) => {
    const l = layout.find((x) => x.uid === sel);
    if (!l || l.x === undefined) return;
    const it = ITEM_BY_ID[l.item];
    const x = Math.max(0, Math.min(COLS - it.fw, l.x + du));
    const y = it.surface === 'wallRight' ? undefined : Math.max(0, Math.min(ROWS - it.fh, (l.y ?? 0) + dv));
    const n = relocate(sel!, x, y);
    if (n) setLayout(n);
  };
  const store = (uid: string) => {
    const kids = layout.filter((q) => q.parent === uid).map((q) => q.uid);
    const gone = new Set([uid, ...kids]);
    const notes = { ...draft.notes }; const exhibits = { ...draft.exhibits };
    gone.forEach((g) => { delete notes[g]; delete exhibits[g]; });
    commit({ ...draft, [key]: layout.filter((q) => !gone.has(q.uid)), notes, exhibits, featured_uid: gone.has(draft.featured_uid ?? '') ? null : draft.featured_uid });
    setSel(null);
  };
  const place = (id: string) => {
    const it = ITEM_BY_ID[id];
    if (!it.spaces.includes(space)) { toast(space === 'room' ? '정원에 놓는 물건이에요' : '실내에 놓는 물건이에요'); return; }
    const uid = `${space[0]}${Date.now().toString(36)}${Math.floor(Math.random() * 99)}`;
    if (it.surface === 'artifact' || it.surface === 'supportSlot') {
      const parent = layout.find((p) => {
        const pi = ITEM_BY_ID[p.item];
        return ((pi.supports ?? []).includes(it.surface) || (pi.supports ?? []).includes(it.id)) && !layout.some((c) => c.parent === p.uid);
      });
      if (!parent) { toast(it.surface === 'artifact' ? '빈 보물 받침대가 필요해요' : '빈 찻상이 필요해요'); return; }
      setLayout([...layout, { uid, item: id, parent: parent.uid }]);
    } else {
      const spot = findFreeSpot(space, layout, id);
      if (!spot) { toast('빈자리가 없어요'); return; }
      setLayout([...layout, { uid, item: id, x: spot.x, ...(it.surface === 'wallRight' ? {} : { y: spot.y }) }]);
    }
    setSel(uid); sfx.pop();
  };

  const save = async (baseRevision = state!.home.revision) => {
    if (allProblems.length) { setErr('빨갛게 표시된 물건을 먼저 옮겨 주세요.'); return; }
    setSaving(true); setErr(null);
    try {
      const r = await rpc('save_home', { p: profileId, expected_revision: baseRevision, home: draft, op_id: newOpId() });
      patchState((s) => ({ ...s, home: { ...s.home, ...draft, revision: r.revision, saved_at: r.saved_at } }));
      delLocal(draftKey);
      toast('집을 저장했어요');
      onClose();
    } catch (e) {
      const ae = e as ApiError;
      if (ae.code === 'conflict') setConflict(true);
      else setErr(ae.message);
    }
    setSaving(false);
  };
  const reloadServer = async () => {
    const s = await rpc('get_state', { p: profileId });
    patchState(() => s);
    delLocal(draftKey);
    setHist({ list: [{ room_layout: s.home.room_layout, garden_layout: s.home.garden_layout, exhibits: s.home.exhibits, notes: s.home.notes, featured_uid: s.home.featured_uid, music: s.home.music }], i: 0 });
    setConflict(false);
  };
  const overwriteWithMine = async () => {
    const s = await rpc('get_state', { p: profileId });
    setConflict(false);
    patchState((cur) => ({ ...cur, home: { ...cur.home, revision: s.home.revision } }));
    await save(s.home.revision);
  };

  const buy = async () => {
    if (!buying) return;
    try {
      const r = await rpc('purchase_item', { p: profileId, item: buying.id, op_id: buying.op });
      patchState((s) => ({ ...s, balance: r.balance, inventory: { ...s.inventory, [buying.id]: r.quantity } }));
      sfx.success();
      toast(`${josa(ITEM_BY_ID[buying.id].nameKo, '을/를')} 샀어요`);
      setBuying(null);
      setTray('storage');
    } catch (e) { toast((e as ApiError).message); setBuying(null); }
  };
  const setGoal = async (id: string) => {
    await rpc('set_goal', { p: profileId, item: id }).catch(() => {});
    patchState((s) => ({ ...s, profile: { ...s.profile, goal_item: id } }));
    toast('목표로 정했어요');
  };

  const selItem = sel ? layout.find((l) => l.uid === sel) : null;
  const selIt = selItem ? ITEM_BY_ID[selItem.item] : null;
  const count = state!.quest.completed_count;
  const storageItems = ITEMS.filter((i) => left(i.id) > 0);

  return (
    <div className="editor">
      <header className="editor-head">
        <button className="btn" onClick={() => { delLocal(draftKey); onClose(); }}>취소</button>
        <div className="seg" role="tablist" aria-label="공간">
          {(['room', 'garden'] as Space[]).map((sp) => <button key={sp} role="tab" aria-selected={space === sp} className={space === sp ? 'on' : ''}
            onClick={() => { setSpace(sp); setSel(null); }}>{sp === 'room' ? '실내' : '정원'}</button>)}
        </div>
        <button className="btn primary" onClick={() => save()} disabled={saving}><IconCheck size={18} aria-hidden />{saving ? '저장 중' : '완료'}</button>
      </header>
      <div className="editor-tools">
        <button className="icon-btn" aria-label="되돌리기" disabled={hist.i === 0} onClick={() => setHist((h) => ({ ...h, i: h.i - 1 }))}><IconArrowBackUp /></button>
        <button className="icon-btn" aria-label="다시 하기" disabled={hist.i >= hist.list.length - 1} onClick={() => setHist((h) => ({ ...h, i: h.i + 1 }))}><IconArrowForwardUp /></button>
        <span className="grow fine">물건을 눌러 고르고 끌어서 옮겨요. 다른 물건 위로 옮기면 쌓여요.</span>
        <Starlight value={state!.balance} />
      </div>
      <SpaceView space={space} layout={shown} mode="edit" selectedUid={sel} problems={problems} label={space === 'room' ? '실내 꾸미기' : '정원 꾸미기'}
        onTapItem={(l) => setSel(sel === l.uid ? null : l.uid)}
        onTapFloor={(u, v) => { if (sel) { const n = moveTo(sel, u, v); if (n) setLayout(n); } }}
        onDragItem={(uid, u, v, done) => { const n = moveTo(uid, u, v); if (!n) return; if (done) { setDragPreview(null); setLayout(n); } else setDragPreview(n); }} />
      {err && <ErrorLine msg={err} />}

      {selItem && selIt ? (
        <section className="sel-bar" aria-label="고른 물건">
          <div className="sel-name"><strong>{selIt.nameKo}</strong>
            {problems.find((x) => x.uid === sel) && <small className="warn">{PROBLEM_KO[problems.find((x) => x.uid === sel)!.code]}</small>}</div>
          {selItem.x !== undefined && (
            <div className="nudge" role="group" aria-label="한 칸씩 옮기기">
              <button className="icon-btn" aria-label="왼쪽 위로" onClick={() => nudge(-1, 0)}><IconArrowUpLeft /></button>
              <button className="icon-btn" aria-label="오른쪽 위로" disabled={selIt.surface === 'wallRight'} onClick={() => nudge(0, -1)}><IconArrowUpRight /></button>
              <button className="icon-btn" aria-label="왼쪽 아래로" disabled={selIt.surface === 'wallRight'} onClick={() => nudge(0, 1)}><IconArrowDownLeft /></button>
              <button className="icon-btn" aria-label="오른쪽 아래로" onClick={() => nudge(1, 0)}><IconArrowDownRight /></button>
            </div>
          )}
          <div className="sel-actions">
            <button className="btn small" onClick={() => setNoteFor(sel)}>{draft.notes[sel!] ? '쪽지 고치기' : '숨은 쪽지'}</button>
            <button className={`btn small${draft.featured_uid === sel ? ' on' : ''}`} aria-pressed={draft.featured_uid === sel}
              onClick={() => commit({ ...draft, featured_uid: draft.featured_uid === sel ? null : sel })}>오늘의 전시품</button>
            <button className="btn small" onClick={() => store(sel!)}><IconArchive size={16} aria-hidden />보관</button>
            <button className="btn small primary" onClick={() => setSel(null)}>고르기 끝</button>
          </div>
        </section>
      ) : (
        <section className="tray">
          <div className="seg" role="tablist" aria-label="보관함과 상점">
            <button role="tab" aria-selected={tray === 'storage'} className={tray === 'storage' ? 'on' : ''} onClick={() => setTray('storage')}>보관함</button>
            <button role="tab" aria-selected={tray === 'shop'} className={tray === 'shop' ? 'on' : ''} onClick={() => setTray('shop')}>상점</button>
          </div>
          {tray === 'storage' ? (
            storageItems.length ? (
              <ul className="item-grid">
                {storageItems.map((i) => (
                  <li key={i.id}><button className="item-card" onClick={() => place(i.id)}>
                    <img src={asset(i.kind === 'treasure' ? `assets/treasure/${i.id}.webp` : `assets/furniture/${i.id}.webp`)} alt="" loading="lazy" />
                    <span>{i.nameKo}</span><small>{left(i.id)}개 남음</small>
                  </button></li>
                ))}
              </ul>
            ) : <p className="fine pad">보관함이 비었어요. 상점에서 새 물건을 구경해 보세요.</p>
          ) : (
            <ul className="item-grid">
              {ITEMS.map((i) => {
                const locked = i.unlockStep > count;
                return (
                  <li key={i.id}><button className={`item-card${locked ? ' locked' : ''}`} onClick={() => setBuying({ id: i.id, op: newOpId() })}>
                    <img src={asset(i.kind === 'treasure' ? `assets/treasure/${i.id}.webp` : `assets/furniture/${i.id}.webp`)} alt="" loading="lazy" />
                    <span>{i.nameKo}</span>
                    <small>{locked ? <><IconLock size={12} aria-hidden /> 여정 {i.unlockStep}칸</> : <>✦ {i.price}</>}</small>
                  </button></li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {buying && (() => {
        const it = ITEM_BY_ID[buying.id];
        const locked = it.unlockStep > count;
        return (
          <Sheet title={it.nameKo} onClose={() => setBuying(null)}>
            <div className="buy">
              <img src={asset(it.kind === 'treasure' ? `assets/treasure/${it.id}.webp` : `assets/furniture/${it.id}.webp`)} alt="" />
              <p><strong>누르면:</strong> {it.desc}</p>
              <p className="fine">가진 수: {state!.inventory[it.id] ?? 0}개. 한 개를 사면 한 곳에 놓을 수 있어요.</p>
              {locked && <p className="fine">여정 {it.unlockStep}칸「{JOURNEY[it.unlockStep - 1].title}」에 도착하면 살 수 있어요.</p>}
              <div className="row-end">
                <button className="btn" onClick={() => setGoal(it.id)}><IconTarget size={16} aria-hidden />목표로</button>
                <button className="btn primary" disabled={locked || state!.balance < it.price} onClick={buy}>✦ {it.price}로 사기</button>
              </div>
              {!locked && state!.balance < it.price && <p className="fine">별빛이 {it.price - state!.balance}만큼 더 필요해요.</p>}
            </div>
          </Sheet>
        );
      })()}

      {noteFor && <NoteSheet initial={draft.notes[noteFor] ?? ''} onClose={() => setNoteFor(null)}
        onSave={(t) => { const notes = { ...draft.notes }; if (t.trim()) notes[noteFor] = t.trim(); else delete notes[noteFor]; commit({ ...draft, notes }); setNoteFor(null); }} />}

      {conflict && (
        <Sheet title="다른 기기에서 먼저 저장했어요" onClose={() => setConflict(false)}>
          <p>다른 기기에서 이 집을 먼저 저장했어요. 어떻게 할까요?</p>
          <div className="stack">
            <button className="btn" onClick={reloadServer}>저장된 집 불러오기(지금 꾸민 것은 버림)</button>
            <button className="btn primary" onClick={overwriteWithMine}>지금 꾸민 것으로 다시 저장</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function NoteSheet({ initial, onSave, onClose }: { initial: string; onSave: (t: string) => void; onClose: () => void }) {
  const [t, setT] = useState(initial);
  return (
    <Sheet title="숨은 쪽지" onClose={onClose}>
      <p className="fine">놀러 온 사람이 이 물건을 누르면 쪽지를 발견해요.</p>
      <textarea value={t} rows={2} onChange={(e) => setT([...e.target.value].slice(0, 60).join(''))} aria-label="쪽지 내용" />
      <div className="row-end"><small>{[...t].length}/60</small><button className="btn primary" onClick={() => onSave(t)}>넣기</button></div>
    </Sheet>
  );
}
