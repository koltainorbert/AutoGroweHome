// Élő vázlat – gyors önteszt WordPress és böngésző nélkül: node tests/sketch-test.js
// 1) 800 véletlen (determinisztikus) konfiguráció: nincs NaN/undefined/Infinity, véges, ésszerű viewBox,
//    egyedi azonosítók, renderidő; 2) minden látható paraméter minden értéke megváltoztatja a rajzot ott,
//    ahol a visibleFor szerint látszania kell; 3) kártyaképek (minta, paletta, tájkép) hibamentesek.
const K = require('../assets/js/agh-sketch.js');

const O = {
  property_type: ['detached', 'semi_detached', 'row', 'holiday', 'villa', 'small'], levels: ['single', 'attic', 'two', 'three'],
  arch_style: ['modern_minimal', 'contemporary_lux', 'mediterranean', 'scandinavian', 'bauhaus', 'japandi', 'classic_burgher', 'rustic', 'modern_farmhouse', 'american_farm', 'alpine', 'industrial', 'organic_modern', 'high_tech', 'passive', 'custom'],
  massing: ['auto', 'pavilion', 'cantilever', 'courtyard', 'gable_pair', 'cubes', 'engawa', 'symmetric', 'long_house', 'twin_barns', 'cross_gable', 'chalet', 'loft', 'organic', 'glass_frame', 'compact'],
  footprint: ['rectangle', 'l_shape', 'u_shape', 'staggered'], garage: ['none', 'carport', 'garage_1', 'garage_2', 'separate'],
  roof_type: ['gable', 'hip', 'half_hip', 'shed', 'pyramid', 'flat', 'multi', 'complex'], gable_finish: ['plaster', 'wood', 'metal', 'glass', 'flush'],
  gutters: ['anthracite', 'black', 'white', 'copper', 'hidden'], roof_surface: ['matt', 'satin', 'glazed', 'green', 'gravel'],
  roof_product: ['', 'bramac-romai-teglavoros', 'bramac-reviva-barna', 'bramac-tectura-antracit', 'bramac-tegalit-terracotta'],
  facade_main: ['render', 'brick', 'clinker', 'stone', 'wood', 'metal', 'concrete', 'panel'], plinth: ['dark_render', 'stone', 'concrete', 'flush'],
  facade_texture: ['fine', 'smooth', 'coarse'], corner_detail: ['sharp', 'quoins', 'glass'],
  window_style: ['classic', 'large', 'panoramic', 'vertical', 'arched', 'square', 'ribbon', 'bay'], window_frame_material: ['pvc', 'aluminium', 'wood', 'wood_alu'], window_trim: ['auto', 'none', 'white', 'light', 'dark', 'stone'],
  terrace_door: ['french', 'sliding', 'lift_slide', 'folding'], entrance_door: ['solid_modern', 'glass_strip', 'wood', 'classic', 'pivot', 'double', 'glass_full', 'half_glass', 'slat', 'sidelight'],
  chimney_type: ['auto', 'brick', 'render', 'stone', 'steel', 'clad', 'wide'], solar_type: ['black_mono', 'blue_poly', 'in_roof', 'solar_tile', 'glass'], solar_coverage: ['small', 'medium', 'full'],
  roof_vent_type: ['tile_vent', 'ridge_vent', 'turbine', 'mushroom', 'pipe', 'solar_fan'], ridge_tile: ['round', 'angular', 'mortar', 'dry', 'metal', 'none'], ac_units: ['none', 'wall', 'ground', 'screened', 'roof'],
  glazing: ['clear', 'tinted', 'frosted'], garden_style: ['natural', 'formal', 'minimal', 'cottage', 'mediterranean'],
  terrace_floor: ['wpc', 'wood', 'stone', 'ceramic'], driveway: ['pavers', 'gravel', 'grass', 'asphalt'], fence: ['none', 'slats', 'mesh', 'masonry', 'gabion'],
  time_of_day: ['morning', 'midday', 'golden', 'blue', 'night'], season: ['spring', 'summer', 'autumn', 'winter'], weather: ['clear', 'few_clouds', 'overcast'],
  camera: ['three_quarter', 'frontal', 'low', 'elevated'], lens: ['24mm', '35mm', '50mm'], orientation: ['south', 'south_west', 'south_east', 'west', 'east', 'north'],
};
const MULTI = {
  facade_accent: ['wood', 'stone', 'brick', 'metal', 'concrete', 'render_dark'], shading: ['blinds', 'shutters', 'louvres', 'spalettas', 'pergola'],
  garden_features: ['lawn', 'trees', 'hedge', 'flowerbeds', 'paths', 'garden_lights', 'pool', 'pergola', 'outdoor_kitchen', 'firepit', 'playground', 'shed', 'robot_mower', 'outdoor_shower', 'garden_furniture'],
  energy: ['heat_pump', 'underfloor', 'ceiling_cool', 'ac', 'solar', 'battery', 'ev_charger', 'mvhr', 'rainwater', 'smart_home', 'led'],
};
const BOOL = ['balcony', 'entrance_canopy', 'outdoor_covered', 'basement', 'chimney', 'roof_solar', 'snow_guards', 'roof_ventilation', 'exposed_rafters', 'facade_ornaments', 'exterior_lighting', 'house_number', 'window_divided', 'corner_window', 'gate', 'neighbors', 'night_lighting', 'exterior_steps', 'accessible'];
const NUM = { net_area: [40, 600], terrace_area: [0, 60], roof_pitch: [5, 60], roof_overhang: [0, 1.5], eaves_depth: [0, 2], roof_windows: [0, 6], dormers: [0, 4], ceiling_height: [2.4, 4], building_width: [0, 30], building_length: [0, 20], plot_width: [0, 60], plot_length: [0, 80], ridge_height: [0, 14] };
const COLORS = ['facade_color', 'roof_color', 'window_frame_color', 'entrance_door_color', 'facade_accent_color', 'plinth_color', 'shutter_color'];

