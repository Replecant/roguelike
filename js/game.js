'use strict';

const COLS = 100, ROWS = 36;
const MAP_W = 68, MAP_H = 28;      // окно карты
const PANEL_X = 69;                // правая панель
const LOG_Y = 29, LOG_H = ROWS - LOG_Y;

const MINUTES_PER_TURN = 2;
const START_MINUTE = 8 * 60;

const G = {
  term: null,
  world: null,
  player: null,
  turn: 0,
  messages: [],
  screens: [],
  deathCause: null,
  wasNight: false,
};

function log(text, color = C.text) {
  G.messages.push({ text, color, turn: G.turn });
  if (G.messages.length > 200) G.messages.shift();
}

function pushScreen(s) { G.screens.push(s); }
function popScreen() { G.screens.pop(); }
function topScreen() { return G.screens[G.screens.length - 1]; }

// ─── Время суток ───────────────────────────────────────────────────

function timeInfo(turn = G.turn) {
  const total = START_MINUTE + turn * MINUTES_PER_TURN;
  const day = Math.floor(total / 1440) + 1, m = total % 1440;
  return { day, hour: Math.floor(m / 60), min: m % 60 };
}

function isNight() {
  const h = timeInfo().hour;
  return h >= 21 || h < 5;
}

// 0 — день, 1 — глубокая ночь; плавно в сумерках.
function darkness() {
  const { hour, min } = timeInfo();
  const h = hour + min / 60;
  if (h >= 21 || h < 5) return 1;
  if (h >= 19) return (h - 19) / 2;
  if (h < 7) return 1 - (h - 5) / 2;
  return 0;
}

function sightRadius() {
  const p = G.player, d = darkness();
  let r = Math.round(p.sightDay + (p.sightNight - p.sightDay) * d);
  if (d > 0.5 && G.world.villageAt(p.x, p.y)) r += 3;   // факелы и окна
  return Math.max(2, r);
}

function sleepUntilMorning() {
  const p = G.player, ti = timeInfo();
  // Проснуться в 7 утра следующего (или этого, если ещё ночь) дня.
  let target = (ti.day - 1) * 1440 + 7 * 60;
  const now = START_MINUTE + G.turn * MINUTES_PER_TURN;
  if (target <= now + 4 * 60) target += 1440;
  G.turn += Math.round((target - now) / MINUTES_PER_TURN);
  p.hp = p.maxHp;
  p.grace = p.maxGrace;
  p.poison = 0;
  dawnCleanup(false);
  G.wasNight = isNight();
  refreshFov();
}

function dawnCleanup(announce) {
  for (const a of G.world.actors.slice()) {
    if (a.kind === 'beast' && a.def.night) {
      if (announce && G.world.isVisible(a.x, a.y))
        log(`С первыми лучами ${lower(a.name)} обращается в туман.`, C.violet);
      killBeast(a, false);
    }
  }
}

// ─── Начало игры ───────────────────────────────────────────────────

function startGame(player) {
  const seed = (Math.random() * 2 ** 32) >>> 0;
  rng = new RNG(seed);
  G.world = generateWorld(rng);
  G.player = player;
  G.turn = 0;
  G.messages = [];
  G.deathCause = null;
  G.wasNight = false;
  populateVillages(G.world);

  const v = G.world.villages[0];
  const spot = [[v.cx, v.cy + 1], [v.cx + 1, v.cy], [v.cx - 1, v.cy], [v.cx, v.cy - 1]]
    .find(([x, y]) => G.world.free(x, y)) || [v.cx, v.cy + 2];
  player.x = spot[0];
  player.y = spot[1];
  G.world.actors.unshift(player);

  spawnBeasts(45, false);
  refreshFov();

  G.screens = [new PlayScreen()];
  log(`${player.name}, ${player.people.name.toLowerCase()}, приходит в деревню ${v.name}.`, C.gold);
  log('Поговори с жителями (просто иди на них). ? — справка по управлению.', C.dim);
}

function refreshFov() {
  const p = G.player, w = G.world;
  w.computeFov(p.x, p.y, sightRadius());
  for (const a of w.actors) {
    if (a.kind !== 'beast' || !w.isVisible(a.x, a.y) || p.seen[a.key]) continue;
    p.seen[a.key] = true;
    log(`Новая запись в бестиарии: ${a.name}. (X — открыть)`, C.violet);
  }
}

