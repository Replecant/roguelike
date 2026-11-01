'use strict';

// ─── Узник Эццелино (Верона, 1247) ─────────────────────────────────
// Эццелино да Романо, викарий императора, правит Вероной, Падуей и Виченцой
// и бросает в темницы гвельфскую знать. Граф Сан-Бонифачо — глава веронских
// гвельфов — в изгнании; в городе остался его родич, мессер Альдригетто.
// Его старшего сына Тебальдо схватили с письмами к изгнанникам — Эццелино
// хочет казнить его. Славного героя зовут на помощь.
//   0 — нет; 1 — письмо получено: в Верону, к мессеру Альдригетто;
//   2 — спасти Тебальдо из тюрьмы замка Сан-Пьетро (срок — 20 дней);
//   3 — Тебальдо на свободе: вернуться к отцу; 4 — исполнено;
//   8 — не успел (или отказался); 9 — выдал семью Эццелино.
// Пути: в сюрко людей Эццелино — через ворота; силой — штурмом;
// тайно — через старый римский сток к Адидже, ночью; или донести самому тирану.

const VERONA_FAME = 40, VERONA_DAYS = 20;

const VERONA_TEXT = {
  1: 'Гонец принёс письмо от мессера Альдригетто, родича графов Сан-Бонифачо: он просит о встрече в Вероне — тайно, по делу жизни и смерти.',
  2: 'Тебальдо, сын мессера Альдригетто, в тюрьме замка Сан-Пьетро в Вероне. Эццелино казнит его через {days}. Вызволить: в сюрко людей Эццелино — через ворота, силой — или найти тайный ход.',
  3: 'Тебальдо на свободе. Вернуться к мессеру Альдригетто в Верону.',
};

function veronaStage() { const p = G.player; p.story = p.story || {}; return p.story.verona || 0; }
function veronaCity() { return G.over.cities.find(c => c.id === 'verona'); }
function dayCount(n) { const a = n % 100, b = n % 10; return `${n} ${a > 10 && a < 20 ? 'дней' : b === 1 ? 'день' : b >= 2 && b <= 4 ? 'дня' : 'дней'}`; }
function veronaLeft() { return Math.max(0, (G.player.story.veronaDue || 0) - timeInfo().day); }

function setVerona(n) {
  const p = G.player;
  p.story.verona = n;
  let q = p.quests.find(q => q.id === 'verona');
  if (n >= 4) { p.quests = p.quests.filter(x => x !== q); return; }
  if (!q) {
    q = { id: 'verona', type: 'story', label: 'Узник Эццелино', need: 1, have: 0, reward: 0, xp: 0, done: false, day: timeInfo().day,
      giverName: 'Мессер Альдригетто', fromName: 'Верона' };
    p.quests.push(q);
  }
  q.text = VERONA_TEXT[n].replace('{days}', dayCount(veronaLeft()));
}

// Срок вышел — Тебальдо казнён.
function veronaCheck() {
  const p = G.player;
  if (veronaStage() !== 2) return;
  if (timeInfo().day <= (p.story.veronaDue || Infinity)) { setVerona(2); return; }   // обновить срок в журнале
  setVerona(8);
  p.quests = p.quests.filter(q => q.id !== 'verona');
  log('Из Вероны приходит весть: на рассвете у Арены люди Эццелино казнили Тебальдо, сына мессера Альдригетто. Ты не успел.', C.red);
  chronicle('Не успел спасти Тебальдо из тюрьмы Эццелино — его казнили в Вероне.', 'quest');
  addNews({ day: timeInfo().day, text: 'В Вероне у Арены казнили молодого Тебальдо из рода Сан-Бонифачо. Эццелино велел оставить тело на три дня.',
    x: veronaCity().x, y: veronaCity().y, tag: 'war' });
}

