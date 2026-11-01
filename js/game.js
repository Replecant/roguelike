'use strict';

const COLS = 100, ROWS = 36;
const MAP_W = 68, MAP_H = 28;      // окно карты
const PANEL_X = 69;                // правая панель
const LOG_Y = 29, LOG_H = ROWS - LOG_Y;

const MINUTES_PER_TURN = 2;        // один шаг на местной карте
const START_MINUTE = 8 * 60;

const G = {
  term: null,
  seed: 0,
  over: null,          // карта Италии
  ox: 0, oy: 0,        // где игрок на карте Италии
  mode: 'over',        // over — путешествие, local — местная карта
  world: null,         // текущая местная карта
  cityMaps: {},        // посещённые города
  dungeons: {},        // посещённые подземелья
  flags: {},
  player: null,
  turn: 0,
  minutes: 0,
  messages: [],
  screens: [],
  deathCause: null,
  wasNight: false,
};

function log(text, color = C.text) {
  G.messages.push({ text, color, turn: G.turn });
  if (G.messages.length > 500) G.messages.shift();
}

function pushScreen(s) { G.screens.push(s); }
function popScreen() { G.screens.pop(); }
function topScreen() { return G.screens[G.screens.length - 1]; }

// ─── Время суток ───────────────────────────────────────────────────

function timeInfo() {
  const total = START_MINUTE + G.minutes;
  const day = Math.floor(total / 1440) + 1, m = total % 1440;
  return { day, hour: Math.floor(m / 60), min: m % 60 };
}

// Ночь и сумерки зависят от времени года: летом светло с пяти до девяти, зимой — с восьми до пяти.
function isNight() {
  const { hour, min } = timeInfo(), h = hour + min / 60, { rise, set } = sunTimes();
  return h >= set + 1 || h < rise - 1;
}

// 0 — день, 1 — глубокая ночь; плавно в сумерках.
function darkness() {
  const { hour, min } = timeInfo(), h = hour + min / 60, { rise, set } = sunTimes();
  if (h >= set + 1 || h < rise - 1) return 1;
  if (h >= set - 1) return (h - (set - 1)) / 2;
  if (h < rise + 1) return 1 - (h - (rise - 1)) / 2;
  return 0;
}

// Мост рисуется вдоль своего пролёта: где настил длиннее — туда и доски.
function bridgeSprite(w, x, y) {
  const run = (dx, dy) => { let n = 0; for (let k = 1; k <= 6 && w.get(x + dx * k, y + dy * k) === T.BRIDGE; k++) n++; return n; };
  // Река города известна — мост поперёк неё; иначе — по длине пролёта.
  const vert = w.riverAxis ? w.riverAxis === 'h' : run(0, 1) + run(0, -1) > run(1, 0) + run(-1, 0);
  const br = (dx, dy) => w.get(x + dx, y + dy) === T.BRIDGE;
  const a = vert ? br(-1, 0) : br(0, -1), b = vert ? br(1, 0) : br(0, 1);
  return (vert ? 'bridgev' : 'bridge') + (a ? 'a' : '') + (b ? 'b' : '');
}

function sightRadius() {
  const p = G.player, d = darkness();
  // Под землёй видно только то, что освещает факел.
  if (G.world.prison) return G.world.prison.mode === 'sewer' ? 4 : 6;   // факелы в ходах тюрьмы
  if (G.world.kind === 'dungeon') {
    // Под землёй без огня в руке — наощупь, на шаг вокруг. Свет — факел в руке (или Свет Солнца, золотая ветвь).
    const light = gearSum(p, 'light') + (p.lumenUntil > G.minutes ? 3 : 0);
    if (!light) return 1;
    return Math.max(1, 1 + Math.floor(p.stats.wis / 4) + light + gearSum(p, 'sight'));
  }
  let r = Math.round(p.sightDay + (p.sightNight - p.sightDay) * d);
  if (G.world.villageAt(p.x, p.y)) r += d > 0.5 ? 3 : 5;   // открытые улицы днём, факелы ночью
  return Math.max(2, r - weatherSight());
}

// Восстановление сил, яд, тарантизм — раз в 2 минуты.
function tickPlayer() {
  const p = G.player, tick = G.minutes / MINUTES_PER_TURN;
  if (p.poison > 0) {
    if (tick % 2 === 0) {
      p.hp--;
      if (p.hp <= 0) G.deathCause = 'яд';
    }
    if (--p.poison === 0) log('Яд отступил.', C.green);
  } else if (p.hp < p.maxHp && !p.fever && hungerState(p) === 0 && tick % Math.max(4, 16 - Math.floor(p.stats.con / 2)) === 0) {
    p.hp++;
  }
  if (p.grace < p.maxGrace && tick % Math.max(4, 26 - p.stats.fai - gearSum(p, 'graceRegen')) === 0) p.grace++;
  if (p.confused > 0 && --p.confused === 0) log('Ты снова владеешь собой.', C.dim);
  survivalTick(p, MINUTES_PER_TURN, G.travelLoad || 1);
}

// Пропустить время на карте Италии.
function passTime(minutes) {
  for (let m = 0; m < minutes && G.player.hp > 0; m += MINUTES_PER_TURN) {
    G.minutes += MINUTES_PER_TURN;
    tickPlayer();
  }
  travelersTick(minutes);
  checkDayNight();
}

const SNOW_TILES = new Set([T.GRASS, T.TALLGRASS, T.FOREST, T.PINE, T.HILL, T.ROAD, T.DIRT, T.FIELD, T.COBBLE, T.RUBBLE,
  T.GARDEN, T.VINEYARD, T.STUBBLE, T.MARSH, T.SAND]);

function checkDayNight() {
  worldTick();
  weatherTick();
  const night = isNight();
  if (night === G.wasNight) return;
  G.wasNight = night;
  autosave();
  if (night) {
    log('Сгущается ночь. Из чащи и болот выходит то, что днём прячется.', C.violet);
    if (G.mode === 'local' && G.world.kind !== 'city' && G.world.kind !== 'dungeon') spawnBeasts(4, true, true);
    if (G.mode === 'local' && G.world.site && G.world.site.id === 'walnut') summonCoven();
    if (G.mode === 'local' && G.world.lead && LEAD_KINDS[G.world.lead.kind].night && !G.world.lead.done) wakeWerewolf(G.world, G.world.lead);
  } else {
    log('Светает. Где-то кричат петухи.', C.gold);
    if (G.mode === 'local' && G.world.kind !== 'dungeon') dawnCleanup(true);
  }
}

// Ночью улицы пустеют: жители по домам, монахи в кельях. Не спят стража и трактирщик;
// особые гости (легат, учителя, проповедник, люди из заданий) на месте. Изредка кто-то бродит.
// У кого свой дом (хижина, кузница, церковь), тот спит в нём — его видно, можно разбудить.
// В деревне бездомные по улицам ночуют в хижинах; в городе дома — сплошные кварталы, туда не войти:
// горожане просто расходятся.
const NIGHT_STAY = new Set(['guard', 'innkeeper']);
const lateNight = () => { const h = timeInfo().hour; return h >= 22 || h < 6; };
function nightBed(w, n) {
  if (n.home && n.home.building >= 0) return findFreeIn(w, n.home);
  const v = n.village, k = v.npcs.indexOf(n);
  const huts = w.buildings.filter(b => b.role === 'peasant' || b.role === 'elder');
  if (v.city.kind !== 'village' || !huts.length) return null;
  const b = huts[k % huts.length];
  return findFreeIn(w, { x: b.x, y: b.y, w: b.w, h: b.h, building: b.id });
}
function townNight(w) {
  if (!w || w.kind !== 'city' || !w.villages || !w.villages.length) return;
  const night = lateNight();
  if (!!w.streetsEmpty === night) return;
  w.streetsEmpty = night;
  const p = G.player;
  for (const v of w.villages) for (const n of v.npcs) {
    if (n.special || n.fib || n.verona || n.louis || n.inquisitor || n.teacher || n.hap || n.emperor || n.fairRole || n.librarian) continue;
    if (night) {
      if (NIGHT_STAY.has(n.role) || rng.chance(0.08)) continue;   // стража, трактир — и редкий полуночник
      const bed = w.actors.includes(n) && nightBed(w, n);
      if (bed) { n.dayAt = [n.x, n.y]; n.x = bed[0]; n.y = bed[1]; n.sleeping = true; continue; }
      n.homeAtNight = true;
      w.actors = w.actors.filter(a => a !== n);
    } else if (n.sleeping) {
      n.sleeping = false;
      // Утром — снова на свой двор или улицу.
      if (!(n.home && n.home.building >= 0)) {
        const spot = n.dayAt && w.free(n.dayAt[0], n.dayAt[1]) ? n.dayAt : findFreeIn(w, n.home);
        if (spot) { n.x = spot[0]; n.y = spot[1]; }
      }
      n.dayAt = null;
    } else if (n.homeAtNight) {
      n.homeAtNight = false;
      const spot = w.free(n.x, n.y) ? [n.x, n.y] : findFreeIn(w, { x: n.x - 3, y: n.y - 2, w: 7, h: 5, building: -1 });
      if (!spot) continue;
      n.x = spot[0]; n.y = spot[1];
      if (!w.actors.includes(n)) w.actors.push(n);
    }
  }
  const village = w.villages[0].city.kind === 'village';
  if (G.world === w && G.mode === 'local' && p) log(night
    ? (village ? 'Деревня засыпает: гаснут лучины, хлопают двери. Люди спят по домам.' : 'Улицы пустеют: хлопают ставни, гаснут огни. Город ложится спать.')
    : (village ? 'Деревня просыпается: скрипят двери, мычит скотина. Начинается день.' : 'Отворяются ставни, на улицы выходят люди. Начинается день.'), C.dim);
}

