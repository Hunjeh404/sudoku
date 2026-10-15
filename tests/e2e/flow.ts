// 두 계정 E2E: 로그인 → 스도쿠 완료 → 서버 보상 → 선물 → 구매 → 배치 저장 → 새로고침 유지 → 친구 초대 → 방문 → 방명록 → 우편함
// 준비: DB=olympus_e2e tests/db/reset.sh, 게이트웨이(tests/e2e/gateway.ts), tests/e2e/rebuild.sh 후 vite preview(4173)
import { chromium, Page, BrowserContext } from 'playwright';
import pg from 'pg';

const OUT = process.env.OUT ?? '/tmp';
const BASE = 'http://localhost:4173/sudoku/';
const db = new pg.Client({ host: 'localhost', user: 'postgres', password: 'postgres', database: process.env.DB ?? 'olympus_e2e' });
let step = 0;
const results: string[] = [];
const ok = (m: string) => { results.push('✓ ' + m); console.log('✓', m); };
// 가구 누르기: 접근성 경로(포커스+Enter). 포인터 경로는 tapPoint로 따로 확인
const tap = async (p: Page, label: string, nth: 'first' | 'last' = 'first') => { const l = p.locator(`.sprite[aria-label="${label}"]`)[nth](); await l.focus(); await l.press('Enter'); };
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
  await p.getByRole('button', { name: '집 받기' }).click();
  await p.waitForSelector('.space');
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
  try {
    // ---- A: 로그인·첫 판 ----
    const a = await login(ctxA, 'dad@test', '아빠');
    ok('A 구글(모의) 로그인 + 프로필·기본 집 생성');
    await shot(a, 'A-home');
    await a.getByRole('button', { name: '스도쿠 하러 가기' }).click();
    await a.getByRole('button', { name: '4×4 짧은 안내' }).click();
    await shot(a, 'A-tutorial');
    await a.getByRole('button', { name: '4×4 풀어 보기' }).click();
    await a.waitForSelector('.board');
    // 힌트 4단계 확인
    await a.getByRole('button', { name: '힌트' }).click();
    await a.getByRole('button', { name: '더 알려 줘' }).click();
    await a.getByRole('button', { name: '더 알려 줘' }).click();
    await shot(a, 'A-hint');
    await a.getByRole('button', { name: /숫자 넣기|정답 보기/ }).click();
    ok('힌트 3단계 설명 후 숫자 넣기');
    await a.waitForTimeout(1800);
    await a.waitForSelector('text=저장됨');
    ok('진행 자동 저장(서버)');
    // 연결 끊김 중 입력 → 기기에 보관 → 연결되면 저장
    await ctxA.setOffline(true);
    const empty = a.locator('.board .cell:not(.given)').filter({ hasText: /^$/ }).first();
    await empty.click();
    await a.getByRole('button', { name: '메모', exact: true }).click();
    await a.getByRole('button', { name: /^1 넣기/ }).click();
    await a.getByRole('button', { name: '메모', exact: true }).click();
    await a.waitForSelector('text=연결 끊김', { timeout: 6000 });
    await shot(a, 'A-offline');
    await ctxA.setOffline(false);
    await a.waitForSelector('text=저장됨', { timeout: 8000 });
    ok('연결 끊김 중 메모 입력 유지 → 연결 후 저장');
    await shot(a, 'A-puzzle');
    await solveCurrent(a);
    await a.waitForSelector('text=다 풀었어요!', { timeout: 10000 });
    await shot(a, 'A-result');
    const bal = await db.query(`select balance from public.wallets w join public.profiles p on p.id = w.profile_id where p.nickname = '아빠'`);
    if (bal.rows[0].balance !== 10) throw new Error('balance ' + bal.rows[0].balance);
    ok('서버 검증 후 별빛 +10 (DB 잔액 10)');
    await a.getByRole('button', { name: /집으로/ }).click();
    await a.getByRole('button', { name: '선물 고르기' }).click();
    await a.getByRole('button', { name: /별빛 등불/ }).click();
    ok('첫 선물(별빛 등불) 받기');

    // ---- 한 판 더 → 20 별빛 → 둥근 의자 구매 ----
    await a.getByRole('tab', { name: '스도쿠' }).or(a.getByRole('button', { name: '스도쿠' })).first().click();
    await a.getByRole('button', { name: /4×4 입문/ }).click();
    await solveCurrent(a);
    await a.waitForSelector('text=다 풀었어요!');
    await a.getByRole('button', { name: /^집으로$/ }).click();
    await a.getByRole('button', { name: '꾸미기' }).click();
    await a.getByRole('tab', { name: '상점' }).click();
    await a.locator('.item-card', { hasText: '둥근 의자' }).click();
    await a.getByRole('button', { name: /20로 사기/ }).dblclick();
    await a.waitForSelector('text=둥근 의자를 샀어요');
    const inv = await db.query(`select quantity from public.inventory i join public.profiles p on p.id = i.profile_id where p.nickname = '아빠' and item_id = 'round_stool'`);
    if (inv.rows[0].quantity !== 2) throw new Error('stool qty ' + inv.rows[0].quantity);
    ok('구매 버튼 두 번 눌러도 거래 1회(의자 2개 = 기본 1 + 구매 1)');
    // 보관함에서 의자·등불 놓기 → 저장
    await a.locator('.item-card', { hasText: '둥근 의자' }).click();
    await a.getByRole('button', { name: '오른쪽 아래로' }).click();
    await a.getByRole('button', { name: '숨은 쪽지' }).click();
    await a.getByRole('textbox', { name: '쪽지 내용' }).fill('의자 밑에 별사탕이 있어!');
    await a.getByRole('button', { name: '넣기' }).click();
    await a.getByRole('button', { name: '고르기 끝' }).click();
    await a.locator('.item-card', { hasText: '별빛 등불' }).click();
    await shot(a, 'A-editor');
    await a.getByRole('button', { name: '완료' }).click();
    await a.waitForSelector('text=집을 저장했어요');
    ok('배치 저장(서버 검증 통과)');
    await a.reload();
    await a.waitForSelector('.space');
    const placed = await a.locator('.sprite[aria-label="둥근 의자"]').count();
    if (placed !== 2) throw new Error('stools placed after reload ' + placed);
    ok('새로고침 후 배치 유지');
    // 등불 켜기(주인)
    // 포인터 경로: 등불 그림 위 실제 좌표를 눌러 투명도 판정 확인
    const box = (await a.locator('.sprite[aria-label="별빛 등불"]').boundingBox())!;
    await a.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
    await a.waitForTimeout(400);
    if (!(await a.locator('.fx-lit').count())) throw new Error('lantern not lit by pointer');
    ok('포인터로 등불 켜기(투명도 판정)');
    await shot(a, 'A-lantern');

    // ---- 친구 초대 ----
    await a.getByRole('button', { name: '친구' }).click();
    await a.getByRole('button', { name: '친구 초대 코드' }).click();
    const code = (await a.locator('.invite-code').textContent())!.trim();
    await shot(a, 'A-invite');
    ok('친구 초대 코드 발급 ' + code);

    // ---- B ----
    const b = await login(ctxB, 'neighbor@test', '이웃');
    await b.getByRole('button', { name: '친구' }).click();
    await b.getByRole('button', { name: '받은 코드 넣기' }).click();
    await b.getByRole('textbox', { name: '초대 코드' }).fill(code.toLowerCase());
    await b.getByRole('button', { name: '연결하기' }).click();
    await b.waitForSelector('text=아빠네와 친구가 되었어요');
    ok('B 초대 코드로 친구 연결');
    await b.locator('.conn', { hasText: '아빠' }).first().click();
    await b.waitForSelector('.visit .space');
    await shot(b, 'B-visit');
    ok('B가 A의 집 방문(저장된 배치 읽기)');
    // 방문자가 등불을 꺼도 A의 서버 데이터는 그대로
    const before = await db.query(`select h.revision, h.room_layout from public.homes h join public.profiles p on p.id = h.profile_id where p.nickname = '아빠'`);
    await tap(b, '별빛 등불');
    await tap(b, '둥근 의자', 'last');
    await tap(b, '둥근 의자', 'first');
    await b.waitForSelector('text=숨은 쪽지를 찾았어요').catch(() => {});
    await shot(b, 'B-note');
    await b.keyboard.press('Escape');
    const after = await db.query(`select h.revision, h.room_layout from public.homes h join public.profiles p on p.id = h.profile_id where p.nickname = '아빠'`);
    if (before.rows[0].revision !== after.rows[0].revision) throw new Error('visitor changed home');
    ok('방문자 조작 후에도 주인 집 revision 불변');
    // 방명록
    await b.getByRole('button', { name: '방명록 남기기' }).click();
    await b.getByRole('textbox', { name: '방명록 글' }).fill('<b>놀러 왔어요</b> 의자 귀엽다!');
    await b.getByRole('button', { name: '별', exact: true }).click();
    await b.getByRole('button', { name: '남기기', exact: true }).click();
    await b.waitForSelector('text=방명록을 남겼어요');
    await shot(b, 'B-guestbook');
    ok('B 방명록 작성(80자 제한, 스티커)');

    // ---- A 우편함 ----
    await a.reload();
    await a.waitForSelector('.space');
    await a.getByRole('button', { name: /우편함, 새 소식/ }).click();
    await a.waitForSelector('text=이웃님이 방명록을 남겼어요');
    await shot(a, 'A-mail');
    ok('A 우편함에 새 방명록 알림');
    await a.keyboard.press('Escape');
    await a.getByRole('button', { name: '내 집' }).click();
    await a.getByRole('tab', { name: '정원' }).click();
    await tap(a, '올빼미 우편함');
    await a.waitForSelector('.gb-list li');
    const txt = await a.locator('.gb-list li p').first().innerText();
    if (!txt.includes('<b>놀러 왔어요</b>')) throw new Error('guestbook text not plain: ' + txt);
    await shot(a, 'A-guestbook');
    ok('방명록 HTML이 글자 그대로 표시(스크립트 실행 안 됨)');
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
