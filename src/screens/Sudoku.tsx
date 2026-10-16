// 스도쿠 고르기·풀기·결과
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconFeather, IconEraser, IconArrowBackUp, IconArrowForwardUp, IconBulb, IconArrowLeft, IconCloudCheck, IconCloudUpload, IconCloudOff, IconAlertTriangle, IconChecks,
} from '@tabler/icons-react';
import { useGame, asset } from '../lib/store';
import { rpc, newOpId, ApiError } from '../lib/api';
import { getLocal, setLocal, delLocal } from '../lib/local';
import { Board, Size, parseBoard, boardToString, conflicts, geometry, rowOf, colOf, countSolutions } from '../sudoku/engine';
import { makeHint, Hint } from '../sudoku/hints';
import { REWARD_RULES, boardName, rewardText, hintMax, freeFirstHint, storyEvery, TITLE_NAME, DIFF_KO, DIAG_RULE } from '../data/catalog';
import { nextJourney } from './Journey';
import { Sheet, Starlight, ErrorLine, Spinner, Avatar, mmss, secText } from '../ui';
import { sfx } from '../lib/sound';
import { TREASURE_FX, boardThemeFor, themeVars } from '../data/effects';
import { coinVars } from '../fx';
import { FxLayers } from '../fx';

const PICTURE = ['lyre', 'cornucopia', 'olive_tree', 'pandora_jar'];
const PICTURE_KO = ['리라', '풍요의 뿔', '올리브 나무', '항아리'];

export interface AttemptData { id: string; puzzle_id: string; size: Size; difficulty: string; givens: string; board: string; notes: Record<string, number[]>; revision: number; hints_used: number }

