// Helyiségprogram E2E (1.20.0, 1.21.0 területmérleg + lépcső), a tesztoldalon (bin/test-wp.sh), bekapcsolt
// építési móddal. N véletlen házon (alap 20), a 6. lépésben, valódi kattintással:
//   - többszintes háznál a lépcső típusa pillére koppintva (egyenes, L, U, csiga): a szintmagasságból
//     számolt fokszám/fokmagasság/belépő a lépcsőképlet szerint, a lépcső a házban, teherhordó falon kívül,
//     a szabad indulóval és érkezéssel;
//   - „Helyiségek…” → pillék, m² (egynél szélesség × mélység); a területmérleg belső összege stimmel
//     (kiosztható − program = maradék), soronként „elfér” a valódi méretével; „Kész” után a helyiségek az
//     alapban vannak;
//   - egy téglalap egérrel arrébb húzva falsíkra/szomszédra ugrik, dupla kattintás 90°, Ctrl+Z;
//   - „Automatikus elhelyezés”: átfedés 0, körvonalon kívül 0, a szomszédok közti hézag ≥ válaszfal + 2 ×
//     vakolat, lépcsőn/födémáttörésen 0;
//   - „Falak a helyiségek köré”: a helyiségek nettó területe (falsíkok között, mínusz vakolat) = a téglalap
//     ± 0,5 m², típus a téglalapé, teherhordó fal nem fogy, szerkezeti hiba nem nő; Ctrl+Z bájtra vissza;
//   - a kiírt „legnagyobb szabad hely” méretű új helyiség valóban elfér; túllépésnél piros a mérleg.
//   - 1.25.0 elrendezési szabályok (programme.layout): az automatikus elhelyezés után a szabályok
//     teljesülése házanként (átlag ≥ 85 %), ahol van fürdő és háló, a fürdő egy hálóval vagy a hálókat
//     összekötő közlekedővel szomszédos, a nappali a kerti oldalon (a teszt saját geometriájával is);
//     a 6. lépés és az ablak szabályonként kiírja (teljesül / nem); „Elrendezés javítása”: nem rosszabb,
//     nem fogy helyiség, átfedés 0, Ctrl+Z bájtra vissza; minden harmadik ház más tájolással.
//  A végén a szerver (validate) ugyanazt a programot és lépcsőt adja vissza (JS = PHP). Konzolhiba 0.
// Használat: node tests/e2e/prog.js [N=20]   (az 1.25.0 mérése: N=30)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const path = require('path');
const { execFileSync } = require('child_process');
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';
const N = Number(process.argv[2] || 20);
const toggle = on => execFileSync('php', [path.join(__dirname, '..', 'build-toggle.php'), on ? 'on' : 'off', process.env.AGH_WP || '/home/claude/wpsite']).toString().trim();
const STRUCT = ['no_ext', 'ext_open', 'wall_short', 'wall_overlap', 'wall_float', 'wall_out', 'op_nowall', 'op_float'];
const TYPES = ['living_kitchen', 'master', 'bedroom', 'bathroom', 'wc', 'hall', 'office', 'pantry', 'kids', 'laundry'];
const STAIRS = ['straight', 'l', 'u', 'spiral'];

