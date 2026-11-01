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
// Настил моста: поперёк реки; если рядом по ширине тоже мост — настил до края клетки (a — сверху/слева, b — снизу/справа).
function drawBridge(ctx, x, y, w, h, fg, vert, a, b) {
  const lo = a ? 0 : 0.3, hi = b ? 1 : 0.7;
  ctx.fillStyle = shade(fg, -0.2);
  if (vert) ctx.fillRect(x + w * lo, y, w * (hi - lo), h); else ctx.fillRect(x, y + h * lo, w, h * (hi - lo));
  ctx.strokeStyle = shade(fg, -0.5); ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    if (vert) { ctx.moveTo(x + w * lo, y + h * i / 3); ctx.lineTo(x + w * hi, y + h * i / 3); }
    else { ctx.moveTo(x + w * i / 3, y + h * lo); ctx.lineTo(x + w * i / 3, y + h * hi); }
    ctx.stroke();
  }
  return true;
}

// Проселок: тонкая земляная тропка от середины клетки к соседним клеткам пути (N, E, S, W — биты 1, 2, 4, 8).
function drawTrack(ctx, x, y, w, h, mask) {
  ctx.fillStyle = '#7a6040';
  ctx.globalAlpha = 0.85;
  const t = Math.max(2, Math.round(w * 0.16)), cx = x + w / 2 - t / 2, cy = y + h / 2 - t / 2;
  ctx.fillRect(cx, cy, t, t);
  if (mask & 1) ctx.fillRect(cx, y, t, h / 2);
  if (mask & 4) ctx.fillRect(cx, y + h / 2, t, h / 2);
  if (mask & 8) ctx.fillRect(x, cy, w / 2, t);
  if (mask & 2) ctx.fillRect(x + w / 2, cy, w / 2, t);
  ctx.globalAlpha = 1;
  return true;
}

