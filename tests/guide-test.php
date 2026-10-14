<?php
/**
 * A 3D modellről küldött vezetőkép útja: a tervezőtől a képgenerálóig (tesztoldal, WordPress-szel).
 *
 * 1. A `Storage::put_guides()` csak valódi, méretes PNG/JPEG-et vesz át, és a védett tárhelyre teszi.
 * 2. A `Pipeline::render()` a koncepcióképhez (hero) is a mentett 3D képet küldi structure
 *    referenciaként – a kérést az `agh_provider_request` szűrővel fogjuk el, hálózat nélkül.
 * 3. Vezetőkép nélkül a homlokzati nézet a szerver saját tömegvázlatát kapja, a hero semmit –
 *    vagyis a korábbi viselkedés megmarad.
 *
 * Használat: php tests/guide-test.php [/path/to/test/wordpress]   (alap: /home/claude/wpsite)
 */

$agh_wp_dir = $argv[1] ?? '/home/claude/wpsite';
define( 'WP_USE_THEMES', false );
$_SERVER['HTTP_HOST']   = '127.0.0.1:8899';
$_SERVER['REQUEST_URI'] = '/';
$_SERVER['REMOTE_ADDR'] = '203.0.113.11';
require $agh_wp_dir . '/wp-load.php';

use AutoGroweHome\Generation\JobQueue;
use AutoGroweHome\Generation\Pipeline;
use AutoGroweHome\Projects\Repository;
use AutoGroweHome\Prompt\PromptEngine;
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

/** Valódi, 1344x768-as JPEG (GD), hogy a méret- és típusellenőrzés élesben fusson. */
function agh_shot( int $w = 1344, int $h = 768 ): string {
	$img = imagecreatetruecolor( $w, $h );
	imagefilledrectangle( $img, 0, 0, $w, $h, imagecolorallocate( $img, 180, 200, 220 ) );
	imagefilledrectangle( $img, (int) ( $w * 0.25 ), (int) ( $h * 0.3 ), (int) ( $w * 0.75 ), (int) ( $h * 0.8 ), imagecolorallocate( $img, 230, 225, 215 ) );
	ob_start();
	imagejpeg( $img, null, 82 );
	$raw = (string) ob_get_clean();
	imagedestroy( $img );
	return 'data:image/jpeg;base64,' . base64_encode( $raw );
}

/** Mit kapott a képszolgáltató: nézetenként a vezetőkép hossza. */
$seen   = array();
$prompt = array();
add_filter(
	'agh_provider_request',
	function ( $req, $asset ) use ( &$seen, &$prompt ) {
		$seen[ (string) $asset['view'] ]   = strlen( (string) ( $req['structure_image'] ?? '' ) );
		$prompt[ (string) $asset['view'] ] = (string) ( $req['prompt'] ?? '' );
		return $req;
	},
	10,
	2
);

Settings::update_group( 'magnific', array( 'structure_guidance' => true ) );
Settings::update_group( 'images', array( 'allow_test_provider' => true, 'provider' => 'test' ) );
Settings::flush();

// érvényes alapkonfiguráció (a tervező is ebből indul), különben a tervezés validálásnál elbukik
$cfg = \AutoGroweHome\Params\Validator::sanitize( \AutoGroweHome\Params\Registry::defaults() );
$t( 'az alapkonfiguráció érvényes', empty( \AutoGroweHome\Params\Validator::check( $cfg )['errors'] ) );