function sleepUntilMorning() {
  const p = G.player, total = START_MINUTE + G.minutes;
  let target = Math.floor(total / 1440) * 1440 + 7 * 60;
  if (target <= total + 4 * 60) target += 1440;
  G.minutes += target - total;
  p.hp = p.maxHp;
  p.grace = p.maxGrace;
  p.poison = 0;
  p.confused = 0;
  p.fatigue = 0;
  p.food = Math.max(0, p.food - 15);
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

// startId — город начала (для проверок); без него — случайный город Италии.
function startGame(player, startId = null) {
  G.seed = (Math.random() * 2 ** 32) >>> 0;
  rng = new RNG(G.seed);
  G.over = generateItaly(new RNG(G.seed));
  G.player = player;
  G.turn = 0;
  G.minutes = 0;
  G.cityMaps = {};
  G.dungeons = {};
  G.flags = {};
  G.messages = [];
  G.deathCause = null;
  G.wasNight = false;
  // Состояние мира прошлой игры — с чистого листа.
  Object.assign(G, { happenings: [], hapCool: {}, lastBattle: 0, battles: 0, escortFight: null, travelerClock: 0, clashClock: 0,
    leadMaps: {}, debug: { god: false } });
  G.screens = [new PlayScreen()];
  initNews();

  // Путь начинается в случайном городе Италии (Гельвеция — край за перевалами, туда приходят своим ходом).
  // Когда появятся родные земли народов, старт будет у себя дома (поле start у народа).
  const towns = G.over.cities.filter(c => ['city', 'town'].includes(c.kind) && !c.siege && !c.razed && !FOREIGN_REGIONS.includes(c.region));   // путь начинается в Италии
  const city = (startId && G.over.cities.find(c => c.id === startId)) || rng.pick(towns);
  G.ox = city.x;
  G.oy = city.y;
  G.travelers = [];
  fillTravelers(true);
  log(`${player.name}, ${player.people.name.toLowerCase()}, прибывает в ${cityAcc(city.name)}. Лето Господне 1247-е.`, C.gold);
  chronicle(`${player.name}, ${player.people.name.toLowerCase()} родом из земли «${player.people.land}», прибывает в ${cityAcc(city.name)}. Начало пути.`, 'start');
  enterCity(city);
  log('Поговори с жителями (просто иди на них). M — карта Италии, ? — справка.', C.dim);
}

// ─── Переходы между картами ────────────────────────────────────────

function placePlayer(world, x, y) {
  const p = G.player;
  world.actors = world.actors.filter(a => a !== p);
  world.actors.unshift(p);
  p.x = x;
  p.y = y;
  G.world = world;
  G.mode = 'local';
  refreshFov();
}

// «деревня Поджо-Сан-Лоренцо», «Милан», «Аббатство Сан-Пьетро».
function placeTitle(place) {
  if (place.siege === 'vittoria') return place.razed ? 'пепелище Виттории' : 'Виттория, лагерь императора';
  if (place.kind === 'village') return `деревня ${place.name}`;
  if (place.famous && PLACE_KINDS[place.kind] && !place.name.includes(' ')) return `${PLACE_KINDS[place.kind].label} ${place.name}`;
  return place.name;
}

// Куда: «в Перуджу», «в деревню Борго-Нуово», «в Рокку Колонна».
function placeAcc(place) {
  if (place.kind === 'city' || place.kind === 'town') return cityAcc(place.name);
  if (place.kind === 'village') return `деревню ${place.name}`;
  return placeTitle(place).replace(/^Рокка /, 'Рокку ');
}

// Где встать, входя в поселение с карты Италии: на краю карты, с той стороны,
// откуда пришёл, — там, откуда ближе всего (по дороге) до площади.
function cityEdgeSpot(world, dir) {
  const v = world.villages[0], W = world.w, H = world.h;
  const start = findFreeIn(world, { x: v.cx - 4, y: v.cy - 2, w: 9, h: 5, building: -1 });
  if (!start) return null;
  const dist = new Int32Array(W * H).fill(-1), q = [world.idx(start[0], start[1])];
  dist[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of DIRS8) {
      const X = x + dx, Y = y + dy, j = Y * W + X;
      if (X >= 0 && Y >= 0 && X < W && Y < H && dist[j] < 0 && world.walkable(X, Y)) { dist[j] = dist[i] + 1; q.push(j); }
    }
  }
  const [dx, dy] = dir || [0, -1];
  // Пришёл с востока (шёл на запад, dx < 0) — входишь с восточного края, и т. д.
  const side = (x, y) => (dx > 0 && x <= 2) || (dx < 0 && x >= W - 3) || (dy > 0 && y <= 2) || (dy < 0 && y >= H - 3);
  const edge = (x, y) => x <= 2 || y <= 2 || x >= W - 3 || y >= H - 3;
  // Входят по дороге: сперва — тракт или мостовая у края, откуда пришёл; потом тропа; и лишь потом — где придётся.
  const ROADY = new Set([T.ROAD, T.COBBLE, T.BRIDGE]), road = (x, y) => ROADY.has(world.get(x, y));
  const dirt = (x, y) => world.get(x, y) === T.DIRT;
  // Если с этой стороны дороги нет (пришёл полем), выходишь на ближайшую к ней дорогу у другого края,
  // а не в траву: в поселение входят по дороге.
  const fromSide = (x, y) => dx > 0 ? x : dx < 0 ? W - 1 - x : dy > 0 ? y : H - 1 - y;
  // Приморский город, где дорога за воротами упирается в берег, — на неё, за стенами.
  const outside = (x, y) => x < v.x0 - 1 || y < v.y0 - 1 || x > v.x0 + v.w || y > v.y0 + v.h;
  /** @type {[Function, Function, boolean?][]} */
  const tries = [[side, road], [side, dirt], [edge, road, true], [edge, dirt, true], [outside, road, true], [side, () => true], [edge, () => true]];
  for (const [want, ground, near] of tries) {
    let best = null;
    for (let i = 0; i < W * H; i++) {
      const x = i % W, y = (i / W) | 0;
      if (dist[i] < 0 || !want(x, y) || !ground(x, y) || !world.free(x, y)) continue;
      const score = near ? fromSide(x, y) * 1000 + dist[i] : dist[i];
      if (!best || score < best[2]) best = [x, y, score];
    }
    if (best) return [best[0], best[1]];
  }
  return null;
}

