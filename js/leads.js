'use strict';

// ─── События на карте («наводки») ──────────────────────────────────
// Жители иногда рассказывают о конкретном месте поблизости. Место отмечается
// на карте знаком «!». Через несколько дней событие исчезает.

const LEAD_KINDS = {
  caravan: {
    name: 'Разграбленный караван', w: 3, tag: 'trade', road: true, spot: 'перевёрнутые повозки на дороге и рассыпанные мешки',
    rumor: (where) => `${where} разбойники напали на купеческий обоз. Повозки, говорят, так и бросили на дороге — с товаром.`,
    arrive: 'Перевёрнутые повозки, рассыпанные мешки, следы крови на дороге. Разбойники ещё не ушли.',
  },
  camp: {
    name: 'Лагерь разбойников', w: 2, tag: 'war', spot: 'дым костра в лесу и палатки из краденой парусины',
    rumor: (where) => `${where} в лесу встали лагерем разбойники. Атаман у них — бывший наёмник, а в сундуке — всё, что награбили за лето.`,
    arrive: 'Дым костра, палатки из краденой парусины. Кто-то точит нож и насвистывает.',
  },
  battlefield: {
    name: 'Поле боя', w: 0, tag: 'war', spot: 'стаю ворон над полем и брошенное знамя',
    rumor: (where) => `${where} сшиблись гвельфы с гибеллинами. Мёртвых так и не убрали.`,
    arrive: 'Над полем кружат вороны. Мёртвые лежат, где упали, — в кольчугах и без; рядом бродят мародёры.',
  },
  thieves: {
    name: 'Стоянка воров', w: 0, tag: 'church', spot: 'угли костра, примятую траву и обрывок церковной парчи на ветке',
    rumor: (where) => `${where} видели чужаков с тяжёлым ларцом.`,
    arrive: 'Шалаш из веток, костёр, сваленные мешки. У огня сидят люди — и один из них поднимается, хватаясь за нож.',
  },
  den: {
    name: 'Волчье логово', w: 3, tag: 'common', spot: 'обглоданные кости и клочья волчьей шерсти',
    rumor: (where) => `${where} волчье логово. Вожак — матёрый, с белой отметиной. Пастухи туда не суются, а пропавших путников так и не нашли.`,
    arrive: 'Обглоданные кости, клочья шерсти и тяжёлый звериный дух. Из чащи смотрят жёлтые глаза.',
  },
  treasure: {
    name: 'Старый клад', w: 2, tag: 'common', spot: 'развалины часовни в ежевике — земля у алтаря перекопана',
    rumor: (where) => `${where} у развалин старой часовни зарыт клад. Тамплиеры, говорят, прятали. Только кто туда ходил — седым возвращался.`,
    arrive: 'Развалины часовни, заросшие ежевикой. Воздух холодный, как в погребе. Здесь кто-то есть — и он не жив.',
  },
  hermit: {
    name: 'Хижина отшельника', w: 2, tag: 'church', spot: 'каменную хижину с крестом из двух ветвей',
    rumor: (where) => `${where} в лесу живёт святой отшельник. Говорят, исцеляет одним словом — если придёшь с чистым сердцем.`,
    arrive: 'Крохотная хижина из камня, крест из двух ветвей. Пахнет травами и воском.',
  },
  // ── Логова чудищ ──
  orco: {
    name: 'Логово орко', w: 1, tag: 'common', lair: true,
    rumor: (where) => `${where} в пещере у ручья поселился орко — людоед ростом с амбар. Утащил двух детей и тёлку. Староста обещал награду, да никто не пошёл.`,
    arrive: 'Вонь падали, кострище с обглоданными костями — и человечьими тоже. Из пещеры доносится храп, от которого дрожит земля.',
    spot: 'в стороне от тропы — кострище, огромные следы босых ног и обглоданные кости',
  },
  ghouls: {
    name: 'Разорённое кладбище', w: 2, tag: 'church', lair: true,
    rumor: (where) => `${where} на старом кладбище кто-то разрывает могилы. Сторож видел: не собаки — на двух ногах, и едят прямо там.`,
    arrive: 'Покосившиеся кресты, разрытые могилы, вывороченные гробы. Над свежей ямой кто-то возится и чавкает.',
    spot: 'покосившиеся кресты старого кладбища и разрытые могилы',
  },
  lamia: {
    name: 'Гнездо ламии', w: 1, tag: 'common', lair: true,
    rumor: (where) => `${where} у заводи живёт ламия: сверху — красавица, снизу — змея. Заманивает пастухов песней. Ни один не вернулся.`,
    arrive: 'Тихая заводь в камышах, по воде расходятся круги. На берегу — сброшенная змеиная кожа длиной в три человеческих роста.',
    spot: 'на берегу заводи — сброшенная змеиная кожа длиной в три человеческих роста',
  },
  coven: {
    name: 'Ведьмин круг', w: 1, tag: 'church', lair: true, night: true,
    rumor: (where) => `${where} на лысой поляне ведьмы водят хороводы. Пастух видел ночью огни и чёрного пса величиной с телёнка.`,
    arrive: 'Лысая поляна, выжженный круг, на ветках — тряпичные куклы и птичьи черепа.',
    spot: 'выжженный круг на поляне и тряпичных кукол на ветках',
  },
  bear: {
    name: 'Берлога шатуна', w: 2, tag: 'common', lair: true,
    rumor: (where) => `${where} бродит медведь-шатун. Разорил пасеки, задрал пастуха. Охотники ходили — вернулись не все.`,
    arrive: 'Поваленные деревья, ободранная кора на высоте человеческого роста, разорённые колоды пчёл. Шатун где-то рядом.',
    spot: 'ободранную на высоте человеческого роста кору и разорённые колоды пчёл',
  },
  werewolf: {
    name: 'Следы оборотня', w: 1, tag: 'common', night: true,
    spot: 'огромные волчьи следы — на двух ногах',
    rumor: (where) => `${where} по ночам ходит лупо маннаро. Растерзал двух овчаров. Днём только следы — огромные, волчьи, но на двух ногах.`,
    arrive: 'Следы огромных лап, идущие на двух ногах. Ветки сломаны на высоте человеческого роста.',
  },
};

