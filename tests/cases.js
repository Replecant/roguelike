// Тесты игры. run выполняется внутри страницы (там доступны TH и assert);
// node — на стороне Node, когда нужно перезагрузить страницу.
/* global TH, assert, G */

module.exports = [
  {
    name: 'Старт за каждый народ',
    run() {
      for (let i = 0; i < PEOPLES.length; i++) {
        const p = TH.start(i);
        assert(G.mode === 'local' && G.world.kind === 'city', `${PEOPLES[i].name}: не в городе`);
        assert(G.world.villages[0].city.id === PEOPLES[i].start, `${PEOPLES[i].name}: не тот город`);
        assert(p.hp === p.maxHp && p.stats.dex > 0, 'характеристики');
        render();
      }
      return `${PEOPLES.length} народов`;
    },
  },

  {
    name: 'Все поселения: жители на месте, входы не загорожены, зверей нет',
    run() {
      TH.start();
      let n = 0, housesN = 0, doorless = 0;
      for (const c of G.over.cities) {
        TH.go(c);
        const w = G.world;
        assert(w.villages[0].npcs.length > 0, `${c.name}: никого нет`);
        const names = w.villages[0].npcs.map(n => n.name);
        assert(new Set(names).size === names.length, `${c.name}: тёзки среди жителей`);
        // Никаких домов-полосок шириной в одну клетку.
        const H = new Set([T.HOUSE, T.HOUSE2, T.HOUSE3, T.HOUSEDOOR, T.TOWER, T.COURTYARD]);
        const house = (x, y) => H.has(w.get(x, y)) && w.building[w.idx(x, y)] === -1;
        for (let y = 1; y < w.h - 1; y++)
          for (let x = 1; x < w.w - 1; x++)
            if (house(x, y)) assert((house(x - 1, y) || house(x + 1, y)) && (house(x, y - 1) || house(x, y + 1)), `${c.name}: дом-полоска у ${x},${y}`);
        // У каждого дома (участка одной крыши) есть дверь; редкие глухие дома посреди квартала — допустимо.
        const roofs = [T.HOUSE, T.HOUSE2, T.HOUSE3], seenH = new Uint8Array(w.w * w.h);
        for (let i = 0; i < w.w * w.h; i++) {
          if (!roofs.includes(w.tiles[i]) || seenH[i] || w.building[i] !== -1) continue;
          const st = [i], roof = w.tiles[i];
          let door = false, street = false;
          seenH[i] = 1;
          while (st.length) {
            const j = st.pop(), x = j % w.w, y = (j / w.w) | 0;
            for (const [dx, dy] of DIRS4) {
              if (!w.inside(x + dx, y + dy)) continue;
              const k = w.idx(x + dx, y + dy);
              if (w.tiles[k] === T.HOUSEDOOR) door = true;
              if (TILES[w.tiles[k]].walk) street = true;
              if (w.tiles[k] === roof && !seenH[k] && w.building[k] === -1) { seenH[k] = 1; st.push(k); }
            }
          }
          housesN++;
          if (!door) { doorless++; assert(!street, `${c.name}: дом без двери на улицу у ${i % w.w},${(i / w.w) | 0}`); }
        }
        for (let i = 0; i < 30; i++) endTurn();
        assert(!w.actors.some(a => a.kind === 'beast'), `${c.name}: звери в поселении`);
        for (const b of w.buildings) {
          const own = b.owner;
          if (!own) continue;
          // Без диагоналей выйти из дома хозяина наружу.
          const seen = new Set([own.home && `${own.x},${own.y}`]), q = [[own.x, own.y]];
          let out = false;
          while (q.length && !out) {
            const [x, y] = q.shift();
            for (const [dx, dy] of DIRS4) {
              const X = x + dx, Y = y + dy, k = `${X},${Y}`;
              if (seen.has(k) || !w.walkable(X, Y)) continue;
              seen.add(k);
              if (w.building[w.idx(X, Y)] !== b.id) { out = true; break; }
              q.push([X, Y]);
            }
          }
          assert(out, `${c.name}: из «${b.name}» не выйти`);
        }
        n++;
      }
      assert(doorless < housesN * 0.03, `глухих домов ${doorless} из ${housesN}`);
      return `${n} поселений, домов ${housesN} (глухих ${doorless})`;
    },
  },

  {
    name: 'У ворот не нападают',
    run() {
      TH.start();
      leaveLocal();
      const c = TH.city('parma') || G.over.cities[0];
      for (let i = 0; i < 200; i++) {
        G.ox = c.x + 1; G.oy = c.y; G.encCooldown = 0;
        assert(!rollEncounter(1, false), 'встреча у самых ворот');
      }
      return 'ok';
    },
  },

  {
    name: 'Задание на доставку: взять и сдать',
    run() {
      const p = TH.start();
      for (const c of G.over.cities.filter(c => c.kind === 'city')) {
        TH.go(c);
        for (const role of ['merchant', 'innkeeper', 'elder', 'priest']) {
          const npc = TH.npc(role);
          if (!npc) continue;
          npc.noWorkUntil = 0;
          for (let k = 0; k < 6 && !(npc.offer && npc.offer.type === 'deliver'); k++) { npc.offer = null; npc.offer = askForWork(npc); }
          if (!npc.offer || npc.offer.type !== 'deliver') continue;
          TH.ask(npc, npc.offer.accept);
          const q = p.quests.find(q => q.type === 'deliver');
          assert(q, 'доставка не взята');
          const coins = p.coins;
          TH.go(G.over.cities.find(x => x.id === q.to));
          const rcv = G.world.villages[0].npcs.find(n => n.role === q.toRole);
          assert(rcv, 'нет получателя');
          TH.ask(rcv, 'Передать');
          assert(!p.quests.includes(q) && p.coins > coins, 'не сдано');
          return `${q.item} → ${q.toName}`;
        }
      }
      throw new Error('ни одного предложения доставки');
    },
  },

  {
    name: 'Торговля: купить и продать',
    run() {
      const p = TH.start();
      p.coins = 500;
      const m = TH.npc('merchant');
      const ts = new TradeScreen(m);
      const row = ts.rows(0).find(r => r.id === 'grain' || r.id);
      row.buy(3);
      assert(p.goods[row.id] === 3, 'не куплено');
      const sell = ts.rows(1).find(r => r.id === row.id);
      sell.sell(3);
      assert(!p.goods[row.id], 'не продано');
      return `${GOODS[row.id].name}, монет ${p.coins}`;
    },
  },

  {
    name: 'Подземелья: все типы спрятаны, связны, до дна с боссом и добычей',
    run() {
      const p = TH.start();
      TH.immortal();
      const tombs = G.over.sites.filter(s => s.dungeon);
      assert(tombs.length >= 18 && tombs.every(s => s.hidden && !G.over.placeAt(s.x, s.y)), 'подземелья не спрятаны');
      const types = new Set(tombs.map(s => s.type));
      assert(Object.keys(DUNGEON_TYPES).filter(t => DUNGEON_TYPES[t].count !== 0).every(t => types.has(t)), 'не все типы на карте: ' + [...types]);
      assert(tombs.filter(s => s.quest).every(s => s.hidden) && hiddenTombs().every(s => !s.quest), 'особые места не по квесту');
      const seen = [];
      for (const type of Object.keys(DUNGEON_TYPES).filter(t => !DUNGEON_TYPES[t].special)) {
        const t = tombs.find(s => s.type === type);
        if (G.mode === 'local') leaveLocal();
        G.ox = t.x; G.oy = t.y;
        for (let i = 0; i < 40 && t.hidden; i++) spotTombs(t.x, t.y, true);
        assert(!t.hidden && G.over.placeAt(t.x, t.y) === t, `${type}: вход не нашёлся`);
        overEnter();
        assert(G.world.kind === 'dungeon' && G.world.site === t, `${type}: не в подземелье`);
        for (let i = 0; i < 8 && G.world.down; i++) {
          const w = G.world, [dx, dy] = w.down;
          const spot = DIRS8.map(([a, b]) => [dx + a, dy + b]).find(([x, y]) => w.walkable(x, y) && w.get(x, y) !== T.STAIRS_UP);
          const blocker = w.actorAt(spot[0], spot[1]);
          if (blocker && blocker !== p) killBeast(blocker, false);
          const onStairs = w.actorAt(dx, dy);
          if (onStairs && onStairs !== p) { onStairs.x = -1; w.actors = w.actors.filter(x => x !== onStairs); }
          moveTo(p, spot[0], spot[1]);
          tryMove(dx - p.x, dy - p.y);
        }
        const w = G.world;
        const boss = w.actors.find(a => a.bossOf === t.id);
        assert(!w.down && boss && boss.key === DUNGEON_TYPES[type].boss, `${type}: нет дна или хозяина`);
        // Хозяин побеждён — больше не появится; тайники и гробница на дне открываются.
        killBeast(boss, true);
        assert(G.flags[`${t.id}_boss`], `${type}: победа не запомнилась`);
        const c0 = p.coins, bag0 = p.bag.length, tr0 = Object.values(p.trophies).reduce((a, b) => a + b.count, 0);
        if (w.containers) for (const i of [...w.containers.keys()]) openContainer(i % w.w, (i / w.w) | 0);
        if (w.richSarcophagus >= 0) openSarcophagus(w.richSarcophagus % w.w, (w.richSarcophagus / w.w) | 0);
        if (w.richVein) for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === T.ORE) { mineOre(i % w.w, (i / w.w) | 0); break; }
        const tr1 = Object.values(p.trophies).reduce((a, b) => a + b.count, 0);
        assert(p.coins > c0 || p.bag.length > bag0 || tr1 > tr0, `${type}: на дне пусто`);
        seen.push(`${type} ${t.depth}`);
      }
      // Могила мученика в катакомбах: благочестие, а не грех.
      const cat = tombs.find(s => s.type === 'catacomb');
      const lvl = makeTombLevel(cat, 0);
      let shrine = -1;
      for (let i = 0; i < lvl.tiles.length && shrine < 0; i++) if (lvl.tiles[i] === T.SHRINE) shrine = i;
      if (shrine >= 0) {
        const pi = p.piety; G.world = lvl;
        venerateShrine(shrine % lvl.w, (shrine / lvl.w) | 0);
        assert(p.piety > pi, 'молитва у мученика не дала благочестия');
      }
      return seen.join(', ');
    },
  },

  {
    name: 'Секреты подземелий: ловушки, тайные ходы, сокровищница с ключом, надписи',
    run() {
      const p = TH.start();
      TH.immortal();
      const tombs = G.over.sites.filter(s => s.dungeon && !DUNGEON_TYPES[s.type].special);
      let traps = 0, secrets = 0, vaults = 0, notes = 0;
      for (const type of Object.keys(DUNGEON_TYPES).filter(t => !DUNGEON_TYPES[t].special)) {
        const site = tombs.find(s => s.type === type);
        const w = makeTombLevel(site, Math.min(1, site.depth - 1));
        w.placeKey = 'test:' + type;
        traps += w.traps.size; secrets += w.secrets.size; notes += w.inscriptions.size;
        assert(w.traps.size >= 3, `${type}: мало ловушек`);
        // Всё достижимо, если открыть тайные ходы и решётку; лестницы — и без них.
        const reach = open => {
          const seen = new Uint8Array(w.w * w.h), q = [w.idx(w.up[0], w.up[1])];
          seen[q[0]] = 1;
          while (q.length) {
            const i = q.pop(), x = i % w.w, y = (i / w.w) | 0;
            for (const [dx, dy] of DIRS4) {
              const j = w.idx(x + dx, y + dy);
              if (seen[j] || x + dx < 0 || y + dy < 0 || x + dx >= w.w || y + dy >= w.h) continue;
              if (TILES[w.tiles[j]].walk || (open && (w.secrets.has(j) || w.tiles[j] === T.LOCKED))) { seen[j] = 1; q.push(j); }
            }
          }
          return seen;
        };
        const closed = reach(false), all = reach(true);
        if (w.down) assert(closed[w.idx(w.down[0], w.down[1])], `${type}: лестница вниз отрезана`);
        for (const [i, kind] of w.containers || []) {
          const x = i % w.w, y = (i / w.w) | 0;
          assert(DIRS8.some(([dx, dy]) => all[w.idx(x + dx, y + dy)]), `${type}: недоступный тайник ${kind}`);
        }
        for (const [k, list] of w.items) if (list.some(it => it.kind === 'key')) assert(closed[w.idx(...k.split(',').map(Number))], `${type}: ключ за решёткой`);
        // Играем: тайная дверь находится обыском.
        G.world = w; G.mode = 'local';
        if (w.secrets.size) {
          const i = [...w.secrets][0], sx = i % w.w, sy = (i / w.w) | 0;
          const [fx, fy] = DIRS4.map(([dx, dy]) => [sx + dx, sy + dy]).find(([x, y]) => closed[w.idx(x, y)]);
          moveTo(p, fx, fy);
          for (let n = 0; n < 60 && w.secrets.has(i); n++) senseSecrets(true);
          assert(w.get(sx, sy) === T.DOOR, `${type}: тайный ход не нашёлся`);
        }
        // Ключ открывает решётку.
        if (w.vaultDoor >= 0 && w.tiles[w.vaultDoor] === T.LOCKED) {
          vaults++;
          const [k] = [...w.items].find(([, list]) => list.some(it => it.kind === 'key'));
          const [kx, ky] = k.split(',').map(Number);
          for (const it of w.takeItems(kx, ky)) if (it.kind === 'key') pickKey(it);
          const vx = w.vaultDoor % w.w, vy = (w.vaultDoor / w.w) | 0;
          const [fx, fy] = DIRS4.map(([dx, dy]) => [vx + dx, vy + dy]).find(([x, y]) => closed[w.idx(x, y)]);
          for (const a of [...w.actors]) if (a !== p) w.actors = w.actors.filter(b => b !== a);
          moveTo(p, fx, fy);
          tryMove(vx - fx, vy - fy);
          assert(w.get(vx, vy) === T.DOOR && !p.keys.length, `${type}: ключ не подошёл`);
        }
      }
      assert(secrets > 0 && vaults > 0 && notes > 0, `секретов ${secrets}, сокровищниц ${vaults}, надписей ${notes}`);
      // Ловушка срабатывает и становится видна; замеченную можно обезвредить.
      const w = G.world;
      w.actors = w.actors.filter(a => a === p);
      const [ti] = [...w.traps.keys()];
      const tx = ti % w.w, ty = (ti / w.w) | 0;
      moveTo(p, tx, ty);
      springTrap(tx, ty);
      assert(!w.traps.has(ti) || w.traps.get(ti).found, 'ловушка не замечена после срабатывания');
      w.traps.set(ti, { kind: 'dart', found: true });
      const [nx, ny] = DIRS8.map(([dx, dy]) => [tx + dx, ty + dy]).find(([x, y]) => w.walkable(x, y) && !w.actorAt(x, y));
      moveTo(p, nx, ny);
      p.base.dex = 30; p.confused = 0;
      tryMove(tx - nx, ty - ny);
      assert(!w.traps.has(ti), 'ловушку не обезвредить');
      return `ловушек ${traps}, тайных ходов ${secrets}, сокровищниц ${vaults}, надписей ${notes}`;
    },
  },

  {
    name: 'Снаряжение: двуручное освобождает левую руку',
    run() {
      const p = TH.start();
      const sh = makeItem('shield'), ax = makeItem('greataxe');
      p.bag.push(sh, ax);
      equip(p, sh);
      equip(p, ax);
      assert(p.equip.right === ax && !p.equip.left && p.bag.includes(sh), 'щит не снят');
      return 'ok';
    },
  },

  {
    name: 'Слухи: все события на карте проходимы и завершаются',
    run() {
      const p = TH.start();
      TH.immortal();
      leaveLocal();
      for (const kind of Object.keys(LEAD_KINDS)) {
        if (G.mode === 'local') leaveLocal();
        let lead = G.leads.find(l => l.kind === kind && !l.done && l.until >= timeInfo().day);
        for (let i = 0; i < 60 && !lead; i++) { const l = spawnLead(); if (l && l.kind === kind) lead = l; }
        if (!lead && !LEAD_KINDS[kind].w) lead = createLead(kind, findLeadSpot(kind));   // только по заданию
        assert(lead, `${kind}: не создано`);
        lead.known = true; G.ox = lead.x; G.oy = lead.y;
        overEnter();
        const w = G.world;
        assert(w.lead === lead, `${kind}: не вошли`);
        for (const m of w.actors.filter(a => a.leadId === lead.id)) killBeast(m, true);
        if (w.containers) for (const i of [...w.containers.keys()]) openContainer(i % w.w, Math.floor(i / w.w));
        if (kind === 'hermit') TH.ask(w.actors.find(a => a.role === 'hermit'), 'Благослови');
        if (LEAD_KINDS[kind].night && !lead.done) {
          G.minutes += ((23 * 60 - timeInfo().hour * 60) + 1440) % 1440;
          checkDayNight();
          const guests = w.actors.filter(a => a.leadId === lead.id);
          assert(guests.length, `${kind}: ночью никто не пришёл`);
          for (const m of guests) killBeast(m, true);
          if (w.containers) for (const i of [...w.containers.keys()]) openContainer(i % w.w, (i / w.w) | 0);
        }
        assert(lead.done, `${kind}: не завершено`);
      }
      leaveLocal();
      // На место можно наткнуться самому, ничего о нём не слышав.
      const fresh = spawnLead() || spawnLead();
      fresh.known = false;
      for (let i = 0; i < 40 && !fresh.known; i++) spotLeads(fresh.x, fresh.y, true);
      assert(fresh.known && p.rumors.some(r => r.lead === fresh.id && r.source === 'видел своими глазами'), 'на место нельзя наткнуться');
      passTime(20 * 1440);
      assert(G.leads.every(l => l.until >= timeInfo().day), 'старые события не исчезли');
      return `${Object.keys(LEAD_KINDS).length} видов`;
    },
  },

  {
    name: 'Слухи попадают в журнал',
    run() {
      const p = TH.start();
      leaveLocal(); passTime(4 * 1440);
      for (const c of G.over.cities.filter(c => c.kind !== 'inn').slice(0, 20)) {
        TH.go(c);
        for (const n of G.world.villages[0].npcs) TH.ask(n, 'Что нового');
      }
      assert(p.rumors.length > 5, 'слухов мало');
      assert(p.rumors.some(r => r.kind === 'lead') && G.leads.some(l => l.known), 'нет наводок');
      // Слух о гробнице открывает её на карте.
      for (const c of G.over.cities.filter(c => c.kind === 'village' || c.kind === 'inn')) {
        if (p.rumors.some(r => r.kind === 'tomb')) break;
        TH.go(c);
        for (const n of G.world.villages[0].npcs) for (let k = 0; k < 3; k++) TH.ask(n, 'Что нового');
      }
      const tr = p.rumors.find(r => r.kind === 'tomb');
      assert(tr && !G.over.sites.find(s => s.id === tr.tomb).hidden, 'слух о гробнице не открыл её');
      return `${p.rumors.length} слухов`;
    },
  },

  {
    name: 'Вера: лепта, паломничество, милость, чудо, запрет',
    run() {
      const p = TH.start();
      p.coins = 100;
      const pr = TH.npc('priest');
      const before = p.piety;
      TH.ask(pr, 'Пожертвовать четверть');
      assert(p.piety > before && p.coins === 75, 'лепта');
      TH.ask(pr, 'Пожертвовать половину');
      assert(p.coins === 75, 'второй раз за неделю взяли деньги');
      for (const [id, s] of Object.entries(SAINTS)) assert(G.over.cities.some(c => s.shrine(c)), `${id}: нет святилища`);
      // Христофора избирают у капеллана придорожной часовни, а не у трактирщика.
      TH.go(G.over.cities.find(c => c.kind === 'inn'));
      assert(TH.npc('priest') && TH.options(TH.npc('priest')).some(o => o.includes('Христофор')), 'нет капеллана с Христофором');
      assert(!TH.options(TH.npc('innkeeper')).some(o => o.includes('покровител')), 'трактирщик предлагает святого');
      TH.go(TH.city('genoa'));
      TH.go(TH.city('bari'));
      const bp = G.world.villages[0].npcs.find(n => n.role === 'priest' && TH.options(n).some(o => o.includes('Николай')));
      p.piety = 20;
      TH.ask(bp, 'Поклониться');
      TH.ask(bp, 'Избрать');
      assert(p.patron === 'nicholas', 'покровитель не избран');
      p.grace = 30; castMiracle();
      assert(p.favor === 0, 'чудо без милости');
      for (let i = 0; i < 4; i++) faithDeed('quest', { q: { type: 'deliver' }, place: TH.city('bari') });
      p.hp = 1; castMiracle();
      assert(p.favor < 10, 'милость не потрачена');
      p.patron = 'francis'; p.favor = 5;
      faithDeed('kill', { def: BEASTS[Object.keys(BEASTS).find(k => BEASTS[k].behavior === 'flee' && !BEASTS[k].unholy)] });
      assert(p.favor === 0, 'Франциск простил убийство');
      assert(PRAYERS.filter(x => x.order).length === 4, 'орденские молитвы');
      return `благочестие ${p.piety}`;
    },
  },

  {
    name: 'Дальнее оружие: лук, арбалет, метание, подбор',
    run() {
      const p = TH.start();
      p.base.dex = 14;
      TH.wild();
      p.equip.left = null;
      p.equip.right = makeItem('shortbow');
      p.ammo.arrow = 5;
      const wolf = TH.spawn('wolf', 4);
      assert(rangedTargets(rangedMode(p)).includes(wolf), 'волк не в цели');
      for (let i = 0; i < 5 && !wolf.dead; i++) { wolf.x = p.x + 4; wolf.y = p.y; shoot(rangedMode(p), wolf); }
      assert(p.ammo.arrow < 5, 'стрелы не тратятся');
      // Арбалет: после выстрела не взведён.
      p.equip.right = makeItem('crossbow'); p.ammo.bolt = 3; p.loaded = true;
      const boar = TH.spawn('wolf', 4);
      boar.hp = 999;
      shoot(rangedMode(p), boar);
      assert(!p.loaded, 'арбалет не разряжен');
      fire();
      assert(p.loaded, 'арбалет не взводится');
      // Метание без стрелкового оружия.
      p.equip.right = makeItem('club'); p.ammo.javelin = 3;
      assert(rangedMode(p).ammo === 'javelin', 'не метаем дротик');
      boar.x = p.x + 3; boar.y = p.y;
      shoot(rangedMode(p), boar);
      assert(p.ammo.javelin === 2, 'дротик не потрачен');
      // Подобрать упавшее.
      G.world.addItem(p.x + 1, p.y, { kind: 'ammo', ammo: 'arrow', n: 1, name: 'Стрелы' });
      const a0 = p.ammo.arrow;
      for (const m of G.world.actors.filter(a => a.kind === 'beast')) killBeast(m, false);
      tryMove(1, 0);
      assert(p.ammo.arrow === a0 + 1, 'стрела не подобрана');
      // Праща у каждого с самого начала.
      assert(TH.start().bag.some(it => it.key === 'sling'), 'нет пращи');
      return 'ok';
    },
  },

  {
    name: 'Лошадь и мул: покупка, скорость, груз, корм',
    run() {
      const p = TH.start();
      p.coins = 1000;
      const inn = TH.npc('innkeeper');
      const cap0 = p.capacity;
      TH.ask(inn, 'Купить: мул');
      assert(p.mount && p.mount.kind === 'mule' && p.capacity === cap0 + 30, 'мул');
      TH.ask(inn, 'Купить: верховая');
      assert(p.mount.kind === 'horse', 'лошадь');
      leaveLocal();
      const ow = G.over;
      // На дороге лошадь вдвое быстрее пешего.
      let road = null;
      for (let i = 0; i < ow.w * ow.h && !road; i++) if (ow.road[i] >= 0 && !ow.placeAt(i % ow.w, (i / ow.w) | 0)) road = [i % ow.w, (i / ow.w) | 0];
      assert(mountSpeed(p, ow, road[0], road[1]) < 0.6, 'лошадь не быстрее');
      // Без зерна голодает, с зерном — нет.
      p.goods.grain = 0; p.mount.ration = 0; p.mount.stabled = -9;
      mountDaily(100);
      assert(p.mount.hungry === 1, 'не голодает');
      p.goods.grain = 2;
      mountDaily(101);
      assert(p.mount.hungry === 0 && p.goods.grain === 1, 'не ест зерно');
      for (let d = 0; d < 9; d++) { p.goods.grain = 0; p.mount && (p.mount.ration = 0); mountDaily(200 + d); }
      assert(!p.mount, 'изголодавшаяся лошадь не пала');
      return 'ok';
    },
  },

  {
    name: 'Календарь, времена года и погода',
    run() {
      const p = TH.start();
      const d1 = dateOfDay(1);
      assert(d1.y === 1247 && d1.m === 7 && d1.d === 1, 'начало пути не 1 июля 1247');
      const e = easter(1247), ed = jdnToJulian(julianToJdn(1247, e.m, e.d));
      assert(ed.m === 3 && ed.d === 31, 'Пасха 1247 — 31 марта');
      assert(dateOfDay(julianToJdn(1247, 3, 31) - CAL_JDN0 + 1).wd === 0, 'Пасха не в воскресенье');
      assert(seasonOf(d1) === 'summer', 'июнь не лето');
      const dec = dateOfDay(julianToJdn(1247, 12, 21) - CAL_JDN0 + 1);
      const jun = sunTimes(d1), win = sunTimes(dec);
      assert(jun.set - jun.rise > win.set - win.rise + 4, 'зимний день не короче');
      // Переходим в январь 1248.
      leaveLocal();
      G.minutes += (julianToJdn(1248, 1, 10) - CAL_JDN0) * 1440;
      assert(seasonOf() === 'winter' && today().y === 1248, 'не зима');
      assert(!beastChoices('lombardy', 'field', false, false).some(o => o.key === 'viper'), 'гадюки зимой');
      // Альпийский перевал вне дороги закрыт.
      const ow = G.over;
      let pass = null;
      for (let i = 0; i < ow.w * ow.h && !pass; i++) {
        const x = i % ow.w, y = (i / ow.w) | 0;
        if (ow.regionAt(x, y) === 'alps' && ow.get(x, y) === OT.MOUNT && ow.road[i] < 0) pass = [x, y];
      }
      assert(pass && winterBlocked(ow, pass[0], pass[1]), 'перевал не закрыт');
      // Жатвы зимой не бывает.
      const v = G.over.cities.find(c => c.kind === 'village');
      TH.go(v);
      const el = TH.npc('elder');
      for (let i = 0; i < 20; i++) { el.noWorkUntil = 0; const o = offerWork(el); assert(!o || o.work !== 'harvest', 'жатва зимой'); }
      // Погода: туман сужает обзор.
      G.weather = { kind: 'clear', until: G.minutes + 600 };
      const r0 = sightRadius();
      G.weather = { kind: 'fog', until: G.minutes + 600 };
      assert(sightRadius() < r0, 'туман не сужает обзор');
      G.weather.until = G.minutes;
      leaveLocal(); passTime(3 * 1440);
      assert(G.weather && WEATHER[G.weather.kind], 'погода не меняется');
      // Вкладка календаря рисуется.
      pushScreen(new JournalScreen()); topScreen().tab = 2; render(); popScreen();
      return `${dateText(today())}, ${WEATHER[G.weather.kind].name}`;
    },
  },

  {
    name: 'Интерфейс: панель, кнопки, клики мышью',
    async node(page, startPage) {
      await startPage(page);
      const toScreen = ([wx, wy]) => page.evaluate(([wx, wy]) => {
        const r = G.term.canvas.getBoundingClientRect(), ps = G.screens[0];
        const [cx, cy] = G.mode === 'local' ? ps.camera(G.world.w, G.world.h, G.player.x, G.player.y) : ps.camera(G.over.w, G.over.h, G.ox, G.oy);
        return [r.left + (wx - cx + 0.5) * G.term.cw, r.top + (wy - cy + 0.5) * G.term.ch];
      }, [wx, wy]);
      const visible = await page.evaluate(() => !document.getElementById('hud-panel').hidden && document.querySelectorAll('#hud-actions button').length);
      if (visible !== 13) throw new Error('нет панели или кнопок');
      // Клик по жителю — подойти и заговорить.
      const npc = await page.evaluate(() => { const w = G.world, p = G.player;
        const n = w.actors.filter(a => a.kind === 'npc' && w.isVisible(a.x, a.y) && dist(a, p) > 2).sort((a, b) => dist(a, p) - dist(b, p))[0];
        return [n.x, n.y]; });
      const [nx, ny] = await toScreen(npc);
      await page.mouse.click(nx, ny);
      await page.waitForFunction(() => topScreen() instanceof DialogScreen, null, { timeout: 8000 });
      // Окно не пересоздаётся при стрелках (иначе мигает).
      const winBefore = await page.evaluate(() => { window.__win = document.querySelector('#win .window'); return !!window.__win; });
      await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
      if (!winBefore || !(await page.evaluate(() => document.querySelector('#win .window') === window.__win && document.querySelector('#win .opt.sel').dataset.i === '2')))
        throw new Error('окно диалога пересоздаётся при нажатии стрелок');
      // Ответ кликом по варианту.
      await page.click('#win .opt[data-i="0"]');
      if (!(await page.evaluate(() => topScreen() instanceof DialogScreen && document.querySelector('#win .speech').textContent.length > 3))) throw new Error('диалог');
      await page.keyboard.press('Escape');
      // Шаг в жителя: сначала остановка, второй шаг — разговор.
      const bump = await page.evaluate(() => {
        const w = G.world, p = G.player;
        for (const n of w.villages[0].npcs)
          for (const [dx, dy] of DIRS8) {
            const x = n.x - dx, y = n.y - dy;
            if (!w.free(x, y)) continue;
            moveTo(p, x, y); refreshFov();
            const t0 = G.turn;
            tryMove(dx, dy);
            const first = topScreen() instanceof PlayScreen && G.turn === t0 && p.x === x;
            tryMove(dx, dy);
            const second = topScreen() instanceof DialogScreen;
            while (G.screens.length > 1) popScreen();
            return first && second;
          }
        return false;
      });
      if (!bump) throw new Error('в жителя влетаем сразу');
      // Кнопка «Котомка» открывает окно; в нём — надеть меч кликами.
      await page.evaluate(() => G.player.bag.push(makeItem('sword')));
      await page.click('#hud-actions button[data-code="KeyI"]');
      if (!(await page.evaluate(() => topScreen() instanceof InventoryScreen && !document.getElementById('win').hidden))) throw new Error('котомка не открылась');
      const swordRow = await page.evaluate(() => G.player.bag.findIndex(it => it.key === 'sword'));
      await page.click(`#win .row[data-side="1"][data-i="${swordRow}"]`);
      if (!(await page.textContent('#win .item-card')).includes('Меч')) throw new Error('нет карточки предмета');
      await page.click('#win button[data-act="use"]');
      if ((await page.evaluate(() => G.player.equip.right.key)) !== 'sword') throw new Error('меч не надет кликом');
      await page.click('#win button[data-act="close"]');
      // Лист героя: «+» повышает характеристику.
      await page.evaluate(() => { G.player.statPoints = 1; });
      await page.keyboard.press('KeyC');
      const dex0 = await page.evaluate(() => G.player.base.dex);
      await page.click('#win button.plus[data-i="2"]');
      if ((await page.evaluate(() => G.player.base.dex)) !== dex0 + 1) throw new Error('«+» не сработал');
      await page.keyboard.press('Escape');
      // Торговля: кнопка «купить».
      await page.evaluate(() => { G.player.coins = 100; pushScreen(new TradeScreen(TH.npc('merchant'))); render(); });
      const c0 = await page.evaluate(() => G.player.coins);
      await page.click('#win .tcol .row[data-side="0"][data-i="1"]');
      await page.click('#win .row.sel button[data-act="deal"][data-n="1"]');
      if ((await page.evaluate(() => G.player.coins)) >= c0) throw new Error('покупка кликом не прошла');
      await page.keyboard.press('Escape');
      // Журнал: вкладки кликом.
      await page.keyboard.press('Semicolon');
      await page.click('#win .tab[data-t="2"]');
      if (!(await page.isVisible('#win .month'))) throw new Error('календарь не открылся');
      await page.keyboard.press('Escape');
      if (await page.evaluate(() => !document.getElementById('win').hidden)) throw new Error('окно не закрылось');
      // Клик по зверю: выстрел из лука.
      await page.evaluate(() => { const p = G.player; TH.wild(); p.equip.left = null; p.equip.right = makeItem('shortbow'); p.ammo.arrow = 5; window.__w = TH.spawn('wolf', 5); __w.hp = 99; render(); });
      const [wx, wy] = await toScreen(await page.evaluate(() => [__w.x, __w.y]));
      await page.mouse.move(wx, wy);
      const tip = await page.evaluate(() => !document.getElementById('tip').hidden && document.getElementById('tip').textContent);
      if (!tip || !tip.includes('волк')) throw new Error('нет подсказки над зверем');
      await page.mouse.click(wx, wy);
      if ((await page.evaluate(() => G.player.ammo.arrow)) !== 4) throw new Error('клик не выстрелил');
      // Клик по карте Италии — путь.
      await page.evaluate(() => { leaveLocal(); G.weather = { kind: 'clear', until: G.minutes + 9999 }; G.wardUntil = G.minutes + 99999; render(); });
      const goal = await page.evaluate(() => { const ow = G.over;
        for (let r = 6; r < 30; r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, -r], [0, r]]) {
          const x = G.ox + dx, y = G.oy + dy;
          if (ow.passable(x, y) && !ow.placeAt(x, y) && !activeLeadAt(x, y) && findPath(ow, G.ox, G.oy, x, y, (a, b) => ow.passable(a, b) ? 1 : Infinity)) return [x, y];
        } });
      const [gx, gy] = await toScreen(goal);
      const from = await page.evaluate(() => [G.ox, G.oy]);
      await page.mouse.click(gx, gy);
      await page.waitForFunction(() => !G.auto, null, { timeout: 15000 });
      const to = await page.evaluate(() => [G.ox, G.oy]);
      if (to[0] === from[0] && to[1] === from[1]) throw new Error('не сдвинулся с места');
      const logLines = await page.evaluate(() => document.querySelectorAll('#hud-log p').length);
      if (logLines < 5) throw new Error('журнал сообщений пуст');
      return `путь ${from} → ${to}, сообщений ${logLines}`;
    },
  },

  {
    name: 'Еда, усталость, ночлег',
    run() {
      const p = TH.start();
      p.coins = 200;
      const r0 = p.rations;
      // Провиант у трактирщика.
      const inn = TH.npc('innkeeper');
      const ts = new TradeScreen(inn);
      ts.rows(0).find(r => r.label.startsWith('Провиант')).buy(4);
      assert(p.rations === r0 + 4, 'провиант не куплен');
      // Горячее в трактире.
      p.food = 20;
      TH.ask(inn, 'Поесть горячего');
      assert(p.food === 100, 'не наелся в трактире');
      // Долгий день на ногах — ещё ничего; двое суток без еды и сна — голоден, устал, штрафы.
      leaveLocal();
      const hit0 = p.hit;
      G.wardUntil = G.minutes + 99999;
      p.fatigue = 0;
      passTime(16 * 60);
      assert(!hungerState(p) && !fatigueState(p), `устал слишком быстро: еда ${p.food}, уст. ${p.fatigue}`);
      passTime(36 * 60);
      assert(hungerState(p) >= 1 && fatigueState(p) >= 1 && p.hit < hit0, `нет голода/усталости: еда ${p.food}, уст. ${p.fatigue}`);
      // Поесть из котомки.
      const f0 = p.food, n0 = p.rations;
      eat();
      assert(p.food > f0 && p.rations === n0 - 1, 'не поел');
      // Ночлег в глуши: усталость уходит.
      TH.wild();
      p.hp = p.maxHp;
      const fat = p.fatigue;
      // Сам ночлег в глуши может прервать зверь — так и задумано; проверяем, что он работает,
      // а отдых — на спокойном сне без нападения.
      sleepWild();
      if (p.fatigue >= fat - 40) {
        for (const m of G.world.actors.filter(a => a.kind === 'beast')) killBeast(m, false);
        p.fatigue = fat;
        sleep('Тестовый сон.', null, 0.85);
      }
      assert(p.fatigue < fat - 40, `не выспался: ${fat} → ${p.fatigue}`);
      // Лагерь на карте Италии.
      leaveLocal();
      p.fatigue = 80;
      camp();
      assert(p.fatigue < 40 || p.hp <= 0 || G.mode === 'local', 'лагерь не дал отдохнуть');
      // Без еды совсем — здоровье тает.
      if (G.mode === 'local') leaveLocal();
      p.food = 0; p.rations = 0; p.goods = {};
      const hp0 = p.hp = p.maxHp;
      passTime(5 * 60);
      assert(p.hp < hp0, 'голод не отнимает здоровье');
      return `провиант ${p.rations}, сытость ${Math.round(p.food)}`;
    },
  },

  {
    name: 'Задание «Логово»: взять, зачистить, сдать; провал по сроку',
    run() {
      const p = TH.start();
      TH.immortal();
      const v = G.over.cities.find(c => c.kind === 'village');
      TH.go(v);
      const el = TH.npc('elder');
      let o = null;
      for (let i = 0; i < 30 && !o; i++) { v.lastLair = null; o = offerLair(el); }
      assert(o && o.type === 'lair', 'староста не дал задание на логово');
      el.offer = o;
      TH.ask(el, o.accept);
      const q = p.quests.find(q => q.type === 'lair');
      const lead = G.leads.find(l => l.id === q.lead);
      assert(q && lead && lead.known && lead.quest === q.id && lead.until === q.deadline, 'логово не появилось на карте');
      assert(questLine(q).includes('ещё'), 'в строке задания нет срока');
      // Идём в логово и зачищаем его (ночные — ночью).
      leaveLocal();
      G.ox = lead.x; G.oy = lead.y; overEnter();
      const w = G.world;
      if (LEAD_KINDS[lead.kind].night) { G.minutes += ((23 * 60 - timeInfo().hour * 60) + 1440) % 1440; checkDayNight(); }
      for (const m of w.actors.filter(a => a.leadId === lead.id)) killBeast(m, true);
      assert(lead.done && q.done, `логово (${lead.kind}) зачищено, а задание не выполнено`);
      // За наградой — к старосте.
      leaveLocal();
      TH.go(v);
      const c0 = p.coins;
      TH.ask(TH.npc('elder'), 'Работа сделана');
      assert(!p.quests.includes(q) && p.coins === c0 + q.reward, 'награда не выдана');
      // Второе задание — не успеваем.
      const el2 = TH.npc('elder');
      let o2 = null;
      for (let i = 0; i < 30 && !o2; i++) { v.lastLair = null; el2.noWorkUntil = 0; o2 = offerLair(el2); }
      el2.offer = o2;
      TH.ask(el2, o2.accept);
      const q2 = p.quests.find(q => q.type === 'lair');
      leaveLocal();
      passTime((o2.deadline - timeInfo().day + 2) * 1440);
      assert(!p.quests.includes(q2), 'просроченное задание не провалилось');
      assert(!G.leads.some(l => l.id === q2.lead), 'логово не исчезло после срока');
      return `${q.label}: +${q.reward} мон.`;
    },
  },

  {
    name: 'Хроника: события записываются, читается в журнале и после гибели',
    async node(page, startPage) {
      await startPage(page);
      const n = await page.evaluate(() => {
        const p = G.player;
        p.gainXp(p.xpNext);                                   // уровень
        TH.go(TH.city('milan'));                               // новый город
        const t = G.over.sites.find(s => s.dungeon); revealTomb(t, 'нашёл');
        const kinds = new Set(p.chronicle.map(c => c.kind));
        assert(['start', 'level', 'travel', 'find'].every(k => kinds.has(k)), 'не всё записано: ' + [...kinds]);
        return p.chronicle.length;
      });
      await page.keyboard.press('Semicolon');
      await page.click('#win .tab[data-t="3"]');
      const rows = await page.evaluate(() => document.querySelectorAll('#win .chron-row').length);
      if (rows !== n) throw new Error(`в хронике ${rows} строк из ${n}`);
      await page.keyboard.press('Escape');
      await page.evaluate(() => { G.deathCause = 'тест'; G.player.hp = 0; checkDeath(); });
      await page.waitForTimeout(900);
      await page.keyboard.press('KeyH');
      const death = await page.evaluate(() => topScreen() instanceof JournalScreen && topScreen().tab === 3
        && [...document.querySelectorAll('#win .chron-row.death')].length === 1);
      if (!death) throw new Error('после гибели хроника не открылась или нет записи о смерти');
      await page.keyboard.press('Escape');
      if (!(await page.evaluate(() => topScreen() instanceof DeathScreen))) throw new Error('не вернулись к экрану смерти');
      return `${n + 1} записей`;
    },
  },

  {
    name: 'Лючера: имам и сарацины без христианского',
    run() {
      const p = TH.start();
      p.coins = 500; p.piety = 70;
      TH.go(TH.city('lucera'));
      const v = G.world.villages[0], imam = v.npcs.find(n => n.role === 'priest');
      assert(imam && imam.title === 'Имам' && npcPortrait(imam) === 'imam', 'нет имама');
      const opts = TH.options(imam).join(' | ');
      assert(!/Святыни|месс|Помолиться вместе|покровител|исцеления|служба/i.test(opts) && /вашей вере/.test(opts), 'христианское у имама: ' + opts);
      for (let i = 0; i < 15; i++) {
        const t = (TH.ask(imam, 'Что нового') || '') + (TH.ask(imam, 'Как живёт') || '');
        assert(!/святого|святой|епископ|месс|Господ|Христос|Христа|аббат/i.test(t.replace(/Святого Петра|Святой престол|Святой земл\S*/g, '')), 'христианские речи у имама: ' + t);
      }
      assert(v.npcs.every(n => SARACEN_GREETINGS[n.role === 'priest' ? 'imam' : n.role] ? SARACEN_GREETINGS[n.role === 'priest' ? 'imam' : n.role].includes(n.greeting) : true), 'христианские приветствия');
      assert(G.world.tiles.includes(T.MIHRAB) && !G.world.tiles.includes(T.ALTAR), 'алтарь в мечети');
      assert(v.npcs.every(n => /^(saracen_|imam$|smith$)/.test(npcPortrait(n))), 'не сарацинские портреты: ' + v.npcs.map(npcPortrait).join(','));
      const inn = v.npcs.find(n => n.role === 'innkeeper');
      assert(!inn || !TH.options(inn).some(o => /эля/.test(o)), 'эль в Лючере');
      // У христиан — по-прежнему священник с реликвиями.
      TH.go(TH.city('rome'));
      assert(TH.options(G.world.villages[0].npcs.find(n => n.role === 'priest')).some(o => /Святыни/.test(o)), 'сломался обычный священник');
      return opts;
    },
  },

  {
    name: 'Герой-сарацин: Лючера, лук, мечеть вместо мессы',
    run() {
      const idx = PEOPLES.findIndex(x => x.id === 'saracen');
      const p = TH.start(idx);
      assert(G.world.villages[0].city.id === 'lucera' && p.bag.some(it => it.key === 'shortbow') && p.ammo.arrow > 0, 'не в Лючере или без лука');
      p.piety = 60; p.coins = 200;
      const imam = G.world.villages[0].npcs.find(n => n.role === 'priest');
      const pi = p.piety;
      TH.ask(imam, /Помолиться в мечети|Пятничная молитва/);
      assert(p.piety > pi && p.lastPractice === timeInfo().day, 'молитва в мечети не засчиталась');
      TH.go(TH.city('rome'));
      const opts = TH.options(G.world.villages[0].npcs.find(n => n.role === 'priest')).join(' | ');
      assert(!/месс|Святыни|Пожертвовать|служба|Помолиться вместе/.test(opts) && /исцеления/.test(opts), 'христианское у сарацина: ' + opts);
      return opts;
    },
  },

  {
    name: 'Непобедимое Солнце: дух, ступени, факелы, бык',
    run() {
      const p = TH.start();
      TH.immortal();
      p.coins = 300;
      const site = G.over.sites.find(s => s.type === 'mithraeum');
      leaveLocal(); G.ox = site.x; G.oy = site.y; revealTomb(site); overEnter();
      const sp = () => G.world.actors.find(a => a.special === 'mithras');
      assert(G.world.site === site && sp() && npcPortrait(sp()) === 'pagan_m1', 'нет духа в митреуме');
      TH.ask(sp(), 'Я пройду');
      assert(mithrasStage() === 1, 'посвящение не началось');
      // Ворон: хлеб и вино.
      TH.ask(sp(), 'О трапезе');
      assert(mithrasStage() === 1, 'трапеза без вина');
      p.goods.wine = 1;
      TH.ask(sp(), 'Разделить');
      assert(mithrasStage() === 2 && !p.goods.wine, 'трапеза');
      // Воин: принять венец — провал, назавтра снова.
      TH.ask(sp(), 'Принять венец');
      assert(mithrasStage() === 2 && /завтра/.test(TH.ask(sp(), 'Я готов')), 'принятый венец не провалил испытание');
      p.story.mithrasWait = 0;
      TH.ask(sp(), 'Отвести венец');
      assert(mithrasStage() === 3, 'венец');
      // Лев: мёд у травницы.
      const home = G.over.cities.find(c => c.kind === 'town');
      TH.go(home);
      const herb = G.world.villages[0].npcs.find(n => n.role === 'herbalist');
      TH.ask(herb, 'Купить горшочек мёда');
      assert(p.story.mithrasHoney, 'мёд не куплен');
      leaveLocal(); G.ox = site.x; G.oy = site.y; overEnter();
      TH.ask(sp(), 'Омыть руки мёдом');
      assert(mithrasStage() === 4, 'мёд');
      // Дно: факелоносцы и бык.
      const d = G.dungeons[site.id];
      goToLevel(site, d, site.depth - 1, 'up');
      const w = G.world;
      const find = t => { const i = w.tiles.indexOf(t); return [i % w.w, (i / w.w) | 0]; };
      const [cx, cy] = find(T.CAUTES), [ox, oy] = find(T.CAUTOPATES);
      assert(cx >= 0 && ox >= 0, 'нет факелоносцев');
      bumpTorchbearer(ox, oy);
      assert(!(w.mithrasLit || []).length, 'закат раньше восхода');
      bumpTorchbearer(cx, cy); bumpTorchbearer(ox, oy);
      const bull = w.actors.find(a => a.key === 'mithras_bull');
      assert(mithrasStage() === 5 && bull, 'бык не вышел');
      const pi = p.piety;
      killBeast(bull, true);
      assert(mithrasStage() === 6 && p.solInvictus && p.piety < pi && !p.quests.some(q => q.id === 'mithras'), 'благословение');
      // Дух ушёл.
      goToLevel(site, d, 0, 'up');
      assert(!sp(), 'дух остался');
      return site.name;
    },
  },

  {
    name: 'Навыки: предыстория, рост от дела, польза, плавание',
    run() {
      // Предыстория даёт навыки и вещи.
      const hunter = BACKGROUNDS.find(b => b.id === 'hunter');
      startGame(new Player('Тест', PEOPLES[0], { str: 7, con: 6, dex: 6, wis: 6, fai: 6 }, hunter));
      const p = G.player;
      TH.immortal();
      assert(skillLevel(p, 'bow') === 2 && skillLevel(p, 'survival') === 1 && p.bag.some(it => it.key === 'shortbow') && p.ammo.arrow >= 15, 'предыстория');
      // Рубка учит топору; навык прибавляет меткость и урон.
      p.equip.right = makeItem('axe');
      const hit0 = p.hit, dmg0 = p.dmgBonus(null);
      const w = TH.wild();
      for (let i = 0; i < 700 && skillLevel(p, 'axe') < 6; i++) {
        const m = TH.spawn('wolf') || TH.spawn('wolf', 1, 1);
        if (m) { m.hp = 9999; playerAttack(m); w.actors = w.actors.filter(a => a !== m); }
      }
      assert(skillLevel(p, 'axe') >= 6 && p.hit >= hit0 + 3 && p.dmgBonus(null) >= dmg0 + 2, `топор не растёт: ${skillLevel(p, 'axe')}, ${p.hit}/${hit0}`);
      // Торговля: цены лучше.
      const buy0 = p.priceBuy(100), sell0 = p.priceSell(100);
      p.skills.trade.lvl = 10;
      assert(p.priceBuy(100) < buy0 && p.priceSell(100) > sell0, 'торговля не влияет');
      // Атлетика: больше груза.
      const cap0 = p.capacity; p.skills.athletics.lvl = 5;
      assert(p.capacity === cap0 + 10, 'атлетика не влияет на груз');
      // Доспех: тяжёлое меньше мешает уворачиваться.
      p.equip.body = makeItem('scale');
      const ev0 = p.ev; p.skills.armor.lvl = 3;
      assert(p.ev === ev0 + 1, 'доспех не снимает штраф');
      // Плавание: в воду можно войти; навык растёт.
      w.set(p.x + 1, p.y, T.WATER); w.set(p.x + 2, p.y, T.WATER);
      p.equip.body = null;
      const sw0 = p.skills.swim.xp + p.skills.swim.lvl * 1000, x0 = p.x;
      tryMove(1, 0); tryMove(1, 0);
      assert(p.x === x0 + 2 && w.get(p.x, p.y) === T.WATER && p.skills.swim.xp + p.skills.swim.lvl * 1000 > sw0, 'не плывёт');
      // Скрытность: удар исподтишка по ничего не подозревающему сильнее.
      tryMove(-1, 0); tryMove(-1, 0);
      p.equip.right = makeItem('sword'); p.skills.stealth.lvl = 5;
      w.actors = w.actors.filter(a => a === p);
      const prey = TH.spawn('wolf', 1, 0);
      prey.hp = 9999; prey.target = null; prey.provoked = false;
      const st0 = p.skills.stealth.xp;
      for (let i = 0; i < 20 && prey.hp === 9999; i++) { prey.target = null; prey.wasProvoked = false; playerAttack(prey); }
      assert(prey.hp < 9999 && TH.lastLog(3).includes('исподтишка'), 'нет удара исподтишка');
      // Красноречие: награда за работу больше.
      p.skills.speech.lvl = 10;
      TH.go(TH.city('rome'));
      const elder = TH.npc('elder');
      let o = null;
      for (let i = 0; i < 30 && !o; i++) { elder.offer = null; elder.noWorkUntil = 0; TH.ask(elder, 'Нет ли'); o = elder.offer; }
      assert(o && o.haggled, 'красноречие не влияет: ' + TH.options(elder).join('|') + ' / ' + p.quests.length);
      elder.offer = null;
      // Грамота: латиницу неграмотный не читает; урок у священника учит.
      assert(needsLetters('DIS MANIBVS') && !needsLetters('Рыба и якорь'), 'проверка латиницы');
      p.coins += 50;
      const l0 = p.skills.letters.xp + p.skills.letters.lvl * 1000;
      TH.ask(TH.npc('priest'), 'Поучиться грамоте');
      assert(p.skills.letters.xp + p.skills.letters.lvl * 1000 > l0, 'урок грамоты');
      // Верховая езда: с навыком лошадь быстрее.
      p.mount = { kind: 'horse' };
      const sp0 = mountSpeed(p, G.over, G.ox, G.oy); p.skills.riding.lvl = 10;
      assert(mountSpeed(p, G.over, G.ox, G.oy) < sp0, 'езда не влияет');
      p.mount = null;
      // Старое сохранение без навыков получает их.
      delete p.skills;
      applyBackground(p, null);
      assert(Object.keys(SKILLS).every(k => p.skills[k].lvl === 0), 'миграция навыков');
      return 'топор ' + 6;
    },
  },

  {
    name: 'Экономика: рынок отзывается на сделки, реликвии — набожным',
    run() {
      const p = TH.start();
      p.coins = 5000;
      TH.go(TH.city('florence'));
      const m = TH.npc('merchant');
      const tr = new TradeScreen(m), place = tr.place;
      const before = buyPrice(place, 'silk');
      tr.buy('silk', 8, before);
      const after = buyPrice(place, 'silk');
      assert(after > before, `цена не растёт: ${before} → ${after}`);
      const sell0 = sellPrice(place, 'silk');
      tr.sellGood('silk', 8);
      assert(sellPrice(place, 'silk') < sell0, 'цена не падает при продаже');
      // Через неделю рынок успокаивается.
      G.minutes += 7 * 24 * 60;
      const calm = marketPress(place, 'silk');
      assert(Math.abs(calm - 1) < 0.1, 'рынок не успокоился: ' + calm);
      // Реликвии: без благочестия не продают.
      const pr = TH.npc('priest'), tp = new TradeScreen(pr);
      p.piety = 5;
      tp.buyGear('reliquary', 1, 260);
      assert(!p.bag.some(it => it.key === 'reliquary') && /благочестие/.test(tp.note), 'реликвия без благочестия');
      p.piety = 60;
      tp.buyGear('reliquary', 1, 260);
      assert(p.bag.some(it => it.key === 'reliquary'), 'реликвия набожному');
      // Снаряжение дорогое.
      assert(ITEMS.sword.value >= 200 && ITEMS.mail.value >= 250 && MOUNTS.horse.price >= 400, 'цены не подняты');
      return `шёлк ${before} → ${after}`;
    },
  },

  {
    name: 'Святыня для храма: малое подземелье, ларцы, подделка, грамота',
    run() {
      const p = TH.start();
      TH.immortal();
      const res = [];
      for (const literate of [true, false]) {
        const town = G.over.cities.filter(c => c.kind === 'town')[literate ? 0 : 1];
        TH.go(town);
        const pr = TH.npc('priest');
        let o = null;
        for (let i = 0; i < 20 && !o; i++) o = offerRelic(pr);
        assert(o && o.type === 'relic' && RELIC_SITES.includes(o.siteType), 'нет предложения');
        acceptQuest(pr, o);
        const q = p.quests.find(x => x.type === 'relic');
        const site = G.over.sites.find(x => x.id === q.site);
        assert(site && site.mini && !site.hidden && site.depth === 1, 'малое подземелье не создано');
        leaveLocal(); G.ox = site.x; G.oy = site.y; overEnter();
        const w = G.world;
        assert(w.kind === 'dungeon' && w.site === site && !w.down && !w.actors.some(a => a.bossOf), 'не то подземелье');
        w.actors = w.actors.filter(a => a === p);
        const chests = [...w.containers].filter(([, k]) => /^relic_/.test(k));
        assert(chests.length === 2 && q.placed, 'нет двух ларцов');
        p.skills.letters.lvl = literate ? 3 : 0;
        const [ci] = chests.find(([, k]) => k === (literate ? 'relic_true' : 'relic_fake'));
        const cx = ci % w.w, cy = (ci / w.w) | 0;
        moveTo(p, cx, cy - 1);
        tryMove(0, 1);
        assert(w.containers.has(ci), 'ларец взят без осмотра');
        if (literate) assert(/Подлинный/.test(TH.lastLog(1)), 'грамотный не прочёл надпись');
        tryMove(0, 1);
        assert(q.done && q.genuine === literate && ![...w.containers.values()].some(k => /^relic_/.test(k)), 'ларец не взят или второй не рассыпался');
        // Выход по лестнице наверх — на карту Италии.
        moveTo(p, w.up[0] + 1, w.up[1]); useStairs(T.STAIRS_UP);
        assert(G.mode === 'over', 'не выйти из малого подземелья');
        TH.go(town);
        const c0 = p.coins, pi = p.piety;
        const ans = TH.ask(TH.npc('priest'), 'Вот мощи');
        assert(!p.quests.includes(q), 'задание не закрыто');
        if (literate) assert(p.coins === c0 + q.reward && p.piety > pi, 'нет награды за подлинные');
        else assert(/подделка/i.test(ans) && p.coins < c0 + q.reward, 'подделку не распознали');
        res.push(`${site.name}: ${literate ? 'подлинные' : 'подделка'}`);
      }
      return res.join(', ');
    },
  },

  {
    name: 'Ограбление святыни: приметы, поиск стоянки, возврат',
    run() {
      const p = TH.start();
      TH.immortal();
      const town = G.over.cities.find(c => c.kind === 'town');
      TH.go(town);
      const pr = TH.npc('priest');
      const o = offerTheft(pr);
      assert(o && o.hidden && /главарь/.test(o.text), 'нет предложения');
      acceptQuest(pr, o);
      const q = p.quests.find(x => x.lairKind === 'thieves'), lead = G.leads.find(l => l.id === q.lead);
      assert(lead && !lead.known, 'стоянка сразу отмечена на карте');
      // Найти: бродить рядом и осматриваться.
      leaveLocal();
      G.ox = lead.x + 2; G.oy = lead.y;
      for (let i = 0; i < 80 && !lead.known; i++) spotLeads(G.ox, G.oy, true);
      assert(lead.known, 'стоянку не найти');
      G.ox = lead.x; G.oy = lead.y;
      enterLead(lead);
      const w = G.world;
      const chief = w.actors.find(a => a.key === 'brigand_chief');
      assert(chief && chief.name.includes(o.look), 'главарь не по приметам');
      for (const a of w.actors.filter(a => a.leadId === lead.id)) killBeast(a, true);
      assert(q.done, 'не засчитано');
      const ci = [...w.containers].find(([, k]) => k === 'stolen_relic');
      assert(ci, 'нет ларца');
      openContainer(ci[0] % w.w, (ci[0] / w.w) | 0);
      assert(/ларец с мощами/.test(TH.lastLog(1)), 'ларец не найден');
      TH.go(town);
      const pi = p.piety, c0 = p.coins;
      TH.ask(TH.npc('priest'), 'Работа сделана');
      assert(p.coins === c0 + q.reward && p.piety > pi && !p.quests.includes(q), 'награда');
      return o.look;
    },
  },

  {
    name: 'Осада Пармы: Виттория, ночной проход, падение 18 февраля 1248',
    run() {
      const p = TH.start();
      TH.immortal();
      assert(parmaSiege() && dateOfDay(1).m === 7, 'осада не идёт в начале пути');
      const parma = TH.city('parma'), vit = vittoriaPlace();
      assert(vit && (vit.x !== parma.x || vit.y !== parma.y), 'нет Виттории');
      // Виттория: император.
      TH.go(vit);
      const fr = G.world.villages[0].npcs.find(n => n.name === 'Фридрих II');
      assert(fr && /Гогенштауфен/.test(historicInfo(fr)) && npcPortrait(fr) === 'frederick', 'нет императора в Виттории');
      // Говорит как император, а не как житель.
      const opts = TH.options(fr).join('|');
      assert(/соколах/.test(opts) && /папе/.test(opts) && !/Что нового в округе|Как жизнь/.test(opts), 'император говорит как все: ' + opts);
      assert(FREDERICK_GREETINGS.includes(greetingFor(fr)), 'приветствие не императорское');
      TH.ask(fr, 'Могу ли я послужить');
      assert(p.quests.some(q => q.item === 'Письмо императора королю Энцо'), 'нет поручения императора');
      // Днём в Парму не войти.
      leaveLocal(); G.ox = parma.x; G.oy = parma.y;
      const night0 = isNight();
      if (!night0) { overEnter(); assert(G.mode === 'over', 'днём вошёл в осаждённую Парму'); }
      // Ночью — пробраться.
      while (!isNight()) passTime(60);
      p.skills.stealth.lvl = 10;
      for (let i = 0; i < 30 && !(G.mode === 'local' && G.world.villages && G.world.villages[0] && G.world.villages[0].city === parma); i++) {
        if (G.mode === 'local') { leaveLocal(); G.ox = parma.x; G.oy = parma.y; }
        overEnter();
      }
      assert(G.world.villages[0].city === parma, 'ночью не пробраться');
      assert(goodPrice(parma, 'grain') > GOODS.grain.base * 1.5, 'хлеб в осаде не дорог');
      // 18 февраля 1248.
      const fall = dayOfDate(1248, 2, 18);
      G.minutes = (fall - 1) * 24 * 60 + 10 * 60;
      worldTick();
      assert(!parmaSiege() && G.flags.parma_fallen && vit.razed, 'Виттория не пала');
      assert(G.news.some(n => /сожжён/.test(n.text)), 'нет вести о падении');
      TH.go(vit);
      assert(!G.world.villages[0].npcs.length, 'в пепелище живут');
      leaveLocal(); G.ox = parma.x; G.oy = parma.y;
      while (isNight()) passTime(60);
      overEnter();
      assert(G.mode === 'local' && G.world.villages[0].city === parma, 'днём не войти в свободную Парму');
      return dateText(today(), false);
    },
  },

  {
    name: 'Вход в поселение — с края карты, откуда пришёл',
    run() {
      TH.start();
      const c = TH.city('florence');
      leaveLocal();
      G.ox = c.x + 1; G.oy = c.y;
      overMove(-1, 0);
      if (G.mode !== 'over') leaveLocal();
      G.ox = c.x; G.oy = c.y; G.lastDir = [-1, 0];
      overEnter();
      const w = G.world, p = G.player;
      assert(w.villages[0].city === c && p.x >= w.w - 3, `не с восточного края: ${p.x}/${w.w}`);
      leaveLocal(); G.lastDir = [0, 1];
      overEnter();
      assert(G.player.y <= 2, `не с северного края: ${G.player.y}`);
      return 'ok';
    },
  },

  {
    name: 'Тихая деревня: кастелян, подозрения, церковь, похищение, глава культа',
    run() {
      const p = TH.start();
      TH.immortal();
      // Кастелян в замке.
      const castle = G.over.cities.find(c => c.kind === 'castle' && !c.famous);
      TH.go(castle);
      const cast = G.world.villages[0].npcs.find(n => n.role === 'elder');
      TH.ask(cast, 'Что тревожит');
      assert(cultStage() === 1, 'задание не дано');
      const v = cultVillagePlace();
      // Деревня: холодный приём, нет священника, церковь на отшибе.
      leaveLocal(); G.ox = v.x; G.oy = v.y; G.lastDir = [1, 0]; overEnter();
      const w = G.world;
      assert(w.cult && w.cultChurch && !w.villages[0].npcs.some(n => n.role === 'priest'), 'деревня не та');
      const peasant = w.villages[0].npcs.find(n => n.role === 'peasant');
      assert(CULT_GREETINGS.includes(greetingFor(peasant)), 'приветствие не враждебное');
      // Похищение во сне.
      const el = w.villages[0].npcs.find(n => n.role === 'elder');
      TH.ask(el, 'Пустите');
      p.fatigue = 90;
      let tries = 0;
      while (G.world === w && tries++ < 20) { p.story.cultLodging = true; p.fatigue = 90; sleepWild(); }
      assert(G.world.site && G.world.site.type === 'cult' && !p.equip.right && cultStage() === 2, 'не похитили');
      const lw = G.world;
      const ci = [...lw.containers].find(([, k]) => k === 'kidnap_stash');
      assert(ci && lw.kidnapItems.length, 'нет сундука с оружием');
      openContainer(ci[0] % lw.w, (ci[0] / lw.w) | 0);
      assert(p.bag.some(it => it.key === 'club'), 'оружие не вернулось');
      // Выход наверх — в церковь, спуск открыт? (алтарь ещё не сдвинут — выход ведёт в деревню)
      moveTo(p, lw.up[0] + 1, lw.up[1]); useStairs(T.STAIRS_UP);
      assert(G.world.cult, 'не вернулся в деревню');
      // Церковь: алтарь — спуск.
      const vw = G.world, [ax, ay] = vw.cultChurch.altar;
      moveTo(p, ax - 1, ay);
      tryMove(1, 0); tryMove(1, 0);
      assert(vw.get(ax, ay) === T.STAIRS_DOWN, 'спуск не открылся');
      // Подозрение: расспросы — бунт.
      for (let i = 0; i < 4 && !p.story.cultRiot; i++) TH.ask(vw.villages[0].npcs.find(n => n.role === 'peasant' || n.role === 'elder'), 'Где ваш священник');
      assert(p.story.cultRiot && vw.actors.some(a => a.key === 'cult_villager'), 'жители не взялись за вилы');
      // Вниз, к главе культа.
      moveTo(p, ax - 1, ay); tryMove(1, 0);
      assert(G.world.site && G.world.site.type === 'cult', 'не спустился');
      const site = G.world.site;
      goToLevel(site, G.dungeons[site.id], 1, 'up');
      const boss = G.world.actors.find(a => a.key === 'cult_leader');
      assert(boss && G.world.actors.some(a => a.key === 'imp'), 'нет главы или бесов');
      killBeast(boss, true);
      assert(cultStage() === 3, 'глава не засчитан');
      // Деревня очнулась, кастелян платит.
      TH.go(v);
      assert(!G.world.cult || !cultActive(v), 'культ жив');
      TH.go(castle);
      const c0 = p.coins;
      TH.ask(G.world.villages[0].npcs.find(n => n.role === 'elder'), 'Я знаю');
      assert(cultStage() === 4 && p.coins === c0 + 220 && !p.quests.some(q => q.id === 'cult'), 'награда');
      return v.name;
    },
  },

  {
    name: 'Путники на дорогах: идут, говорят, торгуют; разбойники нападают',
    run() {
      const p = TH.start();
      TH.immortal();
      const kinds = new Set(G.travelers.map(t => t.kind));
      assert(G.travelers.length >= 20 && ['pilgrims', 'peasants', 'caravan', 'brigands'].every(k => kinds.has(k)), 'мало путников: ' + [...kinds]);
      // Идут по своим путям.
      const walker = G.travelers.find(t => t.kind === 'caravan');
      const i0 = walker.i;
      leaveLocal();
      passTime(6 * 60);
      assert(walker.i > i0 || !G.travelers.includes(walker), 'обоз стоит на месте');
      // Встреча и разговор: крестьяне продают припасы.
      const pe = G.travelers.find(t => t.kind === 'peasants') || (() => { const t = spawnTraveler('peasants', G.ox, G.oy, true); G.travelers.push(t); return t; })();
      G.ox = pe.x; G.oy = pe.y;
      if (G.over.placeAt(G.ox, G.oy)) { pe.x = G.ox = pe.x; }
      const npc = travelerNpc(pe);
      const opts = travelerOptions(npc).map(o => o.label);
      assert(opts.some(l => /припас/.test(l)), 'крестьяне не торгуют: ' + opts.join('|'));
      p.coins = 100;
      const tr = new TradeScreen(npc), r0 = p.rations;
      tr.buy('ration', 2, p.priceBuy(RATION_PRICE));
      assert(p.rations === r0 + 2, 'не купил у крестьян');
      assert(newsReply(npc).length > 5, 'путник молчит');
      // Разбойники грабят обоз — на карте событие.
      const car = spawnTraveler('caravan', G.ox, G.oy, true); G.travelers.push(car);
      const band = { id: 'trX', kind: 'brigands', x: car.x, y: car.y, path: [], i: 0, acc: 0, n: 4 };
      const leads0 = G.leads.length;
      let ok = false;
      for (let k = 0; k < 10 && !ok; k++) {
        if (!G.travelers.includes(car)) break;
        ambushTraveler(band, car);
        ok = !G.travelers.includes(car) ? G.leads.length > leads0 : false;
        if (!ok && G.travelers.includes(car)) G.travelers.push(band);
      }
      // Разбойники нападают на героя.
      if (G.mode === 'local') leaveLocal();
      const b2 = { id: 'trY', kind: 'brigands', x: G.ox, y: G.oy, path: [], i: 0, acc: 0, n: 4 };
      G.travelers.push(b2);
      brigandsAttackHero(b2);
      assert(G.mode === 'local' && G.world.actors.some(a => a.key === 'brigand'), 'разбойники не напали');
      return `путников ${G.travelers.length}`;
    },
  },

  {
    name: 'Охрана обоза, сопровождение паломников, атаман с наградой за голову',
    run() {
      const p = TH.start();
      TH.immortal();
      if (G.mode === 'local') leaveLocal();
      // Обоз: наняться, засада, отбиться, дойти.
      let car = null;
      for (let k = 0; k < 30 && !car; k++) { const t = spawnTraveler('caravan', G.ox, G.oy, true); if (t && G.over.cities.find(c => c.id === t.to)) car = t; }
      G.travelers.push(car);
      G.ox = car.x; G.oy = car.y;
      const npc = travelerNpc(car);
      car.needsGuard = true;
      const hire = travelerOptions(npc).find(o => /охрану/.test(o.label));
      assert(hire, 'нельзя наняться');
      hire.act();
      const q = escortQuest();
      assert(q && q.kind === 'caravan', 'нет задания охраны');
      // Засада: перебить разбойников — обоз цел.
      G.escortFight = q.id; enterWild('brigand');
      for (const a of G.world.actors.filter(a => a.kind === 'beast')) killBeast(a, false);
      leaveLocal();
      assert(escortQuest() === q, 'обоз потерян, хотя отбились');
      // Прибытие в город назначения.
      const dest = G.over.cities.find(c => c.id === q.to);
      G.ox = dest.x; G.oy = dest.y; car.x = dest.x; car.y = dest.y; car.waiting = false;
      const c0 = p.coins;
      overEnter();
      assert(!escortQuest() && p.coins === c0 + q.reward, 'нет платы за охрану');
      // Паломники: бросить бой — провал.
      if (G.mode === 'local') leaveLocal();
      let pil = null;
      for (let k = 0; k < 30 && !pil; k++) pil = spawnTraveler('pilgrims', G.ox, G.oy, true);
      G.travelers.push(pil); G.ox = pil.x; G.oy = pil.y;
      // Не каждому нужна защита — и решение не меняется, сколько ни спрашивай.
      const solo = spawnTraveler('caravan', G.ox, G.oy, true); solo.needsGuard = false; G.travelers.push(solo);
      for (let k = 0; k < 5; k++) assert(!travelerOptions(travelerNpc(solo)).some(o => /Наняться/.test(o.label)), 'нанялся к обозу со своей охраной');
      pil.needsGuard = true;
      travelerOptions(travelerNpc(pil)).find(o => /Проводить/.test(o.label)).act();
      const q2 = escortQuest();
      G.escortFight = q2.id; enterWild('brigand');
      leaveLocal();
      assert(!escortQuest(), 'бросил паломников — а задание живо');
      // Атаман: шайка с наградой, голова — подесте.
      const band = { id: 'trZ', kind: 'brigands', x: G.ox, y: G.oy, path: [], i: 0, acc: 0, n: 3 };
      G.travelerN = (G.travelerN || 0) + 1;
      makeEliteBand(band);
      G.travelers.push(band);
      brigandsAttackHero(band);
      const lord = G.world.actors.find(a => a.key === 'bandit_lord');
      assert(lord && lord.name.includes(band.elite.name), 'нет атамана');
      killBeast(lord, true);
      assert(p.trophies[band.elite.id], 'нет головы');
      TH.go(TH.city('florence'));
      const c1 = p.coins;
      TH.ask(TH.npc('elder'), 'Принёс голову');
      assert(p.coins === c1 + band.elite.bounty && !p.trophies[band.elite.id], 'награда за голову');
      return band.elite.name;
    },
  },

  {
    name: 'Ярмарки: весть за неделю, купцы, цены, состязания, карманники',
    run() {
      const p = TH.start();
      TH.immortal();
      p.coins = 400;
      // За неделю до Успения (15 августа 1247) — весть о ярмарке в Сиене.
      const fd = dayOfDate(1247, 8, 15);
      G.minutes = (fd - 8) * 24 * 60 + 10 * 60;
      worldTick();
      const siena = TH.city('siena');
      const h = upcomingFair(siena);
      assert(h && h.start === fd - 1 && G.news.some(n => /ярмарк/i.test(n.text) && /Сиен/.test(n.text)), 'нет вести о ярмарке');
      const toFair = G.travelers.filter(t => t.toFair && t.to === 'siena').length;
      // Ярмарка идёт.
      const before = buyPrice(siena, 'silk');
      G.minutes = (fd - 1) * 24 * 60 + 10 * 60;
      worldTick();
      assert(activeFair(siena), 'ярмарка не началась');
      assert(buyPrice(siena, 'silk') <= before, 'на ярмарке не дешевле');
      if (G.mode === 'local') leaveLocal();
      G.ox = siena.x; G.oy = siena.y; overEnter();
      const v = G.world.villages[0];
      const fairNpcs = v.npcs.filter(n => n.fair);
      assert(fairNpcs.filter(n => n.title === 'Заезжий купец').length === 3 && v.npcs.some(n => n.fairRole === 'herald') && v.npcs.some(n => n.fairRole === 'jongleur'), 'нет ярмарочного люда');
      // Состязание: борьба (раз за ярмарку).
      const herald = v.npcs.find(n => n.fairRole === 'herald');
      p.base.str = 20; p.skills.athletics.lvl = 10;
      const c0 = p.coins;
      TH.ask(herald, 'Борьба');
      assert(p.coins !== c0 && h.done.wrestling, 'не поучаствовал');
      assert(/уже/.test(TH.ask(herald, 'Борьба') || ''), 'второй раз пустили');
      // Скачки без лошади — нельзя.
      assert(/лошадь/.test(TH.ask(herald, 'Скачки') || ''), 'скачки без лошади');
      // Жонглёр.
      assert(JONGLEUR_TALES.includes(TH.ask(v.npcs.find(n => n.fairRole === 'jongleur'), 'Послушать')), 'жонглёр молчит');
      // После ярмарки заезжие разъезжаются.
      leaveLocal();
      G.minutes = (fd + 3) * 24 * 60 + 10 * 60;
      worldTick();
      overEnter();
      assert(!G.world.villages[0].npcs.some(n => n.fair), 'ярмарка не кончилась');
      return `обозов на ярмарку: ${toFair}`;
    },
  },

  {
    name: 'События мира: редкие, не больше двух сразу; мор, турнир, ход, казнь, набег, неурожай',
    run() {
      const p = TH.start();
      TH.immortal();
      // Год без героя: сколько событий и сколько сразу.
      let started = 0, maxAt = 0;
      const n0 = () => (G.happenings || []).filter(h => h.kind !== 'fair').length;
      for (let d = 2; d <= 366; d++) {
        const before = n0();
        G.minutes = (d - 1) * 1440 + 600; worldTick();
        started += Math.max(0, n0() - before);
        maxAt = Math.max(maxAt, happeningsOther(d).filter(h => h.start <= d).length);
      }
      assert(started >= 6 && started <= 40 && maxAt <= 2, `событий за год: ${started}, сразу до ${maxAt}`);
      const kinds = new Set(G.happenings.map(h => h.kind));
      // Каждое событие отдельно — в нужном месте и сегодня.
      const day = timeInfo().day;
      const make = (kind, place) => { const h = { id: 'hpT' + kind, kind, place: place.id, region: place.region, start: day, end: day + 2, day, done: {} }; G.happenings.push(h); return h; };
      // Мор: еда дороже, помочь больным.
      const town = G.over.cities.find(c => c.kind === 'town' && c.id !== 'parma');
      const food0 = goodPrice(town, 'grain');
      const pl = make('plague', town);
      assert(goodPrice(town, 'grain') > food0, 'мор не поднял цены');
      TH.go(town);
      const pi0 = p.piety;
      TH.ask(TH.npc('priest'), 'Помочь ухаживать');
      assert(pl.done.helped === day, 'не помог больным');
      G.happenings = G.happenings.filter(h => h !== pl);
      // Крестный ход.
      make('procession', town);
      TH.go(town);
      TH.ask(TH.npc('priest'), 'Пройти крестным ходом');
      assert(p.piety > pi0, 'крестный ход не дал благочестия');
      // Казнь: исповедь осуждённого.
      const town2 = G.over.cities.filter(c => c.kind === 'town' && c.id !== 'parma')[1];
      make('execution', town2);
      TH.go(town2);
      const cond = G.world.villages[0].npcs.find(n => n.hapRole === 'condemned');
      assert(cond && TH.ask(cond, 'Слушать').length > 10, 'нет осуждённого');
      // Турнир.
      const castle = G.over.cities.find(c => c.kind === 'castle' && !c.siege);
      make('tournament', castle);
      TH.go(castle);
      const her = G.world.villages[0].npcs.find(n => n.hapRole === 'herald');
      p.coins = 200;
      assert(her && /коня|лошадь/.test(TH.ask(her, 'Конная сшибка')), 'сшибка без коня');
      TH.ask(her, 'Пеший бой');
      assert(G.happenings.find(h => h.id === 'hpTtournament').done.melee, 'бугурт не состоялся');
      // Набег: перебить мародёров — староста платит.
      const vil = G.over.cities.find(c => c.kind === 'village');
      const raid = make('raid', vil);
      TH.go(vil);
      const raiders = G.world.actors.filter(a => a.hap === raid.id && a.kind === 'beast');
      assert(raiders.length >= 3, 'нет мародёров');
      for (const m of raiders) killBeast(m, true);
      assert(raid.done.cleared, 'набег не отбит');
      const c0 = p.coins;
      TH.ask(TH.npc('elder'), 'Мародёры перебиты');
      assert(p.coins > c0, 'староста не заплатил');
      // Неурожай: еда в крае дороже.
      const city = TH.city('milan'), g0 = goodPrice(city, 'grain');
      make('famine', city);
      assert(goodPrice(city, 'grain') > g0 * 1.5, 'неурожай не поднял цены');
      return `за год ${started} событий (${[...kinds].join(', ')}), сразу не больше ${maxAt}`;
    },
  },

  {
    name: 'Режим отладки: все кнопки работают',
    async node(page, startPage) {
      await startPage(page);
      await page.keyboard.press('Backquote');
      const open = await page.evaluate(() => topScreen() instanceof DebugScreen && !!document.querySelector('#win .window.debug'));
      if (!open) throw new Error('окно отладки не открылось');
      const r = await page.evaluate(() => {
        const s = topScreen(), p = G.player, click = (act, d = {}) => { s.act(act, d); render(); };
        const str0 = p.stats.str;
        click('stat', { k: 'str', n: 5 });
        if (p.stats.str !== str0 + 5) throw new Error('сила не выросла');
        const lv = p.level; click('level'); if (p.level !== lv + 1) throw new Error('уровень');
        click('coins', { n: 1000 }); click('piety', { n: 100 }); click('god');
        if (p.piety !== 100 || !G.debug.god) throw new Error('благочестие или бессмертие');
        p.hp = -5; checkDeath(); if (p.hp <= 0 || topScreen() !== s) throw new Error('бессмертие не спасло');
        document.getElementById('dbg-item').value = 'vexillum'; click('item');
        if (!p.bag.some(it => it.name.includes('стягом'))) throw new Error('предмет не выдан');
        document.getElementById('dbg-saint').value = 'george'; click('patron');
        click('tab', { i: 1 });
        click('time', { m: 1440 });
        document.getElementById('dbg-beast').value = 'wolf'; click('spawn');
        if (!G.world.actors.some(a => a.key === 'wolf')) throw new Error('волк не появился');
        click('killall'); click('reveal');
        if (G.over.sites.some(x => x.hidden)) throw new Error('не все места открыты');
        const tomb = G.over.sites.find(x => x.dungeon && x.depth > 1 && !DUNGEON_TYPES[x.type].special);
        document.getElementById('dbg-place').value = tomb.id; click('go');
        if (G.world.kind !== 'dungeon' || G.world.site !== tomb) throw new Error('перенос в подземелье');
        pushScreen(new DebugScreen()); const s2 = topScreen(); s2.tab = 1; render();
        s2.act('secrets', {}); s2.act('down', {});
        if (G.world.depth !== 1) throw new Error('спуск');
        pushScreen(new DebugScreen()); const s3 = topScreen(); s3.tab = 2; render();
        s3.act('inferi', { n: 4 }); s3.act('crusade', { n: 2 }); s3.act('raze', {});
        if (storyStage() !== 4 || !hasItem('golden_bough') || crusadeStage() !== 3) throw new Error('стадии заданий');
        s3.act('crusade', { n: 0 }); s3.act('inferi', { n: 0 });
        if (p.quests.some(q => q.id === 'inferi' || q.id === 'crusade')) throw new Error('сброс заданий');
        return `сила ${p.stats.str}, уровень ${p.level}`;
      });
      await page.keyboard.press('Escape');
      return r;
    },
  },

  {
    name: 'Последние язычники: священник → легат → разорение селений → папа',
    run() {
      const p = TH.start();
      TH.immortal();
      // Мало благочестия — священник не предлагает.
      TH.go(TH.city('rome'));
      const pr = () => G.world.villages[0].npcs.find(n => n.role === 'priest');
      assert(!TH.options(pr()).some(o => o.startsWith('Есть ли служба')), 'служба без благочестия');
      p.piety = 60;
      TH.ask(pr(), 'Есть ли служба');
      assert(crusadeStage() === 1 && p.quests.some(q => q.id === 'crusade'), 'не послали к легату');
      // Цель видна: Витербо от Рима — на северо-запад.
      // Дорогу спрашивают у людей: в Риме знают, что Витербо — на северо-запад, по Виа Аврелия.
      const way = TH.ask(G.world.villages[0].npcs.find(n => n.role === 'merchant') || pr(), 'Как добраться до Витербо');
      assert(way && /север/.test(way) && /Виа/.test(way) && p.quests.find(q => q.id === 'crusade').road, 'не объяснили дорогу: ' + way);
      // Легат в Витербо.
      TH.go(TH.city('viterbo'));
      const legate = G.world.villages[0].npcs.find(n => n.special === 'legate');
      assert(legate && legate.name === 'Раньери Капоччи' && npcPortrait(legate) === 'abbot', 'нет легата');
      TH.ask(legate, 'Меня прислал');
      const pagans = paganSites();
      const qt = p.quests.find(q => q.id === 'crusade').text;
      assert(crusadeStage() === 2 && pagans.every(s => s.hidden) && /четыре/.test(qt) && /в (горах|лесах)/.test(qt), 'легат выдал места или не намекнул: ' + qt);
      // Дорогу к язычникам никто не укажет.
      assert(!TH.options(legate).some(o => /Как добраться/.test(o)), 'дорога к язычникам');
      // Разорить все селения.
      for (const v of pagans) {
        leaveLocal(); G.ox = v.x; G.oy = v.y;
        for (let i = 0; i < 60 && v.hidden; i++) spotTombs(v.x, v.y, true);
        assert(!v.hidden && /Найдено/.test(p.quests.find(q => q.id === 'crusade').text), 'найденное селение не попало в журнал');
        overEnter();
        const w = G.world;
        // Фламин теперь не говорит о пути в подземный мир.
        const fl = w.villages[0].npcs.find(n => n.role === 'flamen');
        assert(!fl || /слуга попов/.test(TH.ask(fl, 'Правда ли') || ''), 'фламин всё ещё ведёт к Этне');
        let ai = -1;
        for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === T.PAGAN_ALTAR) { ai = i; break; }
        assert(ai >= 0, `${v.name}: нет алтаря`);
        const ax = ai % w.w, ay = (ai / w.w) | 0;
        const [sx, sy] = DIRS8.map(([dx, dy]) => [ax + dx, ay + dy]).find(([x, y]) => w.walkable(x, y) && !w.actorAt(x, y));
        moveTo(p, sx, sy);
        tryMove(ax - sx, ay - sy);
        assert(w.get(ax, ay) === T.PAGAN_ALTAR, 'алтарь опрокинут без предупреждения');
        moveTo(p, sx, sy);
        tryMove(ax - sx, ay - sy);
        assert(w.get(ax, ay) === T.RUBBLE && v.razing, `${v.name}: алтарь не опрокинут`);
        const foes = w.actors.filter(a => a.razeOf === v.id);
        assert(foes.length >= 2 && !w.villages[0].npcs.length, 'нет защитников или жители остались');
        for (const f of foes) killBeast(f, true);
        assert(v.razed, `${v.name}: не разорено`);
      }
      assert(crusadeStage() === 3, 'после всех селений не зовут к легату');
      // Селение остаётся пустым и после перезахода; на карте — пепелище.
      leaveLocal(); G.ox = pagans[0].x; G.oy = pagans[0].y; overEnter();
      assert(!G.world.villages[0].npcs.length, 'жители вернулись');
      TH.go(TH.city('viterbo'));
      TH.ask(G.world.villages[0].npcs.find(n => n.special === 'legate'), 'Последний алтарь');
      assert(crusadeStage() === 4, 'легат не послал к папе');
      // Папа в Перудже.
      TH.go(TH.city('perugia'));
      const pope = G.world.villages[0].npcs.find(n => n.special === 'pope');
      assert(pope && npcPortrait(pope) === 'pope', 'нет папы');
      assert(/Синибальдо Фиески/.test(historicInfo(pope)) && /Капоччи/.test(historicInfo(legate)) && !historicInfo(pr()), 'нет справки об исторической личности');
      const c0 = p.coins;
      TH.ask(pope, 'Преклонить колено');
      assert(crusadeStage() === 5 && p.coins === c0 + 500 && p.bag.some(it => it.key === 'vexillum' || it.name.includes('стягом')), 'нет награды');
      assert(!p.quests.some(q => q.id === 'crusade') && p.title === 'Защитник веры', 'задание не закрыто');
      // После аудиенции папа уезжает, легат тоже покидает Витербо.
      for (let i = 0; i < 3; i++) endTurn();
      assert(!G.world.actors.some(a => a.special === 'pope'), 'папа не уехал');
      TH.go(TH.city('perugia'));
      assert(!G.world.villages[0].npcs.some(n => n.special === 'pope'), 'папа снова в Перудже');
      TH.go(TH.city('viterbo'));
      assert(!G.world.villages[0].npcs.some(n => n.special === 'legate'), 'легат остался в Витербо');
      // Кто приносил жертвы идолам — тому службы нет.
      p.story.crusade = 0; p.story.inferi = 2;
      TH.go(TH.city('rome'));
      assert(/кадил/.test(TH.ask(pr(), 'Есть ли служба') || '') && crusadeStage() === 0, 'язычнику дали службу');
      return `${pagans.length} селений, награда: копьё и 500 мон.`;
    },
  },

  {
    name: 'Язычники и путь в подземный мир: вся цепочка до Дита',
    run() {
      const p = TH.start();
      TH.immortal();
      const pagans = G.over.sites.filter(s => s.kind === 'pagan');
      assert(pagans.length >= 3 && pagans.every(s => s.hidden), 'селения язычников не спрятаны');
      // Найти селение и поговорить с фламином.
      const v = pagans[0];
      leaveLocal(); G.ox = v.x; G.oy = v.y;
      for (let i = 0; i < 40 && v.hidden; i++) spotTombs(v.x, v.y, true);
      assert(!v.hidden, 'селение не нашлось');
      overEnter();
      assert(G.world.villages[0].city === v, 'не вошли в селение');
      const npcs = G.world.villages[0].npcs, fl = npcs.find(n => n.role === 'flamen');
      assert(fl && npcs.some(n => NAMES.roman.m.includes(n.name) || NAMES.roman.f.includes(n.name)), 'нет фламина или римских имён');
      // Без ветви в Этну не пускает.
      const etna = G.over.sites.find(s => s.id === 'inferi');
      TH.ask(fl, 'Правда ли');
      assert(storyStage() === 1 && p.quests.some(q => q.id === 'inferi'), 'цепочка не началась');
      // Дар: трофей хозяина подземелья.
      takeTrophy({ id: 'gold_mask', name: 'Золотая погребальная маска', value: 100 });
      const pi = p.piety;
      TH.ask(fl, 'Принести в дар');
      assert(storyStage() === 2 && p.piety < pi && !G.over.sites.find(s => s.id === 'sibyl').hidden, 'дар не принят');
      // Пещера Сивиллы: до дна, ветвь.
      const cumae = G.over.sites.find(s => s.id === 'sibyl');
      leaveLocal(); G.ox = cumae.x; G.oy = cumae.y; overEnter();
      const d1 = G.dungeons.sibyl; goToLevel(cumae, d1, 1, 'up');
      let w = G.world;
      killBeast(w.actors.find(a => a.bossOf), true);
      for (const i of [...w.containers.keys()]) openContainer(i % w.w, (i / w.w) | 0);
      assert(hasItem('golden_bough') && storyStage() === 3, 'ветвь не добыта');
      // Назад к фламину.
      leaveLocal(); G.ox = v.x; G.oy = v.y; overEnter();
      TH.ask(G.world.villages[0].npcs.find(n => n.role === 'flamen'), 'Я принёс золотую ветвь');
      assert(storyStage() === 4 && !etna.hidden, 'путь к Этне не открыт');
      // Без ветви не войти.
      const bough = p.bag.find(it => it.key === 'golden_bough');
      p.bag = p.bag.filter(it => it !== bough);
      leaveLocal(); G.ox = etna.x; G.oy = etna.y; overEnter();
      assert(G.mode === 'over', 'пустили в Этну без ветви');
      p.bag.push(bough);
      overEnter();
      assert(G.world.kind === 'dungeon' && G.world.site === etna, 'не вошли в Этну');
      // Шесть кругов: страж у Стикса, Дит на дне.
      const d = G.dungeons.inferi;
      goToLevel(etna, d, 3, 'up');
      const cer = G.world.actors.find(a => a.guardOf);
      assert(cer && cer.key === 'cerberus', 'нет Цербера у Стикса');
      killBeast(cer, true);
      goToLevel(etna, d, 5, 'up');
      w = G.world;
      const dis = w.actors.find(a => a.key === 'dis_pater');
      assert(dis, 'нет Дита');
      killBeast(dis, true);
      for (const i of [...w.containers.keys()]) openContainer(i % w.w, (i / w.w) | 0);
      assert(storyStage() === 5 && !p.quests.some(q => q.id === 'inferi') && hasItem('pluto_helm'), 'финал не засчитан');
      assert(p.chronicle.some(c => c.text.includes('Дита')), 'нет записи в хронике');
      return `${v.name} → Кумы → Этна, уровней ${etna.depth}`;
    },
  },

  {
    name: 'Сохранение и загрузка, возврат после гибели',
    async node(page, startPage) {
      await startPage(page);
      const before = await page.evaluate(async () => {
        const p = G.player;
        p.coins = 777; p.ammo.arrow = 13; p.mount = { kind: 'mule', ration: 0, hungry: 0 };
        p.bag.push(makeItem('sword'));
        TH.go(TH.city('rome'));
        // След в Риме: житель с заданием, сломанная клетка мостовой, предмет на земле.
        const w = G.world, npc = w.villages[0].npcs[0];
        npc.noWorkUntil = 77;
        let spot = null;
        for (let i = 0; i < w.tiles.length && !spot; i++) if (w.tiles[i] === T.COBBLE && !w.actors.some(a => w.idx(a.x, a.y) === i)) spot = [i % w.w, (i / w.w) | 0];
        w.set(spot[0], spot[1], T.STONES);
        w.addItem(spot[0], spot[1], { kind: 'coins', value: 5, name: 'монеты' });
        window.__mark = { npc: npc.name, spot };
        // Событие из слуха с открытым сундуком.
        leaveLocal();
        const lead = G.leads.find(l => l.kind === 'camp') || spawnLead();
        lead.known = true; G.ox = lead.x; G.oy = lead.y; overEnter();
        const lw = G.world, ci = lw.containers && [...lw.containers.keys()][0];
        if (ci !== undefined) openContainer(ci % lw.w, (ci / lw.w) | 0);
        window.__mark.lead = { id: lead.id, opened: ci, mobs: lw.actors.filter(a => a.kind === 'beast').length };
        // Сохраняемся, стоя в Генуе.
        TH.go(TH.city('genoa'));
        G.leads[0].known = true;
        await saveGame();
        localStorage.setItem('mark', JSON.stringify(window.__mark));
        return { name: p.name, coins: p.coins, leads: G.leads.length,
          cities: Object.keys(G.cityMaps).length, bag: p.bag.length };
      });
      await page.reload();
      await page.waitForFunction(() => G.saveMeta, null, { timeout: 5000 });
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => G.player && G.screens[0] instanceof PlayScreen, null, { timeout: 5000 });
      const after = await page.evaluate(() => {
        const p = G.player;
        assert(p instanceof Player && G.over instanceof Overworld, 'классы не восстановлены');
        const mark = JSON.parse(localStorage.getItem('mark'));
        // Карта под героем распакована, остальные ждут своего часа.
        assert(G.mode === 'local' && G.world instanceof World && G.world.placeKey === 'city:genoa' && G.world.actors[0] === p, 'Генуя не восстановлена');
        assert(G.cityMaps.rome.packed, 'Рим не упакован');
        refreshFov(); render();
        // Можно играть дальше.
        leaveLocal(); overMove(1, 0); overMove(-1, 0);
        TH.go(TH.city('rome'));
        const w = G.world, npc = w.villages[0].npcs[0];
        assert(npc.name === mark.npc && npc.noWorkUntil === 77, 'жители Рима другие');
        assert(npc.village.city === w.villages[0].city && w.villages[0].city === TH.city('rome'), 'ссылки разорваны');
        assert(w.get(...mark.spot) === T.STONES, 'изменённая клетка не сохранилась');
        assert((w.items.get(mark.spot.join(',')) || []).some(it => it.value === 5), 'предмет на земле пропал');
        TH.ask(npc, 'Что нового');
        // Место из слуха: тот же сундук открыт, те же обитатели.
        leaveLocal();
        const lead = G.leads.find(l => l.id === mark.lead.id);
        G.ox = lead.x; G.oy = lead.y; overEnter();
        const lw = G.world;
        if (mark.lead.opened != null) assert(!lw.containers.has(mark.lead.opened) && lw.tiles[mark.lead.opened] !== T.CHEST, 'сундук снова закрыт');
        assert(lw.actors.filter(a => a.kind === 'beast').length >= mark.lead.mobs, 'обитатели пропали');
        leaveLocal();
        render();
        return { name: p.name, ox: G.ox, oy: G.oy, turn: G.turn, coins: p.coins, leads: G.leads.length,
          cities: Object.keys(G.cityMaps).length, bag: p.bag.length, ammo: p.ammo.arrow, mount: p.mount.kind, known: G.leads[0].known };
      });
      for (const k of ['name', 'coins', 'leads', 'cities', 'bag'])
        if (before[k] !== after[k]) throw new Error(`${k}: было ${before[k]}, стало ${after[k]}`);
      if (after.ammo !== 13 || after.mount !== 'mule' || !after.known) throw new Error('запасы, мул или слухи потерялись');
      // После гибели можно вернуться к сохранению.
      await page.evaluate(() => { G.player.coins = 1; G.player.hp = 0; checkDeath(); });
      await page.waitForTimeout(900);
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => G.screens[0] instanceof PlayScreen && G.player.hp > 0, null, { timeout: 5000 });
      const back = await page.evaluate(() => G.player.coins);
      if (back !== before.coins) throw new Error(`после гибели загрузилось не то: монет ${back}, ждали ${before.coins}`);
      return `монет ${after.coins}, городов ${after.cities}`;
    },
  },
];
