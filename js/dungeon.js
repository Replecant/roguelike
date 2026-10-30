'use strict';

// ─── Подземелья ────────────────────────────────────────────────────
// Типы подземелий — в content/dungeons.js. На карте их не видно: на вход
// можно наткнуться (зоркий глаз — Мудрость) или услышать о нём от местных.
// Здесь — где их прятать, как строить уровни, что на дне и что внутри.

function dungeonType(site) {
  if (site.kind === 'pagan') return PAGAN_PLACES;
  return DUNGEON_TYPES[site.type || 'roman'];
}

// ─── Где прятать ───────────────────────────────────────────────────

function dungeonSpotOk(ow, x, y, place, def) {
  const tile = ow.get(x, y), region = ow.regionAt(x, y);
  if (!OTILES[tile].pass || tile === OT.RIVER || ow.placeAt(x, y)) return false;
  if (def.regions && !def.regions.includes(region)) return false;
  if (def.notRegions && def.notRegions.includes(region)) return false;
  const road = ow.road[ow.idx(x, y)] >= 0;
  const nearRoad = DIRS8.some(([dx, dy]) => ow.inside(x + dx, y + dy) && ow.road[ow.idx(x + dx, y + dy)] >= 0);
  const near = (kinds, a, b) => ow.cities.some(c => kinds.includes(c.kind) && Math.max(Math.abs(c.x - x), Math.abs(c.y - y)) >= a
    && Math.max(Math.abs(c.x - x), Math.abs(c.y - y)) <= b);
  const tooClose = ow.cities.some(c => Math.max(Math.abs(c.x - x), Math.abs(c.y - y)) < 2 * MAP_SCALE);
  if (tooClose || road) return false;
  switch (place) {
    case 'roadwild': return nearRoad || [OT.FOREST, OT.PINE, OT.HILL, OT.MOUNT].includes(tile);
    case 'hillwild': return [OT.FOREST, OT.HILL].includes(tile);
    case 'nearcity': return near(['city', 'town'], 2 * MAP_SCALE, 5 * MAP_SCALE);
    case 'castle': return near(['castle'], 1, 3 * MAP_SCALE);
    case 'coast': return DIRS8.some(([dx, dy]) => ow.get(x + dx, y + dy) === OT.SEA) && [OT.HILL, OT.MOUNT, OT.FOREST, OT.PLAIN].includes(tile);
    case 'mountwild': return [OT.HILL, OT.MOUNT, OT.PINE, OT.FOREST].includes(tile);
  }
  return true;
}

function placeTombs(ow, r, placeOnLand) {
  let n = 0;
  // Особые места цепочки фламина — на своих настоящих местах, скрыты до поры.
  for (const [type, lon, lat, depth] of [['sibyl', 14.05, 40.85, 2], ['inferi', 15.0, 37.75, 6]]) {
    const def = DUNGEON_TYPES[type], [x, y] = placeOnLand(lon, lat);
    ow.sites.push({ id: type, type, dungeon: true, hidden: true, quest: true, glyph: def.glyph, color: def.color,
      x, y, region: ow.regionAt(x, y), terrain: ow.get(x, y), name: def.name(r), depth, desc: def.desc });
  }
  placePagans(ow, r);
  for (const [type, def] of Object.entries(DUNGEON_TYPES)) {
    let made = 0;
    for (let t = 0; t < 30000 * MAP_SCALE && made < def.count; t++) {
      const x = r.int(2, ow.w - 3), y = r.int(2, ow.h - 3);
      if (!dungeonSpotOk(ow, x, y, def.place, def)) continue;
      if (ow.sites.some(s => s.dungeon && Math.hypot(s.x - x, (s.y - y) * 2) < 9 * MAP_SCALE)) continue;
      const deep = r.chance(0.15) ? def.depth[1] + 1 : r.int(def.depth[0], def.depth[1]);
      ow.sites.push({
        id: `tomb${n++}`, type, dungeon: true, hidden: true, glyph: def.glyph, color: def.color,
        x, y, region: ow.regionAt(x, y), terrain: ow.get(x, y), name: def.name(r), depth: deep, desc: def.desc,
      });
      made++;
    }
  }
}

// Селения язычников: глухие горы и леса, вдали от городов и дорог.
function placePagans(ow, r) {
  const P = PAGAN_PLACES, names = r.shuffle(P.names.slice());
  let made = 0;
  for (let t = 0; t < 40000 * MAP_SCALE && made < P.count; t++) {
    const x = r.int(3, ow.w - 4), y = r.int(3, ow.h - 4), tile = ow.get(x, y);
    if (![OT.MOUNT, OT.PINE, OT.FOREST, OT.HILL].includes(tile) || ow.placeAt(x, y)) continue;
    if (!P.regions.includes(ow.regionAt(x, y))) continue;
    if (DIRS8.some(([dx, dy]) => ow.road[ow.idx(x + dx * 2, y + dy * 2)] >= 0)) continue;
    if (ow.cities.some(c => Math.max(Math.abs(c.x - x), Math.abs(c.y - y)) < 4 * MAP_SCALE)) continue;
    if (ow.sites.some(s => Math.hypot(s.x - x, (s.y - y) * 2) < 25 * MAP_SCALE && s.kind === 'pagan')) continue;
    ow.sites.push({ id: `pagan${made}`, kind: 'pagan', type: 'city', hidden: true, names: 'roman', glyph: 'Ψ', color: '#c87a3a',
      x, y, region: ow.regionAt(x, y), terrain: tile, name: names[made % names.length], tiles: [[x, y]] });
    made++;
  }
}

