'use strict';

// ─── Местные карты ─────────────────────────────────────────────────
// Каждая клетка карты Италии разворачивается в местную карту: дикую
// местность, город или особое место.

const LOCAL_W = 90, LOCAL_H = 50;

// Состав местности: [доля, клетка] от самых «высоких» значений шума вниз;
// остаток заполняется rest.
const BIOMES = {
  plain:   { parts: [[0.1, T.FOREST], [0.16, T.TALLGRASS]], rest: T.GRASS, trees: 0.02 },
  field:   { parts: [[0.06, T.FOREST], [0.5, T.FIELD]], rest: T.GRASS, trees: 0.01 },
  forest:  { parts: [[0.04, T.PINE], [0.58, T.FOREST], [0.08, T.TALLGRASS]], rest: T.GRASS },
  pine:    { parts: [[0.05, T.ROCK], [0.6, T.PINE], [0.1, T.HILL]], rest: T.GRASS },
  hill:    { parts: [[0.06, T.ROCK], [0.42, T.HILL], [0.16, T.FOREST]], rest: T.GRASS },
  mount:   { parts: [[0.28, T.ROCK], [0.36, T.HILL], [0.14, T.PINE]], rest: T.GRASS },
  marsh:   { parts: [[0.14, T.WATER], [0.5, T.MARSH], [0.14, T.TALLGRASS]], rest: T.GRASS },
  volcano: { parts: [[0.05, T.LAVA], [0.25, T.ROCK], [0.5, T.ASH]], rest: T.HILL },
};

function fillBiome(world, r, biome) {
  const { w, h } = world, B = BIOMES[biome] || BIOMES.plain;
  const n = makeFbm(w, h, r, 14);
  const vals = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) vals[y * w + x] = n(x, y);
  const sorted = Array.from(vals).sort((a, b) => b - a);
  const cuts = [];
  let acc = 0;
  for (const [frac, t] of B.parts) {
    acc += frac;
    cuts.push([sorted[Math.min(sorted.length - 1, Math.floor(acc * sorted.length))], t]);
  }
  for (let i = 0; i < w * h; i++) {
    let t = B.rest;
    for (const [cut, tt] of cuts) if (vals[i] > cut) { t = tt; break; }
    if (t === B.rest && B.trees && r.chance(B.trees)) t = T.FOREST;
    world.tiles[i] = t;
  }
}

// Море с одной из сторон: dir — [dx, dy] наружу.
function addSeaSide(world, r, dx, dy) {
  const { w, h } = world;
  const along = makeValueNoise(Math.max(w, h), 4, 6, r);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let d, a;
      if (dx === 1) { d = w - 1 - x; a = y; }
      else if (dx === -1) { d = x; a = y; }
      else if (dy === 1) { d = h - 1 - y; a = x; }
      else { d = y; a = x; }
      const depth = (dx ? 7 : 4) + along(a, 1) * (dx ? 9 : 6);
      if (d < depth) world.set(x, y, T.SEA);
      else if (d < depth + 2) world.set(x, y, T.SAND);
    }
}

function addRiver(world, r) {
  const { w, h } = world;
  const vertical = r.chance(0.5);
  const len = vertical ? h : w, span = vertical ? w : h;
  let c = span / 2 + r.int(-8, 8);
  const fordAt = Math.floor(len / 2) + r.int(-6, 6);
  for (let i = 0; i < len; i++) {
    c += r.int(-1, 1) * 0.7;
    c = Math.max(6, Math.min(span - 7, c));
    for (let k = 0; k < (vertical ? 3 : 2); k++) {
      const p = Math.floor(c) + k;
      const [x, y] = vertical ? [p, i] : [i, p];
      if (world.get(x, y) === T.SEA) continue;
      world.set(x, y, Math.abs(i - fordAt) <= 1 ? T.FORD : T.WATER);
    }
  }
}

// Дорога «пьяным» шагом от (x0, y0) к (x1, y1).
function paveLine(world, r, x0, y0, x1, y1, keep) {
  let x = x0, y = y0;
  for (let guard = 0; guard < 400 && (x !== x1 || y !== y1); guard++) {
    const t = world.get(x, y);
    if (!keep(x, y)) {
      if (t === T.WATER || t === T.FORD) world.set(x, y, T.BRIDGE);
      else if (t !== T.SEA && t !== T.BRIDGE) world.set(x, y, T.ROAD);
    }
    const dx = Math.sign(x1 - x), dy = Math.sign(y1 - y);
    if (dx && dy) { if (r.chance(0.5)) x += dx; else y += dy; }
    else if (dx) { x += dx; if (r.chance(0.15)) y += r.int(-1, 1); }
    else { y += dy; if (r.chance(0.15)) x += r.int(-1, 1); }
    x = Math.max(0, Math.min(world.w - 1, x));
    y = Math.max(0, Math.min(world.h - 1, y));
  }
}

