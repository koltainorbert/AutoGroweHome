// Build mode („Építés az alapoktól”) core test, Node only (no WordPress, no browser):
//  1. 300 random houses: 0 geometric errors, the footprint boxes cover exactly the outline (same mass).
//  2. three reference houses: every material quantity within 1 % of an independent hand calculation.
//  3. rules: every rule passes and fails on its own threshold; Off = 0 messages; Custom threshold wins;
//     every record has a source, package version and dates; a missing package runs in Off mode.
//  4. the shared plan: switched off = byte-identical sketch; switched on = plan and volumes follow the drawing.
//  5. today's house → build mode keeps the footprint area.
// Output: one summary line; exit code 1 on any failure.
'use strict';
const path = require('path');
const B = require('../assets/js/agh-build.js');
const K = require('../assets/js/agh-sketch.js');
const D = require('../assets/data/build-defaults.json');
const HU = require('../assets/data/rules/hu.json');
B.setData({ defaults: D, rules: { hu: HU } });
globalThis.AGH_Build = B; // the sketch looks the build module up on the global object

let pass = 0, fail = 0;
const errs = [];
function ok(cond, label) { if (cond) { pass++; } else { fail++; if (errs.length < 25) { errs.push(label); } } }
function near(a, b, tol, label) { const d = Math.abs(a - b), rel = b ? d / Math.abs(b) : d; ok(rel <= tol || d < 1e-6, label + ': ' + a + ' ≠ ' + b); }

/* 1 – random houses */
let rnd = 0, maxMs = 0;
for (let s = 1; s <= 300; s++) {
	const t0 = Date.now(), b = B.randomHouse(s), c = B.check(b), a = B.adapt(b);
	maxMs = Math.max(maxMs, Date.now() - t0);
	ok(c.errors.length === 0, 'random ' + s + ' errors ' + JSON.stringify(c.errors.slice(0, 3)));
	ok(a.ok, 'random ' + s + ' adapter');
	if (a.ok) {
		let boxA = 0;
		a.vols.forEach(v => { boxA += (v.x1 - v.x0) * (v.y1 - v.y0); ok(isFinite(v.h) && v.h > 2, 'random ' + s + ' height'); });
		near(boxA, a.area, 0.001, 'random ' + s + ' box area = outline area');
		// openings land on a face and inside it
		let ext = b.openings.filter(o => b.walls.find(w => w.id === o.wall).kind === 'ext').length, placed = 0;
		a.vols.forEach(v => Object.keys(v.bOps).forEach(f => v.bOps[f].forEach(o => {
			placed++;
			const len = f === 'front' || f === 'back' ? v.x1 - v.x0 : v.y1 - v.y0;
			ok(o.x >= -0.011 && o.x + o.w <= len + 0.011, 'random ' + s + ' opening inside face');
		})));
		ok(placed === ext, 'random ' + s + ' openings placed ' + placed + '/' + ext);
	}
	const n1 = B.normalize(b), n2 = B.normalize(JSON.parse(JSON.stringify(n1)));
	ok(JSON.stringify(n1) === JSON.stringify(n2), 'random ' + s + ' normalize idempotent');
	rnd++;
}

