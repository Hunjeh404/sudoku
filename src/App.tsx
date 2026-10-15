import { useEffect, useState } from 'react';
import { IconHome2, IconGridDots, IconUsers, IconBook2, IconMailbox, IconSettings } from '@tabler/icons-react';
import { useGame } from './lib/store';
import { configured } from './lib/supabase';
import { Login, ProfilePicker } from './screens/Entry';
import { HomeScreen } from './screens/HomeScreen';
import { SudokuSelect, PuzzleScreen, ResultScreen, AttemptData } from './screens/Sudoku';
import { FriendsScreen, VisitScreen } from './screens/Social';
import { DexScreen } from './screens/Dex';
import { SettingsSheet, MailSheet } from './screens/Settings';
import { Avatar, Starlight, Spinner, ErrorLine } from './ui';

type Tab = 'home' | 'sudoku' | 'friends' | 'dex';

export function App() {
  const g = useGame();
  if (!configured) return <main className="page"><ErrorLine msg="게임 서버 주소가 설정되지 않았어요. 배포 설정을 확인해 주세요." /></main>;
  if (!g.authReady) return <Splash />;
  if (!g.session) return <Login />;
  if (g.error && !g.state) return <main className="page"><ErrorLine msg={g.error} onRetry={() => location.reload()} /></main>;
  if (!g.profiles) return <Splash />;
  if (!g.profileId) return <ProfilePicker />;
  if (!g.state) return <Splash />;
  return <Game />;
}

function Splash() {
  return <main className="splash"><h1>올림포스의<br />작은 정원</h1><Spinner /></main>;
}

function Game() {
  const { state, toastMsg, refresh } = useGame();
  const [tab, setTab] = useState<Tab>('home');
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [result, setResult] = useState<any>(null);
  const [visiting, setVisiting] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'settings' | 'mail' | null>(null);

  // 휴대폰 뒤로 가기: 퍼즐·방문 화면을 닫는다
  useEffect(() => {
    const onPop = () => { setAttempt(null); setVisiting(null); setResult(null); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const openLayer = () => history.pushState({ layer: true }, '');
  const closeLayer = () => { if (history.state?.layer) history.back(); };

  if (attempt) return (
    <PuzzleScreen key={attempt.id} attempt={attempt}
      onExit={() => { setAttempt(null); closeLayer(); refresh(); }}
      onComplete={(r) => { setAttempt(null); setResult(r); }} />
  );
  if (result) return (
    <ResultScreen result={result} onHome={() => { setResult(null); closeLayer(); setTab('home'); }}
      onAgain={() => { setResult(null); closeLayer(); setTab('sudoku'); }} />
  );
  const visit = (id: string) => { openLayer(); setVisiting(id); };

  return (
    <div className="app">
      <header className="topbar">
        <button className="me" onClick={() => setSheet('settings')} aria-label="설정과 프로필">
          <Avatar id={state!.profile.avatar_id} size={34} /><span className="me-name">{state!.profile.nickname}</span>
        </button>
        <Starlight value={state!.balance} />
        <button className="icon-btn badge-wrap" aria-label={`우편함${state!.unread ? `, 새 소식 ${state!.unread}개` : ''}`} onClick={() => setSheet('mail')}>
          <IconMailbox />{state!.unread > 0 && <span className="badge">{state!.unread}</span>}
        </button>
        <button className="icon-btn" aria-label="설정" onClick={() => setSheet('settings')}><IconSettings /></button>
      </header>
      <main className="content">
        {visiting ? <VisitScreen ownerId={visiting} onBack={() => { setVisiting(null); closeLayer(); }} visit={(id) => setVisiting(id)} />
          : tab === 'home' ? <HomeScreen goSudoku={() => setTab('sudoku')} visit={visit} />
          : tab === 'sudoku' ? <SudokuSelect onStart={(a) => { openLayer(); setAttempt(a); }} />
          : tab === 'friends' ? <FriendsScreen visit={visit} />
          : <DexScreen />}
      </main>
      <nav className="tabbar" aria-label="주 메뉴">
        {([['home', '내 집', IconHome2], ['sudoku', '스도쿠', IconGridDots], ['friends', '친구', IconUsers], ['dex', '도감', IconBook2]] as const).map(([k, l, I]) => (
          <button key={k} className={tab === k && !visiting ? 'on' : ''} aria-current={tab === k && !visiting ? 'page' : undefined}
            onClick={() => { if (visiting) { setVisiting(null); closeLayer(); } setTab(k); }}>
            <I aria-hidden /><span>{l}</span>
          </button>
        ))}
      </nav>
      {sheet === 'settings' && <SettingsSheet onClose={() => setSheet(null)} />}
      {sheet === 'mail' && <MailSheet onClose={() => setSheet(null)} />}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}
