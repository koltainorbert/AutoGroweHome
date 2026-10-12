<?php
/**
 * Parameter registry: built-in definitions + admin-defined dynamic parameters
 * + admin overrides (hide, relabel, default, order).
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Params;

use AutoGroweHome\Catalog\Catalog;
use AutoGroweHome\License\Features;

defined( 'ABSPATH' ) || exit;

final class Registry {

	public const CUSTOM_OPTION   = 'agh_custom_params';
	public const OVERRIDE_OPTION = 'agh_param_overrides';
	public const TYPES           = array( 'text', 'textarea', 'integer', 'number', 'range', 'select', 'multiselect', 'toggle', 'color', 'cards' );

	/** @var array|null */
	private static $fields = null;

	public static function reset(): void {
		self::$fields = null;
	}

	/**
	 * Basic (Starter) parameter set – everything else requires the "full_params" feature.
	 */
	public static function basic_ids(): array {
		return array( 'project_name', 'property_type', 'occupants', 'bedrooms', 'bathrooms', 'levels', 'net_area', 'plot_area', 'orientation', 'country', 'budget', 'accessible', 'arch_style', 'style_custom', 'footprint', 'garage', 'terrace_area', 'roof_type', 'roof_pitch', 'roof_brand', 'roof_product', 'roof_color', 'facade_main', 'facade_color', 'facade_accent', 'window_style', 'window_frame_color', 'open_plan', 'rooms', 'interior_style', 'floor_main', 'garden_style', 'garden_features', 'time_of_day', 'custom_text' );
	}

	/**
	 * @return array<string,array> Fields keyed by id, ordered.
	 */
	public static function fields(): array {
		if ( null !== self::$fields ) {
			return self::$fields;
		}
		$overrides = get_option( self::OVERRIDE_OPTION, array() );
		$overrides = is_array( $overrides ) ? $overrides : array();
		$full      = Features::enabled( 'full_params' );
		$basic     = array_flip( self::basic_ids() );
		$locale    = determine_locale();

		$fields = array();
		$order  = 0;
		foreach ( Definitions::fields() as $def ) {
			$def['builtin'] = true;
			$def['sort']    = $order++;
			$fields[ $def['id'] ] = $def;
		}
		// Admin-defined parameters are a licence feature: without
		// "custom_params" the stored definitions stay in the database (and in
		// the admin list) but are not active anywhere – not in the designer
		// schema, validation, plans or prompts.
		foreach ( Features::enabled( 'custom_params' ) ? self::custom() : array() as $def ) {
			$def['builtin'] = false;
			// Definitions saved by earlier versions stored the "in" list as text.
			if ( isset( $def['show_if']['op'] ) && 'in' === $def['show_if']['op'] && ! is_array( $def['show_if']['value'] ?? null ) ) {
				$def['show_if']['value'] = self::split_list( $def['show_if']['value'] ?? '' );
			}
			if ( ! empty( $def['translations'][ $locale ] ) ) {
				$def['label'] = $def['translations'][ $locale ];
			}
			$fields[ $def['id'] ] = $def;
		}

		foreach ( $fields as $id => &$def ) {
			$ov = $overrides[ $id ] ?? array();
			if ( ! empty( $ov['label'] ) ) {
				$def['label'] = $ov['label'];
			}
			if ( isset( $ov['help'] ) && '' !== $ov['help'] ) {
				$def['help'] = $ov['help'];
			}
			if ( array_key_exists( 'default', $ov ) && null !== $ov['default'] && '' !== $ov['default'] ) {
				$def['default'] = $ov['default'];
			}
			if ( isset( $ov['sort'] ) && is_numeric( $ov['sort'] ) ) {
				$def['sort'] = (int) $ov['sort'];
			}
			if ( isset( $ov['advanced'] ) ) {
				$def['advanced'] = (bool) $ov['advanced'];
			}
			$def['hidden'] = ! empty( $ov['hidden'] ) && empty( $def['required'] );
			if ( ! $full && $def['builtin'] && ! isset( $basic[ $id ] ) ) {
				$def['hidden']   = true;
				$def['locked']   = true;
			}
			$def += array(
				'help'     => '',
				'required' => false,
				'advanced' => false,
				'prompt'   => '',
				'show_if'  => null,
			);
		}
		unset( $def );

		uasort(
			$fields,
			static function ( $a, $b ) {
				return $a['sort'] <=> $b['sort'];
			}
		);

		self::$fields = $fields;
		return $fields;
	}

	public static function get( string $id ): ?array {
		$f = self::fields();
		return $f[ $id ] ?? null;
	}

	public static function custom(): array {
		$c = get_option( self::CUSTOM_OPTION, array() );
		return is_array( $c ) ? array_values( $c ) : array();
	}

	/**
	 * Validate and save one admin-defined parameter.
	 *
	 * @return true|\WP_Error
	 */
	public static function save_custom( array $raw ) {
		if ( ! Features::enabled( 'custom_params' ) ) {
			return new \WP_Error( 'agh_feature', __( 'A dinamikus paraméterszerkesztő ebben a csomagban nem érhető el.', 'autogrowehome' ) );
		}
		$id = sanitize_key( $raw['id'] ?? '' );
		if ( '' === $id ) {
			return new \WP_Error( 'agh_param', __( 'Hiányzó azonosító.', 'autogrowehome' ) );
		}
		if ( 0 !== strpos( $id, 'x_' ) ) {
			$id = 'x_' . $id;
		}
		$builtin_ids = wp_list_pluck( Definitions::fields(), 'id' );
		if ( in_array( $id, $builtin_ids, true ) ) {
			return new \WP_Error( 'agh_param', __( 'Ez az azonosító foglalt.', 'autogrowehome' ) );
		}
		$type = in_array( $raw['type'] ?? '', self::TYPES, true ) ? $raw['type'] : 'text';
		$cats = array_keys( Definitions::categories() );
		$def  = array(
			'id'       => $id,
			'category' => in_array( $raw['category'] ?? '', $cats, true ) ? $raw['category'] : 'custom',
			'type'     => $type,
			'label'    => sanitize_text_field( $raw['label'] ?? $id ),
			'help'     => sanitize_text_field( $raw['help'] ?? '' ),
			'unit'     => sanitize_text_field( $raw['unit'] ?? '' ),
			'required' => ! empty( $raw['required'] ),
			'advanced' => ! empty( $raw['advanced'] ),
			'prompt'   => self::clean_prompt_template( (string) ( $raw['prompt'] ?? '' ) ),
			'sort'     => isset( $raw['sort'] ) ? (int) $raw['sort'] : 1000,
		);
		if ( in_array( $type, array( 'integer', 'number', 'range' ), true ) ) {
			$def['min']  = isset( $raw['min'] ) && '' !== $raw['min'] ? (float) $raw['min'] : 0;
			$def['max']  = isset( $raw['max'] ) && '' !== $raw['max'] ? (float) $raw['max'] : 100;
			$def['step'] = isset( $raw['step'] ) && '' !== $raw['step'] ? (float) $raw['step'] : 1;
			if ( $def['max'] < $def['min'] ) {
				return new \WP_Error( 'agh_param', __( 'A maximum kisebb, mint a minimum.', 'autogrowehome' ) );
			}
		}
		if ( in_array( $type, array( 'select', 'multiselect', 'cards' ), true ) ) {
			$def['options']    = array();
			$def['prompt_map'] = array();
			$lines             = is_array( $raw['options'] ?? null ) ? $raw['options'] : preg_split( '/\r\n|\r|\n/', (string) ( $raw['options'] ?? '' ) );
			foreach ( $lines as $line ) {
				$parts = array_map( 'trim', explode( '|', (string) $line ) );
				$val   = sanitize_key( $parts[0] ?? '' );
				if ( '' === $val ) {
					continue;
				}
				$def['options'][ $val ]    = sanitize_text_field( $parts[1] ?? $val );
				$def['prompt_map'][ $val ] = self::clean_prompt_template( $parts[2] ?? ( $parts[1] ?? $val ) );
			}
			if ( empty( $def['options'] ) ) {
				return new \WP_Error( 'agh_param', __( 'Legalább egy választható érték szükséges.', 'autogrowehome' ) );
			}
		}
		if ( isset( $raw['pattern'] ) && '' !== $raw['pattern'] && 'text' === $type ) {
			$pattern = (string) $raw['pattern'];
			if ( strlen( $pattern ) > 200 || false === @preg_match( '/' . str_replace( '/', '\/', $pattern ) . '/u', '' ) ) { // phpcs:ignore
				return new \WP_Error( 'agh_param', __( 'Érvénytelen validációs minta.', 'autogrowehome' ) );
			}
			$def['pattern'] = $pattern;
		}
		if ( ! empty( $raw['show_if_field'] ) ) {
			$op    = in_array( $raw['show_if_op'] ?? '=', array( '=', '!=', '>', '<', 'in' ), true ) ? $raw['show_if_op'] : '=';
			$value = $raw['show_if_value'] ?? '';
			if ( 'in' === $op ) {
				// "in" compares against a list (Validator::visible() and the
				// designer JS both expect an array): "a, b" → ['a','b'].
				$value = self::split_list( $value );
			} else {
				$value = sanitize_text_field( is_scalar( $value ) ? (string) $value : '' );
			}
			$def['show_if'] = array(
				'field' => sanitize_key( $raw['show_if_field'] ),
				'op'    => $op,
				'value' => $value,
			);
		}
		$def['translations'] = array();
		if ( ! empty( $raw['translations'] ) && is_array( $raw['translations'] ) ) {
			foreach ( $raw['translations'] as $loc => $label ) {
				if ( preg_match( '/^[a-z]{2}(_[A-Z]{2})?$/', (string) $loc ) && '' !== trim( (string) $label ) ) {
					$def['translations'][ $loc ] = sanitize_text_field( $label );
				}
			}
		}
		$def['default'] = $raw['default'] ?? '';
		if ( 'multiselect' === $type && ! is_array( $def['default'] ) ) {
			// The admin form sends a multiselect default as "a, b" text.
			$def['default'] = array_map( 'sanitize_key', self::split_list( $def['default'] ) );
		}
		// Validate default through the regular sanitizer.
		$def['default'] = Validator::sanitize_value( $def, $def['default'] );

		$all        = get_option( self::CUSTOM_OPTION, array() );
		$all        = is_array( $all ) ? $all : array();
		$all[ $id ] = $def;
		update_option( self::CUSTOM_OPTION, $all, false );
		self::reset();
		return true;
	}

	/**
	 * "a, b ,c" (or an array) → ['a','b','c'] (trimmed, sanitized, no empties).
	 *
	 * @param mixed $value Text or list.
	 */
	private static function split_list( $value ): array {
		$items = is_array( $value ) ? $value : explode( ',', is_scalar( $value ) ? (string) $value : '' );
		$out   = array();
		foreach ( $items as $item ) {
			$item = sanitize_text_field( is_scalar( $item ) ? (string) $item : '' );
			if ( '' !== $item ) {
				$out[] = $item;
			}
		}
		return array_values( array_unique( $out ) );
	}

	public static function delete_custom( string $id ): void {
		$all = get_option( self::CUSTOM_OPTION, array() );
		unset( $all[ $id ] );
		update_option( self::CUSTOM_OPTION, $all, false );
		self::reset();
	}

	/**
	 * Prompt templates may only contain plain text and the {value}/{label}/{color} placeholders.
	 */
	public static function clean_prompt_template( string $t ): string {
		$t = wp_strip_all_tags( $t );
		$t = preg_replace( '/\{(value|label|color)\}/', "\x01$1\x02", $t );
		$t = str_replace( array( '{', '}' ), '', (string) $t );
		$t = str_replace( array( "\x01", "\x02" ), array( '{', '}' ), $t );
		return substr( trim( $t ), 0, 300 );
	}

	/**
	 * Public schema for the frontend (no prompt internals).
	 */
	/**
	 * A public option, with its bundled sample photo when there is one:
	 * assets/img/options/{field}/{value}.webp (large) and …/thumb/{value}.webp (card).
	 * The file's mtime is the cache-busting version.
	 *
	 * @param string $field Field id.
	 * @param string $value Option value.
	 * @param string $label Option label.
	 */
	private static function option_with_image( string $field, string $value, $label ): array {
		$o = array( 'value' => $value, 'label' => $label );
		if ( ! preg_match( '/^[a-z0-9_]+$/', $field . $value ) ) {
			return $o;
		}
		foreach ( array( 'image' => '', 'thumb' => 'thumb/' ) as $key => $sub ) {
			$rel = 'assets/img/options/' . $field . '/' . $sub . $value . '.webp';
			if ( is_readable( AGH_DIR . $rel ) ) {
				$o[ $key ] = AGH_URL . $rel . '?v=' . (int) filemtime( AGH_DIR . $rel );
			}
		}
		return $o;
	}

	public static function public_schema(): array {
		$out = array();
		foreach ( self::fields() as $id => $def ) {
			if ( ! empty( $def['hidden'] ) ) {
				continue;
			}
			$item = array(
				'id'       => $id,
				'category' => $def['category'],
				'type'     => $def['type'],
				'label'    => $def['label'],
				'help'     => $def['help'],
				'default'  => $def['default'],
				'required' => (bool) $def['required'],
				'advanced' => (bool) $def['advanced'],
				'show_if'  => $def['show_if'],
			);
			foreach ( array( 'min', 'max', 'step', 'unit', 'quick', 'max_items', 'filter_by', 'collections' ) as $k ) {
				if ( isset( $def[ $k ] ) ) {
					$item[ $k ] = $def[ $k ];
				}
			}
			if ( isset( $def['options'] ) ) {
				$item['options'] = array();
				foreach ( $def['options'] as $v => $l ) {
					$item['options'][] = self::option_with_image( $id, (string) $v, $l );
				}
			}
			if ( 'catalog' === $def['type'] ) {
				$item['type']    = 'select';
				$item['options'] = Catalog::options_for( $def['catalog'] );
				$item['catalog'] = $def['catalog'];
			}
			$out[] = $item;
		}
		$cats = array();
		foreach ( Definitions::categories() as $k => $c ) {
			$cats[] = array( 'id' => $k, 'label' => $c['label'], 'icon' => $c['icon'] );
		}
		$rooms = array();
		foreach ( Definitions::room_types() as $k => $r ) {
			$rooms[] = array( 'value' => $k, 'label' => $r[0], 'area' => $r[2], 'render' => $r[3], 'zone' => $r[4], 'min' => $r[5] );
		}
		$istyles = array();
		foreach ( Definitions::interior_styles() as $k => $r ) {
			$istyles[] = array( 'value' => $k, 'label' => $r[0] );
		}
		return array(
			'categories'      => $cats,
			'fields'          => $out,
			'room_types'      => $rooms,
			'interior_styles' => $istyles,
			'color_collections' => Catalog::color_collections(),
			'presets'         => Catalog::presets(),
		);
	}

	public static function defaults(): array {
		$out = array();
		foreach ( self::fields() as $id => $def ) {
			$out[ $id ] = $def['default'];
		}
		$out['rooms'] = RoomProgram::auto( $out );
		return $out;
	}
}
