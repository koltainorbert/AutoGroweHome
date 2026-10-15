/*!
 * AutoGroweHome – 3D live preview (WebGL, three.js r170)
 * Koltai Norbert – Infostudio
 *
 * Builds the visitor's house as a real 3D scene from the designer configuration: walls with real
 * openings and reveals, framed windows with reflective glass, roofs with thickness, ridge caps and
 * gutters, PBR materials generated in the browser (agh-3d-tex.js), physical sky and sun with soft
 * shadows, ambient occlusion, foliage, garden and site. Same plan / volumes / roof geometry as the
 * 2D sketch (window.AGH_Sketch), so both always agree.
 *
 * Coordinates: the sketch uses metres with x along the front, y towards the viewer and z up; in
 * three.js that is (x, z, y): X right, Y up, Z towards the viewer.
 */
import * as THREE from './vendor/three/three.module.min.js';
import { OrbitControls } from './vendor/three/jsm/controls/OrbitControls.js';
import { EffectComposer } from './vendor/three/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/three/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from './vendor/three/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from './vendor/three/jsm/postprocessing/OutputPass.js';
import { texture, setAnisotropy, onTexture, texturesReady, TINT, NEUTRAL, imageTexture, onImage } from './agh-3d-tex.js';
// interiors (furnished rooms, studio shots of single items) – loaded with the same version query as this file
const INT = await import('./agh-3d-int.js' + new URL(import.meta.url).search);
// surroundings: terrain, landscape, street, neighbours
const LAND = await import('./agh-3d-land.js' + new URL(import.meta.url).search);
// real 3D models (1.13.0): only imported when switched on – switched off, no model file is ever asked for
var MODELS_ON = (function () {
	try {
		var m = window.AGH_LOADER && window.AGH_LOADER.models, p = new URLSearchParams(window.location.search).get('agh_models');
		if (p === '0') { return false; }
		if (p === '1') { return !!(m && m.manifest); }
		return !!(m && m.on);
	} catch (e) { return false; }
})();
var MODELS = null;
var modelsP = MODELS_ON ? import('./agh-3d-models.js' + new URL(import.meta.url).search).then(function (M) { MODELS = M; return M; }, function () { return null; }) : null;
function modelGroups(hs) {
	var out = [];
	if (hs && hs.items) { hs.items.children.forEach(function (o) { out.push(o); }); }
	if (hs && hs.modelPieces) { hs.modelPieces.forEach(function (o) { out.push(o); }); }
	return out;
}

var D2R = Math.PI / 180;
var SK = function () { return window.AGH_Sketch; };
function X(x, y, z) { return new THREE.Vector3(x, z, y); }
// A built object placed on the site at (x, y, z) turned by rot around the vertical.
function life(g, x, y, rot, z) { g.position.copy(X(x, y, z || 0)); g.rotation.y = rot || 0; return g; }
function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function has(a, v) { return Array.isArray(a) && a.indexOf(v) !== -1; }
function col(c, d) { return /^#[0-9a-fA-F]{6}$/.test(String(c || '')) ? String(c).toUpperCase() : d; }
function shadeHex(h, k) { var c = new THREE.Color(h); var t = k < 0 ? new THREE.Color(0, 0, 0) : new THREE.Color(1, 1, 1); c.lerp(t, Math.abs(k)); return '#' + c.getHexString(); }

/* ================================================================== materials */
// Every material is a MeshStandardMaterial: each extra physical feature (clearcoat, sheen,
// transmission) is a separate shader program, and compiling programs was the slowest part of the
// preview (seconds on some Windows GPUs). Glossy surfaces get low roughness and reflections instead.
var STRIP = { clearcoat: 1, clearcoatRoughness: 1, transmission: 1, thickness: 1, ior: 1, sheen: 1, sheenColor: 1, sheenRoughness: 1, specularIntensity: 1, specularColor: 1, attenuationColor: 1, attenuationDistance: 1, iridescence: 1 };
function stdMat(o) { var q = {}; Object.keys(o || {}).forEach(function (k) { if (!STRIP[k]) { q[k] = o[k]; } }); return new THREE.MeshStandardMaterial(q); }
var MATS = {};
function cached(key, make) { if (!MATS[key]) { MATS[key] = make(); MATS[key].userData.key = key; } return MATS[key]; }
function solid(color, rough, metal, extra) {
	var key = 's' + color + '|' + rough + '|' + (metal || 0) + '|' + (extra ? JSON.stringify(extra) : '');
	return cached(key, function () {
		var m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: rough, metalness: metal || 0 });
		if (extra) { Object.keys(extra).forEach(function (k) { m[k] = k === 'emissive' ? new THREE.Color(extra[k]) : extra[k]; }); }
		return m;
	});
}
var NEUTRAL_LIN = new THREE.Color(NEUTRAL).r;
function pbr(kind, opts, params) {
	params = params || {};
	var key = 'p' + kind + JSON.stringify(opts || {}) + JSON.stringify(params);
	return cached(key, function () {
		// single-tone materials: one neutral texture per pattern, the colour comes from the material
		var tint = TINT[kind] && opts && /^#[0-9a-f]{6}$/i.test(opts.color || '');
		var t = texture(kind, tint ? Object.assign({}, opts, { color: NEUTRAL }) : (opts || {}));
		var m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: params.roughness === undefined ? 1 : params.roughness, metalness: params.metalness || 0 });
		m.normalScale = new THREE.Vector2(params.normal || 1, params.normal || 1);
		if (t.alpha) { m.alphaTest = 0.5; m.side = THREE.DoubleSide; }
		if (params.clearcoat && params.roughness === undefined) { m.roughness = 0.85; }
		if (tint) { m.color = new THREE.Color(opts.color).multiplyScalar(1 / NEUTRAL_LIN); }
		if (params.color) { m.color = new THREE.Color(params.color); }
		return m;
	});
}
function glassMat(c, night) {
	if (night && c.night_lighting !== false) { return solid('#2A2218', 0.2, 0, { emissive: '#FFC27A', emissiveIntensity: 1.6 }); }
	var g = c.glazing || 'clear';
	var key = 'glass' + g;
	return cached(key, function () {
		return stdMat({
			color: new THREE.Color(g === 'tinted' ? '#3A444D' : (g === 'frosted' ? '#C9D3DA' : '#66798A')),
			roughness: g === 'frosted' ? 0.45 : 0.04, metalness: g === 'frosted' ? 0 : 0.75, envMapIntensity: 1.3, clearcoat: 1, clearcoatRoughness: 0.02
		});
	});
}
function frameMat(c) { var fc = col(c.window_frame_color, '#2F3235'); return solid(fc, c.window_frame_material === 'wood' ? 0.6 : 0.45, c.window_frame_material === 'aluminium' ? 0.55 : 0.05); }
var FACADE_BASE = { brick: '#A4553A', clinker: '#5A4036', stone: '#BDAE97', metal: '#5E6266', concrete: '#B6B3AD', render_dark: '#4A4D50' };
function facadeMat(c, m, tint) {
	m = m || 'render';
	var base = SK()._facadeBase(c, m);
	if (tint) { base = tint; }
	switch (m) {
		case 'brick': return pbr('brick', { color: base }, { normal: 1.6 });
		case 'clinker': return pbr('brick', { color: base, kind: 'clinker', mortar: '#3B302B' }, { normal: 1.4 });
		case 'stone': return pbr('stone', { color: base }, { normal: 2 });
		case 'wood': return pbr('wood', { color: base }, { normal: 1.2 });
		case 'metal': return pbr('seam', { color: base }, { metalness: 0.55, roughness: 1, normal: 1 });
		case 'concrete': return pbr('concrete', { color: base }, { normal: 1 });
		case 'panel': return pbr('panel', { color: base }, { normal: 1 });
		case 'render_dark': return pbr('render', { color: base, texture: 'fine' }, { normal: 0.6 });
		case 'wood_horizontal': return pbr('woodh', { color: base }, { normal: 1.4 });
		case 'board_batten': return pbr('batten', { color: base }, { normal: 1.2 });
		case 'charred_wood': return pbr('charred', { color: base }, { normal: 1.8 });
		case 'limestone': return pbr('limestone', { color: base }, { normal: 0.9 });
		case 'brick_white': return pbr('brick', { color: base, kind: 'lime', mortar: '#E4DFD6' }, { normal: 1.3 });
		case 'fiber_cement': return pbr('fibercement', { color: base }, { normal: 0.8 });
		default: return pbr('render', { color: col(c.facade_color, '#F2EFE9'), texture: c.facade_texture || 'fine' }, { normal: c.facade_texture === 'coarse' ? 1.2 : 0.6 });
	}
}
function accentMat(c, m) {
	var tint = c.facade_accent_color && (m === 'wood' || m === 'metal' || m === 'render_dark') ? col(c.facade_accent_color, null) : null;
	return facadeMat(c, m, tint);
}
function roofMat(c) {
	var base = col(c.roof_color, '#3A3D40'), p = String(c.roof_product || ''), surf = c.roof_surface;
	if (c.season === 'winter') { return pbr('snow', {}, { normal: 0.4 }); }
	var gl = surf === 'glazed' ? { clearcoat: 1, physical: true } : {};
	var rough = surf === 'glazed' ? 0.6 : (surf === 'satin' ? 0.8 : 1);
	if (c.roof_type === 'flat') { return surf === 'green' ? pbr('green', {}, { normal: 2 }) : pbr('gravel', { color: '#A9A49B' }, { normal: 2 }); }
	if (surf === 'green') { return pbr('green', {}, { normal: 2 }); }
	if (surf === 'gravel') { return pbr('shingle', { color: base }, { normal: 1.2 }); }
	if (p) {
		if (p.indexOf('tectura') !== -1) { return pbr('flattile', { color: base }, Object.assign({ normal: 1.6, roughness: rough }, gl)); }
		if (p.indexOf('reviva') !== -1) { return pbr('flattile', { color: base, kind: 'flattile2' }, Object.assign({ normal: 1.6, roughness: rough }, gl)); }
		if (p.indexOf('tegalit') !== -1) { return pbr('slate', { color: base }, Object.assign({ normal: 1.6, roughness: rough }, gl)); }
		return pbr('tiles', { color: base }, Object.assign({ normal: 2.2, roughness: rough }, gl));
	}
	if (SK()._style(c).seam) { return pbr('seam', { color: base }, { metalness: 0.5, normal: 1.2, roughness: rough }); }
	return pbr('tiles', { color: base }, Object.assign({ normal: 2.2, roughness: rough }, gl));
}
function groundKind(c, k) {
	var s = c.season;
	if (s === 'winter' && k !== 'water') { return pbr('snow', {}, { normal: 0.5 }); }
	switch (k) {
		case 'grass': return pbr('grass', { season: s || 'summer' }, { normal: 1.2 });
		case 'meadow': return pbr('grass', { season: s || 'summer', dry: true }, { normal: 1.2 });
		case 'gravel': return pbr('gravel', { color: '#B9B3A8' }, { normal: 2 });
		case 'pavers': return pbr('pavers', { color: '#B4ADA2' }, { normal: 1.4 });
		case 'slabs': return pbr('slabs', { color: '#C9C2B6' }, { normal: 1 });
		case 'asphalt': return pbr('asphalt', {}, { normal: 0.6 });
		case 'grasspavers': return pbr('pavers', { color: '#8FA85E' }, { normal: 1.2 });
		case 'sand': return pbr('sand', {}, { normal: 0.8 });
		case 'soil': return pbr('soil', {}, { normal: 1 });
		default: return pbr('grass', { season: s || 'summer' }, { normal: 1.2 });
	}
}

