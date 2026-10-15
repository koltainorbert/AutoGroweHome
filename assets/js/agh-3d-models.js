/*
 * AutoGroweHome – real 3D models (1.13.0).
 *
 * The built-in furniture is built from code (boxes, rounded boxes, cylinders) and appears at once.
 * Where the model catalogue (assets/models/manifest.json) has a free (CC0) model for a piece, the
 * model is loaded in the background and replaces the piece in the same place, inside the same box,
 * in one frame. Nothing else changes: the piece keeps its group, its slot name ("field#index"), its
 * position, its tap target and its hand-made place, so tapping, grabbing, Ctrl+Z, saving and the
 * 2D sketch work exactly as before. A piece without a model, or one whose model would be distorted,
 * stays as it is.
 *
 * Switched off (admin setting, or ?agh_models=0) this module is never imported and no model file
 * is ever requested: the scene is the 1.12.1 scene.
 *
 * Files: glTF binary with Meshopt geometry and KTX2 (Basis Universal) textures, two sizes per model:
 * "hi" (1024 px textures) and "lo" (512 px) for phones and weak devices. The decoders are shipped
 * with the plugin (no CDN: the designer runs on the client's site and calls no outside server).
 */
import * as THREE from './vendor/three/three.module.min.js';
import { GLTFLoader } from './vendor/three/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from './vendor/three/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from './vendor/three/jsm/libs/meshopt_decoder.module.js';

var CFG = (window.AGH_LOADER && window.AGH_LOADER.models) || {};
var manifest = null, byKey = {}, gltf = null, ktx2 = null, tierName = null, pending = 0, waiters = [];
var files = new Map();            // file URL -> Promise<THREE.Object3D template>
var tintCache = new Map();        // material uuid + colour -> material
var stats = { loaded: 0, swapped: 0, kept: 0, failed: 0, bytes: 0, requests: 0, reasons: {} };

function param(name) {
	try { return new URLSearchParams(window.location.search).get(name); } catch (e) { return null; }
}
// The switch: the admin setting, overridden by ?agh_models=0|1 for side-by-side comparison.
export function enabled() {
	var p = param('agh_models');
	if (p === '0') { return false; }
	if (p === '1') { return !!CFG.manifest; }
	return !!CFG.on;
}
// Device tier: phones and weak machines get the small files. ?agh_tier=lo|hi overrides.
export function tier(renderer) {
	if (tierName) { return tierName; }
	var p = param('agh_tier');
	if (p === 'lo' || p === 'hi') { return (tierName = p); }
	var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
	var small = Math.min(window.screen ? window.screen.width : 1920, window.screen ? window.screen.height : 1080) < 820;
	var mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8;
	var maxTex = 16384;
	try { if (renderer) { maxTex = renderer.capabilities.maxTextureSize; } } catch (e) { /* no renderer yet */ }
	tierName = (coarse && small) || mem <= 4 || cores <= 4 || maxTex < 8192 ? 'lo' : 'hi';
	return tierName;
}
export function getStats() { return Object.assign({ tier: tierName, enabled: enabled(), models: manifest ? manifest.models.length : 0 }, stats); }