// Место найдено: с этой минуты оно на карте.
function revealTomb(t, text) {
  if (!t.hidden) return false;
  t.hidden = false;
  if (G.player) chronicle(`${text ? 'Нашёл' : 'Узнал о месте'}: ${t.name}.`, 'find');
  G.over.places.set(G.over.idx(t.x, t.y), t);
  if (text) log(text, C.violet);
  if (t.kind === 'pagan' && G.player && crusadeStage() === 2) { setCrusade(2, crusadeText()); log('Одно из селений, о которых говорил легат!', C.gold); }
  return true;
}

function hiddenTombs() { return G.over.sites.filter(s => (s.dungeon || s.kind === 'pagan') && s.hidden && !s.quest); }

const SPOT_TEXT = {
  roman: ['обломок римской стелы, а за кустами чернеет провал входа', 'заросший вход в склоне и обломки стелы'],
  etruscan: ['каменную дверь в боку кургана, заросшего дубами', 'круглый курган с каменной дверью'],
  catacomb: ['пролом в старой кладке, а за ним — ступени вниз и запах воска', 'пролом в кладке со ступенями вниз'],
  mithraeum: ['спуск под руины: на камне высечен юноша, закалывающий быка', 'спуск под руины с рельефом быка'],
  grotto: ['вход в пещеру, куда при отливе можно пройти по мокрым камням', 'чёрный зев грота у самой воды'],
  mine: ['вход в штольню, подпёртый гнилыми брёвнами', 'старую штольню с брошенной тачкой у входа'],
  crypt: ['под обгорелыми стенами — ступени в склеп', 'спуск в склеп под руинами замка'],
  pagan: ['каменного идола на тропе, а за ним — дым над селением, которого нет ни на одной карте', 'дым над лесом и каменного идола у тропы'],
};

// Шаг по карте: может, заметишь вход.
function spotTombs(x, y, searching) {
  const p = G.player;
  for (const t of hiddenTombs()) {
    const d = Math.max(Math.abs(t.x - x), Math.abs(t.y - y));
    if (d > 1) continue;
    const chance = (d === 0 ? 0.35 : 0.08) + p.stats.wis * 0.015 + (searching ? 0.35 : 0) - (isNight() ? 0.1 : 0);
    if (!rng.chance(chance)) continue;
    const [here, there] = SPOT_TEXT[t.kind === 'pagan' ? 'pagan' : t.type || 'roman'];
    revealTomb(t, d === 0
      ? `Ты замечаешь ${here}: ${t.kind === 'pagan' ? t.name : t.name.toLowerCase()}! Enter — ${t.kind === 'pagan' ? 'войти' : 'спуститься'}.`
      : `В стороне от пути ты замечаешь ${there}: ${t.name.toLowerCase()} (${t.glyph}).`);
    return t;
  }
  return null;
}

// Слух о подземелье: житель рассказывает о месте поблизости, и оно отмечается на карте.
function tombRumor(npc) {
  const place = npc.village.city;
  if (place.kind === 'city' || !['elder', 'innkeeper', 'peasant', 'herbalist', 'hermit', 'guard', 'priest'].includes(npc.role)) return null;
  const t = hiddenTombs().filter(t => Math.hypot(t.x - place.x, (t.y - place.y) * 2) < 26 * MAP_SCALE)
    .sort((a, b) => Math.hypot(a.x - place.x, a.y - place.y) - Math.hypot(b.x - place.x, b.y - place.y))[0];
  if (!t || !rng.chance(0.3 + skillLevel(G.player, 'speech') * 0.03)) return null;
  const text = `${whereText(place, t.x, t.y)} ${rng.pick(dungeonType(t).tales)}`;
  revealTomb(t);
  noteRumor(npc, { kind: 'tomb', text, tomb: t.id, title: `${t.name}: близ ${place.name}` });
  log(`Слух записан в журнал. На карте отмечено: ${t.name.toLowerCase()} (${t.glyph}).`, C.gold);
  return `«${rng.pick(['Только между нами.', 'Скажу тебе, раз спросил.', 'Слыхал?'])} ${text}»`;
}

// ─── Планировки уровней ────────────────────────────────────────────
// Каждая заполняет карту и возвращает комнаты { x, y, w, h, cx, cy }.

function digLine(w, r, a, b, floor, wall) {
  let x = a.cx, y = a.cy;
  const step = (tx, ty) => {
    while (x !== tx || y !== ty) {
      if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y);
      if (w.get(x, y) === wall) w.set(x, y, floor);
    }
  };
  if (r.chance(0.5)) { step(b.cx, y); step(b.cx, b.cy); } else { step(x, b.cy); step(b.cx, b.cy); }
}

function carveRoom(w, o, floor, isRoom) {
  for (let y = o.y; y < o.y + o.h; y++)
    for (let x = o.x; x < o.x + o.w; x++) { w.set(x, y, floor); if (isRoom) isRoom[w.idx(x, y)] = 1; }
}

function scatterRooms(w, r, count, size) {
  const rooms = [];
  for (let t = 0; t < 400 && rooms.length < count; t++) {
    const rw = r.int(size[0], size[1]), rh = r.int(size[2], size[3]);
    const x = r.int(2, w.w - rw - 3), y = r.int(2, w.h - rh - 3);
    if (rooms.some(o => x < o.x + o.w + 3 && o.x < x + rw + 3 && y < o.y + o.h + 2 && o.y < y + rh + 2)) continue;
    rooms.push({ x, y, w: rw, h: rh, cx: x + (rw >> 1), cy: y + (rh >> 1) });
  }
  return rooms.sort((a, b) => a.cx - b.cx);
}

