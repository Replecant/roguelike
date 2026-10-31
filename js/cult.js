'use strict';

// ─── Тихая деревня ─────────────────────────────────────────────────
// Кастелян жалуется: соседняя деревня «стала странной» — не платит десятину,
// не пускает чужих, священник пропал. На деле деревня служит дьяволу.
// Жители встречают героя холодно и следят за ним; лишние вопросы злят их,
// и однажды они возьмутся за вилы. На отшибе стоит запертая церковь; под её
// алтарём — спуск в пещеры, где бесы и глава культа. Кто заночует в деревне,
// того, скорее всего, утащат во сне в те же пещеры — без оружия.
//   0 — нет; 1 — разузнать; 2 — найден спуск (или похищен); 3 — глава культа убит;
//   4 — кастелян отблагодарил.

const CULT_GREETINGS = [
  'Чего тебе? Здесь нечего смотреть.', 'Проезжай мимо, чужак. У нас своих забот хватает.',
  'Мы не любим гостей. Особенно любопытных.', 'Ты заблудился. Дорога — там.',
  '…', 'Солнце скоро сядет. Тебе лучше быть подальше отсюда, когда стемнеет.',
];
const CULT_LIFE = [
  'Живём хорошо. Лучше, чем раньше. Урожай — на зависть соседям. Не спрашивай почему.',
  'Священник? Уехал. Давно. Нам и без него хорошо.',
  'Дети у нас не плачут по ночам. Ни один. Разве это плохо?',
  'Колокол? Он звонит, когда надо. Не тебе знать когда.',
  'Мы молимся. По-своему. Тебе-то что?',
];
const CULT_EVASIVE = [
  'Ничего здесь не происходит. Ничего.', 'Кастелян прислал? Пусть сам приедет. Если не боится.',
  'Ты задаёшь слишком много вопросов, чужак.', 'Спроси у старосты. Он всё скажет. Всё, что тебе нужно знать.',
];
const CULT_WHISPERS = [
  'Где-то за домами тихо поёт ребёнок. Слов не разобрать — но мелодия звучит задом наперёд.',
  'Ставни на соседнем доме приоткрываются — и захлопываются, едва ты оборачиваешься.',
  'Над церковью на отшибе кружат вороны. Колокол бьёт один раз — хотя сейчас не время ни для какой службы.',
  'На двери хлева — свежий знак углём: круг и перевёрнутый крест.',
  'Тебе кажется, что за тобой идут. Ты оборачиваешься — улица пуста, только скрипит калитка.',
  'В деревне нет ни одной собаки. Ни лая, ни цепей у ворот.',
  'Из-под земли, будто из погреба, доносится гул — мерный, как дыхание.',
];

function cultStage() { const p = G.player; p.story = p.story || {}; return p.story.cult || 0; }
function cultVillagePlace() { return G.over.cities.find(c => c.id === G.player.story.cultVillage); }
function cultActive(place) { return !!place && cultStage() >= 1 && cultStage() < 3 && G.player.story.cultVillage === place.id; }
function cultNpc(npc) { return !!(npc.village && npc.village.city) && cultActive(npc.village.city) && npc.kind === 'npc'; }

function setCult(n, text) {
  const p = G.player;
  p.story.cult = n;
  let q = p.quests.find(q => q.id === 'cult');
  if (n >= 4) { p.quests = p.quests.filter(x => x !== q); return; }
  if (!q) {
    q = { id: 'cult', type: 'story', label: 'Тихая деревня', need: 1, have: 0, reward: 0, xp: 0, done: false, day: timeInfo().day };
    p.quests.push(q);
  }
  const v = cultVillagePlace(), c = G.over.cities.find(x => x.id === p.story.cultCastle);
  q.giverName = c && `Кастелян (${c.name})`;
  q.fromName = c && c.name;
  q.text = text || q.text;
  if (v) q.text = q.text.replace('{village}', v.name);
}

// ─── Кастелян ──────────────────────────────────────────────────────

