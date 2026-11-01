'use strict';

// ─── Краски времён года ────────────────────────────────────────────
// Перед тем как нарисовать траву, лес, пашню или виноградник, их цвет сдвигается к цвету месяца:
// весной — свежая зелень и всходы, летом юг выгорает, а хлеб золотится и сжат в стерню, осенью
// лес желтеет и рыжеет, лоза краснеет, пашня вспахана; зимой лиственный лес гол, поля бурые.
// Снег на севере и в горах кладётся поверх (snowyHere — в calendar.js). Переход плавный: цвет
// смешивается между серединами соседних месяцев. Юг (сухой край) живёт по своему календарю:
// трава зеленеет зимой после дождей, хлеб сжат на месяц раньше, к августу всё выжжено.
// Одно и то же — и для символов, и для картинок: картинки берут цвет у символа.

// По месяцам (январь … декабрь): [цвет, доля]; null — свой цвет.
const SEASON_TINT = {
  grass: {
    north: [['#7a8060', 0.35], ['#7a8060', 0.3], ['#86c050', 0.25], ['#8ad050', 0.4], ['#78c040', 0.25], null,
      ['#6a8a30', 0.15], ['#90903a', 0.25], ['#8a8a3a', 0.25], ['#8a8040', 0.3], ['#7a7a50', 0.35], ['#7a8060', 0.35]],
    south: [['#70904a', 0.1], ['#80b048', 0.15], ['#90c850', 0.35], ['#a0c850', 0.3], ['#b0b048', 0.3], ['#c0a850', 0.45],
      ['#c8a858', 0.6], ['#c4a058', 0.65], ['#b89a58', 0.5], ['#9a9a50', 0.3], ['#80984c', 0.15], ['#78904c', 0.1]],
  },
  leaf: {
    north: [['#6a5a48', 0.5], ['#6a5a48', 0.45], ['#7a7a50', 0.3], ['#8ad050', 0.35], ['#70b040', 0.2], null,
      null, ['#5a7a30', 0.1], ['#a09030', 0.3], ['#d08a30', 0.55], ['#a0603a', 0.5], ['#6a5a48', 0.5]],
    // На юге дубы каменные и пробковые — зимой не голы, только тускнеют.
    south: [['#5a6a48', 0.2], ['#5a6a48', 0.2], ['#6a8a48', 0.1], ['#80c048', 0.25], null, null,
      ['#7a7a40', 0.2], ['#7a7a40', 0.25], ['#7a7a40', 0.2], ['#b08a40', 0.3], ['#9a7040', 0.3], ['#5a6a48', 0.2]],
  },
  crop: {
    north: [['#6a5238', 0.65], ['#6a5238', 0.6], ['#6a8a40', 0.6], ['#6aa83c', 0.7], ['#80b040', 0.65], ['#c8b048', 0.45],
      ['#d8b850', 0.5], ['#a89060', 0.6], ['#8a7050', 0.6], ['#6a4c32', 0.65], ['#5a7a3c', 0.6], ['#6a5a40', 0.6]],
    south: [['#6a9a40', 0.6], ['#72a840', 0.65], ['#80b040', 0.65], ['#a0b048', 0.55], ['#c8b048', 0.45], ['#d8b850', 0.5],
      ['#a89060', 0.6], ['#988058', 0.65], ['#7a5c40', 0.65], ['#6a4c32', 0.6], ['#5a8a3c', 0.55], ['#609040', 0.6]],
  },
  vine: {
    north: [['#6a5040', 0.55], ['#6a5040', 0.55], ['#6a5a40', 0.45], ['#80b048', 0.3], null, null,
      null, null, ['#8a6a40', 0.2], ['#a04a38', 0.45], ['#8a5a3a', 0.5], ['#6a5040', 0.55]],
    south: [['#6a5040', 0.5], ['#6a5a40', 0.45], ['#80a048', 0.3], ['#80b048', 0.2], null, null,
      ['#7a8a40', 0.15], ['#8a7a40', 0.25], ['#a04a38', 0.4], ['#8a5a3a', 0.45], ['#6a5040', 0.5], ['#6a5040', 0.55]],
  },
};

