// ノート（年表）。1日1ページ。くろが毎日更新する。
// by は要望者の表記（XのID、または「くろ」「名もなき絵描き」）。
// 要望の原文はここに書かない（くろが書き直した文章だけ）。

export const CURRENT_DAY = 0;

export const CHRONICLE = [
  {
    day: 0,
    date: '2026-10-13',
    title: 'らくがきの勇者が描かれた',
    text: 'まっしろなノートのすみに、ちいさな勇者がひとり。さいしょの色は、あお。',
    by: 'くろ',
    color: 'blue',
    adds: ['えんぴつ', 'じょうぎ', 'コンパス', 'かみひこうき', 'あおいクレヨン'],
  },
];

// 白紙の扉：Xに届いた声（リプ）の数。くろが数えた実数だけを入れる。
export const VOICES = {
  count: 0,
  countedAt: '2026-10-13',
  milestones: [10, 30, 100, 300, 1000],
};

// かけら（世界の断片）。unlock の条件は sim/save 側で判定する。
export const LORE = [
  { id: 'f1', text: 'このノートの持ち主は、もう描いていない。', unlock: { type: 'firstClear' } },
  { id: 'f2', text: 'さいしょのページのすみに、ちいさな勇者がいた。', unlock: { type: 'voices', value: 10 } },
];