HISTORIC['Эццелино да Романо'] = {
  full: 'Эццелино III да Романо', years: '1194 — 1259',
  text: 'Синьор Марки Тревизо, зять и викарий императора Фридриха II. С 1236 года правил Вероной, затем Виченцой и Падуей. '
    + 'Изгнал из Вероны гвельфов во главе с графами Сан-Бонифачо, наполнил тюрьмы Падуи и Вероны знатными пленниками; '
    + 'хронисты называли его самым жестоким тираном своего века. В 1256 году папа объявил против него крестовый поход; '
    + 'в 1259-м, раненный и взятый в плен при Кассано, он умер, отказавшись от лечения и причастия.',
};

// ─── Гонец ─────────────────────────────────────────────────────────

// Прославленного героя находит гонец — в любом городе, кроме самой Вероны.
function veronaMessenger(city) {
  const p = G.player;
  if (veronaStage() !== 0 || fameOf() < VERONA_FAME || city.id === 'verona' || city.kind === 'pagan' || city.kind === 'monastery') return null;
  if (landmass(city.region) !== 'mainland' || FOREIGN_REGIONS.includes(city.region)) return null;
  const v = G.world.villages[0];
  if (!v) return null;
  return { kind: 'npc', role: 'guard', special: 'verona', verona: 'messenger', name: 'Гонец', title: 'Гонец из Вероны', village: v,
    female: false, glyph: '@', color: '#70b0f0', portrait: 'armed_sword', x: p.x, y: p.y,
    greeting: 'Ты ли тот, о ком поют в тавернах? Тогда это тебе. Я скакал четыре дня. Письмо от мессера Альдригетто из Вероны — '
      + 'читай здесь и не показывай никому.' };
}

// ─── Люди квеста в Вероне ──────────────────────────────────────────

const VERONA_PEOPLE = {
  father: { name: 'Мессер Альдригетто', title: 'Родич графов Сан-Бонифачо', portrait: 'noble_m1', from: 1, to: 3, at: [-10, 3],
    greeting: 'Говори тише. В этом городе у стен есть уши, а у ушей — жалованье от Эццелино.' },
  ezzelino: { name: 'Эццелино да Романо', title: 'Викарий императора', portrait: 'ezzelino', from: 2, to: 2, at: [8, -2],
    greeting: 'Ты стоишь перед Эццелино. Говори, зачем пришёл, — и думай, прежде чем говорить. Многие думали после. Недолго.' },
};

function veronaEnter(world, city) {
  veronaCheck();
  if (city.id !== 'verona') return;
  const st = veronaStage(), v = world.villages[0];
  // Предавших — нет: отца схватили.
  for (const [id, d] of Object.entries(VERONA_PEOPLE)) {
    const here = st >= d.from && st <= d.to && !(id === 'father' && st === 9);
    const old = v.npcs.find(n => n.verona === id);
    if (!here) { if (old) { v.npcs = v.npcs.filter(n => n !== old); world.actors = world.actors.filter(a => a !== old); } continue; }
    if (old) continue;
    const home = { x: v.cx + d.at[0] - 4, y: v.cy + d.at[1] - 2, w: 9, h: 5, building: -1 };
    const spot = findFreeIn(world, home) || findFreeIn(world, { x: v.x0, y: v.y0, w: v.w, h: v.h, building: -1 });
    if (!spot) continue;
    const npc = makeNpc('noble', v, home, spot[0], spot[1]);
    Object.assign(npc, { name: d.name, title: d.title, female: false, greeting: d.greeting, special: 'verona', verona: id, portrait: d.portrait,
      color: id === 'ezzelino' ? '#c04040' : '#e0d0a0' });
    v.npcs.push(npc);
    world.actors.push(npc);
  }
}

