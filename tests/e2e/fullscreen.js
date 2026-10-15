// Teljes képernyő E2E (1.12.1): a tervező popup, az élő előnézet (3D) és a nagyított kép teljes
// képernyős gombja, asztali és telefonos méretben, a Fullscreen API-val és a CSS-tartalékkal is.
// Mér: be- és kilépés gombbal és Esc-kel, a vászon mérete a nézetablakhoz (1 px), kilépés után az
// eredeti méret, a kamera helyzete és célpontja a ki-be lépés után, a színválasztó teljes képernyőn
// (elementFromPoint), koppintás a modellre teljes képernyőn, telefonos Vissza a tartaléknál, konzolhiba.
// Használat: node tests/e2e/fullscreen.js   (tesztoldal: bin/test-wp.sh)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';
const ARGS = ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];

const near = (a, b, tol) => Math.abs(a - b) <= tol;
function vecEq(a, b, tol) { return a && b && near(a[0], b[0], tol) && near(a[1], b[1], tol) && near(a[2], b[2], tol); }

async function camOf(page) {
  return page.evaluate(() => {
    const v = window.AGH_3D && window.AGH_3D.viewer();
    if (!v) { return null; }
    const p = v.camera.position, t = v.controls.target;
    return { p: [p.x, p.y, p.z], t: [t.x, t.y, t.z] };
  });
}
async function state(page, sel) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel), fe = document.fullscreenElement || document.webkitFullscreenElement;
    const r = el ? el.getBoundingClientRect() : null;
    const cv = document.querySelector('.agh-preview-box canvas'), cr = cv ? cv.getBoundingClientRect() : null;
    return { native: !!fe && fe === el, css: !!el && el.classList.contains('is-fs-css'), on: !!el && el.classList.contains('is-fs'),
      w: r ? r.width : 0, h: r ? r.height : 0, vw: window.innerWidth, vh: window.innerHeight,
      cw: cr ? cr.width : 0, ch: cr ? cr.height : 0, open: !!document.querySelector('.agh-root'),
      // layout size (without the entry animation's scale) for the before/after comparison
      ow: el ? el.offsetWidth : 0, oh: el ? el.offsetHeight : 0, cow: cv ? cv.offsetWidth : 0, coh: cv ? cv.offsetHeight : 0,
      btn: (document.querySelector(sel + ' .agh-fsbtn, .agh-fsbtn-shell') || {}).getAttribute ? null : null };
  }, sel);
}
// Esc: a CSS-tartaléknál a valódi billentyű; a böngésző saját teljes képernyőjénél az Esc-et maga a
// böngésző kezeli (exitFullscreen), amit a headless Chromium nem végez el, ezért ott két út külön:
// a tervező Esc-kezelője (keydown) és a böngésző saját kilépése (document.exitFullscreen).
async function esc(page, noApi, browserExit) {
  if (noApi) { await page.keyboard.press('Escape'); return; }
  if (browserExit) { await page.evaluate(() => document.exitFullscreen().catch(() => {})); return; }
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
}
// gombnyomás közvetlenül (a SwiftShaderes 3D rajzolás alatt a Playwright stabilitás-várakozása
// több másodpercet hozzáadna a mért időhöz)
async function tap(page, sel) { await page.$eval(sel, b => b.click()); }
// SwiftShaderen egy teljes képernyős 3D képkocka asztali méretben másodpercekig tart, ezért fix
// várakozás helyett az elvárt állapotig várunk (legfeljebb 40 s).
async function settle(page, sel, on) {
  await page.waitForFunction(([sel, on]) => {
    const el = document.querySelector(sel); if (!el) { return !on; }
    const fe = document.fullscreenElement || document.webkitFullscreenElement;
    const isOn = el.classList.contains('is-fs');
    if (on !== isOn) { return false; }
    if (on && !el.classList.contains('is-fs-css') && fe !== el) { return false; }
    if (!on && fe) { return false; }
    const r = el.getBoundingClientRect();
    return !on || (Math.abs(r.width - window.innerWidth) <= 1 && Math.abs(r.height - window.innerHeight) <= 1);
  }, [sel, on], { timeout: 40000, polling: 100 }).catch(() => {});
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}
async function pressed(page, btnSel) {
  return page.evaluate((s) => { const b = document.querySelector(s); return b ? b.getAttribute('aria-pressed') : null; }, btnSel);
}