// ─── Ход ───────────────────────────────────────────────────────────

function endTurn() {
  const p = G.player, w = G.world;
  G.turn++;

  if (p.poison > 0) {
    if (G.turn % 2 === 0) {
      p.hp--;
      if (p.hp <= 0) G.deathCause = 'яд';
    }
    if (--p.poison === 0) log('Яд отступил.', C.green);
  } else if (p.hp < p.maxHp && G.turn % Math.max(4, 16 - Math.floor(p.stats.con / 2)) === 0) {
    p.hp++;
  }
  if (p.grace < p.maxGrace && G.turn % Math.max(6, 26 - p.stats.fai) === 0) p.grace++;

  for (const a of w.actors.slice()) {
    if (a === p || a.dead) continue;
    a.energy += a.kind === 'beast' ? a.def.speed : 100;
    while (a.energy >= 100 && !a.dead && p.hp > 0) {
      a.energy -= 100;
      if (a.kind === 'beast') beastAct(a);
      else npcAct(a);
    }
    if (p.hp <= 0) break;
  }

  const night = isNight();
  if (night !== G.wasNight) {
    G.wasNight = night;
    if (night) {
      log('Сгущается ночь. Из чащи и болот выходит то, что днём прячется.', C.violet);
      spawnBeasts(6, true, true);
    }
    else { log('Светает. Петухи кричат в далёких деревнях.', C.gold); dawnCleanup(true); }
  }

  if (G.turn % 20 === 0) {
    const beasts = w.actors.filter(a => a.kind === 'beast').length;
    const cap = night ? 55 : 45;
    if (beasts < cap) spawnBeasts(Math.min(3, cap - beasts), night);
  }

  refreshFov();
  if (p.hp <= 0) pushScreen(new DeathScreen());
}

function visibleBeasts() {
  const p = G.player, w = G.world;
  return w.actors
    .filter(a => a.kind === 'beast' && w.isVisible(a.x, a.y))
    .sort((a, b) => dist(a, p) - dist(b, p));
}

// ─── Действия игрока ───────────────────────────────────────────────

function tryMove(dx, dy) {
  const p = G.player, w = G.world, nx = p.x + dx, ny = p.y + dy;
  const a = w.actorAt(nx, ny);
  if (a && a.kind === 'beast') { playerAttack(a); endTurn(); return; }
  if (a && a.kind === 'npc') { pushScreen(new DialogScreen(a)); return; }
  if (!w.walkable(nx, ny)) {
    log(`Не пройти: ${w.def(nx, ny).name.toLowerCase()}.`, C.dark);
    return;
  }
  moveTo(p, nx, ny);
  for (const it of w.takeItems(nx, ny)) {
    const tr = p.trophies[it.id] || (p.trophies[it.id] = { name: it.name, value: it.value, count: 0 });
    tr.count++;
    log(`Ты подбираешь: ${it.name}.`, C.text);
  }
  const b = w.buildingAt(nx, ny), wasB = w.buildingAt(nx - dx, ny - dy);
  if (b && b !== wasB) log(`${b.name}.`, C.dim);
  const v = w.villageAt(nx, ny), wasV = w.villageAt(nx - dx, ny - dy);
  if (v && !wasV) log(`Ты входишь в деревню ${v.name}.`, C.gold);
  if (!v && wasV) log(`Ты покидаешь деревню ${wasV.name}.`, C.dim);
  endTurn();
}

function pray() {
  const p = G.player;
  if (p.grace < 4) { log('Слова молитвы застревают в горле. Благодати не осталось.', C.dark); return; }
  p.grace -= 4;
  const heal = 2 + Math.floor(p.stats.fai / 2) + rng.int(1, 4);
  p.hp = Math.min(p.maxHp, p.hp + heal);
  if (p.poison) p.poison = Math.floor(p.poison / 2);
  log(`Ты молишься. Тепло разливается по телу: +${heal} здоровья.`, C.gold);
  for (const m of visibleBeasts()) {
    if (!m.def.unholy || dist(m, p) > 4) continue;
    const dmg = Math.floor(p.stats.fai / 2) + rng.int(1, 4);
    m.hp -= dmg;
    m.provoked = true;
    log(`Слово Божие опаляет ${m.def.acc}: −${dmg}.`, C.violet);
    if (m.hp <= 0) killBeast(m, true);
  }
  endTurn();
}

