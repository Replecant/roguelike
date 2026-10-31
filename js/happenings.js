'use strict';

// ─── События мира: ярмарки ─────────────────────────────────────────
// Общий механизм: событие (happening) — где, когда (start…end), что за
// событие. О нём заранее идёт весть; пока оно идёт, место меняется.
// Первое событие — ярмарка. Большие города держат ярмарку в день своего
// небесного покровителя; на большие праздники ярмарки бывают и в городках.
// На ярмарку стягиваются обозы и крестьяне; там заезжие купцы (товара вдвое
// больше, цены лучше, трофеи берут дороже), жонглёр, глашатай с состязаниями —
// и карманники в толпе.

// Ярмарки на день святого покровителя города (юлианский календарь).
const CITY_FAIRS = [
  { city: 'venice', m: 4, d: 25, saint: 'святого Марка' },
  { city: 'ferrara', m: 4, d: 23, saint: 'святого Георгия' },
  { city: 'bari', m: 5, d: 9, saint: 'святого Николая' },
  { city: 'bari', m: 12, d: 6, saint: 'святого Николая' },
  { city: 'padua', m: 6, d: 13, saint: 'святого Антония' },
  { city: 'genoa', m: 6, d: 24, saint: 'святого Иоанна' },
  { city: 'florence', m: 6, d: 24, saint: 'святого Иоанна' },
  { city: 'rome', m: 6, d: 29, saint: 'апостолов Петра и Павла' },
  { city: 'pisa', m: 8, d: 15, saint: 'Успения Богородицы' },
  { city: 'siena', m: 8, d: 15, saint: 'Успения Богородицы' },
  { city: 'naples', m: 9, d: 19, saint: 'святого Януария' },
  { city: 'bologna', m: 10, d: 4, saint: 'святого Петрония' },
  { city: 'milan', m: 12, d: 7, saint: 'святого Амвросия' },
];

const JONGLEUR_TALES = [
  'Жонглёр поёт о Роланде: как тот трубил в рог в Ронсевальском ущелье, пока у него не лопнули виски. Толпа плачет.',
  'Жонглёр рассказывает про лиса Ренара, который обманул волка Изенгрина и самого льва. Хохочут даже стражники.',
  'Жонглёр поёт о Тристане и Изольде и о любовном зелье. Женщины утирают глаза, мужчины делают вид, что им скучно.',
  'Жонглёр жонглирует горящими факелами, глотает шпагу и показывает учёного медведя. Тебе кажется, что медведь умнее половины зрителей.',
  'Жонглёр поёт сирвенту против папы — тихо, оглядываясь. За такое в другом городе могли бы и повесить.',
];

// ─── Расписание ────────────────────────────────────────────────────

function happeningsAt(place, day = timeInfo().day) {
  return (G.happenings || []).filter(h => h.place === place.id && day >= h.start && day <= h.end);
}
function activeFair(place) { return place && happeningsAt(place).find(h => h.kind === 'fair'); }
function upcomingFair(place) {
  const day = timeInfo().day;
  return (G.happenings || []).find(h => h.kind === 'fair' && h.place === place.id && h.end >= day);
}

function addHappening(kind, place, fairDay, name) {
  G.happenings = G.happenings || [];
  if (G.happenings.some(h => h.place === place.id && Math.abs(h.day - fairDay) < 5)) return null;
  const h = { id: `hp${G.happeningN = (G.happeningN || 0) + 1}`, kind, place: place.id, day: fairDay, start: fairDay - 1, end: fairDay + 1, name, done: {} };
  G.happenings.push(h);
  return h;
}

