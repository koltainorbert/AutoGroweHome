/*!
 * AutoGroweHome – „Élő fotó”: the AGH hybrid renderer of the 3D preview (1.27.0).
 * Koltai Norbert – Infostudio
 *
 * While the view moves, the preview stays the fast raster picture of agh-3d.js. When the camera stops
 * and the scene does not change, a progressive path tracer (three-gpu-pathtracer, MIT) starts on the
 * very same scene in the background: real light bounces, reflections, soft light. Its samples are
 * gathered at a lower resolution, smoothed by an edge-aware filter, scaled up and faded in over the
 * raster picture (the raster frame is the starting point, never a black picture). The first movement
 * or scene change switches back to the raster picture in the same frame.
 * „Fotó készítése”: the same path tracer renders a large still with many samples and downloads it as
 * a PNG – locally, on the visitor's own machine, nothing is invented.
 *
 * Loading: this module is imported by agh-3d.js only after the first 3D picture; the path tracer
 * (vendor/three-gpu-pathtracer + vendor/three-mesh-bvh, ~200 KB) only when it is first needed. The
 * BVH is built in a worker (agh-3d-photo-bvh.js) once per scene change; the scene geometry is baked
 * into one world-space buffer in small slices, so the page never stalls.
 * Any failure (no float render targets, old browser, shader error): silent fallback to the raster.
 */
import * as THREE from './vendor/three/three.module.min.js';
import { FullScreenQuad } from './vendor/three/jsm/postprocessing/Pass.js';

var VER = (function () { try { return new URL(import.meta.url).search || ''; } catch (e) { return ''; } })();
var LS_KEY = 'agh_live_photo';
var SETTLE_MS = 650;      // the camera must stand still this long before the path tracer starts
var FADE_MS = 700;        // cross-fade from the raster picture to the path traced one
var LIB = null;
function lib() {
	if (!LIB) {
		LIB = Promise.all([
			import('./vendor/three-gpu-pathtracer/three-gpu-pathtracer.min.js'),
			import('./vendor/three-mesh-bvh/three-mesh-bvh.min.js')
		]).then(function (m) { return { PT: m[0], BVH: m[1] }; });
		LIB.catch(function () { LIB = null; });
	}
	return LIB;
}
function lsGet() { try { var v = window.localStorage.getItem(LS_KEY); return v === null ? null : v === 'true'; } catch (e) { return null; } }
function lsSet(on) { try { window.localStorage.setItem(LS_KEY, on ? 'true' : 'false'); } catch (e) { /* storage unavailable */ } }
function now() { return performance.now(); }

/* ------------------------------------------------------------------ fingerprints
 * Cheap hashes of what the path tracer depends on, computed on every raster frame (a few hundred
 * numbers): geometry (meshes, their matrices, materials assigned), material properties and texture
 * versions, lights and sky, camera and drawing buffer size. Each part triggers only its own update. */
function Hash() { this.h = 2166136261 | 0; }
Hash.prototype.n = function (x) {
	var q = Math.round((+x || 0) * 4096);
	this.h = (Math.imul(this.h ^ (q | 0), 16777619) + ((q / 4294967296) | 0)) | 0;
	return this;
};
Hash.prototype.m = function (m4) { var e = m4.elements; for (var i = 0; i < 16; i++) { this.n(e[i]); } return this; };
Hash.prototype.v = function () { return (this.h >>> 0).toString(36); };
var TEX_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap', 'aoMap'];
function usable(m) { return !!m && m.visible !== false && !!m.isMeshStandardMaterial && m.depthTest !== false; }
// The meshes the path tracer sees: visible, on the camera's layers, standard materials only (markers,
// invisible framing boxes and helper overlays are left out).
function collect(v) {
	var list = [], cam = v.camera;
	v.scene.traverseVisible(function (o) {
		if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) { return; }
		if (!o.layers.test(cam.layers)) { return; }
		if (o.isInstancedMesh && !o.count) { return; }
		var mats = Array.isArray(o.material) ? o.material : [o.material];
		for (var i = 0; i < mats.length; i++) { if (!usable(mats[i])) { return; } }
		list.push(o);
	});
	return list;
}
function keysOf(v, list) {
	var g = new Hash(), mh = new Hash(), lh = new Hash(), ch = new Hash(), seen = {};
	v.scene.updateMatrixWorld();
	list.forEach(function (o) {
		var geo = o.geometry;
		g.n(o.id).n(geo.id).n(geo.attributes.position.version).n(geo.index ? geo.index.version : -1).m(o.matrixWorld);
		if (o.isInstancedMesh) { g.n(o.count).n(o.instanceMatrix.version).n(o.instanceColor ? o.instanceColor.version + 1 : 0); }
		(Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
			g.n(m.id);
			if (seen[m.id]) { return; }
			seen[m.id] = 1;
			mh.n(m.id).n(m.version).n(m.color ? m.color.getHex() : 0).n(m.roughness).n(m.metalness).n(m.opacity).n(m.emissive ? m.emissive.getHex() : 0).n(m.emissiveIntensity).n(m.transparent ? 1 : 0).n(m.side);
			TEX_KEYS.forEach(function (k) { var t = m[k]; if (t && t.isTexture) { mh.n(t.id).n(t.version); } });
		});
	});
	v.scene.traverseVisible(function (o) {
		if (!o.isLight || !(o.intensity > 0)) { return; }
		lh.n(o.id).n(o.intensity).n(o.color.getHex()).m(o.matrixWorld);
		if (o.target) { lh.m(o.target.matrixWorld); }
		if (o.isPointLight || o.isSpotLight) { lh.n(o.distance).n(o.decay); }
	});
	var sc = v.scene, bg = sc.background, env = sc.environment;
	lh.n(bg ? (bg.isColor ? bg.getHex() : bg.id) : 0).n(bg && bg.isTexture ? bg.version : 0).n(env ? env.id : 0).n(sc.environmentIntensity).n(v.exposure);
	var r = v.renderer, sz = r.getDrawingBufferSize(new THREE.Vector2());
	v.camera.updateMatrixWorld();
	ch.m(v.camera.matrixWorld).m(v.camera.projectionMatrix).n(sz.x).n(sz.y);
	var k = { geo: g.v() + ':' + list.length, mat: mh.v(), light: lh.v(), cam: ch.v() };
	k.all = [k.geo, k.mat, k.light, k.cam].join('|');
	return k;
}

/* ------------------------------------------------------------------ geometry bake
 * Every mesh (instances expanded) into one world-space buffer with the attributes the path tracer
 * reads: normal, tangent, uv, colour and the material index. A generator: the caller runs it in slices
 * of a few milliseconds. Instance colours and the terrain's per-vertex tint become vertex colours. */
