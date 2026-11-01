'use strict';

// ─── Новости мира ──────────────────────────────────────────────────
// Каждая новость: { day, text, x, y, tag, world }. tag — о чём она:
// trade (торговля), church (церковь), war (война), common (жизнь).
// world: true — о ней говорят по всей Италии.

const REGION_IN = {
  alps: 'в Альпах', piedmont: 'в Пьемонте', liguria: 'в Лигурии', lombardy: 'в Ломбардии', veneto: 'в Марке Тревизо',
  friuli: 'во Фриули', emilia: 'в Эмилии', tuscany: 'в Тоскане', papal: 'в Папской области', abruzzo: 'в Абруццо',
  campania: 'в Кампании', apulia: 'в Апулии', calabria: 'в Калабрии', sicily: 'на Сицилии', sardinia: 'на Сардинии',
  corsica: 'на Корсике', malta: 'на Мальте', helvetia: 'в Гельвеции',
};

// Родительный падеж товаров: «нехватка соли».
const GOOD_GEN = {
  grain: 'зерна', wine: 'вина', oil: 'оливкового масла', salt: 'соли', cheese: 'сыра', wool: 'шерсти',
  cloth: 'сукна', iron: 'железа', spices: 'пряностей', silk: 'шёлка', cotton: 'хлопка', cumin: 'тмина', honey: 'мёда', hides: 'кож',
};

// Что известно в начале игры — лето 1247 года.
const HISTORY_NEWS = [
  { text: 'Император Фридрих осадил Парму, которая перешла к папской партии. Под её стенами он строит целый город — Витторию.',
    lon: 10.33, lat: 44.8, tag: 'war', world: true, age: 20 },
  { text: 'Папа Иннокентий IV сидит в Лионе и шлёт отовсюду легатов: кто поднимет оружие против императора, тому отпустятся грехи.',
    lon: 12.48, lat: 41.9, tag: 'church', world: true, age: 40 },
  { text: 'Король Франции Людовик принял крест. Говорят, на будущий год он поплывёт в Египет — и ищет корабли в Генуе.',
    lon: 8.93, lat: 44.41, tag: 'trade', world: true, age: 30 },
  { text: 'Эццелино да Романо опять казнил в Падуе знатных горожан. Тюрьмы у него, говорят, полны до самых крыш.',
    lon: 11.88, lat: 45.41, tag: 'war', age: 12 },
  { text: 'Пизанские и генуэзские галеры сцепились у Корсики. Обе стороны клянутся, что победили.',
    lon: 9.2, lat: 42.6, tag: 'war', age: 9 },
  { text: 'Татары ушли из Венгрии так же внезапно, как пришли. Никто не знает, вернутся ли.',
    lon: 13.5, lat: 46.2, tag: 'war', world: true, age: 90 },
  { text: 'Король Энцо, сын императора, собирает войска в Кремоне против гвельфов.',
    lon: 10.02, lat: 45.13, tag: 'war', age: 15 },
];

function addNews(n) {
  G.news.push(n);
  if (G.news.length > 120) G.news.shift();
}

function initNews() {
  G.news = [];
  G.events = [];
  for (const h of HISTORY_NEWS) {
    const [x, y] = geoToXY(h.lon, h.lat);
    addNews({ day: 1 - h.age, text: h.text, x, y, tag: h.tag, world: h.world });
  }
  G.newsDay = 1;
  G.leads = [];
  for (let i = 0; i < 9; i++) spawnLead();
}

