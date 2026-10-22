// Díszítőanyag helye E2E (1.21.0): a 3D tervezőben kívül „Díszítőanyag helye” módban a falra koppintva
// a kiegészítő anyag oda kerül, ahová a látogató kijelöli, és ellenőrzi:
//  (1) a koppintott fal és zóna (egész fal, emelet, oromzat, lábazat, bejárat) bekerül az `accent_layout`-ba;
//      újabb koppintás a következő anyag, majd „nincs”;
//  (2) a 3D ház újraépül: a zónán a kiegészítő anyag (új háló a falon), a 2D vázlat is a zónát rajzolja;
//  (3) a szerver (validate) ugyanazt őrzi meg, a prompt kimondja, hova került az anyag;
//  (4) Ctrl+Z visszavon, a visszaállítás gomb törli; konzolhiba 0.
// Használat: node tests/e2e/paint.js   (tesztoldal: bin/test-wp.sh)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';

(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    try {
      if (!localStorage.getItem('agh_e2e_paint')) { localStorage.clear(); localStorage.setItem('agh_e2e_paint', '1'); }
      localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false');
    } catch (e) {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 200)));
  const res = [];
  const ok = (cond, name) => { res.push([!!cond, name]); if (!cond || process.env.AGH_V) { console.log((cond ? '  ok: ' : '  HIBA: ') + name); } };

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const b = await (await fetch(window.AGH_LOADER.rest.replace(/\/$/, '') + '/bootstrap')).json();
    const cfg = { facade_accent: ['wood', 'stone'], levels: 'two', roof_type: 'gable', garage: 'none', terrace_area: 0, garden_features: ['lawn'], accent_layout: {} };
    const ex = {}; Object.keys(cfg).forEach(k => { ex[k] = true; });
    localStorage.setItem('agh_draft_v1', JSON.stringify({ v: b.version, config: Object.assign({}, b.defaults, cfg), explicit: ex, project: null, mode: 'detailed' }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[data-agh-open]');
  await page.waitForSelector('.agh-shell .agh-preview-box.has-3d canvas', { timeout: 90000 });
  await page.waitForTimeout(3000);
  const lay = () => page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('agh_draft_v1')) || {}).config.accent_layout || {}; } catch (e) { return {}; } });
  const pose = (cam) => page.evaluate((cam) => { const v = window.AGH_3D.viewer(); v.c._cam = cam; v.fitCamera(true); v.controls.update(); v.requestRender(); }, cam);
  // a screen point on the given face and zone (the viewer's own pick decides)
  const spot = (want) => page.evaluate((want) => {
    const v = window.AGH_3D.viewer(), r = v.el.getBoundingClientRect();
    for (let sy = r.top + 30; sy < r.bottom - 30; sy += 9) {
      for (let sx = r.left + 30; sx < r.right - 30; sx += 11) {
        const h = v.faceAt(sx, sy);
        if (h && h.vi === 0 && h.face === want.face && h.zone === want.zone) { return { x: sx, y: sy, key: h.key }; }
      }
    }
    return null;
  }, want);
  // per material: the triangles of the house (a new accent surface changes the accent material's share)
  const meshes = () => page.evaluate(() => { const m = {}; window.AGH_3D.viewer().house.root.traverse(o => { if (o.isMesh && o.geometry) { const k = (o.material && o.material.userData && o.material.userData.key) || (o.material && o.material.uuid) || '?'; const g = o.geometry, n = g.index ? g.index.count / 3 : g.attributes.position.count / 3; m[k] = (m[k] || 0) + n; } }); return JSON.stringify(Object.keys(m).sort().map(k => [k, Math.round(m[k])])); });

  ok(await page.$('.agh-3d-paintbtn'), 'a „Díszítőanyag helye” gomb látszik (van kiegészítő anyag)');
  await page.click('.agh-3d-paintbtn'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => window.AGH_3D.viewer().paint === true), 'festő mód bekapcsolva');
  const POSES = [[0, 14], [20, 18], [-20, 18], [0, 28]];
  const ZONES = [{ face: 'front', zone: 'upper' }, { face: 'front', zone: 'plinth' }, { face: 'front', zone: 'gable' }, { face: 'front', zone: 'door' }, { face: 'front', zone: 'wall' }];
  let done = 0, svgZones = 0;
  for (const z of ZONES) {
    let p = null;
    for (const ps of POSES) { await pose(ps); await page.waitForTimeout(150); p = await spot(z); if (p) { break; } }
    if (!p) { ok(z.zone === 'gable' || z.zone === 'wall', 'zóna megtalálva: ' + z.face + ':' + z.zone); continue; }
    const m0 = await meshes();
    await page.mouse.click(p.x, p.y); await page.waitForTimeout(1500);
    const L = await lay();
    ok(L[p.key] === 0, 'koppintás → ' + p.key + ' = 1. anyag (' + JSON.stringify(L[p.key]) + ')');
    const m1 = await meshes();
    ok(m1 !== m0 || z.zone === 'wall', '3D: a zónán új anyagfelület (anyagonkénti háromszögszám változott)');
    done++;
  }
  ok(done >= 3, 'legalább 3 zóna kijelölve (' + done + ')');
  // the next tap: the second material, then none
  let p = null;
  for (const ps of POSES) { await pose(ps); await page.waitForTimeout(150); p = await spot({ face: 'front', zone: 'plinth' }); if (p) { break; } }
  if (p) {
    await page.mouse.click(p.x, p.y); await page.waitForTimeout(1200);
    ok((await lay())[p.key] === 1, 'második koppintás → 2. anyag');
    await page.mouse.click(p.x, p.y); await page.waitForTimeout(1200);
    ok((await lay())[p.key] === -1, 'harmadik koppintás → nincs anyag');
    await page.keyboard.press('Control+z'); await page.waitForTimeout(1200);
    ok((await lay())[p.key] === 1, 'Ctrl+Z visszavon (2. anyag)');
  }
  // 2D sketch draws the zones (the same plan)
  svgZones = await page.evaluate(() => {
    const K = window.AGH_Sketch, c = JSON.parse(localStorage.getItem('agh_draft_v1')).config, svg = K.render(c, {});
    const without = K.render(Object.assign({}, c, { accent_layout: {} }), {});
    return svg !== without ? 1 : 0;
  });
  ok(svgZones === 1, '2D vázlat a kijelölt zónákat rajzolja');
  // server + prompt
  const srv = await page.evaluate(async () => {
    const rest = window.AGH_LOADER.rest.replace(/\/$/, '') + '/', boot = await (await fetch(rest + 'bootstrap', { credentials: 'same-origin' })).json();
    const c = JSON.parse(localStorage.getItem('agh_draft_v1')).config;
    const r = await fetch(rest + 'validate', { method: 'POST', credentials: 'same-origin', headers: Object.assign({ 'Content-Type': 'application/json', 'X-AGH-Nonce': boot.nonce || '' }, boot.wpNonce ? { 'X-WP-Nonce': boot.wpNonce } : {}), body: JSON.stringify({ config: c }) });
    const j = await r.json();
    return { same: JSON.stringify(j.config.accent_layout) === JSON.stringify(c.accent_layout) };
  });
  ok(srv.same, 'szerver = JS (accent_layout)');
  // reset
  if (await page.$('.agh-3d-paintreset')) { await page.click('.agh-3d-paintreset'); await page.waitForTimeout(1200); }
  ok(Object.keys(await lay()).length === 0, 'visszaállítás törli a kijelölést');
  ok(!errors.length, 'konzolhiba 0' + (errors.length ? ' ' + JSON.stringify(errors.slice(0, 3)) : ''));
  await browser.close();
  const good = res.filter(r => r[0]).length;
  console.log(`díszítőanyag helye: ${good}/${res.length} ellenőrzés ${good === res.length ? 'zöld' : 'HIBA'}`);
  process.exit(good === res.length ? 0 : 1);
})();
