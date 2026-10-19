// 効果音はすべてWebAudioで合成する（音声ファイルなし）。
// 2026-10-16 作り直し：以前は鳴らすたびに発振器やフィルターを作っていて、終盤は同時に約400個の音が鳴り、
// スマホで音にノイズが入り、処理も重くなっていた。いまは最初に1回だけ音を作っておき（OfflineAudioContext）、
// 鳴らすときは「録音済みの音を再生するだけ」にする。さらに同時に鳴る数と、同じ音の間隔に上限をかける。

let ctx = null;
let master = null;
let enabled = true;
let buffers = null; // 名前 → AudioBuffer（または変化つきの配列）
const lastPlayed = {};
let windowStart = 0;
let windowCount = 0;

const MAX_VOICES = 10; // 同時に鳴らす数の上限
const LOW_PER_WINDOW = 4; // 細かい音（当たる・倒す・拾う・撃つ）は 0.1 秒あたり最大4回まで

// 同時に鳴っている音の数（調査・テスト用）
export const audioStats = { active: 0, maxActive: 0, started: 0, skipped: 0 };

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
      prerender(ctx.sampleRate).then((b) => { buffers = b; }, () => { buffers = null; });
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) { /* 音が使えない環境では無音で続ける */ }
}

// ---------- 音を1回だけ作る ----------
function makeNoise(c) {
  const b = c.createBuffer(1, Math.floor(c.sampleRate * 0.6), c.sampleRate);
  const d = b.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < d.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = (seed / 0x3fffffff) - 1; }
  return b;
}

function env(g, t, a, peak, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
}

function tone(c, out, type, freq, dur, peak, { to = null, at = 0, attack = 0.005 } = {}) {
  const t = at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  env(g, t, attack, peak, dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + attack + dur + 0.02);
}

function noise(c, out, nb, dur, peak, { type = 'bandpass', freq = 2000, q = 1, to = null, at = 0, offset = 0 } = {}) {
  const t = at;
  const src = c.createBufferSource();
  src.buffer = nb;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  f.Q.value = q;
  const g = c.createGain();
  env(g, t, 0.003, peak, dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, offset);
  src.stop(t + dur + 0.05);
}

// 名前 → [長さ(秒), 作り方]
const RECIPES = {
  shoot: [0.06, (c, o, n) => noise(c, o, n, 0.035, 0.12, { type: 'highpass', freq: 4200 })],
  swing: [0.2, (c, o, n) => noise(c, o, n, 0.16, 0.22, { freq: 600, to: 2600, q: 2 })],
  stamp: [0.18, (c, o, n) => { tone(c, o, 'sine', 140, 0.14, 0.24, { to: 60 }); noise(c, o, n, 0.05, 0.12, { freq: 700, q: 0.8 }); }],
  hit: [0.1, (c, o, n) => { tone(c, o, 'sine', 170, 0.07, 0.18, { to: 70 }); noise(c, o, n, 0.04, 0.08, { freq: 900 }); }],
  kill0: [0.14, (c, o, n) => { noise(c, o, n, 0.09, 0.22, { freq: 1300, q: 0.7 }); noise(c, o, n, 0.06, 0.1, { freq: 3200, at: 0.03, offset: 0.2 }); }],
  kill1: [0.14, (c, o, n) => { noise(c, o, n, 0.09, 0.22, { freq: 1600, q: 0.7, offset: 0.1 }); noise(c, o, n, 0.06, 0.1, { freq: 2800, at: 0.03, offset: 0.3 }); }],
  kill2: [0.14, (c, o, n) => { noise(c, o, n, 0.09, 0.22, { freq: 1100, q: 0.7, offset: 0.25 }); noise(c, o, n, 0.06, 0.1, { freq: 3600, at: 0.03, offset: 0.05 }); }],
  pickup: [0.08, (c, o) => tone(c, o, 'sine', 660, 0.06, 0.12, { to: 990 })],
  ink: [0.2, (c, o) => { tone(c, o, 'triangle', 440, 0.08, 0.15, { to: 330 }); tone(c, o, 'triangle', 660, 0.1, 0.1, { at: 0.05 }); }],
  levelup: [0.5, (c, o) => [523, 659, 784, 1047].forEach((f, i) => tone(c, o, 'triangle', f, 0.18, 0.18, { at: i * 0.07 }))],
  select: [0.08, (c, o) => tone(c, o, 'sine', 880, 0.05, 0.14, { to: 1320 })],
  hurt: [0.2, (c, o, n) => { tone(c, o, 'square', 110, 0.16, 0.16, { to: 55 }); noise(c, o, n, 0.12, 0.18, { freq: 500 }); }],
  boss: [1.4, (c, o) => { tone(c, o, 'sawtooth', 55, 1.1, 0.2, { to: 110, attack: 0.2 }); tone(c, o, 'sawtooth', 58, 1.1, 0.12, { to: 115, attack: 0.2 }); }],
  telegraph: [0.3, (c, o) => tone(c, o, 'square', 330, 0.25, 0.08, { to: 660 })],
  charge: [0.6, (c, o, n) => noise(c, o, n, 0.5, 0.25, { freq: 300, to: 1200, q: 0.8 })],
  clear: [0.9, (c, o) => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, o, 'triangle', f, 0.3, 0.2, { at: i * 0.1 }))],
  dead: [0.7, (c, o) => tone(c, o, 'triangle', 392, 0.6, 0.18, { to: 98, attack: 0.02 })],
  wave: [0.35, (c, o) => { tone(c, o, 'square', 220, 0.12, 0.08); tone(c, o, 'square', 220, 0.12, 0.08, { at: 0.16 }); }],
};

