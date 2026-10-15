// 시작 화면(선물 편지·로그인), 첫 프로필 만들기, 프로필 고르기
import { useState } from 'react';
import { IconBrandGoogle, IconPlus } from '@tabler/icons-react';
import { supabase } from '../lib/supabase';
import { rpc, ApiError } from '../lib/api';
import { useGame, asset } from '../lib/store';
import { AVATARS, GUIDES } from '../data/catalog';
import { Avatar, ErrorLine } from '../ui';

export function Login() {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const redirectTo = location.origin + import.meta.env.BASE_URL;
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) { setErr('구글 로그인을 시작하지 못했어요. 잠시 뒤에 다시 눌러 주세요.'); setBusy(false); }
  };
  return (
    <main className="entry">
      <div className="entry-art" aria-hidden>
        <img src={asset('assets/env/garden_base.webp')} alt="" />
      </div>
      <section className="letter">
        <h1>올림포스의<br />작은 정원</h1>
        <p>스도쿠를 한 판 풀 때마다 별빛이 모여요. 별빛으로 작은 집과 구름 정원을 꾸미고, 신화 속 보물을 놓아 두고, 가족의 집에 놀러 가 방명록을 남겨 보세요.</p>
        <button className="btn primary big" onClick={go} disabled={busy}>
          <IconBrandGoogle size={22} aria-hidden /> 구글 계정으로 시작하기
        </button>
        <p className="fine">아이는 보호자가 로그인한 뒤 아이 프로필을 만들어 함께 써요. 아이 이메일은 필요하지 않아요.</p>
        <p className="fine"><a href={`${import.meta.env.BASE_URL}privacy.html`}>개인정보처리방침</a></p>
        {err && <ErrorLine msg={err} />}
      </section>
    </main>
  );
}

export function CreateProfile({ child, onDone, onCancel }: { child?: boolean; onDone: (id: string) => void; onCancel?: () => void }) {
  const { profileId } = useGame();
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState(child ? 'iris' : 'hestia');
  const [guide, setGuide] = useState('hestia');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (!nickname.trim()) { setErr('이름을 적어 주세요.'); return; }
    setBusy(true); setErr(null);
    try {
      const id = child
        ? await rpc<string>('create_child_profile', { guardian: profileId, nickname: nickname.trim(), avatar_id: avatar, guide_id: guide })
        : await rpc<string>('create_my_profile', { nickname: nickname.trim(), avatar_id: avatar, guide_id: guide });
      onDone(id);
    } catch (e) { setErr((e as ApiError).message); setBusy(false); }
  };
  return (
    <main className="onboard">
      <h1>{child ? '아이 프로필 만들기' : '어떻게 불러 드릴까요?'}</h1>
      <label className="field">
        <span>게임 속 이름</span>
        <input value={nickname} maxLength={12} onChange={(e) => setNickname(e.target.value)} placeholder="예: 별빛 정원사" autoFocus />
        <small>이 이름이 친구에게 보여요 ({nickname.length}/12)</small>
      </label>
      <fieldset className="field">
        <legend>얼굴 그림</legend>
        <div className="avatar-grid">
          {AVATARS.map((a) => (
            <button key={a} className={`avatar-pick${a === avatar ? ' on' : ''}`} onClick={() => setAvatar(a)} aria-pressed={a === avatar} aria-label={a}>
              <Avatar id={a} size={56} />
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="field">
        <legend>처음 함께할 안내 친구</legend>
        <div className="guide-pick">
          {GUIDES.slice(0, 2).map((g) => (
            <button key={g.id} className={`guide-card${g.id === guide ? ' on' : ''}`} onClick={() => setGuide(g.id)} aria-pressed={g.id === guide}>
              <Avatar id={g.id} size={64} />
              <strong>{g.name}</strong><span>{g.role}</span>
            </button>
          ))}
        </div>
        <small>아폴론과 아르테미스는 여정을 걷다 보면 만나요.</small>
      </fieldset>
      {err && <ErrorLine msg={err} />}
      <div className="row-end">
        {onCancel && <button className="btn" onClick={onCancel}>취소</button>}
        <button className="btn primary" onClick={submit} disabled={busy}>{busy ? '만드는 중' : '집 받기'}</button>
      </div>
    </main>
  );
}

export function ProfilePicker() {
  const { profiles, selectProfile, reloadProfiles, signOut } = useGame();
  const [creating, setCreating] = useState<null | 'self'>(null);
  if (!profiles) return null;
  const hasSelf = profiles.some((p) => p.mine);
  if (!hasSelf || creating === 'self') {
    return <CreateProfile onDone={async (id) => { await reloadProfiles(); selectProfile(id); }} />;
  }
  return (
    <main className="onboard">
      <h1>누가 놀까요?</h1>
      <ul className="profile-list">
        {profiles.map((p) => (
          <li key={p.id}>
            <button className="profile-btn" onClick={() => selectProfile(p.id)}>
              <Avatar id={p.avatar_id} size={56} /><strong>{p.nickname}</strong>{p.is_child && <span className="tag">아이</span>}
            </button>
          </li>
        ))}
      </ul>
      <p className="fine"><IconPlus size={14} aria-hidden /> 아이 프로필은 내 프로필로 들어가서 설정에서 만들 수 있어요.</p>
      <button className="btn ghost" onClick={signOut}>로그아웃</button>
    </main>
  );
}
