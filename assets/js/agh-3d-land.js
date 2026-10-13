/*!
 * AutoGroweHome – 3D surroundings: terrain, landscape, street and neighbourhood (three.js r170)
 * Koltai Norbert – Infostudio
 *
 * The house stands on a level site; around it the land follows the chosen landscape – or the one that
 * suits the architectural style: a suburban street, open fields, rolling hills, an alpine valley, the
 * edge of a forest, a lake shore or a sea coast. A heightfield carries fields, hedgerows, rock, snow,
 * beaches and water; woods of the matching species stand on it; a street runs in front of the plot,
 * and the neighbouring houses belong to the same style family without copying the visitor's house.
 *
 * Coordinates as in agh-3d.js: three.js x to the right, y up, z towards the street (the viewer);
 * the sketch helpers (box, House) take sketch metres (x, y towards the street, z up).
 */
import * as THREE from './vendor/three/three.module.min.js';

var L = null;
export function setup(lib) { L = lib; }

/* ------------------------------------------------------------------ noise */
function hash2(ix, iy, s) {
	var h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 1442695041)) | 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
	return (h >>> 0) / 4294967295;
}
function vnoise(x, y, s) {
	var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
	var a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
	return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function fbm(x, y, oct, s) { var v = 0, a = 0.5, f = 1, n = 0; for (var i = 0; i < oct; i++) { v += a * vnoise(x * f, y * f, s + i * 17); n += a; a *= 0.5; f *= 2.03; } return v / n; }
// sharp ridges for mountains
function ridge(x, y, oct, s) { var v = 0, a = 0.5, f = 1, n = 0, w = 1; for (var i = 0; i < oct; i++) { var r = 1 - Math.abs(vnoise(x * f, y * f, s + i * 31) * 2 - 1); r *= r; v += a * r * w; w = Math.min(1, r * 1.7); n += a; a *= 0.5; f *= 2.1; } return v / n; }
function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function rng(seed) { var s = (seed % 2147483646) + 1; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function lin(v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
function linC(r, g, b) { return [lin(r), lin(g), lin(b)]; }

/* ------------------------------------------------------------------ landscapes */
// hill: rolling relief near the plot (m); far / farR: the ring of hills or mountains and where it peaks;
// tree: species mix of the woods; n: number of trees; near: where the woods begin; fields: share of
// farmland; rock / snow: bare rock on steep or high ground and the snow line; lake / sea: water.
var P = {
	suburb: { hill: 3, far: 45, farR: 650, tree: ['broad', 'broad', 'conifer'], n: 560, near: 95, fields: 0.3 },
	plain: { hill: 4, far: 30, farR: 760, tree: ['broad', 'broad', 'poplar'], n: 480, near: 105, fields: 1 },
	hills: { hill: 26, far: 90, farR: 560, tree: ['broad', 'broad', 'conifer'], n: 760, near: 100, fields: 0.7 },
	mountains: { hill: 34, far: 520, farR: 980, tree: ['conifer', 'conifer', 'conifer', 'broad'], n: 1100, near: 95, rock: 1, snow: 360 },
	forest: { hill: 12, far: 70, farR: 620, tree: ['conifer', 'broad', 'conifer', 'birch'], n: 1400, near: 72, fields: 0 },
	lake: { hill: 16, far: 120, farR: 560, tree: ['conifer', 'conifer', 'birch'], n: 1000, near: 88, lake: [-170, -280, 150] },
	sea: { hill: 22, far: 95, farR: 560, tree: ['olive', 'olive', 'cypress'], n: 560, near: 88, sea: 235, dry: 1 },
	// 1.8.0: further places to put the house
	vineyard: { hill: 24, far: 110, farR: 600, tree: ['olive', 'broad', 'cypress'], n: 420, near: 110, fields: 0.95, dry: 0.6 },
	farmstead: { hill: 3, far: 22, farR: 800, tree: ['poplar', 'broad', 'poplar'], n: 260, near: 120, fields: 1 },
	river: { hill: 10, far: 60, farR: 640, tree: ['broad', 'poplar', 'birch'], n: 900, near: 85, lake: [-120, -330, 230] },
	valley: { hill: 30, far: 180, farR: 560, tree: ['conifer', 'broad', 'birch'], n: 1050, near: 80, lake: [-60, -300, 70] },
	alpine_forest: { hill: 32, far: 430, farR: 940, tree: ['conifer', 'conifer', 'conifer', 'birch'], n: 1500, near: 70, rock: 0.8, snow: 420 },
	puszta: { hill: 2, far: 16, farR: 820, tree: ['broad', 'poplar'], n: 120, near: 150, fields: 1, dry: 0.8 },
	town: { hill: 2, far: 25, farR: 700, tree: ['broad', 'broad', 'conifer'], n: 300, near: 120, fields: 0 },
	desert: { hill: 14, far: 140, farR: 700, tree: ['olive', 'cypress'], n: 90, near: 130, rock: 0.7, dry: 1 },
	snowy: { hill: 20, far: 260, farR: 760, tree: ['conifer', 'conifer', 'birch'], n: 900, near: 90, snow: 10, rock: 0.5 }
};
// the landscape that suits the style when the visitor has not chosen one
var STYLE_LAND = { cube_house: 'suburb', folk_house: 'farmstead', wine_cellar: 'vineyard', midcentury: 'suburb', us_modern: 'suburb', desert_modern: 'desert', modern_minimal: 'suburb', contemporary_lux: 'hills', mediterranean: 'sea', scandinavian: 'lake', bauhaus: 'suburb', japandi: 'hills', classic_burgher: 'suburb', rustic: 'farmstead', modern_farmhouse: 'plain', american_farm: 'plain', alpine: 'mountains', industrial: 'suburb', organic_modern: 'forest', high_tech: 'suburb', passive: 'forest' };
export function landKind(c) { var k = c.landscape || 'auto'; return P[k] ? k : (STYLE_LAND[c.arch_style] || 'hills'); }
export var WATER_Y = -1.0;
// the street in front of the plot (sketch y of its near edge; set by the viewer per house)
var ROAD = 26;

// Terrain height (m) at three.js x, z. Level around the plot and along the street; hills, mountains,
// lake basin and coast further out. The street side stays lower, so the view from it is open.
export function heightAt(k, x, z) {
	var p = P[k] || P.hills, r = Math.sqrt(x * x + z * z);
	var flat = smooth(70, 170, r) * smooth(22, 70, Math.abs(z - ROAD - 6));
	if (flat <= 0 && !p.sea && !p.lake) { return 0; }
	var front = z > 0 ? 1 - 0.55 * smooth(0, 1, z / Math.max(r, 1)) : 1;
	var h = p.hill * (fbm(x / 230 + 11, z / 230 + 5, 4, 3) - 0.38) * 2;
	var ring = smooth(p.farR * (p.rock ? 0.36 : 0.42), p.farR, r);
	if (ring > 0) { h += p.far * ring * front * (p.rock ? ridge(x / 520 + 3, z / 520 + 1, 5, 7) * 1.25 : fbm(x / 420 + 3, z / 420 + 9, 4, 7)); }
	h *= flat;
	if (p.lake) { var d = Math.hypot(x - p.lake[0], z - p.lake[1]); h += (-6 - h) * (1 - smooth(p.lake[2] * 0.72, p.lake[2] * 1.3, d)); }
	if (p.sea) { var shore = p.sea + 45 * Math.sin(x / 170) + 22 * Math.sin(x / 61 + 1); h += (-9 - h) * smooth(shore - 70, shore + 30, -z); }
	return h;
}

// How much the lake or the sea shapes the ground here (0 inland, 1 in the water): beaches follow it.
function wetAt(k, x, z) {
	var p = P[k] || {}, w = 0;
	if (p.lake) { w = Math.max(w, 1 - smooth(p.lake[2] * 0.72, p.lake[2] * 1.3, Math.hypot(x - p.lake[0], z - p.lake[1]))); }
	if (p.sea) { var shore = p.sea + 45 * Math.sin(x / 170) + 22 * Math.sin(x / 61 + 1); w = Math.max(w, smooth(shore - 70, shore + 30, -z)); }
	return w;
}

/* ------------------------------------------------------------------ terrain */
var GEO = {};
// The ground: 2.4 km square heightfield (10 m cells). Its "tint" attribute carries per vertex either a
// multiplier of the grass texture (alpha 0) or an own colour – crops, ploughland, rock, snow, sand –
// that keeps only the texture's light and shade (alpha 1).
export function terrainGeo(k, season) {
	var key = k + '|' + (season || 'summer');
	if (GEO[key]) { return GEO[key]; }
	var p = P[k] || P.hills, size = 2400, seg = 240;
	var g = new THREE.PlaneGeometry(size, size, seg, seg);
	g.rotateX(-Math.PI / 2);
	var pos = g.attributes.position, uv = g.attributes.uv, n = pos.count, i;
	for (i = 0; i < n; i++) {
		var x = pos.getX(i), z = pos.getZ(i);
		pos.setY(i, heightAt(k, x, z));
		uv.setXY(i, x, -z);
	}
	g.computeVertexNormals();
	var nor = g.attributes.normal, tint = new Float32Array(n * 4), winter = season === 'winter';
	var ROCK = linC(0.5, 0.49, 0.46), SNOW = linC(0.93, 0.94, 0.97), SAND = linC(0.84, 0.77, 0.6), MUD = linC(0.42, 0.39, 0.31), SOIL = linC(0.42, 0.32, 0.23);
	var CROP = {
		summer: [null, linC(0.8, 0.69, 0.36), [0.82, 1.06, 0.78], SOIL, linC(0.72, 0.64, 0.38)],
		spring: [null, linC(0.88, 0.82, 0.24), [0.86, 1.1, 0.8], SOIL, [0.95, 1.12, 0.85]],
		autumn: [null, linC(0.66, 0.56, 0.37), SOIL, linC(0.5, 0.38, 0.27), [0.92, 0.95, 0.85]]
	}[season || 'summer'] || null;
	var ca = Math.cos(0.42), sa = Math.sin(0.42);
	for (i = 0; i < n; i++) {
		var X = pos.getX(i), Y = pos.getY(i), Z = pos.getZ(i), R = Math.sqrt(X * X + Z * Z), slope = 1 - nor.getY(i);
		// meadow: soft large patches of lighter and darker grass (as before)
		var nn = 0.5 + 0.25 * Math.sin(X * 0.11 + Math.sin(Z * 0.07) * 2) + 0.2 * Math.sin(Z * 0.13 + Math.cos(X * 0.05) * 3) + 0.1 * Math.sin((X + Z) * 0.31);
		var kk = 0.78 + nn * 0.32, col = [kk * (0.97 + nn * 0.06), kk, kk * (0.95 - nn * 0.05)], a = 0;
		if (p.dry && !winter) { var dd = 0.5 + 0.5 * fbm(X / 90, Z / 90, 3, 5); col = [col[0] * (1.05 + dd * 0.25), col[1] * (0.98 + dd * 0.08), col[2] * (0.8 - dd * 0.1)]; }
		// farmland: a patchwork of parcels with hedgerows, beyond the neighbourhood
		var fw = (p.fields || 0) * smooth(115, 170, R) * (1 - smooth(0.12, 0.3, slope));
		if (fw > 0 && CROP && !winter && Y > 0.5) {
			var u = X * ca - Z * sa, v = X * sa + Z * ca, pu = Math.floor(u / 74), pv = Math.floor(v / 118 + hash2(pu, 3, 9) * 0.9);
			var t = hash2(pu, pv, 5), crop = CROP[t < 0.34 ? 0 : (t < 0.58 ? 1 : (t < 0.78 ? 2 : (t < 0.9 ? 3 : 4)))];
			var eu = Math.abs((u / 74) - Math.round(u / 74)) * 74, ev = Math.abs((v / 118 + hash2(pu, 3, 9) * 0.9) - Math.round(v / 118 + hash2(pu, 3, 9) * 0.9)) * 118;
			if (crop) {
				var stripe = 0.94 + 0.06 * Math.sin(u * 1.9);
				if (crop.length === 3 && crop[0] < 0.7 && crop !== CROP[2] && crop !== CROP[4]) { col = [crop[0] * stripe, crop[1] * stripe, crop[2] * stripe]; a = fw; }
				else { col = [col[0] * crop[0], col[1] * crop[1], col[2] * crop[2]]; }
			}
			if (Math.min(eu, ev) < 2.2) { col = [col[0] * 0.62, col[1] * 0.72, col[2] * 0.55]; a *= 0.3; }
		}
		// rock on steep and high ground, snow above the snow line (lower in winter, none in a mild summer)
		var rk = p.rock ? Math.max(smooth(0.16, 0.36, slope), smooth(230, 330, Y) * 0.75) : smooth(0.3, 0.55, slope) * 0.8;
		if (rk > 0) { col = [col[0] + (ROCK[0] - col[0]) * rk, col[1] + (ROCK[1] - col[1]) * rk, col[2] + (ROCK[2] - col[2]) * rk]; a = Math.max(a, rk); }
		if (p.snow) {
			var line = p.snow - (winter ? 200 : (season === 'summer' ? -40 : 0)) + (fbm(X / 60, Z / 60, 3, 8) - 0.5) * 60;
			var sn = smooth(line - 15, line + 25, Y) * (1 - smooth(0.62, 0.85, slope) * 0.6);
			if (sn > 0) { col = [col[0] + (SNOW[0] - col[0]) * sn, col[1] + (SNOW[1] - col[1]) * sn, col[2] + (SNOW[2] - col[2]) * sn]; a = Math.max(a, sn); }
		}
		// shores: a sandy beach down to the water, mud below it
		if (p.lake || p.sea) {
			var sb = smooth(0.01, 0.12, wetAt(k, X, Z)) * (1 - smooth(p.sea ? 1.6 : 0.6, p.sea ? 3.2 : 1.6, Y));
			if (sb > 0 && !winter) { col = [col[0] + (SAND[0] - col[0]) * sb, col[1] + (SAND[1] - col[1]) * sb, col[2] + (SAND[2] - col[2]) * sb]; a = Math.max(a, sb); }
			if (Y < -1.5 && wetAt(k, X, Z) > 0.2) { col = MUD.slice(); a = 1; }
		}
		tint[i * 4] = col[0]; tint[i * 4 + 1] = col[1]; tint[i * 4 + 2] = col[2]; tint[i * 4 + 3] = winter ? 0 : a;
	}
	g.setAttribute('tint', new THREE.BufferAttribute(tint, 4));
	g.computeBoundingSphere();
	g.userData.shared = true;
	GEO[key] = g;
	return g;
}
// The ground material: the meadow (or snow) texture, tinted per vertex as described above.
var TMAT = {};
export function terrainMat(c) {
	var base = L.groundKind(c, 'meadow'), winter = c.season === 'winter', key = base.userData.key + '|terrain';
	if (TMAT[key]) { return TMAT[key]; }
	var m = base.clone(), lum = winter ? 0.82 : 0.12;
	m.onBeforeCompile = function (sh) {
		sh.uniforms.aghLum = { value: lum };
		sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 tint;\nvarying vec4 vTint;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvTint = tint;');
		sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vTint;\nuniform float aghLum;').replace('#include <map_fragment>', [
			'#ifdef USE_MAP',
			'vec4 sampledDiffuseColor = texture2D( map, vMapUv );',
			'float aghL = clamp( dot( sampledDiffuseColor.rgb, vec3( 0.3, 0.59, 0.11 ) ) / aghLum, 0.6, 1.4 );',
			'diffuseColor.rgb *= mix( sampledDiffuseColor.rgb * vTint.rgb, vTint.rgb * aghL, vTint.a );',
			'#endif'
		].join('\n'));
	};
	m.customProgramCacheKey = function () { return 'aghTerrain' + lum; };
	m.userData.key = key;
	TMAT[key] = m;
	return m;
}
// Lake or sea: a calm, reflecting water surface at WATER_Y.
export function water(k) {
	var p = P[k] || {};
	if (!p.lake && !p.sea) { return null; }
	var mat = L.cached('landwater' + k, function () { return L.stdMat({ color: p.sea ? '#2A6478' : '#2F5A62', roughness: 0.07, metalness: 0.05, envMapIntensity: 1.25 }); });
	var geo = p.sea ? new THREE.PlaneGeometry(7000, 3400) : new THREE.CircleGeometry(p.lake[2] * 1.35, 64);
	geo.rotateX(-Math.PI / 2);
	var w = new THREE.Mesh(geo, mat);
	if (p.sea) { w.position.set(0, WATER_Y, -p.sea - 1700 + 60); } else { w.position.set(p.lake[0], WATER_Y, p.lake[1]); }
	w.receiveShadow = false;
	return w;
}

/* ------------------------------------------------------------------ woods */
// Trees of the landscape's species on the terrain: woods in patches (and hedgerow lines among the fields),
// none on water, rock or snow, the street side kept open. Instanced: one draw call per species.
export function woods(c, k, thumb) {
	var p = P[k] || P.hills, g = new THREE.Group(), r = rng(77 + k.length * 131), want = Math.round(p.n * (thumb ? 0.3 : 1));
	var by = {}, ca = Math.cos(0.42), sa = Math.sin(0.42);
	p.tree.forEach(function (t) { by[t] = []; });
	for (var i = 0; i < want * 4 && Object.keys(by).reduce(function (s, t) { return s + by[t].length; }, 0) < want; i++) {
		var a = r() * Math.PI * 2, d = p.near + Math.pow(r(), 1.5) * 560, x = Math.cos(a) * d, z = Math.sin(a) * d;
		if (z > ROAD - 10 && Math.abs(x) < 140 && r() < 0.88) { continue; }
		if (Math.abs(z - ROAD - 6) < 14) { continue; }
		var hedge = false;
		if (p.fields && d > 115) {
			// among the fields trees stand along the hedgerows only
			var u = x * ca - z * sa, v = x * sa + z * ca, pu = Math.floor(u / 74), off = hash2(pu, 3, 9) * 0.9;
			var eu = Math.abs((u / 74) - Math.round(u / 74)) * 74, ev = Math.abs((v / 118 + off) - Math.round(v / 118 + off)) * 118;
			hedge = Math.min(eu, ev) < 3;
			if (!hedge && r() < p.fields * 0.92) { continue; }
		}
		if (!hedge && fbm(x / 170, z / 170, 3, 21) < (k === 'forest' ? 0.3 : 0.47) && r() < 0.85) { continue; }
		var h = heightAt(k, x, z);
		if (h < WATER_Y + 0.6 || (p.rock && h > 300) || (p.snow && h > p.snow - 30)) { continue; }
		var t = p.tree[Math.floor(r() * p.tree.length)];
		by[t].push([x, h, z, r(), r()]);
	}
	var list = [];
	Object.keys(by).forEach(function (t) { by[t].forEach(function (q5) { list.push([q5[0], q5[1], q5[2], t, q5[3], q5[4]]); }); });
	g.add(treeSet(c, list));
	return g;
}
// Light trees for the distance, the street and the neighbours' gardens: a leaf-card crown and a trunk,
// instanced – one draw call per species. list: [x, ground y, z, species, size 0–1, turn 0–1] (three.js).
var TRUNK = null;
var FARGEO = {};
function farGeo(shape) {
	if (!FARGEO[shape]) {
		var g = shape === 'cone' ? new THREE.ConeGeometry(0.55, 2, 7, 1) : (shape === 'column' ? new THREE.CylinderGeometry(0.22, 0.3, 2, 7, 1) : new THREE.IcosahedronGeometry(0.85, 1));
		g.userData.shared = true; FARGEO[shape] = g;
	}
	return FARGEO[shape];
}
// distant crowns: plain foliage colour of the season (leaf cards turn to noise at that distance)
var FARCOL = {
	summer: { broad: '#4A6331', conifer: '#2E4229', olive: '#6C7856' }, spring: { broad: '#5D8638', conifer: '#33492C', olive: '#728058' },
	autumn: { broad: ['#9A7A33', '#A25A2A', '#6F6E31', '#8C6A2B'], conifer: '#33452C', olive: '#6C7856' }, winter: { broad: '#6B6157', conifer: '#3A4A35', olive: '#6C7856' }
};
export function treeSet(c, list) {
	var g = new THREE.Group(), by = {}, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), V = THREE.Vector3, season = c.season || 'summer';
	if (!TRUNK) { TRUNK = new THREE.CylinderGeometry(0.16, 0.26, 1, 6); TRUNK.userData.shared = true; }
	list.forEach(function (t) { var far = t[0] * t[0] + t[2] * t[2] > 150 * 150; (by[t[3] + (far ? '|far' : '')] = by[t[3] + (far ? '|far' : '')] || []).push(t); });
	var bark = L.solid('#4A3B2E', 1), winter = season === 'winter', col = new THREE.Color();
	Object.keys(by).forEach(function (key) {
		var items = by[key], t = key.split('|')[0], far = key.indexOf('|far') !== -1;
		var shape = t === 'conifer' ? 'cone' : (t === 'cypress' || t === 'poplar' || t === 'columnar' ? 'column' : 'sphere');
		var leaf = t === 'conifer' || t === 'cypress' ? 'conifer' : (t === 'olive' ? 'olive' : 'broad'), fc = (FARCOL[season] || FARCOL.summer)[leaf];
		var crowns = far ? new THREE.InstancedMesh(farGeo(shape), L.cached('farleaf', function () { return L.stdMat({ color: '#FFFFFF', roughness: 0.95 }); }), items.length)
			: new THREE.InstancedMesh(L.canopyGeo(shape, t === 'conifer' ? 64 : 48, t.length), L.leafMat(c, leaf, false), items.length);
		var trunks = far ? null : new THREE.InstancedMesh(TRUNK, t === 'birch' ? L.solid('#D9D6CF', 0.8) : bark, items.length);
		items.forEach(function (q5, j) {
			var sz = q5[4], H = { conifer: 15 + sz * 13, broad: 9 + sz * 9, birch: 10 + sz * 7, poplar: 16 + sz * 9, olive: 4.5 + sz * 3, cypress: 9 + sz * 6, columnar: 7 + sz * 4, street: 7 + sz * 3 }[t] || 9 + sz * 6, w, cy, ch, tk;
			if (t === 'conifer') { w = H * (0.62 + q5[5] * 0.16); cy = H * 0.55; ch = H * 0.47; tk = 0.25; }
			else if (t === 'cypress') { w = H * 0.5; cy = H * 0.52; ch = H * 0.47; tk = 0.2; }
			else if (t === 'poplar' || t === 'columnar') { w = H * 0.62; cy = H * 0.58; ch = H * 0.42; tk = 0.3; }
			else if (t === 'olive') { w = H * (0.42 + q5[5] * 0.1); cy = H * 0.62; ch = H * 0.32; tk = 0.45; }
			else { w = H * (0.3 + q5[5] * 0.14); cy = H * 0.62; ch = H * 0.36; tk = 0.5; }
			// leafless broadleaves in winter: thinner crowns read as bare branches
			if (winter && leaf === 'broad') { w *= 0.8; ch *= 0.85; }
			q.setFromAxisAngle(new V(0, 1, 0), q5[5] * 6.28);
			m4.compose(new V(q5[0], q5[1] + cy, q5[2]), q, new V(w, ch, w)); crowns.setMatrixAt(j, m4);
			if (far) { col.set(Array.isArray(fc) ? fc[j % fc.length] : fc).multiplyScalar(0.85 + q5[5] * 0.3); crowns.setColorAt(j, col); }
			else { m4.compose(new V(q5[0], q5[1] + H * tk * 0.5 - 0.3, q5[2]), q, new V(t === 'olive' ? 1.6 : 1, H * tk + 0.6, t === 'olive' ? 1.6 : 1)); trunks.setMatrixAt(j, m4); }
		});
		crowns.computeBoundingSphere(); g.add(crowns);
		if (trunks) { trunks.computeBoundingSphere(); g.add(trunks); }
	});
	return g;
}

