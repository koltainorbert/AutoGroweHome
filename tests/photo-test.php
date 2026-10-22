<?php
/**
 * 1.16.0 – „Fotó a 3D képből”: a látogató 3D képe maga megy be a képgenerálóba (Flux 2 Pro
 * szerkesztés), és abból lesz fotó. Tesztoldalon, a Magnific-hívás `pre_http_request`-tel elfogva.
 *
 * Használat: php tests/photo-test.php [/path/to/test/wordpress]   (alap: /home/claude/wpsite)
 */

$agh_wp_dir = $argv[1] ?? '/home/claude/wpsite';
define( 'WP_USE_THEMES', false );
$_SERVER['HTTP_HOST']   = '127.0.0.1:8899';
$_SERVER['REQUEST_URI'] = '/';
$_SERVER['REMOTE_ADDR'] = '203.0.113.14';
require $agh_wp_dir . '/wp-load.php';

use AutoGroweHome\Generation\JobQueue;
use AutoGroweHome\Generation\Pipeline;
use AutoGroweHome\Prompt\PromptEngine;
use AutoGroweHome\Support\Secrets;
use AutoGroweHome\Support\Settings;
use AutoGroweHome\Support\Storage;

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
function agh_pshot( int $r, int $g, int $b ): string {
	$img = imagecreatetruecolor( 1152, 700 );
	imagefilledrectangle( $img, 0, 0, 1152, 700, imagecolorallocate( $img, $r, $g, $b ) );
	imagefilledrectangle( $img, 300, 200, 850, 600, imagecolorallocate( $img, 200, 90, 40 ) );
	ob_start();
	imagejpeg( $img, null, 85 );
	$raw = (string) ob_get_clean();
	imagedestroy( $img );
	return 'data:image/jpeg;base64,' . base64_encode( $raw );
}

$sent = array();
add_filter(
	'agh_provider_request',
	function ( $req, $asset ) use ( &$sent ) {
		$sent[ (string) $asset['view'] ][] = $req;
		return $req;
	},
	10,
	2
);
Settings::update_group( 'magnific', array( 'render_mode' => 'photo', 'structure_guidance' => true, 'fidelity' => 'faithful', 'guide_clean' => true ) );
Settings::update_group( 'images', array( 'allow_test_provider' => true, 'provider' => 'test' ) );
Settings::flush();

$seed = (array) \AutoGroweHome\Catalog\Catalog::style_seed( 'modern_minimal' );
$cfg  = \AutoGroweHome\Params\Validator::sanitize( array_merge( \AutoGroweHome\Params\Registry::defaults(), $seed, array( 'roof_type' => 'gable', 'roof_color' => '#C8582E', 'levels' => 'single' ) ) );

/* ---------------------------------------------------------------- 1. alapok */
$t( 'alapból fotó mód', 'photo' === Settings::defaults()['magnific']['render_mode'] && PromptEngine::photo_mode() );
$t( 'a kép mérete a 3D kép alakja: 1152×700 → 1440×880', array( 1440, 880 ) === PromptEngine::photo_size( 1152, 700 ) );
$pp = PromptEngine::photo_prompt( $cfg, 'hero' );
$t( 'a prompt a kép átalakítását kéri', 0 === strpos( $pp, 'Turn this screenshot of a 3D house model into an award-winning professional architectural photograph' ) && false !== strpos( $pp, 'Do not add or remove anything' ) );
$t( 'a prompt a pontos színt mondja', false !== stripos( $pp, 'terracotta orange' ) );
$t( 'a prompt 3900 alatt', mb_strlen( $pp ) <= PromptEngine::MAX_PROMPT );
$t( 'fotós beállítás a promptban', false !== strpos( $pp, 'bracketed HDR' ) && false !== strpos( $pp, 'tilt-shift' ) && false !== strpos( $pp, 'in its place and in its colour' ) );
$t( 'esti nézet: kék óra, égő fények', false !== strpos( PromptEngine::photo_prompt( $cfg, 'evening' ), 'blue hour just after sunset' ) );
$t( 'a nézet a fő képet is megnevezi', false !== strpos( PromptEngine::photo_prompt( $cfg, 'front', null, true ), 'The second image is a finished photograph' ) );
$t( 'belső nézetre szobás prompt', 0 === strpos( PromptEngine::photo_prompt( $cfg, 'interior', array( 'type' => 'living' ) ), 'Turn this screenshot of a 3D room model' ) );

