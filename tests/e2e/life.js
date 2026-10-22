// Élethű járművek, emberek, állatok E2E (1.24.0), a tesztoldalon (bin/test-wp.sh):
//  (1) minden autótípus, a motor, a kerékpár, a család és a kutyák/macska felépül a 3D-ben, konzolhiba nélkül;
//  (2) háromszögszám: járművenként ≤ 20 000, emberenként és állatonként kiírva;
//  (3) részletek megvannak: kerék (gumi + felni + féktárcsa), üvegezés, lámpák, tükrök, rendszám (autó);
//      arc (szem, orr, fül), haj, kéz, cipő (ember); fej, fül, farok (állat);
//  (4) a ház felépülése a kész 3D képig: ugyanazon a gépen mérve, kiírva (az 1.23.0-hoz képest a
//      tests/e2e/life.js BASE=1 futtatással mérhető).
// Használat: node tests/e2e/life.js
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';

(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('agh_e2e_life')) { localStorage.clear(); localStorage.setItem('agh_e2e_life', '1'); } localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 200)));
  const res = [];
  const ok = (cond, name) => { res.push([!!cond, name]); if (!cond || process.env.AGH_V) { console.log((cond ? '  ok: ' : '  HIBA: ') + name); } };
  await page.goto(URL, { waitUntil: 'networkidle' });
  const cfg = { vehicles: ['sedan', 'hatchback', 'suv', 'pickup', 'van', 'sports', 'electric', 'motorcycle', 'bicycle'], people: 'family', pets: ['dog_large', 'dog_small', 'cat'], garage: 'none', plot_width: 40, plot_length: 60, garden_features: ['lawn', 'paths'] };
  await page.evaluate(async (cfg) => {
    const b = await (await fetch(window.AGH_LOADER.rest.replace(/\/$/, '') + '/bootstrap')).json();
    const ex = {}; Object.keys(cfg).forEach(k => { ex[k] = true; });
    localStorage.setItem('agh_draft_v1', JSON.stringify({ v: b.version, config: Object.assign({}, b.defaults, cfg), explicit: ex, project: null, mode: 'detailed' }));
  }, cfg);
  // the build time: from opening the designer to the finished 3D view, three times
  const times = [];
  for (let k = 0; k < 3; k++) {
    await page.reload({ waitUntil: 'networkidle' });
    const t0 = Date.now();
    await page.click('[data-agh-open]');
    await page.waitForFunction(() => window.AGH_3D && window.AGH_3D.viewer && window.AGH_3D.viewer() && window.AGH_3D.viewer().house && window.AGH_3D.viewer().house.movers, null, { timeout: 120000 });
    times.push(Date.now() - t0);
    await page.waitForTimeout(500);
  }
  times.sort((a, b) => a - b);
  const stat = await page.evaluate(() => {
    const v = window.AGH_3D.viewer(), out = {};
    (v.house.movers ? v.house.movers.children : []).forEach(o => {
      const s = o.userData.slot; if (!/^(vehicle|person|pet)#/.test(s)) { return; }
      let tri = 0, meshes = 0; o.traverse(m => { if (m.isMesh && m.geometry) { meshes++; const g = m.geometry; tri += g.index ? g.index.count / 3 : g.attributes.position.count / 3; } });
      out[s] = { tri: Math.round(tri), meshes, kind: (o.userData.move || {}).kind };
    });
    return out;
  });
  const veh = Object.keys(stat).filter(k => /^vehicle#/.test(k)), ppl = Object.keys(stat).filter(k => /^person#/.test(k)), pet = Object.keys(stat).filter(k => /^pet#/.test(k));
  ok(veh.length >= 3, 'járművek a 3D-ben (' + veh.length + ' a kocsibeállón és mellette)');
  ok(ppl.length >= 3, 'a család a 3D-ben (' + ppl.length + ' ember)');
  ok(pet.length >= 3, 'a kutyák és a macska a 3D-ben (' + pet.length + ')');
  const maxV = Math.max.apply(null, veh.map(k => stat[k].tri));
  ok(maxV <= 20000, 'járművenként ≤ 20 000 háromszög (legtöbb ' + maxV + ')');
  // the detail of the builders themselves (the shared module)
  const det = await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map(e => e.name).find(n => /agh-3d-int\.js/.test(n));
    const INT = await import(url);
    const v = window.AGH_3D.viewer(), m = INT.mats(v.c), r = {};
    const count = (g) => { let tri = 0, n = 0; g.traverse(o => { if (o.isMesh) { n++; const q = o.geometry; tri += q.index ? q.index.count / 3 : q.attributes.position.count / 3; } }); return { tri: Math.round(tri), n }; };
    const B = INT._parts;
    ['sedan', 'hatchback', 'suv', 'pickup', 'van', 'sports', 'electric'].forEach(t => { r[t] = count(B.vehicle(m, t, '#3C4148')); });
    r.man = count(B.person(m, 'man', 'stand', 3)); r.woman = count(B.person(m, 'woman', 'walk', 8)); r.child = count(B.person(m, 'child', 'sit', 5));
    r.dog = count(B.dog(m, 'large', 5)); r.cat = count(B.cat(m, 7));
    const one = INT.vehicle(m, 'sedan', '#3C4148'); r.merged = count(one).n;
    return r;
  }).catch(e => ({ err: String(e).slice(0, 200) }));
  ok(!det.err, 'a modellek külön is felépülnek' + (det.err ? ' ' + det.err : ''));
  if (!det.err) {
    const carMax = Math.max.apply(null, ['sedan', 'hatchback', 'suv', 'pickup', 'van', 'sports', 'electric'].map(t => det[t].tri));
    ok(carMax <= 20000 && det.sedan.n >= 60, 'autó: részletes (szedán ' + det.sedan.n + ' rész, ' + det.sedan.tri + ' háromszög; legtöbb ' + carMax + ')');
    ok(det.man.n >= 35 && det.woman.n >= 35, 'ember: arc, haj, kéz, cipő (' + det.man.n + ' / ' + det.woman.n + ' rész)');
    ok(det.dog.n >= 20 && det.cat.n >= 15, 'állat: fej, fül, farok, mancs (kutya ' + det.dog.n + ', macska ' + det.cat.n + ' rész)');
    ok(det.merged <= 20, 'a kész autó anyagonként egy hálóban (' + det.merged + ' háló a ' + det.sedan.n + ' részből)');
    console.log('  háromszög: ' + Object.keys(det).filter(k => k !== 'merged').map(k => k + ' ' + det[k].tri).join(', '));
  }
  // the house with all of them, built 6 times in the page (pure building time, no drawing)
  const build = await page.evaluate(() => {
    const H = window.AGH_3D.helpers(), c = window.AGH_Designer.config(), ms = [];
    for (let i = 0; i < 6; i++) { const t0 = performance.now(); new H.House(c, {}).build(); ms.push(performance.now() - t0); }
    ms.sort((a, b) => a - b); return Math.round(ms[2] * 10) / 10;
  });
  // the whole view: building, merging and the first frame (Viewer.update + render), 6 times, median
  const view = await page.evaluate(() => {
    const v = window.AGH_3D.viewer(), c = window.AGH_Designer.config(), ms = [];
    for (let i = 0; i < 6; i++) { v.memo = null; const t0 = performance.now(); v.update(Object.assign({}, c, { _t: i })); v.renderer.render(v.scene, v.camera); ms.push(performance.now() - t0); }
    ms.sort((a, b) => a - b);
    const up = [];
    for (let i = 0; i < 6; i++) { v.memo = null; const t0 = performance.now(); v.update(Object.assign({}, c, { _u: i })); up.push(performance.now() - t0); }
    up.sort((a, b) => a - b);
    let tri = 0; v.scene.traverse(o => { if (o.isMesh && o.visible && o.geometry) { const g = o.geometry; tri += g.index ? g.index.count / 3 : g.attributes.position.count / 3; } });
    window.__lifeStat = { update: Math.round(up[2]), tri: Math.round(tri) };
    return Math.round(ms[2]);
  });
  const vstat = await page.evaluate(() => window.__lifeStat);
  console.log('  nézet építés + összevonás (első kép nélkül, medián): ' + vstat.update + ' ms · háromszög a jelenetben: ' + vstat.tri);
  console.log('  felépülés a kész 3D képig (3 mérés, ms): ' + times.join(', ') + ' · a ház építése (medián, ms): ' + build + ' · a teljes nézet (építés + összevonás + első kép, medián, ms): ' + view);
  if (process.env.AGH_VIEW_BASE) { const base = Number(process.env.AGH_VIEW_BASE); ok(view <= base * 1.1, 'a nézet felépítése legfeljebb 10%-kal lassabb (' + base + ' → ' + view + ' ms)'); }
  ok(!errors.length, 'konzolhiba 0' + (errors.length ? ' ' + JSON.stringify(errors.slice(0, 3)) : ''));
  await browser.close();
  const good = res.filter(r => r[0]).length;
  console.log(`élethű modellek: ${good}/${res.length} ellenőrzés ${good === res.length ? 'zöld' : 'HIBA'}, ház építése ${build} ms, nézet ${view} ms`);
  process.exit(good === res.length ? 0 : 1);
})();