/* ------------------------------------------------------------------ street */
// Where the street runs: its near edge just beyond the plot (sketch y), so the terrain stays level there.
export function setRoad(y) { ROAD = y; }
// The street in front of the plot: pavements, kerbs, the carriageway with markings, street trees and
// lamp posts in town; a narrower country lane with verges elsewhere. A paved apron joins the driveway.
export function street(c, pb, gp, k, night) {
	var g = new THREE.Group(), town = k === 'suburb', y0 = pb.front, xa = -420, xb = 420;
	var asph = L.groundKind(c, 'asphalt'), pave = L.groundKind(c, 'slabs'), kerb = L.solid('#B9B6B0', 0.8);
	var flat = function (x0, ya, x1, yb, z, mat) { g.add(L.box(x0, ya, z - 0.03, x1, yb, z, mat, { noCast: true })); };
	var line = L.cached('roadline', function () { return L.solid('#E9E7E1', 0.6); });
	if (town) {
		flat(xa, y0, xb, y0 + 2.0, 0.035, pave);
		g.add(L.box(xa, y0 + 2.0, -0.05, xb, y0 + 2.15, 0.1, kerb, { noCast: true }));
		flat(xa, y0 + 2.15, xb, y0 + 9.15, -0.02, asph);
		g.add(L.box(xa, y0 + 9.15, -0.05, xb, y0 + 9.3, 0.1, kerb, { noCast: true }));
		flat(xa, y0 + 9.3, xb, y0 + 11.3, 0.035, pave);
		for (var lx = xa; lx < xb; lx += 9) { g.add(L.box(lx, y0 + 5.6, -0.019, lx + 4.5, y0 + 5.72, -0.016, line, { noCast: true })); }
		// street trees and lamps
		var trees = [], lamp = night ? L.solid('#3A3020', 0.3, 0, { emissive: '#FFD9A0', emissiveIntensity: 5 }) : L.solid('#D8D8D2', 0.3), post = L.solid('#2E3135', 0.4, 0.5);
		for (var sx = -150, i = 0; sx <= 150; sx += 15, i++) {
			var mine = sx > pb.left - 30 && sx < pb.right + 30, facing = sx + 7.5 > pb.left - 14 && sx + 7.5 < pb.right + 14;
			if (!mine) { trees.push([sx, 0, y0 + 1.0, i % 3 === 0 ? 'columnar' : 'street', (i * 7 % 10) / 10, (i * 3 % 10) / 10]); }
			if (!facing) { trees.push([sx + 7.5, 0, y0 + 10.3, i % 4 === 1 ? 'columnar' : 'street', ((i + 3) * 7 % 10) / 10, ((i + 5) * 3 % 10) / 10]); }
			if (i % 2 === 0) {
				var px = sx + 3.5;
				if (!(px > pb.left - 1 && px < pb.right + 1) || i % 4 === 0) {
					g.add(L.box(px - 0.06, y0 + 1.7, 0, px + 0.06, y0 + 1.82, 5.2, post, { noCast: true }));
					g.add(L.box(px - 0.06, y0 + 1.82, 5.1, px + 0.06, y0 + 2.7, 5.2, post, { noCast: true }));
					g.add(L.box(px - 0.12, y0 + 2.5, 4.98, px + 0.12, y0 + 2.9, 5.1, lamp, { noCast: true }));
				}
			}
		}
		g.add(treeSet(c, trees));
	} else {
		flat(xa, y0 + 1.2, xb, y0 + 1.6, 0.012, L.groundKind(c, 'gravel'));
		flat(xa, y0 + 1.6, xb, y0 + 6.4, -0.01, asph);
		flat(xa, y0 + 6.4, xb, y0 + 6.8, 0.012, L.groundKind(c, 'gravel'));
	}
	// the driveway and the garden path reach the street
	if (gp && gp.drive) { flat(gp.drive.x0, gp.drive.y1 - 0.05, gp.drive.x1, y0 + (town ? 2.05 : 1.65), 0.025, L.groundKind(c, { gravel: 'gravel', grass: 'grasspavers', asphalt: 'asphalt' }[c.driveway] || 'pavers')); }
	if (gp && gp.path && gp.path.y1 > y0 - 6) { flat(gp.path.x0, gp.path.y1 - 0.05, gp.path.x1, y0 + 0.02, 0.025, pave); }
	g.traverse(function (o) { if (o.isMesh) { o.castShadow = false; } });
	return g;
}

