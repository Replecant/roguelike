'use strict';

// ─── Хроника героя ─────────────────────────────────────────────────
// Летопись пути: важное, что случилось с героем, с датой и местом.
// Читается в журнале (вкладка «Хроника») и на экране смерти.

function chronicle(text, kind = 'event') {
  const p = G.player;
  if (!p) return;
  p.chronicle = p.chronicle || [];
  const where = G.over ? REGIONS[G.over.regionAt(G.ox, G.oy)].name : '';
  p.chronicle.push({ day: timeInfo().day, text, kind, where });
  if (p.chronicle.length > 600) p.chronicle.splice(1, 1);   // первую запись — о начале пути — храним всегда
}

// Первое посещение поселения стоит записи, только если оно чем-то примечательно.
function chronicleVisit(place) {
  const p = G.player;
  p.visited = p.visited || {};
  if (p.visited[place.id]) return;
  p.visited[place.id] = true;
  if (place.kind === 'city' || place.kind === 'town') chronicle(`Впервые вошёл в ${cityAcc(place.name)}.`, 'travel');
  else if (place.famous) chronicle(`Побывал: ${placeTitle(place)}.`, 'travel');
}

const CHRONICLE_ICONS = { start: '✦', travel: '⌂', level: '▲', boss: '☠', kill: '⚔', quest: '✓', find: '❖', faith: '✝', buy: '♘', death: '†', event: '·' };

// Сводка для экрана смерти и шапки хроники.
function chronicleSummary(p) {
  const kills = Object.values(p.kills).reduce((a, b) => a + b, 0);
  const cities = Object.keys(p.visited || {}).length;
  const quests = (p.chronicle || []).filter(c => c.kind === 'quest').length;
  const bosses = (p.chronicle || []).filter(c => c.kind === 'boss').length;
  return { days: timeInfo().day, level: p.level, kills, cities, quests, bosses };
}