const COMPASS_DIRS = ['к востоку', 'к юго-востоку', 'к югу', 'к юго-западу', 'к западу', 'к северо-западу', 'к северу', 'к северо-востоку'];

// «к югу от Сиены, в полудне пути».
function whereText(anchor, x, y) {
  const ang = Math.atan2((y - anchor.y) * 2, x - anchor.x);
  const dir = COMPASS_DIRS[(Math.round(ang / (Math.PI / 4)) + 8) % 8];
  const km = Math.hypot((x - anchor.x) * GEO.kmX, (y - anchor.y) * GEO.kmY);
  const how = km < 12 ? 'совсем недалеко' : km < 25 ? 'в полудне пути' : 'в дне пути';
  const quoted = anchor.name.match(/«.*»/);
  const from = anchor.kind === 'village' ? `деревни ${anchor.name}` : anchor.kind === 'city' || anchor.kind === 'town'
    ? `города ${anchor.name}` : anchor.kind === 'inn' ? `постоялого двора ${quoted ? quoted[0] : anchor.name}`
    : anchor.kind === 'monastery' ? `монастыря ${anchor.name}` : anchor.kind === 'castle' ? `замка ${anchor.name.replace(/^Рокка /, '')}` : anchor.name;
  return `${dir[0].toUpperCase() + dir.slice(1)} от ${from}, ${how},`;
}

