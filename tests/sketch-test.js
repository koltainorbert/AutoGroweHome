// Élő vázlat – gyors önteszt WordPress és böngésző nélkül: node tests/sketch-test.js
// 1) 800 véletlen (determinisztikus) konfiguráció: nincs NaN/undefined/Infinity, véges, ésszerű viewBox,
//    egyedi azonosítók, renderidő; 2) minden látható paraméter minden értéke megváltoztatja a rajzot ott,
//    ahol a visibleFor szerint látszania kell; 3) kártyaképek (minta, paletta, tájkép) hibamentesek.
const K = require('../assets/js/agh-sketch.js');

const O = {
  property_type: ['detached', 'semi_detached', 'row', 'holiday', 'villa', 'small'], levels: ['single', 'attic', 'two', 'three'],
  arch_style: ['modern_minimal', 'contemporary_lux', 'mediterranean', 'scandinavian', 'bauhaus', 'japandi', 'classic_burgher', 'rustic', 'modern_farmhouse', 'american_farm', 'alpine', 'industrial', 'organic_modern', 'high_tech', 'passive', 'custom'],
  footprint: ['rectangle', 'l_shape', 'u_shape', 'staggered'], garage: ['none', 'carport', 'garage_1', 'garage_2', 'separate'],
  roof_type: ['gable', 'hip', 'half_hip', 'shed', 'pyramid', 'flat', 'multi', 'complex'], gable_finish: ['plaster', 'wood', 'metal', 'glass', 'flush'],
  gutters: ['anthracite', 'black', 'white', 'copper', 'hidden'], roof_surface: ['matt', 'satin', 'glazed', 'green', 'gravel'],
  roof_product: ['', 'bramac-romai-teglavoros', 'bramac-reviva-barna', 'bramac-tectura-antracit', 'bramac-tegalit-terracotta'],
  facade_main: ['render', 'brick', 'clinker', 'stone', 'wood', 'metal', 'concrete', 'panel'], plinth: ['dark_render', 'stone', 'concrete', 'flush'],
  facade_texture: ['fine', 'smooth', 'coarse'], corner_detail: ['sharp', 'quoins', 'glass'],
  window_style: ['classic', 'large', 'panoramic', 'vertical'], window_frame_material: ['pvc', 'aluminium', 'wood', 'wood_alu'],
  terrace_door: ['french', 'sliding', 'lift_slide', 'folding'], entrance_door: ['solid_modern', 'glass_strip', 'wood', 'classic', 'pivot'],
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
const COLORS = ['facade_color', 'roof_color', 'window_frame_color', 'entrance_door_color', 'facade_accent_color', 'plinth_color'];

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
const BASE = { property_type: 'detached', levels: 'two', arch_style: 'modern_minimal', footprint: 'rectangle', garage: 'carport', roof_type: 'gable', facade_main: 'render', facade_accent: ['wood'],
  plinth: 'dark_render', window_style: 'large', terrace_area: 24, terrace_door: 'lift_slide', fence: 'slats', gate: true, driveway: 'pavers', garden_style: 'natural',
  garden_features: ['lawn', 'trees', 'paths', 'garden_lights'], shading: ['blinds'], energy: ['heat_pump'], time_of_day: 'golden', season: 'summer', weather: 'few_clouds',
  camera: 'three_quarter', lens: '24mm', net_area: 160, roof_pitch: 35, facade_color: '#F2EFE9', roof_color: '#3A3D40', window_frame_color: '#2F3235', facade_accent_color: '#B9824F',
  plinth_color: '#4A4D50', entrance_door_color: '#2B2E31', plot_width: 20, plot_length: 40, snow_guards: true, exterior_lighting: true, night_lighting: true,
  gable_finish: 'plaster', gutters: 'anthracite', roof_surface: 'matt', roof_product: '', facade_texture: 'fine', orientation: 'south', glazing: 'clear', window_frame_material: 'aluminium', corner_detail: 'sharp', entrance_door: 'solid_modern', terrace_floor: 'wpc' };

let fail = 0, n = 0, maxMs = 0, total = 0;
const err = (m) => { fail++; if (fail < 15) console.log('HIBA:', m); };
function check(svg, label) {
  n++;
  if (/NaN|undefined|Infinity|null/.test(svg)) err(label + ': NaN/undefined a kimenetben');
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

console.log(`vázlat: ${n} rajz, ${tested} paraméterváltozat (${changed} változott), átlag ${(total / 800).toFixed(1)} ms, max ${maxMs.toFixed(1)} ms, hiba ${fail}`);
process.exit(fail ? 1 : 0);
