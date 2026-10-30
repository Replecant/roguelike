'use strict';

// ─── Типы клеток ───────────────────────────────────────────────────

const T = {
  GRASS: 0, TALLGRASS: 1, FOREST: 2, PINE: 3, WATER: 4, MARSH: 5, HILL: 6,
  MOUNTAIN: 7, ROAD: 8, BRIDGE: 9, WALL: 10, DOOR: 11, FLOOR: 12, ALTAR: 13,
  WELL: 14, FIELD: 15, ANVIL: 16, TABLE: 17, DIRT: 18, BED: 19, SHELF: 20,
};

// ch — символ (или массив вариантов), walk — проходимость, see — прозрачность.
const TILES = [];
TILES[T.GRASS]     = { ch: ['.', '.', '.', ','], fg: ['#5f8a42', '#6a9448', '#557c3c'], walk: 1, see: 1, name: 'Луг', hab: 'field' };
TILES[T.TALLGRASS] = { ch: ['"'], fg: ['#7a9a40', '#8aa64a'], walk: 1, see: 1, name: 'Высокая трава', hab: 'field' };
TILES[T.FOREST]    = { ch: ['♣'], fg: ['#4f8a3c', '#5c9a44', '#447a34'], walk: 1, see: 0, name: 'Лес', hab: 'forest' };
TILES[T.PINE]      = { ch: ['♠'], fg: ['#2f6b3f', '#28603a', '#367546'], walk: 1, see: 0, name: 'Хвойная чаща', hab: 'pine' };
TILES[T.WATER]     = { ch: ['≈', '~'], fg: ['#3f78b8', '#3a6eaa'], walk: 0, see: 1, name: 'Река', bg: '#0e1a2c' };
TILES[T.MARSH]     = { ch: [',', '"', '.'], fg: ['#5a7a5a', '#4e6e60', '#6a8a50'], walk: 1, see: 1, name: 'Болото', hab: 'marsh', bg: '#0e1410' };
TILES[T.HILL]      = { ch: ['^', 'n'], fg: ['#8a8a6a', '#7a7a5c'], walk: 1, see: 1, name: 'Холмы', hab: 'hill' };
TILES[T.MOUNTAIN]  = { ch: ['▲'], fg: ['#a39d92', '#8e887e'], walk: 0, see: 0, name: 'Скалы' };
TILES[T.ROAD]      = { ch: ['·'], fg: ['#9a7a50'], walk: 1, see: 1, name: 'Дорога', hab: 'road' };
TILES[T.BRIDGE]    = { ch: ['='], fg: ['#9a6a3c'], walk: 1, see: 1, name: 'Мост', bg: '#0e1a2c', hab: 'road' };
TILES[T.WALL]      = { ch: ['#'], fg: ['#8a7058'], walk: 0, see: 0, name: 'Стена', bg: '#1e1810' };
TILES[T.DOOR]      = { ch: ['+'], fg: ['#c08a4a'], walk: 1, see: 0, name: 'Дверь' };
TILES[T.FLOOR]     = { ch: ['.'], fg: ['#6a5640'], walk: 1, see: 1, name: 'Дощатый пол', bg: '#17120c' };
TILES[T.ALTAR]     = { ch: ['†'], fg: ['#f0d070'], walk: 0, see: 1, name: 'Алтарь', bg: '#17120c' };
TILES[T.WELL]      = { ch: ['o'], fg: ['#7fb6d8'], walk: 0, see: 1, name: 'Колодец' };
TILES[T.FIELD]     = { ch: ['"', '"', '\''], fg: ['#c8a848', '#b8983c'], walk: 1, see: 1, name: 'Нива', hab: 'field' };
TILES[T.ANVIL]     = { ch: ['π'], fg: ['#a39d92'], walk: 0, see: 1, name: 'Наковальня', bg: '#17120c' };
TILES[T.TABLE]     = { ch: ['╥'], fg: ['#9a6a3c'], walk: 0, see: 1, name: 'Стол', bg: '#17120c' };
TILES[T.DIRT]      = { ch: ['.', ','], fg: ['#7a6448'], walk: 1, see: 1, name: 'Утоптанная земля' };
TILES[T.BED]       = { ch: ['▬'], fg: ['#a0503c'], walk: 0, see: 1, name: 'Лежанка', bg: '#17120c' };
TILES[T.SHELF]     = { ch: ['Ш'], fg: ['#7fae5a'], walk: 0, see: 1, name: 'Полка с травами', bg: '#17120c' };

