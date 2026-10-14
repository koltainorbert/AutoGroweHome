<?php
/**
 * Field sanitizing and cross-parameter consistency checks.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Params;

use AutoGroweHome\Catalog\Catalog;
use AutoGroweHome\Support\Util;

defined( 'ABSPATH' ) || exit;

final class Validator {

	/**
	 * Sanitize a full configuration coming from the client. Unknown keys are dropped.
	 */
	public static function sanitize( $raw ): array {
		$raw    = is_array( $raw ) ? $raw : array();
		$fields = Registry::fields();
		$out    = array();
		foreach ( $fields as $id => $def ) {
			if ( 'rooms' === $def['type'] ) {
				continue;
			}
			$value      = array_key_exists( $id, $raw ) ? $raw[ $id ] : $def['default'];
			$out[ $id ] = self::sanitize_value( $def, $value );
		}
		$levels       = RoomProgram::level_count( $out );
		$out['rooms'] = RoomProgram::sanitize( $raw['rooms'] ?? array(), $levels - 1, ! empty( $out['basement'] ) );
		if ( empty( $out['rooms'] ) ) {
			$out['rooms'] = RoomProgram::auto( $out );
		}
		$out = self::apply_roof_brand( $out );
		$explicit = array();
		if ( isset( $raw['_explicit'] ) && is_array( $raw['_explicit'] ) ) {
			foreach ( $raw['_explicit'] as $k ) {
				$k = sanitize_key( $k );
				if ( isset( $fields[ $k ] ) ) {
					$explicit[] = $k;
				}
			}
		}
		$out['_explicit'] = array_values( array_unique( $explicit ) );
		return $out;
	}

	/**
	 * Mandatory roof brand (spec: BRAMAC). For every pitched roof the brand
	 * flagged "required" in the catalogue is binding and one of its product
	 * lines is always set: when the visitor chose none (or one of another
	 * brand), the catalogue's recommended product – or the one closest to the
	 * chosen roof colour – is selected. The automatic choices are listed in
	 * "_auto" and reported by check() as information, never as an error.
	 * Flat roofs have no tiles, so nothing is enforced there.
	 */
	private static function apply_roof_brand( array $out ): array {
		$out['_auto'] = array();
		if ( 'flat' === ( $out['roof_type'] ?? '' ) ) {
			return $out;
		}
		$brand = Catalog::required_brand();
		if ( null === $brand ) {
			return $out;
		}
		if ( $brand !== ( $out['roof_brand'] ?? '' ) ) {
			if ( '' !== (string) ( $out['roof_brand'] ?? '' ) ) {
				$out['_auto'][] = 'roof_brand';
			}
			$out['roof_brand'] = $brand;
		}
		$product = '' !== (string) ( $out['roof_product'] ?? '' ) ? Catalog::get( 'roof_product', (string) $out['roof_product'] ) : null;
		if ( ! $product || 'published' !== $product['status'] || ( $product['data']['brand'] ?? '' ) !== $brand ) {
			$default = Catalog::default_roof_product( $brand, (string) ( $out['roof_color'] ?? '' ) );
			if ( $default ) {
				$out['roof_product'] = (string) $default['slug'];
				$out['_auto'][]      = 'roof_product';
			}
		}
		return $out;
	}

	/**
	 * @param array $def   Field definition.
	 * @param mixed $value Raw value.
	 * @return mixed
	 */
	public static function sanitize_value( array $def, $value ) {
		switch ( $def['type'] ) {
			case 'toggle':
				return filter_var( $value, FILTER_VALIDATE_BOOLEAN );
			case 'integer':
				$v = is_numeric( $value ) ? (int) round( (float) $value ) : (int) ( $def['default'] ?? 0 );
				return (int) max( $def['min'] ?? PHP_INT_MIN, min( $def['max'] ?? PHP_INT_MAX, $v ) );
			case 'number':
			case 'range':
				$v = is_numeric( $value ) ? (float) $value : (float) ( $def['default'] ?? 0 );
				$v = max( (float) ( $def['min'] ?? -INF ), min( (float) ( $def['max'] ?? INF ), $v ) );
				return round( $v, 2 );
			case 'color':
				$v = is_string( $value ) ? trim( $value ) : '';
				return preg_match( '/^#[0-9a-fA-F]{6}$/', $v ) ? strtoupper( $v ) : (string) ( $def['default'] ?? '#FFFFFF' );
			case 'select':
			case 'cards':
				$v = is_scalar( $value ) ? (string) $value : '';
				return isset( $def['options'][ $v ] ) ? $v : (string) $def['default'];
			case 'image':
				// A small picture chosen in the browser (downscaled there to a JPEG/PNG/WebP data URL).
				$v = is_string( $value ) ? trim( $value ) : '';
				return ( strlen( $v ) <= 400000 && preg_match( '#^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$#', $v ) ) ? $v : '';
			case 'roomitems':
				// room id => household items (only values of the furniture, electronics and pets fields)
				$fields = Registry::fields();
				$ok     = array();
				foreach ( array( 'extra_furniture', 'electronics', 'pets' ) as $src ) {
					$ok += (array) ( $fields[ $src ]['options'] ?? array() );
				}
				$out = array();
				foreach ( is_array( $value ) ? array_slice( $value, 0, 60, true ) : array() as $room => $items ) {
					$room = (string) $room;
					if ( ! preg_match( '/^[A-Za-z0-9_:\-]{1,64}$/', $room ) || ! is_array( $items ) ) {
						continue;
					}
					$list = array();
					foreach ( $items as $it ) {
						$it = is_scalar( $it ) ? (string) $it : '';
						if ( isset( $ok[ $it ] ) && ! in_array( $it, $list, true ) ) {
							$list[] = $it;
						}
					}
					$out[ $room ] = $list;
				}
				return $out;
			case 'catalog':
				$v = is_scalar( $value ) ? sanitize_key( (string) $value ) : '';
				return ( '' === $v || Catalog::exists( $def['catalog'], $v ) ) ? $v : '';
			case 'multiselect':
				$vals = is_array( $value ) ? $value : array();
				$out  = array();
				foreach ( $vals as $v ) {
					$v = is_scalar( $v ) ? (string) $v : '';
					if ( isset( $def['options'][ $v ] ) ) {
						$out[] = $v;
					}
				}
				$out = array_values( array_unique( $out ) );
				if ( ! empty( $def['max_items'] ) ) {
					$out = array_slice( $out, 0, (int) $def['max_items'] );
				}
				return $out;
			case 'textarea':
				return Util::clean_text( $value, (int) ( $def['max'] ?? 1500 ) );
			case 'text':
			default:
				$v = sanitize_text_field( is_scalar( $value ) ? (string) $value : '' );
				$v = function_exists( 'mb_substr' ) ? mb_substr( $v, 0, (int) ( $def['max'] ?? 200 ) ) : substr( $v, 0, (int) ( $def['max'] ?? 200 ) );
				if ( ! empty( $def['pattern'] ) && '' !== $v && ! preg_match( '/' . str_replace( '/', '\/', $def['pattern'] ) . '/u', $v ) ) {
					return (string) $def['default'];
				}
				return $v;
		}
	}

	public static function visible( array $def, array $c ): bool {
		if ( empty( $def['show_if'] ) || ! is_array( $def['show_if'] ) ) {
			return true;
		}
		$s   = $def['show_if'];
		$cur = $c[ $s['field'] ] ?? null;
		switch ( $s['op'] ?? '=' ) {
			case '!=':
				return (string) $cur !== (string) $s['value'];
			case '>':
				return (float) $cur > (float) $s['value'];
			case '<':
				return (float) $cur < (float) $s['value'];
			case 'in':
				// on a multiselect the field holds a list: it is enough if one of the values is in it
				if ( is_array( $cur ) ) {
					foreach ( $cur as $one ) {
						if ( in_array( (string) $one, array_map( 'strval', (array) $s['value'] ), true ) ) {
							return true;
						}
					}
					return false;
				}
				return in_array( (string) $cur, array_map( 'strval', (array) $s['value'] ), true );
			default:
				return (string) $cur === (string) $s['value'];
		}
	}

	/**
	 * Consistency checks. Errors block generation, warnings/info are shown.
	 *
	 * @return array{errors:array,warnings:array,info:array,metrics:array}
	 */
	public static function check( array $c ): array {
		$e = array();
		$w = array();
		$i = array();
		$push = static function ( array &$list, string $field, string $code, string $msg ) {
			$list[] = array( 'field' => $field, 'code' => $code, 'message' => $msg );
		};

		foreach ( Registry::fields() as $id => $def ) {
			if ( ! empty( $def['required'] ) && empty( $def['hidden'] ) && self::visible( $def, $c ) ) {
				$v = $c[ $id ] ?? null;
				if ( null === $v || '' === $v || ( is_array( $v ) && 'rooms' !== $def['type'] && empty( $v ) ) ) {
					$push( $e, $id, 'required', sprintf( /* translators: %s: field label */ __( 'Kötelező mező: %s', 'autogrowehome' ), $def['label'] ) );
				}
			}
		}

		$net     = (float) ( $c['net_area'] ?? 0 );
		$gross   = (float) ( $c['gross_area'] ?? 0 );
		$levels  = RoomProgram::level_count( $c );
		$beds    = (int) ( $c['bedrooms'] ?? 0 );
		$baths   = (int) ( $c['bathrooms'] ?? 0 );
		$occ     = (int) ( $c['occupants'] ?? 0 );
		$bw      = (float) ( $c['building_width'] ?? 0 );
		$bl      = (float) ( $c['building_length'] ?? 0 );
		$pw      = (float) ( $c['plot_width'] ?? 0 );
		$pl      = (float) ( $c['plot_length'] ?? 0 );
		$plot    = (float) ( $c['plot_area'] ?? 0 );
		$roof    = (string) ( $c['roof_type'] ?? 'gable' );
		$rooms   = is_array( $c['rooms'] ?? null ) ? $c['rooms'] : array();
		$room_sum = array_sum( array_map( static fn( $r ) => (float) ( $r['area'] ?? 0 ), $rooms ) );

		if ( $gross > 0 && $net > $gross ) {
			$push( $e, 'gross_area', 'net_gt_gross', __( 'A nettó alapterület nem lehet nagyobb a bruttónál.', 'autogrowehome' ) );
		}
		$min_needed = 22 + $beds * 9 + $baths * 3.5;
		if ( $net > 0 && $net < $min_needed ) {
			$push( $e, 'net_area', 'too_small', sprintf( /* translators: %s: area */ __( 'A megadott helyiségszámhoz legalább kb. %s m² hasznos alapterület szükséges.', 'autogrowehome' ), number_format_i18n( $min_needed ) ) );
		}
		if ( $bw > 0 && $bl > 0 ) {
			$footprint = $bw * $bl;
			$expected  = ( $gross > 0 ? $gross : $net * 1.15 ) / max( 1, ( 'attic' === ( $c['levels'] ?? '' ) ? 1.6 : $levels ) );
			if ( abs( $footprint - $expected ) / max( 1, $expected ) > 0.25 ) {
				$push( $w, 'building_width', 'footprint_mismatch', sprintf( /* translators: 1: footprint, 2: expected */ __( 'Az épület befoglaló mérete (%1$s m²) jelentősen eltér a területből adódó kb. %2$s m²-től.', 'autogrowehome' ), number_format_i18n( $footprint, 1 ), number_format_i18n( $expected, 1 ) ) );
			}
			if ( $pw > 0 && $bw > $pw - 6 ) {
				$push( $e, 'building_width', 'too_wide', __( 'Az épület nem fér el a telek szélességén a szokásos oldalkertekkel (2×3 m).', 'autogrowehome' ) );
			}
			if ( $pl > 0 && $bl > $pl - 10 ) {
				$push( $w, 'building_length', 'too_long', __( 'Az épület hossza a telekmélységhez képest nagy, kevés előkert/hátsókert marad.', 'autogrowehome' ) );
			}
		}
		if ( $pw > 0 && $pl > 0 && $plot > 0 && abs( $pw * $pl - $plot ) / $plot > 0.2 ) {
			$push( $w, 'plot_area', 'plot_mismatch', __( 'A telek szélessége × hosszúsága nem egyezik a megadott telekterülettel.', 'autogrowehome' ) );
		}
		if ( $plot > 0 && $net > 0 ) {
			$foot = ( $gross > 0 ? $gross : $net * 1.15 ) / $levels;
			if ( $foot / $plot > 0.45 ) {
				$push( $w, 'plot_area', 'coverage', sprintf( /* translators: %s: percent */ __( 'A beépítettség kb. %s%% – a helyi szabályozás ennél jellemzően kevesebbet enged, ellenőrizd.', 'autogrowehome' ), number_format_i18n( $foot / $plot * 100 ) ) );
			}
		}
		if ( $beds > $occ + 2 ) {
			$push( $w, 'bedrooms', 'beds_vs_occupants', __( 'A hálószobák száma jóval több, mint a lakók száma.', 'autogrowehome' ) );
		}
		if ( $occ > $beds * 2 + 1 && $beds > 0 ) {
			$push( $w, 'occupants', 'crowded', __( 'Kevés hálószoba jut a lakók számához.', 'autogrowehome' ) );
		}
		if ( $baths > $beds + 2 ) {
			$push( $w, 'bathrooms', 'baths_vs_beds', __( 'A fürdőszobák száma szokatlanul magas a hálószobákhoz képest.', 'autogrowehome' ) );
		}
		if ( 'flat' === $roof ) {
			if ( ( (int) ( $c['roof_windows'] ?? 0 ) ) > 0 || ( (int) ( $c['dormers'] ?? 0 ) ) > 0 ) {
				$push( $w, 'roof_windows', 'flat_roof_windows', __( 'Lapostetőn tetősík- és kutyaólablak nem értelmezhető; helyette felülvilágítót javasolunk.', 'autogrowehome' ) );
			}
			if ( 'attic' === ( $c['levels'] ?? '' ) ) {
				$push( $e, 'levels', 'attic_flat', __( 'Tetőtér-beépítés lapostetővel nem valósítható meg. Válassz magastetőt vagy kétszintes házat.', 'autogrowehome' ) );
			}
			if ( in_array( $c['roof_surface'] ?? '', array( 'glazed', 'satin' ), true ) ) {
				$push( $i, 'roof_surface', 'flat_surface', __( 'Lapostetőnél a felület várhatóan kavicsolt vagy zöldtető lesz.', 'autogrowehome' ) );
			}
		} else {
			$pitch = (float) ( $c['roof_pitch'] ?? 35 );
			if ( $pitch < 15 && in_array( $roof, array( 'gable', 'hip', 'half_hip', 'pyramid' ), true ) ) {
				$push( $w, 'roof_pitch', 'low_pitch', __( 'Cserépfedéshez 15° alatti hajlásszög általában nem megfelelő.', 'autogrowehome' ) );
			}
			if ( 'attic' === ( $c['levels'] ?? '' ) && $pitch < 35 ) {
				$push( $w, 'roof_pitch', 'attic_pitch', __( 'Tetőtér-beépítéshez legalább kb. 35–45° hajlásszög ajánlott.', 'autogrowehome' ) );
			}
			if ( 'green' === ( $c['roof_surface'] ?? '' ) && $pitch > 25 ) {
				$push( $w, 'roof_surface', 'green_pitch', __( 'Zöldtető meredek tetőn nem jellemző.', 'autogrowehome' ) );
			}
			if ( 'gravel' === ( $c['roof_surface'] ?? '' ) ) {
				$push( $e, 'roof_surface', 'gravel_pitched', __( 'Kavicsolt felület csak lapostetőn lehetséges.', 'autogrowehome' ) );
			}
			// Mandatory roof brand (see apply_roof_brand()): information only.
			$auto  = (array) ( $c['_auto'] ?? array() );
			$brand = Catalog::get( 'roof_brand', (string) ( $c['roof_brand'] ?? '' ) );
			if ( $brand && in_array( 'roof_brand', $auto, true ) ) {
				$push( $i, 'roof_brand', 'roof_brand_required', sprintf( /* translators: %s: roof brand */ __( 'A tetőfedés márkája kötelezően %s, ezért erre állítottuk.', 'autogrowehome' ), $brand['name'] ) );
			}
			$product = Catalog::get( 'roof_product', (string) ( $c['roof_product'] ?? '' ) );
			if ( $brand && $product && in_array( 'roof_product', $auto, true ) ) {
				$push( $i, 'roof_product', 'roof_product_auto', sprintf( /* translators: 1: roof brand, 2: product */ __( 'Tetőfedés: nem választottál terméket, ezért a(z) %1$s kínálatából a(z) „%2$s” került a tervbe. A Tető lépésben másikat is választhatsz.', 'autogrowehome' ), $brand['name'], $product['name'] ) );
			}
		}
		if ( ! empty( $c['balcony'] ) && 'single' === ( $c['levels'] ?? '' ) ) {
			$push( $w, 'balcony', 'balcony_single', __( 'Földszintes háznál erkély nem értelmezhető.', 'autogrowehome' ) );
		}
		if ( ! empty( $c['accessible'] ) && $levels > 1 ) {
			$push( $w, 'accessible', 'accessible_levels', __( 'Akadálymentes, többszintes háznál lift vagy földszinti hálószoba + fürdő szükséges.', 'autogrowehome' ) );
		}
		if ( ! empty( $c['accessible'] ) && ! empty( $c['exterior_steps'] ) ) {
			$push( $e, 'exterior_steps', 'accessible_steps', __( 'Akadálymentes bejárathoz nem választható külső lépcső (rámpa szükséges).', 'autogrowehome' ) );
		}
		$garden = (array) ( $c['garden_features'] ?? array() );
		if ( in_array( 'pool', $garden, true ) && $plot > 0 && $plot < 500 ) {
			$push( $w, 'garden_features', 'pool_plot', __( 'Kis telekre medence csak korlátozottan fér el.', 'autogrowehome' ) );
		}
		$energy = (array) ( $c['energy'] ?? array() );
		if ( in_array( 'ev_charger', $energy, true ) && 'none' === ( $c['garage'] ?? '' ) ) {
			$push( $i, 'energy', 'ev_no_garage', __( 'Az autótöltő a bejáró mellett, falra szerelve jelenik meg.', 'autogrowehome' ) );
		}
		if ( in_array( 'solar', $energy, true ) && empty( $c['roof_solar'] ) ) {
			$push( $i, 'roof_solar', 'solar_hint', __( 'Napelemigényt jelöltél – a tetőn is megjeleníthetők („Napelemek a tetőn”).', 'autogrowehome' ) );
		}
		if ( 'north' === ( $c['orientation'] ?? '' ) ) {
			$push( $i, 'orientation', 'north', __( 'Északi kertoldal: a nappali kevés közvetlen napfényt kap.', 'autogrowehome' ) );
		}
		if ( ! empty( $c['roof_solar'] ) && 'north' === ( $c['orientation'] ?? '' ) && 'shed' === $roof ) {
			$push( $w, 'roof_solar', 'solar_north', __( 'Északra lejtő félnyeregtetőn a napelemek hozama gyenge.', 'autogrowehome' ) );
		}

		// Rooms vs area.
		if ( $net > 0 && $room_sum > 0 && abs( $room_sum - $net ) / $net > 0.10 ) {
			$push( $w, 'rooms', 'rooms_sum', sprintf( /* translators: 1: rooms total, 2: net area */ __( 'A helyiségek összterülete (%1$s m²) több mint 10%%-kal eltér a nettó alapterülettől (%2$s m²).', 'autogrowehome' ), number_format_i18n( $room_sum, 1 ), number_format_i18n( $net, 1 ) ) );
		}
		$count = array();
		foreach ( $rooms as $r ) {
			$count[ $r['type'] ] = ( $count[ $r['type'] ] ?? 0 ) + 1;
			if ( ! empty( $r['width'] ) && ! empty( $r['length'] ) && abs( $r['width'] * $r['length'] - $r['area'] ) > max( 1.5, $r['area'] * 0.15 ) ) {
				$push( $w, 'rooms', 'room_dims', sprintf( /* translators: %s: room name */ __( '„%s”: a szélesség × hosszúság nem egyezik a megadott területtel.', 'autogrowehome' ), $r['name'] ) );
			}
			if ( $r['level'] >= $levels ) {
				$push( $e, 'rooms', 'room_level', sprintf( /* translators: %s: room name */ __( '„%s” nem létező szintre került.', 'autogrowehome' ), $r['name'] ) );
			}
		}
		$bed_rooms = ( $count['master'] ?? 0 ) + ( $count['bedroom'] ?? 0 ) + ( $count['kids'] ?? 0 ) + ( $count['guest'] ?? 0 );
		if ( $bed_rooms !== $beds && ! empty( $rooms ) ) {
			$push( $w, 'rooms', 'bed_count', sprintf( /* translators: 1: in programme, 2: requested */ __( 'A helyiséglistában %1$d hálószoba van, az alapadatoknál %2$d.', 'autogrowehome' ), $bed_rooms, $beds ) );
		}
		if ( ( $count['bathroom'] ?? 0 ) !== $baths && ! empty( $rooms ) ) {
			$push( $w, 'rooms', 'bath_count', sprintf( /* translators: 1: in programme, 2: requested */ __( 'A helyiséglistában %1$d fürdőszoba van, az alapadatoknál %2$d.', 'autogrowehome' ), (int) ( $count['bathroom'] ?? 0 ), $baths ) );
		}
		if ( $levels > 1 && empty( $count['stairs'] ) ) {
			$push( $i, 'rooms', 'stairs_auto', __( 'Többszintes házhoz a tervvázlat automatikusan lépcsőt helyez el.', 'autogrowehome' ) );
		}
		if ( 1 === $levels && ! empty( $count['stairs'] ) && empty( $c['basement'] ) ) {
			$push( $w, 'rooms', 'stairs_single', __( 'Földszintes háznál lépcsőház csak pincével értelmezhető.', 'autogrowehome' ) );
		}
		if ( ! empty( $count['wine'] ) && empty( $c['basement'] ) ) {
			$push( $i, 'rooms', 'wine_basement', __( 'A borospince a földszinten, hűtött helyiségként jelenik meg (nincs pince).', 'autogrowehome' ) );
		}
		$day = ( $count['living'] ?? 0 ) + ( $count['living_kitchen'] ?? 0 );
		if ( 0 === $day && ! empty( $rooms ) ) {
			$push( $w, 'rooms', 'no_living', __( 'Nincs nappali a helyiséglistában.', 'autogrowehome' ) );
		}
		$on_ground_wet = false;
		foreach ( $rooms as $r ) {
			if ( 0 === (int) $r['level'] && in_array( $r['type'], array( 'bathroom', 'wc' ), true ) ) {
				$on_ground_wet = true;
			}
		}
		if ( $levels > 1 && ! $on_ground_wet ) {
			$push( $w, 'rooms', 'ground_wc', __( 'Többszintes háznál a földszintre is javasolt egy WC vagy fürdő.', 'autogrowehome' ) );
		}

		return array(
			'errors'   => $e,
			'warnings' => $w,
			'info'     => $i,
			'metrics'  => array(
				'room_sum' => round( $room_sum, 1 ),
				'net'      => $net,
				'gross'    => $gross > 0 ? $gross : round( $net * 1.15, 1 ),
				'levels'   => $levels,
			),
		);
	}
}
