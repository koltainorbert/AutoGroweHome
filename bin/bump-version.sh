#!/usr/bin/env bash
# Raises the plugin version in every place it is recorded:
#   autogrowehome.php (header "Version:" + AGH_VERSION), readme.txt (Stable tag + changelog entry),
#   CHANGELOG.md (new section at the top, if not there yet).
#
# Usage: bin/bump-version.sh [patch|minor|major|X.Y.Z]   (default: patch)
# Every release ZIP gets a new version; bin/build-zip.sh refuses to rebuild a released version.
set -euo pipefail

cd "$(dirname "$0")/.."

CUR="$(sed -n "s/^define( 'AGH_VERSION', '\([^']*\)' );.*/\1/p" autogrowehome.php)"
if ! [[ "$CUR" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
	echo "Current version not found or not X.Y.Z: '$CUR'" >&2
	exit 1
fi
MA="${BASH_REMATCH[1]}"; MI="${BASH_REMATCH[2]}"; PA="${BASH_REMATCH[3]}"

case "${1:-patch}" in
	patch) NEW="$MA.$MI.$((PA + 1))" ;;
	minor) NEW="$MA.$((MI + 1)).0" ;;
	major) NEW="$((MA + 1)).0.0" ;;
	*)
		if [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then NEW="$1"; else echo "Usage: $0 [patch|minor|major|X.Y.Z]" >&2; exit 1; fi
		;;
esac
if [ "$NEW" = "$CUR" ]; then echo "Version is already $CUR" >&2; exit 1; fi

TODAY="$(date +%Y-%m-%d)"

sed -i -E "s/^( \* Version:[[:space:]]+)$CUR\$/\1$NEW/" autogrowehome.php
sed -i "s/^define( 'AGH_VERSION', '$CUR' );/define( 'AGH_VERSION', '$NEW' );/" autogrowehome.php
sed -i "s/^Stable tag: $CUR\$/Stable tag: $NEW/" readme.txt

# readme.txt: changelog entry right after "== Changelog =="
if ! grep -q "^= $NEW =\$" readme.txt; then
	sed -i "/^== Changelog ==\$/{n;s/^\$/\n= $NEW =\n* Részletek: CHANGELOG.md.\n/}" readme.txt
fi

# CHANGELOG.md: new section above the newest one
if ! grep -q "^## $NEW " CHANGELOG.md; then
	awk -v v="$NEW" -v d="$TODAY" 'BEGIN{done=0} /^## / && !done {print "## " v " – " d "\n\n- \n"; done=1} {print}' CHANGELOG.md > CHANGELOG.md.tmp && mv CHANGELOG.md.tmp CHANGELOG.md
fi

# all three must agree now
H="$(sed -n -E 's/^ \* Version:[[:space:]]+([^[:space:]]+).*/\1/p' autogrowehome.php)"
C="$(sed -n "s/^define( 'AGH_VERSION', '\([^']*\)' );.*/\1/p" autogrowehome.php)"
R="$(sed -n 's/^Stable tag: //p' readme.txt)"
if [ "$H" != "$NEW" ] || [ "$C" != "$NEW" ] || [ "$R" != "$NEW" ]; then
	echo "Version mismatch after bump: header=$H constant=$C readme=$R" >&2
	exit 1
fi
echo "$CUR -> $NEW  (autogrowehome.php, readme.txt, CHANGELOG.md – fill in the CHANGELOG entry)"
