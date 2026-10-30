'use strict';

// ─── Товары и цены ─────────────────────────────────────────────────
// base — средняя цена; w — сколько места занимает; regions/cities — где
// товар производят (там он дёшев, чем дальше — тем дороже).

const GOODS = {
  grain: { name: 'Зерно', unit: 'мешок', base: 4, w: 2, food: true,
    regions: ['sicily', 'apulia', 'campania'] },
  wine: { name: 'Вино', unit: 'бочонок', base: 8, w: 2, food: true,
    regions: ['tuscany', 'campania', 'piedmont', 'veneto'] },
  oil: { name: 'Оливковое масло', unit: 'кувшин', base: 10, w: 2, food: true,
    regions: ['apulia', 'liguria', 'calabria'] },
  salt: { name: 'Соль', unit: 'мешок', base: 6, w: 2, food: true,
    regions: ['sardinia'], cities: ['venice', 'ravenna', 'cagliari', 'syracuse'] },
  cheese: { name: 'Сыр', unit: 'круг', base: 7, w: 1, food: true,
    regions: ['lombardy', 'emilia', 'sardinia'] },
  wool: { name: 'Шерсть', unit: 'тюк', base: 9, w: 2,
    regions: ['abruzzo', 'apulia', 'sardinia'] },
  cloth: { name: 'Сукно', unit: 'штука', base: 22, w: 1,
    cities: ['florence', 'milan', 'siena', 'verona'] },
  iron: { name: 'Железо', unit: 'крица', base: 12, w: 3,
    regions: ['alps'], cities: ['brescia', 'pisa', 'bonifacio'] },
  spices: { name: 'Пряности', unit: 'мешочек', base: 40, w: 1,
    cities: ['venice', 'genoa', 'palermo'] },
  silk: { name: 'Шёлк', unit: 'отрез', base: 50, w: 1,
    cities: ['lucca', 'palermo', 'venice'] },
};
const GOOD_IDS = Object.keys(GOODS);

// Алхимические трофеи: травница платит за них больше.
const ALCHEMY = ['venom', 'bat_wing', 'wisp_glass', 'witch_ointment', 'grave_dirt', 'tarantula', 'ectoplasm',
  'surbile_fang', 'lamia_skin', 'werewolf_claw', 'river_pearl', 'siren_scale', 'elf_knot'];

// Расстояние (в клетках карты) от поселения до ближайшего производителя.
function producerDistance(place, id) {
  const g = GOODS[id], ow = G.over;
  if ((g.regions || []).includes(place.region) || (g.cities || []).includes(place.id)) return 0;
  let best = Infinity;
  for (const c of ow.cities) {
    if (!(g.regions || []).includes(c.region) && !(g.cities || []).includes(c.id)) continue;
    best = Math.min(best, Math.hypot(c.x - place.x, (c.y - place.y) * 2));
  }
  return best;
}

// Справедливая цена товара в поселении сегодня.
function goodPrice(place, id) {
  const g = GOODS[id];
  place.dist = place.dist || {};
  if (place.dist[id] === undefined) place.dist[id] = producerDistance(place, id);
  const d = place.dist[id];
  const far = d === 0 ? 0.6 : 0.85 + Math.min(1, d / (120 * MAP_SCALE)) * 0.65;
  // Цены гуляют от недели к неделе.
  const week = Math.floor(timeInfo().day / 7), pi = G.over.cities.indexOf(place);
  const drift = 0.85 + hash2(pi * 13 + GOOD_IDS.indexOf(id), week * 7 + 3) * 0.3;
  return g.base * far * drift * eventPriceMult(place, id) * seasonPriceMult(id);
}

// Спрос и предложение: каждая купленная штука поднимает цену в этом месте,
// каждая проданная — роняет; за несколько дней рынок успокаивается.
const MARKET_STEP = 0.025;
function marketPress(place, id) {
  const m = place.market && place.market[id], day = timeInfo().day;
  if (!m || !m.press) return 1;
  if (m.pressDay !== day) { m.press = 1 + (m.press - 1) * Math.pow(0.7, day - (m.pressDay || day)); m.pressDay = day; }
  return m.press;
}
function pushMarket(place, id, dir) {
  place.market = place.market || {};
  const m = place.market[id] || (place.market[id] = { n: 0, day: timeInfo().day });
  m.press = Math.max(0.5, Math.min(2, marketPress(place, id) * (1 + dir * MARKET_STEP)));
  m.pressDay = timeInfo().day;
}