// Прочим веронцам — свои пункты (расспросы о замке, сюрко у трактирщика).
function veronaExtraOptions(npc) {
  const p = G.player, opts = [];
  if (veronaStage() !== 2 || !npc.village || npc.village.city.id !== 'verona' || npc.special) return opts;
  if (!p.story.veronaSewer && !npc.veronaAsked && ['peasant', 'boatman', 'innkeeper', 'merchant', 'smith'].includes(npc.role))
    opts.push({ label: 'Расспросить о замке Сан-Пьетро', act: () => veronaAsk(npc) });
  if (npc.role === 'innkeeper' && !hasItem('ezz_surcoat')) {
    const price = p.priceBuy(35);
    opts.push({ label: `Выкупить сюрко у пьяного латника Эццелино (${price} мон.)`, act: () => {
      if (p.coins < price) return 'Латник смотрит на твои медяки и смеётся: «За это? Я в нём на смотр хожу». Денег не хватает.';
      p.coins -= price;
      p.bag.push(makeItem('ezz_surcoat'));
      return 'В углу остерии пьёт латник с чёрным орлом Эццелино на груди. Ты подсаживаешься, заказываешь вина — и через час он, '
        + 'проигравшись тебе в кости, отдаёт сюрко в залог. «Завтра выкуплю», — бормочет он. Не выкупит. (Сюрко — в котомке.)';
    } });
    opts.push({ label: 'Стащить сюрко, пока латник спит (скрытность)', act: () => {
      const ok = rng.chance(0.35 + skillLevel(p, 'stealth') * 0.08 + (p.stats.dex - 5) * 0.03);
      trainSkill(p, 'stealth', 3);
      if (ok) { p.bag.push(makeItem('ezz_surcoat')); return 'Латник храпит, уронив голову на стол. Ты стягиваешь с лавки его сюрко с чёрным орлом и выходишь, не оглядываясь. (Сюрко — в котомке.)'; }
      veronaSuspicion(2);
      return 'Латник вскидывается: «Держи вора!» Ты успеваешь выскочить за дверь, но тебя видели. По городу пойдут разговоры.';
    } });
  }
  return opts;
}

// Расспросы: кто-то вспомнит старый сток, кто-то донесёт.
function veronaAsk(npc) {
  const p = G.player;
  npc.veronaAsked = true;
  passTime(30);
  trainSkill(p, 'speech', 2);
  const chance = (npc.role === 'boatman' ? 0.55 : 0.25) + skillLevel(p, 'speech') * 0.06;
  if (rng.chance(chance)) {
    p.story.veronaSewer = true;
    log('Теперь ты знаешь тайный путь в тюрьму Сан-Пьетро: старый римский сток от Адидже.', C.gold);
    return '«…Под замком есть сток — ещё римский. Выходит к реке у самой воды, за камышом. Решётку там лет десять как съела ржа. '
      + 'Мы мальчишками лазили — до самых подвалов. Ночью стража спит. Только я тебе ничего не говорил».';
  }
  veronaSuspicion(1);
  return rng.pick(['«Замок как замок. А тебе зачем? …Не спрашивай больше никого. За такие вопросы у Эццелино отрезают язык».',
    '«Не знаю и знать не хочу. У меня дети».', '«Тише ты! Видишь того в сером? Он слушает. Уходи».']);
}

function veronaSuspicion(n) {
  const p = G.player;
  p.story.veronaSusp = (p.story.veronaSusp || 0) + n;
  if (p.story.veronaSusp >= 4 && !p.story.veronaWatched) {
    p.story.veronaWatched = true;
    log('В Вероне заговорили о чужаке, что выспрашивает про тюрьму. Стражу в Сан-Пьетро, верно, удвоят.', C.orange);
  }
}

// ─── Разговоры ─────────────────────────────────────────────────────

