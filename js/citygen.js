'use strict';

// ─── Генерация городов ─────────────────────────────────────────────

const SIDE = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };

// Разрезать прямоугольник на кварталы; линии разреза — переулки.
function bsp(r, x0, y0, x1, y1, min, max, leaves, splits) {
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const canH = h >= 2 * min + 1, canV = w >= 2 * min + 1;
  if ((!canH && !canV) || (w <= max && h <= max && r.chance(0.35))) { leaves.push([x0, y0, x1, y1]); return; }
  const horiz = canH && (!canV || h * 2 > w ? true : r.chance(0.3));
  if (horiz) {
    const s = r.int(y0 + min, y1 - min);
    splits.push({ axis: 'h', pos: s, a: x0, b: x1 });
    bsp(r, x0, y0, x1, s - 1, min, max, leaves, splits);
    bsp(r, x0, s + 1, x1, y1, min, max, leaves, splits);
  } else {
    const s = r.int(x0 + min, x1 - min);
    splits.push({ axis: 'v', pos: s, a: y0, b: y1 });
    bsp(r, x0, y0, s - 1, y1, min, max, leaves, splits);
    bsp(r, s + 1, y0, x1, y1, min, max, leaves, splits);
  }
}

// Повернуть чертёж на 90° по часовой стрелке k раз.
function rotateStamp(rows, k) {
  for (let i = 0; i < k; i++) {
    const h = rows.length, w = rows[0].length, out = [];
    for (let x = 0; x < w; x++) {
      let line = '';
      for (let y = h - 1; y >= 0; y--) line += rows[y][x] || ' ';
      out.push(line);
    }
    rows = out;
  }
  return rows;
}

class CityBuilder {
  constructor(ow, city) {
    this.city = city;
    this.plan = cityPlan(city);
    const P = this.plan;
    const ctx = localContext(ow, city.x, city.y);
    this.ctx = ctx;
    this.r = new RNG(ctx.seed);
    const world = this.world = new World(P.w, P.h);
    world.region = ctx.region;
    world.kind = 'city';
    world.city = city;
    this.cx = Math.round((P.center ? P.center[0] : 0.5) * P.w);
    this.cy = Math.round((P.center ? P.center[1] : 0.5) * P.h);
    this.landmarks = [];
  }

  // Точка в долях полуосей → клетка.
  at([fx, fy]) {
    return [Math.round(this.cx + fx * this.plan.rx), Math.round(this.cy + fy * this.plan.ry)];
  }

  inShape(x, y) {
    const P = this.plan, dx = (x - this.cx) / P.rx, dy = (y - this.cy) / P.ry;
    return P.shape === 'rect' ? Math.abs(dx) <= 1 && Math.abs(dy) <= 1 : dx * dx + dy * dy <= 1;
  }

  inCity(x, y) {
    const t = this.world.get(x, y);
    if (!this.world.inside(x, y) || !this.inShape(x, y)) return false;
    return this.plan.lagoon || (t !== T.SEA && t !== T.SAND);
  }

  build() {
    const P = this.plan, w = this.world, r = this.r;
    const biome = this.ctx.biome === 'mount' || this.ctx.biome === 'volcano' ? 'hill' : this.ctx.biome;
    fillBiome(w, r, biome);
    this.farmland();
    if (P.lagoon) w.tiles.fill(T.SEA);
    else this.sea();
    if (P.river) this.river();
    this.ground();
    this.quarters();
    if (P.grandCanal) this.grandCanal();
    if (P.lawn) this.lawn();
    this.piazza();
    for (const lm of P.landmarks || []) this.placeLandmark(lm);
    this.services();
    if (P.walls) this.walls();
    if (P.harbor || P.lagoon) this.harbor();
    this.mainStreets();
    this.connect();
    this.finish();
    return w;
  }

  // Поля и виноградники вокруг города.
  farmland() {
    const w = this.world, P = this.plan;
    for (let y = 0; y < w.h; y++)
      for (let x = 0; x < w.w; x++) {
        const dx = (x - this.cx) / (P.rx + 14), dy = (y - this.cy) / (P.ry + 7);
        if (dx * dx + dy * dy < 1 && hash2(x >> 3, y >> 2) < 0.6) {
          const t = w.get(x, y);
          if (t === T.GRASS || t === T.TALLGRASS || t === T.FOREST)
            w.set(x, y, hash2(x >> 3, y >> 2) < 0.2 ? T.VINEYARD : T.FIELD);
        }
      }
  }

