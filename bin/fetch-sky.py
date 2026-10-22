#!/usr/bin/env python3
"""
AutoGroweHome – CC0 sky pictures (HDRI) for the 3D preview: download, measure, convert.

The skies come from Poly Haven (CC0). The raw .hdr files are downloaded OUTSIDE the repository
(default: /home/claude/sky-src/raw/<asset>/, every asset in its own new, empty directory) and are
never committed. What goes into the plugin is a small, strongly compressed equirectangular WebP per
sky in assets/sky/ plus assets/sky/manifest.json (source URL, licence, md5 of the source and of the
output, the logarithmic range needed to decode it, the measured sun direction and mean brightness).

Encoding ("log-WebP"): every channel is stored as log2 of its linear value, mapped from [lo, hi] to
0–255, as a lossy WebP. The browser turns each byte back into a linear value with a 256-entry lookup
table (agh-3d-sky.js). The sun disk is clipped to `clip` × the mean sky brightness: the scene's own
sun light (DirectionalLight) gives the direct light and the shadows, the picture gives the sky.

Usage (run with python3 -I; needs numpy and Pillow with WebP):
  python3 -I bin/fetch-sky.py probe <asset> [<asset> …]     measure candidates (sun elevation, range)
  python3 -I bin/fetch-sky.py build                          download the chosen skies, write assets/sky/
Options: --src DIR (raw downloads), --width 2048|1024, --quality 0–100
"""
import hashlib
import json
import os
import sys
import urllib.request

import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, 'assets', 'sky')
API = 'https://api.polyhaven.com'

# time of day / weather → Poly Haven asset (the "puresky" versions: sky only, no ground in the picture)
SKIES = {
    'morning': 'qwantani_morning_puresky',          # sun at 20° (the scene's morning sun: 20°)
    'midday': 'kloofendal_48d_partly_cloudy_puresky',   # 48° (55°), a few clouds
    'midday_clear': 'kloofendal_43d_clear_puresky',     # 43° (55°), weather "clear"
    'golden': 'hilly_terrain_01_puresky',           # 12° (13°)
    'blue': 'qwantani_dusk_2_puresky',              # sun below the horizon
    'night': 'kloppenheim_02_puresky',              # moon and stars
    'overcast': 'kloofendal_overcast_puresky',      # any time of day with weather "overcast"
}


def arg(name, default):
    if name in sys.argv:
        i = sys.argv.index(name)
        return sys.argv[i + 1]
    return default


def fetch_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'AutoGroweHome-build/1.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode('utf-8'))


def download(asset, res, src):
    """The asset's .hdr of resolution `res` into its own directory; returns (path, url, md5)."""
    files = fetch_json(API + '/files/' + asset)
    info = files['hdri'][res]['hdr']
    url = info['url']
    if not url.startswith('https://dl.polyhaven.org/'):
        raise SystemExit('unexpected download host: ' + url)
    d = os.path.join(src, asset)
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, asset + '_' + res + '.hdr')
    if not os.path.exists(path):
        req = urllib.request.Request(url, headers={'User-Agent': 'AutoGroweHome-build/1.0'})
        with urllib.request.urlopen(req, timeout=300) as r, open(path + '.part', 'wb') as fh:
            while True:
                b = r.read(1 << 20)
                if not b:
                    break
                fh.write(b)
        os.replace(path + '.part', path)
    md5 = hashlib.md5(open(path, 'rb').read()).hexdigest()
    if info.get('md5') and info['md5'] != md5:
        raise SystemExit('md5 mismatch for ' + asset)
    return path, url, md5


def read_hdr(path):
    """Radiance RGBE (.hdr, new-style RLE or flat) → float32 array (H, W, 3), linear."""
    with open(path, 'rb') as fh:
        data = fh.read()
    if not (data.startswith(b'#?RADIANCE') or data.startswith(b'#?RGBE')):
        raise ValueError('not a Radiance file')
    pos = 0
    W = H = 0
    for _ in range(64):
        e = data.index(b'\n', pos)
        line = data[pos:e]
        pos = e + 1
        if line.startswith(b'-Y '):
            parts = line.split()
            H, W = int(parts[1]), int(parts[3])
            break
    if not (0 < W <= 16384 and 0 < H <= 8192):
        raise ValueError('bad size')
    buf = np.frombuffer(data, dtype=np.uint8, offset=pos)
    out = np.zeros((H, W, 4), dtype=np.uint8)
    p = 0
    for y in range(H):
        if buf[p] == 2 and buf[p + 1] == 2 and ((int(buf[p + 2]) << 8) | int(buf[p + 3])) == W:
            p += 4
            for ch in range(4):
                x = 0
                row = out[y, :, ch]
                while x < W:
                    n = int(buf[p])
                    p += 1
                    if n > 128:
                        n -= 128
                        row[x:x + n] = buf[p]
                        p += 1
                    else:
                        row[x:x + n] = buf[p:p + n]
                        p += n
                    x += n
        else:
            out[y] = buf[p:p + W * 4].reshape(W, 4)
            p += W * 4
    e = out[..., 3].astype(np.int32)
    f = np.where(e > 0, np.ldexp(np.float32(1.0), e - 136), 0.0).astype(np.float32)
    return out[..., :3].astype(np.float32) * f[..., None]


def lum(img):
    return img @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)


