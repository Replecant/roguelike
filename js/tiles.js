'use strict';

// ─── Простая графика (пробный режим) ───────────────────────────────
// Вместо символов на карте рисуются маленькие картинки из простых фигур:
// деревце, ель, холм, гора со снегом, волны, кустики травы, колосья, кирпичная
// стена, дверь, домик, башня, человечек; звери и люди — круглые «фишки» со своей
// буквой. Цвета — те же, что у символов, поэтому вся остальная игра не меняется.
// Включается флагом TILE_MODE (сборка «тайлы») или в отладке.

// По умолчанию — картинки; символы — по выбору игрока (G), выбор помнится в браузере.
function tileModeSaved() {
  try { const v = localStorage.getItem('annoTiles'); if (v !== null) return v === '1'; } catch (e) { /* хранилище недоступно */ }
  return true;
}
let TILE_MODE = typeof window === 'undefined' ? false : /[?&]ascii\b/.test(location.search) ? false : /[?&]tiles\b/.test(location.search) ? true : tileModeSaved();
function toggleTiles() {
  TILE_MODE = !TILE_MODE;
  try { localStorage.setItem('annoTiles', TILE_MODE ? '1' : '0'); } catch (e) { /* не страшно */ }
  log(TILE_MODE ? 'Карта: картинки. (G — вернуть символы)' : 'Карта: символы. (G — вернуть картинки)', C.dim);
}

const shade = (c, k) => mix(c, k > 0 ? '#ffffff' : '#000000', Math.abs(k));