  sea() {
    const P = this.plan, w = this.world, r = this.r;
    if (!P.sea) {
      for (const [dx, dy] of this.ctx.sea) addSeaSide(w, r, dx, dy);
      return;
    }
    // Берег сразу за краем города.
    const [dx, dy] = SIDE[P.sea];
    const coast = dx > 0 ? this.cx + P.rx + 2 : dx < 0 ? this.cx - P.rx - 2 : dy > 0 ? this.cy + P.ry + 2 : this.cy - P.ry - 2;
    const n = makeValueNoise(Math.max(w.w, w.h), 4, 6, r);
    for (let y = 0; y < w.h; y++)
      for (let x = 0; x < w.w; x++) {
        const along = dx ? y : x, pos = dx ? x : y;
        const c = coast + Math.round((n(along, 1) - 0.5) * 4);
        const beyond = dx > 0 || dy > 0 ? pos - c : c - pos;
        if (beyond > 1) w.set(x, y, T.SEA);
        else if (beyond > -1) w.set(x, y, T.SAND);
      }
  }

  river() {
    const P = this.plan, R = P.river, w = this.world;
    this.riverAt = [];
    const len = R.axis === 'h' ? w.w : w.h;
    for (let i = 0; i < len; i++) {
      const base = R.axis === 'h' ? this.cy + R.at * P.ry : this.cx + R.at * P.rx;
      const amp = R.wiggle * (R.axis === 'h' ? P.ry : P.rx);
      const c = Math.round(base + Math.sin(i / len * Math.PI * 2.2) * amp);
      this.riverAt[i] = c;
      for (let k = 0; k < R.width; k++) {
        const [x, y] = R.axis === 'h' ? [i, c + k] : [c + k, i];
        if (w.get(x, y) !== T.SEA) w.set(x, y, T.WATER);
      }
    }
  }

  ground() {
    const w = this.world;
    for (let y = 0; y < w.h; y++)
      for (let x = 0; x < w.w; x++)
        if (this.inCity(x, y) && w.get(x, y) !== T.WATER && (w.get(x, y) !== T.SEA || this.plan.lagoon)) w.set(x, y, T.COBBLE);
  }

  // Насколько густо застроен квартал в этой точке.
  density(x, y) {
    const P = this.plan;
    if (!P.hot) return P.density;
    const [hx, hy, hr] = P.hot;
    const d = Math.hypot((x - this.cx) / P.rx - hx, (y - this.cy) / P.ry - hy);
    return d < hr ? 0.9 : P.density;
  }