function veronaOptions(npc) {
  const p = G.player, st = veronaStage(), opts = [];
  switch (npc.verona) {
    case 'messenger':
      opts.push({ label: 'Прочесть письмо', act: () => {
        setVerona(1);
        chronicle('Гонец из Вероны принёс письмо от мессера Альдригетто.', 'quest');
        return '«Тому, о чьей доблести говорят от Генуи до Венеции, — привет от Альдригетто, родича графов Сан-Бонифачо. '
          + 'Беда в моём доме, и ни один веронец не смеет мне помочь. Приезжай в Верону. Спроси обо мне — тебя проведут. '
          + 'Награда будет достойной. Сожги это письмо». Гонец уже в седле.';
      } });
      opts.push({ label: 'Мне не до чужих бед', act: () => {
        setVerona(8);
        p.quests = p.quests.filter(q => q.id !== 'verona');
        return 'Гонец молча забирает письмо, кивает и уезжает. Больше ты о нём не услышишь.';
      } });
      return opts;

    case 'father':
      if (st === 1) opts.push({ label: 'Я получил ваше письмо', act: () => {
        p.story.veronaDue = timeInfo().day + VERONA_DAYS;
        setVerona(2);
        veronaPrison();
        chronicle('Взялся вызволить Тебальдо, сына мессера Альдригетто, из тюрьмы Эццелино.', 'quest');
        return 'Старик запирает дверь. «Мой старший, Тебальдо, вёз письма графу в Мантую. Его взяли у ворот. Он в тюрьме замка Сан-Пьетро, '
          + `за рекой. Эццелино обещал повесить его у Арены — через ${dayCount(VERONA_DAYS)}, в назидание. `
          + 'Люди Эццелино пьют в остерии — у иного можно выменять сюрко с чёрным орлом и войти в ворота как свой. '
          + 'Старые лодочники на Адидже помнят ходы под стенами — расспроси, но осторожно. А есть у тебя крепкая рука — что ж… '
          + 'Спаси моего сына. Я отдам всё, что у меня осталось».';
      } });
      if (st === 2) opts.push({ label: 'Что известно о тюрьме?', act: () =>
        `«Замок Сан-Пьетро — на холме за Адидже. Там тюремщики Эццелино и их начальник, Гуэцелло, — зверь, а не человек. `
        + `Ключи от камер у него в караульной. У Тебальдо осталось ${dayCount(veronaLeft())}».` });
      if (st === 3) opts.push({ label: 'Ваш сын свободен', act: () => veronaReward() });
      opts.push({ label: 'Уйти', act: () => null });
      return opts;

    case 'ezzelino':
      opts.push({ label: 'Кто ты, мессер?', act: () => '«Меня зовут по-разному. Монахи — сыном дьявола, император — сыном. '
        + 'Я держу Верону, Падую и Виченцу, потому что никто больше не может их удержать. Порядок стоит крови. Её у меня в достатке — чужой».' });
      if (st === 2) opts.push({ label: 'Донести: Сан-Бонифачо готовят побег Тебальдо', act: () => veronaBetray() });
      opts.push({ label: 'Уйти', act: () => null });
      return opts;

    case 'son':
      opts.push({ label: 'Я от твоего отца. Идём!', act: () => {
        const w = G.world;
        w.prison.freed = true;
        w.actors = w.actors.filter(a => a !== npc);
        log('Тебальдо идёт следом, держась в тени. Выведи его — к воротам или в сток.', C.gold);
        return '«От отца? Господи… Я уж думал, меня повесят раньше, чем кто-то вспомнит». Он поднимается, шатаясь, — две недели на воде и хлебе. '
          + '«Я пойду за тобой. Если нас схватят — меня не отдавай живым».';
      } });
      opts.push({ label: 'Подожди, ещё не время', act: () => null });
      return opts;

    case 'prisoner':
      opts.push({ label: 'Кто ты?', act: () => npc.story });
      opts.push({ label: 'Уйти', act: () => null });
      return opts;
  }
  return [{ label: 'Уйти', act: () => null }];
}

