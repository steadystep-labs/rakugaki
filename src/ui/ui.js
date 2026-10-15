// 画面の部品（文字・ボタン・紙の背景）。すべて手描き風にそろえる。

import { wobblyRect } from '../fx/doodle.js';
import { sfx, unlockAudio } from '../fx/audio.js';

export const FONT = 'Rakugaki, "Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif';
export const W = 720;
export const H = 1280;

export function label(scene, x, y, str, size = 36, opts = {}) {
  const t = scene.add.text(x, y, str, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color: opts.color || '#2E3138',
    align: opts.align || 'center',
    lineSpacing: opts.lineSpacing ?? Math.round(size * 0.25),
    wordWrap: opts.wrap ? { width: opts.wrap, useAdvancedWrap: true } : undefined,
    padding: { top: 6, bottom: 6 },
  });
  t.setOrigin(opts.originX ?? 0.5, opts.originY ?? 0.5);
  return t;
}

// ボタン：指を離したときに反応する。押した瞬間に少し縮む。
export function button(scene, x, y, w, h, text, onTap, opts = {}) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const draw = (fill) => { g.clear(); wobblyRect(g, -w / 2, -h / 2, w, h, { fill, width: opts.width ?? 4, seed: opts.seed ?? text.length * 13 }); };
  draw(opts.fill ?? 0xffffff);
  const t = label(scene, 0, opts.sub ? -h * 0.13 : 0, text, opts.size || 38);
  c.add([g, t]);
  if (opts.sub) c.add(label(scene, 0, h * 0.24, opts.sub, opts.subSize || 24, { color: '#5A5F69' }));
  const zone = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
  c.add(zone);
  let pressed = false;
  zone.on('pointerdown', (pointer) => {
    unlockAudio();
    // fireOnDown：押した瞬間に決定する（レベルアップの選択で、そのまま指を動かせるように）
    if (opts.fireOnDown) { if (!opts.disabled) { sfx.select(); onTap(pointer); } return; }
    pressed = true;
    scene.tweens.add({ targets: c, scale: 0.95, duration: 60 });
  });
  zone.on('pointerout', () => { if (pressed) { pressed = false; scene.tweens.add({ targets: c, scale: 1, duration: 90 }); } });
  zone.on('pointerup', () => {
    if (!pressed) return;
    pressed = false;
    scene.tweens.add({ targets: c, scale: 1, duration: 120, ease: 'Back.Out' });
    if (opts.disabled) return;
    sfx.select();
    onTap();
  });
  c.setDisabled = (d) => { opts.disabled = d; c.setAlpha(d ? 0.45 : 1); };
  if (opts.disabled) c.setAlpha(0.45);
  c.zone = zone;
  c.redraw = draw;
  return c;
}

// 方眼ノートの背景（画面に固定）
export function paper(scene) {
  return scene.add.tileSprite(W / 2, H / 2, W, H, 'grid').setScrollFactor(0).setDepth(-10);
}

// 手描きの横線（見出しの下線など）
export function underline(scene, x, y, w, color = 0x2e3138, width = 4) {
  const g = scene.add.graphics();
  g.lineStyle(width, color, 1);
  g.beginPath();
  g.moveTo(x - w / 2, y + 1);
  g.lineTo(x - w / 6, y - 2);
  g.lineTo(x + w / 6, y + 2);
  g.lineTo(x + w / 2, y - 1);
  g.strokePath();
  return g;
}

// 画面に固定する（コンテナの中身も含めて）。中身がずれたまま固定されると、押せる位置がずれるため。
export function pin(obj) {
  obj.setScrollFactor(0);
  if (obj.list) obj.list.forEach(pin);
  return obj;
}

export function fadeTo(scene, key, data) {
  scene.cameras.main.fadeOut(160, 253, 254, 255);
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
}
