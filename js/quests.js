'use strict';

// ─── Задания ───────────────────────────────────────────────────────
// Четыре вида:
//   kill    — убить зверей; награду платит тот, кто дал задание;
//   lair    — сложное: житель указывает логово чудища рядом, его надо зачистить до срока;
//   deliver — отнести груз в другое поселение; платит получатель;
//   work    — помочь на месте: работа появляется на карте, на неё надо наступить;
//   trophy  — замок заказывает шкуры, рога и клыки: добыть на охоте и принести.

const MAX_QUESTS = 6;
// Сколько платят за поручения: в 1247 году серебро на дороге не валяется.
const QUEST_PAY = 0.75;
const questPay = n => Math.max(1, Math.round(n * QUEST_PAY));

// Кто какие задания даёт.
const QUEST_GIVERS = {
  elder: ['kill', 'kill', 'lair', 'work', 'deliver'],
  priest: ['deliver', 'lair', 'relic', 'theft'],
  imam: ['deliver'],
  noble: ['lair', 'lair', 'deliver', 'trophy', 'trophy'],
  innkeeper: ['deliver', 'work'],
  smith: ['deliver'],
  herbalist: ['work', 'deliver'],
};

// Грузы: [название, кому везти (роли по порядку предпочтения), ценность].
const CARGO = {
  elder: [['Письмо', ['elder'], 0], ['Опечатанный свиток', ['elder'], 2], ['Налоговая ведомость', ['elder'], 1],
    ['Мешочек серебра', ['elder'], 6]],
  noble: [['Письмо с печатью', ['noble', 'elder'], 2], ['Ларец с драгоценностями', ['noble', 'elder'], 6],
    ['Сокол в клетке', ['noble'], 4], ['Вызов на поединок', ['noble'], 3]],
  priest: [['Письмо епископу', ['priest'], 1], ['Ларец с мощами', ['priest'], 6], ['Требник', ['priest'], 2],
    ['Сосуд со святой водой', ['priest'], 3]],
  imam: [['Книга Ибн Сины для лекаря', ['herbalist'], 4], ['Письмо в императорскую канцелярию', ['elder'], 2],
    ['Тюк сафьяна', ['merchant', 'innkeeper'], 3], ['Мешок фиников', ['innkeeper'], 2]],
  innkeeper: [['Бочонок вина', ['innkeeper'], 3], ['Круг сыра', ['innkeeper'], 2], ['Мешок соли', ['innkeeper', 'elder'], 3],
    ['Копчёный окорок', ['innkeeper'], 2]],
  smith: [['Связка подков', ['smith', 'elder'], 2], ['Мешок гвоздей', ['smith', 'elder'], 1], ['Заказной клинок', ['smith', 'elder'], 5],
    ['Железные крицы', ['smith'], 3]],
  herbalist: [['Мешочек сушёных трав', ['herbalist', 'priest'], 2], ['Склянка снадобья', ['herbalist', 'priest'], 3],
    ['Корень мандрагоры', ['herbalist'], 6], ['Пучок шафрана', ['herbalist', 'innkeeper'], 4]],
};

// Какие жители точно есть в поселении такого вида.
const PLACE_ROLES = {
  city: ['elder', 'priest', 'innkeeper', 'smith', 'herbalist'],
  town: ['elder', 'priest', 'innkeeper', 'smith', 'herbalist'],
  village: ['elder'],
  monastery: ['priest', 'herbalist'],
  castle: ['noble', 'elder', 'smith'],
  inn: ['innkeeper'],
};

