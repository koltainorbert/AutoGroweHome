<?php
/**
 * 1.15.0 – a képleíró prompt: a Claude a 3D képernyőképből írja a Magnific-promptot
 * (tesztoldal, WordPress-szel; az Anthropic-hívás a `pre_http_request` szűrővel elfogva, hálózat nélkül).
 *
 * 1. A kérés: rendszerprompt = a sablon első fele, a kép a teljes jelenet (scene_hero), a helyőrzők
 *    kitöltve, üresen „default”; kényszerített tool-hívás, alacsony hőmérséklet.
 * 2. A Magnific-kérés: a referenciablokk + a Claude promptja + „Avoid: ” az alaplistával elöl és a
 *    konfiguráció téves alternatíváival; 3900 karakter alatt, a negatív lista teljes.
 * 3. Gyorsítótár: a három koncepcióképhez egyetlen hívás; az eredmény a védett tárhelyen.
 * 4. Tartalék: hibás és túl rövid válasznál a mai prompt, a kép elkészül.
 * 5. Nem fut: kikapcsolva, belső nézetnél, „Szabad”/„Kiegyensúlyozott” hűségnél.
 *
 * Használat: php tests/vision-test.php [/path/to/test/wordpress]   (alap: /home/claude/wpsite)
 */

$agh_wp_dir = $argv[1] ?? '/home/claude/wpsite';
define( 'WP_USE_THEMES', false );
$_SERVER['HTTP_HOST']   = '127.0.0.1:8899';
$_SERVER['REQUEST_URI'] = '/';
$_SERVER['REMOTE_ADDR'] = '203.0.113.12';
require $agh_wp_dir . '/wp-load.php';

use AutoGroweHome\Generation\JobQueue;
use AutoGroweHome\Generation\Pipeline;
use AutoGroweHome\Projects\Repository;
use AutoGroweHome\Prompt\PromptEngine;
use AutoGroweHome\Prompt\VisionPrompt;
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

/** JPEG adat URL; a szín különbözteti meg a tiszta vezetőképet a teljes jelenettől. */
function agh_vshot( int $r, int $g, int $b ): string {
	$img = imagecreatetruecolor( 1152, 700 );
	imagefilledrectangle( $img, 0, 0, 1152, 700, imagecolorallocate( $img, $r, $g, $b ) );
	imagefilledrectangle( $img, 300, 200, 850, 600, imagecolorallocate( $img, 230, 225, 215 ) );
	ob_start();
	imagejpeg( $img, null, 85 );
	$raw = (string) ob_get_clean();
	imagedestroy( $img );
	return 'data:image/jpeg;base64,' . base64_encode( $raw );
}

$claude_prompt = 'A two-storey detached family house with a rectangular footprint and a steep gable roof covered in red-brown clay tiles, '
	. 'white rendered facade with a dark grey plinth, six white-framed windows on the ground floor and four on the upper floor, '
	. 'a timber pergola over the terrace on the left and a detached flat-roofed garage on the right, a red hatchback parked on the gravel driveway, '
	. 'a person walking a medium-sized dog on the path, realistic deciduous trees behind the house. Professional medium-format architectural '
	. 'photography, tilt-shift lens, corrected vertical lines, f/8, ISO 100, elevated three-quarter view matching the screenshot, golden hour light.';

