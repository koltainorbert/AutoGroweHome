<?php
/**
 * Small helpers.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Support;

defined( 'ABSPATH' ) || exit;

final class Util {

	/**
	 * Site-wide secret path segment for the provider webhook URL. Stateless:
	 * derived from the WordPress auth salt, so only this site knows it.
	 */
	public static function webhook_token(): string {
		return substr( hash_hmac( 'sha256', 'agh-provider-webhook', wp_salt( 'auth' ) ), 0, 32 );
	}

	public static function uuid(): string {
		return wp_generate_uuid4();
	}

	public static function now(): string {
		return gmdate( 'Y-m-d H:i:s' );
	}

	public static function gmt_after( int $seconds ): string {
		return gmdate( 'Y-m-d H:i:s', time() + $seconds );
	}

	public static function is_uuid( $v ): bool {
		return is_string( $v ) && (bool) preg_match( '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $v );
	}

	public static function json( $data ): string {
		return (string) wp_json_encode( $data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
	}

	public static function decode( $json ): array {
		if ( ! is_string( $json ) || '' === $json ) {
			return array();
		}
		$d = json_decode( $json, true );
		return is_array( $d ) ? $d : array();
	}

	/**
	 * Strip control characters and limit length of untrusted free text.
	 */
	public static function clean_text( $value, int $max = 2000 ): string {
		$value = is_scalar( $value ) ? (string) $value : '';
		$value = wp_check_invalid_utf8( $value, true );
		$value = preg_replace( '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value );
		$value = sanitize_textarea_field( $value );
		if ( function_exists( 'mb_substr' ) ) {
			$value = mb_substr( $value, 0, $max );
		} else {
			$value = substr( $value, 0, $max );
		}
		return trim( (string) $value );
	}

	public static function slugify_filename( string $s ): string {
		$s = remove_accents( $s );
		$s = strtolower( preg_replace( '/[^A-Za-z0-9]+/', '-', $s ) );
		return trim( $s, '-' ) ?: 'file';
	}

	/**
	 * Local day string in the configured limit timezone.
	 */
	public static function local_day( string $tz = '', int $start_hour = 0, ?int $ts = null ): string {
		$ts = $ts ?? time();
		try {
			$zone = '' !== $tz ? new \DateTimeZone( $tz ) : wp_timezone();
		} catch ( \Exception $e ) {
			$zone = wp_timezone();
		}
		$dt = ( new \DateTimeImmutable( '@' . ( $ts - $start_hour * 3600 ) ) )->setTimezone( $zone );
		return $dt->format( 'Y-m-d' );
	}
}