async function prerender(sampleRate) {
  const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!OAC) return null;
  const out = {};
  for (const [name, [dur, make]] of Object.entries(RECIPES)) {
    const off = new OAC(1, Math.ceil(sampleRate * dur), sampleRate);
    make(off, off.destination, makeNoise(off));
    out[name] = await off.startRendering();
  }
  return out;
}

// ---------- 鳴らす ----------
// low = 細かい音。混んでいるときは間引く
function play(name, { gap = 60, rate = 1, low = false } = {}) {
  if (!ctx || !enabled || !buffers || !buffers[name]) return;
  const now = performance.now();
  const key = name.startsWith('kill') ? 'kill' : name;
  if (lastPlayed[key] && now - lastPlayed[key] < gap) { audioStats.skipped++; return; }
  if (low) {
    if (now - windowStart > 100) { windowStart = now; windowCount = 0; }
    if (windowCount >= LOW_PER_WINDOW || audioStats.active >= MAX_VOICES - 2) { audioStats.skipped++; return; }
    windowCount++;
  } else if (audioStats.active >= MAX_VOICES + 4) { audioStats.skipped++; return; }
  lastPlayed[key] = now;
  const src = ctx.createBufferSource();
  src.buffer = buffers[name];
  src.playbackRate.value = rate;
  src.connect(master);
  audioStats.active++; audioStats.started++;
  if (audioStats.active > audioStats.maxActive) audioStats.maxActive = audioStats.active;
  src.onended = () => { audioStats.active--; src.disconnect(); };
  src.start();
}

const vary = (amt = 0.06) => 1 + (Math.random() * 2 - 1) * amt;

export const sfx = {
  shoot() { play('shoot', { gap: 110, rate: vary(0.08), low: true }); },
  swing() { play('swing', { gap: 120, rate: vary() }); },
  stamp() { play('stamp', { gap: 200, rate: vary() }); },
  hit() { play('hit', { gap: 90, rate: vary(), low: true }); },
  kill() { play(`kill${Math.floor(Math.random() * 3)}`, { gap: 75, rate: vary(0.1), low: true }); },
  pickup(combo = 0) { play('pickup', { gap: 60, rate: Math.pow(2, Math.min(combo, 14) / 12), low: true }); },
  ink() { play('ink', { gap: 100 }); },
  levelup() { play('levelup', { gap: 200 }); },
  select() { play('select', { gap: 60 }); },
  hurt() { play('hurt', { gap: 150 }); },
  boss() { play('boss', { gap: 500 }); },
  telegraph() { play('telegraph', { gap: 300 }); },
  charge() { play('charge', { gap: 300 }); },
  clear() { play('clear', { gap: 500 }); },
  dead() { play('dead', { gap: 500 }); },
  wave() { play('wave', { gap: 400 }); },
};