// Найти место для события рядом с поселением anchor (или любым).
function findLeadSpot(kind, anchor) {
  const ow = G.over, def = LEAD_KINDS[kind];
  const anchors = anchor ? [anchor] : ow.cities.filter(c => ['city', 'town', 'village'].includes(c.kind));
  for (let t = 0; t < 120; t++) {
    const a = rng.pick(anchors);
    const r = rng.int(4, 12) * MAP_SCALE / 2, ang = rng.next() * Math.PI * 2;
    let x = Math.round(a.x + Math.cos(ang) * r), y = Math.round(a.y + Math.sin(ang) * r / 2);
    if (def.road) {
      // Караван — на ближайшей дороге.
      let best = null;
      for (let dy = -6; dy <= 6; dy++)
        for (let dx = -10; dx <= 10; dx++)
          if (ow.inside(x + dx, y + dy) && ow.road[ow.idx(x + dx, y + dy)] >= 0 && !ow.placeAt(x + dx, y + dy)
            && (!best || Math.abs(dx) + Math.abs(dy) < best[2])) best = [x + dx, y + dy, Math.abs(dx) + Math.abs(dy)];
      if (!best) continue;
      [x, y] = best;
    }
    if (!ow.passable(x, y) || ow.placeAt(x, y) || ow.get(x, y) === OT.RIVER) continue;
    if (Math.max(Math.abs(a.x - x), Math.abs(a.y - y)) < 2) continue;
    if (G.leads.some(l => Math.abs(l.x - x) < 4 && Math.abs(l.y - y) < 3)) continue;
    return { x, y, anchor: a };
  }
  return null;
}

// Создать событие. Без quest — о нём узнают из слухов; с quest — место
// указал тот, кто дал задание, и оно ждёт до конца срока.
function createLead(kind, spot, opts = {}) {
  const def = LEAD_KINDS[kind], day = timeInfo().day, { x, y, anchor: a } = spot;
  const lead = {
    id: `lead${G.leadCount = (G.leadCount || 0) + 1}`, kind, name: def.name, x, y, anchor: a.name,
    day, until: opts.until || day + rng.int(6, 15), known: !!opts.quest, done: false, quest: opts.quest || null,
  };
  lead.rumor = def.rumor(whereText(a, x, y));
  G.leads.push(lead);
  if (!opts.quest) addNews({ day, text: lead.rumor, x, y, tag: def.tag, lead: lead.id });
  return lead;
}

function spawnLead() {
  const kind = rng.weighted(Object.entries(LEAD_KINDS).map(([k, d]) => ({ k, w: d.w }))).k;
  const spot = findLeadSpot(kind);
  return spot ? createLead(kind, spot) : null;
}

function leadsTick() {
  G.leads = G.leads || [];
  const day = timeInfo().day;
  // Не успел к сроку: чудище ушло, задание провалено.
  const p = G.player;
  for (const q of p.quests.filter(q => q.type === 'lair' && !q.done && q.deadline < day)) {
    p.quests = p.quests.filter(x => x !== q);
    log(`Срок вышел: ${q.label.toLowerCase()} опустело — тварь ушла дальше. Задание «${q.label}» провалено.`, C.red);
    addPiety(-1, '');
  }
  // Истёкшие исчезают, если игрок не стоит прямо там.
  G.leads = G.leads.filter(l => l.until >= day || (G.mode === 'local' && G.world && G.world.lead === l));
  const active = G.leads.filter(l => !l.done).length;
  if (active < 16 && rng.chance(0.75)) spawnLead();
  if (active < 6) spawnLead();
}

function activeLeadAt(x, y) {
  return (G.leads || []).find(l => l.known && l.x === x && l.y === y && l.until >= timeInfo().day);
}

// ─── Место события ─────────────────────────────────────────────────

