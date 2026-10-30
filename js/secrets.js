'use strict';

// ─── Секреты подземелий ────────────────────────────────────────────
// Ловушки (скрыты, пока не заметишь), тайные двери в потайные ниши с
// кладом, запертая сокровищница с ключом где-то на уровне, надписи на
// стенах. Замечать помогают Мудрость и Ловкость; стоять на месте (Пробел)
// — значит осматриваться внимательнее.

const TRAPS = {
  pit:     { name: 'Волчья яма', color: '#c0a060', text: 'Пол уходит из-под ног — ты падаешь в яму с кольями!' },
  dart:    { name: 'Отравленный дротик', color: '#80c060', text: 'Щелчок в стене — и в тебя летит отравленный дротик!' },
  gas:     { name: 'Ядовитые испарения', color: '#a080d0', text: 'Из трещин в полу поднимается сладковатый туман. Голова идёт кругом.' },
  collapse:{ name: 'Обвал', color: '#a0a0a0', text: 'Над головой трещит свод — сыплются камни!' },
  bell:    { name: 'Сигнальные колокольцы', color: '#e0c060', text: 'Ты задеваешь натянутую нить — где-то в темноте звенят колокольцы. Теперь тебя ждут.' },
};

// Надписи на стенах — по типам подземелий.
const INSCRIPTIONS = {
  roman: ['DIS MANIBVS — «Богам подземным». Ниже имя, стёртое долотом.', 'HIC SITVS EST — «Здесь лежит». И чья-то рука приписала углём: «и пусть лежит».',
    'SIT TIBI TERRA LEVIS — «Да будет тебе земля пухом». Буквы покрыты копотью от факелов.'],
  etruscan: ['Вязь этрусских букв, бегущих справа налево. Ниже — синий демон с молотом, у его ног — человек на коленях.',
    'Роспись: двое пируют на ложе, а за занавесом стоит тень с крыльями. Краски такие свежие, будто вчера.'],
  catacomb: ['Рыба и якорь, выцарапанные гвоздём: знак первых христиан. Рядом — «IN PACE».', 'Голубь с масличной ветвью и имя: «Ирина, жила 4 года». Кто-то недавно оставил здесь цветок.',
    'Свежая надпись углём: «Ушли вниз за мощами. Если не вернёмся — молитесь». Подписи нет.'],
  mithraeum: ['Рельеф: юноша во фригийском колпаке заносит нож над быком. Из раны быка растут колосья.', 'NAMA SEBESIO — «Слава Себесию». Слова посвящённых, тайные для непосвящённых.'],
  grotto: ['Нацарапано ножом: «Здесь Якопо с „Санта-Марии“. Корабль разбит. Жду». Ниже ещё черта — и ничего.', 'Ракушки, выложенные крестом. Кто-то молился здесь — или звал на помощь.'],
  mine: ['Римские цифры — счёт добытых корзин. Последние перечёркнуты.', 'Углём: «Хозяин горы не любит ругани. Пой». И ноты, которых никто уже не споёт.'],
  crypt: ['Герб сбит зубилом, но девиз уцелел: «Deus vult». Под ним — дата, которую не разобрать.', 'На надгробии: «Он вернулся из-за моря с золотом и без покоя. Помолитесь о нём».'],
  sibyl: ['«Facilis descensus Averno; noctes atque dies patet atri ianua Ditis» — «лёгок спуск в Аверн; дверь Дита открыта ночью и днём».',
    'Листья с буквами: Сивилла писала пророчества на листьях, а ветер их путал.'],
  inferi: ['На оплавленном камне: «Оставь надежду». Чей-то почерк — и чья-то шутка.', 'Знаки, которых нет ни в одном языке. Смотреть на них долго не хочется.'],
};