function tangentsGen(g) {
	return (function* () {
		var P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, I = g.index, vc = P.count, n = I ? I.count : vc;
		var t1 = new Float32Array(vc * 3), t2 = new Float32Array(vc * 3);
		for (var k = 0; k + 2 < n; k += 3) {
			var a = I ? I.getX(k) : k, b = I ? I.getX(k + 1) : k + 1, c = I ? I.getX(k + 2) : k + 2;
			var x1 = P.getX(b) - P.getX(a), y1 = P.getY(b) - P.getY(a), z1 = P.getZ(b) - P.getZ(a);
			var x2 = P.getX(c) - P.getX(a), y2 = P.getY(c) - P.getY(a), z2 = P.getZ(c) - P.getZ(a);
			var s1 = U.getX(b) - U.getX(a), v1 = U.getY(b) - U.getY(a), s2 = U.getX(c) - U.getX(a), v2 = U.getY(c) - U.getY(a);
			var d = s1 * v2 - s2 * v1;
			if (Math.abs(d) < 1e-12) { continue; }
			var r = 1 / d;
			var sx = (v2 * x1 - v1 * x2) * r, sy = (v2 * y1 - v1 * y2) * r, sz = (v2 * z1 - v1 * z2) * r;
			var tx = (s1 * x2 - s2 * x1) * r, ty = (s1 * y2 - s2 * y1) * r, tz = (s1 * z2 - s2 * z1) * r;
			[a, b, c].forEach(function (q) { t1[q * 3] += sx; t1[q * 3 + 1] += sy; t1[q * 3 + 2] += sz; t2[q * 3] += tx; t2[q * 3 + 1] += ty; t2[q * 3 + 2] += tz; });
			if (k % 24000 === 0) { yield; }
		}
		var out = new Float32Array(vc * 4);
		for (var q = 0; q < vc; q++) {
			var nx = N.getX(q), ny = N.getY(q), nz = N.getZ(q), ax = t1[q * 3], ay = t1[q * 3 + 1], az = t1[q * 3 + 2];
			var dn = nx * ax + ny * ay + nz * az;
			ax -= nx * dn; ay -= ny * dn; az -= nz * dn;
			var len = Math.sqrt(ax * ax + ay * ay + az * az);
			if (len < 1e-9) { continue; }
			ax /= len; ay /= len; az /= len;
			var cx = ny * az - nz * ay, cy = nz * ax - nx * az, cz = nx * ay - ny * ax;
			out[q * 4] = ax; out[q * 4 + 1] = ay; out[q * 4 + 2] = az;
			out[q * 4 + 3] = (cx * t2[q * 3] + cy * t2[q * 3 + 1] + cz * t2[q * 3 + 2]) < 0 ? -1 : 1;
			if (q % 30000 === 0) { yield; }
		}
		return out;
	})();
}
function bakeGen(list, clones) {
	return (function* () {
		var ents = [], nv = 0, ni = 0;
		list.forEach(function (o) {
			var g = o.geometry, pos = g.attributes.position, cnt = o.isInstancedMesh ? o.count : 1;
			var ic = g.index ? g.index.count : pos.count, ds = Math.max(0, g.drawRange.start || 0), dc = g.drawRange.count;
			var i1 = Math.min(ic, dc === Infinity ? ic : ds + dc), n = Math.max(0, i1 - ds);
			n -= n % 3;
			if (!n || !cnt) { return; }
			ents.push({ o: o, g: g, cnt: cnt, vc: pos.count, i0: ds, ic: n });
			nv += pos.count * cnt; ni += n * cnt;
		});
		var P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), T = new Float32Array(nv * 4), U = new Float32Array(nv * 2), C = new Float32Array(nv * 4), I = new Uint32Array(ni), MI = new Uint16Array(nv);
		var mats = [], mIdx = new Map(), tanCache = new Map();
		// material slot of a mesh's material; a copy with vertex colours where instance colours or the tint need them
		function slot(m, vc) {
			var key = vc && !m.vertexColors ? m : null, mm = m;
			if (key) {
				mm = clones.get(m);
				if (!mm) { mm = m.clone(); mm.vertexColors = true; clones.set(m, mm); }
			}
			if (!mIdx.has(mm)) { mIdx.set(mm, mats.length); mats.push(mm); }
			return mIdx.get(mm);
		}
		var M4 = new THREE.Matrix4(), IM = new THREE.Matrix4(), NM = new THREE.Matrix3(), vec = new THREE.Vector3(), nrm = new THREE.Vector3(), tan = new THREE.Vector3(), ic3 = new THREE.Color();
		var vb = 0, ib = 0;
		for (var e = 0; e < ents.length; e++) {
			var en = ents[e], o = en.o, g = en.g, A = g.attributes, pa = A.position, na = A.normal, ua = A.uv, ta = A.tangent || null;
			var ml = Array.isArray(o.material) ? o.material : [o.material];
			var tint = A.tint && A.tint.itemSize >= 3 ? A.tint : null;
			var vca = A.color && ml[0].vertexColors ? A.color : null;
			var useVC = !!(tint || (o.isInstancedMesh && o.instanceColor) || vca);
			var s0 = slot(ml[0], useVC), groupSlots = null;
			if (ml.length > 1 && g.groups.length) { groupSlots = ml.map(function (m) { return slot(m, useVC); }); }
			var tanArr = null;
			if (!ta && na && ua && ml.some(function (m) { return !!m.normalMap; })) {
				tanArr = tanCache.get(g);
				if (!tanArr) { tanArr = yield* tangentsGen(g); tanCache.set(g, tanArr); }
			}
			for (var c = 0; c < en.cnt; c++) {
				M4.copy(o.matrixWorld);
				if (o.isInstancedMesh) { o.getMatrixAt(c, IM); M4.multiply(IM); }
				NM.getNormalMatrix(M4);
				var flip = M4.determinant() < 0, cr = 1, cg = 1, cb = 1;
				if (o.isInstancedMesh && o.instanceColor) { o.getColorAt(c, ic3); cr = ic3.r; cg = ic3.g; cb = ic3.b; }
				for (var q = 0; q < en.vc; q++) {
					var d = vb + q;
					vec.fromBufferAttribute(pa, q).applyMatrix4(M4);
					P[d * 3] = vec.x; P[d * 3 + 1] = vec.y; P[d * 3 + 2] = vec.z;
					if (na) { nrm.fromBufferAttribute(na, q).applyNormalMatrix(NM); } else { nrm.set(0, 1, 0); }
					N[d * 3] = nrm.x; N[d * 3 + 1] = nrm.y; N[d * 3 + 2] = nrm.z;
					if (ta || tanArr) {
						var tw;
						if (ta) { tan.fromBufferAttribute(ta, q); tw = ta.itemSize > 3 ? ta.getW(q) : 1; } else { tan.set(tanArr[q * 4], tanArr[q * 4 + 1], tanArr[q * 4 + 2]); tw = tanArr[q * 4 + 3]; }
						if (tan.lengthSq() > 0) { tan.transformDirection(M4); }
						T[d * 4] = tan.x; T[d * 4 + 1] = tan.y; T[d * 4 + 2] = tan.z; T[d * 4 + 3] = flip ? -tw : tw;
					}
					if (ua) { U[d * 2] = ua.getX(q); U[d * 2 + 1] = ua.getY(q); }
					if (tint) { C[d * 4] = tint.getX(q); C[d * 4 + 1] = tint.getY(q); C[d * 4 + 2] = tint.getZ(q); }
					else if (vca) { C[d * 4] = vca.getX(q) * cr; C[d * 4 + 1] = vca.getY(q) * cg; C[d * 4 + 2] = vca.getZ(q) * cb; }
					else { C[d * 4] = cr; C[d * 4 + 1] = cg; C[d * 4 + 2] = cb; }
					C[d * 4 + 3] = 1;
					MI[d] = s0;
					if ((q & 4095) === 4095) { yield; }
				}
				var ix = g.index;
				for (var k = 0; k < en.ic; k += 3) {
					var a0 = ix ? ix.getX(en.i0 + k) : en.i0 + k, a1 = ix ? ix.getX(en.i0 + k + 1) : en.i0 + k + 1, a2 = ix ? ix.getX(en.i0 + k + 2) : en.i0 + k + 2;
					I[ib + k] = vb + a0;
					I[ib + k + 1] = vb + (flip ? a2 : a1);
					I[ib + k + 2] = vb + (flip ? a1 : a2);
					if ((k % 12000) === 0) { yield; }
				}
				if (groupSlots) {
					g.groups.forEach(function (gr) {
						var sl = groupSlots[gr.materialIndex] !== undefined ? groupSlots[gr.materialIndex] : s0;
						for (var k2 = gr.start; k2 < gr.start + gr.count && k2 < en.i0 + en.ic; k2++) { MI[vb + (ix ? ix.getX(k2) : k2)] = sl; }
					});
				}
				vb += en.vc; ib += en.ic;
			}
		}
		var geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
		geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
		geo.setAttribute('tangent', new THREE.BufferAttribute(T, 4));
		geo.setAttribute('uv', new THREE.BufferAttribute(U, 2));
		geo.setAttribute('color', new THREE.BufferAttribute(C, 4));
		geo.setAttribute('materialIndex', new THREE.BufferAttribute(mats.length <= 255 ? new Uint8Array(MI) : MI, 1));
		geo.setIndex(new THREE.BufferAttribute(I, 1));
		return { geometry: geo, materials: mats, tris: ni / 3, verts: nv };
	})();
}
// Runs a generator in slices of `budget` ms (the page stays responsive); resolves with its result,
// or null when alive() says the job is no longer wanted.
function slices(gen, alive, budget) {
	return new Promise(function (res, rej) {
		function step() {
			if (!alive()) { res(null); return; }
			var t0 = now();
			try {
				while (now() - t0 < budget) { var r = gen.next(); if (r.done) { res(r.value); return; } }
			} catch (e) { rej(e); return; }
			setTimeout(step, 0);
		}
		step();
	});
}