/* ------------------------------------------------------------------ neighbourhood */
// What the street of each style looks like: roofs, facade materials, wall and roof colours, storeys and
// plan shapes. The neighbours draw from this (a different mix per house), never the visitor's own values.
var HOOD = {
	modern_minimal: { roofs: ['flat', 'flat', 'shed', 'gable'], fac: ['render', 'render', 'wood_horizontal', 'concrete'], walls: ['#F4F2EE', '#E6E2DA', '#CFCAC1', '#45484C'], roofC: ['#3A3D40', '#2E3033', '#55585B'], lv: ['single', 'two', 'two'], fp: ['rectangle', 'l_shape', 'staggered'] },
	contemporary_lux: { roofs: ['flat', 'flat', 'hip'], fac: ['render', 'stone', 'wood_horizontal'], walls: ['#F2EFE9', '#E9E3D6', '#D8D2C6'], roofC: ['#3A3D40', '#2E3033'], lv: ['two', 'two', 'single'], fp: ['l_shape', 'staggered', 'rectangle'] },
	mediterranean: { roofs: ['hip', 'gable', 'hip', 'flat'], fac: ['render', 'render', 'stone'], walls: ['#F3E9D7', '#EBD9BC', '#F6F1E7', '#E7C9A2', '#F1DCC4'], roofC: ['#B5653E', '#A85A36', '#C2774B'], lv: ['single', 'two'], fp: ['rectangle', 'l_shape'] },
	scandinavian: { roofs: ['gable', 'gable', 'shed'], fac: ['wood_horizontal', 'board_batten', 'wood', 'render'], walls: ['#2E3236', '#8B2E24', '#E9E6DF', '#5B6670', '#C9B48A'], roofC: ['#2E3033', '#3A3D40'], lv: ['single', 'attic', 'two'], fp: ['rectangle', 'l_shape'] },
	bauhaus: { roofs: ['flat'], fac: ['render', 'render', 'brick'], walls: ['#F4F2EE', '#E6E2DA', '#DCD5C8'], roofC: ['#3A3D40'], lv: ['two', 'single'], fp: ['rectangle', 'staggered', 'l_shape'] },
	japandi: { roofs: ['gable', 'shed', 'flat'], fac: ['wood_horizontal', 'render', 'charred_wood'], walls: ['#E9E4DA', '#D8D0C2', '#3B3936'], roofC: ['#3A3D40', '#2E3033'], lv: ['single', 'two'], fp: ['rectangle', 'l_shape'] },
	classic_burgher: { roofs: ['hip', 'half_hip', 'gable'], fac: ['render', 'render', 'brick'], walls: ['#F1E7D3', '#E8DCC4', '#F4EFE6', '#D9C9A8', '#C9B79A'], roofC: ['#8C4A35', '#7A3F2E', '#3A3D40'], lv: ['two', 'attic', 'two'], fp: ['rectangle', 'l_shape'] },
	rustic: { roofs: ['gable', 'half_hip'], fac: ['render', 'stone', 'wood'], walls: ['#F2EBDD', '#E6DAC3', '#EFE6D2'], roofC: ['#8C4A35', '#9A5A40', '#5A4A42'], lv: ['single', 'attic'], fp: ['rectangle', 'l_shape'] },
	modern_farmhouse: { roofs: ['gable', 'gable'], fac: ['board_batten', 'render', 'wood_horizontal'], walls: ['#F4F2EE', '#2E3236', '#E3DED4'], roofC: ['#2E3033', '#3A3D40'], lv: ['single', 'attic', 'two'], fp: ['rectangle', 'l_shape'] },
	american_farm: { roofs: ['gable', 'gable', 'hip'], fac: ['board_batten', 'wood_horizontal'], walls: ['#F4F2EE', '#E7E3DA', '#9FB0B6', '#C9C2B2'], roofC: ['#3A3D40', '#2E3033', '#5A4A42'], lv: ['two', 'attic'], fp: ['rectangle', 'l_shape'] },
	alpine: { roofs: ['gable', 'gable'], fac: ['wood', 'render', 'stone'], walls: ['#F2EEE6', '#8A6A4C', '#E9E3D6'], roofC: ['#3A3D40', '#5A4A42'], lv: ['attic', 'two'], fp: ['rectangle'] },
	industrial: { roofs: ['flat', 'shed', 'gable'], fac: ['brick', 'metal', 'concrete'], walls: ['#8E5A44', '#5A5D60', '#B9B4AA'], roofC: ['#2E3033', '#3A3D40'], lv: ['two', 'single'], fp: ['rectangle', 'l_shape'] },
	organic_modern: { roofs: ['flat', 'shed', 'gable'], fac: ['wood_horizontal', 'render', 'stone'], walls: ['#E9E3D6', '#D8CFBE', '#C4B59C'], roofC: ['#3A3D40'], lv: ['single', 'two'], fp: ['rectangle', 'l_shape'] },
	high_tech: { roofs: ['flat'], fac: ['metal', 'concrete', 'render'], walls: ['#F4F4F2', '#B9BCBF', '#3E4145'], roofC: ['#2E3033'], lv: ['two', 'single'], fp: ['rectangle', 'staggered'] },
	// 1.8.0 styles: a street of cube houses, a village row, a vineyard hamlet, three American suburbs
	cube_house: { roofs: ['pyramid', 'hip', 'gable'], fac: ['render', 'render', 'brick'], walls: ['#F1E7D3', '#E8DCC4', '#EFE3CE', '#D9C9A8', '#CFE0D6'], roofC: ['#8C4A35', '#7A3F2E', '#9A5A40'], lv: ['attic', 'attic', 'single'], fp: ['rectangle'] },
	folk_house: { roofs: ['gable', 'half_hip'], fac: ['render', 'render', 'stone'], walls: ['#F6F2E8', '#F2EBDD', '#EFE6D2', '#E6DAC3'], roofC: ['#8C4A35', '#9A5A40', '#5A4A42'], lv: ['single', 'attic'], fp: ['rectangle'] },
	wine_cellar: { roofs: ['gable', 'gable', 'half_hip'], fac: ['render', 'stone'], walls: ['#F4EFE2', '#EDE3CE', '#E3D7BE'], roofC: ['#8C4A35', '#7A3F2E'], lv: ['single'], fp: ['rectangle'] },
	midcentury: { roofs: ['flat', 'flat', 'shed'], fac: ['wood_horizontal', 'render', 'stone', 'brick'], walls: ['#E9E3D6', '#D8D2C6', '#C9A57C', '#8FA3A8'], roofC: ['#3A3D40', '#2E3033'], lv: ['single', 'single', 'two'], fp: ['rectangle', 'l_shape', 'staggered'] },
	us_modern: { roofs: ['flat', 'flat', 'shed'], fac: ['render', 'wood_horizontal', 'board_batten'], walls: ['#F4F2EE', '#2E3236', '#E3DED4', '#B9B4AA'], roofC: ['#2E3033', '#3A3D40'], lv: ['two', 'two', 'single'], fp: ['rectangle', 'staggered', 'l_shape'] },
	desert_modern: { roofs: ['flat'], fac: ['render', 'render', 'stone'], walls: ['#F3E9D7', '#EBD9BC', '#E7C9A2', '#D8CFC2'], roofC: ['#C9C4BA', '#B9B4AA'], lv: ['single'], fp: ['rectangle', 'l_shape'] },
	passive: { roofs: ['gable', 'flat', 'shed'], fac: ['render', 'wood_horizontal'], walls: ['#F4F2EE', '#E3DED4', '#C9C2B2'], roofC: ['#3A3D40', '#2E3033'], lv: ['two', 'single'], fp: ['rectangle'] }
};
var TREE_OF = { mediterranean: 'olive', alpine: 'conifer', scandinavian: 'conifer', japandi: 'birch' };
// One neighbour: the visitor's configuration with its own size, storeys, roof, materials and colours.
function variant(c, i, r) {
	var st = HOOD[c.arch_style] ? c.arch_style : 'modern_minimal', H = HOOD[st], pick = function (a, avoid) { var o = a.filter(function (x) { return x !== avoid; }); o = o.length ? o : a; return o[Math.floor(r() * o.length)]; };
	var roof = pick(H.roofs, i % 2 ? c.roof_type : null);
	return Object.assign({}, c, {
		arch_style: st, property_type: 'detached', net_area: Math.round(95 + r() * 110), building_width: 0, building_length: 0, ridge_height: 0,
		levels: pick(H.lv, c.levels), footprint: pick(H.fp), massing: 'auto', roof_type: roof, roof_pitch: roof === 'flat' ? 0 : Math.round((roof === 'shed' ? 10 : 28) + r() * 14),
		facade_main: pick(H.fac, c.facade_main), facade_color: pick(H.walls, c.facade_color), roof_color: pick(H.roofC), facade_accent: r() < 0.4 ? [] : (c.facade_accent || []),
		garage: r() < 0.35 ? 'carport' : 'none', energy: r() < 0.35 ? ['solar'] : [], balcony: r() < 0.3, chimney: r() < 0.35, basement: false, terrace_area: 0, dormers: 'none', roof_windows: 'none',
		house_name: '', rooms: [], vehicles: [], people: [], pets: [], garden_features: [], fence: 'none', neighbors: false
	});
}
var HOODS = {};
// The neighbouring houses (built once per style, season and light; only moved when the plot changes).
// Town: two houses on either side and four across the street; in the country a few farmsteads.
export function neighbours(c, k, night) {
	var st = HOOD[c.arch_style] ? c.arch_style : 'modern_minimal', key = [st, c.season || 'summer', night ? 'n' : 'd', k === 'suburb' ? 'town' : 'country', c.window_style, c.window_frame_color].join('|');
	if (HOODS[key]) { return HOODS[key]; }
	// keep the last few streets only (merged house geometry is large; tree geometry is shared)
	var keys = Object.keys(HOODS);
	if (keys.length >= 3) {
		HOODS[keys[0]].forEach(function (o) { o.root.traverse(function (m) { if (m.isMesh && !m.isInstancedMesh && m.geometry && !m.geometry.userData.shared) { m.geometry.dispose(); } }); });
		delete HOODS[keys[0]];
	}
	var r = rng(911 + st.length * 37), n = k === 'suburb' ? 8 : 3, out = [];
	for (var i = 0; i < n; i++) {
		var nc = variant(c, i, r), hs;
		try { hs = new L.House(nc, { mini: true }).build(); } catch (e) { continue; }
		// a garden of its own: lawn, a hedge along the street with the drive, a tree or two
		hs.root.updateMatrixWorld(true);
		var b = new THREE.Box3().setFromObject(hs.fit), sw = 4.5 + r() * 2.5, set = 6 + r() * 2.5;
		var x0 = b.min.x - sw, x1 = b.max.x + sw, yB = b.min.z - 9, yF = b.max.z + set;
		hs.add(L.box(x0, yB, 0, x1, yF, 0.012, L.groundKind(nc, 'grass'), { noCast: true }), false);
		var dx = b.max.x - 1.5;
		hs.add(L.box(dx - 3, b.max.z, 0, dx, yF, 0.022, L.groundKind(nc, 'pavers'), { noCast: true }), false);
		var hm = nc.season === 'winter' ? L.pbr('snow', {}, { normal: 0.5 }) : L.pbr('hedge', { season: nc.season || 'summer' }, { normal: 2.5 });
		if (r() < 0.7) { hs.add(L.box(x0 + 0.4, yF - 0.9, 0, dx - 3.6, yF - 0.3, 1.1 + r() * 0.4, hm), false); }
		var tk = TREE_OF[st] || (r() < 0.5 ? 'broad' : 'birch'), tl = [[x0 + 2.2 + r() * 2, 0, yB + 3 + r() * 3, tk, r() * 0.5, r()]];
		if (r() < 0.6) { tl.push([x1 - 2.5, 0, yB + 4 + r() * 4, r() < 0.5 ? 'columnar' : tk, r() * 0.4, r()]); }
		var tset = treeSet(nc, tl);
		// no lamps of their own (the scene's light count stays fixed), no shadows cast into the scene
		var kill = [];
		hs.root.traverse(function (o) { if (o.isLight) { kill.push(o); } if (o.isMesh) { o.castShadow = false; } });
		kill.forEach(function (o) { o.parent.remove(o); });
		L.mergeStatic(hs.root);
		hs.root.add(tset);
		out.push({ root: hs.root, w: x1 - x0, front: yF, back: yB, cx: (x0 + x1) / 2, across: k === 'suburb' ? i >= 4 : i === 2 });
	}
	HOODS[key] = out;
	return out;
}
// Where the neighbours stand around this plot (pb: plot box in sketch metres).
export function placeNeighbours(list, pb, k, rd) {
	var town = k === 'suburb', L1 = pb.left, R1 = pb.right, across = 0, xA = (pb.left + pb.right) / 2 - 30;
	list.forEach(function (o, i) {
		var root = o.root; root.rotation.set(0, 0, 0);
		if (town && !o.across) {
			// same side of the street: the plot's street edge on the same line as ours
			if (i % 2 === 0) { root.position.set(L1 - o.w / 2 - o.cx - 0.6, 0, pb.front - o.front); L1 -= o.w + 0.6; }
			else { root.position.set(R1 + o.w / 2 - o.cx + 0.6, 0, pb.front - o.front); R1 += o.w + 0.6; }
		} else if (o.across) {
			// across the street, facing it
			root.rotation.y = Math.PI;
			var x = town ? xA + across * 21 + (o.w - 20) * 0.5 : (pb.left + pb.right) / 2 - 15;
			root.position.set(x + o.cx, 0, (rd || pb.front + 11.3) + o.front + (town ? 0 : 25));
			across++;
		} else {
			// in the country: farmsteads further out on either side
			var side = i === 0 ? -1 : 1;
			root.rotation.y = side * 0.18;
			root.position.set(side < 0 ? pb.left - 42 - o.w / 2 - o.cx : pb.right + 48 + o.w / 2 - o.cx, 0, pb.front - o.front - 14 - i * 6);
		}
	});
}
