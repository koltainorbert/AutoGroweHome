<?php
/**
 * 1.15.2 – a prompt a 3D színeit és anyagait mondja (Norbi mediterrán háza: narancs cseréptető,
 * bézs terméskő, sötét lamellás kerítés), és kötött hűségnél nem írja le a koncepciók más házait.
 *
 * Használat: php tests/match-test.php [/path/to/test/wordpress]   (alap: /home/claude/wpsite)
 */

$agh_wp_dir = $argv[1] ?? '/home/claude/wpsite';
define( 'WP_USE_THEMES', false );
$_SERVER['HTTP_HOST']   = '127.0.0.1:8899';
$_SERVER['REQUEST_URI'] = '/';
$_SERVER['REMOTE_ADDR'] = '203.0.113.13';
require $agh_wp_dir . '/wp-load.php';

use AutoGroweHome\Generation\JobQueue;
use AutoGroweHome\Generation\Pipeline;
use AutoGroweHome\Prompt\Color;
use AutoGroweHome\Prompt\PromptEngine;
use AutoGroweHome\Prompt\VisionPrompt;
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

/* ---------------------------------------------------------------- 1. színnevek */
$t( 'narancs tető: terracotta orange', 'terracotta orange' === Color::describe( '#C8582E', false ) );
$t( 'faanyagnál marad a fanév', 'honey oak' === Color::describe( '#C8582E', true ) );
$t( 'a 3D kőszíne nem faszín', false === strpos( Color::describe( '#BDAE97', false ), 'oak' ) );
$t( 'tégla és sötétvörös maradt', 'brick red' === Color::describe( '#8C3A2B', false ) );
$t( 'fehér és antracit változatlan', 'warm white' === Color::describe( '#F2EFE9', false ) && 'anthracite grey' === Color::describe( '#3A3D40', false ) );

/* ---------------------------------------------------------------- 2. Norbi háza */
$seed = (array) \AutoGroweHome\Catalog\Catalog::style_seed( 'mediterranean' );
$cfg  = \AutoGroweHome\Params\Validator::sanitize( array_merge( \AutoGroweHome\Params\Registry::defaults(), $seed, array( 'arch_style' => 'mediterranean', 'roof_color' => '#C8582E', 'facade_main' => 'stone', 'facade_accent' => array(), 'fence' => 'slats', 'levels' => 'single' ) ) );
$con  = array(
	'variant'  => 'C',
	'brief'    => array( 'name_en' => 'Signature Premium', 'exterior_description' => 'A characterful premium house with articulated massing, contrasting dark metal accents.', 'signature_features' => array( 'contrasting dark accent volume' ), 'materials' => array( 'dark anthracite metal accents' ), 'massing' => 'articulated massing with a projecting wing', 'differentiation' => 'the most characterful premium variant' ),
	'building' => \AutoGroweHome\Generation\BuildingModel::build( $cfg, 'C', array() ),
);
$ver  = (int) PromptEngine::get()['version'];
$free = PromptEngine::build( $cfg, $con, 'hero', null, $ver )['prompt'];
$bnd  = PromptEngine::build( $cfg, $con, 'hero', null, $ver, true )['prompt'];

$t( 'a tető terrakotta', false !== stripos( $bnd, 'terracotta orange' ) );
$t( 'a tetőnél nincs fanév', 0 === preg_match( '/roof[^.]*\boak\b/i', $bnd ) );
$t( 'a kő a 3D színével', false !== strpos( $bnd, 'warm beige-yellow natural stone' ) );
$t( 'a vakolat színe csak a vakolt részre', false === strpos( $bnd, 'facade colour warm white' ) && false !== strpos( $bnd, 'rendered parts in warm white' ) );
$t( 'a kerítés függőleges és sötét', false !== strpos( $bnd, 'vertical slatted fence in dark anthracite metal' ) && false === strpos( $bnd, 'horizontal slatted' ) );
$neg = PromptEngine::config_negative( $cfg );
$t( 'a tiltólista a fekete tetőt tiltja, a terrakottát nem', in_array( 'black roof', $neg, true ) && ! in_array( 'terracotta roof', $neg, true ) );

$t( 'kötve nincs koncepció-tömeg', false === strpos( $bnd, 'articulated massing' ) && false === strpos( $bnd, 'projecting wing' ) );
$t( 'kötve nincs sötét fém díszítés', false === strpos( $bnd, 'dark metal accents' ) && false === strpos( $bnd, 'dark anthracite metal accents' ) );
$t( 'kötve nincs „clearly distinct” mondat', false === strpos( $bnd, 'clearly distinct' ) );
$t( 'szabadon a koncepció marad (mai viselkedés)', false !== strpos( $free, 'articulated massing' ) && false !== strpos( $free, 'clearly distinct' ) );

/* ---------------------------------------------------------------- 3. a képleíró prompt is kapja */
$vars = VisionPrompt::vars( $cfg );
$t( 'a kívánságban a pontos színek', false !== strpos( $vars['EXTRA_WISHES'], 'Exact colours and materials of the design' ) && false !== strpos( $vars['EXTRA_WISHES'], 'terracotta orange' ) && false !== strpos( $vars['EXTRA_WISHES'], 'warm beige-yellow natural stone' ) );

