<?php
/**
 * Room programme: automatic proposal from the basic parameters and sanitizing
 * of user-edited rooms.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Params;

use AutoGroweHome\Support\Util;

defined( 'ABSPATH' ) || exit;

final class RoomProgram {

	public const MAX_ROOMS = 40;

	public static function level_count( array $c ): int {
		$map = array( 'single' => 1, 'attic' => 2, 'two' => 2, 'three' => 3 );
		return $map[ $c['levels'] ?? 'single' ] ?? 1;
	}

	/**
	 * Propose a room programme from the basic data.
	 */
	public static function auto( array $c ): array {
		$types    = Definitions::room_types();
		$net      = max( 25.0, (float) ( $c['net_area'] ?? 120 ) );
		$beds     = max( 0, (int) ( $c['bedrooms'] ?? 3 ) );
		$baths    = max( 1, (int) ( $c['bathrooms'] ?? 1 ) );
		$levels   = self::level_count( $c );
		$open     = ! empty( $c['open_plan'] );
		$upper    = $levels > 1 ? 1 : 0;
		$rooms    = array();
		$add      = static function ( string $type, int $level, float $area, string $name = '' ) use ( &$rooms, $types ) {
			$rooms[] = array(
				'type'   => $type,
				'name'   => '' !== $name ? $name : $types[ $type ][0],
				'area'   => $area,
				'level'  => $level,
				'render' => (bool) $types[ $type ][3],
			);
		};

		$add( 'hall', 0, $net >= 150 ? 8 : 5 );
		if ( $open ) {
			$add( 'living_kitchen', 0, max( 24, $net * 0.30 ) );
		} else {
			$add( 'living', 0, max( 16, $net * 0.18 ) );
			$add( 'kitchen', 0, max( 8, $net * 0.08 ) );
			$add( 'dining', 0, max( 8, $net * 0.07 ) );
		}
		if ( ! empty( $c['pantry_link'] ) && $net >= 70 ) {
			$add( 'pantry', 0, 3 );
		}
		if ( $net >= 85 || $levels > 1 ) {
			$add( 'wc', 0, 2 );
		}
		if ( $net >= 75 ) {
			$add( 'utility', 0, 4 );
		}
		if ( ! empty( $c['technical_room'] ) && $net >= 100 ) {
			$add( 'technical', 0, 4.5 );
		}
		if ( $levels > 1 ) {
			for ( $l = 0; $l < $levels; $l++ ) {
				$add( 'stairs', $l, 6 );
			}
		}

		$night_level = $upper;
		if ( $beds > 0 ) {
			$add( 'master', $night_level, $net >= 140 ? 16 : 13.5 );
			for ( $i = 1; $i < $beds; $i++ ) {
				$level = ( 3 === $levels && $i >= 3 ) ? 2 : $night_level;
				$add( 'bedroom', $level, $net >= 140 ? 12.5 : 11, sprintf( /* translators: %d: bedroom number */ __( 'Hálószoba %d', 'autogrowehome' ), $i + 1 ) );
			}
		}
		for ( $i = 0; $i < $baths; $i++ ) {
			$level = ( 0 === $i ) ? $night_level : ( $levels > 1 && 1 === $i ? 0 : $night_level );
			$add( 'bathroom', $level, 0 === $i ? ( $net >= 140 ? 8 : 6.5 ) : 5, $i > 0 ? sprintf( /* translators: %d: bathroom number */ __( 'Fürdőszoba %d', 'autogrowehome' ), $i + 1 ) : '' );
		}
		if ( $net >= 130 && $beds > 0 ) {
			$add( 'wardrobe', $night_level, 4.5 );
		}
		if ( $net >= 160 ) {
			$add( 'office', 0, 10 );
		}
		if ( $beds > 1 || $levels > 1 ) {
			for ( $l = 0; $l < $levels; $l++ ) {
				$add( 'corridor', $l, $l === 0 ? 5 : 4 );
			}
		}
		// the basement is its own level (-1): the plant room, storage, the laundry and, on a hillside, a wine cellar
		if ( ! empty( $c['basement'] ) ) {
			$full = ( $c['basement_type'] ?? 'partial' ) !== 'partial';
			$add( 'stairs', -1, 6 );
			$add( 'technical', -1, 6, __( 'Pince – gépészet', 'autogrowehome' ) );
			$add( 'pantry', -1, $full ? 12 : 8, __( 'Pince – tároló', 'autogrowehome' ) );
			if ( $full ) {
				$add( 'laundry', -1, 7, __( 'Pince – mosókonyha', 'autogrowehome' ) );
			}
			if ( $full || ( $c['landscape'] ?? '' ) === 'vineyard' || ( $c['arch_style'] ?? '' ) === 'wine_cellar' ) {
				$add( 'wine', -1, $full ? 10 : 7, __( 'Borospince', 'autogrowehome' ) );
			}
		}
		// an unused attic is a room of its own too: the roof truss, the ladder and the attic window
		if ( ( $c['attic_use'] ?? 'auto' ) === 'storage' || ( ( $c['attic_use'] ?? 'auto' ) === 'auto' && ( $c['levels'] ?? 'single' ) !== 'attic' && ( $c['roof_type'] ?? 'gable' ) !== 'flat' ) ) {
			$add( 'attic', $levels, max( 12, $net * 0.12 ), __( 'Padlás', 'autogrowehome' ) );
		}

		// Scale to the requested net area (keep circulation & wet rooms close to their sizes).
		$sum = array_sum( wp_list_pluck( $rooms, 'area' ) );
		if ( $sum > 0 ) {
			$flex_types = array( 'living_kitchen', 'living', 'kitchen', 'dining', 'master', 'bedroom', 'office' );
			$flex_sum   = 0.0;
			foreach ( $rooms as $r ) {
				if ( in_array( $r['type'], $flex_types, true ) ) {
					$flex_sum += $r['area'];
				}
			}
			$fixed  = $sum - $flex_sum;
			$factor = $flex_sum > 0 ? max( 0.6, ( $net - $fixed ) / $flex_sum ) : 1;
			foreach ( $rooms as &$r ) {
				if ( in_array( $r['type'], $flex_types, true ) ) {
					$r['area'] = $r['area'] * $factor;
				}
				$r['area'] = round( max( $types[ $r['type'] ][5], $r['area'] ) * 2 ) / 2;
			}
			unset( $r );
		}

		foreach ( $rooms as $i => &$r ) {
			$r['id'] = 'r' . ( $i + 1 );
		}
		unset( $r );
		return $rooms;
	}

	/**
	 * Sanitize a user-provided room list.
	 */
	public static function sanitize( $rooms, int $max_level = 2, bool $basement = false ): array {
		if ( ! is_array( $rooms ) ) {
			return array();
		}
		$types   = Definitions::room_types();
		$styles  = Definitions::interior_styles();
		$out     = array();
		$seen    = array();
		foreach ( array_slice( array_values( $rooms ), 0, self::MAX_ROOMS ) as $i => $r ) {
			if ( ! is_array( $r ) ) {
				continue;
			}
			$type = isset( $types[ $r['type'] ?? '' ] ) ? $r['type'] : 'custom';
			$id   = preg_replace( '/[^a-z0-9_]/', '', strtolower( (string) ( $r['id'] ?? '' ) ) );
			if ( '' === $id || isset( $seen[ $id ] ) ) {
				$id = 'r' . ( $i + 1 ) . '_' . substr( md5( (string) $i . $type ), 0, 4 );
			}
			$seen[ $id ] = true;
			$room        = array(
				'id'     => $id,
				'type'   => $type,
				'name'   => Util::clean_text( $r['name'] ?? $types[ $type ][0], 60 ) ?: $types[ $type ][0],
				'area'   => self::num( $r['area'] ?? $types[ $type ][2], 1, 250 ),
				// level -1 is the basement: only kept when the house has one
				'level'  => (int) max( $basement ? -1 : 0, min( $max_level, (int) ( $r['level'] ?? 0 ) ) ),
				'render' => ! empty( $r['render'] ),
			);
			foreach ( array( 'width', 'length' ) as $dim ) {
				if ( isset( $r[ $dim ] ) && '' !== $r[ $dim ] && (float) $r[ $dim ] > 0 ) {
					$room[ $dim ] = self::num( $r[ $dim ], 0.8, 30 );
				}
			}
			if ( isset( $r['ceiling_height'] ) && (float) $r['ceiling_height'] > 0 ) {
				$room['ceiling_height'] = self::num( $r['ceiling_height'], 2.2, 8 );
			}
			foreach ( array( 'floor', 'wall', 'ceiling', 'lighting', 'furniture', 'decor', 'curtains', 'doors', 'windows', 'electrical', 'heating', 'notes' ) as $txt ) {
				if ( isset( $r[ $txt ] ) && '' !== $r[ $txt ] ) {
					$room[ $txt ] = Util::clean_text( $r[ $txt ], 'notes' === $txt ? 400 : 120 );
				}
			}
			foreach ( array( 'wall_color', 'furniture_color' ) as $col ) {
				if ( ! empty( $r[ $col ] ) && preg_match( '/^#[0-9a-fA-F]{6}$/', (string) $r[ $col ] ) ) {
					$room[ $col ] = strtoupper( $r[ $col ] );
				}
			}
			if ( ! empty( $r['interior_style'] ) && isset( $styles[ $r['interior_style'] ] ) ) {
				$room['interior_style'] = $r['interior_style'];
			}
			$out[] = $room;
		}
		return $out;
	}

	private static function num( $v, float $min, float $max ): float {
		$v = is_numeric( $v ) ? (float) $v : $min;
		return round( max( $min, min( $max, $v ) ), 2 );
	}
	/**
	 * Where every household item (extra furniture, electronics, pets) stands: room id => item values.
	 * The visitor's own placement ("room_items") first – an item may stand in several rooms –, every item
	 * not placed yet goes to one fitting room. Mirrors roomItems() of assets/js/agh-sketch.js.
	 */
	public static function item_rooms( array $c ): array {
		$rooms = array();
		foreach ( (array) ( $c['rooms'] ?? array() ) as $r ) {
			if ( is_array( $r ) && ! empty( $r['type'] ) ) {
				$id = (string) ( ! empty( $r['id'] ) ? $r['id'] : $r['type'] );
				if ( ! isset( $rooms[ $id ] ) ) {
					$rooms[ $id ] = (string) $r['type'];
				}
			}
		}
		if ( ! $rooms ) {
			foreach ( array( 'living_kitchen', 'master', 'bathroom' ) as $tp ) {
				$rooms[ 'virtual:' . $tp ] = $tp;
			}
		}
		$all  = array_merge( (array) ( $c['extra_furniture'] ?? array() ), (array) ( $c['electronics'] ?? array() ), (array) ( $c['pets'] ?? array() ) );
		$out  = array();
		$done = array();
		$put  = static function ( string $id, string $k ) use ( &$out, &$done ) {
			$out[ $id ] = $out[ $id ] ?? array();
			if ( ! in_array( $k, $out[ $id ], true ) ) {
				$out[ $id ][] = $k;
			}
			$done[ $k ] = true;
		};
		$ex = $c['room_items'] ?? null;
		if ( is_array( $ex ) ) {
			foreach ( $ex as $id => $items ) {
				$id = (string) $id;
				if ( ! isset( $rooms[ $id ] ) || ! is_array( $items ) ) {
					continue;
				}
				foreach ( $items as $k ) {
					if ( in_array( $k, $all, true ) ) {
						$put( $id, (string) $k );
					}
				}
			}
		}
		$liv  = array( 'living', 'living_kitchen' );
		$home = array(
			'bookshelf'     => array( 'living', 'living_kitchen', 'office', 'kids' ),
			'sideboard'     => array( 'dining', 'living', 'living_kitchen' ),
			'desk'          => array( 'office', 'kids', 'bedroom', 'guest', 'master' ),
			'reading'       => array( 'living', 'living_kitchen', 'master', 'bedroom' ),
			'piano'         => array( 'living', 'living_kitchen', 'dining' ),
			'bar_cart'      => array( 'living', 'living_kitchen', 'dining' ),
			'bench'         => array( 'hall', 'master', 'bedroom' ),
			'plant_stand'   => array( 'living', 'living_kitchen', 'dining', 'hall' ),
			'floor_mirror'  => array( 'master', 'bedroom', 'hall', 'wardrobe' ),
			'chest'         => array( 'master', 'bedroom', 'guest', 'kids', 'hall' ),
			'vitrine'       => array( 'dining', 'living', 'living_kitchen' ),
			'pouf'          => array( 'living', 'living_kitchen', 'master', 'bedroom' ),
			'wall_shelf'    => array( 'living', 'living_kitchen', 'office', 'kids', 'hall' ),
			'aquarium'      => array( 'living', 'living_kitchen', 'office', 'hall' ),
			'computer'      => array( 'office', 'kids', 'bedroom', 'guest', 'master' ),
			'laptop'        => array( 'office', 'living', 'living_kitchen', 'master' ),
			'smart_panel'   => array( 'hall', 'living', 'living_kitchen' ),
			'robot_vacuum'  => $liv,
			'smart_speaker' => array_merge( $liv, array( 'kitchen' ) ),
		);
		foreach ( $all as $k ) {
			$k = (string) $k;
			if ( isset( $done[ $k ] ) ) {
				continue;
			}
			$target = null;
			foreach ( $home[ $k ] ?? $liv as $tp ) {
				$hit = array_search( $tp, $rooms, true );
				if ( false !== $hit ) {
					$target = (string) $hit;
					break;
				}
			}
			if ( null === $target ) {
				foreach ( $rooms as $id => $tp ) {
					if ( in_array( $tp, $liv, true ) ) {
						$target = (string) $id;
						break;
					}
				}
			}
			if ( null === $target ) {
				$target = (string) array_key_first( $rooms );
			}
			$put( $target, $k );
		}
		return $out;
	}
}
