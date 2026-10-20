// Építési mód E2E („Építés az alapoktól”), a tesztoldalon (bin/test-wp.sh), bekapcsolt építési móddal.
//  1. 100 véletlen ház végigmegy a lépéseken (0–9): minden lépés lezárható, a geometria 0 hibás
//     (kilógó fal, átfedés, nyílás a falon kívül, lebegő elem), a rajz és a modell egyezik, a ház
//     paraméterei (szintek, méret, helyiségek) a tervezőbe kerülnek.
//  2. 3D építési állás: 10 házon a fázis-csúszka 0–9, mért fázisváltási idő.
//  3. Kész ház a tervezőben: a 3D ház a rajzból épül (tömeg = rajz), a belső terek a rajz helyiségei,
//     koppintás, vezetőkép, 2D vázlat, a szerver ugyanazt a rajzot menti (validate), generálás indul.
//  4. Felület: túllógás, 24/44 px-es célok, apró szöveg minden lépésen és nézetben, 5 képernyőméreten.
// Használat: node tests/e2e/build.js [darab=100] [kimeneti mappa a képekhez]
// A végén a tesztoldal építési módját visszaállítja kikapcsoltra (AGH_KEEP_BUILD=1: bekapcsolva marad).
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';
const N = Number(process.argv[2] || 100);
const OUT = process.argv[3] || '';
const audit = fs.readFileSync(path.join(__dirname, 'responsive.js'), 'utf8').match(/function audit\(\) \{[\s\S]*?\n\}\n/)[0];
const toggle = on => execFileSync('php', [path.join(__dirname, '..', 'build-toggle.php'), on ? 'on' : 'off', process.env.AGH_WP || '/home/claude/wpsite']).toString().trim();
const ARGS = ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];

async function openBuild(browser, w, h, touch) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: !!touch, isMobile: !!touch && w < 900, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 160)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('[data-agh-open]');
  await page.waitForSelector('.agh-shell .agh-preview-box.has-3d canvas, .agh-shell .agh-preview-box svg', { timeout: 60000 });
  if (await page.$('.agh-bld-btn:visible')) { await page.click('.agh-bld-btn'); } else { await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.agh-hmenu-item')).filter(x => /alapokt/i.test(x.textContent))[0]; if (b) { b.click(); } }); }
  await page.waitForSelector('.agh-build .agh-bld-svg', { timeout: 20000 });
  return { ctx, page, errors };
}

