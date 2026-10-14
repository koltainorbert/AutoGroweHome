// Betöltési idő E2E: megméri, mennyi idő telik el a tervező megnyitásától az első kész 3D képig,
// és hogy ebből mennyi a kérések, a letöltött fájlok és a felépítés ideje. Hálózati fékezés nélkül
// (helyi szerver) és „lassú 3G”-vel is mér, mert a panasz („lassú a betöltés”) mobilon jelentkezik.
// Használat: node tests/e2e/perf.js   (tesztoldal: bin/test-wp.sh)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';

async function once(browser, slow) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {} });
  const page = await ctx.newPage();
  if (slow) {
    // kb. 3 Mbit/s le, 60 ms késleltetés: tisztes mobilhálózat
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: (3 * 1024 * 1024) / 8, uploadThroughput: (768 * 1024) / 8 });
  }
  await page.goto(URL, { waitUntil: 'load' });
  await page.evaluate(() => { window.__t0 = performance.now(); });
  await page.click('[data-agh-open]');
  await page.waitForSelector('.agh-shell', { timeout: 60000 });
  const tShell = await page.evaluate(() => performance.now() - window.__t0);
  await page.waitForSelector('.agh-preview-box.has-3d canvas', { timeout: 120000 });
  const t3d = await page.evaluate(() => performance.now() - window.__t0);
  await page.waitForFunction(() => { const v = window.AGH_3D && window.AGH_3D.viewer && window.AGH_3D.viewer(); return v && v.house && v.renderer; }, { timeout: 120000 });
  const tReady = await page.evaluate(() => performance.now() - window.__t0);
  const res = await page.evaluate(() => {
    const out = { files: [], total: 0, boot: 0, net: 0 };
    const t0 = window.__t0 || 0;
    performance.getEntriesByType('resource').forEach(r => {
      const n = r.name.split('?')[0], base = n.split('/').pop();
      if (n.indexOf('autogrowehome') === -1 && n.indexOf('/agh/') === -1) { return; }
      const kb = Math.round((r.transferSize || r.encodedBodySize || 0) / 1024);
      out.total += kb;
      if (n.indexOf('/agh/') !== -1) { out.boot += Math.round(r.duration); }
      if (r.responseEnd > t0) { out.net = Math.max(out.net, Math.round(r.responseEnd - t0)); }
      if (kb >= 30 || r.duration > 120) { out.files.push({ f: base, kb: kb, ms: Math.round(r.duration) }); }
    });
    out.files.sort((a, b) => b.kb - a.kb);
    return out;
  });
  await ctx.close();
  return { slow: !!slow, shell: Math.round(tShell), canvas: Math.round(t3d), ready: Math.round(tReady), kb: res.total, boot: res.boot, net: res.net, files: res.files.slice(0, 6) };
}

(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const fast = await once(browser, false);
  const slow = await once(browser, true);
  await browser.close();
  const line = r => `${r.slow ? 'lassú 3 Mbit/s' : 'helyi'}: letöltés vége ${r.net} ms, felület ${r.shell} ms, kész kép ${r.ready} ms, ${r.kb} KB (ebből REST ${r.boot} ms)`;
  console.log('betöltés – ' + line(fast) + ' | ' + line(slow));
  console.log('legnagyobb fájlok: ' + fast.files.map(f => `${f.f} ${f.kb} KB/${f.ms} ms`).join(', '));
  // a kész kép 8 s felett helyi hálózaton mindenképp lassú
  process.exit(fast.ready < 8000 ? 0 : 1);
})();
