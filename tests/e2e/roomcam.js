// Belső nézet mérése: mennyire tölti ki a szoba a képet, kilóg-e tárgy a képből, van-e konzolhiba.
// A kamera a szoba dobozát keretezi (Viewer.fitFrame), a mérés ugyanazt a dobozt vetíti vissza.
// Használat: node tests/e2e/roomcam.js [darab]   (tesztoldal: bin/test-wp.sh)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';
const N = Number(process.argv[2] || 13);

(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {} });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 140)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('[data-agh-open]');
  await page.waitForSelector('.agh-shell .agh-preview-box.has-3d canvas', { timeout: 60000 });

  const res = await page.evaluate(async (count) => {
    const url = n => (performance.getEntriesByType('resource').map(e => e.name).filter(x => x.indexOf(n) !== -1)[0] || n);
    const THREE = await import(url('vendor/three/three.module'));
    const v = window.AGH_3D.viewer(), base = window.AGH_Designer.config();
    const TYPES = ['living', 'living_kitchen', 'dining', 'kitchen', 'master', 'bedroom', 'kids', 'office', 'bathroom', 'wc', 'hall', 'laundry', 'attic'];
    const out = [];
    for (let i = 0; i < count; i++) {
      const t = TYPES[i % TYPES.length];
      v.camKey = '';
      v.update(Object.assign({}, base, { ceiling_height: 2.5 + (i % 4) * 0.15, _int: { type: t } }), 'interior');
      const r = v.house.room;
      if (!r || !r.W) { continue; }
      v.camera.updateMatrixWorld(true);
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      for (let k = 0; k < 8; k++) {
        const n = new THREE.Vector3(k & 1 ? r.W : 0, k & 2 ? r.H : 0, k & 4 ? r.D : 0).project(v.camera);
        x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y);
      }
      const fx = Math.min(1, (Math.min(x1, 1) - Math.max(x0, -1)) / 2), fy = Math.min(1, (Math.min(y1, 1) - Math.max(y0, -1)) / 2);
      const bx = new THREE.Box3();
      let clipped = 0, items = 0;
      (v.house.items ? v.house.items.children : []).forEach(o => {
        const bb = bx.setFromObject(o);
        if (bb.isEmpty() || bb.max.y < 0.06) { return; }
        items++;
        let inside = 0;
        for (let k = 0; k < 8; k++) {
          const q = new THREE.Vector3(k & 1 ? bb.max.x : bb.min.x, k & 2 ? bb.max.y : bb.min.y, k & 4 ? bb.max.z : bb.min.z).project(v.camera);
          if (Math.abs(q.x) <= 1.02 && Math.abs(q.y) <= 1.02) { inside++; }
        }
        if (!inside) { clipped++; }
      });
      out.push({ t, cov: Math.round(Math.max(fx, fy) * 100), area: Math.round(fx * fy * 100), clipped, items });
    }
    return out;
  }, N);

  await browser.close();
  const low = res.filter(r => r.cov < 80), clip = res.reduce((a, r) => a + r.clipped, 0);
  if (errs.length) { console.error(errs.slice(0, 4)); }
  if (process.env.VERBOSE) { console.log(res.map(r => `${r.t}:${r.cov}/${r.area}%`).join(' ')); }
  const avg = Math.round(res.reduce((a, r) => a + r.cov, 0) / Math.max(1, res.length));
  console.log(`belső nézet: ${res.length} szoba, kitöltés átlag ${avg}% (terület ${Math.round(res.reduce((a, r) => a + r.area, 0) / Math.max(1, res.length))}%), 80% alatt ${low.length}, képből kilógó tárgy ${clip}, konzolhiba ${errs.length}`);
  process.exit(low.length || clip || errs.length ? 1 : 0);
})();