// Работа на месте. from — на каких клетках появляется; inside — в стенах/деревне
// (true), за ними (false) или где угодно (undefined).
const WORK_TYPES = {
  harvest: {
    label: 'Жатва', months: [6, 7, 8], tile: T.CROP, after: T.STUBBLE, from: [T.FIELD], count: [8, 12], pay: 2,
    places: ['village'], roles: ['elder'],
    text: n => `Рожь поспела, а рук не хватает: половина мужиков ушла в войско. Сожни ${n} снопов в полях за околицей.`,
    step: 'Ты жнёшь сноп ржи',
  },
  grapes: {
    label: 'Сбор винограда', months: [9, 10], tile: T.GRAPES, after: T.VINEYARD, from: [T.VINEYARD], count: [6, 10], pay: 2,
    places: ['village', 'inn', 'monastery'], roles: ['elder', 'innkeeper'],
    text: n => `Виноград перезревает, того и гляди осы сожрут. Собери ${n} корзин на винограднике.`,
    step: 'Ты срезаешь тяжёлые гроздья в корзину',
  },
  firewood: {
    label: 'Хворост', months: [10, 11, 12, 1, 2, 3], tile: T.DEADWOOD, after: T.GRASS, from: [T.FOREST, T.PINE], count: [5, 8], pay: 3, inside: false,
    places: ['village', 'inn', 'monastery', 'town', 'castle'], roles: ['innkeeper', 'elder'],
    text: n => `Дров к зиме не напасёшься. В лесу полно сухостоя — наруби ${n} вязанок. Только поглядывай: там волки.`,
    step: 'Ты рубишь сухостой и вяжешь хворост',
  },
  herbs: {
    label: 'Травы', months: [4, 5, 6, 7, 8, 9], tile: T.HERB, after: T.GRASS, from: [T.GRASS, T.TALLGRASS, T.MARSH], count: [5, 8], pay: 3, inside: false,
    places: ['village', 'town', 'city', 'monastery'], roles: ['herbalist'],
    text: n => `Мне нужны свежие травы — зверобой, рута и дягиль. Собери ${n} пучков за стенами. Я покажу, как они выглядят.`,
    step: 'Ты срываешь пучок целебной травы',
  },
  debris: {
    label: 'Завалы', tile: T.DEBRIS, after: T.COBBLE, from: [T.COBBLE], count: [6, 10], pay: 2, inside: true,
    places: ['city', 'town'], roles: ['elder'],
    text: n => `Ночная буря обрушила кровли, улицы завалены черепицей и балками. Разбери ${n} завалов, пока не случилось беды.`,
    step: 'Ты разбираешь завал',
  },
  stones: {
    label: 'Камни для стены', tile: T.STONES, after: T.GRASS, from: [T.GRASS, T.HILL, T.TALLGRASS], count: [6, 9], pay: 3,
    inside: false, places: ['castle'], roles: ['elder'],
    text: n => `Стену пора чинить, а камень сам не придёт. Натаскай ${n} груд камней с поля под замком.`,
    step: 'Ты взваливаешь на плечо тяжёлый камень',
  },
};

const questRole = npc => npc.role === 'priest' && npc.village.city.names === 'saracen' ? 'imam' : npc.role;
const giverKey = npc => `${npc.village.city.id}:${npc.role}`;

function questsFrom(npc) {
  return G.player.quests.filter(q => q.giver === giverKey(npc));
}

// Как назвать жителя поселения: «староста», «подеста», «аббат»...
function roleTitle(place, role) {
  const own = cityPlan(place).titles && cityPlan(place).titles[role];
  if (own) return (Array.isArray(own) ? own[0] : own).toLowerCase();
  if (role === 'elder') return (place.kind === 'village' ? REGIONS[place.region].villageElder || 'Староста' : REGIONS[place.region].elder).toLowerCase();
  return ROLES[role].title.toLowerCase();
}

// Земли из реестра, отрезанные от прочей суши (alone), — своя суша (у островов одной земли — общая).
// Далмация через Хорватию связана с Карантанией и Италией посуху.
const landmass = region => ['sicily', 'sardinia', 'corsica', 'malta'].includes(region) ? region
  : LAND_DEFS[region] && LAND_DEFS[region].alone ? LAND_DEFS[region].alone : 'mainland';

// ─── Предложения ───────────────────────────────────────────────────

function makeOffer(npc) {
  const kinds = rng.shuffle((QUEST_GIVERS[questRole(npc)] || []).concat(npc.role === 'elder' && npc.village.city.kind === 'castle' ? ['trophy', 'trophy'] : []));
  for (const kind of kinds) {
    const o = kind === 'kill' ? offerKill(npc) : kind === 'lair' ? offerLair(npc) : kind === 'deliver' ? offerDelivery(npc)
      : kind === 'trophy' ? offerTrophy(npc)
      : kind === 'relic' ? offerRelic(npc) : kind === 'theft' ? offerTheft(npc) : offerWork(npc);
    if (o) return o;
  }
  return null;
}