/* ================================================================== geometry helpers */
// UVs in metres for a BoxGeometry (w along x, h along y, d along z).
function boxGeo(w, h, d) {
	var g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
	var dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
	for (var f = 0; f < 6; f++) { for (var i = 0; i < 4; i++) { var k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]); } }
	return g;
}
// Axis-aligned box in sketch coordinates.
function box(x0, y0, z0, x1, y1, z1, mat, opts) {
	var m = new THREE.Mesh(boxGeo(Math.abs(x1 - x0), Math.abs(z1 - z0), Math.abs(y1 - y0)), mat);
	m.position.copy(X((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
	m.castShadow = !(opts && opts.noCast); m.receiveShadow = true;
	return m;
}
// Box in face-local coordinates (u along the face, v up, w out of the wall).
function lbox(u0, v0, w0, u1, v1, w1, mat, noCast) {
	var m = new THREE.Mesh(boxGeo(Math.abs(u1 - u0), Math.abs(v1 - v0), Math.abs(w1 - w0)), mat);
	m.position.set((u0 + u1) / 2, (v0 + v1) / 2, (w0 + w1) / 2);
	m.castShadow = !noCast; m.receiveShadow = true;
	return m;
}
// Many boxes (face-local [u0, v0, w0, u1, v1, w1]) as one mesh: railings, balusters, boards.
function lboxes(list, mat, noCast) {
	if (!list.length) { return null; }
	var pos = [], nor = [], uv = [], idx = [];
	list.forEach(function (b) {
		var g = new THREE.BoxGeometry(Math.max(1e-3, Math.abs(b[3] - b[0])), Math.max(1e-3, Math.abs(b[4] - b[1])), Math.max(1e-3, Math.abs(b[5] - b[2])));
		g.translate((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2);
		var base = pos.length / 3, P = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv.array, I = g.index.array, i;
		for (i = 0; i < P.length; i++) { pos.push(P[i]); nor.push(N[i]); }
		for (i = 0; i < U.length; i++) { uv.push(U[i]); }
		for (i = 0; i < I.length; i++) { idx.push(I[i] + base); }
		g.dispose();
	});
	var geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
	geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	geo.setIndex(idx);
	var m = new THREE.Mesh(geo, mat); m.castShadow = !noCast; m.receiveShadow = true;
	return m;
}
// Planar polygon (three.js points) with optional thickness along -normal. Group 0 = top face, 1 = rest.
function polyGeo(pts, opts) {
	opts = opts || {};
	var n = new THREE.Vector3();
	for (var i = 0; i < pts.length; i++) { var a = pts[i], b = pts[(i + 1) % pts.length]; n.x += (a.y - b.y) * (a.z + b.z); n.y += (a.z - b.z) * (a.x + b.x); n.z += (a.x - b.x) * (a.y + b.y); }
	if (n.lengthSq() < 1e-10) { return null; }
	n.normalize();
	var hint = opts.normal || new THREE.Vector3(0, 1, 0);
	if (n.dot(hint) < 0) { n.negate(); }
	var dv = new THREE.Vector3(0, 1, 0).addScaledVector(n, -n.y);
	if (dv.lengthSq() < 1e-6) { dv = new THREE.Vector3(0, 0, -1).addScaledVector(n, n.z); }
	dv.normalize();
	var du = new THREE.Vector3().crossVectors(dv, n).normalize();
	var o = pts[0];
	var loc = pts.map(function (p) { var q = p.clone().sub(o); return new THREE.Vector2(q.dot(du), q.dot(dv)); });
	var tris = THREE.ShapeUtils.triangulateShape(loc, []);
	var pos = [], uvs = [], top = [], t = opts.thick || 0;
	function tri(a, b, cc, la, lb, lc, list) { list.push([a, b, cc, la, lb, lc]); }
	tris.forEach(function (tr) {
		var A = loc[tr[0]], B = loc[tr[1]], C = loc[tr[2]];
		var cw = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x) < 0;
		if (cw) { tri(pts[tr[0]], pts[tr[2]], pts[tr[1]], A, C, B, top); } else { tri(pts[tr[0]], pts[tr[1]], pts[tr[2]], A, B, C, top); }
	});
	var rest = [];
	if (t > 0) {
		var off = n.clone().multiplyScalar(-t);
		top.forEach(function (T) { rest.push([T[0].clone().add(off), T[2].clone().add(off), T[1].clone().add(off), T[3], T[5], T[4]]); });
		// side walls: decide the outward direction of each edge from the polygon orientation
		var area = 0; for (var k = 0; k < loc.length; k++) { var p1 = loc[k], p2 = loc[(k + 1) % loc.length]; area += p1.x * p2.y - p2.x * p1.y; }
		var ccw = area > 0;
		for (var e = 0; e < pts.length; e++) {
			var P1 = pts[e], P2 = pts[(e + 1) % pts.length], Q1 = P1.clone().add(off), Q2 = P2.clone().add(off), L = P1.distanceTo(P2);
			var u0 = new THREE.Vector2(0, 0), u1 = new THREE.Vector2(L, 0), u2 = new THREE.Vector2(L, t), u3 = new THREE.Vector2(0, t);
			if (ccw) { rest.push([P1, Q1, Q2, u0, u3, u2]); rest.push([P1, Q2, P2, u0, u2, u1]); }
			else { rest.push([P1, Q2, Q1, u0, u2, u3]); rest.push([P1, P2, Q2, u0, u1, u2]); }
		}
	}
	var g = new THREE.BufferGeometry();
	top.concat(rest).forEach(function (T) { for (var j = 0; j < 3; j++) { pos.push(T[j].x, T[j].y, T[j].z); uvs.push(T[3 + j].x, T[3 + j].y); } });
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
	g.computeVertexNormals();
	g.addGroup(0, top.length * 3, 0);
	if (rest.length) { g.addGroup(top.length * 3, rest.length * 3, 1); }
	return g;
}
function polyMesh(pts, mats, opts) {
	var g = polyGeo(pts, opts);
	if (!g) { return null; }
	var m = new THREE.Mesh(g, Array.isArray(mats) ? mats : [mats, mats]);
	m.castShadow = !(opts && opts.noCast); m.receiveShadow = true;
	return m;
}
// Cylinder between two three.js points.
function rod(a, b, r, mat, seg) {
	var d = b.clone().sub(a), L = d.length();
	if (L < 1e-4) { return null; }
	var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, seg || 10, 1), mat);
	m.position.copy(a).addScaledVector(d, 0.5);
	m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
	m.castShadow = true; m.receiveShadow = true;
	return m;
}
// Beam (rectangular) between two points, rotated about its axis so it stays upright.
function beam(a, b, w, h, mat) {
	var d = b.clone().sub(a), L = d.length();
	if (L < 1e-4) { return null; }
	var m = new THREE.Mesh(boxGeo(w, h, L), mat);
	m.position.copy(a).addScaledVector(d, 0.5);
	m.lookAt(b.clone().add(m.position.clone().sub(a)));
	m.castShadow = true; m.receiveShadow = true;
	return m;
}

/* ================================================================== roof geometry (shared with the 2D sketch) */
function roofData(c, v, pl, type) {
	var polys = [], lines = [], glassy = [];
	var sc = {
		c: c, o: {}, id: 'r', light: {}, mock: true, cam: { t: [0, 0, 1], P: function () { return [0, 0]; } },
		mat: function () { return 'm'; }, def: function (k) { return k; },
		poly3: function (p3, fill, inner, op) { polys.push(p3); glassy.push(!!(op && op.glass)); return { svg: '', depth: 0 }; },
		plane: function (o, du, dv, poly) { glassy.push(false); polys.push(poly.map(function (q) { return [o[0] + du[0] * q[0] + dv[0] * q[1], o[1] + du[1] * q[0] + dv[1] * q[1], o[2] + du[2] * q[0] + dv[2] * q[1]]; })); return { svg: '', depth: 0 }; },
		line: function (a, b, color, width, kind) { lines.push({ a: a, b: b, color: color, width: width, kind: kind || '' }); return ''; },
		track: function () { return [0, 0]; }, depth: function () { return 0; }, visible: function () { return true; }, lit: function () { return 0; }
	};
	var r = SK()._roof(sc, v, pl, type);
	return { info: r, polys: polys, lines: lines, glassy: glassy };
}
// Profile of the wall top on the gable ends, as [u, z] points from u = len down to 0.
function gableTop(face, v, type, rise) {
	if (type === 'saw') {
		if (face !== 'right' && face !== 'left') { return null; }
		var nT = Math.max(2, Math.round((v.y1 - v.y0) / 3)), tw = (v.y1 - v.y0) / nT, S2 = v.y1 - v.y0, pp = [];
		// right face: u = 0 at the front; left face: u = 0 at the back
		if (face === 'right') { pp.push([S2, v.h]); for (var k = 0; k < nT; k++) { var u = S2 - (k + 1) * tw; pp.push([u, v.h + rise], [u, v.h]); } }
		else { for (var k2 = nT - 1; k2 >= 0; k2--) { var u2 = (k2 + 1) * tw; pp.push([u2, v.h], [u2, v.h + rise]); } pp.push([0, v.h]); }
		return pp;
	}
	if (['gable', 'half_hip', 'shed'].indexOf(type) === -1) { return null; }
	var alongX = v.ridge !== 'y';
	if ((alongX ? ['right', 'left'] : ['front', 'back']).indexOf(face) === -1) { return null; }
	var B0 = alongX ? v.y0 : v.x0, B1 = alongX ? v.y1 : v.x1, S = B1 - B0, Bc = (B0 + B1) / 2, h = v.h;
	function bOf(u) { return face === 'right' || face === 'back' ? B1 - u : B0 + u; }
	function z(b) {
		if (type === 'shed') { return h + rise * (B1 - b) / S; }
		var g = h + rise * (1 - Math.abs(b - Bc) / (S / 2));
		return type === 'half_hip' ? Math.min(g, h + rise * 0.58) : g;
	}
	var us = [S, 0];
	if (type === 'gable') { us.push(S / 2); }
	if (type === 'half_hip') { us.push(S / 2 + 0.21 * S, S / 2 - 0.21 * S); }
	us.sort(function (a, b) { return b - a; });
	return us.map(function (u) { return [u, z(bOf(u))]; });
}

/* ================================================================== openings */
function windowSpec(c) { return SK()._win(c); }
// Layout of the openings on one wall face (face-local u, v). Mirrors the 2D sketch for the front and
// the right side; the back and the left side get windows by the same rules.
function faceOpenings(c, v, pl, F, fp, rise, gabled) {
	var ws = windowSpec(c), st = SK()._style(c), len = F.len, out = [], reserved = [], blocked = [];
	if (v.glass) { return out; }
	if (fp) {
		if (fp.door) { out.push({ kind: 'door', x: fp.door.x, y: pl.plinth, w: fp.door.w, h: fp.door.h }); reserved.push([fp.door.x - 0.5, fp.door.x + fp.door.w + 0.5]); }
		if (fp.tdoor) { out.push({ kind: 'tdoor', x: fp.tdoor.x, y: pl.plinth, w: fp.tdoor.w, h: 2.35 }); reserved.push([fp.tdoor.x - 0.4, fp.tdoor.x + fp.tdoor.w + 0.4]); }
		blocked = fp.block.map(function (b) { return [b[0] - 0.3, b[1] + 0.3]; });
	}
	var entrance = !!(fp && fp.door);
	var side = F.name === 'right' || F.name === 'left';
	for (var fl = 0; fl < pl.floors; fl++) {
		var z0 = pl.plinth + fl * pl.FH;
		if (z0 < v.z0 - 0.05) { continue; }
		if (z0 + 1 > v.h) { break; }
		var w = ws.w, h = Math.min(ws.h, pl.FH - 0.6), sill = ws.sill;
		if (c.window_style === 'panoramic' && fl > 0) { w = 1.9; h = 1.7; sill = 0.6; }
		if (st.band) { w = Math.min(len - 1.2, 4.4); h = 1.0; sill = 1.0; }
		var n = Math.max(1, Math.floor((len - 0.8) / (w + ws.gap)));
		if (side) { n = Math.max(1, Math.min(n, Math.floor((len - 1) / (w + 1.4)))); }
		if (F.name === 'back' && !st.band) { n = Math.max(1, n - 1); }
		var step = len / n, row = [];
		for (var i = 0; i < n; i++) {
			var x = step * i + (step - w) / 2;
			if (fl === 0 && reserved.some(function (r) { return x < r[1] && x + w > r[0]; })) { continue; }
			if (blocked.some(function (r) { return x < r[1] && x + w > r[0]; })) { continue; }
			row.push({ x: x, w: w, i: i });
		}
		// behind a balcony the windows become doors (shared rule with the 2D sketch)
		if (fl > 0 && F.balc && F.balc.length) { SK()._balcMark(F.balc, F.name, fl, row); }
		for (var ri = 0; ri < row.length; ri++) {
			var o = row[ri];
			if (o.door) { out.push({ kind: 'bdoor', x: o.x, y: z0 + 0.02, w: o.w, h: Math.min(2.3, pl.FH - 0.45), fl: fl, french: !!o.french }); }
			else { out.push({ kind: 'win', x: o.x, y: z0 + sill, w: w, h: h, fl: fl, i: o.i }); }
		}
	}
	if (gabled && (pl.attic || rise > 2.2)) {
		var gw = Math.min(1.6, len * 0.22), gh = Math.min(1.3, rise - 0.9, rise * (1 - gw / len) - 0.55, gabled === 'half_hip' ? rise * 0.58 - 0.55 : 9);
		if (gh > 0.4) { out.push({ kind: 'win', x: len / 2 - gw / 2, y: v.h + 0.35, w: gw, h: gh, gable: true }); }
	}
	if (c.corner_window && F.name === 'front' && entrance) { out.unshift({ kind: 'win', x: len - 1.7, y: pl.plinth + 0.5, w: 1.6, h: 1.8, corner: true }); }
	// holes must not overlap: doors and the corner window win over ordinary windows
	out.sort(function (a, b) { var r = function (o) { return o.kind === 'door' ? 0 : (o.kind === 'tdoor' || o.kind === 'bdoor' ? 1 : (o.corner ? 2 : 3)); }; return r(a) - r(b); });
	var kept = [];
	out.forEach(function (o) {
		if (o.x < 0.05 || o.x + o.w > len - 0.05) { return; }
		if (kept.some(function (k) { return o.x < k.x + k.w + 0.08 && o.x + o.w > k.x - 0.08 && o.y < k.y + k.h + 0.5 && o.y + o.h > k.y - 0.08; })) { return; }
		kept.push(o);
	});
	return kept;
}

/* ================================================================== house builder */
function House(c, opts) {
	this.c = c; this.o = opts || {};
	this.root = new THREE.Group();
	this.fit = new THREE.Group();   // what the camera frames
	this.root.add(this.fit);
	this.lights = [];
	this.night = c.time_of_day === 'night' || c.time_of_day === 'blue';
}
House.prototype.add = function (m, fit) {
	// which setting this piece belongs to (a tap on the model jumps there); the innermost phase wins
	if (m && this.tagNow && !m.userData.field) { m.userData.field = this.tagNow; }
	if (m) { (fit === false ? this.root : this.fit).add(m); }
	return m;
};

House.prototype.build = function () {
	var c = this.c, K = SK(), pl = K.plan(c), vols = K._volumes(c, pl), self = this;
	this.pl = pl; this.vols = vols;
	this.balcVol = vols.some(function (q) { return q.balc; });
	vols.forEach(function (v, idx) { self.volume(v, idx, K._vtype(c, v), K._vplan(pl, v)); });
	if (pl.units > 1) { this.units(vols[0]); }
	this.extras();
	if (!this.o.mini) { this.site(); }
	return this;
};

House.prototype.volume = function (v, idx, type, vpl) {
	var c = this.c, pl = vpl || this.pl, st = SK()._style(c), self = this, T = 0.3, z0 = v.z0 || 0;
	var rd = type === 'flat' ? null : roofData(c, v, pl, type);
	var rise = rd ? rd.info.rise : 0;
	var acc = c.facade_accent || [], r = SK()._round(c, v), fp = SK()._front(c, v, this.vols);
	var BL = SK()._balconies(c, v, pl, this.vols);
	var wallMat = v.glass ? glassMat(c, this.night) : ((v.wing || v.second || v.accent) && acc.length ? accentMat(c, acc[0]) : facadeMat(c, c.facade_main));
	var faces = [
		{ name: 'front', o: [v.x0 + r, v.y1], u: [1, 0], n: X(0, 1, 0), len: v.x1 - v.x0 - 2 * r },
		{ name: 'right', o: [v.x1, v.y1 - r], u: [0, -1], n: X(1, 0, 0), len: v.y1 - v.y0 - 2 * r },
		{ name: 'back', o: [v.x1 - r, v.y0], u: [-1, 0], n: X(0, -1, 0), len: v.x1 - v.x0 - 2 * r },
		{ name: 'left', o: [v.x0, v.y0 + r], u: [0, 1], n: X(-1, 0, 0), len: v.y1 - v.y0 - 2 * r }
	];
	faces.forEach(function (F) {
		var g = new THREE.Group();
		var U = X(F.u[0], F.u[1], 0), Vv = new THREE.Vector3(0, 1, 0), W = F.n.clone();
		var m = new THREE.Matrix4().makeBasis(U, Vv, W);
		var org = X(F.o[0], F.o[1], 0).addScaledVector(W, -T);
		m.setPosition(org);
		g.matrixAutoUpdate = false; g.matrix.copy(m);
		var top = gableTop(F.name, v, type, rise);
		F.fp = F.name === 'front' ? fp : null;
		F.balc = BL;
		var ops = faceOpenings(c, v, pl, F, F.fp, rise, top && type !== 'shed' && type !== 'saw' ? type : false);
		F.ops = ops;
		// a shed roof's high side needs a full-height wall
		var fullH = type === 'shed' && F.name === (v.ridge !== 'y' ? 'back' : 'left') ? v.h + rise : v.h;
		// wall shape with holes
		var shape = new THREE.Shape();
		shape.moveTo(0, z0); shape.lineTo(F.len, z0);
		if (top) { top.forEach(function (p) { shape.lineTo(p[0], p[1]); }); } else { shape.lineTo(F.len, fullH); shape.lineTo(0, fullH); }
		shape.lineTo(0, z0);
		ops.forEach(function (o) { shape.holes.push(holePath(o, st, c)); });
		var wg = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 10 });
		var wm = new THREE.Mesh(wg, wallMat); wm.castShadow = true; wm.receiveShadow = true;
		g.add(wm);
		if (v.glass) { for (var mx = 1.2; mx < F.len - 0.2; mx += 1.2) { g.add(lbox(mx - 0.03, z0, T - 0.02, mx + 0.03, v.h, T + 0.04, frameMat(c))); } }
		else { self.wallDetails(g, v, F, ops, top, T, st, wallMat); }
		ops.forEach(function (o) { self.opening(g, o, T, st); });
		self.add(g);
	});
	var dark = solid('#1F1E1C', 1, 0);
	if (r > 0) {
		// soft corners: quarter cylinders, a rounded interior and no plinth band
		[[v.x1 - r, v.y1 - r, 0], [v.x0 + r, v.y1 - r, 1.5], [v.x0 + r, v.y0 + r, 1], [v.x1 - r, v.y0 + r, 0.5]].forEach(function (q) {
			var cg = new THREE.CylinderGeometry(r, r, v.h - z0, 18, 1, true, q[2] * Math.PI, Math.PI / 2);
			var cm = new THREE.Mesh(cg, wallMat); cm.position.copy(X(q[0], q[1], (v.h + z0) / 2)); cm.castShadow = true; cm.receiveShadow = true; self.add(cm);
		});
		this.add(roundSlab(v, r, -T - 0.02, z0 + 0.05, v.h - 0.05, dark));
	} else {
		// interior: dark box so open doors/thin glass never show the sky through the house
		if (!v.glass) { this.add(box(v.x0 + T + 0.02, v.y0 + T + 0.02, z0 + 0.05, v.x1 - T - 0.02, v.y1 - T - 0.02, v.h - 0.05, dark, { noCast: true })); }
		// plinth band
		var pm = plinthMat(c);
		if (pm && !z0) {
			var ph = pl.plinth, e = 0.03;
			this.add(box(v.x0 - e, v.y0 - e, 0, v.x1 + e, v.y1 + e, ph, pm));
		}
		// a basement shows on the outside: cellar windows in light wells along the front, and for a
		// walkout basement the level itself is cut into the slope with its own door
		if (c.basement && v.main && !z0) { this.basementFace(v, pl); }
	}
	// the underside of a floating (cantilevered) volume
	if (z0 > 0) { this.add(box(v.x0, v.y0, z0 - 0.28, v.x1, v.y1, z0 + 0.02, solid(shadeHex(col(c.facade_color, '#F2EFE9'), -0.06), 0.85))); }
	// roof
	if (type === 'flat') { this.flatRoof(v, r); } else { this.pitchedRoof(v, rd, type); }
	this.roofItems(v, type, rd ? rd.info : null, pl);
	this.frontExtras(v, fp, type, pl);
};
// What a basement shows above ground: cellar windows in their light wells along the garden side, and
// for a walkout basement a sunken level with its own door and outside steps.
House.prototype.basementFace = function (v, pl) {
	var c = this.c, self = this, prev = this.tagNow;
	this.tagNow = 'basement';
	var kind = c.basement_type || 'partial', ph = pl.plinth;
	var wallC = col(c.facade_color, '#F2EFE9'), wm = solid(shadeHex(wallC, -0.18), 0.9);
	var conc = pbr('concrete', { color: '#C4C0B8' }, { normal: 0.6 }), fm = frameMat(c), gm = glassMat(c, this.night);
	var W = v.x1 - v.x0, deep = kind === 'walkout' ? 2.4 : 1.1;
	// light wells with a window: two on the garden side, one on the left, all under the plinth line
	var wells = [[v.x0 + W * 0.3, v.y1, 1], [v.x0 + W * 0.68, v.y1, 1]];
	if (v.y1 - v.y0 > 7) { wells.push([v.x0, v.y0 + (v.y1 - v.y0) * 0.5, 0]); }
	wells.forEach(function (q) {
		var front = q[2] === 1, x = q[0], y = q[1], ww = 0.9, wh = 0.55, z0 = Math.max(0.08, ph - 0.72);
		// the well: a concrete box sunk into the ground in front of the window
		if (front) {
			self.add(box(x - ww / 2 - 0.08, y, z0 - 0.05, x + ww / 2 + 0.08, y + 0.55, z0 + wh + 0.1, conc));
			self.add(box(x - ww / 2, y - 0.14, z0, x + ww / 2, y + 0.02, z0 + wh, fm));
			self.add(box(x - ww / 2 + 0.05, y - 0.1, z0 + 0.05, x + ww / 2 - 0.05, y - 0.02, z0 + wh - 0.05, gm));
		} else {
			self.add(box(x - 0.55, y - ww / 2 - 0.08, z0 - 0.05, x + 0.02, y + ww / 2 + 0.08, z0 + wh + 0.1, conc));
			self.add(box(x - 0.02, y - ww / 2, z0, x + 0.14, y + ww / 2, z0 + wh, fm));
			self.add(box(x + 0.02, y - ww / 2 + 0.05, z0 + 0.05, x + 0.1, y + ww / 2 - 0.05, z0 + wh - 0.05, gm));
		}
	});
	if (kind === 'walkout') {
		// the garden side is dug out: a sunken terrace with a door down to the basement and steps up
		var bx0 = v.x0 + W * 0.08, bx1 = bx0 + Math.min(4.2, W * 0.42), y0 = v.y1, y1 = v.y1 + 2.6;
		self.add(box(bx0 - 0.2, y0, -deep, bx1 + 0.2, y1, -deep + 0.12, pbr('slabs', { color: '#C9C2B6' }, { normal: 1 })));
		[[bx0 - 0.2, bx0], [bx1, bx1 + 0.2]].forEach(function (s) { self.add(box(s[0], y0, -deep, s[1], y1, 0.02, conc)); });
		self.add(box(bx0 - 0.2, y1 - 0.2, -deep, bx1 + 0.2, y1, 0.02, conc));
		self.add(box(bx0 + 0.3, y0 - 0.16, -deep + 0.12, bx0 + 1.3, y0 + 0.02, -deep + 2.22, fm));
		self.add(box(bx0 + 0.36, y0 - 0.12, -deep + 0.18, bx0 + 1.24, y0 - 0.04, -deep + 2.16, gm));
		self.add(box(bx0 + 1.6, y0 - 0.16, -deep + 0.12, bx0 + 2.5, y0 + 0.02, -deep + 1.5, fm));
		self.add(box(bx0 + 1.66, y0 - 0.12, -deep + 0.18, bx0 + 2.44, y0 - 0.04, -deep + 1.44, gm));
		var nst = Math.max(6, Math.round(deep / 0.17)), sh = deep / nst, sw = Math.min(1.2, (bx1 - bx0) * 0.4);
		for (var i = 0; i < nst; i++) { self.add(box(bx1 - sw, y1 - 0.3 - i * 0.28, -deep + i * sh, bx1, y1 - 0.02, -deep + (i + 1) * sh, conc)); }
		self.add(rod(X(bx1 - sw - 0.05, y1 - 0.3, 0.95), X(bx1 - sw - 0.05, y1 - 0.3 - nst * 0.28, -deep + 0.95), 0.025, solid('#8C9196', 0.3, 0.9)));
	} else {
		// otherwise only the retaining band of the basement wall shows at ground level
		self.add(box(v.x0 - 0.05, v.y1, -0.35, v.x1 + 0.05, v.y1 + 0.12, Math.max(0.1, ph - 0.1), wm));
	}
	this.tagNow = prev;
};
// A slab following the outline of a rounded volume (e: outward offset), from z0 to z1.
function roundSlab(v, r, e, z0, z1, mat, hole) {
	var pts = SK()._roundPts(v, r, e, 8), sh = new THREE.Shape();
	pts.forEach(function (p, i) { if (i) { sh.lineTo(p[0], -p[1]); } else { sh.moveTo(p[0], -p[1]); } });
	if (hole !== undefined) {
		var hp = new THREE.Path(), hpts = SK()._roundPts(v, r, hole, 8).reverse();
		hpts.forEach(function (p, i) { if (i) { hp.lineTo(p[0], -p[1]); } else { hp.moveTo(p[0], -p[1]); } });
		sh.holes.push(hp);
	}
	var geo = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false, curveSegments: 8 });
	geo.rotateX(-Math.PI / 2); geo.translate(0, z0, 0);
	var m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
	return m;
}
function plinthMat(c) {
	switch (c.plinth) {
		case 'stone': return pbr('stone', { color: '#8D8576' }, { normal: 2 });
		case 'concrete': return pbr('concrete', { color: '#9D9A94' }, { normal: 1 });
		case 'flush': return null;
		default: return pbr('render', { color: col(c.plinth_color, '#4A4D50'), texture: 'fine' }, { normal: 0.6 });
	}
}
// Gable area above the eaves line (for accent cladding): [0, h] → [len, h] → wall top profile.
function gablePoly(top, len, h) {
	var pts = [[0, h], [len, h]];
	top.forEach(function (p) { var l = pts[pts.length - 1]; if (Math.abs(l[0] - p[0]) > 1e-3 || Math.abs(l[1] - p[1]) > 1e-3) { pts.push(p); } });
	var f0 = pts[0], lst = pts[pts.length - 1];
	if (Math.abs(f0[0] - lst[0]) < 1e-3 && Math.abs(f0[1] - lst[1]) < 1e-3) { pts.pop(); }
	return pts;
}
function holePath(o, st, c) {
	var p = new THREE.Path();
	var arch = (st.arches || c.window_style === 'arched') && o.kind === 'win' && !o.gable;
	p.moveTo(o.x, o.y); p.lineTo(o.x + o.w, o.y);
	if (arch) { var r = o.w / 2; p.lineTo(o.x + o.w, o.y + o.h); p.absellipse(o.x + r, o.y + o.h, r, Math.min(r, 0.4), 0, Math.PI, false); } else { p.lineTo(o.x + o.w, o.y + o.h); p.lineTo(o.x, o.y + o.h); }
	p.lineTo(o.x, o.y);
	return p;
}
House.prototype.wallDetails = function (g, v, F, ops, top, T, st, wallMat) {
	var c = this.c, pl = this.pl, acc = c.facade_accent || [], main = v.main, fcol = col(c.facade_color, '#F2EFE9');
	var proud = function (shapePts, mat, holesFrom, d) {
		var s = new THREE.Shape();
		shapePts.forEach(function (p, i) { if (i) { s.lineTo(p[0], p[1]); } else { s.moveTo(p[0], p[1]); } });
		var bb = shapePts.reduce(function (a, p) { return [Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.max(a[2], p[0]), Math.max(a[3], p[1])]; }, [1e9, 1e9, -1e9, -1e9]);
		(holesFrom || []).forEach(function (o) {
			var x0 = Math.max(o.x, bb[0] + 0.02), x1 = Math.min(o.x + o.w, bb[2] - 0.02), y0 = Math.max(o.y, bb[1] + 0.02), y1 = Math.min(o.y + o.h, bb[3] - 0.02);
			if (x1 - x0 > 0.05 && y1 - y0 > 0.05) { var h = new THREE.Path(); h.moveTo(x0, y0); h.lineTo(x1, y0); h.lineTo(x1, y1); h.lineTo(x0, y1); h.lineTo(x0, y0); s.holes.push(h); }
		});
		var geo = new THREE.ExtrudeGeometry(s, { depth: d || 0.03, bevelEnabled: false });
		var me = new THREE.Mesh(geo, mat); me.position.z = T; me.castShadow = true; me.receiveShadow = true;
		g.add(me);
	};
	var opsIn = function (x0, x1, y1) { return ops.filter(function (o) { return o.x < x1 && o.x + o.w > x0 && o.y < (y1 === undefined ? 1e9 : y1); }); };
	var door = F.fp && F.fp.door;
	if (door && acc[0] && (main || v.risalit)) {
		var dp = door, ax0 = Math.max(0, dp.x - 0.75), ax1 = Math.min(F.len, dp.x + dp.w + 0.75);
		proud([[ax0, 0], [ax1, 0], [ax1, v.h], [ax0, v.h]], accentMat(c, acc[0]), opsIn(ax0, ax1));
	}
	if (main && acc[1]) {
		if (top) { proud(gablePoly(top, F.len, v.h), accentMat(c, acc[1]), opsIn(0, F.len).filter(function (o) { return o.gable; })); }
		else if (F.name === 'right' && !top) { proud([[0, 0], [F.len * 0.42, 0], [F.len * 0.42, v.h], [0, v.h]], accentMat(c, acc[1]), opsIn(0, F.len * 0.42)); }
	}
	if (main && acc[2] && F.name === 'right') { var hh = Math.min(v.h, pl.plinth + pl.FH); proud([[F.len * 0.42, 0], [F.len, 0], [F.len, hh], [F.len * 0.42, hh]], accentMat(c, acc[2]), opsIn(F.len * 0.42, F.len, hh)); }
	if (main && st.woodGable && top) { proud(gablePoly(top, F.len, v.h), pbr('wood', { color: '#9C6B44' }, { normal: 1.2 }), opsIn(0, F.len).filter(function (o) { return o.gable; })); }
	if (main && c.gable_finish === 'glass' && top) {
		var gp = [[0.35, v.h + 0.1], [F.len - 0.35, v.h + 0.1]].concat(top.slice(1, -1).map(function (q) { return [clamp(q[0], 0.35, F.len - 0.35), Math.max(v.h + 0.1, q[1] - 0.3)]; }));
		proud(gp, glassMat(c, this.night), [], 0.04);
	}
	// cornice / floor band
	if (st.cornice || c.facade_ornaments) {
		var cm = solid(shadeHex(fcol, c.facade_ornaments && st.cornice ? 0.3 : 0.16), 0.85);
		g.add(lbox(-0.08, v.h - 0.34, T, F.len + 0.08, v.h - 0.02, T + 0.12, cm));
		g.add(lbox(-0.04, pl.plinth + Math.min(pl.FH, v.h - pl.plinth) - 0.12, T, F.len + 0.04, pl.plinth + Math.min(pl.FH, v.h - pl.plinth) + 0.02, T + 0.06, cm));
	}
	if (c.corner_detail === 'glass' && F.name === 'front' && main) { g.add(lbox(F.len - 0.9, pl.plinth + 0.1, T - 0.02, F.len, v.h - 0.4, T + 0.02, glassMat(c, this.night), true)); }
	if (st.fins && main && F.name === 'front') { for (var fi = 0; fi < 7; fi++) { var fx = F.len * 0.62 + fi * F.len * 0.055; g.add(lbox(fx, pl.plinth, T, fx + 0.1, v.h, T + 0.35, solid(st.fins, 0.5, st.fins === '#9DA1A4' ? 0.6 : 0))); } }
	if (main && st.slats && F.name === 'front') { for (var sl = 0.15; sl < F.len * 0.3; sl += 0.24) { g.add(lbox(F.len - 0.32 - sl, pl.plinth, T + 0.04, F.len - 0.2 - sl, v.h - 0.1, T + 0.12, pbr('wood', { color: st.slats }, { normal: 1 }))); } }
	if (c.corner_detail === 'quoins' || st.quoins) {
		var qm = st.quoins && c.corner_detail !== 'quoins' ? pbr('stone', { color: '#9C927F' }, { normal: 2 }) : solid(shadeHex(fcol, -0.1), 0.8);
		for (var q = Math.max(pl.plinth, v.z0 || 0); q < v.h - 0.3; q += 0.5) { var qw = (Math.round(q * 2) % 2) ? 0.35 : 0.5; g.add(lbox(F.len - qw, q, T, F.len, q + 0.42, T + 0.03, qm)); }
	}
	if (main && F.name === 'right') { this.wallTech(g, F, T); }
	if (door) {
		var dp2 = door;
		if (st.portal) {
			var pc = solid(st.portal, 0.5, 0.3);
			g.add(lbox(dp2.x - 0.6, pl.plinth, T, dp2.x - 0.38, pl.plinth + dp2.h + 0.55, T + 0.25, pc));
			g.add(lbox(dp2.x + dp2.w + 0.38, pl.plinth, T, dp2.x + dp2.w + 0.6, pl.plinth + dp2.h + 0.55, T + 0.25, pc));
			g.add(lbox(dp2.x - 0.6, pl.plinth + dp2.h + 0.33, T, dp2.x + dp2.w + 0.6, pl.plinth + dp2.h + 0.55, T + 0.25, pc));
		}
		if (c.exterior_lighting) {
			var lm = this.night ? solid('#3A3020', 0.3, 0, { emissive: '#FFD9A0', emissiveIntensity: 3 }) : solid('#2E3135', 0.4, 0.4);
			g.add(lbox(dp2.x - 0.42, pl.plinth + 1.95, T, dp2.x - 0.28, pl.plinth + 2.2, T + 0.12, lm));
			if (this.night) { this.lamp(g, dp2.x - 0.35, pl.plinth + 2.0, T + 0.4); }
		}
		if (c.house_number) { g.add(lbox(dp2.x + dp2.w + 0.2, pl.plinth + 1.65, T, dp2.x + dp2.w + 0.5, pl.plinth + 1.87, T + 0.02, solid('#2B2E31', 0.4, 0.5))); }
	}
};
House.prototype.lamp = function (g, x, y, z) {
	if (this.lights.length >= 4 || this.o.mini) { return; }
	var L = new THREE.PointLight('#FFC98A', 6, 6, 2);
	L.position.set(x, y, z);
	g.add(L); this.lights.push(L);
};
House.prototype.wallTech = function (g, F, T) {
	var c = this.c, e = c.energy || [], pl = this.pl, len = F.len;
	if (has(e, 'ac')) { g.add(lbox(len * 0.55, pl.plinth + 2.1, T, len * 0.55 + 0.85, pl.plinth + 2.65, T + 0.3, solid('#E9EBEC', 0.5))); }
	if (has(e, 'battery')) { g.add(lbox(len * 0.2, pl.plinth + 0.5, T, len * 0.2 + 0.6, pl.plinth + 1.45, T + 0.18, solid('#F4F5F6', 0.4))); }
	if (has(e, 'mvhr')) { g.add(lbox(len * 0.8, pl.plinth + 2.5, T, len * 0.8 + 0.45, pl.plinth + 2.95, T + 0.06, pbr('louvre', { color: '#B9BDC1' }, { normal: 1 }))); }
};
// Window / door / terrace door inside a wall hole (face-local).
House.prototype.opening = function (g, o, T, st) {
	// the whole opening goes into its own group, so a tap on it finds the window (or the front door)
	var og = new THREE.Group();
	og.userData.field = o.kind === 'door' ? 'entrance_door' : 'window_style';
	g.add(og); g = og;
	var c = this.c, fm = frameMat(c), gm = glassMat(c, this.night), reveal = st.reveal ? 0.2 : 0.1, fd = 0.08;
	var w0 = T - reveal - fd, w1 = T - reveal, mat = c.window_frame_material || 'aluminium';
	var fr = { pvc: 0.09, aluminium: 0.05, wood: 0.075, wood_alu: 0.06 }[mat] || 0.05;
	var x0 = o.x, x1 = o.x + o.w, y0 = o.y, y1 = o.y + o.h;
	var arch = st.arches && o.kind === 'win' && !o.gable;
	// reveal lining (lighter)
	if (o.kind === 'door') {
		var dt = c.entrance_door, dm = dt === 'wood' || dt === 'slat' ? pbr('wood', { color: '#8A5A36' }, { normal: 1 }) : solid(col(c.entrance_door_color, '#2B2E31'), 0.45, 0.2);
		g.add(lbox(x0, y0, w0, x1, y1, w1, fm));
		g.add(lbox(x0 + 0.06, y0, w0 + 0.01, x1 - 0.06, y1 - 0.06, w1 + 0.01, dm));
		if (dt === 'double') { g.add(lbox(x0 + o.w / 2 - 0.02, y0, w1, x0 + o.w / 2 + 0.02, y1 - 0.06, w1 + 0.02, fm)); g.add(lbox(x0 + o.w / 2 + 0.09, y0 + o.h * 0.38, w1 + 0.02, x0 + o.w / 2 + 0.125, y0 + o.h * 0.38 + 0.45, w1 + 0.08, solid('#C9CCCF', 0.25, 1))); }
		if (dt === 'glass_full') { g.add(lbox(x0 + 0.12, y0 + 0.12, w1, x1 - 0.12, y1 - 0.2, w1 + 0.012, gm, true)); }
		if (dt === 'half_glass') { g.add(lbox(x0 + 0.14, y0 + o.h * 0.5, w1, x1 - 0.14, y1 - 0.22, w1 + 0.012, gm, true)); }
		if (dt === 'sidelight') { g.add(lbox(x0 + o.w * 0.66, y0 + 0.12, w1, x1 - 0.12, y1 - 0.2, w1 + 0.012, gm, true)); g.add(lbox(x0 + o.w * 0.645, y0, w1, x0 + o.w * 0.665, y1 - 0.06, w1 + 0.02, fm)); }
		if (dt === 'slat') { var sm = solid(shadeHex('#8A5A36', -0.25), 0.7); for (var sx = x0 + 0.1; sx < x1 - 0.12; sx += 0.13) { g.add(lbox(sx, y0 + 0.04, w1 + 0.01, sx + 0.07, y1 - 0.1, w1 + 0.045, sm)); } }
		if (c.entrance_door === 'glass_strip') { g.add(lbox(x0 + o.w * 0.68, y0 + 0.15, w1, x0 + o.w * 0.84, y1 - 0.2, w1 + 0.015, gm, true)); }
		if (c.entrance_door === 'classic') {
			var pm = solid(shadeHex(col(c.entrance_door_color, '#2B2E31'), 0.12), 0.45, 0.2);
			g.add(lbox(x0 + 0.16, y0 + 0.2, w1 + 0.01, x1 - 0.16, y0 + 0.2 + o.h * 0.36, w1 + 0.04, pm));
			g.add(lbox(x0 + 0.16, y0 + o.h * 0.5, w1 + 0.01, x1 - 0.16, y1 - 0.25, w1 + 0.04, pm));
		}
		var hl = c.entrance_door === 'pivot' ? o.h * 0.55 : 0.45;
		g.add(lbox(x0 + o.w * 0.12, y0 + o.h * 0.38, w1 + 0.02, x0 + o.w * 0.12 + 0.035, y0 + o.h * 0.38 + hl, w1 + 0.08, solid('#C9CCCF', 0.25, 1)));
		return;
	}
	if (o.kind === 'bdoor') {
		this.frameRect(g, x0, y0, x1, y1, w0, w1, fr, fm);
		g.add(lbox(x0 + fr, y0 + fr, w0 + fd * 0.45, x1 - fr, y1 - fr, w0 + fd * 0.55, gm, true));
		if (o.w > 1.3) { g.add(lbox(x0 + o.w / 2 - 0.035, y0, w0, x0 + o.w / 2 + 0.035, y1, w1, fm)); }
		if (o.french) {
			// juliet balcony: a railing in front of the door
			var rl = [], a0 = x0 - 0.08, a1 = x1 + 0.08, rw0 = T + 0.05, rw1 = T + 0.09;
			rl.push([a0, y0 + 0.97, rw0 - 0.01, a1, y0 + 1.01, rw1 + 0.01], [a0, y0 + 0.08, rw0, a1, y0 + 0.11, rw1]);
			for (var fb = a0; fb <= a1 + 1e-6; fb += 0.11) { rl.push([fb, y0 + 0.11, rw0 + 0.01, fb + 0.016, y0 + 0.97, rw1 - 0.01]); }
			[a0, a1 - 0.03].forEach(function (u) { rl.push([u, y0 + 0.08, T, u + 0.03, y0 + 0.11, rw1]); });
			g.add(lboxes(rl, solid('#2F3235', 0.4, 0.75)));
		}
		return;
	}
	if (o.kind === 'tdoor') {
		var panes = c.terrace_door === 'folding' ? 4 : 2;
		this.frameRect(g, x0, y0, x1, y1, w0, w1, fr, fm);
		g.add(lbox(x0 + fr, y0 + fr, w0 + fd * 0.45, x1 - fr, y1 - fr, w0 + fd * 0.55, gm, true));
		for (var p = 1; p < panes; p++) { var px = x0 + o.w * p / panes; g.add(lbox(px - 0.035, y0, w0, px + 0.035, y1, w1, fm)); }
		if (c.terrace_door === 'french') { g.add(lbox(x0, y0 + 1.5, w0, x1, y0 + 1.55, w1, fm)); }
		if (c.terrace_door === 'lift_slide' || c.terrace_door === 'sliding') { g.add(lbox(x0, y1 - 0.02, w0 - 0.02, x1, y1 + 0.1, w1 + 0.02, fm)); }
		if (c.terrace_door === 'lift_slide') { g.add(lbox(x0 + o.w / 2 - 0.16, y0 + 0.9, w1, x0 + o.w / 2 - 0.12, y0 + 1.4, w1 + 0.06, solid('#C9CCCF', 0.25, 1))); }
		return;
	}
	// window
	var tc = SK()._trim(c);
	if (tc) { this.frameRect(g, x0 - 0.13, y0 - 0.13, x1 + 0.13, y1 + (arch ? Math.min(o.w / 2, 0.4) : 0) + 0.13, T, T + 0.04, 0.13, c.window_trim === 'stone' ? pbr('stone', { color: tc }, { normal: 1.5 }) : solid(tc, 0.7)); }
	if (st.lintel) { g.add(lbox(x0 - 0.16, y1 + 0.02, T, x1 + 0.16, y1 + 0.22, T + 0.05, st.lintel === '#1E1F21' ? solid(st.lintel, 0.5, 0.6) : pbr('wood', { color: st.lintel }, { normal: 1 }))); }
	this.frameRect(g, x0, y0, x1, y1, w0, w1, fr, fm);
	if (mat === 'wood' || mat === 'wood_alu') { this.frameRect(g, x0 + fr * 0.55, y0 + fr * 0.55, x1 - fr * 0.55, y1 - fr * 0.55, w1 - 0.01, w1 + 0.005, fr * 0.4, pbr('wood', { color: '#A8744A' }, { normal: 0.6 })); }
	g.add(lbox(x0 + fr, y0 + fr, w0 + fd * 0.45, x1 - fr, y1 - fr, w0 + fd * 0.55, gm, true));
	if (arch) {
		var as = new THREE.Shape(); as.moveTo(x0, y1); as.lineTo(x1, y1); as.absellipse(x0 + o.w / 2, y1, o.w / 2, Math.min(o.w / 2, 0.4), 0, Math.PI, false);
		var am = new THREE.Mesh(new THREE.ExtrudeGeometry(as, { depth: 0.02, bevelEnabled: false, curveSegments: 16 }), gm); am.position.z = w0 + fd * 0.45; g.add(am);
		g.add(lbox(x0, y1 - 0.02, w0, x1, y1 + 0.03, w1, fm));
	}
	var mull = Math.max(1, Math.round(o.w / ({ panoramic: 1.3, ribbon: 1.05, bay: 0.78, square: 1.3 }[c.window_style] || 1.1)));
	for (var i = 1; i < mull; i++) { var mx = x0 + o.w * i / mull; g.add(lbox(mx - 0.03, y0, w0, mx + 0.03, y1, w1, fm)); }
	if (c.window_divided || st.grid) {
		var gx = Math.max(2, Math.round(o.w / 0.42)), gy = Math.max(2, Math.round(o.h / 0.5));
		for (var a = 1; a < gx; a++) { var ax = x0 + o.w * a / gx; g.add(lbox(ax - 0.014, y0, w0 + fd * 0.6, ax + 0.014, y1, w1, fm, true)); }
		for (var b = 1; b < gy; b++) { var by = y0 + o.h * b / gy; g.add(lbox(x0, by - 0.014, w0 + fd * 0.6, x1, by + 0.014, w1, fm, true)); }
	} else if (c.window_style === 'classic') { g.add(lbox(x0, y0 + o.h * 0.62 - 0.02, w0, x1, y0 + o.h * 0.62 + 0.02, w1, fm)); }
	// sill
	if (!o.gable || true) { g.add(lbox(x0 - 0.06, y0 - 0.045, w1 - 0.02, x1 + 0.06, y0, T + 0.07, solid(shadeHex(col(c.window_frame_color, '#2F3235'), 0.3), 0.5, 0.4))); }
	// shading
	var sh = c.shading || [];
	var shut = SK()._shutter(c);
	if (shut && !o.gable && !o.corner) {
		var lm = pbr('louvre', { color: shut }, { normal: 1.5 });
		g.add(lbox(x0 - o.w * 0.5 - 0.04, y0, T, x0 - 0.04, y1, T + 0.04, lm));
		g.add(lbox(x1 + 0.04, y0, T, x1 + o.w * 0.5 + 0.04, y1, T + 0.04, lm));
	}
	if (has(sh, 'blinds') && !o.gable) {
		var bm = solid(shadeHex(col(c.window_frame_color, '#2F3235'), 0.15), 0.5, 0.3);
		g.add(lbox(x0 - 0.02, y1 - 0.02, w1, x1 + 0.02, y1 + 0.16, T + 0.02, bm));
		if (((o.i || 0) + (o.fl || 0)) % 3 === 1) { g.add(lbox(x0 + fr, y1 - o.h * 0.38, w1 + 0.005, x1 - fr, y1, w1 + 0.02, pbr('louvre', { color: shadeHex(col(c.window_frame_color, '#2F3235'), 0.3) }, { normal: 1 }), true)); }
	}
	if (has(sh, 'louvres') && o.fl > 0) {
		var lv = solid('#9DA1A4', 0.4, 0.7);
		for (var k = 0; k <= 4; k++) { var lx = x0 - 0.1 + k * (o.w + 0.2) / 4; g.add(lbox(lx - 0.03, y0 - 0.2, T + 0.15, lx + 0.03, y1 + 0.2, T + 0.4, lv)); }
	}
};
House.prototype.frameRect = function (g, x0, y0, x1, y1, w0, w1, t, m) {
	g.add(lbox(x0, y0, w0, x1, y0 + t, w1, m)); g.add(lbox(x0, y1 - t, w0, x1, y1, w1, m));
	g.add(lbox(x0, y0, w0, x0 + t, y1, w1, m)); g.add(lbox(x1 - t, y0, w0, x1, y1, w1, m));
};

