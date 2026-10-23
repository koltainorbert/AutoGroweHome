// „Élő fotó” E2E (1.27.0, FELADAT-1.25.0 7. pont): a 3D nézet megállás után sugárkövetésre vált.
// Méri: a minták száma nő; a kép eltér a raszterestől; a zajszint (szomszédos pixelek különbségének
// szórása sík felületen) csökken a mintákkal; mozdulatra 1 képkockán belül raszter; a „Fotó készítése”
// PNG-t ad; a BVH építési ideje; a sugárkövető modul csak az első kép után töltődik; konzolhiba 0.
// SwiftShaderen kis felbontással (1000×680 ablak, a 3D doboz kb. 560×270). Ha a sugárkövető itt nem fut, kiírja az okát.
// Használat: AGH_URL=http://127.0.0.1:8899/tervezo/ [AGH_WP=/home/claude/wpsite] node tests/e2e/photo3d.js
// (AGH_WP: a tesztoldal könyvtára – ekkor az építési mód 3D eszköztárát is nézi, a kapcsolót maga állítja)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';

(async () => {
  const t0 = Date.now();
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 680 }, acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [], ptReq = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 200)));
  page.on('request', r => { if (/three-gpu-pathtracer|three-mesh-bvh/.test(r.url())) ptReq.push(Date.now()); });
  const res = { checks: {} };
  const ok = (k, v) => { res.checks[k] = !!v; };
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('[data-agh-open]');
  await page.waitForSelector('.agh-shell .agh-preview-box.has-3d canvas', { timeout: 90000 });
  const tCanvas = Date.now();
  // lazy: the path tracer library is not part of the first picture
  await page.waitForFunction(() => { const v = window.AGH_3D && window.AGH_3D.viewer(); return v && v.frames > 0; }, { timeout: 90000 });
  const libBeforeFirst = ptReq.filter(t => t <= tCanvas).length;
  ok('lusta betöltés (első kép előtt 0 kérés)', libBeforeFirst === 0);

  // the toolbar: switch + photo button
  await page.waitForSelector('.agh-preview-box .agh-3d-photo .agh-3d-photo-live', { timeout: 30000 });
  const def = await page.evaluate(() => { const p = window.AGH_3D.viewer().photo; return { on: p.on, soft: p.soft, gpu: p.gpu, quality: window.AGH_3D.viewer().quality }; });
  res.default = def;
  // a software renderer counts as weak: the live photo is off by default there, the button stays
  ok('gyenge gépen alapból ki', def.soft ? def.on === false : true);
  // switch on (as the visitor would) – remembered in localStorage
  if (!def.on) { await page.click('.agh-preview-box .agh-3d-photo-live'); }
  const stored = await page.evaluate(() => localStorage.getItem('agh_live_photo'));
  ok('kapcsoló megjegyezve', stored === 'true');

  // wait for the first samples (BVH build + shader compile on SwiftShader take a while)
  let info = null;
  try {
    await page.waitForFunction(() => { const p = window.AGH_3D.viewer().photo; return p.state === 'unsupported' || (p.pt && p.pt.samples >= 2 && p.opacity > 0); }, { timeout: 240000, polling: 500 });
  } catch (e) { /* reported below */ }
  info = await page.evaluate(() => window.AGH_3D.viewer().photo.info());
  res.bvh = info.stats; res.ptSize = info.ptSize; res.state0 = info.state;
  if (info.state === 'unsupported') {
    res.unsupported = info.reason;
  } else {
    // samples grow, noise falls
    const m1 = await page.evaluate(() => window.AGH_3D.viewer().photo.measure());
    await page.waitForFunction(n => { const p = window.AGH_3D.viewer().photo; return p.pt.samples >= n || p.state !== 'trace'; }, Math.min(info.target, Math.max(16, m1.samples * 6)), { timeout: 240000, polling: 500 }).catch(() => {});
    const m2 = await page.evaluate(() => window.AGH_3D.viewer().photo.measure());
    res.m1 = m1; res.m2 = m2;
    ok('minták nőnek', m2.samples > m1.samples);
    ok('eltér a raszterestől', m2.diffRaster > 2);
    ok('zaj csökken a mintákkal (nyers)', m2.noiseRaw < m1.noiseRaw);
    ok('sík falfelületek találva', m2.blocks >= 6);
    // status pill shows samples / target
    res.status = await page.$eval('.agh-preview-box .agh-3d-photo-txt', e => e.textContent);
    ok('állapotsáv (minták / cél)', /\d+\s*\/\s*\d+/.test(res.status));

    // movement: within one frame the raster picture is back
    const mv = await page.evaluate(() => new Promise(resolve => {
      const v = window.AGH_3D.viewer(), p = v.photo, before = p.opacity, n0 = p.log.length;
      v.controls.dispatchEvent({ type: 'start' });
      const rot = v.controls.getAzimuthalAngle();
      v.camera.position.applyAxisAngle(new v.camera.up.constructor(0, 1, 0), 0.08); v.controls.update();
      void rot;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const after = p.log.slice(n0).map(e => e.k), firstRaster = after.indexOf('raster'), photoAfter = after.slice(firstRaster + 1).filter(k => k === 'photo').length;
        v.controls.dispatchEvent({ type: 'end' });
        resolve({ before, after: p.opacity, frames: after.length, firstRaster, photoAfter, state: p.state });
      }));
    }));
    res.move = mv;
    ok('mozdulatra 1 képkockán belül raszter', mv.before > 0 && mv.after === 0 && mv.firstRaster === 0 && mv.photoAfter === 0);
    // it comes back after the view settles again
    await page.waitForFunction(() => { const p = window.AGH_3D.viewer().photo; return p.pt.samples >= 2 && p.opacity > 0; }, { timeout: 240000, polling: 500 }).catch(() => {});
    const back = await page.evaluate(() => window.AGH_3D.viewer().photo.info());
    res.back = { samples: back.samples, state: back.state, rebuilt: back.stats.builds };
    ok('megállás után újra sugárkövetés (BVH nem épül újra)', back.samples >= 2 && back.stats.builds === info.stats.builds);
  }

  // „Fotó készítése”: a PNG download (small size and few samples so SwiftShader finishes in time)
  await page.evaluate(() => { const p = window.AGH_3D.viewer().photo; p.cfg.photoLong = 480; p.cfg.photoSamples = 8; });
  let png = null;
  try {
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 300000 }),
      page.click('.agh-preview-box .agh-3d-photo-take')
    ]);
    const fs = require('fs'), path = require('path'), os = require('os');
    const f = path.join(os.tmpdir(), 'agh-photo3d-' + process.pid + '.png');
    await dl.saveAs(f);
    const b = fs.readFileSync(f);
    png = { name: dl.suggestedFilename(), bytes: b.length, sig: b.slice(0, 8).toString('hex'), w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    fs.unlinkSync(f);
  } catch (e) { png = { error: String(e.message || e).slice(0, 120) }; }
  res.png = png;
  const lastPhoto = await page.evaluate(() => window.AGH_3D.viewer().photo.info().photo);
  res.photo = lastPhoto;
  ok('fotó gomb PNG-t ad', png && png.sig === '89504e470d0a1a0a' && png.w >= 300);
  await page.waitForTimeout(500);
  // build mode (9th step, the finished house in 3D): the same two buttons in the stage bar, only for the 3D view
  if (process.env.AGH_WP) {
    const path = require('path'), { execFileSync } = require('child_process');
    const toggle = on => execFileSync('php', [path.join(__dirname, '..', 'build-toggle.php'), on ? 'on' : 'off', process.env.AGH_WP]).toString().trim();
    toggle(true);
    try {
      await page.close();
      const ctx2 = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      await ctx2.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {} });
      const p2 = await ctx2.newPage();
      p2.on('console', m => { if (m.type() === 'error') errors.push('build: ' + m.text().slice(0, 200)); });
      p2.on('pageerror', e => errors.push('build pageerror: ' + e.message.slice(0, 200)));
      await p2.goto(URL, { waitUntil: 'networkidle' });
      await p2.click('[data-agh-open]');
      await p2.waitForSelector('.agh-shell .agh-preview-box', { state: 'attached', timeout: 60000 });
      await p2.waitForTimeout(800);
      await p2.evaluate(() => { const x = document.querySelector('.agh-bld-btn'); if (x && x.offsetParent) { x.click(); } else { const m = Array.from(document.querySelectorAll('.agh-hmenu-item')).filter(q => /alapokt/i.test(q.textContent))[0]; if (m) { m.click(); } } });
      await p2.waitForSelector('.agh-build .agh-bld-svg', { state: 'attached', timeout: 30000 });
      await p2.evaluate(() => { window.AGH_BuildUI.load(window.AGH_Build.randomHouse(9)); window.AGH_BuildUI.goStep(9); window.AGH_BuildUI.setView('3d'); });
      await p2.waitForSelector('.agh-bld-photo .agh-3d-photo-take', { timeout: 90000 });
      const b3 = await p2.evaluate(() => ({ shown: !document.querySelector('.agh-bld-photo').hidden, take: !!document.querySelector('.agh-bld-photo .agh-3d-photo-take'), live: !!document.querySelector('.agh-bld-photo .agh-3d-photo-live') }));
      await p2.evaluate(() => window.AGH_BuildUI.setView('plan'));
      b3.hiddenOnPlan = await p2.evaluate(() => document.querySelector('.agh-bld-photo').hidden);
      res.build = b3;
      ok('építési mód 3D: fotó gomb + kapcsoló, alaprajznál rejtve', b3.shown && b3.take && b3.live && b3.hiddenOnPlan);
      await ctx2.close();
    } catch (e) { res.build = { error: String(e.message || e).split('\n')[0].slice(0, 140) }; ok('építési mód 3D: fotó gomb + kapcsoló, alaprajznál rejtve', false); } finally { toggle(false); }
  }
  ok('konzolhiba 0', errors.length === 0);
  await browser.close();

  const c = res.checks, pass = Object.keys(c).filter(k => c[k]).length, all = Object.keys(c).length;
  const f1 = x => (x === undefined || x === null) ? '–' : (+x).toFixed(2);
  console.log('GPU: ' + def.gpu + ' | minőség ' + def.quality + ', élő fotó alapból ' + (def.on ? 'be' : 'ki'));
  if (res.unsupported) { console.log('sugárkövető NEM fut: ' + res.unsupported); }
  console.log('BVH: ' + res.bvh.tris + ' háromszög, sütés ' + res.bvh.bakeMs + ' ms, BVH ' + res.bvh.bvhWorkerMs + ' ms (' + res.bvh.worker + '), összesen ' + res.bvh.bvhMs + ' ms; gyűjtési felbontás ' + (res.ptSize || []).join('×'));
  if (res.m1) {
    console.log('zaj (szomszédos pixelek szórása, ' + res.m2.blocks + ' sík blokk, 0–255): raszter ' + f1(res.m1.noiseRaster) + ' | ' + res.m1.samples + ' minta: nyers ' + f1(res.m1.noiseRaw) + ', szűrt ' + f1(res.m1.noiseFinal) + ' | ' + res.m2.samples + ' minta: nyers ' + f1(res.m2.noiseRaw) + ', szűrt ' + f1(res.m2.noiseFinal));
    console.log('eltérés a raszterestől (átlag, 0–255): ' + f1(res.m1.diffRaster) + ' → ' + f1(res.m2.diffRaster) + ' | állapotsáv: „' + res.status + '”');
    console.log('mozdulat: előtte átfedés ' + f1(res.move.before) + ', utána ' + res.move.after + ', első képkocka raszter: ' + (res.move.firstRaster === 0 ? 'igen' : 'nem') + ' | újra: ' + res.back.samples + ' minta');
  }
  console.log('fotó: ' + (png && png.w ? png.w + '×' + png.h + ' PNG, ' + Math.round(png.bytes / 1024) + ' KB, ' + (lastPhoto ? lastPhoto.samples + ' minta, ' + lastPhoto.ms + ' ms' : '') : JSON.stringify(png)));
  if (res.build) { console.log('építési mód: ' + JSON.stringify(res.build)); }
  Object.keys(c).forEach(k => { if (!c[k]) { console.log('HIBA: ' + k); } });
  if (errors.length) { console.log('konzol: ' + errors.slice(0, 4).join(' | ')); }
  console.log(`photo3d: ${pass}/${all} rendben, ${Math.round((Date.now() - t0) / 1000)} s`);
  process.exit(pass === all ? 0 : 1);
})();