// Случайные события. Возвращает новость или null.
const EVENT_MAKERS = [
  // Торговля — меняют цены.
  { w: 3, make: () => {
    const c = pickPlace(['city', 'town']), g = rng.pick(GOOD_IDS);
    addEffect(c, g, 1.7, 12);
    return { place: c, tag: 'trade', text: `В городе ${c.name} нехватка ${GOOD_GEN[g]} — цены взлетели почти вдвое.` };
  } },
  { w: 3, make: () => {
    const c = pickPlace(['city', 'town']), g = rng.pick(GOOD_IDS);
    addEffect(c, g, 0.6, 10);
    return { place: c, tag: 'trade', text: `В ${cityAcc(c.name)} пришёл большой караван, навезли ${GOOD_GEN[g]} — отдают задёшево.` };
  } },
  { w: 2, make: () => {
    // Внезапная ярмарка — настоящая (js/happenings.js): идёт три дня, начиная с сегодняшнего.
    const c = pickPlace(['city', 'town']), day = G.newsDay;
    if (!c || !addHappening('fair', c, day + 1, 'Ярмарка')) return null;
    return { place: c, tag: 'trade', text: `В ${cityLoc(c.name)} открылась ярмарка: съехались купцы со всей округи, торг идёт бойко.` };
  } },
  { w: 1, make: () => {
    const c = pickPlace(['city'], x => x.port);
    return { place: c, tag: 'trade', world: true,
      text: `Галера из города ${c.name} не вернулась из-за моря. То ли сарацинские пираты, то ли буря — товара на ней было на целое состояние.` };
  } },
  // Жизнь.
  { w: 3, make: () => {
    const v = pickPlace(['village']);
    return { place: v, tag: 'common', text: `В деревне ${v.name} лихорадка: слегли полдеревни, священник не успевает отпевать.` };
  } },
  { w: 3, make: () => {
    const v = pickPlace(['village']);
    return { place: v, tag: 'common', text: `У деревни ${v.name} волки задрали целое стадо, пастух еле ноги унёс.` };
  } },
  { w: 2, make: () => {
    const c = pickPlace(['city', 'town']);
    return { place: c, tag: 'common', text: `В городе ${c.name} пожар: выгорел целый квартал, говорят, от свечки у пекаря.` };
  } },
  { w: 2, make: () => {
    const c = pickPlace(['city', 'town']);
    return { place: c, tag: 'common', text: `В городе ${c.name} свадьба: дочь богатого суконщика выходит за рыцаря. Пир, говорят, три дня.` };
  } },
  { w: 2, make: () => {
    const c = pickPlace(['town', 'village']);
    return { place: c, tag: 'common',
      text: `${c.kind === 'village' ? 'В деревне' : 'В городе'} ${c.name} родился телёнок о двух головах. Старухи говорят — к войне.` };
  } },
  { w: 2, make: () => {
    const c = pickPlace(['town', 'city']);
    const road = nearRoad(c);
    return { place: c, tag: 'war', text: `${road ? `На дороге ${road}` : `Под городом ${c.name}`} разбойники ограбили обоз и зарезали возницу.` };
  } },
  // Нечисть.
  { w: 2, make: () => {
    const v = pickPlace(['village', 'town']);
    return { place: v, tag: 'common', text: `Возле ${v.kind === 'village' ? 'деревни' : 'города'} ${v.name} видели волка, что ходил на двух ногах. Пропал пастушонок.` };
  } },
  { w: 1, make: () => {
    const v = pickPlace(['village']);
    return { place: v, tag: 'church', text: `В деревне ${v.name} откопали покойника — а он лежит румяный, и рот в крови. Священник велел вбить кол.` };
  } },
  // Церковь.
  { w: 2, make: () => {
    const c = pickPlace(['city', 'town']);
    return { place: c, tag: 'church', text: `Умер епископ города ${c.name}. Каноники не могут договориться о преемнике, а папа далеко.` };
  } },
  { w: 2, make: () => {
    const m = pickPlace(['monastery']);
    return { place: m, tag: 'church', text: `В ${m.name.startsWith('Аббатство') ? m.name.replace('Аббатство', 'аббатстве') : `монастыре ${m.name}`} мироточит икона Богородицы. Паломники идут толпами.` };
  } },
  { w: 1, make: () => {
    const c = pickPlace(['city', 'town']);
    return { place: c, tag: 'church', text: `В ${cityAcc(c.name)} пришли инквизиторы-доминиканцы. Ищут еретиков-катаров — и, как водится, находят.` };
  } },
  // Война.
  { w: 2, make: () => {
    const a = pickPlace(['city', 'town']);
    const b = G.over.cities.filter(c => (c.kind === 'city' || c.kind === 'town') && c !== a && c.region !== a.region
      && Math.hypot(c.x - a.x, c.y - a.y) < 40 * MAP_SCALE);
    if (!b.length) return null;
    const enemy = rng.pick(b);
    return { place: a, tag: 'war', text: `Города ${a.name} и ${enemy.name} снова не поделили границу: обе коммуны собирают ополчение.` };
  } },
  { w: 1, make: () => {
    const c = pickPlace(['castle']);
    return { place: c, tag: 'war', text: `${placeTitle(c)[0].toUpperCase() + placeTitle(c).slice(1)} взяли в осаду: сеньор отказался платить подать императору.` };
  } },
];

/** @param {string[]} kinds @param {(place: any) => boolean} [extra] */
function pickPlace(kinds, extra = () => true) {
  const list = G.over.cities.filter(c => kinds.includes(c.kind) && extra(c));
  return rng.pick(list.length ? list : G.over.cities);
}

function nearRoad(c) {
  for (const [dx, dy] of DIRS8) {
    const r = G.over.inside(c.x + dx, c.y + dy) && G.over.roadAt(c.x + dx, c.y + dy);
    if (r) return r;
  }
  return null;
}

function addEffect(place, good, mult, days) {
  G.events.push({ place: place.id, good, mult, until: timeInfo().day + days });
}

// Множитель цены от событий (нехватка, караван, ярмарка).
function eventPriceMult(place, good) {
  if (!G.events) return parmaPriceMult(place, good) * happeningPriceMult(place, good) * louisPriceMult(place, good);
  const day = timeInfo().day;
  let k = 1;
  for (const e of G.events) if (e.place === place.id && (!e.good || e.good === good) && day <= e.until) k *= e.mult;
  return k * parmaPriceMult(place, good) * happeningPriceMult(place, good) * louisPriceMult(place, good);
}

