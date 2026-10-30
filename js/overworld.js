'use strict';

// ─── Карта Италии ──────────────────────────────────────────────────

const OT = {
  SEA: 0, LAKE: 1, PLAIN: 2, FIELD: 3, FOREST: 4, PINE: 5, HILL: 6, MOUNT: 7,
  PEAK: 8, MARSH: 9, RIVER: 10, VOLCANO: 11, BORDER: 12,
};

// cost — минут на переход, enc — шанс встречи за переход.
const OTILES = [];
OTILES[OT.SEA]     = { ch: ['≈', '~'], fg: ['#2a4f86', '#24467a'], bg: '#0a1424', name: 'Море', pass: 0 };
OTILES[OT.LAKE]    = { ch: ['≈'], fg: ['#3f78b8'], bg: '#0e1a2c', name: 'Озеро', pass: 0 };
OTILES[OT.PLAIN]   = { ch: ['.', ','], fg: ['#6a9448', '#5f8a42'], name: 'Равнина', pass: 1, cost: 90, enc: 0.04 };
OTILES[OT.FIELD]   = { ch: ['"'], fg: ['#c8a848', '#b8983c'], name: 'Пашни и виноградники', pass: 1, cost: 90, enc: 0.03 };
OTILES[OT.FOREST]  = { ch: ['♣'], fg: ['#4f8a3c', '#5c9a44'], name: 'Лес', pass: 1, cost: 150, enc: 0.09 };
OTILES[OT.PINE]    = { ch: ['♠'], fg: ['#2f6b3f', '#367546'], name: 'Хвойная чаща', pass: 1, cost: 180, enc: 0.1 };
OTILES[OT.HILL]    = { ch: ['∩', 'n'], fg: ['#9a9a6a', '#8a8a5c'], name: 'Холмы', pass: 1, cost: 180, enc: 0.06 };
OTILES[OT.MOUNT]   = { ch: ['▲'], fg: ['#a39d92', '#8e887e'], name: 'Горы', pass: 1, cost: 300, enc: 0.07 };
OTILES[OT.PEAK]    = { ch: ['▲'], fg: ['#e8e8f0'], name: 'Снежные пики', pass: 0 };
OTILES[OT.MARSH]   = { ch: ['"', ','], fg: ['#5a8a7a', '#4e7e6a'], bg: '#0c1612', name: 'Топи', pass: 1, cost: 240, enc: 0.1 };
OTILES[OT.RIVER]   = { ch: ['~'], fg: ['#4f88c8'], bg: '#0e1a2c', name: 'Река (брод)', pass: 1, cost: 180, enc: 0.05 };
OTILES[OT.VOLCANO] = { ch: ['▲'], fg: ['#d8583c'], name: 'Склоны вулкана', pass: 1, cost: 360, enc: 0.05 };
OTILES[OT.BORDER]  = { ch: ['▲'], fg: ['#5a5a66'], name: 'Чужие земли за перевалами', pass: 0 };

// Чем местность Италии становится на местной карте.
const OT_LOCAL = {
  [OT.PLAIN]: 'plain', [OT.FIELD]: 'field', [OT.FOREST]: 'forest', [OT.PINE]: 'pine',
  [OT.HILL]: 'hill', [OT.MOUNT]: 'mount', [OT.MARSH]: 'marsh', [OT.RIVER]: 'plain',
  [OT.VOLCANO]: 'volcano',
};

class Overworld {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.tiles = new Uint8Array(w * h);
    this.region = new Uint8Array(w * h);   // индекс в REGION_IDS
    this.road = new Int16Array(w * h).fill(-1);
    this.places = new Map();               // idx -> город или особое место
    this.cities = [];
    this.sites = [];
  }
  idx(x, y) { return y * this.w + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inside(x, y) ? this.tiles[this.idx(x, y)] : OT.SEA; }
  def(x, y) { return OTILES[this.get(x, y)]; }
  regionAt(x, y) { return REGION_IDS[this.region[this.idx(x, y)]]; }
  placeAt(x, y) { return this.places.get(this.idx(x, y)) || null; }
  roadAt(x, y) { const r = this.road[this.idx(x, y)]; return r >= 0 ? ROADS[r][0] : null; }
  passable(x, y) { return this.inside(x, y) && (OTILES[this.get(x, y)].pass === 1 || this.road[this.idx(x, y)] >= 0); }
  isWater(x, y) { const t = this.get(x, y); return t === OT.SEA || t === OT.LAKE; }

  // Время перехода в минутах.
  cost(x, y) {
    if (this.road[this.idx(x, y)] >= 0) return 60;
    return OTILES[this.get(x, y)].cost || 120;
  }
}

