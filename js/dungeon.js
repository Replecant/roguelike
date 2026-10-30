'use strict';

// ─── Римские подземелья ────────────────────────────────────────────
// Редкие входы на карте Италии. Внутри — несколько уровней ходов с нишами
// для костей, усыпальницы с саркофагами, нежить и тень проконсула внизу.

const TOMB_FAMOUS = [
  { name: 'Катакомбы Святого Каликста', lon: 12.51, lat: 41.86, depth: 4,
    desc: 'Подземный город мёртвых на Аппиевой дороге: двадцать миль ходов, где хоронили первых христиан и девять пап. '
      + 'Говорят, в нижних галереях лежат не только святые.' },
  { name: 'Катакомбы Сан-Дженнаро', lon: 14.24, lat: 40.87, depth: 4,
    desc: 'Катакомбы под холмом Каподимонте, где покоился святой Януарий. Неаполитанцы спускаются сюда только с факелом и молитвой.' },
];

const TOMB_KINDS = ['Гробница', 'Мавзолей', 'Колумбарий', 'Некрополь'];
const ROMAN_GENS = ['Валериев', 'Клавдиев', 'Корнелиев', 'Сервилиев', 'Юлиев', 'Флавиев', 'Эмилиев', 'Фабиев',
  'Сульпициев', 'Аврелиев', 'Домициев', 'Метеллов', 'Сципионов'];

// Что можно найти в саркофаге.
const ROMAN_LOOT = [
  { id: 'denarii', name: 'Серебряные денарии', value: 12, w: 5 },
  { id: 'fibula', name: 'Бронзовая фибула', value: 8, w: 4 },
  { id: 'unguentarium', name: 'Стеклянный флакон для благовоний', value: 6, w: 4 },
  { id: 'gem_ring', name: 'Золотое кольцо с геммой', value: 30, w: 1 },
  { id: 'marble_head', name: 'Мраморная голова', value: 20, w: 2 },
];

function placeTombs(ow, r, placeOnLand) {
  let n = 0;
  const add = (x, y, info) => {
    const t = {
      id: `tomb${n++}`, type: 'site', dungeon: true, glyph: 'Π', color: '#d8c8a0', x, y,
      region: ow.regionAt(x, y), terrain: ow.get(x, y), ...info,
    };
    ow.sites.push(t);
    ow.places.set(ow.idx(x, y), t);
  };
  for (const f of TOMB_FAMOUS) {
    const [x, y] = placeOnLand(f.lon, f.lat);
    if (!ow.placeAt(x, y)) add(x, y, { name: f.name, depth: f.depth, desc: f.desc, famous: true });
  }
  // Ещё семь — у старых римских дорог, подальше друг от друга.
  const tombs = () => ow.sites.filter(s => s.dungeon);
  for (let t = 0; t < 8000 * MAP_SCALE && tombs().length < 9; t++) {
    const x = r.int(2, ow.w - 3), y = r.int(2, ow.h - 3);
    const tile = ow.get(x, y);
    if (!OTILES[tile].pass || tile === OT.RIVER || ow.placeAt(x, y)) continue;
    if (!DIRS8.some(([dx, dy]) => ow.inside(x + dx, y + dy) && ow.road[ow.idx(x + dx, y + dy)] >= 0)) continue;
    if (ow.cities.some(c => Math.max(Math.abs(c.x - x), Math.abs(c.y - y)) < 3 * MAP_SCALE)) continue;
    if (tombs().some(s => Math.hypot(s.x - x, (s.y - y) * 2) < 30 * MAP_SCALE)) continue;
    const kind = r.pick(TOMB_KINDS), gens = r.pick(ROMAN_GENS);
    add(x, y, {
      name: `${kind} ${gens}`, depth: r.int(2, 3),
      desc: `${kind} римского рода ${gens}: вход завален, но кто-то недавно разобрал камни. Изнутри тянет холодом.`,
    });
  }
}

// ─── Уровень подземелья ────────────────────────────────────────────

