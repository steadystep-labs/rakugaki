// Xのアイコン（400×400）とヘッダー（1500×500）の画像を作る： node tools/brand.mjs
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff': 'font/woff' };
const server = createServer((req, res) => { const p = normalize(join(ROOT, decodeURIComponent(req.url.split('?')[0]))); if (!existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); });
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch();
for (const [kind, w, h, out] of [['icon', 800, 800, 'x-icon.png'], ['header', 1500, 500, 'x-header.png']]) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: kind === 'icon' ? 0.5 : 1 })).newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/tools/brand.html?kind=${kind}`);
  await page.waitForFunction(() => window.__brandReady === true, null, { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.locator('canvas').screenshot({ path: join(ROOT, 'assets', 'brand', out) });
  console.log('saved', out);
}
await browser.close(); server.close();
