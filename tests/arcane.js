// Прогон алхимии и герметики: npm run arcane. Путь игрока от нуля, замеры и поиск ошибок.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 820 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await pg.goto('file://' + require('path').resolve(__dirname, '..', 'index.html') + '');
  await pg.addScriptTag({ path: require('path').resolve(__dirname, 'helpers.js') });
  const out = await pg.evaluate(async () => {
    const R = { bugs: [], notes: [] }, bug = (m) => R.bugs.push(m);
    const TXT = /undefined|NaN|\[object|null\b/;
    const chk = (src, s) => { if (typeof s === 'string' && TXT.test(s)) bug(`${src}: ${s.slice(0, 160)}`); };
    window.log = ((orig) => (t, c) => { chk('лог', t); return orig(t, c); })(window.log);

    // ── 1. Сколько алхимиков на карте (по 20 мирам) и как далеко от старта ──
    const alc = [], far = [];
    for (let s = 0; s < 20; s++) {
      TH.start();
      const list = G.over.cities.filter(c => alchemistIn(c));
      alc.push(list.length);
      far.push(Math.min(...list.map(c => Math.round(Math.hypot((c.x - G.ox) * GEO.kmX, (c.y - G.oy) * GEO.kmY)))));
    }
    R.alchemists = { min: Math.min(...alc), max: Math.max(...alc), avg: (alc.reduce((a, b) => a + b) / alc.length).toFixed(1),
      nearestKm: { min: Math.min(...far), max: Math.max(...far), avg: Math.round(far.reduce((a, b) => a + b) / far.length) } };

    // ── 2. Травы по месяцам: сколько и каких за 10 вылазок в глушь ──
    const p0 = TH.start(); TH.immortal();
    R.herbs = {};
    for (const m of [1, 3, 5, 7, 9, 11]) {
      G.minutes = 0; while (today().m !== m) G.minutes += 1440 * 5;
      if (G.mode === 'local') leaveLocal();
      let n = 0; const kinds = {};
      for (let i = 0; i < 10; i++) {
        G.ox = rng.int(10, G.over.w - 10); G.oy = rng.int(10, G.over.h - 10);
        if (!G.over.passable(G.ox, G.oy)) { i--; continue; }
        enterWild(false);
        for (const [, l] of G.world.items) for (const it of l) if (it.kind === 'herb') { n++; kinds[it.name] = (kinds[it.name] || 0) + 1; }
        leaveLocal();
      }
      R.herbs[m] = `${n} трав: ` + Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(', ');
    }

    // ── 3. Путь ученика: грамота → алхимик → инструменты → варка ──
    const p = TH.start(); TH.immortal();
    p.coins = 4000; p.base.wis = 7;
    const rome = TH.city('rome'); TH.go(rome);
    const pr = TH.npc('priest');
    let lessons = 0;
    while (skillLevel(p, 'letters') < 2 && lessons < 30) { p.lessonDay = -1; TH.ask(pr, 'Поучиться грамоте'); lessons++; }
    R.letters = `до грамоты 2: ${lessons} уроков (дней), ${lessons * p.priceBuy(4)} мон.`;
    const ac = G.over.cities.find(c => alchemistIn(c));
    TH.go(ac);
    const al = G.world.villages[0].npcs.find(n => n.role === 'alchemist');
    if (!al) bug('алхимик не пришёл в ' + ac.name);
    const opts0 = TH.options(al); opts0.forEach(o => chk('пункт алхимика', o));
    // Разговоры алхимика.
    for (let i = 0; i < 4; i++) { chk('алхимик', TH.ask(al, 'Чем ты занят')); chk('алхимик', TH.ask(al, 'Что нового')); }
    TH.ask(al, 'Научи');
    if (!knowsAlchemy()) bug('не научился');
    const recipeOpts = TH.options(al).filter(o => o.startsWith('Рецепт'));
    R.recipeShop = recipeOpts;
    const tr = new TradeScreen(al);
    tr.html && tr.html();
    for (const r of tr.rows(0)) chk('лавка алхимика', r.label + ' ' + r.price);
    for (const name of ['Ступка', 'Медный', 'Перегонный']) { const r = tr.rows(0).find(x => x.label.startsWith(name)); if (r) r.buy(1); else bug('нет в лавке: ' + name); }
    for (const id of Object.keys(RECIPES)) if (!knowsRecipe(id)) { const lab = TH.options(al).find(o => o.startsWith('Рецепт: ' + RECIPES[id].name.toLowerCase())); if (lab) TH.ask(al, lab); }
    R.recipesKnown = Object.keys(p.recipes).length + ' из ' + Object.keys(RECIPES).length;
    R.costLearn = 4000 - p.coins;

    // Варка: по 40 раз каждое зелье на уровнях навыка 0/3/6 — фактическая удача.
    const give = (id, n) => { if (GOODS[id]) p.goods[id] = (p.goods[id] || 0) + n; else { const h = id.slice(5); p.trophies[id] = p.trophies[id] || { name: HERBS[h].name, value: HERBS[h].value, count: 0 }; p.trophies[id].count += n; } };
    R.brew = {};
    for (const lvl of [0, 3, 6]) {
      p.skills.alchemy = { lvl, xp: 0 };
      const row = [];
      for (const [id, r] of Object.entries(RECIPES)) {
        let ok = 0, doses = 0;
        for (let i = 0; i < 60; i++) {
          r.need.forEach(x => give(x, 1));
          p.skills.alchemy.lvl = lvl; p.skills.alchemy.xp = 0;
          const b0 = brewCount(p, id), res = brew(r.tool, r.need.slice());
          if (res.ok) { ok++; doses += brewCount(p, id) - b0; }
          chk('варка', res.text);
        }
        row.push(`${r.name} ${Math.round(ok / 60 * 100)}% (${(doses / Math.max(1, ok)).toFixed(2)} порц.)`);
      }
      R.brew[lvl] = row.join(' · ');
    }
    // Сколько варок до уровней навыка.
    p.skills.alchemy = { lvl: 0, xp: 0 };
    let brews = 0; const at = {};
    while (skillLevel(p, 'alchemy') < 6 && brews < 2000) {
      give('herb_plantain', 1); give('herb_sage', 1); brew('kettle', ['herb_plantain', 'herb_sage']); brews++;
      at[skillLevel(p, 'alchemy')] = at[skillLevel(p, 'alchemy')] || brews;
    }
    R.alchemyGrowth = Object.entries(at).map(([l, n]) => `${l} ур. — ${n}`).join(', ');
    // Экономика: себестоимость зелий из купленных трав против цены отвара.
    TH.go(TH.city('florence'));
    const hb = new TradeScreen(TH.npc('herbalist'));
    const herbPrice = id => (hb.rows(0).find(r => r.label.startsWith(HERBS[id.slice(5)].name)) || {}).price;
    R.cost = Object.entries(RECIPES).map(([id, r]) => `${r.name}: ${r.need.reduce((s, x) => s + (x === 'wine' ? 8 : herbPrice(x) || 0), 0)} мон.`).join(', ')
      + ` · отвар у травницы ${p.priceBuy(POTION_PRICE)}`;
    // Продажа трав.
    const sell = hb.rows(1).filter(r => r.trophy && r.trophy.startsWith('herb_')).map(r => `${r.label} ${r.price}`);
    R.herbSell = sell.slice(0, 4).join(', ');
    // Окно алхимии: все состояния без ошибок; клавиши.
    const a = new AlchemyScreen(); pushScreen(a);
    try {
      chk('окно', a.html());
      for (const k of ['Digit1', 'Digit2', 'Digit3', 'ArrowDown', 'Enter', 'Enter', 'Enter', 'Backspace', 'Space', 'ArrowUp', 'Enter', 'Space']) { a.key({ code: k, key: k }); chk('окно', a.html()); }
      for (const id of Object.keys(RECIPES)) { a.fill(id); chk('окно', a.msg); a.run(); chk('окно', a.msg); }
      for (const id of Object.keys(RECIPES)) if (brewCount(p, id)) { chk('выпить', drinkBrew(id)); }
    } catch (e) { bug('окно алхимии: ' + e.message); }
    while (G.screens.length > 1) popScreen();

    // ── 4. Герметика: учитель, часы, все 7 талисманов, операции, благочестие ──
    TH.go(TH.city('lucera'));
    const sage = G.world.villages[0].npcs.find(n => n.teacher);
    for (let i = 0; i < 3; i++) chk('мудрец', TH.ask(sage, 'Расскажи'));
    const piety0 = p.piety = 60;
    TH.ask(sage, 'Научи меня');
    const vit = G.over.cities.find(c => c.siege === 'vittoria');
    TH.go(vit);
    const th = G.world.villages[0].npcs.find(n => n.teacher);
    if (!th) bug('Феодора нет в Виттории'); else { chk('Феодор', TH.ask(th, 'Расскажи')); TH.ask(th, 'Научи своим'); }
    R.ops = Object.keys(p.hermeticOps).join(', ');
    R.seals = 'после двух учителей: ' + Object.keys(p.seals).join(', ');
    p.skills.hermetic = { lvl: 2, xp: 0 };
    TH.go(TH.city('lucera')); const sg0 = G.world.villages[0].npcs.find(n => n.teacher); TH.ask(sg0, 'Открой печать');
    if (parmaSiege()) { TH.go(vit); const th0 = G.world.villages[0].npcs.find(n => n.teacher); TH.ask(th0, 'Открой печать'); }
    p.scrolls = ['seal:venus']; readScrolls();
    R.seals += '; куплены и из трактата: ' + Object.keys(p.seals).join(', ') + ` · денег на всё учение ушло ${4000 - p.coins}`;
    leaveLocal();
    // Резать все печати: ждать часа планеты; погода — как выпадет.
    p.skills.hermetic = { lvl: 1, xp: 0 };
    const start = G.minutes, made = {}, tries = {};
    let waitedCloud = 0;
    for (const k of Object.keys(PLANETS)) learnSeal(k);
    for (let step = 0; step < 24 * 90 && Object.keys(made).length < 7; step++) {
      const k = planetHourAt().planet;
      if (!made[k] && today().wd === planetDay(k)) {
        if (!skyClear()) waitedCloud++;
        else {
          tries[k] = (tries[k] || 0) + 1;
          const n0 = p.bag.length, t = engraveTalisman(k); chk('печать', t);
          if (p.bag.length > n0) made[k] = (G.minutes - start) / 60;
          continue;
        }
      }
      passTime(60); p.fatigue = 10; p.food = 80;
    }
    R.talismans = `${Object.keys(made).length} из 7 за ${Math.round((G.minutes - start) / 1440)} дн. игрового времени (металл ${Object.values(PLANETS).reduce((s, x) => s + x.cost, 0)} мон. за набор без срывов); попыток ${Object.values(tries).reduce((a, b) => a + b, 0)}; часов под тучами ${waitedCloud}; герметика выросла до ${skillLevel(p, 'hermetic')}`;
    R.piety = `благочестие: было ${piety0}, после учения у двоих и всех печатей — ${p.piety}`;
    // Носить 3 талисмана неделю.
    const tals = p.bag.filter(it => it.key && it.key.startsWith('talisman_'));
    ['relic1', 'relic2', 'relic3'].forEach((s, i) => { if (tals[i]) p.equip[s] = tals[i]; });
    const pw = p.piety;
    for (let d = 0; d < 7; d++) { passTime(1440); p.fatigue = 10; p.food = 80; }
    TH.go(TH.city('rome')); new DialogScreen(TH.npc('priest')); new DialogScreen(TH.npc('merchant')); leaveLocal();
    R.pietyWear = `3 талисмана неделю + разговор со священником и купцом: благочестие ${pw} → ${p.piety}`;
    // Свойства талисманов в описании.
    for (const t of tals) chk('талисман', itemStats(t) + ' ' + t.note);
    R.talismanStats = tals.map(t => `${t.name}: ${itemStats(t)}`).join('; ');
    // Операции: шанс и действие.
    const ops = {};
    for (const id of Object.keys(OPERATIONS)) {
      let ok = 0, n = 0;
      for (let i = 0; i < 30; i++) {
        p.fatigue = 10;
        give('herb_stjohn', 1); give('herb_rue', 1); give('herb_wormwood', 1);
        if (id === 'stars') { G.weather = { kind: 'clear', until: G.minutes + 9999 }; while (!isNight()) passTime(60); p.starsDay = 0; }
        if (id === 'bind') { enterWild(false); G.world.actors = G.world.actors.filter(a => a.kind !== 'beast'); TH.spawn('wolf', 3, 0); }
        p.skills.hermetic.lvl = 1;
        const lu = p.lumenUntil, wu = G.wardUntil;
        const t = doOperation(id); chk('операция ' + id, t); n++;
        if (/ничего не происходит/.test(t)) {} else ok++;
        if (G.mode === 'local') leaveLocal();
        p.lumenUntil = 0; G.wardUntil = 0;
      }
      ops[id] = Math.round(ok / n * 100) + '%';
    }
    R.opsChance = JSON.stringify(ops);
    // Окно герметики.
    const hs = new HermeticScreen(); pushScreen(hs);
    try { chk('окно герметики', hs.html()); for (let d = 1; d <= 7; d++) { hs.key({ code: 'Digit' + d, key: String(d) }); chk('окно герметики', hs.html()); } }
    catch (e) { bug('окно герметики: ' + e.message); }
    while (G.screens.length > 1) popScreen();

    // ── 5. Сохранение и загрузка: всё на месте ──
    const snap = { brews: JSON.stringify(p.brews), recipes: JSON.stringify(p.recipes), ops: JSON.stringify(p.hermeticOps), tals: p.bag.filter(it => it.key && it.key.startsWith('talisman_')).length,
      alch: JSON.stringify(p.alchemy), equip: ['relic1', 'relic2', 'relic3'].map(s => p.equip[s] && p.equip[s].name).join(',') };
    // В глуши рядом с бродячим алхимиком.
    enterWild(false); alchemistWild(G.world, true);
    if (!(await saveGame())) bug('не сохраняется в глуши с алхимиком');
    await loadGame(); TH.immortal();
    const q = G.player;
    const snap2 = { brews: JSON.stringify(q.brews), recipes: JSON.stringify(q.recipes), ops: JSON.stringify(q.hermeticOps), tals: q.bag.filter(it => it.key && it.key.startsWith('talisman_')).length,
      alch: JSON.stringify(q.alchemy), equip: ['relic1', 'relic2', 'relic3'].map(s => q.equip[s] && q.equip[s].name).join(',') };
    for (const k of Object.keys(snap)) if (snap[k] !== snap2[k]) bug(`после загрузки ${k}: ${snap[k]} → ${snap2[k]}`);
    const wa = G.world.actors.find(a => a.role === 'alchemist');
    if (!wa) bug('бродячий алхимик пропал после загрузки'); else { try { chk('алхимик после загрузки', TH.ask(wa, 'Чем ты занят')); new TradeScreen(wa).rows(0); } catch (e) { bug('алхимик после загрузки: ' + e.message); } }
    // Город с алхимиком и учитель после сохранения.
    TH.go(ac);
    if (!(await saveGame())) bug('не сохраняется в городе алхимика');
    await loadGame();
    const al2 = G.world.villages[0].npcs.filter(n => n.role === 'alchemist');
    if (al2.length !== 1) bug(`алхимиков в городе после загрузки: ${al2.length}`);
    TH.go(TH.city('lucera')); TH.go(TH.city('lucera'));
    const sg = G.world.villages[0].npcs.filter(n => n.teacher);
    if (sg.length !== 1) bug(`мудрецов в Лючере: ${sg.length}`);
    return R;
  }).catch(e => ({ fatal: e.message }));
  console.log(JSON.stringify(out, null, 1));
  console.log('ошибки страницы:', errs);
  await b.close();
})();
