<?php
/**
 * A 3D modellről küldött vezetőkép útja: a tervezőtől a képgenerálóig (tesztoldal, WordPress-szel).
 *
 * 1. A `Storage::put_guides()` csak valódi, méretes PNG/JPEG-et vesz át, és a védett tárhelyre teszi.
 * 2. A `Pipeline::render()` a koncepcióképhez (hero) is a mentett 3D képet küldi structure
 *    referenciaként – a kérést az `agh_provider_request` szűrővel fogjuk el, hálózat nélkül.
 * 3. Vezetőkép nélkül a homlokzati nézet a szerver saját tömegvázlatát kapja, a hero semmit –
 *    vagyis a korábbi viselkedés megmarad.
 * 7–10. (1.12.0) Negatív prompt a konfigurációból, a Magnific-kérés teste (structure és style
 *    külön erősséggel, hdr) – a `pre_http_request` szűrővel elfogva, hálózat nélkül –, a stílusminta
 *    a médiatárból, és a belső nézet 3D vezetése a saját nyitóblokkjával.
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
$negs   = array();
add_filter(
	'agh_provider_request',
	function ( $req, $asset ) use ( &$seen, &$prompt, &$negs ) {
		$seen[ (string) $asset['view'] ]   = strlen( (string) ( $req['structure_image'] ?? '' ) );
		$prompt[ (string) $asset['view'] ] = (string) ( $req['prompt'] ?? '' );
		$negs[ (string) $asset['view'] ]   = (string) ( $req['negative_prompt'] ?? '' );
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
foreach ( array( 'free' => 25, 'balanced' => 45, 'faithful' => 75, 'clone' => 85, 'custom' => 37 ) as $mode => $want ) {
	Settings::update_group( 'magnific', array( 'fidelity' => $mode, 'structure_strength' => 37 ) );
	Settings::flush();
	$strength[ $mode ] = PromptEngine::fidelity_strength();
}
$t( 'minden hűségszint a várt erősséget adja (a recept: structure 70–85)', array( 25, 45, 75, 85, 37 ) === array_values( $strength ) );

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


/* ---------------------------------------------------------------- 7. negatív prompt a konfigurációból */
$cfg3               = $cfg2;
$cfg3['levels']     = 'two';
$cfg3['roof_type']  = 'gable';
$cfg3['roof_color'] = '#8C4A35';
$cfg3['garage']     = 'separate';
$wrong = PromptEngine::config_negative( $cfg3 );
$t( 'a negatív lista a rossz tetőszínt tiltja', in_array( 'anthracite roof', $wrong, true ) );
$t( 'a negatív lista a rossz tetőformát tiltja', in_array( 'flat roof', $wrong, true ) );
$t( 'a negatív lista a rossz szintszámot tiltja', in_array( 'single-storey bungalow', $wrong, true ) );
$t( 'a negatív lista a plusz épületet tiltja', in_array( 'barn', $wrong, true ) && in_array( 'second house', $wrong, true ) );
$t( 'a ház saját értéke nincs a tiltólistán', ! in_array( 'red roof tiles', $wrong, true ) && ! in_array( 'detached garage building', $wrong, true ) );
$cfg4               = $cfg3;
$cfg4['roof_color'] = '#3A3D40';
$cfg4['levels']     = 'single';
$cfg4['roof_type']  = 'flat';
$w4 = PromptEngine::config_negative( $cfg4 );
$t( 'lapostetős földszintesnél fordított a lista', in_array( 'pitched roof', $w4, true ) && in_array( 'second storey', $w4, true ) && ! in_array( 'flat roof', $w4, true ) );
$b3 = PromptEngine::build( $cfg3, $con2, 'hero', null, (int) PromptEngine::get()['version'] );
$t( 'a negatív rész tartalmazza a téves alternatívákat', false !== strpos( $b3['negative'], 'Also avoid:' ) && false !== strpos( $b3['negative'], 'anthracite roof' ) );
$wi = PromptEngine::config_negative( $cfg3, true );
$t( 'belül a plusz bútor és nyílás tilos', in_array( 'furniture that is not in the reference', $wi, true ) && in_array( 'extra doors or windows', $wi, true ) );
$t( 'a vezetőképes hero kérése külön is viszi a negatív promptot', '' !== (string) ( $negs['hero'] ?? '' ) );