const buyPrice = (place, id) => G.player.priceBuy(Math.round(goodPrice(place, id) * 1.1 * marketPress(place, id)));
const sellPrice = (place, id) => G.player.priceSell(Math.max(1, Math.round(goodPrice(place, id) * 0.9 * marketPress(place, id))));

// Насколько богат выбор снаряжения: деревня — 1, городок и замок — 2, город — 3.
function placeTier(place) {
  return place.kind === 'city' ? 3 : place.kind === 'town' || place.kind === 'castle' ? 2 : 1;
}

function gearFor(npc) {
  const tier = placeTier(npc.village.city);
  const keys = Object.keys(ITEMS).filter(k => ITEMS[k].tier && ITEMS[k].tier <= tier);
  switch (npc.role) {
    case 'smith': return keys.filter(k => ITEMS[k].kind !== 'relic' || ITEMS[k].seller === 'smith');
    case 'priest': return keys.filter(k => ITEMS[k].seller === 'priest');
    case 'herbalist': return keys.filter(k => ITEMS[k].seller === 'herbalist');
    case 'merchant': return ['torch', 'arrows', 'bolts', 'javelins'];
    default: return [];
  }
}

// Что продаёт и покупает житель. buysGear — за какую долю цены берёт снаряжение.
function traderGoods(npc) {
  const place = npc.village.city;
  const local = GOOD_IDS.filter(id => producerDistance(place, id) === 0);
  const gear = gearFor(npc);
  switch (npc.role) {
    case 'merchant': return { rations: true, sells: GOOD_IDS, buys: GOOD_IDS, trophies: 0.5, gear, buysGear: () => 0.2 };
    case 'smith': return { sells: ['iron'], buys: ['iron'], trophies: 0, gear, buysGear: it => it.kind === 'relic' ? 0 : 0.3 };
    case 'priest': return { sells: [], buys: [], trophies: 0, gear, buysGear: it => it.kind === 'relic' ? 0.5 : 0 };
    case 'innkeeper': return { rations: true, sells: GOOD_IDS.filter(id => GOODS[id].food), buys: GOOD_IDS.filter(id => GOODS[id].food), trophies: 0.5 };
    case 'elder': return { rations: true, sells: local.length ? local : ['grain'], buys: GOOD_IDS.filter(id => GOODS[id].food), trophies: 0.4 };
    case 'herbalist': return { sells: [], buys: [], trophies: 0, alchemy: 0.75, potions: true, gear };
    default: return null;
  }
}

// Запас товара у торговца; пополняется со временем.
function stockOf(npc, id) {
  const place = npc.village.city, day = timeInfo().day;
  const m = place.market || (place.market = {});
  const big = place.kind === 'city' ? 2 : place.kind === 'town' ? 1.3 : 0.6;
  const max = Math.round((producerDistance(place, id) === 0 ? 20 : 6) * big);
  let s = m[id];
  if (!s) s = m[id] = { n: max, day };
  if (day > s.day) { s.n = Math.min(max, s.n + Math.ceil(max / 4) * (day - s.day)); s.day = day; }
  return s;
}

function carryLoad(p) {
  return Object.entries(p.goods).reduce((s, [id, n]) => s + GOODS[id].w * n, 0) + bagLoad(p) + ammoLoad(p) + Math.ceil((p.rations || 0) / 4);
}

// ─── Подсказка купца: где что выгодно ──────────────────────────────

