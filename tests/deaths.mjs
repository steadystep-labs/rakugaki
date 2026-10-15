// 調査用：逃げるボットが「いつ・何に」やられたかを表示する。 node tests/deaths.mjs [回数]
import { createSim, STEP } from '../src/core/sim.js';
import { bots, pickChoice } from './bots.mjs';

const N = Number(process.argv[2]) || 8;
for (let i = 0; i < N; i++) {
  const sim = createSim({ seed: 1000 + i * 7919, mode: 'free', meta: {} });
  const bot = bots[process.argv[3] || 'flee'](1000 + i * 7919);
  const st = sim.state;
  const hurts = {};
  let last = null;
  for (let f = 0; f < 420 / STEP && (st.status === 'playing' || st.status === 'levelup'); f++) {
    if (st.status === 'levelup') { sim.choose(pickChoice(st.choices)); continue; }
    sim.step(bot(st));
    for (const ev of sim.drainEvents()) {
      if (ev.type !== 'hurt') continue;
      let src = 'hazard', bd = 50 * 50;
      for (const e of st.enemies) { const d = (e.x - ev.x) ** 2 + (e.y - ev.y) ** 2; if (d < bd) { bd = d; src = e.type; } }
      for (const p of st.projectiles) if (p.team === 'enemy') { const d = (p.x - ev.x) ** 2 + (p.y - ev.y) ** 2; if (d < bd) { bd = d; src = 'shot'; } }
      hurts[src] = (hurts[src] || 0) + 1;
      last = `${src}@${st.t.toFixed(0)}s`;
    }
  }
  console.log(st.status, `${st.t.toFixed(0)}s`, `Lv${st.hero.level}`, 'last:', last, 'hurts:', JSON.stringify(hurts), 'build:', st.weapons.map((w) => w.id + w.lv).join(','), st.passives.map((p) => p.id + p.lv).join(','));
}