// hossz: nyitóblokk + prompt + negatív együtt is belefér, és a negatív lista a végén teljes
Settings::update_group( 'magnific', array( 'fidelity' => 'clone' ) );
Settings::flush();
$long = PromptEngine::compose( $b3, PromptEngine::reference_lead() );
$t( 'a teljes kérésszöveg belefér a határba', mb_strlen( $long ) <= PromptEngine::MAX_PROMPT );
$t( 'a szöveg a nyitóblokkal kezdődik', 0 === strpos( $long, 'Photorealistic photograph of EXACTLY' ) );
$t( 'a negatív lista a végén teljes', substr( $long, -strlen( $b3['negative'] ) ) === $b3['negative'] );
$b3x           = $b3;
$b3x['prompt'] = $b3['prompt'] . str_repeat( ' Extra wish about the garden and the light.', 60 );
$b3x['parts']['user'] = str_repeat( 'Extra wish about the garden and the light. ', 60 );
$long2 = PromptEngine::compose( $b3x, PromptEngine::reference_lead() );
$t( 'túl hosszú promptnál is a határon belül, a negatív lista épen', mb_strlen( $long2 ) <= PromptEngine::MAX_PROMPT && substr( $long2, -strlen( $b3['negative'] ) ) === $b3['negative'] );
Settings::update_group( 'magnific', array( 'fidelity' => 'faithful' ) );
Settings::flush();

/* ---------------------------------------------------------------- 8. a Magnific-kérés teste (hálózat nélkül) */
\AutoGroweHome\Support\Secrets::set( 'magnific_api_key', 'teszt-kulcs-nem-valodi' );
Settings::update_group( 'magnific', array( 'enabled' => true, 'style_strength' => 45, 'hdr' => 35, 'style_adherence' => 60, 'fidelity' => 'faithful' ) );
Settings::flush();
$bodies = array();
$fake   = function ( $pre, $args, $url ) use ( &$bodies ) {
	if ( false === strpos( (string) $url, 'magnific.com' ) ) {
		return $pre;
	}
	$bodies[] = json_decode( (string) ( $args['body'] ?? '' ), true );
	return array(
		'headers'  => array(),
		'body'     => wp_json_encode( array( 'data' => array( 'task_id' => wp_generate_uuid4(), 'status' => 'CREATED', 'generated' => array() ) ) ),
		'response' => array( 'code' => 200, 'message' => 'OK' ),
		'cookies'  => array(),
		'filename' => null,
	);
};
add_filter( 'pre_http_request', $fake, 10, 3 );
$mag    = new \AutoGroweHome\Ai\MagnificProvider();
$shot64 = substr( agh_shot(), strlen( 'data:image/jpeg;base64,' ) );
$mag->submit( array( 'op' => 'hero', 'view' => 'hero', 'prompt' => 'p', 'structure_image' => $shot64, 'style_image' => $shot64 ) );
$mag->submit( array( 'op' => 'hero', 'view' => 'hero', 'prompt' => 'p', 'structure_image' => $shot64 ) );
Settings::update_group( 'magnific', array( 'view_strategy' => 'style' ) );
Settings::flush();
$mag->submit( array( 'op' => 'view', 'view' => 'front', 'prompt' => 'p', 'structure_image' => $shot64, 'reference_image' => $shot64, 'style_image' => '' ) );
Settings::update_group( 'magnific', array( 'view_strategy' => 'reference' ) );
Settings::flush();
remove_filter( 'pre_http_request', $fake, 10 );
$b0 = $bodies[0] ?? array();
$b1 = $bodies[1] ?? array();
$b2 = $bodies[2] ?? array();
$t( 'stílusmintával a hero kérése style referenciát visz', ! empty( $b0['style_reference'] ) && ! empty( $b0['structure_reference'] ) );
$t( 'a két erősség külön: structure 75, adherence 55 (style 45)', 75 === ( $b0['structure_strength'] ?? 0 ) && 55 === ( $b0['adherence'] ?? 0 ) );
$t( 'stílusminta mellett hdr 35 megy', 35 === ( $b0['hdr'] ?? 0 ) );
$t( 'stílusminta nélkül nincs style referencia és hdr (a mai út)', ! isset( $b1['style_reference'] ) && ! isset( $b1['hdr'] ) && ! isset( $b1['adherence'] ) );
$t( 'a nézet a fő képet kapja referenciának, a régi adherence-szel', ! empty( $b2['style_reference'] ) && 60 === ( $b2['adherence'] ?? 0 ) );
$t( 'a Mystic kérésben nincs nem létező negatív mező', ! isset( $b0['negative_prompt'] ) );
Settings::update_group( 'magnific', array( 'style_strength' => 40 ) );
Settings::flush();
$t( 'a style erősség állítható (40 → adherence 60)', 60 === PromptEngine::style_adherence() );
Settings::update_group( 'magnific', array( 'style_strength' => 45 ) );
Settings::flush();

