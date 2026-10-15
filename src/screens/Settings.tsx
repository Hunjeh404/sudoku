import { useEffect, useState } from 'react';
import { useGame } from '../lib/store';
import { rpc, ApiError } from '../lib/api';
import { AVATARS, GUIDES } from '../data/catalog';
import { Sheet, Avatar, ErrorLine, Spinner, timeAgo } from '../ui';
import { CreateProfile } from './Entry';

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { state, settings, updateSettings, profileId, patchState, toast, selectProfile, signOut, reloadProfiles, session } = useGame();
  const p = state!.profile;
  const [form, setForm] = useState({ nickname: p.nickname, avatar_id: p.avatar_id, guide_id: p.guide_id, home_name: p.home_name, welcome_text: p.welcome_text, home_visibility: p.home_visibility });
  const [err, setErr] = useState<string | null>(null);
  const [childForm, setChildForm] = useState(false);
  const guides = GUIDES.filter((g) => state!.unlocks.includes(`guide:${g.id}`));
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
        <h3>내 프로필과 집</h3>
        <label className="field"><span>이름</span><input value={form.nickname} maxLength={12} onChange={(e) => setForm({ ...form, nickname: e.target.value })} /></label>
        <div className="avatar-grid small">{AVATARS.map((a) => <button key={a} className={`avatar-pick${form.avatar_id === a ? ' on' : ''}`} aria-pressed={form.avatar_id === a} aria-label={a} onClick={() => setForm({ ...form, avatar_id: a })}><Avatar id={a} size={40} /></button>)}</div>
        <fieldset className="field"><legend>안내 친구</legend>
          <div className="row wrap">{guides.map((g) => <button key={g.id} className={`btn small${form.guide_id === g.id ? ' on' : ''}`} aria-pressed={form.guide_id === g.id} onClick={() => setForm({ ...form, guide_id: g.id })}>{g.name}</button>)}</div>
        </fieldset>
        <label className="field"><span>집 이름</span><input value={form.home_name} maxLength={20} onChange={(e) => setForm({ ...form, home_name: e.target.value })} /></label>
        <label className="field"><span>환영 문구</span><input value={form.welcome_text} maxLength={60} onChange={(e) => setForm({ ...form, welcome_text: e.target.value })} placeholder="놀러 온 사람에게 보여요" /><small>{[...form.welcome_text].length}/60</small></label>
        <label className="toggle"><input type="checkbox" checked={form.home_visibility === 'private'} onChange={(e) => setForm({ ...form, home_visibility: e.target.checked ? 'private' : 'friends' })} />
          <span><strong>집 비공개</strong><small>켜면 가족과 친구도 놀러 오거나 방명록을 남길 수 없어요</small></span></label>
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
  const { profileId, patchState } = useGame();
  const [list, setList] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    rpc<any[]>('list_mail', { p: profileId }).then((l) => {
      setList(l);
      if (l.some((m) => !m.read_at)) rpc('mark_mail_read', { p: profileId }).then(() => patchState((s) => ({ ...s, unread: 0 }))).catch(() => {});
    }).catch((e) => setErr(e.message));
  }, [profileId]);
  const text = (m: any) => {
    if (m.kind === 'guestbook') return `${m.payload.nickname}님이 방명록을 남겼어요${m.payload.preview ? `: "${m.payload.preview}"` : ''}`;
    if (m.kind === 'invite_accepted') return `${m.payload.nickname}님이 ${m.payload.kind === 'family' ? '가족' : '친구'} 초대를 받았어요`;
    return '새 소식이 있어요';
  };
  return (
    <Sheet title="우편함" onClose={onClose}>
      {err && <ErrorLine msg={err} />}
      {!list && !err && <Spinner />}
      {list?.length === 0 && <p className="fine">아직 온 소식이 없어요.</p>}
      <ul className="mail-list">
        {list?.map((m) => <li key={m.id} className={m.read_at ? '' : 'unread'}><p>{text(m)}</p><small>{timeAgo(m.created_at)}</small></li>)}
      </ul>
      <p className="fine">내 방명록 전체는 집의 올빼미 우편함을 눌러 볼 수 있어요.</p>
    </Sheet>
  );
}
