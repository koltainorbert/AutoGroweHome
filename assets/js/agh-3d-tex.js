/*!
 * AutoGroweHome – procedural PBR textures for the 3D preview.
 * Koltai Norbert – Infostudio
 *
 * Every material is generated in the browser (no downloads): colour, normal and roughness maps from
 * the generators in agh-3d-gen.js. The pixels are baked in background workers, so the page never
 * waits for them: a texture is created at once with a flat placeholder of its final size and filled
 * in when the worker answers (the preview redraws then). Single-tone materials are baked once in
 * neutral grey and tinted by the material colour – a colour change never regenerates anything.
 */
import * as THREE from './vendor/three/three.module.min.js';
import { bake, info, TINT, NEUTRAL } from './agh-3d-gen.js';

export { TINT, NEUTRAL };
var CACHE = {};
var maxAniso = 8;
var SCALE = 0.5;   // pixel density of the generated maps (relative to the generator's design size)
export function setAnisotropy(n) { maxAniso = n || 8; }

/* ------------------------------------------------------------------ workers */
var workers = null, rr = 0, jobs = {}, jobSeq = 0, pending = 0, waiters = [], listeners = [];
function spawn() {
	if (workers !== null) { return workers; }
	workers = [];
	if (typeof Worker === 'undefined') { return workers; }
	try {
		var src = new URL('./agh-3d-texw.js' + new URL(import.meta.url).search, import.meta.url);
		var n = Math.max(1, Math.min(3, ((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2) - 1));
		for (var i = 0; i < n; i++) {
			var w = new Worker(src, { type: 'module' });
			w.onmessage = function (e) { var j = jobs[e.data.id]; if (j) { delete jobs[e.data.id]; j.done(e.data); } };
			w.onerror = broken;
			workers.push(w);
		}
	} catch (e) { workers = []; }
	return workers;
}
// A worker could not start (old browser, blocked module workers): bake everything here instead.
function broken() {
	(workers || []).forEach(function (w) { try { w.terminate(); } catch (e) {} });
	workers = [];
	Object.keys(jobs).forEach(function (id) { var j = jobs[id]; delete jobs[id]; j.done(bake(j.kind, j.opts, j.scale)); });
}
function settle() {
	listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
	if (pending === 0) { var w = waiters; waiters = []; w.forEach(function (fn) { fn(); }); }
}
// Called (once per filled texture) so the preview can redraw.
export function onTexture(fn) { listeners.push(fn); }
// Resolves when every requested texture has its pixels.
export function texturesReady() { return pending === 0 ? Promise.resolve() : new Promise(function (res) { waiters.push(res); }); }

/* ------------------------------------------------------------------ textures */
function dataTex(w, h, data, srgb, noTile) {
	var t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
	t.wrapS = t.wrapT = noTile ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
	t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
	t.anisotropy = maxAniso;
	if (srgb) { t.colorSpace = THREE.SRGBColorSpace; }
	t.needsUpdate = true;
	return t;
}
function flat(n, r, g, b, a) { var d = new Uint8Array(n * 4); for (var i = 0; i < n * 4; i += 4) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a; } return d; }
// Returns { map, normalMap, roughnessMap, tw, th, alpha } for a material spec.
export function texture(kind, opts) {
	opts = opts || {};
	var key = kind + '|' + JSON.stringify(opts);
	if (CACHE[key]) { return CACHE[key]; }
	var scale = kind === 'floor' ? 1 : SCALE, I = info(kind, opts, scale), N = I.w * I.h;
	var c = /^#[0-9a-f]{6}$/i.test(opts.color || '') ? opts.color : '#9A968F', cr = parseInt(c.substr(1, 2), 16), cg = parseInt(c.substr(3, 2), 16), cb = parseInt(c.substr(5, 2), 16);
	var res = {
		map: dataTex(I.w, I.h, flat(N, cr, cg, cb, I.alpha ? 0 : 255), true, I.noTile),
		normalMap: dataTex(I.w, I.h, flat(N, 128, 128, 255, 255), false, I.noTile),
		roughnessMap: dataTex(I.w, I.h, flat(N, 220, 220, 220, 255), false, I.noTile),
		tw: I.tw, th: I.th, alpha: I.alpha, noTile: I.noTile
	};
	[res.map, res.normalMap, res.roughnessMap].forEach(function (t) { t.repeat.set(1 / I.tw, 1 / I.th); });
	CACHE[key] = res;
	var fill = function (d) {
		res.map.image.data.set(d.col); res.normalMap.image.data.set(d.nrm); res.roughnessMap.image.data.set(d.rgh);
		res.map.needsUpdate = true; res.normalMap.needsUpdate = true; res.roughnessMap.needsUpdate = true;
		pending--; settle();
	};
	pending++;
	var W = spawn();
	if (W.length) {
		var id = ++jobSeq;
		jobs[id] = { kind: kind, opts: opts, scale: scale, done: fill };
		W[rr++ % W.length].postMessage({ id: id, kind: kind, opts: opts, scale: scale });
	} else {
		fill(bake(kind, opts, scale));
	}
	return res;
}
export function textureCacheSize() { return Object.keys(CACHE).length; }