// Раз в день: объявить ярмарки на неделю вперёд, позвать на них путников.
function happeningsDaily(day) {
  const ahead = day + 7, dt = dateOfDay(ahead);
  G.happenings = (G.happenings || []).filter(h => h.end >= day - 3);
  const announce = (place, h, text) => {
    if (!h) return;
    addNews({ day, text, x: place.x, y: place.y, tag: 'trade', world: place.kind === 'city' });
  };
  for (const f of CITY_FAIRS) {
    if (f.m !== dt.m || f.d !== dt.d) continue;
    const c = G.over.cities.find(x => x.id === f.city);
    if (!c || (c.id === 'parma' && parmaSiege(ahead))) continue;
    const h = addHappening('fair', c, ahead, `Ярмарка на день ${f.saint}`);
    announce(c, h, `Через неделю, на день ${f.saint}, в ${placeTitle(c) === c.name ? cityLoc(c.name) : placeTitle(c)} большая ярмарка. Съезжаются купцы со всей Италии.`);
  }
  // На большой праздник — ярмарки в паре городков (одна из них — поблизости от героя).
  const feast = feastsOn(dt).find(f => f.major);
  if (feast) {
    const towns = G.over.cities.filter(c => c.kind === 'town' && c.id !== 'parma');
    const near = towns.filter(c => Math.hypot(c.x - G.ox, c.y - G.oy) < 60);
    for (const c of [rng.pick(near.length ? near : towns), rng.pick(towns)]) {
      const name = feast.name.replace(/ \(.*\)/, '').replace(/^День /, 'день ');
      const h = addHappening('fair', c, ahead, `Ярмарка на ${name}`);
      announce(c, h, `На ${name} в ${cityLoc(c.name)} — ярмарка. Крестьяне везут всё, что уродилось, купцы — всё, что привезли из-за моря.`);
    }
  }
  happeningsRoll(day);
  // На ярмарку стягиваются обозы и крестьяне.
  for (const h of G.happenings) {
    if (h.kind !== 'fair' || day < h.start - 3 || day > h.end) continue;
    const c = G.over.cities.find(x => x.id === h.place);
    if (!c || Math.hypot(c.x - G.ox, c.y - G.oy) > 90) continue;
    if (G.travelers.filter(t => t.toFair && t.to === c.id).length >= 5) continue;   // не толпой
    for (const kind of ['caravan', 'peasants']) {
      const t = spawnTravelerTo(kind, c);
      if (t) G.travelers.push(t);
    }
  }
}

// «в Генуе», «в Сиене», «в Риме», «в Бари».
function cityLoc(name) {
  if (/[ая]$/.test(name)) return name.slice(0, -1) + 'е';
  if (/ь$/.test(name)) return name.slice(0, -1) + 'е';
  if (/[бвгджзклмнпрстфхцчшщ]$/.test(name)) return name + 'е';
  return name;
}

// Путник, идущий именно туда.
function spawnTravelerTo(kind, dest) {
  const ow = G.over, from = rng.pick(G.over.cities.filter(c => c !== dest && (kind === 'peasants' ? c.kind === 'village' : ['city', 'town'].includes(c.kind))
    && landmass(c.region) === landmass(dest.region) && Math.hypot(c.x - dest.x, c.y - dest.y) < (kind === 'peasants' ? 25 : 60)));
  if (!from) return null;
  const path = overPath(from.x, from.y, dest.x, dest.y);
  if (!path || path.length < 4) return null;
  const i = rng.int(0, Math.floor(path.length / 2)), W = ow.w;
  const t = { id: `tr${G.travelerN = (G.travelerN || 0) + 1}`, kind, from: from.id, to: dest.id, path, i, acc: 0,
    x: path[i] % W, y: (path[i] / W) | 0, n: rng.int(2, 5), toFair: true };
  if (kind === 'peasants') t.goods = rng.shuffle(['grain', 'cheese', 'wine', 'oil']).slice(0, 2);
  return t;
}

// ─── Ярмарка в городе ──────────────────────────────────────────────

