'use strict';

// ─── Снаряжение ────────────────────────────────────────────────────
// slot: куда надевается; tier: 1 — у деревенского кузнеца, 2 — в городке,
// 3 — только в большом городе; 0 — не продаётся (только находки).
// Свойства: dmg, acc — оружие; two — двуручное; armor, ev — защита и уклонение;
// light — свет (факел); sight — дальность обзора; dmgBonus — доп. урон;
// vsUnholy — доп. урон по нечисти; travel — быстрее в пути;
// stats — прибавка к характеристикам; poisonRes, unholyArmor, faeEv, price, graceRegen — реликвии.
// ranged — стрелковое оружие: rdmg — урон выстрела, range — дальность, ammo — чем стреляет,
// reload — сколько ходов взводить, racc — точность, str — нужная Сила. ammo-предметы — запас стрел и метательного.

const SLOTS = [
  ['head', 'Шлем'], ['body', 'Нагрудник'], ['arms', 'Наручи'], ['legs', 'Поножи'], ['feet', 'Сапоги'],
  ['right', 'Правая рука'], ['left', 'Левая рука'], ['relic1', 'Реликвия I'], ['relic2', 'Реликвия II'], ['relic3', 'Реликвия III'],
];

// Куда подходит предмет: вид предмета → слоты.
const KIND_SLOTS = {
  weapon: ['right'], offhand: ['left'], head: ['head'], body: ['body'], arms: ['arms'], legs: ['legs'], feet: ['feet'],
  relic: ['relic1', 'relic2', 'relic3'],
};

