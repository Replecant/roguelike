'use strict';

// ─── Навыки ────────────────────────────────────────────────────────
// Навыки растут от дела, а не от очков: кто рубит топором — лучше рубит,
// кто ходит по горам — легче ходит. Уровень 0–10. Чем выше Мудрость, тем
// быстрее учение. Предыстория героя даёт навыкам начальные уровни.

const SKILL_MAX = 10;

const SKILLS = {
  // Боевые.
  blade:    { name: 'Клинки', group: 'Бой', desc: 'ножи, мечи, гладиусы: меткость и урон' },
  axe:      { name: 'Топоры и булавы', group: 'Бой', desc: 'топоры, секиры, булавы, дубины: меткость и урон' },
  spear:    { name: 'Древковое', group: 'Бой', desc: 'рогатины и копья: меткость и урон' },
  bow:      { name: 'Луки', group: 'Бой', desc: 'меткость и урон стрел' },
  crossbow: { name: 'Арбалеты', group: 'Бой', desc: 'меткость и урон болтов' },
  throw:    { name: 'Метание', group: 'Бой', desc: 'праща, дротики, ножи: меткость и урон' },
  shield:   { name: 'Щит', group: 'Бой', desc: 'со щитом или баклером — уклонение выше' },
  armor:    { name: 'Доспех', group: 'Бой', desc: 'тяжёлый доспех меньше мешает уворачиваться, держит удар лучше' },
  // Странствия.
  survival: { name: 'Выживание', group: 'Странствия', desc: 'реже голодаешь, находишь еду на привале, ночлег в глуши безопаснее' },
  athletics:{ name: 'Атлетика', group: 'Странствия', desc: 'больше несёшь, меньше устаёшь в пути, ловчее увёртываешься от ловушек' },
  swim:     { name: 'Плавание', group: 'Странствия', desc: 'можно плыть по рекам, озёрам и морю у берега; меньше риск утонуть' },
  stealth:  { name: 'Скрытность', group: 'Странствия', desc: 'звери замечают позже, удар по ничего не подозревающему — сильнее, в пути реже нарываешься на зверя' },
  riding:   { name: 'Верховая езда', group: 'Странствия', desc: 'с лошадью или мулом быстрее и легче в пути, животное реже уводят' },
  // Люди.
  trade:    { name: 'Торговля', group: 'Люди', desc: 'дешевле покупаешь, дороже продаёшь' },
  speech:   { name: 'Красноречие', group: 'Люди', desc: 'выторговываешь награду побольше, люди охотнее делятся слухами и тайнами' },
  letters:  { name: 'Грамота', group: 'Люди', desc: 'читать латинские надписи (и находить в них подсказки), понимать мессу; учатся у священника' },
  // Ремесло.
  alchemy:  { name: 'Алхимия', group: 'Ремесло', desc: 'варить зелья: чем выше, тем чаще выходит две порции вместо одной' },
  // Тайные науки.
  hermetic: { name: 'Герметика', group: 'Тайные науки', desc: 'талисманы планет и операции: чем выше, тем реже срывается' },
};

// Какой навык нужен оружию.
const WEAPON_SKILL = {
  knife: 'blade', sword: 'blade', gladius: 'blade',
  axe: 'axe', mace: 'axe', club: 'axe', greataxe: 'axe',
  spear: 'spear', vexillum: 'spear',
  shortbow: 'bow', longbow: 'bow', crossbow: 'crossbow', genoese: 'crossbow', sling: 'throw',
};

function weaponSkill(it) {
  if (!it || !it.key) return null;
  if (WEAPON_SKILL[it.key]) return WEAPON_SKILL[it.key];
  if (it.ranged) return it.ranged.ammo === 'bolt' ? 'crossbow' : it.ranged.ammo === 'arrow' ? 'bow' : 'throw';
  return /меч|нож|клин/i.test(it.name) ? 'blade' : /копь|рогат/i.test(it.name) ? 'spear' : 'axe';
}