async function run(browser, mob, noApi) {
  const vp = mob ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const ctx = await browser.newContext({ viewport: vp, hasTouch: mob, isMobile: mob });
  await ctx.addInitScript((noApi) => {
    try { localStorage.clear(); localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {}
    if (noApi) { window.AGH_NO_FULLSCREEN = true; }
  }, noApi);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 160)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('[data-agh-open]');
  await page.waitForSelector('.agh-shell .agh-preview-box.has-3d canvas', { state: 'attached', timeout: 90000 });
  if (mob) { await page.$eval('.agh-mobile-tabs button:nth-child(2)', b => b.click()); }
  await page.waitForTimeout(2500);
  const res = { size: mob ? 'telefon' : 'asztali', mode: noApi ? 'css' : 'api', checks: {}, ms: null };
  const ck = (k, v) => { res.checks[k] = !!v; };

  // ---- 1. élő előnézet (3D)
  const pvSel = '.agh-shell .agh-preview-box';
  // a nézetet elforgatjuk és eltoljuk, hogy a visszaállítás ne az alapállás legyen
  await page.evaluate(() => { const v = window.AGH_3D.viewer(); v.camera.position.x += 2.5; v.camera.position.y += 1.2; v.controls.target.x += 0.8; v.controls.update(); v.requestRender(); });
  await page.waitForTimeout(300);
  const before = await state(page, pvSel), cam0 = await camOf(page);
  // a háttérben előkészülő szobák és kártyák (warmup) végét megvárjuk, hogy a mérés a teljes képernyőt mérje
  for (let i = 0; i < 40; i++) {
    const idle = await page.evaluate(() => new Promise(r => { const t = performance.now(); requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now() - t))); }));
    if (idle < 150) { break; }
  }
  // belépéstől az első új képkockáig: a vászon a nézetablak méretére váltott és lefutott egy rajzolás
  res.ms = await page.evaluate(() => new Promise((done) => {
    const t0 = performance.now(), c = document.querySelector('.agh-preview-box canvas');
    document.querySelector('.agh-fsbtn-pv').click();
    (function wait() {
      if (Math.abs(c.getBoundingClientRect().width - window.innerWidth) <= 1 && Math.abs(c.width / (window.AGH_3D.viewer().renderer.getPixelRatio()) - window.innerWidth) <= 2) { requestAnimationFrame(() => done(Math.round(performance.now() - t0))); return; }
      if (performance.now() - t0 > 8000) { done(-1); return; }
      requestAnimationFrame(wait);
    })();
  }));
  await settle(page, pvSel, true);
  const inPv = await state(page, pvSel);
  ck('pv_be', noApi ? inPv.css : inPv.native);
  ck('pv_vaszon_1px', near(inPv.cw, inPv.vw, 1) && near(inPv.ch, inPv.vh, 1));
  ck('pv_gomb_allapot', (await pressed(page, '.agh-fsbtn-pv')) === 'true');
  // koppintás a modellre teljes képernyőn: a pickAt talál
  const pickOk = await page.evaluate(() => { const v = window.AGH_3D.viewer(), r = v.el.getBoundingClientRect(); for (const fy of [0.45, 0.55, 0.65]) for (const fx of [0.4, 0.5, 0.6]) { if (v.pickAt(r.left + r.width * fx, r.top + r.height * fy)) { return true; } } return false; });
  ck('pv_pick', pickOk);
  // kilépés gombbal
  await tap(page, '.agh-fsbtn-pv');
  await settle(page, pvSel, false);
  await page.waitForFunction(([w, h]) => { const c = document.querySelector('.agh-preview-box canvas'); return c && Math.abs(c.offsetWidth - w) <= 1 && Math.abs(c.offsetHeight - h) <= 1; }, [before.cow, before.coh], { timeout: 40000, polling: 100 }).catch(() => {});
  await page.waitForTimeout(300);
  const outPv = await state(page, pvSel), cam1 = await camOf(page);
  ck('pv_ki_gomb', !outPv.on && !outPv.native && !outPv.css);
  ck('pv_eredeti_meret', near(outPv.cow, before.cow, 1) && near(outPv.coh, before.coh, 1));
  if (!res.checks.pv_eredeti_meret) { res.detail = { before: [before.cow, before.coh], after: [outPv.cow, outPv.coh] }; }
  ck('pv_kamera', vecEq(cam0.p, cam1.p, 0.01) && vecEq(cam0.t, cam1.t, 0.01));
  // be, majd Esc
  await tap(page, '.agh-fsbtn-pv'); await settle(page, pvSel, true);
  await esc(page, noApi, false); await settle(page, pvSel, false);
  const escPv = await state(page, pvSel);
  ck('pv_ki_esc', !escPv.on && escPv.open);
  if (!noApi) {
    await tap(page, '.agh-fsbtn-pv'); await settle(page, pvSel, true);
    await esc(page, noApi, true); await settle(page, pvSel, false);
    const bx = await state(page, pvSel);
    ck('pv_ki_bongeszo', !bx.on && bx.open && (await pressed(page, '.agh-fsbtn-pv')) === 'false');
  }
  // tartalék: a telefon Vissza gombja előbb a teljes képernyőből lép ki, a tervező nyitva marad
  if (noApi) {
    await tap(page, '.agh-fsbtn-pv'); await settle(page, pvSel, true);
    await page.goBack().catch(() => {}); await settle(page, pvSel, false);
    const back = await state(page, pvSel);
    ck('pv_vissza_gomb', !back.on && back.open);
  }

  // ---- 2. a tervező popup egésze: a színválasztó is használható teljes képernyőn
  const shSel = '.agh-root';
  const sh0 = await state(page, '.agh-shell');
  await tap(page, '.agh-fsbtn-shell'); await settle(page, shSel, true);
  const inSh = await state(page, shSel), shell = await state(page, '.agh-shell');
  ck('popup_be', noApi ? inSh.css : inSh.native);
  ck('popup_kitolt', near(shell.w, shell.vw, 1) && near(shell.h, shell.vh, 1));
  const cpOk = await page.evaluate(async () => {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const tab = document.querySelector('.agh-mobile-tabs button'); if (tab && getComputedStyle(document.querySelector('.agh-panel-params')).display === 'none') { tab.click(); await sleep(200); }
    for (const cat of ['facade', 'exterior', 'materials', 'roof', 'interior']) {
      const b = document.querySelector(`.agh-rail button[data-cat="${cat}"]`); if (b) { b.click(); await sleep(200); }
      const cb = document.querySelector('.agh-colorbtn'); if (cb) {
        cb.scrollIntoView({ block: 'center' }); await sleep(150); cb.click(); await sleep(250);
        const cp = document.querySelector('.agh-cp'); if (!cp) { return false; }
        const r = cp.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + Math.min(r.height / 2, 60);
        const hit = document.elementFromPoint(x, y), ok = !!hit && cp.contains(hit);
        cb.click(); await sleep(100);
        return ok;
      }
    }
    return false;
  });
  ck('popup_szinvalaszto', cpOk);
  await esc(page, noApi, false); await settle(page, shSel, false);
  const outSh = await state(page, shSel), sh1 = await state(page, '.agh-shell');
  ck('popup_ki_esc', !outSh.on && outSh.open);
  ck('popup_eredeti_meret', near(sh1.ow, sh0.ow, 1) && near(sh1.oh, sh0.oh, 1));

  await ctx.close();
  res.errors = errors;
  return res;
}

