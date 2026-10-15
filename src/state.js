// アプリ全体で共有する状態（セーブ・今日の日付・今日の異変など）

import { loadSave, writeSave } from './core/save.js';
import { jstDateString, dailySeed } from './core/rng.js';
import { ANOMALIES, ANOMALY_ROTATION } from './content/anomalies.js';
import { CURRENT_DAY } from './content/chronicle.js';
import { setSoundEnabled } from './fx/audio.js';

const params = new URLSearchParams(globalThis.location ? location.search : '');

export const app = {
  test: params.has('test'),
  save: null,
  dateStr: null,
  day: CURRENT_DAY,
  todayAnomaly: null,
};

export function initApp() {
  app.save = loadSave();
  refreshDate();
  setSoundEnabled(app.save.settings.sound);
}

export function refreshDate() {
  app.dateStr = params.get('date') && app.test ? params.get('date') : jstDateString();
  const seed = dailySeed(app.dateStr);
  app.todayAnomaly = ANOMALY_ROTATION[seed % ANOMALY_ROTATION.length];
}

export function anomalyName(id) {
  return id && ANOMALIES[id] ? ANOMALIES[id].name : '';
}

export function persist() {
  writeSave(app.save);
}

export function playedDailyToday() {
  return app.save.daily.date === app.dateStr;
}
