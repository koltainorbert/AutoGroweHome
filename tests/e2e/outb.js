// Melléképületek E2E (1.23.0), a tesztoldalon (bin/test-wp.sh):
//  (1) a tervező „Kert” lapján a Melléképületek szerkesztőben pillére koppintva új épület, a szélesség
//      átírható, a kuka törli;
//  (2) 3 melléképület (műhely, külön garázs, üvegház) egy telken: átfedés 0, mind a telken belül, a 3D-ben
//      mind megfogható, a 2D vázlat rajzolja őket;
//  (3) egy melléképület a 3D-ben arrébb húzva: a hely a `site_layout`-ba kerül, újratöltés után ott marad;
//  (4) túl nagy melléképület kis telken: a mező alatt jelzés; konzolhiba 0.
// Használat: node tests/e2e/outb.js   (tesztoldal: bin/test-wp.sh)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';

(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('agh_e2e_outb')) { localStorage.clear(); localStorage.setItem('agh_e2e_outb', '1'); } localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 200)));
  const res = [];
  const ok = (cond, name) => { res.push([!!cond, name]); if (!cond || process.env.AGH_V) { console.log((cond ? '  ok: ' : '  HIBA: ') + name); } };
  const THREE_OB = [
    { type: 'workshop', w: 5, d: 4, h: 2.8, roof: 'gable', roof_mat: 'tile', wall: 'brick', door: 'double', windows: 2, items: ['workbench', 'tool_wall', 'shelves'] },
    { type: 'garage', w: 3.4, d: 6, h: 2.6, roof: 'flat', roof_mat: 'bitumen', wall: 'render', door: 'garage', windows: 1, items: ['car', 'shelves'] },
    { type: 'greenhouse', w: 3, d: 2.5, h: 2.2, roof: 'gable', roof_mat: 'metal', wall: 'glass', door: 'sliding', windows: 0, items: ['plants'] }
  ];
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const b = await (await fetch(window.AGH_LOADER.rest.replace(/\/$/, '') + '/bootstrap')).json();
    const cfg = { garden_features: ['lawn', 'paths'], garage: 'none', plot_width: 30, plot_length: 50, terrace_area: 16, outbuildings: [] };
    const ex = {}; Object.keys(cfg).forEach(k => { ex[k] = true; });
    localStorage.setItem('agh_draft_v1', JSON.stringify({ v: b.version, config: Object.assign({}, b.defaults, cfg), explicit: ex, project: null, mode: 'detailed' }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[data-agh-open]');
  await page.waitForSelector('.agh-shell .agh-preview-box.has-3d canvas', { timeout: 90000 });
  await page.waitForTimeout(2500);
  const cfg = () => page.evaluate(() => window.AGH_Designer.config());
  // (1) the editor on the garden tab
  await page.click('.agh-shell [data-cat="garden"]'); await page.waitForTimeout(300);
  ok(await page.$('.agh-field[data-field="outbuildings"] .agh-ob-addbtn'), 'a Melléképületek szerkesztő látszik a Kert lapon');
  await page.click('.agh-field[data-field="outbuildings"] .agh-ob-addbtn[data-type="shed"]'); await page.waitForTimeout(500);
  let c = await cfg();
  ok(c.outbuildings.length === 1 && c.outbuildings[0].type === 'shed', 'pillére koppintva új tároló');
  const wIn = await page.$('.agh-field[data-field="outbuildings"] .agh-ob input[data-k="w"]');
  await wIn.fill('4.2'); await wIn.dispatchEvent('change'); await page.waitForTimeout(400);
  c = await cfg();
  ok(Math.abs(c.outbuildings[0].w - 4.2) < 0.001, 'a szélesség átírható (4,2 m)');
  await page.click('.agh-field[data-field="outbuildings"] .agh-ob-item[data-item="workbench"]'); await page.waitForTimeout(400);
  c = await cfg();
  ok((c.outbuildings[0].items || []).includes('workbench'), 'berendezés választható (munkapad)');
  await page.click('.agh-field[data-field="outbuildings"] .agh-ob-del'); await page.waitForTimeout(400);
  c = await cfg();
  ok(c.outbuildings.length === 0, 'a kuka törli');
  // (2) three on one plot
  const before = await page.evaluate(() => window.AGH_Sketch.render(window.AGH_Designer.config(), { id: 'x' }));
  await page.evaluate((list) => window.AGH_Designer.set({ outbuildings: list }), THREE_OB);
  await page.waitForTimeout(3500);
  const plan = await page.evaluate(() => {
    const K = window.AGH_Sketch, c = window.AGH_Designer.config(), pl = K.plan(c), vols = K._volumes(c, pl), bb = K._siteBox(vols);
    const plot = K._plot(c, vols, bb.x1 + 3.8);
    let front = bb.y1 + 6.5, back = bb.y0 - 6, left = bb.x0 - 6.5, right = bb.x1 + 6;
    if (plot) { left = Math.min(left, plot.x0 - 1.2); right = Math.max(right, plot.x1 + 1.2); front = Math.max(front, plot.yF + 1.2); if (plot.yB !== null) { back = Math.min(back, plot.yB - 1.2); } }
    const ter = c.terrace_area > 0 ? K._terrace(c, vols[0], vols, c.terrace_area) : null;
    const G = K._garden(c, vols, pl, { left, right, front, back }, plot, null, ter, K._siteEdge(c, front, plot));
    const o = G.outs || [], A = G.area; let ov = 0, outside = 0, onHouse = 0;
    for (let i = 0; i < o.length; i++) {
      const p = o[i]; if (p.x0 < A.x0 - 0.01 || p.x1 > A.x1 + 0.01 || p.y0 < A.y0 - 0.01 || p.y1 > A.y1 + 0.01) { outside++; }
      vols.forEach(v => { if (p.x0 < v.x1 && p.x1 > v.x0 && p.y0 < v.y1 && p.y1 > v.y0) { onHouse++; } });
      for (let j = i + 1; j < o.length; j++) { const q = o[j]; if (p.x0 < q.x1 && p.x1 > q.x0 && p.y0 < q.y1 && p.y1 > q.y0) { ov++; } }
    }
    return { n: o.length, ov, outside, onHouse, fail: (G.outFail || []).length, fit: K._siteFit(c).filter(m => m.field === 'outbuildings').length };
  });
  ok(plan.n === 3 && plan.fail === 0 && plan.fit === 0, '3 melléképület elfér (' + JSON.stringify(plan) + ')');
  ok(plan.ov === 0 && plan.outside === 0 && plan.onHouse === 0, 'átfedés 0, telken kívül 0, a házon 0');
  const after = await page.evaluate(() => window.AGH_Sketch.render(window.AGH_Designer.config(), { id: 'x' }));
  ok(after !== before, 'a 2D vázlat rajzolja őket');
  const movers = await page.evaluate(() => (window.AGH_3D.viewer().house.movers ? window.AGH_3D.viewer().house.movers.children : []).map(q => q.userData.slot).filter(s => /^out#/.test(s)));
  ok(movers.length === 3, 'a 3D-ben mind a 3 megfogható (' + movers.join(',') + ')');
  // (3) move one in 3D
  const spot = await page.evaluate(() => {
    const v = window.AGH_3D.viewer(), r = v.el.getBoundingClientRect(), o = v.house.movers.children.find(q => q.userData.slot === 'out#0');
    for (const ps of [[30, 50], [200, 50], [110, 45], [-70, 45], [20, 70]]) {
      v.c._cam = ps; v.fitCamera(true); const t = v.controls.target, d = v.camera.position.clone().sub(t).multiplyScalar(1.6); v.camera.position.copy(t).add(d); v.controls.update(); v.camera.updateMatrixWorld(true);
      for (const hh of [1.4, 2.4, 0.6]) for (const dx of [0, 1, -1]) for (const dz of [0, 1, -1]) {
        const q = o.position.clone(); q.y = hh; q.x += dx; q.z += dz; q.project(v.camera);
        if (Math.abs(q.x) > 0.95 || Math.abs(q.y) > 0.95) { continue; }
        const sx = r.left + (q.x + 1) / 2 * r.width, sy = r.top + (1 - q.y) / 2 * r.height, it = v.extAt(sx, sy);
        if (it && it.type === 'mover' && it.obj === o) { return { x: sx, y: sy, cx: o.position.x, cz: o.position.z }; }
      }
    }
    return null;
  });
  ok(!!spot, 'a műhely megfogható a 3D-ben');
  if (spot) {
    await page.mouse.move(spot.x, spot.y); await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(spot.x - 70 * i / 8, spot.y + 30 * i / 8); await page.waitForTimeout(30); }
    await page.mouse.up(); await page.waitForTimeout(1200);
    const pos = await page.evaluate(() => (window.AGH_Designer.config().site_layout || {})['out#0'] || null);
    ok(!!pos && Math.hypot(pos.x - spot.cx, pos.y - spot.cz) > 0.5, 'az új hely mentve (' + JSON.stringify(pos) + ')');
    await page.reload({ waitUntil: 'networkidle' }); await page.click('[data-agh-open]'); await page.waitForSelector('.agh-shell .agh-preview-box.has-3d canvas', { timeout: 90000 }); await page.waitForTimeout(2500);
    const back = await page.evaluate(() => { const o = window.AGH_3D.viewer().house.movers.children.find(q => q.userData.slot === 'out#0'); return o ? { x: o.position.x, z: o.position.z } : null; });
    ok(back && pos && Math.abs(back.x - pos.x) < 0.05 && Math.abs(back.z - pos.y) < 0.05, 'újratöltés után ott van');
  }
  // (4) too big for the plot
  await page.evaluate(() => window.AGH_Designer.set({ plot_width: 16, plot_length: 26, outbuildings: [{ type: 'barn', w: 12, d: 12, h: 3.5, roof: 'gable', roof_mat: 'tile', wall: 'wood', door: 'double', windows: 2, items: [] }] }));
  await page.waitForTimeout(1500);
  await page.click('.agh-shell [data-cat="garden"]'); await page.waitForTimeout(400);
  const msg = await page.$eval('.agh-field[data-field="outbuildings"]', el => (el.querySelector('.agh-field-msg') || {}).textContent || '').catch(() => '');
  ok(/nem fér el/.test(msg), 'túl nagy melléképület: jelzés a mező alatt');
  ok(!errors.length, 'konzolhiba 0' + (errors.length ? ' ' + JSON.stringify(errors.slice(0, 3)) : ''));
  await browser.close();
  const good = res.filter(r => r[0]).length;
  console.log(`melléképületek: ${good}/${res.length} ellenőrzés ${good === res.length ? 'zöld' : 'HIBA'}`);
  process.exit(good === res.length ? 0 : 1);
})();
