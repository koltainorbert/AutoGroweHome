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
// 1.26.0: quality levels (low … ultra, automatic) and the photographed skies shipped in assets/sky/
const QL = await import('./agh-3d-quality.js' + new URL(import.meta.url).search);
const SKY = await import('./agh-3d-sky.js' + new URL(import.meta.url).search);
SKY.setup(new URL(import.meta.url).search);

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
		if (!t.alpha && !t.noTile && (STOCH[kind] || params.grime)) {
			// the surface detail comes after the first picture (detailFlags): that picture keeps the shader
			// programs of 1.24.0 and is not delayed by new ones
			m.userData.surf = [!!STOCH[kind], !!params.grime];
			if (DETAIL_ON) { surfaceDetail(m, !!STOCH[kind], !!params.grime); m.userData.surfOn = 1; }
		}
		return m;
	});
}
/* 1.26.0 – staged detail. Until the live preview has drawn its first picture, the scene is the one of
 * 1.24.0 (same materials, same woods); the new detail – grass, undergrowth, the detailed far trees and
 * the shader surface detail – is switched on right after it (Viewer.upgrade), its shaders compiled in the
 * background while the first picture stays. Guide pictures and option cards wait for it (detailReady). */
var DETAIL_ON = false;
function detailFlags() {
	if (DETAIL_ON) { return; }
	DETAIL_ON = true;
	LAND.setDetail(true);
	Object.keys(MATS).forEach(function (k) { var m = MATS[k], s = m.userData.surf; if (s && !m.userData.surfOn) { surfaceDetail(m, s[0], s[1]); m.userData.surfOn = 1; m.needsUpdate = true; } });
}
// The stochastic tiling costs about a seventh of a frame (measured on SwiftShader): only on high/ultra,
// and there it is compiled in; on low/medium the shader is built without it.
var SURF_STOCH = true;
function setSurfStoch(on) {
	if (SURF_STOCH === !!on) { return; }
	SURF_STOCH = !!on;
	Object.keys(MATS).forEach(function (k) { var m = MATS[k], s = m.userData.surf; if (s && s[0] && m.userData.surfOn) { m.needsUpdate = true; } });
}
/* 1.26.0 – surface detail in the shader, no extra textures:
 * - stochastic tiling (isotropic patterns: render, stone, gravel, lawn, soil …): every fragment picks two
 *   hashed variants of the tile – shifted and turned by a quarter – along a smooth noise and blends them,
 *   so a large wall or lawn shows no repeating pattern. The normals are turned back with the sample.
 * - on facades: a slow, faint variation of the tone over the wall and a little dirt splashed up on the
 *   plinth (world height under ~0.6 m).
 * Both follow the quality profile through shared uniforms (no shader recompiles when the level changes). */
var STOCH = { render: 1, stone: 1, gravel: 1, grass: 1, snow: 1, soil: 1, asphalt: 1, sand: 1, green: 1, hedge: 1 };
var SHQ = { aghStoch: { value: 1 }, aghDetail: { value: 1 } };
var AGH_FRAG = [
	'uniform float aghStoch;', 'uniform float aghDetail;', 'varying vec3 vAghW;',
	'float aghH1( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }',
	'float aghVN( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );',
	'	return mix( mix( aghH1( i ), aghH1( i + vec2( 1.0, 0.0 ) ), f.x ), mix( aghH1( i + vec2( 0.0, 1.0 ) ), aghH1( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }',
	'struct AghV { vec2 oa; vec2 ob; mat2 ra; mat2 rb; float w; };',
	'mat2 aghRot( float i ) { float k = floor( aghH1( vec2( i, 7.31 ) ) * 4.0 );',
	'	return k < 1.0 ? mat2( 1.0, 0.0, 0.0, 1.0 ) : ( k < 2.0 ? mat2( 0.0, 1.0, -1.0, 0.0 ) : ( k < 3.0 ? mat2( -1.0, 0.0, 0.0, -1.0 ) : mat2( 0.0, -1.0, 1.0, 0.0 ) ) ); }',
	'AghV aghVar( vec2 uv ) { AghV v; float l = aghVN( uv * 0.37 ) * 6.0, ia = floor( l );',
	'	v.oa = vec2( aghH1( vec2( ia, 1.3 ) ), aghH1( vec2( ia, 2.7 ) ) ); v.ob = vec2( aghH1( vec2( ia + 1.0, 1.3 ) ), aghH1( vec2( ia + 1.0, 2.7 ) ) );',
	'	v.ra = aghRot( ia ); v.rb = aghRot( ia + 1.0 ); v.w = smoothstep( 0.25, 0.75, fract( l ) ); return v; }',
	'vec4 aghTex( sampler2D t, vec2 uv, AghV v ) {',
	'#ifdef AGH_STOCH',
	'	if ( aghStoch > 0.5 ) { vec2 dx = dFdx( uv ), dy = dFdy( uv );',
	'		vec4 a = textureGrad( t, v.ra * uv + v.oa, v.ra * dx, v.ra * dy ), b = textureGrad( t, v.rb * uv + v.ob, v.rb * dx, v.rb * dy );',
	'		return mix( a, b, v.w ); }',
	'#endif',
	'	return texture2D( t, uv ); }',
	'vec3 aghNrm( sampler2D t, vec2 uv, AghV v ) {',
	'#ifdef AGH_STOCH',
	'	if ( aghStoch > 0.5 ) { vec2 dx = dFdx( uv ), dy = dFdy( uv );',
	'		vec3 a = textureGrad( t, v.ra * uv + v.oa, v.ra * dx, v.ra * dy ).xyz * 2.0 - 1.0, b = textureGrad( t, v.rb * uv + v.ob, v.rb * dx, v.rb * dy ).xyz * 2.0 - 1.0;',
	'		a.xy = transpose( v.ra ) * a.xy; b.xy = transpose( v.rb ) * b.xy; return normalize( mix( a, b, v.w ) ); }',
	'#endif',
	'	return texture2D( t, uv ).xyz * 2.0 - 1.0; }',
	'vec3 aghTone() {',
	'#ifdef AGH_GRIME',
	'	float n = aghVN( vec2( vAghW.x + vAghW.z, vAghW.y ) * 0.35 ), n2 = aghVN( vec2( vAghW.x - vAghW.z, vAghW.y ) * 3.1 );',
	'	float g = 1.0 - smoothstep( 0.04, 0.5 + 0.22 * n2, vAghW.y );',
	'	return mix( vec3( 1.0 + ( n - 0.5 ) * 0.09 * aghDetail ), vec3( 0.8, 0.76, 0.7 ), g * 0.55 * aghDetail );',
	'#else',
	'	return vec3( 1.0 );',
	'#endif',
	'}'
].join('\n');
function surfaceDetail(m, stoch0, grime) {
	m.onBeforeCompile = function (sh) {
		var stoch = stoch0 && SURF_STOCH;
		sh.uniforms.aghStoch = SHQ.aghStoch; sh.uniforms.aghDetail = SHQ.aghDetail;
		sh.defines = sh.defines || {};
		if (stoch) { sh.defines.AGH_STOCH = ''; }
		if (grime) { sh.defines.AGH_GRIME = ''; }
		sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vAghW;').replace('#include <project_vertex>', [
			'#include <project_vertex>', 'vec4 aghWp = vec4( transformed, 1.0 );', '#ifdef USE_INSTANCING', 'aghWp = instanceMatrix * aghWp;', '#endif', 'vAghW = ( modelMatrix * aghWp ).xyz;'
		].join('\n'));
		sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + AGH_FRAG)
			.replace('#include <map_fragment>', [
				'AghV aghv = aghVar( vMapUv );',
				'vec4 sampledDiffuseColor = aghTex( map, vMapUv, aghv );',
				'diffuseColor *= sampledDiffuseColor;',
				'diffuseColor.rgb *= aghTone();'
			].join('\n'))
			.replace('#include <roughnessmap_fragment>', THREE.ShaderChunk.roughnessmap_fragment.replace('texture2D( roughnessMap, vRoughnessMapUv )', 'aghTex( roughnessMap, vRoughnessMapUv, aghv )'))
			.replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', 'vec3 mapN = aghNrm( normalMap, vNormalMapUv, aghv );'));
	};
	m.customProgramCacheKey = function () { return 'aghSurf' + (stoch0 && SURF_STOCH ? 's' : '') + (grime ? 'g' : ''); };
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
	// 1.26.0: walls get the faint tone variation and the plinth dirt of surfaceDetail() (grime)
	var fpbr = function (kind, opts, params) { return pbr(kind, opts, Object.assign({ grime: 1 }, params)); };
	switch (m) {
		case 'brick': return fpbr('brick', { color: base }, { normal: 1.6 });
		case 'clinker': return fpbr('brick', { color: base, kind: 'clinker', mortar: '#3B302B' }, { normal: 1.4 });
		case 'stone': return fpbr('stone', { color: base }, { normal: 2 });
		case 'wood': return fpbr('wood', { color: base }, { normal: 1.2 });
		case 'metal': return fpbr('seam', { color: base }, { metalness: 0.55, roughness: 1, normal: 1 });
		case 'concrete': return fpbr('concrete', { color: base }, { normal: 1 });
		case 'panel': return fpbr('panel', { color: base }, { normal: 1 });
		case 'render_dark': return fpbr('render', { color: base, texture: 'fine' }, { normal: 0.6 });
		case 'wood_horizontal': return fpbr('woodh', { color: base }, { normal: 1.4 });
		case 'board_batten': return fpbr('batten', { color: base }, { normal: 1.2 });
		case 'charred_wood': return fpbr('charred', { color: base }, { normal: 1.8 });
		case 'limestone': return fpbr('limestone', { color: base }, { normal: 0.9 });
		case 'brick_white': return fpbr('brick', { color: base, kind: 'lime', mortar: '#E4DFD6' }, { normal: 1.3 });
		case 'fiber_cement': return fpbr('fibercement', { color: base }, { normal: 0.8 });
		default: return fpbr('render', { color: col(c.facade_color, '#F2EFE9'), texture: c.facade_texture || 'fine' }, { normal: c.facade_texture === 'coarse' ? 1.2 : 0.6 });
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
	// build mode (agh-build.js): exactly the drawn openings of this face
	if (v.bOps) { return (v.bOps[F.name] || []).filter(function (o) { return o.x >= 0.02 && o.x + o.w <= len - 0.02; }).map(function (o) { return { kind: o.kind, x: o.x, y: o.y, w: o.w, h: o.h, fl: o.fl }; }); }
	var vk = v.vi || 0, K = SK();
	if (fp) {
		if (fp.door) { out.push({ kind: 'door', x: fp.door.x, y: pl.plinth, w: fp.door.w, h: fp.door.h, key: 'door@' + vk }); reserved.push([fp.door.x - 0.5, fp.door.x + fp.door.w + 0.5]); }
		if (fp.tdoor) { out.push({ kind: 'tdoor', x: fp.tdoor.x, y: pl.plinth, w: fp.tdoor.w, h: 2.35, key: 'tdoor@' + vk }); reserved.push([fp.tdoor.x - 0.4, fp.tdoor.x + fp.tdoor.w + 0.4]); }
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
			// a window moved by hand along its wall (1.18.0) keeps its place even beside a door
			var x = step * i + (step - w) / 2, wk = 'win@' + vk + ':' + F.name + ':' + fl + ':' + i, mx = K._openingAt(c, wk, x, w, len);
			if (mx === x && fl === 0 && reserved.some(function (r) { return x < r[1] && x + w > r[0]; })) { continue; }
			if (mx === x && blocked.some(function (r) { return x < r[1] && x + w > r[0]; })) { continue; }
			row.push({ x: mx, w: w, i: i, key: wk });
		}
		// behind a balcony the windows become doors (shared rule with the 2D sketch)
		if (fl > 0 && F.balc && F.balc.length) { SK()._balcMark(F.balc, F.name, fl, row); }
		for (var ri = 0; ri < row.length; ri++) {
			var o = row[ri];
			if (o.door) { out.push({ kind: 'bdoor', x: o.x, y: z0 + 0.02, w: o.w, h: Math.min(2.3, pl.FH - 0.45), fl: fl, french: !!o.french, key: o.key }); }
			else { out.push({ kind: 'win', x: o.x, y: z0 + sill, w: w, h: h, fl: fl, i: o.i, key: o.key }); }
		}
	}
	if (gabled && (pl.attic || rise > 2.2)) {
		var gw = Math.min(1.6, len * 0.22), gh = Math.min(1.3, rise - 0.9, rise * (1 - gw / len) - 0.55, gabled === 'half_hip' ? rise * 0.58 - 0.55 : 9);
		var gk = 'win@' + vk + ':' + F.name + ':0:g', gx = clamp(K._openingAt(c, gk, len / 2 - gw / 2, gw, len), len * 0.3 - gw / 2, len * 0.7 - gw / 2);
		if (gh > 0.4) { out.push({ kind: 'win', x: gx, y: v.h + 0.35, w: gw, h: gh, gable: true, key: gk }); }
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
	if (m && this.addTo) { this.addTo.add(m); return m; }
	if (m) { (fit === false ? this.root : this.fit).add(m); }
	return m;
};
/* A piece the visitor can pick up and move (1.18.0): built in its own group around its centre (plan cx, cy),
 * turned by `turn` degrees; the group is merged on its own and stays out of the big merge of the house, so
 * the drag moves and turns it as one. Option cards and small pictures build it straight into the house. */
