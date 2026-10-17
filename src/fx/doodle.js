// 落書き風のテクスチャを、コードで描いて作る（画像ファイルなし）。
// 同じ絵を少しずつ揺らした3枚（_0, _1, _2）を作り、1秒に8回切り替えて手描きの「ラインボイル」を出す。

import { PALETTE, COLORS } from '../content/colors.js';
import { createRng } from '../core/rng.js';

export const BOIL_FRAMES = 3;
const INK = PALETTE.ink;

// ぶれた閉じた形（ふち＋ぬり）
function blobPoints(rng, cx, cy, rx, ry, n, rough) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + rng.range(-rough, rough);
    pts.push({ x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k });
  }
  return pts;
}

function drawPoly(g, pts, closed = true) {
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  if (closed) g.closePath();
}

function jitterLine(g, rng, x1, y1, x2, y2, j = 1.2, seg = 4) {
  g.beginPath();
  g.moveTo(x1 + rng.range(-j, j), y1 + rng.range(-j, j));
  for (let i = 1; i <= seg; i++) {
    const t = i / seg;
    g.lineTo(x1 + (x2 - x1) * t + rng.range(-j, j), y1 + (y2 - y1) * t + rng.range(-j, j));
  }
  g.strokePath();
}

function blob(g, rng, cx, cy, rx, ry, fill, line, width, rough = 0.1, n = 14) {
  const pts = blobPoints(rng, cx, cy, rx, ry, n, rough);
  if (fill !== null) { g.fillStyle(fill, 1); drawPoly(g, pts); g.fillPath(); }
  g.lineStyle(width, line, 1);
  drawPoly(g, pts);
  g.strokePath();
}