House.prototype.pitchedRoof = function (v, rd, type) {
	var c = this.c, rm = roofMat(c), soffit = solid(c.arch_style === 'japandi' || c.arch_style === 'alpine' || c.arch_style === 'rustic' ? '#8A6446' : '#E6E2DA', 0.85);
	var self = this, rsp = SK()._ridge(c);
	var ridgeM = rsp.metal ? solid('#8E9296', 0.35, 0.8) : (rsp.mortar ? solid('#8A857C', 0.9) : solid(shadeHex(col(c.roof_color, '#3A3D40'), rsp.shift || -0.15), 0.6, 0.1));
	if (c.season === 'winter') { ridgeM = solid('#EEF2F6', 0.6); }
	var P3 = rd.polys.map(function (p) { return p.map(function (q) { return X(q[0], q[1], q[2]); }); });
	var gm = glassMat(c, this.night), fm = frameMat(c);
	P3.forEach(function (pts, i) {
		if (rd.glassy[i]) { var gq = polyMesh(pts, [gm, gm], { thick: 0.04 }); if (gq) { self.add(gq); } return; }
		var m = polyMesh(pts, [rm, soffit], { thick: 0.16 }); if (m) { m.position.y += 0.02; self.add(m); }
	});
	if (type === 'saw') { P3 = P3.filter(function (p, i) { if (rd.glassy[i]) { self.add(beam(p[2], p[3], 0.08, 0.08, fm)); } return !rd.glassy[i]; }); }
	// ridge and hip caps: edges shared by two roof planes
	var edges = {};
	function k(p) { return [p.x, p.y, p.z].map(function (x) { return Math.round(x * 100); }).join(','); }
	P3.forEach(function (pts) {
		for (var i = 0; i < pts.length; i++) {
			var a = pts[i], b = pts[(i + 1) % pts.length], kk = [k(a), k(b)].sort().join('|');
			edges[kk] = edges[kk] || { a: a, b: b, n: 0 }; edges[kk].n++;
		}
	});
	Object.keys(edges).forEach(function (kk) {
		var e = edges[kk];
		if (type !== 'saw' && e.n >= 2 && (e.a.y > v.h + 0.3 || e.b.y > v.h + 0.3)) { if (rsp.r > 0) { var r = rod(e.a.clone().setY(e.a.y + 0.05), e.b.clone().setY(e.b.y + 0.05), rsp.r, ridgeM, rsp.seg || 8); if (r) { self.add(r); } } }
	});
	// gutters, downpipes, barge boards, rafters, snow guards, vents
	rd.lines.forEach(function (L) {
		var a = X(L.a[0], L.a[1], L.a[2]), b = X(L.b[0], L.b[1], L.b[2]);
		var m;
		if (L.kind === 'x') { return; }
		if (L.kind && L.kind.indexOf('vent:') === 0) { var vp = L.kind.slice(5).split(':'); self.roofVent(a, b, vp[0], vp[1]); return; }
		if (L.kind && L.kind.indexOf('snow:') === 0) { self.snowGuard(a, b, L.kind.slice(5)); return; }
		if (L.width === 0.17) {
			m = solid(L.color, 0.35, L.color === '#B87333' ? 0.9 : 0.5);
			self.add(rod(a.clone().setY(a.y - 0.1), b.clone().setY(b.y - 0.1), 0.075, m, 10));
			// downpipe at the end with the larger x (or z), against the wall – but only one per corner:
			// where two eaves meet, both gutters used to drop their own pipe side by side
			var e = a.x + a.z > b.x + b.z ? a : b, px, pz;
			if (Math.abs(a.z - b.z) < 0.01) { px = clamp(e.x, v.x0 + 0.2, v.x1 - 0.2); pz = e.z > v.y1 ? v.y1 + 0.1 : v.y0 - 0.1; }
			else { pz = clamp(e.z, v.y0 + 0.2, v.y1 - 0.2); px = e.x > v.x1 ? v.x1 + 0.1 : v.x0 - 0.1; }
			self.pipes = self.pipes || [];
			var near = self.pipes.some(function (q) { return Math.abs(q[0] - px) < 1.2 && Math.abs(q[1] - pz) < 1.2; });
			if (!near) {
				self.pipes.push([px, pz]);
				self.add(rod(new THREE.Vector3(px, e.y - 0.12, pz), new THREE.Vector3(px, 0.08, pz), 0.05, m, 8));
			}
		} else if (L.width >= 0.2 && L.width < 0.22 + 1e-6 && L.color !== '#3A3D40') { self.add(beam(a, b, 0.06, 0.24, solid(L.color, 0.6, L.color === '#3E4245' ? 0.5 : 0))); }
		else if (L.width === 0.1) { self.add(beam(a, b, 0.09, 0.12, solid(L.color, 0.75))); }
		else if (L.width === 0.07) { self.add(rod(a, b, 0.025, solid('#C9CDD0', 0.3, 0.8), 6)); }
		else { self.add(rod(a, b, L.width === 0.12 ? 0.18 : 0.09, solid(L.color, 0.5, 0.3), 8)); }
	});
};
// The frame of a roof plane from a line that runs up the slope (a → b): the uphill direction, the
// ridge-parallel axis and the outward normal. `slope` ("ux,uy,rise") is the fallback when a and b coincide.
function roofFrame(a, b, slope) {
	var U = b ? b.clone().sub(a) : new THREE.Vector3();
	if (U.lengthSq() < 1e-6) { var s = String(slope || '0,-1,0.6').split(',').map(Number); U.set(s[0] || 0, s[2] || 0.6, s[1] || 0); }
	if (U.lengthSq() < 1e-6) { U.set(0, 0.6, -1); }
	U.normalize();
	var hz = new THREE.Vector3(U.x, 0, U.z);
	if (hz.lengthSq() < 1e-6) { hz.set(0, 0, -1); }
	hz.normalize();
	var R = new THREE.Vector3(-hz.z, 0, hz.x), N = new THREE.Vector3().crossVectors(R, U).normalize();
	if (N.y < 0) { N.negate(); }
	return { up: U, axis: R, n: N };
}
// Snow guards along the eave (a → b): two rails on brackets, lying on the roof plane.
House.prototype.snowGuard = function (a, b, slope) {
	var f = roofFrame(a, null, slope), len = a.distanceTo(b), self = this;
	if (len < 0.6) { return; }
	var g = col(this.c.gutters === 'white' ? '#E8E8E6' : (this.c.gutters === 'black' ? '#1E2023' : (this.c.gutters === 'copper' ? '#B87333' : (this.c.gutters === 'anthracite' ? '#3A3D40' : '#C9CDD0'))), '#C9CDD0');
	var mt = solid(g, 0.35, 0.85);
	[0.1, 0.19].forEach(function (hgt) {
		var r = rod(a.clone().addScaledVector(f.n, hgt), b.clone().addScaledVector(f.n, hgt), 0.016, mt, 8);
		if (r) { self.add(r); }
	});
	var n = Math.max(2, Math.round(len / 0.9));
	for (var i = 0; i <= n; i++) {
		var p = a.clone().lerp(b, i / n);
		var br = rod(p.clone().addScaledVector(f.up, -0.14).addScaledVector(f.n, 0.01), p.clone().addScaledVector(f.up, 0.08).addScaledVector(f.n, 0.23), 0.018, mt, 6);
		if (br) { self.add(br); }
	}
};
// Roof ventilation element standing on the roof plane at a; a → b points up the slope (the ridge vent
// runs along the ridge instead). Plane-mounted types are turned onto the plane, free-standing ones stay upright.
House.prototype.roofVent = function (a, b, type, slope) {
	var dk = solid(shadeHex(col(this.c.roof_color, '#3A3D40'), -0.1), 0.6, 0.2), mt = solid('#B9BDC1', 0.3, 0.85), g = new THREE.Group(), self = this;
	function cyl(r0, r1, h, mat, y) { var m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 16), mat); m.position.y = y; m.castShadow = true; g.add(m); return m; }
	if (type === 'ridge_vent') { var rv = beam(a.clone().setY(a.y + 0.1), b.clone().setY(b.y + 0.1), 0.1, 0.16, solid('#2E3033', 0.5, 0.4)); if (rv) { this.add(rv); } return; }
	if (type === 'turbine') { cyl(0.11, 0.11, 0.35, mt, 0.18); var tb = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 14), mt); tb.scale.set(1, 0.85, 1); tb.position.y = 0.55; tb.castShadow = true; g.add(tb); cyl(0.26, 0.26, 0.03, mt, 0.42); }
	else if (type === 'mushroom') { cyl(0.07, 0.07, 0.18, dk, 0.09); cyl(0.24, 0.1, 0.07, dk, 0.22); }
	else if (type === 'pipe') { cyl(0.065, 0.065, 0.78, solid('#6A6E72', 0.5, 0.5), 0.39); cyl(0.0, 0.17, 0.12, dk, 0.84); }
	else if (type === 'solar_fan') { var bx = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.45), dk); bx.position.y = 0.06; g.add(bx); var sp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.4), solid('#1B2636', 0.25, 0.4)); sp.position.y = 0.16; sp.rotation.x = -0.35; g.add(sp); cyl(0.14, 0.14, 0.1, mt, 0.05); }
	else { var vt = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.38), dk); vt.position.y = 0.06; vt.castShadow = true; g.add(vt); var vh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.06), solid('#1E2023', 0.6)); vh.position.set(0, 0.11, 0.1); g.add(vh); }
	// vent tiles, mushrooms and solar fans sit flat on the tiles; a turbine and a pipe stand upright
	var fr = roofFrame(a, b, slope);
	if (type === 'tile_vent' || type === 'mushroom' || type === 'solar_fan' || !type) { g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), fr.n); }
	g.position.copy(a).addScaledVector(fr.n, 0.02); self.add(g);
};
House.prototype.flatRoof = function (v, r) {
	var c = this.c, h = v.h, fasc = solid(shadeHex(col(c.facade_color, '#F2EFE9'), c.arch_style === 'high_tech' ? -0.05 : 0.05), 0.8);
	var e = 0.1, top = h + 0.35, t = 0.25;
	if (r > 0) {
		this.add(roundSlab(v, r, e, h - 0.05, top, fasc, e - t));
		this.add(roundSlab(v, r, e - t + 0.01, h - 0.05, h + 0.08, roofMat(c)));
		v.flatTop = h + 0.08;
		return;
	}
	this.add(box(v.x0 - e, v.y0 - e, h - 0.05, v.x1 + e, v.y0 - e + t, top, fasc));
	this.add(box(v.x0 - e, v.y1 + e - t, h - 0.05, v.x1 + e, v.y1 + e, top, fasc));
	this.add(box(v.x0 - e, v.y0 - e, h - 0.05, v.x0 - e + t, v.y1 + e, top, fasc));
	this.add(box(v.x1 + e - t, v.y0 - e, h - 0.05, v.x1 + e, v.y1 + e, top, fasc));
	this.add(box(v.x0, v.y0, h - 0.05, v.x1, v.y1, h + 0.08, roofMat(c)));
	// metal coping on the parapet
	var cp = solid('#6E7378', 0.35, 0.7);
	this.add(box(v.x0 - e - 0.02, v.y1 + e - t - 0.02, top, v.x1 + e + 0.02, v.y1 + e + 0.02, top + 0.03, cp));
	this.add(box(v.x1 + e - t - 0.02, v.y0 - e - 0.02, top, v.x1 + e + 0.02, v.y1 + e + 0.02, top + 0.03, cp));
	this.add(box(v.x0 - e - 0.02, v.y0 - e - 0.02, top, v.x1 + e + 0.02, v.y0 - e + t + 0.02, top + 0.03, cp));
	this.add(box(v.x0 - e - 0.02, v.y0 - e - 0.02, top, v.x0 - e + t + 0.02, v.y1 + e + 0.02, top + 0.03, cp));
	v.flatTop = h + 0.08;
};
House.prototype.roofItems = function (v, type, info, vpl) {
	var c = this.c, pl = vpl || this.pl, self = this, W = v.x1 - v.x0, D = v.y1 - v.y0;
	if (type === 'saw') { return; }
	var solar = c.roof_solar || has(c.energy, 'solar') || !!SK()._style(c).pv;
	var ss = SK()._solar(c);
	var panelM = pbr('solar', { type: ss.t }, { roughness: ss.t === 'glass' ? 0.25 : 0.6, metalness: 0.35, normal: ss.tiles ? 1.2 : 0.8, clearcoat: 1, physical: true });
	var panelEdge = ss.frame ? solid(ss.frame, 0.4, 0.8) : panelM, pLift = ss.flush ? 0.03 : 0.12, pThick = ss.flush ? 0.025 : 0.04;
	function chimney(zTop) {
		var cs = SK()._chimney(c), cx = v.x0 + W * 0.7, cy = (v.y0 + v.y1) / 2 + 0.3, zt = zTop - 1.0 + cs.up;
		var mat = cs.mat === 'brick' ? pbr('brick', { color: cs.color }, { normal: 1.6 }) : (cs.mat === 'stone' ? pbr('stone', { color: cs.color }, { normal: 2 }) : (cs.metal ? solid(cs.color, 0.35, 0.75) : (cs.t === 'wide' ? pbr('render', { color: cs.color, texture: 'fine' }, { normal: 0.6 }) : pbr('render', { color: cs.color, texture: 'fine' }, { normal: 0.6 }))));
		if (cs.t === 'steel') {
			var fl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, zt - (v.h - 0.2), 20), mat); fl.position.copy(X(cx + 0.16, cy + 0.16, (v.h - 0.2 + zt) / 2)); fl.castShadow = true; self.add(fl);
			var rc = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.16, 20), solid(cs.cap, 0.35, 0.7)); rc.position.copy(X(cx + 0.16, cy + 0.16, zt + 0.08)); self.add(rc);
			return;
		}
		self.add(box(cx, cy, v.h - 0.5, cx + cs.w, cy + cs.d, zt, mat));
		self.add(box(cx - 0.06, cy - 0.06, zt, cx + cs.w + 0.06, cy + cs.d + 0.06, zt + 0.1, solid(cs.cap, 0.6)));
		if (cs.twin) {
			self.add(box(cx + cs.w / 2 - 0.03, cy - 0.04, zt, cx + cs.w / 2 + 0.03, cy + cs.d + 0.04, zt + 0.14, solid(cs.cap, 0.6)));
			[0.25, 0.75].forEach(function (f) { var pot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.3, 14), solid('#B8693F', 0.8)); pot.position.copy(X(cx + cs.w * f, cy + cs.d / 2, zt + 0.25)); pot.castShadow = true; self.add(pot); });
		} else if (cs.t === 'clad') {
			self.add(box(cx - 0.1, cy - 0.1, zt + 0.1, cx + cs.w + 0.1, cy + cs.d + 0.1, zt + 0.22, solid(cs.cap, 0.4, 0.6)));
		}
	}
	// solar modules (shared layout with the 2D sketch: whole modules inside the roof planes)
	function solarDraw() {
		if (!solar) { return; }
		SK()._solarFaces(c, v, pl, type, self.vols).forEach(function (F) {
			F.panels.forEach(function (q) {
				if (F.flat) {
					var x0 = q[0], y0 = q[1], z0 = v.flatTop + (ss.flush ? 0.05 : 0.15);
					self.add(polyMesh([X(x0, y0 + 0.935, z0), X(x0 + 1.7, y0 + 0.935, z0), X(x0 + 1.7, y0, z0 + 0.55), X(x0, y0, z0 + 0.55)], [panelM, panelEdge], { thick: 0.04 }));
					self.add(box(x0 + 0.1, y0 + 0.05, v.flatTop, x0 + 0.16, y0 + 0.11, z0 + 0.5, solid('#9DA1A4', 0.4, 0.8)));
					return;
				}
				var P = function (u, s2) { return X(F.o[0] + F.ux[0] * u + F.uy[0] * s2 + F.n[0] * pLift, F.o[1] + F.ux[1] * u + F.uy[1] * s2 + F.n[1] * pLift, F.o[2] + F.uy[2] * s2 + F.n[2] * pLift + 0.02); };
				var u0 = q[0] + 0.01, s0 = q[1] + 0.01, w = F.pw - 0.02, hh = F.ph - 0.02;
				self.add(polyMesh([P(u0, s0), P(u0 + w, s0), P(u0 + w, s0 + hh), P(u0, s0 + hh)], [panelM, panelEdge], { thick: pThick }));
			});
		});
	}
	if (!v.items) { solarDraw(); return; }
	if (type === 'flat') {
		solarDraw();
		if (c.chimney) { chimney(v.flatTop + 1.0); }
		return;
	}
	if (c.chimney) { chimney(v.h + (info ? info.rise : 0) + 1.0); }
	if (v.ridge === 'y') { solarDraw(); return; }
	var tp = Math.tan(pl.pitch * D2R), cosP = Math.cos(pl.pitch * D2R), sinP = Math.sin(pl.pitch * D2R);
	var slopeL = (type === 'shed' ? D : D / 2) / cosP;
	var hipIn = type === 'hip' || type === 'pyramid' ? D / 2 : 0;
	// point on the front roof plane: u along the eave, s up the slope, lift above the surface
	function onRoof(u, s, lift) { return X(v.x0 + u, v.y1 - s * cosP + lift * sinP, v.h + s * sinP + lift * cosP + 0.02); }
	function roofRect(u, s, w, hh, lift, mats, thick) {
		return polyMesh([onRoof(u, s, lift), onRoof(u + w, s, lift), onRoof(u + w, s + hh, lift), onRoof(u, s + hh, lift)], mats, { thick: thick });
	}
	var lay = SK()._roofLayout(c, v, pl, slopeL, hipIn, false);
	solarDraw();
	lay.wins.forEach(function (ux) {
		self.add(roofRect(ux, lay.winS, 0.78, 1.2, 0.08, [frameMat(c), frameMat(c)], 0.1));
		self.add(roofRect(ux + 0.07, lay.winS + 0.07, 0.64, 1.06, 0.1, [glassMat(c, self.night), frameMat(c)], 0.01));
	});
	var nd = lay.dorm.length;
	var wall = facadeMat(c, c.facade_main), rm = roofMat(c);
	for (var dd = 0; dd < nd; dd++) {
		var dw = 1.8, dx = v.x0 + lay.dorm[dd], yd = v.y1 - 1.0, z0 = v.h + 1.0 * tp, hw = 1.35, yb = yd - (hw + 0.8) / tp;
		var front = new THREE.Shape(); front.moveTo(0, 0); front.lineTo(dw, 0); front.lineTo(dw, hw); front.lineTo(dw / 2, hw + 0.75); front.lineTo(0, hw); front.lineTo(0, 0);
		var hole = new THREE.Path(); hole.moveTo(0.42, 0.18); hole.lineTo(1.38, 0.18); hole.lineTo(1.38, 1.18); hole.lineTo(0.42, 1.18); hole.lineTo(0.42, 0.18); front.holes.push(hole);
		var fg = new THREE.Group(); fg.position.copy(X(dx, yd - 0.15, z0 - 0.3)); fg.position.y = z0 - 0.3;
		var fm = new THREE.Mesh(new THREE.ExtrudeGeometry(front, { depth: 0.15, bevelEnabled: false }), wall); fm.castShadow = true; fm.receiveShadow = true;
		fg.add(fm); fg.add(lbox(0.42, 0.18, 0.02, 1.38, 1.18, 0.05, glassMat(c, this.night), true)); this.frameRect(fg, 0.42, 0.18, 1.38, 1.18, 0.0, 0.08, 0.06, frameMat(c));
		this.add(fg);
		var zt = z0 - 0.3 + hw, zr = zt + 0.75;
		[[dx, dx + dw], [dx + dw, dx]].forEach(function (pair) {
			var side = polyMesh([X(pair[0], yd, z0 - 0.3), X(pair[0], yd, zt), X(pair[0], yb, zt)], [wall, wall], { normal: new THREE.Vector3(pair[0] === dx ? -1 : 1, 0, 0), thick: 0.12 });
			self.add(side);
		});
		this.add(polyMesh([X(dx + dw + 0.15, yd + 0.2, zt - 0.08), X(dx + dw / 2, yd + 0.2, zr), X(dx + dw / 2, yb, zr), X(dx + dw + 0.15, yb, zt - 0.08)], [rm, solid('#E6E2DA', 0.8)], { thick: 0.1 }));
		this.add(polyMesh([X(dx - 0.15, yd + 0.2, zt - 0.08), X(dx + dw / 2, yd + 0.2, zr), X(dx + dw / 2, yb, zr), X(dx - 0.15, yb, zt - 0.08)], [rm, solid('#E6E2DA', 0.8)], { thick: 0.1 }));
	}
};
// Balconies on the upper floors (shared layout with the 2D sketch): slab, decking and the railing
// (glass, metal balusters, timber boards or a solid parapet) along the open edges.
House.prototype.balconyDraw = function (v, pl, railGlass, wood) {
	var c = this.c, self = this, BL = SK()._balconies(c, v, pl, this.vols);
	if (!BL.length) { return; }
	var FR = { front: [[v.x0, v.y1], [1, 0], [0, 1]], right: [[v.x1, v.y1], [0, -1], [1, 0]], back: [[v.x1, v.y0], [-1, 0], [0, -1]], left: [[v.x0, v.y0], [0, 1], [-1, 0]] };
	var metal = solid('#33373B', 0.4, 0.75), slabM = solid('#D8D4CC', 0.8), fac = facadeMat(c, c.facade_main);
	BL.forEach(function (b) {
		if (b.type === 'french') { return; }
		var F = FR[b.face], g = new THREE.Group(), mx = new THREE.Matrix4().makeBasis(X(F[1][0], F[1][1], 0), new THREE.Vector3(0, 1, 0), X(F[2][0], F[2][1], 0));
		mx.setPosition(X(F[0][0], F[0][1], 0)); g.matrixAutoUpdate = false; g.matrix.copy(mx);
		var u0 = b.u0, u1 = b.u1, d = b.d, z = b.z, L = { m: [], g: [], w: [], s: [] };
		g.add(lbox(u0, z - 0.22, 0, u1, z, d, slabM));
		if (b.type === 'wood') { g.add(lbox(u0 + 0.02, z, 0.0, u1 - 0.02, z + 0.03, d - 0.02, pbr('deck', { color: '#A97B52' }, { normal: 1 }), true)); }
		// railing runs: the outer edge (along u) and the open ends (along w), each with a thickness inwards
		var runs = [{ u: true, a0: u0, a1: u1, at: d }];
		if (b.endA) { runs.push({ u: false, a0: 0, a1: d, at: u0, dir: 1 }); }
		if (b.endB) { runs.push({ u: false, a0: 0, a1: d, at: u1, dir: -1 }); }
		runs.forEach(function (r) {
			function put(list, p0, p1, y0, y1, th) {
				if (r.u) { list.push([r.a0 + p0, y0, r.at - 0.02 - th, r.a0 + p1, y1, r.at - 0.02]); }
				else if (r.dir > 0) { list.push([r.at + 0.02, y0, r.a0 + p0, r.at + 0.02 + th, y1, r.a0 + p1]); }
				else { list.push([r.at - 0.02 - th, y0, r.a0 + p0, r.at - 0.02, y1, r.a0 + p1]); }
			}
			var len = r.a1 - r.a0;
			if (b.type === 'glass') { put(L.g, 0, len, z + 0.1, z + 1.0, 0.02); put(L.m, 0, len, z, z + 0.1, 0.06); put(L.m, 0, len, z + 1.0, z + 1.05, 0.06); }
			else if (b.type === 'metal') { put(L.m, 0, len, z + 0.97, z + 1.02, 0.05); put(L.m, 0, len, z + 0.08, z + 0.11, 0.03); for (var a = 0.04; a < len - 0.02; a += 0.11) { put(L.m, a, a + 0.018, z + 0.11, z + 0.97, 0.018); } }
			else if (b.type === 'wood') { for (var bw = 0.02; bw < len - 0.06; bw += 0.16) { put(L.w, bw, bw + 0.1, z, z + 0.98, 0.03); } put(L.w, 0, len, z + 0.98, z + 1.04, 0.08); }
			else { put(L.s, 0, len, z, z + 1.0, 0.15); put(L.m, 0, len, z + 1.0, z + 1.04, 0.19); }
		});
		[[L.m, metal], [L.g, railGlass], [L.w, wood], [L.s, fac]].forEach(function (q) { var mm = lboxes(q[0], q[1], q[1] === railGlass); if (mm) { g.add(mm); } });
		self.add(g);
	});
};
// Canopy and steps at the entrance; porch, balcony and the massing signatures (frame, veranda,
// chalet balconies, steel exoskeleton, roof-terrace railing) around a volume.
House.prototype.frontExtras = function (v, fp, type, vpl) {
	var c = this.c, pl = vpl || this.pl, st = SK()._style(c), fcol = col(c.facade_color, '#F2EFE9'), self = this;
	var dp = fp && fp.door, dx0 = v.x0 + (fp ? fp.off : 0);
	if (dp && c.entrance_canopy) {
		var dx = dx0 + dp.x + dp.w / 2 - 0.95;
		this.add(box(dx, v.y1, pl.plinth + 2.55, dx + 1.9, v.y1 + 1.2, pl.plinth + 2.72, solid(shadeHex(fcol, -0.12), 0.7)));
	}
	if (dp && (c.exterior_steps || c.basement || c.accessible)) {
		var ex0 = dx0 + dp.x - 0.35, ex1 = ex0 + dp.w + 0.7, sm = pbr('slabs', { color: '#C9C2B6' }, { normal: 1 });
		if (c.accessible) {
			var rz = pl.plinth, rl = Math.max(1.2, rz * 12);
			this.add(box(ex0, v.y1, 0, ex1, v.y1 + 1.3, rz, sm));
			this.add(polyMesh([X(ex1, v.y1 + 1.3, rz), X(ex1 + rl, v.y1 + 1.3, 0.02), X(ex1 + rl, v.y1, 0.02), X(ex1, v.y1, rz)], [sm, solid('#B9B4AA', 0.9)], { thick: 0.15 }));
			this.add(rod(X(ex1, v.y1 + 1.3, rz + 0.9), X(ex1 + rl, v.y1 + 1.3, 0.9), 0.025, solid('#8C9196', 0.3, 0.9)));
		} else {
			var nst = Math.max(2, Math.round(pl.plinth / 0.17)), sh = pl.plinth / nst;
			for (var i = 0; i < nst; i++) { this.add(box(ex0, v.y1, i * sh, ex1, v.y1 + 0.3 * (nst - i), (i + 1) * sh, sm)); }
		}
	}
	if (v.porch || (v.main && st.porch)) {
		var pc = v.porch || st.porch, px0 = v.x0 + 0.3, px1 = v.x1 - 0.3, pd = 2.2, pz = pl.plinth + 2.7, rm = roofMat(c);
		this.add(box(px0, v.y1, 0, px1, v.y1 + pd, pl.plinth, pbr('deck', { color: '#A97B52' }, { normal: 1 })));
		for (var p = 0; p <= Math.floor((px1 - px0) / 2.6); p++) { var ppx = Math.min(px1 - 0.18, px0 + p * 2.6); this.add(box(ppx, v.y1 + pd - 0.18, pl.plinth, ppx + 0.16, v.y1 + pd - 0.02, pz, solid(pc, 0.6))); }
		this.add(polyMesh([X(px0 - 0.2, v.y1 + pd + 0.3, pz), X(px1 + 0.2, v.y1 + pd + 0.3, pz), X(px1 + 0.2, v.y1, pz + 0.75), X(px0 - 0.2, v.y1, pz + 0.75)], [rm, solid('#E6E2DA', 0.8)], { thick: 0.12 }));
	}
	var wood = pbr('wood', { color: '#9C6B44' }, { normal: 1 });
	var railGlass = cached('balglass', function () { return stdMat({ color: '#BFD6DE', roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: 0.32, envMapIntensity: 1.5 }); });
	this.balconyDraw(v, pl, railGlass, wood);
	// modern minimal: a deep frame around the glazed front
	if (v.frame && type === 'flat') {
		var frm = solid(shadeHex(fcol, 0.04), 0.8), dy = 1.5;
		this.add(box(v.x0 - 0.35, v.y1 - 0.3, v.h + 0.05, v.x1 + 0.35, v.y1 + dy, v.h + 0.55, frm));
		this.add(box(v.x0 - 0.35, v.y1, 0, v.x0, v.y1 + dy, v.h + 0.05, frm));
		this.add(box(v.x1, v.y1, 0, v.x1 + 0.35, v.y1 + dy, v.h + 0.05, frm));
	}
	// japandi: timber veranda (engawa) under the deep eave, on slender posts
	if (v.veranda) {
		var ez = type === 'flat' ? v.h : v.h - (pl.eave || 0) * Math.tan(pl.pitch * D2R) - 0.05, dk = pbr('deck', { color: '#A97B52' }, { normal: 1.2 }), pm = pbr('wood', { color: '#6B4A33' }, { normal: 1 });
		this.add(box(v.x0, v.y1, 0, v.x1, v.y1 + 1.5, pl.plinth, dk));
		for (var px = v.x0 + 0.3; px < v.x1 - 0.1; px += 2.4) { this.add(box(px, v.y1 + 1.25, pl.plinth, px + 0.14, v.y1 + 1.39, ez, pm)); }
	}
	// alpine chalet: timber balconies along the front and the side
	if (v.balc && (pl.floors > 1 || pl.attic)) {
		var cz = pl.plinth + pl.FH, deck = pbr('deck', { color: '#A97B52' }, { normal: 1 });
		this.add(box(v.x0 + 0.2, v.y1, cz - 0.22, v.x1 - 0.2, v.y1 + 1.3, cz, deck));
		for (var sx = v.x0 + 0.25; sx < v.x1 - 0.25; sx += 0.16) { this.add(box(sx, v.y1 + 1.22, cz, sx + 0.08, v.y1 + 1.3, cz + 0.95, wood)); }
		this.add(box(v.x0 + 0.2, v.y1 + 1.2, cz + 0.95, v.x1 - 0.2, v.y1 + 1.32, cz + 1.05, wood));
		this.add(box(v.x1, v.y0 + 0.6, cz - 0.22, v.x1 + 1.2, v.y1, cz, deck));
		for (var sy = v.y0 + 0.65; sy < v.y1 - 0.05; sy += 0.16) { this.add(box(v.x1 + 1.12, sy, cz, v.x1 + 1.2, sy + 0.08, cz + 0.95, wood)); }
		this.add(box(v.x1 + 1.1, v.y0 + 0.6, cz + 0.95, v.x1 + 1.22, v.y1, cz + 1.05, wood));
	}
	// high-tech: steel exoskeleton with walkways and an overhanging roof plate
	if (v.exo) {
		var stl = solid('#5E6266', 0.35, 0.7), e = 0.9, zt = v.h + 0.45;
		var nx = Math.max(2, Math.round((v.x1 - v.x0 + 2 * e) / 3)), ny = Math.max(2, Math.round((v.y1 - v.y0 + 2 * e) / 3));
		for (var ix = 0; ix <= nx; ix++) {
			var cx = v.x0 - e + (v.x1 - v.x0 + 2 * e) * ix / nx;
			this.add(box(cx - 0.1, v.y1 + e - 0.1, 0, cx + 0.1, v.y1 + e + 0.1, zt, stl));
			this.add(box(cx - 0.1, v.y0 - e - 0.1, 0, cx + 0.1, v.y0 - e + 0.1, zt, stl));
		}
		for (var iy = 1; iy < ny; iy++) {
			var cy = v.y0 - e + (v.y1 - v.y0 + 2 * e) * iy / ny;
			this.add(box(v.x1 + e - 0.1, cy - 0.1, 0, v.x1 + e + 0.1, cy + 0.1, zt, stl));
			this.add(box(v.x0 - e - 0.1, cy - 0.1, 0, v.x0 - e + 0.1, cy + 0.1, zt, stl));
		}
		for (var k = 1; k < pl.floors; k++) {
			var z = pl.plinth + k * pl.FH;
			if (z >= v.h) { break; }
			this.add(box(v.x0 - e, v.y1, z - 0.18, v.x1 + e, v.y1 + e + 0.1, z, pbr('louvre', { color: '#8A8F94' }, { normal: 1 })));
			this.add(box(v.x0 - e, v.y1 + e + 0.06, z, v.x1 + e, v.y1 + e + 0.1, z + 1.0, railGlass, { noCast: true }));
			this.add(box(v.x0 - e, v.y1 + e + 0.04, z + 1.0, v.x1 + e, v.y1 + e + 0.12, z + 1.05, stl));
		}
		this.add(box(v.x0 - e - 0.15, v.y0 - e - 0.15, v.h + 0.35, v.x1 + e + 0.15, v.y1 + e + 0.15, v.h + 0.5, solid('#C9CCCE', 0.5, 0.3)));
	}
	// bauhaus: glass railing around the roof terrace
	if (v.terraceRoof && type === 'flat') {
		var zr = v.h + 0.35;
		this.add(box(v.x0, v.y1 + 0.02, zr, v.x1, v.y1 + 0.06, zr + 1.0, railGlass, { noCast: true }));
		this.add(box(v.x1 + 0.02, v.y0, zr, v.x1 + 0.06, v.y1, zr + 1.0, railGlass, { noCast: true }));
		this.add(box(v.x0, v.y1 + 0.0, zr + 1.0, v.x1 + 0.08, v.y1 + 0.08, zr + 1.05, solid('#5A6066', 0.4, 0.7)));
	}
	void self;
};
// Semi-detached / row: party wall fins and the neighbours' entrance doors.
House.prototype.units = function (v) {
	var c = this.c, pl = this.pl, fcol = col(c.facade_color, '#F2EFE9');
	for (var u = 1; u < pl.units; u++) {
		var ux = v.x0 + pl.unitW * u;
		this.add(box(ux - 0.15, v.y1, 0, ux + 0.15, v.y1 + 0.35, v.h + 0.2, solid(shadeHex(fcol, -0.18), 0.8)));
		var dx = ux + pl.unitW * 0.26;
		this.add(box(dx, v.y1 - 0.05, pl.plinth, dx + 1.05, v.y1 + 0.02, pl.plinth + 2.3, solid(col(c.entrance_door_color, '#2B2E31'), 0.45, 0.2)));
	}
};
// Terrace, garage / carport, building services – parts of the "house" the camera frames.
House.prototype.extras = function () {
	var c = this.c, pl = this.pl, vols = this.vols, mainV = vols[0], self = this;
	var W = pl.W, D = pl.D, maxX = SK()._siteBox(vols).x1;
	var gf = c.garden_features || [];
	var ta = clamp(num(c.terrace_area, 0), 0, 200);
	this.ta = ta;
	if (ta > 0) {
		// centred on the terrace door, inside the free part of the main front wall (shared with the 2D sketch)
		var tr = SK()._terrace(c, mainV, vols, ta), td = tr.y1 - tr.y0, tw = tr.x1 - tr.x0, tx0 = tr.x0, ty1 = tr.y1;
		this.terrace = tr;
		var tfc = { wpc: '#7A6E64', wood: '#A97B52', stone: '#CFC6B6', ceramic: '#BEB8AE' }[c.terrace_floor || 'wpc'];
		var tm = c.terrace_floor === 'stone' || c.terrace_floor === 'ceramic' ? pbr('slabs', { color: tfc }, { normal: 1 }) : pbr('deck', { color: tfc }, { normal: 1.2 });
		if (c.season === 'winter') { tm = pbr('snow', {}, { normal: 0.4 }); }
		this.add(box(tx0, mainV.y1, 0, tx0 + tw, ty1, 0.18, tm));
		if (has(c.shading, 'pergola') || has(gf, 'pergola') || c.outdoor_covered) {
			var ph = pl.plinth + 2.6, pcol = c.arch_style === 'high_tech' || c.arch_style === 'industrial' ? '#2E3135' : '#8A6A4C';
			var pm = pcol === '#2E3135' ? solid(pcol, 0.4, 0.6) : pbr('wood', { color: pcol }, { normal: 1 });
			[[tx0 + 0.1, ty1 - 0.2], [tx0 + tw - 0.25, ty1 - 0.2]].forEach(function (q) { self.add(box(q[0], q[1] - 0.15, 0.18, q[0] + 0.15, q[1], ph, pm)); });
			this.add(box(tx0, ty1 - 0.2, ph, tx0 + tw, ty1 - 0.04, ph + 0.18, pm));
			if (c.outdoor_covered) { this.add(box(tx0, mainV.y1, ph + 0.18, tx0 + tw, ty1, ph + 0.3, solid(shadeHex(col(c.facade_color, '#F2EFE9'), -0.1), 0.7))); }
			else { for (var bb = 0; bb < tw; bb += 0.55) { this.add(box(tx0 + bb, mainV.y1, ph + 0.18, tx0 + bb + 0.1, ty1, ph + 0.32, pm)); } }
		}
		if (has(gf, 'garden_furniture') || has(gf, 'outdoor_kitchen')) { this.furniture(tx0 + tw * 0.4, mainV.y1 + td * 0.35, 0.18, has(gf, 'outdoor_kitchen')); }
	}
	var garage = c.garage || 'none';
	if (garage !== 'none') {
		var gx0 = garage === 'separate' ? maxX + 2.2 : maxX + 0.4, gW = garage === 'garage_2' ? 6.2 : 3.4, gD = 6.2;
		var gy1 = garage === 'separate' ? D * 0.8 : Math.min(D, gD), gy0 = gy1 - gD, gh = 2.9;
		this.garage = { x0: gx0, x1: gx0 + gW, y0: gy0, y1: gy1 };
		var acc = c.facade_accent || [], gm = acc.length ? accentMat(c, acc[0]) : facadeMat(c, c.facade_main);
		if (garage === 'carport') {
			var cm = solid('#3A3D40', 0.45, 0.5);
			[[gx0, gy1], [gx0 + gW - 0.15, gy1], [gx0, gy0 + 0.15], [gx0 + gW - 0.15, gy0 + 0.15]].forEach(function (q) { self.add(box(q[0], q[1] - 0.15, 0, q[0] + 0.15, q[1], gh, cm)); });
			this.add(box(gx0 - 0.1, gy0, gh, gx0 + gW + 0.1, gy1 + 0.2, gh + 0.25, c.roof_surface === 'green' ? pbr('green', {}, { normal: 2 }) : solid('#5A5E62', 0.6, 0.3)));
			var pcar = SK()._vehicles(c).filter(function (k) { return k !== 'motorcycle' && k !== 'bicycle'; })[0];
			if (pcar) { this.add(life(INT.vehicle(INT.mats(c), pcar, col(c.car_color, '#3C4148')), gx0 + gW / 2, gy1 - 2.975, Math.PI / 2)); }
		} else {
			var doors = garage === 'garage_2' ? 2 : 1, dw = garage === 'garage_2' ? 2.5 : 2.6;
			var s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(gW, 0); s.lineTo(gW, gh); s.lineTo(0, gh); s.lineTo(0, 0);
			for (var d = 0; d < doors; d++) { var gxx = d * (gW / doors) + (gW / doors - dw) / 2; var hp = new THREE.Path(); hp.moveTo(gxx, 0); hp.lineTo(gxx + dw, 0); hp.lineTo(gxx + dw, 2.25); hp.lineTo(gxx, 2.25); hp.lineTo(gxx, 0); s.holes.push(hp); }
			var fw = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false }), gm); fw.position.copy(X(gx0, gy1 - 0.3, 0)); fw.castShadow = true; fw.receiveShadow = true;
			this.add(fw);
			this.add(box(gx0, gy0, 0, gx0 + gW, gy1 - 0.3, gh, gm));
			for (var d2 = 0; d2 < doors; d2++) { var gx2 = gx0 + d2 * (gW / doors) + (gW / doors - dw) / 2; this.add(box(gx2, gy1 - 0.22, 0, gx2 + dw, gy1 - 0.12, 2.25, pbr('garagedoor', { color: shadeHex(col(c.window_frame_color, '#2F3235'), 0.12) }, { normal: 1.4 }))); }
			this.add(box(gx0 - 0.08, gy0 - 0.08, gh, gx0 + gW + 0.08, gy1 + 0.08, gh + 0.22, solid(shadeHex(col(c.facade_color, '#F2EFE9'), 0.05), 0.8)));
			this.add(box(gx0 + 0.15, gy0 + 0.15, gh + 0.2, gx0 + gW - 0.15, gy1 - 0.15, gh + 0.235, c.roof_surface === 'green' ? pbr('green', {}, { normal: 2 }) : pbr('gravel', { color: '#A9A49B' }, { normal: 2 })));
		}
	}
	// building services on the ground
	var en = c.energy || [];
	var acT = c.ac_units || 'none', acWhite = solid('#EDEFF0', 0.45, 0.2), acFan = solid('#5E6266', 0.5, 0.4);
	if (acT !== 'none') {
		var acFanAt = function (x, y, z, axis) { var fn = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 24), acFan); if (axis === 'x') { fn.rotation.z = Math.PI / 2; } else { fn.rotation.x = Math.PI / 2; } fn.position.copy(X(x, y, z)); self.add(fn); };
		if (acT === 'wall') {
			var wy = D * 0.3, wz = pl.plinth + 2.0;
			this.add(box(mainV.x1, wy, wz, mainV.x1 + 0.32, wy + 0.85, wz + 0.6, acWhite));
			acFanAt(mainV.x1 + 0.33, wy + 0.4, wz + 0.3, 'x');
			this.add(rod(X(mainV.x1, wy + 0.05, wz - 0.05), X(mainV.x1 + 0.28, wy + 0.05, wz - 0.05), 0.012, solid('#8C9196', 0.4, 0.8), 6));
			this.add(box(mainV.x1, wy + 0.1, wz + 0.6, mainV.x1 + 0.02, wy + 0.78, wz + 0.64, solid('#9DA1A4', 0.5, 0.3)));
		} else if (acT === 'roof' && c.roof_type === 'flat') {
			var rz = (mainV.flatTop || mainV.h + 0.08);
			this.add(box(mainV.x1 - 2.4, mainV.y0 + 1.0, rz, mainV.x1 - 1.4, mainV.y0 + 1.5, rz + 0.8, acWhite));
			acFanAt(mainV.x1 - 1.9, mainV.y0 + 1.51, rz + 0.4, 'y');
		} else {
			this.add(box(mainV.x1 + 0.1, D * 0.35 - 0.1, 0, mainV.x1 + 0.9, D * 0.35 + 1.2, 0.05, solid('#B9B4AA', 0.9)));
			this.add(box(mainV.x1 + 0.25, D * 0.35, 0.05, mainV.x1 + 0.75, D * 0.35 + 1.1, 0.95, acWhite));
			acFanAt(mainV.x1 + 0.76, D * 0.35 + 0.55, 0.55, 'x');
			if (acT === 'screened') { var scm = pbr('wood', { color: '#A97B52' }, { normal: 1 }); for (var sq = 0; sq < 9; sq++) { this.add(box(mainV.x1 + 0.9, D * 0.35 - 0.15 + sq * 0.15, 0, mainV.x1 + 0.97, D * 0.35 - 0.07 + sq * 0.15, 1.3, scm)); } this.add(box(mainV.x1 + 0.88, D * 0.35 - 0.15, 1.3, mainV.x1 + 0.99, D * 0.35 + 1.2, 1.35, scm)); }
		}
	}
	if (has(en, 'heat_pump') && acT !== 'ground' && acT !== 'screened') {
		this.add(box(mainV.x1 + 0.25, D * 0.35, 0.1, mainV.x1 + 0.75, D * 0.35 + 1.1, 0.95, solid('#EDEFF0', 0.45, 0.2)));
		var fan = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 24), solid('#5E6266', 0.5, 0.4)); fan.rotation.z = Math.PI / 2; fan.position.copy(X(mainV.x1 + 0.76, D * 0.35 + 0.55, 0.52)); this.add(fan);
	}
	if (has(en, 'ev_charger')) {
		var evx = garage === 'none' ? maxX + 0.5 : this.garage.x0 - 0.25, evy = garage === 'none' ? D + 0.4 : this.garage.y1 + 0.3;
		this.add(box(evx, evy, 0, evx + 0.22, evy + 0.18, 1.3, solid('#2B2E31', 0.4, 0.3)));
		this.add(box(evx + 0.04, evy + 0.18, 0.95, evx + 0.18, evy + 0.19, 1.15, solid('#3A9A6A', 0.3, 0, { emissive: '#3AD07A', emissiveIntensity: 0.8 })));
	}
	if (has(en, 'rainwater') || has(gf, 'rainwater')) {
		var tank = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.15, 24), solid('#5C6B5A', 0.6)); tank.position.copy(X(mainV.x1 + 0.5, mainV.y1 - 0.5, 0.58)); tank.castShadow = true; this.add(tank);
	}
};
House.prototype.furniture = function (x, y, z, kitchen) {
	var wm = pbr('wood', { color: '#8A6A4C' }, { normal: 1 }), cush = solid('#E7E1D6', 0.95);
	if (MODELS_ON && !kitchen) {
		// the same pieces, as two groups a real model can replace (table, lounge bench); switched off the
		// code below builds exactly what it always did
		var self = this, tbl = new THREE.Group(), bench = new THREE.Group();
		tbl.userData.item = 'garden_table'; tbl.userData.value = 'table'; bench.userData.item = 'garden_bench'; bench.userData.value = 'bench';
		tbl.add(box(x, y, z + 0.7, x + 1.6, y + 0.9, z + 0.75, wm));
		[[x + 0.1, y + 0.1], [x + 1.45, y + 0.1], [x + 0.1, y + 0.75], [x + 1.45, y + 0.75]].forEach(function (q) { tbl.add(box(q[0], q[1], z, q[0] + 0.06, q[1] + 0.06, z + 0.7, wm)); });
		bench.add(box(x - 0.2, y + 1.2, z, x + 1.8, y + 2.0, z + 0.4, cush));
		bench.add(box(x - 0.2, y + 1.85, z, x + 1.8, y + 2.0, z + 0.8, cush));
		[tbl, bench].forEach(function (g2) { self.add(g2); (self.modelPieces = self.modelPieces || []).push(g2); });
		return;
	}
	if (kitchen) { this.add(box(x, y, z, x + 2.2, y + 0.7, z + 0.9, pbr('concrete', { color: '#8E8B86' }, { normal: 1 }))); this.add(box(x - 0.02, y - 0.02, z + 0.9, x + 2.22, y + 0.72, z + 0.95, solid('#2B2E31', 0.3, 0.2))); return; }
	this.add(box(x, y, z + 0.7, x + 1.6, y + 0.9, z + 0.75, wm));
	[[x + 0.1, y + 0.1], [x + 1.45, y + 0.1], [x + 0.1, y + 0.75], [x + 1.45, y + 0.75]].forEach(function (q) { this.add(box(q[0], q[1], z, q[0] + 0.06, q[1] + 0.06, z + 0.7, wm)); }, this);
	this.add(box(x - 0.2, y + 1.2, z, x + 1.8, y + 2.0, z + 0.4, cush));
	this.add(box(x - 0.2, y + 1.85, z, x + 1.8, y + 2.0, z + 0.8, cush));
};
/* ------------------------------------------------------------------ site: plot, paths, garden, fence */
House.prototype.site = function () {
	var c = this.c, pl = this.pl, vols = this.vols, mainV = vols[0], self = this, season = c.season || 'summer', K = SK();
	var W = pl.W, D = pl.D, bbx = K._siteBox(vols), maxY = bbx.y1, maxX = bbx.x1;
	var garage = c.garage || 'none', gf = c.garden_features || [], gs = c.garden_style || 'natural';
	var front = maxY + 6.5, back = bbx.y0 - 6, left = bbx.x0 - 6.5, right = (this.garage ? this.garage.x1 : maxX) + 6;
	var plot = K._plot(c, vols, this.garage ? this.garage.x1 : maxX + 3.8);
	if (plot) {
		left = Math.min(left, plot.x0 - 1.2); right = Math.max(right, plot.x1 + 1.2); front = Math.max(front, plot.yF + 1.2);
		if (plot.yB !== null) { back = Math.min(back, plot.yB - 1.2); }
	}
	this.plotBox = { left: left, right: right, front: front, back: back };
	var flat = function (x0, y0, x1, y1, z, mat) { var m = box(x0, y0, z - 0.02, x1, y1, z, mat, { noCast: true }); self.add(m, false); return m; };
	var ext = { left: left, right: right, front: front, back: back }, fence = c.fence || 'none', fy = K._siteEdge(c, front, plot);
	// one garden plan for the 2D sketch and the 3D view: inside the plot, nothing on paved surfaces
	var G = K._garden(c, vols, pl, ext, plot, this.garage || null, this.terrace || null, fy);
	this.gardenPlan = G;
	// lawn of the plot (slightly raised over the surrounding meadow)
	var lawn = has(gf, 'lawn') || !c.garden_features;
	flat(G.lawn.x0, G.lawn.y0, G.lawn.x1, G.lawn.y1, 0.01, groundKind(c, lawn ? 'grass' : 'meadow'));
	var doorMid = G.ent.x;
	if (G.path) { flat(G.path.x0, G.path.y0, G.path.x1, G.path.y1, 0.02, groundKind(c, 'slabs')); }
	var dk = { gravel: 'gravel', grass: 'grasspavers', asphalt: 'asphalt' }[c.driveway] || 'pavers';
	flat(G.drive.x0, G.drive.y0, G.drive.x1, G.drive.y1, 0.02, groundKind(c, dk));
	if (G.gravel) { flat(G.gravel.x0, G.gravel.y0, G.gravel.x1, G.gravel.y1, 0.012, groundKind(c, 'gravel')); }
	if (G.pool) {
		var pr = G.pool, px0 = pr.x0, py0 = pr.y0, poolW = pr.x1 - pr.x0, pdp = pr.y1 - pr.y0;
		flat(px0, py0, px0 + poolW, py0 + pdp, 0.06, groundKind(c, 'slabs'));
		var water = cached('water', function () { return stdMat({ color: '#2D8FB0', roughness: 0.05, metalness: 0, clearcoat: 1, envMapIntensity: 1.6 }); });
		flat(px0 + 0.3, py0 + 0.3, px0 + poolW - 0.3, py0 + pdp - 0.3, 0.07, water);
	}
	G.flats.forEach(function (f) { flat(f.x0, f.y0, f.x1, f.y1, 0.03, groundKind(c, f.kind)); });
	if (G.shed) { var sh = G.shed; this.add(box(sh.x0 + 0.1, sh.y0 + 0.1, 0, sh.x1 - 0.1, sh.y1 - 0.1, 2.3, pbr('wood', { color: '#9A7048' }, { normal: 1 })), false); this.add(box(sh.x0, sh.y0, 2.3, sh.x1, sh.y1, 2.42, solid('#3A3D40', 0.6)), false); }
	if (G.firepit) {
		var fp = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.65, 0.35, 24), pbr('stone', { color: '#8D8576' }, { normal: 2 })); fp.position.copy(X(G.firepit.x, G.firepit.y, 0.17)); this.add(fp, false);
		var fire = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 12), solid('#FF8A30', 0.8, 0, { emissive: '#FF7A20', emissiveIntensity: this.night ? 4 : 1.5 })); fire.position.copy(X(G.firepit.x, G.firepit.y, 0.6)); this.add(fire, false);
	}
	if (G.pergola) {
		var pgx = G.pergola.x0, pgy = G.pergola.y0, pm = pbr('wood', { color: '#8A6A4C' }, { normal: 1 });
		[[pgx, pgy], [pgx + 2.8, pgy], [pgx, pgy + 2.4], [pgx + 2.8, pgy + 2.4]].forEach(function (q) { self.add(box(q[0], q[1], 0, q[0] + 0.14, q[1] + 0.14, 2.5, pm), false); });
		for (var pb = 0; pb < 3; pb += 0.45) { this.add(box(pgx + pb, pgy - 0.1, 2.5, pgx + pb + 0.08, pgy + 2.6, 2.62, pm), false); }
	}
	if (G.furniture) { this.furniture(G.furniture.x, G.furniture.y, 0, G.furniture.kitchen); }
	G.lights.forEach(function (q) {
		self.add(box(q[0] - 0.06, q[1] - 0.06, 0, q[0] + 0.06, q[1] + 0.06, 0.6, solid('#2E3135', 0.4, 0.5)), false);
		self.add(box(q[0] - 0.07, q[1] - 0.07, 0.48, q[0] + 0.07, q[1] + 0.07, 0.56, self.night ? solid('#3A3020', 0.3, 0, { emissive: '#FFD9A0', emissiveIntensity: 4 }) : solid('#D8D8D2', 0.3)), false);
	});
	G.plants.forEach(function (p) { self.plant(p.kind, p.x, p.y, p.size, p.seed); });
	// vehicles, people and pets (shared plan with the 2D sketch)
	if (G.vehicles.length || G.people.length || G.pets.length || G.kennel) {
		var LM = INT.mats(c), paint = col(c.car_color, '#3C4148');
		G.vehicles.forEach(function (vh) {
			var two = vh.type === 'motorcycle' || vh.type === 'bicycle';
			if (vh.port && !two) { return; }
			self.add(life(vh.type === 'motorcycle' ? INT.motorcycle(LM, paint) : (vh.type === 'bicycle' ? INT.bicycle(LM, paint) : INT.vehicle(LM, vh.type, paint)), vh.x, vh.y, Math.PI / 2), false);
		});
		if (G.charger) { var ch = new THREE.Group(); ch.add(box(-0.1, -0.08, 0, 0.1, 0.08, 1.0, solid('#2B2E31', 0.4, 0.3))); var wb = INT.wallbox(LM); wb.position.set(0, -0.35, 0.08); ch.add(wb); self.add(life(ch, G.charger.x, G.charger.y, 0), false); }
		if (G.kennel) { self.add(life(INT.kennel(LM), G.kennel.x, G.kennel.y, 0.3), false); }
		G.people.forEach(function (pp) { self.add(life(INT.person(LM, pp.kind, pp.pose, pp.seed), pp.x, pp.y, pp.rot), false); });
		G.pets.forEach(function (pp) { self.add(life(pp.kind === 'cat' ? INT.cat(LM, pp.seed, pp.pose) : INT.dog(LM, pp.kind === 'dog_small' ? 'small' : 'large', pp.seed, pp.pose), pp.x, pp.y, pp.rot, pp.z), false); });
	}
	if (G.hedge) {
		var hm = c.season === 'winter' ? pbr('snow', {}, { normal: 0.5 }) : pbr('hedge', { season: season }, { normal: 2.5 });
		this.add(box(G.hedge.x0, G.hedge.y0, 0, G.hedge.x1, G.hedge.y1, 1.5, hm), false);
	}
	// fence: the front with openings for the path (optional gate) and the driveway, the sides and the back along the plot
	if (G.fence) {
		var F = G.fence, fz = { slats: 1.6, mesh: 1.4, masonry: 1.3, gabion: 1.2 }[fence], gateOn = c.gate !== false, gx = doorMid - 0.6;
		var fm = fence === 'slats' ? (c.arch_style === 'scandinavian' ? pbr('wood', { color: '#9C978E' }, { normal: 1 }) : solid('#3B3E42', 0.45, 0.5)) : null;
		var meshM = cached('meshfence', function () { return new THREE.MeshStandardMaterial({ color: '#5B6B5A', roughness: 0.6, metalness: 0.4, transparent: true, opacity: 0.35 }); });
		// one fence run from a to b along x (alongY = false) or along y, centred on the line `at`
		var run = function (a, b, at, alongY) {
			var B2 = function (u0, v0, z0, u1, v1, z1, m, o) { return alongY ? box(v0, u0, z0, v1, u1, z1, m, o) : box(u0, v0, z0, u1, v1, z1, m, o); };
			if (fence === 'slats') {
				var n = Math.floor((b - a) / 0.16), geo = alongY ? boxGeo(0.04, fz, 0.11) : boxGeo(0.11, fz, 0.04), im = new THREE.InstancedMesh(geo, fm, Math.max(1, n)), mt = new THREE.Matrix4();
				for (var i = 0; i < n; i++) { var u = a + i * 0.16 + 0.055; if (alongY) { mt.makeTranslation(at, fz / 2, u); } else { mt.makeTranslation(u, fz / 2, at); } im.setMatrixAt(i, mt); }
				im.count = n; im.castShadow = true; im.receiveShadow = true; self.add(im, false);
				self.add(B2(a, at - 0.06, fz * 0.3, b, at - 0.02, fz * 0.3 + 0.06, fm), false);
			} else if (fence === 'mesh') {
				self.add(B2(a, at - 0.01, 0, b, at + 0.01, fz, meshM, { noCast: true }), false);
				for (var mx = a; mx <= b; mx += 2.5) { self.add(B2(mx, at - 0.03, 0, mx + 0.06, at + 0.03, fz, solid('#4B5A4A', 0.5, 0.5)), false); }
			} else if (fence === 'masonry') {
				self.add(B2(a, at - 0.15, 0, b, at + 0.15, fz, facadeMat(c, 'render')), false);
				self.add(B2(a - 0.03, at - 0.18, fz, b + 0.03, at + 0.18, fz + 0.05, solid('#6E7378', 0.4, 0.6)), false);
			} else {
				self.add(B2(a, at - 0.25, 0, b, at + 0.25, fz, pbr('stone', { color: '#9C978E' }, { normal: 2.5 })), false);
			}
		};
		SK()._fenceSegs(F.x0, F.x1, F.gaps).forEach(function (sg) { run(sg[0], sg[1], F.y, false); });
		F.sides.forEach(function (sd) { run(sd[1], sd[2], sd[0], true); });
		if (F.back) { run(F.back[0], F.back[1], F.back[2], false); }
		var gm = solid('#2E3135', 0.4, 0.6), dg0 = Math.max(F.x0, G.drive.x0 - 0.15), dg1 = Math.min(F.x1, G.drive.x1 + 0.15), fyy = F.y;
		// driveway opening: two posts; with a gate, a sliding gate parked open behind the fence
		if (dg1 - dg0 > 0.5) {
			self.add(box(dg0 - 0.12, fyy - 0.08, 0, dg0, fyy + 0.08, fz + 0.1, gm), false);
			self.add(box(dg1, fyy - 0.08, 0, dg1 + 0.12, fyy + 0.08, fz + 0.1, gm), false);
			if (gateOn) {
				var sw = dg1 - dg0, sx0 = dg1 + sw + 0.3 <= F.x1 ? dg1 + 0.15 : Math.max(F.x0, dg0 - sw - 0.15), sy = fyy - 0.16;
				self.add(box(sx0, sy - 0.03, 0.08, sx0 + sw, sy + 0.03, 0.16, gm), false);
				self.add(box(sx0, sy - 0.03, fz - 0.16, sx0 + sw, sy + 0.03, fz - 0.08, gm), false);
				for (var sb = sx0 + 0.06; sb < sx0 + sw - 0.04; sb += 0.13) { self.add(box(sb, sy - 0.015, 0.16, sb + 0.04, sy + 0.015, fz - 0.16, gm), false); }
			}
		}
		if (gateOn) {
			self.add(box(gx - 0.12, fyy - 0.06, 0, gx, fyy + 0.06, fz + 0.1, gm), false);
			self.add(box(gx + 1.2, fyy - 0.06, 0, gx + 1.32, fyy + 0.06, fz + 0.1, gm), false);
			for (var gb = gx + 0.08; gb < gx + 1.15; gb += 0.15) { self.add(box(gb, fyy - 0.015, 0.05, gb + 0.03, fyy + 0.015, fz - 0.07, gm), false); }
			self.add(box(gx, fyy - 0.03, fz - 0.1, gx + 1.2, fyy + 0.03, fz - 0.04, gm), false);
			self.add(box(gx, fyy - 0.03, 0.05, gx + 1.2, fyy + 0.03, 0.11, gm), false);
		}
	}
};

