// Utcasor E2E: minden helyszínen megépíti a házat, és megméri, milyen utca és milyen szomszédok
// kerülnek a ház elé. A városi utcasor valóban városi: aszfaltos utca sorházakkal, nem földút tanyákkal.
// Használat: node tests/e2e/street.js   (tesztoldal: bin/test-wp.sh)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';

(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 160)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('[data-agh-open]');
  await page.waitForSelector('.agh-shell .agh-preview-box.has-3d canvas', { timeout: 60000 });
  await page.waitForTimeout(2500);

  const opts = await page.evaluate(() => {
    const sc = window.AGH_Designer.schema(), f = sc.fields.filter(q => q.id === 'landscape')[0];
    return (f.options || []).map(o => o.value).filter(v => v && v !== 'auto');
  });

  const rows = [];
  for (const v of opts) {
    const r = await page.evaluate(async (v) => {
      const A3 = window.AGH_3D, vw = A3.viewer();
      const c = Object.assign(window.AGH_Designer.config(), { landscape: v, neighbors: false });
      const box = document.querySelector('.agh-preview-box');
      const t0 = performance.now();
      A3.attach(box, c);
      const ms = Math.round(performance.now() - t0);
      const si = vw.siteInfo || {};
      const hood = {};
      let tris = 0, mesh = 0;
      vw.hood.traverse(o => { if (o.userData && o.userData.hood) { hood[o.userData.hood] = (hood[o.userData.hood] || 0) + 1; } });
      vw.scene.traverse(o => { if (o.isMesh && o.geometry && o.geometry.index) { tris += o.geometry.index.count / 3; mesh++; } });
      return { v: v, street: si.street || '', houses: si.hood || 0, kind: Object.keys(hood).join(','), ms: ms, mesh: mesh, tris: Math.round(tris) };
    }, v);
    rows.push(r);
    await page.waitForTimeout(250);
  }

  await browser.close();
  if (errors.length) { console.error(errors.slice(0, 4)); }
  const town = rows.filter(r => r.v === 'town')[0] || {};
  const country = rows.filter(r => ['plain', 'hills', 'mountains', 'forest', 'river', 'valley', 'farmstead', 'puszta', 'vineyard', 'alpine_forest'].indexOf(r.v) !== -1);
  const suburb = rows.filter(r => r.v === 'suburb')[0] || {};
  // vidéken a szomszéd épületek csak beállításra jönnek; a városi utcasor magában is utcasor
  const countryOk = country.length && country.every(r => r.street === 'country' && r.houses === 0);
  const ok = town.street === 'urban' && town.houses >= 8 && town.kind === 'urban'
    && suburb.street === 'town' && suburb.houses === 0 && countryOk && rows.every(r => r.street) && !errors.length;
  const slow = rows.slice().sort((a, b) => b.ms - a.ms)[0];
  console.log(`utcasor: ${rows.length} helyszín „környező épületek” nélkül – városi utca ${town.street}, ${town.houses} sorház, külvárosi ${suburb.street}/${suburb.houses}, vidéki ${country.length} db földút 0 házzal (${countryOk ? 'ok' : 'nem'}), leglassabb ${slow.v} ${slow.ms} ms, konzolhiba ${errors.length}`);
  if (!ok) { console.log(rows.map(r => `${r.v}:${r.street}/${r.houses}`).join(' ')); }
  process.exit(ok ? 0 : 1);
})();
