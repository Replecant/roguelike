'use strict';

// ─── Окна на HTML ──────────────────────────────────────────────────
// Диалог, котомка, торговля, журнал, лист героя и молитвы рисуются как
// оформленные окна поверх карты. Логика и клавиши остаются в самих экранах
// (screens.js, items.js, trade.js, faith.js); здесь — только вид и клики.
// У экрана с окном есть html() и act(имя, data-атрибуты).

const WIN = { el: null };

function winInit() {
  WIN.el = document.getElementById('win');
  WIN.el.addEventListener('click', e => winAct(e, false));
  WIN.el.addEventListener('dblclick', e => winAct(e, true));
}

function winAct(e, dbl) {
  const s = winScreen();
  if (!s) return;
  const stuck = s.npc && s.npc.noEscape;
  if (e.target.classList.contains('backdrop')) { if (!stuck) popScreen(); render(); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'close') { if (!stuck) popScreen(); }
  else s.act(act, el.dataset, dbl);
  render();
}

function winScreen() {
  const s = topScreen();
  return HUD.stage && s && s.html ? s : null;
}

function winUpdate() {
  if (!WIN.el) return;
  const s = winScreen();
  if (!s) { WIN.el.hidden = true; WIN.el.innerHTML = ''; WIN.cur = null; return; }
  const scrolls = {};
  if (WIN.cur === s) WIN.el.querySelectorAll('[data-scroll]').forEach(e => { scrolls[e.dataset.scroll] = e.scrollTop; });
  // То же окно — меняем только содержимое: рамка и затемнение остаются,
  // анимация появления не повторяется, ничего не мигает.
  const win = WIN.cur === s && WIN.el.querySelector('.window');
  if (win) win.innerHTML = s.html();
  else WIN.el.innerHTML = `<div class="backdrop"></div><div class="window ${s.winClass || ''}">${s.html()}</div>`;
  WIN.el.hidden = false;
  WIN.el.querySelectorAll('[data-scroll]').forEach(e => { if (scrolls[e.dataset.scroll] !== undefined) e.scrollTop = scrolls[e.dataset.scroll]; });
  // Хроника открывается на последних событиях.
  const chron = WIN.el.querySelector('.chron');
  if (chron && !WIN.chronShown) { chron.scrollTop = chron.scrollHeight; WIN.chronShown = true; }
  if (!chron) WIN.chronShown = false;
  // Выбранная строка всегда на виду.
  WIN.el.querySelectorAll('[data-scroll] .sel').forEach(e => e.scrollIntoView({ block: 'nearest' }));
  WIN.cur = s;
}

const winHead = (title, sub = '', extra = '') =>
  `<header class="win-head"><div><h2>${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${extra}<button class="x" data-act="close" title="Закрыть (Esc)">✕</button></header>`;
const keys = list => `<footer class="win-keys">${list.map(([k, t]) => `<span><kbd>${k}</kbd> ${t}</span>`).join('')}</footer>`;
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

// ─── Портреты ──────────────────────────────────────────────────────
// Миниатюры в духе итальянских рукописей (portraits/*.webp). У кого своего
// портрета нет — круглый значок с его символом на карте.

// Варианты на роль; кому какой — по имени, чтобы соседи не были на одно лицо.
const PORTRAITS = {
  peasant_m: ['peasant_m1', 'peasant_m2', 'peasant_m3', 'peasant_m4', 'peasant_m5', 'peasant_m6'],
  peasant_f: ['peasant_f1', 'peasant_f2', 'peasant_f3', 'peasant_f4', 'peasant_f5', 'peasant_f6'],
  town_m: ['town_m1', 'town_m2', 'town_m3', 'town_m4', 'town_m6', 'town_m7'],
  town_f: ['town_f1', 'town_f2', 'town_f3', 'town_f4', 'town_f5', 'town_f7'],
  merchant_m: ['merchant', 'town_m5'],   // купец — и старый, в худе и с кошелём
  merchant_f: ['town_f3'],               // купчиха — в богатом уборе
  noble_m: ['noble_m1', 'noble_m2', 'noble_m3', 'noble_m4', 'noble_m5'],
  noble_f: ['noble_f1', 'noble_f2', 'noble_f3', 'noble_f4', 'noble_f5', 'noble_f6', 'noble_f7'],
  pagan_m: ['pagan_m1', 'pagan_m2', 'pagan_m3', 'pagan_m4'],
  pagan_f: ['pagan_f1', 'pagan_f2', 'pagan_f3', 'pagan_f4'],
  saracen_m: ['saracen_m1', 'saracen_m2'],
  saracen_f: ['saracen_f1', 'saracen_merchant_f'],
};

// Сарацины Лючеры — свои портреты по ролям (имам — общий «imam»).
const SARACEN_PORTRAITS = {
  elder: 'saracen_elder', guard: 'saracen_guard', knight: 'saracen_guard',
  merchant: ['saracen_merchant_m', 'saracen_merchant_f'], herbalist: ['saracen_healer_m', 'saracen_healer_f'],
  innkeeper: ['saracen_m1', 'saracen_inn_f'],
};

