// DB 권한·거래 테스트: tests/db/reset.sh 후 npm run test:db
// 실제 Supabase처럼 authenticated 역할 + JWT sub로 함수를 호출한다.
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const DB = process.env.DB ?? 'olympus_test';
const conn = { host: 'localhost', user: 'postgres', password: 'postgres', database: DB };
const admin = new pg.Client(conn);
let pass = 0, fail = 0;
const bank: { id: string; solution: string; givens: string }[] = [...JSON.parse(readFileSync('puzzles/bank.json', 'utf8')), ...JSON.parse(readFileSync('puzzles/bank-diag.json', 'utf8'))];

async function user(email: string) {
  const id = randomUUID();
  await admin.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);
  const c = new pg.Client(conn);
  await c.connect();
  await c.query(`set role authenticated`);
  await c.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: id, role: 'authenticated' })]);
  const rpc = async (fn: string, args: Record<string, unknown> = {}) => {
    const keys = Object.keys(args);
    const sql = `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`;
    const r = await c.query(sql, keys.map((k) => { const v = args[k]; return v !== null && typeof v === 'object' ? JSON.stringify(v) : v; }));
    return r.rows[0].r;
  };
  return { id, c, rpc, sql: (q: string, p: unknown[] = []) => c.query(q, p) };
}

async function check(name: string, f: () => Promise<void>) {
  try { await f(); pass++; console.log('  ✓', name); } catch (e: any) { fail++; console.log('  ✗', name, '-', e.message); }
}
async function expectError(code: string, f: () => Promise<unknown>) {
  try { await f(); } catch (e: any) {
    if (e.message === code || e.message?.includes(code)) return;
    throw new Error(`expected ${code}, got ${e.message}`);
  }
  throw new Error(`expected error ${code}, but succeeded`);
}
const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error(msg); };

async function solveAttempt(u: Awaited<ReturnType<typeof user>>, profile: string, size = 4, diff = 'intro') {
  const a = await u.rpc('start_attempt', { p: profile, board_size: size, difficulty: diff });
  const sol = bank.find((b) => b.id === a.puzzle_id)!.solution;
  return { a, sol };
}

