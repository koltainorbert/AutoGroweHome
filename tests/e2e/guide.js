// Vezetőkép E2E: a tervező a 3D modellről készít képeket, és elküldi őket a generálással.
// 1.12.0: tiszta vezetőkép, szemmagasság magas kameránál, belső nézetek vezetőképe.
// Méri, hány nézet készült el, mekkorák, és hogy a /generate kérés testében tényleg ott vannak-e.
// Használat: node tests/e2e/guide.js   (tesztoldal: bin/test-wp.sh)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';

// JPEG mérete a base64-ből (a kérésben ezt küldjük, ennek a kész kép képarányát kell hoznia)
function jpegSize(dataUrl) {
  const b = Buffer.from(String(dataUrl).split(',')[1] || '', 'base64');
  for (let i = 2; i + 9 < b.length;) {
    if (b[i] !== 0xFF) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) { return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return [0, 0];
}

(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 160)));

  // mi megy ki a /generate kérésben, és mi a gyűjtőhívásban
  let sent = null, later = null;
  page.on('request', r => {
    if (r.method() === 'POST' && /\/agh\/v1\/projects\/[^/]+\/guides/.test(r.url())) {
      try { later = Object.keys(JSON.parse(r.postData() || '{}').guides || {}); } catch (e) { later = []; }
    }
    if (r.method() === 'POST' && /\/agh\/v1\/generate/.test(r.url())) {
      try {
        const b = JSON.parse(r.postData() || '{}');
        const g = b.guides || {};
        sent = Object.keys(g).map(k => { const sz = jpegSize(g[k]); return { view: k, kb: Math.round((g[k] || '').length * 0.75 / 1024), type: (String(g[k]).split(';')[0] || '').replace('data:', ''), w: sz[0], h: sz[1] }; });
      } catch (e) { sent = []; }
    }
  });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('[data-agh-open]');
  await page.waitForSelector('.agh-shell .agh-preview-box.has-3d canvas', { timeout: 60000 });
  await page.waitForTimeout(3000);

  const wantAspect = await page.evaluate(async () => {
    try {
      const r = await fetch('/wp-json/agh/v1/bootstrap', { credentials: 'same-origin' });
      const b = await r.json();
      return (b.guide && b.guide.aspect) || 0;
    } catch (e) { return 0; }
  });

  // 1. a képkészítés önmagában (mind a hat nézet)
  const shots = await page.evaluate(async () => {
    const g = await window.AGH_3D.guides();
    const out = [];
    for (const k of Object.keys(g)) {
      const sz = await new Promise(res => { const im = new Image(); im.onload = () => res([im.naturalWidth, im.naturalHeight]); im.onerror = () => res([0, 0]); im.src = g[k]; });
      out.push({ view: k, kb: Math.round(g[k].length * 0.75 / 1024), w: sz[0], h: sz[1] });
    }
    return out;
  });

  // 1b. tiszta vezetőkép (járművek, emberek, háttérfák és pára nélkül) és szemmagasság: más kép,
  //     mint az élő nézet; a belső nézet vezetőképe a helyiség saját kamerájából
  const extra = await page.evaluate(async () => {
    const A = window.AGH_3D, v = A.viewer();
    const live = await A.guides(['hero'], 1152, 700, null, { camera: 'visitor' });
    const clean = await A.guides(['hero'], 1152, 700, null, { clean: true, camera: 'visitor' });
    // magasról néző látogató: "auto" módban a vezetőkép szemmagasságból készül
    const cam = v.camera, tgt = v.controls.target, keep = cam.position.clone();
    const off = cam.position.clone().sub(tgt), len = off.length();
    cam.position.set(tgt.x + off.x * 0.3, tgt.y + len * 0.9, tgt.z + off.z * 0.3); cam.lookAt(tgt);
    const high = await A.guides(['hero'], 1152, 700, null, { camera: 'visitor' });
    const auto = await A.guides(['hero'], 1152, 700, null, { camera: 'auto' });
    cam.position.copy(keep); cam.lookAt(tgt);
    const rooms = {};
    (v.c.rooms || []).filter(r => r && r.render && r.id).slice(0, 2).forEach(r => { rooms[String(r.id).toLowerCase().replace(/[^a-z0-9_]/g, '')] = { id: String(r.id), type: r.type, area: Number(r.area) || 0 }; });
    const inner = await A.guides(Object.keys(rooms).map(k => 'interior_' + k), 1152, 700, null, { clean: true, rooms: rooms });
    return {
      cleanDiffers: !!live.hero && !!clean.hero && live.hero !== clean.hero,
      autoDiffers: !!high.hero && !!auto.hero && high.hero !== auto.hero,
      rooms: Object.keys(rooms).length,
      inner: Object.keys(inner).map(k => ({ view: k, kb: Math.round(inner[k].length * 0.75 / 1024) })),
    };
  });

  // 2. a generálás tényleg elküldi-e
  await page.$eval('.agh-btn-primary.agh-btn-lg', b => b.click());
  await page.waitForSelector('.agh-dialog-wrap', { timeout: 10000 });
  await page.click('.agh-dialog-foot .agh-btn-primary');
  await page.waitForTimeout(60000);   // a hátralévő nézetek a háttérben készülnek (szoftveres GPU: lassú)

  await browser.close();
  if (errors.length) { console.error(errors.slice(0, 4)); }
  const ok6 = shots.length >= 6 && shots.every(s => s.kb > 8 && s.w >= 1024 && s.h >= 512);
  // a vezetőkép képarányának a kész képéhez kell illeszkednie (a szerver méri, a boot adja)
  const want = wantAspect || 1.645;
  const got = sent && sent[0] && sent[0].h ? sent[0].w / sent[0].h : 0;
  const aspectOk = got > 0 && Math.abs(got - want) <= want * 0.02;
  const sentOk = Array.isArray(sent) && sent.length === 1 && sent[0].view === 'hero' && sent[0].kb > 8 && /image\/(png|jpeg)/.test(sent[0].type);
  const laterOk = Array.isArray(later) && later.filter(v => v.indexOf('interior_') !== 0).length >= 4;
  const laterRooms = Array.isArray(later) ? later.filter(v => v.indexOf('interior_') === 0).length : 0;
  const innerOk = extra.rooms > 0 && extra.inner.length === extra.rooms && extra.inner.every(s => s.kb > 8) && laterRooms > 0;
  const ok = ok6 && sentOk && laterOk && aspectOk && innerOk && extra.cleanDiffers && extra.autoDiffers && !errors.length;
  console.log(`vezetőkép: ${shots.length} nézet, a generálással a hero ment ${sent ? sent.map(s => s.w + 'x' + s.h + '/' + s.kb + 'KB').join(',') : '–'} (képarány ${got.toFixed(3)}, kell ${want.toFixed(3)}, ${aspectOk ? 'ok' : 'eltér'}), utána a galéria nézetei ${later ? later.join(',') : '–'}; tiszta hero ${extra.cleanDiffers ? 'eltér' : 'AZONOS'}, szemmagasság ${extra.autoDiffers ? 'eltér' : 'AZONOS'}, belső vezetőkép ${extra.inner.length}/${extra.rooms} (${extra.inner.map(s => s.kb + 'KB').join(',')}); konzolhiba ${errors.length}`);
  process.exit(ok ? 0 : 1);
})();