House.prototype.mover = function (key, cx, cy, turn, build, info) {
	if (this.o.mini || this.o.noMove) { build(); return null; }
	var outer = new THREE.Group(), inner = new THREE.Group(), prev = this.addTo;
	this.addTo = inner;
	try { build(); } finally { this.addTo = prev; }
	if (!inner.children.length) { return null; }
	inner.position.set(-cx, 0, -cy);
	outer.position.set(cx, 0, cy);
	outer.rotation.y = (turn || 0) * D2R;
	outer.add(inner);
	outer.userData.slot = key;
	outer.userData.move = Object.assign({ kind: 'site', cx: cx, cy: cy, turn: turn || 0 }, info || {});
	if (!this.movers) { this.movers = new THREE.Group(); this.movers.name = 'movers'; this.root.add(this.movers); }
	this.movers.add(outer);
	return outer;
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
	var wallMat = v.glass ? glassMat(c, this.night) : ((v.wing || v.second || v.accent) && acc.length && !SK()._accentVol(c, v) ? accentMat(c, acc[0]) : facadeMat(c, c.facade_main));
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
		// where the accent material can be put (1.21.0): this face, in its own coordinates
		if (!v.glass) { g.userData.face = { vi: v.vi || 0, face: F.name, m: m, len: F.len, h: v.h, z0: z0, plinth: pl.plinth, FH: pl.FH, floors: pl.floors, top: top || null, door: F.name === 'front' && fp && fp.door ? { x: fp.door.x, w: fp.door.w, h: fp.door.h } : null, T: T }; }
		F.fp = F.name === 'front' ? fp : null;
		F.balc = BL;
		var ops = faceOpenings(c, v, pl, F, F.fp, rise, top && type !== 'shed' && type !== 'saw' ? type : false);
		F.ops = ops;
		// what a drag along the wall needs to know (1.18.0): the face, its length and its local → world matrix
		ops.forEach(function (o) { if (o.key && !v.bOps) { o.face = F.name; o.len = F.len; o.m = m; o.top = top; o.z0 = z0; o.fullH = type === 'shed' && F.name === (v.ridge !== 'y' ? 'back' : 'left') ? v.h + rise : v.h; } });
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
	// the zones marked by the visitor on this face (1.21.0) replace the automatic accent bays
	var ez = SK()._accentZones(c, v, F.name, { len: F.len, h: v.h, z0: v.z0 || 0, plinth: pl.plinth, FH: pl.FH, top: top, door: door ? { x: door.x, w: door.w, h: door.h } : null });
	if (ez) { ez.forEach(function (z) { proud(z.poly, accentMat(c, z.mat), opsIn(0, F.len)); }); acc = []; }
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
	og.userData.field = o.kind === 'door' ? 'entrance_door' : (o.kind === 'tdoor' ? 'terrace_door' : 'window_style');
	if (o.m) { og.userData.op = o; }
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
		// in its own group: the chimney can be picked up and moved on the roof (1.18.0)
		var cg = new THREE.Group(), prevA = self.addTo, prevT = self.tagNow;
		self.addTo = cg; self.tagNow = 'chimney';
		try { chimneyParts(zTop); } finally { self.addTo = prevA; self.tagNow = prevT; }
		var cs0 = SK()._chimney(c), ca0 = SK()._chimneyAt(c, v);
		cg.userData.field = 'chimney';
		cg.userData.op = { key: 'chimney', kind: 'chimney', x: ca0.x, y: ca0.y, w: cs0.w, d: cs0.d, vx0: v.x0, vx1: v.x1, vy0: v.y0, vy1: v.y1, ridge: v.ridge, type: type, top: zTop - 1.0 + cs0.up };
		self.add(cg);
	}
	function chimneyParts(zTop) {
		var cs = SK()._chimney(c), ca = SK()._chimneyAt(c, v), cx = ca.x, cy = ca.y, zt = zTop - 1.0 + cs.up;
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
			// under the eave (1.16.0: on a single storey the beams ran into the roof overhang): the
			// pergola stays below the underside of the eave; where that leaves too little headroom it
			// starts outside the overhang instead
			var pez = c.roof_type === 'flat' ? mainV.h : mainV.h - (pl.eave || 0) * Math.tan((pl.pitch || 0) * D2R) - 0.05;
			var ph = Math.min(pl.plinth + 2.6, pez - 0.4), pby = mainV.y1;
			if (ph < pl.plinth + 2.25) { ph = pl.plinth + 2.6; pby = mainV.y1 + (pl.eave || 0) + 0.1; }
			var pcol = c.arch_style === 'high_tech' || c.arch_style === 'industrial' ? '#2E3135' : '#8A6A4C';
			var pm = pcol === '#2E3135' ? solid(pcol, 0.4, 0.6) : pbr('wood', { color: pcol }, { normal: 1 });
			[[tx0 + 0.1, ty1 - 0.2], [tx0 + tw - 0.25, ty1 - 0.2]].forEach(function (q) { self.add(box(q[0], q[1] - 0.15, 0.18, q[0] + 0.15, q[1], ph, pm)); });
			this.add(box(tx0, ty1 - 0.2, ph, tx0 + tw, ty1 - 0.04, ph + 0.18, pm));
			if (c.outdoor_covered) { this.add(box(tx0, pby, ph + 0.18, tx0 + tw, ty1, ph + 0.3, solid(shadeHex(col(c.facade_color, '#F2EFE9'), -0.1), 0.7))); }
			else { for (var bb = 0; bb < tw; bb += 0.55) { this.add(box(tx0 + bb, pby, ph + 0.18, tx0 + bb + 0.1, ty1, ph + 0.32, pm)); } }
		}
		if (has(gf, 'garden_furniture') || has(gf, 'outdoor_kitchen')) {
			// the terrace furniture can be picked up too (1.18.0): its own place, else beside the terrace door
			var tfo = SK()._site(c, 'tfurniture'), tfx = tfo ? tfo.x : tx0 + tw * 0.4 + 0.8, tfy = tfo ? tfo.y : mainV.y1 + td * 0.35 + 1.0, okit = has(gf, 'outdoor_kitchen');
			this.mover('tfurniture', tfx, tfy, tfo ? tfo.rot : 0, function () { self.furniture(tfx - 0.8, tfy - 1.0, tfx > tr.x0 && tfx < tr.x1 && tfy > tr.y0 && tfy < tr.y1 ? 0.18 : 0, okit); }, { kind: 'furniture', w: 2.0, d: 2.0, field: 'garden_features' });
		}
	}
	var garage = c.garage || 'none', GR = SK()._garageRect(c, vols, pl);
	if (GR) {
		var gx0 = GR.x0, gW = GR.w, gD = GR.d, gy1 = GR.y1, gy0 = GR.body0, gh = 2.9;
		this.garage = { x0: GR.x0, x1: GR.x1, y0: GR.y0, y1: GR.y1 };
		this.garageBase = GR.base;
		var acc = c.facade_accent || [], gm = GR.facade !== 'same' ? (GR.facade === 'render' ? facadeMat(c, 'render') : facadeMat(c, GR.facade)) : (acc.length ? accentMat(c, acc[0]) : facadeMat(c, c.facade_main));
		// the garage can be picked up and moved as a whole (1.22.0); the plan follows it, so it is rebuilt when let go
		var gcx = (GR.x0 + GR.x1) / 2, gcy = (GR.y0 + GR.y1) / 2;
		this.moverFit('garage', gcx, gcy, function () { self.garageBuild(GR, gm); }, { kind: 'garage', w: GR.w, d: GR.y1 - GR.y0, field: 'garage', rebuild: true, noTurn: true });
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
// The garage or carport (1.22.0): spaces and doors, door type and colour, wall material, roof form, a window
// and a side door, and the rooms behind it as a lower annex.
House.prototype.garageBuild = function (GR, gm) {
	var c = this.c, self = this, gx0 = GR.x0, gW = GR.w, gy1 = GR.y1, gy0 = GR.body0, gD = GR.d, gh = GR.h;
	var roofTop = GR.roof === 'green' || (GR.roof === 'flat' && c.roof_surface === 'green') ? pbr('green', {}, { normal: 2 }) : pbr('gravel', { color: '#A9A49B' }, { normal: 2 });
	if (GR.type === 'carport') {
		var cm = solid('#3A3D40', 0.45, 0.5);
		[[gx0, gy1], [gx0 + gW - 0.15, gy1], [gx0, gy0 + 0.15], [gx0 + gW - 0.15, gy0 + 0.15]].forEach(function (q) { self.add(box(q[0], q[1] - 0.15, 0, q[0] + 0.15, q[1], gh, cm)); });
		this.add(box(gx0 - 0.1, gy0, gh, gx0 + gW + 0.1, gy1 + 0.2, gh + 0.25, c.roof_surface === 'green' ? pbr('green', {}, { normal: 2 }) : solid('#5A5E62', 0.6, 0.3)));
		var pcar = SK()._vehicles(c).filter(function (k) { return k !== 'motorcycle' && k !== 'bicycle'; })[0];
		if (pcar && this.o.mini) { this.add(life(INT.vehicle(INT.mats(c), pcar, col(c.car_color, '#3C4148')), gx0 + gW / 2, gy1 - 2.975, Math.PI / 2)); }
		return;
	}
	var doors = GR.spaces, dw = GR.dw, dh = 2.25, dcol = col(c.garage_door_color, shadeHex(col(c.window_frame_color, '#2F3235'), 0.12));
	var s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(gW, 0); s.lineTo(gW, gh); s.lineTo(0, gh); s.lineTo(0, 0);
	for (var d = 0; d < doors; d++) { var gxx = d * (gW / doors) + (gW / doors - dw) / 2; var hp = new THREE.Path(); hp.moveTo(gxx, 0); hp.lineTo(gxx + dw, 0); hp.lineTo(gxx + dw, dh); hp.lineTo(gxx, dh); hp.lineTo(gxx, 0); s.holes.push(hp); }
	var fw = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false }), gm); fw.position.copy(X(gx0, gy1 - 0.3, 0)); fw.castShadow = true; fw.receiveShadow = true;
	this.add(fw);
	// side walls and back; the right side gets the side door and the window
	this.add(box(gx0, gy0, 0, gx0 + 0.3, gy1 - 0.3, gh, gm));
	this.add(box(gx0, gy0, 0, gx0 + gW, gy0 + 0.3, gh, gm));
	var rs = new THREE.Shape(), sl = gD - 0.6; rs.moveTo(0, 0); rs.lineTo(sl, 0); rs.lineTo(sl, gh); rs.lineTo(0, gh); rs.lineTo(0, 0);
	if (GR.sideDoor) { var sd = new THREE.Path(); sd.moveTo(sl - 1.9, 0); sd.lineTo(sl - 1.0, 0); sd.lineTo(sl - 1.0, 2.1); sd.lineTo(sl - 1.9, 2.1); sd.lineTo(sl - 1.9, 0); rs.holes.push(sd); }
	if (GR.window) { var sw = new THREE.Path(); sw.moveTo(0.8, 1.1); sw.lineTo(2.0, 1.1); sw.lineTo(2.0, 2.1); sw.lineTo(0.8, 2.1); sw.lineTo(0.8, 1.1); rs.holes.push(sw); }
	var rw = new THREE.Mesh(new THREE.ExtrudeGeometry(rs, { depth: 0.3, bevelEnabled: false }), gm); rw.rotation.y = -Math.PI / 2; rw.position.copy(X(gx0 + gW, gy0 + 0.3, 0)); rw.castShadow = true; rw.receiveShadow = true;
	this.add(rw);
	var fm = frameMat(c);
	if (GR.sideDoor) { this.add(box(gx0 + gW - 0.24, gy0 + 0.3 + sl - 1.9, 0, gx0 + gW - 0.18, gy0 + 0.3 + sl - 1.0, 2.1, solid(dcol, 0.45, 0.2))); }
	if (GR.window) { this.add(box(gx0 + gW - 0.22, gy0 + 0.3 + 0.8, 1.1, gx0 + gW - 0.18, gy0 + 0.3 + 2.0, 2.1, glassMat(c, this.night))); this.add(box(gx0 + gW - 0.24, gy0 + 0.3 + 0.8, 1.06, gx0 + gW - 0.16, gy0 + 0.3 + 2.0, 1.1, fm)); }
	// doors: sectional (panels), roller (fine ribs and a box above), tilt (one plain leaf), side hinged (two leaves), glass
	for (var d2 = 0; d2 < doors; d2++) {
		var gx2 = gx0 + d2 * (gW / doors) + (gW / doors - dw) / 2;
		if (GR.door === 'glass') {
			this.add(box(gx2, gy1 - 0.2, 0, gx2 + dw, gy1 - 0.16, dh, glassMat(c, this.night)));
			for (var gb = 0.45; gb < dh; gb += 0.45) { this.add(box(gx2, gy1 - 0.22, gb - 0.03, gx2 + dw, gy1 - 0.14, gb + 0.03, fm)); }
			[gx2, gx2 + dw - 0.05].forEach(function (x) { self.add(box(x, gy1 - 0.22, 0, x + 0.05, gy1 - 0.14, dh, fm)); });
		} else if (GR.door === 'roller') {
			this.add(box(gx2, gy1 - 0.22, 0, gx2 + dw, gy1 - 0.12, dh, pbr('louvre', { color: dcol }, { normal: 0.8 })));
			this.add(box(gx2 - 0.06, gy1 - 0.3, dh, gx2 + dw + 0.06, gy1 - 0.02, dh + 0.3, solid(shadeHex(dcol, 0.1), 0.45, 0.3)));
		} else if (GR.door === 'side_hinged') {
			var wm = pbr('wood', { color: c.garage_door_color ? dcol : '#8A5A36' }, { normal: 1 });
			this.add(box(gx2, gy1 - 0.22, 0, gx2 + dw / 2 - 0.01, gy1 - 0.12, dh, wm)); this.add(box(gx2 + dw / 2 + 0.01, gy1 - 0.22, 0, gx2 + dw, gy1 - 0.12, dh, wm));
		} else if (GR.door === 'tilt') {
			this.add(box(gx2, gy1 - 0.22, 0, gx2 + dw, gy1 - 0.12, dh, solid(dcol, 0.4, 0.4)));
			this.add(box(gx2 + 0.08, gy1 - 0.12, 0.08, gx2 + dw - 0.08, gy1 - 0.11, dh - 0.08, solid(shadeHex(dcol, -0.12), 0.45, 0.4)));
		} else {
			this.add(box(gx2, gy1 - 0.22, 0, gx2 + dw, gy1 - 0.12, dh, pbr('garagedoor', { color: dcol }, { normal: 1.4 })));
		}
	}
	// roof: flat with a parapet (gravel or green), a gable or a lean-to
	if (GR.roof === 'gable' || GR.roof === 'shed') {
		var rm = roofMat(c), rise = GR.roof === 'gable' ? Math.min(1.6, gW * 0.32) : 0.8, ov = 0.25;
		if (GR.roof === 'gable') {
			[[gy1, 1], [gy0, -1]].forEach(function (q) { self.add(polyMesh([X(gx0, q[0], gh), X(gx0 + gW, q[0], gh), X(gx0 + gW / 2, q[0], gh + rise)], [gm, gm], { thick: 0.05, normal: new THREE.Vector3(0, 0, q[1]) })); });
			this.add(polyMesh([X(gx0 - ov, gy0 - ov, gh - 0.1), X(gx0 - ov, gy1 + ov, gh - 0.1), X(gx0 + gW / 2, gy1 + ov, gh + rise), X(gx0 + gW / 2, gy0 - ov, gh + rise)], [rm, rm], { thick: 0.12 }));
			this.add(polyMesh([X(gx0 + gW / 2, gy0 - ov, gh + rise), X(gx0 + gW / 2, gy1 + ov, gh + rise), X(gx0 + gW + ov, gy1 + ov, gh - 0.1), X(gx0 + gW + ov, gy0 - ov, gh - 0.1)], [rm, rm], { thick: 0.12 }));
		} else {
			this.add(box(gx0, gy0, gh, gx0 + gW, gy0 + 0.3, gh + rise, gm));
			this.add(polyMesh([X(gx0 - ov, gy0 - ov, gh + rise + 0.05), X(gx0 + gW + ov, gy0 - ov, gh + rise + 0.05), X(gx0 + gW + ov, gy1 + ov, gh - 0.05), X(gx0 - ov, gy1 + ov, gh - 0.05)], [rm, rm], { thick: 0.12 }));
		}
	} else {
		this.add(box(gx0 - 0.08, gy0 - 0.08, gh, gx0 + gW + 0.08, gy1 + 0.08, gh + 0.22, solid(shadeHex(col(c.facade_color, '#F2EFE9'), 0.05), 0.8)));
		this.add(box(gx0 + 0.15, gy0 + 0.15, gh + 0.2, gx0 + gW - 0.15, gy1 - 0.15, gh + 0.235, roofTop));
	}
	// the rooms behind the garage (workshop, storage, boiler room): a lower annex with a small window
	if (GR.annex) {
		var ah = gh - 0.3;
		this.add(box(gx0, GR.y0, 0, gx0 + gW, gy0, ah, gm));
		this.add(box(gx0 - 0.06, GR.y0 - 0.06, ah, gx0 + gW + 0.06, gy0, ah + 0.18, solid(shadeHex(col(c.facade_color, '#F2EFE9'), 0.05), 0.8)));
		this.add(box(gx0 + gW + 0.005, GR.y0 + 0.6, 1.2, gx0 + gW + 0.02, GR.y0 + 1.4, 1.9, glassMat(c, this.night)));
	}
	// the inside, seen through the door: shelves and a workbench along the back wall
	var inside = Array.isArray(c.garage_rooms) ? c.garage_rooms : [];
	if (inside.indexOf('workshop') !== -1 || inside.indexOf('storage') !== -1) {
		var sh = pbr('wood', { color: '#A98458' }, { normal: 1 });
		for (var yy = 0.5; yy < 2.2; yy += 0.55) { this.add(box(gx0 + 0.4, gy0 + 0.32, yy, gx0 + gW - 0.4, gy0 + 0.75, yy + 0.04, sh)); }
	}
};
// A movable piece that belongs to the framed part of the house (the garage): same as `mover`, in `fit`.
House.prototype.moverFit = function (key, cx, cy, build, info) {
	if (this.o.mini || this.o.noMove) { build(); return null; }
	var outer = new THREE.Group(), inner = new THREE.Group(), prev = this.addTo;
	this.addTo = inner;
	try { build(); } finally { this.addTo = prev; }
	inner.position.set(-cx, 0, -cy); outer.position.set(cx, 0, cy); outer.add(inner);
	outer.userData.slot = key; outer.userData.move = Object.assign({ kind: 'site', cx: cx, cy: cy, turn: 0 }, info || {});
	if (!this.moversFit) { this.moversFit = new THREE.Group(); this.moversFit.name = 'moversFit'; this.fit.add(this.moversFit); }
	this.moversFit.add(outer);
	return outer;
};
// The pool (1.22.0): shape, water colour by finish and depth, the surround (coping, stone, deck) and the cover.
House.prototype.poolBuild = function (x0, y0, w, d, flat) {
	var c = this.c, self = this, P = SK()._poolSpec(c), e = Math.max(0.25, P.deck - 0.05), ww = w - 2 * e, wd = d - 2 * e;
	var deckM = P.deckKind === 'wood' ? pbr('deck', { color: '#A97B52' }, { normal: 1.2 }) : (P.deckKind === 'wpc' ? pbr('deck', { color: '#7A6E64' }, { normal: 1.2 }) : (P.deckKind === 'stone' ? pbr('slabs', { color: '#D9D2C4' }, { normal: 1 }) : groundKind(c, 'slabs')));
	var water = cached('water' + P.water, function () { return stdMat({ color: P.water, roughness: 0.05, metalness: 0, clearcoat: 1, envMapIntensity: 1.6 }); });
	var wz = 0.07;
	if (P.shape === 'jacuzzi') {
		// a raised round tub with a wide rim
		var r0 = Math.min(ww, wd) / 2, cx = x0 + w / 2, cy = y0 + d / 2;
		flat(x0, y0, x0 + w, y0 + d, 0.04, deckM);
		var tub = new THREE.Mesh(new THREE.CylinderGeometry(r0 + 0.2, r0 + 0.25, 0.6, 32), deckM); tub.position.copy(X(cx, cy, 0.3)); tub.castShadow = true; tub.receiveShadow = true; this.add(tub, false);
		var wtr = new THREE.Mesh(new THREE.CylinderGeometry(r0, r0, 0.02, 32), water); wtr.position.copy(X(cx, cy, 0.56)); this.add(wtr, false);
	} else if (P.shape === 'oval') {
		flat(x0, y0, x0 + w, y0 + d, 0.06, deckM);
		var ov = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.02, 40), water); ov.scale.set(ww, 1, wd); ov.position.copy(X(x0 + w / 2, y0 + d / 2, wz)); this.add(ov, false);
	} else if (P.shape === 'l_shape') {
		flat(x0, y0, x0 + w, y0 + d, 0.06, deckM);
		this.add(polyMesh([X(x0 + e, y0 + e, wz), X(x0 + w - e, y0 + e, wz), X(x0 + w - e, y0 + e + wd * 0.45, wz), X(x0 + e + ww * 0.4, y0 + e + wd * 0.45, wz), X(x0 + e + ww * 0.4, y0 + d - e, wz), X(x0 + e, y0 + d - e, wz)], [water, water], { thick: 0.01 }), false);
	} else {
		flat(x0, y0, x0 + w, y0 + d, 0.06, deckM);
		flat(x0 + e, y0 + e, x0 + w - e, y0 + d - e, wz, water);
		// infinity edge: the water runs over the far side into a dark channel, no coping there
		if (P.shape === 'infinity') { this.add(box(x0 + e, y0 + d - e, -0.05, x0 + w - e, y0 + d - e * 0.4, wz - 0.03, solid(shadeHex(P.water, -0.35), 0.1)), false); }
	}
	// cover
	if (P.cover === 'slatted') {
		var sm = solid('#D8D5CF', 0.5, 0.1);
		for (var sx = x0 + e; sx < x0 + e + ww * 0.8; sx += 0.16) { this.add(box(sx, y0 + e, wz, sx + 0.13, y0 + d - e, wz + 0.03, sm), false); }
	} else if (P.cover === 'roller') {
		this.add(box(x0 + e, y0 + e, wz, x0 + w - e, y0 + e + wd * 0.6, wz + 0.01, solid('#3D6E8A', 0.4)), false);
		var rl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, ww + 0.2, 20), solid('#B9BDC1', 0.3, 0.7)); rl.rotation.z = Math.PI / 2; rl.position.copy(X(x0 + w / 2, y0 + e - 0.2, 0.25)); this.add(rl, false);
	} else if (P.cover === 'telescopic') {
		var gm2 = cached('poolEncl', function () { return new THREE.MeshPhysicalMaterial({ color: '#DDEBF0', roughness: 0.15, metalness: 0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }); });
		var n = 3, segW = (ww + 0.2) / n;
		for (var k = 0; k < n; k++) {
			var hR = 0.9 - k * 0.06, arc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, segW - 0.04, 24, 1, true, Math.PI / 2, Math.PI), gm2);
			arc.rotation.z = Math.PI / 2; arc.scale.set(hR, 1, (wd + 0.3) / 2); arc.position.copy(X(x0 + e - 0.1 + segW * (k + 0.5), y0 + d / 2, 0.05)); this.add(arc, false);
		}
	}
};
// An outbuilding (1.23.0): walls in its material with the door open (so what is inside shows), windows,
// the roof (gable, lean-to, flat or green) in its covering, and the furnishing chosen for it.
House.prototype.outBuild = function (s, x0, y0, w, d) {
	var c = this.c, self = this, h = s.h, t = s.wall === 'glass' ? 0.04 : 0.12, x1 = x0 + w, y1 = y0 + d;
	var wm = s.wall === 'glass' ? glassMat(c, this.night) : facadeMat(c, s.wall === 'render' ? 'render' : s.wall);
	var frame = solid('#3B3F42', 0.5, 0.4);
	var rm = s.roof === 'green' ? pbr('green', {}, { normal: 2 }) : ({ tile: pbr('tiles', { color: '#9C4A32' }, { normal: 2 }), metal: pbr('seam', { color: '#3E4245' }, { metalness: 0.5, normal: 1.2 }), shingle: pbr('shingle', { color: '#4A4442' }, { normal: 1.2 }), bitumen: solid('#2E3033', 0.9) })[s.roof_mat];
	var A = function (m) { if (m) { self.add(m, false); } return m; };
	// slab and the walls; the front (street side, y1) has the door opening
	A(box(x0 - 0.05, y0 - 0.05, 0, x1 + 0.05, y1 + 0.05, 0.12, pbr('concrete', { color: '#B9B5AE' }, { normal: 0.8 })));
	var dw = s.door === 'garage' ? Math.min(w - 0.4, 2.6) : (s.door === 'double' ? 1.5 : (s.door === 'sliding' ? 1.6 : 0.9)), dh = s.door === 'garage' ? Math.min(h - 0.3, 2.2) : Math.min(h - 0.2, 2.05), dx0 = x0 + (w - dw) / 2, dx1 = dx0 + dw;
	A(box(x0, y0, 0.12, x1, y0 + t, h, wm));
	A(box(x0, y0 + t, 0.12, x0 + t, y1, h, wm));
	A(box(x1 - t, y0 + t, 0.12, x1, y1, h, wm));
	A(box(x0 + t, y1 - t, 0.12, dx0, y1, h, wm)); A(box(dx1, y1 - t, 0.12, x1 - t, y1, h, wm)); A(box(dx0, y1 - t, 0.12 + dh, dx1, y1, h, wm));
	if (s.wall === 'glass') { [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach(function (p) { A(box(p[0] - 0.03, p[1] - 0.03, 0.12, p[0] + 0.03, p[1] + 0.03, h, frame)); }); }
	// the door, open: a leaf swung out (single, double), slid aside, or a garage door rolled up under the roof
	var leaf = s.wall === 'metal' ? solid('#5A5E62', 0.5, 0.5) : pbr('wood', { color: '#7A5638' }, { normal: 1 });
	if (s.door === 'garage') { A(box(dx0, y1 - t - 0.6, 0.12 + dh, dx1, y1 - t, 0.12 + dh + 0.08, pbr('garagedoor', { color: '#D9DCDE' }, { normal: 1 }))); }
	else if (s.door === 'sliding') { A(box(dx1, y1 + 0.02, 0.12, dx1 + dw * 0.9, y1 + 0.07, 0.12 + dh, leaf)); }
	else {
		var leaves = s.door === 'double' ? [[dx0, 1], [dx1, -1]] : [[dx0, 1]], lw = s.door === 'double' ? dw / 2 : dw;
		leaves.forEach(function (q) {
			var g = new THREE.Group(), m = new THREE.Mesh(boxGeo(lw, dh, 0.04), leaf);
			m.position.set(q[1] * lw / 2, dh / 2, 0); m.castShadow = true; g.add(m);
			g.position.copy(X(q[0], y1 + 0.02, 0.12)); g.rotation.y = q[1] * -1.2; A(g);
		});
	}
	// windows: on the sides first, then the back
	var wins = [[x0 - 0.005, 'L'], [x1 + 0.005, 'R'], [null, 'B'], [null, 'B2']].slice(0, s.windows);
	wins.forEach(function (q) {
		var wy = y0 + d / 2, z0 = Math.min(h - 0.9, 1.1);
		if (q[1] === 'L' || q[1] === 'R') { var xx = q[0]; A(box(xx - 0.03, wy - 0.45, z0, xx + 0.03, wy + 0.45, z0 + 0.7, glassMat(c, self.night))); A(box(xx - 0.04, wy - 0.5, z0 - 0.05, xx + 0.04, wy + 0.5, z0, frame)); }
		else { var bx = q[1] === 'B' ? x0 + w * 0.3 : x0 + w * 0.7; A(box(bx - 0.45, y0 - 0.03, z0, bx + 0.45, y0 + 0.03, z0 + 0.7, glassMat(c, self.night))); }
	});
	// the roof
	var ov = 0.25;
	if (s.roof === 'gable') {
		var rz = Math.min(1.8, w * 0.35);
		[[y1, 1], [y0, -1]].forEach(function (q) { A(polyMesh([X(x0, q[0], h), X(x1, q[0], h), X(x0 + w / 2, q[0], h + rz)], [wm, wm], { thick: 0.05, normal: new THREE.Vector3(0, 0, q[1]) })); });
		A(polyMesh([X(x0 - ov, y0 - ov, h - 0.08), X(x0 - ov, y1 + ov, h - 0.08), X(x0 + w / 2, y1 + ov, h + rz), X(x0 + w / 2, y0 - ov, h + rz)], [rm, rm], { thick: 0.08 }));
		A(polyMesh([X(x0 + w / 2, y0 - ov, h + rz), X(x0 + w / 2, y1 + ov, h + rz), X(x1 + ov, y1 + ov, h - 0.08), X(x1 + ov, y0 - ov, h - 0.08)], [rm, rm], { thick: 0.08 }));
	} else if (s.roof === 'shed') {
		var rz2 = Math.min(1.0, d * 0.2);
		A(box(x0, y0, h, x1, y0 + t, h + rz2, wm));
		A(polyMesh([X(x0 - ov, y0 - ov, h + rz2 + 0.04), X(x1 + ov, y0 - ov, h + rz2 + 0.04), X(x1 + ov, y1 + ov, h - 0.04), X(x0 - ov, y1 + ov, h - 0.04)], [rm, rm], { thick: 0.08 }));
	} else {
		A(box(x0 - 0.1, y0 - 0.1, h, x1 + 0.1, y1 + 0.1, h + 0.12, solid('#4A4D50', 0.7)));
		A(box(x0, y0, h + 0.12, x1, y1, h + 0.14, rm));
	}
	// what is inside, along the back and side walls
	var it = s.items, ix0 = x0 + t + 0.05, ix1 = x1 - t - 0.05, iy0 = y0 + t + 0.05, wood = pbr('wood', { color: '#A98458' }, { normal: 1 }), steel = solid('#8C9296', 0.35, 0.8);
	if (it.indexOf('shelves') !== -1) { for (var sy = 0.5; sy < Math.min(h - 0.3, 2.2); sy += 0.45) { A(box(ix0, iy0, sy, Math.min(ix1, ix0 + Math.max(1.2, w * 0.5)), iy0 + 0.4, sy + 0.03, wood)); } [ix0, Math.min(ix1, ix0 + Math.max(1.2, w * 0.5)) - 0.04].forEach(function (px) { A(box(px, iy0, 0.12, px + 0.04, iy0 + 0.4, Math.min(h - 0.3, 2.2), wood)); }); }
	if (it.indexOf('workbench') !== -1) { var wb0 = Math.max(ix0, ix1 - 1.8); A(box(wb0, iy0, 0.88, ix1, iy0 + 0.65, 0.93, wood)); [wb0 + 0.05, ix1 - 0.1].forEach(function (lx) { A(box(lx, iy0 + 0.05, 0.12, lx + 0.05, iy0 + 0.6, 0.88, steel)); }); }
	if (it.indexOf('tool_wall') !== -1) { var tw0 = Math.max(ix0, ix1 - 1.6); A(box(tw0, iy0 - 0.03, 1.1, ix1, iy0, 1.9, pbr('wood', { color: '#C8B08A' }, { normal: 0.6 }))); for (var tk = 0; tk < 6; tk++) { A(box(tw0 + 0.15 + tk * 0.24, iy0, 1.3 + (tk % 2) * 0.2, tw0 + 0.19 + tk * 0.24, iy0 + 0.04, 1.65 + (tk % 2) * 0.1, steel)); } }
	if (it.indexOf('machines') !== -1) { var mx = ix0 + 0.5, my = y1 - t - 1.2; A(box(mx - 0.25, my - 0.3, 0.12, mx + 0.25, my + 0.3, 0.45, solid('#3E8E41', 0.5))); A(box(mx - 0.02, my + 0.3, 0.45, mx + 0.02, my + 0.75, 1.0, steel)); }
	if (it.indexOf('firewood') !== -1) { var fw0 = ix0, fy0 = y1 - t - 0.5; for (var lg = 0; lg < 4; lg++) { var cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.45, 8), wood); cyl.rotation.x = Math.PI / 2; cyl.position.copy(X(fw0 + 0.1 + lg * 0.17, fy0, 0.2 + (lg % 2) * 0.14)); A(cyl); } }
	if (it.indexOf('table') !== -1) { var tx = x0 + w / 2, ty = y0 + d / 2; A(box(tx - 0.6, ty - 0.4, 0.74, tx + 0.6, ty + 0.4, 0.78, wood)); [[-0.55, -0.35], [0.5, -0.35], [-0.55, 0.3], [0.5, 0.3]].forEach(function (q) { A(box(tx + q[0], ty + q[1], 0.12, tx + q[0] + 0.05, ty + q[1] + 0.05, 0.74, wood)); }); }
	if (it.indexOf('kitchen') !== -1) { A(box(ix0, iy0, 0.12, Math.min(ix1, ix0 + 2.2), iy0 + 0.6, 0.9, solid('#E9E6E0', 0.5))); A(box(ix0, iy0, 0.9, Math.min(ix1, ix0 + 2.2), iy0 + 0.62, 0.94, pbr('stone', { color: '#6F6A64' }, { normal: 0.8 }))); }
	if (it.indexOf('plants') !== -1) { for (var pk = 0; pk < 3; pk++) { A(box(ix0 + pk * 0.7, iy0, 0.12, ix0 + pk * 0.7 + 0.5, iy0 + 0.4, 0.7, wood)); var bush = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), solid('#4F7F37', 0.8)); bush.position.copy(X(ix0 + pk * 0.7 + 0.25, iy0 + 0.2, 0.95)); A(bush); } }
	if (it.indexOf('car') !== -1 && w >= 2.6 && d >= 4.6) { var car = INT.vehicle(INT.mats(c), 'sedan', col(c.car_color, '#3C4148')); A(life(car, x0 + w / 2, y0 + d / 2, -Math.PI / 2)); }
	if (it.indexOf('bike') !== -1) { var bk = INT.bicycle(INT.mats(c), '#2F5A8A'); A(life(bk, x1 - t - 0.35, y0 + d * 0.6, Math.PI / 2)); }
};
House.prototype.furniture = function (x, y, z, kitchen) {
	var wm = pbr('wood', { color: '#8A6A4C' }, { normal: 1 }), cush = solid('#E7E1D6', 0.95);
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
	var plot = K._plot(c, vols, this.garage ? this.garageBase : maxX + 3.8);
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
	// every piece below can be picked up in the 3D view (1.18.0): each is built around its centre in its
	// own group; a rectangle (pool, shed, pergola, play area) keeps its size and is turned as a whole
	var unturned = function (r) { return { x0: r.cx - r.w / 2, y0: r.cy - r.d / 2, x1: r.cx + r.w / 2, y1: r.cy + r.d / 2 }; };
	if (G.pool) {
		var pr = unturned(G.pool), px0 = pr.x0, py0 = pr.y0, poolW = pr.x1 - pr.x0, pdp = pr.y1 - pr.y0;
		this.mover('pool', G.pool.cx, G.pool.cy, G.pool.rot, function () { self.poolBuild(px0, py0, poolW, pdp, flat); }, { kind: 'pool', w: poolW, d: pdp, field: 'garden_features' });
	}
	G.flats.forEach(function (f) {
		if (f.kind === 'sand' && G.playground) { return; }
		flat(f.x0, f.y0, f.x1, f.y1, 0.03, groundKind(c, f.kind));
	});
	if (G.playground) {
		var pgr = unturned(G.playground);
		this.mover('playground', G.playground.cx, G.playground.cy, G.playground.rot, function () { flat(pgr.x0, pgr.y0, pgr.x1, pgr.y1, 0.03, groundKind(c, 'sand')); }, { kind: 'structure', w: pgr.x1 - pgr.x0, d: pgr.y1 - pgr.y0, field: 'garden_features' });
	}
	// 1.23.0: the outbuildings – each one movable and turnable as a whole
	(G.outs || []).forEach(function (q) {
		var r0 = unturned(q);
		self.mover('out#' + q.i, q.cx, q.cy, q.rot, function () { self.outBuild(q.spec, r0.x0, r0.y0, r0.x1 - r0.x0, r0.y1 - r0.y0); }, { kind: 'structure', w: r0.x1 - r0.x0, d: r0.y1 - r0.y0, field: 'outbuildings' });
	});
	if (G.shed) {
		var sh = unturned(G.shed);
		this.mover('shed', G.shed.cx, G.shed.cy, G.shed.rot, function () { self.add(box(sh.x0 + 0.1, sh.y0 + 0.1, 0, sh.x1 - 0.1, sh.y1 - 0.1, 2.3, pbr('wood', { color: '#9A7048' }, { normal: 1 })), false); self.add(box(sh.x0, sh.y0, 2.3, sh.x1, sh.y1, 2.42, solid('#3A3D40', 0.6)), false); }, { kind: 'structure', w: sh.x1 - sh.x0, d: sh.y1 - sh.y0, field: 'garden_features' });
	}
	if (G.firepit) {
		this.mover('firepit', G.firepit.x, G.firepit.y, G.firepit.turn, function () {
			var fp = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.65, 0.35, 24), pbr('stone', { color: '#8D8576' }, { normal: 2 })); fp.position.copy(X(G.firepit.x, G.firepit.y, 0.17)); self.add(fp, false);
			var fire = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 12), solid('#FF8A30', 0.8, 0, { emissive: '#FF7A20', emissiveIntensity: self.night ? 4 : 1.5 })); fire.position.copy(X(G.firepit.x, G.firepit.y, 0.6)); self.add(fire, false);
		}, { kind: 'structure', w: 1.3, d: 1.3, field: 'garden_features' });
	}
	if (G.pergola) {
		var pgo = unturned(G.pergola), pgx = pgo.x0, pgy = pgo.y0, pgw = pgo.x1 - pgo.x0 - 0.2, pgd = pgo.y1 - pgo.y0 - 0.2, pm = pbr('wood', { color: '#8A6A4C' }, { normal: 1 });
		this.mover('pergola', G.pergola.cx, G.pergola.cy, G.pergola.rot, function () {
			[[pgx, pgy], [pgx + pgw - 0.2, pgy], [pgx, pgy + pgd - 0.2], [pgx + pgw - 0.2, pgy + pgd - 0.2]].forEach(function (q) { self.add(box(q[0], q[1], 0, q[0] + 0.14, q[1] + 0.14, 2.5, pm), false); });
			for (var pb = 0; pb < pgw - 0.05; pb += 0.45) { self.add(box(pgx + pb, pgy - 0.1, 2.5, pgx + pb + 0.08, pgy + pgd, 2.62, pm), false); }
		}, { kind: 'structure', w: pgw, d: pgd, field: 'garden_features' });
	}
	if (G.furniture) {
		var fu = G.furniture;
		this.mover('furniture', fu.x + 0.8, fu.y + 1.0, fu.turn, function () { self.furniture(fu.x, fu.y, 0, fu.kitchen); }, { kind: 'furniture', w: 2.0, d: 2.0, field: 'garden_features' });
	}
	G.lights.forEach(function (q, i) {
		self.mover('light#' + i, q[0], q[1], 0, function () {
			self.add(box(q[0] - 0.06, q[1] - 0.06, 0, q[0] + 0.06, q[1] + 0.06, 0.6, solid('#2E3135', 0.4, 0.5)), false);
			self.add(box(q[0] - 0.07, q[1] - 0.07, 0.48, q[0] + 0.07, q[1] + 0.07, 0.56, self.night ? solid('#3A3020', 0.3, 0, { emissive: '#FFD9A0', emissiveIntensity: 4 }) : solid('#D8D8D2', 0.3)), false);
		}, { kind: 'light', w: 0.3, d: 0.3, field: 'garden_features' });
	});
	G.plants.forEach(function (p, i) {
		if (p.kind === 'flower') { self.plant(p.kind, p.x, p.y, p.size, p.seed); return; }
		var big = !(p.kind === 'grass' || p.kind === 'lavender' || p.kind === 'shrub' || p.kind === 'topiary'), r = big ? clamp(p.size * 0.12, 0.35, 0.9) : 0.35;
		self.mover('plant#' + i, p.x, p.y, p.turn, function () { self.plant(p.kind, p.x, p.y, p.size, p.seed); }, { kind: big ? 'tree' : 'plant', w: r * 2, d: r * 2, size: p.size, field: 'tree_types' });
	});
	// vehicles, people and pets (shared plan with the 2D sketch)
	if (G.vehicles.length || G.people.length || G.pets.length || G.kennel) {
		var LM = INT.mats(c), paint = col(c.car_color, '#3C4148');
		G.vehicles.forEach(function (vh, i) {
			var dim = K._vehSize ? K._vehSize(vh.type) : [1.9, 4.7];
			self.mover('vehicle#' + i, vh.x, vh.y, vh.turn, function () {
				self.add(life(vh.type === 'motorcycle' ? INT.motorcycle(LM, paint) : (vh.type === 'bicycle' ? INT.bicycle(LM, paint) : INT.vehicle(LM, vh.type, paint)), vh.x, vh.y, Math.PI / 2), false);
			}, { kind: 'vehicle', w: dim[0], d: dim[1], field: 'vehicles' });
		});
		if (G.charger) { self.mover('charger', G.charger.x, G.charger.y, G.charger.turn, function () { var ch = new THREE.Group(); ch.add(box(-0.1, -0.08, 0, 0.1, 0.08, 1.0, solid('#2B2E31', 0.4, 0.3))); var wb = INT.wallbox(LM); wb.position.set(0, -0.35, 0.08); ch.add(wb); self.add(life(ch, G.charger.x, G.charger.y, 0), false); }, { kind: 'structure', w: 0.3, d: 0.3, field: 'vehicles' }); }
		if (G.kennel) { self.mover('kennel', G.kennel.x, G.kennel.y, G.kennel.turn, function () { self.add(life(INT.kennel(LM), G.kennel.x, G.kennel.y, 0.3), false); }, { kind: 'structure', w: 1.0, d: 0.9, field: 'pets' }); }
		G.people.forEach(function (pp, i) { self.mover('person#' + i, pp.x, pp.y, pp.turn, function () { self.add(life(INT.person(LM, pp.kind, pp.pose, pp.seed), pp.x, pp.y, pp.rot), false); }, { kind: 'person', w: 0.6, d: 0.6, field: 'people' }); });
		G.pets.forEach(function (pp, i) { self.mover('pet#' + i, pp.x, pp.y, pp.turn, function () { self.add(life(pp.kind === 'cat' ? INT.cat(LM, pp.seed, pp.pose) : INT.dog(LM, pp.kind === 'dog_small' ? 'small' : 'large', pp.seed, pp.pose), pp.x, pp.y, pp.rot, pp.z), false); }, { kind: 'pet', w: 0.7, d: 0.7, field: 'pets' }); });
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
		if (kind === 'cypress') {
			canopy('column', 0, H * 0.52, 0, H * 0.55, H * 0.48, H * 0.55, 200, 'conifer');
			// 1.26.0: a few loose sprays break the column's outline
			for (var cs2 = 0; cs2 < 3; cs2++) { var ca2 = rnd() * Math.PI * 2; canopy('sphere', Math.cos(ca2) * H * 0.07, H * (0.35 + cs2 * 0.18), Math.sin(ca2) * H * 0.07, H * 0.1, H * 0.13, H * 0.1, 28, 'conifer'); }
		} else {
			// 1.26.0: whorls of branches – tiers of drooping cones, smaller towards the top, slightly off axis
			var tiers = 4, base0 = H * 0.18;
			for (var ti = 0; ti < tiers; ti++) {
				var q0 = ti / tiers, tw0 = H * 0.75 * (1 - q0 * 0.62), th0 = H * 0.36 * (1 - q0 * 0.3), ty = base0 + (H - base0) * q0 * 0.86 + th0 * 0.5;
				canopy('cone', (rnd() - 0.5) * H * 0.03, ty, (rnd() - 0.5) * H * 0.03, tw0, th0, tw0, Math.round(150 - ti * 25), 'conifer');
			}
		}
	} else if (kind === 'shrub' || kind === 'topiary' || kind === 'lavender' || kind === 'flower') {
		if (kind === 'topiary') {
			var tm = winter ? pbr('snow', {}, { normal: 0.4 }) : pbr('hedge', { season: season }, { normal: 2.5 });
			var sp = new THREE.Mesh(new THREE.SphereGeometry(H * 0.42, 24, 16), tm); sp.position.y = H * 0.45; sp.castShadow = true; sp.receiveShadow = true; g.add(sp);
		} else if (kind === 'shrub') {
			// 1.26.0: a shrub of three or four overlapping clumps – an irregular, living outline
			var bl = c.garden_style === 'cottage', nb = 3 + (seed % 2);
			canopy('sphere', 0, H * 0.36, 0, H * 0.42, H * 0.33, H * 0.42, 70, 'broad', bl);
			for (var sb2 = 0; sb2 < nb; sb2++) {
				var sa2 = sb2 / nb * Math.PI * 2 + rnd() * 0.8, sr2 = H * (0.18 + rnd() * 0.1), ss2 = H * (0.24 + rnd() * 0.1);
				canopy('sphere', Math.cos(sa2) * sr2, H * (0.26 + rnd() * 0.16), Math.sin(sa2) * sr2, ss2, ss2 * 0.8, ss2, 34, 'broad', bl);
			}
		} else {
			var kk = kind === 'lavender' ? 'lavender' : 'broad';
			canopy('sphere', 0, H * 0.38, 0, H * 0.48, H * 0.36, H * 0.48, kind === 'flower' ? 40 : 120, kk, kind === 'flower');
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
		var stems = kind === 'multistem' ? 3 : 1, fork = H * (kind === 'fruit' || kind === 'olive' ? 0.36 : 0.46);
		for (var s = 0; s < stems; s++) {
			var ox = (s - (stems - 1) / 2) * H * 0.06;
			g.add(rod(new THREE.Vector3(ox, 0, 0), new THREE.Vector3(ox * 2.5, H * 0.52, ox * 0.5), H * (stems > 1 ? 0.018 : (kind === 'olive' ? 0.04 : 0.03)), bark, 8));
		}
		// 1.26.0: root flare at the foot of a single trunk
		if (stems === 1) { var fl0 = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.032, H * 0.06, H * 0.06, 8), bark); fl0.position.y = H * 0.03; fl0.castShadow = true; fl0.receiveShadow = true; g.add(fl0); }
		if (!winter || kind === 'olive') {
			var R = H * (kind === 'multistem' ? 0.3 : (kind === 'olive' ? 0.32 : 0.36)), k2 = kind === 'olive' ? 'olive' : 'broad';
			var blossom = kind === 'fruit' || (season === 'spring' && rnd() > 0.4);
			// 1.26.0: the crown grows on its branches: main limbs from the fork, each forking once, and a
			// clump of leaves at every tip – gaps between the clumps let the sky and the limbs show through
			var tips = [], nLimb = kind === 'olive' ? 4 : 5;
			for (var br = 0; br < nLimb; br++) {
				var ang = br / nLimb * Math.PI * 2 + rnd() * 0.9, rise = 0.55 + rnd() * 0.35, len = H * (0.24 + rnd() * 0.1);
				var from = new THREE.Vector3(0, fork + rnd() * H * 0.06, 0), dir = new THREE.Vector3(Math.cos(ang) * (1 - rise * 0.5), rise, Math.sin(ang) * (1 - rise * 0.5)).normalize();
				var mid = from.clone().addScaledVector(dir, len);
				g.add(rod(from, mid, H * 0.014, bark, 6));
				for (var bf = 0; bf < 2; bf++) {
					var d2 = dir.clone().add(new THREE.Vector3(rnd() - 0.5, rnd() * 0.4, rnd() - 0.5).multiplyScalar(0.9)).normalize(), tip = mid.clone().addScaledVector(d2, len * (0.5 + rnd() * 0.25));
					g.add(rod(mid, tip, H * 0.007, bark, 5));
					tips.push(tip);
				}
			}
			// a central mass keeps the crown dense from below; the tips carry the outline
			canopy('sphere', 0, H - R * 1.0, 0, R * 0.78, R * 0.6, R * 0.78, 240, k2, blossom);
			tips.forEach(function (tp, ti2) {
				var cs = R * (0.38 + rnd() * 0.2);
				// keep the crown inside its height: tips that grew too high are pulled in
				var cy = Math.min(tp.y + cs * 0.15, H - cs * 0.7);
				canopy('sphere', tp.x * 1.05, cy, tp.z * 1.05, cs, cs * 0.78, cs, ti2 % 3 === 0 ? 120 : 95, k2, blossom);
			});
		} else {
			// main branches (bare crown)
			for (var brw = 0; brw < 5; brw++) {
				var angw = brw / 5 * Math.PI * 2 + rnd(), lenw = H * (0.25 + rnd() * 0.12);
				g.add(rod(new THREE.Vector3(0, H * 0.48, 0), new THREE.Vector3(Math.cos(angw) * lenw, H * (0.62 + rnd() * 0.2), Math.sin(angw) * lenw), H * 0.012, bark, 6));
			}
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
	this.photo = '';      // name of the photographed sky in use ('' = the painted sky)
	this.skyRes = 2048;   // width of the photographed sky (quality profile)
	this.want = '';       // the photographed sky this view asked for (loading or failed)
	this.onSky = null;    // called when a sky that was asked for has arrived
	this.hz = null;       // horizon colour of the photographed sky (for the haze)
}
// 1.26.0: the photographed sky (assets/sky, CC0) when it is loaded, otherwise the painted one. Indoors
// and for single items nothing changes. `noPhoto` keeps the painted sky (benchmark comparison, tests).
Env.prototype.apply = function (scene, c, inner) {
	var name = inner || c._item || c._paintedSky || NO_PHOTO ? '' : SKY.pick(c), st = name ? SKY.status(name) : 'none', self = this;
	var key = [c.time_of_day, c.weather, c.orientation, inner ? 'in' : '', st === 'ready' ? name + '@' + this.skyRes : ''].join('|');
	if (name && st !== 'ready' && st !== 'failed' && this.want !== name) {
		// not here yet: the painted sky now, the photograph as soon as it has arrived
		this.want = name;
		SKY.load(name).then(function (ok) { if (ok && self.want === name && self.onSky) { self.onSky(name); } });
	}
	if (!name) { this.want = ''; }
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
	this.photo = ''; this.hz = null;
	if (st === 'ready') {
		// the photograph's sun goes where the scene's sun stands (same azimuth, orientation included), and
		// its brightness is matched to the painted sky of the same hour: exposure and lamps stay balanced
		var tex = null;
		try {
			var s = SKY.info(name), mean = SKY.canvasMean(this.bg.image), k = s && s.mean > 0 ? mean / s.mean : 1;
			tex = SKY.texture(name, this.skyRes, Math.atan2(sd.z, sd.x) / (2 * Math.PI) + 0.5, k);
			if (tex) { this.hz = SKY.horizon(name, k); }
		} catch (e) { tex = null; }
		if (tex) { this.bg.dispose(); this.bg = tex; this.photo = name; }
	}
	this.envRT = inner ? this.pmrem.fromScene(roomEnv(c), 0.04) : this.pmrem.fromEquirectangular(this.bg);
	scene.background = this.bg;
	scene.environment = this.envRT.texture;
};
// Tests and the benchmark can switch the photographs off (the painted sky of 1.24.0).
var NO_PHOTO = false;
// Resolves once the photographed sky of a configuration has arrived (or failed): option cards and guide
// pictures wait for it, so a kept picture never has the painted sky by accident.
function skyReady(c) {
	var name = c && !c._int && !c._item && !c._paintedSky && !NO_PHOTO ? SKY.pick(c) : '';
	return name ? SKY.load(name) : Promise.resolve(false);
}
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
	// 1.26.0: the live preview follows the quality levels (agh-3d-quality.js); option cards stay 'thumb'.
	// The canvas is made the way the starting level needs it ('high'/'ultra': effect composer, 'medium'/'low':
	// antialiased canvas – the two pictures of 1.24.0); a later change of level adapts what it can.
	this.levels = !this.thumb && !opts.quality;
	var lvl = this.levels ? QL.initial(coarse) : '';
	this.quality = opts.quality || (this.thumb ? 'thumb' : (lvl ? (lvl === 'high' || lvl === 'ultra' ? 'high' : 'medium') : (coarse ? 'medium' : 'high')));
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
	if (this.thumb) { this.env.skyRes = 1024; }   // option cards and guide pictures: half the sky is plenty
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
		var hoverAt = 0;
		this.el.addEventListener('pointermove', function (e) {
			if (dn && hold && (Math.abs(e.clientX - dn[0]) + Math.abs(e.clientY - dn[1])) > 8) { clearTimeout(hold); hold = 0; }
			if (self.drag) { self.dragTo(e); return; }
			// a hand over a piece that can be picked up (mouse only, a few times a second)
			if (e.pointerType === 'mouse' && !e.buttons && self.house && Date.now() - hoverAt > 90) {
				hoverAt = Date.now();
				if (self.paint) { var fh = self.faceAt(e.clientX, e.clientY); self.paintMark(fh); self.el.style.cursor = fh ? 'pointer' : ''; return; }
				var over = self.house.room ? self.itemAt(e.clientX, e.clientY) : self.extAt(e.clientX, e.clientY);
				self.el.style.cursor = over ? 'grab' : '';
			}
		});
		this.el.addEventListener('wheel', function (e) { if (self.drag) { e.preventDefault(); self.turnDrag(e.deltaY > 0 ? 15 : -15); } }, { passive: false });
		this.el.addEventListener('pointerup', function (e) {
			if (hold) { clearTimeout(hold); hold = 0; }
			var wasDrag = !!self.drag, moved = dn ? Math.abs(e.clientX - dn[0]) + Math.abs(e.clientY - dn[1]) : 99, slow = dn ? Date.now() - dn[2] > 700 : true;
			if (wasDrag) { self.dropDrag(); }
			if (!dn || !self.onPick) { dn = null; return; }
			dn = null;
			// a grab that did not move is a tap: the settings still jump to the piece's field
			if (moved > 6 || slow) { return; }
			if (self.paint && self.onPaint) { var ph = self.faceAt(e.clientX, e.clientY); if (ph) { self.onPaint(ph); } return; }
			var hit = self.pickAt(e.clientX, e.clientY);
			if (hit) { self.onPick(hit); }
		});
		this.el.addEventListener('pointercancel', function () { if (hold) { clearTimeout(hold); hold = 0; } if (self.drag) { self.dropDrag(); } });
		// keys while a piece is held or selected (1.18.0): Esc puts it back / lets it go, R turns it,
		// the arrows move the selected piece. Fields of the form keep their keys.
		this.onKey = function (e) {
			if (!self.el || !self.el.isConnected || (!self.drag && !self.sel)) { return; }
			var tg = (e.target && e.target.tagName) || '';
			if (/^(INPUT|TEXTAREA|SELECT)$/.test(tg) || (e.target && e.target.isContentEditable)) { return; }
			var k = e.key;
			if (self.drag) {
				if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); self.dropDrag(true); }
				else if (k === 'r' || k === 'R') { e.preventDefault(); self.turnDrag(e.shiftKey ? 90 : 15); }
				return;
			}
			if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); self.select(null); self.requestRender(); return; }
			var st = e.shiftKey ? 0.5 : 0.1, dx = 0, dz = 0, turn = 0;
			if (k === 'ArrowLeft') { dx = -st; } else if (k === 'ArrowRight') { dx = st; } else if (k === 'ArrowUp') { dz = st; } else if (k === 'ArrowDown') { dz = -st; } else if (k === 'r' || k === 'R') { turn = e.shiftKey ? 90 : 15; } else { return; }
			e.preventDefault(); e.stopPropagation();
			self.nudge(dx, dz, turn);
		};
		document.addEventListener('keydown', this.onKey, true);
		this.aa = this.quality !== 'high';
		if (this.quality === 'high') { this.makeComposer(); }
		// 1.26.0: the quality profile of the level, and the photographed sky when it arrives
		var selfQ = this;
		// a sky that arrives after the first picture: applied at once; before it, the upgrade takes it along
		this.env.onSky = function () { if (!selfQ.disposed && selfQ.c && (DETAIL_ON || selfQ.thumb)) { selfQ.envApply(); selfQ.requestRender(); } };
		if (this.levels) {
			this.gpu = QL.gpuInfo(r.getContext());
			QL.setGpu(this.gpu.renderer);
			this.applyQuality(QL.state().level);
			QL.onChange(function (l) { if (!selfQ.disposed) { selfQ.applyQuality(l); selfQ.requestRender(); } });
		}
	}
}
// The effect composer with ambient occlusion (the 'high' picture of 1.24.0). Kept for later effects: a
// post pass is inserted before the OutputPass (this.composer.insertPass(pass, this.composer.passes.length - 1)).
Viewer.prototype.makeComposer = function () {
	var r = this.renderer;
	this.composer = new EffectComposer(r, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
	this.composer.addPass(new RenderPass(this.scene, this.camera));
	this.gtao = new GTAOPass(this.scene, this.camera, 1, 1);
	this.gtao.output = GTAOPass.OUTPUT.Default;
	this.gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.5, thickness: 0.6, scale: 1, samples: 16 });
	this.gtaoSamples = 16;
	this.gtao.blendIntensity = 0.6;
	this.composer.addPass(this.gtao);

	this.composer.addPass(new OutputPass());
	if (this.w) { this.composer.setPixelRatio(r.getPixelRatio()); this.composer.setSize(this.w, this.h); }
};
// Puts a quality level into effect (only the live preview): pixel ratio, shadow map, ambient occlusion,
// grass, the sky's resolution, the stochastic tiling, the reach of the detailed trees.
Viewer.prototype.applyQuality = function (l) {
	var P = QL.profile(l), prev = this.qp;
	this.qp = P;
	this.dprHi = Math.min(window.devicePixelRatio || 1, P.dpr);
	if (this.w) { this.setDPR(this.lowDPR ? this.prLo() : this.prHi()); }
	if (this.sun.shadow.mapSize.x !== P.shadow) {
		this.sun.shadow.mapSize.set(P.shadow, P.shadow);
		if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
		this.shadowDirty = true;
	}
	this.sun.shadow.radius = P.shadowRadius;
	// the composer is needed for ambient occlusion – and always on a canvas made without antialiasing
	this.useComposer = P.gtao || !this.aa;
	if (this.useComposer && !this.composer) { this.makeComposer(); }
	this.gtaoOn = P.gtao;
	if (this.gtao && P.gtao && this.gtaoSamples !== P.gtaoSamples) { this.gtao.updateGtaoMaterial({ samples: P.gtaoSamples }); this.gtaoSamples = P.gtaoSamples; }
	SHQ.aghStoch.value = P.stochastic ? 1 : 0;
	setSurfStoch(P.stochastic);
	SHQ.aghDetail.value = l === 'low' ? 0.5 : 1;
	this.env.skyRes = P.sky;
	if (this.c && prev) {
		this.envApply();
		this.grassFor();
		if (this.woodsNear !== undefined && this.woodsNear !== P.treeNear && this.house && !this.innerNow) { this.woodsFor(this.c); }
		this.shadowDirty = true;
	}
};
// (Re)applies the environment of the current view: called when a photographed sky arrived or the level
// changed (its resolution) – nothing else of the scene is rebuilt.
Viewer.prototype.envApply = function () {
	this.env.apply(this.scene, this.c, !!this.innerNow);
	this.applyHaze();
};
// The haze takes the colour of the sky at the horizon: the painted sky's (as before) or, with a
// photographed sky, its own hue at the painted sky's brightness.
Viewer.prototype.applyHaze = function () {
	if (!this.scene.fog || !this.hz0) { return; }
	this.scene.fog.color.set(this.hz0);
	var h = this.env.photo && this.env.hz;
	if (h) {
		var c0 = this.scene.fog.color, l0 = 0.2126 * c0.r + 0.7152 * c0.g + 0.0722 * c0.b, l1 = 0.2126 * h[0] + 0.7152 * h[1] + 0.0722 * h[2];
		if (l1 > 1e-6) { var k = l0 / l1; c0.setRGB(Math.min(1, h[0] * k), Math.min(1, h[1] * k), Math.min(1, h[2] * k), THREE.LinearSRGBColorSpace); }
	}
};
// Compiles the shaders of a scene for the target this viewer really draws into (the effect
// composer's buffer or an option card's buffer: tone mapping and colour space are part of a shader).
Viewer.prototype.compileFor = function (scene, target) {
	var r = this.renderer, prev = r.getRenderTarget();
	if (!r.compileAsync) { return Promise.resolve(); }
	r.setRenderTarget(target || (this.composer && this.useComposer !== false ? this.composer.renderTarget1 : null));
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
	this.innerNow = !!c._int || !!c._item || mode === 'interior'; this.modeNow = mode;
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
	this.hz0 = hz; this.applyHaze();
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
	else if (mode === 'build' && BUILD_SCENE) { this.house = BUILD_SCENE(c, H3); }
	else { this.house = new House(c, { mini: this.o.mini || mode === 'mini', noMove: !!this.thumb }).build(); }
	if (!inner) { this.landFor(c, mode); }
	this.grassFor();
	this.lampsToPool(this.house.root);
	this.sel = null; this.drag = null;
	if (this.bmark) { this.bmark.visible = false; }
	if (mode === 'build' && this.house.phases) {
		// construction phases (agh-3d-build.js): every phase is merged on its own, so it can be shown or hidden
		this.picks = null; this.ops = null;
		this.house.phases.forEach(function (g) { if (g) { mergeStatic(g); } });
	} else {
		this.picks = this.thumb ? null : collectPicks(this.house.root);   // before the merge, while the pieces are still apart
		// openings and the chimney: their place on the wall / roof, kept before the merge (1.18.0)
		this.ops = this.thumb ? null : collectOps(this.house.root);
		this.faces = this.thumb ? null : collectFaces(this.house.root);
		// In a room every piece is merged on its own and the furniture group is left out of the big merge:
		// that is what keeps each piece grabbable, while the number of draw calls stays low. The movable
		// pieces of the garden (1.18.0) are handled the same way.
		var itemsG = !this.thumb && this.house.items && this.house.items.children.length ? this.house.items : null;
		var moversG = this.house.movers && this.house.movers.children.length ? this.house.movers : null, moversF = this.house.moversFit || null;
		if (itemsG) { itemsG.children.slice().forEach(function (o) { try { mergeStatic(o); } catch (e) {} }); }
		if (moversG) { moversG.children.slice().forEach(function (o) { try { mergeStatic(o); } catch (e) {} }); }
		if (moversF) { moversF.children.slice().forEach(function (o) { try { mergeStatic(o); } catch (e) {} }); }
		mergeStatic(this.house.fit || this.house.root, [itemsG, moversG, moversF]);
		if (this.house.fit && this.house.fit !== this.house.root) { mergeStatic(this.house.root, [this.house.fit, moversG]); }
	}
	this.scene.add(this.house.root);
	// the piece selected before the rebuild (a window that was just moved along its wall) stays selected
	this.reselect();
	// build mode: every phase's shaders are compiled now (hidden objects would otherwise compile on their
	// first appearance and the phase slider would stall for seconds)
	if (mode === 'build' && this.house.phases && this.house.setPhase && this.renderer.compile) {
		var ph0 = this.house.phase;
		this.house.phases.forEach(function (g) { if (g) { g.visible = true; } });
		try { this.renderer.compile(this.scene, this.camera); } catch (e) { /* compiled on first use instead */ }
		// and their textures go up to the GPU now, not on the first frame of that phase
		var rr = this.renderer, seen = {};
		if (rr.initTexture) {
			this.house.root.traverse(function (o) {
				(Array.isArray(o.material) ? o.material : (o.material ? [o.material] : [])).forEach(function (m) {
					['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'].forEach(function (k) { var tx = m[k]; if (tx && !seen[tx.uuid]) { seen[tx.uuid] = 1; try { rr.initTexture(tx); } catch (e2) { /* uploaded on first use */ } } });
				});
			});
		}
		this.house.setPhase(ph0);
	}
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
	this.requestRender();
};
// Build mode: shows the construction up to phase p (only visibility changes, nothing is rebuilt).
Viewer.prototype.setPhase = function (p) {
	if (this.house && this.house.setPhase) { this.house.setPhase(p); this.renderer.shadowMap.needsUpdate = true; this.shadowDirty = true; this.requestRender(); }
	return this;
};
// The land around the plot for the chosen (or the style's) landscape: terrain with fields, rock, snow
// and water, woods of the matching species, the street in front and – when asked for – the neighbours.
// Terrain and woods are rebuilt only when the landscape, the season or the street line changes.
Viewer.prototype.landFor = function (c, mode) {
	var k = LAND.landKind(c), hs = this.house, pb = hs && hs.plotBox, night = c.time_of_day === 'night' || c.time_of_day === 'blue';
	if (pb) { LAND.setRoad(pb.front); }
	// 1.26.0: how far the detailed trees reach follows the quality level (150 m = 1.24.0; option cards too)
	var near = this.qp ? this.qp.treeNear : 150;
	var key = [k, c.season || 'summer', pb ? Math.round(pb.front / 10) : 2, this.thumb ? 't' : '', DETAIL_ON ? 'd' : '', near].join('|');
	this.ground.material = LAND.terrainMat(c);
	if (key !== this.landKey) {
		this.landKey = key;
		this.woodsNear = near;
		this.ground.geometry = LAND.terrainGeo(k, c.season);
		if (this.water) { this.scene.remove(this.water); this.water.geometry.dispose(); this.water = null; }
		this.water = LAND.water(k); if (this.water) { this.scene.add(this.water); }
		this.woodsFor(c);
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
/* 1.26.0 – the lawn in blades: clumps of grass blades as one InstancedMesh (one draw call) on the lawn of
 * the plot and, thinner, on the meadow around it; dense near the house, thinning out with the distance.
 * How many clumps: the quality level (low: none – the lawn texture of 1.24.0 alone). Nothing grows on
 * paved or built surfaces, the pool, beds, or under the outbuildings. Not in winter (snow). */
var GRASSGEO = null, GRASS_TRIS = 0;
function grassGeo() {
	if (GRASSGEO) { return GRASSGEO; }
	var pos = [], nor = [], colr = [], rnd = (function (s) { return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; })(4242), n = 5;
	for (var i = 0; i < n; i++) {
		var a = i / n * Math.PI * 2 + rnd() * 0.8, r0 = 0.02 + rnd() * 0.05, h = 0.07 + rnd() * 0.07, w = 0.008 + rnd() * 0.006, lean = 0.025 + rnd() * 0.05;
		var bx = Math.cos(a) * r0, bz = Math.sin(a) * r0, sx = -Math.sin(a) * w, sz = Math.cos(a) * w, tx = bx + Math.cos(a) * lean, tz = bz + Math.sin(a) * lean;
		var mx = (bx + tx) / 2 + Math.cos(a) * lean * 0.15, mz = (bz + tz) / 2 + Math.sin(a) * lean * 0.15;
		// a blade: wide base, narrower middle, a point – two triangles, lit like the lawn (normal up, leaning out)
		var P = [[bx - sx, 0, bz - sz], [bx + sx, 0, bz + sz], [mx + sx * 0.6, h * 0.55, mz + sz * 0.6], [mx - sx * 0.6, h * 0.55, mz - sz * 0.6], [tx, h, tz]];
		var T = [[0, 1, 2], [0, 2, 3], [3, 2, 4]], C = [0.42, 0.42, 0.72, 0.72, 1.0];
		var nx = Math.cos(a) * 0.35, nz = Math.sin(a) * 0.35, nl = Math.sqrt(1 + nx * nx + nz * nz);
		T.forEach(function (t) { t.forEach(function (k) { pos.push(P[k][0], P[k][1], P[k][2]); nor.push(nx / nl, 1 / nl, nz / nl); colr.push(C[k], C[k], C[k]); }); });
	}
	var g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
	g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
	g.computeBoundingSphere();
	g.userData.shared = true;
	GRASS_TRIS = pos.length / 9;
	GRASSGEO = g;
	return g;
}
var GRASSCOL = { spring: ['#5E7C33', '#7E9A43'], summer: ['#4F6A2B', '#738A3F'], autumn: ['#6F7136', '#97894A'] };
Viewer.prototype.grassFor = function () {
	var P = this.qp, hs = this.house, c = this.c || {}, season = c.season || 'summer';
	var off = !DETAIL_ON || !P || !P.grass || !hs || !hs.gardenPlan || !hs.plotBox || this.innerNow || this.thumb || season === 'winter' || (this.modeNow && this.modeNow !== 'guide');
	// the same plot, garden and level: the grass of the last build stays as it is (no rebuild)
	var gkey = off ? '' : JSON.stringify([P.level, season, hs.plotBox, hs.gardenPlan, (hs.vols || []).map(function (v) { return [v.x0, v.y0, v.x1, v.y1]; }), hs.terrace || null, hs.garage || null, c.garden_features || null, hs.movers ? hs.movers.children.map(function (o) { var m = o.userData.move || {}; return [o.userData.slot, m.cx, m.cy, m.turn]; }) : null]);
	if (gkey && gkey === this.grassKey && this.grass) { if (!this.grass.parent) { this.scene.add(this.grass); } return; }
	if (this.grass) { this.scene.remove(this.grass); this.grass.dispose(); this.grass = null; }
	this.grassKey = gkey;
	this.grassInfo = { level: P ? P.level : '', count: 0, tris: 0 };
	if (off) { return; }
	var G = hs.gardenPlan, pb = hs.plotBox, lawnOn = (c.garden_features || []).indexOf('lawn') !== -1 || !c.garden_features;
	var hard = [], R = function (r, m) { if (r) { hard.push([r.x0 - (m || 0), r.y0 - (m || 0), r.x1 + (m || 0), r.y1 + (m || 0)]); } };
	var U = function (q, m) { if (q && q.w !== undefined) { var hw = Math.max(q.w, q.d) / 2 + (m || 0); hard.push([q.cx - hw, q.cy - hw, q.cx + hw, q.cy + hw]); } };
	(hs.vols || []).forEach(function (v) { var e = (v.ext || 0) + 0.3; hard.push([v.x0 - e, v.y0 - e, v.x1 + e, v.y1 + e]); });
	R(G.path, 0.05); R(G.drive, 0.05); R(G.gravel, 0.05); R(hs.terrace, 0.1); R(hs.garage, 0.1); R(G.hedge, 0.2);
	(G.flats || []).forEach(function (f) { R(f, 0.05); });
	U(G.pool, 0.3); U(G.playground, 0.1); U(G.shed, 0.1); U(G.pergola, 0); (G.outs || []).forEach(function (q) { U(q, 0.2); });
	if (G.firepit) { hard.push([G.firepit.x - 0.8, G.firepit.y - 0.8, G.firepit.x + 0.8, G.firepit.y + 0.8]); }
	// whatever stands on the site now (moved by hand included) is kept free as it is placed
	if (hs.movers) {
		var bx = new THREE.Box3();
		hs.movers.children.forEach(function (o) { var k = (o.userData.move || {}).kind; if (k === 'tree' || k === 'plant' || k === 'person' || k === 'pet' || k === 'light') { return; } bx.setFromObject(o); if (!bx.isEmpty()) { hard.push([bx.min.x - 0.1, bx.min.z - 0.1, bx.max.x + 0.1, bx.max.z + 0.1]); } });
	}
	var free = function (x, y) { for (var i = 0; i < hard.length; i++) { var h = hard[i]; if (x > h[0] && x < h[2] && y > h[1] && y < h[3]) { return false; } } return true; };
	var bb = new THREE.Box3().setFromObject(hs.fit), cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.z + bb.max.z) / 2;
	var L0 = G.lawn, ring = 18;
	var area = Math.max(1, (L0.x1 - L0.x0) * (L0.y1 - L0.y0)) + ((L0.x1 - L0.x0) + 2 * ring) * ring * 0.9;
	var dens = Math.min(P.grassDensity, P.grass / area * 2.2);
	var rnd = (function (s) { return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; })(97 + Math.round(Math.abs(cx * 13 + cy * 7)));
	var pts = [], step = 1 / Math.sqrt(Math.max(0.05, dens));
	var x0 = L0.x0 - ring, x1 = L0.x1 + ring, y0 = L0.y0 - ring, y1 = Math.min(L0.y1, pb.front);
	for (var y = y0; y < y1 && pts.length < P.grass; y += step) {
		for (var x = x0; x < x1 && pts.length < P.grass; x += step) {
			var px = x + (rnd() - 0.5) * step, py = y + (rnd() - 0.5) * step, inLawn = px > L0.x0 && px < L0.x1 && py > L0.y0 && py < L0.y1;
			var d = Math.hypot(px - cx, py - cy), keep = (inLawn ? (lawnOn ? 1 : 0.55) : 0.3) * (1 - 0.72 * Math.min(1, Math.max(0, (d - 10) / 30)));
			if (rnd() > keep || !free(px, py)) { continue; }
			pts.push([px, py, rnd(), rnd(), inLawn]);
		}
	}
	if (!pts.length) { return; }
	var pal = GRASSCOL[season] || GRASSCOL.summer, c0 = new THREE.Color(pal[0]), c1 = new THREE.Color(pal[1]), dry = new THREE.Color('#9A8E58'), col = new THREE.Color();
	var mat = cached('grassblades', function () { return new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.92 }); });
	var im = new THREE.InstancedMesh(grassGeo(), mat, pts.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), V3 = THREE.Vector3, up = new V3(0, 1, 0);
	pts.forEach(function (p, i) {
		var s = (p[4] && lawnOn ? 0.8 : 1.25) * (0.75 + p[2] * 0.6);
		q.setFromAxisAngle(up, p[3] * 6.283);
		m4.compose(X(p[0], p[1], 0.005), q, new V3(s * 1.15, s, s * 1.15));
		im.setMatrixAt(i, m4);
		col.copy(c0).lerp(c1, p[3]); if (!p[4] || !lawnOn) { col.lerp(dry, 0.25 + p[2] * 0.25); }
		im.setColorAt(i, col);
	});
	im.castShadow = false; im.receiveShadow = true;
	im.userData.noPick = true; im.raycast = function () {};
	im.computeBoundingSphere();
	im.name = 'grass';
	this.grass = im; this.scene.add(im);
	this.grassInfo = { level: P.level, count: pts.length, tris: pts.length * GRASS_TRIS };
};
// The woods of the landscape alone (a new quality level changes how far the detailed trees reach).
// After the first picture (1.26.0): the detail is switched on in time slices – the new shaders are compiled
// in the background (compileAsync where the driver can), then woods, grass and sky are put in and drawn once.
// Until it is done, the first picture stays on screen. Resolves when the full scene is there.
var DETAIL_P = null, DETAIL_RES = null;
function detailReady() { return DETAIL_ON && !DETAIL_P ? Promise.resolve() : (DETAIL_P || (DETAIL_P = new Promise(function (r) { DETAIL_RES = r; }))); }
// The full scene, now: guide pictures (the image model gets the whole scene) and option cards wait for it.
// If the live preview has not drawn yet (hidden box), the upgrade is started here; option cards without a
// live picture after `wait` ms switch the detail on themselves (they have no grass).
function fullDetail(wait) {
	if (DETAIL_ON && !DETAIL_P) { return Promise.resolve(); }
	if (live && live.house && live.levels && !live.disposed) { if (!live.upgrading) { live.upgrade(); } return detailReady(); }
	if (!wait) { detailFlags(); return Promise.resolve(); }
	return Promise.race([detailReady(), new Promise(function (r) { setTimeout(r, wait); })]).then(function () { detailFlags(); });
}
Viewer.prototype.upgrade = function () {
	var self = this;
	if (this.upgrading || DETAIL_ON || this.thumb || !this.house) { return; }
	this.upgrading = true;
	detailReady();
	var idle = function (fn) { (window.requestIdleCallback || function (f) { return setTimeout(f, 30); })(function () { try { fn(); } catch (e) { finish(); } }, { timeout: 400 }); };
	var finish = function () { self.upgrading = false; if (DETAIL_RES) { var r = DETAIL_RES; DETAIL_RES = null; DETAIL_P = null; r(); } };
	idle(function () {
		if (self.disposed) { finish(); return; }
		// 1) the materials get their surface detail; their programs are compiled before they are used
		detailFlags();
		var scene = self.scene, c = self.c || {};
		idle(function () {
			// 2) the detailed woods and the grass, built off the visible scene
			var inner = self.innerNow, woods = null;
			if (!inner && self.house && self.house.plotBox) {
				var near = self.qp ? self.qp.treeNear : 150;
				LAND.setTreeNear(near);
				try { woods = LAND.woods(c, LAND.landKind(c), self.thumb); } finally { LAND.setTreeNear(150); }
			}
			idle(function () {
				var tmp = new THREE.Group(); if (woods) { tmp.add(woods); }
				self.grassFor(); if (self.grass) { scene.remove(self.grass); tmp.add(self.grass); }
				// compiled with the live scene's lights, fog and environment (targetScene), into the buffer the
				// viewer really draws to; meanwhile the first picture stays (no redraw with half-made shaders).
				// The house's own materials are in the scene: compileAsync(scene) prepares their new programs.
				var job = self.compileJob = {};
				var r = self.renderer, prevRT = r.getRenderTarget();
				var done = function () {
					if (self.compileJob === job) { self.compileJob = null; }
					if (woods) { while (self.treeline.children.length) { self.treeline.remove(self.treeline.children[0]); } self.treeline.add(woods); self.woodsNear = self.qp ? self.qp.treeNear : 150; self.landKey = self.landKey.replace(/\|\|([0-9.]+)$/, '|d|$1'); }
					if (self.grass) { tmp.remove(self.grass); scene.add(self.grass); }
					// the photographed sky, if it arrived meanwhile
					if (self.env.want && self.env.photo !== self.env.want && SKY.status(self.env.want) === 'ready') { self.envApply(); }
					self.shadowDirty = true;
					self.requestRender();
					finish();
				};
				var cmp = Promise.resolve();
				if (r.compileAsync) {
					r.setRenderTarget(self.composer && self.useComposer !== false ? self.composer.renderTarget1 : null);
					try { cmp = Promise.all([r.compileAsync(tmp, self.camera, scene), r.compileAsync(scene, self.camera)]); } catch (e) { cmp = Promise.resolve(); }
					r.setRenderTarget(prevRT);
				}
				cmp.then(done, done);
			});
		});
	});
};
Viewer.prototype.woodsFor = function (c) {
	var near = this.qp ? this.qp.treeNear : 150;
	this.woodsNear = near;
	while (this.treeline.children.length) { this.treeline.remove(this.treeline.children[0]); }
	LAND.setTreeNear(near);
	try { this.treeline.add(LAND.woods(c, LAND.landKind(c), this.thumb)); } finally { LAND.setTreeNear(150); }
	this.landKey = this.landKey.replace(/\|[0-9.]+$/, '|' + near);
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
	var last = 0;
	(function tick() {
		if (self.disposed) { return; }
		self.controls.update(); self.render();
		// 1.26.0: the frame times of continuous drawing drive the automatic quality level
		var now = performance.now();
		if (self.levels && last && self.interacting) { QL.frame(now - last); }
		last = now;
		if (self.interacting || performance.now() < (self.settle || 0)) { requestAnimationFrame(tick); }
		else { self.looping = false; if (self.lowDPR) { self.lowDPR = false; self.setDPR(self.prHi()); self.render(); } }
	})();
};
// First start (automatic quality, no stored result for this graphics card): a short measurement of the
// frame time once the house is on screen – a few frames drawn back to back while nothing else happens –
// picks the level. At most three rounds; the result is kept per card, so it runs once per browser.
Viewer.prototype.probe = function () {
	var self = this;
	if (!this.levels || this.probing || !QL.needsProbe() || !this.house || this.compileJob) { return; }
	this.probing = true;
	var round = function () {
		texturesReady().then(function () {
			setTimeout(function () {
				if (self.disposed || self.interacting || self.compileJob || !self.w) { self.probing = false; return; }
				// the first frame of a level pays for its shaders and buffers: not counted
				self.render(); self.renderer.getContext().finish();
				var ts = [];
				for (var i = 0; i < 6; i++) { var t0 = performance.now(); self.render(); self.renderer.getContext().finish(); ts.push(performance.now() - t0); }
				ts.sort(function (a, b) { return a - b; });
				var next = QL.probeResult(ts[2]);
				if (next) { setTimeout(round, 400); } else { self.probing = false; self.requestRender(); }
			}, 600);
		});
	};
	round();
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
	if (this.gtao) { this.gtao.enabled = !this.interacting && this.gtaoOn !== false; }
	if (this.composer && this.useComposer !== false) { this.composer.render(); } else { this.renderer.render(this.scene, this.camera); }
	this.frames = (this.frames || 0) + 1;
	// 1.26.0: the first picture is on screen – now the detail (grass, woods, surface detail, sky)
	if (!DETAIL_ON && !this.upgrading && !this.thumb && this.house && this.levels) { var selfU = this; setTimeout(function () { selfU.upgrade(); }, 0); }
	if (this.levels && this.frames > 2 && !this.probing && !this.upgrading && QL.needsProbe()) { var self = this; setTimeout(function () { self.probe(); }, 0); }
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
	if (this.onKey) { document.removeEventListener('keydown', this.onKey, true); }
	if (this.house) { disposeTree(this.house.root); }
	this.renderer.dispose();
};
// Draw-call diet: the static meshes of a group that share a material (and shadow flags) are baked into
// one mesh each. Transparent, instanced, vertex-coloured meshes and meshes carrying lights stay as they are.
function mergeStatic(group, skip) {
	var skips = Array.isArray(skip) ? skip.filter(Boolean) : (skip ? [skip] : []);
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
			if (skips.indexOf(ch) !== -1) { return; }
			// a model already merged once per material (vehicles, people, pets – 1.24.0) stays as it is
			if (ch.isMesh && ch.geometry && ch.geometry.userData && ch.geometry.userData.premerged) { return; }
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
	(function prune(o) { o.children.slice().forEach(function (ch) { if (skips.indexOf(ch) !== -1) { return; } prune(ch); if (ch.isGroup && !ch.children.length) { o.remove(ch); } }); })(group);
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
		var b = bx.clone(), s = b.getSize(new THREE.Vector3()), mv = null;
		// a piece that can be moved by hand: its box follows the piece after a drag
		for (var q = o; q && q !== root; q = q.parent) { if (q.userData && q.userData.slot) { mv = q; break; } }
		out.push({ field: o.userData.field || f, item: o.userData.item || '', box: b, vol: Math.max(0.001, s.x * s.y * s.z), mv: mv, box0: mv ? b.clone() : null, m0: mv ? mv.matrixWorld.clone() : null });
	});
	return out;
}
// The places of the openings and the chimney (1.18.0): kept before the merge, like the pick boxes.
function collectOps(root) {
	var out = [], bx = new THREE.Box3();
	root.updateMatrixWorld(true);
	root.traverse(function (o) {
		var op = o.userData && o.userData.op;
		if (!op || !op.key) { return; }
		bx.setFromObject(o);
		if (bx.isEmpty()) { return; }
		out.push({ op: op, box: bx.clone().expandByScalar(0.06) });
	});
	return out;
}
// The faces of the walls (1.21.0): where a tap in the paint mode puts the accent material.
function collectFaces(root) {
	var out = [];
	root.updateMatrixWorld(true);
	root.traverse(function (o) { var f = o.userData && o.userData.face; if (f && f.m) { out.push({ f: f, inv: new THREE.Matrix4().copy(f.m).invert() }); } });
	return out;
}
function opAt(list, p) {
	var best = null, bv = 1e9;
	(list || []).forEach(function (q) {
		if (!q.box.containsPoint(p)) { return; }
		var s = q.box.getSize(new THREE.Vector3()), v = s.x * s.y * s.z;
		if (v < bv) { bv = v; best = q; }
	});
	return best;
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
   inside the room and out of the doorway, and reported through `onLayout` so the designer can save it.
   Outside (1.18.0) the same goes for every garden piece (pool, trees, cars, people, pets, pergola …):
   each is its own group. A window or a door slides along its own wall and the chimney over its roof;
   for those a frame shows the new place and the house is rebuilt when they are let go (the wall has a
   hole). Turning: Ctrl/⌘ + sideways drag, the wheel or R; Shift puts the piece straight again
   (0/90/180/270°). While dragging, a frame says whether the place is good (green) or not (red, with the
   reason, through `onMoveState`); it is a warning, the piece can still be put down there. */
var PLACE0 = { tree_house: 2, tree_big_house: 3, pool_house: 1, op_corner: 0.6, op_gap: 0.3, chimney_ridge: 0.6 };
function snap90(rad) { return Math.round(rad / (Math.PI / 2)) * (Math.PI / 2); }
function degOf(rad) { return Math.round(((rad / D2R) % 360 + 360) % 360) % 360; }
function r3(v) { return Math.round(v * 1000) / 1000; }
// plan box around a turned rectangle (centre x, plan y = world z)
function footRect(cx, cy, w, d, rot) {
	var cs = Math.abs(Math.cos(rot || 0)), sn = Math.abs(Math.sin(rot || 0)), hw = (w * cs + d * sn) / 2, hd = (w * sn + d * cs) / 2;
	return { x0: cx - hw, x1: cx + hw, y0: cy - hd, y1: cy + hd };
}
function rectsOver(a, b, m) { m = m || 0; return a.x0 < b.x1 - m && a.x1 > b.x0 + m && a.y0 < b.y1 - m && a.y1 > b.y0 + m; }
function rectDist(a, b) { var dx = Math.max(0, b.x0 - a.x1, a.x0 - b.x1), dy = Math.max(0, b.y0 - a.y1, a.y0 - b.y1); return Math.sqrt(dx * dx + dy * dy); }
function volRect(v) { var e = v.ext || 0; return { x0: v.x0 - e, x1: v.x1 + e, y0: v.y0 - e, y1: v.y1 + e }; }
Viewer.prototype.rayFrom = function (cx, cy) {
	if (!this.el) { return null; }
	var r = this.el.getBoundingClientRect();
	if (!r.width || !r.height) { return null; }
	this.ray = this.ray || new THREE.Raycaster();
	this.ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), this.camera);
	return this.ray;
};
// Which piece is under the screen point: the top-level child of the room's furniture group.
Viewer.prototype.itemAt = function (cx, cy) {
	var hs = this.house;
	if (!hs || !hs.items || !hs.room || !hs.room.W || !this.el) { return null; }
	var ray = this.rayFrom(cx, cy);
	if (!ray) { return null; }
	var hits = ray.intersectObject(hs.items, true);
	for (var i = 0; i < hits.length; i++) {
		var o = hits[i].object;
		while (o && o.parent && o.parent !== hs.items) { o = o.parent; }
		if (o && o.parent === hs.items && o.userData && o.userData.slot) { return { obj: o, point: hits[i].point }; }
	}
	return null;
};
// Outside: the first surface under the pointer decides – a garden piece, an opening or the chimney. The
// wall, the roof, the lawn or the sky: nothing to grab, the view turns as before.
Viewer.prototype.extAt = function (cx, cy) {
	var hs = this.house;
	if (!hs || hs.room || hs.phases || !(hs.movers || hs.moversFit || (this.ops && this.ops.length))) { return null; }
	var ray = this.rayFrom(cx, cy);
	if (!ray) { return null; }
	var hits = ray.intersectObject(hs.root, true);
	for (var i = 0; i < hits.length && i < 8; i++) {
		var h = hits[i], o = h.object;
		if (!o.visible || o.isLine || o.isPoints || (o.userData && o.userData.noPick)) { continue; }
		for (var q = o; q && q !== hs.root; q = q.parent) {
			if ((hs.movers && q.parent === hs.movers) || (hs.moversFit && q.parent === hs.moversFit)) { return { type: 'mover', obj: q, point: h.point }; }
		}
		var op = opAt(this.ops, h.point);
		return op ? { type: 'op', op: op.op, point: h.point } : null;
	}
	return null;
};
// The setting a grabbed piece belongs to (the designer names it while it is being moved).
function fieldOf(o) { var f = ''; if (o) { o.traverse(function (q) { if (!f && q.userData && (q.userData.field || q.userData.item)) { f = q.userData.item || q.userData.field; } }); } return f; }
// Grab the piece under the pointer: the orbit controls stop, the piece lifts a little and follows.
Viewer.prototype.grabAt = function (cx, cy, ev) {
	if (!this.house) { return false; }
	if (this.house.phases) { return this.grabBuild(cx, cy, ev); }
	if (!this.house.room || !this.house.room.W) { return this.grabExt(cx, cy, ev); }
	var it = this.itemAt(cx, cy);
	if (!it) { return false; }
	var o = it.obj, bx = new THREE.Box3().setFromObject(o), rm = this.house.room;
	// a piece that does not stand on the floor hangs on a wall: it slides along the walls, not the floor
	var onWall = bx.min.y > 0.35;
	this.drag = {
		obj: o, slot: o.userData.slot,
		dx: o.position.x - it.point.x, dz: o.position.z - it.point.z,
		w: Math.max(0.12, bx.max.x - bx.min.x), d: Math.max(0.12, bx.max.z - bx.min.z),
		rot: o.rotation.y, startX: cx, lastX: cx, shift: !!(ev && ev.shiftKey), y0: o.position.y,
		wall: onWall, w0: onWall ? nearWall(bx, rm.W, rm.D) : -1, rot0: o.rotation.y, p0: o.position.clone()
	};
	if (!onWall) { o.position.y = this.drag.y0 + 0.012; }
	if (this.controls) { this.controls.enabled = false; }
	if (this.el) { this.el.style.cursor = 'grabbing'; }
	if (this.onGrab) { this.onGrab(o.userData.item || o.userData.field || '', this.drag.slot); }
	this.requestRender();
	return true;
};
// Paint mode (1.21.0): the face and zone under the pointer – whole wall, upper floors, gable, plinth or
// the entrance bay, from where the pointer meets the wall.
Viewer.prototype.faceAt = function (cx, cy) {
	var hs = this.house;
	if (!hs || hs.room || hs.phases || !this.faces || !this.faces.length) { return null; }
	var ray = this.rayFrom(cx, cy);
	if (!ray) { return null; }
	var hits = ray.intersectObject(hs.root, true).filter(function (h) { return h.object.visible && !h.object.isLine && !(h.object.userData && h.object.userData.noPick); });
	for (var i = 0; i < hits.length && i < 4; i++) {
		var best = null, bd = 0.2;
		for (var k = 0; k < this.faces.length; k++) {
			var F = this.faces[k], f = F.f, lp = hits[i].point.clone().applyMatrix4(F.inv), dz = Math.abs(lp.z - f.T - 0.015);
			if (lp.x < -0.05 || lp.x > f.len + 0.05 || lp.y < f.z0 - 0.05 || dz > bd) { continue; }
			bd = dz; best = { f: f, x: lp.x, y: lp.y };
		}
		if (best) {
			var f2 = best.f, y = best.y, zone = 'wall';
			if (f2.top && y > f2.h + 0.02) { zone = 'gable'; }
			else if (y < Math.max(f2.plinth + 0.35, 0.6)) { zone = 'plinth'; }
			else if (f2.door && best.x > f2.door.x - 0.75 && best.x < f2.door.x + f2.door.w + 0.75 && y < f2.plinth + f2.door.h + 0.6) { zone = 'door'; }
			else if (f2.floors > 1 && y > f2.plinth + f2.FH) { zone = 'upper'; }
			return { vi: f2.vi, face: f2.face, zone: zone, key: f2.vi + ':' + f2.face + ':' + zone, f: f2 };
		}
		if (hits[i].object.userData && hits[i].object.userData.noPick) { continue; }
		return null;
	}
	return null;
};
// The frame of the zone under the pointer in paint mode (on the wall, over everything).
Viewer.prototype.paintMark = function (hit) {
	if (!hit) { if (this.mark && this.paintOn) { this.mark.visible = false; this.paintOn = false; this.requestRender(); } return; }
	var f = hit.f, x0 = 0, x1 = f.len, y0 = 0, y1 = f.h;
	if (hit.zone === 'gable') { y0 = f.h; y1 = f.top ? Math.max.apply(null, f.top.map(function (q) { return q[1]; })) : f.h + 1; }
	else if (hit.zone === 'plinth') { y1 = Math.max(f.plinth + 0.35, 0.6); }
	else if (hit.zone === 'upper') { y0 = f.plinth + f.FH; }
	else if (hit.zone === 'door' && f.door) { x0 = Math.max(0, f.door.x - 0.75); x1 = Math.min(f.len, f.door.x + f.door.w + 0.75); }
	var g = this.markGroup();
	this.markFill.color.set('#3A7BD5'); this.markLine.color.set('#3A7BD5');
	g.position.copy(new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, f.T + 0.06).applyMatrix4(f.m));
	g.rotation.set(0, 0, 0); g.quaternion.setFromRotationMatrix(f.m);
	g.scale.set(Math.max(0.1, x1 - x0), Math.max(0.1, y1 - y0), 1);
	g.visible = true; this.paintOn = true;
	this.requestRender();
};
Viewer.prototype.grabExt = function (cx, cy, ev) {
	if (this.paint) { return false; }
	var it = this.extAt(cx, cy);
	if (!it) { if (this.sel) { this.select(null); this.requestRender(); } return false; }
	var d = { ext: true, lastX: cx, moved: false };
	if (it.type === 'mover') {
		var o = it.obj;
		d.kind = 'mover'; d.obj = o; d.slot = o.userData.slot; d.info = o.userData.move || {};
		d.dx = o.position.x - it.point.x; d.dz = o.position.z - it.point.z;
		d.p0 = o.position.clone(); d.r0 = o.rotation.y;
		o.position.y = 0.02;
		d.field = d.info.field || fieldOf(o);
	} else {
		var op = it.op;
		d.op = op; d.slot = op.key;
		if (op.kind === 'chimney') {
			d.kind = 'chimney'; d.field = 'chimney';
			d.cx = d.cx0 = op.x + op.w / 2; d.cy = d.cy0 = op.y + op.d / 2;
			d.dx = d.cx - it.point.x; d.dz = d.cy - it.point.z;
		} else {
			d.kind = 'op'; d.field = op.kind === 'door' ? 'entrance_door' : (op.kind === 'tdoor' ? 'terrace_door' : 'window_style');
			d.inv = new THREE.Matrix4().copy(op.m).invert();
			var lp = it.point.clone().applyMatrix4(d.inv);
			d.du = op.x - lp.x; d.x = d.x0 = op.x;
		}
	}
	this.drag = d;
	this.sel = null;
	if (this.controls) { this.controls.enabled = false; }
	if (this.el) { this.el.style.cursor = 'grabbing'; }
	if (this.onGrab) { this.onGrab(d.field || '', d.slot); }
	this.updateMark();
	this.requestRender();
	void ev;
	return true;
};
// Follow the pointer on the floor plane; with Ctrl/⌘ held, sideways movement turns the piece instead,
// and with Shift held the piece stands straight (0/90/180/270°).
Viewer.prototype.dragTo = function (e) {
	var d = this.drag, hs = this.house;
	if (!d || !hs || !this.el) { return; }
	if (d.ext) { this.extDragTo(e); return; }
	if (d.build) {
		var at = this.planAt(e.clientX, e.clientY, d.y, d.plane);
		if (at && this.onBuildDrag) { this.onBuildDrag(at.p, { shift: e.shiftKey }); }
		d.moved = true;
		return;
	}
	if ((e.ctrlKey || e.metaKey) && !d.wall) { this.turnDrag((e.clientX - d.lastX) * 0.5); d.lastX = e.clientX; return; }
	d.lastX = e.clientX;
	var ray = this.rayFrom(e.clientX, e.clientY);
	if (!ray) { return; }
	var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -Math.max(0, d.y0)), hit = new THREE.Vector3();
	if (!ray.ray.intersectPlane(plane, hit)) { return; }
	d.obj.position.x = hit.x + d.dx;
	d.obj.position.z = hit.z + d.dz;
	if (e.shiftKey && !d.wall) { d.obj.rotation.y = snap90(d.obj.rotation.y); }
	if (d.wall) { snapWall(d.obj, d.w0, d.rot0, hs.room.W, hs.room.D); }
	else { fitInRoom(d.obj, hs.room.W, hs.room.D); }
	this.requestRender();
};
/* Build mode (1.19.0): a wall or an opening of the drawing can be picked in the 3D construction view. The
 * build editor decides what is under the point (in plan metres, `onBuildGrab`) and moves it with the same
 * rules as on the plan (`onBuildDrag`); `markBox` shows the selection, the 3D rebuilds when it is let go. */
