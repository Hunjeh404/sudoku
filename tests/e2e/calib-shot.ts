import { chromium } from 'playwright';
const OUT = process.env.OUT ?? '/tmp';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 520, height: 700 }, deviceScaleFactor: 2 });
  for (const k of (process.env.SETS ?? 'room1,room2,garden').split(',')) {
    await p.goto(`http://localhost:4173/sudoku/?calib=${k}`);
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${OUT}/calib-${k}.png`, fullPage: true });
  }
  await b.close();
})();