// Поручение кастеляна приходит как обычная работа («Нет ли для меня работы?»):
// не всякому и не сразу — новичку такое дело не по плечу.
const CULT_MIN_LEVEL = 4;
function cultOffer(npc) {
  const p = G.player, place = npc.village.city;
  if (place.kind !== 'castle' || npc.role !== 'elder' || place.siege || cultStage() !== 0 || p.level < CULT_MIN_LEVEL) return null;
  const villages = G.over.cities.filter(c => c.kind === 'village' && !c.razed
    && Math.hypot(c.x - place.x, c.y - place.y) >= 3 * MAP_SCALE && Math.hypot(c.x - place.x, c.y - place.y) <= 30 * MAP_SCALE);
  if (!villages.length) return null;
  const v = villages.reduce((a, b) => Math.hypot(b.x - place.x, b.y - place.y) < Math.hypot(a.x - place.x, a.y - place.y) ? b : a);
  return { story: 'cult', village: v.id, accept: 'Съезжу и посмотрю.',
    text: `Кастелян мнётся. «Работа есть, да странная. Деревня ${v.name}, ${dirTo(place, v)} отсюда. С весны там что-то не так: десятину не платят, `
      + 'моих людей встречают молча и провожают взглядами. Священник перестал приезжать на собор — и никто его не видел с Пасхи. '
      + 'А урожай у них такой, какого не было ни у кого в округе. Солдат туда без причины не пошлёшь — сеньор не велит. '
      + 'Съездил бы ты, посмотрел. Заплачу, если узнаешь, в чём дело».' };
}

function cultAccept(npc, o) {
  const p = G.player, place = npc.village.city, v = G.over.cities.find(c => c.id === o.village);
  p.story = p.story || {};
  p.story.cultVillage = v.id;
  p.story.cultCastle = place.id;
  p.story.cultSusp = 0;
  setCult(1, `Кастелян замка ${place.name} просит разузнать, что творится в деревне {village}: она «стала странной и закрытой», `
    + 'не платит десятину, священник пропал. Расспросить жителей — осторожно, — и заглянуть в церковь на отшибе.');
  chronicle(`Кастелян замка ${place.name} попросил разузнать, что творится в деревне ${v.name}.`, 'event');
  return '«Церковь у них стоит на отшибе — загляни и туда. И, ради Бога, не ночуй там».';
}

function castellanOptions(npc) {
  const p = G.player, place = npc.village.city, st = cultStage();
  if (place.kind !== 'castle' || npc.role !== 'elder' || place.siege) return [];
  if (st === 0) return [];
  if (p.story.cultCastle !== place.id) return [];
  if (st === 1 || st === 2) return [{ label: 'О деревне…', act: () =>
    '«Ну что? Узнал что-нибудь? Церковь, говорю тебе, — всё дело в церкви. И не ночуй там, слышишь?»' }];
  if (st === 3) return [{ label: 'Я знаю, что творилось в деревне', act: () => {
    setCult(4);
    addFame(8, `очистил деревню ${cultVillagePlace().name} от бесовского культа`);
    p.coins += 220;
    p.gainXp(120);
    addPiety(5, 'Ты избавил деревню от бесовского культа.');
    log(`Получено: ${coins(220)}, 120 опыта.`, C.gold);
    chronicle(`Рассказал кастеляну замка ${place.name} о культе в деревне ${cultVillagePlace().name}. Получил награду.`, 'quest');
    return 'Кастелян долго молчит, а потом крестится трижды. «Дьяволу… под церковью… Господи, помилуй. Я пошлю туда епископа '
      + 'и отряд — пусть освятят заново. А ты… вот, возьми. Мало за такое, но больше у меня нет. И не рассказывай никому: '
      + 'люди и так боятся темноты».';
  } }];
  return [];
}

// ─── Деревня ───────────────────────────────────────────────────────

// Войти в деревню, пока культ жив: церковь на отшибе, пустая часовня, взгляды.
function cultEnter(world, city) {
  if (!cultActive(city)) return;
  world.cult = true;
  for (const v of world.villages) {
    const gone = v.npcs.filter(n => n.role === 'priest');
    v.npcs = v.npcs.filter(n => n.role !== 'priest');
    world.actors = world.actors.filter(a => !gone.includes(a));
  }
  if (!world.cultChurch) stampCultChurch(world);
  log('Деревня молчит. Ставни закрыты, на улицах ни души — только из-за занавесок на тебя смотрят. '
    + 'Вдалеке, на отшибе, чернеет церковь с заколоченными окнами.', C.violet);
}

