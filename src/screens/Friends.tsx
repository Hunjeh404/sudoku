// 친구: 소식(이모티콘) · 이메일 친구 요청 · 우리 가족 · 아이 프로필 같이 쓰기 코드
import { useEffect, useState } from 'react';
import { IconCopy, IconMail, IconMoodSmile, IconSend, IconTicket, IconUserPlus, IconX } from '@tabler/icons-react';
import { useGame } from '../lib/store';
import { rpc, ApiError } from '../lib/api';
import { EMOJIS } from '../data/catalog';
import { Avatar, ErrorLine, Sheet, Spinner, TitleTag, activityText, timeAgo } from '../ui';
import { sfx } from '../lib/sound';

interface Person { id: string; nickname: string; avatar_id: string; title?: string; is_child?: boolean; points?: number }
interface FeedItem { id: number; kind: string; payload: any; created_at: string; mine: boolean; who: Person; my_emoji: string | null;
  reactions: { emoji: string; id: string; nickname: string; avatar_id: string }[] }
interface FriendsData { family: Person[]; friends: { family: string; since: string; members: Person[] }[];
  incoming: { id: string; nickname: string; avatar_id: string; created_at: string }[]; outgoing: { id: string; to: string; created_at: string }[] }

export function FriendsScreen() {
  const [tab, setTab] = useState<'feed' | 'list'>('feed');
  return (
    <div className="page">
      <h1 className="page-title">친구</h1>
      <div className="seg" role="tablist" aria-label="친구 화면">
        {([['feed', '소식'], ['list', '친구 맺기']] as const).map(([k, l]) =>
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'feed' ? <FeedList empty="아직 소식이 없어요. 친구를 맺으면 친구가 몇 판을 끝냈는지, 기록을 깼는지 여기에 떠요." /> : <FriendList />}
    </div>
  );
}

// ---------- 소식 ----------
export function FeedList({ limit, empty }: { limit?: number; empty: string }) {
  const { profileId } = useGame();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [more, setMore] = useState(true);
  const load = (before?: number) => rpc<FeedItem[]>('list_feed', { p: profileId, before_id: before ?? null })
    .then((l) => { setItems((cur) => (before && cur ? [...cur, ...l] : l)); setMore(l.length >= 40); setErr(null); })
    .catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [profileId]);
  const shown = limit ? items?.slice(0, limit) : items;
  const update = (it: FeedItem) => setItems((l) => l?.map((x) => (x.id === it.id ? it : x)) ?? l);
  return (
    <>
      {err && <ErrorLine msg={err} onRetry={() => load()} />}
      {!items && !err && <Spinner />}
      {items?.length === 0 && <p className="fine">{empty}</p>}
      <ul className="feed">{shown?.map((it) => <FeedRow key={it.id} it={it} onChange={update} />)}</ul>
      {!limit && items && more && items.length > 0 && <button className="btn small" onClick={() => load(items[items.length - 1].id)}>더 보기</button>}
    </>
  );
}