function makeTombLevel(site, depth) {
  const W = 80, H = 40, r = new RNG((G.seed ^ (site.x * 7919 + site.y * 104729)) + depth * 31337);
  const w = new World(W, H);
  w.kind = 'dungeon';
  w.site = site;
  w.depth = depth;
  w.region = site.region;
  w.tiles.fill(T.TOMBWALL);

  // Усыпальницы-кубикулы.
  const rooms = [];
  for (let t = 0; t < 300 && rooms.length < 11; t++) {
    const rw = r.int(5, 11), rh = r.int(4, 7);
    const x = r.int(2, W - rw - 3), y = r.int(2, H - rh - 3);
    if (rooms.some(o => x < o.x + o.w + 3 && o.x < x + rw + 3 && y < o.y + o.h + 2 && o.y < y + rh + 2)) continue;
    rooms.push({ x, y, w: rw, h: rh, cx: x + (rw >> 1), cy: y + (rh >> 1) });
  }
  const isRoom = new Uint8Array(W * H);
  for (const o of rooms)
    for (let y = o.y; y < o.y + o.h; y++)
      for (let x = o.x; x < o.x + o.w; x++) { w.set(x, y, T.TOMBFLOOR); isRoom[w.idx(x, y)] = 1; }

  // Ходы: каждая комната с соседней, плюс несколько петель.
  rooms.sort((a, b) => a.cx - b.cx);
  const dig = (a, b) => {
    let x = a.cx, y = a.cy;
    const horizFirst = r.chance(0.5);
    const step = (tx, ty) => {
      while (x !== tx || y !== ty) {
        if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y);
        if (w.get(x, y) === T.TOMBWALL) w.set(x, y, T.TOMBFLOOR);
      }
    };
    if (horizFirst) { step(b.cx, y); step(b.cx, b.cy); } else { step(x, b.cy); step(b.cx, b.cy); }
  };
  for (let i = 1; i < rooms.length; i++) dig(rooms[i - 1], rooms[i]);
  for (let k = 0; k < 3; k++) dig(r.pick(rooms), r.pick(rooms));

  // Стены ходов — ниши-локулы с костями.
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      if (w.get(x, y) !== T.TOMBWALL) continue;
      const nearCorridor = DIRS4.some(([dx, dy]) => w.get(x + dx, y + dy) === T.TOMBFLOOR && !isRoom[w.idx(x + dx, y + dy)]);
      if (nearCorridor && r.chance(0.45)) w.set(x, y, T.NICHE);
    }

  // Кости, саркофаги, колонны.
  for (const o of rooms) {
    for (let y = o.y; y < o.y + o.h; y++)
      for (let x = o.x; x < o.x + o.w; x++) if (r.chance(0.08)) w.set(x, y, T.BONES);
    // Саркофаги вдоль стен — но не перед входами в комнату.
    const spots = [];
    for (let x = o.x + 1; x < o.x + o.w - 1; x++) spots.push([x, o.y, -1], [x, o.y + o.h - 1, 1]);
    let placed = 0;
    for (const [x, y, out] of r.shuffle(spots)) {
      if (placed >= r.int(1, 3)) break;
      if ([-1, 0, 1].some(dx => w.walkable(x + dx, y + out))) continue;
      w.set(x, y, T.SARCOPHAGUS);
      placed++;
    }
    if (o.w >= 9 && o.h >= 6) for (const [dx, dy] of [[2, 2], [o.w - 3, 2], [2, o.h - 3], [o.w - 3, o.h - 3]]) w.set(o.x + dx, o.y + dy, T.COLUMN);
  }

  // Лестницы: наверх — в первой комнате, вниз — в самой дальней.
  const first = rooms[0];
  const far = rooms.reduce((a, b) => Math.hypot(b.cx - first.cx, b.cy - first.cy) > Math.hypot(a.cx - first.cx, a.cy - first.cy) ? b : a);
  w.set(first.cx, first.cy, T.STAIRS_UP);
  w.up = [first.cx, first.cy];
  const last = depth === site.depth - 1;
  if (!last) {
    w.set(far.cx, far.cy, T.STAIRS_DOWN);
    w.down = [far.cx, far.cy];
  } else {
    // Последний уровень: алтарь, богатый саркофаг и тень проконсула.
    w.set(far.cx, far.y + 1, T.PAGAN_ALTAR);
    w.set(far.cx + 1, far.y + 1, T.SARCOPHAGUS);
    w.richSarcophagus = w.idx(far.cx + 1, far.y + 1);
    if (!G.flags[`${site.id}_boss`]) {
      const boss = makeBeast('proconsul', far.cx, far.cy + 1);
      boss.bossOf = site.id;
      w.actors.push(boss);
    }
  }

  // Обитатели — подальше от лестницы наверх.
  const prevWorld = G.world;
  G.world = w;
  const p = G.player, px = p.x, py = p.y;
  p.x = first.cx; p.y = first.cy;
  spawnBeasts(3 + depth * 2, true, false, 8);
  p.x = px; p.y = py;
  G.world = prevWorld;
  return w;
}

