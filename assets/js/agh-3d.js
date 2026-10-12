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
import { texture, setAnisotropy } from './agh-3d-tex.js';

var D2R = Math.PI / 180;
var SK = function () { return window.AGH_Sketch; };
function X(x, y, z) { return new THREE.Vector3(x, z, y); }
function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function has(a, v) { return Array.isArray(a) && a.indexOf(v) !== -1; }
function col(c, d) { return /^#[0-9a-fA-F]{6}$/.test(String(c || '')) ? String(c).toUpperCase() : d; }
function shadeHex(h, k) { var c = new THREE.Color(h); var t = k < 0 ? new THREE.Color(0, 0, 0) : new THREE.Color(1, 1, 1); c.lerp(t, Math.abs(k)); return '#' + c.getHexString(); }

/* ================================================================== materials */
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
function pbr(kind, opts, params) {
	params = params || {};
	var key = 'p' + kind + JSON.stringify(opts || {}) + JSON.stringify(params);
	return cached(key, function () {
		var t = texture(kind, opts || {});
		var P = params.physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
		var m = new P({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: params.roughness === undefined ? 1 : params.roughness, metalness: params.metalness || 0 });
		m.normalScale = new THREE.Vector2(params.normal || 1, params.normal || 1);
		if (t.alpha) { m.alphaTest = 0.5; m.side = THREE.DoubleSide; }
		if (params.clearcoat) { m.clearcoat = params.clearcoat; m.clearcoatRoughness = 0.15; }
		if (params.color) { m.color = new THREE.Color(params.color); }
		return m;
	});
}
function glassMat(c, night) {
	if (night && c.night_lighting !== false) { return solid('#2A2218', 0.2, 0, { emissive: '#FFC27A', emissiveIntensity: 1.6 }); }
	var g = c.glazing || 'clear';
	var key = 'glass' + g;
	return cached(key, function () {
		return new THREE.MeshPhysicalMaterial({
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
function groundVC(c) {
	var base = groundKind(c, 'meadow');
	return cached(base.userData.key + '|vc', function () { var m = base.clone(); m.vertexColors = true; return m; });
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
	var polys = [], lines = [];
	var sc = {
		c: c, o: {}, id: 'r', light: {}, cam: { t: [0, 0, 1], P: function () { return [0, 0]; } },
		mat: function () { return 'm'; }, def: function (k) { return k; },
		poly3: function (p3, fill) { polys.push(p3); return { svg: '', depth: 0 }; },
		plane: function (o, du, dv, poly) { polys.push(poly.map(function (q) { return [o[0] + du[0] * q[0] + dv[0] * q[1], o[1] + du[1] * q[0] + dv[1] * q[1], o[2] + du[2] * q[0] + dv[2] * q[1]]; })); return { svg: '', depth: 0 }; },
		line: function (a, b, color, width) { lines.push({ a: a, b: b, color: color, width: width }); return ''; },
		track: function () { return [0, 0]; }, depth: function () { return 0; }, visible: function () { return true; }, lit: function () { return 0; }
	};
	var r = SK()._roof(sc, v, pl, type);
	return { info: r, polys: polys, lines: lines };
}
// Profile of the wall top on the gable ends, as [u, z] points from u = len down to 0.
function gableTop(face, v, type, rise) {
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
function faceOpenings(c, v, pl, F, entrance, rise, gabled) {
	var ws = windowSpec(c), st = SK()._style(c), len = F.len, out = [], reserved = [];
	var dp = SK()._door(c, len);
	if (entrance) {
		out.push({ kind: 'door', x: dp.x, y: pl.plinth, w: dp.w, h: dp.h });
		reserved.push([dp.x - 0.5, dp.x + dp.w + 0.5]);
		if (num(c.terrace_area, 0) > 0 && len > 7) {
			var tw = { folding: 3.6, french: 1.6, sliding: 2.6, lift_slide: 3.3 }[c.terrace_door] || 3.3;
			var tx = clamp(len * 0.62, dp.x + dp.w + 1.2, len - tw - 0.6);
			out.push({ kind: 'tdoor', x: tx, y: pl.plinth, w: tw, h: 2.35 });
			reserved.push([tx - 0.4, tx + tw + 0.4]);
		}
	}
	var side = F.name === 'right' || F.name === 'left';
	for (var fl = 0; fl < pl.floors; fl++) {
		var z0 = pl.plinth + fl * pl.FH;
		if (z0 + 1 > v.h) { break; }
		var w = ws.w, h = Math.min(ws.h, pl.FH - 0.6), sill = ws.sill;
		if (c.window_style === 'panoramic' && fl > 0) { w = 1.9; h = 1.7; sill = 0.6; }
		if (st.band) { w = Math.min(len - 1.2, 4.4); h = 1.0; sill = 1.0; }
		var n = Math.max(1, Math.floor((len - 0.8) / (w + ws.gap)));
		if (side) { n = Math.max(1, Math.min(n, Math.floor((len - 1) / (w + 1.4)))); }
		if (F.name === 'back' && !st.band) { n = Math.max(1, n - 1); }
		var step = len / n;
		for (var i = 0; i < n; i++) {
			var x = step * i + (step - w) / 2;
			if (fl === 0 && reserved.some(function (r) { return x < r[1] && x + w > r[0]; })) { continue; }
			out.push({ kind: 'win', x: x, y: z0 + sill, w: w, h: h, fl: fl, i: i });
		}
	}
	if (gabled && (pl.attic || rise > 2.2)) {
		var gw = Math.min(1.6, len * 0.22), gh = Math.min(1.3, rise - 0.9, rise * (1 - gw / len) - 0.55, gabled === 'half_hip' ? rise * 0.58 - 0.55 : 9);
		if (gh > 0.4) { out.push({ kind: 'win', x: len / 2 - gw / 2, y: v.h + 0.35, w: gw, h: gh, gable: true }); }
	}
	if (c.corner_window && F.name === 'front' && entrance) { out.unshift({ kind: 'win', x: len - 1.7, y: pl.plinth + 0.5, w: 1.6, h: 1.8, corner: true }); }
	// holes must not overlap: doors and the corner window win over ordinary windows
	out.sort(function (a, b) { var r = function (o) { return o.kind === 'door' ? 0 : (o.kind === 'tdoor' ? 1 : (o.corner ? 2 : 3)); }; return r(a) - r(b); });
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
House.prototype.add = function (m, fit) { if (m) { (fit === false ? this.root : this.fit).add(m); } return m; };

House.prototype.build = function () {
	var c = this.c, K = SK(), pl = K.plan(c), vols = K._volumes(c, pl), self = this;
	this.pl = pl; this.vols = vols;
	var roofType = c.roof_type || 'gable';
	vols.forEach(function (v, idx) {
		var type = roofType;
		if (v.wing) { type = roofType === 'flat' ? 'flat' : (roofType === 'complex' || roofType === 'multi' ? 'gable' : roofType); }
		if (v.second && roofType !== 'flat') { type = roofType === 'hip' || roofType === 'pyramid' ? 'hip' : roofType; }
		if (type === 'multi' || type === 'complex') { type = roofType === 'complex' ? 'hip' : 'gable'; }
		self.volume(v, idx, type);
	});
	if (pl.units > 1) { this.units(vols[0]); }
	this.extras();
	if (!this.o.mini) { this.site(); }
	return this;
};

House.prototype.volume = function (v, idx, type) {
	var c = this.c, pl = this.pl, st = SK()._style(c), self = this, T = 0.3;
	var rd = type === 'flat' ? null : roofData(c, v, pl, type);
	var rise = rd ? rd.info.rise : 0;
	var acc = c.facade_accent || [];
	var wallMat = (v.wing || v.second) && acc.length ? accentMat(c, acc[0]) : facadeMat(c, c.facade_main);
	var faces = [
		{ name: 'front', o: [v.x0, v.y1], u: [1, 0], n: X(0, 1, 0), len: v.x1 - v.x0 },
		{ name: 'right', o: [v.x1, v.y1], u: [0, -1], n: X(1, 0, 0), len: v.y1 - v.y0 },
		{ name: 'back', o: [v.x1, v.y0], u: [-1, 0], n: X(0, -1, 0), len: v.x1 - v.x0 },
		{ name: 'left', o: [v.x0, v.y0], u: [0, 1], n: X(-1, 0, 0), len: v.y1 - v.y0 }
	];
	faces.forEach(function (F) {
		var g = new THREE.Group();
		var U = X(F.u[0], F.u[1], 0), Vv = new THREE.Vector3(0, 1, 0), W = F.n.clone();
		var m = new THREE.Matrix4().makeBasis(U, Vv, W);
		var org = X(F.o[0], F.o[1], 0).addScaledVector(W, -T);
		m.setPosition(org);
		g.matrixAutoUpdate = false; g.matrix.copy(m);
		var top = gableTop(F.name, v, type, rise);
		var entrance = v.main && F.name === 'front';
		var ops = faceOpenings(c, v, pl, F, entrance, rise, top && type !== 'shed' ? type : false);
		F.ops = ops;
		// a shed roof's high side needs a full-height wall
		var fullH = type === 'shed' && F.name === (v.ridge !== 'y' ? 'back' : 'left') ? v.h + rise : v.h;
		// wall shape with holes
		var shape = new THREE.Shape();
		shape.moveTo(0, 0); shape.lineTo(F.len, 0);
		if (top) { top.forEach(function (p) { shape.lineTo(p[0], p[1]); }); } else { shape.lineTo(F.len, fullH); shape.lineTo(0, fullH); }
		shape.lineTo(0, 0);
		ops.forEach(function (o) { shape.holes.push(holePath(o, st, c)); });
		var wg = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 10 });
		var wm = new THREE.Mesh(wg, wallMat); wm.castShadow = true; wm.receiveShadow = true;
		g.add(wm);
		self.wallDetails(g, v, F, ops, top, T, st, wallMat);
		ops.forEach(function (o) { self.opening(g, o, T, st); });
		self.add(g);
	});
	// interior: dark box so open doors/thin glass never show the sky through the house
	this.add(box(v.x0 + T + 0.02, v.y0 + T + 0.02, 0.05, v.x1 - T - 0.02, v.y1 - T - 0.02, v.h - 0.05, solid('#1F1E1C', 1, 0), { noCast: true }));
	// plinth band
	var pm = plinthMat(c);
	if (pm) {
		var ph = pl.plinth, e = 0.03;
		this.add(box(v.x0 - e, v.y0 - e, 0, v.x1 + e, v.y1 + e, ph, pm));
	}
	// roof
	if (type === 'flat') { this.flatRoof(v); } else { this.pitchedRoof(v, rd, type); }
	this.roofItems(v, type, rd ? rd.info : null);
	if (v.main) { this.frontExtras(v); }
};
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
	var arch = st.arches && o.kind === 'win' && !o.gable;
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
	if (main && F.name === 'front' && acc[0]) {
		var dp = SK()._door(c, F.len), ax0 = Math.max(0, dp.x - 0.75), ax1 = Math.min(F.len, dp.x + dp.w + 0.75);
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
		for (var q = pl.plinth; q < v.h - 0.3; q += 0.5) { var qw = (Math.round(q * 2) % 2) ? 0.35 : 0.5; g.add(lbox(F.len - qw, q, T, F.len, q + 0.42, T + 0.03, qm)); }
	}
	if (main && F.name === 'right') { this.wallTech(g, F, T); }
	if (main && F.name === 'front') {
		var dp2 = SK()._door(c, F.len);
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
	var c = this.c, fm = frameMat(c), gm = glassMat(c, this.night), reveal = st.reveal ? 0.2 : 0.1, fd = 0.08;
	var w0 = T - reveal - fd, w1 = T - reveal, mat = c.window_frame_material || 'aluminium';
	var fr = { pvc: 0.09, aluminium: 0.05, wood: 0.075, wood_alu: 0.06 }[mat] || 0.05;
	var x0 = o.x, x1 = o.x + o.w, y0 = o.y, y1 = o.y + o.h;
	var arch = st.arches && o.kind === 'win' && !o.gable;
	// reveal lining (lighter)
	if (o.kind === 'door') {
		var dm = c.entrance_door === 'wood' ? pbr('wood', { color: '#8A5A36' }, { normal: 1 }) : solid(col(c.entrance_door_color, '#2B2E31'), 0.45, 0.2);
		g.add(lbox(x0, y0, w0, x1, y1, w1, fm));
		g.add(lbox(x0 + 0.06, y0, w0 + 0.01, x1 - 0.06, y1 - 0.06, w1 + 0.01, dm));
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
	if (st.trim) { var tc = st.trim === 'light' ? shadeHex(col(c.facade_color, '#F2EFE9'), 0.35) : st.trim; this.frameRect(g, x0 - 0.13, y0 - 0.13, x1 + 0.13, y1 + (arch ? Math.min(o.w / 2, 0.4) : 0) + 0.13, T, T + 0.04, 0.13, solid(tc, 0.7)); }
	if (st.lintel) { g.add(lbox(x0 - 0.16, y1 + 0.02, T, x1 + 0.16, y1 + 0.22, T + 0.05, st.lintel === '#1E1F21' ? solid(st.lintel, 0.5, 0.6) : pbr('wood', { color: st.lintel }, { normal: 1 }))); }
	this.frameRect(g, x0, y0, x1, y1, w0, w1, fr, fm);
	if (mat === 'wood' || mat === 'wood_alu') { this.frameRect(g, x0 + fr * 0.55, y0 + fr * 0.55, x1 - fr * 0.55, y1 - fr * 0.55, w1 - 0.01, w1 + 0.005, fr * 0.4, pbr('wood', { color: '#A8744A' }, { normal: 0.6 })); }
	g.add(lbox(x0 + fr, y0 + fr, w0 + fd * 0.45, x1 - fr, y1 - fr, w0 + fd * 0.55, gm, true));
	if (arch) {
		var as = new THREE.Shape(); as.moveTo(x0, y1); as.lineTo(x1, y1); as.absellipse(x0 + o.w / 2, y1, o.w / 2, Math.min(o.w / 2, 0.4), 0, Math.PI, false);
		var am = new THREE.Mesh(new THREE.ExtrudeGeometry(as, { depth: 0.02, bevelEnabled: false, curveSegments: 16 }), gm); am.position.z = w0 + fd * 0.45; g.add(am);
		g.add(lbox(x0, y1 - 0.02, w0, x1, y1 + 0.03, w1, fm));
	}
	var mull = Math.max(1, Math.round(o.w / (c.window_style === 'panoramic' ? 1.3 : 1.1)));
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
	var shut = has(sh, 'spalettas') ? '#8A5A36' : (has(sh, 'shutters') ? ({ mediterranean: '#6B7A55', rustic: '#6B7A55', classic_burgher: '#ECE7DC', american_farm: '#24282B' }[c.arch_style] || '#3E4245') : null);
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
	var self = this, ridgeM = solid(shadeHex(col(c.roof_color, '#3A3D40'), -0.15), 0.6, 0.1);
	if (c.season === 'winter') { ridgeM = solid('#EEF2F6', 0.6); }
	var P3 = rd.polys.map(function (p) { return p.map(function (q) { return X(q[0], q[1], q[2]); }); });
	P3.forEach(function (pts) { var m = polyMesh(pts, [rm, soffit], { thick: 0.16 }); if (m) { m.position.y += 0.02; self.add(m); } });
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
		if (e.n >= 2 && (e.a.y > v.h + 0.3 || e.b.y > v.h + 0.3)) { var r = rod(e.a.clone().setY(e.a.y + 0.05), e.b.clone().setY(e.b.y + 0.05), 0.11, ridgeM, 8); if (r) { self.add(r); } }
	});
	// gutters, downpipes, barge boards, rafters, snow guards, vents
	rd.lines.forEach(function (L) {
		var a = X(L.a[0], L.a[1], L.a[2]), b = X(L.b[0], L.b[1], L.b[2]);
		var m;
		if (L.width === 0.17) {
			m = solid(L.color, 0.35, L.color === '#B87333' ? 0.9 : 0.5);
			self.add(rod(a.clone().setY(a.y - 0.1), b.clone().setY(b.y - 0.1), 0.075, m, 10));
			// downpipe at the end with the larger x (or z), against the wall
			var e = a.x + a.z > b.x + b.z ? a : b, px, pz;
			if (Math.abs(a.z - b.z) < 0.01) { px = clamp(e.x, v.x0 + 0.2, v.x1 - 0.2); pz = e.z > v.y1 ? v.y1 + 0.1 : v.y0 - 0.1; }
			else { pz = clamp(e.z, v.y0 + 0.2, v.y1 - 0.2); px = e.x > v.x1 ? v.x1 + 0.1 : v.x0 - 0.1; }
			self.add(rod(new THREE.Vector3(px, e.y - 0.12, pz), new THREE.Vector3(px, 0.08, pz), 0.05, m, 8));
		} else if (L.width >= 0.2 && L.width < 0.22 + 1e-6 && L.color !== '#3A3D40') { self.add(beam(a, b, 0.06, 0.24, solid(L.color, 0.6, L.color === '#3E4245' ? 0.5 : 0))); }
		else if (L.width === 0.1) { self.add(beam(a, b, 0.09, 0.12, solid(L.color, 0.75))); }
		else if (L.width === 0.07) { self.add(rod(a, b, 0.025, solid('#C9CDD0', 0.3, 0.8), 6)); }
		else { self.add(rod(a, b, L.width === 0.12 ? 0.18 : 0.09, solid(L.color, 0.5, 0.3), 8)); }
	});
};
House.prototype.flatRoof = function (v) {
	var c = this.c, h = v.h, fasc = solid(shadeHex(col(c.facade_color, '#F2EFE9'), c.arch_style === 'high_tech' ? -0.05 : 0.05), 0.8);
	var e = 0.1, top = h + 0.35, t = 0.25;
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
House.prototype.roofItems = function (v, type, info) {
	var c = this.c, pl = this.pl, self = this, W = v.x1 - v.x0, D = v.y1 - v.y0;
	var solar = c.roof_solar || has(c.energy, 'solar') || !!SK()._style(c).pv;
	var panelM = pbr('solar', {}, { roughness: 0.6, metalness: 0.35, normal: 0.8, clearcoat: 1, physical: true });
	var chimneyM = c.arch_style === 'classic_burgher' || c.arch_style === 'rustic' || c.facade_main === 'brick' ? pbr('brick', { color: '#9A4E35' }, { normal: 1.6 }) : pbr('render', { color: '#4A4D50', texture: 'fine' }, { normal: 0.6 });
	function chimney(zTop) {
		var cx = v.x0 + W * 0.7, cy = (v.y0 + v.y1) / 2 + 0.3, cw = 0.75;
		self.add(box(cx, cy, v.h - 0.5, cx + cw, cy + cw, zTop, chimneyM));
		self.add(box(cx - 0.06, cy - 0.06, zTop, cx + cw + 0.06, cy + cw + 0.06, zTop + 0.1, solid('#2E3033', 0.6)));
	}
	if (type === 'flat') {
		if (solar) {
			var n = Math.max(1, Math.min(6, Math.floor((W - 1.2) / 2.1)));
			for (var i = 0; i < n; i++) {
				var x0 = v.x0 + 0.8 + i * 2.1, y0 = v.y0 + 1 + D * 0.3, z0 = v.flatTop + 0.15;
				var pts = [X(x0, y0 + 1.1 * 0.85, z0), X(x0 + 1.7, y0 + 1.1 * 0.85, z0), X(x0 + 1.7, y0, z0 + 0.55), X(x0, y0, z0 + 0.55)];
				this.add(polyMesh(pts, [panelM, solid('#B9BDC1', 0.4, 0.8)], { thick: 0.04 }));
				this.add(box(x0 + 0.1, y0 + 0.05, v.flatTop, x0 + 0.16, y0 + 0.11, z0 + 0.5, solid('#9DA1A4', 0.4, 0.8)));
			}
		}
		if (c.chimney) { chimney(v.flatTop + 1.0); }
		return;
	}
	if (c.chimney) { chimney(v.h + (info ? info.rise : 0) + 1.0); }
	if (v.ridge === 'y') { return; }
	var tp = Math.tan(pl.pitch * D2R), cosP = Math.cos(pl.pitch * D2R), sinP = Math.sin(pl.pitch * D2R);
	var slopeL = (c.roof_type === 'shed' ? D : D / 2) / cosP;
	var hipIn = c.roof_type === 'hip' || c.roof_type === 'pyramid' ? D / 2 : 0;
	// point on the front roof plane: u along the eave, s up the slope, lift above the surface
	function onRoof(u, s, lift) { return X(v.x0 + u, v.y1 - s * cosP + lift * sinP, v.h + s * sinP + lift * cosP + 0.02); }
	function roofRect(u, s, w, hh, lift, mats, thick) {
		return polyMesh([onRoof(u, s, lift), onRoof(u + w, s, lift), onRoof(u + w, s + hh, lift), onRoof(u, s + hh, lift)], mats, { thick: thick });
	}
	if (solar) {
		var rows = Math.max(1, Math.min(3, Math.floor((slopeL - 0.8) / 1.8))), cols = Math.max(2, Math.floor((W - 2 * hipIn - 1.2) * 0.7 / 1.12));
		var pw = cols * 1.12, sx = clamp(W * 0.42 - pw / 2, hipIn + 0.6, W - pw - 0.5 - hipIn);
		for (var r = 0; r < rows; r++) { for (var q = 0; q < cols; q++) { this.add(roofRect(sx + q * 1.12 + 0.01, 0.6 + r * 1.75 + 0.01, 1.1, 1.73, 0.12, [panelM, solid('#B9BDC1', 0.4, 0.8)], 0.04)); } }
	}
	var nw = clamp(num(c.roof_windows, 0) + (pl.attic && !num(c.roof_windows, 0) && !num(c.dormers, 0) ? 2 : 0), 0, 6);
	for (var k = 0; k < nw; k++) {
		var ux = hipIn + 0.4 + (W - 2 * hipIn - 1.6) * (nw === 1 ? 0.5 : k / (nw - 1));
		if (solar) { ux = k % 2 ? W - hipIn - 1.4 : hipIn + 0.5; }
		this.add(roofRect(ux, slopeL * 0.42, 0.78, 1.2, 0.08, [frameMat(c), frameMat(c)], 0.1));
		this.add(roofRect(ux + 0.07, slopeL * 0.42 + 0.07, 0.64, 1.06, 0.1, [glassMat(c, this.night), frameMat(c)], 0.01));
	}
	var nd = clamp(num(c.dormers, 0), 0, 4);
	var wall = facadeMat(c, c.facade_main), rm = roofMat(c);
	for (var dd = 0; dd < nd; dd++) {
		var dw = 1.8, dx = v.x0 + hipIn + (W - 2 * hipIn) * (dd + 0.5) / nd - dw / 2, yd = v.y1 - 1.0, z0 = v.h + 1.0 * tp, hw = 1.35, yb = yd - (hw + 0.8) / tp;
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
// Canopy, porch, balcony, steps / ramp on the main volume.
House.prototype.frontExtras = function (v) {
	var c = this.c, pl = this.pl, st = SK()._style(c), fcol = col(c.facade_color, '#F2EFE9'), self = this;
	var dp = SK()._door(c, v.x1 - v.x0);
	if (c.entrance_canopy) {
		var dx = v.x0 + dp.x + dp.w / 2 - 0.95;
		this.add(box(dx, v.y1, pl.plinth + 2.55, dx + 1.9, v.y1 + 1.2, pl.plinth + 2.72, solid(shadeHex(fcol, -0.12), 0.7)));
	}
	if (c.exterior_steps || c.basement || c.accessible) {
		var ex0 = v.x0 + dp.x - 0.35, ex1 = ex0 + dp.w + 0.7, sm = pbr('slabs', { color: '#C9C2B6' }, { normal: 1 });
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
	if (st.porch) {
		var pc = st.porch, px0 = v.x0 + 0.3, px1 = v.x1 - 0.3, pd = 2.2, pz = pl.plinth + 2.7, rm = roofMat(c);
		this.add(box(px0, v.y1, 0, px1, v.y1 + pd, pl.plinth, pbr('deck', { color: '#A97B52' }, { normal: 1 })));
		for (var p = 0; p <= Math.floor((px1 - px0) / 2.6); p++) { var ppx = Math.min(px1 - 0.18, px0 + p * 2.6); this.add(box(ppx, v.y1 + pd - 0.18, pl.plinth, ppx + 0.16, v.y1 + pd - 0.02, pz, solid(pc, 0.6))); }
		this.add(polyMesh([X(px0 - 0.2, v.y1 + pd + 0.3, pz), X(px1 + 0.2, v.y1 + pd + 0.3, pz), X(px1 + 0.2, v.y1, pz + 0.75), X(px0 - 0.2, v.y1, pz + 0.75)], [rm, solid('#E6E2DA', 0.8)], { thick: 0.12 }));
	}
	if (c.balcony && pl.floors > 1) {
		var bz = pl.plinth + pl.FH, bx0 = v.x0 + (v.x1 - v.x0) * 0.5, bx1 = Math.min(v.x1 - 0.5, bx0 + 4.5);
		this.add(box(bx0, v.y1, bz - 0.22, bx1, v.y1 + 1.4, bz, solid('#D8D4CC', 0.8)));
		if (c.arch_style === 'alpine') {
			for (var bxx = bx0 + 0.05; bxx < bx1; bxx += 0.16) { this.add(box(bxx, v.y1 + 1.33, bz, bxx + 0.1, v.y1 + 1.4, bz + 1.0, pbr('wood', { color: '#9C6B44' }, { normal: 1 }))); }
		} else {
			var gr = cached('balglass', function () { return new THREE.MeshPhysicalMaterial({ color: '#BFD6DE', roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: 0.32, envMapIntensity: 1.5 }); });
			this.add(box(bx0, v.y1 + 1.36, bz, bx1, v.y1 + 1.4, bz + 1.0, gr, { noCast: true }));
			this.add(box(bx0, v.y1 + 1.34, bz + 1.0, bx1, v.y1 + 1.42, bz + 1.05, solid('#5A6066', 0.4, 0.7)));
		}
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
	var W = pl.W, D = pl.D, maxX = Math.max.apply(null, vols.map(function (v) { return v.x1; }));
	var gf = c.garden_features || [];
	var ta = clamp(num(c.terrace_area, 0), 0, 200);
	this.ta = ta;
	if (ta > 0) {
		var td = clamp(ta / 6, 2.4, 5), tw = clamp(ta / td, 3, W), tx0 = clamp(W * 0.62, 0, Math.max(0, W - tw)), ty1 = mainV.y1 + td;
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
			this.car(gx0 + gW / 2, gy1 - 2.6);
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
	if (has(en, 'heat_pump')) {
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
	if (kitchen) { this.add(box(x, y, z, x + 2.2, y + 0.7, z + 0.9, pbr('concrete', { color: '#8E8B86' }, { normal: 1 }))); this.add(box(x - 0.02, y - 0.02, z + 0.9, x + 2.22, y + 0.72, z + 0.95, solid('#2B2E31', 0.3, 0.2))); return; }
	this.add(box(x, y, z + 0.7, x + 1.6, y + 0.9, z + 0.75, wm));
	[[x + 0.1, y + 0.1], [x + 1.45, y + 0.1], [x + 0.1, y + 0.75], [x + 1.45, y + 0.75]].forEach(function (q) { this.add(box(q[0], q[1], z, q[0] + 0.06, q[1] + 0.06, z + 0.7, wm)); }, this);
	this.add(box(x - 0.2, y + 1.2, z, x + 1.8, y + 2.0, z + 0.4, cush));
	this.add(box(x - 0.2, y + 1.85, z, x + 1.8, y + 2.0, z + 0.8, cush));
};
House.prototype.car = function (cx, cy) {
	var paint = cached('carpaint', function () { return new THREE.MeshPhysicalMaterial({ color: '#3C4148', metalness: 0.65, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.04 }); });
	var dark = cached('cartrim', function () { return new THREE.MeshPhysicalMaterial({ color: '#0E1216', metalness: 0.4, roughness: 0.08, clearcoat: 1, envMapIntensity: 1.6 }); });
	var tyre = solid('#161616', 0.85), rim = solid('#B9BDC1', 0.25, 0.9), g = new THREE.Group();
	// side profile (x = length, y = height), extruded across the width with rounded edges
	var body = new THREE.Shape();
	body.moveTo(-2.2, 0.32); body.lineTo(2.15, 0.32); body.quadraticCurveTo(2.3, 0.35, 2.28, 0.62); body.quadraticCurveTo(2.25, 0.86, 1.6, 0.92);
	body.lineTo(0.75, 0.98); body.quadraticCurveTo(0.35, 1.42, -0.2, 1.44); body.lineTo(-1.25, 1.42); body.quadraticCurveTo(-1.95, 1.38, -2.12, 1.0); body.quadraticCurveTo(-2.3, 0.7, -2.2, 0.32);
	var bg = new THREE.ExtrudeGeometry(body, { depth: 1.62, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 4, curveSegments: 12 });
	bg.translate(0, 0, -0.81);
	var bm = new THREE.Mesh(bg, paint); bm.castShadow = true; bm.receiveShadow = true; g.add(bm);
	var gl = new THREE.Shape();
	gl.moveTo(0.62, 1.0); gl.quadraticCurveTo(0.3, 1.36, -0.2, 1.37); gl.lineTo(-1.2, 1.36); gl.quadraticCurveTo(-1.75, 1.32, -1.95, 1.02); gl.lineTo(0.62, 1.0);
	var gg = new THREE.ExtrudeGeometry(gl, { depth: 1.66, bevelEnabled: false, curveSegments: 10 }); gg.translate(0, 0, -0.83);
	g.add(new THREE.Mesh(gg, dark));
	[[1.4, 0.82], [1.4, -0.82], [-1.35, 0.82], [-1.35, -0.82]].forEach(function (q) {
		var t = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 28), tyre); t.rotation.x = Math.PI / 2; t.position.set(q[0], 0.34, q[1]); t.castShadow = true; g.add(t);
		var rr = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.25, 20), rim); rr.rotation.x = Math.PI / 2; rr.position.set(q[0], 0.34, q[1]); g.add(rr);
	});
	g.rotation.y = Math.PI / 2; // nose towards the street (+z)
	g.position.copy(X(cx, cy, 0));
	this.add(g);
};

/* ------------------------------------------------------------------ site: plot, paths, garden, fence */
House.prototype.site = function () {
	var c = this.c, pl = this.pl, vols = this.vols, mainV = vols[0], self = this, season = c.season || 'summer';
	var W = pl.W, D = pl.D, maxY = Math.max.apply(null, vols.map(function (v) { return v.y1; })), maxX = Math.max.apply(null, vols.map(function (v) { return v.x1; }));
	var garage = c.garage || 'none', gf = c.garden_features || [], gs = c.garden_style || 'natural';
	var front = maxY + 6.5, back = -6, left = -6.5, right = (this.garage ? this.garage.x1 : maxX) + 6;
	var pw = num(c.plot_width, 0), plen = num(c.plot_length, 0), plot = null;
	if (pw > 0 && pw <= 60) {
		plot = { x0: W / 2 - pw / 2, x1: W / 2 + pw / 2, yF: maxY + 5, yB: plen > 0 && plen < maxY + 20 ? maxY + 5 - plen : null };
		left = Math.min(left, plot.x0 - 1.2); right = Math.max(right, plot.x1 + 1.2); front = Math.max(front, plot.yF + 1.2);
		if (plot.yB !== null) { back = Math.min(back, plot.yB - 1.2); }
	}
	this.plotBox = { left: left, right: right, front: front, back: back };
	var flat = function (x0, y0, x1, y1, z, mat) { var m = box(x0, y0, z - 0.02, x1, y1, z, mat, { noCast: true }); self.add(m, false); return m; };
	// lawn of the plot (slightly raised over the surrounding meadow)
	var lawn = has(gf, 'lawn') || !c.garden_features;
	flat(left, back, right, front, 0.01, groundKind(c, lawn ? 'grass' : 'meadow'));
	if (plot) {
		var lm = solid('#EDEDE8', 0.8), yB = plot.yB !== null ? plot.yB : back + 0.4;
		flat(plot.x0 - 0.05, yB, plot.x0 + 0.05, plot.yF, 0.03, lm); flat(plot.x1 - 0.05, yB, plot.x1 + 0.05, plot.yF, 0.03, lm); flat(plot.x0, plot.yF - 0.05, plot.x1, plot.yF + 0.05, 0.03, lm);
		if (plot.yB !== null) { flat(plot.x0, yB - 0.05, plot.x1, yB + 0.05, 0.03, lm); }
	}
	var dpm = SK()._door(c, mainV.x1 - mainV.x0), doorMid = mainV.x0 + dpm.x + dpm.w / 2;
	if (has(gf, 'paths') || !c.garden_features) { flat(doorMid - 0.6, mainV.y1, doorMid + 0.6, front, 0.02, groundKind(c, 'slabs')); }
	var dk = { gravel: 'gravel', grass: 'grasspavers', asphalt: 'asphalt' }[c.driveway] || 'pavers';
	if (garage !== 'none') { flat(this.garage.x0, this.garage.y1, this.garage.x1, front, 0.02, groundKind(c, dk)); }
	else { flat(maxX + 0.8, D * 0.45, maxX + 3.8, front, 0.02, groundKind(c, dk)); }
	if (gs === 'minimal' || gs === 'mediterranean') { flat(left + 0.8, mainV.y1 + 0.8, Math.max(left + 1.8, doorMid - 1.4), front - 0.8, 0.012, groundKind(c, 'gravel')); }
	if (has(gf, 'pool')) {
		var px0 = left + 1.2, py0 = mainV.y1 + 1.5;
		flat(px0, py0, px0 + 3.4, py0 + 6.5, 0.06, groundKind(c, 'slabs'));
		var water = cached('water', function () { return new THREE.MeshPhysicalMaterial({ color: '#2D8FB0', roughness: 0.05, metalness: 0, clearcoat: 1, envMapIntensity: 1.6 }); });
		flat(px0 + 0.3, py0 + 0.3, px0 + 3.1, py0 + 6.2, 0.07, water);
	}
	if (has(gf, 'flowerbeds') && season !== 'winter') {
		flat(0.2, mainV.y1 + 1.0, Math.max(1.2, Math.min(3, doorMid - 1)), mainV.y1 + 1.8, 0.03, groundKind(c, 'soil'));
		for (var fb = 0; fb < 6; fb++) { this.plant('flower', 0.5 + fb * 0.42, mainV.y1 + 1.4, 0.5, fb); }
	}
	if (has(gf, 'playground') && season !== 'winter') { flat(right - 3.5, back + 3.5, right - 1, back + 6, 0.03, groundKind(c, 'sand')); }
	if (has(gf, 'shed')) { this.add(box(right - 3.4, back + 1.2, 0, right - 1.2, back + 3, 2.3, pbr('wood', { color: '#9A7048' }, { normal: 1 })), false); this.add(box(right - 3.5, back + 1.1, 2.3, right - 1.1, back + 3.1, 2.42, solid('#3A3D40', 0.6)), false); }
	if (has(gf, 'firepit')) {
		var fp = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.65, 0.35, 24), pbr('stone', { color: '#8D8576' }, { normal: 2 })); fp.position.copy(X(left + 3.5, mainV.y1 + 3.5, 0.17)); this.add(fp, false);
		var fire = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 12), solid('#FF8A30', 0.8, 0, { emissive: '#FF7A20', emissiveIntensity: this.night ? 4 : 1.5 })); fire.position.copy(X(left + 3.5, mainV.y1 + 3.5, 0.6)); this.add(fire, false);
	}
	if (this.ta <= 0 && (has(gf, 'pergola') || has(c.shading, 'pergola'))) {
		var pgx = left + 1.4, pgy = mainV.y1 + 2.2, pm = pbr('wood', { color: '#8A6A4C' }, { normal: 1 });
		[[pgx, pgy], [pgx + 2.8, pgy], [pgx, pgy + 2.4], [pgx + 2.8, pgy + 2.4]].forEach(function (q) { self.add(box(q[0], q[1], 0, q[0] + 0.14, q[1] + 0.14, 2.5, pm), false); });
		for (var pb = 0; pb < 3; pb += 0.45) { this.add(box(pgx + pb, pgy - 0.1, 2.5, pgx + pb + 0.08, pgy + 2.6, 2.62, pm), false); }
	}
	if (this.ta <= 0 && (has(gf, 'garden_furniture') || has(gf, 'outdoor_kitchen'))) { this.furniture(left + 2, mainV.y1 + 2.8, 0, has(gf, 'outdoor_kitchen')); }
	if (has(gf, 'garden_lights')) {
		[[doorMid - 1.2, front - 1.5], [doorMid + 1.2, front - 3.5], [left + 3, mainV.y1 + 2]].forEach(function (q) {
			self.add(box(q[0] - 0.06, q[1] - 0.06, 0, q[0] + 0.06, q[1] + 0.06, 0.6, solid('#2E3135', 0.4, 0.5)), false);
			self.add(box(q[0] - 0.07, q[1] - 0.07, 0.48, q[0] + 0.07, q[1] + 0.07, 0.56, self.night ? solid('#3A3020', 0.3, 0, { emissive: '#FFD9A0', emissiveIntensity: 4 }) : solid('#D8D8D2', 0.3)), false);
		});
	}
	// planting: trees by garden style, rows along the path, hedge
	var kinds = { natural: ['deciduous', 'deciduous', 'conifer', 'multistem', 'shrub'], formal: ['topiary', 'topiary', 'cypress', 'deciduous', 'topiary'], minimal: ['multistem', 'grass', 'grass', 'multistem', 'grass'], cottage: ['fruit', 'deciduous', 'shrub', 'fruit', 'shrub'], mediterranean: ['olive', 'cypress', 'cypress', 'olive', 'lavender'] }[gs] || ['deciduous'];
	if (has(gf, 'trees') || !c.garden_features) {
		[[left + 2.2, back + 2.5, 7.5], [right - 2.5, back + 3, 8], [left + 1.6, front - 2.2, 6], [right - 1.8, front - 1.6, 5.5], [doorMid - 2.2, mainV.y1 + 1.4, 1.1]].forEach(function (sp, i) {
			var k = kinds[i % kinds.length];
			var sz = k === 'grass' || k === 'lavender' || k === 'shrub' || k === 'topiary' ? (i === 4 ? 1.0 : 1.6) : sp[2];
			self.plant(k, sp[0], sp[1], sz, 11 + i * 7);
		});
	}
	var rowKind = { formal: 'topiary', mediterranean: 'lavender', cottage: 'shrub', minimal: 'grass', natural: 'shrub' }[gs] || 'shrub';
	if (gs !== 'natural' || has(gf, 'flowerbeds')) {
		var step = gs === 'formal' ? 1.3 : (gs === 'minimal' ? 1.8 : 0.95), ri = 0;
		for (var py = mainV.y1 + 1.6; py < front - 0.9; py += step) {
			[-1.15, 1.15].forEach(function (dx) { ri++; if (gs === 'natural' && (ri * 7919) % 10 < 4) { return; } self.plant(rowKind, doorMid + dx, py, gs === 'formal' ? 1.15 : (gs === 'minimal' ? 1.2 : 0.95), 101 + ri); });
		}
	}
	if (gs === 'mediterranean') { [[left + 1.2, mainV.y1 + 0.8], [left + 2.6, mainV.y1 + 0.8]].forEach(function (q, i) { self.plant('cypress', q[0], q[1], 4.5, 7 + i); }); }
	if (gs === 'formal') { [[left + 1.4, mainV.y1 + 1], [right - 1.4, mainV.y1 + 1]].forEach(function (q, i) { self.plant('cypress', q[0], q[1], 3.6, 9 + i); }); }
	if (has(gf, 'hedge')) {
		var hm = c.season === 'winter' ? pbr('snow', {}, { normal: 0.5 }) : pbr('hedge', { season: season }, { normal: 2.5 });
		this.add(box(left + 0.4, back + 0.2, 0, right - 0.4, back + 1.1, 1.5, hm), false);
	}
	// fence along the front with an optional gate
	var fence = c.fence || 'none';
	if (fence !== 'none') {
		var fz = { slats: 1.6, mesh: 1.4, masonry: 1.3, gabion: 1.2 }[fence], fx0 = left + 0.6, fx1 = right - 0.6, fy = front - 0.4, gx = doorMid - 0.6, gateOn = c.gate !== false;
		var fm = fence === 'slats' ? (c.arch_style === 'scandinavian' ? pbr('wood', { color: '#9C978E' }, { normal: 1 }) : solid('#3B3E42', 0.45, 0.5)) : null;
		var segs = gateOn ? [[fx0, gx], [gx + 1.2, fx1]] : [[fx0, fx1]];
		segs.forEach(function (sg) {
			if (fence === 'slats') {
				var n = Math.floor((sg[1] - sg[0]) / 0.16), geo = boxGeo(0.11, fz, 0.04), im = new THREE.InstancedMesh(geo, fm, n), mt = new THREE.Matrix4();
				for (var i = 0; i < n; i++) { mt.makeTranslation(sg[0] + i * 0.16 + 0.055, fz / 2, fy); im.setMatrixAt(i, mt); }
				im.castShadow = true; im.receiveShadow = true; self.add(im, false);
				self.add(box(sg[0], fy - 0.06, fz * 0.3, sg[1], fy - 0.02, fz * 0.3 + 0.06, fm), false);
			} else if (fence === 'mesh') {
				var meshM = cached('meshfence', function () { return new THREE.MeshStandardMaterial({ color: '#5B6B5A', roughness: 0.6, metalness: 0.4, transparent: true, opacity: 0.35 }); });
				self.add(box(sg[0], fy - 0.01, 0, sg[1], fy + 0.01, fz, meshM, { noCast: true }), false);
				for (var mx = sg[0]; mx <= sg[1]; mx += 2.5) { self.add(box(mx, fy - 0.03, 0, mx + 0.06, fy + 0.03, fz, solid('#4B5A4A', 0.5, 0.5)), false); }
			} else if (fence === 'masonry') {
				self.add(box(sg[0], fy - 0.15, 0, sg[1], fy + 0.15, fz, facadeMat(c, 'render')), false);
				self.add(box(sg[0] - 0.03, fy - 0.18, fz, sg[1] + 0.03, fy + 0.18, fz + 0.05, solid('#6E7378', 0.4, 0.6)), false);
			} else {
				self.add(box(sg[0], fy - 0.25, 0, sg[1], fy + 0.25, fz, pbr('stone', { color: '#9C978E' }, { normal: 2.5 })), false);
			}
		});
		if (gateOn) {
			var gm = solid('#2E3135', 0.4, 0.6);
			self.add(box(gx - 0.12, fy - 0.06, 0, gx, fy + 0.06, fz + 0.1, gm), false);
			self.add(box(gx + 1.2, fy - 0.06, 0, gx + 1.32, fy + 0.06, fz + 0.1, gm), false);
			for (var gb = gx + 0.08; gb < gx + 1.15; gb += 0.15) { self.add(box(gb, fy - 0.015, 0.05, gb + 0.03, fy + 0.015, fz - 0.07, gm), false); }
			self.add(box(gx, fy - 0.03, fz - 0.1, gx + 1.2, fy + 0.03, fz - 0.04, gm), false);
			self.add(box(gx, fy - 0.03, 0.05, gx + 1.2, fy + 0.03, 0.11, gm), false);
		}
	}
	if (c.neighbors) {
		[[left - 9, back + 2], [right + 2, back + 3]].forEach(function (q) {
			var nm = solid('#D8D3CB', 0.9), nr = solid('#8C5A48', 0.8);
			self.add(box(q[0], q[1] - 7, 0, q[0] + 8, q[1], 5.6, nm), false);
			self.add(polyMesh([X(q[0] - 0.4, q[1] + 0.4, 5.6), X(q[0] + 8.4, q[1] + 0.4, 5.6), X(q[0] + 8.4, q[1] - 3.5, 8.6), X(q[0] - 0.4, q[1] - 3.5, 8.6)], [nr, nr], { thick: 0.15 }), false);
			self.add(polyMesh([X(q[0] + 8.4, q[1] - 7.4, 5.6), X(q[0] - 0.4, q[1] - 7.4, 5.6), X(q[0] - 0.4, q[1] - 3.5, 8.6), X(q[0] + 8.4, q[1] - 3.5, 8.6)], [nr, nr], { thick: 0.15 }), false);
		});
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
Env.prototype.apply = function (scene, c) {
	var key = [c.time_of_day, c.weather, c.orientation].join('|');
	if (key === this.key) { return; }
	this.key = key;
	var sd = sunDir(c);
	if (c.time_of_day !== 'night') {
		var t = TOD[c.time_of_day] || TOD.golden, orient = { south: 0, south_west: 25, south_east: -25, west: 50, east: -50, north: 90 }[c.orientation] || 0;
		var az = (t.az + orient * 0.5) * D2R, el = t.el * D2R;
		sd = X(Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el)).normalize();
	}
	if (this.bg) { this.bg.dispose(); }
	if (this.envRT) { this.envRT.dispose(); }
	this.bg = skyTexture(c, sd);
	this.envRT = this.pmrem.fromEquirectangular(this.bg);
	scene.background = this.bg;
	scene.environment = this.envRT.texture;
};

function Viewer(opts) {
	opts = opts || {};
	this.o = opts;
	this.thumb = !!opts.thumb;
	var coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
	this.quality = opts.quality || (this.thumb ? 'thumb' : (coarse ? 'medium' : 'high'));
	var r = this.renderer = new THREE.WebGLRenderer({ antialias: this.quality !== 'high', alpha: false, preserveDrawingBuffer: !!this.thumb, powerPreference: 'high-performance' });
	r.setPixelRatio(this.thumb ? 1 : Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 2 : 1.5));
	r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
	r.toneMapping = THREE.NeutralToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
	setAnisotropy(Math.min(8, r.capabilities.getMaxAnisotropy()));
	this.scene = new THREE.Scene();
	this.camera = new THREE.PerspectiveCamera(40, 1.5, 0.3, 3000);
	this.env = new Env(r);
	this.sun = new THREE.DirectionalLight('#ffffff', 3); this.sun.castShadow = true;
	var ms = this.quality === 'high' ? 4096 : (this.quality === 'medium' ? 2048 : 1536);
	this.sun.shadow.mapSize.set(ms, ms); this.sun.shadow.bias = -0.0003; this.sun.shadow.normalBias = 0.03; this.sun.shadow.radius = 3;
	this.scene.add(this.sun); this.scene.add(this.sun.target);
	this.hemi = new THREE.HemisphereLight('#CFE3F7', '#5B6B45', 0.5); this.scene.add(this.hemi);
	// surrounding meadow
	var gg = new THREE.PlaneGeometry(900, 900, 150, 150), uv = gg.attributes.uv, cols = [], gp = gg.attributes.position;
	for (var i = 0; i < uv.count; i++) {
		uv.setXY(i, uv.getX(i) * 900, uv.getY(i) * 900);
		var x = gp.getX(i), y = gp.getY(i), n = 0.5 + 0.25 * Math.sin(x * 0.11 + Math.sin(y * 0.07) * 2) + 0.2 * Math.sin(y * 0.13 + Math.cos(x * 0.05) * 3) + 0.1 * Math.sin((x + y) * 0.31);
		var k = 0.78 + n * 0.32; cols.push(k * (0.97 + n * 0.06), k, k * (0.95 - n * 0.05));
	}
	gg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
	this.ground = new THREE.Mesh(gg, solid('#7A8F55', 1)); this.ground.rotation.x = -Math.PI / 2; this.ground.receiveShadow = true; this.scene.add(this.ground);
	this.treeline = new THREE.Group(); this.scene.add(this.treeline);
	this.house = null; this.camKey = ''; this.dirty = true;
	this.el = r.domElement; this.el.className = 'agh-3d-canvas';
	if (!this.thumb) {
		this.controls = new OrbitControls(this.camera, this.el);
		this.controls.enableDamping = true; this.controls.dampingFactor = 0.08; this.controls.enablePan = false;
		this.controls.maxPolarAngle = 88 * D2R; this.controls.minPolarAngle = 15 * D2R;
		var self = this;
		this.controls.addEventListener('change', function () { self.requestRender(); });
		this.controls.addEventListener('start', function () { self.interacting = true; self.loop(); });
		this.controls.addEventListener('end', function () { self.interacting = false; self.settle = performance.now() + 900; self.loop(); });
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
Viewer.prototype.setSize = function (w, h) {
	w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
	if (this.w === w && this.h === h) { return; }
	this.w = w; this.h = h;
	this.renderer.setSize(w, h, !this.thumb);
	if (this.composer) { this.composer.setSize(w, h); }
	this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
	this.fitCamera(true);
	this.requestRender();
};
Viewer.prototype.update = function (cfg, mode) {
	var c = cfg || {};
	this.c = c;
	var night = c.time_of_day === 'night', t = TOD[c.time_of_day] || TOD.golden, overcast = c.weather === 'overcast';
	this.env.apply(this.scene, c);
	this.renderer.toneMappingExposure = t.exp * (overcast ? 1.15 : 1);
	var sd = sunDir(c);
	this.sunDir = sd;
	this.sun.color.set(t.sun); this.sun.intensity = overcast ? t.si * 0.25 : t.si;
	this.sun.castShadow = !(overcast && !night);
	this.hemi.intensity = night ? 0.45 : (overcast ? 0.8 : (c.time_of_day === 'blue' ? 0.4 : 0.2));
	this.hemi.color.set(night ? '#5A6A9A' : '#CFE3F7');
	this.scene.environmentIntensity = night ? 1.2 : (c.time_of_day === 'blue' ? 1.2 : (overcast ? 1.6 : 0.9));
	this.ground.material = groundVC(c);
	var hz = overcast ? (night ? '#151A26' : (c.time_of_day === 'blue' ? '#5C6175' : '#C9CDD2')) : (SKYCOL[c.time_of_day] || SKYCOL.golden).hor;
	this.scene.fog = new THREE.FogExp2(hz, overcast ? 0.0075 : 0.0045);
	// rebuild the house
	if (this.house) { this.scene.remove(this.house.root); disposeTree(this.house.root); }
	if (mode === 'facade') { this.house = facadeScene(c); }
	else if (mode === 'floor') { this.house = floorScene(c); }
	else { this.house = new House(c, { mini: this.o.mini || mode === 'mini' }).build(); }
	this.scene.add(this.house.root);
	this.treelineFor(c);
	var key = [c.camera, c.lens, mode].join('|');
	this.fitCamera(key !== this.camKey);
	this.camKey = key;
	this.requestRender();
};
// A ring of distant trees and hedgerows: depth and a horizon instead of an endless lawn.
Viewer.prototype.treelineFor = function (c) {
	var key = (c.season || 'summer') + (this.thumb ? 't' : '');
	if (this.treelineKey === key) { return; }
	this.treelineKey = key;
	while (this.treeline.children.length) { this.treeline.remove(this.treeline.children[0]); }
	var s = 77; function r() { s = (s * 16807) % 2147483647; return s / 2147483647; }
	var n = this.thumb ? 160 : 360, winter = c.season === 'winter';
	var crowns = new THREE.InstancedMesh(canopyGeo('sphere', 110, 3), leafMat(c, 'broad', false), n);
	var trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 1, 6), solid('#4A3B2E', 1), n);
	var m = new THREE.Matrix4(), q = new THREE.Quaternion();
	for (var i = 0; i < n; i++) {
		// forest edge behind and beside the plot; the street side stays open
		var a = Math.PI + (r() - 0.5) * Math.PI * 1.45, d = 105 + r() * 70 + Math.pow(r(), 3) * 60, hgt = 8 + r() * 9;
		var x = Math.cos(a) * d * 1.35, z = Math.sin(a) * d, sx = hgt * (0.32 + r() * 0.16);
		m.compose(new THREE.Vector3(x, hgt * 0.62, z), q, new THREE.Vector3(sx, hgt * 0.38, sx)); crowns.setMatrixAt(i, m);
		m.compose(new THREE.Vector3(x, hgt * 0.3, z), q, new THREE.Vector3(1, hgt * 0.6, 1)); trunks.setMatrixAt(i, m);
	}
	crowns.visible = !winter;
	this.treeline.add(crowns); this.treeline.add(trunks);
};
Viewer.prototype.fitCamera = function (reset) {
	if (!this.house) { return; }
	var c = this.c || {}, box3 = new THREE.Box3().setFromObject(this.house.fit), sph = box3.getBoundingSphere(new THREE.Sphere());
	var lens = { '24mm': 24, '35mm': 35, '50mm': 50 }[c.lens || '35mm'] || 35;
	var vfov = 2 * Math.atan(12 / lens) / D2R;
	if (this.thumb) { vfov = Math.min(vfov, 38); }
	this.camera.fov = vfov; this.camera.updateProjectionMatrix();
	var aspect = this.camera.aspect || 1.5, hfov = 2 * Math.atan(Math.tan(vfov * D2R / 2) * aspect);
	var dist = sph.radius / Math.sin(Math.min(vfov * D2R, hfov) / 2) * (this.thumb ? 0.68 : 0.8);
	var preset = { three_quarter: [36, 14], frontal: [4, 8], low: [30, 4], elevated: [40, 38] }[c.camera || 'three_quarter'];
	var target = sph.center.clone(); target.y = Math.max(1.2, sph.center.y * 0.75);
	// sun shadow frustum around the house
	var R = sph.radius + 14;
	var sc = this.sun.shadow.camera; sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 1; sc.far = R * 4; sc.updateProjectionMatrix();
	this.sun.position.copy(sph.center).addScaledVector(this.sunDir || new THREE.Vector3(0.5, 1, 0.5), R * 1.8);
	this.sun.target.position.copy(sph.center);
	if (!reset && this.controls && this.lastR) {
		// keep the visitor's orbit, follow the new size
		var off = this.camera.position.clone().sub(this.controls.target).multiplyScalar(sph.radius / this.lastR);
		this.controls.target.copy(target); this.camera.position.copy(target).add(off);
	} else {
		var az = preset[0] * D2R, el = preset[1] * D2R;
		var dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
		this.camera.position.copy(target).addScaledVector(dir, dist);
		if (c.camera === 'low') { this.camera.position.y = 1.4; }
		this.camera.lookAt(target);
		if (this.controls) { this.controls.target.copy(target); this.controls.minDistance = sph.radius * 0.5; this.controls.maxDistance = sph.radius * 4; }
	}
	this.lastR = sph.radius;
	if (this.controls) { this.controls.update(); }
};
Viewer.prototype.requestRender = function () {
	var self = this;
	if (this.thumb) { this.render(); return; }
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
		if (self.interacting || performance.now() < (self.settle || 0)) { requestAnimationFrame(tick); } else { self.looping = false; }
	})();
};
Viewer.prototype.render = function () {
	if (!this.w || this.disposed) { return; }
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
function disposeTree(root) { root.traverse(function (o) { if (o.geometry && !o.geometry.userData.shared && !isShared(o.geometry)) { o.geometry.dispose(); } }); }
function isShared(g) { for (var k in FOLIAGE) { if (FOLIAGE[k] === g) { return true; } } return false; }

/* ------------------------------------------------------------------ close-up scenes for option cards */
function facadeScene(c) {
	var hs = new House(c, { mini: true }); hs.pl = SK().plan(c);
	var g = new THREE.Group(), T = 0.3, m = facadeMat(c, c.facade_main);
	var s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(3.2, 0); s.lineTo(3.2, 2.2); s.lineTo(0, 2.2); s.lineTo(0, 0);
	var hp = new THREE.Path(); hp.moveTo(1.7, 0.45); hp.lineTo(2.75, 0.45); hp.lineTo(2.75, 1.85); hp.lineTo(1.7, 1.85); hp.lineTo(1.7, 0.45); s.holes.push(hp);
	var w = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false }), m); w.castShadow = true; w.receiveShadow = true; g.add(w);
	hs.opening(g, { kind: 'win', x: 1.7, y: 0.45, w: 1.05, h: 1.4 }, T, {});
	hs.fit.add(g);
	g.position.set(-1.6, 0.0, 0);
	return hs;
}
function floorScene(c) {
	var hs = new House(c, { mini: true });
	var fl = { parquet: ['wood', '#B7865A'], herringbone: ['wood', '#B07D52'], laminate: ['wood', '#C9A47A'], vinyl: ['wood', '#A79B8C'], tiles_large: ['slabs', '#D7D3CC'], stone: ['stone', '#CFC3AE'], microcement: ['render', '#BDB7AE'], concrete: ['concrete', '#9E9B96'] }[c.floor_main] || ['wood', '#B7865A'];
	var fm = pbr(fl[0], fl[0] === 'render' ? { color: fl[1], texture: 'smooth' } : { color: fl[1] }, { normal: 1, roughness: fl[0] === 'wood' ? 0.8 : 1 });
	var floor = box(-2, -2, -0.05, 2, 2, 0, fm); floor.rotation.y = c.floor_main === 'herringbone' ? Math.PI / 4 : 0;
	hs.add(floor); hs.add(box(-2, -2.1, 0, 2, -2, 2.4, solid('#EEEAE3', 0.9))); hs.add(box(-2.1, -2, 0, -2, 2, 2.4, solid('#E6E1D9', 0.9)));
	hs.add(box(-2, -1.99, 0, 2, -1.97, 0.08, solid('#FFFFFF', 0.6)));
	return hs;
}

