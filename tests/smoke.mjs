// スモークテスト：実際のブラウザ（Playwright・Chromium）でゲームを遊んで確かめる。
// 起動 → タイトル → 自由帳（移動・レベルアップ）→ 結果 → 今日のページ → 全画面の表示 → セーブ（保存・再読み込み・壊れたセーブ）
// スクショは test-output/ に保存する。コンソールのエラーが1つでもあれば失敗。
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const OUT = join(ROOT, 'test-output');
mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.png': 'image/png', '.json': 'application/json' };
const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let p = normalize(join(ROOT, url === '/' ? 'index.html' : url));
  if (!p.startsWith(normalize(ROOT)) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log(`${cond ? 'OK ' : 'NG '} ${msg}`); };

const browser = await chromium.launch();
async function newPage(viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...opts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) page.errors.push(`外部への通信: ${r.url()}`); });
  return page;
}
const waitScene = (page, key) => page.waitForFunction((k) => window.__test && window.__test.scene() === k, key, { timeout: 15000 });
const state = async (page) => JSON.parse(await page.evaluate(() => window.render_game_to_text()));

try {
  // ---------- スマホ縦 ----------
  const page = await newPage({ width: 390, height: 844 }, { isMobile: true, hasTouch: true });
  await page.goto(`${BASE}/?test=1&date=2026-10-13`);
  await waitScene(page, 'Title');
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, '01_title.png') });
  check(true, 'タイトル画面が表示される');

  // 自由帳：円を描くように動きながら90秒
  await page.evaluate(() => window.__test.start('free', 12345));
  await waitScene(page, 'Game');
  let s = await state(page);
  check(s.status === 'playing' && s.hero.hp === s.hero.maxHp, '自由帳が始まる');
  let levelUps = 0, sawLevelUpUi = false;
  for (let i = 0; i < 225; i++) {
    await page.evaluate((a) => { window.__test.input(Math.cos(a) * 0.85, Math.sin(a) * 0.85); window.advanceTime(400); }, i * 0.07);
    s = await state(page);
    if (s.status === 'levelup') {
      if (!sawLevelUpUi) {
        await page.waitForTimeout(350);
        await page.screenshot({ path: join(OUT, '02_levelup.png') });
        sawLevelUpUi = (await state(page)).ui.levelUpOpen;
      }
      if (levelUps === 0) {
        const joyId = await page.evaluate(() => window.__test.chooseHolding(0));
        check(joyId === 99, 'レベルアップで選んだ指が、そのままスティックになる');
      } else {
        await page.evaluate(() => window.__test.choose(0));
      }
      levelUps++;
    }
    if (s.status === 'dead' || s.status === 'clear') break;
    if (i === 110) { await page.waitForTimeout(200); await page.screenshot({ path: join(OUT, '03_play_45s.png') }); }
  }
  check(levelUps >= 3, `レベルアップが起きて選べる（${levelUps}回）`);
  check(sawLevelUpUi, 'レベルアップの選択画面が開く');
  check(s.weapons.length >= 2 || s.passives.length >= 1, `武器か能力が増える（${s.weapons.join(',')} / ${s.passives.join(',')}）`);
  check(s.counts.enemies > 0, `敵が出ている（${s.counts.enemies}体）`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(OUT, '04_play_late.png') });

  // やられる → 結果画面
  const inkBefore = (await page.evaluate(() => window.__test.save())).ink;
  await page.evaluate(() => window.__test.finish('dead'));
  await waitScene(page, 'Result');
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, '05_result.png') });
  const saveAfter = await page.evaluate(() => window.__test.save());
  check(saveAfter.stats.runs === 1, '結果がセーブに記録される');
  check(saveAfter.ink >= inkBefore, `インクが持ち帰られる（${inkBefore} → ${saveAfter.ink}）`);

  // 今日のページ（異変つき）
  await page.evaluate(() => window.__test.start('daily', 999, 'dark'));
  await waitScene(page, 'Game');
  for (let i = 0; i < 25; i++) await page.evaluate((a) => { window.__test.input(Math.cos(a), Math.sin(a)); window.advanceTime(400); const o = JSON.parse(window.render_game_to_text()); if (o.status === 'levelup') window.__test.choose(1); }, i * 0.2);
  s = await state(page);
  check(s.mode === 'daily' && s.anomaly === 'dark', '今日のページ（まっくら）が動く');
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(OUT, '06_daily_dark.png') });
  await page.evaluate(() => window.__test.finish('dead'));
  await waitScene(page, 'Result');
  const daily = (await page.evaluate(() => window.__test.save())).daily;
  check(daily.date === '2026-10-13' && daily.result, '今日のページの本番結果が記録される');

  // クリアした場合：「クリアのあと、どうなってほしい？」が出る
  await page.evaluate(() => window.__test.start('free', 4321));
  await waitScene(page, 'Game');
  await page.evaluate(() => window.__test.finish('clear'));
  await waitScene(page, 'Result');
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, '05b_result_clear.png') });
  const box2 = await page.locator('canvas').boundingBox();
  await page.mouse.click(box2.x + 360 * (box2.width / 720), box2.y + 905 * (box2.height / 1280));
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, '05c_after_clear_ask.png') });
  check(true, 'クリア後に「どうなってほしい？」の画面が開く（スクショで確認）');

  // ほかの画面
  for (const [key, file] of [['Shop', '07_shop'], ['Note', '08_note'], ['Settings', '09_settings'], ['Title', '10_title_after']]) {
    await page.evaluate((k) => window.__test.goto(k), key);
    await waitScene(page, key);
    await page.waitForTimeout(350);
    await page.screenshot({ path: join(OUT, `${file}.png`) });
  }
  check(true, 'ふでばこ・ノート・せってい・タイトルが開く');

  // 再読み込みでセーブが残る
  const beforeReload = await page.evaluate(() => window.__test.save());
  await page.reload();
  await waitScene(page, 'Title');
  const reloaded = await page.evaluate(() => window.__test.save());
  check(reloaded.stats.runs === beforeReload.stats.runs && reloaded.stats.runs >= 3 && reloaded.ink === beforeReload.ink, `再読み込みしてもセーブが残る（${reloaded.stats.runs}回・インク${reloaded.ink}）`);

  // 壊れたセーブ → 前回の正常なセーブに戻る／なければ初期状態で起動
  await page.evaluate(() => localStorage.setItem('rakugaki.save', '{broken'));
  await page.reload();
  await waitScene(page, 'Title');
  const recovered = await page.evaluate(() => window.__test.save());
  check(recovered.version === 1, '壊れたセーブでも起動する（バックアップから復旧）');

  // 古い形式（version 0）の読み込み：今は移行処理がないので初期状態にフォールバックすること
  await page.evaluate(() => { localStorage.setItem('rakugaki.save', JSON.stringify({ version: 0, ink: 5 })); localStorage.removeItem('rakugaki.save.bak'); });
  await page.reload();
  await waitScene(page, 'Title');
  check((await page.evaluate(() => window.__test.save())).version === 1, '移行できない古いセーブでも起動する');

  check(page.errors.length === 0, `コンソールにエラーがない${page.errors.length ? '：' + page.errors.slice(0, 3).join(' / ') : ''}`);

  // ---------- PC横 ----------
  const pc = await newPage({ width: 1280, height: 800 });
  await pc.goto(`${BASE}/?test=1`);
  await waitScene(pc, 'Title');
  await pc.waitForTimeout(400);
  await pc.screenshot({ path: join(OUT, '11_pc_title.png') });
  check(pc.errors.length === 0, `PCでもエラーがない${pc.errors.length ? '：' + pc.errors.slice(0, 3).join(' / ') : ''}`);

  // ---------- 実際のタップ操作（テスト用の差し込み口を使わない） ----------
  const real = await newPage({ width: 390, height: 844 }, { isMobile: true, hasTouch: true });
  await real.goto(`${BASE}/`);
  await real.waitForTimeout(3000);
  const box = await real.locator('canvas').boundingBox();
  const sx = box.width / 720, sy = box.height / 1280;
  await real.mouse.click(box.x + 360 * sx, box.y + 760 * sy); // 自由帳であそぶ
  await real.waitForTimeout(1200);
  await real.mouse.move(box.x + 360 * sx, box.y + 900 * sy);
  await real.mouse.down();
  await real.mouse.move(box.x + 430 * sx, box.y + 900 * sy, { steps: 5 });
  await real.waitForTimeout(1500);
  await real.mouse.up();
  await real.screenshot({ path: join(OUT, '12_real_input.png') });
  check(real.errors.length === 0, `実際の操作でもエラーがない${real.errors.length ? '：' + real.errors.slice(0, 3).join(' / ') : ''}`);
} catch (e) {
  failures.push(`例外: ${e.message}`);
  console.log('NG 例外', e);
} finally {
  await browser.close();
  server.close();
}

console.log(failures.length ? `SMOKE NG (${failures.length})` : 'SMOKE OK');
process.exit(failures.length ? 1 : 0);