  quarters() {
    const P = this.plan, w = this.world, r = this.r;
    const leaves = [], splits = [];
    bsp(r, this.cx - P.rx, this.cy - P.ry, this.cx + P.rx, this.cy + P.ry, P.block[0], P.block[1], leaves, splits);
    for (const [x0, y0, x1, y1] of leaves) {
      const mx = (x0 + x1) >> 1, my = (y0 + y1) >> 1;
      let kind;
      if (r.chance(this.density(mx, my))) kind = 'houses';
      else if (P.ruins && r.chance(P.ruins)) kind = 'ruins';
      else if (P.vineyards && r.chance(P.vineyards)) kind = 'vineyard';
      else kind = 'garden';
      // Маленькая площадь с колодцем посреди густой застройки.
      if (kind === 'houses' && x1 - x0 >= 3 && y1 - y0 >= 2 && r.chance(0.07)) {
        w.set(mx, my, T.WELL);
        continue;
      }
      const long = x1 - x0 >= y1 - y0, seg = r.int(3, 5), yard = x1 - x0 >= 5 && y1 - y0 >= 3 && r.chance(0.45);
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          if (!this.inCity(x, y) || w.get(x, y) !== T.COBBLE) continue;
          if (kind === 'houses') {
            const inner = x > x0 && x < x1 && y > y0 && y < y1;
            // Каждый дом — своим цветом черепицы.
            const k = Math.floor(((long ? x - x0 : y - y0)) / seg);
            w.set(x, y, yard && inner ? T.COURTYARD : (k + (long ? 0 : 1)) % 2 ? T.HOUSE2 : T.HOUSE);
            continue;
          }
          else if (kind === 'ruins') w.set(x, y, r.chance(0.06) ? T.COLUMN : r.chance(0.6) ? T.RUBBLE : T.GRASS);
          else if (kind === 'vineyard') w.set(x, y, T.VINEYARD);
          else w.set(x, y, r.chance(0.25) ? T.FOREST : T.GRASS);
        }
      // Двери домов, выходящие на улицу.
      if (kind === 'houses')
        for (let y = y0; y <= y1; y++)
          for (let x = x0; x <= x1; x++) {
            const t = w.get(x, y);
            if ((t !== T.HOUSE && t !== T.HOUSE2) || hash2(x * 3, y * 7) > 0.3) continue;
            if (DIRS4.some(([dx, dy]) => w.get(x + dx, y + dy) === T.COBBLE)) w.set(x, y, T.HOUSEDOOR);
          }
      // Башни знатных семей.
      if (kind === 'houses' && P.towers && x1 - x0 >= 2 && y1 - y0 >= 1 && r.chance(P.towers * 4)) {
        const tx = r.int(x0, x1), ty = r.int(y0, y1);
        if (w.get(tx, ty) === T.HOUSE || w.get(tx, ty) === T.HOUSE2) w.set(tx, ty, T.TOWER);
      }
    }
    // Каналы Венеции вместо части переулков.
    if (P.canals) {
      for (const s of splits) {
        if (!r.chance(P.canals)) continue;
        for (let i = s.a; i <= s.b; i++) {
          const [x, y] = s.axis === 'h' ? [i, s.pos] : [s.pos, i];
          if (!this.inCity(x, y) || w.get(x, y) !== T.COBBLE) continue;
          w.set(x, y, (i - s.a) % 7 === 3 ? T.BRIDGE : T.CANAL);
        }
      }
    }
  }

  grandCanal() {
    const P = this.plan, w = this.world;
    const bridges = new Set([this.cx - Math.round(P.rx * 0.5), this.cx, this.cx + Math.round(P.rx * 0.45)]);
    for (let x = 0; x < w.w; x++) {
      const y0 = Math.round(this.cy - P.ry * 0.15 + Math.sin((x - this.cx) / P.rx * Math.PI * 1.2) * P.ry * 0.45);
      for (let k = 0; k < 3; k++) {
        const y = y0 + k;
        if (!this.inCity(x, y) && w.get(x, y) === T.SEA) continue;
        if (bridges.has(x)) {
          w.set(x, y, T.BRIDGE);
          if (x === this.cx && k === 1) this.register({ name: 'Мост Риальто', x, y: y0, w: 1, h: 3, landmark: true,
            desc: 'Деревянный мост через Большой канал. Вокруг — рынок Риальто, самый богатый базар христианского мира.' });
        } else w.set(x, y, T.CANAL);
      }
      // Лотки рынка у моста Риальто.
      if (Math.abs(x - this.cx) <= 4 && x !== this.cx)
        for (const y of [y0 - 2, y0 + 4]) if (w.get(x, y) === T.COBBLE && (x + y) % 2) w.set(x, y, T.STALL);
    }
  }

  lawn() {
    const [fx, fy, fw, fh] = this.plan.lawn, w = this.world;
    const [x0, y0] = this.at([fx - fw, fy - fh]), [x1, y1] = this.at([fx + fw, fy + fh]);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        if (this.inCity(x, y) && w.get(x, y) !== T.WATER) w.set(x, y, T.GRASS);
  }

  piazza() {
    const P = this.plan, w = this.world, r = this.r;
    const pz = P.piazza || { w: 9, h: 5 };
    const [px, py] = this.at(pz.at || [0, 0]);
    this.px = px;
    this.py = py;
    const x0 = px - (pz.w >> 1), y0 = py - (pz.h >> 1);
    for (let y = y0 - 1; y <= y0 + pz.h; y++)
      for (let x = x0 - 1; x <= x0 + pz.w; x++)
        if (this.inCity(x, y) && w.get(x, y) !== T.WATER && w.get(x, y) !== T.CANAL) w.set(x, y, T.COBBLE);
    w.set(px, py, T.WELL);
    // Рыночные лотки по краям площади.
    let n = P.market || 0;
    for (let t = 0; t < 200 && n > 0; t++) {
      const x = r.int(x0, x0 + pz.w - 1), y = r.chance(0.5) ? y0 : y0 + pz.h - 1;
      if (w.get(x, y) === T.COBBLE && Math.abs(x - px) > 1) { w.set(x, y, T.STALL); n--; }
    }
    this.piazzaRect = [x0 - 1, y0 - 1, x0 + pz.w, y0 + pz.h];
  }

  register(b) {
    const w = this.world;
    b.id = w.buildings.length;
    w.buildings.push(b);
    return b;
  }

  // Поставить чертёж с центром в (x, y). margin — чем окружить.
  stampAt(rows, x, y, info, margin = this.pathTile || T.COBBLE) {
    const w = this.world, h = rows.length, wd = rows[0].length;
    const x0 = x - (wd >> 1), y0 = y - (h >> 1);
    const b = this.register({ ...info, x: x0, y: y0, w: wd, h });
    for (let j = -1; j <= h; j++)
      for (let i = -1; i <= wd; i++) {
        const X = x0 + i, Y = y0 + j;
        if (!w.inside(X, Y)) continue;
        const ch = j >= 0 && i >= 0 && j < h && i < wd ? rows[j][i] : ' ';
        if (ch === ' ') {
          if (info.island) { if (w.get(X, Y) === T.SEA) w.set(X, Y, T.SAND); }
          else if (w.building[w.idx(X, Y)] === -1 && w.get(X, Y) !== T.STONEWALL) w.set(X, Y, margin);
          continue;
        }
        w.set(X, Y, STAMP_TILES[ch]);
        w.building[w.idx(X, Y)] = b.id;
        if (ch === '+') b.door = [X, Y];
        if (info.ruin && (ch === '#') && this.r.chance(info.ruin)) w.set(X, Y, T.RUBBLE);
      }
    if (b.door) {
      const [dx, dy] = b.door;
      for (const [ox, oy] of DIRS4) {
        const t = w.get(dx + ox, dy + oy);
        if (w.building[w.idx(dx + ox, dy + oy)] === -1 && t !== T.SEA) {
          if (!TILES[t].walk) w.set(dx + ox, dy + oy, info.island ? T.SAND : T.COBBLE);
        }
      }
    }
    return b;
  }

  // Свободно ли место под постройку: внутри — суша города, вокруг — ничьи клетки.
  fits(x, y, wd, h, needCity = true) {
    const w = this.world, x0 = x - (wd >> 1), y0 = y - (h >> 1);
    const [px0, py0, px1, py1] = this.piazzaRect;
    for (let j = -2; j <= h + 1; j++)
      for (let i = -2; i <= wd + 1; i++) {
        const X = x0 + i, Y = y0 + j;
        if (!w.inside(X, Y)) return false;
        // Вокруг постройки — проход, и она не касается городской стены.
        if (needCity && !this.inShape(X, Y)) return false;
        if (j < -1 || i < -1 || j > h || i > wd) continue;
        if (w.building[w.idx(X, Y)] !== -1) return false;
        if (j < 0 || i < 0 || j >= h || i >= wd) continue;
        const t = w.get(X, Y);
        if (t === T.WATER || t === T.WELL || t === T.STALL || t === T.BRIDGE || t === T.STONEWALL) return false;
        if (needCity && !this.inCity(X, Y)) return false;
        if (needCity && X >= px0 && X <= px1 && Y >= py0 && Y <= py1) return false;
      }
    return true;
  }

  // Ближайшее к (x, y) подходящее место по спирали.
  findSpot(x, y, wd, h, needCity = true) {
    for (let rad = 0; rad < 40; rad++)
      for (let dy = -rad; dy <= rad; dy++)
        for (let dx = -rad * 2; dx <= rad * 2; dx += 1) {
          if (Math.max(Math.abs(dx) / 2, Math.abs(dy)) < rad - 0.5) continue;
          if (this.fits(x + dx, y + dy, wd, h, needCity)) return [x + dx, y + dy];
        }
    return null;
  }

  placeLandmark(lm) {
    const rows = STAMPS[lm.stamp];
    let [x, y] = this.at(lm.at);
    const info = { name: lm.name, desc: lm.desc, role: lm.role, landmark: true, ruin: lm.ruin, island: lm.island };
    if (lm.island) {
      // Островок в море, соединённый с берегом дамбой.
      this.stampAt(rows, x, y, info);
      const w = this.world;
      for (let yy = y - (rows.length >> 1) - 2; yy > 0; yy--) {
        if (w.get(x, yy) !== T.SEA) break;
        w.set(x, yy, T.PIER);
      }
      return;
    }
    const spot = lm.free ? [x, y] : this.findSpot(x, y, rows[0].length, rows.length);
    if (!spot) return;
    this.stampAt(rows, spot[0], spot[1], info, lm.lawn ? T.GRASS : T.COBBLE);
  }

  // Церковь, остерия, кузница, лавка травницы, палаццо — если их нет среди достопримечательностей.
  services() {
    const have = new Set(this.world.buildings.map(b => b.role).filter(Boolean));
    const needs = [
      ['priest', 'church', this.city.names === 'saracen' ? 'Мечеть' : 'Церковь'],
      ['elder', 'town_hall', 'Палаццо коммуны'],
      ['innkeeper', 'osteria', 'Остерия'],
      ['smith', 'smithy', 'Кузница'],
      ['herbalist', 'herbal', this.city.kind === 'city' ? 'Аптека' : 'Лавка травницы'],
    ];
    let k = 0;
    for (const [role, stamp, name] of needs) {
      if (have.has(role)) continue;
      // Вокруг площади, по кругу.
      const ang = k++ * 1.4 + this.r.next() * 0.5;
      const tx = this.px + Math.round(Math.cos(ang) * (this.plan.piazza ? this.plan.piazza.w / 2 + 6 : 10));
      const ty = this.py + Math.round(Math.sin(ang) * 5);
      // Дверью к площади.
      const dx = this.px - tx, dy = this.py - ty;
      const rot = Math.abs(dx) > Math.abs(dy) * 2 ? (dx > 0 ? 3 : 1) : (dy > 0 ? 0 : 2);
      const rows = rotateStamp(STAMPS[stamp], rot);
      const spot = this.findSpot(tx, ty, rows[0].length, rows.length);
      if (spot) this.stampAt(rows, spot[0], spot[1], { name, role });
    }
  }

  walls() {
    const P = this.plan, w = this.world;
    const ring = [];
    const seaNear = (x, y) => {
      for (let d = 1; d <= 4; d++)
        for (const [ox, oy] of DIRS4) if (w.get(x + ox * d, y + oy * d) === T.SEA || w.get(x + ox * d, y + oy * d) === T.SAND) return true;
      return false;
    };
    for (let y = 0; y < w.h; y++)
      for (let x = 0; x < w.w; x++) {
        if (!this.inShape(x, y) || w.get(x, y) === T.SEA || w.get(x, y) === T.SAND) continue;
        if (DIRS4.some(([ox, oy]) => !this.inShape(x + ox, y + oy))) {
          if (seaNear(x, y)) continue;   // со стороны моря — набережная
          ring.push([x, y]);
        }
      }
    const every = P.towerEvery || 9;
    for (const [x, y] of ring) {
      if (w.building[w.idx(x, y)] !== -1) continue;
      const t = w.get(x, y);
      const tower = (x * 31 + y * 17) % every === 0;
      if (t === T.WATER) continue;
      w.set(x, y, tower ? T.WALLTOWER : T.STONEWALL);
    }
    // Ров.
    if (P.moat)
      for (let y = 0; y < w.h; y++)
        for (let x = 0; x < w.w; x++) {
          if (this.inShape(x, y)) continue;
          const near = DIRS8.some(([ox, oy]) => this.inShape(x + ox, y + oy) || this.inShape(x + ox * 2, y + oy));
          if (near && w.get(x, y) !== T.SEA) w.set(x, y, T.WATER);
        }
    // Ворота — в стороны, куда уходят дороги (и хотя бы две).
    const dirs = this.ctx.roads.length ? this.ctx.roads.slice() : [];
    if (dirs.length < 2) dirs.push([-1, 0], [1, 0]);
    this.gates = [];
    for (const [dx, dy] of dirs) {
      const len = Math.hypot(dx * P.rx, dy * P.ry);
      let gx = this.cx, gy = this.cy;
      for (let s = 0; s < 400; s++) {
        const x = Math.round(this.cx + dx * P.rx * s / len), y = Math.round(this.cy + dy * P.ry * s / len);
        if (!w.inside(x, y)) break;
        if (!this.inShape(x, y)) break;
        gx = x; gy = y;
      }
      const t = w.get(gx, gy);
      if (t !== T.STONEWALL && t !== T.WALLTOWER) continue;
      // Проём в три клетки поперёк стены.
      const horizWall = Math.abs(dy) >= Math.abs(dx);
      for (let k = -1; k <= 1; k++) {
        const x = gx + (horizWall ? k : 0), y = gy + (horizWall ? 0 : k);
        if (w.get(x, y) === T.STONEWALL || w.get(x, y) === T.WALLTOWER) w.set(x, y, T.COBBLE);
      }
      this.gates.push([gx, gy, dx, dy]);
      // Дорога от ворот к краю карты.
      const [tx, ty] = roadTarget(w, dx, dy);
      paveLine(w, this.r, gx + Math.sign(dx), gy + Math.sign(dy), tx, ty, (x, y) => this.inShape(x, y));
    }
  }

  harbor() {
    const P = this.plan, w = this.world, r = this.r;
    const side = P.lagoon ? 's' : P.sea;
    if (!side) return;
    const [dx, dy] = SIDE[side];
    // Пристани: от края города в море.
    const span = dx ? P.ry : P.rx;
    let made = 0;
    for (let k = -span + 4; k <= span - 4; k += 9) {
      let x = dx ? this.cx : this.cx + k, y = dy ? this.cy : this.cy + k;
      // Дойти до воды.
      let steps = 0;
      while (w.inside(x, y) && w.get(x, y) !== T.SEA && steps < 80) { x += dx; y += dy; steps++; }
      if (!w.inside(x, y)) continue;
      // Набережная до самой воды.
      for (let bx = x - dx, by = y - dy, s = 0; s < 6 && w.inside(bx, by) && !this.inShape(bx, by); s++, bx -= dx, by -= dy)
        if (w.get(bx, by) !== T.SEA && w.building[w.idx(bx, by)] === -1) w.set(bx, by, T.COBBLE);
      const len = r.int(4, 7);
      for (let s = 0; s < len && w.inside(x, y) && w.get(x, y) === T.SEA; s++, x += dx, y += dy) {
        w.set(x, y, T.PIER);
        if (s === len - 2) {
          const sx = x + (dy ? 1 : 0), sy = y + (dx ? 1 : 0);
          if (w.get(sx, sy) === T.SEA) w.set(sx, sy, T.SHIP);
        }
      }
      made++;
    }
    this.harborMade = made;
  }

  // Убедиться, что до каждой двери и ворот можно дойти с площади.
  // Широкие улицы от ворот к главной площади.
  mainStreets() {
    this.streetCost = 1.5;
    for (const [gx, gy, dx, dy] of this.gates || []) {
      const path = findPath(this.world, gx - Math.sign(dx), gy - Math.sign(dy), this.px, this.py + 1, (x, y) => this.cost(x, y));
      if (path) this.paint(path, true);
    }
    this.streetCost = 0;
  }

  connect() {
    const w = this.world;
    const targets = w.buildings.filter(b => b.door).map(b => b.door);
    for (const [gx, gy] of this.gates || []) targets.push([gx, gy]);
    const start = [this.px, this.py + 1];
    for (const [tx, ty] of targets) {
      const reach = this.reachable(start[0], start[1]);
      if (reach[w.idx(tx, ty)]) continue;
      const path = findPath(w, start[0], start[1], tx, ty, (x, y) => this.cost(x, y));
      if (path) this.paint(path);
    }
    this.joinIslands();
  }

  // Соединить мостами и проулками оторванные кусочки города.
  joinIslands() {
    const w = this.world, start = [this.px, this.py + 1];
    for (let round = 0; round < 40; round++) {
      const reach = this.reachable(start[0], start[1]);
      let lost = null;
      for (let y = 0; y < w.h && !lost; y++)
        for (let x = 0; x < w.w && !lost; x++)
          if (this.inCity(x, y) && w.walkable(x, y) && !reach[w.idx(x, y)] && w.building[w.idx(x, y)] === -1) lost = [x, y];
      if (!lost) return;
      const path = findPath(w, lost[0], lost[1], start[0], start[1], (x, y) => this.cost(x, y));
      if (!path) { w.set(lost[0], lost[1], T.HOUSE); continue; }
      this.paint(path);
    }
  }

  cost(x, y) {
    const w = this.world, t = w.get(x, y);
    if (w.building[w.idx(x, y)] !== -1) return t === T.DOOR ? 1 : Infinity;
    if (t === T.STONEWALL || t === T.WALLTOWER || t === T.WELL) return Infinity;
    if (TILES[t].walk) return 1;
    if (t === T.HOUSE || t === T.HOUSE2 || t === T.HOUSEDOOR || t === T.COURTYARD || t === T.TOWER || t === T.STALL
      || t === T.FOREST || t === T.COLUMN || t === T.VINEYARD) return this.streetCost || 4;
    if (t === T.WATER || t === T.CANAL) return 9;
    if (t === T.SEA || t === T.SHIP) return Infinity;
    return 6;
  }

  paint(path, wide = false) {
    const w = this.world;
    if (wide) path = path.flatMap(([x, y]) => [[x, y], [x + 1, y], [x, y + 1]])
      .filter(([x, y]) => this.inCity(x, y) && w.get(x, y) !== T.STONEWALL && w.get(x, y) !== T.WALLTOWER && w.get(x, y) !== T.WELL);
    for (const [x, y] of path) {
      const t = w.get(x, y);
      if (w.building[w.idx(x, y)] !== -1) continue;
      if (t === T.WATER || t === T.CANAL) w.set(x, y, T.BRIDGE);
      else if (!TILES[t].walk || (wide && t !== T.BRIDGE && t !== T.PIER)) w.set(x, y, this.pathTile || T.COBBLE);
    }
  }

  reachable(sx, sy) {
    const w = this.world, seen = new Uint8Array(w.w * w.h), st = [[sx, sy]];
    seen[w.idx(sx, sy)] = 1;
    while (st.length) {
      const [x, y] = st.pop();
      for (const [dx, dy] of DIRS8) {
        const nx = x + dx, ny = y + dy;
        if (!w.inside(nx, ny) || seen[w.idx(nx, ny)] || !w.walkable(nx, ny)) continue;
        seen[w.idx(nx, ny)] = 1;
        st.push([nx, ny]);
      }
    }
    return seen;
  }

  finish() {
    const P = this.plan, w = this.world;
    // Мосты: реки внутри и снаружи города.
    if (P.river && P.river.bridges) {
      for (const br of P.river.bridges) {
        const R = P.river, len = R.axis === 'h' ? w.w : w.h;
        const i = Math.round(R.axis === 'h' ? this.cx + br.at * P.rx : this.cy + br.at * P.ry);
        if (i < 0 || i >= len) continue;
        const c = this.riverAt[i];
        for (let k = -1; k <= R.width; k++) {
          const [x, y] = R.axis === 'h' ? [i, c + k] : [c + k, i];
          const t = w.get(x, y);
          if (t === T.WATER) w.set(x, y, T.BRIDGE);
          else if (k === -1 || k === R.width) { if (w.building[w.idx(x, y)] === -1 && !TILES[t].walk) w.set(x, y, T.COBBLE); }
          if (br.shops) for (const s of [-1, 1]) {
            const [sx, sy] = R.axis === 'h' ? [x + s, y] : [x, y + s];
            if (w.get(sx, sy) === T.WATER && k >= 0 && k < R.width && (k % 2 === 0)) w.set(sx, sy, T.STALL);
          }
        }
        const [bx, by] = R.axis === 'h' ? [i, c] : [c, i];
        this.register({ name: br.name, x: bx, y: by, w: 1, h: 1, landmark: true,
          desc: br.shops ? 'Мост, застроенный лавками мясников и кожевников. Отходы бросают прямо в Арно.'
            : `Мост через реку ${R.name}.` });
      }
      this.connect();
    }
    // Зона города: сюда звери не заходят.
    for (let y = 0; y < w.h; y++)
      for (let x = 0; x < w.w; x++)
        if (this.inShape(x, y) && w.get(x, y) !== T.SEA) w.zone[w.idx(x, y)] = 0;
    w.villages.push({
      id: 0, name: this.city.name, city: this.city, plan: P,
      cx: this.px, cy: this.py, x0: this.cx - P.rx, y0: this.cy - P.ry, w: P.rx * 2 + 1, h: P.ry * 2 + 1,
      buildings: w.buildings.filter(b => b.role), npcs: [],
    });
  }
}

