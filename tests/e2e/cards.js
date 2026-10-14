// Kártyaképek E2E: minden kártyás (visual: item) mező minden opciójára felépíti a kártyajelenetet,
// és ellenőrzi, hogy nem a semleges alapjelenet jön-e (korábban kanapé állt minden ismeretlen mezőn).
// Használat: node tests/e2e/cards.js   (tesztoldal: bin/test-wp.sh)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';

(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {} });
  const page = await ctx.newPage();
  const errs = [], warns = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 140)));
  page.on('console', m => { if (m.type() === 'error') { errs.push(m.text().slice(0, 140)); } if (m.type() === 'warning' && m.text().indexOf('nincs kártyajelenet') !== -1) { warns.push(m.text().slice(0, 90)); } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('[data-agh-open]');
  await page.waitForSelector('.agh-shell .agh-preview-box.has-3d canvas', { timeout: 60000 });

  const res = await page.evaluate(async () => {
    const url = n => (performance.getEntriesByType('resource').map(e => e.name).filter(x => x.indexOf(n) !== -1)[0] || n);
    const THREE = await import(url('vendor/three/three.module'));
    const INT = await import(url('agh-3d-int.js'));
    const base = window.AGH_Designer.config();
    const fields = (window.AGH_Designer.schema() || { fields: [] }).fields || [];
    const out = { fields: 0, options: 0, same: [], empty: [] };
    const bx = new THREE.Box3();
    function sig(hs) {
      let n = 0, tri = 0;
      hs.root.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.position) { n++; tri += o.geometry.attributes.position.count; } });
      const b = bx.setFromObject(hs.root);
      return n + '/' + tri + '|' + (b.isEmpty() ? 'x' : [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map(v => v.toFixed(2)).join(','));
    }
    // a semleges alapjelenet ujjlenyomata: ismeretlen mezőnév
    const plain = sig(INT.itemScene(base, { field: '__nincs_ilyen_mezo__', value: '' }));
    fields.forEach(f => {
      if (f.visual !== 'item' || !f.options) { return; }
      out.fields++;
      f.options.forEach(o => {
        if (o.value === 'auto' || o.value === 'none') { return; }   // „nincs” opciónál üres fal a helyes kártya
        out.options++;
        let hs = null;
        try { hs = INT.itemScene(base, { field: f.id, value: o.value }); } catch (e) { out.empty.push(f.id + '/' + o.value + ': ' + e.message.slice(0, 50)); return; }
        const s = sig(hs);
        if (s === plain) { out.same.push(f.id + '/' + o.value); }
      });
    });
    return out;
  });

  await browser.close();
  if (res.same.length) { console.error('alapjelenet:', res.same.slice(0, 10)); }
  if (res.empty.length) { console.error('hiba:', res.empty.slice(0, 5)); }
  if (errs.length) { console.error(errs.slice(0, 4)); }
  console.log(`kártyaképek: ${res.fields} mező, ${res.options} opció, alapjelenetre esik ${res.same.length}, hibás ${res.empty.length}, figyelmeztetés ${warns.length}, konzolhiba ${errs.length}`);
  process.exit(res.same.length || res.empty.length || errs.length ? 1 : 0);
})();