// ─── Заказ замка: трофеи охоты ─────────────────────────────────────
// Шкуры на пол и постели, мех на плащи, рога на кубки и охотничьи рога, клыки на рукояти —
// такое заказывает только замок. Просят то, что водится в округе; платят дороже купцов.
const TROPHY_ORDERS = [
  { id: 'wolf_pelt', beast: 'wolf', n: [3, 5], why: [
    'Зима в замке долгая, а каменные полы холодны. Нужны волчьи шкуры — постелить в зале и на ложа дружины.',
    'Сеньор желает плащ, подбитый волчьим мехом, — такой, чтобы гости в зале видели: здесь живут не трусы.'] },
  { id: 'fox_fur', beast: 'fox', n: [4, 6], why: [
    'Госпожа хочет оторочить лисьим мехом новое платье к Рождеству. Купцы везут мех втридорога — а лисы у нас под боком.',
    'Сеньор выдаёт дочь замуж. Приданое без мехов — позор на всю округу.'] },
  { id: 'deer_hide', beast: 'deer', n: [3, 4], why: [
    'Шорнику нужна оленья кожа: седла и перевязи дружины истёрлись до дыр.',
    'Оленья кожа нужна на переплёт: сеньор велел переписать для замка псалтирь.'] },
  { id: 'boar_tusk', beast: 'boar', n: [2, 3], why: [
    'Кабаньи клыки — на рукояти охотничьих ножей. Сеньор дарит их тем, кто отличился на охоте.',
    'Сеньор держит пари с соседом, у кого в зале трофеи страшнее. Нужны клыки — и побольше.'] },
  { id: 'bear_skin', beast: 'bear', n: [1, 1], why: [
    'Сеньор хочет медвежью шкуру у очага — чтобы каждый гость спотыкался о неё и спрашивал, кто добыл зверя.',
    'Медвежью шкуру обещали в дар епископу. Обещали опрометчиво — теперь надо добыть.'] },
  { id: 'ibex_horn', beast: 'ibex', n: [2, 3], why: [
    'Из рога козерога выходят лучшие охотничьи рога и кубки. Сеньору нужна пара — к приезду гостей.',
    'Лекарь говорит: толчёный рог козерога помогает от падучей. Сеньор верит лекарю.'] },
  { id: 'mouflon_horn', beast: 'mouflon', n: [2, 3], why: [
    'Витые рога муфлона — над воротами и в зале. Сеньор любит, чтобы стены говорили о его охотах.'] },
  { id: 'alpha_pelt', beast: 'alpha_wolf', n: [1, 1], why: [
    'Матёрый волк режет скот уже вторую зиму. Сеньору нужна его шкура — показать мужикам, что зверь мёртв.'] },
];
// Подобрал трофей: если заказ набран — напомнить, куда нести.
function questTrophyNote(id) {
  for (const q of G.player.quests)
    if (q.type === 'trophy' && q.trophy === id && trophyHave(q) === q.need) log(`Трофеев хватит для заказа: ${q.label.toLowerCase()} ×${q.need}. Неси в ${q.fromName}.`, C.gold);
}
const trophyHave = q => (G.player.trophies[q.trophy] && G.player.trophies[q.trophy].count) || 0;
// Кто водится в округе места в эту пору года (днём и ночью): на кого можно послать охотника.
// Зимой гадюки и медведи спят, на Мальте разбойникам негде прятаться.
function beastsNear(place) {
  const season = seasonOf();
  if (place._beasts && place._beasts.season === season) return place._beasts.set;
  const ow = G.over, set = new Set(), R = 10 * MAP_SCALE, world = G.world;
  G.world = null;   // «сколько таких уже бродит» — не про эту прикидку
  try {
    for (let dy = -R; dy <= R; dy += 2)
      for (let dx = -R * 2; dx <= R * 2; dx += 2) {
        const x = place.x + dx, y = place.y + dy;
        if (!ow.inside(x, y) || !ow.passable(x, y)) continue;
        const habs = (OT_HABITATS[ow.get(x, y)] || ['field']).concat(ow.road[ow.idx(x, y)] >= 0 ? ['road'] : []);
        for (const hab of habs) for (const night of [false, true])
          for (const o of beastChoices(ow.regionAt(x, y), hab, night, false)) set.add(o.key);
      }
  } finally { G.world = world; }
  Object.defineProperty(place, '_beasts', { value: { season, set }, writable: true, configurable: true, enumerable: false });
  return set;
}