/* Az Anthropic hamis válasza: good = jó tool-hívás, bad = nincs tool, short = túl rövid prompt. */
$mode    = 'good';
$calls   = array();
$fake    = function ( $pre, $args, $url ) use ( &$mode, &$calls, $claude_prompt ) {
	if ( false === strpos( (string) $url, 'api.anthropic.com' ) ) {
		return $pre;
	}
	$calls[] = json_decode( (string) ( $args['body'] ?? '' ), true );
	$content = array( array( 'type' => 'text', 'text' => 'nem tool' ) );
	if ( 'good' === $mode || 'short' === $mode ) {
		$content = array(
			array(
				'type'  => 'tool_use',
				'id'    => 'toolu_test',
				'name'  => 'submit_render_prompt',
				'input' => array(
					'detected_elements' => array(
						'floors'         => 'two (ground floor, upper floor)',
						'building_shape' => 'rectangular',
						'roof'           => 'steep gable, red-brown clay tiles',
						'objects'        => 'red hatchback, person, dog',
					),
					'prompt'            => 'short' === $mode ? 'A house.' : $claude_prompt,
					'negative_prompt'   => 'CGI, 3D render, flat roof, single-storey house, second car, CGI',
				),
			),
		);
	}
	return array(
		'headers'  => array(),
		'body'     => wp_json_encode( array( 'model' => 'claude-sonnet-5-5', 'content' => $content, 'stop_reason' => 'tool_use', 'usage' => array( 'input_tokens' => 3100, 'output_tokens' => 640 ) ) ),
		'response' => array( 'code' => 200, 'message' => 'OK' ),
		'cookies'  => array(),
		'filename' => null,
	);
};
add_filter( 'pre_http_request', $fake, 10, 3 );

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

Secrets::set( 'anthropic_api_key', 'sk-ant-test-only' );
Settings::update_group( 'anthropic', array( 'enabled' => true, 'use_for_plan' => false, 'vision_prompt' => true, 'vision_template' => '' ) );
Settings::update_group( 'magnific', array( 'render_mode' => 'structure', 'structure_guidance' => true, 'fidelity' => 'faithful', 'negative_inline' => true ) );
Settings::update_group( 'images', array( 'allow_test_provider' => true, 'provider' => 'test' ) );
Settings::flush();

$cfg = \AutoGroweHome\Params\Validator::sanitize( \AutoGroweHome\Params\Registry::defaults() );
$cfg['roof_type']   = 'gable';
$cfg['roof_color']  = '#8C4A35';
$cfg['levels']      = 'two';
$cfg['custom_text'] = '';

/** Új projekt vezetőképpel, a hero lefuttatva. */
$run = function ( string $tag, bool $scene = true ) use ( $cfg, &$sent ) {
	$sent = array();
	$pr   = Pipeline::start( $cfg, array( 'user_id' => 0, 'guest_hash' => $tag, 'ip_hash' => $tag . '-ip', 'lang' => 'hu_HU', 'reserved' => array() ) );
	$shots = array( 'hero' => agh_vshot( 120, 160, 200 ) );
	if ( $scene ) {
		$shots['scene_hero'] = agh_vshot( 40, 140, 60 );
	}
	Storage::put_guides( (string) $pr['uuid'], $shots );
	for ( $i = 0; $i < 16 && count( $sent['hero'] ?? array() ) < 3; $i++ ) {
		JobQueue::run( 25.0, (int) $pr['id'] );
	}
	return $pr;
};

/* ---------------------------------------------------------------- 0. tárolás, sablon, helyőrzők */
$lock_off = 0;
Settings::update_group( 'anthropic', array( 'vision_prompt' => false ) );
Settings::flush();
$lock_off = JobQueue::lock_seconds();
Settings::update_group( 'anthropic', array( 'vision_prompt' => true ) );
Settings::flush();
$t( 'bekapcsolt képleírásnál a zárolás hosszabb', JobQueue::lock_seconds() > $lock_off );

