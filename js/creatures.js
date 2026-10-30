'use strict';

// ─── Игрок ─────────────────────────────────────────────────────────

class Player {
  constructor(name, people, stats) {
    this.kind = 'player';
    this.name = name;
    this.people = people;
    this.base = { ...stats };   // характеристики без реликвий
    this.glyph = '@';
    this.color = C.white;
    this.level = 1;
    this.xp = 0;
    this.statPoints = 0;
    this.equip = Object.fromEntries(SLOTS.map(([s]) => [s, null]));
    this.equip.right = makeItem('club');
    this.bag = [makeItem('torch'), makeItem('knife')];
    this.coins = 15;
    this.potions = 2;
    this.trophies = {};   // id -> {name, value, count}
    this.goods = {};      // товар -> количество
    this.kills = {};      // вид зверя -> число
    this.seen = {};       // вид зверя -> true
    this.quests = [];
    this.poison = 0;
    this.confused = 0;
    this.x = 0;
    this.y = 0;
    this.hp = this.maxHp;
    this.grace = this.maxGrace;
  }

  is(peopleId) { return this.people.id === peopleId; }

  // Характеристики с учётом реликвий.
  get stats() {
    const s = { ...this.base };
    if (this.equip) for (const it of equippedItems(this)) if (it.stats) for (const [k, v] of Object.entries(it.stats)) s[k] += v;
    return s;
  }
  get weaponDef() { return (this.equip && this.equip.right) || FISTS; }

  get maxHp() {
    const s = this.stats;
    return 10 + s.con * 2 + (this.is('rus') ? 6 : 0) + (this.level - 1) * (3 + Math.floor(s.con / 4));
  }
  get capacity() { return 20 + this.stats.str * 4; }   // сколько мест груза унесёт (надетое не считается)
  get maxGrace() { return 2 + this.stats.fai * 2; }
  get sightDay() { return Math.max(2, 7 + Math.floor(this.stats.wis / 2) + gearSum(this, 'sight')); }
  get sightNight() { return Math.max(2, 2 + Math.floor(this.stats.wis / 3) + gearSum(this, 'sight') + Math.min(2, gearSum(this, 'light'))); }
  get hit() { return Math.floor(this.stats.str / 2) + gearSum(this, 'acc') + Math.floor(this.level / 2); }
  get ev() { return Math.max(0, 2 + (this.is('frank') ? 1 : 0) + Math.floor(this.level / 3) + gearSum(this, 'ev')); }
  get armor() { return gearSum(this, 'armor'); }
  get xpNext() { return 5 * this.level * (this.level + 1); }

  dmgBonus(target) {
    let b = Math.floor((this.stats.str - 5) / 2);
    if (this.is('teuton')) b += 1;
    if (this.is('norse') && this.hp < this.maxHp / 3) b += 2;
    if (this.is('castile') && target && target.def && target.def.unholy) b += 2;
    b += gearSum(this, 'dmgBonus');
    if (target && target.def && target.def.unholy) b += gearSum(this, 'vsUnholy');
    return b;
  }

  priceBuy(base) {
    let k = 1 - (this.stats.wis - 5) * 0.02;
    if (this.is('lombard')) k *= 0.8;
    for (const it of equippedItems(this)) if (it.price) k *= it.price;
    return Math.max(1, Math.ceil(base * k));
  }

  priceSell(value) {
    return Math.max(1, Math.floor(value * (this.is('lombard') ? 1.2 : 1)));
  }

  gainXp(n) {
    if (this.is('rhomaios')) n = Math.round(n * 1.2);
    this.xp += n;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      const oldMax = this.maxHp;
      this.level++;
      this.statPoints++;
      this.hp += this.maxHp - oldMax;
      log(`Ты достиг ${this.level}-го уровня! Нажми C, чтобы улучшить характеристику.`, C.gold);
    }
  }
}

// ─── Звери и жители ────────────────────────────────────────────────

function makeBeast(key, x, y) {
  const d = BEASTS[key];
  return {
    kind: 'beast', key, def: d, name: d.name, glyph: d.glyph, color: d.color,
    x, y, hp: d.hp, maxHp: d.hp, energy: rng.int(0, 99), provoked: false, target: null,
  };
}

