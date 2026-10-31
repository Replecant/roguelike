'use strict';

// ─── Тайная наука: герметизм ───────────────────────────────────────
// Учёная магия XIII века — астральная и талисманная (Изумрудная скрижаль,
// «Асклепий», Сабит ибн Курра «О талисманах»; «Пикатрикс» по-арабски).
// Не огненные шары, а звёзды, планетарные часы и печати на металле.
// Учат двое: магистр Феодор Антиохийский, философ и звездочёт императора
// (при дворе Фридриха II), и сарацинский мудрец в Лючере. Нужна грамота.
// Ресурса нет: цена — время, усталость, травы, серебро — и благочестие:
// Церковь видит в этом бесовство, святые Михаил и Бенедикт — нарушение обета.
//
// Талисманы планет гравируют на металле планеты в её день и её час, при ясном
// небе — и только зная печать этой планеты: печати учат учителя (каждый свои),
// продают за большие деньги, а иные есть лишь в старых трактатах (свитки).
// Носят в слоте реликвии; набожный, увидев, осудит.
// Операции — короткие действия: свет, печать на ночлег, узы, вопрос звёздам.

const PLANETS = {
  saturn:  { name: 'Сатурн', gen: 'Сатурна', sign: '♄', metal: 'свинец', cost: 25, color: '#9a9ab4', effect: 'защита +1', item: { armor: 1 } },
  jupiter: { name: 'Юпитер', gen: 'Юпитера', sign: '♃', metal: 'олово', cost: 40, color: '#c8a0f0', effect: 'слава растёт на четверть быстрее', item: { fameBonus: 0.25 } },
  mars:    { name: 'Марс', gen: 'Марса', sign: '♂', metal: 'железо', cost: 25, color: '#e06040', effect: 'урон +1', item: { dmgBonus: 1 } },
  sun:     { name: 'Солнце', gen: 'Солнца', sign: '☉', metal: 'золото', cost: 180, color: '#f0c040', effect: 'Живучесть +1', item: { stats: { con: 1 } } },
  venus:   { name: 'Венера', gen: 'Венеры', sign: '♀', metal: 'медь', cost: 40, color: '#60c890', effect: 'купцы уступают в цене', item: { price: 0.92 } },
  mercury: { name: 'Меркурий', gen: 'Меркурия', sign: '☿', metal: 'ртуть', cost: 70, color: '#80b0e0', effect: 'Мудрость +1', item: { stats: { wis: 1 } } },
  moon:    { name: 'Луна', gen: 'Луны', sign: '☾', metal: 'серебро', cost: 90, color: '#d8dce8', effect: 'ночью видно дальше (+2)', item: { nightSight: 2 } },
};
// Халдейский порядок: так планеты сменяют друг друга по часам.
const CHALDEAN = ['saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury', 'moon'];
// Владыка дня недели (0 — воскресенье).
const DAY_RULER = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn'];

// Талисманы — обычные реликвии (грех носить).
for (const [k, pl] of Object.entries(PLANETS))
  ITEMS['talisman_' + k] = { kind: 'relic', name: `Талисман ${pl.gen}`, ...pl.item, pagan: true, value: 40 + pl.cost, w: 0, tier: 0,
    note: `${pl.sign} печать ${pl.gen} на пластине (${pl.metal}): ${pl.effect}. Носить — грех в глазах Церкви` };

