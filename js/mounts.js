'use strict';

// ─── Лошадь и мул ──────────────────────────────────────────────────
// Ездовое животное помогает только в пути по карте Италии; на местных картах
// его оставляют привязанным. Лошадь быстра на дорогах и равнинах, но в горах и
// болотах толку от неё мало, и ей нужен овёс — мешок зерна на два дня. Мул
// медленнее, зато твёрдо ступает в горах, везёт много и пасётся сам.

const MOUNTS = {
  mule: {
    name: 'Мул', acc: 'мула', price: 70, cap: 30, eats: false,
    speed: { road: 0.85, open: 0.85, rough: 0.85, steep: 0.75, wet: 0.95 },
    desc: 'Упрямый, но выносливый. Везёт поклажу, твёрдо ступает на горных тропах, кормится чем придётся.',
  },
  horse: {
    name: 'Верховая лошадь', acc: 'верховую лошадь', price: 150, cap: 12, eats: true,
    speed: { road: 0.55, open: 0.65, rough: 0.85, steep: 1, wet: 1 },
    desc: 'Быстра на дорогах и равнинах. В горах и болотах её ведут под уздцы. Ест мешок зерна на два дня.',
  },
};

function terrainClass(ow, x, y) {
  if (ow.road[ow.idx(x, y)] >= 0) return 'road';
  const t = ow.get(x, y);
  if (t === OT.PLAIN || t === OT.FIELD) return 'open';
  if (t === OT.MOUNT || t === OT.PINE || t === OT.HILL) return 'steep';
  if (t === OT.MARSH || t === OT.RIVER) return 'wet';
  return 'rough';
}

// Во сколько раз быстрее путь по этой клетке.
function mountSpeed(p, ow, x, y) {
  const m = p.mount;
  if (!m) return 1;
  const def = MOUNTS[m.kind], k = def.speed[terrainClass(ow, x, y)];
  const ride = k * (1 - skillLevel(p, 'riding') * 0.02);
  return m.hungry ? 1 - (1 - ride) / 2 : ride;   // голодная лошадь еле плетётся
}

function mountCap(p) { return p.mount ? MOUNTS[p.mount.kind].cap : 0; }

// Каждый день: лошадь ест.
function mountDaily(day) {
  const p = G.player, m = p && p.mount;
  if (!m || !MOUNTS[m.kind].eats) return;
  if (m.stabled === day || m.stabled === day - 1) { m.hungry = 0; return; }
  if (m.ration > 0) { m.ration--; m.hungry = 0; return; }
  if (p.goods.grain > 0) {
    p.goods.grain--;
    m.ration = 1;
    m.hungry = 0;
    return;
  }
  m.hungry = (m.hungry || 0) + 1;
  if (m.hungry >= 5) {
    p.mount = null;
    log('Изголодавшаяся лошадь пала. Надо было купить зерна.', C.red);
  } else log(`Лошадь голодна (${m.hungry}-й день без овса): еле плетётся. Купи зерна или поставь её в конюшню.`, C.orange);
}

// Ночёвка в лагере: животное могут увести.
function mountCampRisk() {
  const p = G.player;
  if (!p.mount || !isNight() || !rng.chance(0.05 * (1 - skillLevel(p, 'riding') * 0.07))) return;
  const name = MOUNTS[p.mount.kind].name.toLowerCase();
  p.mount = null;
  log(`Утром ты находишь только обрывок повода. ${name[0].toUpperCase() + name.slice(1)} уведён${name === 'мул' ? '' : 'а'}.`, C.red);
}

// ─── Конюшня у трактирщика ─────────────────────────────────────────

function stableOptions(npc) {
  const p = G.player, place = npc.village.city, opts = [];
  const horses = place.kind !== 'village';
  for (const kind of ['mule', 'horse']) {
    if (kind === 'horse' && !horses) continue;
    const def = MOUNTS[kind], price = p.priceBuy(def.price);
    if (p.mount && p.mount.kind === kind) continue;
    opts.push({ label: `Купить: ${def.name.toLowerCase()} (${price} мон.)`, act: () => {
      const trade = p.mount ? Math.floor(MOUNTS[p.mount.kind].price * 0.4) : 0;
      if (p.coins + trade < price) return `${def.desc} Только стоит ${price} монет, а у тебя ${p.coins}${trade ? ` и ${p.mount.kind === 'mule' ? 'мул' : 'лошадь'} на обмен` : ''}.`;
      p.coins -= price - trade;
      const old = p.mount;
      p.mount = { kind, ration: def.eats ? 2 : 0, hungry: 0 };
      chronicle(`Купил ${def.acc}.`, 'buy');
      log(`Теперь у тебя есть ${def.acc}.${old ? ' Прежнее животное пошло в зачёт.' : ''}`, C.gold);
      return `${def.desc} Береги ${kind === 'mule' ? 'его' : 'её'}.`;
    } });
  }
  if (p.mount) {
    const def = MOUNTS[p.mount.kind], price = Math.floor(def.price * 0.4);
    opts.push({ label: `Продать: ${def.name.toLowerCase()} (${price} мон.)`, act: () => {
      if (carryLoad(p) > p.capacity - def.cap) return 'А поклажу ты на себе потащишь? Сначала разгрузись.';
      p.mount = null;
      p.coins += price;
      return `Хороший${def.eats ? '' : ''} зверь. Вот ${price} монет — больше никто не даст.`;
    } });
  }
  return opts;
}