/* ------------------------------------------------------------------ vegetation */
var FOLIAGE = {};
// Canopy geometry: many leaf cards whose normals point away from the canopy centre (soft, volumetric
// lighting). Built once per shape and reused.
function canopyGeo(shape, n, seed) {
	var key = shape + n + '|' + seed;
	if (FOLIAGE[key]) { return FOLIAGE[key]; }
	var pos = [], nor = [], uv = [], rnd = (function (s) { return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; })(seed * 97 + 13);
	for (var i = 0; i < n; i++) {
		var u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = Math.pow(rnd(), 0.35), sq = Math.sqrt(1 - u * u);
		var p = new THREE.Vector3(sq * Math.cos(th) * r, u * r, sq * Math.sin(th) * r);
		if (shape === 'cone') { var hgt = rnd(); var rad = (1 - hgt) * 0.55 * Math.pow(rnd(), 0.4); p.set(Math.cos(th) * rad, hgt * 2 - 1, Math.sin(th) * rad); }
		if (shape === 'column') { p.set(p.x * 0.28, p.y, p.z * 0.28); }
		var nn = shape === 'cone' ? new THREE.Vector3(p.x, 0.35, p.z).normalize() : p.clone().normalize();
		var size = shape === 'cone' ? 0.22 : 0.34, ax = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), bx = new THREE.Vector3().crossVectors(ax, nn).normalize();
		ax.crossVectors(nn, bx).normalize();
		var c0 = p.clone().addScaledVector(ax, -size).addScaledVector(bx, -size), c1 = p.clone().addScaledVector(ax, size).addScaledVector(bx, -size), c2 = p.clone().addScaledVector(ax, size).addScaledVector(bx, size), c3 = p.clone().addScaledVector(ax, -size).addScaledVector(bx, size);
		// both windings, same outward normal: lit from either side like real foliage
		[c0, c1, c2, c0, c2, c3, c0, c2, c1, c0, c3, c2].forEach(function (q) { pos.push(q.x, q.y, q.z); nor.push(nn.x, nn.y, nn.z); });
		uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1);
	}
	var g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	FOLIAGE[key] = g;
	return g;
}
function leafMat(c, kind, blossom) {
	var tex = texture('leaves', { season: c.season || 'summer', kind: kind, blossom: !!blossom });
	return cached('leaf' + (c.season || 'summer') + kind + (blossom ? 'b' : ''), function () {
		var m = new THREE.MeshStandardMaterial({ map: tex.map, alphaTest: 0.45, side: THREE.FrontSide, shadowSide: THREE.DoubleSide, roughness: 0.8 });
		m.map.repeat.set(1, 1);
		return m;
	});
}
House.prototype.plant = function (kind, x, y, size, seed) {
	var c = this.c, season = c.season || 'summer', g = new THREE.Group(), bark = pbr('bark', {}, { normal: 2 });
	var winter = season === 'winter';
	g.position.copy(X(x, y, 0));
	var rnd = (function (s) { return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; })(seed * 31 + 7);
	var H = size * (0.85 + rnd() * 0.3);
	function canopy(shape, cx, cy, cz, sx, sy, sz, n, k, blossom) {
		var m = new THREE.Mesh(canopyGeo(shape, n, seed % 5), leafMat(c, k, blossom));
		m.position.set(cx, cy, cz); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true;
		g.add(m);
	}
	if (kind === 'conifer' || kind === 'cypress') {
		var tr = rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, H * 0.3, 0), H * 0.025, bark, 8); g.add(tr);
		if (kind === 'cypress') { canopy('column', 0, H * 0.52, 0, H * 0.55, H * 0.48, H * 0.55, 260, 'conifer'); }
		else { canopy('cone', 0, H * 0.55, 0, H * 0.75, H * 0.45, H * 0.75, 420, 'conifer'); }
	} else if (kind === 'shrub' || kind === 'topiary' || kind === 'lavender' || kind === 'flower') {
		if (kind === 'topiary') {
			var tm = winter ? pbr('snow', {}, { normal: 0.4 }) : pbr('hedge', { season: season }, { normal: 2.5 });
			var sp = new THREE.Mesh(new THREE.SphereGeometry(H * 0.42, 24, 16), tm); sp.position.y = H * 0.45; sp.castShadow = true; sp.receiveShadow = true; g.add(sp);
		} else {
			var kk = kind === 'lavender' ? 'lavender' : 'broad';
			canopy('sphere', 0, H * 0.38, 0, H * 0.48, H * 0.36, H * 0.48, kind === 'flower' ? 40 : 120, kk, (kind === 'shrub' && c.garden_style === 'cottage') || kind === 'flower');
		}
	} else if (kind === 'palm') {
		// curved ringed trunk and a crown of drooping fronds
		var lean = (rnd() - 0.5) * H * 0.25, pts = [];
		for (var t = 0; t <= 6; t++) { var q = t / 6; pts.push(new THREE.Vector3(lean * q * q, H * 0.82 * q, lean * 0.3 * q * q)); }
		var tm2 = pbr('bark', {}, { normal: 2.5 });
		for (var ts = 0; ts < 6; ts++) { g.add(rod(pts[ts], pts[ts + 1], H * (0.035 - ts * 0.002), tm2, 10)); }
		var top = pts[6], fm = cached('palmfrond' + season, function () { return stdMat({ color: winter ? '#6E7F55' : '#4E7A3A', roughness: 0.7, side: THREE.DoubleSide }); });
		for (var fr = 0; fr < 11; fr++) {
			var fa = fr / 11 * Math.PI * 2 + rnd() * 0.3, fl = H * (0.32 + rnd() * 0.08), sh = new THREE.Shape();
			sh.moveTo(0, 0);
			for (var k = 1; k <= 10; k++) { var u = k / 10; sh.lineTo(u * fl, Math.sin(u * Math.PI) * fl * 0.13 * (k % 2 ? 1 : 0.7)); }
			for (var k2 = 9; k2 >= 1; k2--) { var u2 = k2 / 10; sh.lineTo(u2 * fl, -Math.sin(u2 * Math.PI) * fl * 0.13 * (k2 % 2 ? 1 : 0.7)); }
			var fmesh = new THREE.Mesh(new THREE.ShapeGeometry(sh), fm); fmesh.castShadow = true;
			var piv = new THREE.Group(); piv.position.copy(top); piv.rotation.y = fa; fmesh.rotation.x = -Math.PI / 2;
			var bend = new THREE.Group(); bend.rotation.z = -(0.25 + rnd() * 0.45); bend.add(fmesh); piv.add(bend); g.add(piv);
		}
		var knob = new THREE.Mesh(new THREE.SphereGeometry(H * 0.05, 10, 8), tm2); knob.position.copy(top); g.add(knob);
	} else if (kind === 'birch') {
		var white = solid('#E6E2DA', 0.75);
		g.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(H * 0.03, H * 0.72, 0), H * 0.02, white, 10));
		for (var bb = 0; bb < 4; bb++) { var ba = bb / 4 * Math.PI * 2 + rnd(); g.add(rod(new THREE.Vector3(0, H * (0.42 + bb * 0.08), 0), new THREE.Vector3(Math.cos(ba) * H * 0.16, H * (0.62 + bb * 0.06), Math.sin(ba) * H * 0.16), H * 0.007, white, 5)); }
		if (!winter) {
			[[0, 0.68, 0, 0.2, 0.3], [-0.1, 0.52, 0.05, 0.14, 0.2], [0.11, 0.55, -0.05, 0.14, 0.2], [0.03, 0.86, 0.02, 0.11, 0.15]].forEach(function (q, i) { canopy('sphere', q[0] * H, q[1] * H, q[2] * H, q[3] * H, q[4] * H, q[3] * H, 160, 'broad', false); });
		}
	} else if (kind === 'maple') {
		for (var ms = 0; ms < 2; ms++) { var mo = (ms - 0.5) * H * 0.08; g.add(rod(new THREE.Vector3(mo, 0, 0), new THREE.Vector3(mo * 3, H * 0.42, mo), H * 0.025, bark, 8)); }
		if (!winter) {
			var red = leafMat({ season: 'autumn' }, 'broad');
			[[0, 0.62, 0, 0.42, 0.24], [-0.26, 0.52, 0.05, 0.26, 0.16], [0.27, 0.54, -0.05, 0.27, 0.16], [0.05, 0.78, 0.02, 0.26, 0.14]].forEach(function (q, i) {
				var mm = new THREE.Mesh(canopyGeo('sphere', 220, (seed + i) % 5), red); mm.position.set(q[0] * H, q[1] * H, q[2] * H); mm.scale.set(q[3] * H, q[4] * H, q[3] * H); mm.castShadow = true; mm.receiveShadow = true; g.add(mm);
			});
		}
	} else if (kind === 'grass') {
		var gm = solid(winter ? '#B5A98F' : (season === 'autumn' ? '#C2A35E' : '#9AAE62'), 0.9);
		for (var b = 0; b < 14; b++) { var a = b / 14 * Math.PI * 2, lean = 0.25 + rnd() * 0.2; g.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * H * lean, H * (0.7 + rnd() * 0.3), Math.sin(a) * H * lean), 0.012, gm, 4)); }
	} else {
		// deciduous / multistem / fruit / olive
		var stems = kind === 'multistem' ? 3 : 1;
		for (var s = 0; s < stems; s++) {
			var ox = (s - (stems - 1) / 2) * H * 0.06;
			g.add(rod(new THREE.Vector3(ox, 0, 0), new THREE.Vector3(ox * 2.5, H * 0.52, ox * 0.5), H * (stems > 1 ? 0.018 : (kind === 'olive' ? 0.04 : 0.03)), bark, 8));
		}
		// main branches
		for (var br = 0; br < 5; br++) {
			var ang = br / 5 * Math.PI * 2 + rnd(), len = H * (0.25 + rnd() * 0.12);
			g.add(rod(new THREE.Vector3(0, H * 0.48, 0), new THREE.Vector3(Math.cos(ang) * len, H * (0.62 + rnd() * 0.2), Math.sin(ang) * len), H * 0.012, bark, 6));
		}
		if (!winter || kind === 'olive') {
			var R = H * (kind === 'multistem' ? 0.3 : (kind === 'olive' ? 0.32 : 0.36)), k2 = kind === 'olive' ? 'olive' : 'broad';
			var blossom = kind === 'fruit' || (season === 'spring' && rnd() > 0.4);
			canopy('sphere', 0, H - R * 0.95, 0, R * 0.95, R * 0.75, R * 0.95, 420, k2, blossom);
			for (var cl = 0; cl < 6; cl++) {
				var ca = cl / 6 * Math.PI * 2 + rnd(), cr = R * (0.45 + rnd() * 0.25), cs = R * (0.45 + rnd() * 0.25);
				canopy('sphere', Math.cos(ca) * cr, H - R * (0.8 + rnd() * 0.7), Math.sin(ca) * cr, cs, cs * 0.8, cs, 150, k2, blossom);
			}
			canopy('sphere', R * 0.1, H - R * 0.45, -R * 0.1, R * 0.5, R * 0.42, R * 0.5, 120, k2, blossom);
		} else {
			// bare crown: recursive branching
			var grow = function (from, dir, len, rad, depth) {
				var to = from.clone().addScaledVector(dir, len);
				g.add(rod(from, to, rad, bark, depth > 1 ? 6 : 4));
				if (depth <= 0) { return; }
				for (var bi = 0; bi < 3; bi++) {
					var nd = dir.clone().add(new THREE.Vector3(rnd() - 0.5, rnd() * 0.5, rnd() - 0.5).multiplyScalar(1.1)).normalize();
					grow(to, nd, len * 0.68, rad * 0.62, depth - 1);
				}
			};
			for (var tw = 0; tw < 4; tw++) { var a2 = tw / 4 * Math.PI * 2 + rnd(); grow(new THREE.Vector3(0, H * 0.5, 0), new THREE.Vector3(Math.cos(a2) * 0.6, 0.8, Math.sin(a2) * 0.6).normalize(), H * 0.22, H * 0.012, 3); }
		}
	}
	this.add(g, false);
};

