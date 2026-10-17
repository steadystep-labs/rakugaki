// 能力アップ（1回の挑戦の中だけ有効）。各レベル1〜5。

export const PASSIVES = {
  shoes: { name: 'くつ', desc: 'うごく速さ +10%', color: 'black', apply: (p, lv) => { p.moveMul *= 1 + 0.1 * lv; } },
  bandage: { name: 'ばんそうこう', desc: '最大HP +12', color: 'black', apply: (p, lv) => { p.maxHpAdd += 12 * lv; } },
  magnet: { name: 'じしゃく', desc: 'しずくを拾える範囲 +15%', color: 'black', max: 3, apply: (p, lv) => { p.pickupMul *= 1 + 0.15 * lv; } },
  sharp: { name: 'とがった芯', desc: 'いりょく +10%', color: 'black', apply: (p, lv) => { p.damageMul *= 1 + 0.1 * lv; } },
  quick: { name: 'はやがき', desc: '攻撃の間かく -8%', color: 'black', apply: (p, lv) => { p.cooldownMul *= 1 - 0.08 * lv; } },
  margin: { name: 'よはく', desc: 'しずくの量 +12%', color: 'black', max: 3, apply: (p, lv) => { p.xpMul *= 1 + 0.12 * lv; } },
};

export const PASSIVE_MAX_LEVEL = 5; // 個別に max があればそちらが優先（じしゃく・よはくは3）
export const passiveMax = (id) => PASSIVES[id].max ?? PASSIVE_MAX_LEVEL;
export const PASSIVE_SLOTS = 4;