const LAYOUTS = {
  // Усыпальницы, соединённые ходами; ниши с костями вдоль ходов.
  rooms(w, r, P) {
    const isRoom = new Uint8Array(w.w * w.h), rooms = scatterRooms(w, r, 11, [5, 11, 4, 7]);
    for (const o of rooms) carveRoom(w, o, P.floor, isRoom);
    for (let i = 1; i < rooms.length; i++) digLine(w, r, rooms[i - 1], rooms[i], P.floor, P.wall);
    for (let k = 0; k < 3; k++) digLine(w, r, r.pick(rooms), r.pick(rooms), P.floor, P.wall);
    nicheWalls(w, r, P, isRoom, 0.45);
    for (const o of rooms) {
      bones(w, r, o, 0.08);
      wallProps(w, r, o, T.SARCOPHAGUS, 1, 3);
      if (o.w >= 9 && o.h >= 6) for (const [dx, dy] of [[2, 2], [o.w - 3, 2], [2, o.h - 3], [o.w - 3, o.h - 3]]) w.set(o.x + dx, o.y + dy, T.COLUMN);
    }
    return rooms;
  },

  // Катакомбы: длинные узкие галереи сеткой, локулы в несколько ярусов,
  // редкие кубикулы — семейные склепы — и могилы мучеников с лампадами.
  galleries(w, r, P) {
    const isRoom = new Uint8Array(w.w * w.h), rows = [], cols = [];
    for (let y = 4; y < w.h - 3; y += r.int(4, 6)) rows.push(y);
    for (let x = 4; x < w.w - 3; x += r.int(7, 12)) cols.push(x);
    for (const y of rows) {
      // Каждый ход дотягивается до крайних поперечных, иначе куски отрезаны.
      const x0 = Math.min(r.int(2, 8), cols[0]), x1 = Math.max(w.w - r.int(3, 9), cols[cols.length - 1]);
      for (let x = x0; x <= x1; x++) w.set(x, y, P.floor);
    }
    for (const x of cols)
      for (let k = 0; k < rows.length - 1; k++)
        if (r.chance(0.6) || k === 0) for (let y = rows[k]; y <= rows[k + 1]; y++) w.set(x, y, P.floor);
    // Сквозной ход по всей высоте, чтобы всё было связано.
    const spine = cols[cols.length >> 1];
    for (let y = rows[0]; y <= rows[rows.length - 1]; y++) w.set(spine, y, P.floor);
    nicheWalls(w, r, P, isRoom, 0.75);
    // Кубикулы: небольшие комнаты, приставленные к галереям.
    const rooms = [];
    for (let t = 0; t < 200 && rooms.length < 8; t++) {
      const y = r.pick(rows), x = r.int(6, w.w - 10), up = r.chance(0.5), rw = r.int(3, 5), rh = 2;
      const ry = up ? y - rh - 1 : y + 2;
      if (ry < 1 || ry + rh >= w.h - 1 || w.get(x, y) !== P.floor) continue;
      if (rooms.some(o => Math.abs(o.cx - x) < 7 && Math.abs(o.cy - ry) < 4)) continue;
      const o = { x: x - (rw >> 1), y: ry, w: rw, h: rh, cx: x, cy: ry + 1 };
      carveRoom(w, o, P.floor, isRoom);
      w.set(x, up ? y - 1 : y + 1, P.floor);
      if (r.chance(0.6)) w.set(o.x + o.w - 1, up ? o.y : o.y + o.h - 1, T.SHRINE);
      rooms.push(o);
    }
    // Узлы галерей — тоже «комнаты» для лестниц и тварей.
    for (const y of [rows[0], rows[rows.length - 1]]) for (const x of [cols[0], cols[cols.length - 1]])
      if (w.get(x, y) === P.floor) rooms.push({ x, y, w: 1, h: 1, cx: x, cy: y });
    return rooms.sort((a, b) => a.cx - b.cx);
  },

  // Этрусский курган: дромос — длинный коридор, от него погребальные камеры
  // с расписными стенами, ложами и урнами.
  tumulus(w, r, P) {
    const cy = w.h >> 1, x0 = 3, x1 = w.w - 6, rooms = [];
    for (let x = x0; x <= x1; x++) w.set(x, cy, P.floor);
    rooms.push({ x: x0, y: cy, w: 1, h: 1, cx: x0, cy });
    for (let x = x0 + 8; x < x1 - 4 && rooms.length < 9; x += r.int(8, 12)) {
      for (const up of r.shuffle([true, false]).slice(0, r.int(1, 2))) {
        const rw = r.int(6, 10), rh = r.int(4, 6), len = r.int(2, 4);
        const ry = up ? cy - len - rh : cy + len + 1;
        if (ry < 1 || ry + rh >= w.h - 1) continue;
        const o = { x: x - (rw >> 1), y: ry, w: rw, h: rh, cx: x, cy: ry + (rh >> 1) };
        carveRoom(w, o, P.floor);
        for (let k = 1; k <= len; k++) w.set(x, up ? cy - k : cy + k, P.floor);
        // Погребальные ложа и урны вдоль стен.
        wallProps(w, r, o, T.URN, 2, 4);
        if (r.chance(0.5)) wallProps(w, r, o, T.SARCOPHAGUS, 1, 1);
        rooms.push(o);
      }
    }
    const end = { x: x1 - 5, y: cy - 3, w: 7, h: 7, cx: x1 - 2, cy };
    carveRoom(w, end, P.floor);
    wallProps(w, r, end, T.URN, 2, 3);
    rooms.push(end);
    return rooms.sort((a, b) => a.cx - b.cx);
  },

  // Митреум: преддверия и длинный сводчатый зал со скамьями вдоль стен,
  // в торце — рельеф с быком.
  temple(w, r, P) {
    const rooms = scatterRooms(w, r, 6, [4, 7, 3, 5]).filter(o => o.x + o.w < w.w * 0.55);
    if (!rooms.length) rooms.push({ x: 4, y: (w.h >> 1) - 2, w: 5, h: 4, cx: 6, cy: w.h >> 1 });
    const nx = Math.round(w.w * 0.58), ny = (w.h >> 1) - 4;
    const nave = { x: nx, y: ny, w: 28, h: 9, cx: nx + 3, cy: ny + 4 };
    carveRoom(w, nave, P.floor);
    for (let x = nave.x + 1; x < nave.x + nave.w - 3; x++) { w.set(x, nave.y + 1, T.BENCH); w.set(x, nave.y + nave.h - 2, T.BENCH); }
    for (const o of rooms) carveRoom(w, o, P.floor);
    const all = [...rooms, nave].sort((a, b) => a.cx - b.cx);
    for (let i = 1; i < all.length; i++) digLine(w, r, all[i - 1], all[i], P.floor, P.wall);
    for (const o of rooms) bones(w, r, o, 0.03);
    // «Дальняя комната» для лестницы и босса — торец зала.
    const end = { x: nave.x + nave.w - 6, y: nave.y + 2, w: 5, h: 5, cx: nave.x + nave.w - 3, cy: nave.cy };
    return [...rooms.sort((a, b) => a.cx - b.cx), end];
  },

  // Пещера: клеточный автомат; отрезанные полости заливает вода.
  cave(w, r, P) {
    const W = w.w, H = w.h, g = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      g[y * W + x] = x < 2 || y < 2 || x >= W - 2 || y >= H - 2 || r.chance(0.44) ? 1 : 0;
    for (let it = 0; it < 5; it++) {
      const n = g.slice();
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        let k = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) k += g[(y + dy) * W + x + dx];
        n[y * W + x] = k >= 5 ? 1 : 0;
      }
      g.set(n);
    }
    for (let i = 0; i < W * H; i++) w.tiles[i] = g[i] ? T[P.wallName] : T[P.floorName];
    const main = largestRegion(w, P.floor);
    for (let i = 0; i < W * H; i++) if (w.tiles[i] === P.floor && !main.has(i)) w.tiles[i] = P.pool;
    return caveRooms(w, r, main);
  },

  // Рудник: забои-камеры, прямые штольни с крепью, рудные жилы в стенах.
  mine(w, r, P) {
    const rooms = scatterRooms(w, r, 9, [4, 8, 3, 5]);
    for (const o of rooms) carveRoom(w, o, P.floor);
    for (let i = 1; i < rooms.length; i++) digLine(w, r, rooms[i - 1], rooms[i], P.floor, P.wall);
    for (let k = 0; k < 2; k++) digLine(w, r, r.pick(rooms), r.pick(rooms), P.floor, P.wall);
    for (let y = 1; y < w.h - 1; y++)
      for (let x = 1; x < w.w - 1; x++) {
        if (w.get(x, y) !== P.wall) continue;
        const open = DIRS4.filter(([dx, dy]) => w.get(x + dx, y + dy) === P.floor).length;
        if (!open) continue;
        if ((x + y) % 6 === 0 && open === 1) w.set(x, y, T.TIMBER);
        else if (r.chance(0.035)) w.set(x, y, T.ORE);
      }
    for (const o of rooms) if (r.chance(0.4)) w.set(o.cx, o.cy, T.DEBRIS);
    return rooms;
  },

  // Склеп: центральный неф с колоннами, по бокам — ниши с гробницами рыцарей.
  crypt(w, r, P) {
    const cy = w.h >> 1, x0 = 6, x1 = w.w - 8, rooms = [];
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = x0; x <= x1; x++) w.set(x, y, P.floor);
    for (let x = x0 + 2; x <= x1 - 2; x += 4) { w.set(x, cy - 1, T.COLUMN); w.set(x, cy + 1, T.COLUMN); }
    rooms.push({ x: x0, y: cy, w: 1, h: 1, cx: x0, cy });
    for (let x = x0 + 4; x <= x1 - 6; x += 6)
      for (const up of [true, false]) {
        if (!r.chance(0.8)) continue;
        const o = { x: x, y: up ? cy - 7 : cy + 3, w: 5, h: 4, cx: x + 2, cy: up ? cy - 5 : cy + 5 };
        carveRoom(w, o, P.floor);
        w.set(x + 2, up ? cy - 3 : cy + 2, P.floor);
        w.set(x + 2, up ? cy - 2 : cy + 2, P.floor);
        w.set(x + 2, up ? cy - 1 : cy + 1, P.floor);   // колонна галереи не должна стоять в проходе
        w.set(o.cx, up ? o.y + 1 : o.y + 2, T.SARCOPHAGUS);
        if (r.chance(0.4)) w.set(up ? o.x : o.x + o.w - 1, up ? o.y : o.y + o.h - 1, T.BONES);
        rooms.push(o);
      }
    const apse = { x: x1 + 1, y: cy - 3, w: 5, h: 7, cx: x1 + 3, cy };
    carveRoom(w, apse, P.floor);
    rooms.push(apse);
    return rooms.sort((a, b) => a.cx - b.cx);
  },
};

