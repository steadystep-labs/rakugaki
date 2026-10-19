// 武器の定義。毎日の要望はここに1件足すだけで入るようにする。
// level は 1〜5。stats(level) がその段階の性能を返す。
// kind は sim.js の挙動の種類：'shot' | 'swing' | 'orbit' | 'homing' | 'trail'

export const WEAPONS = {
  pencil: {
    name: 'えんぴつ',
    desc: 'いちばん近い敵へ芯を飛ばす',
    color: 'black',
    kind: 'shot',
    addedDay: 0,
    by: 'くろ',
    stats: (lv) => ({
      cooldown: [0.75, 0.7, 0.64, 0.58, 0.5][lv - 1],
      damage: [10, 12, 14, 16, 19][lv - 1],
      count: [1, 1, 2, 2, 3][lv - 1],
      pierce: [0, 0, 0, 1, 1][lv - 1],
      speed: 760,
      radius: 7,
      life: 1.1,
    }),
    levelText: ['', 'いりょく+', '2本になる', 'いりょく+', '3本・つらぬく'],
  },
  ruler: {
    name: 'じょうぎ',
    desc: '進む方向をなぎはらう。はじき返す力が強い',
    color: 'black',
    kind: 'swing',
    addedDay: 0,
    by: 'くろ',
    stats: (lv) => ({
      cooldown: [1.5, 1.4, 1.3, 1.2, 1.05][lv - 1],
      damage: [16, 19, 22, 26, 30][lv - 1],
      reach: [130, 140, 150, 165, 180][lv - 1],
      arc: [1.75, 1.9, 2.05, 2.2, 2.5][lv - 1], // ラジアン
      knockback: 260,
      both: lv >= 5, // Lv5で前後両方
    }),
    levelText: ['', 'いりょく+', 'とどく範囲+', 'いりょく+', '前後をなぎはらう'],
  },
  compass: {
    name: 'コンパス',
    desc: 'まわりを針がまわる',
    color: 'black',
    kind: 'orbit',
    addedDay: 0,
    by: 'くろ',
    stats: (lv) => ({
      count: [1, 2, 2, 3, 4][lv - 1],
      damage: [9, 10, 12, 13, 15][lv - 1],
      radius: [105, 110, 120, 125, 135][lv - 1],
      angularSpeed: [3.2, 3.4, 3.6, 3.8, 4.2][lv - 1],
      hitRadius: 16,
      rehit: 0.45, // 同じ敵に当たり直すまでの秒数
    }),
    levelText: ['', '針が2本', 'いりょく+', '針が3本', '針が4本・はやい'],
  },
  plane: {
    name: 'かみひこうき',
    desc: 'ゆっくり敵を追いかけて、つらぬく',
    color: 'black',
    kind: 'homing',
    addedDay: 0,
    by: 'くろ',
    stats: (lv) => ({
      cooldown: [2.2, 2.0, 1.85, 1.7, 1.5][lv - 1],
      damage: [14, 16, 18, 21, 24][lv - 1],
      count: [1, 1, 2, 2, 3][lv - 1],
      pierce: [3, 4, 4, 5, 6][lv - 1],
      speed: 330,
      turn: 4.0,
      radius: 12,
      life: 3.2,
    }),
    levelText: ['', 'つらぬく回数+', '2機になる', 'いりょく+', '3機になる'],
  },
  crayonBlue: {
    name: 'あおいクレヨン',
    desc: '歩いた跡に青い線。ふれた敵はおそくなる',
    color: 'blue',
    kind: 'trail',
    addedDay: 0,
    by: 'くろ',
    stats: (lv) => ({
      interval: 0.1,
      life: [1.8, 2.0, 2.3, 2.6, 3.0][lv - 1],
      dps: [6, 8, 10, 12, 15][lv - 1],
      slow: [0.35, 0.4, 0.45, 0.5, 0.55][lv - 1],
      width: [18, 20, 22, 24, 28][lv - 1],
    }),
    levelText: ['', '線が長持ち', 'いりょく+', 'もっとおそくする', '太い線'],
  },
  stampGreen: {
    name: 'みどりのはんこ',
    desc: '足もとにポン！まわりの敵をはじき飛ばす',
    color: 'green',
    kind: 'pulse',
    addedDay: 1,
    by: 'くろ',
    stats: (lv) => ({
      cooldown: [3.4, 3.2, 3.0, 2.8, 2.4][lv - 1],
      damage: [10, 12, 15, 18, 22][lv - 1],
      radius: [140, 150, 165, 180, 200][lv - 1],
      knockback: [380, 400, 420, 440, 480][lv - 1],
    }),
    levelText: ['', 'いりょく+', 'ひろく押す', 'いりょく+', 'もっとひろく・はやく'],
  },
};

export const WEAPON_MAX_LEVEL = 5;
export const WEAPON_SLOTS = 4;
export const STARTING_WEAPON = 'pencil';
