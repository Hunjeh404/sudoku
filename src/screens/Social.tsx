// 친구(가족·초대·견본 집) 목록과 집 방문
import { useEffect, useState } from 'react';
import { IconArrowLeft, IconCopy, IconMail, IconUserPlus, IconTicket } from '@tabler/icons-react';
import { useGame, Layout, HomeData } from '../lib/store';
import { rpc, ApiError } from '../lib/api';
import { Space, ITEM_BY_ID } from '../data/catalog';
import { HomeStage } from '../home/HomeStage';
import { PanelHost, PanelCtx, GuestbookPanel } from '../panels/Panels';
import type { PanelKind } from '../home/interactions';
import { Avatar, ErrorLine, Sheet, Spinner, timeAgo } from '../ui';

interface Conn { id: string; nickname: string; avatar_id: string; home_name: string; saved_at: string; relation: 'family' | 'friend'; can_visit: boolean; is_child: boolean }

export const SAMPLE_ID = 'sample';
const SAMPLE: { owner: any; home: HomeData } = {
  owner: { id: SAMPLE_ID, nickname: '헤스티아', avatar_id: 'hestia', home_name: '견본 집', welcome_text: '이곳은 미리 꾸며 둔 견본 집이에요. 물건을 눌러 반응을 구경해 보세요.' },
  home: {
    room_layout: [
      { uid: 's1', item: 'laurel_rug', x: 4, y: 4 }, { uid: 's2', item: 'tea_table', x: 5, y: 5 }, { uid: 's3', item: 'picture_frame', parent: 's2' },
      { uid: 's4', item: 'cloud_bed', x: 0, y: 6 }, { uid: 's5', item: 'scroll_bookcase', x: 3, y: 0 }, { uid: 's6', item: 'linen_curtain', x: 6 },
      { uid: 's7', item: 'display_pedestal', x: 9, y: 3 }, { uid: 's8', item: 'lyre', parent: 's7' }, { uid: 's9', item: 'star_lantern', x: 10, y: 7 },
      { uid: 's10', item: 'cloud_cushion', x: 7, y: 6 }, { uid: 's11', item: 'star_mobile', x: 1, y: 2 }, { uid: 's12', item: 'laurel_door', x: 9 },
    ],
    garden_layout: [
      { uid: 'g1', item: 'shell_fountain', x: 4, y: 3 }, { uid: 'g2', item: 'garden_trellis', x: 4, y: 0 }, { uid: 'g3', item: 'stepping_stones', x: 4, y: 7 },
      { uid: 'g4', item: 'laurel_bench', x: 10, y: 4 }, { uid: 'g5', item: 'olive_planter', x: 1, y: 2 }, { uid: 'g6', item: 'olive_planter', x: 10, y: 1 },
      { uid: 'g7', item: 'display_pedestal', x: 1, y: 7 }, { uid: 'g8', item: 'cornucopia', parent: 'g7' }, { uid: 'g9', item: 'owl_mailbox', x: 9, y: 9 },
    ],
    exhibits: { s3: 'assets/scenes/c01-00.webp' }, notes: { s5: '견본 집 책장에는 첫 이야기가 꽂혀 있어요.' }, featured_uid: 's8', music: 'Picnic_on_Olympus', revision: 0, saved_at: '',
  },
};