// ─── Шум для рельефа ───────────────────────────────────────────────

function makeValueNoise(w, h, cell, r) {
  const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2;
  const g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = r.next();
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / cell, fy = y / cell;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = sm(fx - ix), ty = sm(fy - iy);
    const a = g[iy * gw + ix], b = g[iy * gw + ix + 1];
    const c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
    return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
  };
}

function makeFbm(w, h, r, base) {
  const o = [makeValueNoise(w, h, base, r), makeValueNoise(w, h, base / 2, r), makeValueNoise(w, h, base / 4, r)];
  return (x, y) => o[0](x, y) * 0.6 + o[1](x, y) * 0.28 + o[2](x, y) * 0.12;
}

function quantile(arr, p) {
  const s = Array.from(arr).sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

// ─── Мир ───────────────────────────────────────────────────────────

class World {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.tiles = new Uint8Array(w * h);
    this.explored = new Uint8Array(w * h);
    this.visible = new Uint8Array(w * h);
    this.zone = new Int16Array(w * h).fill(-1);      // индекс деревни
    this.building = new Int16Array(w * h).fill(-1);  // индекс постройки
    this.villages = [];
    this.buildings = [];
    this.actors = [];
    this.items = new Map();   // "x,y" -> [{...}]
  }

  idx(x, y) { return y * this.w + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inside(x, y) ? this.tiles[y * this.w + x] : T.MOUNTAIN; }
  set(x, y, t) { if (this.inside(x, y)) this.tiles[y * this.w + x] = t; }
  def(x, y) { return TILES[this.get(x, y)]; }
  walkable(x, y) { return this.inside(x, y) && TILES[this.tiles[y * this.w + x]].walk === 1; }
  transparent(x, y) { return this.inside(x, y) && TILES[this.tiles[y * this.w + x]].see === 1; }

  actorAt(x, y) {
    for (const a of this.actors) if (a.x === x && a.y === y && !a.dead) return a;
    return null;
  }

  free(x, y) { return this.walkable(x, y) && !this.actorAt(x, y); }

  villageAt(x, y) {
    const v = this.inside(x, y) ? this.zone[this.idx(x, y)] : -1;
    return v >= 0 ? this.villages[v] : null;
  }

  buildingAt(x, y) {
    const b = this.inside(x, y) ? this.building[this.idx(x, y)] : -1;
    return b >= 0 ? this.buildings[b] : null;
  }

  itemsAt(x, y) { return this.items.get(x + ',' + y) || []; }

  addItem(x, y, item) {
    const k = x + ',' + y;
    if (!this.items.has(k)) this.items.set(k, []);
    this.items.get(k).push(item);
  }

  takeItems(x, y) {
    const k = x + ',' + y, list = this.items.get(k) || [];
    this.items.delete(k);
    return list;
  }

  // Рекурсивное отбрасывание теней (shadowcasting), 8 октантов.
  computeFov(ox, oy, radius) {
    this.visible.fill(0);
    const mark = (x, y) => {
      if (!this.inside(x, y)) return;
      const i = this.idx(x, y);
      this.visible[i] = 1;
      this.explored[i] = 1;
    };
    mark(ox, oy);
    const mult = [
      [1, 0, 0, -1, -1, 0, 0, 1],
      [0, 1, -1, 0, 0, -1, 1, 0],
      [0, 1, 1, 0, 0, -1, -1, 0],
      [1, 0, 0, 1, -1, 0, 0, -1],
    ];
    const r2 = radius * radius + radius;
    const cast = (row, start, end, xx, xy, yx, yy) => {
      if (start < end) return;
      let newStart = 0;
      for (let j = row; j <= radius; j++) {
        let dx = -j - 1, dy = -j, blocked = false;
        while (dx <= 0) {
          dx++;
          const X = ox + dx * xx + dy * xy, Y = oy + dx * yx + dy * yy;
          const lSlope = (dx - 0.5) / (dy + 0.5), rSlope = (dx + 0.5) / (dy - 0.5);
          if (start < rSlope) continue;
          if (end > lSlope) break;
          if (dx * dx + dy * dy < r2) mark(X, Y);
          const opaque = !this.transparent(X, Y);
          if (blocked) {
            if (opaque) { newStart = rSlope; continue; }
            blocked = false;
            start = newStart;
          } else if (opaque && j < radius) {
            blocked = true;
            cast(j + 1, start, lSlope, xx, xy, yx, yy);
            newStart = rSlope;
          }
        }
        if (blocked) break;
      }
    };
    for (let o = 0; o < 8; o++)
      cast(1, 1.0, 0.0, mult[0][o], mult[1][o], mult[2][o], mult[3][o]);
  }

  isVisible(x, y) { return this.inside(x, y) && this.visible[this.idx(x, y)] === 1; }
}