function pointInPoly(lon, lat, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Расстояние в км от точки до ломаной.
function distToPolyline(lon, lat, pts) {
  let best = Infinity;
  const px = lon * COS_LAT * KM_PER_DEG, py = lat * KM_PER_DEG;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0] * COS_LAT * KM_PER_DEG, ay = pts[i][1] * KM_PER_DEG;
    const bx = pts[i + 1][0] * COS_LAT * KM_PER_DEG, by = pts[i + 1][1] * KM_PER_DEG;
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy));
  }
  return best;
}

const smooth01 = t => Math.max(0, Math.min(1, t));

function generateItaly(r) {
  const W = OVER_W, H = OVER_H;
  const ow = new Overworld(W, H);
  const jitterA = makeValueNoise(W, H, 3, r), jitterB = makeValueNoise(W, H, 3, r);
  const relief = makeFbm(W, H, r, 10), moist = makeFbm(W, H, r, 8), detail = makeValueNoise(W, H, 2, r);
  const island = new Uint8Array(W * H);   // 1 — материк, 2.. — острова

  const polys = [['mainland', LAND.mainland], ['sicily', LAND.sicily], ['sardinia', LAND.sardinia], ['corsica', LAND.corsica]];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const [lon0, lat0] = xyToGeo(x + 0.5, y + 0.5);
      const lon = lon0 + (jitterA(x, y) - 0.5) * 0.1, lat = lat0 + (jitterB(x, y) - 0.5) * 0.08;
      let land = 0;
      polys.forEach(([, p], k) => { if (!land && pointInPoly(lon, lat, p)) land = k + 1; });
      island[i] = land;
      if (!land) {
        const border = (lon0 < 7.65 && lat0 > 43.75) || lat0 > 45.82 || (lon0 > 13.75 && lat0 > 45.5);
        ow.tiles[i] = border ? OT.BORDER : OT.SEA;
        continue;
      }

      // Высота: Альпы, хребты, вулканы.
      const alps = Math.max(
        lon0 > 7.3 ? smooth01((lat0 - 45.72) / 0.45) : 0,
        lat0 > 44.0 ? smooth01((7.65 - lon0) / 0.45) : 0,
      );
      let elev = alps;
      for (const rd of RIDGES) elev = Math.max(elev, smooth01(1 - distToPolyline(lon0, lat0, rd.pts) / rd.width) * 0.95);
      elev += (relief(x, y) - 0.5) * 0.45;

      // Регион.
      let region;
      if (land === 2) region = 'sicily';
      else if (land === 3) region = 'sardinia';
      else if (land === 4) region = 'corsica';
      else if (alps >= 0.45) region = 'alps';
      else {
        let bd = Infinity;
        for (const [id, alon, alat] of REGION_ANCHORS) {
          const d = geoKm(lon0, lat0, alon, alat);
          if (d < bd) { bd = d; region = id; }
        }
      }
      ow.region[i] = REGION_IDS.indexOf(region);

      const m = moist(x, y);
      let t;
      if (alps > 0.65 && elev > 0.85 && detail(x, y) > 0.45) t = OT.PEAK;
      else if (elev > 0.74) t = m > 0.55 ? OT.PINE : OT.MOUNT;
      else if (elev > 0.46) t = m > 0.62 ? (alps > 0.3 || elev > 0.62 ? OT.PINE : OT.FOREST) : m > 0.5 ? OT.FOREST : OT.HILL;
      else {
        const dry = region === 'apulia' || region === 'sicily' ? 0.12 : 0;
        if (m > 0.62 + dry) t = OT.FOREST;
        else if (m < 0.42 && detail(x, y) > 0.5) t = OT.FIELD;
        else t = OT.PLAIN;
      }
      for (const [mlon, mlat, rkm] of MARSHES)
        if (t !== OT.PEAK && geoKm(lon0, lat0, mlon, mlat) < rkm * (0.75 + detail(x, y) * 0.5)) t = OT.MARSH;
      for (const v of VOLCANOES)
        if (geoKm(lon0, lat0, v.lon, v.lat) < v.r) t = OT.VOLCANO;
      ow.tiles[i] = t;
    }
  }

  // Озёра.
  for (const [, lon, lat, rx, ry] of LAKES) {
    const [cx, cy] = geoToXY(lon, lat);
    const rxT = rx / GEO.kmX, ryT = ry / GEO.kmY;
    for (let y = Math.floor(cy - ryT - 1); y <= cy + ryT + 1; y++)
      for (let x = Math.floor(cx - rxT - 1); x <= cx + rxT + 1; x++) {
        if (!ow.inside(x, y)) continue;
        const dx = (x + 0.5 - cx) / Math.max(0.6, rxT), dy = (y + 0.5 - cy) / Math.max(0.6, ryT);
        if (dx * dx + dy * dy <= 1) ow.tiles[ow.idx(x, y)] = OT.LAKE;
      }
  }

  // Реки.
  for (const [, pts] of RIVERS) {
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, y0] = geoToXY(...pts[k]), [x1, y1] = geoToXY(...pts[k + 1]);
      const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2);
      for (let s = 0; s <= n; s++) {
        const x = Math.floor(x0 + (x1 - x0) * s / n), y = Math.floor(y0 + (y1 - y0) * s / n);
        const t = ow.get(x, y);
        if (t === OT.SEA || t === OT.LAKE || t === OT.BORDER) continue;
        ow.tiles[ow.idx(x, y)] = OT.RIVER;
        // Реки прорезают в горах долины.
        for (const [dx, dy] of DIRS8) {
          const nt = ow.get(x + dx, y + dy);
          if (nt === OT.PEAK || nt === OT.MOUNT) ow.tiles[ow.idx(x + dx, y + dy)] = OT.HILL;
        }
      }
    }
  }

  // Города и особые места.
  const placeOnLand = (lon, lat) => {
    let [x, y] = geoToXY(lon, lat).map(Math.floor);
    for (let rad = 0; rad < 6; rad++)
      for (let dy = -rad; dy <= rad; dy++)
        for (let dx = -rad; dx <= rad; dx++) {
          const t = ow.get(x + dx, y + dy);
          if (!ow.placeAt(x + dx, y + dy) && OTILES[t].pass && t !== OT.RIVER) return [x + dx, y + dy];
        }
    return [x, y];
  };
  for (const c of CITIES) {
    const [x, y] = placeOnLand(c.lon, c.lat);
    const city = { ...c, x, y, region: ow.regionAt(x, y), terrain: ow.get(x, y), type: 'city' };
    if (city.terrain === OT.MARSH || city.terrain === OT.VOLCANO) city.terrain = OT.PLAIN;
    ow.tiles[ow.idx(x, y)] = city.terrain;
    ow.cities.push(city);
    ow.places.set(ow.idx(x, y), city);
    city.tiles = [[x, y]];
    if (c.kind === 'city')
      for (const [dx, dy] of [[-1, 0], [1, 0], [-1, -1], [0, -1], [1, -1]]) {
        const t = ow.get(x + dx, y + dy);
        if (!OTILES[t].pass || t === OT.RIVER || ow.placeAt(x + dx, y + dy)) continue;
        ow.places.set(ow.idx(x + dx, y + dy), city);
        city.tiles.push([x + dx, y + dy]);
      }
    // Вокруг городов — пашни и виноградники.
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -5; dx <= 5; dx++) {
        const t = ow.get(x + dx, y + dy);
        if ((t === OT.PLAIN || t === OT.FOREST) && r.chance(0.55 - Math.hypot(dx / 2, dy) * 0.1))
          ow.tiles[ow.idx(x + dx, y + dy)] = OT.FIELD;
      }
  }
  for (const s of SITES) {
    const [x, y] = placeOnLand(s.lon, s.lat);
    const site = { ...s, x, y, region: ow.regionAt(x, y), terrain: ow.get(x, y), type: 'site' };
    ow.sites.push(site);
    ow.places.set(ow.idx(x, y), site);
  }

  // Дороги.
  const cost = (x, y) => {
    const t = ow.get(x, y);
    if (t === OT.SEA || t === OT.BORDER || t === OT.PEAK) return Infinity;
    if (ow.road[ow.idx(x, y)] >= 0) return 0.5;
    switch (t) {
      case OT.LAKE: return Infinity;
      case OT.MOUNT: return 6;
      case OT.HILL: return 2.5;
      case OT.FOREST: case OT.PINE: return 2;
      case OT.MARSH: return 4;
      case OT.RIVER: return 4;
      case OT.VOLCANO: return 8;
      default: return 1;
    }
  };
  ROADS.forEach(([, chain], ri) => {
    for (let k = 0; k < chain.length - 1; k++) {
      const a = CITY_BY_ID[chain[k]], b = CITY_BY_ID[chain[k + 1]];
      const ca = ow.cities.find(c => c.id === a.id), cb = ow.cities.find(c => c.id === b.id);
      const path = findPath(ow, ca.x, ca.y, cb.x, cb.y, cost);
      if (!path) continue;
      for (const [x, y] of path) if (ow.road[ow.idx(x, y)] < 0) ow.road[ow.idx(x, y)] = ri;
    }
  });

  placeHamlets(ow, r, placeOnLand);
  return ow;
}

