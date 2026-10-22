<?php
/**
 * 1.16.1 – Pro változat kóddal (Arculat menü). A kód nincs a repóban: környezeti változóból jön.
 *
 * Használat: AGH_PRO_CODE='…' php tests/pro-code-test.php [/path/to/test/wordpress]
 */

$agh_wp_dir = $argv[1] ?? '/home/claude/wpsite';
define( 'WP_USE_THEMES', false );
$_SERVER['HTTP_HOST']   = '127.0.0.1:8899';
$_SERVER['REQUEST_URI'] = '/';
$_SERVER['REMOTE_ADDR'] = '203.0.113.15';
require $agh_wp_dir . '/wp-load.php';

use AutoGroweHome\License\Features;
use AutoGroweHome\License\LicenseManager;
use AutoGroweHome\License\ProCode;
use AutoGroweHome\Prompt\VisionPrompt;
use AutoGroweHome\Support\Secrets;
use AutoGroweHome\Support\Settings;

$code = (string) getenv( 'AGH_PRO_CODE' );
if ( '' === $code ) {
	echo "AGH_PRO_CODE nincs megadva\n";
	exit( 2 );
}
$ok   = 0;
$fail = 0;
$t    = function ( string $name, bool $cond ) use ( &$ok, &$fail ) {
	if ( $cond ) {
		$ok++;
	} else {
		$fail++;
		echo "HIBA: {$name}\n";
	}
};

$no_owner = fn() => false;
add_filter( 'agh_owner_mode', $no_owner );
$lic_keep = get_option( LicenseManager::OPTION, null );
delete_option( LicenseManager::OPTION );
ProCode::disable();
delete_transient( 'agh_pro_code_tries' );

$t( 'kód nélkül Starter', 'starter' === Features::plan() && ! Features::enabled( 'vision_prompt' ) );
$r = ProCode::attempt( 'rossz-kod' );
$t( 'hibás kód: nem kapcsol be', ! $r['ok'] && ! ProCode::active() && 'starter' === Features::plan() );
$t( 'kis- és nagybetű számít', ! ProCode::attempt( strtolower( $code ) )['ok'] || strtolower( $code ) === $code );
delete_transient( 'agh_pro_code_tries' );
$r = ProCode::attempt( '  ' . $code . '  ' );
$t( 'jó kód (szóközökkel is): bekapcsol', $r['ok'] && ProCode::active() );
$t( 'a csomag Professional', 'professional' === Features::plan() );
$t( 'a Pro funkciók élnek', Features::enabled( 'vision_prompt' ) && Features::enabled( 'full_params' ) && Features::enabled( 'branding_advanced' ) );
$t( 'Agency-funkció nem', ! Features::enabled( 'white_label' ) );
$t( 'a Professional limitjei', 10 === (int) Features::limit( 'max_ip_daily' ) && '4k' === Features::limit( 'max_resolution' ) );
Secrets::set( 'anthropic_api_key', 'sk-ant-test-only' );
Settings::update_group( 'anthropic', array( 'enabled' => true, 'vision_prompt' => true ) );
Settings::flush();
$t( 'a képleíró prompt kóddal fut', VisionPrompt::enabled() );
Secrets::set( 'anthropic_api_key', '' );

update_option( LicenseManager::OPTION, array( 'status' => 'active', 'plan' => 'agency', 'expires_at' => '' ) );
$t( 'Agency licencet nem csökkent', 'agency' === Features::plan() && Features::enabled( 'white_label' ) );
delete_option( LicenseManager::OPTION );

ProCode::disable();
$t( 'kikapcsolva újra Starter', ! ProCode::active() && 'starter' === Features::plan() );

delete_transient( 'agh_pro_code_tries' );
for ( $i = 0; $i < 5; $i++ ) {
	ProCode::attempt( 'rossz' . $i );
}
$r = ProCode::attempt( $code );
$t( '5 hibás próba után a jó kód is tiltva 15 percig', ! $r['ok'] && $r['locked'] && ! ProCode::active() );
delete_transient( 'agh_pro_code_tries' );

$src = '';
foreach ( new RecursiveIteratorIterator( new RecursiveDirectoryIterator( dirname( __DIR__ ) . '/includes', FilesystemIterator::SKIP_DOTS ) ) as $f ) {
	$src .= (string) file_get_contents( (string) $f );
}
$t( 'a kód szövegesen nincs a forrásban', false === strpos( $src, $code ) );

remove_filter( 'agh_owner_mode', $no_owner );
if ( null === $lic_keep ) {
	delete_option( LicenseManager::OPTION );
} else {
	update_option( LicenseManager::OPTION, $lic_keep );
}
echo "Pro kód: {$ok}/" . ( $ok + $fail ) . ( $fail ? " – {$fail} HIBA" : '' ) . "\n";
exit( $fail ? 1 : 0 );