function enterLead(lead) {
  G.leadMaps = G.leadMaps || {};
  let world = openStored(G.leadMaps, lead.id);
  const def = LEAD_KINDS[lead.kind];
  if (!world) world = G.leadMaps[lead.id] = buildPlace(`lead:${lead.id}`);
  G.world = world;
  const [x, y] = entryPoint(world, 1, 0);
  placePlayer(world, x, y);
  log(lead.done ? `${lead.name}. Здесь уже всё кончено.` : `${lead.name}. ${def.arrive}`, lead.done ? C.dim : C.violet);
  if (LEAD_KINDS[lead.kind].night && !lead.done) wakeWerewolf(world, lead);
  spawnBeasts(4, isNight(), false, 14);
}

function leadSpot(world, cx, cy, rad = 4) {
  for (let t = 0; t < 200; t++) {
    const x = cx + rng.int(-rad * 2, rad * 2), y = cy + rng.int(-rad, rad);
    if (world.free(x, y)) return [x, y];
  }
  return null;
}

function leadBeast(world, lead, key, x, y) {
  const spot = leadSpot(world, x, y, 3);
  if (!spot) return null;
  const m = makeBeast(key, spot[0], spot[1]);
  m.leadId = lead.id;
  world.actors.push(m);
  lead.left = (lead.left || 0) + 1;
  return m;
}

function setContainer(world, x, y, tile, loot) {
  world.set(x, y, tile);
  world.containers = world.containers || new Map();
  world.containers.set(world.idx(x, y), loot);
}

function clearArea(world, cx, cy, rx, ry, tile = T.GRASS) {
  for (let y = cy - ry; y <= cy + ry; y++)
    for (let x = cx - rx; x <= cx + rx; x++)
      if (world.inside(x, y) && Math.hypot((x - cx) / rx, (y - cy) / ry) <= 1 && world.get(x, y) !== T.ROAD) world.set(x, y, tile);
}