function veronaReward() {
  const p = G.player;
  setVerona(4);
  p.coins += 250;
  p.gainXp(150);
  addFame(10, 'вызволил Тебальдо Сан-Бонифачо из тюрьмы Эццелино');
  p.bag.push(makeItem('bonifacio_ring'));
  p.story.ezzelinoFoe = true;
  chronicle('Вызволил Тебальдо из тюрьмы Эццелино и вернул его отцу. Мессер Альдригетто отдал перстень своего рода.', 'quest');
  log('Получено: 250 мон., 150 опыта, перстень Сан-Бонифачо.', C.gold);
  return 'Старик обнимает сына так, будто держит его в последний раз. Потом развязывает кошель и снимает с пальца перстень. '
    + '«Это перстень нашего рода. Покажи его любому гвельфу от Мантуи до Болоньи — тебя примут как родного. '
    + 'Тебальдо уйдёт к графу в Мантую этой же ночью. А тебе — уезжай из Вероны. Эццелино не прощает».';
}

function veronaBetray() {
  const p = G.player, w = G.world;
  setVerona(9);
  p.quests = p.quests.filter(q => q.id !== 'verona');
  p.coins += 200;
  p.gainXp(60);
  addPiety(-10, 'Ты предал тех, кто просил о помощи.');
  p.story.ezzelinoFriend = true;
  chronicle('Выдал Эццелино да Романо мессера Альдригетто и его замысел. Тебальдо казнён.', 'quest');
  addNews({ day: timeInfo().day, text: 'В Вероне схватили мессера Альдригетто из рода Сан-Бонифачо. Его сына казнили у Арены, самого — бросили в Сан-Пьетро.',
    x: veronaCity().x, y: veronaCity().y, tag: 'war' });
  // Отца уводят.
  for (const v of w.villages) {
    const f = v.npcs.find(n => n.verona === 'father');
    if (f) { v.npcs = v.npcs.filter(n => n !== f); w.actors = w.actors.filter(a => a !== f); }
  }
  log('Получено: 200 мон. Люди Эццелино уже идут за мессером Альдригетто.', C.gold);
  return 'Эццелино долго смотрит на тебя — без улыбки. «Ты пришёл сам. Это разумно». Он бросает тебе кошель. '
    + '«Альдригетто возьмут до заката. Мальчишку повесят завтра — оба увидят друг друга в последний раз. '
    + 'А ты… Мне нужны люди, которые понимают, где сила. Приходи ещё». Ты выходишь. За спиной кто-то уже отдаёт приказы.';
}

// ─── Тюрьма замка Сан-Пьетро ───────────────────────────────────────

// Место на карте — рядом с Вероной, за рекой.
function veronaPrison() {
  const p = G.player, ow = G.over, v = veronaCity();
  let site = ow.sites.find(s => s.id === 'verona_prison');
  if (site) return site;
  let spot = null;
  for (let r = 1; r < 4 && !spot; r++)
    for (const [dx, dy] of DIRS8) {
      const x = v.x + dx * r, y = v.y + dy * r;
      if (ow.passable(x, y) && !ow.placeAt(x, y) && dy <= 0) { spot = [x, y]; break; }
    }
  spot = spot || [v.x + 1, v.y - 1];
  site = { id: 'verona_prison', name: 'Тюрьма замка Сан-Пьетро', glyph: '#', color: '#a04040', x: spot[0], y: spot[1],
    region: v.region, terrain: ow.get(spot[0], spot[1]), type: 'site', prison: true, quest: true,
    desc: 'Серые стены замка Сан-Пьетро над Адидже. Над воротами — чёрный орёл Эццелино.' };
  ow.sites.push(site);
  ow.places.set(ow.idx(site.x, site.y), site);
  log(`На карте отмечено: ${site.name}.`, C.gold);
  return site;
}