// ─── Переходы ──────────────────────────────────────────────────────

function enterDungeon(site) {
  const d = G.dungeons[site.id] || (G.dungeons[site.id] = { levels: [] });
  log(site.desc, C.violet);
  goToLevel(site, d, 0, 'up');
  log('Ты зажигаешь факел и спускаешься во тьму. Наверх ведёт лестница (<).', C.dim);
}

function goToLevel(site, d, depth, arriveAt) {
  if (!d.levels[depth]) d.levels[depth] = makeTombLevel(site, depth);
  const w = d.levels[depth];
  const [sx, sy] = arriveAt === 'up' ? w.up : w.down;
  // Встать рядом с лестницей, а не на неё.
  const spot = DIRS8.map(([dx, dy]) => [sx + dx, sy + dy]).find(([x, y]) => w.free(x, y)) || [sx, sy];
  placePlayer(w, spot[0], spot[1]);
}

// Игрок наступил на лестницу.
function useStairs(tile) {
  const w = G.world, site = w.site, d = G.dungeons[site.id];
  if (tile === T.STAIRS_DOWN) {
    goToLevel(site, d, w.depth + 1, 'up');
    log(`Ты спускаешься ниже. Уровень ${w.depth + 2} из ${site.depth}.`, C.dim);
    if (w.depth + 2 === site.depth) log('Здесь пахнет старым ладаном и чем-то сладковатым. Ты почти у самого дна.', C.violet);
  } else if (w.depth === 0) {
    leaveLocal();
  } else {
    goToLevel(site, d, w.depth - 1, 'down');
    log(`Ты поднимаешься. Уровень ${w.depth} из ${site.depth}.`, C.dim);
  }
}

// Находка сразу в котомку.
function takeTrophy(it) {
  const tr = G.player.trophies[it.id] || (G.player.trophies[it.id] = { name: it.name, value: it.value, count: 0 });
  tr.count++;
}

function openSarcophagus(x, y) {
  const w = G.world, p = G.player, i = w.idx(x, y);
  w.set(x, y, T.SARC_OPEN);
  log('Ты сдвигаешь тяжёлую крышку саркофага...', C.dim);
  if (i === w.richSarcophagus) {
    const coins = rng.int(40, 80), relic = makeItem(rng.pick(['gorgoneion', 'signet', 'bulla']));
    takeTrophy(ROMAN_LOOT.find(l => l.id === 'gem_ring'));
    p.coins += coins;
    p.bag.push(relic);
    log(`Внутри — золото наместника: ${coins} мон., золотое кольцо с геммой и ${relic.name.toLowerCase()}.`, C.gold);
    return;
  }
  const roll = rng.next();
  if (roll < 0.2) {
    const key = rng.pick(['skeleton', 'skeleton', 'lemur', 'ghoul']);
    const spot = DIRS8.map(([dx, dy]) => [x + dx, y + dy]).find(([sx, sy]) => w.free(sx, sy));
    if (spot) {
      const m = makeBeast(key, spot[0], spot[1]);
      m.provoked = true;
      w.actors.push(m);
      log(`Из саркофага поднимается ${lower(m.name)}!`, C.red);
      return;
    }
  }
  if (roll < 0.35) { log('Внутри только прах и истлевшие пелены.', C.dim); return; }
  if (roll < 0.5) { p.potions++; log('Среди костей — запечатанная склянка. Это целебный отвар!', C.green); return; }
  if (roll < 0.75) {
    const coins = rng.int(5, 25);
    p.coins += coins;
    log(`Между рёбер покойника — монеты для Харона: ${coins} мон.`, C.gold);
    return;
  }
  if (roll < 0.86) {
    const loot = rng.weighted(ROMAN_LOOT);
    takeTrophy(loot);
    log(`Ты находишь: ${loot.name}.`, C.gold);
    return;
  }
  // Редкая удача: римский оберег или оружие легионера.
  const it = makeItem(rng.pick(['gorgoneion', 'bulla', 'signet', 'gladius', 'galea', 'scutum']));
  p.bag.push(it);
  log(`Под истлевшими пеленами — ${it.name}! (I — снаряжение)`, C.gold);
}
