// 調査用：終盤のしずくが見えている時間と、演出の数の上限に引っかかった数を測る。 node tests/drops.mjs
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff': 'font/woff' };
const server = createServer((req, res) => { const p = normalize(join(ROOT, req.url.split('?')[0] === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]))); if (!existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); });
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/?test=1`);
await page.waitForFunction(() => window.__test && window.__test.scene() === 'Title', null, { timeout: 15000 });
await page.evaluate(() => window.__test.start('free', 31));
await page.waitForFunction(() => window.__test.scene() === 'Game');
const rows = await page.evaluate(() => {
  const g = window.__gameScene, out = [];
  let picks = 0;
  // 220秒まで早送り（強化最大相当にするため、武器を選び続ける）
  for (let i = 0; i < 3000 && g.s.t < 215; i++) {
    const a = i * 0.03; window.__test.input(Math.cos(a) * 0.8, Math.sin(a * 0.7) * 0.8);
    window.advanceTime(100); g.s.hero.hp = g.s.hero.maxHp;
    if (g.s.status === 'levelup') window.__test.choose(picks++ % 3);
  }
  // ここから実時間と同じ刻み（1/60秒）で4秒ぶん進めて、演出の数と、しずくが見えている時間を測る
  const orig = g.burst.bind(g);
  let bursts = 0, rejectedSplash = 0, splashOk = 0;
  g.burst = (x, y, key, n, opts) => {
    bursts++;
    const before = g.particles.length;
    orig(x, y, key, n, opts);
    if (key === 'splash') { const made = g.particles.length - before; splashOk += made; rejectedSplash += n - made; }
  };
  const seenAt = new Map(); const lifetimes = [];
  let maxParticles = 0, kills = 0;
  for (let i = 0; i < 240; i++) {
    const a = i * 0.05; window.__test.input(Math.cos(a) * 0.8, Math.sin(a) * 0.8);
    window.advanceTime(1000 / 60); g.s.hero.hp = g.s.hero.maxHp;
    if (g.s.status === 'levelup') window.__test.choose(0);
    maxParticles = Math.max(maxParticles, g.particles.length);
    const now = g.s.t;
    const ids = new Set(g.s.drops.filter((d) => d.kind === 'xp').map((d) => d.id));
    for (const id of ids) if (!seenAt.has(id)) seenAt.set(id, now);
    for (const [id, t0] of seenAt) if (!ids.has(id)) { lifetimes.push(now - t0); seenAt.delete(id); }
  }
  lifetimes.sort((x, y) => x - y);
  return [{ t: Math.round(g.s.t), level: g.s.hero.level, passives: g.s.passives.map((p) => p.id + p.lv).join(','), pickupMul: +g.s.mods.pickupMul.toFixed(2), maxParticles, splashOk, rejectedSplash,
    dropsSeen: lifetimes.length, medianLifeSec: lifetimes.length ? +lifetimes[lifetimes.length >> 1].toFixed(2) : null, under02: lifetimes.filter((x) => x < 0.2).length }];
});
for (const r of rows) console.log(JSON.stringify(r));
await browser.close(); server.close();
