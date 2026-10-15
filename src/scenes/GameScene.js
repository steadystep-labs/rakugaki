import * as Phaser from '../../vendor/phaser.esm.min.js';
import { createSim, STEP } from '../core/sim.js';
import { ENEMIES } from '../content/enemies.js';
import { WEAPONS } from '../content/weapons.js';
import { PASSIVES } from '../content/passives.js';
import { PALETTE, COLORS } from '../content/colors.js';
import { app, persist, anomalyName } from '../state.js';
import { recordRun } from '../core/save.js';
import { formatTime } from '../core/share.js';
import { sfx, unlockAudio } from '../fx/audio.js';
import { wobblyRect } from '../fx/doodle.js';
import { label, button, fadeTo, pin, W, H } from '../ui/ui.js';

const DAY_COLOR = COLORS.blue.hex;
const ICONS = { pencil: 'pencilShot', ruler: 'rulerIcon', compass: 'needle', plane: 'plane', crayonBlue: 'crayon' };
const BOIL_MS = 125;
const VIS = 1.15; // 見た目の拡大率（スマホで小さすぎないように）

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    this.runData = data || { mode: 'free', seed: 1, anomaly: null };
  }

  create() {
    const { mode, seed, anomaly } = this.runData;
    this.sim = createSim({ seed, mode, anomaly, meta: app.save.meta });
    this.s = this.sim.state;
    this.acc = 0;
    this.hitstop = 0;
    this.ended = false;
    this.paused = false;
    this.levelUpOpen = false;
    this.combo = 0;
    this.comboT = 0;
    this.boilFrame = 0;
    this.boilAcc = 0;
    this.testInput = { x: 0, y: 0 };
    this.joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.settings = app.save.settings;

    const cam = this.cameras.main;
    cam.setBackgroundColor(PALETTE.paper);
    cam.fadeIn(200, 253, 254, 255);
    this.camX = 0; this.camY = 0;
    cam.centerOn(0, 0);

    this.grid = this.add.tileSprite(W / 2, H / 2, W + 64, H + 64, 'grid').setScrollFactor(0).setDepth(-10);

    // 世界の中のもの
    this.hero = this.add.image(0, 0, 'hero_0').setDepth(50);
    this.heroBar = this.add.graphics().setDepth(52);
    this.swingGfx = this.add.graphics().setDepth(56);
    this.pools = { enemy: [], proj: [], drop: [], trail: [], hazard: [], needle: [], part: [] };
    this.live = { enemy: new Map(), proj: new Map(), drop: new Map() };
    this.trailImgs = [];
    this.hazardImgs = [];
    this.needleImgs = [];
    this.particles = [];

    if (this.s.amods.darkness > 0) this.makeDarkness(this.s.amods.darkness);
    this.makeHud();
    this.makeJoystick();
    this.bindInput();

    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    this.events.once('shutdown', () => this.game.events.off(Phaser.Core.Events.HIDDEN, this.onHidden, this));

    if (mode === 'daily') this.banner(`きょうの異変：${anomalyName(anomaly)}`, '#2F6FE4');
    // はじめての人向けの操作説明（動き出したら消える）
    if (app.save.stats.runs < 2) this.showHowTo();
    if (app.test) globalThis.__gameScene = this;
    this.renderFrame(0);
  }

  showHowTo() {
    const touch = this.sys.game.device.input.touch;
    const c = this.add.container(W / 2, H - 300).setDepth(105);
    const msg = touch ? '画面のどこでも指をおいて\nずらすと うごく' : 'WASD／矢印キーで うごく';
    const t = label(this, 0, 0, msg, 34, { color: '#2E3138' });
    const sub = label(this, 0, 92, 'こうげきは じどう。しずくを ひろって つよくなろう', 24, { color: '#5A5F69' });
    c.add([t, sub]);
    if (touch) {
      const ring = this.add.image(0, -120, 'joyRing_0').setScale(0.55).setAlpha(0.5);
      const knob = this.add.image(-24, -120, 'joyKnob_0').setScale(0.6).setAlpha(0.85);
      c.add([ring, knob]);
      this.tweens.add({ targets: knob, x: 24, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    pin(c);
    this.howTo = c;
  }

  hideHowTo() {
    if (!this.howTo) return;
    const c = this.howTo;
    this.howTo = null;
    this.tweens.add({ targets: c, alpha: 0, duration: 300, onComplete: () => c.destroy() });
  }

  // ---------- 入力 ----------
  makeJoystick() {
    this.joyRing = this.add.image(0, 0, 'joyRing_0').setScrollFactor(0).setDepth(90).setVisible(false).setAlpha(0.6);
    this.joyKnob = this.add.image(0, 0, 'joyKnob_0').setScrollFactor(0).setDepth(91).setVisible(false).setAlpha(0.8);
  }

  bindInput() {
    this.keys = this.input.keyboard ? this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,ONE,TWO,THREE,ESC,P') : null;
    this.input.on('pointerdown', (p) => {
      unlockAudio();
      if (this.levelUpOpen || this.paused || this.ended) return;
      if (p.y < 150 && p.x > W - 140) return; // 一時停止ボタンの上
      if (this.joy.id !== null) return;
      this.joy = { id: p.id, ox: p.x, oy: p.y, x: 0, y: 0 };
      this.joyRing.setPosition(p.x, p.y).setVisible(true);
      this.joyKnob.setPosition(p.x, p.y).setVisible(true);
    });
    this.input.on('pointermove', (p) => {
      if (p.id !== this.joy.id) return;
      const dx = p.x - this.joy.ox, dy = p.y - this.joy.oy;
      const d = Math.hypot(dx, dy), max = 70;
      const k = d > max ? max / d : 1;
      this.joy.x = (dx * k) / max; this.joy.y = (dy * k) / max;
      // 指が離れすぎたら輪を引っぱる（親指が疲れない）
      if (d > max * 1.6) { this.joy.ox = p.x - (dx / d) * max * 1.6; this.joy.oy = p.y - (dy / d) * max * 1.6; this.joyRing.setPosition(this.joy.ox, this.joy.oy); }
      this.joyKnob.setPosition(this.joy.ox + dx * k, this.joy.oy + dy * k);
    });
    const release = (p) => {
      if (p.id !== this.joy.id) return;
      this.resetJoystick();
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    if (this.keys) {
      this.keys.ESC.on('down', () => this.togglePause());
      this.keys.P.on('down', () => this.togglePause());
      this.keys.ONE.on('down', () => this.pick(0));
      this.keys.TWO.on('down', () => this.pick(1));
      this.keys.THREE.on('down', () => this.pick(2));
    }
  }

  resetJoystick() {
    this.joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.joyRing.setVisible(false);
    this.joyKnob.setVisible(false);
  }

  readInput() {
    if (app.test) return this.testInput;
    let x = this.joy.x, y = this.joy.y;
    const k = this.keys;
    if (k) {
      if (k.A.isDown || k.LEFT.isDown) x -= 1;
      if (k.D.isDown || k.RIGHT.isDown) x += 1;
      if (k.W.isDown || k.UP.isDown) y -= 1;
      if (k.S.isDown || k.DOWN.isDown) y += 1;
    }
    return { x, y };
  }

  // ---------- 毎フレーム ----------
  update(time, delta) {
    if (!this.paused && !this.ended && !app.test && this.s.status === 'playing') {
      if (this.hitstop > 0) {
        this.hitstop -= delta;
      } else {
        this.acc += Math.min(delta, 100) / 1000;
        while (this.acc >= STEP) {
          this.sim.step(this.readInput());
          this.acc -= STEP;
          if (this.s.status !== 'playing') break;
        }
      }
    }
    this.renderFrame(delta);
  }

  renderFrame(delta) {
    if (this.howTo && (Math.hypot(this.s.hero.vx, this.s.hero.vy) > 60 || this.s.t > 8)) this.hideHowTo();
    this.handleEvents(this.sim.drainEvents());
    this.boilAcc += delta;
    if (this.boilAcc >= BOIL_MS) { this.boilAcc = 0; this.boilFrame = (this.boilFrame + 1) % 3; }
    this.syncWorld(delta);
    this.updateParticles(delta);
    this.updateCamera(delta);
    this.updateHud();
    if (this.s.status === 'levelup' && !this.levelUpOpen) this.openLevelUp();
    if ((this.s.status === 'dead' || this.s.status === 'clear') && !this.ended) this.onEnd();
  }

  tex(key) { return `${key}_${this.boilFrame}`; }

  take(poolName, depth) {
    const img = this.pools[poolName].pop() || this.add.image(0, 0, 'xp_0');
    img.setVisible(true).setActive(true).setAlpha(1).setScale(1).setRotation(0).setDepth(depth).setFlipX(false);
    img.clearTint();
    img.setTintMode(Phaser.TintModes.MULTIPLY);
    return img;
  }
  give(poolName, img) { img.setVisible(false).setActive(false); this.pools[poolName].push(img); }

  syncWorld(delta) {
    const s = this.s, h = s.hero, now = this.time.now;
    // 勇者
    const moving = Math.hypot(h.vx, h.vy) > 30;
    this.hero.setTexture(this.tex('hero')).setPosition(h.x, h.y);
    this.hero.setFlipX(h.fx < -0.1);
    const bob = moving ? Math.sin(now * 0.018) * 0.06 : Math.sin(now * 0.004) * 0.02;
    this.hero.setScale(VIS * (1 - bob * 0.5), VIS * (1 + bob));
    this.hero.setAlpha(h.iframes > 0 && Math.floor(now / 70) % 2 === 0 ? 0.35 : 1);
    // 勇者のHPバー
    const g = this.heroBar;
    g.clear();
    const bw = 64, rate = Math.max(0, h.hp / h.maxHp);
    const by = h.y + 40;
    g.fillStyle(PALETTE.white, 1); g.fillRect(h.x - bw / 2, by, bw, 9);
    g.fillStyle(rate < 0.3 ? PALETTE.danger : DAY_COLOR, 1); g.fillRect(h.x - bw / 2, by, bw * rate, 9);
    g.lineStyle(3, PALETTE.ink, 1); g.strokeRect(h.x - bw / 2, by, bw, 9);

    // 敵
    const seen = new Set();
    for (const e of s.enemies) {
      seen.add(e.id);
      let img = this.live.enemy.get(e.id);
      if (!img) { img = this.take('enemy', e.type === 'boss' ? 45 : 40); img.enemyType = e.type; this.live.enemy.set(e.id, img); }
      img.setTexture(this.tex(e.type)).setPosition(e.x, e.y);
      const base = ENEMIES[e.type].radius;
      let sc = e.r / base;
      if (e.type === 'runner') img.setRotation(Math.atan2(h.y - e.y, h.x - e.x));
      else if (e.type === 'boss') {
        img.setRotation(e.phase === 'dizzy' ? Math.sin(now * 0.03) * 0.15 : e.phase === 'charge' ? Math.atan2(e.cdy, e.cdx) * 0.1 : 0);
        if (e.phase === 'telegraph') sc *= 1 + Math.sin(now * 0.05) * 0.06;
      } else img.setRotation(Math.sin(now * 0.006 + e.wobble) * 0.18);
      img.setScale(sc * VIS);
      if (e.flash > 0 && e.type === 'boss') img.setTintMode(Phaser.TintModes.MULTIPLY).setTint(0xa9c3f5);
      else if (e.flash > 0) img.setTintMode(Phaser.TintModes.FILL).setTint(DAY_COLOR);
      else if (e.type === 'boss' && e.phase === 'telegraph' && Math.floor(now / 90) % 2 === 0) img.setTintMode(Phaser.TintModes.FILL).setTint(PALETTE.danger);
      else img.setTintMode(Phaser.TintModes.MULTIPLY).setTint(0xffffff);
      if (e.slowT > 0 && e.flash <= 0) img.setTint(0xb9cdf5);
    }
    for (const [id, img] of this.live.enemy) if (!seen.has(id)) { this.give('enemy', img); this.live.enemy.delete(id); }

    // 弾
    seen.clear();
    for (const p of s.projectiles) {
      seen.add(p.id);
      let img = this.live.proj.get(p.id);
      if (!img) {
        img = this.take('proj', 60);
        img.projKey = p.team === 'enemy' ? 'enemyShot' : p.weapon === 'plane' ? 'plane' : 'pencilShot';
        this.live.proj.set(p.id, img);
      }
      img.setTexture(this.tex(img.projKey)).setPosition(p.x, p.y).setRotation(Math.atan2(p.vy, p.vx)).setScale(VIS);
    }
    for (const [id, img] of this.live.proj) if (!seen.has(id)) { this.give('proj', img); this.live.proj.delete(id); }

    // しずく・インク
    seen.clear();
    for (const d of s.drops) {
      seen.add(d.id);
      let img = this.live.drop.get(d.id);
      if (!img) { img = this.take('drop', 30); this.live.drop.set(d.id, img); }
      img.setTexture(this.tex(d.kind === 'xp' ? 'xp' : d.kind === 'heal' ? 'heart' : 'ink')).setPosition(d.x, d.y + Math.sin(now * 0.006 + d.id) * 3);
      img.setScale(VIS * (d.kind === 'xp' ? 1 + Math.min(d.value, 20) * 0.04 : d.kind === 'heal' ? 0.8 + Math.sin(now * 0.01) * 0.08 : 1));
    }
    for (const [id, img] of this.live.drop) if (!seen.has(id)) { this.give('drop', img); this.live.drop.delete(id); }

    // クレヨンの線
    this.syncList(this.trailImgs, s.trails, 'trail', 10, (img, t) => {
      img.setTexture(this.tex('crayon')).setPosition(t.x, t.y).setScale(t.width / 18).setAlpha(Math.min(1, (t.life / t.maxLife) * 1.6));
    });
    // ボスのこすった跡
    this.syncList(this.hazardImgs, s.hazards, 'hazard', 12, (img, z) => {
      img.setTexture(this.tex('smudge')).setPosition(z.x, z.y).setScale(z.r / 42).setAlpha(Math.min(0.95, (z.life / z.maxLife) * 1.5));
    });
    // コンパスの針
    const needles = [];
    for (const w of s.weapons) if (w.needles) needles.push(...w.needles);
    this.syncList(this.needleImgs, needles, 'needle', 58, (img, n) => {
      img.setTexture(this.tex('needle')).setPosition(n.x, n.y).setRotation(n.a + Math.PI / 2).setScale(VIS);
    });
    // じょうぎの一振り（＋群れの予告の矢印）
    const sg = this.swingGfx;
    sg.clear();
    if (this.gapWarn && s.t < this.gapWarn.until) {
      const a = this.gapWarn.angle, pulse = 0.8 + Math.sin(now * 0.012) * 0.2;
      const x1 = h.x + Math.cos(a) * 60, y1 = h.y + Math.sin(a) * 60;
      const x2 = h.x + Math.cos(a) * 230, y2 = h.y + Math.sin(a) * 230;
      sg.lineStyle(18, DAY_COLOR, pulse);
      sg.lineBetween(x1, y1, x2, y2);
      sg.fillStyle(DAY_COLOR, pulse);
      sg.fillTriangle(x2 + Math.cos(a) * 44, y2 + Math.sin(a) * 44, x2 + Math.cos(a + 2.4) * 40, y2 + Math.sin(a + 2.4) * 40, x2 + Math.cos(a - 2.4) * 40, y2 + Math.sin(a - 2.4) * 40);
    }
    for (const sw of s.swings) {
      const a = sw.life / sw.maxLife;
      sg.lineStyle(14, PALETTE.ink, a * 0.85);
      sg.beginPath(); sg.arc(sw.x, sw.y, sw.reach * 0.78, sw.dir - sw.arc / 2, sw.dir + sw.arc / 2); sg.strokePath();
      sg.lineStyle(4, PALETTE.ink, a * 0.5);
      sg.beginPath(); sg.arc(sw.x, sw.y, sw.reach * 0.98, sw.dir - sw.arc / 2.4, sw.dir + sw.arc / 2.4); sg.strokePath();
    }
    // まっくら
    if (this.dark) {
      const c = this.cameras.main;
      this.dark.setPosition(h.x - c.scrollX, h.y - c.scrollY);
    }
  }

  syncList(list, items, poolName, depth, apply) {
    while (list.length < items.length) list.push(this.take(poolName, depth));
    while (list.length > items.length) this.give(poolName, list.pop());
    for (let i = 0; i < items.length; i++) apply(list[i], items[i]);
  }

  updateCamera(delta) {
    const h = this.s.hero, cam = this.cameras.main;
    const k = 1 - Math.exp(-delta * 0.012);
    this.camX += (h.x + h.vx * 0.12 - this.camX) * k;
    this.camY += (h.y + h.vy * 0.12 - this.camY) * k;
    cam.centerOn(this.camX, this.camY);
    this.grid.tilePositionX = cam.scrollX;
    this.grid.tilePositionY = cam.scrollY;
  }

  // ---------- 手触り（イベントごとの反応） ----------
  shake(ms, intensity) { if (this.settings.shake) this.cameras.main.shake(ms, intensity); }

  handleEvents(events) {
    let hitCount = 0, gemCount = 0;
    for (const ev of events) {
      switch (ev.type) {
        case 'shoot': sfx.shoot(); break;
        case 'swing': sfx.swing(); break;
        case 'hit':
          if (hitCount++ < 6) { sfx.hit(); this.burst(ev.x, ev.y, 'splash', 2, { tint: DAY_COLOR, speed: 120, life: 260, scale: 0.6 }); }
          break;
        case 'kill': this.onKill(ev); break;
        case 'gem':
          // 拾った瞬間に小さく光る（しずくを取った手応え）
          if (gemCount++ < 3) this.burst(ev.x, ev.y, 'splash', 1, { tint: DAY_COLOR, speed: 60, life: 200, scale: 0.55 });
          break;
        case 'pickup':
          this.combo += ev.count; this.comboT = 450;
          sfx.pickup(this.combo);
          break;
        case 'heal': sfx.levelup(); this.burst(ev.x, ev.y, 'heart', 5, { speed: 160, life: 500, scale: 0.4, gravity: -80 }); break;
        case 'ink': sfx.ink(); this.burst(ev.x, ev.y, 'splash', 4, { tint: PALETTE.ink, speed: 140, life: 300, scale: 0.7 }); break;
        case 'levelup':
          sfx.levelup();
          this.burst(this.s.hero.x, this.s.hero.y, 'star', 10, { speed: 330, life: 520, scale: 0.6, spin: 6 });
          break;
        case 'hurt':
          sfx.hurt();
          this.hitstop = Math.max(this.hitstop, 55);
          this.shake(140, 0.007);
          this.tweens.add({ targets: this.hero, scaleX: 1.25, scaleY: 0.75, duration: 60, yoyo: true });
          if (this.settings.flash) this.flashEdge();
          break;
        case 'revive':
          this.banner('ふっかつ！', '#2F6FE4');
          this.burst(ev.x, ev.y, 'star', 16, { speed: 420, life: 700, scale: 0.8, spin: 8 });
          break;
        case 'waveWarn':
          sfx.telegraph();
          this.banner('ケシカスの群れがくる！ 青い矢印のほうへ', '#2F6FE4');
          this.gapWarn = { angle: ev.gap, until: this.s.t + 3.5 };
          break;
        case 'wave': sfx.wave(); break;
        case 'boss': sfx.boss(); this.shake(500, 0.006); this.banner('おおけしごむ があらわれた！', '#E2463A'); break;
        case 'bossTelegraph': sfx.telegraph(); break;
        case 'bossCharge': sfx.charge(); this.shake(300, 0.01); break;
        case 'bossDizzy': this.burst(ev.x, ev.y - 60, 'star', 5, { speed: 90, life: 900, scale: 0.5, spin: 4, gravity: -60 }); break;
        case 'clear':
          sfx.clear();
          this.hitstop = 300;
          this.shake(600, 0.012);
          if (this.settings.flash) this.cameras.main.flash(260, 255, 255, 255);
          this.burst(this.s.hero.x, this.s.hero.y, 'star', 30, { speed: 520, life: 1100, scale: 0.9, spin: 8 });
          break;
        case 'dead': sfx.dead(); this.shake(300, 0.008); break;
        default: break;
      }
    }
  }

  onKill(ev) {
    sfx.kill();
    // くしゃっと潰れる
    const img = this.take('part', 41);
    img.setTexture(this.tex(ev.enemy)).setPosition(ev.x, ev.y).setScale(ev.r / ENEMIES[ev.enemy].radius);
    this.particles.push({ img, vx: 0, vy: 0, life: 150, max: 150, spin: 9, gravity: 0, scaleFrom: img.scaleX, scaleTo: 0.15, fade: false });
    const big = ev.enemy === 'lump' || ev.enemy === 'boss';
    this.burst(ev.x, ev.y, 'scrap', big ? 10 : 4, { speed: big ? 360 : 260, life: 360, spin: 10, gravity: 500 });
    this.burst(ev.x, ev.y, 'splash', big ? 5 : 2, { tint: DAY_COLOR, speed: 160, life: 320, scale: 0.8 });
    if (big) { this.shake(90, 0.004); this.hitstop = Math.max(this.hitstop, 30); }
  }

  burst(x, y, key, n, { tint = null, speed = 200, life = 400, scale = 1, spin = 0, gravity = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 320) return;
      const img = this.take('part', 70);
      img.setTexture(`${key}_${i % 3}`).setPosition(x, y).setScale(scale);
      if (tint !== null) img.setTint(tint);
      const a = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({ img, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - gravity * 0.25, life, max: life, spin: (Math.random() - 0.5) * spin, gravity, scaleFrom: scale, scaleTo: scale * 0.3, fade: true });
    }
  }

  updateParticles(delta) {
    const dt = delta / 1000;
    if (this.comboT > 0) { this.comboT -= delta; if (this.comboT <= 0) this.combo = 0; }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;
      if (p.life <= 0) { this.give('part', p.img); this.particles.splice(i, 1); continue; }
      const t = 1 - p.life / p.max;
      p.vy += p.gravity * dt;
      p.vx *= 0.96; p.vy *= 0.96;
      p.img.x += p.vx * dt; p.img.y += p.vy * dt;
      p.img.rotation += p.spin * dt;
      p.img.setScale(p.scaleFrom + (p.scaleTo - p.scaleFrom) * t);
      if (p.fade) p.img.setAlpha(1 - t * t);
    }
  }

  flashEdge() {
    if (!this.edge) {
      this.edge = this.add.graphics().setScrollFactor(0).setDepth(95);
      this.edge.lineStyle(36, PALETTE.danger, 0.35);
      this.edge.strokeRect(0, 0, W, H);
    }
    this.edge.setAlpha(1);
    this.tweens.killTweensOf(this.edge);
    this.tweens.add({ targets: this.edge, alpha: 0, duration: 380 });
  }

  makeDarkness(radius) {
    const g = this.add.graphics().setScrollFactor(0).setDepth(85);
    for (let i = 0; i < 6; i++) {
      g.lineStyle(3000, 0x1d2230, i === 5 ? 0.93 : 0.14);
      g.strokeCircle(0, 0, radius + 1500 + i * 14);
    }
    this.dark = g;
  }

  // お知らせは1つずつ（重なると読めないので、前のものは消す）。幅に収まらなければ縮める。
  banner(text, color = '#2E3138') {
    if (this.bannerText) { this.tweens.killTweensOf(this.bannerText); this.bannerText.destroy(); }
    const t = label(this, W / 2, 360, text, 48, { color }).setScrollFactor(0).setDepth(110).setAlpha(0);
    const fit = Math.min(1, (W - 60) / t.width);
    t.setScale(fit * 0.6);
    this.bannerText = t;
    this.tweens.add({ targets: t, scale: fit, alpha: 1, duration: 260, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, y: 330, delay: 1500, duration: 400, onComplete: () => { t.destroy(); if (this.bannerText === t) this.bannerText = null; } });
  }

  // ---------- 画面上の表示 ----------
  makeHud() {
    const d = 100;
    const backing = this.add.graphics().setScrollFactor(0).setDepth(d - 1);
    backing.fillStyle(PALETTE.paper, 0.92);
    backing.fillRect(0, 0, W, this.s.anomaly ? 140 : 112);
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(d);
    this.lvText = label(this, 28, 70, 'Lv 1', 34, { originX: 0 }).setScrollFactor(0).setDepth(d);
    this.timeText = label(this, W / 2, 72, '0:00', 46).setScrollFactor(0).setDepth(d);
    this.inkIcon = this.add.image(W - 220, 72, 'ink_0').setScrollFactor(0).setDepth(d).setScale(0.8);
    this.inkText = label(this, W - 198, 72, '0', 32, { originX: 0 }).setScrollFactor(0).setDepth(d);
    if (this.s.anomaly) label(this, W / 2, 118, `異変：${anomalyName(this.s.anomaly)}`, 24, { color: '#5A5F69' }).setScrollFactor(0).setDepth(d);
    const pause = button(this, W - 62, 72, 84, 70, 'll', () => this.togglePause(), { size: 30, seed: 7 });
    pin(pause).setDepth(d + 1);
    this.bossName = label(this, W / 2, 162, 'おおけしごむ', 28, { color: '#E2463A' }).setScrollFactor(0).setDepth(d).setVisible(false);
  }

  updateHud() {
    const s = this.s, h = s.hero, g = this.hud;
    g.clear();
    const x = 24, y = 18, w = W - 48, bh = 18;
    g.fillStyle(PALETTE.white, 1); g.fillRect(x, y, w, bh);
    g.fillStyle(DAY_COLOR, 1); g.fillRect(x, y, w * Math.min(1, h.xp / h.xpNext), bh);
    g.lineStyle(3, PALETTE.ink, 1); g.strokeRect(x, y, w, bh);
    this.lvText.setText(`Lv ${h.level}`);
    this.timeText.setText(formatTime(s.t));
    this.inkText.setText(`${h.ink}`);
    if (s.boss && s.boss.hp > 0) {
      this.bossName.setVisible(true);
      const bx = 80, by = 186, bw = W - 160;
      g.fillStyle(PALETTE.white, 1); g.fillRect(bx, by, bw, 16);
      g.fillStyle(PALETTE.danger, 1); g.fillRect(bx, by, bw * Math.max(0, s.boss.hp / s.boss.maxHp), 16);
      g.lineStyle(3, PALETTE.ink, 1); g.strokeRect(bx, by, bw, 16);
    } else this.bossName.setVisible(false);
  }

  // ---------- レベルアップ ----------
  openLevelUp() {
    this.levelUpOpen = true;
    this.resetJoystick();
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(200);
    const bg = this.add.graphics();
    bg.fillStyle(PALETTE.paper, 0.86); bg.fillRect(0, 0, W, H);
    c.add(bg);
    c.add(label(this, W / 2, 250, 'レベルアップ！', 64));
    c.add(label(this, W / 2, 322, `Lv ${this.s.hero.level}　ひとつ選んでね`, 30, { color: '#5A5F69' }));
    this.cards = [];
    this.s.choices.forEach((ch, i) => {
      const info = this.describe(ch);
      const y = 500 + i * 215;
      const card = button(this, W / 2, y, 620, 188, '', (p) => this.pick(i, p), { fill: 0xfff6c7, seed: 31 + i * 5, fireOnDown: true });
      card.add(this.add.image(-238, 0, `${info.icon}_0`).setScale(info.iconScale));
      card.add(label(this, -170, -42, info.name, 40, { originX: 0 }));
      card.add(label(this, 270, -42, info.tag, 28, { originX: 1, color: info.tag === 'NEW' ? '#2F6FE4' : '#5A5F69' }));
      card.add(label(this, -170, 22, info.desc, 26, { originX: 0, color: '#3B3F47', wrap: 430, align: 'left' }));
      card.setScale(0.7).setAlpha(0);
      card.zone.disableInteractive();
      this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 220, delay: 60 * i, ease: 'Back.Out' });
      c.add(card);
      this.cards.push(card);
    });
    // 移動中の指で誤って選ばないよう、少し待ってから押せるようにする
    this.time.delayedCall(app.test ? 0 : 380, () => this.cards.forEach((cd) => cd.zone.setInteractive({ useHandCursor: true })));
    pin(c);
    this.levelUpLayer = c;
  }

  describe(ch) {
    if (ch.kind === 'weapon') {
      const def = WEAPONS[ch.id];
      return { name: def.name, tag: ch.lv === 1 ? 'NEW' : `Lv${ch.lv}`, desc: ch.lv === 1 ? def.desc : def.levelText[ch.lv - 1], icon: ICONS[ch.id], iconScale: ch.id === 'pencil' ? 2.4 : 1.5 };
    }
    if (ch.kind === 'passive') {
      const def = PASSIVES[ch.id];
      return { name: def.name, tag: ch.lv === 1 ? 'NEW' : `Lv${ch.lv}`, desc: def.desc, icon: 'star', iconScale: 1.2 };
    }
    if (ch.kind === 'heal') return { name: 'ひとやすみ', tag: '', desc: `HPを${ch.amount}かいふく`, icon: 'heart', iconScale: 1.2 };
    return { name: 'インク', tag: '', desc: `インクを${ch.amount}もらう`, icon: 'ink', iconScale: 1.4 };
  }

  // pointer があれば、選んだ指をそのままスティックにする（指を離して押し直さなくても動ける）
  pick(i, pointer = null) {
    if (!this.levelUpOpen || !this.s.choices || i >= this.s.choices.length) return;
    this.sim.choose(i);
    this.levelUpLayer.destroy();
    this.levelUpOpen = false;
    this.cards = [];
    this.acc = 0;
    if (pointer && pointer.isDown) {
      this.joy = { id: pointer.id, ox: pointer.x, oy: pointer.y, x: 0, y: 0 };
      this.joyRing.setPosition(pointer.x, pointer.y).setVisible(true);
      this.joyKnob.setPosition(pointer.x, pointer.y).setVisible(true);
    }
  }

  // ---------- 一時停止 ----------
  onHidden() { if (!this.paused && !this.ended && !app.test) this.togglePause(); }

  togglePause() {
    if (this.ended || this.levelUpOpen) return;
    if (this.paused) { this.pauseLayer.destroy(); this.paused = false; this.acc = 0; return; }
    this.paused = true;
    this.resetJoystick();
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(210);
    const bg = this.add.graphics();
    bg.fillStyle(PALETTE.paper, 0.9); bg.fillRect(0, 0, W, H);
    c.add(bg);
    c.add(label(this, W / 2, 420, 'ひとやすみ', 64));
    c.add(button(this, W / 2, 620, 440, 120, 'つづける', () => this.togglePause(), { size: 42 }));
    c.add(button(this, W / 2, 780, 440, 110, 'やめてタイトルへ', () => { this.togglePause(); this.sim.finish('dead'); }, { size: 34 }));
    pin(c);
    this.pauseLayer = c;
  }

  // ---------- 終わり ----------
  onEnd() {
    this.ended = true;
    this.resetJoystick();
    const result = this.s.result;
    const rec = recordRun(app.save, result, app.dateStr);
    persist();
    const delay = result.status === 'clear' ? 1600 : 1000;
    if (result.status === 'clear') this.banner('クリア！', '#2F6FE4');
    else this.tweens.add({ targets: this.hero, angle: 90, alpha: 0.5, duration: 500 });
    this.time.delayedCall(app.test ? 50 : delay, () => fadeTo(this, 'Result', { result, ...rec }));
  }

  // ---------- テスト用 ----------
  advance(ms) {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i++) {
      if (this.s.status !== 'playing') break;
      this.sim.step(this.testInput);
    }
    this.renderFrame(ms);
  }
}