// ─── Поиск пути (A*) для прокладки дорог ───────────────────────────

function findPath(world, sx, sy, tx, ty, costFn) {
  const W = world.w, N = world.w * world.h;
  const g = new Float32Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap = [];
  const push = (i, f) => {
    heap.push([f, i]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  const s = sy * W + sx, t = ty * W + tx;
  g[s] = 0;
  push(s, 0);
  while (heap.length) {
    const [, cur] = pop();
    if (cur === t) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % W, cy = (cur / W) | 0;
    for (const [dx, dy] of DIRS4) {
      const nx = cx + dx, ny = cy + dy;
      if (!world.inside(nx, ny)) continue;
      const c = costFn(nx, ny);
      if (c === Infinity) continue;
      const ni = ny * W + nx, ng = g[cur] + c;
      if (ng < g[ni]) {
        g[ni] = ng;
        from[ni] = cur;
        push(ni, ng + Math.abs(nx - tx) + Math.abs(ny - ty));
      }
    }
  }
  if (from[t] === -1) return null;
  const path = [];
  for (let c = t; c !== -1; c = from[c]) path.push([c % W, (c / W) | 0]);
  return path.reverse();
}

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// ─── Генерация ─────────────────────────────────────────────────────

const WORLD_W = 160, WORLD_H = 90;
const VILLAGE_W = 31, VILLAGE_H = 19;

const BUILDING_PLAN = [
  { type: 'church',  name: 'Церковь',          w: 9, h: 7, role: 'priest' },
  { type: 'inn',     name: 'Трактир',          w: 9, h: 6, role: 'innkeeper' },
  { type: 'elder',   name: 'Дом старосты',     w: 7, h: 5, role: 'elder' },
  { type: 'smithy',  name: 'Кузница',          w: 6, h: 5, role: 'smith' },
  { type: 'herbal',  name: 'Хижина знахарки',  w: 5, h: 5, role: 'herbalist' },
  { type: 'hut',     name: 'Изба',             w: 5, h: 4, role: 'peasant', optional: true },
  { type: 'hut',     name: 'Изба',             w: 6, h: 4, role: 'peasant', optional: true },
  { type: 'hut',     name: 'Изба',             w: 5, h: 4, role: 'peasant', optional: true },
];

function generateWorld(r) {
  const world = new World(WORLD_W, WORLD_H);
  const { w, h } = world;

  // Рельеф и влажность, выровненные по квантилям.
  const elevN = makeFbm(w, h, r, 22), moistN = makeFbm(w, h, r, 16);
  const elev = new Float32Array(w * h), moist = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      elev[y * w + x] = elevN(x, y);
      moist[y * w + x] = moistN(x, y);
    }
  const eWater = quantile(elev, 0.09), eMarsh = quantile(elev, 0.15);
  const eHill = quantile(elev, 0.86), eMount = quantile(elev, 0.95);
  const mPine = quantile(moist, 0.84), mForest = quantile(moist, 0.6), mDry = quantile(moist, 0.18);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, e = elev[i], m = moist[i];
      let t;
      if (e < eWater) t = T.WATER;
      else if (e < eMarsh && m > mForest * 0.9) t = T.MARSH;
      else if (e > eMount) t = T.MOUNTAIN;
      else if (e > eHill) t = m > mPine ? T.PINE : T.HILL;
      else if (m > mPine) t = T.PINE;
      else if (m > mForest) t = r.chance(0.12) ? T.GRASS : T.FOREST;
      else if (m < mDry) t = r.chance(0.5) ? T.TALLGRASS : T.GRASS;
      else t = r.chance(0.04) ? T.FOREST : r.chance(0.08) ? T.TALLGRASS : T.GRASS;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) t = T.MOUNTAIN;
      world.tiles[i] = t;
    }
  }

  // Деревни.
  const names = r.shuffle(VILLAGE_NAMES.slice());
  const count = 5;
  for (let tries = 0; tries < 3000 && world.villages.length < count; tries++) {
    const cx = r.int(VILLAGE_W, w - VILLAGE_W), cy = r.int(VILLAGE_H, h - VILLAGE_H);
    if (world.villages.some(v => Math.hypot(v.cx - cx, (v.cy - cy) * 1.5) < 36)) continue;
    let bad = 0;
    for (let y = cy - 9; y <= cy + 9; y++)
      for (let x = cx - 15; x <= cx + 15; x++) {
        const t = world.get(x, y);
        if (t === T.WATER || t === T.MOUNTAIN || t === T.MARSH) bad++;
      }
    if (bad > 60) continue;
    const v = buildVillage(world, r, cx, cy, names[world.villages.length]);
    if (v) world.villages.push(v);
  }

  // Дороги: каждая деревня соединяется с ближайшей из уже соединённых.
  const roadCost = (x, y) => {
    const t = world.get(x, y);
    if (world.building[world.idx(x, y)] >= 0 || t === T.WELL) return Infinity;
    if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) return Infinity;
    switch (t) {
      case T.ROAD: case T.BRIDGE: return 0.4;
      case T.WATER: return 6;
      case T.MOUNTAIN: return 12;
      case T.MARSH: return 3;
      case T.FOREST: case T.PINE: return 2;
      case T.HILL: return 2.5;
      default: return 1;
    }
  };
  const vs = world.villages;
  for (let i = 1; i < vs.length; i++) {
    let best = 0, bd = Infinity;
    for (let j = 0; j < i; j++) {
      const d = Math.hypot(vs[i].cx - vs[j].cx, vs[i].cy - vs[j].cy);
      if (d < bd) { bd = d; best = j; }
    }
    paveRoad(world, vs[i], vs[best], roadCost);
  }
  // Пара дополнительных дорог, чтобы появились перекрёстки.
  if (vs.length >= 4) {
    paveRoad(world, vs[vs.length - 1], vs[1], roadCost);
    paveRoad(world, vs[2], vs[0], roadCost);
  }

  return world;
}