/* ---------------------------------------------------------------- 2. a kiküldött kérés */
$pr = Pipeline::start( $cfg, array( 'user_id' => 0, 'guest_hash' => 'phototest', 'ip_hash' => 'phototest-ip', 'lang' => 'hu_HU', 'reserved' => array() ) );
Storage::put_guides( (string) $pr['uuid'], array( 'hero' => agh_pshot( 120, 160, 200 ), 'scene_hero' => agh_pshot( 40, 140, 60 ) ) );
for ( $i = 0; $i < 16 && count( $sent['hero'] ?? array() ) < 3; $i++ ) {
	JobQueue::run( 25.0, (int) $pr['id'] );
}
$h = $sent['hero'][0] ?? array();
$t( 'a koncepciókép fotó módban ment', ! empty( $h['photo'] ) );
$t( 'a bemenő kép a teljes jelenet (autóval, emberrel)', ( $h['structure_image'] ?? '' ) === base64_encode( (string) file_get_contents( Storage::guide_path( (string) $pr['uuid'], 'scene_hero' ) ) ) );
$t( 'a méret a 3D kép alakja', 1440 === ( $h['width'] ?? 0 ) && 880 === ( $h['height'] ?? 0 ) );
$t( 'a prompt a fotós utasítás', 0 === strpos( (string) ( $h['prompt'] ?? '' ), 'Turn this screenshot' ) );
$done = array_filter( \AutoGroweHome\Projects\Repository::assets( (int) $pr['id'] ), fn( $a ) => 'render' === $a['kind'] && 'hero' === $a['view'] && 'done' === $a['status'] );
$t( 'a koncepcióképek elkészültek', count( $done ) > 0 );

/* ---------------------------------------------------------------- 3. Magnific: Flux 2 Pro szerkesztés */
$bodies = array();
$fake   = function ( $pre, $args, $url ) use ( &$bodies ) {
	if ( false === strpos( (string) $url, 'magnific.com' ) ) {
		return $pre;
	}
	$bodies[] = array( (string) $url, json_decode( (string) ( $args['body'] ?? '' ), true ) );
	return array( 'headers' => array(), 'body' => wp_json_encode( array( 'data' => array( 'task_id' => wp_generate_uuid4(), 'status' => 'CREATED', 'generated' => array() ) ) ), 'response' => array( 'code' => 200, 'message' => 'OK' ), 'cookies' => array(), 'filename' => null );
};
add_filter( 'pre_http_request', $fake, 10, 3 );
Secrets::set( 'magnific_api_key', 'test-only-key' );
Settings::update_group( 'magnific', array( 'enabled' => true ) );
Settings::flush();
$mag = new \AutoGroweHome\Ai\MagnificProvider();
$t( 'a Magnific tud fotó módot', ! empty( $mag->capabilities()['photo'] ) );
$scene = base64_encode( 'scene-bytes' );
$hero  = base64_encode( 'hero-bytes' );
$r1    = $mag->submit( array( 'op' => 'hero', 'view' => 'hero', 'prompt' => 'p', 'photo' => true, 'structure_image' => $scene, 'width' => 1440, 'height' => 880 ) );
$r2    = $mag->submit( array( 'op' => 'view', 'view' => 'front', 'prompt' => 'p', 'photo' => true, 'structure_image' => $scene, 'reference_image' => $hero, 'width' => 1440, 'height' => 875 ) );
remove_filter( 'pre_http_request', $fake, 10 );
Secrets::set( 'magnific_api_key', '' );
$b1 = $bodies[0] ?? array( '', array() );
$b2 = $bodies[1] ?? array( '', array() );
$t( 'fő kép: Flux 2 Pro, a 3D kép a bemenet', false !== strpos( $b1[0], 'flux-2-pro' ) && $scene === ( $b1[1]['input_image'] ?? '' ) && ! isset( $b1[1]['input_image_2'] ) );
$t( 'fő kép: nincs structure/style mező', ! isset( $b1[1]['structure_reference'] ) && ! isset( $b1[1]['style_reference'] ) );
$t( 'fő kép: 1440×880', 1440 === ( $b1[1]['width'] ?? 0 ) && 880 === ( $b1[1]['height'] ?? 0 ) );
$t( 'nézet: a 3D kép + a kiválasztott fő kép', $scene === ( $b2[1]['input_image'] ?? '' ) && $hero === ( $b2[1]['input_image_2'] ?? '' ) );
$t( 'a magasság 16 többszöröse', 0 === ( ( $b2[1]['height'] ?? 1 ) % 16 ) );
$t( 'díjkulcs és modell', 'reference_image' === ( $r1['cost_key'] ?? '' ) && 'flux-2-pro/photo' === ( $r1['model'] ?? '' ) );

