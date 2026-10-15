// きょうの異変：「今日のページ」だけに効く特殊ルール。
// ルール変更系の要望はここに足す（1日限り。好評なら常設モードに昇格）。
// mods は sim.js が読む補正値。

export const ANOMALIES = {
  giant: {
    name: 'ケシカスがでかい',
    desc: '敵が大きく、おそく、かたい',
    by: 'くろ',
    mods: { enemyRadiusMul: 1.45, enemySpeedMul: 0.8, enemyHpMul: 1.6, xpMul: 1.3 },
  },
  earlyBird: {
    name: 'はやおき',
    desc: 'なにもかもが1.3倍速',
    by: 'くろ',
    mods: { timeScale: 1.3 },
  },
  dark: {
    name: 'まっくら',
    desc: '勇者のまわりしか見えない',
    by: 'くろ',
    mods: { darkness: 230 },
  },
};

// 日替わりで使う異変の順番（日付のシードで選ぶ）
export const ANOMALY_ROTATION = ['giant', 'earlyBird', 'dark'];
