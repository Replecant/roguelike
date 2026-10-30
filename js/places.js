'use strict';

// ─── Места, которые помнит мир ─────────────────────────────────────
// Карты городов, уровней подземелий и мест из слухов строятся из зерна и
// поэтому одинаковы при каждой постройке. В сохранение идёт не вся карта, а
// ключ места, изменённые клетки, разведанная область и то, что на карте
// живёт (жители, звери, предметы, сундуки). При загрузке карта строится
// заново и на неё накладываются изменения — только когда туда заходишь.

function keySeed(key) {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h ^ G.seed) >>> 0;
}

// Выполнить fn с генератором, зависящим только от ключа места.
function withRng(key, fn) {
  const old = rng;
  rng = new RNG(keySeed(key));
  try { return fn(); } finally { rng = old; }
}

// Построить чистую карту места по ключу (без игрока, до всяких изменений).
function buildPlace(key) {
  const [type, a, b] = key.split(':');
  const prevWorld = G.world;
  const w = withRng(key, () => {
    if (type === 'city') {
      const city = G.over.cities.find(c => c.id === a) || G.over.sites.find(c => c.id === a);
      const world = makeCityLocal(G.over, city);
      world.explored.fill(1);   // план города виден с подхода
      return world;
    }
    if (type === 'tomb') return makeTombLevel(G.over.sites.find(s => s.id === a), +b);
    if (type === 'lead') {
      const lead = G.leads.find(l => l.id === a);
      const ctx = localContext(G.over, lead.x, lead.y);
      ctx.seed ^= lead.id.length * 7919 + lead.day;
      const world = makeWildLocal(ctx);
      world.lead = lead;
      G.world = world;
      const left = lead.left;
      setupLead(world, lead);
      if (left !== undefined) lead.left = left;   // при повторной постройке счётчик не трогаем
      return world;
    }
    throw new Error('Неизвестное место: ' + key);
  });
  G.world = prevWorld;
  w.placeKey = key;
  w.edits = new Map();   // с этой минуты запоминаем изменённые клетки
  return w;
}

// ─── Упаковка для сохранения ───────────────────────────────────────

const PACK_SKIP = new Set(['tiles', 'explored', 'visible', 'zone', 'building', 'edits', 'actors']);

function rleEncode(arr) {
  const out = [];
  for (let i = 0; i < arr.length;) {
    let j = i;
    while (j < arr.length && arr[j] === arr[i]) j++;
    out.push(arr[i], j - i);
    i = j;
  }
  return out;
}

function rleDecode(runs, into) {
  let k = 0;
  for (let i = 0; i < runs.length; i += 2) { into.fill(runs[i], k, k + runs[i + 1]); k += runs[i + 1]; }
}

function packWorld(w) {
  if (!w || w.packed || !w.edits || !w.placeKey) return w;   // карты старых сохранений — целиком
  const rec = { packed: true, placeKey: w.placeKey, edits: [...w.edits], explored: rleEncode(w.explored), rest: {} };
  for (const k of Object.keys(w)) if (!PACK_SKIP.has(k)) rec.rest[k] = w[k];
  rec.actors = w.actors.filter(a => a !== G.player);
  return rec;
}

function unpackWorld(rec) {
  if (!rec || !rec.packed) return rec;
  const w = buildPlace(rec.placeKey);
  Object.assign(w, rec.rest);
  w.actors = rec.actors;
  for (const [i, t] of rec.edits) { w.tiles[i] = t; w.edits.set(i, t); }
  rleDecode(rec.explored, w.explored);
  return w;
}

// Сохраняемые карты: { кто держит, ключ в нём }.
function storedWorlds(fn) {
  for (const id of Object.keys(G.cityMaps || {})) fn(G.cityMaps, id);
  for (const id of Object.keys(G.leadMaps || {})) fn(G.leadMaps, id);
  for (const d of Object.values(G.dungeons || {})) for (let i = 0; i < d.levels.length; i++) if (d.levels[i]) fn(d.levels, i);
}

// Достать карту, распаковав при необходимости.
function openStored(holder, key) {
  const v = holder[key];
  if (v && v.packed) holder[key] = unpackWorld(v);
  return holder[key];
}
