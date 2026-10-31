'use strict';

// ─── Последние язычники ────────────────────────────────────────────
// Сквозное задание для набожных. Священник посылает к папскому легату —
// кардиналу Раньери Капоччи в Витербо (исторический легат в Тоскане и
// Патримонии, враг Фридриха II). Легат указывает все селения язычников:
// опрокинуть их алтари и одолеть защитников. Когда последнее селение пусто,
// сам папа Иннокентий IV принимает героя в Перудже и жалует копьё со стягом
// святого Петра — так папы отмечали защитников Церкви.
//   0 — нет задания; 1 — идти к легату; 2 — разорять селения;
//   3 — вернуться к легату; 4 — к папе в Перуджу; 5 — исполнено.
// Это путь, противоположный пути фламина: кто приносил жертвы подземным
// богам, тому легат не поверит; кто взялся за поручение — тому фламин не скажет ни слова.

const CRUSADE_PIETY = 50;
const LEGATE_CITY = 'viterbo';
const POPE_CITY = 'perugia';

function crusadeStage() {
  const p = G.player;
  p.story = p.story || {};
  return p.story.crusade || 0;
}

function paganSites() { return G.over.sites.filter(s => s.kind === 'pagan'); }

function setCrusade(n, text) {
  const p = G.player;
  p.story.crusade = n;
  let q = p.quests.find(q => q.id === 'crusade');
  if (n >= 5) { p.quests = p.quests.filter(x => x !== q); return; }
  if (!q) {
    q = { id: 'crusade', type: 'story', label: 'Последние язычники', need: 1, have: 0, reward: 0, xp: 0, done: false, day: timeInfo().day };
    p.quests.push(q);
  }
  q.text = text;
  if (n === 2) {
    const all = paganSites();
    q.need = all.length;
    q.have = all.filter(s => s.razed).length;
  }
}

// Где, по донесениям, искать: «в горах Абруццо», «в лесах Калабрии».
const REGION_GEN = { abruzzo: 'Абруццо', calabria: 'Калабрии', sardinia: 'Сардинии', malta: 'Мальты', tuscany: 'Тосканы', emilia: 'Эмилии',
  campania: 'Кампании', sicily: 'Сицилии' };
function paganHint(s) {
  const where = s.terrain === OT.MOUNT || s.terrain === OT.HILL ? 'в горах' : 'в лесах';
  return `${where} ${REGION_GEN[s.region] || REGIONS[s.region].name}`;
}

function crusadeText() {
  const all = paganSites(), done = all.filter(s => s.razed), found = all.filter(s => !s.razed && !s.hidden), lost = all.filter(s => s.hidden);
  return `Кардинал-легат Раньери Капоччи (Витербо) поручил найти уцелевшие селения язычников, опрокинуть их алтари `
    + `и одолеть защитников. По донесениям, их четыре — где точно, никто не знает. Разорено: ${done.length} из ${all.length}.`
    + (found.length ? ` Найдено: ${found.map(s => s.name).join(', ')}.` : '')
    + (lost.length ? ` Ещё не найдены: ${lost.map(paganHint).join('; ')}. Расспрашивай местных и смотри по сторонам в глуши.` : '');
}

// Служба приходит как обычная работа: набожному священник может предложить её
// в ответ на «Нет ли для меня работы?».
function crusadeOffer(npc) {
  const p = G.player;
  if (npc.role !== 'priest' || /Имам/.test(npc.title) || npc.village.city.kind === 'pagan' || p.is('saracen')) return null;
  if (crusadeStage() !== 0 || p.piety < CRUSADE_PIETY || storyStage() >= 2) return null;
  return { story: 'crusade', accept: 'Я пойду в Витербо.',
    text: 'Священник понижает голос. «Ты, я вижу, крепок в вере. Есть дело не для всякого. В горах ещё живут люди, что молятся идолам — '
      + 'потомки язычников времён Цезарей. Так, по крайней мере, шепчут пастухи. В Витербо сейчас легат его святейшества, '
      + 'кардинал Раньери Капоччи. Ступай к нему и скажи, что тебя прислали. Он найдёт тебе дело».' };
}
function crusadeAccept(npc) {
  setCrusade(1, 'Отправиться в Витербо к папскому легату, кардиналу Раньери Капоччи. Священник говорит, что у легата есть поручение для набожного человека.');
  chronicle(`Священник ${npc.name} (${npc.village.city.name}) направил к папскому легату в Витербо.`, 'faith');
  return '«Кардинала ищи у главной церкви. Ступай с Богом — и не болтай о том дорогой».';
}