// Церковь на отшибе: запертая дверь, алтарь, кладбище вокруг.
function stampCultChurch(world) {
  const v = world.villages[0], W = 11, H = 7;
  let best = null;
  for (let y0 = 2; y0 < world.h - H - 2; y0++)
    for (let x0 = 2; x0 < world.w - W - 2; x0++) {
      const d = Math.hypot((x0 + W / 2 - v.cx) / 2, y0 + H / 2 - v.cy);
      if (d < 14) continue;
      let ok = true;
      for (let y = y0 - 1; y <= y0 + H && ok; y++)
        for (let x = x0 - 1; x <= x0 + W && ok; x++)
          if (!world.walkable(x, y) || world.building[world.idx(x, y)] !== -1 || world.get(x, y) === T.ROAD) ok = false;
      if (ok && (!best || d < best[2])) best = [x0, y0, d];
    }
  if (!best) return;
  const [x0, y0] = best, doorX = x0, doorY = y0 + (H >> 1);
  for (let y = y0; y < y0 + H; y++)
    for (let x = x0; x < x0 + W; x++) {
      const edge = x === x0 || y === y0 || x === x0 + W - 1 || y === y0 + H - 1;
      world.set(x, y, edge ? T.STONEWALL : T.FLOOR);
    }
  world.set(doorX, doorY, T.LOCKED);
  world.set(x0 + W - 2, doorY, T.ALTAR);
  for (const x of [x0 + 3, x0 + 5, x0 + 7]) { world.set(x, y0 + 2, T.BENCH); world.set(x, y0 + H - 3, T.BENCH); }
  // Кладбище: покосившиеся кресты.
  for (let i = 0; i < 14; i++) {
    const x = x0 - 6 + rng.int(0, W + 10), y = y0 - 3 + rng.int(0, H + 5);
    if (world.walkable(x, y) && (x < x0 - 1 || x > x0 + W || y < y0 - 1 || y > y0 + H)) world.set(x, y, T.GRAVE);
  }
  // Тропа от деревни к дверям.
  const path = findPath(world, doorX - 1, doorY, v.cx, v.cy, (x, y) => world.walkable(x, y) ? 1 : world.building[world.idx(x, y)] === -1 ? 6 : Infinity);
  if (path) for (const [x, y] of path) if (!world.walkable(x, y)) world.set(x, y, T.DIRT);
  world.cultChurch = { x: x0, y: y0, w: W, h: H, altar: [x0 + W - 2, doorY], door: [doorX, doorY] };
}

function inCultChurch(world, x, y) {
  const c = world.cultChurch;
  return c && x > c.x && y > c.y && x < c.x + c.w - 1 && y < c.y + c.h - 1;
}

// Подозрение жителей. На 6 — берутся за вилы.
function raiseSuspicion(n, why) {
  const p = G.player;
  p.story.cultSusp = (p.story.cultSusp || 0) + n;
  const s = p.story.cultSusp;
  if (why) log(why, C.orange);
  if (s >= 6 && !p.story.cultRiot) villagersAttack();
  else if (s >= 4) log('Ты чувствуешь на себе тяжёлые взгляды. Кто-то запирает за тобой калитку. Лучше не злить их дальше.', C.red);
}

function villagersAttack() {
  const w = G.world, p = G.player;
  p.story.cultRiot = true;
  let n = 0;
  for (const v of w.villages) for (const npc of v.npcs.slice()) {
    if (n >= 6 || npc.role === 'innkeeper' || dist(npc, p) > 20) continue;
    const m = makeBeast('cult_villager', npc.x, npc.y);
    m.name = `${npc.title} ${npc.name}`;
    m.provoked = true;
    m.target = [p.x, p.y];
    w.actors = w.actors.filter(a => a !== npc);
    v.npcs = v.npcs.filter(x => x !== npc);
    w.actors.push(m);
    n++;
  }
  log('Они переглядываются — и молча, без единого крика, достают из-под одежды ножи и серпы. Деревня идёт на тебя.', C.red);
  refreshFov();
}

