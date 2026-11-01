'use strict';

// ─── Земля катаров ─────────────────────────────────────────────────
// Поле сожжённых (Прат-дельс-Кремат) у подножия Монсегюра: 16 марта 1244 года здесь
// сожгли больше двухсот «добрых людей», не отрекшихся от своей веры. С тех пор место
// неспокойно: бродят тени, слышно пение, ветер пахнет дымом. Капеллан замка Монсегюр
// просит проводить его туда — отслужить заупокойную и отпустить души. Пока он читает,
// тени собираются вокруг; герой держится рядом и не даёт им помешать.
//
// Пещеры «добрых людей»: в горах и лесах Лангедока прячутся последние катары. Нашёл —
// храни тайну или донеси брату-инквизитору: Тулузский собор 1229 года обещал за каждого
// пойманного еретика марку серебра. Инквизиторы-доминиканцы ходят по дорогам Лангедока
// и изредка — Ломбардии.

const CREMATS_ID = 'cremats';

// Жуть поля: по строчке время от времени, пока души не отпущены.
const CREMATS_EERIE = [
  'Ветер с горы пахнет дымом, хотя костров нигде нет.',
  'Где-то за спиной тихо поют — не по-латыни. Обернёшься — никого.',
  'Под ногой в пепле что-то хрустит. Ты не смотришь, что именно.',
  'У самого уха шепчут: «Paire sant, Dieus dreiturers dels bons esperits…» Рядом никого.',
  'Вороны сидят на обгорелых столбах и молчат. Ни одна не взлетает.',
  'На миг кажется, что за частоколом стоят люди — много людей, взявшись за руки.',
  'Небо над горой на мгновение рыжеет, будто от зарева. И гаснет.',
  'Кто-то зовёт по имени — женский голос, издалека. Не твоё имя.',
];

// Рассказ капеллана — по порядку.
const CREMATS_STORY = [
  '«Катары — „добрые люди“, как они себя звали, — верили, что видимый мир сотворил не Бог, а злое начало, и тело — темница души. '
    + 'Сорок лет назад папа объявил против них крестовый поход. Война выжгла этот край: Безье, Каркассон, Тулузу…»',
  '«В сорок втором году люди из Монсегюра пришли в Авиньонет и ночью зарубили инквизиторов, что спали в доме графского байля. '
    + 'После этого гору осадили. Десять месяцев держалась крепость; зимой баски из королевского войска взобрались по отвесной скале '
    + 'и поставили камнемёт у самых стен».',
  '«Второго марта сорок четвёртого замок сдался. Тем, кто отречётся, обещали жизнь. Двести с лишним не отреклись — '
    + 'среди них жена и дочь сеньора и их епископ Бертран Марти. Иные в последние дни сами приняли их обряд, зная, что их ждёт».',
  '«Шестнадцатого марта их свели сюда, в огороженное частоколом место, и подожгли. Говорят, они шли сами, без цепей, и пели. '
    + 'Я был тогда послушником при лагере… и помню этот запах. Церковь назвала их еретиками — и я не спорю с Церковью. '
    + 'Но душа есть душа, и молиться за упокой не запрещено никому. Начнём, когда будешь готов».',
];

const CREMATS_RITE_NEED = 30;   // ходов чтения рядом со священником

function crematsSite() { return G.over.sites.find(s => s.id === CREMATS_ID); }
function montsegurStage() { const p = G.player; p.story = p.story || {}; return p.story.montsegur || 0; }

function setMontsegur(n) {
  const p = G.player;
  p.story.montsegur = n;
  let q = p.quests.find(q => q.id === 'montsegur');
  if (n >= 3) { p.quests = p.quests.filter(x => x !== q); return; }
  if (!q) {
    q = { id: 'montsegur', type: 'story', label: 'Души Монсегюра', need: 1, have: 0, reward: 0, xp: 0, done: false,
      day: timeInfo().day, giverName: 'Капеллан замка Монсегюр', fromName: 'Монсегюр' };
    p.quests.push(q);
  }
  q.text = 'Проводить капеллана Монсегюра на Поле сожжённых у подножия горы и охранять его, пока он читает заупокойную. '
    + 'Держаться рядом: отойдёшь — тени не дадут ему читать.';
}

