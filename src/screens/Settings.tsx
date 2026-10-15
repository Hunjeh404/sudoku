import { useEffect, useState } from 'react';
import { useGame } from '../lib/store';
import { rpc, ApiError } from '../lib/api';
import { TITLES } from '../data/catalog';
import { Sheet, Avatar, ErrorLine, Spinner, timeAgo, activityText } from '../ui';
import { CreateProfile } from './Entry';

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { state, settings, updateSettings, profileId, patchState, toast, selectProfile, signOut, reloadProfiles, session } = useGame();
  const p = state!.profile;
  const [form, setForm] = useState({ nickname: p.nickname, avatar_id: p.avatar_id, title: p.title });
  const [err, setErr] = useState<string | null>(null);
  const [childForm, setChildForm] = useState(false);
  const titles = TITLES.filter((t) => state!.unlocks.includes(`title:${t.id}`));
  const saveProfile = async () => {
    try {
      await rpc('update_profile', { p: profileId, patch: form });
      patchState((s) => ({ ...s, profile: { ...s.profile, ...form } }));
      toast('프로필을 저장했어요');
      reloadProfiles();
    } catch (e) { setErr((e as ApiError).message); }
  };
  if (childForm) return <div className="overlay-page"><CreateProfile child onCancel={() => setChildForm(false)} onDone={async (id) => { await reloadProfiles(); setChildForm(false); toast('아이 프로필을 만들었어요'); void id; }} /></div>;
  const Toggle = ({ k, label, hint }: { k: 'sound' | 'reducedMotion' | 'autoNotes' | 'showTimer' | 'pictureMode'; label: string; hint?: string }) => (
    <label className="toggle"><input type="checkbox" checked={settings[k]} onChange={(e) => updateSettings({ [k]: e.target.checked })} />
      <span><strong>{label}</strong>{hint && <small>{hint}</small>}</span></label>
  );
  return (
    <Sheet title="설정" onClose={onClose}>
      <section className="set-group">
        <h3>소리와 화면</h3>
        <Toggle k="sound" label="소리 켜기" hint="처음에는 꺼져 있어요" />
        <label className="range">효과음 크기<input type="range" min={0} max={1} step={0.1} value={settings.fx} onChange={(e) => updateSettings({ fx: +e.target.value })} /></label>
        <label className="range">음악 크기<input type="range" min={0} max={1} step={0.1} value={settings.music} onChange={(e) => updateSettings({ music: +e.target.value })} /></label>
        <Toggle k="reducedMotion" label="움직임 줄이기" hint="반응을 움직임 대신 테두리로 보여 줘요" />
      </section>
      <section className="set-group">
        <h3>스도쿠</h3>
        <Toggle k="autoNotes" label="메모 자동 지우기" hint="숫자를 넣으면 같은 줄·상자의 메모에서 지워요" />
        <Toggle k="showTimer" label="시간 표시" />
        <Toggle k="pictureMode" label="4×4 그림 모드" hint="숫자 대신 보물 그림으로 풀어요" />
      </section>
      <section className="set-group">
        <h3>내 프로필</h3>
        <label className="field"><span>이름</span><input value={form.nickname} maxLength={12} onChange={(e) => setForm({ ...form, nickname: e.target.value })} /><small>순위표와 친구 소식에 보여요. 아이는 실명 대신 별명을 쓰는 게 좋아요.</small></label>
        <fieldset className="field"><legend>내 초상화</legend>
          {state!.owned.length === 0
            ? <p className="fine">아직 모은 초상화가 없어요. 첫 판을 끝내면 선물로 받고, 도감에서 별빛으로 모을 수 있어요.</p>
            : <div className="avatar-grid small">{state!.owned.map((a) => <button key={a} className={`avatar-pick${form.avatar_id === a ? ' on' : ''}`} aria-pressed={form.avatar_id === a} aria-label={a} onClick={() => setForm({ ...form, avatar_id: a })}><Avatar id={a} size={44} framed={form.avatar_id === a} /></button>)}</div>}
        </fieldset>
        <fieldset className="field"><legend>칭호</legend>
          {titles.length === 0 ? <p className="fine">여정을 걸으면 칭호를 받아요.</p> : (
            <div className="row wrap">
              <button className={`btn small${form.title === '' ? ' on' : ''}`} aria-pressed={form.title === ''} onClick={() => setForm({ ...form, title: '' })}>달지 않기</button>
              {titles.map((t) => <button key={t.id} className={`btn small${form.title === t.id ? ' on' : ''}`} aria-pressed={form.title === t.id} onClick={() => setForm({ ...form, title: t.id })}>{t.name}</button>)}
            </div>
          )}
        </fieldset>
        {err && <ErrorLine msg={err} />}
        <div className="row-end"><button className="btn primary" onClick={saveProfile}>프로필 저장</button></div>
      </section>
      <section className="set-group">
        <h3>가족과 계정</h3>
        <div className="stack">
          {!p.is_child && <button className="btn" onClick={() => setChildForm(true)}>아이 프로필 만들기</button>}
          <button className="btn" onClick={() => { onClose(); selectProfile(null); }}>다른 프로필로 바꾸기</button>
          <button className="btn ghost" onClick={signOut}>로그아웃</button>
        </div>
        <p className="fine">로그인: {session?.user.email}. 아이 프로필은 이 계정과 같은 가족 어른 계정에서만 열 수 있어요. 아이 기기를 따로 연결하는 기능은 아직 없어요.</p>
      </section>
    </Sheet>
  );
}