function npcPortrait(npc) {
  const r = npc.role, f = npc.female, place = npc.village.city, t = npc.title;
  if (npc.portrait) return npc.portrait;
  const pick = list => list[[...npc.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % list.length];
  // Монастырь: аббат, а травник, гостинник и братия — монахи.
  if (r === 'alchemist') return f ? 'alchemist_f' : 'alchemist_m';
  if (place.kind === 'monastery') return r === 'priest' ? 'abbot' : r === 'guard' ? 'guard' : r === 'herbalist' ? 'herbalist_monk' : 'monk';
  if (place.kind === 'pagan') return r === 'flamen' ? 'flamen' : pick(f ? PORTRAITS.pagan_f : PORTRAITS.pagan_m);
  // Мальтийцы — и мусульмане, и христиане — говорят по-арабски и одеваются по-африкански.
  // Священник, стража королевского замка и кастелян — люди «латинские».
  const maltese = place.region === 'malta' && ['peasant', 'merchant', 'innkeeper', 'herbalist', 'boatman', 'smith'].includes(r);
  if (maltese && (r === 'smith' || r === 'boatman')) return pick(PORTRAITS.saracen_m);
  if ((place.names === 'saracen' || maltese) && r !== 'priest' && r !== 'smith') {
    const own = SARACEN_PORTRAITS[r];
    if (own) return Array.isArray(own) ? own[f ? 1 : 0] : own;
    return pick(f ? PORTRAITS.saracen_f : PORTRAITS.saracen_m);
  }
  if (r === 'guard') return pick(['guard', 'armed_militia', 'armed_xbow']);
  if (r === 'knight') return pick(['guard', 'castellan', 'armed_vet']);
  if (r === 'noble') return npc.name === 'Манфред' ? 'manfred' : npc.name === 'Фридрих II' ? 'frederick' : pick(f ? PORTRAITS.noble_f : PORTRAITS.noble_m);
  if (r === 'smith') return 'smith';
  if (r === 'boatman') return 'boatman';
  if (r === 'merchant') return pick(f ? PORTRAITS.merchant_f : PORTRAITS.merchant_m);
  if (r === 'innkeeper') return f ? 'town_f1' : 'innkeeper';            // хозяйка с хлебом
  if (r === 'herbalist') return 'herbalist_f';                           // травница с травником и склянкой
  if (r === 'hermit') return 'hermit';
  if (r === 'priest') return /Имам/.test(t) ? 'imam' : /Капеллан/.test(t) || place.kind === 'castle' ? 'chaplain' : 'priest';
  if (r === 'elder') {
    if (place.kind === 'village') return 'elder_village';
    if (/Кастелян|Гастальд/.test(t) || place.kind === 'castle') return 'castellan';
    if (/Консул|Советник|Сенатор/.test(t)) return 'consul';
    return 'podesta';                       // подеста, байюл, ректор, куратор, наместник
  }
  if (r === 'peasant') {
    if (!f && place.kind === 'inn') return 'pilgrim';                    // путник на постоялом дворе
    if (place.kind === 'village') return pick(f ? PORTRAITS.peasant_f : PORTRAITS.peasant_m);
    return pick(f ? PORTRAITS.town_f : PORTRAITS.town_m);                // горожане, люди при замке
  }
  return null;
}

function portraitUrl(name) {
  return (window.PORTRAITS_INLINE && PORTRAITS_INLINE[name]) || `portraits/${name}.webp`;
}

// Значок «i» со справкой об исторической личности (всплывает при наведении).
function historicInfo(npc) {
  const h = HISTORIC[npc.name];
  if (!h) return '';
  return `<span class="info" tabindex="0" aria-label="Справка">i<span class="info-pop"><b>${esc(h.full)}</b>`
    + `<span class="yrs">${esc(h.years)}</span>${esc(h.text)}</span></span>`;
}

function avatarHtml(npc, cls = '') {
  const p = npcPortrait(npc);
  return p ? `<img class="portrait ${cls}" src="${portraitUrl(p)}" alt="">`
    : `<div class="avatar ${cls}" style="color:${npc.color}">${esc(npc.glyph)}</div>`;
}

// ─── Диалог ────────────────────────────────────────────────────────

DialogScreen.prototype.winClass = 'dialog';
DialogScreen.prototype.html = function () {
  const n = this.npc, place = n.village.city;
  const opts = this.options.map((o, i) =>
    `<button class="opt${i === this.sel ? ' sel' : ''}${o.disabled ? ' off' : ''}" data-act="opt" data-i="${i}"><kbd>${i + 1}</kbd>${esc(o.label)}</button>`).join('');
  return `
    <header class="win-head npc">
      ${avatarHtml(n, 'big')}
      <div><h2>${esc(n.name)}${historicInfo(n)}</h2><div class="sub">${esc(n.title)} · ${esc(placeTitle(place))}</div></div>
      ${n.noEscape ? '' : '<button class="x" data-act="close" title="Уйти (Esc)">✕</button>'}
    </header>
    <div class="speech">${esc(this.text)}</div>
    <div class="opts" data-scroll="opts">${opts}</div>
    <footer class="win-foot"><span>Монеты: <b class="gold">${G.player.coins}</b></span><span class="dim">${n.noEscape ? 'от ответа не уйти — выбирай' : 'цифры или клик — ответ, Esc — уйти'}</span></footer>`;
};
DialogScreen.prototype.act = function (a, d) {
  if (a === 'opt') { this.sel = +d.i; this.choose(+d.i); }
};

ChoiceScreen.prototype.winClass = 'dialog';
ChoiceScreen.prototype.html = function () {
  const opts = this.options.map((o, i) =>
    `<button class="opt${i === this.sel ? ' sel' : ''}" data-act="opt" data-i="${i}"><kbd>${i + 1}</kbd>${esc(o.label)}</button>`).join('');
  return winHead(esc(this.title)) + `<div class="opts" data-scroll="opts">${opts}</div>`
    + '<footer class="win-foot"><span class="dim">цифры или клик — выбрать, Esc — отмена</span></footer>';
};
ChoiceScreen.prototype.act = function (a, d) {
  if (a === 'opt') { this.sel = +d.i; this.choose(+d.i); }
};

// ─── Молитвы ───────────────────────────────────────────────────────

PrayerScreen.prototype.winClass = 'prayer';
PrayerScreen.prototype.html = function () {
  const p = G.player, list = this.list();
  const rows = list.map((e, i) => {
    if (e.pr) {
      const locked = e.pr.order || p.stats.fai < e.pr.fai;
      const cost = e.pr.order ? 'орден' : locked ? `Вера ${e.pr.fai}` : `${e.pr.cost} благ.`;
      const text = e.pr.order ? 'откроется в духовном ордене' : locked ? 'ещё не постиг' : e.pr.text(p);
      return `<button class="card${i === this.sel ? ' sel' : ''}${locked ? ' off' : ''}" data-act="pray" data-i="${i}">
        <span class="t"><kbd>${i + 1}</kbd>${esc(e.pr.name)}</span><span class="c ${!locked && p.grace < e.pr.cost ? 'bad' : ''}">${cost}</span>
        <span class="d">${esc(text)}</span></button>`;
    }
    const ready = p.favor >= FAVOR_COST;
    return `<button class="card saint${i === this.sel ? ' sel' : ''}${ready ? '' : ' off'}" data-act="pray" data-i="${i}" style="--saint:${e.saint.color}">
      <span class="t"><kbd>${i + 1}</kbd>☩ ${esc(e.saint.miracle)}</span><span class="c">милость ${p.favor}/${FAVOR_COST}</span>
      <span class="d">Чудо: ${esc(e.saint.miracleText)}</span></button>`;
  }).join('');
  return winHead('Молитвы', `Благодать <b>${p.grace}/${p.maxGrace}</b> · благочестие <b>${p.piety}</b> (${pietyRank(p.piety).toLowerCase()}) · услышат: <b>${Math.round(prayerChance(p) * 100)}%</b>`)
    + `<div class="cards" data-scroll="pr">${rows}</div>`
    + `<footer class="win-foot dim">${p.patron ? 'Клик или цифра — молиться.' : 'Святого покровителя обретают в паломничестве к его мощам.'}</footer>`;
};
PrayerScreen.prototype.act = function (a, d) {
  if (a === 'pray') { this.sel = +d.i; this.key({ code: 'Enter' }); }
};

// ─── Котомка ───────────────────────────────────────────────────────

const PAPERDOLL = [
  ['relic1', 'r1'], ['head', 'head'], ['relic2', 'r2'],
  ['right', 'right'], ['body', 'body'], ['left', 'left'],
  ['arms', 'arms'], ['legs', 'legs'], ['feet', 'feet'],
  ['relic3', 'r3'],
];

// Сравнение предмета с надетым в тот же слот.
function itemDiff(it, cur) {
  const avg = d => d ? (d[0] + d[1]) / 2 : 0;
  const val = (x, k) => !x ? 0 : k === 'dmg' ? avg(x.ranged ? x.ranged.rdmg : x.dmg) : k === 'acc' ? (x.acc || 0) + (x.ranged && x.ranged.racc || 0) : x[k] || 0;
  const props = [['dmg', 'урон'], ['acc', 'меткость'], ['armor', 'защита'], ['ev', 'уклонение'], ['dmgBonus', 'урон'], ['vsUnholy', 'по нечисти'],
    ['light', 'свет'], ['sight', 'обзор'], ['unholyArmor', 'от нечисти'], ['w', 'вес']];
  const out = [];
  for (const [k, name] of props) {
    const dv = Math.round((val(it, k) - val(cur, k)) * 10) / 10;
    if (!dv) continue;
    const good = k === 'w' ? dv < 0 : dv > 0;
    out.push(`<span class="${good ? 'up' : 'down'}">${dv > 0 ? '+' : ''}${dv} ${name}</span>`);
  }
  return out.join('');
}

function itemCard(it, slotLabel, cur) {
  if (!it) return `<div class="card-empty">${slotLabel ? `${esc(slotLabel)}: пусто.` : 'Выбери предмет.'}</div>`;
  const stats = itemStats(it);
  const slot = SLOTS.find(([s]) => s === (KIND_SLOTS[it.kind] || [])[0]);
  return `<div class="item-card">
    <h3>${esc(it.name)}</h3>
    <div class="dim">${slot ? esc(slot[1].replace(/ I+$/, '')) : ''}${it.two ? ' · двуручное' : ''} · вес ${it.w} · цена ${it.value} мон.</div>
    ${stats ? `<p>${esc(cap(stats))}.</p>` : ''}
    ${it.note ? `<p class="note">${esc(cap(it.note))}.</p>` : ''}
    ${cur !== undefined ? `<div class="diff">${cur ? `<span class="dim">против «${esc(cur.name)}»:</span> ` : '<span class="dim">слот свободен</span> '}${cur ? itemDiff(it, cur) || '<span class="dim">то же самое</span>' : ''}</div>` : ''}
  </div>`;
}

InventoryScreen.prototype.winClass = 'inventory';
InventoryScreen.prototype.html = function () {
  const p = G.player, w = p.weaponDef;
  const slotHtml = PAPERDOLL.map(([slot, area]) => {
    const i = SLOTS.findIndex(([s]) => s === slot), it = p.equip[slot], sel = this.side === 0 && this.sel[0] === i;
    return `<div class="slot${sel ? ' sel' : ''}${it ? '' : ' vacant'}" style="grid-area:${area}" data-act="pick" data-side="0" data-i="${i}">
      <span class="sl">${esc(SLOTS[i][1])}</span><span class="it">${it ? esc(it.name) : '—'}</span></div>`;
  }).join('');
  const dmg = w.ranged ? w.ranged.rdmg.join('–') : `${Math.max(1, w.dmg[0] + p.dmgBonus(null))}–${w.dmg[1] + p.dmgBonus(null)}`;
  const summary = [['Защита', p.armor], ['Уклонение', p.ev], ['Меткость', p.hit], ['Урон', dmg],
    ['Свет', gearSum(p, 'light') ? `+${gearSum(p, 'light')}` : 'нет'],
    ['Запасы', Object.keys(AMMO).filter(a => p.ammo[a] > 0).map(a => `${AMMO[a].name.toLowerCase()} ${p.ammo[a]}`).join(', ') || 'нет'],
    ['Животное', p.mount ? MOUNTS[p.mount.kind].name : 'нет']]
    .map(([k, v]) => `<div><span>${k}</span><b>${esc(String(v))}</b></div>`).join('');
  const bag = p.bag.length ? p.bag.map((it, i) => {
    const slot = SLOTS.find(([s]) => s === KIND_SLOTS[it.kind][0]);
    return `<div class="row${this.side === 1 && this.sel[1] === i ? ' sel' : ''}" data-act="pick" data-side="1" data-i="${i}">
      <span class="nm">${esc(it.name)}</span><span class="dim">${esc(slot[1].replace(/ I+$/, ''))}</span><span class="dim r">${it.w}</span></div>`;
  }).join('') : '<div class="dim pad">Мешок пуст.</div>';
  const goods = GOOD_IDS.filter(id => p.goods[id]).map(id => `${GOODS[id].name} ×${p.goods[id]}`);
  const tro = Object.values(p.trophies).filter(t => t.count).map(t => `${t.name} ×${t.count}`);
  const brews = Object.entries(p.brews || {}).filter(([, n]) => n > 0).map(([id, n]) => `${RECIPES[id].name} ×${n}`);
  const cargo = p.quests.filter(q => q.type === 'deliver').map(q => `«${q.item}»`);
  const chipList = (title, list, cls = '') => list.length ? `<div class="sect">${title}</div><div class="tags ${cls}">${list.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : '';

  const it = this.side === 0 ? p.equip[SLOTS[this.sel[0]][0]] : p.bag[this.sel[1]];
  const cur = this.side === 1 && it ? p.equip[(KIND_SLOTS[it.kind] || [])[0]] || null : undefined;
  const btns = [];
  if (it) btns.push(`<button class="btn main" data-act="use">${this.side === 0 ? 'Снять' : 'Надеть'} <kbd>Enter</kbd></button>`, `<button class="btn" data-act="drop">Выбросить <kbd>D</kbd></button>`);
  if (p.potions) btns.push(`<button class="btn" data-act="quaff">Выпить отвар (${p.potions}) <kbd>Q</kbd></button>`);

  return winHead('Снаряжение и котомка', '', `<div class="head-stats"><span>Монеты <b class="gold">${p.coins}</b></span><span>Груз <b class="${carryLoad(p) > p.capacity ? 'bad' : ''}">${carryLoad(p)}/${p.capacity}</b></span></div>`)
    + `<div class="inv-body">
      <section class="doll-col"><div class="sect">На теле</div><div class="doll">${slotHtml}</div><div class="summary">${summary}</div></section>
      <section class="bag-col"><div class="sect">Мешок</div><div class="list" data-scroll="bag">${bag}</div>
        ${chipList('Зелья (A — алхимия)', brews)}${chipList('Товары', goods)}${chipList('Трофеи и травы', tro)}${chipList('Поклажа по заданиям', cargo, 'sky')}</section>
      <section class="info-col">${itemCard(it, this.side === 0 ? SLOTS[this.sel[0]][1] : '', cur)}
        <div class="btns">${btns.join('')}</div>${this.note ? `<div class="note-line">${esc(this.note)}</div>` : ''}</section>
    </div>`
    + keys([['↑↓', 'выбор'], ['Tab', 'тело / мешок'], ['Enter', 'надеть / снять'], ['D', 'выбросить'], ['двойной клик', 'надеть'], ['Esc', 'закрыть']]);
};
InventoryScreen.prototype.act = function (a, d, dbl) {
  if (a === 'pick') {
    this.side = +d.side;
    this.sel[this.side] = +d.i;
    this.note = '';
    if (dbl) this.key({ code: 'Enter' });
  } else if (a === 'use') this.key({ code: 'Enter' });
  else if (a === 'drop') this.key({ code: 'KeyD' });
  else if (a === 'quaff') this.key({ code: 'KeyQ' });
};

// ─── Торговля ──────────────────────────────────────────────────────

TradeScreen.prototype.winClass = 'trade';
TradeScreen.prototype.html = function () {
  const p = G.player, n = this.npc;
  const col = (side, title, empty) => {
    const rows = this.rows(side);
    const body = rows.length ? rows.map((r, i) => {
      const sel = this.side === side && this.sel[side] === i;
      let price = '<span class="dim">—</span>';
      if (r.price !== null) {
        const ratio = r.base ? r.price / r.base : 1, sense = priceSense();
        const good = sense && (side === 0 ? ratio < 0.85 : ratio > 1.1), bad = sense && (side === 0 ? ratio > 1.25 : ratio < 0.6);
        price = `<b class="${good ? 'up' : bad ? 'down' : 'gold'}">${r.price}</b>`;
      }
      const can = r.price !== null;
      return `<div class="row${sel ? ' sel' : ''}${can ? '' : ' off'}" data-act="pick" data-side="${side}" data-i="${i}">
        <span class="nm">${esc(r.label)}</span><span class="q">${r.qty}</span><span class="p">${price}</span>
        <span class="deal">${can ? `<button data-act="deal" data-side="${side}" data-i="${i}" data-n="1">${side ? 'продать' : 'купить'}</button>${r.qty !== 1 ? `<button data-act="deal" data-side="${side}" data-i="${i}" data-n="999">всё</button>` : ''}` : ''}</span></div>`;
    }).join('') : `<div class="dim pad">${empty}</div>`;
    return `<section class="tcol${this.side === side ? ' active' : ''}"><div class="sect">${title}<span class="cols"><span>есть</span><span>цена</span></span></div><div class="list" data-scroll="t${side}">${body}</div></section>`;
  };
  const cur = this.rows(this.side)[this.sel[this.side]];
  let info = '';
  if (cur && cur.id) info = `${GOODS[cur.id].name}: ${GOODS[cur.id].unit}, мест ${GOODS[cur.id].w}.${priceSense() ? ` Обычная цена ≈ ${GOODS[cur.id].base} мон.` : ''}`;
  const gi = cur && (cur.item || (cur.gear && ITEMS[cur.gear]));
  if (gi) info = `${gi.name}: ${itemStats(gi)}${gi.note ? ` — ${gi.note}` : ''}. Мест ${gi.w}.`;
  return winHead(`${avatarHtml(n, 'small')}Торговля`, `${esc(n.name)}, ${esc(n.title.toLowerCase())} · ${esc(placeTitle(this.place))}`,
    `<div class="head-stats"><span>Монеты <b class="gold">${p.coins}</b></span><span>Груз <b>${carryLoad(p)}/${p.capacity}</b></span></div>`)
    + `<div class="trade-body">${col(0, 'Купить', 'Здесь нечего купить.')}${col(1, 'Продать', 'Тебе нечего продать.')}</div>
    <div class="trade-info">
      ${this.note ? `<div class="note-line">${esc(this.note)}</div>` : ''}
      ${info ? `<div>${esc(info)}</div>` : ''}
      ${priceSense() ? '<div class="legend"><span class="up">выгодно</span><span class="gold">обычно</span><span class="down">дорого</span></div>'
        : '<div class="dim">Дёшево это или дорого — не разобрать: нужен намётанный глаз торговца.</div>'}
    </div>`
    + keys([['↑↓', 'выбор'], ['Tab', 'купить / продать'], ['Enter', '1 шт.'], ['A', 'всё'], ['Esc', 'закрыть']]);
};
TradeScreen.prototype.act = function (a, d, dbl) {
  if (a !== 'pick' && a !== 'deal') return;
  this.side = +d.side;
  this.sel[this.side] = +d.i;
  if (a === 'deal' || dbl) this.key({ code: d.n === '999' ? 'KeyA' : 'Enter' });
};

// ─── Бестиарий ─────────────────────────────────────────────────────

BestiaryScreen.prototype.winClass = 'bestiary';
BestiaryScreen.prototype.html = function () {
  const p = G.player, chs = this.chapters, toc = this.ch < 0;
  const known = BEAST_ORDER.filter(k => p.seen[k]).length;
  const roman = i => ROMAN[i] || String(i + 1);
  const tabs = [`<button class="tab${toc ? ' on' : ''}" data-act="toc">Оглавление</button>`]
    .concat(chs.map((c, i) => `<button class="tab${this.ch === i ? ' on' : ''}" data-act="chap" data-i="${i}" title="${esc(c.name)}">${roman(i)}. ${esc(c.name)}</button>`)).join('');
  let left, right;
  if (toc) {
    left = chs.map((c, i) => {
      const have = c.keys.filter(k => p.seen[k]).length;
      return `<div class="row${i === this.csel ? ' sel' : ''}" data-act="csel" data-i="${i}"><span class="ic">${roman(i)}</span>`
        + `<span class="nm">${esc(c.name)}</span><span class="st${have ? '' : ' dim'}">${have}/${c.keys.length}</span></div>`;
    }).join('');
    const c = chs[this.csel], seen = c.keys.filter(k => p.seen[k]);
    right = `<div class="kind">Глава ${roman(this.csel)}. ${esc(c.name)}</div>`
      + `<blockquote>${esc(BEAST_CHAPTERS[c.name] || '')}</blockquote>`
      + (seen.length ? `<div class="sect">Встречены</div><div class="seen">${seen.map(k => `<span class="tag" data-act="open" data-ch="${this.csel}" data-k="${k}">`
        + `<b style="color:${BEASTS[k].color}">${esc(BEASTS[k].glyph)}</b> ${esc(BEASTS[k].name)}</span>`).join('')}</div>`
        : '<p class="dim">Страницы пока чисты.</p>')
      + `<p><button class="btn main" data-act="chap" data-i="${this.csel}">Открыть главу →</button></p>`;
  } else {
    const c = chs[this.ch];
    left = c.keys.map((k, i) => {
      const d = BEASTS[k], seen = p.seen[k];
      return `<div class="row${i === this.sel ? ' sel' : ''}${seen ? '' : ' off'}" data-act="beast" data-i="${i}"><span class="ic" style="color:${seen ? d.color : 'inherit'}">${seen ? esc(d.glyph) : '?'}</span>`
        + `<span class="nm">${seen ? esc(d.name) : '???'}</span><span class="st">${p.kills[k] ? '⚔' + p.kills[k] : ''}</span></div>`;
    }).join('');
    right = beastEntryHtml(c.keys[this.sel]);
  }
  const nav = toc ? '' : `<button class="tab" data-act="prev" title="Предыдущая глава (←)">‹</button><button class="tab" data-act="next" title="Следующая глава (→)">›</button>`;
  return winHead('Liber bestiarum', `Книга о тварях Италии · записано <b>${known}</b> из ${BEAST_ORDER.length}`, `<nav class="tabs">${nav}</nav>`)
    + `<nav class="tabs chapters">${tabs}</nav>`
    + `<div class="jr-body best-body"><div class="list" data-scroll="b${this.ch}">${left}</div><div class="detail">${right}</div></div>`
    + keys(toc ? [['↑↓', 'глава'], ['Enter', 'открыть'], ['клик', 'выбрать, ещё клик — открыть'], ['Esc', 'закрыть']]
      : [['↑↓', 'запись'], ['←→', 'главы'], ['клик', 'выбрать'], ['Esc', 'к оглавлению']]);
};
BestiaryScreen.prototype.act = function (a, d, dbl) {
  if (a === 'toc') this.ch = -1;
  else if (a === 'csel') { if (dbl || this.csel === +d.i) this.open(+d.i); else this.csel = +d.i; }
  else if (a === 'chap') this.open(+d.i);
  else if (a === 'beast') this.sel = +d.i;
  else if (a === 'prev') this.open(this.ch - 1);
  else if (a === 'next') this.open(this.ch + 1);
  else if (a === 'open') { this.open(+d.ch); this.sel = Math.max(0, this.chapters[this.ch].keys.indexOf(d.k)); }
};

function beastEntryHtml(key) {
  const p = G.player, d = BEASTS[key];
  if (!p.seen[key]) return `<div class="kind dim">???</div><p class="dim">Ты ещё не встречал это существо.</p>`
    + `<p class="dim">Ходят слухи, что оно водится здесь: ${esc(beastRange(d))}.</p>${d.night ? '<p class="dim">Говорят, оно выходит лишь по ночам.</p>' : ''}`;
  const kills = p.kills[key] || 0, knows = kills > 0 || p.stats.wis >= d.lore;
  let h = `<div class="kind"><span><b style="color:${d.color}">${esc(d.glyph)}</b> ${esc(d.name)}</span>${d.unholy ? '<span class="st violet">† нечисть</span>' : ''}</div>`
    + `<blockquote>${esc(d.desc + beastAka(d))}</blockquote><dl>`
    + `<dt>Обитает</dt><dd>${esc(d.habitat.map(x => HABITAT[x]).join(', ') + (d.night ? ' (ночью)' : ''))}</dd>`
    + `<dt>Где</dt><dd>${esc(beastRange(d))}</dd><dt>Убито</dt><dd>${kills}</dd></dl>`;
  if (!knows) return h + `<p class="dim">Повадки неизвестны. Убей такого зверя или развивай Мудрость (нужно ${d.lore}).</p>`;
  const special = [
    d.poison && 'ядовит', d.confuse && 'сводит с ума', d.drain && 'пьёт силу, исцеляясь',
    d.graceDrain && 'высасывает благодать', d.steal && 'крадёт монеты',
    d.ranged && `бьёт издалека (до ${d.ranged.range} клеток)`, d.lure && 'заманивает пением',
    d.regen && 'раны затягиваются сами', d.unholy && 'боится молитвы', d.curse && 'убийство лишает благодати',
  ].filter(Boolean);
  const prize = [d.loot && `${d.loot.name} (~${d.loot.value} мон.)`, d.coins && 'монеты'].filter(Boolean).join(', ');
  return h + '<div class="sect">Повадки</div><dl>'
    + `<dt>Нрав</dt><dd>${esc(BEHAVIOR_TEXT[d.behavior] + (d.under ? `; под землёй — ${BEHAVIOR_TEXT[d.under]}` : ''))}</dd>`
    + (aimOn() ? `<dt>Куда бить</dt><dd>${esc(Object.values(ANATOMY[anatomyOf({ key, def: d })].zones).join(', '))}${HELMED.has(key) ? ' · в шлеме' : ''}</dd>` : '')
    + `<dt>Здоровье</dt><dd>${d.hp}</dd><dt>Урон</dt><dd>${d.steal ? 'не бьёт' : `${d.dmg[0]}–${d.dmg[1]}`}</dd>`
    + `<dt>Шкура</dt><dd>${d.armor ? `толстая (${d.armor})` : 'обычная'}</dd>`
    + `<dt>Скорость</dt><dd>${d.speed > 105 ? 'быстрее человека' : d.speed < 95 ? 'медленнее человека' : 'как у человека'}</dd>`
    + (special.length ? `<dt>Особое</dt><dd>${esc(special.join(', '))}</dd>` : '')
    + `<dt>Добыча</dt><dd>${esc(prize || '—')}</dd></dl>`;
}

// ─── Журнал ────────────────────────────────────────────────────────

JournalScreen.prototype.winClass = 'journal';
JournalScreen.prototype.html = function () {
  const p = G.player, list = this.entries();
  this.sel = Math.min(this.sel, Math.max(0, list.length - 1));
  const tabs = [`Задания <i>${p.quests.length}</i>`, `Слухи <i>${(p.rumors || []).length}</i>`, 'Календарь', 'Хроника']
    .map((t, i) => `<button class="tab${i === this.tab ? ' on' : ''}" data-act="tab" data-t="${i}"><kbd>${i + 1}</kbd>${t}</button>`).join('');
  let body;
  if (this.tab === 2) body = calendarHtml();
  else if (this.tab === 3) body = chronicleHtml(p);
  else if (!list.length) body = `<div class="win-empty">${this.tab === 0 ? 'Заданий нет. Спроси работу у старост, трактирщиков, кузнецов, травниц и священников.' : 'Ты пока ничего не слышал. Расспроси людей: «Что нового в округе?»'}</div>`;
  else {
    const rows = list.map((e, i) => {
      if (this.tab === 0) {
        const icon = e.type === 'story' ? '✶' : e.type === 'escort' ? '⚑' : e.type === 'relic' || e.lairKind === 'thieves' ? '✝' : e.type === 'kill' ? '⚔' : e.type === 'trophy' ? '⚘' : e.type === 'lair' ? '☠' : e.type === 'work' ? '⚒' : '✉';
        return `<div class="row${i === this.sel ? ' sel' : ''}${e.done ? ' done' : ''}" data-act="pick" data-i="${i}"><span class="ic">${icon}</span><span class="nm">${esc(questLine(e))}</span></div>`;
      }
      const st = rumorStatus(e), icon = e.kind === 'lead' ? '!' : e.kind === 'tomb' ? 'Π' : e.kind === 'lore' ? '~' : '•';
      return `<div class="row${i === this.sel ? ' sel' : ''}${st.old ? ' old' : ''}" data-act="pick" data-i="${i}"><span class="ic ${e.kind}">${icon}</span><span class="nm">${esc(e.title || e.text)}</span><span class="st" style="color:${st.color}">${esc(st.text)}</span></div>`;
    }).join('');
    body = `<div class="jr-body"><div class="list" data-scroll="j${this.tab}">${rows}</div><div class="detail">${this.tab === 0 ? questDetail(list[this.sel]) : rumorDetail(list[this.sel])}</div></div>`;
  }
  return winHead('Журнал', '', `<nav class="tabs">${tabs}</nav>`) + body
    + keys([['1–4', 'вкладки'], ['↑↓', 'выбор'], ['Esc', 'закрыть']]);
};
JournalScreen.prototype.act = function (a, d) {
  if (a === 'tab') { this.tab = +d.t; this.sel = 0; }
  if (a === 'pick') this.sel = +d.i;
};

const kv = rows => `<dl>${rows.filter(Boolean).map(([k, v, cls]) => `<dt>${k}</dt><dd class="${cls || ''}">${esc(v)}</dd>`).join('')}</dl>`;

// Что рассказали о дороге к цели задания.
function questWhere(e) {
  if (!e.road) return '';
  return `<div class="q-road"><span class="ic">☞</span><div>${esc(e.road.text)}<small>${esc(e.road.who)}, ${esc(e.road.where)}</small></div></div>`;
}

function questDetail(e) {
  if (e.type === 'story') return `<div class="kind">Сквозное задание</div>${questWhere(e)}<p class="body">${esc(e.text || '')}</p>`
    + kv([e.giverName && ['Дал', e.giverName], e.fromName && ['Откуда', e.fromName], e.day && ['Начато', dateText(dateOfDay(e.day), false)]]);
  const kind = e.type === 'kill' ? 'Охота' : e.type === 'trophy' ? 'Заказ замка: трофеи' : e.type === 'lair' ? (e.lairKind === 'thieves' ? 'Ограбление святыни' : 'Логово (сложное)') : e.type === 'work' ? 'Работа на месте' : e.type === 'relic' ? 'Святыня для храма' : e.type === 'escort' ? (e.kind === 'caravan' ? 'Охрана обоза' : 'Сопровождение паломников') : 'Доставка';
  const rows = [e.giverName && ['Дал', e.giverName], ['Откуда', e.fromName], e.day && ['Взято', dateText(dateOfDay(e.day), false)]];
  if (e.type === 'lair') {
    const left = e.deadline - timeInfo().day, lead = (G.leads || []).find(l => l.id === e.lead);
    rows.push(['Срок', left >= 0 ? `ещё ${left} дн. (до ${dateText(dateOfDay(e.deadline), false)})` : 'вышел', left >= 0 ? '' : 'bad']);
    if (lead && !lead.known) rows.push(['Приметы', e.hint || 'место неизвестно — ищи']);
    else if (lead) rows.push(['Где', `близ ${lead.anchor}, ≈${Math.round(Math.hypot((lead.x - G.ox) * GEO.kmX, (lead.y - G.oy) * GEO.kmY))} км отсюда, знак «!» на карте`]);
  } else if (e.type === 'deliver') {
    const left = e.deadline - timeInfo().day;
    rows.push(['Кому', `${e.toTitle}, ${e.toName}`], ['Срок', left >= 0 ? `ещё ${left} дн. (до ${dateText(dateOfDay(e.deadline), false)})` : 'просрочено — заплатят половину', left >= 0 ? '' : 'bad']);
  } else if (e.type === 'escort') {
    const t = (G.travelers || []).find(x => x.id === e.traveler);
    rows.push(['Куда', e.toName], ['Подопечные', t ? (t.waiting ? 'отстали — вернись за ними' : 'идут с тобой') : 'пропали', t && !t.waiting ? 'up' : 'bad']);
  } else if (e.type === 'relic') {
    const site = G.over.sites.find(s => s.id === e.site);
    rows.push(['Где', `${site ? site.name : '?'}, ${e.depth + 1}-й уровень`], ['Ларец', e.done ? 'у тебя' : 'ещё в подземелье', e.done ? 'up' : '']);
  } else if (e.type === 'trophy') {
    const h = Math.min(e.need, trophyHave(e));
    rows.push(['Добыто', `${h} из ${e.need} (трофеи падают со зверя — подбери их)`, h >= e.need ? 'up' : '']);
  } else rows.push(['Ход', `${e.have} из ${e.need}`, e.done ? 'up' : '']);
  rows.push(['Награда', `${e.reward} мон., ${e.xp} опыта`, 'gold']);
  const haveN = e.type === 'trophy' ? Math.min(e.need, trophyHave(e)) : e.have, ready = e.done || (e.type === 'trophy' && haveN >= e.need);
  const prog = e.type !== 'deliver' && e.type !== 'lair' && e.type !== 'relic' && e.type !== 'escort' ? `<div class="track big"><div class="fill" style="width:${haveN / e.need * 100}%"></div></div>` : '';
  return `<div class="kind">${kind}</div>${questWhere(e)}<p class="body">${esc(e.text || '')}</p>${prog}${kv(rows)}${ready ? `<p class="up">Готово! Возвращайся: ${esc(e.fromName)}.</p>` : ''}`;
}

function daysAgo(n) { return n <= 0 ? 'сегодня' : n === 1 ? 'вчера' : `${n} дн. назад`; }

function rumorDetail(e) {
  const st = rumorStatus(e), day = timeInfo().day;
  let tail = '';
  if (e.kind === 'lead') {
    const lead = (G.leads || []).find(l => l.id === e.lead);
    if (lead && !lead.done && lead.until >= day) {
      const km = Math.round(Math.hypot((lead.x - G.ox) * GEO.kmX, (lead.y - G.oy) * GEO.kmY));
      tail = `<p class="gold">Место отмечено на карте знаком «!». Отсюда ≈${km} км. Поспеши — через ${lead.until - day} дн. тут ничего не останется.</p>`;
    } else if (lead && lead.done) tail = '<p class="up">Ты побывал там. Слух оказался правдой.</p>';
    else tail = '<p class="dim">Время ушло. Что бы там ни было — теперь этого нет.</p>';
  } else if (e.kind === 'news' && st.old) tail = '<p class="dim">Ты слышал это давно. С тех пор всё могло перемениться.</p>';
  if (e.kind === 'tomb') {
    const t = G.over.sites.find(s => s.id === e.tomb);
    if (t) {
      const km = Math.round(Math.hypot((t.x - G.ox) * GEO.kmX, (t.y - G.oy) * GEO.kmY));
      tail = G.dungeons[t.id] ? '<p class="up">Ты спускался туда.</p>'
        : `<p class="gold">Место отмечено на карте знаком «Π». Отсюда ≈${km} км. Бери факел.</p>`;
    }
  }
  return `<div class="kind">${e.kind === 'lead' || e.kind === 'tomb' ? 'Наводка' : e.kind === 'lore' ? 'Поверье' : 'Весть'}<span class="st" style="color:${st.color}">${esc(st.text)}</span></div>
    <blockquote class="${st.old ? 'old' : ''}">${esc(e.text)}</blockquote>
    ${kv([['Слышал от', e.source], ['Услышал', `${dateText(dateOfDay(e.day), false)} (${daysAgo(day - e.day)})`],
      e.kind === 'news' && e.newsDay !== undefined && e.newsDay < e.day - 1 && ['Случилось', daysAgo(day - e.newsDay)]])}${tail}`;
}

function calendarHtml() {
  const dt = today(), s = SEASONS[seasonOf(dt)], w = weatherNow(), sun = sunTimes(dt), p = G.player, day0 = timeInfo().day;
  const first = dateOfDay(day0 - dt.d + 1), col0 = (first.wd + 6) % 7;
  let cells = '<span class="wd">пн</span><span class="wd">вт</span><span class="wd">ср</span><span class="wd">чт</span><span class="wd">пт</span><span class="wd">сб</span><span class="wd sun">вс</span>';
  for (let i = 0; i < col0; i++) cells += '<span></span>';
  for (let d = 1; d <= 31; d++) {
    const cur = dateOfDay(day0 - dt.d + d);
    if (cur.m !== dt.m) break;
    const feasts = feastsOn(cur), mine = p.patron && feasts.some(f => f.saint === p.patron);
    const cls = [d === dt.d && 'today', feasts.length && 'feast', mine && 'mine', cur.wd === 0 && 'sun'].filter(Boolean).join(' ');
    cells += `<span class="${cls}" title="${esc(feasts.map(f => f.name).join('; '))}"${mine ? ` style="--saint:${SAINTS[p.patron].color}"` : ''}>${d}</span>`;
  }
  const feasts = upcomingFeasts(8).map(f => {
    const when = f.inDays === 0 ? 'сегодня' : f.inDays === 1 ? 'завтра' : `через ${f.inDays} дн.`;
    const mine = p.patron && f.saint === p.patron;
    return `<li class="${f.major ? 'major' : ''}${mine ? ' mine' : ''}"><span class="d">${f.dt.d} ${MONTHS_GEN[f.dt.m - 1]}</span><span><b>${esc(f.name)}</b>${mine ? ' — твой покровитель!' : ''} <i>${when}</i>${f.text ? `<small>${esc(f.text)}</small>` : ''}</span></li>`;
  }).join('');
  return `<div class="cal-body">
    <section>
      <div class="today-big">${cap(WEEKDAYS[dt.wd])}, ${dateText(dt, false)} года</div>
      <div class="sky-line"><span style="color:${s.color}">${s.icon} ${s.name}</span><span style="color:${w.color}">${w.icon} ${w.name}</span><span>восход ${hhmm(sun.rise)}</span><span>закат ${hhmm(sun.set)}</span>${isLent(dt) ? '<span class="violet">Великий пост</span>' : ''}</div>
      <div class="month-name">${cap(MONTHS[dt.m - 1])} ${dt.y}</div>
      <div class="month">${cells}</div>
      <p class="dim season">${esc(SEASON_HINT[seasonOf(dt)])}</p>
    </section>
    <section><div class="sect">Ближайшие праздники</div><ul class="feasts" data-scroll="feasts">${feasts}</ul></section>
  </div>`;
}

// ─── Лист героя ────────────────────────────────────────────────────

CharacterScreen.prototype.winClass = 'character';
CharacterScreen.prototype.html = function () {
  const p = G.player, w = p.weaponDef, saint = p.patron && SAINTS[p.patron];
  const stats = STATS.map((s, i) => `<div class="stat${p.statPoints && i === this.sel ? ' sel' : ''}" data-act="pick" data-i="${i}">
      <span class="v">${p.stats[s.key]}</span><div><b>${s.name}</b><small>${esc(s.desc)}</small></div>
      ${p.statPoints ? `<button class="plus" data-act="raise" data-i="${i}" title="Повысить">+</button>` : ''}</div>`).join('');
  const dmg = w.ranged ? w.ranged.rdmg.join('–') : `${Math.max(1, w.dmg[0] + p.dmgBonus(null))}–${w.dmg[1] + p.dmgBonus(null)}`;
  const derived = kv([['Здоровье', `${p.hp}/${p.maxHp}`], ['Благодать', `${p.grace}/${p.maxGrace}`], ['Опыт', `${p.xp}/${p.xpNext}`],
    ['Меткость', String(p.hit)], ['Уклонение', String(p.ev)], ['Урон', `${dmg} (${w.name.toLowerCase()})`], ['Защита', String(p.armor)],
    ['Зрение день / ночь', `${p.sightDay} / ${p.sightNight}`], ['Груз', `${carryLoad(p)}/${p.capacity}`],
    ['Сытость', `${Math.round(p.food)}/100${hungerState(p) ? ' — голоден' : ''}`], ['Усталость', `${Math.round(p.fatigue)}/100${fatigueState(p) ? ' — пора спать' : ''}`],
    ['Провиант', `${p.rations} дн.`]]);
  const derivedFame = kv([['Слава', `${fameOf(p)} · ${fameRank().toLowerCase()}`]]);
  const faith = kv([['Благочестие', `${p.piety} · ${pietyRank(p.piety).toLowerCase()}`], ['Молитву услышат', `${Math.round(prayerChance(p) * 100)}%`],
    ['Покровитель', saint ? saint.name : 'нет — обретается паломничеством'], saint && ['Милость святого', `${p.favor}/${FAVOR_COST} на чудо`]]);
  return winHead(esc(p.name), `${p.title ? esc(p.title) + " · " : ""}${esc(p.people.name)} · ${esc(p.people.land)} · ${p.level}-й уровень`,
    p.statPoints ? `<div class="head-stats"><span class="up">Свободных очков: <b>${p.statPoints}</b></span></div>` : '')
    + `<div class="char-body">
      <section><div class="sect">Характеристики</div><div class="stat-list">${stats}</div>
        <div class="sect">Народ</div><p class="up">${esc(p.people.perk)}</p><p class="dim">${esc(p.people.lore)}</p></section>
      <section><div class="sect">Показатели</div>${derived}
        <div class="sect">Слава</div>${derivedFame}${(p.deeds || []).length ? `<p class="dim">Говорят, ты ${esc(p.deeds[0])}.</p>` : ''}
        <div class="sect">Вера</div>${faith}${saint ? `<p class="up">${esc(saint.passiveText)}</p>` : ''}</section>
      <section>${skillsHtml(p)}</section>
    </div>`
    + keys(p.statPoints ? [['↑↓', 'выбор'], ['Enter', 'повысить'], ['Esc', 'закрыть']] : [['Esc', 'закрыть']]);
};
CharacterScreen.prototype.act = function (a, d) {
  if (a === 'pick' || a === 'raise') this.sel = +d.i;
  if (a === 'raise') this.key({ code: 'Enter' });
};

// Навыки: по группам, уровень и полоска до следующего.
function skillsHtml(p) {
  const bg = BACKGROUNDS.find(b => b.id === p.background);
  const groups = {};
  for (const [k, s] of Object.entries(SKILLS)) (groups[s.group] = groups[s.group] || []).push(k);
  const cols = Object.entries(groups).map(([g, keys]) => `<div><div class="sect">${g}</div>` + keys.map(k => {
    const st = (p.skills && p.skills[k]) || { lvl: 0, xp: 0 }, max = st.lvl >= SKILL_MAX;
    const pct = max ? 100 : Math.min(100, st.xp / skillNeed(st.lvl) * 100);
    return `<div class="skill${st.lvl ? '' : ' zero'}" title="${esc(SKILLS[k].desc)}"><span>${SKILLS[k].name}</span>`
      + `<div class="track"><div class="fill" style="width:${pct}%"></div></div><b>${st.lvl}</b></div>`;
  }).join('') + '</div>').join('');
  return `<div class="skills-box"><div class="sect" title="Растут от дела: бьёшь мечом — растут клинки, ходишь по горам — атлетика">Навыки${bg ? ` <i>· ${esc(bg.name.toLowerCase())}</i>` : ''}</div>`
    + `<div class="skill-cols">${cols}</div></div>`;
}

// Хроника: летопись пути, по дням, от начала к сегодняшнему дню.
function chronicleHtml(p) {
  const list = p.chronicle || [], s = chronicleSummary(p);
  const head = `<div class="chron-head">
    <span><b>${s.days}</b> дн. в пути</span><span><b>${s.level}</b>-й уровень</span><span>городов: <b>${s.cities}</b></span>
    <span>заданий: <b>${s.quests}</b></span><span>хозяев подземелий: <b>${s.bosses}</b></span><span>сражено: <b>${s.kills}</b></span></div>`;
  if (!list.length) return head + '<div class="win-empty">Летопись пока пуста.</div>';
  let lastDay = null, rows = '';
  for (const e of list) {
    if (e.day !== lastDay) {
      const dt = dateOfDay(e.day);
      rows += `<div class="chron-day">${dateText(dt, false)} <i>· ${esc(e.where || '')}</i></div>`;
      lastDay = e.day;
    }
    rows += `<div class="chron-row ${e.kind}"><span class="ic">${CHRONICLE_ICONS[e.kind] || '·'}</span><span>${esc(e.text)}</span></div>`;
  }
  return head + `<div class="chron" data-scroll="chron">${rows}</div>`;
}