// Капеллан замка Монсегюр.
function montsegurPriestOptions(npc) {
  const place = npc.village.city;
  if (npc.role !== 'priest' || place.name !== 'Монсегюр' || G.player.is('saracen')) return [];
  const st = montsegurStage();
  if (st === 0 && !npc.montOffer) return [{ label: 'Что за огни над горой, отче?', act: () => {
    if (G.player.level < 3) return '«Огни? Пастухи болтают. Ступай с Богом, сын мой, тебе ещё рано о таком думать». Священник отводит глаза.';
    npc.montOffer = true;
    return '«Ты тоже видел? Внизу, у подножия, — поле, где сожгли еретиков. С тех пор там неспокойно: пастухи слышат пение, '
      + 'скотина туда не идёт, а в мартовские ночи над пеплом встаёт зарево. Я хочу отслужить там заупокойную — отпустить их. '
      + 'Но один я не дойду: тени гонят живых. Проводишь меня? Заплатить много не смогу, но Бог видит».';
  } }];
  if (st === 0) return [
    { label: 'Провожу, отче.', act: () => {
      setMontsegur(1);
      log('Новое поручение: «Души Монсегюра». Поле сожжённых — у подножия горы.', C.gold);
      return '«Благослови тебя Господь. Я соберу требник и святую воду. Иди к полю — я пойду за тобой следом».';
    } },
    { label: 'Не моё это дело, отче.', act: () => { npc.montOffer = false; return '«Понимаю. Многие так говорят. Потому они там и бродят».'; } },
  ];
  if (st === 1 || st === 2) return [{ label: 'Идём на поле, отче?', act: () => '«Иди вперёд, я следом. Поле — у подножия, к западу от замка. Не бойся — бойся только за меня».' }];
  return [{ label: 'Как там поле, отче?', act: () => '«Тихо. Пастухи снова гонят туда коз, и трава взошла на пепле. Я молюсь за них каждый день — и за тебя тоже».' }];
}

// В замке не всегда ставится часовня — а капеллан Монсегюру нужен: он живёт при донжоне.
function montsegurChaplain(world, city) {
  const v = world.villages[0];
  if (city.name !== 'Монсегюр' || !v || v.npcs.some(n => n.role === 'priest')) return;
  const rect = { x: v.cx - 6, y: v.cy - 3, w: 13, h: 7, building: -1 }, spot = findFreeIn(world, rect);
  if (!spot) return;
  const npc = makeNpc('priest', v, rect, spot[0], spot[1]);
  npc.title = 'Капеллан';
  v.npcs.push(npc);
  world.actors.push(npc);
}

// Поле: частокол, пепелище, обгорелые столбы; над полем — скалы горы.
function buildCremats(world, cx, cy) {
  for (let y = 0; y < world.h; y++)
    for (let x = 0; x < world.w; x++) {
      if (y < cy - 9 + Math.round(Math.sin(x / 5) * 2)) world.set(x, y, hash2(x, y) < 0.7 ? T.MOUNTAIN : T.ROCK);   // склон горы
    }
  for (let y = cy - 7; y <= cy + 7; y++)
    for (let x = cx - 16; x <= cx + 16; x++) {
      if (!world.inside(x, y)) continue;
      const d = Math.hypot((x - cx) / 14, (y - cy) / 6.5);
      if (d < 1) world.set(x, y, d < 0.55 ? T.CINDERS : hash2(x, y) < 0.3 ? T.CINDERS : T.STUBBLE);
      else if (d < 1.12) world.set(x, y, hash2(x * 3, y) < 0.55 ? T.STAKE : T.CINDERS);   // остатки частокола
    }
  for (const [dx, dy] of [[0, 0], [-5, -1], [5, 1], [-3, 2], [3, -2]]) world.set(cx + dx, cy + dy, T.STAKE);
  world.set(cx + 1, cy, T.CINDERS);
  // Проход в частоколе — с юга и с востока.
  for (const [x, y] of [[cx, cy + 7], [cx, cy + 6], [cx + 15, cy], [cx + 16, cy]]) if (world.inside(x, y)) world.set(x, y, T.DIRT);
}

