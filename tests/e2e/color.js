// Színválasztó E2E: a felületen nem maradhat natív `type="color"` mező, és a saját választó
// asztali és mobil méretben is beállítja a színt (mező, konfiguráció, 3D).
// Használat: node tests/e2e/color.js   (tesztoldal: bin/test-wp.sh)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';
const sizes = [['390x844', 390, 844, true], ['1366x768', 1366, 768, false]];

(async () => {
  const browser = await chromium.launch();
  const rows = [];
  let bad = 0, errs = 0;
  for (const [label, w, hgt, touch] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d', 'false'); } catch (e) {} });
    const page = await ctx.newPage();
    page.on('pageerror', e => { errs++; console.error(label, e.message.slice(0, 140)); });
    page.on('console', m => { if (m.type() === 'error') { errs++; console.error(label, m.text().slice(0, 140)); } });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.click('[data-agh-open]');
    await page.waitForSelector('.agh-shell', { timeout: 20000 });
    if (await page.$('.agh-wiz-full')) { await page.$eval('.agh-wiz-full', b => b.click()); }
    await page.waitForSelector('.agh-fields-list', { timeout: 20000 });
    // végigmegyünk minden kategórián, és megszámoljuk a natív színmezőket
    const cats = await page.$$eval('.agh-rail button[data-cat]', bs => bs.map(b => b.getAttribute('data-cat')));
    let native = 0, own = 0;
    for (const cat of cats) {
      await page.$eval(`.agh-rail button[data-cat="${cat}"]`, b => b.click());
      await page.waitForTimeout(140);
      const n = await page.evaluate(() => ({ nat: document.querySelectorAll('input[type="color"]').length, own: document.querySelectorAll('.agh-colorbtn').length }));
      native += n.nat; own += n.own;
    }
    // a helyiségek részleteinél is: kinyitjuk az első helyiséget
    await page.$eval('.agh-rail button[data-cat="rooms"]', b => b.click()).catch(() => {});
    await page.waitForTimeout(200);
    await page.evaluate(() => { const b = document.querySelector('.agh-room .agh-room-meta button[aria-expanded]'); if (b) { b.click(); } });
    await page.waitForTimeout(300);
    const roomNative = await page.evaluate(() => document.querySelectorAll('input[type="color"]').length);
    native += roomNative;
    // a saját választó kipróbálása az első színmezőn
    await page.$eval('.agh-rail button[data-cat="facade"]', b => b.click()).catch(() => {});
    await page.waitForTimeout(250);
    const picked = await page.evaluate(async () => {
      const btn = document.querySelector('.agh-field[data-field="facade_color"] .agh-colorbtn') || document.querySelector('.agh-colorbtn');
      if (!btn) { return 'nincs színgomb'; }
      btn.click();
      await new Promise(r => setTimeout(r, 150));
      const pop = document.querySelector('.agh-cp');
      if (!pop) { return 'nem nyílt ki'; }
      const hex = pop.querySelector('.agh-cp-hex');
      hex.value = '#2E6F8E';
      hex.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 200));
      const cfg = window.AGH_Designer.config();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise(r => setTimeout(r, 150));
      return (cfg.facade_color || '').toUpperCase() + '|' + (document.querySelector('.agh-cp') ? 'nyitva' : 'zárva');
    });
    if (native) { bad++; }
    if (picked !== '#2E6F8E|zárva') { bad++; }
    rows.push(`${label}: natív színmező ${native}, saját színgomb ${own}, beállítás ${picked}`);
    await ctx.close();
  }
  await browser.close();
  if (process.env.VERBOSE) { rows.forEach(r => console.log(r)); }
  console.log(`színválasztó: ${rows.map(r => r.split(':')[0]).join(' + ')} · ${rows.map(r => r.split(': ')[1]).join(' · ')} · konzolhiba ${errs}`);
  process.exit(bad || errs ? 1 : 0);
})();
