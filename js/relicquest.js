'use strict';

// ─── Святыня для храма ─────────────────────────────────────────────
// Священник просит принести мощи святого из ближнего подземелья: катакомб,
// склепа или римской гробницы. Расхитители могил уже побывали там и
// оставили рядом с настоящим ларцом поддельный — чтобы потом продать
// «мощи» на ярмарке. Ларцы одинаковы; надпись на подлинном разберёт только
// грамотный. Взял один — второй рассыпается. Подделку священник распознает.

const RELIC_SAINTS = ['святого Марциана', 'святой Агаты', 'святого Януария', 'святого Себастьяна', 'святой Луции',
  'святого Лаврентия', 'святой Агнессы', 'святого Пантелеймона', 'святой Цецилии', 'святого Евстахия', 'святого Вита'];
const RELIC_SITES = ['roman', 'crypt', 'cave'];

// Святыня в малом подземелье: римская гробница, склеп или пещера неподалёку.
function offerRelic(npc) {
  const place = npc.village.city;
  if (/Имам/.test(npc.title) || place.kind === 'pagan') return null;
  const spot = findLeadSpot('treasure', place);
  if (!spot) return null;
  const type = rng.pick(RELIC_SITES), saint = rng.pick(RELIC_SAINTS), reward = questPay(rng.int(90, 140));
  const what = { roman: 'старую римскую гробницу', crypt: 'заброшенный склеп', cave: 'пещеру отшельника' }[type];
  return {
    type: 'relic', siteType: type, spot: { x: spot.x, y: spot.y }, depth: 0, saint, need: 1, have: 0, reward, xp: 40,
    label: `Мощи ${saint}`,
    accept: `Принесу мощи ${saint}`,
    text: `${whereText(place, spot.x, spot.y)} пастухи нашли ${what}. Говорят, там, в ларце, покоятся мощи ${saint}, `
      + `спрятанные ещё при лангобардах. Наш храм беден, а без святыни и прихожане ходят реже. Принеси мощи — заплачу ${coins(reward)}, `
      + `и Господь не забудет. Только берегись: расхитители могил торгуют подделками, а то и сами сидят под землёй.`,
  };
}

// Взял задание — на карте появляется малое подземелье.
function createRelicSite(q, place) {
  const ow = G.over, def = DUNGEON_TYPES[q.siteType], n = (G.relicSites = (G.relicSites || 0) + 1);
  const at = place.kind === 'village' ? `деревни ${place.name}` : cityGen(place.name);
  const name = { roman: `Гробница у ${at}`, crypt: `Заброшенный склеп у ${at}`, cave: `Пещера отшельника у ${at}` }[q.siteType];
  const site = { id: `relic${n}`, type: q.siteType, dungeon: true, mini: true, quest: true, hidden: true, glyph: def.glyph, color: def.color,
    x: q.spot.x, y: q.spot.y, region: ow.regionAt(q.spot.x, q.spot.y), terrain: ow.get(q.spot.x, q.spot.y), name, depth: 1, desc: def.desc };
  ow.sites.push(site);
  revealTomb(site);
  q.site = site.id;
  delete q.spot;
  log(`На карте отмечено: ${name.toLowerCase()}.`, C.gold);
}

// ─── Ограбление святыни ────────────────────────────────────────────
// Воры унесли из храма ларец с мощами. Священник описывает их и говорит, куда
// они подались; стоянку надо найти самому — она не отмечена на карте.

const THIEF_LOOKS = ['рыжий верзила со шрамом через бровь', 'хромой в краденой монашеской рясе', 'бывший наёмник с серьгой в ухе',
  'тощий, с выбитыми передними зубами', 'бородач в волчьей шкуре', 'молодой, смазливый, с дорогим кинжалом на поясе'];

function offerTheft(npc) {
  const place = npc.village.city;
  if (/Имам/.test(npc.title) || place.kind === 'pagan' || place.lastTheft === timeInfo().day) return null;
  const spot = findLeadSpot('thieves', place);
  if (!spot) return null;
  place.lastTheft = timeInfo().day;
  const saint = rng.pick(RELIC_SAINTS), look = rng.pick(THIEF_LOOKS), n = rng.int(3, 5);
  const days = rng.int(10, 15), reward = questPay(rng.int(110, 160));
  const dir = dirTo(place, spot), km = kmBetween(place, spot);
  const how = km < 25 ? 'недалеко, полдня пути' : km < 50 ? 'в дне пути' : 'дня за два пути';
  const terrain = { [OT.FOREST]: 'в лесу', [OT.PINE]: 'в хвойной чаще', [OT.HILL]: 'в холмах', [OT.MOUNT]: 'в горах', [OT.MARSH]: 'на болотах' }[G.over.get(spot.x, spot.y)] || 'в глуши';
  return {
    type: 'lair', lairKind: 'thieves', hidden: true, spot: { x: spot.x, y: spot.y }, need: 1, have: 0, reward, xp: 55,
    deadline: timeInfo().day + days, label: `Украденные мощи ${saint}`, saint, look,
    hint: `${n} воров, главарь — ${look}. Ушли ${dir}, ${how}; прячутся ${terrain}. Ищи их стоянку — дым, следы.`,
    accept: 'Найду воров',
    text: `Беда! Ночью воры взломали ризницу и унесли ларец с мощами ${saint}. Их было ${n}, главарь — ${look}. `
      + `Пастух видел, как они ушли ${dir}, — ${how}, прячутся где-то ${terrain}. Найди их и верни святыню — `
      + `заплачу ${coins(reward)}. Но поспеши: воры не станут держать святыню долго — продадут на первой же ярмарке, и тогда её не сыскать.`,
  };
}