// Раз в день мир живёт своей жизнью.
function worldTick() {
  if (!G.news) initNews();
  const day = timeInfo().day;
  while (G.newsDay < day) {
    G.newsDay++;
    G.events = G.events.filter(e => e.until >= G.newsDay);
    for (let k = 0; k < 2; k++) {
      if (!rng.chance(0.55)) continue;
      const ev = rng.weighted(EVENT_MAKERS).make();
      if (ev) addNews({ day: G.newsDay, text: ev.text, x: ev.place.x, y: ev.place.y, tag: ev.tag, world: ev.world });
    }
    leadsTick();
    faithDaily(G.newsDay);
    heresyDaily(G.newsDay);
    parmaDaily(G.newsDay);
    louisDaily(G.newsDay);
    happeningsDaily(G.newsDay);
    feverDaily();
    mountDaily(G.newsDay);
  }
}

// ─── Кто что знает ─────────────────────────────────────────────────

// Как далеко (в клетках карты) доходят до жителя слухи.
const NEWS_REACH = { noble: 120, knight: 60, hermit: 6, merchant: 200, boatman: 200, innkeeper: 70, elder: 45, priest: 40, guard: 35, smith: 25, herbalist: 20, peasant: 16 };
const NEWS_SPECIALTY = { noble: 'war', knight: 'war', merchant: 'trade', boatman: 'trade', innkeeper: 'trade', priest: 'church', guard: 'war' };

function knownNews(npc) {
  const place = npc.village.city, day = timeInfo().day;
  if (place.kind === 'pagan') return [];   // в глуши мирских новостей не знают
  let reach = (NEWS_REACH[npc.role] || 20) * MAP_SCALE;
  if (place.kind === 'city') reach *= 1.6;
  else if (place.kind === 'village') reach *= 0.6;
  if (place.kind === 'castle' && npc.role === 'elder') reach *= 2;
  const monk = place.kind === 'monastery';
  return G.news.filter(n => {
    if (n.lead) {
      if (isSaracen(npc) && n.tag === 'church') return false;   // о святых отшельниках в Лючере не рассказывают
      // О месте поблизости знают только окрестные жители — и только пока оно есть.
      const lead = G.leads.find(l => l.id === n.lead);
      if (!lead || lead.done || lead.until < day) return false;
      const near = (npc.role === 'innkeeper' || npc.role === 'merchant' || npc.role === 'hermit' ? 32 : npc.role === 'guard' ? 24 : 16) * MAP_SCALE / 2;
      return Math.hypot(n.x - place.x, (n.y - place.y) * 2) <= near;
    }
    if (day - n.day > 45) return false;
    const d = Math.hypot(n.x - place.x, (n.y - place.y) * 2);
    let r = reach;
    if (isSaracen(npc) && n.tag === 'church') return false;   // церковных новостей в Лючере не пересказывают
    if (NEWS_SPECIALTY[npc.role] === n.tag || (monk && n.tag === 'church') || (place.kind === 'castle' && n.tag === 'war')) r *= 3;
    if (n.world && place.kind !== 'village') r = Infinity;
    // До деревни вести доходят с опозданием.
    if (place.kind === 'village' && d > 10 * MAP_SCALE && day - n.day < 3) return false;
    return d <= r;
  });
}

function agoText(days) {
  if (days <= 0) return 'Сегодня с утра';
  if (days === 1) return 'Вчера';
  if (days < 5) return 'На днях';
  if (days < 10) return 'На той неделе';
  if (days < 25) return 'Недели две назад';
  return 'С месяц назад';
}

const NO_NEWS = {
  peasant: ['Новостей нет. Сеем, жнём, молимся — так и живём.', 'Откуда мне знать, я дальше мельницы не бывал.',
    'Ничего не слыхал. Нам бы до жатвы дожить.'],
  village: ['У нас тут тихо. Только если кто помрёт или родится.', 'Новости к нам приходят с коробейником, а он с весны не заглядывал.'],
  default: ['Ничего такого не слыхал.', 'Да вроде всё по-старому.', 'Новостей нет — и слава Богу.'],
};

// Сарацины Лючеры (content/saracens.js): свои речи и слухи.
function isSaracen(npc) { return npc.village && npc.village.city.names === 'saracen'; }
function saracenKey(npc) { return npc.role === 'priest' ? 'imam' : npc.role; }