function setupLead(world, lead) {
  const cx = world.w >> 1, cy = world.h >> 1;
  // Тропа от края карты к месту — чтобы не упереться в скалы.
  for (let x = 1; x <= cx + 4; x++)
    if (!world.walkable(x, cy)) world.set(x, cy, [T.WATER, T.SEA, T.CANAL].includes(world.get(x, cy)) ? T.FORD : T.DIRT);
  switch (lead.kind) {
    case 'caravan': {
      clearArea(world, cx + 6, cy, 7, 3);
      world.set(cx + 6, cy, T.WAGON);
      world.set(cx + 9, cy + 1, T.WAGON);
      for (const [dx, dy] of [[5, -2], [8, -1], [4, 2], [10, -2], [11, 2]]) setContainer(world, cx + dx, cy + dy, T.CRATE, 'goods');
      const n = rng.int(3, 4);
      for (let i = 0; i < n; i++) leadBeast(world, lead, 'brigand', cx + 8, cy);
      break;
    }
    case 'camp': {
      clearArea(world, cx + 8, cy, 9, 4);
      for (const [dx, dy] of [[4, -2], [12, -2], [5, 3], [13, 2]]) world.set(cx + dx, cy + dy, T.TENT);
      world.set(cx + 8, cy, T.CAMPFIRE);
      setContainer(world, cx + 14, cy, T.CHEST, 'camp');
      leadBeast(world, lead, 'brigand_chief', cx + 10, cy);
      const n = rng.int(3, 5);
      for (let i = 0; i < n; i++) leadBeast(world, lead, 'brigand', cx + 8, cy);
      break;
    }
    case 'battlefield': {
      clearArea(world, cx + 8, cy, 12, 6, T.GRASS);
      const fallen = Math.min(22, 8 + (lead.fallen || 6));
      for (let i = 0; i < fallen; i++) { const s = leadSpot(world, cx + 8, cy, 6); if (s) world.set(s[0], s[1], T.BONES); }
      for (let i = 0; i < 2; i++) { const s = leadSpot(world, cx + 8, cy, 5); if (s) world.set(s[0], s[1], T.BANNER); }
      // Брошенное оружие и доспех; кошели убитых.
      const loot = ['sword', 'axe', 'mace', 'spear', 'shield', 'nasal', 'gambeson', 'leather', 'mail', 'crossbow', 'cap', 'kite'];
      for (let i = 0, n = rng.int(3, 6); i < n; i++) {
        const s = leadSpot(world, cx + 8, cy, 6);
        if (!s) continue;
        const it = makeItem(rng.pick(loot));
        world.addItem(s[0], s[1], { kind: 'gear', item: it, name: it.name });
      }
      for (let i = 0, n = rng.int(2, 4); i < n; i++) { const s = leadSpot(world, cx + 8, cy, 6); if (s) world.addItem(s[0], s[1], { kind: 'coins', name: 'монеты', value: rng.int(3, 15) }); }
      for (let i = 0, n = rng.int(2, 3); i < n; i++) { const m = leadBeast(world, lead, 'grave_robber', cx + 10, cy); if (m) m.name = 'Мародёр'; }
      for (let i = 0; i < 3; i++) { const s = leadSpot(world, cx + 8, cy, 6); if (s && BEASTS.crow) world.actors.push(makeBeast('crow', s[0], s[1])); }
      break;
    }
    case 'thieves': {
      clearArea(world, cx + 8, cy, 8, 4);
      for (const [dx, dy] of [[5, -2], [11, 2]]) world.set(cx + dx, cy + dy, T.TENT);
      world.set(cx + 8, cy, T.CAMPFIRE);
      setContainer(world, cx + 12, cy, T.CHEST, 'stolen_relic');
      const chief = leadBeast(world, lead, 'brigand_chief', cx + 10, cy);
      if (chief && lead.chief) chief.name = `Главарь — ${lead.chief}`;
      const n = rng.int(2, 4);
      for (let i = 0; i < n; i++) leadBeast(world, lead, rng.pick(['brigand', 'grave_robber']), cx + 8, cy);
      break;
    }
    case 'den': {
      clearArea(world, cx + 8, cy, 6, 3, T.TALLGRASS);
      for (let i = 0; i < 6; i++) { const s = leadSpot(world, cx + 8, cy, 3); if (s) world.set(s[0], s[1], T.BONES); }
      setContainer(world, cx + 9, cy, T.BONEPILE, 'den');
      leadBeast(world, lead, 'alpha_wolf', cx + 8, cy);
      const n = rng.int(3, 5);
      for (let i = 0; i < n; i++) leadBeast(world, lead, 'wolf', cx + 8, cy);
      break;
    }
    case 'treasure': {
      if (rng.chance(0.25)) findScroll();
      if (rng.chance(0.4)) findBook();
      clearArea(world, cx + 8, cy, 7, 4);
      for (let x = cx + 3; x <= cx + 13; x++) { world.set(x, cy - 3, rng.chance(0.6) ? T.TOMBWALL : T.RUBBLE); world.set(x, cy + 3, rng.chance(0.6) ? T.TOMBWALL : T.RUBBLE); }
      world.set(cx + 12, cy, T.ALTAR);
      setContainer(world, cx + 11, cy, T.CHEST, 'treasure');
      for (const key of ['ghost', 'skeleton', 'skeleton', rng.pick(['ghost', 'lemur'])]) leadBeast(world, lead, key, cx + 9, cy);
      break;
    }
    case 'hermit': {
      clearArea(world, cx + 6, cy, 6, 3);
      const rows = ['wwwww', 'w.b.w', 'w...w', 'ww+ww'];
      rows.forEach((row, j) => [...row].forEach((ch, i) => world.set(cx + 4 + i, cy - 2 + j, STAMP_TILES[ch])));
      world.set(cx + 6, cy + 3, T.ALTAR);
      const place = { id: lead.id, name: lead.name, kind: 'hermitage', region: world.region, x: lead.x, y: lead.y };
      const v = { name: lead.name, city: place, cx: cx + 6, cy, x0: cx + 1, y0: cy - 3, w: 11, h: 7, buildings: [], npcs: [] };
      const npc = makeNpc('hermit', v, { x: cx + 1, y: cy - 3, w: 11, h: 7, building: -1 }, cx + 6, cy + 2);
      npc.lead = lead;
      world.actors.push(npc);
      break;
    }
    case 'orco': {
      clearArea(world, cx + 8, cy, 7, 3, T.DIRT);
      for (let x = cx + 12; x <= cx + 16; x++) for (const y of [cy - 3, cy + 3]) world.set(x, y, T.ROCK);
      world.set(cx + 7, cy, T.CAMPFIRE);
      for (let i = 0; i < 6; i++) { const s = leadSpot(world, cx + 8, cy, 3); if (s) world.set(s[0], s[1], T.BONES); }
      setContainer(world, cx + 14, cy, T.BONEPILE, 'lair');
      leadBeast(world, lead, 'orco', cx + 12, cy);
      for (let i = 0; i < 2; i++) leadBeast(world, lead, 'wild_dog', cx + 8, cy);
      break;
    }
    case 'ghouls': {
      clearArea(world, cx + 8, cy, 8, 4);
      for (let x = cx + 1; x <= cx + 15; x++) for (const y of [cy - 4, cy + 4]) if (rng.chance(0.7)) world.set(x, y, T.STONEWALL);
      for (let k = 0; k < 10; k++) { const s = leadSpot(world, cx + 8, cy, 3); if (s) world.set(s[0], s[1], rng.chance(0.5) ? T.ALTAR : T.DIRT); }
      setContainer(world, cx + 13, cy, T.SARC_OPEN, 'lair');
      for (let i = 0; i < 4; i++) leadBeast(world, lead, 'ghoul', cx + 9, cy);
      leadBeast(world, lead, 'ghost', cx + 12, cy);
      break;
    }
    case 'lamia': {
      clearArea(world, cx + 10, cy, 6, 3, T.MARSH);
      for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx + 12; x <= cx + 15; x++) world.set(x, y, T.WATER);
      setContainer(world, cx + 10, cy - 2, T.BONEPILE, 'lair');
      leadBeast(world, lead, 'lamia', cx + 10, cy);
      for (let i = 0; i < 3; i++) leadBeast(world, lead, 'viper', cx + 8, cy);
      break;
    }
    case 'coven': {
      clearArea(world, cx + 8, cy, 6, 3, T.ASH);
      world.set(cx + 8, cy, T.CAMPFIRE);
      setContainer(world, cx + 11, cy, T.CHEST, 'lair');
      break;
    }
    case 'bear': {
      clearArea(world, cx + 8, cy, 6, 3, T.TALLGRASS);
      for (let i = 0; i < 5; i++) { const s = leadSpot(world, cx + 8, cy, 4); if (s) world.set(s[0], s[1], T.DEADWOOD); }
      setContainer(world, cx + 12, cy, T.BONEPILE, 'lair');
      leadBeast(world, lead, 'great_bear', cx + 10, cy);
      break;
    }
    case 'werewolf': {
      clearArea(world, cx + 6, cy, 5, 2, T.TALLGRASS);
      for (let i = 0; i < 5; i++) { const s = leadSpot(world, cx + 6, cy, 3); if (s) world.set(s[0], s[1], T.BONES); }
      break;
    }
  }
}