function nicheWalls(w, r, P, isRoom, chance) {
  for (let y = 1; y < w.h - 1; y++)
    for (let x = 1; x < w.w - 1; x++) {
      if (w.get(x, y) !== P.wall) continue;
      const nearCorridor = DIRS4.some(([dx, dy]) => w.get(x + dx, y + dy) === P.floor && !isRoom[w.idx(x + dx, y + dy)]);
      if (nearCorridor && r.chance(chance)) w.set(x, y, P.niche);
    }
}

function bones(w, r, o, chance) {
  for (let y = o.y; y < o.y + o.h; y++)
    for (let x = o.x; x < o.x + o.w; x++) if (r.chance(chance) && w.get(x, y) !== T.STAIRS_UP) w.set(x, y, T.BONES);
}

// Поставить вдоль стен комнаты от a до b предметов, не загораживая входы.
function wallProps(w, r, o, tile, a, b) {
  const spots = [];
  for (let x = o.x + 1; x < o.x + o.w - 1; x++) spots.push([x, o.y, -1], [x, o.y + o.h - 1, 1]);
  let placed = 0;
  const want = r.int(a, b);
  for (const [x, y, out] of r.shuffle(spots)) {
    if (placed >= want) break;
    if ([-1, 0, 1].some(dx => w.walkable(x + dx, y + out))) continue;
    if (!w.walkable(x, y)) continue;
    w.set(x, y, tile);
    placed++;
  }
}

