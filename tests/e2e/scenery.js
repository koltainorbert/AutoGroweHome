// Háttér-tárgyak, fák, fű és minőségi szintek E2E (1.26.0), a tesztoldalon (bin/test-wp.sh):
//  (1) szintenként (low/medium/high/ultra) kiírva: a fű (InstancedMesh) száma és háromszögei, a fák (közeli /
//      közepes / távoli részletesség) háromszögei, a környék tárgyai, a teljes jelenet háromszöge és egy kép
//      rajzhívásai; low szinten nincs fű; a fű egyetlen rajzhívás; a fű nem nő burkolatra, házra;
//  (2) a kert fái új formában (ágak + lombcsomók, örvös fenyő, több csomós bokor), konzolhiba nélkül;
//  (3) az utca tárgyai: kandeláber, pad, szemetes (város), oszlopsor + vezeték, terelőoszlop (vidék), postaláda;
//  (4) a minőségi szint: a látogató választása megmarad (localStorage), az automatikus váltás lassú képkockákra
//      lép le, gyorsakra (kétszer) fel, a frissen elhagyott szintre nem ugrik vissza azonnal (hiszterézis);
//  (5) a „quality profile” objektum olvasható (AGH_3D.quality.profile()), a `post` kulcs megvan; konzolhiba 0.
// Használat: node tests/e2e/scenery.js   (AGH_URL=http://127.0.0.1:<port>/tervezo/)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';

