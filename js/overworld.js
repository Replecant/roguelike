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
OTILES[OT.PLAIN]   = { ch: ['.', ','], fg: ['#6f9a4a', '#628c44'], bg: '#131a0d', name: 'Равнина', pass: 1, cost: 90 / MAP_SCALE, enc: 0.04 / MAP_SCALE };
OTILES[OT.FIELD]   = { ch: ['"'], fg: ['#d0b050', '#c0a040'], bg: '#1e190b', name: 'Пашни и виноградники', pass: 1, cost: 90 / MAP_SCALE, enc: 0.03 / MAP_SCALE };
OTILES[OT.FOREST]  = { ch: ['♣'], fg: ['#5aa044', '#4c8c3a'], bg: '#0c1a0b', name: 'Лес', pass: 1, cost: 150 / MAP_SCALE, enc: 0.09 / MAP_SCALE };
OTILES[OT.PINE]    = { ch: ['♠'], fg: ['#3c8050', '#33704a'], bg: '#081410', name: 'Хвойная чаща', pass: 1, cost: 180 / MAP_SCALE, enc: 0.1 / MAP_SCALE };
OTILES[OT.HILL]    = { ch: ['∩', 'n'], fg: ['#b08c58', '#a07e4e'], bg: '#1c150c', name: 'Холмы', pass: 1, cost: 180 / MAP_SCALE, enc: 0.06 / MAP_SCALE };
OTILES[OT.MOUNT]   = { ch: ['▲'], fg: ['#b4b8c0', '#9ea2aa'], bg: '#17181c', name: 'Горы', pass: 1, cost: 300 / MAP_SCALE, enc: 0.07 / MAP_SCALE };
OTILES[OT.PEAK]    = { ch: ['▲'], fg: ['#f2f4fa'], bg: '#22242a', name: 'Снежные пики', pass: 0 };
OTILES[OT.MARSH]   = { ch: ['"', ','], fg: ['#5aa08a', '#4a8c78'], bg: '#0a1c18', name: 'Топи', pass: 1, cost: 240 / MAP_SCALE, enc: 0.1 / MAP_SCALE };
OTILES[OT.RIVER]   = { ch: ['~'], fg: ['#4f88c8'], bg: '#0e1a2c', name: 'Река (брод)', pass: 1, cost: 180 / MAP_SCALE, enc: 0.05 / MAP_SCALE };
OTILES[OT.VOLCANO] = { ch: ['▲'], fg: ['#e0603c'], bg: '#23110c', name: 'Склоны вулкана', pass: 1, cost: 360 / MAP_SCALE, enc: 0.05 / MAP_SCALE };
OTILES[OT.BORDER]  = { ch: ['▲'], fg: ['#5a5a66'], bg: '#101014', name: 'Чужие земли за перевалами', pass: 0 };

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
    this.track = new Uint8Array(w * h);    // проселки к деревням, замкам и монастырям
    this.places = new Map();               // idx -> город или особое место
    this.cities = [];
    this.sites = [];
    /** @type {string[] | undefined} */
    this.regionIds = undefined;   // порядок земель этой карты (индексы в region)
    /** @type {any} */
    this.geo = undefined;         // рамка этой карты: lon0, lon1, lat0, lat1
  }
  idx(x, y) { return y * this.w + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inside(x, y) ? this.tiles[this.idx(x, y)] : OT.SEA; }
  def(x, y) { return OTILES[this.get(x, y)]; }
  regionAt(x, y) { return (this.regionIds || REGION_IDS)[this.region[this.idx(x, y)]]; }
  placeAt(x, y) { return this.places.get(this.idx(x, y)) || null; }
  roadAt(x, y) { const r = this.road[this.idx(x, y)]; return r >= 0 ? ROADS[r][0] : null; }
  passable(x, y) { return this.inside(x, y) && (OTILES[this.get(x, y)].pass === 1 || this.road[this.idx(x, y)] >= 0); }
  isWater(x, y) { const t = this.get(x, y); return t === OT.SEA || t === OT.LAKE; }

  // Время перехода в минутах.
  cost(x, y) {
    const i = this.idx(x, y);
    if (this.road[i] >= 0) return 60 / MAP_SCALE;
    const c = OTILES[this.get(x, y)].cost || 120;
    return this.track && this.track[i] ? Math.min(c, 80 / MAP_SCALE) : c;
  }
  isTrack(x, y) { return !!(this.track && this.inside(x, y) && this.track[this.idx(x, y)] && this.road[this.idx(x, y)] < 0); }
}

