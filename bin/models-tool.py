#!/usr/bin/env python3
"""
Helper for the real 3D model catalogue (assets/models/), used by bin/build-models.sh.

  bin/models-tool.py info <model.gltf|model.glb>        triangle count and size (m) of a source model
  bin/models-tool.py check                              catalogue check: every entry CC0, source URL,
                                                        files present, budgets (exit 1 on a problem)

Reads glTF 2.0 JSON and GLB containers (accessor min/max and node transforms; no extensions needed).
"""
import json
import math
import os
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, 'assets', 'models', 'manifest.json')
BUDGET = {'hi': 200 * 1024, 'lo': 100 * 1024, 'tris': 20000, 'total': 10 * 1024 * 1024}


def read_gltf(path):
    with open(path, 'rb') as fh:
        data = fh.read()
    if data[:4] == b'glTF':
        length = struct.unpack('<I', data[12:16])[0]
        return json.loads(data[20:20 + length].decode('utf-8'))
    return json.loads(data.decode('utf-8'))


def mat_mul(a, b):
    return [sum(a[r * 4 + k] * b[k * 4 + c] for k in range(4)) for r in range(4) for c in range(4)]


def node_matrix(n):
    if 'matrix' in n:
        m = n['matrix']  # column-major
        return [m[c * 4 + r] for r in range(4) for c in range(4)]
    t = n.get('translation', [0, 0, 0])
    q = n.get('rotation', [0, 0, 0, 1])
    s = n.get('scale', [1, 1, 1])
    x, y, z, w = q
    r = [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
         2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
         2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]
    return [r[0] * s[0], r[1] * s[1], r[2] * s[2], t[0],
            r[3] * s[0], r[4] * s[1], r[5] * s[2], t[1],
            r[6] * s[0], r[7] * s[1], r[8] * s[2], t[2],
            0, 0, 0, 1]


def info(path):
    g = read_gltf(path)
    acc = g.get('accessors', [])
    tris = 0
    lo = [math.inf] * 3
    hi = [-math.inf] * 3

    def visit(ni, parent):
        nonlocal tris
        n = g['nodes'][ni]
        m = mat_mul(parent, node_matrix(n))
        if 'mesh' in n:
            for p in g['meshes'][n['mesh']]['primitives']:
                if p.get('mode', 4) == 4:
                    cnt = acc[p['indices']]['count'] if 'indices' in p else acc[p['attributes']['POSITION']]['count']
                    tris += cnt // 3
                a = acc[p['attributes']['POSITION']]
                if 'min' in a and 'max' in a:
                    for cx in (a['min'][0], a['max'][0]):
                        for cy in (a['min'][1], a['max'][1]):
                            for cz in (a['min'][2], a['max'][2]):
                                v = [m[r * 4] * cx + m[r * 4 + 1] * cy + m[r * 4 + 2] * cz + m[r * 4 + 3] for r in range(3)]
                                for k in range(3):
                                    lo[k] = min(lo[k], v[k]); hi[k] = max(hi[k], v[k])
        for c in n.get('children', []):
            visit(c, m)

    ident = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    scene = g.get('scenes', [{}])[g.get('scene', 0)] if g.get('scenes') else {'nodes': list(range(len(g.get('nodes', []))))}
    for ni in scene.get('nodes', []):
        visit(ni, ident)
    size = [round(hi[k] - lo[k], 3) if hi[k] > lo[k] else 0 for k in range(3)]
    # glTF is y-up: width x, depth z, height y
    return {'tris': tris, 'size': [size[0], size[2], size[1]]}


def load_manifest():
    with open(MANIFEST, encoding='utf-8') as fh:
        return json.load(fh)


def check():
    m = load_manifest()
    bad, total = [], 0
    for e in m.get('models', []):
        i = e.get('id', '?')
        if e.get('license') != 'CC0-1.0':
            bad.append(f'{i}: license {e.get("license")!r} (csak CC0-1.0)')
        if not str(e.get('source', '')).startswith('https://'):
            bad.append(f'{i}: no source URL')
        for k in ('author', 'date'):
            if not e.get(k):
                bad.append(f'{i}: no {k}')
        for t in ('hi', 'lo'):
            f = (e.get('files') or {}).get(t)
            p = os.path.join(ROOT, 'assets', 'models', f) if f else ''
            if not f or not os.path.exists(p):
                bad.append(f'{i}: {t} file missing'); continue
            sz = os.path.getsize(p); total += sz
            if sz > BUDGET[t]:
                bad.append(f'{i}: {t} {sz} B > {BUDGET[t]} B')
        if e.get('tris', 0) > BUDGET['tris']:
            bad.append(f'{i}: {e["tris"]} triangles > {BUDGET["tris"]}')
    if total > BUDGET['total']:
        bad.append(f'catalogue {total} B > {BUDGET["total"]} B')
    print(f'modellek: {len(m.get("models", []))}, összesen {total} bájt, hiba {len(bad)}')
    for b in bad:
        print('  ' + b)
    return 1 if bad else 0


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'info':
        print(json.dumps(info(sys.argv[2])))
    elif cmd == 'check':
        sys.exit(check())
    else:
        print(__doc__); sys.exit(2)
