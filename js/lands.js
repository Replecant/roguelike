'use strict';

// ─── Земли из реестра: раздать описание по системам игры ───────────
// Каждая земля из content/<земля>/land.js описывает себя через defineLand (content/italy/realms.js);
// здесь это описание разносится туда, где игра его ищет: речь о месте, атлас, сухой юг, дозоры,
// товары, звери с их местными именами, римские руины и подземелья. Файл грузится после всех систем.

function applyLands() {
  for (const [id, d] of Object.entries(LAND_DEFS)) {
    if (d.in) REGION_IN[id] = d.in;
    if (d.gen) REGION_GEN[id] = d.gen;
    if (d.latin) REGION_LATIN[id] = d.latin;
    if (d.remarks) PEOPLE_REMARKS[id] = d.remarks;
    if (d.dry) DRY_REGIONS.add(id);
    if (d.atlas) ATLAS_SHEETS.push({ id, title: d.latin, lon: d.atlas.lon, lat: d.atlas.lat, only: [id, ...(d.atlas.also || [])],
      near: true, panel: 36, labels: d.atlas.labels || [], lords: d.atlas.lords || [] });
    // Дозор земли: ходит от города к городу и вешает пойманные шайки.
    const pt = d.patrol;
    if (pt && !TRAVELER_KINDS[pt.key]) {
      TRAVELER_KINDS[pt.key] = { name: pt.name, glyph: 'k', color: pt.color || '#d8c090', count: 2, pace: 1.1, role: 'guard', title: pt.title,
        portraits: pt.portraits || ['guard', 'armed_militia', 'armed_vet'], regions: pt.regions || [id], law: true, greeting: pt.greeting };
      ROAD_KINDS.push(pt.key);
      TRAVELER_LIFE[pt.key] = pt.life;
      MEET_SCENES[pt.key] = pt.meet;
    }
    for (const g of d.goods || []) { const G0 = GOODS[g]; if (G0) (G0.regions = G0.regions || []).push(id); }
    for (const b of d.beasts || []) { const B = BEASTS[b]; if (B && B.regions && !B.regions.includes(id)) B.regions.push(id); }
    for (const [b, loc] of Object.entries(d.local || {})) { const B = BEASTS[b]; if (B) (B.local = B.local || {})[id] = loc; }
    // Подземелья: римские гробницы у руин своих городов, митреумы, гроты, рудники.
    if (d.roman) ROMAN_RUINS[id] = d.roman;
    for (const type of ['roman', 'mithraeum']) {
      const T0 = DUNGEON_TYPES[type];
      if (T0.notRegions && !T0.notRegions.includes(id)) T0.notRegions.push(id);
    }
    for (const [type, n] of Object.entries(d.dungeons || {})) {
      const T0 = DUNGEON_TYPES[type];
      if (T0 && n) (T0.lands = T0.lands || {})[id] = n;
    }
  }
}
applyLands();