function offerTrophy(npc) {
  const place = npc.village.city;
  if (place.kind !== 'castle') return null;
  const near = beastsNear(place);
  const pool = TROPHY_ORDERS.filter(o => BEASTS[o.beast].weight && beastInRegion(BEASTS[o.beast], place.region) && o.id !== place.lastTrophy && near.has(o.beast));
  if (!pool.length) return null;
  const o = rng.pick(pool), loot = BEASTS[o.beast].loot, need = rng.int(o.n[0], o.n[1]);
  place.lastTrophy = o.id;
  const reward = questPay(loot.value * need * 2.2 + 10);
  const have = (G.player.trophies[o.id] && G.player.trophies[o.id].count) || 0;
  return {
    type: 'trophy', trophy: o.id, label: loot.name, need, have: 0, reward, xp: Math.round(BEASTS[o.beast].xp * need * 0.5) + 4,
    accept: `Добуду! (${loot.name.toLowerCase()} ×${need})`,
    text: `${rng.pick(o.why)} Принеси: ${loot.name.toLowerCase()} — ${need} шт. Заплачу ${coins(reward)}: купцы столько не дадут.`
      + (have ? ` (У тебя с собой уже ${have}.)` : ''),
  };
}

// Логова, на которые посылают: кто посылает, о ком речь, награда.
const LAIR_QUESTS = {
  orco:     { roles: ['elder', 'noble'], lvl: 5, notIn: FOREIGN_REGIONS, who: 'людоеда орко', reward: 120, xp: 60, plea: 'Орко уже утащил двух детей. Мужики боятся выйти в поле.' },
  bear:     { roles: ['elder', 'noble'], lvl: 3, who: 'медведя-шатуна', reward: 90, xp: 45, plea: 'Шатун задрал пастуха и разорил все пасеки. Охотники ходили — вернулись не все.' },
  den:      { roles: ['elder'], lvl: 2, who: 'матёрого волка и его стаю', reward: 70, xp: 35, plea: 'Волки режут овец у самых загонов. Вожак с белой отметиной — умнее любого охотника.' },
  camp:     { roles: ['elder', 'noble'], lvl: 4, who: 'атамана и его шайку', reward: 100, xp: 50, plea: 'Разбойники грабят всех, кто идёт на рынок. Власти только руками разводят.' },
  lamia:    { roles: ['elder'], lvl: 3, notIn: FOREIGN_REGIONS, who: 'ламию', reward: 110, xp: 55, plea: 'Ламия у заводи заманивает пастухов песней. Матери не пускают сыновей к реке.' },
  ghouls:   { roles: ['priest'], lvl: 2, who: 'упырей на старом кладбище', reward: 90, xp: 50, plea: 'Кто-то разрывает освящённые могилы и пожирает усопших. Это дело не для стражи, а для твёрдой веры.' },
  coven:    { roles: ['priest'], lvl: 3, who: 'ведьм, что слетаются на поляну', reward: 110, xp: 55, plea: 'На лысой поляне ведьмы служат свою чёрную мессу. Приходи туда ночью — с молитвой и с мечом.' },
  werewolf: { roles: ['priest', 'elder', 'noble'], lvl: 3, who: r => beastLocal(BEASTS.werewolf, r).acc, reward: 130, xp: 65, plea: 'По ночам ходит оборотень. Днём это кто-то из наших — и от этого ещё страшнее.' },
};

function offerLair(npc) {
  const place = npc.village.city;
  if (!['village', 'town', 'castle', 'monastery'].includes(place.kind)) return null;   // большим городам не до того
  // Новичка на людоеда не пошлют: опасные логова — только тому, кто уже чего-то стоит.
  const kinds = Object.keys(LAIR_QUESTS).filter(k => LAIR_QUESTS[k].roles.includes(npc.role) && k !== place.lastLair
    && G.player.level >= (LAIR_QUESTS[k].lvl || 1) && !(LAIR_QUESTS[k].notIn || []).includes(place.region)
    && leadFits(k, place.region));   // орко — в неаполитанских горах, ламия — на юге; ведьмы и оборотни — везде
  if (!kinds.length) return null;
  const kind = rng.pick(kinds), lq = LAIR_QUESTS[kind], spot = findLeadSpot(kind, place);
  if (!spot) return null;
  place.lastLair = kind;
  const days = rng.int(8, 14), reward = questPay(lq.reward * (0.9 + rng.next() * 0.3));
  return {
    type: 'lair', lairKind: kind, spot: { x: spot.x, y: spot.y }, need: 1, have: 0, reward, xp: lq.xp,
    deadline: timeInfo().day + days, label: LEAD_KINDS[kind].name,
    accept: `Возьмусь! (${LEAD_KINDS[kind].name.toLowerCase()}, ${days} дн.)`,
    text: `${lq.plea} ${whereText(place, spot.x, spot.y)} — там логово. Убей ${typeof lq.who === 'function' ? lq.who(place.region) : lq.who} — и получишь ${coins(reward)}. `
      + `Управься за ${days} дней, пока не случилось новой беды.`,
  };
}