function fairEnter(world, city) {
  const h = activeFair(city);
  // Ярмарка кончилась — заезжие разъехались.
  if (world.fairOf && (!h || world.fairOf !== h.id)) {
    for (const v of world.villages) v.npcs = v.npcs.filter(n => !n.fair);
    world.actors = world.actors.filter(a => !a.fair);
    world.fairOf = null;
  }
  if (!h) return;
  if (world.fairOf !== h.id) {
    world.fairOf = h.id;
    const v = world.villages[0], plaza = { x: v.cx - 8, y: v.cy - 4, w: 17, h: 9, building: -1 };
    const add = (role, title, extra) => {
      const spot = findFreeIn(world, plaza);
      if (!spot) return;
      const npc = makeNpc(role, v, plaza, spot[0], spot[1]);
      Object.assign(npc, { title, fair: h.id }, extra);
      v.npcs.push(npc);
      world.actors.push(npc);
    };
    // Условия торговли — в traderGoods (функции в сохранение не попадают).
    for (let i = 0; i < 3; i++) add('merchant', 'Заезжий купец', { portrait: 'merchant', fairMerchant: true,
      greeting: rng.pick(['Подходи! Шёлк из Лукки, перец из Александрии, соль из Червии!', 'Торгую, пока ярмарка! Завтра — дальше, в другой город.',
        'Трофеи? Шкуры? Покупаю дороже, чем в лавке — на ярмарке всё уходит!']) });
    add('peasant', 'Глашатай', { fairRole: 'herald', greeting: 'Слушайте все! Сегодня на ярмарке — состязания! Лучники, борцы, наездники — показывайте удаль, выигрывайте серебро!' });
    add('peasant', 'Жонглёр', { fairRole: 'jongleur', greeting: 'Почтенный! Монетку — и я спою тебе о Роланде так, что заплачешь. Две — и о Тристане!' });
    log(`${h.name}! На площади — палатки, шум, запах жареного; купцы, жонглёры, глашатай зазывает на состязания.`, C.gold);
  }
  // Карманники в толпе — раз за ярмарку.
  const p = G.player;
  if (!h.done.pickpocket) {
    h.done.pickpocket = true;
    if (p.coins > 20 && rng.chance(0.35 * (1 - skillLevel(p, 'stealth') * 0.07) * (1 - (p.stats.wis - 5) * 0.05))) {
      const lost = Math.min(40, Math.max(3, Math.round(p.coins * 0.1)));
      p.coins -= lost;
      log(`В толпе кто-то толкнул тебя плечом. Через минуту ты замечаешь: кошель надрезан. Пропало ${coins(lost)}.`, C.red);
    }
  }
}

// Ярмарочные цены: купить чуть дешевле, продать чуть дороже.
function fairPriceMult(place, selling) { return activeFair(place) ? (selling ? 1.1 : 0.9) : 1; }
function fairStockMult(place) { return activeFair(place) ? 2 : 1; }

// ─── Глашатай и жонглёр ────────────────────────────────────────────

const CONTESTS = {
  archery: { label: 'Состязание лучников', fee: 5, prize: 50, skill: p => Math.max(skillLevel(p, 'bow'), skillLevel(p, 'crossbow'), skillLevel(p, 'throw')) * 1.5 + p.stats.dex * 0.6,
    train: p => trainSkill(p, skillLevel(p, 'crossbow') > skillLevel(p, 'bow') ? 'crossbow' : 'bow', 6),
    win: 'Твоя последняя стрела вонзается в самое яблочко. Толпа ревёт; глашатай вручает приз — серебряную чашу и кошель.',
    lose: 'Рука дрогнула на ветру. Побеждает генуэзский арбалетчик — им на ярмарках равных нет.' },
  wrestling: { label: 'Борьба на поясах', fee: 3, prize: 35, skill: p => p.stats.str * 0.8 + skillLevel(p, 'athletics') * 1.5,
    train: p => trainSkill(p, 'athletics', 6),
    win: 'Ты бросаешь через бедро мельника, а потом и кузнеца. Тебя качают на руках; приз — твой.',
    lose: 'Здоровенный мясник ставит тебя на лопатки под общий хохот. Ну хоть зубы целы.' },
  race: { label: 'Скачки', fee: 10, prize: 80, need: p => p.mount && p.mount.kind === 'horse' ? '' : 'нужна верховая лошадь',
    skill: p => skillLevel(p, 'riding') * 2 + p.stats.dex * 0.5 + (p.mount && p.mount.hungry ? -3 : 0),
    train: p => trainSkill(p, 'riding', 8),
    win: 'Ты приходишь первым, на полкорпуса впереди сына подесты. Подеста кисло улыбается и вручает награду.',
    lose: 'Лошадь сбивается на повороте у собора. Победу празднует какой-то конюх из Ареццо.' },
};

