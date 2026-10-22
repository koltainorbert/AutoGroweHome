// Építési mód – törlés és mozgatás E2E (1.19.0), a tesztoldalon (bin/test-wp.sh), bekapcsolt építési móddal.
//  Alaprajzon, N véletlen házon (alap 50), valódi egérrel és billentyűvel:
//   - ablak/ajtó húzása a saját falán (0,6 m), fal húzása önmagára merőlegesen (0,5 m, a csatlakozó falak
//     végei követik), nyíllal léptetés (10 cm), törlés Del-lel és a rajz fölötti kuka gombbal;
//   - minden művelet után a szerkezeti geometriai hibák száma nem nő (fal kilóg/átfed/lebeg, nyitott
//     körvonal, fal nélküli nyílás), és Ctrl+Z után a rajz bájtra az előző.
//  3D építési állásban, M házon (alap 8): ablak húzása a 3D-ben, kijelölés jelölődoboza, törlés a kuka
//  gombbal, visszavonás. A végén a szerver (validate) ugyanazt a rajzot adja vissza (JS = PHP). Konzolhiba 0.
// Használat: node tests/e2e/buildedit.js [N=50] [M=8]
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const path = require('path');
const { execFileSync } = require('child_process');
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';
const N = Number(process.argv[2] || 50), M = Number(process.argv[3] || 8);
const toggle = on => execFileSync('php', [path.join(__dirname, '..', 'build-toggle.php'), on ? 'on' : 'off', process.env.AGH_WP || '/home/claude/wpsite']).toString().trim();
const STRUCT = ['no_ext', 'ext_open', 'wall_short', 'wall_overlap', 'wall_float', 'wall_out', 'op_nowall', 'op_float'];