function paveRoad(world, a, b, cost) {
  const path = findPath(world, a.cx, a.cy + 2, b.cx, b.cy + 2, cost);
  if (!path) return;
  for (const [x, y] of path) {
    const t = world.get(x, y);
    if (t === T.WATER) world.set(x, y, T.BRIDGE);
    else if (t === T.WELL || t === T.DIRT || t === T.FLOOR || t === T.DOOR) continue;
    else if (t !== T.BRIDGE) world.set(x, y, T.ROAD);
  }
}

function buildVillage(world, r, cx, cy, name) {
  const x0 = cx - (VILLAGE_W >> 1), y0 = cy - (VILLAGE_H >> 1);
  const vid = world.villages.length;

  for (let attempt = 0; attempt < 12; attempt++) {
    const placed = [];
    const occupied = (bx, by, bw, bh) => {
      // Площадь у колодца должна оставаться свободной.
      if (bx - 1 <= cx + 2 && bx + bw + 1 >= cx - 2 && by - 1 <= cy + 2 && by + bh + 1 >= cy - 2) return true;
      return placed.some(p => bx - 1 <= p.x + p.w && bx + bw + 1 >= p.x && by - 1 <= p.y + p.h && by + bh + 1 >= p.y);
    };
    let ok = true;
    for (const plan of BUILDING_PLAN) {
      let done = false;
      for (let t = 0; t < 150 && !done; t++) {
        const bx = r.int(x0 + 1, x0 + VILLAGE_W - plan.w - 1);
        const by = r.int(y0 + 1, y0 + VILLAGE_H - plan.h - 1);
        if (occupied(bx, by, plan.w, plan.h)) continue;
        placed.push({ ...plan, x: bx, y: by });
        done = true;
      }
      if (!done && !plan.optional) { ok = false; break; }
    }
    if (!ok) continue;

    // Расчистить место.
    for (let y = y0; y < y0 + VILLAGE_H; y++)
      for (let x = x0; x < x0 + VILLAGE_W; x++) {
        const t = world.get(x, y);
        world.set(x, y, (t === T.TALLGRASS && r.chance(0.5)) ? T.TALLGRASS : T.GRASS);
        if (r.chance(0.03)) world.set(x, y, T.TALLGRASS);
        world.zone[world.idx(x, y)] = vid;
      }
    // Площадь и колодец.
    for (let y = cy - 2; y <= cy + 2; y++)
      for (let x = cx - 3; x <= cx + 3; x++) world.set(x, y, T.DIRT);
    world.set(cx, cy, T.WELL);

    const village = { id: vid, name, cx, cy, x0, y0, w: VILLAGE_W, h: VILLAGE_H, buildings: [], npcs: [] };
    for (const p of placed) village.buildings.push(placeBuilding(world, r, p, village));

    // Нивы вокруг деревни.
    for (let k = 0; k < 4; k++) {
      const fw = r.int(5, 9), fh = r.int(3, 5);
      const side = r.int(0, 3);
      let fx, fy;
      if (side === 0) { fx = r.int(x0, x0 + VILLAGE_W - fw); fy = y0 - fh - 1; }
      else if (side === 1) { fx = r.int(x0, x0 + VILLAGE_W - fw); fy = y0 + VILLAGE_H + 1; }
      else if (side === 2) { fx = x0 - fw - 1; fy = r.int(y0, y0 + VILLAGE_H - fh); }
      else { fx = x0 + VILLAGE_W + 1; fy = r.int(y0, y0 + VILLAGE_H - fh); }
      for (let y = fy; y < fy + fh; y++)
        for (let x = fx; x < fx + fw; x++) {
          const t = world.get(x, y);
          if (t === T.GRASS || t === T.TALLGRASS || t === T.FOREST) world.set(x, y, T.FIELD);
        }
    }
    return village;
  }
  return null;
}

function placeBuilding(world, r, p, village) {
  const bid = world.buildings.length;
  const b = { id: bid, type: p.type, name: p.name, role: p.role, x: p.x, y: p.y, w: p.w, h: p.h, village };
  world.buildings.push(b);
  for (let y = p.y; y < p.y + p.h; y++)
    for (let x = p.x; x < p.x + p.w; x++) {
      const edge = x === p.x || y === p.y || x === p.x + p.w - 1 || y === p.y + p.h - 1;
      world.set(x, y, edge ? T.WALL : T.FLOOR);
      world.building[world.idx(x, y)] = bid;
    }
  // Дверь — на стене, обращённой к колодцу.
  const bcx = p.x + (p.w >> 1), bcy = p.y + (p.h >> 1);
  const dx = village.cx - bcx, dy = village.cy - bcy;
  let door;
  if (Math.abs(dx) * 0.6 > Math.abs(dy)) door = [dx > 0 ? p.x + p.w - 1 : p.x, bcy];
  else door = [bcx, dy > 0 ? p.y + p.h - 1 : p.y];
  world.set(door[0], door[1], T.DOOR);
  b.door = door;

  // Обстановка — у стены напротив двери.
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
      // Алтарь — точно напротив двери, посередине дальней стены.
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
