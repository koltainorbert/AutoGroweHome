// Kézi elrendezés E2E: a belső nézetben egérrel megfog, elhúz és elforgat tárgyakat, majd
// ellenőrzi, hogy (1) a tárgy valóban elmozdul, (2) a helyiségen belül marad, (3) az elhelyezés
// mentve van, (4) újratöltés után is ott van, (5) a visszaállítás gomb törli a kézi elrendezést.
// Használat: node tests/e2e/layout.js   (tesztoldal: bin/test-wp.sh)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';
const WANT = Number(process.env.AGH_N || 10);

(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // csak az első betöltés töröl: az újratöltésnek meg kell találnia a mentett elrendezést
  await ctx.addInitScript(() => {
    try {
      if (!localStorage.getItem('agh_e2e')) { localStorage.clear(); localStorage.setItem('agh_e2e', '1'); }
      localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false');
    } catch (e) {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 160)));

  const toInterior = async () => {
    await page.waitForSelector('.agh-shell .agh-preview-box.has-3d canvas', { timeout: 60000 });
    await page.waitForTimeout(2200);
    const inInt = await page.$eval('.agh-3d-view button:nth-child(2)', b => b.getAttribute('aria-pressed') === 'true').catch(() => false);
    if (!inInt) { await page.$eval('.agh-3d-view button:nth-child(2)', b => b.click()); }
    await page.waitForSelector('.agh-3d-rooms', { timeout: 30000 });
    await page.waitForTimeout(3000);
  };

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('[data-agh-open]');
  await toInterior();

  // a helyiség tárgyai: slot, középpont a vásznon, hol van a helyiség közepe
  const shot = () => page.evaluate(() => {
    const v = window.AGH_3D.viewer(), hs = v.house, r = v.el.getBoundingClientRect();
    const sx = p => ({ x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height });
    const out = { room: hs.room ? { W: hs.room.W, D: hs.room.D } : null, items: [], rect: { w: r.width, h: r.height, left: r.left, top: r.top } };
    (hs.items ? hs.items.children : []).forEach(o => {
      const c = o.position.clone(); o.getWorldPosition(c);
      const p = sx(c.clone().project(v.camera));
      out.items.push({ slot: o.userData.slot || '', x: o.position.x, z: o.position.z, rot: Math.round(o.rotation.y * 180 / Math.PI), sxx: p.x, sxy: p.y });
    });
    return out;
  });

  // világpont (x,z) → képernyő, hogy a célhely a vásznon legyen
  const project = (x, z) => page.evaluate(([x, z]) => {
    const v = window.AGH_3D.viewer(), hs = v.house, r = v.el.getBoundingClientRect();
    const p = new hs.items.children[0].position.constructor(x, 0.02, z);
    if (hs.items.parent) { hs.items.updateMatrixWorld(true); p.applyMatrix4(hs.items.matrixWorld); }
    p.project(v.camera);
    return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height };
  }, [x, z]);

  // melyik tárgy hol fogható meg a vásznon: a vászon rácspontjain a valódi találatot kérdezzük meg,
  // így a fogópont biztosan a tárgy testén van (nem a – néha a testen kívüli – origóján)
  const aim = () => page.evaluate(() => {
    const v = window.AGH_3D.viewer(), r = v.el.getBoundingClientRect(), out = {};
    for (let iy = 2; iy < 34; iy++) {
      for (let ix = 2; ix < 50; ix++) {
        const x = r.left + (r.width * ix) / 52, y = r.top + (r.height * iy) / 36;
        const it = v.itemAt(x, y);
        if (it && !out[it.obj.userData.slot]) { out[it.obj.userData.slot] = { x: x, y: y }; }
      }
    }
    return out;
  });

  const first = await shot();
  if (!first.room) { console.log('kézi elrendezés: nincs helyiség a 3D-ben'); await browser.close(); process.exit(1); }
  const W = first.room.W, D = first.room.D;

  const moved = [], failed = [];
  let hidden = 0;   // amit a közben odahúzott bútorok eltakartak: azt a kamera sem látja, fogni sem kell
  const cand = Object.keys(await aim());
  for (let i = 0; i < cand.length && moved.length < WANT; i++) {
    const slot = cand[i];
    // a fogópont minden mozgatás után újraszámolva (a tárgy közben elkerült)
    const now = (await aim())[slot];
    if (!now) { hidden++; continue; }
    await page.mouse.move(now.x, now.y);
    await page.mouse.down();
    // a fogás a vászon pontján a legfelső tárgyat fogja meg: azt mérjük, amit valóban megfogott
    const got = await page.evaluate(() => { const d = window.AGH_3D.viewer().drag; return d ? { slot: d.slot, x: d.obj.position.x, z: d.obj.position.z } : null; });
    if (!got) { await page.mouse.up(); failed.push(slot + '(nem fogható)'); continue; }   // a test pontján van, mégsem fogható: ez hiba
    const grabbed = got.slot;
    if (moved.some(q => q.slot === grabbed)) { await page.mouse.up(); await page.waitForTimeout(120); continue; }
    // cél: a helyiség egy másik pontja (a négy negyed közül a legtávolabbi)
    const tx = got.x < W / 2 ? W * 0.72 : W * 0.28, tz = got.z < D / 2 ? D * 0.72 : D * 0.28;
    const tp = await project(tx, tz);
    await page.mouse.move(tp.x, tp.y, { steps: 6 });
    await page.mouse.wheel(0, 120);              // forgatás: 15 fokos lépés
    await page.waitForTimeout(60);
    await page.mouse.up();
    await page.waitForTimeout(260);
    const after = await page.evaluate(g => {
      const v = window.AGH_3D.viewer(), o = v.house.items.children.filter(q => q.userData.slot === g)[0];
      const cfg = window.AGH_Designer.config ? window.AGH_Designer.config() : null;
      const lay = cfg && cfg.room_layout ? cfg.room_layout : {};
      const rid = Object.keys(lay)[0] || '';
      return { x: o ? o.position.x : null, z: o ? o.position.z : null, rot: o ? Math.round(o.rotation.y * 180 / Math.PI) : null, saved: rid ? lay[rid][g] || null : null, rooms: Object.keys(lay).length };
    }, grabbed);
    const d = Math.abs(after.x - got.x) + Math.abs(after.z - got.z);
    if (after.saved && d > 0.08 && after.rot % 15 === 0) { moved.push({ slot: grabbed, d: Math.round(d * 100) / 100, rot: after.rot, x: after.x, z: after.z }); }
    else { failed.push(grabbed + (after.saved ? '(d=' + d.toFixed(2) + ',rot=' + after.rot + ')' : '(nincs mentve)')); }
  }

  // minden tárgy a helyiségen belül maradt?
  const outside = (await shot()).items.filter(q => q.x < -0.05 || q.x > W + 0.05 || q.z < -0.05 || q.z > D + 0.05).length;

  // újratöltés: a mentett helyek visszajönnek
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('[data-agh-open]');
  await toInterior();
  const back = await shot();
  let kept = 0;
  moved.forEach(mv => {
    const q = back.items.filter(z => z.slot === mv.slot)[0];
    if (q && Math.abs(q.x - mv.x) < 0.12 && Math.abs(q.z - mv.z) < 0.12 && ((q.rot - mv.rot + 360) % 360) < 1) { kept++; }
  });

  // visszaállítás gomb: a kézi elrendezés törlődik erre a helyiségre
  let resetOk = false;
  const btns = await page.$$('.agh-3d-lay .agh-3d-laybtn');
  if (btns.length >= 2) {
    await btns[1].click();
    await page.waitForTimeout(2500);
    resetOk = await page.evaluate(() => {
      const c = window.AGH_Designer.config ? window.AGH_Designer.config() : null;
      const lay = c && c.room_layout ? c.room_layout : {};
      return Object.keys(lay).every(k => !Object.keys(lay[k]).length);
    });
  }

  await browser.close();
  if (errors.length) { console.error(errors.slice(0, 4)); }
  const ok = moved.length >= Math.min(WANT, 6) && !failed.length && !outside && kept === moved.length && resetOk && !errors.length;
  console.log(`kézi elrendezés: ${first.items.length} tárgyból ${cand.length} fogható, ${moved.length} mozgatva+forgatva, kilóg ${outside}, újratöltés után megmaradt ${kept}/${moved.length}, visszaállítás ${resetOk ? 'ok' : 'nem'}, közben eltakarva ${hidden}, hiba ${failed.length}${failed.length ? ' (' + failed.slice(0, 4).join(', ') + ')' : ''}, konzolhiba ${errors.length}`);
  process.exit(ok ? 0 : 1);
})();
