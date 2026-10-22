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
use AutoGroweHome\Support\Settings;
use AutoGroweHome\Support\Util;

defined( 'ABSPATH' ) || exit;

final class PromptEngine {

	/**
	 * Maximum length (characters) of the single prompt text sent to the image
	 * provider (Magnific Mystic / Flux). Conservative cap; combined() fits the
	 * prompt into it, MagnificProvider clips with clip() as a last guard.
	 */
	public const MAX_PROMPT = 3900;

	/** Colour fields of surfaces that are (or may be) timber: only these get wood-tone colour names. */
	public const WOOD_COLOURS = array( 'facade_accent_color', 'shutter_color', 'entrance_door_color', 'furniture_color', 'floor_color', 'fronts_color', 'worktop_color' );

	/**
	 * Main facade materials the 3D draws in their own colour (agh-sketch.js facadeBase()), whatever
	 * the facade colour says – the prompt names that colour, the facade colour goes to the render.
	 */
	public const FIXED_FACADE = array(
		'stone'        => 'warm beige-yellow natural stone in irregular random-rubble masonry',
		'brick'        => 'red-brown brick',
		'clinker'      => 'dark brown clinker brick',
		'limestone'    => 'pale cream limestone',
		'brick_white'  => 'white limewashed brick',
		'concrete'     => 'light grey fair-faced concrete',
		'metal'        => 'dark grey standing-seam metal',
		'render_dark'  => 'dark anthracite render',
		'charred_wood' => 'black charred timber',
	);

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
			return str_replace( '{color}', Color::describe( (string) $v, in_array( $id, self::WOOD_COLOURS, true ) ), $def['prompt'] );
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
	 * Build mode: the masonry of the drawn house in English ("load-bearing walls of 38 cm ceramic masonry
	 * blocks with 12 cm EPS insulation"), from the main (longest) external wall. Empty when build mode is
	 * off, the project has no drawing or the drawing is not a usable house.
	 */
	public static function masonry_phrase( array $c ): string {
		if ( empty( $c['build'] ) || ! is_array( $c['build'] ) || ! \AutoGroweHome\Build\Build::enabled() ) {
			return '';
		}
		$g = \AutoGroweHome\Build\Build::model( $c['build'] );
		if ( empty( $g['ok'] ) ) {
			return '';
		}
		$main = null;
		$best = -1.0;
		foreach ( $g['walls'] as $w ) {
			$len = hypot( (float) $w['b'][0] - (float) $w['a'][0], (float) $w['b'][1] - (float) $w['a'][1] );
			if ( 'ext' === $w['kind'] && $len > $best ) {
				$best = $len;
				$main = $w;
			}
		}
		if ( ! $main ) {
			return '';
		}
		$mats = array(
			'ceramic'        => 'ceramic masonry blocks',
			'aac'            => 'aerated concrete blocks',
			'sand_lime'      => 'sand-lime blocks',
			'formwork_block' => 'concrete formwork blocks',
			'timber_frame'   => 'timber frame',
			'adobe'          => 'adobe (rammed earth) blocks',
		);
		$ins = array(
			'eps'          => 'EPS',
			'graphite_eps' => 'graphite EPS',
			'mineral_wool' => 'mineral wool',
			'wood_fibre'   => 'wood fibre',
		);
		$cm  = static fn( $m ) => (string) round( (float) $m * 100 );
		$out = 'load-bearing walls of ' . $cm( $main['t'] ) . ' cm ' . ( $mats[ $main['mat'] ] ?? str_replace( '_', ' ', (string) $main['mat'] ) );
		if ( isset( $ins[ $main['insul'] ?? '' ] ) && (float) ( $main['insul_t'] ?? 0 ) > 0 ) {
			$out .= ' with ' . $cm( $main['insul_t'] ) . ' cm ' . $ins[ $main['insul'] ] . ' insulation';
		}
		return $out;
	}

	/**
	 * Two phrase lists joined with a comma (either may be empty).
	 */
	private static function join_phrases( string $a, string $b ): string {
		return implode( ', ', array_filter( array( trim( $a ), trim( $b ) ), 'strlen' ) );
	}

	/**
	 * A room detail that is now chosen from the house's own option list (1.9.0): the English phrase of
	 * that option, or the text itself when the visitor typed something of their own.
	 *
	 * @param string $field House field the detail maps to.
	 * @param mixed  $value Room value.
	 * @param array  $c     Configuration.
	 */
	private static function room_opt( string $field, $value, array $c ): string {
		$value = is_array( $value ) ? ( $value[0] ?? '' ) : (string) $value;
		if ( '' === $value ) {
			return '';
		}
		$def = Registry::get( $field );
		$opts = is_array( $def['options'] ?? null ) ? $def['options'] : array();
		foreach ( $opts as $o ) {
			if ( (string) ( $o['value'] ?? '' ) === $value ) {
				$tmp = $c;
				$tmp[ $field ] = 'wall_finish' === $field ? array( $value ) : $value;
				$ph = self::phrase( $field, $tmp );
				return '' !== $ph ? $ph : $value;
			}
		}
		return $value;
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
		$roof_product = self::roof_product_phrase( $c );

		$facade   = self::facade_phrase( $c );
		$masonry  = self::masonry_phrase( $c );
		if ( '' !== $masonry ) {
			$facade = self::join_phrases( $facade, $masonry );
		}
		$openings = self::phrases( array( 'window_style', 'window_frame_material', 'window_frame_color', 'window_divided', 'corner_window', 'terrace_door', 'entrance_door', 'entrance_door_color', 'glazing', 'shading' ), $c );
		$garden   = self::phrases( array( 'garden_style', 'garden_features', 'garden_density', 'tree_types', 'terrace_area', 'terrace_floor', 'driveway', 'fence', 'gate', 'garage', 'entrance_canopy', 'outdoor_covered', 'exterior_steps', 'balcony', 'neighbors', 'orientation' ), $c );
		$fence_p  = self::phrase( 'fence', $c );
		if ( '' !== $fence_p && '' !== self::fence_colour( $c ) ) {
			// the colour the 3D draws the fence in (1.15.2)
			$garden = str_replace( $fence_p, $fence_p . ' in ' . self::fence_colour( $c ), $garden );
		}
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
			$details[] = ! empty( $room['floor'] ) ? 'floor: ' . self::room_opt( 'floor_main', $room['floor'], $c ) : self::room_floor( (string) $room['type'], $c );
			$details[] = ! empty( $room['wall_color'] ) ? 'walls painted ' . Color::describe( $room['wall_color'] ) : self::phrase( 'wall_color', $c );
			if ( ! empty( $room['wall'] ) ) {
				$details[] = 'walls: ' . self::room_opt( 'wall_finish', $room['wall'], $c );
			} else {
				$details[] = self::phrase( 'wall_finish', $c );
			}
			$details[] = ! empty( $room['ceiling'] ) ? 'ceiling: ' . self::room_opt( 'ceiling', $room['ceiling'], $c ) : self::phrase( 'ceiling', $c );
			$details[] = ! empty( $room['lighting'] ) ? 'lighting: ' . self::room_opt( 'ceiling_lights', $room['lighting'], $c ) : self::phrase( 'lighting', $c );
			$details[] = ! empty( $room['furniture'] ) ? 'furniture: ' . self::room_opt( 'furniture_style', $room['furniture'], $c ) : self::phrase( 'furniture_style', $c );
			$details[] = ! empty( $room['furniture_color'] ) ? 'upholstery in ' . Color::describe( $room['furniture_color'] ) : self::phrase( 'furniture_color', $c );
			$details[] = ! empty( $room['decor'] ) ? 'decor: ' . self::room_opt( 'art_amount', $room['decor'], $c ) : self::phrase( 'decor', $c );
			if ( ! empty( $room['curtains'] ) ) {
				$details[] = 'curtains: ' . self::room_opt( 'window_treatment', $room['curtains'], $c );
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
			// what the room overrides on its own (1.9.0): doors, windows, heating and the electrical note
			foreach ( array( 'doors' => 'door_style', 'windows' => 'window_style', 'heating' => 'radiators' ) as $rk => $fid ) {
				if ( ! empty( $room[ $rk ] ) ) {
					$details[] = $rk . ': ' . self::room_opt( $fid, $room[ $rk ], $c );
				}
			}
			if ( ! empty( $room['electrical'] ) ) {
				$details[] = 'electrical: ' . Util::clean_text( (string) $room['electrical'], 120 );
			}
			// the household items standing in this very room (the visitor's placement, else a fitting room)
			$ri = RoomProgram::item_rooms( $c )[ (string) ( $room['id'] ?? $room['type'] ) ] ?? array();
			$cr = $c;
			foreach ( array( 'extra_furniture', 'electronics', 'pets' ) as $src ) {
				$cr[ $src ] = array_values( array_intersect( (array) ( $c[ $src ] ?? array() ), $ri ) );
			}
			$details[] = self::phrases( array( 'extra_furniture', 'electronics', 'pets' ), $cr );
			// pieces the visitor moved by hand in the 3D room: the image must keep that arrangement (1.9.1)
			$lay = $c['room_layout'][ (string) ( $room['id'] ?? $room['type'] ) ] ?? array();
			if ( is_array( $lay ) && count( $lay ) ) {
				$details[] = 'furniture layout: arranged by the client themselves, '
					. count( $lay ) . ' pieces placed and turned by hand – keep that arrangement';
			}
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
	public static function build( array $c, array $concept, string $view, ?array $room = null, int $version = 0, bool $bound = false ): array {
		if ( $bound ) {
			// Bound to the visitor's 3D model (Faithful/Clone with a guide picture): the concept texts
			// describe another house ("articulated massing with a projecting wing", "dark metal
			// accents", "clearly distinct in massing and materials") and pull the picture away from
			// the reference – only the concept's name and the client's own wishes stay (1.15.2).
			$concept['brief'] = array_intersect_key( (array) ( $concept['brief'] ?? array() ), array_flip( array( 'name', 'name_en', 'client_wishes_en' ) ) );
		}
		$v       = self::get( $version );
		$vars    = self::variables( $c, $concept, $view, $room );
		if ( $bound ) {
			// the style's own description orders a building ("U-shaped house with a small tower,
			// arched openings"); bound to the 3D only the style's name stays (1.15.3)
			$vars['style_direction'] = '';
		}
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
		// The wrong alternatives of what the visitor chose (a flat roof when they built a gable, an
		// anthracite roof when theirs is red-brown, a second storey on a bungalow): always part of the
		// negative list, whatever the prompt version says.
		$wrong = self::config_negative( $c, 'interior' === $view );
		if ( ! empty( $wrong ) ) {
			$negative = self::tidy( trim( $negative . ' Also avoid: ' . implode( ', ', $wrong ) . '.' ) );
		}
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
	/**
	 * How closely the picture must follow the guide: the strength sent to the provider.
	 * "custom" keeps whatever the operator set by hand in magnific.structure_strength.
	 */
	public const FIDELITY = array( 'free' => 25, 'balanced' => 45, 'faithful' => 75, 'clone' => 85 );

	public static function fidelity_strength(): int {
		$f = (string) Settings::get( 'magnific.fidelity', 'faithful' );
		$s = isset( self::FIDELITY[ $f ] ) ? self::FIDELITY[ $f ] : (int) Settings::get( 'magnific.structure_strength', 45 );
		return max( 0, min( 100, (int) $s ) );
	}

	/**
	 * The sentence that tells the image model what the reference picture is: the exact massing of
	 * the house the visitor built. Without a guide picture nothing is added (the prompt stays as it
	 * was), because then there is nothing to follow.
	 */
	public static function reference_note(): string {
		$f = (string) Settings::get( 'magnific.fidelity', 'faithful' );
		if ( 'free' === $f ) {
			return ' The reference image shows the intended massing of the house; keep its overall shape and proportions.';
		}
		if ( 'balanced' === $f ) {
			return ' The reference image is the exact 3D model of this house: keep its massing, roof shape and pitch and the position of the openings; render it photorealistically with the materials described above.';
		}
		// faithful, clone and custom: the strictest wording, the strength does the rest
		$note = ' IMPORTANT: the reference image is the exact 3D model of THIS house. Reproduce it faithfully:'
			. ' same massing and proportions, same roof shape, pitch and overhangs, same number, size and position of every window and door,'
			. ' same terrace, balcony, canopy and garage placement, same viewing angle. Do not add, remove or move any volume or opening.'
			. ' Change only what a photograph would change: real materials and textures, natural light and shadows, people-free surroundings, photographic depth of field.';
		return 'clone' === $f ? $note . ' Treat the reference as a technical drawing that must be matched one to one.' : $note;
	}

	/**
	 * The block that opens the prompt when the picture has to follow the model. Image models weigh
	 * the beginning of the prompt most, and whatever is not forbidden they may add: that is how a
	 * barn, a second wing or another house appears next to a single-family home.
	 */
	/**
	 * The roof covering in words: the catalogue product (brand, line – the BRAMAC requirement) in the
	 * colour the visitor sees on the model. The product's own colour word is dropped when it says
	 * something else, otherwise the picture gets a roof of a different colour than the 3D.
	 * '' for a flat roof without a colour.
	 */
	public static function roof_product_phrase( array $c ): string {
		$roof_product = 'flat' === ( $c['roof_type'] ?? '' ) ? '' : Catalog::roof_prompt( (string) ( $c['roof_brand'] ?? '' ), (string) ( $c['roof_product'] ?? '' ) );
		$roof_colour  = trim( (string) preg_replace( '/^roof colou?r\s+/i', '', self::phrase( 'roof_color', $c ) ) );
		if ( '' === $roof_product || empty( $c['roof_product'] ) ) {
			$roof_product = implode( ', ', array_filter( array( $roof_product, $roof_colour ) ) );
		} elseif ( '' !== $roof_colour && false === stripos( $roof_product, $roof_colour ) ) {
			$roof_product = trim( (string) preg_replace( '/\s*\bin\s+[^,]+$/i', '', $roof_product ) ) . ', in ' . $roof_colour;
		}
		return $roof_product;
	}

	/**
	 * The facade in words, in the colours the 3D model shows: a main material the 3D draws in its
	 * own colour (stone, brick…) is named with that colour, and the facade colour then belongs to
	 * the rendered parts only (1.15.2: "natural stone, facade colour warm white" made a grey or
	 * whitewashed stone house of a warm beige rubble-stone one).
	 */
	public static function facade_phrase( array $c ): string {
		$main = (string) ( $c['facade_main'] ?? '' );
		$rest = array( 'facade_accent', 'facade_accent_color', 'plinth', 'facade_texture', 'facade_ornaments', 'corner_detail', 'exterior_lighting', 'house_number' );
		if ( ! isset( self::FIXED_FACADE[ $main ] ) ) {
			return self::phrases( array_merge( array( 'facade_main', 'facade_color' ), $rest ), $c );
		}
		$colour = trim( (string) preg_replace( '/^facade colou?r\s+/i', '', self::phrase( 'facade_color', $c ) ) );
		$out    = 'main facade in ' . self::FIXED_FACADE[ $main ];
		if ( '' !== $colour ) {
			$out .= ', rendered parts in ' . $colour;
		}
		return self::join_phrases( $out, self::phrases( $rest, $c ) );
	}

	/**
	 * The colour the 3D draws a slatted fence in (agh-3d.js): weathered grey timber for the
	 * Scandinavian style, dark anthracite metal otherwise. '' for other fences (their material says it).
	 */
	public static function fence_colour( array $c ): string {
		if ( 'slats' !== (string) ( $c['fence'] ?? '' ) ) {
			return '';
		}
		return 'scandinavian' === (string) ( $c['arch_style'] ?? '' ) ? 'weathered grey timber' : 'dark anthracite metal';
	}

	/**
	 * The design's own colours and materials in one sentence, for the prompt written from the
	 * picture: a picture in golden light shows a white wall cream and a red roof brown, the
	 * configuration knows the real values (1.15.2).
	 */
	public static function design_facts( array $c ): string {
		$facts = array();
		$roof  = self::roof_product_phrase( $c );
		if ( '' !== $roof && 'flat' !== (string) ( $c['roof_type'] ?? '' ) ) {
			$facts[] = 'roof ' . $roof;
		}
		$main = (string) ( $c['facade_main'] ?? '' );
		if ( isset( self::FIXED_FACADE[ $main ] ) ) {
			$facts[] = 'main facade ' . self::FIXED_FACADE[ $main ];
			$render  = trim( (string) preg_replace( '/^facade colou?r\s+/i', '', self::phrase( 'facade_color', $c ) ) );
			if ( '' !== $render ) {
				$facts[] = 'rendered parts ' . $render;
			}
		} else {
			$facts[] = trim( self::phrases( array( 'facade_main', 'facade_color' ), $c ) );
		}
		$frame = self::phrase( 'window_frame_color', $c );
		if ( '' !== $frame ) {
			$facts[] = $frame;
		}
		$fence = self::phrase( 'fence', $c );
		if ( '' !== $fence && 'no fence' !== $fence ) {
			$facts[] = $fence . ( '' !== self::fence_colour( $c ) ? ' in ' . self::fence_colour( $c ) : '' );
		}
		$facts = array_values( array_filter( array_map( 'trim', $facts ) ) );
		return empty( $facts ) ? '' : 'Exact colours and materials of the design (binding, the screenshot light may tint them): ' . implode( '; ', $facts ) . '.';
	}

	/**
	 * "Photo from the 3D picture" (1.16.0, Settings → Magnific → Képkészítés módja): the visitor's
	 * 3D picture itself is the input image and becomes the photograph. Only where the picture must
	 * follow the model (Faithful, Clone, custom); Free and Balanced keep the structure way.
	 */
	public static function photo_mode(): bool {
		return 'photo' === (string) Settings::get( 'magnific.render_mode', 'photo' )
			&& in_array( (string) Settings::get( 'magnific.fidelity', 'faithful' ), array( 'faithful', 'clone', 'custom' ), true );
	}

	/**
	 * Output size for the photo in the shape of the 3D picture: at most 1440 px on the long side,
	 * multiples of 16 (Flux), never below 256.
	 *
	 * @return array{0:int,1:int}
	 */
	public static function photo_size( int $w, int $h ): array {
		if ( $w <= 0 || $h <= 0 ) {
			$w = 1152;
			$h = 700;
		}
		$k   = 1440 / max( $w, $h );
		$fit = static fn( float $v ): int => (int) max( 256, min( 1440, round( $v / 16 ) * 16 ) );
		return array( $fit( $w * $k ), $fit( $h * $k ) );
	}

	/**
	 * The instruction that turns the 3D picture into a photograph of the same house (or room): keep
	 * everything, change only what a camera would. $described is the prompt Claude wrote from the
	 * picture (1.15.0), if any; $with_hero: the second input image is the chosen hero photograph.
	 */
	public static function photo_prompt( array $c, string $view, ?array $room = null, bool $with_hero = false, string $described = '' ): string {
		$light = trim( implode( ', ', array_filter( array( self::phrase( 'time_of_day', $c ), self::phrase( 'season', $c ), self::phrase( 'weather', $c ) ) ) ) );
		if ( 'interior' === $view ) {
			$label = $room ? strtolower( str_replace( '_', ' ', (string) ( $room['type'] ?? 'room' ) ) ) : 'room';
			$out   = 'Turn this screenshot of a 3D room model into a real, professional interior photograph of exactly the same ' . $label . '.'
				. ' Keep everything exactly as in the image: the room shape, walls, ceiling, every window and door, every piece of furniture and object with its position, size, shape and colour, the floor and wall colours.'
				. ' Keep the camera position, angle and framing exactly.'
				. ' Change only what a photograph would change: real physically accurate materials and textures, natural daylight through the windows and soft shadows, real fabrics, wood grain, reflections.'
				. ' Interior design magazine photography, sharp, natural colours, no CGI look. Remove all user interface elements, labels, text and watermarks.';
			return self::clip( self::tidy( $out ) );
		}
		// 1.17.0: the photographer's set-up shot (Norbi: "nem stúdió minőség … beállított kép, tökéletes fények")
		$out = 'Turn this screenshot of a 3D house model into an award-winning professional architectural photograph of exactly the same house, as if a top real-estate photographer had set up the shot.'
			. ' Keep everything exactly as in the image: the building shape and size, the number of floors, the roof shape, pitch and colour, the facade materials and colours,'
			. ' every window and door with its position, size and frame colour, the terrace, pergola, garage, carport, pool, fence, gate, driveway and paths,'
			. ' and every car, person, animal, piece of furniture and plant in its place and in its colour. Keep the camera position, angle and framing exactly. Do not add or remove anything.';
		if ( $with_hero ) {
			$out .= ' The second image is a finished photograph of this same house from another angle: match its materials, colours, light and photographic look exactly.';
		}
		$facts = self::design_facts( $c );
		if ( '' !== $facts ) {
			$out .= ' ' . $facts;
		}
		if ( '' !== trim( $described ) ) {
			$out .= ' What the image shows: ' . trim( $described );
		}
		if ( 'evening' === $view ) {
			$light = 'blue hour just after sunset, deep blue sky, warm interior lights glowing through every window, exterior wall lights and garden lights on';
		} elseif ( '' === $light ) {
			$light = 'warm golden-hour sunlight from the side, a few soft clouds';
		}
		$out .= ' Turn low-poly trees, cone-shaped trees, blob bushes and flat textured grass into lush real trees, shrubs and a manicured lawn of the same size, shape and place;'
			. ' turn simple placeholder cars, people and animals into real, detailed ones in the same place, pose and colour.'
			. ' Photography: full-frame camera, 24 mm tilt-shift lens, corrected vertical lines, f/8, perfectly balanced exposure with bracketed HDR, ' . $light . ', long soft natural shadows, gentle fill light,'
			. ' crisp micro-detail in every material (roof texture, render grain, wood grain, stone, glass reflecting the sky), natural colour grading, magazine quality, hyperrealistic, no CGI or video-game look.'
			. ' Remove all user interface elements, labels, text and watermarks.';
		return self::clip( self::tidy( $out ) );
	}

	public static function reference_lead(): string {
		$f = (string) Settings::get( 'magnific.fidelity', 'faithful' );
		if ( ! in_array( $f, array( 'faithful', 'clone', 'custom' ), true ) ) {
			return '';
		}
		return 'Photorealistic photograph of EXACTLY the building shown in the reference image.'
			. ' The reference image is a 3D model of this very house and it is binding:'
			. ' exactly ONE building, with exactly the volumes, roof shape and openings seen there.'
			. ' Do NOT add any further structure: no barn, no stable, no outbuilding, no second house, no extra wing or annex,'
			. ' no neighbouring buildings beyond those in the reference.'
			. ' The garage, carport, terrace, pergola, canopy, balcony, shutters and fence appear only where the reference shows them,'
			. ' and nothing that the reference shows may be left out.'
			. ' Keep the camera position and the horizon of the reference.'
			. ' Materials and colours come only from this text and the reference image; a style sample gives only light, atmosphere and photographic quality.'
			. ' Everything below describes the materials, colours, light and surroundings of that same single building. ';
	}

	/**
	 * How much the style sample photo counts (0–100), set apart from the structure strength.
	 * Mystic calls the opposite "adherence": a high adherence follows the prompt, a low one the
	 * style reference – so the value sent is 100 minus this.
	 */
	public static function style_strength(): int {
		return max( 0, min( 100, (int) Settings::get( 'magnific.style_strength', 45 ) ) );
	}

	public static function style_adherence(): int {
		return 100 - self::style_strength();
	}

	/**
	 * The opening block for a room: the interior counterpart of reference_lead().
	 */
	public static function interior_lead(): string {
		$f = (string) Settings::get( 'magnific.fidelity', 'faithful' );
		if ( ! in_array( $f, array( 'faithful', 'clone', 'custom' ), true ) ) {
			return '';
		}
		return 'Photorealistic interior photograph of EXACTLY the room shown in the reference image.'
			. ' The reference image is a 3D model of this very room and it is binding:'
			. ' the same walls and ceiling height, the same windows, doors and openings in the same places,'
			. ' the same furniture pieces in the same positions and sizes.'
			. ' Do NOT add any further furniture, doors, windows, columns or rooms, and leave nothing out.'
			. ' Keep the camera position and the horizon of the reference.'
			. ' Everything below describes the materials, colours and light of that same room. ';
	}

	public static function interior_note(): string {
		return ' The reference image is the 3D model of this room: keep its layout, the openings and the furniture positions; render it photorealistically with the materials described above.';
	}

	/**
	 * The final text for one request: the binding block in front (when there is one), the closing
	 * reference sentence after the body, the negative list last – all of it within $max, and the
	 * negative list is never cut by the length limit (see combined()). With $inline_negative false
	 * the negative list is left out (the provider gets it in a field of its own, or not at all).
	 */
	public static function compose( array $built, string $lead = '', string $note = '', bool $inline_negative = true, int $max = self::MAX_PROMPT ): string {
		if ( ! $inline_negative ) {
			$built['negative'] = '';
		}
		if ( '' !== trim( $note ) ) {
			$built['prompt'] = self::tidy( (string) ( $built['prompt'] ?? '' ) . ' ' . trim( $note ) );
			if ( isset( $built['parts'] ) && is_array( $built['parts'] ) ) {
				$built['parts']['refnote'] = trim( $note );   // not in TRIM_ORDER: never shortened
			}
		}
		return $lead . self::combined( $built, $max - self::len( $lead ) );
	}

	/**
	 * The wrong alternatives of the visitor's own choices, for the negative prompt: what an image
	 * model tends to put in instead (an anthracite roof instead of a red-brown one, a flat roof
	 * instead of a gable, a second storey on a bungalow, a barn next to a farmhouse). Only values the
	 * visitor did NOT choose are listed, never their own ones.
	 *
	 * @return string[] Short English phrases.
	 */
	public static function config_negative( array $c, bool $interior = false ): array {
		$out = array();
		$has = static function ( $list, string $v ): bool {
			return in_array( $v, array_map( 'strval', (array) $list ), true );
		};
		if ( $interior ) {
			$out = array( 'extra doors or windows', 'furniture that is not in the reference', 'exterior view of the house' );
			if ( 'none' === (string) ( $c['people'] ?? 'none' ) ) {
				$out[] = 'people';
			}
			if ( empty( $c['pets'] ) ) {
				$out[] = 'pets';
			}
			return $out;
		}
		// one house: every further building or wing is an invention of the model
		$out[] = 'barn';
		$out[] = 'second house';
		$out[] = 'extra wing or annex';
		$levels = array(
			'single' => array( 'second storey', 'two-storey house' ),
			'attic'  => array( 'full-height second floor', 'three-storey house' ),
			'two'    => array( 'single-storey bungalow', 'third storey' ),
			'three'  => array( 'single-storey bungalow', 'two-storey house' ),
		);
		$out  = array_merge( $out, $levels[ (string) ( $c['levels'] ?? '' ) ] ?? array() );
		$roof = (string) ( $c['roof_type'] ?? '' );
		$roofs = array(
			'flat'     => array( 'pitched roof', 'gable roof', 'hipped roof' ),
			'gable'    => array( 'flat roof', 'hipped roof', 'mansard roof' ),
			'hip'      => array( 'flat roof', 'gable ends' ),
			'half_hip' => array( 'flat roof', 'plain gable ends' ),
			'pyramid'  => array( 'flat roof', 'gable roof' ),
			'shed'     => array( 'flat roof', 'gable roof' ),
			'multi'    => array( 'flat roof' ),
			'complex'  => array( 'flat roof' ),
		);
		$out = array_merge( $out, $roofs[ $roof ] ?? array() );
		if ( '' !== $roof && 'flat' !== $roof ) {
			$out = array_merge( $out, self::wrong_colours( (string) ( $c['roof_color'] ?? '' ), 'roof' ) );
		}
		$main   = (string) ( $c['facade_main'] ?? '' );
		$accent = array_map( 'strval', (array) ( $c['facade_accent'] ?? array() ) );
		$mats   = array(
			'render' => array( 'exposed brick facade', 'timber cladding', 'stone cladding' ),
			'stone'  => array( 'plain rendered facade', 'brick facade' ),
			'brick'  => array( 'plain rendered facade', 'stone facade' ),
			'wood'   => array( 'plain rendered facade', 'brick facade' ),
			'other'  => array( 'brick facade', 'timber cladding' ),
		);
		$kind = in_array( $main, array( 'render', 'stone', 'brick' ), true ) ? $main
			: ( in_array( $main, array( 'clinker', 'brick_white' ), true ) ? 'brick'
			: ( in_array( $main, array( 'wood', 'wood_horizontal', 'board_batten', 'charred_wood' ), true ) ? 'wood' : ( '' !== $main ? 'other' : '' ) ) );
		foreach ( $mats[ $kind ] ?? array() as $m ) {
			// a material the visitor uses as an accent is not a wrong one
			if ( ( false !== strpos( $m, 'timber' ) && array_intersect( $accent, array( 'wood', 'timber' ) ) )
				|| ( false !== strpos( $m, 'stone' ) && in_array( 'stone', $accent, true ) )
				|| ( false !== strpos( $m, 'brick' ) && array_intersect( $accent, array( 'brick', 'clinker' ) ) ) ) {
				continue;
			}
			$out[] = $m;
		}
		if ( in_array( $main, array( 'render', 'panel', 'fiber_cement', 'concrete' ), true ) ) {
			$out = array_merge( $out, self::wrong_colours( (string) ( $c['facade_color'] ?? '' ), 'facade' ) );
		}
		$out = array_merge( $out, self::wrong_colours( (string) ( $c['window_frame_color'] ?? '' ), 'window frames' ) );
		$garage = array(
			'none'     => array( 'garage', 'carport' ),
			'carport'  => array( 'closed garage' ),
			'garage_1' => array( 'detached garage building', 'double garage' ),
			'garage_2' => array( 'detached garage building' ),
			'separate' => array( 'garage attached to the house' ),
		);
		$out = array_merge( $out, $garage[ (string) ( $c['garage'] ?? '' ) ] ?? array() );
		if ( ! $has( $c['garden_features'] ?? array(), 'pool' ) ) {
			$out[] = 'swimming pool';
		}
		if ( array_key_exists( 'balcony', $c ) && empty( $c['balcony'] ) ) {
			$out[] = 'balcony';
		}
		if ( array_key_exists( 'chimney', $c ) && empty( $c['chimney'] ) ) {
			$out[] = 'chimney';
		}
		if ( array_key_exists( 'roof_solar', $c ) && empty( $c['roof_solar'] ) && 'flat' !== $roof ) {
			$out[] = 'solar panels';
		}
		if ( 'none' === (string) ( $c['people'] ?? 'none' ) ) {
			$out[] = 'people';
		}
		if ( array_key_exists( 'vehicles', $c ) && empty( $c['vehicles'] ) ) {
			$out[] = 'parked cars';
		}
		/**
		 * The wrong alternatives listed in the negative prompt.
		 *
		 * @param string[] $out      Phrases.
		 * @param array    $c        Configuration.
		 * @param bool     $interior Interior view.
		 */
		return array_values( array_unique( (array) apply_filters( 'agh_config_negative', $out, $c, $interior ) ) );
	}

	/**
	 * The colour families a model would wrongly use instead of the chosen one.
	 *
	 * @return string[]
	 */
	private static function wrong_colours( string $hex, string $what ): array {
		$name = Color::describe( $hex, false );
		if ( '' === $name ) {
			return array();
		}
		$warm  = (bool) preg_match( '/red|terracotta|brown|burgundy|coral|oak|ochre|orange|mustard/', $name );
		$dark  = (bool) preg_match( '/anthracite|charcoal|black|dark/', $name );
		$light = (bool) preg_match( '/white|cream|beige|sand|pale|light|greige/', $name );
		if ( 'roof' === $what ) {
			return $warm ? array( 'anthracite roof', 'black roof', 'grey roof' ) : ( $dark ? array( 'red roof tiles', 'terracotta roof', 'brown roof' ) : array( 'anthracite roof', 'red roof tiles' ) );
		}
		if ( 'facade' === $what ) {
			return $light ? array( 'dark facade' ) : ( $dark ? array( 'white facade' ) : array( 'white facade', 'grey facade' ) );
		}
		return $dark ? array( 'white window frames' ) : ( $light ? array( 'black window frames' ) : array( 'white plastic window frames' ) );
	}

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