// Кто из священников может предложить службу.
function crusadeOptions(npc) {
  const p = G.player, stage = crusadeStage();
  if (/Имам/.test(npc.title) || npc.village.city.kind === 'pagan' || G.player.is('saracen')) return [];
  if (stage === 0) return [];
  if (stage === 1) return [{ label: 'О легате в Витербо…', act: () =>
    'Кардинал Капоччи в Витербо — ищи его у главной церкви. Не медли: легаты не засиживаются на одном месте.' }];
  return [];
}

// ─── Легат и папа: появляются, когда к ним есть дело ───────────────

function specialNpc(world, key, def) {
  if (world.actors.some(a => a.special === key)) return;
  const v = world.villages[0];
  const church = v.buildings.find(b => b.role === 'priest') || v.buildings[0];
  const home = church ? { x: church.x, y: church.y, w: church.w, h: church.h, building: church.id }
    : { x: v.cx - 4, y: v.cy - 2, w: 9, h: 5, building: -1 };
  const spot = findFreeIn(world, home) || findFreeIn(world, { x: v.cx - 6, y: v.cy - 3, w: 13, h: 7, building: -1 });
  if (!spot) return;
  const npc = {
    kind: 'npc', role: def.role, special: key, village: v, home, x: spot[0], y: spot[1],
    name: def.name, title: def.title, female: false, glyph: '@', color: def.color, energy: 0,
    greeting: def.greeting, historic: true, portrait: def.portrait,
  };
  v.npcs.push(npc);
  world.actors.push(npc);
}

// Легат в Витербо, пока идёт поручение; папа в Перудже — только ради аудиенции.
// После них оба покидают эти города.
function crusadeVisitors(world, city) {
  const stage = crusadeStage();
  const gone = key => {
    for (const v of world.villages) v.npcs = v.npcs.filter(n => n.special !== key);
    world.actors = world.actors.filter(a => a.special !== key);
  };
  if (city.id === LEGATE_CITY && (stage < 1 || stage >= 5)) gone('legate');
  if (city.id === POPE_CITY && stage !== 4) gone('pope');
  if (city.id === LEGATE_CITY && stage >= 1 && stage < 5)
    specialNpc(world, 'legate', {
      role: 'legate', name: 'Раньери Капоччи', title: 'Кардинал-легат', color: '#e04848', portrait: 'abbot',
      greeting: 'Мир тебе. Я Раньери, кардинал-диакон Санта-Мария-ин-Космедин, легат его святейшества в этих землях. Говори.',
    });
  if (city.id === POPE_CITY && stage === 4)
    specialNpc(world, 'pope', {
      role: 'pope', name: 'Иннокентий IV', title: 'Папа римский', color: '#f0e0a0', portrait: 'pope',
      greeting: 'Тот, кто очистил горы от идолов? Подойди, сын мой. Мы давно хотели тебя видеть.',
    });
}