// Расставить секреты на только что построенном уровне.
function addSecrets(w, r, P, rooms, first, def) {
  w.traps = new Map();
  w.secrets = new Set();
  w.inscriptions = new Map();
  const nearUp = (x, y) => Math.max(Math.abs(x - first.cx), Math.abs(y - first.cy)) < 4;
  const floorCells = [];
  for (let y = 1; y < w.h - 1; y++)
    for (let x = 1; x < w.w - 1; x++) if (w.get(x, y) === P.floor && !nearUp(x, y)) floorCells.push([x, y]);
  if (!floorCells.length) return;

  // Потайные ниши за стеной: 1–2 на уровень.
  const want = r.int(1, 2);
  for (let t = 0, made = 0; t < 300 && made < want; t++) {
    const room = carveCloset(w, r, P, floorCells);
    if (!room) continue;
    w.secrets.add(room.door);
    addContainer(w, room.chest, 'secret');
    made++;
  }
  // Запертая сокровищница и ключ к ней (не на первом уровне малых подземелий).
  if (w.depth > 0 || r.chance(0.5)) {
    const vault = carveCloset(w, r, P, floorCells);
    if (vault) {
      w.tiles[vault.door] = T.LOCKED;
      addContainer(w, vault.chest, 'vault');
      const far = floorCells.filter(([x, y]) => Math.hypot(x - (vault.door % w.w), y - ((vault.door / w.w) | 0)) > 15 && w.get(x, y) === P.floor);
      const [kx, ky] = r.pick(far.length ? far : floorCells);
      w.addItem(kx, ky, { kind: 'key', name: 'Старый ключ', lock: vault.door });
      w.vaultDoor = vault.door;
    }
  }
  // Ловушки — в ходах и комнатах.
  const kinds = Object.keys(TRAPS), n = 3 + w.depth + r.int(0, 2);
  for (let t = 0, made = 0; t < 400 && made < n; t++) {
    const [x, y] = r.pick(floorCells), i = w.idx(x, y);
    if (w.get(x, y) !== P.floor || w.traps.has(i) || w.items.get(`${x},${y}`)) continue;
    w.traps.set(i, { kind: r.pick(kinds), found: false });
    made++;
  }
  // Надписи на стенах.
  const texts = INSCRIPTIONS[w.site.type || 'roman'] || INSCRIPTIONS.roman;
  for (let t = 0, made = 0; t < 400 && made < 2; t++) {
    const [x, y] = r.pick(floorCells);
    const [dx, dy] = r.pick(DIRS4), wx = x + dx, wy = y + dy;
    if (w.get(wx, wy) !== P.wall || w.secrets.has(w.idx(wx, wy)) || wx < 1 || wy < 1 || wx >= w.w - 1 || wy >= w.h - 1) continue;
    w.set(wx, wy, T.INSCRIPTION);
    w.inscriptions.set(w.idx(wx, wy), r.pick(texts));
    made++;
  }
}

// Вырубить в толще стены комнату 3×3 за дверью. Возвращает { door, chest } (индексы).
function carveCloset(w, r, P, floorCells) {
  for (let t = 0; t < 60; t++) {
    const [fx, fy] = r.pick(floorCells), [dx, dy] = r.pick(DIRS4);
    const doorX = fx + dx, doorY = fy + dy;
    if (w.get(doorX, doorY) !== P.wall && w.get(doorX, doorY) !== P.niche) continue;
    const cx = doorX + dx * 3, cy = doorY + dy * 3;
    let solid = true;
    for (let y = cy - 2; y <= cy + 2 && solid; y++)
      for (let x = cx - 2; x <= cx + 2 && solid; x++) {
        if (x < 1 || y < 1 || x >= w.w - 1 || y >= w.h - 1) solid = false;
        else if (TILES[w.get(x, y)].walk || w.get(x, y) === T.LOCKED || w.get(x, y) === T.INSCRIPTION) solid = false;
      }
    if (!solid) continue;
    // Проход от двери к комнате тоже должен идти по сплошной скале.
    if (TILES[w.get(doorX + dx, doorY + dy)].walk) continue;
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) w.set(x, y, P.floor);
    w.set(doorX + dx, doorY + dy, P.floor);
    w.set(doorX, doorY, P.wall);
    w.set(cx + dx, cy + dy, T.CHEST);
    return { door: w.idx(doorX, doorY), chest: w.idx(cx + dx, cy + dy) };
  }
  return null;
}

// ─── Заметить ──────────────────────────────────────────────────────

// Оглядеться: ловушки в двух шагах, тайные двери — рядом.
function senseSecrets(searching) {
  const w = G.world, p = G.player;
  if (!w || w.kind !== 'dungeon' || !w.traps) return;
  const sharp = 0.08 + p.stats.wis * 0.025 + p.stats.dex * 0.015 + (searching ? 0.3 : 0);
  for (const [i, tr] of w.traps) {
    if (tr.found) continue;
    const x = i % w.w, y = (i / w.w) | 0, d = Math.max(Math.abs(x - p.x), Math.abs(y - p.y));
    if (d > 2 || !w.isVisible(x, y) || !rng.chance(sharp / d)) continue;
    tr.found = true;
    log(`Ты замечаешь ловушку: ${TRAPS[tr.kind].name.toLowerCase()} (^). Можно обойти — или попробовать обезвредить, шагнув на неё.`, C.orange);
    stopAuto();
  }
  for (const i of w.secrets) {
    const x = i % w.w, y = (i / w.w) | 0;
    if (Math.max(Math.abs(x - p.x), Math.abs(y - p.y)) > 1) continue;
    if (!rng.chance(sharp * (searching ? 1.2 : 0.5))) continue;
    w.secrets.delete(i);
    w.set(x, y, T.DOOR);
    log(searching ? 'Ты простукиваешь стену — один камень звучит глухо. За ним тайный ход!' : 'Сквозняк из щели в стене — за кладкой пустота. Тайная дверь!', C.gold);
    chronicle(`Нашёл тайный ход: ${w.site.name}.`, 'find');
    stopAuto();
  }
}

