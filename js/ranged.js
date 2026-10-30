'use strict';

// ─── Стрельба и метание ────────────────────────────────────────────
// F — выстрелить из того, что в правой руке (праща, лук, арбалет), а если
// стрелкового оружия нет — метнуть дротик или нож. Стрелы и дротики часто
// можно подобрать там, куда они упали.

const AMMO = {
  stone:   { name: 'Камни', infinite: true },
  arrow:   { name: 'Стрелы', keep: 0.4 },
  bolt:    { name: 'Болты', keep: 0.4 },
  javelin: { name: 'Дротики', keep: 0.75, thrown: true, dmg: [2, 7], range: 5, acc: 0, verb: 'метаешь дротик' },
  tknife:  { name: 'Метательные ножи', keep: 0.75, thrown: true, dmg: [1, 5], range: 6, acc: 1, verb: 'бросаешь нож' },
};

const THROWN_ORDER = ['javelin', 'tknife'];

function ammoLoad(p) {
  return Math.floor(((p.ammo && p.ammo.javelin) || 0) / 2);
}

// Чем стрелять сейчас: { kind: 'launcher' | 'thrown', ... } или null.
function rangedMode(p) {
  const w = p.equip.right;
  if (w && w.ranged) return { launcher: w, ammo: w.ranged.ammo, range: w.ranged.range };
  const t = THROWN_ORDER.find(a => p.ammo[a] > 0);
  if (t) return { ammo: t, range: AMMO[t].range };
  return null;
}

function ammoLeft(p, ammo) { return AMMO[ammo].infinite ? Infinity : p.ammo[ammo] || 0; }

// Клетки по прямой от a до b (без начальной).
function lineCells(x0, y0, x1, y1) {
  const out = [], dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
  let err = dx - dy, x = x0, y = y0;
  while (x !== x1 || y !== y1) {
    const e2 = err * 2;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    out.push([x, y]);
  }
  return out;
}

// Куда долетит снаряд: первая тварь или стена на пути.
function flightPath(w, p, tx, ty) {
  const cells = [];
  for (const [x, y] of lineCells(p.x, p.y, tx, ty)) {
    if (!w.transparent(x, y) && !w.walkable(x, y)) return { cells, wall: [x, y] };
    cells.push([x, y]);
    const a = w.actorAt(x, y);
    if (a && a !== p) return { cells, hit: a };
  }
  return { cells };
}

function rangedTargets(mode) {
  const p = G.player, w = G.world;
  return visibleBeasts().filter(m => dist(m, p) <= mode.range && flightPath(w, p, m.x, m.y).hit === m);
}

function fire() {
  const p = G.player;
  if (G.mode !== 'local') { log('Стрелять можно только на местной карте.', C.dark); return; }
  const mode = rangedMode(p);
  if (!mode) { log('Нечем стрелять: нужна праща, лук или арбалет — или дротики, метательные ножи.', C.dark); return; }
  if (mode.launcher && !ammoLeft(p, mode.ammo)) { log(`${AMMO[mode.ammo].name} кончились. Их продают кузнецы.`, C.dark); return; }
  const r = mode.launcher && mode.launcher.ranged;
  if (r && r.reload && !p.loaded) {
    log(`Ты взводишь ${lower(mode.launcher.name)}...`, C.dim);
    p.loaded = true;
    for (let i = 0; i < r.reload && G.player.hp > 0 && G.mode === 'local'; i++) endTurn();
    return;
  }
  const targets = rangedTargets(mode);
  if (!targets.length) { log(`Нет цели на линии выстрела (дальность ${mode.range}).`, C.dim); return; }
  pushScreen(new TargetScreen(mode, targets));
}