/* ------------------------------------------------------------------ sky for the path tracer
 * The path tracer importance-samples an equirectangular environment from its pixel data. The scene's
 * own equirect sky (the painted CanvasTexture, or an HDRI DataTexture when one is set) is used as it
 * is; a picture without pixel data is read into a small linear half-float copy. Without any equirect
 * sky: a two-colour gradient from the hemisphere light. */
var ENV_CACHE = { key: '', tex: null };
function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function envFrom(src) {
	var W = 256, H = 128, cv = document.createElement('canvas');
	cv.width = W; cv.height = H;
	var x = cv.getContext('2d', { willReadFrequently: true });
	x.drawImage(src.image, 0, 0, W, H);
	var d = x.getImageData(0, 0, W, H).data, out = new Uint16Array(W * H * 4), srgb = src.colorSpace === THREE.SRGBColorSpace, lut = new Uint16Array(256);
	for (var i = 0; i < 256; i++) { lut[i] = THREE.DataUtils.toHalfFloat(srgb ? srgbToLinear(i / 255) : i / 255); }
	var one = THREE.DataUtils.toHalfFloat(1);
	for (var y = 0; y < H; y++) {
		for (var xx = 0; xx < W; xx++) {
			var si = (y * W + xx) * 4, di = ((H - 1 - y) * W + xx) * 4;
			out[di] = lut[d[si]]; out[di + 1] = lut[d[si + 1]]; out[di + 2] = lut[d[si + 2]]; out[di + 3] = one;
		}
	}
	return dataEnv(out, W, H);
}
function dataEnv(data, W, H) {
	var t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
	t.mapping = THREE.EquirectangularReflectionMapping; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
	t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
	return t;
}
function gradientEnv(top, bottom) {
	var W = 32, H = 16, out = new Uint16Array(W * H * 4);
	for (var y = 0; y < H; y++) {
		var c = y >= H / 2 ? top : bottom;
		for (var x = 0; x < W; x++) { var i = (y * W + x) * 4; out[i] = THREE.DataUtils.toHalfFloat(c.r); out[i + 1] = THREE.DataUtils.toHalfFloat(c.g); out[i + 2] = THREE.DataUtils.toHalfFloat(c.b); out[i + 3] = THREE.DataUtils.toHalfFloat(1); }
	}
	return dataEnv(out, W, H);
}
function envFor(v) {
	var sc = v.scene, env = sc.environment, bg = sc.background, eq = THREE.EquirectangularReflectionMapping, src = null;
	if (env && env.isDataTexture && env.mapping === eq) { src = env; }
	else if (bg && bg.isTexture && bg.mapping === eq) { src = bg; }
	var key = src ? src.uuid + ':' + src.version : 'hemi:' + (v.hemi ? v.hemi.color.getHex() + ':' + v.hemi.groundColor.getHex() : '');
	if (ENV_CACHE.key === key) { return ENV_CACHE.tex; }
	var tex;
	if (src && src.image && src.image.data) { tex = src; }
	else if (src && src.image && src.image.width) { tex = envFrom(src); }
	else { tex = gradientEnv(v.hemi ? v.hemi.color.clone() : new THREE.Color(0.7, 0.8, 0.9), v.hemi ? v.hemi.groundColor.clone() : new THREE.Color(0.3, 0.3, 0.25)); }
	if (ENV_CACHE.tex && ENV_CACHE.tex !== tex && ENV_CACHE.tex !== src && ENV_CACHE.tex.isDataTexture && !ENV_CACHE.tex.userData.foreign) { ENV_CACHE.tex.dispose(); }
	if (tex === src) { tex.userData.foreign = true; }
	ENV_CACHE.key = key; ENV_CACHE.tex = tex;
	return tex;
}

/* ------------------------------------------------------------------ display
 * One pass: the path traced buffer (linear, lower resolution) is tone mapped like the raster picture
 * (three's neutral curve, the viewer's exposure, sRGB), smoothed by an edge-aware (bilateral) filter
 * that also scales it up, and mixed over the captured raster frame. */