function skillLevel(p, k) { return (p.skills && p.skills[k] && p.skills[k].lvl) || 0; }

// Сколько упражнения до следующего уровня.
function skillNeed(lvl) { return 8 + lvl * lvl * 6; }

// Упражнение в навыке; amount — сколько «опыта» дало дело.
function trainSkill(p, k, amount) {
  if (!p.skills || !SKILLS[k] || amount <= 0) return;
  const s = p.skills[k] || (p.skills[k] = { lvl: 0, xp: 0 });
  if (s.lvl >= SKILL_MAX) return;
  s.xp += amount * (1 + (p.stats.wis - 5) * 0.05);
  while (s.lvl < SKILL_MAX && s.xp >= skillNeed(s.lvl)) {
    s.xp -= skillNeed(s.lvl);
    s.lvl++;
    log(`Навык «${SKILLS[k].name}» вырос: ${s.lvl}.`, C.green);
    if (s.lvl === 5 || s.lvl === SKILL_MAX) chronicle(`${s.lvl === SKILL_MAX ? 'Стал мастером' : 'Хорошо освоил навык'}: ${SKILLS[k].name.toLowerCase()}.`, 'level');
  }
}

// ─── Что дают навыки ───────────────────────────────────────────────

function meleeSkill(p) { const w = p.equip && p.equip.right; return w && !w.ranged ? weaponSkill(w) : null; }
function skillHit(lvl) { return Math.floor(lvl / 2); }
function skillDmg(lvl) { return Math.floor(lvl / 3); }

// Навык стрельбы для текущего режима (лук, арбалет, метание).
function rangedSkill(mode) {
  if (!mode) return null;
  if (mode.launcher) return weaponSkill(mode.launcher);
  return 'throw';
}

// Уклонение: щит и привычка к тяжёлому доспеху.
function skillEv(p) {
  if (!p.equip) return 0;
  let b = 0;
  const left = p.equip.left;
  if (left && (left.ev || left.armor) && left.kind === 'offhand') b += Math.floor(skillLevel(p, 'shield') / 3);
  // Тяжёлое (ev < 0) мешает меньше: каждые 3 уровня снимают одно очко штрафа.
  const penalty = -equippedItems(p).filter(it => it !== left).reduce((s, it) => s + Math.min(0, it.ev || 0), 0);
  b += Math.min(penalty, Math.floor(skillLevel(p, 'armor') / 3));
  return b;
}
function skillArmor(p) { return p.equip && p.equip.body ? Math.floor(skillLevel(p, 'armor') / 5) : 0; }

// ─── Плавание ──────────────────────────────────────────────────────

const SWIM_TILES = new Set([T.WATER, T.SEA, T.CANAL]);

// Вес доспеха на теле — тянет ко дну.
function armorWeight(p) {
  return ['head', 'body', 'arms', 'legs', 'feet'].reduce((s, k) => s + (p.equip[k] ? p.equip[k].w || 0 : 0), 0);
}

// Шаг в воду. Возвращает true, если шаг сделан (или отказано).
function swimStep(nx, ny) {
  const p = G.player, w = G.world;
  const lvl = skillLevel(p, 'swim'), wasIn = SWIM_TILES.has(w.get(p.x, p.y));
  if (!wasIn) log(lvl ? 'Ты входишь в воду и плывёшь.' : 'Ты входишь в воду и барахтаешься, кое-как держась на плаву. Плавать ты почти не умеешь.', C.sky);
  moveTo(p, nx, ny);
  p.fatigue = Math.min(100, p.fatigue + 1.5);
  const heavy = armorWeight(p), over = carryLoad(p) > p.capacity;
  const risk = Math.max(0.02, Math.min(0.85, 0.22 - lvl * 0.022 + heavy * 0.03 + (over ? 0.25 : 0) + (fatigueState(p) ? 0.1 : 0)));
  if (rng.chance(risk)) {
    const dmg = rng.int(1, 3) + (heavy > 5 ? 2 : 0);
    p.hp -= dmg;
    log(heavy > 5 ? `Доспех тянет ко дну! Ты захлёбываешься: −${dmg}.` : `Ты наглотался воды и еле выплываешь: −${dmg}.`, C.red);
    if (p.hp <= 0) G.deathCause = 'утонул';
  }
  trainSkill(p, 'swim', 2);
  endTurn();
  return true;
}

