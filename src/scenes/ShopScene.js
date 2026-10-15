import * as Phaser from '../../vendor/phaser.esm.min.js';
import { label, button, paper, underline, fadeTo, W } from '../ui/ui.js';
import { META_UPGRADES } from '../content/meta.js';
import { app, persist } from '../state.js';
import { sfx } from '../fx/audio.js';

export class ShopScene extends Phaser.Scene {
  constructor() { super('Shop'); }

  create() {
    this.cameras.main.fadeIn(160, 253, 254, 255);
    paper(this);
    label(this, W / 2, 130, 'ふでばこ', 80);
    underline(this, W / 2, 190, 300, 0x2f6fe4, 6);
    label(this, W / 2, 245, 'インクで、ずっと強くなる', 28, { color: '#5A5F69' });
    this.inkIcon = this.add.image(W / 2 - 60, 310, 'ink_0');
    this.inkText = label(this, W / 2 - 36, 310, `${app.save.ink}`, 40, { originX: 0 });
    this.rows = this.add.container(0, 0);
    this.drawRows();
    button(this, W / 2, 1170, 380, 100, 'もどる', () => fadeTo(this, 'Title'), { size: 36 });
  }

  drawRows() {
    this.rows.removeAll(true);
    Object.entries(META_UPGRADES).forEach(([id, u], i) => {
      const y = 420 + i * 145;
      const lv = app.save.meta[id] || 0;
      const maxed = lv >= u.max;
      const cost = maxed ? 0 : u.cost[lv];
      this.rows.add(label(this, 60, y - 26, u.name, 38, { originX: 0 }));
      this.rows.add(label(this, 60, y + 24, u.desc, 23, { originX: 0, color: '#5A5F69', wrap: 380, align: 'left' }));
      const pips = '●'.repeat(lv) + '○'.repeat(u.max - lv);
      this.rows.add(label(this, 300, y - 26, pips, 24, { color: '#2F6FE4', originX: 0 }));
      const b = button(this, 600, y, 190, 96, maxed ? 'MAX' : `${cost}`, () => this.buy(id), {
        size: 34, sub: maxed ? '' : 'インク', subSize: 20, disabled: maxed || app.save.ink < cost, seed: 40 + i,
      });
      this.rows.add(b);
    });
  }

  buy(id) {
    const u = META_UPGRADES[id];
    const lv = app.save.meta[id] || 0;
    if (lv >= u.max) return;
    const cost = u.cost[lv];
    if (app.save.ink < cost) return;
    app.save.ink -= cost;
    app.save.meta[id] = lv + 1;
    persist();
    sfx.levelup();
    this.inkText.setText(`${app.save.ink}`);
    this.drawRows();
  }
}