const DRAWERS = {
  hero(g, rng, s) {
    const c = s / 2;
    // マント（その日の色）
    g.fillStyle(COLORS.blue.hex, 1);
    drawPoly(g, [{ x: c - 16, y: c + 6 }, { x: c + 16, y: c + 6 }, { x: c + 22 + rng.range(-2, 2), y: c + 30 }, { x: c - 22 + rng.range(-2, 2), y: c + 30 }]);
    g.fillPath();
    blob(g, rng, c, c, 22, 22, PALETTE.white, INK, 5, 0.05, 16);
    // かぶと
    g.lineStyle(4, INK, 1);
    jitterLine(g, rng, c - 18, c - 8, c + 18, c - 8, 1, 5);
    jitterLine(g, rng, c, c - 22, c, c - 34, 1, 3);
    g.fillStyle(INK, 1);
    g.fillCircle(c - 7 + rng.range(-0.6, 0.6), c + 3, 3.4);
    g.fillCircle(c + 7 + rng.range(-0.6, 0.6), c + 3, 3.4);
  },
  crumb(g, rng, s) {
    const c = s / 2;
    blob(g, rng, c, c, 17, 15, PALETTE.enemyFill, PALETTE.enemyLine, 4, 0.18, 11);
    g.lineStyle(3, INK, 1);
    jitterLine(g, rng, c - 9, c - 5, c - 3, c - 2, 0.6, 2);
    jitterLine(g, rng, c + 9, c - 5, c + 3, c - 2, 0.6, 2);
  },
  runner(g, rng, s) {
    const c = s / 2;
    g.lineStyle(3, PALETTE.enemyLine, 0.8);
    for (let i = 0; i < 3; i++) jitterLine(g, rng, c - 26, c - 6 + i * 6, c - 15, c - 6 + i * 6, 0.8, 2);
    blob(g, rng, c + 2, c, 14, 9, PALETTE.enemyFill, PALETTE.enemyLine, 3.5, 0.15, 10);
    g.fillStyle(INK, 1);
    g.fillCircle(c + 8, c - 2, 2.6);
  },
  lump(g, rng, s) {
    const c = s / 2;
    blob(g, rng, c, c, 30, 27, PALETTE.enemyFill, PALETTE.enemyLine, 5, 0.22, 13);
    g.lineStyle(3, PALETTE.enemyLine, 1);
    jitterLine(g, rng, c - 14, c + 8, c + 4, c + 14, 1.5, 3);
    jitterLine(g, rng, c + 8, c - 16, c + 16, c - 4, 1.5, 3);
    g.lineStyle(3.5, INK, 1);
    jitterLine(g, rng, c - 13, c - 8, c - 4, c - 4, 0.6, 2);
    jitterLine(g, rng, c + 13, c - 8, c + 4, c - 4, 0.6, 2);
  },
  spitter(g, rng, s) {
    const c = s / 2;
    blob(g, rng, c, c, 17, 17, PALETTE.enemyFill, PALETTE.enemyLine, 4, 0.12, 12);
    blob(g, rng, c, c - 1, 8, 8, PALETTE.white, INK, 3, 0.05, 10);
    g.fillStyle(PALETTE.danger, 1);
    g.fillCircle(c + rng.range(-1, 1), c, 3.5);
  },
  boss(g, rng, s) {
    const c = s / 2;
    // 消しゴム本体
    const w = 74, h = 52;
    const pts = [
      { x: c - w + rng.range(-2, 2), y: c - h + rng.range(-2, 2) }, { x: c + w + rng.range(-2, 2), y: c - h + rng.range(-2, 2) },
      { x: c + w + rng.range(-2, 2), y: c + h + rng.range(-2, 2) }, { x: c - w + rng.range(-2, 2), y: c + h + rng.range(-2, 2) },
    ];
    g.fillStyle(0xf1f2f4, 1); drawPoly(g, pts); g.fillPath();
    g.lineStyle(6, INK, 1); drawPoly(g, pts); g.strokePath();
    // スリーブ（無地）
    g.fillStyle(PALETTE.enemyLine, 1);
    g.fillRect(c - w + 34, c - h + 3, 52, h * 2 - 6);
    g.lineStyle(3, INK, 1);
    jitterLine(g, rng, c - w + 40, c - 10, c - w + 80, c + 10, 1.5, 4);
    // 顔
    g.lineStyle(5, INK, 1);
    jitterLine(g, rng, c + 18, c - 20, c + 34, c - 12, 0.8, 2);
    jitterLine(g, rng, c + 58, c - 20, c + 42, c - 12, 0.8, 2);
    g.fillStyle(INK, 1);
    g.fillCircle(c + 28, c - 4, 4.5);
    g.fillCircle(c + 48, c - 4, 4.5);
    jitterLine(g, rng, c + 26, c + 22, c + 52, c + 20, 1.2, 4);
  },
  pencilShot(g, rng, s) {
    const c = s / 2;
    g.fillStyle(INK, 1);
    drawPoly(g, [{ x: c - 12, y: c - 3 }, { x: c + 8, y: c - 3 }, { x: c + 14, y: c }, { x: c + 8, y: c + 3 }, { x: c - 12, y: c + 3 }]);
    g.fillPath();
  },
  plane(g, rng, s) {
    const c = s / 2;
    const pts = [{ x: c + 16, y: c }, { x: c - 14, y: c - 12 + rng.range(-1, 1) }, { x: c - 7, y: c }, { x: c - 14, y: c + 12 + rng.range(-1, 1) }];
    g.fillStyle(PALETTE.white, 1); drawPoly(g, pts); g.fillPath();
    g.lineStyle(3, INK, 1); drawPoly(g, pts); g.strokePath();
    jitterLine(g, rng, c - 7, c, c + 16, c, 0.5, 2);
  },
  needle(g, rng, s) {
    const c = s / 2;
    g.fillStyle(INK, 1);
    drawPoly(g, [{ x: c, y: c - 15 }, { x: c + 5, y: c + 4 }, { x: c, y: c + 15 }, { x: c - 5, y: c + 4 }]);
    g.fillPath();
    g.fillStyle(PALETTE.white, 1);
    g.fillCircle(c, c + 3, 2);
  },
  enemyShot(g, rng, s) {
    const c = s / 2;
    g.lineStyle(5, PALETTE.danger, 1);
    jitterLine(g, rng, c - 9, c, c + 9, c, 1.2, 3);
    g.fillStyle(PALETTE.danger, 1);
    g.fillCircle(c + 8, c, 5);
  },
  xp(g, rng, s) {
    const c = s / 2;
    const col = COLORS.blue.hex;
    g.fillStyle(col, 1);
    drawPoly(g, [{ x: c, y: c - 11 }, { x: c + 7, y: c + 1 }, { x: c + 6, y: c + 6 }, { x: c, y: c + 9 }, { x: c - 6, y: c + 6 }, { x: c - 7, y: c + 1 }]);
    g.fillPath();
    g.fillStyle(PALETTE.white, 0.85);
    g.fillCircle(c - 2.5, c + 1, 2);
  },
  ink(g, rng, s) {
    const c = s / 2;
    g.fillStyle(INK, 1);
    drawPoly(g, [{ x: c, y: c - 13 }, { x: c + 9, y: c + 2 }, { x: c + 7, y: c + 8 }, { x: c, y: c + 11 }, { x: c - 7, y: c + 8 }, { x: c - 9, y: c + 2 }]);
    g.fillPath();
    g.fillStyle(PALETTE.white, 0.9);
    g.fillCircle(c - 3, c + 2, 2.4);
  },
  scrap(g, rng, s) {
    const c = s / 2;
    blob(g, rng, c, c, 5, 4, PALETTE.enemyFill, PALETTE.enemyLine, 2, 0.35, 6);
  },
  splash(g, rng, s) {
    const c = s / 2;
    g.fillStyle(PALETTE.white, 1); // 色は tint でつける
    const pts = blobPoints(rng, c, c, 7, 6, 8, 0.4);
    drawPoly(g, pts);
    g.fillPath();
  },
  crayon(g, rng, s) {
    const c = s / 2;
    g.fillStyle(COLORS.blue.hex, 0.55);
    for (let i = 0; i < 26; i++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(0, 10);
      g.fillCircle(c + Math.cos(a) * r, c + Math.sin(a) * r, rng.range(1.5, 3.5));
    }
  },
  smudge(g, rng, s) {
    const c = s / 2;
    g.fillStyle(PALETTE.enemyLine, 0.18);
    for (let i = 0; i < 30; i++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(0, 36);
      g.fillCircle(c + Math.cos(a) * r, c + Math.sin(a) * r, rng.range(4, 9));
    }
    g.lineStyle(2, PALETTE.danger, 0.5);
    blob(g, rng, c, c, 42, 42, null, PALETTE.danger, 2, 0.12, 14);
  },
  rulerIcon(g, rng, s) {
    const c = s / 2;
    const pts = [{ x: c - 22, y: c - 7 }, { x: c + 22, y: c - 7 + rng.range(-1, 1) }, { x: c + 22, y: c + 7 }, { x: c - 22, y: c + 7 + rng.range(-1, 1) }];
    g.fillStyle(PALETTE.white, 1); drawPoly(g, pts); g.fillPath();
    g.lineStyle(3, INK, 1); drawPoly(g, pts); g.strokePath();
    for (let i = 0; i < 7; i++) jitterLine(g, rng, c - 18 + i * 6, c - 7, c - 18 + i * 6, c - (i % 2 ? 2 : 0), 0.3, 1);
  },
  star(g, rng, s) {
    const c = s / 2;
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const r = (i % 2 ? 8 : 19) * (1 + rng.range(-0.08, 0.08));
      pts.push({ x: c + Math.cos(a) * r, y: c + Math.sin(a) * r });
    }
    g.fillStyle(0xfff4b0, 1); drawPoly(g, pts); g.fillPath();
    g.lineStyle(3, INK, 1); drawPoly(g, pts); g.strokePath();
  },
  heart(g, rng, s) {
    const c = s / 2;
    const pts = [];
    for (let i = 0; i < 24; i++) {
      const t = (i / 24) * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      pts.push({ x: c + x * 1.1 + rng.range(-0.6, 0.6), y: c + y * 1.1 + rng.range(-0.6, 0.6) });
    }
    g.fillStyle(PALETTE.danger, 1); drawPoly(g, pts); g.fillPath();
    g.lineStyle(3, INK, 1); drawPoly(g, pts); g.strokePath();
  },
  joyRing(g, rng, s) {
    const c = s / 2;
    g.lineStyle(4, INK, 0.5);
    drawPoly(g, blobPoints(rng, c, c, 70, 70, 20, 0.04));
    g.strokePath();
  },
  joyKnob(g, rng, s) {
    const c = s / 2;
    blob(g, rng, c, c, 26, 26, PALETTE.white, INK, 4, 0.06, 14);
  },
};