// Деревня, монастырь, замок или постоялый двор: несколько построек посреди полей.
class HamletBuilder extends CityBuilder {
  build() {
    const P = this.plan, w = this.world, r = this.r;
    this.pathTile = P.ground;
    const biome = ['mount', 'volcano', 'marsh'].includes(this.ctx.biome) ? 'hill' : this.ctx.biome;
    fillBiome(w, r, biome);
    if (this.city.kind !== 'castle') this.farmland();
    this.sea();
    // Расчистить место.
    for (let y = 0; y < w.h; y++)
      for (let x = 0; x < w.w; x++)
        if (this.inCity(x, y)) w.set(x, y, P.walls ? P.ground : r.chance(0.04) ? T.TALLGRASS : T.GRASS);
    this.piazza();
    this.buildings();
    if (P.walls) this.walls();
    else this.roads();
    this.connect();
    this.finish();
    return w;
  }

  piazza() {
    const w = this.world;
    this.px = this.cx;
    this.py = this.cy;
    const k = this.city.kind;
    for (let y = this.cy - 1; y <= this.cy + 1; y++)
      for (let x = this.cx - 3; x <= this.cx + 3; x++) w.set(x, y, this.pathTile);
    if (k === 'village' || k === 'inn') w.set(this.cx, this.cy, T.WELL);
    this.piazzaRect = [this.cx - 3, this.cy - 1, this.cx + 3, this.cy + 1];
  }

