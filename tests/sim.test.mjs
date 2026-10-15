// ゲームの中身（sim）の単体テスト。ブラウザ不要で速い。
import { createSim, STEP } from '../src/core/sim.js';

const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log(`${cond ? 'OK ' : 'NG '} ${msg}`); };

function run(seed, seconds, { invincible = false, meta = {}, input = (f) => ({ x: Math.cos(f / 120), y: Math.sin(f / 150) }), onStep } = {}) {
  const sim = createSim({ seed, meta, collectEvents: true });
  const s = sim.state;
  for (let f = 0; f < seconds / STEP && (s.status === 'playing' || s.status === 'levelup'); f++) {
    if (s.status === 'levelup') { sim.choose(0); continue; }
    if (invincible) s.hero.hp = s.hero.maxHp;
    sim.step(input(f));
    const ev = sim.drainEvents();
    if (onStep) onStep(s, ev);
  }
  return s;
}

// 1. 同じシードなら同じ展開
const a = run(77, 60), b = run(77, 60);
check(a.hero.kills === b.hero.kills && Math.round(a.hero.x) === Math.round(b.hero.x), '同じシードなら同じ展開になる');

// 2. 終盤でも、倒した場所にしずくが出る（上限・取り逃しのバグの再発防止）
// 強化最大・広く動き回る＝倒すペースが速く、取り逃しも多い（しずくが上限に届く状況）
let lateKills = 0, lateDropsNearKills = 0, maxDrops = 0;
run(11, 300, {
  invincible: true,
  meta: { hp: 5, dmg: 5, spd: 5, range: 0, revive: 0 },
  input: (f) => ({ x: Math.cos(f / 50), y: Math.sin(f / 37) }),
  onStep: (s, ev) => {
    maxDrops = Math.max(maxDrops, s.drops.length);
    if (s.t < 200) return;
    for (const e of ev) {
      if (e.type !== 'kill' || e.enemy === 'boss') continue;
      lateKills++;
      if (s.drops.some((d) => (d.x - e.x) ** 2 + (d.y - e.y) ** 2 < 170 * 170)) lateDropsNearKills++;
    }
  },
});
const rate = lateKills ? lateDropsNearKills / lateKills : 0;
check(lateKills > 100 && rate > 0.95, `終盤（200秒〜）でも倒した場所にしずくが出る（${lateDropsNearKills}/${lateKills}、しずくの最大数 ${maxDrops}）`);

// 2b. しずくは出てすぐ吸われない（見える時間がある）
let lifetimes = []; const born = new Map();
run(21, 260, {
  invincible: true,
  onStep: (s) => {
    if (s.t < 200) return;
    const ids = new Set();
    for (const d of s.drops) if (d.kind === 'xp') { ids.add(d.id); if (!born.has(d.id)) born.set(d.id, s.t); }
    for (const [id, t0] of born) if (!ids.has(id)) { lifetimes.push(s.t - t0); born.delete(id); }
  },
});
const instant = lifetimes.filter((x) => x < 0.2).length / Math.max(1, lifetimes.length);
check(lifetimes.length > 50 && instant < 0.1, `終盤のしずくが出た瞬間に吸われない（0.2秒未満で消えた割合 ${(instant * 100).toFixed(0)}%、10%未満）`);

// 3. 最初のレベルアップは10秒以内（動かなくても）
let firstLv = null;
run(5, 30, { input: () => ({ x: 0, y: 0 }), onStep: (s, ev) => { if (firstLv === null && ev.some((e) => e.type === 'levelup')) firstLv = s.t; } });
check(firstLv !== null && firstLv < 10, `最初のレベルアップが10秒以内（${firstLv?.toFixed(1)}秒）`);

// 4. ボスは5:00に出る
let bossAt = null;
run(9, 305, { invincible: true, onStep: (s, ev) => { if (bossAt === null && ev.some((e) => e.type === 'boss')) bossAt = s.t; } });
check(bossAt !== null && Math.abs(bossAt - 300) < 1, `ボスが5:00に出る（${bossAt?.toFixed(1)}秒）`);

console.log(failures.length ? `SIM TEST NG (${failures.length})` : 'SIM TEST OK');
process.exit(failures.length ? 1 : 0);