function npcTitle(role, female, city) {
  const plan = cityPlan(city);
  const own = plan.titles && plan.titles[role];   // строка или [мужской, женский]
  if (own) return Array.isArray(own) ? own[female ? 1 : 0] : own;
  if (role === 'elder') return REGIONS[city.region].elder;
  const R = ROLES[role];
  if (role === 'peasant' && city.names === 'saracen') return female ? 'Сарацинка' : 'Сарацин';
  return female && R.titleF ? R.titleF : R.title;
}

function makeNpc(role, village, home, x, y) {
  const R = ROLES[role], city = village.city;
  const female = !cityPlan(city).male && rng.chance(R.female);
  const pool = NAMES[city.names || 'italian'];
  return {
    kind: 'npc', role, village, home, x, y,
    name: rng.pick(female ? pool.f : pool.m),
    title: npcTitle(role, female, city),
    female, glyph: R.glyph, color: R.color, energy: rng.int(0, 99),
    greeting: rng.pick(GREETINGS[role]).replace('{city}', city.name),
  };
}

function populateVillages(world) {
  for (const v of world.villages) {
    for (const b of v.buildings) {
      const home = { x: b.x, y: b.y, w: b.w, h: b.h, building: b.id };
      const spot = findFreeIn(world, home);
      if (!spot) continue;
      const npc = makeNpc(b.role, v, home, spot[0], spot[1]);
      b.owner = npc;
      v.npcs.push(npc);
      world.actors.push(npc);
    }
    const plan = v.plan || {};
    const streets = { x: v.x0, y: v.y0, w: v.w, h: v.h, building: -1 };
    const plaza = { x: v.cx - 6, y: v.cy - 3, w: 13, h: 7, building: -1 };
    const extra = [];
    for (let i = 0; i < (plan.guards ?? 1); i++) extra.push(['guard', streets]);
    for (let i = 0; i < (plan.folk || 3); i++) extra.push(['peasant', i < 2 ? plaza : streets]);
    if (v.city.port) extra.push(['boatman', plaza]);
    const merchants = v.city.kind === 'city' ? 2 : v.city.kind === 'town' ? 1 : 0;
    for (let i = 0; i < merchants; i++) extra.push(['merchant', plaza]);
    for (const [role, area] of extra) {
      const spot = findFreeIn(world, area) || findFreeIn(world, streets);
      if (!spot) continue;
      const npc = makeNpc(role, v, area, spot[0], spot[1]);
      v.npcs.push(npc);
      world.actors.push(npc);
    }
  }
}

// Свободная клетка в прямоугольнике: в здании building — только внутри него, иначе — на улице.
function inHome(world, rect, x, y) {
  const b = world.building[world.idx(x, y)];
  return rect.building === -1 ? b === -1 && world.zone[world.idx(x, y)] !== -1 : b === rect.building;
}

function findFreeIn(world, rect) {
  for (let t = 0; t < 400; t++) {
    const x = rng.int(rect.x, rect.x + rect.w - 1), y = rng.int(rect.y, rect.y + rect.h - 1);
    if (world.free(x, y) && world.get(x, y) !== T.DOOR && inHome(world, rect, x, y)) return [x, y];
  }
  return null;
}

// ─── Перемещение ───────────────────────────────────────────────────

function dist(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }

// Звери не заходят в города: там колокол, собаки и люди с вилами.
function beastCanEnter(world, x, y) {
  return world.free(x, y) && world.zone[world.idx(x, y)] === -1;
}

function npcCanEnter(world, npc, x, y) {
  const h = npc.home;
  if (x < h.x || y < h.y || x >= h.x + h.w || y >= h.y + h.h) return false;
  if (!world.free(x, y) || world.get(x, y) === T.DOOR) return false;
  return inHome(world, h, x, y);
}

function moveTo(a, x, y) { a.x = x; a.y = y; }

function randomStep(world, a, canEnter) {
  const dirs = rng.shuffle(DIRS8.slice());
  for (const [dx, dy] of dirs) {
    if (canEnter(world, a.x + dx, a.y + dy)) { moveTo(a, a.x + dx, a.y + dy); return true; }
  }
  return false;
}

