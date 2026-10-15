// 그림 없는 보물 24개의 판 효과 찍기(눈으로 확인용). OUT=폴더 npx tsx tests/e2e/tfx-shots.ts
import { chromium, Page } from 'playwright';
import pg from 'pg';
import { TREASURE_FX } from '../../src/data/effects';
const OUT = process.env.OUT ?? '/tmp';
const BASE = 'http://localhost:4173/sudoku/';
const db = new pg.Client({ host: 'localhost', user: 'postgres', password: 'postgres', database: process.env.DB ?? 'olympus_e2e' });
const ONLY = process.env.ONLY?.split(',');
(async () => {
  await db.connect();
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto(BASE);
  await p.getByRole('button', { name: /구글 계정으로 시작/ }).click();
  await p.fill('#email', 'tfx@test'); await p.click('#go');
  await p.waitForSelector('text=어떻게 불러 드릴까요?');
  await p.getByPlaceholder('예: 별빛 정원사').fill('판효과');
  await p.getByRole('button', { name: '시작하기' }).click();
  await p.waitForSelector('.me-card');
  const pid = (await db.query(`select id from public.profiles where nickname = '판효과'`)).rows[0].id;
  const ids = Object.entries(TREASURE_FX).filter(([id, f]) => f.board && (!ONLY || ONLY.includes(id))).map(([id]) => id);
  for (const id of ids) {
    const kind = TREASURE_FX[id].board;
    await db.query(`insert into public.owned_portraits (profile_id, portrait_id, source) values ($1, $2, 'test') on conflict do nothing`, [pid, id]);
    await db.query(`update public.profiles set badge = $2 where id = $1`, [pid, id]);
    await db.query(`update public.puzzle_attempts set status = 'abandoned' where profile_id = $1 and status = 'active'`, [pid]);
    await p.goto(BASE); await p.waitForSelector('.me-card');
    await p.locator('.tabbar').getByRole('button', { name: '스도쿠', exact: true }).click();
    await p.locator('.size-card.s6').click();
    await p.waitForSelector('.board .cell');
    const r = (await db.query(`select s.solution, c.givens from public.puzzle_attempts a join private.puzzle_solutions s on s.puzzle_id = a.puzzle_id
      join public.puzzle_catalog c on c.id = a.puzzle_id where a.profile_id = $1 and a.status = 'active'`, [pid])).rows[0];
    const sol: string = r.solution, giv: string = r.givens;
    const cells = p.locator('.board .cell');
    const put = async (i: number) => { await cells.nth(i).click(); await p.getByRole('button', { name: `${sol[i]} 넣기`, exact: true }).click(); };
    const empties = [...giv].map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);
    // 메모 하나(메모 모양 확인용)
    await cells.nth(empties[empties.length - 1]).click();
    await p.getByRole('button', { name: '메모', exact: true }).click();
    for (const d of ['1', '2', '3', '4', '5', '6']) if (!giv.includes(d) || true) await p.getByRole('button', { name: `${d} 넣기(메모)` }).click().catch(() => {});
    await p.getByRole('button', { name: '메모', exact: true }).click();
    let wait = 120;
    if (kind === 'line') { const row = empties.filter((i) => i < 6); for (const i of row) await put(i); }
    else if (kind === 'box') { const box = empties.filter((i) => Math.floor(i / 6) < 2 && i % 6 < 3); for (const i of box) await put(i); wait = 300; }
    else if (kind === 'pad') { const d = sol[empties[0]]; for (const i of empties.filter((k) => sol[k] === d)) await put(i); wait = 300; }
    else if (kind === 'erase') { await put(empties[0]); await p.waitForTimeout(500); await p.getByRole('button', { name: '지우기' }).click(); }
    else if (kind === 'undo') { await put(empties[0]); await p.waitForTimeout(500); await p.getByRole('button', { name: '되돌림' }).click(); }
    else { await put(empties[0]); await put(empties[1]); if (kind === 'look') { await cells.nth(empties[1]).click(); wait = 300; } }
    await p.waitForTimeout(wait);
    await p.locator('.tablet').screenshot({ path: `${OUT}/tfx-${id}.png` });
    if (kind === 'pad') await p.locator('.pad').screenshot({ path: `${OUT}/tfx-${id}-pad.png` });
  }
  await b.close(); await db.end();
})();
