#!/usr/bin/env bash
# Raises the version of the AGH Licencközpont (license-hub/): plugin header, AGHLS_VERSION,
# readme.txt Stable tag and a new readme changelog entry.
# Usage: bin/bump-hub-version.sh [patch|minor|major|X.Y.Z]   (default: patch)
set -euo pipefail
cd "$(dirname "$0")/.."
F=license-hub/agh-license-hub.php; R=license-hub/readme.txt
CUR="$(sed -n "s/^define( 'AGHLS_VERSION', '\([^']*\)' );.*/\1/p" "$F")"
[[ "$CUR" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]] || { echo "Current version not X.Y.Z: '$CUR'" >&2; exit 1; }
MA="${BASH_REMATCH[1]}"; MI="${BASH_REMATCH[2]}"; PA="${BASH_REMATCH[3]}"
case "${1:-patch}" in
	patch) NEW="$MA.$MI.$((PA + 1))" ;; minor) NEW="$MA.$((MI + 1)).0" ;; major) NEW="$((MA + 1)).0.0" ;;
	*) [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] && NEW="$1" || { echo "Usage: $0 [patch|minor|major|X.Y.Z]" >&2; exit 1; } ;;
esac
[ "$NEW" != "$CUR" ] || { echo "Version is already $CUR" >&2; exit 1; }
sed -i -E "s/^( \* Version:[[:space:]]+)$CUR\$/\1$NEW/" "$F"
sed -i "s/^define( 'AGHLS_VERSION', '$CUR' );/define( 'AGHLS_VERSION', '$NEW' );/" "$F"
sed -i "s/^Stable tag: $CUR\$/Stable tag: $NEW/" "$R"
grep -q "^= $NEW =\$" "$R" || sed -i "/^== Changelog ==\$/{n;s/^\$/\n= $NEW =\n* \n/}" "$R"
echo "$CUR -> $NEW  (license-hub: header, AGHLS_VERSION, readme.txt – fill in the changelog entry)"