// Что как перекрашивается: клетки местных карт и карты мира.
const SEASON_CAT_LOCAL = {
  [T.GRASS]: 'grass', [T.TALLGRASS]: 'grass', [T.GARDEN]: 'grass', [T.COURTYARD]: 'grass',
  [T.FOREST]: 'leaf', [T.FIELD]: 'crop', [T.VINEYARD]: 'vine',
};
const SEASON_CAT_OVER = { [OT.PLAIN]: 'grass', [OT.FOREST]: 'leaf', [OT.FIELD]: 'crop' };

// Сухой юг: острова, Апулия, Калабрия, Кампания, Прованс, Лангедок, Далмация — и всё, что южнее Рима.
const DRY_REGIONS = new Set(['sicily', 'sardinia', 'corsica', 'malta', 'apulia', 'calabria', 'campania', 'provence', 'languedoc', 'dalmatia']);
function dryClimate(region, lat) { return DRY_REGIONS.has(region) || lat < 41.8; }

// Какой день года показывать: обычно сегодняшний, а в отладке можно «примерить» другой
// (G.debug.seasonView = [месяц, число]) — меняется только картинка, не время и не погода.
function viewDate() {
  const v = G.debug && G.debug.seasonView;
  return v ? { y: 1248, m: v[0], d: v[1] } : today();
}

// Где мы в году: 0 — середина января … 11 — середина декабря (с долями).
function seasonPos(dt = viewDate()) {
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][dt.m - 1];
  return (dt.m - 1) + (dt.d - 0.5) / days - 0.5;
}

// Кэш на день: цвет перекрашивается раз в сутки, а не на каждом кадре.
// dark — фон клетки: та же краска, только тёмная (в картинках фон — главная масса цвета).
/** @type {{day: number|string, map: Map<string, string>}} */
const SEASON_CACHE = { day: -1, map: new Map() };
function seasonTint(cat, south, color, dark = 0) {
  if (!cat || !color) return color;
  const sv = G.debug && G.debug.seasonView, day = sv ? `v${sv[0]}.${sv[1]}` : timeInfo().day;
  if (SEASON_CACHE.day !== day) { SEASON_CACHE.day = day; SEASON_CACHE.map.clear(); }
  const key = cat + (south ? 's' : 'n') + dark + color;
  let v = SEASON_CACHE.map.get(key);
  if (v) return v;
  const row = SEASON_TINT[cat][south ? 'south' : 'north'], pos = seasonPos();
  const i0 = ((Math.floor(pos) % 12) + 12) % 12, i1 = (i0 + 1) % 12, f = Math.round((pos - Math.floor(pos)) * 20) / 20;
  const at = k => row[k] ? mix(color, dark ? mix(row[k][0], '#000000', dark) : row[k][0], row[k][1]) : color;
  v = mix(at(i0), at(i1), f);
  SEASON_CACHE.map.set(key, v);
  return v;
}

function seasonTintBg(cat, south, bg) { return seasonTint(cat, south, bg, 0.72); }

// Голы ли лиственные деревья: 0 — в листве, 1 — редкий лист (конец ноября, начало апреля), 2 — голы.
// На сухом юге дубы каменные и пробковые — не облетают.
function leafBare(south) {
  if (south) return 0;
  const pos = seasonPos();   // 0 — середина января
  if (pos >= 10.7 || pos < 2.6) return 2;
  if (pos >= 10.1 || pos < 3.1) return 1;
  return 0;
}
const BARE_SPRITE = ['tree', 'treesparse', 'treebare'];

// Сухой ли край на карте мира в клетке (считается раз для карты).
const DRY_MAP = new WeakMap();
function dryAt(ow, x, y) {
  let m = DRY_MAP.get(ow);
  if (!m) {
    m = new Uint8Array(ow.w * ow.h);
    for (let yy = 0; yy < ow.h; yy++) {
      const [, lat] = xyToGeo(0.5, yy + 0.5);
      for (let xx = 0; xx < ow.w; xx++) m[yy * ow.w + xx] = dryClimate(ow.regionAt(xx, yy), lat) ? 1 : 0;
    }
    DRY_MAP.set(ow, m);
  }
  return m[ow.idx(x, y)] === 1;
}
