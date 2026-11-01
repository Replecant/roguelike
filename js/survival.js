'use strict';

// ─── Еда и усталость ───────────────────────────────────────────────
// Сытость (0–100) тает за двое с лишним суток; голодный не заживает, изголодавшийся
// слабеет и теряет здоровье. Усталость (0–100) копится за полтора дня на ногах,
// быстрее — в пути с грузом и в горах; уставший хуже бьёт и уворачивается.
// Есть — провиант из котомки (T) или горячее в трактире; спать — в комнате
// трактира, в лагере на карте Италии или прямо в глуши (R).

const HUNGER_PER_MIN = 100 / (54 * 60);     // сытость за минуту: сытый проголодается через полтора дня
const FATIGUE_PER_MIN = 100 / (32 * 60);    // усталость за минуту бодрствования: устаёшь к концу долгого дня
const RATION_PRICE = 4;                      // монет за дневной паёк
const RATION_FOOD = 45;                      // сколько сытости даёт паёк

function hungerState(p) {
  if (p.food >= 30) return 0;
  if (p.food >= 12) return 1;   // голоден
  return 2;                     // изголодался
}

function fatigueState(p) {
  if (p.fatigue < 70) return 0;
  if (p.fatigue < 90) return 1; // устал
  return 2;                     // валится с ног
}

// Штрафы к меткости и уклонению.
function survivalPenalty(p) {
  return [0, 1, 2][hungerState(p)] + [0, 1, 2][fatigueState(p)];
}

// Каждые 2 минуты игрового времени. load — множитель усталости (путь, груз).
function survivalTick(p, minutes, load = 1) {
  if (p.asleep) return;
  const before = [hungerState(p), fatigueState(p)];
  p.food = Math.max(0, p.food - HUNGER_PER_MIN * minutes * (1 - skillLevel(p, 'survival') * 0.04));
  p.fatigue = Math.min(100, p.fatigue + FATIGUE_PER_MIN * minutes * load);
  // Сила великана уходит разом — и забирает свою.
  if (p.giantUntil && p.giantUntil <= G.minutes) {
    p.giantUntil = 0;
    p.fatigue = Math.min(100, p.fatigue + 45);
    log('Чужая сила уходит из рук так же внезапно, как пришла. Ноги ватные, плечи ноют, будто ты весь день таскал камни.', C.orange);
  }
  const [h, f] = [hungerState(p), fatigueState(p)];
  if (h > before[0]) log(h === 1 ? 'В животе урчит. Пора бы поесть (T).' : 'Ты изголодался: в глазах темнеет, руки дрожат. Поешь немедленно!', h === 1 ? C.orange : C.red);
  if (f > before[1]) log(f === 1 ? 'Ты устал. Пора бы выспаться (R).' : 'Ты валишься с ног. Без сна долго не протянешь.', f === 1 ? C.orange : C.red);
  // Совсем без еды — здоровье уходит.
  if (p.food <= 0 && (G.minutes % 60) < minutes) {
    p.hp--;
    if (p.hp <= 0) G.deathCause = 'голод';
  }
}

// Сколько усталости даёт клетка пути на карте Италии.
function travelFatigue(p, ow, x, y) {
  let k = 1;
  if (!p.mount && carryLoad(p) > p.capacity * 0.75) k *= 1.3;
  if (!p.mount && [OT.HILL, OT.MOUNT, OT.PINE].includes(ow.get(x, y))) k *= 1.25;
  if (p.mount && p.mount.kind === 'horse' && ow.road[ow.idx(x, y)] >= 0) k *= 0.8;
  if (!p.mount) k *= 1 - skillLevel(p, 'athletics') * 0.03;
  else k *= 1 - skillLevel(p, 'riding') * 0.03;
  return k;
}

// ─── Еда ───────────────────────────────────────────────────────────

function eat() {
  const p = G.player;
  if (p.food >= 90) { log('Ты сыт.', C.dim); return; }
  if (p.rations > 0) {
    p.rations--;
    p.food = Math.min(100, p.food + RATION_FOOD);
    log(rng.pick(['Ты жуёшь чёрствый хлеб с куском сыра.', 'Солонина, луковица и глоток вина из фляги.',
      'Ломоть хлеба, горсть оливок и вяленая рыба.']) + ` (провианта осталось: ${p.rations})`, C.text);
    return afterAction();
  }
  // Без провианта — то, что везёшь на продажу.
  for (const id of ['cheese', 'grain', 'oil', 'wine']) {
    if (!p.goods[id]) continue;
    p.goods[id]--;
    p.food = Math.min(100, p.food + (id === 'cheese' ? 60 : id === 'grain' ? 50 : 20));
    log(`Провианта нет — ты ешь из товара: ${GOODS[id].name.toLowerCase()} (−1 ${GOODS[id].unit}).`, C.orange);
    return afterAction();
  }
  log('Есть нечего. Провиант продают трактирщики, купцы и старосты деревень.', C.red);
}