/* ---------------------------------------------------------------- 1. tárolás és ellenőrzés */
$p1   = Repository::create_project( $cfg, 0, 'guidetest', 'guidetest-ip', 'hu_HU', 1 );
$uuid = (string) $p1['uuid'];
$n    = Storage::put_guides(
	$uuid,
	array(
		'hero'  => agh_shot(),
		'front' => agh_shot(),
		'bogus' => agh_shot(),                                            // nincs ilyen nézet
		'back'  => 'data:image/gif;base64,R0lGOD',                        // nem PNG/JPEG
		'left'  => 'data:image/png;base64,' . base64_encode( 'rövid' ),   // túl kevés adat
		'right' => agh_shot( 64, 64 ),                                    // túl kicsi kép
	)
);
$t( 'csak a két jó kép került be', 2 === $n );
$t( 'a hero képe megvan', '' !== Storage::guide_path( $uuid, 'hero' ) );
$t( 'a front képe megvan', '' !== Storage::guide_path( $uuid, 'front' ) );
$t( 'ismeretlen nézet nincs eltárolva', '' === Storage::guide_path( $uuid, 'bogus' ) );
$t( 'nem képi adat nincs eltárolva', '' === Storage::guide_path( $uuid, 'back' ) );
$t( 'túl kicsi kép nincs eltárolva', '' === Storage::guide_path( $uuid, 'right' ) );
$t( 'a vezetőkép a védett tárhelyen van', 0 === strpos( Storage::guide_path( $uuid, 'hero' ), Storage::base_dir() ) );
$t( 'a vezetőkép mérete életszerű', filesize( Storage::guide_path( $uuid, 'hero' ) ) > 4096 );
$t( 'az útvonal-ellenőrzés nem enged ki', '' === Storage::guide_path( $uuid, '../../etc' ) );

/* ---------------------------------------------------------------- 2. vezetőképpel generálva */
$pr = Pipeline::start( $cfg, array( 'user_id' => 0, 'guest_hash' => 'guidetest', 'ip_hash' => 'guidetest-ip', 'lang' => 'hu_HU', 'reserved' => array() ) );
Storage::put_guides( (string) $pr['uuid'], array( 'hero' => agh_shot(), 'front' => agh_shot() ) );
$ran = 0;
for ( $i = 0; $i < 12 && empty( $seen['hero'] ); $i++ ) {
	$ran += JobQueue::run( 25.0, (int) $pr['id'] );
}
$t( 'a sor lefutott', $ran > 0 );
$t( 'a hero kapott vezetőképet', isset( $seen['hero'] ) && $seen['hero'] > 4096 );
$t( 'a hero promptja megmondja, mi a referenciakép', isset( $prompt['hero'] ) && false !== strpos( $prompt['hero'], 'reference image' ) );
$assets = array_filter( Repository::assets( (int) $pr['id'] ), function ( $a ) { return 'render' === $a['kind'] && 'hero' === $a['view']; } );
$done   = array_filter( $assets, function ( $a ) { return 'done' === $a['status']; } );
$t( 'készült koncepciókép', count( $done ) > 0 );

/* ---------------------------------------------------------------- 3. vezetőkép nélkül: a régi út */
$seen   = array();
$prompt = array();
$pr2    = Pipeline::start( $cfg, array( 'user_id' => 0, 'guest_hash' => 'guidetest2', 'ip_hash' => 'guidetest-ip2', 'lang' => 'hu_HU', 'reserved' => array() ) );
for ( $i = 0; $i < 12 && ! array_key_exists( 'hero', $seen ); $i++ ) {
	JobQueue::run( 25.0, (int) $pr2['id'] );
}
$t( 'vezetőkép nélkül a hero nem kap structure referenciát', array_key_exists( 'hero', $seen ) && 0 === $seen['hero'] );
$t( 'vezetőkép nélkül a prompt sem említ referenciát', isset( $prompt['hero'] ) && false === strpos( $prompt['hero'], 'reference image' ) );

/* ---------------------------------------------------------------- 4. hűség: erősség és mondat */
$strength = array();
foreach ( array( 'free' => 25, 'balanced' => 45, 'faithful' => 65, 'clone' => 80, 'custom' => 37 ) as $mode => $want ) {
	Settings::update_group( 'magnific', array( 'fidelity' => $mode, 'structure_strength' => 37 ) );
	Settings::flush();
	$strength[ $mode ] = PromptEngine::fidelity_strength();
}
$t( 'minden hűségszint a várt erősséget adja', array( 25, 45, 65, 80, 37 ) === array_values( $strength ) );

Settings::update_group( 'magnific', array( 'fidelity' => 'clone' ) );
Settings::flush();
$note = PromptEngine::reference_note();
$t( 'a klón mondat a referenciaképre hivatkozik', false !== strpos( $note, 'exact 3D model' ) && false !== strpos( $note, 'one to one' ) );
$t( 'a mondat nem hosszabb 700 karakternél', strlen( $note ) < 700 );
Settings::update_group( 'magnific', array( 'fidelity' => 'free' ) );
Settings::flush();
$t( 'szabad módban rövidebb, lazább mondat', strlen( PromptEngine::reference_note() ) < strlen( $note ) );
Settings::update_group( 'magnific', array( 'fidelity' => 'faithful' ) );
Settings::flush();

