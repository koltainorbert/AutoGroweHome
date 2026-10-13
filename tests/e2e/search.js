// Kereső E2E: betűnként gépel a paraméterkeresőbe, és minden leütés után ellenőrzi, hogy a fókusz és a
// kurzor a mezőn maradt-e (1.8.0: a fejléc újraépítése korábban az első betűnél kidobta a fókuszt).
// Futtatás: node tests/e2e/search.js   (a tesztoldal a 8899-es porton fut, bin/test-wp.sh)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const WORD = 'erkely';
const sizes = [['390x844', 390, 844, true], ['1366x768', 1366, 768, false]];
(async () => {
  const browser = await chromium.launch();
  let lost = 0, caret = 0, rows = [], consoleErr = 0;
  for (const [label, w, h, touch] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') { consoleErr++; console.error(label, m.text().slice(0, 140)); } });
    page.on('pageerror', e => { consoleErr++; console.error(label, 'pageerror: ' + e.message.slice(0, 140)); });
    await page.goto((process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/'), { waitUntil: 'networkidle' });
    await page.click('[data-agh-open]');
    await page.waitForSelector('.agh-wizard .agh-wiz-title', { timeout: 15000 });
    await page.click('.agh-wiz-full');
    await page.waitForSelector('.agh-search input', { timeout: 15000 });
    await page.waitForTimeout(500);
    await page.$eval('.agh-search input', el => el.focus());   // a párbeszéd réteg miatt közvetlen fókusz
    for (let i = 0; i < WORD.length; i++) {
      await page.keyboard.type(WORD[i]);
      await page.waitForTimeout(260);   // a debounce (150 ms) utáni újrarajzolás is lefut
      const st = await page.evaluate(() => {
        const el = document.querySelector('.agh-search input'), a = document.activeElement;
        return { ok: !!el && a === el, value: el ? el.value : '', caret: el ? el.selectionStart : -1, hits: document.querySelectorAll('.agh-fields-list [data-field]').length };
      });
      if (!st.ok) { lost++; }
      if (st.caret !== st.value.length) { caret++; }
      rows.push(`${label} "${st.value}" fókusz=${st.ok ? 'ok' : 'ELVESZETT'} kurzor=${st.caret} találat=${st.hits}`);
    }
    // kategóriaváltás üríti a keresőt, a mező a helyén marad
    await page.$eval('.agh-rail button:nth-child(2)', b => b.click());   // mobilon a sáv görgethető, a közvetlen hívás stabil
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => { const el = document.querySelector('.agh-search input'); return { there: !!el, value: el ? el.value : 'nincs' }; });
    rows.push(`${label} kategóriaváltás után: mező=${after.there ? 'megvan' : 'HIÁNYZIK'} érték="${after.value}"`);
    if (!after.there || after.value !== '') { lost++; }
    await ctx.close();
  }
  await browser.close();
  if (process.env.VERBOSE) { rows.forEach(r => console.log(r)); }
  console.log(`kereső: ${sizes.length} méret × ${WORD.length} leütés, fókuszvesztés ${lost}, rossz kurzor ${caret}, konzolhiba ${consoleErr}`);
  process.exit(lost || caret || consoleErr ? 1 : 0);
})();