function roadTarget(world, dx, dy) {
  const { w, h } = world;
  return [
    dx > 0 ? w - 1 : dx < 0 ? 0 : (w >> 1) + rng.int(-6, 6),
    dy > 0 ? h - 1 : dy < 0 ? 0 : (h >> 1) + rng.int(-3, 3),
  ];
}

// Собрать сведения о клетке Италии для местной карты.
function localContext(ow, x, y) {
  const place = ow.placeAt(x, y);
  const t = place ? place.terrain : ow.get(x, y);
  const ctx = {
    biome: OT_LOCAL[t] || 'plain',
    region: ow.regionAt(x, y),
    river: ow.get(x, y) === OT.RIVER,
    sea: DIRS4.filter(([dx, dy]) => ow.isWater(x + dx, y + dy)),
    roads: DIRS8.filter(([dx, dy]) => ow.inside(x + dx, y + dy) && ow.road[ow.idx(x + dx, y + dy)] >= 0
      && ow.road[ow.idx(x, y)] >= 0),
    seed: (x * 73856093) ^ (y * 19349663) ^ G.seed,
  };
  return ctx;
}

function newLocal(ctx) {
  const world = new World(LOCAL_W, LOCAL_H);
  world.region = ctx.region;
  const r = new RNG(ctx.seed);
  fillBiome(world, r, ctx.biome);
  for (const [dx, dy] of ctx.sea) addSeaSide(world, r, dx, dy);
  return { world, r };
}

function makeWildLocal(ctx) {
  const { world, r } = newLocal(ctx);
  world.kind = 'wild';
  if (ctx.river) addRiver(world, r);
  const cx = world.w >> 1, cy = world.h >> 1;
  for (const [dx, dy] of ctx.roads) {
    const [tx, ty] = roadTarget(world, dx, dy);
    paveLine(world, r, cx, cy, tx, ty, () => false);
  }
  clearAround(world, cx, cy);
  return world;
}

// Гарантировать, что игроку есть где стоять.
function clearAround(world, x, y) {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if (!world.walkable(x + dx, y + dy)) world.set(x + dx, y + dy, T.GRASS);
}

// ─── Города ────────────────────────────────────────────────────────

const BUILDING_PLAN = [
  { type: 'church',  name: 'Церковь',          w: 9, h: 7, role: 'priest' },
  { type: 'inn',     name: 'Остерия',          w: 9, h: 6, role: 'innkeeper' },
  { type: 'elder',   name: 'Палаццо коммуны',  w: 7, h: 5, role: 'elder' },
  { type: 'smithy',  name: 'Кузница',          w: 6, h: 5, role: 'smith' },
  { type: 'herbal',  name: 'Лавка травницы',   w: 5, h: 5, role: 'herbalist' },
  { type: 'hut',     name: 'Дом',              w: 5, h: 4, role: 'peasant', optional: true },
  { type: 'hut',     name: 'Дом',              w: 6, h: 4, role: 'peasant', optional: true },
  { type: 'hut',     name: 'Дом',              w: 5, h: 4, role: 'peasant', optional: true },
];

function makeCityLocal(ow, city) {
  const ctx = localContext(ow, city.x, city.y);
  ctx.roads = DIRS8.filter(([dx, dy]) => ow.inside(city.x + dx, city.y + dy) && ow.road[ow.idx(city.x + dx, city.y + dy)] >= 0);
  const { world, r } = newLocal(ctx);
  world.kind = 'city';
  world.city = city;
  const big = city.kind === 'city';
  const tw = big ? 35 : 31, th = big ? 21 : 19;
  const cx = world.w >> 1, cy = world.h >> 1;
  const x0 = cx - (tw >> 1), y0 = cy - (th >> 1);

  // Дороги — от ворот к краям карты.
  const gates = {
    n: [cx, y0 - 1], s: [cx, y0 + th], w: [x0 - 1, cy], e: [x0 + tw, cy],
  };
  const inTown = (x, y) => x >= x0 - 1 && y >= y0 - 1 && x <= x0 + tw && y <= y0 + th;
  for (const [dx, dy] of ctx.roads) {
    const g = dy < 0 ? gates.n : dy > 0 ? gates.s : dx < 0 ? gates.w : gates.e;
    const [tx, ty] = roadTarget(world, dx, dy);
    paveLine(world, r, g[0], g[1], tx, ty, inTown);
  }

  const v = buildVillage(world, r, cx, cy, tw, th, city);
  if (big) {
    for (let x = x0 - 1; x <= x0 + tw; x++) { world.set(x, y0 - 1, T.STONEWALL); world.set(x, y0 + th, T.STONEWALL); }
    for (let y = y0 - 1; y <= y0 + th; y++) { world.set(x0 - 1, y, T.STONEWALL); world.set(x0 + tw, y, T.STONEWALL); }
    for (const [gx, gy] of Object.values(gates)) {
      world.set(gx, gy, T.ROAD);
      if (gx === cx) { world.set(gx - 1, gy, T.ROAD); world.set(gx + 1, gy, T.ROAD); }
      else { world.set(gx, gy - 1, T.ROAD); world.set(gx, gy + 1, T.ROAD); }
    }
  }
  // Пристань в сторону моря.
  if (city.port && ctx.sea.length) {
    const [dx, dy] = ctx.sea[0];
    let x = dx ? (dx > 0 ? x0 + tw : x0 - 1) : cx + 4, y = dy ? (dy > 0 ? y0 + th : y0 - 1) : cy + 2;
    for (let k = 0; k < 30 && world.inside(x, y); k++, x += dx, y += dy) {
      const t = world.get(x, y);
      if (t === T.SEA) world.set(x, y, T.PIER);
      else if (t !== T.PIER) world.set(x, y, T.DIRT);
    }
  }
  world.villages.push(v);
  return world;
}

