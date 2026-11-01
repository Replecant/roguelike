// Прогон путников: герой идёт по дорогам Италии и считает, сколько путников видно,
// сколько шаек рядом, как часто нападают. Запуск: node tools/sim-travelers.js [повторов]
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + __dirname + '/../index.html');
  await pg.addScriptTag({ path: __dirname + '/../tests/helpers.js' });
  const runs = +(process.argv[2] || 3);
  const res = await pg.evaluate(runs => {
    const ROUTES = [
      ['Север', ['milan', 'pavia', 'cremona', 'verona', 'padua']],
      ['Центр', ['bologna', 'florence', 'siena', 'viterbo', 'rome']],
      ['Юг', ['naples', 'benevento', 'foggia', 'bari']],
      ['Сицилия', ['messina', 'catania', 'syracuse']],
      ['Сардиния', ['cagliari', 'oristano', 'sassari']],
      ['Гельвеция', ['geneva', 'lausanne', 'fribourg', 'bern', 'lucerne', 'zurich', 'basel']],
      ['Сен-Готард', ['milan', 'como', 'lucerne']],
    ];
    const out = {};
    let attacks = 0, beasts = 0;
    const realAttack = brigandsAttackHero, realEnc = enterWild;
    brigandsAttackHero = b => { attacks++; G.travelers = G.travelers.filter(x => x !== b); brigandsCalm(); };
    enterWild = e => { if (e) beasts++; };
    for (let r = 0; r < runs; r++) {
      TH.start(); TH.immortal(); leaveLocal();
      const p = G.player;
      for (const [name, ids] of ROUTES) {
        const o = out[name] = out[name] || { steps: 0, minutes: 0, visSum: 0, visMax: 0, byKind: {}, bandsNear: 0, bands25: 0, attacks: 0, beasts: 0, km: 0 };
        let c0 = TH.city(ids[0]);
        G.ox = c0.x; G.oy = c0.y; G.travelers = []; G.densityAt = null; fillTravelers(true);
        for (let k = 1; k < ids.length; k++) {
          const c1 = TH.city(ids[k]); if (!c0 || !c1) continue;
          const path = overPath(G.ox, G.oy, c1.x, c1.y) || [];
          for (const idx of path.slice(1)) {
            const x = idx % G.over.w, y = (idx / G.over.w) | 0;
            const a0 = attacks, b0 = beasts, m0 = G.minutes;
            p.food = 80; p.fatigue = 10; p.hp = p.maxHp;
            overMove(Math.sign(x - G.ox), Math.sign(y - G.oy));
            if (G.mode === 'local') leaveLocal();
            G.ox = x; G.oy = y;
            o.steps++; o.minutes += G.minutes - m0; o.attacks += attacks - a0; o.beasts += beasts - b0;
            const vis = (G.travelers || []).filter(t => travelerVisible(t));
            o.visSum += vis.length; o.visMax = Math.max(o.visMax, vis.length);
            for (const t of vis) o.byKind[t.kind] = (o.byKind[t.kind] || 0) + 1;
            if (G.travelers.some(t => t.kind === 'brigands' && Math.max(Math.abs(t.x - G.ox), Math.abs(t.y - G.oy)) <= 5)) o.bandsNear++;
            o.bands25 += G.travelers.filter(t => t.kind === 'brigands' && Math.max(Math.abs(t.x - G.ox), Math.abs(t.y - G.oy)) <= 25).length;
          }
          c0 = c1;
        }
      }
    }
    brigandsAttackHero = realAttack; enterWild = realEnc;
    const rep = {};
    for (const [name, o] of Object.entries(out)) {
      const days = o.minutes / 1440;
      rep[name] = {
        'дней в пути': +days.toFixed(1),
        'видно путников в среднем': +(o.visSum / o.steps).toFixed(1),
        'видно максимум': o.visMax,
        'кого видно (на шаг)': Object.fromEntries(Object.entries(o.byKind).map(([k, v]) => [TRAVELER_KINDS[k].name, +(v / o.steps).toFixed(2)])),
        'шайка ближе 5 клеток (% шагов)': Math.round(o.bandsNear / o.steps * 100),
        'шаек в 25 клетках (в среднем)': +(o.bands25 / o.steps).toFixed(2),
        'нападений шаек в день': +(o.attacks / days).toFixed(2),
        'встреч со зверями в день': +(o.beasts / days).toFixed(2),
      };
    }
    return rep;
  }, runs);
  console.log(JSON.stringify(res, null, 1), errs);
  await b.close();
})();
