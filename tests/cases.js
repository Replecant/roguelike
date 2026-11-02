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
        if (c.kind === 'town' || c.kind === 'city') {
          const roles = new Set(w.villages[0].npcs.map(n => n.role));
          for (const r of ['priest', 'elder', 'innkeeper', 'smith', 'herbalist']) assert(roles.has(r), `${c.name}: нет ${r}`);
        }
        const names = w.villages[0].npcs.map(n => n.name);
        assert(new Set(names).size === names.length, `${c.name}: тёзки среди жителей`);
        // С какой стороны ни подойди — входишь по дороге, тропе или пристани, а не в траву.
        if (c.kind !== 'pagan' && !cityPlan(c).lagoon) for (const d of DIRS4) {   // в Венецию — лодкой
          const sp = cityEdgeSpot(w, d), t = sp && w.get(sp[0], sp[1]);
          assert(sp && [T.ROAD, T.COBBLE, T.BRIDGE, T.DIRT, T.PIER].includes(t), `${c.name}: вход с ${d} — ${sp ? w.def(sp[0], sp[1]).name : 'нет места'}`);
        }
        // Деревенская тропа обходит дома: ни один дом не стоит поперёк дороги.
        if (!['town', 'city'].includes(c.kind)) {
          const road = (x, y) => w.inside(x, y) && (w.get(x, y) === T.ROAD || w.get(x, y) === T.BRIDGE);
          const snap = b => { const r = []; for (let y = b.y - 4; y < b.y + b.h + 4; y++) { let q = ''; for (let x = b.x - 8; x < b.x + b.w + 8; x++) { const t = w.get(x, y);
            q += !w.inside(x, y) ? ' ' : w.building[w.idx(x, y)] !== -1 ? '#' : t === T.ROAD ? '=' : t === T.BRIDGE ? 'b' : t === T.DIRT ? ',' : TILES[t].walk ? '.' : 'T'; } r.push(q); } return '\n' + r.join('\n'); };
          for (const b of w.buildings) {
            // Поперёк — дорога упирается в дом с двух сторон по одной прямой (а не огибает его).
            // (Три клетки прямой с обеих сторон: тропа, что огибает дом и отворачивает к нему сверху и снизу, — не в счёт.)
            const line = (x, y, dx, dy) => road(x, y) && road(x + dx, y + dy) && road(x + 2 * dx, y + 2 * dy);
            for (let y = b.y; y < b.y + b.h; y++) assert(!(line(b.x - 1, y, -1, 0) && line(b.x + b.w, y, 1, 0)), `${c.name}: «${b.name}» поперёк дороги` + snap(b));
            for (let x = b.x; x < b.x + b.w; x++) assert(!(line(x, b.y - 1, 0, -1) && line(x, b.y + b.h, 0, 1)), `${c.name}: «${b.name}» поперёк дороги` + snap(b));
          }
        }
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
        assert(!w.actors.some(a => a.kind === 'beast' && !a.hap), `${c.name}: звери в поселении: ${w.actors.filter(a => a.kind === 'beast' && !a.hap).map(a => a.name).join(', ')}`);
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
    name: 'Мальта: острова, лодка из Сиракузы, храм великанов',
    run() {
      TH.start(); TH.immortal();
      const ow = G.over, ids = ['mdina', 'birgu', 'gozo'];
      for (const id of ids) {
        const c = TH.city(id);
        assert(c && ow.regionAt(c.x, c.y) === 'malta', `${id}: не на Мальте`);
      }
      TH.go(TH.city('syracuse'));
      const boat = G.world.villages[0].npcs.find(n => n.role === 'boatman');
      G.player.coins = 100;
      TH.ask(boat, /Отплыть в Биргу/);
      assert(G.world.villages[0].city.id === 'birgu', 'не доплыл до Биргу');
      TH.go(TH.city('mdina'));
      const v = G.world.villages[0];
      assert(v.npcs.find(n => n.role === 'elder').title === 'Каид', 'в Мдине не каид');
      const site = ow.sites.find(x => x.id === 'ggantija');
      leaveLocal(); G.ox = site.x; G.oy = site.y; enterSite(site);
      const w = G.world;
      let alt = -1;
      for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === T.PAGAN_ALTAR) { alt = i; break; }
      assert(alt >= 0, 'в Джгантии нет алтаря');
      const bag0 = G.player.bag.length;
      bumpPaganAltar(alt % w.w, Math.floor(alt / w.w));
      bumpPaganAltar(alt % w.w, Math.floor(alt / w.w));
      assert(G.player.bag.length === bag0 + 1 && G.player.bag.some(it => it.key === 'great_mother'), 'находка не одна');
      return `Мдина ${TH.city('mdina').x},${TH.city('mdina').y}`;
    },
  },
  {
    name: 'Гельвеция: городки, перевалы, свои имена, речи и слухи',
    run() {
      TH.start(); TH.immortal();
      const ow = G.over;
      const ids = ['basel', 'zurich', 'bern', 'lucerne', 'chur', 'fribourg', 'lausanne', 'geneva', 'sion'];
      for (const id of ids) {
        const c = TH.city(id);
        assert(c && ow.regionAt(c.x, c.y) === 'helvetia', `${id}: не в Гельвеции`);
      }
      for (const id of ['aosta', 'como']) assert(ow.regionAt(TH.city(id).x, TH.city(id).y) !== 'helvetia', `${id}: не в Италии`);
      // Через перевалы — дорогой, и дорога не идёт по пикам.
      for (const [a, b] of [['milan', 'lucerne'], ['aosta', 'lausanne'], ['como', 'chur']]) {
        const A = TH.city(a), B = TH.city(b), path = overPath(A.x, A.y, B.x, B.y);
        assert(path && path.length, `нет пути ${a} → ${b}`);
        const onRoad = path.filter(i => ow.road[i] >= 0).length / path.length;
        assert(onRoad > 0.8, `${a} → ${b}: по дороге лишь ${Math.round(onRoad * 100)}%`);
      }
      // Деревни края — со здешними названиями и речью.
      const hamlets = ow.cities.filter(c => c.region === 'helvetia' && ['village', 'castle', 'monastery'].includes(c.kind));
      assert(hamlets.length >= 10, `мало селений: ${hamlets.length}`);
      assert(hamlets.every(c => ['alemannic', 'romand'].includes(c.names)), 'селение без речи');
      assert(!hamlets.some(c => /Рокка|Борго|Казале|Поджо/.test(c.name)), 'итальянское название за перевалом');
      // Цюрих: свои имена, звания, голос и слухи.
      TH.go(TH.city('zurich'));
      const v = G.world.villages[0], all = NAMES.alemannic.m.concat(NAMES.alemannic.f);
      assert(v.npcs.every(n => all.includes(n.name) || n.special), 'в Цюрихе итальянское имя');
      assert(v.npcs.find(n => n.role === 'elder').title === 'Ратсхерр', 'в Цюрихе не ратсхерр');
      const inn = v.npcs.find(n => n.role === 'innkeeper');
      assert(/корчм/.test(inn.title), `трактирщик зовётся «${inn.title}»`);
      const folk = v.npcs.find(n => n.role === 'peasant');
      folk.remarkedPeople = true;   // о родине героя уже сказал — пусть говорит о жизни
      const life = lifeReply(folk), V = LOCAL_VOICE.helvetia;
      assert(Object.values(V.life).flat().concat(Object.values(V.season || {}).flat()).some(t => life.includes(t.slice(0, 20))), 'житель Цюриха говорит не о своём: ' + life);
      const talk = [];
      for (let d = 0; d < 6; d++) { G.minutes += 24 * 60; for (const n of v.npcs) talk.push(newsReply(n)); }
      const pool = V.lore.concat(REGION_RUMORS.helvetia);
      assert(talk.some(t => pool.some(r => t.includes(r.slice(0, 20)))), 'ни одного здешнего слуха');
      const it = talk.find(t => /подест|остери/i.test(t));
      assert(!it, 'в Цюрихе говорят об итальянском: ' + it);
      TH.go(TH.city('lausanne'));
      assert(G.world.villages[0].npcs.every(n => NAMES.romand.m.concat(NAMES.romand.f).includes(n.name) || n.special), 'в Лозанне не романские имена');
      // Атлас открывается на листе своего края, Tab листает.
      leaveLocal(); const zc = TH.city('zurich'); G.ox = zc.x; G.oy = zc.y;
      const atlas = new MapScreen();
      assert(ATLAS_SHEETS[atlas.sheet].id === 'helvetia', 'атлас в Цюрихе открыт не на Гельвеции');
      pushScreen(atlas); render();
      handleKey({ key: 'Tab', code: 'Tab', shift: false });
      assert(topScreen() === atlas && ATLAS_SHEETS[atlas.sheet].id !== 'helvetia', 'Tab не листает атлас');
      for (let k = 1; k < ATLAS_SHEETS.length; k++) handleKey({ key: 'Tab', code: 'Tab', shift: false });
      assert(ATLAS_SHEETS[atlas.sheet].id === 'helvetia', 'листы не идут по кругу');
      handleKey({ key: 'Escape', code: 'Escape', shift: false });
      assert(topScreen() !== atlas, 'атлас не закрылся');
      const rc = TH.city('rome'); G.ox = rc.x; G.oy = rc.y;
      assert(ATLAS_SHEETS[new MapScreen().sheet].id === 'italia', 'атлас в Риме открыт не на Италии');
      return `селений ${hamlets.length}, вести и слухи — свои, атлас листается`;
    },
  },
  {
    name: 'Карантания: городки, дороги, словенские сёла, свои речи и слухи',
    run() {
      TH.start(); TH.immortal();
      const ow = G.over;
      const ids = ['villach', 'stveit', 'friesach', 'klagenfurt', 'ljubljana', 'kranj', 'kamnik', 'kostanjevica', 'celje', 'maribor', 'ptuj'];
      for (const id of ids) {
        const c = TH.city(id);
        assert(c && ow.regionAt(c.x, c.y) === 'carantania', `${id}: не в Карантании`);
      }
      for (const id of ['gemona', 'trieste']) assert(!FOREIGN_REGIONS.includes(ow.regionAt(TH.city(id).x, TH.city(id).y)), `${id}: не в Италии`);
      // Истрия к югу от Триеста — чужая земля, а не море.
      const [ix, iy] = geoToXY(13.9, 45.3).map(Math.floor);
      assert(ow.get(ix, iy) === OT.BORDER, 'Истрия — море');
      for (const [a, b] of [['aquileia', 'villach'], ['aquileia', 'ljubljana'], ['klagenfurt', 'kranj'], ['ljubljana', 'ptuj']]) {
        const A = TH.city(a), B = TH.city(b), path = overPath(A.x, A.y, B.x, B.y);
        assert(path && path.length, `нет пути ${a} → ${b}`);
        const onRoad = path.filter(i => ow.road[i] >= 0).length / path.length;
        assert(onRoad > 0.8, `${a} → ${b}: по дороге лишь ${Math.round(onRoad * 100)}%`);
      }
      const hamlets = ow.cities.filter(c => c.region === 'carantania' && ['village', 'castle', 'monastery'].includes(c.kind));
      assert(hamlets.length >= 10, `мало селений: ${hamlets.length}`);
      assert(!hamlets.some(c => /Рокка|Борго|Казале|Поджо/.test(c.name)), 'итальянское название в Карантании');
      // Деревня: словенские имена, жупан, корчмарь.
      const vil = hamlets.find(c => c.kind === 'village' && c.names === 'slovene');
      TH.go(vil);
      const vv = G.world.villages[0];
      assert(vv.npcs.every(n => NAMES.slovene.m.concat(NAMES.slovene.f).includes(n.name) || n.special), 'в словенском селе чужие имена');
      assert(vv.npcs.find(n => n.role === 'elder').title === 'Жупан', 'в селе не жупан');
      // Любляна: судья герцога, свой голос и слухи.
      TH.go(TH.city('ljubljana'));
      const v = G.world.villages[0];
      assert(v.npcs.find(n => n.role === 'elder').title === 'Судья герцога', 'в Любляне не судья');
      const folk = v.npcs.find(n => n.role === 'peasant'), V = LOCAL_VOICE.carantania;
      folk.remarkedPeople = true;
      const lr = lifeReply(folk);
      assert(Object.values(V.life).flat().concat(Object.values(V.season || {}).flat()).some(t => lr.includes(t.slice(0, 20))), 'житель Любляны говорит не о своём: ' + lr);
      const talk = [];
      for (let d = 0; d < 6; d++) { G.minutes += 24 * 60; for (const n of v.npcs) talk.push(newsReply(n)); }
      assert(talk.some(t => V.lore.concat(REGION_RUMORS.carantania).some(r => t.includes(r.slice(0, 20)))), 'ни одного здешнего слуха');
      const it = talk.find(t => /подест|остери/i.test(t));
      assert(!it, 'в Любляне говорят об итальянском: ' + it);
      // Атлас: свой лист.
      leaveLocal(); const lj = TH.city('ljubljana'); G.ox = lj.x; G.oy = lj.y;
      assert(ATLAS_SHEETS[new MapScreen().sheet].id === 'carantania', 'атлас в Любляне не на Карантании');
      return `селений ${hamlets.length}, вести и слухи — свои`;
    },
  },
  {
    name: 'Лионне: Лион и округа — города, Рона и Сона, сёла, речи, атлас, курия и папа',
    run() {
      TH.start(); TH.immortal();
      const ow = G.over;
      for (const id of ['lyon', 'vienne', 'villefranche', 'montbrison', 'bourg', 'grenoble']) {
        const c = TH.city(id);
        assert(c && ow.regionAt(c.x, c.y) === 'lyonnais', `${id}: не в Лионне`);
      }
      assert(TH.city('valence').region === 'provence', 'Валанс ушёл из Прованса');
      // Дороги: вверх по Роне из Прованса, в Форе, Божоле, к Женеве.
      for (const [a, b] of [['valence', 'lyon'], ['lyon', 'montbrison'], ['lyon', 'villefranche'], ['lyon', 'geneva'], ['vienne', 'grenoble']]) {
        const A = TH.city(a), B = TH.city(b), path = overPath(A.x, A.y, B.x, B.y);
        assert(path && path.length, `нет пути ${a} → ${b}`);
        const onRoad = path.filter(i => ow.road[i] >= 0).length / path.length;
        assert(onRoad > 0.7, `${a} → ${b}: по дороге лишь ${Math.round(onRoad * 100)}%`);
      }
      const v0 = TH.city('viterbo'), ly = TH.city('lyon');
      assert(overPath(v0.x, v0.y, ly.x, ly.y), 'из Витербо до Лиона не дойти');
      const hamlets = ow.cities.filter(c => c.region === 'lyonnais' && ['village', 'castle', 'monastery'].includes(c.kind));
      assert(hamlets.length >= 6, `мало селений: ${hamlets.length}`);
      assert(!hamlets.some(c => /Рокка|Борго|Казале|Поджо/.test(c.name)), 'итальянское название в Лионне');
      const vil = hamlets.find(c => c.kind === 'village');
      if (vil) { TH.go(vil); assert(TH.npc('elder').title === 'Прево', 'в селе не прево'); }
      // Лион: собор Сен-Жан, клуатр Сен-Жюст, Пьер-Сиз; свои имена, речи и слухи.
      TH.go(ly);
      const names = G.world.buildings.map(b => b.name);
      for (const n of ['Собор Сен-Жан', 'Клуатр Сен-Жюст', 'Пьер-Сиз']) assert(names.includes(n), `в Лионе нет: ${n}`);
      const v = G.world.villages[0];
      assert(v.npcs.find(n => n.role === 'elder').title === 'Бальи архиепископа', 'в Лионе не бальи');
      const folk = v.npcs.find(n => n.role === 'peasant'), V = LOCAL_VOICE.lyonnais;
      folk.remarkedPeople = true;
      const lr = lifeReply(folk);
      assert(Object.values(V.life).flat().concat(Object.values(V.season || {}).flat()).some(t => lr.includes(t.slice(0, 20))), 'лионец говорит не о своём: ' + lr);
      const talk = [];
      for (let d = 0; d < 6; d++) { G.minutes += 24 * 60; for (const n of v.npcs) talk.push(newsReply(n)); }
      assert(talk.some(t => V.lore.concat(REGION_RUMORS.lyonnais).some(r => t.includes(r.slice(0, 20)))), 'ни одного здешнего слуха');
      // Папа — в Лионе (цепочка язычников ведёт сюда), в клуатре Сен-Жюст.
      assert(POPE_CITY === 'lyon', 'папа не в Лионе');
      G.player.story = G.player.story || {}; G.player.story.crusade = 4;
      TH.go(TH.city('vienne')); TH.go(ly);
      const pope = G.world.villages[0].npcs.find(n => n.special === 'pope');
      const cl = G.world.buildings.find(b => b.name === 'Клуатр Сен-Жюст');
      assert(pope && pope.home.building === cl.id, 'папа не в клуатре Сен-Жюст');
      // Звери: вуивра, лу-гару; гробницы Лугдунума; дозор архиепископа.
      assert(beastInRegion(BEASTS.vouivre, 'lyonnais') && beastLocal(BEASTS.werewolf, 'lyonnais').name === 'Лу-гару', 'звери Лионне');
      assert(ow.sites.some(s => s.type === 'roman' && s.region === 'lyonnais'), 'нет римских гробниц в Лионне');
      leaveLocal(); G.ox = ly.x; G.oy = ly.y; G.travelers = [];
      let t = null; for (let k = 0; k < 40 && !t; k++) t = spawnTraveler('archbishop', G.ox, G.oy, true);
      assert(t, 'нет дозора архиепископа');
      assert(ATLAS_SHEETS[new MapScreen().sheet].id === 'lyonnais', 'атлас в Лионе не на своём листе');
      return `селений ${hamlets.length}`;
    },
  },
  {
    name: 'Савойя: дорога Турин — Мон-Сени — Лион, перевалы, городки, речи, атлас, обвал Гранье',
    run() {
      TH.start(); TH.immortal();
      const ow = G.over;
      for (const id of ['chambery', 'stjean', 'moutiers', 'annecy']) {
        const c = TH.city(id);
        assert(c && ow.regionAt(c.x, c.y) === 'savoy', `${id}: не в Савойе`);
      }
      // Главное — дорога из Италии в Лион через Мон-Сени, вся по тракту и короче обхода через Прованс.
      const route = (a, b) => { const A = TH.city(a), B = TH.city(b), p = overPath(A.x, A.y, B.x, B.y); return p; };
      const tl = route('turin', 'lyon');
      assert(tl && tl.filter(i => ow.road[i] >= 0).length / tl.length > 0.9, 'из Турина в Лион не по дороге');
      assert(tl.some(i => ow.regionAt(i % ow.w, (i / ow.w) | 0) === 'savoy'), 'путь Турин — Лион идёт не через Савойю');
      for (const [a, b] of [['chambery', 'geneva'], ['moutiers', 'aosta'], ['susa', 'stjean']]) assert(route(a, b), `нет пути ${a} → ${b}`);
      const hospice = ow.cities.find(c => c.name === 'Мон-Сени');
      assert(hospice && hospice.region === 'savoy', 'нет приюта на Мон-Сени');
      // Город: шатлен, свой голос и слухи; Сен-Жан — мощи Крестителя.
      TH.go(TH.city('chambery'));
      const v = G.world.villages[0];
      assert(v.npcs.find(n => n.role === 'elder').title === 'Шатлен графа', 'в Шамбери не шатлен');
      const V = LOCAL_VOICE.savoy, talk = [];
      for (let d = 0; d < 6; d++) { G.minutes += 24 * 60; for (const n of v.npcs) talk.push(newsReply(n)); }
      assert(talk.some(t => V.lore.concat(REGION_RUMORS.savoy).some(r => t.includes(r.slice(0, 20)))), 'ни одного здешнего слуха');
      TH.go(TH.city('stjean'));
      assert(G.world.buildings.some(b => b.name === 'Собор Святого Иоанна Крестителя'), 'в Сен-Жане нет собора');
      // Обвал Гранье — весть 25 ноября 1248-го.
      assert(LAND_NEWS.some(n => /Гранье/.test(n.text) && n.at && n.at[0] === 1248 && n.at[1] === 11), 'нет вести об обвале Гранье');
      // Звери, дозор, атлас.
      assert(beastInRegion(BEASTS.ibex, 'savoy') && beastInRegion(BEASTS.vouivre, 'savoy') && beastLocal(BEASTS.werewolf, 'savoy').name === 'Лу-гару', 'звери Савойи');
      leaveLocal(); const ch = TH.city('chambery'); G.ox = ch.x; G.oy = ch.y; G.travelers = [];
      let t = null; for (let k = 0; k < 40 && !t; k++) t = spawnTraveler('savoyard', G.ox, G.oy, true);
      assert(t, 'нет людей шатлена на дорогах');
      assert(ATLAS_SHEETS[new MapScreen().sheet].id === 'savoy', 'атлас в Шамбери не на своём листе');
      return `путь Турин — Лион: ${tl.length} кл.`;
    },
  },
  {
    name: 'Времена года: весной зелень, летом юг выгорает и хлеб золотой, осенью лес желтеет, зимой поля голы',
    run() {
      TH.start();
      const at = (y, m, d) => { G.minutes = (dayOfDate(y, m, d) - 1) * 1440 + 13 * 60 - START_MINUTE; };
      const rgb = c => hexToRgb(c), yellow = c => { const [r, g, b] = rgb(c); return r - b; }, green = c => { const [r, g] = rgb(c); return g - r; };
      const grass = TILES[T.GRASS].fg[0], wood = TILES[T.FOREST].fg[0], field = OTILES[OT.FIELD].fg[0];
      at(1248, 4, 20); const aprN = seasonTint('grass', false, grass), aprField = seasonTint('crop', false, field);
      at(1247, 7, 25); const julN = seasonTint('grass', false, grass), julS = seasonTint('grass', true, grass), julField = seasonTint('crop', false, field), julWood = seasonTint('leaf', false, wood);
      at(1247, 10, 20); const octWood = seasonTint('leaf', false, wood), octField = seasonTint('crop', false, field);
      at(1248, 1, 15); const janS = seasonTint('grass', true, grass), janWood = seasonTint('leaf', false, wood);
      assert(green(aprN) > green(julN) - 5, `весной трава не свежее: ${aprN} / ${julN}`);
      assert(yellow(julS) > yellow(julN) + 30, `юг летом не выгорел: ${julS} / ${julN}`);
      assert(green(janS) > green(julS) + 20, `юг зимой не зеленеет: ${janS} / ${julS}`);
      assert(green(aprField) > green(julField) + 30 && yellow(julField) > yellow(aprField) + 30, `хлеб: весной ${aprField}, летом ${julField}`);
      assert(yellow(octWood) > yellow(julWood) + 30, `лес осенью не пожелтел: ${octWood} / ${julWood}`);
      assert(green(janWood) < green(julWood) - 30, `лес зимой не гол: ${janWood} / ${julWood}`);
      assert(hexToRgb(octField)[1] < hexToRgb(julField)[1], `пашня осенью не вспахана: ${octField}`);
      // Апулия — сухой край, Эмилия — нет; подземелья не перекрашиваются.
      const bari = TH.city('bari'), bol = TH.city('bologna');
      assert(dryAt(G.over, bari.x, bari.y) && !dryAt(G.over, bol.x, bol.y), 'сухой край определён неверно');
      assert(!SEASON_CAT_LOCAL[T.TOMBFLOOR] && !SEASON_CAT_LOCAL[T.CROP], 'перекрашивается не то');
      // Голые деревья: зимой на севере — ветви без листвы, в конце ноября — редкий лист; на юге дубы не облетают.
      at(1248, 1, 15); const janBare = leafBare(false), janSouth = leafBare(true);
      at(1247, 11, 22); const novBare = leafBare(false);
      at(1247, 7, 25); const julBare = leafBare(false);
      assert(janBare === 2 && novBare === 1 && julBare === 0 && janSouth === 0, `голые деревья: янв ${janBare}, ноя ${novBare}, июл ${julBare}, юг ${janSouth}`);
      // Пашня по сезонам: зимой борозды, весной всходы, в июле колос, в конце августа стерня, в октябре пахота; на юге зимой — всходы.
      const fs = (y, m, d, south) => { at(y, m, d); return fieldSprite(south); };
      const want = [[1248, 1, 15, false, 'furrows'], [1248, 4, 20, false, 'shoots'], [1247, 7, 10, false, 'crops'], [1247, 8, 25, false, 'stubble'],
        [1247, 10, 20, false, 'furrows'], [1248, 1, 15, true, 'shoots'], [1247, 8, 10, true, 'stubble']];
      for (const [y, m, d, south, sp] of want) assert(fs(y, m, d, south) === sp, `пашня ${d}.${m} (${south ? 'юг' : 'север'}): ${fieldSprite(south)}, а надо ${sp}`);
      assert(tileSprite(T.TALLGRASS) === 'tallgrass' && tileSprite(T.GARDEN) === 'garden', 'высокая трава и огород рисуются колосьями');
      // Луг на севере зимой — бурый, а не зелёный.
      at(1248, 1, 15); const janN = seasonTint('grass', false, grass);
      assert(green(janN) < green(julN) - 25, `луг зимой зелёный: ${janN} / ${julN}`);
      at(1248, 1, 15);
      TH.go(bol); leaveLocal();
      while (G.screens.length > 1) popScreen();
      TILE_MODE = true; render();
      assert(G.term.sprites.includes('treebare'), 'зимой у Болоньи лес на карте не голый');
      return `трава у Бари в июле ${julS}, лес в октябре ${octWood}`;
    },
  },
  {
    name: 'Обозы и телеги на дороге: товар сочтён — что на возу, то и есть, за ночь новое не появляется',
    run() {
      TH.start(); TH.immortal();
      const p = G.player; p.coins = 100000;
      for (const kind of ['caravan', 'peasants']) {
        let t = null;
        for (let k = 0; k < 40 && !t; k++) t = spawnTraveler(kind, G.ox, G.oy, true);
        assert(t, `нет путника ${kind}`);
        G.travelers.push(t);
        const npc = travelerNpc(t), d = traderGoods(npc);
        if (kind === 'caravan') assert(d.sells.length >= 2 && d.sells.length <= 3, `обоз везёт всё на свете: ${d.sells}`);
        const scr = new TradeScreen(npc);
        // Скупить всё дочиста — и провиант, и товар, и снаряжение.
        // Котомку освобождаем перед каждой покупкой — упираться в вес не должны.
        for (let round = 0; round < 4; round++) for (const r of scr.rows(0)) if (r.buy) { p.goods = {}; p.rations = 0; p.bag = []; p.ammo = {}; r.buy(1000); }
        const left = scr.rows(0).filter(r => r.qty === '∞' || r.qty > 0);
        assert(!left.length, `${kind}: не кончается — ${left.map(r => `${r.label} ${r.qty}`).join(', ')}`);
        // Через три дня у того же воза — всё так же пусто.
        G.minutes += 3 * 1440;
        const again = new TradeScreen(travelerNpc(t)).rows(0).filter(r => r.qty === '∞' || r.qty > 0);
        assert(!again.length, `${kind}: товар сам пополнился в пути — ${again.map(r => r.label).join(', ')}`);
      }
      // У лавки в городе провиант по-прежнему без счёта.
      TH.go(TH.city('florence'));
      const m = G.world.villages[0].npcs.find(n => n.role === 'merchant');
      assert(new TradeScreen(m).rows(0).some(r => r.qty === '∞'), 'в городе провиант стал сочтённым');
      return 'ok';
    },
  },
  {
    name: 'Старые сохранения: карта помнит свою рамку и порядок земель — расширение карты их не сдвигает',
    run() {
      TH.start();
      const ow = G.over;
      assert(ow.geo && ow.geo.lon0 === WORLD_GEO.lon0 && ow.regionIds && ow.regionIds.length === REGION_IDS.length, 'новая карта не помнит рамку');
      // Карта до расширения: без рамки и без порядка земель; Тироля и Далмации в ней не было.
      const old = { cities: [{ region: 'languedoc' }, { region: 'tuscany' }] };
      adoptOverworldFrame(old);
      assert(GEO.lon0 === LEGACY_GEO.lon0 && !old.regionIds.includes('tyrol') && old.regionIds[old.regionIds.length - 1] === 'languedoc', 'старая карта: рамка или порядок земель не те');
      // Карта с Тиролем, но до расширения: Лангедок — после Далмации.
      const mid = { cities: [{ region: 'tyrol' }] };
      adoptOverworldFrame(mid);
      assert(mid.regionIds.indexOf('languedoc') === mid.regionIds.indexOf('dalmatia') + 1, 'порядок земель карты с Тиролем не тот');
      // Своя рамка — своя: координаты Флоренции на старой карте — по старой рамке.
      useGeo(LEGACY_GEO);
      const xOld = geoToXY(11.25, 43.77)[0];
      adoptOverworldFrame(ow);
      const xNew = geoToXY(11.25, 43.77)[0];
      assert(xNew - xOld > 50, `рамка не сменилась: ${xOld} → ${xNew}`);
      return `Флоренция: x ${Math.round(xOld)} → ${Math.round(xNew)}`;
    },
  },
  {
    name: 'Звук: шум дождя в дождь и грозу, под землёй — тишина; D — громко, тихо, выкл',
    async run() {
      TH.start(); TH.immortal();
      G.weather = { kind: 'clear', until: G.minutes + 600 };
      assert(audioScene().rain === 0, 'дождь шумит в ясную погоду');
      G.weather.kind = 'rain'; assert(audioScene().rain > 0 && audioScene().rain < 1, 'дождь не шумит вполголоса');
      G.weather.kind = 'storm'; assert(audioScene().rain === 1, 'в грозу дождь не в полную силу');
      const site = G.over.sites.find(s => s.dungeon);
      G.ox = site.x; G.oy = site.y; enterSite(site);
      assert(G.world.kind === 'dungeon' && audioScene().rain === 0, 'в подземелье слышен дождь');
      leaveLocal();
      assert(/^sounds\/rain\.(ogg|mp3)$/.test(soundUrl('rain')), 'запись дождя не из sounds/');
      // Звук просыпается с первым нажатием; слой дождя готов и набирает громкость.
      AUDIO.on = true; AUDIO.vol = 0.8;
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX' }));
      for (let k = 0; k < 40 && !AUDIO.layers.rain.ready; k++) await new Promise(r => setTimeout(r, 50));
      assert(AUDIO.layers.rain.ready, 'запись дождя не загрузилась');
      audioTick();
      const before = [AUDIO.on, AUDIO.vol];
      audioCycle(); const quiet = AUDIO.on && AUDIO.vol < 0.5;
      audioCycle(); const off = !AUDIO.on;
      audioCycle(); const loud = AUDIO.on && AUDIO.vol > 0.5;
      assert(quiet && off && loud, `D не переключает громкость: ${before} → тихо ${quiet}, выкл ${off}, громко ${loud}`);
      return `запись: ${soundUrl('rain')}, ${AUDIO.layers.rain.el ? 'через <audio>' : 'через Web Audio'}`;
    },
  },
  {
    name: 'Земли из реестра: городки на месте, дороги проходимы, свои речи, слухи, дозор, атлас, звери',
    run() {
      TH.start(); TH.immortal();
      const ow = G.over, out = [];
      for (const [id, d] of Object.entries(LAND_DEFS)) {
        const T0 = d.test || {};
        for (const c of (T0.towns || []).map(x => TH.city(x))) assert(c && (ow.regionAt(c.x, c.y) === id || (d.split && LAND_DEFS[ow.regionAt(c.x, c.y)])), `${id}: ${c && c.name} не на своей земле (${c && ow.regionAt(c.x, c.y)})`);
        for (const [a, b] of T0.routes || []) {
          const A = TH.city(a), B = TH.city(b), path = A && B && overPath(A.x, A.y, B.x, B.y);
          assert(path, `${id}: нет пути ${a} → ${b}`);
          const onRoad = path.filter(i => ow.road[i] >= 0).length / path.length;
          assert(onRoad > 0.8, `${id}: ${a} → ${b} по дороге лишь ${Math.round(onRoad * 100)}%`);
        }
        for (const f of T0.famous || []) assert(ow.cities.some(c => c.name === f), `${id}: нет места «${f}»`);
        // Речи, слухи, имена, дозор, атлас, сухой юг.
        const regs = d.split ? [] : [id];
        for (const r of regs) {
          assert(LOCAL_VOICE[r] && LOCAL_VOICE[r].lore.length && REGION_RUMORS[r] && REGION_RUMORS[r].length, `${r}: нет речей или слухов`);
          assert(REGION_IN[r] && REGION_GEN[r] && REGION_LATIN[r], `${r}: нет названий земли`);
          assert(ATLAS_SHEETS.some(s => s.only && s.only.includes(r)), `${r}: нет листа атласа`);
          assert(ow.cities.some(c => c.region === r && ['village', 'castle', 'monastery'].includes(c.kind) && c.names && NAMES[c.names]), `${r}: нет селений со своей речью`);
        }
        if (d.patrol) {
          const c = (T0.towns || []).map(x => TH.city(x)).find(Boolean);
          G.ox = c.x; G.oy = c.y; G.travelers = [];
          let t = null; for (let k = 0; k < 40 && !t; k++) t = spawnTraveler(d.patrol.key, G.ox, G.oy, true);
          assert(t, `${id}: дозор не ходит`);
        }
        for (const b of d.beasts || []) assert(beastInRegion(BEASTS[b], id), `${id}: не водится ${b}`);
        out.push(`${REGIONS[id].name}: ${ow.cities.filter(c => c.region === id).length} мест`);
      }
      return out.join(', ');
    },
  },
  {
    name: 'Далмация: берег — суша, а не море; города, острова, морские пути, речи, атлас',
    run() {
      TH.start(); TH.immortal();
      const ow = G.over;
      for (const id of ['zara', 'sebenico', 'trau', 'spalato', 'ragusa', 'veglia', 'arbe', 'lesina', 'curzola']) {
        const c = TH.city(id);
        assert(c && ow.regionAt(c.x, c.y) === 'dalmatia', `${id}: не в Далмации`);
      }
      // Берег от Зары до Рагузы — суша; за горами — чужие земли, а не море.
      for (const [lon, lat, what] of [[15.5, 44.0, 'Равни Котари'], [16.6, 43.6, 'Загора над Спалато'], [18.05, 42.78, 'берег у Рагузы']]) {
        const [x, y] = geoToXY(lon, lat);
        assert(ow.get(Math.floor(x), Math.floor(y)) !== OT.SEA, `${what} — море`);
      }
      for (const [lon, lat, what] of [[17.0, 44.3, 'Босния'], [18.4, 43.5, 'Хум']]) {
        const [x, y] = geoToXY(lon, lat);
        assert(ow.get(Math.floor(x), Math.floor(y)) === OT.BORDER, `${what} — не чужая земля`);
      }
      // Побережье связано дорогой; острова — лишь морем, и к каждому городу ходит лодка.
      const route = (a, b) => { const A = TH.city(a), B = TH.city(b); return overPath(A.x, A.y, B.x, B.y); };
      const zr = route('zara', 'ragusa');
      assert(zr && zr.filter(i => ow.road[i] >= 0).length / zr.length > 0.9, 'из Зары в Рагузу не по дороге');
      assert(!route('zara', 'lesina'), 'на Лезину можно дойти пешком');
      assert(!route('spalato', 'trieste'), 'из Далмации в Карантанию можно дойти пешком — через чужие горы');
      for (const id of ['zara', 'spalato', 'ragusa', 'veglia', 'arbe', 'lesina', 'curzola'])
        assert(SEA_ROUTES.some(([a, b]) => a === id || b === id), `в ${id} не ходят корабли`);
      assert(landmass('dalmatia') !== landmass('veneto'), 'Далмация — та же суша, что Италия');
      // Город: свой старший, голос и слухи; в Спалато — дворец Диоклетиана, в Трау — собор с порталом Радована.
      TH.go(TH.city('spalato'));
      const v = G.world.villages[0];
      assert(v.npcs.find(n => n.role === 'elder').title === 'Подеста', 'в Спалато не подеста');
      assert(G.world.buildings.some(b => b.name === 'Собор Святого Дуйма'), 'в Спалато нет собора Святого Дуйма');
      const V = LOCAL_VOICE.dalmatia, talk = [];
      for (let d = 0; d < 6; d++) { G.minutes += 24 * 60; for (const n of v.npcs) talk.push(newsReply(n)); }
      assert(talk.some(t => V.lore.concat(REGION_RUMORS.dalmatia).some(r => t.includes(r.slice(0, 20)))), 'ни одного здешнего слуха');
      TH.go(TH.city('trau'));
      assert(G.world.buildings.some(b => b.name === 'Собор Святого Лаврентия'), 'в Трау нет собора');
      assert(beastLocal(BEASTS.strega, 'dalmatia').name === 'Вештица' && beastLocal(BEASTS.werewolf, 'dalmatia').name === 'Вукодлак', 'звери Далмации');
      leaveLocal(); const sp = TH.city('spalato'); G.ox = sp.x; G.oy = sp.y; G.travelers = [];
      let t = null; for (let k = 0; k < 40 && !t; k++) t = spawnTraveler('ban', G.ox, G.oy, true);
      assert(t, 'нет людей бана на дорогах');
      assert(ATLAS_SHEETS[new MapScreen().sheet].id === 'dalmatia', 'атлас в Спалато не на своём листе');
      return `путь Зара — Рагуза: ${zr.length} кл.`;
    },
  },
  {
    name: 'Тироль: Бреннерская дорога Верона — Тренто — Боцен — Бриксен — Инсбрук, Пустерталь, речи, атлас',
    run() {
      TH.start(); TH.immortal();
      const ow = G.over;
      for (const id of ['innsbruck', 'bozen', 'brixen']) {
        const c = TH.city(id);
        assert(c && ow.regionAt(c.x, c.y) === 'tyrol', `${id}: не в Тироле`);
      }
      assert(ow.regionAt(TH.city('trento').x, TH.city('trento').y) !== 'tyrol', 'Тренто ушёл в Тироль');
      const route = (a, b) => { const A = TH.city(a), B = TH.city(b); return overPath(A.x, A.y, B.x, B.y); };
      const vi = route('verona', 'innsbruck');
      assert(vi && vi.filter(i => ow.road[i] >= 0).length / vi.length > 0.9, 'из Вероны в Инсбрук не по дороге');
      const brenner = ow.cities.find(c => c.name === 'Бреннер');
      assert(brenner && vi.some(i => Math.max(Math.abs(i % ow.w - brenner.x), Math.abs(((i / ow.w) | 0) - brenner.y)) <= 3), 'путь в Инсбрук идёт не через Бреннер');
      assert(route('brixen', 'villach'), 'нет Пустертальской дороги в Карантанию');
      TH.go(TH.city('bozen'));
      const v = G.world.villages[0];
      assert(v.npcs.find(n => n.role === 'elder').title === 'Судья епископа', 'в Боцене не судья епископа');
      const V = LOCAL_VOICE.tyrol, talk = [];
      for (let d = 0; d < 6; d++) { G.minutes += 24 * 60; for (const n of v.npcs) talk.push(newsReply(n)); }
      assert(talk.some(t => V.lore.concat(REGION_RUMORS.tyrol).some(r => t.includes(r.slice(0, 20)))), 'ни одного здешнего слуха');
      assert(LAND_NEWS.some(n => /Андексов/.test(n.text) && n.at && n.at[0] === 1248), 'нет вести о смерти последнего Андекса');
      assert(beastInRegion(BEASTS.ibex, 'tyrol') && beastLocal(BEASTS.werewolf, 'tyrol').name === 'Вервольф', 'звери Тироля');
      leaveLocal(); const bz = TH.city('bozen'); G.ox = bz.x; G.oy = bz.y; G.travelers = [];
      let t = null; for (let k = 0; k < 40 && !t; k++) t = spawnTraveler('tyrolean', G.ox, G.oy, true);
      assert(t, 'нет людей графа на дорогах');
      assert(ATLAS_SHEETS[new MapScreen().sheet].id === 'tyrol', 'атлас в Боцене не на своём листе');
      return `путь Верона — Инсбрук: ${vi.length} кл.`;
    },
  },
  {
    name: 'Юг Франции: Прованс и Лангедок — города, Рона, Пиренеи, свои речи и слухи',
    run() {
      TH.start(); TH.immortal();
      const ow = G.over;
      const prov = ['marseille', 'arles', 'avignon', 'aix', 'nice', 'toulon', 'orange', 'valence'];
      const lang = ['toulouse', 'carcassonne', 'narbonne', 'beziers', 'montpellier', 'nimes', 'aiguesmortes', 'albi', 'cahors'];
      for (const id of prov) { const c = TH.city(id); assert(c && ow.regionAt(c.x, c.y) === 'provence', `${id}: не в Провансе (${c && ow.regionAt(c.x, c.y)})`); }
      for (const id of lang) { const c = TH.city(id); assert(c && ow.regionAt(c.x, c.y) === 'languedoc', `${id}: не в Лангедоке (${c && ow.regionAt(c.x, c.y)})`); }
      // За Пиренеями — земли Арагонской короны, а Кастилия за ними — чужая суша, а не море.
      for (const [lon, lat, what] of [[1.5, 42.0, 'Каталония'], [-1.0, 41.0, 'Арагон']]) {
        const [x, y] = geoToXY(lon, lat).map(Math.floor);
        assert(ow.get(x, y) !== OT.SEA && ow.get(x, y) !== OT.BORDER, `${what} — не своя суша`);
      }
      { const [x, y] = geoToXY(-2.2, 41.0).map(Math.floor); assert(ow.get(x, y) === OT.BORDER, 'Кастилия — не чужая земля'); }
      for (const [a, b] of [['genoa', 'nice'], ['arles', 'narbonne'], ['narbonne', 'toulouse'], ['avignon', 'valence'], ['aix', 'marseille']]) {
        const A = TH.city(a), B = TH.city(b), path = overPath(A.x, A.y, B.x, B.y);
        assert(path && path.length, `нет пути ${a} → ${b}`);
        const onRoad = path.filter(i => ow.road[i] >= 0).length / path.length;
        assert(onRoad > 0.8, `${a} → ${b}: по дороге лишь ${Math.round(onRoad * 100)}%`);
      }
      const hamlets = ow.cities.filter(c => ['provence', 'languedoc'].includes(c.region) && ['village', 'castle', 'monastery'].includes(c.kind));
      assert(hamlets.length >= 20, `мало селений: ${hamlets.length}`);
      assert(!hamlets.some(c => /Рокка|Борго|Казале|Поджо/.test(c.name)), 'итальянское название во Франции');
      // Тулуза: капитул, окситанские имена, свой голос и слухи; без италийского.
      TH.go(TH.city('toulouse'));
      const v = G.world.villages[0], occ = NAMES.occitan.m.concat(NAMES.occitan.f);
      assert(v.npcs.find(n => n.role === 'elder').title === 'Капитул', 'в Тулузе не капитул');
      assert(v.npcs.every(n => occ.includes(n.name) || n.special), 'в Тулузе не окситанские имена');
      const V = LOCAL_VOICE.languedoc, talk = [];
      for (let d = 0; d < 6; d++) { G.minutes += 24 * 60; for (const n of v.npcs) talk.push(newsReply(n)); }
      assert(talk.some(t => V.lore.concat(REGION_RUMORS.languedoc).some(r => t.includes(r.slice(0, 20)))), 'ни одного здешнего слуха');
      const it = talk.find(t => /подест|остери/i.test(t));
      assert(!it, 'в Тулузе говорят об итальянском: ' + it);
      // Вести: простой тулузец знает лишь свою землю; купец — ещё и то, что знает весь христианский мир, и с опозданием.
      worldTick();
      const tPeasant = v.npcs.find(n => n.role === 'peasant'), tMerchant = v.npcs.find(n => n.role === 'merchant');
      const foreign = n => landOf(G.over.regionAt(n.x, n.y)) !== 'france';
      assert(!knownNews(tPeasant).some(n => !n.lead && foreign(n)), 'тулузский горожанин пересказывает итальянские вести');
      assert(knownNews(tMerchant).filter(n => !n.lead && foreign(n)).every(n => n.europe), 'купец в Тулузе знает итальянские мелочи');
      assert(knownNews(tPeasant).some(n => n.landWide), 'в Тулузе нет своих вестей');
      // Марсель: подеста; деревня Прованса — байль.
      TH.go(TH.city('marseille'));
      assert(TH.npc('elder').title === 'Подеста', 'в Марселе не подеста');
      const pv = hamlets.find(c => c.kind === 'village' && c.region === 'provence');
      TH.go(pv);
      assert(TH.npc('elder').title === 'Байль', 'в провансальской деревне не байль');
      // Атлас: свои листы.
      leaveLocal();
      for (const [id, sheet] of [['toulouse', 'languedoc'], ['marseille', 'provence']]) {
        const c = TH.city(id); G.ox = c.x; G.oy = c.y;
        assert(ATLAS_SHEETS[new MapScreen().sheet].id === sheet, `атлас в ${id} не на своём листе`);
      }
      // Италийская нечисть — только в Италии: ни орко, ни ламий за её пределами (ведьмы и оборотни — везде, под своими именами).
      for (let i = 0; i < 400; i++) {
        G.leads = []; const l = spawnLead();
        if (l && l.kind === 'werewolf' && FOREIGN_REGIONS.includes(ow.regionAt(l.x, l.y)))
          assert(!/лупо маннаро/.test(l.rumor), 'за Альпами — про лупо маннаро');
        if (l && ['orco', 'lamia'].includes(l.kind)) assert(!FOREIGN_REGIONS.includes(ow.regionAt(l.x, l.y)), `${l.name} за пределами Италии`);
      }
      return `селений ${hamlets.length}`;
    },
  },
  {
    name: 'Мальтийские товары, привоз у купцов, великан и его отвар',
    run() {
      const p = TH.start(); TH.immortal();
      // Купец Биргу торгует хлопком, тмином и мёдом; свой товар есть всегда.
      TH.go(TH.city('birgu'));
      const sells = traderGoods(TH.npc('merchant')).sells;
      for (const id of ['cotton', 'cumin', 'honey']) assert(sells.includes(id), `в Биргу нет: ${GOODS[id].name}`);
      // По Италии: у каждого купца есть своё, но далеко не всё у всех.
      let full = 0, n = 0, lux = 0;
      for (const c of G.over.cities.filter(c => c.kind === 'city' || c.kind === 'town')) {
        const st = goodsInStock(c);
        n++; if (st.length === GOOD_IDS.length) full++;
        for (const id of GOOD_IDS) if (producerDistance(c, id) === 0) assert(st.includes(id), `${c.name}: нет своего товара ${id}`);
        if (c.kind === 'town' && !c.port && st.some(id => LUXURY.includes(id) && producerDistance(c, id) > 0)) lux++;
      }
      assert(full < n * 0.25, `всё есть почти везде: ${full} из ${n}`);
      // Великан: на Мальте, редкий, с него — две порции мозга.
      const d = BEASTS.giant;
      assert(d.regions.join() === 'malta' && d.weight < 1 && d.max === 1, 'великан не мальтийский или не редкий');
      TH.go(TH.city('mdina'));
      const g = TH.spawn('giant', 3, 0);
      killBeast(g, true);
      const loot = G.world.itemsAt(g.x, g.y).filter(it => it.id === 'giant_marrow');
      assert(loot.length === 2, 'с великана не две порции');
      // Отвар: особый — не купить и не найти; только опытом.
      assert(!COMMON_RECIPES().includes('giant'), 'отвар великана продаётся');
      p.alchemyKnown = true; p.alchemy = { kettle: true };
      let ok = false;
      for (let k = 0; k < 30 && !ok; k++) {
        p.trophies.giant_marrow = { name: 'Мозг из кости великана', value: 45, count: 1 };
        p.trophies.herb_stjohn = { name: 'Зверобой', value: 4, count: 1 };
        p.trophies.herb_sage = { name: 'Шалфей', value: 4, count: 1 };
        G.world.actors = G.world.actors.filter(a => a.kind !== 'beast');
        ok = brew('kettle', ['giant_marrow', 'herb_stjohn', 'herb_sage']).ok;
      }
      assert(ok && knowsRecipe('giant') && p.brews.giant >= 1, 'отвар великана не открылся');
      const dmg0 = p.dmgBonus(null), arm0 = p.armor, cap0 = p.capacity;
      brewEffect('giant');
      assert(p.dmgBonus(null) === dmg0 + 3 && p.armor === arm0 + 2 && p.capacity === cap0 + 20, 'сила великана не действует');
      p.fatigue = 0;
      G.minutes += 361; survivalTick(p, 1);
      assert(!(p.giantUntil > G.minutes) && p.fatigue >= 45, 'нет отката после отвара');
      return `полный привоз у ${full} из ${n}, заморское в ${lux} глухих городках`;
    },
  },
  {
    name: 'Атаманы редки и не толпятся; имена в вестях с заглавной',
    run() {
      TH.start();
      let made = 0;
      for (let d = 0; d < 120; d++) {
        G.minutes += 24 * 60;
        // Шайки гибнут — на их место приходят новые.
        G.travelers = G.travelers.filter(t => t.kind !== 'brigands' || rng.chance(0.5));
        const before = new Set(G.travelers.filter(t => t.elite).map(t => t.elite.id));
        fillTravelers(false);
        const el = G.travelers.filter(t => t.elite);
        made += el.filter(t => !before.has(t.elite.id)).length;
        assert(el.length <= 2, `атаманов сразу ${el.length}`);
        if (el.length === 2) assert(Math.hypot(el[0].x - el[1].x, (el[0].y - el[1].y) * 2) >= 80 * MAP_SCALE, 'два атамана рядом');
      }
      assert(made <= 120 / 21 + 1, `за 4 месяца атаманов: ${made}`);
      assert(lowerStart('Генуя обещает награду').startsWith('Генуя') && lowerStart('Император осадил').startsWith('император'), 'заглавные в вестях');
      return `за 4 месяца новых атаманов: ${made}`;
    },
  },
  {
    name: 'Женщины говорят о себе в женском роде',
    run() {
      TH.start();
      const she = { female: true }, he = { female: false };
      const F = ['innkeeper', 'herbalist', 'peasant', 'merchant', 'noble', 'alchemist', 'alchemist_wild', 'peasant_village', 'peasant_city'];
      const lines = [];
      const add = arr => (Array.isArray(arr) ? arr : Object.values(arr || {}).flat()).forEach(l => typeof l === 'string' && lines.push(l));
      for (const P of [GREETINGS, MORE_GREETINGS, LIFE, MORE_LIFE]) for (const k of F.concat(['alchemist_lore'])) add(P[k]);
      for (const P of [SEASON_TALK, NO_NEWS, NEWS_DONE, NO_WORK, PARMA_SIEGE_LIFE, PARMA_FREE_LIFE]) add(P);
      add(TRAVELER_LIFE.pilgrims);
      // Голоса земель (Мальта, Гельвеция, Карантания, Прованс, Лангедок): всё, кроме преданий, и прочие реплики жителей.
      for (const V of Object.values(LOCAL_VOICE)) { add(V.greet); add(V.greetMuslim); for (const v of Object.values(V.life)) add(v); }
      for (const P of [NO_INTEREST, WOKEN, LIFE_DONE]) add(P);
      for (const R of Object.values(PEOPLE_REMARKS)) for (const v of Object.values(R)) add(v);
      const masc = /(^|[^а-яё])я (не |уже |тебе |всё |пока |и так )*[а-яё]+(ал|ял|ыл|ил|ел|ёл|ол|ул|ался|ился)([^а-яё]|$)|(^|[^а-яё])(рад|наслышан|господский|свободный)([^а-яё]|$)/i;
      const bad = [];
      for (const l of lines) {
        const f = speak(she, l), m = speak(he, l);
        if (/[{}]/.test(f) || /[{}]/.test(m)) bad.push('пометка: ' + l);
        else if (masc.test(f)) bad.push(f);
      }
      assert(!bad.length, 'мужской род у женщин:\n' + bad.join('\n'));
      assert(speak(she, 'Я {купил|купила}') === 'Я купила' && speak(he, 'Я {купил|купила}') === 'Я купил', 'пометка рода');
      return `реплик проверено: ${lines.length}`;
    },
  },
  {
    name: 'Житель не пересказывает всю игру: свой запас историй, «как жизнь» — раз в день',
    run() {
      TH.start(); TH.immortal();
      TH.go(TH.city('siena'));
      const npc = G.world.villages[0].npcs.find(n => n.role === 'peasant');
      const first = TH.ask(npc, 'Как жизнь');
      const again = TH.ask(npc, 'Как жизнь');
      assert(first !== again && LIFE_DONE.some(l => again.includes(speak(npc, l).slice(0, 12))), 'о жизни можно спрашивать без конца');
      const life = new Set(), lore = new Set();
      for (let d = 0; d < 40; d++) {
        G.minutes += 24 * 60;
        life.add(TH.ask(npc, 'Как жизнь'));
        for (let k = 0; k < 3; k++) TH.ask(npc, 'Что нового');
      }
      for (const r of G.player.rumors || []) if (r.kind === 'lore' && r.from === npc.name) lore.add(r.text);
      const loreN = (npc.loreTold || []).length;
      assert(life.size <= 4 + 4 + 2, `о жизни — ${life.size} разных историй`);
      assert(loreN <= 4, `слухов от одного — ${loreN}`);
      return `о жизни ${life.size} историй за 40 дней, старых слухов ${loreN}`;
    },
  },
  {
    name: 'Римский доспех из гробницы: средний, и на него дивятся',
    run() {
      const p = TH.start(); TH.immortal();
      const L = ITEMS.lorica;
      assert(L.kind === 'body' && L.armor > ITEMS.leather.armor - 1 && L.armor <= ITEMS.mail.armor && L.value < ITEMS.mail.value && !L.tier, 'не средний или продаётся');
      // Богатый римский саркофаг: доспех выпадает часто.
      let got = 0;
      for (let k = 0; k < 40; k++) {
        const w = G.world, x = p.x + 1, y = p.y;
        w.site = { type: 'roman' }; w.set(x, y, T.SARCOPHAGUS); w.richSarcophagus = w.idx(x, y);
        const n0 = p.bag.length; openSarcophagus(x, y);
        if (p.bag.slice(n0).some(it => it.key === 'lorica')) got++;
      }
      delete G.world.site;
      assert(got >= 8 && got <= 32, `доспех из богатого саркофага: ${got} из 40`);
      const it = p.bag.find(i => i.key === 'lorica');
      equip(p, it);
      assert(p.equip.body === it, 'не надевается');
      TH.go(TH.city('florence'));
      let said = 0;
      for (const n of G.world.villages[0].npcs) {
        const g1 = speak(n, greetingFor(n)), g2 = speak(n, greetingFor(n));
        const roman = t => Object.values(ROMAN_LOOKS).flat().some(l => t.includes(speak(n, l).slice(0, 20)));
        if (roman(g1)) said++;
        assert(!(roman(g1) && roman(g2)), `${n.title} дивится дважды`);
      }
      assert(said >= 1, 'никто не заметил римский доспех');
      return `доспех ${got}/40 из богатых саркофагов; заметили ${said} жителей`;
    },
  },
  {
    name: 'Узник Эццелино: гонец, отец, четыре пути',
    run() {
      const p = TH.start(); TH.immortal();
      const setup = () => {
        p.story = {}; p.quests = []; p.fame = 45; p.coins = 500;
        G.over.sites = G.over.sites.filter(s => s.id !== 'verona_prison');
        if (G.mode === 'local') leaveLocal();
        while (G.screens.length > 1) popScreen();
      };
      const top = () => G.screens[G.screens.length - 1];
      const pick = re => { const d = top(); const i = d.options.findIndex(o => re.test(o.label)); assert(i >= 0, 'нет пункта ' + re + ': ' + d.options.map(o => o.label).join(' | ')); d.choose(i); };
      // Гонец находит славного героя.
      setup(); p.fame = 10;
      let msg = null;
      for (let k = 0; k < 10 && !msg; k++) { TH.go(TH.city('milan')); msg = veronaMessenger(TH.city('milan')); }
      assert(!msg, 'гонец пришёл к безвестному');
      p.fame = 45;
      for (let k = 0; k < 30 && !msg; k++) msg = veronaMessenger(TH.city('milan'));
      assert(msg, 'гонец не пришёл');
      pushScreen(new DialogScreen(msg)); pick(/Прочесть/);
      assert(veronaStage() === 1, 'письмо не прочтено');
      while (G.screens.length > 1) popScreen();
      // Отец в Вероне.
      const toFather = () => {
        TH.go(TH.city('verona'));
        const f = G.world.villages[0].npcs.find(n => n.verona === 'father');
        assert(f, 'нет мессера Альдригетто');
        pushScreen(new DialogScreen(f)); return f;
      };
      toFather(); pick(/получил ваше письмо/);
      assert(veronaStage() === 2 && G.over.sites.some(s => s.id === 'verona_prison'), 'не взялся или тюрьмы нет на карте');
      while (G.screens.length > 1) popScreen();
      const save = JSON.stringify(p.story);
      // Тюрьма: найти ключ, отпереть, увести Тебальдо, выйти.
      const rescue = mode => {
        enterPrison(mode);
        const w = G.world;
        assert(w.prison && w.prison.mode === mode, 'не в тюрьме');
        const son = w.actors.find(a => a.verona === 'son');
        // Ключи на столе караульной.
        if (mode !== 'disguise') { for (const it of w.takeItems(12, 10)) if (it.kind === 'key') pickKey(it); }
        // Отпереть камеру.
        const door = DIRS8.map(([dx, dy]) => [son.x + dx * 3, son.y + dy * 3]).find(([x, y]) => w.get(x, y) === T.LOCKED)
          || [son.x, son.y + (son.y < 15 ? 3 : -3)];
        const out = [door[0], door[1] + (door[1] === 13 ? 1 : -1)];
        p.x = out[0]; p.y = out[1];
        tryLocked(door[0], door[1]);
        if (w.get(door[0], door[1]) === T.LOCKED) tryLocked(door[0], door[1]);
        assert(w.get(door[0], door[1]) === T.DOOR || w.prison.alarm, 'камера не открылась');
        if (w.get(door[0], door[1]) !== T.DOOR) w.set(door[0], door[1], T.DOOR);
        pushScreen(new DialogScreen(son)); pick(/Я от твоего отца/);
        assert(w.prison.freed, 'Тебальдо не освобождён');
        while (G.screens.length > 1) popScreen();
        prisonExit();
        assert(veronaStage() === 3 && G.mode === 'over', 'выход не засчитан');
      };
      for (const mode of ['disguise', 'sewer', 'storm']) {
        p.story = JSON.parse(save); setVerona(2);
        if (mode === 'disguise') p.bag.push(makeItem('ezz_surcoat'));
        if (mode === 'sewer') p.story.veronaSewer = true;
        rescue(mode);
      }
      toFather(); pick(/Ваш сын свободен/);
      assert(veronaStage() === 4 && p.bag.some(i => i.key === 'bonifacio_ring'), 'нет награды');
      while (G.screens.length > 1) popScreen();
      // Путь предательства.
      p.story = JSON.parse(save); setVerona(2);
      TH.go(TH.city('verona'));
      const ez = G.world.villages[0].npcs.find(n => n.verona === 'ezzelino');
      assert(ez, 'нет Эццелино');
      pushScreen(new DialogScreen(ez)); pick(/Донести/);
      assert(veronaStage() === 9 && !G.world.villages[0].npcs.some(n => n.verona === 'father'), 'предательство не сработало');
      while (G.screens.length > 1) popScreen();
      // Срок вышел.
      p.story = JSON.parse(save); setVerona(2);
      G.minutes += (VERONA_DAYS + 1) * 1440;
      veronaCheck();
      assert(veronaStage() === 8, 'срок не истёк');
      // Маскировка: тюремщики не нападают, пока не заподозрят.
      p.story = JSON.parse(save); p.story.veronaDue = timeInfo().day + 5; setVerona(2); p.bag.push(makeItem('ezz_surcoat'));
      enterPrison('disguise');
      const g = G.world.actors.find(a => a.key === 'jailer');
      p.x = g.x + 3 < 66 ? g.x + 3 : g.x - 3; p.y = g.y;
      p.food = 100; p.fatigue = 0;   // голод после промотки срока не должен путать проверку
      const hp0 = p.hp;
      for (let k = 0; k < 20; k++) endTurn();
      assert(G.world.prison.alarm || p.hp >= hp0, 'в сюрко бьют без тревоги: ' + TH.lastLog(8) + ' hp ' + hp0 + '→' + p.hp + ' fever ' + p.fever + ' poison ' + p.poison);
      leaveLocal();
      return 'все пути пройдены';
    },
  },
  {
    name: 'Юг: королевские дозоры, сарацинские лучники, госпитальеры',
    run() {
      TH.start(); TH.immortal();
      leaveLocal();
      const kinds = ['royal', 'saracens', 'hospitallers'];
      const at = id => { const c = TH.city(id); G.ox = c.x; G.oy = c.y; G.travelers = []; G.densityAt = null; for (let k = 0; k < 4; k++) fillTravelers(false); return G.travelers; };
      const south = at('bari');
      for (const k of kinds) assert(south.some(t => t.kind === k), `на юге нет: ${TRAVELER_KINDS[k].name}`);
      assert(south.filter(t => t.kind === 'hospitallers').every(t => ['bari', 'brindisi', 'messina'].includes(t.to)), 'госпитальеры идут не к портам');
      const north = at('milan');
      assert(!north.some(t => kinds.includes(t.kind)), 'южные отряды на севере');
      // Разговор: дозор подскажет о шайке и накроет её.
      at('bari');
      const r = G.travelers.find(t => t.kind === 'royal');
      const band = { id: 'trX', kind: 'brigands', x: r.x + 2, y: r.y, path: [], i: 0, acc: 0, n: 3 };
      G.travelers = G.travelers.filter(t => t.kind !== 'brigands');   // дозор накрывает ближайшую — пусть это будет наша
      G.travelers.push(band);
      const npc = travelerNpc(r);
      const opts = travelerOptions(npc).map(o => o.label);
      assert(opts.some(l => /Спокойна/.test(l)) && opts.some(l => /разбойники/.test(l)), 'нет вопросов к дозору: ' + opts.join(' | '));
      travelerOptions(npc).find(o => /разбойники/.test(o.label)).act();
      assert(!G.travelers.includes(band), 'шайку не накрыли');
      for (const k of ['saracens', 'hospitallers']) { const t = G.travelers.find(x => x.kind === k); travelerOptions(travelerNpc(t)).forEach(o => o.label !== 'Уйти' && !/Сопров|охран/.test(o.label) && o.act()); }
      return `у Бари: ${kinds.map(k => south.filter(t => t.kind === k).length).join('/')}`;
    },
  },
  {
    name: 'Поход короля Людовика: вести по датам, проповедники, крестоносцы, цены',
    run() {
      TH.start(); TH.immortal();
      const go = (y, m, d) => { const day = dayOfDate(y, m, d); G.minutes = (day - 1) * 1440 + 8 * 60; worldTick(); };
      const genoa = TH.city('genoa'), milan = TH.city('milan'), cremona = TH.city('cremona'), palermo = TH.city('palermo');
      const iron0 = louisPriceMult(genoa, 'iron');
      assert(iron0 === 1 && !louisPreachHere(milan), 'летом 1247 ещё рано');
      go(1247, 10, 5);
      assert(G.news.some(n => /нефы для короля/.test(n.text)), 'нет вести о верфях');
      assert(louisPriceMult(genoa, 'iron') > 1.3, 'железо в Генуе не дорожает');
      assert(louisPreachHere(milan) && !louisPreachHere(cremona), 'проповедник: Милан да, гибеллинская Кремона нет');
      TH.go(milan);
      const pr = G.world.villages[0].npcs.find(n => n.louis);
      assert(pr, 'в Милане нет проповедника');
      G.player.coins = 50; const piety0 = G.player.piety;
      TH.ask(pr, 'Пожертвовать');
      assert(G.player.piety > piety0 && G.player.coins === 40, 'пожертвование не принято');
      go(1248, 1, 15);
      assert(louisPriceMult(palermo, 'grain') > 1.2, 'сицилийский хлеб не дорожает');
      assert(crusadersCount() === 0, 'крестоносцы раньше марта');
      go(1248, 4, 1);
      assert(crusadersCount() > 0, 'нет крестоносцев весной');
      leaveLocal(); G.ox = milan.x; G.oy = milan.y; G.travelers = []; G.densityAt = null;
      for (let k = 0; k < 4; k++) fillTravelers(false);
      const cr = G.travelers.filter(t => t.kind === 'crusaders');
      assert(cr.length && cr.every(t => t.to === 'genoa'), 'крестоносцы не идут в Геную');
      assert(louisRumors().some(t => /крест/.test(t)), 'нет слухов о походе');
      go(1248, 9, 20);
      assert(LOUIS_NEWS.every((n, i) => G.flags.louis[i]), 'не все вести прозвучали');
      assert(G.news.some(n => /на Кипре/.test(n.text)), 'нет вести о Кипре');
      assert(crusadersCount() === 0 && louisPriceMult(genoa, 'iron') === 1 && !louisPreachHere(milan), 'после отплытия всё ещё идёт подготовка');
      return `крестоносцев у Милана весной: ${cr.length}`;
    },
  },
  {
    name: 'Сардиния: юдикаты, Гочеано, нураги',
    run() {
      TH.start(); TH.immortal();
      for (const id of ['cagliari', 'oristano', 'sassari', 'terranova']) {
        const c = TH.city(id);
        assert(c && c.region === 'sardinia', id + ': нет на Сардинии');
        TH.go(c);
        const roles = new Set(G.world.villages[0].npcs.map(n => n.role));
        for (const r of ['priest', 'elder', 'innkeeper', 'smith', 'herbalist']) assert(roles.has(r), id + ': нет ' + r);
      }
      assert(G.world.villages[0].npcs.find(n => n.role === 'elder').title === 'Куратор Галлуры', 'не тот титул в Терранове');
      const gc = G.over.cities.find(c => c.name === 'Гочеано');
      assert(gc && gc.region === 'sardinia', 'нет замка Гочеано');
      TH.go(gc);
      assert(G.world.villages[0].npcs.some(n => n.name === 'Аделасия'), 'нет Аделасии');
      const nur = G.over.sites.filter(s => s.type === 'nuraghe');
      assert(nur.length >= 2 && nur.every(s => s.region === 'sardinia'), 'нурагов нет или не там');
      leaveLocal(); G.ox = nur[0].x; G.oy = nur[0].y; enterSite(nur[0]);
      assert(G.world.kind === 'dungeon', 'не вошёл в нураг');
      assert(SEA_ROUTES.some(r => r.includes('terranova')), 'в Терранову не плавают');
      // Кальяри из старого сохранения строится по-прежнему (без нового плана).
      const cg = TH.city('cagliari');
      assert(cityPlan(cg) === CITY_PLANS.cagliari || cg.genV >= 3, 'план Кальяри');
      const old = { ...cg, genV: 2 };
      assert(cityPlanBase(old) !== CITY_PLANS.cagliari, 'старое Кальяри перестроено бы');
      return `Сардиния: 4 городка, Гочеано, нурагов ${nur.length}`;
    },
  },
  {
    name: 'Торговля вслепую, ночные улицы, погоня, постоялый двор',
    run() {
      const p = TH.start(); TH.immortal();
      // Цены: без навыка — не видно, выгодно ли; местное — из разговора.
      p.skills.trade = { lvl: 0, xp: 0 };
      const lomb = false;
      TH.go(TH.city('florence'));
      const place = G.world.villages[0].city;
      assert(lomb || (!priceSense() && !knowsLocal(place)), 'новичок видит цены');
      const html0 = new TradeScreen(TH.npc('merchant')).html();
      assert(lomb || (!/Здесь производят/.test(html0) && /не разобрать/.test(html0)), 'новичку подсказывают');
      const said = TH.ask(TH.npc('elder'), 'Чем славятся');
      assert(/сукно/.test(said) && knowsLocal(place), 'местный не рассказал о сукне: ' + said);
      assert(!/Здесь производят/.test(new TradeScreen(TH.npc('merchant')).html()), 'лавка подсказывает, что здесь производят');
      assert(p.rumors.some(r => /производят/.test(r.text)), 'услышанное о местном товаре не записано в журнал');
      // Совет купца: не каждый скажет; скрытный — никогда, раз в день.
      let told = 0, shut = 0;
      for (let k = 0; k < 30; k++) {
        const m = { ...TH.npc('merchant'), adviceMood: undefined, adviceDay: -1, customer: false };
        const r = merchantAdvice(m);
        if (/Дешевле всего|в одной цене/.test(r)) told++; else shut++;
      }
      assert(told > 3 && shut > 3, `советуют ${told}, молчат ${shut}`);
      const mm = { ...TH.npc('merchant'), adviceMood: 'open', adviceDay: -1 };
      merchantAdvice(mm);
      assert(/хватит|завтра/.test(merchantAdvice(mm)), 'советует без конца');
      p.skills.trade.lvl = 3;
      assert(priceSense() && /выгодно/.test(new TradeScreen(TH.npc('merchant')).html()), 'опытный не видит цен');
      // Ночью улицы пустеют, утром — снова люди.
      const w = G.world;
      const onStreet = () => w.villages[0].npcs.filter(n => w.actors.includes(n) && !n.sleeping);
      const day = onStreet().length;
      G.minutes = Math.floor(G.minutes / 1440) * 1440 + 23 * 60 - START_MINUTE + 1440; endTurn();
      const night = onStreet();
      assert(night.length < day * 0.5 && night.some(n => n.role === 'guard'), `ночью на улицах ${night.length} из ${day}`);
      G.minutes += 8 * 60; endTurn();
      assert(onStreet().length >= day - 1, 'утром люди не вернулись');
      // Деревня: ночью жители спят у себя в домах — их видно, утром выходят.
      const vil = G.over.cities.find(c => c.kind === 'village' && c.region !== 'malta');
      TH.go(vil);
      const vw = G.world, folk = vw.villages[0].npcs.filter(n => !NIGHT_STAY.has(n.role));
      G.minutes = Math.floor(G.minutes / 1440) * 1440 + 23 * 60 - START_MINUTE + 1440; endTurn();
      const asleep = folk.filter(n => n.sleeping && vw.actors.includes(n) && vw.building[vw.idx(n.x, n.y)] !== -1);
      assert(asleep.length >= folk.length * 0.7, `в деревне спят дома ${asleep.length} из ${folk.length}`);
      const sx = asleep[0].x, sy = asleep[0].y;
      for (let k = 0; k < 20; k++) endTurn();
      assert(asleep[0].x === sx && asleep[0].y === sy, 'спящий ходит');
      assert(/ночь|разбуд|Пожар|напугал|ломишься/i.test(greetingFor(asleep[0])), 'разбуженный не удивлён');
      G.minutes += 8 * 60; endTurn();
      assert(folk.filter(n => n.sleeping).length === 0, 'утром не проснулись');
      // Не все интересуются вестями.
      let deaf = 0, asked = 0;
      for (const c of G.over.cities.filter(c => c.kind === 'village').slice(0, 12)) {
        TH.go(c);
        for (const n of G.world.villages[0].npcs.filter(n => n.role === 'peasant')) { asked++; if (NO_INTEREST.some(t => newsReply(n).includes(t.slice(0, 15)))) deaf++; }
      }
      assert(deaf > 0 && deaf < asked * 0.6, `равнодушных к вестям ${deaf} из ${asked}`);
      // Погоня: от зверя в двух шагах уйти трудно.
      let fled = 0;
      for (let k = 0; k < 40; k++) {
        enterWild(false);
        const ww = G.world; ww.actors = ww.actors.filter(a => a.kind !== 'beast');
        p.x = 0; p.y = ww.h >> 1;
        const m = makeBeast('wolf', 2, p.y); m.target = [p.x, p.y]; m.provoked = true; ww.actors.push(m);
        tryMove(-1, 0);
        if (G.mode === 'over') fled++; else leaveLocal();
      }
      assert(fled < 30, `от волка уходят слишком легко: ${fled} из 40`);
      // Постоялый двор: конюшня не налезает на дом.
      const inn = G.over.cities.find(c => c.kind === 'inn');
      TH.go(inn);
      const iw = G.world, house = iw.buildings.find(b => b.name === inn.name), st = iw.buildings.find(b => b.name === 'Конюшня');
      assert(house && st && (house.x + house.w <= st.x || st.x + st.w <= house.x), 'конюшня налезает на дом двора');
      return `ночью на улице ${night.length} из ${day}; в деревне спят дома ${asleep.length}/${folk.length}; не слушают вестей ${deaf}/${asked}; ушли от волка ${fled}/40`;
    },
  },
  {
    name: 'Старт — в случайном городе Италии',
    run() {
      const seen = new Set();
      for (let k = 0; k < 8; k++) {
        startGame(new Player('Тест', PEOPLES[k % PEOPLES.length], { str: 6, con: 6, dex: 6, wis: 6, fai: 6 }));
        const c = G.world.villages[0].city;
        assert(['city', 'town'].includes(c.kind) && !c.siege, `старт не в городе: ${c.name}`);
        seen.add(c.id);
      }
      assert(seen.size >= 4, `старт почти всегда в одном месте: ${[...seen].join(', ')}`);
      // Имена — своего народа.
      for (const pe of PEOPLES) {
        const names = peopleNames(pe).m;
        assert(names.length >= 10, `${pe.name}: мало имён`);
      }
      assert(PEOPLE_NAMES.norse.m.includes('Хакон') && !PEOPLE_NAMES.norse.m.some(n => NAMES.italian.m.includes(n)), 'имена норвежца — итальянские');
      return `городов старта за 8 игр: ${seen.size}`;
    },
  },
  {
    name: 'Меню разделами, свет — только с факелом в руке, сон под землёй, нураг без римлян',
    run() {
      const p = TH.start(); TH.immortal();
      TH.go(TH.city('florence'));
      // Священник: пожертвования и просьбы — разделами.
      const pr = TH.npc('priest'), main = new DialogScreen(pr).options.map(o => o.label);
      assert(main.some(l => l === 'Попросить о помощи…') && !main.some(l => /исцеления/.test(l)), 'меню священника не собрано: ' + main.join(' | '));
      assert(main.length <= 9, `у священника ${main.length} пунктов`);
      const d = new DialogScreen(pr); d.choose(d.options.findIndex(o => o.label === 'Попросить о помощи…'));
      assert(d.options.some(o => /исцеления/.test(o.label)) && d.options.at(-1).label === 'Назад', 'нет раздела просьб');
      d.choose(d.options.length - 1);
      assert(d.options.some(o => o.label === 'Попросить о помощи…'), '«Назад» не вернул');
      const inn = new DialogScreen(TH.npc('innkeeper')).options.map(o => o.label);
      assert(inn.some(l => l === 'Ночлег, еда и вино…') && !inn.some(l => /Снять угол/.test(l)), 'меню трактирщика не собрано');
      // Подземелье: без факела — на шаг вокруг; с факелом — дальше.
      const site = G.over.sites.find(s => s.dungeon && s.type === 'roman');
      leaveLocal(); G.ox = site.x; G.oy = site.y; enterSite(site);
      p.equip.left = null; refreshFov();
      assert(sightRadius() === 1, 'без факела видно дальше шага');
      p.equip.left = makeItem('torch'); refreshFov();
      assert(sightRadius() > 3, 'факел в руке не светит');
      // Сон под землёй, когда устал.
      G.world.actors = G.world.actors.filter(a => a.kind !== 'beast');
      p.fatigue = 80; rest();
      assert(p.fatigue < 40, 'под землёй не уснуть');
      p.fatigue = 10; p.hp = p.maxHp; p.grace = p.maxGrace;
      rest();
      assert(!/полон сил/.test(TH.lastLog()), 'старая надпись');
      leaveLocal();
      // Нураг: своя нежить, без римских легионеров.
      assert(!DUNGEON_TYPES.nuraghe.mobs.some(([k]) => k === 'skeleton'), 'в нураге скелет легионера');
      return 'ok';
    },
  },
  {
    name: 'Проселки: к деревням в стороне от трактов, быстрее бездорожья',
    run() {
      TH.start(); leaveLocal();
      const ow = G.over;
      const ham = ow.cities.filter(c => ['village', 'castle', 'monastery'].includes(c.kind));
      const linked = c => ow.road[ow.idx(c.x, c.y)] >= 0 || DIRS8.some(([dx, dy]) => ow.road[ow.idx(c.x + dx, c.y + dy)] >= 0 || ow.track[ow.idx(c.x + dx, c.y + dy)]);
      const lone = ham.filter(c => !linked(c));
      assert(lone.length <= ham.length * 0.03, `без дороги: ${lone.length} из ${ham.length}`);
      let tr = -1; for (let i = 0; i < ow.track.length; i++) if (ow.track[i] && ow.road[i] < 0 && ow.tiles[i] === OT.FOREST) { tr = i; break; }
      assert(tr >= 0, 'нет проселков в лесу');
      const x = tr % ow.w, y = (tr / ow.w) | 0;
      assert(ow.cost(x, y) < OTILES[OT.FOREST].cost && ow.isTrack(x, y), 'по проселку не быстрее, чем лесом');
      // Старое сохранение без проселков — проложатся те же.
      const copy = Object.assign(Object.create(Overworld.prototype), ow, { track: undefined });
      layTracks(copy);
      assert(copy.track.every((v, i) => v === ow.track[i]), 'проселки старому миру прокладываются иначе');
      return `проселков ${ow.track.reduce((a, b) => a + b, 0)} клеток; без дороги ${lone.length} из ${ham.length}`;
    },
  },
  {
    name: 'Мальтийцы говорят о своём: заботы, слухи, приветствия',
    run() {
      TH.start(); TH.immortal();
      const ITALY = /подест|коммун|гвельф|гибеллин|Лючер|Ломбард|Тоскан|Флоренц|Милан|Парм|нотари|цех/i;
      const V = LOCAL_VOICE.malta, all = [];
      for (const id of ['birgu', 'mdina', 'gozo']) {
        TH.go(TH.city(id));
        for (const n of G.world.villages[0].npcs) {
          if (n.special) continue;
          const g = speak(n, n.greeting);
          if (!['priest', 'elder', 'guard'].includes(n.role) || id === 'mdina') assert(!ITALY.test(g), `${id}: приветствие об Италии: ${g}`);
          for (let d = 0; d < 6; d++) { G.minutes += 1440; const life = TH.ask(n, 'Как жизнь'); if (life) { all.push(life); assert(!ITALY.test(life), `${id}: «как жизнь» об Италии: ${life}`); } }
        }
      }
      assert(all.some(t => V.life.default.concat(V.life.muslim).some(l => t.includes(l.slice(0, 20)))), 'мальтийских забот не слышно');
      // Слухи — свои.
      const n = G.world.villages[0].npcs.find(x => x.role === 'peasant');
      const mine = repertoire(n, 'lore_test', V.lore.concat(REGION_RUMORS.malta), 3);
      assert(mine.length && mine.every(t => !/подест|коммун|гвельф|Тоскан|Флоренц|Милан|Парм|цех/i.test(t)), 'слухи Мальты об Италии');
      return `реплик о жизни: ${all.length}`;
    },
  },
  {
    name: 'Доставка: пешком — только по суше; за пролив — морем',
    run() {
      TH.start(); TH.immortal();
      assert(landPiece(TH.city('gozo').x, TH.city('gozo').y) !== landPiece(TH.city('birgu').x, TH.city('birgu').y), 'Гоцо и Мальта — один остров');
      TH.go(TH.city('gozo'));
      const npc = G.world.villages[0].npcs.find(n => CARGO[questRole(n)]);
      let sea = 0, walk = 0;
      for (let k = 0; k < 40; k++) {
        const o = offerDelivery(npc);
        if (!o) continue;
        const dest = TH.city(o.to);
        if (landPiece(dest.x, dest.y) !== landPiece(TH.city('gozo').x, TH.city('gozo').y)) {
          assert(/за проливом|за морем/.test(o.text) && /морем/.test(o.accept), 'за пролив — «пешком»: ' + o.text);
          sea++;
        } else walk++;
      }
      assert(sea > 0, 'из Гоцо не бывает доставок за пролив');
      TH.go(TH.city('florence'));
      for (let k = 0; k < 20; k++) {
        const o = offerDelivery(G.world.villages[0].npcs.find(n => CARGO[questRole(n)]));
        if (o) assert(/пешком/.test(o.text) && landPiece(TH.city(o.to).x, TH.city(o.to).y) === landPiece(TH.city('florence').x, TH.city('florence').y), 'из Флоренции — за море пешком');
      }
      return `из Гоцо: морем ${sea}, пешком ${walk}`;
    },
  },
  {
    name: 'Навыки растут не за дни; вход в деревню — по дороге',
    run() {
      const p = TH.start(); leaveLocal();
      // Неделя ходьбы по тракту — атлетика не выше 2.
      p.skills.athletics = { lvl: 0, xp: 0 };
      const ids = ['milan', 'pavia', 'genoa', 'pisa', 'florence', 'bologna', 'verona'];
      const day0 = timeInfo().day;
      for (let k = 0; timeInfo().day - day0 < 7; k++) {
        const a = TH.city(ids[k % ids.length]), b = TH.city(ids[(k + 1) % ids.length]);
        G.ox = a.x; G.oy = a.y;
        for (const i of overPath(a.x, a.y, b.x, b.y).slice(1)) {
          p.food = 80; p.fatigue = 10;
          const x = i % G.over.w, y = (i / G.over.w) | 0;
          overMove(Math.sign(x - G.ox), Math.sign(y - G.oy)); if (G.mode === 'local') leaveLocal(); G.ox = x; G.oy = y;
          if (timeInfo().day - day0 >= 7) break;
        }
      }
      assert(skillLevel(p, 'athletics') <= 2, `атлетика за неделю: ${skillLevel(p, 'athletics')}`);
      // Пришёл в деревню по проселку — стоишь на дороге или тропе.
      const ow = G.over;
      const v = ow.cities.find(c => c.kind === 'village' && DIRS4.some(([dx, dy]) => ow.isTrack(c.x - dx, c.y - dy)));
      const [dx, dy] = DIRS4.find(([dx, dy]) => ow.isTrack(v.x - dx, v.y - dy));
      if (G.mode === 'local') leaveLocal();
      delete G.cityMaps[v.id]; delete v.genV;
      G.lastDir = [dx, dy]; G.ox = v.x; G.oy = v.y; enterCity(v, true);
      assert([T.ROAD, T.COBBLE, T.DIRT, T.BRIDGE].includes(G.world.get(p.x, p.y)), 'в деревню — в поле, а не на дорогу');
      return `атлетика за неделю: ${skillLevel(p, 'athletics')}`;
    },
  },
  {
    name: 'Отряд изредка сам останавливает путника',
    run() {
      TH.start(); TH.immortal(); leaveLocal();
      const ow = G.over;
      let spot = null;
      for (let i = 0; i < 5000 && !spot; i++) {
        const x = rng.int(5, ow.w - 6), y = rng.int(5, ow.h - 6);
        if (ow.passable(x, y) && ow.passable(x + 1, y) && !nearSettlement(x, y) && !ow.placeAt(x, y)) spot = [x, y];
      }
      G.ox = spot[0]; G.oy = spot[1];
      let hailed = 0;
      for (let k = 0; k < 40; k++) {
        G.hailDay = 0;
        G.travelers = [{ id: 'g' + k, kind: 'ghibs', faction: 'ghib', from: 'rome', to: 'rome', path: [ow.idx(G.ox + 1, G.oy)], i: 0, acc: 0, x: G.ox + 1, y: G.oy, n: 8 }];
        if (meetTravelers()) { hailed++; assert(G.screens.at(-1).npc && G.screens.at(-1).npc.meeting, 'остановили, но разговора нет'); }
        while (G.screens.length > 1) popScreen();
      }
      assert(hailed > 3 && hailed < 25, `останавливают ${hailed} из 40`);
      // Сразу второй раз — нет: затишье на несколько дней.
      G.travelers = [{ id: 'gz', kind: 'guelfs', faction: 'guelf', from: 'rome', to: 'rome', path: [ow.idx(G.ox + 1, G.oy)], i: 0, acc: 0, x: G.ox + 1, y: G.oy, n: 8 }];
      G.hailDay = timeInfo().day + 3;
      assert(!meetTravelers(), 'останавливают без передышки');
      return `останавливают ${hailed} из 40`;
    },
  },
  {
    name: 'Отшельник не знает вестей; за подтверждённый слух опыта не дают',
    run() {
      const p = TH.start();
      const hermit = { kind: 'npc', role: 'hermit', name: 'Отшельник', title: 'Отшельник', village: G.world.villages[0], female: false, greeting: 'Мир тебе.', special: null };
      const labels = npcOptions(hermit, null).map(o => o.label);
      assert(!labels.some(l => /нового/.test(l)), 'отшельник рассказывает новости: ' + labels.join(' | '));
      const lead = { id: 'lt', name: 'Хижина отшельника', anchor: 'X', done: false };
      G.leads.push(lead);
      const xp0 = p.xp, lvl0 = p.level;
      finishLead(lead);
      assert(lead.done && p.xp === xp0 && p.level === lvl0 && !/опыта/.test(TH.lastLog()), 'за слух дали опыт');
      return 'ok';
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
        TH.enter();
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
        TH.enter();
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
      // Вести и наводки случайны: обходим города несколько дней, пока не услышим наводку.
      for (let round = 0; round < 4 && !(p.rumors || []).some(r => r.kind === 'lead'); round++) {
        if (round) { leaveLocal(); passTime(1440); }   // новый день — новые вести (ждём только если не услышали)
        for (const c of G.over.cities.filter(c => c.kind !== 'inn').slice(0, 40)) {
          TH.go(c);
          for (const n of G.world.villages[0].npcs) TH.ask(n, 'Что нового');
        }
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
      // Оружие в дорогу — одно, по выбору: нож в руке, дубины нет; с ножом — монеты в придачу.
      // Пращи на выбор нет (вплотную бесполезна): её носит пастух-горец, а купить можно у любого кузнеца.
      const sl = new Player('П', PEOPLES[0], { str: 6, con: 6, dex: 6, wis: 6, fai: 6 }, null, START_WEAPONS.find(w => w.key === 'knife'));
      assert(sl.equip.right.key === 'knife' && sl.bag.length === 1 && sl.bag[0].key === 'torch' && sl.coins === 15 + 12, 'стартовое оружие не то');
      assert(!START_WEAPONS.some(w => w.key === 'sling'), 'праща всё ещё на выбор');
      const sh = new Player('Ш', PEOPLES[0], { str: 6, con: 6, dex: 6, wis: 6, fai: 6 }, BACKGROUNDS.find(b => b.id === 'shepherd'));
      assert(sh.equip.right.key === 'club' && sh.bag.some(it => it.key === 'sling'), 'у пастуха нет пращи в мешке');
      // Надпись на могиле — по славе.
      assert(!/помнить/.test(epitaph({ fame: 0, name: 'А' })), 'безвестного «будут помнить»');
      assert(/песн.*одолел змея/.test(epitaph({ fame: 60, name: 'А', deeds: ['одолел змея'] })), 'знаменитого не воспели');
      assert(/хроник/.test(epitaph({ fame: 90, name: 'А', deeds: ['одолел змея'] })), 'прославленного нет в хрониках');
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
        const r = G.term.canvas.getBoundingClientRect(), ps = G.screens.find(s => s.camera);
        const [cx, cy] = G.mode === 'local' ? ps.camera(G.world.w, G.world.h, G.player.x, G.player.y) : ps.camera(G.over.w, G.over.h, G.ox, G.oy);
        return [r.left + (wx - cx + 0.5) * G.term.cw, r.top + (wy - cy + 0.5) * G.term.ch];
      }, [wx, wy]);
      const visible = await page.evaluate(() => !document.getElementById('hud-panel').hidden && document.querySelectorAll('#hud-actions button').length);
      const ACTIONS_N = await page.evaluate(() => ACTIONS.length);
      if (visible !== ACTIONS_N) throw new Error('нет панели или кнопок');
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
      if (!tip || !/волк/i.test(tip)) throw new Error('нет подсказки над зверем');
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
      // Новичку опасных логов не дают.
      for (let i = 0; i < 30; i++) { v.lastLair = null; const o0 = offerLair(el); assert(!o0 || (LAIR_QUESTS[o0.lairKind].lvl || 1) <= 1, 'новичка послали на ' + (o0 && o0.lairKind)); }
      p.level = 6;
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
      G.ox = lead.x; G.oy = lead.y; TH.enter();
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
      assert(!inn || !TH.options(inn).some(o => /Кружку вина/.test(o)), 'вино в Лючере');
      // У христиан — по-прежнему священник с реликвиями.
      TH.go(TH.city('rome'));
      assert(TH.options(G.world.villages[0].npcs.find(n => n.role === 'priest')).some(o => /Святыни/.test(o)), 'сломался обычный священник');
      return opts;
    },
  },

  {
    name: 'Герой-сарацин: Лючера, мечеть вместо мессы, без бонусов народа',
    run() {
      const idx = PEOPLES.findIndex(x => x.id === 'saracen');
      const p = TH.start(idx);
      assert(G.world.villages[0].city.id === 'lucera', 'не в Лючере');
      assert(PEOPLES.every(x => !Object.keys(x.mods).length), 'у народа остались бонусы');
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
      leaveLocal(); G.ox = site.x; G.oy = site.y; revealTomb(site); TH.enter();
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
      leaveLocal(); G.ox = site.x; G.oy = site.y; TH.enter();
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
        leaveLocal(); G.ox = site.x; G.oy = site.y; TH.enter();
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
      const q0 = p.quests.length;
      TH.ask(fr, 'Могу ли я послужить');
      assert(p.quests.length === q0, 'император дал поручение безвестному');
      // Днём в Парму не войти.
      leaveLocal(); G.ox = parma.x; G.oy = parma.y;
      const night0 = isNight();
      if (!night0) { TH.enter(); assert(G.mode === 'over', 'днём вошёл в осаждённую Парму'); }
      // Ночью — пробраться.
      while (!isNight()) passTime(60);
      p.skills.stealth.lvl = 10;
      for (let i = 0; i < 30 && !(G.mode === 'local' && G.world.villages && G.world.villages[0] && G.world.villages[0].city === parma); i++) {
        if (G.mode === 'local') { leaveLocal(); G.ox = parma.x; G.oy = parma.y; }
        TH.enter();
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
      TH.enter();
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
      TH.enter();
      // У своего края, если там есть дорога; нет — на ближайшей к нему дороге у другого края. Всегда — по дороге.
      const ROADY = [T.ROAD, T.COBBLE, T.BRIDGE, T.DIRT];
      const check = (onSide, label) => {
        const ww = G.world, p = G.player;
        let sideRoad = false;
        for (let y = 0; y < ww.h; y++) for (let x = 0; x < ww.w; x++) if (onSide(x, y, ww) && ROADY.includes(ww.get(x, y)) && ww.free(x, y)) sideRoad = true;
        assert(ww.villages[0].city === c && ROADY.includes(ww.get(p.x, p.y)), `${label}: вошёл не по дороге`);
        assert(!sideRoad || onSide(p.x, p.y, ww), `${label}: не у своего края (${p.x},${p.y})`);
      };
      check((x, y, ww) => x >= ww.w - 3, 'с востока');
      leaveLocal(); G.lastDir = [0, 1];
      TH.enter();
      check((x, y) => y <= 2, 'с севера');
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
      // Новичку такого не поручат.
      assert(TH.storyWork(cast, 'cult') === null && cultStage() === 0, 'новичку дали тихую деревню');
      p.level = CULT_MIN_LEVEL;
      TH.storyWork(cast, 'cult');
      assert(!TH.options(cast).some(o => /тревожит/.test(o)), 'особое дело торчит отдельной строкой');
      assert(cultStage() === 1, 'задание не дано');
      const v = cultVillagePlace();
      // Деревня: холодный приём, нет священника, церковь на отшибе.
      leaveLocal(); G.ox = v.x; G.oy = v.y; G.lastDir = [1, 0]; TH.enter();
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
      assert(vw.get(ax, ay) === T.STAIRS_DOWN, 'спуск не открылся: ' + JSON.stringify([vw.def(ax, ay).name, vw.actorAt(ax, ay) && vw.actorAt(ax, ay).title, p.x - ax, p.y - ay, G.messages ? '' : '', timeInfo().hour]));
      // Подозрение: расспросы — бунт.
      for (let i = 0; i < 4 && !p.story.cultRiot; i++) TH.ask(vw.villages[0].npcs.find(n => n.role === 'peasant' || n.role === 'elder'), 'Где ваш священник');
      assert(p.story.cultRiot && vw.actors.some(a => a.key === 'cult_villager'), 'жители не взялись за вилы');
      // Вниз, к главе культа.
      moveTo(p, ax - 1, ay); tryMove(1, 0);
      assert(G.world.site && G.world.site.type === 'cult', 'не спустился');
      const site = G.world.site;
      goToLevel(site, G.dungeons[site.id], 1, 'up');
      const boss = G.world.actors.find(a => a.key === 'cult_leader');
      assert(boss && G.world.actors.some(a => a.kind === 'beast' && a !== boss), 'нет главы или его слуг');
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
    name: 'Алхимия: травы в глуши, травница, инструменты, рецепты, зелья',
    run() {
      const p = TH.start();
      TH.immortal();
      // Летом в глуши растут травы; наступил — сорвал.
      G.minutes = 0;
      while (today().m !== 7) G.minutes += 1440 * 10;
      leaveLocal();
      let herb = null;
      for (let i = 0; i < 10 && !herb; i++) {
        enterWild(false);
        for (const [k, list] of G.world.items) { const h = list.find(x => x.kind === 'herb'); if (h) { herb = { k, h }; break; } }
        if (!herb) leaveLocal();
      }
      assert(herb, 'в глуши нет трав');
      const [hx, hy] = herb.k.split(',').map(Number), w = G.world;
      w.actors = w.actors.filter(a => a === p || a.kind !== 'beast');
      w.items.set(herb.k, [herb.h]);
      // Встать рядом и шагнуть на траву.
      const from = DIRS8.map(([dx, dy]) => [hx - dx, hy - dy]).find(([x, y]) => w.walkable(x, y) && !w.actorAt(x, y));
      p.x = from[0]; p.y = from[1];
      tryMove(hx - p.x, hy - p.y);
      assert(p.trophies[herb.h.id] && p.trophies[herb.h.id].count >= 1, 'трава не сорвана');
      leaveLocal();
      // Травница продаёт только травы; инструментов и учения у неё нет.
      TH.go(TH.city('florence'));
      const hb = TH.npc('herbalist');
      p.coins = 900;
      assert(!new TradeScreen(hb).rows(0).some(r => /Ступка/.test(r.label)), 'травница продаёт инструменты');
      const sj0 = (p.trophies.herb_stjohn || { count: 0 }).count;
      for (const h of ['plantain', 'sage', 'stjohn']) new TradeScreen(hb).rows(0).find(r => r.label.startsWith(HERBS[h].name)).buy(2);
      assert(p.trophies.herb_stjohn.count === sj0 + 2, 'сушёные травы не куплены');
      delete p.trophies.herb_stjohn; p.trophies.herb_stjohn = { name: 'Зверобой', value: 4, count: 2 };
      // Не владеешь алхимией — не сваришь.
      p.alchemy = { kettle: true };
      assert(!brew('kettle', ['herb_plantain', 'herb_sage']).ok && p.trophies.herb_plantain.count >= 2, 'сварил без учения');
      // Алхимик: в городе (не во всяком) — найдём город с алхимиком.
      const ac = G.over.cities.find(c => alchemistIn(c));
      assert(ac, 'алхимиков нет нигде');
      assert(G.over.cities.filter(c => alchemistIn(c)).length < G.over.cities.filter(c => c.kind === 'city').length, 'алхимик в каждом городе');
      TH.go(ac);
      const al = G.world.villages[0].npcs.find(n => n.role === 'alchemist');
      assert(al && /Научи/.test(TH.options(al).join('|')), 'нет алхимика или учения');
      p.skills.letters = { lvl: 0, xp: 0 };
      assert(/грамот/.test(TH.ask(al, 'Научи')) && !knowsAlchemy(), 'неграмотного научили');
      p.skills.letters.lvl = 1;
      TH.ask(al, 'Научи');
      assert(knowsAlchemy() && knowsRecipe('heal') && knowsRecipe('salve') && !knowsRecipe('fuga'), 'не научился');
      TH.ask(al, 'Рецепт: масло');
      TH.ask(al, 'Рецепт: aqua');
      assert(knowsRecipe('fuga') && knowsRecipe('aqua'), 'рецепт не купился');
      p.alchemy = {};
      const tr = new TradeScreen(al);
      for (const name of ['Ступка с пестиком', 'Медный котелок', 'Перегонный куб']) tr.rows(0).find(r => r.label.startsWith(name)).buy(1);
      assert(hasTool(p, 'mortar') && hasTool(p, 'kettle') && hasTool(p, 'alembic'), 'инструменты не куплены');
      // Окно: положить реагенты, сварить (неудачи пока отключены — проверим их отдельно).
      const failChance = window.brewFailChance;
      window.brewFailChance = () => 0;
      const a = new AlchemyScreen();
      pushScreen(a);
      a.html();
      a.tool = 'kettle'; a.put('herb_plantain'); a.put('herb_sage');
      const pot0 = p.potions;
      a.run();
      assert(p.potions >= pot0 + 1 && /Готово/.test(a.msg), 'целебный отвар не сварился: ' + a.msg);
      // Не тот инструмент — бурая жижа, реагенты пропали.
      const sj = p.trophies.herb_stjohn.count;
      a.tool = 'kettle'; a.put('herb_stjohn'); a.put('herb_stjohn'); a.run();
      assert(/жижа/.test(a.msg) && !p.trophies.herb_stjohn, 'неверный рецепт сработал');
      // По рецепту: масло зверобоя в ступке.
      p.trophies.herb_stjohn = { name: 'Зверобой', value: 4, count: 2 };
      a.fill('fuga');
      assert(a.tool === 'mortar' && a.slots.mortar.length === 2, 'рецепт не разложился');
      a.run();
      assert(p.brews.fuga >= 1, 'масло не вышло');
      drinkBrew('fuga');
      const ghoul = makeBeast('ghoul', 0, 0);
      assert(p.anointUntil > G.minutes && p.dmgBonus(ghoul) >= p.dmgBonus(null) + 3, 'масло не действует на нечисть');
      // Вино в перегонном кубе.
      p.goods.wine = 1; p.trophies.herb_sage = { name: 'Шалфей', value: 3, count: 1 };
      a.fill('aqua'); a.run();
      assert(p.brews.aqua >= 1, 'aqua vitae не перегналась: ' + a.msg);
      while (G.screens.length > 1) popScreen();
      // Неудача: верный состав, но сорвалось — реагенты пропали, зелья нет.
      window.brewFailChance = () => 1;
      p.trophies.herb_plantain = { name: 'Подорожник', value: 2, count: 1 }; p.trophies.herb_sage = { name: 'Шалфей', value: 3, count: 1 };
      const pot1 = p.potions, bad = brew('kettle', ['herb_plantain', 'herb_sage']);
      assert(!bad.ok && p.potions === pot1 && !p.trophies.herb_plantain && !/жижа/.test(bad.text), 'неудача не сработала: ' + bad.text);
      // Опытным путём: неизвестный, но верный состав. Сорвалось — намёк, рецепта нет; вышло — рецепт открыт.
      p.trophies.herb_mint = { name: 'Мята', value: 2, count: 2 }; p.trophies.herb_sage = { name: 'Шалфей', value: 3, count: 2 };
      const near = brew('kettle', ['herb_mint', 'herb_sage']);
      assert(!near.ok && /почти|вот-вот/.test(near.text) && !knowsRecipe('tonic'), 'нет намёка на верный состав');
      window.brewFailChance = () => 0;
      assert(brew('kettle', ['herb_mint', 'herb_sage']).ok && knowsRecipe('tonic') && p.brews.tonic >= 1, 'рецепт не открылся опытом');
      window.brewFailChance = failChance;
      // Шанс неудачи падает с навыком.
      p.skills.alchemy.lvl = 0; const f0 = brewFailChance('aqua');
      p.skills.alchemy.lvl = 6; const f6 = brewFailChance('aqua');
      assert(f0 > f6 && f6 >= 0.03 && brewFailChance('antidote', true) > brewFailChance('antidote', false), 'шанс неудачи не зависит от навыка');
      // Свиток: прочтёт грамотный алхимик.
      p.scrolls = [];
      for (let i = 0; i < 20 && !(knowsRecipe('fever') || knowsRecipe('antidote')); i++) findScroll();
      assert(knowsRecipe('fever') || knowsRecipe('antidote'), 'свиток не прочитан');
      // Лист о печати непосвящённому непонятен — лежит в котомке.
      assert(p.scrolls.every(id => id.startsWith('seal:')), 'рецепт остался непрочитанным');
      // Алхимик в глуши.
      leaveLocal(); enterWild(false);
      alchemistWild(G.world, true);
      const wa = G.world.actors.find(a => a.role === 'alchemist');
      assert(wa && TH.options(wa).length > 2, 'нет алхимика в глуши');
      leaveLocal();
      // Предыстория аптекаря: инструменты и травы с собой.
      const bg = BACKGROUNDS.find(b => b.id === 'apothecary'), q = new Player('А', PEOPLES[0], { str: 6, con: 6, dex: 6, wis: 6, fai: 6 });
      applyBackground(q, bg);
      assert(hasTool(q, 'mortar') && hasTool(q, 'kettle') && q.trophies.herb_plantain.count === 2 && skillLevel(q, 'alchemy') === 2, 'аптекарь без снаряжения');
      return 'зелья варятся';
    },
  },

  {
    name: 'Тайная наука: часы планет, учителя, талисманы, операции, грех',
    run() {
      const p = TH.start();
      TH.immortal();
      // Первый час после восхода — владыка дня; дальше по халдейскому порядку.
      const dayStart = G.minutes - (G.minutes + START_MINUTE) % 1440;
      const { rise } = sunTimes(today());
      const first = planetHourAt(dayStart + Math.round(rise * 60) + 5);
      assert(first.planet === DAY_RULER[today().wd] && !first.night, 'первый час не владыки дня: ' + first.planet);
      const second = planetHourAt(dayStart + Math.round(rise * 60) + 5 + Math.round((sunTimes(today()).set - rise) / 12 * 60));
      assert(second.planet === CHALDEAN[(CHALDEAN.indexOf(first.planet) + 1) % 7], 'второй час не по порядку');
      assert(planetSchedule(14).length === 14, 'таблица часов');
      // Учителя: мудрец в Лючере, Феодор — при императоре в Виттории (пока идёт осада).
      assert(teacherHere(TH.city('lucera')) === 'sage', 'нет мудреца в Лючере');
      const vit = G.over.cities.find(c => c.siege === 'vittoria');
      assert(teacherHere(vit) === (parmaSiege() ? 'theodore' : null), 'Феодор не при императоре');
      TH.go(TH.city('lucera'));
      const sage = G.world.villages[0].npcs.find(n => n.teacher === 'sage');
      assert(sage, 'мудрец не пришёл');
      p.coins = 2000; p.skills.letters = { lvl: 1, xp: 0 };
      // Грамота упирается в Мудрость: при Мудрости 6 выше 1 не выучишься; мудрец не возьмёт.
      p.base.wis = 6; p.recalc && p.recalc();
      TH.go(TH.city('lucera'));
      const imam = G.world.villages[0].npcs.find(n => n.role === 'priest');
      p.lessonDay = -1;
      assert(/не для всякой головы/.test(TH.ask(imam, 'Поучиться грамоте')) && skillLevel(p, 'letters') === 1, 'грамота не упёрлась в Мудрость');
      assert(/Мудрость 7/.test(TH.ask(sage, 'Научи меня')) && !knowsHermetic(), 'немудрого научили');
      p.base.wis = 7; p.recalc && p.recalc();
      assert(/грамот/.test(TH.ask(sage, 'Научи меня')) && !knowsHermetic(), 'полуграмотного научили');
      p.skills.letters.lvl = 2;
      const piety0 = p.piety;
      TH.ask(sage, 'Научи меня');
      assert(knowsHermetic() && knowsOp('seal') && knowsOp('bind') && !knowsOp('stars') && p.piety < piety0, 'не научился у мудреца');
      assert(knowsSeal('saturn') && knowsSeal('mars') && !knowsSeal('venus') && !knowsSeal('moon'), 'печати мудреца: ' + JSON.stringify(p.seals));
      // Печать Луны мудрец продаёт — но не новичку.
      p.skills.hermetic.lvl = 1;
      assert(/Рано/.test(TH.ask(sage, 'Открой печать Луны')) && !knowsSeal('moon'), 'продал печать новичку');
      p.skills.hermetic.lvl = 2;
      TH.ask(sage, 'Открой печать Луны');
      assert(knowsSeal('moon'), 'печать Луны не куплена');
      // Талисман: только известная печать, в день и час планеты, при ясном небе.
      G.weather = { kind: 'clear', until: G.minutes + 99999 };
      leaveLocal();
      assert(/не знаешь/.test(engraveTalisman('venus')), 'режет неизвестную печать');
      // Ждём субботу и час Сатурна.
      const toSat = () => { for (let i = 0; i < 24 * 8 * 4 && !(today().wd === 6 && planetHourAt().planet === 'saturn'); i++) G.minutes += 15; };
      G.minutes += 60 * 24; toSat();
      G.weather.kind = 'cloudy';
      assert(/Небо/.test(engraveTalisman('saturn')), 'печать под тучами');
      G.weather.kind = 'clear';
      assert(/вторник/.test(engraveTalisman('mars')), 'Марс режется не в свой день');
      const bag0 = p.bag.length;
      p.skills.hermetic.lvl = 10;
      for (let i = 0; i < 6 && p.bag.length === bag0; i++) { toSat(); engraveTalisman('saturn'); G.minutes += 60 * 24 * 7 - 120; toSat(); }
      const tal = p.bag.find(it => it.key && it.key.startsWith('talisman_'));
      assert(tal && tal.pagan, 'талисман не вырезан');
      // Носить языческое само по себе не грех; набожный увидит — осудит (раз в день).
      p.equip.relic2 = tal;
      p.piety = 50; p.lastPractice = timeInfo().day;   // чтобы «давно не был в храме» не вмешалось
      const pw = p.piety;
      faithDaily(timeInfo().day);
      assert(p.piety === pw, 'ношение отнимает благочестие само по себе');
      TH.go(TH.city('rome'));
      const priest = TH.npc('priest'), merchant = TH.npc('merchant');
      TH.ask(merchant, 'Что нового');
      assert(p.piety === pw, 'купец осудил талисман');
      const reproach = new DialogScreen(priest).text;
      assert(/язычес|бесовск|лукавого/i.test(reproach) && p.piety < pw, `священник не заметил талисман: ${pw} → ${p.piety}, ${G.player === p} ${TH.lastLog(3)}`);
      const pw2 = p.piety;
      new DialogScreen(priest);
      assert(p.piety === pw2, 'священник корит дважды за день');
      p.equip.relic2 = null;
      leaveLocal();
      // Лист трактата о печати Венеры: прочтёт посвящённый с грамотой 2.
      p.scrolls = ['seal:venus']; readScrolls();
      assert(knowsSeal('venus') && !p.scrolls.length, 'трактат о Венере не прочитан');
      // Сатурн — защита, носится как реликвия.
      const sat = makeItem('talisman_saturn'), arm0 = p.armor;
      p.equip.relic1 = sat;
      assert(p.armor === arm0 + 1, 'талисман Сатурна не защищает');
      p.equip.relic1 = makeItem('talisman_moon');
      assert(p.sightNight >= 2 + Math.floor(p.stats.wis / 3) + 2, 'талисман Луны не помогает ночью');
      p.equip.relic1 = null;
      // Печать Сатурна: звери обходят.
      p.trophies.herb_rue = { name: 'Рута', value: 3, count: 3 };
      p.trophies.herb_wormwood = { name: 'Полынь', value: 2, count: 3 };
      p.fatigue = 10;
      for (let i = 0; i < 4 && !(G.wardUntil > G.minutes); i++) doOperation('seal');
      assert(G.wardUntil > G.minutes && !rollEncounter(1, false), 'печать не бережёт');
      // Узы Марса: зверь стоит.
      while (timeInfo().hour !== 12) G.minutes += 60;
      enterWild(false);
      G.world.actors = G.world.actors.filter(a => a.kind !== 'beast');
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) G.world.set(p.x + dx, p.y + dy, T.GRASS);
      refreshFov();
      const wolf = TH.spawn('wolf', 2, 0);
      wolf.provoked = true;
      p.fatigue = 10;
      const said = [];
      for (let i = 0; i < 4 && !(wolf.boundTurn > G.turn); i++) said.push(doOperation('bind'));
      assert(wolf.boundTurn > G.turn, 'узы не легли: ' + said.join(' / '));
      const wx = wolf.x, wy = wolf.y;
      beastAct(wolf);
      assert(wolf.x === wx && wolf.y === wy, 'скованный зверь ходит');
      leaveLocal();
      // Феодор учит своим операциям; свет и звёзды.
      p.hermeticOps.lumen = true; p.hermeticOps.stars = true;
      p.trophies.herb_stjohn = { name: 'Зверобой', value: 4, count: 3 };
      p.fatigue = 10;
      for (let i = 0; i < 4 && !(p.lumenUntil > G.minutes); i++) doOperation('lumen');
      assert(p.lumenUntil > G.minutes, 'свет не зажёгся');
      const site = G.over.sites.find(s => s.dungeon);
      revealTomb(site); G.ox = site.x; G.oy = site.y; TH.enter();
      const r1 = sightRadius(); p.lumenUntil = 0; const r0 = sightRadius();
      assert(r1 >= r0 + 3, 'свет не светит под землёй');
      leaveLocal();
      return `час сейчас: ${PLANETS[planetHourAt().planet].name}`;
    },
  },

  {
    name: 'Пропавшая книга Леонардо: Пиза → вдова → нотарий → Бобьо → Пиза',
    run() {
      const p = TH.start();
      TH.immortal();
      const at = (city, id) => { TH.go(typeof city === 'string' ? TH.city(city) : city); return G.world.villages[0].npcs.find(n => n.fib === id); };
      // Слух о мастере ходит по Тоскане.
      at('florence', 'x');
      assert(G.news.some(n => n.fib), 'нет слуха о Леонардо');
      const L = at('pisa', 'leonardo');
      assert(L && /Говорят/.test(TH.options(L).join('|')), 'Леонардо нет в Пизе');
      // До задания вдовы и нотария в Генуе нет.
      assert(!at('genoa', 'widow'), 'вдова раньше времени');
      TH.ask(at('pisa', 'leonardo'), 'Говорят');
      assert(fibStage() === 1 && p.quests.some(q => q.id === 'fib'), 'задание не взято');
      TH.ask(at('genoa', 'widow'), 'Я ищу');
      assert(fibStage() === 2, 'вдова не назвала нотария');
      // Нотарий: без денег, красноречия и грамоты — не покажет.
      p.coins = 0; p.skills.letters = { lvl: 0, xp: 0 }; p.skills.speech = { lvl: 0, xp: 0 };
      const nt = at('genoa', 'notary');
      assert(/В Генуе даром/.test(TH.ask(nt, 'Посмотреть')) && fibStage() === 2, 'нотарий показал даром');
      p.skills.letters.lvl = 2;
      TH.ask(at('genoa', 'notary'), 'Я сам прочту');
      assert(fibStage() === 3, 'опись не прочитана');
      const bob = G.over.cities.find(c => c.name === 'Бобьо');
      // Кража: неудача — дороже; вторая неудача — изгнание.
      p.skills.stealth = { lvl: 0, xp: 0 };
      const chance = rng.chance; rng.chance = () => false;
      TH.ask(at(bob, 'librarian'), 'Унести');
      assert(p.story.fibCaught && fibStage() === 3 && TH.options(at(bob, 'librarian')).some(o => o.includes(`(${p.priceBuy(300)} мон.)`)), 'поимка без последствий');
      rng.chance = chance;
      // Скрипторий: нужна грамота 2, три дня.
      const d0 = timeInfo().day;
      TH.ask(at(bob, 'librarian'), 'Отработать');
      assert(fibStage() === 4 && timeInfo().day - d0 >= 3, 'скрипторий не отработан');
      const price0 = p.priceBuy(100), fame0 = fameOf();
      TH.ask(at('pisa', 'leonardo'), 'Вот ваша');
      assert(fibStage() === 5 && !p.quests.some(q => q.id === 'fib') && fameOf() > fame0 && p.priceBuy(100) < price0, 'награда не выдана');
      assert(/Поучиться счёту/.test(TH.options(at('pisa', 'leonardo')).join('|')), 'мастер не учит');
      return 'книга вернулась';
    },
  },

  {
    name: 'Монастыри: библиотекарь, книги, свитки, скрипторий, исповедь, служба обители',
    run() {
      const p = TH.start();
      TH.immortal();
      // Книги торговцы не берут; монастыри — берут, Бобьо — дороже всех, Ассизи — дешевле.
      p.trophies.book_avicenna = { name: BOOKS.book_avicenna.name, value: 90, count: 3 };
      TH.go(TH.city('genoa'));
      const tr = new TradeScreen(TH.npc('merchant')).rows(1).find(r => r.trophy === 'book_avicenna');
      assert(tr && tr.price === null, 'купец берёт книги');
      const priceAt = name => {
        TH.go(G.over.cities.find(c => c.name === name));
        const lib = G.world.villages[0].npcs.find(n => n.librarian);
        assert(lib, 'нет библиотекаря в ' + name);
        const o = TH.options(lib).find(l => l.startsWith('Продать: «Канон') || l.startsWith('Продать: Список'));
        return +o.match(/\((\d+) мон/)[1];
      };
      const bob = priceAt('Бобьо'), ass = priceAt('Ассизи');
      assert(bob > ass, `Бобьо (${bob}) не дороже Ассизи (${ass})`);
      // Продать книгу и свитки.
      TH.go(G.over.cities.find(c => c.name === 'Бобьо'));
      const lib = G.world.villages[0].npcs.find(n => n.librarian);
      assert(lib.fib === 'librarian' && G.world.villages[0].npcs.filter(n => n.librarian || n.fib === 'librarian').length === 1, 'в Бобьо два библиотекаря');
      const c0 = p.coins;
      TH.ask(lib, 'Продать: Список');
      assert(p.coins === c0 + bob && p.trophies.book_avicenna.count === 2, 'книга не продана');
      p.scrolls = ['seal:venus', 'aqua'];
      const c1 = p.coins;
      TH.ask(lib, 'Продать свитки');
      assert(p.coins > c1 && !p.scrolls.length, 'свитки не проданы');
      // Скрипторий: неграмотному — нет; грамотному — плата, раз в день.
      p.skills.letters = { lvl: 0, xp: 0 };
      assert(/скоблить/.test(TH.ask(lib, 'Поработать')), 'неграмотный переписывает');
      p.skills.letters.lvl = 1;
      const c2 = p.coins;
      TH.ask(lib, 'Поработать');
      assert(p.coins > c2 && !TH.options(lib).some(o => o.startsWith('Поработать')), 'скрипторий не платит или дважды в день');
      // Книга в тайнике.
      const b0 = Object.keys(p.trophies).filter(isBook).reduce((s, k) => s + p.trophies[k].count, 0);
      findBook();
      assert(Object.keys(p.trophies).filter(isBook).reduce((s, k) => s + p.trophies[k].count, 0) === b0 + 1, 'книга не найдена');
      // Исповедь у аббата гасит молву.
      p.heresy = 6; p.coins = 100;
      TH.ask(TH.npc('priest'), 'Исповедаться');
      assert(p.heresy === 3, 'исповедь не гасит молву');
      // Службы обителей.
      TH.go(G.over.cities.find(c => c.name === 'Монтекассино'));
      p.hp = 3;
      TH.ask(TH.npc('priest'), 'Попросить место в больнице');
      assert(p.hp === p.maxHp, 'больница Монтекассино не лечит');
      TH.go(G.over.cities.find(c => c.name === 'Помпоза'));
      p.grace = 0;
      TH.ask(TH.npc('priest'), 'Послушать певчих');
      assert(p.grace === p.maxGrace, 'певчие Помпозы');
      TH.go(G.over.cities.find(c => c.name === 'Фарфа'));
      p.heresy = 8;
      TH.ask(TH.npc('priest'), 'Попросить заступничества');
      assert(p.heresy === 3, 'Фарфа не заступается');
      return `книга: Бобьо ${bob}, Ассизи ${ass}`;
    },
  },

  {
    name: 'Инквизитор: молва, явление в гвельфском городе, покаяние и бегство',
    run() {
      const p = TH.start();
      TH.immortal();
      // Молва копится: учение тайной науке, талисман на глазах священника.
      p.equip.relic1 = makeItem('talisman_saturn');
      TH.go(TH.city('rome'));
      new DialogScreen(TH.npc('priest'));
      assert(p.heresy >= 2, 'священник не разнёс молву');
      // В имперском городе инквизитора нет.
      p.heresy = 20; G.inqCool = 0;
      const imperial = G.over.cities.find(c => c.kind === 'city' && cityFaction(c) === 'ghib' && c.region !== 'papal');
      for (let i = 0; i < 10; i++) { TH.go(imperial); G.inqCool = 0; }
      assert(!G.world.villages[0].npcs.some(n => n.inquisitor), 'инквизитор в имперском городе');
      // В гвельфском — явится и не отпустит без ответа.
      const milan = TH.city('milan');
      let inq = null;
      for (let i = 0; i < 30 && !inq; i++) { while (G.screens.length > 1) G.screens.pop(); G.inqCool = 0; TH.go(milan); inq = G.world.villages[0].npcs.find(n => n.inquisitor); }
      assert(inq, 'инквизитор не явился');
      const dlg = G.screens[G.screens.length - 1];
      assert(dlg instanceof DialogScreen && dlg.npc === inq && /Отвечай/.test(dlg.text), 'инквизитор не остановил героя');
      dlg.key({ code: 'Escape', key: 'Escape' });
      assert(G.screens.includes(dlg), 'от инквизитора ушли по Esc');
      // Покаяние: талисман в огонь, штраф, молва — в ноль.
      p.coins = 500;
      dlg.choose(dlg.options.findIndex(o => o.label === 'Покаяться'));
      assert(!p.equip.relic1 && p.heresy === 0 && p.coins < 500, 'покаяние без последствий');
      while (G.screens.length > 1) popScreen();
      // Бегство удачное — молва растёт, герой за воротами.
      p.heresy = 20;
      inq = null;
      for (let i = 0; i < 30 && !inq; i++) { while (G.screens.length > 1) G.screens.pop(); G.inqCool = 0; TH.go(milan); inq = G.world.villages[0].npcs.find(n => n.inquisitor); }
      const d2 = G.screens[G.screens.length - 1];
      const chance = rng.chance; rng.chance = () => true;
      d2.choose(d2.options.findIndex(o => o.label === 'Бежать'));
      rng.chance = chance;
      assert(G.mode === 'over' && p.heresy === 22, 'бегство не удалось');
      while (G.screens.length > 1) popScreen();
      // Молва стихает со временем.
      p.heresy = 3; heresyDaily(10);
      assert(p.heresy === 2, 'молва не стихает');
      return 'брат Пьетро на месте';
    },
  },

  {
    name: 'Карта: пашни у жилья, картинки клеток, взгляд мышью ограничен',
    run() {
      TH.start();
      const ow = G.over;
      // Пашни у жилья: почти все поля — в нескольких клетках от поселения.
      let fields = 0, far = 0;
      for (let i = 0; i < ow.tiles.length; i++) {
        if (ow.tiles[i] !== OT.FIELD) continue;
        fields++;
        const x = i % ow.w, y = (i / ow.w) | 0;
        if (!ow.cities.some(c => Math.hypot(c.x - x, (c.y - y) * 2) <= 7 * MAP_SCALE)) far++;
      }
      assert(fields > 100 && far / fields < 0.03, `пашни вдали от жилья: ${far} из ${fields}`);
      // Мостовая — камень, не трава; колонна, алтарь, колодец — свои картинки.
      assert(tileSprite(T.COBBLE) === 'cobble' && tileSprite(T.GRASS) === 'grass', 'мостовая как трава');
      for (const k of ['COLUMN', 'ALTAR', 'WELL', 'STAIRS_DOWN', 'CHEST', 'SARCOPHAGUS', 'CAMPFIRE'])
        assert(tileSprite(T[k]) && SPRITES[tileSprite(T[k])], 'нет картинки: ' + k);
      // Взгляд мышью: далеко — не разглядеть.
      leaveLocal();
      G.weather = { kind: 'clear', until: G.minutes + 9999 };
      while (isNight()) G.minutes += 60;
      assert(withinSight(G.ox + 5, G.oy) && !withinSight(G.ox + 20, G.oy), 'днём видно не то');
      while (!isNight()) G.minutes += 60;
      assert(!withinSight(G.ox + 5, G.oy), 'ночью видно далеко');
      return `пашен ${fields}, вдали ${far}`;
    },
  },

  {
    name: 'Вести: один человек — одна-две за день',
    run() {
      const p = TH.start();
      TH.go(TH.city('florence'));
      p.skills.speech = { lvl: 0, xp: 0 };
      const peasant = G.world.villages[0].npcs.find(n => n.role === 'peasant' && !newsless(n)), inn = TH.npc('innkeeper');
      const ask = n => TH.ask(n, 'Что нового');
      // Сверх меры счётчик не растёт (ответ — «уже всё рассказал», в мужском или женском роде).
      for (let k = 0; k < 3; k++) ask(peasant);
      assert(peasant.newsCount === 1, 'горожанин рассказал больше одной вести: ' + peasant.newsCount);
      for (let k = 0; k < 4; k++) ask(inn);
      assert(inn.newsCount === 2, 'трактирщик рассказал не две: ' + inn.newsCount);
      G.minutes += 1440;
      ask(peasant);
      assert(peasant.newsCount === 1 && peasant.newsDay === timeInfo().day, 'назавтра молчит');
      return 'вести дозированы';
    },
  },

  {
    name: 'Доставка: срок не короче дороги',
    run() {
      TH.start();
      let n = 0;
      for (const c of G.over.cities.filter(c => c.kind === 'city').slice(0, 20)) {
        TH.go(c);
        for (const npc of G.world.villages[0].npcs) {
          if (!QUEST_GIVERS[questRole(npc)]) continue;
          const o = offerDelivery(npc);
          if (!o || /за проливом|за морем/.test(o.text)) continue;   // морем — срок по плаванию
          const dest = G.over.cities.find(x => x.id === o.to), km = kmBetween(c, dest), days = o.deadline - timeInfo().day;
          assert(days >= Math.ceil(km / 30) + 1, `${c.name} → ${dest.name}: ${Math.round(km)} км (${daysText(km)}), а срок ${days} дн.`);
          assert(o.text.includes(daysText(km)), 'в поручении не сказано, сколько идти');
          n++;
          break;
        }
      }
      return `${n} поручений проверено`;
    },
  },

  {
    name: 'Прицельные удары: зоны, строение, эффекты, выключатель',
    run() {
      const p = TH.start();
      TH.immortal();
      leaveLocal(); enterWild(false);
      G.world.actors = G.world.actors.filter(a => a.kind !== 'beast');
      // Переключатель: корпус → голова → руки → ноги → корпус.
      assert((p.aim || 'body') === 'body', 'по умолчанию не корпус');
      const seq = [];
      for (let i = 0; i < 4; i++) { handleKey({ code: 'KeyV', key: 'v' }); seq.push(p.aim); }
      assert(seq.join() === 'head,arms,legs,body', 'прицел не переключается: ' + seq);
      // Строение: у волка нет рук — удар в корпус; у змеи — голова есть, ног нет; у летучей мыши — только тело.
      const wolf = TH.spawn('wolf', 1, 0), viper = TH.spawn('viper', 0, 1), bat = TH.spawn('bat', -1, 0);
      p.aim = 'arms'; assert(aimFor(wolf) === 'body' && zoneName(wolf, 'legs') === 'лапы', 'волк с руками');
      p.aim = 'legs'; assert(aimFor(viper) === 'body', 'у змеи ноги');
      p.aim = 'head'; assert(aimFor(viper) === 'head' && aimFor(bat) === 'body', 'строение');
      // Голова: штраф к попаданию меньше у мастера; урон больше.
      p.skills.axe = { lvl: 0, xp: 0 };
      const a0 = aimAcc(wolf); p.skills.axe.lvl = 6; const a6 = aimAcc(wolf);
      assert(a0 === -5 && a6 > a0, 'навык не снижает штраф: ' + a0 + ' ' + a6);
      const chance = rng.chance; rng.chance = () => true;
      const [d1, n1] = aimHit(wolf, 10, false);
      assert(d1 === 13 && wolf.stunTurn > 0 && /оглуш/.test(n1), 'голова: ' + d1 + ' ' + n1);
      // Оглушённый пропускает ход.
      assert(aimSkipTurn(wolf), 'оглушённый ходит');
      // Шлем у латника гасит удар в голову.
      const sold = TH.spawn('imperial_soldier', 2, 2);
      const [d2] = aimHit(sold, 10, false);
      assert(d2 < 13, 'шлем не помогает');
      // Ноги — хромота; руки — слабее бьёт.
      p.aim = 'legs'; aimHit(wolf, 10, false);
      p.aim = 'arms'; aimHit(sold, 10, false);
      rng.chance = chance;
      assert(wolf.slowTurn > G.turn && aimWeak(sold) < 1, 'увечья не легли');
      // Выключатель: без прицела всё в корпус, панель без строки.
      G.aimOff = true;
      p.aim = 'head';
      assert(aimFor(wolf) === 'body' && aimAcc(wolf) === 0 && !/Прицел/.test(panelHtml()), 'выключатель не работает');
      G.aimOff = false;
      assert(/Прицел/.test(panelHtml()), 'нет строки прицела на панели');
      // Стрельба: тот же прицел, свой навык; оглушает реже.
      p.aim = 'head'; p.skills.bow = { lvl: 0, xp: 0 };
      assert(aimAcc(wolf, 'bow') === -5, 'штраф выстрела в голову');
      p.skills.bow.lvl = 8;
      assert(aimAcc(wolf, 'bow') === -1, 'навык стрельбы не снижает штраф');
      // Зоны по герою: змея кусает в ноги, ворон — в лицо; броня зоны.
      const zs = new Set(); for (let i = 0; i < 200; i++) zs.add(heroZone(viper));
      assert(!zs.has('head') && zs.has('legs'), 'змея бьёт в голову: ' + [...zs]);
      const zc = new Set(); for (let i = 0; i < 200; i++) zc.add(heroZone(bat));
      assert(!zc.has('legs'), 'летучая мышь бьёт по ногам');
      p.equip.head = makeItem('nasal'); p.equip.legs = null; p.equip.feet = null;
      assert(zoneArmor(p, 'head') > zoneArmor(p, 'legs'), 'шлем не бережёт голову');
      // Удар твари пишет, куда пришёлся.
      G.messages.length = 0;
      wolf.stunTurn = 0; wolf.slowTurn = 0; wolf.weakTurn = 0;
      for (let i = 0; i < 30 && !G.messages.some(m => /в корпус|в голову|по рукам|по ногам/.test(m.text)); i++) beastAttack(wolf);
      assert(G.messages.some(m => /в корпус|в голову|по рукам|по ногам/.test(m.text)), 'удар без зоны: ' + TH.lastLog(3));
      return 'прицел работает';
    },
  },

  {
    name: 'Бестиарий-книга: оглавление, главы, листание',
    run() {
      TH.start();
      const b = new BestiaryScreen();
      pushScreen(b);
      const k = code => b.key({ code, key: code });
      assert(b.ch === -1 && b.chapters.length === BEAST_CATS.length, 'нет оглавления');
      assert(b.chapters.reduce((n, c) => n + c.keys.length, 0) === BEAST_ORDER.length, 'не все существа в главах');
      k('ArrowDown'); k('Enter');
      assert(b.ch === 1, 'глава не открылась');
      k('ArrowRight'); assert(b.ch === 2 && b.sel === 0, 'не листается');
      k('ArrowLeft'); k('ArrowLeft'); k('ArrowLeft'); assert(b.ch === b.chapters.length - 1, 'не листается по кругу');
      render();
      k('Escape'); assert(b.ch === -1 && G.screens.includes(b), 'Esc не вернул к оглавлению');
      k('Escape'); assert(!G.screens.includes(b), 'книга не закрылась');
      return `${b.chapters.length} глав`;
    },
  },

  {
    name: 'Нрав зверей: вороны, крысы и нетопыри не бросаются на здорового путника',
    run() {
      const p = TH.start();
      TH.immortal();
      // В пути из засады выходят только настоящие хищники.
      for (let i = 0; i < 400; i++) {
        const x = rng.int(0, G.over.w - 1), y = rng.int(0, G.over.h - 1);
        if (!G.over.passable(x, y)) continue;
        const k = chooseEncounter(x, y, i % 2 === 0);
        assert(!['crow', 'rat', 'bat'].includes(k), 'в пути напал: ' + k);
      }
      TH.go(TH.city('rome')); leaveLocal(); enterWild(false);
      const crow = TH.spawn('crow', 2, 0), rat = TH.spawn('rat', 0, 2);
      assert(beastMode(crow) === 'flee' && beastMode(rat) === 'flee', 'на воле нападают');
      p.hp = Math.floor(p.maxHp / 4);
      assert(beastMode(crow) === 'hostile', 'вороньё не слетается на ослабевшего');
      p.hp = p.maxHp;
      rat.provoked = true;
      assert(beastMode(rat) === 'hostile', 'загнанная крыса не кусается');
      G.world.kind = 'dungeon';
      const rat2 = TH.spawn('rat', 2, 2);
      assert(beastMode(rat2) === 'hostile', 'в подземелье крысы смирные');
      return 'вороны сторонятся живых';
    },
  },

  {
    name: 'Встреча в пути: не останавливает игру; Enter рядом — сценка с выбором',
    run() {
      const p = TH.start();
      TH.immortal();
      leaveLocal();
      const ow = G.over;
      let spot = null;
      for (let i = 0; i < 5000 && !spot; i++) {
        const x = rng.int(5, ow.w - 6), y = rng.int(5, ow.h - 6);
        if (ow.passable(x, y) && ow.passable(x + 1, y) && !nearSettlement(x, y) && !ow.placeAt(x, y) && WAR_REGIONS.includes(ow.regionAt(x, y))) spot = [x, y];
      }
      G.ox = spot[0]; G.oy = spot[1];
     
      const mk = (kind, f) => ({ id: 'm' + kind, kind, from: 'rome', to: 'rome', path: [ow.idx(G.ox + 1, G.oy)], i: 0, acc: 0, x: G.ox + 1, y: G.oy, n: 8, faction: f });
      // Сытые паломники хлеба не просят.
      const full = mk('pilgrims'); full.traits = { hungry: false }; full.met = true;
      G.travelers.push(full);
      assert(!travelerOptions(travelerNpc(full)).some(o => o.label === 'Поделиться провиантом'), 'сытым — хлеб');
      const hungry = mk('pilgrims'); hungry.traits = { hungry: true };
      G.travelers = [hungry];
      assert(!meetTravelers() && G.screens.length === 1 && /Рядом: паломники/.test(TH.lastLog()), 'встреча остановила игру или не попала в журнал');
      overEnter();
      const d = G.screens[G.screens.length - 1];
      const labels = d.options.map(o => o.label);
      assert(G.mode === 'over' && d.npc.meeting && /паломник/i.test(d.text) && labels.includes('Поделиться провиантом') && labels.includes('Пройти мимо'), 'сценка: ' + labels.join('|'));
      p.rations = 2;
      d.choose(labels.indexOf('Поделиться провиантом'));
      assert(p.rations === 1 && !d.options.some(o => o.label === 'Поделиться провиантом'), 'выбор не сработал');
      while (G.screens.length > 1) popScreen();
      // Второй разговор — уже без сценки.
      overEnter();
      assert(!G.screens[G.screens.length - 1].npc.meeting, 'сценка повторилась');
      while (G.screens.length > 1) popScreen();
      // Путники у ворот города: выбор — войти или заговорить.
      const city = G.over.cities.find(c => c.type === 'city' && c.kind === 'town') || G.over.cities.find(c => c.type === 'city');
      G.ox = city.x; G.oy = city.y;
      G.travelers = [{ ...mk('caravan'), x: city.x, y: city.y + 1 }, { ...mk('friars'), id: 'mf', x: city.x + 1, y: city.y }];
      overEnter();
      const ch = G.screens[G.screens.length - 1];
      assert(ch instanceof ChoiceScreen && ch.options.length === 3 && /^Войти/.test(ch.options[0].label), 'нет выбора у ворот: ' + (ch.options || []).map(o => o.label));
      ch.choose(1);
      assert(G.mode === 'over' && G.screens[G.screens.length - 1].npc.traveler.kind === 'caravan', 'не заговорил с обозом');
      while (G.screens.length > 1) popScreen();
      overEnter(); G.screens[G.screens.length - 1].choose(0);
      assert(G.mode === 'local' && G.world.place && G.world.place.id === city.id || G.mode === 'local', 'не вошёл в город');
      if (G.mode === 'local') leaveLocal();
      G.ox = spot[0]; G.oy = spot[1];
      // Отряд гибеллинов: «я за папу» — пошлина.
      G.travelers = [mk('ghibs', 'ghib')];
      overEnter();
      const d2 = G.screens[G.screens.length - 1];
      assert(/Кто таков/.test(d2.text), 'сержант молчит');
      p.coins = 50;
      d2.choose(d2.options.findIndex(o => o.label === '«Я за папу»'));
      assert(p.coins === 50 && /пошлин/.test(d2.text) && d2.npc.noEscape, 'гибеллины не потребовали пошлину с гвельфа');
      assert(d2.options.some(o => /Заплатить/.test(o.label)) && d2.options.some(o => /не получите/.test(o.label)), 'нет выбора: платить или нет');
      d2.choose(d2.options.findIndex(o => /Заплатить/.test(o.label)));
      assert(p.coins < 50 && !d2.npc.noEscape, 'пошлина не заплачена');
      while (G.screens.length > 1) popScreen();
      // Другой отряд: отказ — драка.
      G.travelers = [mk('ghibs', 'ghib')];
      overEnter();
      const d3 = G.screens[G.screens.length - 1];
      d3.choose(d3.options.findIndex(o => o.label === '«Я за папу»'));
      d3.choose(d3.options.findIndex(o => /не получите/.test(o.label)));
      assert(G.mode === 'local' && G.world.actors.some(a => a.key === 'imperial_soldier') && !G.travelers.length, 'отказ не привёл к драке');
      leaveLocal();
      while (G.screens.length > 1) popScreen();
      return 'встречи работают';
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
      // Не всякий продаёт с воза.
      pe.traits = { trades: false };
      const no = travelerNpc(pe), noOpts = travelerOptions(no);
      assert(!noOpts.some(o => /Купить припасов/.test(o.label)), 'торгует тот, кто везёт в город');
      assert(/рынк|не на продажу/.test(noOpts.find(o => /Продадите/.test(o.label)).act()), 'не объяснил отказ');
      pe.traits = { trades: true };
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
      assert(topScreen().robbery, 'нет выбора «кошелёк или жизнь»');
      topScreen().choose(1);   // драться
      assert(G.mode === 'local' && G.world.actors.some(a => a.key === 'brigand'), 'разбойники не напали');
      return `путников ${G.travelers.length}`;
    },
  },

  {
    name: 'Заказ замка: шкуры и рога — только в замках, по зверям округи',
    run() {
      TH.start(); TH.immortal();
      const p = G.player;
      // Замок без особой славы — на севере Италии, а если там такого не выпало — где угодно в Италии.
      const plain = c => c.kind === 'castle' && !c.famous;
      const castle = G.over.cities.find(c => plain(c) && ['tuscany', 'lombardy', 'piedmont', 'emilia'].includes(c.region))
        || G.over.cities.find(c => plain(c) && !FOREIGN_REGIONS.includes(c.region));
      TH.go(castle);
      const el = TH.npc('elder');
      let o = null;
      for (let i = 0; i < 60 && !(o && o.type === 'trophy'); i++) { el.offer = null; el.noWorkUntil = 0; castle.lastTrophy = null; TH.ask(el, 'Нет ли для меня работы'); o = el.offer; }
      assert(o && o.type === 'trophy', 'кастелян не заказывает трофеев');
      const beast = TROPHY_ORDERS.find(t => t.id === o.trophy).beast;
      assert(beastInRegion(BEASTS[beast], castle.region), `заказан зверь не из этих краёв: ${beast}`);
      assert(o.reward > BEASTS[beast].loot.value * o.need, 'платят не больше купцов');
      TH.ask(el, o.accept);
      const q = p.quests.find(x => x.type === 'trophy');
      assert(q && /0\/\d/.test(questLine(q)), 'заказа нет в журнале');
      // Добыча: трофеи со зверя.
      const loot = BEASTS[beast].loot;
      for (let k = 0; k < q.need + 1; k++) { p.trophies[loot.id] = p.trophies[loot.id] || { name: loot.name, value: loot.value, count: 0 }; p.trophies[loot.id].count++; }
      assert(questLine(q).includes('✓'), 'набранный заказ не отмечен');
      const c0 = p.coins;
      TH.ask(el, /^Вот:/);
      assert(!p.quests.includes(q) && p.coins === c0 + q.reward && p.trophies[loot.id].count === 1, 'заказ не сдан как надо');
      // В деревнях и городах такого не заказывают.
      const vil = G.over.cities.find(c => c.kind === 'village');
      TH.go(vil);
      const ve = TH.npc('elder');
      for (let i = 0; i < 40; i++) { ve.offer = null; ve.noWorkUntil = 0; TH.ask(ve, 'Нет ли для меня работы'); assert(!ve.offer || ve.offer.type !== 'trophy', 'деревня заказывает трофеи'); }
      return `${castle.name}: ${loot.name} ×${q.need} за ${q.reward} мон.`;
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
      G.ox = dest.x; G.oy = dest.y; car.x = dest.x; car.y = dest.y; car.waiting = false; G.travelers = [car];
      const c0 = p.coins;
      TH.enter();
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
      topScreen().choose(1);   // драться
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
    name: 'Бестиарий: дезертир в шайке, чудища из книг — не для новичка',
    run() {
      TH.start(); TH.immortal();
      const p = G.player;
      leaveLocal(); enterWild(false);
      // Новичку дезертир не попадается: шайки — одни разбойники, и не больше двух.
      p.level = 3;
      for (let k = 0; k < 40; k++) assert(gangKey(2, 3) === 'brigand', 'дезертир у новичка');
      // Окрепшему — иногда, и всегда вместо разбойника: шайка не растёт, дезертир в ней один.
      p.level = 1;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (G.world.inside(p.x + 6 + dx, p.y + dy)) G.world.set(p.x + 6 + dx, p.y + dy, T.GRASS);
      for (let k = 0; k < 40; k++) { G.world.actors = G.world.actors.filter(a => a.kind !== 'beast'); assert(placeGroup('brigand', p.x + 6, p.y).length <= 2, 'новичку — трое разбойников'); }
      p.level = 4;
      // Шайке нужно где встать: расчистить поляну (дикая карта бывает и скалистой).
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (G.world.inside(p.x + 6 + dx, p.y + dy)) G.world.set(p.x + 6 + dx, p.y + dy, T.GRASS);
      let des = 0, gangs = 0;
      for (let k = 0; k < 300; k++) {
        G.world.actors = G.world.actors.filter(a => a.kind !== 'beast');
        const g = placeGroup('brigand', p.x + 6, p.y);
        if (g.length < 2) continue;
        gangs++;
        assert(g.length <= BEASTS.brigand.group[1], 'шайка выросла');
        const d = g.filter(a => a.key === 'deserter').length;
        assert(d <= 1, 'два дезертира в шайке');
        des += d;
      }
      assert(des > gangs * 0.1 && des < gangs * 0.45, `дезертиров не столько: ${des} из ${gangs}`);
      // Дезертир сильнее разбойника, но не сильнее имперского солдата.
      const D = BEASTS.deserter;
      assert(D.hp > BEASTS.brigand.hp && D.hp <= BEASTS.imperial_soldier.hp && !D.weight, 'дезертир не в меру');
      // Засада у обоза: дезертир — тоже разбойник, бой с ним считается.
      assert(GANG.has('deserter'), 'дезертир не из шайки');
      // Чудища из бестиариев: везде, но редко и с уровня.
      const books = ['amphisbaena', 'basilisk', 'griffin', 'manticore', 'chimera'];
      for (const k of books) {
        const b = BEASTS[k];
        assert(b && !b.regions && b.max === 1 && b.weight <= 0.3 && b.minLvl >= 2 && b.loot && b.desc, `не так: ${k}`);
      }
      G.world.actors = G.world.actors.filter(a => a.kind !== 'beast');
      const all = (lvl) => { p.level = lvl; const s = new Set();
        for (const r of ['tuscany', 'helvetia', 'carantania', 'provence', 'sicily'])
          for (const h of ['field', 'hill', 'pine', 'forest', 'marsh']) for (const o of beastChoices(r, h, false, false)) s.add(o.key);
        return s; };
      const low = all(1), high = all(8);
      assert(!books.some(k => low.has(k)), 'чудища у новичка');
      assert(books.every(k => high.has(k)), 'чудищ нет и у бывалого: ' + books.filter(k => !high.has(k)));
      // Заказов на них новичку не дают.
      p.level = 1;
      const vil = G.over.cities.find(c => c.kind === 'village' && c.region === 'tuscany');
      TH.go(vil);
      const el = TH.npc('elder');
      for (let i = 0; i < 60; i++) {
        vil.lastTarget = null; const o = offerKill(el);
        assert(!o || !books.includes(o.target), 'заказ на чудище новичку');
      }
      return `дезертиров ${des} на ${gangs} шаек`;
    },
  },

  {
    name: 'Ведьмы, оборотни и римские гробницы — по всей бывшей империи',
    run() {
      TH.start(); TH.immortal();
      const ow = G.over;
      const want = { tuscany: ['Стрега', 'Лупо маннаро'], helvetia: ['Хексе', 'Вервольф'], carantania: ['Вешча', 'Волкодлак'],
        provence: ['Маска', 'Лу-гару'], languedoc: ['Маска', 'Лу-гару'] };
      for (const [reg, [witch, wolf]] of Object.entries(want)) {
        assert(beastInRegion(BEASTS.strega, reg) && beastInRegion(BEASTS.werewolf, reg), `нет ведьм/оборотней: ${reg}`);
        const c = ow.cities.find(c => c.region === reg && c.kind === 'village');
        G.ox = c.x; G.oy = c.y;
        const w = makeBeast('strega', 0, 0), ww = makeBeast('werewolf', 0, 0);
        assert(w.name === witch && w.def.acc && ww.name === wolf, `${reg}: ${w.name}, ${ww.name}`);
        // Имя переживает сохранение.
        const back = JSON.parse(JSON.stringify({ ...ww, def: null }));
        assert(beastLocal(BEASTS[back.key], back.lreg).name === wolf, 'имя потерялось при загрузке');
        assert(BEASTS.wolf.name === 'Волк', 'волк всё ещё апеннинский');
      }
      assert(/вешча/.test(beastAka(BEASTS.strega)) && /лу-гару/.test(beastAka(BEASTS.werewolf)), 'в книге нет местных имён');
      // Логово оборотня за Альпами: местный зверь в поручении.
      const vil = ow.cities.find(c => c.region === 'carantania' && c.kind === 'village');
      G.player.level = 6;
      TH.go(vil);
      const el = TH.npc('elder');
      let o = null;
      for (let i = 0; i < 200 && !(o && o.lairKind === 'werewolf'); i++) { vil.lastLair = null; o = offerLair(el); }
      assert(o && o.lairKind === 'werewolf' && /волкодлака/.test(o.text), 'в Карантании не просят убить волкодлака');
      // Римские гробницы в каждой бывшей провинции — у руин своих городов.
      const tombs = ow.sites.filter(s => s.type === 'roman');
      for (const reg of ['helvetia', 'carantania', 'provence', 'languedoc']) {
        const here = tombs.filter(s => s.region === reg);
        assert(here.length >= 1, `нет римских гробниц: ${reg}`);
        for (const s of here) {   // руины в названии — ближайшие, а не за тридевять земель
          const ruin = ROMAN_RUINS[reg].find(([n]) => s.name.endsWith(' у ' + n));
          if (!ruin) continue;
          const [lon, lat] = xyToGeo(s.x + 0.5, s.y + 0.5);
          assert(geoKm(lon, lat, ruin[1], ruin[2]) < 50, `${s.name} далеко от руин`);
        }
      }
      assert(tombs.filter(s => !FOREIGN_REGIONS.includes(s.region)).length >= 5, 'в Италии гробниц стало меньше');
      // Митреумы Норика: в Карантании, а в Италии их по-прежнему три.
      const mith = ow.sites.filter(s => s.type === 'mithraeum');
      assert(mith.filter(s => s.region === 'carantania').length === 1, 'митреумов в Карантании не один');
      assert(mith.filter(s => !FOREIGN_REGIONS.includes(s.region)).length === DUNGEON_TYPES.mithraeum.count, 'митреумов в Италии не столько');
      assert(!mith.some(s => FOREIGN_REGIONS.includes(s.region) && !(s.region in DUNGEON_TYPES.mithraeum.lands)), 'митреум не там');
      return tombs.concat(mith).filter(s => FOREIGN_REGIONS.includes(s.region)).map(s => s.name).join('; ');
    },
  },

  {
    name: 'Остережения: о чудищах края рассказывают местные, бестиарий — по рассказам',
    run() {
      TH.start(); TH.immortal();
      const p = G.player, ow = G.over;
      const vil = ow.cities.find(c => c.region === 'provence' && c.kind === 'village');
      TH.go(vil);
      const npcs = G.world.villages[0].npcs.filter(n => ['peasant', 'elder', 'innkeeper', 'herbalist'].includes(n.role));
      let heard = null;
      for (let d = 0; d < 40 && !(p.heard && p.heard.tarasque); d++) {
        G.minutes += 24 * 60;
        for (const n of npcs) { n.newsless = false; const r = newsReply(n); if (BEASTS.tarasque.warn.some(w => r.includes(w.slice(0, 30)))) heard = r; }
      }
      assert(heard && p.heard.tarasque && p.heard['tarasque@france'], 'о Тараске не предостерегли');
      const e = p.rumors.find(r => r.kind === 'beast' && r.beast === 'tarasque');
      assert(e && /остерегайся/.test(rumorStatus(e).text) && /Остережение/.test(rumorDetail(e)), 'остережения нет в журнале');
      assert(/по рассказам/.test(beastEntryHtml('tarasque')), 'в бестиарии нет Тараски по рассказам');
      // В той же земле второй раз о ней не твердят; о чужих чудищах — не рассказывают.
      const again = [];
      for (let d = 0; d < 15; d++) { G.minutes += 24 * 60; for (const n of npcs) again.push(newsReply(n)); }
      const warned = (r, k) => BEASTS[k].warn.some(w => r.includes(w.slice(0, 30)));
      assert(!again.some(r => warned(r, 'tarasque')), 'про Тараску предостерегают снова');
      assert(!again.some(r => ['lindwurm', 'giant', 'orco', 'zlatorog', 'alp_dragon'].some(k => warned(r, k))), 'предостерегают о чужом чудище');
      // Встретил — узнал по рассказам.
      leaveLocal(); enterWild(false);
      G.world.actors = G.world.actors.filter(a => a.kind !== 'beast');
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (G.world.inside(p.x + dx, p.y + dy)) G.world.set(p.x + dx, p.y + dy, T.GRASS);
      const logs = [], ol = window.log; window.log = (t) => logs.push(t);
      assert(TH.spawn('tarasque', 2, 0), 'Тараска не поставилась');
      refreshFov();
      window.log = ol;
      assert(p.seen.tarasque && logs.some(t => /узнаёшь его по рассказам/.test(t)), 'не узнал по рассказам: ' + logs.join(' | '));
      return heard.slice(0, 80);
    },
  },

  {
    name: 'Земля катаров: Поле сожжённых и обряд, пещеры «добрых людей», инквизиторы',
    run() {
      TH.start(); TH.immortal();
      const p = G.player, ow = G.over;
      // Капеллан Монсегюра просит проводить его на поле.
      const castle = ow.cities.find(c => c.name === 'Монсегюр'), site = crematsSite();
      assert(site && site.region === 'languedoc' && Math.hypot(site.x - castle.x, site.y - castle.y) <= 5 && !(site.x === castle.x && site.y === castle.y), 'поле не у Монсегюра');
      TH.go(castle);
      const pr = TH.npc('priest');
      p.level = 2;
      assert(/рано/.test(TH.ask(pr, 'Что за огни')), 'новичка позвали на поле');
      p.level = 4;
      TH.ask(pr, 'Что за огни');
      TH.ask(pr, 'Провожу');
      assert(montsegurStage() === 1 && p.quests.some(q => q.id === 'montsegur'), 'поручения нет');
      assert(questTarget(p.quests.find(q => q.id === 'montsegur')) === site, 'компас не на поле');
      // Поле: жуть, тени, капеллан рядом.
      leaveLocal();
      G.ox = site.x; G.oy = site.y;
      enterSite(site);
      const w = G.world;
      assert(w.actors.some(a => a.key === 'burned_shade'), 'на поле нет теней');
      assert([...w.tiles].includes(T.CINDERS) && [...w.tiles].includes(T.STAKE), 'нет пепелища и столбов');
      const ex = w.actors.find(a => a.special === 'exorcist');
      assert(ex, 'капеллан не пришёл');
      assert(!TH.options(ex).some(l => /Начинай/.test(l)), 'обряд — без рассказа');
      const story = [];
      for (let i = 0; i < 4; i++) story.push(TH.ask(ex, /Что здесь случилось|Что было дальше/));
      assert(/Авиньонет/.test(story.join(' ')) && /Шестнадцатого марта/.test(story.join(' ')), 'капеллан не рассказал о крепости');
      TH.ask(ex, 'Начинай обряд');
      assert(w.rite, 'обряд не начался');
      // Отойти — чтение встаёт.
      p.x = 2; p.y = 2;
      const t0 = w.rite.turns;
      for (let i = 0; i < 5; i++) endTurn();
      assert(w.rite.turns === t0, 'обряд идёт без героя');
      // Рядом — идёт, тени собираются, а потом исчезают.
      const c0 = p.coins;
      let spawned = 0;
      for (let i = 0; i < 60 && !crematsCleansed(); i++) {
        const spot = DIRS8.map(([dx, dy]) => [ex.x + dx, ex.y + dy]).find(([x, y]) => w.free(x, y) || (x === p.x && y === p.y));
        if (spot) { p.x = spot[0]; p.y = spot[1]; }
        endTurn();
        spawned = Math.max(spawned, w.actors.filter(a => a.key === 'burned_shade').length);
      }
      assert(crematsCleansed() && montsegurStage() === 3 && !p.quests.some(q => q.id === 'montsegur'), 'обряд не завершён');
      assert(p.coins > c0 && !w.actors.some(a => a.key === 'burned_shade'), 'награды нет или тени остались');
      leaveLocal(); enterSite(site);
      assert(!G.world.actors.some(a => a.key === 'burned_shade'), 'после обряда — снова тени');
      // Пещеры «добрых людей»: спрятаны, о них не болтают; нашёл — можно молчать или донести.
      const caves = catharSites();
      assert(caves.length === 2 && caves.every(c => c.hidden && c.region === 'languedoc'), 'пещер нет');
      const cave = caves[0];
      leaveLocal();
      G.ox = cave.x; G.oy = cave.y;
      for (let i = 0; i < 40 && cave.hidden; i++) spotTombs(cave.x, cave.y, true);
      assert(!cave.hidden, 'пещеру не найти');
      enterSite(cave);
      const folk = G.world.actors.filter(a => a.cathar);
      assert(folk.length === 3 && folk.some(a => a.title === 'Добрый человек'), 'в пещере никого');
      assert(/Монсегюр|костр/.test(TH.ask(folk[0], 'Что было в Монсегюре')), 'о Монсегюре молчат');
      TH.ask(folk[0], 'Не бойтесь');
      assert(cave.promised, 'обещание не записано');
      leaveLocal();
      // Инквизиторы: в Лангедоке — есть, в Провансе — нет.
      const tls = TH.city('toulouse');
      G.ox = tls.x; G.oy = tls.y; G.travelers = [];
      assert(inquisitorsCount() === 2, 'в Лангедоке нет инквизиторов');
      let inq = null;
      for (let k = 0; k < 40 && !inq; k++) inq = spawnTraveler('inquisitors', G.ox, G.oy, true);
      assert(inq && /^Брат /.test(travelerNpc(inq).name), 'инквизитор не вышел на дорогу');
      const mrs = TH.city('marseille'); G.ox = mrs.x; G.oy = mrs.y;
      assert(inquisitorsCount() === 0, 'инквизиторы в Провансе');
      G.ox = tls.x; G.oy = tls.y;
      const npc = travelerNpc(inq), piety0 = p.piety, c1 = p.coins;
      const r = TH.ask(npc, 'Я знаю, где прячутся');
      assert(r && cave.betrayed && p.coins > c1 && p.piety < piety0, 'донос не сработал (или слово нарушено без последствий)');
      G.ox = cave.x; G.oy = cave.y;
      enterSite(cave);
      assert(!G.world.actors.some(a => a.cathar), 'выданные всё ещё в пещере');
      return `${site.name}; ${caves.map(c => c.name).join(', ')}; ${npc.name}`;
    },
  },

  {
    name: 'Дозоры чужих земель ловят шайки; у околицы шайка не топчется, а уходит',
    run() {
      TH.start(); TH.immortal();
      const ow = G.over;
      for (const [kind, city] of [['vogt', 'zurich'], ['carinthian', 'ljubljana'], ['anjou', 'marseille'], ['seneschal', 'toulouse']]) {
        const c = TH.city(city);
        G.ox = c.x; G.oy = c.y; G.mode = 'over'; G.travelers = [];
        let t = null;
        for (let k = 0; k < 40 && !t; k++) t = spawnTraveler(kind, G.ox, G.oy, true);
        assert(t && TRAVELER_KINDS[kind].law, `нет дозора: ${kind}`);
        assert([t.from, t.to].every(id => TRAVELER_KINDS[kind].regions.includes(placeById(id).region)), `дозор ходит не между городами своей земли: ${kind}`);
        assert(MEET_SCENES[kind] && TRAVELER_LIFE[kind] && travelerNpc(t).title, `дозору нечего сказать: ${kind}`);
        // Шайка рядом с дозором — попалась.
        const b = { id: 'trB' + kind, kind: 'brigands', x: t.x + 1, y: t.y, path: [], i: 0, acc: 0, n: 4 };
        G.travelers.push(t, b);
        G.ox = t.x + 30; G.oy = t.y;
        brigandStep(b);
        assert(!G.travelers.includes(b), `дозор не тронул шайку: ${kind}`);
      }
      // В Италии таких дозоров нет.
      const fl = TH.city('florence'); G.ox = fl.x; G.oy = fl.y;
      for (const kind of ['vogt', 'carinthian', 'anjou', 'seneschal']) assert(!spawnTraveler(kind, G.ox, G.oy, true), `${kind} в Тоскане`);
      // Герой у околицы: шайка рядом не стоит, а уходит.
      const vil = ow.cities.find(c => c.kind === 'village' && c.region === 'languedoc');
      G.ox = vil.x; G.oy = vil.y; G.travelers = [];
      const spot = DIRS8.map(([dx, dy]) => [vil.x + dx * 2, vil.y + dy * 2]).find(([x, y]) => ow.passable(x, y) && !ow.placeAt(x, y));
      const band = { id: 'trS', kind: 'brigands', x: spot[0], y: spot[1], path: [], i: 0, acc: 0, n: 4 };
      G.travelers.push(band);
      const d0 = Math.max(Math.abs(band.x - G.ox), Math.abs(band.y - G.oy));
      for (let k = 0; k < 4; k++) brigandStep(band);
      const d1 = Math.max(Math.abs(band.x - G.ox), Math.abs(band.y - G.oy));
      assert(G.travelers.includes(band) && d1 > d0, `шайка у околицы стоит или лезет к герою: ${d0} → ${d1}`);
      return `до шайки: ${d0} → ${d1}`;
    },
  },

  {
    name: 'Святая Мария Магдалина в Сент-Боме; Святые Марии у моря — паломничество',
    run() {
      TH.start(); TH.immortal();
      const p = G.player;
      const sb = G.over.cities.find(c => c.name === 'Сент-Бом');
      TH.go(sb);
      const pr = TH.npc('priest');
      const opts = TH.options(pr);
      assert(opts.some(l => /пещере святой Марии Магдалины/.test(l)) && opts.some(l => /Избрать покровителем: Святая Мария Магдалина/.test(l)), 'нет паломничества в Сент-Бом');
      const pi0 = p.piety;
      assert(/тридцать лет/.test(TH.ask(pr, 'Помолиться в пещере')) && p.piety > pi0, 'паломничество не засчитано');
      p.piety = 40;
      assert(/небесная заступница/.test(TH.ask(pr, 'Избрать покровителем')) && p.patron === 'magdalene', 'не избрана покровительницей');
      // Дар: грехи отнимают вдвое меньше.
      const a = p.piety; addPiety(-6, 'тест'); assert(a - p.piety === 3, `грех отнял ${a - p.piety}, а не 3`);
      // Милость — за исповедь и милостыню; чудо — слёзы покаяния.
      p.favor = 0; faithDeed('confess'); faithDeed('donate');
      assert(p.favor === 6, `милость ${p.favor}`);
      p.grace = 0; p.heresy = 5; p.hp = 1;
      miracle(p);
      assert(p.grace === p.maxGrace && p.heresy === 1 && p.hp > 1, 'чудо не сработало');
      assert(feastsOn({ y: 1247, m: 7, d: 22, wd: 1 }).some(f => f.saint === 'magdalene'), 'нет праздника');
      // Святые Марии: паломничество есть, покровительства нет.
      const sm = G.over.cities.find(c => c.name === 'Нотр-Дам-де-ла-Мер');
      TH.go(sm);
      const pr2 = TH.npc('priest');
      const o2 = TH.options(pr2);
      assert(o2.some(l => /Святым Мариям/.test(l)) && !o2.some(l => /Избрать покровителем/.test(l)), 'Святые Марии — не так');
      assert(/лодке без вёсел/.test(TH.ask(pr2, 'Поклониться Святым Мариям')), 'нет паломничества к морю');
      return SAINTS.magdalene.passiveText;
    },
  },

  {
    name: 'Святая Марфа в Тарасконе: паломничество, дар, милость, «Кропило и крест»',
    run() {
      TH.start(); TH.immortal();
      const p = G.player;
      const tr = G.over.cities.find(c => c.name === 'Тараскон');
      TH.go(tr);
      const pr = TH.npc('priest');
      assert(pr, 'в Тарасконе нет священника');
      assert(/1187/.test(TH.ask(pr, 'Поклониться мощам святой Марфы')), 'нет паломничества к Марфе');
      p.piety = 40;
      assert(/небесная заступница/.test(TH.ask(pr, 'Избрать покровителем')) && p.patron === 'martha', 'Марфа не избрана');
      // Голод — медленнее.
      p.food = 80; survivalTick(p, 600); const withM = 80 - p.food;
      p.patron = null; p.food = 80; survivalTick(p, 600); const without = 80 - p.food; p.patron = 'martha';
      assert(Math.abs(withM / without - 0.8) < 0.02, `голод не на пятую часть медленнее: ${withM} / ${without}`);
      // Милость: чудища и голодные странники.
      p.favor = 0;
      faithDeed('kill', { def: BEASTS.tarasque }); faithDeed('feed');
      assert(p.favor === 6, `милость ${p.favor}`);
      // Чудо: сильнейший в поле зрения бьёт вдвое слабее и медлит; не навсегда и не друг.
      leaveLocal(); enterWild(false);
      G.world.actors = G.world.actors.filter(a => a.kind !== 'beast');
      // Чистое поле вокруг: в лесу медведь мог встать за деревом, вне поля зрения.
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (G.world.inside(p.x + dx, p.y + dy)) G.world.set(p.x + dx, p.y + dy, T.GRASS);
      const w1 = TH.spawn('wolf', 2, 0), big = TH.spawn('bear', -2, 0);
      refreshFov();
      miracle(p);
      assert(big.subdueUntil > G.minutes && !(w1.subdueUntil > G.minutes), 'усмирён не самый сильный');
      assert(big.subdueUntil - G.minutes === 12 * MINUTES_PER_TURN, 'усмирение не на 12 ходов');
      assert(feastsOn({ y: 1247, m: 7, d: 29, wd: 1 }).some(f => f.saint === 'martha'), 'нет праздника Марфы');
      return SAINTS.martha.passiveText;
    },
  },

  {
    name: 'Вера целиком: все святые — святилище, паломничество, выбор, дар, милость, запрет, чудо, праздник; молитвы, месса, алтарь',
    run() {
      const p = TH.start(); TH.immortal();
      p.base.fai = 12; if (p.recalc) p.recalc();
      const out = [];
      // Дела, за которые святой даёт милость, — и что должно случиться от чуда.
      const DEED = {
        george: () => { faithDeed('kill', { def: BEASTS.ghoul }); faithDeed('kill', { def: BEASTS.bear }); },
        michael: () => faithDeed('kill', { def: BEASTS.ghoul }),
        francis: () => faithDeed('donate'),
        christopher: () => { for (let i = 0; i < 15; i++) faithDeed('travel'); },
        benedict: () => faithDeed('mass'),
        nicholas: () => faithDeed('sail'),
        antony: () => faithDeed('lead', { lead: { kind: 'treasure' } }),
        magdalene: () => faithDeed('confess'),
        martha: () => faithDeed('feed'),
      };
      const TABOO = {
        francis: () => faithDeed('kill', { def: BEASTS.hare }),
        benedict: () => faithDeed('grave'),
        michael: () => breakTaboo('Языческий оберег на груди.'),
      };
      const saints = Object.entries(SAINTS).filter(([, s]) => !s.noPatron);
      assert(saints.every(([id]) => DEED[id]), 'не у всех святых проверены дела: ' + saints.map(([id]) => id).filter(id => !DEED[id]));
      // Найти день праздника святого в году.
      const feastDay = id => { for (let d = 1; d < 400; d++) if (feastsOn(dateOfDay(d)).some(f => f.saint === id)) return d; return -1; };
      for (const [id, s] of saints) {
        // 1. Святилище есть и у него есть священник, через которого избирают.
        const shrine = G.over.cities.find(c => s.shrine(c));
        assert(shrine, `${id}: нет святилища`);
        if (G.mode === 'local') leaveLocal();
        TH.go(shrine);
        const pr = G.world.villages[0].npcs.find(n => TH.options(n).some(l => l === `Избрать покровителем: ${s.name}`));
        assert(pr, `${id}: в ${shrine.name} некому принять обет`);
        // 2. Паломничество (у придорожной часовни его нет — там только обет).
        if (shrine.kind !== 'inn') {
          p.piety = 50; const pi = p.piety;
          const r = TH.ask(pr, s.rite || 'Поклониться мощам');
          assert(r && p.piety > pi, `${id}: паломничество не засчитано`);
          assert(!TH.options(pr).some(l => l === (s.rite || `Поклониться мощам ${s.acc} (паломничество)`)), `${id}: паломничество дважды`);
        }
        // 3. Обет: без благочестия — нельзя, со сменой прежнего — благочестие вдвое.
        p.piety = 20; const old = p.patron;
        TH.ask(pr, 'Избрать покровителем');
        assert(p.patron === old, `${id}: избран без благочестия`);
        p.piety = 60;
        TH.ask(pr, 'Избрать покровителем');
        assert(p.patron === id, `${id}: не избран`);
        if (old) assert(p.piety === (id === 'magdalene' ? 60 - Math.ceil(30 / 2) : 30) || p.piety === 30, `${id}: смена покровителя без потери благочестия (${p.piety})`);
        assert(s.passiveText && s.miracle && s.miracleText && s.deeds && s.who, `${id}: неполное описание`);
        // 4. Дела копят милость; запрет её сжигает.
        p.favor = 0; DEED[id]();
        assert(p.favor > 0, `${id}: дела не дают милости`);
        if (TABOO[id]) { p.favor = 5; TABOO[id](); assert(p.favor === 0, `${id}: запрет не сжёг милость`); }
        // 5. Праздник: в свой день молитва у алтаря даёт +3.
        const fd = feastDay(id);
        assert(fd > 0, `${id}: нет праздника в календаре`);
        // 6. Чудо — в глуши, при звере, нечисти и яде.
        if (G.mode === 'local') leaveLocal();
        TH.wild();
        G.world.actors = G.world.actors.filter(a => a.kind !== 'beast');
        const wolf = TH.spawn('wolf', 2, 0), ghoul = TH.spawn('ghoul', 0, 2), bear = TH.spawn('bear', -2, 0);
        refreshFov();
        p.favor = FAVOR_COST; p.grace = p.maxGrace; p.piety = 100; p.poison = 4; p.hp = 5; p.coins = 10;
        const before = { hp: p.hp, ward: G.wardUntil || 0, coins: p.coins, ghoul: ghoul.hp, known: (G.leads || []).filter(l => l.known).length };
        p.grace = p.maxGrace - 1;
        castMiracle();
        assert(p.favor < FAVOR_COST, `${id}: чудо не потратило милость`);
        const ok = {
          george: () => buffOn(p, 'spear'),
          michael: () => ghoul.hp < before.ghoul || !G.world.actors.includes(ghoul),
          francis: () => wolf.calmUntil > G.minutes,
          christopher: () => G.wardUntil > G.minutes + 40 * 60,
          benedict: () => p.poison === 0 && ghoul.fearUntil > G.minutes,
          nicholas: () => p.hp >= p.maxHp - 40 && p.poison === 0,   // после чуда звери рядом успевают ударить
          antony: () => p.coins > before.coins || (G.leads || []).filter(l => l.known).length > before.known,
          magdalene: () => p.grace === p.maxGrace && p.hp > before.hp,
          martha: () => bear.subdueUntil > G.minutes && !(wolf.subdueUntil > G.minutes),
        }[id];
        assert(ok(), `${id}: чудо «${s.miracle}» не сработало`);
        out.push(id);
      }
      // Праздник своего святого: +3 милости у алтаря.
      const fd = feastDay(p.patron);
      G.minutes = (fd - timeInfo().day) * 1440 + G.minutes;
      p.favor = 0; p.altarDay = -1;
      altarPray();
      assert(p.favor >= 3, `в праздник нет милости (${p.favor})`);
      // Молитвы: каждая работает, когда есть благодать и вера.
      TH.wild();
      G.world.actors = G.world.actors.filter(a => a.kind !== 'beast');
      const gh = TH.spawn('ghoul', 2, 0); refreshFov();
      for (const pr of PRAYERS) {
        p.grace = p.maxGrace; p.hp = Math.max(1, p.maxHp - 20);
        const st = { hp: p.hp, gh: gh.hp, ward: G.wardUntil || 0 };
        castPrayer(pr);
        const ok = { heal: () => p.hp > st.hp, exorcism: () => gh.hp < st.gh || !G.world.actors.includes(gh), light: () => buffOn(p, 'light'),
          bless: () => buffOn(p, 'bless'), mantle: () => buffOn(p, 'mantle'), ward: () => G.wardUntil > st.ward }[pr.id];
        assert(ok && ok(), `молитва «${pr.name}» не сработала`);
        assert(p.grace <= p.maxGrace - pr.cost + 1, `молитва «${pr.name}» не взяла благодать: ${p.grace} из ${p.maxGrace}, цена ${pr.cost}, шанс ${prayerChance(p)}`);
      }
      // Месса — по воскресеньям утром.
      leaveLocal();
      TH.go(TH.city('florence'));
      while (today().wd !== 0) G.minutes += 1440;
      G.minutes += (9 - timeInfo().hour) * 60;
      const priest = TH.npc('priest'), pm = p.piety;
      p.piety = 30;
      assert(massOption(priest), 'в воскресенье утром нет мессы');
      TH.ask(priest, /мессу/);
      assert(p.piety > 30 && p.massDay === timeInfo().day, 'месса не засчитана');
      // Без храма благочестие тает.
      p.lastPractice = timeInfo().day - 21; const pq = p.piety;
      faithDaily(timeInfo().day);
      assert(p.piety < pq, 'благочестие не тает без храма');
      return `святых: ${out.length} — ${out.join(', ')}`;
    },
  },

  {
    name: 'Поручения: все виды во всех землях — от взятия до награды',
    run() {
      const p = TH.start(); TH.immortal();
      p.level = 8; p.piety = 60; p.coins = 500;
      const ow = G.over, fails = [], stat = {}, completed = {};
      const note = k => { stat[k] = (stat[k] || 0) + 1; };
      const fail = s => { if (fails.length < 30) fails.push(s); };
      const land = r => FOREIGN_REGIONS.includes(r) ? r : 'italy';
      // Кто может выйти на героя в округе места (днём и ночью) — в нынешнюю пору года.
      const spawnable = place => {
        const set = new Set(), R = 10 * MAP_SCALE;
        for (let dy = -R; dy <= R; dy += 2) for (let dx = -R * 2; dx <= R * 2; dx += 2) {
          const x = place.x + dx, y = place.y + dy;
          if (!ow.inside(x, y) || !ow.passable(x, y)) continue;
          const habs = (OT_HABITATS[ow.get(x, y)] || ['field']).concat(ow.road[ow.idx(x, y)] >= 0 ? ['road'] : []);
          for (const hab of habs) for (const night of [false, true]) for (const o of beastChoices(ow.regionAt(x, y), hab, night, false)) set.add(o.key);
        }
        return set;
      };
      // Заливка проходимого от клетки.
      const flood = (w, sx, sy) => {
        const seen = new Uint8Array(w.tiles.length), st = [w.idx(sx, sy)]; seen[st[0]] = 1;
        while (st.length) { const j = st.pop(), x = j % w.w, y = (j / w.w) | 0;
          for (const [dx, dy] of DIRS8) { const nx = x + dx, ny = y + dy; if (!w.inside(nx, ny)) continue; const k = w.idx(nx, ny);
            if (!seen[k] && TILES[w.tiles[k]].walk) { seen[k] = 1; st.push(k); } } }
        return seen;
      };
      const near = (w, seen, x, y) => seen[w.idx(x, y)] || DIRS8.some(([dx, dy]) => w.inside(x + dx, y + dy) && seen[w.idx(x + dx, y + dy)]);
      const leave = () => { if (G.mode === 'local' && G.world) leaveLocal(); G.mode = 'over'; };
      const setMonth = m => { for (let i = 0; i < 400 && today().m !== m; i++) G.minutes += 1440; G.minutes += (10 - timeInfo().hour) * 60; };
      const turnIn = (place, role, label) => { leave(); TH.go(place); const n = TH.npc(role); const c0 = p.coins; TH.ask(n, label); return p.coins > c0; };
      // Места: в каждом крае — город или городок, село, замок, монастырь, постоялый двор.
      const places = [];
      for (const r of [...new Set(ow.cities.map(c => c.region))])
        for (const kinds of [['city', 'town'], ['village'], ['castle'], ['monastery'], ['inn']]) {
          const c = ow.cities.find(c => c.region === r && kinds.includes(c.kind));
          if (c) places.push(c);
        }
      for (const month of [7, 9, 1]) {
        setMonth(month);
        for (const place of places) {
          leave();
          TH.go(place);
          // Только те, у кого в разговоре правда есть «Нет ли для меня работы?» (император, гости ярмарки — нет).
          const givers = G.world.villages[0].npcs.filter(n => { n.offer = null; return QUEST_GIVERS[questRole(n)] && TH.options(n).includes('Нет ли для меня работы?'); });
          const beasts = spawnable(place);
          for (const giver of givers) {
            for (let k = 0; k < 6; k++) {
              place.lastLair = null; place.lastTarget = null; place.lastTrophy = null; giver.noWorkUntil = 0;
              if (G.mode !== 'local' || !G.world || G.world.city !== place) TH.go(place);
              const o = makeOffer(giver);
              if (!o) continue;
              const sub = o.type === 'lair' ? o.lairKind : o.type === 'kill' ? o.target : o.type === 'work' ? o.work : o.type === 'trophy' ? o.trophy : o.type === 'deliver' ? (/морем/.test(o.accept) ? 'sea' : 'land') : o.type;
              const key = `${o.type}:${sub}`, where = `${place.name} (${REGIONS[place.region].name}, ${place.kind}, ${giver.title})`;
              note(o.type);
              if (month !== 7 && !['work', 'kill'].includes(o.type)) continue;
              // Выполнимо ли в принципе.
              if (o.type === 'kill' && !beasts.has(o.target)) { fail(`охота на «${BEASTS[o.target].name}», а в округе его нет (мес. ${month}): ${where}`); continue; }
              if (o.type === 'trophy') { const b = TROPHY_ORDERS.find(t => t.id === o.trophy).beast; if (!beasts.has(b)) { fail(`заказ «${o.label}», а зверя нет: ${where}`); continue; } }
              if (o.type === 'deliver') {
                const dest = placeById(o.to);
                if (sub === 'land' && !overPath(place.x, place.y, dest.x, dest.y)) { fail(`доставка в ${dest.name} — посуху не дойти: ${where}`); continue; }
                if (sub === 'sea' && !SEA_ROUTES.some(([a, b]) => [a, b].includes(place.id) && [a, b].includes(dest.id))) { fail(`доставка морем в ${dest.name} — нет лодки: ${where}`); continue; }
                if (!PLACE_ROLES[dest.kind].includes(o.toRole)) { fail(`доставка: в ${dest.name} нет получателя (${o.toRole})`); continue; }
              }
              // Полностью — по одному разу на вид в каждой земле.
              const ck = `${key}@${land(place.region)}`;
              if (completed[ck]) continue;
              completed[ck] = true;
              const q0 = p.quests.length;
              acceptQuest(giver, o);
              const q = p.quests[p.quests.length - 1];
              if (p.quests.length !== q0 + 1) { fail(`не взялось: ${key} ${where}`); continue; }
              let ok = false;
              if (o.type === 'kill') {
                for (let i = 0; i < q.need; i++) questKill(q.target);
                ok = q.done && turnIn(place, giver.role, 'Работа сделана');
              } else if (o.type === 'trophy') {
                const loot = BEASTS[TROPHY_ORDERS.find(t => t.id === o.trophy).beast].loot;
                p.trophies[loot.id] = { name: loot.name, value: loot.value, count: q.need };
                ok = turnIn(place, giver.role, /^Вот:/);
              } else if (o.type === 'deliver') {
                const dest = placeById(q.to);
                leave();
                TH.go(dest);
                const rcv = G.world.villages[0].npcs.find(n => n.role === q.toRole);
                if (!rcv) { fail(`доставка: получателя нет на месте (${dest.name}, ${q.toRole})`); continue; }
                const c0 = p.coins; TH.ask(rcv, 'Передать'); ok = p.coins > c0 && !p.quests.includes(q);
              } else if (o.type === 'work') {
                const w = G.world, e = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(d => cityEdgeSpot(w, d)).find(Boolean);
                const seen = flood(w, e[0], e[1]);
                const tiles = [...w.work].filter(([, id]) => id === q.id).map(([i]) => [i % w.w, (i / w.w) | 0]);
                if (tiles.length !== q.need || !tiles.length) { fail(`работа «${q.label}»: клеток ${tiles.length} из ${q.need}: ${where}`); continue; }
                const lost = tiles.filter(([x, y]) => !near(w, seen, x, y));
                if (lost.length) { fail(`работа «${q.label}»: ${lost.length} клеток не достать: ${where}`); continue; }
                for (const [x, y] of tiles) questWorkStep(x, y);
                ok = q.done && turnIn(place, giver.role, 'Работа сделана');
              } else if (o.type === 'lair') {
                const lead = G.leads.find(l => l.id === q.lead);
                if (!lead) { fail(`логово «${q.label}» не появилось: ${where}`); continue; }
                lead.known = true;
                leave();
                if (LEAD_KINDS[lead.kind].night) G.minutes += ((23 * 60 - timeInfo().hour * 60) + 1440) % 1440;
                G.ox = lead.x; G.oy = lead.y; G.mode = 'over';
                enterLead(lead);
                const w = G.world, seen = flood(w, p.x, p.y), mobs = w.actors.filter(a => a.leadId === lead.id);
                if (!mobs.length) { fail(`логово «${q.label}»: некого убивать: ${where}`); continue; }
                const lost = mobs.filter(m => !near(w, seen, m.x, m.y));
                if (lost.length) { fail(`логово «${q.label}»: ${lost.map(m => m.name)} не достать: ${where}`); continue; }
                for (const m of mobs) killBeast(m, true);
                ok = q.done && turnIn(place, giver.role, 'Работа сделана');
                setMonth(month);
              } else if (o.type === 'relic') {
                const site = ow.sites.find(x => x.id === q.site);
                leave(); G.ox = site.x; G.oy = site.y; G.mode = 'over';
                enterSite(site);
                const w = G.world, seen = flood(w, p.x, p.y);
                const chests = [...w.containers].filter(([, k]) => /^relic_/.test(k));
                ok = chests.length === 2 && chests.every(([i]) => near(w, seen, i % w.w, (i / w.w) | 0));
                if (!ok) fail(`святыня: ларцов ${chests.length}, достижимы не все: ${where}`);
                p.quests = p.quests.filter(x => x !== q);
                leave();
                continue;
              } else ok = true;
              if (!ok) fail(`не сдать: ${key} — ${where}`);
              p.quests = p.quests.filter(x => x !== q);
            }
          }
        }
      }
      // Сюжетные цепочки: начало каждой есть на карте (сами цепочки проходят свои тесты).
      const starts = {
        'Непобедимое Солнце (митреум)': () => ow.sites.some(s => s.type === 'mithraeum'),
        'Последние язычники (легат, селения)': () => placeById(LEGATE_CITY) && ow.sites.filter(s => s.kind === 'pagan').length >= 2,
        'Путь в подземный мир (Сивилла, Этна)': () => placeById('sibyl') && placeById('inferi'),
        'Пропавшая книга Леонардо (Пиза)': () => TH.city('pisa'),
        'Узник Эццелино (Верона)': () => TH.city('verona'),
        'Души Монсегюра (капеллан, поле)': () => crematsSite() && ow.cities.some(c => c.name === 'Монсегюр'),
        'Пещеры «добрых людей»': () => catharSites().length === 2,
      };
      for (const [n, f] of Object.entries(starts)) if (!f()) fail(`нет начала цепочки: ${n}`);
      assert(!fails.length, `${fails.length} затыков:\n` + fails.join('\n'));
      const kinds = Object.keys(completed).map(k => k.split('@')[0].split(':')[0]);
      for (const t of ['kill', 'lair', 'deliver', 'work', 'trophy', 'relic']) assert(kinds.includes(t), `ни разу не выпало: ${t}`);
      return `мест ${places.length}, предложений ${Object.values(stat).reduce((a, b) => a + b, 0)}, выполнено до награды ${Object.keys(completed).length}`;
    },
  },

  {
    name: 'Экономика: нет бесконечных денег — купить и тут же продать, ярмарка, снаряжение, травы, лошади; прибыль торговли',
    run() {
      const p = TH.start(); TH.immortal();
      // Самый ловкий торговец: мудрость, мастер торговли, письмо Леонардо, покровитель торговцев.
      p.base.wis = 16; if (p.recalc) p.recalc();
      p.skills.trade = { lvl: SKILL_MAX, xp: 0 };
      p.story = p.story || {}; p.story.fibLetter = true;
      const loops = [], ow = G.over;
      // Города всех земель (по одному на край) и прочие места.
      const regionsSeen = {}, places = ow.cities.filter(c => ['city', 'town'].includes(c.kind) && (regionsSeen[c.region] = (regionsSeen[c.region] || 0) + 1) <= 1)
        .concat(ow.cities.filter(c => ['village', 'inn', 'castle', 'monastery'].includes(c.kind)).slice(0, 8));
      const realFair = window.fairPriceMult;
      for (const patron of [null, 'antony', 'nicholas']) {
        p.patron = patron;
        for (const fair of [false, true]) {
          window.fairPriceMult = fair ? (pl, selling) => (selling ? 1.1 : 0.9) : realFair;
          for (const place of places) {
            TH.go(place);
            const npcs = G.world.villages[0].npcs.filter(n => traderGoods(n));
            for (const n of npcs) {
              const d = traderGoods(n), tr = new TradeScreen(n);
              // 1. Товар: купить и тут же продать тому же купцу.
              for (const id of d.sells.filter(id => d.buys.includes(id))) {
                p.coins = 10000; p.goods = {};
                const c0 = p.coins;
                tr.buy(id, 4, buyPrice(place, id));
                const got = p.goods[id] || 0;
                if (!got) continue;
                tr.sellGood(id, got);
                if (p.coins >= c0) loops.push(`${GOODS[id].name}: купил и продал ${got} шт. у ${n.title} (${place.name})${fair ? ' на ярмарке' : ''}${patron ? ', покровитель ' + patron : ''}: +${p.coins - c0}`);
              }
              // 2. Снаряжение: купить и продать любому в том же месте.
              for (const key of d.gear || []) {
                const buy = p.priceBuy(ITEMS[key].value), it = makeItem(key);
                for (const m of G.world.villages[0].npcs) {
                  const dm = traderGoods(m); if (!dm || !dm.buysGear) continue;
                  const k = dm.buysGear(it); if (!k) continue;
                  const sell = gearSellPrice(it, k);
                  if (sell >= buy) loops.push(`${it.name}: купил за ${buy}, продал ${m.title} за ${sell} (${place.name})`);
                }
              }
              // 3. Травы и снадобья: купить у травницы и сдать скупщику.
              if (d.alchemy) for (const r of alchemyShopRows(tr)) {
                if (!/сушёная трава/.test(r.label)) continue;
                const hid = Object.keys(HERBS).find(k => r.label.startsWith(HERBS[k].name));
                if (!hid) continue;
                const val = HERBS[hid].value;
                for (const m of G.world.villages[0].npcs) {
                  const dm = traderGoods(m); if (!dm) continue;
                  const k = ALCHEMY.includes(herbId(hid)) && dm.alchemy ? dm.alchemy : dm.trophies;
                  if (k && Math.round(p.priceSell(val) * k) >= r.price) loops.push(`${HERBS[hid].name}: купил у травницы за ${r.price}, сдал ${m.title} за ${Math.round(p.priceSell(val) * k)} (${place.name})`);
                }
              }
            }
          }
        }
      }
      window.fairPriceMult = realFair;
      // 4. Лошади и мулы: обмен в зачёт — всегда в убыток.
      for (const [k, m] of Object.entries(MOUNTS)) if (Math.floor(m.price * 0.4) >= p.priceBuy(m.price)) loops.push(`${m.name}: перепродажа в плюс`);
      assert(!loops.length, `${loops.length} петель:\n` + [...new Set(loops)].slice(0, 25).join('\n'));
      // 5. Честная торговля между городами — выгодна, но не безмерно: прибыль за день пути с полным грузом.
      p.patron = null; p.skills.trade = { lvl: 3, xp: 0 }; p.base.wis = 7; if (p.recalc) p.recalc();
      let best = { perDay: 0 };
      const towns = ow.cities.filter(c => ['city', 'town'].includes(c.kind));
      for (const a of towns.slice(0, 40)) for (const b of towns) {
        if (a === b || landmass(a.region) !== landmass(b.region)) continue;
        const km = kmBetween(a, b); if (km < 20 || km > 200) continue;
        const days = km / 30;
        for (const id of goodsInStock(a)) {
          const unit = sellPrice(b, id) - buyPrice(a, id);
          if (unit <= 0) continue;
          // По-честному: запас лавки, место в котомке, цена растёт с каждой купленной и падает с каждой проданной штукой.
          const big = a.kind === 'city' ? 2 : 1.3, stock = Math.round((producerDistance(a, id) === 0 ? 20 : 6) * big);
          const cap = Math.min(stock, Math.floor(p.capacity / GOODS[id].w));
          let profit = 0, cost = 0, n = 0;
          const b0 = buyPrice(a, id), s0 = sellPrice(b, id);
          for (let i = 0; i < cap; i++) {
            const bp = Math.round(b0 * Math.min(2, Math.pow(1 + MARKET_STEP, i))), sp = Math.round(s0 * Math.max(0.5, Math.pow(1 - MARKET_STEP, i)));
            if (sp <= bp) break;
            profit += sp - bp; cost += bp; n++;
          }
          const perDay = profit / days;
          if (perDay > best.perDay) best = { perDay: Math.round(perDay), from: a.name, to: b.name, good: GOODS[id].name, unit, n, cost, profit, days: +days.toFixed(1) };
        }
      }
      assert(best.perDay < 250, `торговля слишком выгодна: ${JSON.stringify(best)}`);
      return `лучший торговый путь: ${best.good} ${best.from} → ${best.to}: ${best.n} шт. на ${best.cost} мон., прибыль ${best.profit} за ${best.days} дн. (≈${best.perDay} в день)`;
    },
  },

  {
    name: 'Разбойники: «кошелёк или жизнь» — откупиться, драться, бежать; Esc — драка',
    run() {
      const p = TH.start(); TH.immortal();
      leaveLocal();
      const band = () => { const b = { id: 'trR' + rng.int(0, 1e6), kind: 'brigands', x: G.ox, y: G.oy, path: [], i: 0, acc: 0, n: 3 }; G.travelers = [b]; return b; };
      // Откуп: половина кошелька, без драки.
      p.coins = 100; brigandsAttackHero(band());
      const scr = topScreen();
      assert(scr.robbery && /50 мон/.test(scr.options[0].label), 'выбора нет или откуп не в половину: ' + (scr.options && scr.options[0].label));
      scr.choose(0);
      assert(p.coins === 50 && G.mode === 'over' && G.screens.length === 1, 'откуп не сработал');
      // Пустой кошелёк: забирают еду.
      p.coins = 0; p.rations = 4; brigandsAttackHero(band()); topScreen().choose(0);
      assert(p.rations === 2 && G.mode === 'over', 'с нищего не взяли еду');
      // Ради медяков из кустов не выходят: меньше 15 монет не берут — есть 20, отдашь 15.
      p.coins = 20; brigandsAttackHero(band()); topScreen().choose(0);
      assert(p.coins === 5, `с 20 монет взяли не 15: осталось ${p.coins}`);
      // Три монеты — «ты над нами смеёшься?»: забирают всё, полкотомки и лучшее из мешка.
      p.coins = 3; p.rations = 6; p.bag.push(makeItem('sling'));
      brigandsAttackHero(band());
      assert(/им этого мало/.test(topScreen().options[0].label), 'не сказано, что трёх монет мало: ' + topScreen().options[0].label);
      topScreen().choose(0);
      assert(p.coins === 0 && p.rations === 3 && !p.bag.some(it => it.key === 'sling'), `ограбили не дочиста: ${p.coins} мон., еды ${p.rations}`);
      // После засады — затишье: другая шайка рядом героя не трогает, а на дороге за ней не идёт.
      G.brigandCalm = timeInfo().day + 3;
      const other = band(); other.x = G.ox + 3; other.y = G.oy;
      for (let k = 0; k < 20; k++) brigandStep(other);
      assert(G.screens.length === 1 && G.mode === 'over', 'в затишье другая шайка всё равно напала');
      G.brigandCalm = 0;
      // Esc — значит драться.
      p.coins = 30; brigandsAttackHero(band()); topScreen().key({ code: 'Escape', key: 'Escape' });
      assert(G.mode === 'local' && G.world.actors.some(a => GANG.has(a.key)), 'Esc не привёл к драке');
      leaveLocal();
      // Бежать: с конём и ловкостью уходят чаще, неудача — драка.
      let ok = 0, fights = 0;
      for (let i = 0; i < 60; i++) {
        brigandsAttackHero(band()); topScreen().choose(2);
        if (G.mode === 'local') { fights++; leaveLocal(); } else ok++;
      }
      assert(ok > 5 && fights > 5, `бегство: ушёл ${ok}, не ушёл ${fights}`);
      // Атаман берёт больше.
      p.coins = 100; const e = band(); makeEliteBand(e); brigandsAttackHero(e);
      assert(/70 мон/.test(topScreen().options[0].label), 'атаман берёт не больше');
      topScreen().choose(0);
      return `убежал ${ok} из 60`;
    },
  },

  {
    name: 'Прованс: император и папа — речи, слухи, вести по датам, гонцы обеих сторон, собор в Арле',
    run() {
      TH.start(); TH.immortal();
      const V = LOCAL_VOICE.provence, all = Object.values(V.life).flat().concat(V.lore, REGION_RUMORS.provence).join(' ');
      for (const w of ['низлож', 'Лион', 'Парма', 'Венессен', 'Империи']) assert(all.includes(w), `в речах Прованса нет: ${w}`);
      const news = LAND_NEWS.filter(n => /император|Фридрих|низложен/i.test(n.text));
      assert(news.length >= 3, 'мало вестей о войне императора и папы');
      // Гонцы: в Провансе — есть, в Лангедоке и Италии — нет.
      const ow = G.over;
      for (const [kind, sign] of [['nuncio', /ключами Петра/], ['imperial', /орёл/]]) {
        const av = TH.city('avignon'); G.ox = av.x; G.oy = av.y; G.mode = 'over'; G.travelers = [];
        let t = null;
        for (let k = 0; k < 40 && !t; k++) t = spawnTraveler(kind, G.ox, G.oy, true);
        assert(t, `${kind}: не вышел на дорогу в Провансе`);
        assert(MEET_SCENES[kind].some(s => sign.test(s)) && TRAVELER_LIFE[kind].length >= 3 && travelerNpc(t).greeting, `${kind}: нечего сказать`);
        for (const id of ['toulouse', 'florence']) { const c = TH.city(id); assert(!spawnTraveler(kind, c.x, c.y, true), `${kind} в ${id}`); }
      }
      // Собор в Арле помнит коронацию Барбароссы.
      TH.go(TH.city('arles'));
      const b = G.world.buildings.find(b => b.name === 'Собор Сен-Трофим');
      assert(b && /Барбароссу/.test(b.desc || b.landmark && b.landmark.desc || ''), 'Сен-Трофим не помнит Барбароссу');
      return `вестей ${news.length}`;
    },
  },

  {
    name: 'Знаковые здания всех городов встают на план (соборы, замки, арены, храмы)',
    run() {
      TH.start();
      const miss = [];
      let n = 0;
      for (const id of Object.keys(CITY_PLANS)) {
        const c = G.over.cities.find(x => x.id === id);
        const want = (CITY_PLANS[id].landmarks || []).map(l => l.name);
        if (!c || !want.length) continue;
        delete G.cityMaps[c.id];
        const w = buildPlace('city:' + c.id);
        n += want.length;
        for (const name of want) if (!w.buildings.some(b => b.name === name)) miss.push(`${c.name}: ${name}`);
      }
      assert(!miss.length, 'не встали на план:\n' + miss.join('\n'));
      return `зданий ${n}`;
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
      G.ox = siena.x; G.oy = siena.y; TH.enter();
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
      TH.enter();
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
      assert(famineAt(city) && happeningPriceMult(city, 'grain') >= 1.8 && goodPrice(city, 'grain') >= g0, 'неурожай не поднял цены');
      return `за год ${started} событий (${[...kinds].join(', ')}), сразу не больше ${maxAt}`;
    },
  },

  {
    name: 'Слава: подвиги, звания, узнают, сеньоры и император, разбойники разбегаются',
    run() {
      const p = TH.start();
      TH.immortal();
      assert(fameOf() === 0 && fameRank() === 'Безвестный', 'начальная слава');
      // Сеньор не говорит о делах с безвестным.
      const castle = G.over.cities.find(c => c.kind === 'castle' && !c.siege && !c.famous);
      TH.go(castle);
      const noble = G.world.villages[0].npcs.find(n => n.role === 'noble');
      if (noble) assert(/безвестными/.test(TH.ask(noble, 'Нет ли для меня работы') || ''), 'сеньор дал работу безвестному');
      // Подвиг в городе — полностью, под землёй — меньше.
      addFame(10, 'победил на турнире в замке ' + castle.name);
      assert(fameOf() === 10 && fameRank() === 'Известен в округе', 'слава не растёт');
      const site = G.over.sites.find(s => s.dungeon && !DUNGEON_TYPES[s.type].special);
      leaveLocal(); G.ox = site.x; G.oy = site.y; revealTomb(site); TH.enter();
      addFame(10, 'одолел хозяина гробницы');
      assert(fameOf() === 17, 'подвиг под землёй не урезан: ' + fameOf());
      // Император: поручение — только знаменитому.
      const vit = vittoriaPlace();
      TH.go(vit);
      const fr = G.world.villages[0].npcs.find(n => n.emperor);
      assert(/тавернах/.test(TH.ask(fr, 'Могу ли я послужить') || '') && !p.story.emperorErrand, 'император дал поручение безвестному');
      addFame(20, 'принёс голову атамана Беппо Одноглазого');
      assert(fameRank() === 'О нём говорят в тавернах', 'нет звания');
      TH.ask(fr, 'Могу ли я послужить');
      assert(p.quests.some(q => q.item === 'Письмо императора королю Энцо'), 'знаменитому не дали поручения');
      // Узнают на улице.
      TH.go(TH.city('florence'));
      let known = false;
      for (let i = 0; i < 60 && !known; i++) known = /атамана Беппо|турнире|гробницы|императора/.test(greetingFor(TH.npc('peasant')));
      assert(known, 'знаменитого не узнают');
      // Разбойники разбегаются.
      addFame(30);
      let fled = 0;
      for (let i = 0; i < 20; i++) { if (G.mode === 'local') leaveLocal(); const b = { id: 'trF' + i, kind: 'brigands', x: G.ox, y: G.oy, path: [], i: 0, acc: 0, n: 3 }; G.travelers.push(b); brigandsAttackHero(b); if (!topScreen().robbery) fled++; while (G.screens.length > 1) popScreen(); }
      assert(fled > 0 && fled < 20, 'разбойники не боятся славы: ' + fled);
      return `${fameOf()} · ${fameRank()}`;
    },
  },

  {
    name: 'Сохранение со всеми новыми системами: ярмарка, событие, путники, слава, задания',
    async node(page, startPage) {
      await startPage(page);
      const ok = await page.evaluate(async () => {
        const p = G.player;
        const c = TH.city('genoa');
        addHappening('fair', c, timeInfo().day, 'Ярмарка');
        G.happenings.push({ id: 'hpS', kind: 'execution', place: c.id, region: c.region, start: timeInfo().day, end: timeInfo().day + 1, day: timeInfo().day, done: {} });
        leaveLocal(); G.ox = c.x; G.oy = c.y; TH.enter();
        addFame(12, 'проверил сохранение');
        const car = spawnTraveler('caravan', G.ox, G.oy, true); G.travelers.push(car);
        G.player.quests.push({ id: 'escS', type: 'escort', traveler: car.id, kind: 'caravan', to: car.to, toName: 'x', reward: 50, xp: 5, label: 'Охрана', day: 1, done: false });
        const saved = await saveGame();
        const fame = p.fame, n = G.travelers.length;
        await loadGame();
        return saved && G.player.fame === fame && G.travelers.length === n && G.world.villages[0].npcs.some(x => x.fairMerchant)
          && new TradeScreen(G.world.villages[0].npcs.find(x => x.fairMerchant)).deal.trophies === 0.65;
      });
      if (!ok) throw new Error('сохранение с новыми системами не работает');
      return 'ok';
    },
  },

  {
    name: 'Гвельфы и гибеллины: оклик — мимо не пройти; свой — могут не поверить; бежать — риск; через вражеские города не ходят',
    run() {
      const p = TH.start(); TH.immortal();
      leaveLocal();
      while (G.screens.length > 1) popScreen();
      const mk = () => {
        let t = null;
        for (let k = 0; k < 40 && !t; k++) { const c = TH.city('cremona'); G.ox = c.x; G.oy = c.y; t = spawnWarband('ghibs'); }
        t.x = G.ox; t.y = G.oy; G.travelers = [t]; return t;
      };
      // Оклик: ни «Пройти мимо», ни Esc — только ответить или бежать.
      let t = mk(); t.hailed = true; talkToTraveler(t);
      let d = topScreen(), labels = d.options.map(o => o.label);
      assert(!labels.includes('Пройти мимо') && labels.includes('Броситься бежать') && labels.some(l => /за императора/.test(l)), 'от оклика можно уйти: ' + labels);
      d.key({ code: 'Escape', key: 'Escape' });
      assert(topScreen() === d, 'Esc закрыл оклик');
      // Ответил «я за императора» гибеллинам — пропустили (без подозрений: недавно с ними не дрался).
      p.foughtFaction = {};
      let passed = 0, doubted = 0;
      for (let k = 0; k < 40; k++) {
        while (G.screens.length > 1) popScreen();
        t = mk(); t.hailed = true; talkToTraveler(t); d = topScreen();
        d.choose(d.options.findIndex(o => /за императора/.test(o.label)));
        if (t.demand) { doubted++; assert(!d.options.some(o => o.label === 'Пройти мимо'), 'с пошлиной можно уйти'); } else passed++;
      }
      assert(passed > 25, `своим почти не верят: пропустили ${passed} из 40`);
      // Недавно рубился с гибеллинами — узнают куда чаще.
      p.foughtFaction = { ghib: timeInfo().day };
      let known = 0;
      for (let k = 0; k < 40; k++) {
        while (G.screens.length > 1) popScreen();
        t = mk(); t.hailed = true; talkToTraveler(t); d = topScreen();
        d.choose(d.options.findIndex(o => /за императора/.test(o.label)));
        if (t.demand >= 20) known++;
      }
      assert(known > 12, `рубака не узнан: ${known} из 40`);
      // Бежать: удача — свободен, неудача — драка.
      let ran = 0, caught = 0;
      for (let k = 0; k < 40; k++) {
        while (G.screens.length > 1) popScreen();
        if (G.mode === 'local') leaveLocal();
        t = mk(); t.hailed = true; talkToTraveler(t); d = topScreen();
        d.choose(d.options.findIndex(o => o.label === 'Броситься бежать'));
        if (G.mode === 'local') { caught++; leaveLocal(); } else ran++;
      }
      assert(ran > 3 && caught > 3, `бегство: ушёл ${ran}, поймали ${caught}`);
      // Пути отрядов не идут через вражеские города (кроме цели набега).
      const ow = G.over;
      let bad = 0, made = 0;
      for (const id of ['milan', 'bologna', 'verona', 'pisa', 'florence']) {
        const c = TH.city(id); G.ox = c.x; G.oy = c.y;
        for (let k = 0; k < 20; k++) for (const kind of ['guelfs', 'ghibs']) {
          const w = spawnWarband(kind); if (!w) continue; made++;
          const to = ow.cities.find(x => x.id === w.to);
          if (w.path.some(i => { const pl = ow.places.get(i); return pl && pl !== to && ['city', 'town'].includes(pl.kind) && cityFaction(pl) === enemyOf(w.faction); })) bad++;
        }
      }
      assert(made > 50 && !bad, `отряды идут через вражеские города: ${bad} из ${made}`);
      return `своим поверили ${passed}/40, рубаку узнали ${known}/40, ушёл ${ran}/40`;
    },
  },
  {
    name: 'Гвельфы и гибеллины: отряды, стычки, поле боя',
    run() {
      const p = TH.start();   // Генуя — гвельфский город
      TH.immortal();
      assert(cityFaction(TH.city('genoa')) === 'guelf' && cityFaction(TH.city('cremona')) === 'ghib' && cityFaction(TH.city('venice')) === null, 'партии городов');
      assert(cityFaction(TH.city('florence'), dayOfDate(1248, 3, 1)) === 'ghib' && cityFaction(TH.city('florence'), 1) === 'guelf', 'Флоренция в феврале 1248');
      leaveLocal();
      // Отряды на карте.
      for (let i = 0; i < 10; i++) fillTravelers(false);
      const g = G.travelers.filter(t => t.kind === 'guelfs'), h = G.travelers.filter(t => t.kind === 'ghibs');
      assert(g.length && h.length, `нет отрядов: гвельфов ${g.length}, гибеллинов ${h.length}`);
      // Разговор.
      const npc = travelerNpc(g[0]);
      assert(/папу|коммун|легат|кесар/.test(TH.ask ? (travelerOptions(npc).find(o => /За кого/.test(o.label)).act()) : ''), 'не говорят, за кого воюют');
      // Стычка: свести вместе.
      const a = g[0], b = h[0];
      b.x = a.x; b.y = a.y + 1;
      if (!G.over.passable(b.x, b.y)) { b.y = a.y; }
      const leads0 = G.leads.length;
      battle(a, b);
      assert(G.travelers.includes(a) !== G.travelers.includes(b), 'никто не проиграл');
      const lead = G.leads[G.leads.length - 1];
      assert(G.leads.length > leads0 && lead.kind === 'battlefield' && !lead.known, 'нет поля боя');
      assert(G.news.some(n => n.lead === lead.id && /сшиблись/.test(n.text)), 'нет вести о стычке');
      // Найти и осмотреть поле.
      lead.known = true; G.ox = lead.x; G.oy = lead.y;
      enterLead(lead);
      const w = G.world;
      assert(w.tiles.includes(T.BONES) && [...w.items.values()].flat().some(it => it.kind === 'gear') && w.actors.some(m => m.name === 'Мародёр'), 'поле боя пустое');
      return `${lead.winner} победили ${lead.loser}`;
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
        // Без потребностей: трое суток без еды и сна — сыт и бодр, ночь в метель не студит; выключил — голод вернулся.
        click('needs');
        for (let k = 0; k < 36 * 3; k++) { survivalTick(p, 40, 1.5); p.fatigue += 10; }
        if (p.food !== 100 || survivalPenalty(p) !== 0) throw new Error(`потребности не отключились: сытость ${p.food}, усталость ${p.fatigue}`);
        const hp0 = p.hp; G.weather = { kind: 'blizzard', until: G.minutes + 600 }; campWeatherHurt();
        if (p.hp !== hp0) throw new Error('без потребностей ночь в метель всё равно студит');
        click('needs');
        survivalTick(p, 600);
        // Примерить зиму: лес голый, на севере снег — но время и сезон в игре прежние; «как есть» — всё назад.
        const realSeason = seasonOf();
        click('view', { m: 1, d: 15 });
        if (leafBare(false) !== 2 || seasonOf() !== realSeason) throw new Error(`примерка зимы: лес ${leafBare(false)}, сезон ${seasonOf()}`);
        const milan = TH.city('milan');
        if (!snowyHere(milan.x, milan.y, true, viewDate())) throw new Error('в примеренную зиму у Милана нет снега');
        click('view', { m: 0, d: 0 });
        if (G.debug.seasonView || viewDate().m !== today().m) throw new Error('«как есть» не вернуло картинку');
        if (p.food >= 100) throw new Error('потребности не вернулись');
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
      assert(TH.storyWork(pr(), 'crusade') === null, 'служба без благочестия');
      p.piety = 60;
      TH.storyWork(pr(), 'crusade');
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
        TH.enter();
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
      leaveLocal(); G.ox = pagans[0].x; G.oy = pagans[0].y; TH.enter();
      assert(!G.world.villages[0].npcs.length, 'жители вернулись');
      TH.go(TH.city('viterbo'));
      TH.ask(G.world.villages[0].npcs.find(n => n.special === 'legate'), 'Последний алтарь');
      assert(crusadeStage() === 4, 'легат не послал к папе');
      // Папа в Лионе, в клуатре Сен-Жюст.
      TH.go(TH.city('lyon'));
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
      TH.go(TH.city('lyon'));
      assert(!G.world.villages[0].npcs.some(n => n.special === 'pope'), 'папа снова принимает');
      TH.go(TH.city('viterbo'));
      assert(!G.world.villages[0].npcs.some(n => n.special === 'legate'), 'легат остался в Витербо');
      // Кто приносил жертвы идолам — тому службы нет.
      p.story.crusade = 0; p.story.inferi = 2;
      TH.go(TH.city('rome'));
      assert(TH.storyWork(pr(), 'crusade') === null && crusadeStage() === 0, 'язычнику дали службу');
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
      TH.enter();
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
      leaveLocal(); G.ox = cumae.x; G.oy = cumae.y; TH.enter();
      const d1 = G.dungeons.sibyl; goToLevel(cumae, d1, 1, 'up');
      let w = G.world;
      killBeast(w.actors.find(a => a.bossOf), true);
      for (const i of [...w.containers.keys()]) openContainer(i % w.w, (i / w.w) | 0);
      assert(hasItem('golden_bough') && storyStage() === 3, 'ветвь не добыта');
      // Назад к фламину.
      leaveLocal(); G.ox = v.x; G.oy = v.y; TH.enter();
      TH.ask(G.world.villages[0].npcs.find(n => n.role === 'flamen'), 'Я принёс золотую ветвь');
      assert(storyStage() === 4 && !etna.hidden, 'путь к Этне не открыт');
      // Без ветви не войти.
      const bough = p.bag.find(it => it.key === 'golden_bough');
      p.bag = p.bag.filter(it => it !== bough);
      leaveLocal(); G.ox = etna.x; G.oy = etna.y; TH.enter();
      assert(G.mode === 'over', 'пустили в Этну без ветви');
      p.bag.push(bough);
      TH.enter();
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
        lead.known = true; G.ox = lead.x; G.oy = lead.y; TH.enter();
        const lw = G.world, ci = lw.containers && [...lw.containers.keys()][0];
        if (ci !== undefined) openContainer(ci % lw.w, (ci / lw.w) | 0);
        window.__mark.lead = { id: lead.id, opened: ci, mobs: lw.actors.filter(a => a.kind === 'beast').length };
        // Сохраняемся, стоя в Генуе.
        TH.go(TH.city('genoa'));
        G.leads[0].known = true;
        await saveGame();
        // Карта мира в сохранении — сжатая (а не по байту на клетку).
        const rec = await saveTx('readonly', st => st.get('game'));
        if (!rec.state.over.tiles.packed || rec.state.over.tiles.packed.byteLength * 5 > G.over.tiles.byteLength) throw new Error('карта мира в сохранении не сжата');
        localStorage.setItem('mark', JSON.stringify(window.__mark));
        return { name: p.name, coins: p.coins, leads: G.leads.length,
          cities: Object.keys(G.cityMaps).length, bag: p.bag.length };
      });
      await page.reload();
      await page.waitForFunction(() => G.saveMeta, null, { timeout: 5000 });
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => G.player && G.screens[0] instanceof PlayScreen, null, { timeout: 5000 });
      const after = await page.evaluate(() => {
        const p = G.player, leads0 = G.leads.length;   // сразу после загрузки: дальше в пути могут появиться новые слухи
        assert(p instanceof Player && G.over instanceof Overworld, 'классы не восстановлены');
        assert(G.over.tiles instanceof Uint8Array && G.over.road instanceof Int16Array && G.over.tiles.length === G.over.w * G.over.h, 'карта мира не распакована');
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
        G.ox = lead.x; G.oy = lead.y; TH.enter();
        const lw = G.world;
        if (mark.lead.opened != null) assert(!lw.containers.has(mark.lead.opened) && lw.tiles[mark.lead.opened] !== T.CHEST, 'сундук снова закрыт');
        assert(lw.actors.filter(a => a.kind === 'beast').length >= mark.lead.mobs, 'обитатели пропали');
        leaveLocal();
        render();
        return { name: p.name, ox: G.ox, oy: G.oy, turn: G.turn, coins: p.coins, leads: leads0,
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
