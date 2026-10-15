// DB 권한·거래 테스트: tests/db/reset.sh 후 npm run test:db
// 실제 Supabase처럼 authenticated 역할 + JWT sub로 함수를 호출한다.
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const DB = process.env.DB ?? 'olympus_test';
const conn = { host: 'localhost', user: 'postgres', password: 'postgres', database: DB };
const admin = new pg.Client(conn);
let pass = 0, fail = 0;
const bank: { id: string; solution: string; givens: string }[] = JSON.parse(readFileSync('puzzles/bank.json', 'utf8'));

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
  const A = await user('a@test'); const B = await user('b@test'); const C = await user('c@test');
  let pa = '', pb = '', pc = '', kid = '';

  console.log('프로필·가족');
  await check('익명(로그인 안 함) 호출 거부', async () => {
    const anon = new pg.Client(conn); await anon.connect(); await anon.query('set role anon');
    await expectError('permission denied', () => anon.query(`select public.my_profiles()`));
    await anon.end();
  });
  await check('프로필 생성·기본 집 지급', async () => {
    pa = await A.rpc('create_my_profile', { nickname: '아빠', avatar_id: 'zeus', guide_id: 'athena' });
    pb = await B.rpc('create_my_profile', { nickname: '엄마', avatar_id: 'hera', guide_id: 'hestia' });
    pc = await C.rpc('create_my_profile', { nickname: '이웃', avatar_id: 'pan', guide_id: 'hestia' });
    const s = await A.rpc('get_state', { p: pa });
    assert(s.balance === 0 && s.inventory.tea_table === 1 && s.home.room_layout.length === 7, JSON.stringify(s).slice(0, 200));
  });
  await check('기본 배치가 서버 검증을 통과', async () => {
    const s = await A.rpc('get_state', { p: pa });
    const r = await A.rpc('save_home', { p: pa, expected_revision: 0, home: { room_layout: s.home.room_layout, garden_layout: s.home.garden_layout }, op_id: randomUUID() });
    assert(r.revision === 1, 'rev');
  });
  await check('아이 프로필 생성, 보호자만 접근', async () => {
    kid = await A.rpc('create_child_profile', { guardian: pa, nickname: '딸', avatar_id: 'iris', guide_id: 'hestia' });
    const mine = await A.rpc('my_profiles');
    assert(mine.length === 2, 'two profiles');
    await expectError('forbidden', () => B.rpc('get_state', { p: kid }));
  });
  await check('가족 초대 코드로 아내 합류 → 아이 프로필 공동 관리', async () => {
    const inv = await A.rpc('create_invite', { p: pa, kind: 'family' });
    assert(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(inv.code), inv.code);
    const r = await B.rpc('accept_invite', { p: pb, code: inv.code.toLowerCase() });
    assert(r.kind === 'family', 'family');
    assert((await C.rpc('accept_invite', { p: pc, code: inv.code })).error === 'bad_code', 'single use'); // 1회용
    const st = await B.rpc('get_state', { p: kid });
    assert(st.profile.nickname === '딸', 'kid via family');
  });
  await check('아이는 초대를 만들 수 없음', async () => {
    await expectError('forbidden', () => A.rpc('create_invite', { p: kid, kind: 'friend' }));
  });

  console.log('스도쿠·보상');
  await check('거짓 완료·기본칸 변경·잘못된 숫자 거부(4/6/9)', async () => {
    for (const [size, diff] of [[4, 'intro'], [6, 'intro'], [9, 'easy']] as const) {
      const { a, sol } = await solveAttempt(A, pa, size, diff);
      await expectError('not_solved', () => A.rpc('complete_attempt', { attempt: a.id, board: a.givens, op_id: randomUUID() }));
      const firstGiven = [...a.givens].findIndex((ch: string) => ch !== '.');
      const changed = sol.slice(0, firstGiven) + (sol[firstGiven] === '1' ? '2' : '1') + sol.slice(firstGiven + 1);
      await expectError('given_changed', () => A.rpc('complete_attempt', { attempt: a.id, board: changed, op_id: randomUUID() }));
      const firstEmpty = [...a.givens].findIndex((ch: string) => ch === '.');
      const wrong = sol.slice(0, firstEmpty) + (sol[firstEmpty] === '1' ? '2' : '1') + sol.slice(firstEmpty + 1);
      await expectError('not_solved', () => A.rpc('complete_attempt', { attempt: a.id, board: wrong, op_id: randomUUID() }));
      await A.rpc('abandon_attempt', { attempt: a.id });
    }
  });
  await check('같은 완료 요청 10회(동시)에도 보상 1회', async () => {
    const { a, sol } = await solveAttempt(A, pa);
    const clients = await Promise.all(Array.from({ length: 10 }, async () => {
      const c = new pg.Client(conn); await c.connect(); await c.query('set role authenticated');
      await c.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: A.id })]); return c;
    }));
    const res = await Promise.all(clients.map((c) => c.query('select public.complete_attempt(attempt => $1, board => $2, op_id => $3) as r', [a.id, sol, randomUUID()]).then((r) => r.rows[0].r)));
    await Promise.all(clients.map((c) => c.end()));
    const s = await A.rpc('get_state', { p: pa });
    assert(s.balance === 10, 'balance ' + s.balance);
    assert(res.filter((r) => !r.repeat).length === 1, 'one fresh result');
    assert(s.quest.completed_count === 1 && s.quest.choice_pending === true, 'journey 1 + choice');
  });
  await check('첫 선물은 한 번만', async () => {
    await A.rpc('claim_choice', { p: pa, item: 'star_lantern' });
    await expectError('no_choice', () => A.rpc('claim_choice', { p: pa, item: 'olive_planter' }));
  });
  await check('다른 사람 퍼즐 저장·완료 불가', async () => {
    const { a, sol } = await solveAttempt(A, pa);
    await expectError('forbidden', () => B.rpc('save_attempt', { attempt: a.id, expected_revision: 0, board: a.givens, notes: {}, hints_used: 0, op_id: randomUUID() }));
    await expectError('forbidden', () => C.rpc('complete_attempt', { attempt: a.id, board: sol, op_id: randomUUID() }));
    await A.rpc('abandon_attempt', { attempt: a.id });
  });
  await check('저장 버전 충돌은 거부(조용한 덮어쓰기 없음)', async () => {
    const { a } = await solveAttempt(A, pa);
    await A.rpc('save_attempt', { attempt: a.id, expected_revision: 0, board: a.givens, notes: {}, hints_used: 0, op_id: randomUUID() });
    await expectError('conflict', () => A.rpc('save_attempt', { attempt: a.id, expected_revision: 0, board: a.givens, notes: {}, hints_used: 0, op_id: randomUUID() }));
    await A.rpc('abandon_attempt', { attempt: a.id });
  });

  console.log('상점·배치');
  await check('잔액 부족·잠긴 물건 구매 거부', async () => {
    await expectError('locked', () => A.rpc('purchase_item', { p: pa, item: 'shell_fountain', op_id: randomUUID() }));
    await expectError('not_enough', () => A.rpc('purchase_item', { p: pa, item: 'laurel_bench', op_id: randomUUID() }));
  });
  await check('구매 이중 탭(같은 op_id 동시 2회)에도 거래 1회', async () => {
    const { a, sol } = await solveAttempt(A, pa); await A.rpc('complete_attempt', { attempt: a.id, board: sol, op_id: randomUUID() });
    const op = randomUUID();
    const c2 = new pg.Client(conn); await c2.connect(); await c2.query('set role authenticated');
    await c2.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: A.id })]);
    const results = await Promise.allSettled([
      A.rpc('purchase_item', { p: pa, item: 'round_stool', op_id: op }),
      c2.query('select public.purchase_item(p => $1, item => $2, op_id => $3) as r', [pa, 'round_stool', op]).then((r) => r.rows[0].r),
    ]);
    await c2.end();
    const s = await A.rpc('get_state', { p: pa });
    assert(s.inventory.round_stool === 2, 'stool ' + s.inventory.round_stool + ' ' + JSON.stringify(results.map((r) => r.status)));
    assert(s.balance === 0, 'balance ' + s.balance);
  });
  await check('배치 검증: 미보유·초과·겹침·범위 밖·받침 없는 보물 거부', async () => {
    const s = await A.rpc('get_state', { p: pa });
    const base = { room_layout: s.home.room_layout, garden_layout: s.home.garden_layout };
    const rev = s.home.revision;
    const tryHome = (room: unknown[]) => A.rpc('save_home', { p: pa, expected_revision: rev, home: { ...base, room_layout: room }, op_id: randomUUID() });
    await expectError('not_owned', () => tryHome([...base.room_layout, { uid: 'x1', item: 'cloud_cushion', x: 0, y: 8 }]));
    await expectError('overlap', () => tryHome([...base.room_layout, { uid: 'x2', item: 'round_stool', x: 5, y: 5 }]));
    await expectError('out_of_bounds', () => tryHome([...base.room_layout, { uid: 'x3', item: 'round_stool', x: 12, y: 0 }]));
    await expectError('bad_place', () => tryHome([...base.room_layout, { uid: 'x4', item: 'shell_fountain', x: 0, y: 7 }]));
    await expectError('not_owned', () => tryHome([...base.room_layout, { uid: 'x5', item: 'lyre', parent: 'r6' }]));
    const ok = await tryHome([...base.room_layout, { uid: 'x6', item: 'round_stool', x: 0, y: 8 }, { uid: 'x7', item: 'star_lantern', x: 11, y: 9 }]);
    assert(ok.revision === rev + 1, 'saved');
    await expectError('conflict', () => tryHome(base.room_layout));
  });
  await check('잔액 필드를 직접 수정할 수 없음', async () => {
    await expectError('permission denied', () => A.sql('update public.wallets set balance = 9999'));
    await expectError('permission denied', () => A.sql('insert into public.inventory values ($1, $2, 5)', [pa, 'lyre']));
    await expectError('permission denied', () => A.sql('select * from private.puzzle_solutions'));
  });
  await check('남의 지갑·집은 읽히지 않음(RLS)', async () => {
    const r = await B.sql('select * from public.wallets');
    assert(r.rows.every((w: any) => w.profile_id !== pa), 'B sees A wallet');
    await expectError('forbidden', () => B.rpc('save_home', { p: pa, expected_revision: 99, home: {}, op_id: randomUUID() }));
  });

  console.log('방문·방명록');
  await check('친구가 아니면 방문·방명록 불가', async () => {
    await expectError('no_access', () => C.rpc('visit_home', { viewer: pc, owner: pa }));
    await expectError('no_access', () => C.rpc('post_guestbook', { viewer: pc, owner: pa, body: '안녕', sticker: null, op_id: randomUUID() }));
  });
  await check('친구 초대 → 방문(공개 데이터만) → 방명록 → 우편함', async () => {
    const inv = await A.rpc('create_invite', { p: pa, kind: 'friend' });
    await C.rpc('accept_invite', { p: pc, code: inv.code });
    const v = await C.rpc('visit_home', { viewer: pc, owner: kid }); // 친구 가족의 아이 집도 방문 가능
    assert(v.owner.nickname === '딸' && !('balance' in v) && !JSON.stringify(v).includes('@'), 'public only');
    const op = randomUUID();
    await C.rpc('post_guestbook', { viewer: pc, owner: pa, body: '<script>alert(1)</script>', sticker: 'star', op_id: op });
    const again = await C.rpc('post_guestbook', { viewer: pc, owner: pa, body: '<script>alert(1)</script>', sticker: 'star', op_id: op });
    assert(again.repeat === true, 'same op once');
    await expectError('rate_limited', () => C.rpc('post_guestbook', { viewer: pc, owner: pa, body: '또', sticker: null, op_id: randomUUID() }));
    const list = await A.rpc('list_guestbook', { viewer: pa, owner: pa });
    assert(list.length === 1 && list[0].text === '<script>alert(1)</script>' && list[0].can_delete, 'stored as plain text');
    const mail = await A.rpc('list_mail', { p: pa });
    assert(mail.some((m: any) => m.kind === 'guestbook'), 'mail');
  });
  await check('80자 초과 거부', async () => {
    await admin.query(`update public.guestbook set created_at = now() - interval '1 minute'`);
    await expectError('too_long', () => C.rpc('post_guestbook', { viewer: pc, owner: pa, body: '가'.repeat(81), sticker: null, op_id: randomUUID() }));
  });
  await check('방문자는 주인 배치·전시를 바꿀 수 없음', async () => {
    await expectError('forbidden', () => C.rpc('save_home', { p: pa, expected_revision: 0, home: {}, op_id: randomUUID() }));
    await expectError('forbidden', () => C.rpc('update_profile', { p: pa, patch: { welcome_text: 'hack' } }));
  });
  await check('작성자·주인만 삭제, 주인은 본문 수정 불가', async () => {
    const list = await A.rpc('list_guestbook', { viewer: pa, owner: pa });
    await expectError('forbidden', () => B.rpc('delete_guestbook', { actor: kid, entry: list[0].id }));
    await expectError('permission denied', () => A.sql(`update public.guestbook set text = 'x'`));
    await A.rpc('delete_guestbook', { actor: pa, entry: list[0].id });
    assert((await A.rpc('list_guestbook', { viewer: pa, owner: pa })).length === 0, 'deleted');
  });
  await check('친구 해제 후 다음 요청부터 차단', async () => {
    await A.rpc('remove_friend', { p: pa, other: pc });
    await expectError('no_access', () => C.rpc('visit_home', { viewer: pc, owner: pa }));
  });
  await check('비공개 집은 가족도 방문 불가', async () => {
    await A.rpc('update_profile', { p: pa, patch: { home_visibility: 'private' } });
    await expectError('no_access', () => B.rpc('visit_home', { viewer: pb, owner: pa }));
    await A.rpc('update_profile', { p: pa, patch: { home_visibility: 'friends' } });
    const v = await B.rpc('visit_home', { viewer: pb, owner: pa });
    assert(v.owner.id === pa, 'family visit');
  });
  await check('초대 코드 대입 시도 제한', async () => {
    for (let i = 0; i < 8; i++) assert((await C.rpc('accept_invite', { p: pc, code: 'AAAAA-AAAAA' })).error === 'bad_code', 'bad');
    await expectError('rate_limited', () => C.rpc('accept_invite', { p: pc, code: 'AAAAA-AAAAA' }));
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  for (const u of [A, B, C]) await u.c.end();
  await admin.end();
  process.exit(fail ? 1 : 0);
})();
