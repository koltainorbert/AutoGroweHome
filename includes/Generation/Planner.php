<?php
/**
 * Concept planner: designs three distinct concept briefs (A, B, C).
 *
 * Primary: Anthropic (forced tool use + strict local schema validation).
 * Fallback: deterministic rule-based planner (labelled as such) – used when
 * Anthropic is not configured/enabled or its answer fails validation.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Generation;

use AutoGroweHome\Ai\Providers;
use AutoGroweHome\Catalog\Catalog;
use AutoGroweHome\Frontend\I18n;
use AutoGroweHome\Params\Registry;
use AutoGroweHome\Params\RoomProgram;
use AutoGroweHome\Params\Validator;
use AutoGroweHome\Prompt\Color;
use AutoGroweHome\Prompt\DefaultModules;
use AutoGroweHome\Prompt\PromptEngine;
use AutoGroweHome\Support\Logger;
use AutoGroweHome\Support\Schema;
use AutoGroweHome\Support\Settings;
use AutoGroweHome\Support\Util;

defined( 'ABSPATH' ) || exit;

final class Planner {

	public static function concept_schema(): array {
		$str = static fn( int $max ) => array( 'type' => 'string', 'maxLength' => $max );
		return array(
			'type'                 => 'object',
			'additionalProperties' => false,
			'required'             => array( 'concepts' ),
			'properties'           => array(
				'concepts'         => array(
					'type'     => 'array',
					'minItems' => 3,
					'maxItems' => 3,
					'items'    => array(
						'type'                 => 'object',
						'additionalProperties' => false,
						'required'             => array( 'variant', 'name', 'name_en', 'tagline', 'differentiation', 'exterior_description', 'massing', 'materials', 'signature_features' ),
						'properties'           => array(
							'variant'              => array( 'type' => 'string', 'enum' => array( 'A', 'B', 'C' ) ),
							'name'                 => $str( 60 ),
							'name_en'              => $str( 60 ),
							'tagline'              => $str( 160 ),
							'differentiation'      => $str( 400 ),
							'exterior_description' => $str( 900 ),
							'massing'              => $str( 400 ),
							'materials'            => array( 'type' => 'array', 'maxItems' => 8, 'items' => $str( 80 ) ),
							'palette'              => array( 'type' => 'array', 'maxItems' => 6, 'items' => array( 'type' => 'string', 'pattern' => '^#[0-9A-Fa-f]{6}$' ) ),
							'signature_features'   => array( 'type' => 'array', 'maxItems' => 6, 'items' => $str( 100 ) ),
							'interior_mood'        => $str( 400 ),
							'room_areas'           => array(
								'type'  => 'array',
								'maxItems' => 40,
								'items' => array(
									'type'                 => 'object',
									'additionalProperties' => false,
									'required'             => array( 'id', 'area' ),
									'properties'           => array(
										'id'   => array( 'type' => 'string', 'maxLength' => 40 ),
										'area' => array( 'type' => 'number', 'minimum' => 1, 'maximum' => 300 ),
									),
								),
							),
						),
					),
				),
				'client_wishes_en' => $str( 800 ),
				'conflicts'        => array( 'type' => 'array', 'maxItems' => 10, 'items' => $str( 300 ) ),
			),
		);
	}

	/**
	 * @return array{concepts:array,source:string,usage:array,conflicts:array,error:string}
	 */
	public static function plan( array $c, string $lang = 'hu_HU' ): array {
		$text = Providers::text();
		if ( $text->configured() && Settings::get( 'anthropic.use_for_plan', true ) ) {
			$res = self::plan_ai( $c, $lang );
			if ( empty( $res['error'] ) ) {
				return $res;
			}
			Logger::warning( 'planner', 'Anthropic planner failed, using rule-based planner', array( 'error' => $res['error'] ) );
			$fallback          = self::plan_rules( $c, $lang );
			$fallback['error'] = $res['error'];
			$fallback['usage'] = $res['usage'];
			return $fallback;
		}
		return self::plan_rules( $c, $lang );
	}

	/**
	 * English name of a display locale for the planner instruction. Covers
	 * every locale of Frontend\I18n::SUPPORTED (plus en_GB); unknown locales
	 * fall back by language prefix, then to Hungarian (source language).
	 */
	public static function language_name( string $locale ): string {
		$map = array(
			'hu_HU' => 'Hungarian',
			'de_DE' => 'German',
			'en_US' => 'English',
			'en_GB' => 'English',
			'ru_RU' => 'Russian',
			'es_ES' => 'Spanish',
			'pl_PL' => 'Polish',
			'hr'    => 'Croatian',
			'ro_RO' => 'Romanian',
			'sl_SI' => 'Slovenian',
			'sk_SK' => 'Slovak',
			'cs_CZ' => 'Czech',
			'fr_FR' => 'French',
			'it_IT' => 'Italian',
			'nl_NL' => 'Dutch',
			'sr_RS' => 'Serbian (Cyrillic script)',
			'uk'    => 'Ukrainian',
		);
		if ( isset( $map[ $locale ] ) ) {
			return $map[ $locale ];
		}
		$prefix = strtolower( substr( $locale, 0, 2 ) );
		foreach ( $map as $loc => $name ) {
			if ( strtolower( substr( $loc, 0, 2 ) ) === $prefix ) {
				return $name;
			}
		}
		return 'Hungarian';
	}

	private static function brief_for_model( array $c ): array {
		$out = array();
		foreach ( Registry::fields() as $id => $def ) {
			if ( in_array( $id, array( 'custom_text', 'project_name', 'house_name' ), true ) || ! empty( $def['hidden'] ) ) {
				continue;
			}
			if ( ! Validator::visible( $def, $c ) || ! array_key_exists( $id, $c ) ) {
				continue;
			}
			$v = $c[ $id ];
			if ( 'roomitems' === $def['type'] ) {
				$out['room_items'] = RoomProgram::item_rooms( $c );
				continue;
			}
			if ( 'build' === $def['type'] ) {
				// the build-mode drawing is geometry, not a parameter to interpret (BuildingModel uses it)
				continue;
			}
			if ( 'layout' === $def['type'] || 'outbuildings' === $def['type'] ) {
				// the hand-made arrangement is not a parameter to interpret, it travels as it is
				$out[ $id ] = is_array( $v ) ? $v : array();
				continue;
			}
			if ( 'rooms' === $def['type'] ) {
				$out['rooms'] = array_map(
					static fn( $r ) => array( 'id' => $r['id'], 'type' => $r['type'], 'name' => $r['name'], 'area' => $r['area'], 'level' => $r['level'] ),
					(array) $v
				);
				continue;
			}
			if ( 'color' === $def['type'] ) {
				$v = $v . ' (' . Color::describe( (string) $v ) . ')';
			} elseif ( isset( $def['prompt_map'] ) && is_scalar( $v ) && isset( $def['prompt_map'][ $v ] ) && '' !== $def['prompt_map'][ $v ] ) {
				$v = $def['prompt_map'][ $v ];
			} elseif ( isset( $def['prompt_map'] ) && is_array( $v ) ) {
				$v = array_values( array_filter( array_map( static fn( $x ) => $def['prompt_map'][ $x ] ?? $x, $v ) ) );
			}
			$out[ $id ] = $v;
		}
		$out['roof_product_resolved'] = Catalog::roof_prompt( (string) ( $c['roof_brand'] ?? '' ), (string) ( $c['roof_product'] ?? '' ) );
		$out['style_direction']       = Catalog::style_direction( (string) ( $c['arch_style'] ?? '' ) );
		$out['explicit_parameters']   = array_values( (array) ( $c['_explicit'] ?? array() ) );
		return $out;
	}

	private static function plan_ai( array $c, string $lang ): array {
		$schema   = self::concept_schema();
		$brief    = self::brief_for_model( $c );
		$client   = Util::clean_text( $c['custom_text'] ?? '', 1500 );
		$language = self::language_name( $lang );
		$user     = "Display language for concept names and taglines: {$language}.\n\nValidated structured parameters (binding):\n"
			. wp_json_encode( $brief, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT )
			. "\n\n<client_text>\n" . str_replace( array( '<', '>' ), array( '‹', '›' ), $client ) . "\n</client_text>\n\n"
			. 'Design the three concept variants now. In client_wishes_en give a short faithful English summary of the client text (descriptive wishes only).';
		$res = Providers::text()->call_tool( DefaultModules::planner_system(), $user, 'submit_concepts', 'Submit the three validated house concept variants.', $schema );
		if ( ! $res['ok'] ) {
			return array( 'concepts' => array(), 'source' => 'anthropic', 'usage' => $res['usage'], 'conflicts' => array(), 'error' => $res['error'] );
		}
		$errors = array();
		$clean  = Schema::validate( $res['input'], $schema, $errors );
		$letters = array_map( static fn( $x ) => $x['variant'] ?? '', (array) ( $clean['concepts'] ?? array() ) );
		sort( $letters );
		if ( array( 'A', 'B', 'C' ) !== $letters ) {
			$errors[] = 'variants must be A, B, C';
		}
		if ( ! empty( $errors ) ) {
			return array( 'concepts' => array(), 'source' => 'anthropic', 'usage' => $res['usage'], 'conflicts' => array(), 'error' => 'Schema validation failed: ' . implode( '; ', array_slice( $errors, 0, 5 ) ) );
		}
		$room_ids = array_flip( array_map( static fn( $r ) => $r['id'], (array) ( $c['rooms'] ?? array() ) ) );
		$concepts = array();
		foreach ( $clean['concepts'] as $k ) {
			$areas = array();
			foreach ( (array) ( $k['room_areas'] ?? array() ) as $ra ) {
				if ( isset( $room_ids[ $ra['id'] ] ) ) {
					$areas[ $ra['id'] ] = (float) $ra['area'];
				}
			}
			$k['room_areas']       = $areas;
			$k['client_wishes_en'] = (string) ( $clean['client_wishes_en'] ?? '' );
			$k['source']           = 'anthropic';
			$concepts[ $k['variant'] ] = $k;
		}
		ksort( $concepts );
		return array(
			'concepts'  => $concepts,
			'source'    => 'anthropic:' . $res['model'],
			'usage'     => $res['usage'],
			'conflicts' => (array) ( $clean['conflicts'] ?? array() ),
			'error'     => '',
		);
	}

	/**
	 * Deterministic planner: varies massing, materials and character per
	 * variant while keeping every explicit parameter.
	 *
	 * Concept names and taglines are translatable strings; they are produced
	 * in the project's display locale ($lang) so the plugin's .mo files apply
	 * even when the plan runs in a background job (site locale).
	 */
	public static function plan_rules( array $c, string $lang = '' ): array {
		// Plain style adjective ("modern minimalist"), not the prompt phrase
		// ("modern minimalist architecture"), so descriptions read "… house".
		$style_def = Registry::get( 'arch_style' );
		$style_key = (string) ( $c['arch_style'] ?? '' );
		$style     = 'custom' === $style_key
			? Util::clean_text( $c['style_custom'] ?? '', 120 )
			: (string) ( $style_def['prompt_map'][ $style_key ] ?? '' );
		$style     = '' !== trim( $style ) ? trim( $style ) : 'contemporary';
		$facade   = PromptEngine::phrase( 'facade_main', $c );
		$color    = Color::describe( (string) ( $c['facade_color'] ?? '#F2EFE9' ), false );
		$roof     = PromptEngine::phrase( 'roof_type', $c );
		$accents  = (array) ( $c['facade_accent'] ?? array() );
		$acc_def  = Registry::get( 'facade_accent' );
		$acc_txt  = array_map( static fn( $a ) => $acc_def['prompt_map'][ $a ] ?? $a, $accents );
		$frame    = Color::describe( (string) ( $c['window_frame_color'] ?? '#2F3235' ), false );
		$explicit = array_flip( (array) ( $c['_explicit'] ?? array() ) );

		$base_materials = array_values( array_filter( array_merge( array( $color . ' ' . str_replace( 'main facade in ', '', $facade ) ), $acc_txt, array( $frame . ' window frames' ) ) ) );

		$texts = static function () {
			return array(
				'A' => array( __( 'Tiszta forma', 'autogrowehome' ), __( 'Letisztult tömeg, nyugodt arányok, racionális alaprajz.', 'autogrowehome' ) ),
				'B' => array( __( 'Természetes melegség', 'autogrowehome' ), __( 'Melegebb anyagok, fa és kő, lágyabb karakter.', 'autogrowehome' ) ),
				'C' => array( __( 'Karakteres prémium', 'autogrowehome' ), __( 'Karakteres építészet, prémium részletek, látványos üvegfelületek.', 'autogrowehome' ) ),
			);
		};
		$t = ( '' !== $lang && isset( I18n::SUPPORTED[ $lang ] ) ) ? I18n::with_locale( $lang, $texts ) : $texts();

		$variants = array(
			'A' => array(
				'name'    => $t['A'][0],
				'name_en' => 'Pure Form',
				'tagline' => $t['A'][1],
				'diff'    => 'the calmest and most rational variant: one clean volume, regular window rhythm, minimal detailing',
				'desc'    => sprintf( 'A calm %s house with a single clean volume, %s, %s, crisp edges and a regular window rhythm.', $style, $roof, $color . ' ' . $facade ),
				'massing' => 'one compact clean volume with flush details',
				'extra'   => array(),
				'feat'    => array( 'regular window rhythm', 'flush minimal details', 'clean roof edges' ),
				'mood'    => 'calm, bright and orderly',
			),
			'B' => array(
				'name'    => $t['B'][0],
				'name_en' => 'Natural Warmth',
				'tagline' => $t['B'][1],
				'diff'    => 'the warmest variant: more natural timber and stone surfaces, elongated volume, deeper terrace',
				'desc'    => sprintf( 'A warm %s house with an elongated volume, %s, generous natural oak timber cladding sections and natural stone accents, deep covered terrace.', $style, $roof ),
				'massing' => 'elongated volume with a deep covered terrace',
				'extra'   => isset( $explicit['facade_accent'] ) ? array() : array( 'warm oak timber cladding', 'natural stone accents' ),
				'feat'    => array( 'large timber-clad sections', 'deep covered terrace', 'stone plinth details' ),
				'mood'    => 'warm, natural, cosy with oak and linen',
			),
			'C' => array(
				'name'    => $t['C'][0],
				'name_en' => 'Signature Premium',
				'tagline' => $t['C'][1],
				'diff'    => 'the most characterful premium variant: articulated massing, contrasting dark accents, large frameless glazing, refined details',
				'desc'    => sprintf( 'A characterful premium %s house with articulated massing, %s, contrasting dark metal accents, oversized frameless glazing and refined lighting.', $style, $roof ),
				'massing' => 'articulated massing with a projecting wing and strong shadow lines',
				'extra'   => isset( $explicit['facade_accent'] ) ? array() : array( 'dark anthracite metal accents' ),
				'feat'    => array( 'oversized frameless glazing', 'contrasting dark accent volume', 'integrated architectural lighting' ),
				'mood'    => 'refined, premium, gallery-like',
			),
		);

		$concepts = array();
		foreach ( $variants as $letter => $v ) {
			$concepts[ $letter ] = array(
				'variant'              => $letter,
				'name'                 => $v['name'],
				'name_en'              => $v['name_en'],
				'tagline'              => $v['tagline'],
				'differentiation'      => $v['diff'],
				'exterior_description' => $v['desc'],
				'massing'              => $v['massing'],
				'materials'            => array_values( array_unique( array_merge( $base_materials, $v['extra'] ) ) ),
				'palette'              => array( (string) ( $c['facade_color'] ?? '#F2EFE9' ), (string) ( $c['roof_color'] ?? '#3A3D40' ), (string) ( $c['facade_accent_color'] ?? '#B9824F' ) ),
				'signature_features'   => $v['feat'],
				'interior_mood'        => $v['mood'],
				'room_areas'           => array(),
				'client_wishes_en'     => '',
				'source'               => 'rules',
			);
		}
		return array( 'concepts' => $concepts, 'source' => 'rules', 'usage' => array(), 'conflicts' => array(), 'error' => '' );
	}

	/**
	 * Interpret free text into suggested parameter values (Anthropic only).
	 *
	 * @return array{ok:bool,suggestions:array,conflicts:array,error:string,usage:array}
	 */
	public static function interpret( array $c, string $lang = '' ): array {
		// Reasons and conflicts are shown to the visitor: write them in the
		// request's display language (the visitor-selected/forced plugin locale
		// when no locale is passed).
		if ( '' === $lang ) {
			$lang = '' !== I18n::$current ? I18n::$current : (string) apply_filters( 'plugin_locale', determine_locale(), 'autogrowehome' );
		}
		$text = Providers::text();
		if ( ! $text->configured() || ! Settings::get( 'anthropic.use_for_interpret', true ) ) {
			return array( 'ok' => false, 'suggestions' => array(), 'conflicts' => array(), 'error' => __( 'Az AI-értelmezés nincs bekapcsolva.', 'autogrowehome' ), 'usage' => array() );
		}
		$client = Util::clean_text( $c['custom_text'] ?? '', 1500 );
		if ( '' === $client ) {
			return array( 'ok' => false, 'suggestions' => array(), 'conflicts' => array(), 'error' => __( 'Nincs értelmezendő szöveg.', 'autogrowehome' ), 'usage' => array() );
		}
		$schema_fields = array();
		foreach ( Registry::fields() as $id => $def ) {
			if ( ! empty( $def['hidden'] ) || in_array( $def['type'], array( 'rooms', 'roomitems', 'layout', 'outbuildings', 'build', 'image', 'textarea' ), true ) || in_array( $id, array( 'project_name', 'house_name' ), true ) ) {
				continue;
			}
			$f = array( 'id' => $id, 'type' => 'catalog' === $def['type'] ? 'select' : $def['type'], 'label' => $def['label'] );
			if ( isset( $def['options'] ) ) {
				$f['allowed'] = array_keys( $def['options'] );
			}
			if ( 'catalog' === $def['type'] ) {
				$f['allowed'] = array_map( static fn( $o ) => $o['value'], Catalog::options_for( $def['catalog'] ) );
			}
			foreach ( array( 'min', 'max', 'unit' ) as $k ) {
				if ( isset( $def[ $k ] ) ) {
					$f[ $k ] = $def[ $k ];
				}
			}
			$f['current']    = $c[ $id ] ?? null;
			$schema_fields[] = $f;
		}
		$tool_schema = array(
			'type'                 => 'object',
			'additionalProperties' => false,
			'required'             => array( 'suggestions' ),
			'properties'           => array(
				'suggestions' => array(
					'type'     => 'array',
					'maxItems' => 30,
					'items'    => array(
						'type'                 => 'object',
						'additionalProperties' => false,
						'required'             => array( 'field', 'value' ),
						'properties'           => array(
							'field'  => array( 'type' => 'string', 'maxLength' => 60 ),
							'value'  => array( 'type' => array( 'string', 'number', 'boolean', 'array' ) ),
							'reason' => array( 'type' => 'string', 'maxLength' => 200 ),
						),
					),
				),
				'conflicts'   => array( 'type' => 'array', 'maxItems' => 10, 'items' => array( 'type' => 'string', 'maxLength' => 300 ) ),
			),
		);
		$user = "Parameter schema (only these fields and allowed values):\n" . wp_json_encode( $schema_fields, JSON_UNESCAPED_UNICODE )
			. "\n\nExplicit parameters already set by the client (do not change): " . wp_json_encode( array_values( (array) ( $c['_explicit'] ?? array() ) ) )
			. "\n\n<client_text>\n" . str_replace( array( '<', '>' ), array( '‹', '›' ), $client ) . "\n</client_text>\n"
			. 'Write reasons and conflicts in ' . self::language_name( $lang ) . '.';
		$res = $text->call_tool( DefaultModules::interpret_system(), $user, 'submit_suggestions', 'Submit suggested parameter values.', $tool_schema, 3000 );
		if ( ! $res['ok'] ) {
			return array( 'ok' => false, 'suggestions' => array(), 'conflicts' => array(), 'error' => $res['error'], 'usage' => $res['usage'] );
		}
		$errors   = array();
		$clean    = Schema::validate( $res['input'], $tool_schema, $errors );
		$explicit = array_flip( (array) ( $c['_explicit'] ?? array() ) );
		$out      = array();
		foreach ( (array) ( $clean['suggestions'] ?? array() ) as $s ) {
			$def = Registry::get( (string) ( $s['field'] ?? '' ) );
			if ( ! $def || ! empty( $def['hidden'] ) || isset( $explicit[ $def['id'] ] ) || in_array( $def['type'], array( 'rooms', 'textarea' ), true ) ) {
				continue;
			}
			$value = Validator::sanitize_value( $def, $s['value'] );
			if ( $value === ( $c[ $def['id'] ] ?? null ) ) {
				continue;
			}
			$out[] = array(
				'field'  => $def['id'],
				'label'  => $def['label'],
				'value'  => $value,
				'reason' => sanitize_text_field( (string) ( $s['reason'] ?? '' ) ),
			);
		}
		return array(
			'ok'          => true,
			'suggestions' => $out,
			'conflicts'   => array_map( 'sanitize_text_field', (array) ( $clean['conflicts'] ?? array() ) ),
			'error'       => '',
			'usage'       => $res['usage'],
		);
	}
}
