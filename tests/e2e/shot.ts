// 빠른 화면 확인용: npx tsx tests/e2e/shot.ts
import { chromium } from 'playwright';
const OUT = process.env.OUT ?? '/tmp';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto('http://localhost:4173/sudoku/');
  await p.screenshot({ path: `${OUT}/01-login.png` });
  await p.getByRole('button', { name: /구글 계정으로 시작/ }).click();
  await p.fill('#email', 'dad@test');
  await p.click('#go');
  await p.waitForSelector('text=어떻게 불러 드릴까요?');
  await p.fill('input', '아빠');
  await p.screenshot({ path: `${OUT}/02-onboard.png`, fullPage: true });
  await p.getByRole('button', { name: '집 받기' }).click();
  await p.waitForSelector('.space');
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/03-home.png`, fullPage: true });
  await p.getByRole('tab', { name: '정원' }).click();
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/04-garden.png`, fullPage: true });
  await b.close();
})();
