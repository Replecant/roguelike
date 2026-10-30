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
    name: 'Подземелье: спуск до дна, босс на месте',
    run() {
      const p = TH.start();
      TH.immortal();
      const tombs = G.over.sites.filter(s => s.dungeon);
      assert(tombs.length >= 10 && tombs.every(s => s.hidden && !G.over.placeAt(s.x, s.y)), 'гробницы не спрятаны');
      const t = tombs.find(s => s.depth >= 3) || tombs[0];
      leaveLocal(); G.ox = t.x; G.oy = t.y;
      // Поиск на месте рано или поздно находит вход.
      for (let i = 0; i < 30 && t.hidden; i++) spotTombs(t.x, t.y, true);
      assert(!t.hidden && G.over.placeAt(t.x, t.y) === t, 'гробница не нашлась');
      overEnter();
      assert(G.world.kind === 'dungeon', 'не в подземелье');
      for (let i = 0; i < 8 && G.world.down; i++) {
        const w = G.world, [dx, dy] = w.down;
        p.x = dx - 1; p.y = dy;
        if (!w.walkable(p.x, p.y)) { p.x = dx; p.y = dy - 1; }
        tryMove(Math.sign(dx - p.x), Math.sign(dy - p.y));
      }
      assert(!G.world.down && G.world.actors.some(a => a.key === 'proconsul'), 'нет дна или босса');
      return `${t.name}, уровней ${t.depth}`;
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
        assert(lead, `${kind}: не создано`);
        lead.known = true; G.ox = lead.x; G.oy = lead.y;
        overEnter();
        const w = G.world;
        assert(w.lead === lead, `${kind}: не вошли`);
        for (const m of w.actors.filter(a => a.leadId === lead.id)) killBeast(m, true);
        if (w.containers) for (const i of [...w.containers.keys()]) openContainer(i % w.w, Math.floor(i / w.w));
        if (kind === 'hermit') TH.ask(w.actors.find(a => a.role === 'hermit'), 'Благослови');
        if (kind === 'werewolf') {
          G.minutes += ((22 * 60 - timeInfo().hour * 60) + 1440) % 1440;
          checkDayNight();
          const ww = w.actors.find(a => a.leadId === lead.id);
          assert(ww, 'оборотень не вышел ночью');
          killBeast(ww, true);
        }
        assert(lead.done, `${kind}: не завершено`);
      }
      leaveLocal();
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
      assert(d1.y === 1247 && d1.m === 6 && d1.d === 1, 'начало пути не 1 июня 1247');
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
      if (visible !== 12) throw new Error('нет панели или кнопок');
      // Клик по жителю — подойти и заговорить.
      const npc = await page.evaluate(() => { const w = G.world, p = G.player;
        const n = w.actors.find(a => a.kind === 'npc' && w.isVisible(a.x, a.y) && dist(a, p) > 2); return [n.x, n.y]; });
      const [nx, ny] = await toScreen(npc);
      await page.mouse.click(nx, ny);
      await page.waitForFunction(() => topScreen() instanceof DialogScreen, null, { timeout: 8000 });
      // Ответ кликом по варианту.
      await page.click('#win .opt[data-i="0"]');
      if (!(await page.evaluate(() => topScreen() instanceof DialogScreen && document.querySelector('#win .speech').textContent.length > 3))) throw new Error('диалог');
      await page.keyboard.press('Escape');
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
    name: 'Сохранение и загрузка, возврат после гибели',
    async node(page, startPage) {
      await startPage(page);
      const before = await page.evaluate(async () => {
        const p = G.player;
        p.coins = 777; p.ammo.arrow = 13; p.mount = { kind: 'mule', ration: 0, hungry: 0 };
        p.bag.push(makeItem('sword'));
        TH.go(TH.city('rome'));
        leaveLocal();
        G.ox += 1;
        G.leads[0].known = true;
        await saveGame();
        return { name: p.name, ox: G.ox, oy: G.oy, turn: G.turn, coins: p.coins, leads: G.leads.length,
          cities: Object.keys(G.cityMaps).length, bag: p.bag.length };
      });
      await page.reload();
      await page.waitForFunction(() => G.saveMeta, null, { timeout: 5000 });
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => G.player && G.screens[0] instanceof PlayScreen, null, { timeout: 5000 });
      const after = await page.evaluate(() => {
        const p = G.player;
        assert(p instanceof Player && G.over instanceof Overworld, 'классы не восстановлены');
        assert(Object.values(G.cityMaps).every(w => w instanceof World), 'карты городов');
        // Можно играть дальше.
        overMove(1, 0); overMove(-1, 0);
        TH.go(TH.city('rome'));
        const npc = G.world.villages[0].npcs[0];
        assert(npc.village.city === G.world.villages[0].city, 'ссылки разорваны');
        TH.ask(npc, 'Что нового');
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
      if (back !== 777) throw new Error(`после гибели загрузилось не то: монет ${back}`);
      return `монет ${after.coins}, городов ${after.cities}`;
    },
  },
];