$tpl = VisionPrompt::template();
list( $sys, $task ) = VisionPrompt::split( $tpl );
$t( 'a beépített sablon Norbi szövege', 0 === strpos( $sys, 'You are the photorealistic rendering prompt engineer' ) );
$t( 'a feladatrész a TASK sorral kezdődik', 0 === strpos( $task, 'TASK' ) );
$t( 'a feladatrészben mind az öt helyőrző', 5 === count( array_filter( VisionPrompt::PLACEHOLDERS, fn( $k ) => false !== strpos( $task, '{' . $k . '}' ) ) ) );
$filled = VisionPrompt::fill( $task, array( 'TIME_OF_DAY' => 'x' ) );
$t( 'a hiányzó érték helyére „default” kerül', false !== strpos( $filled, 'Season: default' ) && false !== strpos( $filled, 'Time of day: x' ) );
$t( 'kitöltés után nem marad kapcsos helyőrző', 0 === preg_match( '/\{[A-Z_]+\}/', $filled ) );
$vars = VisionPrompt::vars( $cfg );
$t( 'a napszak a mező angol szövege', 'warm golden-hour light' === $vars['TIME_OF_DAY'] );
$t( 'a leírás nélkül „default”', 'default' === $vars['MAGNIFIC_DESCRIPTION'] );
$t( 'a kívánságban ott a tetőtermék sora', false !== strpos( $vars['EXTRA_WISHES'], 'Roof covering product:' ) || 'default' === $vars['EXTRA_WISHES'] );
$cfg_w = $cfg;
$cfg_w['custom_text'] = 'Legyen a kertben levendula.';
$t( 'a látogató saját szövege a kívánságba kerül', 0 === strpos( VisionPrompt::vars( $cfg_w )['EXTRA_WISHES'], 'Legyen a kertben levendula.' ) );

$cl = VisionPrompt::clean( array( 'prompt' => " a\n b ", 'negative_prompt' => 'flat roof, CGI', 'detected_elements' => array( 'floors' => 'two' ) ) );
$t( 'a negatív lista az alaplistával kezdődik', 'CGI' === $cl['negative'][0] && 'labels' === $cl['negative'][ count( VisionPrompt::items( VisionPrompt::BASE_NEGATIVE ) ) - 1 ] );
$t( 'ismétlés nincs, a saját tétel az alap után', 1 === count( array_keys( $cl['negative'], 'CGI', true ) ) && in_array( 'flat roof', $cl['negative'], true ) );
$t( 'a leltár mind a 9 mezője megvan, hiányzó = none', 9 === count( $cl['detected'] ) && 'two' === $cl['detected']['floors'] && 'none' === $cl['detected']['roof'] );

$pg = Repository::create_project( $cfg, 0, 'visiontest0', 'visiontest0-ip', 'hu_HU', 1 );
$n  = Storage::put_guides( (string) $pg['uuid'], array( 'scene_hero' => agh_vshot( 1, 2, 3 ), 'scene_bogus' => agh_vshot( 1, 2, 3 ) ) );
$t( 'a scene_hero tárolható, a scene_bogus nem', 1 === $n && '' !== Storage::guide_path( (string) $pg['uuid'], 'scene_hero' ) );

/* ---------------------------------------------------------------- 1–3. a jó út */
$calls = array();
$pr    = $run( 'visiontest1' );
$uuid  = (string) $pr['uuid'];
$t( 'a három koncepcióképhez egyetlen Claude-hívás', 1 === count( $calls ) );
$c0   = $calls[0] ?? array();
$msg  = (array) ( $c0['messages'][0]['content'] ?? array() );
$img  = $msg[0]['source']['data'] ?? '';
$text = (string) ( $msg[1]['text'] ?? '' );
$t( 'a rendszerprompt a sablon első fele', ( $c0['system'] ?? '' ) === $sys );
$t( 'a kép a teljes jelenet (scene_hero), nem a tiszta vezetőkép', $img === base64_encode( (string) file_get_contents( Storage::guide_path( $uuid, 'scene_hero' ) ) ) );
$t( 'a kép elöl, utána a feladat szövege', 'image' === ( $msg[0]['type'] ?? '' ) && 'text' === ( $msg[1]['type'] ?? '' ) );
$t( 'a feladatban a kitöltött paraméterek', false !== strpos( $text, '- Time of day: warm golden-hour light' ) && false !== strpos( $text, "(optional, may contain errors):\ndefault" ) );
$t( 'kényszerített tool-hívás, temperature 0.2', 'submit_render_prompt' === ( $c0['tool_choice']['name'] ?? '' ) && abs( (float) ( $c0['temperature'] ?? 1 ) - 0.2 ) < 0.001 );