function crematsCleansed() { return !!G.flags.cremats_cleansed; }

// Вход на поле.
function enterCremats(world) {
  const p = G.player, site = world.site;
  if (crematsCleansed()) { log('Над полем тихо. Пепел зарос травой, на обгорелом столбе поёт дрозд.', C.green); return; }
  log(rng.pick(CREMATS_EERIE), C.violet);
  const n = isNight() ? 5 : 2;
  for (let k = 0; k < n; k++) crematsShade(world, 7, 12, false);
  if (montsegurStage() === 1 || montsegurStage() === 2) {
    setMontsegur(2);
    const spot = [[2, 0], [-2, 0], [0, 1], [1, 1], [-1, 1], [0, -1]].map(([dx, dy]) => [p.x + dx, p.y + dy]).find(([x, y]) => world.free(x, y));
    if (!spot) return;
    const village = { city: site, npcs: [] }, [x, y] = spot;
    const npc = {
      kind: 'npc', role: 'priest', special: 'exorcist', village, home: { x, y, w: 1, h: 1, building: -1 }, x, y,
      name: 'Отец Гиро', title: 'Капеллан Монсегюра', female: false, glyph: '@', color: ROLES.priest.color, energy: 0, portrait: 'priest',
      greeting: 'Священник крестится и тяжело дышит после спуска. «Вот оно. Чувствуешь? Даже птицы молчат. Спрашивай, если хочешь знать, — а потом начнём».',
    };
    village.npcs.push(npc);
    world.actors.push(npc);
    log('Капеллан догоняет тебя у частокола, с требником под мышкой и флягой святой воды.', C.gold);
  }
}

// Тень сожжённого — у края частокола или поодаль.
function crematsShade(world, r0, r1, angry) {
  const cx = world.w >> 1, cy = world.h >> 1;
  for (let t = 0; t < 100; t++) {
    const a = rng.next() * Math.PI * 2, r = r0 + rng.next() * (r1 - r0);
    const x = Math.round(cx + Math.cos(a) * r * 1.8), y = Math.round(cy + Math.sin(a) * r * 0.8);
    if (!beastCanEnter(world, x, y) || world.isVisible(x, y) && Math.max(Math.abs(x - G.player.x), Math.abs(y - G.player.y)) < 3) continue;
    const m = makeBeast('burned_shade', x, y);
    if (angry) { m.provoked = true; m.target = [G.player.x, G.player.y]; }
    world.actors.push(m);
    return m;
  }
  return null;
}

function exorcistOptions(npc) {
  const w = G.world;
  if (crematsCleansed()) return [{ label: 'Уйти', act: () => null }];
  npc.told = npc.told || 0;
  const opts = [];
  if (npc.told < CREMATS_STORY.length) opts.push({ label: npc.told ? 'Что было дальше?' : 'Что здесь случилось, отче?', act: () => CREMATS_STORY[npc.told++] });
  if (!w.rite && npc.told) opts.push({ label: 'Начинай обряд. Я рядом.', act: () => { startRite(npc); return null; } });
  if (w.rite) opts.push({ label: 'Читай, отче, я не отойду.', act: () => '«Не отходи. Слышишь их? Они уже здесь».' });
  opts.push({ label: 'Подожди', act: () => null });
  return opts;
}

function startRite(npc) {
  const w = G.world, cx = w.w >> 1, cy = w.h >> 1;
  const spot = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]].find(([x, y]) => w.free(x, y)) || [npc.x, npc.y];
  npc.x = spot[0]; npc.y = spot[1]; npc.home = { x: spot[0], y: spot[1], w: 1, h: 1, building: -1 };
  w.rite = { turns: 0, npc };
  log('Священник встаёт у обгорелого столба, раскрывает требник и окропляет пепел. «Requiem aeternam dona eis, Domine…» Над полем поднимается ветер.', C.violet);
}

