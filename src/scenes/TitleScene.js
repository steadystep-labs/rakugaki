import * as Phaser from '../../vendor/phaser.esm.min.js';
import { label, button, paper, underline, fadeTo, W, H } from '../ui/ui.js';
import { createBoil } from '../fx/boil.js';
import { app, anomalyName, playedDailyToday, refreshDate } from '../state.js';
import { dailySeed } from '../core/rng.js';
import { CURRENT_DAY } from '../content/chronicle.js';

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    refreshDate();
    this.cameras.main.fadeIn(180, 253, 254, 255);
    paper(this);
    this.boil = createBoil(this);

    const title = label(this, W / 2, 210, 'らくがき勇者', 104);
    title.setRotation(-0.03);
    underline(this, W / 2, 285, 470, 0x2f6fe4, 7);
    label(this, W / 2, 345, `Day ${CURRENT_DAY}　みんなの声で、毎日ふえていく`, 30, { color: '#5A5F69' });

    const hero = this.boil.add(this.add.image(W / 2, 540, 'hero_0').setScale(2.2), 'hero');
    this.tweens.add({ targets: hero, y: 525, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // インク残高
    this.boil.add(this.add.image(W - 160, 60, 'ink_0'), 'ink');
    label(this, W - 140, 60, `${app.save.ink}`, 34, { originX: 0 });

    button(this, W / 2, 740, 540, 124, '自由帳であそぶ', () => this.startRun('free'), { size: 44, sub: '何回でも。毎回ちがう展開', subSize: 22 });

    const played = playedDailyToday();
    button(this, W / 2, 890, 540, 132, '今日のページ', () => this.startRun('daily'), { size: 44, sub: `みんな同じ展開＋きょうの異変「${anomalyName(app.todayAnomaly)}」`, subSize: 22, fill: played ? 0xffffff : 0xeef4fd });
    label(this, W / 2, 976, played ? '本番はおわり。何回でも練習できる' : '本番は1日1回。結果をシェアしてくらべよう', 22, { color: '#5A5F69' });

    button(this, W / 2 - 185, 1090, 165, 100, 'ふでばこ', () => fadeTo(this, 'Shop'), { size: 30 });
    const note = button(this, W / 2, 1090, 165, 100, 'ノート', () => fadeTo(this, 'Note'), { size: 30 });
    button(this, W / 2 + 185, 1090, 165, 100, 'せってい', () => fadeTo(this, 'Settings'), { size: 30 });
    if (app.save.seenDay < CURRENT_DAY) {
      const badge = label(this, 70, -48, 'NEW', 24, { color: '#2F6FE4' });
      badge.setRotation(0.2);
      note.add(badge);
      this.tweens.add({ targets: badge, scale: 1.15, duration: 500, yoyo: true, repeat: -1 });
    }

    label(this, W / 2, H - 60, 'このゲームは個人情報を集めません', 22, { color: '#8A8F98' });
  }

  startRun(mode) {
    const seed = mode === 'daily' ? dailySeed(app.dateStr) : (Date.now() ^ 0x5bd1e995) >>> 0;
    const anomaly = mode === 'daily' ? app.todayAnomaly : null;
    fadeTo(this, 'Game', { mode, seed, anomaly });
  }

  update(time, delta) { this.boil.tick(delta); }
}