  buildings() {
    const P = this.plan, r = this.r, lm = this.city.landmark;
    const list = P.buildings.filter(([, , , chance]) => r.chance(chance));
    // Знаменитое место: главное здание заменяется достопримечательностью.
    if (lm) {
      const i = list.findIndex(([, , role]) => role === lm.role);
      if (i >= 0) list.splice(i, 1);
      const rows = STAMPS[lm.stamp];
      const spot = this.findSpot(this.cx, this.cy - (rows.length >> 1) - 3, rows[0].length, rows.length);
      if (spot) this.stampAt(rows, spot[0], spot[1], { name: lm.name, desc: lm.desc, role: lm.role, landmark: true }, this.pathTile);
    }
    // По спирали от площади: первые — ближе к центру.
    list.forEach(([stamp, name, role], k) => {
      const ang = k * 2.4 + r.next() * 0.6;
      const rad = 0.3 + 0.6 * Math.sqrt((k + 1) / list.length);
      const tx = this.cx + Math.round(Math.cos(ang) * rad * P.rx), ty = this.cy + Math.round(Math.sin(ang) * rad * P.ry);
      const dx = this.cx - tx, dy = this.cy - ty;
      const rot = Math.abs(dx) > Math.abs(dy) * 2 ? (dx > 0 ? 3 : 1) : (dy > 0 ? 0 : 2);
      const rows = rotateStamp(STAMPS[stamp], rot);
      const spot = this.findSpot(tx, ty, rows[0].length, rows.length);
      if (spot) {
        const b = this.stampAt(rows, spot[0], spot[1], { name: name || this.city.name, role }, this.pathTile);
        if (this.city.kind === 'village' && (role === 'peasant' || role === 'elder')) this.garden(b);
      }
    });
    // Плодовые деревья между дворами.
    const w = this.world;
    for (let y = 0; y < w.h; y++)
      for (let x = 0; x < w.w; x++)
        if (this.inCity(x, y) && w.get(x, y) === T.GRASS && w.building[w.idx(x, y)] === -1 && r.chance(0.025)) w.set(x, y, T.FOREST);
  }

