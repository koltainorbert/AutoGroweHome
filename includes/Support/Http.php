<?php
/**
 * HTTP wrapper with timeouts, retries on transient errors and JSON handling.
 *
 * Security:
 *  - Requests that carry credentials (x-api-key, x-magnific-api-key,
 *    Authorization) never follow redirects, so a redirect can not make
 *    WordPress re-send the key to another host.
 *  - download() fetches provider result files with wp_safe_remote_get()
 *    semantics on every hop (no private/reserved IPs, standard ports only),
 *    follows at most 3 redirects manually, accepts https only (also for
 *    redirect targets, so no downgrade to http), enforces the size limit and
 *    only accepts PNG/JPEG/WebP images.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Support;

defined( 'ABSPATH' ) || exit;

final class Http {

	/** Header names (lower-case) that carry credentials. */
	private const SECRET_HEADERS = array( 'x-api-key', 'x-magnific-api-key', 'authorization' );

	/** Maximum number of redirects download() follows. */
	private const MAX_REDIRECTS = 3;

	/**
	 * @param array $opts Optional: 'redirection' (int) – maximum redirects to
	 *                    follow. It can only lower the default (2); requests
	 *                    with credential headers always use 0. Callers that
	 *                    send secrets in the BODY (e.g. licence calls) pass
	 *                    array( 'redirection' => 0 ).
	 * @return array{ok:bool,code:int,body:string,json:array,error:string,transient:bool,ms:int}
	 */
	public static function request( string $method, string $url, array $headers = array(), $body = null, int $timeout = 60, int $retries = 0, array $opts = array() ): array {
		$attempt = 0;
		$result  = array();
		$secret  = self::has_secret_header( $headers );
		$redir   = $secret ? 0 : 2;
		if ( isset( $opts['redirection'] ) ) {
			$redir = min( $redir, max( 0, (int) $opts['redirection'] ) );
		}
		do {
			$start = microtime( true );
			$args  = array(
				'method'      => $method,
				'headers'     => $headers,
				'timeout'     => $timeout,
				'redirection' => $redir,
				'sslverify'   => true,
				'user-agent'  => 'AutoGroweHome/' . AGH_VERSION . '; ' . home_url( '/' ),
			);
			if ( null !== $body ) {
				$args['body'] = is_string( $body ) ? $body : wp_json_encode( $body );
			}
			$res = wp_remote_request( $url, $args );
			$ms  = (int) round( ( microtime( true ) - $start ) * 1000 );

			if ( is_wp_error( $res ) ) {
				$result = array(
					'ok'        => false,
					'code'      => 0,
					'body'      => '',
					'json'      => array(),
					'error'     => $res->get_error_message(),
					'transient' => true,
					'ms'        => $ms,
				);
			} else {
				$code   = (int) wp_remote_retrieve_response_code( $res );
				$raw    = (string) wp_remote_retrieve_body( $res );
				$json   = json_decode( $raw, true );
				$result = array(
					'ok'        => $code >= 200 && $code < 300,
					'code'      => $code,
					'body'      => $raw,
					'json'      => is_array( $json ) ? $json : array(),
					'error'     => $code >= 200 && $code < 300 ? '' : self::error_text( $code, is_array( $json ) ? $json : array(), $raw ),
					'transient' => in_array( $code, array( 408, 425, 429, 500, 502, 503, 504, 529 ), true ),
					'ms'        => $ms,
				);
				if ( $code >= 300 && $code < 400 ) {
					$result['error'] = 'HTTP ' . $code . ': redirect not followed (requests carrying credentials never follow redirects)';
				}
			}
			if ( $result['ok'] || ! $result['transient'] || $attempt >= $retries ) {
				break;
			}
			$attempt++;
			usleep( (int) ( self::backoff( $attempt ) * 1000000 ) );
		} while ( true );

		$result['attempts'] = $attempt + 1;
		return $result;
	}

	/**
	 * Bounded exponential back-off before retry $attempt (1-based): 1 s, 2 s, 4 s, max 4 s.
	 */
	private static function backoff( int $attempt ): float {
		return min( 4.0, 0.5 * ( 2 ** $attempt ) );
	}

	/**
	 * Worst-case wall time (seconds) of one request() call: every attempt
	 * running into the timeout plus the back-off pauses between them.
	 */
	public static function worst_case_seconds( int $timeout, int $retries ): int {
		$total = $timeout * ( $retries + 1 );
		for ( $i = 1; $i <= $retries; $i++ ) {
			$total += self::backoff( $i );
		}
		return (int) ceil( $total );
	}

	private static function has_secret_header( array $headers ): bool {
		foreach ( $headers as $name => $value ) {
			if ( in_array( strtolower( (string) $name ), self::SECRET_HEADERS, true ) && '' !== (string) $value ) {
				return true;
			}
		}
		return false;
	}

	private static function error_text( int $code, array $json, string $raw ): string {
		$msg = '';
		if ( isset( $json['error']['message'] ) ) {
			$msg = (string) $json['error']['message'];
		} elseif ( isset( $json['message'] ) ) {
			$msg = (string) $json['message'];
		} elseif ( isset( $json['detail'] ) && is_string( $json['detail'] ) ) {
			$msg = $json['detail'];
		} elseif ( isset( $json['invalid_params'] ) ) {
			$msg = wp_json_encode( $json['invalid_params'] );
		} else {
			$msg = substr( wp_strip_all_tags( $raw ), 0, 300 );
		}
		return 'HTTP ' . $code . ( '' !== $msg ? ': ' . $msg : '' );
	}

	/**
	 * Well-formed https:// URL. The host/IP/port safety check itself is done by
	 * wp_safe_remote_get() (reject_unsafe_urls → wp_http_validate_url()) on
	 * every hop, because download() follows redirects one request at a time.
	 */
	private static function safe_https_url( string $url ): bool {
		return 0 === strpos( $url, 'https://' ) && false !== filter_var( $url, FILTER_VALIDATE_URL );
	}

	/**
	 * Download a remote binary (generated image) with size limit.
	 *
	 * @return array{ok:bool,data:string,error:string,mime:string}
	 */
	public static function download( string $url, int $timeout = 120, int $max_bytes = 60000000 ): array {
		$fail     = static fn( string $e ) => array( 'ok' => false, 'data' => '', 'error' => $e, 'mime' => '' );
		$deadline = microtime( true ) + $timeout;
		$hops     = 0;
		while ( true ) {
			if ( ! self::safe_https_url( $url ) ) {
				return $fail( 0 === $hops ? 'Invalid URL' : 'Unsafe redirect target' );
			}
			$left = (int) ceil( $deadline - microtime( true ) );
			if ( $left < 1 ) {
				return $fail( 'Download timed out' );
			}
			$res = wp_safe_remote_get(
				$url,
				array(
					'timeout'             => $left,
					'limit_response_size' => $max_bytes + 1,
					'redirection'         => 0,
				)
			);
			if ( is_wp_error( $res ) ) {
				return $fail( $res->get_error_message() );
			}
			$code = (int) wp_remote_retrieve_response_code( $res );
			if ( in_array( $code, array( 301, 302, 303, 307, 308 ), true ) ) {
				$location = wp_remote_retrieve_header( $res, 'location' );
				$location = is_array( $location ) ? (string) end( $location ) : (string) $location;
				if ( '' === $location || ++$hops > self::MAX_REDIRECTS ) {
					return $fail( 'Too many or invalid redirects' );
				}
				$url = \WP_Http::make_absolute_url( $location, $url );
				continue;
			}
			break;
		}
		if ( 200 !== $code ) {
			return $fail( 'HTTP ' . $code );
		}
		$length = wp_remote_retrieve_header( $res, 'content-length' );
		$length = (int) ( is_array( $length ) ? end( $length ) : $length );
		$data   = (string) wp_remote_retrieve_body( $res );
		if ( $length > $max_bytes || strlen( $data ) > $max_bytes ) {
			return $fail( 'File too large' );
		}
		$type = wp_remote_retrieve_header( $res, 'content-type' );
		$type = strtolower( trim( explode( ';', (string) ( is_array( $type ) ? end( $type ) : $type ) )[0] ) );
		if ( '' !== $type && 0 !== strpos( $type, 'image/' ) && 'application/octet-stream' !== $type && 'binary/octet-stream' !== $type ) {
			return $fail( 'Unexpected content type: ' . substr( $type, 0, 60 ) );
		}
		$info = @getimagesizefromstring( $data ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
		if ( ! $info || ! in_array( $info['mime'], array( 'image/png', 'image/jpeg', 'image/webp' ), true ) ) {
			return $fail( 'Not a supported image' );
		}
		return array( 'ok' => true, 'data' => $data, 'error' => '', 'mime' => $info['mime'] );
	}
}
