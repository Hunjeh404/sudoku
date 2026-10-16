// 순위: 점수(통합·난이도별)와 빨리 푼 순위(난이도별), 오늘·이번 주·이번 달. 전체 플레이어 상위 50명과 내 순위
import { useEffect, useState } from 'react';
import { IconTrophy } from '@tabler/icons-react';
import { useGame } from '../lib/store';
import { rpc } from '../lib/api';
import { BOARDS } from '../data/catalog';
import { Avatar, ErrorLine, Spinner, TitleTag, mmss } from '../ui';

interface Row { rank: number; id: string; nickname: string; avatar_id: string; badge?: string; title: string; points?: number; sec?: number; games: number; me: boolean }
interface Board { rows: Row[]; me: { rank: number; points?: number; sec?: number; games: number } | null }

export function RankingScreen() {
  const { profileId, state } = useGame();
  const [kind, setKind] = useState<'points' | 'speed'>('points');
  const [board, setBoard] = useState<string>('all');
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  // 빨리 푼 순위는 난이도별로만 있다
  const shownBoard = kind === 'speed' && board === 'all' ? '9e' : board;
  const [data, setData] = useState<Board | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => { setData(null); setErr(null); rpc<Board>('get_leaderboard', { p: profileId, board: shownBoard, period, kind }).then(setData).catch((e) => setErr(e.message)); };
  useEffect(load, [shownBoard, period, kind, profileId]);
  const meInTop = data?.rows.some((r) => r.me);
  return (
    <div className="page">
      <h1 className="page-title">순위</h1>
      <div className="seg" role="tablist" aria-label="순위 종류">
        {([['points', '점수'], ['speed', '빨리 푼 순위']] as const).map(([k, l]) =>
          <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}
      </div>
      <div className="chips" role="group" aria-label="기간">
        {([['day', '오늘'], ['week', '이번 주'], ['month', '이번 달']] as const).map(([k, l]) =>
          <button key={k} className={`chip${period === k ? ' on' : ''}`} aria-pressed={period === k} onClick={() => setPeriod(k)}>{l}</button>)}
      </div>
      <div className="chips" role="group" aria-label="순위표">
        {BOARDS.filter((b) => (kind === 'points' || b.id !== 'all') && (b.id !== '9d' || state!.profile.title === 'five')).map((b) =>
          <button key={b.id} className={`chip${shownBoard === b.id ? ' on' : ''}`} aria-pressed={shownBoard === b.id} onClick={() => setBoard(b.id)}>{b.label}</button>)}
      </div>
      <p className="fine">{kind === 'points'
        ? '점수는 한 판을 끝내고 받은 별빛이에요(힌트를 쓰면 줄어요). 별빛을 써도 점수는 줄지 않아요.'
        : '힌트 없이 끝낸 판 중 가장 빨리 푼 시간으로 줄을 세워요.'}{period === 'week' ? ' 이번 주는 월요일 0시부터예요.' : ''}</p>
      {err && <ErrorLine msg={err} onRetry={load} />}
      {!data && !err && <Spinner />}
      {data && data.rows.length === 0 && <p className="fine">아직 이 순위표에 오른 사람이 없어요. 첫 번째가 되어 보세요!</p>}
      {data && (
        <ol className="rank-list">
          {data.rows.map((r) => <RankRow key={r.id} r={r} />)}
        </ol>
      )}
      {data && !meInTop && (
        <div className="rank-me">
          {data.me
            ? <RankRow r={{ rank: data.me.rank, id: profileId!, nickname: state!.profile.nickname, avatar_id: state!.profile.avatar_id, badge: state!.profile.badge, title: state!.profile.title, points: data.me.points, sec: data.me.sec, games: data.me.games, me: true }} />
            : <p className="fine">아직 이 순위표에 내 점수가 없어요.</p>}
        </div>
      )}
    </div>
  );
}

function RankRow({ r }: { r: Row }) {
  return (
    <li className={`rank-row${r.me ? ' me' : ''}${r.rank <= 3 ? ` top${r.rank}` : ''}`}>
      <span className="rank-n">{r.rank <= 3 ? <IconTrophy size={20} aria-label={`${r.rank}등`} /> : r.rank}</span>
      <Avatar id={r.avatar_id} size={40} badge={r.badge} />
      <span className="grow"><strong>{r.nickname}</strong>{r.me && <small className="me-tag">나</small>} <TitleTag id={r.title} /><small>{r.games}판</small></span>
      {r.sec !== undefined
        ? <span className="rank-pts">{mmss(r.sec)}</span>
        : <span className="rank-pts">{(r.points ?? 0).toLocaleString()}<small>점</small></span>}
    </li>
  );
}