var VS = 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }';
var FS = [
	'uniform sampler2D tPT;',
	'uniform sampler2D tRaster;',
	'uniform float uOpacity;',
	'uniform float uExposure;',
	'uniform float uSigmaS;',
	'uniform float uSigmaR;',
	'varying vec2 vUv;',
	'vec3 aghNeutral( vec3 color ) {',
	'	const float StartCompression = 0.8 - 0.04;',
	'	const float Desaturation = 0.15;',
	'	float x = min( color.r, min( color.g, color.b ) );',
	'	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;',
	'	color -= offset;',
	'	float peak = max( color.r, max( color.g, color.b ) );',
	'	if ( peak < StartCompression ) return color;',
	'	float d = 1. - StartCompression;',
	'	float newPeak = 1. - d * d / ( peak + d - StartCompression );',
	'	color *= newPeak / peak;',
	'	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );',
	'	return mix( color, vec3( newPeak ), g );',
	'}',
	'vec3 aghDisp( vec3 c ) {',
	'	c = clamp( aghNeutral( max( c, vec3( 0.0 ) ) * uExposure ), 0.0, 1.0 );',
	'	return mix( pow( c, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), c * 12.92, vec3( lessThanEqual( c, vec3( 0.0031308 ) ) ) );',
	'}',
	'void main() {',
	'	ivec2 sz = textureSize( tPT, 0 );',
	'	ivec2 mx = sz - 1;',
	'	vec2 p = vUv * vec2( sz ) - 0.5;',
	'	vec2 fl = floor( p );',
	'	vec2 f = p - fl;',
	'	ivec2 b = ivec2( fl );',
	'	vec3 c0 = aghDisp( texelFetch( tPT, clamp( ivec2( vUv * vec2( sz ) ), ivec2( 0 ), mx ), 0 ).rgb );',
	'	float inv2s = 0.5 / ( uSigmaS * uSigmaS );',
	'	float inv2r = uSigmaR > 0.0 ? 0.5 / ( uSigmaR * uSigmaR ) : 0.0;',
	'	float lim = 9.0 * uSigmaS * uSigmaS + 0.5;',
	'	vec3 acc = vec3( 0.0 );',
	'	float ws = 0.0;',
	'	for ( int j = -2; j <= 3; j ++ ) {',
	'		for ( int i = -2; i <= 3; i ++ ) {',
	'			vec2 d = vec2( float( i ), float( j ) ) - f;',
	'			float dd = dot( d, d );',
	'			if ( dd > lim ) continue;',
	'			vec3 raw = texelFetch( tPT, clamp( b + ivec2( i, j ), ivec2( 0 ), mx ), 0 ).rgb;',
	'			if ( any( isnan( raw ) ) || any( isinf( raw ) ) ) continue;',
	'			vec3 c = aghDisp( raw );',
	'			vec3 dc = c - c0;',
	'			float w = exp( - dd * inv2s - dot( dc, dc ) * inv2r );',
	'			acc += c * w;',
	'			ws += w;',
	'		}',
	'	}',
	'	vec3 col = ws > 0.0 ? acc / ws : c0;',
	'	vec3 ras = texture2D( tRaster, vUv ).rgb;',
	'	gl_FragColor = vec4( mix( ras, col, uOpacity ), 1.0 );',
	'}'
].join('\n');
function makeQuad() {
	var dummy = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
	dummy.needsUpdate = true;
	var mat = new THREE.ShaderMaterial({
		uniforms: { tPT: { value: null }, tRaster: { value: dummy }, uOpacity: { value: 0 }, uExposure: { value: 1 }, uSigmaS: { value: 1 }, uSigmaR: { value: 0.2 } },
		vertexShader: VS, fragmentShader: FS, depthTest: false, depthWrite: false, toneMapped: false
	});
	var q = new FullScreenQuad(mat);
	q.dummy = dummy;
	return q;
}

function gpuName(r) {
	try { var gl = r.getContext(), d = gl.getExtension('WEBGL_debug_renderer_info'); return String(d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); } catch (e) { return ''; }
}

