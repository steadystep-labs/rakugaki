import * as Phaser from '../../vendor/phaser.esm.min.js';
import { label, button, paper, underline, fadeTo, W, H } from '../ui/ui.js';
import { app, anomalyName } from '../state.js';
import { buildShareText, xIntentUrl, shareWithImage, formatTime, AFTER_CLEAR_CHOICES, buildAfterClearText } from '../core/share.js';
import { PALETTE } from '../content/colors.js';
import { LORE } from '../content/chronicle.js';

export class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }

  init(data) { this.data2 = data; }

  create() {
    const { result, official, unlocked = [] } = this.data2;
    this.cameras.main.fadeIn(200, 253, 254, 255);
    paper(this);
    const clear = result.status === 'clear';
    label(this, W / 2, 200, clear ? 'クリア！' : 'やられた…', 96, { color: clear ? '#2F6FE4' : '#2E3138' }).setRotation(-0.03);
    underline(this, W / 2, 270, 360, clear ? 0x2f6fe4 : 0x2e3138, 6);
    const modeText = result.mode === 'daily' ? `今日のページ（異変：${anomalyName(result.anomaly)}）${official ? '　本番' : '　練習'}` : '自由帳';
    label(this, W / 2, 330, modeText, 28, { color: '#5A5F69' });

    const rows = [
      ['生きのびた時間', formatTime(result.time)],
      ['レベル', `${result.level}`],
      ['たおしたケシカス', `${result.kills}`],
      ['持ち帰ったインク', `+${Math.floor(result.ink)}`],
    ];
    rows.forEach(([k, v], i) => {
      const y = 440 + i * 78;
      label(this, 130, y, k, 34, { originX: 0 });
      label(this, W - 130, y, v, 40, { originX: 1 });
    });
    // 1分ごとのマス（絵文字はフォントによって崩れるので、絵で描く）
    const full = clear ? 5 : Math.min(5, Math.floor(result.time / 60));
    const bg = this.add.graphics();
    for (let i = 0; i < 5; i++) {
      const x = W / 2 - 2.5 * 70 + i * 70 + 6;
      bg.fillStyle(i < full ? 0x2f6fe4 : 0xffffff, 1); bg.fillRect(x, 742, 56, 56);
      bg.lineStyle(4, 0x2e3138, 1); bg.strokeRect(x, 742, 56, 56);
    }

    let y = clear ? 832 : 850;
    for (const id of unlocked) {
      const f = LORE.find((l) => l.id === id);
      if (!f) continue;
      label(this, W / 2, y, 'かけらを見つけた（ノートで読める）', 28, { color: '#2F6FE4' });
      y += 50;
    }

    // クリアした人には「このあと、どうなってほしい？」を聞く（次の展開はプレイヤーの声で決める）
    const top = clear ? 1010 : 960;
    if (clear) button(this, W / 2, 905, 560, 92, 'クリアのあと、どうなってほしい？', () => this.askAfterClear(), { size: 32, fill: 0xfff6c7 });
    button(this, W / 2, top, 480, 104, 'もう一回', () => this.again(result), { size: 40 });
    button(this, W / 2 - 125, top + 130, 230, 96, 'シェア', () => this.share(result), { size: 34, fill: 0xeef4fd });
    button(this, W / 2 + 125, top + 130, 230, 96, 'タイトルへ', () => fadeTo(this, 'Title'), { size: 32 });
    this.toast = label(this, W / 2, Math.min(1240, top + 215), '', 26, { color: '#5A5F69' });
  }

  askAfterClear() {
    const c = this.add.container(0, 0).setDepth(50);
    const bg = this.add.graphics();
    bg.fillStyle(PALETTE.paper, 0.97); bg.fillRect(0, 0, W, H);
    c.add(bg);
    c.add(label(this, W / 2, 230, 'クリアのあと、\nどうなってほしい？', 52));
    c.add(label(this, W / 2, 370, 'えらぶと、答えが入ったXの投稿画面がひらくよ。\nこのゲームは答えを集めない（送るかはあなたが決める）', 22, { color: '#5A5F69' }));
    const status = label(this, W / 2, 1060, '', 26, { color: '#2F6FE4' });
    const send = async (choice) => {
      const text = buildAfterClearText(choice, location.origin + location.pathname);
      const w = window.open(xIntentUrl(text), '_blank', 'noopener');
      if (w) { status.setText('ありがとう！ Xの画面で送ってね'); return; }
      try { await navigator.clipboard.writeText(text); status.setText('文字をコピーしたよ。Xに貼って送ってね'); } catch (e) { status.setText('うまく開けなかった'); }
    };
    [...AFTER_CLEAR_CHOICES, null].forEach((ch, i) => {
      c.add(button(this, W / 2, 500 + i * 118, 600, 100, ch || 'そのほか（自分で書く）', () => send(ch), { size: 32, seed: 70 + i }));
    });
    c.add(status);
    c.add(button(this, W / 2, 1160, 320, 90, 'とじる', () => c.destroy(), { size: 32, seed: 99 }));
  }

  again(result) {
    const seed = result.mode === 'daily' ? result.seed : (Date.now() ^ 0x5bd1e995) >>> 0;
    fadeTo(this, 'Game', { mode: result.mode, seed, anomaly: result.anomaly });
  }

  async share(result) {
    const url = location.origin + location.pathname;
    const text = buildShareText(result, { day: app.day, anomalyName: anomalyName(result.anomaly), url });
    const blob = await makeDiaryImage(result, app.day).catch(() => null);
    const ok = await shareWithImage(text, blob);
    if (ok) return;
    // 共有シートが使えない環境：Xの投稿画面を開く（APIは使わない）
    const w = window.open(xIntentUrl(text), '_blank', 'noopener');
    if (!w) {
      try { await navigator.clipboard.writeText(text); this.toast.setText('文字をコピーしたよ'); } catch (e) { this.toast.setText('シェアできなかった'); }
    }
  }
}

// 絵日記1ページの画像を端末内で作る（外部へは送らない）
export function makeDiaryImage(result, day) {
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1080;
  const g = c.getContext('2d');
  g.fillStyle = '#FDFEFF'; g.fillRect(0, 0, 1080, 1080);
  g.strokeStyle = '#D6E4F3'; g.lineWidth = 2;
  for (let i = 0; i <= 1080; i += 54) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 1080); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(1080, i); g.stroke(); }
  const font = (px) => `${px}px Rakugaki, "Hiragino Maru Gothic ProN", sans-serif`;
  g.fillStyle = '#2E3138'; g.textAlign = 'center';
  g.font = font(96); g.fillText('らくがき勇者', 540, 190);
  g.fillStyle = '#2F6FE4'; g.fillRect(300, 220, 480, 10);
  g.fillStyle = '#5A5F69'; g.font = font(48);
  g.fillText(`Day ${day}　${result.mode === 'daily' ? '今日のページ' : '自由帳'}`, 540, 320);
  g.fillStyle = result.status === 'clear' ? '#2F6FE4' : '#2E3138';
  g.font = font(150); g.fillText(result.status === 'clear' ? 'クリア！' : formatTime(result.time), 540, 560);
  g.fillStyle = '#2E3138'; g.font = font(56);
  g.fillText(`Lv ${result.level}　ケシカス ${result.kills}体`, 540, 700);
  g.font = font(80); g.fillText(progressBar(result), 540, 850);
  g.fillStyle = '#8A8F98'; g.font = font(40); g.fillText('#らくがき勇者', 540, 990);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('no blob'))), 'image/png'));
}
