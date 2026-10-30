'use strict';

// ─── Игрок ─────────────────────────────────────────────────────────

class Player {
  constructor(name, people, stats) {
    this.kind = 'player';
    this.name = name;
    this.people = people;
    this.stats = { ...stats };
    this.glyph = '@';
    this.color = C.white;
    this.level = 1;
    this.xp = 0;
    this.statPoints = 0;
    this.weapon = 'club';
    this.armorId = 'rags';
    this.coins = 15;
    this.potions = 2;
    this.trophies = {};   // id -> {name, value, count}
    this.kills = {};      // вид зверя -> число
    this.seen = {};       // вид зверя -> true
    this.quests = [];
    this.poison = 0;
    this.x = 0;
    this.y = 0;
    this.hp = this.maxHp;
    this.grace = this.maxGrace;
  }

  is(peopleId) { return this.people.id === peopleId; }

  get maxHp() {
    const s = this.stats;
    return 10 + s.con * 2 + (this.is('rus') ? 6 : 0) + (this.level - 1) * (3 + Math.floor(s.con / 4));
  }
  get maxGrace() { return 2 + this.stats.fai * 2; }
  get sightDay() { return 7 + Math.floor(this.stats.wis / 2); }
  get sightNight() { return 2 + Math.floor(this.stats.wis / 3); }
  get hit() { return Math.floor(this.stats.str / 2) + (WEAPONS[this.weapon].acc || 0) + Math.floor(this.level / 2); }
  get ev() { return 2 + (this.is('frank') ? 1 : 0) + Math.floor(this.level / 3); }
  get armor() { return ARMORS[this.armorId].armor; }
  get xpNext() { return 5 * this.level * (this.level + 1); }

  dmgBonus(target) {
    let b = Math.floor((this.stats.str - 5) / 2);
    if (this.is('teuton')) b += 1;
    if (this.is('norse') && this.hp < this.maxHp / 3) b += 2;
    if (this.is('castile') && target && target.def && target.def.unholy) b += 2;
    return b;
  }