// Подход к тюрьме: как войти.
function veronaPrisonApproach(site) {
  const p = G.player, st = veronaStage();
  if (st !== 2) {
    log(st >= 3 ? 'Серые стены Сан-Пьетро. Тебе здесь больше нечего делать — и лучше не попадаться на глаза страже.' : site.desc, C.dim);
    return;
  }
  veronaCheck();
  if (veronaStage() !== 2) return;
  const opts = [];
  if (hasItem('ezz_surcoat')) opts.push({ label: 'Надеть сюрко с чёрным орлом и войти в ворота как свой', act: () => enterPrison('disguise') });
  if (p.story.veronaSewer) opts.push({ label: `Пробраться через старый римский сток${isNight() ? '' : ' (днём стража не спит — лучше ночью)'}`, act: () => enterPrison('sewer') });
  opts.push({ label: 'Штурм: перелезть стену у ворот и пробиваться силой', act: () => enterPrison('storm') });
  opts.push({ label: 'Уйти', act: () => {} });
  pushScreen(new ChoiceScreen(`${site.name}. Тебальдо казнят через ${dayCount(veronaLeft())}.`, opts));
}

const PRISONERS = [
  'Я писарь из Падуи. Переписал не ту грамоту. Третий год здесь — или четвёртый. Свечей нам не дают.',
  'Моего брата увели на прошлой неделе. Наверх. Оттуда не возвращаются.',
  'Ты не тюремщик. Тюремщики так не смотрят. Беги отсюда, пока можешь.',
  'Я торговал сукном и был должен не тому человеку. Теперь я должен Эццелино — жизнь.',
  'Помолись за меня, добрый человек. Здесь даже священника нет.',
];

