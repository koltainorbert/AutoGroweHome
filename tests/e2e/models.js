// Valódi 3D modellek E2E (1.13.0). A tesztkatalógus (tests/fixtures/models: két saját, CC0 dobozmodell,
// Meshopt + KTX2, mint az éles katalógus) a böngészőben a plugin modellútvonalára van irányítva, így a
// teljes lánc fut: modul, katalógus, Meshopt-dekódoló, KTX2-átkódoló, illesztés.
// Mér: kapcsoló ki = 0 modellkérés (a modul sem töltődik); be: a kanapé modellre cserélődik, a befoglalója
// 2 %-on belül a dobozbútoré, a slotnév, a mező és a koppintás megmarad; a túl eltérő arányú dohányzóasztal
// dobozbútor marad (megszámolva); asztali gépen „hi”, telefonon „lo” fájl; konzolhiba 0.
// Használat: node tests/e2e/models.js   (tesztoldal: bin/test-wp.sh; katalógus: tests/fixtures/build-test-models.sh)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const fs = require('fs'), path = require('path');
const URL0 = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';
const FIX = path.join(__dirname, '..', 'fixtures', 'models');
const ARGS = ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];

async function scenario(browser, { mob, param, route }) {
  const vp = mob ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const ctx = await browser.newContext({ viewport: vp, hasTouch: mob, isMobile: mob });
  await ctx.addInitScript(() => {
    try { localStorage.clear(); localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {}
    // a desktop with 8 cores and 8 GB (the test machine itself is weaker): the tier comes from the screen
    try { Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 }); Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 }); } catch (e) {}
  });
  const reqs = [];
  ctx.on('request', r => { const u = r.url(); if (/\/assets\/models\/|agh-3d-models\.js|GLTFLoader|KTX2Loader|basis_transcoder/.test(u)) { reqs.push(path.basename(new URL(u).pathname)); } });
  if (route) {
    await ctx.route('**/assets/models/**', (rt) => {
      const f = path.join(FIX, path.basename(new URL(rt.request().url()).pathname));
      if (fs.existsSync(f)) { rt.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.json') ? 'application/json' : 'model/gltf-binary' }); } else { rt.fulfill({ status: 404, body: '' }); }
    });
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') { errors.push(m.text().slice(0, 160)); } });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 160)));
  await page.goto(URL0 + (param ? '?agh_models=' + param : ''), { waitUntil: 'networkidle' });
  await page.click('[data-agh-open]');
  await page.waitForSelector('.agh-shell .agh-preview-box.has-3d canvas', { state: 'attached', timeout: 90000 });
  if (mob) { await page.$eval('.agh-mobile-tabs button:nth-child(2)', b => b.click()); }
  await page.waitForTimeout(1500);
  // belső nézet (nappali: kanapé, dohányzóasztal)
  await page.$eval('.agh-3d-view button:nth-child(2)', b => b.click());
  await page.waitForFunction(() => { const s = window.AGH_3D.models(); return !s || s.loading === undefined && (s.swapped + s.kept + s.failed >= 2 || !s.models); }, null, { timeout: 60000, polling: 250 }).catch(() => {});
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const v = window.AGH_3D.viewer(), st = window.AGH_3D.models();
    const items = (v.house && v.house.items ? v.house.items.children : []);
    const sofa = items.find(o => o.userData.item === 'sofa_type'), table = items.find(o => o.userData.item === 'coffee_table');
    // box of the visible meshes of a piece, in its own frame: [w, d, h] and centre
    function lbox(o, onlyModel) {
      o.updateWorldMatrix(true, true);
      const inv = o.matrixWorld.clone().invert(); let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      o.traverse(m => {
        if (!m.isMesh) { return; }
        let vis = true; for (let q = m; q && q !== o; q = q.parent) { if (onlyModel === true && !q.userData.aghModel && q.parent === o) { vis = false; } if (onlyModel === false && q.userData.aghModel) { vis = false; } }
        if (!vis) { return; }
        m.geometry.computeBoundingBox();
        const bb = m.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld));
        mn = [Math.min(mn[0], bb.min.x), Math.min(mn[1], bb.min.y), Math.min(mn[2], bb.min.z)];
        mx = [Math.max(mx[0], bb.max.x), Math.max(mx[1], bb.max.y), Math.max(mx[2], bb.max.z)];
      });
      return { s: [mx[0] - mn[0], mx[2] - mn[2], mx[1] - mn[1]], c: [(mx[0] + mn[0]) / 2, (mx[2] + mn[2]) / 2, mn[1]] };
    }
    let fit = null, pickOk = null;
    if (sofa && sofa.userData.aghSwapped) {
      const a = lbox(sofa, false), b = lbox(sofa, true);
      const rel = (x, y) => Math.abs(x - y) / Math.max(1e-3, y);
      fit = { box: a.s.map(x => +x.toFixed(3)), model: b.s.map(x => +x.toFixed(3)), w: rel(b.s[0], a.s[0]), d: rel(b.s[1], a.s[1]), cx: Math.abs(b.c[0] - a.c[0]) / a.s[0], cz: Math.abs(b.c[1] - a.c[1]) / a.s[1], floor: Math.abs(b.c[2] - a.c[2]) };
      // a tap on the sofa still names its field: the screen point of its centre
      const wp = sofa.localToWorld(sofa.position.clone().set(a.c[0], a.s[2] * 0.5, a.c[1]));
      const pr = wp.clone().project(v.camera), rc = v.el.getBoundingClientRect();
      const hit = v.pickAt(rc.left + (pr.x + 1) / 2 * rc.width, rc.top + (1 - pr.y) / 2 * rc.height);
      pickOk = !!hit && (hit.field === 'sofa_type' || hit.item === 'sofa_type');
    }
    return {
      stats: st, sofaSwapped: !!(sofa && sofa.userData.aghSwapped), sofaSlot: sofa ? sofa.userData.slot : null,
      sofaKidsHidden: sofa && sofa.userData.aghKids ? sofa.userData.aghKids.every(k => !k.visible) : null,
      tableSwapped: !!(table && table.userData.aghSwapped), fit, pickOk
    };
  });
  await ctx.close();
  return { reqs, errors, ...r };
}

