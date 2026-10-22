/*!
 * AutoGroweHome – 3D interiors: furnished cut-away rooms and studio shots of single items
 * Koltai Norbert – Infostudio
 *
 * Every piece is modelled from the visitor's settings: upholstered sofas with seat and back cushions,
 * beds with bedding, tables, chairs, wardrobes, lamps, plants, fireplaces, stairs, doors, curtains and
 * blinds, bathroom fittings (tubs, showers, basins, vanities, toilets, mirrors, taps) and kitchens.
 * Materials are physical: woven fabrics with sheen, leather, wood veneer, marble, glazed ceramics,
 * brushed and polished metals, glass and mirrors. The same builders draw the rooms of the live preview
 * and the pictures of the option cards, so a card always shows what the room will get.
 *
 * Local item coordinates (three.js): x to the right, y up, z towards the viewer; the origin is the
 * centre of the item's footprint on the floor. Rooms use the sketch axes (x right, y towards the
 * viewer, z up); place() puts an item there.
 */
import * as THREE from './vendor/three/three.module.min.js';

var L = null;   // helpers of agh-3d.js (setup)
export function setup(lib) { L = lib; }
// Materials of a configuration (for the vehicles, people and pets on the site).
export function mats(c) { return Mats(c); }
var D2R = Math.PI / 180;

/* ================================================================== choices
 * "auto" = what suits the interior style. Every field lists its options in the order of the cards. */
var AUTO = {
	modern_minimal: { sofa_type: 'straight', armchair_type: 'barrel', coffee_table: 'travertine', media_wall: 'lowboard', dining_table: 'oval_marble', dining_chairs: 'cantilever', bed_type: 'upholstered', wardrobe_type: 'sliding', rug_style: 'plain', art_style: 'abstract', plants: 'snake', pendant_style: 'linear', ceiling_lights: 'spots', floor_lamp: 'arc', door_style: 'hidden', stair_type: 'floating', window_treatment: 'roller', bathtub_type: 'freestanding', shower_type: 'walkin', basin_type: 'vessel', vanity_type: 'floating', toilet_type: 'wall_hung', mirror_type: 'led', upper_cabinets: 'closed', hood_style: 'integrated', bar_stools: 'metal' },
	luxury: { sofa_type: 'curved', armchair_type: 'club', coffee_table: 'marble', media_wall: 'stone', dining_table: 'oval_marble', dining_chairs: 'upholstered', bed_type: 'upholstered', wardrobe_type: 'glass', rug_style: 'plain', art_style: 'abstract', plants: 'palm', pendant_style: 'chandelier', ceiling_lights: 'cove', floor_lamp: 'arc', door_style: 'panel', stair_type: 'floating', window_treatment: 'drapes', bathtub_type: 'freestanding', shower_type: 'walkin', basin_type: 'integrated', vanity_type: 'washstand', toilet_type: 'smart', mirror_type: 'arched', upper_cabinets: 'glass', hood_style: 'island', bar_stools: 'upholstered' },
	scandinavian: { sofa_type: 'straight', armchair_type: 'lounge', coffee_table: 'wood', media_wall: 'lowboard', dining_table: 'rect_wood', dining_chairs: 'wishbone', bed_type: 'wood', wardrobe_type: 'hinged', rug_style: 'berber', art_style: 'line', plants: 'fiddle', pendant_style: 'dome', ceiling_lights: 'flush', floor_lamp: 'tripod', door_style: 'flush', stair_type: 'floating', window_treatment: 'sheer', bathtub_type: 'built_in', shower_type: 'walkin', basin_type: 'vessel', vanity_type: 'wood', toilet_type: 'wall_hung', mirror_type: 'round', upper_cabinets: 'open', hood_style: 'chimney', bar_stools: 'wood' },
	japandi: { sofa_type: 'modular', armchair_type: 'cane', coffee_table: 'wood', media_wall: 'lowboard', dining_table: 'rect_wood', dining_chairs: 'wishbone', bed_type: 'platform', wardrobe_type: 'sliding', rug_style: 'jute', art_style: 'line', plants: 'olive', pendant_style: 'paper', ceiling_lights: 'cove', floor_lamp: 'column', door_style: 'pocket', stair_type: 'floating', window_treatment: 'roman', bathtub_type: 'japanese', shower_type: 'wetroom', basin_type: 'vessel', vanity_type: 'wood', toilet_type: 'wall_hung', mirror_type: 'pill', upper_cabinets: 'closed', hood_style: 'integrated', bar_stools: 'wood' },
	classic: { sofa_type: 'chesterfield', armchair_type: 'wingback', coffee_table: 'ottoman', media_wall: 'built_in', dining_table: 'oval_marble', dining_chairs: 'upholstered', bed_type: 'upholstered', wardrobe_type: 'hinged', rug_style: 'oriental', art_style: 'landscape', plants: 'palm', pendant_style: 'chandelier', ceiling_lights: 'flush', floor_lamp: 'tripod', door_style: 'panel', stair_type: 'closed', window_treatment: 'drapes', bathtub_type: 'clawfoot', shower_type: 'enclosure', basin_type: 'undermount', vanity_type: 'floor', toilet_type: 'floor', mirror_type: 'arched', upper_cabinets: 'glass', hood_style: 'chimney', bar_stools: 'upholstered' },
	mediterranean: { sofa_type: 'modular', armchair_type: 'cane', coffee_table: 'travertine', media_wall: 'built_in', dining_table: 'trestle', dining_chairs: 'wishbone', bed_type: 'wood', wardrobe_type: 'hinged', rug_style: 'jute', art_style: 'landscape', plants: 'olive', pendant_style: 'rattan', ceiling_lights: 'none', floor_lamp: 'tripod', door_style: 'arched', stair_type: 'concrete', window_treatment: 'sheer', bathtub_type: 'freestanding', shower_type: 'niche', basin_type: 'vessel', vanity_type: 'wood', toilet_type: 'wall_hung', mirror_type: 'arched', upper_cabinets: 'open', hood_style: 'chimney', bar_stools: 'rattan' },
	industrial: { sofa_type: 'corner', armchair_type: 'club', coffee_table: 'wood', media_wall: 'built_in', dining_table: 'live_edge', dining_chairs: 'metal', bed_type: 'metal', wardrobe_type: 'open', rug_style: 'oriental', art_style: 'gallery', plants: 'snake', pendant_style: 'dome', ceiling_lights: 'track', floor_lamp: 'tripod', door_style: 'barn', stair_type: 'steel', window_treatment: 'venetian', bathtub_type: 'built_in', shower_type: 'walkin', basin_type: 'vessel', vanity_type: 'washstand', toilet_type: 'wall_hung', mirror_type: 'round', upper_cabinets: 'open', hood_style: 'chimney', bar_stools: 'metal' },
	wood_stone: { sofa_type: 'corner', armchair_type: 'lounge', coffee_table: 'travertine', media_wall: 'stone', dining_table: 'live_edge', dining_chairs: 'upholstered', bed_type: 'wood', wardrobe_type: 'fluted', rug_style: 'berber', art_style: 'abstract', plants: 'fiddle', pendant_style: 'cluster', ceiling_lights: 'cove', floor_lamp: 'arc', door_style: 'flush', stair_type: 'floating', window_treatment: 'drapes', bathtub_type: 'freestanding', shower_type: 'walkin', basin_type: 'vessel', vanity_type: 'wood', toilet_type: 'wall_hung', mirror_type: 'round', upper_cabinets: 'closed', hood_style: 'integrated', bar_stools: 'wood' },
	warm_neutral: { sofa_type: 'modular', armchair_type: 'barrel', coffee_table: 'marble', media_wall: 'built_in', dining_table: 'round', dining_chairs: 'upholstered', bed_type: 'upholstered', wardrobe_type: 'fluted', rug_style: 'plain', art_style: 'abstract', plants: 'olive', pendant_style: 'globe', ceiling_lights: 'cove', floor_lamp: 'column', door_style: 'flush', stair_type: 'floating', window_treatment: 'sheer', bathtub_type: 'freestanding', shower_type: 'walkin', basin_type: 'integrated', vanity_type: 'floating', toilet_type: 'wall_hung', mirror_type: 'pill', upper_cabinets: 'closed', hood_style: 'integrated', bar_stools: 'upholstered' },
	monochrome: { sofa_type: 'straight', armchair_type: 'club', coffee_table: 'glass', media_wall: 'lowboard', dining_table: 'glass', dining_chairs: 'cantilever', bed_type: 'panel', wardrobe_type: 'glass', rug_style: 'plain', art_style: 'line', plants: 'snake', pendant_style: 'linear', ceiling_lights: 'spots', floor_lamp: 'arc', door_style: 'hidden', stair_type: 'steel', window_treatment: 'roller', bathtub_type: 'built_in', shower_type: 'walkin', basin_type: 'integrated', vanity_type: 'floating', toilet_type: 'wall_hung', mirror_type: 'led', upper_cabinets: 'closed', hood_style: 'box', bar_stools: 'metal' }
};
export var FIELDS = Object.keys(AUTO.warm_neutral).concat(['fireplace', 'ceiling', 'wall_finish', 'bath_tiles', 'taps', 'fronts', 'handles', 'worktop', 'sink', 'backsplash', 'furniture_style', 'kitchen_layout', 'bath_fixtures', 'window_trim_int']);
// The value of a choice for this configuration ("auto" or unset → the interior style's choice).
export function pick(c, id) {
	var v = c[id];
	if (v && v !== 'auto') { return v; }
	var bf = c.bath_fixtures || ['walkin', 'double_basin', 'wc'], a = AUTO[c.interior_style] || AUTO.warm_neutral;
	// bathroom: which fittings there are comes from the fixtures list, their kind from the style
	if (id === 'bathtub_type' && Array.isArray(bf)) { if (bf.indexOf('freestanding') !== -1) { return a.bathtub_type === 'clawfoot' ? 'clawfoot' : 'freestanding'; } if (bf.indexOf('bathtub') === -1) { return 'none'; } return a.bathtub_type === 'freestanding' || a.bathtub_type === 'clawfoot' ? 'built_in' : a.bathtub_type; }
	if (id === 'shower_type' && Array.isArray(bf)) { if (bf.indexOf('walkin') !== -1) { return ['walkin', 'wetroom', 'niche'].indexOf(a.shower_type) !== -1 ? a.shower_type : 'walkin'; } if (bf.indexOf('shower') !== -1) { return 'enclosure'; } return 'none'; }
	if (id === 'hood_style' && Array.isArray(c.appliances) && c.appliances.indexOf('hood_hidden') !== -1) { return 'integrated'; }
	return a[id] || 'none';
}

/* ================================================================== geometry */
function G() { return new THREE.Group(); }
function M(geo, mat, cast) { var m = new THREE.Mesh(geo, mat); m.castShadow = cast !== false; m.receiveShadow = true; return m; }
function add(g, m) { if (m) { g.add(m); } return m; }
function at(m, x, y, z) { m.position.set(x, y, z); return m; }
var RBC = {};
// Box with rounded edges and corners (radius r, s steps per quarter arc), UVs in metres.
function rbGeo(w, h, d, r, s) {
	r = Math.max(0.0005, Math.min(r, w / 2 - 0.0005, h / 2 - 0.0005, d / 2 - 0.0005)); s = s || 2;
	var key = [w, h, d, r].map(function (v) { return Math.round(v * 2000); }).join('x') + 's' + s;
	if (RBC[key]) { return RBC[key]; }
	var seg = s * 2 + 1, g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg), pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
	var half = 0.5 / seg, ix = w / 2 - r, iy = h / 2 - r, iz = d / 2 - r, p = new THREE.Vector3(), n = new THREE.Vector3();
	for (var i = 0; i < pos.count; i++) {
		p.fromBufferAttribute(pos, i); n.copy(p);
		n.x -= Math.sign(n.x) * half; n.y -= Math.sign(n.y) * half; n.z -= Math.sign(n.z) * half;
		n.normalize();
		pos.setXYZ(i, ix * Math.sign(p.x) + n.x * r, iy * Math.sign(p.y) + n.y * r, iz * Math.sign(p.z) + n.z * r);
		nor.setXYZ(i, n.x, n.y, n.z);
	}
	var per = (seg + 1) * (seg + 1), dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
	for (var f = 0; f < 6; f++) { for (var j = 0; j < per; j++) { var k = f * per + j; uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]); } }
	g.userData.shared = true;
	RBC[key] = g;
	return g;
}
// Box by its corners (local coordinates); r > 0 rounds the edges.
function RB(g, x0, y0, z0, x1, y1, z1, r, mat, s) {
	var w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
	if (w < 1e-4 || h < 1e-4 || d < 1e-4) { return null; }
	var geo = r > 0 ? rbGeo(w, h, d, r, s) : L.boxGeo(w, h, d);
	return add(g, at(M(geo, mat), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
}
function BX(g, x0, y0, z0, x1, y1, z1, mat) { return RB(g, x0, y0, z0, x1, y1, z1, 0, mat); }
function CY(g, x, y0, z, rt, rb, h, mat, seg, open) { return add(g, at(M(new THREE.CylinderGeometry(rt, rb, h, seg || 24, 1, !!open), mat), x, y0 + h / 2, z)); }
function SP(g, x, y, z, r, mat, ws, hs) { return add(g, at(M(new THREE.SphereGeometry(r, ws || 24, hs || 16), mat), x, y, z)); }
// Surface of revolution from [radius, height] pairs (around the local y axis); sx/sz stretch it.
function LA(g, pts, mat, x, y, z, seg, sx, sz) {
	var m = M(new THREE.LatheGeometry(pts.map(function (p) { return new THREE.Vector2(Math.max(0, p[0]), p[1]); }), seg || 32), mat);
	at(m, x || 0, y || 0, z || 0); m.scale.set(sx || 1, 1, sz || 1);
	return add(g, m);
}
// Tube through points [[x, y, z], ...].
function TU(g, pts, r, mat, seg, closed, tension) {
	var curve = new THREE.CatmullRomCurve3(pts.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }), !!closed, 'catmullrom', tension === undefined ? 0.3 : tension);
	return add(g, M(new THREE.TubeGeometry(curve, seg || Math.max(8, pts.length * 8), r, 10, !!closed), mat));
}
// Straight rod between two points.
function ROD(g, a, b, r, mat, seg) {
	var A = new THREE.Vector3(a[0], a[1], a[2]), B = new THREE.Vector3(b[0], b[1], b[2]), d = B.clone().sub(A), len = d.length();
	if (len < 1e-4) { return null; }
	var m = M(new THREE.CylinderGeometry(r, r, len, seg || 12), mat);
	m.position.copy(A).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
	return add(g, m);
}
// Plane with UVs in metres (tiling textures keep their real size).
function planeGeo(w, h) { var g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv; for (var i = 0; i < uv.count; i++) { uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h); } return g; }
// Rounded rectangle (centred) and ellipse shapes in the x/z plane (shape y = -z).
function rrShape(w, d, r, cx, cz) {
	cx = cx || 0; cz = cz || 0; r = Math.min(r, w / 2, d / 2);
	var s = new THREE.Shape(), x0 = cx - w / 2, x1 = cx + w / 2, y0 = -cz - d / 2, y1 = -cz + d / 2;
	s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r); s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1);
	s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
	return s;
}
function ellShape(rx, rz, cx, cz) { var s = new THREE.Shape(); s.absellipse(cx || 0, -(cz || 0), rx, rz, 0, Math.PI * 2, false, 0); return s; }
// Extrude a plan shape upwards from y0 to y1 (bevel = rounded edge).
function EX(g, shape, y0, y1, mat, bevel, curveSeg) {
	var b = bevel || 0, h = y1 - y0, geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, h - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: b > 0 ? 3 : 0, curveSegments: curveSeg || 24 });
	geo.rotateX(-Math.PI / 2); geo.translate(0, y0 + b, 0);
	return add(g, M(geo, mat));
}
// Place an item in a room (sketch metres: x right, y towards the viewer; rot in degrees, 0 = facing the viewer).
function place(parent, obj, x, y, rot, z) { obj.position.set(x, z || 0, y); obj.rotation.y = (rot || 0) * D2R; parent.add(obj); return obj; }
function rnd(seed) { var s = (seed || 1) * 7919 % 2147483647; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

/* ================================================================== materials */
var FIN = {
	chrome: ['#E6E8EA', 0.08, 1], black: ['#1D1D1F', 0.42, 0.55], brass: ['#C2A16A', 0.24, 1], steel: ['#B4B7BA', 0.32, 1],
	gunmetal: ['#55575A', 0.28, 1], copper: ['#B9775A', 0.26, 1], white: ['#F1F1EF', 0.35, 0.1]
};
function metal(fin) { var f = FIN[fin] || FIN.black; return L.solid(f[0], f[1], f[2]); }
function phys(key, o) {
	return L.cached('ip' + key, function () { return L.stdMat(o); });
}
function ceramic(color) { color = color || '#F7F7F4'; return phys('cer' + color, { color: new THREE.Color(color), roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.06 }); }
function lacquer(color, gloss) { return phys('lac' + color + gloss, { color: new THREE.Color(color), roughness: gloss ? 0.18 : 0.55, clearcoat: gloss ? 1 : 0.2, clearcoatRoughness: gloss ? 0.06 : 0.5 }); }
function glass(tint, op) {
	tint = tint || '#E8F0F2'; op = op === undefined ? 0.16 : op;
	return phys('gl' + tint + op, { color: new THREE.Color(tint), roughness: 0.04, metalness: 0.1, transparent: true, opacity: op, envMapIntensity: 1.4, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false });
}
function mirror() { return L.cached('imirror', function () { return new THREE.MeshStandardMaterial({ color: new THREE.Color('#C4C8C9'), metalness: 0.92, roughness: 0.06, envMapIntensity: 0.65 }); }); }
function fabric(color, kind) {
	kind = kind || 'linen';
	return L.pbr('fabric', { color: color, kind: kind }, { normal: kind === 'boucle' ? 0.6 : 0.45 });
}
function leather(color) { return L.pbr('leather', { color: color }, { normal: 0.25 }); }
function veneer(color, cut) { return L.pbr('veneer', { color: color, cut: cut || 'crown' }, { normal: 0.45 }); }
function marble(kind) {
	var k = { white: ['#EEECE8', '#8E8A86'], calacatta: ['#F1EEE8', '#B49A6E'], black: ['#1E1E20', '#D9D6D0'], green: ['#2F4A3E', '#C9D2C8'], travertine: null }[kind || 'white'];
	if (!k) { return L.pbr('floor', { pattern: 'tile', color: '#D9C9AE', size: 3, pores: 2 }, { normal: 0.8 }); }
	return L.pbr('marble', { color: k[0], vein: k[1] }, { normal: 0.25, physical: true, clearcoat: 0.6 });
}
// Thin surfaces seen from both sides (leaves, curtains, lamp shades) get both faces in their
// geometry: a two-sided or back-side material would be another shader to compile.
function dside(mat) { return mat; }
var FLIPC = {};
function flipGeo(geo, both) {
	var key = geo.uuid + (both ? '2' : '1');
	if (FLIPC[key]) { return FLIPC[key]; }
	var g = geo.index ? geo.toNonIndexed() : geo, P = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv ? g.attributes.uv.array : null, n = P.length / 3;
	var m = both ? 2 : 1, pos = new Float32Array(n * 3 * m), nor = new Float32Array(n * 3 * m), uv = new Float32Array(n * 2 * m), o = 0;
	if (both) { pos.set(P); nor.set(N); if (U) { uv.set(U); } o = n; }
	for (var t = 0; t < n; t += 3) {
		[0, 2, 1].forEach(function (k, j) { var a = t + k, b = o + t + j; pos[b * 3] = P[a * 3]; pos[b * 3 + 1] = P[a * 3 + 1]; pos[b * 3 + 2] = P[a * 3 + 2]; nor[b * 3] = -N[a * 3]; nor[b * 3 + 1] = -N[a * 3 + 1]; nor[b * 3 + 2] = -N[a * 3 + 2]; if (U) { uv[b * 2] = U[a * 2]; uv[b * 2 + 1] = U[a * 2 + 1]; } });
	}
	var out = new THREE.BufferGeometry();
	out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
	out.userData.shared = !!geo.userData.shared;
	if (out.userData.shared) { FLIPC[key] = out; }
	return out;
}
function twoSided(geo) { return flipGeo(geo, true); }
function rattanMat(color) { return dside(L.pbr('rattan', { color: color || '#C9A46B' }, { normal: 1 })); }
function emissive(color, k) { return L.solid('#2A2620', 0.4, 0, { emissive: color || '#FFD9A0', emissiveIntensity: k || 2.2 }); }
function plainTex(kind, opts, params) { return L.pbr(kind, opts, params || { normal: 0.6 }); }

// The material set of a room: upholstery, woods, metals, ceramics, stone, accents of the palette.
function Mats(c, room) {
	var K = L.SK(), pal = (K._interior || {})[c.interior_style] || ['#F2EBE1', '#D7C3A8', '#A88464', '#6E5A4A'];
	var st = c.interior_style || 'warm_neutral', fs = c.furniture_style || 'contemporary';
	var woodC = { contemporary: '#C9A27A', mid_century: '#8A5A36', classic: '#5E3E28', rustic: '#8A6446', luxury: '#3A2B24' }[fs] || '#C9A27A';
	var fin = { luxury: 'brass', classic: 'brass', warm_neutral: 'brass', industrial: 'black', modern_minimal: 'black', monochrome: 'black', scandinavian: 'black', japandi: 'black', wood_stone: 'black', mediterranean: 'black' }[st] || 'black';
	var kind = { modern_minimal: 'linen', luxury: 'velvet', scandinavian: 'wool', japandi: 'linen', classic: 'velvet', mediterranean: 'linen', industrial: 'linen', wood_stone: 'boucle', warm_neutral: 'boucle', monochrome: 'linen' }[st] || 'linen';
	var up = L.col(c.furniture_color, '#D8CCBB');
	var night = c.time_of_day === 'night' || c.time_of_day === 'blue';
	var m = {
		c: c, pal: pal, st: st, fs: fs, night: night, fin: fin, kind: kind, up: up,
		fab: fabric(up, kind), fab2: fabric(L.shadeHex(up, 0.12), 'linen'), soft: fabric(pal[2], kind === 'boucle' ? 'boucle' : 'linen'),
		acc1: fabric(pal[3], 'velvet'), acc2: fabric(pal[1], 'linen'), acc3: fabric(L.shadeHex(pal[2], 0.25), 'wool'),
		cognac: leather('#6E412A'), blackLeather: leather('#2A2624'),
		wood: veneer(woodC), woodQ: veneer(woodC, 'quarter'), oak: veneer('#C9A27A'), walnut: veneer('#6B4630'), ash: veneer('#D9C3A2'),
		metal: metal(fin), black: metal('black'), brass: metal('brass'), chrome: metal('chrome'), steel: metal('steel'),
		white: L.solid('#F5F4F0', 0.5), offwhite: L.solid('#ECE8E0', 0.7), dark: L.solid('#1E1F21', 0.45), plinth: L.solid('#2A2A2B', 0.8),
		ceramic: ceramic(), stone: marble(st === 'luxury' || st === 'classic' ? 'calacatta' : (st === 'monochrome' ? 'black' : 'white')), trav: marble('travertine'),
		paper: L.solid('#F3EFE6', 0.9), linenWhite: fabric('#F4F1EA', 'linen'), duvet: fabric(st === 'monochrome' ? '#E9E9E7' : '#F1ECE3', 'linen'),
		lampShade: night ? emissive('#FFE1B0', 1.8) : fabric('#EFE8DC', 'linen'), bulb: night ? emissive('#FFE3B8', 4) : L.solid('#FFF8EC', 0.3),
		opal: night ? emissive('#FFE6C2', 2.4) : phys('opal', { color: new THREE.Color('#F4F2EE'), roughness: 0.25, transmission: 0, clearcoat: 0.6, sheen: 0 }),
		screen: phys('screen', { color: new THREE.Color('#0D0E10'), roughness: 0.08, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03 }),
		leaf: L.solid('#3F6B3A', 0.55), leaf2: L.solid('#5C8A4A', 0.55), terracotta: L.solid('#B5674A', 0.85), potW: ceramic('#EDE9E2'), potD: L.solid('#3A3836', 0.6),
		books: ['#B4553F', '#2F4A5A', '#D9C7A6', '#6F7D63', '#E8E2D6', '#3B3331', '#C49A5A', '#8C9AA4'].map(function (h) { return L.solid(h, 0.85); })
	};
	m.leaf = dside(m.leaf); m.leaf2 = dside(m.leaf2);
	m.legs = fs === 'mid_century' || fs === 'rustic' || fs === 'classic' ? m.wood : m.metal;
	void room;
	return m;
}

// Named colours of the tone choices (curtains, rugs); 'auto' keeps the interior palette.
var TONE = { ivory: '#ECE6DA', sand: '#D8C7A8', grey: '#BDBAB4', charcoal: '#4A4846', terracotta: '#B5674A', blue: '#3E5A78', green: '#7E9478', ochre: '#C49A4A', rose: '#D9A9A0' };
// Curtain fabric and sheer of a configuration (fabric and colour choices, else the style's linen).
function curtainMats(m) {
	if (m._cur) { return m._cur; }
	var c = m.c, kind = pick(c, 'curtain_fabric'), tone = TONE[c.curtain_tone], col = tone || L.shadeHex(m.pal[0], -0.03);
	if (!kind || kind === 'none') { kind = m.st === 'luxury' || m.st === 'classic' ? 'velvet' : 'linen'; }
	var fab = kind === 'voile' ? glass(L.shadeHex(col, 0.2), 0.55) : fabric(kind === 'blackout' ? L.shadeHex(col, -0.1) : col, kind === 'velvet' ? 'velvet' : (kind === 'patterned' ? 'pattern' : (kind === 'blackout' ? 'wool' : 'linen')));
	m._cur = { fab: fab, sheer: glass(tone ? L.shadeHex(col, 0.45) : '#F7F3EC', 0.55), kind: kind, tone: tone };
	return m._cur;
}

/* ================================================================== small things */
function legs4(g, w, d, h, inset, mat, kind) {
	[-w / 2 + inset, w / 2 - inset].forEach(function (x) {
		[-d / 2 + inset, d / 2 - inset].forEach(function (z) {
			if (kind === 'square') { BX(g, x - 0.02, 0, z - 0.02, x + 0.02, h, z + 0.02, mat); }
			else if (kind === 'bun') { LA(g, [[0, 0], [0.028, 0.004], [0.042, h * 0.45], [0.032, h], [0, h]], mat, x, 0, z, 16); }
			else if (kind === 'round') { CY(g, x, 0, z, 0.011, 0.011, h, mat, 12); }
			else { CY(g, x, 0, z, 0.019, 0.012, h, mat, 12); }
		});
	});
}
// Throw pillows leaning against a back (x positions, seat height, z of the back face).
function pillows(g, m, xs, y, z, size) {
	var mats = [m.acc1, m.acc2, m.acc3, m.acc1], s = size || 0.46;
	xs.forEach(function (x, i) {
		var p = M(rbGeo(s, s, 0.14, 0.07, 3), mats[i % mats.length]);
		at(p, x, y + s / 2 - 0.02, z + 0.08); p.rotation.x = -0.28; p.rotation.z = (i % 2 ? -1 : 1) * 0.06; g.add(p);
	});
}
function book(g, m, x, y, z, w, h, d, i, rotZ) { var b = RB(g, x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, 0.004, m.books[i % m.books.length], 1); if (b && rotZ) { b.rotation.z = rotZ; } return b; }
// A stack of books lying flat.
function bookStack(g, m, x, y, z, n, seed) { var r = rnd(seed || 3), yy = y; for (var i = 0; i < n; i++) { var w = 0.2 + r() * 0.08, d = 0.15 + r() * 0.06, h = 0.025 + r() * 0.02; var b = book(g, m, x + (r() - 0.5) * 0.02, yy, z, w, h, d, i + (seed || 0)); b.rotation.y = (r() - 0.5) * 0.25; yy += h; } return yy; }
// A row of standing books (for shelves) from x0 to x1.
function bookRow(g, m, x0, x1, y, z, depth, hmax, seed) {
	var r = rnd(seed || 5), x = x0;
	while (x < x1 - 0.03) { var t = 0.02 + r() * 0.035, h = hmax * (0.72 + r() * 0.28); if (x + t > x1) { break; } book(g, m, x + t / 2, y, z, t, h, depth * (0.8 + r() * 0.2), Math.floor(r() * 8)); x += t + 0.002; if (r() < 0.12) { x += 0.06; } }
}
// Vase with a few stems, a bowl, a candle – the small objects that make a room lived in.
function vase(g, m, x, y, z, s, kind) {
	s = s || 1;
	var mat = kind === 'dark' ? m.potD : (kind === 'clay' ? m.terracotta : m.potW);
	LA(g, [[0, 0], [0.05 * s, 0], [0.075 * s, 0.06 * s], [0.07 * s, 0.16 * s], [0.035 * s, 0.24 * s], [0.03 * s, 0.27 * s], [0.035 * s, 0.28 * s], [0.028 * s, 0.28 * s], [0.02 * s, 0.1 * s], [0, 0.1 * s]], mat, x, y, z, 28);
	var stem = L.solid('#6B7A55', 0.8);
	[[0.06, 0.55, 0.02], [-0.07, 0.5, -0.03], [0.01, 0.62, -0.06]].forEach(function (q) { TU(g, [[x, y + 0.2 * s, z], [x + q[0] * 0.5 * s, y + q[1] * 0.6 * s, z + q[2] * 0.5 * s], [x + q[0] * s, y + q[1] * s, z + q[2] * s]], 0.004, stem, 8); SP(g, x + q[0] * s, y + q[1] * s, z + q[2] * s, 0.025 * s, m.leaf2, 8, 6); });
}
function bowl(g, m, x, y, z, r, mat) { LA(g, [[0, 0], [r * 0.45, 0], [r * 0.85, r * 0.25], [r, r * 0.5], [r * 0.94, r * 0.5], [r * 0.8, r * 0.28], [r * 0.4, r * 0.08], [0, r * 0.08]], mat || m.ceramic, x, y, z, 32); }
function candle(g, m, x, y, z) { CY(g, x, y, z, 0.035, 0.035, 0.12, m.offwhite, 18); if (m.night) { SP(g, x, y + 0.14, z, 0.01, m.bulb, 8, 6); } }

/* ================================================================== plants */
function pot(g, m, r, h, kind) {
	var mat = kind === 'clay' ? m.terracotta : (kind === 'dark' ? m.potD : (kind === 'basket' ? rattanMat('#B89566') : m.potW));
	LA(g, [[0, 0], [r * 0.78, 0], [r * 0.92, h * 0.15], [r, h * 0.92], [r * 1.02, h], [r * 0.93, h], [r * 0.9, h * 0.9], [0, h * 0.9]], mat, 0, 0, 0, 32);
	CY(g, 0, h * 0.86, 0, r * 0.9, r * 0.9, 0.01, L.solid('#4A3B2E', 1), 24);
	return h * 0.88;
}
// A flat leaf shape bent along its length.
var LEAFC = {};
function leafGeo(len, wid, kind) {
	var lk = kind + Math.round(len * 50) + 'x' + Math.round(wid * 100);
	if (LEAFC[lk]) { return LEAFC[lk]; }
	len = Math.round(len * 50) / 50; wid = Math.round(wid * 100) / 100;
	var s = new THREE.Shape();
	if (kind === 'sword') { s.moveTo(-wid / 2, 0); s.quadraticCurveTo(-wid * 0.6, len * 0.6, 0, len); s.quadraticCurveTo(wid * 0.6, len * 0.6, wid / 2, 0); s.lineTo(-wid / 2, 0); }
	else if (kind === 'frond') { s.moveTo(0, 0); for (var i = 1; i <= 12; i++) { var t = i / 12; s.lineTo(wid * Math.sin(t * Math.PI) * (i % 2 ? 1 : 0.35), len * t); } for (var j = 11; j >= 0; j--) { var t2 = j / 12; s.lineTo(-wid * Math.sin(t2 * Math.PI) * (j % 2 ? 1 : 0.35), len * t2); } }
	else { s.moveTo(0, 0); s.bezierCurveTo(wid * 0.9, len * 0.15, wid * 0.65, len * 0.85, 0, len); s.bezierCurveTo(-wid * 0.65, len * 0.85, -wid * 0.9, len * 0.15, 0, 0); }
	var geo = new THREE.ShapeGeometry(s, 8), p = geo.attributes.position;
	for (var k = 0; k < p.count; k++) { var y = p.getY(k), x = p.getX(k); p.setZ(k, -Math.pow(y / len, 2) * len * 0.35 - Math.abs(x) * 0.25 * (kind === 'sword' ? 0 : 1)); }
	geo.computeVertexNormals();
	geo.userData.shared = true;
	LEAFC[lk] = geo;
	return geo;
}
function leafAt(g, geo, mat, x, y, z, yaw, pitch) { var q = M(twoSided(geo), mat); q.position.set(x, y, z); q.rotation.set(0, 0, 0); q.rotateY(yaw); q.rotateX(pitch); g.add(q); return q; }
function plant(m, kind, size) {
	var g = G(), s = size || 1, r = rnd(Math.round(s * 13) + kind.length), top;
	if (kind === 'snake') {
		top = pot(g, m, 0.13 * s, 0.3 * s, 'dark');
		for (var i = 0; i < 11; i++) { var a = r() * Math.PI * 2, rr = r() * 0.07 * s; leafAt(g, leafGeo((0.5 + r() * 0.35) * s, 0.07 * s, 'sword'), i % 3 ? m.leaf : m.leaf2, Math.cos(a) * rr, top, Math.sin(a) * rr, a, -0.08 - r() * 0.12); }
	} else if (kind === 'fiddle') {
		top = pot(g, m, 0.17 * s, 0.36 * s, 'basket');
		var H = 1.5 * s; ROD(g, [0, top, 0], [0.03, top + H * 0.75, 0.02], 0.016 * s, L.solid('#6B5A44', 0.9));
		for (var j = 0; j < 22; j++) { var t = 0.25 + j / 22 * 0.75, ya = j * 2.4; leafAt(g, leafGeo(0.28 * s, 0.2 * s, 'oval'), j % 2 ? m.leaf : m.leaf2, 0.03 * t, top + H * t, 0.02 * t, ya, -0.5 - r() * 0.5); }
	} else if (kind === 'palm') {
		top = pot(g, m, 0.2 * s, 0.42 * s, 'clay');
		for (var k = 0; k < 9; k++) { var a2 = k / 9 * Math.PI * 2 + r(), L2 = (0.9 + r() * 0.5) * s; var stem = [[0, top, 0], [Math.cos(a2) * 0.15 * s, top + L2 * 0.6, Math.sin(a2) * 0.15 * s], [Math.cos(a2) * 0.45 * s, top + L2 * 0.85, Math.sin(a2) * 0.45 * s]]; TU(g, stem, 0.008 * s, L.solid('#6E7D4A', 0.8), 10); leafAt(g, leafGeo(0.75 * s, 0.22 * s, 'frond'), m.leaf2, stem[1][0], stem[1][1], stem[1][2], -Math.PI / 2 - a2, -0.45 - r() * 0.35); }
	} else if (kind === 'olive') {
		top = pot(g, m, 0.2 * s, 0.4 * s, 'clay');
		var bark = L.solid('#7A6A58', 0.9), H2 = 1.2 * s;
		TU(g, [[0, top, 0], [0.04 * s, top + H2 * 0.35, 0.02], [-0.02, top + H2 * 0.6, 0.03], [0.02, top + H2 * 0.75, 0]], 0.028 * s, bark, 16);
		[[0, 0.92, 0, 0.3], [0.18, 0.8, 0.08, 0.22], [-0.16, 0.85, -0.06, 0.22]].forEach(function (q, n) {
			var cm = M(L.canopyGeo('sphere', 140, n + 2), L.leafMat(m.c, 'broad', false)); cm.position.set(q[0] * s, top + H2 * q[1], q[2] * s); cm.scale.setScalar(q[3] * s * 1.6); g.add(cm);
		});
	} else if (kind === 'cactus') {
		top = pot(g, m, 0.13 * s, 0.22 * s, 'clay');
		var cg = L.solid('#5E7F4E', 0.6);
		[[0, 0, 0.065, 0.55], [0.09, 0.03, 0.045, 0.32], [-0.08, -0.04, 0.04, 0.24]].forEach(function (q) {
			var col = M(new THREE.CapsuleGeometry(q[2] * s, q[3] * s, 4, 12), cg); col.position.set(q[0] * s, top + q[3] * s / 2 + q[2] * s * 0.6, q[1] * s); col.scale.set(1, 1, 1); g.add(col);
			for (var rb = 0; rb < 8; rb++) { var ra = rb / 8 * Math.PI * 2; ROD(g, [q[0] * s + Math.cos(ra) * q[2] * s * 0.98, top + q[2] * s, q[1] * s + Math.sin(ra) * q[2] * s * 0.98], [q[0] * s + Math.cos(ra) * q[2] * s * 0.98, top + q[3] * s + q[2] * s * 0.4, q[1] * s + Math.sin(ra) * q[2] * s * 0.98], 0.004 * s, L.solid('#4A6A3C', 0.6), 4); }
		});
		TU(g, [[0.03 * s, top + 0.3 * s, 0], [0.12 * s, top + 0.32 * s, 0], [0.13 * s, top + 0.45 * s, 0]], 0.03 * s, cg, 10);
	} else if (kind === 'pothos') {
		// on a slim stand, trailing vines
		var stand = 0.75 * s; [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (q) { ROD(g, [q[0] * 0.13 * s, 0, q[1] * 0.13 * s], [q[0] * 0.1 * s, stand, q[1] * 0.1 * s], 0.008, m.black, 6); });
		var pg2 = G(); pg2.position.y = stand; g.add(pg2); top = pot(pg2, m, 0.14 * s, 0.18 * s, 'white') + stand;
		for (var v2 = 0; v2 < 7; v2++) {
			var va = v2 / 7 * Math.PI * 2 + r(), vl = (0.5 + r() * 0.5) * s, vp = [[Math.cos(va) * 0.08 * s, top, Math.sin(va) * 0.08 * s], [Math.cos(va) * 0.2 * s, top - 0.05, Math.sin(va) * 0.2 * s], [Math.cos(va) * 0.24 * s, top - vl * 0.6, Math.sin(va) * 0.24 * s], [Math.cos(va) * 0.22 * s, top - vl, Math.sin(va) * 0.22 * s]];
			TU(g, vp, 0.004, L.solid('#5C7A3A', 0.7), 12);
			for (var lf = 0; lf < 5; lf++) { var tq = lf / 5, lp = [vp[1][0] + (vp[3][0] - vp[1][0]) * tq, vp[1][1] + (vp[3][1] - vp[1][1]) * tq, vp[1][2] + (vp[3][2] - vp[1][2]) * tq]; leafAt(g, leafGeo(0.09 * s, 0.07 * s, 'oval'), lf % 2 ? m.leaf : m.leaf2, lp[0], lp[1], lp[2], va + (lf % 2 ? 0.6 : -0.6), 1.2); }
		}
	} else if (kind === 'bonsai') {
		// a low stand with a shallow tray, a twisted trunk and flat foliage pads
		RB(g, -0.25 * s, 0, -0.18 * s, 0.25 * s, 0.45 * s, 0.18 * s, 0.01, m.walnut, 1);
		LA(g, [[0, 0], [0.2 * s, 0], [0.22 * s, 0.06 * s], [0.2 * s, 0.065 * s], [0, 0.055 * s]], L.solid('#3A3836', 0.5), 0, 0.45 * s, 0, 24, 1.3, 0.8);
		var b0 = 0.5 * s, bk = L.solid('#5A4A3C', 0.9);
		TU(g, [[0, b0, 0], [0.05 * s, b0 + 0.08 * s, 0.02 * s], [-0.03 * s, b0 + 0.16 * s, 0], [0.04 * s, b0 + 0.24 * s, -0.02 * s]], 0.022 * s, bk, 14);
		[[0.04, 0.27, -0.02, 0.13], [-0.1, 0.2, 0.02, 0.1], [0.12, 0.18, 0.03, 0.09]].forEach(function (q, n3) { var pad = M(L.canopyGeo('sphere', 90, n3 + 1), L.leafMat(m.c, 'broad', false)); pad.position.set(q[0] * s, b0 + q[1] * s, q[2] * s); pad.scale.set(q[3] * s, q[3] * s * 0.45, q[3] * s); g.add(pad); });
	} else {
		// monstera: large split leaves on long stalks
		top = pot(g, m, 0.18 * s, 0.34 * s, 'dark');
		for (var n2 = 0; n2 < 9; n2++) {
			var a3 = n2 / 9 * Math.PI * 2 + r() * 0.5, L3 = (0.45 + r() * 0.45) * s, tip = [Math.cos(a3) * 0.3 * L3, top + L3, Math.sin(a3) * 0.3 * L3];
			TU(g, [[0, top, 0], [tip[0] * 0.4, top + L3 * 0.7, tip[2] * 0.4], tip], 0.007 * s, L.solid('#4E7A40', 0.7), 10);
			leafAt(g, monsteraGeo(0.42 * s), n2 % 2 ? m.leaf : m.leaf2, tip[0], tip[1], tip[2], -Math.PI / 2 - a3, -0.75 - r() * 0.5);
		}
	}
	return g;
}
var MONC = {};
function monsteraGeo(sz) {
	var key = Math.round(sz * 100); if (MONC[key]) { return MONC[key]; }
	var s = new THREE.Shape(), n = 9, pts = [];
	for (var i = 0; i <= n * 2; i++) {
		var t = i / (n * 2), a = Math.PI * 1.15 * (t - 0.5), r = sz * 0.5 * (0.75 + 0.25 * Math.cos(a)), cut = i % 2 === 1 && i > 1 && i < n * 2 - 1;
		pts.push([Math.sin(a) * r * (cut ? 0.55 : 1), sz * 0.45 + Math.cos(a) * r * (cut ? 0.55 : 1) * 0.9]);
	}
	s.moveTo(0, 0); pts.forEach(function (p) { s.lineTo(p[0], p[1]); }); s.lineTo(0, 0);
	var geo = new THREE.ShapeGeometry(s, 4), pp = geo.attributes.position;
	for (var k = 0; k < pp.count; k++) { var yy = pp.getY(k), xx = pp.getX(k); pp.setZ(k, -Math.pow(yy / sz, 2) * sz * 0.25 - Math.abs(xx) * 0.15); }
	geo.computeVertexNormals(); geo.userData.shared = true;
	MONC[key] = geo; return geo;
}

/* ================================================================== seating */
// One straight run of a sofa from x0 to x1 (back at z0, front at z1) with optional arms.
function sofaRun(g, m, fab, x0, x1, z0, z1, armL, armR, P) {
	RB(g, x0, P.legH, z0, x1, P.base, z1, 0.03, fab, 2);
	if (armL) { RB(g, x0, P.legH, z0, x0 + P.armW, P.armH, z1, P.armR, fab, 3); }
	if (armR) { RB(g, x1 - P.armW, P.legH, z0, x1, P.armH, z1, P.armR, fab, 3); }
	if (P.ch) {
		[armL ? x0 + P.armW / 2 : null, armR ? x1 - P.armW / 2 : null].forEach(function (xa) { if (xa === null) { return; } var cy = M(new THREE.CylinderGeometry(P.armW * 0.62, P.armW * 0.62, z1 - z0, 28), fab); cy.rotation.x = Math.PI / 2; at(cy, xa, P.armH, (z0 + z1) / 2); g.add(cy); });
	}
	var bx0 = armL && P.ch ? x0 + P.armW : x0 + 0.01, bx1 = armR && P.ch ? x1 - P.armW : x1 - 0.01;
	RB(g, bx0, P.base, z0, bx1, P.backH, z0 + P.backD, 0.04, fab, 2);
	if (P.ch) {
		var top = M(new THREE.CylinderGeometry(0.1, 0.1, bx1 - bx0, 28), fab); top.rotation.z = Math.PI / 2; at(top, (bx0 + bx1) / 2, P.backH, z0 + 0.1); g.add(top);
		// buttons of the deep tufting
		var btn = L.solid('#2A1E18', 0.4);
		for (var bxp = bx0 + 0.12; bxp < bx1 - 0.08; bxp += 0.16) { for (var by = P.base + P.seat + 0.1; by < P.backH - 0.05; by += 0.13) { SP(g, bxp + ((Math.round((by - P.base) / 0.13)) % 2 ? 0.08 : 0), by, z0 + P.backD + 0.003, 0.012, btn, 8, 6); } }
	}
	var xi0 = x0 + (armL ? P.armW : 0) + 0.004, xi1 = x1 - (armR ? P.armW : 0) - 0.004, n = P.ch ? 1 : Math.max(1, Math.round((xi1 - xi0) / P.cushW)), cw = (xi1 - xi0) / n;
	for (var i = 0; i < n; i++) {
		var cx0 = xi0 + i * cw + 0.005, cx1 = xi0 + (i + 1) * cw - 0.005;
		RB(g, cx0, P.base, z0 + P.backD, cx1, P.base + P.seat, z1 - 0.005, P.cushR, fab, 3);
		if (!P.ch) {
			var bh = P.backH - P.base - P.seat + (P.mod ? 0.24 : 0.1), bc = M(rbGeo(cx1 - cx0, bh, P.mod ? 0.26 : 0.2, P.mod ? 0.12 : 0.07, 3), fab);
			at(bc, (cx0 + cx1) / 2, P.base + P.seat + bh / 2 - 0.04, z0 + P.backD + (P.mod ? 0.06 : 0.08)); bc.rotation.x = P.mod ? -0.1 : -0.16; g.add(bc);
		}
	}
	return [xi0, xi1];
}
// Chaise extension in front of a run (x0..x1, from z1 forward by len), with an arm on the outer side.
function chaise(g, m, fab, x0, x1, z1, len, side, P) {
	RB(g, x0, P.legH, z1 - 0.02, x1, P.base, z1 + len, 0.03, fab, 2);
	var ax0 = side > 0 ? x1 - P.armW : x0, ax1 = side > 0 ? x1 : x0 + P.armW;
	RB(g, ax0, P.legH, z1 - 0.02, ax1, P.armH, z1 + len, P.armR, fab, 3);
	var cx0 = side > 0 ? x0 + 0.005 : x0 + P.armW + 0.005, cx1 = side > 0 ? x1 - P.armW - 0.005 : x1 - 0.005;
	RB(g, cx0, P.base, z1 + 0.005, cx1, P.base + P.seat, z1 + len - 0.005, P.cushR, fab, 3);
}
export function sofa(m, type, w) {
	var g = G(), mod = type === 'modular', ch = type === 'chesterfield';
	var fab = ch ? (m.kind === 'velvet' ? m.fab : m.cognac) : (m.st === 'industrial' ? m.cognac : m.fab);
	if (type === 'curved') { curvedSofa(g, m, fab, w); return g; }
	var d = mod ? 1.05 : 0.95, z0 = -d / 2, z1 = d / 2;
	var P = { mod: mod, ch: ch, legH: mod ? 0.05 : (ch ? 0.1 : 0.14), base: mod ? 0.22 : 0.31, seat: mod ? 0.2 : 0.13, armW: mod ? 0.34 : (ch ? 0.2 : 0.17), armH: ch ? 0.66 : (mod ? 0.58 : 0.6), armR: mod ? 0.14 : 0.05, backH: ch ? 0.72 : (mod ? 0.62 : 0.84), backD: ch ? 0.2 : (mod ? 0.3 : 0.17), cushW: mod ? 1.0 : 0.8, cushR: mod ? 0.1 : 0.05 };
	if (mod) { BX(g, -w / 2 + 0.08, 0, z0 + 0.08, w / 2 - 0.08, P.legH, z1 - 0.1, m.plinth); }
	var xs;
	if (type === 'corner' || type === 'u_shape') {
		xs = sofaRun(g, m, fab, -w / 2, w / 2, z0, z1, type === 'corner', false, P);
		chaise(g, m, fab, w / 2 - 0.95, w / 2, z1, 0.8, 1, P);
		if (type === 'u_shape') { chaise(g, m, fab, -w / 2, -w / 2 + 0.95, z1, 0.8, -1, P); }
		if (!mod) { legs4(g, w - 0.08, d - 0.08, P.legH, 0.03, m.legs, m.legs === m.wood ? 'taper' : 'round'); [[w / 2 - 0.06, z1 + 0.74], [w / 2 - 0.9, z1 + 0.74]].forEach(function (q) { CY(g, q[0], 0, q[1], 0.012, 0.012, P.legH, m.legs, 12); }); if (type === 'u_shape') { [[-w / 2 + 0.06, z1 + 0.74], [-w / 2 + 0.9, z1 + 0.74]].forEach(function (q) { CY(g, q[0], 0, q[1], 0.012, 0.012, P.legH, m.legs, 12); }); } }
	} else {
		xs = sofaRun(g, m, fab, -w / 2, w / 2, z0, z1, true, true, P);
		if (!mod) { legs4(g, w - 0.08, d - 0.08, P.legH, 0.03, ch ? m.wood : m.legs, ch ? 'bun' : (m.legs === m.wood ? 'taper' : 'round')); }
	}
	if (!ch) { pillows(g, m, [xs[0] + 0.28, xs[1] - 0.28].concat(w > 2.6 ? [xs[1] - 0.62] : []), P.base + P.seat, z0 + P.backD + 0.12); }
	// a folded throw over one arm
	if (!ch && type !== 'u_shape') { var tm = m.acc3, ax = -w / 2 + P.armW / 2; RB(g, ax - P.armW / 2 - 0.01, P.armH, -0.15, ax + P.armW / 2 + 0.01, P.armH + 0.025, 0.3, 0.01, tm, 2); RB(g, ax - P.armW / 2 - 0.035, P.armH - 0.3, -0.15, ax - P.armW / 2 - 0.01, P.armH + 0.02, 0.3, 0.01, tm, 2); }
	return g;
}
function sector(R0, R1, span, zc) {
	var s = new THREE.Shape(), a0 = Math.PI / 2 + span / 2, a1 = Math.PI / 2 - span / 2;
	s.absarc(0, -zc, R1, a0, a1, true); s.absarc(0, -zc, R0, a1, a0, false); s.closePath();
	return s;
}
function curvedSofa(g, m, fab, w) {
	var d = 1.0, R = Math.max(1.5, w * 0.7), span = Math.min(Math.PI * 0.8, w / R), zc = R - d / 2;
	EX(g, sector(R - d + 0.12, R - 0.1, span * 0.96, zc), 0, 0.08, m.plinth);
	EX(g, sector(R - d, R, span, zc), 0.08, 0.3, fab, 0.03);
	var n = 3, gap = 0.025 / R;
	for (var i = 0; i < n; i++) {
		var a = -span / 2 + i * span / n, sg = new THREE.Shape(), aa0 = Math.PI / 2 - a - gap, aa1 = Math.PI / 2 - a - span / n + gap;
		sg.absarc(0, -zc, R - 0.2, aa0, aa1, true); sg.absarc(0, -zc, R - d + 0.02, aa1, aa0, false); sg.closePath();
		EX(g, sg, 0.3, 0.46, fab, 0.05);
	}
	EX(g, sector(R - 0.22, R, span, zc), 0.3, 0.82, fab, 0.06);
	var xs = [-0.6, 0, 0.6].map(function (t) { return t * R * Math.sin(span / 2) * 0.8; });
	xs.forEach(function (x, k) {
		var a2 = Math.asin(Math.max(-1, Math.min(1, x / (R - 0.3)))), z = zc - (R - 0.3) * Math.cos(a2);
		var p = M(rbGeo(0.46, 0.46, 0.14, 0.07, 3), [m.acc1, m.acc2, m.acc3][k]); at(p, x, 0.46 + 0.2, z); p.rotation.y = -a2; p.rotateX(-0.28); g.add(p);
	});
}
export function armchair(m, type) {
	var g = G(), fab = m.fab;
	if (type === 'none') { return g; }
	if (type === 'lounge') {
		var lth = m.st === 'scandinavian' || m.st === 'wood_stone' ? m.fab : m.cognac, shell = m.walnut;
		CY(g, 0, 0, 0, 0.03, 0.03, 0.3, m.black, 12);
		for (var k = 0; k < 5; k++) { var a = k / 5 * Math.PI * 2; ROD(g, [0, 0.06, 0], [Math.cos(a) * 0.34, 0.02, Math.sin(a) * 0.34], 0.018, m.black, 8); }
		var seatG = G(); seatG.position.set(0, 0.36, 0.02); seatG.rotation.x = -0.1; g.add(seatG);
		RB(seatG, -0.4, -0.03, -0.38, 0.4, 0.02, 0.38, 0.02, shell, 2); RB(seatG, -0.36, 0.02, -0.34, 0.36, 0.14, 0.36, 0.05, lth, 3);
		var backG = G(); backG.position.set(0, 0.42, -0.36); backG.rotation.x = -0.32; g.add(backG);
		RB(backG, -0.4, 0, -0.03, 0.4, 0.62, 0.02, 0.02, shell, 2); RB(backG, -0.36, 0.04, 0.02, 0.36, 0.6, 0.14, 0.06, lth, 3);
		[-1, 1].forEach(function (s) { RB(g, s * 0.43 - 0.05, 0.52, -0.3, s * 0.43 + 0.05, 0.56, 0.3, 0.02, shell, 2); RB(g, s * 0.43 - 0.045, 0.56, -0.25, s * 0.43 + 0.045, 0.6, 0.25, 0.02, lth, 2); });
		var ot = G(); ot.position.set(0, 0, 0.85); g.add(ot);
		CY(ot, 0, 0, 0, 0.025, 0.025, 0.28, m.black, 12); for (var k2 = 0; k2 < 4; k2++) { var a2 = k2 / 4 * Math.PI * 2 + 0.4; ROD(ot, [0, 0.05, 0], [Math.cos(a2) * 0.26, 0.02, Math.sin(a2) * 0.26], 0.015, m.black, 8); }
		RB(ot, -0.3, 0.26, -0.24, 0.3, 0.29, 0.24, 0.02, shell, 2); RB(ot, -0.27, 0.29, -0.21, 0.27, 0.4, 0.21, 0.05, lth, 3);
	} else if (type === 'wingback') {
		legs4(g, 0.76, 0.78, 0.16, 0.05, m.wood, 'taper');
		RB(g, -0.4, 0.16, -0.4, 0.4, 0.38, 0.4, 0.03, fab, 2);
		RB(g, -0.3, 0.38, -0.3, 0.3, 0.48, 0.4, 0.05, fab, 3);
		var bk = M(rbGeo(0.62, 0.78, 0.14, 0.05, 3), fab); at(bk, 0, 0.78, -0.34); bk.rotation.x = -0.08; g.add(bk);
		[-1, 1].forEach(function (s) {
			RB(g, s * 0.35 - 0.05, 0.16, -0.38, s * 0.35 + 0.05, 0.62, 0.38, 0.04, fab, 3);
			var cy = M(new THREE.CylinderGeometry(0.06, 0.06, 0.74, 24), fab); cy.rotation.x = Math.PI / 2; at(cy, s * 0.37, 0.63, 0); g.add(cy);
			var wing = M(rbGeo(0.08, 0.5, 0.3, 0.04, 3), fab); at(wing, s * 0.37, 0.92, -0.24); wing.rotation.y = s * 0.35; g.add(wing);
		});
	} else if (type === 'barrel') {
		LA(g, [[0, 0], [0.3, 0], [0.3, 0.06], [0, 0.06]], m.plinth, 0, 0, 0, 32);
		LA(g, [[0, 0.06], [0.38, 0.06], [0.42, 0.1], [0.42, 0.3], [0.38, 0.36], [0, 0.36]], fab, 0, 0, 0, 40);
		LA(g, [[0, 0.36], [0.33, 0.36], [0.36, 0.39], [0.36, 0.45], [0.33, 0.48], [0, 0.48]], fab, 0, 0, 0.02, 40);
		var sh = new THREE.Shape(), sp = Math.PI * 1.25; sh.absarc(0, 0, 0.44, Math.PI / 2 + sp / 2, Math.PI / 2 - sp / 2, true); sh.absarc(0, 0, 0.32, Math.PI / 2 - sp / 2, Math.PI / 2 + sp / 2, false); sh.closePath();
		EX(g, sh, 0.33, 0.74, fab, 0.04);
	} else if (type === 'cane') {
		var frame = m.st === 'japandi' ? m.oak : m.walnut, cane = rattanMat('#C9A46B');
		[[-0.3, 0.3], [0.3, 0.3], [-0.3, -0.28], [0.3, -0.28]].forEach(function (q) { ROD(g, [q[0], 0, q[1]], [q[0], q[1] < 0 ? 0.62 : 0.58, q[1] < 0 ? q[1] - 0.06 : q[1]], 0.018, frame, 10); });
		[-1, 1].forEach(function (s) { TU(g, [[s * 0.3, 0.58, 0.32], [s * 0.31, 0.6, 0.0], [s * 0.3, 0.63, -0.32]], 0.02, frame, 12); });
		RB(g, -0.3, 0.36, -0.28, 0.3, 0.39, 0.3, 0.012, frame, 1);
		var seat = M(new THREE.PlaneGeometry(0.56, 0.54), cane); seat.rotation.x = -Math.PI / 2; at(seat, 0, 0.392, 0.01); g.add(seat);
		var bf = G(); bf.position.set(0, 0.42, -0.31); bf.rotation.x = -0.22; g.add(bf);
		RB(bf, -0.28, 0, -0.012, 0.28, 0.42, 0.012, 0.01, frame, 1);
		var bp = M(new THREE.PlaneGeometry(0.5, 0.36), cane); at(bp, 0, 0.21, 0.013); bf.add(bp);
		RB(g, -0.27, 0.392, -0.24, 0.27, 0.48, 0.27, 0.05, m.fab2, 3);
	} else {
		// club: low, deep, square leather armchair
		var lt = m.st === 'monochrome' ? m.blackLeather : m.cognac;
		legs4(g, 0.82, 0.84, 0.08, 0.04, m.wood, 'bun');
		RB(g, -0.42, 0.08, -0.42, 0.42, 0.3, 0.42, 0.04, lt, 2);
		[-1, 1].forEach(function (s) { RB(g, s * 0.32 - 0.1, 0.08, -0.42, s * 0.32 + 0.1, 0.58, 0.42, 0.06, lt, 3); });
		RB(g, -0.42, 0.3, -0.42, 0.42, 0.74, -0.24, 0.06, lt, 3);
		RB(g, -0.22, 0.3, -0.25, 0.22, 0.44, 0.41, 0.05, lt, 3);
	}
	return g;
}

/* ================================================================== tables */
export function coffeeTable(m, type) {
	var g = G(), top;
	if (type === 'marble') {
		CY(g, 0, 0.37, 0, 0.46, 0.46, 0.03, m.stone, 48);
		for (var k = 0; k < 3; k++) { var a = k / 3 * Math.PI * 2; ROD(g, [Math.cos(a) * 0.16, 0.37, Math.sin(a) * 0.16], [Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3], 0.014, m.metal, 10); }
		TU(g, (function () { var p = []; for (var i = 0; i <= 24; i++) { var b = i / 24 * Math.PI * 2; p.push([Math.cos(b) * 0.2, 0.18, Math.sin(b) * 0.2]); } return p; })(), 0.008, m.metal, 48, true);
		top = 0.4;
	} else if (type === 'nesting') {
		[[0.12, 0, 0.42, 0.42, m.walnut], [-0.28, 0.12, 0.3, 0.34, m.brass]].forEach(function (q) {
			CY(g, q[0], q[3] - 0.02, q[1], q[2], q[2], 0.02, q[4], 40);
			for (var k = 0; k < 4; k++) { var a = k / 4 * Math.PI * 2 + 0.4; ROD(g, [q[0] + Math.cos(a) * q[2] * 0.8, 0, q[1] + Math.sin(a) * q[2] * 0.8], [q[0] + Math.cos(a) * q[2] * 0.8, q[3] - 0.02, q[1] + Math.sin(a) * q[2] * 0.8], 0.01, m.black, 8); }
		});
		top = 0.42;
	} else if (type === 'glass') {
		var gl = add(g, at(M(L.boxGeo(1.15, 0.012, 0.62), glass('#DDE6E6', 0.3), false), 0, 0.41, 0));
		void gl;
		[-1, 1].forEach(function (s) { TU(g, [[s * 0.5, 0, -0.27], [s * 0.5, 0.4, -0.27], [s * 0.5, 0.4, 0.27], [s * 0.5, 0, 0.27]], 0.012, m.chrome, 24, false, 0.02); });
		ROD(g, [-0.5, 0.01, -0.27], [0.5, 0.01, -0.27], 0.01, m.chrome); ROD(g, [-0.5, 0.01, 0.27], [0.5, 0.01, 0.27], 0.01, m.chrome);
		bookStack(g, m, -0.15, 0.02, 0, 3, 2);
		top = 0.416;
	} else if (type === 'travertine') {
		EX(g, rrShape(1.1, 0.62, 0.3), 0.32, 0.38, m.trav, 0.01);
		EX(g, rrShape(0.7, 0.36, 0.18), 0, 0.32, m.trav, 0.005);
		top = 0.38;
	} else if (type === 'ottoman') {
		legs4(g, 0.9, 0.9, 0.1, 0.05, m.wood, 'bun');
		RB(g, -0.45, 0.1, -0.45, 0.45, 0.42, 0.45, 0.07, m.fab, 3);
		RB(g, -0.2, 0.42, -0.14, 0.2, 0.44, 0.14, 0.01, m.walnut, 1);
		top = 0.44;
	} else {
		RB(g, -0.6, 0.37, -0.32, 0.6, 0.41, 0.32, 0.008, m.wood, 2);
		RB(g, -0.54, 0.1, -0.26, 0.54, 0.12, 0.26, 0.005, m.wood, 1);
		[[-0.54, -0.26], [0.54, -0.26], [-0.54, 0.26], [0.54, 0.26]].forEach(function (q) { RB(g, q[0] - 0.025, 0, q[1] - 0.025, q[0] + 0.025, 0.37, q[1] + 0.025, 0.006, m.wood, 1); });
		bookStack(g, m, 0.25, 0.12, 0, 3, 4);
		top = 0.41;
	}
	// what lies on it
	bookStack(g, m, -0.2, top, 0.02, 2, 7); vase(g, m, 0.15, top, -0.03, 0.8, m.st === 'japandi' ? 'clay' : 'white');
	if (type !== 'nesting') { bowl(g, m, 0.32, top, 0.1, 0.08, m.potD); }
	return g;
}
function sideTable(m, lamp) {
	var g = G();
	CY(g, 0, 0.5, 0, 0.22, 0.22, 0.025, m.wood, 32); CY(g, 0, 0, 0, 0.03, 0.03, 0.5, m.metal, 12); CY(g, 0, 0, 0, 0.16, 0.16, 0.015, m.metal, 32);
	if (lamp) { tableLamp(g, m, 0.02, 0.525, -0.02); }
	return g;
}
function tableLamp(g, m, x, y, z) {
	LA(g, [[0, 0], [0.07, 0], [0.09, 0.08], [0.06, 0.2], [0.03, 0.24], [0, 0.24]], m.st === 'japandi' || m.st === 'mediterranean' ? m.terracotta : m.potW, x, y, z, 28);
	ROD(g, [x, y + 0.24, z], [x, y + 0.32, z], 0.006, m.brass, 8);
	var sh = M(twoSided(new THREE.CylinderGeometry(0.11, 0.15, 0.18, 32, 1, true)), m.lampShade); at(sh, x, y + 0.38, z); g.add(sh);
	if (m.night) { var pl = new THREE.PointLight('#FFC98A', 1.4, 3.5, 2); pl.position.set(x, y + 0.36, z); g.add(pl); }
}
export function diningChair(m, type) {
	var g = G();
	if (type === 'wishbone') {
		var w = m.st === 'scandinavian' || m.st === 'japandi' ? m.oak : m.wood, cord = rattanMat('#D9C7A6');
		[[-0.22, 0.2], [0.22, 0.2]].forEach(function (q) { ROD(g, [q[0], 0, q[1]], [q[0], 0.44, q[1] - 0.01], 0.016, w, 10); });
		[-1, 1].forEach(function (s) { TU(g, [[s * 0.21, 0, -0.2], [s * 0.22, 0.44, -0.19], [s * 0.24, 0.7, -0.08]], 0.017, w, 10); });
		TU(g, [[-0.24, 0.7, -0.08], [-0.21, 0.72, -0.22], [0, 0.73, -0.27], [0.21, 0.72, -0.22], [0.24, 0.7, -0.08]], 0.019, w, 30);
		ROD(g, [0, 0.46, -0.2], [0, 0.6, -0.25], 0.014, w); ROD(g, [0, 0.6, -0.25], [-0.07, 0.72, -0.265], 0.012, w); ROD(g, [0, 0.6, -0.25], [0.07, 0.72, -0.265], 0.012, w);
		RB(g, -0.23, 0.42, -0.21, 0.23, 0.45, 0.21, 0.01, w, 1);
		var seat = M(new THREE.PlaneGeometry(0.42, 0.38), cord); seat.rotation.x = -Math.PI / 2; at(seat, 0, 0.452, 0); g.add(seat);
	} else if (type === 'metal') {
		var mt = m.black;
		CY(g, 0, 0.44, 0, 0.21, 0.21, 0.025, m.st === 'industrial' ? m.wood : mt, 32);
		for (var k = 0; k < 4; k++) { var a = k / 4 * Math.PI * 2 + Math.PI / 4; ROD(g, [Math.cos(a) * 0.15, 0.44, Math.sin(a) * 0.15], [Math.cos(a) * 0.21, 0, Math.sin(a) * 0.21], 0.011, mt, 8); }
		TU(g, (function () { var p = []; for (var i = 0; i <= 16; i++) { var b = i / 16 * Math.PI * 2; p.push([Math.cos(b) * 0.175, 0.17, Math.sin(b) * 0.175]); } return p; })(), 0.007, mt, 32, true);
		TU(g, [[-0.16, 0.45, -0.12], [-0.19, 0.65, -0.2], [-0.12, 0.82, -0.23], [0, 0.84, -0.24], [0.12, 0.82, -0.23], [0.19, 0.65, -0.2], [0.16, 0.45, -0.12]], 0.011, mt, 40);
		TU(g, [[-0.16, 0.66, -0.2], [0, 0.69, -0.23], [0.16, 0.66, -0.2]], 0.008, mt, 16);
	} else if (type === 'cantilever') {
		var ch = m.chrome, lt = m.st === 'monochrome' ? m.blackLeather : m.cognac;
		[-1, 1].forEach(function (s) { TU(g, [[s * 0.22, 0.012, -0.22], [s * 0.22, 0.012, 0.2], [s * 0.22, 0.03, 0.25], [s * 0.22, 0.4, 0.24], [s * 0.22, 0.43, 0.2], [s * 0.22, 0.43, -0.18], [s * 0.22, 0.47, -0.22], [s * 0.22, 0.86, -0.27]], 0.012, ch, 80, false, 0.05); });
		ROD(g, [-0.22, 0.012, -0.22], [0.22, 0.012, -0.22], 0.012, ch);
		RB(g, -0.23, 0.43, -0.2, 0.23, 0.47, 0.21, 0.012, lt, 2);
		var bk = M(rbGeo(0.46, 0.28, 0.02, 0.008, 2), lt); at(bk, 0, 0.7, -0.255); bk.rotation.x = -0.12; g.add(bk);
	} else if (type === 'windsor') {
		var wd = m.st === 'scandinavian' ? m.oak : m.wood;
		EX(g, rrShape(0.46, 0.42, 0.14), 0.42, 0.46, wd, 0.008);
		[[-0.18, 0.15], [0.18, 0.15], [-0.18, -0.15], [0.18, -0.15]].forEach(function (q) { ROD(g, [q[0], 0.43, q[1]], [q[0] * 1.25, 0, q[1] * 1.25], 0.016, wd, 10); });
		ROD(g, [-0.2, 0.15, 0.16], [-0.2, 0.15, -0.16], 0.01, wd); ROD(g, [0.2, 0.15, 0.16], [0.2, 0.15, -0.16], 0.01, wd); ROD(g, [-0.2, 0.15, 0], [0.2, 0.15, 0], 0.01, wd);
		TU(g, [[-0.22, 0.86, -0.16], [-0.12, 0.9, -0.23], [0, 0.91, -0.25], [0.12, 0.9, -0.23], [0.22, 0.86, -0.16]], 0.022, wd, 30);
		for (var sp = -3; sp <= 3; sp++) { ROD(g, [sp * 0.06, 0.46, -0.17], [sp * 0.065, 0.88, -0.23 + Math.abs(sp) * 0.012], 0.007, wd, 6); }
	} else if (type === 'bench') {
		legs4(g, 0.4, 0.4, 0.42, 0.04, m.wood, 'taper');
		RB(g, -0.2, 0.4, -0.2, 0.2, 0.47, 0.2, 0.03, m.fab, 2);
	} else {
		// upholstered: tapered legs, padded seat and curved back
		legs4(g, 0.44, 0.46, 0.42, 0.035, m.legs === m.metal && m.fin === 'brass' ? m.brass : m.wood, 'taper');
		RB(g, -0.23, 0.4, -0.23, 0.23, 0.5, 0.24, 0.04, m.fab, 3);
		var b = M(rbGeo(0.46, 0.46, 0.07, 0.03, 3), m.fab); at(b, 0, 0.74, -0.23); b.rotation.x = -0.14; g.add(b);
	}
	return g;
}
export function diningTable(m, type, len) {
	var g = G(), d = 0.95;
	len = len || 2.0;
	if (type === 'round') {
		var r = Math.min(0.75, Math.max(0.55, len / 2.6));
		CY(g, 0, 0.72, 0, r, r, 0.035, m.st === 'luxury' || m.st === 'classic' ? m.stone : m.wood, 64);
		LA(g, [[0, 0], [0.32, 0], [0.33, 0.03], [0.12, 0.12], [0.07, 0.4], [0.09, 0.68], [0.16, 0.72], [0, 0.72]], m.st === 'japandi' ? m.oak : m.white, 0, 0, 0, 48);
		return g;
	}
	if (type === 'oval_marble') {
		var t = M(new THREE.CylinderGeometry(0.5, 0.5, 0.03, 64), m.stone); t.scale.set(len / 1.0, 1, 1); at(t, 0, 0.735, 0); g.add(t);
		[-1, 1].forEach(function (s) { LA(g, [[0, 0], [0.22, 0], [0.22, 0.02], [0.1, 0.06], [0.08, 0.66], [0.14, 0.72], [0, 0.72]], m.stone, s * len * 0.25, 0, 0, 40, 1, 0.8); });
		return g;
	}
	if (type === 'live_edge') {
		var s = new THREE.Shape(), n = 14, r2 = rnd(9);
		s.moveTo(-len / 2, -d / 2 + 0.04); for (var i = 0; i <= n; i++) { s.lineTo(-len / 2 + len * i / n, -d / 2 + 0.03 * Math.sin(i * 1.3) + r2() * 0.03); }
		for (var j = n; j >= 0; j--) { s.lineTo(-len / 2 + len * j / n, d / 2 - 0.03 * Math.cos(j * 1.1) - r2() * 0.03); }
		EX(g, s, 0.7, 0.755, veneer('#8A5A3A'), 0.004, 4);
		[-1, 1].forEach(function (k) { var x = k * (len / 2 - 0.25); TU(g, [[x, 0.01, -0.36], [x, 0.69, -0.36], [x, 0.69, 0.36], [x, 0.01, 0.36]], 0.018, m.black, 24, false, 0.01); ROD(g, [x, 0.01, -0.36], [x, 0.01, 0.36], 0.018, m.black); });
		return g;
	}
	if (type === 'trestle') {
		RB(g, -len / 2, 0.7, -d / 2, len / 2, 0.76, d / 2, 0.008, veneer('#9C7452'), 2);
		[-1, 1].forEach(function (k) {
			var x = k * (len / 2 - 0.3);
			[-1, 1].forEach(function (q) { ROD(g, [x, 0.03, q * 0.35], [x, 0.69, -q * 0.3], 0.035, veneer('#9C7452'), 6); });
			RB(g, x - 0.04, 0, -0.4, x + 0.04, 0.06, 0.4, 0.01, veneer('#9C7452'), 1); RB(g, x - 0.04, 0.64, -0.38, x + 0.04, 0.7, 0.38, 0.01, veneer('#9C7452'), 1);
		});
		ROD(g, [-(len / 2 - 0.3), 0.36, 0], [len / 2 - 0.3, 0.36, 0], 0.03, veneer('#9C7452'), 6);
		return g;
	}
	if (type === 'glass') {
		add(g, at(M(L.boxGeo(len, 0.015, d), glass('#DDE6E6', 0.32), false), 0, 0.735, 0));
		[-1, 1].forEach(function (k) { var x = k * (len / 2 - 0.2); TU(g, [[x - 0.25, 0.005, 0], [x, 0.36, 0], [x + 0.25, 0.725, 0]], 0.02, m.chrome, 16, false, 0); TU(g, [[x + 0.25, 0.005, 0], [x, 0.36, 0], [x - 0.25, 0.725, 0]], 0.02, m.chrome, 16, false, 0); });
		return g;
	}
	// rect_wood: solid top with slim tapered legs set in from the corners
	RB(g, -len / 2, 0.71, -d / 2, len / 2, 0.75, d / 2, 0.01, m.wood, 2);
	RB(g, -len / 2 + 0.1, 0.64, -d / 2 + 0.08, len / 2 - 0.1, 0.71, d / 2 - 0.08, 0.004, m.wood, 1);
	[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { var x = q[0] * (len / 2 - 0.12), z = q[1] * (d / 2 - 0.1); ROD(g, [x, 0.71, z], [x + q[0] * 0.03, 0, z + q[1] * 0.02], 0.025, m.wood, 10); });
	return g;
}
// Table with chairs on both long sides, a runner and a vase.
export function diningSet(m, tType, cType, n, len) {
	var g = G(); len = len || Math.max(1.6, Math.ceil(n / 2) * 0.62 + 0.3);
	add(g, diningTable(m, tType, len));
	var round = tType === 'round', per = Math.ceil(n / 2);
	if (round) {
		var r = Math.min(0.75, Math.max(0.55, len / 2.6));
		for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2 + Math.PI / 4, ch = diningChair(m, cType === 'bench' ? 'upholstered' : cType); ch.position.set(Math.cos(a) * (r + 0.12), 0, Math.sin(a) * (r + 0.12)); ch.rotation.y = -a - Math.PI / 2; g.add(ch); }
	} else {
		[-1, 1].forEach(function (side) {
			if (cType === 'bench' && side < 0) { var b = G(); legs4(b, len - 0.4, 0.36, 0.42, 0.05, m.wood, 'taper'); RB(b, -(len - 0.4) / 2, 0.42, -0.18, (len - 0.4) / 2, 0.47, 0.18, 0.02, m.fab, 2); b.position.set(0, 0, -0.62); g.add(b); return; }
			for (var k = 0; k < per; k++) { var x = -len / 2 + (k + 0.5) * len / per, c2 = diningChair(m, cType === 'bench' ? 'upholstered' : cType); c2.position.set(x, 0, side * 0.62); c2.rotation.y = side > 0 ? Math.PI : 0; g.add(c2); }
		});
	}
	var top = { round: 0.755, oval_marble: 0.75, live_edge: 0.755, trestle: 0.76, glass: 0.743 }[tType] || 0.75;
	if (!round) { RB(g, -len * 0.3, top, -0.16, len * 0.3, top + 0.004, 0.16, 0.001, m.acc2, 1); }
	vase(g, m, 0, top, 0, 1.1, m.st === 'mediterranean' ? 'clay' : 'white'); candle(g, m, 0.25, top, 0.05); candle(g, m, -0.3, top, -0.04);
	return g;
}

/* ================================================================== beds */
export function bed(m, type, double) {
	var g = G(), bw = double ? 1.8 : 0.9, L2 = 2.05, fr = m.st === 'monochrome' ? m.dark : m.wood, plat = type === 'platform';
	var mattTop = plat ? 0.42 : 0.56, z0 = -L2 / 2, z1 = L2 / 2;
	if (type === 'upholstered') {
		RB(g, -bw / 2 - 0.06, 0.06, z0, bw / 2 + 0.06, 0.32, z1 + 0.05, 0.04, m.fab, 2);
		BX(g, -bw / 2, 0, z0 + 0.1, bw / 2, 0.06, z1 - 0.1, m.plinth);
		var ch = Math.round((bw + 0.12) / 0.2), cw = (bw + 0.12) / ch;
		for (var i = 0; i < ch; i++) { RB(g, -bw / 2 - 0.06 + i * cw + 0.004, 0.25, z0 - 0.1, -bw / 2 - 0.06 + (i + 1) * cw - 0.004, 1.3, z0 + 0.02, 0.05, m.fab, 3); }
	} else if (type === 'wood' || type === 'canopy') {
		RB(g, -bw / 2 - 0.05, 0.2, z0, bw / 2 + 0.05, 0.36, z1 + 0.05, 0.01, fr, 2);
		legs4(g, bw + 0.06, L2 + 0.05, 0.2, 0.03, fr, 'square');
		if (type === 'wood') { for (var x = -bw / 2 - 0.03; x < bw / 2 + 0.05; x += 0.09) { RB(g, x, 0.36, z0 - 0.06, x + 0.06, 1.1, z0 - 0.02, 0.008, fr, 1); } RB(g, -bw / 2 - 0.06, 1.08, z0 - 0.07, bw / 2 + 0.06, 1.14, z0, 0.01, fr, 1); }
		else {
			var post = m.st === 'industrial' || m.st === 'monochrome' ? m.black : fr, Hc = 2.15;
			[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { BX(g, q[0] * (bw / 2 + 0.06) - 0.025, 0, q[1] * (L2 / 2 + 0.02) - 0.025, q[0] * (bw / 2 + 0.06) + 0.025, Hc, q[1] * (L2 / 2 + 0.02) + 0.025, post); });
			[[-1, 0], [1, 0]].forEach(function (q) { BX(g, q[0] * (bw / 2 + 0.06) - 0.02, Hc - 0.05, z0 - 0.04, q[0] * (bw / 2 + 0.06) + 0.02, Hc, z1 + 0.04, post); });
			[z0 - 0.02, z1 + 0.02].forEach(function (z) { BX(g, -bw / 2 - 0.08, Hc - 0.05, z - 0.02, bw / 2 + 0.08, Hc, z + 0.02, post); });
			RB(g, -bw / 2 - 0.03, 0.36, z0 - 0.05, bw / 2 + 0.03, 1.0, z0 - 0.01, 0.02, m.fab, 2);
			var sheer = glass('#F7F3EC', 0.55);
			[-1, 1].forEach(function (s) { drape(g, sheer, s * (bw / 2 + 0.06), z1 - 0.2, z1 + 0.02, Hc - 0.06, true); });
		}
	} else if (plat) {
		RB(g, -bw / 2 - 0.3, 0, z0 - 0.02, bw / 2 + 0.3, 0.2, z1 + 0.25, 0.01, m.oak, 2);
		RB(g, -bw / 2 - 0.3, 0.2, z0 - 0.06, bw / 2 + 0.3, 0.62, z0, 0.01, m.oak, 2);
	} else if (type === 'panel') {
		RB(g, -bw / 2 - 0.04, 0.12, z0, bw / 2 + 0.04, 0.32, z1 + 0.04, 0.02, m.fab, 2);
		BX(g, -bw / 2, 0, z0 + 0.1, bw / 2, 0.12, z1 - 0.1, m.plinth);
		RB(g, -bw / 2 - 1.0, 0.0, z0 - 0.1, bw / 2 + 1.0, 1.25, z0 - 0.02, 0.01, m.wood, 2);
		RB(g, -bw / 2 - 0.08, 0.35, z0 - 0.04, bw / 2 + 0.08, 1.15, z0 + 0.04, 0.04, m.fab2, 3);
		[-1, 1].forEach(function (s) { RB(g, s * (bw / 2 + 0.55) - 0.3, 0.42, z0 - 0.02, s * (bw / 2 + 0.55) + 0.3, 0.5, z0 + 0.38, 0.01, m.wood, 1); RB(g, s * (bw / 2 + 0.55) - 0.04, 0.9, z0 - 0.02, s * (bw / 2 + 0.55) + 0.04, 0.98, z0 + 0.04, 0.01, m.night ? emissive() : m.brass, 1); });
	} else {
		// metal: tubular headboard and footboard
		var bl = m.black;
		[[z0, 1.15], [z1, 0.7]].forEach(function (q) {
			[-1, 1].forEach(function (s) { ROD(g, [s * (bw / 2 + 0.04), 0, q[0]], [s * (bw / 2 + 0.04), q[1], q[0]], 0.02, bl); SP(g, s * (bw / 2 + 0.04), q[1] + 0.02, q[0], 0.028, m.brass, 12, 8); });
			ROD(g, [-(bw / 2 + 0.04), q[1] - 0.04, q[0]], [bw / 2 + 0.04, q[1] - 0.04, q[0]], 0.016, bl); ROD(g, [-(bw / 2 + 0.04), 0.38, q[0]], [bw / 2 + 0.04, 0.38, q[0]], 0.014, bl);
			for (var xb = -bw / 2 + 0.08; xb < bw / 2; xb += 0.14) { ROD(g, [xb, 0.38, q[0]], [xb, q[1] - 0.04, q[0]], 0.007, bl, 6); }
		});
		RB(g, -bw / 2, 0.28, z0, bw / 2, 0.36, z1, 0.01, m.dark, 1);
	}
	// mattress, duvet with the turned-down top, pillows, cushions and a throw
	var mb = plat ? 0.2 : (type === 'upholstered' ? 0.32 : 0.36);
	RB(g, -bw / 2 + 0.01, mb, z0 + 0.02, bw / 2 - 0.01, mattTop, z1 - 0.02, 0.05, m.linenWhite, 3);
	RB(g, -bw / 2 - 0.03, mattTop - 0.16, z0 + 0.62, bw / 2 + 0.03, mattTop + 0.06, z1 + 0.02, 0.05, m.duvet, 3);
	RB(g, -bw / 2 - 0.035, mattTop + 0.02, z0 + 0.6, bw / 2 + 0.035, mattTop + 0.075, z0 + 0.86, 0.025, m.linenWhite, 3);
	var np = double ? 2 : 1, pw = (bw - 0.1) / np;
	for (var p = 0; p < np; p++) {
		var px = -bw / 2 + 0.05 + (p + 0.5) * pw;
		var pl = M(rbGeo(pw - 0.04, 0.38, 0.13, 0.06, 3), m.linenWhite); at(pl, px, mattTop + 0.17, z0 + 0.14); pl.rotation.x = -0.45; g.add(pl);
		var pl2 = M(rbGeo(pw - 0.12, 0.32, 0.12, 0.06, 3), p ? m.acc2 : m.acc1); at(pl2, px, mattTop + 0.15, z0 + 0.3); pl2.rotation.x = -0.4; g.add(pl2);
	}
	RB(g, -bw / 2 - 0.04, mattTop + 0.055, z1 - 0.55, bw / 2 + 0.04, mattTop + 0.085, z1 - 0.15, 0.012, m.acc3, 2);
	RB(g, bw / 2 + 0.01, mattTop - 0.25, z1 - 0.55, bw / 2 + 0.04, mattTop + 0.08, z1 - 0.15, 0.012, m.acc3, 2);
	// bedside tables and lamps (the wall-panel bed has its own)
	if (type !== 'panel') {
		[-1, 1].forEach(function (s) {
			var nx = s * (bw / 2 + 0.38);
			if (plat) { RB(g, nx - 0.22, 0, z0 + 0.0, nx + 0.22, 0.3, z0 + 0.4, 0.01, m.oak, 1); tableLamp(g, m, nx, 0.3, z0 + 0.2); }
			else { RB(g, nx - 0.24, 0.12, z0 + 0.0, nx + 0.24, 0.55, z0 + 0.4, 0.01, m.wood, 1); [[-0.2, 0.04], [0.2, 0.04], [-0.2, 0.36], [0.2, 0.36]].forEach(function (q) { CY(g, nx + q[0], 0, z0 + q[1], 0.012, 0.012, 0.12, m.metal, 8); }); BX(g, nx - 0.22, 0.34, z0 + 0.401, nx + 0.22, 0.342, z0 + 0.402, m.dark); tableLamp(g, m, nx, 0.55, z0 + 0.2); }
		});
	}
	return g;
}

/* ================================================================== storage */
export function wardrobe(m, type, w, h) {
	var g = G(), d = 0.62, fr = m.c.fronts_color ? L.solid(L.col(m.c.fronts_color, '#E9E4DC'), 0.6) : L.solid(L.shadeHex(m.pal[0], -0.03), 0.6);
	h = Math.min(h || 2.4, 2.45); w = w || 2.4;
	var n = Math.max(2, Math.round(w / 0.55)), dw = w / n;
	if (type === 'open') {
		var fw = m.wood;
		[-w / 2, w / 2 - 0.025].forEach(function (x) { BX(g, x, 0, -d / 2, x + 0.025, h, d / 2, fw); });
		BX(g, -w / 2, h - 0.025, -d / 2, w / 2, h, d / 2, fw); BX(g, -w / 2, 0, -d / 2, w / 2, 0.06, d / 2, fw); BX(g, -w / 2, 0, -d / 2, w / 2, h, -d / 2 + 0.01, L.solid(L.shadeHex(m.pal[0], -0.06), 0.8));
		var mid = -w / 2 + w * 0.62; BX(g, mid, 0.06, -d / 2, mid + 0.025, h - 0.025, d / 2, fw);
		ROD(g, [-w / 2, 1.9, 0], [mid, 1.9, 0], 0.012, m.metal);
		var r = rnd(4), x = -w / 2 + 0.06, cols = [m.acc1, m.acc2, m.acc3, m.soft, m.linenWhite, m.fab];
		while (x < mid - 0.08) { var t = 0.035 + r() * 0.03, lh = 0.7 + r() * 0.5; RB(g, x, 1.9 - lh, -0.22, x + t, 1.88, 0.22, 0.01, cols[Math.floor(r() * cols.length)], 1); ROD(g, [x + t / 2, 1.9, 0], [x + t / 2, 1.96, 0], 0.003, m.chrome, 6); x += t + 0.02; }
		for (var sy = 0.45; sy < h - 0.3; sy += 0.38) { BX(g, mid + 0.025, sy, -d / 2, w / 2 - 0.025, sy + 0.02, d / 2, fw); for (var f = 0; f < 3; f++) { RB(g, mid + 0.05, sy + 0.02 + f * 0.06, -0.15, w / 2 - 0.06, sy + 0.08 + f * 0.06, 0.15, 0.015, cols[(f + Math.round(sy * 10)) % cols.length], 2); } }
		for (var sx = -w / 2 + 0.08; sx < mid - 0.15; sx += 0.3) { RB(g, sx, 0.06, 0.05, sx + 0.1, 0.14, 0.27, 0.03, m.dark, 2); RB(g, sx + 0.12, 0.06, 0.05, sx + 0.22, 0.14, 0.27, 0.03, m.dark, 2); }
		return g;
	}
	BX(g, -w / 2, 0, -d / 2, w / 2, h, d / 2 - 0.022, L.solid(L.shadeHex(m.pal[0], -0.08), 0.7));
	BX(g, -w / 2, 0, d / 2 - 0.03, w / 2, 0.08, d / 2, m.plinth);
	if (type === 'sliding' || type === 'mirrored') {
		var np = Math.max(2, Math.round(w / 1.0)), pw = w / np + 0.03;
		for (var i = 0; i < np; i++) {
			var x0 = -w / 2 + i * (w / np) - (i ? 0.015 : 0), zf = d / 2 + (i % 2 ? 0.035 : 0.0);
			if (type === 'mirrored') { RB(g, x0, 0.08, zf - 0.02, x0 + pw - 0.03, h - 0.04, zf, 0.004, m.black, 1); BX(g, x0 + 0.02, 0.1, zf, x0 + pw - 0.05, h - 0.06, zf + 0.004, mirror()); }
			else { RB(g, x0, 0.08, zf - 0.02, x0 + pw - 0.03, h - 0.04, zf, 0.004, m.st === 'japandi' ? m.oak : fr, 1); BX(g, x0 + pw - 0.08, 1.0, zf, x0 + pw - 0.05, 1.3, zf + 0.004, m.dark); }
		}
		BX(g, -w / 2, h - 0.04, d / 2 - 0.02, w / 2, h, d / 2 + 0.06, m.dark);
		return g;
	}
	var frontMat = type === 'fluted' ? L.pbr('wtile', { pattern: 'fluted', color: L.shadeHex(m.pal[1], 0.15), size: 0.028 }, { normal: 1.8 }) : (type === 'glass' ? glass('#2F2A26', 0.45) : fr);
	for (var k = 0; k < n; k++) {
		var dx0 = -w / 2 + k * dw + 0.0015, dx1 = dx0 + dw - 0.003;
		if (type === 'glass') {
			RB(g, dx0, 0.08, d / 2 - 0.022, dx1, h - 0.002, d / 2, 0.003, m.brass, 1);
			add(g, at(M(L.boxGeo(dx1 - dx0 - 0.04, h - 0.14, 0.006), frontMat, false), (dx0 + dx1) / 2, (h + 0.08) / 2, d / 2 + 0.002));
			for (var y = 0.5; y < h - 0.3; y += 0.45) { BX(g, dx0 + 0.02, y, -d / 2 + 0.02, dx1 - 0.02, y + 0.015, d / 2 - 0.05, glass('#E8E2D8', 0.6)); }
			if (k % 2 === 0) { var rr = rnd(k + 3); for (var cx = dx0 + 0.06; cx < dx1 - 0.06; cx += 0.06) { RB(g, cx, 1.0, -0.2, cx + 0.04, 1.85, 0.2, 0.01, [m.acc1, m.acc2, m.soft, m.linenWhite][Math.floor(rr() * 4)], 1); } }
			BX(g, dx0 + 0.02, h - 0.05, -d / 2 + 0.05, dx1 - 0.02, h - 0.035, d / 2 - 0.05, m.night ? emissive('#FFE7C4', 1.6) : L.solid('#FFF5E6', 0.3));
		} else {
			RB(g, dx0, 0.08, d / 2 - 0.022, dx1, h - 0.002, d / 2 + (type === 'fluted' ? 0.004 : 0), 0.003, frontMat, 1);
			if (type === 'hinged') { var hx = k % 2 ? dx0 + 0.05 : dx1 - 0.05; RB(g, hx - 0.01, 0.95, d / 2, hx + 0.01, 1.35, d / 2 + 0.035, 0.008, m.fin === 'brass' ? m.brass : m.black, 2); }
		}
	}
	return g;
}
export function mediaWall(m, type, w, H) {
	var g = G(); w = w || 2.6; H = H || 2.7;
	var el = (m.c && m.c.electronics) || [], big = el.indexOf('tv') !== -1;
	var tvW = big ? 1.8 : 1.45, tvH = big ? 1.02 : 0.83, tvY = big ? 0.98 : 1.05;
	// devices around the TV: soundbar (on the console or under the TV), game console, a pair of speakers
	function extras(z, top, tz, sx) {
		var low = top !== null && tvY - top > 0.15;
		if (el.indexOf('soundbar') !== -1) { var sb = electronic(m, 'soundbar'); sb.position.set(0, low ? top : tvY - 0.12, low ? tz + 0.08 : z + 0.05); g.add(sb); }
		if (el.indexOf('console') !== -1 && top !== null) { var cn = electronic(m, 'console'); cn.position.set(0.2, top, tz); cn.rotation.y = 0.2; g.add(cn); }
		if (el.indexOf('speakers') !== -1) { [-1, 1].forEach(function (sd) { var sp = electronic(m, 'speakers'); sp.position.set(sd * sx, 0, (tz || 0.2) + 0.08); g.add(sp); }); }
	}
	function tv(z) { RB(g, -tvW / 2, tvY, z, tvW / 2, tvY + tvH, z + 0.03, 0.004, m.dark, 1); BX(g, -tvW / 2 + 0.006, tvY + 0.006, z + 0.03, tvW / 2 - 0.006, tvY + tvH - 0.006, z + 0.032, m.screen); }
	if (type === 'none') { RB(g, -0.9, 0, -0.22, 0.9, 0.75, 0.22, 0.01, m.wood, 1); vase(g, m, -0.5, 0.75, 0, 1.2); bookStack(g, m, 0.4, 0.75, 0, 3, 2); return g; }
	if (type === 'built_in') {
		var sh = m.st === 'classic' ? L.solid(L.shadeHex(m.pal[0], -0.04), 0.6) : m.wood, d = 0.38, side = Math.max(0.3, (w - tvW - 0.4) / 2);
		BX(g, -w / 2, 0, 0, w / 2, 0.55, d, sh); BX(g, -w / 2, 0.55, 0, w / 2, 0.58, d + 0.02, sh);
		[-w / 2, -w / 2 + side - 0.025, w / 2 - side, w / 2 - 0.025].forEach(function (x) { BX(g, x, 0.58, 0, x + 0.025, H, d, sh); });
		BX(g, -w / 2, H - 0.3, 0, w / 2, H, d, sh);
		[[-w / 2 + 0.025, -w / 2 + side - 0.025], [w / 2 - side + 0.025, w / 2 - 0.025]].forEach(function (q, si) {
			BX(g, q[0], 0.58, 0, q[1], H - 0.3, 0.01, L.solid(L.shadeHex(m.pal[1], -0.05), 0.85));
			for (var y = 0.58; y < H - 0.6; y += 0.42) {
				BX(g, q[0], y, 0, q[1], y + 0.025, d, sh);
				var seed = Math.round(y * 10) + si * 7;
				if ((seed % 3) !== 1) { bookRow(g, m, q[0] + 0.02, q[1] - (seed % 2 ? 0.12 : 0.02), y + 0.025, d / 2, 0.22, 0.28, seed); } else { vase(g, m, (q[0] + q[1]) / 2, y + 0.025, d / 2, 0.8, seed % 2 ? 'dark' : 'white'); }
				if (m.night) { BX(g, q[0], y + 0.4, 0.02, q[1], y + 0.405, d - 0.02, emissive('#FFE3BA', 1.2)); }
			}
		});
		BX(g, -w / 2 + side, 0.58, 0, w / 2 - side, H - 0.3, 0.012, L.solid(L.shadeHex(m.pal[3], 0.2), 0.8));
		tv(0.02); extras(0.05, null, d + 0.25, tvW / 2 + 0.25);
		for (var k = 0; k < 4; k++) { BX(g, -w / 2 + 0.02 + k * w / 4, 0.03, d, -w / 2 + (k + 1) * w / 4 - 0.02, 0.52, d + 0.004, sh); }
		vase(g, m, -0.5, 0.58, d / 2 + 0.05, 1.1, 'white'); bookStack(g, m, 0.5, 0.58, d / 2, 3, 3);
		return g;
	}
	if (type === 'stone') {
		RB(g, -w / 2, 0, 0, w / 2, H, 0.06, 0.004, m.st === 'wood_stone' ? m.trav : marble(m.st === 'luxury' ? 'calacatta' : 'black'), 1);
		tv(0.06); extras(0.09, 0.34, 0.24, w * 0.42 + 0.22);
		RB(g, -w * 0.42, 0.28, 0.06, w * 0.42, 0.34, 0.42, 0.006, m.wood, 1);
		vase(g, m, -w * 0.3, 0.34, 0.18, 1.1, 'dark'); bookStack(g, m, w * 0.28, 0.34, 0.18, 3, 4);
		if (m.night) { BX(g, -w / 2, H - 0.02, 0.06, w / 2, H, 0.09, emissive('#FFE3BA', 1.5)); }
		return g;
	}
	// lowboard: floating cabinet with fluted fronts, the TV on the wall above
	var lw = Math.min(2.2, w);
	RB(g, -lw / 2, 0.22, 0, lw / 2, 0.62, 0.42, 0.006, m.wood, 1);
	var fl = L.pbr('wtile', { pattern: 'fluted', color: '#B98D63', size: 0.025 }, { normal: 2 });
	for (var d2 = 0; d2 < 3; d2++) { RB(g, -lw / 2 + 0.03 + d2 * (lw - 0.06) / 3 + 0.004, 0.25, 0.42, -lw / 2 + 0.03 + (d2 + 1) * (lw - 0.06) / 3 - 0.004, 0.59, 0.425, 0.002, m.st === 'monochrome' ? m.dark : fl, 1); }
	tv(0); extras(0.03, 0.62, 0.2, lw / 2 + 0.25);
	vase(g, m, -lw * 0.36, 0.62, 0.2, 1.2, 'white'); bookStack(g, m, lw * 0.3, 0.62, 0.2, 3, 3); CY(g, lw * 0.3, 0.71, 0.2, 0.06, 0.06, 0.1, m.potD, 20);
	return g;
}

/* ================================================================== textiles, art */
// Pleated curtain hanging from y = top down to the floor, from z0 to z1 (local), at x.
function drape(g, mat, x, z0, z1, top, along) {
	var w = Math.abs(z1 - z0), n = Math.max(6, Math.round(w / 0.05)), geo = new THREE.PlaneGeometry(w, top - 0.01, n * 2, 1), p = geo.attributes.position;
	for (var i = 0; i < p.count; i++) { var u = p.getX(i); p.setZ(i, Math.sin((u / w + 0.5) * n * Math.PI) * 0.035); }
	geo.computeVertexNormals();
	var cm = M(twoSided(geo), mat); cm.position.set(x, top / 2, (z0 + z1) / 2); if (along) { cm.rotation.y = Math.PI / 2; }
	g.add(cm); return cm;
}
// A gathered curtain across x0..x1 from height yb to yt (wall-local, a little in front of the wall).
function drape2(g, mat, x0, x1, yb, yt, z) {
	var w = Math.abs(x1 - x0), n = Math.max(6, Math.round(w / 0.05)), geo = new THREE.PlaneGeometry(w, yt - yb, n * 2, 1), p = geo.attributes.position;
	for (var i = 0; i < p.count; i++) { var u = p.getX(i); p.setZ(i, Math.sin((u / w + 0.5) * n * Math.PI) * 0.025); }
	geo.computeVertexNormals();
	var cm = M(twoSided(geo), mat); cm.position.set((x0 + x1) / 2, (yb + yt) / 2, z); g.add(cm); return cm;
}
export function rug(m, type, w, d) {
	var g = G();
	if (type === 'none') { return g; }
	var col = { plain: [L.shadeHex(m.pal[1], 0.2), m.pal[3]], berber: ['#EDE6DA', '#2E2A27'], oriental: ['#8E3B32', '#2B3448'], jute: ['#C2A57A', '#8A6A44'], round: [L.shadeHex(m.pal[1], 0.1), m.pal[3]], stripe: [m.pal[0], m.pal[3]],
		shag: [L.shadeHex(m.pal[0], -0.03), m.pal[2]], geometric: [m.pal[0], m.pal[3]], kilim: ['#A8553E', '#2E3B4E'], cowhide: ['#F1EDE6', '#3A2E26'], vintage: ['#B4675A', '#3F4A5C'] }[type] || ['#D8CFC2', '#3A3633'];
	var tone = TONE[m.c && m.c.rug_tone];
	if (tone) { col = [tone, type === 'plain' || type === 'shag' || type === 'round' || type === 'jute' ? L.shadeHex(tone, -0.3) : (type === 'cowhide' ? '#3A2E26' : col[1])]; }
	var kind = type === 'round' ? 'plain' : type, h = type === 'shag' ? 0.035 : 0.012, mat = L.pbr('rug', { kind: kind, color: col[0], accent: col[1] }, { normal: type === 'jute' ? 1.6 : (type === 'shag' ? 2.4 : 1.1) });
	var geo;
	if (type === 'round') { geo = new THREE.CircleGeometry(Math.min(w, d) / 2, 64); }
	else if (type === 'cowhide') {
		// an irregular hide with four short legs
		var hw = Math.min(w, 2.0) / 2, hd = Math.min(d, 1.6) / 2, sh = new THREE.Shape(), pts = [];
		for (var i = 0; i < 48; i++) { var a = i / 48 * Math.PI * 2, rr = 1 + 0.06 * Math.sin(a * 5 + 1) + 0.04 * Math.sin(a * 9), leg = Math.pow(Math.max(0, Math.cos((a % (Math.PI / 2)) * 2 - Math.PI / 2 + 0.6)), 8) * 0.18; pts.push([Math.cos(a) * hw * (rr + leg), Math.sin(a) * hd * (rr + leg * 0.6)]); }
		sh.moveTo(pts[0][0], pts[0][1]); pts.forEach(function (q) { sh.lineTo(q[0], q[1]); });
		geo = new THREE.ShapeGeometry(sh, 2); var uv = geo.attributes.uv, pp = geo.attributes.position;
		for (var k = 0; k < uv.count; k++) { uv.setXY(k, pp.getX(k) / (hw * 2.4) + 0.5, pp.getY(k) / (hd * 2.4) + 0.5); }
	}
	else { geo = new THREE.PlaneGeometry(w, d); }
	var r = M(geo, mat, false); r.rotation.x = -Math.PI / 2; r.position.y = h; g.add(r);
	if (type !== 'cowhide') {
		var edge = type === 'round' ? M(new THREE.CylinderGeometry(Math.min(w, d) / 2, Math.min(w, d) / 2, h, 64, 1, true), mat, false) : M(L.boxGeo(w, h - 0.001, d), mat, false);
		edge.position.y = h / 2; g.add(edge);
	}
	return g;
}
var ART_P = {
	modern_minimal: ['#ECE7DF', '#2B2B2B', '#9A948B', '#C9BBA6'], luxury: ['#E9E2D6', '#1F2A36', '#B0905A', '#7A2E2A'], scandinavian: ['#F1ECE4', '#D3A58C', '#53656F', '#E6C77E'],
	japandi: ['#EEE8DD', '#3B3631', '#A4876A', '#C9B79C'], classic: ['#E6DCC8', '#55684A', '#2F3E52', '#C7A15A'], mediterranean: ['#F1E7D6', '#C66B45', '#3E6E8E', '#E1B860'],
	industrial: ['#E3DFD8', '#2B2B2B', '#A2563A', '#7D8A8E'], wood_stone: ['#ECE6DC', '#7E5C43', '#4F5B4A', '#C9B08A'], warm_neutral: ['#EFE9E0', '#C68F6B', '#5E6F66', '#D9BE8C'], monochrome: ['#F0F0EE', '#1C1C1C', '#8C8C8C', '#5A5A5A']
};
// The visitor's own photo as a material, cropped to fill a w × h frame (centre crop once it is loaded).
function photoMat(url, w, h) {
	var key = 'photo' + url.length + url.slice(-24) + Math.round(w / h * 100);
	return L.cached(key, function () {
		var t = L.imageTexture(url).clone(), fit = function (img) { var a = img.width / img.height, f = w / h; t.repeat.set(a > f ? f / a : 1, a > f ? 1 : a / f); t.offset.set((1 - t.repeat.x) / 2, (1 - t.repeat.y) / 2); t.needsUpdate = true; };
		if (t.image && t.image.width) { fit(t.image); } else { L.onImage(url, fit); }
		return L.stdMat({ map: t, roughness: 0.55 });
	});
}
// A framed picture (local: hangs on a wall at z = 0, facing +z, centred at x, bottom at y).
function picture(g, m, kind, x, y, w, h, seed, frame) {
	var fr = frame || (m.st === 'luxury' || m.st === 'classic' ? m.brass : (m.st === 'monochrome' || m.st === 'industrial' ? m.black : m.oak));
	RB(g, x - w / 2, y, 0, x + w / 2, y + h, 0.03, 0.004, fr, 1);
	BX(g, x - w / 2 + 0.02, y + 0.02, 0.026, x + w / 2 - 0.02, y + h - 0.02, 0.031, m.paper);
	var mt = Math.min(w, h) * 0.08, photo = kind === 'photo' && m.c && m.c.art_photo, aw = w - 0.04 - mt * 2, ah = h - 0.04 - mt * 2;
	var art = photo ? photoMat(m.c.art_photo, aw, ah) : L.pbr('art', { kind: kind === 'photo' ? 'landscape' : kind, seed: seed || 1, p: ART_P[m.st] || ART_P.warm_neutral }, { normal: 0.3 });
	var pl = M(new THREE.PlaneGeometry(aw, ah), art, false); pl.position.set(x, y + h / 2, 0.0315); g.add(pl);
}
export function artwork(m, type, w) {
	var g = G(); w = w || 1.2;
	if (type === 'none') { return g; }
	if (type === 'gallery') {
		var ph = m.c && m.c.art_photo;
		[[-0.45, 1.25, 0.5, 0.65, ph ? 'photo' : 'abstract'], [0.18, 1.45, 0.62, 0.45, 'landscape'], [0.18, 1.05, 0.3, 0.32, 'line'], [0.55, 1.05, 0.32, 0.32, 'geo'], [-0.45, 0.98, 0.42, 0.22, 'line']].forEach(function (q, i) { picture(g, m, q[4], q[0] * w / 1.2, q[1], q[2], q[3], i + 2); });
		return g;
	}
	if (type === 'mirror') {
		var mw = Math.min(1.0, w * 0.7), sh = new THREE.Shape(); sh.moveTo(-mw / 2, 0); sh.lineTo(mw / 2, 0); sh.lineTo(mw / 2, 1.2); sh.absarc(0, 1.2, mw / 2, 0, Math.PI, false); sh.lineTo(-mw / 2, 0);
		var fg = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.01, bevelSegments: 2, curveSegments: 32 });
		var fm = M(fg, m.brass); fm.position.set(0, 0.9, 0); g.add(fm);
		var mg = M(new THREE.ShapeGeometry(sh, 32), mirror(), false); mg.position.set(0, 0.9, 0.045); g.add(mg);
		return g;
	}
	if (type === 'photo') { var pw = Math.min(0.9, w * 0.75); picture(g, m, 'photo', 0, 1.1, pw, pw * 1.25, 3, m.st === 'luxury' || m.st === 'classic' ? m.brass : m.black); return g; }
	var kind = type === 'line' ? 'line' : (type === 'landscape' ? 'landscape' : 'abstract');
	picture(g, m, kind, 0, 1.15, Math.min(1.2, w), Math.min(1.2, w) * (kind === 'landscape' ? 0.66 : 0.8), 3);
	return g;
}

/* ================================================================== lighting */
// Pendant hanging from the ceiling at height H (local origin = point on the floor below).
export function pendant(m, type, H, len) {
	var g = G(), drop = type === 'linear' ? 0.85 : (type === 'chandelier' ? 0.9 : 0.8), y = H - drop, fin = m.fin === 'brass' ? m.brass : m.black;
	function cord(x, z, y1) { ROD(g, [x, H, z], [x, y1, z], 0.004, m.dark, 6); }
	function light(x, yy, z, k) { if (m.night) { var p = new THREE.PointLight('#FFCB8E', k || 2.2, 6, 2); p.position.set(x, yy, z); g.add(p); } }
	CY(g, 0, H - 0.02, 0, 0.06, 0.06, 0.02, fin, 24);
	if (type === 'none') { return g; }
	if (type === 'globe') { cord(0, 0, y + 0.18); CY(g, 0, y + 0.16, 0, 0.03, 0.04, 0.05, m.brass, 20); SP(g, 0, y, 0, 0.17, m.opal, 32, 20); light(0, y, 0); }
	else if (type === 'dome') { cord(0, 0, y + 0.22); LA(g, [[0.012, 0.24], [0.04, 0.24], [0.08, 0.2], [0.2, 0.08], [0.26, 0], [0.255, 0], [0.19, 0.075], [0.07, 0.19], [0.012, 0.22]], fin, 0, y, 0, 40); if (m.night) { SP(g, 0, y + 0.06, 0, 0.05, m.bulb, 12, 8); } light(0, y, 0); }
	else if (type === 'linear') { var Lw = len || 1.4; [-1, 1].forEach(function (s) { ROD(g, [s * Lw * 0.4, H, 0], [s * Lw * 0.4, y + 0.04, 0], 0.0025, m.dark, 4); }); RB(g, -Lw / 2, y, -0.03, Lw / 2, y + 0.05, 0.03, 0.008, fin, 1); BX(g, -Lw / 2 + 0.02, y - 0.002, -0.018, Lw / 2 - 0.02, y, 0.018, m.night ? emissive('#FFE6C4', 3) : L.solid('#F4F1EA', 0.4)); light(-Lw * 0.25, y - 0.1, 0, 1.5); light(Lw * 0.25, y - 0.1, 0, 1.5); }
	else if (type === 'cluster') { CY(g, 0, H - 0.03, 0, 0.18, 0.18, 0.02, m.brass, 32); var r = rnd(5); for (var i = 0; i < 7; i++) { var a = i / 7 * Math.PI * 2, rr = 0.06 + r() * 0.12, x = Math.cos(a) * rr, z = Math.sin(a) * rr, yy = y + 0.1 - r() * 0.45; cord(x, z, yy + 0.09); SP(g, x, yy, z, 0.07 + r() * 0.03, m.opal, 24, 16); } light(0, y - 0.1, 0, 2.5); }
	else if (type === 'chandelier') {
		cord(0, 0, y + 0.35); CY(g, 0, y - 0.05, 0, 0.02, 0.02, 0.4, m.brass, 12); SP(g, 0, y - 0.07, 0, 0.04, m.brass, 16, 12);
		for (var k = 0; k < 8; k++) { var b = k / 8 * Math.PI * 2, ex = Math.cos(b) * 0.42, ez = Math.sin(b) * 0.42; TU(g, [[0, y + 0.05, 0], [ex * 0.5, y - 0.05, ez * 0.5], [ex, y + 0.02, ez], [ex, y + 0.08, ez]], 0.008, m.brass, 16); CY(g, ex, y + 0.08, ez, 0.03, 0.025, 0.02, m.brass, 16); CY(g, ex, y + 0.1, ez, 0.012, 0.012, 0.08, m.offwhite, 10); SP(g, ex, y + 0.2, ez, 0.018, m.bulb, 10, 8); }
		light(0, y, 0, 3);
	}
	else if (type === 'rattan') { cord(0, 0, y + 0.32); var rm = rattanMat('#C29A62'); LA(g, [[0.04, 0.34], [0.12, 0.32], [0.26, 0.2], [0.33, 0.06], [0.34, 0]], rm, 0, y, 0, 40); if (m.night) { SP(g, 0, y + 0.12, 0, 0.05, m.bulb, 12, 8); } light(0, y + 0.05, 0); }
	else if (type === 'paper') { cord(0, 0, y + 0.26); var pm = m.night ? emissive('#FFE9CC', 1.6) : L.solid('#F6F2EA', 0.85); var pts = []; for (var t = 0; t <= 16; t++) { var a2 = -Math.PI / 2 + t / 16 * Math.PI; pts.push([Math.cos(a2) * 0.26 * (1 + 0.04 * Math.cos(t * Math.PI)), Math.sin(a2) * 0.24 + 0.0]); } LA(g, pts, pm, 0, y, 0, 40); for (var rr2 = -2; rr2 <= 2; rr2++) { var yy2 = rr2 * 0.08, rad = Math.sqrt(Math.max(0, 1 - Math.pow(yy2 / 0.24, 2))) * 0.262; if (rad > 0.05) { var tor = M(new THREE.TorusGeometry(rad, 0.002, 4, 48), m.dark); tor.rotation.x = Math.PI / 2; at(tor, 0, y + yy2, 0); g.add(tor); } } light(0, y, 0); }
	else { /* cone */ cord(0, 0, y + 0.3); LA(g, [[0.01, 0.3], [0.03, 0.3], [0.14, 0], [0.135, 0]], fin, 0, y, 0, 32); light(0, y, 0); }
	return g;
}
export function floorLamp(m, type) {
	var g = G(), fin = m.fin === 'brass' ? m.brass : m.black;
	if (type === 'none') { return g; }
	if (type === 'arc') {
		RB(g, -0.16, 0, -0.16, 0.16, 0.08, 0.16, 0.01, marble('white'), 1);
		TU(g, [[0, 0.08, 0], [0, 1.2, 0], [0.25, 1.85, 0], [0.9, 2.05, 0], [1.45, 1.95, 0], [1.6, 1.75, 0]], 0.012, m.steel, 60);
		LA(g, [[0.012, 0.22], [0.03, 0.22], [0.12, 0.14], [0.2, 0.0], [0.195, 0.0], [0.1, 0.13], [0.012, 0.2]], m.steel, 1.6, 1.52, 0, 40);
		if (m.night) { var p = new THREE.PointLight('#FFC98A', 2, 5, 2); p.position.set(1.6, 1.45, 0); g.add(p); SP(g, 1.6, 1.58, 0, 0.04, m.bulb, 10, 8); }
	} else if (type === 'tripod') {
		for (var k = 0; k < 3; k++) { var a = k / 3 * Math.PI * 2; ROD(g, [Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3], [0, 1.3, 0], 0.016, m.wood, 8); }
		var sh = M(twoSided(new THREE.CylinderGeometry(0.22, 0.24, 0.32, 40, 1, true)), m.lampShade); at(sh, 0, 1.42, 0); g.add(sh);
		if (m.night) { var p2 = new THREE.PointLight('#FFC98A', 1.6, 4, 2); p2.position.set(0, 1.35, 0); g.add(p2); }
	} else if (type === 'globe') {
		CY(g, 0, 0, 0, 0.14, 0.15, 0.03, fin, 32); CY(g, 0, 0.03, 0, 0.012, 0.012, 1.35, fin, 12); SP(g, 0, 1.55, 0, 0.18, m.opal, 32, 20);
		if (m.night) { var p3 = new THREE.PointLight('#FFC98A', 1.6, 4, 2); p3.position.set(0, 1.55, 0); g.add(p3); }
	} else {
		// column: a tall paper lantern on a wooden foot
		RB(g, -0.14, 0, -0.14, 0.14, 0.05, 0.14, 0.01, m.oak, 1);
		var cm = m.night ? emissive('#FFE9CC', 1.4) : L.solid('#F6F2EA', 0.85);
		var col = M(twoSided(new THREE.CylinderGeometry(0.16, 0.16, 1.2, 32, 1, true)), cm); at(col, 0, 0.66, 0); g.add(col);
		for (var y = 0.08; y < 1.27; y += 0.1) { var tr = M(new THREE.TorusGeometry(0.162, 0.002, 4, 40), m.dark); tr.rotation.x = Math.PI / 2; at(tr, 0, y, 0); g.add(tr); }
		if (m.night) { var p4 = new THREE.PointLight('#FFC98A', 1.4, 4, 2); p4.position.set(0, 0.8, 0); g.add(p4); }
	}
	return g;
}

/* ================================================================== fireplaces */
function flames(g, m, x0, x1, y, z) {
	var fm = L.solid('#FF9A3C', 0.6, 0, { emissive: '#FF8A2A', emissiveIntensity: m.night ? 4 : 2.2 });
	var r = rnd(11);
	for (var x = x0 + 0.05; x < x1 - 0.04; x += 0.07) { var h = 0.12 + r() * 0.16, s = new THREE.Shape(); s.moveTo(-0.035, 0); s.quadraticCurveTo(-0.04, h * 0.6, 0, h); s.quadraticCurveTo(0.04, h * 0.6, 0.035, 0); s.lineTo(-0.035, 0); var f = M(new THREE.ShapeGeometry(s, 6), fm, false); f.position.set(x, y, z + (r() - 0.5) * 0.04); g.add(f); }
	if (m.night) { var p = new THREE.PointLight('#FF9A4A', 2.5, 5, 2); p.position.set((x0 + x1) / 2, y + 0.3, z + 0.3); g.add(p); }
}
function logs(g, x, y, z) { var lm = L.solid('#4A3426', 0.95); [[-0.12, 0.05], [0.12, -0.04], [0, 0.0]].forEach(function (q, i) { var l = M(new THREE.CylinderGeometry(0.05, 0.055, 0.42, 12), lm); l.rotation.z = Math.PI / 2; l.rotation.y = q[1] * 3; at(l, x + q[0] * 0.3, y + 0.05 + (i === 2 ? 0.07 : 0), z); g.add(l); }); }
export function fireplace(m, type, H, tvAbove) {
	var g = G(); H = H || 2.7;
	if (type === 'none') { return g; }
	if (type === 'stove') {
		var bl = L.solid('#232425', 0.55, 0.4);
		CY(g, 0, 0, 0.3, 0.2, 0.2, 0.12, bl, 32); CY(g, 0, 0.12, 0.3, 0.26, 0.26, 0.85, bl, 40);
		BX(g, -0.16, 0.3, 0.55, 0.16, 0.7, 0.565, glass('#3A2A1E', 0.5)); flames(g, m, -0.14, 0.14, 0.32, 0.45);
		CY(g, 0, 0.97, 0.3, 0.075, 0.075, H - 0.97, bl, 24);
		RB(g, -0.5, 0, 0.0, 0.5, 0.02, 0.9, 0.005, marble('black'), 1);
		return g;
	}
	if (type === 'bioethanol') {
		RB(g, -0.45, 0, -0.18, 0.45, 0.42, 0.18, 0.01, L.solid('#2A2A2B', 0.5, 0.3), 1);
		[-0.18, 0.18].forEach(function (z) { add(g, at(M(L.boxGeo(0.88, 0.3, 0.008), glass('#E9EFF0', 0.25), false), 0, 0.57, z)); });
		flames(g, m, -0.35, 0.35, 0.42, 0);
		return g;
	}
	if (type === 'corner') {
		BX(g, -0.7, 0, 0, 0.7, 0.4, 0.55, L.solid('#2A2A2B', 0.6));
		[[0, 0.55, 1.4, 0], [-0.7, 0.275, 0, 0.55], [0.7, 0.275, 0, 0.55]].forEach(function (q) { add(g, at(M(L.boxGeo(q[2] || 0.008, 0.5, q[3] || 0.008), glass('#E9EFF0', 0.22), false), q[0], 0.65, q[1])); });
		logs(g, 0, 0.4, 0.3); flames(g, m, -0.6, 0.6, 0.42, 0.3);
		RB(g, -0.72, 0.9, 0, 0.72, H, 0.57, 0.004, L.solid(L.shadeHex(m.pal[0], -0.04), 0.9), 1);
		return g;
	}
	if (type === 'mantel') {
		var st = marble(m.st === 'classic' || m.st === 'luxury' ? 'white' : 'travertine');
		RB(g, -0.85, 0, 0, 0.85, 1.15, 0.25, 0.004, st, 1);
		RB(g, -0.95, 1.15, -0.0, 0.95, 1.22, 0.32, 0.01, st, 2);
		BX(g, -0.5, 0.0, 0.2, 0.5, 0.8, 0.252, L.solid('#121212', 0.9));
		RB(g, -0.9, 0, 0.25, 0.9, 0.03, 0.75, 0.004, st, 1);
		logs(g, 0, 0, 0.12); flames(g, m, -0.3, 0.3, 0.08, 0.14);
		if (!tvAbove) { var mg = G(); mg.position.set(0, 0, 0.0); g.add(mg); picture(mg, m, 'landscape', 0, 1.45, 1.0, 0.75, 6, m.brass); }
		candle(g, m, -0.6, 1.22, 0.15); candle(g, m, -0.5, 1.22, 0.18); vase(g, m, 0.6, 1.22, 0.15, 1);
		return g;
	}
	// linear: a chimney breast with a long built-in firebox
	var wallM = m.st === 'wood_stone' || m.st === 'mediterranean' ? L.pbr('stone', { color: '#B9AE9C' }, { normal: 1.6 }) : L.pbr('render', { color: L.shadeHex(m.pal[0], -0.05), texture: 'coarse' }, { normal: 0.6 });
	BX(g, -0.9, 0, 0, 0.9, H, 0.35, wallM);
	BX(g, -0.65, 0.42, 0.3, 0.65, 0.82, 0.352, L.solid('#121212', 0.9)); add(g, at(M(L.boxGeo(1.3, 0.4, 0.006), glass('#3A2A1E', 0.35), false), 0, 0.62, 0.356));
	flames(g, m, -0.6, 0.6, 0.44, 0.32);
	RB(g, -1.1, 0.0, 0.35, 1.1, 0.38, 0.75, 0.006, marble(m.st === 'monochrome' ? 'black' : 'travertine'), 1);
	return g;
}

/* ================================================================== bathroom
 * Wall items (basins, toilets, mirrors, radiators, shower fittings) have their origin on the wall
 * surface at floor level and reach out along +z. */
function ceramicDS() { return ceramic('#F8F8F5'); }
// Bowl or tub cavity seen from above: a rounded box turned inside out (its top face looks down, unseen).
function cavity(g, mat, w, h, d, r, x, yTop, z) { var c = M(flipGeo(rbGeo(w, h, d, r, 3)), mat, false); at(c, x, yTop - h / 2, z); g.add(c); return c; }
function finMat(c) { return metal({ chrome: 'chrome', black: 'black', brass: 'brass', steel: 'steel', gunmetal: 'gunmetal', copper: 'copper' }[c.taps || 'black'] || 'black'); }
// Deck-mounted basin mixer (on a counter at y), spout towards +z.
function mixer(g, mt, x, y, z, tall) {
	var h = tall ? 0.3 : 0.16;
	LA(g, [[0, 0], [0.026, 0], [0.026, 0.006], [0.018, 0.012], [0.017, h], [0, h]], mt, x, y, z, 24);
	TU(g, [[x, y + h - 0.01, z], [x, y + h + 0.025, z + 0.03], [x, y + h + 0.02, z + 0.11], [x, y + h - 0.02, z + 0.13]], 0.011, mt, 20);
	ROD(g, [x, y + h - 0.03, z - 0.005], [x, y + h + 0.02, z - 0.06], 0.006, mt, 8);
}
// Wall spout above a basin (wall at z = 0).
function wallSpout(g, mt, x, y) { CY(g, x, y - 0.035, 0.005, 0.035, 0.035, 0.07, mt, 24).rotation.x = Math.PI / 2; ROD(g, [x, y, 0], [x, y, 0.18], 0.011, mt, 12); CY(g, x + 0.09, y - 0.025, 0.004, 0.025, 0.025, 0.012, mt, 20).rotation.x = Math.PI / 2; }
function bottle(g, m, x, y, z, s, mat) { s = s || 1; LA(g, [[0, 0], [0.03 * s, 0], [0.032 * s, 0.14 * s], [0.012 * s, 0.17 * s], [0.012 * s, 0.19 * s], [0, 0.19 * s]], mat || m.potW, x, y, z, 20); CY(g, x, y + 0.19 * s, z, 0.008, 0.008, 0.03, m.black, 8); }
function towel(g, mat, x, y, z, w, drop) { RB(g, x - w / 2, y - 0.012, z - 0.03, x + w / 2, y + 0.012, z + 0.03, 0.01, mat, 2); RB(g, x - w / 2, y - drop, z + 0.012, x + w / 2, y, z + 0.035, 0.01, mat, 2); RB(g, x - w / 2, y - drop * 0.7, z - 0.035, x + w / 2, y, z - 0.012, 0.01, mat, 2); }
export function bathtub(m, type) {
	var g = G(), mt = finMat(m.c);
	if (type === 'none') { return g; }
	if (type === 'freestanding' || type === 'clawfoot') {
		var cl = type === 'clawfoot', y0 = cl ? 0.14 : 0;
		var outer = cl ? [[0.0, y0], [0.26, y0], [0.36, y0 + 0.08], [0.4, y0 + 0.38], [0.43, y0 + 0.55], [0.445, y0 + 0.6], [0.42, y0 + 0.63]] : [[0, 0], [0.28, 0], [0.37, 0.06], [0.41, 0.32], [0.43, 0.58], [0.425, 0.6]];
		var inner = cl ? [[0.405, y0 + 0.6], [0.38, y0 + 0.45], [0.3, y0 + 0.16], [0, y0 + 0.12]] : [[0.395, 0.6], [0.37, 0.42], [0.3, 0.14], [0, 0.12]];
		var outM = cl ? lacquer(L.col(m.c.bath_color, '#2F3A40'), false) : (m.st === 'luxury' ? L.solid('#EFEDE8', 0.45) : ceramic());
		if (cl) {
			LA(g, outer, outM, 0, 0, 0, 48, 2.05, 1);
			var inn = LA(g, [[0.42, y0 + 0.63]].concat(inner), ceramicDS(), 0, 0, 0, 48, 2.05, 1); void inn;
			[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { LA(g, [[0, 0], [0.045, 0], [0.05, 0.03], [0.03, 0.08], [0.035, 0.16], [0, 0.16]], m.brass, q[0] * 0.55, 0, q[1] * 0.22, 16); });
		} else {
			var pts = outer.concat(inner), sh = LA(g, pts, ceramicDS(), 0, 0, 0, 56, 2.05, 1); if (m.st === 'luxury') { sh.material = dside(outM); }
		}
		// floor-standing mixer at the foot
		var fx = 1.0;
		ROD(g, [fx, 0, 0], [fx, 0.95, 0], 0.016, mt, 16); TU(g, [[fx, 0.93, 0], [fx, 1.0, 0], [fx - 0.08, 1.03, 0], [fx - 0.16, 0.96, 0]], 0.012, mt, 20); CY(g, fx, 0, 0, 0.04, 0.04, 0.01, mt, 20); ROD(g, [fx, 0.8, 0], [fx + 0.06, 0.82, 0], 0.008, mt, 8);
		towel(g, m.linenWhite, -0.6, 0.62, 0.0, 0.3, 0.25);
		return g;
	}
	if (type === 'japanese') {
		var hw = veneer('#D9BF98', 'quarter'), W = 1.15, D = 0.75, H = 0.62, t = 0.045;
		BX(g, -W / 2, 0, -D / 2, W / 2, 0.05, D / 2, hw);
		[[-W / 2, -D / 2, W / 2, -D / 2 + t], [-W / 2, D / 2 - t, W / 2, D / 2], [-W / 2, -D / 2, -W / 2 + t, D / 2], [W / 2 - t, -D / 2, W / 2, D / 2]].forEach(function (q) { RB(g, q[0], 0, q[1], q[2], H, q[3], 0.006, hw, 1); });
		BX(g, -W / 2 + t, 0.05, -D / 2 + t, W / 2 - t, 0.06, D / 2 - t, hw);
		var wt = glass('#9CC7CF', 0.45); add(g, at(M(L.boxGeo(W - 2 * t, 0.004, D - 2 * t), wt, false), 0, H - 0.12, 0));
		RB(g, W / 2 + 0.15, 0, -0.15, W / 2 + 0.45, 0.32, 0.15, 0.01, hw, 1);
		LA(g, [[0, 0], [0.11, 0], [0.12, 0.14], [0.115, 0.14], [0.105, 0.01], [0, 0.01]], hw, W / 2 + 0.3, 0.32, 0, 24);
		ROD(g, [-W / 2 + 0.1, 0, -D / 2 - 0.02], [-W / 2 + 0.1, 0.95, -D / 2 - 0.02], 0.012, mt); TU(g, [[-W / 2 + 0.1, 0.93, -D / 2 - 0.02], [-W / 2 + 0.1, 0.97, -D / 2 + 0.06], [-W / 2 + 0.1, 0.9, -D / 2 + 0.12]], 0.011, mt, 12);
		return g;
	}
	// built-in: tiled apron and deck around an inset tub
	var Lt = 1.72, Wt = 0.82, Ht = 0.56, tile = m.tile || m.white;
	[[-Lt / 2, -Wt / 2, Lt / 2, -Wt / 2 + 0.06], [-Lt / 2, Wt / 2 - 0.06, Lt / 2, Wt / 2], [-Lt / 2, -Wt / 2, -Lt / 2 + 0.06, Wt / 2], [Lt / 2 - 0.06, -Wt / 2, Lt / 2, Wt / 2]].forEach(function (q) { BX(g, q[0], 0, q[1], q[2], Ht - 0.04, q[3], tile); });
	var deck = rrShape(Lt, Wt, 0.005); deck.holes.push(rrShape(Lt - 0.16, Wt - 0.16, 0.14));
	EX(g, deck, Ht - 0.04, Ht, m.st === 'industrial' ? tile : ceramic(), 0.004);
	cavity(g, ceramic(), Lt - 0.16, 0.44, Wt - 0.16, 0.14, 0, Ht - 0.002, 0);
	wallSpout(g, mt, 0.55, 0.0); 
	var sp = G(); sp.position.set(0.55, Ht + 0.12, -Wt / 2); add(g, sp); wallSpout(sp, mt, 0, 0);
	towel(g, m.linenWhite, -0.5, Ht + 0.01, Wt / 2 - 0.05, 0.4, 0.3);
	return g;
}
export function shower(m, type, w, d, H, tile) {
	var g = G(), mt = finMat(m.c), frameM = m.c.taps === 'brass' ? m.brass : (m.c.taps === 'chrome' || m.c.taps === 'steel' ? m.chrome : m.black), gl = glass('#E6F0F2', 0.18);
	H = H || 2.6; w = w || 1.0; d = d || 1.0;
	if (type === 'none') { return g; }
	// fittings on the back wall: thermostat, slide bar with hand shower, rain head on an arm
	var cx = w / 2;
	RB(g, cx - 0.08, 1.05, 0, cx + 0.08, 1.21, 0.015, 0.006, mt, 1); CY(g, cx - 0.04, 1.13, 0.03, 0.022, 0.022, 0.03, mt, 20).rotation.x = Math.PI / 2; CY(g, cx + 0.04, 1.13, 0.03, 0.022, 0.022, 0.03, mt, 20).rotation.x = Math.PI / 2;
	ROD(g, [cx + 0.25, 0.9, 0.03], [cx + 0.25, 1.75, 0.03], 0.009, mt); TU(g, [[cx + 0.25, 1.45, 0.05], [cx + 0.25, 1.52, 0.1], [cx + 0.25, 1.62, 0.12]], 0.014, mt, 12); CY(g, cx + 0.25, 1.62, 0.12, 0.04, 0.035, 0.02, mt, 20);
	if (type === 'wetroom' || type === 'walkin') { BX(g, 0.04, 0.0, 0.04, 0.045, 0.006, 1, m.steel).scale.set(1, 1, 1); BX(g, 0.1, 0.001, 0.08, w - 0.1, 0.004, 0.14, m.steel); }
	ROD(g, [cx, 2.15, 0], [cx, 2.15, 0.38], 0.011, mt); RB(g, cx - 0.16, 2.12, 0.3, cx + 0.16, 2.14, 0.62, 0.01, mt, 2);
	// niche with bottles
	RB(g, 0.12, 1.25, 0, 0.62, 1.27, 0.12, 0.005, m.white, 1); bottle(g, m, 0.2, 1.27, 0.06, 1, m.potW); bottle(g, m, 0.3, 1.27, 0.06, 1.1, m.potD); bottle(g, m, 0.42, 1.27, 0.06, 0.9, m.terracotta);
	if (type === 'walkin') {
		add(g, at(M(L.boxGeo(0.008, 2.0, d * 0.85), gl, false), w, 1.0, d * 0.425));
		BX(g, w - 0.012, 0, 0, w + 0.012, 2.0, 0.025, frameM); BX(g, w - 0.006, 0, 0.0, w + 0.006, 0.02, d * 0.85, frameM);
		ROD(g, [w, 1.98, d * 0.85], [w, 1.98, 0], 0.008, frameM); ROD(g, [w, 1.98, d * 0.85], [w, 1.98, 0], 0.008, frameM);
	} else if (type === 'enclosure' || type === 'niche') {
		RB(g, 0, 0, 0, w, 0.04, d, 0.005, L.solid('#ECEAE6', 0.5), 1);
		if (type === 'niche') { BX(g, w, 0, 0, w + 0.1, H, d, tile || m.white); }
		else { add(g, at(M(L.boxGeo(0.008, 1.96, d), gl, false), w, 1.02, d / 2)); [[w, 0], [w, d]].forEach(function (q) { BX(g, q[0] - 0.012, 0.04, q[1] - 0.012, q[0] + 0.012, 2.0, q[1] + 0.012, frameM); }); BX(g, w - 0.012, 1.99, 0, w + 0.012, 2.01, d, frameM); }
		add(g, at(M(L.boxGeo(w * 0.55, 1.96, 0.008), gl, false), w * 0.275, 1.02, d)); add(g, at(M(L.boxGeo(w * 0.47, 1.96, 0.008), gl, false), w * 0.74, 1.02, d + 0.012));
		BX(g, 0, 1.99, d - 0.012, w, 2.01, d + 0.02, frameM); ROD(g, [w * 0.5, 0.9, d + 0.03], [w * 0.5, 1.3, d + 0.03], 0.009, frameM);
	} else if (type === 'wetroom') {
		RB(g, 0, 0.45, 0, 0.42, 0.5, d * 0.9, 0.01, m.st === 'japandi' ? m.oak : L.pbr('floor', { pattern: 'tile', color: '#BDB7AE', size: 3 }, { normal: 0.6 }), 1);
	}
	return g;
}
// Vanity unit with basin(s), tap(s) – type of the unit, type of the basin, number of basins.
export function vanity(m, vType, bType, n, w) {
	var g = G(), mt = finMat(m.c), top = 0.85, d = 0.5, bc = L.col(m.c.bath_color, '#D9D4CC');
	n = n || 1; w = w || (n > 1 ? 1.4 : 0.9);
	var stoneTop = m.st === 'industrial' ? L.pbr('concrete', { color: '#A9A6A0' }, { normal: 0.6 }) : m.stone;
	var hang = bType === 'wall_hung' || bType === 'pedestal';
	if (hang) { vType = vType === 'wood' ? 'shelf' : 'none'; }
	if (vType === 'floating') { RB(g, -w / 2, 0.42, 0, w / 2, top - 0.02, d, 0.006, lacquer(bc, false), 1); BX(g, -w / 2 + 0.01, 0.62, d, w / 2 - 0.01, 0.635, d + 0.003, m.dark); }
	else if (vType === 'wood' || vType === 'shelf') {
		if (vType === 'wood') { RB(g, -w / 2, top - 0.06, 0, w / 2, top - 0.02, d, 0.004, m.oak, 1); }
		RB(g, -w / 2 + 0.03, 0.25, 0.02, w / 2 - 0.03, 0.28, d - 0.05, 0.004, m.oak, 1);
		[-1, 1].forEach(function (s) { BX(g, s * (w / 2 - 0.08) - 0.015, 0.25, 0, s * (w / 2 - 0.08) + 0.015, vType === 'wood' ? top - 0.06 : 0.28, 0.04, m.black); });
		towel(g, m.linenWhite, -w / 4, 0.33, d / 2, 0.3, 0); RB(g, w / 8, 0.28, 0.1, w / 8 + 0.26, 0.42, 0.38, 0.03, rattanMat('#B89566'), 2);
	} else if (vType === 'washstand') {
		var fr = m.st === 'luxury' ? m.brass : m.black;
		[[-1, 0.04], [1, 0.04], [-1, d - 0.04], [1, d - 0.04]].forEach(function (q) { BX(g, q[0] * (w / 2 - 0.03) - 0.012, 0, q[1] - 0.012, q[0] * (w / 2 - 0.03) + 0.012, top - 0.03, q[1] + 0.012, fr); });
		RB(g, -w / 2 + 0.03, 0.2, 0.03, w / 2 - 0.03, 0.22, d - 0.03, 0.003, fr, 1);
		[-1, 1].forEach(function (s) { towel(g, m.linenWhite, s * w / 4, 0.32, d / 2, 0.32, 0); RB(g, s * w / 4 - 0.16, 0.22, d / 2 - 0.18, s * w / 4 + 0.16, 0.3, d / 2 + 0.18, 0.02, m.linenWhite, 2); });
	} else if (vType === 'floor') {
		RB(g, -w / 2, 0.1, 0, w / 2, top - 0.03, d, 0.006, lacquer(bc, false), 1);
		legs4(g, w - 0.04, d - 0.04, 0.1, 0.03, m.brass, 'bun');
		var nd = Math.max(2, Math.round(w / 0.45));
		for (var k = 0; k < nd; k++) { var x0 = -w / 2 + k * w / nd + 0.02, x1 = -w / 2 + (k + 1) * w / nd - 0.02; RB(g, x0, 0.14, d, x1, top - 0.07, d + 0.012, 0.003, lacquer(L.shadeHex(bc, 0.04), false), 1); RB(g, x0 + 0.03, 0.17, d + 0.012, x1 - 0.03, top - 0.1, d + 0.02, 0.003, lacquer(bc, false), 1); SP(g, k % 2 ? x0 + 0.06 : x1 - 0.06, 0.62, d + 0.03, 0.014, m.brass, 12, 8); }
	}
	// the top and the basins
	var xs = n > 1 ? [-w / 4, w / 4] : [0];
	if (bType === 'vessel') {
		if (vType !== 'wood' && vType !== 'none' && vType !== 'shelf') { RB(g, -w / 2 - 0.01, top - 0.03, 0, w / 2 + 0.01, top, d + 0.01, 0.004, stoneTop, 1); }
		var vt = vType === 'wood' ? top - 0.02 : top;
		xs.forEach(function (x) { LA(g, [[0, 0], [0.09, 0], [0.18, 0.04], [0.21, 0.13], [0.2, 0.135], [0.17, 0.05], [0.07, 0.025], [0, 0.025]], ceramicDS(), x, vt, d / 2 + 0.02, 40); mixer(g, mt, x, vt, d / 2 - 0.24, true); });
	} else if (bType === 'undermount' || bType === 'integrated') {
		var integ = bType === 'integrated', sh = rrShape(w + 0.02, d + 0.01, 0.004, 0, d / 2);
		xs.forEach(function (x) { sh.holes.push(rrShape(integ ? (n > 1 ? w * 0.4 : w * 0.6) : 0.46, 0.32, integ ? 0.03 : 0.1, x, d / 2 + 0.03)); });
		var tm = integ ? L.solid('#F2F0EB', 0.35) : stoneTop;
		EX(g, sh, top - (integ ? 0.12 : 0.03), top, tm, 0.003);
		xs.forEach(function (x) { cavity(g, integ ? tm : ceramic(), integ ? (n > 1 ? w * 0.4 : w * 0.6) : 0.46, integ ? 0.1 : 0.15, 0.32, integ ? 0.03 : 0.1, x, top - 0.001, d / 2 + 0.03); if (integ) { wallSpout(g, mt, x, top + 0.22); } else { mixer(g, mt, x, top, 0.08, false); } });
	} else {
		// wall-hung / pedestal ceramic basin
		xs.forEach(function (x) {
			var bs = rrShape(0.56, 0.44, 0.06, x, 0.24); bs.holes.push(rrShape(0.44, 0.3, 0.1, x, 0.27));
			EX(g, bs, top - 0.15, top, ceramic(), 0.006); cavity(g, ceramic(), 0.44, 0.13, 0.3, 0.1, x, top - 0.005, 0.27); BX(g, x - 0.27, top - 0.15, 0.03, x + 0.27, top - 0.13, 0.45, ceramic());
			if (bType === 'pedestal') { LA(g, [[0, 0], [0.13, 0], [0.11, 0.05], [0.09, top - 0.15], [0, top - 0.15]], ceramic(), x, 0, 0.2, 32, 1, 0.8); }
			wallSpout(g, mt, x, top + 0.2);
		});
	}
	// soap and a towel ring
	bottle(g, m, xs[xs.length - 1] + (n > 1 ? 0.22 : 0.3), top, 0.1, 0.6, m.potD);
	return g;
}
export function bathMirror(m, type, w) {
	var g = G(), fr = m.c.taps === 'brass' ? m.brass : (m.c.taps === 'chrome' ? m.chrome : m.black), cy = 1.55;
	w = w || 0.8;
	if (type === 'none') { return g; }
	if (type === 'round') { var r = Math.min(0.42, w / 2); add(g, at(M(new THREE.CircleGeometry(r, 64), mirror(), false), 0, cy, 0.02)); var t = M(new THREE.TorusGeometry(r, 0.012, 12, 64), fr); at(t, 0, cy, 0.02); g.add(t); }
	else if (type === 'led') { RB(g, -w / 2, cy - 0.4, 0.0, w / 2, cy + 0.4, 0.02, 0.02, m.night ? emissive('#FFF1DC', 2) : L.solid('#F7F5F0', 0.4), 2); add(g, at(M(new THREE.PlaneGeometry(w - 0.04, 0.76), mirror(), false), 0, cy, 0.035)); RB(g, -w / 2 + 0.02, cy - 0.38, 0.02, w / 2 - 0.02, cy + 0.38, 0.034, 0.02, m.dark, 2); }
	else if (type === 'cabinet') { RB(g, -w / 2, cy - 0.36, 0, w / 2, cy + 0.36, 0.14, 0.006, m.white, 1); [-1, 1].forEach(function (s) { BX(g, s > 0 ? 0.004 : -w / 2 + 0.01, cy - 0.35, 0.14, s > 0 ? w / 2 - 0.01 : -0.004, cy + 0.35, 0.145, mirror()); }); BX(g, -w / 2, cy - 0.37, 0.0, w / 2, cy - 0.36, 0.13, m.night ? emissive('#FFF1DC', 2) : L.solid('#F7F5F0', 0.4)); }
	else {
		var mw = Math.min(0.62, w * 0.8), h = type === 'arched' ? 0.95 : 0.9, sh = new THREE.Shape();
		if (type === 'arched') { sh.moveTo(-mw / 2, 0); sh.lineTo(mw / 2, 0); sh.lineTo(mw / 2, h - mw / 2); sh.absarc(0, h - mw / 2, mw / 2, 0, Math.PI, false); sh.lineTo(-mw / 2, 0); }
		else { sh.moveTo(-mw / 2, mw / 2); sh.absarc(0, mw / 2, mw / 2, Math.PI, Math.PI * 2, false); sh.lineTo(mw / 2, h - mw / 2); sh.absarc(0, h - mw / 2, mw / 2, 0, Math.PI, false); sh.lineTo(-mw / 2, mw / 2); }
		var fg = new THREE.ExtrudeGeometry(sh, { depth: 0.015, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 40 });
		var f = M(fg, fr); f.position.set(0, cy - h / 2, 0.0); g.add(f);
		var mm = M(new THREE.ShapeGeometry(sh, 40), mirror(), false); mm.position.set(0, cy - h / 2, 0.025); g.add(mm);
	}
	return g;
}
export function toilet(m, type, bidet) {
	var g = G(), mt = finMat(m.c), cer = ceramicDS(), wall = type === 'wall_hung' || type === 'smart' || bidet;
	var y0 = wall ? 0.22 : 0, rim = 0.4, sz = 1.4, zc = 0.32;
	var prof = wall ? [[0, y0 + 0.02], [0.11, y0], [0.17, y0 + 0.05], [0.19, rim - 0.06], [0.188, rim], [0.165, rim + 0.004], [0.15, rim - 0.04], [0.08, y0 + 0.08], [0.03, y0 + 0.05], [0, y0 + 0.05]]
		: [[0, 0], [0.13, 0], [0.14, 0.04], [0.15, 0.18], [0.19, rim - 0.06], [0.188, rim], [0.165, rim + 0.004], [0.15, rim - 0.04], [0.08, 0.2], [0.03, 0.17], [0, 0.17]];
	LA(g, prof, cer, 0, 0, zc, 40, 1, sz);
	RB(g, -0.17, wall ? y0 + 0.02 : 0, 0, 0.17, rim - 0.01, 0.2, 0.05, cer, 2);
	if (!bidet) {
		var ring = ellShape(0.19, 0.19 * sz, 0, zc); ring.holes.push(ellShape(0.12, 0.12 * sz * 1.05, 0, zc + 0.01));
		EX(g, ring, rim + 0.004, rim + 0.026, ceramic(), 0.008, 40);
		var lid = M(new THREE.ExtrudeGeometry(ellShape(0.188, 0.188 * sz, 0, zc), { depth: 0.012, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.006, bevelSegments: 2, curveSegments: 40 }), ceramic()); lid.geometry.rotateX(-Math.PI / 2); lid.position.y = rim + 0.032; g.add(lid);
		if (type === 'smart') { RB(g, 0.19, rim - 0.02, 0.06, 0.25, rim + 0.05, 0.3, 0.02, ceramic(), 2); RB(g, 0.5, 0.8, 0, 0.58, 0.95, 0.015, 0.008, m.dark, 1); }
	} else { mixer(g, mt, 0, rim, 0.12, false); }
	if (type === 'floor' && !bidet) {
		RB(g, -0.19, rim + 0.02, 0.0, 0.19, 0.8, 0.17, 0.03, ceramic(), 2); CY(g, 0, 0.8, 0.09, 0.025, 0.025, 0.008, mt, 20);
	} else if (!bidet) {
		RB(g, -0.12, 1.0, 0, 0.12, 1.16, 0.012, 0.006, type === 'smart' ? m.white : mt, 1); RB(g, -0.105, 1.015, 0.01, -0.005, 1.145, 0.016, 0.004, type === 'smart' ? mt : m.white, 1); RB(g, 0.005, 1.015, 0.01, 0.105, 1.145, 0.016, 0.004, type === 'smart' ? mt : m.white, 1);
	}
	return g;
}
export function towelRail(m) {
	var g = G(), mt = finMat(m.c);
	[-0.25, 0.25].forEach(function (x) { ROD(g, [x, 0.2, 0.05], [x, 1.5, 0.05], 0.014, mt); [0.2, 1.5].forEach(function (y) { ROD(g, [x, y, 0], [x, y, 0.05], 0.008, mt); }); });
	for (var y = 0.3; y < 1.5; y += 0.12) { ROD(g, [-0.25, y, 0.05], [0.25, y, 0.05], 0.01, mt); }
	towel(g, m.linenWhite, 0, 1.38, 0.06, 0.42, 0.45); towel(g, m.acc2, 0, 0.9, 0.06, 0.38, 0.32);
	return g;
}

/* ================================================================== kitchen
 * A run of cabinets along local x from 0 to len, back at z = 0 (wall), front at z = 0.6. */
function kMats(m) {
	var c = m.c, fc = L.col(c.fronts_color, '#E9E4DC');
	var light = new THREE.Color(fc); light = (light.r + light.g + light.b) / 3 > 0.72;
	var fr = c.fronts === 'wood_veneer' ? veneer(light ? '#B98D63' : fc, 'quarter') : (c.fronts === 'gloss' ? lacquer(fc, true) : (c.fronts === 'fenix' ? L.solid(fc, 0.92) : lacquer(fc, false)));
	var wt = c.worktop || 'quartz', wtc = L.col(c.worktop_color, '#EDEBE6');
	var top = wt === 'wood' ? veneer(wtc === '#EDEBE6' ? '#B98D63' : wtc, 'quarter') : (wt === 'granite' ? L.pbr('floor', { pattern: 'terrazzo', color: wtc === '#EDEBE6' ? '#4A4542' : wtc }, { normal: 0.3, physical: true, clearcoat: 0.5 }) : (wt === 'ceramic' ? L.pbr('marble', { color: wtc, vein: '#9A958E' }, { normal: 0.2, physical: true, clearcoat: 0.5 }) : (wt === 'laminate' ? L.solid(wtc, 0.6) : L.pbr('marble', { color: wtc, vein: L.shadeHex(wtc, -0.18) }, { normal: 0.2, physical: true, clearcoat: 0.7 }))));
	var hd = { handleless: null, bar_black: m.black, brass: m.brass, knobs: m.steel }[c.handles || 'handleless'];
	var bs = c.backsplash || 'worktop_material', bsM = bs === 'tiles' ? L.pbr('wtile', { pattern: 'subway', color: '#EFEDE8', grout: '#D6D1C9' }, { normal: 1 }) : (bs === 'glass' ? lacquer(L.shadeHex(L.col(c.wall_color, '#F4F1EC'), -0.05), true) : (bs === 'mirror' ? L.solid('#C9CDD0', 0.08, 1) : top));
	return { fr: fr, top: top, hd: hd, bsM: bsM, carcase: L.solid('#3A3A3B', 0.7) };
}
function handle(g, K, m, x, y, z, vertical, len) {
	if (!K.hd) { return; }
	if (m.c.handles === 'knobs') { SP(g, x, y, z + 0.022, 0.016, K.hd, 12, 8); ROD(g, [x, y, z], [x, y, z + 0.015], 0.006, K.hd, 6); return; }
	len = len || 0.24;
	if (vertical) { ROD(g, [x, y - len / 2, z + 0.03], [x, y + len / 2, z + 0.03], 0.007, K.hd, 8); ROD(g, [x, y - len / 2 + 0.02, z], [x, y - len / 2 + 0.02, z + 0.03], 0.005, K.hd, 6); ROD(g, [x, y + len / 2 - 0.02, z], [x, y + len / 2 - 0.02, z + 0.03], 0.005, K.hd, 6); }
	else { ROD(g, [x - len / 2, y, z + 0.03], [x + len / 2, y, z + 0.03], 0.007, K.hd, 8); ROD(g, [x - len / 2 + 0.02, y, z], [x - len / 2 + 0.02, y, z + 0.03], 0.005, K.hd, 6); ROD(g, [x + len / 2 - 0.02, y, z], [x + len / 2 - 0.02, y, z + 0.03], 0.005, K.hd, 6); }
}
// One cabinet front (door or drawer) from (a, y0) to (b, y1) at depth z; shaker fronts get a frame.
function front(g, K, m, a, y0, b, y1, z) {
	RB(g, a, y0, z, b, y1, z + 0.02, 0.003, K.fr, 1);
	if (m.c.fronts === 'shaker' && b - a > 0.2 && y1 - y0 > 0.12) { var f = Math.min(0.065, (y1 - y0) * 0.25); RB(g, a, y0, z + 0.02, b, y0 + f, z + 0.03, 0.003, K.fr, 1); RB(g, a, y1 - f, z + 0.02, b, y1, z + 0.03, 0.003, K.fr, 1); RB(g, a, y0 + f, z + 0.02, a + f, y1 - f, z + 0.03, 0.003, K.fr, 1); RB(g, b - f, y0 + f, z + 0.02, b, y1 - f, z + 0.03, 0.003, K.fr, 1); }
}
// opts: { H, uppers, sink: x, hob: x, oven: bool, fridge: 'end'|'start'|null, tall: bool, splash: bool, open: 'none'|'closed'|'open'|'glass', hood }
export function kitchenRun(m, len, o) {
	var g = G(), K = kMats(m), c = m.c, H = o.H || 2.7, d = 0.6, top = 0.92;
	var app = c.appliances || ['oven', 'hob', 'dishwasher', 'fridge'], fin = c.handles === 'brass' ? m.brass : (c.handles === 'bar_black' ? m.black : m.steel);
	var x0 = 0, x1 = len, tallW = 0;
	// tall column(s) at the end: fridge (and coffee unit)
	if (o.fridge) {
		var sbs = app.indexOf('side_by_side') !== -1, fw = sbs ? 0.92 : 0.62, fx = o.fridge === 'start' ? 0 : len - fw;
		var th = Math.min(2.3, H - 0.1);
		if (sbs) { RB(g, fx, 0, 0, fx + fw, th - 0.05, d + 0.04, 0.01, m.steel, 1); BX(g, fx + fw / 2 - 0.003, 0.05, d + 0.04, fx + fw / 2 + 0.003, th - 0.08, d + 0.042, m.dark); [-1, 1].forEach(function (s) { ROD(g, [fx + fw / 2 + s * 0.05, 0.9, d + 0.08], [fx + fw / 2 + s * 0.05, 1.6, d + 0.08], 0.012, m.steel); }); }
		else { BX(g, fx, 0, 0, fx + fw, th, d, K.carcase); RB(g, fx + 0.002, 0.1, d, fx + fw - 0.002, 1.18, d + 0.02, 0.003, K.fr, 1); RB(g, fx + 0.002, 1.19, d, fx + fw - 0.002, th - 0.002, d + 0.02, 0.003, K.fr, 1); handle(g, K, m, fx + 0.06, 1.1, d + 0.02, true, 0.4); }
		tallW = fw;
		if (o.fridge === 'start') { x0 = fw; } else { x1 = len - fw; }
		if (app.indexOf('coffee') !== -1 && x1 - x0 > 2.0 && o.fridge !== 'start') {
			var cx0 = x1 - 0.6; BX(g, cx0, 0, 0, x1, th, d, K.carcase); RB(g, cx0 + 0.002, 0.1, d, x1 - 0.002, 0.8, d + 0.02, 0.003, K.fr, 1); RB(g, cx0 + 0.01, 0.82, d, x1 - 0.01, 1.42, d + 0.02, 0.004, m.dark, 1); BX(g, cx0 + 0.05, 1.3, d + 0.02, x1 - 0.05, 1.34, d + 0.022, m.night ? emissive('#9FD3FF', 1) : L.solid('#5A6670', 0.3)); RB(g, cx0 + 0.002, 1.44, d, x1 - 0.002, th - 0.002, d + 0.02, 0.003, K.fr, 1); x1 = cx0;
		}
	}
	// base cabinets: toe kick, carcase, end panels, doors and drawer stacks, worktop
	BX(g, x0, 0, 0, x1, 0.1, d - 0.06, K.carcase);
	BX(g, x0, 0.1, 0, x1, top - 0.04, d, K.carcase);
	[[x0 - 0.018, x0], [x1, x1 + 0.018]].forEach(function (q) { if (q[0] < -0.01 || q[1] > len + 0.01) { return; } BX(g, q[0], 0, 0, q[1], top - 0.04, d + 0.02, K.fr); });
	var n = Math.max(1, Math.round((x1 - x0) / 0.6)), dw = (x1 - x0) / n;
	for (var i = 0; i < n; i++) {
		var a = x0 + i * dw + 0.0015, b = a + dw - 0.003, mid = (a + b) / 2;
		var isHob = o.hob !== undefined && Math.abs(mid - o.hob) < dw / 2, isSink = o.sink !== undefined && Math.abs(mid - o.sink) < dw / 2;
		if (isHob && app.indexOf('oven') !== -1) {
			RB(g, a, 0.1, d, b, 0.24, d + 0.02, 0.003, K.fr, 1); handle(g, K, m, mid, 0.2, d + 0.02, false);
			RB(g, a + 0.01, 0.26, d, b - 0.01, top - 0.05, d + 0.025, 0.004, m.dark, 1); BX(g, a + 0.05, 0.32, d + 0.025, b - 0.05, top - 0.17, d + 0.027, L.solid('#0E0F10', 0.08, 0.2));
			ROD(g, [a + 0.06, top - 0.1, d + 0.06], [b - 0.06, top - 0.1, d + 0.06], 0.008, m.steel); BX(g, mid - 0.06, top - 0.075, d + 0.025, mid + 0.06, top - 0.06, d + 0.027, m.night ? emissive('#FFB060', 1.5) : L.solid('#3A3A3A', 0.3));
		} else if (i % 3 === 1 && !isSink) {
			[[0.1, 0.33], [0.335, 0.6], [0.605, top - 0.045]].forEach(function (q) { front(g, K, m, a, q[0], b, q[1], d); handle(g, K, m, mid, q[1] - 0.05, d + (m.c.fronts === 'shaker' ? 0.03 : 0.02), false); });
		} else {
			front(g, K, m, a, 0.1, b, top - 0.045, d); handle(g, K, m, i % 2 ? a + 0.05 : b - 0.05, top - 0.12, d + (m.c.fronts === 'shaker' ? 0.03 : 0.02), true, 0.22);
		}
	}
	if (!K.hd) { BX(g, x0, top - 0.045, d - 0.03, x1, top - 0.04, d + 0.02, m.dark); }
	// worktop with the sink cut-out
	var sinkW = c.sink === 'farmhouse' ? 0.8 : 0.72, ws = rrShape(x1 - x0 + 0.02, d + 0.03, 0.004, (x0 + x1) / 2, (d + 0.03) / 2);
	if (o.sink !== undefined && c.sink !== 'farmhouse') { ws.holes.push(rrShape(sinkW - 0.2, 0.4, 0.06, o.sink, 0.3)); }
	if (o.sink !== undefined && c.sink === 'farmhouse') {
		var l = rrShape(o.sink - sinkW / 2 - x0 + 0.01, d + 0.03, 0.003, (x0 - 0.01 + o.sink - sinkW / 2) / 2, (d + 0.03) / 2), r = rrShape(x1 + 0.01 - (o.sink + sinkW / 2), d + 0.03, 0.003, (o.sink + sinkW / 2 + x1 + 0.01) / 2, (d + 0.03) / 2);
		EX(g, l, top - 0.04, top, K.top, 0.002); EX(g, r, top - 0.04, top, K.top, 0.002);
		var fs = rrShape(sinkW, d + 0.04, 0.02, o.sink, (d + 0.04) / 2); fs.holes.push(rrShape(sinkW - 0.08, 0.44, 0.04, o.sink, 0.3));
		EX(g, fs, top - 0.24, top, ceramic(), 0.004); cavity(g, ceramic(), sinkW - 0.08, 0.2, 0.44, 0.04, o.sink, top - 0.002, 0.3);
	} else { EX(g, ws, top - 0.04, top, K.top, 0.002); }
	if (o.sink !== undefined) {
		if (c.sink !== 'farmhouse') { cavity(g, c.sink === 'composite' ? L.solid('#3A3836', 0.6) : L.solid('#B5B8BA', 0.3, 0.9), sinkW - 0.2, 0.2, 0.4, 0.06, o.sink, top - 0.002, 0.3); }
		LA(g, [[0, 0], [0.03, 0], [0.025, 0.02], [0.02, 0.2], [0, 0.2]], fin, o.sink, top, 0.06, 24);
		TU(g, [[o.sink, top + 0.19, 0.06], [o.sink, top + 0.36, 0.07], [o.sink, top + 0.38, 0.17], [o.sink, top + 0.3, 0.26]], 0.012, fin, 24);
		ROD(g, [o.sink + 0.03, top + 0.12, 0.06], [o.sink + 0.1, top + 0.14, 0.06], 0.006, fin);
	}
	if (o.hob !== undefined && app.indexOf('hob') !== -1) {
		RB(g, o.hob - 0.3, top, 0.07, o.hob + 0.3, top + 0.006, 0.57, 0.004, L.solid('#0E0F10', 0.08, 0.2), 1);
		[[-0.15, 0.2, 0.1], [0.15, 0.2, 0.08], [-0.15, 0.44, 0.08], [0.15, 0.44, 0.1]].forEach(function (q) { var t = M(new THREE.TorusGeometry(q[2], 0.002, 4, 40), m.night ? emissive('#FF6A3A', 1) : L.solid('#5A5C5E', 0.4)); t.rotation.x = Math.PI / 2; at(t, o.hob + q[0], top + 0.0065, q[1]); g.add(t); });
		if (o.hood === 'downdraft') { RB(g, o.hob - 0.3, top, 0.02, o.hob + 0.3, top + 0.2, 0.06, 0.006, L.solid('#121314', 0.2, 0.3), 1); }
	}
	// wall: backsplash, upper cabinets / open shelves / glass cabinets, hood
	if (o.splash !== false) {
		var up = o.uppers || 'closed', sy1 = up === 'none' ? Math.min(1.7, H - 0.6) : 1.5;
		BX(g, x0, top, 0, x1, sy1, 0.015, K.bsM);
		var ux0 = x0, ux1 = x1, uy0 = 1.5, uy1 = Math.min(2.3, H - 0.1), ud = 0.35;
		var hoodX = o.hob !== undefined && o.hood !== 'integrated' && o.hood !== 'downdraft' && o.hood !== 'island' ? o.hob : null;
		var skip = function (xa, xb) { return hoodX !== null && xb > hoodX - 0.45 && xa < hoodX + 0.45; };
		if (up === 'closed' || up === 'glass') {
			var un = Math.max(1, Math.round((ux1 - ux0) / 0.6)), uw = (ux1 - ux0) / un;
			for (var u = 0; u < un; u++) {
				var ua = ux0 + u * uw, ub = ua + uw;
				if (skip(ua, ub)) { continue; }
				BX(g, ua, uy0, 0, ub, uy1, ud - 0.02, K.carcase);
				if (up === 'glass') { RB(g, ua + 0.002, uy0, ud - 0.02, ub - 0.002, uy1, ud, 0.002, K.fr, 1); add(g, at(M(L.boxGeo(uw - 0.08, uy1 - uy0 - 0.08, 0.004), glass('#E8EEEE', 0.25), false), (ua + ub) / 2, (uy0 + uy1) / 2, ud + 0.002)); BX(g, ua + 0.01, uy0 + 0.01, 0.02, ub - 0.01, uy1 - 0.01, ud - 0.04, L.solid(L.shadeHex(m.pal[0], -0.02), 0.8)); BX(g, ua + 0.02, (uy0 + uy1) / 2, 0.02, ub - 0.02, (uy0 + uy1) / 2 + 0.012, ud - 0.04, glass('#E8EEEE', 0.5)); for (var p = ua + 0.08; p < ub - 0.06; p += 0.09) { LA(g, [[0, 0], [0.03, 0], [0.035, 0.1], [0.032, 0.1], [0.026, 0.004], [0, 0.004]], glass('#F2F6F6', 0.6), p, uy0 + 0.02, 0.15, 16); bowl(g, m, p, (uy0 + uy1) / 2 + 0.012, 0.16, 0.05, m.white); } }
				else { front(g, K, m, ua + 0.002, uy0, ub - 0.002, uy1, ud - 0.02); handle(g, K, m, u % 2 ? ua + 0.05 : ub - 0.05, uy0 + 0.08, ud + (m.c.fronts === 'shaker' ? 0.01 : 0), true, 0.2); }
				if (m.night) { BX(g, ua + 0.02, uy0 - 0.008, 0.05, ub - 0.02, uy0, 0.1, emissive('#FFE3BA', 1.6)); }
			}
		} else if (up === 'open') {
			[1.62, 2.0].forEach(function (y, k) {
				if (y > H - 0.3) { return; }
				var sx = [[ux0 + 0.05, hoodX !== null ? hoodX - 0.5 : ux1 - 0.05], [hoodX !== null ? hoodX + 0.5 : ux1, ux1 - 0.05]];
				sx.forEach(function (q, si) {
					if (q[1] - q[0] < 0.3) { return; }
					RB(g, q[0], y, 0, q[1], y + 0.04, 0.26, 0.004, m.oak, 1);
					var r = rnd(k * 3 + si + 2);
					for (var xx = q[0] + 0.08; xx < q[1] - 0.08; xx += 0.14 + r() * 0.1) { var kind = Math.floor(r() * 3); if (kind === 0) { bowl(g, m, xx, y + 0.04, 0.13, 0.07, m.white); } else if (kind === 1) { LA(g, [[0, 0], [0.04, 0], [0.04, 0.14], [0.03, 0.15], [0, 0.15]], glass('#E9EEEE', 0.5), xx, y + 0.04, 0.12, 20); CY(g, xx, y + 0.19, 0.12, 0.032, 0.032, 0.02, m.oak, 16); } else { for (var pl = 0; pl < 4; pl++) { CY(g, xx, y + 0.04 + pl * 0.012, 0.13, 0.11, 0.1, 0.01, m.white, 32); } } }
				});
			});
		}
		// hood
		if (o.hob !== undefined && (o.hood === 'chimney' || o.hood === 'box')) {
			var hm = m.c.handles === 'brass' && m.st === 'classic' ? m.brass : L.solid('#B9BDC1', 0.3, 0.85);
			if (o.hood === 'chimney') { var ca = M(new THREE.CylinderGeometry(0.17, 0.62, 0.4, 4, 1), hm); ca.rotation.y = Math.PI / 4; ca.scale.set(1, 1, 0.72); at(ca, o.hob, 1.82, 0.26); g.add(ca); RB(g, o.hob - 0.45, 1.6, 0, o.hob + 0.45, 1.64, 0.5, 0.004, hm, 1); }
			else { RB(g, o.hob - 0.45, 1.6, 0, o.hob + 0.45, 1.85, 0.5, 0.006, m.st === 'monochrome' ? m.dark : hm, 1); }
			BX(g, o.hob - 0.14, o.hood === 'chimney' ? 2.0 : 1.85, 0, o.hob + 0.14, H, 0.26, hm);
		}
	}
	// what stands on the worktop
	if (o.decor !== false) {
		var free = function (x) { return (o.sink === undefined || Math.abs(x - o.sink) > 0.5) && (o.hob === undefined || Math.abs(x - o.hob) > 0.45); };
		if (free(x0 + 0.35)) { RB(g, x0 + 0.2, top, 0.02, x0 + 0.5, top + 0.4, 0.04, 0.01, m.oak, 1).rotation.x = -0.08; bottle(g, m, x0 + 0.62, top, 0.1, 1.1, glass('#B9C48A', 0.7)); }
		if (free(x1 - 0.4)) { bowl(g, m, x1 - 0.4, top, 0.32, 0.13, m.potW); [[0.0, 0.05], [0.05, -0.02], [-0.04, -0.03]].forEach(function (q, i) { SP(g, x1 - 0.4 + q[0], top + 0.07, 0.32 + q[1], 0.04, L.solid(['#E0A33A', '#C24A32', '#8DB04A'][i], 0.5), 16, 12); }); }
		var herb = (o.sink !== undefined ? o.sink : (x0 + x1) / 2) + 0.45; if (free(herb) && herb < x1 - 0.2) { var hp = plant(m, 'snake', 0.45); hp.position.set(herb, top, 0.15); g.add(hp); }
	}
	void tallW;
	return g;
}
export function island(m, len, o) {
	var g = G(), K = kMats(m), top = 0.92, d = 0.95;
	BX(g, -len / 2, 0, 0, len / 2, 0.1, 0.6, K.carcase); BX(g, -len / 2, 0.1, 0, len / 2, top - 0.04, 0.62, K.carcase);
	var n = Math.max(1, Math.round(len / 0.6)), dw = len / n;
	for (var i = 0; i < n; i++) { var a = -len / 2 + i * dw + 0.0015, b = a + dw - 0.003; RB(g, a, 0.1, -0.02, b, top - 0.045, 0.0, 0.003, K.fr, 1); }
	RB(g, -len / 2 - 0.05, top - 0.04, -0.05, len / 2 + 0.05, top, d - 0.05, 0.004, K.top, 1);
	RB(g, -len / 2, 0.1, 0.62, -len / 2 + 0.03, top - 0.04, d - 0.08, 0.002, K.fr, 1); RB(g, len / 2 - 0.03, 0.1, 0.62, len / 2, top - 0.04, d - 0.08, 0.002, K.fr, 1);
	var stoolT = o.stools || 'wood';
	if (stoolT !== 'none') { var ns = Math.max(2, Math.floor(len / 0.6)); for (var s = 0; s < ns; s++) { var st = barStool(m, stoolT); st.position.set(-len / 2 + (s + 0.5) * len / ns, 0, d + 0.12); st.rotation.y = Math.PI; g.add(st); } }
	bowl(g, m, len * 0.25, top, 0.4, 0.15, m.potW); vase(g, m, -len * 0.3, top, 0.3, 1);
	if (o.hood === 'island' && o.H) { RB(g, -0.45, 1.75, -0.05, 0.45, 1.95, 0.6, 0.008, L.solid('#B9BDC1', 0.3, 0.85), 1); BX(g, -0.12, 1.95, 0.15, 0.12, o.H, 0.4, L.solid('#B9BDC1', 0.3, 0.85)); }
	return g;
}
export function barStool(m, type) {
	var g = G(), h = 0.65;
	if (type === 'metal') {
		[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { ROD(g, [q[0] * 0.14, h, q[1] * 0.14], [q[0] * 0.19, 0, q[1] * 0.19], 0.011, m.black, 8); });
		RB(g, -0.2, h, -0.18, 0.2, h + 0.03, 0.2, 0.01, m.black, 1); RB(g, -0.18, h + 0.12, -0.2, 0.18, h + 0.22, -0.18, 0.008, m.black, 1); ROD(g, [-0.15, h, -0.19], [-0.15, h + 0.13, -0.19], 0.008, m.black); ROD(g, [0.15, h, -0.19], [0.15, h + 0.13, -0.19], 0.008, m.black);
		TU(g, [[-0.17, 0.25, -0.17], [0.17, 0.25, -0.17], [0.17, 0.25, 0.17], [-0.17, 0.25, 0.17]], 0.007, m.black, 20, true, 0);
	} else if (type === 'upholstered') {
		[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { ROD(g, [q[0] * 0.16, h, q[1] * 0.16], [q[0] * 0.19, 0, q[1] * 0.19], 0.012, m.fin === 'brass' ? m.brass : m.black, 8); });
		RB(g, -0.21, h - 0.02, -0.2, 0.21, h + 0.07, 0.21, 0.035, m.fab, 3); var b = M(rbGeo(0.4, 0.26, 0.06, 0.03, 3), m.fab); at(b, 0, h + 0.2, -0.2); b.rotation.x = -0.15; g.add(b);
		TU(g, [[-0.18, 0.28, -0.18], [0.18, 0.28, -0.18], [0.18, 0.28, 0.18], [-0.18, 0.28, 0.18]], 0.008, m.fin === 'brass' ? m.brass : m.black, 20, true, 0);
	} else if (type === 'rattan') {
		[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { ROD(g, [q[0] * 0.15, h, q[1] * 0.15], [q[0] * 0.19, 0, q[1] * 0.19], 0.016, m.oak, 8); });
		CY(g, 0, h, 0, 0.21, 0.19, 0.04, rattanMat('#C9A46B'), 32); CY(g, 0, h + 0.04, 0, 0.19, 0.19, 0.04, m.fab2, 32);
		var cb = new THREE.Shape(), sp = Math.PI * 0.9; cb.absarc(0, 0, 0.21, Math.PI / 2 + sp / 2, Math.PI / 2 - sp / 2, true); cb.absarc(0, 0, 0.19, Math.PI / 2 - sp / 2, Math.PI / 2 + sp / 2, false); cb.closePath();
		EX(g, cb, h + 0.05, h + 0.25, rattanMat('#C9A46B'), 0.004);
		TU(g, [[-0.17, 0.28, -0.17], [0.17, 0.28, -0.17], [0.17, 0.28, 0.17], [-0.17, 0.28, 0.17]], 0.01, m.oak, 20, true, 0);
	} else {
		[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { ROD(g, [q[0] * 0.12, h, q[1] * 0.12], [q[0] * 0.18, 0, q[1] * 0.18], 0.016, m.oak, 10); });
		LA(g, [[0, 0], [0.18, 0], [0.19, 0.02], [0.185, 0.04], [0, 0.035]], m.oak, 0, h, 0, 40);
		var ring = M(new THREE.TorusGeometry(0.17, 0.01, 8, 40), m.oak); ring.rotation.x = Math.PI / 2; at(ring, 0, 0.26, 0); g.add(ring);
	}
	return g;
}

/* ================================================================== architecture */
// Door in a wall: style, opening x (along the wall), width, height. Wall-local: u along the wall,
// v up, w out of the wall into the room (the wall surface is at w = 0, thickness to w = -0.25).
export function doorPiece(m, style, x, w, h, wallMat) {
	var g = G(), cas = L.solid('#F7F6F2', 0.45), fin = m.fin === 'brass' ? m.brass : m.black;
	var slab = style === 'hidden' ? wallMat : (m.st === 'japandi' || m.st === 'wood_stone' || m.st === 'scandinavian' ? m.oak : L.solid(L.shadeHex(m.pal[0], -0.02), 0.5));
	function lever(xx, z) { ROD(g, [xx, 1.02, z], [xx, 1.02, z + 0.05], 0.009, fin, 8); ROD(g, [xx, 1.02, z + 0.05], [xx - 0.12, 1.02, z + 0.05], 0.009, fin, 8); RB(g, xx - 0.02, 0.96, z - 0.002, xx + 0.02, 1.1, z + 0.006, 0.006, fin, 1); }
	function casing(arch) {
		if (style === 'hidden' || style === 'pocket' && arch) { return; }
		var cw = style === 'panel' ? 0.09 : 0.07;
		BX(g, x - cw, 0, -0.005, x, h + (arch ? 0 : cw), 0.02, cas); BX(g, x + w, 0, -0.005, x + w + cw, h + (arch ? 0 : cw), 0.02, cas);
		if (!arch) { BX(g, x - cw, h, -0.005, x + w + cw, h + cw, 0.02, cas); if (style === 'panel') { BX(g, x - cw - 0.02, h + cw, -0.005, x + w + cw + 0.02, h + cw + 0.03, 0.04, cas); } }
	}
	if (style === 'barn') {
		var bw = w + 0.15, bx = x + w * 0.55, plank = veneer('#8A6446', 'quarter');
		for (var p = 0; p < 5; p++) { RB(g, bx + p * bw / 5 + 0.002, 0.01, 0.05, bx + (p + 1) * bw / 5 - 0.002, h + 0.08, 0.085, 0.004, plank, 1); }
		[[0.15, 0.3], [h - 0.25, h - 0.1]].forEach(function (q) { BX(g, bx, q[0], 0.085, bx + bw, q[1] - 0.06, 0.1, plank); });
		BX(g, x - 0.1, h + 0.16, 0.0, x + w * 2 + 0.3, h + 0.2, 0.03, m.black); [[bx + 0.15], [bx + bw - 0.15]].forEach(function (q) { CY(g, q[0], h + 0.1, 0.06, 0.04, 0.04, 0.02, m.black, 20).rotation.x = Math.PI / 2; ROD(g, [q[0], h + 0.1, 0.06], [q[0], h + 0.2, 0.03], 0.008, m.black); });
		ROD(g, [bx + 0.08, 0.8, 0.11], [bx + 0.08, 1.2, 0.11], 0.012, m.black);
		return g;
	}
	if (style === 'pocket') {
		RB(g, x - 0.02, 0, -0.2, x + w * 0.35, h - 0.005, -0.05, 0.003, slab, 1); BX(g, x + w * 0.35 - 0.03, 1.0, -0.05, x + w * 0.35 - 0.01, 1.1, -0.04, fin);
		casing(false);
		return g;
	}
	if (style === 'arched') { casing(true); }
	else { casing(false); }
	var z0 = -0.06, z1 = -0.015;
	if (style === 'glass') {
		var fr = m.st === 'industrial' || m.st === 'monochrome' ? m.black : slab;
		BX(g, x, 0, z0, x + 0.08, h, z1, fr); BX(g, x + w - 0.08, 0, z0, x + w, h, z1, fr); BX(g, x, 0, z0, x + w, 0.2, z1, fr); BX(g, x, h - 0.08, z0, x + w, h, z1, fr);
		for (var k = 1; k < 4; k++) { BX(g, x + 0.08, 0.2 + k * (h - 0.28) / 4 - 0.012, z0 + 0.01, x + w - 0.08, 0.2 + k * (h - 0.28) / 4 + 0.012, z1 - 0.01, fr); }
		add(g, at(M(L.boxGeo(w - 0.16, h - 0.28, 0.006), glass('#EEF3F3', 0.3), false), x + w / 2, 0.2 + (h - 0.28) / 2, (z0 + z1) / 2));
		lever(x + w - 0.07, z1);
		return g;
	}
	if (style === 'arched') {
		var s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(w, 0); s.lineTo(w, h - w / 2); s.absarc(w / 2, h - w / 2, w / 2, 0, Math.PI, false); s.lineTo(0, 0);
		var dg = new THREE.ExtrudeGeometry(s, { depth: 0.045, bevelEnabled: false, curveSegments: 24 }); var dm = M(dg, m.st === 'mediterranean' ? veneer('#8A6446', 'quarter') : slab); dm.position.set(x, 0, z0); g.add(dm);
		lever(x + w - 0.07, z1);
		return g;
	}
	BX(g, x, 0, z0, x + w, h - 0.005, z1, slab);
	if (style === 'panel') { [[0.12, 0.95], [1.1, h - 0.12]].forEach(function (q) { RB(g, x + 0.12, q[0], z1, x + w - 0.12, q[1], z1 + 0.012, 0.006, slab, 1); RB(g, x + 0.15, q[0] + 0.03, z1 + 0.008, x + w - 0.15, q[1] - 0.03, z1 + 0.016, 0.004, slab, 1); }); }
	if (style === 'hidden') { BX(g, x - 0.004, 0, z0, x, h, 0.001, m.dark); BX(g, x + w, 0, z0, x + w + 0.004, h, 0.001, m.dark); BX(g, x, h - 0.004, z0, x + w, h, 0.001, m.dark); }
	else { lever(x + w - 0.07, z1); }
	return g;
}
// Window dressing for an opening x0..x1 (sill y0, head y1) in wall-local coordinates; top = ceiling.
export function windowDressing(m, type, x0, x1, y0, y1, top) {
	var g = G(), tm = Math.min(top - 0.06, y1 + 0.25), cm = curtainMats(m), fab = cm.fab, sheer = cm.sheer;
	if (type === 'none') { return g; }
	if (type === 'cafe') {
		var ry = y0 + (y1 - y0) * 0.5;
		ROD(g, [x0 - 0.03, ry, 0.06], [x1 + 0.03, ry, 0.06], 0.007, m.fin === 'brass' ? m.brass : m.black);
		drape2(g, cm.kind === 'voile' || cm.kind === 'linen' ? sheer : fab, x0, x1, y0 + 0.02, ry, 0.07);
		return g;
	}
	if (type === 'pleated') {
		// accordion blind folded up under the head rail (one zig-zag extrusion)
		var pw2 = x1 - x0, yb = y1 - (y1 - y0) * 0.42, k = Math.max(4, Math.round((y1 - yb) / 0.032)), zs = new THREE.Shape(), pts = [];
		for (var i = 0; i <= k; i++) { pts.push([-(i % 2 ? 0.045 : 0.02), y1 - (y1 - yb) * i / k]); }
		zs.moveTo(pts[0][0], pts[0][1]); pts.forEach(function (q) { zs.lineTo(q[0], q[1]); });
		for (var j = pts.length - 1; j >= 0; j--) { zs.lineTo(pts[j][0] - 0.003, pts[j][1]); }
		var pg = new THREE.ExtrudeGeometry(zs, { depth: pw2 - 0.02, bevelEnabled: false }), pm = M(pg, cm.tone ? fab : fabric(L.shadeHex(m.pal[0], -0.02), 'linen'));
		pm.rotation.y = Math.PI / 2; pm.position.set(x0 + 0.01, 0, 0); g.add(pm);
		BX(g, x0, y1 - 0.02, 0.0, x1, y1 + 0.03, 0.06, L.solid('#EDEBE6', 0.5)); BX(g, x0 + 0.01, yb - 0.02, 0.0, x1 - 0.01, yb, 0.055, L.solid('#EDEBE6', 0.5));
		return g;
	}
	if (type === 'drapes' || type === 'sheer') {
		ROD(g, [x0 - 0.5, tm, 0.1], [x1 + 0.5, tm, 0.1], 0.012, m.fin === 'brass' ? m.brass : m.black);
		if (type === 'drapes') { [[x0 - 0.48, x0 - 0.02], [x1 + 0.02, x1 + 0.48]].forEach(function (q) { var d = drape(g, fab, 0, q[0], q[1], tm, true); d.rotation.y = 0; d.position.set((q[0] + q[1]) / 2, tm / 2, 0.12); }); }
		var sw = type === 'sheer' ? [x0 - 0.3, x1 + 0.3] : [x0 - 0.02, x1 + 0.02], ds = drape(g, sheer, 0, sw[0], sw[1], tm - 0.02, true); ds.rotation.y = 0; ds.position.set((sw[0] + sw[1]) / 2, (tm - 0.02) / 2 + 0.01, 0.08);
		return g;
	}
	var w = x1 - x0, hgt = y1 - y0;
	if (type === 'roman') {
		var by = y1 - hgt * 0.35;
		var rfab = cm.kind === 'voile' ? fabric(cm.tone || L.shadeHex(m.pal[0], -0.03), 'linen') : fab;
		RB(g, x0 - 0.02, by, 0.02, x1 + 0.02, y1 + 0.05, 0.05, 0.005, rfab, 1);
		for (var f = 0; f < 3; f++) { var fy = by + f * 0.07; RB(g, x0 - 0.03, fy - 0.025, 0.03, x1 + 0.03, fy + 0.025, 0.08, 0.025, rfab, 3); }
	} else if (type === 'venetian') {
		var vb = m.st === 'industrial' || m.st === 'monochrome' ? m.dark : L.solid('#EDEBE6', 0.5);
		BX(g, x0, y1 - 0.04, 0.0, x1, y1, 0.05, vb);
		for (var y = y1 - 0.06; y > y0 + hgt * 0.3; y -= 0.025) { var sl = M(L.boxGeo(w - 0.02, 0.002, 0.045), vb); sl.position.set((x0 + x1) / 2, y, 0.03); sl.rotation.x = 0.5; g.add(sl); }
		ROD(g, [x0 + 0.05, y1, 0.03], [x0 + 0.05, y0 + hgt * 0.3, 0.03], 0.002, vb, 4); ROD(g, [x1 - 0.05, y1, 0.03], [x1 - 0.05, y0 + hgt * 0.3, 0.03], 0.002, vb, 4);
	} else if (type === 'roller') {
		CY(g, (x0 + x1) / 2, y1 + 0.04, 0.05, 0.035, 0.035, w + 0.04, L.solid('#EDEBE6', 0.5), 16).rotation.z = Math.PI / 2;
		BX(g, x0, y1 - hgt * 0.45, 0.03, x1, y1 + 0.03, 0.035, cm.tone ? fab : fabric(L.shadeHex(m.pal[1], 0.1), 'linen'));
		BX(g, x0, y1 - hgt * 0.45 - 0.02, 0.025, x1, y1 - hgt * 0.45, 0.04, m.dark);
	} else if (type === 'shutters') {
		var sm = L.solid('#F4F2EE', 0.5), np = 4, pw = w / np;
		for (var p = 0; p < np; p++) {
			var px0 = x0 + p * pw, px1 = px0 + pw, ang = (p % 2 ? -1 : 1) * 0.0;
			BX(g, px0, y0, 0.02, px0 + 0.03, y1, 0.05, sm); BX(g, px1 - 0.03, y0, 0.02, px1, y1, 0.05, sm); BX(g, px0, y0, 0.02, px1, y0 + 0.05, 0.05, sm); BX(g, px0, y1 - 0.05, 0.02, px1, y1, 0.05, sm); BX(g, px0, (y0 + y1) / 2 - 0.025, 0.02, px1, (y0 + y1) / 2 + 0.025, 0.05, sm);
			for (var ly = y0 + 0.08; ly < y1 - 0.06; ly += 0.06) { if (Math.abs(ly - (y0 + y1) / 2) < 0.05) { continue; } var lv = M(L.boxGeo(pw - 0.06, 0.004, 0.05), sm); lv.position.set((px0 + px1) / 2, ly, 0.035); lv.rotation.x = 0.6; g.add(lv); }
			void ang;
		}
	}
	return g;
}
// Stairs rising along +z (towards the viewer) from z = 0, width w, up to height H; x from 0 to w.
export function stairs(m, type, w, H, run) {
	var g = G(), n = Math.max(10, Math.round(H / 0.18)), rise = H / n, tread = (run || 3.2) / n, wood = m.st === 'japandi' || m.st === 'scandinavian' ? m.oak : m.wood;
	if (type === 'spiral') {
		var R = Math.min(0.95, w), turn = Math.PI * 2 * 0.85, nn = Math.max(12, n);
		CY(g, 0, 0, 0, 0.05, 0.05, H + 0.9, m.black, 16);
		for (var i = 0; i < nn; i++) {
			var a = i / nn * turn, s = new THREE.Shape(), a0 = a, a1 = a + turn / nn * 1.15;
			s.moveTo(0, 0); s.absarc(0, 0, R, a0, a1, false); s.lineTo(0, 0);
			var t = EX(g, s, (i + 1) * rise - 0.05, (i + 1) * rise, wood, 0.004); void t;
			var ex = Math.cos((a0 + a1) / 2) * R, ez = -Math.sin((a0 + a1) / 2) * R; ROD(g, [ex, (i + 1) * rise, ez], [ex, (i + 1) * rise + 0.9, ez], 0.007, m.black, 6);
		}
		var hp = []; for (var k = 0; k <= 40; k++) { var b = k / 40 * turn; hp.push([Math.cos(b) * R, (k / 40) * H + 0.95, -Math.sin(b) * R]); } TU(g, hp, 0.02, wood, 120, false, 0.5);
		return g;
	}
	var white = L.solid('#F4F2EE', 0.5);
	function rail(a, b, steps, r) { ROD(g, [a[0], a[1] + 0.95, a[2]], [b[0], b[1] + 0.95, b[2]], 0.022, m.black); for (var q = 0; q <= steps; q++) { var t = q / Math.max(1, steps); ROD(g, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + (r || 0), a[2] + (b[2] - a[2]) * t], [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + 0.94, a[2] + (b[2] - a[2]) * t], 0.008, m.black, 6); } }
	if (type === 'l_shaped' || type === 'u_shaped') {
		// two flights with a landing: an L turns to +x, a U comes back beside the first flight
		var U = type === 'u_shaped', n2 = U ? Math.floor(n / 2) : Math.min(6, n - 4), n1 = n - n2, tr = L.clamp(((run || 3.2) - w) / n1, 0.2, 0.28), land = n1 * rise, lz0 = n1 * tr;
		for (var a1 = 0; a1 < n1; a1++) { var ya = (a1 + 1) * rise; RB(g, 0, ya - 0.05, a1 * tr, w, ya, (a1 + 1) * tr + 0.03, 0.005, wood, 1); BX(g, 0.01, ya - rise, a1 * tr, w - 0.01, ya - 0.05, a1 * tr + 0.02, white); }
		BX(g, 0, land - 0.16, lz0, U ? 2 * w + 0.1 : w, land, lz0 + w, wood);
		var str1 = new THREE.Shape(); str1.moveTo(0, 0); str1.lineTo(lz0, land - 0.16); str1.lineTo(lz0, land - 0.4); str1.lineTo(0.3, 0); str1.lineTo(0, 0);
		var sg1 = M(new THREE.ExtrudeGeometry(str1, { depth: 0.04, bevelEnabled: false }), white); sg1.rotation.y = -Math.PI / 2; sg1.position.set(w, 0, 0); g.add(sg1);
		if (U) {
			for (var b1 = 0; b1 < n2; b1++) { var yb = land + (b1 + 1) * rise, zb = lz0 - b1 * tr; RB(g, w + 0.1, yb - 0.05, zb - tr - 0.03, 2 * w + 0.1, yb, zb, 0.005, wood, 1); BX(g, w + 0.11, yb - rise, zb - 0.02, 2 * w + 0.09, yb - 0.05, zb, white); }
			rail([w + 0.05, 0, 0], [w + 0.05, land, lz0], n1, rise); rail([2 * w + 0.1, land, lz0], [2 * w + 0.1, H, lz0 - n2 * tr], n2, rise);
		} else {
			for (var c1 = 0; c1 < n2; c1++) { var yc = land + (c1 + 1) * rise, xc = w + c1 * tr; RB(g, xc, yc - 0.05, lz0, xc + tr + 0.03, yc, lz0 + w, 0.005, wood, 1); BX(g, xc, yc - rise, lz0 + 0.01, xc + 0.02, yc - 0.05, lz0 + w - 0.01, white); }
			rail([w, 0, 0], [w, land, lz0], n1, rise); rail([w, land, lz0], [w + n2 * tr, H, lz0], n2, rise);
		}
		return g;
	}
	if (type === 'space_saver') {
		// steep stair with alternating paddle treads on a central stringer
		var ws2 = Math.min(w, 0.66), st2 = 0.13;
		ROD(g, [ws2 / 2, 0, 0.05], [ws2 / 2, H - 0.05, n * st2], 0.035, m.black, 8);
		for (var p2 = 0; p2 < n; p2++) { var yp = (p2 + 1) * rise, left = p2 % 2 === 0; RB(g, left ? 0.02 : ws2 / 2, yp - 0.045, p2 * st2 - 0.05, left ? ws2 / 2 : ws2 - 0.02, yp, p2 * st2 + 0.2, 0.006, wood, 1); }
		[0.0, ws2].forEach(function (x) { ROD(g, [x, 0.9, 0], [x, H + 0.9, n * st2], 0.016, m.black); ROD(g, [x, 0, 0.02], [x, 0.9, 0.02], 0.01, m.black, 6); });
		return g;
	}
	if (type === 'cantilever') {
		// thick treads anchored in the wall (x = 0), nothing underneath; a slim rail on the wall
		for (var q2 = 0; q2 < n; q2++) { var yq = (q2 + 1) * rise; RB(g, 0, yq - 0.08, q2 * tread, w, yq, q2 * tread + tread + 0.02, 0.008, wood, 1); }
		ROD(g, [0.06, 0.95, 0], [0.06, H + 0.95, n * tread], 0.018, m.black);
		return g;
	}
	for (var j = 0; j < n; j++) {
		var y1 = (j + 1) * rise, z0 = j * tread, z1 = z0 + tread + 0.03;
		if (type === 'concrete') { BX(g, 0, 0, z0, w, y1, z1, L.pbr('concrete', { color: '#C4C0B8' }, { normal: 0.6 })); }
		else if (type === 'closed') { BX(g, 0, y1 - 0.04, z0, w, y1, z1, wood); BX(g, 0, y1 - rise, z0, w, y1 - 0.04, z0 + 0.02, L.solid('#F4F2EE', 0.5)); }
		else { RB(g, type === 'steel' ? 0.04 : 0, y1 - 0.06, z0, w, y1, z1, 0.006, wood, 1); }
	}
	var top = n * tread;
	if (type === 'steel') { for (var j2 = 0; j2 < n; j2++) { BX(g, w / 2 - 0.06, j2 * rise, j2 * tread, w / 2 + 0.06, (j2 + 1) * rise - 0.06, j2 * tread + 0.08, m.black); BX(g, w / 2 - 0.06, j2 * rise, j2 * tread, w / 2 + 0.06, j2 * rise + 0.08, (j2 + 1) * tread + 0.03, m.black); } }
	if (type === 'closed') { var s2 = new THREE.Shape(); s2.moveTo(0, 0); s2.lineTo(top, H); s2.lineTo(top, H + 0.25); s2.lineTo(0, 0.25); s2.lineTo(0, 0); var sg = new THREE.ExtrudeGeometry(s2, { depth: 0.04, bevelEnabled: false }); var sm = M(sg, L.solid('#F4F2EE', 0.5)); sm.rotation.y = -Math.PI / 2; sm.position.set(w + 0.04, 0, 0); g.add(sm); }
	// balustrade on the open side (x = w)
	if (type === 'floating' || type === 'concrete') {
		var gs = new THREE.Shape(); gs.moveTo(0, 0.1); gs.lineTo(top, H + 0.1); gs.lineTo(top, H + 1.0); gs.lineTo(0, 1.0); gs.lineTo(0, 0.1);
		var gg = M(new THREE.ShapeGeometry(gs), glass('#E6EEEE', 0.22), false); gg.rotation.y = -Math.PI / 2; gg.position.set(w + 0.01, 0, 0); g.add(gg);
		ROD(g, [w + 0.01, 1.0, 0], [w + 0.01, H + 1.0, top], 0.018, type === 'concrete' ? m.black : wood);
	} else {
		ROD(g, [w, 0.95, 0], [w, H + 0.95, top], 0.025, type === 'steel' ? m.black : wood);
		for (var b2 = 0; b2 < n; b2++) { var zz = (b2 + 0.5) * tread, yy = (b2 + 1) * rise; ROD(g, [w - 0.03, yy, zz], [w - 0.03, yy + 0.93, zz], type === 'steel' ? 0.006 : 0.014, type === 'steel' ? m.black : L.solid('#F4F2EE', 0.5), 6); }
	}
	return g;
}
// The furnishing of a children's room by theme: neutral, a boy's, a girl's, a baby's or a teenager's room.
// Only the pieces the theme adds are built here; the bed, the shelf and the toy box stand already.
function kidsTheme(R, m, c, W, D, H, bx, bw, P, tag, alt) {
	var th = c.kids_theme || 'auto';
	if (th === 'auto') { th = 'neutral'; }
	// the second children's room is furnished differently, so two kids do not get the same room
	if (alt) { th = { boy: 'girl', girl: 'boy', teen: 'boy', baby: 'girl', neutral: 'teen' }[th] || th; }
	if (th === 'none') { return; }
	var acc = { boy: '#3C6E9F', girl: '#D58AA6', baby: '#E6D7B8', teen: '#4A4A52', neutral: '#8FA896' }[th] || '#8FA896';
	var soft = L.solid(acc, 0.9), wood = m.oak || m.wood, white = m.white;
	function at2(o, x, z, rot) { P(tag(o, 'kids_theme'), L.clamp(x, 0.35, W - 0.35), L.clamp(z, 0.35, D - 0.35), rot || 0); }
	// a rug of the theme's colour in front of the bed, and a garland or canopy over it
	var rg = G(); RB(rg, -0.8, 0, -0.55, 0.8, 0.02, 0.55, 0.2, soft, 2); at2(rg, bx, Math.min(D - 0.7, 2.7));
	if (th === 'girl' || th === 'baby') {
		// canopy over the bed
		var cp = G(); CY(cp, 0, H - 0.5, 0, 0.06, 0.3, 0.5, L.solid('#FFFFFF', 0.95), 18, true);
		for (var a = 0; a < 8; a++) { var an = a / 8 * Math.PI * 2; ROD(cp, [Math.cos(an) * 0.3, H - 0.5, Math.sin(an) * 0.3], [Math.cos(an) * 0.75, H - 1.9, Math.sin(an) * 0.75], 0.012, L.solid('#FFF8F4', 0.98), 5); }
		at2(cp, bx, 1.05);
	}
	if (th === 'boy' || th === 'teen') {
		// a desk with a chair and, for a teenager, a beanbag
		var dk = G(); RB(dk, -0.6, 0.7, 0, 0.6, 0.74, 0.58, 0.006, wood, 1);
		[[-0.55, 0.05], [0.55, 0.05], [-0.55, 0.52], [0.55, 0.52]].forEach(function (q) { ROD(dk, [q[0], 0, q[1]], [q[0], 0.7, q[1]], 0.016, m.metal, 6); });
		bookStack(dk, m, 0.34, 0.74, 0.26, 3, 6); tableLamp(dk, m, -0.42, 0.74, 0.26);
		at2(dk, 1.0, 0.35);
		var ch = diningChair(m, 'cantilever'); at2(ch, 1.0, 1.1, 180);
		if (th === 'teen') { var bg = G(); RB(bg, -0.42, 0, -0.42, 0.42, 0.5, 0.42, 0.3, soft, 3); at2(bg, W - 0.9, D - 0.9, 20); }
	}
	if (th === 'boy') {
		// a toy car and a ball on the floor, a pennant chain on the wall
		var car = G(); RB(car, -0.17, 0.03, -0.09, 0.17, 0.13, 0.09, 0.03, L.solid('#C0392B', 0.5), 2); RB(car, -0.08, 0.13, -0.07, 0.07, 0.2, 0.07, 0.02, L.solid('#2E3033', 0.4), 2);
		[[-0.11, -0.09], [0.11, -0.09], [-0.11, 0.09], [0.11, 0.09]].forEach(function (q) { CY(car, q[0], 0.0, q[1], 0.045, 0.045, 0.03, m.black, 10); });
		car.rotation.y = 0.6; at2(car, bx - 0.9, Math.min(D - 0.8, 2.4));
		var ball = M(new THREE.SphereGeometry(0.11, 16, 12), soft); ball.position.set(0, 0.11, 0); var bg2 = G(); bg2.add(ball); at2(bg2, W - 1.3, Math.min(D - 0.6, 2.9));
	}
	if (th === 'girl') {
		// a dressing table with a round mirror and a soft toy on the bed
		var dt = G(); RB(dt, -0.45, 0.68, 0, 0.45, 0.72, 0.4, 0.006, white, 1);
		[[-0.4, 0.05], [0.4, 0.05], [-0.4, 0.34], [0.4, 0.34]].forEach(function (q) { ROD(dt, [q[0], 0, q[1]], [q[0], 0.68, q[1]], 0.014, wood, 6); });
		var mr = M(new THREE.TorusGeometry(0.21, 0.016, 8, 36), m.brass || m.metal); mr.position.set(0, 1.05, 0.06); dt.add(mr);
		var mg = M(new THREE.CircleGeometry(0.2, 32), mirror(), false); mg.position.set(0, 1.05, 0.055); dt.add(mg);
		vase(dt, m, -0.28, 0.72, 0.18, 0.7);
		at2(dt, 0.9, 0.42);
	}
	if (th === 'baby') {
		// a changing table and a small chest of drawers
		var ct = G(); RB(ct, -0.45, 0.3, 0, 0.45, 0.9, 0.55, 0.01, white, 1); RB(ct, -0.44, 0.9, 0.03, 0.44, 0.98, 0.52, 0.04, soft, 2);
		RB(ct, -0.4, 0.34, 0.55, 0.4, 0.62, 0.56, 0.01, m.woodQ || wood, 1); RB(ct, -0.4, 0.66, 0.55, 0.4, 0.86, 0.56, 0.01, m.woodQ || wood, 1);
		at2(ct, 1.0, 0.4);
	}
	if (th === 'teen') {
		// a desk chair swapped for a gaming chair look: a tall back in the theme colour
		var gc = G(); RB(gc, -0.26, 0.44, -0.26, 0.26, 0.5, 0.26, 0.05, soft, 2); RB(gc, -0.24, 0.5, -0.3, 0.24, 1.1, -0.2, 0.05, L.solid('#2E3033', 0.6), 2);
		CY(gc, 0, 0, 0, 0.05, 0.05, 0.44, m.metal, 10); at2(gc, 1.0, 1.15, 180);
	}
}
// 1.25.0: the designed stair of a drawn house in a room view (s: agh-3d.js stairRoom, room frame): the flight
// from this floor up to the room's height (lower), and the top of the flight under the slab opening of this
// floor with the railing around the opening (upper). Same treads, same floor material (the stair's floor key) as the finished house.
function designedStair(c, s, H) {
	var grp = G(), n = 0, add = function (m) { if (m) { grp.add(m); } };
	grp.userData.stair = 'designed';
	if (s.lower) { n += L.stairParts(c, s, 0, add, { hi: H - 0.05, railHi: H - 1.0, hole: false }); }
	if (s.upper) { n += L.stairParts(c, s, -s.H, add, { lo: s.H - 1.0, hi: s.H }); }
	grp.userData.treads = n;
	return grp;
}
// A staircase that fits the room: the chosen type where there is room for it, a space-saving shape where
// there is not. Never returns nothing – a multi-level home must show its stairs.
export function stairFit(m, c, W, D, H) {
	var sty = pick(c, 'stair_type') || 'closed', runX = Math.min(W - 0.6, 3.6), wid = L.clamp(Math.min(1.0, D - 1.0), 0.62, 1.0);
	// a straight flight needs ~2.6 m of run and 0.8 m of width; below that a spiral, and in the tightest hall
	// an alternating-tread flight (the only shape that climbs a storey in under 2 m)
	if (runX < 2.6 || wid < 0.8) { sty = (Math.min(W, D) >= 2.3) ? 'spiral' : 'space_saver'; }
	else if (runX < 3.0 && (sty === 'u_shaped' || sty === 'l_shaped')) { sty = 'closed'; }
	var rad = L.clamp(Math.min(W, D) / 2 - 0.2, 0.7, 0.95);
	var g = stairs(m, sty, sty === 'spiral' ? rad : wid, H, Math.max(runX, 2.0));
	g.userData.stairType = sty; g.userData.radius = rad; g.userData.field = 'stair_type'; g.userData.item = 'stair_type';
	return g;
}

/* ================================================================== vehicles
 * Side profiles (x along the vehicle from the rear, y up), rounded and extruded across the width. */
function roundShape(pts, r) {
	var s = new THREE.Shape(), n = pts.length;
	for (var i = 0; i < n; i++) {
		var p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
		var da = Math.hypot(p[0] - a[0], p[1] - a[1]), db = Math.hypot(b[0] - p[0], b[1] - p[1]), k = Math.min(r, da * 0.45, db * 0.45);
		var p0 = [p[0] + (a[0] - p[0]) * k / da, p[1] + (a[1] - p[1]) * k / da], p1 = [p[0] + (b[0] - p[0]) * k / db, p[1] + (b[1] - p[1]) * k / db];
		if (i === 0) { s.moveTo(p0[0], p0[1]); } else { s.lineTo(p0[0], p0[1]); }
		s.quadraticCurveTo(p[0], p[1], p1[0], p1[1]);
	}
	s.closePath();
	return s;
}
var CARS = {
	sedan: { W: 1.82, r: 0.33, wb: [-1.4, 1.42], body: [[-2.3, 0.3], [2.3, 0.3], [2.33, 0.68], [1.7, 0.9], [0.8, 0.98], [-0.15, 1.42], [-1.15, 1.4], [-1.72, 1.03], [-2.25, 1.0], [-2.34, 0.82]], glass: [[0.7, 0.99], [-0.13, 1.36], [-1.1, 1.35], [-1.58, 1.04]] },
	hatchback: { W: 1.78, r: 0.32, wb: [-1.25, 1.3], body: [[-2.0, 0.3], [2.0, 0.3], [2.02, 0.72], [1.4, 0.95], [0.62, 1.02], [-0.15, 1.5], [-1.65, 1.48], [-1.98, 1.12], [-2.02, 0.95]], glass: [[0.55, 1.02], [-0.14, 1.44], [-1.6, 1.43], [-1.9, 1.12]] },
	suv: { W: 1.92, r: 0.38, wb: [-1.45, 1.45], body: [[-2.35, 0.42], [2.35, 0.42], [2.38, 0.95], [1.75, 1.12], [0.95, 1.16], [0.25, 1.7], [-1.95, 1.72], [-2.32, 1.32], [-2.38, 1.0]], glass: [[0.86, 1.16], [0.24, 1.64], [-1.92, 1.66], [-2.22, 1.26]], rails: true },
	pickup: { W: 1.88, r: 0.38, wb: [-1.65, 1.5], bed: [-2.65, -0.92], body: [[-2.65, 0.45], [2.65, 0.45], [2.68, 1.0], [2.0, 1.16], [1.2, 1.2], [0.55, 1.82], [-0.75, 1.82], [-0.86, 1.24], [-0.92, 0.95], [-2.65, 0.95]], glass: [[1.1, 1.22], [0.52, 1.76], [-0.7, 1.76], [-0.8, 1.26]] },
	van: { W: 1.98, r: 0.36, wb: [-1.7, 1.55], body: [[-2.5, 0.38], [2.5, 0.38], [2.52, 0.92], [2.15, 1.18], [1.55, 1.92], [-2.42, 2.0], [-2.52, 1.8]], glass: [[2.05, 1.2], [1.52, 1.86], [0.85, 1.88], [0.85, 1.25]] },
	sports: { W: 1.9, r: 0.33, wb: [-1.35, 1.45], body: [[-2.25, 0.25], [2.25, 0.25], [2.32, 0.5], [1.4, 0.76], [0.4, 0.86], [-0.45, 1.2], [-1.35, 1.15], [-2.22, 0.86]], glass: [[0.32, 0.88], [-0.42, 1.16], [-1.3, 1.12], [-1.75, 0.95]] },
	electric: { W: 1.86, r: 0.34, wb: [-1.45, 1.45], body: [[-2.35, 0.3], [2.35, 0.3], [2.38, 0.66], [1.6, 0.88], [0.85, 0.95], [-0.1, 1.45], [-1.55, 1.38], [-2.3, 0.98]], glass: [[0.78, 0.97], [-0.08, 1.4], [-1.5, 1.34], [-2.1, 1.0]], ev: true }
};
// Shared geometry (tyres, rims, limbs, trunks): built once, never disposed with a scene.
var GEOC = {};
function geoC(key, make) { if (!GEOC[key]) { GEOC[key] = make(); GEOC[key].userData.shared = true; } return GEOC[key]; }
// The same primitive (sphere, capsule, torus, cone, cylinder) with the same sizes is built once and shared.
function gc(t, a) {
	var k = t + a.map(function (v) { return typeof v === 'number' ? Math.round(v * 10000) : String(v); }).join(',');
	return geoC(k, function () { var C = THREE[t + 'Geometry']; return new (Function.prototype.bind.apply(C, [null].concat(a)))(); });
}
// A finished model (vehicle, person, pet) is built once per look, its parts merged into one mesh per
// material, and handed out as cheap copies that share that geometry (1.24.0): many detailed models cost
// no more to place than a few simple ones.
var MODELS = {};
function premerge(g) {
	g.updateMatrixWorld(true);
	var inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), B = {}, order = [], out = new THREE.Group();
	g.traverse(function (ch) {
		if (!ch.isMesh || !ch.geometry || !ch.geometry.attributes.position) { return; }
		var mat = ch.material, m4 = new THREE.Matrix4().multiplyMatrices(inv, ch.matrixWorld);
		if (Array.isArray(mat) || !mat || mat.transparent || m4.determinant() < 0) {
			var keep = new THREE.Mesh(ch.geometry, mat); keep.castShadow = ch.castShadow; keep.receiveShadow = ch.receiveShadow;
			m4.decompose(keep.position, keep.quaternion, keep.scale); out.add(keep); return;
		}
		var geo = ch.geometry.index ? ch.geometry.toNonIndexed() : ch.geometry.clone();
		geo.applyMatrix4(m4);
		if (!geo.attributes.normal) { geo.computeVertexNormals(); }
		var key = mat.uuid + (ch.castShadow ? 'c' : '');
		if (!B[key]) { B[key] = { mat: mat, cast: ch.castShadow, list: [], n: 0 }; order.push(key); }
		B[key].list.push(geo); B[key].n += geo.attributes.position.count;
	});
	order.forEach(function (key) {
		var b = B[key], pos = new Float32Array(b.n * 3), nor = new Float32Array(b.n * 3), uv = new Float32Array(b.n * 2), o = 0;
		b.list.forEach(function (q) {
			var n = q.attributes.position.count;
			pos.set(q.attributes.position.array, o * 3); nor.set(q.attributes.normal.array, o * 3);
			if (q.attributes.uv) { uv.set(q.attributes.uv.array.subarray(0, n * 2), o * 2); }
			o += n; q.dispose();
		});
		var mg = new THREE.BufferGeometry();
		mg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); mg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); mg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
		mg.computeBoundingSphere(); mg.userData.shared = true; mg.userData.premerged = true;
		var mesh = new THREE.Mesh(mg, b.mat); mesh.castShadow = b.cast; mesh.receiveShadow = true; out.add(mesh);
	});
	out.userData = Object.assign({}, g.userData);
	return out;
}
function model(key, build) {
	if (!MODELS[key]) { MODELS[key] = premerge(build()); }
	var c = MODELS[key].clone(true);
	c.userData = Object.assign({}, MODELS[key].userData);
	return c;
}
var PAINTS = ['#3C4148', '#ECEDEE', '#1E2226', '#7A1E22', '#2E4A6B', '#9EA3A8'];
// Lifelike vehicles (1.24.0): the side profile is extruded with rounded edges and then shaped – the glass
// house leans in (tumblehome), the nose and tail round off in plan, the flanks bulge a little. On top: tyres
// with sidewalls, five-spoke rims with brake discs, dark wheel arches, glazing you can see the seats through,
// pillars, door seams and handles, head and tail light clusters, grille, number plates, bumpers, mirrors.
function carPaint(color) { return L.cached('vp2' + color, function () { return L.stdMat({ color: color, metalness: 0.55, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06 }); }); }
function tyreGeo(r, w) {
	var key = 'tyre' + Math.round(r * 1000) + 'x' + Math.round(w * 1000);
	return geoC(key, function () {
		// cross-section of the tyre: tread, rounded shoulders, sidewall down to the rim
		var h = w / 2, ri = r * 0.64, pts = [[ri, -h * 0.82], [r * 0.9, -h * 0.98], [r - 0.025, -h * 0.9], [r, -h * 0.6], [r, h * 0.6], [r - 0.025, h * 0.9], [r * 0.9, h * 0.98], [ri, h * 0.82]];
		var g = new THREE.LatheGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 20);
		g.rotateX(Math.PI / 2);
		return g;
	});
}
function rimGeo(r) {
	return geoC('rim' + Math.round(r * 1000), function () {
		// a dished rim face: lip, a shallow cone to the hub
		var pts = [[0.001, 0.02], [r * 0.16, 0.022], [r * 0.2, 0.012], [r * 0.9, -0.012], [r, -0.004], [r, -0.06], [r * 0.95, -0.07]];
		var g = new THREE.LatheGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 16);
		g.rotateX(Math.PI / 2);
		return g;
	});
}
function wheel(g, x, y, z, r, sd, m) {
	var tyre = L.cached('vtyre', function () { return L.stdMat({ color: '#18191A', roughness: 0.88, metalness: 0 }); }), rimM = L.cached('vrim', function () { return L.stdMat({ color: '#C3C7CB', roughness: 0.22, metalness: 0.95 }); });
	var dark = L.solid('#1B1C1E', 0.55, 0.3), disc = L.solid('#7C8186', 0.35, 0.85), rr = r * 0.62;
	var w = new THREE.Group(); w.position.set(x, y, z); if (sd < 0) { w.rotation.y = Math.PI; }
	w.add(M(tyreGeo(r, 0.23), tyre));
	var face = M(rimGeo(rr), rimM); face.position.z = 0.1; w.add(face);
	// brake disc and caliper behind the spokes, the hub cap
	var bd = M(gc('Cylinder', [rr * 0.78, rr * 0.78, 0.02, 12]), disc); bd.rotation.x = Math.PI / 2; bd.position.z = 0.03; w.add(bd);
	var cal = M(L.boxGeo(0.09, rr * 0.45, 0.05), L.solid('#5A5E62', 0.4, 0.5)); cal.position.set(-rr * 0.55, rr * 0.25, 0.05); w.add(cal);
	for (var k = 0; k < 5; k++) {
		var a = k / 5 * Math.PI * 2, sp = M(L.boxGeo(0.055, rr * 0.82, 0.03), rimM);
		sp.position.set(Math.sin(a) * rr * 0.45, Math.cos(a) * rr * 0.45, 0.115); sp.rotation.z = -a; w.add(sp);
	}
	var cap = M(gc('Cylinder', [rr * 0.17, rr * 0.19, 0.03, 16]), dark); cap.rotation.x = Math.PI / 2; cap.position.z = 0.13; w.add(cap);
	g.add(w);
	return w;
}
// Shape the extruded body: the glass house leans in, the ends round off in plan, the flanks bulge.
function shapeBody(geo, P, W) {
	var pos = geo.attributes.position, xs = P.body.map(function (q) { return q[0]; }), x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
	var belt = Math.min.apply(null, P.glass.map(function (q) { return q[1]; })), roof = Math.max.apply(null, P.body.map(function (q) { return q[1]; })), cx = (x0 + x1) / 2, hx = (x1 - x0) / 2;
	for (var i = 0; i < pos.count; i++) {
		var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), k = 1;
		if (y > belt) { k *= 1 - 0.17 * Math.min(1, (y - belt) / Math.max(0.1, roof - belt)); }
		var e = Math.abs(x - cx) / hx; k *= 1 - 0.13 * Math.pow(Math.min(1, e), 5);
		var mid = (belt + 0.3) / 2; k *= 1 + 0.025 * Math.max(0, 1 - Math.abs(y - mid) / 0.45);
		pos.setZ(i, z * k);
	}
	pos.needsUpdate = true;
	geo.computeVertexNormals();
}
export function vehicle(m, type, color) { return model('veh|' + type + '|' + color + '|' + (m && m.night ? 1 : 0), function () { return vehicleBuild(m, type, color); }); }
function vehicleBuild(m, type, color) {
	var g = G(), P = CARS[type] || CARS.sedan, paint = carPaint(color);
	// the glass lies just proud of the body: opaque, dark and mirror-like (a see-through pane would show the paint)
	var glassM = L.cached('vglass3', function () { return L.stdMat({ color: '#121A21', metalness: 0.6, roughness: 0.05, envMapIntensity: 2 }); });
	var trim = L.solid('#131416', 0.5, 0.2), plastic = L.solid('#1E2022', 0.75), chrome = L.cached('vchrome', function () { return L.stdMat({ color: '#D9DCDF', metalness: 1, roughness: 0.12 }); });
	// the side profile with the wheel arches cut into its lower edge
	var R = P.r + 0.07, prof = [P.body[0]], wbs = P.wb.slice().sort(function (a, b) { return a - b; });
	wbs.forEach(function (x) { prof.push([x - R, P.body[0][1]]); for (var a = 0; a <= 8; a++) { var t = Math.PI - a / 8 * Math.PI; prof.push([x + R * Math.cos(t), P.r + R * Math.sin(t)]); } prof.push([x + R, P.body[0][1]]); });
	prof = prof.concat(P.body.slice(1));
	var W = P.W - 0.16, body = geoC('carbody' + type, function () { var g0 = new THREE.ExtrudeGeometry(roundShape(prof, 0.2), { depth: W, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.06, bevelSegments: 2, curveSegments: 3 }); g0.translate(0, 0, -W / 2); shapeBody(g0, P, W); return g0; });
	add(g, M(body, paint));
	var xs = P.body.map(function (q) { return q[0]; }), x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
	var belt = Math.min.apply(null, P.glass.map(function (q) { return q[1]; })), roofY = Math.max.apply(null, P.body.map(function (q) { return q[1]; }));
	var half = P.W / 2, hz = half * 0.83;   // the leaned-in glass house half width
	// glazing: windscreens (narrower than the body) and side windows (just proud of the leaned-in flanks)
	function scaled(pts, k) { var cx = 0, cy = 0; pts.forEach(function (p) { cx += p[0] / pts.length; cy += p[1] / pts.length; }); return pts.map(function (p) { return [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]; }); }
	var gw = W + 0.22, gs = geoC('carglass' + type, function () { var g0 = new THREE.ExtrudeGeometry(roundShape(scaled(P.glass, 0.93), 0.07), { depth: gw, bevelEnabled: false, curveSegments: 5 }); g0.translate(0, -0.01, -gw / 2); shapeBody(g0, P, W); return g0; });
	add(g, M(gs, glassM, false));
	var lean = function (y) { return 1 - 0.17 * Math.min(1, Math.max(0, (y - belt) / Math.max(0.1, roofY - belt))); }, fw = W / 2 + 0.1;
	var gl = geoC('carscreen' + type, function () { var g0 = new THREE.ExtrudeGeometry(roundShape(scaled(P.glass, 1.05), 0.08), { depth: hz * 2 - 0.3, bevelEnabled: false, curveSegments: 5 }); g0.translate(0, 0, -(hz * 2 - 0.3) / 2); return g0; }); add(g, M(gl, glassM, false));
	// pillars between the side windows and a black frame line under the glass
	var gx = P.glass.map(function (q) { return q[0]; }), gx0 = Math.min.apply(null, gx), gx1 = Math.max.apply(null, gx), bx = gx0 + (gx1 - gx0) * 0.52;
	[-1, 1].forEach(function (sd) {
		var pa = belt + 0.04, pb = roofY - 0.1;
		ROD(g, [bx, pa, sd * (fw * lean(pa) + 0.02)], [bx - 0.06, pb, sd * (fw * lean(pb) + 0.02)], 0.04, trim);
		BX(g, gx0 + 0.05, belt - 0.03, sd * (fw + 0.02) - 0.01, gx1 - 0.05, belt + 0.005, sd * (fw + 0.02) + 0.01, chrome);
	});
	// seats and a steering wheel inside (seen through the glass)
	var seat = L.solid('#2A2B2D', 0.8);
	[[0.05, 1], [0.05, -1], [-0.85, 1], [-0.85, -1]].forEach(function (q) { if (q[0] < gx0 + 0.2) { return; } BX(g, q[0] - 0.25, P.r + 0.12, q[1] * 0.4 - 0.22, q[0] + 0.2, P.r + 0.24, q[1] * 0.4 + 0.22, seat); BX(g, q[0] - 0.3, P.r + 0.2, q[1] * 0.4 - 0.22, q[0] - 0.18, belt + 0.25, q[1] * 0.4 + 0.22, seat); });
	var sw = M(gc('Torus', [0.17, 0.018, 8, 24]), trim); sw.position.set(gx1 - 0.35, belt + 0.02, 0.4); sw.rotation.y = Math.PI / 2; sw.rotation.x = 0.4; g.add(sw);
	if (P.bed) {
		var b0 = P.bed[0], b1 = P.bed[1];
		[-1, 1].forEach(function (sd) { RB(g, b0, 0.95, sd * (half - 0.06) - 0.05, b1, 1.24, sd * (half - 0.06) + 0.05, 0.03, paint, 2); });
		RB(g, b0 - 0.02, 0.95, -half + 0.06, b0 + 0.07, 1.22, half - 0.06, 0.03, paint, 2);
		BX(g, b0 + 0.07, 0.95, -half + 0.1, b1, 0.98, half - 0.1, L.pbr('louvre', { color: '#2A2C2E' }, { normal: 1 }));
		[-1, 1].forEach(function (sd) { ROD(g, [b1 - 0.05, 1.26, sd * 0.85], [b1 - 0.05, 1.56, sd * 0.85], 0.025, trim); }); ROD(g, [b1 - 0.05, 1.56, -0.85], [b1 - 0.05, 1.56, 0.85], 0.025, trim);
	}
	if (P.rails) { [-1, 1].forEach(function (sd) { ROD(g, [-1.7, roofY + 0.06, sd * 0.66], [0.1, roofY + 0.04, sd * 0.66], 0.022, chrome); [-1.6, 0].forEach(function (x) { ROD(g, [x, roofY - 0.01, sd * 0.66], [x, roofY + 0.06, sd * 0.66], 0.02, trim); }); }); }
	// wheels, with dark arches round them
	var archM = L.cached('varch', function () { return L.stdMat({ color: '#0E0F10', roughness: 0.95, side: THREE.DoubleSide }); });
	P.wb.forEach(function (x) {
		var ar = M(gc('Cylinder', [R - 0.005, R - 0.005, W + 0.18, 12, 1, true]), archM, false);
		ar.rotation.x = Math.PI / 2; ar.position.set(x, P.r, 0); g.add(ar);
		[-1, 1].forEach(function (sd) { wheel(g, x, P.r, sd * (half - 0.13), P.r, sd, m); });
	});
	// bumpers, side skirts, grille, lights, plates, mirrors, handles, door seams
	var y0 = P.body[0][1], hy = P.body[2][1] - 0.12, night = m && m.night;
	RB(g, x1 - 0.1, y0 - 0.04, -half + 0.12, x1 + 0.06, y0 + 0.14, half - 0.12, 0.05, plastic, 2);
	RB(g, x0 - 0.06, y0 - 0.04, -half + 0.12, x0 + 0.1, y0 + 0.14, half - 0.12, 0.05, plastic, 2);
	[-1, 1].forEach(function (sd) { BX(g, wbs[0] + R + 0.05, y0 - 0.02, sd * fw - 0.025, wbs[wbs.length - 1] - R - 0.05, y0 + 0.08, sd * fw + 0.025, plastic); });
	var lens = L.cached('vlens', function () { return L.stdMat({ color: '#E9EEF2', metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.85, clearcoat: 1 }); });
	var head = night ? emissive('#FFF4DE', 3.2) : L.solid('#F4F6F8', 0.1, 0.6), drl = night ? emissive('#FFFFFF', 2.5) : L.solid('#DDE3E8', 0.2, 0.4), tail = night ? emissive('#FF2A1A', 2.4) : L.cached('vtail', function () { return L.stdMat({ color: '#9A1612', roughness: 0.15, metalness: 0.1, clearcoat: 1 }); });
	[-1, 1].forEach(function (sd) {
		var zc = sd * (half - 0.36);
		RB(g, x1 - 0.06, hy - 0.06, zc - 0.22, x1 + 0.035, hy + 0.07, zc + 0.22, 0.03, lens, 2);
		RB(g, x1 - 0.04, hy - 0.04, zc - 0.17, x1 + 0.04, hy + 0.04, zc + 0.03, 0.02, head, 2);
		BX(g, x1 - 0.02, hy - 0.065, zc - 0.2, x1 + 0.045, hy - 0.05, zc + 0.2, drl);
		RB(g, x0 - 0.04, hy - 0.04, sd * (half - 0.3) - 0.2, x0 + 0.06, hy + 0.07, sd * (half - 0.3) + 0.2, 0.025, tail, 2);
		// mirror on a stalk, a door handle per door, the door seams
		var mx = gx1 - 0.12, my = belt + 0.06;
		ROD(g, [mx, my - 0.02, sd * (fw - 0.02)], [mx - 0.05, my, sd * (fw + 0.1)], 0.018, trim);
		RB(g, mx - 0.13, my - 0.02, sd * (fw + 0.1) - 0.07, mx + 0.04, my + 0.11, sd * (fw + 0.1) + 0.07, 0.035, paint, 2);
		[bx + 0.15, gx0 + 0.25].forEach(function (x) { if (x > wbs[0] + 0.2 && x < wbs[wbs.length - 1]) { RB(g, x - 0.12, belt - 0.13, sd * (fw + 0.04) - 0.012, x + 0.04, belt - 0.09, sd * (fw + 0.04) + 0.012, 0.012, chrome, 1); } });
		[bx - 0.06, gx1 - 0.05, gx0 - 0.02].forEach(function (x) { if (x > wbs[0] + R && x < wbs[wbs.length - 1] - R) { BX(g, x - 0.004, y0 + 0.12, sd * (fw + 0.025) - 0.004, x + 0.004, belt - 0.02, sd * (fw + 0.025) + 0.004, trim); } });
	});
	if (!P.ev) {
		RB(g, x1 - 0.04, hy - 0.26, -0.45, x1 + 0.04, hy - 0.05, 0.45, 0.04, trim, 2);
		for (var sl = hy - 0.23; sl < hy - 0.07; sl += 0.045) { BX(g, x1 + 0.035, sl, -0.42, x1 + 0.05, sl + 0.012, 0.42, chrome); }
	} else { BX(g, x1 - 0.03, hy - 0.06, -half + 0.4, x1 + 0.03, hy - 0.04, half - 0.4, drl); BX(g, x0 - 0.03, hy + 0.08, -half + 0.4, x0 + 0.03, hy + 0.1, half - 0.4, tail); }
	var plate = L.solid('#F2F2EE', 0.4), ink = L.solid('#1A1C22', 0.5);
	[[x1 + 0.065, 1], [x0 - 0.065, -1]].forEach(function (q) { var py = y0 + 0.2; BX(g, q[0] - 0.012, py - 0.06, -0.26, q[0] + 0.012, py + 0.06, 0.26, plate); BX(g, q[0] - 0.014 * q[1] * -1 - 0.002, py - 0.06, -0.26, q[0] + 0.014 * q[1] * -1 + 0.002, py + 0.06, -0.21, L.solid('#1F4FA8', 0.4)); BX(g, q[0] - 0.015, py - 0.025, -0.15, q[0] + 0.015, py + 0.025, 0.2, ink); });
	return g;
}
export function motorcycle(m, color) {
	var g = G(), paint = L.cached('vp' + color, function () { return L.stdMat({ color: color, metalness: 0.6, roughness: 0.3 }); }), blk = L.solid('#141516', 0.5), chrome = m.chrome, tyre = L.solid('#161616', 0.85);
	[[-0.72, 0.32], [0.72, 0.32]].forEach(function (q) {
		var t = M(gc('Torus', [0.28, 0.06, 12, 36]), tyre); t.position.set(q[0], q[1], 0); g.add(t);
		var d = M(gc('Cylinder', [0.2, 0.2, 0.05, 24]), L.solid('#5A5E62', 0.3, 0.8)); d.rotation.x = Math.PI / 2; d.position.set(q[0], q[1], 0); g.add(d);
	});
	ROD(g, [0.72, 0.32, -0.07], [0.5, 0.95, -0.07], 0.022, chrome); ROD(g, [0.72, 0.32, 0.07], [0.5, 0.95, 0.07], 0.022, chrome);
	TU(g, [[0.5, 0.95, 0], [0.1, 0.78, 0], [-0.4, 0.75, 0], [-0.72, 0.32, 0]], 0.03, blk, 20);
	ROD(g, [0.1, 0.78, 0], [-0.1, 0.42, 0], 0.03, blk);
	RB(g, -0.15, 0.32, -0.16, 0.25, 0.62, 0.16, 0.05, L.solid('#3A3C3E', 0.4, 0.6), 2);
	var tank = M(gc('Sphere', [0.2, 12, 8]), paint); tank.scale.set(1.5, 0.75, 0.85); tank.position.set(0.18, 0.9, 0); g.add(tank);
	RB(g, -0.55, 0.82, -0.13, -0.05, 0.9, 0.13, 0.04, blk, 2);
	RB(g, -0.85, 0.72, -0.1, -0.5, 0.8, 0.1, 0.03, paint, 2);
	TU(g, [[-0.05, 0.45, 0.14], [-0.5, 0.42, 0.18], [-0.85, 0.5, 0.18]], 0.035, chrome, 12);
	ROD(g, [0.48, 1.05, -0.32], [0.48, 1.05, 0.32], 0.014, blk); ROD(g, [0.5, 0.95, 0], [0.48, 1.05, 0], 0.02, chrome);
	SP(g, 0.62, 0.92, 0, 0.09, m.night ? emissive('#FFF4DE', 3) : L.solid('#E8EAEC', 0.15, 0.4), 16, 12);
	RB(g, 0.55, 0.62, -0.09, 0.95, 0.66, 0.09, 0.02, paint, 1);
	return g;
}
export function bicycle(m, color) {
	var g = G(), fr = L.cached('vp' + color, function () { return L.stdMat({ color: color, metalness: 0.6, roughness: 0.35 }); }), tyre = L.solid('#1A1A1A', 0.8);
	[-0.52, 0.52].forEach(function (x) { var t = M(gc('Torus', [0.33, 0.02, 8, 40]), tyre); t.position.set(x, 0.35, 0); g.add(t); for (var k = 0; k < 8; k++) { var sp = M(L.boxGeo(0.006, 0.64, 0.006), m.steel); sp.position.set(x, 0.35, 0); sp.rotation.z = k / 8 * Math.PI; g.add(sp); } });
	ROD(g, [-0.52, 0.35, 0], [-0.1, 0.38, 0], 0.016, fr); ROD(g, [-0.1, 0.38, 0], [-0.22, 0.85, 0], 0.016, fr); ROD(g, [-0.22, 0.85, 0], [0.38, 0.82, 0], 0.016, fr); ROD(g, [-0.1, 0.38, 0], [0.38, 0.82, 0], 0.018, fr); ROD(g, [0.38, 0.82, 0], [0.52, 0.35, 0], 0.016, fr); ROD(g, [-0.52, 0.35, 0], [-0.22, 0.85, 0], 0.012, fr);
	RB(g, -0.32, 0.9, -0.06, -0.12, 0.94, 0.06, 0.02, L.solid('#1A1A1A', 0.6), 2); ROD(g, [-0.22, 0.85, 0], [-0.22, 0.9, 0], 0.012, m.steel);
	ROD(g, [0.38, 0.82, 0], [0.36, 1.0, 0], 0.014, m.steel); ROD(g, [0.36, 1.0, -0.26], [0.36, 1.0, 0.26], 0.012, L.solid('#1A1A1A', 0.6));
	return g;
}
// Wall box charger (on a wall, facing +z) with its cable.
export function wallbox(m) { var g = G(); RB(g, -0.16, 1.0, 0, 0.16, 1.38, 0.1, 0.03, L.solid('#F2F3F4', 0.3), 2); BX(g, -0.1, 1.24, 0.1, 0.1, 1.26, 0.102, m.night ? emissive('#46E07A', 2) : L.solid('#46A86A', 0.3)); TU(g, [[0, 1.0, 0.06], [0.05, 0.6, 0.12], [0.2, 0.5, 0.14], [0.3, 0.8, 0.1]], 0.012, L.solid('#1A1A1A', 0.6), 16); return g; }

// A balcony seen from the street (option card): a piece of facade with a glazed door, the slab and the railing.
export function balconyItem(m, type) {
	var g = G(), c = m.c, fac = L.solid(L.col(c.facade_color, '#F2EFE9'), 0.9), d = type === 'french' ? 0.14 : 1.5, met = L.solid('#33373B', 0.4, 0.75);
	var s = new THREE.Shape(); s.moveTo(-1.9, -0.7); s.lineTo(1.9, -0.7); s.lineTo(1.9, 2.9); s.lineTo(-1.9, 2.9); s.lineTo(-1.9, -0.7);
	var hp = new THREE.Path(); hp.moveTo(-0.55, 0.02); hp.lineTo(0.55, 0.02); hp.lineTo(0.55, 2.3); hp.lineTo(-0.55, 2.3); hp.lineTo(-0.55, 0.02); s.holes.push(hp);
	g.add(M(new THREE.ShapeGeometry(s), fac));
	var fm = L.frameMat(c); [[-0.55, 0.02, -0.49, 2.3], [0.49, 0.02, 0.55, 2.3], [-0.55, 2.24, 0.55, 2.3], [-0.03, 0.02, 0.03, 2.3]].forEach(function (q) { BX(g, q[0], q[1], -0.12, q[2], q[3], -0.04, fm); });
	add(g, at(M(L.boxGeo(1.0, 2.22, 0.01), L.glassMat(c, false), false), 0, 1.16, -0.08)); BX(g, -0.56, 0.02, -0.32, 0.56, 2.3, -0.3, L.solid('#2A2622', 0.9));
	if (type !== 'french') { BX(g, -1.5, -0.22, 0, 1.5, 0, d, L.solid('#D8D4CC', 0.8)); if (type === 'wood') { BX(g, -1.48, 0, 0, 1.48, 0.03, d - 0.02, L.pbr('deck', { color: '#A97B52' }, { normal: 1 })); } }
	// railing runs: [x0, z0, x1, z1]
	var runs = type === 'french' ? [[-0.65, 0.14, 0.65, 0.14]] : [[-1.48, d - 0.03, 1.48, d - 0.03], [-1.48, 0.02, -1.48, d - 0.03], [1.48, 0.02, 1.48, d - 0.03]];
	runs.forEach(function (r) {
		var along = r[0] !== r[2], len = along ? r[2] - r[0] : r[3] - r[1];
		function bx(a0, a1, y0, y1, t, mat) { if (along) { BX(g, r[0] + a0, y0, r[1] - t / 2, r[0] + a1, y1, r[1] + t / 2, mat); } else { BX(g, r[0] - t / 2, y0, r[1] + a0, r[0] + t / 2, y1, r[1] + a1, mat); } }
		if (type === 'glass') { bx(0, len, 0.1, 1.0, 0.02, glass('#BFD6DE', 0.32)); bx(0, len, 0, 0.1, 0.06, met); bx(0, len, 1.0, 1.05, 0.06, met); }
		else if (type === 'wood') { for (var a = 0.02; a < len - 0.06; a += 0.16) { bx(a, a + 0.1, 0, 0.98, 0.03, L.pbr('wood', { color: '#9C6B44' }, { normal: 1 })); } bx(0, len, 0.98, 1.04, 0.08, L.pbr('wood', { color: '#9C6B44' }, { normal: 1 })); }
		else if (type === 'solid') { bx(0, len, 0, 1.0, 0.15, fac); bx(0, len, 1.0, 1.04, 0.19, met); }
		else { bx(0, len, 0.97, 1.02, 0.05, met); bx(0, len, 0.08, 0.11, 0.03, met); for (var b = 0.04; b < len - 0.02; b += 0.11) { bx(b, b + 0.018, 0.11, 0.97, 0.018, met); } }
	});
	return g;
}

/* ================================================================== people and pets */
function limb(g, a, b, r, mat, r2) {
	var A = new THREE.Vector3(a[0], a[1], a[2]), B = new THREE.Vector3(b[0], b[1], b[2]), d = B.clone().sub(A), len = d.length();
	var geo = r2 && Math.abs(r2 - r) > 1e-4 ? taperGeo(r, r2, len) : new THREE.CapsuleGeometry(r, Math.max(0.001, len), 2, 7);
	var c = M(geo, mat); c.position.copy(A).addScaledVector(d, 0.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(c); return c;
}
// A tapered limb (thigh → knee, calf → ankle): a lathe with round ends, centred on its length.
function taperGeo(r0, r1, len) {
	var key = 'tp' + [r0, r1, len].map(function (v) { return Math.round(v * 1000); }).join('x');
	return geoC(key, function () {
		var pts = [], n = 6, i;
		for (i = 0; i <= n; i++) { var a = -Math.PI / 2 + i / n * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r0, -len / 2 + Math.sin(a) * r0)); }
		for (i = 1; i <= 4; i++) { var t = i / 5; pts.push(new THREE.Vector2(r0 + (r1 - r0) * t + Math.sin(t * Math.PI) * 0.08 * r0, -len / 2 + len * t)); }
		for (i = 0; i <= n; i++) { var b = i / n * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0.0005, Math.cos(b) * r1), len / 2 + Math.sin(b) * r1)); }
		return new THREE.LatheGeometry(pts, 8);
	});
}
var SKIN = ['#E8C3A6', '#D9A88A', '#C58E6B', '#9B6A4C', '#6E4A35'], HAIR = ['#2A1E16', '#5B3B24', '#A9763F', '#D8B36A', '#3A3A3A', '#8E8E8E'];
var TOPS = ['#2F4A5A', '#B4553F', '#EDE6DA', '#6F7D63', '#3B3331', '#C49A5A', '#7E8FA6', '#E3D3C4'], BOTTOMS = ['#2B3442', '#3A3836', '#C9B9A0', '#5C6B7A', '#1E1F21'];
// The trunk (1.24.0): chest, waist and hips as one lathe, flattened front to back; a dress flares out of it
// with soft folds.
function trunkGeo(s, kind, hipY, shY) {
	var key = 'trunk' + kind + Math.round(s * 100) + 'h' + Math.round(hipY * 100) + 's' + Math.round(shY * 100);
	return geoC(key, function () {
		var h = shY - hipY, w = kind === 'woman' ? [0.15, 0.135, 0.115, 0.14, 0.145, 0.12, 0.06] : (kind === 'child' ? [0.13, 0.13, 0.125, 0.13, 0.135, 0.12, 0.06] : [0.15, 0.145, 0.14, 0.16, 0.17, 0.15, 0.06]);
		var ys = [-0.06, 0.08, 0.32, 0.6, 0.82, 0.97, 1.04];
		var pts = [new THREE.Vector2(0.001, -0.08 * h)].concat(ys.map(function (y, i) { return new THREE.Vector2(w[i] * s, y * h); })).concat([new THREE.Vector2(0.001, 1.05 * h)]);
		var geo = new THREE.LatheGeometry(pts, 16);
		geo.scale(1, 1, 0.62);
		return geo;
	});
}
function skirtGeo(s, top, bottom, flare) {
	var key = 'skirt' + [s, top, bottom, flare].map(function (v) { return Math.round(v * 1000); }).join('x');
	return geoC(key, function () {
		var pts = [], n = 8;
		for (var i = 0; i <= n; i++) { var t = i / n; pts.push(new THREE.Vector2((0.135 + flare * Math.pow(1 - t, 1.3)) * s, bottom + (top - bottom) * t)); }
		var geo = new THREE.LatheGeometry(pts, 27), pos = geo.attributes.position;
		for (var k = 0; k < pos.count; k++) {
			var x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k), a = Math.atan2(z, x), down = 1 - (y - bottom) / (top - bottom), f = 1 + 0.07 * Math.sin(a * 9) * down;
			pos.setX(k, x * f); pos.setZ(k, z * f * 0.78);
		}
		geo.computeVertexNormals();
		return geo;
	});
}
// A hand: palm, four fingers in a soft curl, the thumb.
function hand(g, at2, dir, s, skin) {
	var h = new THREE.Group(), sc = s;
	RB(h, -0.04 * sc, -0.085 * sc, -0.016 * sc, 0.04 * sc, 0, 0.016 * sc, 0.014 * sc, skin, 2);
	for (var f = 0; f < 4; f++) { var fx = (-0.03 + f * 0.02) * sc, fl = (f === 0 || f === 3 ? 0.055 : 0.068) * sc, fm = M(L.boxGeo(0.016 * sc, fl, 0.016 * sc), skin); fm.position.set(fx, -0.085 * sc - fl / 2, 0.004 * sc); fm.rotation.x = 0.18; h.add(fm); }
	limb(h, [0.04 * sc, -0.03 * sc, 0.008 * sc], [0.06 * sc, -0.075 * sc, 0.025 * sc], 0.01 * sc, skin);
	h.position.set(at2[0], at2[1], at2[2]);
	var d = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
	h.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), d);
	g.add(h);
	return h;
}
// A shoe: a sole, the upper rounded at the toe.
function shoe(g, x, y, z, s, mat, sole) {
	RB(g, x - 0.048 * s, y, z - 0.07 * s, x + 0.048 * s, y + 0.025, z + 0.185 * s, 0.012, sole, 2);
	RB(g, x - 0.045 * s, y + 0.015, z - 0.065 * s, x + 0.045 * s, y + 0.085 * s, z + 0.13 * s, 0.035 * s, mat, 2);
	var toe = M(gc('Sphere', [0.046 * s, 12, 8]), mat); toe.scale.set(1, 0.75, 1.1); toe.position.set(x, y + 0.04 * s, z + 0.13 * s); g.add(toe);
}
// A person to scale (1.24.0): kind man / woman / child, pose stand / walk / sit (sitting: seat at y = 0.45).
// Face (eyes, brows, nose, ears, mouth), a haircut, clothes with collar, sleeves, belt and folds, hands and shoes.
export function person(m, kind, pose, seed) { return model('ppl|' + kind + '|' + pose + '|' + (seed || 3), function () { return personBuild(m, kind, pose, seed); }); }
function personBuild(m, kind, pose, seed) {
	var g = G(), r = rnd(seed || 3), s = kind === 'child' ? 0.68 : (kind === 'woman' ? 0.94 : 1), H = 1.78 * s;
	var skinC = SKIN[Math.floor(r() * SKIN.length)], skin = L.cached('skin' + skinC, function () { return L.stdMat({ color: skinC, roughness: 0.55, metalness: 0, sheen: 0.3, sheenColor: '#FFD9C4' }); });
	var hairC = HAIR[Math.floor(r() * HAIR.length)], hair = L.cached('hair' + hairC, function () { return L.stdMat({ color: hairC, roughness: 0.45, metalness: 0, sheen: 1, sheenColor: L.shadeHex(hairC, 0.3), sheenRoughness: 0.4 }); });
	var topC = TOPS[Math.floor(r() * TOPS.length)], top = fabric(topC, 'linen'), bottom = fabric(BOTTOMS[Math.floor(r() * BOTTOMS.length)], r() < 0.5 ? 'linen' : 'boucle');
	var shoeM = L.solid(['#2A2622', '#5B3B24', '#EDEDEA', '#1E1F21'][Math.floor(r() * 4)], 0.45, 0.05), sole = L.solid('#E8E4DC', 0.7), dark = L.solid('#1A1412', 0.3), white = L.solid('#F4F2EE', 0.3);
	var legL = 0.47 * H, hipY = pose === 'sit' ? 0.47 : legL, hx = 0.088 * s, lr = 0.068 * s, ar = 0.042 * s;
	var dress = kind === 'woman' && r() < 0.5, shortSleeve = r() < 0.45, shorts = !dress && kind !== 'woman' && r() < 0.25;
	// legs: thigh and calf taper, trousers to the ankle (shorts: skin below the knee), shoes
	[-1, 1].forEach(function (sd) {
		var hip = [sd * hx, hipY, 0], knee, foot;
		if (pose === 'sit') { knee = [sd * hx * 1.2, 0.47, 0.42 * s]; foot = [sd * hx * 1.2, 0.09, 0.46 * s]; }
		else if (pose === 'walk') { var a = sd * 0.32; knee = [sd * hx, hipY - legL * 0.5 * Math.cos(a), legL * 0.5 * Math.sin(a)]; foot = [sd * hx, 0.09, knee[2] + (sd > 0 ? 0.05 : -0.12) * s]; }
		else { knee = [sd * hx, hipY - legL * 0.5, 0.012]; foot = [sd * hx * 1.05, 0.09, 0]; }
		limb(g, hip, knee, lr, dress && pose !== 'sit' ? skin : bottom, lr * 0.78);
		limb(g, knee, foot, lr * 0.74, dress || shorts ? skin : bottom, lr * 0.5);
		if (!dress && !shorts) { var cuff = M(gc('Torus', [lr * 0.6, lr * 0.12, 4, 10]), bottom); cuff.rotation.x = Math.PI / 2; cuff.position.set(foot[0], foot[1] + 0.04, foot[2]); g.add(cuff); }
		shoe(g, foot[0], 0, foot[2], s, shoeM, sole);
	});
	// trunk, the dress or the belt, collar
	var shY = hipY + 0.31 * H;
	add(g, at(M(trunkGeo(s, kind, hipY, shY), dress ? top : top), 0, hipY, 0));
	if (dress) { add(g, at(M(skirtGeo(s, hipY + 0.06, pose === 'sit' ? hipY - 0.05 : legL * 0.42, pose === 'sit' ? 0.06 : 0.14), top), 0, 0, 0)); }
	else {
		var hips = M(gc('Sphere', [0.155 * s, 12, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55]), bottom); hips.scale.set(1.04, 0.9, 0.66); hips.position.set(0, hipY + 0.06, 0); g.add(hips);
		var belt = M(gc('Torus', [0.148 * s, 0.014 * s, 6, 28]), L.solid('#2E2620', 0.5)); belt.rotation.x = Math.PI / 2; belt.scale.set(1.02, 0.64, 1); belt.position.set(0, hipY + 0.07, 0); g.add(belt);
		BX(g, -0.025 * s, hipY + 0.055, 0.092 * s, 0.025 * s, hipY + 0.085, 0.1 * s, L.solid('#B9B2A2', 0.3, 0.9));
	}
	// shirt folds: soft horizontal creases at the waist, a placket down the front
	[0.18, 0.3].forEach(function (f) { var cr = M(gc('Torus', [0.143 * s, 0.006 * s, 3, 16]), L.solid(L.shadeHex(topC, -0.12), 0.9)); cr.rotation.x = Math.PI / 2; cr.scale.set(1, 0.62, 1); cr.position.set(0, hipY + (shY - hipY) * f, 0); g.add(cr); });
	if (kind === 'man') { BX(g, -0.008 * s, hipY + 0.1, 0.087 * s, 0.008 * s, shY - 0.05, 0.093 * s, L.solid(L.shadeHex(topC, -0.15), 0.9)); }
	var col = M(gc('Torus', [0.06 * s, 0.016 * s, 4, 14]), top); col.rotation.x = Math.PI / 2 - 0.25; col.position.set(0, shY + 0.02, 0.005); g.add(col);
	// shoulders
	[-1, 1].forEach(function (sd) { SP(g, sd * 0.165 * s, shY - 0.04, 0, 0.06 * s, top, 14, 10); });
	// neck and head
	limb(g, [0, shY, 0], [0, shY + 0.08 * s, 0.005], 0.042 * s, skin);
	var hy = shY + 0.08 * s + 0.11 * s, hd = M(gc('Sphere', [0.1 * s, 12, 8]), skin); hd.scale.set(0.88, 1.12, 1); hd.position.set(0, hy, 0.005); g.add(hd);
	var jaw = M(gc('Sphere', [0.075 * s, 16, 10]), skin); jaw.scale.set(1, 0.8, 1.05); jaw.position.set(0, hy - 0.055 * s, 0.022 * s); g.add(jaw);
	// face: eyes (white and iris), brows, nose, mouth, ears
	[-1, 1].forEach(function (sd) {
		var ex = sd * 0.033 * s, ey = hy + 0.012 * s, ez = 0.083 * s;
		var eb = M(gc('Sphere', [0.013 * s, 8, 6]), white); eb.scale.set(1.2, 0.75, 0.5); eb.position.set(ex, ey, ez); g.add(eb);
		SP(g, ex, ey, ez + 0.005 * s, 0.0068 * s, dark, 8, 6);
		var br = M(L.boxGeo(0.03 * s, 0.006 * s, 0.008 * s), hair); br.position.set(ex, ey + 0.022 * s, ez + 0.002 * s); br.rotation.z = -sd * 0.12; g.add(br);
		var ear = M(gc('Sphere', [0.02 * s, 8, 6]), skin); ear.scale.set(0.45, 1.25, 0.9); ear.position.set(sd * 0.087 * s, hy + 0.0, -0.005 * s); g.add(ear);
	});
	var nose = M(gc('Cone', [0.013 * s, 0.038 * s, 10]), skin); nose.position.set(0, hy - 0.012 * s, 0.098 * s); nose.rotation.x = Math.PI * 0.62; g.add(nose);
	var lips = M(gc('Capsule', [0.006 * s, 0.022 * s, 3, 8]), L.solid(L.shadeHex(skinC, -0.22), 0.5)); lips.rotation.z = Math.PI / 2; lips.position.set(0, hy - 0.045 * s, 0.088 * s); g.add(lips);
	// hair: short crop with a side part, a bob, or long hair with a ponytail
	var style = kind === 'man' ? (r() < 0.8 ? 'short' : 'bald') : (kind === 'woman' ? (r() < 0.5 ? 'long' : 'bob') : (r() < 0.5 ? 'short' : 'bob'));
	if (style !== 'bald') {
		var cap = M(new THREE.SphereGeometry(0.106 * s, 16, 10, 0, Math.PI * 2, 0, Math.PI * (style === 'short' ? 0.47 : 0.58)), hair); cap.scale.set(0.92, 1.12, 1.05); cap.position.set(0, hy + 0.006 * s, -0.004 * s); cap.rotation.x = -0.22; g.add(cap);
		var fr = M(gc('Sphere', [0.06 * s, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]), hair); fr.scale.set(1.5, 0.45, 0.9); fr.position.set(0.012 * s, hy + 0.075 * s, 0.045 * s); fr.rotation.z = -0.12; g.add(fr);
		if (style === 'bob' || style === 'long') { var back = M(new THREE.CylinderGeometry(0.1 * s, style === 'long' ? 0.085 * s : 0.105 * s, (style === 'long' ? 0.26 : 0.12) * s, 20, 1, true, Math.PI * 0.62, Math.PI * 1.76), hair); back.material = hair; back.position.set(0, hy - (style === 'long' ? 0.08 : 0.025) * s, -0.012 * s); back.scale.set(1, 1, 0.95); g.add(back); }
		if (style === 'long' && r() < 0.5) { TU(g, [[0, hy + 0.02 * s, -0.1 * s], [0, hy - 0.05 * s, -0.13 * s], [0, hy - 0.18 * s, -0.12 * s]], 0.026 * s, hair, 12); }
	}
	// arms: sleeve to the elbow (short) or the wrist, the hand
	[-1, 1].forEach(function (sd) {
		var sh = [sd * 0.18 * s, shY - 0.045, 0], el, wr;
		if (pose === 'sit') { el = [sd * 0.22 * s, shY - 0.27 * s, 0.1 * s]; wr = [sd * 0.18 * s, 0.56, 0.3 * s]; }
		else if (pose === 'walk') { var a2 = -sd * 0.35; el = [sd * 0.205 * s, shY - 0.27 * s * Math.cos(a2), 0.27 * s * Math.sin(a2)]; wr = [sd * 0.21 * s, el[1] - 0.24 * s, el[2] + 0.07 * s * Math.sign(a2)]; }
		else { el = [sd * 0.215 * s, shY - 0.28 * s, -0.01]; wr = [sd * 0.22 * s, shY - 0.52 * s, 0.03]; }
		limb(g, sh, el, ar * 1.12, top, ar * 0.95);
		if (shortSleeve) { var cuff = new THREE.Vector3().fromArray(sh).lerp(new THREE.Vector3().fromArray(el), 0.55); limb(g, [cuff.x, cuff.y, cuff.z], el, ar * 0.82, skin); }
		limb(g, el, wr, shortSleeve ? ar * 0.8 : ar * 0.98, shortSleeve ? skin : top, shortSleeve ? ar * 0.62 : ar * 0.82);
		if (!shortSleeve) { var wd = new THREE.Vector3(wr[0] - el[0], wr[1] - el[1], wr[2] - el[2]).normalize(); var wc = M(gc('Torus', [ar * 0.72, ar * 0.12, 4, 10]), top); wc.position.set(wr[0], wr[1], wr[2]); wc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), wd); g.add(wc); }
		hand(g, wr, [wr[0] - el[0], wr[1] - el[1], wr[2] - el[2]], s, skin);
	});
	return g;
}
// A dog (1.24.0): deep chest and tucked belly, a snout with a nose, eyes, ears (pricked or floppy), paws,
// a tail, a collar.
export function dog(m, size, seed, pose) { return model('dog|' + size + '|' + (seed || 5) + '|' + (pose || ''), function () { return dogBuild(m, size, seed, pose); }); }
function dogBuild(m, size, seed, pose) {
	var g = G(), r = rnd(seed || 5), s = size === 'small' ? 0.55 : 1, col = ['#C9974F', '#3A2F28', '#E8DCC8', '#8A5A33'][Math.floor(r() * 4)];
	var fur = L.cached('fur' + col, function () { return L.stdMat({ color: col, roughness: 0.9, metalness: 0, sheen: 1, sheenColor: L.shadeHex(col, 0.25), sheenRoughness: 0.6 }); }), dark = L.solid('#141110', 0.25, 0.1), belly = L.solid(L.shadeHex(col, 0.18), 0.9);
	var lie = pose === 'lie', by = lie ? 0.19 * s : 0.5 * s, floppy = r() < 0.6;
	// body: chest (front) bigger than the loin
	var chest = M(gc('Sphere', [0.17 * s, 12, 8]), fur); chest.scale.set(1.15, 1.05, 0.85); chest.position.set(0.14 * s, by + 0.01 * s, 0); g.add(chest);
	var loin = M(gc('Sphere', [0.14 * s, 12, 8]), fur); loin.scale.set(1.35, 0.9, 0.85); loin.position.set(-0.16 * s, by + 0.02 * s, 0); g.add(loin);
	limb(g, [-0.12 * s, by + 0.01 * s, 0], [0.1 * s, by, 0], 0.13 * s, fur);
	var bl = M(gc('Sphere', [0.1 * s, 14, 8]), belly); bl.scale.set(2, 0.5, 0.9); bl.position.set(0.04 * s, by - 0.1 * s, 0); g.add(bl);
	// legs with paws
	[[0.2, -1, 1], [0.2, 1, 1], [-0.24, -1, 0], [-0.24, 1, 0]].forEach(function (q) {
		var x = q[0] * s, z = q[1] * 0.085 * s, front = q[2];
		if (lie) { limb(g, [x + 0.05 * s, 0.08 * s, z * 1.3], [x + (front ? 0.3 : 0.18) * s, 0.05 * s, z * 1.3], 0.045 * s, fur); SP(g, x + (front ? 0.33 : 0.21) * s, 0.04 * s, z * 1.3, 0.04 * s, fur, 10, 8); return; }
		var knee = [x + (front ? 0.0 : -0.06) * s, by - 0.22 * s, z];
		limb(g, [x, by - 0.05 * s, z], knee, 0.055 * s, fur, 0.04 * s); limb(g, knee, [x + (front ? 0.01 : 0.02) * s, 0.05 * s, z], 0.038 * s, fur, 0.032 * s);
		var paw = M(gc('Sphere', [0.042 * s, 12, 8]), fur); paw.scale.set(1.4, 0.7, 1.1); paw.position.set(x + (front ? 0.03 : 0.04) * s, 0.03 * s, z); g.add(paw);
	});
	// neck, head, snout, nose, eyes, ears, collar
	var neck = [0.3 * s, by + 0.14 * s, 0], head = [0.42 * s, by + 0.29 * s, 0];
	limb(g, [0.18 * s, by + 0.04 * s, 0], neck, 0.095 * s, fur, 0.08 * s);
	var hd = M(gc('Sphere', [0.11 * s, 12, 8]), fur); hd.scale.set(1.1, 0.95, 0.92); hd.position.set(head[0], head[1], 0); g.add(hd);
	var sn = M(gc('Cylinder', [0.045 * s, 0.07 * s, 0.15 * s, 16]), fur); sn.rotation.z = Math.PI / 2; sn.position.set(head[0] + 0.13 * s, head[1] - 0.035 * s, 0); g.add(sn);
	var ns = M(gc('Sphere', [0.026 * s, 12, 8]), dark); ns.scale.set(0.8, 0.8, 1.2); ns.position.set(head[0] + 0.205 * s, head[1] - 0.02 * s, 0); g.add(ns);
	BX(g, head[0] + 0.1 * s, head[1] - 0.075 * s, -0.035 * s, head[0] + 0.19 * s, head[1] - 0.068 * s, 0.035 * s, dark);
	var collar = M(gc('Torus', [0.085 * s, 0.014 * s, 6, 20]), L.solid(['#B4322A', '#2F5A8A', '#3E7A44'][Math.floor(r() * 3)], 0.5)); collar.position.set(0.27 * s, by + 0.12 * s, 0); collar.rotation.y = Math.PI / 2; collar.rotation.x = 0.55; g.add(collar);
	[-1, 1].forEach(function (sd) {
		SP(g, head[0] + 0.075 * s, head[1] + 0.03 * s, sd * 0.055 * s, 0.017 * s, dark, 10, 8);
		var ear = M(gc('Sphere', [0.06 * s, 12, 8]), L.solid(L.shadeHex(col, -0.18), 0.9));
		if (floppy) { ear.scale.set(0.55, 1.25, 0.18); ear.position.set(head[0] - 0.02 * s, head[1] - 0.02 * s, sd * 0.1 * s); ear.rotation.x = sd * 0.15; }
		else { ear.scale.set(0.5, 1.15, 0.2); ear.position.set(head[0] - 0.03 * s, head[1] + 0.1 * s, sd * 0.06 * s); ear.rotation.x = -sd * 0.3; }
		g.add(ear);
	});
	// tail: up and curved, thinning to the tip
	var tp = [[-0.3 * s, by + 0.06 * s, 0], [-0.4 * s, by + 0.16 * s, 0], [-0.46 * s, by + 0.28 * s, 0.02 * s], [-0.44 * s, by + 0.36 * s, 0.04 * s]];
	for (var i = 0; i < 3; i++) { limb(g, tp[i], tp[i + 1], (0.032 - i * 0.008) * s, fur, (0.026 - i * 0.008) * s); }
	return g;
}
// A cat (1.24.0): slim body, round head with pointed ears (pink inside), green eyes, whiskers, a long tail.
export function cat(m, seed, pose) { return model('cat|' + (seed || 7) + '|' + (pose || ''), function () { return catBuild(m, seed, pose); }); }
function catBuild(m, seed, pose) {
	var g = G(), r = rnd(seed || 7), col = ['#C97A3A', '#6E6E70', '#2A2624', '#E9E2D6'][Math.floor(r() * 4)];
	var fur = L.cached('fur' + col, function () { return L.stdMat({ color: col, roughness: 0.9, metalness: 0, sheen: 1, sheenColor: L.shadeHex(col, 0.25), sheenRoughness: 0.6 }); }), dark = L.solid('#141110', 0.25), pink = L.solid('#D99A9A', 0.6), eye = L.solid('#8DBF45', 0.15, 0.2), whisk = L.solid('#F2F0EA', 0.4);
	function face(hx, hy, hz, k, turn) {
		var h = new THREE.Group(); h.position.set(hx, hy, hz); h.rotation.y = turn || 0;
		var hd = M(gc('Sphere', [0.075 * k, 10, 8]), fur); hd.scale.set(1, 0.9, 1.05); h.add(hd);
		var mz = M(gc('Sphere', [0.035 * k, 12, 8]), fur); mz.scale.set(0.9, 0.7, 1); mz.position.set(0.06 * k, -0.02 * k, 0); h.add(mz);
		SP(h, 0.093 * k, -0.008 * k, 0, 0.009 * k, pink, 8, 6);
		[-1, 1].forEach(function (sd) {
			var e = M(gc('Cone', [0.032 * k, 0.065 * k, 4]), fur); e.position.set(-0.005 * k, 0.07 * k, sd * 0.042 * k); e.rotation.x = sd * -0.3; e.rotation.y = Math.PI / 4; h.add(e);
			var ei = M(gc('Cone', [0.018 * k, 0.04 * k, 4]), pink); ei.position.set(0.006 * k, 0.065 * k, sd * 0.042 * k); ei.rotation.x = sd * -0.3; ei.rotation.y = Math.PI / 4; h.add(ei);
			var ey = M(gc('Sphere', [0.013 * k, 8, 6]), eye); ey.scale.set(0.6, 1, 1); ey.position.set(0.066 * k, 0.015 * k, sd * 0.03 * k); h.add(ey);
			var pu = M(L.boxGeo(0.004 * k, 0.018 * k, 0.004 * k), dark); pu.position.set(0.074 * k, 0.015 * k, sd * 0.03 * k); h.add(pu);
			for (var w = 0; w < 3; w++) { ROD(h, [0.08 * k, -0.022 * k, sd * 0.02 * k], [0.09 * k, (-0.012 - w * 0.012) * k, sd * 0.1 * k], 0.0012, whisk, 3); }
		});
		g.add(h);
	}
	if (pose === 'lie') {
		var b = M(gc('Sphere', [0.15, 12, 8]), fur); b.scale.set(1.6, 0.7, 1); b.position.set(0, 0.1, 0); g.add(b);
		face(0.21, 0.15, 0.03, 1, -0.3);
		[-1, 1].forEach(function (sd) { limb(g, [0.12, 0.04, sd * 0.06], [0.25, 0.03, sd * 0.06], 0.022, fur); });
		TU(g, [[-0.22, 0.06, 0], [-0.26, 0.04, 0.15], [-0.1, 0.03, 0.21], [0.05, 0.03, 0.19]], 0.022, fur, 14);
		return g;
	}
	// sitting: haunches, chest, front legs, the tail round the paws
	var body = M(gc('Sphere', [0.12, 12, 8]), fur); body.scale.set(1, 1.3, 0.95); body.position.set(-0.02, 0.15, 0); g.add(body);
	[-1, 1].forEach(function (sd) { var hn = M(gc('Sphere', [0.07, 12, 8]), fur); hn.scale.set(1.3, 1, 0.8); hn.position.set(-0.04, 0.07, sd * 0.07); g.add(hn); limb(g, [0.06, 0.2, sd * 0.04], [0.08, 0.025, sd * 0.045], 0.022, fur); SP(g, 0.095, 0.018, sd * 0.045, 0.024, fur, 10, 8); });
	face(0.04, 0.35, 0, 1, 0);
	TU(g, [[-0.12, 0.04, 0], [-0.14, 0.02, 0.12], [-0.02, 0.02, 0.19], [0.1, 0.02, 0.15]], 0.02, fur, 16);
	return g;
}
// the builders themselves, part by part (for the tests: what a model is made of)
export var _parts = { vehicle: function (m, t, c) { return vehicleBuild(m, t, c); }, person: function (m, k, p, s) { return personBuild(m, k, p, s); }, dog: function (m, z, s, p) { return dogBuild(m, z, s, p); }, cat: function (m, s, p) { return catBuild(m, s, p); } };
export function kennel(m) { var g = G(), w = veneer('#9C7452', 'quarter'); RB(g, -0.45, 0, -0.4, 0.45, 0.6, 0.4, 0.01, w, 1); var rf = new THREE.Shape(); rf.moveTo(-0.52, 0.6); rf.lineTo(0, 0.95); rf.lineTo(0.52, 0.6); rf.lineTo(-0.52, 0.6); var rg = new THREE.ExtrudeGeometry(rf, { depth: 0.9, bevelEnabled: false }); rg.translate(0, 0, -0.45); add(g, M(rg, L.solid('#5A3A2A', 0.8))); var hole = new THREE.Shape(); hole.moveTo(-0.16, 0); hole.lineTo(0.16, 0); hole.lineTo(0.16, 0.3); hole.absarc(0, 0.3, 0.16, 0, Math.PI, false); hole.lineTo(-0.16, 0); var hm = M(new THREE.ShapeGeometry(hole), L.solid('#1A1614', 0.9), false); hm.position.set(0, 0, 0.402); g.add(hm); return g; }
export function petBed(m) { var g = G(); LA(g, [[0, 0], [0.4, 0], [0.45, 0.06], [0.44, 0.16], [0.38, 0.18], [0.33, 0.1], [0, 0.08]], fabric(L.shadeHex(m.pal[2], 0.1), 'boucle'), 0, 0, 0, 32, 1.2, 1); return g; }

/* ================================================================== electronics */
export function electronic(m, kind, H) {
	var g = G(), blk = L.solid('#141516', 0.4, 0.2), grey = L.solid('#2A2C2E', 0.5, 0.3), wht = L.solid('#ECEDEE', 0.35);
	switch (kind) {
		case 'soundbar': RB(g, -0.5, 0, -0.05, 0.5, 0.07, 0.05, 0.02, blk, 2); break;
		case 'speakers': RB(g, -0.11, 0, -0.14, 0.11, 1.05, 0.14, 0.02, m.st === 'scandinavian' || m.st === 'japandi' ? m.walnut : blk, 2); [0.85, 0.62, 0.35].forEach(function (y, k) { var cc = M(new THREE.CylinderGeometry(k ? 0.075 : 0.035, k ? 0.075 : 0.035, 0.01, 24), grey); cc.rotation.x = Math.PI / 2; cc.position.set(0, y, 0.142); g.add(cc); }); break;
		case 'console': RB(g, -0.14, 0, -0.1, 0.14, 0.05, 0.1, 0.01, wht, 1); RB(g, -0.08, 0.05, -0.05, 0.02, 0.07, 0.03, 0.015, blk, 2); break;
		case 'projector': RB(g, -0.16, -0.1, -0.13, 0.16, 0, 0.13, 0.02, wht, 2); var ln = M(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 20), blk); ln.rotation.x = Math.PI / 2; ln.position.set(0.06, -0.05, 0.14); g.add(ln); ROD(g, [0, 0, 0], [0, 0.35, 0], 0.012, wht); break;
		case 'screen': case 'screen_up': var sy = Math.min(2.45, (H || 2.7) - 0.12), cas = M(new THREE.CylinderGeometry(0.045, 0.045, 2.1, 14), wht); cas.rotation.z = Math.PI / 2; cas.position.set(0, sy, 0.06); g.add(cas); if (kind === 'screen') { BX(g, -0.98, Math.max(0.75, sy - 1.25), 0.05, 0.98, sy - 0.03, 0.055, L.solid('#F4F4F2', 0.8)); BX(g, -0.98, Math.max(0.75, sy - 1.25) - 0.03, 0.045, 0.98, Math.max(0.75, sy - 1.25), 0.06, blk); } break;
		case 'computer': RB(g, -0.3, 0.12, -0.02, 0.3, 0.47, 0.01, 0.006, blk, 1); BX(g, -0.29, 0.13, 0.01, 0.29, 0.46, 0.012, m.screen); ROD(g, [0, 0, -0.04], [0, 0.15, -0.04], 0.015, grey); RB(g, -0.12, 0, -0.1, 0.12, 0.01, 0.02, 0.004, grey, 1); RB(g, -0.22, 0, 0.12, 0.22, 0.015, 0.25, 0.004, blk, 1); RB(g, 0.42, -0.74, -0.2, 0.62, -0.3, 0.25, 0.01, blk, 1); break;
		case 'laptop': RB(g, -0.17, 0, -0.12, 0.17, 0.015, 0.12, 0.006, L.solid('#B9BCBF', 0.3, 0.8), 1); var lid = G(); lid.position.set(0, 0.015, -0.12); lid.rotation.x = -0.25; RB(lid, -0.17, 0, -0.008, 0.17, 0.23, 0.0, 0.006, L.solid('#B9BCBF', 0.3, 0.8), 1); BX(lid, -0.155, 0.015, 0.0, 0.155, 0.215, 0.002, m.screen); g.add(lid); break;
		case 'smart_speaker': CY(g, 0, 0, 0, 0.06, 0.065, 0.16, fabric('#5E6266', 'wool'), 24); CY(g, 0, 0.16, 0, 0.058, 0.058, 0.01, blk, 24); break;
		case 'robot_vacuum': CY(g, 0, 0, 0, 0.17, 0.17, 0.09, blk, 32); CY(g, 0, 0.09, 0, 0.05, 0.05, 0.01, grey, 20); break;
		case 'smart_panel': RB(g, -0.12, 1.35, 0, 0.12, 1.53, 0.015, 0.008, blk, 1); BX(g, -0.11, 1.36, 0.015, 0.11, 1.52, 0.017, m.night ? emissive('#7FB6FF', 1.2) : m.screen); break;
		case 'router': RB(g, -0.12, 0, -0.08, 0.12, 0.04, 0.08, 0.01, wht, 1); [-0.08, 0.08].forEach(function (x) { ROD(g, [x, 0.04, -0.07], [x, 0.2, -0.08], 0.006, wht); }); break;
		default: break;
	}
	return g;
}

/* ================================================================== more furniture */
// An open cabinet body (back, sides, top and plinth) centred on x, its back on the wall at z = 0.
function carcass(g, w, h, d, mat) { BX(g, -w / 2, 0, 0, w / 2, h, 0.015, mat); BX(g, -w / 2, 0, 0, -w / 2 + 0.025, h, d, mat); BX(g, w / 2 - 0.025, 0, 0, w / 2, h, d, mat); BX(g, -w / 2, h - 0.03, 0, w / 2, h, d, mat); BX(g, -w / 2, 0, 0, w / 2, 0.08, d, mat); }
// A radiator: panel, column or towel rail, floating 0.12 m above the floor with its pipes.
export function radiator(m, type, w, h) {
	var g = G(), st = L.solid('#F2F1EE', 0.35, 0.25), mt = m.metal || L.solid('#B9BDC1', 0.3, 0.8);
	w = L.clamp(w || 1.0, 0.4, 1.8); h = h || 0.6;
	if (type === 'towel') {
		[-w / 2 + 0.05, w / 2 - 0.05].forEach(function (x) { ROD(g, [x, 0.9, 0.04], [x, 0.9 + h + 0.5, 0.04], 0.018, mt, 10); });
		for (var y = 0.98; y < 0.9 + h + 0.5; y += 0.13) { ROD(g, [-w / 2 + 0.05, y, 0.04], [w / 2 - 0.05, y, 0.04], 0.013, mt, 8); }
		RB(g, -w / 2 + 0.18, 1.3, 0.05, w / 2 - 0.18, 1.34, 0.17, 0.01, L.solid('#FFFFFF', 0.85), 2);   // a towel over it
		return g;
	}
	if (type === 'column') {
		for (var cx = -w / 2 + 0.04; cx <= w / 2 - 0.03; cx += 0.075) { CY(g, cx, 0.12, 0.05, 0.028, 0.028, h, st, 12); }
		BX(g, -w / 2, 0.12, 0.02, w / 2, 0.16, 0.08, st); BX(g, -w / 2, 0.12 + h - 0.04, 0.02, w / 2, 0.12 + h, 0.08, st);
	} else if (type === 'convector') {
		BX(g, -w / 2, 0.1, 0, w / 2, 0.1 + h * 0.55, 0.11, st);
		for (var gx = -w / 2 + 0.05; gx < w / 2 - 0.03; gx += 0.05) { BX(g, gx, 0.1 + h * 0.55, 0.01, gx + 0.03, 0.1 + h * 0.55 + 0.012, 0.1, L.solid('#D8D7D3', 0.5)); }
	} else {
		// panel radiator: a double panel with the fins hinted between them
		BX(g, -w / 2, 0.12, 0, w / 2, 0.12 + h, 0.035, st);
		BX(g, -w / 2, 0.12, 0.055, w / 2, 0.12 + h, 0.09, st);
		for (var fx = -w / 2 + 0.06; fx < w / 2 - 0.04; fx += 0.055) { BX(g, fx, 0.14, 0.036, fx + 0.02, 0.1 + h, 0.054, L.solid('#DAD9D5', 0.6)); }
		BX(g, -w / 2, 0.12 + h, 0.0, w / 2, 0.14 + h, 0.09, L.solid('#E8E7E3', 0.5));
	}
	[-w / 2 + 0.07, w / 2 - 0.07].forEach(function (x) { ROD(g, [x, 0, 0.05], [x, 0.14, 0.05], 0.012, mt, 8); });
	return g;
}
// A planted aquarium on its cabinet: rectangular, panorama, round, cylinder, corner or built in.
export function aquarium(m, shape, water, w) {
	var g = G(), wat = water === 'marine', gl = glass('#DCEAEF', 0.14);
	var tank = L.pbr ? L.solid(wat ? '#0E3A52' : '#16463A', 0.5, 0.1) : L.solid('#16463A', 0.5);
	var sand = L.solid(wat ? '#EFE7D6' : '#C8B58E', 0.95), rock = L.solid('#6E6A62', 0.9);
	var lit = emissive(wat ? '#9FD8FF' : '#CFE9A8', 1.6);
	w = w || 1.3;
	var hgt = shape === 'small' ? 0.4 : (shape === 'large' || shape === 'panorama' ? 0.65 : 0.5), base = shape === 'small' ? 0.78 : 0.62;
	var d = shape === 'panorama' ? 0.45 : (shape === 'small' ? 0.3 : 0.5);
	// cabinet
	if (shape !== 'builtin') { BX(g, -w / 2, 0, 0, w / 2, base, d, m.wood); BX(g, -w / 2 - 0.02, base - 0.03, -0.02, w / 2 + 0.02, base, d + 0.02, m.dark); }
	if (shape === 'round' || shape === 'cylinder') {
		var r = Math.min(0.32, w / 2);
		CY(g, 0, base, d / 2, r, r, shape === 'round' ? r * 1.6 : hgt + 0.3, gl, 28, true);
		CY(g, 0, base + 0.01, d / 2, r - 0.02, r - 0.02, 0.06, sand, 24);
		CY(g, 0, base + (shape === 'round' ? r * 1.6 : hgt + 0.3), d / 2, r + 0.02, r + 0.02, 0.04, m.dark, 24);
		CY(g, 0, base + 0.07, d / 2, r - 0.05, r - 0.05, (shape === 'round' ? r * 1.4 : hgt + 0.18), glass(wat ? '#8FD2F0' : '#A7D9C4', 0.22), 24);
	} else {
		var x0 = -w / 2 + 0.02, x1 = w / 2 - 0.02, z0 = 0.03, z1 = d - 0.03, y0 = base + 0.02;
		[[x0, z0, x1, z0 + 0.012], [x0, z1 - 0.012, x1, z1], [x0, z0, x0 + 0.012, z1], [x1 - 0.012, z0, x1, z1]].forEach(function (q) { BX(g, q[0], y0, q[1], q[2], y0 + hgt, q[3], gl); });
		BX(g, x0, y0 - 0.02, z0, x1, y0, z1, m.dark);
		BX(g, x0, y0, z0, x1, y0 + 0.05, z1, sand);
		BX(g, x0, y0 + 0.05, z0, x1, y0 + hgt - 0.05, z1, glass(wat ? '#8FD2F0' : '#A7D9C4', 0.2));
		BX(g, x0 - 0.01, y0 + hgt, z0 - 0.01, x1 + 0.01, y0 + hgt + 0.045, z1 + 0.01, m.dark);
		BX(g, x0 + 0.05, y0 + hgt - 0.01, z0 + 0.05, x1 - 0.05, y0 + hgt, z1 - 0.05, lit);
		// rocks or live rock, plants or corals, and a few fish
		for (var i = 0; i < Math.max(3, Math.round(w * 4)); i++) {
			var t = (i + 0.5) / Math.max(3, Math.round(w * 4)), px = x0 + 0.1 + (x1 - x0 - 0.2) * t, pz = z0 + 0.1 + (z1 - z0 - 0.2) * ((i % 3) / 3);
			if (i % 3 === 0) { CY(g, px, y0 + 0.04, pz, 0.05 + 0.02 * (i % 2), 0.08, 0.1 + 0.05 * (i % 3), rock, 10); }
			else if (wat) { CY(g, px, y0 + 0.05, pz, 0.02, 0.05, 0.1 + 0.04 * (i % 4), L.solid(i % 2 ? '#E2715C' : '#6FB6C9', 0.8), 10); }
			else { for (var b2 = 0; b2 < 3; b2++) { CY(g, px + b2 * 0.03 - 0.03, y0 + 0.05, pz, 0.008, 0.012, hgt * (0.45 + 0.12 * b2), tank, 7); } }
			if (i % 2 === 0) { var f = M(new THREE.SphereGeometry(0.035, 10, 8), L.solid(wat ? (i % 4 ? '#F2A03C' : '#E9E55B') : '#C9704A', 0.6)); f.scale.set(1.5, 0.9, 0.5); at(f, px, y0 + hgt * 0.55, pz + 0.06); g.add(f); }
		}
	}
	return g;
}
export function extraPiece(m, kind) {
	var g = G();
	switch (kind) {
		// floating shelves with no visible bracket, optionally with a hidden LED strip under them
		case 'wall_shelf': [1.35, 1.72, 2.05].forEach(function (y, i) {
			var sw = 1.1 - i * 0.12;
			RB(g, -sw / 2, y, 0.02, sw / 2, y + 0.045, 0.26, 0.008, m.wood, 1);
			BX(g, -sw / 2 + 0.06, y - 0.012, 0.04, sw / 2 - 0.06, y, 0.2, emissive('#FFE6C4', 0.7));
			if (i === 0) { bookRow(g, m, -sw / 2 + 0.05, sw / 2 - 0.35, y + 0.045, 0.17, 0.22, 0.24, 7); }
			else if (i === 1) { vase(g, m, -0.18, y + 0.045, 0.14, 0.75); bookStack(g, m, 0.26, y + 0.045, 0.14, 2, 4); }
			else { vase(g, m, 0.12, y + 0.045, 0.13, 0.6); }
		}); break;
		case 'aquarium': return aquarium(m, m.c && m.c.aquarium_shape && m.c.aquarium_shape !== 'auto' ? m.c.aquarium_shape : 'large', m.c && m.c.aquarium_water, m.c && m.c.aquarium_shape === 'small' ? 0.8 : 1.3);
		case 'bookshelf': carcass(g, 1.2, 2.1, 0.34, m.wood); for (var y = 0.35; y < 2.0; y += 0.36) { BX(g, -0.58, y, 0.01, 0.58, y + 0.025, 0.33, m.wood); bookRow(g, m, -0.56, 0.56 - (Math.round(y * 10) % 3) * 0.15, y + 0.025, 0.17, 0.24, 0.3, Math.round(y * 13)); } break;
		case 'sideboard': RB(g, -0.85, 0.14, 0, 0.85, 0.82, 0.45, 0.006, m.wood, 1); var sl4 = G(); sl4.position.z = 0.225; legs4(sl4, 1.6, 0.4, 0.14, 0.03, m.legs, 'taper'); g.add(sl4); for (var k = 0; k < 3; k++) { BX(g, -0.84 + k * 0.565 + 0.004, 0.17, 0.45, -0.84 + (k + 1) * 0.565 - 0.004, 0.79, 0.454, m.woodQ); } vase(g, m, -0.5, 0.82, 0.22, 1.2); bowl(g, m, 0.45, 0.82, 0.22, 0.12); break;
		case 'desk': RB(g, -0.7, 0.72, 0, 0.7, 0.76, 0.65, 0.006, m.wood, 1); [[-0.66, 0.04], [0.66, 0.04], [-0.66, 0.61], [0.66, 0.61]].forEach(function (q) { ROD(g, [q[0], 0, q[1]], [q[0], 0.72, q[1]], 0.015, m.metal); }); tableLamp(g, m, -0.5, 0.76, 0.18); bookStack(g, m, 0.45, 0.76, 0.25, 2, 3); var ch = diningChair(m, 'upholstered'); ch.position.set(0, 0, 0.9); ch.rotation.y = Math.PI; g.add(ch); break;
		case 'reading': var ac = armchair(m, 'wingback'); ac.rotation.y = 0.4; g.add(ac); var fl = floorLamp(m, 'tripod'); fl.position.set(-0.65, 0, -0.2); g.add(fl); var st = sideTable(m, false); st.position.set(0.62, 0, -0.1); g.add(st); bookStack(g, m, 0.62, 0.525, -0.1, 3, 6); break;
		case 'piano': RB(g, -0.75, 0, -0.32, 0.75, 1.25, 0, 0.01, L.solid('#121212', 0.12, 0.2), 2); RB(g, -0.75, 0.68, 0, 0.75, 0.75, 0.25, 0.01, L.solid('#121212', 0.12, 0.2), 2); BX(g, -0.7, 0.75, 0.02, 0.7, 0.77, 0.2, L.solid('#F5F3EE', 0.3)); for (var kx = -0.68; kx < 0.68; kx += 0.055) { if (Math.round(kx * 100 / 5.5) % 7 !== 2 && Math.round(kx * 100 / 5.5) % 7 !== 6) { BX(g, kx + 0.03, 0.77, 0.02, kx + 0.05, 0.79, 0.12, L.solid('#121212', 0.3)); } } [[-0.7, 0.2], [0.7, 0.2]].forEach(function (q) { BX(g, q[0] - 0.03, 0, q[1] - 0.03, q[0] + 0.03, 0.68, q[1] + 0.03, L.solid('#121212', 0.12, 0.2)); }); RB(g, -0.3, 0, 0.45, 0.3, 0.48, 0.8, 0.01, L.solid('#121212', 0.12, 0.2), 1); break;
		case 'bar_cart': [[-0.35, -0.2], [0.35, -0.2], [-0.35, 0.2], [0.35, 0.2]].forEach(function (q) { ROD(g, [q[0], 0.06, q[1]], [q[0], 0.85, q[1]], 0.01, m.brass); }); [0.3, 0.75].forEach(function (y) { add(g, at(M(L.boxGeo(0.72, 0.01, 0.42), glass('#E8EEEE', 0.5), false), 0, y, 0)); }); TU(g, [[0.35, 0.85, -0.2], [0.48, 0.92, 0], [0.35, 0.85, 0.2]], 0.01, m.brass, 12); [-0.25, -0.1, 0.05].forEach(function (x, i) { bottle(g, m, x, 0.755, 0, 1.3, glass(['#4F7A3A', '#7A2E22', '#C9A46B'][i], 0.75)); }); bowl(g, m, 0.2, 0.305, 0, 0.1, m.brass); break;
		case 'bench': RB(g, -0.7, 0.4, -0.18, 0.7, 0.46, 0.18, 0.01, m.oak, 1); [-0.62, 0.62].forEach(function (x) { BX(g, x - 0.03, 0, -0.16, x + 0.03, 0.4, 0.16, m.oak); }); RB(g, -0.6, 0.46, -0.15, 0.1, 0.5, 0.15, 0.03, m.fab, 2); break;
		case 'plant_stand': [[0, 0.0, 0.25], [0.3, 0.25, 0.18], [-0.3, 0.5, 0.2]].forEach(function (q, i) { BX(g, q[0] - 0.16, q[1], -0.14, q[0] + 0.16, q[1] + 0.03, 0.14, m.wood); var p = plant(m, ['snake', 'fiddle', 'monstera'][i], 0.45); p.position.set(q[0], q[1] + 0.03, 0); g.add(p); }); [[-0.48, 0.55], [0.48, 0.3]].forEach(function (q) { ROD(g, [q[0], 0, 0], [q[0], q[1], 0], 0.012, m.black); }); break;
		case 'floor_mirror': var fm = G(); fm.rotation.x = -0.1; RB(fm, -0.32, 0, -0.02, 0.32, 1.7, 0.02, 0.02, m.st === 'luxury' ? m.brass : m.oak, 2); add(fm, at(M(new THREE.PlaneGeometry(0.58, 1.62), mirror(), false), 0, 0.85, 0.022)); fm.position.set(0, 0, 0.12); g.add(fm); break;
		case 'chest': RB(g, -0.55, 0.12, 0, 0.55, 0.95, 0.48, 0.006, m.wood, 1); var cl4 = G(); cl4.position.z = 0.24; legs4(cl4, 1.0, 0.42, 0.12, 0.03, m.legs, 'taper'); g.add(cl4); for (var d = 0; d < 4; d++) { BX(g, -0.53, 0.15 + d * 0.2, 0.48, 0.53, 0.33 + d * 0.2, 0.484, m.woodQ); RB(g, -0.08, 0.235 + d * 0.2, 0.484, 0.08, 0.255 + d * 0.2, 0.5, 0.008, m.metal, 1); } vase(g, m, 0.3, 0.95, 0.24, 0.9); break;
		case 'vitrine': carcass(g, 0.9, 1.9, 0.42, m.wood); add(g, at(M(L.boxGeo(0.8, 1.7, 0.006), glass('#E8EEEE', 0.25), false), 0, 1.0, 0.425)); [0.6, 1.1, 1.5].forEach(function (y) { BX(g, -0.42, y, 0.02, 0.42, y + 0.012, 0.4, glass('#E8EEEE', 0.5)); for (var x = -0.32; x < 0.35; x += 0.16) { LA(g, [[0, 0], [0.03, 0], [0.04, 0.1], [0.035, 0.1], [0.025, 0.005], [0, 0.005]], glass('#F2F6F6', 0.6), x, y + 0.012, 0.2, 16); } }); if (m.night) { BX(g, -0.42, 1.86, 0.05, 0.42, 1.87, 0.37, emissive('#FFE7C4', 1.6)); } break;
		case 'pouf': LA(g, [[0, 0], [0.26, 0], [0.3, 0.06], [0.3, 0.32], [0.26, 0.38], [0, 0.38]], fabric(m.pal[3], 'wool'), 0, 0, 0, 32); break;
		default: break;
	}
	// every piece stands with its back on the wall at z = 0
	var off = { piano: 0.32, bar_cart: 0.24, bench: 0.2, plant_stand: 0.17, reading: 0.62 }[kind];
	if (off) { var w = G(); g.position.z = off; w.add(g); return w; }
	return g;
}
export function threshold(m, type, w) {
	var g = G();
	if (type === 'none') { return g; }
	var mat = type === 'wood' ? m.walnut : (type === 'stone' ? marble(m.st === 'luxury' || m.st === 'classic' ? 'white' : 'travertine') : m.steel);
	RB(g, 0, 0, -0.27, w, type === 'metal' ? 0.01 : 0.022, 0.07, 0.004, mat, 1);
	return g;
}

/* ================================================================== rooms */
// A helyiség saját részletmezője → melyik házbeállítást írja felül a belső nézetben (1.9.0).
// A `floor` külön fut, mert a padlót helyiségtípus szerint választja ki a ház.
export var ROOM_OVERRIDE = { wall: 'wall_finish', ceiling: 'ceiling', lighting: 'ceiling_lights', curtains: 'window_treatment', doors: 'door_style', windows: 'window_style', furniture: 'furniture_style', heating: 'radiators', decor: 'art_amount' };
var ROOM_KIND = { attic: 'attic', living: 'living', living_kitchen: 'living_kitchen', dining: 'dining', kitchen: 'kitchen', master: 'bed', bedroom: 'bed', guest: 'bed', kids: 'kids', office: 'office', wardrobe: 'wardrobe', bathroom: 'bath', wc: 'wc', wellness: 'bath', sauna: 'bath', laundry: 'laundry', utility: 'laundry', pantry: 'laundry', technical: 'laundry', hall: 'hall', corridor: 'hall', stairs: 'stairs', gym: 'office', playroom: 'kids', wine: 'office', custom: 'living' };
export function roomKind(type) { return ROOM_KIND[type] || 'living'; }
// Free stretches of a wall (length len) between blocking pieces [[a, b], ...], at least min long.
function freeSpans(occ, len, min) {
	var s = [[0.25, len - 0.25]];
	occ.forEach(function (o) { var n = []; s.forEach(function (q) { if (o[1] <= q[0] || o[0] >= q[1]) { n.push(q); } else { if (o[0] > q[0]) { n.push([q[0], o[0]]); } if (o[1] < q[1]) { n.push([o[1], q[1]]); } } }); s = n; });
	return s.filter(function (q) { return q[1] - q[0] >= min; });
}
// Windows across the free stretches of a wall.
function windowsIn(spans, winW, maxN) {
	var out = [];
	spans.forEach(function (q) { var len = q[1] - q[0], n = Math.max(1, Math.min(maxN || 2, Math.floor((len - 0.3) / (winW + 0.9)))), ww = Math.min(winW, len - 0.4); if (ww < 0.6) { return; } for (var i = 0; i < n; i++) { var step = len / n; out.push({ x: q[0] + step * i + (step - ww) / 2, w: ww }); } });
	return out;
}
function featureMat(c, f, wallC, pal) {
	switch (f) {
		case 'stone': return L.pbr('stone', { color: '#B9AE9C' }, { normal: 2 });
		case 'brick': return L.pbr('brick', { color: '#A9654C', kind: 'lime', mortar: '#D9D2C6' }, { normal: 1.4 });
		case 'concrete': return L.pbr('concrete', { color: '#B3B0AA' }, { normal: 0.8 });
		case 'marble': return marble(c.interior_style === 'monochrome' ? 'black' : 'calacatta');
		case 'tiles': return L.pbr('wtile', { pattern: 'zellige', color: '#7FA6A0', grout: '#E8E4DC' }, { normal: 1.2, physical: true, clearcoat: 0.8 });
		case 'wallpaper': return L.pbr('panel', { color: pal[1] }, { normal: 0.4 });
		case 'fluted': return L.pbr('wtile', { pattern: 'fluted', color: L.shadeHex(wallC, -0.04), size: 0.035 }, { normal: 2.2 });
		default: return null;
	}
}
// Feature wall finish on a stretch of a wall (wall-local group).
function featureWall(grp, m, f, x0, x1, H, wallC) {
	if (f === 'slats') { var w = m.st === 'japandi' || m.st === 'scandinavian' ? m.oak : m.wood; BX(grp, x0, 0, 0, x1, H - 0.01, 0.012, m.dark); for (var sx = x0 + 0.01; sx < x1 - 0.03; sx += 0.06) { BX(grp, sx, 0, 0.012, sx + 0.035, H - 0.02, 0.04, w); } return; }
	if (f === 'panels') { var pm = L.solid(L.shadeHex(wallC, -0.03), 0.7), pm2 = L.solid(L.shadeHex(wallC, 0.03), 0.7); BX(grp, x0, 0, 0, x1, 1.1, 0.015, pm); for (var px = x0 + 0.06; px < x1 - 0.45; px += 0.58) { RB(grp, px, 0.14, 0.015, px + 0.5, 0.96, 0.03, 0.005, pm2, 1); } BX(grp, x0, 1.07, 0, x1, 1.12, 0.045, m.white); return; }
	var fm = featureMat(m.c, f, wallC, m.pal);
	if (fm) { BX(grp, x0, 0, 0, x1, H, f === 'stone' || f === 'brick' ? 0.04 : 0.015, fm); }
}
// Ceiling details: finish, beams, coffers, slats, light cove; lights in it. The flat ceiling faces
// down, so the camera looks over it from above and sees it from below.
function vault(g, m, W, D, H, rise) {
	var beam = m.st === 'scandinavian' ? m.oak : veneer('#8A6446'), cm2 = L.solid('#F7F6F3', 0.9);
	RB(g, W / 2 - 0.08, H + rise - 0.25, 0, W / 2 + 0.08, H + rise, D, 0.004, beam, 1);
	quad(g, [[0, H, 0], [W / 2, H + rise, 0], [W / 2, H + rise, D], [0, H, D]], cm2);
	quad(g, [[W, H, 0], [W, H, D], [W / 2, H + rise, D], [W / 2, H + rise, 0]], cm2);
	for (var rz = 0.6; rz < D; rz += 1.2) { [-1, 1].forEach(function (s2) { ROD(g, [W / 2 + s2 * W / 2, H - 0.05, rz], [W / 2, H + rise - 0.08, rz], 0.05, beam, 4); }); }
	// the gable walls of the item picture
}
function ceiling(g, m, type, W, D, H, lights, full) {
	var cm = type === 'concrete' ? L.pbr('concrete', { color: '#BDBAB4' }, { normal: 0.6 }) : L.solid('#F7F6F3', 0.9);
	if (type !== 'vaulted') { var pl = M(planeGeo(W, D), cm, false); pl.rotation.x = Math.PI / 2; pl.position.set(W / 2, H, D / 2); g.add(pl); }
	else if (full) { vault(g, m, W, D, H, Math.min(1.2, W * 0.3)); }
	var band = full ? D : Math.min(1.0, D * 0.35);
	if (type === 'beams') { for (var bx = 0.6; bx < W; bx += 1.2) { RB(g, bx - 0.07, H - 0.2, 0, bx + 0.07, H, D, 0.004, m.st === 'scandinavian' ? m.oak : veneer('#8A6446'), 1); } }
	else if (type === 'coffered') { var cw = L.solid('#F7F6F3', 0.85); for (var x = 0; x <= W + 0.01; x += W / Math.max(2, Math.round(W / 1.1))) { BX(g, x - 0.05, H - 0.14, 0, x + 0.05, H, band, cw); } [0, band].forEach(function (z) { BX(g, 0, H - 0.14, z - 0.05, W, H, z + 0.05, cw); }); }
	else if (type === 'slats') { for (var sz = 0.03; sz < band; sz += 0.07) { BX(g, 0, H - 0.05, sz, W, H, sz + 0.04, m.oak); } BX(g, 0, H - 0.051, 0, W, H - 0.05, band, m.dark); }
	else if (type === 'cove' || lights === 'cove') {
		// a lowered band along the far walls with a light line in its edge (open towards the camera above)
		var cv = m.night ? emissive('#FFD9A0', 3) : L.solid('#FFF6E6', 0.4), bd = L.solid('#F7F6F3', 0.9), bw = Math.min(0.4, D * 0.15);
		quad(g, [[0, H - 0.2, 0], [0, H - 0.2, bw], [W, H - 0.2, bw], [W, H - 0.2, 0]], bd);
		quad(g, [[0, H - 0.2, bw], [0, H, bw], [W, H, bw], [W, H - 0.2, bw]], bd); quad(g, [[0, H - 0.2, bw], [W, H - 0.2, bw], [W, H, bw], [0, H, bw]], bd);
		BX(g, 0, H - 0.215, bw - 0.01, W, H - 0.2, bw + 0.01, cv); BX(g, 0.01, H - 0.04, bw, 0.04, H - 0.02, D, cv);
	}
	else if (type === 'flat') { BX(g, 0, H - 0.012, 0, W, H, 0.012, m.dark); }
	// lights in the ceiling
	if (lights === 'spots') { var sp = m.night ? emissive('#FFF0D8', 4) : L.solid('#FFFFFF', 0.3); for (var lx = W / 4; lx < W; lx += W / 2) { for (var lz = D / 4; lz < D; lz += D / 2) { var d = M(new THREE.CircleGeometry(0.045, 24), sp, false); d.rotation.x = Math.PI / 2; d.position.set(lx, H - 0.002, lz); g.add(d); var rr = M(new THREE.RingGeometry(0.045, 0.06, 24), m.dark, false); rr.rotation.x = Math.PI / 2; rr.position.set(lx, H - 0.003, lz); g.add(rr); if (m.night) { var p = new THREE.SpotLight('#FFE6C4', 6, 6, 0.7, 0.6, 2); p.position.set(lx, H - 0.05, lz); p.target.position.set(lx, 0, lz); g.add(p); g.add(p.target); } } } }
	else if (lights === 'track') { var tz = Math.min(1.2, D * 0.4); BX(g, 0.4, H - 0.04, tz - 0.02, W - 0.4, H, tz + 0.02, m.black); for (var tx = 0.8; tx < W - 0.5; tx += Math.max(0.8, (W - 1.2) / 4)) { ROD(g, [tx, H - 0.04, tz], [tx, H - 0.1, tz], 0.006, m.black); var cyl = M(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 20), m.black); cyl.position.set(tx, H - 0.13, tz + 0.04); cyl.rotation.x = 0.6; g.add(cyl); } if (m.night) { var pt = new THREE.PointLight('#FFE0B8', 3, 7, 2); pt.position.set(W / 2, H - 0.4, tz + 0.3); g.add(pt); } }
	else if (lights === 'flush') { LA(g, [[0, 0], [0.2, 0], [0.22, 0.03], [0.2, 0.06], [0, 0.07]], m.opal, W / 2, H - 0.07, D / 2, 40); if (m.night) { var pf = new THREE.PointLight('#FFE0B8', 3, 7, 2); pf.position.set(W / 2, H - 0.3, D / 2); g.add(pf); } }
}
// The household items a room can hold: size [width, height with decor, depth] of the extra pieces, the devices, the pets.
var XSIZE = { bookshelf: [1.2, 2.1, 0.36], sideboard: [1.7, 1.15, 0.47], desk: [1.4, 1.3, 1.3], reading: [1.7, 1.6, 1.2], piano: [1.5, 1.25, 1.15], bar_cart: [0.8, 1.0, 0.5], bench: [1.4, 0.5, 0.4], plant_stand: [1.0, 1.2, 0.35], floor_mirror: [0.7, 1.7, 0.3], chest: [1.1, 1.25, 0.5], vitrine: [0.9, 1.9, 0.44], pouf: [0.6, 0.38, 0.6], wall_shelf: [1.15, 2.1, 0.28], aquarium: [1.45, 1.35, 0.58] };
var ELK = ['tv', 'soundbar', 'speakers', 'console', 'projector', 'computer', 'laptop', 'smart_speaker', 'robot_vacuum', 'smart_panel'], PETK = ['dog_large', 'dog_small', 'cat'];
export function interiorScene(c, room) {
	if (room) {
		c = Object.assign({}, c);
		['interior_style', 'wall_color', 'furniture_color', 'ceiling_height'].forEach(function (k) { if (room[k]) { c[k] = room[k]; } });
		// what the room's own details override on the house setting (1.9.0): everything the visitor can
		// choose per room shows up in this view too, not only in the prompt
		var wetRoom = /^(bathroom|wc|wellness|sauna)$/.test(String(room.type || ''));
		Object.keys(ROOM_OVERRIDE).forEach(function (k) {
			var key = ROOM_OVERRIDE[k];
			if (!room[k]) { return; }
			// a wet room's wall covering is its tiling, everywhere else the wall finish
			if (k === 'wall') { if (wetRoom) { c.bath_tiles = room[k]; } else { c.wall_finish = [room[k]]; } return; }
			// choosing a curtain for the room turns the curtains on, "none" turns them off
			if (k === 'curtains') { c.curtains = room[k] !== 'none'; if (room[k] === 'none') { return; } }
			c[key] = room[k];
		});
	}
	// this room's household items (the visitor's own assignment, or one fitting room per item); people only in the main living room
	var K0 = L.SK(), rooms0 = K0._roomsOf(c), rid = room ? room.id || ((rooms0.filter(function (q) { return q.type === room.type; })[0] || {}).id) || 'virtual:' + room.type : '', RI = rid ? (K0._roomItems(c, rooms0)[rid] || []) : [], main0 = K0._mainRoom(rooms0);
	c = Object.assign({}, c, { extra_furniture: RI.filter(function (k) { return !!XSIZE[k]; }), electronics: RI.filter(function (k) { return ELK.indexOf(k) !== -1; }), pets: RI.filter(function (k) { return PETK.indexOf(k) !== -1; }) });
	var hostsPeople = !rid || !main0 || main0.id === rid;
	var hs = new L.House(c, { mini: true }), K = L.SK(), m = Mats(c, room);
	var type = room && room.type ? room.type : 'living', kind = roomKind(type), night = m.night;
	var area = L.clamp(L.num(room && room.area, 0) || ({ living: 30, living_kitchen: 45, dining: 14, kitchen: 12, bed: 14, kids: 12, office: 10, wardrobe: 6, bath: 7, wc: 2.5, laundry: 5, hall: 7, stairs: 8 }[kind] || 14), 2.5, 90);
	var W = L.clamp(Math.sqrt(area * 1.35), 1.6, 10), D = L.clamp(area / W, 1.4, 8), H = L.clamp(L.num(c.ceiling_height, 2.8), 2.4, 4);
	if (L.num(room && room.width, 0) >= 1 && L.num(room && room.length, 0) >= 1) { W = L.clamp(Math.max(room.width, room.length), 1.4, 12); D = L.clamp(Math.min(room.width, room.length), 1.4, 10); }
	if (kind === 'wc') { W = Math.max(W, 1.6); D = Math.max(D, 1.5); }
	if (kind === 'bath') { W = Math.max(W, 2.4); D = Math.max(D, 2.2); }
	if (kind === 'stairs') { W = Math.max(W, 3.6); D = Math.max(D, 2.4); }
	var g = hs.fit, R = G(); g.add(R);   // R: furniture in sketch metres (x, y) → three (x, z)
	var wallC = L.col(c.wall_color, '#F4F1EC'), wet = kind === 'bath' || kind === 'wc';
	var tile = wet ? L.bathTileMat(c) : null; m.tile = tile;
	var fw = (c.wall_finish || []).filter(function (x) { return x !== 'limewash'; });
	var wallMat = wet ? tile : (Array.isArray(c.wall_finish) && c.wall_finish.indexOf('limewash') !== -1 ? L.pbr('render', { color: wallC, texture: 'coarse' }, { normal: 0.5 }) : L.solid(wallC, 0.92));
	// 1.25.0: the designed stair of a drawn house (build mode) when it is in this room: from its floor (lower)
	// and / or arriving through the slab opening in its floor (upper); the room's own floor gets the opening
	var dst = L.stairRoom ? L.stairRoom(c, room) : null, dHole = null;
	if (dst && dst.upper) { dHole = [dst.hole.map(function (p) { return [L.clamp(p[0], 0.02, W - 0.02), L.clamp(p[1], 0.02, D - 0.02)]; })]; }
	// floor slab with a light base around it, and the floor itself
	hs.add(dHole ? L.prism([[-0.35, -0.35], [W + 0.35, -0.35], [W + 0.35, D + 0.35], [-0.35, D + 0.35]], -0.25, -0.02, L.solid('#E4DFD7', 0.95), dHole) : L.box(-0.35, -0.35, -0.25, W + 0.35, D + 0.35, -0.02, L.solid('#E4DFD7', 0.95)), false);
	// the room's own floor covering wins over the house's choice for this room type
	var floorKey = (room && room.floor) ? room.floor : L.roomFloorKey(c, type);
	g.add(dHole ? L.prism([[0, 0], [W, 0], [W, D], [0, D]], -0.02, 0, L.roomFloorMat(c, floorKey), dHole) : L.box(0, 0, -0.02, W, D, 0.0, L.roomFloorMat(c, floorKey)));
	// what stands where: blocking stretches on the back (x) and left (y measured from the front corner) walls
	var occB = [], occL = [], ws = K._win(c), winW = Math.max(ws.w, 1.0), pano = c.window_style === 'panoramic';
	var door = { u: wet && D < 2.6 ? 0.12 : 0.3, w: wet && D < 2.0 ? 0.8 : 0.9, style: pick(c, 'door_style') }, hasTV = false, rightFeat = null, fixes = [];
	occL.push([0, door.u + door.w + (door.style === 'barn' ? 1.1 : 0.15)]);
	var lights = pick(c, 'ceiling_lights'), pend = pick(c, 'pendant_style'), deco = c.decor !== false;
	var art = pick(c, 'art_style'), plantK = pick(c, 'plants');
	// the designed stair stands in the furniture group while the room is furnished (the pieces keep clear of it)
	// and leaves it before the pieces get their slots: it is part of the house, it cannot be picked up
	var dstG = dst && !dst.none ? designedStair(c, dst, H) : null;
	if (dstG) { R.add(dstG); }
	function P(obj, x, y, rot) { return place(R, obj, x, y, rot); }
	function onLeft(obj, y, depth) { return P(obj, depth || 0, y, 90); }   // origin on the left wall, facing +x
	// a plant is scaled to the room: in a small bedroom a tree the size of the bed looks wrong
	function plantScale(s) { return (s || 1) * L.clamp(Math.sqrt(W * D) / 4.6, 0.62, 1.1); }
	function cornerPlant(x, y, s) { if (deco && plantK !== 'none' && (c.plant_amount !== 'few' || kind === 'living' || kind === 'living_kitchen')) { P(tag(plant(m, plantK, plantScale(s)), 'plants'), x, y, 0); } }
	function tag(obj, key) { obj.userData.item = key; return obj; }
	function pendantAt(x, y, type2, len) { if (type2 !== 'none' && c.lighting !== 'minimal') { var p = pendant(m, type2, H, len); p.position.set(x, 0, y); R.add(p); } }
	var backArt = null;
	if (kind === 'living' || kind === 'living_kitchen' || kind === 'dining') {
		var lx = 0;
		if (kind === 'living_kitchen') {
			var kx = Math.min(W * 0.44, 4.4), lay = c.kitchen_layout || 'island';
			kitchenIn(R, m, c, 0.02, kx, D, H, lay === 'u' ? 'l' : lay, occB, occL);
			lx = kx + 0.4;
			if (D > 3.6) { var ds = diningSet(m, pick(c, 'dining_table'), pick(c, 'dining_chairs'), 4, 1.6); P(ds, kx * 0.5 + 0.2, D - 1.15, 0); pendantAt(kx * 0.5 + 0.2, D - 1.15, pend, 1.2); }
		}
		if (kind === 'dining') {
			var n = W > 3.6 ? 6 : 4, tl = Math.min(W - 1.8, n > 4 ? 2.2 : 1.6), dt = pick(c, 'dining_table');
			if (pick(c, 'rug_style') !== 'none') { P(rug(m, pick(c, 'rug_style'), tl + 1.4, 2.6), W / 2, D / 2, 0); }
			P(diningSet(m, dt, pick(c, 'dining_chairs'), n, tl), W / 2, D / 2, 0);
			pendantAt(W / 2, D / 2, pend, tl * 0.75);
			var sb = G(), sbl = G(); RB(sb, -0.8, 0.12, 0, 0.8, 0.8, 0.45, 0.006, m.wood, 1); sbl.position.z = 0.225; legs4(sbl, 1.5, 0.4, 0.12, 0.03, m.legs, 'taper'); sb.add(sbl); vase(sb, m, -0.45, 0.8, 0.22, 1.2); bowl(sb, m, 0.4, 0.8, 0.22, 0.12); candle(sb, m, 0.1, 0.8, 0.2);
			if (D > 2.6) { onLeft(sb, D / 2 + 0.2); occL.push([D / 2 - 0.6, D / 2 + 1.0]); var al = artwork(m, art === 'mirror' ? 'mirror' : art, 1.2); al.position.y = 0.2; onLeft(al, D / 2 + 0.2); }
			cornerPlant(W - 0.45, 0.45, 1.1);
		} else {
			var sType = pick(c, 'sofa_type'), avail = W - lx - 0.5, sw = L.clamp(avail - 1.1, 1.7, sType === 'u_shape' ? 3.2 : 2.8);
			if (sType === 'u_shape' && avail < 3.0) { sType = 'corner'; }
			var sx = lx + 0.25 + Math.max(0, (avail - sw - 0.9) / 2) + sw / 2, sd = sType === 'modular' ? 1.05 : 0.95, front = 0.02 + sd + (sType === 'corner' || sType === 'u_shape' ? 0.8 : 0) + (sType === 'curved' ? 0.1 : 0);
			// fireplace and TV: on the left wall of a living room; next to an open kitchen (or with no room at
			// the left wall) on the back wall, with the sofa turned towards them – both walls are in view
			var fp = c.fireplace || 'none', mw = pick(c, 'media_wall'), wantFeat = fp !== 'none' || mw !== 'none';
			var spanL = D - (door.u + door.w + 0.3) - 0.2, cy2 = 0.2 + spanL / 2, span = spanL;
			var leftOK = kind === 'living' && spanL > 2.0, faceBack = wantFeat && !leftOK && D >= 3.6;
			var sofaC = 0.02 + sd / 2, sofaRot = 0, tableY = Math.min(D - 0.9, (sType === 'corner' || sType === 'u_shape' ? 0.02 + sd + 0.55 : front + 0.45) + 0.32);
			if (faceBack) { var fd = 0.8; sofaC = Math.min(D - sd / 2 - 0.1, fd + 1.75 + sd / 2); sofaRot = 180; tableY = (fd + sofaC - sd / 2) / 2 + 0.05; }
			var rs = pick(c, 'rug_style');
			if (rs !== 'none') { P(tag(rug(m, rs, Math.min(sw + 0.8, W - lx - 0.2), Math.min(2.4, D - 0.4)), 'rug_style'), sx, faceBack ? tableY : Math.min(tableY, D / 2 + 0.4), 0); }
			P(tag(sofa(m, sType, sw), 'sofa_type'), sx, sofaC, sofaRot);
			if (!faceBack) { occB.push([sx - sw / 2, sx + sw / 2, 0.86]); }
			P(tag(coffeeTable(m, pick(c, 'coffee_table')), 'coffee_table'), sx, tableY, 0);
			P(sideTable(m, c.lighting !== 'minimal' && pick(c, 'floor_lamp') === 'none'), sx - sw / 2 - 0.32, faceBack ? sofaC : 0.4, 0);
			var fl = pick(c, 'floor_lamp');
			if (fl === 'arc' && !faceBack) { var bx = sx - sw / 2 - 0.3, by = 0.3, dx = sx - bx, dz = tableY - by; var al2 = floorLamp(m, 'arc'); al2.scale.setScalar(Math.min(1, Math.hypot(dx, dz) / 1.6)); al2.position.set(bx, 0, by); al2.rotation.y = Math.atan2(-dz, dx); R.add(al2); }
			else if (fl !== 'none' && c.lighting !== 'minimal') { P(tag(floorLamp(m, fl === 'arc' ? 'tripod' : fl), 'floor_lamp'), Math.min(W - 0.35, sx + sw / 2 + 0.3), faceBack ? sofaC + 0.2 : 0.3, 0); }
			if (pend !== 'none' && c.lighting === 'statement') { pendantAt(sx, tableY, pend); }
			// the TV hangs on the face of the chimney breast (linear 0.35 m, three-sided 0.57 m deep), else on the wall
			var tvDepth = function (f) { return f === 'corner' ? 0.59 : (f === 'stove' || f === 'bioethanol' || f === 'mantel' ? 0.03 : 0.37); };
			var tvAt = function (put, depth) { var tvg = tag(G(), 'media_wall'); RB(tvg, -0.72, 1.35, 0, 0.72, 2.18, 0.03, 0.004, m.dark, 1); BX(tvg, -0.71, 1.36, 0.03, 0.71, 2.17, 0.032, m.screen); put(tvg, depth); hasTV = true; };
			if (leftOK && wantFeat) {
				var onL = function (y) { return function (o, depth) { onLeft(o, y, depth || 0); }; };
				if (fp !== 'none' && mw !== 'none' && (fp === 'stove' || fp === 'mantel') && spanL > 4.6) {
					// a stove or a mantel with the TV wall beside it
					var yF = cy2 - 1.15, yM = cy2 + 1.15, mwB = tag(mediaWall(m, mw === 'stone' ? 'lowboard' : mw, 2.2, H), 'media_wall');
					onLeft(tag(fireplace(m, fp, H), 'fireplace'), yF, fp === 'stove' ? 0.3 : 0); onLeft(mwB, yM); hasTV = true;
					occL.push([D - cy2 - 2.3, D - cy2 + 2.3]);
				} else if (fp !== 'none') {
					var yS = fp === 'stove' && mw !== 'none' ? cy2 - 0.55 : cy2;
					onLeft(tag(fireplace(m, fp, H, mw !== 'none'), 'fireplace'), yS, fp === 'stove' || fp === 'bioethanol' ? 0.3 : 0);
					occL.push([D - cy2 - 1.1, D - cy2 + 1.1]);
					if (mw !== 'none') { tvAt(onL(fp === 'stove' ? cy2 + 0.55 : cy2), tvDepth(fp)); }
				} else { var wm3 = Math.min(2.8, spanL), mwg = tag(mediaWall(m, mw, wm3, H), 'media_wall'); onLeft(mwg, cy2); occL.push([D - cy2 - wm3 / 2, D - cy2 + wm3 / 2]); hasTV = true; }
			} else if (faceBack) {
				var onB = function (o, depth) { P(o, sx, depth || 0, 0); };
				if (fp !== 'none') {
					onB(tag(fireplace(m, fp, H, mw !== 'none'), 'fireplace'), fp === 'stove' || fp === 'bioethanol' ? 0.3 : 0.02);
					if (mw !== 'none') { tvAt(function (o, d2) { P(o, sx + (fp === 'stove' ? 0.9 : 0), d2, 0); }, tvDepth(fp)); }
				} else { var wb = Math.min(2.6, avail - 0.2); onB(tag(mediaWall(m, mw, wb, H), 'media_wall'), 0.02); hasTV = true; }
				occB.push([sx - 1.4, sx + 1.4, 9]);
			} else if (fp !== 'none') {
				P(tag(fireplace(m, 'bioethanol', H), 'fireplace'), Math.min(W - 0.7, sx + sw / 2 + 0.9), Math.min(D - 0.6, tableY + 1.3), 180);
			}
			// armchair: beside the sofa, turned to the table
			var ac = pick(c, 'armchair_type');
			if (ac !== 'none' && sx + sw / 2 + 1.1 < W - 0.1) { P(tag(armchair(m, ac), 'armchair_type'), Math.min(W - 0.55, sx + sw / 2 + 0.75), faceBack ? tableY : tableY + (ac === 'lounge' ? 0.2 : 0.3), faceBack ? -90 : -60); }
			else if (ac !== 'none' && !faceBack) { P(tag(armchair(m, ac), 'armchair_type'), sx + sw * 0.3, Math.min(D - 0.55, tableY + 1.15), 180); }
			if (deco && !faceBack) { backArt = [sx, sw]; }
			cornerPlant(W - 0.42, 0.42, 1.15);
		}
	} else if (kind === 'kitchen') {
		kitchenIn(R, m, c, 0.02, W - 0.02, D, H, c.kitchen_layout || 'island', occB, occL);
		if ((c.kitchen_layout === 'straight' || c.kitchen_layout === 'galley') && D > 3.0) { P(diningSet(m, pick(c, 'dining_table'), pick(c, 'dining_chairs'), 4, 1.4), W / 2, D - 0.9, 0); pendantAt(W / 2, D - 0.9, pend, 1); }
	} else if (kind === 'bed' || kind === 'kids') {
		var dbl = type === 'master' || type === 'guest' || (kind === 'bed' && W > 3.2), bt = pick(c, 'bed_type'), bw2 = dbl ? 1.8 : 0.9;
		if (kind === 'kids') { bt = bt === 'canopy' || bt === 'platform' || bt === 'metal' || bt === 'wood' ? bt : 'wood'; }
		var bx2 = W / 2 + (W > 3.4 ? 0.25 : 0);
		var rs2 = pick(c, 'rug_style'), foot = 2.25; if (rs2 !== 'none') { if (D - foot > 1.0) { var rd2 = Math.min(1.6, D - foot - 0.15); P(tag(rug(m, rs2, bw2 + 0.9, rd2), 'rug_style'), bx2, foot + 0.05 + rd2 / 2, 0); } else { P(tag(rug(m, rs2, bw2 + 1.3, Math.min(D - 0.2, foot + 0.4)), 'rug_style'), bx2, Math.min(D - 0.2, foot + 0.4) / 2 + 0.05, 0); } }
		P(bed(m, bt, dbl), bx2, 1.05, 0);
		occB.push([bx2 - bw2 / 2 - (bt === 'panel' ? 1.05 : 0.65), bx2 + bw2 / 2 + (bt === 'panel' ? 1.05 : 0.65), bt === 'canopy' ? 9 : 1.35]);
		if (pend !== 'none' && c.lighting === 'statement') { pendantAt(bx2, 1.4, pend); }
		var wt = pick(c, 'wardrobe_type'), wl = Math.min(D - (door.u + door.w + 0.35), 2.4);
		if (wl >= 1.2) { var wg = wardrobe(m, wt, wl, H - 0.15); wg.rotation.y = Math.PI / 2; wg.position.set(0.31, 0, 0.05 + wl / 2); R.add(wg); occL.push([D - 0.05 - wl, D - 0.05]); }
		if (kind === 'kids') {
			// a children's room by theme: the open shelf with books, a toy box, a desk and the theme's own pieces
			var sh = G(); RB(sh, -0.45, 0, 0, 0.45, 1.6, 0.32, 0.005, m.white, 1);
			for (var y = 0.4; y < 1.6; y += 0.4) { BX(sh, -0.43, y, 0.01, 0.43, y + 0.02, 0.3, m.oak); bookRow(sh, m, -0.4, 0.4, y + 0.02, 0.16, 0.18, 0.24, Math.round(y * 10)); }
			P(tag(sh, 'kids_theme'), W - 0.6, 0.02, 0);
			RB(R, 0.4, 0, D - 1.2, 1.0, 0.45, D - 0.6, 0.06, m.acc2, 3);   // toy box
			var kIdx = -1, kSeen = 0;
			rooms0.forEach(function (q) { if (q.type === 'kids') { if (q.id === rid) { kIdx = kSeen; } kSeen++; } });
			kidsTheme(R, m, c, W, D, H, bx2, bw2, P, tag, kIdx > 0);
		}
		else if (D > 3.6 && W > 3.0) { P(armchair(m, pick(c, 'armchair_type') === 'none' ? 'barrel' : pick(c, 'armchair_type')), W - 0.65, D - 1.0, -135); }
		cornerPlant(W - 0.38, Math.min(D - 0.4, 2.6), 0.95);
		if (deco && bt !== 'panel' && bt !== 'canopy') { backArt = [bx2, bw2 + 0.4]; }
	} else if (kind === 'office') {
		var dk = G(); RB(dk, -0.75, 0.72, 0, 0.75, 0.76, 0.7, 0.006, m.wood, 1); [[-0.7, 0.04], [0.7, 0.04], [-0.7, 0.66], [0.7, 0.66]].forEach(function (q) { ROD(dk, [q[0], 0, q[1]], [q[0], 0.72, q[1]], 0.015, m.metal); });
		if ((c.electronics || []).indexOf('computer') !== -1) { var pc = electronic(m, 'computer'); pc.position.set(0, 0.76, 0.18); dk.add(pc); } else { RB(dk, -0.25, 0.76, 0.12, 0.25, 1.06, 0.14, 0.006, m.dark, 1); BX(dk, -0.24, 0.775, 0.14, 0.24, 1.05, 0.142, m.screen); ROD(dk, [0, 0.76, 0.1], [0, 0.85, 0.12], 0.012, m.steel); } bookStack(dk, m, 0.5, 0.76, 0.3, 3, 5); tableLamp(dk, m, -0.55, 0.76, 0.2);
		var ch2 = diningChair(m, pick(c, 'dining_chairs') === 'bench' ? 'upholstered' : pick(c, 'dining_chairs')); ch2.position.set(0, 0, 0.95); ch2.rotation.y = Math.PI; dk.add(ch2);
		P(dk, Math.max(1.0, W * 0.45), 0.02, 0); occB.push([W * 0.45 - 0.8, W * 0.45 + 0.8, 0.8]);
		var bs2 = G(); RB(bs2, -0.6, 0, 0, 0.6, 2.1, 0.34, 0.005, m.wood, 1); for (var yy = 0.35; yy < 2.0; yy += 0.36) { BX(bs2, -0.58, yy, 0.01, 0.58, yy + 0.025, 0.33, m.wood); bookRow(bs2, m, -0.56, 0.56 - (Math.round(yy * 10) % 3) * 0.15, yy + 0.025, 0.17, 0.24, 0.3, Math.round(yy * 13)); }
		if (D > 2.6) { onLeft(bs2, Math.min(D - door.u - door.w - 0.8, 1.1)); occL.push([D - 1.8, D - 0.4]); }
		cornerPlant(W - 0.4, 0.4, 1.1);
	} else if (kind === 'wardrobe') {
		P(wardrobe(m, pick(c, 'wardrobe_type'), W - 0.1, H - 0.15), W / 2, 0.33, 0); occB.push([0, W, 9]);
		if (D > 2.2) { var wg2 = wardrobe(m, 'open', Math.min(D - 1.5, 2.2), H - 0.15); wg2.rotation.y = Math.PI / 2; wg2.position.set(0.31, 0, 0.7 + Math.min(D - 1.5, 2.2) / 2); R.add(wg2); }
		RB(R, W / 2 - 0.4, 0.0, D * 0.55, W / 2 + 0.4, 0.45, D * 0.55 + 0.6, 0.08, m.fab, 3);
	} else if (wet) { bathroomIn(R, m, c, kind, W, D, H, occB, occL, door, fixes); }
	else if (kind === 'laundry') {
		var wm = L.solid('#F4F4F2', 0.4), lg = G();
		[0.35, 1.0].forEach(function (x) { RB(lg, x - 0.3, 0, 0, x + 0.3, 0.85, 0.6, 0.02, wm, 2); var dr = M(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 32), glass('#3A4248', 0.7)); dr.rotation.x = Math.PI / 2; at(dr, x, 0.45, 0.61); lg.add(dr); var rim = M(new THREE.TorusGeometry(0.2, 0.02, 8, 40), m.steel); at(rim, x, 0.45, 0.61); lg.add(rim); });
		RB(lg, 0, 0.85, 0, Math.min(W - 0.1, 2.2), 0.89, 0.64, 0.004, kMats(m).top, 1); RB(lg, 1.5, 0.89, 0.1, 1.9, 1.15, 0.45, 0.03, rattanMat('#B89566'), 2);
		[1.5, 1.9].forEach(function (y) { BX(lg, 0, y, 0, Math.min(W - 0.1, 2.0), y + 0.025, 0.3, m.oak); }); bottle(lg, m, 0.3, 1.525, 0.15, 1.2, m.potW); bottle(lg, m, 0.5, 1.525, 0.15, 1.1, m.acc2.color ? m.potD : m.potD);
		P(lg, 0.1, 0.02, 0); lg.position.x = 0.1; occB.push([0, Math.min(W, 2.3), 9]);
	} else if (kind === 'attic') {
		// unconverted attic: the timber truss over a boarded floor, a loft ladder at the hatch, stored boxes
		var tw = L.pbr ? L.pbr('wood', { color: '#8A6A4C' }, { normal: 1 }) : m.wood, pitch = L.clamp(L.num(c.roof_pitch, 38), 15, 55) * D2R;
		var span = Math.min(W, 9), ridgeH = Math.min(H + 1.6, 0.5 + Math.tan(pitch) * span / 2);
		for (var ry = 0.6; ry < D - 0.3; ry += 0.9) {
			// a pair of rafters, a collar beam and the purlin posts
			ROD(R, [0.1, 0.25, ry], [W / 2, ridgeH, ry], 0.055, tw, 6);
			ROD(R, [W - 0.1, 0.25, ry], [W / 2, ridgeH, ry], 0.055, tw, 6);
			ROD(R, [W * 0.25, ridgeH * 0.55 + 0.1, ry], [W * 0.75, ridgeH * 0.55 + 0.1, ry], 0.045, tw, 6);
		}
		ROD(R, [W / 2, ridgeH, 0.2], [W / 2, ridgeH, D - 0.2], 0.07, tw, 6);   // ridge beam
		[0.28, 0.72].forEach(function (f2) { ROD(R, [W * f2, ridgeH * 0.55 + 0.1, 0.3], [W * f2, ridgeH * 0.55 + 0.1, D - 0.3], 0.06, tw, 6); });
		BX(R, 0, -0.02, 0, W, 0.04, D, L.pbr ? L.pbr('wood', { color: '#B99A72' }, { normal: 1 }) : m.wood);   // boarded floor
		// the hatch with the loft ladder
		var hx = L.clamp(W - 1.6, 0.8, W - 0.9);
		BX(R, hx - 0.45, 0.0, D - 1.5, hx + 0.45, 0.06, D - 0.6, m.dark);
		for (var st2 = 0; st2 < 5; st2++) { ROD(R, [hx - 0.32, st2 * 0.22, D - 1.4 + st2 * 0.12], [hx + 0.32, st2 * 0.22, D - 1.4 + st2 * 0.12], 0.022, tw, 6); }
		[[0.9, 1.0], [1.9, 0.7], [2.9, 1.3]].forEach(function (q, i) {
			if (q[0] > W - 0.6) { return; }
			var bx4 = G(); RB(bx4, -0.3, 0, 0, 0.3, 0.42, 0.44, 0.01, i % 2 ? m.wood : L.solid('#BCA78C', 0.9), 1);
			P(tag(bx4, 'attic_use'), q[0], Math.min(D - 0.6, q[1]), i * 24);
		});
		pendantAt(W / 2, D / 2, 'none');
	} else if (kind === 'hall' || kind === 'stairs') {
		var multi = c.levels && c.levels !== 'single';
		// A multi-level home always shows its staircase here; in a narrow hall a shape that fits takes over.
		if ((kind === 'stairs' || multi) && !dst) { var stp = stairFit(m, c, W, D, H), sty = stp.userData.stairType; if (sty === 'spiral') { var sr = stp.userData.radius; stp.position.set(W - sr - 0.1, 0, sr + 0.1); occB.push([W - 2 * sr - 0.2, W, 9]); } else { stp.rotation.y = -Math.PI / 2; stp.position.set(Math.min(W - 0.3, 3.7), 0, 0.02); occB.push([0, W, 9]); } R.add(stp); }
		else {
			var cs = G(); RB(cs, -0.6, 0.78, 0, 0.6, 0.82, 0.34, 0.005, m.wood, 1); [[-0.56, 0.04], [0.56, 0.04], [-0.56, 0.3], [0.56, 0.3]].forEach(function (q) { ROD(cs, [q[0], 0, q[1]], [q[0], 0.78, q[1]], 0.012, m.metal); }); vase(cs, m, -0.3, 0.82, 0.17, 1.2); bowl(cs, m, 0.3, 0.82, 0.17, 0.1, m.potD);
			var mi = tag(artwork(m, 'mirror', 1.0), 'art_style'); mi.position.y = 0.1; cs.add(mi);
			P(cs, Math.min(W - 0.8, 1.2), 0.02, 0); occB.push([0.4, 2.0, 9]);
		}
		var bn = G(); RB(bn, -0.55, 0.4, 0, 0.55, 0.45, 0.38, 0.006, m.oak, 1); [[-0.5], [0.5]].forEach(function (q) { BX(bn, q[0] - 0.02, 0, 0.02, q[0] + 0.02, 0.4, 0.36, m.oak); }); RB(bn, -0.5, 0.45, 0.05, 0.5, 0.5, 0.35, 0.03, m.fab, 2);
		for (var hk = -0.45; hk <= 0.46; hk += 0.3) { ROD(bn, [hk, 1.7, 0], [hk, 1.72, 0.08], 0.008, m.metal); }
		if (D > 2.4) { onLeft(bn, Math.max(0.6, D - door.u - door.w - 0.9)); occL.push([D - 2.3, D - 1.0]); }
		var rs3 = pick(c, 'rug_style'); if (rs3 !== 'none' && rs3 !== 'round') { P(rug(m, rs3, Math.min(1.0, W - 0.6), Math.min(2.6, D - 0.6)), W * 0.55, D / 2 + 0.2, 0); }
		cornerPlant(W - 0.38, 0.4, 1.0);
		pendantAt(W / 2, D / 2, pend === 'linear' ? 'globe' : pend);
	}
	// ---- this room's own household items (extra furniture, devices, pets), people, more plants. Every
	// item gets a place – at a wall where nothing stands, else on the free floor – and a self-check below
	// keeps everything inside the room, out of the doorway and clear of the windows.
	var EL = c.electronics || [], XF = c.extra_furniture || [], PETS = c.pets || [];
	var living = kind === 'living' || kind === 'living_kitchen', amount = c.plant_amount || 'normal';
	var doorZ = [0, D - door.u - door.w - 0.05, 0.95, D - door.u + 0.05];
	var takenB = [[W - 0.9, W]], takenL = [[D - Math.min(D, 1.1), D]], takenR = [[0, 0.95]], takenF = [[0, Math.min(W, door.w + 0.1)], [W - 0.6, W]];
	if (living && typeof sx === 'number' && !sofaRot) { takenB.push([sx - sw / 2 - 0.62, sx - sw / 2], [sx + sw / 2, sx + sw / 2 + 0.6]); }
	if (kind === 'bed' || kind === 'kids') { takenR.push([Math.min(D - 0.4, 2.6) - 0.45, Math.min(D - 0.4, 2.6) + 0.45]); if (D > 3.6 && W > 3.0) { takenR.push([D - 1.7, D]); } }
	// footprints of what stands in the room now (rugs and things hanging from the ceiling do not count)
	var bx3 = new THREE.Box3();
	function footprints() {
		var out = [];
		hs.root.updateMatrixWorld(true);
		R.children.forEach(function (o) { bx3.setFromObject(o); if (bx3.isEmpty() || bx3.max.y < 0.06 || bx3.min.y > 1.3) { return; } out.push([bx3.min.x, bx3.min.z, bx3.max.x, bx3.max.z]); });
		return out;
	}
	function hits(r, fps, mg) { return fps.some(function (f) { return r[0] < f[2] + mg && r[2] > f[0] - mg && r[1] < f[3] + mg && r[3] > f[1] - mg; }); }
	function inDoor(r) { return r[0] < doorZ[2] && r[2] > doorZ[0] && r[1] < doorZ[3] && r[3] > doorZ[1]; }
	// candidate centres along a wall (free stretches, nearest to `prefer` first)
	function spots(occ, taken, len, w, prefer) {
		var c2 = [];
		freeSpans(occ.map(function (o) { return [o[0], o[1]]; }).concat(taken), len, w + 0.1).forEach(function (sp) {
			[L.clamp(prefer, sp[0] + w / 2 + 0.05, sp[1] - w / 2 - 0.05), sp[0] + w / 2 + 0.05, sp[1] - w / 2 - 0.05].forEach(function (x) { if (x - w / 2 >= sp[0] - 1e-6 && x + w / 2 <= sp[1] + 1e-6) { c2.push(x); } });
		});
		return c2.sort(function (a, b) { return Math.abs(a - prefer) - Math.abs(b - prefer); });
	}
	// put a piece (back on the wall, depth d) at the back, left or right wall; false when nowhere fits
	function atWall(side, obj, w, d, h, prefer) {
		var fps = footprints(), list = side === 'B' ? spots(occB, takenB, W, w, prefer) : (side === 'L' ? spots(occL, takenL, D, w, prefer) : (side === 'F' ? spots([], takenF, W, w, prefer) : spots([], takenR, D - 1.0, w, prefer)));
		for (var i = 0; i < list.length; i++) {
			var x = list[i], r = side === 'B' ? [x - w / 2, 0.02, x + w / 2, 0.02 + d] : (side === 'L' ? [0.02, D - x - w / 2, 0.02 + d, D - x + w / 2] : (side === 'F' ? [x - w / 2, D - 0.02 - d, x + w / 2, D - 0.02] : [W - 0.02 - d, x - w / 2, W - 0.02, x + w / 2]));
			if (hits(r, fps, 0.03) || inDoor(r)) { continue; }
			if (side === 'B') { P(obj, x, 0.02, 0); occB.push([x - w / 2, x + w / 2, h]); takenB.push([x - w / 2, x + w / 2]); }
			else if (side === 'L') { onLeft(obj, D - x, 0.02); occL.push([x - w / 2, x + w / 2]); takenL.push([x - w / 2, x + w / 2]); }
			else if (side === 'F') { P(obj, x, D - 0.02, 180); takenF.push([x - w / 2, x + w / 2]); }
			else { P(obj, W - 0.02, x, -90); takenR.push([x - w / 2, x + w / 2]); }
			return true;
		}
		return false;
	}
	// a free spot on the floor, turned towards the camera (the right and the front walls are cut away):
	// low pieces towards the front right, tall ones towards the back right, so nothing hides the room or a TV.
	// `strict`: false when nothing is free; otherwise the spot that overlaps the least is taken (and reported)
	function onFloor(obj, w, d, tall, strict) {
		var fps = footprints(), best = null, bs = 1e9, rots = [30, 0, 90];
		for (var ri = 0; ri < rots.length && !best; ri++) {
			var rot = rots[ri], cs = Math.cos(rot * D2R), sn = Math.sin(rot * D2R);
			var ex = [[-w / 2, 0], [w / 2, 0], [w / 2, d], [-w / 2, d]].map(function (q) { return [q[0] * cs + q[1] * sn, -q[0] * sn + q[1] * cs]; });
			var ax0 = Math.min.apply(null, ex.map(function (q) { return q[0]; })), ax1 = Math.max.apply(null, ex.map(function (q) { return q[0]; })), az0 = Math.min.apply(null, ex.map(function (q) { return q[1]; })), az1 = Math.max.apply(null, ex.map(function (q) { return q[1]; }));
			for (var y = 0.1; y <= D; y += 0.1) {
				for (var x = 0.1; x <= W; x += 0.1) {
					var r = [x + ax0, y + az0, x + ax1, y + az1];
					if (r[0] < 0.05 || r[2] > W - 0.05 || r[1] < 0.05 || r[3] > D - 0.05 || hits(r, fps, 0.06) || inDoor(r)) { continue; }
					// near a wall first: a piece standing in the middle of the room blocks the view of it
					var cx2 = (r[0] + r[2]) / 2, cz2 = (r[1] + r[3]) / 2;
					var wall = Math.min(cx2, W - cx2, cz2, D - cz2);
					var sc = (tall ? (W - r[2]) + r[1] : Math.abs(W - 0.3 - r[2]) * 0.8 + Math.abs(D - 0.35 - r[3])) + wall * 1.6;
					if (sc < bs) { bs = sc; best = [x, y, rot]; }
				}
			}
		}
		if (best) { P(obj, best[0], best[1], best[2]); return true; }
		if (strict) { return false; }
		// nothing free: the spot overlapping the least, inside the room and out of the doorway
		var lo = 1e9;
		for (var y2 = 0.05 + d / 2; y2 <= D - d / 2 - 0.05; y2 += 0.1) {
			for (var x2 = 0.05 + w / 2; x2 <= W - w / 2 - 0.05; x2 += 0.1) {
				var r2 = [x2 - w / 2, y2 - d / 2, x2 + w / 2, y2 + d / 2], ov = 0;
				if (inDoor(r2)) { continue; }
				fps.forEach(function (f) { ov += Math.max(0, Math.min(r2[2], f[2]) - Math.max(r2[0], f[0])) * Math.max(0, Math.min(r2[3], f[3]) - Math.max(r2[1], f[1])); });
				ov += 0.01 * (Math.abs(W - x2) + Math.abs(D - y2)) + 0.06 * Math.min(x2, W - x2, y2, D - y2);
				if (ov < lo) { lo = ov; best = [x2, y2 - d / 2]; }
			}
		}
		P(obj, best ? best[0] : W / 2, best ? best[1] : Math.max(0.3, D / 2 - d / 2), 0); fixes.push(obj.userData.item || '');
		return true;
	}
	function putPiece(obj, w, d, h, sides, prefer) {
		for (var i = 0; i < sides.length; i++) { if (sides[i] !== 'R' && sides[i] !== 'F' && atWall(sides[i], obj, w, d, h, sides[i] === 'B' ? W * prefer : D * prefer)) { return; } }
		if (onFloor(obj, w, d, h >= 1.2, true) || atWall('F', obj, w, d, h, W * prefer)) { return; }
		onFloor(obj, w, d, h >= 1.2);
	}
	// A multi-level home whose programme has no hall and no stair room: the main living space carries the
	// staircase, so the stairs are never missing from the house.
	if (living && !dst && c.levels && c.levels !== 'single' && W > 3.0 && D > 2.4 && !rooms0.some(function (q) { var k2 = roomKind(q.type); return k2 === 'hall' || k2 === 'stairs'; })) {
		var lst = stairFit(m, c, Math.min(W, 4.4), D, H), lsty = lst.userData.stairType;
		// wrap it so the piece is centred on x and runs forward on z: the floor planner can then turn it freely
		var lw = lsty === 'spiral' ? lst.userData.radius * 2 + 0.2 : L.clamp(Math.min(1.0, D - 1.0), 0.62, 1.0);
		var ld = lsty === 'spiral' ? lw : Math.max(Math.min(Math.min(W, 4.4) - 0.6, 3.6), 2.0);
		var lg2 = G(); lg2.userData.item = 'stair_type'; lg2.userData.field = 'stair_type';
		lst.position.set(lsty === 'spiral' ? 0 : -lw / 2, 0, lsty === 'spiral' ? ld / 2 : 0); lg2.add(lst);
		onFloor(lg2, lw, ld, true, true);
	}
	// devices: a TV set wherever a TV, soundbar, console or speakers were asked for and there is none
	if (['tv', 'soundbar', 'console', 'speakers'].some(function (k) { return EL.indexOf(k) !== -1; }) && !hasTV) {
		var bedR = (kind === 'bed' || kind === 'kids') && typeof bx2 === 'number', tvW = bedR ? 1.6 : 2.2, tvSet;
		if (bedR) {
			// at the foot of the bed a low console with the TV on a pedestal (screen 0.62–1.32 m): it faces the
			// bed, and from the camera's side its back stays low enough not to hide the room
			tvSet = tag(G(), 'tv'); RB(tvSet, -0.8, 0.1, 0, 0.8, 0.5, 0.42, 0.006, m.wood, 1); var tlg = G(); tlg.position.z = 0.21; legs4(tlg, 1.5, 0.36, 0.1, 0.02, m.legs, 'taper'); tvSet.add(tlg);
			RB(tvSet, -0.22, 0.5, 0.1, 0.22, 0.52, 0.3, 0.004, m.dark, 1); ROD(tvSet, [0, 0.52, 0.2], [0, 0.64, 0.2], 0.025, m.dark);
			RB(tvSet, -0.62, 0.62, 0.17, 0.62, 1.32, 0.21, 0.004, m.dark, 1); BX(tvSet, -0.615, 0.626, 0.21, 0.615, 1.314, 0.212, m.screen);
		} else { tvSet = tag(mediaWall(m, 'lowboard', tvW, H), 'tv'); }
		if (!(bedR && atWall('F', tvSet, tvW, 0.45, 1.3, bx2))) { putPiece(tvSet, tvW, 0.45, bedR ? 1.3 : 1.9, ['L', 'B'], 0.5); } hasTV = true;
	}
	XF.forEach(function (k, i) {
		var sz = XSIZE[k]; if (!sz) { return; }
		var obj = tag(extraPiece(m, k), k);
		if (k === 'pouf') { if (living && typeof sx === 'number') { P(obj, Math.max(0.5, sx - sw / 2 + 0.2), Math.min(D - 0.5, tableY + 0.75), 0); } else { onFloor(obj, 0.6, 0.6); } return; }
		if (k === 'bench' && (kind === 'bed' || kind === 'kids') && typeof bx2 === 'number' && D - 2.25 > 0.5) { obj.children[0].position.z = 0; P(obj, bx2, Math.min(D - 0.3, 2.4), 0); return; }
		// tall pieces prefer the side walls, low ones the back wall (a window may sit above them)
		putPiece(obj, sz[0], sz[2], sz[1], sz[1] >= 1.0 ? ['L', 'R', 'B'] : ['B', 'R', 'L'], sz[1] >= 1.0 ? 0.5 : 0.75 - i * 0.1);
	});
	if (EL.indexOf('projector') !== -1) {
		place(R, tag(electronic(m, 'projector'), 'projector'), living && typeof sx === 'number' ? sx : W / 2, living && typeof tableY === 'number' ? Math.min(D - 0.5, tableY + 0.4) : D / 2, 90, H - 0.36);
		if (!hasTV) { putPiece(tag(electronic(m, 'screen', H), 'projector'), 2.0, 0.08, 2.5, ['L', 'R', 'B'], 0.5); }
	}
	if (EL.indexOf('computer') !== -1 && kind !== 'office') { var pcd = tag(extraPiece(m, 'desk'), 'computer'), pc2 = electronic(m, 'computer'); pc2.position.set(0, 0.76, 0.18); pcd.add(pc2); putPiece(pcd, 1.4, 1.3, 1.3, ['B', 'R', 'L'], 0.4); }
	if (EL.indexOf('laptop') !== -1) {
		if (living && typeof sx === 'number') { place(R, tag(electronic(m, 'laptop'), 'laptop'), sx + sw * 0.18, sofaRot ? sofaC : 0.02 + sd * 0.5, sofaRot ? 165 : -15, 0.44); }
		else if (kind === 'office') { place(R, tag(electronic(m, 'laptop'), 'laptop'), Math.max(1.0, W * 0.45) + 0.45, 0.32, -10, 0.76); }
		else if ((kind === 'bed' || kind === 'kids') && typeof bx2 === 'number') { place(R, tag(electronic(m, 'laptop'), 'laptop'), bx2 + 0.25, 1.35, 20, 0.6); }
		else if (kind === 'dining') { place(R, tag(electronic(m, 'laptop'), 'laptop'), W / 2 + 0.3, D / 2 - 0.1, 10, 0.76); }
		else { var lt = tag(sideTable(m, false), 'laptop'), lp = electronic(m, 'laptop'); lp.position.set(0, 0.525, 0); lp.scale.setScalar(0.9); lt.add(lp); putPiece(lt, 0.5, 0.5, 0.6, ['B', 'R'], 0.5); }
	}
	if (EL.indexOf('smart_speaker') !== -1) {
		if (living && typeof sx === 'number') { place(R, tag(electronic(m, 'smart_speaker'), 'smart_speaker'), sx - sw / 2 - 0.24, sofaRot ? sofaC + 0.08 : 0.48, 0, 0.525); }
		else { var st4 = tag(sideTable(m, false), 'smart_speaker'), sp4 = electronic(m, 'smart_speaker'); sp4.position.set(0, 0.525, 0); st4.add(sp4); putPiece(st4, 0.5, 0.5, 0.7, ['B', 'R'], 0.85); }
	}
	if (EL.indexOf('robot_vacuum') !== -1) { onFloor(tag(electronic(m, 'robot_vacuum'), 'robot_vacuum'), 0.4, 0.4); }
	if (EL.indexOf('smart_panel') !== -1) { onLeft(tag(electronic(m, 'smart_panel'), 'smart_panel'), Math.max(0.3, D - (door.u + door.w + 0.28)), 0); }
	// plants: fewer, or many more (an urban jungle) than the one in the corner
	if (deco && plantK !== 'none' && amount === 'jungle' && !wet) {
		var kinds2 = [plantK, 'snake', 'pothos', 'monstera', 'fiddle', 'palm'], n3 = living ? 4 : 2;
		for (var pi = 0, put = 0; pi < 8 && put < n3; pi++) {
			var pk = kinds2[(pi + 1) % kinds2.length], pw3 = pk === 'pothos' || pk === 'snake' || pk === 'cactus' ? 0.55 : 0.85, po = tag(plant(m, pk, plantScale(pk === 'fiddle' || pk === 'palm' ? 1.0 : 0.9)), 'plants');
			po.rotation.y = pi * 0.7;
			var c2p = po; var wrap2 = G(); c2p.position.z = pw3 / 2; wrap2.add(c2p); tag(wrap2, 'plants');
			if (atWall(pi % 2 ? 'L' : 'B', wrap2, pw3, pw3, 0.5, pi % 2 ? D * 0.6 : (pi < 2 ? 0.5 : W * 0.35)) || atWall(pi % 2 ? 'B' : 'L', wrap2, pw3, pw3, 0.5, pi % 2 ? W * 0.3 : D * 0.5)) { put++; }
		}
	}
	// people (only in the main living room) and this room's pets
	var WHO = hostsPeople ? ({ couple: [['man', 'sit'], ['woman', 'sit']], family: [['man', 'sit'], ['woman', 'stand'], ['child', 'walk'], ['child', 'stand']], guests: [['man', 'sit'], ['woman', 'sit'], ['woman', 'stand'], ['man', 'stand']] }[c.people] || []) : [];
	if (living && typeof sx === 'number') {
		var seats = [sx - sw * 0.22, sx + sw * 0.22], si = 0, st2 = 0, seatY = sofaRot ? sofaC + 0.02 : 0.02 + sd * 0.48;
		WHO.forEach(function (w2, i) {
			if (w2[1] === 'sit' && si < 2) { P(person(m, w2[0], 'sit', 3 + i * 5), seats[si++], seatY, sofaRot); return; }
			var px = w2[0] === 'child' ? sx - 0.55 + st2 * 0.9 : Math.min(W - 0.45, sx + sw / 2 + 0.35 - st2 * 0.6), py = w2[0] === 'child' ? Math.min(D - 0.4, tableY + 0.85) : Math.min(D - 0.45, tableY + 1.15);
			P(person(m, w2[0], w2[1], 7 + i * 3), px, py, w2[0] === 'child' ? 160 + st2 * 50 : -150); st2++;
		});
	} else if (WHO.length) {
		WHO.slice(0, kind === 'kitchen' || kind === 'dining' ? 2 : 1).forEach(function (w2, i) { onFloor(person(m, w2[0], 'stand', 4 + i * 7), 0.5, 0.4); });
	}
	// what a pet needs indoors: a bed, bowls, and for a cat a scratching post
	function petKit(k) {
		var kit = G(), big = k === 'dog_large';
		if (k === 'cat') {
			CY(kit, 0, 0, 0, 0.22, 0.24, 0.06, m.fab, 16);
			[0.0, 0.62].forEach(function (y) { CY(kit, 0, y + 0.06, 0, 0.055, 0.055, 0.56, rattanMat('#C2A678'), 12); });
			RB(kit, -0.22, 0.62, -0.22, 0.22, 0.68, 0.22, 0.02, m.wood, 2);
			RB(kit, -0.2, 0.68, -0.2, 0.2, 0.76, 0.2, 0.06, m.fab, 3);
		} else {
			RB(kit, -(big ? 0.45 : 0.32), 0, -(big ? 0.33 : 0.24), big ? 0.45 : 0.32, 0.14, big ? 0.33 : 0.24, 0.08, m.fab, 3);
			RB(kit, -(big ? 0.36 : 0.25), 0.1, -(big ? 0.25 : 0.18), big ? 0.36 : 0.25, 0.16, big ? 0.25 : 0.18, 0.06, m.fab, 3);
		}
		[-0.12, 0.12].forEach(function (x) { bowl(kit, m, x + (k === 'cat' ? 0.42 : 0.62), 0.0, k === 'cat' ? 0.0 : 0.1, 0.06, m.potD); });
		return kit;
	}
	PETS.forEach(function (k, i) {
		if (c.pet_kit !== false) { var kt = tag(petKit(k), k); onFloor(kt, k === 'dog_large' ? 1.6 : 1.2, k === 'cat' ? 0.6 : 0.75, false); }
		if (k === 'cat') {
			if (living && typeof sx === 'number' && !sofaRot) { place(R, tag(cat(m, 11, 'lie'), 'cat'), sx + sw / 2 - 0.35, 0.02 + sd * 0.45, -70, 0.45); }
			else if ((kind === 'bed' || kind === 'kids') && typeof bx2 === 'number') { place(R, tag(cat(m, 13, 'lie'), 'cat'), bx2 + 0.35, 1.9, 30, 0.58); }
			else { onFloor(tag(cat(m, 13, 'sit'), 'cat'), 0.4, 0.4); }
			return;
		}
		var dg = tag(dog(m, k === 'dog_small' ? 'small' : 'large', 5 + i, k === 'dog_large' ? 'lie' : 'stand'), k);
		if (living && typeof sx === 'number' && !sofaRot) { P(dg, Math.min(W - 0.6, sx + 0.75 - i * 0.4), Math.min(D - 0.4, tableY + 0.7 + i * 0.25), 200 + i * 40); }
		else { var pb = G(); pb.add(petBed(m)); dg.rotation.y = 1; pb.add(dg); tag(pb, k); if (!onFloor(pb, 0.95, 0.95, false, true)) { pb.remove(dg); dg.rotation.y = 0; tag(dg, k); onFloor(dg, 0.45, k === 'dog_small' ? 0.5 : 0.95); } }
	});
	// self-check: whatever pokes out of the room is moved (or shrunk) back in, nothing stands in the doorway
	(function () {
		hs.root.updateMatrixWorld(true);
		R.children.slice().forEach(function (o) {
			if (o === dstG) { return; }   // the designed stair stands where the drawing puts it
			bx3.setFromObject(o);
			if (bx3.isEmpty() || bx3.max.y < 0.06 || bx3.min.y > 1.3) { return; }
			var w = bx3.max.x - bx3.min.x, d = bx3.max.z - bx3.min.z, k = 1, dx = 0, dz = 0;
			if (w > W + 0.01 || d > D + 0.01 || bx3.max.y > H + 0.02) { k = Math.min(1, (W - 0.04) / w, (D - 0.04) / d, H / bx3.max.y); o.scale.multiplyScalar(k); o.updateMatrixWorld(true); bx3.setFromObject(o); }
			if (bx3.min.x < -0.005) { dx = -bx3.min.x + 0.01; } else if (bx3.max.x > W + 0.005) { dx = W - bx3.max.x - 0.01; }
			if (bx3.min.z < -0.005) { dz = -bx3.min.z + 0.01; } else if (bx3.max.z > D + 0.005) { dz = D - bx3.max.z - 0.01; }
			var r = [bx3.min.x + dx, bx3.min.z + dz, bx3.max.x + dx, bx3.max.z + dz];
			if (inDoor(r) && r[3] - r[1] < 2.5) { var mx = doorZ[2] + 0.02 - r[0]; if (r[2] + mx < W - 0.01) { dx += mx; } else { dz += doorZ[1] - 0.02 - r[3]; } }
			if (Math.abs(dx) > 0.004 || Math.abs(dz) > 0.004 || k < 0.999) { o.position.x += dx; o.position.z += dz; if (o.userData.item) { fixes.push(o.userData.item); } }
		});
		// windows keep clear of what actually stands at the walls
		hs.root.updateMatrixWorld(true);
		var sillMin = wet ? 1.2 : 0.9;
		R.children.forEach(function (o) {
			bx3.setFromObject(o);
			if (bx3.isEmpty() || bx3.max.y < 0.06 || bx3.min.y > 1.3) { return; }
			if (bx3.min.z < 0.75) { occB.push([bx3.min.x, bx3.max.x, bx3.max.y]); }
			if (bx3.min.x < 0.75 && bx3.max.y > sillMin - 0.05) { occL.push([D - bx3.max.z, D - bx3.min.z]); }
		});
	})();
	// walls: back (y = 0), left (x = 0), right (x = W), front (y = D) – windows in the free stretches, the door on the left
	var winSill = wet ? Math.min(1.55, H - 0.95) : (pano ? 0.05 : L.clamp(ws.sill, 0.5, 1.0)), winH = wet ? 0.75 : Math.min(pano ? H - 0.35 : Math.max(ws.h, 1.3), H - 0.7);
	var lowB = occB.filter(function (o) { return o[2] < 1.0; }), hiB = occB.filter(function (o) { return o[2] >= 1.0; });
	var wantB = ['living', 'living_kitchen', 'dining', 'office', 'bath', 'wc', 'hall', 'bed', 'kids', 'laundry', 'kitchen'].indexOf(kind) !== -1;
	var bWins = wantB ? windowsIn(freeSpans(hiB.map(function (o) { return [o[0] - 0.1, o[1] + 0.1]; }), W, 1.1), pano && !wet ? Math.min(2.4, W * 0.35) : Math.min(winW, wet ? 1.0 : 1.6), kind === 'living' || kind === 'living_kitchen' ? 3 : 2) : [];
	// over low furniture the sill goes up
	bWins.forEach(function (o) { var hit = lowB.some(function (q) { return q[1] > o.x && q[0] < o.x + o.w; }); o.sill = hit && !wet ? Math.max(winSill, 0.95) : winSill; o.h = hit && !wet && pano ? H - 1.3 : winH; });
	if (kind === 'stairs') { bWins = []; }
	var lWins = windowsIn(freeSpans(occL.map(function (o) { return [o[0] - 0.1, o[1] + 0.1]; }), D, 1.1), Math.min(winW, wet ? 0.9 : 1.4), 1).map(function (o) { o.sill = winSill; o.h = winH; return o; });
	if (kind === 'stairs' || ['pantry', 'technical', 'wine'].indexOf(type) !== -1) { lWins = []; bWins = type === 'pantry' || type === 'technical' || type === 'wine' ? [] : bWins; }
	if (backArt && art !== 'none') {
		var hasWinOver = bWins.some(function (o) { return o.x < backArt[0] + backArt[1] / 2 && o.x + o.w > backArt[0] - backArt[1] / 2; });
		if (!hasWinOver) { var ag = tag(artwork(m, art, Math.min(1.6, backArt[1] * 0.6)), 'art_style'); ag.position.set(backArt[0], kind === 'bed' || kind === 'kids' ? 0.22 : 0.12, 0); R.add(ag); }
	}
	// ---- radiators: under a window where there is one, otherwise on a free stretch of a visible wall; in a
	// bathroom a towel rail. With underfloor heating only the towel rail stays.
	var radK = c.radiators || 'auto', under = (c.energy || []).indexOf('underfloor') !== -1;
	if (radK === 'auto') { radK = wet ? 'towel' : (under ? 'none' : 'panel'); }
	else if (radK !== 'none' && wet) { radK = 'towel'; }
	if (radK !== 'none' && ['wardrobe', 'pantry', 'technical', 'wine'].indexOf(type) === -1 && kind !== 'stairs') {
		var rFps = footprints(), rh = radK === 'towel' ? 0.5 : 0.6, done = false;
		function mkRad(w2) { var o2 = tag(radiator(m, radK, w2, rh), 'radiators'); o2.userData.field = 'radiators'; return o2; }
		// a towel rail hangs from 0.9 m up, so only tall pieces are in its way – a basin or a toilet is not
		if (radK === 'towel') {
			// the rail hangs from 0.9 m up, so only what is really tall is in its way (a toilet or a basin is
			// not): the free stretches come from the pieces themselves, not from the wall bookkeeping
			hs.root.updateMatrixWorld(true);
			var tallB = [], tallL = [];
			R.children.forEach(function (o) {
				bx3.setFromObject(o);
				if (bx3.isEmpty() || bx3.max.y < 1.0) { return; }
				if (bx3.min.z < 0.65) { tallB.push([bx3.min.x - 0.06, bx3.max.x + 0.06]); }
				if (bx3.min.x < 0.65) { tallL.push([D - bx3.max.z - 0.06, D - bx3.min.z + 0.06]); }
			});
			[0.6, 0.45].forEach(function (need) {
				if (done) { return; }
				var sp3 = freeSpans(tallB, W, need)[0];
				if (sp3) { P(mkRad(Math.min(0.6, sp3[1] - sp3[0] - 0.04)), (sp3[0] + sp3[1]) / 2, 0.04, 0); done = true; return; }
				var sp4 = freeSpans(tallL.concat([[0, door.u + door.w + 0.1]]), D, need)[0];
				if (sp4) { onLeft(mkRad(Math.min(0.6, sp4[1] - sp4[0] - 0.04)), D - (sp4[0] + sp4[1]) / 2, 0.04); done = true; }
			});
			// a tight bathroom: the rail goes higher, over the toilet or the washing machine
			if (!done) {
				var midB = [];
				R.children.forEach(function (o) { bx3.setFromObject(o); if (!bx3.isEmpty() && bx3.max.y >= 1.35 && bx3.min.z < 0.65) { midB.push([bx3.min.x - 0.06, bx3.max.x + 0.06]); } });
				var sp5 = freeSpans(midB, W, 0.45)[0];
				if (sp5) { var hr = mkRad(Math.min(0.6, sp5[1] - sp5[0] - 0.04)); P(hr, (sp5[0] + sp5[1]) / 2, 0.04, 0); hr.position.y = 0.45; done = true; }
			}
		}
		// under a window first – that is where a radiator belongs –, then on any free stretch, narrowing if need be
		[L.clamp(W * 0.3, 0.7, 1.3), 0.8, 0.6, 0.45, 0.35].forEach(function (rw) {
			if (done) { return; }
			bWins.some(function (o) {
				var cx = o.x + o.w / 2, r = [cx - rw / 2, 0.02, cx + rw / 2, 0.16];
				if (o.w < rw - 0.15 || hits(r, rFps, 0.01) || inDoor(r)) { return false; }
				P(mkRad(Math.min(rw, o.w - 0.08)), cx, 0.04, 0); occB.push([cx - rw / 2, cx + rw / 2, 0.75]); done = true; return true;
			});
			if (done) { return; }
			lWins.some(function (o) {
				var cy = o.x + o.w / 2, r2 = [0.02, D - cy - rw / 2, 0.16, D - cy + rw / 2];
				if (o.w < rw - 0.15 || hits(r2, rFps, 0.01) || inDoor(r2)) { return false; }
				onLeft(mkRad(Math.min(rw, o.w - 0.08)), D - cy, 0.04); occL.push([cy - rw / 2, cy + rw / 2]); done = true; return true;
			});
			if (done) { return; }
			done = atWall('B', mkRad(rw), rw, 0.16, 0.75, W * 0.5) || atWall('L', mkRad(rw), rw, 0.16, 0.75, D * 0.5) || atWall('R', mkRad(rw), rw, 0.16, 0.75, D * 0.5);
		});
	}
	// ---- pictures on the visible walls: over the low furniture, never over a window, a door or a tall piece.
	// `art_amount` says how many; the sofa/bed piece above counts as the first one.
	var artAmt = { none: 0, few: 1, normal: 2, gallery: 3 }[c.art_amount || 'normal'];
	if (artAmt === undefined) { artAmt = 2; }
	if (art !== 'none' && artAmt > 0 && deco && !wet && kind !== 'stairs' && kind !== 'wardrobe' && kind !== 'laundry') {
		var hung = backArt ? 1 : 0;
		var blockB = bWins.map(function (o) { return [o.x - 0.15, o.x + o.w + 0.15]; })
			.concat(occB.filter(function (o) { return o[2] >= 1.35; }).map(function (o) { return [o[0] - 0.1, o[1] + 0.1]; }));
		if (backArt) { blockB.push([backArt[0] - 0.95, backArt[0] + 0.95]); }
		var lowMid = occB.filter(function (o) { return o[2] < 1.35 && o[1] - o[0] > 0.8; }).map(function (o) { return (o[0] + o[1]) / 2; });
		var spansA = freeSpans(blockB, W, 0.7).map(function (sp) { return { side: 'B', a: sp[0], b: sp[1] }; })
			.concat(freeSpans(lWins.map(function (o) { return [o.x - 0.15, o.x + o.w + 0.15]; }).concat(occL.map(function (o) { return [o[0] - 0.1, o[1] + 0.1]; })), D, 0.7).map(function (sp) { return { side: 'L', a: sp[0], b: sp[1] }; }));
		spansA.sort(function (p, q) { return (q.b - q.a) - (p.b - p.a); });
		var artSet = (c.art_amount === 'gallery' ? ['gallery'] : []).concat(art === 'gallery' ? ['gallery', 'abstract', 'line'] : [art, art === 'landscape' ? 'photo' : 'landscape', 'line']);
		for (var ai = 0; ai < spansA.length && hung < artAmt; ai++) {
			var sp2 = spansA[ai], wA = Math.min(c.art_amount === "gallery" && hung === 0 ? 1.8 : 1.3, sp2.b - sp2.a - 0.2);
			if (wA < 0.45) { continue; }
			var near = lowMid.filter(function (x) { return sp2.side === 'B' && x > sp2.a + wA / 2 && x < sp2.b - wA / 2; })[0];
			var u2 = near === undefined ? (sp2.a + sp2.b) / 2 : near, kk = artSet[hung % artSet.length] || 'abstract';
			var ag2 = tag(artwork(m, kk === 'none' || kk === 'mirror' ? 'abstract' : kk, wA), 'art_style');
			if (sp2.side === 'B') { ag2.position.set(u2, kind === 'bed' || kind === 'kids' ? 0.2 : 0.12, 0.02); R.add(ag2); }
			else { P(ag2, 0.04, D - u2, 90); ag2.position.y = 0.12; }
			hung++;
		}
	}
	var vaulted = c.ceiling === 'vaulted';
	var walls = [
		{ o: [0, 0], u: [1, 0], len: W, wins: bWins, gable: vaulted },
		{ o: [0, D], u: [0, -1], len: D, wins: lWins, door: door },
		{ o: [W, 0], u: [0, 1], len: D, wins: [] },
		{ o: [W, D], u: [-1, 0], len: W, wins: [], gable: vaulted }
	];
	var fm = L.frameMat(c), gm = L.glassMat(c, night), sillM = L.solid('#ECE9E3', 0.6), wt2 = c.curtains !== false ? pick(c, 'window_treatment') : 'none', rise = vaulted ? Math.min(1.6, W * 0.25) : 0;
	// door casing (architrave): its colour, or none for a frameless, pocket or barn door
	var dfK = c.door_frame || 'auto', dsty = door.style;
	var casing = { none: null, white: m.white, wood: m.wood, black: m.black, wall: wallMat }[dfK];
	if (dfK === 'auto') { casing = (dsty === 'hidden' || dsty === 'pocket' || dsty === 'barn') ? null : (['scandinavian', 'japandi', 'wood_stone', 'mediterranean', 'rustic'].indexOf(m.st) !== -1 ? m.wood : m.white); }
	else if (casing && (dsty === 'pocket' || dsty === 'barn')) { casing = null; }
	walls.forEach(function (Wl, wi) {
		var U = L.X(Wl.u[0], Wl.u[1], 0), V = new THREE.Vector3(0, 1, 0), N = new THREE.Vector3().crossVectors(U, V);
		var grp = new THREE.Group(), mx = new THREE.Matrix4().makeBasis(U, V, N); mx.setPosition(L.X(Wl.o[0], Wl.o[1], 0));
		grp.matrixAutoUpdate = false; grp.matrix.copy(mx);
		var s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(Wl.len, 0); s.lineTo(Wl.len, H); if (Wl.gable) { s.lineTo(Wl.len / 2, H + rise); } s.lineTo(0, H); s.lineTo(0, 0);
		var ops = Wl.wins.map(function (o) { return { x: o.x, y: o.sill, w: o.w, h: o.h, win: true }; });
		if (Wl.door && Wl.len > 1.4) { var dh = Math.min(2.1, H - 0.2); ops.push({ x: Wl.door.u, y: 0, w: Wl.door.w, h: Wl.door.style === 'arched' ? Math.min(2.3, H - 0.15) : dh, door: true, arch: Wl.door.style === 'arched' }); }
		ops.forEach(function (o) { var p = new THREE.Path(); p.moveTo(o.x, o.y); p.lineTo(o.x + o.w, o.y); if (o.arch) { p.lineTo(o.x + o.w, o.y + o.h - o.w / 2); p.absarc(o.x + o.w / 2, o.y + o.h - o.w / 2, o.w / 2, 0, Math.PI, false); } else { p.lineTo(o.x + o.w, o.y + o.h); p.lineTo(o.x, o.y + o.h); } p.lineTo(o.x, o.y); s.holes.push(p); });
		var wm2 = new THREE.Mesh(new THREE.ShapeGeometry(s, 16), wallMat); wm2.receiveShadow = true; wm2.castShadow = true; grp.add(wm2);
		ops.forEach(function (o) {
			var x0 = o.x, x1 = o.x + o.w, y0 = o.y, y1 = o.y + o.h;
			if (!o.arch) { BX(grp, x0 - 0.02, y0, -0.25, x0, y1, 0, wallMat); BX(grp, x1, y0, -0.25, x1 + 0.02, y1, 0, wallMat); BX(grp, x0, y1, -0.25, x1, y1 + 0.02, 0, wallMat); }
			if (o.win) {
				BX(grp, x0, y0 - 0.02, -0.25, x1, y0, 0, wallMat);
				BX(grp, x0, y0, -0.16, x1, y0 + 0.06, -0.08, fm); BX(grp, x0, y1 - 0.06, -0.16, x1, y1, -0.08, fm); BX(grp, x0, y0, -0.16, x0 + 0.06, y1, -0.08, fm); BX(grp, x1 - 0.06, y0, -0.16, x1, y1, -0.08, fm);
				var panes = Math.max(1, Math.round(o.w / 1.2));
				for (var pn = 1; pn < panes; pn++) { var px = x0 + o.w * pn / panes; BX(grp, px - 0.03, y0, -0.16, px + 0.03, y1, -0.08, fm); }
				add(grp, at(M(L.boxGeo(o.w - 0.1, o.h - 0.1, 0.01), gm, false), (x0 + x1) / 2, (y0 + y1) / 2, -0.125));
				if (y0 > 0.2) { BX(grp, x0 - 0.06, y0 - 0.03, -0.02, x1 + 0.06, y0 + 0.02, 0.2, sillM); }
				if (!wet || wt2 === 'roller' || wt2 === 'venetian' || wt2 === 'roman') { add(grp, windowDressing(m, wet && (wt2 === 'drapes' || wt2 === 'sheer') ? 'roller' : wt2, x0, x1, y0, y1, H)); }
			} else {
				add(grp, doorPiece(m, Wl.door.style, x0, o.w, o.h, wallMat));
				// architrave: a 7 cm casing around the opening on the room side (a hidden or barn door has none)
				if (casing && !o.arch) { BX(grp, x0 - 0.07, 0, 0, x0, y1 + 0.07, 0.022, casing); BX(grp, x1, 0, 0, x1 + 0.07, y1 + 0.07, 0.022, casing); BX(grp, x0 - 0.07, y1, 0, x1 + 0.07, y1 + 0.07, 0.022, casing); }
				if (c.thresholds && c.thresholds !== 'none') { var th = threshold(m, c.thresholds, o.w + 0.04); th.position.x = x0 - 0.02; grp.add(th); }
			}
		});
		if (c.skirting && !wet) { BX(grp, 0, 0, 0, Wl.len, 0.08, 0.015, m.white); }
		// feature wall on the far walls
		if (!wet && fw.length && wi === 0 && (!!(room && room.wall) || (kind !== 'kitchen' && kind !== 'living_kitchen'))) {
			var fx0 = Wl.len * 0.08, fx1 = Wl.len * 0.92;
			Wl.wins.forEach(function (o) { if (o.x < Wl.len / 2) { fx0 = Math.max(fx0, o.x + o.w + 0.1); } else { fx1 = Math.min(fx1, o.x - 0.1); } });
			if (fx1 - fx0 > 0.8) { featureWall(grp, m, fw[0], fx0, fx1, H, wallC); }
		}
		if (!wet && fw.length > 1 && wi === 1) { var lr = freeSpans(occL.concat([[0, door.u + door.w + 0.2]]), Wl.len, 1.0)[0]; if (lr) { featureWall(grp, m, fw[1], lr[0], lr[1], H, wallC); } }
		g.add(grp);
	});
	// the ceiling is cut away in this view: it must not throw its shadow down into the room
	var ceilG = G(); g.add(ceilG);
	ceiling(ceilG, m, c.ceiling || 'flat', W, D, H, lights);
	ceilG.traverse(function (o) { if (o.isMesh) { o.castShadow = false; } });
	if (vaulted) { vault(g, m, W, D, H, rise); }

	// sizes for the camera: the room box (an invisible frame)
	var fit = new THREE.Mesh(L.boxGeo(W + 0.4, H * 0.75, D + 0.4), new THREE.MeshBasicMaterial({ visible: false }));
	fit.position.copy(L.X(W / 2, D / 2, H * 0.35)); hs.add(fit);
	hs.room = { W: W, D: D, H: H, kind: kind, door: [D - door.u - door.w, D - door.u], fixes: fixes.filter(function (k, i) { return k && fixes.indexOf(k) === i; }) };
	if (dstG) { R.remove(dstG); g.add(dstG); hs.stairTreads = dstG.userData.treads; }
	hs.items = R;   // the furniture of this room, as one group (the room test walks it)
	// Every piece gets a slot name ("key#index"), so a hand-made arrangement can be saved and found
	// again in the next build. Then whatever the visitor moved by hand is put back where they left it.
	(function () {
		var seen = {};
		R.children.forEach(function (o) {
			var key = (o.userData && (o.userData.item || o.userData.field)) || 'item';
			seen[key] = (seen[key] || 0);
			o.userData.slot = key + '#' + seen[key];
			seen[key]++;
		});
		var lay = c.room_layout && !Array.isArray(c.room_layout) && rid ? c.room_layout[rid] : null;
		if (!lay) { return; }
		var moved = [];
		R.children.forEach(function (o) {
			var p2 = lay[o.userData.slot];
			if (!p2) { return; }
			// the saved place is never trusted blindly: the piece is turned first, then pushed back
			// between the four walls as a whole (a narrower room, a new piece: it still fits)
			o.position.x = L.num(p2.x, o.position.x);
			o.position.z = L.num(p2.y, o.position.z);
			o.rotation.y = L.num(p2.rot, 0) * D2R;
			if (L.fitInRoom) { L.fitInRoom(o, W, D); }
			moved.push(o.userData.slot);
		});
		hs.moved = moved;
	})();
	return hs;
}
// Kitchen in a room: runs along the back wall (and the left wall), island in front.
function kitchenIn(R, m, c, x0, x1, D, H, layout, occB, occL) {
	var app = c.appliances || ['oven', 'hob', 'dishwasher', 'fridge'], hood = pick(c, 'hood_style'), up = pick(c, 'upper_cabinets');
	var fridge = app.indexOf('fridge') !== -1 || app.indexOf('side_by_side') !== -1;
	var len = x1 - x0, side = (layout === 'l' || layout === 'u') && D > 2.4;
	var bx0 = side ? x0 + 0.6 : x0, blen = x1 - bx0;
	var hasIsland = layout === 'island' && D > 3.4 && len > 2.4;
	var hobOnIsland = hasIsland && hood === 'island';
	var o = { H: H, uppers: up, sink: Math.min(blen - 0.5, blen * 0.32), hob: hobOnIsland ? undefined : Math.min(blen - 0.7, blen * 0.66), fridge: fridge ? 'end' : null, hood: hood };
	if (o.hob !== undefined && Math.abs(o.hob - o.sink) < 1.0) { o.hob = Math.min(blen - 0.4, o.sink + 1.0); }
	var run = kitchenRun(m, blen, o); run.position.set(bx0, 0, 0.0); R.add(run);
	occB.push([bx0, x1, 9]);
	if (side) { var sl = Math.min(D - 1.6, 2.4); if (sl > 0.8) { var r2 = kitchenRun(m, sl, { H: H, uppers: up === 'none' ? 'none' : 'open', splash: true, decor: true }); r2.rotation.y = Math.PI / 2; r2.position.set(x0, 0, 0.6 + sl); R.add(r2); occL.push([D - 0.6 - sl, D - 0.6]); } }
	if (layout === 'galley' && D > 2.6) { var r3 = kitchenRun(m, blen, { H: H, splash: false, decor: true }); r3.rotation.y = Math.PI; r3.position.set(x1, 0, 2.3); R.add(r3); }
	if (hasIsland) {
		var iw = Math.min(2.6, len * 0.62), isl = island(m, iw, { stools: pick(c, 'bar_stools'), hood: hobOnIsland ? 'island' : null, H: H });
		isl.position.set((x0 + x1) / 2, 0, 1.75); R.add(isl);
		if (hobOnIsland) { var hb = G(); RB(hb, -0.3, 0.92, 0.12, 0.3, 0.926, 0.62, 0.004, L.solid('#0E0F10', 0.08, 0.2), 1); hb.position.set((x0 + x1) / 2, 0, 1.75); R.add(hb); }
		var pd = pick(c, 'pendant_style'); if (pd !== 'none' && c.lighting !== 'minimal' && !hobOnIsland) { [-0.3, 0.3].forEach(function (k) { var p = pendant(m, pd === 'linear' || pd === 'chandelier' ? 'globe' : pd, H); p.position.set((x0 + x1) / 2 + k * iw, 0, 2.15); R.add(p); }); }
	}
}
// Bathroom / WC: shower in the back left corner, vanity and toilet along the back wall, tub on the right.
function bathroomIn(R, m, c, kind, W, D, H, occB, occL, door, fixes) {
	var fx = c.bath_fixtures || ['walkin', 'double_basin', 'wc'], has = function (v) { return fx.indexOf(v) !== -1; };
	var dz0 = D - door.u - door.w - 0.12;   // the left wall is free from the back corner up to here (the door follows)
	if (kind === 'wc') {
		// the toilet at the far end of the back wall, the hand basin near the door side (the doorway stays free)
		var t = toilet(m, pick(c, 'toilet_type') === 'smart' ? 'wall_hung' : pick(c, 'toilet_type')); t.userData.item = 'toilet_type'; t.position.set(W - 0.45, 0, 0); R.add(t);
		if (has('bidet') && W >= 2.3) { var bd0 = toilet(m, 'wall_hung', true); bd0.userData.item = 'bath_fixtures'; bd0.position.set(W - 1.1, 0, 0); R.add(bd0); }
		var bxw = Math.min(0.42, W - (has('bidet') && W >= 2.3 ? 1.7 : 1.05)), hb = vanity(m, 'none', 'wall_hung', 1, 0.5); hb.scale.setScalar(0.8);
		if (bxw < 0.3 && dz0 > 0.75) { hb.rotation.y = Math.PI / 2; hb.position.set(0, 0, Math.min(dz0 - 0.25, 0.55)); occL.push([D - 0.9, D - 0.2]); } else { hb.position.set(Math.max(0.3, bxw), 0, 0); }
		R.add(hb);
		var mi = bathMirror(m, pick(c, 'mirror_type') === 'cabinet' ? 'round' : pick(c, 'mirror_type'), 0.45); mi.position.copy(hb.position); mi.rotation.y = hb.rotation.y; R.add(mi);
		occB.push([0.15, W, 2.0]);
		if (c.decor !== false && D > 1.4) { var pl = plant(m, 'snake', 0.6); pl.position.set(W - 0.28, 0, D - 0.3); R.add(pl); }
		return;
	}
	var shT = pick(c, 'shower_type'), tubT = pick(c, 'bathtub_type'), nb = has('double_basin') ? 2 : (has('basin') || !has('double_basin') ? 1 : 0);
	var wantWC = has('wc') || !fx.length, wantBd = has('bidet'), wantTR = has('towel_rail'), vt = pick(c, 'vanity_type'), bt = pick(c, 'basin_type');
	var tubW = 0, tubZ = 0, tubFree = (tubT === 'freestanding' || tubT === 'clawfoot') && W >= 2.8 && D >= 2.6;
	if (tubT !== 'none') { tubW = tubFree ? 0 : (tubT === 'japanese' ? 0.8 : 0.86); tubZ = tubFree ? Math.min(D - 1.1, 1.5) + 0.9 : 0.05 + (tubT === 'japanese' ? 1.2 : 1.76); }
	// Fixture plan: the back wall (shower | basins | toilet | bidet | tub) first; what does not fit goes to the left
	// wall between the shower and the door, then to the front and the right wall (both cut away in the view, so
	// the fixture shows from behind) – never into the door swing. A tight room gets a smaller shower and basin.
	function alloc(sw) {
		var sd = sw ? Math.min(1.0, sw) : 0, tubFront = tubT !== 'none' && tubZ > D - 0.75;
		var S = {
			B: [sw ? sw + 0.15 : 0.12, W - (tubW ? tubW + 0.12 : 0.15)],
			L: [sd ? sd + 0.15 : 0.15, dz0],
			F: [door.w + 0.12, W - (tubFront ? (tubFree ? 1.3 : tubW + 0.12) : 0.15)],
			R: [tubT !== 'none' ? tubZ + 0.12 : 0.75, D - 0.75]
		};
		var put = [], fail = [], vw = nb > 1 ? 1.5 : 0.9, n2 = nb;
		var need = function () { return (n2 ? vw + 0.1 : 0) + (wantWC ? 0.75 : 0) + (wantBd ? 0.65 : 0); }, room = S.B[1] - S.B[0], onB = { wc: wantWC, bidet: wantBd, basin: !!n2 };
		if (n2 > 1 && need() > room) { vw = Math.max(1.1, vw - (need() - room)); if (need() > room) { n2 = 1; vw = 0.9; } }
		if (n2 && need() > room) { vw = Math.max(0.6, vw - (need() - room)); }
		if (need() > room && wantBd) { onB.bidet = false; }
		var need2 = function () { return (onB.basin ? vw + 0.1 : 0) + (onB.wc ? 0.75 : 0) + (onB.bidet ? 0.65 : 0); };
		if (need2() > room && wantWC) { onB.wc = false; }
		if (need2() > room && n2) { onB.basin = false; vw = 0.55; }
		var cur = { B: S.B[0], L: S.L[0], F: S.F[0], R: S.R[0] };
		function slot(key, w, order) {
			for (var i = 0; i < order.length; i++) { var k = order[i]; if (cur[k] + w <= S[k][1] + 0.02) { put.push([key, k, cur[k] + w / 2, w]); cur[k] += w; return true; } }
			fail.push([key, w]); return false;
		}
		if (n2) { slot('basin', vw + 0.1, onB.basin ? ['B'] : ['L', 'F', 'R']); }
		if (wantWC) { slot('wc', 0.75, onB.wc ? ['B'] : ['L', 'F', 'R']); }
		if (wantBd) { slot('bidet', 0.65, onB.bidet ? ['B'] : ['L', 'F', 'R', 'B']); }
		if (wantTR) { slot('rail', 0.6, ['L', 'B', 'F', 'R']); }
		return { sw: sw, sd: sd, put: put, fail: fail, vw: vw, nb: n2, S: S, cur: cur };
	}
	var plan = alloc(shT === 'none' ? 0 : (W > 3.0 ? 1.2 : 1.0));
	if (plan.fail.length && plan.sw > 0.9) { var p2 = alloc(0.9); if (p2.fail.length < plan.fail.length) { plan = p2; } }
	// still no room for the toilet or the basin: the shower moves over the tub (a glass screen and a rain head)
	var bad = function (p) { return p.fail.filter(function (f) { return f[0] === 'wc' || f[0] === 'basin'; }).length; }, merged = false;
	if (bad(plan) && tubT !== 'none' && shT !== 'none' && !tubFree) { var p3 = alloc(0); if (bad(p3) < bad(plan)) { plan = p3; merged = true; } }
	var sw = plan.sw, sd = plan.sd;
	if (sw) { var sh = shower(m, shT, sw, sd, H, m.tile); R.add(sh); occB.push([0, sw + 0.1, 9]); occL.push([D - sd - 0.1, D]); }
	if (tubT !== 'none') {
		var tub = bathtub(m, tubT); tub.rotation.y = Math.PI / 2;
		if (tubFree) { tub.position.set(W - 0.75, 0, tubZ - 0.9); } else { tub.position.set(W - (tubT === 'japanese' ? 0.42 : 0.43), 0, 0.05 + (tubT === 'japanese' ? 0.6 : 0.88)); }
		R.add(tub);
		if (merged) { var fm = finMat(m.c), cx2 = W - tubW / 2; ROD(R, [cx2, 2.15, 0], [cx2, 2.15, 0.38], 0.011, fm); RB(R, cx2 - 0.16, 2.12, 0.3, cx2 + 0.16, 2.14, 0.62, 0.01, fm, 2); add(R, at(M(L.boxGeo(0.008, 1.4, 0.8), glass('#E6F0F2', 0.18), false), W - tubW + 0.03, 1.3, 0.45)); }
	}
	// what found no wall at all goes where the most room is left (the self-check keeps it inside the room)
	plan.fail.forEach(function (f) { var best = 'B', bl = -9; ['B', 'L', 'F', 'R'].forEach(function (k) { var l = plan.S[k][1] - plan.cur[k]; if (l > bl) { bl = l; best = k; } }); plan.put.push([f[0], best, plan.cur[best] + f[1] / 2, f[1]]); plan.cur[best] += f[1]; fixes.push(f[0] === 'wc' ? 'toilet_type' : 'bath_fixtures'); });
	var mt = pick(c, 'mirror_type'), corner = false;
	plan.put.forEach(function (q) {
		var key = q[0], side = q[1], ctr = q[2], w = q[3], obj, h = 1.2, mir = null;
		if (key === 'basin') {
			var vw = w - 0.1, n2 = plan.nb;
			obj = vw < 0.6 ? vanity(m, 'none', 'wall_hung', 1, 0.5) : vanity(m, vt, bt, n2, vw); h = 2.0;
			if (vw < 0.6) { obj.scale.setScalar(0.85); }
			if (c.bath_mirror !== false && mt !== 'none' && (side === 'B' || side === 'L')) {
				mir = G(); (n2 > 1 && mt !== 'led' && mt !== 'cabinet' ? [-vw / 4, vw / 4] : [0]).forEach(function (dx) { var mi2 = bathMirror(m, mt, n2 > 1 && mt !== 'led' && mt !== 'cabinet' ? vw / 2 - 0.1 : Math.min(vw, 0.9)); mi2.position.x = dx; mir.add(mi2); });
			}
			if (c.decor !== false && side === 'B') { RB(R, ctr - 0.35, 0, 0.6, ctr + 0.35, 0.012, 1.05, 0.006, m.linenWhite, 1); }
		} else if (key === 'wc') { obj = toilet(m, pick(c, 'toilet_type')); obj.userData.item = 'toilet_type'; }
		else if (key === 'bidet') { obj = toilet(m, 'wall_hung', true); obj.userData.item = 'bath_fixtures'; }
		else { obj = towelRail(m); obj.userData.item = 'bath_fixtures'; }
		[obj, mir].forEach(function (o) {
			if (!o) { return; }
			if (side === 'B') { o.position.set(ctr, 0, 0); } else if (side === 'L') { o.rotation.y = Math.PI / 2; o.position.set(0, 0, ctr); } else if (side === 'F') { o.rotation.y = Math.PI; o.position.set(ctr, 0, D); } else { o.rotation.y = -Math.PI / 2; o.position.set(W, 0, ctr); }
			R.add(o);
		});
		if (side === 'B') { occB.push([ctr - w / 2, ctr + w / 2, h]); } else if (side === 'L') { occL.push([D - ctr - w / 2, D - ctr + w / 2]); }
		if ((side === 'F' && ctr + w / 2 > W - 0.8) || (side === 'R' && ctr + w / 2 > D - 0.8)) { corner = true; }
	});
	if (c.decor !== false && !corner) {
		var pl2 = plant(m, pick(c, 'plants') === 'monstera' || pick(c, 'plants') === 'palm' ? pick(c, 'plants') : 'snake', 0.7); pl2.position.set(W - 0.35, 0, D - 0.4); R.add(pl2);
		if (D - 0.95 - 0.25 > tubZ) { var stl = G(); CY(stl, 0, 0, 0, 0.17, 0.15, 0.45, m.oak, 24); towel(stl, m.linenWhite, 0, 0.47, 0, 0.3, 0); stl.position.set(W - 0.4, 0, D - 0.95); R.add(stl); }
	}
}

// A flat four-cornered face (three.js points, counter-clockwise seen from the front).
function quad(g, p, mat) {
	var geo = new THREE.BufferGeometry(), a = p[0], b = p[1], c2 = p[2], d = p[3];
	geo.setAttribute('position', new THREE.Float32BufferAttribute([].concat(a, b, c2, a, c2, d), 3));
	geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
	geo.computeVertexNormals();
	return add(g, M(geo, mat, false));
}

/* ================================================================== studio shots of single items (option cards) */
var BATH_FIELDS = { bathtub_type: 1, shower_type: 1, basin_type: 1, vanity_type: 1, toilet_type: 1, mirror_type: 1, taps: 1, bath_tiles: 1, bath_fixtures: 1 };
var KITCHEN_FIELDS = { fronts: 1, handles: 1, worktop: 1, sink: 1, backsplash: 1, upper_cabinets: 1, hood_style: 1 };
var MULTI_ITEM = { vehicles: 1, pets: 1, tree_types: 1, electronics: 1, extra_furniture: 1 };
function studio(hs, c, m, opt) {
	var floorM = opt.floor || L.roomFloorMat(c, L.roomFloorKey(c, opt.room || 'living')), wallM = opt.tile ? L.bathTileMat(c) : L.solid(L.col(c.wall_color, '#F2EFEA'), 0.92);
	hs.add(L.box(-5, -6, -0.02, 5, 4, 0, floorM), false);
	if (opt.wall !== false) { var bw = new THREE.Mesh(planeGeo(10, 4.2), wallM); bw.position.set(0, 2.1, 0); bw.receiveShadow = true; hs.add(bw, false); }
	if (opt.left) { var lw = new THREE.Mesh(planeGeo(6, 4.2), wallM); lw.rotation.y = Math.PI / 2; lw.position.set(opt.left, 2.1, 3); lw.receiveShadow = true; hs.add(lw, false); }
	if (opt.ceiling) { var cl = new THREE.Mesh(planeGeo(10, 6), L.solid('#F7F6F3', 0.9)); cl.rotation.x = Math.PI / 2; cl.position.set(0, opt.ceiling, 3); hs.add(cl, false); }
}
/* ---------------------------------------------------------------- card scenes (1.9.0)
   Small stand-alone scenes for the option cards of the fields that have no furniture of their own:
   a piece of wall, a doorway, a cut through the basement, the roof truss and a children's corner. */
// A piece of wall with a skirting and a floor strip: the backdrop of a wall-mounted card.
function wallPanelCard(m, w, h) {
	var g = G();
	BX(g, -w / 2, 0, 0, w / 2, h, 0.08, L.solid('#EFEBE4', 0.92));
	BX(g, -w / 2, 0, 0.08, w / 2, 0.08, 0.1, m.white);
	BX(g, -w / 2 - 0.1, -0.02, 0.08, w / 2 + 0.1, 0, 0.7, L.solid('#D9D2C7', 0.95));
	return g;
}
// A doorway in a piece of wall with its casing in the chosen colour, and the door leaf ajar.
function doorCard(m, c, kind) {
	var g = wallPanelCard(m, 1.7, 2.35), dw = 0.9, dh = 2.1;
	var cas = { white: m.white, wood: m.wood, black: m.black, wall: L.solid('#EFEBE4', 0.92), none: null }[kind];
	if (kind === 'auto' || kind === undefined) { cas = ['scandinavian', 'japandi', 'wood_stone', 'mediterranean', 'rustic'].indexOf(m.st) !== -1 ? m.wood : m.white; }
	// the opening: a dark reveal, the leaf slightly open
	BX(g, -dw / 2, 0, -0.14, dw / 2, dh, 0.085, L.solid('#2A2724', 0.9));
	var leaf = G(); RB(leaf, 0, 0, 0, dw - 0.03, dh - 0.04, 0.04, 0.004, kind === 'wood' || m.st === 'rustic' ? m.wood : m.white, 1);
	RB(leaf, 0.06, 0.1, 0.04, dw - 0.09, dh - 0.14, 0.05, 0.004, L.solid('#E8E4DD', 0.7), 1);
	leaf.position.set(-dw / 2 + 0.02, 0, 0.02); leaf.rotation.y = -0.55; g.add(leaf);
	ROD(leaf, [dw - 0.12, 1.05, 0.05], [dw - 0.12, 1.05, 0.12], 0.016, m.metal, 10);
	if (cas) {
		BX(g, -dw / 2 - 0.07, 0, 0.08, -dw / 2, dh + 0.07, 0.1, cas);
		BX(g, dw / 2, 0, 0.08, dw / 2 + 0.07, dh + 0.07, 0.1, cas);
		BX(g, -dw / 2 - 0.07, dh, 0.08, dw / 2 + 0.07, dh + 0.07, 0.1, cas);
	}
	return g;
}
// A cut through the lowest level: ground, basement wall, a cellar window in its light well, and for
// the walkout version the sunken terrace with its steps.
function basementCard(m, kind) {
	var g = G(), conc = L.pbr ? L.pbr('concrete', { color: '#C4C0B8' }, { normal: 0.6 }) : L.solid('#C4C0B8', 0.9);
	var wallM = L.solid('#EFEBE4', 0.92), soil = L.solid('#6E5B46', 1), grass = L.solid('#7A8F55', 1);
	var deep = kind === 'full' ? 2.4 : (kind === 'walkout' ? 2.4 : 1.5), W = 2.6, D = 1.2;
	// the house above, cut
	BX(g, -W / 2, 0, -D, W / 2, 1.5, 0, wallM);
	BX(g, -W / 2 - 0.06, 1.5, -D - 0.06, W / 2 + 0.06, 1.62, 0.06, L.solid('#D6D0C6', 0.9));
	// the basement box below ground
	BX(g, -W / 2, -deep, -D, W / 2, 0, 0, conc);
	BX(g, -W / 2 - 0.5, -deep - 0.1, -D - 0.4, -W / 2, 0.02, 0.6, soil);
	BX(g, W / 2, -deep - 0.1, -D - 0.4, W / 2 + 0.5, 0.02, 0.6, soil);
	BX(g, -W / 2 - 0.5, 0, 0.0, W / 2 + 0.5, 0.04, 0.6, grass);
	// partial: the basement only reaches half way under the house
	if (kind === 'partial') { BX(g, 0, -deep, -D, W / 2, 0, 0, soil); }
	if (kind === 'walkout') {
		// dug out in front: terrace, door, steps
		BX(g, -W / 2, -deep, 0, W / 2, -deep + 0.1, 1.1, conc);
		BX(g, -0.45, -deep + 0.1, -0.02, 0.45, -deep + 2.2, 0.04, L.glassMat ? L.glassMat({}, false) : glass('#DCEAEF', 0.2));
		BX(g, -0.5, -deep + 0.1, -0.04, -0.45, -deep + 2.25, 0.06, m.dark); BX(g, 0.45, -deep + 0.1, -0.04, 0.5, -deep + 2.25, 0.06, m.dark);
		for (var i = 0; i < 8; i++) { BX(g, W / 2 - 0.9, -deep + i * (deep / 8), 0.5 + i * 0.07, W / 2, -deep + (i + 1) * (deep / 8), 1.1, conc); }
	} else {
		// a cellar window in its light well
		BX(g, -0.45, -0.95, -0.06, 0.45, -0.4, 0.02, m.dark);
		BX(g, -0.4, -0.9, -0.02, 0.4, -0.45, 0.01, glass('#DCEAEF', 0.2));
		BX(g, -0.6, -1.05, 0.0, 0.6, -0.3, 0.55, conc);
		BX(g, -0.56, -1.0, 0.04, 0.56, -0.96, 0.5, L.solid('#9A9388', 0.9));
	}
	return g;
}
// The roof space: the truss over a boarded floor, with a roof window for the converted version.
function atticCard(m, kind) {
	var g = G(), tw = L.pbr ? L.pbr('wood', { color: '#8A6A4C' }, { normal: 1 }) : m.wood;
	var W = 3.0, D = 1.6, Hh = 1.7;
	BX(g, -W / 2, 0, -D / 2, W / 2, 0.06, D / 2, L.pbr ? L.pbr('wood', { color: '#B99A72' }, { normal: 1 }) : m.wood);
	if (kind === 'none') {
		// no attic: the ceiling follows the roof, so only the two slopes and a flat soffit
		[-1, 1].forEach(function (s) { var p = G(); RB(p, 0, 0, -D / 2, 0.08, Math.hypot(W / 2, Hh), D / 2, 0.01, L.solid('#EFEBE4', 0.92), 1); p.position.set(s * W / 2, 0.06, 0); p.rotation.z = -s * Math.atan2(W / 2, Hh); g.add(p); });
		return g;
	}
	for (var z = -D / 2 + 0.2; z <= D / 2 - 0.1; z += 0.55) {
		ROD(g, [-W / 2, 0.1, z], [0, Hh, z], 0.05, tw, 6);
		ROD(g, [W / 2, 0.1, z], [0, Hh, z], 0.05, tw, 6);
		if (kind !== 'habitable') { ROD(g, [-W * 0.26, Hh * 0.58, z], [W * 0.26, Hh * 0.58, z], 0.04, tw, 6); }
	}
	ROD(g, [0, Hh, -D / 2 + 0.1], [0, Hh, D / 2 - 0.1], 0.06, tw, 6);
	if (kind === 'habitable') {
		// lined slopes with a knee wall and a roof window
		[-1, 1].forEach(function (s) { var p2 = G(); RB(p2, 0, 0, -D / 2 + 0.1, 0.05, Math.hypot(W / 2, Hh) - 0.1, D / 2 - 0.1, 0.01, L.solid('#F4F1EC', 0.95), 1); p2.position.set(s * (W / 2 - 0.08), 0.12, 0); p2.rotation.z = -s * Math.atan2(W / 2, Hh); g.add(p2); });
		var win = G(); RB(win, -0.3, 0, -0.22, 0.3, 0.04, 0.22, 0.01, m.white, 1); RB(win, -0.26, 0.04, -0.18, 0.26, 0.06, 0.18, 0.01, glass('#DCEAEF', 0.25), 1);
		win.position.set(-W * 0.3, Hh * 0.62, 0); win.rotation.z = Math.atan2(W / 2, Hh); g.add(win);
	} else {
		// stored boxes and the hatch
		[[-0.8, -0.3], [0.7, 0.2], [1.1, -0.35]].forEach(function (q, i) { var bx5 = G(); RB(bx5, -0.26, 0.06, -0.2, 0.26, 0.44, 0.2, 0.01, i % 2 ? m.wood : L.solid('#BCA78C', 0.9), 1); bx5.position.set(q[0], 0, q[1]); bx5.rotation.y = i * 0.4; g.add(bx5); });
		BX(g, 0.1, 0.0, D / 2 - 0.55, 0.9, 0.07, D / 2 - 0.1, m.dark);
	}
	return g;
}
// A corner of a children's room in the chosen theme.
function kidsCard(m, c, th) {
	var g = G(), acc = { boy: '#3C6E9F', girl: '#D58AA6', baby: '#E6D7B8', teen: '#4A4A52', neutral: '#8FA896' }[th] || '#8FA896';
	var soft = L.solid(acc, 0.9);
	g.add(wallPanelCard(m, 2.4, 1.9));
	var bd = bed(m, th === 'baby' ? 'wood' : 'wood', false); bd.position.set(-0.6, 0, 0.75); g.add(bd);
	RB(g, -1.05, 0.52, 0.55, -0.15, 0.6, 1.55, 0.04, soft, 2);   // a blanket in the theme colour
	var rg2 = G(); RB(rg2, -0.55, 0, -0.3, 0.55, 0.02, 0.3, 0.12, soft, 2); rg2.position.set(0.5, 0, 1.5); g.add(rg2);
	if (th === 'girl' || th === 'baby') {
		var cp2 = G(); CY(cp2, 0, 1.5, 0, 0.05, 0.22, 0.32, L.solid('#FFFFFF', 0.95), 16, true);
		for (var a2 = 0; a2 < 7; a2++) { var an2 = a2 / 7 * Math.PI * 2; ROD(cp2, [Math.cos(an2) * 0.22, 1.5, Math.sin(an2) * 0.22], [Math.cos(an2) * 0.5, 0.55, Math.sin(an2) * 0.5], 0.01, L.solid('#FFF8F4', 0.98), 5); }
		cp2.position.set(-0.6, 0, 0.75); g.add(cp2);
	}
	if (th === 'boy' || th === 'teen') {
		var dk2 = G(); RB(dk2, -0.42, 0.68, 0, 0.42, 0.72, 0.42, 0.006, m.oak || m.wood, 1);
		[[-0.38, 0.05], [0.38, 0.05], [-0.38, 0.36], [0.38, 0.36]].forEach(function (q) { ROD(dk2, [q[0], 0, q[1]], [q[0], 0.68, q[1]], 0.014, m.metal, 6); });
		bookStack(dk2, m, 0.2, 0.72, 0.2, 3, 4); dk2.position.set(0.85, 0, 0.45); g.add(dk2);
		var gc2 = G(); RB(gc2, -0.2, 0.4, -0.2, 0.2, 0.46, 0.2, 0.04, th === 'teen' ? soft : m.fab, 2); RB(gc2, -0.18, 0.46, -0.24, 0.18, 0.95, -0.16, 0.04, th === 'teen' ? L.solid('#2E3033', 0.6) : soft, 2);
		CY(gc2, 0, 0, 0, 0.04, 0.04, 0.4, m.metal, 10); gc2.position.set(0.85, 0, 1.0); gc2.rotation.y = Math.PI; g.add(gc2);
	}
	if (th === 'baby') {
		var ct2 = G(); RB(ct2, -0.38, 0.3, 0, 0.38, 0.86, 0.45, 0.01, m.white, 1); RB(ct2, -0.37, 0.86, 0.03, 0.37, 0.94, 0.42, 0.04, soft, 2);
		ct2.position.set(0.85, 0, 0.45); g.add(ct2);
	}
	if (th === 'neutral') { var tb = G(); RB(tb, -0.3, 0, -0.22, 0.3, 0.4, 0.22, 0.05, soft, 2); tb.position.set(0.85, 0, 0.6); g.add(tb); }
	return g;
}
export function itemScene(cIn, it) {
	var f = it.field, v = it.value && it.value !== 'auto' ? it.value : pick(cIn, f), c = Object.assign({}, cIn);
	if (f) { c[f] = f === 'wall_finish' || f === 'bath_fixtures' || MULTI_ITEM[f] ? [v] : v; }
	c.time_of_day = 'midday'; c.weather = 'clear';
	var hs = new L.House(c, { mini: true }), m = Mats(c), g = hs.fit, o = null, cam = [28, 16], opt = { room: 'living' };
	var bath = BATH_FIELDS[f], kit = KITCHEN_FIELDS[f];
	if (bath) { opt = { room: 'bathroom', tile: true }; }
	if (kit) { opt = { room: 'kitchen' }; }
	function at2(obj, x, z, ry) { obj.position.set(x || 0, 0, z || 0); obj.rotation.y = ry || 0; g.add(obj); return obj; }
	switch (f) {
		case 'sofa_type': at2(sofa(m, v, v === 'u_shape' ? 2.8 : 2.3), 0, 0.6); cam = [24, 20]; break;
		case 'armchair_type': at2(armchair(m, v), 0, 0.7, 0.35); cam = [26, 14]; break;
		case 'coffee_table': at2(coffeeTable(m, v), 0, 1); cam = [24, 30]; break;
		case 'media_wall': at2(mediaWall(m, v, 2.6, 2.6)); cam = [22, 10]; break;
		case 'dining_table': at2(diningTable(m, v, 1.8), 0, 0.9); vase(g, m, 0, v === 'glass' ? 0.743 : 0.75, 0.9, 1.1); cam = [24, 24]; break;
		case 'dining_chairs': at2(diningChair(m, v), 0, 0.6, 0.5); cam = [30, 12]; break;
		case 'bar_stools': at2(barStool(m, v), 0, 0.6, 0.5); cam = [30, 12]; break;
		case 'bed_type': at2(bed(m, v, true), 0, 1.07); cam = [30, 24]; opt.room = 'master'; break;
		case 'wardrobe_type': at2(wardrobe(m, v, 2.0, 2.4), 0, 0.31); cam = [22, 8]; opt.room = 'master'; break;
		case 'rug_tone': v = pick(cIn, 'rug_style'); if (v === 'none') { v = 'plain'; } at2(rug(m, v, 2.4, 1.7), 0, 1.2); at2(coffeeTable(m, 'wood'), 0.3, 1.1).scale.setScalar(0.7); cam = [18, 42]; break;
		case 'rug_style': at2(rug(m, v, 2.4, 1.7), 0, 1.2); at2(coffeeTable(m, 'wood'), 0.3, 1.1).scale.setScalar(0.7); cam = [18, 42]; break;
		case 'art_style': at2(artwork(m, v, 1.3)); var cs = G(); RB(cs, -0.7, 0.75, 0, 0.7, 0.8, 0.35, 0.005, m.wood, 1); [-0.65, 0.65].forEach(function (x) { BX(cs, x - 0.02, 0, 0.02, x + 0.02, 0.75, 0.33, m.wood); }); vase(cs, m, 0.45, 0.8, 0.18, 1); at2(cs); cam = [10, 6]; break;
		case 'plants': at2(plant(m, v, 1.1), 0, 0.6); cam = [18, 10]; break;
		case 'pendant_style': opt.ceiling = 2.6; at2(pendant(m, v, 2.6, 1.0), 0, 1.0); cam = [18, 4]; break;
		case 'floor_lamp': at2(floorLamp(m, v), v === 'arc' ? -0.6 : 0, 0.5); cam = [20, 8]; break;
		case 'fireplace': at2(fireplace(m, v, 2.6)); cam = [24, 10]; break;
		case 'ceiling': case 'ceiling_lights': {
			var Hc = 2.7, sc = G(), tp = f === 'ceiling' ? v : (c.ceiling || 'flat'), lt = f === 'ceiling_lights' ? v : 'none';
			ceiling(sc, m, tp, 4, 3, Hc, lt, true);
			sc.position.set(-2, 0, 0); g.add(sc); opt.left = -2; opt.wall = true; opt.ceiling = tp === 'vaulted' ? null : Hc + 0.004; cam = [35, -32];
			var fb = new THREE.Mesh(L.boxGeo(3.6, 0.4, 2.6), new THREE.MeshBasicMaterial({ visible: false })); fb.position.set(0, Hc - 0.2, 1.3); g.add(fb);
			break;
		}
		case 'door_style': case 'window_treatment': case 'wall_finish': case 'curtain_fabric': case 'curtain_tone': case 'thresholds': {
			var wl = G(), Hw = 2.7, wallC = L.col(c.wall_color, '#F2EFEA'), wm = L.solid(wallC, 0.92), s = new THREE.Shape(); s.moveTo(-2, 0); s.lineTo(2, 0); s.lineTo(2, Hw); s.lineTo(-2, Hw); s.lineTo(-2, 0);
			if (f === 'door_style' || f === 'thresholds') { if (f === 'thresholds') { v = pick(cIn, 'door_style'); if (c.thresholds !== 'none') { var thr = threshold(m, c.thresholds, 0.94); thr.position.x = -0.47; wl.add(thr); } } var hp = new THREE.Path(), arch = v === 'arched', dw = 0.9, dh = arch ? 2.3 : 2.1; hp.moveTo(-0.45, 0); hp.lineTo(0.45, 0); if (arch) { hp.lineTo(0.45, dh - 0.45); hp.absarc(0, dh - 0.45, 0.45, 0, Math.PI, false); } else { hp.lineTo(0.45, dh); hp.lineTo(-0.45, dh); } hp.lineTo(-0.45, 0); s.holes.push(hp); add(wl, doorPiece(m, v, -0.45, dw, dh, wm)); BX(wl, -0.47, 0, -0.25, -0.45, dh, 0, wm); BX(wl, 0.45, 0, -0.25, 0.47, dh, 0, wm); BX(wl, -0.45, -0.01, -0.6, 0.45, 0.0, 0, L.roomFloorMat(c, 'parquet')); if (!arch) { BX(wl, -0.45, dh, -0.25, 0.45, dh + 0.02, 0, wm); } cam = f === 'thresholds' ? [24, 24] : [26, 4]; }
			else if (f === 'window_treatment' || f === 'curtain_fabric' || f === 'curtain_tone') { if (f !== 'window_treatment') { v = 'drapes'; } var wp = new THREE.Path(); wp.moveTo(-0.7, 0.6); wp.lineTo(0.7, 0.6); wp.lineTo(0.7, 2.2); wp.lineTo(-0.7, 2.2); wp.lineTo(-0.7, 0.6); s.holes.push(wp); var fmm = L.frameMat(c); [[-0.7, 0.6, 0.7, 0.66], [-0.7, 2.14, 0.7, 2.2], [-0.7, 0.6, -0.64, 2.2], [0.64, 0.6, 0.7, 2.2], [-0.03, 0.6, 0.03, 2.2]].forEach(function (q) { BX(wl, q[0], q[1], -0.16, q[2], q[3], -0.08, fmm); }); add(wl, at(M(L.boxGeo(1.3, 1.5, 0.01), glass('#BFD6E2', 0.35), false), 0, 1.4, -0.13)); BX(wl, -0.76, 0.57, -0.02, 0.76, 0.62, 0.2, L.solid('#ECE9E3', 0.6)); add(wl, windowDressing(m, v, -0.7, 0.7, 0.6, 2.2, Hw)); cam = [20, 4]; }
			else { featureWall(wl, m, v, -2, 2, Hw, wallC); if (v === 'limewash') { wm = L.pbr('render', { color: wallC, texture: 'coarse' }, { normal: 0.5 }); } var sf = sofa(m, 'straight', 2.0); sf.position.set(0, 0, 0.55); sf.scale.setScalar(0.9); wl.add(sf); cam = [16, 8]; }
			var wmesh = new THREE.Mesh(new THREE.ShapeGeometry(s, 24), wm); wmesh.receiveShadow = true; wl.add(wmesh); g.add(wl); opt.wall = false;
			var fb2 = new THREE.Mesh(L.boxGeo(2.6, 2.4, 0.6), new THREE.MeshBasicMaterial({ visible: false })); fb2.position.set(0, 1.3, 0.3); g.add(fb2);
			break;
		}
		case 'vehicles': {
			var paint = L.col(c.car_color, '#3C4148'), vh = v === 'motorcycle' ? motorcycle(m, paint) : (v === 'bicycle' ? bicycle(m, paint) : vehicle(m, v, paint));
			at2(vh, 0, 1.2, 0.5); if (v === 'electric') { var wbx = wallbox(m); wbx.position.set(-1.2, 0, 0); g.add(wbx); }
			opt.floor = L.pbr('pavers', { color: '#B4ADA2' }, { normal: 1 }); opt.wall = v === 'electric'; cam = v === 'motorcycle' || v === 'bicycle' ? [30, 10] : [32, 14]; break;
		}
		case 'people': {
			var grp2 = { none: [], couple: [['man', 'stand', -0.35, 0.2], ['woman', 'stand', 0.35, 0.1]], family: [['man', 'stand', -0.6, 0], ['woman', 'stand', 0.05, 0.1], ['child', 'stand', 0.55, 0.3], ['child', 'walk', -0.15, 0.55]], guests: [['man', 'stand', -0.9, 0], ['woman', 'stand', -0.3, 0.25], ['man', 'walk', 0.3, 0], ['woman', 'stand', 0.9, 0.2]] }[v] || [];
			if (!grp2.length) { at2(sofa(m, 'straight', 2.0), 0, 0.6); cam = [24, 16]; break; }
			grp2.forEach(function (q, i) { at2(person(m, q[0], q[1], 3 + i * 5), q[2], 0.6 + q[3], -0.15 + i * 0.1); }); cam = [14, 6]; break;
		}
		case 'pets': {
			if (v === 'cat') { at2(cat(m, 11, 'sit'), 0, 0.6, 0.6); at2(petBed(m), 0.55, 0.5); cam = [22, 10]; }
			else { at2(dog(m, v === 'dog_small' ? 'small' : 'large', 5, 'stand'), 0, 0.7, -0.6); if (v === 'dog_large') { at2(kennel(m), -1.0, 0.0, 0.3); } cam = [22, 10]; }
			opt.floor = L.pbr('grass', {}, { normal: 1 }); opt.wall = false; break;
		}
		case 'tree_types': {
			hs.plant(v, 0, 0, { maple: 2.6, palm: 4.2, fruit: 3.4, olive: 3.2, cypress: 4.0 }[v] || 4.6, 17);
			var tr = hs.root.children[hs.root.children.length - 1]; hs.root.remove(tr); g.add(tr);
			opt.floor = L.pbr('grass', {}, { normal: 1 }); opt.wall = false; cam = [16, 4]; break;
		}
		case 'balcony_type': { at2(balconyItem(m, v)); cam = [30, 12]; opt.wall = false; opt.floor = L.pbr('pavers', { color: '#B4ADA2' }, { normal: 1 }); break; }
		case 'extra_furniture': {
			var xp = extraPiece(m, v); at2(xp, 0, 0.02);
			cam = { bookshelf: [22, 8], vitrine: [22, 8], floor_mirror: [26, 8], piano: [28, 12], desk: [30, 16], reading: [28, 14], pouf: [24, 22], bench: [26, 16], bar_cart: [28, 14], plant_stand: [24, 10] }[v] || [26, 12];
			break;
		}
		case 'electronics': {
			if (v === 'tv' || v === 'soundbar' || v === 'speakers' || v === 'console') { at2(mediaWall(m, 'lowboard', 2.2, 2.6)); cam = [22, 10]; }
			else if (v === 'projector') { opt.ceiling = 2.6; var pj2 = electronic(m, 'projector'); pj2.position.set(0, 2.24, 2.0); pj2.rotation.y = Math.PI; g.add(pj2); g.add(electronic(m, 'screen', 2.6)); cam = [20, 6]; }
			else if (v === 'computer' || v === 'laptop') { var dk2 = extraPiece(m, 'desk'); g.add(dk2); var dv = electronic(m, v); dv.position.set(v === 'laptop' ? 0.05 : 0, 0.76, v === 'laptop' ? 0.3 : 0.18); g.add(dv); cam = [24, 18]; }
			else if (v === 'smart_speaker') { var st3 = sideTable(m, false); at2(st3, 0, 0.5); var spk = electronic(m, v); spk.position.set(0, 0.525, 0.5); g.add(spk); cam = [20, 14]; }
			else if (v === 'robot_vacuum') { at2(electronic(m, v), 0.3, 1.55); at2(sofa(m, 'straight', 2.0), 0, 0.5).scale.setScalar(0.85); cam = [26, 24]; }
			else { g.add(electronic(m, v)); var pf = new THREE.Mesh(L.boxGeo(0.8, 0.8, 0.2), new THREE.MeshBasicMaterial({ visible: false })); pf.position.set(0, 1.45, 0.1); g.add(pf); cam = [14, 4]; }
			break;
		}
		case 'stair_type': { var st = stairs(m, v, 1.0, 2.7, 3.0); if (v === 'spiral') { st.position.set(0, 0, 1.1); } else { st.rotation.y = -Math.PI / 2; st.position.set(1.5, 0, 0.02); } g.add(st); cam = [36, 18]; break; }
		case 'bathtub_type': at2(bathtub(m, v), 0, 0.5); cam = [26, 24]; break;
		case 'shower_type': case 'bath_tiles': { var sh = shower(m, f === 'shower_type' ? v : 'walkin', 1.1, 1.0, 2.6, L.bathTileMat(c)); sh.position.set(-0.55, 0, 0); g.add(sh); opt.left = -0.55; cam = [32, 14]; break; }
		case 'basin_type': at2(vanity(m, pick(cIn, 'vanity_type'), v, 1, 0.9)); cam = [24, 22]; break;
		case 'vanity_type': at2(vanity(m, v, pick(cIn, 'basin_type'), 1, 1.0)); cam = [24, 16]; break;
		case 'toilet_type': at2(toilet(m, v)); cam = [34, 20]; break;
		case 'mirror_type': at2(bathMirror(m, v, 0.8)); at2(vanity(m, 'floating', 'vessel', 1, 0.8)); cam = [14, 6]; break;
		case 'taps': { var tv = G(); RB(tv, -0.4, 0.82, 0, 0.4, 0.85, 0.5, 0.004, m.stone, 1); LA(tv, [[0, 0], [0.09, 0], [0.18, 0.04], [0.21, 0.13], [0.2, 0.135], [0.17, 0.05], [0.07, 0.025], [0, 0.025]], ceramicDS(), 0.05, 0.85, 0.27, 40); mixer(tv, finMat(c), 0.05, 0.85, 0.03, true); RB(tv, -0.4, 0.42, 0, 0.4, 0.82, 0.5, 0.006, lacquer(L.col(c.bath_color, '#D9D4CC'), false), 1); g.add(tv); cam = [30, 18]; break; }
		case 'bath_fixtures': {
			if (v === 'bathtub') { at2(bathtub(m, 'built_in'), 0, 0.42); cam = [26, 26]; }
			else if (v === 'freestanding') { at2(bathtub(m, 'freestanding'), 0, 0.5); cam = [26, 24]; }
			else if (v === 'shower' || v === 'walkin') { var s2 = shower(m, v === 'shower' ? 'enclosure' : 'walkin', 1.0, 1.0, 2.6, L.bathTileMat(c)); s2.position.set(-0.5, 0, 0); g.add(s2); opt.left = -0.5; cam = [32, 14]; }
			else if (v === 'basin' || v === 'double_basin') { at2(vanity(m, pick(cIn, 'vanity_type'), pick(cIn, 'basin_type'), v === 'double_basin' ? 2 : 1, v === 'double_basin' ? 1.4 : 0.9)); cam = [24, 20]; }
			else if (v === 'wc' || v === 'bidet') { at2(toilet(m, pick(cIn, 'toilet_type'), v === 'bidet')); cam = [34, 20]; }
			else { at2(towelRail(m)); cam = [24, 8]; }
			break;
		}
		case 'fronts': case 'handles': case 'worktop': case 'sink': case 'backsplash': case 'upper_cabinets': case 'hood_style': {
			var hood = f === 'hood_style' ? v : 'integrated';
			if (hood === 'island') { var isl = island(m, 1.8, { stools: 'none', hood: 'island', H: 2.6 }); isl.position.set(0, 0, 0.3); g.add(isl); RB(g, -0.3, 0.92, 0.42, 0.3, 0.926, 0.82, 0.004, L.solid('#0E0F10', 0.08, 0.2), 1); opt.ceiling = 2.6; cam = [26, 14]; break; }
			var close = f === 'fronts' || f === 'handles' || f === 'worktop' || f === 'sink', kl = close ? 1.25 : 2.0;
			var kr = kitchenRun(m, kl, { H: 2.6, uppers: f === 'upper_cabinets' || f === 'hood_style' ? (f === 'upper_cabinets' ? v : 'closed') : (f === 'backsplash' ? 'none' : 'closed'), sink: f === 'fronts' || f === 'handles' ? undefined : (close ? 0.4 : 0.55), hob: f === 'sink' || f === 'fronts' || f === 'handles' ? undefined : (close ? 0.95 : 1.45), hood: hood, decor: !close, splash: !close });
			kr.position.set(-kl / 2, 0, 0); g.add(kr);
			cam = f === 'sink' || f === 'worktop' ? [20, 34] : (close ? [26, 10] : [22, 12]);
			break;
		}
		case 'furniture_style': { var lv = sofa(m, 'straight', 1.7); lv.position.set(-0.3, 0, 0.5); g.add(lv); var stb = sideTable(m, true); stb.position.set(0.85, 0, 0.4); g.add(stb); var chr = diningChair(m, 'upholstered'); chr.position.set(1.3, 0, 1.3); chr.rotation.y = -0.8; g.add(chr); cam = [24, 14]; break; }
		// ---- 1.9.0: the cards of the newer fields show what they are about, never a stand-in sofa
		case 'radiators': {
			var rtp = v === 'auto' ? 'panel' : v;
			if (rtp === 'none') { at2(wallPanelCard(m, 1.4, 1.1), 0, 0.2); cam = [16, 10]; break; }
			at2(wallPanelCard(m, 1.5, 1.2), 0, 0.1);
			var rad1 = radiator(m, rtp, rtp === 'towel' ? 0.6 : 1.1, 0.6); rad1.position.set(0, 0, 0.14); g.add(rad1);
			cam = [16, 12]; break;
		}
		case 'door_frame': {
			at2(doorCard(m, c, v), 0, 0.1); cam = [14, 8]; break;
		}
		case 'basement_type': {
			at2(basementCard(m, v || 'partial'), 0, 0.2); cam = [26, 22]; break;
		}
		case 'attic_use': {
			at2(atticCard(m, v || 'storage'), 0, 0.3); cam = [24, 18]; break;
		}
		case 'aquarium_shape': {
			at2(aquarium(m, v || 'large', c.aquarium_water, v === 'small' ? 0.8 : 1.3), 0, 0.3); cam = [22, 16]; break;
		}
		case 'kids_theme': {
			at2(kidsCard(m, c, v || 'neutral'), 0, 0.4); cam = [24, 18]; opt.room = 'kids'; break;
		}
		default:
			// no scene of its own: a plain backdrop instead of a sofa that has nothing to do with the field
			if (f) { try { console.warn('AGH: nincs kártyajelenet ehhez a mezőhöz: ' + f); } catch (e2) {} }
			at2(wallPanelCard(m, 1.6, 1.3), 0, 0.1); cam = [16, 10];
	}
	studio(hs, c, m, opt);
	hs.room = { kind: 'item', cam: cam };
	void o;
	return hs;
}