  // Огород рядом с хижиной.
  garden(b) {
    const w = this.world, r = this.r, gw = r.int(4, 6), gh = r.int(2, 3);
    const spots = r.shuffle([[b.x + b.w + 1, b.y], [b.x - gw - 1, b.y], [b.x, b.y + b.h + 1], [b.x, b.y - gh - 1]]);
    for (const [x0, y0] of spots) {
      let ok = true;
      for (let y = y0; y < y0 + gh && ok; y++)
        for (let x = x0; x < x0 + gw && ok; x++)
          ok = this.inCity(x, y) && w.building[w.idx(x, y)] === -1 && (w.get(x, y) === T.GRASS || w.get(x, y) === T.TALLGRASS);
      if (!ok) continue;
      for (let y = y0; y < y0 + gh; y++) for (let x = x0; x < x0 + gw; x++) w.set(x, y, T.GARDEN);
      return;
    }
  }

  // Тропы к краям карты, куда уходят дороги (у деревни хотя бы одна).
  roads() {
    const dirs = this.ctx.roads.length ? this.ctx.roads : [this.r.pick(DIRS4)];
    for (const [dx, dy] of dirs) {
      const [tx, ty] = roadTarget(this.world, dx, dy);
      paveLine(this.world, this.r, this.cx, this.cy + 2, tx, ty, (x, y) => this.world.building[this.world.idx(x, y)] !== -1);
    }
  }
}

function makeCityLocal(ow, city) {
  const Builder = PLACE_PLANS[city.kind] ? HamletBuilder : CityBuilder;
  return new Builder(ow, city).build();
}
