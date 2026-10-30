'use strict';

// ─── События на карте («наводки») ──────────────────────────────────
// Жители иногда рассказывают о конкретном месте поблизости. Место отмечается
// на карте знаком «!». Через несколько дней событие исчезает.

const LEAD_KINDS = {
  caravan: {
    name: 'Разграбленный караван', w: 3, tag: 'trade', road: true,
    rumor: (where) => `${where} разбойники напали на купеческий обоз. Повозки, говорят, так и бросили на дороге — с товаром.`,
    arrive: 'Перевёрнутые повозки, рассыпанные мешки, следы крови на дороге. Разбойники ещё не ушли.',
  },
  camp: {
    name: 'Лагерь разбойников', w: 2, tag: 'war',
    rumor: (where) => `${where} в лесу встали лагерем разбойники. Атаман у них — бывший наёмник, а в сундуке — всё, что награбили за лето.`,
    arrive: 'Дым костра, палатки из краденой парусины. Кто-то точит нож и насвистывает.',
  },
  den: {
    name: 'Волчье логово', w: 3, tag: 'common',
    rumor: (where) => `${where} волчье логово. Вожак — матёрый, с белой отметиной. Пастухи туда не суются, а пропавших путников так и не нашли.`,
    arrive: 'Обглоданные кости, клочья шерсти и тяжёлый звериный дух. Из чащи смотрят жёлтые глаза.',
  },
  treasure: {
    name: 'Старый клад', w: 2, tag: 'common',
    rumor: (where) => `${where} у развалин старой часовни зарыт клад. Тамплиеры, говорят, прятали. Только кто туда ходил — седым возвращался.`,
    arrive: 'Развалины часовни, заросшие ежевикой. Воздух холодный, как в погребе. Здесь кто-то есть — и он не жив.',
  },
  hermit: {
    name: 'Хижина отшельника', w: 2, tag: 'church',
    rumor: (where) => `${where} в лесу живёт святой отшельник. Говорят, исцеляет одним словом — если придёшь с чистым сердцем.`,
    arrive: 'Крохотная хижина из камня, крест из двух ветвей. Пахнет травами и воском.',
  },
  werewolf: {
    name: 'Следы оборотня', w: 1, tag: 'common', night: true,
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

function spawnLead() {
  const ow = G.over, kind = rng.weighted(Object.entries(LEAD_KINDS).map(([k, d]) => ({ k, w: d.w }))).k, def = LEAD_KINDS[kind];
  const anchors = ow.cities.filter(c => ['city', 'town', 'village'].includes(c.kind));
  for (let t = 0; t < 80; t++) {
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
    if (G.leads.some(l => Math.abs(l.x - x) < 4 && Math.abs(l.y - y) < 3)) continue;
    const lead = {
      id: `lead${G.leadCount = (G.leadCount || 0) + 1}`, kind, name: def.name, x, y, anchor: a.name,
      day: timeInfo().day, until: timeInfo().day + rng.int(6, 15), known: false, done: false,
    };
    lead.rumor = def.rumor(whereText(a, x, y));
    G.leads.push(lead);
    addNews({ day: lead.day, text: lead.rumor, x, y, tag: def.tag, lead: lead.id });
    return lead;
  }
  return null;
}

function leadsTick() {
  G.leads = G.leads || [];
  const day = timeInfo().day;
  // Истёкшие исчезают, если игрок не стоит прямо там.
  G.leads = G.leads.filter(l => l.until >= day || (G.mode === 'local' && G.world && G.world.lead === l));
  const active = G.leads.filter(l => !l.done).length;
  if (active < 12 && rng.chance(0.7)) spawnLead();
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
  if (lead.kind === 'werewolf' && !lead.done) wakeWerewolf(world, lead);
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
    case 'werewolf': {
      clearArea(world, cx + 6, cy, 5, 2, T.TALLGRASS);
      for (let i = 0; i < 5; i++) { const s = leadSpot(world, cx + 6, cy, 3); if (s) world.set(s[0], s[1], T.BONES); }
      break;
    }
  }
}

// Оборотень выходит только ночью.
function wakeWerewolf(world, lead) {
  if (world.actors.some(a => a.leadId === lead.id)) return;
  if (!isNight()) { log('Сейчас тихо. Оборотень покажется только ночью — если хватит смелости дождаться.', C.dim); return; }
  leadBeast(world, lead, 'werewolf', world.w / 2 + 10 | 0, world.h >> 1);
  log('Из темноты раздаётся вой — не волчий и не человечий.', C.red);
}

// Тварь из события убита.
function leadKill(m, byPlayer) {
  const lead = (G.leads || []).find(l => l.id === m.leadId);
  if (!lead || lead.done) return;
  if (--lead.left <= 0 && byPlayer && lead.kind !== 'treasure') finishLead(lead);
}

function finishLead(lead) {
  lead.done = true;
  G.player.gainXp(15);
  faithDeed('lead', { lead });
  log(`Слух подтвердился: ${lead.name.toLowerCase()} — дело сделано. (+15 опыта)`, C.gold);
}

// Открыть ящик, сундук или груду костей.
function openContainer(x, y) {
  const w = G.world, p = G.player, i = w.idx(x, y), kind = w.containers && w.containers.get(i);
  w.containers.delete(i);
  w.set(x, y, kind === 'goods' ? T.CRATE_OPEN : kind === 'den' ? T.BONES : T.CHEST_OPEN);
  switch (kind) {
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
