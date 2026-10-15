// セーブ（端末の localStorage のみ）。ゲームの進行データだけを保存する。
// version を必ず持ち、古い形式は migrate で今の形式に直す。壊れていたらバックアップに戻す。

const KEY = 'rakugaki.save';
const BACKUP_KEY = 'rakugaki.save.bak';
export const SAVE_VERSION = 1;

export function defaultSave() {
  return {
    version: SAVE_VERSION,
    ink: 0,
    meta: { hp: 0, dmg: 0, spd: 0, range: 0, revive: 0 },
    stats: { runs: 0, clears: 0, bestTime: 0, kills: 0 },
    daily: { date: null, result: null },
    lore: {},
    seenDay: -1,
    settings: { sound: true, shake: true, flash: true },
  };
}

// 古いバージョンから順に直す。例：migrations[1] は v1 → v2 の変換。
const migrations = {};

function migrate(obj) {
  let o = obj;
  while (o.version < SAVE_VERSION) {
    const fn = migrations[o.version];
    if (!fn) throw new Error(`no migration from v${o.version}`);
    o = fn(o);
  }
  return o;
}

function validate(o) {
  const d = defaultSave();
  if (!o || typeof o !== 'object' || typeof o.version !== 'number') throw new Error('bad save');
  const num = (v, def) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : def);
  const out = { ...d, version: SAVE_VERSION };
  out.ink = Math.floor(num(o.ink, 0));
  out.meta = {};
  for (const k of Object.keys(d.meta)) out.meta[k] = Math.min(5, Math.floor(num(o.meta?.[k], 0)));
  out.stats = {};
  for (const k of Object.keys(d.stats)) out.stats[k] = num(o.stats?.[k], 0);
  out.daily = { date: typeof o.daily?.date === 'string' ? o.daily.date : null, result: o.daily?.result && typeof o.daily.result === 'object' ? o.daily.result : null };
  out.lore = {};
  if (o.lore && typeof o.lore === 'object') for (const [k, v] of Object.entries(o.lore)) if (v === true) out.lore[k] = true;
  out.seenDay = typeof o.seenDay === 'number' ? o.seenDay : -1;
  out.settings = {};
  for (const k of Object.keys(d.settings)) out.settings[k] = typeof o.settings?.[k] === 'boolean' ? o.settings[k] : d.settings[k];
  return out;
}

function readKey(storage, key) {
  const raw = storage.getItem(key);
  if (!raw) return null;
  return validate(migrate(JSON.parse(raw)));
}

export function loadSave(storage = safeStorage()) {
  if (!storage) return defaultSave();
  try {
    return readKey(storage, KEY) || defaultSave();
  } catch (e) {
    try {
      const b = readKey(storage, BACKUP_KEY);
      if (b) return b;
    } catch (e2) { /* バックアップも壊れている */ }
    return defaultSave();
  }
}

export function writeSave(data, storage = safeStorage()) {
  if (!storage) return false;
  try {
    const prev = storage.getItem(KEY);
    const next = JSON.stringify(validate(data));
    if (prev) storage.setItem(BACKUP_KEY, prev);
    storage.setItem(KEY, next);
    return true;
  } catch (e) {
    return false;
  }
}

export function safeStorage() {
  try {
    const s = globalThis.localStorage;
    const k = '__rakugaki_probe__';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch (e) {
    return null;
  }
}

// 1回の挑戦の結果をセーブに反映する。返り値は新しく読めるようになったかけらのid一覧。
export function recordRun(save, result, dateStr) {
  save.ink += Math.max(0, Math.floor(result.ink));
  save.stats.runs++;
  save.stats.kills += result.kills;
  if (result.status === 'clear') save.stats.clears++;
  if (result.time > save.stats.bestTime) save.stats.bestTime = result.time;
  let official = false;
  if (result.mode === 'daily' && save.daily.date !== dateStr) {
    save.daily = { date: dateStr, result: { time: result.time, status: result.status, level: result.level } };
    official = true;
  }
  const unlocked = [];
  if (result.status === 'clear' && !save.lore.f1) { save.lore.f1 = true; unlocked.push('f1'); }
  return { official, unlocked };
}