/* 2 – reference houses vs an independent hand calculation */
const cfg = { plot_width: 20, plot_length: 40, roof_type: 'gable', roof_pitch: 35 };
function mats(b) { const m = B.materials(b, cfg), o = {}; m.items.forEach(i => { o[i.phase + ':' + i.id] = i.qty; }); return o; }
function compare(name, got, exp) {
	Object.keys(exp).forEach(k => near(got[k] || 0, exp[k], 0.01, name + ' ' + k));
	Object.keys(got).forEach(k => ok(k in exp, name + ' unexpected item ' + k + '=' + got[k]));
}
// A: 10 × 8 m rectangle, ceramic 38 cm + EPS, one level, reinforced strip footing
const A = {
	levels: [{ h: 3.0 }], site: { house: { x: 4, y: 12 } },
	found: { type: 'strip_rc', w: 0.5, d: 0.9, top: 0.3, partitions: 'none' }, ring: { h: 0.25, insul: 0.05 }, slab: { type: 'rc', t: 0.2 },
	ground: { fill: 0.2, concrete: 0.1, membrane: 'bitumen', xps: 0.1 }, earth: { topsoil: 0.3, margin: 1 }, ducts: { sewer: true, water: true, earth: true, conduits: 4 },
	walls: B.rectWalls(1, 1, 10, 8, 0.38, 'ceramic'),
	openings: [
		{ wall: 'w3', lv: 0, type: 'entrance', at: 2, w: 1.1, h: 2.3 },
		{ wall: 'w1', lv: 0, type: 'window', at: 2, w: 1.2, h: 1.5, sill: 0.9 }, { wall: 'w2', lv: 0, type: 'window', at: 2, w: 1.2, h: 1.5, sill: 0.9 },
		{ wall: 'w3', lv: 0, type: 'window', at: 6, w: 1.2, h: 1.5, sill: 0.9 }, { wall: 'w4', lv: 0, type: 'window', at: 2, w: 1.2, h: 1.5, sill: 0.9 }
	]
};
{
	const outer = 10.38 * 8.38, per = 2 * (10.38 + 8.38), L = 36, wallA = L * 2.75 - (1.1 * 2.3 + 4 * 1.2 * 1.5), inner = 9.62 * 7.62;
	compare('A', mats(A), {
		'1:topsoil': 12.38 * 10.38 * 0.3, '1:excavation': L * 0.5 * 0.9, '2:concrete_found': L * 0.5 * 0.9, '2:rebar_found': L * 0.5 * 0.9 * 45, '2:concrete_plinth': L * 0.38 * 0.3,
		'3:sewer': 40 - 9.19 + 4, '3:water': 40 - 9.19 + 2, '3:earthing': per, '3:conduit': 4,
		'4:gravel': inner * 0.2, '4:concrete_ground': inner * 0.1, '4:membrane': outer * 1.15, '4:xps': per * 0.6,
		'5:blocks_ceramic_38': wallA * 16, '5:glue_masonry': wallA * 0.38 * 85, '7:lintel_150': 5 * 4,
		'8:concrete_ring': L * 0.33 * 0.25, '8:rebar_ring': L * 0.33 * 0.25 * 95, '8:concrete_slab': (inner + L * 0.38 / 2) * 0.2, '8:rebar_slab': (inner + L * 0.38 / 2) * 0.2 * 90,
		'12:facade_insul': wallA
	});
}
// B: L shape, two levels, AAC 30 cm, slab foundation, bearing wall, drywall partitions, beam-and-block slab
const Bh = {
	levels: [{ h: 2.9 }, { h: 2.9 }], site: { house: { x: 4, y: 12 } },
	found: { type: 'slab', w: 0.5, d: 0.9, top: 0.3, partitions: 'auto' }, ring: { h: 0.25, insul: 0.05 }, slab: { type: 'beam', t: 0.21, stair: { x: 1, y: 1, w: 1, d: 3 } },
	ground: { fill: 0.2, concrete: 0.1, membrane: 'bitumen', xps: 0.1 }, earth: { topsoil: 0.3, margin: 1 }, ducts: { sewer: true, water: true, earth: true, conduits: 4 },
	walls: B.polyWalls([[0, 0], [12, 0], [12, 10], [8, 10], [8, 7], [0, 7]], 0.3).map(w => Object.assign(w, { mat: 'aac', insul: 'graphite_eps', insul_t: 0.15 })).concat([
		{ id: 'i1', kind: 'int', lv: 0, a: [8, 0], b: [8, 7], t: 0.3, mat: 'ceramic' },
		{ id: 'p1', kind: 'part', lv: 0, a: [5, 0], b: [5, 7], t: 0.1, mat: 'drywall' },
		{ id: 'p2', kind: 'part', lv: 1, a: [0, 3.5], b: [5, 3.5], t: 0.1, mat: 'drywall' }
	]),
	openings: [
		{ wall: 'w5', lv: 0, type: 'entrance', at: 1.5, w: 1.0, h: 2.2 },
		{ wall: 'w2', lv: 0, type: 'window', at: 2, w: 1.5, h: 1.4, sill: 0.9 }, { wall: 'w2', lv: 1, type: 'window', at: 2, w: 1.5, h: 1.4, sill: 0.9 },
		{ wall: 'w3', lv: 0, type: 'terrace', at: 1, w: 2.4, h: 2.3 },
		{ wall: 'p1', lv: 0, type: 'door', at: 3, w: 0.9, h: 2.1 }
	]
};
{
	const outer = 12.3 * 7.3 + 4.3 * 3.0, per = 12.3 + 10.3 + 4.3 + 3.0 + 8.0 + 7.3, inner = 11.7 * 6.7 + 3.7 * 3.0, Lx = 44, hm = 2.65;
	const extA = (Lx * hm - (1.0 * 2.2 + 1.5 * 1.4 + 2.4 * 2.3)) + (Lx * hm - 1.5 * 1.4), intA = 6.85 * hm, p1 = 6.7 * hm - 0.9 * 2.1, p2 = 4.85 * hm;
	const slabA = (inner + Lx * 0.3 / 2) * 2 - 3;
	compare('B', mats(Bh), {
		'1:topsoil': 14.3 * 12.3 * 0.3, '1:excavation': outer * 0.5, '2:concrete_found': outer * 0.3, '2:rebar_found': outer * 0.3 * 85,
		'3:sewer': 40 - 10.15 + 4, '3:water': 40 - 10.15 + 2, '3:earthing': per, '3:conduit': 4,
		'4:membrane': outer * 1.15, '4:xps': per * 0.6,
		'5:blocks_aac_30': extA * 8.33, '5:blocks_ceramic_30': intA * 16, '5:glue_masonry': extA * 0.3 * 15 + intA * 0.3 * 85,
		'6:boards': (p1 + p2) * 2.05, '6:profiles': (p1 + p2) * 2.8,
		'7:lintel_125': 3, '7:lintel_175': 6, '7:lintel_275': 3,
		'8:concrete_ring': 2 * Lx * 0.25 * 0.25 + 6.85 * 0.3 * 0.25, '8:rebar_ring': (2 * Lx * 0.25 * 0.25 + 6.85 * 0.3 * 0.25) * 95,
		'8:slab_beams': slabA / 0.6, '8:concrete_topping': slabA * 0.06, '8:rebar_mesh': slabA * 3,
		'12:facade_insul': extA
	});
}
// C: timber frame, attic knee wall, stone strip footing, timber slab
const Ch = {
	levels: [{ h: 3.0 }], attic: true, site: { house: { x: 4, y: 12 } },
	found: { type: 'stone', w: 0.6, d: 1.0, top: 0.3, partitions: 'auto' }, ring: { h: 0.25, insul: 0 }, slab: { type: 'timber', t: 0.25 },
	ground: { fill: 0.2, concrete: 0.1, membrane: 'bitumen', xps: 0.1 }, earth: { topsoil: 0.3, margin: 1 }, ducts: { sewer: true, water: true, earth: true, conduits: 4 },
	walls: B.rectWalls(1, 1, 9, 7, 0.2, 'timber_frame').map(w => Object.assign(w, { insul: 'mineral_wool', insul_t: 0.15 })),
	openings: [{ wall: 'w3', lv: 0, type: 'entrance', at: 1, w: 1.0, h: 2.1 }]
};
{
	const outer = 9.2 * 7.2, per = 32.8, L = 32, inner = 8.8 * 6.8, wallA = L * 2.75 - 2.1 + L * 0.9, V = L * 0.6 * 1.0, slabA = inner + L * 0.2 / 2;
	compare('C', mats(Ch), {
		'1:topsoil': 11.2 * 9.2 * 0.3, '1:excavation': V, '2:stone_found': V * 0.7, '2:mortar_found': V * 0.3, '2:concrete_plinth': L * 0.2 * 0.3,
		'3:sewer': 40 - 8.1 + 4, '3:water': 40 - 8.1 + 2, '3:conduit': 4,
		'4:gravel': (outer - L * 0.2) * 0.2, '4:concrete_ground': (outer - L * 0.2) * 0.1, '4:membrane': outer * 1.15, '4:xps': per * 0.6,
		'5:studs': wallA * 2.2, '5:boards': wallA * 2.05,
		'8:concrete_ring': L * 0.2 * 0.25, '8:rebar_ring': L * 0.2 * 0.25 * 95, '8:timber_beams': slabA / 0.6, '8:boards': slabA * 1.05,
		'12:facade_insul': wallA
	});
	ok(B.check(A).errors.length === 0 && B.check(Bh).errors.length === 0 && B.check(Ch).errors.length === 0, 'reference houses are valid ' + JSON.stringify([B.check(A).errors, B.check(Bh).errors, B.check(Ch).errors]));
	const rB = B.rooms(B.normalize(Bh), 0);
	ok(rB.length === 3, 'B ground floor has 3 rooms (' + rB.length + ')');
}