function quaff() {
  const p = G.player;
  if (!p.potions) { log('Отваров не осталось. Их варит знахарка.', C.dark); return; }
  p.potions--;
  const heal = 8 + rng.int(1, 6);
  p.hp = Math.min(p.maxHp, p.hp + heal);
  p.poison = 0;
  log(`Ты пьёшь горький отвар: +${heal} здоровья.`, C.green);
  endTurn();
}

function rest() {
  const p = G.player;
  const danger = () => visibleBeasts().find(m => m.def.behavior !== 'flee');
  if (danger()) { log('Рядом опасность — не до отдыха.', C.red); return; }
  if (p.hp >= p.maxHp && p.grace >= p.maxGrace && !p.poison) { log('Ты и так полон сил.', C.dim); return; }
  log('Ты присаживаешься передохнуть...', C.dim);
  for (let i = 0; i < 400; i++) {
    const hp = p.hp;
    endTurn();
    if (p.hp <= 0) return;
    const m = danger();
    if (m) { log(`Ты замечаешь: ${lower(m.name)}!`, C.red); return; }
    if (p.hp < hp && !p.poison) return;
    if (p.hp >= p.maxHp && p.grace >= p.maxGrace && !p.poison) { log('Ты отдохнул.', C.dim); return; }
  }
}

// ─── Основной экран игры ───────────────────────────────────────────

class PlayScreen {
  constructor() { this.overlay = false; }

  key(k) {
    const dir = KEY_DIRS[k.code];
    if (dir) return tryMove(dir[0], dir[1]);
    switch (k.code) {
      case 'Space': case 'Period': case 'Numpad5': case 'NumpadDecimal': endTurn(); break;
      case 'KeyP': pray(); break;
      case 'KeyQ': quaff(); break;
      case 'KeyR': rest(); break;
      case 'KeyC': pushScreen(new CharacterScreen()); break;
      case 'KeyI': pushScreen(new InventoryScreen()); break;
      case 'KeyX': pushScreen(new BestiaryScreen()); break;
      case 'F1': case 'Slash': pushScreen(new HelpScreen()); break;
    }
  }

  render(t) {
    this.renderMap(t);
    this.renderPanel(t);
    this.renderLog(t);
  }

  camera() {
    const p = G.player, w = G.world;
    return [
      Math.max(0, Math.min(w.w - MAP_W, p.x - (MAP_W >> 1))),
      Math.max(0, Math.min(w.h - MAP_H, p.y - (MAP_H >> 1))),
    ];
  }

  renderMap(t) {
    const w = G.world, [cx, cy] = this.camera();
    const dk = darkness() * 0.4;
    for (let sy = 0; sy < MAP_H; sy++) {
      for (let sx = 0; sx < MAP_W; sx++) {
        const x = cx + sx, y = cy + sy, i = w.idx(x, y);
        if (!w.explored[i]) continue;
        const td = TILES[w.tiles[i]];
        const ch = td.ch[Math.floor(hash2(x, y) * td.ch.length)];
        if (w.visible[i]) {
          let fg = td.fg[Math.floor(hash2(y, x) * td.fg.length)];
          if (dk) fg = mix(fg, C.night, dk);
          t.put(sx, sy, ch, fg, td.bg || null);
        } else {
          t.put(sx, sy, ch, C.memory, null);
        }
      }
    }
    for (const [k, list] of w.items) {
      const [x, y] = k.split(',').map(Number);
      if (w.isVisible(x, y) && list.length) t.put(x - cx, y - cy, '%', '#c07050');
    }
    for (const a of w.actors) {
      if (a === G.player || !w.isVisible(a.x, a.y)) continue;
      const sx = a.x - cx, sy = a.y - cy;
      if (sx >= 0 && sy >= 0 && sx < MAP_W && sy < MAP_H) t.put(sx, sy, a.glyph, a.color);
    }
    const p = G.player;
    t.put(p.x - cx, p.y - cy, '@', p.poison ? C.green : C.white);
  }

