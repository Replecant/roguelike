'use strict';

// ─── Прицельные удары (пробная механика) ───────────────────────────
// Прицел — режим, а не вопрос: «Целюсь в: корпус / голову / руки / ноги»
// (V или кнопка на панели). Все удары в ближнем бою идут туда, пока не сменишь.
// Голова — труднее попасть, больнее, может оглушить; руки (лапы) — враг какое-то
// время бьёт слабее; ноги — враг замедлен. Корпус — без штрафов и без эффектов.
// По ожидаемому урону зоны примерно равны — разница в эффектах. Навык оружия
// снижает штраф к попаданию; оружие усиливает свои зоны (булава — оглушение,
// топор — чаще увечье, рогатина — точнее в корпус, нож — исподтишка в голову).
// У разных существ своё строение. Выключить — в отладке (G.aimOff).

const AIM_ZONES = {
  body: { name: 'корпус', acc: 0, mult: 1 },
  head: { name: 'голову', acc: -5, mult: 1.25 },
  arms: { name: 'руки', acc: -2, mult: 0.9 },
  legs: { name: 'ноги', acc: -2, mult: 0.9 },
};
const AIM_ORDER = ['body', 'head', 'arms', 'legs'];

// Строение: какие зоны есть и как они зовутся.
const ANATOMY = {
  human:  { name: 'человек', zones: { body: 'корпус', head: 'голову', arms: 'руки', legs: 'ноги' } },
  beast:  { name: 'четвероногий', zones: { body: 'корпус', head: 'голову', legs: 'лапы' } },
  crawl:  { name: 'ползучий', zones: { body: 'тело', head: 'голову' } },
  flyer:  { name: 'летучий', zones: { body: 'тело' } },
  spirit: { name: 'бесплотный', zones: { body: 'сгусток' } },
};
const ANATOMY_OF = {
  viper: 'crawl', tarantula: 'crawl', grotto_crab: 'crawl', sea_serpent: 'crawl', tarantasio: 'crawl', lamia: 'crawl', salamander: 'crawl',
  crow: 'flyer', bat: 'flyer', imp: 'flyer', fury: 'flyer',
  wisp: 'spirit', ghost: 'spirit', shade: 'spirit', etruscan_shade: 'spirit', larva: 'spirit', lemur: 'spirit', miner_ghost: 'spirit',
  black_dog: 'beast', hecate_hound: 'beast', cerberus: 'beast', werewolf: 'beast', mithras_bull: 'beast',
};
// В шлемах: удар в голову гасится.
const HELMED = new Set(['imperial_soldier', 'bandit_lord', 'brigand_chief', 'crusader_ghost', 'skeleton', 'pagan_guard']);

function anatomyOf(m) {
  const k = ANATOMY_OF[m.key];
  if (k) return k;
  const cat = m.def.cat;
  if (cat === 'Звери') return 'beast';
  return 'human';
}
function aimOn() { return !G.aimOff; }
function playerAim() { return aimOn() ? (G.player.aim || 'body') : 'body'; }
// Куда на самом деле придётся удар: если у твари такой части нет — в корпус.
function aimFor(m) {
  const z = playerAim(), an = ANATOMY[anatomyOf(m)];
  return an.zones[z] ? z : 'body';
}
function zoneName(m, z) { return ANATOMY[anatomyOf(m)].zones[z] || 'корпус'; }
const isBoss = m => m.def.max === 1 || m.def.hp >= 60;

function cycleAim() {
  const p = G.player;
  p.aim = AIM_ORDER[(AIM_ORDER.indexOf(p.aim || 'body') + 1) % AIM_ORDER.length];
  log(`Целишься в ${AIM_ZONES[p.aim].name}.`, C.dim);
}

// Поправка к меткости (штраф зоны минус навык; рогатина точнее в корпус).
function aimAcc(m, skill = null) {
  const p = G.player, z = aimFor(m), Z = AIM_ZONES[z];
  const sk = skillLevel(p, skill || meleeSkill(p)), w = p.equip.right && p.equip.right.key;
  let acc = Z.acc < 0 ? Math.min(0, Z.acc + Math.floor(sk / 2)) : 0;
  if (!skill && z === 'body' && (w === 'spear' || w === 'vexillum')) acc += 1;
  return acc;
}

