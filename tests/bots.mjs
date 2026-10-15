// バランス監視・調査用のボット（balance.mjs と deaths.mjs で共有）
import { STEP } from '../src/core/sim.js';
import { createRng } from '../src/core/rng.js';

export const PRIORITY = ['pencil', 'compass', 'crayonBlue', 'plane', 'ruler', 'sharp', 'quick', 'bandage', 'magnet', 'shoes', 'margin'];
export function pickChoice(choices) {
  let best = 0, bestScore = Infinity;
  choices.forEach((c, i) => {
    const p = PRIORITY.indexOf(c.id);
    const score = c.kind === 'heal' ? 50 : c.kind === 'ink' ? 60 : p < 0 ? 40 : p;
    if (score < bestScore) { bestScore = score; best = i; }
  });
  return best;
}

export const bots = {
  idle: () => () => ({ x: 0, y: 0 }),
  random: (seed) => {
    const r = createRng(seed ^ 0x9e3779b9);
    let dir = { x: 0, y: 0 }, t = 0;
    return (s) => {
      t -= STEP;
      if (t <= 0) { const a = r.range(0, Math.PI * 2); dir = { x: Math.cos(a), y: Math.sin(a) }; t = 1; }
      return dir;
    };
  },
  flee: () => (s) => {
    const h = s.hero;
    let fx = 0, fy = 0;
    for (const e of s.enemies) {
      const dx = h.x - e.x, dy = h.y - e.y, d2 = dx * dx + dy * dy;
      const range = 320 + e.r;
      if (d2 < range * range) { const d = Math.sqrt(d2) || 1; const w = (e.type === 'boss' ? 4 : 1) / (d * d); fx += dx / d * w * 1e4; fy += dy / d * w * 1e4; }
    }
    for (const p of s.projectiles) {
      if (p.team !== 'enemy') continue;
      const dx = h.x - p.x, dy = h.y - p.y, d2 = dx * dx + dy * dy;
      if (d2 < 160 * 160) { const d = Math.sqrt(d2) || 1; fx += dx / d * 3; fy += dy / d * 3; }
    }
    for (const z of s.hazards) {
      const dx = h.x - z.x, dy = h.y - z.y, d2 = dx * dx + dy * dy;
      if (d2 < 120 * 120) { const d = Math.sqrt(d2) || 1; fx += dx / d * 4; fy += dy / d * 4; }
    }
    // 近くのしずくへ寄る（危険が大きいときは弱める）
    const danger = Math.hypot(fx, fy);
    let best = null, bd = 300 * 300;
    for (const d of s.drops) { const dd = (d.x - h.x) ** 2 + (d.y - h.y) ** 2; if (dd < bd) { bd = dd; best = d; } }
    if (best) { const dd = Math.sqrt(bd) || 1; const w = 0.6 / (1 + danger); fx += (best.x - h.x) / dd * w; fy += (best.y - h.y) / dd * w; }
    // 中心から離れすぎない
    fx += -h.x * 0.0003; fy += -h.y * 0.0003;
    const m = Math.hypot(fx, fy);
    return m > 0.05 ? { x: fx / m, y: fy / m } : { x: 0, y: 0 };
  },
  // 人間に近いボット：0.25秒ごとにしか方向を変えず、少しぶれる。真後ろの敵には気づきにくい
  clumsy: (seed) => {
    const r = createRng(seed ^ 0x51ed27);
    const flee = bots.flee();
    let dir = { x: 0, y: 0 }, t = 0;
    return (s) => {
      t -= STEP;
      if (t <= 0) {
        t = 0.25;
        const d = flee(s);
        const a = Math.atan2(d.y, d.x) + r.range(-0.6, 0.6);
        const m = Math.hypot(d.x, d.y) > 0 ? 1 : 0;
        dir = { x: Math.cos(a) * m, y: Math.sin(a) * m };
      }
      return dir;
    };
  },
};
