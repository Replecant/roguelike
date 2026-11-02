'use strict';

// ─── Глушь: край, соседи, реки, следы человека, звери ──────────────
// Дикая карта (вторая версия, ctx.wildV >= 2) — не просто «шум по типу клетки»:
//  • край меняет местность: альпийские луга, маквис, степь Арагона, низины По, дремучий лес Боснии;
//  • соседние клетки карты мира заходят на края: опушка леса, поля у села, предгорья;
//  • река течёт так, как на карте мира — с той стороны, где река входит, туда, куда уходит;
//  • проселки к сёлам — тропами; у пашен — полосы, межи, пар, копны, крест у дороги, каменные ограды;
//  • зверей немного: в глуши можно бродить и никого не встретить.

// Варианты местности по краям.
Object.assign(BIOMES, {
  alpine:   { parts: [[0.16, T.PINE], [0.18, T.TALLGRASS]], rest: T.GRASS, spots: [[0.04, T.ROCK], [0.06, T.STONES]] },
  mixed:    { parts: [[0.3, T.PINE], [0.32, T.FOREST], [0.08, T.TALLGRASS]], rest: T.GRASS },
  maquis:   { parts: [[0.32, T.FOREST], [0.22, T.TALLGRASS]], rest: T.GRASS, spots: [[0.04, T.ROCK], [0.06, T.STONES]] },
  steppe:   { parts: [[0.4, T.TALLGRASS]], rest: T.GRASS, trees: 0.004, spots: [[0.015, T.ROCK], [0.04, T.STONES]] },
  lowland:  { parts: [[0.025, T.WATER], [0.07, T.MARSH], [0.12, T.FOREST], [0.14, T.TALLGRASS]], rest: T.GRASS },
  wildwood: { parts: [[0.1, T.PINE], [0.64, T.FOREST], [0.06, T.TALLGRASS]], rest: T.GRASS },
  lande:    { parts: [[0.12, T.MARSH], [0.35, T.TALLGRASS]], rest: T.GRASS, trees: 0.004, spots: [[0.05, T.PINE]] },   // ланды Гаскони: вереск, топи, сосны
  puy:      { parts: [[0.3, T.HILL], [0.1, T.PINE]], rest: T.GRASS, spots: [[0.1, T.ROCK], [0.08, T.STONES]] },   // Овернь: потухшие вулканы
});

// Земли старого образца; у земель из реестра — поле wild в defineLand ({ plain: 'steppe', ... }).
const WILD_BY_REGION = {
  alps: { plain: 'alpine', hill: 'alpine', forest: 'mixed' },
  tyrol: { plain: 'alpine', hill: 'alpine', forest: 'mixed' },
  helvetia: { plain: 'alpine', hill: 'alpine', forest: 'mixed' },
  savoy: { plain: 'alpine', hill: 'alpine', forest: 'mixed' },
  carantania: { forest: 'mixed' },
  lombardy: { plain: 'lowland' }, emilia: { plain: 'lowland' }, veneto: { plain: 'lowland' },
  dalmatia: { plain: 'garrigue' }, malta: { plain: 'garrigue', hill: 'garrigue' },
  corsica: { plain: 'maquis' }, sardinia: { plain: 'maquis' }, calabria: { plain: 'maquis' }, sicily: { plain: 'maquis' },
  apulia: { plain: 'steppe' },
};
// Где межи складывают из камней, что выбирают с поля.
const DRYWALL_LANDS = new Set(['dalmatia', 'istria', 'malta', 'baleares', 'menorca', 'apulia']);

function wildBiome(region, biome) {
  const ld = LAND_DEFS[region], tab = (ld && ld.wild) || WILD_BY_REGION[region] || {};
  return tab[biome] || biome;
}

// Какая местность в клетке карты мира (для соседей): у жилья — поля.
function overBiome(ow, x, y) {
  const place = ow.placeAt(x, y);
  if (place && place.type === 'city' && ['village', 'town', 'city', 'castle', 'monastery', 'inn'].includes(place.kind)) return 'field';
  return wildBiome(ow.regionAt(x, y), OT_LOCAL[place ? place.terrain : ow.get(x, y)] || 'plain');
}

