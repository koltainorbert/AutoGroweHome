const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
(async () => {
  const b = await chromium.launch(); const out = [];
  for (const [w, hh, mob] of [[390, 844, true], [1366, 768, false]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: hh }, hasTouch: mob, isMobile: mob });
    const p = await ctx.newPage(); const errs = [];
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); }); p.on('pageerror', e => errs.push(e.message));
    let genStatus = null; p.on('response', r => { if (/agh\/v1\/generate/.test(r.url())) genStatus = r.status(); });
    await p.goto((process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/'), { waitUntil: 'networkidle' });
    await p.click('[data-agh-open]'); await p.waitForSelector('.agh-wiz-title');
    for (let i = 0; i < 6; i++) { await p.click('.agh-wiz-next'); await p.waitForTimeout(250); }
    await p.waitForTimeout(800);
    const disabled = await p.$eval('.agh-wiz-next', el => el.disabled);
    await p.click('.agh-wiz-next');
    await p.waitForSelector('.agh-dialog-wrap', { timeout: 5000 });
    await p.click('.agh-dialog-foot .agh-btn-primary');
    await p.waitForTimeout(2500);
    const st = await p.evaluate(() => ({ wizard: document.querySelector('.agh-shell').classList.contains('is-wizard'), tab: (document.querySelector('.agh-shell').className.match(/is-tab-\w+/) || [])[0], stageTabs: Array.from(document.querySelectorAll('.agh-stage-tabs button')).map(x => x.textContent + (x.getAttribute('aria-pressed') === 'true' ? '*' : '')).join('|'), project: JSON.parse(localStorage.getItem('agh_draft_v1') || '{}').project, ui: localStorage.getItem('agh_ui') }));
    out.push({ w, genDisabled: disabled, genStatus, ...st, console: errs });
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
