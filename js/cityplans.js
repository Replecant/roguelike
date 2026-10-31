'use strict';

// ─── План поселения ────────────────────────────────────────────────
// Чертежи и планы — в content/buildings.js и content/italy/cities.js.

// Население около 1247 года, тыс. — от него размер городка (Сиена втрое больше Тренто).
const TOWN_POP = {
  siena: 25, cremona: 25, padua: 20, piacenza: 20, lucca: 20, brescia: 20, pavia: 15, parma: 15, ferrara: 15, perugia: 15,
  viterbo: 12, salerno: 10, catania: 10, ravenna: 8, rimini: 8, ancona: 8, benevento: 8, syracuse: 8, cagliari: 8,
  capua: 6, spoleto: 6, taranto: 6, reggio: 6, lucera: 6, foggia: 5, brindisi: 5, agrigento: 5, sassari: 5,
  turin: 4, trento: 4, sulmona: 4, cosenza: 4, aquileia: 2, bonifacio: 2, calvi: 1, mdina: 4, birgu: 2, gozo: 2,
};

// Города второй версии генерации (новые игры и ещё не виданные города): застройка плотнее,
// кварталы крупнее, размер городка — по населению, у ворот — предместья.
// Города, уже построенные в старом сохранении (genV === 1), остаются как были.
// Прежние размеры городов — для уже построенных в старых сохранениях.
const LEGACY_SIZE = { milan: { rx: 42, ry: 21 }, pisa: { rx: 38, ry: 18 }, verona: { rx: 38, ry: 18 }, bari: { rx: 34, ry: 16 }, messina: { rx: 32, ry: 17 } };
function cityPlan(city) {
  const plan = cityPlanBase(city);
  if (city.genV === 1) return LEGACY_SIZE[city.id] ? { ...plan, ...LEGACY_SIZE[city.id] } : plan;
  if (!['city', 'town'].includes(city.kind)) return plan;
  if (city._planV2 && city._planV2.base === plan) return city._planV2.plan;
  let p = { ...plan };
  if (city.kind === 'town' && !CITY_PLANS[city.id]) {
    const pop = TOWN_POP[city.id] || 4, rx = Math.max(21, Math.round(18 + pop * 0.45)), ry = Math.round(rx * 0.5);
    p = { ...p, rx, ry, w: rx * 2 + 46, h: ry * 2 + 24 };
  }
  if (!p.ruins && !p.lagoon) {
    p.block = [p.block[0] + 1, p.block[1] + 3];
    p.density = Math.max(0.93, Math.min(0.96, p.density + 0.07));
  }
  p.suburbs = true;
  Object.defineProperty(city, '_planV2', { value: { base: plan, plan: p }, enumerable: false, configurable: true, writable: true });
  return p;
}

function cityPlanBase(city) {
  if (CITY_PLANS[city.id]) return CITY_PLANS[city.id];
  const plan = PLACE_PLANS[city.kind];
  if (!plan) return city.kind === 'city' ? BIG_CITY : SMALL_TOWN;
  // Деревня растёт вместе с числом дворов.
  if (city.kind === 'village') {
    if (!city.plan) {
      const n = city.size || 8, huts = [];
      for (let i = 0; i < n; i++) huts.push(i % 3 === 2 ? ['hut_big', 'Дом', 'peasant', 1] : ['hut', 'Хижина', 'peasant', 1]);
      const rx = 18 + n * 1.7 | 0, ry = 8 + n * 0.65 | 0;
      city.plan = { ...plan, rx, ry, w: rx * 2 + 30, h: ry * 2 + 20, folk: 2 + (n >> 2), buildings: [...plan.buildings, ...huts] };
    }
    return city.plan;
  }
  // Знаменитому месту нужно больше простора под главное здание.
  return city.landmark ? { ...plan, rx: plan.rx + 9, ry: plan.ry + 4 } : plan;
}