// Горячее в трактире: сытость полная, немного здоровья.
function tavernMealOption(npc, pay) {
  const p = G.player, monk = npc.village.city.kind === 'monastery';
  const price = p.priceBuy(monk ? 1 : 4);
  return { label: monk ? `Разделить трапезу с братией (лепта ${price} мон.)` : `Поесть горячего (${price} мон.)`, act: pay(price, () => {
    if (p.food >= 90) return 'Ты же только что ел. Лопнешь.';
    passTime(30);
    p.food = 100;
    p.hp = Math.min(p.maxHp, p.hp + 3);
    if (isSaracen(npc)) return rng.pick(['Кускус с бараниной и нутом, лепёшки и чашка шербета. Хозяйка смеётся, глядя, как ты ешь руками.',
      'Рис с шафраном, жареная рыба и финики. Вина нет — зато крепкий отвар мяты с мёдом.']);
    return monk ? 'Похлёбка из бобов, хлеб и разбавленное вино — под чтение жития святых. Монахи едят молча.'
      : rng.pick(['Миска густой похлёбки, хлеб, кусок сыра и кружка вина. Жить можно.',
        'Жареная колбаса с бобами, хлеб и кувшин молодого вина. Хозяйка подкладывает добавки.',
        'Паста с бобами, оливки и рыба на углях. За соседним столом спорят о ценах на соль.']);
  }) };
}

// ─── Сон ───────────────────────────────────────────────────────────

// Проспать до утра (или ~8 часов днём). Возвращает false, если сон прервали.
// risk(hour) → true, если на спящего напали; quality — сколько усталости уходит.
function sleep(where, risk, quality = 1) {
  const p = G.player;
  if (cultKidnapCheck()) return false;   // в «тихой деревне» спящих уносят
  const total = START_MINUTE + G.minutes, h = (total % 1440) / 60;
  const hours = isNight() || h >= 19 ? Math.max(5, Math.round((24 - h + 7) % 24)) : 8;
  log(where, C.dim);
  p.asleep = true;
  for (let i = 0; i < hours; i++) {
    passTime(60);
    p.food = Math.max(0, p.food - HUNGER_PER_MIN * 60 * 0.5);   // во сне голод идёт медленнее
    p.fatigue = Math.max(0, p.fatigue - 14 * quality);
    p.hp = Math.min(p.maxHp, p.hp + (p.food > 12 ? 2 : 0));
    p.grace = Math.min(p.maxGrace, p.grace + 1);
    if (p.hp <= 0) { p.asleep = false; return false; }
    if (risk && risk(i)) { p.asleep = false; return false; }
  }
  p.asleep = false;
  if (quality < 1) p.fatigue = Math.max(p.fatigue, 15);   // на голой земле до конца не выспишься
  log(p.fatigue < 20 ? 'Ты просыпаешься отдохнувшим.' : 'Ты просыпаешься разбитым — спалось плохо.', C.dim);
  return true;
}

// Привал в глуши: опытный находит, чем подкрепиться, — и учится этому.
function forage(p) {
  const lvl = skillLevel(p, 'survival');
  trainSkill(p, 'survival', 2);
  if (!rng.chance(0.08 + lvl * 0.06)) return;
  const what = rng.pick(['силки поймали зайца', 'у ручья нашлись съедобные коренья', 'в кустах — ягоды и дикие груши', 'из-под камня вытащил раков']);
  p.rations++;
  log(`Утром ты не уходишь с пустыми руками: ${what}. +1 день провианта.`, C.green);
}

// Ночлег в глуши на местной карте: можно проснуться от зверя.
function sleepWild() {
  const p = G.player, w = G.world;
  if (dangerNear()) { log('Рядом опасность — какой тут сон.', C.red); return; }
  if (p.fatigue < 35 && !isNight()) { log('Спать ещё рано — ты не устал. Отдохнуть можно и сидя.', C.dim); return restLocal(); }
  const fire = !snowyHere() || rng.chance(0.5);
  const ok = sleep(fire ? 'Ты разводишь костерок, заворачиваешься в плащ и засыпаешь.' : 'Ты ложишься прямо на землю, подложив котомку под голову.',
    () => {
      if (G.wardUntil > G.minutes) return false;   // под печатью или под защитой святого
      if (!rng.chance((isNight() ? 0.07 : 0.03) * (1 - skillLevel(p, 'survival') * 0.06))) return false;
      const n = spawnBeasts(1, isNight(), false, 4);
      if (!n) return false;
      for (const a of w.actors) if (a.kind === 'beast' && dist(a, p) < 12) a.target = [p.x, p.y];
      log('Тебя будит хруст ветки. Кто-то подошёл к стоянке!', C.red);
      return true;
    }, 0.85);
  if (ok && !fire) campWeatherHurt();
  if (ok) forage(p);
  refreshFov();
}