/* 3 – rules */
{
	const base = B.normalize(Object.assign({}, A, { rules: { mode: 'on', hesz: { coverage: 30, height: 7.5, front: 5, side: 3, back: 6, pitch_min: 30, pitch_max: 45 } }, site: { frost: 0.8, house: { x: 4, y: 12 } } }));
	HU.rules.forEach(r => {
		ok(r.source && (r.source.law || r.source.text) && r.pkg && r.checked && typeof r.verified === 'boolean' && 'effective' in r, 'rule ' + r.id + ' has source, package, dates');
		ok(r.verified === false, 'rule ' + r.id + ' is not marked verified');
		const bb = r.applies === 'no_hesz_height' ? B.normalize(Object.assign({}, base, { rules: Object.assign({}, base.rules, { hesz: Object.assign({}, base.rules.hesz, { height: null }) }) })) : base;
		const lim0 = B.rules(bb, cfg).list.find(x => x.id === r.id).limit;
		if (lim0 === null) { ok(false, 'rule ' + r.id + ' has no threshold in the test'); return; }
		const d = Math.max(0.01, Math.abs(lim0) * 0.1), good = r.op === '>=' ? lim0 + d : lim0 - d, bad = r.op === '>=' ? lim0 - d : lim0 + d;
		const m = B.metrics(bb, cfg);
		const st = v => { const mm = Object.assign({}, m, { [r.metric]: v }); return B.rules(bb, cfg, mm).list.find(x => x.id === r.id).status; };
		ok(st(good) === 'ok', 'rule ' + r.id + ' passes at ' + good);
		ok(st(bad) === 'fail', 'rule ' + r.id + ' fails at ' + bad);
	});
	const off = B.normalize(Object.assign({}, base, { rules: Object.assign({}, base.rules, { mode: 'off' }) }));
	ok(B.rules(off, cfg).list.length === 0, 'Off mode: 0 rule messages');
	const cu = B.normalize(Object.assign({}, base, { rules: Object.assign({}, base.rules, { mode: 'custom', custom: { hu_room_height: { on: true, value: 2.2 }, hu_wall_u: { on: false } } }) }));
	const rl = B.rules(cu, cfg).list;
	ok(rl.find(x => x.id === 'hu_room_height').limit === 2.2 && rl.find(x => x.id === 'hu_room_height').status === 'ok', 'Custom threshold applies');
	ok(rl.find(x => x.id === 'hu_wall_u').status === 'off', 'Custom: a switched-off rule gives no message');
	const xx = B.normalize(Object.assign({}, base, { site: { country: 'xx' } }));
	const rx = B.rules(xx, cfg);
	ok(rx.missing && rx.effective === 'off' && rx.list.length === 0, 'missing package → Off mode');
	ok(B.practice(base, cfg).every(p => ['ok', 'fail', 'na'].indexOf(p.status) !== -1), 'practice checks evaluate');
}