/* ================================================================== environment */
var TOD = {
	morning: { az: 140, el: 20, exp: 0.95, sun: '#FFE2C2', si: 3.2 },
	midday: { az: 55, el: 55, exp: 0.9, sun: '#FFF7EC', si: 3.6 },
	golden: { az: 25, el: 13, exp: 1.0, sun: '#FFD3A6', si: 3.4 },
	blue: { az: 160, el: -2, exp: 1.3, sun: '#8EA0D0', si: 0.3 },
	night: { az: 160, el: -12, exp: 1.5, sun: '#8899CC', si: 0.55 }
};
function sunDir(c) {
	var t = TOD[c.time_of_day] || TOD.golden;
	var orient = { south: 0, south_west: 25, south_east: -25, west: 50, east: -50, north: 90 }[c.orientation] || 0;
	var az = (t.az + orient * 0.5) * D2R, el = Math.max(t.el, c.time_of_day === 'night' ? 35 : t.el) * D2R;
	if (c.time_of_day === 'night') { el = 35 * D2R; az = 120 * D2R; } // moonlight
	return X(Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el)).normalize();
}
/* ================================================================== viewer */
// Painted sky (equirectangular): gradient by time of day, sun glow, soft clouds. Used both as the
// visible background and, through PMREM, as the image-based lighting of the scene.
var SKYCOL = {
	morning: { zen: '#5E8FC8', hor: '#F3DCC4', glow: '#FFE7C8' },
	midday: { zen: '#3F79C2', hor: '#CFE0EE', glow: '#FFFFFF' },
	golden: { zen: '#5A7DB4', hor: '#EFD3B4', glow: '#FFE0B5' },
	blue: { zen: '#14244A', hor: '#7B7FA6', glow: '#B79BB0' },
	night: { zen: '#03060F', hor: '#1A2442', glow: '#2A3358' }
};
function skyTexture(c, sunD) {
	var tod = SKYCOL[c.time_of_day] ? c.time_of_day : 'golden', S = SKYCOL[tod], w = c.weather || 'few_clouds';
	var W = 1024, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
	var x = cv.getContext('2d');
	var zen = S.zen, hor = S.hor;
	if (w === 'overcast') { zen = tod === 'night' ? '#0B0F18' : (tod === 'blue' ? '#3B4258' : '#9AA2AB'); hor = tod === 'night' ? '#151A26' : (tod === 'blue' ? '#5C6175' : '#C9CDD2'); }
	var g = x.createLinearGradient(0, 0, 0, H / 2);
	g.addColorStop(0, zen); g.addColorStop(0.7, '#' + new THREE.Color(zen).lerp(new THREE.Color(hor), 0.6).getHexString()); g.addColorStop(1, hor);
	x.fillStyle = g; x.fillRect(0, 0, W, H / 2);
	var gb = x.createLinearGradient(0, H / 2, 0, H); gb.addColorStop(0, hor); gb.addColorStop(1, tod === 'night' ? '#05070C' : '#5E6A52');
	x.fillStyle = gb; x.fillRect(0, H / 2, W, H / 2);
	var u = Math.atan2(sunD.z, sunD.x) / (2 * Math.PI) + 0.5, v = Math.asin(clamp(sunD.y, -1, 1)) / Math.PI + 0.5;
	var sx = u * W, sy = (1 - v) * H, gc = new THREE.Color(S.glow);
	var rgba = function (a) { return 'rgba(' + Math.round(gc.r * 255) + ',' + Math.round(gc.g * 255) + ',' + Math.round(gc.b * 255) + ',' + a + ')'; };
	if (w !== 'overcast' && tod !== 'night') {
		[[sx, sy], [sx - W, sy], [sx + W, sy]].forEach(function (p) {
			var r = x.createRadialGradient(p[0], p[1], 0, p[0], p[1], H * 0.45);
			r.addColorStop(0, rgba(1)); r.addColorStop(0.03, rgba(1)); r.addColorStop(0.18, rgba(0.45)); r.addColorStop(1, rgba(0));
			x.fillStyle = r; x.fillRect(0, 0, W, H);
		});
	}
	var n = { clear: 0, few_clouds: 26, overcast: 70 }[w], sd = 11;
	function rr() { sd = (sd * 16807) % 2147483647; return sd / 2147483647; }
	var cc = tod === 'night' ? 'rgba(40,48,80,' : (tod === 'blue' ? 'rgba(120,118,150,' : (tod === 'golden' ? 'rgba(255,232,210,' : 'rgba(255,255,255,'));
	if (w === 'overcast') { cc = tod === 'night' ? 'rgba(25,30,44,' : 'rgba(170,176,184,'; }
	for (var i = 0; i < n; i++) {
		var cx = rr() * W, cy = H * (0.2 + rr() * 0.26), cw = 30 + rr() * 90;
		for (var k = 0; k < 9; k++) {
			var bx = cx + (rr() - 0.5) * cw * 1.6, by = cy + (rr() - 0.5) * cw * 0.25, br = cw * (0.25 + rr() * 0.35);
			var rg = x.createRadialGradient(bx, by, 0, bx, by, br);
			rg.addColorStop(0, cc + (w === 'overcast' ? 0.55 : 0.5) + ')'); rg.addColorStop(1, cc + '0)');
			x.fillStyle = rg; x.beginPath(); x.ellipse(bx, by, br, br * 0.42, 0, 0, Math.PI * 2); x.fill();
		}
	}
	if (tod === 'night') {
		for (var st = 0; st < 900; st++) { x.globalAlpha = 0.3 + rr() * 0.7; x.fillStyle = '#FFFFFF'; x.fillRect(rr() * W, rr() * H * 0.45, rr() < 0.1 ? 2 : 1, 1); }
		x.globalAlpha = 1; x.fillStyle = '#F4F1E3'; x.beginPath(); x.arc(sx, Math.min(sy, H * 0.3), 7, 0, Math.PI * 2); x.fill();
	}
	var t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping;
	return t;
}
function Env(renderer) {
	this.renderer = renderer;
	this.pmrem = new THREE.PMREMGenerator(renderer);
	this.key = ''; this.envRT = null; this.bg = null;
}
Env.prototype.apply = function (scene, c, inner) {
	var key = [c.time_of_day, c.weather, c.orientation, inner ? 'in' : ''].join('|');
	if (key === this.key) { return; }
	this.key = key;
	var sd = c._item ? new THREE.Vector3(-0.42, 0.82, 0.62).normalize() : sunDir(c);
	if (c.time_of_day !== 'night') {
		var t = TOD[c.time_of_day] || TOD.golden, orient = { south: 0, south_west: 25, south_east: -25, west: 50, east: -50, north: 90 }[c.orientation] || 0;
		var az = (t.az + orient * 0.5) * D2R, el = t.el * D2R;
		sd = X(Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el)).normalize();
	}
	if (this.bg) { this.bg.dispose(); }
	if (this.envRT) { this.envRT.dispose(); }
	this.bg = skyTexture(c, sd);
	this.envRT = inner ? this.pmrem.fromScene(roomEnv(c), 0.04) : this.pmrem.fromEquirectangular(this.bg);
	scene.background = this.bg;
	scene.environment = this.envRT.texture;
};
// Reflections and soft light indoors: a plain room with a bright window and a ceiling light (no lawn,
// no sky below the horizon – ceilings and the undersides of furniture stay neutral).
function roomEnv(c) {
	var night = c.time_of_day === 'night' || c.time_of_day === 'blue', s = new THREE.Scene();
	var room = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 12), new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: night ? new THREE.Color(0.08, 0.07, 0.06) : new THREE.Color(0.62, 0.6, 0.57) }));
	room.position.y = 2.5; s.add(room);
	var floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ color: night ? new THREE.Color(0.05, 0.045, 0.04) : new THREE.Color(0.42, 0.38, 0.33) }));
	floor.rotation.x = -Math.PI / 2; floor.position.y = -0.95; s.add(floor);
	function panel(w, h, x, y, z, ry, rx, col) { var p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); p.position.set(x, y, z); p.rotation.set(rx || 0, ry || 0, 0); s.add(p); }
	if (night) { panel(2.5, 2.5, 0, 5.9, 0, 0, Math.PI / 2, new THREE.Color(5, 3.8, 2.6)); panel(1.2, 1.2, 3, 2, -3, 0.6, 0, new THREE.Color(3, 2.2, 1.4)); }
	else { panel(5, 3, -5.9, 2.2, 0, Math.PI / 2, 0, new THREE.Color(7, 7.2, 7.6)); panel(4, 2.5, 0, 2.2, -5.9, 0, 0, new THREE.Color(3.5, 3.6, 3.9)); panel(3, 3, 0, 5.9, 0, 0, Math.PI / 2, new THREE.Color(1.8, 1.75, 1.7)); }
	return s;
}