(async () => {
  const browser = await chromium.launch({ args: ARGS });
  const checks = {}, ck = (k, v) => { checks[k] = !!v; };
  // 1. kapcsoló ki (?agh_models=0): sem modul, sem katalógus, sem modellfájl
  const off = await scenario(browser, { mob: false, param: '0', route: true });
  ck('ki_0_keres', off.reqs.length === 0); ck('ki_nincs_modul', off.stats === null); ck('ki_doboz', !off.sofaSwapped);
  // 2. alapállapot üres éles katalógussal: ugyanaz, mint kikapcsolva (1.12.1)
  const def = await scenario(browser, { mob: false, param: '', route: false });
  ck('ures_katalogus_0_keres', def.reqs.length === 0 && def.stats === null);
  // 3. be, asztali gép: hi fájlok, a kanapé modell lesz, az asztal marad
  const on = await scenario(browser, { mob: false, param: '1', route: true });
  ck('be_hi', on.stats && on.stats.tier === 'hi' && on.reqs.some(x => /-hi\.glb$/.test(x)) && !on.reqs.some(x => /-lo\.glb$/.test(x)));
  ck('be_kanape_modell', on.sofaSwapped && on.sofaKidsHidden === true);
  ck('be_befoglalo_2szazalek', on.fit && on.fit.w <= 0.02 && on.fit.d <= 0.02 && on.fit.cx <= 0.02 && on.fit.cz <= 0.02 && on.fit.floor <= 0.01);
  ck('be_slot_marad', on.sofaSlot === 'sofa_type#0');
  ck('be_koppintas', on.pickOk === true);
  ck('be_asztal_marad', !on.tableSwapped && on.stats.kept >= 1 && on.stats.reasons.coffee_table);
  ck('be_hibatlan_betoltes', on.stats.failed === 0 && on.stats.loaded >= 2);
  // 4. be, telefon: lo fájlok
  const ph = await scenario(browser, { mob: true, param: '1', route: true });
  ck('telefon_lo', ph.stats && ph.stats.tier === 'lo' && ph.reqs.some(x => /-lo\.glb$/.test(x)) && !ph.reqs.some(x => /-hi\.glb$/.test(x)));
  ck('telefon_kanape_modell', ph.sofaSwapped);
  // 5. katalógus: minden elem CC0, van forrás, szerző, dátum
  const man = JSON.parse(fs.readFileSync(path.join(FIX, 'manifest.json'), 'utf8'));
  ck('katalogus_cc0', man.models.every(e => e.license === 'CC0-1.0' && /^https:\/\//.test(e.source) && e.author && e.date));
  await browser.close();
  const errs = [off, def, on, ph].reduce((n, x) => n + x.errors.length, 0);
  const keys = Object.keys(checks), bad = keys.filter(k => !checks[k]);
  if (bad.length || errs) { console.error('HIBA:', bad.join(','), JSON.stringify({ on: { fit: on.fit, stats: on.stats, reqs: on.reqs }, ph: { stats: ph.stats, reqs: ph.reqs }, errors: [off, def, on, ph].map(x => x.errors) })); }
  const lef = on.stats ? `${on.stats.swapped}/${on.stats.swapped + on.stats.kept} darab kapott modellt` : '-';
  console.log(`valódi modellek: ${keys.length - bad.length}/${keys.length} ellenőrzés, lefedettség a tesztszobában ${lef}, befoglaló eltérés ${on.fit ? (Math.max(on.fit.w, on.fit.d) * 100).toFixed(1) + '%' : '-'}, kikapcsolva ${off.reqs.length} kérés, konzolhiba ${errs}`);
  process.exit(bad.length || errs ? 1 : 0);
})();
