// Балансный прогон: npm run balance. Не тест, а отчёт: насколько игра лёгкая
// или тяжёлая в разных сценариях. Считает бои (тысячи схваток настоящими
// функциями боя), встречи в пути, выживание и экономику. Пишет таблицы.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'));
  await pg.addScriptTag({ path: require('path').resolve(__dirname, 'helpers.js') });
  const out = await pg.evaluate(() => {
    const R = {};
    window.log = () => {};
    window.chronicle = () => {};
    TH.start();
    const base = { ...G.player.base }, people = G.player.people;

    // ── Профили героя ──
    const PROFILES = [
      { id: 'L1', name: '1 ур., дубина, без доспеха', lvl: 1, sk: 0, gear: ['club'], potions: 2 },
      { id: 'L3n', name: '3 ур., дубина, без доспеха', lvl: 3, sk: 1, gear: ['club'], potions: 2 },
      { id: 'L3', name: '3 ур., топор, стёганка, шлем, баклер', lvl: 3, sk: 1, gear: ['axe', 'gambeson', 'cap', 'buckler'], potions: 2 },
      { id: 'L5', name: '5 ур., меч, кожаный доспех, щит, наносник, наручи', lvl: 5, sk: 2, gear: ['sword', 'leather', 'shield', 'nasal', 'bracers'], potions: 3 },
      { id: 'L8', name: '8 ур., меч, кольчуга, миндалевидный щит, полный доспех', lvl: 8, sk: 4,
        gear: ['sword', 'mail', 'kite', 'nasal', 'mittens', 'chausses', 'boots'], potions: 4 },
    ];
    const gearCost = pr => pr.gear.reduce((s, k) => s + ITEMS[k].value, 0);
    const makeHero = pr => {
      const p = new Player('Б', people, { ...base });
      for (let l = 1; l < pr.lvl; l++) { p.level++; const st = ['str', 'con', 'dex'][(l - 1) % 3]; p.base[st]++; }
      if (p.recalc) p.recalc();
      for (const k of pr.gear) { const it = makeItem(k); const slot = KIND_SLOTS[it.kind][0]; p.equip[slot] = it; }
      p.skills = {};
      for (const k of ['blade', 'axe', 'spear', 'shield', 'armor']) p.skills[k] = { lvl: pr.sk, xp: 0 };
      p.potions = pr.potions;
      p.hp = p.maxHp; p.food = 80; p.fatigue = 10;
      return p;
    };

    // ── Схватка: герой бьёт ближайшего, звери бьют все (быстрые — чаще), отвар при 35% здоровья ──
    TH.go(TH.city('rome')); leaveLocal(); enterWild(false);
    const W = G.world;
    const fight = (pr, group, aim = 'body') => {
      const p = makeHero(pr); G.player = p; p.aim = aim;
      p.trainSkill = null;
      const ms = group.map(k => { const m = makeBeast(k, 0, 0); m.provoked = true; m.wasProvoked = true; m.target = [0, 0]; return m; });
      W.actors = W.actors.filter(a => a.kind !== 'beast');
      ms.forEach(m => W.actors.push(m));
      const alive = () => ms.filter(m => m.hp > 0 && W.actors.includes(m));
      let turns = 0, used = 0;
      for (; turns < 300 && p.hp > 0 && alive().length; turns++) {
        if (p.hp < p.maxHp * 0.35 && p.potions > 0) { p.potions--; used++; p.hp = Math.min(p.maxHp, p.hp + 8 + rng.int(1, 6)); p.poison = 0; }
        else playerAttack(alive()[0]);
        G.turn++;
        for (const m of alive()) {
          m.en = (m.en || 0) + (m.def.speed || 100) / 100;
          if (typeof aimSkipTurn === 'function' && aimSkipTurn(m)) { m.en = Math.min(m.en, 1); continue; }
          while (m.en >= 1 && p.hp > 0) { m.en--; if (m.def.ranged && rng.chance(0.3)) beastRanged(m); else beastAttack(m); }
          if (m.def.regen) m.hp = Math.min(m.maxHp, m.hp + m.def.regen);
        }
        if (p.poison > 0) { p.hp -= 1; p.poison--; }
      }
      return { win: p.hp > 0 && !alive().length, hp: Math.max(0, p.hp) / p.maxHp, turns, used };
    };
    // Смерть зверя в симуляции — без сюжетных последствий: просто убрать.
    window.killBeast = m => { W.actors = W.actors.filter(a => a !== m); };
    const N = 300;
    const sim = (pr, group, aim) => {
      let w = 0, hp = 0, pot = 0;
      for (let i = 0; i < N; i++) { const r = fight(pr, group, aim); if (r.win) { w++; hp += r.hp; } pot += r.used; }
      return { win: Math.round(w / N * 100), hp: w ? Math.round(hp / w * 100) : 0, pot: +(pot / N).toFixed(1) };
    };
    const FIGHTS = [
      ['В пути', [['wolf'], ['wolf', 'wolf'], ['wolf', 'wolf', 'wolf'], ['wild_dog', 'wild_dog'], ['wild_dog', 'wild_dog', 'wild_dog'],
        ['boar'], ['viper'], ['buffalo'], ['bear'], ['brigand', 'brigand'], ['brigand', 'brigand', 'brigand'],
        ['brigand', 'brigand', 'deserter'], ['bandit_lord', 'brigand', 'brigand', 'brigand'], ['imperial_soldier', 'imperial_soldier']]],
      ['Ночь и нечисть', [['ghoul'], ['ghoul', 'ghoul'], ['black_dog'], ['strega'], ['ghost'], ['werewolf'], ['lamia'], ['povodni'], ['drac'], ['drac', 'drac']]],
      ['Звери и дивы чужих земель', [['ibex'], ['salvan'], ['bear', 'wolf'], ['zlatorog']]],
      ['Чудища земель (бродячие)', [['orco'], ['giant'], ['alp_dragon'], ['lindwurm'], ['tarasque']]],
      ['Чудища из книг (порог уровня)', [['amphisbaena'], ['basilisk'], ['griffin'], ['manticore'], ['chimera']]],
      ['Логова (поручения)', [['alpha_wolf', 'wolf', 'wolf'], ['cyclops'], ['mithras_bull'], ['cerberus'], ['great_bear'], ['brigand_chief', 'brigand', 'brigand'], ['orco'], ['werewolf']]],
      ['Подземелья: обитатели', [['skeleton', 'skeleton'], ['lemur', 'larva'], ['etruscan_shade', 'etruscan_shade'], ['grave_robber', 'grave_robber', 'grave_robber'],
        ['cultist', 'cultist'], ['miner_ghost', 'miner_ghost'], ['grotto_crab', 'grotto_crab']]],
      ['Подземелья: хозяева', [['proconsul'], ['charun'], ['necromancer'], ['pater'], ['cult_leader'], ['sea_serpent'], ['mine_spirit'], ['crusader_ghost'], ['hecate_hound'], ['tarantasio'], ['dis_pater']]],
    ];
    R.fights = FIGHTS.map(([title, groups]) => ({ title, rows: groups.filter(g => g.every(k => BEASTS[k])).map(g => {
      const names = {}; g.forEach(k => { names[BEASTS[k].name] = (names[BEASTS[k].name] || 0) + 1; });
      return { foe: Object.entries(names).map(([n, c]) => c > 1 ? `${n} ×${c}` : n).join(' + '), res: PROFILES.map(pr => sim(pr, g)) };
    }) }));
    // Прицел: та же схватка, удары в разные зоны.
    if (typeof AIM_ZONES !== 'undefined') {
      const AIMS = ['body', 'head', 'arms', 'legs'];
      const foes = [['wolf', 'wolf', 'wolf'], ['brigand', 'brigand', 'brigand'], ['bear'], ['imperial_soldier', 'imperial_soldier'], ['orco'], ['proconsul'], ['charun'], ['great_bear']];
      R.aim = [PROFILES[2], PROFILES[3]].map(pr => ({ name: pr.name, rows: foes.filter(g => g.every(k => BEASTS[k])).map(g => ({
        foe: g.map(k => BEASTS[k].name).join(' + '), res: AIMS.map(a => sim(pr, g, a)) })) }));
      // Булава и топор — свои зоны.
      const club = { ...PROFILES[3], gear: ['mace', 'leather', 'shield', 'nasal', 'bracers'] }, axe = { ...PROFILES[3], gear: ['axe', 'leather', 'shield', 'nasal', 'bracers'] };
      R.aimWeapons = [['булава', club], ['топор', axe]].map(([n, pr]) => ({ name: n, res: AIMS.map(a => sim(pr, ['proconsul'], a)) }));
    }
    R.profiles = PROFILES.map(pr => { const p = makeHero(pr); return { name: pr.name, hp: p.maxHp, hit: p.hit, ev: p.ev, armor: p.armor, cost: gearCost(pr) }; });

    // ── Встречи в пути: сколько и кто за сутки дороги ──
    TH.start(); leaveLocal(); TH.immortal();
    const routes = [['milan', 'verona'], ['florence', 'bologna'], ['parma', 'genoa'], ['rome', 'perugia'], ['pisa', 'siena'], ['naples', 'bari'], ['palermo', 'messina'], ['rome', 'naples'],
      ['geneva', 'bern'], ['zurich', 'chur'], ['ljubljana', 'celje'], ['villach', 'klagenfurt'], ['marseille', 'avignon'], ['toulouse', 'carcassonne'], ['nimes', 'narbonne']];
    const foreignEnc = {}; let foreignHours = 0, foreignN = 0;
    const enc = {}; let hours = 0, encN = 0, roadSteps = 0, offSteps = 0;
    const origWild = window.enterWild;
    let abroad = false;
    window.enterWild = k => { if (k) { encN++; enc[k] = (enc[k] || 0) + 1; if (abroad) { foreignN++; foreignEnc[k] = (foreignEnc[k] || 0) + 1; } } };
    for (let rep = 0; rep < 3; rep++) for (const [a, bb] of routes) {
      const A = TH.city(a), B = TH.city(bb); if (!A || !B) continue;
      abroad = FOREIGN_REGIONS.includes(A.region);
      // Уровень героя — средний: чудища из книг попадаются только окрепшему.
      G.player.level = 5;
      const path = overPath(A.x, A.y, B.x, B.y), ow = G.over;
      const m0 = G.minutes;
      for (let i = 1; i < path.length; i++) {
        G.mode = 'over'; G.ox = path[i - 1] % ow.w; G.oy = (path[i - 1] / ow.w) | 0;
        const x = path[i] % ow.w, y = (path[i] / ow.w) | 0;
        if (ow.road[ow.idx(x, y)] >= 0) roadSteps++; else offSteps++;
        overMove(x - G.ox, y - G.oy);
        while (G.screens.length > 1) popScreen();
        G.player.fatigue = 20; G.player.food = 80;
      }
      hours += (G.minutes - m0) / 60;
      if (abroad) foreignHours += (G.minutes - m0) / 60;
    }
    window.enterWild = origWild;
    R.travel = { hours: Math.round(hours), encounters: encN, perDay: +(encN / (hours / 10)).toFixed(2),
      kinds: Object.entries(enc).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${BEASTS[k].name} ${n}`), road: Math.round(roadSteps / (roadSteps + offSteps) * 100),
      abroad: { hours: Math.round(foreignHours), n: foreignN, perDay: +(foreignN / (foreignHours / 10)).toFixed(2),
        kinds: Object.entries(foreignEnc).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${BEASTS[k].name} ${n}`) } };

    // ── Выживание: голод и усталость за день пути ──
    R.survival = {
      hungerDays: +(100 / (HUNGER_PER_MIN * 1440)).toFixed(1),
      fatigueHours: +(100 / FATIGUE_PER_MIN / 60).toFixed(1),
      ration: RATION_PRICE, potion: POTION_PRICE,
    };

    // ── Экономика: поручения ──
    TH.start(); TH.immortal();
    const byType = {}, cities = G.over.cities.filter(c => ['city', 'town', 'village', 'castle'].includes(c.kind));
    for (const c of rng.shuffle(cities.slice()).slice(0, 40)) {
      TH.go(c);
      for (const n of G.world.villages[0].npcs) {
        if (!QUEST_GIVERS[questRole(n)]) continue;
        for (let k = 0; k < 3; k++) {
          const o = makeOffer(n);
          if (!o || !o.reward) continue;
          const t = o.type === 'lair' ? 'логово' : o.type === 'kill' ? 'охота' : o.type === 'deliver' ? 'доставка' : o.type === 'work' ? 'работа' : o.type === 'relic' ? 'реликвия' : o.type === 'trophy' ? 'заказ замка' : o.type;
          (byType[t] = byType[t] || []).push(o.reward);
        }
      }
    }
    const stats = a => { a.sort((x, y) => x - y); return { n: a.length, min: a[0], med: a[a.length >> 1], max: a[a.length - 1] }; };
    R.quests = Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, stats(v)]));
    const p = G.player;
    R.prices = {
      'ночлег в таверне': p.priceBuy(6), 'исцеление у священника': p.priceBuy(8), 'отвар': p.priceBuy(POTION_PRICE), 'паёк': p.priceBuy(RATION_PRICE),
      'топор': ITEMS.axe.value, 'меч': ITEMS.sword.value, 'кольчуга': ITEMS.mail.value, 'щит': ITEMS.shield.value,
      'набор 3 ур.': gearCost(PROFILES[2]), 'набор 5 ур.': gearCost(PROFILES[3]), 'набор 8 ур.': gearCost(PROFILES[4]),
    };
    // Трофеи: сколько приносит охота.
    R.loot = ['wolf', 'boar', 'bear', 'brigand', 'deer', 'hare'].filter(k => BEASTS[k]).map(k => `${BEASTS[k].name}: ${BEASTS[k].loot ? BEASTS[k].loot.value : 0}${BEASTS[k].coins ? ` + ${BEASTS[k].coins.join('–')} мон.` : ''}`);
    // Опыт: сколько убийств до уровня.
    R.xp = [2, 3, 5, 8].map(l => ({ lvl: l, need: Array.from({ length: l - 1 }, (_, i) => 8 * (i + 1) * (i + 2)).reduce((s, x) => s + x, 0) }));
    return R;
  });
  // ── Печать ──
  const pad = (s, n) => String(s).padEnd(n), lp = (s, n) => String(s).padStart(n);
  console.log('ПРОФИЛИ ГЕРОЯ');
  out.profiles.forEach(p => console.log(`  ${pad(p.name, 58)} здоровье ${lp(p.hp, 3)}  меткость ${lp(p.hit, 2)}  уклон ${lp(p.ev, 2)}  доспех ${lp(p.armor, 2)}  снаряжение ${lp(p.cost, 5)} мон.`));
  for (const s of out.fights) {
    console.log(`\n${s.title.toUpperCase()}   (победа % / здоровья осталось % / отваров выпито)`);
    console.log(`  ${pad('', 42)}${['1 ур.', '3 ур. голый', '3 ур.', '5 ур.', '8 ур.'].map(x => pad(x, 17)).join('')}`);
    for (const r of s.rows) console.log(`  ${pad(r.foe, 42)}${r.res.map(x => pad(`${lp(x.win, 3)}% ${lp(x.hp, 3)}% ${x.pot}`, 17)).join('')}`);
  }
  if (out.aim) {
    for (const s of out.aim) {
      console.log(`\nПРИЦЕЛ — ${s.name.toUpperCase()}   (победа % / здоровья осталось %)`);
      console.log(`  ${pad('', 42)}${['корпус', 'голова', 'руки', 'ноги'].map(x => pad(x, 13)).join('')}`);
      for (const r of s.rows) console.log(`  ${pad(r.foe, 42)}${r.res.map(x => pad(`${lp(x.win, 3)}% ${lp(x.hp, 3)}%`, 13)).join('')}`);
    }
    console.log('\nОРУЖИЕ 5 ур. против тени проконсула (корпус / голова / руки / ноги):');
    for (const w of out.aimWeapons) console.log(`  ${pad(w.name, 10)} ${w.res.map(x => `${x.win}%`).join(' / ')}`);
  }
  console.log(`\nВСТРЕЧИ В ПУТИ: ${out.travel.hours} ч пути (${out.travel.road}% по дорогам), нападений ${out.travel.encounters} — ${out.travel.perDay} за 10 ч пути`);
  console.log('  кто: ' + out.travel.kinds.join(', '));
  console.log(`  из них за Альпами и в Окситании: ${out.travel.abroad.hours} ч, нападений ${out.travel.abroad.n} — ${out.travel.abroad.perDay} за 10 ч; кто: ${out.travel.abroad.kinds.join(', ')}`);
  console.log(`\nВЫЖИВАНИЕ: сытый голодает через ${out.survival.hungerDays} сут; бодрый устаёт за ${out.survival.fatigueHours} ч; паёк ${out.survival.ration}, отвар ${out.survival.potion}`);
  console.log('\nПОРУЧЕНИЯ (награда: мин / медиана / макс, сколько предложений)');
  for (const [k, v] of Object.entries(out.quests)) console.log(`  ${pad(k, 12)} ${lp(v.min, 4)} / ${lp(v.med, 4)} / ${lp(v.max, 4)}   (${v.n})`);
  console.log('\nЦЕНЫ: ' + Object.entries(out.prices).map(([k, v]) => `${k} ${v}`).join(', '));
  console.log('ТРОФЕИ: ' + out.loot.join(', '));
  console.log('ОПЫТ до уровня (сумма): ' + out.xp.map(x => `${x.lvl} ур. — ${x.need}`).join(', '));
  if (errs.length) console.log('ОШИБКИ', errs);
  await b.close();
})();