/* ------------------------------------------------------------------ controller */
function Photo(v) {
	this.v = v;
	var q = v.quality, coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
	// a software renderer (no GPU: SwiftShader, llvmpipe) counts as a weak machine
	this.gpu = gpuName(v.renderer);
	this.soft = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(this.gpu);
	this.strong = (q === 'high' || q === 'ultra') && !coarse && !this.soft;
	var st = lsGet();
	this.on = st === null ? this.strong : st;
	this.state = this.on ? 'wait' : 'off';
	this.reason = '';
	this.tok = 0;
	this.built = { geo: '', mat: '', light: '', cam: '' };
	this.opacity = 0; this.fadeT0 = 0; this.lastChange = now(); this.calls = 1; this.lastTick = 0;
	this.cfg = {
		target: this.strong ? 160 : 64,           // live samples
		scale: 0.5,                               // live path tracing resolution (of the drawing buffer)
		bounces: 3,
		photoLong: this.strong ? 1920 : 1280,     // „Fotó készítése”: long side in pixels
		photoSamples: this.strong ? 96 : 48,
		photoBounces: 5,
		textureSize: this.strong ? 512 : 256
	};
	this.stats = { bakeMs: 0, bvhMs: 0, bvhWorkerMs: 0, tris: 0, verts: 0, builds: 0, worker: '' };
	this.uis = []; this.log = []; this.job = null;
	this.inDraw = false; this.paintAt = 0;
}
// moving, compiling, dragging a piece – or a selection / paint marker on screen, which must stay visible
Photo.prototype.moving = function () { var v = this.v; return !!(v.interacting || v.looping || v.compileJob || v.drag || (v.mark && v.mark.visible) || (v.bmark && v.bmark.visible)); };
Photo.prototype.visible = function () {
	var v = this.v;
	if (typeof document !== 'undefined' && document.visibilityState === 'hidden') { return false; }
	return !!(v.el && v.el.isConnected && v.w > 0 && v.el.getClientRects().length);
};
Photo.prototype.note = function (kind) {
	this.log.push({ k: kind, t: now(), i: !!this.v.interacting });
	if (this.log.length > 400) { this.log.splice(0, 200); }
};
// Called by Viewer.render() after every raster frame (agh-3d.js).
Photo.prototype.frame = function () {
	if (this.inDraw) { return; }
	this.note('raster');
	if (this.job) { return; }
	if (!this.on && !this.opacity) { return; }
	if (this.moving()) { this.halt(false); this.arm(); return; }
	var k = keysOf(this.v, collect(this.v));
	var ref = this.state === 'prep' ? this.prepKey : this.shownKey;
	if (k.all !== ref) { this.halt(false); this.arm(); return; }
	if (this.opacity > 0) { this.draw(); }
	else { this.arm(); }
};
// Back to the raster picture at once (redraw: also ask the viewer for a raster frame).
Photo.prototype.halt = function (redraw) {
	var was = this.opacity > 0;
	this.tok++;
	if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
	this.opacity = 0; this.fadeT0 = 0; this.lastChange = now(); this.shownKey = ''; this.prepKey = '';
	if (this.state !== 'unsupported' && !this.job) { this.state = this.on ? 'wait' : 'off'; }
	this.paint();
	if (redraw && was && !this.v.disposed) { this.v.requestRender(); }
};
Photo.prototype.arm = function () {
	var self = this;
	if (!this.on || this.timer || this.job || this.state === 'unsupported' || this.state === 'prep' || this.state === 'trace' || this.state === 'done') { return; }
	this.timer = setTimeout(function () { self.timer = 0; self.check(); }, 160);
};
Photo.prototype.check = function () {
	if (!this.on || this.job || this.v.disposed || this.state === 'unsupported') { return; }
	// hidden (another tab, the plan instead of the 3D): no polling – the next raster frame arms again
	if (!this.visible()) { this.lastChange = now(); return; }
	if (this.moving()) { this.lastChange = now(); this.arm(); return; }
	if (now() - this.lastChange < SETTLE_MS) { this.arm(); return; }
	this.begin();
};
// Loads the path tracer, brings it up to date with the scene (only the parts that changed) and starts
// gathering samples over the captured raster frame.
Photo.prototype.begin = function () {
	var self = this, tok = ++this.tok, v = this.v;
	this.state = 'prep'; this.paint();
	var alive = function () { return tok === self.tok && !v.disposed; };
	this.prepare(alive).then(function (ok) {
		if (!ok || !alive()) { return; }
		if (self.moving() || v.compileJob) { self.halt(false); self.arm(); return; }
		// the starting picture: a fresh raster frame, copied before it reaches the screen
		self.inDraw = true;
		try { v.render(); self.capture(); } finally { self.inDraw = false; }
		var k = keysOf(v, collect(v));
		if (k.all !== self.prepKey) { self.halt(false); self.arm(); return; }
		self.shownKey = k.all;
		self.state = 'trace'; self.opacity = 0; self.fadeT0 = 0;
		self.pt.renderScale = self.cfg.scale; self.pt.bounces = self.cfg.bounces;
		self.pt.reset();
		self.paint();
		self.loop(tok);
	}, function (e) { self.fail(e); });
};
Photo.prototype.fail = function (e) {
	this.state = 'unsupported';
	this.reason = String((e && e.message) || e || 'error');
	this.opacity = 0;
	this.paint();
};
Photo.prototype.prepare = function (alive) {
	var self = this, v = this.v, list = collect(v), k = keysOf(v, list);
	this.prepKey = k.all;
	return lib().then(function (L) {
		if (!alive()) { return false; }
		if (!self.pt) { self.create(L); }
		var p = Promise.resolve(true);
		if (k.geo !== self.built.geo) {
			// the bake and the BVH do not depend on the camera: a turn of the view does not throw them away,
			// only a newer scene does
			if (!self.building || self.building.key !== k.geo) {
				var bt = self.buildTok = (self.buildTok || 0) + 1, bj = { key: k.geo };
				bj.p = self.build(L, list, k, function () { return !v.disposed && self.buildTok === bt; });
				var done = function () { if (self.building === bj) { self.building = null; } };
				bj.p.then(done, done);
				self.building = bj;
			}
			p = self.building.p;
		}
		return p.then(function (ok) {
			if (!ok || !alive()) { return false; }
			var pt = self.pt;
			if (k.mat !== self.built.mat) { self.syncClones(); pt.updateMaterials(); self.built.mat = k.mat; }
			if (k.light !== self.built.light) { self.syncScene(); pt.updateEnvironment(); pt.updateLights(); self.built.light = k.light; }
			if (k.cam !== self.built.cam) { pt.setCamera(v.camera); self.built.cam = k.cam; }
			return true;
		});
	});
};
Photo.prototype.create = function (L) {
	var r = this.v.renderer;
	if (!r.capabilities.isWebGL2) { throw new Error('WebGL2 missing'); }
	if (!r.extensions.has('EXT_color_buffer_float')) { throw new Error('EXT_color_buffer_float missing (no float render targets)'); }
	var pt = new L.PT.WebGLPathTracer(r);
	pt.renderToCanvas = false; pt.rasterizeScene = false; pt.renderDelay = 0; pt.minSamples = 1; pt.fadeDuration = 0;
	pt.dynamicLowRes = false; pt.synchronizeRenderSize = true; pt.renderScale = this.cfg.scale;
	// transmissiveBounces stays at the library's 10: the random-number texture has bounces +
	// transmissiveBounces + 5 rows, and below ~16 rows the shader reads past it (measured: 3 + 4 left 12 %
	// of the pixels black for good)
	pt.tiles.set(2, 2); pt.bounces = this.cfg.bounces; pt.filterGlossyFactor = 0.5;
	pt.textureSize.set(this.cfg.textureSize, this.cfg.textureSize);
	this.pt = pt;
	this.quad = makeQuad();
	this.proxy = new THREE.Scene();
};
// Material copies with vertex colours follow their originals (colour, roughness, textures…).
Photo.prototype.syncClones = function () {
	var list = this.pt && this.pt._materials;
	if (!list || !this.cloneOf) { return; }
	this.cloneOf.forEach(function (orig, cl) { cl.copy(orig); cl.vertexColors = true; });
};
// The path tracer's own scene: copies of the lights (sun, lamps…) and the sky of the live scene.
Photo.prototype.syncScene = function () {
	var v = this.v, sc = v.scene, px = this.proxy;
	px.clear();
	sc.updateMatrixWorld();
	sc.traverseVisible(function (o) {
		if (!o.isLight || !(o.intensity > 0)) { return; }
		var l = null, wp = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
		if (o.isDirectionalLight) { l = new THREE.DirectionalLight(o.color, o.intensity); px.add(l.target); l.target.position.setFromMatrixPosition(o.target.matrixWorld); }
		else if (o.isSpotLight) { l = new THREE.SpotLight(o.color, o.intensity, o.distance, o.angle, o.penumbra, o.decay); px.add(l.target); l.target.position.setFromMatrixPosition(o.target.matrixWorld); }
		else if (o.isPointLight) { l = new THREE.PointLight(o.color, o.intensity, o.distance, o.decay); l.radius = 0.04; }
		if (!l) { return; }
		l.position.copy(wp);
		px.add(l);
	});
	var env = envFor(v), bg = sc.background;
	px.environment = env;
	px.environmentIntensity = sc.environmentIntensity !== undefined ? sc.environmentIntensity : 1;
	px.background = bg && (bg.isColor || (bg.isTexture && bg.mapping === THREE.EquirectangularReflectionMapping)) ? bg : env;
	px.backgroundIntensity = sc.backgroundIntensity !== undefined ? sc.backgroundIntensity : 1;
	px.backgroundBlurriness = sc.backgroundBlurriness || 0;
	if (sc.backgroundRotation) { px.backgroundRotation.copy(sc.backgroundRotation); }
	if (sc.environmentRotation) { px.environmentRotation.copy(sc.environmentRotation); }
	px.updateMatrixWorld(true);
};
// Geometry bake (in slices) + BVH (in the worker) + upload to the path tracer.
Photo.prototype.build = function (L, list, k, alive) {
	var self = this, v = this.v, t0 = now(), clones = new Map();
	return slices(bakeGen(list, clones), alive, 8).then(function (res) {
		if (!res || !alive()) { return false; }
		self.stats.bakeMs = Math.round(now() - t0); self.stats.tris = res.tris; self.stats.verts = res.verts;
		var t1 = now();
		return self.bvh(L, res.geometry).then(function (bvh) {
			if (!alive()) { return false; }
			self.stats.bvhMs = Math.round(now() - t1); self.stats.builds++;
			self.cloneOf = new Map(); clones.forEach(function (cl, orig) { self.cloneOf.set(cl, orig); });
			self.syncScene();
			self.pt._updateFromResults(self.proxy, v.camera, { materials: res.materials, geometry: res.geometry, bvh: bvh, bvhChanged: true });
			self.geom = res.geometry; self.bvhObj = bvh; self.flat = null;
			self.built = { geo: k.geo, mat: k.mat, light: k.light, cam: k.cam };
			return true;
		});
	});
};
Photo.prototype.bvh = function (L, geo) {
	var self = this, opts = { strategy: L.BVH.SAH, maxLeafTris: 1, indirect: true };
	function local() {
		var t = now(), b = new L.BVH.MeshBVH(geo, opts);
		self.stats.bvhWorkerMs = Math.round(now() - t); self.stats.worker = 'main';
		return b;
	}
	if (this.worker === undefined) {
		try { this.worker = typeof Worker === 'undefined' ? false : new Worker(new URL('./agh-3d-photo-bvh.js' + VER, import.meta.url), { type: 'module' }); } catch (e) { this.worker = false; }
	}
	if (!this.worker) { return Promise.resolve(local()); }
	var w = this.worker, id = (this.jobId = (this.jobId || 0) + 1);
	return new Promise(function (res) {
		w.onmessage = function (e) {
			var d = e.data;
			if (d.id !== id) { return; }
			if (d.error) { res(local()); return; }
			self.stats.bvhWorkerMs = Math.round(d.ms); self.stats.worker = 'worker';
			res(L.BVH.MeshBVH.deserialize({ roots: d.roots, index: null, indirectBuffer: d.indirectBuffer }, geo, { setIndex: false, indirect: true }));
		};
		w.onerror = function (e) { if (e && e.preventDefault) { e.preventDefault(); } self.worker = false; res(local()); };
		w.postMessage({ id: id, position: geo.attributes.position.array.slice(), index: geo.index.array.slice(), options: opts });
	});
};
// The raster frame just drawn becomes the background of the cross-fade: blitted from the canvas into
// an RGBA target (a blit may convert formats, the canvas has no alpha channel; it also resolves a
// multisampled canvas).
Photo.prototype.capture = function () {
	var r = this.v.renderer, gl = r.getContext(), sz = r.getDrawingBufferSize(new THREE.Vector2());
	if (!this.rasterRT || this.rasterRT.width !== sz.x || this.rasterRT.height !== sz.y) {
		if (this.rasterRT) { this.rasterRT.dispose(); }
		this.rasterRT = new THREE.WebGLRenderTarget(sz.x, sz.y, { type: THREE.UnsignedByteType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
		r.setRenderTarget(this.rasterRT); r.setRenderTarget(null);   // allocates the target
	}
	var fb = r.properties.get(this.rasterRT).__webglFramebuffer;
	r.setRenderTarget(null);
	gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
	gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fb);
	gl.blitFramebuffer(0, 0, sz.x, sz.y, 0, 0, sz.x, sz.y, gl.COLOR_BUFFER_BIT, gl.NEAREST);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);   // what three.js believes is bound
	this.rasterTex = this.rasterRT.texture;
};
Photo.prototype.sigmas = function (s, full) {
	s = Math.max(1, s);
	return full ? [0.75, Math.min(0.25, Math.max(0.02, 0.22 / Math.sqrt(s / 4)))] : [1.0, Math.min(0.32, Math.max(0.03, 0.3 / Math.sqrt(s / 2)))];
};
// Draws the path traced picture (over the raster frame, with the current fade) to the canvas.
Photo.prototype.draw = function (o) {
	o = o || {};
	var v = this.v, r = v.renderer, u = this.quad.material.uniforms, sg = this.sigmas(this.pt.samples, false);
	u.tPT.value = this.pt.target.texture;
	u.tRaster.value = this.rasterTex || this.quad.dummy;
	u.uOpacity.value = o.opacity !== undefined ? o.opacity : this.opacity;
	u.uExposure.value = v.exposure;
	u.uSigmaS.value = o.sigmaS !== undefined ? o.sigmaS : sg[0];
	u.uSigmaR.value = o.sigmaR !== undefined ? o.sigmaR : sg[1];
	r.setRenderTarget(null);
	this.quad.render(r);
	this.note('photo');
};
Photo.prototype.loop = function (tok) {
	var self = this, v = this.v, pt = this.pt;
	function tick(ts) {
		self.raf = 0;
		if (tok !== self.tok || v.disposed || self.job) { return; }
		if (self.moving() || !self.visible()) { self.halt(true); self.arm(); return; }
		var k = keysOf(v, collect(v));
		if (k.all !== self.shownKey) { self.halt(true); self.arm(); return; }
		// one tile per call; more calls per frame while frames stay fast
		var dt = self.lastTick ? ts - self.lastTick : 16;
		self.lastTick = ts;
		if (dt < 20 && self.calls < 6) { self.calls++; } else if (dt > 34 && self.calls > 1) { self.calls--; }
		for (var i = 0; i < self.calls && pt.samples < self.cfg.target; i++) { pt.renderSample(); }
		if (pt.samples >= 2) {
			if (!self.fadeT0) { self.fadeT0 = ts; }
			self.opacity = Math.min(1, (ts - self.fadeT0) / FADE_MS);
		}
		if (self.opacity > 0) { self.draw(); }
		self.paint();
		if (pt.samples < self.cfg.target || self.opacity < 1) { self.raf = requestAnimationFrame(tick); }
		else { self.state = 'done'; self.paint(true); }
	}
	this.lastTick = 0;
	this.raf = requestAnimationFrame(tick);
};
Photo.prototype.setLive = function (on) {
	on = !!on;
	lsSet(on);
	this.on = on;
	if (this.job) { this.paint(true); return; }
	if (!on) { this.halt(true); this.state = 'off'; }
	else if (this.state !== 'unsupported') { this.state = 'wait'; this.lastChange = now() - SETTLE_MS; this.arm(); }
	this.paint(true);
};

