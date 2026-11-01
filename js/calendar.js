'use strict';

// ─── Календарь ─────────────────────────────────────────────────────
// Юлианский календарь: путь начинается 1 июля 1247 года — император
// только что встал под стенами отпавшей Пармы (осада — до 18 февраля 1248). Дни недели, праздники (неподвижные и пасхальный круг),
// времена года и долгота дня считаются по настоящей дате.

const CAL_START = { y: 1247, m: 7, d: 1 };

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const WEEKDAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

function julianToJdn(y, m, d) {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - 32083;
}

function jdnToJulian(jdn) {
  const c = jdn + 32082, d = Math.floor((4 * c + 3) / 1461), e = c - Math.floor(1461 * d / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return { y: d - 4800 + Math.floor(m / 10), m: m + 3 - 12 * Math.floor(m / 10), d: e - Math.floor((153 * m + 2) / 5) + 1 };
}

const CAL_JDN0 = julianToJdn(CAL_START.y, CAL_START.m, CAL_START.d);

// Пасха по юлианской пасхалии.
function easter(y) {
  const a = y % 4, b = y % 7, c = y % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
  return { m: Math.floor((d + e + 114) / 31), d: ((d + e + 114) % 31) + 1 };
}

// Дата по номеру дня пути (1 — первый день).
function dateOfDay(day) {
  const jdn = CAL_JDN0 + day - 1, dt = jdnToJulian(jdn);
  dt.wd = (jdn + 1) % 7;
  dt.jdn = jdn;
  dt.doy = jdn - julianToJdn(dt.y, 1, 1);
  return dt;
}

function today() { return dateOfDay(timeInfo().day); }

function dateText(dt, withWeekday = true) {
  return `${dt.d} ${MONTHS_GEN[dt.m - 1]} ${dt.y}${withWeekday ? `, ${WEEKDAYS_SHORT[dt.wd]}` : ''}`;
}

function roman(n) {
  /** @type {[number, string][]} */
  const R = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of R) while (n >= v) { s += r; n -= v; }
  return s;
}

// ─── Праздники ─────────────────────────────────────────────────────
// major — служат мессу, как в воскресенье; saint — день святого покровителя.

const FEASTS = [
  { m: 1, d: 1, name: 'Обрезание Господне', major: true },
  { m: 1, d: 6, name: 'Богоявление', major: true },
  { m: 2, d: 2, name: 'Сретение (Candelora)', major: true, text: 'Освящают свечи — от грозы, хвори и дурного глаза.' },
  { m: 3, d: 21, name: 'День святого Бенедикта', saint: 'benedict' },
  { m: 3, d: 25, name: 'Благовещение', major: true },
  { m: 4, d: 23, name: 'День святого Георгия', saint: 'george' },
  { m: 5, d: 8, name: 'Явление архангела Михаила на Гаргано', saint: 'michael' },
  { m: 5, d: 9, name: 'Перенесение мощей святого Николая в Бари', saint: 'nicholas' },
  { m: 6, d: 13, name: 'День святого Антония', saint: 'antony' },
  { m: 6, d: 24, name: 'Рождество Иоанна Крестителя', major: true, text: 'Ночь на Ивана — травы сильнее всего, а ведьмы слетаются к ореху Беневенто.' },
  { m: 6, d: 29, name: 'День апостолов Петра и Павла', major: true },
  { m: 7, d: 11, name: 'Перенесение мощей святого Бенедикта', saint: 'benedict' },
  { m: 7, d: 25, name: 'День святого Христофора', saint: 'christopher' },
  { m: 8, d: 15, name: 'Успение Богородицы (Феррагосто)', major: true, text: 'Жара, ярмарки и крестные ходы.' },
  { m: 9, d: 29, name: 'День архангела Михаила', saint: 'michael' },
  { m: 10, d: 4, name: 'День святого Франциска', saint: 'francis' },
  { m: 11, d: 1, name: 'День всех святых', major: true },
  { m: 11, d: 2, name: 'Поминовение усопших', major: true, text: 'В эту ночь мёртвые ходят среди живых. Нечисти вдвое больше.' },
  { m: 12, d: 6, name: 'День святого Николая', saint: 'nicholas' },
  { m: 12, d: 25, name: 'Рождество Христово', major: true, text: 'Кто родился в Рождественскую ночь, тот станет лупо маннаро.' },
];

// Подвижные праздники года — от Пасхи.
function movableFeasts(y) {
  const e = easter(y), ej = julianToJdn(y, e.m, e.d), at = (off, f) => ({ ...jdnToJulian(ej + off), ...f });
  return [
    at(-46, { name: 'Пепельная среда — начало Великого поста', text: 'Сорок дней поста: ни мяса, ни свадеб, ни плясок.' }),
    at(-7, { name: 'Вербное воскресенье', major: true }),
    at(-2, { name: 'Страстная пятница', major: true }),
    at(0, { name: 'Пасха', major: true, text: 'Колокола звонят весь день; на Пасху молитва сильнее.' }),
    at(49, { name: 'Пятидесятница', major: true }),
  ];
}

function feastsOn(dt) {
  return FEASTS.concat(movableFeasts(dt.y)).filter(f => f.m === dt.m && f.d === dt.d);
}

function isLent(dt = today()) {
  const e = easter(dt.y), ej = julianToJdn(dt.y, e.m, e.d);
  return dt.jdn >= ej - 46 && dt.jdn < ej;
}

