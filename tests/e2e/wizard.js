// Varázsló E2E: végiglépked, minden lépésen mér (túllógás, 44 px, zoom), konzolhiba, képernyőképek.
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const fs = require('fs');
const OUT = process.argv[2] || '/tmp';
const SHOTS = (process.env.SHOT || '').split(',').filter(Boolean);
const audit = fs.readFileSync(require('path').join(__dirname, 'responsive.js'), 'utf8').match(/function audit\(\) \{[\s\S]*?\n\}\n/)[0];
const sizes = [['320x568', 320, 568, true], ['390x844', 390, 844, true], ['844x390', 844, 390, true], ['768x1024', 768, 1024, true], ['1366x768', 1366, 768, false], ['1920x1080', 1920, 1080, false]];
(async () => {
  const browser = await chromium.launch();
  const rows = [];
  for (const [label, w, hgt, touch] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, hasTouch: touch, isMobile: touch && w < 900 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 140)));
    await page.goto((process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/'), { waitUntil: 'networkidle' });
    await page.click('[data-agh-open]');
    await page.waitForSelector('.agh-wizard .agh-wiz-title', { timeout: 15000 });
    await page.waitForTimeout(600);
    await page.addScriptTag({ content: audit });
    for (let step = 1; step <= 7; step++) {
      const info = await page.evaluate(() => ({ title: document.querySelector('.agh-wiz-title').textContent, fields: Array.from(document.querySelectorAll('.agh-wiz-fields [data-field]')).map(e => e.getAttribute('data-field')), focus: document.activeElement && document.activeElement.className, dup: (() => { const ids = Array.from(document.querySelectorAll('.agh-root [id]')).map(e => e.id); return ids.length - new Set(ids).size; })() }));
      const a = await page.evaluate(() => audit());
      rows.push({ size: label, step, title: info.title, fields: info.fields.join(','), dupIds: info.dup, focusTitle: /agh-wiz-title/.test(info.focus || ''), ...a, console: errors.length });
      if (SHOTS.includes(label)) await page.screenshot({ path: `${OUT}/wiz-${label}-${step}.png` });
      if (step === 3) { // stílus választása: kártyára kattintás, fókusz és görgetés megmarad?
        const cards = await page.$$('.agh-wiz-fields .agh-card-opt');
        if (cards.length > 5) { await cards[5].click(); await page.waitForTimeout(300); rows[rows.length - 1].cardKeepsFocus = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-pressed') === 'true'); }
      }
      if (step < 7) { await page.click('.agh-wiz-next'); await page.waitForTimeout(350); }
    }
    // vissza a teljes tervezőbe és újra a varázslóba
    await page.click('.agh-wiz-full');
    await page.waitForTimeout(400);
    const back = await page.evaluate(() => ({ wizard: document.querySelector('.agh-shell').classList.contains('is-wizard'), fields: document.querySelectorAll('.agh-fields-list [data-field]').length, style: JSON.parse(localStorage.getItem('agh_draft_v1') || '{}').config?.arch_style, ui: localStorage.getItem('agh_ui') }));
    rows.push({ size: label, step: 'teljes', title: JSON.stringify(back), console: errors.length });
    if (errors.length) console.error(label, errors.slice(0, 4));
    await ctx.close();
  }
  await browser.close();
  console.log(JSON.stringify(rows));
})();