function enterCity(city, fromMap = false) {
  let world = openStored(G.cityMaps, city.id);
  if (!world) {
    world = G.cityMaps[city.id] = buildPlace(`city:${city.id}`);
    chronicleVisit(city);
    populateVillages(world);
    rescueStranded(world);
  }
  // В городах и сёлах зверья нет: ни зайцев на улицах, ни волков у ворот.
  world.actors = world.actors.filter(a => a.kind !== 'beast' || a.razeOf || a.hap);
  crusadeVisitors(world, city);
  vittoriaVisit(world, city);
  cultEnter(world, city);
  fairEnter(world, city);
  happeningsEnter(world, city);
  alchemistEnter(world, city);
  hermeticEnter(world, city);
  monasteryEnter(world, city);
  fibEnter(world, city);
  world.streetsEmpty = undefined;   // заново решить, кто на улице в этот час
  for (const v of world.villages) for (const n of v.npcs) {
    if (n.role === 'priest' && n.color === C.white) n.color = ROLES.priest.color;   // старые сохранения: священник был белым, как герой
    if (n.homeAtNight && !world.actors.includes(n)) { n.homeAtNight = false; world.actors.push(n); }
    if (n.sleeping) { n.sleeping = false; if (n.dayAt && world.free(n.dayAt[0], n.dayAt[1])) [n.x, n.y] = n.dayAt; n.dayAt = null; }
  }
  townNight(world);
  veronaEnter(world, city);
  louisEnter(world, city);
  const inq = inquisitionEnter(world, city);
  const v = world.villages[0];
  const spot = (fromMap && cityEdgeSpot(world, G.lastDir)) || findFreeIn(world, { x: v.cx - 4, y: v.cy - 2, w: 9, h: 5, building: -1 }) || entryPoint(world);
  placePlayer(world, spot[0], spot[1]);
  crusadeEnter(world, city);
  if (fromMap) escortArrive(city);
  const R = REGIONS[city.region];
  const title = placeTitle(city);
  log(`${title.charAt(0).toUpperCase() + title.slice(1)}. ${R.name} — ${R.realm}.`, C.gold);
  louisGenoa(city);
  if (inq) { log('У ворот тебя уже ждут: монах в чёрном плаще и двое стражников.', C.red); pushScreen(new DialogScreen(inq)); }
  else { const vm = veronaMessenger(city); if (vm) { log('У ворот тебя догоняет всадник в пыли — гонец.', C.gold); pushScreen(new DialogScreen(vm)); } }
  autosave();
}

function enterSite(site) {
  if (site.dungeon) return enterDungeon(site);
  if (site.prison) return veronaPrisonApproach(site);
  const world = makeSiteLocal(G.over, site);
  G.world = world;
  const [x, y] = entryPoint(world, 1, 0);
  placePlayer(world, x, y);
  log(site.desc, C.violet);
  if (site.id === 'gerundo' && !G.flags.tarantasio_dead) {
    const spots = [];
    for (let yy = 0; yy < world.h; yy++)
      for (let xx = 0; xx < world.w; xx++)
        if (world.get(xx, yy) === T.MARSH && Math.abs(xx - (world.w >> 1)) < 12 && beastCanEnter(world, xx, yy)) spots.push([xx, yy]);
    if (spots.length) {
      const [dx, dy] = rng.pick(spots);
      world.actors.push(makeBeast('tarantasio', dx, dy));
      log('Над водой поднимается зловонный туман. Что-то огромное шевелится в тростниках.', C.red);
    }
  }
  // У храмов Джгантии иногда бродит великан — не чаще раза в месяц.
  if (site.id === 'ggantija' && timeInfo().day - (G.flags.giantDay || -99) >= 30 && rng.chance(0.4)) {
    for (let t = 0; t < 200; t++) {
      const gx = (world.w >> 1) + rng.int(-20, 20), gy = (world.h >> 1) + rng.int(-8, 8);
      if (beastCanEnter(world, gx, gy) && Math.hypot(gx - x, gy - y) > 14) {
        world.actors.push(makeBeast('giant', gx, gy));
        G.flags.giantDay = timeInfo().day;
        log('Между каменными кругами что-то движется — что-то ростом с сами камни.', C.red);
        break;
      }
    }
  }
  if (site.id === 'walnut') {
    if (isNight()) summonCoven();
    else log('Днём старый орех молчит. Говорят, ведьмы слетаются сюда в полночь.', C.dim);
  }
  spawnBeasts(6, isNight(), false, 10);
}

function summonCoven() {
  const w = G.world, cx = w.w >> 1, cy = w.h >> 1;
  let n = 0;
  for (let t = 0; t < 200 && n < 4; t++) {
    const x = cx + rng.int(-7, 7), y = cy + rng.int(-4, 4);
    if (beastCanEnter(w, x, y)) { w.actors.push(makeBeast('strega', x, y)); n++; }
  }
  if (n) log('Вокруг ореха кружат тёмные фигуры. Шабаш начался.', C.violet);
}

// Кто водится на этой клетке Италии: местность карты → места обитания зверей.
const OT_HABITATS = {
  [OT.PLAIN]: ['field'], [OT.FIELD]: ['field'], [OT.FOREST]: ['forest'], [OT.PINE]: ['pine', 'forest'],
  [OT.HILL]: ['hill'], [OT.MOUNT]: ['hill'], [OT.VOLCANO]: ['hill'], [OT.MARSH]: ['marsh'], [OT.RIVER]: ['field', 'marsh'],
};

// Выбрать, кто выйдет навстречу: только хищники этой местности (или никто).
function chooseEncounter(x, y, night) {
  const ow = G.over, habs = (OT_HABITATS[ow.get(x, y)] || ['field']).slice();
  if (ow.road[ow.idx(x, y)] >= 0) habs.push('road');
  const opts = [];
  for (const hab of habs)
    for (const o of beastChoices(ow.regionAt(x, y), hab, night, false))
      if (BEASTS[o.key].behavior === 'hostile' && !opts.some(q => q.key === o.key)) opts.push(o);
  return opts.length ? rng.weighted(opts).key : null;
}

function enterWild(encounter) {
  const ctx = localContext(G.over, G.ox, G.oy);
  // Дикая местность каждый раз новая: зерно зависит и от времени.
  ctx.seed ^= G.minutes * 2654435761;
  const world = makeWildLocal(ctx);
  G.world = world;
  const cx = world.w >> 1, cy = world.h >> 1;
  const [x, y] = entryPoint(world);
  placePlayer(world, x, y);
  const night = isNight();
  spawnBeasts(night ? 12 : 10, night, false, 12);
  placeHerbs(world);
  if (!encounter) alchemistWild(world);
  if (encounter) {
    const group = spawnEncounter(world, cx, cy, encounter);
    if (group.length) {
      const m = group[0];
      log(`На тебя выходит: ${m.name}${group.length > 1 ? ' ×' + group.length : ''}!`, C.red);
      for (const g of group) g.target = [x, y];
    }
  }
  refreshFov();
}

// Поставить на местную карту выбранных заранее хищников.
function spawnEncounter(world, cx, cy, key) {
  for (let t = 0; t < 200; t++) {
    const ang = rng.next() * Math.PI * 2, r = rng.int(3, 6);
    const x = Math.round(cx + Math.cos(ang) * r * 1.6), y = Math.round(cy + Math.sin(ang) * r);
    if (!beastCanEnter(world, x, y)) continue;
    const group = placeGroup(key, x, y);
    for (const g of group) g.provoked = true;
    return group;
  }
  return [];
}

// Бросок на встречу в пути. Возвращает true, если игрок попал в бой.
// У самых стен и околиц на путника не нападают — зверь боится людей и собак.
// Тёмная подложка под важным на карте: места, подписи, путники — поверх цветной местности.
const PLATE = '#0b0907';

function nearSettlement(x, y) {
  return G.over.cities.some(c => Math.abs(c.x - x) <= (c.kind === 'city' ? 4 : 2) && Math.abs(c.y - y) <= (c.kind === 'city' ? 3 : 2));
}

function rollEncounter(chance, canAvoid) {
  const p = G.player;
  if (G.encCooldown > 0 || nearSettlement(G.ox, G.oy) || !rng.chance(chance)) return false;
  if (G.wardUntil > G.minutes) return false;
  const key = chooseEncounter(G.ox, G.oy, isNight());
  if (!key) return false;
  // Звери чтят того, кто под покровом святого Франциска.
  if (p.patron === 'francis' && !BEASTS[key].unholy && rng.chance(0.5)) return false;
  G.encCooldown = 6 * MAP_SCALE;
  const d = BEASTS[key];
  // Внимательный путник замечает зверя издалека и обходит.
  if (canAvoid && rng.chance(0.15 + p.stats.wis * 0.025 + p.stats.dex * 0.025 - (isNight() ? 0.1 : 0))) {
    log(`Ты замечаешь вдалеке: ${lower(d.name)}. Ты сворачиваешь с пути и обходишь стороной.`, C.dim);
    passTime(30);
    return false;
  }
  enterWild(key);
  return true;
}