// Брод через реку на карте Италии: течение может сбить с ног.
function fordRisk(p) {
  const lvl = skillLevel(p, 'swim');
  trainSkill(p, 'swim', 1);
  if (p.mount) return;   // верхом брод не страшен
  if (!rng.chance(Math.max(0.01, 0.12 - lvl * 0.012 + armorWeight(p) * 0.01))) return;
  const dmg = rng.int(1, 3);
  p.hp -= dmg;
  p.fatigue = Math.min(100, p.fatigue + 5);
  log(`Течение сбивает тебя с ног, тебя тащит по камням: −${dmg}.`, C.orange);
  if (p.hp <= 0) G.deathCause = 'утонул на броде';
}

// ─── Предыстории ───────────────────────────────────────────────────

const BACKGROUNDS = [
  { id: 'mercenary', name: 'Наёмник', skills: { blade: 2, armor: 1 }, gear: ['gambeson'],
    lore: 'Служил тому, кто платит: то гвельфам, то гибеллинам. Знает, с какой стороны держать меч и как носить стёганку.' },
  { id: 'hunter', name: 'Охотник', skills: { bow: 2, survival: 1 }, gear: ['shortbow'], ammo: { arrow: 15 },
    lore: 'Бил оленей в чужих лесах и не попадался лесничим. Стреляет метко и ночует под любым кустом.' },
  { id: 'shepherd', name: 'Пастух-горец', skills: { survival: 2, athletics: 1 }, rations: 3,
    lore: 'Гонял овец по Апеннинам с весны до осени. Знает, где вода, где волк и как не замёрзнуть в горах.' },
  { id: 'sailor', name: 'Моряк', skills: { swim: 2, athletics: 1 }, coins: 10,
    lore: 'Ходил на генуэзских и пизанских галерах. Плавает как рыба, лазает по снастям и не боится качки.' },
  { id: 'clerk', name: 'Приказчик', skills: { trade: 2, blade: 1 }, coins: 30,
    lore: 'Служил у купца: вёл счета, торговался на ярмарках Шампани, знает цену соли и шёлку.' },
  { id: 'watchman', name: 'Городской стражник', skills: { spear: 2, shield: 1 }, gear: ['buckler'],
    lore: 'Стоял у ворот с рогатиной, гонял воров с рынка, разнимал драки в тавернах.' },
  { id: 'woodcutter', name: 'Лесоруб', skills: { axe: 2, athletics: 1 }, gear: ['axe'],
    lore: 'Валил дубы для корабелов и жёг уголь. Топор в руке — как продолжение руки.' },
  { id: 'scribe', name: 'Монах-переписчик', skills: { letters: 2, speech: 1 }, piety: 5,
    lore: 'Двадцать лет переписывал в скриптории Отцов Церкви и устав святого Бенедикта. Ушёл из обители — почему, не рассказываешь.' },
  { id: 'notary', name: 'Нотарий', skills: { letters: 2, trade: 1 }, coins: 20,
    lore: 'Составлял завещания, купчие и брачные договоры. В Италии без нотария и курицу не продашь.' },
  { id: 'groom', name: 'Конюх', skills: { riding: 2, athletics: 1 },
    lore: 'Ходил за конями в замковой конюшне, объезжал жеребят. Лошади чуют тебя издалека и слушаются.' },
  { id: 'thief', name: 'Вор', skills: { stealth: 2, blade: 1 }, coins: 15,
    lore: 'Резал кошельки на ярмарках и лазил в окна. Однажды чуть не попался — и решил, что пора повидать мир.' },
  { id: 'jongleur', name: 'Жонглёр', skills: { speech: 2, stealth: 1 }, coins: 10,
    lore: 'Пел в тавернах о Роланде и о рыцаре Тристане, показывал фокусы и уходил до того, как обнаруживалась пропажа.' },
  { id: 'apothecary', name: 'Ученик аптекаря', skills: { alchemy: 2, letters: 1 }, alchemy: ['mortar', 'kettle'], recipes: ['heal', 'salve', 'fever'],
    herbs: { plantain: 2, sage: 2, chamomile: 1 },
    lore: 'Растирал травы в аптеке под вывеской с ступкой, учил латинские названия по «Circa instans». Знает, что из чего варят.' },
  { id: 'pilgrim', name: 'Паломник', skills: { athletics: 1, survival: 1, swim: 1 }, piety: 10,
    lore: 'Прошёл пешком до Сантьяго и обратно. Привык к дороге, к холоду и к молитве.' },
];

