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
  sling:     { kind: 'weapon', name: 'Праща', dmg: [1, 2], ranged: { rdmg: [1, 5], range: 6, ammo: 'stone' }, value: 4, w: 1, tier: 1,
    note: 'камни под ногами — запас не кончается' },
  shortbow:  { kind: 'weapon', name: 'Охотничий лук', dmg: [1, 2], two: true, ranged: { rdmg: [2, 7], range: 7, ammo: 'arrow' },
    value: 30, w: 2, tier: 1 },
  longbow:   { kind: 'weapon', name: 'Длинный лук', dmg: [1, 3], two: true, ranged: { rdmg: [3, 10], range: 9, ammo: 'arrow', str: 8 },
    value: 75, w: 2, tier: 3, note: 'тугой: без Силы 8 стрелы летят вкривь' },
  crossbow:  { kind: 'weapon', name: 'Арбалет', dmg: [1, 3], two: true, ranged: { rdmg: [3, 11], range: 8, ammo: 'bolt', reload: 1, racc: 2 },
    value: 65, w: 3, tier: 2, note: 'после выстрела ход на перезарядку' },
  genoese:   { kind: 'weapon', name: 'Генуэзский арбалет', dmg: [1, 3], two: true, ranged: { rdmg: [5, 14], range: 10, ammo: 'bolt', reload: 2, racc: 3 },
    value: 140, w: 4, tier: 3, note: 'лучшие арбалетчики Европы — генуэзцы; два хода на перезарядку' },
  // Запасы.
  arrows:    { kind: 'ammo', name: 'Стрелы (20)', ammo: 'arrow', count: 20, value: 6, w: 0, tier: 1 },
  bolts:     { kind: 'ammo', name: 'Арбалетные болты (15)', ammo: 'bolt', count: 15, value: 8, w: 0, tier: 2 },
  javelins:  { kind: 'ammo', name: 'Дротики (4)', ammo: 'javelin', count: 4, value: 12, w: 0, tier: 1 },
  tknives:   { kind: 'ammo', name: 'Метательные ножи (6)', ammo: 'tknife', count: 6, value: 14, w: 0, tier: 2 },

  // Правая рука.
  knife:     { kind: 'weapon', name: 'Нож', dmg: [1, 4], value: 3, w: 1, tier: 1 },
  club:      { kind: 'weapon', name: 'Дубина', dmg: [1, 6], value: 8, w: 2, tier: 1 },
  axe:       { kind: 'weapon', name: 'Топор', dmg: [2, 8], value: 28, w: 2, tier: 1 },
  mace:      { kind: 'weapon', name: 'Булава', dmg: [2, 8], vsUnholy: 2, value: 35, w: 3, tier: 2,
    note: 'крушит кости нежити' },
  spear:     { kind: 'weapon', name: 'Рогатина', dmg: [2, 9], acc: 1, two: true, value: 38, w: 3, tier: 2 },
  sword:     { kind: 'weapon', name: 'Меч', dmg: [3, 10], acc: 1, value: 75, w: 2, tier: 3 },
  greataxe:  { kind: 'weapon', name: 'Двуручная секира', dmg: [4, 13], acc: -1, two: true, value: 110, w: 4, tier: 3 },
  gladius:   { kind: 'weapon', name: 'Гладиус', dmg: [2, 9], acc: 2, value: 60, w: 2, tier: 0, note: 'римский короткий меч' },

  // Левая рука.
  torch:     { kind: 'offhand', name: 'Факел', light: 3, value: 1, w: 1, tier: 1, note: 'светит в катакомбах и ночью' },
  dagger:    { kind: 'offhand', name: 'Кинжал', dmgBonus: 1, value: 15, w: 1, tier: 1 },
  buckler:   { kind: 'offhand', name: 'Баклер', ev: 1, value: 12, w: 1, tier: 1 },
  shield:    { kind: 'offhand', name: 'Щит', armor: 1, ev: 1, value: 25, w: 3, tier: 1 },
  kite:      { kind: 'offhand', name: 'Миндалевидный щит', armor: 2, ev: 1, value: 55, w: 4, tier: 3 },
  scutum:    { kind: 'offhand', name: 'Скутум', armor: 2, ev: 1, value: 50, w: 4, tier: 0, note: 'щит римского легионера' },

  // Голова.
  cap:       { kind: 'head', name: 'Кожаный шлем', armor: 1, value: 12, w: 1, tier: 1 },
  nasal:     { kind: 'head', name: 'Шлем с наносником', armor: 2, value: 35, w: 2, tier: 2 },
  greathelm: { kind: 'head', name: 'Топфхельм', armor: 3, sight: -2, value: 70, w: 3, tier: 3, note: 'видно только сквозь прорезь' },
  galea:     { kind: 'head', name: 'Галея', armor: 2, value: 45, w: 2, tier: 0, note: 'римский шлем с гребнем' },

  // Тело.
  gambeson:  { kind: 'body', name: 'Стёганка', armor: 1, value: 18, w: 2, tier: 1 },
  leather:   { kind: 'body', name: 'Кожаный доспех', armor: 2, value: 38, w: 3, tier: 2 },
  mail:      { kind: 'body', name: 'Кольчуга', armor: 3, value: 90, w: 5, tier: 3 },
  scale:     { kind: 'body', name: 'Чешуйчатый доспех', armor: 4, ev: -1, value: 140, w: 6, tier: 3, note: 'тяжёл — мешает уворачиваться' },

  // Руки, ноги, ступни.
  bracers:   { kind: 'arms', name: 'Кожаные наручи', armor: 1, value: 10, w: 1, tier: 1 },
  mittens:   { kind: 'arms', name: 'Кольчужные рукавицы', armor: 1, acc: 1, value: 30, w: 1, tier: 3, note: 'крепче держишь оружие' },
  leggings:  { kind: 'legs', name: 'Кожаные поножи', armor: 1, value: 12, w: 1, tier: 1 },
  chausses:  { kind: 'legs', name: 'Кольчужные шоссы', armor: 2, ev: -1, value: 45, w: 3, tier: 3 },
  boots:     { kind: 'feet', name: 'Высокие сапоги', armor: 1, travel: 0.9, value: 15, w: 1, tier: 1, note: 'в пути на десятую часть быстрее' },
  greaves:   { kind: 'feet', name: 'Железные башмаки', armor: 2, ev: -1, value: 40, w: 2, tier: 3 },

  // Реликвии.
  reliquary: { kind: 'relic', name: 'Ладанка с мощами', stats: { fai: 2 }, value: 60, w: 0, tier: 1, seller: 'priest' },
  rosary:    { kind: 'relic', name: 'Чётки из оливы', graceRegen: 8, value: 20, w: 0, tier: 1, seller: 'priest',
    note: 'благодать возвращается быстрее' },
  apollonia: { kind: 'relic', name: 'Зуб святой Аполлонии', poisonRes: 0.35, value: 45, w: 0, tier: 2, seller: 'priest',
    note: 'оберегает от яда' },
  horseshoe: { kind: 'relic', name: 'Подкова из холодного железа', faeEv: 3, value: 15, w: 1, tier: 1, seller: 'smith',
    note: 'дивным труднее попасть' },
  bear_claw: { kind: 'relic', name: 'Медвежий коготь на шнурке', stats: { str: 1 }, value: 35, w: 0, tier: 1, seller: 'herbalist' },
  gorgoneion:{ kind: 'relic', name: 'Горгонейон', unholyArmor: 2, value: 70, w: 0, tier: 0, pagan: true,
    note: 'голова Медузы: нечисть бьёт слабее. Языческий оберег — грех носить' },
  bulla:     { kind: 'relic', name: 'Золотая булла', stats: { wis: 1 }, value: 60, w: 0, tier: 0, pagan: true,
    note: 'римский детский оберег, языческий — грех носить' },
  signet:    { kind: 'relic', name: 'Перстень с печатью сенатора', price: 0.9, value: 80, w: 0, tier: 0,
    note: 'купцы уступают в цене' },
  // Уникальные: подземный мир.
  golden_bough: { kind: 'relic', name: 'Золотая ветвь', light: 2, graceRegen: 4, value: 0, w: 0, tier: 0,
    note: 'ветвь из рощи Прозерпины; без неё живому не войти в подземный мир. Светит во тьме' },
  pluto_helm: { kind: 'head', name: 'Шлем Плутона', armor: 3, ev: 2, unholyArmor: 2, value: 400, w: 1, tier: 0,
    note: 'шлем-невидимка владыки мёртвых: тени и нечисть почти не видят того, кто его носит' },
};

const FISTS = { name: 'Кулаки', dmg: [1, 2] };
