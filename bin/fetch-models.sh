#!/usr/bin/env bash
# Brings the source models of the catalogue into incoming/models/<id>/ (never into the repo).
# For an entry with "download" + "sha256" in assets/models/manifest.json the file is downloaded and
# checked; with --from <dir> the files (or ZIPs) someone downloaded by hand are taken from there: a ZIP
# or folder whose name contains the model's id (e.g. sofa_02_1k.gltf.zip for "sofa_02").
#
# Usage: bin/fetch-models.sh [--from <dir>]
set -euo pipefail
cd "$(dirname "$0")/.."
IN=incoming/models
mkdir -p "$IN"
FROM=""
if [ "${1:-}" = "--from" ]; then FROM="${2:?}"; fi
python3 - "$IN" "$FROM" <<'PY'
import hashlib, json, os, shutil, subprocess, sys, zipfile
inc, src = sys.argv[1], sys.argv[2]
m = json.load(open('assets/models/manifest.json', encoding='utf-8'))
ok = miss = 0
for e in m.get('models', []):
    i = e['id']; dst = os.path.join(inc, i)
    if os.path.isdir(dst) and any(f.endswith(('.gltf', '.glb')) for _, _, fs in os.walk(dst) for f in fs):
        ok += 1; continue
    got = None
    if src:
        for name in sorted(os.listdir(src)):
            if i in name:
                got = os.path.join(src, name); break
    elif e.get('download'):
        got = os.path.join(inc, i + '.download')
        subprocess.run(['curl', '-fsSL', '-o', got, e['download']], check=True)
        h = hashlib.sha256(open(got, 'rb').read()).hexdigest()
        if e.get('sha256') and h != e['sha256']:
            print(f'{i}: sha256 mismatch'); os.remove(got); miss += 1; continue
    if not got:
        print(f'{i}: no source (put it in {dst}/ or use --from)'); miss += 1; continue
    os.makedirs(dst, exist_ok=True)
    if os.path.isdir(got):
        shutil.copytree(got, dst, dirs_exist_ok=True)
    elif zipfile.is_zipfile(got):
        with zipfile.ZipFile(got) as z:
            for n in z.namelist():
                if '..' in n or n.startswith('/'):
                    raise SystemExit(f'{i}: unsafe path in zip: {n}')
            z.extractall(dst)
    else:
        shutil.copy(got, dst)
    ok += 1
print(f'források: {ok} megvan, {miss} hiányzik')
sys.exit(1 if miss else 0)
PY