// Каждая функция рисует в клетке (x, y, w, h) цветом fg. Возвращает true, если нарисовала.
const SPRITES = {
  grass(ctx, x, y, w, h, fg, v) {
    ctx.strokeStyle = fg; ctx.lineWidth = 1;
    const tufts = v < 0.5 ? [[0.3, 0.7]] : [[0.25, 0.75], [0.7, 0.45]];
    for (const [ax, ay] of tufts) {
      const bx = x + w * ax, by = y + h * ay;
      ctx.beginPath(); ctx.moveTo(bx - 1.5, by); ctx.lineTo(bx - 2.5, by - h * 0.18);
      ctx.moveTo(bx, by); ctx.lineTo(bx, by - h * 0.24); ctx.moveTo(bx + 1.5, by); ctx.lineTo(bx + 2.5, by - h * 0.18); ctx.stroke();
    }
    return true;
  },
  crops(ctx, x, y, w, h, fg) {
    ctx.strokeStyle = fg; ctx.lineWidth = 1.2;
    for (const ax of [0.22, 0.5, 0.78]) {
      const bx = x + w * ax;
      ctx.beginPath(); ctx.moveTo(bx, y + h * 0.85); ctx.lineTo(bx, y + h * 0.3); ctx.stroke();
      ctx.fillStyle = shade(fg, 0.15); ctx.beginPath(); ctx.ellipse(bx, y + h * 0.3, 1.4, h * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    }
    return true;
  },
  tree(ctx, x, y, w, h, fg) {
    ctx.fillStyle = '#5a3c22'; ctx.fillRect(x + w * 0.44, y + h * 0.58, w * 0.14, h * 0.32);
    ctx.fillStyle = shade(fg, -0.25); ctx.beginPath(); ctx.ellipse(x + w * 0.52, y + h * 0.42, w * 0.46, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(x + w * 0.45, y + h * 0.36, w * 0.36, h * 0.24, 0, 0, Math.PI * 2); ctx.fill();
    return true;
  },
  pine(ctx, x, y, w, h, fg) {
    ctx.fillStyle = '#4a3220'; ctx.fillRect(x + w * 0.44, y + h * 0.75, w * 0.12, h * 0.17);
    for (const [top, half, k] of [[0.1, 0.32, 0.12], [0.3, 0.42, 0], [0.5, 0.5, -0.15]]) {
      ctx.fillStyle = shade(fg, k); ctx.beginPath();
      ctx.moveTo(x + w / 2, y + h * top); ctx.lineTo(x + w * (0.5 + half), y + h * (top + 0.3)); ctx.lineTo(x + w * (0.5 - half), y + h * (top + 0.3)); ctx.fill();
    }
    return true;
  },
  hill(ctx, x, y, w, h, fg) {
    ctx.fillStyle = shade(fg, -0.2); ctx.beginPath();
    ctx.moveTo(x, y + h * 0.85); ctx.quadraticCurveTo(x + w / 2, y + h * 0.15, x + w, y + h * 0.85); ctx.fill();
    ctx.fillStyle = shade(fg, 0.15); ctx.beginPath();
    ctx.moveTo(x + w * 0.2, y + h * 0.6); ctx.quadraticCurveTo(x + w * 0.4, y + h * 0.3, x + w * 0.55, y + h * 0.38); ctx.lineTo(x + w * 0.35, y + h * 0.62); ctx.fill();
    return true;
  },
  mountain(ctx, x, y, w, h, fg) {
    ctx.fillStyle = shade(fg, -0.25); ctx.beginPath(); ctx.moveTo(x + w / 2, y + h * 0.08); ctx.lineTo(x + w, y + h * 0.92); ctx.lineTo(x, y + h * 0.92); ctx.fill();
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(x + w / 2, y + h * 0.08); ctx.lineTo(x + w * 0.5, y + h * 0.92); ctx.lineTo(x, y + h * 0.92); ctx.fill();
    ctx.fillStyle = '#f4f6fa'; ctx.beginPath(); ctx.moveTo(x + w / 2, y + h * 0.08); ctx.lineTo(x + w * 0.68, y + h * 0.35); ctx.lineTo(x + w * 0.32, y + h * 0.35); ctx.fill();
    return true;
  },
  water(ctx, x, y, w, h, fg, v) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = fg; ctx.lineWidth = 1.2;
    const off = (v * w) % (w * 0.5);
    for (const ay of [0.38, 0.72]) {
      ctx.beginPath();
      for (let i = -1; i <= 2; i++) {
        const sx = x + i * w * 0.5 + off - w * 0.25;
        ctx.moveTo(sx, y + h * ay); ctx.quadraticCurveTo(sx + w * 0.125, y + h * (ay - 0.1), sx + w * 0.25, y + h * ay);
      }
      ctx.stroke();
    }
    ctx.restore();
    return true;
  },
  road(ctx, x, y, w, h, fg, v) {
    ctx.fillStyle = fg;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x + w * (0.2 + v * 0.2), y + h * 0.35, 2, 2);
    ctx.fillRect(x + w * (0.55 + v * 0.2), y + h * 0.65, 2, 2);
    ctx.globalAlpha = 1;
    return true;
  },
  bridge(ctx, x, y, w, h, fg) {
    ctx.fillStyle = shade(fg, -0.2); ctx.fillRect(x, y + h * 0.3, w, h * 0.4);
    ctx.strokeStyle = shade(fg, -0.5); ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + w * i / 3, y + h * 0.3); ctx.lineTo(x + w * i / 3, y + h * 0.7); ctx.stroke(); }
    return true;
  },
  wall(ctx, x, y, w, h, fg) {
    ctx.fillStyle = shade(fg, -0.35); ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fg;
    const bh = h / 3;
    for (let r = 0; r < 3; r++) {
      const o = r % 2 ? w * 0.5 : 0;
      for (let bx = -o; bx < w; bx += w) ctx.fillRect(x + Math.max(0, bx) + 0.5, y + r * bh + 0.5, Math.min(w, bx + w) - Math.max(0, bx) - 1, bh - 1);
    }
    return true;
  },
  door(ctx, x, y, w, h, fg) {
    ctx.fillStyle = shade(fg, -0.3); ctx.fillRect(x + w * 0.15, y + h * 0.1, w * 0.7, h * 0.85);
    ctx.fillStyle = fg; ctx.fillRect(x + w * 0.22, y + h * 0.16, w * 0.56, h * 0.75);
    ctx.fillStyle = '#e0c060'; ctx.fillRect(x + w * 0.62, y + h * 0.55, 1.5, 1.5);
    return true;
  },
  house(ctx, x, y, w, h, fg) {
    ctx.fillStyle = '#b8a888'; ctx.fillRect(x + w * 0.15, y + h * 0.48, w * 0.7, h * 0.42);
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(x + w / 2, y + h * 0.12); ctx.lineTo(x + w * 0.98, y + h * 0.5); ctx.lineTo(x + w * 0.02, y + h * 0.5); ctx.fill();
    ctx.fillStyle = '#3a2814'; ctx.fillRect(x + w * 0.42, y + h * 0.66, w * 0.18, h * 0.24);
    return true;
  },
  town(ctx, x, y, w, h, fg) {
    ctx.fillStyle = '#c8b898'; ctx.fillRect(x + w * 0.1, y + h * 0.42, w * 0.8, h * 0.48);
    ctx.fillStyle = '#b05a34'; ctx.fillRect(x + w * 0.05, y + h * 0.3, w * 0.9, h * 0.14);
    ctx.fillStyle = fg; ctx.fillRect(x + w * 0.38, y + h * 0.08, w * 0.24, h * 0.36);
    return true;
  },
  castle(ctx, x, y, w, h, fg) {
    ctx.fillStyle = shade(fg, -0.2); ctx.fillRect(x + w * 0.15, y + h * 0.3, w * 0.7, h * 0.62);
    ctx.fillStyle = fg;
    for (const ax of [0.15, 0.43, 0.71]) ctx.fillRect(x + w * ax, y + h * 0.16, w * 0.14, h * 0.16);
    ctx.fillStyle = '#20160c'; ctx.fillRect(x + w * 0.42, y + h * 0.62, w * 0.16, h * 0.3);
    return true;
  },
  cross(ctx, x, y, w, h, fg) {
    ctx.fillStyle = fg; ctx.fillRect(x + w * 0.43, y + h * 0.12, w * 0.14, h * 0.78); ctx.fillRect(x + w * 0.2, y + h * 0.3, w * 0.6, h * 0.12);
    return true;
  },
  herb(ctx, x, y, w, h, fg) {
    ctx.strokeStyle = '#4a8a3a'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x + w / 2, y + h * 0.9); ctx.lineTo(x + w / 2, y + h * 0.4); ctx.stroke();
    ctx.fillStyle = fg;
    for (const [ax, ay] of [[0.3, 0.35], [0.7, 0.4], [0.5, 0.22]]) { ctx.beginPath(); ctx.arc(x + w * ax, y + h * ay, w * 0.17, 0, Math.PI * 2); ctx.fill(); }
    return true;
  },
  coins(ctx, x, y, w, h, fg) {
    ctx.fillStyle = shade(fg, -0.3); ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * 0.62, w * 0.36, h * 0.13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * 0.52, w * 0.36, h * 0.13, 0, 0, Math.PI * 2); ctx.fill();
    return true;
  },
  sack(ctx, x, y, w, h, fg) {
    ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * 0.62, w * 0.38, h * 0.26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(x + w * 0.4, y + h * 0.28, w * 0.2, h * 0.14);
    return true;
  },
  blade(ctx, x, y, w, h, fg) {
    ctx.strokeStyle = fg; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x + w * 0.2, y + h * 0.85); ctx.lineTo(x + w * 0.8, y + h * 0.15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w * 0.15, y + h * 0.6); ctx.lineTo(x + w * 0.5, y + h * 0.8); ctx.stroke();
    return true;
  },
  person(ctx, x, y, w, h, fg) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * 0.9, w * 0.38, h * 0.06, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(x + w * 0.18, y + h * 0.88); ctx.lineTo(x + w * 0.3, y + h * 0.42); ctx.lineTo(x + w * 0.7, y + h * 0.42); ctx.lineTo(x + w * 0.82, y + h * 0.88); ctx.fill();
    ctx.fillStyle = '#e8c8a0'; ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.27, Math.min(w, h) * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = shade(fg, -0.4); ctx.lineWidth = 1; ctx.stroke();
    return true;
  },
};