function offerKill(npc) {
  const place = npc.village.city, near = beastsNear(place);
  const pool = BEAST_ORDER.filter(k => {
    const d = BEASTS[k];
    return d.quest && d.weight && beastInRegion(d, place.region) && k !== place.lastTarget
      && (!d.minLvl || G.player.level >= d.minLvl) && near.has(k);
  });
  if (!pool.length) return null;
  const key = rng.pick(pool), d = beastLocal(BEASTS[key], place.region);
  place.lastTarget = key;
  const need = d.xp >= 25 ? 1 : d.xp >= 10 ? rng.int(1, 2) : d.xp >= 5 ? rng.int(2, 3) : rng.int(3, 4);
  const reward = questPay(d.xp * need * 1.6 + 5);
  return {
    type: 'kill', target: key, region: place.region, need, have: 0, reward, xp: Math.round(d.xp * need * 0.6) + 3,
    accept: `Берусь! (${d.name} ×${need})`,
    text: `${d.quest} Убей ${numAcc(need, d.g)} — заплачу ${coins(reward)}.`,
  };
}

// Кусок суши, на котором клетка: Гоцо и Мальта — один край, но разные острова.
function landPiece(x, y) {
  const ow = G.over;
  if (!ow._piece) {
    const comp = new Int32Array(ow.w * ow.h).fill(-1);
    let n = 0;
    for (let i = 0; i < comp.length; i++) {
      if (comp[i] >= 0 || !ow.passable(i % ow.w, (i / ow.w) | 0)) continue;
      const st = [i]; comp[i] = n;
      while (st.length) {
        const j = st.pop(), jx = j % ow.w, jy = (j / ow.w) | 0;
        for (const [dx, dy] of DIRS8) {
          const nx = jx + dx, ny = jy + dy;
          if (!ow.passable(nx, ny)) continue;
          const k = ow.idx(nx, ny);
          if (comp[k] < 0) { comp[k] = n; st.push(k); }
        }
      }
      n++;
    }
    Object.defineProperty(ow, '_piece', { value: comp, enumerable: false, configurable: true });
  }
  return ow._piece[ow.idx(x, y)];
}

function offerDelivery(npc) {
  const here = npc.village.city, ow = G.over;
  const [item, roles, value] = rng.pick(CARGO[questRole(npc)]);
  const piece = landPiece(here.x, here.y);
  const fits = c => roles.some(r => PLACE_ROLES[c.kind].includes(r) && !(r === 'priest' && c.names === 'saracen'));
  // Посуху — только туда, куда дойти ногами.
  const options = ow.cities.filter(c => {
    if (c === here || landPiece(c.x, c.y) !== piece) return false;
    const d = Math.max(Math.abs(c.x - here.x), Math.abs(c.y - here.y));
    return d >= 6 * MAP_SCALE && d <= 40 * MAP_SCALE && fits(c);
  });
  // За пролив — если туда ходит лодка: сам путь морем, срок — по плаванию.
  const bySea = SEA_ROUTES.filter(([a, b]) => a === here.id || b === here.id)
    .map(([a, b, days]) => [ow.cities.find(c => c.id === (a === here.id ? b : a)), days])
    .filter(([c, days]) => c && fits(c) && landPiece(c.x, c.y) !== piece && days <= 1);
  if (!options.length && !bySea.length) return null;
  if (bySea.length && (!options.length || rng.chance(0.35))) {
    const [dest, sail] = rng.pick(bySea);
    const role = roles.find(r => PLACE_ROLES[dest.kind].includes(r) && !(r === 'priest' && dest.names === 'saracen'));
    const days = Math.max(3, Math.ceil(sail) + 3), reward = questPay(10 + value * 3), who = roleTitle(dest, role);
    return {
      type: 'deliver', item, to: dest.id, toName: placeTitle(dest), toRole: role, toTitle: who,
      deadline: timeInfo().day + days, reward, xp: 6,
      accept: `Отнесу! («${item}» → ${dest.name}, морем)`,
      text: `Нужно доставить «${item}» в ${placeAcc(dest)} — это ${sail < 1 ? 'за проливом' : 'за морем'}: корабельщик отвезёт за ${sail < 1 ? 'полдня' : `${sail} дн.`}. `
        + `Отдашь лично в руки — ${who}. Срок — ${days} дн. Получатель заплатит ${coins(reward)}.`,
    };
  }
  const dest = rng.pick(options);
  const role = roles.find(r => PLACE_ROLES[dest.kind].includes(r) && !(r === 'priest' && dest.names === 'saracen'));
  const dist = Math.max(Math.abs(dest.x - here.x), Math.abs(dest.y - here.y)) / MAP_SCALE;   // в клетках исходного масштаба
  // Срок — по тому же счёту, каким люди меряют дорогу («с неделю пешком»), с запасом в полтора раза.
  const km = kmBetween(here, dest), days = Math.max(3, Math.ceil(km / 30 * 1.5) + 2);
  const reward = questPay(6 + dist * 0.9 + value * 3);
  const who = roleTitle(dest, role);
  return {
    type: 'deliver', item, to: dest.id, toName: placeTitle(dest), toRole: role, toTitle: who,
    deadline: timeInfo().day + days, reward, xp: Math.round(dist / 2) + 4,
    accept: `Отнесу! («${item}» → ${dest.name})`,
    text: `Нужно доставить «${item}» в ${placeAcc(dest)} — это ${daysText(km)} пешком. Отдашь лично в руки — ${who}. `
      + `Срок — ${days} дн. Получатель заплатит ${coins(reward)}.`,
  };
}