let seed = 12345;
const rnd = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const hex = () => '#' + Math.floor(rnd() * 0xFFFFFF).toString(16).padStart(6, '0').toUpperCase();
function randomCfg() {
  const c = {};
  for (const k in O) c[k] = pick(O[k]);
  for (const k in MULTI) c[k] = MULTI[k].filter(() => rnd() < 0.3);
  for (const k of BOOL) c[k] = rnd() < 0.5;
  for (const k in NUM) { const [a, b] = NUM[k]; c[k] = Math.round((a + rnd() * (b - a)) * 10) / 10; }
  for (const k of COLORS) c[k] = hex();
  return c;
}
const BASE = { property_type: 'detached', levels: 'two', arch_style: 'modern_minimal', massing: 'auto', footprint: 'rectangle', garage: 'carport', roof_type: 'gable', facade_main: 'render', facade_accent: ['wood'],
  plinth: 'dark_render', window_style: 'large', terrace_area: 24, terrace_door: 'lift_slide', fence: 'slats', gate: true, driveway: 'pavers', garden_style: 'natural',
  garden_features: ['lawn', 'trees', 'paths', 'garden_lights'], shading: ['blinds'], energy: ['heat_pump'], ac_units: 'wall', ridge_tile: 'mortar', time_of_day: 'golden', season: 'summer', weather: 'few_clouds',
  camera: 'three_quarter', lens: '24mm', net_area: 160, roof_pitch: 35, facade_color: '#F2EFE9', roof_color: '#3A3D40', window_frame_color: '#2F3235', facade_accent_color: '#B9824F',
  plinth_color: '#4A4D50', entrance_door_color: '#2B2E31', plot_width: 20, plot_length: 40, snow_guards: true, exterior_lighting: true, night_lighting: true,
  gable_finish: 'plaster', gutters: 'anthracite', roof_surface: 'matt', roof_product: '', facade_texture: 'fine', orientation: 'south', glazing: 'clear', window_frame_material: 'aluminium', window_trim: 'white', corner_detail: 'sharp', entrance_door: 'solid_modern', terrace_floor: 'wpc' };

