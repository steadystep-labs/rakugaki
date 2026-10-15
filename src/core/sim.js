// ゲームの中身（シミュレーション）。Phaserに依存しない純粋なJS。
// 固定の時間刻み（1/60秒）で進み、シードが同じなら同じ展開になる。
// 描画側（GameScene）とバランス監視（tests/balance.mjs）の両方から使う。

import { createRng } from './rng.js';
import { WEAPONS, WEAPON_MAX_LEVEL, WEAPON_SLOTS, STARTING_WEAPON } from '../content/weapons.js';
import { PASSIVES, PASSIVE_MAX_LEVEL, PASSIVE_SLOTS } from '../content/passives.js';
import { ENEMIES, BOSS_TIME, MAX_ENEMIES } from '../content/enemies.js';
import { ANOMALIES } from '../content/anomalies.js';
import { applyMeta } from '../content/meta.js';

export const STEP = 1 / 60;
export const VIEW_W = 720;
export const VIEW_H = 1280;
const CELL = 64;
const HERO_RADIUS = 22;
const HERO_BASE_SPEED = 250;
const HERO_BASE_HP = 100;
const PICKUP_BASE = 120;
const MAX_DROPS = 260;

export function xpForLevel(level) {
  return Math.round(1.5 + level * 2 + Math.pow(level, 1.7) * 0.4);
}