const SIZES = {
  hero: 96, crumb: 60, runner: 72, lump: 100, spitter: 60, boss: 200, pencilShot: 32, plane: 40, needle: 36,
  enemyShot: 32, xp: 28, ink: 32, scrap: 14, splash: 20, crayon: 28, smudge: 100, joyRing: 160, joyKnob: 64,
  rulerIcon: 56, star: 48, heart: 48,
};

// 1つの絵を、渡した Graphics にそのまま描く（拡大してもぼやけない。宣伝画像づくり用）
export function drawDoodle(g, name, frame = 0) {
  DRAWERS[name](g, createRng(1000 + frame * 31 + name.length * 7), SIZES[name]);
  return SIZES[name];
}

export function generateDoodles(scene) {
  for (const [name, draw] of Object.entries(DRAWERS)) {
    const size = SIZES[name];
    for (let f = 0; f < BOIL_FRAMES; f++) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      draw(g, createRng(1000 + f * 31 + name.length * 7), size);
      g.generateTexture(`${name}_${f}`, size, size);
      g.destroy();
    }
  }
  buildAtlas(scene);
  // 方眼ノートの1マス（タイル用）
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(PALETTE.paper, 1);
  g.fillRect(0, 0, 48, 48);
  g.lineStyle(2, PALETTE.grid, 1);
  g.lineBetween(0, 0.5, 48, 0.5);
  g.lineBetween(0.5, 0, 0.5, 48);
  g.lineStyle(1, PALETTE.grid, 0.6);
  g.lineBetween(0, 24.5, 48, 24.5);
  g.lineBetween(24.5, 0, 24.5, 48);
  g.generateTexture('grid', 48, 48);
  g.destroy();
}

