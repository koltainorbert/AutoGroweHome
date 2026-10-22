<?php
/**
 * Build mode („Építés az alapoktól”) – the PHP port against the JS reference, WITHOUT WordPress.
 *
 *  a) Build::sanitize() is idempotent and equals JS normalize() for 124 cases (120 random houses
 *     + a rectangle, an L with openings across the box seams, a house with a diagonal wall, rooms
 *     drawn as rectangles inside the floor – 1.16.3);
 *  b) outline area, footprint boxes, room areas/keys and the opening → box-face mapping (bOps)
 *     equal the JS (tolerance 1e-6 m²);
 *  c) BuildingModel with build mode on: the parts cover exactly the outline area and the room count
 *     equals the JS; with build mode off the output is byte-identical to a configuration without
 *     the 'build' key (json_encode); the prompt phrase appears only when on.
 *
 * Reference data: `node tests/build-parity.js` (skipped with one line when node is missing).
 * Usage: php tests/build-test.php      Output: one summary line; exit code 1 on any failure.
 *
 * @package AutoGroweHome
 */

if ( PHP_SAPI !== 'cli' ) {
	exit( 1 );
}

define( 'ABSPATH', __DIR__ . '/' );
define( 'AGH_DIR', dirname( __DIR__ ) . '/' );
define( 'AGH_URL', 'http://example.test/wp-content/plugins/autogrowehome/' );
define( 'AGH_VERSION', 'test' );

/* ---------------------------------------------------------------- minimal WordPress stubs */
$GLOBALS['agh_options'] = array();
function __( $s, $d = null ) { return $s; } // phpcs:ignore
function get_option( $k, $d = false ) { return $GLOBALS['agh_options'][ $k ] ?? $d; }
function update_option( $k, $v, $a = null ) { $GLOBALS['agh_options'][ $k ] = $v; return true; }
function wp_is_numeric_array( $a ) { return is_array( $a ) && ( array() === $a || array_keys( $a ) === range( 0, count( $a ) - 1 ) ); }
function wp_parse_url( $u, $c = -1 ) { return parse_url( $u, $c ); }
function esc_url_raw( $u, $p = null ) { return (string) $u; }
function number_format_i18n( $n, $d = 0 ) { return number_format( (float) $n, $d ); }
function wp_json_encode( $d, $o = 0, $depth = 512 ) { return json_encode( $d, $o, $depth ); }
function determine_locale() { return 'hu_HU'; }
function apply_filters( $h, $v ) { return $v; }
function get_privacy_policy_url() { return ''; }
function home_url( $p = '' ) { return 'http://example.test/' . ltrim( $p, '/' ); }
function admin_url( $p = '' ) { return 'http://example.test/wp-admin/' . ltrim( $p, '/' ); }

require_once AGH_DIR . 'includes/Autoloader.php';
\AutoGroweHome\Autoloader::register();

use AutoGroweHome\Build\Build;
use AutoGroweHome\Generation\BuildingModel;
use AutoGroweHome\Support\Settings;

$agh_pass = 0;
$agh_fail = array();
function agh_ok( bool $ok, string $label ): void {
	global $agh_pass, $agh_fail;
	if ( $ok ) {
		++$agh_pass;
	} elseif ( count( $agh_fail ) < 25 ) {
		$agh_fail[] = $label;
	} else {
		$agh_fail[] = '';
	}
}

/** Deep equality of decoded JSON (numbers within $tol). */
function agh_eq( $a, $b, float $tol = 1e-9 ): bool {
	if ( is_array( $a ) && is_array( $b ) ) {
		if ( array_map( 'strval', array_keys( $a ) ) !== array_map( 'strval', array_keys( $b ) ) ) {
			return false;
		}
		foreach ( $a as $k => $v ) {
			if ( ! agh_eq( $v, $b[ $k ], $tol ) ) {
				return false;
			}
		}
		return true;
	}
	if ( ( is_int( $a ) || is_float( $a ) ) && ( is_int( $b ) || is_float( $b ) ) ) {
		return abs( $a - $b ) <= $tol;
	}
	return $a === $b;
}

function agh_json( $v ) {
	return json_decode( (string) json_encode( $v ), true );
}

$agh_node = trim( (string) shell_exec( 'command -v node 2>/dev/null' ) );
if ( '' === $agh_node ) {
	echo 'build-test.php: SKIP (node not found – the JS reference data cannot be produced)' . PHP_EOL;
	exit( 0 );
}
$agh_cases = json_decode( (string) shell_exec( escapeshellarg( $agh_node ) . ' ' . escapeshellarg( AGH_DIR . 'tests/build-parity.js' ) ), true );
agh_ok( is_array( $agh_cases ) && 124 === count( $agh_cases ), 'tests/build-parity.js gives 124 cases' );
$agh_cases = is_array( $agh_cases ) ? $agh_cases : array();