  priceBuy(base) {
    let k = 1 - (this.stats.wis - 5) * 0.02;
    if (this.is('lombard')) k *= 0.8;
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

function makeNpc(role, village, home, x, y) {
  const R = ROLES[role];
  const female = rng.chance(R.female);
  return {
    kind: 'npc', role, village, home, x, y,
    name: rng.pick(female ? NAMES_F : NAMES_M),
    title: female && R.titleF ? R.titleF : R.title,
    female, glyph: R.glyph, color: R.color, energy: rng.int(0, 99),
    greeting: rng.pick(GREETINGS[role]).replace('{village}', village.name),
  };
}

function populateVillages(world) {
  for (const v of world.villages) {
    for (const b of v.buildings) {
      const home = { x: b.x + 1, y: b.y + 1, w: b.w - 2, h: b.h - 2, building: b.id };
      const spot = findFreeIn(world, home);
      if (!spot) continue;
      const npc = makeNpc(b.role, v, home, spot[0], spot[1]);
      b.owner = npc;
      v.npcs.push(npc);
      world.actors.push(npc);
    }
    const yard = { x: v.x0, y: v.y0, w: v.w, h: v.h, building: -1 };
    const extra = [['guard', v.cx + 2, v.cy + 1], ['peasant'], ['peasant']];
    for (const [role, px, py] of extra) {
      const spot = px !== undefined && world.free(px, py) ? [px, py] : findFreeIn(world, yard);
      if (!spot) continue;
      const npc = makeNpc(role, v, yard, spot[0], spot[1]);
      v.npcs.push(npc);
      world.actors.push(npc);
    }
  }
}

function findFreeIn(world, rect) {
  for (let t = 0; t < 200; t++) {
    const x = rng.int(rect.x, rect.x + rect.w - 1), y = rng.int(rect.y, rect.y + rect.h - 1);
    if (world.free(x, y) && world.get(x, y) !== T.DOOR && (rect.building === -1 ? world.building[world.idx(x, y)] === -1 : true))
      return [x, y];
  }
  return null;
}

// ─── Перемещение ───────────────────────────────────────────────────

function dist(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }

// Звери не заходят в деревни: там колокол, собаки и люди с вилами.
function beastCanEnter(world, x, y) {
  return world.free(x, y) && world.zone[world.idx(x, y)] === -1;
}

function npcCanEnter(world, npc, x, y) {
  const h = npc.home;
  if (x < h.x || y < h.y || x >= h.x + h.w || y >= h.y + h.h) return false;
  if (!world.free(x, y) || world.get(x, y) === T.DOOR) return false;
  if (h.building === -1 && world.building[world.idx(x, y)] !== -1) return false;
  return true;
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
  const w = WEAPONS[p.weapon];
  let dmg = rng.roll(w.dmg[0], w.dmg[1]) + p.dmgBonus(m) - rng.int(0, m.def.armor);
  dmg = Math.max(1, dmg);
  m.hp -= dmg;
  if (m.hp <= 0) killBeast(m, true);
  else log(`Ты бьёшь ${m.def.acc}: −${dmg}.`, C.text);
}

function beastAttack(m) {
  const p = G.player, d = m.def;
  let ev = p.ev;
  if (d.unholy) ev += Math.floor(p.stats.fai / 3);
  if (!rng.chance(hitChance(d.hit, ev))) {
    log(`${m.name} промахивается.`, C.dim);
    return;
  }
  let dmg = rng.roll(d.dmg[0], d.dmg[1]) - rng.int(0, p.armor);
  if (dmg <= 0) {
    log(`${m.name} ${d.verb} тебя, но ${ARMORS[p.armorId].name.toLowerCase()} держит удар.`, C.dim);
    return;
  }
  p.hp -= dmg;
  log(`${m.name} ${d.verb} тебя: −${dmg}.`, C.red);
  if (d.poison) {
    const resist = p.stats.con * 0.04 + (p.is('rus') ? 0.15 : 0);
    if (!rng.chance(resist)) {
      p.poison += d.poison;
      log('Яд разливается по жилам.', C.green);
    }
  }
  if (p.hp <= 0) G.deathCause = d.name;
}

function killBeast(m, byPlayer) {
  const p = G.player, d = m.def;
  m.dead = true;
  G.world.actors = G.world.actors.filter(a => a !== m);
  if (!byPlayer) return;
  p.kills[m.key] = (p.kills[m.key] || 0) + 1;
  log(`Ты убиваешь ${d.acc}! (+${d.xp} опыта)`, C.gold);
  if (d.loot) G.world.addItem(m.x, m.y, { kind: 'trophy', ...d.loot });
  for (const q of p.quests) {
    if (!q.done && q.target === m.key) {
      q.have++;
      if (q.have >= q.need) {
        q.done = true;
        log(`Задание старосты деревни ${q.villageName} выполнено. Возвращайся за наградой.`, C.gold);
      }
    }
  }
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
  if (m.target) {
    if (!stepToward(world, m, m.target[0], m.target[1]) || (m.x === m.target[0] && m.y === m.target[1]))
      m.target = null;
  } else if (rng.chance(0.4)) randomStep(world, m, can);
}

function npcAct(n) {
  if (rng.chance(0.25)) randomStep(G.world, n, (w, x, y) => npcCanEnter(w, n, x, y));
}

// ─── Появление зверей ──────────────────────────────────────────────

function spawnBeasts(count, night, unholyOnly = false) {
  const world = G.world, p = G.player;
  let spawned = 0;
  for (let t = 0; t < count * 60 && spawned < count; t++) {
    const x = rng.int(1, world.w - 2), y = rng.int(1, world.h - 2);
    if (!beastCanEnter(world, x, y)) continue;
    if (p && (world.isVisible(x, y) || Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) < 14)) continue;
    const hab = TILES[world.get(x, y)].hab;
    if (!hab) continue;
    const options = [];
    for (const key of BEAST_ORDER) {
      const d = BEASTS[key];
      if (!d.habitat.includes(hab)) continue;
      if (d.night && !night) continue;
      if (unholyOnly && !d.unholy) continue;
      let w = d.weight;
      if (night && d.nightWeight) w *= d.nightWeight;
      if (night && d.unholy) w *= 4;
      options.push({ key, w });
    }
    if (!options.length) continue;
    const key = rng.weighted(options).key;
    const n = rng.int(...BEASTS[key].group);
    world.actors.push(makeBeast(key, x, y));
    spawned++;
    for (let k = 1; k < n; k++) {
      for (let s = 0; s < 10; s++) {
        const gx = x + rng.int(-2, 2), gy = y + rng.int(-2, 2);
        if (beastCanEnter(world, gx, gy)) { world.actors.push(makeBeast(key, gx, gy)); break; }
      }
    }
  }
}

function lower(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