export function FriendsScreen({ visit }: { visit: (id: string) => void }) {
  const { profileId, state, toast } = useGame();
  const [list, setList] = useState<Conn[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ code: string; expires_at: string; kind: string } | null>(null);
  const [accepting, setAccepting] = useState(false);
  const adult = !state!.profile.is_child;
  const load = () => rpc<Conn[]>('list_connections', { p: profileId }).then(setList).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [profileId]);
  const makeInvite = async (kind: 'family' | 'friend') => {
    try { setInvite(await rpc('create_invite', { p: profileId, kind })); } catch (e) { toast((e as ApiError).message); }
  };
  const unfriend = async (c: Conn) => {
    if (!confirm(`${c.nickname}네 가족과 친구를 끊을까요? 서로의 집에 더 이상 놀러 갈 수 없어요.`)) return;
    try { await rpc('remove_friend', { p: profileId, other: c.id }); load(); } catch (e) { toast((e as ApiError).message); }
  };
  const fam = list?.filter((c) => c.relation === 'family') ?? [];
  const friends = list?.filter((c) => c.relation === 'friend') ?? [];
  const Row = ({ c }: { c: Conn }) => (
    <li className="conn-row">
      <button className="conn" disabled={!c.can_visit} onClick={() => visit(c.id)}>
        <Avatar id={c.avatar_id} size={48} />
        <span className="grow"><strong>{c.home_name || `${c.nickname}의 집`}</strong>
          <small>{c.nickname}{c.can_visit ? `, ${timeAgo(c.saved_at)} 꾸밈` : ', 지금은 비공개'}</small></span>
      </button>
      {adult && c.relation === 'friend' && <button className="btn small ghost" onClick={() => unfriend(c)}>끊기</button>}
    </li>
  );
  return (
    <div className="page">
      <h1 className="page-title">친구</h1>
      {err && <ErrorLine msg={err} onRetry={load} />}
      {!list && !err && <Spinner />}
      {list && (
        <>
          <h2 className="sub">우리 가족</h2>
          {fam.length ? <ul className="conn-list">{fam.map((c) => <Row key={c.id} c={c} />)}</ul> : <p className="fine">아직 함께하는 가족이 없어요.</p>}
          <h2 className="sub">초대한 친구네</h2>
          {friends.length ? <ul className="conn-list">{friends.map((c) => <Row key={c.id} c={c} />)}</ul> : <p className="fine">초대 코드로 친구 가족과 연결할 수 있어요.</p>}
        </>
      )}
      <h2 className="sub">견본 집</h2>
      <ul className="conn-list"><li className="conn-row"><button className="conn" onClick={() => visit(SAMPLE_ID)}>
        <Avatar id="hestia" size={48} /><span className="grow"><strong>견본 집</strong><small>게임이 미리 꾸며 둔 집이에요. 실제 사람의 집이 아니에요.</small></span>
      </button></li></ul>
      {adult ? (
        <section className="invite-box">
          <h2 className="sub">초대</h2>
          <div className="row wrap">
            <button className="btn" onClick={() => makeInvite('family')}><IconUserPlus size={18} aria-hidden />가족 초대 코드</button>
            <button className="btn" onClick={() => makeInvite('friend')}><IconMail size={18} aria-hidden />친구 초대 코드</button>
            <button className="btn" onClick={() => setAccepting(true)}><IconTicket size={18} aria-hidden />받은 코드 넣기</button>
          </div>
          <p className="fine">가족 초대는 같은 집안 어른(예: 배우자)이, 친구 초대는 다른 가족이 받아요. 코드는 3일 동안 한 번만 쓸 수 있어요.</p>
        </section>
      ) : <p className="fine">초대는 보호자 프로필에서 만들 수 있어요.</p>}
      {invite && (
        <Sheet title={invite.kind === 'family' ? '가족 초대 코드' : '친구 초대 코드'} onClose={() => setInvite(null)}>
          <p className="invite-code" aria-label="초대 코드">{invite.code}</p>
          <p className="fine">{new Date(invite.expires_at).toLocaleString('ko-KR')}까지 한 번 쓸 수 있어요. 받는 사람은 구글로 로그인한 뒤 친구 탭의「받은 코드 넣기」에 입력해요.</p>
          <div className="row-end"><button className="btn primary" onClick={() => { navigator.clipboard?.writeText(invite.code).then(() => toast('복사했어요'), () => {}); }}><IconCopy size={18} aria-hidden />복사</button></div>
        </Sheet>
      )}
      {accepting && <AcceptSheet onClose={() => setAccepting(false)} onDone={load} />}
    </div>
  );
}

function AcceptSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { profileId, toast } = useGame();
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await rpc('accept_invite', { p: profileId, code });
      if (!r.ok) setErr(r.message);
      else { toast(r.kind === 'family' ? `${r.with}의 가족이 되었어요` : `${r.with}네와 친구가 되었어요`); onDone(); onClose(); }
    } catch (e) { setErr((e as ApiError).message); }
    setBusy(false);
  };
  return (
    <Sheet title="받은 초대 코드" onClose={onClose}>
      <input className="code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCDE-FGHJK" aria-label="초대 코드" autoCapitalize="characters" />
      {err && <ErrorLine msg={err} />}
      <div className="row-end"><button className="btn primary" onClick={go} disabled={busy || code.replace(/[^A-Z0-9]/gi, '').length < 10}>연결하기</button></div>
    </Sheet>
  );
}