(async () => {
  await admin.connect();
  const A = await user('a@test'); const B = await user('b@test'); const C = await user('Grandma.C@test'); const E = await user('e@test');
  let pa = '', pb = '', pc = '', pe = '', kid = '';
  const setCount = (p: string, n: number) => admin.query('update public.quest_progress set completed_count = $2 where profile_id = $1', [p, n]);
  const finish = async (u: typeof A, p: string, opts: { size?: number; diff?: string; hints?: number; elapsed?: number } = {}) => {
    const { a, sol } = await solveAttempt(u, p, opts.size ?? 4, opts.diff ?? 'intro');
    if (opts.hints) await u.rpc('save_attempt', { attempt: a.id, expected_revision: a.revision, board: a.givens, notes: {}, hints_used: opts.hints, op_id: randomUUID() });
    // 서버가 잰 푼 시간을 흉내: 쌓인 구간 = elapsed, 열린 구간 없음
    await admin.query(`update public.puzzle_attempts set played_sec = $2, active_since = null where id = $1`, [a.id, opts.elapsed ?? 300]);
    return u.rpc('complete_attempt', { attempt: a.id, board: sol, op_id: randomUUID() });
  };

  console.log('프로필·가족');
  await check('익명(로그인 안 함) 호출 거부', async () => {
    const anon = new pg.Client(conn); await anon.connect(); await anon.query('set role anon');
    await expectError('permission denied', () => anon.query(`select public.my_profiles()`));
    await anon.end();
  });
  await check('새 프로필은 초상화 없이(빈칸) 시작', async () => {
    pa = await A.rpc('create_my_profile', { nickname: '아빠', avatar_id: 'zeus', guide_id: 'athena' });
    pb = await B.rpc('create_my_profile', { nickname: '엄마', avatar_id: 'hera', guide_id: 'hestia' });
    pc = await C.rpc('create_my_profile', { nickname: '할머니', avatar_id: '', guide_id: 'hestia' });
    pe = await E.rpc('create_my_profile', { nickname: '모르는 사람', avatar_id: '', guide_id: 'hestia' });
    const s = await A.rpc('get_state', { p: pa });
    assert(s.profile.avatar_id === '' && s.owned.length === 0 && s.balance === 0 && s.gifts.length === 0, JSON.stringify(s).slice(0, 200));
    assert(!('home' in s) && !('inventory' in s), 'no home');
  });
  await check('아이 프로필 생성, 보호자만 접근', async () => {
    kid = await A.rpc('create_child_profile', { guardian: pa, nickname: '딸', avatar_id: 'iris', guide_id: 'hestia' });
    assert((await A.rpc('my_profiles')).length === 2, 'two profiles');
    await expectError('forbidden', () => B.rpc('get_state', { p: kid }));
  });
  await check('가족 초대 코드로 아내 합류 → 아이 프로필 공동 관리, 친구 초대 코드는 없음', async () => {
    const inv = await A.rpc('create_invite', { p: pa, kind: 'family' });
    const r = await B.rpc('accept_invite', { p: pb, code: inv.code.toLowerCase() });
    assert(r.kind === 'family', 'family');
    assert((await B.rpc('get_state', { p: kid })).profile.nickname === '딸', 'kid via family');
    await expectError('bad_kind', () => A.rpc('create_invite', { p: pa, kind: 'friend' }));
    await expectError('forbidden', () => A.rpc('create_invite', { p: kid, kind: 'family' }));
  });

  console.log('스도쿠·보상·여정');
  await check('거짓 완료·기본칸 변경·잘못된 숫자 거부(4/6/9)', async () => {
    for (const [size, diff] of [[4, 'intro'], [6, 'intro'], [9, 'easy']] as const) {
      const { a, sol } = await solveAttempt(A, pa, size, diff);
      await expectError('not_solved', () => A.rpc('complete_attempt', { attempt: a.id, board: a.givens, op_id: randomUUID() }));
      const firstGiven = [...a.givens].findIndex((ch: string) => ch !== '.');
      const changed = sol.slice(0, firstGiven) + (sol[firstGiven] === '1' ? '2' : '1') + sol.slice(firstGiven + 1);
      await expectError('given_changed', () => A.rpc('complete_attempt', { attempt: a.id, board: changed, op_id: randomUUID() }));
      await A.rpc('abandon_attempt', { attempt: a.id });
    }
  });
  await check('같은 완료 요청 10회(동시)에도 보상 1회, 첫 판에 1티어 선물 상자', async () => {
    const { a, sol } = await solveAttempt(A, pa);
    const clients = await Promise.all(Array.from({ length: 10 }, async () => {
      const c = new pg.Client(conn); await c.connect(); await c.query('set role authenticated');
      await c.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: A.id })]); return c;
    }));
    const res = await Promise.all(clients.map((c) => c.query('select public.complete_attempt(attempt => $1, board => $2, op_id => $3) as r', [a.id, sol, randomUUID()]).then((r) => r.rows[0].r)));
    await Promise.all(clients.map((c) => c.end()));
    const s = await A.rpc('get_state', { p: pa });
    assert(s.balance === 10 && s.points.total === 10 && s.points.week === 10, 'balance ' + s.balance);
    assert(res.filter((r) => !r.repeat).length === 1, 'one fresh result');
    assert(s.gifts.length === 1 && s.gifts[0].tier === 1 && s.gifts[0].options.length === 3, 'gift ' + JSON.stringify(s.gifts));
  });
  await check('선물은 셋 중에서 한 번만, 고르면 바로 얼굴이 됨', async () => {
    const g = (await A.rpc('get_state', { p: pa })).gifts[0];
    await expectError('bad_item', () => A.rpc('claim_gift', { p: pa, gift: g.id, portrait: 'zeus' }));
    await A.rpc('claim_gift', { p: pa, gift: g.id, portrait: g.options[1] });
    await expectError('claimed', () => A.rpc('claim_gift', { p: pa, gift: g.id, portrait: g.options[0] }));
    const s = await A.rpc('get_state', { p: pa });
    assert(s.profile.avatar_id === g.options[1] && s.owned.length === 1 && s.gifts.length === 0, 'avatar');
    await expectError('not_found', () => B.rpc('claim_gift', { p: pb, gift: g.id, portrait: g.options[0] }));
  });
  await check('힌트 한 번마다 보상 10% 감소, 10번이 상한', async () => {
    const r = await finish(B, pb, { size: 9, diff: 'easy', hints: 3 });
    assert(r.reward === 21 && r.hints_used === 3 && r.no_hint === false && r.record === null, JSON.stringify(r));
    const r2 = await finish(B, pb, { size: 9, diff: 'easy', hints: 15 });
    assert(r2.reward === 0 && r2.hints_used === 10, JSON.stringify(r2));
  });
  await check('여정: 3판 별빛 30, 5판 2티어 열림, 8판 칭호(자동 장착)', async () => {
    await setCount(pa, 2);
    const r3 = await finish(A, pa);
    assert(r3.journey?.step === 2 && r3.balance === 10 + 10 + 30, 'bonus ' + JSON.stringify(r3));
    await setCount(pa, 4);
    const r5 = await finish(A, pa);
    assert(r5.journey?.reward?.tier === 2, 'tier');
    await setCount(pa, 7);
    await finish(A, pa);
    const s = await A.rpc('get_state', { p: pa });
    assert(s.unlocks.includes('tier:2') && s.unlocks.includes('title:apprentice') && s.profile.title === 'apprentice', JSON.stringify(s.unlocks));
  });
  await check('다른 사람 퍼즐 저장·완료 불가, 저장 충돌 거부', async () => {
    const { a, sol } = await solveAttempt(A, pa);
    await expectError('forbidden', () => E.rpc('save_attempt', { attempt: a.id, expected_revision: 0, board: a.givens, notes: {}, hints_used: 0, op_id: randomUUID() }));
    await expectError('forbidden', () => E.rpc('complete_attempt', { attempt: a.id, board: sol, op_id: randomUUID() }));
    await A.rpc('save_attempt', { attempt: a.id, expected_revision: 0, board: a.givens, notes: {}, hints_used: 0, op_id: randomUUID() });
    await expectError('conflict', () => A.rpc('save_attempt', { attempt: a.id, expected_revision: 0, board: a.givens, notes: {}, hints_used: 0, op_id: randomUUID() }));
    await A.rpc('abandon_attempt', { attempt: a.id });
  });

  console.log('초상화 상점');
  await check('잠긴 티어·부족한 별빛·이미 가진 초상화 거부', async () => {
    await admin.query('update public.wallets set balance = 10 where profile_id = $1', [pa]);
    await expectError('locked', () => A.rpc('purchase_portrait', { p: pa, portrait: 'zeus', op_id: randomUUID() }));
    await expectError('not_enough', () => A.rpc('purchase_portrait', { p: pa, portrait: 'heracles', op_id: randomUUID() }));
    const owned = (await A.rpc('get_state', { p: pa })).owned[0];
    await expectError('owned', () => A.rpc('purchase_portrait', { p: pa, portrait: owned, op_id: randomUUID() }));
    await expectError('bad_item', () => A.rpc('purchase_portrait', { p: pa, portrait: 'no_such_one', op_id: randomUUID() }));
  });
  await check('구매 이중 탭(같은 op_id 동시 2회)에도 거래 1회, 산 초상화만 얼굴로', async () => {
    await admin.query('update public.wallets set balance = 100 where profile_id = $1', [pa]);
    const before = (await A.rpc('get_state', { p: pa })).balance;
    const { rows } = await admin.query(`select id from public.portrait_catalog where tier = 1 and id not in (select portrait_id from public.owned_portraits where profile_id = $1) limit 2`, [pa]);
    const op = randomUUID();
    const c2 = new pg.Client(conn); await c2.connect(); await c2.query('set role authenticated');
    await c2.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: A.id })]);
    await Promise.allSettled([
      A.rpc('purchase_portrait', { p: pa, portrait: rows[0].id, op_id: op }),
      c2.query('select public.purchase_portrait(p => $1, portrait => $2, op_id => $3) as r', [pa, rows[0].id, op]),
    ]);
    await c2.end();
    const s = await A.rpc('get_state', { p: pa });
    assert(s.balance === before - 20 && s.owned.includes(rows[0].id), 'balance ' + s.balance);
    await expectError('not_owned', () => A.rpc('update_profile', { p: pa, patch: { avatar_id: rows[1].id } }));
    await A.rpc('update_profile', { p: pa, patch: { avatar_id: rows[0].id } });
    await expectError('locked', () => A.rpc('update_profile', { p: pa, patch: { title: 'sage' } }));
  });
  await check('보물: 티어 없이 별빛 10, 사면 바로 프로필 보물로, 얼굴로는 못 씀', async () => {
    await admin.query('update public.wallets set balance = 25 where profile_id = $1', [pe]);
    const r = await E.rpc('purchase_portrait', { p: pe, portrait: 'lyre', op_id: randomUUID() });
    assert(r.price === 10 && r.balance === 15 && r.badge === 'lyre', JSON.stringify(r));
    let st = await E.rpc('get_state', { p: pe });
    assert(st.profile.badge === 'lyre' && st.owned.includes('lyre'), 'badge');
    await expectError('not_owned', () => E.rpc('update_profile', { p: pe, patch: { avatar_id: 'lyre' } }));
    await expectError('not_owned', () => E.rpc('update_profile', { p: pe, patch: { badge: 'golden_fleece' } }));
    await E.rpc('purchase_portrait', { p: pe, portrait: 'golden_fleece', op_id: randomUUID() });
    await E.rpc('update_profile', { p: pe, patch: { badge: 'lyre' } });
    st = await E.rpc('get_state', { p: pe });
    assert(st.profile.badge === 'lyre' && st.balance === 5, 'switch');
    await E.rpc('update_profile', { p: pe, patch: { badge: '' } });
    assert((await E.rpc('get_state', { p: pe })).profile.badge === '', 'removed');
    await E.rpc('update_profile', { p: pe, patch: { badge: 'lyre' } });
  });
  await check('잔액·초상화·점수를 직접 고칠 수 없음, 남의 것은 안 보임', async () => {
    await expectError('permission denied', () => A.sql('update public.wallets set balance = 9999'));
    await expectError('permission denied', () => A.sql(`insert into public.owned_portraits values ($1, 'zeus', 'hack')`, [pa]));
    await expectError('permission denied', () => A.sql(`insert into public.score_events (profile_id, attempt_id, size, difficulty, points) values ($1, gen_random_uuid(), 4, 'intro', 999)`, [pa]));
    await expectError('permission denied', () => A.sql('select * from private.puzzle_solutions'));
    const r = await E.sql('select * from public.wallets');
    assert(r.rows.every((w: any) => w.profile_id !== pa), 'E sees A wallet');
  });

  console.log('점수·순위·기록');
  await check('기록: 힌트 없이 끝낸 판만, 더 빠를 때만 소식', async () => {
    const r1 = await finish(E, pe, { elapsed: 300 });
    assert(r1.record?.first === true && r1.record.sec === 300, 'first ' + JSON.stringify(r1.record));
    const r2 = await finish(E, pe, { elapsed: 400 });
    assert(r2.record === null, 'slower');
    const r3 = await finish(E, pe, { elapsed: 120 });
    assert(r3.record?.prev === 300 && r3.record.sec === 120, 'better');
    const r4 = await finish(E, pe, { elapsed: 60, hints: 1 });
    assert(r4.record === null, 'hint no record');
    const s = await E.rpc('get_state', { p: pe });
    assert(s.records['4:intro'] === 120, 'records ' + JSON.stringify(s.records));
    const acts = await admin.query(`select kind from public.activities where profile_id = $1`, [pe]);
    assert(acts.rows.filter((x: any) => x.kind === 'record').length === 1, 'one record news');
  });
  await check('걸린 시간은 서버 시계: 연 구간만 더하고, 기기가 보낸 시간은 무시', async () => {
    const { a, sol } = await solveAttempt(B, pb);
    await B.rpc('open_attempt', { attempt: a.id });
    await admin.query(`update public.puzzle_attempts set active_since = now() - interval '90 seconds' where id = $1`, [a.id]);
    const p1 = await B.rpc('pause_attempt', { attempt: a.id });
    assert(p1.played_sec >= 89 && p1.played_sec <= 92, 'pause ' + p1.played_sec);
    // 나가 있던 시간은 안 셈: 다시 열고 40초 풀었다가, 앱을 그냥 닫음(마지막 저장은 열고 30초 뒤)
    await B.rpc('open_attempt', { attempt: a.id });
    await admin.query(`update public.puzzle_attempts set active_since = now() - interval '2 hours', updated_at = now() - interval '2 hours' + interval '30 seconds' where id = $1`, [a.id]);
    const o = await B.rpc('open_attempt', { attempt: a.id });
    assert(o.played_sec >= 119 && o.played_sec <= 122, 'stale segment counts to last save ' + o.played_sec);
    await admin.query(`update public.puzzle_attempts set active_since = now() - interval '10 seconds' where id = $1`, [a.id]);
    const r = await B.rpc('complete_attempt', { attempt: a.id, board: sol, op_id: randomUUID(), elapsed_sec: 3 });
    assert(r.elapsed >= 129 && r.elapsed <= 133, 'server time, not client ' + r.elapsed);
  });
  await check('판 수 10판·누적 점수 100 소식', async () => {
    await setCount(pe, 9);
    await admin.query(`update public.score_events set points = points + 60 where id = (select max(id) from public.score_events where profile_id = $1)`, [pe]);
    await finish(E, pe);
    const acts = await admin.query(`select kind, payload from public.activities where profile_id = $1 order by id`, [pe]);
    assert(acts.rows.some((x: any) => x.kind === 'clears' && x.payload.count === 10), 'clears');
    assert(acts.rows.some((x: any) => x.kind === 'points' && x.payload.points === 100), 'points ' + JSON.stringify(acts.rows));
  });
  await check('순위: 통합·난이도별·오늘/이번 주/이번 달, 상위 목록과 내 순위, 누적은 없음', async () => {
    const all = await B.rpc('get_leaderboard', { p: pb, board: 'all', period: 'month' });
    assert(all.rows[0].id === pe && all.rows.some((r: any) => r.id === pa) && all.me?.points === 31, 'all ' + JSON.stringify(all.me));
    assert(!JSON.stringify(all).includes('@'), 'no email');
    assert(all.rows[0].badge === 'lyre', 'badge in leaderboard');
    const today = await B.rpc('get_leaderboard', { p: pb, board: 'all', period: 'day' });
    assert(today.me?.points === 31, 'day');
    const nine = await A.rpc('get_leaderboard', { p: pa, board: '9e', period: 'month' });
    assert(nine.rows.length === 1 && nine.rows[0].id === pb && nine.me === null, 'nine ' + JSON.stringify(nine));
    await admin.query(`update public.score_events set created_at = now() - interval '30 days' where profile_id = $1`, [pb]);
    const week = await B.rpc('get_leaderboard', { p: pb, board: 'all', period: 'week' });
    assert(week.me === null && week.rows.every((r: any) => r.id !== pb), 'week');
    assert((await B.rpc('get_leaderboard', { p: pb, board: 'all', period: 'month' })).me === null, 'month');
    await expectError('bad_board', () => A.rpc('get_leaderboard', { p: pa, board: '8', period: 'week' }));
    await expectError('bad_period', () => A.rpc('get_leaderboard', { p: pa, board: 'all', period: 'all' }));
  });
  await check('빨리 푼 순위: 난이도별, 힌트 없이 끝낸 판의 가장 빠른 시간', async () => {
    await finish(E, pe, { size: 6, elapsed: 400 });
    await finish(E, pe, { size: 6, elapsed: 150 });
    await finish(A, pa, { size: 6, elapsed: 200 });
    await finish(C, pc, { size: 6, elapsed: 90, hints: 1 });
    const r = await A.rpc('get_leaderboard', { p: pa, board: '6', period: 'week', kind: 'speed' });
    assert(r.rows.length === 2 && r.rows[0].id === pe && r.rows[0].sec === 150 && r.rows[0].games === 2 && r.me.rank === 2 && r.me.sec === 200, JSON.stringify(r));
    await expectError('bad_board', () => A.rpc('get_leaderboard', { p: pa, board: 'all', period: 'week', kind: 'speed' }));
  });
  await check('같은 난이도로 새로 시작하면 새 판, 이어서 풀던 판은 그만둔 판', async () => {
    const a1 = await A.rpc('start_attempt', { p: pa, board_size: 9, difficulty: 'hard' });
    const a2 = await A.rpc('start_attempt', { p: pa, board_size: 9, difficulty: 'hard' });
    assert(a1.id !== a2.id, 'new attempt');
    assert((await A.rpc('get_attempt', { attempt: a1.id })).status === 'abandoned', 'old abandoned');
    const act = (await A.rpc('get_state', { p: pa })).active.filter((x: any) => x.size === 9 && x.difficulty === 'hard');
    assert(act.length === 1 && act[0].id === a2.id, 'one active');
    await A.rpc('abandon_attempt', { attempt: a2.id });
  });

  console.log('친구·소식·이모티콘');
  await check('이메일로 친구 요청: 없는 주소·같은 가족 거부, 대소문자 무관', async () => {
    await expectError('no_user', () => A.rpc('send_friend_request', { p: pa, email: 'nobody@test' }));
    await expectError('same_family', () => A.rpc('send_friend_request', { p: pa, email: 'b@test' }));
    const r = await A.rpc('send_friend_request', { p: kid, email: ' grandma.c@TEST ' });
    assert(r.status === 'pending', 'pending');
    assert((await A.rpc('send_friend_request', { p: pa, email: 'grandma.c@test' })).repeat === true, 'once');
  });
  await check('받은 쪽 수락 → 두 가족 모두 친구, 보낸 쪽 우편함에 알림', async () => {
    const f = await C.rpc('list_friends', { p: pc });
    assert(f.incoming.length === 1 && f.incoming[0].nickname === '딸', 'incoming');
    const mail = await C.rpc('list_mail', { p: pc });
    assert(mail[0].kind === 'friend_request' && mail[0].request_status === 'pending', 'mail');
    await expectError('not_found', () => E.rpc('respond_friend_request', { p: pe, request: f.incoming[0].id, accept: true }));
    await C.rpc('respond_friend_request', { p: pc, request: f.incoming[0].id, accept: true });
    const fa = await B.rpc('list_friends', { p: pb });
    assert(fa.friends.length === 1 && fa.friends[0].members[0].nickname === '할머니', 'B sees grandma');
    assert((await A.rpc('list_mail', { p: kid })).some((m: any) => m.kind === 'friend_accepted'), 'accepted mail');
    await expectError('already', () => C.rpc('send_friend_request', { p: pc, email: 'a@test' }));
  });
  await check('서로 요청하면 바로 친구, 보낸 요청 취소', async () => {
    await E.rpc('send_friend_request', { p: pe, email: 'grandma.c@test' });
    const r = await C.rpc('send_friend_request', { p: pc, email: 'e@test' });
    assert(r.status === 'accepted', 'mutual ' + JSON.stringify(r));
    await C.rpc('remove_friend', { p: pc, other: pe });
    await E.rpc('send_friend_request', { p: pe, email: 'grandma.c@test' });
    const out = (await E.rpc('list_friends', { p: pe })).outgoing;
    await E.rpc('cancel_friend_request', { p: pe, request: out[0].id });
    assert((await C.rpc('list_friends', { p: pc })).incoming.length === 0, 'cancelled');
  });
  await check('친구 소식: 친구·가족 것만 보임', async () => {
    const feedC = await C.rpc('list_feed', { p: pc });
    assert(feedC.some((x: any) => x.who.id === pa && x.kind === 'tier') && feedC.every((x: any) => x.who.id !== pe), 'C feed');
    assert(feedC.every((x: any) => 'badge' in x.who), 'badge in feed');
    const feedE = await E.rpc('list_feed', { p: pe });
    assert(feedE.every((x: any) => x.who.id === pe), 'E sees only own');
  });
  await check('이모티콘: 하나만, 바꾸기·지우기, 받은 사람이 누가 보냈는지 앎', async () => {
    const item = (await C.rpc('list_feed', { p: pc })).find((x: any) => x.who.id === pa && x.kind === 'title');
    await C.rpc('set_reaction', { p: pc, activity: item.id, emoji: '👍' });
    await C.rpc('set_reaction', { p: pc, activity: item.id, emoji: '❤️' });
    await B.rpc('set_reaction', { p: pb, activity: item.id, emoji: '🎉' });
    let mine = (await A.rpc('list_feed', { p: pa })).find((x: any) => x.id === item.id);
    assert(mine.reactions.length === 2 && mine.reactions.some((r: any) => r.nickname === '할머니' && r.emoji === '❤️'), JSON.stringify(mine.reactions));
    assert((await A.rpc('list_mail', { p: pa })).some((m: any) => m.kind === 'reaction' && m.payload.nickname === '할머니'), 'reaction mail');
    await C.rpc('set_reaction', { p: pc, activity: item.id, emoji: '❤️' }); // 같은 것 → 지움
    mine = (await A.rpc('list_feed', { p: pa })).find((x: any) => x.id === item.id);
    assert(mine.reactions.length === 1 && mine.reactions[0].nickname === '엄마', 'removed');
    await expectError('bad_emoji', () => C.rpc('set_reaction', { p: pc, activity: item.id, emoji: '💩' }));
    await expectError('own', () => A.rpc('set_reaction', { p: pa, activity: item.id, emoji: '👍' }));
    await expectError('not_found', () => E.rpc('set_reaction', { p: pe, activity: item.id, emoji: '👍' }));
  });
  await check('친구 끊으면 다음 요청부터 소식·이모티콘 차단', async () => {
    const item = (await C.rpc('list_feed', { p: pc })).find((x: any) => x.who.id === pa);
    await C.rpc('remove_friend', { p: pc, other: kid });
    assert((await C.rpc('list_feed', { p: pc })).every((x: any) => x.who.id === pc), 'feed gone');
    await expectError('not_found', () => C.rpc('set_reaction', { p: pc, activity: item.id, emoji: '👍' }));
  });
  await check('초대 코드 대입 시도 제한', async () => {
    for (let i = 0; i < 10; i++) assert((await C.rpc('accept_invite', { p: pc, code: 'AAAAA-AAAAA' })).error === 'bad_code', 'bad');
    await expectError('rate_limited', () => C.rpc('accept_invite', { p: pc, code: 'AAAAA-AAAAA' }));
  });

  console.log('칭호·스킬');
  const unlockTitle = async (p: string, t: string) => { await admin.query(`insert into public.unlocks (profile_id, key) values ($1, $2) on conflict do nothing`, [p, 'title:' + t]); await admin.query(`update public.profiles set title = $2 where id = $1`, [p, t]); };
  const giveItems = async (p: string, tier: number, n: number) => admin.query(`insert into public.owned_portraits (profile_id, portrait_id, source)
    select $1, id, 'test' from public.portrait_catalog c where tier = $2 and not exists (select 1 from public.owned_portraits o where o.profile_id = $1 and o.portrait_id = c.id) order by id limit $3`, [p, tier, n]);
  await check('보물 5개째를 사면 「보물 사냥꾼」을 받고 소식이 뜸, 달면 보물 값 9', async () => {
    await admin.query(`update public.wallets set balance = 500 where profile_id = $1`, [pe]);
    const have = (await admin.query(`select count(*)::int n from public.owned_portraits o join public.portrait_catalog c on c.id = o.portrait_id where profile_id = $1 and tier = 0`, [pe])).rows[0].n;
    await giveItems(pe, 0, 4 - have);
    const next = (await admin.query(`select id from public.portrait_catalog c where tier = 0 and not exists (select 1 from public.owned_portraits o where o.profile_id = $1 and o.portrait_id = c.id) order by id limit 2`, [pe])).rows;
    const r = await E.rpc('purchase_portrait', { p: pe, portrait: next[0].id, op_id: randomUUID() });
    assert(r.price === 10 && r.titles.includes('보물 사냥꾼'), JSON.stringify(r));
    assert((await admin.query(`select 1 from public.activities where profile_id = $1 and kind = 'title' and payload->>'title' = 'tr5'`, [pe])).rowCount === 1, 'activity');
    await E.rpc('update_profile', { p: pe, patch: { title: 'tr5' } });
    const r2 = await E.rpc('purchase_portrait', { p: pe, portrait: next[1].id, op_id: randomUUID() });
    assert(r2.price === 9, 'price ' + r2.price);
  });
  await check('초상화 10장 「초상화 수집가」: 달면 2% 덜(60 → 59)', async () => {
    await admin.query(`insert into public.unlocks (profile_id, key) values ($1, 'tier:2') on conflict do nothing`, [pe]);
    await giveItems(pe, 1, 10);
    const t = await admin.query(`select private.check_titles($1) as r`, [pe]);
    assert(JSON.stringify(t.rows[0].r).includes('초상화 수집가'), JSON.stringify(t.rows[0].r));
    await E.rpc('update_profile', { p: pe, patch: { title: 'col10' } });
    const id = (await admin.query(`select id from public.portrait_catalog c where tier = 2 and not exists (select 1 from public.owned_portraits o where o.profile_id = $1 and o.portrait_id = c.id) limit 1`, [pe])).rows[0].id;
    const r = await E.rpc('purchase_portrait', { p: pe, portrait: id, op_id: randomUUID() });
    assert(r.price === 59, 'price ' + r.price);
  });
  await check('하루 첫 판 스킬 별빛(수습생 +2)은 지갑에만, 점수엔 안 들어감', async () => {
    await unlockTitle(pe, 'apprentice');
    await admin.query(`update public.puzzle_attempts set completed_at = now() - interval '2 days' where profile_id = $1 and status = 'completed'`, [pe]);
    const bal0 = (await E.rpc('get_state', { p: pe })).balance;
    const r = await finish(E, pe);
    assert(r.skill_bonus === 2 && r.reward === 10 && r.balance === bal0 + 12, JSON.stringify(r));
    const ev = await admin.query(`select points from public.score_events where attempt_id = (select id from public.puzzle_attempts where profile_id = $1 order by completed_at desc nulls last limit 1)`, [pe]);
    assert(ev.rows[0].points === 10, 'score ' + ev.rows[0].points);
    const r2 = await finish(E, pe);
    assert(r2.skill_bonus === 0, 'second game ' + r2.skill_bonus);
  });
  await check('미궁 탐험가는 힌트 11번, 현자는 첫 힌트 무료지만 기록에는 안 들어감', async () => {
    await unlockTitle(pe, 'explorer');
    const { a } = await solveAttempt(E, pe, 4, 'intro');
    const s = await E.rpc('save_attempt', { attempt: a.id, expected_revision: a.revision, board: a.givens, notes: {}, hints_used: 15, op_id: randomUUID() });
    assert((await admin.query(`select hints_used from public.puzzle_attempts where id = $1`, [a.id])).rows[0].hints_used === 11, 'cap 11 ' + JSON.stringify(s));
    await E.rpc('abandon_attempt', { attempt: a.id });
    await unlockTitle(pe, 'sage');
    const r = await finish(E, pe, { hints: 1, elapsed: 5 });
    assert(r.reward === 10 && r.record === null && r.no_hint === false, JSON.stringify(r));
  });
  await check('이야기책: 열린 장만 읽음 기록, 4장 읽으면 「이야기꾼」, 달면 4판마다 열림', async () => {
    await setCount(pc, 12);
    await expectError('locked', () => C.rpc('mark_story_read', { p: pc, chapter: 4 }));
    for (const ch of [1, 2, 3]) await C.rpc('mark_story_read', { p: pc, chapter: ch });
    await setCount(pc, 15);
    const r = await C.rpc('mark_story_read', { p: pc, chapter: 4 });
    assert(r.reads === 4 && r.titles.includes('이야기꾼'), JSON.stringify(r));
    await C.rpc('update_profile', { p: pc, patch: { title: 'read4' } });
    await setCount(pc, 16);
    await C.rpc('mark_story_read', { p: pc, chapter: 5 });
    assert((await C.rpc('get_state', { p: pc })).reads.length === 5, 'reads');
  });
  await check('음유시인은 선물 상자 넷, 무사이의 친구는 하루 한 번 다시 뽑기', async () => {
    await unlockTitle(pc, 'read8');
    const gid = (await admin.query(`select private.make_gift($1, 1) as g`, [pc])).rows[0].g;
    const g = (await C.rpc('get_state', { p: pc })).gifts.find((x: any) => x.id === gid);
    assert(g.options.length === 4, 'four');
    await expectError('no_skill', () => C.rpc('reroll_gift', { p: pc, gift: gid }));
    await unlockTitle(pc, 'read16');
    const r = await C.rpc('reroll_gift', { p: pc, gift: gid });
    assert(r.options.length === 4 && r.options.every((o: string) => !g.options.includes(o)), JSON.stringify(r));
    await expectError('used', () => C.rpc('reroll_gift', { p: pc, gift: gid }));
  });
  await check('다정한 이웃만 이모티콘 4종 더', async () => {
    const item = (await B.rpc('list_feed', { p: pb })).find((x: any) => x.who.id !== pb);
    if (!item) throw new Error('no feed item');
    await expectError('bad_emoji', () => B.rpc('set_reaction', { p: pb, activity: item.id, emoji: '🦉' }));
    await unlockTitle(pb, 'kind30');
    assert((await B.rpc('set_reaction', { p: pb, activity: item.id, emoji: '🦉' })).emoji === '🦉', 'owl');
  });
  await check('칭호 진행도: 7일 내리 판을 끝낸 수, 다섯 난이도', async () => {
    const ids = (await admin.query(`select id from public.puzzle_attempts where profile_id = $1 and status = 'completed' order by completed_at desc limit 7`, [pe])).rows.map((x: any) => x.id);
    for (let i = 0; i < 7; i++) await admin.query(`update public.puzzle_attempts set completed_at = now() - make_interval(days => $2) where id = $1`, [ids[i], i]);
    const st = (await E.rpc('get_state', { p: pe })).stats;
    assert(st.streak === 7, 'streak ' + st.streak);
    assert(st.boards >= 1 && st.treasures >= 6 && st.portraits >= 11, JSON.stringify(st));
  });
  await check('소급: 조건을 이미 채운 사람에게 소식 없이 칭호(빈 칭호면 바로 닮)', async () => {
    await admin.query(`delete from public.unlocks where profile_id = $1 and key like 'title:%'`, [pe]);
    await admin.query(`update public.profiles set title = '' where id = $1`, [pe]);
    const before = (await admin.query(`select count(*)::int n from public.activities where profile_id = $1`, [pe])).rows[0].n;
    await admin.query(`select private.check_titles($1, true)`, [pe]);
    const s = await E.rpc('get_state', { p: pe });
    assert(['title:tr5', 'title:col10', 'title:streak7'].every((k) => s.unlocks.includes(k)), JSON.stringify(s.unlocks));
    assert(s.profile.title !== '', 'auto equip');
    assert((await admin.query(`select count(*)::int n from public.activities where profile_id = $1`, [pe])).rows[0].n === before, 'quiet');
  });

  console.log('시간 재기 버그(1초)');
  await check('시간 재기 구간이 없던 판은 1초가 아니라 시작부터 끝까지, 기록·빠른 순위에서 빠짐', async () => {
    const { a, sol } = await solveAttempt(E, pe, 9, 'hard');
    await admin.query(`update public.puzzle_attempts set played_sec = 0, active_since = null, started_at = now() - interval '9 minutes' where id = $1`, [a.id]);
    const r = await E.rpc('complete_attempt', { attempt: a.id, board: sol, op_id: randomUUID() });
    assert(r.record === null && r.elapsed >= 539 && r.elapsed <= 545, JSON.stringify(r));
    assert((await admin.query(`select time_ok from public.puzzle_attempts where id = $1`, [a.id])).rows[0].time_ok === false, 'time_ok');
    const lb = await E.rpc('get_leaderboard', { p: pe, board: '9h', period: 'week', kind: 'speed' });
    assert(lb.me === null, 'not in speed ranking ' + JSON.stringify(lb.me));
  });

  console.log('신화 난이도');
  await check('신화(대각선)는 「은하수의 방랑자」를 단 사람만 시작, 보상 60, 칭호 스킬 별빛은 없음, 다섯 난이도 수에 안 들어감', async () => {
    await admin.query(`update public.profiles set title = '' where id = $1`, [pc]);
    await expectError('locked', () => C.rpc('start_attempt', { p: pc, board_size: 9, difficulty: 'diag' }));
    await unlockTitle(pc, 'five');
    const r = await finish(C, pc, { size: 9, diff: 'diag', elapsed: 900 });
    assert(r.reward === 60 && r.skill_bonus === 0 && r.difficulty === 'diag', JSON.stringify(r));
    const st = (await C.rpc('get_state', { p: pc })).stats;
    const real = (await admin.query(`select count(*)::int n from (select distinct size, difficulty from public.score_events where profile_id = $1 and difficulty <> 'diag') b`, [pc])).rows[0].n;
    assert(st.boards === real, 'boards ' + st.boards + ' vs ' + real);
    const lb = await C.rpc('get_leaderboard', { p: pc, board: '9d', period: 'week', kind: 'speed' });
    assert(lb.me?.sec === 900, JSON.stringify(lb.me));
    assert((await admin.query(`select name_ko from public.title_catalog where id = 'five'`)).rows[0].name_ko === '은하수의 방랑자', 'name');
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  for (const u of [A, B, C, E]) await u.c.end();
  await admin.end();
  process.exit(fail ? 1 : 0);
})();