function buildVillage(world, r, cx, cy, tw, th, city) {
  const x0 = cx - (tw >> 1), y0 = cy - (th >> 1);
  const vid = world.villages.length;
  for (let attempt = 0; attempt < 30; attempt++) {
    const placed = [];
    const occupied = (bx, by, bw, bh) => {
      if (bx - 1 <= cx + 3 && bx + bw + 1 >= cx - 3 && by - 1 <= cy + 2 && by + bh + 1 >= cy - 2) return true;
      return placed.some(p => bx - 1 <= p.x + p.w && bx + bw + 1 >= p.x && by - 1 <= p.y + p.h && by + bh + 1 >= p.y);
    };
    let ok = true;
    for (const plan of BUILDING_PLAN) {
      let done = false;
      for (let t = 0; t < 150 && !done; t++) {
        const bx = r.int(x0 + 1, x0 + tw - plan.w - 1);
        const by = r.int(y0 + 1, y0 + th - plan.h - 1);
        if (occupied(bx, by, plan.w, plan.h)) continue;
        placed.push({ ...plan, x: bx, y: by });
        done = true;
      }
      if (!done && !plan.optional) { ok = false; break; }
    }
    if (!ok) continue;

    for (let y = y0; y < y0 + th; y++)
      for (let x = x0; x < x0 + tw; x++) {
        world.set(x, y, r.chance(0.05) ? T.TALLGRASS : T.GRASS);
        world.zone[world.idx(x, y)] = vid;
      }
    for (let y = cy - 2; y <= cy + 2; y++)
      for (let x = cx - 3; x <= cx + 3; x++) world.set(x, y, T.DIRT);
    world.set(cx, cy, T.WELL);
    // Улицы от площади к воротам.
    for (let x = x0; x < x0 + tw; x++) if (world.get(x, cy) === T.GRASS || world.get(x, cy) === T.TALLGRASS) world.set(x, cy, T.DIRT);
    for (let y = y0; y < y0 + th; y++) if (world.get(cx, y) === T.GRASS || world.get(cx, y) === T.TALLGRASS) world.set(cx, y, T.DIRT);

    const village = { id: vid, name: city.name, city, cx, cy, x0, y0, w: tw, h: th, buildings: [], npcs: [] };
    for (const p of placed) village.buildings.push(placeBuilding(world, r, p, village));
    return village;
  }
  return null;
}

