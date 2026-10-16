// 公開URLの動作確認（公開・更新のあとに実行）： node tests/live.mjs [URL]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const URL0 = process.argv[2] || 'https://steadystep-labs.github.io/rakugaki/';
const ORIGIN = new URL(URL0).origin;
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const OUT = join(ROOT, 'test-output'); mkdirSync(OUT, { recursive: true });
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); console.log(`${c ? 'OK ' : 'NG '} ${m}`); };
const browser = await chromium.launch();
for (const [label, vp, opts] of [['スマホ', { width: 390, height: 844 }, { isMobile: true, hasTouch: true }], ['PC', { width: 1280, height: 800 }, {}]]) {
  const page = await (await browser.newContext({ viewport: vp, ...opts })).newPage();
  const errors = [], external = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(ORIGIN) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
  const res = await page.goto(URL0 + '?test=1');
  check(res.status() === 200, `${label}：ページが開く（${res.status()}）`);
  check(res.url().startsWith('https://'), `${label}：HTTPSで配信されている`);
  await page.waitForFunction(() => window.__test && window.__test.scene() === 'Title', null, { timeout: 30000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, `live_${label}_title.png`) });
  await page.evaluate(() => window.__test.start('free', 2026));
  await page.waitForFunction(() => window.__test.scene() === 'Game');
  for (let i = 0; i < 60; i++) await page.evaluate((a) => { window.__test.input(Math.cos(a), Math.sin(a)); window.advanceTime(250); const o = JSON.parse(window.render_game_to_text()); if (o.status === 'levelup') window.__test.choose(0); }, i * 0.1);
  const s = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  check(s.t > 10 && s.counts.enemies > 0, `${label}：ゲームが動く（${s.t}秒・敵${s.counts.enemies}体・Lv${s.hero.level}）`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, `live_${label}_play.png`) });
  check(errors.length === 0, `${label}：エラーがない${errors.length ? '：' + errors.slice(0, 2).join(' / ') : ''}`);
  check(external.length === 0, `${label}：外部への通信がない${external.length ? '：' + external.slice(0, 3).join(' / ') : ''}`);
}
await browser.close();
console.log(failures.length ? `LIVE NG (${failures.length})` : 'LIVE OK');
process.exit(failures.length ? 1 : 0);