// Сколько вестей человек расскажет за день: один — одну, болтун (трактирщик, купец,
// корабельщик) — две; красноречивому — на одну больше.
const NEWS_TALKERS = new Set(['innkeeper', 'merchant', 'boatman']);
const NEWS_DONE = [
  'Да я тебе уже всё {рассказал|рассказала}. Приходи завтра — может, что новое услышу.',
  'Больше ничего не знаю, клянусь. Спроси у трактирщика — к нему все сплетни стекаются.',
  'Хватит на сегодня. Что ещё будет — узнаешь сам в дороге.',
  'Что {знал|знала} — {сказал|сказала}. Остальное — не моё дело.',
];
// Не всякий интересуется вестями: иной живёт своим хозяйством и ничего не слышал и слышать не хочет.
// Трактирщик, купец, корабельщик, стража, священник и староста — люди при вестях; прочих равнодушен каждый третий.
const NEWS_PEOPLE = new Set(['innkeeper', 'merchant', 'boatman', 'guard', 'priest', 'elder', 'legate', 'pope', 'noble', 'knight', 'hermit']);
const NO_INTEREST = [
  'Новости? Не вникаю я в них. У меня корова телится — вот мне и вся новость.',
  'Не слежу я за этим. Кто там с кем воюет — всё одно, подать платить нам.',
  'Спроси кого другого. Мне до чужих дел дела нет — своих хватает.',
  'Не знаю и знать не хочу. От вестей одно беспокойство, а толку никакого.',
  '{Не слыхал|Не слыхала} ничего. Я с утра до ночи в работе — когда мне слушать?',
  'Что мне новости? Солнце встало — работай, село — спи. Вот и все мои вести.',
];
function newsless(npc) {
  if (NEWS_PEOPLE.has(npc.role) || ['alchemist', 'magus'].includes(npc.role) || npc.special || npc.librarian || npc.fib || npc.hap || npc.fairRole) return false;
  if (npc.newsless === undefined) npc.newsless = rng.chance(0.33);
  return npc.newsless;
}
function newsReply(npc) {
  const p = G.player, place = npc.village.city;
  if (newsless(npc)) return speak(npc, nextOf(npc, 'newsless', NO_INTEREST, 2));
  const dnow = timeInfo().day;
  if (npc.newsDay !== dnow) { npc.newsDay = dnow; npc.newsCount = 0; }
  const limit = 1 + (NEWS_TALKERS.has(npc.role) ? 1 : 0) + (skillLevel(p, 'speech') >= 3 ? 1 : 0);
  if (npc.newsCount >= limit) return speak(npc, rng.pick(NEWS_DONE));
  npc.newsCount++;
  worldTick();
  const known = knownNews(npc);
  npc.told = npc.told || new Set();
  const fresh = known.filter(n => !npc.told.has(n));
  // О своём городе в третьем лице («В Лючере поселили…») сами жители не рассказывают.
  const local = (REGION_RUMORS[place.region] || []).filter(t => !t.includes(place.name.slice(0, Math.max(4, place.name.length - 2))));
  // Старые слухи: у каждого свои два-три (у болтунов — четыре); рассказанное не повторяют.
  const lore = () => {
    const V = localVoice(place);
    const pool = V ? V.lore.concat(local, isSaracen(npc) ? V.loreMuslim || [] : [])   // у края свои слухи
      : isSaracen(npc)
      ? SARACEN_RUMORS.common.concat(local, npc.role === 'priest' ? SARACEN_RUMORS.imam : [])
      : COMMON_RUMORS.concat(local, local, ROLE_RUMORS[npc.role] || [], G.flags.parma_fallen ? PARMA_FALL_RUMORS : [], louisRumors(), louisRumors());
    const mine = repertoire(npc, 'lore', [...new Set(pool)], NEWS_TALKERS.has(npc.role) ? 4 : rng.int(2, 3));
    npc.loreTold = npc.loreTold || [];
    const left = mine.filter(t => !npc.loreTold.includes(t));
    if (!left.length) return speak(npc, rng.pick(npc.role === 'peasant' ? NO_NEWS.peasant : place.kind === 'village' ? NO_NEWS.village : NO_NEWS.default));
    const text = left[0];
    npc.loreTold.push(text);
    noteRumor(npc, { kind: 'lore', text });
    return '«' + text + '»';
  };
  const tomb = tombRumor(npc);
  if (tomb) return tomb;
  // Наводка на место поблизости — самое ценное, что можно услышать.
  // То, что игрок уже слышал от других, второй раз не пересказывают как новость.
  const leads = fresh.filter(n => n.lead && !G.leads.find(l => l.id === n.lead).known);
  trainSkill(p, 'speech', 0.5);
  if (leads.length && rng.chance(0.6 + skillLevel(p, 'speech') * 0.03)) {
    const n = rng.pick(leads), lead = G.leads.find(l => l.id === n.lead);
    npc.told.add(n);
    lead.known = true;
    noteRumor(npc, { kind: 'lead', text: n.text, lead: lead.id, title: `${lead.name}: ${lead.anchor}` });
    log(`Слух записан в журнал. На карте отмечено: ${lead.name.toLowerCase()} (!).`, C.gold);
    const intro = rng.pick(['Слыхал?', 'Скажу тебе, раз спросил.', 'Только между нами.', 'Вот что люди говорят.']);
    return `«${intro} ${n.text}»`;
  }
  if (fresh.every(n => n.lead)) {
    if (rng.chance(0.5)) return speak(npc, rng.pick(npc.role === 'peasant' ? NO_NEWS.peasant : place.kind === 'village' ? NO_NEWS.village : NO_NEWS.default));
    return lore();
  }
  // Иногда вместо вестей — старые страшилки о нечисти.
  if (rng.chance(0.25)) return lore();
  // Одна из нескольких самых свежих — чтобы все не твердили одно и то же.
  const n = rng.pick(fresh.filter(n => !n.lead).sort((a, b) => b.day - a.day).slice(0, 4));
  npc.told.add(n);
  noteRumor(npc, { kind: 'news', text: n.text, newsDay: n.day });
  const day = timeInfo().day;
  const src = npc.role === 'merchant' || npc.role === 'boatman' ? ' Мне это матросы рассказали.'
    : npc.role === 'innkeeper' && rng.chance(0.5) ? ' У меня постояльцы только об этом и говорят.' : '';
  return `«${agoText(day - n.day)}: ${lowerStart(n.text)}${src}»`;
}