function sailTo(id, days) {
  const city = G.over.cities.find(c => c.id === id);
  leaveLocal();
  log(`Ты поднимаешься на борт. Курс — ${city.name}.`, C.sky);
  faithDeed('sail');
  passTime(Math.round(days * 720) * MINUTES_PER_TURN);
  G.ox = city.x;
  G.oy = city.y;
  enterCity(city);
}

function leaveLocal() {
  const p = G.player, w = G.world;
  escortFightEnd(w);
  w.actors = w.actors.filter(a => a !== p);
  G.mode = 'over';
  G.world = null;
  const c = w.city;
  if (w.kind === 'dungeon') log('Ты выбираешься на поверхность и жадно глотаешь свежий воздух.', C.dim);
  else if (!c) log('Ты возвращаешься на путь.', C.dim);
  else if (c.kind === 'city' || c.kind === 'town') log(`Ты покидаешь ${cityAcc(c.name)}.`, C.dim);
  else if (c.kind === 'village') log(`Ты покидаешь деревню ${c.name}.`, C.dim);
  else log(`Ты уходишь. Позади остаётся ${placeTitle(c)}.`, C.dim);
  autosave();
}

function refreshFov() {
  if (G.mode !== 'local') return;
  const p = G.player, w = G.world;
  w.computeFov(p.x, p.y, sightRadius());
  for (const b of w.buildings) {
    if (!b.landmark || b.seen) continue;
    const pts = [[b.x, b.y], [b.x + b.w - 1, b.y], [b.x, b.y + b.h - 1], [b.x + b.w - 1, b.y + b.h - 1],
      [b.x + (b.w >> 1), b.y + (b.h >> 1)]];
    if (!pts.some(([x, y]) => w.isVisible(x, y))) continue;
    b.seen = true;
    log(`${b.name}. ${b.desc}`, C.sky);
  }
  for (const a of w.actors) {
    if (a.kind !== 'beast' || !w.isVisible(a.x, a.y) || p.seen[a.key]) continue;
    p.seen[a.key] = true;
    log(`Новая запись в бестиарии: ${a.name}. (X — открыть)`, C.violet);
  }
}

// ─── Ход на местной карте ──────────────────────────────────────────

function endTurn() {
  const p = G.player, w = G.world;
  G.turn++;
  G.minutes += MINUTES_PER_TURN;
  tickPlayer();

  for (const a of w.actors.slice()) {
    if (a === p || a.dead) continue;
    a.energy += a.kind === 'beast' ? a.def.speed : 100;
    while (a.energy >= 100 && !a.dead && p.hp > 0 && G.world === w) {
      a.energy -= 100;
      if (a.kind === 'beast') beastAct(a);
      else npcAct(a);
    }
    if (p.hp <= 0) break;
  }

  checkDayNight();
  townNight(w);
  travelersTick(MINUTES_PER_TURN);
  if (w.cult) cultTick();
  if (G.turn % 100 === 0) autosave();

  if (G.turn % 20 === 0 && w.kind !== 'dungeon' && w.kind !== 'city') {
    const beasts = w.actors.filter(a => a.kind === 'beast').length;
    const cap = w.kind === 'city' ? 6 : isNight() ? 16 : 13;
    if (beasts < cap) spawnBeasts(Math.min(2, cap - beasts), isNight());
  }

  refreshFov();
  checkDeath();
}

function checkDeath() {
  if (G.player.hp <= 0 && G.debug && G.debug.god) { G.player.hp = G.player.maxHp; return; }
  if (G.player.hp <= 0 && !(topScreen() instanceof DeathScreen)) pushScreen(new DeathScreen());
}

function visibleBeasts() {
  if (G.mode !== 'local') return [];
  const p = G.player, w = G.world;
  return w.actors
    .filter(a => a.kind === 'beast' && w.isVisible(a.x, a.y))
    .sort((a, b) => dist(a, p) - dist(b, p));
}

function dangerNear() {
  return visibleBeasts().find(m => beastMode(m) !== 'flee' && !m.fleeing && dist(m, G.player) <= 6);
}

// ─── Действия на местной карте ─────────────────────────────────────

// Последний «упор» в жителя: если следующий шаг в него же и время не шло — разговор.
let npcBump = null;

function talkTo(npc) { npcBump = null; pushScreen(new DialogScreen(npc)); }

function tryMove(dx, dy) {
  const p = G.player, w = G.world;
  if (p.confused && rng.chance(0.5)) {
    [dx, dy] = rng.pick(DIRS8);
    log('Ты пляшешь и шатаешься, не разбирая дороги.', C.violet);
  }
  const nx = p.x + dx, ny = p.y + dy;
  if (!w.inside(nx, ny)) {
    // От погони не уйти просто так: кто гонится и близко — тот настигает. Ловкий и выносливый отрывается чаще.
    const chasers = w.actors.filter(a => a.kind === 'beast' && !a.dead && (a.target || a.provoked) && beastMode(a) !== 'flee' && !a.fleeing && dist(a, p) <= 10);
    if (chasers.length) {
      const near = Math.min(...chasers.map(a => dist(a, p)));
      const chance = Math.max(0.05, 0.15 + p.stats.dex * 0.025 + skillLevel(p, 'athletics') * 0.03 + (near > 5 ? 0.25 : 0) - (chasers.length - 1) * 0.05);
      if (!rng.chance(chance)) {
        log(rng.pick(['Ты пытаешься оторваться, но тебя настигают!', 'Погоня не отстаёт — уйти не удаётся.', 'Ты бросаешься прочь, но тебе отрезают путь.']), C.red);
        endTurn();
        return;
      }
      log('Ты отрываешься от погони.', C.orange);
    }
    leaveLocal();
    return;
  }
  const a = w.actorAt(nx, ny);
  if (a && a.kind === 'beast') { playerAttack(a); endTurn(); return; }
  if (w.get(nx, ny) === T.SARCOPHAGUS) { openSarcophagus(nx, ny); endTurn(); return; }
  if (w.get(nx, ny) === T.URN) { openUrn(nx, ny); endTurn(); return; }
  if (w.get(nx, ny) === T.ORE) { mineOre(nx, ny); endTurn(); return; }
  if (w.get(nx, ny) === T.SHRINE) { venerateShrine(nx, ny); endTurn(); return; }
  if (w.get(nx, ny) === T.LOCKED) { tryLocked(nx, ny); cultNoise(); return; }
  if (w.get(nx, ny) === T.PAGAN_ALTAR && !a && bumpPaganAltar(nx, ny)) { endTurn(); return; }
  if (w.get(nx, ny) === T.INSCRIPTION) { readInscription(nx, ny); return; }
  if (w.get(nx, ny) === T.CAUTES || w.get(nx, ny) === T.CAUTOPATES) { bumpTorchbearer(nx, ny); endTurn(); return; }
  if (!a && tryDisarm(nx, ny)) return;
  if (w.get(nx, ny) === T.ALTAR && !w.actorAt(nx, ny)) { if (bumpCultAltar(nx, ny)) { endTurn(); return; } altarPray(); return; }
  if (w.containers && /^relic_/.test(w.containers.get(w.idx(nx, ny)) || '') && bumpRelic(nx, ny)) return;
  if (w.containers && w.containers.has(w.idx(nx, ny))) { openContainer(nx, ny); endTurn(); return; }
  // В жителя не влетаем: первый шаг — остановиться перед ним, второй — заговорить.
  if (a && a.kind === 'npc') {
    if (npcBump && npcBump.npc === a && npcBump.turn === G.turn) { npcBump = null; talkTo(a); return; }
    npcBump = { npc: a, turn: G.turn };
    if (a.sleeping) log(`${a.title} ${a.name} спит. Ещё шаг в ${a.female ? 'её' : 'его'} сторону — разбудить.`, C.dim);
    else log(`Перед тобой ${a.title.toLowerCase()} ${a.name}. Ещё шаг в его сторону — заговорить.`.replace('в его', a.female ? 'в её' : 'в его'), C.dim);
    return;
  }
  if (!a && SWIM_TILES.has(w.get(nx, ny)) && swimStep(nx, ny)) return;
  if (!w.walkable(nx, ny)) {
    log(`Не пройти: ${w.def(nx, ny).name.toLowerCase()}.`, C.dark);
    return;
  }
  moveTo(p, nx, ny);
  for (const it of w.takeItems(nx, ny)) {
    if (it.kind === 'coins') {
      p.coins += it.value;
      log(`Ты подбираешь ${it.value} мон.`, C.gold);
      continue;
    }
    if (it.kind === 'key') { pickKey(it); continue; }
    if (it.kind === 'ammo') {
      p.ammo[it.ammo] = (p.ammo[it.ammo] || 0) + it.n;
      log(`Ты подбираешь: ${AMMO[it.ammo].name.toLowerCase()} (+${it.n}).`, C.text);
      continue;
    }
    if (it.kind === 'herb') { pickHerb(p, it); continue; }
    if (it.kind === 'gear') {
      p.bag.push(it.item);
      log(`Ты подбираешь: ${it.item.name}. (I — снаряжение)`, C.gold);
      continue;
    }
    const tr = p.trophies[it.id] || (p.trophies[it.id] = { name: it.name, value: it.value, count: 0 });
    tr.count++;
    log(`Ты подбираешь: ${it.name}.`, C.text);
    questTrophyNote(it.id);
  }
  const b = w.buildingAt(nx, ny), wasB = w.buildingAt(nx - dx, ny - dy);
  if (b && b !== wasB) log(`${b.name}.`, C.dim);
  questWorkStep(nx, ny);
  if (trapAt(w, nx, ny)) springTrap(nx, ny);
  if (G.world === w && p.hp > 0) senseSecrets(false);
  const tile = w.get(nx, ny);
  if (tile === T.STAIRS_DOWN || tile === T.STAIRS_UP) { useStairs(tile); return; }
  if (G.world === w) endTurn();
}

