#!/usr/bin/env bash
# Throwaway WordPress for development tests: WordPress + SQLite, PHP built-in server,
# this repository symlinked as the plugin, a page with [autogrowehome] at /tervezo/,
# the test image provider active and generous limits.
#
# Usage:  bin/test-wp.sh [target_dir] [port]        (defaults: /home/claude/wpsite 8899)
# Then:   AGH_URL=http://127.0.0.1:8899/tervezo/ node tests/e2e/wizard.js /tmp
# Admin:  admin / admin123
#
# Needs: php (pdo_sqlite, mbstring), git, network access to github.com.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
W="${1:-/home/claude/wpsite}"
PORT="${2:-8899}"
SRC="$(dirname "$W")/wp-src"
WP_TAG="6.8.3"

mkdir -p "$SRC"
[ -d "$SRC/wp" ] || git clone -q --depth 1 --branch "$WP_TAG" https://github.com/WordPress/WordPress.git "$SRC/wp"
[ -d "$SRC/sqlite" ] || git clone -q --depth 1 https://github.com/WordPress/sqlite-database-integration.git "$SRC/sqlite"

rm -rf "$W"
cp -a "$SRC/wp" "$W"
rm -rf "$W/.git"
mkdir -p "$W/wp-content/plugins" "$W/wp-content/database"
P="$W/wp-content/plugins/sqlite-database-integration"
# The plugin lives in a monorepo package and symlinks its engine: copy with links resolved.
cp -aL "$SRC/sqlite/packages/plugin-sqlite-database-integration" "$P"
sed -e "s|{SQLITE_IMPLEMENTATION_FOLDER_PATH}|$P|; s|{SQLITE_PLUGIN}|sqlite-database-integration/load.php|" "$P/db.copy" > "$W/wp-content/db.php"
ln -s "$REPO" "$W/wp-content/plugins/autogrowehome"

cat > "$W/wp-config.php" <<EOF
<?php
define('DB_NAME','wp'); define('DB_USER','x'); define('DB_PASSWORD','x'); define('DB_HOST','localhost');
define('DB_CHARSET','utf8mb4'); define('DB_COLLATE','');
define('DB_DIR', __DIR__ . '/wp-content/database/'); define('DB_FILE','wp.sqlite');
\$table_prefix = 'wp_';
foreach (array('AUTH_KEY','SECURE_AUTH_KEY','LOGGED_IN_KEY','NONCE_KEY','AUTH_SALT','SECURE_AUTH_SALT','LOGGED_IN_SALT','NONCE_SALT') as \$k) { define(\$k, 'test-only-' . \$k); }
define('WP_DEBUG', true); define('WP_DEBUG_LOG', __DIR__ . '/debug.log'); define('WP_DEBUG_DISPLAY', false);
define('WP_HOME','http://127.0.0.1:$PORT'); define('WP_SITEURL','http://127.0.0.1:$PORT');
define('DISABLE_WP_CRON', true); define('AGH_OWNER_MODE', true);
if ( ! defined('ABSPATH') ) define('ABSPATH', __DIR__ . '/');
require_once ABSPATH . 'wp-settings.php';
EOF

cat > "$W/agh-router.php" <<'EOF'
<?php
$p = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$f = __DIR__ . $p;
if ($p !== '/' && file_exists($f) && !is_dir($f)) { return false; }
if (is_dir($f) && file_exists(rtrim($f, '/') . '/index.php')) { $_SERVER['SCRIPT_NAME'] = rtrim($p, '/') . '/index.php'; require rtrim($f, '/') . '/index.php'; return; }
$_SERVER['SCRIPT_NAME'] = '/index.php';
require __DIR__ . '/index.php';
EOF

cat > "$W/agh-install.php" <<EOF
<?php
define('WP_INSTALLING', true);
\$_SERVER['HTTP_HOST'] = '127.0.0.1:$PORT'; \$_SERVER['REQUEST_URI'] = '/';
require __DIR__ . '/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/upgrade.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';
if (!is_blog_installed()) { wp_install('AGH teszt', 'admin', 'admin@example.com', true, '', 'admin123'); }
update_option('permalink_structure', '/%postname%/');
\$r = activate_plugin('autogrowehome/autogrowehome.php');
if (is_wp_error(\$r)) { fwrite(STDERR, \$r->get_error_message() . "\n"); exit(1); }
wp_insert_post(array('post_title' => 'Tervező', 'post_name' => 'tervezo', 'post_content' => '[autogrowehome]', 'post_status' => 'publish', 'post_type' => 'page'));
\$img = \AutoGroweHome\Support\Settings::all()['images']; \$img['active_provider'] = 'test';
\AutoGroweHome\Support\Settings::update_group('images', \$img);
\$l = \AutoGroweHome\Support\Settings::all()['limits']; \$l['ip_daily'] = 1000; \$l['burst_max'] = 100; \$l['concurrent_per_ip'] = 10;
\AutoGroweHome\Support\Settings::update_group('limits', \$l);
echo "plugin active, test provider on\n";
EOF
(cd "$W" && php agh-install.php 2>&1 | grep -v sendmail)

pkill -f "[p]hp -S 127.0.0.1:$PORT" 2>/dev/null || true
(cd "$W" && PHP_CLI_SERVER_WORKERS=4 nohup php -S "127.0.0.1:$PORT" agh-router.php < /dev/null > "$W/server.log" 2>&1 &)
sleep 1
echo "http://127.0.0.1:$PORT/tervezo/  ($(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/tervezo/"))"
