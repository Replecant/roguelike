'use strict';

// ─── Чертежи зданий ────────────────────────────────────────────────
// Легенда: # мраморная стена, w деревянная стена, . пол, + дверь, A алтарь,
// o колонна, T башня, , руины, g трава, s песок, * дерево, S лоток,
// F купель, t стол, a наковальня, h полка с травами, b лежанка, Y корабль,
// ~ вода, пробел — мостовая вокруг.

const STAMP_TILES = {
  '#': T.MARBLE, 'w': T.WALL, '.': T.FLOOR, '+': T.DOOR, 'A': T.ALTAR, 'o': T.COLUMN,
  'T': T.TOWER, ',': T.RUBBLE, 'g': T.GRASS, 's': T.SAND, '*': T.FOREST, 'S': T.STALL,
  'F': T.FONT, 't': T.TABLE, 'a': T.ANVIL, 'h': T.SHELF, 'b': T.BED, 'Y': T.SHIP, 'y': T.HAY, '=': T.TROUGH,
  '~': T.CANAL, ' ': T.COBBLE,
};

const STAMPS = {
  basilica: [
    '###########',
    '#....A....#',
    '#.o.o.o.o.#',
    '#.........#',
    '#.o.o.o.o.#',
    '#.........#',
    '#.o.o.o.o.#',
    '#.........#',
    '#####+#####',
  ],
  basilica_tower: [
    '###########   ',
    '#....A....#   ',
    '#.o.o.o.o.# TT',
    '#.........# TT',
    '#.o.o.o.o.#   ',
    '#.........#   ',
    '#.o.o.o.o.#   ',
    '#.........#   ',
    '#####+#####   ',
  ],
  ambrogio: [
    ' TT           TT ',
    ' TT###########TT ',
    '   #....A....#   ',
    '   #.o.o.o.o.#   ',
    '   #.........#   ',
    '   #.o.o.o.o.#   ',
    '   #####+#####   ',
    '   #o.o...o.o#   ',
    '   #.........#   ',
    '   #o.o...o.o#   ',
    '   #####+#####   ',
  ],
  san_marco: [
    '   #####   ',
    '  ##.A.##  ',
    '###.....###',
    '#....o....#',
    '#..o...o..#',
    '#....o....#',
    '###.....###',
    '  ##...##  ',
    '   ##+##   ',
  ],
  baptistery: [
    '  #####  ',
    ' ##...## ',
    '##.....##',
    '#...F...#',
    '##.....##',
    ' ##...## ',
    '  ##+##  ',
  ],
  leaning_tower: [
    ' TT ',
    'TTTT',
    'TTTT',
    ' TT ',
  ],
  colosseum: [
    '     ###########     ',
    '  ###,,,,,,,,,,,###  ',
    ' #,,,ggggggggggg,,,# ',
    '#,,,ggggggggggggg,,,#',
    ',,,,ggggggggggggg,,,,',
    '#,,,ggggggggggggg,,,#',
    ' #,,,ggggggggggg,,,# ',
    '  ###,,,,,,,,,,,###  ',
    '     ###########     ',
  ],
  arena: [
    '     ###########     ',
    '  ###...........###  ',
    ' #...sssssssssss...# ',
    '#...sssssssssssss...#',
    '+...sssssssssssss...+',
    '#...sssssssssssss...#',
    ' #...sssssssssss...# ',
    '  ###...........###  ',
    '     ###########     ',
  ],
  forum: [
    ',,o,,,o,,,,o,,o,,',
    ',,,,,,,,,,,,,,,,,',
    'o,,,o,,ooo,,,o,,o',
    ',,,,,,,,,,,,,,,,,',
    ',,o,,,,o,,,o,,,o,',
  ],
  pantheon: [
    '  #####  ',
    ' #..A..# ',
    '#.......#',
    '#...F...#',
    '#.......#',
    ' #.....# ',
    '  ##+##  ',
    ' ooooooo ',
  ],
  castle: [
    'TT#######TT',
    'TT.......TT',
    '#.........#',
    '#.........#',
    '#.........#',
    'TT.......TT',
    'TT###+###TT',
  ],
  royal_palace: [
    'TT#########TT',
    'TT.........TT',
    '#..#######..#',
    '#..#..A..#..#',
    '#..#.....#..#',
    '#..###+###..#',
    '#...........#',
    'TT.........TT',
    'TT####+####TT',
  ],
  palazzo: [
    '#############',
    '#.o.o.o.o.o.#',
    '#...........#',
    '#...........#',
    '#.o.o.o.o.o.#',
    '######+######',
  ],
  broletto: [
    '###############',
    '#.o.o.o.o.o.o.#',
    '+.............+',
    '#.o.o.o.o.o.o.#',
    '###############',
  ],
  two_towers: [
    'TT    ',
    'TT  TT',
    '    TT',
  ],
  campanile: ['TT', 'TT'],
  lighthouse: ['TT', 'TT'],
  arsenale: [
    'T#############T',
    '#~~~~~~~~~~~~~#',
    '#~~Y~~~~~~Y~~~#',
    '#~~~~~~~~~~~~~#',
    '#.............#',
    '#.....a.......#',
    'T######+######T',
  ],
  mosque: [
    '#########T',
    '#...A...#T',
    '#.......# ',
    '#.o...o.# ',
    '#.......# ',
    '####+#### ',
  ],
  church: [
    'wwwwwwwww',
    'w...A...w',
    'w.......w',
    'w.o...o.w',
    'w.......w',
    'wwww+wwww',
  ],
  osteria: [
    'wwwwwwwww',
    'w.t..t..w',
    'w.......w',
    'w.t..t.bw',
    'wwww+wwww',
  ],
  // Постоялый двор: дом с общим залом, кухней и комнатами для постояльцев.
  inn_house: [
    'wwwwwwwwwwwwwwwwwww',
    'wbb..wt..t..t..whhw',
    'w....+.........+..w',
    'w....w.t..t..t.w..w',
    'wbb..w.........w.tw',
    'wwwwwwwwww+wwwwwwww',
  ],
  inn_stable: [
    'wwwwwwwwwww',
    'wy.y.y.y.yw',
    'w.........w',
    'w.........w',
    'wwww++wwwww',
  ],
  smithy: [
    'wwwwwww',
    'w.a...w',
    'w.....w',
    'www+www',
  ],
  herbal: [
    'wwwwww',
    'whh..w',
    'w....w',
    'ww+www',
  ],
  hut: [
    'wwwww',
    'w.b.w',
    'w...w',
    'ww+ww',
  ],
  hut_big: [
    'wwwwwww',
    'w.b..tw',
    'w.....w',
    'w.....w',
    'www+www',
  ],
  chapel: [
    'wwwww',
    'w.A.w',
    'w...w',
    'w...w',
    'ww+ww',
  ],
  cloister: [
    '############',
    '#..........#',
    '#.o.o..o.o.#',
    '#..gggggg..#',
    '#.ogggFggo.#',
    '#..gggggg..#',
    '#.o.o..o.o.#',
    '#..........#',
    '#####++#####',
  ],
  cells: [
    'wwwwwwwwww',
    'wb.wb.wb.w',
    'w........w',
    'wwww++wwww',
  ],
  stable: [
    'wwwwwww',
    'w.....w',
    'w.....w',
    'ww+wwww',
  ],
  octagon: [
    '   T#####T   ',
    '  ##.....##  ',
    ' T#.......#T ',
    ' #...ggg...# ',
    '##...gFg...##',
    ' #...ggg...# ',
    ' T#.......#T ',
    '  ##.....##  ',
    '   T##+##T   ',
  ],
  town_hall: [
    'wwwwwwwww',
    'w.o...o.w',
    'w.......w',
    'w.o...o.w',
    'wwww+wwww',
  ],
};