function shoot(mode, target) {
  const p = G.player, w = G.world, launcher = mode.launcher, r = launcher && launcher.ranged, am = AMMO[mode.ammo];
  const path = flightPath(w, p, target.x, target.y), m = path.hit;
  if (!am.infinite) p.ammo[mode.ammo]--;
  if (r && r.reload) p.loaded = false;
  const verb = launcher ? (mode.ammo === 'stone' ? 'раскручиваешь пращу' : mode.ammo === 'bolt' ? 'спускаешь тетиву арбалета' : 'стреляешь из лука') : am.verb;
  const land = path.cells.length ? path.cells[path.cells.length - 1] : [p.x, p.y];
  if (!m || m.kind !== 'beast') {
    log(`Ты ${verb} — ${path.wall ? 'снаряд бьётся о преграду' : 'мимо'}.`, C.dim);
    dropAmmo(w, mode.ammo, land);
    return endTurn();
  }
  m.provoked = true;
  m.calmUntil = 0;
  m.target = [p.x, p.y];
  const d = dist(m, p);
  let acc = Math.floor(p.stats.dex / 2) + Math.floor(p.level / 2) + gearSum(p, 'acc') - (p.equip.right && p.equip.right.acc || 0)
    + (r ? r.racc || 0 : am.acc) - Math.floor(d / 4);
  if (r && r.str && p.stats.str < r.str) acc -= 3;
  // Дождь и снег мочат тетиву лука; арбалету это почти не мешает.
  acc -= mode.ammo === 'bolt' ? weatherRanged() >> 1 : weatherRanged();
  if (!rng.chance(hitChance(acc, m.def.ev))) {
    log(`Ты ${verb} — ${lower(m.name)} уходит от удара.`, C.dim);
    dropAmmo(w, mode.ammo, [m.x, m.y]);
    return endTurn();
  }
  const base = r ? r.rdmg : am.dmg;
  let dmg = rng.roll(base[0], base[1]) + (r ? 0 : Math.floor((p.stats.str - 5) / 2)) + gearSum(p, 'dmgBonus')
    + (m.def.unholy ? gearSum(p, 'vsUnholy') : 0) - rng.int(0, m.def.armor);
  dmg = Math.max(1, dmg);
  m.hp -= dmg;
  dropAmmo(w, mode.ammo, [m.x, m.y]);
  if (m.hp <= 0) { log(`Ты ${verb}: ${lower(m.name)} −${dmg}.`, C.text); killBeast(m, true); }
  else log(`Ты ${verb}: ${lower(m.name)} −${dmg}.`, C.text);
  endTurn();
}

function dropAmmo(w, ammo, [x, y]) {
  const am = AMMO[ammo];
  if (am.infinite || !rng.chance(am.keep)) return;
  if (!w.walkable(x, y)) return;
  w.addItem(x, y, { kind: 'ammo', ammo, n: 1, name: am.name });
}

// ─── Выбор цели ────────────────────────────────────────────────────

class TargetScreen {
  constructor(mode, targets) { this.overlay = true; this.mode = mode; this.targets = targets; this.sel = 0; }

  key(k) {
    const n = this.targets.length;
    if (isEsc(k)) return popScreen();
    if (k.code === 'Tab' || isRight(k) || isDown(k) || k.code === 'Space') this.sel = (this.sel + 1) % n;
    else if (isLeft(k) || isUp(k)) this.sel = (this.sel + n - 1) % n;
    else if (isEnter(k) || k.code === 'KeyF') { popScreen(); shoot(this.mode, this.targets[this.sel]); }
  }

  render(t) {
    const p = G.player, w = G.world, m = this.targets[this.sel];
    const [cx, cy] = G.screens[0].camera(w.w, w.h, p.x, p.y);
    const path = flightPath(w, p, m.x, m.y);
    for (const [x, y] of path.cells.slice(0, -1)) t.put(x - cx, y - cy, '·', C.gold);
    t.put(m.x - cx, m.y - cy, m.glyph, '#000000', C.gold);
    const am = AMMO[this.mode.ammo], left = ammoLeft(p, this.mode.ammo);
    const what = this.mode.launcher ? this.mode.launcher.name : am.name;
    t.print(1, MAP_H - 1, ` Цель: ${m.name} (${dist(m, p)} шаг.)  ${what}, ${left === Infinity ? 'камней вдоволь' : `осталось ${left}`}  ·  Tab — цель, F — огонь `.slice(0, MAP_W - 2), C.gold, '#1a1408');
  }
}
