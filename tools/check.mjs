// セキュリティの自動チェック（docs/03_security.md の禁止事項を機械的に見る）
// 見つかったら終了コード1で失敗する。vendor/（Phaser本体）は対象外。
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
// 許可するURL（Xの投稿画面を開くリンクと、リンクカード用の自分のURL）
const ALLOWED_URLS = ['https://x.com/intent/post', 'https://steadystep-labs.github.io/rakugaki/'];

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
  for (const need of ["default-src 'self'", "script-src 'self'", "connect-src 'none'", "object-src 'none'", "frame-src 'none'", "worker-src 'none'", "base-uri 'none'", "form-action 'none'", 'upgrade-insecure-requests']) {
    if (!csp[1].includes(need)) problems.push(`index.html: CSPに ${need} がない`);
  }
}

// 同梱ライブラリが書き換えられていないか（npm の phaser@4.2.1 と同じ中身か）
const PHASER_SHA256 = 'f4c5fd140d118c10fa9090641a03c17303bab9bfdc28e0626296777db1bb1bde';
const vendor = join(ROOT, 'vendor', 'phaser.esm.min.js');
if (!existsSync(vendor)) problems.push('vendor/phaser.esm.min.js がない');
else if (createHash('sha256').update(readFileSync(vendor)).digest('hex') !== PHASER_SHA256) problems.push('vendor/phaser.esm.min.js の中身が記録と違う（改ざん・入れ替えの疑い）');

// GitHub Actions のワークフロー（GitHub公式のセキュリティ強化ガイドに準拠しているか）
const wfDir = join(ROOT, '.github', 'workflows');
if (existsSync(wfDir)) {
  for (const name of readdirSync(wfDir)) {
    const p = join(wfDir, name);
    const y = readFileSync(p, 'utf8');
    if (/^\s*pull_request_target\s*:/m.test(y)) problems.push(`${p}: pull_request_target は使わない`);
    if (!/permissions:\s*\n\s*contents:\s*read/.test(y)) problems.push(`${p}: permissions を contents: read にする`);
    if (/\$\{\{\s*secrets\./.test(y)) problems.push(`${p}: シークレットを使わない`);
    for (const m of y.matchAll(/uses:\s*([^\s#]+)/g)) {
      if (!/@[0-9a-f]{40}$/.test(m[1])) problems.push(`${p}: ${m[1]} をコミットSHAで固定する`);
    }
  }
}

// 公開してはいけないファイルが紛れていないか
if (existsSync(join(ROOT, '.env'))) problems.push('.env がリポジトリの中にある');

if (problems.length) {
  console.log('SECURITY CHECK NG');
  for (const p of problems) console.log('  ' + p);
  process.exit(1);
}
console.log(`SECURITY CHECK OK (${files.length} files)`);