function tradeTip(place) {
  const ow = G.over;
  const near = ow.cities.filter(c => c !== place && (c.kind === 'city' || c.kind === 'town')
    && landmass(c.region) === landmass(place.region) && Math.hypot(c.x - place.x, c.y - place.y) < 45 * MAP_SCALE);
  if (!near.length) return 'Про другие рынки не скажу — далеко мы от всех.';
  const id = rng.pick(GOOD_IDS), g = GOODS[id];
  let cheap = null, dear = null;
  for (const c of [place, ...near]) {
    const pr = goodPrice(c, id);
    if (!cheap || pr < cheap[1]) cheap = [c, pr];
    if (!dear || pr > dear[1]) dear = [c, pr];
  }
  if (cheap[0] === dear[0]) return `${g.name} везде нынче в одной цене.`;
  return `${g.name}? Дешевле всего в ${cheap[0].name === place.name ? 'нашем городе' : `городе ${cheap[0].name}`} — `
    + `около ${Math.round(cheap[1])} мон. за ${cityAcc(g.unit)}. А в городе ${dear[0].name} за то же дают ${Math.round(dear[1])}. `
    + 'Только дороги нынче неспокойные.';
}

// ─── Окно торговли ─────────────────────────────────────────────────

class TradeScreen {
  constructor(npc) {
    this.overlay = false;
    this.npc = npc;
    this.place = npc.village.city;
    this.deal = traderGoods(npc);
    this.side = 0;      // 0 — товары торговца, 1 — твоя поклажа
    this.sel = [0, 0];
    this.note = '';
  }

  // Строки: [{label, qty, price, act(n)}].
  /** @returns {any[]} */
  rows(side) {
    const p = G.player, place = this.place, d = this.deal, out = [];
    if (side === 0) {
      if (d.rations) {
        const pr = p.priceBuy(RATION_PRICE);
        out.push({ label: 'Провиант (паёк на день)', qty: '∞', price: pr, base: RATION_PRICE, buy: n => this.buy('ration', Math.min(n, 10), pr) });
      }
      if (d.potions) {
        const pr = p.priceBuy(POTION_PRICE);
        out.push({ label: 'Целебный отвар', qty: '∞', price: pr, base: POTION_PRICE, buy: n => this.buy(null, n, pr) });
      }
      for (const key of d.gear || []) {
        const it = ITEMS[key], pr = p.priceBuy(it.value);
        const holy = it.minPiety && (p.is('saracen') || p.piety < it.minPiety);
        out.push({ label: holy ? `${it.name} · нужно благочестие ${it.minPiety}` : it.name, qty: '∞', price: pr, base: it.value, gear: key, buy: n => this.buyGear(key, Math.min(n, 1), pr) });
      }
      for (const id of d.sells) {
        const s = stockOf(this.npc, id), pr = buyPrice(place, id);
        out.push({ label: GOODS[id].name, qty: s.n, price: pr, base: GOODS[id].base, id, w: GOODS[id].w,
          buy: n => this.buy(id, n, pr) });
      }
    } else {
      for (const id of GOOD_IDS) {
        if (!p.goods[id]) continue;
        const ok = d.buys.includes(id);
        out.push({ label: `${GOODS[id].name}`, qty: p.goods[id], price: ok ? sellPrice(place, id) : null, base: GOODS[id].base, id,
          sell: n => this.sellGood(id, n) });
      }
      for (const it of p.bag) {
        const k = d.buysGear ? d.buysGear(it) : 0;
        out.push({ label: it.name, qty: 1, price: k ? Math.max(1, Math.round(p.priceSell(it.value) * k)) : null, item: it,
          sell: () => this.sellGear(it, k) });
      }
      for (const [tid, t] of Object.entries(p.trophies)) {
        const k = ALCHEMY.includes(tid) && d.alchemy ? d.alchemy : d.trophies;
        out.push({ label: t.name, qty: t.count, price: k ? Math.max(1, Math.round(p.priceSell(t.value) * k)) : null, trophy: tid,
          sell: n => this.sellTrophy(tid, n, k) });
      }
    }
    return out;
  }