(async () => {
  console.error(toggle(true));
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 200)));
  const o = { houses: 0, multi: 0, stairOk: 0, stairRule: 0, stairs: {}, rects: 0, budgetOk: 0, budgetN: 0, fitRows: 0, placedDone: 0, dragged: 0, dragOk: 0, snapOk: 0, turnOk: 0, placed: 0, missed: 0, overlap: 0, outside: 0, gapBad: 0, onStair: 0, walls: 0, typed: 0, typeN: 0, netOk: 0, netN: 0, bearingLost: 0, structUp: 0, undoOk: 0, freeN: 0, freeOk: 0, overN: 0, overOk: 0, server: 0, serverSame: 0, ms: [], layN: 0, layPct: 0, layPass: 0, layAll: 0, bathN: 0, bathOk: 0, livN: 0, livOk: 0, layList: 0, layDlg: 0, fixN: 0, fixOk: 0, fixUndo: 0, fixBetter: 0, layBad: {} };
  const fail = [];
  try {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.click('[data-agh-open]');
    await page.waitForSelector('.agh-shell .agh-preview-box.has-3d canvas, .agh-shell .agh-preview-box svg', { timeout: 60000, state: 'attached' });
    for (let k = 0; k < 4 && !(await page.$('.agh-build .agh-bld-svg')); k++) {
      await page.waitForTimeout(k ? 2500 : 300);
      if (await page.$('.agh-bld-btn:visible')) { await page.click('.agh-bld-btn'); } else { await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.agh-hmenu-item')).filter(x => /alapokt/i.test(x.textContent))[0]; if (b) { b.click(); } }); }
      try { await page.waitForSelector('.agh-build .agh-bld-svg', { timeout: 8000, state: 'attached' }); } catch (e) { /* again */ }
    }
    await page.evaluate(() => {
      window.__pg = {
        scr: (x, y) => { const s = document.querySelector('.agh-bld-svg'), p = s.createSVGPoint(); p.x = x; p.y = y; const q = p.matrixTransform(s.getScreenCTM()); return { x: q.x, y: q.y }; },
        struct: (codes) => (window.AGH_Build.check(window.AGH_BuildUI.state().b).errors || []).filter(e => codes.indexOf(e.code) !== -1).length,
        snap: () => JSON.stringify(window.AGH_BuildUI.state().b),
        audit: (lv) => {
          const U = window.AGH_BuildUI, b = U.state().b, C = U._prog.cfg(), ps = (b.prog || []).filter(r => r.lv === lv);
          let ov = 0, gapBad = 0;
          for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
            const p = ps[i], q = ps[j], dx = Math.max(q.x - (p.x + p.w), p.x - (q.x + q.w)), dy = Math.max(q.y - (p.y + p.d), p.y - (q.y + q.d));
            if (dx < -0.005 && dy < -0.005) { ov++; } else if (Math.max(dx, dy) < C.gap - 0.011) { gapBad++; }
          }
          return { n: ps.length, rects: ps.map(r => ({ id: r.id, x: r.x, y: r.y, w: r.w, d: r.d, type: r.type, state: U._prog.state(r) })), ov, gapBad };
        }
      };
    });
    const ORIENT = ['south', 'west', 'south_east'];
    for (let s = 1; s <= N; s++) {
      // every third house another orientation of the garden side (1.25.0)
      await page.evaluate((o) => { if (window.AGH_Designer && window.AGH_Designer.config().orientation !== o) { window.AGH_Designer.set({ orientation: o }); } }, ORIENT[s % 3 === 0 ? 1 : (s % 3 === 1 ? 0 : 2)]);
      const info = await page.evaluate((seed) => {
        const B = window.AGH_Build, U = window.AGH_BuildUI;
        U.load(B.randomHouse(4100 + seed)); U.goStep(6);
        const st = U.state(); st.lv = 0; st.tool = 'select'; U.setView('plan');
        const ol = B.outline(st.b);
        return { closed: ol.closed, levels: st.b.levels.length, bearing: st.b.walls.filter(w => w.kind === 'int').length };
      }, s);
      if (!info.closed) { continue; }
      o.houses++;
      // the stair: a type by tap, then its sizes and its place
      if (info.levels > 1) {
        o.multi++;
        const ty = STAIRS[o.multi % 4];
        await page.click(`.agh-bld-stairtype[data-type="${ty}"]`); await page.waitForTimeout(80);
        const sr = await page.evaluate(() => { const U = window.AGH_BuildUI, b = U.state().b, s = b.slab.stair, c = window.AGH_Build.stairCalc(b, s.type, s.width); return { type: s.type, state: U._prog.stairState(), c }; });
        o.stairs[sr.type] = (o.stairs[sr.type] || 0) + 1;
        if (sr.state === 'ok') { o.stairOk++; } else { fail.push(['stair', s, sr.type, sr.state]); }
        const c = sr.c;
        if (c && c.rise <= 0.19 + 1e-9 && c.blondel >= 0.6 - 1e-9 && c.blondel <= 0.65 + 1e-9 && (c.type === 'spiral' ? c.going >= 0.2 : c.going >= 0.26) && Math.abs(c.H / c.n - c.rise) < 0.0006) { o.stairRule++; } else { fail.push(['stairRule', s, c]); }
      }
      // the dialog, by real taps
      const t0 = Date.now();
      await page.click('.agh-bld-progbtn');
      await page.waitForSelector('.agh-bld-modal .agh-bld-pill');
      const bud0 = await page.evaluate(() => window.AGH_BuildUI._prog.budget(0));
      const k = 3 + (s % 4), types = TYPES.slice(0, k), share = Math.max(10, bud0.avail * 0.6);
      const areas = types.map((tp, i) => Math.max(2, Math.round(share * (i === 0 ? 0.4 : 0.6 / (k - 1)) * 2) / 2));
      for (const tp of types) { await page.click(`.agh-bld-modal .agh-bld-pill[data-type="${tp}"]`); }
      for (let i = 0; i < k; i++) {
        const row = (await page.$$('.agh-bld-modal .agh-bld-progrow'))[i], ins = await row.$$('input[type="number"]');
        if (i === 1) { await ins[1].fill('3.2'); await ins[1].dispatchEvent('change'); await ins[2].fill('3.5'); await ins[2].dispatchEvent('change'); areas[1] = 11.2; }
        else { await ins[0].fill(String(areas[i])); await ins[0].dispatchEvent('change'); }
      }
      // the balance adds up, every row says whether and how it fits
      const bal = await page.evaluate(() => { const e = document.querySelector('.agh-bld-modal .agh-bld-budget'); return e ? { avail: +e.dataset.avail, net: +e.dataset.net, rest: +e.dataset.rest } : null; });
      o.budgetN++; if (bal && Math.abs(bal.avail - bal.net - bal.rest) <= 0.011) { o.budgetOk++; } else { fail.push(['budget', s, bal]); }
      o.fitRows += await page.$$eval('.agh-bld-modal .agh-bld-progrow', rs => rs.filter(r => r.dataset.fit === '1' || r.dataset.fit === '0').length);
      // the dialog lists the layout rules one by one (teljesül / nem teljesül)
      const dl = await page.evaluate(() => { const e = document.querySelector('.agh-bld-modal .agh-bld-laysum'); return e ? { n: +e.dataset.n, li: document.querySelectorAll('.agh-bld-modal .agh-bld-layrule').length, fix: !!document.querySelector('.agh-bld-modal .agh-bld-layfix') } : null; });
      if (dl && dl.n > 0 && dl.li === dl.n && dl.fix) { o.layDlg++; } else { fail.push(['layDialog', s, dl]); }
      await page.click('.agh-bld-modal .agh-bld-progdone');
      await page.waitForSelector('.agh-bld-modal', { state: 'detached' });
      o.ms.push(Date.now() - t0);
      let A = await page.evaluate(() => window.__pg.audit(0));
      o.rects += A.n;
      o.placedDone += A.rects.filter(r => r.state === 'ok').length;
      // areas as asked (another proportion is allowed, the area is kept)
      A.rects.forEach((r, i) => { if (Math.abs(r.w * r.d - areas[i]) > 0.5) { fail.push(['area', s, r.type, r.w * r.d, areas[i]]); } });
      // drag the smallest placed one 1 m to the side by mouse: it snaps onto a face line; then Ctrl+Z
      const pick = A.rects.filter(r => r.state === 'ok').sort((p, q) => p.w * p.d - q.w * q.d)[0];
      if (pick) {
        const snap0 = await page.evaluate(() => window.__pg.snap());
        const from = await page.evaluate((r) => window.__pg.scr(r.x + r.w / 2, r.y + r.d / 2), pick), to = await page.evaluate((r) => window.__pg.scr(r.x + r.w / 2 + 1.0, r.y + r.d / 2 + 0.07), pick);
        await page.mouse.move(from.x, from.y); await page.mouse.down();
        for (let i = 1; i <= 8; i++) { await page.mouse.move(from.x + (to.x - from.x) * i / 8, from.y + (to.y - from.y) * i / 8); }
        await page.mouse.up(); await page.waitForTimeout(60);
        o.dragged++;
        const dr = await page.evaluate((id) => window.AGH_BuildUI.state().b.prog.filter(r => r.id === id)[0], pick.id);
        if (dr && Math.abs(dr.x - pick.x) > 0.5) { o.dragOk++; }
        const onLine = await page.evaluate((id) => {
          const U = window.AGH_BuildUI, b = U.state().b, C = U._prog.cfg(), r = b.prog.filter(q => q.id === id)[0], ys = [];
          b.walls.forEach(w => { if (w.kind !== 'ext' && w.lv !== 0) { return; } const m = w.t / 2 + C.p; if (w.a[1] === w.b[1]) { ys.push(w.a[1] - m, w.a[1] + m); } });
          b.prog.forEach(q => { if (q.id !== id && q.lv === 0) { ys.push(q.y - C.gap, q.y + q.d + C.gap); } });
          return ys.some(c => Math.abs(c - r.y) <= 0.0051 || Math.abs(c - r.y - r.d) <= 0.0051);
        }, pick.id);
        if (onLine) { o.snapOk++; } else { fail.push(['snap', s, dr && [dr.x, dr.y]]); }
        const mid = await page.evaluate((id) => { const r = window.AGH_BuildUI.state().b.prog.filter(q => q.id === id)[0]; return window.__pg.scr(r.x + r.w / 2, r.y + r.d / 2); }, pick.id);
        const before = await page.evaluate((id) => window.AGH_BuildUI.state().b.prog.filter(q => q.id === id)[0], pick.id);
        await page.mouse.dblclick(mid.x, mid.y); await page.waitForTimeout(60);
        const tr = await page.evaluate((id) => window.AGH_BuildUI.state().b.prog.filter(r => r.id === id)[0], pick.id);
        if (tr && Math.abs(tr.w - before.d) < 0.001 && Math.abs(tr.d - before.w) < 0.001) { o.turnOk++; } else { fail.push(['turn', s]); }
        await page.focus('.agh-bld-svg');
        for (let u = 0; u < 3 && (await page.evaluate(() => window.__pg.snap())) !== snap0; u++) { await page.keyboard.press('Control+z'); await page.waitForTimeout(50); }
      }
      // automatic placement
      await page.click('.agh-bld-progauto'); await page.waitForTimeout(80);
      A = await page.evaluate(() => window.__pg.audit(0));
      const ok = A.rects.filter(r => r.state === 'ok').length;
      o.placed += ok; o.missed += A.n - ok; o.overlap += A.ov; o.gapBad += A.gapBad;
      o.outside += A.rects.filter(r => r.state === 'out' && r.x < 900 && false).length;
      o.onStair += A.rects.filter(r => r.state === 'stair').length;
      // 1.25.0: the layout rules after the automatic placement, and two of them checked with the test's own geometry
      const L = await page.evaluate(() => {
        const B = window.AGH_Build, U = window.AGH_BuildUI, b = U.state().b, ev = U._prog.layout(0), C = U._prog.cfg(), P = B.defaults().programme.layout;
        const ps = b.prog.filter(r => r.lv === 0 && U._prog.state(r) === 'ok'), gap = P.adj_gap, lap = P.adj_overlap;
        const touch = (a, c) => { const dx = Math.max(c.x - (a.x + a.w), a.x - (c.x + c.w)), dy = Math.max(c.y - (a.y + a.d), a.y - (c.y + c.d)), ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x), oy = Math.min(a.y + a.d, c.y + c.d) - Math.max(a.y, c.y); return (dx <= gap && oy >= Math.min(lap, a.d, c.d) - 0.001) || (dy <= gap && ox >= Math.min(lap, a.w, c.w) - 0.001); };
        const SLEEP = ['master', 'bedroom', 'guest', 'kids'], beds = ps.filter(r => SLEEP.indexOf(r.type) !== -1), baths = ps.filter(r => r.type === 'bathroom');
        const links = ps.filter(r => r.type === 'corridor' || r.type === 'hall').filter(c => beds.filter(q => touch(c, q)).length >= Math.min(2, beds.length));
        const bath = beds.length && baths.length ? baths.every(r => beds.some(q => touch(r, q)) || links.some(c => touch(r, c))) : null;
        // the garden side: the living room lies on an outer wall whose outside faces the garden (the back,
        // turned by the orientation), or in the garden half of the house with a window on an outer wall
        const ol = B.outline(b), P0 = ol.inner.map(q => [q[0] / 1000, q[1] / 1000]), g = P.garden_dir[window.AGH_Designer.config().orientation || 'south'] || [0, -1], gl = Math.hypot(g[0], g[1]);
        let A2 = 0, cx = 0, cy = 0; P0.forEach((p, i) => { const q = P0[(i + 1) % P0.length], cr = p[0] * q[1] - q[0] * p[1]; A2 += cr; cx += (p[0] + q[0]) * cr; cy += (p[1] + q[1]) * cr; }); cx /= 3 * A2; cy /= 3 * A2;
        const onWall = (r, wantGarden) => P0.some((p, i) => {
          const q = P0[(i + 1) % P0.length], v = Math.abs(p[0] - q[0]) < 1e-6; if (!v && Math.abs(p[1] - q[1]) > 1e-6) { return false; }
          let nx = v ? 1 : 0, ny = v ? 0 : 1; const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; if (B._inPoly(ol.inner, Math.round((mx + nx * 0.01) * 1000), Math.round((my + ny * 0.01) * 1000))) { nx = -nx; ny = -ny; }
          if (wantGarden && (nx * g[0] + ny * g[1]) / gl <= 0.3) { return false; }
          const c = v ? p[0] : p[1], e0 = v ? r.x : r.y, e1 = v ? r.x + r.w : r.y + r.d, lo = v ? r.y : r.x, hi = v ? r.y + r.d : r.x + r.w, a0 = Math.min(v ? p[1] : p[0], v ? q[1] : q[0]), a1 = Math.max(v ? p[1] : p[0], v ? q[1] : q[0]);
          return (Math.abs(e0 - c) <= C.p + 0.03 || Math.abs(e1 - c) <= C.p + 0.03) && Math.min(hi, a1) - Math.max(lo, a0) >= Math.min(lap, hi - lo) - 0.001;
        });
        const livs = ps.filter(r => r.type === 'living' || r.type === 'living_kitchen');
        const liv = livs.length ? livs.every(r => onWall(r, true) || ((r.x + r.w / 2 - cx) * g[0] + (r.y + r.d / 2 - cy) * g[1] > 0 && onWall(r, false))) : null;
        const li = document.querySelectorAll('.agh-bld-panel .agh-bld-layrule'), sum = document.querySelector('.agh-bld-panel .agh-bld-laysum');
        return { n: ev ? ev.n : 0, pass: ev ? ev.pass : 0, bad: ev ? ev.rules.filter(x => x.ok === false).map(x => x.id) : [], bath, liv, list: li.length, okLi: Array.from(li).filter(x => x.dataset.ok === '1').length, sumPass: sum ? +sum.dataset.pass : -1, fix: !!document.querySelector('.agh-bld-panel .agh-bld-layfix') };
      });
      if (L.n) {
        o.layN++; o.layPct += L.pass / L.n; o.layPass += L.pass; o.layAll += L.n;
        L.bad.forEach(id => { o.layBad[id] = (o.layBad[id] || 0) + 1; });
        if (L.list === L.n && L.okLi === L.pass && L.sumPass === L.pass && L.fix) { o.layList++; } else { fail.push(['layList', s, L.list, L.n, L.okLi, L.pass, L.fix]); }
      }
      if (L.bath !== null) { o.bathN++; if (L.bath) { o.bathOk++; } else { fail.push(['bathSleep', s]); } }
      if (L.liv !== null) { o.livN++; if (L.liv) { o.livOk++; } else { fail.push(['livingGarden', s]); } }
      // „Elrendezés javítása”: never worse, no room lost, no overlap; Ctrl+Z gives back the automatic placement byte for byte
      if (L.fix) {
        o.fixN++;
        const snapF = await page.evaluate(() => window.__pg.snap()), placed0 = A.rects.filter(r => r.state === 'ok').length;
        await page.click('.agh-bld-panel .agh-bld-layfix'); await page.waitForTimeout(80);
        const F = await page.evaluate(() => { const ev = window.AGH_BuildUI._prog.layout(0), a = window.__pg.audit(0); return { pass: ev.pass, score: ev.score, ov: a.ov, gapBad: a.gapBad, placed: a.rects.filter(r => r.state === 'ok').length, snap: window.__pg.snap() }; });
        if (F.ov === 0 && F.gapBad === 0 && F.placed >= placed0 && F.pass >= L.pass) { o.fixOk++; } else { fail.push(['fix', s, F, L.pass, placed0]); }
        if (F.pass > L.pass) { o.fixBetter++; }
        if (F.snap !== snapF) { await page.focus('.agh-bld-svg'); await page.keyboard.press('Control+z'); await page.waitForTimeout(60); }
        if (await page.evaluate(() => window.__pg.snap()) === snapF) { o.fixUndo++; } else { fail.push(['fixUndo', s]); }
      }
      // partitions round the rooms
      const before = await page.evaluate((c) => ({ snap: window.__pg.snap(), st: window.__pg.struct(c), n: window.AGH_BuildUI.state().b.walls.length, bearing: window.AGH_BuildUI.state().b.walls.filter(w => w.kind === 'int').length }), STRUCT);
      if (await page.$('.agh-bld-progwalls:not([disabled])')) {
        await page.click('.agh-bld-progwalls'); await page.waitForTimeout(80);
        const after = await page.evaluate((c) => {
          const B = window.AGH_Build, U = window.AGH_BuildUI, b = U.state().b, C = U._prog.cfg(), rooms = B.rooms(B.normalize(b), 0), A = window.__pg.audit(0);
          let typed = 0, n = 0, net = 0, netN = 0; const bad = [];
          A.rects.filter(r => r.state === 'ok').forEach(r => {
            n++;
            const mx = Math.round((r.x + r.w / 2) * 1000), my = Math.round((r.y + r.d / 2) * 1000);
            const rm = rooms.filter(q => B._inPoly(q.net, mx, my)).sort((p, q) => p.area - q.area)[0];
            if (rm && b.rooms[rm.key] === (r.type === 'other' ? 'living' : r.type)) { typed++; } else { bad.push(['type', r.type]); }
            if (rm) {
              // the room's net area between the wall faces, minus the plaster on its perimeter
              const bb = rm.bbox, per = 2 * ((bb.x1 - bb.x0) + (bb.y1 - bb.y0)) / 1000, fin = rm.area / 1e6 - per * C.p;
              netN++; if (Math.abs(fin - r.w * r.d) <= 0.5) { net++; } else { bad.push(['net', r.type, +fin.toFixed(2), +(r.w * r.d).toFixed(2)]); }
            }
          });
          return { st: window.__pg.struct(c), n: b.walls.length, typed, rooms: n, net, netN, bad, bearing: b.walls.filter(w => w.kind === 'int').length };
        }, STRUCT);
        o.walls += after.n - before.n; o.typed += after.typed; o.typeN += after.rooms; o.netOk += after.net; o.netN += after.netN;
        if (after.bad.length) { fail.push(['rooms', s, after.bad.slice(0, 4)]); }
        if (after.bearing < before.bearing) { o.bearingLost++; }
        if (after.st > before.st) { o.structUp++; fail.push(['struct', s, before.st, after.st]); }
        await page.focus('.agh-bld-svg'); await page.keyboard.press('Control+z'); await page.waitForTimeout(60);
        if (await page.evaluate(() => window.__pg.snap()) === before.snap) { o.undoOk++; } else { fail.push(['undo', s]); }
      } else { o.undoOk++; }
      // the largest free space really takes a room of that size; a room over the balance turns it red
      const free = await page.evaluate(() => window.AGH_BuildUI._prog.largest(0));
      if (free && free.w >= 1 && free.d >= 1) {
        o.freeN++;
        await page.click('.agh-bld-progbtn'); await page.waitForSelector('.agh-bld-modal .agh-bld-pill');
        await page.click('.agh-bld-modal .agh-bld-pill[data-type="office"]');
        const rows = await page.$$('.agh-bld-modal .agh-bld-progrow'), ins = await rows[rows.length - 1].$$('input[type="number"]');
        await ins[1].fill(String(free.w)); await ins[1].dispatchEvent('change'); await ins[2].fill(String(free.d)); await ins[2].dispatchEvent('change');
        const fitted = await page.$$eval('.agh-bld-modal .agh-bld-progrow', rs => rs[rs.length - 1].dataset.fit);
        if (fitted === '1') { o.freeOk++; } else { fail.push(['free', s, free]); }
        // over the balance
        await page.click('.agh-bld-modal .agh-bld-pill[data-type="gym"]');
        const rows2 = await page.$$('.agh-bld-modal .agh-bld-progrow'), ins2 = await rows2[rows2.length - 1].$$('input[type="number"]');
        await ins2[0].fill('400'); await ins2[0].dispatchEvent('change');
        o.overN++;
        const red = await page.evaluate(() => { const e = document.querySelector('.agh-bld-modal .agh-bld-budget'), rs = document.querySelectorAll('.agh-bld-modal .agh-bld-progrow'); return !!e && +e.dataset.rest < 0 && !!e.querySelector('.is-bad') && rs[rs.length - 1].dataset.fit === '0'; });
        if (red) { o.overOk++; } else { fail.push(['over', s]); }
        await page.click('.agh-bld-modal .agh-bld-modal-head .agh-iconbtn'); await page.waitForSelector('.agh-bld-modal', { state: 'detached' });
      }
    }
    // the server keeps the programme and the designed stair (Validator → Build::sanitize = JS normalize)
    for (let s = 1; s <= 10; s++) {
      const same = await page.evaluate(async (seed) => {
        const B = window.AGH_Build, U = window.AGH_BuildUI; U.load(B.randomHouse(8100 + seed)); U.goStep(6); const st = U.state();
        st.b.prog = [{ id: 'r1', type: 'bedroom', name: 'Hálószoba ' + seed, area: 12.5, w: 3.6, d: 3.47, x: 1.2, y: 0.9, lv: 0, placed: true }, { id: 'r2', type: 'other', name: 'Műterem', area: 9, w: 3, d: 3, x: 30, y: 2, lv: 0, placed: false }];
        if (st.b.levels.length > 1) { st.b.slab.stair = { x: 1.5, y: 1.5, w: 1, d: 4.2, type: ['straight', 'l', 'u', 'spiral'][seed % 4], width: 0.95, rot: 90 }; }
        const rest = (window.AGH_LOADER || {}).rest || '/wp-json/agh/v1/', boot = await (await fetch(rest + 'bootstrap', { credentials: 'same-origin' })).json();
        const resp = await fetch(rest + 'validate', { method: 'POST', credentials: 'same-origin', headers: Object.assign({ 'Content-Type': 'application/json', 'X-AGH-Nonce': boot.nonce || '' }, boot.wpNonce ? { 'X-WP-Nonce': boot.wpNonce } : {}), body: JSON.stringify({ config: { build: st.b } }) });
        const j = await resp.json(), sb = j && j.config && j.config.build, nb = B.normalize(st.b);
        return !!sb && nb.prog.length === 2 && JSON.stringify(sb) === JSON.stringify(nb);
      }, s);
      o.server++; if (same) { o.serverSame++; }
    }
  } finally {
    await browser.close();
    if (!process.env.AGH_KEEP_BUILD) { console.error(toggle(false)); }
  }
  if (fail.length) { console.error(JSON.stringify(fail.slice(0, 20))); }
  const ms = o.ms.slice().sort((a, b) => a - b), med = ms.length ? ms[Math.floor(ms.length / 2)] : 0;
  const ok = o.houses > 0 && o.stairOk === o.multi && o.stairRule === o.multi && o.budgetOk === o.budgetN && o.fitRows > 0 && o.dragOk === o.dragged && o.snapOk === o.dragged && o.turnOk === o.dragged && o.overlap === 0 && o.gapBad === 0 && o.onStair === 0 && o.walls > 0 && o.typed === o.typeN && o.netOk === o.netN && o.bearingLost === 0 && o.structUp === 0 && o.undoOk === o.houses && o.freeOk === o.freeN && o.overOk === o.overN && o.serverSame === o.server && !errors.length
    && o.layN > 0 && o.layPct / o.layN >= 0.85 && o.bathOk === o.bathN && o.livOk === o.livN && o.layList === o.layN && o.layDlg === o.houses && o.fixOk === o.fixN && o.fixUndo === o.fixN;
  console.log(`helyiségprogram: ${o.houses} ház (${o.multi} többszintes) – lépcső jó helyen ${o.stairOk}/${o.multi}, lépcsőszabály ${o.stairRule}/${o.multi} ${JSON.stringify(o.stairs)}; mérleg összege ${o.budgetOk}/${o.budgetN}; ${o.rects} téglalap, „Kész” után az alapban ${o.placedDone}; húzás ${o.dragOk}/${o.dragged} (falsíkra/szomszédra ${o.snapOk}), dupla kattintás 90° ${o.turnOk}/${o.dragged}; automatikus: elhelyezve ${o.placed}, nem fért el ${o.missed}, átfedés ${o.overlap}, hézag < fal+vakolat ${o.gapBad}, lépcsőn ${o.onStair}; falak +${o.walls}, típus ${o.typed}/${o.typeN}, nettó m² ±0,5 ${o.netOk}/${o.netN}, teherhordó fal eltűnt ${o.bearingLost}, szerkezeti hiba +${o.structUp}, Ctrl+Z ${o.undoOk}/${o.houses}; legnagyobb szabad hely elfér ${o.freeOk}/${o.freeN}, túllépés piros ${o.overOk}/${o.overN}; ablak medián ${med} ms · elrendezési szabályok (${o.layN} ház): átlag ${o.layN ? (100 * o.layPct / o.layN).toFixed(1) : '–'} % (${o.layPass}/${o.layAll}), fürdő hálónál/közlekedőn ${o.bathOk}/${o.bathN}, nappali a kerti oldalon ${o.livOk}/${o.livN}, kiírás 6. lépés ${o.layList}/${o.layN}, ablak ${o.layDlg}/${o.houses}, javítás ${o.fixOk}/${o.fixN} (jobb ${o.fixBetter}, Ctrl+Z ${o.fixUndo}/${o.fixN}), nem teljesült ${JSON.stringify(o.layBad)} · szerver = JS ${o.serverSame}/${o.server} · konzolhiba ${errors.length}${errors.length ? ' ' + JSON.stringify(errors.slice(0, 3)) : ''}`);
  process.exit(ok ? 0 : 1);
})();
