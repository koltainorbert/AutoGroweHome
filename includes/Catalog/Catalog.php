<?php
/**
 * Image and style catalogue: roof brands/products, materials, colour
 * collections, architectural style packs, interior collections and presets.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Catalog;

use AutoGroweHome\Installer;
use AutoGroweHome\Support\Util;

defined( 'ABSPATH' ) || exit;

final class Catalog {

	public const TYPES = array(
		'roof_brand'          => 'Tetőfedési márka',
		'roof_product'        => 'Tetőfedési termék',
		'material'            => 'Anyag',
		'color_collection'    => 'Színkollekció',
		'style'               => 'Építészeti stíluscsomag',
		'interior_collection' => 'Belsőépítészeti kollekció',
		'preset'              => 'Előre beállított csomag',
	);

	/**
	 * Roof brand made mandatory by the specification (BRAMAC). Its "required"
	 * flag and published status cannot be switched off by catalogue edits and
	 * it cannot be deleted.
	 */
	public const SPEC_ROOF_BRAND = 'bramac';

	/** @var array */
	private static $cache = array();

	public static function all( string $type, bool $only_published = true ): array {
		$key = $type . ( $only_published ? ':p' : ':a' );
		if ( isset( self::$cache[ $key ] ) ) {
			return self::$cache[ $key ];
		}
		global $wpdb;
		$t   = Installer::table( 'catalog' );
		$sql = $only_published
			? $wpdb->prepare( "SELECT * FROM {$t} WHERE type = %s AND status = 'published' ORDER BY sort ASC, name ASC", $type ) // phpcs:ignore
			: $wpdb->prepare( "SELECT * FROM {$t} WHERE type = %s ORDER BY sort ASC, name ASC", $type ); // phpcs:ignore
		$rows = $wpdb->get_results( $sql, ARRAY_A ) ?: array(); // phpcs:ignore
		foreach ( $rows as &$r ) {
			$r['data'] = Util::decode( $r['data'] );
		}
		unset( $r );
		self::$cache[ $key ] = $rows;
		return $rows;
	}

	public static function get( string $type, string $slug ): ?array {
		foreach ( self::all( $type, false ) as $r ) {
			if ( $r['slug'] === $slug ) {
				return $r;
			}
		}
		return null;
	}

	public static function exists( string $type, string $slug ): bool {
		$r = self::get( $type, $slug );
		return $r && 'published' === $r['status'];
	}

	public static function flush(): void {
		self::$cache = array();
	}

	/**
	 * Create or update a catalogue item.
	 *
	 * On update, data keys that the incoming item does not contain keep their
	 * stored value (the admin form only posts the fields it shows, e.g. a
	 * brand's "required" or a product's "recommended" flag would otherwise be
	 * lost). To clear a field, send it with an empty value.
	 *
	 * @return true|\WP_Error
	 */
	public static function save( string $type, array $item ) {
		global $wpdb;
		if ( ! isset( self::TYPES[ $type ] ) ) {
			return new \WP_Error( 'agh_catalog', 'Unknown type' );
		}
		$slug = sanitize_key( $item['slug'] ?? '' );
		$name = sanitize_text_field( $item['name'] ?? '' );
		if ( '' === $slug ) {
			$slug = sanitize_key( Util::slugify_filename( $name ) );
		}
		if ( '' === $slug || '' === $name ) {
			return new \WP_Error( 'agh_catalog', __( 'Név és azonosító kötelező.', 'autogrowehome' ) );
		}
		$data   = self::sanitize_data( $type, is_array( $item['data'] ?? null ) ? $item['data'] : array() );
		$t      = Installer::table( 'catalog' );
		$exists = $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$t} WHERE type = %s AND slug = %s", $type, $slug ) ); // phpcs:ignore
		if ( $exists ) {
			$stored = Util::decode( (string) $wpdb->get_var( $wpdb->prepare( "SELECT data FROM {$t} WHERE id = %d", (int) $exists ) ) ); // phpcs:ignore
			$data   = array_merge( $stored, $data );
		}
		$status = in_array( $item['status'] ?? 'published', array( 'published', 'hidden' ), true ) ? ( $item['status'] ?? 'published' ) : 'published';
		if ( 'roof_brand' === $type && self::SPEC_ROOF_BRAND === $slug ) {
			// Mandatory by specification: never switched off by an edit.
			$data['required'] = true;
			$status           = 'published';
		}
		$row = array(
			'type'       => $type,
			'slug'       => $slug,
			'name'       => $name,
			'data'       => Util::json( $data ),
			'image_id'   => absint( $item['image_id'] ?? 0 ),
			'sort'       => (int) ( $item['sort'] ?? 0 ),
			'status'     => $status,
			'updated_at' => Util::now(),
		);
		if ( $exists ) {
			$wpdb->update( $t, $row, array( 'id' => (int) $exists ) );
		} else {
			$row['created_at'] = Util::now();
			$wpdb->insert( $t, $row );
		}
		self::flush();
		return true;
	}

	/**
	 * @return bool False when the item may not be deleted (the mandatory roof brand).
	 */
	public static function delete( string $type, string $slug ): bool {
		global $wpdb;
		if ( 'roof_brand' === $type && self::SPEC_ROOF_BRAND === $slug ) {
			return false;
		}
		$wpdb->delete( Installer::table( 'catalog' ), array( 'type' => $type, 'slug' => $slug ) );
		self::flush();
		return true;
	}

	private static function sanitize_data( string $type, array $d ): array {
		$out = array();
		foreach ( $d as $k => $v ) {
			$k = sanitize_key( $k );
			if ( is_array( $v ) ) {
				$out[ $k ] = self::sanitize_data( $type, $v );
			} elseif ( is_bool( $v ) || is_int( $v ) || is_float( $v ) ) {
				$out[ $k ] = $v;
			} else {
				$v         = (string) $v;
				$out[ $k ] = preg_match( '/^#[0-9a-fA-F]{6}$/', $v ) ? strtoupper( $v ) : ( 'url' === $k || 'source' === $k ? esc_url_raw( $v ) : sanitize_textarea_field( $v ) );
			}
		}
		return $out;
	}

	/**
	 * Slug of the mandatory roof brand: the first published roof_brand entry
	 * whose data has "required" = true; the specification brand (BRAMAC)
	 * counts as required even if an earlier edit dropped its flag. Null when
	 * none exists.
	 */
	public static function required_brand(): ?string {
		foreach ( self::all( 'roof_brand' ) as $r ) {
			if ( ! empty( $r['data']['required'] ) || self::SPEC_ROOF_BRAND === $r['slug'] ) {
				return (string) $r['slug'];
			}
		}
		return null;
	}

	/**
	 * Default product line of a roof brand: a published product of that brand
	 * flagged "recommended" (or "default") in its data; otherwise the product
	 * whose swatch is closest to $color (so an auto-selected tile keeps the
	 * visitor's roof colour); otherwise the first one in catalogue order.
	 */
	public static function default_roof_product( string $brand, string $color = '' ): ?array {
		$list = array_values(
			array_filter(
				self::all( 'roof_product' ),
				static fn( $r ) => ( $r['data']['brand'] ?? '' ) === $brand
			)
		);
		if ( empty( $list ) ) {
			return null;
		}
		foreach ( $list as $r ) {
			if ( ! empty( $r['data']['recommended'] ) || ! empty( $r['data']['default'] ) ) {
				return $r;
			}
		}
		if ( preg_match( '/^#[0-9a-fA-F]{6}$/', $color ) ) {
			$best = null;
			$dist = PHP_INT_MAX;
			foreach ( $list as $r ) {
				$hex = (string) ( $r['data']['hex'] ?? '' );
				if ( ! preg_match( '/^#[0-9a-fA-F]{6}$/', $hex ) ) {
					continue;
				}
				$d = 0;
				for ( $i = 1; $i < 7; $i += 2 ) {
					$d += ( hexdec( substr( $color, $i, 2 ) ) - hexdec( substr( $hex, $i, 2 ) ) ) ** 2;
				}
				if ( $d < $dist ) {
					$dist = $d;
					$best = $r;
				}
			}
			if ( $best ) {
				return $best;
			}
		}
		return $list[0];
	}

	/**
	 * Frontend options for a catalogue-backed select.
	 *
	 * When a mandatory roof brand exists (required_brand()), the brand select
	 * only offers that brand – the spec makes it binding for pitched roofs.
	 */
	public static function options_for( string $type ): array {
		$out      = array();
		$required = 'roof_brand' === $type ? self::required_brand() : null;
		foreach ( self::all( $type ) as $r ) {
			if ( null !== $required && $r['slug'] !== $required ) {
				continue;
			}
			$o = array(
				'value' => $r['slug'],
				'label' => $r['name'],
			);
			if ( ! empty( $r['data']['brand'] ) ) {
				$o['parent'] = $r['data']['brand'];
			}
			if ( ! empty( $r['data']['hex'] ) ) {
				$o['color'] = $r['data']['hex'];
			}
			if ( 'roof_product' === $type ) {
				// Seeded product data (colour names, swatches) awaits manufacturer verification.
				$o['verified'] = ! empty( $r['data']['verified'] );
			}
			if ( $r['image_id'] ) {
				$o['image'] = wp_get_attachment_image_url( (int) $r['image_id'], 'thumbnail' ) ?: '';
			}
			$out[] = $o;
		}
		return $out;
	}

	public static function color_collections(): array {
		$out = array();
		foreach ( self::all( 'color_collection' ) as $r ) {
			$out[] = array(
				'slug'   => $r['slug'],
				'name'   => $r['name'],
				'colors' => array_values( (array) ( $r['data']['colors'] ?? array() ) ),
			);
		}
		return $out;
	}

	public static function presets(): array {
		$out = array();
		foreach ( self::all( 'preset' ) as $r ) {
			$out[] = array(
				'slug'   => $r['slug'],
				'name'   => $r['name'],
				'desc'   => (string) ( $r['data']['description'] ?? '' ),
				'values' => (array) ( $r['data']['values'] ?? array() ),
				'image'  => $r['image_id'] ? ( wp_get_attachment_image_url( (int) $r['image_id'], 'medium' ) ?: '' ) : '',
			);
		}
		foreach ( self::all( 'style' ) as $r ) {
			$out[] = array(
				'slug'   => 'style-' . $r['slug'],
				'name'   => $r['name'],
				'desc'   => (string) ( $r['data']['description'] ?? '' ),
				'values' => array_merge( array( 'arch_style' => $r['slug'] ), (array) ( $r['data']['defaults'] ?? array() ) ),
				'style'  => true,
				'image'  => $r['image_id'] ? ( wp_get_attachment_image_url( (int) $r['image_id'], 'medium' ) ?: '' ) : '',
			);
		}
		return $out;
	}

	/**
	 * Resolve the roof product description for prompts.
	 */
	public static function roof_prompt( string $brand, string $product ): string {
		$b = $brand ? self::get( 'roof_brand', $brand ) : null;
		$p = $product ? self::get( 'roof_product', $product ) : null;
		if ( ! $p ) {
			return $b ? ( $b['data']['prompt'] ?? '' ) : '';
		}
		$parts = array();
		$parts[] = $p['data']['prompt'] ?? '';
		if ( ! empty( $p['data']['color_en'] ) ) {
			$parts[] = 'in ' . $p['data']['color_en'];
		}
		return trim( implode( ' ', array_filter( $parts ) ) );
	}

	/**
	 * Built-in architectural styles: name, design direction (prompt) and the
	 * parameters the style suggests. The designer applies the suggestions to
	 * every parameter the visitor has not set personally, so the live 3D
	 * model looks like the chosen style (roof, facade, windows, colours,
	 * garden). Only visual parameters – never size, rooms or levels.
	 *
	 * @return array<string, array{0: string, 1: string, 2: array}>
	 */
	public static function style_seed(): array {
		// Every style has its own building form (massing, storeys, roof) and its own materials.
		return array(
			'modern_minimal'   => array( __( 'Modern minimalista', 'autogrowehome' ), 'a long low single-storey pavilion, clean orthogonal volumes, deep white frame around the glazed front, crisp white render, slim dark frames', array( 'massing' => 'pavilion', 'levels' => 'single', 'roof_type' => 'flat', 'facade_main' => 'render', 'facade_color' => '#F4F2EE', 'facade_texture' => 'smooth', 'facade_accent' => array( 'wood' ), 'window_style' => 'panoramic', 'window_frame_color' => '#2F3235', 'plinth' => 'flush', 'entrance_door' => 'pivot', 'terrace_floor' => 'ceramic', 'garden_style' => 'minimal', 'fence' => 'slats' ) ),
			'contemporary_lux' => array( __( 'Kortárs luxus', 'autogrowehome' ), 'refined contemporary luxury, a bold cantilevered upper floor, natural stone and warm timber, frameless glass, premium landscape lighting', array( 'massing' => 'cantilever', 'levels' => 'two', 'roof_type' => 'flat', 'facade_main' => 'limestone', 'facade_color' => '#E6DFD2', 'facade_accent' => array( 'wood', 'stone' ), 'window_style' => 'panoramic', 'window_frame_color' => '#1E1F21', 'plinth' => 'flush', 'entrance_door' => 'pivot', 'terrace_floor' => 'stone', 'garden_style' => 'minimal', 'fence' => 'masonry', 'exterior_lighting' => true ) ),
			'mediterranean'    => array( __( 'Mediterrán', 'autogrowehome' ), 'U-shaped house around a courtyard with a small tower, whitewashed or warm sand render, terracotta roof, arched or deep-set openings, olive trees and lavender', array( 'massing' => 'courtyard', 'levels' => 'single', 'roof_type' => 'hip', 'roof_pitch' => 25, 'roof_color' => '#B5532F', 'facade_main' => 'render', 'facade_color' => '#F3E9DA', 'facade_texture' => 'coarse', 'facade_accent' => array( 'stone' ), 'window_style' => 'arched', 'window_frame_color' => '#6B4A33', 'window_frame_material' => 'wood', 'shading' => array( 'spalettas' ), 'shutter_color' => '#4F6B5A', 'plinth' => 'stone', 'entrance_door' => 'wood', 'terrace_floor' => 'stone', 'garden_style' => 'mediterranean', 'fence' => 'masonry' ) ),
			'scandinavian'     => array( __( 'Skandináv', 'autogrowehome' ), 'two linked simple gabled volumes, light timber cladding, minimal eaves, calm light palette, birch and grasses', array( 'massing' => 'gable_pair', 'levels' => 'attic', 'roof_type' => 'gable', 'roof_pitch' => 40, 'roof_color' => '#2B2E31', 'roof_overhang' => 0.2, 'gable_finish' => 'flush', 'facade_main' => 'wood', 'facade_color' => '#E9E6E1', 'facade_accent' => array( 'wood' ), 'facade_accent_color' => '#3F4A52', 'window_style' => 'large', 'window_frame_color' => '#F4F4F2', 'window_frame_material' => 'wood', 'plinth' => 'concrete', 'entrance_door' => 'wood', 'terrace_floor' => 'wood', 'garden_style' => 'natural', 'fence' => 'slats' ) ),
			'bauhaus'          => array( __( 'Bauhaus', 'autogrowehome' ), 'interlocking cubes of different heights, flat roofs with a roof terrace, horizontal ribbon windows, white render with dark accents', array( 'massing' => 'cubes', 'levels' => 'two', 'roof_type' => 'flat', 'facade_main' => 'render', 'facade_color' => '#F7F7F5', 'facade_texture' => 'smooth', 'facade_accent' => array( 'render_dark' ), 'window_style' => 'ribbon', 'window_frame_color' => '#1E1F21', 'corner_window' => true, 'plinth' => 'concrete', 'entrance_door' => 'glass_strip', 'terrace_floor' => 'ceramic', 'garden_style' => 'minimal', 'fence' => 'mesh' ) ),
			'japandi'          => array( __( 'Japandi', 'autogrowehome' ), 'calm low pavilions with deep eaves and a timber veranda (engawa), charred or natural timber, zen garden elements, muted earthy palette', array( 'massing' => 'engawa', 'levels' => 'single', 'roof_type' => 'gable', 'roof_pitch' => 22, 'roof_color' => '#2B2E31', 'roof_overhang' => 1.0, 'facade_main' => 'charred_wood', 'facade_accent' => array( 'wood' ), 'facade_accent_color' => '#B48A62', 'window_style' => 'panoramic', 'window_frame_color' => '#2B2E31', 'plinth' => 'concrete', 'entrance_door' => 'slat', 'terrace_floor' => 'wood', 'garden_style' => 'minimal', 'fence' => 'slats' ) ),
			'classic_burgher'  => array( __( 'Klasszikus polgári', 'autogrowehome' ), 'symmetrical two-storey block with a projecting central bay and pediment, vertical proportioned windows, cornices, hipped roof, rendered walls in soft tones', array( 'massing' => 'symmetric', 'levels' => 'two', 'roof_type' => 'hip', 'roof_pitch' => 40, 'roof_color' => '#8C4A36', 'facade_main' => 'render', 'facade_color' => '#EFE6D6', 'facade_accent' => array(), 'facade_ornaments' => true, 'corner_detail' => 'quoins', 'window_style' => 'vertical', 'window_frame_color' => '#F4F4F2', 'shading' => array( 'shutters' ), 'shutter_color' => '#5B6B5A', 'plinth' => 'stone', 'entrance_door' => 'double', 'terrace_floor' => 'stone', 'garden_style' => 'formal', 'fence' => 'masonry' ) ),
			'rustic'           => array( __( 'Vidéki, rusztikus', 'autogrowehome' ), 'long narrow farmhouse with a covered porch (tornac), natural stone, timber elements, traditional pitched roof, cottage garden', array( 'massing' => 'long_house', 'levels' => 'single', 'roof_type' => 'gable', 'roof_pitch' => 38, 'roof_color' => '#7A3E2C', 'facade_main' => 'stone', 'facade_accent' => array( 'wood' ), 'window_style' => 'classic', 'window_frame_material' => 'wood', 'window_frame_color' => '#6B4A33', 'shading' => array( 'shutters' ), 'shutter_color' => '#6B4A33', 'exposed_rafters' => true, 'chimney' => true, 'chimney_type' => 'stone', 'entrance_door' => 'wood', 'terrace_floor' => 'wood', 'garden_style' => 'cottage', 'fence' => 'slats' ) ),
			'modern_farmhouse' => array( __( 'Modern parasztház', 'autogrowehome' ), 'two parallel elongated barn-houses with their gables to the street linked by a glass connector, steep gable roofs without overhang, dark roof, white walls, timber accents (Hungarian barnhouse)', array( 'massing' => 'twin_barns', 'levels' => 'attic', 'roof_type' => 'gable', 'roof_pitch' => 45, 'gable_finish' => 'flush', 'roof_overhang' => 0, 'roof_color' => '#2B2E31', 'facade_main' => 'render', 'facade_color' => '#F4F2EE', 'facade_accent' => array( 'wood' ), 'window_style' => 'vertical', 'window_frame_color' => '#2B2E31', 'plinth' => 'flush', 'entrance_door' => 'wood', 'terrace_floor' => 'wpc', 'garden_style' => 'natural', 'fence' => 'slats' ) ),
			'american_farm'    => array( __( 'Amerikai farmhouse', 'autogrowehome' ), 'cross-gabled two-storey farmhouse, board-and-batten siding, long porch, black windows, standing-seam metal roof', array( 'massing' => 'cross_gable', 'levels' => 'two', 'roof_type' => 'gable', 'roof_pitch' => 35, 'roof_color' => '#3A3D40', 'facade_main' => 'board_batten', 'facade_color' => '#F4F4F2', 'facade_accent' => array(), 'window_style' => 'vertical', 'window_divided' => true, 'window_frame_color' => '#1E1F21', 'outdoor_covered' => true, 'entrance_door' => 'half_glass', 'terrace_floor' => 'wood', 'garden_style' => 'cottage', 'fence' => 'slats' ) ),
			'alpine'           => array( __( 'Alpesi', 'autogrowehome' ), 'wide chalet with its gable to the street, deep overhanging roof, timber upper floor over a stone base, balconies with timber railings', array( 'massing' => 'chalet', 'levels' => 'two', 'roof_type' => 'gable', 'roof_pitch' => 30, 'roof_overhang' => 1.2, 'roof_color' => '#3A3029', 'facade_main' => 'render', 'facade_color' => '#EFE9DF', 'facade_accent' => array( 'wood', 'stone' ), 'balcony' => true, 'window_style' => 'classic', 'window_frame_material' => 'wood', 'window_frame_color' => '#6B4A33', 'shading' => array( 'shutters' ), 'shutter_color' => '#7A3E2C', 'plinth' => 'stone', 'chimney' => true, 'entrance_door' => 'wood', 'terrace_floor' => 'wood', 'garden_style' => 'natural', 'fence' => 'slats' ) ),
			'industrial'       => array( __( 'Ipari stílus', 'autogrowehome' ), 'a tall brick block next to a hall with a sawtooth roof, exposed brick, black steel frames, factory-style glazing, concrete', array( 'massing' => 'loft', 'levels' => 'two', 'roof_type' => 'flat', 'facade_main' => 'brick', 'facade_accent' => array( 'metal' ), 'facade_accent_color' => '#3A3D40', 'window_style' => 'large', 'window_divided' => true, 'window_frame_color' => '#1E1F21', 'plinth' => 'concrete', 'entrance_door' => 'glass_strip', 'terrace_floor' => 'ceramic', 'driveway' => 'asphalt', 'garden_style' => 'minimal', 'fence' => 'mesh' ) ),
			'organic_modern'   => array( __( 'Organikus modern', 'autogrowehome' ), 'soft rounded volumes with curved walls, natural textures, earthy render, green roofs, integration with landscape', array( 'massing' => 'organic', 'levels' => 'single', 'roof_type' => 'flat', 'roof_surface' => 'green', 'facade_main' => 'render', 'facade_texture' => 'coarse', 'facade_color' => '#E3D6C3', 'facade_accent' => array( 'wood' ), 'window_style' => 'panoramic', 'window_frame_color' => '#4A3B2E', 'window_frame_material' => 'wood_alu', 'entrance_door' => 'wood', 'terrace_floor' => 'wood', 'garden_style' => 'natural', 'fence' => 'none' ) ),
			'high_tech'        => array( __( 'High-tech', 'autogrowehome' ), 'a two-storey glass box inside an expressed steel exoskeleton, precise metal and glass, slim profiles, cool palette', array( 'massing' => 'glass_frame', 'levels' => 'two', 'roof_type' => 'flat', 'facade_main' => 'metal', 'facade_color' => '#D9DCDE', 'facade_accent' => array( 'concrete' ), 'window_style' => 'panoramic', 'window_frame_color' => '#5E6266', 'plinth' => 'flush', 'entrance_door' => 'glass_full', 'terrace_floor' => 'ceramic', 'driveway' => 'asphalt', 'garden_style' => 'minimal', 'fence' => 'mesh' ) ),
			'passive'          => array( __( 'Passzívház', 'autogrowehome' ), 'compact efficient two-storey volume, deep window reveals, triple glazing, external shading, solar panels', array( 'massing' => 'compact', 'levels' => 'two', 'footprint' => 'rectangle', 'roof_type' => 'gable', 'roof_pitch' => 35, 'roof_overhang' => 0.3, 'roof_solar' => true, 'facade_main' => 'render', 'facade_color' => '#EDEAE4', 'facade_accent' => array( 'wood' ), 'window_style' => 'large', 'window_frame_material' => 'wood_alu', 'shading' => array( 'blinds' ), 'plinth' => 'flush', 'garden_style' => 'natural' ) ),
			'cube_house'       => array( __( 'Magyar kockaház (kádeerkocka)', 'autogrowehome' ), 'a Hungarian cube house (kockahaz): a square compact block of about ten by ten metres, ground floor with a habitable attic, a four-sided hipped roof of about 40 degrees in clay tiles, smooth rendered walls, a symmetrical street facade with a small entrance canopy, a plinth and a small attic window', array( 'massing' => 'compact', 'levels' => 'attic', 'roof_type' => 'pyramid', 'roof_pitch' => 40, 'roof_color' => '#8C4A35', 'facade_main' => 'render', 'facade_color' => '#F1E7D3', 'window_style' => 'classic', 'window_divided' => true, 'window_frame_color' => '#F4F2EE', 'window_trim' => 'facade', 'plinth' => 'dark_render', 'entrance_canopy' => true, 'chimney' => true, 'chimney_type' => 'brick', 'entrance_door' => 'wood', 'garden_style' => 'cottage', 'fence' => 'masonry', 'terrace_floor' => 'stone' ) ),
			'folk_house'       => array( __( 'Klasszikus magyar parasztház', 'autogrowehome' ), 'a classic Hungarian village farmhouse: a long narrow whitewashed volume standing on the plot boundary, a gable to the street, a steep pitched roof of about 45 degrees, a covered tornac porch on timber posts along the whole side, small divided windows with shutters, a brick chimney and a barn wing at the back', array( 'massing' => 'long_house', 'levels' => 'single', 'roof_type' => 'gable', 'roof_pitch' => 45, 'roof_color' => '#8C4A35', 'facade_main' => 'render', 'facade_color' => '#F6F2E8', 'window_style' => 'classic', 'window_divided' => true, 'window_frame_material' => 'wood', 'window_frame_color' => '#6B4A33', 'shading' => array( 'shutters' ), 'shutter_color' => '#4F6B52', 'exposed_rafters' => true, 'chimney' => true, 'chimney_type' => 'brick', 'entrance_door' => 'wood', 'plinth' => 'dark_render', 'terrace_floor' => 'stone', 'garden_style' => 'cottage', 'fence' => 'slats' ) ),
			'wine_cellar'      => array( __( 'Magyar présház, borospince', 'autogrowehome' ), 'a small Hungarian press house above a vaulted wine cellar dug into the hillside: one compact volume with a low gable, an arched cellar door, a stone plinth, small windows, a terrace in front with a view over the vineyard', array( 'massing' => 'compact', 'levels' => 'single', 'basement' => true, 'roof_type' => 'gable', 'roof_pitch' => 40, 'roof_color' => '#8C4A35', 'facade_main' => 'render', 'facade_color' => '#F4EFE2', 'facade_accent' => array( 'stone' ), 'window_style' => 'classic', 'window_divided' => true, 'window_frame_material' => 'wood', 'window_frame_color' => '#6B4A33', 'plinth' => 'stone', 'chimney' => true, 'chimney_type' => 'brick', 'entrance_door' => 'wood', 'landscape' => 'vineyard', 'garden_style' => 'natural', 'terrace_floor' => 'stone', 'fence' => 'none' ) ),
			'midcentury'       => array( __( 'Amerikai mid-century modern', 'autogrowehome' ), 'an American mid-century modern house: one long low single-storey volume, a flat roof with a wide overhanging eave, a glazed garden front from floor to ceiling, slim posts, warm timber and stone panels, a carport beside the house', array( 'massing' => 'pavilion', 'levels' => 'single', 'roof_type' => 'flat', 'roof_overhang' => 1, 'roof_color' => '#3A3D40', 'facade_main' => 'wood_horizontal', 'facade_color' => '#E9E3D6', 'facade_accent' => array( 'stone' ), 'window_style' => 'panoramic', 'window_frame_color' => '#2B2E31', 'plinth' => 'flush', 'entrance_door' => 'pivot', 'terrace_floor' => 'stone', 'garden_style' => 'minimal', 'fence' => 'slats' ) ),
			'us_modern'        => array( __( 'Amerikai modern, lapostetős', 'autogrowehome' ), 'an American modern flat-roofed house: two interlocking boxes, part of it two storeys, flat roofs with slim parapets, dark timber cladding against light render, large windows in black frames, a deep entrance recess', array( 'massing' => 'cubes', 'levels' => 'two', 'roof_type' => 'flat', 'roof_color' => '#2E3033', 'facade_main' => 'render', 'facade_color' => '#F4F2EE', 'facade_accent' => array( 'wood' ), 'window_style' => 'large', 'window_frame_color' => '#1E1F21', 'plinth' => 'flush', 'entrance_door' => 'solid_modern', 'terrace_floor' => 'wpc', 'garden_style' => 'minimal', 'fence' => 'slats' ) ),
			'desert_modern'    => array( __( 'Sivatagi modern (Palm Springs)', 'autogrowehome' ), 'a desert modern Palm Springs house: a low single-storey volume with a thin flat roof plate floating over it, a bold breeze-block or timber screen wall at the entrance, light render in warm sand, wide glazing towards the pool, gravel and cacti', array( 'massing' => 'pavilion', 'levels' => 'single', 'roof_type' => 'flat', 'roof_overhang' => 1, 'roof_color' => '#C9C4BA', 'facade_main' => 'render', 'facade_color' => '#F3E9D7', 'facade_accent' => array( 'wood' ), 'window_style' => 'panoramic', 'window_frame_color' => '#2B2E31', 'plinth' => 'flush', 'entrance_door' => 'pivot', 'landscape' => 'desert', 'terrace_floor' => 'stone', 'garden_style' => 'minimal', 'fence' => 'masonry' ) ),
			'custom'           => array( __( 'Egyedi stílus', 'autogrowehome' ), '', array( 'massing' => 'auto' ) ),
		);
	}

	/** Style suggestions as seeded by DB v7 (1.1.1 – 1.2.0), compared by the DB v8 upgrade. */
	private static function style_defaults_v7(): array {
		return (array) json_decode( '{"modern_minimal":{"roof_type":"flat","facade_main":"render","facade_color":"#F4F2EE","facade_texture":"smooth","window_style":"panoramic","plinth":"flush","entrance_door":"pivot","garden_style":"minimal","facade_accent":["wood"],"window_frame_color":"#2F3235","terrace_floor":"ceramic","fence":"slats"},"contemporary_lux":{"roof_type":"flat","facade_main":"render","facade_color":"#F4F2EE","facade_texture":"smooth","window_style":"panoramic","plinth":"flush","entrance_door":"pivot","garden_style":"minimal","facade_accent":["wood","stone"],"window_frame_color":"#1E1F21","terrace_floor":"stone","fence":"masonry","exterior_lighting":true},"mediterranean":{"roof_type":"hip","roof_pitch":25,"roof_color":"#B5532F","facade_main":"render","facade_color":"#F3E9DA","facade_texture":"coarse","facade_accent":["stone"],"window_style":"classic","window_frame_color":"#6B4A33","window_frame_material":"wood","shading":["spalettas"],"plinth":"stone","entrance_door":"wood","terrace_floor":"stone","garden_style":"mediterranean","fence":"masonry"},"scandinavian":{"roof_type":"gable","roof_pitch":40,"roof_color":"#2B2E31","roof_overhang":0.2,"gable_finish":"flush","facade_main":"wood","facade_color":"#E9E6E1","facade_accent":[],"window_style":"large","window_frame_color":"#F4F4F2","window_frame_material":"wood","plinth":"concrete","entrance_door":"wood","terrace_floor":"wood","garden_style":"natural","fence":"slats"},"bauhaus":{"roof_type":"flat","facade_main":"render","facade_color":"#F7F7F5","facade_texture":"smooth","facade_accent":["render_dark"],"window_style":"large","window_frame_color":"#1E1F21","corner_window":true,"plinth":"concrete","entrance_door":"glass_strip","terrace_floor":"ceramic","garden_style":"minimal","fence":"mesh"},"japandi":{"roof_type":"gable","roof_pitch":22,"roof_color":"#2B2E31","roof_overhang":1,"facade_main":"charred_wood","facade_accent":["wood"],"facade_accent_color":"#3F2E23","window_style":"panoramic","window_frame_color":"#2B2E31","plinth":"concrete","entrance_door":"wood","terrace_floor":"wood","garden_style":"minimal","fence":"slats"},"classic_burgher":{"roof_type":"hip","roof_pitch":40,"roof_color":"#8C4A36","facade_main":"render","facade_color":"#EFE6D6","facade_accent":[],"facade_ornaments":true,"corner_detail":"quoins","window_style":"vertical","window_frame_color":"#F4F4F2","shading":["shutters"],"plinth":"stone","entrance_door":"classic","terrace_floor":"stone","garden_style":"formal","fence":"masonry"},"rustic":{"roof_type":"gable","roof_pitch":38,"roof_color":"#7A3E2C","facade_main":"stone","facade_accent":["wood"],"window_style":"classic","window_frame_material":"wood","window_frame_color":"#6B4A33","shading":["shutters"],"exposed_rafters":true,"entrance_door":"wood","terrace_floor":"wood","garden_style":"cottage","fence":"slats"},"modern_farmhouse":{"roof_type":"gable","roof_pitch":45,"gable_finish":"flush","roof_overhang":0,"roof_color":"#2B2E31","facade_main":"render","facade_color":"#F4F2EE","facade_accent":["wood"],"window_style":"vertical","window_frame_color":"#2B2E31","plinth":"flush","entrance_door":"wood","terrace_floor":"wpc","garden_style":"natural","fence":"slats"},"american_farm":{"roof_type":"gable","roof_pitch":35,"roof_color":"#3A3D40","facade_main":"board_batten","facade_color":"#F4F4F2","facade_accent":[],"window_style":"vertical","window_divided":true,"window_frame_color":"#1E1F21","outdoor_covered":true,"entrance_door":"classic","terrace_floor":"wood","garden_style":"cottage","fence":"slats"},"alpine":{"roof_type":"gable","roof_pitch":30,"roof_overhang":1.2,"roof_color":"#3A3029","facade_main":"render","facade_color":"#EFE9DF","facade_accent":["wood","stone"],"balcony":true,"window_style":"classic","window_frame_material":"wood","window_frame_color":"#6B4A33","shading":["shutters"],"plinth":"stone","entrance_door":"wood","terrace_floor":"wood","garden_style":"natural","fence":"slats"},"industrial":{"roof_type":"flat","facade_main":"brick","facade_accent":["metal"],"window_style":"large","window_divided":true,"window_frame_color":"#1E1F21","plinth":"concrete","entrance_door":"glass_strip","terrace_floor":"ceramic","driveway":"asphalt","garden_style":"minimal","fence":"mesh"},"organic_modern":{"roof_type":"flat","facade_main":"render","facade_texture":"coarse","facade_color":"#E3D6C3","facade_accent":["wood"],"window_style":"panoramic","window_frame_color":"#4A3B2E","window_frame_material":"wood_alu","entrance_door":"wood","terrace_floor":"wood","garden_style":"natural","fence":"none","roof_surface":"green"},"high_tech":{"roof_type":"flat","facade_main":"metal","facade_accent":["concrete"],"window_style":"panoramic","window_frame_color":"#5E6266","plinth":"flush","entrance_door":"pivot","terrace_floor":"ceramic","driveway":"asphalt","garden_style":"minimal","fence":"mesh"},"passive":{"footprint":"rectangle","roof_type":"gable","roof_pitch":35,"roof_solar":true,"facade_main":"render","facade_color":"#EDEAE4","facade_accent":["wood"],"window_style":"large","window_frame_material":"wood_alu","shading":["blinds"],"plinth":"flush","garden_style":"natural"},"custom":{"roof_type":"flat","facade_main":"render","facade_texture":"coarse","facade_color":"#E3D6C3","facade_accent":["wood"],"window_style":"panoramic","window_frame_color":"#4A3B2E","window_frame_material":"wood_alu","entrance_door":"wood","terrace_floor":"wood","garden_style":"natural","fence":"none"}}', true );
	}

	/** Style suggestions as seeded by version 1.0.0 (compared by the DB v6 upgrade). */
	private static function style_defaults_v1(): array {
		return array(
			'modern_minimal' => array( 'roof_type' => 'flat', 'facade_main' => 'render', 'facade_color' => '#F2EFE9', 'window_style' => 'panoramic', 'window_frame_color' => '#2F3235' ),
			'contemporary_lux' => array( 'roof_type' => 'flat', 'facade_main' => 'stone', 'facade_accent' => array( 'wood' ), 'window_style' => 'panoramic' ),
			'mediterranean' => array( 'roof_type' => 'hip', 'roof_pitch' => 25, 'facade_color' => '#F3E9DA', 'garden_style' => 'mediterranean' ),
			'scandinavian' => array( 'roof_type' => 'gable', 'roof_pitch' => 40, 'facade_main' => 'wood', 'facade_color' => '#E9E6E1' ),
			'bauhaus' => array( 'roof_type' => 'flat', 'window_style' => 'large', 'facade_color' => '#F7F7F5' ),
			'japandi' => array( 'roof_type' => 'gable', 'roof_pitch' => 22, 'facade_main' => 'wood', 'facade_accent_color' => '#3F2E23' ),
			'classic_burgher' => array( 'roof_type' => 'hip', 'window_style' => 'vertical', 'facade_ornaments' => true ),
			'rustic' => array( 'roof_type' => 'gable', 'facade_main' => 'stone', 'garden_style' => 'cottage' ),
			'modern_farmhouse' => array( 'roof_type' => 'gable', 'roof_pitch' => 45, 'gable_finish' => 'flush', 'roof_overhang' => 0 ),
			'american_farm' => array( 'roof_type' => 'gable', 'facade_main' => 'wood', 'facade_color' => '#F4F4F2', 'window_frame_color' => '#1E1F21' ),
			'alpine' => array( 'roof_type' => 'gable', 'roof_pitch' => 30, 'roof_overhang' => 1.2, 'facade_accent' => array( 'wood', 'stone' ) ),
			'industrial' => array( 'facade_main' => 'brick', 'window_divided' => true, 'window_frame_color' => '#1E1F21' ),
			'organic_modern' => array( 'facade_texture' => 'coarse', 'facade_color' => '#E3D6C3' ),
			'high_tech' => array( 'roof_type' => 'flat', 'facade_main' => 'metal', 'window_style' => 'panoramic' ),
			'passive' => array( 'footprint' => 'rectangle', 'roof_solar' => true, 'shading' => array( 'blinds' ) ),
			'custom' => array(),
		);
	}

	/**
	 * DB v6–v8: give the built-in styles their current suggestions – only where the
	 * stored suggestions are still exactly a shipped seed (1.0.0 or DB v7); an
	 * admin's own edit is never overwritten.
	 *
	 * @return int Number of updated styles.
	 */
	public static function upgrade_style_defaults(): int {
		$old = self::style_defaults_v1();
		$v7  = self::style_defaults_v7();
		$new = self::style_seed();
		$n   = 0;
		foreach ( $new as $slug => $s ) {
			$row = self::get( 'style', $slug );
			if ( ! $row || ( ! isset( $old[ $slug ] ) && ! isset( $v7[ $slug ] ) ) ) {
				continue;
			}
			$stored = wp_json_encode( self::sanitize_data( 'style', (array) ( $row['data']['defaults'] ?? array() ) ) );
			$known  = array( $old[ $slug ] ?? null, $v7[ $slug ] ?? null );
			$same   = false;
			foreach ( $known as $k ) {
				if ( is_array( $k ) && wp_json_encode( self::sanitize_data( 'style', $k ) ) === $stored ) {
					$same = true;
				}
			}
			if ( ! $same ) {
				continue;
			}
			$res = self::save( 'style', array( 'slug' => $slug, 'name' => $row['name'], 'sort' => $row['sort'] ?? 0, 'status' => $row['status'] ?? 'published', 'image_id' => (int) ( $row['image_id'] ?? 0 ), 'data' => array( 'defaults' => $s[2] ) ) );
			if ( ! is_wp_error( $res ) ) {
				$n++;
			}
		}
		self::flush();
		return $n;
	}

	/**
	 * Refresh built-in style wordings that described something the 3D model never builds, so the
	 * image generator does not add it either (DB v9: the rustic style's "barn wing"). Only a text
	 * that is still exactly the factory one is replaced; an edited wording is left alone.
	 *
	 * @return int Number of styles updated.
	 */
	public static function upgrade_style_prompts(): int {
		$fix = array(
			'rustic' => array(
				'long narrow farmhouse with a covered porch (tornac) and a barn wing, natural stone, timber elements, traditional pitched roof, cottage garden',
				'long narrow farmhouse with a covered porch (tornac), natural stone, timber elements, traditional pitched roof, cottage garden',
			),
		);
		$n = 0;
		foreach ( $fix as $slug => $pair ) {
			$row = self::get( 'style', $slug );
			if ( ! $row || trim( (string) ( $row['data']['direction'] ?? '' ) ) !== $pair[0] ) {
				continue;
			}
			$data              = (array) $row['data'];
			$data['direction'] = $pair[1];
			$res               = self::save( 'style', array( 'slug' => $slug, 'name' => $row['name'], 'sort' => $row['sort'] ?? 0, 'status' => $row['status'] ?? 'published', 'image_id' => (int) ( $row['image_id'] ?? 0 ), 'data' => $data ) );
			if ( ! is_wp_error( $res ) ) {
				$n++;
			}
		}
		self::flush();
		return $n;
	}

	/**
	 * Seed initial catalogue on activation (idempotent; never overwrites admin edits).
	 */
	public static function seed(): void {
		if ( get_option( 'agh_catalog_seeded' ) ) {
			return;
		}
		$src = 'https://feketeteto.hu/bramac/';

		self::save(
			'roof_brand',
			array(
				'slug' => 'bramac',
				'name' => 'BRAMAC',
				'sort' => 0,
				'data' => array(
					'prompt'   => 'concrete roof tiles',
					'url'      => 'https://www.bramac.hu',
					'required' => true,
				),
			)
		);
		self::save( 'roof_brand', array( 'slug' => 'other', 'name' => __( 'Egyéb / nem meghatározott', 'autogrowehome' ), 'sort' => 99, 'data' => array( 'prompt' => 'roof tiles' ) ) );

		// Product lines and colour names as listed by a Hungarian reseller (see source).
		// Swatch HEX values are display approximations only. Verify against the official
		// BRAMAC catalogue and adjust in Admin → Katalógus.
		$lines = array(
			'romai'       => array( 'Bramac Római', 'classic Roman-profile concrete roof tiles', array( 'téglavörös' => array( 'brick red', '#9E4A33' ), 'rubinvörös' => array( 'ruby red', '#7E2E2A' ), 'barna' => array( 'brown', '#5A3D2E' ), 'antracit' => array( 'anthracite', '#3A3D40' ) ) ),
			'reviva'      => array( 'Bramac Reviva', 'concrete roof tiles', array( 'téglavörös' => array( 'brick red', '#9E4A33' ), 'rubinvörös' => array( 'ruby red', '#7E2E2A' ), 'barna' => array( 'brown', '#5A3D2E' ), 'antracit' => array( 'anthracite', '#3A3D40' ) ) ),
			'tectura'     => array( 'Bramac Tectura', 'flat concrete roof tiles', array( 'antracit' => array( 'anthracite', '#36393C' ), 'sötétbarna' => array( 'dark brown', '#43332A' ), 'ébenfekete' => array( 'ebony black', '#1E1F21' ) ) ),
			'tegalit'     => array( 'Bramac Tegalit Star', 'flat smooth concrete roof tiles', array( 'terracotta' => array( 'terracotta', '#A65A3A' ), 'vörösbarna' => array( 'reddish brown', '#6B3A2C' ), 'platina ezüst metál' => array( 'platinum silver metallic', '#8C9095' ), 'ébenfekete' => array( 'ebony black', '#1E1F21' ) ) ),
			'duna'        => array( 'Bramac Duna', 'concrete roof tiles', array( 'antracit' => array( 'anthracite', '#3A3D40' ) ) ),
			'adria'       => array( 'Bramac Adria', 'Mediterranean-look concrete roof tiles', array( 'magico' => array( 'warm mixed terracotta', '#A0583B' ), 'vecchio' => array( 'aged terracotta', '#8E5A42' ), 'montano' => array( 'earthy brown', '#6E4B3A' ), 'antico' => array( 'antique terracotta', '#9A6A4F' ) ) ),
			'aerlox'      => array( 'Bramac Aerlox', 'roof tiles', array( 'rubinvörös' => array( 'ruby red', '#7E2E2A' ), 'antracit' => array( 'anthracite', '#3A3D40' ) ) ),
			'7fok'        => array( 'Bramac 7°', 'low-pitch roof tiles', array( 'téglavörös' => array( 'brick red', '#9E4A33' ), 'ébenfekete' => array( 'ebony black', '#1E1F21' ) ) ),
			'montero'     => array( 'Bramac Montero', 'roof tiles', array( 'rubinvörös' => array( 'ruby red', '#7E2E2A' ), 'canyon' => array( 'canyon red-brown', '#8A4B35' ), 'gránit' => array( 'granite grey', '#55585B' ), 'bordaux' => array( 'bordeaux', '#5E2A2C' ), 'terra' => array( 'terra', '#9B5B3F' ) ) ),
		);
		$sort = 0;
		foreach ( $lines as $slug => $line ) {
			foreach ( $line[2] as $color_hu => $c ) {
				self::save(
					'roof_product',
					array(
						'slug' => 'bramac-' . $slug . '-' . sanitize_key( remove_accents( $color_hu ) ),
						'name' => $line[0] . ' – ' . $color_hu,
						'sort' => $sort++,
						'data' => array(
							'brand'    => 'bramac',
							'line'     => $line[0],
							'color'    => $color_hu,
							'color_en' => $c[0],
							'hex'      => $c[1],
							'prompt'   => $line[1],
							'source'   => $src,
							'verified' => false,
							'note'     => 'A színminta-HEX csak megjelenítési közelítés.',
						),
					)
				);
			}
		}

		$collections = array(
			'meleg-feher'   => array( __( 'Meleg fehér + tölgy', 'autogrowehome' ), array( '#F2EFE9', '#E6DED2', '#B9824F', '#2F3235', '#4A4D50' ) ),
			'grafit'        => array( __( 'Grafit kontraszt', 'autogrowehome' ), array( '#ECEBE8', '#9EA2A6', '#4A4D50', '#2B2E31', '#1E2226' ) ),
			'skandinav'     => array( __( 'Skandináv világos', 'autogrowehome' ), array( '#FAFAF8', '#E9E6E1', '#CDBFAE', '#7F8C8D', '#3C4043' ) ),
			'mediterran'    => array( __( 'Mediterrán föld', 'autogrowehome' ), array( '#F3E9DA', '#E3CFAF', '#C8915A', '#A65A3A', '#5B6B4E' ) ),
			'termeszetes'   => array( __( 'Természetes kő és zsálya', 'autogrowehome' ), array( '#EDE8E0', '#CFC6B8', '#8E9A80', '#6F8A68', '#3F4A3C' ) ),
			'alpesi'        => array( __( 'Alpesi fa', 'autogrowehome' ), array( '#F0EBE3', '#A27B5C', '#6B4F3A', '#3F2E23', '#2A2C2E' ) ),
		);
		$sort = 0;
		foreach ( $collections as $slug => $c ) {
			self::save( 'color_collection', array( 'slug' => $slug, 'name' => $c[0], 'sort' => $sort++, 'data' => array( 'colors' => $c[1] ) ) );
		}

		$materials = array(
			'feher-vakolat' => array( __( 'Fehér szilikát vakolat', 'autogrowehome' ), 'facade', '#F2EFE9', 'white silicate render' ),
			'tolgy-lamella' => array( __( 'Tölgy lamella', 'autogrowehome' ), 'facade', '#B9824F', 'vertical oak lamellas' ),
			'szurke-kő'     => array( __( 'Szürke mészkő burkolat', 'autogrowehome' ), 'facade', '#9D9A93', 'grey limestone cladding' ),
			'antracit-fem'  => array( __( 'Antracit állókorcos fém', 'autogrowehome' ), 'facade', '#3A3D40', 'anthracite standing-seam metal' ),
			'klinker-voros' => array( __( 'Vörös klinker', 'autogrowehome' ), 'facade', '#8E3F2E', 'red clinker brick' ),
			'tolgy-parketta'=> array( __( 'Natúr tölgy parketta', 'autogrowehome' ), 'floor', '#C9A57C', 'natural oak parquet' ),
			'mikrocement'   => array( __( 'Világos mikrocement', 'autogrowehome' ), 'floor', '#CFCAC2', 'light microcement' ),
		);
		$sort = 0;
		foreach ( $materials as $slug => $m ) {
			self::save( 'material', array( 'slug' => sanitize_key( remove_accents( $slug ) ), 'name' => $m[0], 'sort' => $sort++, 'data' => array( 'group' => $m[1], 'hex' => $m[2], 'prompt' => $m[3] ) ) );
		}

		$styles = self::style_seed();
		$sort = 0;
		foreach ( $styles as $slug => $s ) {
			self::save( 'style', array( 'slug' => $slug, 'name' => $s[0], 'sort' => $sort++, 'status' => 'custom' === $slug ? 'hidden' : 'published', 'data' => array( 'direction' => $s[1], 'defaults' => $s[2], 'description' => '' ) ) );
		}

		self::save(
			'preset',
			array(
				'slug' => 'modern-90-nyereg',
				'name' => __( 'Modern földszintes, 90 m², nyeregtető', 'autogrowehome' ),
				'sort' => 0,
				'data' => array(
					'description' => __( 'Szürke nyeregtető, világos vakolat, fa és kő kiegészítők, fedett terasz.', 'autogrowehome' ),
					'values'      => array( 'levels' => 'single', 'net_area' => 90, 'bedrooms' => 2, 'bathrooms' => 1, 'roof_type' => 'gable', 'roof_pitch' => 35, 'roof_brand' => 'bramac', 'roof_color' => '#3A3D40', 'facade_main' => 'render', 'facade_accent' => array( 'wood', 'stone' ), 'terrace_area' => 19, 'arch_style' => 'modern_minimal' ),
				),
			)
		);
		self::save(
			'preset',
			array(
				'slug' => 'csaladi-120-lapos',
				'name' => __( 'Modern családi ház, 120 m², lapostető', 'autogrowehome' ),
				'sort' => 1,
				'data' => array(
					'description' => __( 'Lapostető széles kinyúlással, tölgy burkolat, padlóig érő üvegezés.', 'autogrowehome' ),
					'values'      => array( 'levels' => 'single', 'net_area' => 120, 'bedrooms' => 3, 'bathrooms' => 2, 'roof_type' => 'flat', 'eaves_depth' => 1.5, 'facade_main' => 'render', 'facade_accent' => array( 'wood' ), 'window_style' => 'panoramic', 'terrace_area' => 30, 'arch_style' => 'contemporary_lux', 'time_of_day' => 'golden' ),
				),
			)
		);

		update_option( 'agh_catalog_seeded', 1, false );
	}

	public static function style_direction( string $slug ): string {
		$s = self::get( 'style', $slug );
		return $s ? (string) ( $s['data']['direction'] ?? '' ) : '';
	}
}