// После «Вчера:» весть идёт со строчной — но не имя: «Генуя обещает…», «Гвидо…», «Флоренция…».
let PROPER_WORDS = null;
function lowerStart(text) {
  if (!PROPER_WORDS) {
    PROPER_WORDS = new Set();
    const add = s => s.split(/[\s,«»().-]+/).forEach(w => { if (/^[А-ЯЁA-Z]/.test(w)) PROPER_WORDS.add(w); });
    for (const c of G.over.cities) if (c.kind === 'city' || c.kind === 'town') add(c.name);
    for (const r of Object.values(REGIONS)) add(r.name);
    for (const n of BANDIT_LORDS) add(n);
  }
  const first = text.split(/[\s,:;.!?]/)[0];
  return PROPER_WORDS.has(first) ? text : text[0].toLowerCase() + text.slice(1);
}

// Записать услышанное в журнал.
function noteRumor(npc, r) {
  const p = G.player;
  p.rumors = p.rumors || [];
  if (p.rumors.some(o => o.text === r.text)) return;
  const place = npc.village.city;
  p.rumors.unshift({ ...r, day: timeInfo().day, source: `${npc.title} ${npc.name}, ${placeTitle(place)}` });
  if (p.rumors.length > 60) p.rumors.pop();
}

// ─── Бытовые разговоры ─────────────────────────────────────────────

