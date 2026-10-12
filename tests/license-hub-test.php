<?php
/**
 * End-to-end test of the AGH Licencközpont (license-hub/) together with the real AutoGroweHome client
 * (includes/License/LicenseManager.php): the client's HTTP calls are routed into the hub's REST API
 * in-process, so signatures, nonces, instance ids and the canonical JSON are checked for real.
 *
 * Usage: php tests/license-hub-test.php [/path/to/test/wordpress]   (default: /home/claude/wpsite, made by bin/test-wp.sh)
 * The hub plugin must be reachable as wp-content/plugins/agh-license-hub (the script links it).
 */

$agh_wp_dir = $argv[1] ?? '/home/claude/wpsite';
$hub_link = $agh_wp_dir . '/wp-content/plugins/agh-license-hub';
if ( ! file_exists( $hub_link ) ) {
	symlink( dirname( __DIR__ ) . '/license-hub', $hub_link );
}
define( 'AGHLS_TESTING', true );
$_SERVER['HTTP_HOST']   = '127.0.0.1:8899';
$_SERVER['REQUEST_URI'] = '/';
$_SERVER['REMOTE_ADDR'] = '203.0.113.7';
require $agh_wp_dir . '/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';

$pass = 0; $fail = 0;
function t( $ok, $name ) {
	global $pass, $fail;
	if ( $ok ) { $pass++; } else { $fail++; echo "FAIL: $name\n"; }
}

$r = activate_plugin( 'agh-license-hub/agh-license-hub.php' );
t( ! is_wp_error( $r ), 'Hub plugin activates' );
if ( ! class_exists( 'AGHLS_Store' ) ) {
	require_once $hub_link . '/agh-license-hub.php';
}
AGHLS_Store::install();
do_action( 'rest_api_init' );
update_option( 'aghls_rate_limit', 0 );

// Fresh tables for a repeatable run.
global $wpdb;
foreach ( array( 'licenses', 'activations', 'releases', 'log' ) as $tb ) { $wpdb->query( 'DELETE FROM ' . AGHLS_Store::t( $tb ) ); }

// Route the client's requests to https://hub.test/wp-json/aghls/... into the REST server.
$base = 'https://hub.test/wp-json/aghls';
add_filter( 'pre_http_request', function ( $pre, $args, $url ) use ( $base ) {
	if ( 0 !== strpos( $url, $base ) ) { return $pre; }
	$route = '/aghls' . substr( $url, strlen( $base ) );
	$req   = new WP_REST_Request( $args['method'] ?? 'GET', $route );
	foreach ( (array) ( $args['headers'] ?? array() ) as $k => $v ) { $req->set_header( $k, $v ); }
	if ( ! empty( $args['body'] ) ) { $req->set_body( is_string( $args['body'] ) ? $args['body'] : wp_json_encode( $args['body'] ) ); $req->set_header( 'content-type', 'application/json' ); }
	$res  = rest_do_request( $req );
	$data = rest_get_server()->response_to_data( $res, false );
	return array( 'headers' => array(), 'body' => wp_json_encode( $data ), 'response' => array( 'code' => $res->get_status(), 'message' => '' ), 'cookies' => array(), 'filename' => null );
}, 10, 3 );
// The hub builds package URLs from rest_url(); make them match the client's configured base.
add_filter( 'rest_url', function ( $url ) use ( $base ) { return str_replace( get_option( 'home' ) . '/wp-json/aghls', $base, $url ); }, 20 );

use AutoGroweHome\License\LicenseManager;
use AutoGroweHome\Support\Secrets;

update_option( 'agh_license_server', array( 'url' => $base, 'public_key' => AGHLS_Crypto::public_key() ), false );
delete_option( 'agh_license' );
delete_site_transient( 'agh_update_info' );
$inst1 = LicenseManager::instance_id();

t( AGHLS_Api::base_url() === $base, 'Hub base URL as the client expects it' );
t( (bool) preg_match( '/^AGH(-[A-Z2-9]{5}){4}$/', AGHLS_Crypto::new_license_key() ), 'Key format AGH-XXXXX-XXXXX-XXXXX-XXXXX' );

