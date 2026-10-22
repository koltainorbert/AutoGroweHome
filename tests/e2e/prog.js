// Helyiségprogram E2E (1.20.0), a tesztoldalon (bin/test-wp.sh), bekapcsolt építési móddal.
//  N véletlen házon (alap 20), a 6. lépésben, valódi kattintással:
//   - „Helyiségek” gomb → felugró ablak; pillékre koppintva 3–6 helyiség, a m² beírva (a ház belső
//     területének kb. 55%-a), egynél szélesség × mélység is; „Kész”.
//   - a téglalapok területe = a beírt m² ± 0,5; a ház mellett várnak (nem az alapban);
//   - egy téglalap egérrel behúzva az alapba (a fal belső síkjára ugrik), dupla kattintás: 90°;
//   - „Automatikus elhelyezés”: átfedés 0, a körvonalon kívül 0 (ami nem fér el, a ház mellett marad);
//   - „Falak a téglalapok mentén”: új válaszfalak, a kapott helyiségek típusa a téglalapé, szerkezeti
//     hiba nem nő; Ctrl+Z bájtra vissza.
//  A végén a szerver (validate) ugyanazt a programot adja vissza (JS = PHP). Konzolhiba 0.
// Használat: node tests/e2e/prog.js [N=20]
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const path = require('path');
const { execFileSync } = require('child_process');
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';
const N = Number(process.argv[2] || 20);
const toggle = on => execFileSync('php', [path.join(__dirname, '..', 'build-toggle.php'), on ? 'on' : 'off', process.env.AGH_WP || '/home/claude/wpsite']).toString().trim();
const STRUCT = ['no_ext', 'ext_open', 'wall_short', 'wall_overlap', 'wall_float', 'wall_out', 'op_nowall', 'op_float'];
const TYPES = ['living_kitchen', 'master', 'bedroom', 'bathroom', 'wc', 'hall', 'office', 'pantry', 'kids', 'laundry'];

