// セキュリティの自動チェック（docs/03_security.md の禁止事項を機械的に見る）
// 見つかったら終了コード1で失敗する。vendor/（Phaser本体）は対象外。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|mjs|html|css)$/.test(name)) files.push(p);
  }
})(join(ROOT, 'src'));
files.push(join(ROOT, 'index.html'), join(ROOT, 'style.css'));

const RULES = [
  [/\bfetch\s*\(/, '通信処理（fetch）'],
  [/XMLHttpRequest/, '通信処理（XMLHttpRequest）'],
  [/WebSocket/, '通信処理（WebSocket）'],
  [/sendBeacon/, '通信処理（sendBeacon）'],
  [/EventSource/, '通信処理（EventSource）'],
  [/\bimport\s*\(\s*['"`]https?:/, '外部からのimport'],
  [/\beval\s*\(/, 'eval'],
  [/new\s+Function\s*\(/, 'new Function'],
  [/innerHTML|outerHTML|insertAdjacentHTML|document\.write/, 'HTMLの直接書き込み'],
  [/<script[^>]+src=["']https?:/i, '外部スクリプト'],
  [/<link[^>]+href=["']https?:/i, '外部の読み込み'],
  [/@import\s+url\(\s*['"]?https?:/i, '外部CSS'],
  [/document\.cookie/, 'Cookie'],
];
// 許可する外部URL（Xの投稿画面を開くリンクだけ）
const ALLOWED_URLS = ['https://x.com/intent/post'];

const problems = [];
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const [re, name] of RULES) if (re.test(line)) problems.push(`${f}:${i + 1} ${name}`);
    for (const m of line.matchAll(/https?:\/\/[^\s'"`)]+/g)) {
      if (!ALLOWED_URLS.some((u) => m[0].startsWith(u))) problems.push(`${f}:${i + 1} 許可されていないURL ${m[0]}`);
    }
  });
}

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
if (!csp) problems.push('index.html: CSPの<meta>がない');
else {
  for (const need of ["default-src 'self'", "script-src 'self'", "connect-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"]) {
    if (!csp[1].includes(need)) problems.push(`index.html: CSPに ${need} がない`);
  }
}

if (problems.length) {
  console.log('SECURITY CHECK NG');
  for (const p of problems) console.log('  ' + p);
  process.exit(1);
}
console.log(`SECURITY CHECK OK (${files.length} files)`);
