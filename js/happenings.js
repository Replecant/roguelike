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
    for (let i = 0; i < 3; i++) add('merchant', 'Заезжий купец', { portrait: 'merchant',
      deal: { rations: true, sells: GOOD_IDS, buys: GOOD_IDS, trophies: 0.65, gear: [], buysGear: () => 0.25 },
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
    return rng.pick(JONGLEUR_TALES);
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
