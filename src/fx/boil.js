// ラインボイル：落書きの絵を1秒に8回、少しずつ違う版に差し替えて手描き感を出す。

import { BOIL_FRAMES } from './doodle.js';

export function createBoil(scene) {
  let frame = 0;
  let acc = 0;
  const items = new Set();
  return {
    frame: () => frame,
    add(img, key) { img.boilKey = key; img.setTexture(`${key}_${frame}`); items.add(img); return img; },
    remove(img) { items.delete(img); },
    tick(deltaMs) {
      acc += deltaMs;
      if (acc < 125) return false;
      acc = 0;
      frame = (frame + 1) % BOIL_FRAMES;
      for (const img of items) {
        if (!img.active) { items.delete(img); continue; }
        img.setTexture(`${img.boilKey}_${frame}`);
      }
      return true;
    },
  };
}