function offerWork(npc) {
  const place = npc.village.city, w = G.world;
  const month = today().m;
  const types = Object.entries(WORK_TYPES).filter(([, t]) => t.places.includes(place.kind) && t.roles.includes(npc.role)
    && (!t.months || t.months.includes(month)));
  for (const [id, t] of rng.shuffle(types)) {
    const spots = workSpots(w, t, npc);
    const need = Math.min(rng.int(t.count[0], t.count[1]), spots.length);
    if (need < t.count[0] - 2) continue;
    const pay = questPay(need * t.pay + 5);
    return {
      type: 'work', work: id, label: t.label, need, have: 0, reward: pay, xp: need + 2,
      accept: `Помогу! (${t.label}, ${need})`,
      text: `${t.text(need)} Заплачу ${coins(pay)}.`,
    };
  }
  return null;
}

// Клетки, где может появиться работа: не дальше 30 шагов от площади.
function workSpots(w, t, npc) {
  const v = npc.village, out = [];
  for (let y = 1; y < w.h - 1; y++)
    for (let x = 1; x < w.w - 1; x++) {
      if (!t.from.includes(w.get(x, y)) || w.building[w.idx(x, y)] !== -1 || w.actorAt(x, y)) continue;
      if (Math.max(Math.abs(x - v.cx) / 2, Math.abs(y - v.cy)) > 22) continue;
      const inside = w.zone[w.idx(x, y)] !== -1;
      if (t.inside !== undefined && inside !== t.inside) continue;
      out.push([x, y]);
    }
  return out;
}

function acceptQuest(npc, o) {
  const p = G.player, place = npc.village.city;
  const q = { ...o, giver: giverKey(npc), from: place.id, fromName: place.name, giverName: `${npc.title} ${npc.name}`, day: timeInfo().day, done: false, id: `q${G.turn}_${rng.int(0, 1e6)}` };
  if (o.type === 'lair') {
    // Логово появляется на карте и ждёт до конца срока.
    const lead = createLead(o.lairKind, { ...o.spot, anchor: place }, { quest: q.id, until: o.deadline });
    q.lead = lead.id;
    // Стоянку воров не отмечают: её ещё надо найти.
    if (o.hidden) { lead.known = false; lead.chief = o.look; lead.saint = o.saint; }
    delete q.spot;
  }
  if (o.type === 'relic') createRelicSite(q, place);
  if (o.type === 'work') {
    // Работа появляется на карте.
    const t = WORK_TYPES[o.work], spots = rng.shuffle(workSpots(G.world, t, npc)).slice(0, o.need);
    G.world.work = G.world.work || new Map();
    for (const [x, y] of spots) {
      G.world.work.set(G.world.idx(x, y), q.id);
      G.world.set(x, y, t.tile);
    }
    q.need = spots.length;
  }
  p.quests.push(q);
  npc.offer = null;
  log(`Новое задание: ${questLine(q)}.`, C.gold);
}

// ─── Ход заданий ───────────────────────────────────────────────────