// Оборотень выходит только ночью.
// Ночные места: оборотень и ведьмы приходят только в темноте.
const NIGHT_GUESTS = {
  werewolf: { mobs: ['werewolf'], day: 'Сейчас тихо. Оборотень покажется только ночью — если хватит смелости дождаться.',
    night: 'Из темноты раздаётся вой — не волчий и не человечий.' },
  coven: { mobs: ['strega', 'strega', 'strega', 'black_dog'], day: 'Днём поляна пуста. Ведьмы слетаются сюда ночью.',
    night: 'Над поляной вспыхивают огни. С неба, хохоча, спускаются ведьмы — и чёрный пёс выходит из костра.' },
};

function wakeWerewolf(world, lead) {
  const g = NIGHT_GUESTS[lead.kind];
  if (!g || world.actors.some(a => a.leadId === lead.id)) return;
  if (!isNight()) { log(g.day, C.dim); return; }
  lead.left = 0;
  for (const key of g.mobs) leadBeast(world, lead, key, world.w / 2 + 9 | 0, world.h >> 1);
  log(g.night, C.red);
}

// Тварь из события убита.
function leadKill(m, byPlayer) {
  const lead = (G.leads || []).find(l => l.id === m.leadId);
  if (!lead || lead.done) return;
  if (--lead.left <= 0 && byPlayer && lead.kind !== 'treasure') finishLead(lead);
}