function drawBareTree(ctx, x, y, w, h, fg, v, leaves) {
  const bark = '#4e3828', twig = mix(bark, fg, 0.45), m = v < 0.5 ? 1 : -1;   // крона то влево, то вправо
  ctx.fillStyle = bark; ctx.fillRect(x + w * 0.45, y + h * 0.5, w * 0.11, h * 0.4);
  ctx.strokeStyle = twig; ctx.lineCap = 'round';
  const line = (x0, y0, x1, y1, lw) => { ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x + w * x0, y + h * y0); ctx.lineTo(x + w * x1, y + h * y1); ctx.stroke(); };
  const c = (a) => 0.5 + (a - 0.5) * m;
  line(0.5, 0.55, c(0.28), 0.24, 1.4); line(0.5, 0.55, c(0.72), 0.2, 1.4); line(0.5, 0.6, 0.5, 0.1, 1.5);
  line(c(0.36), 0.36, c(0.18), 0.3, 1); line(c(0.64), 0.32, c(0.84), 0.3, 1); line(0.5, 0.3, c(0.62), 0.14, 1); line(c(0.31), 0.28, c(0.36), 0.12, 1);
  ctx.lineCap = 'butt';
  if (leaves) {
    ctx.fillStyle = fg;
    for (const [ax, ay] of [[0.26, 0.24], [0.7, 0.18], [0.5, 0.12], [0.82, 0.3], [0.2, 0.32], [0.6, 0.3]])
      { ctx.beginPath(); ctx.ellipse(x + w * c(ax), y + h * ay, w * 0.08, h * 0.05, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  return true;
}

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
  // Лиственное дерево зимой: голые ветви; поздней осенью и ранней весной — редкие листья на ветвях.
  treebare(ctx, x, y, w, h, fg, v) { return drawBareTree(ctx, x, y, w, h, fg, v, false); },
  treesparse(ctx, x, y, w, h, fg, v) { return drawBareTree(ctx, x, y, w, h, fg, v, true); },
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
  bridge(ctx, x, y, w, h, fg) { return drawBridge(ctx, x, y, w, h, fg, false, false, false); },
  bridgea(ctx, x, y, w, h, fg) { return drawBridge(ctx, x, y, w, h, fg, false, true, false); },
  bridgeb(ctx, x, y, w, h, fg) { return drawBridge(ctx, x, y, w, h, fg, false, false, true); },
  bridgeab(ctx, x, y, w, h, fg) { return drawBridge(ctx, x, y, w, h, fg, false, true, true); },
  bridgev(ctx, x, y, w, h, fg) { return drawBridge(ctx, x, y, w, h, fg, true, false, false); },
  bridgeva(ctx, x, y, w, h, fg) { return drawBridge(ctx, x, y, w, h, fg, true, true, false); },
  bridgevb(ctx, x, y, w, h, fg) { return drawBridge(ctx, x, y, w, h, fg, true, false, true); },
  bridgevab(ctx, x, y, w, h, fg) { return drawBridge(ctx, x, y, w, h, fg, true, true, true); },
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
// Проселки — 16 вариантов по соседям.
for (let m = 0; m < 16; m++) /** @type {any} */ (SPRITES)['track' + m] = (ctx, x, y, w, h) => drawTrack(ctx, x, y, w, h, m);


// Символ на местности → картинка.
const TERRAIN_SPRITE = {
  '.': 'grass', ',': 'grass', '"': 'crops', "'": 'crops', '♣': 'tree', '♠': 'pine', '∩': 'hill', 'n': 'hill', '^': 'hill',
  '▲': 'mountain', '≈': 'water', '~': 'water', '·': 'road', '=': 'bridge', '#': 'wall', '+': 'door',
};
const FEATURE_SPRITE = { '¤': 'inn', '⌂': 'house', '□': 'town', 'Ш': 'castle', '†': 'cross', 'ψ': 'herb', '$': 'coins', '%': 'sack', ')': 'blade' };

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

// ─── Клетки местной карты: тип клетки → картинка ───────────────────
// Рисуется по типу клетки, а не по символу: мостовая — не трава, хоть и «.».
const px = (ctx, c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
Object.assign(SPRITES, {
  cobble(ctx, x, y, w, h, fg, v) {
    const a = shade(fg, -0.35), b = shade(fg, -0.15);
    px(ctx, a, x, y, w, h);
    const rows = 3, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const o = (r + (v > 0.5 ? 1 : 0)) % 2 ? w * 0.5 : 0;
      for (let bx = -o; bx < w; bx += w * 0.5) {
        const sx = Math.max(x, x + bx + 0.5), ex = Math.min(x + w, x + bx + w * 0.5 - 0.5);
        if (ex > sx) px(ctx, (r + Math.round(bx)) % 2 ? b : shade(fg, -0.22), sx, y + r * rh + 0.5, ex - sx, rh - 1);
      }
    }
    return true;
  },
  planks(ctx, x, y, w, h, fg) {
    px(ctx, shade(fg, -0.25), x, y, w, h);
    ctx.fillStyle = shade(fg, -0.5);
    for (const ay of [0.33, 0.66]) ctx.fillRect(x, y + h * ay, w, 1);
    return true;
  },
  stonefloor(ctx, x, y, w, h, fg, v) {
    px(ctx, shade(fg, -0.55), x, y, w, h);
    ctx.fillStyle = shade(fg, -0.25);
    ctx.fillRect(x + w * (0.2 + v * 0.3), y + h * 0.3, 2, 1);
    ctx.fillRect(x + w * (0.6 - v * 0.2), y + h * 0.7, 2, 1);
    return true;
  },
  dirt(ctx, x, y, w, h, fg, v) {
    ctx.fillStyle = shade(fg, -0.1);
    ctx.fillRect(x + w * (0.15 + v * 0.4), y + h * 0.4, 1.5, 1.5);
    ctx.fillRect(x + w * (0.7 - v * 0.3), y + h * 0.75, 1.5, 1.5);
    return true;
  },
  rock(ctx, x, y, w, h, fg) {
    px(ctx, shade(fg, -0.45), x, y, w, h);
    ctx.fillStyle = shade(fg, -0.2); ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w * 0.3, y + h * 0.2); ctx.lineTo(x + w * 0.7, y + h * 0.35); ctx.lineTo(x + w, y + h); ctx.fill();
    return true;
  },
  ore(ctx, x, y, w, h, fg) {
    SPRITES.rock(ctx, x, y, w, h, '#8a8070');
    ctx.fillStyle = fg; for (const [ax, ay] of [[0.3, 0.5], [0.6, 0.65], [0.45, 0.8]]) ctx.fillRect(x + w * ax, y + h * ay, 2, 2);
    return true;
  },
  marble(ctx, x, y, w, h, fg) {
    px(ctx, shade(fg, -0.1), x, y, w, h);
    ctx.strokeStyle = shade(fg, -0.35); ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(x, y + h * 0.3); ctx.lineTo(x + w, y + h * 0.55); ctx.stroke();
    return true;
  },
  fresco(ctx, x, y, w, h, fg, v) {
    SPRITES.wall(ctx, x, y, w, h, '#8a7a68');
    ctx.fillStyle = ['#a04030', '#3a6aa0', '#c8a040'][Math.floor(v * 3)]; ctx.fillRect(x + w * 0.2, y + h * 0.25, w * 0.6, h * 0.45);
    return true;
  },
  bars(ctx, x, y, w, h, fg) {
    ctx.fillStyle = fg; for (const ax of [0.2, 0.5, 0.8]) ctx.fillRect(x + w * ax - 0.5, y, 1.2, h);
    ctx.fillRect(x, y + h * 0.15, w, 1.2); ctx.fillRect(x, y + h * 0.85, w, 1.2);
    return true;
  },
  niche(ctx, x, y, w, h, fg) {
    SPRITES.wall(ctx, x, y, w, h, '#6a6258');
    px(ctx, '#1a1612', x + w * 0.15, y + h * 0.3, w * 0.7, h * 0.4);
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.5, w * 0.18, 0, Math.PI * 2); ctx.fill();
    return true;
  },
  inscription(ctx, x, y, w, h, fg) {
    SPRITES.wall(ctx, x, y, w, h, '#7a7268');
    ctx.fillStyle = fg; for (const ay of [0.35, 0.55, 0.75]) ctx.fillRect(x + w * 0.15, y + h * ay, w * 0.7, 1);
    return true;
  },
  banner(ctx, x, y, w, h, fg) {
    SPRITES.wall(ctx, x, y, w, h, '#6a5a48');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(x + w * 0.2, y + h * 0.1); ctx.lineTo(x + w * 0.8, y + h * 0.1); ctx.lineTo(x + w * 0.8, y + h * 0.8); ctx.lineTo(x + w * 0.5, y + h * 0.65); ctx.lineTo(x + w * 0.2, y + h * 0.8); ctx.fill();
    return true;
  },
  column(ctx, x, y, w, h, fg) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + w * 0.2, y + h * 0.88, w * 0.75, h * 0.08);
    px(ctx, shade(fg, 0.1), x + w * 0.1, y + h * 0.08, w * 0.8, h * 0.1);
    px(ctx, fg, x + w * 0.25, y + h * 0.18, w * 0.5, h * 0.66);
    ctx.fillStyle = shade(fg, -0.25); ctx.fillRect(x + w * 0.42, y + h * 0.2, 1, h * 0.62);
    px(ctx, shade(fg, 0.1), x + w * 0.1, y + h * 0.82, w * 0.8, h * 0.1);
    return true;
  },
  altar(ctx, x, y, w, h, fg) {
    px(ctx, '#d8d0c0', x + w * 0.05, y + h * 0.5, w * 0.9, h * 0.4);
    px(ctx, '#a02828', x + w * 0.05, y + h * 0.5, w * 0.9, h * 0.08);
    ctx.fillStyle = fg; ctx.fillRect(x + w * 0.45, y + h * 0.12, w * 0.12, h * 0.36); ctx.fillRect(x + w * 0.3, y + h * 0.22, w * 0.42, h * 0.08);
    return true;
  },
  paganaltar(ctx, x, y, w, h, fg) {
    px(ctx, '#6a6258', x + w * 0.1, y + h * 0.45, w * 0.8, h * 0.45);
    ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * 0.4, w * 0.25, h * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff9040'; ctx.beginPath(); ctx.moveTo(x + w * 0.4, y + h * 0.38); ctx.lineTo(x + w / 2, y + h * 0.08); ctx.lineTo(x + w * 0.6, y + h * 0.38); ctx.fill();
    return true;
  },
  well(ctx, x, y, w, h, fg) {
    ctx.fillStyle = '#8a8478'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * 0.6, w * 0.46, h * 0.26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a3a6a'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * 0.58, w * 0.28, h * 0.15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x + w * 0.1, y + h * 0.12, 1.5, h * 0.4); ctx.fillRect(x + w * 0.85, y + h * 0.12, 1.5, h * 0.4); ctx.fillRect(x + w * 0.1, y + h * 0.12, w * 0.8, 1.5);
    return true;
  },
  font(ctx, x, y, w, h, fg) {
    ctx.fillStyle = '#d8d0c0'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * 0.55, w * 0.46, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a9ad0'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * 0.52, w * 0.3, h * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    return true;
  },
  anvil(ctx, x, y, w, h) {
    px(ctx, '#5a4a3a', x + w * 0.35, y + h * 0.6, w * 0.3, h * 0.3);
    ctx.fillStyle = '#9aa0a8'; ctx.beginPath(); ctx.moveTo(x, y + h * 0.4); ctx.lineTo(x + w, y + h * 0.4); ctx.lineTo(x + w * 0.8, y + h * 0.6); ctx.lineTo(x + w * 0.2, y + h * 0.6); ctx.fill();
    return true;
  },
  table(ctx, x, y, w, h, fg) {
    px(ctx, fg, x + w * 0.05, y + h * 0.4, w * 0.9, h * 0.14);
    px(ctx, shade(fg, -0.3), x + w * 0.12, y + h * 0.54, 1.5, h * 0.36); px(ctx, shade(fg, -0.3), x + w * 0.82, y + h * 0.54, 1.5, h * 0.36);
    return true;
  },
  bench(ctx, x, y, w, h, fg) {
    px(ctx, fg, x, y + h * 0.5, w, h * 0.16); px(ctx, shade(fg, -0.3), x + w * 0.15, y + h * 0.66, 1.5, h * 0.22); px(ctx, shade(fg, -0.3), x + w * 0.8, y + h * 0.66, 1.5, h * 0.22);
    return true;
  },
  bed(ctx, x, y, w, h, fg) {
    px(ctx, '#6a4a2a', x + w * 0.05, y + h * 0.3, w * 0.9, h * 0.55);
    px(ctx, '#c8b898', x + w * 0.1, y + h * 0.35, w * 0.8, h * 0.4);
    px(ctx, fg, x + w * 0.1, y + h * 0.5, w * 0.8, h * 0.25);
    return true;
  },
  shelf(ctx, x, y, w, h, fg) {
    px(ctx, '#5a3e24', x, y + h * 0.1, w, h * 0.85);
    for (const ay of [0.15, 0.45, 0.72]) { px(ctx, '#2a1c10', x + 1, y + h * ay, w - 2, h * 0.2); px(ctx, fg, x + w * 0.2, y + h * (ay + 0.05), w * 0.25, h * 0.14); px(ctx, '#c8a040', x + w * 0.55, y + h * (ay + 0.05), w * 0.2, h * 0.14); }
    return true;
  },
  stairsdown(ctx, x, y, w, h, fg) {
    px(ctx, '#0a0806', x + w * 0.05, y + h * 0.1, w * 0.9, h * 0.8);
    for (let k = 0; k < 4; k++) px(ctx, shade(fg, -0.15 * k), x + w * 0.05, y + h * (0.1 + k * 0.2), w * (0.9 - k * 0.2), h * 0.12);
    return true;
  },
  stairsup(ctx, x, y, w, h, fg) {
    for (let k = 0; k < 4; k++) px(ctx, shade(fg, 0.1 - 0.12 * k), x + w * (0.05 + k * 0.1), y + h * (0.75 - k * 0.2), w * (0.9 - k * 0.2), h * 0.14);
    return true;
  },
  sarcophagus(ctx, x, y, w, h, fg) {
    px(ctx, shade(fg, -0.3), x + w * 0.05, y + h * 0.2, w * 0.9, h * 0.7);
    px(ctx, fg, x + w * 0.1, y + h * 0.15, w * 0.8, h * 0.3);
    return true;
  },
  opened(ctx, x, y, w, h, fg) {
    px(ctx, shade(fg, -0.3), x + w * 0.05, y + h * 0.35, w * 0.9, h * 0.55);
    px(ctx, '#0e0c0a', x + w * 0.15, y + h * 0.42, w * 0.7, h * 0.3);
    return true;
  },
  chest(ctx, x, y, w, h, fg) {
    px(ctx, '#6a4424', x + w * 0.08, y + h * 0.35, w * 0.84, h * 0.5);
    px(ctx, shade('#6a4424', 0.2), x + w * 0.08, y + h * 0.28, w * 0.84, h * 0.14);
    px(ctx, fg, x + w * 0.08, y + h * 0.5, w * 0.84, 1.5); px(ctx, fg, x + w * 0.42, y + h * 0.44, w * 0.16, h * 0.14);
    return true;
  },
  crate(ctx, x, y, w, h, fg) {
    px(ctx, '#8a6a42', x + w * 0.1, y + h * 0.3, w * 0.8, h * 0.6);
    ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 1; ctx.strokeRect(x + w * 0.1 + 0.5, y + h * 0.3 + 0.5, w * 0.8 - 1, h * 0.6 - 1);
    ctx.beginPath(); ctx.moveTo(x + w * 0.1, y + h * 0.3); ctx.lineTo(x + w * 0.9, y + h * 0.9); ctx.stroke();
    return true;
  },
  barrel(ctx, x, y, w, h) {
    ctx.fillStyle = '#7a5430'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * 0.55, w * 0.38, h * 0.36, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2a18'; ctx.fillRect(x + w * 0.14, y + h * 0.38, w * 0.72, 1.2); ctx.fillRect(x + w * 0.14, y + h * 0.7, w * 0.72, 1.2);
    return true;
  },
  urn(ctx, x, y, w, h, fg) {
    ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * 0.6, w * 0.34, h * 0.28, 0, 0, Math.PI * 2); ctx.fill();
    px(ctx, fg, x + w * 0.38, y + h * 0.22, w * 0.24, h * 0.14);
    return true;
  },
  fire(ctx, x, y, w, h) {
    px(ctx, '#4a3020', x + w * 0.1, y + h * 0.78, w * 0.8, h * 0.1);
    ctx.fillStyle = '#e06020'; ctx.beginPath(); ctx.moveTo(x + w * 0.2, y + h * 0.8); ctx.quadraticCurveTo(x + w / 2, y, x + w * 0.8, y + h * 0.8); ctx.fill();
    ctx.fillStyle = '#f8c040'; ctx.beginPath(); ctx.moveTo(x + w * 0.35, y + h * 0.8); ctx.quadraticCurveTo(x + w / 2, y + h * 0.35, x + w * 0.65, y + h * 0.8); ctx.fill();
    return true;
  },
  tent(ctx, x, y, w, h, fg) {
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(x + w / 2, y + h * 0.1); ctx.lineTo(x + w, y + h * 0.9); ctx.lineTo(x, y + h * 0.9); ctx.fill();
    ctx.fillStyle = '#1a140c'; ctx.beginPath(); ctx.moveTo(x + w / 2, y + h * 0.45); ctx.lineTo(x + w * 0.65, y + h * 0.9); ctx.lineTo(x + w * 0.35, y + h * 0.9); ctx.fill();
    return true;
  },
  bones(ctx, x, y, w, h, fg) {
    ctx.strokeStyle = fg; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x + w * 0.15, y + h * 0.7); ctx.lineTo(x + w * 0.85, y + h * 0.5); ctx.moveTo(x + w * 0.3, y + h * 0.45); ctx.lineTo(x + w * 0.6, y + h * 0.8); ctx.stroke();
    return true;
  },
  skulls(ctx, x, y, w, h, fg) {
    ctx.fillStyle = fg;
    for (const [ax, ay] of [[0.3, 0.65], [0.7, 0.62], [0.5, 0.38]]) { ctx.beginPath(); ctx.arc(x + w * ax, y + h * ay, w * 0.18, 0, Math.PI * 2); ctx.fill(); }
    return true;
  },
  rubble(ctx, x, y, w, h, fg, v) {
    ctx.fillStyle = fg;
    for (const [ax, ay, s] of [[0.2, 0.7, 2.5], [0.55 + v * 0.2, 0.5, 2], [0.7, 0.8, 3]]) ctx.fillRect(x + w * ax, y + h * ay, s, s * 0.8);
    return true;
  },
  stones(ctx, x, y, w, h, fg) {
    ctx.fillStyle = fg;
    for (const [ax, ay, r] of [[0.3, 0.7, 0.2], [0.65, 0.68, 0.22], [0.48, 0.45, 0.18]]) { ctx.beginPath(); ctx.ellipse(x + w * ax, y + h * ay, w * r, h * r * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
    return true;
  },
  grave(ctx, x, y, w, h, fg) {
    px(ctx, '#3a2e20', x + w * 0.1, y + h * 0.78, w * 0.8, h * 0.12);
    return SPRITES.cross(ctx, x, y - h * 0.05, w, h * 0.85, fg);
  },
  shrine(ctx, x, y, w, h, fg) {
    SPRITES.grave(ctx, x, y, w, h, '#c8c0b0');
    ctx.fillStyle = '#f8d060'; ctx.beginPath(); ctx.arc(x + w * 0.78, y + h * 0.3, 1.8, 0, Math.PI * 2); ctx.fill();
    return true;
  },
  throne(ctx, x, y, w, h, fg) {
    px(ctx, '#6a4424', x + w * 0.2, y + h * 0.08, w * 0.6, h * 0.82);
    px(ctx, fg, x + w * 0.15, y + h * 0.5, w * 0.7, h * 0.2);
    px(ctx, '#a02828', x + w * 0.28, y + h * 0.15, w * 0.44, h * 0.32);
    return true;
  },
  rack(ctx, x, y, w, h, fg) {
    px(ctx, '#5a3e24', x, y + h * 0.75, w, h * 0.1);
    ctx.strokeStyle = fg; ctx.lineWidth = 1.2;
    for (const ax of [0.25, 0.5, 0.75]) { ctx.beginPath(); ctx.moveTo(x + w * ax, y + h * 0.1); ctx.lineTo(x + w * ax, y + h * 0.8); ctx.stroke(); }
    return true;
  },
  carpet(ctx, x, y, w, h) {
    px(ctx, '#7a2020', x, y, w, h); px(ctx, '#c8a040', x, y + 1, w, 1); px(ctx, '#c8a040', x, y + h - 2, w, 1);
    return true;
  },
  stall(ctx, x, y, w, h, fg) {
    px(ctx, '#6a4a2a', x + w * 0.05, y + h * 0.55, w * 0.9, h * 0.35);
    for (let k = 0; k < 4; k++) px(ctx, k % 2 ? '#e8e0d0' : fg, x + w * k / 4, y + h * 0.15, w / 4, h * 0.25);
    return true;
  },
  hay(ctx, x, y, w, h, fg) {
    ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * 0.65, w * 0.45, h * 0.28, 0, Math.PI, 0); ctx.fill();
    return true;
  },
  trough(ctx, x, y, w, h) {
    px(ctx, '#6a4a2a', x, y + h * 0.45, w, h * 0.35); px(ctx, '#3a6aa0', x + 1, y + h * 0.48, w - 2, h * 0.12);
    return true;
  },
  cart(ctx, x, y, w, h, fg) {
    px(ctx, '#7a5430', x, y + h * 0.35, w, h * 0.3);
    ctx.fillStyle = '#3a2a18'; ctx.beginPath(); ctx.arc(x + w * 0.3, y + h * 0.75, w * 0.18, 0, Math.PI * 2); ctx.arc(x + w * 0.75, y + h * 0.75, w * 0.18, 0, Math.PI * 2); ctx.fill();
    return true;
  },
  vine(ctx, x, y, w, h, fg) {
    px(ctx, '#5a3e24', x + w * 0.48, y + h * 0.1, 1.2, h * 0.85);
    ctx.fillStyle = fg; for (const ay of [0.25, 0.5, 0.75]) { ctx.beginPath(); ctx.arc(x + w * 0.5, y + h * ay, w * 0.28, 0, Math.PI * 2); ctx.fill(); }
    return true;
  },
  grapes(ctx, x, y, w, h, fg) {
    SPRITES.vine(ctx, x, y, w, h, '#4a8a3a');
    ctx.fillStyle = fg; for (const [ax, ay] of [[0.4, 0.55], [0.6, 0.55], [0.5, 0.7]]) { ctx.beginPath(); ctx.arc(x + w * ax, y + h * ay, 1.6, 0, Math.PI * 2); ctx.fill(); }
    return true;
  },
  deadwood(ctx, x, y, w, h, fg) {
    ctx.strokeStyle = fg; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x + w / 2, y + h * 0.9); ctx.lineTo(x + w / 2, y + h * 0.25); ctx.moveTo(x + w / 2, y + h * 0.5); ctx.lineTo(x + w * 0.15, y + h * 0.25); ctx.moveTo(x + w / 2, y + h * 0.4); ctx.lineTo(x + w * 0.85, y + h * 0.15); ctx.stroke();
    return true;
  },
  timber(ctx, x, y, w, h, fg) {
    px(ctx, fg, x + w * 0.1, y, w * 0.18, h); px(ctx, fg, x + w * 0.72, y, w * 0.18, h); px(ctx, shade(fg, 0.15), x, y + h * 0.1, w, h * 0.16);
    return true;
  },
  ship(ctx, x, y, w, h, fg) {
    ctx.fillStyle = '#6a4424'; ctx.beginPath(); ctx.moveTo(x, y + h * 0.6); ctx.lineTo(x + w, y + h * 0.6); ctx.lineTo(x + w * 0.8, y + h * 0.85); ctx.lineTo(x + w * 0.2, y + h * 0.85); ctx.fill();
    px(ctx, '#3a2a18', x + w * 0.48, y + h * 0.1, 1.2, h * 0.5);
    ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.moveTo(x + w * 0.52, y + h * 0.12); ctx.lineTo(x + w * 0.9, y + h * 0.5); ctx.lineTo(x + w * 0.52, y + h * 0.5); ctx.fill();
    return true;
  },
  bough(ctx, x, y, w, h, fg) {
    SPRITES.tree(ctx, x, y, w, h, '#4c8c3a');
    ctx.fillStyle = '#f8d048'; ctx.beginPath(); ctx.arc(x + w * 0.62, y + h * 0.3, w * 0.16, 0, Math.PI * 2); ctx.fill();
    return true;
  },
  torchbearer(ctx, x, y, w, h, fg, v, up) {
    SPRITES.person(ctx, x, y, w, h, '#a89878');
    ctx.fillStyle = '#f8a040'; ctx.beginPath(); ctx.arc(x + w * 0.85, y + h * (up ? 0.12 : 0.85), 2, 0, Math.PI * 2); ctx.fill();
    return true;
  },
  walltower(ctx, x, y, w, h, fg) {
    SPRITES.wall(ctx, x, y, w, h, fg);
    ctx.fillStyle = shade(fg, 0.25);
    for (const ax of [0.05, 0.4, 0.75]) ctx.fillRect(x + w * ax, y, w * 0.2, h * 0.18);
    return true;
  },
  inn(ctx, x, y, w, h, fg) {
    SPRITES.house(ctx, x, y + h * 0.05, w, h * 0.95, '#a0603c');
    ctx.fillStyle = '#5a3e24'; ctx.fillRect(x + w * 0.85, y + h * 0.35, 1, h * 0.3);
    ctx.fillStyle = fg; ctx.fillRect(x + w * 0.62, y + h * 0.4, w * 0.3, h * 0.14);
    return true;
  },
  mihrab(ctx, x, y, w, h, fg) {
    SPRITES.wall(ctx, x, y, w, h, '#b8a888');
    ctx.fillStyle = '#2a4a6a'; ctx.beginPath(); ctx.moveTo(x + w * 0.2, y + h); ctx.lineTo(x + w * 0.2, y + h * 0.4); ctx.quadraticCurveTo(x + w / 2, y, x + w * 0.8, y + h * 0.4); ctx.lineTo(x + w * 0.8, y + h); ctx.fill();
    return true;
  },
});

