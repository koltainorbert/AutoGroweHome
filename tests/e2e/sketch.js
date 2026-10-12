// Élő vázlat lefedettség: minden mezőt megváltoztat a valódi felületen (részletes mód, minden kategória),
// és megnézi, hogy a vázlat SVG-je változott-e, ill. megjelent-e a változás-jelzés.
// Hiba: a paraméternek az adott beállításnál látszania kellene (AGH_Sketch.visibleFor), de a vázlat nem változott;
// a jelzés nem egyezik a valós változással; vagy nincs jelzés.
// Használat: node tests/e2e/sketch.js [kimenet.json]
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';
const OUT = process.argv[2] || '';
const SKIP = new Set(['rooms', 'custom_prompt', 'house_name', 'custom_notes']);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 160)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('[data-agh-open]');
  await page.waitForSelector('.agh-shell .agh-preview-box svg', { timeout: 15000 });
  const seg = page.locator('.agh-seg button').nth(1);
  if (await seg.isVisible()) { await seg.click(); await page.waitForTimeout(300); }
  const snap = () => page.evaluate(() => { const s = document.querySelector('.agh-preview-box > svg'); return s ? s.outerHTML.replace(/agh\d+_/g, '') : ''; });
  const cats = await page.$$eval('.agh-rail button[data-cat]', bs => bs.map(b => b.getAttribute('data-cat')));
  const rows = [];
  for (const cat of cats) {
    await page.click(`.agh-rail button[data-cat="${cat}"]`);
    await page.waitForTimeout(150);
    const ids = await page.$$eval('.agh-field[data-field]', fs => fs.map(f => f.getAttribute('data-field')));
    for (const id of ids) {
      if (SKIP.has(id)) { continue; }
      const sel = `.agh-field[data-field="${id}"]`;
      if (!(await page.$(sel))) { continue; }
      const before = await snap();
      const cfgBefore = await page.evaluate(() => window.AGH_Designer.config());
      let how = '';
      try {
        if (await page.$(`${sel} .agh-card-opt[aria-pressed="false"]`)) { how = 'card'; await page.click(`${sel} .agh-card-opt[aria-pressed="false"] >> nth=0`); }
        else if (await page.$(`${sel} select`)) {
          how = 'select';
          const cur = await page.$eval(`${sel} select`, s => s.value);
          const vals = await page.$$eval(`${sel} select option`, os => os.map(o => o.value).filter(Boolean));
          const pick = vals.find(v => v !== cur);
          if (!pick) { continue; }
          await page.selectOption(`${sel} select`, pick);
        } else if (await page.$(`${sel} input[type=checkbox]`)) { how = 'toggle'; await page.click(`${sel} .agh-switch`); }
        else if (await page.$(`${sel} input[type=color]`)) { how = 'color'; await page.fill(`${sel} input.agh-input`, '#2E6B8F'); await page.press(`${sel} input.agh-input`, 'Enter'); await page.$eval(`${sel} input.agh-input`, e => e.dispatchEvent(new Event('change'))); }
        else if (await page.$(`${sel} input[type=number]`)) {
          how = 'number';
          const r = await page.$eval(`${sel} input[type=number]`, e => ({ v: +e.value, min: +e.min, max: +e.max, step: +e.step || 1 }));
          let nv = r.v + Math.max(r.step, (r.max - r.min) * 0.25);
          if (nv > r.max) { nv = Math.max(r.min, r.v - Math.max(r.step, (r.max - r.min) * 0.25)); }
          await page.$eval(`${sel} input[type=number]`, (e, x) => { e.value = x; e.dispatchEvent(new Event('change')); }, nv);
        } else if (await page.$(`${sel} .agh-chip`)) {
          how = 'multi';
          const off = await page.$(`${sel} .agh-chip[aria-pressed="false"]`);
          await (off || await page.$(`${sel} .agh-chip`)).click();
        } else { continue; }
      } catch (e) { rows.push({ cat, id, how, err: e.message.slice(0, 80) }); continue; }
      await page.waitForTimeout(120);
      const after = await snap();
      const chip = await page.$eval('.agh-preview-chg', e => ({ hidden: e.classList.contains('is-hidden-param'), text: e.textContent.slice(0, 60) })).catch(() => null);
      const changed = before !== after;
      const exp = await page.evaluate(([id, b]) => {
        const a = window.AGH_Designer.config();
        let val = null;
        if (Array.isArray(a[id]) || Array.isArray(b[id])) { const x = a[id] || [], y = b[id] || []; val = x.filter(v => y.indexOf(v) === -1).concat(y.filter(v => x.indexOf(v) === -1))[0]; }
        return window.AGH_Sketch.visibleFor(id, a, val) || window.AGH_Sketch.visibleFor(id, b, val);
      }, [id, cfgBefore]);
      const honest = chip ? chip.hidden === !changed : false;
      const ok = !!chip && honest && (!exp || changed);
      rows.push({ cat, id, how, expected: exp, changed, chip: chip ? (chip.hidden ? 'képen' : 'vázlaton') : 'nincs', ok });
    }
  }
  const bad = rows.filter(r => !r.ok);
  const vis = rows.filter(r => r.chip === 'vázlaton');
  const summary = { fields: rows.length, expectedVisible: rows.filter(r => r.expected).length, changedOnSketch: vis.length, imageOnly: rows.filter(r => r.chip === 'képen').length, failed: bad.length, console: errors.length };
  if (OUT) { require('fs').writeFileSync(OUT, JSON.stringify({ summary, rows, errors }, null, 1)); }
  console.log(JSON.stringify(summary));
  if (bad.length) { console.log('HIBA:', JSON.stringify(bad)); }
  if (errors.length) { console.log('KONZOL:', errors.slice(0, 5)); }
  await browser.close();
  process.exit(bad.length || errors.length ? 1 : 0);
})();
