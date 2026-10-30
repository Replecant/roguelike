'use strict';

// ─── Сохранение ────────────────────────────────────────────────────
// Игра сохраняется сама: при входе и выходе из поселений, на рассвете и
// закате, каждые сто ходов, когда вкладку сворачивают, и по клавише S.
// После гибели можно вернуться к последнему сохранению. Всё состояние G кладётся в IndexedDB
// как есть (структурное клонирование переносит Map, Set, типизированные
// массивы и общие ссылки); после загрузки возвращаем объектам их классы.

const SAVE_DB = 'anno-tenebris', SAVE_STORE = 'saves', SAVE_VERSION = 1;
const SAVE_CLASSES = { Player, World, Overworld };

let saveDb = null;

function openSaveDb() {
  if (saveDb) return Promise.resolve(saveDb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SAVE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(SAVE_STORE);
    req.onsuccess = () => resolve(saveDb = req.result);
    req.onerror = () => reject(req.error);
  });
}

function saveTx(mode, fn) {
  return openSaveDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(SAVE_STORE, mode), store = tx.objectStore(SAVE_STORE);
    const res = fn(store);
    tx.oncomplete = () => resolve(res && res.result);
    tx.onerror = () => reject(tx.error);
  }));
}

// Обойти граф объектов (каждый объект один раз).
function walkState(root, fn) {
  const seen = new Set(), stack = [root];
  while (stack.length) {
    const o = stack.pop();
    if (o === null || typeof o !== 'object' || seen.has(o) || ArrayBuffer.isView(o)) continue;
    seen.add(o);
    fn(o);
    if (o instanceof Map) for (const [k, v] of o) { stack.push(k); stack.push(v); }
    else if (o instanceof Set) for (const v of o) stack.push(v);
    else for (const k in o) stack.push(o[k]);
  }
}

function saveMeta() {
  const p = G.player;
  return { version: SAVE_VERSION, name: p.name, people: p.people.name, level: p.level, day: timeInfo().day,
    region: REGIONS[G.over.regionAt(G.ox, G.oy)].name, savedAt: Date.now() };
}

function saveGame() {
  if (!G.player || !G.over || G.player.hp <= 0 || G.loading) return Promise.resolve(false);
  const { screens, term, saveMeta: _m, loading, ...state } = G;
  walkState(state, o => {
    const cls = o.constructor && o.constructor.name;
    if (SAVE_CLASSES[cls]) o.__cls = cls;
  });
  const meta = saveMeta();
  try {
    return saveTx('readwrite', store => { store.put({ meta, state }, 'game'); store.put(meta, 'meta'); })
      .then(() => { G.saveMeta = meta; return true; })
      .catch(saveFailed);
  } catch (e) { return Promise.resolve(saveFailed(e)); }
}

function saveFailed(e) {
  if (!G.saveWarned) {
    G.saveWarned = true;
    log('Не удалось сохранить игру: браузер не даёт доступа к хранилищу.', C.red);
  }
  console.warn('save failed', e);
  return false;
}

function readSaveMeta() {
  try {
    return saveTx('readonly', store => store.get('meta')).catch(() => null);
  } catch (e) { return Promise.resolve(null); }
}

async function loadGame() {
  G.loading = true;
  let rec = null;
  try { rec = await saveTx('readonly', store => store.get('game')); } catch (e) { rec = null; }
  if (!rec || !rec.state) { G.loading = false; return false; }
  const state = rec.state;
  walkState(state, o => {
    if (o.__cls && SAVE_CLASSES[o.__cls]) Object.setPrototypeOf(o, SAVE_CLASSES[o.__cls].prototype);
    // Описания зверей — общие справочники, а не копии.
    if (o.kind === 'beast' && typeof o.key === 'string' && BEASTS[o.key]) o.def = BEASTS[o.key];
    if (typeof o.uid === 'number' && o.uid > itemUid) itemUid = o.uid;
  });
  state.player.people = PEOPLES.find(x => x.id === state.player.people.id) || state.player.people;
  Object.assign(G, state);
  G.saveMeta = rec.meta;
  rng = new RNG((G.seed ^ (G.turn * 2654435761) ^ (Date.now() & 0xffffff)) >>> 0);
  G.screens = [new PlayScreen()];
  G.loading = false;
  if (G.mode === 'local') refreshFov();
  log(`Путь продолжается. День ${timeInfo().day}, ${G.mode === 'local' ? 'ты там же, где остановился' : REGIONS[G.over.regionAt(G.ox, G.oy)].name}.`, C.gold);
  render();
  return true;
}

function autosave() {
  if (G.player && G.player.hp > 0) saveGame();
}
