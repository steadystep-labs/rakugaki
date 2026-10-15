// バランス監視：3種類のボットに固定シードで遊ばせて、生存時間などを測る。
// 使い方：
//   node tests/balance.mjs            → 基準（tests/balance-baseline.json）と比べる
//   node tests/balance.mjs --update   → 今の結果を基準として保存する
//   node tests/balance.mjs --runs 10  → 1ボットあたりの回数を変える
import { createSim, STEP } from '../src/core/sim.js';
import { bots, pickChoice } from './bots.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const RUNS = Number(args[args.indexOf('--runs') + 1]) || 30;
const UPDATE = args.includes('--update');
const MAX_SECONDS = 420;
const BASELINE = new URL('./balance-baseline.json', import.meta.url);
const TOLERANCE = 0.2;

function runOne(botName, seed, meta) {
  const sim = createSim({ seed, mode: 'free', meta, collectEvents: false });
  const bot = bots[botName](seed);
  const s = sim.state;
  let firstLevelUp = null;
  const maxFrames = MAX_SECONDS / STEP;
  for (let f = 0; f < maxFrames && (s.status === 'playing' || s.status === 'levelup'); f++) {
    if (s.status === 'levelup') {
      if (firstLevelUp === null) firstLevelUp = s.t;
      sim.choose(pickChoice(s.choices));
      continue;
    }
    sim.step(bot(s));
  }
  return { time: s.t, clear: s.status === 'clear', level: s.hero.level, kills: s.hero.kills, firstLevelUp, ink: s.hero.ink };
}

const median = (a) => { const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const r1 = (x) => Math.round(x * 10) / 10;

const MAX_META = { hp: 5, dmg: 5, spd: 5, range: 5, revive: 1 };
const MID_META = { hp: 2, dmg: 2, spd: 1, range: 1, revive: 0 };
const configs = [
  ['idle', {}], ['random', {}], ['flee', {}], ['flee+meta', MAX_META],
  ['clumsy', {}], ['clumsy+mid', MID_META], ['clumsy+meta', MAX_META],
];

const results = {};
const started = Date.now();
for (const [name, meta] of configs) {
  const botName = name.split('+')[0];
  const rows = [];
  for (let i = 0; i < RUNS; i++) rows.push(runOne(botName, 1000 + i * 7919, meta));
  results[name] = {
    medianTime: r1(median(rows.map((r) => r.time))),
    clearRate: r1((rows.filter((r) => r.clear).length / RUNS) * 100),
    medianLevel: median(rows.map((r) => r.level)),
    medianFirstLevelUp: r1(median(rows.map((r) => r.firstLevelUp ?? 999))),
    medianKills: median(rows.map((r) => r.kills)),
    medianInk: median(rows.map((r) => r.ink)),
  };
  console.log(name.padEnd(10), JSON.stringify(results[name]));
}
console.log(`(${RUNS} runs each, ${((Date.now() - started) / 1000).toFixed(1)}s)`);

if (UPDATE) {
  writeFileSync(BASELINE, JSON.stringify({ runs: RUNS, results }, null, 2));
  console.log('baseline updated');
} else if (existsSync(BASELINE)) {
  const base = JSON.parse(readFileSync(BASELINE, 'utf8')).results;
  let ok = true;
  for (const name of Object.keys(results)) {
    const b = base[name]?.medianTime, c = results[name].medianTime;
    if (b === undefined) continue;
    const diff = Math.abs(c - b) / Math.max(1, b);
    if (diff > TOLERANCE) { ok = false; console.log(`NG ${name}: medianTime ${b} -> ${c} (${(diff * 100).toFixed(0)}%)`); }
  }
  console.log(ok ? 'BALANCE OK' : 'BALANCE NG');
  process.exit(ok ? 0 : 1);
}
