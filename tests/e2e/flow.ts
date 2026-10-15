// 두 계정 E2E: 로그인(빈 초상) → 스도쿠 완료 → 서버 보상 → 초상화 선물 → 여정 별빛 → 초상화 구입 → 순위 → 이메일 친구 요청·수락 → 친구 소식 → 이모티콘 달기·바꾸기·지우기
// 준비: DB=olympus_e2e tests/db/reset.sh, 게이트웨이(tests/e2e/gateway.ts), tests/e2e/rebuild.sh 후 vite preview(4173)
import { chromium, Page, BrowserContext } from 'playwright';
import pg from 'pg';

const OUT = process.env.OUT ?? '/tmp';
const BASE = 'http://localhost:4173/sudoku/';
const db = new pg.Client({ host: 'localhost', user: 'postgres', password: 'postgres', database: process.env.DB ?? 'olympus_e2e' });
let step = 0;
const results: string[] = [];
const ok = (m: string) => { results.push('✓ ' + m); console.log('✓', m); };
const shot = (p: Page, name: string) => p.screenshot({ path: `${OUT}/e2e-${String(++step).padStart(2, '0')}-${name}.png`, fullPage: true });

async function login(ctx: BrowserContext, email: string, nickname: string) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log(`[${nickname}] pageerror`, e.message));
  await p.goto(BASE);
  await p.getByRole('button', { name: /구글 계정으로 시작/ }).click();
  await p.fill('#email', email);
  await p.click('#go');
  await p.waitForSelector('text=어떻게 불러 드릴까요?');
  await p.getByPlaceholder('예: 별빛 정원사').fill(nickname);
  await p.getByRole('button', { name: '시작하기' }).click();
  await p.waitForSelector('.me-card');
  return p;
}

async function solveCurrent(p: Page) {
  await p.waitForSelector('.board');
  const r = await db.query(`select s.solution, c.givens from public.puzzle_attempts a join private.puzzle_solutions s on s.puzzle_id = a.puzzle_id
    join public.puzzle_catalog c on c.id = a.puzzle_id where a.status = 'active' order by a.started_at desc limit 1`);
  const { solution, givens } = r.rows[0];
  const cells = p.locator('.board .cell');
  for (let i = 0; i < givens.length; i++) {
    if (givens[i] !== '.') continue;
    if ((await cells.nth(i).innerText()).trim() === solution[i]) continue;
    await cells.nth(i).click();
    await p.getByRole('button', { name: `${solution[i]} 넣기`, exact: true }).click();
  }
}

