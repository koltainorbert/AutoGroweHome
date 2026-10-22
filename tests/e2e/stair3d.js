// Lépcső 3D E2E (1.25.0, FELADAT 1.2): a tervezett lépcső (slab.stair.type/width/rot) mind a 4 típusnál
// (egyenes, L, U, csiga) megjelenik a kész ház (építési mód 9. lépés) 3D-jében és a belső (szobanézet) 3D-ben.
// Mér: a kész házban a fokok száma = az építési állásban (8. fázis) rajzolt fokoké, a födém lyuka egyezik
// (befoglaló méret ±1 cm), a belső nézetben van lépcső (a lépcső szobájában), a lépcső háromszögszáma, és a
// valódi előnézetben (összevonás + rajzolás) a konzolhiba 0.
// Használat: AGH_URL=http://127.0.0.1:8902/tervezo/ node tests/e2e/stair3d.js [házak típusonként]
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';
const PER = Number(process.argv[2] || 2);

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

  const res = await page.evaluate(async (per) => {
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
    const H = window.AGH_3D.helpers(), v = window.AGH_3D.viewer(), cfg0 = window.AGH_Designer.config();
    const out = { types: {}, cases: 0, treadSame: 0, holeSame: 0, roomOk: 0, roomUpOk: 0, viewOk: 0, tris: [], errors: [], noPlace: 0 };
    // the stair pieces of a scene part (before the merge): treads, triangles, slab opening bbox (plan metres)
    const scan = (root) => {
      let treads = 0, tris = 0, hole = null;
      root.updateMatrixWorld(true);
      root.traverse(o => {
        if (!o.isMesh || !o.userData || !o.userData.stair) { return; }
        const g = o.geometry, n = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
        if (o.userData.stair === 'tread') { treads++; }
        if (o.userData.stair !== 'slab') { tris += n; }
        if (o.userData.stair === 'slab' && g.parameters && g.parameters.shapes) {
          const shp = Array.isArray(g.parameters.shapes) ? g.parameters.shapes[0] : g.parameters.shapes;
          (shp.holes || []).forEach(hp => {
            const pts = hp.getPoints(), xs = pts.map(p => p.x), ys = pts.map(p => -p.y);
            const bb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
            if (!hole) { hole = bb; }
          });
        }
      });
      return { treads, tris, hole };
    };
    // a place for the stair inside the house: footprint and landings in the inner outline, on a 10 cm grid
    const place = (b, type, rot) => {
      const c0 = B.stairCalc(b, type, 1.0), ol = B.outline(b), sw = rot % 180 ? c0.d : c0.w, sd = rot % 180 ? c0.w : c0.d;
      if (!c0 || !ol.closed) { return false; }
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      ol.inner.forEach(q => { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); });
      const inside = (r) => [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.d], [r.x, r.y + r.d]].every(k => B._inPoly(ol.inner, Math.round(k[0] * 1000), Math.round(k[1] * 1000)));
      for (let y = y0 / 1000 + 0.15; y < y1 / 1000; y += 0.1) {
        for (let x = x0 / 1000 + 0.15; x < x1 / 1000; x += 0.1) {
          b.slab.stair = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, w: sw, d: sd, type, width: 1.0, rot };
          const s = B.stairRects(b);
          const ok = inside({ x: s.foot.x + 0.01, y: s.foot.y + 0.01, w: s.foot.w - 0.02, d: s.foot.d - 0.02 }) && (!s.bottom || inside(s.bottom)) && s.holePoly.every(p => B._inPoly(ol.inner, Math.round(p[0] * 1000), Math.round(p[1] * 1000)));
          if (ok) { return true; }
        }
      }
      return false;
    };
    const types = ['straight', 'l', 'u', 'spiral'];
    let seed = 0;
    try {
      for (const type of types) {
        out.types[type] = { n: 0, treads: [] };
        for (let k = 0; k < per; k++) {
          // a two-storey drawn house (randomHouse gives one or two storeys)
          let b = null;
          for (let tries = 0; tries < 60 && !b; tries++) { const q = B.randomHouse(5100 + (seed++) * 7919); if (q.levels.length === 2 && B.adapt(q).ok) { b = q; } }
          if (!b) { out.errors.push(type + ': nincs kétszintes ház'); continue; }
          // the rotation turns through the four directions over the houses (0° when the turned one does not fit)
          const rot = [0, 90, 180, 270][(k + types.indexOf(type)) % 4];
          if (!place(b, type, rot) && !place(b, type, 0)) { out.noPlace++; out.errors.push(type + ': nem fér el'); continue; }
          out.cases++; out.types[type].n++;
          const c = Object.assign({}, cfg0, { build: b, _phase: 9 });
          // the construction (phase 8) and the finished house (phase 9) of the same scene, before any merge
          const sc = mod.buildScene(c, H);
          if (sc.error) { out.errors.push(type + ' jelenet: ' + sc.error); }
          const p8 = scan(sc.phases[8]), p9 = scan(sc.phases[9]);
          out.types[type].treads.push(p8.treads + '/' + p9.treads);
          if (p8.treads > 0 && p8.treads === p9.treads) { out.treadSame++; } else { out.errors.push(type + ' fokok ' + p8.treads + ' ≠ ' + p9.treads); }
          const dh = p8.hole && p9.hole ? Math.max(...p8.hole.map((x, i) => Math.abs(x - p9.hole[i]))) : 1;
          // the opening of the plan (stairRects, shifted like the scene) as the third reference
          const sr = B.stairRects(b), ad = B.adapt(b), hp = sr.holePoly.map(q => [q[0] - ad.origin[0], q[1] - ad.origin[1]]);
          const ref = [Math.min(...hp.map(q => q[0])), Math.min(...hp.map(q => q[1])), Math.max(...hp.map(q => q[0])), Math.max(...hp.map(q => q[1]))];
          const dr = p9.hole ? Math.max(...ref.map((x, i) => Math.abs(x - p9.hole[i]))) : 1;
          if (dh <= 0.01 && dr <= 0.01) { out.holeSame++; } else { out.errors.push(type + ' lyuk eltér ' + dh.toFixed(3) + ' / ' + dr.toFixed(3)); }
          out.tris.push(p9.tris);
          // the real preview: build mode, phase 9 (merged per material, drawn once)
          v.update(c, 'build'); v.setPhase(9); v.render();
          if (v.house && v.house.phases && v.house.phases[9].visible) { out.viewOk++; } else { out.errors.push(type + ' 9. fázis nem látszik'); }
          // the room views: the room of the first tread (flight) and of the last one (arrival upstairs)
          const rooms = (B.params(b, c)._rooms || []);
          let lowN = 0, upN = 0;
          for (const r of rooms) {
            v.update(Object.assign({}, cfg0, { build: b, rooms: rooms.map(q => ({ id: q.id, type: q.type || 'living', area: q.area, level: q.level, width: q.width, length: q.length })), _int: { id: r.id, type: r.type || (r.level ? 'bedroom' : 'living'), area: r.area, width: r.width, length: r.length } }), 'interior');
            const t = v.house && v.house.stairTreads || 0;
            if (t > 0) { if (r.level === 0) { lowN++; } else { upN++; } }
          }
          if (lowN >= 1) { out.roomOk++; } else { out.errors.push(type + ' szobanézet: nincs lépcső a földszinten'); }
          if (upN >= 1) { out.roomUpOk++; } else { out.errors.push(type + ' szobanézet: nincs érkezés az emeleten'); }
        }
      }
    } catch (e) { out.errors.push('kivétel: ' + (e && e.stack ? e.stack.slice(0, 300) : e)); }
    finally {
      try { v.update(cfg0); } catch (e) {}
    }
    return out;
  }, PER);

  await browser.close();
  const tri = res.tris.length ? Math.max(...res.tris) : 0;
  const ok = res.cases === 4 * PER && res.treadSame === res.cases && res.holeSame === res.cases && res.roomOk === res.cases && res.roomUpOk === res.cases && res.viewOk === res.cases && !errors.length && !res.errors.length;
  if (res.errors.length) { console.error(res.errors.slice(0, 10)); }
  if (errors.length) { console.error(errors.slice(0, 5)); }
  console.log(`lépcső 3D: ${res.cases} ház (${Object.keys(res.types).map(k => k + ' ' + res.types[k].n + ' [' + res.types[k].treads.join(' ') + ']').join(', ')}) – fokok kész ház = építési állás ${res.treadSame}/${res.cases}, födémlyuk ±1 cm ${res.holeSame}/${res.cases}, belső nézet földszint ${res.roomOk}/${res.cases}, emelet ${res.roomUpOk}/${res.cases}, 9. fázis kirajzolva ${res.viewOk}/${res.cases}, lépcső háromszög max ${tri}, konzolhiba ${errors.length}`);
  process.exit(ok ? 0 : 1);
})();
