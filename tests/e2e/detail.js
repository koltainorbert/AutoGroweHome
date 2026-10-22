// Medence és garázs részletesen E2E (1.22.0), a tesztoldalon (bin/test-wp.sh):
//  (1) minden medenceforma, lefedés, terasz és garázstető/kapu/fal/beálló beállítással a 3D ház felépül,
//      konzolhiba nélkül, és a 3D-ben más lesz (anyagonkénti háromszögszám);
//  (2) a garázs a 3D-ben megfogható és arrébb húzható: a hely a `site_layout.garage`-ba kerül, a ház újraépül,
//      és a 2D vázlat is ott rajzolja;
//  (3) ami nem fér el a telken (túl nagy medence, túl széles garázs), azt a mező alatt kiírja.
// Használat: node tests/e2e/detail.js   (tesztoldal: bin/test-wp.sh)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';

(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('agh_e2e_detail')) { localStorage.clear(); localStorage.setItem('agh_e2e_detail', '1'); } localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 200)));
  const res = [];
  const ok = (cond, name) => { res.push([!!cond, name]); if (!cond || process.env.AGH_V) { console.log((cond ? '  ok: ' : '  HIBA: ') + name); } };
  await page.goto(URL, { waitUntil: 'networkidle' });
  const base = { garden_features: ['lawn', 'paths', 'pool'], garage: 'garage_2', plot_width: 34, plot_length: 52, terrace_area: 20 };
  await page.evaluate(async (cfg) => {
    const b = await (await fetch(window.AGH_LOADER.rest.replace(/\/$/, '') + '/bootstrap')).json();
    const ex = {}; Object.keys(cfg).forEach(k => { ex[k] = true; });
    localStorage.setItem('agh_draft_v1', JSON.stringify({ v: b.version, config: Object.assign({}, b.defaults, cfg), explicit: ex, project: null, mode: 'detailed' }));
  }, base);
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[data-agh-open]');
  await page.waitForSelector('.agh-shell .agh-preview-box.has-3d canvas', { timeout: 90000 });
  await page.waitForTimeout(3000);
  // set config values the way the designer does, then wait for the 3D to rebuild
  const sig = () => page.evaluate(() => { const m = {}; window.AGH_3D.viewer().house.root.traverse(o => { if (o.isMesh && o.geometry) { const k = (o.material && o.material.userData && o.material.userData.key) || '?'; const g = o.geometry; m[k] = (m[k] || 0) + (g.index ? g.index.count / 3 : g.attributes.position.count / 3); } }); return JSON.stringify(Object.keys(m).sort().map(k => [k, Math.round(m[k])])); });
  const setCfg = async (patch) => {
    const before = await page.evaluate(() => window.AGH_3D.viewer().house && window.AGH_3D.viewer().house.root.uuid);
    await page.evaluate((patch) => { window.AGH_Designer && window.AGH_Designer.set ? window.AGH_Designer.set(patch) : null; }, patch);
    const has = await page.evaluate(() => !!(window.AGH_Designer && window.AGH_Designer.set));
    if (!has) {
      await page.evaluate((patch) => { const d = JSON.parse(localStorage.getItem('agh_draft_v1')); Object.assign(d.config, patch); Object.keys(patch).forEach(k => { d.explicit[k] = true; }); localStorage.setItem('agh_draft_v1', JSON.stringify(d)); }, patch);
      await page.reload({ waitUntil: 'networkidle' }); await page.click('[data-agh-open]'); await page.waitForSelector('.agh-shell .agh-preview-box.has-3d canvas', { timeout: 90000 }); await page.waitForTimeout(2500);
    } else {
      for (let i = 0; i < 60; i++) { await page.waitForTimeout(150); const now = await page.evaluate(() => window.AGH_3D.viewer().house && window.AGH_3D.viewer().house.root.uuid); if (now && now !== before) { break; } }
      await page.waitForTimeout(400);
    }
  };
  // (1) variants build and change the 3D
  const VARS = [{ pool_shape: 'l_shape' }, { pool_shape: 'oval' }, { pool_shape: 'infinity', pool_cover: 'slatted' }, { pool_shape: 'jacuzzi' }, { pool_shape: 'rect', pool_cover: 'telescopic', pool_deck: 'wood' }, { pool_cover: 'roller', pool_finish: 'black' },
    { garage_roof: 'gable' }, { garage_roof: 'shed', garage_facade: 'wood' }, { garage_door: 'roller', garage_door_color: '#8A2E2E' }, { garage_door: 'glass', garage_spaces: 3 }, { garage_rooms: ['workshop'], garage_window: true, garage_side_door: true }, { garage: 'carport' }];
  let changed = 0, built = 0, prev = await sig();
  for (const v of VARS) {
    const e0 = errors.length;
    await setCfg(v);
    const s = await sig();
    if (errors.length === e0) { built++; }
    if (s !== prev) { changed++; } else { console.log('  nem változott: ' + JSON.stringify(v)); }
    prev = s;
  }
  ok(built === VARS.length, '3D felépül minden változattal (' + built + '/' + VARS.length + ')');
  ok(changed === VARS.length, 'a 3D minden változatnál más (' + changed + '/' + VARS.length + ')');
  // (2) the garage moves
  await setCfg({ garage: 'garage_2', site_layout: {} });
  const spot = await page.evaluate(() => {
    const v = window.AGH_3D.viewer(), r = v.el.getBoundingClientRect(), mf = v.house.moversFit, o = mf && mf.children.find(q => q.userData.slot === 'garage');
    if (!o) { return null; }
    for (const ps of [[30, 40], [60, 35], [10, 30], [90, 40]]) {
      v.c._cam = ps; v.fitCamera(true); v.controls.update(); v.camera.updateMatrixWorld(true);
      for (const hh of [1.2, 2.0, 0.6]) for (const dx of [0, 0.8, -0.8]) {
        const q = o.position.clone(); q.y = hh; q.x += dx; q.project(v.camera);
        const sx = r.left + (q.x + 1) / 2 * r.width, sy = r.top + (1 - q.y) / 2 * r.height, it = v.extAt(sx, sy);
        if (it && it.type === 'mover' && it.obj === o) { return { x: sx, y: sy, cx: o.position.x, cz: o.position.z }; }
      }
    }
    return null;
  });
  ok(!!spot, 'a garázs megfogható a 3D-ben');
  if (spot) {
    await page.mouse.move(spot.x, spot.y); await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(spot.x + 90 * i / 8, spot.y + 40 * i / 8); await page.waitForTimeout(30); }
    await page.mouse.up(); await page.waitForTimeout(2500);
    const g = await page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('agh_draft_v1')).config.site_layout || {}).garage || null; } catch (e) { return null; } });
    ok(!!g && Math.hypot(g.x - spot.cx, g.y - spot.cz) > 0.5, 'a garázs új helye mentve (' + JSON.stringify(g) + ')');
    const at = await page.evaluate(() => { const v = window.AGH_3D.viewer(), o = v.house.moversFit && v.house.moversFit.children.find(q => q.userData.slot === 'garage'); return o ? { x: o.position.x, z: o.position.z } : null; });
    ok(at && g && Math.abs(at.x - g.x) < 0.05 && Math.abs(at.z - g.y) < 0.05, 'a ház újraépült, a garázs az új helyen ' + JSON.stringify(at));
    const two = await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('agh_draft_v1')).config, K = window.AGH_Sketch, pl = K.plan(c), v = K._volumes(c, pl), G = K._garageRect(c, v, pl); return G ? { x: (G.x0 + G.x1) / 2, y: (G.y0 + G.y1) / 2 } : null; });
    ok(two && g && Math.abs(two.x - g.x) < 0.05 && Math.abs(two.y - g.y) < 0.05, 'a 2D terv is ott rajzolja a garázst ' + JSON.stringify(two));
  }
  // (3) what does not fit is said at the field
  await setCfg({ site_layout: {}, garage: 'garage_2', garden_features: ['lawn', 'pool'], pool_length: 15, pool_width: 8, plot_width: 18, plot_length: 30 });
  const msgs = await page.evaluate(() => {
    const K = window.AGH_Sketch, c = JSON.parse(localStorage.getItem('agh_draft_v1')).config;
    return K._siteFit(c).map(m => m.key);
  });
  ok(msgs.includes('fit_pool_max') || msgs.includes('fit_pool_none'), 'túl nagy medence: jelzés (' + msgs.join(',') + ')');
  ok(msgs.includes('fit_garage') || msgs.includes('fit_plot'), 'keskeny telek: a garázs/ház jelzése');
  ok(!errors.length, 'konzolhiba 0' + (errors.length ? ' ' + JSON.stringify(errors.slice(0, 3)) : ''));
  await browser.close();
  const good = res.filter(r => r[0]).length;
  console.log(`medence és garázs: ${good}/${res.length} ellenőrzés ${good === res.length ? 'zöld' : 'HIBA'} (3D változat ${built}/${VARS.length}, mind más ${changed}/${VARS.length})`);
  process.exit(good === res.length ? 0 : 1);
})();