const LIFE = {
  flamen: [
    'Мой род хранит огонь Весты двенадцать столетий. Когда пала империя, мы ушли в горы — и огонь ушёл с нами.',
    'Ваш папа воюет с вашим императором. Сатурн видел и не такое. Сатурн подождёт.',
  ],
  pagan: [
    'Козы, сыр, жертвенный хлеб для Ларов на новолуние. Мы живём так, как жили наши деды при Цезарях.',
    'Говорим между собой на старом языке. Ваши монахи читают латынь по книгам, а мы на ней молимся.',
    'Внизу, в долинах, нас зовут дьяволопоклонниками. Мы зовём их забывшими.',
  ],
  noble: [
    'Налоги, тяжбы с соседом из-за мельницы, дочь на выданье — вот и вся жизнь сеньора. Не завидуй.',
    'Император зовёт под Парму, папа грозит отлучением всякому, кто пойдёт. Какую сторону ни выбери — рискуешь землёй.',
    'Мой прадед ходил в Святую землю. Вернулся с мощами, сарацинским мечом и лихорадкой. Через год лихорадка свела его в могилу.',
    'Соколиная охота — единственное, что отвлекает от дел. Император, говорят, пишет о ней книгу.',
  ],
  knight: [
    'Кольчуга ржавеет, конь стареет, а войны всё нет. Скоро наймусь к кому-нибудь в Ломбардии.',
    'Учу оруженосца держать копьё. Сын мельника, а рука твёрдая. Выйдет толк, если доживёт.',
    'Сеньор обещал мне надел, если отличусь. Ждать ли войны — или самому её поискать?',
  ],
  hermit: [
    'Ем то, что даёт лес: каштаны, коренья, мёд диких пчёл. Господь не даёт голодать тому, кто не просит лишнего.',
    'Ночью к хижине подходят волки. Сидят, слушают псалмы. Потом уходят.',
    'Был я когда-то нотарием во Флоренции. Писал чужие завещания, пока не задумался о своём.',
  ],
  peasant_village: [
    'Подать опять подняли. Сеньору — десятину, церкви — десятину, а нам — что останется.',
    'Корова захворала. Знахарка пошептала, а толку чуть. Может, сглаз?',
    'Дождя бы. Земля как камень, рожь колосится плохо.',
    'Сосед опять передвинул межевой камень. Пойду к старосте — пусть рассудит.',
    'Вчера на сенокосе спину сорвал. Ничего, к жатве отойдёт.',
    'Дочку замуж выдавать, а приданого — две курицы да прялка.',
    'Ночью собаки выли до самого утра. Я к окну — а за околицей будто огонёк ходит.',
  ],
  peasant_city: [
    'Хлеб подорожал, а жалованье подмастерьям — как при деде. Цех держит цены, а мы держим пояс.',
    'В нашем переулке трое слегли с горячкой. Священник ходит к ним каждый день.',
    'Сын пошёл в учение к нотариусу. Будет грамотный — не то что я.',
    'В воскресенье на площади казнили фальшивомонетчика. Народу собралось — как на ярмарку.',
    'Вода в колодце опять мутная. Говорят, дохлую кошку кто-то бросил.',
    'Весной улицу размыло, телеги вязнут по ступицу. Подеста обещает мостовую, да денег в казне нет.',
    'Гвельфы с гибеллинами опять подрались у таверны. Трое с разбитыми головами.',
  ],
  elder: ['Голова пухнет: кто кому должен, у кого межа, у кого корова в чужом огороде.',
    'Сборщик податей был на прошлой неделе. Еле отговорил его не забирать последнее.',
    'Мост через реку совсем прогнил. Денег на новый нет, а без моста — в обход полдня.'],
  priest: ['Прихожане в пост тайком едят мясо и думают, что Господь не видит.',
    'Колокол треснул. Пока не перельём, звонить по покойникам нечем.',
    'Исповедуюсь каждую неделю сам — у кого ещё столько грехов, как у пастыря, знающего чужие?'],
  monk: ['Встаём к утрене затемно, а в келье холодно, как в склепе.',
    'Переписываю Псалтирь третий месяц. Глаза уже не те.',
    'Отец аббат наложил на меня молчание до вечерни. Прости, что говорю мало.'],
  innkeeper: ['Постояльцы задолжали, вино в бочках кислит, а сборщик берёт подать с каждого очага.',
    'Вчера у меня два паломника подрались из-за того, чья реликвия настоящая.',
    'Скоро ярмарка — понаедут купцы, будут спать по трое на лавке.'],
  smith: ['Уголь подорожал. Леса рубят под пашню, а жечь скоро будет нечего.',
    'Полгорода ходит с моими подковами, а платят половину — остальное в долг до урожая.',
    'Подмастерье опять обжёг руку. Ничего, через это все проходят.'],
  herbalist: ['Мандрагору рвать надо в полнолуние и с собакой на верёвке. Иначе крик её убьёт.',
    'Священник косо смотрит на мои травы. А когда в приходе горячка — сам шлёт людей ко мне.',
    'Ромашка в этом году мелкая. Зима была злая.'],
  guard: ['Жалованье задерживают третий месяц. Иные из наших уже ушли к кондотьерам.',
    'Стоять в карауле ночью — хуже смерти. Всё кажется, что за стеной кто-то ходит.',
    'Вчера у ворот зарезали торговца. Убийцу не нашли — ушёл через виноградники.'],
  merchant: ['Перевезти тюк сукна из Флоренции в Неаполь — дороже, чем само сукно. Пошлины на каждом мосту!',
    'Векселя флорентийских банкиров — вот будущее. Монеты таскать — только разбойников кормить.',
    '{Купил|Купила} партию перца — а там половина песка. Весь барыш с той поездки пропал.'],
  boatman: ['Ветер нынче не тот. Неделю сидим в гавани.',
    'Днище обросло, надо кренговать, а мастеров на верфи не допросишься до осени.',
    'Видел однажды у Сицилии морского змея. Длиной с три галеры. Не веришь? Как хочешь.'],
};

// Замечания о самом игроке.
// Римское снаряжение из гробниц: на тебя глазеют, как на ожившую статую.
const romanCount = p => equippedItems(p).filter(it => it.roman || (ITEMS[it.key] && ITEMS[it.key].roman)).length;
const ROMAN_LOOKS = {
  default: [
    'Чудно ты одет. Будто сошёл с древней колонны, что стоит на форуме.',
    'Это что на тебе — железные обручи? Так римляне ходили, на старых камнях так высечено.',
    'Где ты взял этот доспех? Такого нынче ни один кузнец не скуёт.',
  ],
  priest: ['Ты носишь доспех язычника, снятый с мертвеца. Помни: железо очищается огнём, а душа — покаянием.'],
  smith: ['Римская работа. Полосы гнуты по телу, заклёпки медные. Ремни я бы перешил — эти долго не протянут.'],
  guard: ['Стой. Это что за доспех? Из какого войска? …Римский? Ну, проходи. Только детей не пугай.'],
  peasant: ['Матерь Божья, я уж думал{|а} — мертвец из старых гробниц встал. Ты бы снял это железо.'],
  merchant: ['За такой доспех в Риме иной кардинал дал бы немало — у них мода на древности. Но носить его в дорогу — чудно.'],
  noble: ['Мой капеллан говорит, что римляне были великим народом. Но ходить в их латах по моей земле — странная причуда.'],
};

