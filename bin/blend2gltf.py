#!/usr/bin/env python3
"""
Minimal .blend (Blender 2.8x–3.x, the classic mesh layout: MVert / MLoop / MPoly / MLoopUV) to glTF
converter for the model catalogue – no Blender needed. Poly Haven also offers glTF directly; this is
for the case when only the .blend was downloaded.

Reads every mesh object (world matrix applied, Blender Z-up -> glTF Y-up), one primitive per material
slot, smooth / flat normals per face, the first UV layer. Textures are attached from the given files:

  bin/blend2gltf.py in.blend out.gltf --diff diff.jpg [--rough rough.jpg] [--normal nor_gl.png] [--size 1024]

The colour texture becomes the base colour, the roughness map the glTF metallic-roughness texture
(G = roughness, B = metallic 0), a normal map (OpenGL convention) the normal texture. Images are
resized to --size and embedded. Requires numpy and Pillow.
"""
import argparse
import base64
import gzip
import io
import json
import math
import struct
import sys

import numpy as np
from PIL import Image


class Blend:
    def __init__(self, data):
        if data[:2] == b'\x1f\x8b':
            data = gzip.decompress(data)
        if data[:7] != b'BLENDER':
            raise SystemExit('not a .blend file')
        self.d = data
        self.ps = 8 if data[7:8] == b'-' else 4
        self.e = '<' if data[8:9] == b'v' else '>'
        self.ver = data[9:12].decode()
        self.blocks, self.by_ptr = [], {}
        off = 12
        hsz = 16 + self.ps
        while off < len(data):
            code = data[off:off + 4]
            size, = struct.unpack(self.e + 'i', data[off + 4:off + 8])
            ptr, = struct.unpack(self.e + ('Q' if self.ps == 8 else 'I'), data[off + 8:off + 8 + self.ps])
            sdna, count = struct.unpack(self.e + 'ii', data[off + 8 + self.ps:off + hsz])
            b = {'code': code.rstrip(b'\0').decode('latin1'), 'size': size, 'ptr': ptr, 'sdna': sdna, 'count': count, 'off': off + hsz}
            self.blocks.append(b)
            if ptr:
                self.by_ptr[ptr] = b
            if code == b'ENDB':
                break
            off += hsz + size
        self._sdna()

    def _sdna(self):
        b = next(x for x in self.blocks if x['code'] == 'DNA1')
        d, o = self.d, b['off']
        assert d[o:o + 8] == b'SDNANAME'
        o += 8
        n, = struct.unpack(self.e + 'i', d[o:o + 4]); o += 4
        names = []
        for _ in range(n):
            j = d.index(b'\0', o); names.append(d[o:j].decode('latin1')); o = j + 1
        o = (o + 3) & ~3
        assert d[o:o + 4] == b'TYPE'; o += 4
        n, = struct.unpack(self.e + 'i', d[o:o + 4]); o += 4
        types = []
        for _ in range(n):
            j = d.index(b'\0', o); types.append(d[o:j].decode('latin1')); o = j + 1
        o = (o + 3) & ~3
        assert d[o:o + 4] == b'TLEN'; o += 4
        tlen = list(struct.unpack(self.e + '%dh' % len(types), d[o:o + 2 * len(types)])); o += 2 * len(types)
        o = (o + 3) & ~3
        assert d[o:o + 4] == b'STRC'; o += 4
        n, = struct.unpack(self.e + 'i', d[o:o + 4]); o += 4
        self.structs = []
        self.struct_by_name = {}
        for si in range(n):
            t, nf = struct.unpack(self.e + 'hh', d[o:o + 4]); o += 4
            fields, off = {}, 0
            for _ in range(nf):
                ft, fn = struct.unpack(self.e + 'hh', d[o:o + 4]); o += 4
                name = names[fn]
                ptr = name.startswith('*') or name.startswith('(*')
                arr = 1
                for part in name.split('[')[1:]:
                    arr *= int(part.split(']')[0])
                size = (self.ps if ptr else tlen[ft]) * arr
                clean = name.split('[')[0].lstrip('*').replace('(', '').replace(')', '').lstrip('*')
                fields[clean] = {'type': types[ft], 'off': off, 'size': size, 'ptr': ptr, 'arr': arr}
                off += size
            s = {'name': types[t], 'size': tlen[t], 'fields': fields}
            self.structs.append(s)
            self.struct_by_name[types[t]] = s

    def st(self, name):
        return self.struct_by_name[name]

    def get(self, base, sname, field):
        f = self.st(sname)['fields'][field]
        o = base + f['off']
        if f['ptr']:
            return struct.unpack(self.e + ('Q' if self.ps == 8 else 'I'), self.d[o:o + self.ps])[0]
        t = f['type']
        fmt = {'int': 'i', 'short': 'h', 'char': 'b', 'float': 'f', 'uchar': 'B', 'ushort': 'H', 'uint': 'I', 'double': 'd', 'int64_t': 'q', 'uint64_t': 'Q'}.get(t)
        if fmt is None:
            return o  # nested struct: its offset
        n = f['arr']
        v = struct.unpack(self.e + fmt * n, self.d[o:o + struct.calcsize(fmt) * n])
        return v[0] if n == 1 else v

    def string(self, base, sname, field):
        f = self.st(sname)['fields'][field]
        o = base + f['off']
        raw = self.d[o:o + f['size']]
        return raw.split(b'\0')[0].decode('utf-8', 'replace')

    def block(self, ptr):
        return self.by_ptr.get(ptr)