function cultNpcOptions(npc) {
  const p = G.player, opts = [];
  opts.push({ label: 'Что у вас тут происходит?', act: () => { raiseSuspicion(1); return rng.pick(CULT_EVASIVE); } });
  opts.push({ label: 'Как живёте?', act: () => rng.pick(CULT_LIFE) });
  opts.push({ label: 'Где ваш священник?', act: () => {
    raiseSuspicion(2, 'Лицо собеседника каменеет.');
    return rng.pick(['Уехал. Давно.', 'Молится. В церкви. Не ходи туда — он не любит, когда мешают.', 'Какой священник? У нас его не было.']);
  } });
  if (npc.role === 'elder' || npc.role === 'innkeeper') opts.push({ label: 'Пустите переночевать', act: () => {
    p.story.cultLodging = true;
    return npc.role === 'elder' ? 'Староста вдруг улыбается — впервые. «Конечно. Гость — это святое. Ложись у очага, я разбужу утром». '
      + '(Лечь спать — R.)' : 'Трактирщица кивает, не поднимая глаз. «Угол наверху свободен. Спи крепко». (Лечь спать — R.)';
  } });
  return opts;
}

// Раз в ход в деревне: шёпоты и подозрение по ночам.
function cultTick() {
  const w = G.world, p = G.player;
  if (!w.cult || !w.villages || !w.villages[0] || !cultActive(w.villages[0].city)) return;
  if (rng.chance(0.02)) log(rng.pick(CULT_WHISPERS), C.violet);
  if (isNight() && rng.chance(0.01)) raiseSuspicion(1, 'Ночью чужак в деревне — плохая примета. Кто-то видел, как ты бродишь.');
}

// Шум у церкви злит деревню.
function cultNoise() {
  if (G.world.cult) raiseSuspicion(2, 'Грохот разносится по всей деревне. Где-то хлопает дверь.');
}

// Алтарь в церкви: под ним — спуск.
function bumpCultAltar(x, y) {
  const w = G.world;
  if (!w.cult || !inCultChurch(w, x, y)) return false;
  if (w.cultAltarSeen !== true) {
    w.cultAltarSeen = true;
    log('Алтарь осквернён: распятие перевёрнуто, на камне — засохшая кровь. По полу от алтаря тянутся борозды — его двигали. '
      + 'И из-под него тянет сырым холодом.', C.violet);
    return true;
  }
  w.set(x, y, T.STAIRS_DOWN);
  w.cultStairs = [x, y];
  log('Ты наваливаешься на алтарь — и он со скрежетом отъезжает в сторону. Под ним — каменные ступени, уходящие в темноту. '
    + 'Оттуда доносится пение.', C.violet);
  if (cultStage() < 2) setCult(2, 'Под алтарём церкви в деревне {village} — спуск в пещеры. Там культ. Найти и убить его главу.');
  chronicle('Нашёл под алтарём осквернённой церкви спуск в пещеры культа.', 'find');
  return true;
}

// ─── Пещеры ────────────────────────────────────────────────────────

function cultSite() {
  const p = G.player, v = cultVillagePlace();
  let site = G.over.sites.find(s => s.id === p.story.cultSite);
  if (site) return site;
  const def = DUNGEON_TYPES.cult;
  site = { id: 'cult1', type: 'cult', dungeon: true, hidden: true, quest: true, cultOf: v.id, glyph: def.glyph, color: def.color,
    x: v.x, y: v.y, region: v.region, terrain: v.terrain, name: `Пещеры под деревней ${v.name}`, depth: 2, desc: def.desc };
  G.over.sites.push(site);
  p.story.cultSite = site.id;
  return site;
}

