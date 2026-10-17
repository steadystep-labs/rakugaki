// 重さの計測（実際の時間の流れに近い形）：終盤まで進めてから、1フレームずつ進めて、
// フレーム時間・ゲームの中身・描画の時間・音の同時発音数を測る。CPUを遅くして、スマホに近い条件にする。
// 使い方： node tests/perf_real.mjs [CPUの遅さの倍率=4]
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const RATE = Number(process.argv[2]) || 4;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.png': 'image/png' };
const server = createServer((req, res) => { const p = normalize(join(ROOT, req.url.split('?')[0] === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]))); if (!existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); });
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', ...(process.env.GPU ? ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] : [])] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/?test=1`);
await page.waitForFunction(() => window.__test && window.__test.scene() === 'Title', null, { timeout: 30000 });
await page.evaluate(() => { window.__test.unlockAudio(); window.__test.start('free', 777); });
await page.waitForFunction(() => window.__test.scene() === 'Game');
// 終盤まで早送り（倒れないようにする）
await page.evaluate(() => { const g = window.__gameScene; let i = 0; while (g.s.t < 250 && i++ < 5000) { window.__test.input(Math.cos(i * 0.02), Math.sin(i * 0.017)); window.advanceTime(200); g.s.hero.hp = g.s.hero.maxHp; if (g.s.status === 'levelup') window.__test.choose(i % 3); } });
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
const r = await page.evaluate(() => new Promise((res) => {
  const g = window.__gameScene, game = g.game;
  const frame = [], simT = [], rendT = [];
  let last = performance.now(), n = 0, pre = 0;
  const a0 = window.__test.audio();
  game.events.on('prerender', () => { pre = performance.now(); });
  game.events.on('postrender', () => { if (pre) rendT.push(performance.now() - pre); });
  function f(t) {
    frame.push(t - last); last = t;
    const t0 = performance.now();
    const a = n * 0.05; window.__test.input(Math.cos(a) * 0.7, Math.sin(a) * 0.7);
    window.advanceTime(1000 / 60);
    simT.push(performance.now() - t0);
    g.s.hero.hp = g.s.hero.maxHp;
    if (g.s.status === 'levelup') window.__test.choose(0);
    if (++n < 360) requestAnimationFrame(f); else {
      const q = (arr, p) => { const b = [...arr].sort((x, y) => x - y); return +b[Math.floor(b.length * p)].toFixed(2); };
      const fr = frame.slice(30);
      const a1 = window.__test.audio();
      res({ t: Math.round(g.s.t), enemies: g.s.enemies.length, drops: g.s.drops.length, particles: g.particles.length,
        fps: +(1000 / (fr.reduce((x, y) => x + y, 0) / fr.length)).toFixed(1), frameP50: q(fr, 0.5), frameP95: q(fr, 0.95), slowFrames: fr.filter((x) => x > 33).length,
        simAndSyncP50: q(simT, 0.5), simAndSyncP95: q(simT, 0.95), renderP50: rendT.length ? q(rendT, 0.5) : null, renderP95: rendT.length ? q(rendT, 0.95) : null,
        audioMaxActive: a1.maxActive, soundsPerSec: +((a1.started - a0.started) / (fr.length / 60)).toFixed(1) });
    }
  }
  requestAnimationFrame(f);
}));
console.log(`CPU x${RATE}`, JSON.stringify(r));
await browser.close(); server.close();
