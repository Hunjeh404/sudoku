// 꾸밈효과·테마판 화면 찍기(눈으로 확인용). OUT=폴더 npx tsx tests/e2e/fx-shots.ts
import { chromium } from 'playwright';
import pg from 'pg';
const OUT = process.env.OUT ?? '/tmp';
const BASE = 'http://localhost:4173/sudoku/';
const db = new pg.Client({ host: 'localhost', user: 'postgres', password: 'postgres', database: process.env.DB ?? 'olympus_e2e' });
const COMBOS = (process.env.COMBOS ?? 'sun_chariot:zeus,deucalion_ark:nyx,ariadne_crown:hestia,twin_bows:poseidon,helm_darkness:hades,pan_pipes:gaia,golden_cup:chaos,sisyphus_stone:athena').split(',').map((x) => x.split(':'));
(async () => {
  await db.connect();
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto(BASE);
  await p.getByRole('button', { name: /구글 계정으로 시작/ }).click();
  await p.fill('#email', 'fx@test'); await p.click('#go');
  await p.waitForSelector('text=어떻게 불러 드릴까요?');
  await p.getByPlaceholder('예: 별빛 정원사').fill('꾸밈');
  await p.getByRole('button', { name: '시작하기' }).click();
  await p.waitForSelector('.me-card');
  const pid = (await db.query(`select id from public.profiles where nickname = '꾸밈'`)).rows[0].id;
  for (const [badge, avatar] of COMBOS) {
    await db.query(`insert into public.owned_portraits (profile_id, portrait_id, source) values ($1, $2, 'test'), ($1, $3, 'test') on conflict do nothing`, [pid, badge, avatar]);
    await db.query(`update public.profiles set badge = $2, avatar_id = $3 where id = $1`, [pid, badge, avatar]);
    await db.query(`update public.puzzle_attempts set status = 'abandoned' where profile_id = $1 and status = 'active'`, [pid]);
    await p.goto(BASE); await p.waitForSelector('.me-card');
    await p.locator('.tabbar').getByRole('button', { name: '스도쿠', exact: true }).click();
    await p.getByRole('button', { name: /9×9 쉬움/ }).click();
    await p.waitForSelector('.board .cell'); await p.waitForTimeout(700);
    await p.locator('.board .cell').nth(10).click();
    await p.screenshot({ path: `${OUT}/fx-${badge}-${avatar}.png` });
  }
  await b.close(); await db.end();
})();