// Сегодня служат мессу: воскресенье или большой праздник.
function isMassDay(dt = today()) {
  return dt.wd === 0 || feastsOn(dt).some(f => f.major || f.saint);
}

// Ближайшие праздники (включая сегодняшний).
function upcomingFeasts(n = 6) {
  const out = [], day0 = timeInfo().day;
  for (let k = 0; k < 400 && out.length < n; k++) {
    const dt = dateOfDay(day0 + k);
    for (const f of feastsOn(dt)) out.push({ ...f, dt, inDays: k });
  }
  return out;
}

// ─── Времена года и долгота дня ────────────────────────────────────

const SEASONS = {
  winter: { name: 'зима', icon: '❄', color: '#b0c8e0' },
  spring: { name: 'весна', icon: '♣', color: '#80c060' },
  summer: { name: 'лето', icon: '☼', color: '#e0b040' },
  autumn: { name: 'осень', icon: '♠', color: '#c08040' },
};

function seasonOf(dt = today()) {
  const m = dt.m;
  return m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn';
}

// Восход и закат (часы) для широты Италии.
function sunTimes(dt = today()) {
  const len = 12 + 3.1 * Math.cos(2 * Math.PI * (dt.doy - 172) / 365);
  return { rise: 12.2 - len / 2, set: 12.2 + len / 2 };
}

function hhmm(h) {
  const m = Math.round(h * 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

// Звери по временам года: множители веса.
const SEASON_BEASTS = {
  winter: { viper: 0, tarantula: 0, bear: 0, wolf: 2, wild_dog: 1.5, bat: 0.3 },
  spring: { viper: 1.3, bear: 1.3 },
  summer: { tarantula: 2, viper: 1.5 },
  autumn: { boar: 1.6, wolf: 1.3 },
};

function seasonBeastMult(key) {
  const k = SEASON_BEASTS[seasonOf()][key];
  return k === undefined ? 1 : k;
}

// Цены по сезону: зерно дёшево после жатвы, вино — после сбора винограда.
const SEASON_PRICES = {
  grain: { 4: 1.25, 5: 1.3, 6: 1.15, 8: 0.8, 9: 0.8, 10: 0.85 },
  wine: { 6: 1.15, 7: 1.2, 8: 1.2, 10: 0.85, 11: 0.85 },
  oil: { 11: 0.85, 12: 0.85, 1: 0.9, 7: 1.15 },
};

function seasonPriceMult(id) {
  const t = SEASON_PRICES[id];
  return (t && t[today().m]) || 1;
}

// Горы и Альпы зимой.
function seasonTravelMult(ow, x, y) {
  const s = seasonOf(), t = ow.get(x, y), road = ow.road[ow.idx(x, y)] >= 0;
  if (s !== 'winter') return 1;
  if (t === OT.MOUNT || t === OT.PEAK) return road ? 1.4 : 1.9;
  if (t === OT.PINE || t === OT.HILL) return road ? 1.1 : 1.3;
  return 1;
}

// Зимой альпийские перевалы вне дорог засыпаны снегом.
function winterBlocked(ow, x, y) {
  const dt = today();
  if (seasonOf(dt) !== 'winter' || ow.road[ow.idx(x, y)] >= 0) return false;
  return ['alps', ...FOREIGN_REGIONS].includes(ow.regionAt(x, y)) && (ow.get(x, y) === OT.MOUNT || ow.get(x, y) === OT.PEAK);
}

// Холодно ли тут: снег лежит на севере и в горах.
function snowyHere(x, y, onOver) {
  if (seasonOf() !== 'winter') return false;
  const ow = G.over;
  const ox = onOver ? x : G.ox, oy = onOver ? y : G.oy;
  const t = ow.get(ox, oy);
  if (t === OT.MOUNT || t === OT.PEAK || t === OT.PINE) return true;
  const [, lat] = xyToGeo(ox, oy);
  return ['alps', ...FOREIGN_REGIONS].includes(ow.regionAt(ox, oy)) || lat > 44.6 || (t === OT.HILL && lat > 42.5);
}

// Сезонные заботы жителей.
const SEASON_TALK = {
  winter: [
    'Зима нынче лютая. Дрова кончаются, а до весны ещё жить и жить.',
    'Перевалы в Альпах замело — купцы из Германии до весны не придут.',
    'Волки к самым загонам подходят. Зимой им в лесу есть нечего.',
    'Ночи длинные, а свечи дорогие. Ложимся с курами.',
  ],
  spring: [
    'Дороги развезло — по колено грязь. Пока не просохнет, купцы не поедут.',
    'Пахать пора, а у меня вол захромал. Беда.',
    'Весной змеи просыпаются. Смотри под ноги в траве.',
    'До нового урожая далеко, а зерно в амбарах кончается. Цены кусаются.',
  ],
  summer: [
    'Жара такая, что куры не несутся. В полдень даже собаки спят.',
    'Жатва! Каждая пара рук на счету — а ты тут гуляешь.',
    'В болотах лихорадка. Кто ночевал у воды — трясётся неделями.',
    'Тарантулы нынче злые. Кого укусит — пляшет, пока не упадёт.',
  ],
  autumn: [
    'Сбор винограда — вся деревня в виноградниках. Вино в этом году будет доброе.',
    'Кабаны жиреют на желудях. Самое время для охоты.',
    'Свиней режем, колбасы вялим. К зиме готовимся.',
    'Дожди зарядили. Ещё неделя — и реки выйдут из берегов.',
  ],
};
