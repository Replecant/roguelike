'use strict';

// ─── Склонения ─────────────────────────────────────────────────────

const NUM_WORDS = { 2: 'двух', 3: 'трёх', 4: 'четырёх', 5: 'пятерых' };
function numAcc(n, g) {
  if (n === 1) return g === 'f' ? 'одну' : 'одного';
  return NUM_WORDS[n] || String(n);
}