function legateOptions(npc) {
  const p = G.player, stage = crusadeStage(), opts = [];
  if (stage === 1) opts.push({ label: 'Меня прислал священник. Я готов служить', act: () => {
    if (storyStage() >= 2) return 'Легат щурится. «От тебя пахнет чужим огнём. Ты кадил идолам — мне донесли. Ступай прочь».';
    setCrusade(2, crusadeText());
    chronicle('Кардинал-легат Раньери Капоччи поручил разыскать и искоренить последних язычников.', 'event');
    const hints = paganSites().map(paganHint);
    return 'Кардинал долго молчит, перебирая чётки. «Тридцать лет до курии доходят слухи. Пастухи видят дым там, где нет деревень; '
      + 'сборщики податей возвращаются ни с чем; один священник ушёл к ним с проповедью и вернулся немым. Епископы отмахиваются: '
      + 'бабьи сказки. Но я собрал донесения — и все они сходятся. Где-то остались селения тех, кто молится Сатурну и Диане, '
      + `как при Нероне. Четыре, если верить донесениям: ${hints.slice(0, -1).join(', ')} и ${hints[hints.length - 1]}. `
      + 'Где именно — не знает никто, туда не ведут дороги. Найди их. Опрокинь алтари. Люди пусть бегут — кто захочет, найдёт дорогу к купели. '
      + 'Но тех, кто возьмётся за оружие, не щади. Когда падёт последний алтарь — возвращайся. Святой отец узнает твоё имя».';
  } });
  if (stage === 2) opts.push({ label: 'О поручении…', act: () => {
    const left = paganSites().filter(s => !s.razed), lost = left.filter(s => s.hidden);
    const hint = lost.length ? ` Не найдены: ${lost.map(paganHint).join('; ')}. Расспрашивай пастухов и угольщиков — `
      + 'местные знают больше, чем говорят. И смотри в оба: дым над лесом, идол на тропе.' : '';
    return `«Осталось ${left.length}.${hint} Алтарь стоит в их святилище — опрокинь его. Защитники будут драться, будь готов».`;
  } });
  if (stage === 3) opts.push({ label: 'Последний алтарь пал', act: () => {
    setCrusade(4, 'Ехать в Перуджу: папа Иннокентий IV желает видеть тебя лично.');
    p.coins += 150;
    addPiety(5, 'Легат благословляет тебя.');
    log('+150 мон.', C.gold);
    chronicle('Доложил легату: селений язычников больше нет.', 'event');
    return 'Кардинал встаёт — честь, которую он оказывает немногим. «Я уже писал о тебе в Лион. И вот ответ: его святейшество '
      + 'Иннокентий тайно прибыл в Перуджу и желает видеть тебя сам. Возьми на дорогу — и не заставляй ждать наместника Петра».';
  } });
  if (stage === 4) opts.push({ label: 'Где мне искать святого отца?', act: () => 'В Перудже, у собора. Иди с миром.' });
  opts.push({ label: 'Как дела в Церкви?', act: () => rng.pick(timely([
    'Император Фридрих низложен собором в Лионе, но не сдаётся. Его сарацины из Лючеры жгут наши земли. Молись за святой престол.',
    'Святой отец в Лионе: Рим ему пока небезопасен. Но Италия — его, и мы, легаты, — его руки здесь.',
    'Парма отложилась от императора, он осадил её. Если Парма устоит — устоит и Ломбардия.',
  ])) });
  return opts;
}

function popeOptions(npc) {
  const p = G.player, stage = crusadeStage(), opts = [];
  if (stage === 4) opts.push({ label: 'Преклонить колено', act: () => {
    setCrusade(5);
    addFame(12, 'был принят самим папой Иннокентием');
    const it = makeItem('vexillum');
    p.bag.push(it);
    p.coins += 500;
    p.piety = Math.min(100, p.piety + 15);
    p.grace = p.maxGrace;
    p.title = 'Защитник веры';
    npc.leaving = true;   // после аудиенции папа уезжает
    log(`Ты получаешь: ${it.name} и 500 мон. Благочестие +15. Отныне тебя зовут Защитником веры.`, C.gold);
    chronicle('Удостоен аудиенции у папы Иннокентия IV в Перудже. Получил копьё со стягом святого Петра и прозвание Защитника веры.', 'boss');
    return 'Папа поднимает тебя с колен. «Ты сделал то, чего не сделали ни проповедники, ни епископы. Горы снова принадлежат Христу». '
      + 'Капеллан подносит копьё с красным стягом, на котором вышиты ключи Петра. «Такой стяг Святой престол дарует лишь '
      + 'защитникам Церкви. Носи его с честью. И возьми на нужды пути». Иннокентий благословляет тебя, и в груди разливается свет. '
      + '«А теперь нам пора: в Лионе ждёт собор, а дороги Италии небезопасны даже для наместника Петра. Ступай с Богом».';
  } });
  opts.push({ label: 'Что тревожит Церковь?', act: () => rng.pick([
    '«Император Фридрих. Мы низложили его в Лионе, но он всё ещё держит Сицилию и половину Ломбардии. Молись, чтобы Господь вразумил его».',
    '«Татары на востоке. Мы послали к их хану брата Иоанна из Плано Карпини. Он вернулся живым — и это уже чудо».',
    '«Ереси. Катары в Ломбардии, патарены, бедные из Лиона. Проповедники ордена святого Доминика трудятся, но их мало».',
  ]) });
  return opts;
}

// ─── Разорение селения ─────────────────────────────────────────────