(async () => {
  await db.connect();
  const browser = await chromium.launch();
  const ctxA = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const ctxB = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2 });
  const balanceOf = async (nick: string) => (await db.query(`select balance from public.wallets w join public.profiles p on p.id = w.profile_id where p.nickname = $1`, [nick])).rows[0].balance;
  const tabTo = (p: Page, name: string) => p.locator('.tabbar').getByRole('button', { name, exact: true }).click();
  const playOne = async (p: Page) => {
    await tabTo(p, '스도쿠');
    await p.getByRole('button', { name: /4×4 입문/ }).click();
    await solveCurrent(p);
    await p.waitForSelector('text=다 풀었어요!');
  };
  try {
    // ---- A: 로그인(빈 초상)·첫 판 ----
    const a = await login(ctxA, 'dad@test', '아빠');
    if (!(await a.locator('.me-card .pt-blank').count())) throw new Error('not blank');
    ok('A 구글(모의) 로그인 + 프로필 생성, 초상화는 빈칸');
    await shot(a, 'A-home-blank');
    await a.getByRole('button', { name: '스도쿠 하러 가기' }).click();
    await a.getByRole('button', { name: '4×4 짧은 안내' }).click();
    await a.getByRole('button', { name: '4×4 풀어 보기' }).click();
    await a.waitForSelector('.board');
    await a.getByRole('button', { name: /^힌트, 남은/ }).click();
    await a.getByRole('button', { name: '더 알려 줘' }).click();
    await a.getByRole('button', { name: '더 알려 줘' }).click();
    await a.getByRole('button', { name: /숫자 넣기|정답 보기/ }).click();
    ok('힌트 3단계 설명 후 숫자 넣기');
    await a.waitForTimeout(1800);
    await a.waitForSelector('text=저장됨');
    await ctxA.setOffline(true);
    const empty = a.locator('.board .cell:not(.given)').filter({ hasText: /^$/ }).first();
    await empty.click();
    await a.getByRole('button', { name: '메모', exact: true }).click();
    await a.getByRole('button', { name: /^1 넣기/ }).click();
    await a.getByRole('button', { name: '메모', exact: true }).click();
    await a.waitForSelector('text=연결 끊김', { timeout: 6000 });
    await ctxA.setOffline(false);
    await a.waitForSelector('text=저장됨', { timeout: 8000 });
    ok('자동 저장, 연결 끊김 중 입력 유지 → 연결 후 저장');
    await solveCurrent(a);
    await a.waitForSelector('text=다 풀었어요!', { timeout: 10000 });
    await shot(a, 'A-result-first');
    if ((await balanceOf('아빠')) !== 9) throw new Error('balance');
    ok('서버 검증 후 별빛 +9 (힌트 1번 → 10%↓)');
    await a.getByRole('button', { name: '선물 고르러 가기' }).click();
    await a.getByRole('button', { name: /초상화 선물 상자/ }).click();
    await shot(a, 'A-gift');
    await a.locator('.gift-card').first().click();
    await a.waitForSelector('.me-card .pt-img:not(.pt-blank)');
    ok('첫 판 선물: 1티어 셋 중 하나 → 바로 내 초상화');

    // ---- 두 판 더(3판째 여정 별빛 30) → 도감에서 초상화 구입 ----
    for (let k = 0; k < 2; k++) { await playOne(a); await a.getByRole('button', { name: '처음 화면으로' }).click(); }
    if ((await balanceOf('아빠')) !== 59) throw new Error('balance after 3 ' + (await balanceOf('아빠')));
    ok('3판째 여정 보상 별빛 30 (잔액 59)');
    await tabTo(a, '도감');
    if (!(await a.locator('.chips .chip').first().innerText()).startsWith('내 초상화')) throw new Error('mine chip not first');
    await a.getByRole('button', { name: /^1티어/ }).click();
    await a.locator('.dex-card:not(.owned)').first().click();
    await a.getByRole('button', { name: /✦ 20로 모으기/ }).click();
    await a.getByRole('button', { name: '내 초상화로 쓰기' }).click();
    await a.waitForSelector('text=내 초상화를 바꿨어요');
    await shot(a, 'A-dex-bought');
    if ((await balanceOf('아빠')) !== 39) throw new Error('buy');
    ok('도감에서 1티어 초상화 구입(별빛 20) → 내 초상화로 쓰기');
    await a.keyboard.press('Escape');
    await a.getByRole('tab', { name: '보물' }).click();
    if (!(await a.locator('.dex-card:not(.owned) .pt-img').first().evaluate((el) => getComputedStyle(el).filter.includes('grayscale')))) throw new Error('not grayscale');
    await a.locator('.dex-card:not(.owned)').first().click();
    if (!(await a.getByText('모으면 긴 이야기를 읽을 수 있어요').count())) throw new Error('story not locked');
    await a.getByRole('button', { name: /✦ 10로 모으기/ }).click();
    await a.waitForSelector('text=프로필에 달려 있어요');
    await a.keyboard.press('Escape');
    await a.waitForSelector('.topbar .pt-badge');
    if ((await balanceOf('아빠')) !== 29) throw new Error('treasure buy');
    await shot(a, 'A-dex-treasure');
    ok('보물(흑백·긴 이야기 잠김) 별빛 10으로 사면 초상화 오른쪽 아래에 달림');

    // ---- 순위 ----
    await tabTo(a, '순위');
    await a.waitForSelector('.rank-row.me');
    const pts = await a.locator('.rank-row.me .rank-pts').innerText();
    if (!pts.startsWith('29')) throw new Error('rank pts ' + pts);
    await shot(a, 'A-rank');
    ok('순위표(이번 주·통합)에 내 점수 29');

    // ---- B(할머니): 이메일로 친구 요청 → A 수락 ----
    const b = await login(ctxB, 'grandma@test', '할머니');
    await tabTo(b, '친구');
    await b.getByRole('tab', { name: '친구 맺기' }).click();
    await b.getByLabel('친구 이메일').fill('nobody@test');
    await b.getByRole('button', { name: '요청' }).click();
    await b.waitForSelector('text=이 이메일로 가입한 사람이 없어요');
    await b.getByLabel('친구 이메일').fill('Dad@test');
    await b.getByRole('button', { name: '요청' }).click();
    await b.waitForSelector('text=수락을 기다리는 중');
    await shot(b, 'B-request');
    ok('B가 이메일로 친구 요청(없는 주소는 안내)');
    await a.reload();
    await a.waitForSelector('.me-card');
    await a.getByRole('button', { name: /우편함, 새 소식/ }).click();
    await a.waitForSelector('text=할머니님이 친구 요청을 보냈어요');
    await shot(a, 'A-mail-request');
    await a.locator('.mail-list').getByRole('button', { name: '수락' }).click();
    await a.waitForSelector('text=수락함');
    ok('A 우편함에서 친구 요청 수락');
    await a.keyboard.press('Escape');

    // ---- A가 여정 5판(2티어 열림) → B 소식에 뜸 → 이모티콘 ----
    await db.query(`update public.quest_progress set completed_count = 4 where profile_id = (select id from public.profiles where nickname = '아빠')`);
    await playOne(a);
    await a.getByRole('button', { name: '처음 화면으로' }).click();
    await b.reload();
    await tabTo(b, '친구');
    await b.waitForSelector('text=2티어 초상화 상점이 열렸어요');
    const item = b.locator('.feed-item', { hasText: '2티어 초상화 상점이 열렸어요' });
    await item.getByRole('button', { name: '이모티콘 달기' }).click();
    await item.getByRole('button', { name: '❤️ 달기' }).click();
    await item.getByRole('button', { name: /내 이모티콘 ❤️/ }).click();
    await item.getByRole('button', { name: '🎉 달기' }).click();
    await b.waitForTimeout(500);
    await shot(b, 'B-feed');
    ok('B 친구 소식에 A의 티어 해금 → 이모티콘 ❤️ 달고 🎉로 바꾸기');
    await a.reload();
    await a.waitForSelector('.feed-item.mine');
    const mine = a.locator('.feed-item.mine', { hasText: '2티어 초상화 상점이 열렸어요' });
    await mine.locator('.reactions li', { hasText: '할머니' }).waitFor();
    if (!(await mine.locator('.reactions').innerText()).includes('🎉')) throw new Error('reaction not shown');
    await shot(a, 'A-home-reaction');
    ok('A 홈의 내 소식에 누가(할머니) 어떤 이모티콘(🎉)을 달았는지 표시');
    await item.getByRole('button', { name: /내 이모티콘 🎉/ }).click();
    await item.getByRole('button', { name: '이모티콘 지우기' }).click();
    await b.waitForTimeout(500);
    const left = await db.query('select count(*)::int as n from public.activity_reactions');
    if (left.rows[0].n !== 0) throw new Error('not removed');
    ok('B 이모티콘 지우기');
  } catch (e: any) {
    console.log('FAIL', e.message);
    results.push('✗ ' + e.message);
    for (const ctx of [ctxA, ctxB]) for (const p of ctx.pages()) await p.screenshot({ path: `${OUT}/e2e-fail-${Date.now()}.png`, fullPage: true }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
    await db.end();
    console.log(results.join('\n'));
  }
})();