function stepToward(world, a, tx, ty) {
  const d0 = (a.x - tx) ** 2 + (a.y - ty) ** 2;
  let best = null, bd = Infinity;
  for (const [dx, dy] of DIRS8) {
    const nx = a.x + dx, ny = a.y + dy;
    if (!beastCanEnter(world, nx, ny)) continue;
    const d = (nx - tx) ** 2 + (ny - ty) ** 2;
    if (d < bd) { bd = d; best = [nx, ny]; }
  }
  if (best && bd <= d0) { moveTo(a, best[0], best[1]); return true; }
  return false;
}

function stepAway(world, a, fx, fy) {
  const d0 = (a.x - fx) ** 2 + (a.y - fy) ** 2;
  let best = null, bd = d0;
  for (const [dx, dy] of rng.shuffle(DIRS8.slice())) {
    const nx = a.x + dx, ny = a.y + dy;
    if (!beastCanEnter(world, nx, ny)) continue;
    const d = (nx - fx) ** 2 + (ny - fy) ** 2;
    if (d > bd) { bd = d; best = [nx, ny]; }
  }
  if (best) { moveTo(a, best[0], best[1]); return true; }
  return false;
}

// ─── Бой ───────────────────────────────────────────────────────────

function hitChance(hit, ev) {
  return Math.max(0.1, Math.min(0.95, 0.72 + (hit - ev) * 0.05));
}

function playerAttack(m) {
  const p = G.player;
  m.provoked = true;
  if (!rng.chance(hitChance(p.hit, m.def.ev))) {
    log(`Ты промахиваешься — ${lower(m.name)} уворачивается.`, C.dim);
    return;
  }
  const w = p.weaponDef;
  let dmg = rng.roll(w.dmg[0], w.dmg[1]) + p.dmgBonus(m) - rng.int(0, m.def.armor);
  dmg = Math.max(1, dmg);
  m.hp -= dmg;
  if (m.hp <= 0) killBeast(m, true);
  else log(`Ты бьёшь ${m.def.acc}: −${dmg}.`, C.text);
}

function playerEv(d) {
  const p = G.player;
  return p.ev + (d.unholy ? Math.floor(p.stats.fai / 3) : 0) + (d.cat === 'Дивные' ? gearSum(p, 'faeEv') : 0);
}

// Нанести урон игроку и применить особые свойства твари.
function hurtPlayer(m, dmg, verb, extra = {}) {
  const p = G.player, d = m.def;
  p.hp -= dmg;
  log(`${m.name} ${verb}: −${dmg}.`, C.red);
  const poison = extra.poison || d.poison;
  if (poison) {
    const resist = p.stats.con * 0.04 + (p.is('rus') ? 0.15 : 0) + gearSum(p, 'poisonRes');
    if (!rng.chance(resist)) {
      p.poison += poison;
      log('Яд разливается по жилам.', C.green);
    }
  }
  if (d.confuse && !extra.ranged && !rng.chance(p.stats.wis * 0.04)) {
    p.confused = Math.max(p.confused, d.confuse);
    log(m.key === 'tarantula' ? 'Тарантизм! Ноги сами пускаются в пляс.' : 'У тебя всё плывёт перед глазами.', C.violet);
  }
  if (d.drain && m.hp < m.maxHp) {
    m.hp = Math.min(m.maxHp, m.hp + dmg);
    log(`${m.name} крепнет, напившись твоей силы.`, C.violet);
  }
  if (d.graceDrain && p.grace > 0) {
    p.grace = Math.max(0, p.grace - d.graceDrain);
    log('Ты чувствуешь, как из души уходит тепло. Благодать слабеет.', C.violet);
  }
  if (p.hp <= 0) G.deathCause = d.name;
}

// «бьёт лапой» → «бьёт тебя лапой»; глаголы с «тебя/тебе» уже готовы.
function verbAtYou(verb) {
  if (/теб[яе]/.test(verb)) return verb;
  const i = verb.indexOf(' ');
  return i < 0 ? `${verb} тебя` : `${verb.slice(0, i)} тебя${verb.slice(i)}`;
}

