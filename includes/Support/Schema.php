<?php
/**
 * Minimal, strict JSON-schema subset validator used to verify AI output
 * before it is accepted as input for plans or prompts.
 *
 * Supported keywords: type, properties, required, enum, minimum, maximum,
 * minLength, maxLength, items, minItems, maxItems, additionalProperties(false), pattern.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Support;

defined( 'ABSPATH' ) || exit;

final class Schema {

	/**
	 * @param mixed $data   Data to validate.
	 * @param array $schema Schema.
	 * @param array $errors Collected errors (by ref).
	 * @param string $path  Current path.
	 * @return mixed Cleaned data (unknown properties dropped when additionalProperties=false).
	 */
	public static function validate( $data, array $schema, array &$errors, string $path = '$' ) {
		$type = $schema['type'] ?? null;

		if ( null !== $type && ! self::type_ok( $data, $type ) ) {
			$errors[] = "{$path}: expected {$type}";
			return null;
		}

		if ( isset( $schema['enum'] ) && ! in_array( $data, $schema['enum'], true ) ) {
			$errors[] = "{$path}: value not allowed";
			return null;
		}

		if ( is_string( $data ) ) {
			$len = function_exists( 'mb_strlen' ) ? mb_strlen( $data ) : strlen( $data );
			if ( isset( $schema['minLength'] ) && $len < $schema['minLength'] ) {
				$errors[] = "{$path}: too short";
			}
			if ( isset( $schema['maxLength'] ) && $len > $schema['maxLength'] ) {
				$data = function_exists( 'mb_substr' ) ? mb_substr( $data, 0, $schema['maxLength'] ) : substr( $data, 0, $schema['maxLength'] );
			}
			if ( isset( $schema['pattern'] ) && ! preg_match( '/' . $schema['pattern'] . '/u', $data ) ) {
				$errors[] = "{$path}: pattern mismatch";
			}
			return $data;
		}

		if ( is_int( $data ) || is_float( $data ) ) {
			if ( isset( $schema['minimum'] ) && $data < $schema['minimum'] ) {
				$errors[] = "{$path}: below minimum";
			}
			if ( isset( $schema['maximum'] ) && $data > $schema['maximum'] ) {
				$errors[] = "{$path}: above maximum";
			}
			return $data;
		}

		if ( 'array' === $type ) {
			$count = count( $data );
			if ( isset( $schema['minItems'] ) && $count < $schema['minItems'] ) {
				$errors[] = "{$path}: too few items";
			}
			if ( isset( $schema['maxItems'] ) && $count > $schema['maxItems'] ) {
				$data = array_slice( $data, 0, $schema['maxItems'] );
			}
			$out = array();
			foreach ( array_values( $data ) as $i => $item ) {
				$out[] = isset( $schema['items'] ) ? self::validate( $item, $schema['items'], $errors, "{$path}[{$i}]" ) : $item;
			}
			return $out;
		}

		if ( 'object' === $type ) {
			$out   = array();
			$props = $schema['properties'] ?? array();
			foreach ( (array) ( $schema['required'] ?? array() ) as $req ) {
				if ( ! array_key_exists( $req, $data ) ) {
					$errors[] = "{$path}.{$req}: required";
				}
			}
			foreach ( $data as $k => $v ) {
				if ( isset( $props[ $k ] ) ) {
					$out[ $k ] = self::validate( $v, $props[ $k ], $errors, "{$path}.{$k}" );
				} elseif ( ! isset( $schema['additionalProperties'] ) || false !== $schema['additionalProperties'] ) {
					$out[ $k ] = $v;
				}
			}
			return $out;
		}

		return $data;
	}

	private static function type_ok( $data, $type ): bool {
		$types = (array) $type;
		foreach ( $types as $t ) {
			switch ( $t ) {
				case 'string':
					if ( is_string( $data ) ) {
						return true;
					}
					break;
				case 'integer':
					if ( is_int( $data ) ) {
						return true;
					}
					break;
				case 'number':
					if ( is_int( $data ) || is_float( $data ) ) {
						return true;
					}
					break;
				case 'boolean':
					if ( is_bool( $data ) ) {
						return true;
					}
					break;
				case 'array':
					if ( is_array( $data ) && ( array() === $data || wp_is_numeric_array( $data ) ) ) {
						return true;
					}
					break;
				case 'object':
					if ( is_array( $data ) && ( array() === $data || ! wp_is_numeric_array( $data ) ) ) {
						return true;
					}
					break;
				case 'null':
					if ( null === $data ) {
						return true;
					}
					break;
			}
		}
		return false;
	}
}
