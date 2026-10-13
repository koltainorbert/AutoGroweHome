// Szobák E2E: véletlen konfigurációkkal belső tereket épít a valódi 3D-ben, és megnézi, hogy minden
// tárgy a szobán belül van-e, nem áll-e az ajtóban, és megjelentek-e a kötelező elemek
// (falikép, radiátor, lépcső többszintesnél, a kért tárgyak helyiségenként).
// Használat: node tests/e2e/rooms.js [darab]   (tesztoldal: bin/test-wp.sh)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';
const N = Number(process.argv[2] || 60);

(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 160)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('[data-agh-open]');
  await page.waitForSelector('.agh-shell .agh-preview-box.has-3d canvas', { timeout: 60000 });

  const res = await page.evaluate(async (count) => {
    // ugyanazt a modulpéldányt kérjük, amit a tervező betöltött (a lekérdezéssel együtt), így a 3D már be van állítva
    const url = n => (performance.getEntriesByType('resource').map(e => e.name).filter(x => x.indexOf(n) !== -1)[0] || n);
    const THREE = await import(url('vendor/three/three.module'));
    const INT = await import(url('agh-3d-int.js'));
    const v = window.AGH_3D.viewer();
    const base = window.AGH_Designer.config();
    const TYPES = ['living', 'living_kitchen', 'dining', 'kitchen', 'master', 'bedroom', 'kids', 'office', 'bathroom', 'wc', 'hall', 'stairs', 'laundry', 'wardrobe'];
    const STY = ['modern_minimal', 'scandinavian', 'japandi', 'classic', 'industrial', 'mediterranean', 'luxury', 'wood_stone', 'monochrome', 'warm_neutral'];
    const XF = ['bookshelf', 'chest', 'wall_shelf', 'aquarium', 'desk', 'piano', 'vitrine', 'sideboard'];
    const PET = ['cat', 'dog_small', 'dog_large'];
    const out = { rooms: 0, items: 0, outside: 0, inDoor: 0, noArt: 0, noRad: 0, stairsMissing: 0, stairsRooms: 0, built: {}, fails: [] };
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const pick = a => a[Math.floor(rnd() * a.length)];
    for (let i = 0; i < count; i++) {
      const type = TYPES[i % TYPES.length];
      const cfg = Object.assign({}, base, {
        interior_style: pick(STY), levels: pick(['single', 'attic', 'two', 'three']),
        ceiling_height: 2.5 + Math.round(rnd() * 6) / 10,
        extra_furniture: [pick(XF), pick(XF)], pets: rnd() > 0.6 ? [pick(PET)] : [],
        art_amount: pick(['few', 'normal', 'gallery']), radiators: pick(['auto', 'panel', 'column', 'towel']),
        door_frame: pick(['auto', 'white', 'wood', 'black', 'none']), energy: rnd() > 0.5 ? ['heat_pump'] : ['heat_pump', 'underfloor'],
        aquarium_shape: pick(['small', 'large', 'panorama', 'round', 'cylinder']), aquarium_water: pick(['fresh', 'marine']),
        _int: { type: type }
      });
      let hs = null;
      try { hs = INT.interiorScene(cfg, cfg._int); } catch (e) { out.fails.push(type + ': ' + e.message.slice(0, 80)); continue; }
      const room = hs && hs.room;
      if (!room) { out.fails.push(type + ': nincs szoba'); continue; }
      out.rooms++;
      const W = room.W, D = room.D, H = room.H, door = room.door || { u: 0.3, w: 0.9 };
      const dz = [0, D - door.u - door.w - 0.05, 0.95, D - door.u + 0.05];
      const box = new THREE.Box3();
      let art = 0, rad = 0, stair = 0;
      hs.root.updateMatrixWorld(true);
      ((hs.items && hs.items.children) || []).forEach(o => {
        const b = box.setFromObject(o);
        if (b.isEmpty() || b.max.y < 0.06) { return; }
        out.items++;
        const key = o.userData && (o.userData.item || o.userData.field);
        if (key) { out.built[key] = (out.built[key] || 0) + 1; }
        if (key === 'art_style') { art++; }
        if (key === 'radiators') { rad++; }
        if (key === 'stair_type') { stair++; }
        if (b.min.x < -0.06 || b.max.x > W + 0.06 || b.min.z < -0.06 || b.max.z > D + 0.06 || b.max.y > H + 0.06) { out.outside++; }
        if (b.min.y < 1.3 && b.min.x < dz[2] && b.max.x > dz[0] && b.min.z < dz[3] && b.max.z > dz[1]) { out.inDoor++; }
      });
      const live = ['living', 'living_kitchen', 'dining', 'bed', 'kids', 'office', 'hall'].indexOf(room.kind) !== -1;
      if (live && !art) { out.noArt++; out.artMiss = (out.artMiss || []).concat(room.kind); }
      // padlófűtés + „a gépészet szerint” esetén nem is kell radiátor (a fürdő szárítója kivétel)
      const wetR = room.kind === 'bath' || room.kind === 'wc';
      const wantRad = cfg.radiators !== 'none' && !(cfg.radiators === 'auto' && !wetR && cfg.energy.indexOf('underfloor') !== -1);
      if (!rad && wantRad && ['wardrobe', 'stairs'].indexOf(room.kind) === -1) { out.noRad++; out.radMiss = (out.radMiss || []).concat(room.kind); }
      if (cfg.levels !== 'single' && (room.kind === 'hall' || room.kind === 'stairs')) { out.stairsRooms++; if (!stair) { out.stairsMissing++; } }
    }
    return out;
  }, N);

  await browser.close();
  const bad = res.outside + res.inDoor + res.stairsMissing + res.fails.length + errors.length;
  if (res.fails.length) { console.error(res.fails.slice(0, 5)); }
  if (errors.length) { console.error(errors.slice(0, 5)); }
  if (process.env.VERBOSE) { console.log(res.built, 'kép nélkül:', res.artMiss || [], 'radiátor nélkül:', res.radMiss || []); }
  console.log(`szobák: ${res.rooms} szoba, ${res.items} tárgy, kilóg ${res.outside}, ajtóban ${res.inDoor}, lépcső hiányzik ${res.stairsMissing}/${res.stairsRooms}, kép nélküli lakótér ${res.noArt}, radiátor nélkül ${res.noRad}, konzolhiba ${errors.length}`);
  process.exit(bad ? 1 : 0);
})();