// ---- 3. nagyított kép (galéria): tesztszolgáltatóval generált koncepcióképen
async function runLightbox(browser, mob, noApi) {
  const vp = mob ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const ctx = await browser.newContext({ viewport: vp, hasTouch: mob, isMobile: mob });
  await ctx.addInitScript((noApi) => { try { localStorage.clear(); localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_3d', 'false'); } catch (e) {} if (noApi) { window.AGH_NO_FULLSCREEN = true; } }, noApi);
  const p = await ctx.newPage(); const errors = [];
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  p.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 160)));
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.click('[data-agh-open]'); await p.waitForSelector('.agh-wiz-title');
  for (let i = 0; i < 6; i++) { await p.click('.agh-wiz-next'); await p.waitForTimeout(250); }
  await p.waitForTimeout(800);
  await p.click('.agh-wiz-next');
  await p.waitForSelector('.agh-dialog-wrap', { timeout: 5000 });
  await p.click('.agh-dialog-foot .agh-btn-primary');
  const res = { size: mob ? 'telefon' : 'asztali', mode: noApi ? 'css' : 'api', checks: {} };
  const ck = (k, v) => { res.checks[k] = !!v; };
  const got = await p.waitForSelector('.agh-concept-img.is-ready img, .agh-concept-img img', { timeout: 90000 }).then(() => true).catch(() => false);
  if (!got) { ck('kep_generalva', false); await ctx.close(); res.errors = errors; return res; }
  await p.waitForTimeout(800);
  await p.$eval('.agh-concept', c => c.click());
  await p.waitForSelector('.agh-lightbox', { timeout: 5000 });
  const lbBtn = '.agh-lightbox .agh-fsbtn';
  await tap(p, lbBtn); await settle(p, '.agh-lightbox', true);
  const inLb = await state(p, '.agh-lightbox');
  ck('kep_be', noApi ? inLb.css : inLb.native);
  ck('kep_kitolt', near(inLb.w, inLb.vw, 1) && near(inLb.h, inLb.vh, 1));
  const fit = await p.evaluate(() => { const i = document.querySelector('.agh-lightbox-img img'); return i ? getComputedStyle(i).objectFit : ''; });
  ck('kep_contain', fit === 'contain');
  await esc(p, noApi, false); await settle(p, '.agh-lightbox', false);
  const outLb = await state(p, '.agh-lightbox');
  ck('kep_ki_esc', !outLb.on && !!(await p.$('.agh-lightbox')));
  await tap(p, lbBtn); await settle(p, '.agh-lightbox', true);
  await tap(p, lbBtn); await settle(p, '.agh-lightbox', false);
  const out2 = await state(p, '.agh-lightbox');
  ck('kep_ki_gomb', !out2.on);
  await ctx.close();
  res.errors = errors;
  return res;
}