export function SudokuSelect({ onStart }: { onStart: (a: AttemptData) => void }) {
  const { state, profileId } = useGame();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tutorial, setTutorial] = useState(false);
  const [confirm, setConfirm] = useState<{ size: number; difficulty: string; id: string } | null>(null);
  // 같은 크기·난이도의 이어서 풀던 판이 있으면 새로 시작하기 전에 묻는다(새로 시작하면 그 판은 사라짐)
  const start = (size: number, difficulty: string) => {
    const old = state!.active.find((a) => a.size === size && a.difficulty === difficulty);
    if (old) setConfirm({ size, difficulty, id: old.id });
    else startNew(size, difficulty);
  };
  const startNew = async (size: number, difficulty: string) => {
    setConfirm(null);
    setBusy(`${size}${difficulty}`); setErr(null);
    try { onStart(await rpc<AttemptData>('start_attempt', { p: profileId, board_size: size, difficulty })); }
    catch (e) { setErr((e as ApiError).message); }
    setBusy(null);
  };
  const resume = async (id: string) => {
    setBusy(id);
    try { onStart(await rpc<AttemptData>('get_attempt', { attempt: id })); } catch (e) { setErr((e as ApiError).message); }
    setBusy(null);
  };
  const first = state!.quest.completed_count === 0;
  const amount = (s: number, d: string) => REWARD_RULES.find((r) => r.size === s && r.difficulty === d)!.amount;
  const choices: [number, string, string][] = [[4, 'intro', '4×4 입문'], [6, 'intro', '6×6 입문'], [9, 'easy', '9×9 쉬움'], [9, 'medium', '9×9 보통'], [9, 'hard', '9×9 어려움']];
  // 신화(대각선)는 칭호「은하수의 방랑자」를 단 사람에게만 보인다
  if (state!.profile.title === 'five') choices.push([9, 'diag', '9×9 신화']);
  return (
    <div className="page">
      <h1 className="page-title">스도쿠</h1>
      <div className="athena-line"><Avatar id="athena" size={48} /><p><strong>아테나</strong> 오늘은 어떤 판을 풀어 볼까요? 천천히 생각하면 길이 보여요.</p></div>
      {state!.active.length > 0 && (
        <section>
          <h2 className="sub">이어서 풀기</h2>
          <ul className="resume-list">
            {state!.active.slice(0, 3).map((a) => (
              <li key={a.id}><button className="resume" onClick={() => resume(a.id)} disabled={!!busy}>
                {a.size}×{a.size} {DIFF_KO[a.difficulty]}<small>마지막 저장 {new Date(a.updated_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small>
              </button></li>
            ))}
          </ul>
        </section>
      )}
      {first && (
        <section className="first-card">
          <p>처음이라면 4×4로 규칙을 익혀 보세요. 이미 스도쿠를 안다면 9×9로 바로 시작해도 돼요.</p>
          <div className="row">
            <button className="btn primary" onClick={() => setTutorial(true)}>4×4 짧은 안내</button>
            <button className="btn" onClick={() => start(9, 'easy')}>9×9 바로 시작</button>
          </div>
        </section>
      )}
      <h2 className="sub">새 문제</h2>
      <ul className="size-list">
        {choices.map(([s, d, label]) => (
          <li key={label}><button className={`size-card s${s}`} onClick={() => start(s, d)} disabled={!!busy}>
            <span className="size-mini" aria-hidden>{Array.from({ length: s === 9 ? 9 : s }, (_, i) => <i key={i} />)}</span>
            <strong>{label}{state!.records[`${s}:${d}`] && <small className="best">내 기록 {mmss(state!.records[`${s}:${d}`])}</small>}</strong><Starlight value={amount(s, d)} />
            {busy === `${s}${d}` && <Spinner label="문제 받는 중" />}
          </button></li>
        ))}
      </ul>
      {err && <ErrorLine msg={err} />}
      <p className="fine">시간 제한과 실수 제한은 없어요. 힌트 없이 끝낸 판은 푼 시간이 내 기록이 돼요. 힌트는 한 판에 {hintMax(state!.profile.title)}번까지 쓸 수 있고, 한 번 쓸 때마다 받을 별빛이 10%씩 줄어요{freeFirstHint(state!.profile.title) ? '(칭호 스킬로 첫 힌트는 줄지 않아요)' : ''}.</p>
      {confirm && (
        <Sheet title="이어서 풀던 판이 있어요" onClose={() => setConfirm(null)}>
          <p>{confirm.size}×{confirm.size} {DIFF_KO[confirm.difficulty]} 판을 풀다가 멈췄어요. 새로 시작하면 이어서 풀던 판은 처음으로 돌아가지 않고 사라져요. 새 판으로 시작할까요?</p>
          <div className="stack">
            <button className="btn" onClick={() => { const id = confirm.id; setConfirm(null); resume(id); }}>이어서 풀기</button>
            <button className="btn primary" onClick={() => startNew(confirm.size, confirm.difficulty)}>새 판으로 시작</button>
          </div>
        </Sheet>
      )}
      {tutorial && (
        <Sheet title="4×4 스도쿠 규칙" onClose={() => setTutorial(false)}>
          <ol className="rules">
            <li>가로줄마다 1부터 4까지 숫자가 한 번씩 들어가요.</li>
            <li>세로줄도 마찬가지예요.</li>
            <li>굵은 선으로 나뉜 네 칸짜리 상자에도 1부터 4가 한 번씩 들어가요.</li>
            <li>칸을 누르고 아래 숫자를 누르면 들어가요. 막히면 전구 버튼으로 힌트를 받아요.</li>
          </ol>
          <div className="row-end"><button className="btn primary" onClick={() => { setTutorial(false); start(4, 'intro'); }}>4×4 풀어 보기</button></div>
        </Sheet>
      )}
    </div>
  );
}

type Notes = Record<number, number[]>;
interface Snap { board: Board; notes: Notes }
type SaveStatus = 'saved' | 'saving' | 'offline' | 'conflict';

export function PuzzleScreen({ attempt, onExit, onComplete }: { attempt: AttemptData; onExit: () => void; onComplete: (r: any) => void }) {
  const { session, profileId, settings, toast, state } = useGame();
  const n = attempt.size;
  const badge = state?.profile.badge || '';
  const fx = TREASURE_FX[badge];
  const HM = hintMax(state?.profile.title ?? ''); // 한 판 힌트 상한(칭호「미궁 탐험가」 11번)
  const themed = boardThemeFor(state?.profile.avatar_id ?? '');
  const theme = themed?.theme;
  const diag = attempt.difficulty === 'diag'; // 신화: 두 대각선도 규칙에 들어감
  const g = geometry(n, diag);
  const givens = useMemo(() => parseBoard(attempt.givens), [attempt.givens]);
  const solution = useMemo(() => countSolutions(givens, n, 2, diag).solution!, [givens, n, diag]);
  const localKey = `att:${session?.user.id}:${profileId}:${attempt.id}`;
  const initial = useMemo<Snap & { revision: number; hints: number }>(() => {
    const server = { board: parseBoard(attempt.board), notes: Object.fromEntries(Object.entries(attempt.notes ?? {}).map(([k, v]) => [Number(k), v])), revision: attempt.revision, hints: attempt.hints_used };
    const local = getLocal<any>(localKey, null);
    if (local && local.revision === attempt.revision && local.dirty) return { ...local, board: local.board };
    return server;
  }, []);
  const [hist, setHist] = useState<{ list: Snap[]; i: number }>({ list: [{ board: initial.board, notes: initial.notes }], i: 0 });
  const cur = hist.list[hist.i];
  const [sel, setSel] = useState<number | null>(() => initial.board.findIndex((v) => !v));
  const [memo, setMemo] = useState(false);
  const [hint, setHint] = useState<{ h: Hint; level: number } | null>(null);
  const [hintsUsed, setHintsUsed] = useState(initial.hints);
  const [checkMarks, setCheckMarks] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [completing, setCompleting] = useState<'idle' | 'busy' | 'failed'>('idle');
  const [completeErr, setCompleteErr] = useState<string | null>(null);
  const revision = useRef(initial.revision);
  const dirty = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const opRef = useRef(newOpId());
  // 푼 시간은 서버가 잰다: 서버에 남은 시작 시각부터 끝낸 시각까지 전부(나갔다 들어온 시간 포함).
  // 여기 seconds는 화면에 보여 주는 용도뿐(open_attempt가 알려 준 시작부터 지금까지에서 이어 센다).
  const [seconds, setSeconds] = useState(0);
  const picture = n === 4 && settings.pictureMode;
  const sym = (d: number) => (picture ? PICTURE_KO[d - 1] : String(d));

  useEffect(() => {
    const open = () => rpc<{ played_sec: number }>('open_attempt', { attempt: attempt.id }).then((r) => setSeconds(r.played_sec)).catch(() => {});
    const pause = () => rpc('pause_attempt', { attempt: attempt.id }).catch(() => {});
    open();
    const onVis = () => (document.visibilityState === 'visible' ? open() : pause());
    document.addEventListener('visibilitychange', onVis);
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') setSeconds((x) => x + 1); }, 1000);
    // 화면을 떠날 때(뒤로 가기 포함)도 구간을 닫는다. 끝난 판이면 서버가 무시한다.
    return () => { document.removeEventListener('visibilitychange', onVis); window.clearInterval(t); pause(); };
  }, [attempt.id]);

  const pushServer = useCallback(async () => {
    if (!dirty.current) return;
    const snap = latest.current;
    setStatus('saving');
    try {
      const r = await rpc('save_attempt', { attempt: attempt.id, expected_revision: revision.current, board: boardToString(snap.board), notes: snap.notes, hints_used: hintsRef.current, op_id: newOpId() });
      revision.current = r.revision;
      dirty.current = false;
      setLocal(localKey, { ...snap, revision: r.revision, hints: hintsRef.current, dirty: false });
      setStatus('saved');
    } catch (e) {
      const ae = e as ApiError;
      if (ae.code === 'conflict') setStatus('conflict');
      else if (ae.code === 'not_active') setStatus('saved');
      else setStatus('offline');
    }
  }, [attempt.id, localKey]);
  const latest = useRef<Snap>(cur);
  const hintsRef = useRef(hintsUsed);
  hintsRef.current = hintsUsed;

  const record = (next: Snap) => {
    setHist((h) => ({ list: [...h.list.slice(0, h.i + 1), next].slice(-200), i: Math.min(h.i + 1, 199) }));
    latest.current = next;
    dirty.current = true;
    setLocal(localKey, { ...next, revision: revision.current, hints: hintsRef.current, dirty: true });
    setStatus((s) => (s === 'conflict' ? s : 'saving'));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(pushServer, 1500);
    setCheckMarks(new Set());
  };
  useEffect(() => { latest.current = cur; }, [cur]);
  useEffect(() => {
    const flush = () => { if (document.visibilityState === 'hidden') pushServer(); };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('online', pushServer);
    return () => { document.removeEventListener('visibilitychange', flush); window.removeEventListener('online', pushServer); window.clearTimeout(timer.current); };
  }, [pushServer]);

  const bad = useMemo(() => conflicts(cur.board, n, diag), [cur.board, n, diag]);
  const full = cur.board.every((v) => v);

  const input = (d: number) => {
    if (sel === null || givens[sel]) return;
    const board = cur.board.slice();
    const notes: Notes = { ...cur.notes };
    if (memo) {
      if (board[sel]) return;
      // 보물을 달았으면: 같은 줄·칸·구역에 처음부터 있던 숫자는 메모에 넣지 않는다(지우기는 된다)
      if (badge && !(notes[sel] ?? []).includes(d) && g.peers[sel].some((p) => givens[p] === d)) {
        toast('이미 있는 숫자예요.');
        return;
      }
      const s = new Set(notes[sel] ?? []);
      s.has(d) ? s.delete(d) : s.add(d);
      notes[sel] = [...s].sort();
    } else {
      board[sel] = board[sel] === d ? 0 : d;
      delete notes[sel];
      if (settings.autoNotes && board[sel]) for (const p of g.peers[sel]) if (notes[p]) notes[p] = notes[p].filter((x) => x !== d);
    }
    sfx.tap();
    record({ board, notes });
  };
  const erase = () => {
    if (sel === null || givens[sel]) return;
    const notes = { ...cur.notes }; delete notes[sel];
    const board = cur.board.slice(); board[sel] = 0;
    record({ board, notes });
  };
  const jump = (i: number) => {
    const s = hist.list[i];
    setHist((h) => ({ ...h, i }));
    latest.current = s; dirty.current = true;
    setLocal(localKey, { ...s, revision: revision.current, hints: hintsRef.current, dirty: true });
    window.clearTimeout(timer.current); timer.current = window.setTimeout(pushServer, 1500);
  };
  const undo = () => { if (hist.i > 0) jump(hist.i - 1); };
  const redo = () => { if (hist.i < hist.list.length - 1) jump(hist.i + 1); };

  // 키보드 입력
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      const d = parseInt(e.key, 10);
      if (d >= 1 && d <= n) { input(d); e.preventDefault(); }
      else if (e.key === 'Backspace' || e.key === 'Delete') erase();
      else if (sel !== null && e.key.startsWith('Arrow')) {
        const r = rowOf(n, sel), c = colOf(n, sel);
        const [dr, dc] = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key] as number[];
        setSel(((r + dr + n) % n) * n + ((c + dc + n) % n)); e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const askHint = () => {
    if (!hint && hintsUsed >= HM) return;
    const h = makeHint(givens, cur.board, n, sym, diag);
    if (!hint) { setHintsUsed((x) => x + 1); hintsRef.current += 1; dirty.current = true; }
    setHint({ h, level: 1 });
    if (h.focusCells[0] !== undefined) setSel(h.focusCells[0]);
  };
  const applyHint = () => {
    if (!hint?.h.answer) return;
    const { cell, digit } = hint.h.answer;
    const board = cur.board.slice(); board[cell] = digit;
    const notes = { ...cur.notes }; delete notes[cell];
    if (settings.autoNotes) for (const p of g.peers[cell]) if (notes[p]) notes[p] = notes[p].filter((x) => x !== digit);
    record({ board, notes });
    setHint(null);
  };
  const check = () => {
    const wrong = new Set(cur.board.map((v, i) => (v && !givens[i] && v !== solution[i] ? i : -1)).filter((i) => i >= 0));
    setCheckMarks(wrong);
    toast(wrong.size ? `맞지 않는 칸이 ${wrong.size}개 있어요` : '지금까지 넣은 숫자는 모두 맞아요');
  };

  const complete = async () => {
    setCompleting('busy'); setCompleteErr(null);
    window.clearTimeout(timer.current);
    // 힌트 사용 기록이 서버에 먼저 반영되도록 마지막 진행을 저장(무힌트 배지 판정)
    if (dirty.current) await pushServer();
    try {
      const r = await rpc('complete_attempt', { attempt: attempt.id, board: boardToString(cur.board), op_id: opRef.current });
      delLocal(localKey);
      sfx.success();
      onComplete(r);
    } catch (e) {
      const ae = e as ApiError;
      setCompleting('failed');
      setCompleteErr(ae.message);
    }
  };
  useEffect(() => {
    if (full && bad.size === 0 && completing === 'idle') {
      if (cur.board.every((v, i) => v === solution[i])) complete();
    }
  }, [full, bad.size]);

  const resolveConflict = async (useServer: boolean) => {
    const a = await rpc<AttemptData>('get_attempt', { attempt: attempt.id });
    revision.current = a.revision;
    if (useServer) {
      const snap = { board: parseBoard(a.board), notes: Object.fromEntries(Object.entries(a.notes ?? {}).map(([k, v]) => [Number(k), v])) as Notes };
      setHist({ list: [snap], i: 0 }); latest.current = snap; dirty.current = false; setStatus('saved');
      setLocal(localKey, { ...snap, revision: a.revision, dirty: false });
    } else { dirty.current = true; setStatus('saving'); await pushServer(); }
  };

  const selR = sel !== null ? rowOf(n, sel) : -1, selC = sel !== null ? colOf(n, sel) : -1;
  const selBox = sel !== null ? g.cellUnits[sel][2] : -1;
  const selVal = sel !== null ? cur.board[sel] : 0;
  const focus = new Set(hint && hint.level >= 1 ? hint.h.focusCells : []);
  const focusUnits = new Set(hint && hint.level >= 1 ? hint.h.focusUnits : []);
  const symbol = (d: number) => (picture ? <img className="pic" src={asset(`assets/treasure/${PICTURE[d - 1]}.webp`)} alt={PICTURE_KO[d - 1]} /> : d);

  const StatusIcon = { saved: IconCloudCheck, saving: IconCloudUpload, offline: IconCloudOff, conflict: IconAlertTriangle }[status];
  const statusText = { saved: '저장됨', saving: '저장 중', offline: '연결 끊김, 기기에 보관 중', conflict: '다른 기기와 충돌' }[status];

  return (
    <div className={`puzzle n${n}${fx?.scene ? ' has-fx' : ''}${fx?.coin ? ' coin-skin' : ''}`}
      style={fx?.scene ? { ['--fx-bg' as any]: fx.bg } : fx?.coin ? coinVars(badge) : undefined}>
      <FxLayers id={badge} />
      <header className="puzzle-head">
        <button className="icon-btn" aria-label="나가기" onClick={async () => { await pushServer(); await rpc('pause_attempt', { attempt: attempt.id }).catch(() => {}); onExit(); }}><IconArrowLeft /></button>
        <div className="grow"><strong>{n}×{n} {DIFF_KO[attempt.difficulty]}</strong>
          {settings.showTimer && <small> {mmss(seconds)}</small>}</div>
        <span className={`save-state ${status}`} role="status"><StatusIcon size={18} aria-hidden />{statusText}</span>
      </header>
      {diag && <p className="rule-line">{DIAG_RULE}</p>}

      <div className={`tablet${theme?.art ? ' themed-frame' : ''}`} style={themed ? themeVars(themed.key, themed.theme, asset('')) : undefined}>
      <div className={`board${theme ? ' themed' : ''}${theme?.dark ? ' dark' : ''}`} role="grid" aria-label={`${n}×${n} 스도쿠 판`}
        style={{ ['--n' as any]: n, ['--br' as any]: g.boxR, ['--bc' as any]: g.boxC }}>
        {cur.board.map((v, i) => {
          const r = rowOf(n, i), c = colOf(n, i);
          const cls = ['cell'];
          if (givens[i]) cls.push('given');
          if (i === sel) cls.push('sel');
          else if (r === selR || c === selC || g.cellUnits[i][2] === selBox) cls.push('peer');
          if (v && v === selVal) cls.push('same');
          if (bad.has(i)) cls.push('bad');
          if (checkMarks.has(i)) cls.push('wrong');
          if (focus.has(i)) cls.push('focus');
          if (g.cellUnits[i].some((u) => focusUnits.has(u))) cls.push('focus-unit');
          if ((c + 1) % g.boxC === 0 && c < n - 1) cls.push('bR');
          if ((r + 1) % g.boxR === 0 && r < n - 1) cls.push('bB');
          if (diag && (r === c || r + c === n - 1)) cls.push('dg');
          return (
            <button key={i} role="gridcell" className={cls.join(' ')} onClick={() => setSel(i)}
              aria-label={`가로 ${r + 1} 세로 ${c + 1}, ${v ? sym(v) : '빈칸'}${givens[i] ? ', 처음 숫자' : ''}${bad.has(i) ? ', 같은 숫자 겹침' : ''}${checkMarks.has(i) ? ', 틀림' : ''}`}>
              {v ? symbol(v) : cur.notes[i]?.length ? (
                <span className="notes" style={{ ['--bc' as any]: g.boxC }}>{Array.from({ length: n }, (_, d) => <i key={d}>{cur.notes[i].includes(d + 1) ? (picture ? '•' : d + 1) : ''}</i>)}</span>
              ) : null}
              {bad.has(i) && <span className="bad-mark" aria-hidden>!</span>}
            </button>
          );
        })}
      </div>
      </div>

      {hint && (
        <section className="hint" aria-live="polite">
          <div className="hint-who"><Avatar id="athena" size={40} /><p className="hint-step">아테나의 힌트 {hint.level}/4 · 남은 힌트 {HM - hintsUsed}번</p></div>
          <p>{hint.level >= 1 && (hint.h.kind === 'logic' ? '반짝이는 칸과 줄을 살펴보세요.' : hint.h.rule)}</p>
          {hint.level >= 2 && hint.h.kind === 'logic' && <p>{hint.h.rule}</p>}
          {hint.level >= 3 && <p>{hint.h.detail}</p>}
          <div className="row-end">
            <button className="btn small" onClick={() => setHint(null)}>닫기</button>
            {hint.level < 3 && hint.h.kind !== 'done' && <button className="btn small primary" onClick={() => setHint({ ...hint, level: hint.level + 1 })}>더 알려 줘</button>}
            {hint.level >= 3 && hint.h.answer && <button className="btn small primary" onClick={applyHint}>{hint.h.revealOnly ? '정답 보기' : '숫자 넣기'}</button>}
          </div>
        </section>
      )}

      <div className="pad-tools">
        <button className={`tool${memo ? ' on' : ''}`} aria-pressed={memo} onClick={() => setMemo(!memo)}><IconFeather aria-hidden />메모</button>
        <button className="tool" onClick={erase}><IconEraser aria-hidden />지우기</button>
        <button className="tool" onClick={undo} disabled={hist.i === 0}><IconArrowBackUp aria-hidden />되돌림</button>
        <button className="tool" onClick={redo} disabled={hist.i >= hist.list.length - 1}><IconArrowForwardUp aria-hidden />다시</button>
        <button className="tool" onClick={check}><IconChecks aria-hidden />확인</button>
        <button className="tool" onClick={askHint} disabled={!hint && hintsUsed >= HM}
          aria-label={`힌트, 남은 횟수 ${HM - hintsUsed}번, 쓸 때마다 별빛 10% 줄어요`}><IconBulb aria-hidden />힌트 {HM - hintsUsed}</button>
      </div>
      <div className={`pad pad${n}`}>
        {Array.from({ length: n }, (_, i) => i + 1).map((d) => {
          const left = n - cur.board.filter((v) => v === d).length;
          return <button key={d} className={`num${memo ? ' memo' : ''}`} onClick={() => input(d)} aria-label={`${sym(d)} 넣기${memo ? '(메모)' : ''}`}>
            <span className="coin-face">{symbol(d)}</span><small aria-hidden>{left > 0 ? left : ''}</small></button>;
        })}
      </div>

      {full && bad.size === 0 && completing !== 'busy' && completing !== 'idle' && (
        <section className="complete-retry" role="alert">
          <p>{completeErr ?? '완료를 확인하지 못했어요.'}</p>
          <button className="btn primary" onClick={complete}>완료 다시 확인</button>
        </section>
      )}
      {full && bad.size === 0 && !cur.board.every((v, i) => v === solution[i]) && <p className="fine center">모든 칸을 채웠지만 맞지 않는 칸이 있어요. 확인 버튼으로 찾아보세요.</p>}
      {completing === 'busy' && <div className="center"><Spinner label="완료 확인 중" /></div>}

      {status === 'conflict' && (
        <Sheet title="다른 기기에서 먼저 저장했어요" onClose={() => {}}>
          <p>같은 퍼즐을 다른 기기에서 풀고 있었어요. 어떤 판으로 이어 갈까요?</p>
          <div className="stack">
            <button className="btn" onClick={() => resolveConflict(true)}>저장된 판 불러오기</button>
            <button className="btn primary" onClick={() => resolveConflict(false)}>이 기기의 판으로 저장</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

export function ResultScreen({ result, onHome, onAgain }: { result: any; onHome: () => void; onAgain: () => void }) {
  const { refresh, state } = useGame();
  useEffect(() => { refresh(); }, []);
  const every = storyEvery(state?.profile.title ?? '');
  const j = result.journey && result.journey.step ? result.journey : null;
  const next = nextJourney(result.completed_count);
  const rec = result.record;
  return (
    <div className="result">
      <h1>다 풀었어요!</h1>
      <div className="wreath" role="img" aria-label={`별빛 ${result.reward} 받음`}>
        <img className="wreath-frame" src={asset('assets/ui/frame.webp')} alt="" />
        <div className="wreath-coin"><span aria-hidden>✦</span><strong>+{result.reward}</strong><small>별빛·점수</small></div>
      </div>
      <p>{boardName(result.size, result.difficulty)} · {secText(result.elapsed)} · 지금 별빛 {result.balance} · 누적 점수 {result.points}</p>
      {result.no_hint && <p className="badge-line">힌트 없이 끝냈어요</p>}
      {result.hints_used > 0 && <p className="fine">힌트 {result.hints_used}번을 써서 별빛이 {(result.paid_hints ?? result.hints_used) * 10}% 줄었어요{(result.paid_hints ?? result.hints_used) < result.hints_used ? '(첫 힌트는 칭호 스킬로 줄지 않음)' : ''}. 힌트를 쓴 판은 기록에 들어가지 않아요.</p>}
      {result.skill_bonus > 0 && <p className="record-line">칭호「{TITLE_NAME[result.skill_title] ?? ''}」 스킬로 별빛 +{result.skill_bonus}(점수에는 안 들어가요)</p>}
      {result.titles?.length > 0 && <p className="record-line">새 칭호「{result.titles.join('」「')}」를 받았어요. 설정에서 달 수 있어요</p>}
      {rec && <p className="record-line">{rec.first ? `첫 기록 ${secText(rec.sec)}` : `자기 기록 경신! ${secText(rec.prev)} → ${secText(rec.sec)}`}</p>}
      {j && <div className="journey-card"><p>여정 {j.step}번째 보상</p><strong>{j.title}</strong><small>{rewardText(j.reward)}</small></div>}
      {!j && next && <p className="fine">다음 여정「{next.title}」까지 {next.need - result.completed_count}판</p>}
      {result.completed_count % every === 0 && result.completed_count / every + 1 <= 16 && (
        <p className="record-line">이야기책 {result.completed_count / every + 1}장이 열렸어요. 도감에서 읽어 보세요</p>
      )}
      <div className="stack">
        <button className="btn primary big" onClick={onHome}>{j?.reward?.gift ? '선물 고르러 가기' : '처음 화면으로'}</button>
        <button className="btn big" onClick={onAgain}>한 판 더</button>
      </div>
    </div>
  );
}