// ゲーム画面用に、すべての落書きを1枚の大きな画像（'doodles'）にまとめる。
// 絵ごとに別の画像だと、描画のたびに切り替えが起きて重くなるため（2026-10-16）。フレーム名は '<名前>_<0〜2>'
export const ATLAS = 'doodles';
function buildAtlas(scene) {
  const items = [];
  for (const name of Object.keys(DRAWERS)) for (let f = 0; f < BOIL_FRAMES; f++) items.push({ key: `${name}_${f}`, size: SIZES[name] });
  items.sort((a, b) => b.size - a.size);
  const PAD = 2, W = 1024;
  let x = 0, y = 0, rowH = 0;
  for (const it of items) {
    if (x + it.size + PAD > W) { x = 0; y += rowH + PAD; rowH = 0; }
    it.x = x; it.y = y; x += it.size + PAD; rowH = Math.max(rowH, it.size);
  }
  const H = Math.pow(2, Math.ceil(Math.log2(y + rowH + PAD)));
  const atlas = scene.textures.createCanvas(ATLAS, W, H);
  const c = atlas.getContext();
  for (const it of items) {
    c.drawImage(scene.textures.get(it.key).getSourceImage(), it.x, it.y);
    atlas.add(it.key, 0, it.x, it.y, it.size, it.size);
  }
  // 白い点（バーなどを画像で描くため）
  c.fillStyle = '#ffffff';
  c.fillRect(W - 8, H - 8, 8, 8);
  atlas.add('px', 0, W - 6, H - 6, 4, 4);
  atlas.refresh();
}

// 手描き風の四角（ボタンや枠に使う）
export function wobblyRect(g, x, y, w, h, { fill = null, fillAlpha = 1, line = INK, width = 4, seed = 1 } = {}) {
  const rng = createRng(seed);
  const j = () => rng.range(-2, 2);
  const pts = [
    { x: x + j(), y: y + j() }, { x: x + w / 2 + j(), y: y + j() }, { x: x + w + j(), y: y + j() },
    { x: x + w + j(), y: y + h / 2 + j() }, { x: x + w + j(), y: y + h + j() }, { x: x + w / 2 + j(), y: y + h + j() },
    { x: x + j(), y: y + h + j() }, { x: x + j(), y: y + h / 2 + j() },
  ];
  if (fill !== null) { g.fillStyle(fill, fillAlpha); drawPoly(g, pts); g.fillPath(); }
  if (width > 0) { g.lineStyle(width, line, 1); drawPoly(g, pts); g.strokePath(); }
}