var initP = null;
// Loads the catalogue once and prepares the decoders for the given renderer.
export function init(renderer) {
	if (initP) { return initP; }
	if (!enabled()) { return (initP = Promise.resolve(false)); }
	initP = fetch(CFG.manifest, { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (m) {
		if (!m || !Array.isArray(m.models)) { return false; }
		manifest = m; byKey = {};
		m.models.forEach(function (e) {
			if (!e || !e.match || !e.files) { return; }
			(byKey[e.match.key] = byKey[e.match.key] || []).push(e);
		});
		gltf = new GLTFLoader();
		gltf.setMeshoptDecoder(MeshoptDecoder);
		ktx2 = new KTX2Loader().setTranscoderPath(CFG.vendor + 'libs/basis/');
		if (renderer) { ktx2.detectSupport(renderer); }
		gltf.setKTX2Loader(ktx2);
		tier(renderer);
		return true;
	}).catch(function () { return false; });
	return initP;
}
// The model for a piece: matched by its key (the field or item it belongs to) and its value.
export function entryFor(key, value) {
	var list = byKey[key];
	if (!list) { return null; }
	for (var i = 0; i < list.length; i++) {
		var v = list[i].match.values;
		if (!v || v === '*' || (Array.isArray(v) && v.indexOf(value) !== -1)) { return list[i]; }
	}
	return null;
}
function urlFor(e) {
	var f = e.files[tier()] || e.files.hi || e.files.lo;
	return f ? CFG.base + f : '';
}
function load(url) {
	if (files.has(url)) { return files.get(url); }
	stats.requests++;
	var p = new Promise(function (res, rej) {
		gltf.load(url, function (g) {
			var root = g.scene || (g.scenes && g.scenes[0]);
			root.traverse(function (o) {
				if (o.isMesh) {
					o.castShadow = true; o.receiveShadow = true;
					var mats = Array.isArray(o.material) ? o.material : [o.material];
					mats.forEach(function (mt) { if (mt && mt.map) { mt.map.anisotropy = 4; } });
				}
			});
			stats.loaded++;
			res(root);
		}, undefined, function (err) { stats.failed++; rej(err); });
	});
	files.set(url, p);
	return p;
}

// The piece's box in its own frame (what the built-in furniture occupies).
function localBox(o) {
	o.updateWorldMatrix(true, true);
	var inv = new THREE.Matrix4().copy(o.matrixWorld).invert(), box = new THREE.Box3(), tmp = new THREE.Box3(), m4 = new THREE.Matrix4();
	o.traverse(function (q) {
		if (!q.isMesh || q.userData.aghModel || !q.geometry || q.visible === false) { return; }
		if (!q.geometry.boundingBox) { q.geometry.computeBoundingBox(); }
		tmp.copy(q.geometry.boundingBox).applyMatrix4(m4.multiplyMatrices(inv, q.matrixWorld));
		box.union(tmp);
	});
	return box;
}
// The colour the built-in piece shows on its largest surface: the field that paints it (fabric,
// wood, colour) keeps painting the model's tintable materials.
function mainColour(o) {
	var best = null, area = -1;
	o.traverse(function (q) {
		if (!q.isMesh || q.userData.aghModel || !q.material) { return; }
		var mt = Array.isArray(q.material) ? q.material[0] : q.material;
		if (!mt || !mt.color) { return; }
		if (!q.geometry.boundingBox) { q.geometry.computeBoundingBox(); }
		var s = q.geometry.boundingBox.getSize(new THREE.Vector3()), a = s.x * s.y + s.y * s.z + s.x * s.z;
		if (a > area) { area = a; best = mt.color; }
	});
	return best ? best.clone() : null;
}
function tinted(mt, col) {
	var k = mt.uuid + col.getHexString();
	if (!tintCache.has(k)) { var c2 = mt.clone(); c2.color = col.clone(); tintCache.set(k, c2); }
	return tintCache.get(k);
}
var FRONT = { '+z': 0, '-z': Math.PI, '+x': -Math.PI / 2, '-x': Math.PI / 2 };

/**
 * Replace one piece (a group in a room, on an option card or in the garden) with its model.
 * Resolves true when swapped. The piece group itself stays: only its built-in meshes are hidden.
 */
export function swap(o, value, onDone, defer) {
	if (!manifest || !o || o.userData.aghSwapped) { return Promise.resolve(false); }
	var key = o.userData.item || o.userData.field, e = key ? entryFor(key, value === undefined ? o.userData.value : value) : null;
	if (!e) { return Promise.resolve(false); }
	var url = urlFor(e);
	if (!url) { return Promise.resolve(false); }
	var box = localBox(o);
	if (box.isEmpty()) { return Promise.resolve(false); }
	var col = e.tint && e.tint.length ? mainColour(o) : null;
	pending++;
	return load(url).then(function (tpl) {
		if (!o.parent && !o.userData.aghOrphanOk) { return false; }   // the room was rebuilt meanwhile
		var model = tpl.clone(true);
		model.rotation.y = FRONT[e.front || '+z'] || 0;
		model.updateMatrixWorld(true);
		var mb = new THREE.Box3().setFromObject(model), ms = mb.getSize(new THREE.Vector3()), bs = box.getSize(new THREE.Vector3());
		// uniform scale from the footprint; a model whose proportions differ from the piece by more than
		// 15 % would look distorted or stick out: the built-in piece stays
		var sx = bs.x / Math.max(1e-4, ms.x), sz = bs.z / Math.max(1e-4, ms.z), sy = bs.y / Math.max(1e-4, ms.y);
		var s = Math.min(sx, sz), dev = Math.max(sx, sz, sy) / Math.max(1e-4, Math.min(sx, sz, sy)) - 1;
		if (!(s > 0) || dev > 0.15) {
			stats.kept++; stats.reasons[key] = 'aspect ' + Math.round(dev * 100) + '%';
			if (window.console && console.info) { console.info('AGH models: ' + key + ' (' + e.id + ') kept the built-in piece, proportions differ by ' + Math.round(dev * 100) + '%'); }
			return false;
		}
		model.scale.setScalar(s);
		model.updateMatrixWorld(true);
		mb.setFromObject(model);
		var c = box.getCenter(new THREE.Vector3()), mc = mb.getCenter(new THREE.Vector3());
		// mount: floor pieces stand on the floor, wall pieces hang on the wall behind them, ceiling pieces hang
		var mount = e.mount || 'floor';
		model.position.x += c.x - mc.x;
		model.position.z += mount === 'wall' ? box.min.z - mb.min.z : c.z - mc.z;
		model.position.y += mount === 'ceiling' ? box.max.y - mb.max.y : box.min.y - mb.min.y;
		var ud = o.userData;
		model.traverse(function (q) {
			q.userData.aghModel = true;
			if (q.isMesh) {
				if (ud.field) { q.userData.field = ud.field; }
				if (ud.item) { q.userData.item = ud.item; }
				if (ud.room) { q.userData.room = ud.room; }
				if (col && e.tint) {
					var one = function (mt) { return mt && e.tint.indexOf(mt.name) !== -1 ? tinted(mt, col) : mt; };
					q.material = Array.isArray(q.material) ? q.material.map(one) : one(q.material);
				}
			}
		});
		var kids = [];
		o.children.forEach(function (ch) { if (!ch.userData.aghModel) { kids.push(ch); } });
		model.userData.aghModel = true; model.name = 'agh-model:' + e.id;
		o.add(model);
		o.userData.aghSwapped = e.id; o.userData.aghKids = kids; o.userData.aghModelObj = model;
		// deferred: the model waits hidden until its shaders are ready, then commit() shows it and hides
		// the built-in piece in the same frame (no flash of an uncompiled or half-swapped piece)
		if (defer) { model.visible = false; } else { commit(o); }
		stats.swapped++;
		if (onDone) { onDone(o, e); }
		return true;
	}).catch(function () { stats.failed++; return false; }).finally(function () {
		pending--;
		if (!pending) { var w = waiters; waiters = []; w.forEach(function (f) { f(); }); }
	});
}
export function commit(o) {
	if (!o || !o.userData.aghModelObj) { return; }
	o.userData.aghModelObj.visible = true;
	(o.userData.aghKids || []).forEach(function (ch) { ch.visible = false; });
}
// Put the built-in piece back (used when the switch is turned off without a reload).
export function unswap(o) {
	if (!o || !o.userData.aghSwapped) { return; }
	o.children.slice().forEach(function (ch) { if (ch.userData.aghModel) { o.remove(ch); } });
	(o.userData.aghKids || []).forEach(function (ch) { ch.visible = true; });
	o.userData.aghSwapped = null; o.userData.aghKids = null; o.userData.aghModelObj = null;
}
// Swap every piece of a group (the furniture of a room, the garden pieces).
export function swapAll(group, onEach) {
	if (!manifest || !group) { return Promise.resolve(0); }
	var list = group.children.slice().map(function (o) { return swap(o, undefined, onEach); });
	return Promise.all(list).then(function (r) { return r.filter(Boolean).length; });
}
// Generation waits for the models that are on their way (at most `ms`), so no half-loaded scene
// goes to the image model. After the time limit the built-in pieces are used.
export function ready(ms) {
	if (!pending) { return Promise.resolve(true); }
	return new Promise(function (res) {
		var t = setTimeout(function () { res(false); }, ms || 3000);
		waiters.push(function () { clearTimeout(t); res(true); });
	});
}
export function busy() { return pending; }