// Планетарный час: день (от восхода до заката) и ночь делятся на 12 неравных часов;
// первый час дня принадлежит владыке дня, дальше — по халдейскому порядку.
function planetHourAt(abs = G.minutes) {
  const total = START_MINUTE + abs, day = Math.floor(total / 1440) + 1, h = (total % 1440) / 60;
  const dt = dateOfDay(day), { rise, set } = sunTimes(dt);
  let base = dt, idx, start, len;
  if (h >= rise && h < set) { len = (set - rise) / 12; idx = Math.floor((h - rise) / len); start = rise + idx * len; }
  else {
    if (h < rise) base = dateOfDay(day - 1);
    // Ночь — от заката base-дня до восхода следующего.
    const s = sunTimes(base), next = sunTimes(dateOfDay(base === dt ? day + 1 : day));
    const nlen = (24 - s.set + next.rise) / 12, since = h >= s.set ? h - s.set : h + 24 - s.set;
    len = nlen; idx = 12 + Math.floor(since / nlen); start = (s.set + (idx - 12) * nlen) % 24;
  }
  const planet = CHALDEAN[(CHALDEAN.indexOf(DAY_RULER[base.wd]) + idx) % 7];
  return { planet, night: idx >= 12, start, end: (start + len) % 24 };
}

// Ближайшие часы: [{planet, start}] на сутки вперёд.
function planetSchedule(hours = 12) {
  const out = [];
  let last = null;
  for (let m = 0; m < 26 * 60 && out.length < hours; m += 5) {
    const ph = planetHourAt(G.minutes + m);
    if (last && ph.planet === last.planet && Math.round(ph.start * 60) === Math.round(last.start * 60)) continue;
    last = ph;
    out.push({ ...ph, inMin: m });
  }
  return out;
}

// Видно ли небо: снаружи и без туч.
function skyClear() {
  if (G.mode === 'local' && G.world && G.world.kind === 'dungeon') return false;
  return ['clear', 'heat'].includes(G.weather ? G.weather.kind : 'clear');
}

const knowsHermetic = (p = G.player) => !!p.hermetic;
const knowsSeal = (k, p = G.player) => !!(p.seals && p.seals[k]);
function learnSeal(k, how) {
  const p = G.player;
  p.seals = p.seals || {};
  if (p.seals[k]) return false;
  p.seals[k] = true;
  log(`Ты знаешь печать ${PLANETS[k].gen} ${PLANETS[k].sign}${how ? ` (${how})` : ''}.`, C.violet);
  return true;
}
// Чьи печати: учитель даёт две при посвящении и продаёт ещё одну; Венера — только в трактатах.
const TEACHER_SEALS = { theodore: { gives: ['sun', 'mercury'], sells: 'jupiter' }, sage: { gives: ['saturn', 'mars'], sells: 'moon' } };
const SEAL_PRICE = 180;
// День планеты: её день недели.
const planetDay = k => DAY_RULER.indexOf(k);
function hermeticChance(base) { return Math.min(0.97, base + skillLevel(G.player, 'hermetic') * 0.07); }

// Грех: Церковь и святые этого не прощают.
function hermeticSin(n, what) {
  const p = G.player;
  addPiety(-n, what);
  if (p.patron === 'michael' || p.patron === 'benedict') breakTaboo('Тайная наука звёзд.');
}

// ─── Талисман ──────────────────────────────────────────────────────

function engraveTalisman(k) {
  const p = G.player, pl = PLANETS[k], ph = planetHourAt();
  if (!knowsHermetic(p)) return 'Ты не знаешь, как это делается.';
  if (!knowsSeal(k)) return `Печати ${pl.gen} ты не знаешь: ни знаков, ни имён духов. Её ищут у учёных людей и в старых книгах.`;
  if (today().wd !== planetDay(k) || ph.planet !== k)
    return `Печать ${pl.gen} режут в день ${pl.gen} (${WEEKDAYS[planetDay(k)]}) и в час ${pl.gen}. Сейчас ${WEEKDAYS[today().wd]}, час ${PLANETS[ph.planet].gen}.`;
  if (!skyClear()) return G.mode === 'local' && G.world.kind === 'dungeon' ? 'Под землёй не видно неба.' : 'Небо затянуто — звёзд не видно, сила не сойдёт.';
  if (dangerNear()) return 'Рядом опасность — не до звёзд.';
  const price = pl.cost;
  if (p.coins < price) return `Нужен металл — ${pl.metal}: это ${coins(price)}.`;
  p.coins -= price;
  passTime(60);
  hermeticSin(1, 'Ты резал языческую печать.');
  if (!rng.chance(hermeticChance(0.4))) {
    trainSkill(p, 'hermetic', 2);
    return `Резец сорвался — линия легла криво, печать мертва. ${cap1(pl.metal)} испорчен.`;
  }
  trainSkill(p, 'hermetic', 5);
  p.bag.push(makeItem('talisman_' + k));
  log(`Готов талисман ${pl.gen}. Надеть — в снаряжении (I).`, C.gold);
  return `Ты режешь на пластине знак ${pl.sign} и имена духов ${pl.gen}, читая слова из книги. В конце часа металл будто теплеет в ладони. Талисман готов.`;
}
const cap1 = s => s[0].toUpperCase() + s.slice(1);

