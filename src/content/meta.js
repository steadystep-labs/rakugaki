// ふでばこ：インクで買う永続強化。

export const META_UPGRADES = {
  hp: { name: 'たいりょく', desc: '最大HP +8', max: 5, cost: [15, 30, 55, 90, 140] },
  dmg: { name: 'いりょく', desc: 'いりょく +8%', max: 5, cost: [20, 40, 70, 110, 160] },
  spd: { name: 'はやさ', desc: 'うごく速さ +4%', max: 5, cost: [15, 30, 55, 90, 140] },
  range: { name: 'ひろう範囲', desc: 'しずくを拾える範囲 +8%', max: 5, cost: [10, 25, 45, 75, 115] },
  revive: { name: 'ふっかつ', desc: '1回だけ、やられても半分のHPで立ち上がる', max: 1, cost: [250] },
};

// 永続強化をプレイヤーの補正値に変換する
export function applyMeta(p, meta) {
  p.maxHpAdd += 8 * (meta.hp || 0);
  p.damageMul *= 1 + 0.08 * (meta.dmg || 0);
  p.moveMul *= 1 + 0.04 * (meta.spd || 0);
  p.pickupMul *= 1 + 0.08 * (meta.range || 0);
  p.revives = meta.revive || 0;
}