// ─── Ловушки ───────────────────────────────────────────────────────

function trapAt(w, x, y) { return w.traps && w.traps.get(w.idx(x, y)); }

// Наступить на клетку с ловушкой (после шага).
function springTrap(x, y) {
  const w = G.world, p = G.player, i = w.idx(x, y), tr = w.traps.get(i);
  if (!tr) return;
  const T_ = TRAPS[tr.kind];
  tr.found = true;
  // Ловкий успевает отпрыгнуть.
  if (rng.chance(0.05 + p.stats.dex * 0.03)) { log(`${T_.name}! Ты успеваешь отпрыгнуть в последний миг.`, C.orange); return; }
  log(T_.text, C.red);
  const hurt = n => { p.hp -= n; log(`−${n} здоровья.`, C.red); if (p.hp <= 0) G.deathCause = T_.name.toLowerCase(); };
  switch (tr.kind) {
    case 'pit': hurt(rng.int(3, 8) + w.depth); break;
    case 'dart': hurt(rng.int(1, 4)); if (!rng.chance(gearSum(p, 'poisonRes'))) p.poison += 5; break;
    case 'gas': p.confused = Math.max(p.confused, 5); p.poison += 2; break;
    case 'collapse':
      hurt(rng.int(4, 10) + w.depth);
      w.traps.delete(i);
      for (const [dx, dy] of DIRS8) {
        const t = w.get(x + dx, y + dy);
        if (rng.chance(0.4) && TILES[t].walk && t !== T.STAIRS_UP && t !== T.STAIRS_DOWN && !w.actorAt(x + dx, y + dy)) w.set(x + dx, y + dy, T.RUBBLE);
      }
      break;
    case 'bell':
      w.traps.delete(i);
      for (const a of w.actors) if (a.kind === 'beast') { a.target = [p.x, p.y]; a.provoked = true; }
      break;
  }
  checkDeath();
}

// Шаг на замеченную ловушку — попытка обезвредить. Возвращает true, если шаг потрачен на это.
function tryDisarm(x, y) {
  const w = G.world, p = G.player, i = w.idx(x, y), tr = w.traps && w.traps.get(i);
  if (!tr || !tr.found) return false;
  if (rng.chance(0.35 + p.stats.dex * 0.05)) {
    w.traps.delete(i);
    log(`Ты осторожно обезвреживаешь ловушку: ${TRAPS[tr.kind].name.toLowerCase()}.`, C.green);
    p.gainXp(2);
  } else {
    log('Рука дрогнула...', C.orange);
    moveTo(p, x, y);
    springTrap(x, y);
  }
  endTurn();
  return true;
}

// ─── Двери, ключи, надписи ─────────────────────────────────────────

function tryLocked(x, y) {
  const w = G.world, p = G.player, i = w.idx(x, y);
  p.keys = p.keys || [];
  const k = p.keys.findIndex(key => key.place === w.placeKey && key.lock === i);
  if (k >= 0) {
    p.keys.splice(k, 1);
    w.set(x, y, T.DOOR);
    log('Ключ со скрипом поворачивается в замке. Решётка открыта.', C.gold);
  } else if (rng.chance(0.06 + p.stats.str * 0.025)) {
    w.set(x, y, T.DOOR);
    log('Ты наваливаешься плечом — ржавые петли не выдерживают. Решётка падает с грохотом на весь подземный ход.', C.gold);
    for (const a of w.actors) if (a.kind === 'beast' && dist(a, p) < 18) a.target = [p.x, p.y];
  } else log('Решётка заперта. Ключ должен быть где-то здесь — или попробуй выломать (ещё раз).', C.dim);
  endTurn();
}

function readInscription(x, y) {
  const w = G.world, text = w.inscriptions && w.inscriptions.get(w.idx(x, y));
  if (text) log(`На стене: ${text}`, C.violet);
}

function pickKey(it) {
  const p = G.player;
  p.keys = p.keys || [];
  p.keys.push({ place: G.world.placeKey, lock: it.lock });
  log('Ты подбираешь старый ключ — тяжёлый, бронзовый. Где-то здесь есть дверь под него.', C.gold);
}
