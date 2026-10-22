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
				return null;
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
		// done, rules.custom and rooms are JSON objects (keys "0", "1" … included): keep them objects,
		// so the stored JSON is exactly what the browser's normalize() gives ({} and not []).
		$o['done']            = (object) $o['done'];
		$o['rules']['custom'] = (object) $o['rules']['custom'];
		$o['rooms']           = (object) $o['rooms'];
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
			'prog'     => array(),
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
		if ( self::is_obj( $st ) ) {
			$o['slab']['stair'] = array(
				'x' => self::r2( self::num( self::at( $st, 'x' ), 0.0 ) ),
				'y' => self::r2( self::num( self::at( $st, 'y' ), 0.0 ) ),
				'w' => self::r2( self::clamp( self::num( self::at( $st, 'w' ), 1.0 ), 0.6, 6 ) ),
				'd' => self::r2( self::clamp( self::num( self::at( $st, 'd' ), 3.0 ), 0.6, 8 ) ),
			);
			// 1.21.0: a designed stair (port of the JS normalize)
			$stype = self::at( $st, 'type' );
			if ( is_string( $stype ) && in_array( $stype, array( 'straight', 'l', 'u', 'spiral' ), true ) ) {
				$rot                             = self::js_round( (float) self::num( self::at( $st, 'rot' ), 0.0 ) );
				$o['slab']['stair']['type']  = $stype;
				$o['slab']['stair']['width'] = self::r2( self::clamp( self::num( self::at( $st, 'width' ), 1.0 ), 0.6, 2 ) );
				$o['slab']['stair']['rot']   = in_array( (int) $rot, array( 0, 90, 180, 270 ), true ) ? (int) $rot : 0;
			}
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
				$o[ $k ] = array_map( static fn( $x ) => array() === $x ? new \stdClass() : $x, array_slice( array_values( array_filter( $list, array( __CLASS__, 'is_obj' ) ) ), 0, 200 ) );
			}
		}
		// 1.20.0: the room programme (port of the JS normalize)
		$prog = self::at( $b, 'prog' );
		if ( self::is_list( $prog ) ) {
			foreach ( array_slice( $prog, 0, 60 ) as $r ) {
				if ( ! self::is_obj( $r ) ) {
					continue;
				}
				$w    = self::r2( self::clamp( self::num( self::at( $r, 'w' ), 3.0 ), 0.8, 30 ) );
				$d    = self::r2( self::clamp( self::num( self::at( $r, 'd' ), 3.0 ), 0.8, 30 ) );
				$type = self::at( $r, 'type' );
				$o['prog'][] = array(
					'id'     => $uid( 'r', self::at( $r, 'id' ) ),
					'type'   => is_string( $type ) && preg_match( '/^[a-z_]{1,32}\z/', $type ) ? $type : 'other',
					'name'   => self::text( self::at( $r, 'name' ), 40 ),
					'area'   => self::r2( self::clamp( self::num( self::at( $r, 'area' ), $w * $d ), 1, 500 ) ),
					'w'      => $w,
					'd'      => $d,
					'x'      => self::r2( self::clamp( self::num( self::at( $r, 'x' ), 0.0 ), -50, 550 ) ),
					'y'      => self::r2( self::clamp( self::num( self::at( $r, 'y' ), 0.0 ), -50, 1050 ) ),
					'lv'     => (int) self::clamp( self::js_round( self::num( self::at( $r, 'lv' ), 0.0 ) ), 0, count( $o['levels'] ) - 1 ),
					'placed' => true === self::at( $r, 'placed' ),
				);
			}
		}
		return $o;
	}

	/* ------------------------------------------------------------------ geometry (integer millimetres) */

	/** Map key of a point (whole millimetres, "x,y" like the JS string). */
	private static function pk( float $x, float $y ): string {
		return (int) $x . ',' . (int) $y;
	}

	private static function seg( array $w ): array {
		return array( 'id' => $w['id'], 'ax' => self::c( (float) $w['a'][0] ), 'ay' => self::c( (float) $w['a'][1] ), 'bx' => self::c( (float) $w['b'][0] ), 'by' => self::c( (float) $w['b'][1] ), 't' => self::c( (float) $w['t'] ) );
	}

	private static function len_c( array $s ): float {
		return sqrt( ( $s['bx'] - $s['ax'] ) * ( $s['bx'] - $s['ax'] ) + ( $s['by'] - $s['ay'] ) * ( $s['by'] - $s['ay'] ) );
	}

	/** Parameter u of point p on segment s (0..1), or -1 when p is not on the segment line. */
	private static function on_seg( array $s, float $px, float $py ): float {
		$dx = $s['bx'] - $s['ax'];
		$dy = $s['by'] - $s['ay'];
		$l2 = $dx * $dx + $dy * $dy;
		if ( 0.0 == $l2 || 0.0 != ( $px - $s['ax'] ) * $dy - ( $py - $s['ay'] ) * $dx ) {
			return -1.0;
		}
		$u = ( ( $px - $s['ax'] ) * $dx + ( $py - $s['ay'] ) * $dy ) / $l2;
		return $u >= 0 && $u <= 1 ? $u : -1.0;
	}

	/** Proper crossing of two non-parallel segments (inside both, not at an end): [u on s, x, y]. */
	private static function crossing( array $s, array $o ): ?array {
		$d1x = $s['bx'] - $s['ax'];
		$d1y = $s['by'] - $s['ay'];
		$d2x = $o['bx'] - $o['ax'];
		$d2y = $o['by'] - $o['ay'];
		$den = $d1x * $d2y - $d1y * $d2x;
		if ( 0.0 == $den ) {
			return null;
		}
		$u = ( ( $o['ax'] - $s['ax'] ) * $d2y - ( $o['ay'] - $s['ay'] ) * $d2x ) / $den;
		$v = ( ( $o['ax'] - $s['ax'] ) * $d1y - ( $o['ay'] - $s['ay'] ) * $d1x ) / $den;
		if ( $u <= 1e-9 || $u >= 1 - 1e-9 || $v <= 1e-9 || $v >= 1 - 1e-9 ) {
			return null;
		}
		return array( $u, self::js_round( $s['ax'] + $d1x * $u ), self::js_round( $s['ay'] + $d1y * $u ) );
	}

	/** Splits the walls at every junction (T, X) into graph edges; duplicate edges collapse (thicker wins). */
	private static function edges_of( array $walls ): array {
		$segs = array();
		foreach ( $walls as $w ) {
			$s = self::seg( $w );
			if ( $s['ax'] != $s['bx'] || $s['ay'] != $s['by'] ) {
				$segs[] = $s;
			}
		}
		$out  = array();
		$seen = array();
		foreach ( $segs as $i => $s ) {
			$pts = array( array( 0.0, $s['ax'], $s['ay'] ), array( 1.0, $s['bx'], $s['by'] ) );
			foreach ( $segs as $j => $o ) {
				if ( $i === $j ) {
					continue;
				}
				foreach ( array( array( $o['ax'], $o['ay'] ), array( $o['bx'], $o['by'] ) ) as $p ) {
					$u = self::on_seg( $s, $p[0], $p[1] );
					if ( $u > 0 && $u < 1 ) {
						$pts[] = array( $u, $p[0], $p[1] );
					}
				}
				$x = self::crossing( $s, $o );
				if ( $x ) {
					$pts[] = $x;
				}
			}
			usort( $pts, static fn( $a, $b ) => $a[0] <=> $b[0] );
			for ( $k = 1, $n = count( $pts ); $k < $n; $k++ ) {
				$p0 = $pts[ $k - 1 ];
				$p1 = $pts[ $k ];
				if ( $p0[1] == $p1[1] && $p0[2] == $p1[2] ) {
					continue;
				}
				$key = $p0[1] < $p1[1] || ( $p0[1] == $p1[1] && $p0[2] < $p1[2] ) ? self::pk( $p0[1], $p0[2] ) . ',' . self::pk( $p1[1], $p1[2] ) : self::pk( $p1[1], $p1[2] ) . ',' . self::pk( $p0[1], $p0[2] );
				if ( isset( $seen[ $key ] ) ) {
					$e0 = $seen[ $key ];
					if ( $s['t'] > $out[ $e0 ]['t'] ) {
						$out[ $e0 ]['t'] = $s['t'];
						$out[ $e0 ]['w'] = $s['id'];
					}
					continue;
				}
				$seen[ $key ] = count( $out );
				$out[]        = array( 'w' => $s['id'], 't' => $s['t'], 'x0' => $p0[1], 'y0' => $p0[2], 'x1' => $p1[1], 'y1' => $p1[2] );
			}
		}
		return $out;
	}

	private static function area2( array $p ): float {
		$a = 0.0;
		for ( $i = 0, $n = count( $p ); $i < $n; $i++ ) {
			$q  = $p[ ( $i + 1 ) % $n ];
			$a += $p[ $i ][0] * $q[1] - $q[0] * $p[ $i ][1];
		}
		return $a;
	}

	/**
	 * Faces of the planar wall graph: [poly, ts (edge thicknesses), a2]. Interior faces have a positive
	 * (doubled) area. Same order as the JS: nodes in string order of their "x,y" keys.
	 */
	private static function faces( array $edges ): array {
		$adj = array();
		$xy  = array();
		foreach ( $edges as $e ) {
			$k0 = self::pk( $e['x0'], $e['y0'] );
			$k1 = self::pk( $e['x1'], $e['y1'] );
			$adj[ $k0 ][] = array( 'to' => $k1, 'a' => atan2( $e['y1'] - $e['y0'], $e['x1'] - $e['x0'] ), 't' => $e['t'] );
			$xy[ $k0 ]    = array( $e['x0'], $e['y0'] );
			$adj[ $k1 ][] = array( 'to' => $k0, 'a' => atan2( $e['y0'] - $e['y1'], $e['x0'] - $e['x1'] ), 't' => $e['t'] );
			$xy[ $k1 ]    = array( $e['x1'], $e['y1'] );
		}
		foreach ( $adj as $k => $lst ) {
			usort( $lst, static fn( $p, $q ) => $p['a'] <=> $q['a'] );
			$adj[ $k ] = $lst;
		}
		$keys = array_map( 'strval', array_keys( $adj ) );
		sort( $keys, SORT_STRING );
		$seen = array();
		$res  = array();
		foreach ( $keys as $k0 ) {
			foreach ( $adj[ $k0 ] as $j0 => $h0 ) {
				if ( isset( $seen[ $k0 . '>' . $h0['to'] ] ) ) {
					continue;
				}
				$poly  = array();
				$ts    = array();
				$u     = $k0;
				$hi    = $j0;
				$guard = 0;
				do {
					$h = $adj[ $u ][ $hi ];
					$seen[ $u . '>' . $h['to'] ] = 1;
					$poly[] = $xy[ $u ];
					$ts[]   = $h['t'];
					$v      = $h['to'];
					$lst    = $adj[ $v ];
					$idx    = 0;
					foreach ( $lst as $i => $x ) {
						if ( $x['to'] === $u ) {
							$idx = $i;
							break;
						}
					}
					$u  = $v;
					$hi = ( $idx - 1 + count( $lst ) ) % count( $lst );
				} while ( ! ( $u === $k0 && $hi === $j0 ) && ++$guard < 20000 );
				$res[] = array( 'poly' => $poly, 'ts' => $ts, 'a2' => self::area2( $poly ) );
			}
		}
		return $res;
	}

	/** Removes spikes (A,B,A) and repeated points; returns [points, thicknesses]. */
	private static function clean( array $p, array $e ): array {
		$changed = true;
		while ( $changed && count( $p ) > 2 ) {
			$changed = false;
			for ( $i = 0; $i < count( $p ); $i++ ) {
				$n = count( $p );
				$a = $p[ ( $i - 1 + $n ) % $n ];
				$c = $p[ ( $i + 1 ) % $n ];
				if ( $a[0] == $c[0] && $a[1] == $c[1] ) { // spike at i: drop i and the next point
					$j  = ( $i + 1 ) % $n;
					$rm = array( $i, $j );
					rsort( $rm );
					foreach ( $rm as $r ) {
						array_splice( $p, $r, 1 );
						array_splice( $e, $r, 1 );
					}
					$changed = true;
					break;
				}
			}
		}
		return array( $p, $e );
	}

	/** Merges collinear neighbours; edge thickness = the larger one. */
	private static function merge( array $pts, array $t ): array {
		$changed = true;
		while ( $changed && count( $pts ) > 3 ) {
			$changed = false;
			for ( $i = 0; $i < count( $pts ); $i++ ) {
				$n = count( $pts );
				$a = $pts[ ( $i - 1 + $n ) % $n ];
				$b = $pts[ $i ];
				$c = $pts[ ( $i + 1 ) % $n ];
				if ( 0.0 == ( $b[0] - $a[0] ) * ( $c[1] - $b[1] ) - ( $b[1] - $a[1] ) * ( $c[0] - $b[0] ) && ( $b[0] - $a[0] ) * ( $c[0] - $b[0] ) + ( $b[1] - $a[1] ) * ( $c[1] - $b[1] ) > 0 ) {
					$ip       = ( $i - 1 + $n ) % $n;
					$t[ $ip ] = max( $t[ $ip ], $t[ $i ] );
					array_splice( $pts, $i, 1 );
					array_splice( $t, $i, 1 );
					$changed = true;
					break;
				}
			}
		}
		return array( $pts, $t );
	}

	/** Offsets every edge of a positive polygon by d[i] mm towards the inside (negative = outwards). */
	private static function offset( array $p, array $d ): array {
		$n     = count( $p );
		$lines = array();
		$out   = array();
		for ( $i = 0; $i < $n; $i++ ) {
			$a  = $p[ $i ];
			$b  = $p[ ( $i + 1 ) % $n ];
			$dx = $b[0] - $a[0];
			$dy = $b[1] - $a[1];
			$l  = sqrt( $dx * $dx + $dy * $dy );
			$l  = 0.0 == $l ? 1.0 : $l;
			$nx = -$dy / $l; // left normal = inside for a positive polygon
			$ny = $dx / $l;
			$lines[] = array( 'x' => $a[0] + $nx * $d[ $i ], 'y' => $a[1] + $ny * $d[ $i ], 'dx' => $dx, 'dy' => $dy );
		}
		for ( $k = 0; $k < $n; $k++ ) {
			$l0  = $lines[ ( $k - 1 + $n ) % $n ];
			$l1  = $lines[ $k ];
			$den = $l0['dx'] * $l1['dy'] - $l0['dy'] * $l1['dx'];
			if ( abs( $den ) < 1e-9 ) {
				$out[] = array( self::js_round( $l1['x'] ), self::js_round( $l1['y'] ) );
				continue;
			}
			$s     = ( ( $l1['x'] - $l0['x'] ) * $l1['dy'] - ( $l1['y'] - $l0['y'] ) * $l1['dx'] ) / $den;
			$out[] = array( self::js_round( $l0['x'] + $l0['dx'] * $s ), self::js_round( $l0['y'] + $l0['dy'] * $s ) );
		}
		return $out;
	}

	private static function in_poly( array $p, float $x, float $y ): bool {
		$c = false;
		$n = count( $p );
		for ( $i = 0, $j = $n - 1; $i < $n; $j = $i++ ) {
			if ( ( ( $p[ $i ][1] > $y ) !== ( $p[ $j ][1] > $y ) ) && ( $x < ( $p[ $j ][0] - $p[ $i ][0] ) * ( $y - $p[ $i ][1] ) / ( $p[ $j ][1] - $p[ $i ][1] ) + $p[ $i ][0] ) ) {
				$c = ! $c;
			}
		}
		return $c;
	}

	private static function on_boundary( array $p, float $x, float $y ): bool {
		for ( $i = 0, $n = count( $p ); $i < $n; $i++ ) {
			$q = $p[ ( $i + 1 ) % $n ];
			if ( self::on_seg( array( 'ax' => $p[ $i ][0], 'ay' => $p[ $i ][1], 'bx' => $q[0], 'by' => $q[1] ), $x, $y ) >= 0 ) {
				return true;
			}
		}
		return false;
	}

	private static function orthogonal( array $p ): bool {
		for ( $i = 0, $n = count( $p ); $i < $n; $i++ ) {
			$q = $p[ ( $i + 1 ) % $n ];
			if ( $p[ $i ][0] != $q[0] && $p[ $i ][1] != $q[1] ) {
				return false;
			}
		}
		return true;
	}

	/** Distinct values in first-seen order, then sorted numerically. */
	private static function grid( array $vals ): array {
		$out = array();
		foreach ( $vals as $v ) {
			if ( ! in_array( $v, $out, false ) ) {
				$out[] = $v;
			}
		}
		sort( $out, SORT_NUMERIC );
		return $out;
	}

	/**
	 * Splits an orthogonal polygon into rectangles: repeatedly the largest free rectangle of the
	 * vertex grid (ties: the first in x, then y order).
	 */
	private static function decompose( array $p ): array {
		$xs  = self::grid( array_map( static fn( $q ) => $q[0], $p ) );
		$ys  = self::grid( array_map( static fn( $q ) => $q[1], $p ) );
		$nx  = count( $xs ) - 1;
		$ny  = count( $ys ) - 1;
		$free = array();
		$out  = array();
		for ( $i = 0; $i < $nx; $i++ ) {
			for ( $j = 0; $j < $ny; $j++ ) {
				$free[ $i ][ $j ] = self::in_poly( $p, ( $xs[ $i ] + $xs[ $i + 1 ] ) / 2, ( $ys[ $j ] + $ys[ $j + 1 ] ) / 2 ) ? 1 : 0;
			}
		}
		for ( $guard = 0; $guard < 64; $guard++ ) {
			$sum = array();
			for ( $i = 0; $i <= $nx; $i++ ) {
				for ( $j = 0; $j <= $ny; $j++ ) {
					$sum[ $i ][ $j ] = $i && $j ? $free[ $i - 1 ][ $j - 1 ] + $sum[ $i - 1 ][ $j ] + $sum[ $i ][ $j - 1 ] - $sum[ $i - 1 ][ $j - 1 ] : 0;
				}
			}
			$best   = null;
			$best_a = 0.0;
			for ( $i0 = 0; $i0 < $nx; $i0++ ) {
				for ( $j0 = 0; $j0 < $ny; $j0++ ) {
					if ( ! $free[ $i0 ][ $j0 ] ) {
						continue;
					}
					for ( $i1 = $i0; $i1 < $nx; $i1++ ) {
						if ( ! $free[ $i1 ][ $j0 ] ) {
							break;
						}
						for ( $j1 = $j0; $j1 < $ny; $j1++ ) {
							$cnt = $sum[ $i1 + 1 ][ $j1 + 1 ] - $sum[ $i0 ][ $j1 + 1 ] - $sum[ $i1 + 1 ][ $j0 ] + $sum[ $i0 ][ $j0 ];
							if ( $cnt !== ( $i1 - $i0 + 1 ) * ( $j1 - $j0 + 1 ) ) {
								break;
							}
							$a = ( $xs[ $i1 + 1 ] - $xs[ $i0 ] ) * ( $ys[ $j1 + 1 ] - $ys[ $j0 ] );
							if ( $a > $best_a ) {
								$best_a = $a;
								$best   = array( $i0, $j0, $i1, $j1 );
							}
						}
					}
				}
			}
			if ( ! $best ) {
				break;
			}
			$out[] = array( 'x0' => $xs[ $best[0] ], 'y0' => $ys[ $best[1] ], 'x1' => $xs[ $best[2] + 1 ], 'y1' => $ys[ $best[3] + 1 ] );
			for ( $i = $best[0]; $i <= $best[2]; $i++ ) {
				for ( $j = $best[1]; $j <= $best[3]; $j++ ) {
					$free[ $i ][ $j ] = 0;
				}
			}
		}
		return $out;
	}

	/**
	 * Strip split of an orthogonal polygon: columns between the vertex x values (dir 'x') or rows
	 * between the y values (dir 'y'); neighbouring strips with the same runs merge. Largest first.
	 */
	private static function strips( array $p, string $dir ): array {
		$tr   = 'y' === $dir;
		$q    = $tr ? array_map( static fn( $v ) => array( $v[1], $v[0] ), $p ) : $p;
		$xs   = self::grid( array_map( static fn( $v ) => $v[0], $q ) );
		$ys   = self::grid( array_map( static fn( $v ) => $v[1], $q ) );
		$cols = array();
		$out  = array();
		$ny   = count( $ys );
		for ( $i = 0, $nx = count( $xs ) - 1; $i < $nx; $i++ ) {
			$runs = array();
			$j0   = -1;
			for ( $j = 0; $j <= $ny - 1; $j++ ) {
				$inside = $j < $ny - 1 && self::in_poly( $q, ( $xs[ $i ] + $xs[ $i + 1 ] ) / 2, ( $ys[ $j ] + $ys[ $j + 1 ] ) / 2 );
				if ( $inside && $j0 < 0 ) {
					$j0 = $j;
				}
				if ( ! $inside && $j0 >= 0 ) {
					$runs[] = array( $ys[ $j0 ], $ys[ $j ] );
					$j0     = -1;
				}
			}
			$last = count( $cols ) - 1;
			if ( $last >= 0 && $cols[ $last ]['runs'] == $runs && $cols[ $last ]['x1'] == $xs[ $i ] ) {
				$cols[ $last ]['x1'] = $xs[ $i + 1 ];
			} else {
				$cols[] = array( 'runs' => $runs, 'x0' => $xs[ $i ], 'x1' => $xs[ $i + 1 ] );
			}
		}
		foreach ( $cols as $c ) {
			foreach ( $c['runs'] as $r ) {
				$out[] = $tr ? array( 'x0' => $r[0], 'x1' => $r[1], 'y0' => $c['x0'], 'y1' => $c['x1'] ) : array( 'x0' => $c['x0'], 'x1' => $c['x1'], 'y0' => $r[0], 'y1' => $r[1] );
			}
		}
		usort(
			$out,
			static function ( $a, $b ) {
				$d = ( $b['x1'] - $b['x0'] ) * ( $b['y1'] - $b['y0'] ) - ( $a['x1'] - $a['x0'] ) * ( $a['y1'] - $a['y0'] );
				if ( 0.0 != $d ) {
					return $d <=> 0;
				}
				$d = $a['x0'] - $b['x0'];
				if ( 0.0 != $d ) {
					return $d <=> 0;
				}
				return ( $a['y0'] - $b['y0'] ) <=> 0;
			}
		);
		return $out;
	}

	private static function bbox_of( array $p ): array {
		$x0 = INF;
		$y0 = INF;
		$x1 = -INF;
		$y1 = -INF;
		foreach ( $p as $q ) {
			$x0 = min( $x0, $q[0] );
			$y0 = min( $y0, $q[1] );
			$x1 = max( $x1, $q[0] );
			$y1 = max( $y1, $q[1] );
		}
		return array( 'x0' => $x0, 'y0' => $y0, 'x1' => $x1, 'y1' => $y1 );
	}

	/* ------------------------------------------------------------------ room layout rules (1.25.0) */

	/**
	 * The layout rules of the room programme on one level (port of layoutRules() / layoutCtx() /
	 * layoutEval() in agh-build.js): { rules: [{id, w, ok}], n, pass, w, pw, pct, score } with ok
	 * true / false / null (does not apply), or null when the outline is not closed. Good practice
	 * (defaults.programme.layout, verified: false): it warns, never blocks.
	 *
	 * @param mixed  $raw         The build.
	 * @param int    $lv          Level.
	 * @param string $orientation The plot's orientation (garden side), e.g. 'south'.
	 */
	public static function layout( $raw, int $lv = 0, string $orientation = 'south' ): ?array {
		$b = self::sanitize( $raw );
		if ( ! $b ) {
			return null;
		}
		$b   = json_decode( (string) json_encode( $b ), true );
		$ctx = self::layout_ctx( $b, $lv, $orientation );
		return null === $ctx ? null : self::layout_eval( $b['prog'], $ctx );
	}

	private static function layout_cfg(): array {
		$p = self::at( self::defaults(), 'programme' );
		$l = self::at( $p, 'layout' );
		$d = self::at( $l, 'garden_dir' );
		$r = self::at( $l, 'rules' );
		return array(
			'rules' => self::is_list( $r ) ? $r : array(),
			'gap'   => self::num( self::at( $l, 'adj_gap' ), 0.6 ),
			'lap'   => self::num( self::at( $l, 'adj_overlap' ), 0.8 ),
			'near'  => self::num( self::at( $l, 'entry_near' ), 3.0 ),
			'dirs'  => self::is_obj( $d ) ? $d : array(),
			'p'     => self::num( self::at( $p, 'plaster' ), 0.015 ),
		);
	}

	private static function layout_ctx( array $b, int $lv, string $orientation ): ?array {
		$ol = self::outline_of( $b );
		if ( ! $ol['closed'] ) {
			return null;
		}
		$l  = self::layout_cfg();
		$g  = self::at( $l['dirs'], $orientation );
		$g  = is_array( $g ) ? $g : ( is_array( self::at( $l['dirs'], 'south' ) ) ? $l['dirs']['south'] : array( 0, -1 ) );
		$gx = self::num( self::at( $g, 0 ), 0.0 );
		$gy = self::num( self::at( $g, 1 ), -1.0 );
		$p  = $ol['inner'];
		$n  = count( $p );
		$a2 = 0.0;
		$cx = 0.0;
		$cy = 0.0;
		for ( $i = 0; $i < $n; $i++ ) {
			$q   = $p[ ( $i + 1 ) % $n ];
			$cr  = $p[ $i ][0] * $q[1] - $q[0] * $p[ $i ][1];
			$a2 += $cr;
			$cx += ( $p[ $i ][0] + $q[0] ) * $cr;
			$cy += ( $p[ $i ][1] + $q[1] ) * $cr;
		}
		if ( ! $a2 ) {
			return null;
		}
		$faces = array();
		$gl    = sqrt( $gx * $gx + $gy * $gy );
		$gl    = $gl ? $gl : 1.0;
		for ( $k = 0; $k < $n; $k++ ) {
			$a    = $p[ $k ];
			$c    = $p[ ( $k + 1 ) % $n ];
			$vert = $a[0] == $c[0]; // phpcs:ignore Universal.Operators.StrictComparisons
			if ( ! $vert && $a[1] != $c[1] ) { // phpcs:ignore Universal.Operators.StrictComparisons
				continue;
			}
			$mx = ( $a[0] + $c[0] ) / 2;
			$my = ( $a[1] + $c[1] ) / 2;
			$nx = $vert ? 1 : 0;
			$ny = $vert ? 0 : 1;
			if ( self::in_poly( $p, $mx + $nx * 10, $my + $ny * 10 ) ) {
				$nx = -$nx;
				$ny = -$ny;
			}
			$gd      = ( $nx * $gx + $ny * $gy ) / $gl;
			$faces[] = array(
				'v'      => $vert,
				'c'      => ( $vert ? $a[0] : $a[1] ) / 1000,
				'lo'     => min( $vert ? $a[1] : $a[0], $vert ? $c[1] : $c[0] ) / 1000,
				'hi'     => max( $vert ? $a[1] : $a[0], $vert ? $c[1] : $c[0] ) / 1000,
				'garden' => $gd > 0.3,
				'street' => $ny > 0.5,
				'ext'    => true,
			);
		}
		$ws = array();
		foreach ( $b['walls'] as $w ) {
			$ws[ $w['id'] ] = $w;
		}
		$ent = array();
		foreach ( $b['openings'] as $o ) {
			$w = $ws[ $o['wall'] ] ?? null;
			if ( 'entrance' !== $o['type'] || $o['lv'] !== $lv || ! $w ) {
				continue;
			}
			$dx  = $w['b'][0] - $w['a'][0];
			$dy  = $w['b'][1] - $w['a'][1];
			$len = sqrt( $dx * $dx + $dy * $dy );
			$u   = $o['at'] + $o['w'] / 2;
			if ( ! $len ) {
				continue;
			}
			$ent[] = array(
				'x' => $w['a'][0] + $dx / $len * $u,
				'y' => $w['a'][1] + $dy / $len * $u,
				'm' => $w['t'] / 2 + $l['p'] + 0.06,
			);
		}
		return array(
			'lv'    => $lv,
			'mx'    => self::js_round( $cx / ( 3 * $a2 ) ) / 1000,
			'my'    => self::js_round( $cy / ( 3 * $a2 ) ) / 1000,
			'gx'    => $gx,
			'gy'    => $gy,
			'ent'   => $ent,
			'faces' => $faces,
		);
	}

	private static function layout_eval( array $rects, array $ctx ): array {
		$l   = self::layout_cfg();
		$all = array_values( array_filter( $rects, static fn( $r ) => $r['lv'] === $ctx['lv'] ) );
		$on  = array_values( array_filter( $all, static fn( $r ) => true === $r['placed'] ) );
		$out = array( 'rules' => array(), 'n' => 0, 'pass' => 0, 'w' => 0, 'pw' => 0, 'pct' => 100, 'score' => 100 );
		$of  = static fn( $types, array $list ): array => self::is_list( $types ) ? array_values( array_filter( $list, static fn( $r ) => in_array( $r['type'], $types, true ) ) ) : array();
		$adj = static function ( array $a, array $c ) use ( $l ): bool {
			$dx = max( $c['x'] - ( $a['x'] + $a['w'] ), $a['x'] - ( $c['x'] + $c['w'] ) );
			$dy = max( $c['y'] - ( $a['y'] + $a['d'] ), $a['y'] - ( $c['y'] + $c['d'] ) );
			$ox = min( $a['x'] + $a['w'], $c['x'] + $c['w'] ) - max( $a['x'], $c['x'] );
			$oy = min( $a['y'] + $a['d'], $c['y'] + $c['d'] ) - max( $a['y'], $c['y'] );
			return ( $dx <= $l['gap'] && $oy >= min( $l['lap'], $a['d'], $c['d'] ) - 0.001 ) || ( $dy <= $l['gap'] && $ox >= min( $l['lap'], $a['w'], $c['w'] ) - 0.001 );
		};
		$dist2 = static function ( array $a, array $c ): float {
			$ex = max( 0, $c['x'] - ( $a['x'] + $a['w'] ), $a['x'] - ( $c['x'] + $c['w'] ) );
			$ey = max( 0, $c['y'] - ( $a['y'] + $a['d'] ), $a['y'] - ( $c['y'] + $c['d'] ) );
			return $ex * $ex + $ey * $ey;
		};
		$ent_d2 = static function ( array $r, array $e ): float {
			$ex = max( $r['x'] - $e['x'], 0, $e['x'] - ( $r['x'] + $r['w'] ) );
			$ey = max( $r['y'] - $e['y'], 0, $e['y'] - ( $r['y'] + $r['d'] ) );
			return $ex * $ex + $ey * $ey;
		};
		$face = static function ( array $r, string $key ) use ( $ctx, $l ): bool {
			foreach ( $ctx['faces'] as $f ) {
				if ( ! $f[ $key ] ) {
					continue;
				}
				$e0 = $f['v'] ? $r['x'] : $r['y'];
				$e1 = $f['v'] ? $r['x'] + $r['w'] : $r['y'] + $r['d'];
				$lo = $f['v'] ? $r['y'] : $r['x'];
				$hi = $f['v'] ? $r['y'] + $r['d'] : $r['x'] + $r['w'];
				if ( ( abs( $e0 - $f['c'] ) <= $l['p'] + 0.03 || abs( $e1 - $f['c'] ) <= $l['p'] + 0.03 ) && min( $hi, $f['hi'] ) - max( $lo, $f['lo'] ) >= min( $l['lap'], $hi - $lo ) - 0.001 ) {
					return true;
				}
			}
			return false;
		};
		$garden  = static fn( array $r ): bool => $face( $r, 'garden' ) || ( ( $r['x'] + $r['w'] / 2 - $ctx['mx'] ) * $ctx['gx'] + ( $r['y'] + $r['d'] / 2 - $ctx['my'] ) * $ctx['gy'] > 0 && $face( $r, 'ext' ) );
		$street  = static fn( array $r ): bool => $face( $r, 'street' ) || ( $r['y'] + $r['d'] / 2 - $ctx['my'] > 0 && $face( $r, 'ext' ) );
		$is_on   = static fn( array $r ): bool => true === $r['placed'];
		$any_adj = static function ( array $r, array $list ) use ( $adj ): bool {
			foreach ( $list as $q ) {
				if ( $q['id'] !== $r['id'] && $adj( $r, $q ) ) {
					return true;
				}
			}
			return false;
		};
		$every = static function ( array $list, callable $fn ): bool {
			foreach ( $list as $x ) {
				if ( ! $fn( $x ) ) {
					return false;
				}
			}
			return true;
		};
		$some = static function ( array $list, callable $fn ): bool {
			foreach ( $list as $x ) {
				if ( $fn( $x ) ) {
					return true;
				}
			}
			return false;
		};
		foreach ( $l['rules'] as $rule ) {
			if ( ! self::is_obj( $rule ) || array() === $rule || ! is_string( self::at( $rule, 'id' ) ) ) {
				$out['rules'][] = array( 'id' => '', 'w' => 0, 'ok' => null );
				continue;
			}
			$kind  = self::at( $rule, 'kind' );
			$aa    = $of( self::at( $rule, 'types' ), $all );
			$w     = max( 0, self::num( self::at( $rule, 'w' ), 1.0 ) );
			$ok    = null;
			$t_all = $of( self::at( $rule, 'to' ), $all );
			$tt    = $of( self::at( $rule, 'to' ), $on );
			if ( 'side' === $kind ) {
				if ( $aa ) {
					$side = self::at( $rule, 'side' );
					$k    = count( array_filter( $aa, static fn( $r ) => $is_on( $r ) && ( 'street' === $side ? $street( $r ) : $garden( $r ) ) ) );
					$ok   = $k >= ( 'half' === self::at( $rule, 'need' ) ? (int) ceil( count( $aa ) / 2 ) : count( $aa ) );
				}
			} elseif ( 'adj' === $kind ) {
				$vv     = $of( self::at( $rule, 'via' ), $on );
				$entry  = self::truthy( self::at( $rule, 'entry' ) );
				$orside = self::at( $rule, 'orside' );
				if ( $aa && ( $t_all || ( $entry && $ctx['ent'] ) || self::truthy( $orside ) ) ) {
					$ok = $every(
						$aa,
						static function ( $r ) use ( $is_on, $any_adj, $tt, $vv, $adj, $t_all, $entry, $ctx, $ent_d2, $l, $orside, $street, $some ) {
							if ( ! $is_on( $r ) ) {
								return false;
							}
							if ( $any_adj( $r, $tt ) ) {
								return true;
							}
							$via = $some( $vv, static fn( $v ) => $adj( $r, $v ) && count( array_filter( $tt, static fn( $q ) => $adj( $v, $q ) ) ) >= min( 2, count( $t_all ) ) );
							if ( $via ) {
								return true;
							}
							if ( $entry && $some( $ctx['ent'], static fn( $e ) => $ent_d2( $r, $e ) <= $l['near'] * $l['near'] ) ) {
								return true;
							}
							return 'street' === $orside ? $street( $r ) : false;
						}
					);
				}
			} elseif ( 'between' === $kind ) {
				$to = self::at( $rule, 'to' );
				$gs = self::is_list( $to ) ? array_values( array_filter( $to, array( __CLASS__, 'is_list' ) ) ) : array();
				if ( $aa && $gs && $every( $gs, static fn( $g2 ) => count( $of( $g2, $all ) ) > 0 ) ) {
					$ok = $every( $aa, static fn( $r ) => $is_on( $r ) && $every( $gs, static fn( $g2 ) => $any_adj( $r, $of( $g2, $on ) ) ) );
				}
			} elseif ( 'apart' === $kind ) {
				$ff = $of( self::at( $rule, 'from' ), $all );
				if ( $aa && $ff ) {
					$fo = $of( self::at( $rule, 'from' ), $on );
					$ok = $every( $aa, static fn( $r ) => $is_on( $r ) && ! $any_adj( $r, $fo ) );
				}
			} elseif ( 'entry' === $kind ) {
				if ( $aa && $ctx['ent'] ) {
					$ok = $some( $aa, static fn( $r ) => $is_on( $r ) && $some( $ctx['ent'], static fn( $e ) => $ent_d2( $r, $e ) <= $e['m'] * $e['m'] ) );
				}
			} elseif ( 'links' === $kind ) {
				$nd = min( count( $t_all ), max( 2, self::num( self::at( $rule, 'need' ), (float) count( $t_all ) ) ) );
				if ( $aa && count( $t_all ) >= 2 ) {
					$ok = $some( $aa, static fn( $r ) => $is_on( $r ) && count( array_filter( $tt, static fn( $q ) => $adj( $r, $q ) ) ) >= $nd );
				}
			} elseif ( 'cluster' === $kind ) {
				if ( count( $aa ) >= 2 ) {
					$nr   = self::num( self::at( $rule, 'near' ), $l['gap'] );
					$seen = array( 0 );
					$all_on = $every( $aa, $is_on );
					if ( $all_on ) {
						for ( $i2 = 0; $i2 < count( $seen ); $i2++ ) { // phpcs:ignore Generic.CodeAnalysis.ForLoopWithTestFunctionCall
							$cur = $aa[ $seen[ $i2 ] ];
							foreach ( $aa as $j => $q ) {
								if ( ! in_array( $j, $seen, true ) && ( $adj( $cur, $q ) || $dist2( $cur, $q ) <= $nr * $nr ) ) {
									$seen[] = $j;
								}
							}
						}
					}
					$ok = $all_on && count( $seen ) === count( $aa );
				}
			}
			$out['rules'][] = array( 'id' => $rule['id'], 'w' => $w, 'ok' => $ok );
			if ( null === $ok ) {
				continue;
			}
			++$out['n'];
			$out['w'] += $w;
			if ( $ok ) {
				++$out['pass'];
				$out['pw'] += $w;
			}
		}
		$out['pct']   = $out['n'] ? self::js_round( 1000 * $out['pass'] / $out['n'] ) / 10 : 100;
		$out['score'] = $out['w'] ? self::js_round( 100 * $out['pw'] / $out['w'] ) : 100;
		return $out;
	}

	/* ------------------------------------------------------------------ analysis */

	private static function walls_of_level( array $b, int $lv ): array {
		return array_values( array_filter( $b['walls'], static fn( $w ) => 'ext' === $w['kind'] || $w['lv'] === $lv ) );
	}

	private static function level_base( array $b, int $lv ): float {
		$z = (float) $b['found']['top'];
		for ( $i = 0; $i < $lv; $i++ ) {
			$z += $b['levels'][ $i ]['h'];
		}
		return $z;
	}

	/** Outline of the house (outer face of the external walls) and its centre line (port of outlineOf()). */
	private static function outline_of( array $b ): array {
		$ext = array_values( array_filter( $b['walls'], static fn( $w ) => 'ext' === $w['kind'] ) );
		$fs  = array_values( array_filter( self::faces( self::edges_of( $ext ) ), static fn( $f ) => $f['a2'] > 0 ) );
		if ( ! $fs ) {
			return array( 'closed' => false, 'loops' => 0 );
		}
		usort( $fs, static fn( $p, $q ) => $q['a2'] <=> $p['a2'] );
		$f      = $fs[0];
		$cl     = self::clean( $f['poly'], $f['ts'] );
		$mg     = self::merge( $cl[0], $cl[1] );
		$center = $mg[0];
		$outer  = self::offset( $center, array_map( static fn( $t ) => -$t / 2, $mg[1] ) );
		$inner  = self::offset( $center, array_map( static fn( $t ) => $t / 2, $mg[1] ) );
		return array(
			'closed'    => true,
			'loops'     => count( $fs ),
			'center'    => $center,
			'outer'     => $outer,
			'inner'     => $inner,
			'ts'        => $mg[1],
			'ortho'     => self::orthogonal( $outer ) && self::orthogonal( $center ),
			'area'      => self::area2( $outer ) / 2,
			'innerArea' => self::area2( $inner ) / 2,
		);
	}

	/** Rooms of one level: interior faces of the wall graph, net area after half the wall thicknesses. */
	private static function rooms_of( array $b, int $lv, array $ol ): array {
		$fs  = array_filter( self::faces( self::edges_of( self::walls_of_level( $b, $lv ) ) ), static fn( $f ) => $f['a2'] > 0 );
		$out = array();
		foreach ( $fs as $f ) {
			$cl = self::clean( $f['poly'], $f['ts'] );
			if ( count( $cl[0] ) < 3 ) {
				continue;
			}
			$mg  = self::merge( $cl[0], $cl[1] );
			$net = self::offset( $mg[0], array_map( static fn( $t ) => $t / 2, $mg[1] ) );
			$a   = self::area2( $mg[0] ) / 2;
			if ( $a < 500000 ) {
				continue; // < 0.5 m²: a slot between walls, not a room
			}
			$cx = 0.0;
			$cy = 0.0;
			foreach ( $net as $q ) {
				$cx += $q[0];
				$cy += $q[1];
			}
			$cx /= count( $net );
			$cy /= count( $net );
			if ( $ol['closed'] && ! self::in_poly( $ol['center'], $cx, $cy ) ) {
				continue; // outside the house (yard enclosed by walls)
			}
			$key   = $lv . ':' . (int) self::js_round( $cx / 100 ) . ',' . (int) self::js_round( $cy / 100 );
			$rooms = (array) $b['rooms'];
			$out[] = array( 'lv' => $lv, 'key' => $key, 'poly' => $mg[0], 'net' => $net, 'area' => max( 0, self::area2( $net ) / 2 ), 'gross' => $a, 'bbox' => self::bbox_of( $net ), 'cx' => $cx, 'cy' => $cy, 'type' => (string) ( $rooms[ $key ] ?? '' ) );
		}
		// 1.16.3, same as agh-build.js roomsOf(): a face loses the rooms that lie inside it (direct children)
		// 1.21.0: every corner of the smaller room in (or on the edge of) the bigger one, as in agh-build.js
		$inside = static function ( array $o, array $r ): bool {
			if ( $o['key'] === $r['key'] || $o['gross'] >= $r['gross'] || ! self::in_poly( $r['poly'], (float) $o['cx'], (float) $o['cy'] ) ) {
				return false;
			}
			foreach ( $o['poly'] as $q ) {
				if ( ! self::in_poly( $r['poly'], (float) $q[0], (float) $q[1] ) && ! self::on_boundary( $r['poly'], (float) $q[0], (float) $q[1] ) ) {
					return false;
				}
			}
			return true;
		};
		$minus  = array();
		foreach ( $out as $i => $r ) {
			$m = 0.0;
			foreach ( $out as $o ) {
				if ( ! $inside( $o, $r ) ) {
					continue;
				}
				$nested = false;
				foreach ( $out as $mid ) {
					if ( $mid['key'] !== $o['key'] && $inside( $o, $mid ) && $inside( $mid, $r ) ) {
						$nested = true;
						break;
					}
				}
				if ( ! $nested ) {
					$m += $o['gross'];
				}
			}
			$minus[ $i ] = $m;
		}
		foreach ( $minus as $i => $m ) {
			if ( $m > 0 ) {
				$out[ $i ]['area']  = max( 0, $out[ $i ]['area'] - $m );
				$out[ $i ]['gross'] = max( 0, $out[ $i ]['gross'] - $m );
			}
		}
		$out = array_values( array_filter( $out, static fn( $r ) => $r['area'] >= 500000 ) );
		usort(
			$out,
			static function ( $p, $q ) {
				foreach ( array( $q['area'] - $p['area'], $p['cx'] - $q['cx'], $p['cy'] - $q['cy'] ) as $d ) {
					if ( 0.0 != $d ) {
						return $d <=> 0;
					}
				}
				return 0;
			}
		);
		return $out;
	}

	/** Opening kind of the shared plan. */
	private static function op_kind( string $type ): string {
		return 'entrance' === $type || 'door' === $type ? 'door' : ( 'terrace' === $type ? 'tdoor' : 'win' );
	}

	/** Face of box q that opening o (projected onto the outer face) lies on, with its extent. */
	private static function face_of( array $q, array $o ): ?array {
		if ( 'x' === $o['ax'] ) {
			if ( $o['out'] > 0 && abs( $o['c'] - $q['y1'] ) <= 10 ) {
				return array( 'f' => 'front', 'lo' => $q['x0'], 'hi' => $q['x1'] );
			}
			if ( $o['out'] < 0 && abs( $o['c'] - $q['y0'] ) <= 10 ) {
				return array( 'f' => 'back', 'lo' => $q['x0'], 'hi' => $q['x1'] );
			}
		} else {
			if ( $o['out'] > 0 && abs( $o['c'] - $q['x1'] ) <= 10 ) {
				return array( 'f' => 'right', 'lo' => $q['y0'], 'hi' => $q['y1'] );
			}
			if ( $o['out'] < 0 && abs( $o['c'] - $q['x0'] ) <= 10 ) {
				return array( 'f' => 'left', 'lo' => $q['y0'], 'hi' => $q['y1'] );
			}
		}
		return null;
	}

	private static function whole( array $q, array $o ): ?array {
		$f = self::face_of( $q, $o );
		return $f && $o['a0'] >= $f['lo'] - 10 && $o['a1'] <= $f['hi'] + 10 ? $f : null;
	}

	/**
	 * The drawing as geometry (port of adapt() plus the rooms of every level).
	 *
	 * Returns ok (closed orthogonal outline), outer (outline points, m), boxes (footprint rectangles
	 * relative to the outline bbox min, m), W, D (m), area (m²), rooms (per level: lv, key, type,
	 * area m², bbox m, net polygon m), ops (per box: the bOps faces like the JS), openings (every
	 * opening with its wall position, m), walls, levels, origin (outline bbox min, m), seams and the
	 * normalized build.
	 *
	 * @param mixed $raw The build (sanitized or not).
	 */
	public static function model( $raw ): array {
		$b = self::sanitize( $raw );
		if ( ! $b ) {
			return array( 'ok' => false, 'reason' => 'empty' );
		}
		$b   = json_decode( (string) json_encode( $b ), true );
		$key = md5( (string) json_encode( $b ) );
		if ( isset( self::$cache[ $key ] ) ) {
			return self::$cache[ $key ];
		}
		$r = self::compute( $b );
		self::$cache[ $key ] = $r;
		if ( count( self::$cache ) > 6 ) {
			array_shift( self::$cache );
		}
		return $r;
	}

	/**
	 * Rooms of every level (any drawing, also a non-orthogonal or open one, like roomsOf() in the JS):
	 * lv, key, type, area m², bbox m, net polygon m – per level largest first.
	 *
	 * @param mixed $raw The build.
	 */
	public static function rooms( $raw ): array {
		$b = self::sanitize( $raw );
		if ( ! $b ) {
			return array();
		}
		$b = json_decode( (string) json_encode( $b ), true );
		return self::rooms_list( $b, self::outline_of( $b ) );
	}

	private static function rooms_list( array $b, array $ol ): array {
		$out = array();
		for ( $lv = 0, $n = count( $b['levels'] ); $lv < $n; $lv++ ) {
			foreach ( self::rooms_of( $b, $lv, $ol ) as $rm ) {
				$out[] = array(
					'lv'   => $lv,
					'key'  => $rm['key'],
					'type' => $rm['type'],
					'area' => self::m( self::m( $rm['area'] ) ),
					'bbox' => array( 'x0' => self::m( $rm['bbox']['x0'] ), 'y0' => self::m( $rm['bbox']['y0'] ), 'x1' => self::m( $rm['bbox']['x1'] ), 'y1' => self::m( $rm['bbox']['y1'] ) ),
					'net'  => array_map( static fn( $p ) => array( self::m( $p[0] ), self::m( $p[1] ) ), $rm['net'] ),
				);
			}
		}
		return $out;
	}

	private static function compute( array $b ): array {
		$ol = self::outline_of( $b );
		if ( ! $ol['closed'] ) {
			return array( 'ok' => false, 'reason' => 'open', 'build' => $b );
		}
		if ( ! $ol['ortho'] ) {
			return array( 'ok' => false, 'reason' => 'ortho', 'build' => $b, 'area' => self::m( self::m( $ol['area'] ) ) );
		}
		$bb    = self::bbox_of( $ol['outer'] );
		$n     = count( $b['levels'] );
		$by_id = array();
		foreach ( $b['walls'] as $w ) {
			$by_id[ $w['id'] ] = $w;
		}
		// openings: every one on its wall (centre line), the external ones projected onto the outer face
		$ops      = array();
		$openings = array();
		foreach ( $b['openings'] as $op ) {
			$w = $by_id[ $op['wall'] ] ?? null;
			if ( ! $w ) {
				continue;
			}
			$s   = self::seg( $w );
			$len = self::len_c( $s );
			$ux  = ( $s['bx'] - $s['ax'] ) / $len;
			$uy  = ( $s['by'] - $s['ay'] ) / $len;
			$nx  = -$uy;
			$ny  = $ux;
			$mx  = $s['ax'] + $ux * self::c( $op['at'] + $op['w'] / 2 );
			$my  = $s['ay'] + $uy * self::c( $op['at'] + $op['w'] / 2 );
			$axis = abs( $uy ) < 1e-9 ? 'x' : ( abs( $ux ) < 1e-9 ? 'y' : '' );
			$info = array( 'id' => $op['id'], 'type' => $op['type'], 'lv' => $op['lv'], 'w' => $op['w'], 'h' => $op['h'], 'sill' => $op['sill'], 'wall' => $w['id'], 'kind' => $w['kind'], 'axis' => $axis, 'x' => self::m( $mx ), 'y' => self::m( $my ), 't' => (float) $w['t'] );
			if ( 'ext' === $w['kind'] ) {
				$side = self::in_poly( $ol['center'], $mx + $nx * ( $s['t'] / 2 + 20 ), $my + $ny * ( $s['t'] / 2 + 20 ) ) ? -1 : 1;
				$ox   = self::js_round( $mx + $side * $nx * $s['t'] / 2 );
				$oy   = self::js_round( $my + $side * $ny * $s['t'] / 2 );
				$half = self::c( $op['w'] ) / 2;
				$o    = array( 'op' => $op, 'kind' => self::op_kind( $op['type'] ), 'y' => self::level_base( $b, $op['lv'] ) + ( 'window' === $op['type'] ? $op['sill'] : 0.02 ) );
				$info['ox'] = self::m( $ox );
				$info['oy'] = self::m( $oy );
				if ( 'x' === $axis ) {
					$o += array( 'ax' => 'x', 'c' => $oy, 'a0' => $ox - $half, 'a1' => $ox + $half, 'out' => $side * $ny > 0 ? 1 : -1 );
				} elseif ( 'y' === $axis ) {
					$o += array( 'ax' => 'y', 'c' => $ox, 'a0' => $oy - $half, 'a1' => $oy + $half, 'out' => $side * $nx > 0 ? 1 : -1 );
				} else {
					$openings[] = $info;
					continue;
				}
				$info['out'] = $o['out'];
				$ops[]       = $o;
			}
			$openings[] = $info;
		}
		// footprint boxes: the largest-rectangle split, or a strip split that keeps every opening whole
		$cands = array( self::decompose( $ol['outer'] ), self::strips( $ol['outer'], 'x' ), self::strips( $ol['outer'], 'y' ) );
		$boxes = $cands[0];
		foreach ( $cands as $cand ) {
			$all = true;
			foreach ( $ops as $o ) {
				$fits = false;
				foreach ( $cand as $q ) {
					if ( self::whole( $q, $o ) ) {
						$fits = true;
						break;
					}
				}
				if ( ! $fits ) {
					$all = false;
					break;
				}
			}
			if ( $all ) {
				$boxes = $cand;
				break;
			}
		}
		$b_ops = array();
		foreach ( $boxes as $i => $q ) {
			$b_ops[ $i ] = array( 'front' => array(), 'right' => array(), 'back' => array(), 'left' => array() );
		}
		$piece = static function ( int $vi, array $f, array $o, float $lo, float $hi, bool $part ) use ( &$b_ops, $boxes ) {
			$q  = $boxes[ $vi ];
			$u0 = 'front' === $f['f'] ? $lo - $q['x0'] : ( 'back' === $f['f'] ? $q['x1'] - $hi : ( 'right' === $f['f'] ? $q['y1'] - $hi : $lo - $q['y0'] ) );
			$b_ops[ $vi ][ $f['f'] ][] = array( 'kind' => $o['kind'], 'x' => self::r3( self::m( max( 0, $u0 ) ) ), 'y' => self::r3( $o['y'] ), 'w' => self::r3( self::m( $hi - $lo ) ), 'h' => $o['op']['h'], 'fl' => $o['op']['lv'], 'e' => 'entrance' === $o['op']['type'], 'id' => $o['op']['id'], 'part' => $part );
		};
		$seams = 0;
		foreach ( $ops as $o ) {
			$done = false;
			foreach ( $boxes as $vi => $q ) {
				$f = self::whole( $q, $o );
				if ( $f ) {
					$piece( $vi, $f, $o, $o['a0'], $o['a1'], false );
					$done = true;
					break;
				}
			}
			if ( $done ) {
				continue;
			}
			$seams++; // last resort: the parts on each box face line up into one opening
			foreach ( $boxes as $vi => $q ) {
				$f2 = self::face_of( $q, $o );
				if ( ! $f2 ) {
					continue;
				}
				$lo = max( $o['a0'], $f2['lo'] );
				$hi = min( $o['a1'], $f2['hi'] );
				if ( $hi - $lo > 50 ) {
					$piece( $vi, $f2, $o, $lo, $hi, true );
				}
			}
		}
		foreach ( $b_ops as $vi => $faces ) {
			foreach ( $faces as $f => $list ) {
				usort( $list, static fn( $p, $s2 ) => ( $p['x'] - $s2['x'] ?: $p['y'] - $s2['y'] ) <=> 0 );
				$b_ops[ $vi ][ $f ] = $list;
			}
		}
		$rooms = self::rooms_list( $b, $ol );
		$h_tot = (float) $b['found']['top'];
		foreach ( $b['levels'] as $l ) {
			$h_tot += $l['h'];
		}
		return array(
			'ok'       => true,
			'outer'    => array_map( static fn( $p ) => array( self::m( $p[0] ), self::m( $p[1] ) ), $ol['outer'] ),
			'center'   => array_map( static fn( $p ) => array( self::m( $p[0] ), self::m( $p[1] ) ), $ol['center'] ),
			'boxes'    => array_map( static fn( $q ) => array( 'x0' => self::m( $q['x0'] - $bb['x0'] ), 'y0' => self::m( $q['y0'] - $bb['y0'] ), 'x1' => self::m( $q['x1'] - $bb['x0'] ), 'y1' => self::m( $q['y1'] - $bb['y0'] ) ), $boxes ),
			'ops'      => $b_ops,
			'W'        => self::m( $bb['x1'] - $bb['x0'] ),
			'D'        => self::m( $bb['y1'] - $bb['y0'] ),
			'origin'   => array( self::m( $bb['x0'] ), self::m( $bb['y0'] ) ),
			'area'     => self::m( self::m( $ol['area'] ) ),
			'rooms'    => $rooms,
			'openings' => $openings,
			'walls'    => $b['walls'],
			'levels'   => $b['levels'],
			'floors'   => $n,
			'attic'    => (bool) $b['attic'],
			'plinth'   => (float) $b['found']['top'],
			'h0'       => self::r3( $h_tot + ( $b['attic'] ? 0.9 : 0 ) ),
			'loops'    => $ol['loops'],
			'seams'    => $seams,
			'build'    => $b,
		);
	}
}