// Каждый ход на поле.
function crematsTick(w) {
  if (crematsCleansed()) return;
  if (!w.rite) { if (rng.chance(0.04)) log(rng.pick(CREMATS_EERIE), C.violet); return; }
  const p = G.player, r = w.rite, priest = r.npc;
  if (Math.max(Math.abs(p.x - priest.x), Math.abs(p.y - priest.y)) > 6) {
    if (rng.chance(0.25)) log('Священник сбивается: «Не отходи! Без тебя они не дадут мне читать!»', C.orange);
    return;
  }
  r.turns++;
  const lines = {
    8: '«Libera eas de ore leonis…» — голос священника дрожит. Из пепла поднимаются тени.',
    15: '«…и тех, кого мы назвали врагами, Господи, — прими их тоже», — добавляет он уже не по-латыни.',
    23: 'Тени кружат вокруг столба. Где-то совсем близко поют — и пение будто отвечает священнику.',
  };
  if (lines[r.turns]) log(lines[r.turns], C.violet);
  const shades = w.actors.filter(a => a.kind === 'beast' && a.key === 'burned_shade').length;
  if (r.turns % 4 === 0 && shades < 4) crematsShade(w, 6, 9, true);
  if (r.turns >= CREMATS_RITE_NEED) finishRite(w);
}

function finishRite(w) {
  const p = G.player;
  w.rite = null;
  G.flags.cremats_cleansed = true;
  w.actors = w.actors.filter(a => !(a.kind === 'beast' && a.key === 'burned_shade'));
  setMontsegur(3);
  const pay = 60;
  p.coins += pay;
  p.gainXp(70);
  addPiety(4, 'Ты помог отпустить души.');
  addFame(3, 'души Монсегюра');
  chronicle('Охранял капеллана Монсегюра, пока тот служил заупокойную на Поле сожжённых. Души отпущены.', 'quest');
  log('Последнее «Requiescant in pace». Ветер стихает разом, будто обрезанный. Тени стоят неподвижно — и тают, как дым '
    + `в утреннем воздухе. Над полем впервые за три года поёт птица. Капеллан отдаёт тебе кошель: ${coins(pay)}. «Всё, что собрали в приходе».`, C.gold);
}

// ─── Пещеры «добрых людей» ─────────────────────────────────────────

const CATHAR_PLACES = { count: 2, regions: ['languedoc'],
  names: ['Пещера у Орнолака', 'Грот над Арьежем', 'Пещера в Сабартесе', 'Лесной грот у Фенуйеда', 'Пещера над Ломбривом'] };

function catharSites() { return G.over.sites.filter(s => s.kind === 'cathar'); }

function placeCathars(ow, r) {
  const P = CATHAR_PLACES, names = r.shuffle(P.names.slice());
  let made = 0;
  for (let t = 0; t < 40000 * MAP_SCALE && made < P.count; t++) {
    const x = r.int(3, ow.w - 4), y = r.int(3, ow.h - 4), tile = ow.get(x, y);
    if (![OT.MOUNT, OT.PINE, OT.FOREST, OT.HILL].includes(tile) || ow.placeAt(x, y)) continue;
    if (!P.regions.includes(ow.regionAt(x, y))) continue;
    if (DIRS8.some(([dx, dy]) => ow.road[ow.idx(x + dx * 2, y + dy * 2)] >= 0)) continue;
    if (ow.cities.some(c => Math.max(Math.abs(c.x - x), Math.abs(c.y - y)) < 3 * MAP_SCALE)) continue;
    if (ow.sites.some(s => Math.hypot(s.x - x, (s.y - y) * 2) < 10 * MAP_SCALE)) continue;
    ow.sites.push({ id: `cathar${made}`, kind: 'cathar', type: 'site', hidden: true, glyph: '∩', color: '#9a8a70',
      x, y, region: ow.regionAt(x, y), terrain: tile, name: names[made % names.length],
      desc: 'Узкий лаз в скале, прикрытый можжевельником. Внутри теплее, чем снаружи, и пахнет дымом очага.' });
    made++;
  }
}

