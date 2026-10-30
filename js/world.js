'use strict';

// ─── Типы клеток ───────────────────────────────────────────────────

const T = {
  GRASS: 0, TALLGRASS: 1, FOREST: 2, PINE: 3, WATER: 4, MARSH: 5, HILL: 6,
  MOUNTAIN: 7, ROAD: 8, BRIDGE: 9, WALL: 10, DOOR: 11, FLOOR: 12, ALTAR: 13,
  WELL: 14, FIELD: 15, ANVIL: 16, TABLE: 17, DIRT: 18, BED: 19, SHELF: 20,
  SEA: 21, SAND: 22, ROCK: 23, ASH: 24, LAVA: 25, FORD: 26, STONEWALL: 27, PIER: 28, WALNUT: 29,
  COBBLE: 30, HOUSE: 31, TOWER: 32, MARBLE: 33, COLUMN: 34, RUBBLE: 35, STALL: 36, FONT: 37,
  CANAL: 38, SHIP: 39, VINEYARD: 40, WALLTOWER: 41, HOUSE2: 42, HOUSEDOOR: 43, COURTYARD: 44, GARDEN: 45,
  CROP: 46, STUBBLE: 47, GRAPES: 48, DEADWOOD: 49, HERB: 50, DEBRIS: 51, STONES: 52,
  TOMBWALL: 53, NICHE: 54, TOMBFLOOR: 55, BONES: 56, SARCOPHAGUS: 57, SARC_OPEN: 58, STAIRS_DOWN: 59,
  STAIRS_UP: 60, PAGAN_ALTAR: 61,
  WAGON: 62, CRATE: 63, CRATE_OPEN: 64, TENT: 65, CAMPFIRE: 66, CHEST: 67, CHEST_OPEN: 68, BONEPILE: 69,
  YARDWALL: 70, TROUGH: 71, HAY: 72, CART: 73, HOUSE3: 74,
  CAVEWALL: 75, CAVEFLOOR: 76, FRESCO: 77, URN: 78, URN_OPEN: 79, BENCH: 80, SHRINE: 81, TIMBER: 82, ORE: 83, ORE_DUG: 84,
  CRYPTWALL: 85, CRYPTFLOOR: 86,
  THRONE: 87, HEARTH: 88, RACK: 89, BARREL: 90, CARPET: 91, COFFER: 92, BANNER: 93, BOUGH: 94, LOCKED: 95, INSCRIPTION: 96, MIHRAB: 97, CAUTES: 98, CAUTOPATES: 99,
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
// Город.
TILES[T.COBBLE]    = { ch: ['·', '.', '·', ','], fg: ['#aaa294', '#9a9284', '#b4ac9c'], walk: 1, see: 1, name: 'Мостовая', bg: '#22201b' };
// Дома горожан видно сверху: крыши не закрывают обзор, в отличие от стен и башен.
TILES[T.HOUSE]     = { ch: ['▒'], fg: ['#b0583a', '#a8553a'], walk: 0, see: 1, name: 'дома горожан', bg: '#3a2014' };
TILES[T.HOUSE2]    = { ch: ['▒'], fg: ['#c8904a', '#bc8644'], walk: 0, see: 1, name: 'дома горожан', bg: '#3a2a14' };
TILES[T.HOUSE3]    = { ch: ['▒'], fg: ['#8a8a82', '#7e7e78'], walk: 0, see: 1, name: 'дома горожан', bg: '#2a2a26' };
TILES[T.HOUSEDOOR] = { ch: ['+'], fg: ['#d8a060'], walk: 0, see: 1, name: 'чужая дверь — заперто', bg: '#3a2014' };
TILES[T.GARDEN]    = { ch: ['"', '♠', '"'], fg: ['#7ab84a', '#5a9a3a'], walk: 1, see: 1, name: 'Огород', hab: 'field', bg: '#16200f' };
// Римские подземелья.
TILES[T.TOMBWALL]  = { ch: ['#'], fg: ['#6a6258', '#5e574e'], walk: 0, see: 0, name: 'Туфовая стена', bg: '#141210' };
TILES[T.NICHE]     = { ch: ['≡'], fg: ['#b0a890', '#a09880'], walk: 0, see: 0, name: 'Ниши с костями', bg: '#141210' };
TILES[T.TOMBFLOOR] = { ch: ['.', '.', ','], fg: ['#6a645a', '#5e584e'], walk: 1, see: 1, name: 'Ход катакомбы', hab: 'tomb' };
TILES[T.BONES]     = { ch: [',', '`', ';'], fg: ['#c8c0b0', '#b0a898'], walk: 1, see: 1, name: 'Кости', hab: 'tomb' };
TILES[T.SARCOPHAGUS] = { ch: ['■'], fg: ['#d8ccb4'], walk: 0, see: 1, name: 'Саркофаг', bg: '#24201a' };
TILES[T.SARC_OPEN] = { ch: ['□'], fg: ['#8a8478'], walk: 0, see: 1, name: 'Вскрытый саркофаг', bg: '#1a1712' };
TILES[T.STAIRS_DOWN] = { ch: ['>'], fg: ['#f0e0a0'], walk: 1, see: 1, name: 'Лестница вниз', bg: '#2a2418' };
TILES[T.STAIRS_UP] = { ch: ['<'], fg: ['#f0e0a0'], walk: 1, see: 1, name: 'Лестница наверх', bg: '#2a2418' };
TILES[T.PAGAN_ALTAR] = { ch: ['Π'], fg: ['#d06040'], walk: 0, see: 1, name: 'Алтарь подземным богам', bg: '#2a1410' };
// Постоялый двор.
TILES[T.YARDWALL]  = { ch: ['#'], fg: ['#a08a68', '#988060'], walk: 0, see: 0, name: 'Ограда двора', bg: '#221b12' };
TILES[T.TROUGH]    = { ch: ['='], fg: ['#7fb6d8'], walk: 0, see: 1, name: 'Поилка для лошадей', bg: '#1a1712' };
TILES[T.HAY]       = { ch: ['"', '≈'], fg: ['#d8c060', '#c8b050'], walk: 1, see: 1, name: 'Сено', bg: '#2a2410' };
TILES[T.CART]      = { ch: ['Ж'], fg: ['#b08858'], walk: 0, see: 1, name: 'Телега постояльца' };

// События на карте.
TILES[T.WAGON]     = { ch: ['Ж'], fg: ['#a07848'], walk: 0, see: 1, name: 'Перевёрнутая повозка', bg: '#20180c' };
TILES[T.CRATE]     = { ch: ['▪'], fg: ['#d0a060'], walk: 0, see: 1, name: 'Ящик с товаром', bg: '#20180c' };
TILES[T.CRATE_OPEN] = { ch: ['□'], fg: ['#806040'], walk: 0, see: 1, name: 'Разбитый ящик' };
TILES[T.TENT]      = { ch: ['Δ'], fg: ['#c8b890', '#a89870'], walk: 0, see: 0, name: 'Палатка', bg: '#2a2418' };
TILES[T.CAMPFIRE]  = { ch: ['☼'], fg: ['#f09030'], walk: 0, see: 1, name: 'Костёр', bg: '#2a1408' };
TILES[T.CHEST]     = { ch: ['■'], fg: ['#e0b040'], walk: 0, see: 1, name: 'Сундук', bg: '#2a2008' };
TILES[T.CHEST_OPEN] = { ch: ['□'], fg: ['#8a7040'], walk: 0, see: 1, name: 'Пустой сундук' };
TILES[T.BONEPILE]  = { ch: ['%'], fg: ['#e0d8c8'], walk: 0, see: 1, name: 'Груда костей', bg: '#24201a' };

// Замок.
TILES[T.THRONE]    = { ch: ['Π'], fg: ['#e0b04a'], walk: 0, see: 1, name: 'Высокое сиденье сеньора', bg: '#3a1418' };
TILES[T.HEARTH]    = { ch: ['☼'], fg: ['#f08030', '#e06020'], walk: 0, see: 1, name: 'Очаг с котлом', bg: '#2a1408' };
TILES[T.RACK]      = { ch: ['‡'], fg: ['#c0c0c8'], walk: 0, see: 1, name: 'Стойка с копьями и мечами', bg: '#17120c' };
TILES[T.BARREL]    = { ch: ['o'], fg: ['#a07040'], walk: 0, see: 1, name: 'Бочки и мешки с припасами', bg: '#17120c' };
TILES[T.CARPET]    = { ch: ['░'], fg: ['#8a2a28'], walk: 1, see: 1, name: 'Ковровая дорожка', bg: '#3a1418' };
TILES[T.COFFER]    = { ch: ['■'], fg: ['#b08040'], walk: 0, see: 1, name: 'Окованный сундук', bg: '#17120c' };
TILES[T.BANNER]    = { ch: ['¶'], fg: ['#c83a2c', '#2a5aa8', '#e0b04a'], walk: 0, see: 0, name: 'Стена с родовым знаменем', bg: '#34302a' };

TILES[T.BOUGH]     = { ch: ['♣'], fg: ['#f0d050'], walk: 0, see: 1, name: 'Дерево с золотой ветвью', bg: '#2a2410' };

TILES[T.LOCKED]    = { ch: ['#'], fg: ['#9aa8c0'], walk: 0, see: 1, name: 'Запертая решётка', bg: '#1a1e26' };
TILES[T.MIHRAB]    = { ch: ['∩'], fg: ['#e0c070'], walk: 0, see: 1, name: 'Михраб — ниша в стене мечети, обращённая к Мекке', bg: '#2a2210' };
TILES[T.CAUTES]    = { ch: ['↑'], fg: ['#f0c060'], walk: 0, see: 1, name: 'Кавт — факелоносец с поднятым факелом', bg: '#2a2014' };
TILES[T.CAUTOPATES] = { ch: ['↓'], fg: ['#d07040'], walk: 0, see: 1, name: 'Каутопат — факелоносец с опущенным факелом', bg: '#2a1810' };
TILES[T.INSCRIPTION] = { ch: ['≡'], fg: ['#e0c080'], walk: 0, see: 0, name: 'Надпись на стене', bg: '#2a2418' };

// Разные подземелья.
TILES[T.CAVEWALL]  = { ch: ['#'], fg: ['#6a5e50', '#5e5446'], walk: 0, see: 0, name: 'Скала', bg: '#16130f' };
TILES[T.CAVEFLOOR] = { ch: ['.', ',', '`'], fg: ['#7a7060', '#6a6254'], walk: 1, see: 1, name: 'Сырой камень', hab: 'tomb' };
TILES[T.FRESCO]    = { ch: ['#'], fg: ['#c8603c', '#d8a040', '#4a8aa0'], walk: 0, see: 0, name: 'Расписная стена: пиры, танцы, демоны', bg: '#2a1a12' };
TILES[T.URN]       = { ch: ['ö'], fg: ['#c87a4a'], walk: 0, see: 1, name: 'Погребальная урна', bg: '#1e1612' };
TILES[T.URN_OPEN]  = { ch: ['o'], fg: ['#7a5a40'], walk: 0, see: 1, name: 'Разбитая урна' };
TILES[T.BENCH]     = { ch: ['='], fg: ['#a8a090'], walk: 0, see: 1, name: 'Каменная скамья для трапезы', bg: '#1a1712' };
TILES[T.SHRINE]    = { ch: ['†'], fg: ['#f0e0a0'], walk: 0, see: 1, name: 'Могила мученика, лампада', bg: '#2a2418' };
TILES[T.TIMBER]    = { ch: ['Ħ'], fg: ['#9a6a3c'], walk: 0, see: 0, name: 'Крепь из брёвен', bg: '#16130f' };
TILES[T.ORE]       = { ch: ['*'], fg: ['#d8d0b8', '#c0a860'], walk: 0, see: 0, name: 'Рудная жила', bg: '#1e1a12' };
TILES[T.ORE_DUG]   = { ch: ['#'], fg: ['#4a4238'], walk: 0, see: 0, name: 'Выбранная жила', bg: '#16130f' };
TILES[T.CRYPTWALL] = { ch: ['#'], fg: ['#9a9488', '#8a8478'], walk: 0, see: 0, name: 'Кладка склепа', bg: '#1c1a17' };
TILES[T.CRYPTFLOOR] = { ch: ['.', '·'], fg: ['#8a8478', '#7a7468'], walk: 1, see: 1, name: 'Плиты склепа', hab: 'tomb', bg: '#141210' };

// Работа для заданий.
TILES[T.CROP]      = { ch: ['¶'], fg: ['#f0c840'], walk: 1, see: 1, name: 'Спелая рожь', hab: 'field', bg: '#2a2008' };
TILES[T.STUBBLE]   = { ch: [',', '.'], fg: ['#a08848'], walk: 1, see: 1, name: 'Жнивьё', hab: 'field' };
TILES[T.GRAPES]    = { ch: ['♦'], fg: ['#b060d0'], walk: 1, see: 1, name: 'Спелый виноград', hab: 'field', bg: '#1a1020' };
TILES[T.DEADWOOD]  = { ch: ['¥'], fg: ['#c09060'], walk: 1, see: 1, name: 'Сухостой', hab: 'forest', bg: '#20180c' };
TILES[T.HERB]      = { ch: ['ψ'], fg: ['#90f090'], walk: 1, see: 1, name: 'Целебная трава', hab: 'field', bg: '#0c200c' };
TILES[T.DEBRIS]    = { ch: ['&'], fg: ['#c8a080'], walk: 1, see: 1, name: 'Завал', bg: '#2a2018' };
TILES[T.STONES]    = { ch: ['•'], fg: ['#e0d8c8'], walk: 1, see: 1, name: 'Груда камней', bg: '#24221e' };
TILES[T.COURTYARD] = { ch: ['"', ',', '.'], fg: ['#6a9448', '#5f8a42'], walk: 0, see: 1, name: 'внутренний дворик', bg: '#16200f' };
TILES[T.TOWER]     = { ch: ['█'], fg: ['#c8b898', '#b8a888'], walk: 0, see: 0, name: 'Башня', bg: '#3a3428' };
TILES[T.MARBLE]    = { ch: ['#'], fg: ['#e8e0d0', '#d8d0c0'], walk: 0, see: 0, name: 'Мраморная стена', bg: '#34302a' };
TILES[T.COLUMN]    = { ch: ['o'], fg: ['#d8d0c0'], walk: 0, see: 1, name: 'Колонна', bg: '#1a1712' };
TILES[T.RUBBLE]    = { ch: [',', '`', '.', ';'], fg: ['#8a8070', '#9a9080', '#7a7060'], walk: 1, see: 1, name: 'Античные руины', hab: 'field' };
TILES[T.STALL]     = { ch: ['¤'], fg: ['#d8a040', '#c86040', '#60a0c0', '#a0c060'], walk: 0, see: 1, name: 'Торговый лоток', bg: '#14120f' };
TILES[T.FONT]      = { ch: ['◘'], fg: ['#7fb6d8'], walk: 0, see: 1, name: 'Купель', bg: '#17120c' };
TILES[T.CANAL]     = { ch: ['≈', '~'], fg: ['#3a7ab0', '#3470a4'], walk: 0, see: 1, name: 'Канал', bg: '#0c1828' };
TILES[T.SHIP]      = { ch: ['Ψ', '♦'], fg: ['#a07848', '#b08858'], walk: 0, see: 1, name: 'Корабль', bg: '#0a1424' };
TILES[T.VINEYARD]  = { ch: ['╫', '║'], fg: ['#6a9a3a', '#5a8a30'], walk: 1, see: 1, name: 'Виноградник', hab: 'field' };
TILES[T.WALLTOWER] = { ch: ['■'], fg: ['#c8c0b0'], walk: 0, see: 0, name: 'Башня городской стены', bg: '#26231e' };

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
  set(x, y, t) {
    if (!this.inside(x, y)) return;
    const i = y * this.w + x;
    this.tiles[i] = t;
    if (this.edits) this.edits.set(i, t);   // карта уже построена — запомнить изменение для сохранения
  }
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

