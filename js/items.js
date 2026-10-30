'use strict';

// Сами предметы — в content/items.js.
let itemUid = 0;

function makeItem(key) {
  return { key, uid: ++itemUid, ...ITEMS[key] };
}

// Короткое описание свойств: «урон 2–8, меткость +1».
function itemStats(it) {
  const s = [];
  const sg = n => (n > 0 ? '+' : '') + n;
  if (it.ranged) {
    const r = it.ranged;
    s.push(`выстрел ${r.rdmg[0]}–${r.rdmg[1]}, дальность ${r.range}, ${AMMO[r.ammo].name.toLowerCase()}`);
    if (r.racc) s.push(`точность ${sg(r.racc)}`);
    if (it.dmg) s.push(`вблизи ${it.dmg[0]}–${it.dmg[1]}`);
  } else if (it.kind === 'ammo') s.push(AMMO[it.ammo].thrown ? `бросок ${AMMO[it.ammo].dmg[0]}–${AMMO[it.ammo].dmg[1]} (+Сила), дальность ${AMMO[it.ammo].range}` : 'запас для стрельбы');
  else if (it.dmg) s.push(`урон ${it.dmg[0]}–${it.dmg[1]}`);
  if (it.acc) s.push(`меткость ${sg(it.acc)}`);
  if (it.two) s.push('двуручное');
  if (it.armor) s.push(`защита ${sg(it.armor)}`);
  if (it.ev) s.push(`уклонение ${sg(it.ev)}`);
  if (it.dmgBonus) s.push(`урон ${sg(it.dmgBonus)}`);
  if (it.vsUnholy) s.push(`по нечисти ${sg(it.vsUnholy)}`);
  if (it.light) s.push(`свет ${sg(it.light)}`);
  if (it.sight) s.push(`обзор ${sg(it.sight)}`);
  if (it.stats) for (const [k, v] of Object.entries(it.stats)) s.push(`${STATS.find(x => x.key === k).name} ${sg(v)}`);
  if (it.unholyArmor) s.push(`защита от нечисти ${sg(it.unholyArmor)}`);
  if (it.faeEv) s.push(`уклонение от дивных ${sg(it.faeEv)}`);
  return s.join(', ');
}

// ─── Надеть и снять ────────────────────────────────────────────────

function equippedItems(p) {
  return SLOTS.map(([s]) => p.equip[s]).filter(Boolean);
}

// Сумма числового свойства по всему надетому.
function gearSum(p, prop) {
  return equippedItems(p).concat(faithItems(p)).reduce((s, it) => s + (it[prop] || 0), 0);
}

function unequip(p, slot) {
  const it = p.equip[slot];
  if (!it) return null;
  p.equip[slot] = null;
  p.bag.push(it);
  return it;
}

// Возвращает текст для журнала.
function equip(p, it) {
  const slots = KIND_SLOTS[it.kind];
  let slot = slots.find(s => !p.equip[s]) || slots[0];
  if (it.kind === 'offhand' && p.equip.right && p.equip.right.two)
    return `${p.equip.right.name} держишь обеими руками — левая занята.`;
  const oldHp = p.maxHp, oldGrace = p.maxGrace;
  p.bag = p.bag.filter(x => x !== it);
  const prev = unequip(p, slot);
  const freed = it.two && p.equip.left ? unequip(p, 'left') : null;
  p.equip[slot] = it;
  p.hp = Math.min(p.maxHp, p.hp + Math.max(0, p.maxHp - oldHp));
  p.grace = Math.min(p.maxGrace, p.grace + Math.max(0, p.maxGrace - oldGrace));
  p.hp = Math.min(p.hp, p.maxHp);
  p.grace = Math.min(p.grace, p.maxGrace);
  let msg = `Надето: «${it.name}».`;
  if (prev) msg += ` «${prev.name}» — в мешке.`;
  if (freed) msg += ` Для двуручного нужна и левая рука: «${freed.name}» — в мешке.`;
  return msg;
}

function bagLoad(p) {
  return p.bag.reduce((s, it) => s + it.w, 0);
}

// ─── Экран снаряжения ──────────────────────────────────────────────

class InventoryScreen {
  constructor() {
    this.overlay = false;
    this.side = 0;     // 0 — на теле, 1 — мешок
    this.sel = [0, 0];
    this.note = '';
  }

  key(k) {
    const p = G.player;
    if (isEsc(k) || k.code === 'KeyI') return popScreen();
    const len = this.side === 0 ? SLOTS.length : p.bag.length;
    if (k.code === 'Tab' || isLeft(k) || isRight(k)) { this.side ^= 1; this.note = ''; return; }
    if (isUp(k)) this.sel[this.side] = Math.max(0, this.sel[this.side] - 1);
    else if (isDown(k)) this.sel[this.side] = Math.min(Math.max(0, len - 1), this.sel[this.side] + 1);
    else if (k.code === 'KeyQ') { quaff(); this.note = G.messages[G.messages.length - 1].text; }
    else if (isEnter(k)) {
      if (this.side === 0) {
        const [slot, label] = SLOTS[this.sel[0]];
        const it = unequip(p, slot);
        this.note = it ? `Ты снимаешь «${it.name}».` : `${label}: пусто.`;
        p.hp = Math.min(p.hp, p.maxHp);
        p.grace = Math.min(p.grace, p.maxGrace);
      } else {
        const it = p.bag[this.sel[1]];
        if (it) this.note = equip(p, it);
      }
    } else if (k.code === 'KeyD') {
      const it = this.side === 0 ? p.equip[SLOTS[this.sel[0]][0]] : p.bag[this.sel[1]];
      if (!it) return;
      if (this.side === 0) unequip(p, SLOTS[this.sel[0]][0]);
      p.bag = p.bag.filter(x => x !== it);
      if (G.mode === 'local') G.world.addItem(p.x, p.y, { kind: 'gear', item: it, name: it.name });
      this.note = `Ты бросаешь «${it.name}».`;
    }
    this.sel[1] = Math.min(this.sel[1], Math.max(0, p.bag.length - 1));
  }

