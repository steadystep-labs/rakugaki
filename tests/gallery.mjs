// 調査用：生成した落書きテクスチャを一覧にして test-output/gallery.png に保存する
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
const page = await (await browser.newContext({ viewport: { width: 720, height: 1280 } })).newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/?test=1`);
await page.waitForFunction(() => window.__test && window.__test.scene() === 'Title', null, { timeout: 15000 });
await page.evaluate(() => {
  const scene = window.__test && Phaser_scene();
  function Phaser_scene() { return document.querySelector('canvas') && window.__phaserGame; }
});
const keys = ['hero', 'crumb', 'runner', 'lump', 'spitter', 'boss', 'pencilShot', 'plane', 'needle', 'enemyShot', 'xp', 'ink', 'scrap', 'splash', 'crayon', 'smudge', 'rulerIcon', 'star', 'heart', 'joyKnob'];
const html = await page.evaluate(async (keys) => {
  const out = [];
  const tm = window.__gameTextures;
  for (const k of keys) {
    for (let f = 0; f < 3; f++) {
      const src = tm.get(`${k}_${f}`).getSourceImage();
      const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
      c.getContext('2d').drawImage(src, 0, 0);
      out.push({ k: `${k}_${f}`, url: c.toDataURL() });
    }
  }
  return out;
}, keys);
const p2 = await (await browser.newContext({ viewport: { width: 900, height: 1400 }, deviceScaleFactor: 1 })).newPage();
await p2.setContent(`<body style="margin:0;background:#eef;display:flex;flex-wrap:wrap;gap:8px;padding:8px">${html.map((h) => `<div style="background:#fff;border:1px solid #f00;font:10px sans-serif"><img src="${h.url}"><br>${h.k}</div>`).join('')}</body>`);
await p2.screenshot({ path: join(ROOT, 'test-output', 'gallery.png'), fullPage: true });
await browser.close(); server.close();
console.log('gallery saved');