function beastAttack(m) {
  const p = G.player, d = m.def;
  if (!rng.chance(hitChance(d.hit, playerEv(d)))) {
    log(`${m.name} промахивается.`, C.dim);
    return;
  }
  if (d.steal) {
    const n = Math.min(p.coins, rng.int(3, 8));
    if (n > 0) {
      p.coins -= n;
      m.stash = (m.stash || 0) + n;
      m.fleeing = true;
      log(`${m.name} ${d.verb} и выхватывает ${n} мон.! Держи вора!`, C.gold);
    } else {
      log(`${m.name} ${d.verb}, но там пусто. Он обиженно фыркает.`, C.dim);
      m.fleeing = true;
    }
    return;
  }
  const dmg = rng.roll(d.dmg[0], d.dmg[1]) - rng.int(0, p.armor + (d.unholy ? gearSum(p, 'unholyArmor') : 0));
  if (dmg <= 0) {
    log(`${m.name} ${verbAtYou(d.verb)}, но доспех держит удар.`, C.dim);
    return;
  }
  hurtPlayer(m, dmg, verbAtYou(d.verb));
}

function beastRanged(m) {
  const p = G.player, d = m.def, rg = d.ranged;
  if (!rng.chance(hitChance(d.hit, playerEv(d) + 1))) {
    log(`${m.name} ${rg.verb}, но мимо.`, C.dim);
    return;
  }
  const dmg = Math.max(1, rng.roll(rg.dmg[0], rg.dmg[1]) - rng.int(0, Math.floor(p.armor / 2)));
  hurtPlayer(m, dmg, rg.verb, { poison: rg.poison, ranged: true });
}

// Пение сирен и ангуан тянет к ним.
function beastLure(m) {
  const p = G.player, w = G.world;
  const resist = 0.25 + p.stats.wis * 0.04 + p.stats.fai * 0.02;
  if (rng.chance(resist)) {
    log(`${m.name} поёт. Ты стискиваешь зубы и не поддаёшься.`, C.dim);
    return;
  }
  const dx = Math.sign(m.x - p.x), dy = Math.sign(m.y - p.y);
  const nx = p.x + dx, ny = p.y + dy;
  if (w.free(nx, ny)) {
    moveTo(p, nx, ny);
    log(`${m.name} поёт, и ноги сами несут тебя навстречу.`, C.violet);
  }
}

function dropCoins(x, y, n) {
  if (n > 0) G.world.addItem(x, y, { kind: 'coins', name: `${n} мон.`, value: n });
}

function killBeast(m, byPlayer) {
  const p = G.player, d = m.def;
  m.dead = true;
  G.world.actors = G.world.actors.filter(a => a !== m);
  if (!byPlayer) return;
  p.kills[m.key] = (p.kills[m.key] || 0) + 1;
  log(`Ты убиваешь ${d.acc}! (+${d.xp} опыта)`, C.gold);
  if (d.loot) G.world.addItem(m.x, m.y, { kind: 'trophy', ...d.loot });
  if (d.gear && rng.chance(d.gear.chance)) {
    const it = makeItem(rng.pick(d.gear.items));
    G.world.addItem(m.x, m.y, { kind: 'gear', item: it, name: it.name });
  }
  dropCoins(m.x, m.y, (d.coins ? rng.int(d.coins[0], d.coins[1]) : 0) + (m.stash || 0));
  if (d.curse) {
    p.grace = 0;
    log('Над тобой будто гаснет свет. Ты убил невинное создание — благодать покинула тебя.', C.violet);
  }
  if (d.site) G.flags[m.key + '_dead'] = true;
  if (m.bossOf) {
    G.flags[`${m.bossOf}_boss`] = true;
    log('Тень проконсула рассыпается пеплом. По галереям прокатывается вздох — будто тысяча мёртвых наконец уснули.', C.gold);
  }
  questKill(m.key);
  p.gainXp(d.xp);
}

// ─── Поведение ─────────────────────────────────────────────────────

