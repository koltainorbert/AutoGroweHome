<?php
/**
 * Modular, versioned prompt engine.
 *
 * Prompts are assembled per image from admin-editable modules with variables.
 * Every generated asset stores the exact prompt and the prompt version.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Prompt;

use AutoGroweHome\Catalog\Catalog;
use AutoGroweHome\Installer;
use AutoGroweHome\Params\Definitions;
use AutoGroweHome\Params\Registry;
use AutoGroweHome\Params\RoomProgram;
use AutoGroweHome\Params\Validator;
use AutoGroweHome\Support\Util;

defined( 'ABSPATH' ) || exit;

final class PromptEngine {

	/**
	 * Maximum length (characters) of the single prompt text sent to the image
	 * provider (Magnific Mystic / Flux). Conservative cap; combined() fits the
	 * prompt into it, MagnificProvider clips with clip() as a last guard.
	 */
	public const MAX_PROMPT = 3900;

	/**
	 * Modules shortened when a prompt is too long, least important first.
	 * The client's own description ("user": client wishes / free text) comes
	 * LAST – the designer promises to take it into account – and is cut at a
	 * sentence boundary. "role", the view rule and "output" (quality) are
	 * never shortened and the negative list is always kept whole.
	 */
	private const TRIM_ORDER = array( 'garden', 'variants', 'style', 'lighting', 'camera', 'materials', 'concept', 'roof', 'facade', 'openings', 'interiors', 'massing', 'dimensions', 'consistency', 'extras', 'user' );

	/** Option holding the applied DefaultModules::REVISION. */
	private const DEFAULTS_REV_OPTION = 'agh_prompt_defaults_rev';

	/** @var array<int,array> */
	private static $versions = array();

	/** @var bool */
	private static $upgrade_checked = false;

	public static function seed(): void {
		global $wpdb;
		$t = Installer::table( 'prompt_versions' );
		if ( (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$t}" ) > 0 ) { // phpcs:ignore
			return;
		}
		self::save_version( 'Gyári alapértelmezés', DefaultModules::modules(), DefaultModules::views(), array(), true );
		update_option( self::DEFAULTS_REV_OPTION, DefaultModules::REVISION, true );
	}

	/**
	 * Factory-default upgrade (runs once per DefaultModules::REVISION).
	 *
	 * If the ACTIVE prompt version is exactly the previous factory default
	 * (never edited by the admin), the new factory defaults are saved as a new
	 * version and activated. Edited or custom versions are never touched, and
	 * existing versions are never rewritten (projects keep their version).
	 * Concurrency-safe: only the request that atomically bumps the stored
	 * revision performs the upgrade.
	 */
	public static function maybe_upgrade_defaults(): void {
		if ( self::$upgrade_checked ) {
			return;
		}
		self::$upgrade_checked = true;
		if ( (int) get_option( self::DEFAULTS_REV_OPTION, 1 ) >= DefaultModules::REVISION ) {
			return;
		}
		global $wpdb;
		$key = self::DEFAULTS_REV_OPTION;
		$wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$wpdb->options} (option_name, option_value, autoload) VALUES (%s, %s, 'yes')", $key, '1' ) ); // phpcs:ignore
		$won = $wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->options} SET option_value = %s WHERE option_name = %s AND ( option_value + 0 ) < %d", (string) DefaultModules::REVISION, $key, DefaultModules::REVISION ) ); // phpcs:ignore
		wp_cache_delete( $key, 'options' );
		wp_cache_delete( 'alloptions', 'options' );
		wp_cache_delete( 'notoptions', 'options' );
		if ( 1 !== (int) $won ) {
			return;
		}
		$t   = Installer::table( 'prompt_versions' );
		$row = $wpdb->get_row( "SELECT * FROM {$t} WHERE is_active = 1 ORDER BY version DESC LIMIT 1", ARRAY_A ); // phpcs:ignore
		if ( $row && self::is_legacy_default( Util::decode( $row['modules'] ) ) ) {
			self::save_version( 'Gyári alapértelmezés (' . DefaultModules::REVISION . '. kiadás)', DefaultModules::modules(), DefaultModules::views(), array(), true );
		}
	}

	/**
	 * True when a stored version payload equals an untouched earlier factory
	 * default (DefaultModules::factory_history(), same cleaning as
	 * save_version() applied).
	 */
	public static function is_legacy_default( array $d ): bool {
		foreach ( DefaultModules::factory_history() as $legacy ) {
			if ( self::equals_factory( $d, $legacy ) ) {
				return true;
			}
		}
		return false;
	}

	private static function equals_factory( array $d, array $legacy ): bool {
		$mods  = (array) ( $d['modules'] ?? array() );
		$views = (array) ( $d['views'] ?? array() );
		if ( ! empty( $d['style_overrides'] ) || array_keys( $mods ) !== array_keys( $legacy['modules'] ) || array_keys( $views ) !== array_keys( $legacy['views'] ) ) {
			return false;
		}
		foreach ( $legacy['modules'] as $k => $text ) {
			if ( (string) $mods[ $k ] !== self::clean_text( $text ) ) {
				return false;
			}
		}
		foreach ( $legacy['views'] as $k => $v ) {
			$sv = (array) $views[ $k ];
			if ( (string) ( $sv['label'] ?? '' ) !== sanitize_text_field( $v['label'] ) || (string) ( $sv['rule'] ?? '' ) !== self::clean_text( $v['rule'] ) || (string) ( $sv['modules'] ?? '' ) !== $v['modules'] ) {
				return false;
			}
		}
		return true;
	}

	public static function save_version( string $label, array $modules, array $views, array $style_overrides = array(), bool $activate = false ): int {
		global $wpdb;
		$t       = Installer::table( 'prompt_versions' );
		$version = 1 + (int) $wpdb->get_var( "SELECT MAX(version) FROM {$t}" ); // phpcs:ignore
		$clean   = array(
			'modules'         => self::clean_modules( $modules ),
			'views'           => self::clean_views( $views ),
			'style_overrides' => array(),
		);
		foreach ( $style_overrides as $style => $mods ) {
			$style = sanitize_key( $style );
			if ( '' !== $style && is_array( $mods ) ) {
				$clean['style_overrides'][ $style ] = self::clean_modules( $mods, false );
			}
		}
		$wpdb->insert(
			$t,
			array(
				'version'    => $version,
				'label'      => sanitize_text_field( $label ),
				'modules'    => Util::json( $clean ),
				'created_by' => get_current_user_id(),
				'is_active'  => 0,
				'created_at' => Util::now(),
			)
		);
		if ( $activate ) {
			self::activate( $version );
		}
		self::$versions = array();
		return $version;
	}

	private static function clean_modules( array $modules, bool $fill_defaults = true ): array {
		$defaults = DefaultModules::modules();
		$out      = array();
		foreach ( $defaults as $key => $text ) {
			if ( isset( $modules[ $key ] ) ) {
				$out[ $key ] = self::clean_text( (string) $modules[ $key ] );
			} elseif ( $fill_defaults ) {
				$out[ $key ] = $text;
			}
		}
		return $out;
	}

	private static function clean_views( array $views ): array {
		$defaults = DefaultModules::views();
		$valid    = array_keys( DefaultModules::modules() );
		$out      = array();
		foreach ( $defaults as $key => $def ) {
			$v      = isset( $views[ $key ] ) && is_array( $views[ $key ] ) ? $views[ $key ] : $def;
			$mods   = array_values( array_intersect( array_map( 'trim', explode( ',', (string) ( $v['modules'] ?? $def['modules'] ) ) ), $valid ) );
			$out[ $key ] = array(
				'label'   => sanitize_text_field( $v['label'] ?? $def['label'] ),
				'rule'    => self::clean_text( (string) ( $v['rule'] ?? $def['rule'] ) ),
				'modules' => implode( ',', $mods ? $mods : explode( ',', $def['modules'] ) ),
			);
		}
		return $out;
	}

	/**
	 * Prompt text: plain text only, no markup, max 4000 chars.
	 */
	private static function clean_text( string $t ): string {
		$t = wp_strip_all_tags( $t );
		$t = preg_replace( '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $t );
		return substr( trim( (string) $t ), 0, 4000 );
	}

	public static function activate( int $version ): bool {
		global $wpdb;
		$t = Installer::table( 'prompt_versions' );
		if ( ! $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$t} WHERE version = %d", $version ) ) ) { // phpcs:ignore
			return false;
		}
		$wpdb->query( "UPDATE {$t} SET is_active = 0" ); // phpcs:ignore
		$wpdb->update( $t, array( 'is_active' => 1 ), array( 'version' => $version ) );
		self::$versions = array();
		return true;
	}

	public static function versions(): array {
		global $wpdb;
		$t = Installer::table( 'prompt_versions' );
		return $wpdb->get_results( "SELECT version, label, is_active, created_at, created_by FROM {$t} ORDER BY version DESC", ARRAY_A ) ?: array(); // phpcs:ignore
	}

	public static function get( int $version = 0 ): array {
		if ( 0 === $version ) {
			self::maybe_upgrade_defaults();
		}
		if ( isset( self::$versions[ $version ] ) ) {
			return self::$versions[ $version ];
		}
		global $wpdb;
		$t   = Installer::table( 'prompt_versions' );
		$row = $version > 0
			? $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$t} WHERE version = %d", $version ), ARRAY_A ) // phpcs:ignore
			: $wpdb->get_row( "SELECT * FROM {$t} WHERE is_active = 1 ORDER BY version DESC LIMIT 1", ARRAY_A ); // phpcs:ignore
		if ( ! $row ) {
			$data = array( 'version' => 0, 'label' => 'default', 'modules' => DefaultModules::modules(), 'views' => DefaultModules::views(), 'style_overrides' => array() );
		} else {
			$d    = Util::decode( $row['modules'] );
			$data = array(
				'version'         => (int) $row['version'],
				'label'           => $row['label'],
				'modules'         => array_merge( DefaultModules::modules(), (array) ( $d['modules'] ?? array() ) ),
				'views'           => array_merge( DefaultModules::views(), (array) ( $d['views'] ?? array() ) ),
				'style_overrides' => (array) ( $d['style_overrides'] ?? array() ),
			);
		}
		self::$versions[ $version ] = $data;
		return $data;
	}

	/**
	 * Phrase for one parameter based on its prompt template / prompt_map.
	 */
	/**
	 * Floor phrase for one room: wet rooms, bedrooms, the kitchen and the hall /
	 * corridors can each have their own floor ("same" = the main floor).
	 */
	public static function room_floor( string $type, array $c ): string {
		$zones = array(
			'floor_wet'      => array( 'bathroom', 'wc', 'wellness', 'sauna', 'laundry' ),
			'floor_bedrooms' => array( 'master', 'bedroom', 'guest', 'kids', 'wardrobe' ),
			'floor_kitchen'  => array( 'kitchen', 'pantry' ),
			'floor_entry'    => array( 'hall', 'corridor', 'stairs' ),
		);
		foreach ( $zones as $field => $types ) {
			if ( ! in_array( $type, $types, true ) ) {
				continue;
			}
			$def = Registry::get( $field );
			$val = (string) ( $c[ $field ] ?? ( $def['default'] ?? '' ) );
			$txt = $def['prompt_map'][ $val ] ?? '';
			if ( '' !== $val && 'same' !== $val && '' !== $txt ) {
				return 'floor: ' . $txt;
			}
			break;
		}
		return self::phrase( 'floor_main', $c ) . ', ' . self::phrase( 'floor_color', $c );
	}

	public static function phrase( string $id, array $c ): string {
		$def = Registry::get( $id );
		if ( ! $def || ! array_key_exists( $id, $c ) ) {
			return '';
		}
		// Admin-defined choice parameters may carry their English phrases only
		// in the option list ("value|label|prompt"): then the phrase itself is used.
		if ( empty( $def['prompt'] ) && empty( $def['builtin'] ) && ! empty( $def['prompt_map'] ) ) {
			$def['prompt'] = '{value}';
		}
		if ( empty( $def['prompt'] ) ) {
			return '';
		}
		$v = $c[ $id ];
		if ( 'toggle' === $def['type'] ) {
			return $v ? $def['prompt'] : '';
		}
		if ( 'multiselect' === $def['type'] ) {
			$parts = array();
			foreach ( (array) $v as $item ) {
				$p = $def['prompt_map'][ $item ] ?? '';
				if ( '' !== $p ) {
					$parts[] = $p;
				}
			}
			if ( empty( $parts ) ) {
				return '';
			}
			return str_replace( '{value}', self::join( $parts ), $def['prompt'] );
		}
		if ( in_array( $def['type'], array( 'select', 'cards' ), true ) ) {
			$p = $def['prompt_map'][ (string) $v ] ?? '';
			if ( '' === $p ) {
				return '';
			}
			return str_replace( array( '{value}', '{label}' ), array( $p, $def['options'][ (string) $v ] ?? '' ), $def['prompt'] );
		}
		if ( 'color' === $def['type'] ) {
			return str_replace( '{color}', Color::describe( (string) $v ), $def['prompt'] );
		}
		if ( in_array( $def['type'], array( 'integer', 'number', 'range' ), true ) && 0.0 === (float) $v ) {
			return '';
		}
		if ( is_scalar( $v ) && '' !== (string) $v ) {
			return str_replace( '{value}', (string) $v, $def['prompt'] );
		}
		return '';
	}

	private static function join( array $parts ): string {
		$parts = array_values( array_filter( array_map( 'trim', $parts ) ) );
		if ( count( $parts ) <= 1 ) {
			return $parts[0] ?? '';
		}
		$last = array_pop( $parts );
		return implode( ', ', $parts ) . ' and ' . $last;
	}

	/**
	 * Two phrase lists joined with a comma (either may be empty).
	 */
	private static function join_phrases( string $a, string $b ): string {
		return implode( ', ', array_filter( array( trim( $a ), trim( $b ) ), 'strlen' ) );
	}

	private static function phrases( array $ids, array $c ): string {
		$out = array();
		foreach ( $ids as $id ) {
			$p = self::phrase( $id, $c );
			if ( '' !== $p ) {
				$out[] = $p;
			}
		}
		return implode( ', ', $out );
	}

	/**
	 * Build the variables for a given concept/view/room.
	 */
	public static function variables( array $c, array $concept, string $view, ?array $room = null ): array {
		$brief    = $concept['brief'] ?? array();
		$building = $concept['building'] ?? array();
		$style    = (string) ( $c['arch_style'] ?? 'modern_minimal' );
		$style_p  = 'custom' === $style ? (string) ( $c['style_custom'] ?? '' ) : self::phrase( 'arch_style', $c );

		$roof_details = self::phrases( array( 'roof_windows', 'dormers', 'roof_solar', 'snow_guards', 'gutters', 'flashing', 'roof_ventilation', 'exposed_rafters', 'chimney', 'roof_surface', 'eaves_depth' ), $c );
		if ( ! empty( $c['roof_solar'] ) ) {
			$roof_details = self::join_phrases( $roof_details, self::phrase( 'solar_place', $c ) );
		}
		$roof         = self::phrases( array( 'roof_type', 'roof_pitch', 'gable_finish', 'roof_overhang' ), $c );
		$roof_product = 'flat' === ( $c['roof_type'] ?? '' ) ? '' : Catalog::roof_prompt( (string) ( $c['roof_brand'] ?? '' ), (string) ( $c['roof_product'] ?? '' ) );
		if ( '' === $roof_product || empty( $c['roof_product'] ) ) {
			$roof_product = implode( ', ', array_filter( array( $roof_product, self::phrase( 'roof_color', $c ) ) ) );
		}

		$facade   = self::phrases( array( 'facade_main', 'facade_color', 'facade_accent', 'facade_accent_color', 'plinth', 'facade_texture', 'facade_ornaments', 'corner_detail', 'exterior_lighting', 'house_number' ), $c );
		$openings = self::phrases( array( 'window_style', 'window_frame_material', 'window_frame_color', 'window_divided', 'corner_window', 'terrace_door', 'entrance_door', 'entrance_door_color', 'glazing', 'shading' ), $c );
		$garden   = self::phrases( array( 'garden_style', 'garden_features', 'garden_density', 'tree_types', 'terrace_area', 'terrace_floor', 'driveway', 'fence', 'gate', 'garage', 'entrance_canopy', 'outdoor_covered', 'exterior_steps', 'balcony', 'neighbors', 'orientation' ), $c );
		// the surroundings: the chosen landscape, or the one that suits the style (as in the 3D view)
		$cl = $c;
		if ( 'auto' === ( $c['landscape'] ?? 'auto' ) ) {
			$cl['landscape'] = Definitions::landscape_for_style( (string) ( $c['arch_style'] ?? '' ) );
		}
		$garden = self::join_phrases( $garden, self::phrase( 'landscape', $cl ) );
		// balcony details only with a balcony on an upper floor; vehicles, people and pets around the house
		if ( ! empty( $c['balcony'] ) && 'single' !== ( $c['levels'] ?? 'single' ) ) {
			$garden = self::join_phrases( $garden, self::phrases( array( 'balcony_type', 'balcony_place', 'balcony_size' ), $c ) );
		}
		$garden = self::join_phrases( $garden, self::phrases( array( 'vehicles', 'people', 'pets' ), $c ) );
		if ( ! empty( $c['vehicles'] ) ) {
			$garden = self::join_phrases( $garden, self::phrase( 'car_color', $c ) );
		}
		$energy_p = array();
		foreach ( (array) ( $c['energy'] ?? array() ) as $e ) {
			$def = Registry::get( 'energy' );
			if ( $def && ! empty( $def['prompt_map'][ $e ] ) ) {
				$energy_p[] = $def['prompt_map'][ $e ];
			}
		}
		if ( $energy_p ) {
			$garden .= ', ' . implode( ', ', $energy_p );
		}

		$storey = (float) ( $c['ceiling_height'] ?? 2.8 ) + 0.35;
		$vars   = array(
			'style'              => $style_p,
			'style_direction'    => Catalog::style_direction( $style ),
			'property_type'      => self::phrase( 'property_type', $c ),
			'levels'             => self::phrase( 'levels', $c ),
			'footprint_shape'    => (string) ( $building['shape_label'] ?? ( Registry::get( 'footprint' )['prompt_map'][ $c['footprint'] ?? 'rectangle' ] ?? 'rectangular' ) ),
			'footprint_w'        => number_format( (float) ( $building['width'] ?? 0 ), 1, '.', '' ),
			'footprint_l'        => number_format( (float) ( $building['length'] ?? 0 ), 1, '.', '' ),
			'net_area'           => (string) round( (float) ( $c['net_area'] ?? 0 ) ),
			'storey_height'      => number_format( $storey, 2, '.', '' ),
			'roof'               => $roof,
			'roof_product'       => $roof_product,
			'roof_details'       => $roof_details,
			'facade'             => $facade,
			'openings'           => $openings,
			'garden'             => $garden,
			'region'             => self::phrase( 'country', $c ) ? (string) $c['country'] : 'Central Europe',
			'climate'            => self::phrase( 'climate', $c ),
			'camera'             => self::phrase( 'camera', $c ),
			'lens'               => self::phrase( 'lens', $c ),
			'time_of_day'        => self::phrase( 'time_of_day', $c ),
			'season'             => self::phrase( 'season', $c ),
			'weather'            => self::phrase( 'weather', $c ),
			'concept_name'       => (string) ( $brief['name_en'] ?? $brief['name'] ?? '' ),
			'concept_description'=> (string) ( $brief['exterior_description'] ?? '' ),
			'concept_features'   => self::join( (array) ( $brief['signature_features'] ?? array() ) ),
			'concept_materials'  => self::join( (array) ( $brief['materials'] ?? array() ) ),
			'concept_massing'    => ucfirst( trim( implode( '. ', array_filter( array( 'auto' !== ( $c['massing'] ?? 'auto' ) ? 'Massing: ' . self::phrase( 'massing', $c ) : '', trim( (string) ( $brief['massing'] ?? '' ) ) ) ) ) ) ),
			'variant_letter'     => (string) ( $concept['variant'] ?? 'A' ),
			'variant_direction'  => (string) ( $brief['differentiation'] ?? '' ),
			'consistency_id'     => (string) ( $concept['consistency_id'] ?? '' ),
			'user_text'          => '' !== trim( (string) ( $brief['client_wishes_en'] ?? '' ) ) ? (string) $brief['client_wishes_en'] : self::cut( Util::clean_text( $c['custom_text'] ?? '', 1500 ), 600, true ),
			'view_rule'          => '',
			'custom_params'      => self::custom_phrases( $c, null !== $room ),
		);

		if ( $room ) {
			$types  = Definitions::room_types();
			$istyle = $room['interior_style'] ?? ( $c['interior_style'] ?? 'warm_neutral' );
			$is_def = Definitions::interior_styles();
			$istyle_p = 'custom' === $istyle ? (string) ( $c['interior_style_custom'] ?? '' ) : ( $is_def[ $istyle ][1] ?? 'contemporary' ) . ' interior design';
			$details = array();
			$details[] = ! empty( $room['floor'] ) ? 'floor: ' . $room['floor'] : self::room_floor( (string) $room['type'], $c );
			$details[] = ! empty( $room['wall_color'] ) ? 'walls painted ' . Color::describe( $room['wall_color'] ) : self::phrase( 'wall_color', $c );
			if ( ! empty( $room['wall'] ) ) {
				$details[] = 'walls: ' . $room['wall'];
			} else {
				$details[] = self::phrase( 'wall_finish', $c );
			}
			$details[] = ! empty( $room['ceiling'] ) ? 'ceiling: ' . $room['ceiling'] : self::phrase( 'ceiling', $c );
			$details[] = ! empty( $room['lighting'] ) ? 'lighting: ' . $room['lighting'] : self::phrase( 'lighting', $c );
			$details[] = ! empty( $room['furniture'] ) ? 'furniture: ' . $room['furniture'] : self::phrase( 'furniture_style', $c );
			$details[] = ! empty( $room['furniture_color'] ) ? 'upholstery in ' . Color::describe( $room['furniture_color'] ) : self::phrase( 'furniture_color', $c );
			$details[] = ! empty( $room['decor'] ) ? 'decor: ' . $room['decor'] : self::phrase( 'decor', $c );
			if ( ! empty( $room['curtains'] ) ) {
				$details[] = 'curtains: ' . $room['curtains'];
			} elseif ( ! empty( $c['curtains'] ) ) {
				$wt        = self::phrase( 'window_treatment', $c );
				$details[] = '' !== $wt ? $wt : 'sheer linen curtains';
				$details[] = self::phrases( array( 'curtain_fabric', 'curtain_tone' ), $c );
			}
			// The furnishing the visitor picked for this kind of room ("auto" adds nothing: the style decides).
			$rt = (string) $room['type'];
			if ( in_array( $rt, array( 'living', 'living_kitchen', 'custom' ), true ) ) {
				$details[] = self::phrases( array( 'sofa_type', 'armchair_type', 'coffee_table', 'media_wall', 'fireplace', 'rug_style', 'rug_tone', 'floor_lamp', 'art_style', 'plants', 'plant_amount', 'people' ), $c );
			}
			if ( in_array( $rt, array( 'living_kitchen', 'dining', 'kitchen' ), true ) ) {
				$details[] = self::phrases( array( 'dining_table', 'dining_chairs', 'pendant_style' ), $c );
			}
			if ( in_array( $rt, array( 'master', 'bedroom', 'guest', 'kids' ), true ) ) {
				$details[] = self::phrases( array( 'bed_type', 'wardrobe_type', 'rug_style', 'rug_tone', 'art_style', 'plants', 'plant_amount' ), $c );
			}
			if ( in_array( $rt, array( 'wardrobe' ), true ) ) {
				$details[] = self::phrase( 'wardrobe_type', $c );
			}
			if ( in_array( $rt, array( 'kitchen', 'living_kitchen' ), true ) ) {
				$details[] = self::phrases( array( 'kitchen_layout', 'worktop', 'worktop_color', 'fronts', 'fronts_color', 'handles', 'appliances', 'sink', 'backsplash', 'upper_cabinets', 'hood_style', 'bar_stools' ), $c );
			}
			if ( in_array( $rt, array( 'bathroom', 'wellness' ), true ) ) {
				$details[] = self::phrases( array( 'bath_fixtures', 'bathtub_type', 'shower_type', 'basin_type', 'vanity_type', 'toilet_type', 'bath_tiles', 'taps', 'mirror_type', 'bath_storage', 'bath_color' ), $c );
			}
			if ( 'wc' === $rt ) {
				$details[] = self::phrases( array( 'toilet_type', 'bath_tiles', 'taps', 'mirror_type' ), $c );
			}
			if ( in_array( $rt, array( 'hall', 'corridor', 'stairs' ), true ) && 'single' !== ( $c['levels'] ?? 'single' ) ) {
				$details[] = self::phrase( 'stair_type', $c );
			}
			$details[] = self::phrases( array( 'ceiling_lights', 'door_style', 'thresholds' ), $c );
			// the household items standing in this very room (the visitor's placement, else a fitting room)
			$ri = RoomProgram::item_rooms( $c )[ (string) ( $room['id'] ?? $room['type'] ) ] ?? array();
			$cr = $c;
			foreach ( array( 'extra_furniture', 'electronics', 'pets' ) as $src ) {
				$cr[ $src ] = array_values( array_intersect( (array) ( $c[ $src ] ?? array() ), $ri ) );
			}
			$details[] = self::phrases( array( 'extra_furniture', 'electronics', 'pets' ), $cr );
			if ( ! empty( $room['notes'] ) ) {
				$details[] = 'client notes (descriptive only): ' . $room['notes'];
			}
			$rect             = $building['rooms'][ $room['id'] ] ?? null;
			$vars['room_label'] = $types[ $room['type'] ][1] ?? 'room';
			$vars['room_area']  = (string) round( (float) $room['area'], 1 );
			$vars['room_dims']  = $rect ? number_format( $rect['w'], 1, '.', '' ) . ' m by ' . number_format( $rect['h'], 1, '.', '' ) . ' m' : 'proportionate';
			$vars['room_ceiling'] = number_format( (float) ( $room['ceiling_height'] ?? $c['ceiling_height'] ?? 2.8 ), 2, '.', '' );
			$vars['interior_style'] = $istyle_p;
			$vars['room_details']   = implode( ', ', array_filter( array_map( 'trim', $details ) ) );
		} else {
			$vars['room_label'] = $vars['room_area'] = $vars['room_dims'] = $vars['room_ceiling'] = $vars['interior_style'] = $vars['room_details'] = '';
		}

		return apply_filters( 'agh_prompt_variables', $vars, $c, $concept, $view, $room );
	}

	/**
	 * Prompt phrases of the admin-defined (custom) parameters ("Promptba
	 * kerülő szöveg"), for the {custom_params} variable.
	 *
	 * Only visible, non-hidden custom fields with a value contribute. Fields of
	 * interior categories (rooms, interior, kitchen, bathroom, surfaces) only go
	 * to interior images, fields of exterior categories (massing, roof, facade,
	 * openings, garden, energy) only to exterior images, the rest to both.
	 */
	public static function custom_phrases( array $c, bool $interior ): string {
		$interior_cats = array( 'rooms', 'interior', 'kitchen', 'bathroom', 'surfaces' );
		$exterior_cats = array( 'massing', 'roof', 'facade', 'openings', 'garden', 'energy' );
		$out           = array();
		foreach ( Registry::fields() as $id => $def ) {
			if ( ! empty( $def['builtin'] ) || ! empty( $def['hidden'] ) || ! array_key_exists( $id, $c ) || ! Validator::visible( $def, $c ) ) {
				continue;
			}
			$cat = (string) ( $def['category'] ?? 'custom' );
			if ( ( $interior && in_array( $cat, $exterior_cats, true ) ) || ( ! $interior && in_array( $cat, $interior_cats, true ) ) ) {
				continue;
			}
			$p = trim( self::phrase( (string) $id, $c ) );
			if ( '' !== $p ) {
				$out[] = $p;
			}
		}
		return implode( ', ', $out );
	}

	/**
	 * Assemble the final prompt for one image.
	 *
	 * @return array{prompt:string,negative:string,version:int,view:string}
	 */
	public static function build( array $c, array $concept, string $view, ?array $room = null, int $version = 0 ): array {
		$v       = self::get( $version );
		$vars    = self::variables( $c, $concept, $view, $room );
		$views   = $v['views'];
		$vdef    = $views[ $view ] ?? $views['hero'];
		$modules = $v['modules'];
		$style   = (string) ( $c['arch_style'] ?? '' );
		if ( ! empty( $v['style_overrides'][ $style ] ) ) {
			$modules = array_merge( $modules, array_filter( $v['style_overrides'][ $style ] ) );
		}
		$list  = array_values( array_filter( array_map( 'trim', explode( ',', (string) $vdef['modules'] ) ) ) );
		$custom = trim( (string) ( $vars['custom_params'] ?? '' ) );
		// Admin-defined parameters must reach the image: when none of the
		// modules used by this view contains {custom_params} (prompt versions
		// saved before the "extras" module existed, or an edited view list),
		// the factory "extras" text is inserted before "output". To place it
		// elsewhere, put {custom_params} into any module of the view; to keep a
		// parameter out of prompts, leave its prompt text empty.
		$has_placeholder = false;
		foreach ( $list as $mod ) {
			if ( isset( $modules[ $mod ] ) && false !== strpos( (string) $modules[ $mod ], '{custom_params}' ) ) {
				$has_placeholder = true;
			}
		}
		if ( ! $has_placeholder && '' !== $custom ) {
			$pos = array_search( 'output', $list, true );
			array_splice( $list, false === $pos ? count( $list ) : (int) $pos, 0, array( '_extras_auto' ) );
		}
		$parts = array( 'rule' => trim( (string) $vdef['rule'] ) );
		foreach ( $list as $mod ) {
			if ( '_extras_auto' === $mod ) {
				$parts['extras'] = self::fill( DefaultModules::modules()['extras'], $vars );
				continue;
			}
			if ( 'negative' === $mod || ! isset( $modules[ $mod ] ) ) {
				continue;
			}
			if ( 'user' === $mod && '' === trim( $vars['user_text'] ) ) {
				continue;
			}
			if ( 'variants' === $mod && '' === trim( $vars['variant_direction'] ) ) {
				continue;
			}
			if ( 'concept' === $mod && '' === trim( $vars['concept_description'] ) ) {
				continue;
			}
			if ( 'extras' === $mod && '' === $custom && false !== strpos( (string) $modules[ $mod ], '{custom_params}' ) ) {
				continue;
			}
			$parts[ $mod ] = self::fill( $modules[ $mod ], $vars );
		}
		$prompt   = self::tidy( implode( ' ', array_filter( $parts ) ) );
		$negative = false !== strpos( (string) $vdef['modules'], 'negative' ) ? self::tidy( self::fill( $modules['negative'], $vars ) ) : '';
		return array(
			'prompt'   => $prompt,
			'negative' => $negative,
			'version'  => (int) $v['version'],
			'view'     => $view,
			'parts'    => $parts,
		);
	}

	/**
	 * Single text for providers without a negative-prompt field, at most $max
	 * characters.
	 *
	 * When too long, the END is never cut: the negative list stays whole (it
	 * is only shortened if it alone would leave less than min(800, max/2)
	 * characters for the prompt) and the modules in TRIM_ORDER (free text, concept, garden,
	 * roof/facade details, …) are shortened at word boundaries, least
	 * important first, until the prompt fits. Role, view rule and the output
	 * (quality) module stay intact. Without "parts" (foreign callers) the
	 * prompt body is shortened instead of the negative part.
	 */
	public static function combined( array $built, int $max = self::MAX_PROMPT ): string {
		$prompt   = (string) ( $built['prompt'] ?? '' );
		$negative = (string) ( $built['negative'] ?? '' );
		$join     = static fn( string $p, string $n ): string => $p . ( '' !== $n && '' !== $p ? ' ' : '' ) . $n;
		if ( self::len( $join( $prompt, $negative ) ) <= $max ) {
			return $join( $prompt, $negative );
		}
		$reserve = min( 800, intdiv( $max, 2 ) ); // room always left for the prompt body.
		if ( self::len( $negative ) > $max - $reserve ) {
			$negative = self::cut( $negative, max( 0, $max - $reserve ) );
		}
		$budget = $max - ( '' !== $negative ? self::len( $negative ) + 1 : 0 );
		if ( ! empty( $built['parts'] ) && is_array( $built['parts'] ) ) {
			$parts = array_map( 'strval', $built['parts'] );
			foreach ( self::TRIM_ORDER as $mod ) {
				$over = self::len( self::tidy( implode( ' ', array_filter( $parts ) ) ) ) - $budget;
				if ( $over <= 0 ) {
					break;
				}
				if ( empty( $parts[ $mod ] ) ) {
					continue;
				}
				$keep          = self::len( $parts[ $mod ] ) - $over;
				$parts[ $mod ] = $keep >= 60 ? self::cut( $parts[ $mod ], $keep, 'user' === $mod ) : '';
			}
			$prompt = self::tidy( implode( ' ', array_filter( $parts ) ) );
		}
		if ( self::len( $prompt ) > $budget ) {
			$prompt = self::cut( $prompt, $budget );
		}
		return $join( $prompt, $negative );
	}

	/**
	 * Hard cap for provider adapters (no-op for prompts made by combined()).
	 */
	public static function clip( string $prompt, int $max = self::MAX_PROMPT ): string {
		return self::len( $prompt ) <= $max ? $prompt : ( function_exists( 'mb_substr' ) ? mb_substr( $prompt, 0, $max ) : substr( $prompt, 0, $max ) );
	}

	private static function len( string $s ): int {
		return function_exists( 'mb_strlen' ) ? mb_strlen( $s ) : strlen( $s );
	}

	/**
	 * Shorten to at most $n characters. With $sentence the text is cut after
	 * the last complete sentence that fits (if any); otherwise, or when no
	 * sentence fits, at a word boundary with a closing full stop.
	 */
	private static function cut( string $s, int $n, bool $sentence = false ): string {
		if ( self::len( $s ) <= $n ) {
			return $s;
		}
		if ( $n < 2 ) {
			return '';
		}
		if ( $sentence ) {
			$head = function_exists( 'mb_substr' ) ? mb_substr( $s, 0, $n + 1 ) : substr( $s, 0, $n + 1 );
			if ( preg_match_all( '/[.!?…](?=\s|$)/u', $head, $m, PREG_OFFSET_CAPTURE ) ) {
				foreach ( array_reverse( $m[0] ) as $hit ) {
					$end = function_exists( 'mb_strlen' ) ? mb_strlen( substr( $head, 0, $hit[1] ) ) + 1 : $hit[1] + 1;
					if ( $end <= $n ) {
						return rtrim( function_exists( 'mb_substr' ) ? mb_substr( $s, 0, $end ) : substr( $s, 0, $end ) );
					}
				}
			}
		}
		$t  = function_exists( 'mb_substr' ) ? mb_substr( $s, 0, $n - 1 ) : substr( $s, 0, $n - 1 );
		$sp = function_exists( 'mb_strrpos' ) ? mb_strrpos( $t, ' ' ) : strrpos( $t, ' ' );
		if ( false !== $sp && $sp > ( $n - 1 ) * 0.6 ) {
			$t = function_exists( 'mb_substr' ) ? mb_substr( $t, 0, $sp ) : substr( $t, 0, $sp );
		}
		return rtrim( $t, " ,;:.-(" ) . '.';
	}

	public static function fill( string $template, array $vars ): string {
		return preg_replace_callback(
			'/\{([a-z_]+)\}/',
			static function ( $m ) use ( $vars ) {
				return isset( $vars[ $m[1] ] ) ? (string) $vars[ $m[1] ] : '';
			},
			$template
		);
	}

	private static function tidy( string $s ): string {
		$s = preg_replace( '/\s+/', ' ', $s );
		$s = preg_replace( '/\s+([.,])/', '$1', $s );
		$s = preg_replace( '/([.,]){2,}/', '$1', $s );
		$s = preg_replace( '/:\s*\./', '.', $s );
		$s = preg_replace( '/\(\s*\)/', '', $s );
		// Sentences start with a capital letter (variables such as {camera},
		// {roof_product} or {room_details} are lower-case phrases).
		$s = preg_replace_callback(
			'/(^|[.!?]\s+)(\p{Ll})/u',
			static fn( $m ) => $m[1] . ( function_exists( 'mb_strtoupper' ) ? mb_strtoupper( $m[2] ) : strtoupper( $m[2] ) ),
			trim( (string) $s )
		);
		return trim( (string) $s );
	}

	public static function variable_names(): array {
		return array( 'style', 'style_direction', 'property_type', 'levels', 'footprint_shape', 'footprint_w', 'footprint_l', 'net_area', 'storey_height', 'roof', 'roof_product', 'roof_details', 'facade', 'openings', 'garden', 'region', 'climate', 'camera', 'lens', 'time_of_day', 'season', 'weather', 'concept_name', 'concept_description', 'concept_features', 'concept_materials', 'concept_massing', 'variant_letter', 'variant_direction', 'consistency_id', 'user_text', 'room_label', 'room_area', 'room_dims', 'room_ceiling', 'interior_style', 'room_details', 'custom_params' );
	}
}