function enterCultCaves() {
  const site = cultSite(), d = G.dungeons[site.id] || (G.dungeons[site.id] = { levels: [] });
  log('Ступени скользкие от сырости. Пение становится громче. Ты спускаешься под деревню.', C.violet);
  goToLevel(site, d, 0, 'up');
}

// Выход из пещер — обратно в церковь.
function leaveCultCaves() {
  const v = cultVillagePlace();
  leaveLocal();
  G.ox = v.x; G.oy = v.y;
  enterCity(v);
  const w = G.world;
  if (w.cultStairs) {
    const [sx, sy] = w.cultStairs;
    const spot = DIRS8.map(([dx, dy]) => [sx + dx, sy + dy]).find(([x, y]) => w.free(x, y));
    if (spot) { moveTo(G.player, spot[0], spot[1]); refreshFov(); }
  }
  log('Ты выбираешься наверх, в осквернённую церковь.', C.dim);
}

// Сон в деревне: скорее всего, утащат.
function cultKidnapCheck() {
  const w = G.world, p = G.player;
  if (G.mode !== 'local' || !w || !w.cult || !w.villages || !w.villages[0] || !cultActive(w.villages[0].city)) return false;
  if (!rng.chance(p.story.cultLodging ? 0.85 : 0.6)) return false;
  p.story.cultLodging = false;
  const site = cultSite(), d = G.dungeons[site.id] || (G.dungeons[site.id] = { levels: [] });
  passTime(120);
  goToLevel(site, d, 0, 'up');
  const lw = G.world;
  // Бросили в дальний закуток, оружие — в сундук культистов.
  const far = [];
  for (let i = 0; i < lw.tiles.length; i++) {
    const x = i % lw.w, y = (i / lw.w) | 0;
    if (lw.free(x, y) && Math.hypot(x - lw.up[0], y - lw.up[1]) > 18) far.push([x, y]);
  }
  if (far.length) { const [x, y] = rng.pick(far); moveTo(p, x, y); }
  const taken = ['right', 'left'].map(s => p.equip[s]).filter(Boolean);
  p.equip.right = null; p.equip.left = null;
  if (taken.length) {
    const stash = far.filter(([x, y]) => Math.hypot(x - p.x, y - p.y) > 6 && Math.hypot(x - p.x, y - p.y) < 16);
    const [cx, cy] = stash.length ? rng.pick(stash) : [p.x + 1, p.y];
    lw.set(cx, cy, T.CHEST);
    addContainer(lw, lw.idx(cx, cy), 'kidnap_stash');
    lw.kidnapItems = taken;
  }
  refreshFov();
  if (cultStage() < 2) setCult(2, 'Тебя похитили во сне и бросили в пещеры под деревней {village}. Вернуть оружие, выбраться — и найти главу культа.');
  log('Тебя будит холод. Ты лежишь на камнях, во рту — кляп, руки стянуты верёвкой. Темно; где-то капает вода и поют — '
    + 'низко, на латыни, но слова вывернуты наизнанку. Ты перетираешь верёвку о камень. Оружия нет — его унесли.', C.red);
  chronicle('Похищен во сне жителями деревни и брошен в пещеры под ней.', 'event');
  return true;
}

function kidnapStash() {
  const w = G.world, p = G.player;
  for (const it of w.kidnapItems || []) p.bag.push(it);
  log(w.kidnapItems && w.kidnapItems.length ? `В сундуке культистов — твоё оружие: ${w.kidnapItems.map(it => it.name.toLowerCase()).join(', ')}. Надень (I).` : 'Сундук пуст.', C.gold);
  w.kidnapItems = [];
}

// Глава культа убит.
function cultLeaderSlain() {
  if (cultStage() >= 3) return;
  setCult(3, 'Глава культа мёртв, бесы изгнаны. Вернуться к кастеляну и рассказать правду.');
  addPiety(3, 'Ты сразил служителя дьявола.');
  log('Настоятель падает, и пение обрывается. Бесы с визгом рассыпаются в пепел. Наверху, в деревне, кто-то плачет — '
    + 'впервые за долгое время.', C.gold);
  chronicle(`Сразил главу дьявольского культа в пещерах под деревней ${cultVillagePlace().name}.`, 'boss');
}