function beastAct(m) {
  const world = G.world, p = G.player, d = m.def;
  if (d.regen && m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + d.regen);

  const dd = dist(m, p);
  const sight = Math.round((d.sight || 7) * (isNight() && !d.night ? 0.7 : 1));
  const sees = world.isVisible(m.x, m.y) && dd <= sight;
  const can = beastCanEnter;

  // Вор с добычей удирает и исчезает из виду.
  if (m.fleeing) {
    if (!sees && rng.chance(0.3)) { killBeast(m, false); return; }
    if (!stepAway(world, m, p.x, p.y)) randomStep(world, m, can);
    return;
  }

  if (d.erratic && rng.chance(d.erratic)) {
    if (dd === 1 && sees && d.behavior === 'hostile' && rng.chance(0.5)) beastAttack(m);
    else randomStep(world, m, can);
    return;
  }

  let mode = d.behavior;
  if (mode === 'territorial') {
    if (m.provoked || (sees && dd <= 3)) mode = 'hostile';
    else { if (rng.chance(0.2)) randomStep(world, m, can); return; }
  }

  if (mode === 'ambush') {
    if (dd === 1) beastAttack(m);
    else if (m.provoked && sees) stepToward(world, m, p.x, p.y);
    else if (rng.chance(0.05)) randomStep(world, m, can);
    return;
  }

  if (mode === 'flee') {
    if (sees && dd <= 6) {
      if (!stepAway(world, m, p.x, p.y) && dd === 1) beastAttack(m);
    } else if (rng.chance(0.3)) randomStep(world, m, can);
    return;
  }

  // hostile
  if (sees) m.target = [p.x, p.y];
  if (dd === 1 && (sees || m.provoked)) { beastAttack(m); return; }
  if (sees && d.lure && dd <= d.lure && rng.chance(0.5)) { beastLure(m); return; }
  if (sees && d.ranged && dd <= d.ranged.range && rng.chance(0.55)) { beastRanged(m); return; }
  if (m.target) {
    if (!stepToward(world, m, m.target[0], m.target[1]) || (m.x === m.target[0] && m.y === m.target[1]))
      m.target = null;
  } else if (rng.chance(0.4)) randomStep(world, m, can);
}

function npcAct(n) {
  if (rng.chance(0.25)) randomStep(G.world, n, (w, x, y) => npcCanEnter(w, n, x, y));
}

// ─── Появление зверей ──────────────────────────────────────────────

function beastChoices(region, hab, night, unholyOnly) {
  const world = G.world, out = [];
  for (const key of BEAST_ORDER) {
    const d = BEASTS[key];
    if (!d.weight || !d.habitat.includes(hab) || !beastInRegion(d, region)) continue;
    if (d.night && !night) continue;
    if (unholyOnly && !d.unholy) continue;
    if (d.max && world.actors.filter(a => a.key === key).length >= d.max) continue;
    let w = d.weight;
    if (night && d.nightWeight) w *= d.nightWeight;
    if (night && d.night) w *= 3;
    if (d.regionWeight && d.regionWeight[region]) w *= d.regionWeight[region];
    out.push({ key, w });
  }
  return out;
}

// Поставить группу зверей вида key около (x, y).
function placeGroup(key, x, y) {
  const world = G.world, n = rng.int(...BEASTS[key].group);
  const placed = [];
  for (let k = 0; k < n; k++) {
    for (let s = 0; s < 12; s++) {
      const gx = x + (k ? rng.int(-2, 2) : 0), gy = y + (k ? rng.int(-2, 2) : 0);
      if (beastCanEnter(world, gx, gy)) {
        const m = makeBeast(key, gx, gy);
        world.actors.push(m);
        placed.push(m);
        break;
      }
    }
  }
  return placed;
}

// minDist — не ближе стольких клеток к игроку (и вне поля зрения).
function spawnBeasts(count, night, unholyOnly = false, minDist = 12) {
  const world = G.world, p = G.player;
  let spawned = 0;
  for (let t = 0; t < count * 60 && spawned < count; t++) {
    const x = rng.int(1, world.w - 2), y = rng.int(1, world.h - 2);
    if (!beastCanEnter(world, x, y)) continue;
    if (p && (world.isVisible(x, y) || Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) < minDist)) continue;
    const hab = TILES[world.get(x, y)].hab;
    if (!hab) continue;
    const options = beastChoices(world.region, hab, night, unholyOnly);
    if (!options.length) continue;
    if (placeGroup(rng.weighted(options).key, x, y).length) spawned++;
  }
  return spawned;
}

function lower(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