// ─── Операции ──────────────────────────────────────────────────────

const OPERATIONS = {
  lumen: { name: 'Свет Солнца', teacher: 'theodore', herb: 'stjohn', fatigue: 8, time: 10,
    desc: 'шесть часов вокруг тебя светло, как от факела (+3 света)' },
  stars: { name: 'Вопросить звёзды', teacher: 'theodore', herb: null, fatigue: 5, time: 60, night: true,
    desc: 'ночью при ясном небе: звёзды укажут скрытое неподалёку — тайник, логово, гробницу' },
  seal:  { name: 'Печать Сатурна', teacher: 'sage', herb: 'rue', fatigue: 12, time: 30,
    desc: 'полсуток звери и разбойники обходят тебя стороной: в пути и на ночлеге' },
  bind:  { name: 'Узы Марса', teacher: 'sage', herb: 'wormwood', fatigue: 10, time: 0, local: true,
    desc: 'ближайший зверь скован на 6 ходов; нечисть противится' },
};
const knowsOp = (id, p = G.player) => !!(p.hermeticOps && p.hermeticOps[id]);

function doOperation(id) {
  const p = G.player, op = OPERATIONS[id];
  if (!knowsOp(id)) return 'Этой операции ты не знаешь.';
  if (op.local && G.mode !== 'local') return 'Здесь не на кого.';
  if (op.night && (!isNight() || !skyClear())) return 'Звёзды спрашивают ночью, при ясном небе.';
  if (id === 'stars' && p.starsDay === timeInfo().day) return 'Звёзды уже ответили этой ночью. Дважды не спрашивают.';
  if (op.herb && reagentCount(p, herbId(op.herb)) < 1) return `Нужна трава: ${HERBS[op.herb].name.toLowerCase()}.`;
  if (p.fatigue > 85) return 'Ты слишком устал — слова путаются.';
  let target = null;
  if (id === 'bind') {
    const near = visibleBeasts().filter(m => dist(m, p) <= 6 && !m.fleeing);
    target = near.find(m => beastMode(m) !== 'flee') || near[0];
    if (!target) return 'Рядом нет зверя.';
  }
  if (op.herb) takeReagent(p, herbId(op.herb));
  p.fatigue = Math.min(100, p.fatigue + op.fatigue);
  if (op.time) passTime(op.time);
  hermeticSin(1, 'Ты творил языческие заклинания.');
  if (!rng.chance(hermeticChance(0.6))) {
    trainSkill(p, 'hermetic', 1);
    if (G.mode === 'local') endTurn();
    return 'Слова сказаны, знаки начертаны — но ничего не происходит. Сила не сошла.';
  }
  trainSkill(p, 'hermetic', 3);
  let text = '';
  switch (id) {
    case 'lumen':
      p.lumenUntil = G.minutes + 360;
      text = 'Ты чертишь в воздухе знак Солнца — и вокруг разливается ровный золотистый свет. Тени отступают.';
      break;
    case 'seal':
      G.wardUntil = Math.max(G.wardUntil || 0, G.minutes + 720);
      text = 'Ты обводишь стоянку свинцовой палочкой и ставишь знак ♄ на четыре стороны света. Воздух тяжелеет: всякая тварь обойдёт это место.';
      break;
    case 'bind':
      if (target.def.unholy && rng.chance(0.5)) { text = `${target.name} шипит и рвёт узы — нечисть противится знаку Марса.`; break; }
      target.boundTurn = G.turn + 6;
      text = `Ты называешь имя духа Марса и указываешь на ${lower(target.name)}. Тварь застывает, будто скованная невидимой цепью.`;
      break;
    case 'stars': {
      p.starsDay = timeInfo().day;
      text = starsAnswer();
      break;
    }
  }
  log(`${op.name}: ${text}`, C.violet);
  if (G.mode === 'local' && id === 'bind') endTurn();
  return text;
}