/* 4 – the shared plan */
{
	const c0 = { arch_style: 'modern_minimal', roof_type: 'gable', levels: 'single', net_area: 120 };
	const withB = Object.assign({}, c0, { build: Bh });
	B.active = false;
	ok(K.render(withB, { id: 'x_' }) === K.render(c0, { id: 'x_' }), 'switched off: identical sketch');
	ok(JSON.stringify(K._volumes(withB, K.plan(withB))) === JSON.stringify(K._volumes(c0, K.plan(c0))), 'switched off: identical volumes');
	B.active = true;
	const pl = K.plan(withB), vols = K._volumes(withB, pl), a = B.adapt(Bh);
	ok(Math.abs(pl.W - a.W) < 1e-9 && Math.abs(pl.D - a.D) < 1e-9 && pl.floors === 2, 'switched on: plan follows the drawing');
	ok(vols.length === a.vols.length, 'switched on: volumes = boxes');
	for (let s = 1; s <= 60; s++) {
		const b = B.randomHouse(s), cc = Object.assign({}, c0, { roof_type: ['gable', 'hip', 'flat', 'shed', 'half_hip'][s % 5], build: b });
		const svg = K.render(cc, { id: 'r' + s + '_' });
		ok(svg.indexOf('NaN') === -1 && svg.indexOf('undefined') === -1 && /viewBox/.test(svg), 'switched on: sketch ' + s);
	}
	B.active = false;
}

