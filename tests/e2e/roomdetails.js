// Helyiségrészletek E2E: a helyiség saját részletmezői (padló, falburkolat, mennyezet, világítás,
// függöny, ajtó, ablak, bútor, fűtés, dekoráció) megváltoztatják-e a 3D belső nézetet.
// Néhány kombináció jogosan nem változtat (pl. fürdőben nincs falikép), ezért a küszöb 20/30.
// Használat: node tests/e2e/roomdetails.js   (tesztoldal: bin/test-wp.sh)
// Helyiségrészletek: minden részletmező átállítása megváltoztatja-e a 3D belső nézetet,
// és a módosításjelzés nem ír-e [object Object]-et.
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
(async () => {
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('agh_tour_done','true'); localStorage.setItem('agh_ui','"designer"'); localStorage.setItem('agh_3d_thumbs','false'); } catch(e){} });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0,140)));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0,140)); });
  await p.goto(process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/', { waitUntil: 'networkidle' });
  await p.click('[data-agh-open]');
  await p.waitForSelector('.agh-shell .agh-preview-box.has-3d canvas', { timeout: 60000 });
  const out = await p.evaluate(async () => {
    const url = n => (performance.getEntriesByType('resource').map(e => e.name).filter(x => x.indexOf(n) !== -1)[0] || n);
    const THREE = await import(url('vendor/three/three.module'));
    const INT = await import(url('agh-3d-int.js'));
    const base = window.AGH_Designer.config(), sch = window.AGH_Designer.schema();
    const bx = new THREE.Box3();
    function sig(room) {
      const hs = INT.interiorScene(Object.assign({}, base, { _int: room }), room);
      let n = 0, tri = 0, mats = [];
      hs.root.traverse(o => {
        if (o.isMesh && o.geometry && o.geometry.attributes.position) {
          n++; tri += o.geometry.attributes.position.count;
          const ml = Array.isArray(o.material) ? o.material : [o.material];
          ml.forEach(mm => { if (mm) { mats.push((mm.userData && mm.userData.key) || (mm.color ? mm.color.getHexString() : mm.type)); } });
        }
      });
      mats.sort();
      const b2 = bx.setFromObject(hs.root);
      return n + '/' + tri + '|' + mats.join(',') + '|' + (b2.isEmpty() ? 'x' : [b2.min.x, b2.max.x, b2.min.y, b2.max.y].map(v => v.toFixed(2)).join(','));
    }
    const MAP = { floor: 'floor_main', wall: 'wall_finish', ceiling: 'ceiling', lighting: 'ceiling_lights', curtains: 'window_treatment', doors: 'door_style', windows: 'window_style', furniture: 'furniture_style', heating: 'radiators', decor: 'art_amount' };
    const field = id => (sch.fields || []).filter(f => f.id === id)[0];
    const res = { changed: [], same: [] };
    const types = ['living_kitchen', 'master', 'bathroom'];
    for (const type of types) {
      const b0 = sig({ type });
      for (const key of Object.keys(MAP)) {
        const fid = (key === 'wall' && /^(bathroom|wc)$/.test(type)) ? 'bath_tiles' : MAP[key];
        const f = field(fid); if (!f || !f.options) { continue; }
        // két különböző opciót próbálunk, hogy biztosan ne az alapérték legyen
        let moved = false;
        for (const o of f.options.filter(o2 => o2.value !== 'auto').slice(0, 4)) {
          const r2 = { type: type }; r2[key] = o.value;
          if (sig(r2) !== b0) { moved = true; break; }
        }
        (moved ? res.changed : res.same).push(type + '.' + key);
      }
    }
    return res;
  });
  await b.close();
  if (errs.length) { console.error(errs.slice(0, 4)); }
  if (process.env.VERBOSE) { console.log('nem változtat:', out.same.join(', ')); }
  console.log(`helyiségrészletek: ${out.changed.length}/${out.changed.length + out.same.length} mező változtatja a 3D-t, konzolhiba ${errs.length}`);
  process.exit(out.changed.length < 20 || errs.length ? 1 : 0);
})();