/* ------------------------------------------------------------------ public API */
var shared = null;
function sharedThumb() {
	if (!shared) { shared = new Viewer({ thumb: true, quality: 'thumb' }); }
	return shared;
}
// Renders one configuration into an image (option cards). Queued so the UI stays responsive.
var queue = Promise.resolve();
function thumb(cfg, w, h, mode) {
	queue = queue.then(function () {
		return new Promise(function (res) {
			var go = function () {
				try {
					var v = sharedThumb();
					v.setSize(w, h);
					v.update(cfg, mode || 'mini');
					v.render();
					res(v.el.toDataURL('image/jpeg', 0.86));
				} catch (e) { res(''); }
			};
			if (window.requestIdleCallback) { window.requestIdleCallback(go, { timeout: 200 }); } else { setTimeout(go, 0); }
		});
	});
	return queue;
}
function supported() {
	try { var cv = document.createElement('canvas'); return !!(window.WebGL2RenderingContext && cv.getContext('webgl2')); } catch (e) { return false; }
}
// One live viewer: its canvas is moved into whichever preview box is current (designer or wizard).
var live = null, ro = null;
function attach(container, cfg, opts) {
	if (!live) {
		live = new Viewer(opts || {});
		live.wrap = document.createElement('div'); live.wrap.className = 'agh-3d';
		live.wrap.appendChild(live.el);
		if (window.ResizeObserver) { ro = new ResizeObserver(function () { var r = live.wrap.getBoundingClientRect(); if (r.width > 0) { live.setSize(r.width, r.height); } }); ro.observe(live.wrap); }
	}
	if (live.wrap.parentNode !== container) { container.insertBefore(live.wrap, container.firstChild); }
	var r = live.wrap.getBoundingClientRect();
	if (r.width > 0) { live.setSize(r.width, r.height); }
	live.update(cfg);
	return live;
}
var api = { attach: attach, thumb: thumb, supported: supported, viewer: function () { return live; }, version: 'r170-1' };
window.AGH_3D = api;
export default api;
