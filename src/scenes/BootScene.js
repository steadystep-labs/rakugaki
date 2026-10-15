import * as Phaser from '../../vendor/phaser.esm.min.js';
import { generateDoodles } from '../fx/doodle.js';
import { initApp, app } from '../state.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    initApp();
    generateDoodles(this);
    const go = () => this.scene.start('Title');
    // 手書き風フォントの読み込みを待つ（失敗しても先へ進む）
    if (document.fonts && document.fonts.load) {
      Promise.race([
        document.fonts.load('40px Rakugaki'),
        new Promise((r) => setTimeout(r, 2500)),
      ]).then(go, go);
    } else {
      go();
    }
    globalThis.__appReady = true;
    if (app.test) globalThis.__gameTextures = this.textures;
  }
}
