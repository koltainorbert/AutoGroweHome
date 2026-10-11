<?php
/**
 * Database logger with secret redaction.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Support;

use AutoGroweHome\Installer;

defined( 'ABSPATH' ) || exit;

final class Logger {

	private const SECRET_KEYS = array( 'api_key', 'x-api-key', 'x-magnific-api-key', 'authorization', 'password', 'token', 'license_key', 'image', 'input_image', 'structure_reference', 'style_reference' );

	public static function info( string $channel, string $message, array $context = array(), int $project_id = 0 ): void {
		self::log( 'info', $channel, $message, $context, $project_id );
	}

	public static function warning( string $channel, string $message, array $context = array(), int $project_id = 0 ): void {
		self::log( 'warning', $channel, $message, $context, $project_id );
	}

	public static function error( string $channel, string $message, array $context = array(), int $project_id = 0 ): void {
		self::log( 'error', $channel, $message, $context, $project_id );
	}

	public static function log( string $level, string $channel, string $message, array $context = array(), int $project_id = 0 ): void {
		global $wpdb;
		$wpdb->insert(
			Installer::table( 'logs' ),
			array(
				'level'      => substr( $level, 0, 10 ),
				'channel'    => substr( $channel, 0, 40 ),
				'message'    => substr( self::redact_text( $message ), 0, 2000 ),
				'context'    => Util::json( self::redact( $context ) ),
				'project_id' => $project_id,
				'created_at' => Util::now(),
			),
			array( '%s', '%s', '%s', '%s', '%d', '%s' )
		);
	}

	/**
	 * Remove secrets and large binary payloads recursively.
	 *
	 * @param mixed $data Data.
	 * @return mixed
	 */
	public static function redact( $data ) {
		if ( is_array( $data ) ) {
			$out = array();
			foreach ( $data as $k => $v ) {
				if ( is_string( $k ) && in_array( strtolower( $k ), self::SECRET_KEYS, true ) ) {
					$out[ $k ] = '[redacted]';
					continue;
				}
				$out[ $k ] = self::redact( $v );
			}
			return $out;
		}
		if ( is_string( $data ) ) {
			if ( strlen( $data ) > 4000 ) {
				$data = substr( $data, 0, 400 ) . '…[' . strlen( $data ) . ' bytes]';
			}
			return self::redact_text( $data );
		}
		return $data;
	}

	/**
	 * Mask secrets inside free text (log messages, error strings, context values):
	 *  - Anthropic keys (sk-ant-…), other "sk-…" style keys;
	 *  - "Bearer …" tokens and Authorization / x-api-key / x-magnific-api-key /
	 *    api_key / token / password header or parameter values (key: value,
	 *    key=value, "key":"value");
	 *  - AutoGroweHome licence keys (AGH-XXXXX-…);
	 *  - long opaque key-like strings (32+ chars of letters/digits/_-, which
	 *    also covers Magnific API keys); UUIDs (task ids) stay readable.
	 */
	public static function redact_text( string $s ): string {
		$patterns = array(
			'/\b(sk-ant-[A-Za-z0-9_\-]{6})[A-Za-z0-9_\-]+/'                            => '$1…',
			'/\b(sk-[A-Za-z0-9]{4})[A-Za-z0-9_\-]{12,}/'                               => '$1…',
			'/\b(Bearer\s+)[A-Za-z0-9._~+\/=\-]{8,}/i'                                 => '$1[redacted]',
			'/((?:x-magnific-api-key|x-api-key|api[_-]?key|authorization|password|passwd|secret|token|license[_-]?key)["\']?\s*[:=]\s*["\']?)(?!\[redacted\])[^\s"\'&,;}]{4,}/i' => '$1[redacted]',
			'/\bAGH(-[A-Z0-9]{4,})+\b/'                                                => 'AGH-[redacted]',
			'/(?<![A-Za-z0-9_\-])(?![0-9a-fA-F]{8}-[0-9a-fA-F]{4}-)[A-Za-z0-9_\-]{32,}(?![A-Za-z0-9_\-])/' => '[redacted]',
		);
		return (string) preg_replace( array_keys( $patterns ), array_values( $patterns ), $s );
	}

	public static function recent( int $limit = 100, string $level = '' ): array {
		global $wpdb;
		$t = Installer::table( 'logs' );
		if ( '' !== $level ) {
			return $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$t} WHERE level = %s ORDER BY id DESC LIMIT %d", $level, $limit ), ARRAY_A ) ?: array(); // phpcs:ignore
		}
		return $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$t} ORDER BY id DESC LIMIT %d", $limit ), ARRAY_A ) ?: array(); // phpcs:ignore
	}
}