  buy(id, n, price) {
    const p = G.player, goods = id && id !== 'ration';
    let done = 0, spent = 0;
    for (; done < n; done++) {
      if (goods) price = buyPrice(this.place, id);   // цена растёт с каждой купленной штукой
      if (p.coins < price) { this.note = 'Не хватает монет.'; break; }
      if (id === 'ration') {
        if (carryLoad(p) + 1 > p.capacity) { this.note = 'Больше не унести.'; break; }
        p.rations++;
      } else if (id) {
        const s = stockOf(this.npc, id);
        if (s.n <= 0) { this.note = 'Товар кончился.'; break; }
        if (carryLoad(p) + GOODS[id].w > p.capacity) { this.note = 'Больше не унести.'; break; }
        s.n--;
        p.goods[id] = (p.goods[id] || 0) + 1;
      } else p.potions++;
      p.coins -= price;
      spent += price;
      if (goods) pushMarket(this.place, id, 1);
      trainSkill(p, 'trade', price / 6);
    }
    if (done) this.note = `Куплено: ${done} шт. за ${spent} мон.${goods && done > 1 ? ' Цена росла с каждой штукой.' : ''}`;
  }

  buyGear(key, n, price) {
    const p = G.player, it = ITEMS[key];
    if (it.minPiety && (p.is('saracen') || p.piety < it.minPiety)) {
      this.note = p.is('saracen') ? 'Святыню неверному не продают.'
        : `Святыню не продают первому встречному: нужно благочестие ${it.minPiety} (у тебя ${p.piety}).`;
      return;
    }
    if (p.coins < price) { this.note = 'Не хватает монет.'; return; }
    if (carryLoad(p) + it.w > p.capacity) { this.note = 'Больше не унести.'; return; }
    p.coins -= price;
    trainSkill(p, 'trade', price / 6);
    if (it.kind === 'ammo') {
      p.ammo[it.ammo] = (p.ammo[it.ammo] || 0) + it.count;
      this.note = `Куплено: ${it.name} за ${price} мон. Стрелять — F.`;
      return;
    }
    p.bag.push(makeItem(key));
    this.note = `Куплено: ${it.name} за ${price} мон. Надеть — в снаряжении (I).`;
  }

  sellGear(it, k) {
    const p = G.player;
    if (!k) { this.note = `${this.npc.title} такое не берёт.`; return; }
    const pr = Math.max(1, Math.round(p.priceSell(it.value) * k));
    p.bag = p.bag.filter(x => x !== it);
    p.coins += pr;
    trainSkill(p, 'trade', pr / 6);
    this.note = `Продано: ${it.name} за ${pr} мон.`;
  }

  sellGood(id, n) {
    const p = G.player;
    if (!this.deal.buys.includes(id)) { this.note = `${this.npc.title} такое не берёт.`; return; }
    const k = Math.min(n, p.goods[id]);
    let got = 0;
    for (let i = 0; i < k; i++) {   // цена падает с каждой проданной штукой
      const pr = sellPrice(this.place, id);
      got += pr;
      pushMarket(this.place, id, -1);
    }
    p.goods[id] -= k;
    if (!p.goods[id]) delete p.goods[id];
    stockOf(this.npc, id).n += k;
    p.coins += got;
    trainSkill(p, 'trade', got / 6);
    this.note = `Продано: ${k} шт. за ${got} мон.${k > 1 ? ' Цена падала с каждой штукой.' : ''}`;
  }

  sellTrophy(tid, n, k) {
    const p = G.player, t = p.trophies[tid];
    if (!k) { this.note = `${this.npc.title} такое не берёт.`; return; }
    const pr = Math.max(1, Math.round(p.priceSell(t.value) * k)), m = Math.min(n, t.count);
    t.count -= m;
    if (!t.count) delete p.trophies[tid];
    p.coins += m * pr;
    trainSkill(p, 'trade', m * pr / 6);
    this.note = `Продано: ${t.name} ×${m} за ${m * pr} мон.`;
  }