function enterPrison(mode) {
  const p = G.player, site = veronaPrison(), night = isNight();
  if (G.mode === 'local') leaveLocal();
  const W = 72, H = 31, w = new World(W, H);
  w.kind = 'dungeon'; w.depth = 0; w.region = site.region; w.placeKey = 'verona_prison';
  w.site = { ...site, depth: 1, name: site.name };
  w.prison = { mode, alarm: mode === 'storm', freed: false };
  const F = T.CRYPTFLOOR;
  w.tiles.fill(T.CRYPTWALL);
  const carve = (x0, y0, x1, y1, t = F) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) w.set(x, y, t); };
  carve(1, 14, 66, 16);                 // ворота и главный ход
  w.set(1, 15, T.STAIRS_UP);            // ворота
  carve(6, 7, 17, 12);                  // караульная
  w.set(11, 13, T.DOOR);
  w.set(11, 9, T.TABLE); w.set(12, 9, T.TABLE); w.set(6, 7, T.RACK); w.set(17, 7, T.BARREL); w.set(6, 12, T.BED); w.set(17, 12, T.BED);
  const cells = [];
  for (let k = 0; k < 8; k++) {
    const x0 = 22 + k * 5;
    carve(x0, 9, x0 + 2, 12); w.set(x0 + 1, 13, T.LOCKED); cells.push({ door: [x0 + 1, 13], at: [x0 + 1, 10] });
    carve(x0, 18, x0 + 2, 21); w.set(x0 + 1, 17, T.LOCKED); cells.push({ door: [x0 + 1, 17], at: [x0 + 1, 20] });
  }
  // Старый римский сток: от конца хода — к реке.
  w.set(67, 15, T.DOOR);
  carve(68, 15, 69, 28, T.MARSH);
  w.set(69, 28, T.STAIRS_UP);
  const sewerIn = [68, 27];
  // Ключи от камер — в караульной, на столе у начальника.
  const sonCell = rng.pick(cells);
  w.addItem(12, 10, { kind: 'key', lock: w.idx(...sonCell.door), name: 'Связка тюремных ключей' });
  for (const c of cells) if (c !== sonCell) w.addItem(13, 10, { kind: 'key', lock: w.idx(...c.door), name: 'Ключ' });
  // Узники.
  const village = { city: veronaCity(), npcs: [] };
  const npcAt = (x, y, o) => ({ kind: 'npc', role: 'peasant', x, y, energy: 0, glyph: '@', village, female: false, special: 'verona',
    home: { x, y, w: 1, h: 1, building: -1 }, ...o });
  w.actors.push(npcAt(sonCell.at[0], sonCell.at[1], { verona: 'son', name: 'Тебальдо', title: 'Узник', color: '#f0e0a0', portrait: 'armed_sword',
    greeting: '«Кто здесь?.. Если ты пришёл за мной на виселицу — я пойду сам. Если нет — говори скорее».' }));
  rng.shuffle(cells.filter(c => c !== sonCell)).slice(0, 4).forEach((c, i) => w.actors.push(npcAt(c.at[0], c.at[1],
    { verona: 'prisoner', name: 'Узник', title: 'Узник', color: '#a09080', portrait: i % 2 ? 'peasant_m2' : 'peasant_m3',
      greeting: '«…Воды. Или хоть слова человеческого».', story: `«${PRISONERS[i % PRISONERS.length]}»` })));
  // Стража: начальник в караульной, тюремщики по ходу. Ночью почти все спят.
  const extra = p.story.veronaWatched ? 2 : 0, asleep = mode === 'sewer' && night;
  const guards = [makeBeast('prison_warden', 11, 11)];
  const n = (mode === 'storm' ? 5 : 4) + extra;
  for (let k = 0; k < n; k++) {
    const spot = k < 2 ? [8 + k * 6, 8 + k * 2] : [rng.int(20, 62), rng.int(14, 16)];
    if (!w.walkable(...spot) || w.actorAt(...spot)) continue;
    guards.push(makeBeast('jailer', spot[0], spot[1]));
  }
  guards.forEach((m, k) => {
    if (asleep && k !== guards.length - 1) m.sleep = true;   // один не спит — обходит ходы
    if (mode === 'storm') { m.provoked = true; }
    w.actors.push(m);
  });
  const start = mode === 'sewer' ? sewerIn : [2, 15];
  w.explored.fill(mode === 'disguise' ? 1 : 0);
  placePlayer(w, start[0], start[1]);
  log({
    disguise: 'Ты накидываешь сюрко с чёрным орлом. «Новенький? Из Падуи?» — «Из Падуи». Стражник у ворот машет рукой: проходи. '
      + 'Держись уверенно и не задерживайся рядом с тюремщиками.',
    sewer: night ? 'Ты пробираешься по колено в нечистотах. Ржавая решётка поддаётся. Наверху — тишина и храп: стража спит. Не шуми.'
      : 'Ты пробираешься по стоку. Наверху слышны шаги и голоса: днём здесь не спят. Будь осторожен.',
    storm: 'Ты переваливаешься через стену у ворот. «Тревога! К оружию!» — кричат со двора. Пути назад нет.',
  }[mode], mode === 'storm' ? C.red : C.violet);
  if (mode === 'sewer' && !night) w.prison.dayRisk = true;
  refreshFov();
}

// Стража тюрьмы: в маскировке — не трогают, ночью — спят. Тревога — и все идут на тебя.
function prisonAlarm(why) {
  const w = G.world, p = G.player;
  if (!w.prison || w.prison.alarm) return;
  w.prison.alarm = true;
  if (w.prison.mode !== 'storm') G.player.story.veronaWatched = true;
  log(why || '«Тревога! Чужой в тюрьме!»', C.red);
  for (const a of w.actors) if (a.kind === 'beast') { a.sleep = false; a.provoked = true; a.target = [p.x, p.y]; }
}

