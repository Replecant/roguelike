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