function quaff() {
  const p = G.player;
  if (!p.potions) { log('Отваров не осталось.', C.dark); return; }
  p.potions--;
  const heal = 8 + rng.int(1, 6);
  p.hp = Math.min(p.maxHp, p.hp + heal);
  p.poison = 0;
  if (p.fever) { p.fever = 0; log('Горечь отвара сбивает лихорадку.', C.green); }
  log(`Ты пьёшь горький отвар: +${heal} здоровья.`, C.green);
  afterAction();
}

// Действие, которое занимает ход: на местной карте — ход, в пути — пару минут.
function afterAction() {
  if (G.mode === 'local') endTurn();
  else { passTime(MINUTES_PER_TURN); checkDeath(); }
}

function rest() {
  if (G.mode === 'over') return camp();
  const k = G.world.kind;
  if (k === 'city') {
    const p = G.player;
    if (p.fatigue >= 35 || isNight()) log('Спать на мостовой? Стража погонит палками. Сними угол у трактирщика.', C.dim);
  } else if (k !== 'dungeon') return sleepWild();
  else if (G.player.fatigue >= 35) return sleepDungeon();
  restLocal();
}

// Сон под землёй: в нише, спиной к стене. Обитатели подземелья бродят — могут найти спящего.
function sleepDungeon() {
  const p = G.player, w = G.world;
  if (dangerNear()) { log('Рядом опасность — какой тут сон.', C.red); return; }
  const ok = sleep('Ты забиваешься в нишу, спиной к холодному камню, и засыпаешь вполглаза.', () => {
    if (G.wardUntil > G.minutes) return false;
    const awake = w.actors.filter(a => a.kind === 'beast' && !a.dead && beastMode(a) !== 'flee');
    if (!awake.length || !rng.chance(0.08 * (1 - skillLevel(p, 'stealth') * 0.05))) return false;
    const m = awake.sort((a, b) => dist(a, p) - dist(b, p))[0];
    m.target = [p.x, p.y]; m.provoked = true;
    // Пришёл на запах — уже рядом.
    const spot = DIRS8.map(([dx, dy]) => [p.x + dx * 2, p.y + dy * 2]).find(([x, y]) => w.free(x, y));
    if (spot) moveTo(m, spot[0], spot[1]);
    log(`Тебя будит шорох в темноте. Рядом — ${lower(m.name)}!`, C.red);
    return true;
  }, 0.7);
  if (ok) log('Сон под землёй неглубок, но силы вернулись.', C.dim);
  refreshFov();
}

// Передохнуть сидя: здоровье и благодать, но не сон.
function restLocal() {
  const p = G.player;
  if (dangerNear()) { log('Рядом опасность — не до отдыха.', C.red); return; }
  if (p.hp >= p.maxHp && p.grace >= p.maxGrace && !p.poison) {
    log(p.fatigue >= 35 ? 'Раны не болят, но усталость сидя не уходит — нужен сон.' : 'Ты не ранен и не устал — отдыхать незачем.', C.dim);
    return;
  }
  log('Ты присаживаешься передохнуть...', C.dim);
  for (let i = 0; i < 400; i++) {
    const hp = p.hp;
    endTurn();
    if (p.hp <= 0) return;
    const m = dangerNear();
    if (m) { log(`Ты замечаешь: ${lower(m.name)}!`, C.red); return; }
    if (p.hp < hp && !p.poison) return;
    if (p.hp >= p.maxHp && p.grace >= p.maxGrace && !p.poison) { log('Ты отдохнул.', C.dim); return; }
  }
}

// ─── Путешествие по Италии ─────────────────────────────────────────

function overMove(dx, dy) {
  const ow = G.over, p = G.player, nx = G.ox + dx, ny = G.oy + dy;
  if (!ow.passable(nx, ny)) {
    log(`Не пройти: ${ow.def(nx, ny).name.toLowerCase()}.`, C.dark);
    return;
  }
  if (winterBlocked(ow, nx, ny)) {
    log('Перевал засыпан снегом. Зимой через Альпы — только по дорогам.', C.sky);
    return;
  }
  const oldRegion = ow.regionAt(G.ox, G.oy);
  G.lastDir = [dx, dy];
  G.ox = nx;
  G.oy = ny;
  G.turn++;
  const onRoad = ow.road[ow.idx(nx, ny)] >= 0;
  let boots = (p.equip.feet && p.equip.feet.travel || 1) * (p.patron === 'christopher' ? 0.9 : 1) * mountSpeed(p, ow, nx, ny)
    * seasonTravelMult(ow, nx, ny) * weatherTravelMult(ow.road[ow.idx(nx, ny)] >= 0);
  // Перегруженный путник тащится вдвое дольше.
  if (carryLoad(p) > p.capacity) {
    boots *= 1.6;
    if (G.turn % 10 === 0) log('Поклажа тянет к земле: ты еле плетёшься. Нужен мул — или продай лишнее.', C.orange);
  }
  if (fatigueState(p) === 2) boots *= 1.2;   // еле переставляешь ноги
  G.travelLoad = G.travelLoadLast = travelFatigue(p, ow, nx, ny);
  passTime(Math.round(ow.cost(nx, ny) * boots / 2) * 2);
  G.travelLoad = 1;
  if (G.mode !== 'over') return;   // в пути напали разбойники
  faithDeed('travel');
  if (!p.mount) trainSkill(p, 'athletics', 0.12 * G.travelLoadLast);   // ноги крепнут медленно: месяцы, а не дни
  else trainSkill(p, 'riding', 0.15);
  if (!onRoad) trainSkill(p, 'survival', 0.15);
  feverRisk(ow, nx, ny);
  if (p.hp <= 0) return checkDeath();

  const region = ow.regionAt(nx, ny);
  if (region !== oldRegion) log(`Ты вступаешь в земли: ${REGIONS[region].name} (${REGIONS[region].realm}).`, C.gold);
  spotTombs(nx, ny, false);
  spotLeads(nx, ny, false);
  escortStep();
  if (G.mode !== 'over') return;
  if (meetTravelers()) return;
  const lead = activeLeadAt(nx, ny);
  if (lead) {
    log(lead.done ? `${lead.name}: здесь уже всё кончено.` : `Здесь, по слухам: ${lead.name.toLowerCase()}. Enter — подойти ближе.`, lead.done ? C.dim : C.gold);
    return;
  }
  const place = ow.placeAt(nx, ny);
  if (place) {
    log(`Перед тобой ${placeTitle(place)}. Enter — ${place.type === 'city' ? 'войти' : 'подойти ближе'}${travelersNear(true).length ? ' или заговорить с путниками' : ''}.`, C.gold);
    return;
  }
  if (!onRoad && ow.get(nx, ny) === OT.RIVER) { log('Ты переходишь реку вброд.', C.dim); fordRisk(p); if (p.hp <= 0) return checkDeath(); }
  G.encCooldown = Math.max(0, (G.encCooldown || 0) - 1);
  const enc = (ow.def(nx, ny).enc || 0.05 / MAP_SCALE) * (onRoad ? 0.4 : 1) * (isNight() ? 1.3 : 1) * (1 - skillLevel(p, 'stealth') * 0.04);
  rollEncounter(enc, true);
}

