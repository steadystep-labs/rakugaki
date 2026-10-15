// 効果音はすべてWebAudioで合成する（音声ファイルなし）。
// 同じ音の連打は少し音程を揺らし、短い間隔の重複は間引く。

let ctx = null;
let master = null;
let noiseBuf = null;
let enabled = true;
const lastPlayed = {};

export function setSoundEnabled(on) {
  enabled = on;
  if (master) master.gain.value = on ? 0.55 : 0;
}

// 最初のタップで呼ぶ（ブラウザは操作前に音を鳴らせないため）
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = enabled ? 0.55 : 0;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp).connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) { /* 音が使えない環境では無音で続ける */ }
}

function ready(name, gapMs) {
  if (!ctx || !enabled) return false;
  const now = performance.now();
  if (lastPlayed[name] && now - lastPlayed[name] < gapMs) return false;
  lastPlayed[name] = now;
  return true;
}

const vary = (v, amt = 0.06) => v * (1 + (Math.random() * 2 - 1) * amt);

function env(g, t, a, peak, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
}

function tone(type, freq, dur, peak, { to = null, at = 0, attack = 0.005 } = {}) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  env(g, t, attack, peak, dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + attack + dur + 0.02);
}

function noise(dur, peak, { type = 'bandpass', freq = 2000, q = 1, to = null, at = 0 } = {}) {
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = vary(1, 0.1);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, 0.003, peak, dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.3);
  src.stop(t + dur + 0.05);
}

export const sfx = {
  shoot() { if (ready('shoot', 70)) noise(0.035, 0.12, { type: 'highpass', freq: vary(4200) }); },
  swing() { if (ready('swing', 90)) noise(0.16, 0.22, { freq: 600, to: 2600, q: 2 }); },
  hit() { if (ready('hit', 45)) { tone('sine', vary(170), 0.07, 0.18, { to: 70 }); noise(0.04, 0.08, { freq: 900 }); } },
  kill() { if (ready('kill', 40)) { noise(0.09, 0.22, { freq: vary(1400, 0.2), q: 0.7 }); noise(0.06, 0.1, { freq: 3200, at: 0.03 }); } },
  pickup(combo = 0) {
    if (!ready('pickup', 35)) return;
    const f = 660 * Math.pow(2, Math.min(combo, 14) / 12);
    tone('sine', f, 0.06, 0.12, { to: f * 1.5 });
  },
  ink() { if (ready('ink', 80)) { tone('triangle', 440, 0.08, 0.15, { to: 330 }); tone('triangle', 660, 0.1, 0.1, { at: 0.05 }); } },
  levelup() {
    if (!ready('levelup', 200)) return;
    [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, 0.18, 0.18, { at: i * 0.07 }));
  },
  select() { if (ready('select', 60)) tone('sine', 880, 0.05, 0.14, { to: 1320 }); },
  hurt() { if (ready('hurt', 120)) { tone('square', 110, 0.16, 0.16, { to: 55 }); noise(0.12, 0.18, { freq: 500 }); } },
  boss() { if (ready('boss', 500)) { tone('sawtooth', 55, 1.1, 0.2, { to: 110, attack: 0.2 }); tone('sawtooth', 58, 1.1, 0.12, { to: 115, attack: 0.2 }); } },
  telegraph() { if (ready('telegraph', 300)) tone('square', 330, 0.25, 0.08, { to: 660 }); },
  charge() { if (ready('charge', 300)) noise(0.5, 0.25, { freq: 300, to: 1200, q: 0.8 }); },
  clear() {
    if (!ready('clear', 500)) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, 0.3, 0.2, { at: i * 0.1 }));
  },
  dead() { if (ready('dead', 500)) tone('triangle', 392, 0.6, 0.18, { to: 98, attack: 0.02 }); },
  wave() { if (ready('wave', 400)) { tone('square', 220, 0.12, 0.08); tone('square', 220, 0.12, 0.08, { at: 0.16 }); } },
};