// Соседние клетки заходят на края карты: полосой у стороны, пятном у угла; граница неровная.
function blendNeighbors(world, r, ow, ox, oy, biome) {
  const { w, h } = world;
  DIRS8.forEach(([dx, dy], k) => {
    const nx = ox + dx, ny = oy + dy;
    if (!ow.inside(nx, ny) || ow.isWater(nx, ny)) return;
    const nb = overBiome(ow, nx, ny);
    if (nb === biome) return;
    const tmp = new World(w, h);
    fillBiome(tmp, new RNG((r.next() * 0x7fffffff) ^ (k + 1) * 7919), nb);
    const wob = makeValueNoise(Math.max(w, h), Math.max(w, h), 7, r);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const ex = dx > 0 ? w - 1 - x : x, ey = dy > 0 ? h - 1 - y : y;
        // Доля пути от края внутрь: 0 — у самого края, 1 — граница полосы.
        let d;
        if (dx && dy) d = Math.hypot(ex / (w * 0.3), ey / (h * 0.3));
        else d = dx ? ex / (w * 0.24) : ey / (h * 0.26);
        d /= 0.65 + wob(x, y) * 0.7;
        if (d >= 1) continue;
        // Ближе к краю — сплошь соседская местность, к границе — вперемешку.
        if (d > 0.6 && hash2(x * 3 + k, y * 5 + 1) < (d - 0.6) / 0.4) continue;
        world.tiles[world.idx(x, y)] = tmp.tiles[tmp.idx(x, y)];
      }
  });
}

// Море у угла (вода на карте мира по диагонали, а по сторонам — суша).
function addSeaCorner(world, r, dx, dy) {
  const { w, h } = world, wob = makeValueNoise(w, h, 6, r);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ex = dx > 0 ? w - 1 - x : x, ey = dy > 0 ? h - 1 - y : y;
      const d = Math.hypot(ex / 22, ey / 12) / (0.75 + wob(x, y) * 0.5);
      if (d < 1) world.set(x, y, T.SEA);
      else if (d < 1.15 && world.get(x, y) !== T.SEA) world.set(x, y, T.SAND);
    }
}

// Куда течёт река: соседние клетки карты мира с рекой или водой.
function riverSides(ow, x, y) {
  return DIRS8.filter(([dx, dy]) => ow.inside(x + dx, y + dy) && (ow.get(x + dx, y + dy) === OT.RIVER || ow.isWater(x + dx, y + dy)));
}

// Река по карте мира: входит с одной стороны, уходит в другую, петляя; мимо середины (там стоит путник).
function addRiverFlow(world, r, sides, ford) {
  const { w, h } = world, cx = w >> 1, cy = h >> 1;
  if (!sides.length) return addRiver(world, r);
  let a = sides[0], b = null;
  if (sides.length > 1) {
    let best = -Infinity;
    for (const s1 of sides) for (const s2 of sides) {
      if (s1 === s2) continue;
      const ang = Math.abs(Math.atan2(s1[1], s1[0]) - Math.atan2(s2[1], s2[0]));
      const sep = Math.min(ang, Math.PI * 2 - ang);
      if (sep > best) { best = sep; a = s1; b = s2; }
    }
  }
  const edge = ([dx, dy]) => [dx > 0 ? w - 1 : dx < 0 ? 0 : cx + r.int(-10, 10), dy > 0 ? h - 1 : dy < 0 ? 0 : cy + r.int(-5, 5)];
  const p0 = edge(a);
  // Нет второй стороны — река здесь начинается (родник) или впадает: ведём к середине и чуть дальше.
  const p1 = b ? edge(b) : [cx - a[0] * 8 + r.int(-4, 4), cy - a[1] * 4 + r.int(-2, 2)];
  // Изгиб в сторону от середины, чтобы путник не стоял в воде.
  const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
  let nx = -(p1[1] - p0[1]), ny = p1[0] - p0[0];
  const nl = Math.hypot(nx, ny) || 1;
  nx /= nl; ny /= nl;
  const side = r.chance(0.5) ? 1 : -1, bend = r.int(7, 12);
  const c = [cx + (cx - mx) * 0 + nx * bend * side * 1.6, cy + ny * bend * side * 0.8];
  const vert = Math.abs(p1[1] - p0[1]) * 1.8 > Math.abs(p1[0] - p0[0]);
  const wide = vert ? 3 : 2;
  const pts = [];
  for (let i = 0; i <= 400; i++) {
    const t = i / 400, u = 1 - t;
    const x = u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0] + Math.sin(t * Math.PI * 5 + side) * 1.5 * nx;
    const y = u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1] + Math.sin(t * Math.PI * 5 + side) * 1.5 * ny;
    pts.push([Math.round(x), Math.round(y)]);
  }
  const fordAt = ford ? 0.4 + r.next() * 0.2 : -1;
  pts.forEach(([x, y], i) => {
    const t = i / pts.length;
    for (let k = 0; k < wide; k++) {
      const [X, Y] = vert ? [x + k, y] : [x, y + k];
      if (!world.inside(X, Y) || world.get(X, Y) === T.SEA) continue;
      world.set(X, Y, Math.abs(t - fordAt) < 0.008 ? T.FORD : T.WATER);
    }
  });
}