def box_down(img, k):
    H, W, C = img.shape
    return img[:H // k * k, :W // k * k].reshape(H // k, k, W // k, k, C).mean(axis=(1, 3))


def measure(img):
    """Sun (brightest direction after a blur) as u (0–1 across) and elevation (deg), sky mean, ranges."""
    H, W, _ = img.shape
    small = box_down(img, max(1, W // 256))
    Y = lum(small)
    h, w = Y.shape
    # upper hemisphere only, a little below the horizon too (a sun just set still lights it)
    Yu = Y[: int(h * 0.56)]
    i = int(np.argmax(Yu))
    r, c = divmod(i, w)
    el = 90.0 - (r + 0.5) / h * 180.0
    u = (c + 0.5) / w
    rows = (np.arange(h // 2) + 0.5) / h
    wt = np.cos(np.radians(90.0 - rows * 180.0))[:, None]
    full = lum(img)
    mean = float((Y[: h // 2] * wt).sum() / (wt.sum() * w))
    return {'u': round(u, 4), 'el': round(el, 1), 'mean': mean, 'peak': float(full.max()), 'median': float(np.median(full[: H // 2]))}


def encode(img, width, quality, clip):
    """Clip the sun, scale to `width`, log2-encode to 8 bit; returns (PIL image, lo, hi, mean after clip)."""
    H, W, _ = img.shape
    m = measure(img)
    cap = m['mean'] * clip
    Y = lum(img)
    k = np.where(Y > cap, cap / np.maximum(Y, 1e-12), 1.0).astype(np.float32)
    img = img * k[..., None]
    if W != width:
        f = W // width
        img = box_down(img, f) if f >= 2 and W % width == 0 else np.asarray(Image.fromarray(img.astype(np.float32)[..., 0]).resize((width, width // 2)))
    L = np.log2(np.maximum(img, 1e-9))
    lo = float(np.floor(np.percentile(L, 0.02) * 4) / 4)
    hi = float(np.ceil(L.max() * 4) / 4)
    q = np.clip(np.round((L - lo) / (hi - lo) * 255.0), 0, 255).astype(np.uint8)
    pil = Image.fromarray(q, 'RGB')
    after = measure(img)
    return pil, lo, hi, after['mean']


def probe(src):
    for a in [x for x in sys.argv[2:] if not x.startswith('--')]:
        path, url, md5 = download(a, '1k', src)
        img = read_hdr(path)
        m = measure(img)
        print('%-42s sun el %5.1f u %.3f  mean %.4f  median %.4f  peak %.1f' % (a, m['el'], m['u'], m['mean'], m['median'], m['peak']))


def build(src):
    width = int(arg('--width', '2048'))
    quality = int(arg('--quality', '82'))
    clip = float(arg('--clip', '24'))
    res = '2k' if width > 1024 else '1k'
    os.makedirs(OUT, exist_ok=True)
    man = {'format': 'log2-rgb-webp', 'license': 'CC0 1.0 Universal (public domain)', 'source': 'https://polyhaven.com', 'skies': {}}
    total = 0
    for key, asset in SKIES.items():
        path, url, md5 = download(asset, res, src)
        img = read_hdr(path)
        sun = measure(img)
        pil, lo, hi, mean = encode(img, width, quality, clip)
        name = 'sky-' + key + '.webp'
        out = os.path.join(OUT, name)
        pil.save(out, 'WEBP', quality=quality, method=6)
        data = open(out, 'rb').read()
        total += len(data)
        meta = fetch_json(API + '/info/' + asset)
        man['skies'][key] = {
            'file': name, 'w': pil.size[0], 'h': pil.size[1], 'lo': lo, 'hi': hi, 'mean': round(mean, 6),
            'sun': {'u': sun['u'], 'el': sun['el']},
            'asset': asset, 'name': meta.get('name', asset), 'authors': sorted((meta.get('authors') or {}).keys()),
            'url': 'https://polyhaven.com/a/' + asset, 'download': url, 'license': 'CC0',
            'md5_source': md5, 'md5': hashlib.md5(data).hexdigest(), 'bytes': len(data),
        }
        print('%-9s %-40s %4d KB  sun el %5.1f  range 2^%.2f…2^%.2f' % (key, asset, len(data) // 1024, sun['el'], lo, hi))
    with open(os.path.join(OUT, 'manifest.json'), 'w') as fh:
        json.dump(man, fh, indent=1, ensure_ascii=False)
        fh.write('\n')
    with open(os.path.join(OUT, 'LICENSE.txt'), 'w') as fh:
        fh.write('The sky pictures in this folder (sky-*.webp) are converted from HDRIs of Poly Haven\n'
                 '(https://polyhaven.com), published under CC0 1.0 Universal (public domain dedication):\n'
                 'https://creativecommons.org/publicdomain/zero/1.0/\n\n')
        for key, s in man['skies'].items():
            fh.write('%s: "%s" by %s – %s\n' % (s['file'], s['name'], ', '.join(s['authors']), s['url']))
        fh.write('\nNo attribution is required by the licence; it is given here as a courtesy.\n')
    print('összesen %d KB (%d égbolt)' % (total // 1024, len(SKIES)))


if __name__ == '__main__':
    src = arg('--src', '/home/claude/sky-src/raw')
    os.makedirs(src, exist_ok=True)
    mode = sys.argv[1] if len(sys.argv) > 1 else ''
    if mode == 'probe':
        probe(src)
    elif mode == 'build':
        build(src)
    else:
        print(__doc__)