function questKill(key) {
  for (const q of G.player.quests) {
    if (q.type !== 'kill' || q.done || q.target !== key) continue;
    if (++q.have >= q.need) {
      q.done = true;
      log(`Охота окончена (${q.fromName}). Возвращайся за наградой.`, C.gold);
    }
  }
}

// Игрок наступил на клетку с работой.
function questWorkStep(x, y) {
  const w = G.world, i = w.idx(x, y);
  if (!w.work || !w.work.has(i)) return;
  const q = G.player.quests.find(q => q.id === w.work.get(i));
  if (!q) return;
  const t = WORK_TYPES[q.work];
  w.work.delete(i);
  w.set(x, y, t.after);
  q.have++;
  log(`${t.step} (${q.have}/${q.need}).`, C.text);
  // Работа отнимает время.
  for (let k = 0; k < 3 && G.player.hp > 0 && G.world === w; k++) endTurn();
  if (q.have >= q.need && !q.done) {
    q.done = true;
    log(`Работа сделана. Возвращайся к тому, кто тебя нанял (${q.fromName}).`, C.gold);
  }
}

function questLine(q) {
  if (q.type === 'story') return `${q.label}${q.fromName ? ' · ' + q.fromName : ''}`;
  if (q.type === 'lair') {
    const left = q.deadline - timeInfo().day;
    return `${q.label}${q.done ? ' ✓' : left >= 0 ? ` (ещё ${left} дн.)` : ' (опоздал)'} · ${q.fromName}`;
  }
  if (q.type === 'kill') return `${beastLocal(BEASTS[q.target], q.region).name} ${q.have}/${q.need}${q.done ? ' ✓' : ''} · ${q.fromName}`;
  if (q.type === 'trophy') { const h = Math.min(q.need, trophyHave(q)); return `${q.label} ${h}/${q.need}${h >= q.need ? ' ✓' : ''} · ${q.fromName}`; }
  if (q.type === 'relic') return `${q.label}${q.done ? ' ✓' : ''} · ${q.fromName}`;
  if (q.type === 'escort') return q.label;
  if (q.type === 'work') return `${q.label} ${q.have}/${q.need}${q.done ? ' ✓' : ''} · ${q.fromName}`;
  const left = q.deadline - timeInfo().day;
  return `«${q.item}» → ${q.toName} (${left >= 0 ? `ещё ${left} дн.` : 'опоздал'})`;
}

// ─── Реплики в диалоге ─────────────────────────────────────────────

