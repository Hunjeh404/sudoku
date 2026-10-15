// 스도쿠 화면 디자인 점검(390px·360px)
import { chromium, Page } from 'playwright';
import pg from 'pg';
const OUT = process.env.OUT ?? '/tmp';
const db = new pg.Client({ host: 'localhost', user: 'postgres', password: 'postgres', database: process.env.DB ?? 'olympus_e2e' });
async function solve(p: Page) {
  const r = await db.query(`select s.solution, c.givens from public.puzzle_attempts a join private.puzzle_solutions s on s.puzzle_id = a.puzzle_id
    join public.puzzle_catalog c on c.id = a.puzzle_id where a.status = 'active' order by a.updated_at desc limit 1`);
  const { solution, givens } = r.rows[0];
  const cells = p.locator('.board .cell');
  for (let i = 0; i < givens.length; i++) {
    if (givens[i] !== '.' || (await cells.nth(i).innerText()).trim() === solution[i]) continue;
    await cells.nth(i).click();
    await p.getByRole('button', { name: `${solution[i]} 넣기`, exact: true }).click();
  }
}
(async () => {
  await db.connect();
  const b = await chromium.launch();
  for (const w of [390, 360]) {
    const p = await b.newPage({ viewport: { width: w, height: w === 390 ? 844 : 740 }, deviceScaleFactor: 2 });
    await p.goto('http://localhost:4173/sudoku/');
    await p.getByRole('button', { name: /구글 계정으로 시작/ }).click();
    await p.fill('#email', `s${w}${Date.now()}@test`); await p.click('#go');
    await p.waitForSelector('text=어떻게 불러 드릴까요?');
    await p.getByPlaceholder('예: 별빛 정원사').fill('훈제');
    await p.getByRole('button', { name: '집 받기' }).click();
    await p.waitForSelector('.space');
    await p.getByRole('button', { name: '스도쿠', exact: true }).click();
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${OUT}/sd${w}-select.png`, fullPage: true });
    await p.locator('.size-card', { hasText: w === 390 ? '4×4' : '9×9 어려움' }).click();
    await p.waitForSelector('.board');
    await p.locator('.board .cell:not(.given)').nth(1).click();
    await p.getByRole('button', { name: '메모', exact: true }).click();
    for (const d of [1, 3]) await p.getByRole('button', { name: new RegExp(`^${d} 넣기`) }).click();
    await p.getByRole('button', { name: '메모', exact: true }).click();
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/sd${w}-puzzle.png` });
    await p.getByRole('button', { name: '힌트', exact: true }).click();
    await p.getByRole('button', { name: '더 알려 줘' }).click();
    await p.getByRole('button', { name: '더 알려 줘' }).click();
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/sd${w}-hint.png`, fullPage: true });
    if (w === 390) {
      await p.getByRole('button', { name: '닫기' }).click();
      await solve(p);
      await p.waitForSelector('text=다 풀었어요!');
      await p.waitForTimeout(900);
      await p.screenshot({ path: `${OUT}/sd${w}-result.png` });
    }
    await p.close();
  }
  await b.close(); await db.end();
})();