(async () => {
  console.error(toggle(true));
  const browser = await chromium.launch({ args: ARGS });
  const res = {};
  try {
    /* 1 – 100 houses through the steps */
    const { page, errors } = await openBuild(browser, 1366, 768);
    Object.assign(res, await page.evaluate(async (N) => {
      const B = window.AGH_Build, U = window.AGH_BuildUI, o = { houses: 0, steps: 0, closed: 0, notClosable: [], geo: 0, wallOut: 0, opOut: 0, overlap: 0, float: 0, svgMismatch: 0, opsMismatch: 0, params: 0, rooms: 0, roof: 0, msMax: 0, msSum: 0 };
      for (let s = 1; s <= N; s++) {
        const b = B.randomHouse(1000 + s);
        const t0 = performance.now();
        U.load(b);
        for (let i = 0; i <= 9; i++) {
          U.goStep(i); o.steps++;
          const btn = document.querySelector('.agh-bld-next');
          if (btn && !btn.disabled) { U.closeStep(); o.closed++; } else if (o.notClosable.length < 5) { o.notClosable.push(s + ':' + i); }
        }
        const ms = performance.now() - t0; o.msMax = Math.max(o.msMax, ms); o.msSum += ms;
        const st = U.state(), chk = B.check(st.b);
        chk.errors.forEach(e => { o.geo++; if (e.code === 'wall_out') { o.wallOut++; } if (/^op_(outside|junction|nowall)$/.test(e.code)) { o.opOut++; } if (/overlap$/.test(e.code)) { o.overlap++; } if (/float$/.test(e.code)) { o.float++; } });
        // the plan shows exactly the walls and openings of the shown level
        U.goStep(6);
        const lv = U.state().lv;
        if (st.b.walls.filter(w => w.kind === 'ext' || w.lv === lv).length !== document.querySelectorAll('.agh-bld-svg .agh-bld-wall:not(.is-other)').length) { o.svgMismatch++; }
        if (st.b.openings.filter(op => op.lv === lv).length !== document.querySelectorAll('.agh-bld-svg .agh-bld-op').length) { o.opsMismatch++; }
        // the designer got the parameters that follow from the drawing
        const c = window.AGH_Designer.config(), p = B.params(st.b, c);
        if (c.levels === p.levels && Math.abs(c.building_width - p.building_width) < 1e-6 && Math.abs(c.building_length - p.building_length) < 1e-6 && c.net_area === p.net_area) { o.params++; }
        if (p._rooms.length < 2 || (c.rooms || []).length === p._rooms.length) { o.rooms++; }
        if (B.adapt(st.b).ok) { o.roof++; }
        o.houses++;
      }
      o.msAvg = Math.round(o.msSum / Math.max(1, o.houses)); o.msMax = Math.round(o.msMax); delete o.msSum;
      return o;
    }, N));
    res.console1 = errors.length; res.errors1 = errors.slice(0, 4);

    /* 2 – 3D construction stages */
    const p3 = await page.evaluate(async () => {
      const B = window.AGH_Build, U = window.AGH_BuildUI, out = { houses: 0, phaseMs: [], visible: [], missing: 0, wallBox: 0, no3d: 0 };
      const wait = (f, ms) => new Promise(r => { const t0 = Date.now(); (function q() { if (f() || Date.now() - t0 > ms) { r(f()); } else { setTimeout(q, 60); } })(); });
      for (let s = 1; s <= 10; s++) {
        const b = B.randomHouse(2000 + s);
        U.load(b); U.goStep(8); U.setView('3d');
        const ok = await wait(() => { const v = window.AGH_3D && window.AGH_3D.viewer(); return v && v.house && v.house.phases && v.house.phases.length; }, 20000);
        if (!ok) { out.no3d++; continue; }
        const v = window.AGH_3D.viewer(), hs = v.house;
        if (hs.phases.length < 10 || !hs.phases[9]) { out.missing++; }
        let prev = -1;
        for (let p = 0; p <= 9; p++) {
          const t0 = performance.now(); U.setPhase(p); v.render(); out.phaseMs.push(performance.now() - t0);
          let n = 0; hs.root.traverse(o => { if (o.isMesh) { let vis = true; for (let q = o; q; q = q.parent) { if (!q.visible) { vis = false; break; } } if (vis) { n++; } } });
          if (p <= 8 && n < prev) { out.missing++; }
          prev = n; out.visible.push(n);
        }
        out.houses++;
      }
      U.setView('plan');
      const ms = out.phaseMs.slice().sort((a, b) => a - b);
      return { houses: out.houses, no3d: out.no3d, missing: out.missing, phaseAvg: Math.round(ms.reduce((a, b) => a + b, 0) / Math.max(1, ms.length) * 10) / 10, phaseMax: Math.round((ms[ms.length - 1] || 0) * 10) / 10 };
    });
    res.phase = p3;

    /* 3 – the finished house in the designer */
    let genStatus = null, genBody = null;
    page.on('request', r => { if (/agh\/v1\/generate/.test(r.url())) { try { genBody = JSON.parse(r.postData() || '{}'); } catch (e) { genBody = null; } } });
    page.on('response', r => { if (/agh\/v1\/generate/.test(r.url())) { genStatus = r.status(); } });
    await page.evaluate(() => { const B = window.AGH_Build, U = window.AGH_BuildUI; U.load(B.randomHouse(77)); for (let i = 0; i <= 9; i++) { U.goStep(i); U.closeStep(); } });
    await page.waitForSelector('.agh-shell:not(.is-build) .agh-preview-box.has-3d canvas', { timeout: 30000 });
    await page.waitForTimeout(800);
    res.designer = await page.evaluate(async () => {
      const B = window.AGH_Build, c = window.AGH_Designer.config(), a = B.adapt(c.build), v = window.AGH_3D.viewer(), out = {};
      out.back = !document.querySelector('.agh-shell.is-build');
      out.vols = v && v.house && v.house.vols ? v.house.vols.length : -1;
      out.volsOk = out.vols === a.vols.length && Math.abs(v.house.pl.W - a.W) < 1e-6 && Math.abs(v.house.pl.D - a.D) < 1e-6;
      // 2D sketch of the same house: no broken numbers
      const svg = window.AGH_Sketch.render(c, { id: 'bt_' });
      out.sketchOk = svg.indexOf('NaN') === -1 && /viewBox/.test(svg);
      // tap on the model
      const r = v.renderer.domElement.getBoundingClientRect();
      const hit = v.pickAt(r.left + r.width / 2, r.top + r.height / 2);
      out.pick = hit ? (hit.field || hit.userData && hit.userData.field || 'ok') : '';
      // interior rooms = the drawing's rooms, each builds with its own size
      const url = n => (performance.getEntriesByType('resource').map(e => e.name).filter(x => x.indexOf(n) !== -1)[0] || n);
      const INT = await import(url('agh-3d-int.js'));
      let roomsOk = 0, roomsN = 0;
      (c.rooms || []).forEach(rm => { roomsN++; try { const hs = INT.interiorScene(c, rm); const R = hs.room || {}; if (!rm.width || (Math.abs(R.W - Math.max(rm.width, rm.length)) < 0.6 || Math.abs(R.W - Math.min(rm.width, rm.length)) < 0.6)) { roomsOk++; } } catch (e) { /* counted as failed */ } });
      out.rooms = roomsOk + '/' + roomsN;
      // guide pictures of the drawn house
      try { const g = await window.AGH_3D.guides(['hero', 'front'], 640, 400, null, { camera: 'visitor' }); out.guides = Object.keys(g || {}).filter(k => (g[k] || '').length > 1000).length; } catch (e) { out.guides = 'err ' + e.message; }
      // the server keeps exactly this drawing (Validator → Build::sanitize)
      const nonce = (window.AGH_LOADER || {}).wpNonce || '';
      const rest = (window.AGH_LOADER || {}).rest || '/wp-json/agh/v1/';
      try {
        const resp = await fetch(rest + 'validate', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce }, body: JSON.stringify({ config: c }) });
        const j = await resp.json();
        const sb = j && j.config && j.config.build;
        out.serverSame = !!sb && JSON.stringify(sb) === JSON.stringify(B.normalize(c.build));
        out.serverStatus = resp.status;
      } catch (e) { out.serverSame = 'err ' + e.message; }
      return out;
    });
    const gen = await page.$('.agh-actionbar .agh-btn-lg:not([disabled])');
    if (gen) { await gen.click(); await page.waitForTimeout(400); const ok = await page.$('.agh-dialog-foot .agh-btn-primary'); if (ok) { await ok.click(); } await page.waitForTimeout(2500); }
    res.designer.generate = genStatus;
    res.designer.genHasBuild = !!(genBody && genBody.config && genBody.config.build && genBody.config.build.walls && genBody.config.build.walls.length);
    res.console3 = errors.length - res.console1; res.errors3 = errors.slice(res.console1, res.console1 + 4);
    if (OUT) { await page.screenshot({ path: path.join(OUT, 'build-designer.png') }); }
    await page.context().close();

    /* 4 – layout on five screen sizes */
    const sizes = [['320x568', 320, 568, true], ['390x844', 390, 844, true], ['768x1024', 768, 1024, true], ['1366x768', 1366, 768, false], ['1920x1080', 1920, 1080, false]];
    const rows = [];
    for (const [label, w, h, touch] of sizes) {
      const o = await openBuild(browser, w, h, touch);
      await o.page.addScriptTag({ content: audit });
      await o.page.evaluate(() => { window.AGH_BuildUI.load(window.AGH_Build.randomHouse(5)); });
      for (const step of [0, 2, 5, 6, 7, 8, 9]) {
        for (const pane of ['panel', 'plan', '3d']) {
          await o.page.evaluate(([s, p]) => { const U = window.AGH_BuildUI; U.goStep(s); const b = document.querySelector('.agh-bld-panes button[data-pane="' + p + '"]'); if (b && b.offsetParent) { b.click(); } else { U.setView(p === '3d' ? '3d' : 'plan'); } }, [step, pane]);
          await o.page.waitForTimeout(pane === '3d' ? 900 : 120);
          const a = await o.page.evaluate(() => audit());
          rows.push({ size: label, step, pane, docX: a.docOverflowX, rootX: a.rootOverflowX, overflow: a.overflow, ex: a.overflowEx, lt24: a.lt24, lt24Ex: a.lt24Ex, lt44: touch ? a.lt44 : 0, zoom: touch ? a.zoomInputs : 0, tiny: a.tinyText, tinyEx: a.tinyEx });
          if (OUT && ((label === '1366x768' && [0, 5, 7].indexOf(step) !== -1 && pane !== 'panel') || (label === '390x844' && step === 5))) { await o.page.screenshot({ path: path.join(OUT, `build-${label}-s${step}-${pane}.png`) }); }
        }
      }
      rows.push({ size: label, console: o.errors.length, errors: o.errors.slice(0, 3) });
      await o.ctx.close();
    }
    const bad = rows.filter(r => r.docX > 0 || r.rootX > 0 || r.overflow > 0 || r.lt24 > 0 || r.lt44 > 0 || r.zoom > 0 || r.tiny > 0 || r.console > 0);
    res.layout = { checks: rows.length, bad: bad.length, ex: bad.slice(0, 6) };
  } finally {
    await browser.close();
    if (!process.env.AGH_KEEP_BUILD) { console.error(toggle(false)); }
  }
  const d = res.designer || {};
  const ok = res.houses === N && res.closed === N * 10 && res.geo === 0 && res.svgMismatch === 0 && res.opsMismatch === 0 && res.params === N && res.rooms === N && res.roof === N && !res.console1
    && res.phase && res.phase.houses === 10 && res.phase.missing === 0 && d.back && d.volsOk && d.sketchOk && d.serverSame === true && d.generate === 200 && d.genHasBuild && !res.console3 && res.layout && res.layout.bad === 0;
  console.log(`építési mód: ${res.houses} ház, ${res.closed}/${res.steps} lépés lezárva, geometriai hiba ${res.geo} (kilógó fal ${res.wallOut}, nyílás a falon kívül ${res.opOut}, átfedés ${res.overlap}, lebegő ${res.float}), rajz≠modell ${res.svgMismatch + res.opsMismatch}, paraméter ${res.params}/${res.houses}, helyiség ${res.rooms}/${res.houses}, tető ${res.roof}/${res.houses}, házonként átlag ${res.msAvg} ms (max ${res.msMax}); ` +
    `3D: ${res.phase ? res.phase.houses : 0} ház, fázisváltás átlag ${res.phase ? res.phase.phaseAvg : '-'} ms / max ${res.phase ? res.phase.phaseMax : '-'} ms, hiányzó fázis ${res.phase ? res.phase.missing : '-'}; ` +
    `tervező: tömeg ${d.volsOk ? 'egyezik' : 'ELTÉR'} (${d.vols} tömb), 2D ${d.sketchOk ? 'ok' : 'HIBA'}, koppintás „${d.pick}”, belső terek ${d.rooms}, vezetőkép ${d.guides}, szerver ${d.serverSame === true ? 'ugyanazt menti' : 'ELTÉR ' + d.serverSame}, generálás ${d.generate}${d.genHasBuild ? ' (a rajzzal)' : ''}; ` +
    `felület: ${res.layout ? res.layout.checks : 0} mérés, hibás ${res.layout ? res.layout.bad : '-'}; konzolhiba ${(res.console1 || 0) + (res.console3 || 0)}` + (ok ? '' : ' – HIBA ' + JSON.stringify({ nc: res.notClosable, e1: res.errors1, e3: res.errors3, lay: res.layout && res.layout.ex })));
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); try { toggle(false); } catch (x) {} process.exit(1); });