function Viewer(opts) {
	opts = opts || {};
	this.o = opts;
	this.thumb = !!opts.thumb;
	var coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
	this.quality = opts.quality || (this.thumb ? 'thumb' : (coarse ? 'medium' : 'high'));
	// Option cards borrow the renderer of the live preview: one WebGL context, so every shader is
	// compiled and every texture uploaded once (a second context did all of it again).
	this.shared = !!opts.renderer;
	var r = this.renderer = opts.renderer || new THREE.WebGLRenderer({ antialias: this.quality !== 'high', alpha: false, preserveDrawingBuffer: !!this.thumb, powerPreference: 'high-performance' });
	this.dprHi = this.thumb ? 1 : Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 1.5 : 1.25);
	this.exposure = 1;
	if (!this.shared) {
		r.setPixelRatio(this.dprHi);
		r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
		// the sun moves with the house, not with the camera: shadows are drawn only when the scene changes
		r.shadowMap.autoUpdate = false; r.shadowMap.needsUpdate = true;
		r.toneMapping = THREE.NeutralToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
		setAnisotropy(Math.min(8, r.capabilities.getMaxAnisotropy()));
	}
	this.scene = new THREE.Scene();
	this.camera = new THREE.PerspectiveCamera(40, 1.5, 0.3, 3000);
	this.env = new Env(r);
	this.sun = new THREE.DirectionalLight('#ffffff', 3); this.sun.castShadow = true;
	var ms = this.quality === 'high' ? 4096 : (this.quality === 'medium' ? 2048 : 1536);
	this.sun.shadow.mapSize.set(ms, ms); this.sun.shadow.bias = -0.0003; this.sun.shadow.normalBias = 0.03; this.sun.shadow.radius = 3;
	this.scene.add(this.sun); this.scene.add(this.sun.target);
	this.hemi = new THREE.HemisphereLight('#CFE3F7', '#5B6B45', 0.5); this.scene.add(this.hemi);
	// A fixed set of lamp lights: the scene's lamps borrow them, so the number of lights – part of
	// every shader – never changes and no shader has to be compiled again when lamps come or go.
	this.pool = [];
	for (var li = 0; li < 4; li++) { var pli = new THREE.PointLight('#FFC98A', 0, 6, 2); this.scene.add(pli); this.pool.push(pli); }
	// the land around the plot (terrain, water, woods, neighbours): set per landscape in landFor()
	this.ground = new THREE.Mesh(new THREE.BufferGeometry(), solid('#7A8F55', 1)); this.ground.receiveShadow = true; this.scene.add(this.ground);
	this.water = null; this.hood = new THREE.Group(); this.scene.add(this.hood); this.landKey = ''; this.hoodList = null;
	this.treeline = new THREE.Group(); this.scene.add(this.treeline);
	this.house = null; this.camKey = ''; this.dirty = true;
	this.el = r.domElement; this.el.className = 'agh-3d-canvas';
	if (!this.thumb) {
		this.controls = new OrbitControls(this.camera, this.el);
		this.controls.enableDamping = true; this.controls.dampingFactor = 0.08; this.controls.enablePan = false;
		this.controls.maxPolarAngle = 88 * D2R; this.controls.minPolarAngle = 15 * D2R;
		var self = this;
		this.controls.addEventListener('change', function () { self.requestRender(); });
		// while the visitor drags: plain resolution, no ambient occlusion – full quality again when it settles
		this.controls.addEventListener('start', function () { self.interacting = true; if (self.prHi() > self.prLo()) { self.setDPR(self.prLo()); self.lowDPR = true; } self.loop(); });
		this.controls.addEventListener('end', function () { self.interacting = false; self.settle = performance.now() + 900; self.loop(); });
		// a tap on a part of the model: the designer jumps to the setting that part belongs to. Only a tap
		// counts (under 6 px of movement), so turning the house keeps working, on a touch screen too.
		// In a room a piece can also be grabbed and dragged (with a mouse at once, with a finger after a
		// short hold, so that turning the view keeps working) and turned with the wheel or with Shift.
		var dn = null, hold = 0;
		this.el.addEventListener('pointerdown', function (e) {
			dn = [e.clientX, e.clientY, Date.now()];
			if (self.drag) { return; }
			if (e.pointerType === 'touch') { hold = setTimeout(function () { self.grabAt(e.clientX, e.clientY, e); }, 330); }
			else if (e.button === 0) { self.grabAt(e.clientX, e.clientY, e); }
		});
		this.el.addEventListener('pointermove', function (e) {
			if (dn && hold && (Math.abs(e.clientX - dn[0]) + Math.abs(e.clientY - dn[1])) > 8) { clearTimeout(hold); hold = 0; }
			if (self.drag) { self.dragTo(e); }
		});
		this.el.addEventListener('wheel', function (e) { if (self.drag) { e.preventDefault(); self.turnDrag(e.deltaY > 0 ? 15 : -15); } }, { passive: false });
		this.el.addEventListener('pointerup', function (e) {
			if (hold) { clearTimeout(hold); hold = 0; }
			var wasDrag = !!self.drag;
			if (wasDrag) { self.dropDrag(); }
			if (!dn || !self.onPick) { dn = null; return; }
			var moved = Math.abs(e.clientX - dn[0]) + Math.abs(e.clientY - dn[1]), slow = Date.now() - dn[2] > 700;
			dn = null;
			if (wasDrag || moved > 6 || slow) { return; }
			var hit = self.pickAt(e.clientX, e.clientY);
			if (hit) { self.onPick(hit); }
		});
		this.el.addEventListener('pointercancel', function () { if (hold) { clearTimeout(hold); hold = 0; } if (self.drag) { self.dropDrag(); } });
		if (this.quality === 'high') {
			this.composer = new EffectComposer(r, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
			this.composer.addPass(new RenderPass(this.scene, this.camera));
			this.gtao = new GTAOPass(this.scene, this.camera, 1, 1);
			this.gtao.output = GTAOPass.OUTPUT.Default;
			this.gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.5, thickness: 0.6, scale: 1, samples: 16 });
			this.gtao.blendIntensity = 0.6;
			this.composer.addPass(this.gtao);

			this.composer.addPass(new OutputPass());
		}
	}
}
// Compiles the shaders of a scene for the target this viewer really draws into (the effect
// composer's buffer or an option card's buffer: tone mapping and colour space are part of a shader).
Viewer.prototype.compileFor = function (scene, target) {
	var r = this.renderer, prev = r.getRenderTarget();
	if (!r.compileAsync) { return Promise.resolve(); }
	r.setRenderTarget(target || (this.composer ? this.composer.renderTarget1 : null));
	var p = r.compileAsync(scene, this.camera);
	r.setRenderTarget(prev);
	return p.catch(function () {});
};
// The lamps of the new scene take over the fixed lights (brightest first; the rest stay dark).
Viewer.prototype.lampsToPool = function (root) {
	var found = [], wp = new THREE.Vector3();
	root.updateMatrixWorld(true);
	root.traverse(function (o) { if (o.isLight) { found.push({ l: o, p: o.getWorldPosition(new THREE.Vector3()) }); } });
	found.forEach(function (f) { if (f.l.parent) { f.l.parent.remove(f.l); } });
	found.sort(function (a, b) { return b.l.intensity - a.l.intensity; });
	this.pool.forEach(function (pl, i) {
		var f = found[i];
		if (!f) { pl.intensity = 0; return; }
		pl.color.copy(f.l.color); pl.intensity = f.l.isSpotLight ? f.l.intensity * 0.4 : f.l.intensity; pl.distance = f.l.distance || 6; pl.decay = 2;
		pl.position.copy(f.p);
	});
	void wp;
};
// Pixel budget of the live view: a full-screen 4K canvas would otherwise draw 13 million pixels per
// frame at the usual ratio. Above 3 MP the ratio is lowered so the GPU load stays at today's level;
// an ordinary preview box never reaches the budget, so it looks exactly as before.
var MAX_PX = 3.0e6;
Viewer.prototype.prHi = function () { var px = Math.max(1, (this.w || 1) * (this.h || 1)); return Math.min(this.dprHi, Math.sqrt(MAX_PX / px)); };
Viewer.prototype.prLo = function () { return Math.min(1, this.prHi()); };
Viewer.prototype.setDPR = function (pr) {
	if (Math.abs(this.renderer.getPixelRatio() - pr) < 0.01) { return; }
	this.renderer.setPixelRatio(pr);
	if (this.composer) { this.composer.setPixelRatio(pr); }
};
Viewer.prototype.setSize = function (w, h) {
	w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
	if (this.w === w && this.h === h) { return; }
	this.w = w; this.h = h;
	if (!this.shared) { this.renderer.setSize(w, h, !this.thumb); }
	if (!this.thumb && !this.shared) { this.setDPR(this.lowDPR ? this.prLo() : this.prHi()); }
	if (this.composer) { this.composer.setSize(w, h); }
	this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
	// A resized box keeps the visitor's view (only the very first fit uses the preset): direction, zoom
	// and the point looked at stay, so entering and leaving the full screen gives back the same picture.
	this.fitCamera(!this.lastDist, true);
	this.requestRender();
};
Viewer.prototype.update = function (cfg, mode) {
	var c = cfg || {}, memo = JSON.stringify(c) + '|' + (mode || '');
	if (memo === this.memo && this.house) { this.requestRender(); return; }
	this.memo = memo;
	// option cards with a single item: always the same bright daylight studio
	if (c._item) { c = Object.assign({}, c, { time_of_day: 'midday', weather: 'clear', season: 'summer' }); }
	this.c = c;
	var night = c.time_of_day === 'night', t = TOD[c.time_of_day] || TOD.golden, overcast = c.weather === 'overcast';
	this.env.apply(this.scene, c, !!c._int || !!c._item || mode === 'interior');
	this.exposure = this.renderer.toneMappingExposure = t.exp * (overcast ? 1.15 : 1);
	var sd = sunDir(c);
	this.sunDir = sd;
	// indoors the sun comes through the openings: softer, so there are no burnt-out patches and no black corners
	var innerLight = !!c._int || mode === 'interior';
	this.sun.color.set(t.sun); this.sun.intensity = (overcast ? t.si * 0.25 : t.si) * (innerLight && !night ? 0.55 : 1);
	this.sun.castShadow = !(overcast && !night);
	this.hemi.intensity = (night ? 0.45 : (overcast ? 0.8 : (c.time_of_day === 'blue' ? 0.4 : 0.2))) + (innerLight ? (night ? 0.25 : 0.55) : 0);
	this.hemi.color.set(night ? '#5A6A9A' : '#CFE3F7');
	// indoors the light bounces off floors and walls, not off a lawn: a warm neutral ground colour
	this.hemi.groundColor.set(c._int || c._item || mode === 'interior' ? (night ? '#5E5246' : '#D2CABD') : '#5B6B45');
	this.scene.environmentIntensity = night ? 1.2 : (c.time_of_day === 'blue' ? 1.2 : (overcast ? 1.6 : 0.9));
	var hz = overcast ? (night ? '#151A26' : (c.time_of_day === 'blue' ? '#5C6175' : '#C9CDD2')) : (SKYCOL[c.time_of_day] || SKYCOL.golden).hor;
	// interior view: one room as a cut-away, without the meadow, the tree line and the haze
	var inner = !!c._int || !!c._item || mode === 'interior';
	// indoors practically no haze – but the same kind of fog, so the shaders stay the same
	this.scene.fog = new THREE.FogExp2(hz, inner ? 0.000001 : (overcast ? 0.0032 : 0.0017));
	this.ground.visible = !inner; this.treeline.visible = !inner; this.hood.visible = !inner && !c._item && mode !== 'facade' && mode !== 'floor';
	// a clean guide picture for the image model: no tree line of simple cones and no haze behind the
	// house – the model paints the surroundings for real from the prompt instead of copying the shapes
	if (c._clean && !inner) { this.treeline.visible = false; this.scene.fog.density = 0.00002; }
	if (this.water) { this.water.visible = !inner; }
	// rebuild the house
	if (this.house) { this.scene.remove(this.house.root); disposeTree(this.house.root); }
	if (mode === 'facade') { this.house = facadeScene(c); }
	else if (mode === 'floor') { this.house = floorScene(c); }
	else if (c._item) { this.house = INT.itemScene(c, c._item); }
	else if (inner) { this.house = INT.interiorScene(c, c._int || { type: 'living' }); }
	else { this.house = new House(c, { mini: this.o.mini || mode === 'mini' }).build(); }
	if (!inner) { this.landFor(c, mode); }
	this.lampsToPool(this.house.root);
	this.picks = this.thumb ? null : collectPicks(this.house.root);   // before the merge, while the pieces are still apart
	// In a room every piece is merged on its own and the furniture group is left out of the big merge:
	// that is what keeps each piece grabbable, while the number of draw calls stays low.
	var itemsG = (!this.thumb || MODELS_ON) && this.house.items && this.house.items.children.length ? this.house.items : null;
	if (itemsG) { itemsG.children.slice().forEach(function (o) { try { mergeStatic(o); } catch (e) {} }); }
	// real models (switched on only): the option card's piece and the garden pieces stay apart from the
	// big merge, each merged on its own, so a model can take its place
	if (MODELS_ON && this.house.modelPieces) { this.house.modelPieces.forEach(function (o) { o.userData.keepApart = true; try { mergeStatic(o); } catch (e) {} }); }
	mergeStatic(this.house.fit || this.house.root, itemsG);
	if (this.house.fit && this.house.fit !== this.house.root) { mergeStatic(this.house.root, this.house.fit); }
	this.scene.add(this.house.root);
	this.renderer.shadowMap.needsUpdate = true; this.shadowDirty = true;
	// new shaders are compiled in the background (parallel compile where the GPU driver offers it):
	// the previous picture stays until they are ready instead of the page freezing
	var self = this;
	if (!this.thumb && this.frames && this.renderer.compileAsync) {
		var job = this.compileJob = {};
		this.compileFor(this.scene).then(function () { if (self.compileJob === job) { self.compileJob = null; self.requestRender(); } }, function () { self.compileJob = null; self.requestRender(); });
	}
	var key = [inner ? 'interior' : c.camera, c.lens, mode, inner && c._int ? (c._int.id || c._int.type) : '', c._item ? c._item.field : ''].join('|');
	this.fitCamera(key !== this.camKey);
	this.camKey = key;
	this.modelJob = MODELS_ON ? this.swapModels() : null;
	this.requestRender();
};
// Real models replace the built-in pieces in the background: loaded, placed hidden, their shaders
// prepared, then shown all at once in one frame. A rebuilt scene meanwhile drops the result.
Viewer.prototype.swapModels = function () {
	var self = this, hs = this.house, groups = modelGroups(hs);
	if (!modelsP || !groups.length) { return null; }
	return modelsP.then(function (M) {
		if (!M) { return 0; }
		return M.init(self.renderer).then(function (ok) {
			if (!ok || self.house !== hs) { return 0; }
			return Promise.all(groups.map(function (o) { return M.swap(o, undefined, null, true); })).then(function (r) {
				var done = groups.filter(function (o, i) { return r[i]; });
				if (!done.length || self.house !== hs) { return 0; }
				var show = function () {
					if (self.house !== hs) { return 0; }
					done.forEach(function (o) { M.commit(o); });
					self.renderer.shadowMap.needsUpdate = true; self.shadowDirty = true;
					if (!self.thumb) { self.requestRender(); }
					return done.length;
				};
				return self.compileFor ? self.compileFor(self.scene, self.thumb ? self.rtA : undefined).then(show, show) : show();
			});
		});
	}).catch(function () { return 0; });
};
// Off-screen pictures wait for the models on their way, at most `ms` (option cards 10 s: they are made in
// the background and kept; guide pictures 3 s: the visitor is waiting for the generation).
function modelsSettled(v, ms) {
	if (!v || !v.modelJob) { return Promise.resolve(); }
	return Promise.race([v.modelJob, new Promise(function (res) { setTimeout(res, ms || 3000); })]);
}
// The land around the plot for the chosen (or the style's) landscape: terrain with fields, rock, snow
// and water, woods of the matching species, the street in front and – when asked for – the neighbours.
// Terrain and woods are rebuilt only when the landscape, the season or the street line changes.
Viewer.prototype.landFor = function (c, mode) {
	var k = LAND.landKind(c), hs = this.house, pb = hs && hs.plotBox, night = c.time_of_day === 'night' || c.time_of_day === 'blue';
	if (pb) { LAND.setRoad(pb.front); }
	var key = [k, c.season || 'summer', pb ? Math.round(pb.front / 10) : 2, this.thumb ? 't' : ''].join('|');
	this.ground.material = LAND.terrainMat(c);
	if (key !== this.landKey) {
		this.landKey = key;
		this.ground.geometry = LAND.terrainGeo(k, c.season);
		if (this.water) { this.scene.remove(this.water); this.water.geometry.dispose(); this.water = null; }
		this.water = LAND.water(k); if (this.water) { this.scene.add(this.water); }
		while (this.treeline.children.length) { this.treeline.remove(this.treeline.children[0]); }
		this.treeline.add(LAND.woods(c, k, this.thumb));
	}
	// the street belongs to this house (built and disposed with it); not under the close-up option cards
	var full = pb && !(this.o.mini || mode === 'mini' || mode === 'facade' || mode === 'floor');
	if (full) { hs.root.add(LAND.street(c, pb, hs.gardenPlan, k, night)); }
	while (this.hood.children.length) { this.hood.remove(this.hood.children[0]); }
	// A town street is the row of houses itself: there the neighbours belong to the landscape, so they
	// are built even when the "show surrounding buildings" setting is off (elsewhere that setting rules).
	if (full && (c.neighbors || 'town' === k) && !this.thumb) {
		var list = LAND.neighbours(c, k, night);
		LAND.placeNeighbours(list, pb, k);
		list.forEach(function (o) { this.hood.add(o.root); }, this);
	}
	// what was built around the house, in numbers (the merge swallows the groups, this survives)
	this.siteInfo = { street: full ? ('town' === k ? 'urban' : ('suburb' === k ? 'town' : 'country')) : '', hood: this.hood.children.length };
};
// Frames `box` from the direction `dir`: the distance and the point to look at, so that the box fills
// `fill` of the picture and sits in the middle of it. The eight corners are projected, the camera is
// moved sideways to centre them and then pulled back or pushed in; perspective makes this converge fast.
Viewer.prototype.fitFrame = function (box, target, dir, fill) {
	var cam = this.camera.clone(), pts = [], i, tgt = target.clone();
	var d = Math.max(1.2, box.getSize(new THREE.Vector3()).length());
	for (i = 0; i < 8; i++) { pts.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z)); }
	var right = new THREE.Vector3(), up = new THREE.Vector3(), tv = Math.tan(cam.fov * D2R / 2), th = tv * (cam.aspect || 1.5);
	for (var it = 0; it < 6; it++) {
		cam.position.copy(tgt).addScaledVector(dir, d);
		cam.lookAt(tgt); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
		var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, behind = false;
		for (i = 0; i < 8; i++) {
			var n = pts[i].clone().project(cam);
			if (!isFinite(n.x) || !isFinite(n.y) || n.z > 1) { behind = true; break; }
			x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y);
		}
		if (behind) { d *= 1.35; continue; }
		var sx = (x1 - x0) / 2, sy = (y1 - y0) / 2, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
		if (!(sx > 0) || !(sy > 0)) { break; }
		// move the look-at point so the box sits in the middle, then set the distance from its size
		cam.matrixWorld.extractBasis(right, up, new THREE.Vector3());
		tgt.addScaledVector(right, cx * th * d).addScaledVector(up, cy * tv * d);
		var s = Math.max(sx, sy);
		if (Math.abs(s - fill) < 0.01 && Math.abs(cx) < 0.01 && Math.abs(cy) < 0.01) { break; }
		d *= s / fill;
	}
	// the last step moved the look-at point, so the size is set once more from where the camera now stands
	for (var fin = 0; fin < 2; fin++) {
		cam.position.copy(tgt).addScaledVector(dir, d);
		cam.lookAt(tgt); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
		var fx0 = 1e9, fx1 = -1e9, fy0 = 1e9, fy1 = -1e9, out2 = false;
		for (i = 0; i < 8; i++) {
			var nn = pts[i].clone().project(cam);
			if (!isFinite(nn.x) || !isFinite(nn.y) || nn.z > 1) { out2 = true; break; }
			fx0 = Math.min(fx0, nn.x); fx1 = Math.max(fx1, nn.x); fy0 = Math.min(fy0, nn.y); fy1 = Math.max(fy1, nn.y);
		}
		if (out2) { d *= 1.3; continue; }
		// the size comes from the span; the corner of the floor nearest the camera may run a little off the
		// picture, as it does in any interior photograph, but never more than a twelfth of the frame
		var fs = Math.max((fx1 - fx0) / 2, (fy1 - fy0) / 2);
		var over = Math.max(Math.abs(fx0), Math.abs(fx1), Math.abs(fy0), Math.abs(fy1));
		if (over > 1.08) { d *= over / 1.08; continue; }
		if (!(fs > 0) || Math.abs(fs - fill) < 0.01) { break; }
		d *= fs / fill;
	}
	return { dist: d, target: tgt };
};
Viewer.prototype.fitCamera = function (reset, keepTarget) {
	if (!this.house) { return; }
	var c = this.c || {}, box3 = new THREE.Box3().setFromObject(this.house.fit), sph = box3.getBoundingSphere(new THREE.Sphere());
	var lens = { '24mm': 24, '35mm': 35, '50mm': 50 }[c.lens || '35mm'] || 35;
	var vfov = 2 * Math.atan(12 / lens) / D2R;
	if (this.thumb) { vfov = Math.min(vfov, 38); }
	this.camera.fov = vfov; this.camera.updateProjectionMatrix();
	var aspect = this.camera.aspect || 1.5, hfov = 2 * Math.atan(Math.tan(vfov * D2R / 2) * aspect);
	var dist = sph.radius / Math.sin(Math.min(vfov * D2R, hfov) / 2) * (this.thumb ? 0.68 : 0.8);
	var room = this.house && this.house.room;
	// `_cam`: a fixed [azimuth, elevation] pair, used by the guide pictures sent to the image model
	var preset = room ? (room.cam || [38, 20]) : (Array.isArray(c._cam) ? c._cam : { three_quarter: [36, 14], frontal: [4, 8], low: [30, 4], elevated: [40, 38] }[c.camera || 'three_quarter']);
	var target = sph.center.clone(); if (!(room && room.cam)) { target.y = Math.max(1.2, sph.center.y * 0.75); }
	if (room && !room.cam && room.W) {
		// A room is framed by the room itself, not by everything in the scene: the camera looks in from the
		// open corner at eye height, and the walls fill the picture. Vertical lines stay vertical.
		var rb = new THREE.Box3(new THREE.Vector3(-0.1, 0, -0.1), new THREE.Vector3(room.W + 0.1, room.H, room.D + 0.1));
		target.set(room.W / 2, Math.min(1.55, room.H * 0.56), room.D / 2);
		var az0 = preset[0] * D2R, el0 = preset[1] * D2R;
		var fr = this.fitFrame(rb, target, new THREE.Vector3(Math.sin(az0) * Math.cos(el0), Math.sin(el0), Math.cos(az0) * Math.cos(el0)), 0.96);
		dist = fr.dist; target.copy(fr.target);
	}
	if (room && room.cam) {
		// a single item: frame its box (width seen at three quarters, its height) with a margin
		var sz = box3.getSize(new THREE.Vector3()), tv = Math.tan(vfov * D2R / 2), th = Math.tan(hfov / 2);
		dist = Math.max(sz.y / (2 * tv), Math.max(sz.x, sz.z) * 0.95 / (2 * th)) * 1.12 + Math.min(sz.x, sz.z) * 0.5;
	}
	// sun shadow frustum around the house (tight around a room or an item: sharper shadows)
	var R = sph.radius + (room ? 2.5 : 14);
	var sc = this.sun.shadow.camera; sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 1; sc.far = R * 4; sc.updateProjectionMatrix();
	this.sun.position.copy(sph.center).addScaledVector(this.sunDir || new THREE.Vector3(0.5, 1, 0.5), R * 1.8);
	this.sun.target.position.copy(sph.center);
	if (!reset && this.controls && this.lastDist) {
		// keep the visitor's orbit direction and zoom; follow the new house size and box aspect
		var off = this.camera.position.clone().sub(this.controls.target), zoom = clamp(off.length() / this.lastDist, 0.3, 4);
		off.normalize().multiplyScalar(dist * zoom);
		if (keepTarget) { target.copy(this.controls.target); }
		this.controls.target.copy(target); this.camera.position.copy(target).add(off);
		this.controls.minDistance = sph.radius * 0.5; this.controls.maxDistance = sph.radius * 4;
	} else {
		var az = preset[0] * D2R, el = preset[1] * D2R;
		var dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
		this.camera.position.copy(target).addScaledVector(dir, dist);
		if (c.camera === 'low' && !room) { this.camera.position.y = 1.4; }
		this.camera.lookAt(target);
		if (this.controls) { this.controls.target.copy(target); this.controls.minDistance = sph.radius * 0.5; this.controls.maxDistance = sph.radius * 4; }
	}
	this.lastR = sph.radius; this.lastDist = dist;
	if (this.controls) { this.controls.update(); }
};
Viewer.prototype.requestRender = function () {
	var self = this;
	if (this.thumb) { if (!this.shared) { this.render(); } return; }
	if (this.raf) { return; }
	this.raf = requestAnimationFrame(function () { self.raf = 0; self.render(); });
};
Viewer.prototype.loop = function () {
	var self = this;
	if (this.looping) { return; }
	this.looping = true;
	(function tick() {
		if (self.disposed) { return; }
		self.controls.update(); self.render();
		if (self.interacting || performance.now() < (self.settle || 0)) { requestAnimationFrame(tick); }
		else { self.looping = false; if (self.lowDPR) { self.lowDPR = false; self.setDPR(self.prHi()); self.render(); } }
	})();
};
// The canvas is stretched to its box by CSS; if the box changed since the last frame (a re-rendered
// panel, a new step, the summary filling in), the drawing buffer is resized before drawing, so a
// frame is never shown squashed or stretched while a ResizeObserver callback is still pending.
Viewer.prototype.syncSize = function () {
	if (this.thumb || !this.wrap) { return; }
	var w = this.wrap.clientWidth, h = this.wrap.clientHeight;
	if (w > 0 && h > 0 && (Math.round(w) !== this.w || Math.round(h) !== this.h)) { this.setSize(w, h); }
};
Viewer.prototype.render = function () {
	this.syncSize();
	if (!this.w || this.disposed) { return; }
	if (this.compileJob && !this.interacting) { return; }
	this.renderer.toneMappingExposure = this.exposure;
	if (this.shadowDirty) { this.renderer.shadowMap.needsUpdate = true; this.shadowDirty = false; }
	if (this.gtao) { this.gtao.enabled = !this.interacting; }
	if (this.composer) { this.composer.render(); } else { this.renderer.render(this.scene, this.camera); }
	this.frames = (this.frames || 0) + 1;
};
// Fingerprint of the current scene: geometry bounds, materials and environment. The tests compare it
// before and after a parameter change.
Viewer.prototype.signature = function () {
	var parts = [this.env.key, this.camKey, this.renderer.toneMappingExposure.toFixed(3)], v = new THREE.Vector3();
	if (this.house) {
		this.house.root.updateMatrixWorld(true);
		this.house.root.traverse(function (o) {
			if (!o.isMesh && !o.isLight) { return; }
			if (o.isLight) { parts.push('L' + o.position.toArray().map(function (x) { return x.toFixed(2); })); return; }
			var g = o.geometry; if (!g.boundingBox) { g.computeBoundingBox(); }
			v.copy(g.boundingBox.min).applyMatrix4(o.matrixWorld);
			var mats = Array.isArray(o.material) ? o.material : [o.material];
			parts.push(mats.map(function (m) { return m.userData.key || m.type; }).join('+') + '@' + g.attributes.position.count + ':' + v.toArray().map(function (x) { return x.toFixed(2); }) + (o.isInstancedMesh ? '#' + o.count : ''));
		});
	}
	// the surroundings: landscape and the neighbouring houses where they stand
	parts.push(this.landKey || '');
	if (this.hood && this.hood.visible) { this.hood.children.forEach(function (o) { parts.push('N' + o.position.toArray().map(function (x) { return x.toFixed(1); }) + ':' + o.rotation.y.toFixed(2)); }); }
	var s = parts.join(';'), h = 2166136261;
	for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
	return (h >>> 0).toString(16) + ':' + parts.length;
};
Viewer.prototype.dispose = function () {
	this.disposed = true;
	if (this.controls) { this.controls.dispose(); }
	if (this.house) { disposeTree(this.house.root); }
	this.renderer.dispose();
};
// Draw-call diet: the static meshes of a group that share a material (and shadow flags) are baked into
// one mesh each. Transparent, instanced, vertex-coloured meshes and meshes carrying lights stay as they are.
function mergeStatic(group, skip) {
	group.updateMatrixWorld(true);
	var inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), buckets = {}, order = [], kill = [];
	function hasLight(o) { var f = false; o.traverse(function (q) { if (q.isLight) { f = true; } }); return f; }
	function take(ch, mats) {
		var m4 = new THREE.Matrix4().multiplyMatrices(inv, ch.matrixWorld);
		var g = ch.geometry.index ? ch.geometry.toNonIndexed() : ch.geometry.clone();
		g.applyMatrix4(m4);
		if (!g.attributes.normal) { g.computeVertexNormals(); }
		var cnt = g.attributes.position.count, flip = m4.determinant() < 0;
		var ranges = Array.isArray(ch.material) && g.groups.length ? g.groups.map(function (gr) { return [gr.start, Math.min(cnt, gr.start + gr.count), gr.materialIndex]; }) : [[0, cnt, 0]];
		ranges.forEach(function (r) {
			var mat = mats[r[2]] || mats[0];
			if (!mat || r[1] <= r[0]) { return; }
			var key = mat.uuid + (ch.castShadow ? 'c' : '') + (ch.receiveShadow ? 'r' : '');
			if (!buckets[key]) { buckets[key] = { mat: mat, cast: ch.castShadow, recv: ch.receiveShadow, parts: [], n: 0 }; order.push(key); }
			buckets[key].parts.push({ g: g, a: r[0], b: r[1], flip: flip }); buckets[key].n += r[1] - r[0];
		});
		kill.push(ch);
	}
	(function walk(o) {
		o.children.slice().forEach(function (ch) {
			if (ch === skip || ch.userData.keepApart) { return; }
			if (ch.isMesh && !ch.isInstancedMesh && !ch.isSkinnedMesh && ch.geometry && ch.geometry.attributes.position && !hasLight(ch)) {
				var mats = Array.isArray(ch.material) ? ch.material : [ch.material];
				if (!mats.some(function (m) { return !m || m.transparent || m.transmission > 0 || m.vertexColors; })) { take(ch, mats); return; }
			}
			walk(ch);
		});
	})(group);
	if (kill.length < 2) { return; }
	order.forEach(function (key) {
		var B = buckets[key], n = B.n, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), o = 0;
		B.parts.forEach(function (p) {
			var P = p.g.attributes.position.array, N = p.g.attributes.normal.array, U = p.g.attributes.uv ? p.g.attributes.uv.array : null, len = p.b - p.a;
			pos.set(P.subarray(p.a * 3, p.b * 3), o * 3); nor.set(N.subarray(p.a * 3, p.b * 3), o * 3);
			if (U) { uv.set(U.subarray(p.a * 2, p.b * 2), o * 2); }
			if (p.flip) {
				// mirrored transform: restore the winding (swap the 2nd and 3rd vertex of every triangle)
				for (var t = o; t + 2 < o + len; t += 3) {
					for (var k = 0; k < 3; k++) { var a1 = (t + 1) * 3 + k, a2 = (t + 2) * 3 + k, q = pos[a1]; pos[a1] = pos[a2]; pos[a2] = q; q = nor[a1]; nor[a1] = nor[a2]; nor[a2] = q; }
					for (var k2 = 0; k2 < 2; k2++) { var b1 = (t + 1) * 2 + k2, b2 = (t + 2) * 2 + k2, q2 = uv[b1]; uv[b1] = uv[b2]; uv[b2] = q2; }
				}
			}
			o += len;
		});
		var geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
		var mesh = new THREE.Mesh(geo, B.mat); mesh.castShadow = B.cast; mesh.receiveShadow = B.recv; mesh.name = 'merged';
		group.add(mesh);
	});
	kill.forEach(function (ch) { if (ch.parent) { ch.parent.remove(ch); } if (!ch.geometry.userData.shared && !isShared(ch.geometry)) { ch.geometry.dispose(); } });
	// empty helper groups left behind
	(function prune(o) { o.children.slice().forEach(function (ch) { if (ch.userData.keepApart) { return; } prune(ch); if (ch.isGroup && !ch.children.length && ch !== skip) { o.remove(ch); } }); })(group);
}
function disposeTree(root) { root.traverse(function (o) { if (o.geometry && !o.geometry.userData.shared && !isShared(o.geometry)) { o.geometry.dispose(); } }); }
function isShared(g) { for (var k in FOLIAGE) { if (FOLIAGE[k] === g) { return true; } } return false; }

