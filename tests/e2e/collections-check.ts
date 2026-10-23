// Local UI/API contract checks. All Supabase requests are intercepted; no production writes.
// Run: node --import tsx tests/e2e/collections-check.ts
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
const OUT = process.env.OUT ?? '/tmp/sudoku-collections';
mkdirSync(OUT, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4175', '--strictPort'], { env: { ...process.env, VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_KEY: 'local' }, stdio: 'ignore' });
for (let i = 0; i < 100; i++) {
  if (await fetch('http://127.0.0.1:4175/sudoku/').then((r) => r.ok).catch(() => false)) break;
  await new Promise((r) => setTimeout(r, 100));
}
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  for (const width of [360, 768]) {
    const context = await browser.newContext({ viewport: { width, height: width === 360 ? 800 : 1024 }, serviceWorkers: 'block' });
    const uid = '00000000-0000-4000-8000-000000000001';
    const pid = '00000000-0000-4000-8000-000000000002';
    const state = { profile: { id: pid, nickname: '여행자', avatar_id: '', badge: '', title: '', is_child: false, settings: { sound: false, showTimer: true } as Record<string, unknown> }, balance: 123, quest: { completed_count: 19, no_hint_count: 0 }, unlocks: [], owned: [], gifts: [], points: { total: 190, week: 20 }, records: {}, active: [], unread: 0, family_role: 'guardian' };
    let failSave = false;
    const writes: any[] = [];
    const user = { id: uid, email: 'test@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
    await context.addInitScript(({ user }) => {
      if (!localStorage.getItem('sb-localhost-auth-token')) localStorage.setItem('sb-localhost-auth-token', JSON.stringify({ access_token: 'mock-access', refresh_token: 'mock-refresh', expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, token_type: 'bearer', user }));
    }, { user });
    await context.route('http://localhost:54321/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      let body: unknown = null;
      if (path.endsWith('/my_profiles')) body = [{ ...state.profile, mine: true }];
      else if (path.endsWith('/get_state')) body = state;
      else if (path.endsWith('/list_feed')) body = [];
      else if (path.endsWith('/user')) body = user;
      else if (path.endsWith('/start_attempt')) body = { id: 'test-attempt', puzzle_id: 'test-puzzle', size: 4, difficulty: 'intro', givens: '.234341221434321', board: '.234341221434321', notes: {}, revision: 0, hints_used: 0 };
      else if (path.endsWith('/open_attempt')) body = { played_sec: 30 };
      else if (path.endsWith('/pause_attempt')) body = null;
      else if (path.endsWith('/save_attempt')) body = { revision: 1 };
      else if (path.endsWith('/complete_attempt')) {
        assert.equal(route.request().postDataJSON().board, '1234341221434321');
        state.quest.completed_count = 20;
        body = { completed_count: 20, reward: 10, balance: 123, points: 190, size: 4, difficulty: 'intro', elapsed: 30, no_hint: true, hints_used: 0 };
      }
      else if (path.endsWith('/update_profile')) {
        const payload = route.request().postDataJSON();
        writes.push(payload);
        assert.equal(payload.p, pid);
        assert.deepEqual(Object.keys(payload.patch), ['settings']);
        assert.equal(payload.patch.settings.showTimer, true);
        if (failSave) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'network', details: '연결이 끊겼어요. 다시 시도해 주세요.' }) });
        state.profile.settings = payload.patch.settings;
      } else throw new Error(`Unexpected API: ${path}`);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const home = () => page.locator('.tabbar').getByRole('button', { name: '홈', exact: true }).click();
    const album = () => page.getByRole('button', { name: /신화 여행첩/ }).click();
    const openFirst = () => page.locator('.collection-set').filter({ hasText: '세상의 첫빛' }).click();
    await page.goto('http://127.0.0.1:4175/sudoku/');
    await page.locator('.me-card').waitFor();
    await album(); await openFirst();
    assert.equal(await page.locator('.collection-card.owned').count(), 3);
    assert.equal(await page.getByRole('button', { name: '세트를 완성하면 열려요' }).isDisabled(), true);
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    state.quest.completed_count = 20;
    await page.reload(); await page.locator('.me-card').waitFor();
    await album(); await openFirst();
    assert.equal(await page.locator('.collection-card.owned').count(), 4);
    // Failed persistence must not equip a background or report success.
    failSave = true;
    await page.getByRole('button', { name: '홈 배경으로 쓰기' }).click();
    await page.locator('.error-line').waitFor();
    assert.equal(state.profile.settings.collectionBackdrop, undefined);
    failSave = false;
    await page.getByRole('button', { name: '홈 배경으로 쓰기' }).click();
    await page.getByRole('button', { name: '홈에 펼쳐 둔 배경' }).waitFor();
    assert.equal(state.profile.settings.collectionBackdrop, 'genesis');
    await page.screenshot({ path: `${OUT}/set-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: '닫기', exact: true }).click(); await home();
    await page.locator('.collection-home-art img').waitFor();
    await page.reload(); await page.locator('.collection-home-art img').waitFor();
    await page.screenshot({ path: `${OUT}/home-${width}.png`, fullPage: true });
    // Backfill and cross-device state: ignore an older local preference.
    state.quest.completed_count = 70;
    state.profile.settings.collectionBackdrop = 'olympus';
    await page.reload(); await page.locator('.collection-home-art img').waitFor();
    assert.match(await page.locator('.collection-home-art img').getAttribute('src') ?? '', /olympus.webp/);
    await album();
    assert.match(await page.locator('.collection-totals').innerText(), /10\/24/);
    await page.screenshot({ path: `${OUT}/album-${width}.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.getByRole('button', { name: '기본으로', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.collection-current'));
    await home(); assert.equal(await page.locator('.collection-home-art').count(), 0);
    // A forged locked preference must never render.
    state.quest.completed_count = 0; state.profile.settings.collectionBackdrop = 'homecoming';
    await page.reload(); await page.locator('.me-card').waitFor();
    assert.equal(await page.locator('.collection-home-art').count(), 0);
    await album(); assert.match(await page.locator('.collection-totals').innerText(), /0\/24/);
    state.quest.completed_count = 500;
    await page.reload(); await page.locator('.me-card').waitFor(); await album();
    assert.match(await page.locator('.collection-totals').innerText(), /24\/24/);
    assert.match(await page.locator('.collection-totals').innerText(), /6\/6/);
    state.quest.completed_count = 19;
    state.profile.settings.collectionBackdrop = '';
    await page.reload(); await page.locator('.me-card').waitFor();
    await page.getByRole('button', { name: '스도쿠 하러 가기' }).click();
    await page.getByRole('button', { name: /4×4 입문/ }).click();
    await page.locator('.board .cell').first().click();
    await page.getByRole('button', { name: '1 넣기', exact: true }).click();
    await page.getByRole('heading', { name: '다 풀었어요!' }).waitFor();
    assert.equal(await page.locator('.collection-result').count(), 2);
    assert.match(await page.locator('.collection-result').last().innerText(), /세트 완성/);
    await page.screenshot({ path: `${OUT}/result-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: '여행첩에서 보상 보기' }).click();
    await page.locator('.collection-totals').waitFor();
    assert.match(await page.locator('.collection-totals').innerText(), /4\/24/);
    assert.deepEqual(errors, []);
    assert.equal(state.balance, 123); assert.equal(state.points.total, 190);
    console.log(`PASS ${width}px: locks, 20-game set reward, save failure/retry, persistence, 70-game backfill, reset, forged preference, 500-game completion, puzzle completion → two rewards → album; ${writes.length} settings requests`);
    await context.close();
  }
} finally { await browser.close(); server.kill(); }