function finishLead(lead) {
  lead.done = true;
  chronicle(`${lead.name} близ ${lead.anchor} — дело сделано.`, 'event');
  G.player.gainXp(15);
  faithDeed('lead', { lead });
  const q = G.player.quests.find(q => q.lead === lead.id);
  if (q) {
    q.done = true; q.have = 1;
    log(`${lead.name}: дело сделано! Возвращайся за наградой: ${q.giverName}, ${q.fromName}. (+15 опыта)`, C.gold);
  } else log(`Слух подтвердился: ${lead.name.toLowerCase()} — дело сделано. (+15 опыта)`, C.gold);
}

// Открыть ящик, сундук или груду костей.
function openContainer(x, y) {
  const w = G.world, p = G.player, i = w.idx(x, y), kind = w.containers && w.containers.get(i);
  w.containers.delete(i);
  w.set(x, y, kind === 'goods' ? T.CRATE_OPEN : kind === 'den' ? T.BONES : kind === 'bough' ? T.FOREST : T.CHEST_OPEN);
  switch (kind) {
    case 'relic_true': case 'relic_fake': takeRelic(kind); break;
    case 'kidnap_stash': kidnapStash(); break;
    case 'stolen_relic': {
      const c = rng.int(10, 30);
      p.coins += c;
      log(`В сундуке воров — ларец с мощами${w.lead && w.lead.saint ? ' ' + w.lead.saint : ''}, целый, печать не сорвана. И ${coins(c)} — их выручка.`, C.gold);
      break;
    }
    case 'goods': {
      const id = rng.pick(GOOD_IDS), n = rng.int(1, 3);
      if (carryLoad(p) + GOODS[id].w * n > p.capacity) { log(`В ящике ${GOOD_GEN[id]} — но тебе больше не унести.`, C.dim); return; }
      p.goods[id] = (p.goods[id] || 0) + n;
      log(`Ты вскрываешь ящик: ${GOODS[id].name.toLowerCase()} ×${n}. Хозяевам товар уже не нужен.`, C.gold);
      break;
    }
    case 'camp': {
      const coins = rng.int(30, 70);
      p.coins += coins;
      p.bag.push(makeItem(rng.pick(['sword', 'mail', 'nasal', 'shield', 'axe', 'leather'])));
      log(`В сундуке атамана — ${coins} мон. и ${p.bag[p.bag.length - 1].name.toLowerCase()}.`, C.gold);
      break;
    }
    case 'den': {
      const coins = rng.int(8, 25);
      p.coins += coins;
      log(`Среди костей — истлевший кошель пропавшего путника: ${coins} мон.`, C.gold);
      if (rng.chance(0.4)) { const it = makeItem(rng.pick(['dagger', 'boots', 'cap', 'rosary'])); p.bag.push(it); log(`И ещё: ${it.name}.`, C.gold); }
      break;
    }
    case 'lair': {
      const lead = w.lead, coins = rng.int(20, 60);
      p.coins += coins;
      const found = { orco: 'кошели съеденных путников', ghouls: 'кольца и пряжки, снятые с покойников', lamia: 'пожитки заманенных пастухов',
        coven: 'ведьмин сундучок', bear: 'сумку пропавшего охотника' }[lead && lead.kind] || 'добычу';
      log(`Ты находишь ${found}: ${coins} мон.`, C.gold);
      if (lead && lead.kind === 'coven') { takeTrophy({ id: 'witch_ointment', name: 'Ведьмина мазь', value: 15 }); log('И горшочек ведьминой мази.', C.gold); }
      if (rng.chance(0.6)) { const it = makeItem(rng.pick(['sword', 'mail', 'nasal', 'bracers', 'boots', 'horseshoe', 'rosary', 'shortbow'])); p.bag.push(it); log(`И ещё: ${it.name}.`, C.gold); }
      break;
    }
    case 'necro': case 'offerings': case 'wreck': case 'bough': case 'dis_treasure': case 'secret': case 'vault':
      dungeonContainer(kind);
      if (rng.chance(kind === 'necro' ? 0.5 : kind === 'bough' ? 0 : 0.15)) findScroll();
      if (rng.chance(kind === 'bough' ? 0 : kind === 'necro' || kind === 'vault' ? 0.45 : 0.25)) findBook();
      break;
    case 'treasure': {
      const coins = rng.int(60, 130), it = makeItem(rng.pick(['reliquary', 'gorgoneion', 'signet', 'bulla', 'apollonia']));
      p.coins += coins;
      p.bag.push(it);
      log(`Клад тамплиеров! ${coins} мон. и ${it.name.toLowerCase()}.`, C.gold);
      const lead = w.lead;
      if (lead && !lead.done) finishLead(lead);
      break;
    }
  }
}