/* ---------------------------------------------------------------- 9. stílusminta a médiatárból */
require_once ABSPATH . 'wp-admin/includes/image.php';
$big = imagecreatetruecolor( 2400, 1350 );
imagefilledrectangle( $big, 0, 0, 2400, 1350, imagecolorallocate( $big, 200, 170, 120 ) );
$up  = wp_upload_dir();
$fn  = trailingslashit( $up['path'] ) . 'agh-style-sample-test.jpg';
imagejpeg( $big, $fn, 85 );
imagedestroy( $big );
$aid = wp_insert_attachment( array( 'post_mime_type' => 'image/jpeg', 'post_title' => 'agh style sample test', 'post_status' => 'inherit' ), $fn );
wp_update_attachment_metadata( $aid, wp_generate_attachment_metadata( $aid, $fn ) );
Settings::update_group( 'magnific', array( 'style_ref_rustic' => $aid, 'style_ref_default' => 0, 'style_ref_interior' => 0 ) );
Settings::flush();
$smp  = Pipeline::style_sample( 'rustic' );
$info = $smp ? getimagesizefromstring( base64_decode( $smp ) ) : false;
$t( 'a stílus saját mintaképe megvan', '' !== $smp );
$t( 'a mintakép legfeljebb 1536 px és JPEG', $info && max( $info[0], $info[1] ) <= 1536 && IMAGETYPE_JPEG === $info[2] );
$t( 'minta nélküli stílusnál üres (nincs általános minta)', '' === Pipeline::style_sample( 'japandi' ) );
Settings::update_group( 'magnific', array( 'style_ref_default' => $aid ) );
Settings::flush();
$t( 'minta nélküli stílusnál az általános minta megy', '' !== Pipeline::style_sample( 'japandi' ) );
$t( 'belső minta nélkül a belső nézet nem kap mintát', '' === Pipeline::style_sample( 'interior' ) );
Settings::update_group( 'magnific', array( 'style_ref_rustic' => 0, 'style_ref_default' => 0 ) );
Settings::flush();
wp_delete_attachment( $aid, true );

/* ---------------------------------------------------------------- 10. belső nézet 3D vezetése */
$rid = '';
foreach ( (array) ( $cfg['rooms'] ?? array() ) as $r ) {
	if ( ! empty( $r['render'] ) && '' === $rid ) {
		$rid = (string) $r['id'];
	}
}
$t( 'az alapkonfigurációban van renderelendő helyiség', '' !== $rid );
$pr4 = Pipeline::start( $cfg, array( 'user_id' => 0, 'guest_hash' => 'guidetest4', 'ip_hash' => 'guidetest-ip4', 'lang' => 'hu_HU', 'reserved' => array() ) );
$n4  = Storage::put_guides( (string) $pr4['uuid'], array( 'interior_' . $rid => agh_shot(), 'interior_' . str_repeat( 'a', 40 ) => agh_shot() ) );
$t( 'a belső vezetőkép eltárolva, a rossz név nem', 1 === $n4 && '' !== Storage::guide_path( (string) $pr4['uuid'], 'interior_' . $rid ) );
for ( $i = 0; $i < 12; $i++ ) {
	JobQueue::run( 25.0, (int) $pr4['id'] );
	$cs = Repository::concepts( (int) $pr4['id'] );
	if ( ! empty( $cs ) ) {
		break;
	}
}
$cs = Repository::concepts( (int) $pr4['id'] );
$seen = array();
$prompt = array();
if ( ! empty( $cs ) ) {
	Pipeline::enqueue_gallery( Repository::project_by_id( (int) $pr4['id'] ), $cs[0] );
	for ( $i = 0; $i < 20 && ! isset( $seen[ 'interior_' . $rid ] ); $i++ ) {
		JobQueue::run( 25.0, (int) $pr4['id'] );
	}
}
$t( 'a belső nézet kérése vezetőképet visz', ( $seen[ 'interior_' . $rid ] ?? 0 ) > 4096 );
$t( 'a belső prompt a belső nyitóblokkal kezdődik', 0 === strpos( (string) ( $prompt[ 'interior_' . $rid ] ?? '' ), 'Photorealistic interior photograph of EXACTLY the room' ) );
$t( 'a belső prompt is belefér a határba', mb_strlen( (string) ( $prompt[ 'interior_' . $rid ] ?? '' ) ) <= PromptEngine::MAX_PROMPT );
$other = '';
foreach ( $seen as $vk => $len ) {
	if ( 0 === strpos( (string) $vk, 'interior_' ) && 'interior_' . $rid !== $vk ) {
		$other = $vk;
	}
}
$t( 'vezetőkép nélküli helyiség a mai úton megy (nincs structure kép)', '' === $other || 0 === $seen[ $other ] );

/* ---------------------------------------------------------------- takarítás */
foreach ( array( $uuid, (string) $pr['uuid'], (string) $pr2['uuid'], (string) $pr4['uuid'] ) as $u ) {
	Storage::delete_project( $u );
}
foreach ( array( $p1, $pr, $pr2, $pr4 ) as $prj ) {
	Repository::update_project( (int) $prj['id'], array( 'status' => 'deleted' ) );
}

echo 'vezetőkép: ' . $ok . '/' . ( $ok + $fail ) . ( $fail ? ' – ' . $fail . ' hiba' : '' ) . ', hero vezetőkép ' . (int) ( $seen['hero'] ?? 0 ) . ' bájt vezetés nélkül' . "\n";
exit( $fail ? 1 : 0 );
