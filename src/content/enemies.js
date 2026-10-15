// 敵（ケシカス）の定義。behavior は sim.js の挙動の種類。
// hp・速さは時間で少しずつ強くなる（sim.js の scaleAt を参照）。

export const ENEMIES = {
  crumb: {
    name: 'ケシカス', behavior: 'chase', radius: 18, hp: 10, speed: 88, damage: 7, xp: 1, from: 0,
  },
  runner: {
    name: 'はしりケシカス', behavior: 'chase', radius: 13, hp: 7, speed: 165, damage: 6, xp: 1, from: 45,
  },
  lump: {
    name: 'かたまりケシカス', behavior: 'chase', radius: 30, hp: 45, speed: 62, damage: 10, xp: 4, from: 90,
    splitInto: { type: 'crumb', count: 2 },
  },
  spitter: {
    name: 'とびケシカス', behavior: 'keepAway', radius: 17, hp: 18, speed: 95, damage: 6, xp: 2, from: 150,
    keepDistance: 260, shootEvery: 2.6, shotSpeed: 260, shotDamage: 10,
  },
  boss: {
    name: 'おおけしごむ', behavior: 'boss', radius: 64, hp: 3600, speed: 72, damage: 22, xp: 0, from: 300,
    chargeEvery: 4.2, chargeSpeed: 520, chargeTime: 0.75, rubLife: 3.0, rubDps: 18, summonEvery: 6,
  },
};

export const BOSS_TIME = 300; // 秒
export const MAX_ENEMIES = 300;