(async () => {
  console.error(toggle(true));
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 200)));
  const o = { houses: 0, rects: 0, areaOk: 0, parked: 0, dragged: 0, dragOk: 0, snapOk: 0, turnOk: 0, placed: 0, missed: 0, overlap: 0, outside: 0, walls: 0, typed: 0, typeN: 0, structUp: 0, undoOk: 0, server: 0, serverSame: 0, pills: 0 };
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
        // every rectangle: inside the inner outline? overlapping another one?
        audit: () => {
          const B = window.AGH_Build, b = window.AGH_BuildUI.state().b, ol = B.outline(b), e = 0.01;
          const inside = r => ol.closed && [[r.x + e, r.y + e], [r.x + r.w - e, r.y + e], [r.x + r.w - e, r.y + r.d - e], [r.x + e, r.y + r.d - e]].every(q => B._inPoly(ol.inner, Math.round(q[0] * 1000), Math.round(q[1] * 1000)));
          const ps = (b.prog || []).filter(r => r.lv === 0);
          let ov = 0;
          for (let i = 0; i < ps.length; i++) { for (let j = i + 1; j < ps.length; j++) { const p = ps[i], q = ps[j]; if (p.x < q.x + q.w - e && p.x + p.w > q.x + e && p.y < q.y + q.d - e && p.y + p.d > q.y + e) { ov++; } } }
          return { n: ps.length, inside: ps.filter(inside).length, ov, rects: ps.map(r => ({ id: r.id, x: r.x, y: r.y, w: r.w, d: r.d, type: r.type, area: r.area, inside: inside(r) })) };
        }
      };
    });
    for (let s = 1; s <= N; s++) {
      const info = await page.evaluate((seed) => {
        const B = window.AGH_Build, U = window.AGH_BuildUI;
        U.load(B.randomHouse(4100 + seed)); U.goStep(6);
        const st = U.state(); st.lv = 0; st.tool = 'select'; U.setView('plan');
        const ol = B.outline(st.b);
        return { inner: ol.closed ? Math.abs(B._area2(ol.inner)) / 2e6 : 0 };
      }, s);
      if (!info.inner) { continue; }
      o.houses++;
      // the dialog, by real taps
      await page.click('.agh-bld-progbtn');
      await page.waitForSelector('.agh-bld-modal .agh-bld-pill');
      const k = 3 + (s % 4), types = TYPES.slice(0, k), share = info.inner * 0.55;
      const areas = types.map((tp, i) => Math.max(2, Math.round(share * (i === 0 ? 0.4 : 0.6 / (k - 1)) * 2) / 2));
      for (const tp of types) { await page.click(`.agh-bld-modal .agh-bld-pill[data-type="${tp}"]`); o.pills++; }
      const rows = await page.$$('.agh-bld-modal .agh-bld-progrow');
      for (let i = 0; i < rows.length; i++) {
        const ins = await rows[i].$$('input[type="number"]');
        if (i === 1) { await ins[1].fill('3.2'); await ins[2].fill('3.5'); areas[1] = 11.2; } else { await ins[0].fill(String(areas[i])); }
      }
      await page.click('.agh-bld-modal .agh-bld-progdone');
      await page.waitForSelector('.agh-bld-modal', { state: 'detached' });
      let A = await page.evaluate(() => window.__pg.audit());
      o.rects += A.n;
      A.rects.forEach((r, i) => { if (Math.abs(r.w * r.d - areas[i]) <= 0.5) { o.areaOk++; } else { fail.push(['area', s, r.type, r.w * r.d, areas[i]]); } if (!r.inside) { o.parked++; } });
      // drag the smallest one into the base by mouse: its corner onto the inner corner of the outline
      const tgt = await page.evaluate(() => {
        const B = window.AGH_Build, st = window.AGH_BuildUI.state(), ol = B.outline(st.b), xs = ol.inner.map(q => q[0] / 1000), ys = ol.inner.map(q => q[1] / 1000);
        const r = st.b.prog.slice().sort((p, q) => p.w * p.d - q.w * q.d)[0], x0 = Math.min(...xs), y0 = Math.min(...ys);
        // a corner of the inner outline that is really a corner (bounding-box corner inside the polygon)
        const cx = r.x + r.w / 2, cy = r.y + r.d / 2;
        return { id: r.id, from: window.__pg.scr(cx, cy), to: window.__pg.scr(x0 + 0.08 + r.w / 2, y0 + 0.06 + r.d / 2), want: [x0, y0], w: r.w, d: r.d };
      });
      await page.mouse.move(tgt.from.x, tgt.from.y); await page.mouse.down();
      for (let i = 1; i <= 8; i++) { await page.mouse.move(tgt.from.x + (tgt.to.x - tgt.from.x) * i / 8, tgt.from.y + (tgt.to.y - tgt.from.y) * i / 8); }
      await page.mouse.up(); await page.waitForTimeout(60);
      o.dragged++;
      const dr = await page.evaluate((id) => window.AGH_BuildUI.state().b.prog.filter(r => r.id === id)[0], tgt.id);
      if (dr && (Math.abs(dr.x - tgt.want[0]) > 0.3 || Math.abs(dr.y - tgt.want[1]) > 0.3) === false) { o.dragOk++; }
      const onFace = await page.evaluate((id) => {
        const b = window.AGH_BuildUI.state().b, r = b.prog.filter(q => q.id === id)[0], xs = [], ys = [];
        b.walls.forEach(w => { if (w.kind !== 'ext' && w.lv !== 0) { return; } if (w.a[0] === w.b[0]) { xs.push(w.a[0] - w.t / 2, w.a[0] + w.t / 2); } else if (w.a[1] === w.b[1]) { ys.push(w.a[1] - w.t / 2, w.a[1] + w.t / 2); } });
        const on = (v, list) => list.some(c => Math.abs(c - v) <= 0.0051);
        return (on(r.x, xs) || on(r.x + r.w, xs)) && (on(r.y, ys) || on(r.y + r.d, ys));
      }, tgt.id);
      if (onFace) { o.snapOk++; } else { fail.push(['snap', s, dr && [dr.x, dr.y], tgt.want]); }
      // double click turns it by 90°
      const mid = await page.evaluate((id) => { const r = window.AGH_BuildUI.state().b.prog.filter(q => q.id === id)[0]; return window.__pg.scr(r.x + r.w / 2, r.y + r.d / 2); }, tgt.id);
      await page.mouse.dblclick(mid.x, mid.y); await page.waitForTimeout(60);
      const tr = await page.evaluate((id) => window.AGH_BuildUI.state().b.prog.filter(r => r.id === id)[0], tgt.id);
      if (tr && Math.abs(tr.w - tgt.d) < 0.001 && Math.abs(tr.d - tgt.w) < 0.001) { o.turnOk++; } else { fail.push(['turn', s, tr && [tr.w, tr.d], [tgt.w, tgt.d]]); }
      // automatic placement
      await page.click('.agh-bld-progauto'); await page.waitForTimeout(80);
      A = await page.evaluate(() => window.__pg.audit());
      o.placed += A.inside; o.missed += A.n - A.inside; o.overlap += A.ov;
      // outside the outline: a rectangle partly in the base (neither inside nor parked beside the house)
      const partly = await page.evaluate(() => { const B = window.AGH_Build, b = window.AGH_BuildUI.state().b, ol = B.outline(b); const xs = ol.inner.map(q => q[0] / 1000); const x1 = Math.max(...xs); return (b.prog || []).filter(r => r.lv === 0 && r.x < x1 && !(window.__pg.audit().rects.filter(q => q.id === r.id)[0].inside)).length; });
      o.outside += partly;
      // partitions along the rectangles
      const before = await page.evaluate((c) => ({ snap: window.__pg.snap(), st: window.__pg.struct(c), n: window.AGH_BuildUI.state().b.walls.length }), STRUCT);
      const canWalls = await page.$('.agh-bld-progwalls:not([disabled])');
      if (canWalls) {
        await page.click('.agh-bld-progwalls'); await page.waitForTimeout(80);
        const after = await page.evaluate((c) => {
          const B = window.AGH_Build, b = window.AGH_BuildUI.state().b, rooms = B.rooms(B.normalize(b), 0), A = window.__pg.audit();
          let typed = 0, n = 0; const bad = [];
          A.rects.filter(r => r.inside).forEach(r => { n++; const rm = rooms.filter(q => q.cx / 1000 > r.x && q.cx / 1000 < r.x + r.w && q.cy / 1000 > r.y && q.cy / 1000 < r.y + r.d)[0]; if (rm && b.rooms[rm.key] === (r.type === 'other' ? 'living' : r.type)) { typed++; } else { bad.push([r.type, r.x, r.y, r.w, r.d, rm ? b.rooms[rm.key] : null, rm ? Math.round(rm.area / 1e4) / 100 : null]); } });
          return { st: window.__pg.struct(c), n: b.walls.length, typed, rooms: n, bad };
        }, STRUCT);
        o.walls += after.n - before.n; o.typed += after.typed; o.typeN += after.rooms; if (after.bad.length) { fail.push(['type', s, after.bad]); }
        if (after.st > before.st) { o.structUp++; fail.push(['struct', s, before.st, after.st]); }
        await page.focus('.agh-bld-svg'); await page.keyboard.press('Control+z'); await page.waitForTimeout(60);
        if (await page.evaluate(() => window.__pg.snap()) === before.snap) { o.undoOk++; } else { fail.push(['undo', s]); }
      } else { o.undoOk++; }
    }
    // the server keeps the programme (Validator → Build::sanitize = JS normalize)
    for (let s = 1; s <= 10; s++) {
      const same = await page.evaluate(async (seed) => {
        const B = window.AGH_Build, U = window.AGH_BuildUI; U.load(B.randomHouse(8100 + seed)); U.goStep(6); const st = U.state();
        st.b.prog = [{ id: 'r1', type: 'bedroom', name: 'Hálószoba ' + seed, area: 12.5, w: 3.6, d: 3.47, x: 1.2, y: 0.9, lv: 0, placed: true }, { id: 'r2', type: 'other', name: 'Műterem', area: 9, w: 3, d: 3, x: 30, y: 2, lv: 0, placed: false }];
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
  const ok = o.houses > 0 && o.areaOk === o.rects && o.parked === o.rects && o.dragOk === o.dragged && o.snapOk === o.dragged && o.turnOk === o.dragged && o.overlap === 0 && o.outside === 0 && o.walls > 0 && o.typed === o.typeN && o.structUp === 0 && o.undoOk === o.houses && o.serverSame === o.server && !errors.length;
  console.log(`helyiségprogram: ${o.houses} ház, ${o.rects} téglalap (${o.pills} pille) – m² ±0,5: ${o.areaOk}/${o.rects}, a ház mellett indul ${o.parked}/${o.rects}; egérrel behúzva ${o.dragOk}/${o.dragged} (falsíkra ugrott ${o.snapOk}), dupla kattintás 90° ${o.turnOk}/${o.dragged}; automatikus: elhelyezve ${o.placed}, nem fért el ${o.missed}, átfedés ${o.overlap}, körvonalon kívül ${o.outside}; falak +${o.walls}, típus ${o.typed}/${o.typeN}, szerkezeti hiba +${o.structUp}, Ctrl+Z ${o.undoOk}/${o.houses} · szerver = JS ${o.serverSame}/${o.server} · konzolhiba ${errors.length}${errors.length ? ' ' + JSON.stringify(errors.slice(0, 3)) : ''}`);
  process.exit(ok ? 0 : 1);
})();
