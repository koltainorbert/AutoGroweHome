// Építési 3D E2E: véletlen rajzolt házakkal felépíti az „Építés az alapoktól” 3D jelenetét (agh-3d-build.js)
// a valódi előnézetben, és fázisonként méri a váltás idejét, a látható hálók számát, a falak kontúrját
// (az AGH_Build.outline külső kontúrjához képest) és azt, hogy a 9. fázis (kész ház) létrejött-e.
// Használat: node tests/e2e/build3d.js [darab]   (tesztoldal: bin/test-wp.sh)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';
const N = Number(process.argv[2] || 20);

(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 160)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('[data-agh-open]');
  await page.waitForSelector('.agh-shell .agh-preview-box.has-3d canvas', { timeout: 60000 });

  const res = await page.evaluate(async (count) => {
    const names = performance.getEntriesByType('resource').map(e => e.name);
    const sk = names.filter(x => x.indexOf('/agh-sketch.js') !== -1)[0];
    const d3 = names.filter(x => x.indexOf('/agh-3d.js') !== -1)[0] || '';
    const base = sk.slice(0, sk.indexOf('assets/js/agh-sketch.js'));
    const ver = d3.indexOf('?') !== -1 ? d3.slice(d3.indexOf('?')) : '';
    if (!window.AGH_Build) {
      await new Promise((ok, bad) => { const s = document.createElement('script'); s.src = base + 'assets/js/agh-build.js' + ver; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
    }
    const B = window.AGH_Build;
    const [defaults, hu] = await Promise.all([fetch(base + 'assets/data/build-defaults.json').then(r => r.json()), fetch(base + 'assets/data/rules/hu.json').then(r => r.json())]);
    B.setData({ defaults: defaults, rules: { hu: hu } });
    B.active = true;
    const mod = await import(base + 'assets/js/agh-3d-build.js' + ver);
    mod.install(window.AGH_3D);
    const THREE = await import(names.filter(x => x.indexOf('vendor/three/three.module') !== -1)[0]);
    const v = window.AGH_3D.viewer();
    const cfg0 = window.AGH_Designer.config();
    const out = { houses: 0, times: [], missing: 0, contour: 0, growth: 0, errors: [], counts: [] };
    const idle = async () => { for (let k = 0; k < 600 && v.compileJob; k++) { await new Promise(r => setTimeout(r, 50)); } };
    const visibleMeshes = (root) => {
      let n = 0;
      (function walk(o, vis) { vis = vis && o.visible; if (o.isMesh && vis) { n++; } o.children.forEach(ch => walk(ch, vis)); })(root, true);
      return n;
    };
    try {
      for (let i = 0; i < count; i++) {
        const b = B.randomHouse(1000 + i * 7919);
        v.update(Object.assign({}, cfg0, { build: b }), 'build');
        const hs = v.house;
        if (!hs || !hs.phases || hs.phases.length !== 10) { out.missing++; out.errors.push('nincs fázislista #' + i); continue; }
        if (hs.error) { out.errors.push('#' + i + ': ' + hs.error); }
        await idle();
        out.houses++;
        const counts = [];
        for (let p = 0; p <= 9; p++) {
          const t0 = performance.now();
          v.setPhase(p); v.render();
          out.times.push(performance.now() - t0);
          counts.push(visibleMeshes(hs.root));
          if (p > 0 && p < 9 && !hs.phases[p].children.length && !(p === 7 && !b.openings.some(op => { const w = b.walls.filter(x => x.id === op.wall)[0]; const li = w && B.lintel(b, w, op); return li && li.pcs; }))) { out.missing++; out.errors.push('#' + i + ' üres fázis ' + p); }
        }
        // the visible meshes grow from phase 0 to 8 (phase 7 may stay equal: lintels only on heavy walls)
        for (let p = 1; p <= 8; p++) { if (counts[p] < counts[p - 1] || (counts[p] === counts[p - 1] && p !== 7)) { out.growth++; out.errors.push('#' + i + ' fázis ' + p + ': ' + counts.join(',')); break; } }
        out.counts.push(counts.join(','));
        if (!hs.phases[9].children.length) { out.missing++; out.errors.push('#' + i + ' nincs 9. fázis'); }
        // phase 5 walls: their box equals the outline box (shifted to 0,0)
        const ol = B.outline(b);
        if (ol.closed) {
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          ol.outer.forEach(q => { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); });
          const W = (x1 - x0) / 1000, D = (y1 - y0) / 1000;
          hs.root.updateMatrixWorld(true);
          const bx = new THREE.Box3().setFromObject(hs.phases[5]);
          const dev = Math.max(Math.abs(bx.min.x), Math.abs(bx.max.x - W), Math.abs(bx.min.z), Math.abs(bx.max.z - D));
          if (!(dev <= 0.05)) { out.contour++; out.errors.push('#' + i + ' falkontúr ' + dev.toFixed(3) + ' m'); }
        }
      }
    } finally {
      B.active = false;
      try { v.update(cfg0); } catch (e) {}
    }
    return out;
  }, N);

  await browser.close();
  const avg = res.times.length ? res.times.reduce((a, b) => a + b, 0) / res.times.length : 0;
  const max = res.times.length ? Math.max.apply(null, res.times) : 0;
  const bad = (res.houses !== N ? 1 : 0) + res.missing + res.contour + res.growth + res.errors.length + errors.length;
  if (res.errors.length) { console.error(res.errors.slice(0, 8)); }
  if (errors.length) { console.error(errors.slice(0, 5)); }
  if (process.env.VERBOSE) { console.log(res.counts); }
  console.log(`építési 3D: ${res.houses} ház, fázisváltás átlag ${avg.toFixed(1)} ms / max ${max.toFixed(1)} ms, hiányzó fázis ${res.missing}, falkontúr-eltérés ${res.contour}, konzolhiba ${errors.length}`);
  process.exit(bad ? 1 : 0);
})();