function fairOptions(npc) {
  const p = G.player, h = activeFair(npc.village.city);
  if (!h) return [{ label: 'Уйти', act: () => null }];
  if (npc.fairRole === 'jongleur') return [{ label: 'Послушать жонглёра (1 мон.)', act: () => {
    if (p.coins < 1) return '«Без монетки и песня не поётся, почтенный».';
    p.coins -= 1;
    trainSkill(p, 'speech', 1);
    passTime(30);
    return fameSong() || rng.pick(JONGLEUR_TALES);
  } }, { label: 'Что нового?', act: () => newsReply(npc) }];
  if (npc.fairRole === 'herald') {
    const opts = [];
    for (const [id, c] of Object.entries(CONTESTS)) {
      const block = c.need ? c.need(p) : '';
      opts.push({ label: `${c.label} (взнос ${c.fee} мон., приз ${c.prize})${h.done[id] ? ' — уже участвовал' : block ? ` — ${block}` : ''}`, act: () => {
        if (h.done[id]) return '«Ты уже показал себя. Дай и другим!»';
        if (block) return `«Для скачек ${block}, приятель».`;
        if (p.coins < c.fee) return '«Сначала взнос — потом слава».';
        p.coins -= c.fee;
        h.done[id] = true;
        passTime(60);
        c.train(p);
        const me = c.skill(p) + rng.int(0, 10), best = Math.max(...[0, 1, 2].map(() => rng.int(4, 12) + rng.int(0, 6)));
        if (me > best) {
          p.coins += c.prize;
          p.gainXp(20);
          chronicle(`Победил на ярмарке (${c.label.toLowerCase()}) в ${cityLoc(npc.village.city.name)}.`, 'quest');
          addFame(3, `победил на ярмарке в ${cityLoc(npc.village.city.name)}`);
          log(`Приз: ${coins(c.prize)}.`, C.gold);
          return c.win;
        }
        return c.lose;
      } });
    }
    return opts;
  }
  return null;   // купцы — обычные торговцы
}

// ─── Прочие события мира ───────────────────────────────────────────
// Мор, турнир, крестный ход, казнь, набег, неурожай. Чтобы мир не жил
// в вечной лихорадке: одновременно не больше двух таких событий, новое
// начинается редко (в среднем раз в две-три недели), у каждого вида — свой
// долгий перерыв, и в одной области одновременно — одно событие.

const HAPPENING_KINDS = {
  plague: { w: 2, dur: [10, 18], cooldown: 60, places: ['city', 'town'],
    news: c => `В ${cityLoc(c.name)} мор: люди горят в лихорадке, мёртвых вывозят на телегах. Путники обходят город стороной.` },
  tournament: { w: 2, dur: [3, 3], cooldown: 40, places: ['castle'], lead: 5,
    news: c => `В ${c.name === placeTitle(c) ? c.name : placeTitle(c)} будет турнир: сеньор созывает рыцарей и удальцов со всей округи. Награда победителю — конь и серебро.` },
  procession: { w: 2, dur: [2, 2], cooldown: 30, places: ['city', 'town'],
    news: c => `В ${cityLoc(c.name)} по улицам понесут мощи. Говорят, при таких крестных ходах бывают исцеления.` },
  execution: { w: 2, dur: [1, 1], cooldown: 30, places: ['city', 'town'], lead: 2,
    news: c => `В ${cityLoc(c.name)} на площади казнят разбойника. Говорят, он знает, где зарыта добыча всей шайки, — да молчит.` },
  raid: { w: 2, dur: [5, 8], cooldown: 45, places: ['village'],
    news: c => `На деревню ${c.name} напал отряд мародёров: жгут амбары, угоняют скот. Крестьяне зовут на помощь.` },
  famine: { w: 1, dur: [20, 35], cooldown: 120, region: true,
    news: c => `В землях ${REGIONS[c.region].name} неурожай. Хлеб дорожает каждую неделю, на дорогах всё больше голодных — и разбойников.` },
};

