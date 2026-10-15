// 自動テスト用の差し込み口。URLに ?test=1 があるときだけ有効になる。
// - window.advanceTime(ms)：ゲームの時間を決まった分だけ進める（自動では進まない）
// - window.render_game_to_text()：今の状態を短いJSON文字列で返す
// - window.__test：モード開始・入力・選択などの操作

import { app } from '../state.js';

export function installTestHooks(game) {
  if (!app.test) return;
  const active = () => game.scene.getScenes(true)[0];
  const gameScene = () => {
    const s = game.scene.getScene('Game');
    return s && s.scene.isActive() ? s : null;
  };
  // 今の画面から切り替える（同じ画面なら作り直し）。全部止めてから始めると、止める処理が後から効いて画面が消えるため。
  const switchTo = (key, data) => {
    const a = active();
    if (a) a.scene.start(key, data);
    else game.scene.start(key, data);
  };

  globalThis.__test = {
    scene: () => active()?.scene.key || null,
    start: (mode = 'free', seed = 1, anomaly = null) => switchTo('Game', { mode, seed, anomaly }),
    goto: (key, data) => switchTo(key, data),
    input: (x, y) => { const g = gameScene(); if (g) g.testInput = { x, y }; },
    choose: (i) => { const g = gameScene(); if (g) g.pick(i); },
    // 指を置いたまま選んだ場合（そのままスティックになるか）の確認用
    chooseHolding: (i) => { const g = gameScene(); if (g) { g.pick(i, { isDown: true, id: 99, x: 300, y: 900 }); return g.joy.id; } return null; },
    finish: (status) => { const g = gameScene(); if (g) g.sim.finish(status); },
    setHp: (hp) => { const g = gameScene(); if (g) g.s.hero.hp = hp; },
    save: () => JSON.parse(JSON.stringify(app.save)),
  };

  globalThis.advanceTime = (ms) => {
    const g = gameScene();
    if (g) g.advance(ms);
  };

  globalThis.render_game_to_text = () => {
    const g = gameScene();
    if (!g) return JSON.stringify({ scene: active()?.scene.key || null });
    const o = JSON.parse(g.sim.toText());
    o.scene = 'Game';
    o.ui = { levelUpOpen: g.levelUpOpen, paused: g.paused, ended: g.ended };
    return JSON.stringify(o);
  };
}