// ─── Отшельник ─────────────────────────────────────────────────────

function hermitOptions(npc) {
  const p = G.player;
  return [{ label: 'Благослови меня, отче', act: () => {
    if (npc.blessedDay === timeInfo().day) return 'Я уже молился за тебя сегодня. Ступай с миром.';
    npc.blessedDay = timeInfo().day;
    p.hp = p.maxHp;
    p.grace = p.maxGrace;
    p.poison = 0;
    p.confused = 0;
    if (npc.lead && !npc.lead.done) finishLead(npc.lead);
    return 'Старик кладёт тебе на лоб сухую ладонь и долго молчит. Боль уходит, как вода в песок.';
  } }];
}

// ─── Наткнуться самому ─────────────────────────────────────────────
// Проходя рядом с местом, о котором ещё не слышал, можно его заметить.
function spotLeads(x, y, searching) {
  const p = G.player, day = timeInfo().day;
  for (const l of G.leads || []) {
    if (l.known || l.done || l.until < day) continue;
    const d = Math.max(Math.abs(l.x - x), Math.abs(l.y - y));
    if (d > (l.quest ? 2 : 1)) continue;   // разыскиваемых видно чуть дальше: ищешь нарочно
    const chance = (d === 0 ? 0.5 : d === 1 ? 0.15 : 0.08) + p.stats.wis * 0.02 + skillLevel(p, 'survival') * 0.03
      + (searching ? 0.3 : 0) - (isNight() ? 0.1 : 0);
    if (!rng.chance(chance)) continue;
    l.known = true;
    const def = LEAD_KINDS[l.kind];
    p.rumors = p.rumors || [];
    p.rumors.unshift({ kind: 'lead', text: `Ты сам видел ${def.spot}. ${def.arrive}`, lead: l.id, title: `${l.name}: близ ${l.anchor}`, day, source: 'видел своими глазами' });
    log(`Ты замечаешь ${def.spot}: ${l.name.toLowerCase()}${d === 0 ? '! Enter — подойти.' : ' (!).'}`, C.gold);
    return l;
  }
  return null;
}