function questOptions(npc) {
  const p = G.player, opts = [], place = npc.village.city;

  // Доставка: этот житель — получатель.
  for (const q of p.quests) {
    if (q.type !== 'deliver' || q.to !== place.id || q.toRole !== npc.role) continue;
    opts.push({ label: `Передать: «${q.item}»`, act: () => {
      const late = timeInfo().day > q.deadline;
      const pay = late ? Math.ceil(q.reward / 2) : q.reward;
      p.quests = p.quests.filter(x => x !== q);
      p.coins += pay;
      p.gainXp(q.xp);
      faithDeed('quest', { q, late, place });
      addFame(late ? -1 : 1);
      chronicle(`Доставил «${q.item}» в ${placeAcc(place)}${late ? ' — с опозданием' : ''}.`, 'quest');
      log(`Доставлено: «${q.item}». Получено ${pay} мон.`, C.gold);
      return late
        ? `Долго же ты шёл. Ладно, вот ${coins(pay)} — половина, за опоздание не обессудь.`
        : `Наконец-то! Всё цело? Вот ${coins(pay)}, как обещано. Спасибо, добрый человек.`;
    } });
  }

  if (!QUEST_GIVERS[questRole(npc)]) return opts;
  const mine = questsFrom(npc);
  for (const q of mine) {
    if (q.type === 'trophy' && trophyHave(q) >= q.need) {
      opts.push({ label: `Вот: ${q.label.toLowerCase()} — ${q.need} шт.`, act: () => {
        const t = p.trophies[q.trophy];
        t.count -= q.need;
        if (!t.count) delete p.trophies[q.trophy];
        p.quests = p.quests.filter(x => x !== q);
        p.coins += q.reward;
        p.gainXp(q.xp);
        faithDeed('quest', { q, place });
        addFame(1);
        chronicle(`Добыл трофеи охоты по заказу замка (${place.name}): ${q.label.toLowerCase()} ×${q.need}.`, 'quest');
        npc.noWorkUntil = timeInfo().day + rng.int(2, 5);
        log(`Отдано: ${q.label.toLowerCase()} ×${q.need}. Получено: ${coins(q.reward)}.`, C.gold);
        return rng.pick([`Добрая добыча. Вот ${coins(q.reward)}, как уговаривались. Сеньор будет доволен.`,
          `Хороши! Без единой дыры. Держи ${coins(q.reward)} — и заходи, если охота пойдёт.`]);
      } });
      continue;
    }
    if (q.done && q.type === 'relic') {
      opts.push({ label: `Вот мощи ${q.saint}`, act: () => relicReward(q, npc) });
    } else if (q.done) {
      opts.push({ label: 'Работа сделана. Где моя награда?', act: () => {
        p.quests = p.quests.filter(x => x !== q);
        p.coins += q.reward;
        p.gainXp(q.xp);
        faithDeed('quest', { q, place });
        if (q.lairKind === 'thieves') addPiety(4, 'Святыня возвращена в храм.');
        if (q.type === 'lair') addFame(q.lairKind === 'thieves' ? 3 : 3, q.lairKind === 'thieves' ? `вернул украденные мощи в ${placeAcc(place)}` : `избавил ${placeAcc(place)} от напасти`);
        else addFame(1);
        chronicle(q.type === 'lair' ? `Исполнил трудное поручение (${q.giverName}, ${q.fromName}): ${q.label.toLowerCase()} очищено.`
          : q.type === 'kill' ? `Избавил ${placeAcc(place)} от напасти: ${beastLocal(BEASTS[q.target], q.region).name.toLowerCase()} ×${q.need}.`
          : `Помог в ${place.kind === 'village' ? 'деревне ' + place.name : place.name}: ${q.label.toLowerCase()}.`, 'quest');
        npc.noWorkUntil = timeInfo().day + rng.int(1, 4);
        log(`Получено: ${coins(q.reward)}.`, C.gold);
        return `Спасибо тебе. Вот ${coins(q.reward)}, как уговаривались. Заходи ещё.`;
      } });
    } else if (q.type !== 'deliver') {
      opts.push({ label: 'Насчёт работы...', act: () => `${questLine(q)}. Ступай, ${p.name}, работа сама себя не сделает.` });
      opts.push({ label: 'Я не справлюсь. Отказываюсь.', act: () => {
        p.quests = p.quests.filter(x => x !== q);
        faithDeed('refuse');
        addFame(-1);
        return 'Жаль. Найду кого-нибудь другого.';
      } });
    }
  }
  if (mine.length) return opts;

  if (npc.offer) {
    const o = npc.offer;
    opts.push({ label: o.accept, act: () => {
      if (p.quests.length >= MAX_QUESTS) return 'У тебя и так дел по горло. Закончи начатое, тогда приходи.';
      npc.offer = null;
      if (o.story === 'cult') return cultAccept(npc, o);
      if (o.story === 'crusade') return crusadeAccept(npc);
      acceptQuest(npc, o);
      return o.type === 'deliver' ? 'Держи. И смотри не потеряй — головой отвечаешь.' : 'Вот и славно. Да хранит тебя Бог.';
    } });
    opts.push({ label: 'Не сейчас.', act: () => { npc.offer = null; return 'Как знаешь. Надумаешь — приходи.'; } });
  } else {
    opts.push({ label: 'Нет ли для меня работы?', act: () => {
      if (npc.role === 'noble' && fameOf() < 10)
        return `${npc.title} смотрит сквозь тебя. «Я не веду дел с безвестными бродягами. Пусть сначала о тебе услышат в округе». (Нужна слава.)`;
      npc.offer = askForWork(npc);
      if (!npc.offer) return speak(npc, rng.pick(NO_WORK));
      if (npc.offer.story) return npc.offer.text;
      // Красноречивый выторговывает награду побольше.
      const o = npc.offer, lvl = skillLevel(p, 'speech'), bonus = Math.round(o.reward * (lvl * 0.05 + fameRewardMult() - 1));
      trainSkill(p, 'speech', 2);
      if (bonus > 0 && !o.haggled) {
        o.haggled = true;
        o.reward += bonus;
        return `${o.text} ${lvl ? 'Ты уговариваешь накинуть' : (npc.female ? 'Наслышанная о тебе, она сама накидывает' : 'Наслышанный о тебе, он сам накидывает')} — сходитесь на ${o.reward} монетах.`;
      }
      return o.text;
    } });
  }
  return opts;
}