function FeedRow({ it, onChange }: { it: FeedItem; onChange: (it: FeedItem) => void }) {
  const { profileId, state, toast } = useGame();
  const [picking, setPicking] = useState(false);
  const react = async (emoji: string) => {
    setPicking(false);
    const prev = it;
    const remove = it.my_emoji === emoji;
    const me = { id: profileId!, nickname: state!.profile.nickname, avatar_id: state!.profile.avatar_id };
    const others = it.reactions.filter((r) => r.id !== profileId);
    onChange({ ...it, my_emoji: remove ? null : emoji, reactions: remove ? others : [...others, { ...me, emoji }] });
    sfx.tap();
    try { await rpc('set_reaction', { p: profileId, activity: it.id, emoji }); }
    catch (e) { onChange(prev); toast((e as ApiError).message); }
  };
  return (
    <li className={`feed-item${it.mine ? ' mine' : ''}`}>
      <Avatar id={it.who.avatar_id} size={44} />
      <div className="grow">
        <p className="feed-who"><strong>{it.mine ? '나' : it.who.nickname}</strong> <TitleTag id={it.who.title ?? ''} /> <small>{timeAgo(it.created_at)}</small></p>
        <p className="feed-text">{activityText(it.kind, it.payload)}</p>
        {it.reactions.length > 0 && (
          <ul className="reactions" aria-label="받은 이모티콘">
            {it.reactions.map((r) => <li key={r.id} title={r.nickname}><span aria-hidden>{r.emoji}</span><Avatar id={r.avatar_id} size={20} framed={false} /><small>{r.id === profileId ? '나' : r.nickname}</small></li>)}
          </ul>
        )}
        {!it.mine && (
          <div className="react-row">
            <button className={`react-btn${it.my_emoji ? ' on' : ''}`} onClick={() => setPicking(!picking)} aria-expanded={picking}
              aria-label={it.my_emoji ? `내 이모티콘 ${it.my_emoji}, 바꾸거나 지우기` : '이모티콘 달기'}>
              {it.my_emoji ? <span aria-hidden>{it.my_emoji}</span> : <IconMoodSmile size={20} aria-hidden />}
            </button>
            {picking && (
              <div className="emoji-pick" role="group" aria-label="이모티콘 고르기">
                {EMOJIS.map((e) => <button key={e} className={it.my_emoji === e ? 'on' : ''} onClick={() => react(e)} aria-label={it.my_emoji === e ? `${e} 지우기` : `${e} 달기`}>{e}</button>)}
                {it.my_emoji && <button onClick={() => react(it.my_emoji!)} aria-label="이모티콘 지우기"><IconX size={18} aria-hidden /></button>}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

// ---------- 친구 맺기 ----------
function FriendList() {
  const { profileId, state, toast, refresh } = useGame();
  const [data, setData] = useState<FriendsData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState<{ code: string; expires_at: string } | null>(null);
  const [accepting, setAccepting] = useState(false);
  const adult = !state!.profile.is_child;
  const load = () => rpc<FriendsData>('list_friends', { p: profileId }).then(setData).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [profileId]);
  const send = async () => {
    setBusy(true); setSendErr(null);
    try {
      const r = await rpc('send_friend_request', { p: profileId, email: email.trim() });
      toast(r.status === 'accepted' ? `${r.with}님과 친구가 되었어요` : r.repeat ? '이미 요청을 보냈어요. 상대가 수락하면 친구가 돼요.' : '친구 요청을 보냈어요. 상대가 수락하면 친구가 돼요.');
      setEmail(''); load();
    } catch (e) { setSendErr((e as ApiError).message); }
    setBusy(false);
  };
  const respond = async (id: string, accept: boolean) => {
    try {
      const r = await rpc('respond_friend_request', { p: profileId, request: id, accept });
      toast(accept ? `${r.with}님과 친구가 되었어요` : '요청을 거절했어요');
      load(); refresh();
    } catch (e) { toast((e as ApiError).message); }
  };
  const cancel = async (id: string) => { await rpc('cancel_friend_request', { p: profileId, request: id }).catch(() => {}); load(); };
  const unfriend = async (f: FriendsData['friends'][number]) => {
    if (!confirm(`${f.members.map((m) => m.nickname).join(', ')}님과 친구를 끊을까요? 서로의 소식이 더 이상 보이지 않아요.`)) return;
    try { await rpc('remove_friend', { p: profileId, other: f.members[0].id }); load(); } catch (e) { toast((e as ApiError).message); }
  };
  const makeInvite = async () => { try { setInvite(await rpc('create_invite', { p: profileId, kind: 'family' })); } catch (e) { toast((e as ApiError).message); } };
  const Member = ({ m }: { m: Person }) => (
    <li className="member"><Avatar id={m.avatar_id} size={40} /><span className="grow"><strong>{m.nickname}</strong> <TitleTag id={m.title ?? ''} />
      <small>{m.is_child ? '아이 · ' : ''}누적 {m.points?.toLocaleString() ?? 0}점</small></span></li>
  );
  return (
    <>
      <section className="add-friend">
        <h2 className="sub">이메일로 친구 요청</h2>
        <p className="fine">친구가 이 게임에 로그인할 때 쓰는 구글 이메일을 적어 주세요. 상대가 수락하면 두 가족이 서로 친구가 돼요.</p>
        <form className="row" onSubmit={(e) => { e.preventDefault(); if (email.includes('@')) send(); }}>
          <input className="grow" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@gmail.com" aria-label="친구 이메일" autoComplete="off" />
          <button className="btn primary" type="submit" disabled={busy || !email.includes('@')}><IconSend size={18} aria-hidden />요청</button>
        </form>
        {sendErr && <ErrorLine msg={sendErr} />}
      </section>
      {err && <ErrorLine msg={err} onRetry={load} />}
      {!data && !err && <Spinner />}
      {data && (
        <>
          {data.incoming.length > 0 && (
            <section><h2 className="sub">받은 친구 요청</h2>
              <ul className="req-list">{data.incoming.map((r) => (
                <li key={r.id}><Avatar id={r.avatar_id} size={40} /><span className="grow"><strong>{r.nickname}</strong><small>{timeAgo(r.created_at)}</small></span>
                  <button className="btn small primary" onClick={() => respond(r.id, true)}>수락</button>
                  <button className="btn small" onClick={() => respond(r.id, false)}>거절</button></li>))}</ul>
            </section>
          )}
          {data.outgoing.length > 0 && (
            <section><h2 className="sub">보낸 요청</h2>
              <ul className="req-list">{data.outgoing.map((r) => (
                <li key={r.id}><IconMail aria-hidden /><span className="grow"><strong>{r.to || '상대'}</strong><small>수락을 기다리는 중 · {timeAgo(r.created_at)}</small></span>
                  <button className="btn small ghost" onClick={() => cancel(r.id)}>취소</button></li>))}</ul>
            </section>
          )}
          <h2 className="sub">친구</h2>
          {data.friends.length === 0 && <p className="fine">아직 친구가 없어요.</p>}
          {data.friends.map((f) => (
            <section key={f.family} className="friend-family">
              <ul className="member-list">{f.members.map((m) => <Member key={m.id} m={m} />)}</ul>
              <button className="btn small ghost" onClick={() => unfriend(f)}>친구 끊기</button>
            </section>
          ))}
          <h2 className="sub">우리 가족</h2>
          {data.family.length ? <ul className="member-list">{data.family.map((m) => <Member key={m.id} m={m} />)}</ul> : <p className="fine">아직 함께하는 가족이 없어요.</p>}
        </>
      )}
      {adult && (
        <section className="invite-box">
          <h2 className="sub">아이 프로필 같이 쓰기</h2>
          <p className="fine">배우자처럼 다른 어른 계정에서도 우리 아이 프로필로 놀 수 있게 해요. 코드를 받은 사람은 우리 가족으로 묶여 친구도 함께 써요. 코드는 3일 동안 한 번만 쓸 수 있어요.</p>
          <div className="row wrap">
            <button className="btn" onClick={makeInvite}><IconUserPlus size={18} aria-hidden />같이 쓰기 코드 만들기</button>
            <button className="btn" onClick={() => setAccepting(true)}><IconTicket size={18} aria-hidden />받은 코드 넣기</button>
          </div>
        </section>
      )}
      {invite && (
        <Sheet title="아이 프로필 같이 쓰기 코드" onClose={() => setInvite(null)}>
          <p className="invite-code" aria-label="초대 코드">{invite.code}</p>
          <p className="fine">{new Date(invite.expires_at).toLocaleString('ko-KR')}까지 한 번 쓸 수 있어요. 받는 사람은 구글로 로그인한 뒤 친구 탭의「받은 코드 넣기」에 입력해요.</p>
          <div className="row-end"><button className="btn primary" onClick={() => { navigator.clipboard?.writeText(invite.code).then(() => toast('복사했어요'), () => {}); }}><IconCopy size={18} aria-hidden />복사</button></div>
        </Sheet>
      )}
      {accepting && <AcceptSheet onClose={() => setAccepting(false)} onDone={() => { load(); refresh(); }} />}
    </>
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
      else { toast(`${r.with}님과 아이 프로필을 같이 쓰게 되었어요`); onDone(); onClose(); }
    } catch (e) { setErr((e as ApiError).message); }
    setBusy(false);
  };
  return (
    <Sheet title="받은 같이 쓰기 코드" onClose={onClose}>
      <input className="code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCDE-FGHJK" aria-label="초대 코드" autoCapitalize="characters" />
      {err && <ErrorLine msg={err} />}
      <div className="row-end"><button className="btn primary" onClick={go} disabled={busy || code.replace(/[^A-Z0-9]/gi, '').length < 10}>연결하기</button></div>
    </Sheet>
  );
}
