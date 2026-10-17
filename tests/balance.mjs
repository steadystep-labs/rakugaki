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
  let firstLevelUp = null, lateLevelUps = 0, hpAtBoss = null, lateHeal = 0, prevHp = s.hero.hp;
  const maxFrames = MAX_SECONDS / STEP;
  for (let f = 0; f < maxFrames && (s.status === 'playing' || s.status === 'levelup'); f++) {
    if (s.status === 'levelup') {
      if (firstLevelUp === null) firstLevelUp = s.t;
      if (s.t >= 240 && s.t < 300) lateLevelUps++;
      const before = s.hero.hp;
      sim.choose(pickChoice(s.choices));
      if (s.t >= 180 && s.hero.hp > before) lateHeal += s.hero.hp - before;
      prevHp = s.hero.hp;
      continue;
    }
    sim.step(bot(s));
    if (s.t >= 180 && s.hero.hp > prevHp) lateHeal += s.hero.hp - prevHp;
    prevHp = s.hero.hp;
    if (hpAtBoss === null && s.t >= 300) hpAtBoss = s.hero.hp / s.hero.maxHp;
  }
  return { time: s.t, clear: s.status === 'clear', level: s.hero.level, kills: s.hero.kills, firstLevelUp, ink: s.hero.ink, lateLevelUps, hpAtBoss, lateHeal };
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
    // 体感の指標：最後の1分（4:00〜5:00）のレベルアップ回数、ボスが出たときのHPの残り（届いた人だけ）、3:00以降に回復した量
    lateLevelUps: median(rows.filter((r) => r.time >= 300).map((r) => r.lateLevelUps).concat([]).length ? rows.filter((r) => r.time >= 300).map((r) => r.lateLevelUps) : [0]),
    hpAtBossPct: (() => { const v = rows.filter((r) => r.hpAtBoss !== null).map((r) => r.hpAtBoss); return v.length ? Math.round(median(v) * 100) : null; })(),
    lateHeal: Math.round(median(rows.map((r) => r.lateHeal))),
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