def mesh_data(bl, me_off):
    S = 'Mesh'
    tv, tl, tp = bl.get(me_off, S, 'totvert'), bl.get(me_off, S, 'totloop'), bl.get(me_off, S, 'totpoly')
    vb, lb, pb = bl.block(bl.get(me_off, S, 'mvert')), bl.block(bl.get(me_off, S, 'mloop')), bl.block(bl.get(me_off, S, 'mpoly'))
    if not (vb and lb and pb):
        return None
    sv, sl, sp = bl.st('MVert'), bl.st('MLoop'), bl.st('MPoly')
    co = np.zeros((tv, 3), np.float32)
    for i in range(tv):
        co[i] = bl.get(vb['off'] + i * sv['size'], 'MVert', 'co')
    loops = [bl.get(lb['off'] + i * sl['size'], 'MLoop', 'v') for i in range(tl)]
    polys = []
    for i in range(tp):
        o = pb['off'] + i * sp['size']
        polys.append((bl.get(o, 'MPoly', 'loopstart'), bl.get(o, 'MPoly', 'totloop'), bl.get(o, 'MPoly', 'mat_nr'), bl.get(o, 'MPoly', 'flag')))
    # first UV layer (CD_MLOOPUV = 16) in the loop custom data
    uv = None
    ld = bl.get(me_off, S, 'ldata')
    layers_ptr = bl.get(ld, 'CustomData', 'layers')
    nlay = bl.get(ld, 'CustomData', 'totlayer')
    lay_b = bl.block(layers_ptr)
    if lay_b:
        sz = bl.st('CustomDataLayer')['size']
        for k in range(nlay):
            lo = lay_b['off'] + k * sz
            if bl.get(lo, 'CustomDataLayer', 'type') == 16:
                ub = bl.block(bl.get(lo, 'CustomDataLayer', 'data'))
                su = bl.st('MLoopUV')['size']
                uv = np.array([bl.get(ub['off'] + i * su, 'MLoopUV', 'uv') for i in range(tl)], np.float32)
                break
    # material names of the slots
    mats = []
    mp = bl.block(bl.get(me_off, S, 'mat'))
    for k in range(bl.get(me_off, S, 'totcol')):
        mptr = struct.unpack(bl.e + ('Q' if bl.ps == 8 else 'I'), bl.d[mp['off'] + k * bl.ps:mp['off'] + (k + 1) * bl.ps])[0] if mp else 0
        mb = bl.block(mptr)
        mats.append(bl.string(mb['off'], 'Material', 'id')[2:] if mb else 'material')
    return {'co': co, 'loops': np.array(loops, np.int64), 'polys': polys, 'uv': uv, 'mats': mats or ['material']}


