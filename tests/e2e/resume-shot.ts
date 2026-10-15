// 이어서 풀기 카드·집 화면 캡처(390px): OUT=… npx tsx tests/e2e/resume-shot.ts
import { chromium } from 'playwright';
const OUT = process.env.OUT ?? '/tmp';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.goto('http://localhost:4173/sudoku/');
  await p.getByRole('button', { name: /구글 계정으로 시작/ }).click();
  await p.fill('#email', `r${Date.now()}@test`); await p.click('#go');
  await p.waitForSelector('text=어떻게 불러 드릴까요?');
  await p.getByPlaceholder('예: 별빛 정원사').fill('훈제');
  await p.getByRole('button', { name: '집 받기' }).click();
  await p.waitForSelector('.space'); await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/r-home.png` });
  await p.getByRole('button', { name: '정원', exact: true }).click().catch(() => p.getByRole('tab', { name: '정원' }).click());
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/r-garden.png` });
  for (const label of ['4×4 입문', '9×9 쉬움']) {
    await p.getByRole('button', { name: '스도쿠', exact: true }).click();
    await p.locator('.size-card', { hasText: label }).click();
    await p.waitForSelector('.board');
    await p.getByRole('button', { name: '나가기' }).click();
    await p.waitForTimeout(400);
  }
  await p.getByRole('button', { name: '스도쿠', exact: true }).click();
  await p.waitForSelector('.resume'); await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/r-select.png` });
  await b.close();
})();