// Таблица строится при первом обращении: клетки (T) объявлены в world.js, он грузится позже.
let TILE_SPRITE = null;
function tileSprite(id) { if (!TILE_SPRITE) buildTileSprites(); return TILE_SPRITE[id]; }
function buildTileSprites() {
  TILE_SPRITE = {};
  const m = {
    grass: ['GRASS', 'COURTYARD'], crops: ['TALLGRASS', 'FIELD'], tree: ['FOREST', 'WALNUT'], pine: ['PINE'], hill: ['HILL'],
    mountain: ['MOUNTAIN'], rock: ['ROCK', 'CAVEWALL', 'ORE_DUG'], water: ['WATER', 'SEA', 'CANAL', 'FORD', 'LAVA'], road: ['ROAD'],
    bridge: ['BRIDGE', 'PIER'], wall: ['WALL', 'STONEWALL', 'TOMBWALL', 'YARDWALL', 'CRYPTWALL'], door: ['DOOR', 'HOUSEDOOR'],
    cobble: ['COBBLE'], planks: ['FLOOR'], stonefloor: ['TOMBFLOOR', 'CAVEFLOOR', 'CRYPTFLOOR'], dirt: ['DIRT', 'SAND', 'ASH', 'STUBBLE'],
    ore: ['ORE'], marble: ['MARBLE'], fresco: ['FRESCO'], bars: ['LOCKED'], niche: ['NICHE'], inscription: ['INSCRIPTION'], banner: ['BANNER'],
    column: ['COLUMN'], altar: ['ALTAR'], paganaltar: ['PAGAN_ALTAR'], well: ['WELL'], font: ['FONT'], anvil: ['ANVIL'], table: ['TABLE'],
    bench: ['BENCH'], bed: ['BED'], shelf: ['SHELF'], stairsdown: ['STAIRS_DOWN'], stairsup: ['STAIRS_UP'], sarcophagus: ['SARCOPHAGUS'],
    opened: ['SARC_OPEN', 'CHEST_OPEN', 'CRATE_OPEN', 'URN_OPEN'], chest: ['CHEST', 'COFFER'], crate: ['CRATE'], barrel: ['BARREL'], urn: ['URN'],
    fire: ['CAMPFIRE', 'HEARTH'], tent: ['TENT'], bones: ['BONES'], skulls: ['BONEPILE'], rubble: ['RUBBLE', 'DEBRIS'], stones: ['STONES'],
    grave: ['GRAVE'], shrine: ['SHRINE'], throne: ['THRONE'], rack: ['RACK'], carpet: ['CARPET'], stall: ['STALL'], hay: ['HAY'],
    trough: ['TROUGH'], cart: ['CART', 'WAGON'], vine: ['VINEYARD'], grapes: ['GRAPES'], deadwood: ['DEADWOOD'], timber: ['TIMBER'],
    ship: ['SHIP'], bough: ['BOUGH'], walltower: ['WALLTOWER'], herb: ['HERB'], mihrab: ['MIHRAB'], tree2: [],
  };
  for (const [name, list] of Object.entries(m)) for (const k of list) if (T[k] !== undefined) TILE_SPRITE[T[k]] = name;
  TILE_SPRITE[T.CAUTES] = 'cautes'; TILE_SPRITE[T.CAUTOPATES] = 'cautopates';
  TILE_SPRITE[T.CROP] = 'crops'; TILE_SPRITE[T.MARSH] = 'grass'; TILE_SPRITE[T.GARDEN] = 'crops';
}

// Особые: факелоносцы Митры.
function drawTileSprite(ctx, name, fg, x, y, w, h, cell) {
  if (name === 'cautes' || name === 'cautopates') return SPRITES.torchbearer(ctx, x, y, w, h, fg, 0, name === 'cautes');
  const f = SPRITES[name];
  return f ? f(ctx, x, y, w, h, fg, hash2(cell, 7)) : false;
}