// Ответ звёзд: ближайшее скрытое — слух, гробница, логово.
function starsAnswer() {
  const p = G.player, day = timeInfo().day;
  const lead = (G.leads || []).filter(l => !l.known && !l.done && l.until >= day)
    .sort((a, b) => Math.hypot(a.x - G.ox, a.y - G.oy) - Math.hypot(b.x - G.ox, b.y - G.oy))[0];
  if (lead && Math.hypot(lead.x - G.ox, lead.y - G.oy) < 40) {
    lead.known = true;
    p.rumors = p.rumors || [];
    p.rumors.unshift({ kind: 'lead', text: lead.rumor, lead: lead.id, title: `${lead.name}: ${lead.anchor}`, day, source: 'ответ звёзд' });
    return `Ты долго смотришь на небо, сверяясь с таблицами. Звёзды складываются в ответ: ${lead.name.toLowerCase()}, близ ${lead.anchor}.`;
  }
  const tomb = G.over.sites.filter(s => s.hidden && s.dungeon).sort((a, b) => Math.hypot(a.x - G.ox, a.y - G.oy) - Math.hypot(b.x - G.ox, b.y - G.oy))[0];
  if (tomb && Math.hypot(tomb.x - G.ox, tomb.y - G.oy) < 30) {
    const dx = tomb.x - G.ox, dy = tomb.y - G.oy, km = Math.round(Math.hypot(dx * GEO.kmX, dy * GEO.kmY));
    return `Сатурн, владыка мёртвых, стоит в доме смерти: где-то ${compassWord(dx, dy)} отсюда, километрах в ${km}, под землёй спит древнее.`;
  }
  return 'Звёзды молчат: поблизости нет ничего скрытого. Или ты плохо спросил.';
}
function compassWord(dx, dy) {
  const a = Math.atan2(-dy, dx) * 180 / Math.PI, dirs = ['на восток', 'на северо-восток', 'на север', 'на северо-запад', 'на запад', 'на юго-запад', 'на юг', 'на юго-восток'];
  return dirs[(Math.round(a / 45) + 8) % 8];
}

// ─── Учителя ───────────────────────────────────────────────────────