// Шаг в алтарь языческого селения. Возвращает true, если шаг потрачен.
// Джгантия (Гоцо): плита в глубине храма великанов.
function ggantijaAltar() {
  const p = G.player;
  if (p.ggantija) { log('Каменная плита с ямками-чашами. Ветер с моря гонит по ней пыль.', C.dim); return; }
  p.ggantija = true;
  log('Плита в глубине храма, вся в мелких ямках, будто её точил дождь тысячу лет. На ней — нет, не кровь: охра, древняя, въевшаяся в камень.', C.dim);
  giveItem(['great_mother'], 'В щели под плитой — {it}: тучная женщина, сидящая на пятках. Голову кто-то давно отбил.');
}

function bumpPaganAltar(x, y) {
  const w = G.world, city = w.villages && w.villages[0] && w.villages[0].city;
  if (w.site && w.site.id === 'ggantija') { ggantijaAltar(); return true; }
  if (!city || city.kind !== 'pagan') return false;
  if (crusadeStage() !== 2 || city.razed || city.razing) {
    log('Каменный алтарь, чёрный от жертвенной крови и копоти. На нём — свежие цветы и колосья.', C.dim);
    return true;
  }
  if (w.altarWarned !== `${x},${y}`) {
    w.altarWarned = `${x},${y}`;
    log('Ты кладёшь руку на алтарь. Язычники вокруг замирают. Ещё раз — и ты опрокинешь его, но тогда они возьмутся за оружие.', C.orange);
    return true;
  }
  w.set(x, y, T.RUBBLE);
  city.razing = true;
  addPiety(3, 'Ты опрокидываешь языческий алтарь.');
  log('Алтарь с грохотом падает и раскалывается. Над селением поднимается вой.', C.red);
  // Мирные бегут в лес, жрец и мужчины берутся за оружие.
  const v = w.villages[0], p = G.player;
  let flamen = null;
  for (const n of v.npcs) {
    if (n.role === 'flamen') flamen = n;
    w.actors = w.actors.filter(a => a !== n);
  }
  v.npcs = [];
  log('Женщины и старики бегут в лес. Мужчины хватают копья.', C.orange);
  const defenders = [];
  if (flamen) defenders.push(['pagan_flamen', flamen.x, flamen.y]);
  for (let i = 0; i < 3 + paganSites().filter(s => s.razed).length; i++) {
    const spot = findFreeIn(w, { x: v.cx - 10, y: v.cy - 5, w: 21, h: 11, building: -1 });
    if (spot && dist({ x: spot[0], y: spot[1] }, p) > 3) defenders.push(['pagan_guard', spot[0], spot[1]]);
  }
  for (const [key, dx, dy] of defenders) {
    if (!w.free(dx, dy)) continue;
    const m = makeBeast(key, dx, dy);
    m.razeOf = city.id;
    m.provoked = true;
    m.target = [p.x, p.y];
    w.actors.push(m);
  }
  if (!defenders.length) finishRaze(city);
  return true;
}

// Защитник пал: если больше никого — селение пусто.
function razeKill(m) {
  const w = G.world;
  if (w.actors.some(a => a.razeOf === m.razeOf && a !== m && !a.dead)) return;
  const city = G.over.sites.find(s => s.id === m.razeOf);
  if (city) finishRaze(city);
}

function finishRaze(city) {
  if (city.razed) return;
  city.razed = true;
  city.razing = false;
  city.glyph = '×';
  city.color = '#7a7068';
  const w = G.world;
  // Хижины горят.
  if (w.villages && w.villages[0] && w.villages[0].city === city)
    for (let i = 0; i < w.tiles.length; i++)
      if (w.building[i] !== -1 && TILES[w.tiles[i]].walk && rng.chance(0.5)) w.set(i % w.w, (i / w.w) | 0, T.ASH);
  const left = paganSites().filter(s => !s.razed);
  log(`${city.name}: язычников здесь больше нет. Хижины догорают, идолы повержены.`, C.gold);
  chronicle(`Разорил селение язычников: ${city.name}.`, 'event');
  if (left.length) setCrusade(2, crusadeText());
  else {
    setCrusade(3, 'Все селения язычников разорены. Вернуться к кардиналу-легату Раньери Капоччи в Витербо.');
    log('Это было последнее селение. Пора возвращаться к легату в Витербо.', C.gold);
  }
}

// Вернулся в селение, где разорение не довершено (защитники разошлись).
function crusadeEnter(world, city) {
  if (city.razing && !city.razed && !world.actors.some(a => a.razeOf === city.id)) {
    G.world = world;
    finishRaze(city);
  }
}
