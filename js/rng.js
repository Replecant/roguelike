'use strict';

// Детерминированный генератор случайных чисел (mulberry32).
class RNG {
  constructor(seed) {
    this.seed = (seed >>> 0) || 1;
    this.s = this.seed;
  }

  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }

  roll(min, max) { return this.int(min, max); }

  dice(n, sides) {
    let t = 0;
    for (let i = 0; i < n; i++) t += this.int(1, sides);
    return t;
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Выбор по весам: items = [{w: число, ...}, ...]
  weighted(items, key = 'w') {
    const total = items.reduce((s, it) => s + it[key], 0);
    let r = this.next() * total;
    for (const it of items) {
      r -= it[key];
      if (r < 0) return it;
    }
    return items[items.length - 1];
  }
}

let rng = new RNG(Date.now());

// Стабильный хэш координат — для «текстуры» травы и т.п.
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