function overEnter() {
  const lead = activeLeadAt(G.ox, G.oy), place = G.over.placeAt(G.ox, G.oy), ts = travelersNear();
  // Несколько дел на одной клетке (город и путники у ворот, двое путников) — выбор за игроком.
  if (ts.length && (lead || place || ts.length > 1)) {
    const opts = [];
    if (lead) opts.push({ label: `Подойти: ${lead.name.toLowerCase()}`, act: () => { enterLead(lead); refreshFov(); } });
    else if (place) opts.push({ label: `${place.type === 'city' ? 'Войти' : 'Подойти'}: ${placeTitle(place)}`, act: () => overEnterPlace(place) });
    for (const t of ts) {
      const def = TRAVELER_KINDS[t.kind];
      opts.push({ label: `Заговорить: ${def.name.toLowerCase()}`, act: () => talkToTraveler(t) });
    }
    pushScreen(new ChoiceScreen('Что делать?', opts));
    return;
  }
  if (lead) { enterLead(lead); refreshFov(); return; }
  if (!place && talkToTravelers()) return;
  if (!place) {
    // Осмотреться — значит и поискать: рядом может быть забытая гробница.
    const t = spotTombs(G.ox, G.oy, true), l = spotLeads(G.ox, G.oy, true);
    if ((t && t.x === G.ox && t.y === G.oy) || (l && l.x === G.ox && l.y === G.oy)) return;
    log('Ты сходишь с дороги и осматриваешь окрестности.', C.dim);
    enterWild(false);
    return;
  }
  overEnterPlace(place);
}

function overEnterPlace(place) {
  if (place.type === 'city') { if (!parmaGate(place)) enterCity(place, true); }
  else enterSite(place);
}

// Лагерь в пути: отдых до утра или до полного восстановления.
// Ночь в глуши: костёр видно издалека. Опаснее в лесу, в горах и на болоте, вдали от жилья;
// у дороги и под стенами — спокойнее. Бывалый путник выбирает место лучше.
const CAMP_RISK = { [OT.PLAIN]: 0.012, [OT.FIELD]: 0.01, [OT.FOREST]: 0.035, [OT.PINE]: 0.035, [OT.HILL]: 0.028,
  [OT.MOUNT]: 0.03, [OT.MARSH]: 0.04, [OT.RIVER]: 0.02 };
function campRisk() {
  const p = G.player, ow = G.over, night = isNight();
  if (G.wardUntil > G.minutes) return false;   // под печатью или под защитой святого
  const surv = skillLevel(p, 'survival'), near = nearSettlement(G.ox, G.oy);
  // Шайка поблизости замечает огонь.
  const band = (G.travelers || []).find(t => t.kind === 'brigands' && Math.max(Math.abs(t.x - G.ox), Math.abs(t.y - G.oy)) <= 6);
  if (band && night && !near && rng.chance(0.18 * (1 - skillLevel(p, 'stealth') * 0.05))) {
    log('Сквозь сон — шаги и шёпот. Кто-то пришёл на свет твоего костра.', C.red);
    brigandsAttackHero(band);
    return true;
  }
  let k = CAMP_RISK[ow.get(G.ox, G.oy)] ?? 0.02;
  if (ow.road[ow.idx(G.ox, G.oy)] >= 0) k *= 0.6;
  if (near) k *= 0.25;
  if (!night) k *= 0.3;
  k *= Math.max(0.4, 1 - surv * 0.06);
  if (!rng.chance(k)) return false;
  // Вор — тихо, без драки; зверь или нечисть — будят.
  if (rng.chance(0.3)) return campThief();
  const key = chooseEncounter(G.ox, G.oy, night);
  if (!key || (p.patron === 'francis' && !BEASTS[key].unholy && rng.chance(0.5))) return false;
  log('Тебя будит треск веток и тяжёлое дыхание у самого костра. На лагерь напали!', C.red);
  G.encCooldown = 6 * MAP_SCALE;
  enterWild(key);
  return true;
}

// Ночной вор: чуткий спит вполглаза.
function campThief() {
  const p = G.player;
  if (rng.chance(0.3 + p.stats.wis * 0.03 + skillLevel(p, 'survival') * 0.04)) {
    log('Ты просыпаешься от шороха — тень метнулась прочь от костра. Котомка цела. До утра спишь вполглаза.', C.orange);
    return true;
  }
  if (p.coins >= 6 && rng.chance(0.6)) {
    const n = Math.max(3, Math.round(p.coins * rng.int(10, 25) / 100));
    p.coins -= n;
    log(`Утром кошель легче на ${coins(n)}. Кто-то побывал у костра, пока ты спал, — и даже не разбудил.`, C.red);
  } else if (p.rations > 0) {
    const n = Math.min(p.rations, rng.int(1, 2));
    p.rations -= n;
    log(`Утром котомка развязана: пропал провиант (−${n}). Следы босых ног ведут к кустам.`, C.red);
  }
  return false;
}

function camp() {
  const p = G.player, ow = G.over;
  if (p.fatigue < 35 && !isNight() && p.hp >= p.maxHp) { log('Ты не устал, а до ночи далеко. Лучше пройти ещё немного.', C.dim); return; }
  campWeatherHurt();
  const road = ow.road[ow.idx(G.ox, G.oy)] >= 0;
  const ok = sleep(road ? 'Ты разбиваешь лагерь у дороги, разводишь костёр и засыпаешь.' : 'Ты разбиваешь лагерь в стороне от дорог, разводишь костёр и засыпаешь.', campRisk, 0.9);
  if (p.hp <= 0) return checkDeath();
  if (!ok) return;
  forage(p);
  mountCampRisk();
  log('Ты сворачиваешь лагерь.', C.dim);
}

// ─── Основной экран игры ───────────────────────────────────────────

class PlayScreen {
  constructor() { this.overlay = false; }

  key(k) {
    const dir = KEY_DIRS[k.code];
    const local = G.mode === 'local';
    if (dir) return local ? tryMove(dir[0], dir[1]) : overMove(dir[0], dir[1]);
    switch (k.code) {
      case 'Space': case 'Period': case 'Numpad5': case 'NumpadDecimal':
        if (local) { senseSecrets(true); endTurn(); } else { passTime(60); checkDeath(); }
        break;
      case 'Enter': case 'NumpadEnter': case 'KeyE':
        if (!local) overEnter();
        else if (G.world.kind === 'dungeon') log('Наверх ведёт только лестница (<).', C.dim);
        else if (dangerNear()) log('Рядом опасность! Уйти можно, только добравшись до края карты.', C.red);
        else leaveLocal();
        break;
      case 'KeyP': pushScreen(new PrayerScreen()); break;
      case 'KeyF': fire(); break;
      case 'KeyT': eat(); break;
      case 'KeyS': saveGame().then(ok => { if (ok) { log('Игра сохранена.', C.gold); render(); } }); break;
      case 'KeyQ': quaff(); break;
      case 'KeyR': rest(); break;
      case 'KeyC': pushScreen(new CharacterScreen()); break;
      case 'KeyI': pushScreen(new InventoryScreen()); break;
      case 'KeyX': pushScreen(new BestiaryScreen()); break;
      case 'KeyA': pushScreen(new AlchemyScreen()); break;
      case 'KeyZ': pushScreen(new HermeticScreen()); break;
      case 'KeyV': if (aimOn()) cycleAim(); break;
      case 'KeyG': toggleTiles(); break;
      case 'KeyM': pushScreen(new MapScreen()); break;
      case 'Semicolon': case 'KeyO': pushScreen(new JournalScreen()); break;
      case 'Backquote': case 'F9': pushScreen(new DebugScreen()); break;
      case 'F1': case 'Slash': pushScreen(new HelpScreen()); break;
    }
  }