/* ------------------------------------------------------------------ close-up scenes for option cards */
// Option card for a facade material: a real house corner (two walls in light and shade) with a window,
// plinth, eaves and a gravel strip – the material reads as on a building, not as a loose sample board.
// Which setting a build phase belongs to: everything added inside it carries that field (the
// innermost phase wins, so a roof vent beats the roof, and the roof beats the volume).
(function () {
	var PHASE = { volume: 'facade_main', wallDetails: 'facade_main', opening: 'window_style', pitchedRoof: 'roof_type', flatRoof: 'roof_type', roofItems: 'roof_type', snowGuard: 'snow_guards', roofVent: 'roof_vent_type', balconyDraw: 'balcony', frontExtras: 'entrance_canopy', furniture: 'garden_features', plant: 'tree_types', site: 'garden_style', extras: 'terrace_area', lamp: 'exterior_lighting' };
	Object.keys(PHASE).forEach(function (name) {
		var fn = House.prototype[name];
		if (!fn) { return; }
		House.prototype[name] = function () {
			var prev = this.tagNow;
			this.tagNow = PHASE[name];
			try { return fn.apply(this, arguments); } finally { this.tagNow = prev; }
		};
	});
})();
/* ====================================================================== tap on a part of the model
   Every piece knows which setting it belongs to (userData.field). The opaque meshes are merged after
   the build, so the identity is kept as a list of world-space boxes, taken before the merge. A tap
   picks the smallest box that holds the hit point: a window beats the wall, a wall beats the volume. */
function collectPicks(root) {
	var out = [], bx = new THREE.Box3();
	root.updateMatrixWorld(true);
	root.traverse(function (o) {
		var f = o.userData && (o.userData.field || o.userData.item);
		if (!f || o.userData.picked) { return; }
		bx.setFromObject(o);
		if (bx.isEmpty()) { return; }
		var b = bx.clone(), s = b.getSize(new THREE.Vector3());
		out.push({ field: o.userData.field || f, item: o.userData.item || '', box: b, vol: Math.max(0.001, s.x * s.y * s.z) });
	});
	return out;
}
// Which setting the point belongs to: the smallest box around it, else the nearest one within 0.4 m.
function pickFromList(list, p) {
	var best = null, bv = 1e9, near = null, nd = 0.4;
	(list || []).forEach(function (q) {
		if (q.box.containsPoint(p)) { if (q.vol < bv) { bv = q.vol; best = q; } return; }
		var d = q.box.distanceToPoint(p);
		if (d < nd) { nd = d; near = q; }
	});
	var hit = best || near;
	return hit ? { field: hit.field, item: hit.item, point: p } : null;
}
// A moved or turned piece pushed back between the four walls: not its origin but its whole body is
// kept inside, so nothing pokes through a wall however it was built or turned.
var fitBox = null;
function fitInRoom(o, W, D) {
	if (!o || !(W > 0) || !(D > 0)) { return o; }
	fitBox = fitBox || new THREE.Box3();
	o.updateMatrixWorld(true);
	fitBox.setFromObject(o);
	if (!isFinite(fitBox.min.x) || fitBox.min.x > fitBox.max.x) { return o; }
	var e = 0.02, dx = 0, dz = 0;
	if (fitBox.max.x - fitBox.min.x < W - e * 2) {
		if (fitBox.min.x < e) { dx = e - fitBox.min.x; } else if (fitBox.max.x > W - e) { dx = (W - e) - fitBox.max.x; }
	} else { dx = (W - (fitBox.min.x + fitBox.max.x)) / 2; }
	if (fitBox.max.z - fitBox.min.z < D - e * 2) {
		if (fitBox.min.z < e) { dz = e - fitBox.min.z; } else if (fitBox.max.z > D - e) { dz = (D - e) - fitBox.max.z; }
	} else { dz = (D - (fitBox.min.z + fitBox.max.z)) / 2; }
	o.position.x += dx;
	o.position.z += dz;
	if (dx || dz) { o.updateMatrixWorld(true); }
	return o;
}
// Which wall a piece is closest to: 0 = back (z=0), 1 = left (x=0), 2 = front (z=D), 3 = right (x=W).
// The turn a piece needs to face into the room from each wall differs by exactly these angles, so a
// picture carried to another wall keeps facing the room whatever its own model convention is.
var WALL_ROT = [0, 90, 180, 270];
function nearWall(bx, W, D) {
	var cx = (bx.min.x + bx.max.x) / 2, cz = (bx.min.z + bx.max.z) / 2;
	var dist = [cz, cx, Math.max(0, D - cz), Math.max(0, W - cx)], k = 0;
	for (var i = 1; i < 4; i++) { if (dist[i] < dist[k]) { k = i; } }
	return k;
}
// A piece that hangs on a wall (a picture, a wall shelf) is laid against the nearest wall instead of
// being left floating in the middle of the room: it turns with the wall and touches it.
function snapWall(o, w0, rot0, W, D) {
	fitBox = fitBox || new THREE.Box3();
	o.updateMatrixWorld(true);
	fitBox.setFromObject(o);
	var k = nearWall(fitBox, W, D);
	o.rotation.y = rot0 + (WALL_ROT[k] - WALL_ROT[w0]) * D2R;
	o.updateMatrixWorld(true);
	fitBox.setFromObject(o);
	var e = 0.02;
	if (k === 0) { o.position.z += e - fitBox.min.z; }
	else if (k === 1) { o.position.x += e - fitBox.min.x; }
	else if (k === 2) { o.position.z += (D - e) - fitBox.max.z; }
	else { o.position.x += (W - e) - fitBox.max.x; }
	fitInRoom(o, W, D);
	return k;
}
/* ====================================================================== moving a piece by hand
   In a room the furniture stays in its own objects (they are not merged into the walls), so a piece
   can be picked up with the pointer, dragged along the floor and turned. Whatever is moved is clamped
   inside the room and out of the doorway, and reported through `onLayout` so the designer can save it. */