function shown(o) { for (var q = o; q; q = q.parent) { if (!q.visible) { return false; } } return true; }
Viewer.prototype.planAt = function (cx, cy, y, plane) {
	var ray = this.rayFrom(cx, cy), hs = this.house, o = hs && hs.origin;
	if (!ray || !o) { return null; }
	var hit = new THREE.Vector3();
	if (plane) { if (!ray.ray.intersectPlane(plane, hit)) { return null; } }
	else if (y === undefined) {
		var hits = ray.intersectObject(hs.root, true).filter(function (h) { return !h.object.isLine && shown(h.object) && !(h.object.userData && h.object.userData.noPick); });
		if (hits.length) { hit.copy(hits[0].point); }
		else if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) { return null; }
	} else if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), hit)) { return null; }
	return { p: [hit.x + o[0], hit.z + o[1]], y: hit.y };
};
Viewer.prototype.grabBuild = function (cx, cy, ev) {
	if (!this.onBuildGrab) { return false; }
	var at = this.planAt(cx, cy), R = this.ray && this.ray.ray, org = this.house.origin;
	// the ray itself in plan metres (x, y = plan, z = height): a window is a hole, the editor tests its box
	var ray = R && org ? { o: [R.origin.x + org[0], R.origin.z + org[1], R.origin.y], d: [R.direction.x, R.direction.z, R.direction.y] } : null;
	var g = at ? this.onBuildGrab(at.p, { y: at.y, shift: !!(ev && ev.shiftKey), ray: ray }) : null;
	if (!g) { return false; }
	// the drag runs on a plane through the point where the piece was taken: the editor gives a vertical one
	// (the wall's own plane for an opening, across the wall for a wall) – a horizontal plane seen at a low
	// angle turns a pixel into half a metre
	var y = g && typeof g === 'object' && isFinite(g.y) ? g.y : Math.max(0, at.y), plane = null;
	if (g && g.n && g.pt) { plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(g.n[0], 0, g.n[1]).normalize(), new THREE.Vector3(g.pt[0] - org[0], y, g.pt[1] - org[1])); }
	this.drag = { build: true, y: y, plane: plane, moved: false };
	if (this.controls) { this.controls.enabled = false; }
	if (this.el) { this.el.style.cursor = 'grabbing'; }
	return true;
};
// The selected (or held) wall / opening: a box in scene metres (centre x/z, y0…y1, length along `rot`, thickness).
Viewer.prototype.markBox = function (b) {
	if (!b) { if (this.bmark) { this.bmark.visible = false; this.requestRender(); } return; }
	if (!this.bmark) {
		var g = new THREE.Group(), fm = new THREE.MeshBasicMaterial({ color: '#2FB36B', transparent: true, opacity: 0.22, depthWrite: false, depthTest: false, fog: false });
		var lm = new THREE.LineBasicMaterial({ color: '#2FB36B', depthTest: false, transparent: true, fog: false }), bg = new THREE.BoxGeometry(1, 1, 1);
		var fill = new THREE.Mesh(bg, fm), line = new THREE.LineSegments(new THREE.EdgesGeometry(bg), lm);
		fill.renderOrder = 998; line.renderOrder = 999; fill.userData.noPick = line.userData.noPick = g.userData.noPick = true;
		g.add(fill); g.add(line); this.scene.add(g);
		this.bmark = g; this.bmarkFill = fm; this.bmarkLine = lm;
	}
	var c = b.bad ? '#E0483E' : '#2FB36B';
	this.bmarkFill.color.set(c); this.bmarkLine.color.set(c);
	this.bmark.position.set(b.x, (b.y0 + b.y1) / 2, b.z);
	this.bmark.rotation.set(0, b.rot || 0, 0);
	this.bmark.scale.set(Math.max(0.05, b.len), Math.max(0.05, b.y1 - b.y0), Math.max(0.05, b.t));
	this.bmark.visible = true;
	this.requestRender();
};
Viewer.prototype.extDragTo = function (e) {
	var d = this.drag, hs = this.house, hit = new THREE.Vector3();
	if (d.kind === 'mover' && (e.ctrlKey || e.metaKey) && !d.info.noTurn) {
		d.obj.rotation.y += (e.clientX - d.lastX) * 0.6 * D2R;
		d.lastX = e.clientX;
		if (e.shiftKey) { d.obj.rotation.y = snap90(d.obj.rotation.y); }
		d.moved = true; this.updateMark(); this.requestRender();
		return;
	}
	d.lastX = e.clientX;
	var ray = this.rayFrom(e.clientX, e.clientY);
	if (!ray) { return; }
	if (d.kind === 'mover') {
		if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) { return; }
		var pb = hs.plotBox, nx = hit.x + d.dx, nz = hit.z + d.dz;
		if (pb) { nx = clamp(nx, pb.left + 0.3, pb.right - 0.3); nz = clamp(nz, pb.back + 0.3, pb.front - 0.3); }
		d.obj.position.x = nx; d.obj.position.z = nz;
		if (e.shiftKey && !d.info.noTurn) { d.obj.rotation.y = snap90(d.obj.rotation.y); }
	} else if (d.kind === 'op') {
		// on the plane of the wall's outer face; it never leaves its own wall
		var m = d.op.m, n = new THREE.Vector3().setFromMatrixColumn(m, 2).normalize(), o0 = new THREE.Vector3(0, 0, 0.3).applyMatrix4(m);
		if (!ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(n, o0), hit)) { return; }
		var lp = hit.applyMatrix4(d.inv), nxo = lp.x + d.du;
		if (e.shiftKey) { nxo = Math.round(nxo * 10) / 10; }
		d.x = clamp(nxo, 0.06, Math.max(0.06, d.op.len - d.op.w - 0.06));
	} else {
		// the chimney slides over its roof (at the height of its top)
		if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -d.op.top), hit)) { return; }
		d.cx = clamp(hit.x + d.dx, d.op.vx0 + d.op.w / 2 + 0.15, d.op.vx1 - d.op.w / 2 - 0.15);
		d.cy = clamp(hit.z + d.dz, d.op.vy0 + d.op.d / 2 + 0.15, d.op.vy1 - d.op.d / 2 - 0.15);
	}
	d.moved = true;
	this.updateMark();
	this.requestRender();
};
// Turn the grabbed piece; it snaps to 15 degrees, and the turned piece is pushed back inside the room.
Viewer.prototype.turnDrag = function (deg) {
	var d = this.drag;
	if (!d || d.wall || d.build) { return; }
	if (d.ext) {
		if (d.kind !== 'mover' || d.info.noTurn) { return; }
		d.obj.rotation.y = Math.round((d.obj.rotation.y / D2R + deg) / 15) * 15 * D2R;
		d.moved = true; this.updateMark(); this.requestRender();
		return;
	}
	var cur = d.obj.rotation.y / D2R + deg;
	d.obj.rotation.y = Math.round(cur / 15) * 15 * D2R;
	if (this.house && this.house.room) { fitInRoom(d.obj, this.house.room.W, this.house.room.D); }
	this.requestRender();
};
// The pick boxes of a moved piece go with it (a tap on it still finds its setting).
Viewer.prototype.movePicks = function (obj) {
	if (!this.picks || !obj) { return; }
	obj.updateMatrixWorld(true);
	var m = new THREE.Matrix4();
	this.picks.forEach(function (p) {
		if (p.mv !== obj || !p.box0) { return; }
		m.copy(obj.matrixWorld).multiply(new THREE.Matrix4().copy(p.m0).invert());
		p.box = p.box0.clone().applyMatrix4(m);
	});
};
// Let go: the piece stays where it is, and the designer is told so it can be saved. `cancel` (Esc):
// the piece goes back to where it was picked up.
Viewer.prototype.dropDrag = function (cancel) {
	var d = this.drag;
	if (!d) { return; }
	if (d.ext) { this.extDrop(cancel); return; }
	if (d.build) {
		this.drag = null;
		if (this.controls) { this.controls.enabled = true; }
		if (this.el) { this.el.style.cursor = ''; }
		if (this.onBuildDrop) { this.onBuildDrop(!!cancel, d.moved); }
		return;
	}
	if (!d.wall) { d.obj.position.y = d.y0; }
	if (cancel && d.p0) { d.obj.position.copy(d.p0); d.obj.rotation.y = d.rot0; }
	this.drag = null;
	if (this.controls) { this.controls.enabled = true; }
	if (this.el) { this.el.style.cursor = ''; }
	this.movePicks(d.obj);
	if (this.onLayout && !cancel) {
		this.onLayout(d.slot, { x: r3(d.obj.position.x), y: r3(d.obj.position.z), rot: degOf(d.obj.rotation.y) });
	}
	this.requestRender();
};
Viewer.prototype.extDrop = function (cancel) {
	var d = this.drag;
	this.drag = null;
	if (this.controls) { this.controls.enabled = true; }
	if (this.el) { this.el.style.cursor = ''; }
	if (d.kind === 'mover') {
		d.obj.position.y = 0;
		if (cancel) { d.obj.position.copy(d.p0); d.obj.position.y = 0; d.obj.rotation.y = d.r0; }
		this.movePicks(d.obj);
		this.renderer.shadowMap.needsUpdate = true; this.shadowDirty = true;
		this.select({ kind: 'mover', obj: d.obj, slot: d.slot, info: d.info, field: d.field });
		if (!cancel && d.moved && this.onSite) { this.onSite(d.slot, { x: r3(d.obj.position.x), y: r3(d.obj.position.z), rot: degOf(d.obj.rotation.y) }, !!d.info.rebuild); }
	} else if (!cancel && d.moved && this.onSite) {
		// the wall's hole (or the roof's opening) moves too: the designer saves and the house is rebuilt
		this.selKey = d.slot;
		this.select(null, true);
		this.onSite(d.slot, d.kind === 'op' ? { x: r3(d.x), y: 0, rot: 0 } : { x: r3(d.cx), y: r3(d.cy), rot: 0 }, true);
	} else {
		this.select({ kind: d.kind, op: d.op, slot: d.slot, field: d.field });
	}
	this.requestRender();
};
// The last moved piece stays selected: arrows move it (10 cm, with Shift 50 cm), R turns it (15°, with
// Shift 90°), Esc lets it go. A tap on an empty spot ends the selection.
Viewer.prototype.select = function (s, keepKey) {
	this.sel = s || null;
	if (s) { this.selKey = s.slot; } else if (!keepKey) { this.selKey = null; }
	if (s) { this.updateMark(); } else { this.hideMark(); }
};
Viewer.prototype.reselect = function () {
	var k = this.selKey, hs = this.house;
	if (!k || !hs || hs.room || hs.phases) { this.select(null); return; }
	var mv = [].concat(hs.movers ? hs.movers.children : [], hs.moversFit ? hs.moversFit.children : []).filter(function (q) { return q.userData.slot === k; })[0] || null;
	if (mv) { this.select({ kind: 'mover', obj: mv, slot: k, info: mv.userData.move || {}, field: (mv.userData.move || {}).field || fieldOf(mv) }); return; }
	var op = (this.ops || []).filter(function (q) { return q.op.key === k; })[0];
	if (op) { this.select({ kind: op.op.kind === 'chimney' ? 'chimney' : 'op', op: op.op, slot: k }); return; }
	this.select(null);
};
Viewer.prototype.nudge = function (dx, dz, turn) {
	var s = this.sel;
	if (!s) { return; }
	// arrows follow the screen: up = away from the camera, right = to the right of the view
	var t = this.controls ? this.controls.target : new THREE.Vector3(), f = t.clone().sub(this.camera.position);
	f.y = 0; if (f.lengthSq() < 1e-6) { f.set(0, 0, -1); } f.normalize();
	var rt = new THREE.Vector3(-f.z, 0, f.x), mx = rt.x * dx + f.x * dz, mz = rt.z * dx + f.z * dz;
	if (s.kind === 'mover') {
		var o = s.obj, pb = this.house && this.house.plotBox;
		o.position.x += mx; o.position.z += mz;
		if (pb) { o.position.x = clamp(o.position.x, pb.left + 0.3, pb.right - 0.3); o.position.z = clamp(o.position.z, pb.back + 0.3, pb.front - 0.3); }
		if (turn && !(s.info && s.info.noTurn)) { o.rotation.y = turn === 90 ? snap90(o.rotation.y) + Math.PI / 2 : Math.round((o.rotation.y / D2R + turn) / 15) * 15 * D2R; }
		this.movePicks(o);
		this.renderer.shadowMap.needsUpdate = true; this.shadowDirty = true;
		this.updateMark(); this.requestRender();
		if (this.onSite) { this.onSite(s.slot, { x: r3(o.position.x), y: r3(o.position.z), rot: degOf(o.rotation.y) }, !!(s.info && s.info.rebuild)); }
		return;
	}
	if (turn || !this.onSite) { return; }
	this.selKey = s.slot;
	if (s.kind === 'op') {
		// along the wall: the screen direction projected on the wall's own axis
		var u = new THREE.Vector3().setFromMatrixColumn(s.op.m, 0).normalize(), du = mx * u.x + mz * u.z;
		if (!du) { return; }
		var nx = clamp(s.op.x + du, 0.06, Math.max(0.06, s.op.len - s.op.w - 0.06));
		this.onSite(s.slot, { x: r3(nx), y: 0, rot: 0 }, true);
	} else {
		var cx = clamp(s.op.x + s.op.w / 2 + mx, s.op.vx0 + s.op.w / 2 + 0.15, s.op.vx1 - s.op.w / 2 - 0.15);
		var cy = clamp(s.op.y + s.op.d / 2 + mz, s.op.vy0 + s.op.d / 2 + 0.15, s.op.vy1 - s.op.d / 2 - 0.15);
		this.onSite(s.slot, { x: r3(cx), y: r3(cy), rot: 0 }, true);
	}
};
// Is the place good? Rules from the placement package (assets/data/rules/hu.json → boot `place`), as
// warnings: inside the plot, not on the house, terrace or garage, pool and trees away from the house,
// pieces not on one another; openings away from the corner and from each other; the chimney near the ridge.
Viewer.prototype.checkPlace = function (d) {
	var hs = this.house, P = Object.assign({}, PLACE0, this.place || {});
	var bad = function (code, v) { return { ok: false, code: code, v: v }; };
	if (!hs || !d) { return { ok: true }; }
	if (d.kind === 'mover') {
		var k = d.info.kind || 'site', o = d.obj, fp = footRect(o.position.x, o.position.z, d.info.w || 1, d.info.d || 1, o.rotation.y);
		var A = hs.gardenPlan && hs.gardenPlan.area;
		if (A && (fp.x0 < A.x0 - 0.3 || fp.x1 > A.x1 + 0.3 || fp.y0 < A.y0 - 0.3 || fp.y1 > A.y1 + 0.3)) { return bad('place_out_plot'); }
		var vols = hs.vols || [];
		if (vols.some(function (v) { return rectsOver(fp, volRect(v), 0.02); })) { return bad('place_on_house'); }
		var soft = k === 'person' || k === 'pet' || k === 'furniture' || k === 'light';
		if (!soft && hs.terrace && rectsOver(fp, hs.terrace, 0.05)) { return bad('place_on_terrace'); }
		if (hs.garage && k !== 'garage' && k !== 'vehicle' && k !== 'person' && k !== 'pet' && rectsOver(fp, hs.garage, 0.05)) { return bad('place_on_garage'); }
		var dh = vols.reduce(function (m, v) { return Math.min(m, rectDist(fp, volRect(v))); }, 1e9);
		if (k === 'pool' && dh < P.pool_house - 1e-6) { return bad('place_pool_house', P.pool_house); }
		if (k === 'tree') { var lim = (d.info.size || 0) >= 6 ? P.tree_big_house : P.tree_house; if (dh < lim - 1e-6) { return bad('place_tree_house', lim); } }
		var light = function (q) { return q === 'person' || q === 'pet' || q === 'light'; };
		var core = footRect(o.position.x, o.position.z, (d.info.w || 1) * 0.8, (d.info.d || 1) * 0.8, o.rotation.y);
		var clash = (hs.movers ? hs.movers.children : []).some(function (q) {
			if (q === o) { return false; }
			var qi = q.userData.move || {};
			if (light(k) && light(qi.kind)) { return false; }
			return rectsOver(core, footRect(q.position.x, q.position.z, (qi.w || 1) * 0.8, (qi.d || 1) * 0.8, q.rotation.y), 0);
		});
		return clash ? bad('place_overlap') : { ok: true };
	}
	if (d.kind === 'op') {
		var op = d.op, x = this.drag === d ? d.x : op.x;
		if (x < P.op_corner - 1e-6 || x + op.w > op.len - P.op_corner + 1e-6) { return bad('place_op_corner', P.op_corner); }
		var near = (this.ops || []).some(function (q) {
			var b = q.op;
			if (b === op || b.m !== op.m || b.y > op.y + op.h || b.y + b.h < op.y) { return false; }
			return x < b.x + b.w + P.op_gap - 1e-6 && x + op.w > b.x - P.op_gap + 1e-6;
		});
		return near ? bad('place_op_gap', P.op_gap) : { ok: true };
	}
	var c2 = d.op, cx = this.drag === d ? d.cx : c2.x + c2.w / 2, cy = this.drag === d ? d.cy : c2.y + c2.d / 2;
	if (c2.type && c2.type !== 'flat' && c2.type !== 'shed') {
		var off = c2.ridge === 'y' ? Math.abs(cx - (c2.vx0 + c2.vx1) / 2) : Math.abs(cy - (c2.vy0 + c2.vy1) / 2);
		if (off > P.chimney_ridge + 1e-6) { return bad('place_chimney_ridge', P.chimney_ridge); }
	}
	return { ok: true };
};
// The frame of the dragged or selected piece: on the ground under a garden piece, on the wall around an
// opening, on top of the chimney. Drawn over everything, never picked, never in a guide picture.
Viewer.prototype.markGroup = function () {
	if (this.mark) { return this.mark; }
	var g = new THREE.Group(), fm = new THREE.MeshBasicMaterial({ color: '#2FB36B', transparent: true, opacity: 0.24, depthWrite: false, depthTest: false, side: THREE.DoubleSide, fog: false });
	var lm = new THREE.LineBasicMaterial({ color: '#2FB36B', depthTest: false, transparent: true, fog: false });
	var fill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fm), sq = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.5, -0.5, 0), new THREE.Vector3(0.5, -0.5, 0), new THREE.Vector3(0.5, 0.5, 0), new THREE.Vector3(-0.5, 0.5, 0)]);
	var line = new THREE.LineLoop(sq, lm);
	fill.renderOrder = 998; line.renderOrder = 999; fill.userData.noPick = line.userData.noPick = g.userData.noPick = true;
	g.add(fill); g.add(line); g.visible = false;
	this.scene.add(g);
	this.mark = g; this.markFill = fm; this.markLine = lm;
	return g;
};
Viewer.prototype.updateMark = function () {
	var d = this.drag || this.sel;
	if (!d || !this.scene) { this.hideMark(); return; }
	var g = this.markGroup(), st = this.checkPlace(d), colr = st.ok ? '#2FB36B' : '#E0483E';
	this.markFill.color.set(colr); this.markLine.color.set(colr);
	if (d.kind === 'mover') {
		g.position.set(d.obj.position.x, 0.07, d.obj.position.z);
		g.rotation.set(-Math.PI / 2, d.obj.rotation.y, 0, 'YXZ');
		g.scale.set((d.info.w || 1) + 0.2, (d.info.d || 1) + 0.2, 1);
	} else if (d.kind === 'op') {
		var op = d.op, x = this.drag === d ? d.x : op.x;
		g.position.copy(new THREE.Vector3(x + op.w / 2, op.y + op.h / 2, 0.36).applyMatrix4(op.m));
		g.rotation.set(0, 0, 0); g.quaternion.setFromRotationMatrix(op.m);
		g.scale.set(op.w + 0.14, op.h + 0.14, 1);
	} else {
		var c2 = d.op, cx = this.drag === d ? d.cx : c2.x + c2.w / 2, cy = this.drag === d ? d.cy : c2.y + c2.d / 2;
		g.position.set(cx, c2.top + 0.14, cy);
		g.rotation.set(-Math.PI / 2, 0, 0, 'YXZ');
		g.scale.set(c2.w + 0.25, c2.d + 0.25, 1);
	}
	g.visible = true;
	this.lastPlace = st;
	if (this.onMoveState) { this.onMoveState(st, d.slot, !!this.drag); }
};
Viewer.prototype.hideMark = function () {
	if (this.mark) { this.mark.visible = false; }
	this.lastPlace = null;
	if (this.onMoveState) { this.onMoveState(null); }
};
// Screen point (CSS pixels) → the setting of the part under it.
Viewer.prototype.pickAt = function (cx, cy) {
	if (!this.picks || !this.picks.length || !this.el) { return null; }
	var r = this.el.getBoundingClientRect();
	if (!r.width || !r.height) { return null; }
	var ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
	this.ray = this.ray || new THREE.Raycaster();
	this.ray.setFromCamera(ndc, this.camera);
	var hits = this.ray.intersectObject(this.scene, true).filter(function (h) { return h.object && h.object.visible && !h.object.isLine && !h.object.userData.noPick; });
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
var VER = (function () { try { return new URL(import.meta.url).search || 'dev'; } catch (e) { return 'dev'; } })();
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
					// 1.26.0: the photographed sky of the card is waited for, so a kept picture never has the painted one by chance
					if (!go.sky) { go.sky = 1; Promise.all([skyReady(cfg), fullDetail(6000)]).then(go); return; }
					try {
						var v = sharedThumb();
						v.setSize(w, h);
						v.update(cfg, mode || 'mini');
						// the pixels of new materials come from the texture workers; new shaders compile in parallel
						if (!v.rtA || v.rtA.width !== w || v.rtA.height !== h) { thumbPixels.prep(v, w, h); }
						texturesReady().then(function () { return v.compileFor(v.scene, v.rtA); }).then(function () {
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
// garden: the terrace side from the other front corner, lower; evening uses the hero picture (1.17.0)
var GUIDE_CAM = { front: [0, 8], back: [180, 8], left: [270, 8], right: [90, 8], aerial: [36, 42], garden: [-38, 10] };
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
	var job = Promise.all([texturesReady(), skyReady(base), fullDetail()]).then(function () { return texturesReady(); }).then(function () {
		// the live view may still show the painted sky if the photograph arrived a moment ago
		if (live.env.want && live.env.photo !== live.env.want && SKY.status(live.env.want) === 'ready') { live.envApply(); }
	});
	if (exact) {
		// exactly the visitor's own view: the live camera, only the picture shape differs
		job = job.then(function () {
			return step(function (res) {
				var cam = live.camera, keep = cam.aspect, mk = live.mark && live.mark.visible;
				if (mk) { live.mark.visible = false; }
				cam.aspect = w / h; cam.updateProjectionMatrix();
				if (!live.rtA || live.rtA.width !== w || live.rtA.height !== h) { thumbPixels.prep(live, w, h); }
				out.hero = thumbPixels(live, w, h);
				if (mk) { live.mark.visible = true; }
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
				v.compileFor(v.scene, v.rtA).then(res);
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
				v.compileFor(v.scene, v.rtA).then(function () {
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
/* ------------------------------------------------------------------ build mode hook
 * „Építés az alapoktól”: agh-3d-build.js registers a scene builder for the 'build' mode and gets the
 * shared helpers (same three.js instance, same materials cache). Unused, nothing here changes. */
var BUILD_SCENE = null;
var H3 = { THREE: THREE, X: X, box: box, boxGeo: boxGeo, pbr: pbr, solid: solid, glassMat: glassMat, frameMat: frameMat, House: House, SK: SK };

/* ------------------------------------------------------------------ 1.26.0: quality control and benchmark */
// The visitor's quality choice: a small menu in the corner of the live preview (texts from the loader
// configuration, window.AGH_LOADER.q3d). "Automatic" lets the frame time decide.
function qualityMenu(v) {
	var T = (window.AGH_LOADER && window.AGH_LOADER.q3d) || null;
	if (!v.levels || !v.wrap || v.qmenu || !T) { return; }
	var sel = document.createElement('select');
	sel.className = 'agh-3d-quality';
	sel.setAttribute('aria-label', T.label || '');
	sel.title = T.label || '';
	sel.style.cssText = 'position:absolute;z-index:3;right:12px;bottom:54px;max-width:min(190px, calc(100% - 24px));height:30px;padding:0 8px;border:0;border-radius:999px;background:rgba(255,255,255,.9);color:#1E2226;font:inherit;font-size:12px;box-shadow:0 4px 12px rgba(18,24,34,.2);cursor:pointer;';
	[['auto', T.auto], ['low', T.low], ['medium', T.medium], ['high', T.high], ['ultra', T.ultra]].forEach(function (o) {
		var op = document.createElement('option'); op.value = o[0]; op.textContent = (T.label ? T.label + ': ' : '') + (o[1] || o[0]); sel.appendChild(op);
	});
	// "automatic" says which level it is on now
	var sync = function () { var s = QL.state(); sel.value = s.choice === 'auto' || s.choice === 'bench' ? 'auto' : s.choice; if (sel.options[0]) { sel.options[0].textContent = (T.label ? T.label + ': ' : '') + (T.auto || 'auto') + (s.choice === 'auto' ? ' (' + (T[s.level] || s.level) + ')' : ''); } };
	sel.addEventListener('change', function () { QL.choose(sel.value); sync(); });
	// a press on the menu must not turn the view or pick a piece of the model
	['pointerdown', 'wheel', 'keydown'].forEach(function (ev) { sel.addEventListener(ev, function (e) { e.stopPropagation(); }); });
	QL.onChange(sync);
	sync();
	v.wrap.appendChild(sel);
	v.qmenu = sel;
}
// The built-in benchmark (admin → "3D teljesítményteszt", or ?agh_bench=1 on the designer page): the same
// sample house at every level; per level the time to the first finished picture, frame time p50/p95 and
// frames per second while the camera circles the house (each frame waited for with gl.finish(), so the
// screen's refresh rate does not cap it), triangles and draw calls of a frame, GPU memory objects.
// cfg: the house (the plugin's defaults); opts.frames (default 60), opts.levels, opts.onProgress(level, i, n).
function bench(container, cfg, opts) {
	opts = opts || {};
	// outside the designer (admin page) its stylesheet is missing: the canvas box fills the stage by itself
	var lv = liveViewer();
	if (!lv.wrap.style.position) { lv.wrap.style.cssText = 'position:absolute;inset:0;'; lv.el.style.display = 'block'; }
	var v = attach(container, cfg), gl = v.renderer.getContext(), levels = opts.levels || QL.LEVELS, n = Math.max(4, opts.frames || 60);
	var out = {
		tool: 'AutoGroweHome 3D benchmark', version: VER.replace(/^\?ver=/, ''), date: new Date().toISOString(),
		gpu: QL.gpuInfo(gl), userAgent: navigator.userAgent, screen: { w: screen.width, h: screen.height, dpr: window.devicePixelRatio || 1 },
		canvas: { w: v.w, h: v.h }, webgl2: true, maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE), levels: {}, auto: null
	};
	var before = QL.state().level, info = v.renderer.info, px = new Uint8Array(4);
	// reading one pixel back makes the CPU wait until the GPU has really drawn the frame (gl.finish() is
	// not reliable for that in every browser)
	var frame = function () { info.reset(); var t0 = performance.now(); v.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return performance.now() - t0; };
	var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
	// the benchmark measures the full scene: the staged detail is switched on first
	var job = fullDetail();
	levels.forEach(function (l, li) {
		job = job.then(function () {
			QL.pin(l);
			if (opts.onProgress) { opts.onProgress(l, li, levels.length); }
			info.autoReset = false;
			var t0 = performance.now(), tb = 0, tc = 0;
			v.memo = null; v.update(Object.assign({}, cfg, { _bench: l }));
			v.fitCamera(true);
			tb = performance.now() - t0;
			return Promise.all([texturesReady(), skyReady(cfg)]).then(function () { if (v.env.want && v.env.photo !== v.env.want) { v.envApply(); } tc = performance.now(); return v.compileFor(v.scene); }).then(function () {
				v.compileJob = null;
				tc = performance.now() - tc;
				frame();
				var first = performance.now() - t0, calls = info.render.calls, tris = info.render.triangles;
				var ts = [], tgt = v.controls.target.clone(), off = v.camera.position.clone().sub(tgt), ax = new THREE.Vector3(0, 1, 0);
				for (var i = 0; i < n; i++) {
					off.applyAxisAngle(ax, Math.PI * 2 / n);
					v.camera.position.copy(tgt).add(off); v.camera.lookAt(tgt);
					ts.push(frame());
				}
				var s = ts.slice().sort(function (a, b) { return a - b; }), mean = ts.reduce(function (a, b) { return a + b; }, 0) / ts.length;
				var r1 = function (x) { return Math.round(x * 10) / 10; };
				var mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
				out.levels[l] = {
					first_ms: Math.round(first), build_ms: Math.round(tb), compile_ms: Math.round(tc), fps: r1(1000 / mean), p50_ms: r1(s[Math.floor(s.length * 0.5)]), p95_ms: r1(s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]),
					triangles: tris, draw_calls: calls, grass_triangles: v.grassInfo ? v.grassInfo.tris : 0, pixel_ratio: r1(v.renderer.getPixelRatio()), shadow_map: v.sun.shadow.mapSize.x,
					ao: !!(v.gtao && v.gtaoOn), sky: v.env.photo || 'painted', geometries: info.memory.geometries, textures: info.memory.textures, js_heap_mb: mem
				};
				info.autoReset = true;
				return wait(50);
			});
		});
	});
	return job.then(function () {
		QL.pin(null);
		// what the automatic choice would be on this machine: the fastest level whose p95 stays under 33 ms
		var pickL = 'low';
		QL.LEVELS.forEach(function (l) { var r = out.levels[l]; if (r && r.p95_ms <= 33) { pickL = l; } });
		out.auto = { recommended: pickL, current: QL.state().level, before: before };
		v.memo = null; v.update(cfg); v.fitCamera(true); v.requestRender();
		return out;
	}, function (e) { info.autoReset = true; QL.pin(null); throw e; });
}
var api = {
	attach: function (container, cfg, opts) { var v = attach(container, cfg, opts); try { qualityMenu(v); } catch (e) { /* the menu is optional */ } return v; },
	thumb: thumb, warmup: warmup, supported: supported, viewer: function () { return live; }, texturesReady: texturesReady, guides: guides, version: 'r170-3',
	registerBuild: function (fn) { BUILD_SCENE = fn; }, helpers: function () { return H3; },
	// 1.26.0: quality levels (profile() is the "quality profile" later effects read), the photographed
	// skies (paintedSky(true) forces the painted sky of 1.24.0) and the benchmark
	quality: QL.api,
	sky: { pick: SKY.pick, status: SKY.status, load: SKY.load, manifest: SKY.manifest, current: function () { return live ? { photo: live.env.photo, want: live.env.want } : null; } },
	paintedSky: function (on) { NO_PHOTO = !!on; if (live && live.c) { live.envApply(); live.requestRender(); } },
	bench: bench,
	// resolves once the staged detail (grass, detailed woods, surface detail) is in the scene
	detailReady: function () { return fullDetail(); },
	_shq: SHQ
};
window.AGH_3D = api;
export default api;