function largestRegion(w, floor) {
  const seen = new Uint8Array(w.w * w.h);
  let best = new Set();
  for (let i = 0; i < w.w * w.h; i++) {
    if (seen[i] || w.tiles[i] !== floor) continue;
    const reg = new Set([i]), st = [i];
    seen[i] = 1;
    while (st.length) {
      const j = st.pop(), x = j % w.w, y = (j / w.w) | 0;
      for (const [dx, dy] of DIRS4) {
        const k = (y + dy) * w.w + x + dx;
        if (w.inside(x + dx, y + dy) && !seen[k] && w.tiles[k] === floor) { seen[k] = 1; reg.add(k); st.push(k); }
      }
    }
    if (reg.size > best.size) best = reg;
  }
  return best;
}

// В пещере «комнаты» — точки пола, разнесённые по карте.
function caveRooms(w, r, cells) {
  const list = [...cells], rooms = [];
  for (let t = 0; t < 400 && rooms.length < 9; t++) {
    const i = r.pick(list), x = i % w.w, y = (i / w.w) | 0;
    if (rooms.some(o => Math.abs(o.cx - x) < 9 && Math.abs(o.cy - y) < 5)) continue;
    rooms.push({ x: x - 1, y: y - 1, w: 3, h: 3, cx: x, cy: y });
  }
  return rooms.sort((a, b) => a.cx - b.cx);
}

// ─── Уровень ───────────────────────────────────────────────────────

function makeTombLevel(site, depth) {
  const base = dungeonType(site);
  // У мегаподземелья у каждого уровня свой облик и свои обитатели.
  const def = base.levels ? { ...base, niche: base.levels[depth].wall, ...base.levels[depth] } : base;
  const W = 80, H = 40, r = new RNG((G.seed ^ (site.x * 7919 + site.y * 104729)) + depth * 31337);
  const w = new World(W, H);
  w.kind = 'dungeon';
  w.site = site;
  w.depth = depth;
  w.region = site.region;
  const P = { wall: T[def.wall], floor: T[def.floor], niche: T[def.niche], wallName: def.wall, floorName: def.floor, pool: T[def.pool || 'WATER'] };
  w.tiles.fill(P.wall);
  const rooms = LAYOUTS[def.layout](w, r, P);

  // Лестницы: наверх — в первой комнате, вниз — в самой дальней (по пути, а не по прямой).
  const first = rooms[0];
  const far = farthestRoom(w, rooms, first);
  w.set(first.cx, first.cy, T.STAIRS_UP);
  w.up = [first.cx, first.cy];
  if (depth < site.depth - 1) {
    w.set(far.cx, far.cy, T.STAIRS_DOWN);
    w.down = [far.cx, far.cy];
    // Страж перехода (Цербер у Стикса).
    const key = `${site.id}_guard${depth}`;
    if (def.guard && !G.flags[key]) {
      const spot = DIRS8.map(([dx, dy]) => [far.cx + dx, far.cy + dy]).find(([x, y]) => w.walkable(x, y));
      if (spot) { const g = makeBeast(def.guard, spot[0], spot[1]); g.guardOf = key; w.actors.push(g); }
    }
  } else if (!site.mini) finale(w, r, site, def, far);   // в малом подземелье задания нет хозяина

  addSecrets(w, r, P, rooms, first, def);

  // Обитатели — подальше от лестницы наверх, больше на каждом уровне.
  const prevWorld = G.world;
  G.world = w;
  const count = 3 + depth * 2 + (def.layout === 'galleries' ? 1 : 0);
  for (let k = 0, made = 0; k < 300 && made < count; k++) {
    const o = r.pick(rooms);
    if (o === first || (k < 200 && Math.max(Math.abs(o.cx - first.cx), Math.abs(o.cy - first.cy)) < 8)) continue;
    const key = rng.weighted(def.mobs.map(([key, wt]) => ({ key, w: wt }))).key;
    if (placeGroup(key, o.cx + rng.int(-1, 1), o.cy).length) made++;
  }
  G.world = prevWorld;
  return w;
}