// Рамка многоугольника и ломаной — один раз: клетку за тысячу вёрст от земли не сверяем с каждой её точкой.
// Это не меняет ни одной клетки, только избавляет большую карту от лишней работы.
const POLY_BOX = new WeakMap();
function polyBox(poly) {
  let b = POLY_BOX.get(poly);
  if (!b) {
    b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y] of poly) { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; }
    POLY_BOX.set(poly, b);
  }
  return b;
}

// Отрезки берега, разложенные по полосам широты: луч из точки пересекает лишь те, что проходят на её широте.
const BAND = 0.05;
const POLY_BANDS = new WeakMap();
function polyBands(poly) {
  let m = POLY_BANDS.get(poly);
  if (!m) {
    m = new Map();
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const lo = Math.floor(Math.min(poly[i][1], poly[j][1]) / BAND), hi = Math.floor(Math.max(poly[i][1], poly[j][1]) / BAND);
      for (let k = lo; k <= hi; k++) { if (!m.has(k)) m.set(k, []); m.get(k).push(i, j); }
    }
    POLY_BANDS.set(poly, m);
  }
  return m;
}

function pointInPoly(lon, lat, poly) {
  const bb = polyBox(poly);
  if (lon < bb[0] || lon > bb[2] || lat < bb[1] || lat > bb[3]) return false;
  const edges = polyBands(poly).get(Math.floor(lat / BAND));
  if (!edges) return false;
  let inside = false;
  for (let e = 0; e < edges.length; e += 2) {
    const [xi, yi] = poly[edges[e]], [xj, yj] = poly[edges[e + 1]];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Расстояние в км от точки до ломаной.
// maxKm — дальше этого расстояние не нужно (хребет шириной width): за рамкой сразу «бесконечно далеко».
function distToPolyline(lon, lat, pts, maxKm = Infinity) {
  let best = Infinity;
  const px = lon * COS_LAT * KM_PER_DEG, py = lat * KM_PER_DEG;
  if (maxKm < Infinity) {
    const bb = polyBox(pts);
    if (px < bb[0] * COS_LAT * KM_PER_DEG - maxKm || px > bb[2] * COS_LAT * KM_PER_DEG + maxKm
      || py < bb[1] * KM_PER_DEG - maxKm || py > bb[3] * KM_PER_DEG + maxKm) return Infinity;
  }
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
  INN_USED.s = new Set();   // вывески постоялых дворов — без повторов
  LOCAL_NAMES_USED.s = new Set();
  useGeo(WORLD_GEO);
  const [W, H] = overSize();
  const ow = new Overworld(W, H);
  // Карта помнит свою рамку и порядок земель — старые сохранения не съедут, когда карта вырастет.
  ow.geo = { lon0: GEO.lon0, lon1: GEO.lon1, lat0: GEO.lat0, lat1: GEO.lat1 };
  ow.regionIds = REGION_IDS.slice();
  const S = MAP_SCALE;
  const jitterA = makeValueNoise(W, H, 3 * S, r), jitterB = makeValueNoise(W, H, 3 * S, r);
  const relief = makeFbm(W, H, r, 10 * S), moist = makeFbm(W, H, r, 8 * S), detail = makeValueNoise(W, H, 2 * S, r);
  const island = new Uint8Array(W * H);   // 1 — материк, 2.. — острова

  const polys = [['mainland', LAND.mainland], ['sicily', LAND.sicily], ['sardinia', LAND.sardinia], ['corsica', LAND.corsica], ['malta', LAND.malta], ['gozo', LAND.gozo],
    ['helvetia', LAND.helvetia], ['carantania', LAND.carantania], ['occitania', LAND.occitania], ['lyonnais', LAND.lyonnais], ['savoy', LAND.savoy],
    ['tyrol', LAND.tyrol], ['dalmatia', LAND.dalmatia], ...LAND.dalmatiaIsles.map(p => ['dalmatia', p]),
    // Земли из реестра (defineLand): суша и острова — в том порядке, в каком их подключили.
    ...Object.entries(LAND_DEFS).flatMap(([id, d]) => [[id, /** @type {any} */ (LAND)[id]], ...(d.isles || []).map(p => [id, p])])];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const [lon0, lat0] = xyToGeo(x + 0.5, y + 0.5);
      const lon = lon0 + (jitterA(x, y) - 0.5) * 0.1, lat = lat0 + (jitterB(x, y) - 0.5) * 0.08;
      let land = 0;
      polys.forEach(([, p], k) => { if (!land && pointInPoly(lon, lat, p)) land = k + 1; });
      island[i] = land;
      if (!land) {
        if (FORCED_SEA.some(pl => pointInPoly(lon, lat, pl))) { ow.tiles[i] = OT.SEA; continue; }
        const border = (lon0 < 7.65 && lat0 > 43.75) || lat0 > 45.82 || (lon0 > 13.75 && lat0 > 45.5)
          || FOREIGN_SHORES.some(pl => pointInPoly(lon, lat, pl));
        ow.tiles[i] = border ? OT.BORDER : OT.SEA;
        continue;
      }

      // Высота: Альпы, хребты, вулканы. В Гельвеции горы — свои хребты (content/helvetia/), а меж ними долины.
      const land0 = polys[land - 1][0], helv = land0 === 'helvetia', carn = land0 === 'carantania', occ = land0 === 'occitania' || land0 === 'lyonnais' || land0 === 'savoy';
      const tyr = land0 === 'tyrol', dalm = land0 === 'dalmatia', reg = LAND_DEFS[land0];
      const own = occ || tyr || dalm || !!reg;   // свои хребты, без италийских Альп
      const alps = helv || carn || own ? 0 : Math.max(
        lon0 > 7.3 ? smooth01((lat0 - 45.72) / 0.45) : 0,
        lat0 > 44.0 ? smooth01((7.65 - lon0) / 0.45) : 0,
      );
      const halps = helv ? helvetiaAlps(lon0, lat0) : 0;
      let elev = Math.max(alps, halps * 0.92);
      for (const rd of RIDGES) elev = Math.max(elev, smooth01(1 - distToPolyline(lon0, lat0, rd.pts, rd.width) / rd.width) * 0.95);
      elev += (relief(x, y) - 0.5) * 0.45;
      if (carn) elev += 0.1;
      if (land0 === 'savoy') elev += 0.32;   // Савойя — горы и теснины, ровные лишь берега озёр и дно долин
      if (tyr) elev += 0.26;   // Тироль — горы, ровные лишь дно долин Инна, Эча и Айзака
      if (dalm) elev += 0.08;   // Далмация — голый карст: холмы и гряды над самым морем
      if (reg && reg.elev) elev += typeof reg.elev === 'function' ? reg.elev(lon0, lat0) : reg.elev;

      // Регион.
      let region;
      if (land === 2) region = 'sicily';
      else if (land === 3) region = 'sardinia';
      else if (land === 4) region = 'corsica';
      else if (land0 === 'malta' || land0 === 'gozo') region = 'malta';
      else if (helv) region = 'helvetia';
      else if (carn) region = 'carantania';
      else if (land0 === 'lyonnais') region = 'lyonnais';
      else if (land0 === 'savoy') region = 'savoy';
      else if (tyr) region = 'tyrol';
      else if (dalm) region = 'dalmatia';
      else if (reg) region = reg.split ? reg.split(lon0, lat0) : land0;
      else if (occ) region = occitaniaRegion(lon0, lat0);
      else if (alps >= 0.45) region = 'alps';
      else {
        let bd = Infinity;
        for (const [id, alon, alat] of REGION_ANCHORS) {
          const d = geoKm(lon0, lat0, alon, alat);
          if (d < bd) { bd = d; region = id; }
        }
      }
      ow.region[i] = ow.regionIds.indexOf(region);

      const m = moist(x, y);
      let t;
      if (alps > 0.65 && elev > 0.85 && detail(x, y) > 0.45) t = OT.PEAK;
      else if (helv && halps > 0.5 && elev > 0.88 && detail(x, y) > 0.5) t = OT.PEAK;
      else if ((carn || own) && elev > 0.9 && detail(x, y) > 0.55) t = OT.PEAK;
      else if (elev > 0.74) t = m > 0.55 ? OT.PINE : OT.MOUNT;
      else if (elev > 0.46) t = m > 0.62 ? (alps > 0.3 || halps > 0.3 || (carn && elev > 0.55) || elev > 0.62 ? OT.PINE : OT.FOREST) : m > 0.5 ? OT.FOREST : OT.HILL;
      else {
        const dry = ['apulia', 'sicily', 'malta', 'provence', 'languedoc', 'dalmatia'].includes(region) || (LAND_DEFS[region] && LAND_DEFS[region].dry) ? 0.12 : 0;
        if (region === 'malta') t = detail(x, y) > 0.58 ? OT.HILL : OT.PLAIN;   // голые известняковые гряды
        else if (m > 0.62 + dry - (carn ? 0.14 : 0)) t = OT.FOREST;   // в Карантании лес повсюду
        else t = OT.PLAIN;   // пашни — потом, вокруг жилья (cultivate)
      }
      for (const [mlon, mlat, rkm] of MARSHES)   // топь — не дальше 1.25 своего радиуса: дальних не считаем
        if (t !== OT.PEAK && Math.abs(lat0 - mlat) * 111 < rkm * 1.25 && geoKm(lon0, lat0, mlon, mlat) < rkm * (0.75 + detail(x, y) * 0.5)) t = OT.MARSH;
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

  // Острова не срастаются: где суша Гоцо касается Мальты (дрожь берега), остаётся пролив Комино.
  const gozo = polys.findIndex(([n]) => n === 'gozo') + 1, malta = polys.findIndex(([n]) => n === 'malta') + 1;
  for (let i = 0; i < W * H; i++) {
    if (island[i] !== gozo) continue;
    const x = i % W, y = (i / W) | 0;
    if (DIRS8.some(([dx, dy]) => x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < H && island[(y + dy) * W + x + dx] === malta)) {
      island[i] = 0; ow.tiles[i] = OT.SEA;
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
    for (let rad = 0; rad < 6 * MAP_SCALE; rad++)
      for (let dy = -rad; dy <= rad; dy++)
        for (let dx = -rad; dx <= rad; dx++) {
          const t = ow.get(x + dx, y + dy);
          if (!ow.placeAt(x + dx, y + dy) && OTILES[t].pass && t !== OT.RIVER) return [x + dx, y + dy];
        }
    return [x, y];
  };
  for (const c of CITIES) {
    const [x, y] = placeOnLand(c.lon, c.lat);
    /** @type {any} */
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
  dropUnreachable(ow);   // сёла на безлюдных островах — прочь, пока вокруг них не распахали поля
  cultivate(ow, r);
  placeTombs(ow, r, placeOnLand);
  dropUnreachable(ow);
  layTracks(ow);
  return ow;
}

// Пашни и виноградники — там, где живут люди: пятнами вокруг городов, деревень,
// замков и монастырей, гуще у самых стен, реже к краю. Лес у жилья
// частью сведён под поле, на холмах — террасы. Пятна неровные (крупная «рябь»),
// чтобы поля не были ни кругами, ни полосами.
function cultivate(ow, r) {
  const S = MAP_SCALE, salt = r.int(0, 1e6);
  // Постоялые дворы стоят у дорог среди чистого поля — своей пашни у них нет.
  const RAD = { city: 6, town: 4, village: 2.4, castle: 1.8, monastery: 2 };
  // Неровность: шум на грубой сетке, сглаженный по соседям.
  const coarse = (x, y) => hash2(Math.floor(x / 3) + salt, Math.floor(y / 2) - salt);
  const lumpy = (x, y) => (coarse(x, y) * 2 + coarse(x + 2, y) + coarse(x, y + 1) + hash2(x + salt, y)) / 5;
  const best = new Float32Array(ow.w * ow.h);   // сколько «тянет» клетку к пашне
  for (const c of ow.cities) {
    const R = (RAD[c.kind] || 0) * S;
    if (!R) continue;
    for (let dy = -Math.ceil(R / 2); dy <= Math.ceil(R / 2); dy++)
      for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx++) {
        const x = c.x + dx, y = c.y + dy;
        if (!ow.inside(x, y)) continue;
        const d = Math.hypot(dx, dy * 2) / R;   // клетка по вертикали — вдвое длиннее
        if (d >= 1) continue;
        const i = ow.idx(x, y);
        best[i] = Math.max(best[i], 1 - d);
      }
  }
  const was = new Map();   // клетка → чем была до пашни
  for (let i = 0; i < best.length; i++) {
    if (!best[i]) continue;
    const t = ow.tiles[i], x = i % ow.w, y = (i / ow.w) | 0;
    if (ow.places.has(i)) continue;
    const k = t === OT.PLAIN ? 1 : t === OT.FOREST ? 0.55 : t === OT.HILL ? 0.35 : 0;
    // Мальта: земли мало, воды ещё меньше — поля лишь клочками у жилья, кругом пустошь.
    const dryIsle = ow.regionAt(x, y) === 'malta' ? 0.62 : 1;
    if (!k) continue;
    // Чем ближе к жилью, тем вероятнее поле; рябь рвёт края пятнами.
    if (best[i] * 1.3 * k * dryIsle - lumpy(x, y) * 0.7 > 0.2) { was.set(i, t); ow.tiles[i] = OT.FIELD; }
  }
  // Рябь оставляет на отшибе клочки пашни в клетку-две — их возвращаем лугу, лесу или холмам.
  const seen = new Uint8Array(ow.w * ow.h);
  for (const i of was.keys()) {
    if (seen[i] || ow.tiles[i] !== OT.FIELD) continue;
    const st = [i], cells = [];
    seen[i] = 1;
    while (st.length) {
      const j = st.pop(), x = j % ow.w, y = (j / ow.w) | 0;
      cells.push(j);
      for (const [dx, dy] of DIRS8) {
        if (!ow.inside(x + dx, y + dy)) continue;
        const k = ow.idx(x + dx, y + dy);
        if (!seen[k] && ow.tiles[k] === OT.FIELD) { seen[k] = 1; st.push(k); }
      }
    }
    if (cells.length <= 2) for (const j of cells) if (was.has(j)) ow.tiles[j] = was.get(j);
  }
}

// Проселки: от деревни, замка, монастыря в стороне — к ближайшему тракту или проселку.
// Без случайных чисел: старым сохранениям их можно проложить заново (js/save.js).
class TrackHeap {
  constructor() { this.a = []; this.seq = 0; }
  get size() { return this.a.length; }
  less(p, q) { return p[0] < q[0] || (p[0] === q[0] && p[3] < q[3]); }
  push(d, x, y) {
    const a = this.a; a.push([d, x, y, this.seq++]);
    for (let k = a.length - 1; k > 0;) { const p = (k - 1) >> 1; if (!this.less(a[k], a[p])) break; [a[p], a[k]] = [a[k], a[p]]; k = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      for (let k = 0; ;) {
        const l = 2 * k + 1, r = l + 1; let m = k;
        if (l < a.length && this.less(a[l], a[m])) m = l;
        if (r < a.length && this.less(a[r], a[m])) m = r;
        if (m === k) break;
        [a[m], a[k]] = [a[k], a[m]]; k = m;
      }
    }
    return top;
  }
}

function layTracks(ow) {
  ow.track = ow.track || new Uint8Array(ow.w * ow.h);
  const W = ow.w, stepCost = (x, y) => {
    const t = ow.get(x, y);
    if (t === OT.SEA || t === OT.LAKE || t === OT.BORDER || t === OT.PEAK) return Infinity;
    return { [OT.MOUNT]: 5, [OT.HILL]: 2.2, [OT.FOREST]: 1.8, [OT.PINE]: 2, [OT.MARSH]: 4, [OT.RIVER]: 3, [OT.VOLCANO]: 8 }[t] || 1;
  };
  const near = (x, y) => DIRS8.some(([dx, dy]) => ow.inside(x + dx, y + dy) && (ow.road[ow.idx(x + dx, y + dy)] >= 0 || ow.track[ow.idx(x + dx, y + dy)]))
    || ow.road[ow.idx(x, y)] >= 0;
  const hamlets = ow.cities.filter(c => ['village', 'castle', 'monastery'].includes(c.kind) && !near(c.x, c.y));
  for (const c of hamlets) {
    // Дейкстра до ближайшей дороги или проселка — не дальше 30 клеток.
    // Очередь — куча по (расстоянию, порядку добавления): тот же порядок, что у сортировки, но без пересортировки на каждом шаге.
    const dist = new Map([[ow.idx(c.x, c.y), 0]]), prev = new Map(), open = new TrackHeap();
    open.push(0, c.x, c.y);
    let goal = -1;
    while (open.size) {
      const [d, x, y] = open.pop(), i = ow.idx(x, y);
      if (d > dist.get(i)) continue;
      // Цель — дорога, проселок или сам городок (на острове без дорог — тропа к его воротам).
      const town = ow.places.get(i);
      if ((ow.road[i] >= 0 || ow.track[i] || (town && (town.kind === 'town' || town.kind === 'city'))) && i !== ow.idx(c.x, c.y)) { goal = i; break; }
      if (Math.max(Math.abs(x - c.x), Math.abs(y - c.y)) > 30) continue;
      for (const [dx, dy] of DIRS8) {
        const nx = x + dx, ny = y + dy;
        if (!ow.inside(nx, ny)) continue;
        const j = ow.idx(nx, ny), nd = d + stepCost(nx, ny) * (dx && dy ? 1.4 : 1);
        if (nd < (dist.has(j) ? dist.get(j) : Infinity)) { dist.set(j, nd); prev.set(j, i); open.push(nd, nx, ny); }
      }
    }
    if (goal < 0) continue;
    for (let i = prev.get(goal); i !== undefined && i !== ow.idx(c.x, c.y); i = prev.get(i)) if (ow.road[i] < 0 && !ow.places.has(i)) ow.track[i] = 1;
  }
}

// Убрать поселения и подземелья, до которых не дойти ни из одного города.
function dropUnreachable(ow) {
  const seen = new Uint8Array(ow.w * ow.h), st = [];
  for (const c of ow.cities) if (c.kind === 'city' || c.kind === 'town') { seen[ow.idx(c.x, c.y)] = 1; st.push([c.x, c.y]); }
  while (st.length) {
    const [x, y] = st.pop();
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx, ny = y + dy;
      if (!ow.passable(nx, ny) || seen[ow.idx(nx, ny)]) continue;
      seen[ow.idx(nx, ny)] = 1;
      st.push([nx, ny]);
    }
  }
  const lost = p => !seen[ow.idx(p.x, p.y)];
  for (const p of [...ow.cities, ...ow.sites].filter(lost)) {
    for (const [x, y] of p.tiles || [[p.x, p.y]]) ow.places.delete(ow.idx(x, y));
  }
  ow.cities = ow.cities.filter(p => !lost(p));
  ow.sites = ow.sites.filter(p => !lost(p));
}

// Деревни, монастыри, замки и постоялые дворы между городами.
function placeHamlets(ow, r, placeOnLand) {
  let n = 0;
  const add = (kind, x, y, extra = {}) => {
    /** @type {any} */
    const p = {
      id: `${kind}${n++}`, kind, x, y, type: 'city', tiles: [[x, y]],
      region: ow.regionAt(x, y), terrain: ow.get(x, y), name: placeName(kind, r), ...extra,
    };
    if (p.terrain === OT.RIVER || p.terrain === OT.MARSH || p.terrain === OT.VOLCANO) p.terrain = OT.PLAIN;
    if (p.region === 'sardinia') p.names = 'sard';
    const local = LOCAL_HAMLETS[p.region];   // земли за пределами Италии: своя речь и свои названия
    if (local && !p.names) p.names = local.speech(x, y, kind);
    if (local && !extra.name) p.name = localPlaceName(p.region, kind, r, p.names) || p.name;
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
    if (!ow.placeAt(x, y)) add(f.kind, x, y, { name: f.name, famous: true, landmark: f.landmark, lord: f.lord, siege: f.siege,
      ...(f.names ? { names: f.names } : {}), ...(f.size ? { size: f.size } : {}) });
  }
  // Карта крупнее — поселений больше.
  const S = MAP_SCALE;
  // С Гельвецией суши стало на десятую больше — и поселений тоже.
  const want = { inn: 20 * S, castle: 16 * S, monastery: 7 * S, village: 78 * S };
  const good = {
    village: [OT.PLAIN, OT.FIELD, OT.FOREST, OT.HILL],
    monastery: [OT.HILL, OT.FOREST, OT.MOUNT, OT.PLAIN],
    castle: [OT.HILL, OT.MOUNT, OT.PINE],
  };
  for (const [kind, count] of Object.entries(want)) {
    let made = 0;
    for (let t = 0; t < 6000 * S && made < count; t++) {
      const x = r.int(2, ow.w - 3), y = r.int(2, ow.h - 3), i = ow.idx(x, y);
      if (kind === 'inn' ? ow.road[i] < 0 : !good[kind].includes(ow.tiles[i])) continue;
      if (!clear(x, y, 2 + S)) continue;
      // Постоялые дворы — на день пути друг от друга, а не гроздьями.
      if (kind === 'inn' && ow.cities.some(c => c.kind === 'inn' && Math.max(Math.abs(c.x - x), Math.abs(c.y - y) * 2) < 14 * S)) continue;
      add(kind, x, y, kind === 'village' ? { size: r.int(7, 15) } : {});
      made++;
    }
  }
}