function placeBuilding(world, r, p, village) {
  const bid = world.buildings.length;
  const name = p.type === 'church' && village.city.kind === 'city' ? 'Собор' : p.name;
  const b = { id: bid, type: p.type, name, role: p.role, x: p.x, y: p.y, w: p.w, h: p.h, village };
  world.buildings.push(b);
  for (let y = p.y; y < p.y + p.h; y++)
    for (let x = p.x; x < p.x + p.w; x++) {
      const edge = x === p.x || y === p.y || x === p.x + p.w - 1 || y === p.y + p.h - 1;
      world.set(x, y, edge ? T.WALL : T.FLOOR);
      world.building[world.idx(x, y)] = bid;
    }
  const bcx = p.x + (p.w >> 1), bcy = p.y + (p.h >> 1);
  const dx = village.cx - bcx, dy = village.cy - bcy;
  let door;
  if (Math.abs(dx) * 0.6 > Math.abs(dy)) door = [dx > 0 ? p.x + p.w - 1 : p.x, bcy];
  else door = [bcx, dy > 0 ? p.y + p.h - 1 : p.y];
  world.set(door[0], door[1], T.DOOR);
  b.door = door;
  // Перед дверью — утоптанная земля.
  const out = [door[0] + Math.sign(door[0] - bcx) * (door[0] === p.x || door[0] === p.x + p.w - 1 ? 1 : 0),
    door[1] + Math.sign(door[1] - bcy) * (door[1] === p.y || door[1] === p.y + p.h - 1 ? 1 : 0)];
  if (world.building[world.idx(out[0], out[1])] === -1) world.set(out[0], out[1], T.DIRT);

  const inner = [];
  for (let y = p.y + 1; y < p.y + p.h - 1; y++)
    for (let x = p.x + 1; x < p.x + p.w - 1; x++)
      if (Math.abs(x - door[0]) + Math.abs(y - door[1]) > 2) inner.push([x, y]);
  inner.sort((a, c) => (Math.abs(c[0] - door[0]) + Math.abs(c[1] - door[1])) - (Math.abs(a[0] - door[0]) + Math.abs(a[1] - door[1])));
  const far = inner[0];
  const atWall = ([x, y]) => x === p.x + 1 || x === p.x + p.w - 2 || y === p.y + 1 || y === p.y + p.h - 2;
  const furnish = (t, n) => {
    const spots = r.shuffle(inner.filter(atWall).slice(0, 8));
    for (let i = 0; i < n && i < spots.length; i++) world.set(spots[i][0], spots[i][1], t);
  };
  switch (p.type) {
    case 'church': {
      let ax = bcx, ay = bcy;
      if (door[1] === p.y) ay = p.y + p.h - 2;
      else if (door[1] === p.y + p.h - 1) ay = p.y + 1;
      else ax = door[0] === p.x ? p.x + p.w - 2 : p.x + 1;
      world.set(ax, ay, T.ALTAR);
      break;
    }
    case 'inn': furnish(T.TABLE, 3); break;
    case 'smithy': if (far) world.set(far[0], far[1], T.ANVIL); break;
    case 'herbal': if (far) world.set(far[0], far[1], T.SHELF); break;
    default: if (far) world.set(far[0], far[1], T.BED);
  }
  return b;
}

// ─── Особые места ──────────────────────────────────────────────────

function makeSiteLocal(ow, site) {
  const ctx = localContext(ow, site.x, site.y);
  ctx.biome = site.id === 'gerundo' ? 'marsh' : 'forest';
  ctx.river = false;
  const { world, r } = newLocal(ctx);
  world.kind = 'site';
  world.site = site;
  const cx = world.w >> 1, cy = world.h >> 1;
  if (site.id === 'gerundo') {
    // Гнилое озеро посередине.
    for (let y = 0; y < world.h; y++)
      for (let x = 0; x < world.w; x++) {
        const d = Math.hypot((x - cx) / 16, (y - cy) / 8) + (hash2(x, y) - 0.5) * 0.15;
        if (d < 1) world.set(x, y, T.WATER);
        else if (d < 1.25) world.set(x, y, T.MARSH);
      }
  } else {
    for (let y = cy - 6; y <= cy + 6; y++)
      for (let x = cx - 12; x <= cx + 12; x++)
        if (Math.hypot((x - cx) / 2, y - cy) < 6) world.set(x, y, T.GRASS);
    world.set(cx, cy, T.WALNUT);
  }
  return world;
}

// Где игрок появляется на местной карте: на дороге или в центре.
function entryPoint(world, fromDx = 0, fromDy = 0) {
  const { w, h } = world;
  if (fromDx || fromDy) {
    // Вход с края, откуда пришёл.
    const x = fromDx > 0 ? 1 : fromDx < 0 ? w - 2 : w >> 1;
    const y = fromDy > 0 ? 1 : fromDy < 0 ? h - 2 : h >> 1;
    for (let rad = 0; rad < 20; rad++)
      for (let k = -rad; k <= rad; k++) {
        const cand = fromDx ? [x + Math.sign(fromDx) * Math.abs(k) % 3, y + k] : [x + k, y + Math.sign(fromDy) * Math.abs(k) % 3];
        if (world.free(cand[0], cand[1])) return cand;
      }
  }
  const cx = w >> 1, cy = h >> 1;
  for (let rad = 0; rad < 30; rad++)
    for (let dy = -rad; dy <= rad; dy++)
      for (let dx = -rad; dx <= rad; dx++)
        if (world.free(cx + dx, cy + dy) && world.zone[world.idx(cx + dx, cy + dy)] === -1) return [cx + dx, cy + dy];
  return [cx, cy];
}