function farthestRoom(w, rooms, first) {
  const dist = new Int32Array(w.w * w.h).fill(-1), q = [w.idx(first.cx, first.cy)];
  dist[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const j = q[h], x = j % w.w, y = (j / w.w) | 0;
    for (const [dx, dy] of DIRS4) {
      const k = (y + dy) * w.w + x + dx;
      if (w.inside(x + dx, y + dy) && dist[k] < 0 && TILES[w.tiles[k]].walk) { dist[k] = dist[j] + 1; q.push(k); }
    }
  }
  return rooms.reduce((a, b) => dist[w.idx(b.cx, b.cy)] > dist[w.idx(a.cx, a.cy)] ? b : a);
}

// Дно подземелья: хозяин и то, что он стережёт.
function finale(w, r, site, def, far) {
  const free = (dx, dy) => w.walkable(far.cx + dx, far.cy + dy);
  // В просторном зале убранство стоит на полу; в узком месте (перекрёсток галерей,
  // пещерный закоулок) — в стенах вокруг, чтобы не перегородить проход.
  const roomy = far.w >= 5 && far.h >= 4;
  const used = new Set();
  const put = (dx, dy, tile) => {
    let x = far.cx + dx, y = far.cy + dy;
    if (!roomy && w.walkable(x, y)) {
      const alt = [[dx, dy], ...DIRS8].map(([ax, ay]) => [far.cx + ax, far.cy + ay])
        .find(([ax, ay]) => w.inside(ax, ay) && !w.walkable(ax, ay) && !used.has(w.idx(ax, ay)) && ax > 0 && ay > 0 && ax < w.w - 1 && ay < w.h - 1);
      if (alt) [x, y] = alt;   // стен рядом нет — значит, место открытое, можно и на полу
    }
    if (!w.inside(x, y)) return;
    w.set(x, y, tile);
    used.add(w.idx(x, y));
    return w.idx(x, y);
  };
  switch (def.finale) {
    case 'altar':     put(0, -1, T.PAGAN_ALTAR); w.richSarcophagus = put(1, -1, T.SARCOPHAGUS); break;
    case 'banquet':   w.richSarcophagus = put(0, -1, T.SARCOPHAGUS); put(-1, -1, T.URN); put(1, -1, T.URN); break;
    case 'stash':     put(0, -1, T.PAGAN_ALTAR); addContainer(w, put(1, 0, T.CHEST), 'necro'); break;
    case 'tauroctony': put(1, 0, T.PAGAN_ALTAR); addContainer(w, put(0, -1, T.CHEST), 'offerings'); put(-1, -1, T.CAUTES); put(1, -1, T.CAUTOPATES); break;
    case 'wreck':     put(1, 0, T.WAGON); addContainer(w, put(0, -1, T.CHEST), 'wreck'); addContainer(w, put(-1, -1, T.CHEST), 'wreck'); break;
    case 'vein':      for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [1, 0]]) if (!free(dx, dy)) put(dx, dy, T.ORE); w.richVein = true; break;
    case 'bough':     put(0, -1, T.PAGAN_ALTAR); addContainer(w, put(1, -1, T.BOUGH), 'bough'); break;
    case 'throne':    put(0, -1, T.THRONE); addContainer(w, put(1, -1, T.COFFER), 'dis_treasure'); addContainer(w, put(-1, -1, T.COFFER), 'dis_treasure'); break;
    case 'effigy':    w.richSarcophagus = put(0, -1, T.SARCOPHAGUS); put(-1, -1, T.ALTAR); break;
  }
  if (!G.flags[`${site.id}_boss`]) {
    const boss = makeBeast(def.boss, far.cx, far.cy);
    boss.bossOf = site.id;
    w.actors.push(boss);
  }
}

function addContainer(w, i, kind) {
  if (i === undefined) return;
  w.containers = w.containers || new Map();
  w.containers.set(i, kind);
}

// ─── Переходы ──────────────────────────────────────────────────────

function enterDungeon(site) {
  if (site.type === 'inferi' && !hasItem('golden_bough')) {
    log('Из трещины бьёт такой жар, что ты не можешь сделать и шага. Камень у входа гудит, будто ждёт чего-то. Живому сюда нет пути — без золотой ветви.', C.red);
    return;
  }
  const d = G.dungeons[site.id] || (G.dungeons[site.id] = { levels: [] });
  log(site.desc, C.violet);
  levelText(site, 0);
  goToLevel(site, d, 0, 'up');
  log(site.type === 'grotto' ? 'Ты зажигаешь факел и пробираешься в грот по мокрым камням. Выход — там, откуда пришёл (<).'
    : 'Ты зажигаешь факел и спускаешься во тьму. Наверх ведёт лестница (<).', C.dim);
}

function goToLevel(site, d, depth, arriveAt) {
  if (!d.levels[depth]) d.levels[depth] = buildPlace(`tomb:${site.id}:${depth}`);
  const w = openStored(d.levels, depth);
  const [sx, sy] = arriveAt === 'up' ? w.up : w.down;
  // Встать рядом с лестницей, а не на неё.
  const spot = DIRS8.map(([dx, dy]) => [sx + dx, sy + dy]).find(([x, y]) => w.free(x, y)) || [sx, sy];
  placePlayer(w, spot[0], spot[1]);
  mithrasVisit(w);
  relicVisit(w);
}