(async () => {
  const browser = await chromium.launch({ args: ARGS });
  const all = [];
  for (const mob of [false, true]) {
    for (const noApi of [false, true]) {
      // AGH_FS_ONLY=asztali-api|asztali-css|telefon-api|telefon-css: csak egy változat (hibakereséshez)
      if (process.env.AGH_FS_ONLY && process.env.AGH_FS_ONLY !== (mob ? 'telefon' : 'asztali') + '-' + (noApi ? 'css' : 'api')) { continue; }
      all.push(await run(browser, mob, noApi));
      if (!process.env.AGH_FS_NOLB) { all.push(await runLightbox(browser, mob, noApi)); }
    }
  }
  await browser.close();
  let pass = 0, total = 0, errs = 0;
  all.forEach(r => {
    const keys = Object.keys(r.checks), bad = keys.filter(k => !r.checks[k]);
    pass += keys.length - bad.length; total += keys.length; errs += r.errors.length;
    if (bad.length || r.errors.length) { console.error(r.size, r.mode, 'HIBA:', bad.join(','), r.errors.slice(0, 3), JSON.stringify(r.detail || '')); }
  });
  const ms = all.filter(r => r.ms != null).map(r => r.size + '/' + r.mode + ' ' + r.ms + ' ms').join(', ');
  console.log(`teljes képernyő: ${pass}/${total} ellenőrzés, konzolhiba ${errs}; belépéstől az új képkockáig: ${ms}`);
  process.exit(pass === total && !errs ? 0 : 1);
})();
