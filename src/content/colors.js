// 色の定義。要望で追加されたものだけに色がつく。
// 色ごとに性質を持たせ、のちに組み合わせ効果（mix）を足せるようにしておく。

export const PALETTE = {
  paper: 0xfdfeff,
  grid: 0xd6e4f3,
  ink: 0x2e3138,
  enemyFill: 0x8a8f98,
  enemyLine: 0x4b4f57,
  danger: 0xe2463a,
  white: 0xffffff,
};

// key は色の名前。trait は性質（テスト版では表示のみ。組み合わせは後で実装）
export const COLORS = {
  black: { name: 'くろ', hex: 0x2e3138, css: '#2E3138', trait: null },
  blue: { name: 'あお', hex: 0x2f6fe4, css: '#2F6FE4', trait: 'slow' },
  green: { name: 'みどり', hex: 0x2e9e5b, css: '#2E9E5B', trait: 'push' },
};

// 組み合わせ効果の枠（例：red+yellow → orange の爆発）。テスト版では空。
export const COLOR_MIXES = [];