// Урон и последствия попадания. Возвращает [урон, описание эффекта].
// ranged — выстрел или бросок: оглушает реже, своих бонусов оружия нет.
function aimHit(m, dmg, unaware, ranged = false) {
  const p = G.player, z = aimFor(m), w = ranged ? null : p.equip.right && p.equip.right.key;
  if (z === 'body') return [dmg, ''];
  let mult = AIM_ZONES[z].mult, note = '';
  const blunt = w === 'mace' || w === 'club', axe = w === 'axe' || w === 'greataxe';
  if (z === 'head') {
    if (HELMED.has(m.key)) { mult = 0.9; note = 'шлем принимает удар'; }
    if (unaware && (w === 'knife' || (p.equip.left && p.equip.left.key === 'dagger'))) mult *= 1.3;
    const stun = (blunt ? 0.36 : ranged ? 0.1 : 0.18) / (isBoss(m) ? 4 : 1) / (HELMED.has(m.key) ? 2 : 1);
    if (rng.chance(stun)) { m.stunTurn = G.turn + 1; note = 'оглушён'; }
  }
  // Увечье ложится не с каждого удара; крупная тварь стойче. Новое — только когда прошло старое.
  const maim = (axe ? 0.65 : 0.5) / (isBoss(m) ? 2 : 1);
  if (z === 'arms' && !(m.weakTurn > G.turn) && rng.chance(maim)) { m.weakTurn = G.turn + 3; note = 'бьёт слабее'; }
  if (z === 'legs' && !(m.slowTurn > G.turn) && rng.chance(maim)) { m.slowTurn = G.turn + 3; note = anatomyOf(m) === 'beast' ? 'хромает' : 'еле ковыляет'; }
  return [Math.max(1, Math.round(dmg * mult)), note];
}

// Влияние ран на тварь: оглушённый пропускает ход, хромой ходит через раз.
function aimSkipTurn(m) {
  if (m.stunTurn >= G.turn) return true;
  if (m.slowTurn > G.turn && G.turn % 2) return true;
  return false;
}
const aimWeak = m => (m.weakTurn > G.turn ? 0.75 : 1);

// ─── Зоны по герою ─────────────────────────────────────────────────
// Твари бьют по разным частям тела: змеи и крысы — по ногам, волк — по ногам и в бок,
// вороньё — в лицо, человек — куда придётся. Доспех держит удар по-своему:
// часть защиты общая (щит, стёганка под всем, реликвии), часть — от вещи на этой зоне
// (шлем бережёт голову, наручи — руки, поножи и сапоги — ноги).
const HERO_ZONES = { body: 'в корпус', head: 'в голову', arms: 'по рукам', legs: 'по ногам' };
const HERO_ZONE_SLOTS = { body: ['body'], head: ['head'], arms: ['arms'], legs: ['legs', 'feet'] };
const HERO_ZONE_ODDS = {
  human: { body: 45, head: 20, arms: 20, legs: 15 },
  beast: { body: 35, head: 10, arms: 20, legs: 35 },
  crawl: { body: 20, head: 0, arms: 15, legs: 65 },
  flyer: { body: 30, head: 50, arms: 20, legs: 0 },
  spirit: { body: 50, head: 30, arms: 10, legs: 10 },
};
function heroZone(m) {
  const odds = HERO_ZONE_ODDS[anatomyOf(m)];
  return rng.weighted(Object.entries(odds).filter(([, w]) => w > 0).map(([key, w]) => ({ key, w }))).key;
}
function zoneArmor(p, z) {
  const own = HERO_ZONE_SLOTS[z].reduce((s, sl) => s + ((p.equip[sl] && p.equip[sl].armor) || 0), 0);
  return Math.round(p.armor * 0.7) + own;
}
// Тяжёлый удар по незащищённой голове — в глазах темнеет.
function heroZoneHurt(p, z, dmg) {
  if (z === 'head' && !(p.equip.head && p.equip.head.armor) && dmg >= p.maxHp * 0.2 && !rng.chance(p.stats.con * 0.05)) {
    p.confused = Math.max(p.confused || 0, 2);
    log('Удар в голову — в глазах темнеет, всё плывёт.', C.violet);
  }
}