export function MailSheet({ onClose }: { onClose: () => void }) {
  const { profileId, patchState, toast } = useGame();
  const [list, setList] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    rpc<any[]>('list_mail', { p: profileId }).then((l) => {
      setList(l);
      if (l.some((m) => !m.read_at)) rpc('mark_mail_read', { p: profileId }).then(() => patchState((s) => ({ ...s, unread: 0 }))).catch(() => {});
    }).catch((e) => setErr(e.message));
  }, [profileId]);
  const text = (m: any) => {
    if (m.kind === 'friend_request') return `${m.payload.nickname}님이 친구 요청을 보냈어요`;
    if (m.kind === 'friend_accepted') return `${m.payload.nickname}님이 친구 요청을 수락했어요. 이제 서로의 소식이 보여요`;
    if (m.kind === 'reaction') return `${m.payload.nickname}님이 내 소식「${activityText(m.payload.activity_kind, m.payload.activity)}」에 ${m.payload.emoji}를 달았어요`;
    if (m.kind === 'invite_accepted') return `${m.payload.nickname}님이 같이 쓰기 코드를 받아 아이 프로필을 함께 쓰게 되었어요`;
    return '새 소식이 있어요';
  };
  const respond = async (m: any, accept: boolean) => {
    try {
      await rpc('respond_friend_request', { p: profileId, request: m.ref, accept });
      setList((l) => l?.map((x) => (x.id === m.id ? { ...x, request_status: accept ? 'accepted' : 'declined' } : x)) ?? l);
      toast(accept ? `${m.payload.nickname}님과 친구가 되었어요` : '요청을 거절했어요');
    } catch (e) { toast((e as ApiError).message); }
  };
  return (
    <Sheet title="우편함" onClose={onClose}>
      {err && <ErrorLine msg={err} />}
      {!list && !err && <Spinner />}
      {list?.length === 0 && <p className="fine">아직 온 소식이 없어요.</p>}
      <ul className="mail-list">
        {list?.map((m) => (
          <li key={m.id} className={m.read_at ? '' : 'unread'}>
            {m.payload?.avatar_id !== undefined && <Avatar id={m.payload.avatar_id} size={36} />}
            <div className="grow"><p>{text(m)}</p><small>{timeAgo(m.created_at)}</small>
              {m.kind === 'friend_request' && (m.request_status === 'pending'
                ? <div className="row"><button className="btn small primary" onClick={() => respond(m, true)}>수락</button><button className="btn small" onClick={() => respond(m, false)}>거절</button></div>
                : <small> · {m.request_status === 'accepted' ? '수락함' : m.request_status === 'declined' ? '거절함' : '취소된 요청'}</small>)}
            </div>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
