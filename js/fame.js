'use strict';

// ─── Слава ─────────────────────────────────────────────────────────
// Известность героя: растёт от подвигов, о которых рассказывают люди, —
// хозяева подземелий, головы атаманов, турниры, отбитые набеги, великие
// сквозные дела. Обычные поручения дают немного. Подвиг вдали от людей
// (в глуши, под землёй) прибавляет меньше: слава живёт там, где о ней говорят.
// Что даёт: знаменитого узнают, жонглёры поют о нём, платят ему щедрее,
// мелкие шайки разбегаются, а важные люди (сеньоры, император) говорят о делах.

/** @type {[number, string][]} */
const FAME_RANKS = [
  [0, 'Безвестный'], [10, 'Известен в округе'], [30, 'О нём говорят в тавернах'], [55, 'О нём поют жонглёры'], [80, 'Прославленный'],
];

function fameOf(p = G.player) { return p.fame || 0; }
function fameRank(n = fameOf()) {
  let r = FAME_RANKS[0][1];
  for (const [min, name] of FAME_RANKS) if (n >= min) r = name;
  return r;
}

// deed — коротко, «кто сделал что»: «одолел тень проконсула».
function addFame(n, deed) {
  const p = G.player;
  if (!p) return;
  const old = fameOf(p);
  // Подвиг вдали от людей — слава скромнее.
  const far = n > 0 && G.mode === 'local' && G.world && (G.world.kind === 'dungeon' || G.world.kind === 'wild');
  const gain = n > 0 ? Math.max(1, Math.round(n * (far ? 0.7 : 1) * (1 + gearSum(p, 'fameBonus')))) : n;
  p.fame = Math.max(0, old + gain);
  if (deed && n > 0) {
    p.deeds = p.deeds || [];
    p.deeds.unshift(deed);
    p.deeds = p.deeds.slice(0, 8);
  }
  if (n >= 3) log(`Слава ${gain > 0 ? '+' : ''}${gain}.`, C.gold);
  if (n < 0) log(`Об этом пойдёт дурная молва. Слава ${gain}.`, C.dark);
  if (fameRank(old) !== fameRank(p.fame) && p.fame > old) {
    log(`О тебе заговорили: теперь ты — «${fameRank(p.fame).toLowerCase()}».`, C.gold);
    chronicle(`Слава растёт: ${fameRank(p.fame).toLowerCase()}.`, 'level');
  }
}

// Надбавка к наградам: знаменитому платят щедрее (до +24%).
function fameRewardMult() { return 1 + Math.min(8, Math.floor(fameOf() / 10)) * 0.03; }

// Узнают на улице.
function fameRecognition(npc) {
  const p = G.player, f = fameOf(p);
  if (f < 30 || !p.deeds || !p.deeds.length || npc.special || npc.emperor) return null;
  if (!rng.chance(0.2 + Math.min(0.3, (f - 30) / 150))) return null;
  const deed = rng.pick(p.deeds.slice(0, 4));
  return rng.pick([
    `Постой… Ты не тот ли, кто ${deed}? {Наслышан, наслышан|Наслышана, наслышана}!`,
    `Да это же ты ${deed}! Про тебя в таверне рассказывали — я не {поверил|поверила}.`,
    `Говорят, ты ${deed}. Правда, что ли? Ну, проходи, гостем будешь.`,
  ]);
}

// Жонглёр поёт о знаменитом герое.
function fameSong() {
  const p = G.player;
  if (fameOf(p) < 55 || !p.deeds || !p.deeds.length || !rng.chance(0.4)) return null;
  return `Жонглёр поёт новую песню — о чужеземце по имени ${p.name}, который ${rng.pick(p.deeds)}. Толпа подпевает припев; `
    + 'тебя самого никто не узнаёт — в песне ты выше на голову и с золотыми кудрями.';
}

// Мелкая шайка, услышав имя, разбегается.
function fameScaresBrigands(b) {
  return fameOf() >= 55 && !b.elite && rng.chance(0.35);
}