/* ---------------------------------------------------------------- 4. a kiküldött kérés (Hű, 3D vezetőképpel) */
$sent = array();
add_filter(
	'agh_provider_request',
	function ( $req, $asset ) use ( &$sent ) {
		$sent[ (string) $asset['view'] ][] = (string) $req['prompt'];
		return $req;
	},
	10,
	2
);
Settings::update_group( 'magnific', array( 'render_mode' => 'structure', 'structure_guidance' => true, 'fidelity' => 'faithful' ) );
Settings::update_group( 'images', array( 'allow_test_provider' => true, 'provider' => 'test' ) );
Settings::flush();
$img = imagecreatetruecolor( 1152, 700 );
imagefilledrectangle( $img, 0, 0, 1152, 700, imagecolorallocate( $img, 200, 120, 60 ) );
ob_start();
imagejpeg( $img, null, 85 );
$jpg = 'data:image/jpeg;base64,' . base64_encode( (string) ob_get_clean() );
$pr  = Pipeline::start( $cfg, array( 'user_id' => 0, 'guest_hash' => 'matchtest', 'ip_hash' => 'matchtest-ip', 'lang' => 'hu_HU', 'reserved' => array() ) );
Storage::put_guides( (string) $pr['uuid'], array( 'hero' => $jpg ) );
for ( $i = 0; $i < 16 && count( $sent['hero'] ?? array() ) < 3; $i++ ) {
	JobQueue::run( 25.0, (int) $pr['id'] );
}
$heroes = $sent['hero'] ?? array();
$t( 'mindhárom koncepciókép kiment', 3 === count( $heroes ) );
$t( 'egyik koncepciókép sem ír le más házat', count( $heroes ) > 0 && 0 === count( array_filter( $heroes, fn( $p ) => false !== strpos( $p, 'clearly distinct' ) || false !== strpos( $p, 'articulated massing' ) || false !== strpos( $p, 'elongated volume' ) ) ) );
$t( 'mindhárom a terrakotta tetőt és a bézs követ mondja', count( $heroes ) > 0 && count( $heroes ) === count( array_filter( $heroes, fn( $p ) => false !== stripos( $p, 'terracotta orange' ) && false !== strpos( $p, 'warm beige-yellow natural stone' ) ) ) );
$t( 'a nyitóblokk a stílusminta anyagát kizárja', count( $heroes ) > 0 && false !== strpos( $heroes[0], 'a style sample gives only light' ) );
$t( 'a prompt 3900 alatt', count( $heroes ) > 0 && max( array_map( 'mb_strlen', $heroes ) ) <= PromptEngine::MAX_PROMPT );

/* ---------------------------------------------------------------- 5. nézetek (1.15.3) */
$t( 'kötve nincs torony, U-alak, ív', 0 === preg_match( '/\b(tower|U-shaped|arched)\b/i', $bnd ) );
$t( 'kötve a stílus neve marad', false !== strpos( $bnd, 'Architectural style: Mediterranean' ) );
$t( 'szabadon a stílus leírása marad', false !== strpos( $free, 'small tower' ) );
$urls  = array();
$fake  = function ( $pre, $args, $url ) use ( &$urls ) {
	if ( false === strpos( (string) $url, 'magnific.com' ) ) {
		return $pre;
	}
	$urls[] = array( (string) $url, json_decode( (string) ( $args['body'] ?? '' ), true ) );
	return array( 'headers' => array(), 'body' => wp_json_encode( array( 'data' => array( 'task_id' => wp_generate_uuid4(), 'status' => 'CREATED', 'generated' => array() ) ) ), 'response' => array( 'code' => 200, 'message' => 'OK' ), 'cookies' => array(), 'filename' => null );
};
add_filter( 'pre_http_request', $fake, 10, 3 );
\AutoGroweHome\Support\Secrets::set( 'magnific_api_key', 'test-only-key' );
Settings::update_group( 'magnific', array( 'view_strategy' => 'reference', 'enabled' => true ) );
Settings::flush();
$mag = new \AutoGroweHome\Ai\MagnificProvider();
$b64 = substr( $jpg, strlen( 'data:image/jpeg;base64,' ) );
$mag->submit( array( 'op' => 'view', 'view' => 'front', 'prompt' => 'p', 'structure_image' => $b64, 'reference_image' => $b64, 'bound' => true ) );
$mag->submit( array( 'op' => 'view', 'view' => 'front', 'prompt' => 'p', 'structure_image' => $b64, 'reference_image' => $b64 ) );
remove_filter( 'pre_http_request', $fake, 10 );
\AutoGroweHome\Support\Secrets::set( 'magnific_api_key', '' );
$k0 = $urls[0] ?? array( '', array() );
$k1 = $urls[1] ?? array( '', array() );
$t( 'kötött nézet: Mystic, structure + a hero stílusmintának', false !== strpos( $k0[0], '/v1/ai/mystic' ) && ! empty( $k0[1]['structure_reference'] ) && ! empty( $k0[1]['style_reference'] ) && 75 === ( $k0[1]['structure_strength'] ?? 0 ) );
$t( 'nem kötött nézet: a mai Flux-út', false !== strpos( $k1[0], 'flux-2-pro' ) );

echo "3D-egyezés: {$ok}/" . ( $ok + $fail ) . ( $fail ? " – {$fail} HIBA" : '' ) . "\n";
exit( $fail ? 1 : 0 );