/* ---------------------------------------------------------------- 3b. minden irányból saját 3D kép (1.17.0) */
$t( 'a kerti nézetnek is van vezetőképe', in_array( 'garden', array( 'hero', 'front', 'back', 'left', 'right', 'aerial', 'garden', 'evening' ), true ) && 1 === Storage::put_guides( (string) $pr['uuid'], array( 'garden' => agh_pshot( 10, 200, 10 ) ) ) );
$sent = array();
$conc = \AutoGroweHome\Projects\Repository::concepts( (int) $pr['id'] )[0] ?? null;
Settings::update_group( 'limits', array( 'exterior_views' => array( 'hero', 'back', 'garden', 'evening' ) ) );
Settings::flush();
$cfgN = $cfg; $cfgN['night_lighting'] = true;
global $wpdb;
$pdb = \AutoGroweHome\Projects\Repository::project_by_id( (int) $pr['id'] );
$pdb['config'] = $cfgN;
if ( $conc ) {
	Pipeline::enqueue_gallery( $pdb, $conc );
	for ( $i = 0; $i < 30 && count( $sent ) < 3; $i++ ) {
		JobQueue::run( 25.0, (int) $pr['id'] );
	}
}
$g = $sent['garden'][0] ?? array();
$t( 'a kerti nézet a saját 3D képéből, fotó módban', ! empty( $g['photo'] ) && ( $g['structure_image'] ?? '' ) === base64_encode( (string) file_get_contents( Storage::guide_path( (string) $pr['uuid'], 'garden' ) ) ) );
$e = $sent['evening'][0] ?? array();
$t( 'az esti nézet a fő kép 3D képéből (teljes jelenet)', ! empty( $e['photo'] ) && ( $e['structure_image'] ?? '' ) === base64_encode( (string) file_get_contents( Storage::guide_path( (string) $pr['uuid'], 'scene_hero' ) ) ) && false !== strpos( (string) ( $e['prompt'] ?? '' ), 'blue hour' ) );
$t( 'alapból nincs második (fő) kép a nézetnél', '' === (string) ( $g['reference_image'] ?? '' ) );

/* ---------------------------------------------------------------- 4. ahol nem fut */
Settings::update_group( 'magnific', array( 'fidelity' => 'balanced' ) );
Settings::flush();
$t( 'Kiegyensúlyozott fokozaton nem fut', ! PromptEngine::photo_mode() );
Settings::update_group( 'magnific', array( 'fidelity' => 'faithful', 'render_mode' => 'structure' ) );
Settings::flush();
$t( 'Forma-vezetés módban nem fut', ! PromptEngine::photo_mode() );
Settings::update_group( 'magnific', array( 'render_mode' => 'photo' ) );
Settings::flush();
$sent = array();
$pr2  = Pipeline::start( $cfg, array( 'user_id' => 0, 'guest_hash' => 'phototest2', 'ip_hash' => 'phototest2-ip', 'lang' => 'hu_HU', 'reserved' => array() ) );
for ( $i = 0; $i < 16 && ! isset( $sent['hero'] ); $i++ ) {
	JobQueue::run( 25.0, (int) $pr2['id'] );
}
$t( '3D kép nélkül a régi út (nincs fotó mód)', isset( $sent['hero'][0] ) && empty( $sent['hero'][0]['photo'] ) );

echo "fotó a 3D képből: {$ok}/" . ( $ok + $fail ) . ( $fail ? " – {$fail} HIBA" : '' ) . "\n";
exit( $fail ? 1 : 0 );
