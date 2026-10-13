// Koppintás a modellre E2E: a 3D-ben a ház részeire kattint, és ellenőrzi, hogy a bal oldali
// beállítások a hozzá tartozó mezőhöz ugranak-e (kiemelt .agh-field.is-picked).
// Használat: node tests/e2e/pick.js   (tesztoldal: bin/test-wp.sh)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';

(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 160)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('[data-agh-open]');
  await page.waitForSelector('.agh-shell .agh-preview-box.has-3d canvas', { timeout: 60000 });
  await page.waitForTimeout(2500);

  // kívül: hány részhez tartozik beállítás, és mit találunk a vászon pontjain
  const ext = await page.evaluate(() => {
    const v = window.AGH_3D.viewer(), r = v.el.getBoundingClientRect(), f = {}, hits = [];
    (v.picks || []).forEach(q => { f[q.field] = (f[q.field] || 0) + 1; });
    for (const fy of [0.35, 0.5, 0.65, 0.8]) for (const fx of [0.3, 0.5, 0.7]) {
      const h = v.pickAt(r.left + r.width * fx, r.top + r.height * fy);
      if (h) { hits.push(h.field); }
    }
    return { n: (v.picks || []).length, fields: Object.keys(f).sort(), hits: hits.length };
  });

  // valódi kattintás a házon: a mező kiemelve jelenik meg a bal oldalon
  const cv = await page.$('.agh-preview-box canvas');
  const bb = await cv.boundingBox();
  await page.mouse.click(bb.x + bb.width * 0.5, bb.y + bb.height * 0.55);
  await page.waitForTimeout(600);
  const extField = await page.evaluate(() => { const e = document.querySelector('.agh-field.is-picked'); return e ? e.getAttribute('data-field') : null; });

  // belső nézet: a bútorra kattintva a bútor mezőjéhez ugrik
  await page.$eval('.agh-3d-view button:nth-child(2)', b => b.click());
  await page.waitForTimeout(3500);
  const bb2 = (await (await page.$('.agh-preview-box canvas')).boundingBox());
  let intField = null;
  for (const q of [[0.35, 0.6], [0.5, 0.55], [0.6, 0.65], [0.45, 0.7]]) {
    await page.mouse.click(bb2.x + bb2.width * q[0], bb2.y + bb2.height * q[1]);
    await page.waitForTimeout(450);
    intField = await page.evaluate(() => { const e = document.querySelector('.agh-field.is-picked'); return e ? e.getAttribute('data-field') : null; });
    if (intField) { break; }
  }
  await browser.close();
  if (errors.length) { console.error(errors.slice(0, 4)); }
  const ok = ext.n > 20 && ext.hits >= 6 && extField && intField && !errors.length;
  console.log(`koppintás: ${ext.n} rész, ${ext.fields.length} mező (${ext.fields.join(',')}), 12 pontból ${ext.hits} talált, kívül „${extField}”, belül „${intField}”, konzolhiba ${errors.length}`);
  process.exit(ok ? 0 : 1);
})();