/* 5 – today's house → build */
{
	const fps = [['rectangle', 'auto'], ['l_shape', 'auto'], ['u_shape', 'auto'], ['staggered', 'auto'], ['rectangle', 'compact'], ['rectangle', 'cross_gable'], ['rectangle', 'gable_pair']];
	fps.forEach(([fp, ms]) => ['single', 'two', 'attic'].forEach(lv => {
		const c = { footprint: fp, massing: ms, levels: lv, net_area: 140, roof_type: 'gable', arch_style: 'modern_minimal' };
		const b = B.fromHouse(c, K), a = B.adapt(b), ch = B.check(b);
		const vols = K._volumes(c, K.plan(c)).filter(v => !(v.z0 > 0.05) && !v.tower && !v.glass);
		const loop = B._union(vols.map(v => ({ x0: Math.round(v.x0 * 1000), x1: Math.round(v.x1 * 1000), y0: Math.round(v.y0 * 1000), y1: Math.round(v.y1 * 1000) })));
		const area = B._area2(loop) / 2 / 1e6;
		ok(a.ok && ch.errors.length === 0, 'from house ' + fp + '/' + ms + '/' + lv + ' valid ' + JSON.stringify(ch.errors.slice(0, 2)));
		if (a.ok) { near(a.area, area, 0.01, 'from house ' + fp + '/' + ms + '/' + lv + ' area'); }
		ok(b.guessed.length > 0 && b.openings.some(o => o.type === 'entrance'), 'from house ' + fp + ' marks guesses, has an entrance');
	}));
}

console.log('build-test: ' + pass + '/' + (pass + fail) + ' OK, ' + rnd + ' véletlen ház, max ' + maxMs + ' ms/ház' + (fail ? ' – HIBA:\n  ' + errs.join('\n  ') : ''));
process.exit(fail ? 1 : 0);