/* ---------------------------------------------------------------- a) sanitize = normalize */
agh_ok( array() === Build::sanitize( array() ) && array() === Build::sanitize( null ) && array() === Build::sanitize( 'x' ) && array() === Build::sanitize( array( 1, 2 ) ), 'empty / invalid input gives array()' );
foreach ( $agh_cases as $c ) {
	$s1 = agh_json( Build::sanitize( $c['input'] ) );
	agh_ok( agh_eq( $s1, $c['build'] ), $c['name'] . ': sanitize(input) = JS normalize' );
	agh_ok( json_encode( Build::sanitize( $c['build'] ) ) === json_encode( Build::sanitize( Build::sanitize( $c['build'] ) ) ), $c['name'] . ': sanitize idempotent' );
	agh_ok( agh_eq( agh_json( Build::sanitize( $c['build'] ) ), $c['build'] ), $c['name'] . ': sanitize(normalized) unchanged' );
}

/* ---------------------------------------------------------------- b) geometry */
foreach ( $agh_cases as $c ) {
	$m = Build::model( $c['build'] );
	agh_ok( $m['ok'] === $c['ok'], $c['name'] . ': ok ' . var_export( $m['ok'], true ) );
	if ( null !== $c['outlineArea'] ) {
		agh_ok( isset( $m['area'] ) && abs( $m['area'] - $c['outlineArea'] ) < 1e-6, $c['name'] . ': outline area ' . ( $m['area'] ?? '-' ) . ' vs ' . $c['outlineArea'] );
	}
	$boxes = array_map( static fn( $q ) => array( round( $q['x0'], 6 ), round( $q['y0'], 6 ), round( $q['x1'], 6 ), round( $q['y1'], 6 ) ), $m['boxes'] ?? array() );
	usort( $boxes, static fn( $p, $q ) => $p <=> $q );
	agh_ok( agh_eq( $boxes, $c['boxes'], 1e-6 ), $c['name'] . ': boxes' );
	// rooms (computed for every closed drawing, orthogonal or not)
	$rooms = array();
	$keys  = array();
	$b     = $c['build'];
	foreach ( $b['levels'] as $lv => $unused ) {
		$rooms[ $lv ] = array();
		$keys[ $lv ]  = array();
	}
	foreach ( Build::rooms( $c['build'] ) as $r ) {
		$rooms[ $r['lv'] ][] = round( $r['area'], 2 );
		$keys[ $r['lv'] ][]  = $r['key'];
	}
	agh_ok( agh_eq( array_values( $rooms ), $c['roomAreas'], 1e-6 ), $c['name'] . ': room areas ' . json_encode( array_values( $rooms ) ) . ' vs ' . json_encode( $c['roomAreas'] ) );
	agh_ok( array_values( $keys ) === $c['roomKeys'], $c['name'] . ': room keys' );
	$cnt = 0;
	foreach ( $m['ops'] ?? array() as $faces ) {
		foreach ( $faces as $l ) {
			$cnt += count( $l );
		}
	}
	agh_ok( $cnt === $c['opsCount'], $c['name'] . ': opening pieces ' . $cnt . ' vs ' . $c['opsCount'] );
	agh_ok( agh_eq( agh_json( array_values( $m['ops'] ?? array() ) ), $c['ops'], 1e-9 ), $c['name'] . ': bOps per box' );
	agh_ok( ( $m['seams'] ?? 0 ) === $c['seams'], $c['name'] . ': seams' );
}