ROLES.magus = { title: 'Звездочёт', glyph: '@', color: '#a0b0ff', female: 0 };
GREETINGS.magus = ['Звёзды сегодня ясны. Чего ты хочешь?'];
const HERMETIC_TEACHERS = {
  theodore: { name: 'Феодор Антиохийский', title: 'Магистр, философ императора', price: 150,
    greeting: 'Ты пришёл к звездочёту императора. Говори — но коротко: Марс сегодня в неблагоприятном доме, и я тороплюсь закончить таблицы.',
    lore: [
      'Я учился в Мосуле и Багдаде — у тех, кто читает Птолемея по-арабски. Здесь меня зовут философом. В Лионе, полагаю, зовут иначе.',
      '«Что внизу, то и вверху» — так сказано на Изумрудной скрижали Гермеса. Звёзды пишут, металлы и травы отвечают. Надо лишь знать язык.',
      'До меня звездочётом императора был Майкл Скот. Он предсказал себе смерть от камня — и носил железный шлем. Камень упал, когда он снял шлем в церкви.',
      'Я перевёл для императора книгу араба Моамина о соколах. А ещё варю ему сиропы из фиалок и розы — от меланхолии. Философия — дело широкое.',
    ] },
  sage: { name: 'Абу-ль-Касим ас-Сикилли', title: 'Мудрец из Лючеры', price: 120,
    greeting: 'Мир тебе. Сядь, выпей воды. Ты пришёл спросить о звёздах — или о том, что стоит за ними?',
    lore: [
      'Сабит ибн Курра из Харрана писал: образ, вырезанный в верный час, принимает силу звезды, как воск принимает печать.',
      'Франки думают, что мы колдуем. Мы считаем. Звёзды движутся по числам — Аллах сотворил мир мерой и весом.',
      'Наша книга зовётся «Цель мудреца». Франки, говорят, хотят перевести её в Толедо. Пусть переводят — понять её им будет труднее.',
    ] },
};
HISTORIC['Феодор Антиохийский'] = {
  full: 'Феодор Антиохийский (Теодор Философ)', years: 'ок. 1195 — ок. 1250',
  text: 'Христианин из Антиохии, учился в Мосуле и Багдаде. С 1230-х — философ и астролог при дворе Фридриха II, '
    + 'преемник Майкла Скота. Переводил с арабского на латынь (трактат Моамина о соколиной охоте), переписывался '
    + 'с Леонардо Пизанским, готовил для императора лекарства и сиропы. Был с Фридрихом под Пармой.',
};

// Где учитель: Феодор — при императоре (Виттория, после её падения — Кремона); мудрец — в Лючере.
function teacherHere(city) {
  if (city.id === 'lucera') return 'sage';
  if (city.siege === 'vittoria' && parmaSiege()) return 'theodore';
  if (city.id === 'cremona' && !parmaSiege()) return 'theodore';
  return null;
}

function hermeticEnter(world, city) {
  const t = teacherHere(city), v = world.villages[0];
  if (!v) return;
  // Ушёл (двор переехал) — убрать.
  for (const n of v.npcs.filter(n => n.teacher && n.teacher !== t)) {
    v.npcs = v.npcs.filter(x => x !== n);
    world.actors = world.actors.filter(x => x !== n);
  }
  if (!t || v.npcs.some(n => n.teacher === t)) return;
  const T0 = HERMETIC_TEACHERS[t], home = { x: v.cx - 6, y: v.cy - 3, w: 13, h: 7, building: -1 };
  const spot = findFreeIn(world, home);
  if (!spot) return;
  const npc = makeNpc('magus', v, home, spot[0], spot[1]);
  Object.assign(npc, { name: T0.name, title: T0.title, teacher: t, female: false, greeting: T0.greeting, special: 'teacher',
    portrait: t === 'sage' ? 'saracen_healer_m' : null });
  v.npcs.push(npc);
  world.actors.push(npc);
}

