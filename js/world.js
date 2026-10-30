'use strict';

// ─── Типы клеток ───────────────────────────────────────────────────

const T = {
  GRASS: 0, TALLGRASS: 1, FOREST: 2, PINE: 3, WATER: 4, MARSH: 5, HILL: 6,
  MOUNTAIN: 7, ROAD: 8, BRIDGE: 9, WALL: 10, DOOR: 11, FLOOR: 12, ALTAR: 13,
  WELL: 14, FIELD: 15, ANVIL: 16, TABLE: 17, DIRT: 18, BED: 19, SHELF: 20,
  SEA: 21, SAND: 22, ROCK: 23, ASH: 24, LAVA: 25, FORD: 26, STONEWALL: 27, PIER: 28, WALNUT: 29,
};

// ch — символ (или массив вариантов), walk — проходимость, see — прозрачность.
const TILES = [];
TILES[T.GRASS]     = { ch: ['.', '.', '.', ','], fg: ['#5f8a42', '#6a9448', '#557c3c'], walk: 1, see: 1, name: 'Луг', hab: 'field' };
TILES[T.TALLGRASS] = { ch: ['"'], fg: ['#7a9a40', '#8aa64a'], walk: 1, see: 1, name: 'Высокая трава', hab: 'field' };
TILES[T.FOREST]    = { ch: ['♣'], fg: ['#4f8a3c', '#5c9a44', '#447a34'], walk: 1, see: 0, name: 'Лес', hab: 'forest' };
TILES[T.PINE]      = { ch: ['♠'], fg: ['#2f6b3f', '#28603a', '#367546'], walk: 1, see: 0, name: 'Хвойная чаща', hab: 'pine' };
TILES[T.WATER]     = { ch: ['≈', '~'], fg: ['#3f78b8', '#3a6eaa'], walk: 0, see: 1, name: 'Вода', bg: '#0e1a2c' };
TILES[T.MARSH]     = { ch: [',', '"', '.'], fg: ['#5a8a6a', '#4e7e70', '#6a9a58'], walk: 1, see: 1, name: 'Топь', hab: 'marsh', bg: '#0e1410' };
TILES[T.HILL]      = { ch: ['^', 'n'], fg: ['#8a8a6a', '#7a7a5c'], walk: 1, see: 1, name: 'Холмы', hab: 'hill' };
TILES[T.MOUNTAIN]  = { ch: ['▲'], fg: ['#a39d92', '#8e887e'], walk: 0, see: 0, name: 'Скалы' };
TILES[T.ROAD]      = { ch: ['·'], fg: ['#b08a58'], walk: 1, see: 1, name: 'Дорога', hab: 'road' };
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
TILES[T.SEA]       = { ch: ['≈', '~'], fg: ['#2f5f9c', '#2a5590'], walk: 0, see: 1, name: 'Море', bg: '#0a1424' };
TILES[T.SAND]      = { ch: ['.', ':'], fg: ['#c8b880', '#b8a870'], walk: 1, see: 1, name: 'Берег', hab: 'shore' };
TILES[T.ROCK]      = { ch: ['▲', '^'], fg: ['#a39d92', '#8e887e'], walk: 0, see: 0, name: 'Скалы' };
TILES[T.ASH]       = { ch: ['.', ',', ':'], fg: ['#6a5a58', '#5a4c4a'], walk: 1, see: 1, name: 'Вулканический пепел', hab: 'hill' };
TILES[T.LAVA]      = { ch: ['≈'], fg: ['#f07030', '#e05828'], walk: 0, see: 1, name: 'Лава', bg: '#2a0c04' };
TILES[T.FORD]      = { ch: ['~'], fg: ['#7fb0d8'], walk: 1, see: 1, name: 'Брод', bg: '#10202c' };
TILES[T.STONEWALL] = { ch: ['#'], fg: ['#b0a898'], walk: 0, see: 0, name: 'Городская стена', bg: '#26231e' };
TILES[T.PIER]      = { ch: ['='], fg: ['#a07848'], walk: 1, see: 1, name: 'Пристань', bg: '#0a1424' };
TILES[T.WALNUT]    = { ch: ['♣'], fg: ['#b080e0'], walk: 0, see: 0, name: 'Старый орех' };

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