// ─── Планы городов ─────────────────────────────────────────────────
// w, h — размер карты; rx, ry — полуоси города; shape — oval или rect;
// center — где центр города на карте (доли); sea — с какой стороны море;
// river — река через город; density — доля кварталов, застроенных домами;
// hot — где застройка гуще: [x, y, радиус] в долях полуосей;
// ruins — доля руин среди пустырей; towers — доля башен-домов;
// block — размер кварталов; landmarks.at — положение в долях полуосей.

const BIG_CITY = { w: 120, h: 60, rx: 44, ry: 21, shape: 'oval', walls: true, block: [4, 8], density: 0.88, folk: 10, guards: 4 };
const SMALL_TOWN = { w: 90, h: 46, rx: 22, ry: 11, shape: 'rect', walls: true, block: [3, 6], density: 0.75, folk: 4, guards: 1, towerEvery: 6 };

// ─── Поселения между городами ──────────────────────────────────────
// buildings: [чертёж, имя, роль, шанс]; роль peasant — в доме живёт крестьянин.

const PLACE_PLANS = {
  village: {
    w: 84, h: 44, rx: 17, ry: 8, shape: 'oval', walls: false, folk: 2, guards: 0, ground: T.DIRT, block: [4, 6],
    titles: { elder: 'Староста', peasant: ['Крестьянин', 'Крестьянка'], innkeeper: ['Трактирщик', 'Трактирщица'] },
    // Хижины крестьян добавляются по размеру деревни (см. cityPlan).
    buildings: [
      ['hut_big', 'Дом старосты', 'elder', 1], ['chapel', 'Часовня', 'priest', 0.8],
      ['osteria', 'Таверна', 'innkeeper', 0.6], ['smithy', 'Кузница', 'smith', 0.5], ['herbal', 'Хижина знахарки', 'herbalist', 0.5],
      ['stable', 'Хлев', null, 0.8], ['stable', 'Амбар', null, 0.5],
    ],
  },
  monastery: {
    w: 84, h: 46, rx: 19, ry: 11, shape: 'rect', walls: true, towerEvery: 7, folk: 3, guards: 0, ground: T.COBBLE,
    titles: { priest: 'Аббат', herbalist: 'Брат-травник', peasant: 'Монах', innkeeper: 'Брат-гостинник' }, male: true,
    buildings: [
      ['basilica_tower', 'Церковь аббатства', 'priest', 1], ['cloister', 'Клуатр', null, 1],
      ['cells', 'Кельи', 'peasant', 1], ['herbal', 'Монастырская аптека', 'herbalist', 1],
      ['osteria', 'Странноприимный дом', 'innkeeper', 0.6],
    ],
  },
  castle: {
    w: 80, h: 44, rx: 16, ry: 9, shape: 'rect', walls: true, towerEvery: 4, folk: 2, guards: 4, ground: T.COBBLE,
    titles: { elder: 'Кастелян', peasant: ['Слуга', 'Служанка'], smith: 'Оружейник' },
    buildings: [
      ['castle', 'Донжон', 'elder', 1], ['smithy', 'Оружейная', 'smith', 1], ['chapel', 'Капелла', 'priest', 0.6],
      ['stable', 'Конюшня', null, 1],
    ],
  },
  // Строится отдельно (HamletBuilder.buildInn): двор за оградой прямо у тракта.
  inn: {
    w: 76, h: 40, rx: 18, ry: 11, shape: 'rect', walls: false, folk: 3, guards: 0, ground: T.DIRT,
    titles: { peasant: ['Путник', 'Паломница'], innkeeper: ['Хозяин двора', 'Хозяйка двора'], priest: 'Капеллан' },
    buildings: [
      ['osteria', null, 'innkeeper', 1], ['stable', 'Конюшня', null, 1], ['smithy', 'Коновальня', 'smith', 0.5],
    ],
  },
};
