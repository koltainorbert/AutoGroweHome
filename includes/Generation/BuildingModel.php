<?php
/**
 * Deterministic building data model (agh-building-v1).
 *
 * Builds a structured, internally consistent concept geometry from the
 * validated parameters: footprint, parts (wings), levels, room rectangles,
 * walls, openings, circulation, stairs, terrace, garage and roof geometry.
 * AI output may only nudge room areas (±20 %, validated) – it is never used
 * directly as geometry.
 *
 * Coordinate system: metres, origin top-left of the house footprint, x to
 * the right, y downward. Front/street/entrance side = top (y = 0),
 * garden side = bottom.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Generation;

use AutoGroweHome\Build\Build;
use AutoGroweHome\Params\Definitions;
use AutoGroweHome\Params\RoomProgram;

defined( 'ABSPATH' ) || exit;

final class BuildingModel {

	public const T_EXT   = 0.38;
	public const T_INT   = 0.12;
	public const CORR    = 1.25;
	public const MIN_COL = 1.6;
	/**
	 * Smallest axis-to-axis room dimension the layout hands out (column width
	 * or stacked room depth). After the interior wall shrink (T_INT) this
	 * leaves ≥ 1.22 m, i.e. above the 1.2 m "too narrow" threshold.
	 */
	public const MIN_DIM = 1.34;

	private const GARDEN_PREF = array( 'living_kitchen', 'living', 'dining', 'kitchen', 'master', 'bedroom', 'kids', 'guest', 'office', 'playroom', 'gym' );
	private const NIGHT       = array( 'master', 'bedroom', 'kids', 'guest', 'wardrobe' );
	private const HABITABLE   = array( 'living_kitchen', 'living', 'dining', 'kitchen', 'master', 'bedroom', 'kids', 'guest', 'office', 'playroom', 'gym', 'wellness' );

	/**
	 * @param array  $c       Validated configuration.
	 * @param string $variant A|B|C.
	 * @param array  $adjust  room id => area (validated against ±20 %).
	 */
	public static function build( array $c, string $variant = 'A', array $adjust = array() ): array {
		// Build mode („Építés az alapoktól”): a valid drawing is the geometry. Switched off, without a
		// drawing or with one the plan cannot use (open or not orthogonal outline) nothing changes below.
		if ( ! empty( $c['build'] ) && is_array( $c['build'] ) && Build::enabled() ) {
			$drawn = self::from_build( $c, $variant );
			if ( null !== $drawn ) {
				return $drawn;
			}
		}
		$types     = Definitions::room_types();
		$levels_n  = RoomProgram::level_count( $c );
		$explicit  = array_flip( (array) ( $c['_explicit'] ?? array() ) );
		$rooms     = array();
		$warnings  = array();

		foreach ( (array) ( $c['rooms'] ?? array() ) as $r ) {
			if ( isset( $adjust[ $r['id'] ] ) && is_numeric( $adjust[ $r['id'] ] ) ) {
				$a = (float) $adjust[ $r['id'] ];
				if ( $a >= $r['area'] * 0.8 && $a <= $r['area'] * 1.2 ) {
					$r['area'] = round( $a, 1 );
				}
			}
			$r['zone']  = $types[ $r['type'] ][4] ?? 'day';
			$r['level'] = min( $levels_n - 1, (int) $r['level'] );
			$rooms[]    = $r;
		}
		// Stairs must exist on every level of a multi-storey house.
		if ( $levels_n > 1 ) {
			for ( $l = 0; $l < $levels_n; $l++ ) {
				$has = false;
				foreach ( $rooms as $r ) {
					if ( 'stairs' === $r['type'] && $r['level'] === $l ) {
						$has = true;
					}
				}
				if ( ! $has ) {
					$rooms[] = array( 'id' => 'auto_stairs_' . $l, 'type' => 'stairs', 'name' => $types['stairs'][0], 'area' => 6, 'level' => $l, 'zone' => 'circulation', 'render' => false );
				}
			}
		}

		// Shape: explicit choice is binding; otherwise variants may differ.
		$shape = (string) ( $c['footprint'] ?? 'rectangle' );
		if ( ! isset( $explicit['footprint'] ) && 'rectangle' === $shape && 1 === $levels_n ) {
			$net = (float) ( $c['net_area'] ?? 120 );
			if ( 'C' === $variant && $net >= 105 ) {
				$shape = 'l_shape';
			} elseif ( 'B' === $variant && $net >= 160 ) {
				$shape = 'staggered';
			}
		}
		if ( $levels_n > 1 && in_array( $shape, array( 'u_shape' ), true ) ) {
			$shape = 'l_shape';
		}

		$aspect = array( 'A' => 1.45, 'B' => 1.75, 'C' => 1.25 )[ $variant ] ?? 1.45;
		$mirror = 'B' === $variant;

		$by_level = array();
		foreach ( $rooms as $r ) {
			$by_level[ $r['level'] ][] = $r;
		}

		$circ_extra = 0.0;
		$need       = array();
		for ( $l = 0; $l < $levels_n; $l++ ) {
			$sum = 0.0;
			foreach ( $by_level[ $l ] ?? array() as $r ) {
				$sum += (float) $r['area'];
			}
			$has_corr = false;
			foreach ( $by_level[ $l ] ?? array() as $r ) {
				if ( 'corridor' === $r['type'] ) {
					$has_corr = true;
				}
			}
			if ( ! $has_corr ) {
				$circ_extra = max( $circ_extra, 0.06 * $sum );
				$sum       *= 1.06;
			}
			if ( 'attic' === ( $c['levels'] ?? '' ) && $l > 0 ) {
				$sum /= 0.78;
			}
			// Interior partitions take roughly 7–8 % of the inner area.
			$sum *= 1.08;
			$need[ $l ] = $sum;
		}

		$parts = self::plan_parts( $shape, $by_level[0] ?? array(), $need[0] ?? 60, $aspect, $c );
		$upper_need = 0.0;
		for ( $l = 1; $l < $levels_n; $l++ ) {
			$upper_need = max( $upper_need, $need[ $l ] );
		}

		// Explicit external dimensions win for the main part.
		$bw = (float) ( $c['building_width'] ?? 0 );
		$bl = (float) ( $c['building_length'] ?? 0 );
		if ( $bw > 4 && $bl > 4 && 1 === count( $parts ) ) {
			$parts[0]['w'] = $bw;
			$parts[0]['h'] = $bl;
		} elseif ( $upper_need > 0 ) {
			// Make sure the main part can host the largest upper level.
			$main      = &$parts[0];
			$inner     = ( $main['w'] - 2 * self::T_EXT ) * ( $main['h'] - 2 * self::T_EXT );
			if ( $inner < $upper_need * 0.98 ) {
				$f          = sqrt( $upper_need / max( 1, $inner ) );
				$main['w'] *= $f;
				$main['h'] *= $f;
				self::reposition_parts( $parts, $shape );
			}
			unset( $main );
		}

		$model = array(
			'schema'   => 'agh-building-v1',
			'units'    => 'm',
			'variant'  => $variant,
			'shape'    => $shape,
			'shape_label' => array( 'rectangle' => 'simple rectangular', 'l_shape' => 'L-shaped', 'u_shape' => 'U-shaped', 'staggered' => 'staggered' )[ $shape ] ?? 'rectangular',
			'mirror'   => $mirror,
			't_ext'    => self::T_EXT,
			't_int'    => self::T_INT,
			'parts'    => array(),
			'levels'   => array(),
			'rooms'    => array(),
			'openings' => array(),
			'walls'    => array(),
		);

		// Normalise part coordinates so the bounding box starts at 0,0.
		$minx = min( array_map( static fn( $p ) => $p['x'], $parts ) );
		$miny = min( array_map( static fn( $p ) => $p['y'], $parts ) );
		foreach ( $parts as &$p ) {
			$p['x'] = round( $p['x'] - $minx, 3 );
			$p['y'] = round( $p['y'] - $miny, 3 );
			$p['w'] = round( $p['w'], 3 );
			$p['h'] = round( $p['h'], 3 );
		}
		unset( $p );
		$model['parts'] = $parts;
		$model['width'] = round( max( array_map( static fn( $p ) => $p['x'] + $p['w'], $parts ) ), 2 );
		$model['length'] = round( max( array_map( static fn( $p ) => $p['y'] + $p['h'], $parts ) ), 2 );

		$storey  = (float) ( $c['ceiling_height'] ?? 2.8 ) + 0.35;
		$band_memo = null;
		for ( $l = 0; $l < $levels_n; $l++ ) {
			$level_rooms = $by_level[ $l ] ?? array();
			if ( 0 === $l ) {
				$assign = self::assign_rooms_to_parts( $parts, $level_rooms );
			} else {
				$assign = array( 0 => $level_rooms );
			}
			foreach ( $assign as $pi => $prs ) {
				if ( empty( $prs ) ) {
					continue;
				}
				$part   = $parts[ $pi ];
				$result = self::layout_part( $part, $prs, $l, $mirror, 0 === $pi, $band_memo, $l > 0 );
				if ( 0 === $l && 0 === $pi ) {
					$band_memo = $result['bands'];
				}
				foreach ( $result['rooms'] as $id => $rect ) {
					$model['rooms'][ $id ] = $rect;
				}
				foreach ( $result['openings'] as $o ) {
					$model['openings'][] = $o;
				}
				foreach ( $result['walls'] as $w ) {
					$model['walls'][] = $w;
				}
				$warnings = array_merge( $warnings, $result['warnings'] );
			}
			$elev = $l * $storey;
			$model['levels'][] = array(
				'index'     => $l,
				'name'      => 0 === $l ? __( 'Földszint', 'autogrowehome' ) : ( ( 'attic' === ( $c['levels'] ?? '' ) ) ? __( 'Tetőtér', 'autogrowehome' ) : sprintf( /* translators: %d: floor */ __( '%d. emelet', 'autogrowehome' ), $l ) ),
				'elevation' => round( $elev, 2 ),
				'height'    => round( $storey, 2 ),
				'attic'     => 'attic' === ( $c['levels'] ?? '' ) && $l > 0,
			);
		}

		// Openings between parts (wings) on the ground floor.
		if ( count( $parts ) > 1 ) {
			for ( $pi = 1; $pi < count( $parts ); $pi++ ) {
				$j = self::joint( $parts[0], $parts[ $pi ] );
				if ( $j ) {
					$model['openings'][] = array( 'type' => 'door', 'level' => 0, 'x' => $j['x'], 'y' => $j['y'], 'width' => 1.0, 'orient' => $j['orient'], 'side' => 'int', 'room' => '' );
				}
			}
		}

		// Terrace at the garden side of the living area.
		$model['terrace'] = self::terrace( $model, (float) ( $c['terrace_area'] ?? 0 ) );
		$model['garage']  = self::garage( $model, (string) ( $c['garage'] ?? 'none' ), $mirror );

		// Roof geometry.
		$model['roof'] = self::roof( $model, $c, $levels_n, $storey );

		// Area check.
		$real_sum   = 0.0;
		$target_sum = 0.0;
		foreach ( $model['rooms'] as $r ) {
			$real_sum   += $r['area'];
			$target_sum += $r['target'];
		}
		$net  = (float) ( $c['net_area'] ?? $target_sum );
		$diff = $net > 0 ? ( $real_sum - $net ) / $net * 100 : 0;
		if ( abs( $diff ) > 10 ) {
			$warnings[] = sprintf( /* translators: 1: real, 2: requested, 3: pct */ __( 'A tervvázlat helyiségeinek összterülete %1$s m², a kért nettó terület %2$s m² (%3$s%% eltérés).', 'autogrowehome' ), number_format_i18n( $real_sum, 1 ), number_format_i18n( $net, 1 ), number_format_i18n( $diff, 1 ) );
		}
		$gross = 0.0;
		foreach ( $parts as $p ) {
			$gross += $p['w'] * $p['h'];
		}
		$model['checks'] = array(
			'net_requested' => round( $net, 1 ),
			'net_planned'   => round( $real_sum, 1 ),
			'diff_pct'      => round( $diff, 1 ),
			'footprint'     => round( $gross, 1 ),
			'gross'         => round( $gross * max( 1, ( 'attic' === ( $c['levels'] ?? '' ) ? 1.65 : $levels_n ) ), 1 ),
			'warnings'      => array_values( array_unique( $warnings ) ),
		);
		$model['meta'] = array(
			'generator'  => 'AutoGroweHome ' . AGH_VERSION,
			'disclaimer' => 'Conceptual sketch generated from structured parameters. Not a permit or construction document; must be verified by a licensed designer.',
		);
		return $model;
	}

	/**
	 * Determine part rectangles (outer dimensions) for the chosen shape.
	 */
	private static function plan_parts( string $shape, array $rooms0, float $need0, float $aspect, array $c ): array {
		$inner_need = max( 20.0, $need0 );
		$night      = 0.0;
		foreach ( $rooms0 as $r ) {
			if ( in_array( $r['type'], self::NIGHT, true ) || ( 'bathroom' === $r['type'] ) ) {
				$night += $r['area'];
			}
		}
		$t2 = 2 * self::T_EXT;
		if ( 'rectangle' === $shape || $night < 15 ) {
			$area = $inner_need;
			$d    = sqrt( $area / $aspect );
			$w    = $area / $d;
			return array( array( 'id' => 'main', 'x' => 0, 'y' => 0, 'w' => $w + $t2, 'h' => $d + $t2, 'axis' => 'h', 'role' => 'all' ) );
		}
		$main_need = max( 20.0, $inner_need - $night * 1.12 );
		$wing_need = $inner_need - $main_need;
		$d         = max( min( 7.4, sqrt( $main_need ) ), sqrt( $main_need / max( 1.0, $aspect ) ) );
		$w         = $main_need / $d;
		$parts     = array( array( 'id' => 'main', 'x' => 0, 'y' => 0, 'w' => $w + $t2, 'h' => $d + $t2, 'axis' => 'h', 'role' => 'day' ) );
		if ( 'l_shape' === $shape ) {
			$ww = min( 8.5, max( 5.2, sqrt( $wing_need / 1.6 ) ) );
			$wl = $wing_need / $ww;
			$parts[] = array( 'id' => 'wing', 'w' => $ww + $t2, 'h' => $wl + $t2, 'axis' => 'v', 'role' => 'night' );
		} elseif ( 'u_shape' === $shape ) {
			$half = $wing_need / 2;
			$ww   = min( 7.5, max( 4.8, sqrt( $half / 1.5 ) ) );
			$parts[] = array( 'id' => 'wing', 'w' => $ww + $t2, 'h' => $half / $ww + $t2, 'axis' => 'v', 'role' => 'night' );
			$parts[] = array( 'id' => 'wing2', 'w' => $ww + $t2, 'h' => $half / $ww + $t2, 'axis' => 'v', 'role' => 'night' );
		} else { // staggered.
			$dd = sqrt( $wing_need / $aspect );
			$parts[] = array( 'id' => 'wing', 'w' => $wing_need / $dd + $t2, 'h' => $dd + $t2, 'axis' => 'h', 'role' => 'night' );
		}
		self::reposition_parts( $parts, $shape );
		return $parts;
	}

	private static function reposition_parts( array &$parts, string $shape ): void {
		if ( count( $parts ) < 2 ) {
			return;
		}
		$m = $parts[0];
		if ( 'l_shape' === $shape ) {
			// Wing hangs from the right end of the main body toward the garden.
			$parts[1]['x'] = $m['x'] + $m['w'] - $parts[1]['w'];
			$parts[1]['y'] = $m['y'] + $m['h'] - self::T_EXT;
		} elseif ( 'u_shape' === $shape ) {
			$parts[1]['x'] = $m['x'] + $m['w'] - $parts[1]['w'];
			$parts[1]['y'] = $m['y'] + $m['h'] - self::T_EXT;
			$parts[2]['x'] = $m['x'];
			$parts[2]['y'] = $m['y'] + $m['h'] - self::T_EXT;
		} else {
			$parts[1]['x'] = $m['x'] + $m['w'] - self::T_EXT;
			$parts[1]['y'] = $m['y'] - 1.5;
		}
	}

	private static function assign_rooms_to_parts( array $parts, array $rooms ): array {
		$out = array_fill( 0, count( $parts ), array() );
		if ( 1 === count( $parts ) ) {
			$out[0] = $rooms;
			return $out;
		}
		$wings = array();
		foreach ( $parts as $i => $p ) {
			if ( $i > 0 ) {
				$wings[] = $i;
			}
		}
		$wi = 0;
		foreach ( $rooms as $r ) {
			$is_night = in_array( $r['type'], self::NIGHT, true );
			$is_bath  = 'bathroom' === $r['type'];
			if ( $is_night || $is_bath ) {
				$out[ $wings[ $wi % count( $wings ) ] ][] = $r;
				if ( $is_night && count( $wings ) > 1 ) {
					$wi++;
				}
			} else {
				$out[0][] = $r;
			}
		}
		return $out;
	}

	/**
	 * Two-band + corridor strip layout inside one part.
	 *
	 * @return array{rooms:array,openings:array,walls:array,bands:array,warnings:array}
	 */
	private static function layout_part( array $part, array $rooms, int $level, bool $mirror, bool $is_main, ?array $memo, bool $upper ): array {
		$t        = self::T_EXT;
		$axis     = $part['axis'];
		$len      = ( 'h' === $axis ? $part['w'] : $part['h'] ) - 2 * $t;   // along the band.
		$depth    = ( 'h' === $axis ? $part['h'] : $part['w'] ) - 2 * $t;   // across.
		$warnings = array();

		$front  = array();
		$garden = array();
		$corr_area = 0.0;
		$stairs = null;
		foreach ( $rooms as $r ) {
			if ( 'corridor' === $r['type'] ) {
				$corr_area += $r['area'];
				$corr_room  = $r;
				continue;
			}
			if ( 'stairs' === $r['type'] ) {
				$stairs = $r;
				continue;
			}
			if ( in_array( $r['type'], self::GARDEN_PREF, true ) ) {
				$garden[] = $r;
			} else {
				$front[] = $r;
			}
		}
		if ( $stairs ) {
			$front[] = $stairs;
		}

		// Balance bands: move night rooms to the front band if the garden band is overfull.
		$sum = static fn( $list ) => array_sum( array_map( static fn( $r ) => (float) $r['area'], $list ) );
		$usable = max( 1.0, $len * $depth );
		$corr_d = empty( $garden ) || empty( $front ) ? 0.0 : max( 1.1, min( 1.6, $corr_area > 0 ? $corr_area / $len : self::CORR ) );
		$avail  = $len * max( 1.0, $depth - $corr_d );
		$guard  = 0;
		while ( $sum( $garden ) > $avail * 0.62 && $guard++ < 20 ) {
			$moved = false;
			for ( $i = count( $garden ) - 1; $i >= 0; $i-- ) {
				if ( in_array( $garden[ $i ]['type'], array( 'bedroom', 'kids', 'guest', 'office', 'playroom', 'gym' ), true ) ) {
					array_unshift( $front, $garden[ $i ] );
					array_splice( $garden, $i, 1 );
					$moved = true;
					break;
				}
			}
			if ( ! $moved ) {
				break;
			}
		}
		if ( empty( $front ) && count( $garden ) > 1 ) {
			$front[] = array_pop( $garden );
		}
		if ( empty( $garden ) && count( $front ) > 1 ) {
			$garden[] = array_shift( $front );
			$corr_d   = $corr_d ?: self::CORR;
		}
		if ( empty( $garden ) || empty( $front ) ) {
			$corr_d = 0.0;
		}

		$sf = $sum( $front );
		$sg = $sum( $garden );
		if ( $memo && $upper ) {
			$fd = $memo['front'];
			$gd = $memo['garden'];
			$cd = $memo['corr'];
			if ( 0.0 === $cd && $corr_d > 0 ) {
				$cd = self::CORR;
				$fd = max( 2.4, $fd - $cd / 2 );
				$gd = $depth - $fd - $cd;
			}
		} else {
			$rem = max( 2.0, $depth - $corr_d );
			$fd  = $sf + $sg > 0 ? $rem * $sf / ( $sf + $sg ) : $rem / 2;
			$fd  = max( empty( $front ) ? 0 : 2.4, min( $rem - ( empty( $garden ) ? 0 : 2.8 ), $fd ) );
			$gd  = $rem - $fd;
			$cd  = $corr_d;
		}

		// Order: night zone and its wet rooms at one end, day zone at the other.
		$order_front  = array( 'bedroom' => 0, 'kids' => 0, 'guest' => 0, 'office' => 1, 'wardrobe' => 2, 'bathroom' => 3, 'laundry' => 4, 'utility' => 5, 'technical' => 6, 'sauna' => 6, 'wellness' => 6, 'wine' => 6, 'custom' => 6, 'gym' => 1, 'playroom' => 1, 'wc' => 7, 'hall' => 8, 'pantry' => 9, 'stairs' => 10 );
		$order_garden = array( 'master' => 0, 'bedroom' => 1, 'kids' => 1, 'guest' => 2, 'office' => 3, 'playroom' => 3, 'gym' => 3, 'dining' => 5, 'living' => 4, 'living_kitchen' => 4, 'kitchen' => 6 );
		usort( $front, static fn( $a, $b ) => ( $order_front[ $a['type'] ] ?? 6 ) <=> ( $order_front[ $b['type'] ] ?? 6 ) );
		usort( $garden, static fn( $a, $b ) => ( $order_garden[ $a['type'] ] ?? 3 ) <=> ( $order_garden[ $b['type'] ] ?? 3 ) );

		$rects    = array();
		$openings = array();
		$walls    = array();

		$place_band = function ( array $list, float $v0, float $bd, string $band ) use ( $len, &$rects, $level ) {
			if ( empty( $list ) || $bd <= 0 ) {
				return;
			}
			// Group narrow rooms into stacked columns. A stack never holds more
			// rooms than the band depth can give MIN_DIM each.
			$max_stack = max( 1, min( 3, (int) floor( $bd / self::MIN_DIM ) ) );
			$cols      = array();
			$cur       = array();
			$cura      = 0.0;
			$flush     = static function () use ( &$cols, &$cur, &$cura, $bd, $max_stack ) {
				if ( empty( $cur ) ) {
					return;
				}
				// A too-narrow pending stack joins the previous column instead of standing alone (if it still fits).
				$prev = end( $cols );
				if ( $cura / $bd < self::MIN_COL && $prev && count( $prev ) + count( $cur ) <= $max_stack && ! in_array( $prev[0]['type'], array( 'hall', 'stairs' ), true ) ) {
					$cols[ count( $cols ) - 1 ] = array_merge( $prev, $cur );
				} else {
					$cols[] = $cur;
				}
				$cur  = array();
				$cura = 0.0;
			};
			foreach ( $list as $r ) {
				$w = $r['area'] / $bd;
				if ( in_array( $r['type'], array( 'hall', 'stairs' ), true ) ) {
					$flush();
					if ( 'hall' === $r['type'] ) {
						$r['area'] = max( $r['area'], 1.9 * $bd );
					}
					$cols[] = array( $r );
					continue;
				}
				if ( $w < self::MIN_COL || ! empty( $cur ) ) {
					$cur[] = $r;
					$cura += $r['area'];
					if ( $cura / $bd >= self::MIN_COL * 1.2 || count( $cur ) >= $max_stack ) {
						$cols[] = $cur;
						$cur    = array();
						$cura   = 0.0;
					}
				} else {
					$cols[] = array( $r );
				}
			}
			$flush();
			// Stairs always close the band so they stay aligned across floors.
			usort(
				$cols,
				static function ( $a, $b ) {
					$sa = 1 === count( $a ) && 'stairs' === $a[0]['type'] ? 1 : 0;
					$sb = 1 === count( $b ) && 'stairs' === $b[0]['type'] ? 1 : 0;
					return $sa <=> $sb;
				}
			);
			$stairs_w = min( 2.8, $len * 0.3 );
			$fixed_w  = 0.0;
			$total    = 0.0;
			foreach ( $cols as $col ) {
				if ( 1 === count( $col ) && 'stairs' === $col[0]['type'] ) {
					$fixed_w += $stairs_w;
					continue;
				}
				$total += array_sum( array_map( static fn( $r ) => $r['area'], $col ) );
			}
			$avail = max( 1.0, $len - $fixed_w );
			// Upper floors: do not inflate rooms beyond +35 %; leave the rest as flexible space.
			if ( $level > 0 && $total > 0 && $avail / ( $total / $bd ) > 1.35 ) {
				$filler_area = $avail * $bd - $total * 1.2;
				if ( $filler_area > 3 ) {
					$filler = array( array( 'id' => 'flex_' . $band . '_' . $level, 'type' => 'custom', 'name' => __( 'Galéria / bővíthető tér', 'autogrowehome' ), 'area' => $filler_area, 'level' => $level, 'zone' => 'circulation', 'render' => false ) );
					$last   = end( $cols );
					if ( $last && 1 === count( $last ) && 'stairs' === $last[0]['type'] ) {
						array_splice( $cols, count( $cols ) - 1, 0, array( $filler ) );
					} else {
						$cols[] = $filler;
					}
					$total += $filler_area;
				}
			}
			$scale = $total > 0 ? $avail / ( $total / $bd ) : 1;
			// Column widths proportional to area, but never below MIN_DIM (the
			// difference is taken from the wider columns).
			$natural = array();
			foreach ( $cols as $ci => $col ) {
				if ( ! ( 1 === count( $col ) && 'stairs' === $col[0]['type'] ) ) {
					$natural[ $ci ] = array_sum( array_map( static fn( $r ) => $r['area'], $col ) ) / $bd * $scale;
				}
			}
			$widths   = self::distribute( $natural, $avail, self::MIN_DIM );
			$u        = 0.0;
			$stairs_i = 0;
			foreach ( $cols as $ci => $col ) {
				$ca        = array_sum( array_map( static fn( $r ) => $r['area'], $col ) );
				$is_stairs = 1 === count( $col ) && 'stairs' === $col[0]['type'];
				$cw        = $is_stairs ? $stairs_w : (float) ( $widths[ $ci ] ?? 0 );
				if ( $is_stairs ) {
					// Stairs always sit at the band end – also on a floor where they are
					// the only room – so they line up vertically on every level.
					$u = $len - $fixed_w + $stairs_i * $stairs_w;
					$stairs_i++;
				}
				// Stack: the room adjacent to the corridor is the access room (first in list order for front band = closest to corridor).
				$vv      = $v0;
				$n       = count( $col );
				$heights = $n > 1 ? self::distribute( array_map( static fn( $r ) => (float) $r['area'], $col ), $bd, self::MIN_DIM ) : array( $bd );
				foreach ( $col as $k => $r ) {
					$rh = $n > 1 ? (float) $heights[ $k ] : $bd;
					$rects[] = array( 'room' => $r, 'u' => $u, 'v' => $vv, 'lu' => $cw, 'lv' => $rh, 'band' => $band, 'stack' => $n > 1 ? $k : -1, 'stack_n' => $n );
					$vv     += $rh;
				}
				$u += $cw;
			}
		};

		$place_band( $front, 0.0, $fd, 'front' );
		$place_band( $garden, $fd + $cd, $gd, 'garden' );

		// Map local (u along band, v across) to model coordinates.
		$ox  = $part['x'] + $t;
		$oy  = $part['y'] + $t;
		$map = static function ( float $u, float $v, float $lu, float $lv ) use ( $axis, $ox, $oy, $len, $mirror ) {
			if ( $mirror ) {
				$u = $len - $u - $lu;
			}
			if ( 'h' === $axis ) {
				return array( $ox + $u, $oy + $v, $lu, $lv );
			}
			return array( $ox + $v, $oy + $u, $lv, $lu );
		};

		$out_rooms = array();
		foreach ( $rects as $rc ) {
			$r                = $rc['room'];
			list( $x, $y, $w, $h ) = $map( $rc['u'], $rc['v'], $rc['lu'], $rc['lv'] );
			// Interior wall thickness: shrink by half on shared sides.
			$ix = $x + self::T_INT / 2;
			$iy = $y + self::T_INT / 2;
			$iw = max( 0.6, $w - self::T_INT );
			$ih = max( 0.6, $h - self::T_INT );
			$area = round( $iw * $ih, 2 );
			$out_rooms[ $r['id'] ] = array(
				'id'     => $r['id'],
				'type'   => $r['type'],
				'name'   => $r['name'],
				'level'  => $level,
				'x'      => round( $ix, 3 ),
				'y'      => round( $iy, 3 ),
				'w'      => round( $iw, 3 ),
				'h'      => round( $ih, 3 ),
				'area'   => $area,
				'target' => round( (float) $r['area'], 2 ),
				'zone'   => $r['zone'] ?? 'day',
				'band'   => $rc['band'],
				'part'   => $part['id'],
				'stack'  => $rc['stack'],
			);
			if ( $iw < 1.2 || $ih < 1.2 ) {
				$warnings[] = sprintf( /* translators: %s: room */ __( '„%s” túl keskeny lett a vázlatban; érdemes a területét növelni.', 'autogrowehome' ), $r['name'] );
			}

			// Doors.
			$door_w = in_array( $r['type'], array( 'wc', 'pantry', 'technical', 'utility' ), true ) ? 0.8 : ( in_array( $r['type'], array( 'living_kitchen', 'living' ), true ) ? 1.2 : 0.9 );
			if ( $cd > 0 ) {
				if ( 'front' === $rc['band'] && ( -1 === $rc['stack'] || $rc['stack'] === $rc['stack_n'] - 1 ) ) {
					$openings[] = self::door_on_edge( $map, $rc, 'v_end', $door_w, $level, $r['id'] );
				} elseif ( 'garden' === $rc['band'] && ( -1 === $rc['stack'] || 0 === $rc['stack'] ) ) {
					$openings[] = self::door_on_edge( $map, $rc, 'v_start', $door_w, $level, $r['id'] );
				}
			}
			if ( $rc['stack'] > -1 && ( ( 'front' === $rc['band'] && $rc['stack'] < $rc['stack_n'] - 1 ) || ( 'garden' === $rc['band'] && $rc['stack'] > 0 ) ) ) {
				// Inner stacked room: door to its access neighbour.
				$openings[] = self::door_on_edge( $map, $rc, 'front' === $rc['band'] ? 'v_end' : 'v_start', 0.8, $level, $r['id'] );
			}

			// Windows on exterior edges.
			$edges = array();
			if ( 'front' === $rc['band'] && 0.0 === (float) $rc['v'] ) {
				$edges[] = 'v_start';
			}
			if ( 'garden' === $rc['band'] && abs( ( $rc['v'] + $rc['lv'] ) - ( $fd + $cd + $gd ) ) < 0.01 ) {
				$edges[] = 'v_end';
			}
			if ( $rc['u'] < 0.01 ) {
				$edges[] = 'u_start';
			}
			if ( abs( $rc['u'] + $rc['lu'] - $len ) < 0.01 ) {
				$edges[] = 'u_end';
			}
			foreach ( $edges as $edge ) {
				$edge_len = in_array( $edge, array( 'v_start', 'v_end' ), true ) ? $rc['lu'] : $rc['lv'];
				foreach ( self::windows_for( $r['type'], $edge, $edge_len, $rc['band'], $is_main && 0 === $level ) as $win ) {
					$o          = self::point_on_edge( $map, $rc, $edge, $win['pos'] );
					$o['type']  = $win['type'];
					$o['width'] = $win['width'];
					$o['level'] = $level;
					$o['room']  = $r['id'];
					$o['side']  = 'ext';
					$openings[] = $o;
				}
			}
		}

		// Entrance door into the hall (or first front room) on the street wall.
		if ( $is_main && 0 === $level ) {
			$hall = null;
			foreach ( $rects as $rc ) {
				if ( 'hall' === $rc['room']['type'] ) {
					$hall = $rc;
				}
			}
			if ( ! $hall ) {
				foreach ( $rects as $rc ) {
					if ( 'front' === $rc['band'] && 0.0 === (float) $rc['v'] ) {
						$hall = $rc;
					}
				}
			}
			if ( $hall ) {
				$o          = self::point_on_edge( $map, $hall, 'v_start', 0.5 );
				$o['type']  = 'entrance';
				$o['width'] = 1.1;
				$o['level'] = 0;
				$o['room']  = $hall['room']['id'];
				$o['side']  = 'ext';
				$openings[] = $o;
			}
		}

		// Corridor as a room (circulation).
		if ( $cd > 0 ) {
			list( $x, $y, $w, $h ) = $map( 0, $fd, $len, $cd );
			$cid = isset( $corr_room ) ? $corr_room['id'] : 'corr_' . $part['id'] . '_' . $level;
			$out_rooms[ $cid ] = array(
				'id'     => $cid,
				'type'   => 'corridor',
				'name'   => isset( $corr_room ) ? $corr_room['name'] : __( 'Közlekedő', 'autogrowehome' ),
				'level'  => $level,
				'x'      => round( $x + self::T_INT / 2, 3 ),
				'y'      => round( $y + self::T_INT / 2, 3 ),
				'w'      => round( $w - self::T_INT, 3 ),
				'h'      => round( $h - self::T_INT, 3 ),
				'area'   => round( ( $w - self::T_INT ) * ( $h - self::T_INT ), 2 ),
				'target' => round( $corr_area, 2 ),
				'zone'   => 'circulation',
				'band'   => 'corridor',
				'part'   => $part['id'],
				'stack'  => -1,
				'computed' => ! isset( $corr_room ),
			);
		}

		// Interior walls: room rectangle outlines (deduplicated in the renderer).
		foreach ( $out_rooms as $r ) {
			$walls[] = array( 'level' => $level, 'x' => $r['x'] - self::T_INT / 2, 'y' => $r['y'] - self::T_INT / 2, 'w' => $r['w'] + self::T_INT, 'h' => $r['h'] + self::T_INT );
		}

		return array(
			'rooms'    => $out_rooms,
			'openings' => $openings,
			'walls'    => $walls,
			'bands'    => array( 'front' => $fd, 'garden' => $gd, 'corr' => $cd ),
			'warnings' => $warnings,
		);
	}

	/**
	 * Split $total proportionally to $weights while giving every item at least
	 * $min ("water filling"). Keys are preserved. When the minimum cannot be
	 * met for all items, the split stays purely proportional.
	 *
	 * @param array<int|string,float> $weights Non-negative weights.
	 * @return array<int|string,float>
	 */
	private static function distribute( array $weights, float $total, float $min ): array {
		$n = count( $weights );
		if ( 0 === $n ) {
			return array();
		}
		$sum = array_sum( $weights );
		if ( $sum <= 0 ) {
			return array_map( static fn() => $total / $n, $weights );
		}
		if ( $total < $n * $min ) {
			return array_map( static fn( $w ) => $total * $w / $sum, $weights );
		}
		$floored = array();
		for ( $i = 0; $i < $n; $i++ ) {
			$free_w     = 0.0;
			foreach ( $weights as $k => $w ) {
				if ( ! isset( $floored[ $k ] ) ) {
					$free_w += $w;
				}
			}
			$free_total = $total - count( $floored ) * $min;
			$changed    = false;
			foreach ( $weights as $k => $w ) {
				if ( ! isset( $floored[ $k ] ) && ( $free_w <= 0 || $free_total * $w / $free_w < $min ) ) {
					$floored[ $k ] = true;
					$changed       = true;
				}
			}
			if ( ! $changed ) {
				break;
			}
		}
		$free_w     = 0.0;
		foreach ( $weights as $k => $w ) {
			if ( ! isset( $floored[ $k ] ) ) {
				$free_w += $w;
			}
		}
		$free_total = $total - count( $floored ) * $min;
		$out        = array();
		foreach ( $weights as $k => $w ) {
			$out[ $k ] = isset( $floored[ $k ] ) ? $min : ( $free_w > 0 ? $free_total * $w / $free_w : 0.0 );
		}
		return $out;
	}

	private static function windows_for( string $type, string $edge, float $len, string $band, bool $ground_main ): array {
		$out = array();
		if ( in_array( $type, array( 'hall', 'corridor', 'pantry', 'technical', 'stairs', 'wine', 'sauna', 'wardrobe' ), true ) ) {
			if ( 'stairs' === $type && $len > 2 ) {
				$out[] = array( 'pos' => 0.5, 'width' => 0.9, 'type' => 'window' );
			}
			return $out;
		}
		if ( in_array( $type, array( 'bathroom', 'wc', 'laundry', 'utility' ), true ) ) {
			if ( in_array( $edge, array( 'v_start', 'v_end' ), true ) && $len > 1.2 ) {
				$out[] = array( 'pos' => 0.5, 'width' => 'wc' === $type ? 0.5 : 0.8, 'type' => 'window' );
			}
			return $out;
		}
		$is_living = in_array( $type, array( 'living_kitchen', 'living', 'dining' ), true );
		if ( $is_living && 'v_end' === $edge && 'garden' === $band && $ground_main ) {
			$n = max( 1, (int) floor( $len / 4.5 ) );
			for ( $i = 0; $i < $n; $i++ ) {
				$out[] = array( 'pos' => ( $i + 0.5 ) / $n, 'width' => min( 3.6, $len / $n - 0.8 ), 'type' => 'sliding' );
			}
			return $out;
		}
		if ( $len < 1.6 ) {
			return $out;
		}
		$n = max( 1, (int) floor( $len / 3.4 ) );
		for ( $i = 0; $i < $n; $i++ ) {
			$out[] = array( 'pos' => ( $i + 0.5 ) / $n, 'width' => min( $is_living ? 2.2 : 1.5, $len / $n - 0.6 ), 'type' => 'window' );
		}
		return $out;
	}

	private static function point_on_edge( callable $map, array $rc, string $edge, float $pos ): array {
		$u = $rc['u'];
		$v = $rc['v'];
		$lu = $rc['lu'];
		$lv = $rc['lv'];
		switch ( $edge ) {
			case 'v_start':
				$pu = $u + $lu * $pos;
				$pv = $v;
				$along = 'u';
				break;
			case 'v_end':
				$pu = $u + $lu * $pos;
				$pv = $v + $lv;
				$along = 'u';
				break;
			case 'u_start':
				$pu = $u;
				$pv = $v + $lv * $pos;
				$along = 'v';
				break;
			default:
				$pu = $u + $lu;
				$pv = $v + $lv * $pos;
				$along = 'v';
		}
		list( $x, $y ) = $map( $pu, $pv, 0, 0 );
		// Orientation of the wall the opening sits in.
		$probe          = $map( $u, $v, $lu, $lv );
		$horizontal_u   = abs( $probe[2] - $lu ) < 0.0001 && abs( $probe[3] - $lv ) < 0.0001;
		$orient         = ( 'u' === $along ) === $horizontal_u ? 'h' : 'v';
		return array( 'x' => round( $x, 3 ), 'y' => round( $y, 3 ), 'orient' => $orient, 'edge' => $edge );
	}

	private static function door_on_edge( callable $map, array $rc, string $edge, float $w, int $level, string $room ): array {
		$pos = 'living_kitchen' === $rc['room']['type'] || 'living' === $rc['room']['type'] ? 0.85 : 0.3;
		$o   = self::point_on_edge( $map, $rc, $edge, $pos );
		$o['type']  = 'door';
		$o['width'] = $w;
		$o['level'] = $level;
		$o['room']  = $room;
		$o['side']  = 'int';
		return $o;
	}

	private static function joint( array $a, array $b ): ?array {
		// Horizontal joint (wing below main).
		$x0 = max( $a['x'], $b['x'] );
		$x1 = min( $a['x'] + $a['w'], $b['x'] + $b['w'] );
		if ( $x1 - $x0 > 1.2 && abs( ( $a['y'] + $a['h'] ) - ( $b['y'] + self::T_EXT ) ) < 0.5 ) {
			return array( 'x' => round( ( $x0 + $x1 ) / 2, 3 ), 'y' => round( $a['y'] + $a['h'] - self::T_EXT / 2, 3 ), 'orient' => 'h' );
		}
		$y0 = max( $a['y'], $b['y'] );
		$y1 = min( $a['y'] + $a['h'], $b['y'] + $b['h'] );
		if ( $y1 - $y0 > 1.2 ) {
			return array( 'x' => round( $a['x'] + $a['w'] - self::T_EXT / 2, 3 ), 'y' => round( ( $y0 + $y1 ) / 2, 3 ), 'orient' => 'v' );
		}
		return null;
	}

	private static function terrace( array $m, float $area ): ?array {
		if ( $area <= 0 ) {
			return null;
		}
		$living = null;
		foreach ( $m['rooms'] as $r ) {
			if ( 0 === $r['level'] && in_array( $r['type'], array( 'living_kitchen', 'living' ), true ) ) {
				$living = $r;
				break;
			}
		}
		$main = $m['parts'][0];
		$y    = $main['y'] + $main['h'];
		$w    = $living ? max( 3.0, min( $main['w'], $living['w'] + 1.0 ) ) : min( $main['w'], max( 3.0, sqrt( $area * 2 ) ) );
		$d    = max( 2.0, min( 5.5, $area / $w ) );
		$w    = $area / $d;
		$x    = $living ? max( $main['x'], min( $main['x'] + $main['w'] - $w, $living['x'] + $living['w'] / 2 - $w / 2 ) ) : $main['x'] + ( $main['w'] - $w ) / 2;
		// Avoid overlapping a wing.
		foreach ( array_slice( $m['parts'], 1 ) as $p ) {
			if ( $p['y'] >= $y - 0.5 && $x < $p['x'] + $p['w'] && $x + $w > $p['x'] ) {
				$x = $p['x'] - $w > $main['x'] ? $p['x'] - $w : $p['x'] + $p['w'];
			}
		}
		return array( 'x' => round( $x, 3 ), 'y' => round( $y, 3 ), 'w' => round( $w, 3 ), 'h' => round( $d, 3 ), 'area' => round( $w * $d, 1 ), 'covered' => true );
	}

	private static function garage( array $m, string $type, bool $mirror ): ?array {
		if ( in_array( $type, array( 'none', '' ), true ) ) {
			return null;
		}
		$main = $m['parts'][0];
		$dims = array(
			'carport'  => array( 3.4, 5.6, 'carport' ),
			'garage_1' => array( 3.8, 6.2, 'garage' ),
			'garage_2' => array( 6.4, 6.2, 'garage' ),
			'separate' => array( 6.4, 6.2, 'garage' ),
		)[ $type ] ?? array( 3.4, 5.6, 'carport' );
		$left = ! $mirror;
		$gap  = 'separate' === $type ? 2.5 : 0.0;
		$x    = $left ? $main['x'] - $dims[0] - $gap : $main['x'] + $main['w'] + $gap;
		return array( 'x' => round( $x, 3 ), 'y' => round( $main['y'], 3 ), 'w' => $dims[0], 'h' => $dims[1], 'kind' => $dims[2], 'attached' => 'separate' !== $type, 'type' => $type );
	}

	private static function roof( array $m, array $c, int $levels, float $storey ): array {
		$type   = (string) ( $c['roof_type'] ?? 'gable' );
		$pitch  = 'flat' === $type ? 2.0 : max( 5.0, (float) ( $c['roof_pitch'] ?? 35 ) );
		$attic  = 'attic' === ( $c['levels'] ?? '' );
		$walls  = $attic ? $storey + 1.0 : $levels * $storey;
		$main   = $m['parts'][0];
		$span   = min( $main['w'], $main['h'] );
		$ridge_dir = $main['w'] >= $main['h'] ? 'x' : 'y';
		$rise   = 0.0;
		switch ( $type ) {
			case 'flat':
				$rise = 0.35;
				break;
			case 'shed':
				$rise = $span * tan( deg2rad( $pitch ) );
				break;
			default:
				$rise = ( $span / 2 ) * tan( deg2rad( $pitch ) );
		}
		$ridge = (float) ( $c['ridge_height'] ?? 0 );
		$base  = 0.45; // plinth above ground.
		if ( $ridge > 0 && 'flat' !== $type ) {
			$rise = max( 0.5, $ridge - $base - $walls );
			$pitch = 'shed' === $type ? rad2deg( atan( $rise / max( 1, $span ) ) ) : rad2deg( atan( $rise / max( 1, $span / 2 ) ) );
		}
		return array(
			'type'        => $type,
			'pitch'       => round( $pitch, 1 ),
			'ridge_dir'   => $ridge_dir,
			'eaves_height'=> round( $base + $walls, 2 ),
			'ridge_height'=> round( $base + $walls + $rise, 2 ),
			'overhang'    => round( (float) ( $c['roof_overhang'] ?? 0.4 ), 2 ),
			'eaves'       => round( (float) ( $c['eaves_depth'] ?? 0.6 ), 2 ),
			'plinth'      => $base,
			'chimney'     => ! empty( $c['chimney'] ),
			'solar'       => ! empty( $c['roof_solar'] ),
			'roof_windows'=> (int) ( $c['roof_windows'] ?? 0 ),
		);
	}

	/* ------------------------------------------------------------------ build mode */

	/** Level name, the same as the generator gives. */
	private static function level_name( int $l, array $c ): string {
		return 0 === $l ? __( 'Földszint', 'autogrowehome' ) : ( ( 'attic' === ( $c['levels'] ?? '' ) ) ? __( 'Tetőtér', 'autogrowehome' ) : sprintf( /* translators: %d: floor */ __( '%d. emelet', 'autogrowehome' ), $l ) );
	}

	/**
	 * The model (same schema) from the build-mode drawing, or null when the drawing cannot be used.
	 *
	 * Coordinates: the drawing has the street at max y; here the front is y = 0, so
	 * server_x = x - bbox_min_x and server_y = bbox_max_y - y (bbox of the outer outline).
	 */
	private static function from_build( array $c, string $variant ): ?array {
		$g = Build::model( $c['build'] );
		if ( empty( $g['ok'] ) || empty( $g['boxes'] ) ) {
			return null;
		}
		$types  = Definitions::room_types();
		$b      = $g['build'];
		$ox     = (float) $g['origin'][0];
		$oy     = (float) $g['origin'][1];
		$big_w  = (float) $g['W'];
		$big_d  = (float) $g['D'];
		$sx     = static fn( float $x ): float => $x - $ox;
		$sy     = static fn( float $y ): float => $oy + $big_d - $y;
		$levels_n = count( $b['levels'] );
		$warnings = array();

		// Parts: the footprint boxes (the first is the main block).
		$parts = array();
		foreach ( $g['boxes'] as $i => $q ) {
			$w       = $q['x1'] - $q['x0'];
			$h       = $q['y1'] - $q['y0'];
			$parts[] = array(
				'id'   => 0 === $i ? 'main' : ( 1 === $i ? 'wing' : 'wing' . $i ),
				'x'    => round( $q['x0'], 3 ),
				'y'    => round( $big_d - $q['y1'], 3 ),
				'w'    => round( $w, 3 ),
				'h'    => round( $h, 3 ),
				'axis' => $w >= $h ? 'h' : 'v',
				'role' => 0 === $i ? 'all' : 'wing',
			);
		}
		$part_at = static function ( float $x, float $y ) use ( $parts ): string {
			foreach ( $parts as $p ) {
				if ( $x >= $p['x'] - 0.01 && $x <= $p['x'] + $p['w'] + 0.01 && $y >= $p['y'] - 0.01 && $y <= $p['y'] + $p['h'] + 0.01 ) {
					return $p['id'];
				}
			}
			return 'main';
		};
		$shape = array( 1 => 'rectangle', 2 => 'l_shape' )[ count( $parts ) ] ?? 'u_shape';
		$ext_t = self::T_EXT;
		foreach ( $b['walls'] as $w ) {
			if ( 'ext' === $w['kind'] ) {
				$ext_t = (float) $w['t'];
				break;
			}
		}
		$model = array(
			'schema'      => 'agh-building-v1',
			'units'       => 'm',
			'variant'     => $variant,
			'shape'       => $shape,
			'shape_label' => array( 'rectangle' => 'simple rectangular', 'l_shape' => 'L-shaped', 'u_shape' => 'U-shaped' )[ $shape ],
			'mirror'      => false,
			't_ext'       => $ext_t,
			't_int'       => self::T_INT,
			'parts'       => $parts,
			'levels'      => array(),
			'rooms'       => array(),
			'openings'    => array(),
			'walls'       => array(),
			'source'      => 'drawing',
		);
		$model['width']  = round( $big_w, 2 );
		$model['length'] = round( $big_d, 2 );

		// Levels: elevation from the foundation top and the drawn level heights.
		$z = (float) $b['found']['top'];
		foreach ( $b['levels'] as $l => $lv ) {
			$model['levels'][] = array(
				'index'     => $l,
				'name'      => self::level_name( $l, $c ),
				'elevation' => round( $z, 2 ),
				'height'    => round( (float) $lv['h'], 2 ),
				'attic'     => false,
			);
			$z += (float) $lv['h'];
		}

		// Rooms: the closed faces of the wall graph as rectangles (their bounding box). Type: the one chosen
		// in the drawing, else the room of the programme at the same place of the level, else living
		// for the largest and bedroom for the others.
		$by_level = array();
		foreach ( (array) ( $c['rooms'] ?? array() ) as $r ) {
			if ( is_array( $r ) && isset( $r['type'] ) ) {
				$by_level[ (int) ( $r['level'] ?? 0 ) ][] = $r;
			}
		}
		$seq  = 0;
		$nth  = array();
		foreach ( $g['rooms'] as $rm ) {
			$lv    = (int) $rm['lv'];
			$i     = $nth[ $lv ] ?? 0;
			$nth[ $lv ] = $i + 1;
			$prog  = $by_level[ $lv ][ $i ] ?? null;
			$type  = (string) $rm['type'];
			if ( '' === $type || ! isset( $types[ $type ] ) ) {
				$type = $prog && isset( $types[ $prog['type'] ] ) ? (string) $prog['type'] : ( 0 === $i ? 'living' : 'bedroom' );
			}
			$name = $prog && $prog['type'] === $type && '' !== (string) ( $prog['name'] ?? '' ) ? (string) $prog['name'] : $types[ $type ][0];
			$id   = 'b' . ( ++$seq );
			$x    = $sx( (float) $rm['bbox']['x0'] );
			$y    = $sy( (float) $rm['bbox']['y1'] );
			$w    = (float) $rm['bbox']['x1'] - (float) $rm['bbox']['x0'];
			$h    = (float) $rm['bbox']['y1'] - (float) $rm['bbox']['y0'];
			$area = round( (float) $rm['area'], 2 );
			$model['rooms'][ $id ] = array(
				'id'     => $id,
				'type'   => $type,
				'name'   => $name,
				'level'  => $lv,
				'x'      => round( $x, 3 ),
				'y'      => round( $y, 3 ),
				'w'      => round( $w, 3 ),
				'h'      => round( $h, 3 ),
				'area'   => $area,
				'target' => $area,
				'zone'   => $types[ $type ][4] ?? 'day',
				'band'   => 'corridor' === $type ? 'corridor' : ( $y + $h / 2 < $big_d / 2 ? 'front' : 'garden' ),
				'part'   => $part_at( $x + $w / 2, $y + $h / 2 ),
				'stack'  => -1,
				'key'    => (string) $rm['key'],
			);
			if ( min( $w, $h ) < 1.2 ) {
				$warnings[] = sprintf( /* translators: %s: room */ __( '„%s” túl keskeny lett a vázlatban; érdemes a területét növelni.', 'autogrowehome' ), $name );
			}
		}
		$nearest_room = static function ( int $lv, float $x, float $y ) use ( &$model ): string {
			$best = '';
			$bd   = INF;
			foreach ( $model['rooms'] as $r ) {
				if ( $r['level'] !== $lv ) {
					continue;
				}
				$dx = max( $r['x'] - $x, 0, $x - ( $r['x'] + $r['w'] ) );
				$dy = max( $r['y'] - $y, 0, $y - ( $r['y'] + $r['h'] ) );
				$d  = $dx * $dx + $dy * $dy;
				if ( $d < $bd ) {
					$bd   = $d;
					$best = $r['id'];
				}
			}
			return $best;
		};

		// Openings: external ones on the inner face of their wall (the generator's convention: the plan
		// shifts them outwards by half the wall), with the edge naming the face; internal doors on the
		// centre line.
		$map = array( 'window' => 'window', 'terrace' => 'sliding', 'door' => 'door', 'entrance' => 'entrance' );
		foreach ( $g['openings'] as $o ) {
			$x      = $sx( (float) $o['x'] );
			$y      = $sy( (float) $o['y'] );
			$orient = 'x' === $o['axis'] ? 'h' : ( 'y' === $o['axis'] ? 'v' : '' );
			$edge   = '';
			$ext    = 'ext' === $o['kind'] && isset( $o['ox'] );
			if ( $ext ) {
				// inner face = the centre line mirrored away from the outer face
				$x = $sx( 2 * (float) $o['x'] - (float) $o['ox'] );
				$y = $sy( 2 * (float) $o['y'] - (float) $o['oy'] );
				if ( isset( $o['out'] ) ) {
					$edge = 'h' === $orient ? ( $o['out'] > 0 ? 'v_start' : 'v_end' ) : ( $o['out'] > 0 ? 'u_end' : 'u_start' );
				}
			}
			if ( '' === $orient ) { // a diagonal wall: the nearer axis
				$w0     = null;
				foreach ( $b['walls'] as $w ) {
					if ( $w['id'] === $o['wall'] ) {
						$w0 = $w;
					}
				}
				$orient = $w0 && abs( $w0['b'][0] - $w0['a'][0] ) >= abs( $w0['b'][1] - $w0['a'][1] ) ? 'h' : 'v';
			}
			$model['openings'][] = array(
				'x'      => round( $x, 3 ),
				'y'      => round( $y, 3 ),
				'orient' => $orient,
				'edge'   => $edge,
				'type'   => $map[ $o['type'] ] ?? 'window',
				'width'  => (float) $o['w'],
				'level'  => (int) $o['lv'],
				'room'   => $nearest_room( (int) $o['lv'], $x, $y ),
				'side'   => $ext ? 'ext' : 'int',
				'height' => (float) $o['h'],
				'sill'   => (float) $o['sill'],
				'id'     => (string) $o['id'],
			);
		}

		// Walls: one rectangle per wall and level (external walls on every level).
		for ( $l = 0; $l < $levels_n; $l++ ) {
			foreach ( $b['walls'] as $w ) {
				if ( 'ext' !== $w['kind'] && (int) $w['lv'] !== $l ) {
					continue;
				}
				$ht = (float) $w['t'] / 2;
				$x0 = $sx( min( (float) $w['a'][0], (float) $w['b'][0] ) ) - $ht;
				$x1 = $sx( max( (float) $w['a'][0], (float) $w['b'][0] ) ) + $ht;
				$y0 = $sy( max( (float) $w['a'][1], (float) $w['b'][1] ) ) - $ht;
				$y1 = $sy( min( (float) $w['a'][1], (float) $w['b'][1] ) ) + $ht;
				$model['walls'][] = array( 'level' => $l, 'x' => round( $x0, 3 ), 'y' => round( $y0, 3 ), 'w' => round( $x1 - $x0, 3 ), 'h' => round( $y1 - $y0, 3 ), 'kind' => $w['kind'], 't' => (float) $w['t'], 'id' => $w['id'] );
			}
		}

		$model['terrace'] = self::terrace( $model, (float) ( $c['terrace_area'] ?? 0 ) );
		$model['garage']  = self::garage( $model, (string) ( $c['garage'] ?? 'none' ), false );

		// Roof: the generator's roof on the main block, raised to the drawn wall heights.
		$walls_h = 0.0;
		foreach ( $b['levels'] as $lv ) {
			$walls_h += (float) $lv['h'];
		}
		$storey = $walls_h / max( 1, $levels_n );
		$roof   = self::roof( $model, $c, $levels_n, $storey );
		$eave   = (float) $b['found']['top'] + $walls_h + ( ! empty( $b['attic'] ) ? 0.9 : 0 );
		$rise   = (float) $roof['ridge_height'] - (float) $roof['eaves_height'];
		$ridge  = (float) ( $c['ridge_height'] ?? 0 );
		if ( $ridge > 0 && 'flat' !== $roof['type'] ) {
			$main  = $parts[0];
			$span  = min( $main['w'], $main['h'] );
			$rise  = max( 0.5, $ridge - $eave );
			$roof['pitch'] = round( 'shed' === $roof['type'] ? rad2deg( atan( $rise / max( 1, $span ) ) ) : rad2deg( atan( $rise / max( 1, $span / 2 ) ) ), 1 );
		}
		$roof['eaves_height'] = round( $eave, 2 );
		$roof['ridge_height'] = round( $eave + $rise, 2 );
		$roof['plinth']       = (float) $b['found']['top'];
		$model['roof']        = $roof;

		// Checks.
		$real_sum = 0.0;
		foreach ( $model['rooms'] as $r ) {
			$real_sum += $r['area'];
		}
		$net  = (float) ( $c['net_area'] ?? $real_sum );
		$diff = $net > 0 ? ( $real_sum - $net ) / $net * 100 : 0;
		if ( abs( $diff ) > 10 ) {
			$warnings[] = sprintf( /* translators: 1: real, 2: requested, 3: pct */ __( 'A tervvázlat helyiségeinek összterülete %1$s m², a kért nettó terület %2$s m² (%3$s%% eltérés).', 'autogrowehome' ), number_format_i18n( $real_sum, 1 ), number_format_i18n( $net, 1 ), number_format_i18n( $diff, 1 ) );
		}
		if ( ! $model['rooms'] ) {
			$warnings[] = __( 'Építési terv: a rajzon még nincs zárt helyiség.', 'autogrowehome' );
		}
		if ( $g['loops'] > 1 ) {
			$warnings[] = __( 'Építési terv: a külső falak több különálló hurkot alkotnak; a terv a legnagyobbat veszi alapul.', 'autogrowehome' );
		}
		if ( $g['seams'] > 0 ) {
			$warnings[] = __( 'Építési terv: egy nyílás két épülettömeg határára esik; a vázlat két részletben mutatja.', 'autogrowehome' );
		}
		$gross = 0.0;
		foreach ( $parts as $p ) {
			$gross += $p['w'] * $p['h'];
		}
		$model['checks'] = array(
			'net_requested' => round( $net, 1 ),
			'net_planned'   => round( $real_sum, 1 ),
			'diff_pct'      => round( $diff, 1 ),
			'footprint'     => round( $gross, 1 ),
			'gross'         => round( $gross * max( 1, $levels_n ), 1 ),
			'warnings'      => array_values( array_unique( $warnings ) ),
		);
		$model['meta'] = array(
			'generator'  => 'AutoGroweHome ' . AGH_VERSION,
			'source'     => 'build',
			'disclaimer' => 'Conceptual sketch generated from the build-mode drawing. Not a permit, structural or construction document; must be verified by a licensed designer.',
		);
		return $model;
	}
}