// Проселок (тропа) — как дорога, но утоптанной землёй; ручей переходят вброд.
function trackLine(world, r, x0, y0, x1, y1) {
  let x = x0, y = y0;
  const tread = (x, y) => {
    const t = world.get(x, y);
    if (t === T.WATER) world.set(x, y, T.FORD);
    else if (![T.SEA, T.ROAD, T.BRIDGE, T.FORD].includes(t)) world.set(x, y, T.DIRT);
  };
  for (let guard = 0; guard < 400 && (x !== x1 || y !== y1); guard++) {
    tread(x, y);
    const dx = Math.sign(x1 - x), dy = Math.sign(y1 - y);
    if (dx && dy) { if (r.chance(0.5)) x += dx; else y += dy; }
    else if (dx) { x += dx; if (r.chance(0.2)) { tread(x, y); y = Math.max(0, Math.min(world.h - 1, y + (r.chance(0.5) ? 1 : -1))); } }
    else { y += dy; if (r.chance(0.2)) { tread(x, y); x = Math.max(0, Math.min(world.w - 1, x + (r.chance(0.5) ? 1 : -1))); } }
  }
  tread(x, y);
}

// Дорога без разрывов по диагонали: где две клетки дороги касаются лишь углами, мостим и угол
// (иначе посреди дороги стоит дерево); тупик у края карты доводим до края.
const ROAD_FILL = new Set([T.GRASS, T.TALLGRASS, T.FOREST, T.PINE, T.HILL, T.FIELD, T.VINEYARD, T.MARSH, T.STONES, T.DIRT,
  T.GARDEN, T.ASH, T.ROCK, T.SAND, T.STUBBLE, T.CROP, T.FALLOW, T.WALNUT]);
function mendRoads(w) {
  /** @type {[Set<number>, number][]} */
  const passes = [[new Set([T.ROAD, T.BRIDGE]), T.ROAD], [new Set([T.DIRT, T.FORD, T.ROAD, T.BRIDGE]), T.DIRT]];
  for (const [kinds, tile] of passes) {
    const on = (x, y) => w.inside(x, y) && kinds.has(w.get(x, y));
    const fill = (x, y) => w.inside(x, y) && w.building[w.idx(x, y)] === -1 && ROAD_FILL.has(w.get(x, y)) && w.get(x, y) !== tile;
    const own = (x, y) => w.inside(x, y) && w.get(x, y) === tile;
    for (let y = 0; y < w.h; y++)
      for (let x = 0; x < w.w; x++) {
        if (!own(x, y)) continue;
        for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          if (!on(x + dx, y + dy) || on(x + dx, y) || on(x, y + dy)) continue;
          if (fill(x + dx, y)) w.set(x + dx, y, tile);
          else if (fill(x, y + dy)) w.set(x, y + dy, tile);
        }
        // Тупик у края — до края.
        const n = DIRS4.filter(([dx, dy]) => on(x + dx, y + dy)).length;
        if (n > 1) continue;
        for (const [dx, dy] of DIRS4) {
          const X = x + dx, Y = y + dy;
          if ((X === 0 || Y === 0 || X === w.w - 1 || Y === w.h - 1) && (x === 1 || y === 1 || x === w.w - 2 || y === w.h - 2) && fill(X, Y)) w.set(X, Y, tile);
        }
      }
  }
}