// 1. Activation (Professional, 1 site)
list( $id, $key ) = AGHLS_Store::create( array( 'customer' => 'Teszt Kft.', 'email' => 'teszt@example.com', 'plan' => 'professional', 'billing_cycle' => 'yearly', 'expires_at' => gmdate( 'Y-m-d', strtotime( '+1 year' ) ), 'sites_allowed' => 1, 'updates' => 1 ) );
t( $id > 0 && AGHLS_Store::plain_key( AGHLS_Store::get( $id ) ) === $key, 'Key is stored encrypted and can be shown again' );
t( AGHLS_Store::get( $id )['key_hash'] !== $key && strlen( AGHLS_Store::get( $id )['key_hash'] ) === 64, 'Only the HMAC of the key is searchable' );
$res = LicenseManager::activate( strtolower( $key ) ); // keys are case-insensitive
$s   = LicenseManager::state();
t( $res['ok'] && 'active' === $s['status'], 'Client activation: active (' . $res['message'] . ')' );
t( 'professional' === $s['plan'] && 1 === $s['sites_allowed'] && 1 === $s['sites_used'] && $s['update_entitled'], 'Client receives plan, site counts and update entitlement' );
t( '' !== $s['expires_at'] && strtotime( $s['expires_at'] ) > time(), 'Expiry date arrives in a parsable form' );
t( 1 === AGHLS_Store::sites_used( $id ), 'Hub records one activated site' );

// 2. Second site over the limit
$st = get_option( 'agh_license' ); $st['instance_id'] = wp_generate_uuid4(); update_option( 'agh_license', $st );
$res = LicenseManager::activate( $key );
t( 'site_limit' === LicenseManager::state()['status'], 'Second site: site_limit' );
t( 1 === AGHLS_Store::sites_used( $id ), 'Limit is not exceeded' );
$st = get_option( 'agh_license' ); $st['instance_id'] = $inst1; $st['status'] = 'active'; $st['plan'] = 'professional'; update_option( 'agh_license', $st );

// 3. Daily check
$res = LicenseManager::check();
t( $res['ok'] && 'active' === LicenseManager::state()['status'], 'Check: active' );

// 4. Unknown key → signed "invalid" (not the grace period)
$res = LicenseManager::activate( 'AGH-AAAAA-BBBBB-CCCCC-DDDDD' );
t( 'invalid' === LicenseManager::state()['status'], 'Unknown key: invalid (signed answer, no grace period)' );
Secrets::set( 'license_key', $key );
$st = get_option( 'agh_license' ); $st['status'] = 'active'; $st['plan'] = 'professional'; update_option( 'agh_license', $st );

// 5. Revoke → invalid, restore → active
AGHLS_Store::set_status( $id, 'revoked' );
LicenseManager::check();
t( 'invalid' === LicenseManager::state()['status'] && 'starter' === LicenseManager::effective_plan(), 'Revoked: invalid, Starter' );
AGHLS_Store::set_status( $id, 'active' );
$st = get_option( 'agh_license' ); $st['status'] = 'active'; update_option( 'agh_license', $st );
LicenseManager::check();
t( 'active' === LicenseManager::state()['status'] && 'professional' === LicenseManager::state()['plan'], 'Restored: active again' );

// 6. Expired → expired; extend → active
$wpdb->update( AGHLS_Store::t( 'licenses' ), array( 'expires_at' => gmdate( 'Y-m-d H:i:s', time() - 3600 ) ), array( 'id' => $id ) );
LicenseManager::check();
t( 'expired' === LicenseManager::state()['status'], 'Expired licence: expired' );
AGHLS_Store::extend( $id );
$l = AGHLS_Store::get( $id );
t( strtotime( $l['expires_at'] . ' UTC' ) > time() + 360 * DAY_IN_SECONDS, 'Extend: +1 year from today' );
$st = get_option( 'agh_license' ); $st['status'] = 'active'; update_option( 'agh_license', $st );
LicenseManager::check();
t( 'active' === LicenseManager::state()['status'], 'After extension: active' );

// 7. Signature checks
$data = array( 'b' => 1, 'a' => 'x/ő', 'issued_at' => time() );
$sig  = AGHLS_Crypto::sign( $data );
t( LicenseManager::verify( $data, $sig, AGHLS_Crypto::public_key() ), 'Client verifies the hub signature (canonical JSON identical)' );
$data['b'] = 2;
t( ! LicenseManager::verify( $data, $sig, AGHLS_Crypto::public_key() ), 'Tampered data is rejected' );

