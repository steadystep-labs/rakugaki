import * as Phaser from '../../vendor/phaser.esm.min.js';
import { label, button, paper, underline, fadeTo, W } from '../ui/ui.js';
import { app, persist } from '../state.js';
import { defaultSave } from '../core/save.js';
import { setSoundEnabled } from '../fx/audio.js';

export class SettingsScene extends Phaser.Scene {
  constructor() { super('Settings'); }

  create() {
    this.cameras.main.fadeIn(160, 253, 254, 255);
    paper(this);
    label(this, W / 2, 130, 'せってい', 80);
    underline(this, W / 2, 190, 300, 0x2f6fe4, 6);
    this.layer = this.add.container(0, 0);
    this.confirmReset = false;
    this.draw();
    label(this, W / 2, 1040, 'セーブはこの端末の中だけに保存されます。\n名前などの個人情報は一切あつかいません。', 24, { color: '#8A8F98' });
    button(this, W / 2, 1170, 380, 100, 'もどる', () => fadeTo(this, 'Title'), { size: 36 });
  }

  draw() {
    this.layer.removeAll(true);
    const st = app.save.settings;
    const rows = [
      ['sound', '音', st.sound],
      ['shake', '画面のゆれ', st.shake],
      ['flash', '光る演出', st.flash],
    ];
    rows.forEach(([key, name, on], i) => {
      const y = 330 + i * 150;
      this.layer.add(label(this, 90, y, name, 40, { originX: 0 }));
      this.layer.add(button(this, W - 190, y, 220, 100, on ? 'オン' : 'オフ', () => this.toggle(key), { size: 36, fill: on ? 0xeef4fd : 0xffffff, seed: 60 + i }));
    });
    const resetText = this.confirmReset ? 'ほんとうに消す？（もう一度押す）' : 'セーブデータを消す';
    this.layer.add(button(this, W / 2, 830, 560, 100, resetText, () => this.reset(), { size: 30, seed: 90 }));
  }

  toggle(key) {
    app.save.settings[key] = !app.save.settings[key];
    if (key === 'sound') setSoundEnabled(app.save.settings.sound);
    persist();
    this.draw();
  }

  reset() {
    if (!this.confirmReset) { this.confirmReset = true; this.draw(); return; }
    const settings = app.save.settings;
    app.save = defaultSave();
    app.save.settings = settings;
    persist();
    this.confirmReset = false;
    this.draw();
  }
}
