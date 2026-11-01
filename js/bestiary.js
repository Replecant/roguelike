'use strict';

// ─── Бестиарий: порядок, ареалы ────────────────────────────────────
// Сами существа — в content/bestiary.js.

const BEAST_ORDER = Object.keys(BEASTS);

// Развернуть группы регионов в списки.
for (const d of Object.values(BEASTS)) {
  if (!d.regions) continue;
  d.regions = [...new Set(d.regions.flatMap(r => REGION_GROUPS[r] || [r]))];
}

// Местные имена: «provence,languedoc» — одно на два края.
for (const d of Object.values(BEASTS)) {
  if (!d.local) continue;
  for (const k of Object.keys(d.local)) if (k.includes(',')) { for (const r of k.split(',')) d.local[r] = d.local[k]; delete d.local[k]; }
}

// Зверь под местным именем: стрега в Италии — маска в Провансе, вешча в Карантании.
function beastLocal(d, region) {
  const l = d.local && region && d.local[region];
  return l ? { ...d, ...l } : d;
}

// «Зовут по-разному…» — для книги о зверях.
function beastAka(d) {
  if (!d.local) return '';
  const by = new Map();
  for (const [r, l] of Object.entries(d.local)) by.set(l.name, (by.get(l.name) || []).concat(REGION_IN[r] || REGIONS[r].name));
  return ` Зовут по-разному: ${[...by].map(([n, rs]) => `${rs.join(' и ')} — ${n.toLowerCase()}`).join(', ')}.`;
}

function beastInRegion(d, region) {
  return !d.regions || d.regions.includes(region);
}