function bgSkillsText(bg) {
  return Object.entries(bg.skills).map(([k, v]) => `${SKILLS[k].name} ${v}`).join(', ');
}

// Начальные навыки и вещи по предыстории.
function applyBackground(p, bg) {
  p.skills = {};
  for (const k of Object.keys(SKILLS)) p.skills[k] = { lvl: 0, xp: 0 };
  if (!bg) return;
  p.background = bg.id;
  for (const [k, v] of Object.entries(bg.skills)) p.skills[k].lvl = v;
  for (const key of bg.gear || []) p.bag.push(makeItem(key));
  for (const [a, n] of Object.entries(bg.ammo || {})) p.ammo[a] = (p.ammo[a] || 0) + n;
  if (bg.coins) p.coins += bg.coins;
  if (bg.rations) p.rations += bg.rations;
  if (bg.piety) p.piety = Math.min(100, p.piety + bg.piety);
  if (bg.alchemy) {
    p.alchemy = p.alchemy || {};
    for (const t of bg.alchemy) p.alchemy[t] = true;
    p.alchemyKnown = true;
    p.recipes = Object.fromEntries((bg.recipes || []).map(r => [r, true]));
  }
  for (const [h, n] of Object.entries(bg.herbs || {})) p.trophies[herbId(h)] = { name: HERBS[h].name, value: HERBS[h].value, count: n };
}

// ─── Грамота ───────────────────────────────────────────────────────

// Надпись латиницей неграмотному не прочесть.
function needsLetters(text) { return /[A-Z]{3,}/.test(text); }

// Урок у священника или имама.
function lettersLesson(npc) {
  const p = G.player, day = timeInfo().day, price = p.priceBuy(4);
  if (skillLevel(p, 'letters') >= SKILL_MAX) return [];
  return [{ label: `Поучиться грамоте (${price} мон.)`, act: () => {
    if (p.lessonDay === day) return 'На сегодня хватит — глаза устанут. Приходи завтра.';
    if (p.coins < price) return 'Учение стоит денег, сын мой: пергамент дорог.';
    p.coins -= price;
    p.lessonDay = day;
    passTime(60);
    trainSkill(p, 'letters', 7);
    readScrolls();
    return isSaracen(npc) ? 'Имам показывает тебе, как пишут по-латыни и по-арабски. «Знание — свет», — говорит он.'
      : rng.pick(['Вы читаете по складам псалтирь. Pater noster, qui es in caelis… Буквы понемногу складываются в слова.',
        'Священник показывает, как читать сокращения: «DNS» — Dominus, «SCS» — sanctus. Голова пухнет, но ты запоминаешь.',
        'Вы разбираете старую грамоту с печатью. «Видишь? Здесь продают виноградник. А здесь — обманывают покупателя».']);
  } }];
}