  key(k) {
    const rows = this.rows(this.side);
    if (isEsc(k)) return popScreen();
    if (k.code === 'Tab' || isLeft(k) || isRight(k)) { this.side ^= 1; this.note = ''; return; }
    if (isUp(k)) this.sel[this.side] = Math.max(0, this.sel[this.side] - 1);
    else if (isDown(k)) this.sel[this.side] = Math.min(Math.max(0, rows.length - 1), this.sel[this.side] + 1);
    else if (isEnter(k) || k.code === 'KeyA') {
      const row = rows[this.sel[this.side]];
      if (!row) return;
      const n = k.code === 'KeyA' ? 999 : 1;
      if (this.side === 0) row.buy(n);
      else row.sell(n);
      const len = this.rows(this.side).length;
      this.sel[this.side] = Math.min(this.sel[this.side], Math.max(0, len - 1));
    }
  }

  render(t) {
    const p = G.player, n = this.npc;
    t.print(2, 1, `Торговля — ${n.name}, ${n.title.toLowerCase()} (${placeTitle(this.place)})`, C.gold);
    for (let i = 0; i < t.cols; i++) t.put(i, 2, '─', C.dark);
    /** @type {[number, string][]} */
    const cols = [[2, 'Купить'], [52, 'Продать']];
    cols.forEach(([x, title], side) => {
      const active = side === this.side, rows = this.rows(side);
      t.print(x, 4, title, active ? C.gold : C.dim);
      t.print(x + 26, 4, side === 0 ? 'есть  цена' : 'шт.   цена', C.dark);
      if (!rows.length) t.print(x, 6, side === 0 ? 'Здесь нечего купить.' : 'Тебе нечего продать.', C.dark);
      // Длинные списки прокручиваются вслед за выбором.
      const H = t.rows - 14, top = Math.max(0, Math.min(rows.length - H, this.sel[side] - H + 3));
      if (top > 0) t.print(x + 2, 5, '▲ ещё', C.dark);
      if (top + H < rows.length) t.print(x + 2, 6 + H, '▼ ещё', C.dark);
      rows.slice(top, top + H).forEach((r, j) => {
        const i = top + j, sel = active && i === this.sel[side], y = 6 + j;
        t.print(x, y, sel ? '►' : ' ', C.gold);
        t.print(x + 2, y, r.label.slice(0, 23), sel ? C.white : r.price === null ? C.dark : C.text);
        t.print(x + 26, y, String(r.qty).padStart(3), C.dim);
        if (r.price === null) { t.print(x + 32, y, '—', C.dark); return; }
        // Зелёный — выгодно тебе, красный — невыгодно.
        const ratio = r.base ? r.price / r.base : 1;
        const good = side === 0 ? ratio < 0.85 : ratio > 1.1, bad = side === 0 ? ratio > 1.25 : ratio < 0.6;
        t.print(x + 32, y, String(r.price).padStart(4), good ? C.green : bad ? C.red : C.gold);
      });
    });
    const y = t.rows - 6;
    for (let i = 0; i < t.cols; i++) t.put(i, y - 1, '─', C.dark);
    t.printRich(2, y, `{dim}Монеты{} {gold}${p.coins}{}    {dim}Груз{} ${carryLoad(p)}/${p.capacity}    `
      + `{dim}Цены:{} {green}выгодно{}  {gold}обычно{}  {red}дорого`);
    const local = GOOD_IDS.filter(id => producerDistance(this.place, id) === 0).map(id => GOODS[id].name.toLowerCase());
    if (local.length) t.print(2, y + 1, `Здесь производят: ${local.join(', ')} — тут они дешевле всего.`, C.dim);
    const cur = this.rows(this.side)[this.sel[this.side]];
    if (cur && cur.id) t.print(2, y + 3, `${GOODS[cur.id].name}: ${GOODS[cur.id].unit}, мест: ${GOODS[cur.id].w}`, C.dim);
    const gi = cur && (cur.item || (cur.gear && ITEMS[cur.gear]));
    if (gi) t.print(2, y + 3, `${gi.name}: ${itemStats(gi)}, мест: ${gi.w}${gi.note ? ` — ${gi.note}` : ''}`.slice(0, 96), C.dim);
    if (this.note) t.print(2, y + 2, this.note, C.sky);
    t.print(2, t.rows - 1, '↑↓ выбор   ←→ / Tab — купить/продать   Enter — 1 шт.   A — всё   Esc — назад', C.dim);
  }
}