// При входе на нужный уровень — два ларца в дальнем зале.
function relicVisit(world) {
  const site = world.site, p = G.player;
  if (!site) return;
  for (const q of p.quests) {
    if (q.type !== 'relic' || q.site !== site.id || q.depth !== world.depth || q.placed) continue;
    const cells = [];
    for (let y = 2; y < world.h - 2; y++)
      for (let x = 2; x < world.w - 2; x++) {
        if (!world.free(x, y) || world.get(x, y) === T.STAIRS_UP || world.get(x, y) === T.STAIRS_DOWN) continue;
        if (Math.max(Math.abs(x - world.up[0]), Math.abs(y - world.up[1])) < 10) continue;
        // Ларцы не должны перегородить проход: вокруг — свободно.
        if (DIRS8.filter(([dx, dy]) => world.walkable(x + dx, y + dy)).length < 8) continue;
        if (!world.walkable(x + 2, y) || DIRS8.filter(([dx, dy]) => world.walkable(x + 2 + dx, y + dy)).length < 8) continue;
        cells.push([x, y]);
      }
    if (!cells.length) continue;
    const [x, y] = rng.pick(cells), genuineLeft = rng.chance(0.5);
    for (const [cx, kind] of [[x, genuineLeft ? 'relic_true' : 'relic_fake'], [x + 2, genuineLeft ? 'relic_fake' : 'relic_true']]) {
      world.set(cx, y, T.CHEST);
      addContainer(world, world.idx(cx, y), kind);
    }
    world.relicQuest = q.id;
    q.placed = true;
    // Расхитители рядом.
    const prevWorld = G.world;
    G.world = world;
    placeGroup('grave_robber', x + 1, y + 2);
    G.world = prevWorld;
  }
}

// Первый шаг к ларцу — осмотреть (грамотный читает надпись), второй — взять.
function bumpRelic(x, y) {
  const w = G.world, p = G.player, i = w.idx(x, y), kind = w.containers.get(i);
  if (w.relicLook === i) return false;
  w.relicLook = i;
  const lvl = skillLevel(p, 'letters');
  if (lvl >= 2) {
    trainSkill(p, 'letters', 2);
    log(kind === 'relic_true'
      ? 'Ты читаешь надпись на ларце: «HIC REQVIESCIT…» — имя святого, год, печать епископа. Буквы старые, ровные. Подлинный.'
      : 'Надпись на ларце нацарапана недавно, с ошибками: «SANCTVS» через «C», печать — оттиск монеты. Подделка расхитителей.', C.gold);
  } else log('Свинцовый ларец с латинской надписью. Рядом — точно такой же. Какой из них подлинный, неграмотному не понять. '
    + 'Ещё шаг — взять этот.', C.dim);
  return true;
}

function takeRelic(kind) {
  const w = G.world, p = G.player, q = p.quests.find(x => x.id === w.relicQuest);
  // Второй ларец рассыпается.
  for (const [i, k] of [...(w.containers || [])]) if (k === 'relic_true' || k === 'relic_fake') {
    w.containers.delete(i);
    w.set(i % w.w, (i / w.w) | 0, T.RUBBLE);
  }
  if (!q) { log('В ларце — истлевшие кости. Чьи — уже не узнать.', C.dim); return true; }
  q.done = true;
  q.genuine = kind === 'relic_true';
  log(`Ты берёшь ларец с мощами ${q.saint}. Второй, задетый локтем, рассыпается трухой. Неси святыню в ${q.fromName}.`, C.gold);
  return true;
}

// Сдать мощи священнику: подделку он распознает.
function relicReward(q, npc) {
  const p = G.player, place = npc.village.city;
  p.quests = p.quests.filter(x => x !== q);
  G.flags[`${q.site}_relic`] = true;
  if (!q.genuine) {
    const pay = Math.round(q.reward / 4);
    p.coins += pay;
    log(`Получено: ${coins(pay)}.`, C.gold);
    chronicle(`Принёс в ${placeAcc(place)} мощи ${q.saint} — оказались поддельными.`, 'quest');
    return `Священник подносит ларец к свету, читает надпись — и мрачнеет. «Это подделка. Кости свиньи и надпись, нацарапанная вчера. `
      + `Ты не виноват — тебя обманули те же, кто обманывает паломников. Вот ${coins(pay)} за труды. Настоящие теперь, верно, уже проданы».`;
  }
  p.coins += q.reward;
  p.gainXp(q.xp);
  addPiety(4, 'Святыня возвращена в храм.');
  addFame(2, `принёс мощи ${q.saint} в ${placeAcc(place)}`);
  faithDeed('quest', { q, place });
  chronicle(`Принёс в ${placeAcc(place)} мощи ${q.saint} из подземелья.`, 'quest');
  log(`Получено: ${coins(q.reward)}.`, C.gold);
  return `Священник опускается на колени перед ларцом и долго молится. «Подлинные. Сегодня же положим их под алтарь. `
    + `Вот ${coins(q.reward)} — и знай: в этом храме за тебя будут молиться, пока он стоит».`;
}