export function createSim({ seed = 1, mode = 'free', anomaly = null, meta = {}, collectEvents = true } = {}) {
  const rng = createRng(seed);
  const amods = Object.assign(
    { enemyRadiusMul: 1, enemySpeedMul: 1, enemyHpMul: 1, xpMul: 1, timeScale: 1, darkness: 0 },
    anomaly && ANOMALIES[anomaly] ? ANOMALIES[anomaly].mods : {},
  );

  const s = {
    seed, mode, anomaly, amods, meta,
    t: 0, frame: 0,
    status: 'playing', // playing | levelup | dead | clear
    hero: {
      x: 0, y: 0, vx: 0, vy: 0, r: HERO_RADIUS, fx: 0, fy: -1,
      hp: HERO_BASE_HP, maxHp: HERO_BASE_HP, iframes: 0,
      level: 1, xp: 0, xpNext: xpForLevel(1), kills: 0, ink: 0, revivesLeft: 0,
      lastTrailX: 0, lastTrailY: 0,
    },
    mods: null,
    weapons: [],
    passives: [],
    enemies: [], projectiles: [], drops: [], trails: [], hazards: [], swings: [],
    choices: null,
    events: [],
    nextId: 1,
    boss: null,
    xpBank: 0,
    spawnAcc: 0,
    wavesDone: {},
    grid: new Map(),
    result: null,
  };

  const emit = (type, data) => { if (collectEvents) s.events.push(Object.assign({ type }, data)); };

  // ---------- 補正値 ----------
  function recomputeMods() {
    const p = { damageMul: 1, cooldownMul: 1, moveMul: 1, pickupMul: 1, xpMul: 1, maxHpAdd: 0, revives: 0 };
    applyMeta(p, meta);
    for (const ps of s.passives) PASSIVES[ps.id].apply(p, ps.lv);
    p.cooldownMul = Math.max(0.45, p.cooldownMul);
    const prevMax = s.hero.maxHp;
    s.hero.maxHp = HERO_BASE_HP + p.maxHpAdd;
    if (s.hero.maxHp > prevMax) s.hero.hp += s.hero.maxHp - prevMax;
    s.mods = p;
  }

  function addWeapon(id) {
    const w = { id, lv: 1, cd: 0.25, angle: 0 };
    s.weapons.push(w);
    return w;
  }

  // ---------- 初期化 ----------
  recomputeMods();
  s.hero.hp = s.hero.maxHp;
  s.hero.revivesLeft = s.mods.revives;
  addWeapon(STARTING_WEAPON);
  // 開始直後に、最初のレベルアップへつながる敵を少し置く
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rng.range(-0.2, 0.2);
    spawnEnemy('crumb', Math.cos(a) * rng.range(330, 400), Math.sin(a) * rng.range(330, 400));
  }

  // ---------- 敵 ----------
  function hpScale() { return 1 + s.t / 70; }
  function speedScale() { return Math.min(1.25, 1 + s.t * 0.001); }

  function spawnEnemy(type, x, y) {
    if (s.enemies.length >= MAX_ENEMIES && type !== 'boss') return null;
    const def = ENEMIES[type];
    const isBoss = type === 'boss';
    const hp = def.hp * (isBoss ? 1 : hpScale()) * amods.enemyHpMul;
    const e = {
      id: s.nextId++, type, x, y,
      r: def.radius * amods.enemyRadiusMul,
      hp, maxHp: hp,
      speed: def.speed * speedScale() * amods.enemySpeedMul,
      damage: def.damage,
      kx: 0, ky: 0, slowT: 0, slowAmt: 0, flash: 0, flashCd: 0,
      orbitCd: 0, shootT: def.shootEvery ? rng.range(0.5, def.shootEvery) : 0,
      // ボス用
      phase: 'walk', phaseT: 0, cdx: 0, cdy: 0, rubT: 0, summonT: def.summonEvery || 0,
      wobble: rng.range(0, Math.PI * 2),
    };
    s.enemies.push(e);
    return e;
  }

  // 画面のすぐ外側（四角形の縁）に出す。円だと縦長の画面の左右で遠すぎて、画面がスカスカになるため。
  function edgePoint(a, margin) {
    const hw = VIEW_W / 2 + margin, hh = VIEW_H / 2 + margin;
    const c = Math.cos(a), sn = Math.sin(a);
    const t = Math.min(hw / Math.max(1e-6, Math.abs(c)), hh / Math.max(1e-6, Math.abs(sn)));
    return { x: s.hero.x + c * t, y: s.hero.y + sn * t };
  }
  function spawnAtRing(type, angle) {
    const a = angle ?? rng.range(0, Math.PI * 2);
    const p = edgePoint(a, 50);
    return spawnEnemy(type, p.x, p.y);
  }

  function countType(type) { let n = 0; for (const e of s.enemies) if (e.type === type) n++; return n; }

  function pickSpawnType() {
    const t = s.t;
    const w = [['crumb', 1]];
    // かたまりは硬いので溜まると壁になる。同時に出ている数に上限をかける
    const lumpOk = countType('lump') < 12 + Math.floor(t / 60);
    if (t >= ENEMIES.runner.from) w.push(['runner', Math.min(0.8, 0.35 + (t - 45) / 300)]);
    if (t >= ENEMIES.lump.from && lumpOk) w.push(['lump', Math.min(0.22, 0.1 + (t - 90) / 800)]);
    if (t >= ENEMIES.spitter.from) w.push(['spitter', Math.min(0.22, 0.08 + (t - 150) / 800)]);
    let total = 0;
    for (const [, v] of w) total += v;
    let r = rng.next() * total;
    for (const [k, v] of w) { if ((r -= v) <= 0) return k; }
    return 'crumb';
  }

  function targetAlive() {
    if (s.boss) return 26;
    const t = s.t;
    return Math.min(MAX_ENEMIES - 20, 12 + t * 0.46 + Math.max(0, t - 150) * 0.12);
  }

  // 群れ：2.5秒前に予告（どこが空いているか）→ すき間のある輪で出す。完全に囲むと逃げ道がなく、理不尽になるため
  const WAVES = [
    { at: 60, run: (gap) => ring('crumb', 22, gap) },
    { at: 120, run: (gap) => swarm('runner', 20, gap + Math.PI) },
    { at: 180, run: (gap) => ring('lump', 6, gap) },
    { at: 240, run: (gap) => { ring('crumb', 22, gap); ring('runner', 12, gap); } },
  ];
  function runWaves() {
    for (const w of WAVES) {
      if (!s.wavesDone[`warn${w.at}`] && s.t >= w.at - 2.5) {
        s.wavesDone[`warn${w.at}`] = true;
        s.wavesDone[`gap${w.at}`] = rng.range(0, Math.PI * 2);
        emit('waveWarn', { at: w.at, gap: s.wavesDone[`gap${w.at}`] });
      }
      if (s.t >= w.at && !s.wavesDone[w.at]) {
        s.wavesDone[w.at] = true;
        w.run(s.wavesDone[`gap${w.at}`]);
        emit('wave', { at: w.at });
      }
    }
  }
  // gap の方向を中心に、およそ90度ぶんを空ける
  function ring(type, n, gap = null) {
    const total = gap === null ? n : Math.round(n * 4 / 3);
    for (let i = 0; i < total; i++) {
      const a = gap + 0.9 + (i / total) * Math.PI * 2;
      if (gap !== null) {
        const d = Math.abs(((a - gap + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (d < Math.PI / 4) continue;
      }
      spawnAtRing(type, a);
    }
  }
  function swarm(type, n, dir = null) {
    const a = dir ?? rng.range(0, Math.PI * 2);
    for (let i = 0; i < n; i++) spawnAtRing(type, a + rng.range(-0.35, 0.35));
  }

  function spawnDirector(dt) {
    runWaves();
    if (!s.boss && s.t >= BOSS_TIME) {
      const a = Math.atan2(s.hero.fy, s.hero.fx);
      s.boss = spawnAtRing('boss', a);
      emit('boss', {});
    }
    const target = targetAlive();
    if (s.enemies.length >= target) return;
    const perSec = s.boss ? 3 : 3.2 + s.t * 0.07;
    s.spawnAcc += perSec * dt;
    while (s.spawnAcc >= 1) {
      s.spawnAcc -= 1;
      spawnAtRing(s.boss ? 'crumb' : pickSpawnType());
    }
  }

  // ---------- 空間ハッシュ ----------
  function key(cx, cy) { return cx * 73856093 ^ cy * 19349663; }
  function rebuildGrid() {
    s.grid.clear();
    for (let i = 0; i < s.enemies.length; i++) {
      const e = s.enemies[i];
      const k = key(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
      let cell = s.grid.get(k);
      if (!cell) { cell = []; s.grid.set(k, cell); }
      cell.push(e);
    }
  }
  function queryEnemies(x, y, radius, fn) {
    const minX = Math.floor((x - radius - 70) / CELL), maxX = Math.floor((x + radius + 70) / CELL);
    const minY = Math.floor((y - radius - 70) / CELL), maxY = Math.floor((y + radius + 70) / CELL);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const cell = s.grid.get(key(cx, cy));
        if (!cell) continue;
        for (const e of cell) {
          if (e.hp <= 0) continue;
          const dx = e.x - x, dy = e.y - y, rr = radius + e.r;
          if (dx * dx + dy * dy <= rr * rr) fn(e);
        }
      }
    }
  }
  // 武器のねらい先。ボスが射程内なら優先する（取り巻きに吸われて倒せない問題の対策）
  function aimTarget(x, y, maxDist) {
    const b = s.boss;
    if (b && b.hp > 0 && (b.x - x) ** 2 + (b.y - y) ** 2 <= (maxDist * 0.85) ** 2) return b;
    return nearestEnemy(x, y, maxDist);
  }
  function nearestEnemy(x, y, maxDist) {
    let best = null, bestD = maxDist * maxDist;
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  // ---------- ダメージ ----------
  function damageEnemy(e, amount, kbx = 0, kby = 0) {
    if (e.hp <= 0) return;
    const dmg = amount * s.mods.damageMul * (e.phase === 'dizzy' ? 1.5 : 1);
    e.hp -= dmg;
    // 光るのは0.25秒に1回まで（当たり続けると光りっぱなしで姿が見えなくなるため）
    if (e.flashCd <= 0) { e.flash = 0.07; e.flashCd = 0.25; }
    if (e.type !== 'boss') { e.kx += kbx; e.ky += kby; }
    emit('hit', { x: e.x, y: e.y, dmg, enemy: e.type });
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    const def = ENEMIES[e.type];
    s.hero.kills++;
    emit('kill', { x: e.x, y: e.y, r: e.r, enemy: e.type });
    if (e.type === 'boss') {
      s.hero.ink += 30;
      finish('clear');
      return;
    }
    // 敵が硬くなるのに合わせて、しずく1粒の価値も上げる（強くなるペースが追いつくように）
    const xp = def.xp * amods.xpMul * (1 + s.t / 450);
    dropXp(e.x, e.y, xp);
    const inkChance = e.type === 'lump' ? 0.3 : e.type === 'spitter' ? 0.2 : 0.08;
    if (rng.chance(inkChance)) s.drops.push({ id: s.nextId++, kind: 'ink', x: e.x, y: e.y, value: 1, pull: false, pullT: 0 });
    else if (rng.chance(0.01)) s.drops.push({ id: s.nextId++, kind: 'heal', x: e.x, y: e.y, value: 25, pull: false, pullT: 0 });
    if (def.splitInto) {
      for (let i = 0; i < def.splitInto.count; i++) {
        const a = rng.range(0, Math.PI * 2);
        const c = spawnEnemy(def.splitInto.type, e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14);
        if (c) { c.kx = Math.cos(a) * 180; c.ky = Math.sin(a) * 180; }
      }
    }
  }

  // しずくは必ず倒した場所に出す。上限に達したら「すぐ近くのしずくにまとめる」か「勇者から一番遠いしずくを回収扱い（xpBank）にする」。
  // 以前は一番近いしずくに合算していたため、合算先が画面外だと目の前にしずくが出なくなるバグがあった（2026-10-14 修正）
  function dropXp(x, y, value) {
    // 取り逃して貯まった分を、新しいしずくに少しずつ上乗せする
    if (s.xpBank > 0) { const add = Math.min(s.xpBank, value * 3); value += add; s.xpBank -= add; }
    if (s.drops.length >= MAX_DROPS) {
      let near = null, nearD = 160 * 160;
      for (const d of s.drops) {
        if (d.kind !== 'xp') continue;
        const dd = (d.x - x) ** 2 + (d.y - y) ** 2;
        if (dd < nearD) { nearD = dd; near = d; }
      }
      if (near) { near.value += value; return; }
      let far = -1, farD = -1;
      s.drops.forEach((d, i) => {
        if (d.kind !== 'xp') return;
        const dd = (d.x - s.hero.x) ** 2 + (d.y - s.hero.y) ** 2;
        if (dd > farD) { farD = dd; far = i; }
      });
      if (far >= 0) { s.xpBank += s.drops[far].value; s.drops.splice(far, 1); }
    }
    const a = rng.range(0, Math.PI * 2), sp = rng.range(90, 170);
    s.drops.push({ id: s.nextId++, kind: 'xp', x, y, value, pull: false, age: 0, pullT: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp });
  }

  function hurtHero(amount, x, y) {
    const h = s.hero;
    if (h.iframes > 0 || s.status !== 'playing') return;
    h.hp -= amount;
    h.iframes = 0.65;
    emit('hurt', { x, y, amount });
    if (h.hp <= 0) {
      if (h.revivesLeft > 0) {
        h.revivesLeft--;
        h.hp = h.maxHp * 0.5;
        h.iframes = 2.2;
        for (const e of s.enemies) {
          const dx = e.x - h.x, dy = e.y - h.y, d = Math.hypot(dx, dy) || 1;
          if (d < 360 && e.type !== 'boss') { e.kx += (dx / d) * 700; e.ky += (dy / d) * 700; }
        }
        emit('revive', { x: h.x, y: h.y });
      } else {
        h.hp = 0;
        finish('dead');
      }
    }
  }

  function finish(status) {
    s.status = status;
    s.result = {
      status, time: s.t, kills: s.hero.kills, level: s.hero.level,
      ink: s.hero.ink + Math.floor(s.t / 15) + (status === 'clear' ? 20 : 0),
      mode: s.mode, anomaly: s.anomaly, seed: s.seed,
    };
    emit(status, {});
  }

  // ---------- レベルアップ ----------
  function makeChoices() {
    const cands = [];
    for (const w of s.weapons) if (w.lv < WEAPON_MAX_LEVEL) cands.push({ kind: 'weapon', id: w.id, lv: w.lv + 1, w: 1.0 });
    if (s.weapons.length < WEAPON_SLOTS) {
      for (const id of Object.keys(WEAPONS)) if (!s.weapons.find((w) => w.id === id)) cands.push({ kind: 'weapon', id, lv: 1, w: 0.95 });
    }
    for (const p of s.passives) if (p.lv < PASSIVE_MAX_LEVEL) cands.push({ kind: 'passive', id: p.id, lv: p.lv + 1, w: 0.8 });
    if (s.passives.length < PASSIVE_SLOTS) {
      for (const id of Object.keys(PASSIVES)) if (!s.passives.find((p) => p.id === id)) cands.push({ kind: 'passive', id, lv: 1, w: 0.7 });
    }
    const out = [];
    while (out.length < 3 && cands.length) {
      let total = 0;
      for (const c of cands) total += c.w;
      let r = rng.next() * total, idx = 0;
      for (; idx < cands.length; idx++) { if ((r -= cands[idx].w) <= 0) break; }
      idx = Math.min(idx, cands.length - 1);
      out.push(cands.splice(idx, 1)[0]);
    }
    if (out.length < 3) out.push({ kind: 'heal', amount: 35 });
    if (out.length < 3) out.push({ kind: 'ink', amount: 6 });
    return out.map(({ w, ...c }) => c);
  }

  function checkLevelUp() {
    const h = s.hero;
    if (s.status !== 'playing') return;
    if (h.xp >= h.xpNext) {
      h.xp -= h.xpNext;
      h.level++;
      h.xpNext = xpForLevel(h.level);
      s.choices = makeChoices();
      s.status = 'levelup';
      emit('levelup', { level: h.level });
    }
  }

  function choose(i) {
    if (s.status !== 'levelup' || !s.choices) return false;
    const c = s.choices[Math.max(0, Math.min(s.choices.length - 1, i))];
    if (c.kind === 'weapon') {
      const w = s.weapons.find((x) => x.id === c.id);
      if (w) w.lv = c.lv; else addWeapon(c.id);
    } else if (c.kind === 'passive') {
      const p = s.passives.find((x) => x.id === c.id);
      if (p) p.lv = c.lv; else s.passives.push({ id: c.id, lv: 1 });
      recomputeMods();
    } else if (c.kind === 'heal') {
      s.hero.hp = Math.min(s.hero.maxHp, s.hero.hp + c.amount);
    } else if (c.kind === 'ink') {
      s.hero.ink += c.amount;
    }
    emit('chose', { choice: c });
    s.choices = null;
    s.status = 'playing';
    checkLevelUp();
    return true;
  }

  // ---------- 武器 ----------
  function updateWeapons(dt) {
    const h = s.hero;
    for (const w of s.weapons) {
      const def = WEAPONS[w.id];
      const st = def.stats(w.lv);
      if (def.kind === 'orbit') {
        w.angle += st.angularSpeed * dt;
        w.needles = [];
        for (let i = 0; i < st.count; i++) {
          const a = w.angle + (i / st.count) * Math.PI * 2;
          const nx = h.x + Math.cos(a) * st.radius, ny = h.y + Math.sin(a) * st.radius;
          w.needles.push({ x: nx, y: ny, a });
          queryEnemies(nx, ny, st.hitRadius, (e) => {
            if (e.orbitCd > 0) return;
            e.orbitCd = st.rehit;
            const dx = e.x - h.x, dy = e.y - h.y, d = Math.hypot(dx, dy) || 1;
            damageEnemy(e, st.damage, (dx / d) * 90, (dy / d) * 90);
          });
        }
        continue;
      }
      if (def.kind === 'trail') {
        const moved = Math.hypot(h.x - h.lastTrailX, h.y - h.lastTrailY);
        if (moved >= 12) {
          s.trails.push({ x: h.x, y: h.y, life: st.life, maxLife: st.life, width: st.width });
          h.lastTrailX = h.x; h.lastTrailY = h.y;
        }
        continue;
      }
      w.cd -= dt;
      if (w.cd > 0) continue;
      const cooldown = st.cooldown * s.mods.cooldownMul;
      if (def.kind === 'shot') {
        const target = aimTarget(h.x, h.y, 640);
        if (!target) { w.cd = 0.1; continue; }
        const base = Math.atan2(target.y - h.y, target.x - h.x);
        for (let i = 0; i < st.count; i++) {
          const a = base + (i - (st.count - 1) / 2) * 0.16;
          s.projectiles.push({
            id: s.nextId++, team: 'hero', weapon: w.id, x: h.x, y: h.y,
            vx: Math.cos(a) * st.speed, vy: Math.sin(a) * st.speed,
            r: st.radius, damage: st.damage, pierce: st.pierce, life: st.life, hit: new Set(),
          });
        }
        emit('shoot', { weapon: w.id });
        w.cd = cooldown;
      } else if (def.kind === 'swing') {
        const target = nearestEnemy(h.x, h.y, st.reach + 40);
        if (!target) { w.cd = 0.1; continue; }
        const dirs = [Math.atan2(h.fy, h.fx)];
        if (st.both) dirs.push(dirs[0] + Math.PI);
        for (const dir of dirs) {
          s.swings.push({ x: h.x, y: h.y, dir, arc: st.arc, reach: st.reach, life: 0.2, maxLife: 0.2 });
          queryEnemies(h.x, h.y, st.reach, (e) => {
            const a = Math.atan2(e.y - h.y, e.x - h.x);
            let diff = Math.abs(((a - dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
            if (diff <= st.arc / 2 + 0.15) {
              const d = Math.hypot(e.x - h.x, e.y - h.y) || 1;
              damageEnemy(e, st.damage, ((e.x - h.x) / d) * st.knockback, ((e.y - h.y) / d) * st.knockback);
            }
          });
        }
        emit('swing', { weapon: w.id });
        w.cd = cooldown;
      } else if (def.kind === 'homing') {
        const target = aimTarget(h.x, h.y, 700);
        if (!target) { w.cd = 0.1; continue; }
        const base = Math.atan2(target.y - h.y, target.x - h.x);
        for (let i = 0; i < st.count; i++) {
          const a = base + (i - (st.count - 1) / 2) * 0.6;
          s.projectiles.push({
            id: s.nextId++, team: 'hero', weapon: w.id, homing: true, turn: st.turn, x: h.x, y: h.y,
            vx: Math.cos(a) * st.speed, vy: Math.sin(a) * st.speed, speed: st.speed,
            r: st.radius, damage: st.damage, pierce: st.pierce, life: st.life, hit: new Set(),
          });
        }
        emit('shoot', { weapon: w.id });
        w.cd = cooldown;
      }
    }
  }

  function updateProjectiles(dt) {
    const h = s.hero;
    for (const p of s.projectiles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      if (p.homing) {
        const target = aimTarget(p.x, p.y, 520);
        if (target) {
          const want = Math.atan2(target.y - p.y, target.x - p.x);
          const cur = Math.atan2(p.vy, p.vx);
          let diff = ((want - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          const turn = Math.max(-p.turn * dt, Math.min(p.turn * dt, diff));
          const na = cur + turn;
          p.vx = Math.cos(na) * p.speed; p.vy = Math.sin(na) * p.speed;
        }
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.team === 'hero') {
        queryEnemies(p.x, p.y, p.r, (e) => {
          if (p.life <= 0 || p.hit.has(e.id)) return;
          p.hit.add(e.id);
          const sp = Math.hypot(p.vx, p.vy) || 1;
          damageEnemy(e, p.damage, (p.vx / sp) * 70, (p.vy / sp) * 70);
          if (p.pierce > 0) p.pierce--; else p.life = 0;
        });
      } else {
        const dx = p.x - h.x, dy = p.y - h.y, rr = p.r + h.r - 4;
        if (dx * dx + dy * dy <= rr * rr) { hurtHero(p.damage, p.x, p.y); p.life = 0; }
      }
    }
    s.projectiles = s.projectiles.filter((p) => p.life > 0);
  }

  function updateTrails(dt) {
    if (!s.trails.length) return;
    const w = s.weapons.find((x) => WEAPONS[x.id].kind === 'trail');
    const st = w ? WEAPONS[w.id].stats(w.lv) : null;
    for (const tr of s.trails) tr.life -= dt;
    s.trails = s.trails.filter((tr) => tr.life > 0);
    if (!st) return;
    const touched = new Set();
    for (const tr of s.trails) {
      queryEnemies(tr.x, tr.y, tr.width / 2, (e) => {
        if (touched.has(e.id)) return;
        touched.add(e.id);
        e.slowT = 0.25; e.slowAmt = st.slow;
        damageEnemy(e, st.dps * dt);
      });
    }
  }

  // ---------- 敵の動き ----------
  function updateEnemies(dt) {
    const h = s.hero;
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      const def = ENEMIES[e.type];
      e.flash = Math.max(0, e.flash - dt);
      e.flashCd -= dt;
      e.orbitCd = Math.max(0, e.orbitCd - dt);
      e.slowT = Math.max(0, e.slowT - dt);
      const slow = e.slowT > 0 ? 1 - e.slowAmt : 1;
      let dx = h.x - e.x, dy = h.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      let mx = 0, my = 0;
      if (def.behavior === 'chase') {
        mx = dx; my = dy;
      } else if (def.behavior === 'keepAway') {
        if (d < def.keepDistance - 40) { mx = -dx; my = -dy; }
        else if (d > def.keepDistance + 40) { mx = dx; my = dy; }
        else { mx = -dy * 0.6; my = dx * 0.6; }
        e.shootT -= dt;
        if (e.shootT <= 0 && d < 620) {
          e.shootT = def.shootEvery;
          s.projectiles.push({
            id: s.nextId++, team: 'enemy', x: e.x, y: e.y,
            vx: dx * def.shotSpeed, vy: dy * def.shotSpeed, r: 9, damage: def.shotDamage, pierce: 0, life: 3.2,
          });
          emit('enemyShoot', { x: e.x, y: e.y });
        }
      } else if (def.behavior === 'boss') {
        updateBoss(e, def, dt, dx, dy);
        continue;
      }
      e.x += (mx * e.speed * slow + e.kx) * dt;
      e.y += (my * e.speed * slow + e.ky) * dt;
      const decay = Math.exp(-9 * dt);
      e.kx *= decay; e.ky *= decay;
      // 遠すぎる敵は前方に回り込ませる（圧を保つ）
      if (Math.abs(e.x - h.x) > VIEW_W / 2 + 420 || Math.abs(e.y - h.y) > VIEW_H / 2 + 420) {
        const p = edgePoint(Math.atan2(h.fy, h.fx) + rng.range(-1.2, 1.2), 50);
        e.x = p.x; e.y = p.y;
      }
      // 接触ダメージ
      const rr = e.r + h.r - 6;
      if ((e.x - h.x) ** 2 + (e.y - h.y) ** 2 <= rr * rr) hurtHero(e.damage, e.x, e.y);
    }
  }

  function updateBoss(e, def, dt, dx, dy) {
    const h = s.hero;
    e.phaseT += dt;
    e.flash = Math.max(0, e.flash - dt);
    e.flashCd -= dt;
    e.summonT -= dt;
    if (e.summonT <= 0) {
      e.summonT = def.summonEvery;
      for (let i = 0; i < 3; i++) {
        const a = rng.range(0, Math.PI * 2);
        spawnEnemy('crumb', e.x + Math.cos(a) * 90, e.y + Math.sin(a) * 90);
      }
    }
    if (e.phase === 'walk') {
      e.x += dx * e.speed * dt; e.y += dy * e.speed * dt;
      if (e.phaseT >= def.chargeEvery) { e.phase = 'telegraph'; e.phaseT = 0; e.cdx = dx; e.cdy = dy; emit('bossTelegraph', { x: e.x, y: e.y }); }
    } else if (e.phase === 'telegraph') {
      if (e.phaseT >= 0.65) { e.phase = 'charge'; e.phaseT = 0; emit('bossCharge', {}); }
    } else if (e.phase === 'charge') {
      e.x += e.cdx * def.chargeSpeed * dt; e.y += e.cdy * def.chargeSpeed * dt;
      e.rubT -= dt;
      if (e.rubT <= 0) { e.rubT = 0.07; s.hazards.push({ x: e.x, y: e.y, r: 44, life: def.rubLife, maxLife: def.rubLife, dps: def.rubDps }); }
      if (e.phaseT >= def.chargeTime) { e.phase = 'dizzy'; e.phaseT = 0; emit('bossDizzy', { x: e.x, y: e.y }); }
    } else if (e.phase === 'dizzy') {
      if (e.phaseT >= 1.2) { e.phase = 'walk'; e.phaseT = 0; }
    }
    const rr = e.r + h.r - 8;
    if ((e.x - h.x) ** 2 + (e.y - h.y) ** 2 <= rr * rr) hurtHero(e.damage, e.x, e.y);
  }

  function updateHazards(dt) {
    const h = s.hero;
    for (const z of s.hazards) {
      z.life -= dt;
      if (z.life > 0 && (z.x - h.x) ** 2 + (z.y - h.y) ** 2 <= (z.r + h.r * 0.5) ** 2) hurtHero(z.dps * 0.5, z.x, z.y);
    }
    s.hazards = s.hazards.filter((z) => z.life > 0);
  }

  // 敵どうしが重なりすぎないように押し合う
  function separate() {
    for (const e of s.enemies) {
      if (e.hp <= 0 || e.type === 'boss') continue;
      queryEnemies(e.x, e.y, e.r * 0.6, (o) => {
        if (o === e || o.type === 'boss') return;
        const dx = e.x - o.x, dy = e.y - o.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const overlap = e.r + o.r - d;
        if (overlap > 0) {
          const push = Math.min(overlap * 0.25, 4);
          e.x += (dx / d) * push; e.y += (dy / d) * push;
        }
      });
    }
  }

  // ---------- しずく ----------
  function updateDrops(dt) {
    const h = s.hero;
    const pr = PICKUP_BASE * s.mods.pickupMul;
    let gained = 0;
    for (const d of s.drops) {
      if (d.kind === 'xp' && (Math.abs(d.x - h.x) > VIEW_W + 300 || Math.abs(d.y - h.y) > VIEW_H)) {
        s.xpBank += d.value;
        d.taken = true;
        continue;
      }
      const dx = h.x - d.x, dy = h.y - d.y, dist = Math.hypot(dx, dy);
      // 出てすぐは吸わない（0.25秒）。ポンと飛び出してから、加速しながら勇者へ飛ぶ。
      // 以前は出た瞬間に吸われ、終盤はしずくが0.13秒で消えて見えなかった（2026-10-14 修正）
      d.age = (d.age || 0) + dt;
      if (d.vx || d.vy) { d.x += d.vx * dt; d.y += d.vy * dt; const k = Math.exp(-7 * dt); d.vx *= k; d.vy *= k; }
      if (!d.pull && dist < pr && d.age >= 0.25) d.pull = true;
      if (d.pull) {
        d.pullT += dt;
        const sp = Math.min(1100, 160 + d.pullT * 1400);
        d.x += (dx / (dist || 1)) * sp * dt;
        d.y += (dy / (dist || 1)) * sp * dt;
      }
      if (dist < h.r + 10) {
        d.taken = true;
        if (d.kind === 'xp') { h.xp += d.value * s.mods.xpMul; gained++; emit('gem', { x: d.x, y: d.y }); }
        else if (d.kind === 'ink') { h.ink += d.value; emit('ink', { x: d.x, y: d.y }); }
        else if (d.kind === 'heal') { h.hp = Math.min(h.maxHp, h.hp + d.value); emit('heal', { x: d.x, y: d.y }); }
      }
    }
    if (gained) emit('pickup', { count: gained });
    s.drops = s.drops.filter((d) => !d.taken);
  }

  // ---------- 1ステップ ----------
  function step(input = { x: 0, y: 0 }) {
    if (s.status !== 'playing') return;
    const dt = STEP * amods.timeScale;
    s.frame++;
    s.t += dt;
    const h = s.hero;
    let ix = input.x || 0, iy = input.y || 0;
    const mag = Math.hypot(ix, iy);
    if (mag > 1) { ix /= mag; iy /= mag; }
    const speed = HERO_BASE_SPEED * s.mods.moveMul;
    const k = 1 - Math.exp(-22 * dt);
    h.vx += (ix * speed - h.vx) * k;
    h.vy += (iy * speed - h.vy) * k;
    h.x += h.vx * dt; h.y += h.vy * dt;
    if (mag > 0.1) { const m = Math.hypot(ix, iy) || 1; h.fx = ix / m; h.fy = iy / m; }
    h.iframes = Math.max(0, h.iframes - dt);

    rebuildGrid();
    spawnDirector(dt);
    updateWeapons(dt);
    updateProjectiles(dt);
    updateTrails(dt);
    updateEnemies(dt);
    if (s.status !== 'playing') return;
    separate();
    s.enemies = s.enemies.filter((e) => e.hp > 0);
    for (const sw of s.swings) sw.life -= dt;
    s.swings = s.swings.filter((sw) => sw.life > 0);
    updateHazards(dt);
    if (s.status !== 'playing') return;
    updateDrops(dt);
    checkLevelUp();
  }

  function drainEvents() {
    const ev = s.events;
    s.events = [];
    return ev;
  }

  // テストとAI向けに、今の状態を短い文字列で返す（座標の原点は勇者の開始位置、x右・y下が正）
  function toText() {
    const h = s.hero;
    const near = s.enemies
      .map((e) => ({ type: e.type, x: Math.round(e.x - h.x), y: Math.round(e.y - h.y), hp: Math.round(e.hp) }))
      .sort((a, b) => a.x * a.x + a.y * a.y - (b.x * b.x + b.y * b.y))
      .slice(0, 8);
    return JSON.stringify({
      coords: 'origin=hero start, +x right, +y down; enemies relative to hero',
      status: s.status, mode: s.mode, anomaly: s.anomaly, t: Math.round(s.t * 10) / 10,
      hero: { x: Math.round(h.x), y: Math.round(h.y), hp: Math.round(h.hp), maxHp: h.maxHp, level: h.level, xp: Math.round(h.xp), xpNext: h.xpNext, kills: h.kills, ink: h.ink },
      weapons: s.weapons.map((w) => `${w.id}:${w.lv}`),
      passives: s.passives.map((p) => `${p.id}:${p.lv}`),
      choices: s.choices,
      counts: { enemies: s.enemies.length, projectiles: s.projectiles.length, drops: s.drops.length, trails: s.trails.length },
      boss: s.boss ? { hp: Math.round(Math.max(0, s.boss.hp)), maxHp: Math.round(s.boss.maxHp), phase: s.boss.phase } : null,
      nearest: near,
    });
  }

  return { state: s, step, choose, drainEvents, toText, finish: (st) => finish(st) };
}