$hero = $sent['hero'][0] ?? array();
$hp   = (string) ( $hero['prompt'] ?? '' );
if ( getenv( "AGH_SHOW" ) ) { echo $hp, "\n", mb_strlen( $hp ), "\n"; }
$t( 'a Magnific a Claude promptját kapja', false !== strpos( $hp, 'a red hatchback parked on the gravel driveway' ) );
$t( 'Hű fokozaton elöl a referenciablokk', 0 === strpos( $hp, 'Photorealistic photograph of EXACTLY the building' ) );
$t( 'a negatív lista a végén, alaplistával', false !== strpos( $hp, 'Avoid: CGI, 3D render, video game graphics' ) && '.' === substr( $hp, -1 ) );
$t( 'a konfiguráció téves alternatívái is benne', false !== strpos( $hp, 'barn' ) && false !== strpos( $hp, 'anthracite roof' ) );
$t( 'a Claude saját tétele is benne', false !== strpos( $hp, 'second car' ) );
$t( 'a prompt 3900 karakter alatt', mb_strlen( $hp ) <= PromptEngine::MAX_PROMPT );
$t( 'a vezetőkép továbbra is a tiszta kép', ( $hero['structure_image'] ?? '' ) === base64_encode( (string) file_get_contents( Storage::guide_path( $uuid, 'hero' ) ) ) );
$t( 'a negatív mező sima lista', 0 === strpos( (string) ( $hero['negative_prompt'] ?? '' ), 'CGI, 3D render' ) );
$t( 'mindhárom koncepcióképhez ugyanaz a prompt', 3 === count( $sent['hero'] ?? array() ) && 1 === count( array_unique( array_map( fn( $r ) => $r['prompt'], $sent['hero'] ) ) ) );
$rec = VisionPrompt::stored( $uuid, 'hero' );
$t( 'az eredmény a védett tárhelyen', is_array( $rec ) && 0 === strpos( Storage::path( $uuid . '/vision-hero.json' ), Storage::base_dir() ) );
$t( 'a tárolt leltárban 9 mező', is_array( $rec ) && 9 === count( (array) $rec['detected_elements'] ) );
$heros = array_filter( Repository::assets( (int) $pr['id'] ), fn( $a ) => 'render' === $a['kind'] && 'hero' === $a['view'] );
$t( 'az asset a kiküldött promptot őrzi', count( $heros ) > 0 && false !== strpos( (string) array_values( $heros )[0]['prompt'], 'red hatchback' ) );
$t( 'a koncepcióképek elkészültek', count( array_filter( $heros, fn( $a ) => 'done' === $a['status'] ) ) > 0 );

// teljes jelenet nélkül a tiszta vezetőképet nézi
$calls = array();
$pr1b  = $run( 'visiontest1b', false );
$img2  = $calls[0]['messages'][0]['content'][0]['source']['data'] ?? '';
$t( 'scene kép nélkül a vezetőképet kapja', $img2 === base64_encode( (string) file_get_contents( Storage::guide_path( (string) $pr1b['uuid'], 'hero' ) ) ) );

/* ---------------------------------------------------------------- 4. tartalék */
foreach ( array( 'bad', 'short' ) as $m ) {
	$mode  = $m;
	$calls = array();
	$pr4   = $run( 'visiontest-' . $m );
	$hp4   = (string) ( $sent['hero'][0]['prompt'] ?? '' );
	$t( $m . ': volt hívás', count( $calls ) >= 1 );
	$t( $m . ': a mai prompt ment ki', '' !== $hp4 && false === strpos( $hp4, 'red hatchback' ) && false !== strpos( $hp4, 'reference image' ) );
	$t( $m . ': nincs tárolt eredmény', null === VisionPrompt::stored( (string) $pr4['uuid'], 'hero' ) );
	$done4 = array_filter( Repository::assets( (int) $pr4['id'] ), fn( $a ) => 'render' === $a['kind'] && 'hero' === $a['view'] && 'done' === $a['status'] );
	$t( $m . ': a kép így is elkészült', count( $done4 ) > 0 );
}
$mode = 'good';