// Пещера: скала, лаз, внутри — очаг, солома, люди.
function buildCatharCave(world, cx, cy) {
  for (let y = cy - 5; y <= cy + 5; y++)
    for (let x = cx - 2; x <= cx + 12; x++)
      if (world.inside(x, y)) world.set(x, y, T.CAVEWALL);
  for (let y = cy - 3; y <= cy + 3; y++)
    for (let x = cx + 1; x <= cx + 10; x++)
      if (Math.hypot((x - cx - 6) / 4.5, (y - cy) / 3) < 1) world.set(x, y, T.CAVEFLOOR);
  for (let x = cx - 2; x <= cx + 2; x++) world.set(x, cy, T.CAVEFLOOR);   // лаз
  world.set(cx + 7, cy, T.HEARTH);
  world.set(cx + 9, cy - 1, T.HAY);
  world.set(cx + 9, cy + 1, T.HAY);
}

const CATHAR_TALK = {
  who: ['«Нас зовут еретиками. Мы зовём себя добрыми христианами. Мы не едим мяса, не клянёмся, не поднимаем руки на живое '
      + 'и верим, что этот мир — не Божий. Его сотворил тот, кто искушает. Божье — только душа, и она в плену».',
    '«Римская церковь называет себя невестой Христа. А мы видим, как её епископы садятся на коней и ведут войска. '
      + 'Христос не велел жечь. Скажи, кто из нас ближе к Евангелию?»'],
  mont: ['«Там были мои братья и сёстры. Двести и ещё пятнадцать. Они сами сошли к костру, держась за руки, — нам запрещено '
      + 'бояться смерти тела. Я {был|была} тогда далеко, с поручением. Иногда я думаю, что Бог меня наказал, оставив жить».',
    '«Перед сдачей четверо наших спустились ночью со скалы на верёвках. Что они унесли — не спрашивай. Не золото. '
      + 'Золото там никому не было нужно».'],
  life: ['«Верующие носят нам хлеб по ночам. Если кого-то из них поймают, он назовёт и нас: монахи умеют спрашивать. '
      + 'Поэтому мы уходим, когда ветер меняется».',
    '«Зимой холодно. Летом — монахи. Мы читаем Евангелие от Иоанна, по-нашему, на нашем языке. „В начале было Слово“…»'],
};

function enterCatharCave(world) {
  const site = world.site, cx = world.w >> 1, cy = world.h >> 1;
  if (site.betrayed) {
    log('В пещере пусто. Очаг давно остыл, солома разбросана, у стены — оборванная верёвка. Здесь были люди. Их увели.', C.dim);
    return;
  }
  if (site.met) log('В глубине пещеры тлеет очаг. Люди у огня узнают тебя и не прячутся.', C.violet);
  else log('В глубине пещеры тлеет очаг. Люди у огня вскакивают — и замирают, увидев, что ты один.', C.violet);
  const village = { city: site, npcs: [] };
  const occ = NAMES.occitan || namePool(site);
  const people = [
    { title: 'Добрый человек', female: false, portrait: 'hermit', perfect: true },
    { title: 'Добрая женщина', female: true, portrait: 'peasant_f4', perfect: true },
    { title: 'Верующий', female: false, portrait: 'peasant_m2' },
  ];
  site.people = site.people || people.map(p => ({ ...p, name: rng.pick(occ[p.female ? 'f' : 'm']) }));
  site.people.forEach((pp, i) => {
    const x = cx + 4 + i * 2, y = cy + (i === 1 ? 1 : -1);
    if (!world.free(x, y)) return;
    const npc = {
      kind: 'npc', role: pp.perfect ? 'hermit' : 'peasant', special: 'cathar', cathar: true, village, home: { x, y, w: 1, h: 1, building: -1 }, x, y,
      name: pp.name, title: pp.title, female: pp.female, glyph: '@', color: pp.perfect ? '#40404a' : '#b0a48a', energy: 0, portrait: pp.portrait,
      greeting: site.met ? '«Мир тебе, друг. Садись к огню».'
        : pp.perfect ? '«Не подходи с мечом… Мы — добрые люди, мы никому не делаем зла. Если ты пришёл от монахов — делай, что велено: '
          + 'нам запрещено проливать кровь, даже свою защищая».'
          : '«Кто тебя привёл? Кто?!» — Молодой крестьянин загораживает собой остальных.',
    };
    village.npcs.push(npc);
    world.actors.push(npc);
  });
  site.met = true;
}