/* ------------------------------------------------------------------ „Fotó készítése” */
Photo.prototype.takePhoto = function (opts) {
	if (this.job) { return this.job.promise; }
	var self = this, v = this.v, o = Object.assign({}, this.cfg, opts || {}), t0 = now();
	this.halt(true);
	var job = this.job = { s: 0, n: o.photoSamples, cancel: false };
	this.state = 'photo'; this.paint(true);
	var alive = function () { return !job.cancel && !v.disposed; };
	job.promise = this.prepare(alive).then(function (ok) {
		if (!ok) { throw new Error(job.cancel ? 'cancel' : 'prepare'); }
		var pt = self.pt, r = v.renderer, asp = v.camera.aspect || 1.5, Lg = Math.min(o.photoLong, r.capabilities.maxTextureSize, 4096);
		var W = asp >= 1 ? Lg : Math.round(Lg * asp), H = asp >= 1 ? Math.round(Lg / asp) : Lg;
		job.w = W; job.h = H;
		pt.synchronizeRenderSize = false;
		pt._pathTracer.setSize(W, H);
		pt.tiles.set(Math.max(1, Math.ceil(W / 384)), Math.max(1, Math.ceil(H / 384)));
		pt.bounces = o.photoBounces;
		pt.reset();
		return new Promise(function (res, rej) {
			var per = 1, last = 0;
			function step(ts) {
				if (!alive()) { rej(new Error('cancel')); return; }
				ts = ts || now();
				var dt = last ? ts - last : 16; last = ts;
				if (dt < 22 && per < 16) { per++; } else if (dt > 40 && per > 1) { per--; }
				for (var i = 0; i < per && pt.samples < job.n; i++) { pt.renderSample(); }
				job.s = Math.floor(pt.samples);
				self.paint();
				if (pt.samples >= job.n) { res(); return; }
				if (document.visibilityState === 'hidden') { setTimeout(step, 16); } else { requestAnimationFrame(step); }
			}
			step();
		});
	}).then(function () {
		return self.encode(job.w, job.h);
	}).then(function (blob) {
		job.ms = Math.round(now() - t0);
		self.lastPhoto = { w: job.w, h: job.h, samples: job.n, bytes: blob ? blob.size : 0, ms: job.ms };
		if (blob && !(opts && opts.noDownload)) { download(blob); }
		return blob;
	});
	job.promise.then(restore, restore);
	function restore() {
		var pt = self.pt;
		if (pt) { pt.synchronizeRenderSize = true; pt.tiles.set(2, 2); pt.bounces = self.cfg.bounces; }
		self.built.cam = '';
		self.job = null;
		if (self.state !== 'unsupported') { self.state = self.on ? 'wait' : 'off'; }
		self.lastChange = now();
		self.paint(true);
		if (!v.disposed) { v.requestRender(); }
		self.arm();
	}
	job.promise.catch(function (e) { if (String(e && e.message) !== 'cancel' && String(e && e.message) !== 'prepare') { self.reason = String((e && e.message) || e); } });
	return job.promise;
};
Photo.prototype.cancelPhoto = function () { if (this.job) { this.job.cancel = true; } };
Photo.prototype.dispose = function () {
	this.tok++; this.on = false;
	if (this.job) { this.job.cancel = true; }
	if (this.timer) { clearTimeout(this.timer); this.timer = 0; }
	if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
	if (this.worker) { try { this.worker.terminate(); } catch (e) {} this.worker = false; }
	if (this.rasterRT) { this.rasterRT.dispose(); this.rasterRT = null; this.rasterTex = null; }
};
// The finished buffer, filtered at full size, read back as a PNG.
Photo.prototype.encode = function (W, H) {
	var r = this.v.renderer, u = this.quad.material.uniforms, sg = this.sigmas(this.pt.samples, true);
	var rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, depthBuffer: false });
	u.tPT.value = this.pt.target.texture; u.tRaster.value = this.quad.dummy; u.uOpacity.value = 1; u.uExposure.value = this.v.exposure;
	u.uSigmaS.value = sg[0]; u.uSigmaR.value = sg[1];
	var prev = r.getRenderTarget();
	r.setRenderTarget(rt); this.quad.render(r); r.setRenderTarget(prev);
	var px = new Uint8Array(W * H * 4);
	r.readRenderTargetPixels(rt, 0, 0, W, H, px);
	rt.dispose();
	var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
	var ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), row = W * 4;
	for (var y = 0; y < H; y++) { img.data.set(px.subarray((H - 1 - y) * row, (H - y) * row), y * row); }
	ctx.putImageData(img, 0, 0);
	return new Promise(function (res) { if (cv.toBlob) { cv.toBlob(res, 'image/png'); } else { res(null); } });
};
function download(blob) {
	var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
	var name = 'autogrowehome-foto-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '.png';
	var a = document.createElement('a'), url = URL.createObjectURL(blob);
	a.href = url; a.download = name; a.style.display = 'none';
	document.body.appendChild(a); a.click(); a.remove();
	setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
}