  renderPanel(t) {
    const p = G.player, w = G.world, x = PANEL_X + 1;
    for (let y = 0; y < MAP_H; y++) t.put(PANEL_X - 1, y, '│', C.dark);
    let y = 0;
    t.print(x, y++, p.name.slice(0, 30), C.gold);
    t.print(x, y++, `${p.people.name}, ${p.level}-й ур.`, C.dim);
    y++;
    const bar = (label, val, max, col) => {
      t.print(x, y, label, C.dim);
      t.bar(x + 10, y, 11, val, max, col);
      t.print(x + 22, y++, `${Math.max(0, val)}/${max}`, C.text);
    };
    bar('Здоровье', p.hp, p.maxHp, p.hp < p.maxHp / 3 ? C.red : C.blood);
    bar('Благодать', p.grace, p.maxGrace, C.gold);
    bar('Опыт', p.xp, p.xpNext, C.violet);
    y++;
    t.printRich(x, y++, `{dim}Сила{} ${String(p.stats.str).padEnd(4)}{dim}Живучесть{} ${p.stats.con}`);
    t.printRich(x, y++, `{dim}Мудр.{} ${String(p.stats.wis).padEnd(3)} {dim}Вера{}      ${p.stats.fai}`);
    y++;
    const wp = WEAPONS[p.weapon];
    t.printRich(x, y++, `{dim}Оружие{} ${wp.name} ${wp.dmg[0]}–${wp.dmg[1]}`);
    t.printRich(x, y++, `{dim}Броня{}  ${ARMORS[p.armorId].name} (${p.armor})`);
    t.printRich(x, y++, `{dim}Монеты{} {gold}${p.coins}{}  {dim}Отвары{} ${p.potions}`);
    y++;
    const ti = timeInfo(), night = isNight();
    const clock = `${String(ti.hour).padStart(2, '0')}:${String(ti.min).padStart(2, '0')}`;
    t.printRich(x, y++, `{dim}День ${ti.day}, ${clock}{} ` + (night ? '{sky}☾ ночь' : darkness() > 0 ? '{orange}☼ сумерки' : '{gold}☼ день'));
    const v = w.villageAt(p.x, p.y), b = w.buildingAt(p.x, p.y);
    t.print(x, y++, (b ? b.name : v ? `Деревня ${v.name}` : w.def(p.x, p.y).name).slice(0, 30), v ? C.gold : C.text);
    if (p.poison) t.print(x, y++, 'Отравлен!', C.green);
    if (p.statPoints) t.print(x, y++, `Очки характеристик: ${p.statPoints} (C)`, C.gold);
    for (const q of p.quests.slice(0, 2))
      t.print(x, y++, `${BEASTS[q.target].name} ${q.have}/${q.need}${q.done ? ' ✓' : ''} · ${q.villageName}`.slice(0, 30),
        q.done ? C.green : C.dim);

    y++;
    const near = visibleBeasts();
    if (near.length && y < MAP_H - 1) {
      t.print(x, y++, '── Рядом ──', C.dark);
      for (const m of near) {
        if (y >= MAP_H) break;
        t.put(x, y, m.glyph, m.color);
        t.print(x + 2, y, m.name.slice(0, 17), m.def.unholy ? C.violet : C.text);
        t.bar(x + 20, y++, 9, m.hp, m.maxHp, C.blood);
      }
    }
  }

  renderLog(t) {
    for (let i = 0; i < COLS; i++) t.put(i, MAP_H, '─', C.dark);
    const lines = [];
    for (let i = G.messages.length - 1; i >= 0 && lines.length < LOG_H; i--) {
      const m = G.messages[i];
      const wrapped = wrapText(m.text, COLS - 2);
      for (let j = wrapped.length - 1; j >= 0 && lines.length < LOG_H; j--)
        lines.unshift({ text: wrapped[j], color: m.color, old: m.turn < G.turn - 1 });
    }
    lines.forEach((l, i) => t.print(1, LOG_Y + i, l.text, l.old ? mix(l.color, C.bg, 0.45) : l.color));
  }
}

// ─── Цикл отрисовки и ввод ─────────────────────────────────────────

function render() {
  const t = G.term;
  t.clear();
  let from = G.screens.length - 1;
  while (from > 0 && G.screens[from].overlay) from--;
  for (let i = from; i < G.screens.length; i++) G.screens[i].render(t);
  t.flush();
}

function handleKey(k) {
  const s = topScreen();
  if (s) s.key(k);
  render();
}