// ─── Следы человека у пашен ───
// Поле не сплошное «пятно»: полосы наделов вдоль межей (у каждой семьи — своя), часть земли под паром
// (трёхполье), лоза там, где её растят; после жатвы — копны; тропа через поля; у дороги — крест;
// на каменистом юге межи сложены из камней, что выбирали с поля веками.
function fieldTraces(world, r, ctx, ox, oy) {
  const { w, h } = world, N = w * h;
  let fields = 0;
  for (let i = 0; i < N; i++) if (world.tiles[i] === T.FIELD) fields++;
  const roads = [];
  for (let i = 0; i < N; i++) if (world.tiles[i] === T.ROAD) roads.push(i);
  if (fields >= 40) {
    const horiz = r.chance(0.6), sw = r.int(3, 5), plot = r.int(14, 22);
    const vine = vineShare({ x: ox, y: oy, region: ctx.region });
    const stone = DRYWALL_LANDS.has(ctx.region);
    const { m } = today();
    const mown = m >= 7 && m <= 9;   // после жатвы — копны на жнивье
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = world.idx(x, y);
        if (world.tiles[i] !== T.FIELD) continue;
        const across = horiz ? y : x, along = horiz ? x : y;
        if (across % (sw + 1) === sw) {   // межа
          world.tiles[i] = stone && hash2(x, y * 3) < 0.85 ? T.DRYWALL : T.GRASS;
          continue;
        }
        const strip = Math.floor(across / (sw + 1)), block = Math.floor(along / plot);
        const kind = hash2(strip * 7 + 3, block * 13 + ox * 31 + oy * 17);
        if (kind < 0.26) world.tiles[i] = T.FALLOW;
        else if (kind < 0.26 + vine * 0.6) world.tiles[i] = T.VINEYARD;
        else if (mown && hash2(x * 5 + 2, y * 9 + 4) < 0.025) world.tiles[i] = T.HAY;
      }
    // Тропа через поля: от дороги (или от края) поперёк наделов — к другому краю.
    const start = roads.length ? roads[r.int(0, roads.length - 1)] : -1;
    const sx = start >= 0 ? start % w : horiz ? r.int(10, w - 10) : 0, sy = start >= 0 ? (start / w) | 0 : horiz ? 0 : r.int(6, h - 6);
    const [tx, ty] = horiz ? [sx + r.int(-12, 12), sy < h / 2 ? h - 1 : 0] : [sx < w / 2 ? w - 1 : 0, sy + r.int(-6, 6)];
    trackLine(world, r, sx, sy, Math.max(0, Math.min(w - 1, tx)), Math.max(0, Math.min(h - 1, ty)));
  }
  // Крест у дороги — где тропа сходит с тракта, или просто у обочины.
  if (roads.length && r.chance(fields >= 40 ? 0.7 : 0.3)) {
    for (let t = 0; t < 60; t++) {
      const i = roads[r.int(0, roads.length - 1)], x = i % w, y = (i / w) | 0;
      const spot = DIRS4.map(([dx, dy]) => [x + dx, y + dy]).find(([X, Y]) => world.inside(X, Y)
        && [T.GRASS, T.TALLGRASS, T.FIELD, T.FALLOW].includes(world.get(X, Y))
        && DIRS8.filter(([ax, ay]) => world.get(X + ax, Y + ay) === T.ROAD).length <= 3);
      if (spot) { world.set(spot[0], spot[1], T.WAYCROSS); break; }
    }
  }
}

// ─── Звери в глуши ───
// Сколько стай и одиночек бродит по карте: в лесу и топях больше, в полях у жилья — почти никого;
// у тракта меньше; ночью больше; иногда вокруг тихо совсем.
const WILD_LIFE = { field: 1, plain: 2, garrigue: 1, steppe: 2, lowland: 2, maquis: 2, alpine: 2, hill: 2, puy: 2,
  forest: 3, mixed: 3, wildwood: 4, pine: 3, mount: 2, marsh: 3, volcano: 1 };
function wildPopulation(ow, x, y, biome, night) {
  let n = WILD_LIFE[biome] ?? 2;
  if (ow.road[ow.idx(x, y)] >= 0) n -= 1;
  if (nearSettlement(x, y)) n -= 1;
  if (night) n += 1;
  n += rng.int(-1, 1);
  if (rng.chance(0.2)) n = Math.min(n, 1);   // тишина: птицы да ветер
  return Math.max(0, n);
}

// Дикая карта второй версии.
function makeWildLocal2(ctx, ow, ox, oy) {
  const world = new World(LOCAL_W, LOCAL_H);
  world.region = ctx.region;
  world.kind = 'wild';
  const r = new RNG(ctx.seed);
  const biome = wildBiome(ctx.region, ctx.biome);
  world.biome = biome;
  fillBiome(world, r, biome);
  blendNeighbors(world, r, ow, ox, oy, biome);
  for (const [dx, dy] of ctx.sea) addSeaSide(world, r, dx, dy);
  for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]])
    if (ow.isWater(ox + dx, oy + dy) && !ow.isWater(ox + dx, oy) && !ow.isWater(ox, oy + dy)) addSeaCorner(world, r, dx, dy);
  if (ctx.river) addRiverFlow(world, r, riverSides(ow, ox, oy), !ctx.roads.length);
  const cx = world.w >> 1, cy = world.h >> 1;
  for (const [dx, dy] of ctx.roads) {
    const [tx, ty] = roadTarget(world, dx, dy);
    paveLine(world, r, cx, cy, tx, ty, () => false);
  }
  // Проселки: к соседним клеткам с проселком, дорогой или жильём — если и здесь проселок.
  if (ow.isTrack(ox, oy) && !ctx.roads.length)
    for (const [dx, dy] of DIRS8) {
      const nx = ox + dx, ny = oy + dy;
      if (!ow.inside(nx, ny) || !(ow.isTrack(nx, ny) || ow.road[ow.idx(nx, ny)] >= 0 || ow.placeAt(nx, ny))) continue;
      const [tx, ty] = roadTarget(world, dx, dy);
      trackLine(world, r, cx, cy, tx, ty);
    }
  fieldTraces(world, r, ctx, ox, oy);
  mendRoads(world);
  clearAround(world, cx, cy);
  connectRegions(world, cx, cy);
  return world;
}
