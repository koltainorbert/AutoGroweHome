// Mozgatás E2E (1.18.0): a 3D tervezőben kívül megfog, elhúz és elforgat kerti tárgyakat, járművet,
// embert, állatot, fát, ablakot, ajtót és a kéményt, és ellenőrzi:
//  (1) a tárgy elmozdul, és a hely a `site_layout`-ba kerül (a projekt piszkozatába);
//  (2) Ctrl + húzás forgat, Shift egyenesbe áll (0/90/180/270°), R forgat, nyíl mozgat, Esc visszatesz;
//  (3) a házra húzott tárgy piros jelölést kap (az okkal), a jó hely zöldet;
//  (4) az ablak a saját falán, a kémény a tetőn mozog, elengedéskor a ház újraépül az új helyen;
//  (5) Ctrl+Z visszavon, újratöltés után minden ott van, a visszaállítás gomb törli a kézi elrendezést;
//  (6) a közös terv (2D vázlat) ugyanazt a helyet kapja; konzolhiba 0.
// Használat: node tests/e2e/move.js   (tesztoldal: bin/test-wp.sh)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';

(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    try {
      if (!localStorage.getItem('agh_e2e_move')) { localStorage.clear(); localStorage.setItem('agh_e2e_move', '1'); }
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
  // a ház minden mozgatható fajtával: medence, tároló, pergola, tűzrakó, kerti bútor, lámpák, fák, autó, család, kutya, macska, kémény
  await page.evaluate(async () => {
    const b = await (await fetch(window.AGH_LOADER.rest.replace(/\/$/, '') + '/bootstrap')).json();
    const cfg = { garden_features: ['lawn', 'trees', 'paths', 'garden_lights', 'pool', 'pergola', 'firepit', 'shed', 'garden_furniture'], chimney: true, vehicles: ['sedan'], people: 'family', pets: ['dog_large', 'cat'], garage: 'none', terrace_area: 0, plot_width: 32, plot_length: 44, levels: 'two', roof_type: 'gable', arch_style: 'modern_family' };
    const ex = {}; Object.keys(cfg).forEach(k => { ex[k] = true; });
    localStorage.setItem('agh_draft_v1', JSON.stringify({ v: b.version, config: Object.assign({}, b.defaults, cfg), explicit: ex, project: null, mode: 'detailed' }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[data-agh-open]');
  await page.waitForSelector('.agh-shell .agh-preview-box.has-3d canvas', { timeout: 90000 });
  await page.waitForTimeout(3500);

  // a high three-quarter view from further away: the whole garden is on the screen
  const overview = (cam) => page.evaluate((cam) => {
    const v = window.AGH_3D.viewer();
    v.c._cam = cam || [24, 52]; v.fitCamera(true);
    const t = v.controls.target, d = v.camera.position.clone().sub(t).multiplyScalar(1.7);
    v.camera.position.copy(t).add(d); v.controls.update(); v.requestRender();
  }, cam);
  const POSES = [[24, 52], [200, 55], [110, 48], [-70, 48], [10, 16], [40, 70]];
  await overview(); await page.waitForTimeout(800);
  const draft = () => page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('agh_draft_v1')) || {}).config.site_layout || {}; } catch (e) { return {}; } });
  // a tárgy (mozgatható csoport) egy látható, megfogható pontja a képernyőn
  const spot = (slot) => page.evaluate((slot) => {
    const v = window.AGH_3D.viewer(), r = v.el.getBoundingClientRect();
    const o = v.house.movers && v.house.movers.children.find(q => q.userData.slot === slot);
    if (!o) { return null; }
    o.updateMatrixWorld(true);
    const P = o.position.clone(), H = [0.15, 0.4, 0.8, 1.2, 0.05];
    for (const hh of H) for (const dx of [0, 0.3, -0.3]) for (const dz of [0, 0.3, -0.3]) {
      const q = P.clone(); q.x += dx; q.z += dz; q.y = hh; q.project(v.camera);
      if (Math.abs(q.x) > 0.95 || Math.abs(q.y) > 0.95) { continue; }
      const sx = r.left + (q.x + 1) / 2 * r.width, sy = r.top + (1 - q.y) / 2 * r.height;
      const it = v.extAt(sx, sy);
      if (it && it.type === 'mover' && it.obj === o) { return { x: sx, y: sy }; }
    }
    return null;
  }, slot);
  const opSpot = (key) => page.evaluate((key) => {
    const v = window.AGH_3D.viewer(), r = v.el.getBoundingClientRect();
    const e = (v.ops || []).find(q => q.op.key === key);
    if (!e) { return null; }
    const c = e.box.getCenter(e.box.min.clone());
    for (const f of [[0, 0], [0.2, 0], [-0.2, 0], [0, 0.2], [0, -0.2]]) {
      const q = c.clone(); q.x += f[0]; q.y += f[1]; q.project(v.camera);
      const sx = r.left + (q.x + 1) / 2 * r.width, sy = r.top + (1 - q.y) / 2 * r.height;
      const it = v.extAt(sx, sy);
      if (it && it.type === 'op' && it.op.key === key) { return { x: sx, y: sy }; }
    }
    return null;
  }, key);
  // try the camera poses until the piece shows (behind the house from one side, in view from another)
  const find = async (fn, key) => {
    for (const ps of POSES) { await overview(ps); await page.waitForTimeout(150); const p = await fn(key); if (p) { return p; } }
    return null;
  };
  const pose = (slot) => page.evaluate((slot) => {
    const v = window.AGH_3D.viewer(), o = v.house.movers && v.house.movers.children.find(q => q.userData.slot === slot);
    return o ? { x: o.position.x, z: o.position.z, rot: Math.round(((o.rotation.y * 180 / Math.PI) % 360 + 360) % 360) } : null;
  }, slot);
  const drag = async (p, dx, dy, mods) => {
    for (const m of mods || []) { await page.keyboard.down(m); }
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    for (let i = 1; i <= 6; i++) { await page.mouse.move(p.x + dx * i / 6, p.y + dy * i / 6); await page.waitForTimeout(30); }
    await page.mouse.up();
    for (const m of mods || []) { await page.keyboard.up(m); }
    await page.waitForTimeout(350);
  };

  // which pieces can be grabbed
  const list = await page.evaluate(() => {
    const v = window.AGH_3D.viewer();
    return { movers: (v.house.movers ? v.house.movers.children : []).map(q => ({ slot: q.userData.slot, kind: (q.userData.move || {}).kind })), ops: (v.ops || []).map(q => q.op.key) };
  });
  const kinds = {};
  list.movers.forEach(m => { kinds[m.kind] = kinds[m.kind] || m.slot; });
  ok(['pool', 'structure', 'tree', 'vehicle', 'person', 'pet', 'light', 'furniture'].every(k => kinds[k]), 'minden fajtából van megfogható tárgy (' + Object.keys(kinds).join(',') + ')');
  ok(list.ops.includes('chimney') && list.ops.some(k => k.indexOf('win@') === 0) && list.ops.includes('door@0'), 'ablak, ajtó, kémény megfogható (' + list.ops.length + ' nyílás)');

  // an automatic place is a good place: green while held (Esc: back where it was)
  const gp = await find(spot, 'pool');
  await page.mouse.move(gp.x, gp.y); await page.mouse.down(); await page.mouse.move(gp.x + 2, gp.y + 1, { steps: 2 });
  const green = await page.evaluate(() => { const e = document.querySelector('.agh-3d-place'); return e ? e.className + ' ' + e.textContent : ''; });
  await page.keyboard.press('Escape'); await page.mouse.up(); await page.waitForTimeout(300); await page.keyboard.press('Escape');
  ok(/is-ok/.test(green), 'automatikus helyen zöld (' + green.replace(/^\S+ \S+ /, '') + ')');
  // (1) move every kind once (to a free spot of the lawn: 70 px to the left / right)
  let moved = 0, saved = 0;
  for (const k of Object.keys(kinds)) {
    const slot = kinds[k], p = await find(spot, slot);
    if (!p) { console.log('  nem látszik: ' + slot); continue; }
    const a = await pose(slot);
    await drag(p, k === 'pool' ? -40 : 50, 12);
    const b = await pose(slot), d = await draft();
    if (Math.hypot(b.x - a.x, b.z - a.z) > 0.2) { moved++; }
    if (d[slot] && Math.abs(d[slot].x - b.x) < 0.01 && Math.abs(d[slot].y - b.z) < 0.01) { saved++; }
  }
  ok(moved === Object.keys(kinds).length, `mozgatás: ${moved}/${Object.keys(kinds).length} fajta elmozdult`);
  ok(saved === Object.keys(kinds).length, `mentés: ${saved}/${Object.keys(kinds).length} hely a site_layout-ban`);
  // the shared plan (the 2D sketch reads the same) has the pool where the 3D shows it
  const plan = await page.evaluate(() => { const v = window.AGH_3D.viewer(), o = v.house.movers.children.find(q => q.userData.slot === 'pool'); const G = window.AGH_Sketch._garden ? v.house.gardenPlan : null; const K = window.AGH_Sketch, c = Object.assign({}, v.c); const s = K._site(c, 'pool') || { x: NaN, y: NaN }; return { x: o.position.x, z: o.position.z, sx: s.x, sy: s.y, g: !!G }; });
  ok(Math.abs(plan.x - plan.sx) < 0.01 && Math.abs(plan.z - plan.sy) < 0.01, '2D közös terv = 3D hely (medence)');

  // (2) turn: Ctrl + drag, then Shift → straight, R, arrows, Esc
  const car = kinds.vehicle, c0 = await pose(car);
  let pc = await find(spot, car);
  await drag(pc, 80, 0, ['Control']);
  const c1 = await pose(car);
  ok(Math.abs(c1.rot - c0.rot) > 20 && Math.hypot(c1.x - c0.x, c1.z - c0.z) < 0.05, `Ctrl + húzás forgat (${c0.rot}° → ${c1.rot}°), nem mozdít`);
  pc = await spot(car);
  await drag(pc, 10, 4, ['Shift']);
  const c2 = await pose(car);
  ok(c2.rot % 90 === 0, `Shift: egyenesbe (${c2.rot}°)`);
  await page.keyboard.press('r'); await page.waitForTimeout(200);
  const c3 = await pose(car);
  ok((c3.rot - c2.rot + 360) % 360 === 15, `R: +15° (${c2.rot}° → ${c3.rot}°)`);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(200);
  const c4 = await pose(car);
  ok(Math.abs(Math.hypot(c4.x - c3.x, c4.z - c3.z) - 0.1) < 0.01, 'nyíl: 10 cm');
  const sel = await page.evaluate(() => { const e = document.querySelector('.agh-3d-place'); return e ? e.className : ''; });
  ok(/is-ok|is-bad/.test(sel), 'kijelölés jelzése látszik');
  // Esc during a drag puts the piece back
  pc = await spot(car);
  await page.mouse.move(pc.x, pc.y); await page.mouse.down(); await page.mouse.move(pc.x + 60, pc.y + 10, { steps: 4 });
  await page.keyboard.press('Escape'); await page.mouse.up(); await page.waitForTimeout(300);
  const c5 = await pose(car);
  ok(Math.hypot(c5.x - c4.x, c5.z - c4.z) < 0.01, 'Esc húzás közben: visszaugrik');
  await page.keyboard.press('Escape');

  // (3) onto the house: red, with the reason; Ctrl+Z takes it back
  const pool = 'pool', pp = await find(spot, pool), before = (await draft())[pool];
  const hp = await page.evaluate(() => { const v = window.AGH_3D.viewer(), r = v.el.getBoundingClientRect(), q = v.house.vols[0], P = v.camera.position.clone(); const t = P.set((q.x0 + q.x1) / 2, 0, (q.y0 + q.y1) / 2).project(v.camera); return { x: r.left + (t.x + 1) / 2 * r.width, y: r.top + (1 - t.y) / 2 * r.height }; });
  await page.mouse.move(pp.x, pp.y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(pp.x + (hp.x - pp.x) * i / 8, pp.y + (hp.y - pp.y) * i / 8); await page.waitForTimeout(30); }
  const red = await page.evaluate(() => { const e = document.querySelector('.agh-3d-place'); const v = window.AGH_3D.viewer(); return { cls: e ? e.className : '', txt: e ? e.textContent : '', mark: !!(v.mark && v.mark.visible), col: v.markFill ? '#' + v.markFill.color.getHexString() : '' }; });
  await page.mouse.up(); await page.waitForTimeout(300);
  ok(/is-bad/.test(red.cls) && red.mark && red.col.toLowerCase() === '#e0483e', `a házra húzva piros: „${red.txt}”`);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(2500);
  const after = (await draft())[pool];
  ok(after && before && Math.abs(after.x - before.x) < 0.01 && Math.abs(after.y - before.y) < 0.01, 'Ctrl+Z: a medence visszakerül');

  // (4) a window slides along its own wall, the chimney over the roof; the house is rebuilt
  const winKey = list.ops.find(k => /^win@0:front:/.test(k)) || list.ops.find(k => k.indexOf('win@') === 0);
  for (const key of [winKey, 'door@0', 'chimney']) {
    const s0 = await find(opSpot, key);
    if (!s0) { ok(false, 'nem látszik: ' + key); continue; }
    const x0 = await page.evaluate((key) => { const e = window.AGH_3D.viewer().ops.find(q => q.op.key === key); return e.op.x; }, key);
    await drag(s0, key === 'chimney' ? -45 : 40, key === 'chimney' ? 10 : 0);
    await page.waitForTimeout(3000);
    const r1 = await page.evaluate((key) => { const v = window.AGH_3D.viewer(), e = (v.ops || []).find(q => q.op.key === key); return e ? { x: e.op.x, w: e.op.w || 0, sel: v.sel && v.sel.slot } : null; }, key);
    const d = (await draft())[key];
    ok(r1 && d && Math.abs(r1.x - x0) > 0.15 && Math.abs((key === 'chimney' ? r1.x + r1.w / 2 : r1.x) - d.x) < 0.01, `${key}: ${x0.toFixed(2)} → ${r1 ? r1.x.toFixed(2) : '–'} m, mentve, újraépítve${r1 && r1.sel === key ? ', kijelölve marad' : ''}`);
    await page.keyboard.press('Escape');
  }

  // (5) reload: everything where it was put; then reset
  const keep = await draft();
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[data-agh-open]');
  await page.waitForSelector('.agh-shell .agh-preview-box.has-3d canvas', { timeout: 90000 });
  await page.waitForTimeout(3500);
  await overview(); await page.waitForTimeout(800);
  const back = await page.evaluate((keep) => {
    const v = window.AGH_3D.viewer(); let n = 0, good = 0;
    (v.house.movers ? v.house.movers.children : []).forEach(q => { const k = keep[q.userData.slot]; if (!k) { return; } n++; if (Math.abs(q.position.x - k.x) < 0.02 && Math.abs(q.position.z - k.y) < 0.02) { good++; } });
    const w = Object.keys(keep).filter(k => k.indexOf('win@') === 0 || k.indexOf('door@') === 0 || k === 'chimney');
    let wg = 0; w.forEach(k => { const e = (v.ops || []).find(q => q.op.key === k); if (e && (k === 'chimney' ? Math.abs(e.op.x + e.op.w / 2 - keep[k].x) < 0.02 : Math.abs(e.op.x - keep[k].x) < 0.02)) { wg++; } });
    return { n: n, good: good, w: w.length, wg: wg };
  }, keep);
  ok(back.n > 0 && back.good === back.n && back.wg === back.w, `újratöltés után: ${back.good}/${back.n} tárgy, ${back.wg}/${back.w} nyílás/kémény a helyén`);
  const rb = await page.$('.agh-3d-sitereset');
  ok(!!rb, 'visszaállítás gomb látszik');
  if (rb) { await rb.click(); await page.waitForTimeout(2500); }
  const empty = await draft();
  ok(!Object.keys(empty).length, 'visszaállítás után a site_layout üres');

  await browser.close();
  if (errors.length) { console.error(errors.slice(0, 5)); }
  ok(!errors.length, 'konzolhiba 0');
  const pass = res.filter(r => r[0]).length;
  console.log(`mozgatás: ${pass}/${res.length} ellenőrzés zöld` + (errors.length ? `, konzolhiba ${errors.length}` : ''));
  process.exit(pass === res.length ? 0 : 1);
})();
