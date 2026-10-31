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
  // Мальта: голый известняк, колючий кустарник, редкие рожковые деревья, поля за каменными оградами.
  garrigue: { parts: [[0.08, T.ROCK], [0.14, T.STONES], [0.3, T.FIELD], [0.18, T.TALLGRASS]], rest: T.GRASS, trees: 0.015 },
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
  if (ctx.region === 'malta' && ['plain', 'field', 'forest', 'pine'].includes(ctx.biome)) ctx.biome = 'garrigue';
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
  connectRegions(world, cx, cy);
  return world;
}

// Скалы не должны запирать путника: каждый заметный клочок проходимой
// земли соединяется тропой с тем, где стоит игрок (и с краем карты).
function connectRegions(world, cx, cy) {
  const { w, h } = world, N = w * h, comp = new Int32Array(N).fill(-1), sizes = [];
  const pass = i => TILES[world.tiles[i]].walk;
  for (let s = 0; s < N; s++) {
    if (comp[s] >= 0 || !pass(s)) continue;
    const id = sizes.length, st = [s];
    comp[s] = id;
    let n = 0;
    while (st.length) {
      const i = st.pop(), x = i % w, y = (i / w) | 0;
      n++;
      for (const [dx, dy] of DIRS8) {
        const X = x + dx, Y = y + dy, j = Y * w + X;
        if (X >= 0 && Y >= 0 && X < w && Y < h && comp[j] < 0 && pass(j)) { comp[j] = id; st.push(j); }
      }
    }
    sizes.push(n);
  }
  let main = comp[world.idx(cx, cy)];
  if (main < 0) main = sizes.indexOf(Math.max(...sizes));
  if (main < 0) return;
  const linked = new Set([main]);
  const targets = sizes.map((n, id) => id).filter(id => id !== main && sizes[id] >= 12).sort((a, b) => sizes[b] - sizes[a]);
  for (const id of targets) {
    if (linked.has(id)) continue;
    // Дейкстра от всех клеток связанной части до клочка id; скала — дорого, вода — брод, ещё дороже.
    const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), q = [];
    for (let i = 0; i < N; i++) if (linked.has(comp[i])) { dist[i] = 0; q.push(i); }
    let end = -1;
    // Простая очередь по корзинам (стоимости целые и маленькие).
    const buckets = [q];
    for (let d = 0; d < buckets.length && end < 0; d++) {
      const bq = buckets[d];
      if (!bq) continue;
      for (let k = 0; k < bq.length && end < 0; k++) {
        const i = bq[k];
        if (dist[i] < d) continue;   // устаревшая запись
        if (comp[i] === id) { end = i; break; }
        const x = i % w, y = (i / w) | 0;
        for (const [dx, dy] of DIRS4) {
          const X = x + dx, Y = y + dy;
          if (X < 1 || Y < 1 || X >= w - 1 || Y >= h - 1) continue;
          const j = Y * w + X, t = world.tiles[j];
          if (t === T.SEA || t === T.LAVA) continue;
          const nd = d + (pass(j) ? 1 : t === T.WATER ? 8 : 4);
          if (nd < dist[j]) { dist[j] = nd; prev[j] = i; (buckets[nd] = buckets[nd] || []).push(j); }
        }
      }
    }
    if (end < 0) continue;
    for (let i = end; i >= 0 && dist[i] > 0; i = prev[i]) if (!pass(i)) world.tiles[i] = world.tiles[i] === T.WATER ? T.FORD : T.DIRT;
    // Тропа сливает клочки: всё, что она задела, теперь связано.
    for (let i = end; i >= 0; i = prev[i]) { if (comp[i] >= 0) linked.add(comp[i]); if (dist[i] === 0) break; }
    linked.add(id);
  }
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
  ctx.biome = site.id === 'gerundo' ? 'marsh' : site.id === 'ggantija' ? 'hill' : 'forest';
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
  } else if (site.id === 'ggantija') {
    // Два храма-«трилистника»: кольца исполинских камней, внутри — апсиды и плита-алтарь.
    for (let y = cy - 9; y <= cy + 9; y++) for (let x = cx - 24; x <= cx + 24; x++) if (world.inside(x, y)) world.set(x, y, T.GRASS);
    // Каждый храм — слияние четырёх овальных апсид; стена — край этого слияния, вход с юга.
    for (const [ox, oy, k] of [[-10, 0, 1], [10, 1, 0.85]]) {
      const lobes = [[0, -3], [-5, 0], [5, 0], [0, 2]];
      const inT = (x, y) => lobes.some(([lx, ly]) => Math.hypot((x - (cx + ox + lx * k)) / (4.5 * k), (y - (cy + oy + ly * k)) / (2.6 * k)) < 1);
      const doorY = cy + oy + Math.round(2 * k + 2.6 * k);
      for (let y = cy + oy - 8; y <= cy + oy + 8; y++)
        for (let x = cx + ox - 14; x <= cx + ox + 14; x++) {
          if (!world.inside(x, y) || !inT(x, y)) continue;
          const edge = DIRS8.some(([dx, dy]) => !inT(x + dx, y + dy));
          const door = Math.abs(x - (cx + ox)) <= 1 && y >= doorY - 1;
          if (edge && !door) world.set(x, y, hash2(x, y) < 0.15 ? T.RUBBLE : T.ROCK);
          else world.set(x, y, T.DIRT);
        }
      world.set(cx + ox, cy + oy - Math.round(3 * k), T.PAGAN_ALTAR);
    }
  } else {
    for (let y = cy - 6; y <= cy + 6; y++)
      for (let x = cx - 12; x <= cx + 12; x++)
        if (Math.hypot((x - cx) / 2, y - cy) < 6) world.set(x, y, T.GRASS);
    world.set(cx, cy, T.WALNUT);
  }
  connectRegions(world, cx + 3, cy);
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