function happeningsOther(day = timeInfo().day) { return (G.happenings || []).filter(h => h.kind !== 'fair' && h.end >= day); }

// Раз в день: может начаться одно новое событие.
function happeningsRoll(day) {
  G.hapCool = G.hapCool || {};
  if (happeningsOther(day).length >= 2 || !rng.chance(0.06)) return;
  const kinds = Object.entries(HAPPENING_KINDS).filter(([k]) => !(G.hapCool[k] > day));
  if (!kinds.length) return;
  const kind = rng.weighted(kinds.map(([k, d]) => ({ k, w: d.w }))).k, def = HAPPENING_KINDS[kind];
  const busy = new Set(happeningsOther(day).map(h => (G.over.cities.find(c => c.id === h.place) || {}).region));
  const pool = G.over.cities.filter(c => (def.region ? ['city', 'town'] : def.places).includes(c.kind) && !c.razed && !busy.has(c.region)
    && !(c.id === 'parma' && parmaSiege(day)) && !(c.siege));
  // Ближе к герою — чаще: половина событий — в его краях.
  const near = pool.filter(c => Math.hypot(c.x - G.ox, c.y - G.oy) < 70);
  const place = rng.pick(near.length && rng.chance(0.5) ? near : pool);
  if (!place) return;
  const start = day + (def.lead || 0), dur = rng.int(def.dur[0], def.dur[1]);
  G.happenings.push({ id: `hp${G.happeningN = (G.happeningN || 0) + 1}`, kind, place: place.id, region: place.region,
    start, end: start + dur - 1, day: start, done: {} });
  G.hapCool[kind] = day + def.cooldown;
  addNews({ day, text: def.news(place), x: place.x, y: place.y, tag: kind === 'procession' ? 'church' : kind === 'famine' ? 'trade' : 'war',
    world: kind === 'famine' || kind === 'plague' });
}

function happeningOf(kind, place) { return place && happeningsAt(place).find(h => h.kind === kind); }
function famineAt(place) {
  const day = timeInfo().day;
  return (G.happenings || []).find(h => h.kind === 'famine' && h.region === place.region && day >= h.start && day <= h.end);
}

// Цены: в мор и неурожай еда дорожает.
function happeningPriceMult(place, good) {
  let k = 1;
  if (!place || !place.region) return k;
  if (GOODS[good] && GOODS[good].food) {
    if (famineAt(place)) k *= 1.8;
    if (happeningOf('plague', place)) k *= 1.3;
  }
  return k;
}

// ─── Вход в поселение ──────────────────────────────────────────────