(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('agh_e2e_scenery')) { localStorage.clear(); localStorage.setItem('agh_e2e_scenery', '1'); } localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 200)));
  const res = [];
  const ok = (cond, name) => { res.push([!!cond, name]); if (!cond || process.env.AGH_V) { console.log((cond ? '  ok: ' : '  HIBA: ') + name); } };
  await page.goto(URL, { waitUntil: 'networkidle' });
  const cfg = { landscape: 'suburb', neighbors: true, garden_features: ['lawn', 'trees', 'paths', 'garden_lights'], tree_types: ['deciduous', 'conifer', 'birch', 'fruit'], plot_width: 30, plot_length: 45, season: 'summer' };
  await page.evaluate(async (cfg) => {
    const b = await (await fetch(window.AGH_LOADER.rest.replace(/\/$/, '') + '/bootstrap')).json();
    const ex = {}; Object.keys(cfg).forEach(k => { ex[k] = true; });
    localStorage.setItem('agh_draft_v1', JSON.stringify({ v: b.version, config: Object.assign({}, b.defaults, cfg), explicit: ex, project: null, mode: 'detailed' }));
  }, cfg);
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[data-agh-open]');
  await page.waitForSelector('.agh-preview-box.has-3d canvas', { timeout: 120000 });
  await page.waitForTimeout(3000);
  const prof = await page.evaluate(() => { const Q = window.AGH_3D.quality; return { p: Q.profile(), levels: Q.levels, menu: !!document.querySelector('.agh-3d-quality'), opts: Array.from(document.querySelectorAll('.agh-3d-quality option')).map(o => o.value) }; });
  ok(prof.p && prof.p.level && prof.p.post && typeof prof.p.post === 'object' && prof.levels.join() === 'low,medium,high,ultra', 'quality profile olvasható (' + prof.p.level + ', post kulcs megvan)');
  ok(prof.menu && prof.opts.join() === 'auto,low,medium,high,ultra', 'minőségválasztó a 3D nézetben (automatikus + 4 szint)');

  // (1) per level
  const per = {};
  for (const l of ['low', 'medium', 'high', 'ultra']) {
    per[l] = await page.evaluate(async (l) => {
      const A = window.AGH_3D, v = A.viewer();
      A.quality.set(l);
      await new Promise(r => setTimeout(r, 1500));
      const tri = (o) => { const g = o.geometry; return (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); };
      const out = { grass: v.grassInfo, trees: { near: 0, mid: 0, xfar: 0 }, treeCalls: 0, scene: 0, garden: 0 };
      v.treeline.traverse(o => { if (o.isMesh) { const lod = o.userData.lod || 'near'; out.trees[lod in out.trees ? lod : 'near'] += tri(o); out.treeCalls++; } });
      v.scene.traverse(o => { if (o.isMesh && o.visible) { out.scene += tri(o); } });
      // the trees of the garden (movable pieces with kind tree/plant)
      if (v.house.movers) { v.house.movers.children.forEach(m => { const k = (m.userData.move || {}).kind; if (k === 'tree' || k === 'plant') { m.traverse(o => { if (o.isMesh) { out.garden += tri(o); } }); } }); }
      const info = v.renderer.info; v.render(); info.autoReset = false; info.reset(); v.render(); out.calls = info.render.calls; out.frameTris = info.render.triangles; info.autoReset = true;
      out.dpr = v.renderer.getPixelRatio(); out.shadow = v.sun.shadow.mapSize.x; out.ao = !!(v.gtao && v.gtaoOn);
      // grass on paved or built ground: sample the instances against the house and the paved surfaces
      let bad = 0;
      if (v.grass) {
        const T3 = A.helpers().THREE, G = v.house.gardenPlan, m4 = new T3.Matrix4(), p = new T3.Vector3();
        const rects = [G.path, G.drive].filter(Boolean).map(r => [r.x0 + 0.1, r.y0 + 0.1, r.x1 - 0.1, r.y1 - 0.1]);
        (v.house.vols || []).forEach(q => rects.push([q.x0 + 0.1, q.y0 + 0.1, q.x1 - 0.1, q.y1 - 0.1]));
        for (let i = 0; i < v.grass.count; i += 3) { v.grass.getMatrixAt(i, m4); p.setFromMatrixPosition(m4); if (rects.some(r => p.x > r[0] && p.x < r[2] && p.z > r[1] && p.z < r[3])) { bad++; } }
      }
      out.grassBad = bad;
      return out;
    }, l);
    const r = per[l];
    console.log(`  ${l}: fű ${r.grass.count} csomó / ${r.grass.tris} háromszög · fák közel ${Math.round(r.trees.near)} · közép ${Math.round(r.trees.mid)} · távol ${Math.round(r.trees.xfar)} háromszög (${r.treeCalls} háló) · kerti fák ${Math.round(r.garden)} · jelenet ${Math.round(r.scene)} · kép ${r.calls} rajzhívás, ${r.frameTris} háromszög · pixelarány ${r.dpr} · árnyék ${r.shadow} · AO ${r.ao ? 'be' : 'ki'}`);
  }
  ok(per.low.grass.count === 0 && per.medium.grass.count > 0 && per.high.grass.count > per.medium.grass.count && per.ultra.grass.count >= per.high.grass.count, 'fű szintenként: low 0, medium ' + per.medium.grass.count + ', high ' + per.high.grass.count + ', ultra ' + per.ultra.grass.count + ' csomó');
  // low/medium draw without the effect composer, high/ultra with ambient occlusion (its own depth/normal pass):
  // the grass is compared within the same path – low → medium, and high → ultra (fewer or more blades only)
  ok(per.medium.calls - per.low.calls <= 2 && Math.abs(per.ultra.calls - per.high.calls) <= 1, 'a fű egyetlen rajzhívás (low ' + per.low.calls + ' → medium ' + per.medium.calls + '; high ' + per.high.calls + ' → ultra ' + per.ultra.calls + ')');
  ok(['medium', 'high', 'ultra'].every(l => per[l].grassBad === 0), 'fű nem nő a házra, a járdára, a kocsibeállóra');
  ok(per.low.shadow < per.high.shadow && !per.low.ao && per.high.ao && per.low.dpr <= per.high.dpr, 'szintenként más árnyéktérkép / AO / pixelarány (low ' + per.low.shadow + ', high ' + per.high.shadow + ')');
  ok(per.ultra.trees.near >= per.low.trees.near && per.high.trees.near > 0 && per.high.trees.mid > 0, 'fák három részletességgel (közel / közép / távol), a közeli sáv szintenként nő');
  ok(per.high.treeCalls <= 40, 'a távoli fák fajonként egy rajzhívás (' + per.high.treeCalls + ' háló a fasorban)');

  // (2) garden trees: branches and clumps (one tree of each kind, built on its own)
  const kinds = await page.evaluate(() => {
    const H = window.AGH_3D.helpers(), c = window.AGH_Designer.config(), out = {};
    ['deciduous', 'fruit', 'olive', 'multistem', 'conifer', 'cypress', 'shrub', 'birch', 'maple'].forEach(k => {
      const hs = new H.House(c, { mini: true }); hs.plant(k, 0, 0, k === 'shrub' ? 1.4 : 7, 3);
      let meshes = 0, tri = 0; hs.root.traverse(o => { if (o.isMesh) { meshes++; const g = o.geometry; tri += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
      out[k] = { meshes, tri: Math.round(tri) };
    });
    return out;
  });
  console.log('  kerti fák (részek / háromszög): ' + Object.keys(kinds).map(k => k + ' ' + kinds[k].meshes + '/' + kinds[k].tri).join(', '));
  ok(kinds.deciduous.meshes >= 20 && kinds.conifer.meshes >= 5 && kinds.shrub.meshes >= 4, 'lombos fa ágakkal és lombcsomókkal (' + kinds.deciduous.meshes + ' rész), örvös fenyő (' + kinds.conifer.meshes + '), több csomós bokor (' + kinds.shrub.meshes + ')');

  // (3) street furniture: urban street and country lane
  const street = {};
  for (const ls of ['town', 'plain']) {
    street[ls] = await page.evaluate(async (ls) => {
      window.AGH_Designer.set({ landscape: ls });
      await new Promise(r => setTimeout(r, 2500));
      const v = window.AGH_3D.viewer(), mats = {};
      v.house.root.traverse(o => { if (o.isMesh) { const k = o.material && o.material.userData && o.material.userData.key; if (k) { mats[k] = (mats[k] || 0) + 1; } } });
      const keys = Object.keys(mats).join(' ');
      return { bench: /sbenchwood|benchwood/.test(keys), bin: /streetbin/.test(keys), mailbox: /mailbox/.test(keys), poles: /polewood/.test(keys), wire: /polewire/.test(keys), refl: /refpost/.test(keys) };
    }, ls);
  }
  ok(street.town.bench && street.town.bin && street.town.mailbox, 'városi utca: pad, szemetes, postaláda');
  ok(street.plain.poles && street.plain.wire && street.plain.refl && street.plain.mailbox, 'vidéki út: villanyoszlopok vezetékkel, terelőoszlopok, postaláda');

  // (4) quality choice and automatic switching (the frame times are fed in)
  const auto = await page.evaluate(async () => {
    const Q = window.AGH_3D.quality, out = {};
    Q.set('medium'); out.kept = localStorage.getItem('agh_3d_quality');
    // the first-start measurement must not interfere with the fed frame times
    Q._skipProbe(); localStorage.setItem('agh_3d_qtest', '1');
    Q.set('auto'); await new Promise(r => setTimeout(r, 50));
    // a fresh start of the switching (the cool-down after a level change is 3 s): pretend it is over
    const st = () => Q.get().level, feed = (ms, n) => { for (let i = 0; i < n; i++) { Q._frame(ms); } };
    const wait = () => new Promise(r => setTimeout(r, 3100));
    Q.set('medium'); Q.set('auto'); await wait();
    out.start = st();
    feed(10, 30); out.afterOneFast = st();
    feed(10, 30); out.afterTwoFast = st();
    await wait(); feed(80, 30); out.afterSlow = st();
    await wait(); feed(10, 60); out.noBounce = st();
    localStorage.removeItem('agh_3d_qtest');
    return out;
  });
  ok(auto.kept === '"medium"', 'a látogató választása megmarad a böngészőben (' + auto.kept + ')');
  ok(auto.start === 'medium' && auto.afterOneFast === 'medium' && auto.afterTwoFast === 'high', 'gyors képkockák (10 ms): egy ablak után marad (' + auto.afterOneFast + '), kettő után fel (' + auto.afterTwoFast + ')');
  ok(auto.afterSlow === 'medium', 'lassú képkockák (80 ms): high → ' + auto.afterSlow);
  ok(auto.noBounce === 'medium', 'hiszterézis: a most elhagyott szintre fél percig nem lép vissza (' + auto.noBounce + ')');
  await page.evaluate(() => { window.AGH_3D.quality.set('auto'); });
  ok(!errors.length, 'konzolhiba 0' + (errors.length ? ' ' + JSON.stringify(errors.slice(0, 3)) : ''));
  await browser.close();
  const good = res.filter(r => r[0]).length;
  console.log(`háttér, fák, fű, minőség: ${good}/${res.length} ellenőrzés ${good === res.length ? 'zöld' : 'HIBA'}`);
  process.exit(good === res.length ? 0 : 1);
})();
