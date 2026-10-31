'use strict';

// ─── Инквизиция ────────────────────────────────────────────────────
// Дурная молва (p.heresy) копится, когда герой учится тайной науке, режет
// печати, колдует при людях, носит языческое на глазах набожных, приносит
// жертвы подземным богам. Со временем молва стихает, а исповедь у аббата
// гасит её быстрее. Если молвы много, в гвельфских городах и в Папской
// области героя может ждать доминиканец — брат Пьетро из Вероны,
// проповедник против катаров. Он не отпустит без ответа: покаяться,
// отпираться, откупиться или бежать. В землях императора и в Лючере
// инквизиторам воли нет; сарацина их суд не касается.

function suspect(n, why) {
  const p = G.player;
  if (!p || p.is('saracen')) return;
  const old = p.heresy || 0;
  p.heresy = old + n;
  if (old < 4 && p.heresy >= 4) log('Ты ловишь на себе косые взгляды. О тебе начинают шептаться.', C.dark);
  else if (why) log(why, C.dark);
}

// Раз в десять дней молва понемногу стихает.
function heresyDaily(day) {
  const p = G.player;
  if (p && p.heresy > 0 && day % 10 === 0) p.heresy--;
}

HISTORIC['Брат Пьетро из Вероны'] = {
  full: 'Пьетро из Вероны (святой Пётр Мученик)', years: 'ок. 1205 — 1252',
  text: 'Доминиканец, сын родителей-катаров, ставший их непримиримым врагом. В 1230–1240-х проповедовал против ересей в Милане '
    + 'и по всей Ломбардии, основал братства «верных», собиравших доносы. В 1251 году назначен инквизитором Ломбардии; '
    + 'в 1252-м убит катарами по дороге из Комо в Милан и через год причислен к святым.',
};

function inquisitorHere(city) {
  if (!['city', 'town'].includes(city.kind)) return false;
  return city.region === 'papal' || cityFaction(city) === 'guelf';
}

function inquisitionEnter(world, city) {
  const p = G.player, day = timeInfo().day, v = world.villages[0];
  if (!v) return null;
  for (const n of v.npcs.filter(n => n.inquisitor)) { v.npcs = v.npcs.filter(x => x !== n); world.actors = world.actors.filter(x => x !== n); }
  if (p.is('saracen') || (p.heresy || 0) < 4 || !inquisitorHere(city) || (G.inqCool || 0) > day) return null;
  if (!rng.chance(Math.min(0.6, 0.1 + p.heresy * 0.04))) return null;
  G.inqCool = day + 8;
  const spot = findFreeIn(world, { x: v.cx - 4, y: v.cy - 2, w: 9, h: 5, building: -1 });
  if (!spot) return null;
  const npc = makeNpc('priest', v, { x: v.cx - 4, y: v.cy - 2, w: 9, h: 5, building: -1 }, spot[0], spot[1]);
  Object.assign(npc, { name: 'Брат Пьетро из Вероны', title: 'Доминиканец-проповедник', inquisitor: true, special: 'inquisitor', portrait: 'dominican',
    noEscape: true, color: '#e8e8e8',
    greeting: 'Двое стражников подесты встают у тебя за спиной. Монах в белой рясе и чёрном плаще смотрит пристально. '
      + `«Ты — ${p.name}? О тебе говорят странное: звёзды, печати, языческие обереги. Вера — не рынок, где торгуются. Отвечай».` });
  v.npcs.push(npc);
  world.actors.push(npc);
  return npc;
}

// Покаяние: обереги в огонь, штраф, молва — в ноль.
function penance(npc, mult = 1) {
  const p = G.player;
  const pagan = [...equippedItems(p).filter(it => it.pagan), ...p.bag.filter(it => it.pagan)];
  for (const slot of Object.keys(p.equip)) if (p.equip[slot] && p.equip[slot].pagan) p.equip[slot] = null;
  p.bag = p.bag.filter(it => !it.pagan);
  const fine = Math.min(p.coins, Math.round((20 + (p.heresy || 0) * 5) * mult));
  p.coins -= fine;
  p.heresy = 0;
  addPiety(3, 'Публичное покаяние.');
  addFame(-2);
  chronicle(`Принёс покаяние перед доминиканцем Пьетро из Вероны${pagan.length ? ', отдал в огонь языческие обереги' : ''}.`, 'faith');
  npc.done = true;
  return `${pagan.length ? `Твои обереги — ${pagan.map(it => lower(it.name)).join(', ')} — летят в жаровню. ` : ''}`
    + `Ты стоишь на ступенях собора со свечой в руке, пока монах читает о твоих грехах всему городу. Штраф — ${coins(fine)}. `
    + '«Иди. И помни: в следующий раз будет не свеча, а костёр».';
}

function inquisitorOptions(npc) {
  const p = G.player;
  if (npc.done) return [{ label: 'Уйти', act: () => { npc.noEscape = false; return null; } }];
  const heresy = p.heresy || 0, bribe = p.priceBuy(60 + heresy * 15);
  const end = text => { npc.done = true; npc.noEscape = false; return text; };
  return [
    { label: 'Покаяться', act: () => { npc.noEscape = false; return penance(npc); } },
    { label: '«Я добрый христианин»', act: () => {
      const ok = rng.chance(Math.max(0.05, 0.25 + skillLevel(p, 'speech') * 0.08 + p.piety / 200 - heresy * 0.03));
      trainSkill(p, 'speech', 3);
      if (ok) { p.heresy = Math.max(0, heresy - 3); return end('Ты говоришь спокойно, крестишься, читаешь «Верую» без запинки. Монах молчит долго. «Ступай. Но я буду знать о тебе».'); }
      npc.noEscape = false;
      return 'Монах обрывает тебя: «Ложь — второй грех после первого». ' + penance(npc, 2);
    } },
    { label: `Сделать «пожертвование на обитель» (${bribe} мон.)`, act: () => {
      if (p.coins < bribe) return '«Ты предлагаешь мне то, чего у тебя нет? Значит, и вера твоя такая же».';
      p.coins -= bribe;
      if (rng.chance(0.7)) { p.heresy = Math.floor(heresy / 2); addPiety(-3, 'Ты купил молчание слуги Божьего.'); return end('Монах берёт кошель, не глядя на тебя. «На нужды ордена. Молись больше». Стражники отходят.'); }
      npc.noEscape = false;
      return '«Ты пытаешься купить слугу Божьего?» Кошель отправляется в церковную казну — вместе с тобой на покаяние. ' + penance(npc, 2);
    } },
    { label: 'Бежать', act: () => {
      const ok = rng.chance(0.35 + skillLevel(p, 'stealth') * 0.07 + skillLevel(p, 'athletics') * 0.05);
      npc.noEscape = false;
      if (ok) {
        p.heresy = heresy + 2;
        addFame(-3);
        npc.done = true;
        chronicle(`Бежал от доминиканца в ${placeAcc(npc.village.city)}.`, 'event');
        if (G.mode === 'local') leaveLocal();
        return 'Ты бьёшь стражника локтем и ныряешь в переулок. Крики, топот — но ты уже за воротами. Об этом будут говорить.';
      }
      passTime(1440);
      return 'Стражник ставит подножку — и ты лицом в мостовую. Ночь в подвале палаццо, утром — суд. ' + penance(npc, 2);
    } },
  ];
}