function happeningsEnter(world, city) {
  const p = G.player, day = timeInfo().day;
  // Снять людей прошедших событий.
  for (const v of world.villages) v.npcs = v.npcs.filter(n => !n.hap || happeningsAt(city).some(h => h.id === n.hap));
  world.actors = world.actors.filter(a => !a.hap || happeningsAt(city).some(h => h.id === a.hap));
  for (const h of happeningsAt(city)) {
    if (h.kind === 'fair') continue;
    const v = world.villages[0], plaza = { x: v.cx - 6, y: v.cy - 3, w: 13, h: 7, building: -1 };
    const add = (role, title, extra) => {
      if (world.actors.some(a => a.hap === h.id && a.hapRole === extra.hapRole)) return null;
      const spot = findFreeIn(world, plaza);
      if (!spot) return null;
      const npc = makeNpc(role, v, plaza, spot[0], spot[1]);
      Object.assign(npc, { title, hap: h.id }, extra);
      v.npcs.push(npc); world.actors.push(npc);
      return npc;
    };
    if (h.kind === 'plague') {
      log('Улицы пусты, двери помечены мелом, пахнет дымом от костров с можжевельником. Где-то звонит колокол — по ком-то ещё.', C.violet);
      if (!p.fever && !h.done.caught && rng.chance(Math.max(0.05, 0.3 - (p.stats.con - 5) * 0.03))) {
        h.done.caught = true;
        p.fever = rng.int(4, 7);
        log('Тебя бросает в жар. Ты заразился! Пока лихорадка не пройдёт, раны не заживают.', C.red);
      }
    }
    if (h.kind === 'tournament') {
      add('peasant', 'Герольд', { hapRole: 'herald', greeting: 'Внимание, внимание! Сеньор объявляет турнир! Конные сшибки на копьях и пеший бой — кто смел, тот записывается!' });
      log('Во дворе замка — ристалище, шатры, гербы на щитах. Трубят трубы, дамы машут платками.', C.gold);
    }
    if (h.kind === 'procession') {
      log('По улицам медленно идёт крестный ход: монахи с хоругвями, ларец с мощами под балдахином, толпа поёт «Te Deum». Больные тянутся к ларцу.', C.gold);
    }
    if (h.kind === 'execution') {
      add('peasant', 'Осуждённый', { hapRole: 'condemned', greeting: 'Эй… эй, ты! Подойди. Завтра меня повесят. Хочешь знать, где зарыто серебро? Слушай…' });
      log('На площади сколачивают виселицу. У помоста под стражей стоит связанный человек. Толпа уже собирается.', C.orange);
    }
    if (h.kind === 'raid' && !h.done.cleared && world.villages.length) {
      log('Над деревней дым. Мародёры грабят дома — крестьяне попрятались. Помоги им!', C.red);
      if (!world.actors.some(a => a.hap === h.id && a.kind === 'beast')) {
        const n = rng.int(3, 5), keys = parmaSiege() && ['emilia', 'lombardy'].includes(city.region) ? 'imperial_soldier' : 'brigand';
        for (let i = 0; i < n + 1; i++) {
          const spot = findFreeIn(world, { x: v.cx - 10, y: v.cy - 5, w: 21, h: 11, building: -1 });
          if (!spot) continue;
          const m = makeBeast(i === 0 ? 'brigand_chief' : keys, spot[0], spot[1]);
          if (i === 0) m.name = 'Предводитель мародёров';
          m.hap = h.id; m.provoked = true;
          world.actors.push(m);
        }
      }
    }
  }
}

// Набег отбит, когда все мародёры перебиты.
function raidKill(m) {
  if (!m.hap) return;
  const h = (G.happenings || []).find(x => x.id === m.hap);
  if (!h || h.kind !== 'raid' || h.done.cleared) return;
  if (G.world.actors.some(a => a.hap === h.id && a.kind === 'beast' && a !== m && !a.dead)) return;
  h.done.cleared = true;
  const c = G.over.cities.find(x => x.id === h.place);
  log(`Мародёры перебиты! Крестьяне выходят из укрытий. Поговори со старостой.`, C.gold);
  chronicle(`Отбил набег мародёров на деревню ${c.name}.`, 'quest');
}

// ─── Разговоры ─────────────────────────────────────────────────────

const JOUST = {
  joust: { label: 'Конная сшибка на копьях', fee: 20, prize: 150, need: p => p.mount && p.mount.kind === 'horse' ? '' : 'нужна верховая лошадь',
    skill: p => skillLevel(p, 'riding') * 1.5 + skillLevel(p, 'spear') * 1.5 + p.stats.str * 0.5 + Math.min(6, p.armor),
    train: p => { trainSkill(p, 'riding', 8); trainSkill(p, 'spear', 6); },
    win: 'Твоё копьё ломается о щит противника — и он вылетает из седла. Трибуны ревут; сеньор сам вручает тебе награду.',
    lose: 'Удар в щит выбивает тебя из седла. Ты лежишь в пыли, а трубы трубят в честь другого.' },
  melee: { label: 'Пеший бой (бугурт)', fee: 10, prize: 70,
    skill: p => Math.max(skillLevel(p, 'blade'), skillLevel(p, 'axe'), skillLevel(p, 'spear')) * 1.5 + p.stats.str * 0.6 + Math.min(5, p.armor),
    train: p => trainSkill(p, meleeSkill(p) || 'blade', 8),
    win: 'В свалке ты валишь троих и последним остаёшься на ногах. Тупым мечом — но всё равно больно. Награда твоя.',
    lose: 'Кто-то бьёт тебя по шлему тупым мечом так, что звенит в ушах. Тебя выносят с поля.' },
};