let fail = 0, n = 0, maxMs = 0, total = 0;
const err = (m) => { fail++; if (fail < 15) console.log('HIBA:', m); };
function check(svg, label) {
  n++;
  { const mm = svg.match(/.{0,60}(NaN|undefined|Infinity|null).{0,40}/); if (mm) err(label + ': NaN/undefined a kimenetben: ' + mm[0]); }
  const vb = (svg.match(/viewBox="([^"]+)"/) || [])[1];
  const p = vb ? vb.split(' ').map(Number) : [];
  if (p.length !== 4 || p.some(x => !isFinite(x)) || p[2] <= 0 || p[3] <= 0) err(label + ': hibás viewBox ' + vb);
  else if (p[2] / p[3] > 4.5 || p[3] / p[2] > 3) err(label + ': torz arány ' + vb);
  const ids = (svg.match(/ id="[^"]+"/g) || []);
  if (new Set(ids).size !== ids.length) err(label + ': ismétlődő id');
  const refs = (svg.match(/url\(#([^)]+)\)/g) || []).map(r => r.slice(5, -1));
  for (const r of refs) if (!ids.includes(' id="' + r + '"')) { err(label + ': hiányzó hivatkozás #' + r); break; }
}
// 1) random configurations
for (let i = 0; i < 800; i++) {
  const c = randomCfg();
  const t0 = process.hrtime.bigint();
  const svg = K.render(c, { id: 'r' + i + '_', mini: i % 4 === 0 });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6; total += ms; maxMs = Math.max(maxMs, ms);
  check(svg, 'véletlen #' + i);
}
// 2) every value of every visible parameter, from a realistic base
let tested = 0, changed = 0;
const base = K.render(BASE, { id: 'b' });
const variants = [];
for (const k in O) for (const v of O[k]) if (v !== BASE[k]) variants.push([k, v, null]);
for (const k in MULTI) for (const v of MULTI[k]) { const cur = BASE[k] || []; variants.push([k, cur.includes(v) ? cur.filter(x => x !== v) : cur.concat([v]), v]); }
for (const k of BOOL) variants.push([k, !BASE[k], null]);
for (const k in NUM) { const [a, b] = NUM[k]; variants.push([k, Math.round((a + (b - a) * 0.7) * 10) / 10, null]); }
for (const k of COLORS) variants.push([k, '#2E6B8F', null]);
for (const [k, v, item] of variants) {
  const c = Object.assign({}, BASE, { [k]: v });
  if (!K.visibleFor(k, c, item) && !K.visibleFor(k, BASE, item)) continue;
  tested++;
  const svg = K.render(c, { id: 'b' });
  check(svg, k + '=' + JSON.stringify(v));
  if (svg !== base) changed++; else err('nem változik a vázlat: ' + k + ' = ' + JSON.stringify(v));
}
// 3) card visuals
for (const v of O.facade_main) check(K.swatch('facade', v, BASE), 'minta ' + v);
for (const v of ['parquet', 'herringbone', 'laminate', 'vinyl', 'tiles_large', 'stone', 'microcement', 'concrete']) check(K.swatch('floor', v, BASE), 'padló ' + v);
for (const v of ['modern_minimal', 'luxury', 'scandinavian', 'japandi', 'classic', 'mediterranean', 'industrial', 'wood_stone', 'warm_neutral', 'monochrome', 'custom']) check(K.palette(v), 'paletta ' + v);
for (const v of O.garden_style) check(K.vignette('garden', v, BASE), 'kert ' + v);
for (const v of O.time_of_day) check(K.vignette('time', v, BASE), 'napszak ' + v);
const distinct = (list) => new Set(list).size === list.length;
if (!distinct(O.roof_type.map(v => K.render(Object.assign({}, BASE, { roof_type: v }), { mini: true, id: 'm' })))) err('a tetőforma-kártyák nem mind különbözők');
if (!distinct(O.facade_main.map(v => K.swatch('facade', v, BASE)))) err('a homlokzat-minták nem mind különbözők');
// every massing gives a different building with each roof family, also as a card (mini)
for (const rt of ['flat', 'gable', 'hip']) {
  if (!distinct(O.massing.map(v => K.render(Object.assign({}, BASE, { massing: v, roof_type: rt }), { mini: true, id: 'm' })))) err('a tömegforma-kártyák nem mind különbözők (' + rt + ')');
  for (const v of O.massing) for (const lv of ['single', 'attic', 'two', 'three']) check(K.render(Object.assign({}, BASE, { massing: v, roof_type: rt, levels: lv, garden_features: ['lawn', 'pool', 'trees', 'paths', 'shed'] }), { id: 'x' }), 'tömeg ' + v + '/' + rt + '/' + lv);
}

let gardenSummary = '';
// 4) garden plan: plants inside the plot, never on paving or in the house, the pool inside the plot
{
  const S = {}; for (const st of O.arch_style) S[st] = { massing: O.massing[(O.arch_style.indexOf(st) % (O.massing.length - 1)) + 1], roof_type: ['flat', 'gable', 'hip'][O.arch_style.indexOf(st) % 3] };
  let n = 0, bad = [], plants = 0;
const styles = Object.keys(S), gss = ['natural', 'formal', 'minimal', 'cottage', 'mediterranean'];
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
for (let i = 0; i < 600; i++) {
  const st = styles[i % styles.length];
  const c = Object.assign({ net_area: 80 + Math.round(rnd() * 200), terrace_area: rnd() < 0.7 ? Math.round(rnd() * 40) : 0, garage: ['none', 'carport', 'garage_1', 'garage_2', 'separate'][Math.floor(rnd() * 5)], plot_width: rnd() < 0.8 ? 14 + Math.round(rnd() * 25) : 0, plot_length: 25 + Math.round(rnd() * 30), fence: ['none', 'slats', 'mesh', 'masonry'][Math.floor(rnd() * 4)] }, S[st], { arch_style: st, garden_style: gss[Math.floor(rnd() * 5)], garden_features: ['lawn', 'trees', 'paths', 'flowerbeds', 'pool', 'hedge', 'shed', 'firepit', 'garden_furniture', 'playground', 'garden_lights'].filter(() => rnd() < 0.6), levels: ['single', 'attic', 'two'][Math.floor(rnd() * 3)] });
  const pl = K.plan(c), vols = K._volumes(c, pl), bb = K._siteBox(vols);
  const gW = c.garage === 'garage_2' ? 6.2 : 3.4, gx0 = c.garage === 'separate' ? bb.x1 + 2.2 : bb.x1 + 0.4, gD = 6.2;
  const gar = c.garage !== 'none' ? { x0: gx0, x1: gx0 + gW, y0: (c.garage === 'separate' ? pl.D * 0.8 : Math.min(pl.D, gD)) - gD, y1: c.garage === 'separate' ? pl.D * 0.8 : Math.min(pl.D, gD) } : null;
  let front = bb.y1 + 6.5, back = bb.y0 - 6, left = bb.x0 - 6.5, right = (gar ? gar.x1 : bb.x1) + 6;
  const plot = K._plot(c, vols, gar ? gar.x1 : bb.x1 + 3.8);
  if (plot) { left = Math.min(left, plot.x0 - 1.2); right = Math.max(right, plot.x1 + 1.2); front = Math.max(front, plot.yF + 1.2); if (plot.yB !== null) back = Math.min(back, plot.yB - 1.2); }
  const ter = c.terrace_area > 0 ? K._terrace(c, vols[0], vols, c.terrace_area) : null;
  const G = K._garden(c, vols, pl, { left, right, front, back }, plot, gar, ter, K._siteEdge(c, front, plot));
  const hardR = [ter, G.path, G.drive, G.pool, gar].filter(Boolean);
  const A = G.area;
  for (const p of G.plants) {
    plants++;
    const r = p.kind === 'flower' ? 0.1 : (['grass', 'lavender'].includes(p.kind) ? 0.3 : (['shrub', 'topiary'].includes(p.kind) ? p.size * 0.38 : (p.kind === 'cypress' ? 0.5 : Math.min(2, p.size * 0.26))));
    if (p.x - r < A.x0 - 0.01 || p.x + r > A.x1 + 0.01 || p.y - r < A.y0 - 0.01 || p.y + r > A.y1 + 0.01) bad.push(i + ' kilóg ' + p.kind);
    for (const h of hardR) { const dx = Math.max(h.x0 - p.x, 0, p.x - h.x1), dy = Math.max(h.y0 - p.y, 0, p.y - h.y1); if (dx * dx + dy * dy < r * r) bad.push(i + ' burkolaton ' + p.kind); }
    for (const v of vols) { if (p.x > v.x0 && p.x < v.x1 && p.y > v.y0 && p.y < v.y1) bad.push(i + ' házban ' + p.kind); }
  }
  for (const k of ['shed', 'playground', 'pergola']) { const r = G[k]; if (r && (r.x0 < A.x0 - 0.01 || r.x1 > A.x1 + 0.01 || r.y0 < A.y0 - 0.01 || r.y1 > A.y1 + 0.01)) bad.push(i + ' kilóg ' + k); }
  if (G.pool && plot && (G.pool.x0 < plot.x0 || G.pool.x1 > plot.x1 || G.pool.y1 > plot.yF)) bad.push(i + ' medence kilóg');
  n++;
}
  if (bad.length) err('kert: ' + bad.length + ' hibás elhelyezés, pl. ' + bad.slice(0, 3).join('; '));
  gardenSummary = n + ' kert, ' + plants + ' növény';
}
// 5) 1.22.0: pool and garage in detail – every new value changes the drawing, and what does not fit is said
let detailN = 0, fitN = 0;
{
  const B2 = Object.assign({}, BASE, { garage: 'garage_2', garden_features: BASE.garden_features.concat(['pool']), plot_width: 34, plot_length: 52 });
  const base2 = K.render(B2, { id: 'b' });
  const V2 = { pool_shape: ['l_shape', 'oval', 'infinity', 'plunge', 'jacuzzi'], pool_finish: ['white', 'grey_stone', 'sand', 'black'], pool_cover: ['slatted', 'telescopic', 'roller'], pool_deck: ['stone', 'wood', 'wpc'], pool_depth: [2.6],
    garage_spaces: [3], garage_width: [8.5], garage_depth: [7.5], garage_roof: ['gable', 'shed', 'green'], garage_facade: ['wood', 'brick', 'metal', 'stone'], garage_door: ['roller', 'tilt', 'side_hinged', 'glass'], garage_door_color: ['#8A2E2E'], garage_window: [true], garage_side_door: [true], garage_rooms: [['workshop']] };
  for (const k in V2) for (const v of V2[k]) {
    const c = Object.assign({}, B2, { [k]: v });
    if (!K.visibleFor(k, c, null)) { err('1.22: ' + k + ' nem látszik a vázlaton'); continue; }
    const svg = K.render(c, { id: 'b' }); check(svg, k + '=' + JSON.stringify(v)); detailN++;
    if (svg === base2) err('1.22: nem változik a vázlat: ' + k + ' = ' + JSON.stringify(v));
  }
  // the pool size: as asked when it fits (water inside the surround), a message with the largest that fits when not
  const pc = Object.assign({}, B2, { pool_length: 8, pool_width: 4 });
  const pc1 = K._siteFit(pc); if (pc1.some(m => m.field === 'pool_length')) err('1.22: a 8 × 4 m-es medence elfér, mégis jelez'); else fitN++;
  const big = Object.assign({}, B2, { pool_length: 15, pool_width: 8, plot_width: 18, plot_length: 30 });
  const pb = K._siteFit(big).filter(m => m.field === 'pool_length')[0]; if (!pb) err('1.22: a 15 × 8 m-es medence kis telken nem jelez'); else fitN++;
  const gbig = Object.assign({}, B2, { garage_width: 16, plot_width: 18 });
  if (!K._siteFit(gbig).some(m => m.field === 'garage')) err('1.22: a 16 m-es garázs 18 m-es telken nem jelez'); else fitN++;
}
// 6) 1.23.0: outbuildings – three on one plot without overlap, inside the garden, drawn; one too big is said
let obN = 0;
{
  const OB = [{ type: 'workshop', w: 5, d: 4, h: 2.8, roof: 'gable', roof_mat: 'tile', wall: 'brick', door: 'double', windows: 2, items: ['workbench'] }, { type: 'garage', w: 3.4, d: 6, h: 2.6, roof: 'flat', wall: 'render', door: 'garage', items: ['car'] }, { type: 'greenhouse', w: 3, d: 2.5, h: 2.2, roof: 'gable', wall: 'glass', door: 'sliding', items: ['plants'] }];
  for (let i = 0; i < 40; i++) {
    const c = Object.assign({}, BASE, { garage: ['none', 'carport', 'garage_1'][i % 3], plot_width: 26 + (i % 5) * 2, plot_length: 44 + (i % 4) * 3, net_area: 90 + (i % 6) * 20, outbuildings: OB.slice(0, 1 + (i % 3)).map((o, k) => Object.assign({}, o, { roof: ['gable', 'shed', 'flat', 'green'][(i + k) % 4] })) });
    const svg = K.render(c, { id: 'o' + i }); check(svg, 'melléképület #' + i);
    if (svg === K.render(Object.assign({}, c, { outbuildings: [] }), { id: 'o' + i })) err('1.23: a melléképület nem látszik #' + i);
    const pl = K.plan(c), vols = K._volumes(c, pl), bb = K._siteBox(vols), GR = K._garageRect(c, vols, pl);
    const plot = K._plot(c, vols, GR ? GR.base : bb.x1 + 3.8);
    let front = bb.y1 + 6.5, back = bb.y0 - 6, left = bb.x0 - 6.5, right = (GR ? GR.x1 : bb.x1) + 6;
    if (plot) { left = Math.min(left, plot.x0 - 1.2); right = Math.max(right, plot.x1 + 1.2); front = Math.max(front, plot.yF + 1.2); if (plot.yB !== null) back = Math.min(back, plot.yB - 1.2); }
    const G = K._garden(c, vols, pl, { left, right, front, back }, plot, GR ? { x0: GR.x0, x1: GR.x1, y0: GR.y0, y1: GR.y1 } : null, null, K._siteEdge(c, front, plot));
    const o = G.outs || [], A = G.area;
    if (o.length + (G.outFail || []).length !== c.outbuildings.length) err('1.23: elveszett melléképület #' + i);
    for (let a = 0; a < o.length; a++) {
      const p = o[a];
      if (p.x0 < A.x0 - 0.01 || p.x1 > A.x1 + 0.01 || p.y0 < A.y0 - 0.01 || p.y1 > A.y1 + 0.01) err('1.23: kilóg #' + i);
      for (const v of vols) if (p.x0 < v.x1 && p.x1 > v.x0 && p.y0 < v.y1 && p.y1 > v.y0) err('1.23: a házon #' + i);
      for (let b2 = a + 1; b2 < o.length; b2++) { const q = o[b2]; if (p.x0 < q.x1 && p.x1 > q.x0 && p.y0 < q.y1 && p.y1 > q.y0) err('1.23: átfedés #' + i); }
    }
    if ((G.outFail || []).length && !K._siteFit(c).some(m => m.key === 'fit_out')) err('1.23: el nem férő melléképület jelzés nélkül #' + i);
    obN += o.length;
  }
  const big = Object.assign({}, BASE, { plot_width: 16, plot_length: 20, outbuildings: [{ type: 'barn', w: 12, d: 12 }] });
  if (!K._siteFit(big).some(m => m.key === 'fit_out')) err('1.23: a 12 × 12 m-es pajta kis telken nem jelez');
}
console.log(`vázlat: ${n} rajz, ${tested} paraméterváltozat (${changed} változott), átlag ${(total / 800).toFixed(1)} ms, max ${maxMs.toFixed(1)} ms, ${gardenSummary}, medence/garázs ${detailN} változat, elfér-ellenőrzés ${fitN}/3, melléképület ${obN} elhelyezve, hiba ${fail}`);
process.exit(fail ? 1 : 0);