// Символ на местности → картинка.
const TERRAIN_SPRITE = {
  '.': 'grass', ',': 'grass', '"': 'crops', "'": 'crops', '♣': 'tree', '♠': 'pine', '∩': 'hill', 'n': 'hill', '^': 'hill',
  '▲': 'mountain', '≈': 'water', '~': 'water', '·': 'road', '=': 'bridge', '#': 'wall', '+': 'door',
};
const FEATURE_SPRITE = { '⌂': 'house', '□': 'town', 'Ш': 'castle', '†': 'cross', 'ψ': 'herb', '$': 'coins', '%': 'sack', ')': 'blade' };

// mark: 1 — местность, 2 — живое (люди и звери), 3 — предметы и места.
function drawSprite(ctx, c, fg, bg, x, y, w, h, mark, cell) {
  if (mark === 2) {
    // Живые рисуются крупнее клетки (вторым проходом, поверх соседей).
    if (c === '@') { const W = w * 1.6, H = h * 1.15; return SPRITES.person(ctx, x - (W - w) / 2, y - (H - h) * 0.75, W, H, fg); }
    // Фишка: кружок цвета твари, буква — тёмная.
    const r = h * 0.4;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(x + w / 2 + 1, y + h / 2 + 1, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = mix(fg, '#000000', 0.55); ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = mix(fg, '#000000', 0.8);
    ctx.font = `bold ${Math.round(h * 0.55)}px ${G.term.fontFamily}`;
    ctx.fillText(c, x + w / 2, y + h / 2 + 1);
    ctx.font = `${G.term.fs}px ${G.term.fontFamily}`;
    return true;
  }
  const name = mark === 1 ? TERRAIN_SPRITE[c] : FEATURE_SPRITE[c] || TERRAIN_SPRITE[c];
  if (!name) return false;
  return SPRITES[name](ctx, x, y, w, h, fg, hash2(cell, 7));
}