function happeningOptions(npc) {
  const p = G.player, h = (G.happenings || []).find(x => x.id === npc.hap);
  if (!h) return null;
  if (npc.hapRole === 'herald') return Object.entries(JOUST).map(([id, c]) => {
    const block = c.need ? c.need(p) : '';
    return { label: `${c.label} (взнос ${c.fee} мон., приз ${c.prize})${h.done[id] ? ' — уже выходил' : block ? ` — ${block}` : ''}`, act: () => {
      if (h.done[id]) return '«Ты уже показал себя на этом турнире».';
      if (block) return `«На сшибку без коня? ${block[0].toUpperCase() + block.slice(1)}».`;
      if (p.coins < c.fee) return '«Взнос вперёд, удалец».';
      p.coins -= c.fee; h.done[id] = true; passTime(90); c.train(p);
      p.hp = Math.max(1, p.hp - rng.int(1, 5));
      const me = c.skill(p) + rng.int(0, 10), best = Math.max(...[0, 1, 2, 3].map(() => rng.int(6, 14) + rng.int(0, 6)));
      if (me <= best) return c.lose;
      p.coins += c.prize; p.gainXp(40);
      chronicle(`Победил на турнире (${c.label.toLowerCase()}) в замке ${npc.village.city.name}.`, 'quest');
      addFame(8, `победил на турнире в замке ${npc.village.city.name}`);
      log(`Приз: ${coins(c.prize)}, 40 опыта.`, C.gold);
      return c.win;
    } };
  });
  if (npc.hapRole === 'condemned') return [
    { label: 'Слушать его исповедь', act: () => {
      if (h.done.told) return '«Я всё сказал. Помолись за меня завтра».';
      h.done.told = true;
      const t = hiddenTombs().filter(s => Math.hypot(s.x - npc.village.city.x, s.y - npc.village.city.y) < 40)[0];
      if (t) { revealTomb(t); log(`На карте отмечено: ${t.name.toLowerCase()}.`, C.gold); }
      return t ? `Он шепчет: «${whereText(npc.village.city, t.x, t.y)} — ${t.name}. Там мы прятали добычу. Мне она уже ни к чему». Стражник отталкивает тебя.`
        : '«Серебро… его уже забрали. Всё забрали. Помолись за меня, чужак, больше у меня ничего нет».';
    } },
    { label: 'Попытаться освободить его ночью', act: () => {
      if (h.done.freed) return 'Ты уже сделал, что мог.';
      if (!isNight()) return 'Днём, под носом у стражи? Дождись ночи.';
      h.done.freed = true;
      if (rng.chance(0.3 + skillLevel(p, 'stealth') * 0.06)) {
        p.gainXp(25);
        addPiety(-2, 'Ты помешал правосудию.');
        const cash = rng.int(20, 50); p.coins += cash;
        G.world.actors = G.world.actors.filter(a => a !== npc);
        return `Ты перерезаешь верёвки, пока стражник дремлет. Беглец растворяется в переулках, бросив тебе кошель: «${coins(cash)} — всё, что у меня было. Свидимся». Утром город гудит.`;
      }
      const w = G.world;
      for (let i = 0; i < 3; i++) {
        const spot = findFreeIn(w, { x: p.x - 4, y: p.y - 3, w: 9, h: 7, building: -1 });
        if (spot) { const m = makeBeast('imperial_soldier', spot[0], spot[1]); m.name = 'Городской стражник'; m.provoked = true; m.target = [p.x, p.y]; w.actors.push(m); }
      }
      return 'Скрипит доска — стражник поднимает фонарь. «Держи его!» Со всех сторон бегут люди с алебардами.';
    } },
  ];
  return null;
}