function teacherOptions(npc) {
  const p = G.player, T0 = HERMETIC_TEACHERS[npc.teacher];
  const opts = [{ label: 'Что нового?', act: () => newsReply(npc) },
    { label: 'Расскажи о звёздах', act: () => `«${rng.pick(T0.lore)}»` }];
  const mine = Object.keys(OPERATIONS).filter(id => OPERATIONS[id].teacher === npc.teacher && !knowsOp(id));
  if (!knowsHermetic(p)) {
    const price = p.priceBuy(T0.price);
    opts.push({ label: `Научи меня тайной науке (${price} мон.)`, act: () => {
      if (p.stats.wis < 7) return '«Звёзды говорят с тем, кто умеет слушать. Ты пока умеешь только смотреть». (Нужна Мудрость 7.)';
      if (skillLevel(p, 'letters') < 2) return '«Ты едва разбираешь буквы. Здесь читают Птолемея и Сабита ибн Курру — по-латыни и по-арабски. Выучись грамоте как следует, тогда приходи».';
      if (p.coins < price) return `«Книги и таблицы стоят дорого — ${coins(price)}».`;
      p.coins -= price;
      passTime(8 * 60);
      p.hermetic = true;
      p.hermeticOps = p.hermeticOps || {};
      for (const id of mine) p.hermeticOps[id] = true;
      for (const k of TEACHER_SEALS[npc.teacher].gives) learnSeal(k);
      readScrolls();
      p.skills.hermetic = p.skills.hermetic || { lvl: 0, xp: 0 };
      p.skills.hermetic.lvl = Math.max(1, p.skills.hermetic.lvl);
      hermeticSin(3, 'Ты взялся за запретную науку.');
      chronicle(`${T0.name} открыл тайную науку звёзд.`, 'level');
      return '«Слушай. Семь планет, семь металлов, семь дней. Каждый день и каждую ночь делят на двенадцать часов, и каждым часом правит своя планета — '
        + 'по халдейскому порядку: Сатурн, Юпитер, Марс, Солнце, Венера, Меркурий, Луна. Печать режут в день её планеты и в её час, при ясном небе, иначе металл мёртв». '
        + `Весь день вы сидите над таблицами. К ночи ты знаешь печати ${TEACHER_SEALS[npc.teacher].gives.map(k => PLANETS[k].gen).join(' и ')} `
        + `и две операции: ${mine.map(id => OPERATIONS[id].name.toLowerCase()).join(' и ')}. «Остальные печати — у других учёных людей и в книгах, которые не всякому показывают».`;
    } });
  }
  if (knowsHermetic(p)) {
    // Чужие печати, которые этот учитель даёт при посвящении, — тому, кто учился у другого.
    for (const k of TEACHER_SEALS[npc.teacher].gives.filter(k => !knowsSeal(k))) {
      const price = p.priceBuy(SEAL_PRICE);
      opts.push({ label: `Открой печать ${PLANETS[k].gen} ${PLANETS[k].sign} (${price} мон.)`, act: () => sealSale(npc, k, price) });
    }
    const k = TEACHER_SEALS[npc.teacher].sells;
    if (!knowsSeal(k)) {
      const price = p.priceBuy(SEAL_PRICE + 60);
      opts.push({ label: `Открой печать ${PLANETS[k].gen} ${PLANETS[k].sign} (${price} мон.)`, act: () => sealSale(npc, k, price) });
    }
  }
  if (knowsHermetic(p) && mine.length) {
    const price = p.priceBuy(Math.round(T0.price / 2));
    opts.push({ label: `Научи своим операциям (${price} мон.)`, act: () => {
      if (p.coins < price) return `«${coins(price)}. Знание не раздают на площади».`;
      p.coins -= price;
      passTime(4 * 60);
      for (const id of mine) p.hermeticOps[id] = true;
      trainSkill(p, 'hermetic', 6);
      return `«У каждого учителя свои тайны». До вечера ты учишь: ${mine.map(id => OPERATIONS[id].name.toLowerCase()).join(' и ')}.`;
    } });
  }
  opts.push({ label: 'Уйти', act: () => null });
  return opts;
}

function sealSale(npc, k, price) {
  const p = G.player;
  if (skillLevel(p, 'hermetic') < 2) return '«Рано тебе. Сперва набей руку на тех печатях, что знаешь»'+ ' (нужна герметика 2).';
  if (p.coins < price) return `«${coins(price)}. Эту печать я сам выменял на год жизни».`;
  p.coins -= price;
  passTime(120);
  learnSeal(k, 'от учителя');
  return `Учитель чертит на воске знак ${PLANETS[k].sign}, называет имена духов ${PLANETS[k].gen} и заставляет повторить их семь раз. «Металл — ${PLANETS[k].metal}. День — ${WEEKDAYS[planetDay(k)]}. Не перепутай».`;
}

// ─── Окно тайной науки ─────────────────────────────────────────────