// Which piece is under the screen point: the top-level child of the room's furniture group.
Viewer.prototype.itemAt = function (cx, cy) {
	var hs = this.house;
	if (!hs || !hs.items || !hs.room || !hs.room.W || !this.el) { return null; }
	var r = this.el.getBoundingClientRect();
	if (!r.width || !r.height) { return null; }
	this.ray = this.ray || new THREE.Raycaster();
	this.ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), this.camera);
	var hits = this.ray.intersectObject(hs.items, true);
	for (var i = 0; i < hits.length; i++) {
		var o = hits[i].object;
		while (o && o.parent && o.parent !== hs.items) { o = o.parent; }
		if (o && o.parent === hs.items && o.userData && o.userData.slot) { return { obj: o, point: hits[i].point }; }
	}
	return null;
};
// Grab the piece under the pointer: the orbit controls stop, the piece lifts a little and follows.
Viewer.prototype.grabAt = function (cx, cy, ev) {
	if (!this.house || !this.house.room || !this.house.room.W) { return false; }
	var it = this.itemAt(cx, cy);
	if (!it) { return false; }
	var o = it.obj, bx = new THREE.Box3().setFromObject(o), rm = this.house.room;
	// a piece that does not stand on the floor hangs on a wall: it slides along the walls, not the floor
	var onWall = bx.min.y > 0.35;
	this.drag = {
		obj: o, slot: o.userData.slot,
		dx: o.position.x - it.point.x, dz: o.position.z - it.point.z,
		w: Math.max(0.12, bx.max.x - bx.min.x), d: Math.max(0.12, bx.max.z - bx.min.z),
		rot: o.rotation.y, startX: cx, shift: !!(ev && ev.shiftKey), y0: o.position.y,
		wall: onWall, w0: onWall ? nearWall(bx, rm.W, rm.D) : -1, rot0: o.rotation.y
	};
	if (!onWall) { o.position.y = this.drag.y0 + 0.012; }
	if (this.controls) { this.controls.enabled = false; }
	if (this.el) { this.el.style.cursor = 'grabbing'; }
	if (this.onGrab) { this.onGrab(o.userData.item || o.userData.field || '', this.drag.slot); }
	this.requestRender();
	return true;
};
// Follow the pointer on the floor plane; with Shift held, sideways movement turns the piece instead.
Viewer.prototype.dragTo = function (e) {
	var d = this.drag, hs = this.house;
	if (!d || !hs || !this.el) { return; }
	if (e.shiftKey && !d.wall) { this.turnDrag((e.clientX - d.startX) * 0.5 - (d.rot - d.obj.rotation.y) / D2R); d.startX = e.clientX; return; }
	var r = this.el.getBoundingClientRect();
	this.ray = this.ray || new THREE.Raycaster();
	this.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
	var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -Math.max(0, d.y0)), hit = new THREE.Vector3();
	if (!this.ray.ray.intersectPlane(plane, hit)) { return; }
	d.obj.position.x = hit.x + d.dx;
	d.obj.position.z = hit.z + d.dz;
	if (d.wall) { snapWall(d.obj, d.w0, d.rot0, hs.room.W, hs.room.D); }
	else { fitInRoom(d.obj, hs.room.W, hs.room.D); }
	this.requestRender();
};
// Turn the grabbed piece; it snaps to 15 degrees, and the turned piece is pushed back inside the room.
Viewer.prototype.turnDrag = function (deg) {
	if (!this.drag || this.drag.wall) { return; }
	var cur = this.drag.obj.rotation.y / D2R + deg;
	this.drag.obj.rotation.y = Math.round(cur / 15) * 15 * D2R;
	if (this.house && this.house.room) { fitInRoom(this.drag.obj, this.house.room.W, this.house.room.D); }
	this.requestRender();
};
// Let go: the piece stays where it is, and the designer is told so it can be saved.
Viewer.prototype.dropDrag = function () {
	var d = this.drag;
	if (!d) { return; }
	if (!d.wall) { d.obj.position.y = d.y0; }
	this.drag = null;
	if (this.controls) { this.controls.enabled = true; }
	if (this.el) { this.el.style.cursor = ''; }
	this.picks = this.thumb ? null : collectPicks(this.house.root);
	if (this.onLayout) {
		this.onLayout(d.slot, { x: Math.round(d.obj.position.x * 1000) / 1000, y: Math.round(d.obj.position.z * 1000) / 1000, rot: Math.round(((d.obj.rotation.y / D2R) % 360 + 360) % 360) });
	}
	this.requestRender();
};
// Screen point (CSS pixels) → the setting of the part under it.
Viewer.prototype.pickAt = function (cx, cy) {
	if (!this.picks || !this.picks.length || !this.el) { return null; }
	var r = this.el.getBoundingClientRect();
	if (!r.width || !r.height) { return null; }
	var ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
	this.ray = this.ray || new THREE.Raycaster();
	this.ray.setFromCamera(ndc, this.camera);
	var hits = this.ray.intersectObject(this.scene, true).filter(function (h) { return h.object && h.object.visible && !h.object.isLine; });
	// the first surface may belong to nothing (a ceiling seen from outside, glass, a curtain): keep going
	for (var i = 0; i < hits.length && i < 6; i++) {
		var p = pickFromList(this.picks, hits[i].point);
		if (p) { return p; }
	}
	return null;
};
function facadeScene(c) {
	var hs = new House(c, { mini: true }); hs.pl = SK().plan(c);
	var g = new THREE.Group(), T = 0.3, L = 3.4, H = 2.75, D = 2.0, m = facadeMat(c, c.facade_main);
	var s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(L, 0); s.lineTo(L, H); s.lineTo(0, H); s.lineTo(0, 0);
	var wx0 = 1.25, wx1 = 2.45, wy0 = 0.8, wy1 = 2.2;
	var hp = new THREE.Path(); hp.moveTo(wx0, wy0); hp.lineTo(wx1, wy0); hp.lineTo(wx1, wy1); hp.lineTo(wx0, wy1); hp.lineTo(wx0, wy0); s.holes.push(hp);
	var w = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false }), m); w.castShadow = true; w.receiveShadow = true; g.add(w);
	// metre UVs on the extruded front come from the shape coordinates; the return wall is a box
	var side = box(L - T, -D, 0, L, 0, H, m); g.add(side);
	hs.opening(g, { kind: 'win', x: wx0, y: wy0, w: wx1 - wx0, h: wy1 - wy0 }, T, {});
	// sill, plinth band, eaves with a dark fascia
	g.add(box(wx0 - 0.04, T, wy0 - 0.05, wx1 + 0.04, T + 0.07, wy0, solid('#8E8A84', 0.6)));
	var pm = plinthMat(c);
	if (pm) { g.add(box(-0.02, T, 0, L + 0.02, T + 0.025, 0.32, pm)); g.add(box(L, -D, 0, L + 0.025, T + 0.025, 0.32, pm)); }
	var dark = solid('#2F3235', 0.55), soff = solid(c.arch_style === 'japandi' || c.arch_style === 'alpine' || c.arch_style === 'rustic' ? '#8A6446' : '#E6E2DA', 0.85);
	// the eaves are outside the camera framing (fit): the wall and its material fill the card
	hs.add(box(-0.3, -D - 0.3, H, L + 0.45, T + 0.45, H + 0.04, soff), false);
	hs.add(box(-0.3, T + 0.41, H, L + 0.45, T + 0.45, H + 0.22, dark), false); hs.add(box(L + 0.41, -D - 0.3, H, L + 0.45, T + 0.45, H + 0.22, dark), false);
	hs.fit.add(g);
	// ground: gravel strip along the walls, lawn beyond (not framed by the camera)
	hs.add(box(-0.6, T, -0.01, L + 0.7, T + 0.55, 0.015, groundKind(c, 'gravel')), false);
	hs.add(box(L, -D, -0.01, L + 0.7, T, 0.015, groundKind(c, 'gravel')), false);
	hs.plant(c.garden_style === 'mediterranean' ? 'lavender' : 'shrub', 0.45, T + 0.85, 0.75, 5);
	return hs;
}
// Floor materials of the option cards (and of the interior close-up).
var FLOOR_MATS = {
	parquet: ['planks', '#B7865A'], herringbone: ['herring', '#B07D52'], chevron: ['chevron', '#BE8D5F'], laminate: ['planks', '#C9A47A', { rl: 1.4, bw: 0.19 }],
	vinyl: ['planks', '#A79B8C', { rl: 1.2, bw: 0.18 }], wood_tile: ['planks', '#A9825D', { rl: 1.2, bw: 0.2, grout: '#8E8174' }],
	tiles_large: ['tile', '#D7D3CC', { size: 1.2 }], tiles: ['tile', '#CFCBC4', { size: 0.6 }], marble: ['tile', '#EEECE8', { size: 1.2, vein: 1, grout: '#E2DFDA' }],
	stone: ['tile', '#CFC3AE', { size: 0.6, pores: 1 }], travertine: ['tile', '#D9C9AE', { size: 0.6, pores: 2 }], terrazzo: ['terrazzo', '#E3DED6'],
	cement_tiles: ['cement', '#E6E1D8'], carpet: ['carpet', '#BBB2A6'], cork: ['cork', '#B98D5E'], microcement: ['smooth', '#BDB7AE'], concrete: ['smooth', '#9E9B96']
};
function floorMat(v) {
	var fl = FLOOR_MATS[v] || FLOOR_MATS.parquet, o = Object.assign({ pattern: fl[0], color: fl[1] }, fl[2] || {});
	var polished = v === 'marble' || v === 'terrazzo';
	return pbr('floor', o, { normal: fl[0] === 'carpet' ? 1.6 : (polished ? 0.4 : 1), roughness: 1, clearcoat: polished ? 0.6 : 0, physical: polished });
}
// Option card for a floor: a sunlit room corner (walls, skirting, window light, a rug edge and a plant),
// so parquet, marble or tiles read at a true scale.
function floorScene(c) {
	var hs = new House(c, { mini: true }), fm = floorMat(c.floor_main);
	var wall = solid('#F1EDE6', 0.92), wall2 = solid('#E8E3DB', 0.92), skirt = solid('#FFFFFF', 0.6), E = 6.5;
	// the floor runs beyond the picture (no lawn at the edges); only the room corner is framed
	hs.add(box(-2.6, -2.6, 0, E, E, 0.02, fm), false);
	var s = new THREE.Shape(); s.moveTo(-2.6, 0); s.lineTo(E, 0); s.lineTo(E, 2.7); s.lineTo(-2.6, 2.7); s.lineTo(-2.6, 0);
	var hp = new THREE.Path(); hp.moveTo(-0.4, 0.05); hp.lineTo(1.4, 0.05); hp.lineTo(1.4, 2.35); hp.lineTo(-0.4, 2.35); hp.lineTo(-0.4, 0.05); s.holes.push(hp);
	var bw = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: false }), wall); bw.position.set(0, 0, -2.78); bw.castShadow = true; bw.receiveShadow = true; hs.add(bw, false);
	var fr = frameMat(c);
	[[-0.42, 0.05, 1.42, 0.1], [-0.42, 2.33, 1.42, 2.37]].forEach(function (q) { hs.add(box(q[0], -2.62, q[1], q[2], -2.58, q[3], fr), false); });
	[-0.42, 0.48, 1.38].forEach(function (x) { hs.add(box(x, -2.62, 0.05, x + 0.04, -2.58, 2.37, fr), false); });
	hs.add(box(-2.78, -2.78, 0, -2.6, E, 2.7, wall2), false);
	hs.add(box(-2.6, -2.6, 0, E, -2.58, 0.07, skirt), false); hs.add(box(-2.6, -2.6, 0, -2.58, E, 0.07, skirt), false);
	// a bench and a plant give the scale
	hs.add(box(-2.5, 0.6, 0.0, -2.0, 2.6, 0.42, solid('#6F6A62', 0.85)), false);
	var pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.42, 20), solid('#B8A48C', 0.7)); pot.position.copy(X(-2.15, -2.15, 0.21)); hs.add(pot, false);
	hs.plant('shrub', -2.15, -2.15, 0.9, 3);
	// camera framing: the corner with floor in front (an invisible box)
	var fit = new THREE.Mesh(boxGeo(4.2, 1.2, 4.2), new THREE.MeshBasicMaterial({ visible: false }));
	fit.position.copy(X(-0.5, -0.5, 0.6)); hs.add(fit);
	return hs;
}

/* ================================================================== interior helpers (rooms and items: agh-3d-int.js) */
function roomFloorKey(c, type) {
	var same = function (v) { return !v || v === 'same' ? (c.floor_main || 'parquet') : v; };
	if (/^(bathroom|wc|wellness|sauna|laundry|utility)$/.test(type)) { return c.floor_wet || 'tiles'; }
	if (/^(master|bedroom|guest|kids|wardrobe|playroom)$/.test(type)) { return same(c.floor_bedrooms); }
	if (type === 'kitchen') { return same(c.floor_kitchen); }
	if (/^(hall|corridor|stairs)$/.test(type)) { return same(c.floor_entry); }
	if (type === 'attic') { return 'laminate'; }   // boarded attic floor, whatever the house has below
	if (/^(technical|pantry|wine)$/.test(type)) { return c.floor_wet || 'tiles'; }
	return c.floor_main || 'parquet';
}
function roomFloorMat(c, key) {
	var fl = FLOOR_MATS[key] || FLOOR_MATS.parquet, o = Object.assign({ pattern: fl[0], color: fl[1] }, fl[2] || {});
	if (/^(planks|herring|chevron)$/.test(fl[0]) && ['parquet', 'herringbone', 'chevron', 'laminate'].indexOf(key) !== -1 && /^#[0-9a-f]{6}$/i.test(c.floor_color || '')) { o.color = c.floor_color; }
	if (fl[0] === 'tile' && /^#[0-9a-f]{6}$/i.test(c.grout_color || '')) { o.grout = c.grout_color; }
	var polished = key === 'marble' || key === 'terrazzo';
	return pbr('floor', o, { normal: fl[0] === 'carpet' ? 1.6 : (polished ? 0.4 : 1), roughness: 1, clearcoat: polished ? 0.6 : 0, physical: polished });
}
// Wall tiles of wet rooms.
function bathTileMat(c) {
	var t = c.bath_tiles || 'large_stone', gr = /^#[0-9a-f]{6}$/i.test(c.grout_color || '') ? c.grout_color : null;
	var glaze = { normal: 1, physical: true, clearcoat: 0.7 };
	switch (t) {
		case 'zellige': return pbr('wtile', { pattern: 'zellige', color: '#7FA6A0', grout: gr || '#E8E4DC' }, { normal: 1.4, physical: true, clearcoat: 0.9 });
		case 'subway': return pbr('wtile', { pattern: 'subway', color: '#F1EFEA', grout: gr || '#D9D4CC' }, glaze);
		case 'hexagon': return pbr('wtile', { pattern: 'hex', color: '#E9E6E1', grout: gr || '#CFCAC2' }, glaze);
		case 'fluted': return pbr('wtile', { pattern: 'fluted', color: '#E3DED6', size: 0.03 }, { normal: 2.2 });
		case 'checker': return pbr('wtile', { pattern: 'checker', color: '#EEECE7', color2: '#2B2B2B', grout: gr || '#BDB8B0' }, glaze);
		case 'wood_look': return roomFloorMat(c, 'wood_tile');
		default: return roomFloorMat(c, { large_stone: 'tiles_large', microcement: 'microcement', terrazzo: 'terrazzo', marble: 'marble' }[t] || 'tiles_large');
	}
}

INT.setup({ stdMat: stdMat, solid: solid, pbr: pbr, cached: cached, boxGeo: boxGeo, box: box, X: X, House: House, shadeHex: shadeHex, col: col, num: num, clamp: clamp, has: has, SK: SK, canopyGeo: canopyGeo, leafMat: leafMat, frameMat: frameMat, glassMat: glassMat, roomFloorMat: roomFloorMat, roomFloorKey: roomFloorKey, fitInRoom: fitInRoom, bathTileMat: bathTileMat, imageTexture: imageTexture, onImage: onImage });
LAND.setup({ stdMat: stdMat, solid: solid, pbr: pbr, cached: cached, box: box, House: House, groundKind: groundKind, canopyGeo: canopyGeo, leafMat: leafMat, mergeStatic: mergeStatic });

/* ------------------------------------------------------------------ public API */
// Option-card pictures: drawn by the live preview's renderer into an off-screen target (same WebGL
// context: shaders and textures are shared), tone-mapped like the preview, read back as a JPEG.
// Pictures are kept in the browser (IndexedDB) per plugin version, so a returning visitor gets them
// at once.
var shared = null;
function sharedThumb() {
	if (!shared) { shared = new Viewer({ thumb: true, quality: 'thumb', renderer: liveViewer().renderer }); }
	return shared;
}
function thumbPixels(v, w, h) {
	var r = v.renderer;
	if (!v.rtA || v.rtA.width !== w || v.rtA.height !== h) { thumbPixels.prep(v, w, h); }
	var prevRT = r.getRenderTarget(), prevExp = r.toneMappingExposure, prevShadow = r.shadowMap.needsUpdate;
	r.toneMappingExposure = v.exposure;
	r.shadowMap.needsUpdate = true;
	r.setRenderTarget(v.rtA); r.clear(); r.render(v.scene, v.camera);
	v.outPass.renderToScreen = false; v.outPass.render(r, v.rtB, v.rtA);
	r.setRenderTarget(prevRT); r.toneMappingExposure = prevExp; r.shadowMap.needsUpdate = prevShadow;
	var px = new Uint8Array(w * h * 4); r.readRenderTargetPixels(v.rtB, 0, 0, w, h, px);
	var ctx = v.cv.getContext('2d'), img = ctx.createImageData(w, h), row = w * 4;
	for (var y = 0; y < h; y++) { img.data.set(px.subarray((h - 1 - y) * row, (h - y) * row), y * row); }
	ctx.putImageData(img, 0, 0);
	return v.cv.toDataURL('image/jpeg', 0.84);
}
thumbPixels.prep = function (v, w, h) {
	if (v.rtA) { v.rtA.dispose(); v.rtB.dispose(); }
	v.rtA = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
	v.rtB = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType });
	v.outPass = v.outPass || new OutputPass();
	v.cv = document.createElement('canvas'); v.cv.width = w; v.cv.height = h;
};
// Shaders and textures of the rooms are prepared while the visitor looks at the house, so the first
// switch to a room (and the first furniture cards) shows at once. Built off-screen, never drawn.
var warmed = false;
function warmup(cfg) {
	if (warmed || !live || !live.house) { return Promise.resolve(); }
	warmed = true;
	var v = live, base = cfg || v.c || {};
	return [['living_kitchen', 'night'], ['bathroom', 'midday'], ['master', 'golden']].reduce(function (p, q) {
		return p.then(function () { return new Promise(function (res) { setTimeout(res, 150); }); }).then(function () {
			var c = Object.assign({}, base, { _int: { type: q[0] }, time_of_day: q[1] }), hs;
			try { hs = INT.interiorScene(c, c._int); } catch (e) { return null; }
			var lights = []; hs.root.traverse(function (o) { if (o.isLight) { lights.push(o); } else if (o.isMesh) { o.layers.set(1); } });
			lights.forEach(function (l) { if (l.parent) { l.parent.remove(l); } });
			v.scene.add(hs.root);
			var sv = sharedThumb(); if (!sv.rtA) { thumbPixels.prep(sv, 300, 200); }
			var both = [v.compileFor(v.scene), sv.compileFor(v.scene, sv.rtA)];
			return Promise.all(both).then(function () { v.scene.remove(hs.root); disposeTree(hs.root); });
		});
	}, texturesReady());
}
// Kept pictures (IndexedDB; any failure simply means "not kept").
var VER = (function () { try { return new URL(import.meta.url).search || 'dev'; } catch (e) { return 'dev'; } })() + (MODELS_ON ? '|m' + (((window.AGH_LOADER || {}).models || {}).manifest || '').replace(/^.*ver=/, '') : '');
var idb = null;
function store() {
	if (idb !== null) { return idb; }
	idb = new Promise(function (res) {
		try {
			var rq = indexedDB.open('agh-thumbs', 1);
			rq.onupgradeneeded = function () { rq.result.createObjectStore('t'); };
			rq.onsuccess = function () { res(rq.result); };
			rq.onerror = function () { res(null); };
		} catch (e) { res(null); }
	});
	return idb;
}
function hashKey(str) {
	var h1 = 0x811c9dc5, h2 = 0x01000193 ^ str.length;
	for (var i = 0; i < str.length; i++) { var ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 16777619); h2 = Math.imul(h2 ^ ch, 2246822519); }
	return VER + ':' + (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}
function kept(key) {
	return store().then(function (db) {
		if (!db) { return ''; }
		return new Promise(function (res) { try { var q = db.transaction('t').objectStore('t').get(key); q.onsuccess = function () { res(q.result || ''); }; q.onerror = function () { res(''); }; } catch (e) { res(''); } });
	});
}
var keepCount = 0;
function keep(key, url) {
	store().then(function (db) {
		if (!db || !url) { return; }
		try {
			var tx = db.transaction('t', 'readwrite'), os = tx.objectStore('t');
			os.put(url, key);
			// pictures of earlier versions are dropped now and then
			if (++keepCount % 40 === 1) { var cur = os.openCursor(); cur.onsuccess = function () { var cc = cur.result; if (!cc) { return; } if (String(cc.key).indexOf(VER + ':') !== 0) { cc.delete(); } cc.continue(); }; }
		} catch (e) { /* storage full or blocked */ }
	});
}
// Renders one configuration into an image (option cards). Queued so the UI stays responsive.
var queue = Promise.resolve();
function thumb(cfg, w, h, mode, alive) {
	var key = hashKey((mode || 'mini') + '|' + w + 'x' + h + '|' + JSON.stringify(cfg));
	return kept(key).then(function (url) {
		if (url) { return url; }
		queue = queue.then(function () {
			return new Promise(function (res) {
				var go = function () {
					if (alive && !alive()) { res(''); return; }
					try {
						var v = sharedThumb();
						v.setSize(w, h);
						v.update(cfg, mode || 'mini');
						// the pixels of new materials come from the texture workers; new shaders compile in parallel
						if (!v.rtA || v.rtA.width !== w || v.rtA.height !== h) { thumbPixels.prep(v, w, h); }
						Promise.all([texturesReady(), modelsSettled(v, 10000)]).then(function () { return v.compileFor(v.scene, v.rtA); }).then(function () {
							try { var u = thumbPixels(v, w, h); keep(key, u); res(u); } catch (e) { res(''); }
						});
					} catch (e) { res(''); }
				};
				setTimeout(go, 0);
			});
		});
		return queue;
	});
}
function supported() {
	try { var cv = document.createElement('canvas'); return !!(window.WebGL2RenderingContext && cv.getContext('webgl2')); } catch (e) { return false; }
}
// One live viewer: its canvas is moved into whichever preview box is current (designer or wizard).
var live = null, ro = null;
function liveViewer(opts) {
	if (!live) {
		live = new Viewer(opts || {});
		live.wrap = document.createElement('div'); live.wrap.className = 'agh-3d';
		live.wrap.appendChild(live.el);
		// Resize and redraw in the same frame: a resized canvas is cleared, waiting for the next
		// animation frame would show one empty or distorted frame.
		if (window.ResizeObserver) { ro = new ResizeObserver(function () { if (live.wrap.clientWidth > 0) { live.syncSize(); live.render(); } }); ro.observe(live.wrap); }
	}
	return live;
}
function attach(container, cfg, opts) {
	liveViewer(opts);
	if (live.wrap.parentNode !== container) { container.insertBefore(live.wrap, container.firstChild); }
	live.syncSize();
	live.update(cfg);
	return live;
}
// A texture arrived from a worker: redraw the live preview (and its shadows: foliage cards cast them).
var texTimer = 0;
onTexture(function () {
	if (texTimer) { return; }
	texTimer = setTimeout(function () { texTimer = 0; if (live && !live.disposed) { live.shadowDirty = true; live.requestRender(); } }, 90);
});
/* ------------------------------------------------------------------ guide pictures
 * The picture the image model follows: the very house the visitor built, from the angle of the view
 * being generated. "hero" is the visitor's own camera (what they see on screen), the others are fixed
 * angles, "interior_<room id>" is the interior view of that room. Rendered off-screen through the same
 * renderer, so nothing on screen changes.
 * opts.clean: vehicles, people, pets, the tree line and the haze are left off – in the model they are
 *   simple shapes, and a structure reference makes the image model copy those shapes (toy-like cars,
 *   cone trees); without them it paints them for real from the prompt.
 * opts.camera: "auto" keeps the visitor's direction but takes the hero from photographer height when
 *   the visitor looks from high above (above 18°, unless the main camera is set to "elevated");
 *   "visitor" keeps the exact camera.
 * opts.rooms: { room id: { id, type, area, … } } for the interior views.
 * Returns { view: dataURL } – an empty object when there is no WebGL or no house yet. */
var GUIDE_CAM = { front: [0, 8], back: [180, 8], left: [270, 8], right: [90, 8], aerial: [36, 42] };
var GUIDE_CLEAN = { vehicles: [], people: 'none', pets: [], _clean: true };
var EYE_MAX = 18, EYE_EL = 9;
// direction of a camera as [azimuth, elevation] in degrees, the same convention as the presets
function camPose(v) {
	var t = v.controls ? v.controls.target : new THREE.Vector3(), off = v.camera.position.clone().sub(t), len = off.length() || 1;
	return [Math.atan2(off.x, off.z) / D2R, Math.asin(clamp(off.y / len, -1, 1)) / D2R];
}
function guides(views, w, h, out, opts) {
	out = out || {}; opts = opts || {};
	if (!live || !live.house || !live.c) { return Promise.resolve(out); }
	w = w || 1152; h = h || 656;   // enough for structure guidance, a third less to upload
	views = (views && views.length ? views : ['hero', 'front', 'back', 'left', 'right', 'aerial']).slice(0, 16);
	// the house from outside, whatever the visitor is looking at right now
	var base = Object.assign({}, live.c, opts.clean ? GUIDE_CLEAN : {});
	delete base._int; delete base._item; delete base._cam;
	var heroLive = !live.c._int && !live.c._item;
	var pose = heroLive ? camPose(live) : null;
	var lowered = !!pose && opts.camera !== 'visitor' && pose[1] > EYE_MAX && live.c.camera !== 'elevated';
	var exact = views.indexOf('hero') !== -1 && heroLive && !opts.clean && !lowered;
	var fixed = views.filter(function (v) { return v.indexOf('interior_') !== 0 && (v !== 'hero' || !exact); });
	var rooms = views.filter(function (v) { return v.indexOf('interior_') === 0 && opts.rooms && opts.rooms[v.slice(9)]; });
	var step = function (fn) { return new Promise(function (res) { setTimeout(function () { try { fn(res); } catch (e) { res(); } }, 0); }); };
	// the live scene's models on their way are waited for (at most 3 s), so no half-swapped room goes out
	var job = Promise.all([texturesReady(), modelsSettled(live, 3000)]);
	if (exact) {
		// exactly the visitor's own view: the live camera, only the picture shape differs
		job = job.then(function () {
			return step(function (res) {
				var cam = live.camera, keep = cam.aspect;
				cam.aspect = w / h; cam.updateProjectionMatrix();
				if (!live.rtA || live.rtA.width !== w || live.rtA.height !== h) { thumbPixels.prep(live, w, h); }
				out.hero = thumbPixels(live, w, h);
				cam.aspect = keep; cam.updateProjectionMatrix();
				if (live.rtA) { live.rtA.dispose(); live.rtB.dispose(); live.rtA = live.rtB = null; }
				live.requestRender();
				res();
			});
		});
	}
	if (fixed.length) {
		// the house is built once off-screen; the other views only move the camera, which is what
		// makes this fast enough to run while the visitor is still reading the dialog
		job = job.then(function () {
			return step(function (res) {
				var v = sharedThumb();
				v.setSize(w, h);
				// a copy: the camera of each view is written into it, and the live preview's own
				// configuration must not be touched by that
				v.update(Object.assign({}, base), 'guide');
				if (!v.rtA || v.rtA.width !== w || v.rtA.height !== h) { thumbPixels.prep(v, w, h); }
				modelsSettled(v, 3000).then(function () { return v.compileFor(v.scene, v.rtA); }).then(res, res);
			});
		});
		fixed.forEach(function (view) {
			job = job.then(function () {
				return step(function (res) {
					var v = sharedThumb();
					if (view === 'hero') {
						if (lowered) { v.c._cam = [pose[0], EYE_EL]; v.fitCamera(true); }
						else if (heroLive) {
							// the visitor's very camera, on the clean scene
							v.c._cam = null; v.fitCamera(true);
							v.camera.position.copy(live.camera.position); v.camera.quaternion.copy(live.camera.quaternion);
							v.camera.fov = live.camera.fov; v.camera.aspect = w / h; v.camera.updateProjectionMatrix();
						} else { v.c._cam = null; v.fitCamera(true); }   // visitor is inside: the main camera preset
					} else {
						v.c._cam = GUIDE_CAM[view] || GUIDE_CAM.front;
						v.fitCamera(true);
					}
					out[view] = thumbPixels(v, w, h);
					res();
				});
			});
		});
	}
	rooms.forEach(function (view) {
		// every room is its own scene: built, its shaders prepared, then taken from the interior camera
		job = job.then(function () {
			return step(function (res) {
				var v = sharedThumb();
				v.setSize(w, h);
				v.update(Object.assign({}, base, { _int: opts.rooms[view.slice(9)] }), 'guide');
				if (!v.rtA || v.rtA.width !== w || v.rtA.height !== h) { thumbPixels.prep(v, w, h); }
				modelsSettled(v, 3000).then(function () { return v.compileFor(v.scene, v.rtA); }).then(function () {
					try {
						// a photographer's position, not the cut-away: standing inside the open corner at eye
						// height with a wide lens, looking across the room to the far corner – the right and
						// front walls (cut away from outside) and the ceiling close the room as in a real photo
						var rm = v.house && v.house.room;
						if (rm && rm.W && rm.D) {
							var eye = Math.min(1.5, rm.H * 0.55), cam = v.camera;
							cam.fov = 62; cam.aspect = w / h;
							cam.position.set(rm.W - 0.3, eye, rm.D - 0.3);
							cam.lookAt(rm.W * 0.3, eye * 0.9, rm.D * 0.3);
							cam.updateProjectionMatrix();
						}
						out[view] = thumbPixels(v, w, h);
					} catch (e) { /* this room goes without */ }
					res();
				}, res);
			});
		});
	});
	return job.then(function () { return out; });
}
// models(): the state of the real 3D models (switch, device tier, loaded/swapped/kept counts) – for the
// tests and the support page; null when switched off
var api = { attach: attach, thumb: thumb, warmup: warmup, supported: supported, viewer: function () { return live; }, texturesReady: texturesReady, guides: guides, version: 'r170-2',
	models: function () { return MODELS ? MODELS.getStats() : (MODELS_ON ? { enabled: true, loading: true } : null); } };
window.AGH_3D = api;
export default api;