// Деревни, монастыри, замки и постоялые дворы между городами.
function placeHamlets(ow, r, placeOnLand) {
  let n = 0;
  const add = (kind, x, y, extra = {}) => {
    const p = {
      id: `${kind}${n++}`, kind, x, y, type: 'city', tiles: [[x, y]],
      region: ow.regionAt(x, y), terrain: ow.get(x, y), name: placeName(kind, r), ...extra,
    };
    if (p.terrain === OT.RIVER || p.terrain === OT.MARSH || p.terrain === OT.VOLCANO) p.terrain = OT.PLAIN;
    if (p.region === 'sardinia') p.names = 'sard';
    ow.cities.push(p);
    ow.places.set(ow.idx(x, y), p);
    return p;
  };
  const clear = (x, y, d) => {
    for (let dy = -d; dy <= d; dy++)
      for (let dx = -d; dx <= d; dx++) if (ow.inside(x + dx, y + dy) && ow.placeAt(x + dx, y + dy)) return false;
    return true;
  };
  for (const f of FAMOUS_PLACES) {
    const [x, y] = placeOnLand(f.lon, f.lat);
    if (!ow.placeAt(x, y)) add(f.kind, x, y, { name: f.name, famous: true, landmark: f.landmark });
  }
  const want = { inn: 18, castle: 14, monastery: 6, village: 70 };
  const good = {
    village: [OT.PLAIN, OT.FIELD, OT.FOREST, OT.HILL],
    monastery: [OT.HILL, OT.FOREST, OT.MOUNT, OT.PLAIN],
    castle: [OT.HILL, OT.MOUNT, OT.PINE],
  };
  for (const [kind, count] of Object.entries(want)) {
    let made = 0;
    for (let t = 0; t < 6000 && made < count; t++) {
      const x = r.int(2, ow.w - 3), y = r.int(2, ow.h - 3), i = ow.idx(x, y);
      if (kind === 'inn' ? ow.road[i] < 0 : !good[kind].includes(ow.tiles[i])) continue;
      if (!clear(x, y, 3)) continue;
      add(kind, x, y, kind === 'village' ? { size: r.int(7, 15) } : {});
      made++;
    }
  }
}
