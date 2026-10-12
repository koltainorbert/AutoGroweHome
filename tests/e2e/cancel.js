// Generation start → "Leállítás" → the visitor can start again (no endless spinner).
// Usage: node tests/e2e/cancel.js   (test site from bin/test-wp.sh)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  // 2D preview: SwiftShader 3D would only slow the clicks down; this test is about the queue.
  await ctx.addInitScript(() => { try { localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_3d', 'false'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {} });
  const p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); }); p.on('pageerror', e => errs.push(e.message));
  let cancelStatus = null;
  // Simulated stuck server: every project poll says "rendering" for ever, and the
  // cancel request never gets an answer (network error) – the UI must still let go.
  await p.route(/agh\/v1\/projects\/[^/?]+(\?|$)/, async route => {
    if (route.request().method() !== 'GET') { return route.continue(); }
    const res = await route.fetch(); const j = await res.json();
    j.status = 'rendering'; (j.concepts || []).forEach(c => { c.hero = null; });
    route.fulfill({ response: res, json: j });
  });
  await p.route(/\/cancel(\?|$)/, route => { cancelStatus = 'aborted'; route.abort('failed'); });
  await p.goto((process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/'), { waitUntil: 'networkidle' });
  await p.click('[data-agh-open]'); await p.waitForSelector('.agh-wiz-title');
  for (let i = 0; i < 6; i++) { await p.click('.agh-wiz-next'); await p.waitForTimeout(250); }
  await p.waitForTimeout(800);
  await p.click('.agh-wiz-next');
  await p.waitForSelector('.agh-dialog-wrap', { timeout: 5000 });
  await p.click('.agh-dialog-foot .agh-btn-primary');
  // The stop button appears while the project is queued/planning/rendering.
  const stop = await p.waitForSelector('.agh-actionbar .agh-btn-ghost', { timeout: 15000 }).catch(() => null);
  if (stop) { await stop.click(); }
  await p.waitForTimeout(4000);
  const st = await p.evaluate(() => {
    const gen = document.querySelector('.agh-actionbar .agh-btn-primary');
    return { genEnabled: !!gen && !gen.disabled, spinner: !!document.querySelector('.agh-actionbar .agh-spinner'), status: (document.querySelector('.agh-actionbar-status') || {}).textContent };
  });
  const out = { stopShown: !!stop, cancelStatus, ...st, console: errs };
  console.log(JSON.stringify(out));
  await b.close();
  // A failed request logs one browser network error – that one is expected here.
  const realErrs = errs.filter(e => !/Failed to load resource|ERR_FAILED/.test(e));
  process.exit(out.stopShown && out.genEnabled && !out.spinner && !realErrs.length ? 0 : 1);
})();