const ITEMS = {
  // Стрелковое (правая рука; в ближнем бою им много не навоюешь).
  sling:     { kind: 'weapon', name: 'Праща', dmg: [1, 2], ranged: { rdmg: [1, 5], range: 6, ammo: 'stone' }, value: 12, w: 1, tier: 1,
    note: 'камни под ногами — запас не кончается' },
  shortbow:  { kind: 'weapon', name: 'Охотничий лук', dmg: [1, 2], two: true, ranged: { rdmg: [2, 7], range: 7, ammo: 'arrow' },
    value: 90, w: 2, tier: 1 },
  longbow:   { kind: 'weapon', name: 'Длинный лук', dmg: [1, 3], two: true, ranged: { rdmg: [3, 10], range: 9, ammo: 'arrow', str: 8 },
    value: 260, w: 2, tier: 3, note: 'тугой: без Силы 8 стрелы летят вкривь' },
  crossbow:  { kind: 'weapon', name: 'Арбалет', dmg: [1, 3], two: true, ranged: { rdmg: [3, 11], range: 8, ammo: 'bolt', reload: 1, racc: 2 },
    value: 195, w: 3, tier: 2, note: 'после выстрела ход на перезарядку' },
  genoese:   { kind: 'weapon', name: 'Генуэзский арбалет', dmg: [1, 3], two: true, ranged: { rdmg: [5, 14], range: 10, ammo: 'bolt', reload: 2, racc: 3 },
    value: 490, w: 4, tier: 3, note: 'лучшие арбалетчики Европы — генуэзцы; два хода на перезарядку' },
  // Запасы.
  arrows:    { kind: 'ammo', name: 'Стрелы (20)', ammo: 'arrow', count: 20, value: 12, w: 0, tier: 1 },
  bolts:     { kind: 'ammo', name: 'Арбалетные болты (15)', ammo: 'bolt', count: 15, value: 16, w: 0, tier: 2 },
  javelins:  { kind: 'ammo', name: 'Дротики (4)', ammo: 'javelin', count: 4, value: 24, w: 0, tier: 1 },
  tknives:   { kind: 'ammo', name: 'Метательные ножи (6)', ammo: 'tknife', count: 6, value: 28, w: 0, tier: 2 },

  // Правая рука.
  knife:     { kind: 'weapon', name: 'Нож', dmg: [1, 4], value: 9, w: 1, tier: 1 },
  club:      { kind: 'weapon', name: 'Дубина', dmg: [1, 6], value: 25, w: 2, tier: 1 },
  axe:       { kind: 'weapon', name: 'Топор', dmg: [2, 8], value: 85, w: 2, tier: 1 },
  mace:      { kind: 'weapon', name: 'Булава', dmg: [2, 8], vsUnholy: 2, value: 105, w: 3, tier: 2,
    note: 'крушит кости нежити' },
  spear:     { kind: 'weapon', name: 'Рогатина', dmg: [2, 9], acc: 1, two: true, value: 115, w: 3, tier: 2 },
  sword:     { kind: 'weapon', name: 'Меч', dmg: [3, 10], acc: 1, value: 260, w: 2, tier: 3 },
  greataxe:  { kind: 'weapon', name: 'Двуручная секира', dmg: [4, 13], acc: -1, two: true, value: 385, w: 4, tier: 3 },
  gladius:   { kind: 'weapon', name: 'Гладиус', dmg: [2, 9], acc: 2, value: 60, w: 2, tier: 0, roman: true, note: 'римский короткий меч' },

  // Левая рука.
  torch:     { kind: 'offhand', name: 'Факел', light: 3, value: 3, w: 1, tier: 1, note: 'светит в катакомбах и ночью' },
  dagger:    { kind: 'offhand', name: 'Кинжал', dmgBonus: 1, value: 45, w: 1, tier: 1 },
  buckler:   { kind: 'offhand', name: 'Баклер', ev: 1, value: 35, w: 1, tier: 1 },
  shield:    { kind: 'offhand', name: 'Щит', armor: 1, ev: 1, value: 75, w: 3, tier: 1 },
  kite:      { kind: 'offhand', name: 'Миндалевидный щит', armor: 2, ev: 1, value: 190, w: 4, tier: 3 },
  scutum:    { kind: 'offhand', name: 'Скутум', armor: 2, ev: 1, value: 50, w: 4, tier: 0, roman: true, note: 'щит римского легионера' },

  // Голова.
  cap:       { kind: 'head', name: 'Кожаный шлем', armor: 1, value: 35, w: 1, tier: 1 },
  nasal:     { kind: 'head', name: 'Шлем с наносником', armor: 2, value: 105, w: 2, tier: 2 },
  greathelm: { kind: 'head', name: 'Топфхельм', armor: 3, sight: -2, value: 245, w: 3, tier: 3, note: 'видно только сквозь прорезь' },
  galea:     { kind: 'head', name: 'Галея', armor: 2, value: 45, w: 2, tier: 0, roman: true, note: 'римский шлем с гребнем' },

  // Тело.
  gambeson:  { kind: 'body', name: 'Стёганка', armor: 1, value: 55, w: 2, tier: 1 },
  leather:   { kind: 'body', name: 'Кожаный доспех', armor: 2, value: 115, w: 3, tier: 2 },
  mail:      { kind: 'body', name: 'Кольчуга', armor: 3, value: 315, w: 5, tier: 3 },
  lorica:    { kind: 'body', name: 'Римский доспех', armor: 3, ev: -1, value: 160, w: 5, tier: 0, roman: true,
    note: 'стальные полосы легионера на истлевших ремнях, перешитых наново. Держит удар, но скован; люди дивятся' },
  scale:     { kind: 'body', name: 'Чешуйчатый доспех', armor: 4, ev: -1, value: 490, w: 6, tier: 3, note: 'тяжёл — мешает уворачиваться' },

  // Руки, ноги, ступни.
  bracers:   { kind: 'arms', name: 'Кожаные наручи', armor: 1, value: 30, w: 1, tier: 1 },
  mittens:   { kind: 'arms', name: 'Кольчужные рукавицы', armor: 1, acc: 1, value: 105, w: 1, tier: 3, note: 'крепче держишь оружие' },
  leggings:  { kind: 'legs', name: 'Кожаные поножи', armor: 1, value: 35, w: 1, tier: 1 },
  chausses:  { kind: 'legs', name: 'Кольчужные шоссы', armor: 2, ev: -1, value: 160, w: 3, tier: 3 },
  boots:     { kind: 'feet', name: 'Высокие сапоги', armor: 1, travel: 0.9, value: 45, w: 1, tier: 1, note: 'в пути на десятую часть быстрее' },
  greaves:   { kind: 'feet', name: 'Железные башмаки', armor: 2, ev: -1, value: 140, w: 2, tier: 3 },

  // Реликвии.
  reliquary: { kind: 'relic', name: 'Ладанка с мощами', stats: { fai: 2 }, value: 260, minPiety: 40, w: 0, tier: 1, seller: 'priest' },
  rosary:    { kind: 'relic', name: 'Чётки из оливы', graceRegen: 8, value: 70, minPiety: 15, w: 0, tier: 1, seller: 'priest',
    note: 'благодать возвращается быстрее' },
  apollonia: { kind: 'relic', name: 'Зуб святой Аполлонии', poisonRes: 0.35, value: 180, minPiety: 30, w: 0, tier: 2, seller: 'priest',
    note: 'оберегает от яда' },
  horseshoe: { kind: 'relic', name: 'Подкова из холодного железа', faeEv: 3, value: 45, w: 1, tier: 1, seller: 'smith',
    note: 'дивным труднее попасть' },
  bear_claw: { kind: 'relic', name: 'Медвежий коготь на шнурке', stats: { str: 1 }, value: 90, w: 0, tier: 1, seller: 'herbalist' },
  gorgoneion:{ kind: 'relic', name: 'Горгонейон', unholyArmor: 2, value: 70, w: 0, tier: 0, pagan: true,
    note: 'голова Медузы: нечисть бьёт слабее. Языческий оберег — набожный увидит, осудит' },
  bulla:     { kind: 'relic', name: 'Золотая булла', stats: { wis: 1 }, value: 60, w: 0, tier: 0, pagan: true,
    note: 'римский детский оберег, языческий — набожный увидит, осудит' },
  great_mother: { kind: 'relic', name: 'Глиняная толстая владычица', stats: { con: 1 }, value: 55, w: 0, tier: 0, pagan: true,
    note: 'безголовая статуэтка из храма великанов. Языческая — набожный увидит, осудит' },
  signet:    { kind: 'relic', name: 'Перстень с печатью сенатора', price: 0.9, value: 80, w: 0, tier: 0,
    note: 'купцы уступают в цене' },
  // Уникальные: подземный мир.
  golden_bough: { kind: 'relic', name: 'Золотая ветвь', light: 2, graceRegen: 4, value: 0, w: 0, tier: 0,
    note: 'ветвь из рощи Прозерпины; без неё живому не войти в подземный мир. Светит во тьме' },
  pluto_helm: { kind: 'head', name: 'Шлем Плутона', armor: 3, ev: 2, unholyArmor: 2, value: 400, w: 1, tier: 0,
    note: 'шлем-невидимка владыки мёртвых: тени и нечисть почти не видят того, кто его носит' },
  vexillum: { kind: 'weapon', name: 'Копьё со стягом святого Петра', dmg: [4, 11], acc: 2, two: true, vsUnholy: 3, stats: { fai: 1 },
    value: 0, w: 3, tier: 0, note: 'дар папы Иннокентия IV: красный стяг с ключами Петра. Святой престол жалует его лишь защитникам Церкви' },
};

const FISTS = { name: 'Кулаки', dmg: [1, 2] };