/* ------------------------------------------------------------------ measurement (tests, benchmark) */
Photo.prototype.info = function () {
	var pt = this.pt;
	return {
		on: this.on, state: this.state, reason: this.reason, samples: pt ? pt.samples : 0, target: this.cfg.target, opacity: this.opacity,
		lib: !!LIB, stats: Object.assign({}, this.stats), photo: this.lastPhoto || null,
		job: this.job ? { s: this.job.s, n: this.job.n } : null,
		ptSize: pt ? [pt._pathTracer._primaryTarget.width, pt._pathTracer._primaryTarget.height] : null
	};
};
// Blocks of the picture that lie on one flat surface (rays through the block hit the same plane with
// the same material; walls preferred), in drawing-buffer pixels – where the noise is measured.
Photo.prototype.flatBlocks = function (bs) {
	if (!this.bvhObj) { return []; }
	bs = bs || 8;
	var v = this.v, r = v.renderer, sz = r.getDrawingBufferSize(new THREE.Vector2()), rc = new THREE.Raycaster(), mi = this.geom.attributes.materialIndex, out = [];
	function hit(px, py) {
		rc.setFromCamera(new THREE.Vector2(px / sz.x * 2 - 1, py / sz.y * 2 - 1), v.camera);
		return this.bvhObj.raycastFirst(rc.ray, THREE.DoubleSide);
	}
	for (var y = bs; y + bs < sz.y - bs; y += bs) {
		for (var x = bs; x + bs < sz.x - bs; x += bs) {
			var pts = [[x + 1, y + 1], [x + bs - 2, y + 1], [x + 1, y + bs - 2], [x + bs - 2, y + bs - 2], [x + bs / 2, y + bs / 2]], hs = [], ok = true;
			for (var i = 0; i < pts.length && ok; i++) { var hh = hit.call(this, pts[i][0], pts[i][1]); if (!hh) { ok = false; } else { hs.push(hh); } }
			if (!ok) { continue; }
			var n0 = hs[0].face.normal, m0 = mi.getX(hs[0].face.a), p0 = hs[0].point;
			for (var j = 1; j < hs.length && ok; j++) {
				if (hs[j].face.normal.dot(n0) < 0.999 || mi.getX(hs[j].face.a) !== m0 || Math.abs(hs[j].point.clone().sub(p0).dot(n0)) > 0.01) { ok = false; }
			}
			if (ok) { out.push({ x: x, y: y, w: bs, h: bs, wall: Math.abs(n0.y) < 0.5 }); }
		}
	}
	var walls = out.filter(function (b) { return b.wall; });
	return walls.length >= 6 ? walls : out;
};
// Draws one variant to the canvas and reads it back in the same task (the drawing buffer is not
// preserved): 'raster' – the captured raster frame, 'raw' – the path traced samples without the
// filter, 'final' – what the visitor sees at full fade.
Photo.prototype.grab = function (kind) {
	var v = this.v, r = v.renderer, gl = r.getContext(), sz = r.getDrawingBufferSize(new THREE.Vector2());
	if (!this.pt || !this.rasterTex) { return null; }
	this.inDraw = true;
	if (kind === 'raster') { this.draw({ opacity: 0 }); }
	else if (kind === 'raw') { this.draw({ opacity: 1, sigmaS: 0.1, sigmaR: 0 }); }   // nearest sample, no filter
	else { this.draw({ opacity: 1 }); }
	var px = new Uint8Array(sz.x * sz.y * 4);
	gl.readPixels(0, 0, sz.x, sz.y, gl.RGBA, gl.UNSIGNED_BYTE, px);
	if (this.opacity > 0) { this.draw(); } else { this.draw({ opacity: 0 }); }
	this.inDraw = false;
	return { w: sz.x, h: sz.y, px: px };
};
// Noise: the spread of the brightness difference of neighbouring pixels inside flat blocks (mean of
// the per-block standard deviations, 0–255 scale); plus the mean difference from the raster frame.
Photo.prototype.measure = function () {
	if (!this.flat) { this.flat = this.flatBlocks(8); }
	var blocks = this.flat, ras = this.grab('raster'), raw = this.grab('raw'), fin = this.grab('final');
	if (!ras || !raw || !fin) { return null; }
	function lum(im, x, y) { var i = (y * im.w + x) * 4; return 0.2126 * im.px[i] + 0.7152 * im.px[i + 1] + 0.0722 * im.px[i + 2]; }
	function noise(im) {
		if (!blocks.length) { return -1; }
		var tot = 0;
		blocks.forEach(function (b) {
			var s = 0, s2 = 0, n = 0;
			for (var y = b.y; y < b.y + b.h; y++) { for (var x = b.x; x < b.x + b.w - 1; x++) { var d = lum(im, x + 1, y) - lum(im, x, y); s += d; s2 += d * d; n++; } }
			var m = s / n; tot += Math.sqrt(Math.max(0, s2 / n - m * m));
		});
		return tot / blocks.length;
	}
	var diff = 0, N = ras.w * ras.h;
	for (var i = 0; i < N * 4; i += 4) { diff += Math.abs(fin.px[i] - ras.px[i]) + Math.abs(fin.px[i + 1] - ras.px[i + 1]) + Math.abs(fin.px[i + 2] - ras.px[i + 2]); }
	return { samples: this.pt.samples, blocks: blocks.length, noiseRaster: noise(ras), noiseRaw: noise(raw), noiseFinal: noise(fin), diffRaster: diff / (N * 3) };
};