/* ---------------------------------------------------------------- c) BuildingModel */
$agh_cfg = array(
	'levels' => 'single', 'net_area' => 120, 'bedrooms' => 3, 'bathrooms' => 1, 'footprint' => 'rectangle', 'ceiling_height' => 2.8,
	'roof_type' => 'gable', 'roof_pitch' => 35, 'terrace_area' => 20, 'garage' => 'none', '_explicit' => array(),
	'rooms' => array(
		array( 'id' => 'r1', 'type' => 'living_kitchen', 'name' => 'Nappali', 'area' => 40, 'level' => 0 ),
		array( 'id' => 'r2', 'type' => 'bedroom', 'name' => 'Háló', 'area' => 14, 'level' => 0 ),
		array( 'id' => 'r3', 'type' => 'bathroom', 'name' => 'Fürdő', 'area' => 7, 'level' => 0 ),
		array( 'id' => 'r4', 'type' => 'hall', 'name' => 'Előtér', 'area' => 6, 'level' => 0 ),
	),
);
// build mode off: byte-identical with and without the drawing
Settings::update_group( 'build', array( 'enabled' => false ) );
$agh_plain = json_encode( BuildingModel::build( $agh_cfg, 'A' ) );
foreach ( array( 0, 120, 121 ) as $i ) {
	if ( ! isset( $agh_cases[ $i ] ) ) {
		continue;
	}
	agh_ok( json_encode( BuildingModel::build( $agh_cfg + array( 'build' => $agh_cases[ $i ]['build'] ), 'A' ) ) === $agh_plain, $agh_cases[ $i ]['name'] . ': off = identical model' );
}
// build mode on
Settings::update_group( 'build', array( 'enabled' => true ) );
agh_ok( json_encode( BuildingModel::build( $agh_cfg, 'A' ) ) === $agh_plain, 'on without a drawing = identical model' );
agh_ok( json_encode( BuildingModel::build( $agh_cfg + array( 'build' => array() ), 'A' ) ) === $agh_plain, 'on with an empty drawing = identical model' );
foreach ( $agh_cases as $c ) {
	$cfg = $agh_cfg;
	$cfg['levels'] = array( 1 => 'single', 2 => 'two', 3 => 'three' )[ count( $c['build']['levels'] ) ] ?? 'single';
	$cfg['build']  = $c['build'];
	$m = BuildingModel::build( $cfg, 'A' );
	if ( ! $c['ok'] ) {
		agh_ok( 'drawing' !== ( $m['source'] ?? '' ), $c['name'] . ': not orthogonal → the usual generator' );
		continue;
	}
	agh_ok( 'agh-building-v1' === $m['schema'] && 'drawing' === ( $m['source'] ?? '' ), $c['name'] . ': model from the drawing' );
	$sum = 0.0;
	foreach ( $m['parts'] as $p ) {
		$sum += $p['w'] * $p['h'];
	}
	agh_ok( abs( $sum - $c['outlineArea'] ) < 1e-3, $c['name'] . ': parts area ' . $sum . ' = outline ' . $c['outlineArea'] );
	$js_rooms = 0;
	foreach ( $c['roomAreas'] as $l ) {
		$js_rooms += count( $l );
	}
	agh_ok( count( $m['rooms'] ) === $js_rooms, $c['name'] . ': rooms ' . count( $m['rooms'] ) . ' vs ' . $js_rooms );
	agh_ok( count( $m['levels'] ) === count( $c['build']['levels'] ), $c['name'] . ': levels' );
	agh_ok( count( $m['openings'] ) === count( $c['build']['openings'] ), $c['name'] . ': openings' );
	$keys_ok = true;
	foreach ( array( 'parts', 'levels', 'rooms', 'openings', 'walls', 'roof', 'terrace', 'garage', 'checks', 'meta', 'width', 'length', 'shape', 'shape_label', 'mirror', 't_ext', 't_int' ) as $k ) {
		$keys_ok = $keys_ok && array_key_exists( $k, $m );
	}
	agh_ok( $keys_ok, $c['name'] . ': same keys as the generator' );
	$in = true;
	foreach ( $m['openings'] as $o ) {
		$in = $in && $o['x'] >= -0.5 && $o['x'] <= $m['width'] + 0.5 && $o['y'] >= -0.5 && $o['y'] <= $m['length'] + 0.5 && in_array( $o['orient'], array( 'h', 'v' ), true );
	}
	agh_ok( $in, $c['name'] . ': openings inside the footprint' );
}
// the prompt phrase of the masonry
$agh_rect = $agh_cases[120]['build'] ?? array();
agh_ok( 'load-bearing walls of 38 cm ceramic masonry blocks with 12 cm EPS insulation' === \AutoGroweHome\Prompt\PromptEngine::masonry_phrase( $agh_cfg + array( 'build' => $agh_rect ) ), 'prompt: masonry phrase' );
Settings::update_group( 'build', array( 'enabled' => false ) );
agh_ok( '' === \AutoGroweHome\Prompt\PromptEngine::masonry_phrase( $agh_cfg + array( 'build' => $agh_rect ) ), 'prompt: no phrase when off' );

$agh_total = $agh_pass + count( $agh_fail );
foreach ( array_filter( $agh_fail ) as $agh_label ) {
	echo 'FAIL  ' . $agh_label . PHP_EOL;
}
echo 'build-test.php: ' . $agh_pass . '/' . $agh_total . ' OK' . PHP_EOL;
exit( empty( $agh_fail ) ? 0 : 1 );