def convert(blend_path, out, diff, rough, normal, size):
    bl = Blend(open(blend_path, 'rb').read())
    prims_src = {}
    for b in bl.blocks:
        if b['code'] != 'OB':
            continue
        o = b['off']
        if bl.get(o, 'Object', 'type') != 1:  # OB_MESH
            continue
        me = bl.block(bl.get(o, 'Object', 'data'))
        if not me:
            continue
        md = mesh_data(bl, me['off'])
        if not md:
            continue
        m = np.array(bl.get(o, 'Object', 'obmat'), np.float32).reshape(4, 4).T  # column-major in file
        co = (np.c_[md['co'], np.ones(len(md['co']))] @ m.T)[:, :3]
        nm = np.linalg.inv(m[:3, :3]).T
        for ls, tl, mat, flag in md['polys']:
            idx = md['loops'][ls:ls + tl]
            pts = co[idx]
            n = np.zeros(3)
            for k in range(tl):  # Newell normal
                a, c = pts[k], pts[(k + 1) % tl]
                n += np.cross(a, c)
            ln = np.linalg.norm(n)
            n = n / ln if ln > 0 else np.array([0, 0, 1.0])
            key = md['mats'][mat] if mat < len(md['mats']) else md['mats'][0]
            P = prims_src.setdefault(key, {'p': [], 'n': [], 'uv': [], 'smooth': []})
            for k in range(1, tl - 1):
                for j in (0, k, k + 1):
                    P['p'].append(pts[j])
                    P['n'].append(n)
                    P['uv'].append(md['uv'][ls + j] if md['uv'] is not None else (0, 0))
                    P['smooth'].append((flag & 1, idx[j], id(md)))
    if not prims_src:
        raise SystemExit('no mesh found')
    # smooth faces: average the face normals around each vertex (per object, per position)
    for P in prims_src.values():
        acc = {}
        for i, (sm, vi, mid) in enumerate(P['smooth']):
            if sm:
                acc.setdefault((mid, vi), np.zeros(3))
                acc[(mid, vi)] += P['n'][i]
        for i, (sm, vi, mid) in enumerate(P['smooth']):
            if sm:
                v = acc[(mid, vi)]
                ln = np.linalg.norm(v)
                if ln > 0:
                    P['n'][i] = v / ln

    def zup(a):  # Blender Z-up -> glTF Y-up
        a = np.asarray(a, np.float32)
        return np.c_[a[:, 0], a[:, 2], -a[:, 1]]

    buf = bytearray()
    views, accs, prims = [], [], []

    def add(arr, comp, typ, target, mm=False):
        while len(buf) % 4:
            buf.append(0)
        data = arr.tobytes()
        views.append({'buffer': 0, 'byteOffset': len(buf), 'byteLength': len(data), 'target': target})
        buf.extend(data)
        a = {'bufferView': len(views) - 1, 'componentType': comp, 'count': int(arr.shape[0]), 'type': typ}
        if mm:
            a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
        accs.append(a)
        return len(accs) - 1

    for mi, (name, P) in enumerate(prims_src.items()):
        pos = zup(P['p'])
        nor = zup(P['n'])
        uv = np.asarray(P['uv'], np.float32).copy()
        uv[:, 1] = 1.0 - uv[:, 1]  # glTF UV origin top-left
        ind = np.arange(len(pos), dtype=np.uint32)
        prims.append({'attributes': {'POSITION': add(pos, 5126, 'VEC3', 34962, True), 'NORMAL': add(nor.astype(np.float32), 5126, 'VEC3', 34962), 'TEXCOORD_0': add(uv, 5126, 'VEC2', 34962)},
                      'indices': add(ind, 5125, 'SCALAR', 34963), 'material': 0})
    # textures
    images, textures = [], []

    def img(path, mode, fn=None):
        im = Image.open(path).convert(mode)
        if fn:
            im = fn(im)
        im = im.resize((size, size), Image.LANCZOS)
        bio = io.BytesIO()
        im.save(bio, 'PNG' if mode != 'RGB' or fn else 'JPEG', **({} if fn or mode != 'RGB' else {'quality': 92}))
        images.append({'uri': ('data:image/png;base64,' if fn or mode != 'RGB' else 'data:image/jpeg;base64,') + base64.b64encode(bio.getvalue()).decode()})
        textures.append({'source': len(images) - 1})
        return len(textures) - 1

    pbr = {'metallicFactor': 0.0, 'roughnessFactor': 1.0}
    mat = {'name': next(iter(prims_src.keys())), 'pbrMetallicRoughness': pbr}
    if diff:
        pbr['baseColorTexture'] = {'index': img(diff, 'RGB')}
    if rough:
        def mr(im):  # G = roughness, B = metallic (0)
            g = np.asarray(im.convert('L'))
            z = np.zeros_like(g)
            return Image.fromarray(np.dstack([z, g, z]).astype(np.uint8), 'RGB')
        pbr['metallicRoughnessTexture'] = {'index': img(rough, 'RGB', mr)}
        pbr['metallicFactor'] = 1.0
    if normal:
        mat['normalTexture'] = {'index': img(normal, 'RGB', lambda im: im)}
    gl = {'asset': {'version': '2.0', 'generator': 'AutoGroweHome blend2gltf'}, 'scene': 0, 'scenes': [{'nodes': [0]}],
          'nodes': [{'mesh': 0, 'name': mat['name']}], 'meshes': [{'primitives': prims, 'name': mat['name']}],
          'materials': [mat], 'textures': textures, 'images': images,
          'buffers': [{'byteLength': len(buf), 'uri': 'data:application/octet-stream;base64,' + base64.b64encode(bytes(buf)).decode()}],
          'bufferViews': views, 'accessors': accs}
    json.dump(gl, open(out, 'w'))
    tris = sum(len(P['p']) for P in prims_src.values()) // 3
    allp = zup(np.concatenate([np.asarray(P['p']) for P in prims_src.values()]))
    s = allp.max(0) - allp.min(0)
    print(f'{out}: Blender {bl.ver}, {len(prims_src)} anyag ({", ".join(prims_src)}), {tris} háromszög, méret {s[0]:.2f} x {s[2]:.2f} x {s[1]:.2f} m (sz x m x mag)')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('blend'); ap.add_argument('out')
    ap.add_argument('--diff'); ap.add_argument('--rough'); ap.add_argument('--normal')
    ap.add_argument('--size', type=int, default=1024)
    a = ap.parse_args()
    convert(a.blend, a.out, a.diff, a.rough, a.normal, a.size)