  render(t) {
    if (G.mode === 'local') this.renderMap(t);
    else this.renderOver(t);
    // В браузере панель и журнал — HTML (js/hud.js); на холсте — только без него.
    if (!HUD.stage) { this.renderPanel(t); this.renderLog(t); }
  }

  camera(w, h, px, py) {
    return [
      Math.max(0, Math.min(w - MAP_W, px - (MAP_W >> 1))),
      Math.max(0, Math.min(h - MAP_H, py - (MAP_H >> 1))),
    ];
  }

  // Подписи на карте Италии: важные первыми, без наложений; если справа
  // занято — слева, сверху или снизу; не закрывают значки, героя и «!».
  drawLabels(t, labels, cx, cy) {
    const ow = G.over, blocked = new Set([`${G.ox - cx},${G.oy - cy}`]);
    for (const pl of [...ow.cities, ...ow.sites.filter(s => !s.hidden)]) {
      if (pl.kind === 'city' && pl.tiles) for (const [tx, ty] of pl.tiles) blocked.add(`${tx - cx},${ty - cy}`);
      else blocked.add(`${pl.x - cx},${pl.y - cy}`);
    }
    for (const l of G.leads || []) if (l.known) blocked.add(`${l.x - cx},${l.y - cy}`);
    const taken = [];
    const fits = (x, y, len) => x >= 0 && y >= 0 && y < MAP_H && x + len <= MAP_W
      && !taken.some(([tx, ty, tl]) => ty === y && x <= tx + tl && tx <= x + len)
      && ![...Array(len).keys()].some(i => blocked.has(`${x + i},${y}`));
    labels.sort((a, b) => a.rank - b.rank || a.near - b.near);
    for (const { pl, sx, sy } of labels) {
      // У постоялого двора — только имя: «Колесо».
      const q = pl.kind === 'inn' && pl.name.match(/«.*»/);
      const name = q ? q[0] : pl.name, len = name.length, off = pl.kind === 'city' ? 3 : 2;
      const spots = [[sx + off, sy], [sx - len - off + 1, sy], [sx - (len >> 1), sy - (pl.kind === 'city' ? 2 : 1)], [sx - (len >> 1), sy + (pl.kind === 'city' ? 2 : 1)]];
      const spot = spots.find(([x, y]) => fits(x, y, len));
      if (!spot) continue;
      taken.push([spot[0], spot[1], len]);
      t.print(spot[0], spot[1], name, pl.kind === 'city' ? C.gold : mix(C.gold, C.bg, 0.2), PLATE);
    }
  }

  renderOver(t) {
    const ow = G.over, [cx, cy] = this.camera(ow.w, ow.h, G.ox, G.oy);
    const dk = darkness() * 0.35, winter = seasonOf() === 'winter';
    const tint = c => dk ? mix(c, C.night, dk) : c;
    for (let sy = 0; sy < MAP_H; sy++)
      for (let sx = 0; sx < MAP_W; sx++) {
        const x = cx + sx, y = cy + sy, i = ow.idx(x, y);
        const td = OTILES[ow.tiles[i]];
        let ch = td.ch[Math.floor(hash2(x, y) * td.ch.length)];
        let fg = td.fg[Math.floor(hash2(y, x) * td.fg.length)], bg = td.bg || null;
        if (ow.road[i] >= 0) {
          if (ow.tiles[i] === OT.RIVER) { ch = '='; fg = '#c09060'; bg = '#2a1c10'; }
          else { ch = '·'; fg = '#e0b878'; bg = bg ? mix(bg, '#2e2214', 0.6) : '#2a2014'; }
        } else if (ow.track && ow.track[i]) {
          // Проселок — тоньше и темнее тракта.
          if (ow.tiles[i] === OT.RIVER) { ch = '='; fg = '#8a6a48'; }
          else { ch = '·'; fg = '#a08458'; }
        }
        if (winter && ow.tiles[i] !== OT.SEA && ow.tiles[i] !== OT.LAKE && ow.road[i] < 0 && snowyHere(x, y, true)) { fg = mix(fg, '#eef2f6', 0.55); if (bg) bg = mix(bg, '#3a3e44', 0.5); }
        t.put(sx, sy, ch, tint(fg), bg && tint(bg));
        t.mark(sx, sy, 1);
        // Мост через реку — вдоль дороги: дорога идёт с севера на юг — и настил вертикальный.
        if (ow.track && ow.track[i] && ow.road[i] < 0) {
          const pathAt = (dx, dy) => ow.inside(x + dx, y + dy) && (ow.road[ow.idx(x + dx, y + dy)] >= 0 || ow.track[ow.idx(x + dx, y + dy)] || ow.placeAt(x + dx, y + dy));
          // Диагональные шаги проселка рисуем через угол: тропка выходит в обе соседние стороны.
          let m = (pathAt(0, -1) ? 1 : 0) | (pathAt(1, 0) ? 2 : 0) | (pathAt(0, 1) ? 4 : 0) | (pathAt(-1, 0) ? 8 : 0);
          for (const [dx, dy] of [[1, -1], [1, 1], [-1, 1], [-1, -1]]) if (pathAt(dx, dy) && !pathAt(dx, 0) && !pathAt(0, dy)) m |= (dy < 0 ? 1 : 4) | (dx > 0 ? 2 : 8);
          t.sprite(sx, sy, ow.tiles[i] === OT.RIVER ? 'bridge' : 'track' + m);
        }
        if (ow.road[i] >= 0 && ow.tiles[i] === OT.RIVER) {
          const rd = (dx, dy) => ow.inside(x + dx, y + dy) && ow.road[ow.idx(x + dx, y + dy)] >= 0;
          if ((rd(0, -1) || rd(0, 1)) && !(rd(-1, 0) || rd(1, 0))) t.sprite(sx, sy, 'bridgev');
        }
      }
    drawWeather(t, null, 0, 0);
    const labels = [];
    for (const pl of [...ow.cities, ...ow.sites.filter(s => !s.hidden)]) {
      const sx = pl.x - cx, sy = pl.y - cy;
      if (sx < 0 || sy < 0 || sx >= MAP_W || sy >= MAP_H) continue;
      if (pl.type === 'city' && pl.kind === 'city') {
        // Большой город — черепица и стены на несколько клеток.
        for (const [tx, ty] of pl.tiles)
          if (tx - cx < MAP_W) t.put(tx - cx, ty - cy, tx === pl.x && ty === pl.y ? '■' : '▓', tx === pl.x && ty === pl.y ? C.gold : '#c0603c', '#2a1810');
      } else if (pl.kind === 'town') { t.put(sx, sy, '□', C.gold, PLATE); t.mark(sx, sy, 3); }
      else if (pl.razed) t.put(sx, sy, '×', '#7a7068', PLATE);
      else if (PLACE_KINDS[pl.kind]) { t.put(sx, sy, PLACE_KINDS[pl.kind].glyph, PLACE_KINDS[pl.kind].color, PLATE); t.mark(sx, sy, 3); }
      else t.put(sx, sy, pl.glyph, pl.color, PLATE);
      // Подписи — только у ближних мест (города видно дальше); остальное — наведением мыши.
      const near = Math.max(Math.abs(pl.x - G.ox), Math.abs(pl.y - G.oy));
      if (pl.type === 'city' && near <= (pl.kind === 'city' ? 12 : pl.kind === 'town' ? 8 : 4))
        labels.push({ pl, sx, sy, near, rank: pl.kind === 'city' ? 0 : pl.kind === 'town' ? 1 : 2 });
    }
    labels.sort((a, b) => a.near - b.near);
    this.drawLabels(t, labels.slice(0, 3), cx, cy);
    for (const l of G.leads || []) {
      if (!l.known || l.until < timeInfo().day) continue;
      const sx = l.x - cx, sy = l.y - cy;
      if (sx >= 0 && sy >= 0 && sx < MAP_W && sy < MAP_H) t.put(sx, sy, '!', l.done ? C.dim : '#ff6040', '#2a0c04');
    }
    drawTravelers(t, cx, cy);
    t.put(G.ox - cx, G.oy - cy, '@', C.white, '#3a2a10');
    t.mark(G.ox - cx, G.oy - cy, 2);
  }