  render(t) {
    const p = G.player;
    t.print(2, 1, 'Снаряжение и котомка', C.gold);
    for (let i = 0; i < t.cols; i++) t.put(i, 2, '─', C.dark);

    // На теле.
    t.print(2, 4, 'На теле', this.side === 0 ? C.gold : C.dim);
    SLOTS.forEach(([slot, label], i) => {
      const y = 6 + i, it = p.equip[slot], sel = this.side === 0 && this.sel[0] === i;
      t.print(2, y, sel ? '►' : ' ', C.gold);
      t.print(4, y, label, C.dim);
      t.print(18, y, it ? it.name.slice(0, 28) : '—', it ? (sel ? C.white : C.text) : C.dark);
    });
    const w = p.weaponDef;
    const rows = [
      ['Защита', p.armor], ['Уклонение', p.ev], ['Меткость', p.hit],
      ['Урон', `${Math.max(1, w.dmg[0] + p.dmgBonus(null))}–${w.dmg[1] + p.dmgBonus(null)}`],
      ['Свет', gearSum(p, 'light') ? `факел (+${gearSum(p, 'light')})` : 'нет'],
      ['Запасы', Object.keys(AMMO).filter(a => p.ammo[a] > 0).map(a => `${AMMO[a].name.toLowerCase()} ${p.ammo[a]}`).join(', ') || 'нет'],
      ['Животное', p.mount ? MOUNTS[p.mount.kind].name + (p.mount.hungry ? ' (голодна)' : '') : 'нет'],
    ];
    rows.forEach(([k, v], i) => { t.print(4, 18 + i, k, C.dim); t.print(18, 18 + i, String(v), C.text); });

    // Мешок.
    const bx = 50;
    t.print(bx, 4, `Мешок`, this.side === 1 ? C.gold : C.dim);
    t.print(bx + 8, 4, `груз ${carryLoad(p)}/${p.capacity}`, C.dim);
    if (!p.bag.length) t.print(bx + 2, 6, 'Пусто.', C.dark);
    const top = Math.max(0, this.sel[1] - 11);
    p.bag.slice(top, top + 12).forEach((it, i) => {
      const sel = this.side === 1 && this.sel[1] === top + i;
      t.print(bx, 6 + i, sel ? '►' : ' ', C.gold);
      t.print(bx + 2, 6 + i, it.name.slice(0, 30), sel ? C.white : C.text);
      t.print(bx + 34, 6 + i, SLOTS.find(([s]) => s === KIND_SLOTS[it.kind][0])[1].replace('Реликвия I', 'Реликвия').slice(0, 13), C.dark);
    });
    let y = 19;
    t.printRich(bx, y++, `{dim}Монеты{} {gold}${p.coins}{}   {dim}Отвары{} ${p.potions} {dark}(Q — выпить)`);
    const goods = GOOD_IDS.filter(id => p.goods[id]).map(id => `${GOODS[id].name} ×${p.goods[id]}`);
    if (goods.length) y += t.printWrap(bx, y, 48, 'Товары: ' + goods.join(', '), C.text, 2);
    const tro = Object.values(p.trophies).map(tr => `${tr.name} ×${tr.count}`);
    if (tro.length) y += t.printWrap(bx, y, 48, 'Трофеи: ' + tro.join(', '), C.text, 3);
    const cargo = p.quests.filter(q => q.type === 'deliver');
    if (cargo.length) t.printWrap(bx, y, 48, 'Поклажа: ' + cargo.map(q => `«${q.item}»`).join(', '), C.sky, 2);

    // Описание выбранного.
    const it = this.side === 0 ? p.equip[SLOTS[this.sel[0]][0]] : p.bag[this.sel[1]];
    const dy = t.rows - 6;
    for (let i = 0; i < t.cols; i++) t.put(i, dy - 1, '─', C.dark);
    if (it) {
      t.print(2, dy, it.name, C.gold);
      const desc = itemStats(it) + (it.note ? `. ${it.note[0].toUpperCase() + it.note.slice(1)}.` : '.');
      t.printWrap(2, dy + 1, 96, desc[0].toUpperCase() + desc.slice(1), C.text, 2);
    }
    if (this.note) t.print(2, dy + 3, this.note, C.sky);
    t.print(2, t.rows - 1, '↑↓ выбор   ←→ / Tab — тело/мешок   Enter — надеть/снять   D — выбросить   Esc — назад', C.dim);
  }
}
