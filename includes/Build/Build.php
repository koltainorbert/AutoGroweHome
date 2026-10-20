<?php
/**
 * Build mode („Építés az alapoktól”): the server-side port of assets/js/agh-build.js.
 *
 * - sanitize(): the exact port of normalize() (same defaults from assets/data/build-defaults.json,
 *   same clamps, id rules, limits and key order), so a saved drawing is identical on both sides.
 * - model(): the geometry (integer millimetres, like the JS) – wall graph → faces → outline,
 *   rooms, footprint boxes and the opening → box-face mapping of adapt().
 *
 * Coordinates are the JS ones: metres, x along the street front, y towards the viewer (the street
 * side is max y). BuildingModel converts them to the server convention (front at y = 0).
 *
 * Numbers follow JavaScript: Math.round() is js_round() (halves towards +∞), r2/r3 are
 * Math.round(v * 100) / 100 and Math.round(v * 1000) / 1000; every coordinate is a float.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Build;

use AutoGroweHome\Support\Settings;

defined( 'ABSPATH' ) || exit;

final class Build {

	public const STEPS_N       = 16;
	public const OPENING_TYPES = array( 'window', 'door', 'entrance', 'terrace' );
	public const LINTELS       = array( 'auto', 'precast', 'rc', 'steel', 'none' );
	public const KINDS         = array( 'ext', 'int', 'part' );

	/** @var array|null Decoded build-defaults.json. */
	private static $defaults = null;

	/** @var array Small cache of model() results (key: JSON of the input). */
	private static $cache = array();

	/** Admin switch „Építés az alapoktól” (default off). */
	public static function enabled(): bool {
		return (bool) Settings::get( 'build.enabled', false );
	}

	/**
	 * A JSON data file of the plugin (relative path with "/"), decoded; null when missing or invalid.
	 */
	public static function read_json( string $rel ): ?array {
		$file = AGH_DIR . ltrim( $rel, '/' );
		if ( ! is_readable( $file ) ) {
			return null;
		}
		$d = json_decode( (string) file_get_contents( $file ), true );
		return is_array( $d ) ? $d : null;
	}

	public static function defaults(): array {
		if ( null === self::$defaults ) {
			self::$defaults = self::read_json( 'assets/data/build-defaults.json' ) ?? array();
		}
		return self::$defaults;
	}

	/** Tests: use other defaults (null = read the file again). */
	public static function set_defaults( ?array $d ): void {
		self::$defaults = $d;
		self::$cache    = array();
	}

	/* ------------------------------------------------------------------ JavaScript number semantics */

	/** Math.round(): halves go towards +∞. */
	public static function js_round( float $x ): float {
		$f = floor( $x );
		return ( $x - $f >= 0.5 ? $f + 1.0 : $f ) + 0.0;
	}

	private static function r2( float $v ): float {
		return self::js_round( $v * 100 ) / 100;
	}

	private static function r3( float $v ): float {
		return self::js_round( $v * 1000 ) / 1000;
	}

	/** Metres → whole millimetres. */
	private static function c( float $v ): float {
		return self::js_round( $v * 1000 );
	}

	/** Millimetres → metres. */
	private static function m( float $c ): float {
		return $c / 1000;
	}

	private static function clamp( float $v, float $a, float $b ): float {
		return max( $a, min( $b, $v ) );
	}

	/** parseFloat() of a string (leading whitespace, then the longest numeric prefix). */
	private static function parse_float( string $s ): float {
		$s = ltrim( $s, " \t\n\r\x0B\f" );
		if ( ! preg_match( '/^[+-]?(?:Infinity|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/', $s, $mm ) ) {
			return NAN;
		}
		if ( false !== strpos( $mm[0], 'Infinity' ) ) {
			return '-' === $mm[0][0] ? -INF : INF;
		}
		return (float) $mm[0];
	}

	/** num(v, d): a finite number (strings with a decimal comma too) or the default. */
	private static function num( $v, $d ) {
		if ( is_string( $v ) ) {
			$v = self::parse_float( (string) preg_replace( '/,/', '.', $v, 1 ) );
		}
		if ( ( is_int( $v ) || is_float( $v ) ) && is_finite( (float) $v ) ) {
			return (float) $v;
		}
		return $d;
	}

	/** JavaScript truthiness (arrays stand for JS objects and arrays: always truthy). */
	private static function truthy( $v ): bool {
		if ( is_array( $v ) || is_object( $v ) ) {
			return true;
		}
		if ( is_float( $v ) && is_nan( $v ) ) {
			return false;
		}
		if ( is_string( $v ) ) {
			return '' !== $v;
		}
		return (bool) $v;
	}

	/** a || b */
	private static function either( $a, $b ) {
		return self::truthy( $a ) ? $a : $b;
	}

	/** o[k] (undefined → null). */
	private static function at( $o, $k ) {
		return is_array( $o ) && array_key_exists( $k, $o ) ? $o[ $k ] : null;
	}

	/** get(o, 'a.b'): the JS reduce (a falsy step value is returned as it is). */
	private static function get( $o, string $path ) {
		$a = $o;
		foreach ( explode( '.', $path ) as $k ) {
			if ( ! self::truthy( $a ) ) {
				return $a;
			}
			$a = self::at( $a, $k );
		}
		return $a;
	}

	private static function is_list( $v ): bool {
		return is_array( $v ) && ( array() === $v || array_keys( $v ) === range( 0, count( $v ) - 1 ) );
	}

	/** isObj(): a JSON object (an empty PHP array counts as one: JSON {} and [] decode alike). */
	private static function is_obj( $v ): bool {
		return is_array( $v ) && ( array() === $v || ! self::is_list( $v ) );
	}

	private static function one_of( $v, array $list, $d ) {
		return is_string( $v ) && in_array( $v, $list, true ) ? $v : $d;
	}

	private static function text( $v, int $max ): string {
		if ( ! is_string( $v ) ) {
			return '';
		}
		return mb_substr( (string) preg_replace( '/[<>\x00-\x1f]/', '', $v ), 0, $max );
	}

	private static function n_or_null( $v, float $a, float $b ): ?float {
		$n = self::num( $v, NAN );
		return is_finite( $n ) ? self::r2( self::clamp( $n, $a, $b ) ) : null;
	}

	/** Object.keys() order: array-index keys ascending first, then the others in insertion order. */
	private static function js_keys( array $o ): array {
		$ints = array();
		$strs = array();
		foreach ( array_keys( $o ) as $k ) {
			if ( is_int( $k ) && $k >= 0 && $k < 4294967295 ) {
				$ints[] = $k;
			} else {
				$strs[] = $k;
			}
		}
		sort( $ints );
		return array_merge( $ints, $strs );
	}

	/* ------------------------------------------------------------------ data model */

	/**
	 * Sanitises anything (user input, a saved project, an older version) into a valid build
	 * object – the port of normalize(). Empty or invalid input gives array() (nothing stored).
	 *
	 * @param mixed $raw Array, JSON string or object.
	 */
	public static function sanitize( $raw ): array {
		if ( is_string( $raw ) ) {
			$raw = json_decode( $raw, true );
		}
		if ( is_object( $raw ) || is_array( $raw ) ) {
			// one plain-array shape (stdClass from an earlier sanitize, invalid UTF-8 replaced)
			$raw = json_decode( (string) json_encode( $raw, JSON_INVALID_UTF8_SUBSTITUTE | JSON_PARTIAL_OUTPUT_ON_ERROR ), true );
		}
		if ( ! is_array( $raw ) || array() === $raw || ! self::is_obj( $raw ) ) {
			return array();
		}
		$o = self::normalize( $raw );
		// done / rules.custom are JSON objects whose keys may be "0", "1" …: keep them objects
		// (a PHP list would be encoded as a JSON array and the browser would drop it).
		$o['done']            = $o['done'] ? (object) $o['done'] : array();
		$o['rules']['custom'] = $o['rules']['custom'] ? (object) $o['rules']['custom'] : array();
		return $o;
	}

	private static function normalize( array $raw ): array {
		$df    = self::defaults();
		$m     = is_array( $df['model'] ?? null ) ? $df['model'] : array();
		$lim   = is_array( $df['limits'] ?? null ) ? $df['limits'] : array();
		$b     = self::is_obj( $raw ) ? $raw : array();
		$wd    = self::either( self::at( $m, 'wall' ), array() );
		$site  = self::is_obj( self::at( $b, 'site' ) ) ? $b['site'] : array();
		$rules = self::is_obj( self::at( $b, 'rules' ) ) ? $b['rules'] : array();
		$hz    = self::is_obj( self::at( $rules, 'hesz' ) ) ? $rules['hesz'] : array();
		$me    = self::either( self::at( $m, 'earth' ), array() );
		$mf    = self::either( self::at( $m, 'found' ), array() );
		$mdu   = self::either( self::at( $m, 'ducts' ), array() );
		$mg    = self::either( self::at( $m, 'ground' ), array() );
		$mr    = self::either( self::at( $m, 'ring' ), array() );
		$ms    = self::either( self::at( $m, 'slab' ), array() );
		$e     = self::is_obj( self::at( $b, 'earth' ) ) ? $b['earth'] : array();
		$fd    = self::is_obj( self::at( $b, 'found' ) ) ? $b['found'] : array();
		$du    = self::is_obj( self::at( $b, 'ducts' ) ) ? $b['ducts'] : array();
		$gr    = self::is_obj( self::at( $b, 'ground' ) ) ? $b['ground'] : array();
		$rg    = self::is_obj( self::at( $b, 'ring' ) ) ? $b['ring'] : array();
		$sl    = self::is_obj( self::at( $b, 'slab' ) ) ? $b['slab'] : array();
		$mats  = is_array( $df['walls'] ?? null ) ? $df['walls'] : array();
		$ins   = is_array( $df['insulations'] ?? null ) ? $df['insulations'] : array();
		$fnd   = array_map( 'strval', array_keys( is_array( $df['foundations'] ?? null ) ? $df['foundations'] : array() ) );
		$sls   = array_map( 'strval', array_keys( is_array( $df['slabs'] ?? null ) ? $df['slabs'] : array() ) );
		$lv_max = (int) self::either( self::at( $lim, 'levels_max' ), 3 );
		$soils  = self::either( self::at( $df, 'soils' ), array( 'clay' ) );
		$country = self::at( $site, 'country' );
		$region  = self::at( $site, 'region' );

		$o = array(
			'v'        => 1,
			'step'     => (int) self::clamp( self::js_round( self::num( self::at( $b, 'step' ), 0.0 ) ), 0, self::STEPS_N - 1 ),
			'done'     => array(),
			'site'     => array(
				'country' => is_string( $country ) && preg_match( '/^[a-z]{2}\z/', $country ) ? $country : 'hu',
				'region'  => is_string( $region ) && preg_match( '/^[a-z0-9_]{1,32}\z/', $region ) ? $region : '',
				'town'    => self::text( self::at( $site, 'town' ), 60 ),
				'frost'   => self::n_or_null( self::at( $site, 'frost' ), 0.3, 2.5 ),
				'soil'    => self::one_of( self::at( $site, 'soil' ), is_array( $soils ) ? $soils : array( 'clay' ), self::either( self::at( $me, 'soil' ), 'clay' ) ),
				'house'   => array(
					'x' => self::r2( self::clamp( self::num( self::get( $site, 'house.x' ), (float) self::either( self::get( $m, 'house.x' ), 4 ) ), 0, 500 ) ),
					'y' => self::r2( self::clamp( self::num( self::get( $site, 'house.y' ), (float) self::either( self::get( $m, 'house.y' ), 12 ) ), 0, 1000 ) ),
				),
			),
			'rules'    => array(
				'mode'   => self::one_of( self::at( $rules, 'mode' ), array( 'on', 'off', 'custom' ), 'on' ),
				'custom' => array(),
				'hesz'   => array(
					'coverage'  => self::n_or_null( self::at( $hz, 'coverage' ), 0, 100 ),
					'height'    => self::n_or_null( self::at( $hz, 'height' ), 0, 40 ),
					'front'     => self::n_or_null( self::at( $hz, 'front' ), 0, 100 ),
					'side'      => self::n_or_null( self::at( $hz, 'side' ), 0, 100 ),
					'back'      => self::n_or_null( self::at( $hz, 'back' ), 0, 200 ),
					'pitch_min' => self::n_or_null( self::at( $hz, 'pitch_min' ), 0, 75 ),
					'pitch_max' => self::n_or_null( self::at( $hz, 'pitch_max' ), 0, 75 ),
					'source'    => self::text( self::at( $hz, 'source' ), 160 ),
				),
			),
			'earth'    => array(
				'topsoil' => self::r2( self::clamp( self::num( self::at( $e, 'topsoil' ), (float) self::either( self::at( $me, 'topsoil' ), 0.3 ) ), 0, 1 ) ),
				'margin'  => self::r2( self::clamp( self::num( self::at( $e, 'margin' ), (float) self::either( self::at( $me, 'margin' ), 1 ) ), 0, 5 ) ),
			),
			'found'    => array(
				'type'       => self::one_of( self::at( $fd, 'type' ), $fnd ? $fnd : array( 'strip_rc' ), self::either( self::at( $mf, 'type' ), 'strip_rc' ) ),
				'w'          => self::r2( self::clamp( self::num( self::at( $fd, 'w' ), (float) self::either( self::at( $mf, 'w' ), 0.5 ) ), 0.2, 2 ) ),
				'd'          => self::r2( self::clamp( self::num( self::at( $fd, 'd' ), (float) self::either( self::at( $mf, 'd' ), 0.9 ) ), 0.3, 3 ) ),
				'top'        => self::r2( self::clamp( self::num( self::at( $fd, 'top' ), (float) self::either( self::at( $mf, 'top' ), 0.3 ) ), 0, 1.5 ) ),
				'partitions' => self::one_of( self::at( $fd, 'partitions' ), array( 'auto', 'strip', 'none' ), self::either( self::at( $mf, 'partitions' ), 'auto' ) ),
			),
			'ducts'    => array(
				'sewer'    => array_key_exists( 'sewer', $du ) ? self::truthy( $du['sewer'] ) : false !== self::at( $mdu, 'sewer' ),
				'water'    => array_key_exists( 'water', $du ) ? self::truthy( $du['water'] ) : false !== self::at( $mdu, 'water' ),
				'earth'    => array_key_exists( 'earth', $du ) ? self::truthy( $du['earth'] ) : false !== self::at( $mdu, 'earth' ),
				'conduits' => (int) self::clamp( self::js_round( self::num( self::at( $du, 'conduits' ), (float) self::either( self::at( $mdu, 'conduits' ), 0 ) ) ), 0, 30 ),
			),
			'ground'   => array(
				'fill'     => self::r2( self::clamp( self::num( self::at( $gr, 'fill' ), (float) self::either( self::at( $mg, 'fill' ), 0.2 ) ), 0, 1 ) ),
				'concrete' => self::r2( self::clamp( self::num( self::at( $gr, 'concrete' ), (float) self::either( self::at( $mg, 'concrete' ), 0.1 ) ), 0, 0.4 ) ),
				'membrane' => self::one_of( self::at( $gr, 'membrane' ), array( 'bitumen', 'pvc', 'none' ), self::either( self::at( $mg, 'membrane' ), 'bitumen' ) ),
				'xps'      => self::r2( self::clamp( self::num( self::at( $gr, 'xps' ), (float) self::either( self::at( $mg, 'xps' ), 0.1 ) ), 0, 0.3 ) ),
			),
			'levels'   => array(),
			'attic'    => self::truthy( self::at( $b, 'attic' ) ),
			'ring'     => array(
				'h'     => self::r2( self::clamp( self::num( self::at( $rg, 'h' ), (float) self::either( self::at( $mr, 'h' ), 0.25 ) ), 0.15, 0.6 ) ),
				'insul' => self::r2( self::clamp( self::num( self::at( $rg, 'insul' ), (float) self::either( self::at( $mr, 'insul' ), 0.05 ) ), 0, 0.15 ) ),
			),
			'slab'     => array(
				'type'  => self::one_of( self::at( $sl, 'type' ), $sls ? $sls : array( 'rc' ), self::either( self::at( $ms, 'type' ), 'rc' ) ),
				't'     => self::r2( self::clamp( self::num( self::at( $sl, 't' ), (float) self::either( self::at( $ms, 't' ), 0.2 ) ), 0.1, 0.4 ) ),
				'stair' => null,
			),
			'walls'    => array(),
			'openings' => array(),
			'rooms'    => array(),
			'services' => array(),
			'surfaces' => array(),
			'guessed'  => array(),
		);
		if ( $o['ring']['h'] < $o['slab']['t'] ) {
			$o['ring']['h'] = $o['slab']['t'];
		}
		$level_h = self::either( self::at( $m, 'level_h' ), 3 );
		$levels  = self::at( $b, 'levels' );
		foreach ( array_slice( self::is_list( $levels ) ? $levels : array(), 0, $lv_max ) as $lv ) {
			$o['levels'][] = array( 'h' => self::r2( self::clamp( self::num( self::is_obj( $lv ) ? self::at( $lv, 'h' ) : $lv, (float) $level_h ), (float) self::either( self::at( $lim, 'level_h_min' ), 2.4 ), (float) self::either( self::at( $lim, 'level_h_max' ), 4.5 ) ) ) );
		}
		if ( ! $o['levels'] ) {
			$o['levels'][] = array( 'h' => $level_h );
		}
		$st = self::at( $sl, 'stair' );
		if ( self::is_obj( $st ) && array() !== $st ) {
			$o['slab']['stair'] = array(
				'x' => self::r2( self::num( self::at( $st, 'x' ), 0.0 ) ),
				'y' => self::r2( self::num( self::at( $st, 'y' ), 0.0 ) ),
				'w' => self::r2( self::clamp( self::num( self::at( $st, 'w' ), 1.0 ), 0.6, 6 ) ),
				'd' => self::r2( self::clamp( self::num( self::at( $st, 'd' ), 3.0 ), 0.6, 8 ) ),
			);
		}
		// done: also accepted as a list (an object with keys "0", "1" … decoded by PHP)
		$done = self::at( $b, 'done' );
		if ( is_array( $done ) ) {
			foreach ( self::js_keys( $done ) as $k ) {
				$ks = (string) $k;
				if ( preg_match( '/^\d{1,2}\z/', $ks ) && (int) $ks < self::STEPS_N && is_string( $done[ $k ] ) ) {
					$o['done'][ $ks ] = mb_substr( $done[ $k ], 0, 40 );
				}
			}
		}
		$custom = self::at( $rules, 'custom' );
		if ( is_array( $custom ) ) {
			foreach ( array_slice( self::js_keys( $custom ), 0, 80 ) as $k ) {
				$ks = (string) $k;
				$cv = $custom[ $k ];
				if ( ! preg_match( '/^[a-z0-9_]{1,48}\z/', $ks ) || ! self::is_obj( $cv ) ) {
					continue;
				}
				$o['rules']['custom'][ $ks ] = array(
					'on'    => false !== self::at( $cv, 'on' ),
					'value' => self::n_or_null( self::at( $cv, 'value' ), -1000, 100000 ),
				);
			}
		}

		$ids = array();
		$seq = 0;
		$uid = static function ( string $p, $v ) use ( &$ids, &$seq ): string {
			$id = is_string( $v ) && preg_match( '/^[a-z]\d{1,5}\z/', $v ) && ! isset( $ids[ $v ] ) ? $v : '';
			while ( '' === $id || isset( $ids[ $id ] ) ) {
				$id = $p . ( ++$seq );
			}
			$ids[ $id ] = 1;
			return $id;
		};
		$t_min = (float) self::either( self::at( $lim, 'wall_t_min' ), 0.05 );
		$t_max = (float) self::either( self::at( $lim, 'wall_t_max' ), 0.8 );
		$walls = self::at( $b, 'walls' );
		foreach ( array_slice( self::is_list( $walls ) ? $walls : array(), 0, (int) self::either( self::at( $lim, 'walls_max' ), 240 ) ) as $w ) {
			if ( ! self::is_obj( $w ) || ! self::is_list( self::at( $w, 'a' ) ) || ! self::is_list( self::at( $w, 'b' ) ) ) {
				continue;
			}
			$a  = array( self::r2( self::clamp( self::num( self::at( $w['a'], 0 ), 0.0 ), -50, 550 ) ), self::r2( self::clamp( self::num( self::at( $w['a'], 1 ), 0.0 ), -50, 1050 ) ) );
			$bb = array( self::r2( self::clamp( self::num( self::at( $w['b'], 0 ), 0.0 ), -50, 550 ) ), self::r2( self::clamp( self::num( self::at( $w['b'], 1 ), 0.0 ), -50, 1050 ) ) );
			if ( self::c( $a[0] ) === self::c( $bb[0] ) && self::c( $a[1] ) === self::c( $bb[1] ) ) {
				continue;
			}
			$kind = self::one_of( self::at( $w, 'kind' ), self::KINDS, 'ext' );
			$dk   = self::either( self::at( $wd, $kind ), array() );
			$wm   = self::at( $w, 'mat' );
			$mat  = is_string( $wm ) && isset( $mats[ $wm ] ) && in_array( $kind, (array) self::either( self::at( $mats[ $wm ], 'kinds' ), array() ), true ) ? $wm : self::either( self::at( $dk, 'mat' ), self::either( array_key_first( $mats ), 'ceramic' ) );
			$wall = array(
				'id'   => $uid( 'w', self::at( $w, 'id' ) ),
				'lv'   => 'ext' === $kind ? 0 : (int) self::clamp( self::js_round( self::num( self::at( $w, 'lv' ), 0.0 ) ), 0, $lv_max - 1 ),
				'a'    => $a,
				'b'    => $bb,
				't'    => self::r2( self::clamp( self::num( self::at( $w, 't' ), (float) self::either( self::at( $dk, 't' ), 0.3 ) ), $t_min, $t_max ) ),
				'kind' => $kind,
				'mat'  => (string) $mat,
			);
			if ( 'ext' === $kind ) {
				$wi              = self::at( $w, 'insul' );
				$wall['insul']   = is_string( $wi ) && isset( $ins[ $wi ] ) ? $wi : (string) self::either( self::at( $dk, 'insul' ), 'none' );
				$wall['insul_t'] = 'none' === $wall['insul'] ? 0 : self::r2( self::clamp( self::num( self::at( $w, 'insul_t' ), (float) self::either( self::at( $dk, 'insul_t' ), 0.1 ) ), 0, 0.4 ) );
			}
			$o['walls'][] = $wall;
		}
		$wall_ids = array();
		foreach ( $o['walls'] as $w ) {
			$wall_ids[ $w['id'] ] = $w;
		}
		$m_open = self::either( self::at( $m, 'opening' ), array() );
		$ops    = self::at( $b, 'openings' );
		foreach ( array_slice( self::is_list( $ops ) ? $ops : array(), 0, (int) self::either( self::at( $lim, 'openings_max' ), 240 ) ) as $op ) {
			$ow = self::at( $op, 'wall' );
			if ( ! self::is_obj( $op ) || ! is_string( $ow ) || ! isset( $wall_ids[ $ow ] ) ) {
				continue;
			}
			$w    = $wall_ids[ $ow ];
			$type = self::one_of( self::at( $op, 'type' ), self::OPENING_TYPES, 'window' );
			$dop  = self::either( self::at( $m_open, $type ), array() );
			$lv   = 'ext' === $w['kind'] ? (int) self::clamp( self::js_round( self::num( self::at( $op, 'lv' ), 0.0 ) ), 0, count( $o['levels'] ) - 1 ) : $w['lv'];
			$o['openings'][] = array(
				'id'     => $uid( 'o', self::at( $op, 'id' ) ),
				'wall'   => $w['id'],
				'lv'     => $lv,
				'type'   => $type,
				'at'     => self::r2( self::clamp( self::num( self::at( $op, 'at' ), 0.0 ), -5, 200 ) ),
				'w'      => self::r2( self::clamp( self::num( self::at( $op, 'w' ), (float) self::either( self::at( $dop, 'w' ), 1 ) ), 0.3, 8 ) ),
				'h'      => self::r2( self::clamp( self::num( self::at( $op, 'h' ), (float) self::either( self::at( $dop, 'h' ), 1.5 ) ), 0.3, 4 ) ),
				'sill'   => 'window' === $type ? self::r2( self::clamp( self::num( self::at( $op, 'sill' ), (float) self::either( self::at( $dop, 'sill' ), 0.9 ) ), 0, 3 ) ) : 0,
				'lintel' => self::one_of( self::at( $op, 'lintel' ), self::LINTELS, 'auto' ),
			);
		}
		$rooms = self::at( $b, 'rooms' );
		if ( self::is_obj( $rooms ) ) {
			foreach ( array_slice( self::js_keys( $rooms ), 0, 120 ) as $k ) {
				$ks = (string) $k;
				if ( preg_match( '/^\d:-?\d{1,6},-?\d{1,6}\z/', $ks ) && is_string( $rooms[ $k ] ) && preg_match( '/^[a-z_]{1,32}\z/', $rooms[ $k ] ) ) {
					$o['rooms'][ $ks ] = $rooms[ $k ];
				}
			}
		}
		$guessed = self::at( $b, 'guessed' );
		if ( self::is_list( $guessed ) ) {
			$o['guessed'] = array_slice( array_values( array_filter( $guessed, static fn( $g ) => is_string( $g ) && preg_match( '/^[a-z_.]{1,32}\z/', $g ) ) ), 0, 20 );
		}
		// prepared for 1.14.1 (services) and 1.14.2 (surfaces): kept as given, size-limited
		foreach ( array( 'services', 'surfaces' ) as $k ) {
			$list = self::at( $b, $k );
			if ( self::is_list( $list ) ) {
				$o[ $k ] = array_slice( array_values( array_filter( $list, array( __CLASS__, 'is_obj' ) ) ), 0, 200 );
			}
		}
		return $o;
	}
}
