// 보정 화면 큰 캡처(가구 정합 확인용): OUT=… SETS=room1,stack npx tsx tests/e2e/calib-big.ts
import { chromium } from 'playwright';
const OUT = process.env.OUT ?? '/tmp';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1100, height: 1100 }, deviceScaleFactor: 1.5 });
  for (const k of (process.env.SETS ?? 'room1,room2,stack,garden').split(',')) {
    await p.goto(`http://localhost:4173/sudoku/?calib=${k}${process.env.NOGRID ? '&nogrid=1' : ''}`);
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `${OUT}/big-${k}.png` });
  }
  await b.close();
})();