// a vezetőképes projekt promptjában ott van a mondat, a vezetőkép nélküliében nincs
$t( 'a vezetőképes hero promptja hivatkozik a referenciára', isset( $prompt['hero'] ) );

/* ---------------------------------------------------------------- 5. klón: tiltás és tetőszín */
Settings::update_group( 'magnific', array( 'fidelity' => 'clone' ) );
Settings::flush();
$lead = PromptEngine::reference_lead();
$t( 'klón módban van nyitóblokk', '' !== $lead && 0 === strpos( $lead, 'Photorealistic photograph of EXACTLY' ) );
$t( 'a nyitóblokk egy épületet ír elő', false !== strpos( $lead, 'exactly ONE building' ) );
$t( 'a nyitóblokk tiltja a pajtát és a melléképületet', false !== strpos( $lead, 'no barn' ) && false !== strpos( $lead, 'no outbuilding' ) && false !== strpos( $lead, 'no second house' ) );
$t( 'a nyitóblokk a kameraállást is köti', false !== strpos( $lead, 'Keep the camera position' ) );
Settings::update_group( 'magnific', array( 'fidelity' => 'balanced' ) );
Settings::flush();
$t( 'kiegyensúlyozott módban nincs nyitóblokk', '' === PromptEngine::reference_lead() );
Settings::update_group( 'magnific', array( 'fidelity' => 'faithful' ) );
Settings::flush();

// a stílusszöveg nem rendel plusz épületet, és a tető színe a modellé
$cfg2 = \AutoGroweHome\Params\Validator::sanitize( \AutoGroweHome\Params\Registry::defaults() );
$cfg2['arch_style'] = 'rustic';
$cfg2['roof_type']  = 'gable';
$cfg2['roof_color'] = '#8C4A35';
$con2 = array(
	'variant'  => 'A',
	'brief'    => array( 'name' => 'T', 'tagline' => '', 'direction' => '' ),
	'building' => \AutoGroweHome\Generation\BuildingModel::build( $cfg2, 'A', array() ),
);
$pr3 = PromptEngine::build( $cfg2, $con2, 'hero', null, (int) PromptEngine::get()['version'] )['prompt'];
// a katalógusban tárolt stílusszöveget a frissítés javítja (DB v9), ezt is itt mérjük
\AutoGroweHome\Catalog\Catalog::upgrade_style_prompts();
$pr3 = PromptEngine::build( $cfg2, $con2, 'hero', null, (int) PromptEngine::get()['version'] )['prompt'];
$t( 'a stílusszöveg nem rendel pajtaszárnyat', false === stripos( $pr3, 'barn wing' ) );
$t( 'a tetőcserép a modell színét kapja', false !== stripos( $pr3, 'in brick red' ) );
$tile = substr( $pr3, (int) stripos( $pr3, 'roof tiles' ) );
$tile = substr( $tile, 0, (int) strpos( $tile . '.', '.' ) );
$t( 'a tetőcserép mondatában nincs ellentmondó szín', false === stripos( $tile, 'anthracite' ) );
$t( 'a teljes prompt a nyitóblokkal együtt is belefér', strlen( PromptEngine::reference_lead() . $pr3 ) < PromptEngine::MAX_PROMPT );

/* ---------------------------------------------------------------- 6. vezetőkép képaránya */
$t( 'van alapértelmezett képarány', (float) Settings::get( 'magnific.guide_aspect', 0 ) > 1 );

/* ---------------------------------------------------------------- takarítás */
foreach ( array( $uuid, (string) $pr['uuid'], (string) $pr2['uuid'] ) as $u ) {
	Storage::delete_project( $u );
}
foreach ( array( $p1, $pr, $pr2 ) as $prj ) {
	Repository::update_project( (int) $prj['id'], array( 'status' => 'deleted' ) );
}

echo 'vezetőkép: ' . $ok . '/' . ( $ok + $fail ) . ( $fail ? ' – ' . $fail . ' hiba' : '' ) . ', hero vezetőkép ' . (int) ( $seen['hero'] ?? 0 ) . ' bájt vezetés nélkül' . "\n";
exit( $fail ? 1 : 0 );