export function VisitScreen({ ownerId, onBack, visit }: { ownerId: string; onBack: () => void; visit: (id: string) => void }) {
  const { profileId, settings, state } = useGame();
  const [data, setData] = useState<{ owner: any; home: HomeData; discovered: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [space, setSpace] = useState<Space>('room');
  const [panel, setPanel] = useState<{ kind: PanelKind; item: Layout } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [gb, setGb] = useState(false);
  const [mirror, setMirror] = useState<Record<string, string>>({});
  const sample = ownerId === SAMPLE_ID;
  const load = () => {
    if (sample) { setData({ ...SAMPLE, discovered: [] }); return; }
    rpc('visit_home', { viewer: profileId, owner: ownerId })
      .then((v) => setData({ owner: v.owner, home: { ...v, revision: 0 }, discovered: v.discovered }))
      .catch((e) => setErr(e.message));
  };
  useEffect(load, [ownerId]);
  if (err) return <div className="page"><button className="btn" onClick={onBack}><IconArrowLeft size={18} />돌아가기</button><ErrorLine msg={err} onRetry={load} /></div>;
  if (!data) return <div className="page"><Spinner /></div>;
  const layout = space === 'room' ? data.home.room_layout : data.home.garden_layout;
  const featured = data.home.featured_uid ? [...data.home.room_layout, ...data.home.garden_layout].find((l) => l.uid === data.home.featured_uid) : null;
  const ctx: PanelCtx | null = panel && {
    kind: panel.kind, item: panel.item, layout, home: data.home, ownerId, ownerName: data.owner.nickname, isOwner: false,
    unlocks: state?.unlocks ?? [], onVisit: visit, onMirror: (uid, f) => setMirror((m) => ({ ...m, [uid]: f })),
  };
  return (
    <div className="home visit">
      <div className="visit-head">
        <button className="icon-btn" aria-label="돌아가기" onClick={onBack}><IconArrowLeft /></button>
        <Avatar id={data.owner.avatar_id} size={40} />
        <div className="grow"><strong>{data.owner.home_name || `${data.owner.nickname}의 집`}</strong>
          <small>{sample ? '견본 집' : `${data.owner.nickname}${data.home.saved_at ? `, ${timeAgo(data.home.saved_at)} 저장` : ''}`}</small></div>
      </div>
      {data.owner.welcome_text && <p className="welcome">{data.owner.welcome_text}</p>}
      <div className="seg" role="tablist" aria-label="공간">
        {(['room', 'garden'] as Space[]).map((sp) => <button key={sp} role="tab" aria-selected={space === sp} className={space === sp ? 'on' : ''} onClick={() => setSpace(sp)}>{sp === 'room' ? '실내' : '정원'}</button>)}
      </div>
      <HomeStage key={space + ownerId} space={space} layout={layout} storageKey={`lit:${profileId}:${ownerId}`} reducedMotion={settings.reducedMotion}
        mirrorFace={mirror} label={`${data.owner.nickname}의 ${space === 'room' ? '실내' : '정원'}`}
        onPanel={(kind, item) => (kind === 'guestbook' ? setGb(true) : setPanel({ kind, item }))}
        onNote={(l) => {
          const t = data.home.notes[l.uid];
          if (!t) return;
          setNote(t);
          if (!sample && !data.discovered.includes(l.uid)) {
            rpc('discover_note', { viewer: profileId, owner: ownerId, note_id: l.uid }).catch(() => {});
            setData({ ...data, discovered: [...data.discovered, l.uid] });
          }
        }} />
      {featured && <p className="fine center">오늘의 전시품: {ITEM_BY_ID[featured.item]?.nameKo}</p>}
      <p className="fine center">숨은 쪽지 {data.discovered.length}/{Object.keys(data.home.notes).length}개 발견. 여기서 누른 등불·효과는 내 화면에서만 바뀌어요.</p>
      <div className="home-actions">
        <button className="btn big primary" onClick={() => setGb(true)} disabled={sample}>방명록 {sample ? '(견본 집은 못 남겨요)' : '남기기'}</button>
      </div>
      {note && <Sheet title="숨은 쪽지를 찾았어요" onClose={() => setNote(null)}><p className="note-text">{note}</p></Sheet>}
      {ctx && <PanelHost ctx={ctx} onClose={() => setPanel(null)} />}
      {gb && !sample && <GuestbookPanel ownerId={ownerId} ownerName={data.owner.nickname} isOwner={ownerId === profileId} onClose={() => setGb(false)} />}
      {gb && sample && <Sheet title="견본 집" onClose={() => setGb(false)}><p>견본 집에는 방명록을 남길 수 없어요. 가족이나 친구의 집에 남겨 보세요.</p></Sheet>}
    </div>
  );
}
