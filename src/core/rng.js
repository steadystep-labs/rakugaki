// シード付き乱数（mulberry32）。同じシードなら同じ展開になる。

export function createRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, maxInclusive) => min + Math.floor(next() * (maxInclusive - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  };
}

// 文字列から32bitのシードを作る（FNV-1a）
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// 日本時間の日付 "YYYY-MM-DD"
export function jstDateString(now = Date.now()) {
  const d = new Date(now + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

export function dailySeed(dateStr) {
  return hashString(`rakugaki:${dateStr}`);
}