  renderMap(t) {
    const w = G.world, p = G.player, [cx, cy] = this.camera(w.w, w.h, p.x, p.y);
    const dk = w.kind === 'dungeon' ? 0 : darkness() * 0.4;
    const snow = w.kind !== 'dungeon' && snowyHere();
    for (let sy = 0; sy < MAP_H; sy++) {
      for (let sx = 0; sx < MAP_W; sx++) {
        const x = cx + sx, y = cy + sy, i = w.idx(x, y);
        if (!w.explored[i]) continue;
        const td = TILES[w.tiles[i]];
        const ch = td.ch[Math.floor(hash2(x, y) * td.ch.length)];
        if (w.visible[i]) {
          let fg = td.fg[Math.floor(hash2(y, x) * td.fg.length)];
          if (snow && SNOW_TILES.has(w.tiles[i])) fg = mix(fg, '#eef2f6', 0.6);
          if (dk) fg = mix(fg, C.night, dk);
          t.put(sx, sy, ch, fg, td.bg ? (dk ? mix(td.bg, C.night, dk) : td.bg) : null);
          t.mark(sx, sy, 1);
          { const sp = w.tiles[i] === T.BRIDGE ? bridgeSprite(w, x, y) : tileSprite(w.tiles[i]); if (sp) t.sprite(sx, sy, sp); }
        } else {
          t.put(sx, sy, ch, mix(td.fg[0], C.bg, 0.5), td.bg ? mix(td.bg, C.bg, 0.45) : null);
          t.mark(sx, sy, 1);
          { const sp = w.tiles[i] === T.BRIDGE ? bridgeSprite(w, x, y) : tileSprite(w.tiles[i]); if (sp) t.sprite(sx, sy, sp); }
        }
      }
    }
    for (const [k, list] of w.items) {
      const [x, y] = k.split(',').map(Number);
      if (!w.isVisible(x, y) || !list.length) continue;
      const coins = list.every(it => it.kind === 'coins'), gear = list.some(it => it.kind === 'gear' || it.kind === 'ammo');
      const key = list.some(it => it.kind === 'key'), herb = list.length === 1 && list[0].kind === 'herb' && HERBS[list[0].herb];
      if (herb) { t.put(x - cx, y - cy, 'ψ', herb.color); t.mark(x - cx, y - cy, 3); continue; }
      t.put(x - cx, y - cy, key ? '⚷' : gear ? ')' : coins ? '$' : '%', key ? C.gold : gear ? '#d0d0e0' : coins ? C.gold : '#c07050');
      t.mark(x - cx, y - cy, 3);
    }
    // Замеченные ловушки.
    if (w.traps) for (const [i, tr] of w.traps) {
      if (!tr.found || !w.explored[i]) continue;
      const x = i % w.w, y = (i / w.w) | 0;
      if (x - cx >= 0 && x - cx < MAP_W && y - cy >= 0 && y - cy < MAP_H) t.put(x - cx, y - cy, '^', TRAPS[tr.kind].color, '#2a1010');
    }
    drawWeather(t, w, cx, cy);
    for (const a of w.actors) {
      if (a === p || !w.isVisible(a.x, a.y)) continue;
      const sx = a.x - cx, sy = a.y - cy;
      if (sx >= 0 && sy >= 0 && sx < MAP_W && sy < MAP_H) { t.put(sx, sy, a.glyph, a.color); t.mark(sx, sy, 2); }
    }
    t.put(p.x - cx, p.y - cy, '@', p.poison ? C.green : p.confused ? C.violet : C.white);
    t.mark(p.x - cx, p.y - cy, 2);
  }

  renderPanel(t) {
    const p = G.player, x = PANEL_X + 1;
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
    t.printRich(x, y++, `{dim}Ловк.{} ${String(p.stats.dex).padEnd(3)} {dim}Мудрость{}  ${p.stats.wis}`);
    t.printRich(x, y++, `{dim}Вера{}  ${String(p.stats.fai).padEnd(3)} {dim}Благочест.{} ${p.piety}`);
    y++;
    const wp = p.weaponDef;
    t.printRich(x, y++, `{dim}Оружие{} ${wp.name.slice(0, 15)} ${(wp.ranged ? wp.ranged.rdmg : wp.dmg).join('–')}`);
    t.printRich(x, y++, `{dim}Защита{} ${p.armor}  {dim}Уклонение{} ${p.ev}`);
    t.printRich(x, y++, `{dim}Монеты{} {gold}${p.coins}{}  {dim}Отвары{} ${p.potions}`);
    const rm = rangedMode(p);
    if (rm) t.printRich(x, y++, `{dim}${rm.launcher ? 'Стрельба' : 'Метать'}{} ${AMMO[rm.ammo].name.toLowerCase()} ${AMMO[rm.ammo].infinite ? '∞' : p.ammo[rm.ammo]}${rm.launcher && rm.launcher.ranged.reload && !p.loaded ? ' {orange}(не взведён)' : ''}`);
    if (p.mount) t.printRich(x, y++, `{dim}${p.mount.kind === 'mule' ? 'Мул в поводу' : 'Верхом'}{}${p.mount.hungry ? ' {orange}голодна' : ''}`);
    y++;
    const ti = timeInfo(), night = isNight();
    const clock = `${String(ti.hour).padStart(2, '0')}:${String(ti.min).padStart(2, '0')}`;
    const dt = today(), wd = weatherNow(), feast = feastsOn(dt)[0];
    t.print(x, y++, `${dateText(dt)}`, feast ? C.gold : C.text);
    t.printRich(x, y++, `{dim}${clock}{} ` + (night ? '{sky}☾ ночь' : darkness() > 0 ? '{orange}☼ сумерки' : '{gold}☼ день')
      + ` {dim}·{} ${wd.icon} ${wd.name}`);

    const ow = G.over, R = REGIONS[ow.regionAt(G.ox, G.oy)];
    t.print(x, y++, R.name.slice(0, 30), C.gold);
    if (G.mode === 'local') {
      const w = G.world, b = w.buildingAt(p.x, p.y), v = w.villageAt(p.x, p.y);
      const where = w.kind === 'dungeon' ? `Уровень ${w.depth + 1} из ${w.site.depth}`
        : b ? b.name : v ? v.name : w.site ? w.site.name : w.lead ? w.lead.name : w.def(p.x, p.y).name;
      if (w.kind === 'dungeon') t.print(x, y++, w.site.name.slice(0, 30), C.violet);
      t.print(x, y++, where.slice(0, 30), C.text);
    } else {
      const place = ow.placeAt(G.ox, G.oy), road = ow.roadAt(G.ox, G.oy) || (ow.isTrack(G.ox, G.oy) ? 'Проселок' : null);
      t.print(x, y++, (place ? placeTitle(place) : road || ow.def(G.ox, G.oy).name).slice(0, 30), place ? C.gold : C.text);
    }
    if (p.poison) t.print(x, y++, 'Отравлен!', C.green);
    if (p.confused) t.print(x, y++, 'Не владеешь собой!', C.violet);
    if (p.statPoints) t.print(x, y++, `Очки характеристик: ${p.statPoints} (C)`, C.gold);
    for (const q of p.quests.slice(0, 2))
      t.print(x, y++, questLine(q).slice(0, 30),
        q.done ? C.green : C.dim);

    y++;
    if (G.mode === 'over') {
      const place = ow.placeAt(G.ox, G.oy);
      if (y < MAP_H - 2) {
        t.print(x, y++, place ? 'Enter — войти' : 'Enter — осмотреться', C.dim);
        t.print(x, y++, 'R — лагерь   M — карта', C.dim);
        t.print(x, y++, 'Ж — журнал', C.dim);
      }
      return;
    }
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

// Экран поверх другого: прозрачный оверлей или HTML-окно.
function isLayer(s) { return s.overlay || !!(HUD.stage && s.html); }

function render() {
  const t = G.term;
  t.clear();
  let from = G.screens.length - 1;
  while (from > 0 && isLayer(G.screens[from])) from--;
  // Окна с html() рисуются HTML-слоем (js/windows.js), а под ними — карта.
  for (let i = from; i < G.screens.length; i++) if (!(HUD.stage && G.screens[i].html)) G.screens[i].render(t);
  t.flush();
  hudUpdate();
  winUpdate();
}

function handleKey(k) {
  const s = topScreen();
  if (s) s.key(k);
  render();
}
