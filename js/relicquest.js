'use strict';

// ─── Святыня для храма ─────────────────────────────────────────────
// Священник просит принести мощи святого из ближнего подземелья: катакомб,
// склепа или римской гробницы. Расхитители могил уже побывали там и
// оставили рядом с настоящим ларцом поддельный — чтобы потом продать
// «мощи» на ярмарке. Ларцы одинаковы; надпись на подлинном разберёт только
// грамотный. Взял один — второй рассыпается. Подделку священник распознает.

const RELIC_SAINTS = ['святого Марциана', 'святой Агаты', 'святого Януария', 'святого Себастьяна', 'святой Луции',
  'святого Лаврентия', 'святой Агнессы', 'святого Пантелеймона', 'святой Цецилии', 'святого Евстахия', 'святого Вита'];
const RELIC_SITES = ['catacomb', 'crypt', 'roman'];

function offerRelic(npc) {
  const place = npc.village.city, ow = G.over;
  if (/Имам/.test(npc.title) || place.kind === 'pagan') return null;
  const land = landmass(place.region);
  const sites = ow.sites.filter(s => s.dungeon && RELIC_SITES.includes(s.type) && landmass(s.region) === land
    && !G.flags[`${s.id}_relic`] && Math.hypot(s.x - place.x, s.y - place.y) <= 40 * MAP_SCALE && Math.hypot(s.x - place.x, s.y - place.y) >= 3 * MAP_SCALE);
  if (!sites.length) return null;
  const site = rng.pick(sites), saint = rng.pick(RELIC_SAINTS);
  const depth = rng.int(0, site.depth - 1), reward = rng.int(90, 140);
  const where = site.hidden ? `${whereText(place, site.x, site.y)} есть ${dungeonType(site).label.toLowerCase()}` : `В месте, что зовут «${site.name}»,`;
  return {
    type: 'relic', site: site.id, depth, saint, need: 1, have: 0, reward, xp: 40,
    label: `Мощи ${saint}`,
    accept: `Принесу мощи ${saint}`,
    text: `${where} — там, в ларце, покоятся мощи ${saint}. Наш храм беден, а без святыни и прихожане ходят реже. `
      + `Принеси мощи — заплачу ${coins(reward)}, и Господь не забудет. Только берегись: расхитители могил торгуют подделками, `
      + `а то и сами сидят в подземелье.`,
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
  faithDeed('quest', { q, place });
  chronicle(`Принёс в ${placeAcc(place)} мощи ${q.saint} из подземелья.`, 'quest');
  log(`Получено: ${coins(q.reward)}.`, C.gold);
  return `Священник опускается на колени перед ларцом и долго молится. «Подлинные. Сегодня же положим их под алтарь. `
    + `Вот ${coins(q.reward)} — и знай: в этом храме за тебя будут молиться, пока он стоит».`;
}