function remarkAboutPlayer(npc) {
  const p = G.player, out = [];
  if (p.hp < p.maxHp / 3) out.push('Да ты весь в крови! Сходи к травнице, пока не поздно.');
  if (p.poison) out.push('Лицо у тебя зелёное. Тебя что, змея укусила?');
  if (p.equip.body && p.equip.body.armor >= 3 && p.equip.body.key !== 'lorica') out.push(`Добрый доспех. Рыцарь, что ли? Только рыцари на своих двоих не ходят.`);
  if (romanCount(p)) out.push(rng.pick(ROMAN_LOOKS[npc.role] || ROMAN_LOOKS.default));
  if (p.equip.right && p.equip.right.two) out.push('С такой железякой ты, верно, на медведя ходишь.');
  if (p.equip.left && p.equip.left.key === 'torch' && !isNight()) out.push('Факел днём таскаешь? Чудной ты.');
  if (!p.equip.body && !p.equip.head) out.push('Ходишь без доспеха по таким дорогам? Смелый или глупый.');
  const people = {
    frank: 'Франк? Ваши крестоносцы в Константинополе такое творили, что у нас до сих пор вспоминают.',
    rus: 'С Руси? Далеко же тебя занесло. Говорят, у вас татары всё пожгли — правда?',
    teuton: 'Тедеско, значит. Император тоже немец — а живёт у нас, в Апулии.',
    norse: 'Из Норвегии? Это где-то за Англией? Говорят, у вас полгода ночь.',
    saracen: 'Сарацин? Из Лючеры, что ли? Император вас любит больше, чем нас, христиан.',
    italian: 'Свой, итальянец! По говору слышно — с севера, из ломбардских городов.',
    english: 'Англичанин? Ваших паломников по этой дороге — каждую весну. Говорят, у вас король воюет со своими баронами.',
    castile: 'Кастилец? У вас там, говорят, с маврами война без конца.',
    rhomaios: 'Ромей? Латиняне выгнали ваших из Константинополя. Ну, может, ещё вернётесь.',
  };
  // О родине игрока каждый скажет не больше раза.
  if (p.is('saracen') && isSaracen(npc)) people.saracen = 'Ас-саляму алейкум, брат. Из какой семьи будешь? Лицо будто знакомое.';
  if (people[p.people.id] && !npc.remarkedPeople) out.push(people[p.people.id]);
  return out;
}

// У каждого жителя — свой небольшой запас историй: свои заботы о жизни и пара слухов.
// Выбирается при первом разговоре и хранится; устаревшее (Парма после осады) отбрасывается.
function repertoire(npc, key, pool, n) {
  npc.rep = npc.rep || {};
  let mine = (npc.rep[key] || []).filter(t => pool.includes(t) && !parmaStale(t));
  if (!mine.length) {
    const fresh = timely(pool.slice());
    mine = rng.shuffle(fresh.slice()).slice(0, n);
    npc.rep[key] = mine;
  }
  return mine;
}
// Следующая история из своего запаса — по кругу: люди повторяются.
function nextOf(npc, key, pool, n) {
  const mine = repertoire(npc, key, pool, n);
  npc.repI = npc.repI || {};
  const i = (npc.repI[key] || 0) % mine.length;
  npc.repI[key] = i + 1;
  return mine[i];
}

// О жизни рассказывают раз в день; спросишь снова — «всё так же».
const LIFE_DONE = [
  'Да всё так же, как утром. За день ничего не переменилось.',
  'Я тебе уже {рассказал|рассказала}, как живём. Приходи в другой день.',
  'Живём, как жили. Работа сама себя не сделает — ступай.',
];
function lifeReply(npc) {
  const place = npc.village.city, day = timeInfo().day;
  if (npc.lifeDay === day) return speak(npc, rng.pick(LIFE_DONE));
  npc.lifeDay = day;
  let key = npc.role;
  // У края свои заботы: мальтиец говорит о воде, хлопке и корсарах, а не о подесте.
  const V = localVoice(place);
  if (V && (!V.kinds || V.kinds.includes(place.kind))) {
    // Священник, старейшина и стража говорят о своём деле, прочие — и о своём ремесле, и о жизни края.
    const own = V.life[npc.role], solo = own && ['priest', 'elder', 'guard'].includes(npc.role);
    const pool = isSaracen(npc) ? V.life.muslim : solo ? own : (own || []).concat(V.life.default);
    return speak(npc, nextOf(npc, 'life', pool, 4));
  }
  if (isSaracen(npc)) return speak(npc, nextOf(npc, 'life', SARACEN_LIFE[saracenKey(npc)] || SARACEN_LIFE.peasant, 4));
  // Парма в осаде — и после победы.
  if (place.id === 'parma' && rng.chance(0.7) && (parmaSiege() || timeInfo().day - dayOfDate(1248, 2, 18) < 60))
    return speak(npc, nextOf(npc, parmaSiege() ? 'siege' : 'freed', parmaSiege() ? PARMA_SIEGE_LIFE : PARMA_FREE_LIFE, 2));
  if (place.kind === 'pagan') key = npc.role === 'flamen' ? 'flamen' : 'pagan';
  else if (npc.role === 'peasant') key = place.kind === 'monastery' ? 'monk' : place.kind === 'village' ? 'peasant_village' : 'peasant_city';
  if (key !== 'hermit' && rng.chance(0.3)) return speak(npc, nextOf(npc, 'season_' + seasonOf(), SEASON_TALK[seasonOf()], 1));
  const lines = [nextOf(npc, 'life', npc.life || LIFE[key] || LIFE.peasant_city, 4)];
  if (rng.chance(0.3)) {
    const r = remarkAboutPlayer(npc);
    if (r.length) {
      const line = rng.pick(r);
      if (line.endsWith('?') || /Франк|С Руси|Тедеско|Норвегии|итальянец|Англичанин|Кастилец|Ромей|Сарацин\?/.test(line)) npc.remarkedPeople = true;
      return speak(npc, line);
    }
  }
  return speak(npc, rng.pick(lines));
}

