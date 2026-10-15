import { useEffect, useState } from 'react';
import { playMusic, stopMusic } from './lib/sound';
import { BGM } from './data/catalog';
import { IconHome2, IconGridDots, IconUsers, IconBook2, IconMailbox, IconSettings, IconTrophy } from '@tabler/icons-react';
import { useGame } from './lib/store';
import { configured } from './lib/supabase';
import { Login, ProfilePicker } from './screens/Entry';
import { HomeScreen } from './screens/HomeScreen';
import { SudokuSelect, PuzzleScreen, ResultScreen, AttemptData } from './screens/Sudoku';
import { FriendsScreen } from './screens/Friends';
import { RankingScreen } from './screens/Ranking';
import { DexScreen } from './screens/Dex';
import { SettingsSheet, MailSheet } from './screens/Settings';
import { Avatar, Starlight, Spinner, ErrorLine } from './ui';

type Tab = 'home' | 'sudoku' | 'rank' | 'friends' | 'dex';

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
  const { state, toastMsg, refresh, settings } = useGame();
  const [tab, setTab] = useState<Tab>('home');
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [result, setResult] = useState<any>(null);
  const [sheet, setSheet] = useState<'settings' | 'mail' | null>(null);

  // 배경음악: 스도쿠 푸는 화면은 아테나, 그 밖은 헤스티아. 소리를 켠 경우에만.
  const scene = attempt ? 'sudoku' : 'home';
  useEffect(() => {
    if (settings.sound) playMusic(import.meta.env.BASE_URL, BGM[scene]);
    else stopMusic();
  }, [settings.sound, scene]);

  // 휴대폰 뒤로 가기: 퍼즐·방문 화면을 닫는다
  useEffect(() => {
    const onPop = () => { setAttempt(null); setResult(null); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const openLayer = () => history.pushState({ layer: true }, '');
  const closeLayer = () => { if (history.state?.layer) history.back(); };

  const toastEl = toastMsg && <div className="toast" role="status">{toastMsg}</div>;
  if (attempt) return (
    <>
      <PuzzleScreen key={attempt.id} attempt={attempt}
        onExit={() => { setAttempt(null); closeLayer(); refresh(); }}
        onComplete={(r) => { setAttempt(null); setResult(r); }} />
      {toastEl}
    </>
  );
  if (result) return (
    <ResultScreen result={result} onHome={() => { setResult(null); closeLayer(); setTab('home'); window.scrollTo(0, 0); }}
      onAgain={() => { setResult(null); closeLayer(); setTab('sudoku'); }} />
  );

  return (
    <div className="app">
      <header className="topbar">
        <button className="me" onClick={() => setSheet('settings')} aria-label="설정과 프로필">
          <Avatar id={state!.profile.avatar_id} size={34} badge={state!.profile.badge} /><span className="me-name">{state!.profile.nickname}</span>
        </button>
        <Starlight value={state!.balance} />
        <button className="icon-btn badge-wrap" aria-label={`우편함${state!.unread ? `, 새 소식 ${state!.unread}개` : ''}`} onClick={() => setSheet('mail')}>
          <IconMailbox />{state!.unread > 0 && <span className="badge">{state!.unread}</span>}
        </button>
        <button className="icon-btn" aria-label="설정" onClick={() => setSheet('settings')}><IconSettings /></button>
      </header>
      <main className="content">
        {tab === 'home' ? <HomeScreen goSudoku={() => setTab('sudoku')} goFriends={() => setTab('friends')} goDex={() => setTab('dex')} />
          : tab === 'sudoku' ? <SudokuSelect onStart={(a) => { openLayer(); setAttempt(a); }} />
          : tab === 'rank' ? <RankingScreen />
          : tab === 'friends' ? <FriendsScreen />
          : <DexScreen />}
      </main>
      <nav className="tabbar" aria-label="주 메뉴">
        {([['home', '홈', IconHome2], ['sudoku', '스도쿠', IconGridDots], ['rank', '순위', IconTrophy], ['friends', '친구', IconUsers], ['dex', '도감', IconBook2]] as const).map(([k, l, I]) => (
          <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => { setTab(k); window.scrollTo(0, 0); }}>
            <I aria-hidden /><span>{l}</span>
          </button>
        ))}
      </nav>
      {sheet === 'settings' && <SettingsSheet onClose={() => setSheet(null)} />}
      {sheet === 'mail' && <MailSheet onClose={() => setSheet(null)} />}
      {toastEl}
    </div>
  );
}