class HermeticScreen {
  constructor() { this.overlay = false; this.sel = 0; this.msg = ''; }
  key(k) {
    const d = digitOf(k);
    if (isEsc(k) || k.code === 'KeyZ') return popScreen();
    if (d && d <= 7) { this.sel = d - 1; this.msg = engraveTalisman(CHALDEAN[d - 1]); }
  }
  render(t) {
    const ph = planetHourAt();
    t.print(2, 1, 'Тайная наука', C.gold);
    t.print(2, 3, `Сейчас час ${PLANETS[ph.planet].gen}. Небо: ${skyClear() ? 'ясное' : 'закрыто'}.`, C.text);
    t.printWrap(2, 5, 90, this.msg, C.dim);
  }
}

HermeticScreen.prototype.winClass = 'hermetic';
HermeticScreen.prototype.html = function () {
  const p = G.player, ph = planetHourAt(), clear = skyClear(), known = knowsHermetic(p);
  const planets = CHALDEAN.map((k, i) => {
    const pl = PLANETS[k], now = ph.planet === k && today().wd === planetDay(k), seal = knowsSeal(k);
    return `<div class="planet${now ? ' now' : ''}" style="--c:${pl.color}">
      <div class="ph"><span class="sg">${pl.sign}</span><b>${pl.name}</b><span class="dim">${pl.metal} · ${coins(pl.cost)}</span></div>
      <div class="eff">${seal ? esc(pl.effect) + ` · <span class="dim">${WEEKDAYS[planetDay(k)]}</span>` : '<span class="dim">печать неизвестна</span>'}</div>
      ${known && seal ? `<button class="btn${now && clear ? ' main' : ''}" data-act="engrave" data-k="${k}"${now ? '' : ' disabled'}><kbd>${i + 1}</kbd>${now ? 'Резать печать' : 'не его время'}</button>` : ''}
    </div>`;
  }).join('');
  const ops = !known ? '<div class="dim pad">Ты не посвящён в тайную науку.</div>'
    : Object.entries(OPERATIONS).filter(([id]) => knowsOp(id)).map(([id, op]) => `<div class="op">
      <div class="rh"><b>${esc(op.name)}</b><span class="dim">${op.herb ? esc(HERBS[op.herb].name.toLowerCase()) + ' · ' : ''}усталость ${op.fatigue}</span></div>
      <div class="eff dim">${esc(op.desc)}</div><button class="btn" data-act="op" data-id="${id}">Совершить</button></div>`).join('')
      || '<div class="dim pad">Операций ты не знаешь.</div>';
  const sched = planetSchedule(10).map((h, i) => `<div class="hr${i === 0 ? ' now' : ''}"><span class="t">${hhmm(h.start)}</span>`
    + `<span style="color:${PLANETS[h.planet].color}">${PLANETS[h.planet].sign} ${PLANETS[h.planet].name}</span><span class="dim">${h.night ? 'ночь' : 'день'}</span></div>`).join('');
  const status = [p.lumenUntil > G.minutes && 'светло (Солнце)', G.wardUntil > G.minutes && 'под печатью'].filter(Boolean).join(' · ');
  return winHead('Тайная наука', `Час ${PLANETS[ph.planet].gen} ${PLANETS[ph.planet].sign} · небо ${clear ? 'ясное' : 'закрыто'}`
      + (known ? ` · герметика <b>${skillLevel(p, 'hermetic')}</b>` : '') + (status ? ` · ${status}` : ''))
    + `<div class="herm-body">
      <section class="herm-col"><div class="sect">Планеты и печати</div><div class="planets" data-scroll="pl">${planets}</div></section>
      <section class="herm-col"><div class="sect">Операции</div><div class="ops" data-scroll="ops">${ops}</div>
        ${this.msg ? `<div class="alc-msg">${esc(this.msg)}</div>` : ''}</section>
      <section class="herm-col"><div class="sect">Часы планет</div><div class="sched">${sched}</div></section>
    </div>`
    + keys([['1–7', 'резать печать планеты'], ['клик', 'действие'], ['Esc', 'закрыть']]);
};
HermeticScreen.prototype.act = function (a, d) {
  if (a === 'engrave') this.msg = engraveTalisman(d.k);
  else if (a === 'op') this.msg = doOperation(d.id);
};
