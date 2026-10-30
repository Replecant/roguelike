'use strict';

// ─── Задания ───────────────────────────────────────────────────────
// Четыре вида:
//   kill    — убить зверей; награду платит тот, кто дал задание;
//   lair    — сложное: житель указывает логово чудища рядом, его надо зачистить до срока;
//   deliver — отнести груз в другое поселение; платит получатель;
//   work    — помочь на месте: работа появляется на карте, на неё надо наступить.

const MAX_QUESTS = 6;

// Кто какие задания даёт.
const QUEST_GIVERS = {
  elder: ['kill', 'kill', 'lair', 'work', 'deliver'],
  priest: ['deliver', 'lair'],
  innkeeper: ['deliver', 'work'],
  smith: ['deliver'],
  herbalist: ['work', 'deliver'],
};

// Грузы: [название, кому везти (роли по порядку предпочтения), ценность].
const CARGO = {
  elder: [['Письмо', ['elder'], 0], ['Опечатанный свиток', ['elder'], 2], ['Налоговая ведомость', ['elder'], 1],
    ['Мешочек серебра', ['elder'], 6]],
  priest: [['Письмо епископу', ['priest'], 1], ['Ларец с мощами', ['priest'], 6], ['Требник', ['priest'], 2],
    ['Сосуд со святой водой', ['priest'], 3]],
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
  castle: ['elder', 'smith'],
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

const giverKey = npc => `${npc.village.city.id}:${npc.role}`;

function questsFrom(npc) {
  return G.player.quests.filter(q => q.giver === giverKey(npc));
}

// Как назвать жителя поселения: «староста», «подеста», «аббат»...
function roleTitle(place, role) {
  const own = cityPlan(place).titles && cityPlan(place).titles[role];
  if (own) return (Array.isArray(own) ? own[0] : own).toLowerCase();
  if (role === 'elder') return (place.kind === 'village' ? 'Староста' : REGIONS[place.region].elder).toLowerCase();
  return ROLES[role].title.toLowerCase();
}

const landmass = region => ['sicily', 'sardinia', 'corsica'].includes(region) ? region : 'mainland';

// ─── Предложения ───────────────────────────────────────────────────

function makeOffer(npc) {
  const kinds = rng.shuffle((QUEST_GIVERS[npc.role] || []).slice());
  for (const kind of kinds) {
    const o = kind === 'kill' ? offerKill(npc) : kind === 'lair' ? offerLair(npc) : kind === 'deliver' ? offerDelivery(npc) : offerWork(npc);
    if (o) return o;
  }
  return null;
}

// Логова, на которые посылают: кто посылает, о ком речь, награда.
const LAIR_QUESTS = {
  orco:     { roles: ['elder'], who: 'людоеда орко', reward: 120, xp: 60, plea: 'Орко уже утащил двух детей. Мужики боятся выйти в поле.' },
  bear:     { roles: ['elder'], who: 'медведя-шатуна', reward: 90, xp: 45, plea: 'Шатун задрал пастуха и разорил все пасеки. Охотники ходили — вернулись не все.' },
  den:      { roles: ['elder'], who: 'матёрого волка и его стаю', reward: 70, xp: 35, plea: 'Волки режут овец у самых загонов. Вожак с белой отметиной — умнее любого охотника.' },
  camp:     { roles: ['elder'], who: 'атамана и его шайку', reward: 100, xp: 50, plea: 'Разбойники грабят всех, кто идёт на рынок. Подеста только руками разводит.' },
  lamia:    { roles: ['elder'], who: 'ламию', reward: 110, xp: 55, plea: 'Ламия у заводи заманивает пастухов песней. Матери не пускают сыновей к реке.' },
  ghouls:   { roles: ['priest'], who: 'упырей на старом кладбище', reward: 90, xp: 50, plea: 'Кто-то разрывает освящённые могилы и пожирает усопших. Это дело не для стражи, а для твёрдой веры.' },
  coven:    { roles: ['priest'], who: 'ведьм, что слетаются на поляну', reward: 110, xp: 55, plea: 'На лысой поляне ведьмы служат свою чёрную мессу. Приходи туда ночью — с молитвой и с мечом.' },
  werewolf: { roles: ['priest', 'elder'], who: 'лупо маннаро', reward: 130, xp: 65, plea: 'По ночам ходит оборотень. Днём это кто-то из наших — и от этого ещё страшнее.' },
};

function offerLair(npc) {
  const place = npc.village.city;
  if (!['village', 'town', 'castle', 'monastery'].includes(place.kind)) return null;   // большим городам не до того
  const kinds = Object.keys(LAIR_QUESTS).filter(k => LAIR_QUESTS[k].roles.includes(npc.role) && k !== place.lastLair);
  if (!kinds.length) return null;
  const kind = rng.pick(kinds), lq = LAIR_QUESTS[kind], spot = findLeadSpot(kind, place);
  if (!spot) return null;
  place.lastLair = kind;
  const days = rng.int(8, 14), reward = Math.round(lq.reward * (0.9 + rng.next() * 0.3));
  return {
    type: 'lair', lairKind: kind, spot: { x: spot.x, y: spot.y }, need: 1, have: 0, reward, xp: lq.xp,
    deadline: timeInfo().day + days, label: LEAD_KINDS[kind].name,
    accept: `Возьмусь! (${LEAD_KINDS[kind].name.toLowerCase()}, ${days} дн.)`,
    text: `${lq.plea} ${whereText(place, spot.x, spot.y)} — там логово. Убей ${lq.who} — и получишь ${reward} монет. `
      + `Управься за ${days} дней, пока не случилось новой беды.`,
  };
}

function offerKill(npc) {
  const place = npc.village.city;
  const pool = BEAST_ORDER.filter(k => {
    const d = BEASTS[k];
    return d.quest && d.weight && beastInRegion(d, place.region) && k !== place.lastTarget;
  });
  if (!pool.length) return null;
  const key = rng.pick(pool), d = BEASTS[key];
  place.lastTarget = key;
  const need = d.xp >= 25 ? 1 : d.xp >= 10 ? rng.int(1, 2) : d.xp >= 5 ? rng.int(2, 3) : rng.int(3, 4);
  const reward = Math.round(d.xp * need * 1.6 + 5);
  return {
    type: 'kill', target: key, need, have: 0, reward, xp: Math.round(d.xp * need * 0.6) + 3,
    accept: `Берусь! (${d.name} ×${need})`,
    text: `${d.quest} Убей ${numAcc(need, d.g)} — заплачу ${reward} монет.`,
  };
}

function offerDelivery(npc) {
  const here = npc.village.city, ow = G.over;
  const [item, roles, value] = rng.pick(CARGO[npc.role]);
  const land = landmass(here.region);
  const options = ow.cities.filter(c => {
    if (c === here || landmass(c.region) !== land) return false;
    const d = Math.max(Math.abs(c.x - here.x), Math.abs(c.y - here.y));
    return d >= 6 * MAP_SCALE && d <= 40 * MAP_SCALE && roles.some(r => PLACE_ROLES[c.kind].includes(r));
  });
  if (!options.length) return null;
  const dest = rng.pick(options);
  const role = roles.find(r => PLACE_ROLES[dest.kind].includes(r));
  const dist = Math.max(Math.abs(dest.x - here.x), Math.abs(dest.y - here.y)) / MAP_SCALE;   // в клетках исходного масштаба
  const days = Math.ceil(dist * 2.5 / 24) + 2;
  const reward = Math.round(6 + dist * 0.9 + value * 3);
  const who = roleTitle(dest, role);
  return {
    type: 'deliver', item, to: dest.id, toName: placeTitle(dest), toRole: role, toTitle: who,
    deadline: timeInfo().day + days, reward, xp: Math.round(dist / 2) + 4,
    accept: `Отнесу! («${item}» → ${dest.name})`,
    text: `Нужно доставить «${item}» в ${placeAcc(dest)}. Отдашь лично в руки — ${who}. `
      + `Срок — ${days} дн. Получатель заплатит ${reward} монет.`,
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
    return {
      type: 'work', work: id, label: t.label, need, have: 0, reward: need * t.pay + 5, xp: need + 2,
      accept: `Помогу! (${t.label}, ${need})`,
      text: `${t.text(need)} Заплачу ${need * t.pay + 5} монет.`,
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
    delete q.spot;
  }
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
  if (q.type === 'lair') {
    const left = q.deadline - timeInfo().day;
    return `${q.label}${q.done ? ' ✓' : left >= 0 ? ` (ещё ${left} дн.)` : ' (опоздал)'} · ${q.fromName}`;
  }
  if (q.type === 'kill') return `${BEASTS[q.target].name} ${q.have}/${q.need}${q.done ? ' ✓' : ''} · ${q.fromName}`;
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
      log(`Доставлено: «${q.item}». Получено ${pay} мон.`, C.gold);
      return late
        ? `Долго же ты шёл. Ладно, вот ${pay} монет — половина, за опоздание не обессудь.`
        : `Наконец-то! Всё цело? Вот ${pay} монет, как обещано. Спасибо, добрый человек.`;
    } });
  }

  if (!QUEST_GIVERS[npc.role]) return opts;
  const mine = questsFrom(npc);
  for (const q of mine) {
    if (q.done) {
      opts.push({ label: 'Работа сделана. Где моя награда?', act: () => {
        p.quests = p.quests.filter(x => x !== q);
        p.coins += q.reward;
        p.gainXp(q.xp);
        faithDeed('quest', { q, place });
        npc.noWorkUntil = timeInfo().day + rng.int(1, 4);
        log(`Получено: ${q.reward} монет.`, C.gold);
        return `Спасибо тебе. Вот ${q.reward} монет, как уговаривались. Заходи ещё.`;
      } });
    } else if (q.type !== 'deliver') {
      opts.push({ label: 'Насчёт работы...', act: () => `${questLine(q)}. Ступай, ${p.name}, работа сама себя не сделает.` });
      opts.push({ label: 'Я не справлюсь. Отказываюсь.', act: () => {
        p.quests = p.quests.filter(x => x !== q);
        faithDeed('refuse');
        return 'Жаль. Найду кого-нибудь другого.';
      } });
    }
  }
  if (mine.length) return opts;

  if (npc.offer) {
    const o = npc.offer;
    opts.push({ label: o.accept, act: () => {
      if (p.quests.length >= MAX_QUESTS) return 'У тебя и так дел по горло. Закончи начатое, тогда приходи.';
      acceptQuest(npc, o);
      return o.type === 'deliver' ? 'Держи. И смотри не потеряй — головой отвечаешь.' : 'Вот и славно. Да хранит тебя Бог.';
    } });
    opts.push({ label: 'Не сейчас.', act: () => { npc.offer = null; return 'Как знаешь. Надумаешь — приходи.'; } });
  } else {
    opts.push({ label: 'Нет ли для меня работы?', act: () => {
      npc.offer = askForWork(npc);
      return npc.offer ? npc.offer.text : speak(npc, rng.pick(NO_WORK));
    } });
  }
  return opts;
}