/* ---------------------------------------------------------------- 5. ahol nem fut */
$t( 'belső nézetre nem vonatkozik', ! VisionPrompt::applies( 'interior', 'hero' ) );
foreach ( array( 'free', 'balanced' ) as $f ) {
	Settings::update_group( 'magnific', array( 'fidelity' => $f ) );
	Settings::flush();
	$t( $f . ' hűségnél nem fut', ! VisionPrompt::applies( 'view', 'hero' ) );
}
Settings::update_group( 'magnific', array( 'fidelity' => 'clone' ) );
Settings::flush();
$t( 'klón hűségnél fut', VisionPrompt::applies( 'view', 'front' ) );
Settings::update_group( 'magnific', array( 'fidelity' => 'faithful' ) );
Settings::update_group( 'anthropic', array( 'vision_prompt' => false ) );
Settings::flush();
$calls = array();
$pr5   = $run( 'visiontest-off' );
$t( 'kikapcsolva 0 Claude-hívás', 0 === count( $calls ) );
$t( 'kikapcsolva a mai prompt', false === strpos( (string) ( $sent['hero'][0]['prompt'] ?? '' ), 'red hatchback' ) );

/* ---------------------------------------------------------------- 6. licenc (1.15.1): Professional-funkció */
Settings::update_group( 'anthropic', array( 'vision_prompt' => true ) );
Settings::flush();
$plans = \AutoGroweHome\License\Features::default_plans();
$t( 'a mátrixban: Starter –, Professional ✓, Agency ✓', ! in_array( 'vision_prompt', $plans['starter']['features'], true ) && in_array( 'vision_prompt', $plans['professional']['features'], true ) && in_array( 'vision_prompt', $plans['agency']['features'], true ) );
$t( 'a funkció a katalógusban', isset( \AutoGroweHome\License\Features::catalog()['vision_prompt'] ) );
$t( 'saját oldalon fut', VisionPrompt::enabled() );
$lic_keep = get_option( \AutoGroweHome\License\LicenseManager::OPTION, null );
$no_owner = fn() => false;
add_filter( 'agh_owner_mode', $no_owner );
delete_option( \AutoGroweHome\License\LicenseManager::OPTION );
$t( 'Starter csomagban nem fut', ! VisionPrompt::enabled() );
$calls = array();
$run( 'visiontest-starter' );
$t( 'Starter csomagban 0 Claude-hívás és a mai prompt', 0 === count( $calls ) && false === strpos( (string) ( $sent['hero'][0]['prompt'] ?? '' ), 'red hatchback' ) );
update_option( \AutoGroweHome\License\LicenseManager::OPTION, array( 'status' => 'active', 'plan' => 'professional', 'expires_at' => '' ) );
$t( 'Professional csomagban fut', VisionPrompt::enabled() );
update_option( \AutoGroweHome\License\LicenseManager::OPTION, array( 'status' => 'active', 'plan' => 'agency', 'expires_at' => '' ) );
$t( 'Agency csomagban fut', VisionPrompt::enabled() );
remove_filter( 'agh_owner_mode', $no_owner );
if ( null === $lic_keep ) {
	delete_option( \AutoGroweHome\License\LicenseManager::OPTION );
} else {
	update_option( \AutoGroweHome\License\LicenseManager::OPTION, $lic_keep );
}

// takarítás: a többi teszt kulcs nélküli állapotot vár
remove_filter( 'pre_http_request', $fake, 10 );
Secrets::set( 'anthropic_api_key', '' );
Settings::update_group( 'anthropic', array( 'vision_prompt' => true, 'use_for_plan' => true ) );
Settings::flush();

echo "képleíró prompt: {$ok}/" . ( $ok + $fail ) . ( $fail ? " – {$fail} HIBA" : '' ) . "\n";
exit( $fail ? 1 : 0 );
