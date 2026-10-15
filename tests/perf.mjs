// 重さの計測：終盤（敵が多い状態）で、1フレームあたりの処理時間（ゲームの中身＋描画の準備）を測る。
// ヘッドレスのChromiumはソフトウェア描画なので、GPU描画の速さは測れない（CPU側の目安）。
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff': 'font/woff' };
const server = createServer((req, res) => {
  const p = normalize(join(ROOT, req.url.split('?')[0] === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0])));
  if (!p.startsWith(normalize(ROOT)) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/?test=1`);
await page.waitForFunction(() => window.__test && window.__test.scene() === 'Title', null, { timeout: 15000 });
await page.evaluate(() => window.__test.start('free', 4242));
await page.waitForFunction(() => window.__test.scene() === 'Game');
// 群れの予告（青い矢印）のスクショ：58秒あたり
await page.evaluate(() => { const g = window.__gameScene; for (let i = 0; i < 400 && g.s.t < 58.3; i++) { window.advanceTime(200); g.s.hero.hp = g.s.hero.maxHp; if (g.s.status === 'levelup') window.__test.choose(0); } });
await page.waitForTimeout(250);
await page.screenshot({ path: join(ROOT, 'test-output', '15_wave_warn.png') });
const out = await page.evaluate(async () => {
  const g = window.__gameScene;
  for (let i = 0; i < 700 && g.s.t < 285; i++) {
    const a = i * 0.05; window.__test.input(Math.cos(a) * 0.7, Math.sin(a) * 0.7);
    window.advanceTime(400);
    g.s.hero.hp = g.s.hero.maxHp; // 計測のため倒れないようにする
    if (g.s.status === 'levelup') window.__test.choose(0);
  }
  const times = [];
  for (let i = 0; i < 120; i++) {
    const t0 = performance.now(); window.advanceTime(1000 / 60); times.push(performance.now() - t0);
    g.s.hero.hp = g.s.hero.maxHp;
    if (g.s.status === 'levelup') window.__test.choose(0);
  }
  times.sort((a, b) => a - b);
  return { t: Math.round(g.s.t), enemies: g.s.enemies.length, drops: g.s.drops.length, proj: g.s.projectiles.length, median: times[60].toFixed(2), p95: times[114].toFixed(2), level: g.s.hero.level };
});
console.log(JSON.stringify(out));
// ボス戦のスクショ
await page.evaluate(() => {
  const g = window.__gameScene;
  for (let i = 0; i < 100 && g.s.t < 312; i++) { window.advanceTime(250); g.s.hero.hp = g.s.hero.maxHp; if (g.s.status === 'levelup') window.__test.choose(0); }
});
await page.waitForTimeout(300);
await page.screenshot({ path: join(ROOT, 'test-output', '13_boss.png') });
await page.evaluate(() => { const g = window.__gameScene; g.s.hero.hp = 1; for (let i = 0; i < 40; i++) { if (g.s.boss && g.s.boss.phase === 'dizzy') break; window.advanceTime(100); g.s.hero.hp = g.s.hero.maxHp; if (g.s.status === 'levelup') window.__test.choose(0); } });
await page.waitForTimeout(200);
await page.screenshot({ path: join(ROOT, 'test-output', '14_boss_dizzy.png') });
await browser.close(); server.close();
