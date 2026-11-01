'use strict';

// ─── Регионы и державы ─────────────────────────────────────────────

const REGIONS = {
  alps:     { name: 'Альпы', realm: 'Альпийские епископства и графства', elder: 'Кастелян' },
  piedmont: { name: 'Пьемонт', realm: 'Савойя и маркграфства', elder: 'Кастелян' },
  liguria:  { name: 'Лигурия', realm: 'Генуэзская республика', elder: 'Консул' },
  lombardy: { name: 'Ломбардия', realm: 'Ломбардская лига и имперские города', elder: 'Подеста' },
  veneto:   { name: 'Марка Тревизо', realm: 'Венеция и владения Эццелино да Романо', elder: 'Подеста' },
  friuli:   { name: 'Фриули', realm: 'Патриархат Аквилеи', elder: 'Гастальд' },
  emilia:   { name: 'Эмилия и Романья', realm: 'Вольные коммуны', elder: 'Подеста' },
  tuscany:  { name: 'Тоскана', realm: 'Тосканские коммуны', elder: 'Подеста' },
  papal:    { name: 'Патримоний Святого Петра', realm: 'Папская область', elder: 'Ректор' },
  abruzzo:  { name: 'Абруццо', realm: 'Королевство Сицилия', elder: 'Байюл' },
  campania: { name: 'Кампания', realm: 'Королевство Сицилия', elder: 'Байюл' },
  apulia:   { name: 'Апулия', realm: 'Королевство Сицилия', elder: 'Байюл' },
  calabria: { name: 'Калабрия', realm: 'Королевство Сицилия', elder: 'Байюл' },
  sicily:   { name: 'Сицилия', realm: 'Королевство Сицилия', elder: 'Байюл' },
  sardinia: { name: 'Сардиния', realm: 'Сардинские юдикаты', elder: 'Куратор' },
  corsica:  { name: 'Корсика', realm: 'Генуя и Пиза', elder: 'Подеста' },
  malta:    { name: 'Мальта', realm: 'Королевство Сицилия', elder: 'Кастелян' },
  // Земля за перевалами (content/helvetia/): свои корчмы и ратуши вместо остерий и палаццо.
  helvetia: { name: 'Гельвеция', realm: 'Земли империи — Швабия и Бургундия', elder: 'Шультгейс', villageElder: 'Амман',
    titles: { innkeeper: ['Хозяин корчмы', 'Хозяйка корчмы'], noble: ['Сеньор', 'Госпожа'] },
    houses: { town_hall: 'Ратуша', osteria: 'Корчма' } },
  // Каринтия, Крайна и Нижняя Штирия (content/carantania/): в городах — судьи, в сёлах — жупаны.
  carantania: { name: 'Карантания', realm: 'Земли империи — Каринтия, Крайна и Штирия', elder: 'Городской судья', villageElder: 'Жупан',
    titles: { innkeeper: ['Корчмарь', 'Корчмарка'], noble: ['Сеньор', 'Госпожа'] },
    houses: { town_hall: 'Дом судьи', osteria: 'Корчма' } },
  // Юг Франции (content/france/): по левому берегу Роны — Прованс (Арелат, империя), по правому — Тулузские земли.
  provence: { name: 'Прованс', realm: 'Королевство Арелат — графство Карла Анжуйского', elder: 'Вигье', villageElder: 'Байль',
    titles: { innkeeper: ['Хозяин таверны', 'Хозяйка таверны'], noble: ['Сеньор', 'Дама'] },
    houses: { town_hall: 'Дом консулов', osteria: 'Таверна' } },
  languedoc: { name: 'Лангедок', realm: 'Графство Тулузское и сенешальства короля Франции', elder: 'Консул', villageElder: 'Байль',
    titles: { innkeeper: ['Хозяин таверны', 'Хозяйка таверны'], noble: ['Сеньор', 'Дама'] },
    houses: { town_hall: 'Дом консулов', osteria: 'Таверна' } },
};
const REGION_IDS = Object.keys(REGIONS);
// Земли за пределами Италии: путь начинается не здесь, итальянские войны, гонцы и проповедники сюда не заходят,
// а на атласе у каждой — свой лист.
const FOREIGN_REGIONS = ['helvetia', 'carantania', 'provence', 'languedoc'];

// Группы регионов для бестиария.
const REGION_GROUPS = {
  north: ['alps', 'piedmont', 'liguria', 'lombardy', 'veneto', 'friuli', 'emilia'],
  center: ['tuscany', 'papal', 'abruzzo'],
  south: ['campania', 'apulia', 'calabria', 'sicily'],
  isles: ['sardinia', 'corsica'],
};
REGION_GROUPS.mainland = [...REGION_GROUPS.north, ...REGION_GROUPS.center, ...REGION_GROUPS.south];

// Опорные точки для разбиения материка на регионы (ближайшая точка).
/** @type {[string, number, number][]} */
const REGION_ANCHORS = [
  ['piedmont', 7.7, 44.9], ['liguria', 8.9, 44.35], ['liguria', 9.8, 44.15], ['lombardy', 9.6, 45.4],
  ['veneto', 11.7, 45.5], ['friuli', 13.1, 46.0], ['emilia', 11.2, 44.6], ['emilia', 12.2, 44.2],
  ['tuscany', 11.0, 43.4], ['tuscany', 10.6, 43.9], ['papal', 12.8, 43.2], ['papal', 12.5, 42.1],
  ['papal', 13.4, 43.6], ['abruzzo', 13.9, 42.2], ['campania', 14.6, 40.9], ['campania', 14.3, 41.3],
  ['apulia', 16.3, 41.0], ['apulia', 15.6, 41.5], ['apulia', 17.9, 40.3], ['calabria', 16.2, 39.3],
  ['calabria', 15.9, 38.5], ['calabria', 16.0, 40.2],
];