/* ------------------------------------------------------------------ toolbar
 * „Élő fotó” switch, „Fotó készítése” button and a status pill (samples / target), built into a slot
 * the designer (and the build mode's stage bar) puts into the 3D tools. hp: { t, tf, icon, toast }. */
Photo.prototype.paint = function (force) {
	var t = now();
	if (!force && t - this.paintAt < 200) { return; }
	this.paintAt = t;
	var self = this;
	this.uis = this.uis.filter(function (u) { return u.el.isConnected; });
	this.uis.forEach(function (u) { self.paintOne(u); });
};
Photo.prototype.paintOne = function (u) {
	var hp = u.hp, tf = hp.tf || function (k) { return hp.t(k); };
	u.el.hidden = this.state === 'unsupported';
	u.live.setAttribute('aria-pressed', this.on ? 'true' : 'false');
	u.live.classList.toggle('is-on', this.on);
	u.take.disabled = !!this.job || this.state === 'unsupported';
	var txt = '', pct = 0, cancel = false;
	if (this.job) { txt = tf('photo_rendering', this.job.s, this.job.n); pct = this.job.s / Math.max(1, this.job.n); cancel = true; }
	else if (this.on && this.state === 'prep') { txt = hp.t('photo_prep'); }
	else if (this.on && (this.state === 'trace' || this.state === 'done') && this.pt) { var s = Math.min(this.cfg.target, Math.floor(this.pt.samples)); txt = tf('photo_status', s, this.cfg.target); pct = s / this.cfg.target; }
	u.st.hidden = !txt;
	u.txt.textContent = txt;
	u.bar.style.width = Math.round(pct * 100) + '%';
	u.stop.hidden = !cancel;
};
export function ui(el, v, hp) {
	var p = attach(v);
	if (!el || !hp) { return p; }
	el.textContent = '';
	el.classList.add('agh-3d-photo');
	function btn(cls, ico, label, title, fn) {
		var b = document.createElement('button');
		b.type = 'button'; b.className = 'agh-3d-photo-btn ' + cls;
		b.setAttribute('aria-label', label); b.title = title || label;
		if (hp.icon) { b.appendChild(hp.icon(ico)); }
		b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
		return b;
	}
	var live = btn('agh-3d-photo-live', 'sparkle', hp.t('photo_live'), hp.t('photo_live_title'), function () { p.setLive(!p.on); });
	var take = btn('agh-3d-photo-take', 'camera', hp.t('photo_take'), hp.t('photo_take_title'), function () {
		p.takePhoto().then(function (blob) { if (hp.toast) { hp.toast(hp.t(blob ? 'photo_done' : 'photo_failed'), blob ? 'ok' : 'error'); } }, function (e) {
			if (hp.toast && String(e && e.message) !== 'cancel') { hp.toast(hp.t('photo_failed'), 'error'); }
		});
	});
	var st = document.createElement('span'); st.className = 'agh-3d-photo-st'; st.setAttribute('role', 'status'); st.setAttribute('aria-live', 'polite'); st.hidden = true;
	var txt = document.createElement('span'); txt.className = 'agh-3d-photo-txt';
	var track = document.createElement('span'); track.className = 'agh-3d-photo-track';
	var bar = document.createElement('i'); track.appendChild(bar);
	var stop = btn('agh-3d-photo-stop', 'close', hp.t('photo_cancel'), hp.t('photo_cancel'), function () { p.cancelPhoto(); });
	stop.hidden = true;
	st.appendChild(txt); st.appendChild(track); st.appendChild(stop);
	el.appendChild(live); el.appendChild(take); el.appendChild(st);
	var u = { el: el, live: live, take: take, st: st, txt: txt, bar: bar, stop: stop, hp: hp };
	p.uis.push(u);
	p.paintOne(u);
	return p;
}
export function attach(v) {
	if (!v.photo) { v.photo = new Photo(v); if (v.photo.on) { v.photo.arm(); } }
	return v.photo;
}
export { lib };
