import * as Phaser from '../../vendor/phaser.esm.min.js';
import { label, button, paper, underline, fadeTo, W } from '../ui/ui.js';
import { CHRONICLE, VOICES, LORE, CURRENT_DAY } from '../content/chronicle.js';
import { COLORS } from '../content/colors.js';
import { wobblyRect } from '../fx/doodle.js';
import { app, persist } from '../state.js';

// ノート：年表（Dayごとのページ）・白紙の扉・かけら
export class NoteScene extends Phaser.Scene {
  constructor() { super('Note'); }

  create() {
    this.cameras.main.fadeIn(160, 253, 254, 255);
    paper(this);
    if (app.save.seenDay < CURRENT_DAY) { app.save.seenDay = CURRENT_DAY; persist(); }
    label(this, W / 2, 110, 'ノート', 80);
    underline(this, W / 2, 168, 240, 0x2f6fe4, 6);

    // 年表（新しい日が上）
    let y = 240;
    label(this, 60, y, 'みんなで描いた年表', 32, { originX: 0, color: '#5A5F69' });
    y += 60;
    for (const p of [...CHRONICLE].reverse().slice(0, 3)) {
      const col = COLORS[p.color]?.css || '#2E3138';
      label(this, 60, y, `Day ${p.day}`, 34, { originX: 0, color: col });
      label(this, 190, y, p.title, 32, { originX: 0 });
      label(this, 190, y + 52, p.text, 24, { originX: 0, color: '#3B3F47', wrap: 470, align: 'left' });
      label(this, W - 60, y + 112, `描いた人：${p.by}`, 22, { originX: 1, color: '#8A8F98' });
      y += 170;
    }

    // 白紙の扉
    y += 20;
    label(this, 60, y, '白紙の扉', 32, { originX: 0, color: '#5A5F69' });
    const g = this.add.graphics();
    wobblyRect(g, 60, y + 40, 170, 250, { fill: 0xffffff, width: 5, seed: 77 });
    g.fillStyle(0x2e3138, 1); g.fillCircle(200, y + 170, 7);
    const next = VOICES.milestones.find((m) => m > VOICES.count) || VOICES.milestones[VOICES.milestones.length - 1];
    label(this, 270, y + 80, `とどいた声：${VOICES.count}`, 34, { originX: 0 });
    label(this, 270, y + 130, `つぎの変化まで：あと ${Math.max(0, next - VOICES.count)}`, 26, { originX: 0, color: '#5A5F69' });
    const bar = this.add.graphics();
    const bw = 380;
    bar.fillStyle(0xffffff, 1); bar.fillRect(270, y + 170, bw, 18);
    bar.fillStyle(COLORS.blue.hex, 1); bar.fillRect(270, y + 170, bw * Math.min(1, VOICES.count / next), 18);
    bar.lineStyle(3, 0x2e3138, 1); bar.strokeRect(270, y + 170, bw, 18);
    label(this, 270, y + 240, 'Xでの要望（リプ）が、扉にとどく声になる', 22, { originX: 0, color: '#8A8F98', wrap: 400, align: 'left' });

    // かけら
    y += 330;
    label(this, 60, y, 'かけら', 32, { originX: 0, color: '#5A5F69' });
    LORE.forEach((f, i) => {
      const open = app.save.lore[f.id] || (f.unlock.type === 'voices' && VOICES.count >= f.unlock.value);
      label(this, 80, y + 55 + i * 50, open ? `・${f.text}` : '・？？？', 26, { originX: 0, color: open ? '#2E3138' : '#A9AEB6' });
    });

    button(this, W / 2, 1200, 380, 96, 'もどる', () => fadeTo(this, 'Title'), { size: 36 });
  }
}
