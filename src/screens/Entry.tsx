// 시작 화면(선물 편지·로그인), 첫 프로필 만들기, 프로필 고르기
import { useState } from 'react';
import { IconBrandGoogle, IconPlus } from '@tabler/icons-react';
import { supabase } from '../lib/supabase';
import { rpc, ApiError } from '../lib/api';
import { useGame } from '../lib/store';
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
        <Avatar id="apollo" size={92} /><Avatar id="athena" size={124} /><Avatar id="artemis" size={92} />
      </div>
      <section className="letter">
        <h1>올림포스의<br />작은 정원</h1>
        <p>스도쿠를 한 판 풀 때마다 별빛이 모여요. 별빛으로 그리스 신화 인물 초상화를 모으고, 순위표에서 겨루고, 친구와 가족의 소식에 이모티콘을 달아 보세요.</p>
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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (!nickname.trim()) { setErr('이름을 적어 주세요.'); return; }
    setBusy(true); setErr(null);
    try {
      const id = child
        ? await rpc<string>('create_child_profile', { guardian: profileId, nickname: nickname.trim(), avatar_id: '', guide_id: 'hestia' })
        : await rpc<string>('create_my_profile', { nickname: nickname.trim(), avatar_id: '', guide_id: 'hestia' });
      onDone(id);
    } catch (e) { setErr((e as ApiError).message); setBusy(false); }
  };
  return (
    <main className="onboard">
      <h1>{child ? '아이 프로필 만들기' : '어떻게 불러 드릴까요?'}</h1>
      <label className="field">
        <span>게임 속 이름</span>
        <input value={nickname} maxLength={12} onChange={(e) => setNickname(e.target.value)} placeholder="예: 별빛 정원사" autoFocus />
        <small>순위표와 친구 소식에 보여요 ({nickname.length}/12). {child ? '실명 대신 별명을 추천해요.' : ''}</small>
      </label>
      <div className="first-portrait">
        <Avatar id="" size={72} />
        <p>초상화는 빈칸으로 시작해요. 스도쿠 첫 판을 끝내면 초상화 셋 중 하나를 선물로 골라요.</p>
      </div>
      {err && <ErrorLine msg={err} />}
      <div className="row-end">
        {onCancel && <button className="btn" onClick={onCancel}>취소</button>}
        <button className="btn primary" onClick={submit} disabled={busy}>{busy ? '만드는 중' : '시작하기'}</button>
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