function useStairs(tile) {
  const w = G.world, site = w.site, d = G.dungeons[site.id];
  if (tile === T.STAIRS_DOWN) {
    goToLevel(site, d, w.depth + 1, 'up');
    log(`Ты спускаешься ниже. Уровень ${w.depth + 2} из ${site.depth}.`, C.dim);
    levelText(site, w.depth + 1);
    if (w.depth + 2 === site.depth) log(dungeonType(site).deeper, C.violet);
  } else if (w.depth === 0) {
    leaveLocal();
  } else {
    goToLevel(site, d, w.depth - 1, 'down');
    log(`Ты поднимаешься. Уровень ${w.depth} из ${site.depth}.`, C.dim);
  }
}

function levelText(site, depth) {
  const lv = dungeonType(site).levels;
  if (lv && lv[depth]) log(`${lv[depth].name}. ${lv[depth].text}`, C.violet);
}

function hasItem(key) {
  const p = G.player;
  return p.bag.some(it => it.key === key) || equippedItems(p).some(it => it.key === key);
}

function takeTrophy(it) {
  const tr = G.player.trophies[it.id] || (G.player.trophies[it.id] = { name: it.name, value: it.value, count: 0 });
  tr.count++;
}

// ─── Добыча ────────────────────────────────────────────────────────

function riseFrom(x, y, keys, text) {
  const w = G.world;
  const spot = DIRS8.map(([dx, dy]) => [x + dx, y + dy]).find(([sx, sy]) => w.free(sx, sy));
  if (!spot) return false;
  const m = makeBeast(rng.pick(keys), spot[0], spot[1]);
  m.provoked = true;
  w.actors.push(m);
  log(text.replace('{m}', lower(m.name)), C.red);
  return true;
}

function giveItem(keys, text) {
  const it = makeItem(rng.pick(keys));
  G.player.bag.push(it);
  log(text.replace('{it}', text.startsWith('{it}') ? it.name : lower(it.name)), C.gold);
}

// Монеты в подземельях: вдвое скромнее, чем обещают легенды.
function giveCoins(a, b, text) {
  const c = Math.max(1, Math.round(rng.int(a, b) * 0.5));
  G.player.coins += c;
  log(text.replace('{c}', c), C.gold);
}

// Саркофаг: римский, этрусский или рыцарская гробница.
function openSarcophagus(x, y) {
  const w = G.world, i = w.idx(x, y), type = w.site ? w.site.type || 'roman' : 'roman';
  w.set(x, y, T.SARC_OPEN);
  log(type === 'crypt' ? 'Ты сдвигаешь каменную крышку с изваянием рыцаря...' : 'Ты сдвигаешь тяжёлую крышку саркофага...', C.dim);
  addPiety(type === 'crypt' ? -3 : -2, type === 'crypt' ? 'Ты тревожишь христианскую могилу.' : 'Ты тревожишь покой мёртвых.');
  faithDeed('grave');
  if (i === w.richSarcophagus) {
    const loot = DUNGEON_LOOT[type === 'etruscan' || type === 'crypt' ? type : 'roman'];
    takeTrophy(loot.reduce((a, b) => b.value > a.value ? b : a));
    if (type === 'crypt') { giveCoins(50, 100, 'Под истлевшим плащом — кошель с золотом из Святой земли: {c} мон.'); giveItem(['reliquary', 'sword', 'kite', 'mail'], 'И ещё: {it}.'); }
    else if (type === 'etruscan') { giveCoins(30, 70, 'На ложе — золотой венок, серьги и монеты с надписями, которые никто уже не прочтёт: {c} мон.'); giveItem(['bulla', 'gorgoneion'], 'На шее покойного — {it}.'); }
    else { giveCoins(40, 80, 'Внутри — золото наместника: {c} мон. и золотое кольцо с геммой.'); giveItem(['gorgoneion', 'signet', 'bulla'], 'И ещё: {it}.'); }
    return;
  }
  const roll = rng.next();
  const risers = type === 'crypt' ? ['ghoul', 'ghost', 'skeleton'] : type === 'etruscan' ? ['etruscan_shade'] : ['skeleton', 'skeleton', 'lemur', 'ghoul'];
  if (roll < 0.2 && riseFrom(x, y, risers, 'Из гробницы поднимается {m}!')) return;
  if (roll < 0.35) { log('Внутри только прах и истлевшие пелены.', C.dim); return; }
  if (roll < 0.5) { G.player.potions++; log('Среди костей — запечатанная склянка. Это целебный отвар!', C.green); return; }
  if (roll < 0.72) { giveCoins(5, 25, type === 'crypt' ? 'В истлевшем кошеле: {c} мон.' : 'Между рёбер покойника — монеты для Харона: {c} мон.'); return; }
  if (roll < 0.86) {
    const loot = rng.weighted(DUNGEON_LOOT[type === 'etruscan' || type === 'crypt' ? type : 'roman']);
    takeTrophy(loot);
    log(`Ты находишь: ${loot.name}.`, C.gold);
    return;
  }
  // Редкая удача.
  giveItem(type === 'crypt' ? ['sword', 'nasal', 'mail', 'chausses', 'reliquary'] : type === 'etruscan' ? ['bulla', 'gorgoneion'] : ['gorgoneion', 'bulla', 'signet', 'gladius', 'galea', 'scutum'],
    'Под истлевшими пеленами — {it}! (I — снаряжение)');
}

