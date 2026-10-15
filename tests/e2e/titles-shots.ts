// 칭호 화면 확인: 설정의 칭호 목록, 스킬 별빛이 붙은 결과 화면, 다정한 이웃 이모티콘. flow.ts 다음에 실행(dad@test)
import { chromium } from 'playwright';
import pg from 'pg';
const OUT = process.env.OUT ?? '/tmp';
const BASE = 'http://localhost:4173/sudoku/';
const db = new pg.Client({ host: 'localhost', user: 'postgres', password: 'postgres', database: process.env.DB ?? 'olympus_e2e' });
const ok = (c: unknown, m: string) => { if (!c) throw new Error(m); console.log('✓', m); };
(async () => {
  await db.connect();
  const pid = (await db.query(`select id from public.profiles where nickname = '아빠'`)).rows[0].id;
  // 보물 4개 더 + 칭호 수습생을 달고, 오늘 끝낸 판은 어제로
  await db.query(`insert into public.owned_portraits (profile_id, portrait_id, source) select $1, id, 'test' from public.portrait_catalog c where tier = 0
    and not exists (select 1 from public.owned_portraits o where o.profile_id = $1 and o.portrait_id = c.id) order by id limit 4`, [pid]);
  await db.query(`select private.check_titles($1)`, [pid]);
  await db.query(`update public.profiles set title = 'apprentice' where id = $1`, [pid]);
  await db.query(`insert into public.unlocks (profile_id, key) values ($1, 'title:apprentice') on conflict do nothing`, [pid]);
  await db.query(`update public.puzzle_attempts set completed_at = now() - interval '1 day' where profile_id = $1 and status = 'completed'`, [pid]);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto(BASE);
  await p.getByRole('button', { name: /구글 계정으로 시작/ }).click();
  await p.fill('#email', 'dad@test'); await p.click('#go');
  await p.waitForSelector('.me-card');
  await p.getByRole('button', { name: '설정', exact: true }).click();
  await p.locator('.title-group').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/t-settings-1.png` });
  await p.locator('.title-group').nth(2).scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/t-settings-2.png` });
  ok(await p.locator('.title-card:not(.locked)').count() >= 2, '받은 칭호는 고를 수 있음(보물 사냥꾼 포함)');
  ok(await p.getByText('조건: 초상화 10장').count() === 1, '못 받은 칭호는 조건과 진행도');
  await p.keyboard.press('Escape');
  // 한 판 끝내기 → 하루 첫 판 스킬 별빛
  await p.locator('.tabbar').getByRole('button', { name: '스도쿠', exact: true }).click();
  await p.locator('.size-card.s4').click();
  const confirm = p.getByRole('button', { name: '새 판으로 시작' });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await p.waitForSelector('.board .cell');
  const r = (await db.query(`select s.solution, c.givens from public.puzzle_attempts a join private.puzzle_solutions s on s.puzzle_id = a.puzzle_id
    join public.puzzle_catalog c on c.id = a.puzzle_id where a.profile_id = $1 and a.status = 'active' order by a.started_at desc limit 1`, [pid])).rows[0];
  for (let i = 0; i < r.givens.length; i++) {
    if (r.givens[i] !== '.') continue;
    await p.locator('.board .cell').nth(i).click();
    await p.getByRole('button', { name: `${r.solution[i]} 넣기`, exact: true }).click();
  }
  await p.waitForSelector('text=다 풀었어요!'); await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/t-result.png` });
  ok(await p.getByText(/스킬로 별빛 \+2/).count() === 1, '결과 화면에 칭호 스킬 별빛 +2');
  await b.close(); await db.end();
})().catch((e) => { console.log('✗', e.message); process.exit(1); });