// Женщины говорят о себе в женском роде.
const FEMININE = [['Думал', 'Думала'], ['не бывал', 'не бывала'], ['не слыхал', 'не слыхала'],
  ['спину сорвал', 'спину сорвала'], ['Я к окну', 'Я к окну'], ['Видел однажды', 'Видела однажды'],
  ['Исповедуюсь каждую неделю сам', 'Исповедуюсь каждую неделю сама']];

// Род говорящего: в репликах пишется «{рассказал|рассказала}» — мужская форма слева, женская справа.
function speak(npc, text) {
  if (typeof text !== 'string') return text;
  const f = !!(npc && npc.female);
  text = text.replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_, m, w) => (f ? w : m));
  if (!f) return text;
  for (const [m, w] of FEMININE) text = text.replace(m, w);
  return text;
}

// Разбуженный среди ночи.
const WOKEN = [
  'Кто здесь?.. Ночь же на дворе! Говори, раз разбудил, только тихо — дети спят.',
  'А?.. Что стряслось? Пожар? Нет? Тогда чего тебе среди ночи?',
  'Господи помилуй, напугал… Чего не спится? Говори быстрее — мне до света вставать.',
  'Чего ломишься? Добрые люди в такой час спят. Ну, раз уж разбудил…',
];

// Приветствие зависит от времени суток.
function greetingFor(npc) {
  const seen = piousNotice(npc);
  if (seen) return seen;
  if (npc.special) return npc.greeting;   // легат и папа говорят от себя
  if (npc.sleeping) return speak(npc, rng.pick(WOKEN));
  if (npc.emperor) return emperorGreeting(npc);
  const known = fameRecognition(npc);
  if (known) return known;
  // Римский доспех бросается в глаза: каждый скажет о нём — но лишь однажды.
  if (romanCount(G.player) && !npc.romanSeen && !npc.special && rng.chance(0.25 + romanCount(G.player) * 0.15)) {
    npc.romanSeen = true;
    return rng.pick(ROMAN_LOOKS[npc.role] || ROMAN_LOOKS.default);
  }
  if (cultNpc(npc)) return rng.pick(CULT_GREETINGS);
  const { hour } = timeInfo();
  const feast = feastsOn(today()).find(f => f.major || f.saint);
  if (feast && !isSaracen(npc) && rng.chance(0.5)) return `С праздником тебя! Сегодня ${feast.name.replace(/^День /, 'день ').replace(/ — .*/, '')}.`;
  if (hour >= 21 || hour < 5)
    return rng.pick(['Чего бродишь по ночам? Добрые люди спят.', 'Ночь на дворе. Говори быстрее, что надо.', `${npc.greeting}`]);
  if (hour < 9 && rng.chance(0.4)) return rng.pick(['Доброго утра. Рано ты поднялся.', 'Утро доброе. Петухи только пропели.']);
  if (hour >= 18 && rng.chance(0.4)) return rng.pick(['Добрый вечер. Скоро ворота закроют — не задерживайся.', 'Вечереет. Чего тебе?']);
  return speak(npc, npc.greeting);
}

// ─── Есть ли у жителя работа ───────────────────────────────────────

const NO_WORK = [
  'Нет, сейчас работы нет. Заглядывай через пару дней.',
  'Всё сделано, слава Богу. Может, на той неделе что найдётся.',
  'Работы нет. Самим бы прокормиться до урожая. Приходи позже.',
  'Пока ничего. Спроси у других — может, им нужнее.',
];
const WORK_CHANCE = { elder: 0.65, innkeeper: 0.45, smith: 0.4, herbalist: 0.5, priest: 0.4 };

function askForWork(npc) {
  const day = timeInfo().day;
  if (npc.noWorkUntil && day < npc.noWorkUntil) return null;
  // Особые дела — среди обычных: иногда вместо простой работы.
  const story = cultOffer(npc) || crusadeOffer(npc);
  if (story && rng.chance(0.4)) return story;
  if (!rng.chance(WORK_CHANCE[npc.role] || 0.5)) {
    npc.noWorkUntil = day + rng.int(2, 5);
    return null;
  }
  return makeOffer(npc);
}