function prisonGuard(m, dd) {
  const w = G.world, pr = w.prison, p = G.player;
  if (pr.alarm) return false;
  if (m.provoked || m.hp < m.maxHp) { prisonAlarm(); return false; }
  const sees = w.isVisible(m.x, m.y);
  if (pr.mode === 'disguise') {
    // Тюремщики присматриваются к тем, кто рядом; к тому, кто уводит узника, — тем более.
    const risk = dd <= 1 ? (m.def === BEASTS.prison_warden ? 0.1 : 0.04) * (pr.freed ? 2.5 : 1) * (p.story.veronaWatched ? 1.5 : 1)
      - skillLevel(p, 'speech') * 0.004 : 0;
    if (risk > 0 && rng.chance(risk)) { prisonAlarm('Тюремщик вглядывается тебе в лицо: «А ты кто такой? Я тебя не знаю! Тревога!»'); return false; }
    if (rng.chance(0.25)) randomStep(w, m, beastCanEnter);
    return true;
  }
  if (m.sleep) {
    const wake = sees && dd <= 3 ? Math.max(0.01, 0.06 - skillLevel(p, 'stealth') * 0.006) : 0;
    if (rng.chance(wake)) prisonAlarm('Тюремщик ворочается, открывает глаза — и видит тебя. «Тревога!»');
    return true;
  }
  // Бодрствующий караульный обходит ход; заметил — поднимает тревогу.
  const sight = Math.max(2, (pr.dayRisk ? 7 : 5) - Math.floor(skillLevel(p, 'stealth') / 2));
  if (sees && dd <= sight) { prisonAlarm('«Кто там?!» — караульный вскидывает факел. «Тревога! Побег!»'); return false; }
  if (rng.chance(0.5)) randomStep(w, m, beastCanEnter);
  return true;
}

// Запертая камера: в сюрко тюремщик сам отопрёт; иначе — ключ или ломать (шумно).
function prisonLock(x, y) {
  const w = G.world, pr = w.prison;
  if (!pr) return false;
  const p = G.player;
  p.keys = p.keys || [];
  if (p.keys.some(k => k.place === w.placeKey && k.lock === w.idx(x, y))) return false;   // обычный путь — ключом
  if (pr.mode === 'disguise' && !pr.alarm) {
    if (rng.chance(0.75 + skillLevel(p, 'speech') * 0.03)) {
      w.set(x, y, T.DOOR);
      log('«Велено привести узника наверх», — бросаешь ты ближайшему тюремщику. Тот, зевая, отпирает решётку.', C.gold);
    } else prisonAlarm('«Наверх? Без приказа Гуэцелло? Постой-ка…» — тюремщик хватается за меч. «Тревога!»');
    endTurn();
    return true;
  }
  if (rng.chance(0.1 + p.stats.str * 0.03)) {
    w.set(x, y, T.DOOR);
    log('Ты выламываешь решётку. Грохот разносится по всем подвалам.', C.orange);
  } else log('Решётка не поддаётся. Ключи — в караульной. Можно ломать дальше, но это шумно.', C.dim);
  if (!pr.alarm && rng.chance(0.6)) prisonAlarm('На грохот сбегаются тюремщики. «Тревога!»');
  endTurn();
  return true;
}

// Выход: ворота или сток.
function prisonExit() {
  const w = G.world, pr = w.prison;
  const freed = pr.freed;
  leaveLocal();
  G.ox = w.site.x; G.oy = w.site.y;
  if (freed && veronaStage() === 2) {
    setVerona(3);
    addFame(4, 'вывел узника из тюрьмы Эццелино');
    log(pr.alarm ? 'Вы вырываетесь из Сан-Пьетро под крики погони и уходите переулками к реке. Тебальдо жив.'
      : 'Вы уходите так же тихо, как пришли. Утром тюремщики найдут пустую камеру. Тебальдо жив.', C.gold);
    chronicle(`Вывел Тебальдо из тюрьмы Сан-Пьетро${{ disguise: ' в сюрко людей Эццелино', sewer: ' через римский сток', storm: ' силой' }[pr.mode]}.`, 'quest');
  } else if (pr.alarm) log('Ты уходишь из Сан-Пьетро ни с чем. Теперь стража настороже.', C.orange);
  else log('Ты покидаешь Сан-Пьетро.', C.dim);
}
