// 이미 운영 중인 DB(0001~0007)에 0008·0009를 올릴 때 기존 사용자가 어떻게 옮겨지는지 확인
// DB=olympus_legacy UNTIL=0007_z sh tests/db/reset.sh && DB=olympus_legacy npx tsx tests/db/legacy-check.ts
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const conn = { host: 'localhost', user: 'postgres', password: 'postgres', database: process.env.DB ?? 'olympus_legacy' };
const bank: { id: string; solution: string }[] = JSON.parse(readFileSync('puzzles/bank.json', 'utf8'));
(async () => {
  const admin = new pg.Client(conn); await admin.connect();
  const id = randomUUID();
  await admin.query('insert into auth.users (id, email) values ($1, $2)', [id, 'old@test']);
  const c = new pg.Client(conn); await c.connect();
  await c.query('set role authenticated');
  await c.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: id })]);
  const one = async (sql: string, args: unknown[]) => (await c.query(sql, args)).rows[0].r;
  // 옛 방식: 얼굴 그림을 골라 만들고, 두 판 끝내고, 가구를 산다
  const p = await one('select public.create_my_profile(nickname => $1, avatar_id => $2, guide_id => $3) as r', ['옛날사람', 'athena', 'hestia']);
  for (let i = 0; i < 2; i++) {
    const a = await one('select public.start_attempt(p => $1, board_size => 4, difficulty => $2) as r', [p, 'intro']);
    const sol = bank.find((b) => b.id === a.puzzle_id)!.solution;
    await one('select public.complete_attempt(attempt => $1, board => $2, op_id => $3) as r', [a.id, sol, randomUUID()]);
  }
  await admin.query(`insert into public.friendships values (least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid))`, [p, p]).catch(() => {});
  await c.query('reset role');
  for (const f of ['0008_portraits_scores_social.sql', '0009_portrait_data.sql']) await admin.query(readFileSync(`supabase/migrations/${f}`, 'utf8'));
  await c.query('set role authenticated');
  const s = await one('select public.get_state(p => $1) as r', [p]);
  const ok = s.owned.includes('athena') && s.profile.avatar_id === 'athena' && s.points.total === 20 && s.balance === 20 && s.quest.completed_count === 2 && s.gifts.length === 0;
  console.log(ok ? '✓ 옛 사용자: 얼굴 그림 유지, 점수 20(지난 두 판), 잔액 유지' : '✗ ' + JSON.stringify(s));
  // 다음 판(3판째)에 여정 2칸(별빛 30)
  const a = await one('select public.start_attempt(p => $1, board_size => 4, difficulty => $2) as r', [p, 'intro']);
  const sol = bank.find((b) => b.id === a.puzzle_id)!.solution;
  const r = await one('select public.complete_attempt(attempt => $1, board => $2, op_id => $3) as r', [a.id, sol, randomUUID()]);
  console.log(r.journey?.step === 2 && r.balance === 60 ? '✓ 옮긴 뒤 다음 판 여정 보상 정상' : '✗ ' + JSON.stringify(r));
  await c.end(); await admin.end();
  process.exit(ok ? 0 : 1);
})();