function catharOptions(npc) {
  const site = npc.village.city, p = G.player;
  npc.said = npc.said || {};
  const say = key => () => { const pool = CATHAR_TALK[key]; const i = (npc.said[key] = (npc.said[key] || 0) + 1) - 1; return pool[i % pool.length]; };
  const opts = [
    { label: 'Кто вы такие?', act: say('who') },
    { label: 'Что было в Монсегюре?', act: say('mont') },
    { label: 'Как вы здесь живёте?', act: say('life') },
  ];
  if (!site.promised) opts.push({ label: 'Не бойтесь. Я никому не скажу.', act: () => {
    site.promised = true;
    p.food = Math.min(100, p.food + 25);
    chronicle(`Нашёл убежище «добрых людей» (${site.name}) и обещал молчать.`, 'event');
    return '«Да хранит тебя Бог, добрый человек». Тебе дают ломоть ячменного хлеба и луковицу — всё, что есть. '
      + 'Добрый человек кланяется тебе трижды, как кланяются у них. «Ступай. И забудь дорогу сюда — так будет лучше и тебе».';
  } });
  opts.push({ label: 'Уйти', act: () => null });
  return opts;
}

// Найденные, но не выданные убежища.
function catharsToReport() { return catharSites().filter(s => s.met && !s.betrayed); }

// Донос: марка серебра за каждого — так велел Тулузский собор.
function reportCathars(npc) {
  const p = G.player, s = catharsToReport()[0];
  if (!s) return '«Тебе нечего мне сказать».';
  s.betrayed = true;
  const pay = 60;
  p.coins += pay;
  addPiety(2, 'Церковь благодарит тебя.');
  if (s.promised) { addPiety(-6, 'Ты нарушил слово.'); addFame(-2, 'клятвопреступник'); }
  chronicle(`Донёс брату-инквизитору об убежище «добрых людей»: ${s.name}.`, 'event');
  return `Монах записывает каждое слово, переспрашивает дорогу и приметы. «${s.name}… Хорошо. Церковь не забудет твоего усердия». `
    + `Нотарий отсчитывает тебе ${coins(pay)} — марку серебра, как велит Тулузский собор. Через день сержанты уходят в горы.`
    + (s.promised ? ' Ты помнишь, как тебе кланялись трижды.' : '');
}

// ─── Инквизиторы на дорогах ────────────────────────────────────────

const INQUISITOR_NAMES = {
  languedoc: ['Бернар де Ко', 'Жан де Сен-Пьер', 'Феррье'],
  lombardy: ['Райнерий Саккони'],
};

// Сколько групп инквизиторов держать рядом с героем: Лангедок — дома, Ломбардия — изредка.
function inquisitorsCount() {
  const region = G.over.regionAt(G.ox, G.oy);
  if (region === 'languedoc') return 2;
  if (region === 'lombardy') return Math.floor(timeInfo().day / 10) % 4 === 0 ? 1 : 0;   // раз в сорок дней — на десять дней
  return 0;
}

function inquisitorTravelerOptions(npc) {
  const opts = [];
  if (catharsToReport().length)
    opts.push({ label: 'Я знаю, где прячутся «добрые люди»', act: () => reportCathars(npc) });
  opts.push({ label: 'Кого вы ищете, братья?', act: () => rng.pick([
    '«Тех, кто прячет волков в овечьей шкуре. Еретик кланяется, как добрый христианин, и ест мясо при людях, а ночью идёт к своим „совершенным“. '
      + 'Если узнаешь что-то — скажи. Тулузский собор назначил за каждого марку серебра».',
    '«Мы записываем. Всех. Кто кому дал хлеба, кто кому поклонился. Бог видит всё — а мы записываем то, что Он нам позволил увидеть».',
    '«Покаявшиеся носят жёлтые кресты на груди и на спине. Это милость, а не наказание. Упорствующих ждёт иное».',
  ]) });
  return opts;
}
