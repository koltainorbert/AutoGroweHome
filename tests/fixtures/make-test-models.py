#!/usr/bin/env python3
"""
Test models for tests/e2e/models.js (own work, CC0): a sofa and a potted plant built from boxes, with
a generated fabric texture, written as plain glTF. bin/build-models.sh then packs them exactly like the
real catalogue (Meshopt + KTX2, hi/lo), so the test runs the whole chain: decoder, transcoder, fit.

  python3 tests/fixtures/make-test-models.py <out-dir>
"""
import base64
import json
import math
import os
import struct
import sys
import zlib


def png(w, h, fn):
    raw = b''.join(b'\x00' + bytes(sum((fn(x, y) for x in range(w)), ())) for y in range(h))
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')


def fabric(x, y):
    v = 200 + int(18 * math.sin(x * 0.9) * math.sin(y * 0.9)) + ((x * 7 + y * 13) % 9)
    return (v, v, v)


def wood(x, y):
    g = int(20 * math.sin(y * 0.15 + math.sin(x * 0.05) * 3))
    return (130 + g, 96 + g, 64 + g)


def box(x0, y0, z0, x1, y1, z1):
    """Positions, normals, uvs, indices of an axis-aligned box (y up)."""
    P, N, U, I = [], [], [], []
    faces = [
        ((1, 0, 0), [(x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1)]),
        ((-1, 0, 0), [(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)]),
        ((0, 1, 0), [(x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0)]),
        ((0, -1, 0), [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)]),
        ((0, 0, 1), [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]),
        ((0, 0, -1), [(x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0)]),
    ]
    for n, q in faces:
        b = len(P)
        P += q
        N += [n] * 4
        U += [(0, 0), (1, 0), (1, 1), (0, 1)]
        I += [b, b + 1, b + 2, b, b + 2, b + 3]
    return P, N, U, I


def model(parts, out, name):
    """parts: list of (material_index, [boxes]) -> one mesh with a primitive per material."""
    buf = bytearray()
    views, accs, prims = [], [], []

    def add(data, fmt, comp, typ, count, target, minmax=None):
        while len(buf) % 4:
            buf.append(0)
        off = len(buf)
        buf.extend(data)
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data), 'target': target})
        a = {'bufferView': len(views) - 1, 'componentType': comp, 'count': count, 'type': typ}
        if minmax:
            a['min'], a['max'] = minmax
        accs.append(a)
        return len(accs) - 1

    for mi, boxes in parts:
        P, N, U, I = [], [], [], []
        for b in boxes:
            p, n, u, i = box(*b)
            base = len(P)
            P += p; N += n; U += u; I += [k + base for k in i]
        pmin = [min(v[k] for v in P) for k in range(3)]
        pmax = [max(v[k] for v in P) for k in range(3)]
        pa = add(b''.join(struct.pack('<3f', *v) for v in P), 'f', 5126, 'VEC3', len(P), 34962, (pmin, pmax))
        na = add(b''.join(struct.pack('<3f', *v) for v in N), 'f', 5126, 'VEC3', len(N), 34962)
        ua = add(b''.join(struct.pack('<2f', *v) for v in U), 'f', 5126, 'VEC2', len(U), 34962)
        ia = add(b''.join(struct.pack('<I', v) for v in I), 'I', 5125, 'SCALAR', len(I), 34963)
        prims.append({'attributes': {'POSITION': pa, 'NORMAL': na, 'TEXCOORD_0': ua}, 'indices': ia, 'material': mi})
    imgs = [png(64, 64, fabric), png(64, 64, wood)]
    gl = {
        'asset': {'version': '2.0', 'generator': 'AutoGroweHome test fixture (CC0)'},
        'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': name}],
        'meshes': [{'primitives': prims, 'name': name}],
        'materials': [
            {'name': 'fabric', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 0.9}},
            {'name': 'wood', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 1}, 'metallicFactor': 0, 'roughnessFactor': 0.6}},
        ],
        'textures': [{'source': 0}, {'source': 1}],
        'images': [{'uri': 'data:image/png;base64,' + base64.b64encode(d).decode()} for d in imgs],
        'buffers': [{'byteLength': len(buf), 'uri': 'data:application/octet-stream;base64,' + base64.b64encode(bytes(buf)).decode()}],
        'bufferViews': views, 'accessors': accs,
    }
    with open(out, 'w') as fh:
        json.dump(gl, fh)


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs(out, exist_ok=True)
    # sofa: 1.91 m wide, 1.05 m deep, 0.86 m high (the proportions of the built-in modular sofa),
    # front +z, origin on the floor in the middle
    w, d = 1.91, 1.05
    model([
        (0, [(-w / 2, 0.14, -d / 2, w / 2, 0.44, d / 2),            # seat
             (-w / 2, 0.44, -d / 2, w / 2, 0.86, -d / 2 + 0.22),      # back
             (-w / 2, 0.44, -d / 2, -w / 2 + 0.18, 0.62, d / 2),      # arms
             (w / 2 - 0.18, 0.44, -d / 2, w / 2, 0.62, d / 2)]),
        (1, [(x, 0, z, x + 0.05, 0.14, z + 0.05) for x in (-w / 2 + 0.05, w / 2 - 0.1) for z in (-d / 2 + 0.05, d / 2 - 0.1)]),
    ], os.path.join(out, 'test_sofa.gltf'), 'test_sofa')
    # coffee table: 1.1 x 0.6 x 0.42 (deliberately unlike the built-in one: the test expects it kept)
    model([
        (1, [(-0.55, 0.38, -0.3, 0.55, 0.42, 0.3)] + [(x, 0, z, x + 0.05, 0.38, z + 0.05) for x in (-0.5, 0.45) for z in (-0.25, 0.2)]),
        (0, [(-0.45, 0.12, -0.22, 0.45, 0.14, 0.22)]),
    ], os.path.join(out, 'test_table.gltf'), 'test_table')
    print('test models written to', out)


if __name__ == '__main__':
    main()
