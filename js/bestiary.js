'use strict';

// ─── Бестиарий: порядок, ареалы ────────────────────────────────────
// Сами существа — в content/bestiary.js.

const BEAST_ORDER = Object.keys(BEASTS);

// Развернуть группы регионов в списки.
for (const d of Object.values(BEASTS)) {
  if (!d.regions) continue;
  d.regions = [...new Set(d.regions.flatMap(r => REGION_GROUPS[r] || [r]))];
}

function beastInRegion(d, region) {
  return !d.regions || d.regions.includes(region);
}