// Этрусская урна с прахом.
function openUrn(x, y) {
  const w = G.world;
  w.set(x, y, T.URN_OPEN);
  addPiety(-1, 'Ты разбиваешь погребальную урну.');
  const roll = rng.next();
  if (roll < 0.15 && riseFrom(x, y, ['etruscan_shade'], 'Пепел взвивается столбом и складывается в фигуру: {m}!')) return;
  if (roll < 0.5) { log('Только пепел и обгорелые кости.', C.dim); return; }
  if (roll < 0.75) { giveCoins(3, 15, 'В пепле — бронзовые монеты: {c} мон.'); return; }
  const loot = rng.weighted(DUNGEON_LOOT.etruscan);
  takeTrophy(loot);
  log(`Среди пепла: ${loot.name.toLowerCase()}.`, C.gold);
}

// Рудная жила: можно выбить кусок руды (долго и шумно).
function mineOre(x, y) {
  const w = G.world, p = G.player;
  w.set(x, y, T.ORE_DUG);
  for (let i = 0; i < 4; i++) passTime(MINUTES_PER_TURN);
  if (w.richVein) {
    takeTrophy(DUNGEON_LOOT.mine[0]); takeTrophy(DUNGEON_LOOT.mine[0]);
    log('Жила здесь толще руки: ты выламываешь два куска чистого серебра.', C.gold);
  } else if (rng.chance(0.55)) {
    const loot = rng.weighted(DUNGEON_LOOT.mine);
    takeTrophy(loot);
    log(`Ты выбиваешь из стены: ${loot.name.toLowerCase()}.`, C.gold);
  } else if (rng.chance(0.4) && carryLoad(p) + GOODS.iron.w <= p.capacity) {
    p.goods.iron = (p.goods.iron || 0) + 1;
    log('Пустая порода, зато под ней — железняк. Пригодится кузнецу (+1 железо).', C.text);
  } else log('Порода крошится — пусто. Только шум на всю штольню.', C.dim);
  // Шум будит обитателей.
  for (const a of w.actors) if (a.kind === 'beast' && dist(a, p) < 14) a.target = [p.x, p.y];
}

// Могила мученика в катакомбах: помолиться, а не грабить.
function venerateShrine(x, y) {
  const p = G.player, w = G.world, site = w.site;
  G.flags.shrines = G.flags.shrines || {};
  const key = `${site.id}:${w.depth}:${x},${y}`;
  if (G.flags.shrines[key]) { log('Ты уже молился у этой могилы. Лампада теплится.', C.dim); return; }
  G.flags.shrines[key] = true;
  p.grace = p.maxGrace;
  p.hp = Math.min(p.maxHp, p.hp + 5);
  p.lastPractice = timeInfo().day;
  addPiety(3, 'Молитва у могилы мученика.');
  faithDeed('altar');
  log('Ты преклоняешь колени у плиты с выбитым голубем и пальмовой ветвью. Под землёй становится тише.', C.gold);
}

// Тайники в подземельях (сундуки на дне).
function dungeonContainer(kind) {
  switch (kind) {
    case 'necro':
      giveCoins(30, 70, 'В сундуке чернокнижника — серебро, вырученное за «мощи»: {c} мон.');
      giveItem(['reliquary', 'rosary', 'apollonia'], 'И настоящая святыня, которую он не успел продать: {it}.');
      addPiety(2, 'Ты спас святыню от поругания.');
      return true;
    case 'offerings':
      giveCoins(25, 60, 'Сундук с приношениями посвящённых: {c} мон.');
      giveItem(['signet', 'gorgoneion', 'sword'], 'Среди приношений: {it}.');
      return true;
    case 'bough': return takeBough();
    case 'secret': {
      giveCoins(10 + G.world.depth * 8, 35 + G.world.depth * 15, 'В потайной нише — чей-то схрон: {c} мон.');
      if (rng.chance(0.5)) { G.player.potions++; log('И склянка целебного отвара.', C.green); }
      if (rng.chance(0.3)) giveItem(['dagger', 'rosary', 'apollonia', 'horseshoe', 'bracers', 'boots', 'torch'], 'И ещё: {it}.');
      return true;
    }
    case 'vault': {
      giveCoins(40 + G.world.depth * 15, 90 + G.world.depth * 25, 'Сокровищница! Сундук полон монет: {c} мон.');
      const t = G.world.site.type, loot = DUNGEON_LOOT[t] || DUNGEON_LOOT.roman;
      const l = rng.weighted(loot); takeTrophy(l); log(`И ещё: ${l.name.toLowerCase()}.`, C.gold);
      giveItem(['sword', 'mail', 'kite', 'nasal', 'chausses', 'greaves', 'mittens', 'longbow', 'crossbow', 'gorgoneion', 'signet', 'reliquary'], 'На дне — {it}!');
      return true;
    }
    case 'dis_treasure':
      giveCoins(150, 300, 'Сокровищница Дита — Отца богатств: {c} мон. древнего золота.');
      if (!hasItem('pluto_helm')) giveItem(['pluto_helm'], 'На подушке из чёрного бархата — {it}.');
      else giveItem(['gorgoneion', 'signet', 'reliquary'], 'И ещё: {it}.');
      return true;
    case 'wreck': {
      giveCoins(15, 45, 'Сундук с разбитой галеры: размокшие счета и {c} мон.');
      const loot = rng.weighted(DUNGEON_LOOT.grotto);
      takeTrophy(loot);
      log(`И ещё: ${loot.name.toLowerCase()}.`, C.gold);
      if (rng.chance(0.35)) giveItem(['crossbow', 'genoese', 'kite', 'nasal'], 'На дне сундука — {it}.');
      return true;
    }
  }
  return false;
}