// 8. Releases and updates
$zip = dirname( __DIR__ ) . '/dist/' . basename( (string) ( glob( dirname( __DIR__ ) . '/dist/autogrowehome-*.zip' )[0] ?? '' ) );
$wpdb->query( 'DELETE FROM ' . AGHLS_Store::t( 'releases' ) );
$add = is_file( $zip ) ? AGHLS_Releases::add( $zip, '6.8', 'teszt' ) : array( 'error' => 'no dist zip' );
t( empty( $add['error'] ) && ! empty( $add['version'] ), 'Release upload reads the version from the ZIP (' . ( $add['version'] ?? $add['error'] ) . ')' );
t( ! empty( AGHLS_Releases::add( $zip, '', '' )['error'] ), 'Same version cannot be uploaded twice' );
delete_site_transient( 'agh_update_info' );
$info = LicenseManager::update_info( true );
t( ( $info['version'] ?? '' ) === ( $add['version'] ?? '-' ), 'Client update check: signed latest version' );
t( 0 === strpos( (string) ( $info['package'] ?? '' ), $base . '/v1/update/package/' ), 'Package URL under the configured server (client accepts only that)' );
t( isset( $info['sha256'] ) && hash_file( 'sha256', $zip ) === $info['sha256'], 'Signed SHA-256 equals the ZIP' );
$req = new WP_REST_Request( 'GET', '/aghls/v1/update/package/' . $add['version'] . '.zip' );
$req->set_url_params( array( 'version' => $add['version'] ) );
$req->set_header( 'X-AGH-License', $key ); $req->set_header( 'X-AGH-Instance', $inst1 );
$res = rest_do_request( $req );
t( 200 === $res->get_status() && is_readable( $res->get_data()['file'] ?? '' ), 'Package download with licence headers' );
$req->set_header( 'X-AGH-License', 'AGH-AAAAA-BBBBB-CCCCC-DDDDD' );
t( 403 === rest_do_request( $req )->get_status(), 'Package download with a wrong key: 403' );
$req->set_header( 'X-AGH-License', $key ); $req->set_header( 'X-AGH-Instance', wp_generate_uuid4() );
t( 403 === rest_do_request( $req )->get_status(), 'Package download from a non-activated site: 403' );
t( file_exists( AGHLS_Releases::dir() . '.htaccess' ), 'Release folder protected (.htaccess deny)' );

// 9. Deactivation frees the site
$res = LicenseManager::deactivate();
t( 'inactive' === LicenseManager::state()['status'] && 0 === AGHLS_Store::sites_used( $id ), 'Deactivate: inactive, site freed' );

// 10. Lifetime licence
list( $id2, $key2 ) = AGHLS_Store::create( array( 'customer' => 'Örökös', 'plan' => 'agency', 'billing_cycle' => 'lifetime', 'sites_allowed' => 25, 'updates' => 1 ) );
$res = LicenseManager::activate( $key2 );
$s   = LicenseManager::state();
t( 'active' === $s['status'] && 'agency' === $s['plan'] && '' === $s['expires_at'] && 25 === $s['sites_allowed'], 'Lifetime Agency licence: active, no expiry' );

// 11. Malformed request, rate limit, busy lock
$req = new WP_REST_Request( 'POST', '/aghls/v1/license/check' ); $req->set_body( '{"license_key":"x"}' ); $req->set_header( 'content-type', 'application/json' );
t( 400 === rest_do_request( $req )->get_status(), 'Malformed request: 400' );
update_option( 'aghls_rate_limit', 3 );
$codes = array();
for ( $i = 0; $i < 5; $i++ ) { $q = new WP_REST_Request( 'POST', '/aghls/v1/license/check' ); $q->set_body( wp_json_encode( array( 'license_key' => $key2, 'instance_id' => wp_generate_uuid4(), 'nonce' => bin2hex( random_bytes( 12 ) ) ) ) ); $q->set_header( 'content-type', 'application/json' ); $codes[] = rest_do_request( $q )->get_status(); }
t( in_array( 429, $codes, true ), 'Rate limit: 429 after the limit' );
update_option( 'aghls_rate_limit', 0 );

// 12. Admin screens render
wp_set_current_user( 1 );
foreach ( array( 'page_licenses', 'page_new', 'page_releases', 'page_settings', 'page_log' ) as $pg ) {
	ob_start(); AGHLS_Admin::$pg(); $html = ob_get_clean();
	t( strlen( $html ) > 300 && false === stripos( $html, 'Fatal error' ) && false === stripos( $html, 'Warning:' ), 'Admin page renders: ' . $pg );
}
$_GET['view'] = 'show'; $_GET['id'] = $id;
ob_start(); AGHLS_Admin::page_licenses(); $html = ob_get_clean();
t( false !== strpos( $html, $key ) && false !== strpos( $html, 'Aktivált weboldalak' ), 'Licence page shows the key and the sites' );
unset( $_GET['view'], $_GET['id'] );
$mail = null;
add_filter( 'pre_wp_mail', function ( $r, $atts ) use ( &$mail ) { $mail = $atts; return true; }, 10, 2 );
t( AGHLS_Admin::mail( $id ) && 'teszt@example.com' === $mail['to'] && false !== strpos( $mail['message'], $key ) && false !== strpos( $mail['message'], $base ), 'Key e-mail: recipient, key and server URL in the message' );

echo "license-hub-test: $pass/" . ( $pass + $fail ) . ( $fail ? " – $fail FAIL" : ' OK' ) . "\n";
exit( $fail ? 1 : 0 );