// Священник во время крестного хода; староста после набега; лекари в мор.
function happeningExtraOptions(npc) {
  const p = G.player, place = npc.village && npc.village.city, opts = [];
  if (!place) return opts;
  const pr = happeningOf('procession', place);
  if (pr && npc.role === 'priest' && !p.is('saracen') && !pr.done.walked) opts.push({ label: 'Пройти крестным ходом', act: () => {
    pr.done.walked = true; passTime(120); p.lastPractice = timeInfo().day;
    addPiety(2, 'Крестный ход.'); p.grace = p.maxGrace;
    if (rng.chance(0.25 + p.piety / 400)) { p.hp = p.maxHp; p.poison = 0; p.fever = 0; return 'Ты касаешься ларца — и по телу разливается тепло. Боль уходит, будто её и не было. Вокруг шепчут: «Чудо!»'; }
    return 'Два часа ты идёшь в толпе с горящей свечой, поёшь со всеми. На душе светло.';
  } });
  const pl = happeningOf('plague', place);
  if (pl && (npc.role === 'priest' || npc.role === 'herbalist') && pl.done.helped !== timeInfo().day) opts.push({ label: 'Помочь ухаживать за больными', act: () => {
    pl.done.helped = timeInfo().day; passTime(240);
    p.coins += 8; p.gainXp(10); trainSkill(p, 'speech', 2);
    if (!p.is('saracen')) addPiety(2, 'Милосердие к больным.');
    if (!p.fever && rng.chance(0.2)) { p.fever = rng.int(3, 6); return 'Ты носишь воду, перевязываешь, хоронишь. К вечеру тебя самого знобит — болезнь не щадит и милосердных. (+8 мон.)'; }
    return 'Четыре часа ты носишь воду и меняешь повязки. Кто-то умирает у тебя на руках, кто-то просит пить. (+8 мон.)';
  } });
  const raid = happeningOf('raid', place) || (G.happenings || []).find(h => h.kind === 'raid' && h.place === place.id && h.done.cleared && !h.done.paid);
  if (raid && npc.role === 'elder' && raid.done.cleared && !raid.done.paid) opts.push({ label: 'Мародёры перебиты', act: () => {
    raid.done.paid = true;
    addFame(4, `отбил мародёров от деревни ${place.name}`);
    const pay = rng.int(50, 90);
    p.coins += pay; p.gainXp(30);
    if (!p.is('saracen')) addPiety(1, 'Ты защитил слабых.');
    return `Староста кланяется до земли. «Вот ${coins(pay)} — вся деревня собрала. Без тебя нас бы сожгли. Помянем тебя в молитвах».`;
  } });
  return opts;
}

// Неурожай: на дорогах края больше разбойников.
function famineBrigands() {
  const fam = (G.happenings || []).find(h => h.kind === 'famine' && h.region === G.over.regionAt(G.ox, G.oy) && timeInfo().day <= h.end);
  return fam ? 3 : 0;
}

// Подсказка на карте Италии.
function happeningsLabel(place) {
  const names = { plague: 'мор', tournament: 'турнир', procession: 'крестный ход', execution: 'казнь на площади', raid: 'набег мародёров' };
  const day = timeInfo().day;
  const hs = (G.happenings || []).filter(h => h.place === place.id && h.kind !== 'fair' && h.end >= day && h.start - day <= 7);
  const fam = famineAt(place);
  const out = hs.map(h => `${names[h.kind]}${h.start > day ? ` (с ${dateText(dateOfDay(h.start), false)})` : ''}`);
  if (fam) out.push('неурожай в крае');
  return out.join(', ');
}
