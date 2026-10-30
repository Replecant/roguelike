'use strict';

// ─── План поселения ────────────────────────────────────────────────
// Чертежи и планы — в content/buildings.js и content/italy/cities.js.

function cityPlan(city) {
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
