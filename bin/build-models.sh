#!/usr/bin/env bash
# Builds the web files of the real 3D model catalogue from incoming/models/<id>/ (bin/fetch-models.sh):
#   triangle budget (20 000; simplified when over) -> textures 1024 px ("hi") and 512 px ("lo") ->
#   KTX2 / Basis Universal (colour ETC1S, normal maps UASTC) -> Meshopt geometry -> .glb
# Output names carry a content hash (long browser caching), old files of the same model are removed,
# and size, triangles and bytes go into assets/models/manifest.json. Finally the catalogue is checked
# (CC0 only, source URL, budgets: 200 KB hi, 100 KB lo, 10 MB in all).
#
# Usage: bin/build-models.sh [id ...]      (default: every model in the manifest)
set -euo pipefail
cd "$(dirname "$0")/.."
GP="${GLTFPACK:-$(bin/build-tools.sh)}"
OUT=assets/models
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
ids=("$@")
if [ ${#ids[@]} -eq 0 ]; then mapfile -t ids < <(python3 -c "import json;[print(e['id']) for e in json.load(open('$OUT/manifest.json'))['models']]"); fi
for id in "${ids[@]}"; do
	src="$(find "incoming/models/$id" -type f \( -name '*.gltf' -o -name '*.glb' \) 2>/dev/null | sort | head -1)"
	if [ -z "$src" ]; then echo "$id: no source in incoming/models/$id (bin/fetch-models.sh)"; continue; fi
	tris="$(python3 bin/models-tool.py info "$src" | python3 -c 'import json,sys;print(json.load(sys.stdin)["tris"])')"
	si="$(python3 -c "print(min(1.0, 20000/max(1,$tris)))")"
	sil="$(python3 -c "print(min(1.0, 12000/max(1,$tris)))")"
	# hi: 1024 px textures; lo: 512 px and fewer triangles (phones, weak devices)
	"$GP" -i "$src" -o "$TMP/$id-hi.glb" -c -tc -tu normal -tl 1024 -si "$si" -v > "$TMP/$id-hi.log" 2>&1
	"$GP" -i "$src" -o "$TMP/$id-lo.glb" -c -tc -tu normal -tl 512 -si "$sil" -v > "$TMP/$id-lo.log" 2>&1
	out_tris="$(grep -m1 '^output: .*mesh primitives' "$TMP/$id-hi.log" | sed -E 's/.*\(([0-9]+) triangles.*/\1/')"
	rm -f "$OUT/$id"-hi-*.glb "$OUT/$id"-lo-*.glb
	hh="$(sha256sum "$TMP/$id-hi.glb" | cut -c1-8)"; lh="$(sha256sum "$TMP/$id-lo.glb" | cut -c1-8)"
	cp "$TMP/$id-hi.glb" "$OUT/$id-hi-$hh.glb"; cp "$TMP/$id-lo.glb" "$OUT/$id-lo-$lh.glb"
	python3 - "$id" "$OUT/$id-hi-$hh.glb" "$OUT/$id-lo-$lh.glb" "$src" "$out_tris" <<'PY'
import json, os, subprocess, sys
mid, hi, lo, src, tris = sys.argv[1:6]
p = 'assets/models/manifest.json'
m = json.load(open(p, encoding='utf-8'))
inf = json.loads(subprocess.check_output(['python3', 'bin/models-tool.py', 'info', src]))
for e in m['models']:
    if e['id'] == mid:
        e['files'] = {'hi': os.path.basename(hi), 'lo': os.path.basename(lo)}
        e['tris'] = int(tris or inf['tris']); e['size'] = inf['size']
        e['bytes'] = {'hi': os.path.getsize(hi), 'lo': os.path.getsize(lo)}
        print(f"{mid}: {e['tris']} háromszög, {e['bytes']['hi']} / {e['bytes']['lo']} B, {e['size']} m")
json.dump(m, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
open(p, 'a').write('\n')
PY
done
python3 bin/models-tool.py check
