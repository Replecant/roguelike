'use strict';

// ─── География: перевод координат и названия мест ───────────────────
// Все координаты в content/ — [долгота, широта]. Символы терминала вдвое выше,
// чем шире, поэтому клетка вдвое длиннее по вертикали (см. GEO в content/world.js).

const KM_PER_DEG = 111.2;
const COS_LAT = Math.cos(GEO.midLat * Math.PI / 180);
function geoToXY(lon, lat) {
  return [(lon - GEO.lon0) * COS_LAT * KM_PER_DEG / GEO.kmX, (GEO.lat1 - lat) * KM_PER_DEG / GEO.kmY];
}
function xyToGeo(x, y) {
  return [GEO.lon0 + x * GEO.kmX / (COS_LAT * KM_PER_DEG), GEO.lat1 - y * GEO.kmY / KM_PER_DEG];
}
function geoKm(lon1, lat1, lon2, lat2) {
  return Math.hypot((lon1 - lon2) * COS_LAT * KM_PER_DEG, (lat1 - lat2) * KM_PER_DEG);
}

const OVER_W = Math.ceil(geoToXY(GEO.lon1, GEO.lat0)[0]);
const OVER_H = Math.ceil(geoToXY(GEO.lon1, GEO.lat0)[1]);

const CITY_BY_ID = Object.fromEntries(CITIES.map(c => [c.id, c]));

// «в Мессину», «в Геную», но «в Милан», «в Палермо».
function cityAcc(name) {
  if (name.endsWith('я')) return name.slice(0, -1) + 'ю';
  if (name.endsWith('а')) return name.slice(0, -1) + 'у';
  return name;
}

function placeName(kind, r) {
  switch (kind) {
    case 'monastery': return `Аббатство ${r.pick(MONASTERY_SAINTS)}`;
    case 'castle': return `Рокка ${r.pick(CASTLE_FAMILIES)}`;
    case 'inn': return `Постоялый двор «${r.pick(INN_SIGNS)}»`;
    default: return `${r.pick(VILLAGE_PREFIX)}-${r.pick(VILLAGE_SUFFIX)}`;
  }
}