(async () => {
  console.error(toggle(true));
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 200)));
  const o = { houses: 0, opMove: 0, opMoveOk: 0, wallMove: 0, wallMoveOk: 0, joinedOk: 0, nudge: 0, nudgeOk: 0, del: 0, delOk: 0, binDel: 0, binDelOk: 0, undoOk: 0, undoN: 0, structUp: 0, d3: 0, d3Move: 0, d3Box: 0, d3Del: 0, d3Undo: 0, server: 0, serverSame: 0 };
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
    // helpers in the page: plan metres → screen, the structural error count, the drawing as text
    await page.evaluate(() => {
      window.__be = {
        scr: (x, y) => { const s = document.querySelector('.agh-bld-svg'), p = s.createSVGPoint(); p.x = x; p.y = y; const q = p.matrixTransform(s.getScreenCTM()); return { x: q.x, y: q.y }; },
        struct: (codes) => (window.AGH_Build.check(window.AGH_BuildUI.state().b).errors || []).filter(e => codes.indexOf(e.code) !== -1).length,
        snap: () => JSON.stringify(window.AGH_BuildUI.state().b)
      };
    });
    const drag = async (a, b) => {
      await page.mouse.move(a.x, a.y); await page.mouse.down();
      for (let i = 1; i <= 6; i++) { await page.mouse.move(a.x + (b.x - a.x) * i / 6, a.y + (b.y - a.y) * i / 6); }
      await page.mouse.up(); await page.waitForTimeout(60);
    };
    const undoTo = async (want) => { await page.focus('.agh-bld-svg'); await page.keyboard.press('Control+z'); await page.waitForTimeout(40); const now = await page.evaluate(() => window.__be.snap()); o.undoN++; if (now === want) { o.undoOk++; return true; } return false; };

    for (let s = 1; s <= N; s++) {
      const info = await page.evaluate((seed) => {
        const B = window.AGH_Build, U = window.AGH_BuildUI;
        U.load(B.randomHouse(2000 + seed)); U.goStep(7);
        const st = U.state(); st.tool = 'select'; st.lv = 0;
        U.setView('plan');
        const b = st.b, ops = b.openings.filter(q => q.lv === 0), op = ops[0];
        const wOf = id => b.walls.filter(w => w.id === id)[0];
        let opi = null;
        if (op) { const w = wOf(op.wall), L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), ux = (w.b[0] - w.a[0]) / L, uy = (w.b[1] - w.a[1]) / L, u = op.at + op.w / 2; opi = { id: op.id, at: op.at, p: [w.a[0] + ux * u, w.a[1] + uy * u], q: [w.a[0] + ux * (u + 0.6), w.a[1] + uy * (u + 0.6)] }; }
        // a wall to move: an inner one if there is any, axis-aligned, long enough, without an opening near the middle
        const cand = b.walls.filter(w => (w.a[0] === w.b[0] || w.a[1] === w.b[1]) && Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) > 2 && (w.kind !== 'ext' || true));
        cand.sort((p, q) => (p.kind === 'ext') - (q.kind === 'ext'));
        let wi = null;
        for (const w of cand) {
          const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), mid = L / 2;
          if (b.openings.some(q => q.wall === w.id && q.at < mid + 0.4 && q.at + q.w > mid - 0.4)) { continue; }
          const nx = w.a[1] === w.b[1] ? 0 : 1, ny = w.a[1] === w.b[1] ? 1 : 0, c = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
          wi = { id: w.id, kind: w.kind, a: w.a.slice(), b: w.b.slice(), p: c, q: [c[0] + nx * 0.5, c[1] + ny * 0.5], n: [nx, ny] };
          if (w.kind !== 'ext') { st.lv = w.lv; }
          break;
        }
        return { op: opi, wall: wi, nOps: b.openings.length, nWalls: b.walls.length };
      }, s);
      o.houses++;
      const st0 = () => page.evaluate((c) => window.__be.struct(c), STRUCT);
      // 1. an opening slides 0.6 m along its wall
      if (info.op) {
        o.opMove++;
        const before = await page.evaluate(() => window.__be.snap()), e0 = await st0();
        const a = await page.evaluate((p) => window.__be.scr(p[0], p[1]), info.op.p), b2 = await page.evaluate((p) => window.__be.scr(p[0], p[1]), info.op.q);
        await page.evaluate(() => { window.AGH_BuildUI.state().lv = 0; });
        await drag(a, b2);
        const r = await page.evaluate((id) => { const q = window.AGH_BuildUI.state().b.openings.filter(x => x.id === id)[0]; return q ? q.at : null; }, info.op.id);
        if (r !== null && Math.abs(r - info.op.at - 0.6) <= 0.06) { o.opMoveOk++; } else if (fail.length < 8) { fail.push('op ' + s + ': ' + info.op.at + ' → ' + r); }
        if ((await st0()) > e0) { o.structUp++; }
        if (await page.evaluate(() => window.__be.snap()) !== before) { await undoTo(before); }
        // 2. the arrow moves it 10 cm
        o.nudge++;
        await page.mouse.click(a.x, a.y); await page.waitForTimeout(30);
        const at0 = await page.evaluate((id) => window.AGH_BuildUI.state().b.openings.filter(x => x.id === id)[0].at, info.op.id);
        await page.focus('.agh-bld-svg');
        const dir = Math.abs(b2.x - a.x) >= Math.abs(b2.y - a.y) ? (b2.x > a.x ? 'ArrowRight' : 'ArrowLeft') : (b2.y > a.y ? 'ArrowDown' : 'ArrowUp');
        await page.keyboard.press(dir); await page.waitForTimeout(30);
        const at1 = await page.evaluate((id) => window.AGH_BuildUI.state().b.openings.filter(x => x.id === id)[0].at, info.op.id);
        if (Math.abs(Math.abs(at1 - at0) - 0.1) < 0.011) { o.nudgeOk++; } else if (fail.length < 8) { fail.push('nudge ' + s + ': ' + at0 + ' → ' + at1); }
        await undoTo(before);
        // 3. Del removes the selected opening
        o.del++;
        await page.mouse.click(a.x, a.y); await page.waitForTimeout(30);
        await page.focus('.agh-bld-svg'); await page.keyboard.press('Delete'); await page.waitForTimeout(40);
        const n1 = await page.evaluate(() => window.AGH_BuildUI.state().b.openings.length);
        if (n1 === info.nOps - 1) { o.delOk++; } else if (fail.length < 8) { fail.push('del ' + s + ': ' + info.nOps + ' → ' + n1); }
        await undoTo(before);
      }
      // 4. a wall slides 0.5 m square to itself; the joined walls follow
      if (info.wall) {
        o.wallMove++;
        const before = await page.evaluate(() => window.__be.snap()), e0 = await st0();
        await page.evaluate((w) => { const st = window.AGH_BuildUI.state(); if (w.kind !== 'ext') { const ww = st.b.walls.filter(x => x.id === w.id)[0]; st.lv = ww.lv; } }, info.wall);
        const a = await page.evaluate((p) => window.__be.scr(p[0], p[1]), info.wall.p), b2 = await page.evaluate((p) => window.__be.scr(p[0], p[1]), info.wall.q);
        await drag(a, b2);
        const r = await page.evaluate((w) => {
          const b = window.AGH_BuildUI.state().b, ww = b.walls.filter(x => x.id === w.id)[0], r2 = v => Math.round(v * 100) / 100;
          if (!ww) { return { ok: false }; }
          const na = [r2(w.a[0] + w.n[0] * 0.5), r2(w.a[1] + w.n[1] * 0.5)], nb = [r2(w.b[0] + w.n[0] * 0.5), r2(w.b[1] + w.n[1] * 0.5)];
          const moved = Math.abs(ww.a[0] - na[0]) < 0.011 && Math.abs(ww.a[1] - na[1]) < 0.011 && Math.abs(ww.b[0] - nb[0]) < 0.011 && Math.abs(ww.b[1] - nb[1]) < 0.011;
          // no other wall end is left at the old corners
          const left = b.walls.some(x => x.id !== w.id && [x.a, x.b].some(p => [w.a, w.b].some(q => Math.abs(p[0] - q[0]) < 0.005 && Math.abs(p[1] - q[1]) < 0.005)));
          return { ok: moved, joined: !left, at: [ww.a, ww.b] };
        }, info.wall);
        if (r.ok) { o.wallMoveOk++; } else if (fail.length < 8) { fail.push('wall ' + s + ' ' + info.wall.id + ': ' + JSON.stringify(r.at)); }
        if (r.joined) { o.joinedOk++; }
        if ((await st0()) > e0) { o.structUp++; }
        if (await page.evaluate(() => window.__be.snap()) !== before) { await undoTo(before); }
        // 5. the bin above the drawing removes the selected wall (and its openings)
        o.binDel++;
        await page.mouse.click(a.x, a.y); await page.waitForTimeout(40);
        const bin = await page.$('.agh-bld-selbar:not([hidden]) .agh-bld-seldel');
        if (bin) { await bin.click(); await page.waitForTimeout(40); }
        const gone = await page.evaluate((id) => !window.AGH_BuildUI.state().b.walls.some(x => x.id === id) && !window.AGH_BuildUI.state().b.openings.some(x => x.wall === id), info.wall.id);
        if (bin && gone) { o.binDelOk++; } else if (fail.length < 8) { fail.push('bin ' + s + ': ' + (bin ? 'not deleted' : 'no bin')); }
        await undoTo(before);
      }
    }

    // 3D construction view
    for (let s = 1; s <= M; s++) {
      await page.evaluate((seed) => { const B = window.AGH_Build, U = window.AGH_BuildUI; U.load(B.randomHouse(5000 + seed)); U.goStep(7); const st = U.state(); st.tool = 'select'; st.lv = 0; U.setView('3d'); }, s);
      await page.waitForTimeout(2500);
      o.d3++;
      // an opening of the ground floor in view: try a few camera turns
      const pick = await page.evaluate(async () => {
        const v = window.AGH_3D.viewer(), st = window.AGH_BuildUI.state(), b = st.b, B = window.AGH_Build, r = v.el.getBoundingClientRect(), org = v.house.origin;
        const t = v.controls.target.clone(), off = v.camera.position.clone().sub(t), R = off.length();
        for (const az of [0, 60, -60, 120, -120, 180]) {
          const a0 = Math.atan2(off.x, off.z) + az * Math.PI / 180, el = Math.asin(off.y / R);
          v.camera.position.set(t.x + R * Math.sin(a0) * Math.cos(el), t.y + R * Math.sin(el), t.z + R * Math.cos(a0) * Math.cos(el)); v.camera.lookAt(t); v.controls.update(); v.camera.updateMatrixWorld(true);
          for (const op of b.openings.filter(q => q.lv === 0)) {
            const w = b.walls.filter(x => x.id === op.wall)[0], L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), ux = (w.b[0] - w.a[0]) / L, uy = (w.b[1] - w.a[1]) / L, u = op.at + op.w / 2, y = B.levelBase(b, 0) + op.sill + op.h / 2;
            const P = v.camera.position.clone().set(w.a[0] + ux * u - org[0], y, w.a[1] + uy * u - org[1]), Q = P.clone().set(w.a[0] + ux * (u + 0.6) - org[0], y, w.a[1] + uy * (u + 0.6) - org[1]);
            const p = P.clone().project(v.camera), q = Q.clone().project(v.camera);
            if (Math.abs(p.x) > 0.9 || Math.abs(p.y) > 0.9) { continue; }
            const sx = r.left + (p.x + 1) / 2 * r.width, sy = r.top + (1 - p.y) / 2 * r.height, R = v.rayFrom(sx, sy).ray;
            const hit = window.AGH_BuildUI.pick3D({ o: [R.origin.x + org[0], R.origin.z + org[1], R.origin.y], d: [R.direction.x, R.direction.z, R.direction.y] });
            if (!hit || hit.k !== 'op' || hit.id !== op.id) { continue; }
            return { id: op.id, at: op.at, a: { x: sx, y: sy }, b: { x: r.left + (q.x + 1) / 2 * r.width, y: r.top + (1 - q.y) / 2 * r.height }, n: b.openings.length };
          }
        }
        return null;
      });
      if (!pick) { if (fail.length < 8) { fail.push('3d ' + s + ': no opening in view'); } continue; }
      const before = await page.evaluate(() => window.__be.snap());
      await drag(pick.a, pick.b);
      await page.waitForTimeout(1800);
      const r = await page.evaluate((id) => { const st = window.AGH_BuildUI.state(), q = st.b.openings.filter(x => x.id === id)[0], v = window.AGH_3D.viewer(); return { at: q ? q.at : null, sel: st.sel && st.sel.id, box: !!(v.bmark && v.bmark.visible), bin: !!document.querySelector('.agh-bld-selbar:not([hidden]) .agh-bld-seldel') }; }, pick.id);
      if (r.at !== null && Math.abs(r.at - pick.at - 0.6) <= 0.1) { o.d3Move++; } else if (fail.length < 8) { fail.push('3d move ' + s + ': ' + pick.at + ' → ' + r.at); }
      if (r.sel === pick.id && r.box) { o.d3Box++; }
      if (r.bin) { await page.click('.agh-bld-selbar .agh-bld-seldel'); await page.waitForTimeout(1500); }
      const n1 = await page.evaluate(() => window.AGH_BuildUI.state().b.openings.length);
      if (n1 === pick.n - 1) { o.d3Del++; }
      await page.keyboard.press('Control+z'); await page.waitForTimeout(300); await page.keyboard.press('Control+z'); await page.waitForTimeout(1500);
      if (await page.evaluate(() => window.__be.snap()) === before) { o.d3Undo++; }
    }

    // the server keeps exactly the edited drawing (Validator → Build::sanitize = JS normalize)
    for (let s = 1; s <= 10; s++) {
      const same = await page.evaluate(async (seed) => {
        const B = window.AGH_Build, U = window.AGH_BuildUI; U.load(B.randomHouse(7000 + seed)); U.goStep(7); const st = U.state();
        const w = st.b.walls.filter(x => x.kind !== 'ext' && (x.a[0] === x.b[0] || x.a[1] === x.b[1]))[0] || st.b.walls[0], op = st.b.openings[0];
        st.sel = { k: 'wall', id: w.id }; document.querySelector('.agh-bld-svg').focus();
        document.querySelector('.agh-bld-svg').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        if (op) { st.sel = { k: 'op', id: op.id }; document.querySelector('.agh-bld-svg').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true })); }
        const rest = (window.AGH_LOADER || {}).rest || '/wp-json/agh/v1/', boot = await (await fetch(rest + 'bootstrap', { credentials: 'same-origin' })).json();
        const c = { build: st.b };
        const resp = await fetch(rest + 'validate', { method: 'POST', credentials: 'same-origin', headers: Object.assign({ 'Content-Type': 'application/json', 'X-AGH-Nonce': boot.nonce || '' }, boot.wpNonce ? { 'X-WP-Nonce': boot.wpNonce } : {}), body: JSON.stringify({ config: c }) });
        const j = await resp.json(), sb = j && j.config && j.config.build;
        return !!sb && JSON.stringify(sb) === JSON.stringify(B.normalize(st.b));
      }, s);
      o.server++; if (same) { o.serverSame++; }
    }
  } finally {
    await browser.close();
    if (!process.env.AGH_KEEP_BUILD) { console.error(toggle(false)); }
  }
  if (fail.length) { console.error(fail); }
  if (errors.length) { console.error(errors.slice(0, 5)); }
  const ok = o.opMoveOk === o.opMove && o.wallMoveOk === o.wallMove && o.joinedOk === o.wallMove && o.nudgeOk === o.nudge && o.delOk === o.del && o.binDelOk === o.binDel && o.undoOk === o.undoN && o.structUp === 0
    && o.d3Move === o.d3 && o.d3Box === o.d3 && o.d3Del === o.d3 && o.d3Undo === o.d3 && o.serverSame === o.server && !errors.length;
  console.log(`építési szerkesztés: ${o.houses} ház – ablak/ajtó húzás ${o.opMoveOk}/${o.opMove}, fal húzás ${o.wallMoveOk}/${o.wallMove} (csatlakozó falak ${o.joinedOk}/${o.wallMove}), nyíl ${o.nudgeOk}/${o.nudge}, Del ${o.delOk}/${o.del}, kuka ${o.binDelOk}/${o.binDel}, Ctrl+Z bájtra ${o.undoOk}/${o.undoN}, szerkezeti hiba +${o.structUp} · 3D ${o.d3} ház: húzás ${o.d3Move}, jelölés ${o.d3Box}, törlés ${o.d3Del}, visszavonás ${o.d3Undo} · szerver = JS ${o.serverSame}/${o.server} · konzolhiba ${errors.length}`);
  process.exit(ok ? 0 : 1);
})();
