// Build mode parity data for the PHP port (includes/Build/Build.php), Node only.
// Prints ONE JSON array: seeds 1..120 of randomHouse() plus three fixed edge cases (a rectangle, an L whose
// openings straddle the box seams, a house with a diagonal wall = not orthogonal). For each case:
// { name, build (normalized), ok, outlineArea m², boxes (sorted), roomAreas per level (m², 2 decimals),
//   roomKeys per level, opsCount, ops (bOps per box), seams }.
// Used by tests/build-test.php.
'use strict';
const B = require('../assets/js/agh-build.js');
const D = require('../assets/data/build-defaults.json');
const HU = require('../assets/data/rules/hu.json');
B.setData({ defaults: D, rules: { hu: HU } });

const r2 = v => Math.round(v * 100) / 100;
const r6 = v => Math.round(v * 1e6) / 1e6;

function entry(name, raw) {
	const b = B.normalize(raw), a = B.adapt(b), ol = B.outline(b), out = { name: name, input: raw, build: b, ok: !!a.ok };
	out.outlineArea = ol.closed ? r6(ol.area / 1e6) : null;
	out.boxes = a.ok ? a.vols.map(v => [r6(v.x0), r6(v.y0), r6(v.x1), r6(v.y1)]).sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2] || p[3] - q[3]) : [];
	out.roomAreas = []; out.roomKeys = [];
	for (let lv = 0; lv < b.levels.length; lv++) {
		const rs = B.rooms(b, lv);
		out.roomAreas.push(rs.map(r => r2(r.area / 1e6)));
		out.roomKeys.push(rs.map(r => r.key));
	}
	out.opsCount = 0; out.ops = [];
	if (a.ok) {
		a.vols.forEach(v => {
			out.ops.push(v.bOps);
			Object.keys(v.bOps).forEach(f => { out.opsCount += v.bOps[f].length; });
		});
	}
	out.seams = a.ok ? a.seams : 0;
	return out;
}

const list = [];
for (let s = 1; s <= 120; s++) { list.push(entry('seed ' + s, B.randomHouse(s))); }

// 1. a plain 10 × 8 m rectangle with a partition, a door and windows
const rect = { levels: [{ h: 3 }], walls: B.rectWalls(1, 1, 10, 8, 0.38, 'ceramic').concat([{ id: 'p1', kind: 'part', lv: 0, a: [5, 1], b: [5, 9], t: 0.1, mat: 'partition_brick' }]),
	openings: [{ wall: 'w3', type: 'entrance', at: 2, w: 1.1, h: 2.3 }, { wall: 'w1', type: 'window', at: 1, w: 1.2, h: 1.5, sill: 0.9 }, { wall: 'w2', type: 'window', at: 3, w: 1.5, h: 1.5 }, { wall: 'p1', type: 'door', at: 3, w: 0.9, h: 2.1 }] };
list.push(entry('rectangle', rect));

// 2. an L: openings across the inner-corner seams on the back wall and on the right wall – no box split keeps both whole
const lpts = [[1, 1], [11, 1], [11, 10], [7, 10], [7, 6], [1, 6]];
const L = { levels: [{ h: 2.9 }, { h: 2.9 }], walls: B.polyWalls(lpts, 0.3).concat([{ id: 'i1', kind: 'int', lv: 0, a: [7, 1], b: [7, 6], t: 0.25, mat: 'ceramic' }, { id: 'p2', kind: 'part', lv: 1, a: [4, 1], b: [4, 6], t: 0.1, mat: 'drywall' }]),
	openings: [{ wall: 'w1', type: 'window', at: 5.4, w: 1.2, h: 1.4, sill: 0.9 }, { wall: 'w2', type: 'window', lv: 1, at: 4.4, w: 1.2, h: 1.4 }, { wall: 'w3', type: 'entrance', at: 1.5, w: 1.1, h: 2.2 }, { wall: 'w4', type: 'terrace', at: 1, w: 2.4, h: 2.2 }, { wall: 'i1', type: 'door', at: 2, w: 0.9 }] };
list.push(entry('L seam', L));

// 3. a diagonal (cut) corner: closed, not orthogonal → no boxes, rooms still counted
const dpts = [[1, 1], [9, 1], [12, 4], [12, 9], [1, 9]];
const diag = { levels: [{ h: 3 }], walls: B.polyWalls(dpts, 0.38).concat([{ id: 'p1', kind: 'part', lv: 0, a: [6, 1], b: [6, 9], t: 0.12, mat: 'partition_aac' }]), openings: [{ wall: 'w2', type: 'window', at: 1, w: 1.2 }] };
list.push(entry('diagonal', diag));

process.stdout.write(JSON.stringify(list));
