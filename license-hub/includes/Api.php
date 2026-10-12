<?php
/**
 * Licence API spoken by the AutoGroweHome plugin (includes/License/LicenseManager.php there).
 *
 * Base URL to enter in the plugin: rest_url( 'aghls' ), e.g. https://example.com/wp-json/aghls
 *   POST {base}/v1/license/activate | check | deactivate
 *   POST {base}/v1/update/check
 *   GET  {base}/v1/update/package/{version}.zip   (licence in X-AGH-License, instance in X-AGH-Instance)
 *
 * Every answer is { data, signature }: Ed25519 over the canonical JSON of data (sorted top-level keys,
 * unescaped slashes and unicode). The plugin checks the signature, its instance id, its one-time nonce
 * and that issued_at is within ±10 minutes. Unknown or revoked keys get a signed "invalid" answer, so the
 * plugin switches to Starter instead of starting the grace period.
 *
 * @package AGHLicenseHub
 */

defined( 'ABSPATH' ) || exit;

final class AGHLS_Api {

	public static function base_url(): string {
		return untrailingslashit( rest_url( 'aghls' ) );
	}

	public static function routes(): void {
		foreach ( array( 'activate', 'check', 'deactivate' ) as $a ) {
			register_rest_route( AGHLS_NS, '/license/' . $a, array(
				'methods'             => 'POST',
				'permission_callback' => '__return_true',
				'callback'            => function ( WP_REST_Request $r ) use ( $a ) { return self::license( $r, $a ); },
			) );
		}
		register_rest_route( AGHLS_NS, '/update/check', array(
			'methods'             => 'POST',
			'permission_callback' => '__return_true',
			'callback'            => array( __CLASS__, 'update_check' ),
		) );
		register_rest_route( AGHLS_NS, '/update/package/(?P<version>[0-9][0-9A-Za-z.\-]{0,30})\.zip', array(
			'methods'             => 'GET',
			'permission_callback' => '__return_true',
			'callback'            => array( __CLASS__, 'package' ),
		) );
		register_rest_route( AGHLS_NS, '/ping', array(
			'methods'             => 'GET',
			'permission_callback' => '__return_true',
			'callback'            => function () { return array( 'ok' => true, 'service' => 'agh-license-hub', 'public_key' => AGHLS_Crypto::public_key() ); },
		) );
	}

	private static function ip(): string {
		return isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
	}

	/** Simple per-IP limit (requests per minute). */
	private static function limited(): bool {
		$max = (int) get_option( 'aghls_rate_limit', 30 );
		if ( $max <= 0 ) {
			return false;
		}
		$k = 'aghls_rl_' . AGHLS_Crypto::ip_hash( self::ip() ) . '_' . floor( time() / 60 );
		$n = (int) get_transient( $k ) + 1;
		set_transient( $k, $n, 120 );
		return $n > $max;
	}

	private static function err( string $code, string $msg, int $status ): WP_Error {
		return new WP_Error( $code, $msg, array( 'status' => $status ) );
	}

	private static function signed( array $data ): WP_REST_Response {
		$res = new WP_REST_Response( array( 'data' => $data, 'signature' => AGHLS_Crypto::sign( $data ) ), 200 );
		$res->header( 'Cache-Control', 'no-store' );
		return $res;
	}

	/** Common request fields; null when malformed (the plugin then keeps its state / grace period). */
	private static function input( WP_REST_Request $r ): ?array {
		$p = $r->get_json_params();
		$p = is_array( $p ) ? $p : $r->get_body_params();
		$in = array(
			'key'      => (string) ( $p['license_key'] ?? '' ),
			'instance' => (string) ( $p['instance_id'] ?? '' ),
			'nonce'    => (string) ( $p['nonce'] ?? '' ),
			'site'     => esc_url_raw( (string) ( $p['site_url'] ?? '' ) ),
			'version'  => substr( preg_replace( '/[^0-9A-Za-z.\-]/', '', (string) ( $p['plugin_version'] ?? $p['version'] ?? '' ) ), 0, 32 ),
		);
		if ( ! preg_match( '/^[A-Za-z0-9\-]{8,64}$/', $in['instance'] ) || ! preg_match( '/^[a-f0-9]{16,64}$/', $in['nonce'] ) ) {
			return null;
		}
		return $in;
	}

	private static function iso( ?string $dt ): string {
		return $dt ? gmdate( 'Y-m-d\TH:i:s\Z', strtotime( $dt . ' UTC' ) ) : '';
	}

	public static function license( WP_REST_Request $r, string $action ) {
		if ( self::limited() ) {
			return self::err( 'aghls_rate', 'Too many requests', 429 );
		}
		$in = self::input( $r );
		if ( null === $in ) {
			return self::err( 'aghls_bad_request', 'Bad request', 400 );
		}
		$data = array(
			'status'          => 'invalid',
			'plan'            => '',
			'billing_cycle'   => '',
			'expires_at'      => '',
			'sites_allowed'   => 0,
			'sites_used'      => 0,
			'update_entitled' => false,
			'instance_id'     => $in['instance'],
			'nonce'           => $in['nonce'],
			'issued_at'       => time(),
		);
		$lic = preg_match( '/^[A-Za-z0-9\-]{8,80}$/', $in['key'] ) ? AGHLS_Store::by_key( $in['key'] ) : null;
		if ( ! $lic || 'revoked' === $lic['status'] ) {
			AGHLS_Store::log( $lic ? (int) $lic['id'] : 0, $action, 'invalid', $in['site'], self::ip() );
			return self::signed( $data );
		}
		$id = (int) $lic['id'];
		$data['plan']          = $lic['plan'];
		$data['billing_cycle'] = $lic['billing_cycle'];
		$data['expires_at']    = self::iso( $lic['expires_at'] );
		$data['sites_allowed'] = (int) $lic['sites_allowed'];
		if ( ! AGHLS_Store::lock( $id ) ) {
			return self::err( 'aghls_busy', 'Busy, try again', 503 );
		}
		try {
			$act = AGHLS_Store::activation( $id, $in['instance'] );
			$on  = $act && (int) $act['active'];
			if ( 'deactivate' === $action ) {
				if ( $act ) {
					AGHLS_Store::touch_activation( $id, $in['instance'], $in['site'], $in['version'], false );
				}
				$status = 'inactive';
			} elseif ( AGHLS_Store::is_expired( $lic ) ) {
				if ( $act ) {
					AGHLS_Store::touch_activation( $id, $in['instance'], $in['site'], $in['version'], $on );
				}
				$status = 'expired';
			} elseif ( 'check' === $action ) {
				if ( $on ) {
					AGHLS_Store::touch_activation( $id, $in['instance'], $in['site'], $in['version'], true );
				}
				$status = $on ? 'active' : 'inactive';
			} elseif ( $on ) {
				AGHLS_Store::touch_activation( $id, $in['instance'], $in['site'], $in['version'], true );
				$status = 'active';
			} elseif ( AGHLS_Store::sites_used( $id ) >= (int) $lic['sites_allowed'] ) {
				$status = 'site_limit';
			} else {
				AGHLS_Store::touch_activation( $id, $in['instance'], $in['site'], $in['version'], true );
				$status = 'active';
			}
			$data['sites_used'] = AGHLS_Store::sites_used( $id );
		} finally {
			AGHLS_Store::unlock( $id );
		}
		$data['status']          = $status;
		$data['update_entitled'] = 'active' === $status && (int) $lic['updates'] === 1;
		AGHLS_Store::log( $id, $action, $status, $in['site'], self::ip() );
		return self::signed( $data );
	}

	/** Licence + active activation of this instance, or null. */
	private static function entitled( string $key, string $instance ): ?array {
		$lic = preg_match( '/^[A-Za-z0-9\-]{8,80}$/', $key ) ? AGHLS_Store::by_key( $key ) : null;
		if ( ! $lic || 'revoked' === $lic['status'] || AGHLS_Store::is_expired( $lic ) || 1 !== (int) $lic['updates'] ) {
			return null;
		}
		$act = AGHLS_Store::activation( (int) $lic['id'], $instance );
		return $act && (int) $act['active'] ? $lic : null;
	}

	public static function update_check( WP_REST_Request $r ) {
		if ( self::limited() ) {
			return self::err( 'aghls_rate', 'Too many requests', 429 );
		}
		$in = self::input( $r );
		if ( null === $in ) {
			return self::err( 'aghls_bad_request', 'Bad request', 400 );
		}
		$data = array( 'version' => '', 'package' => '', 'sha256' => '', 'requires_php' => '', 'tested' => '', 'instance_id' => $in['instance'], 'nonce' => $in['nonce'], 'issued_at' => time() );
		$lic  = self::entitled( $in['key'], $in['instance'] );
		$rel  = $lic ? AGHLS_Releases::latest() : null;
		if ( $rel ) {
			$data['version']      = $rel['version'];
			$data['package']      = self::base_url() . '/v1/update/package/' . $rel['version'] . '.zip';
			$data['sha256']       = $rel['sha256'];
			$data['requires_php'] = $rel['requires_php'];
			$data['tested']       = $rel['tested'];
		}
		AGHLS_Store::log( $lic ? (int) $lic['id'] : 0, 'update_check', $rel ? $rel['version'] : ( $lic ? 'none' : 'denied' ), $in['site'], self::ip() );
		return self::signed( $data );
	}

	/** Package download: the licence key travels only in headers, never in the URL. */
	public static function package( WP_REST_Request $r ) {
		if ( self::limited() ) {
			return self::err( 'aghls_rate', 'Too many requests', 429 );
		}
		$key = (string) $r->get_header( 'x_agh_license' );
		$ins = (string) $r->get_header( 'x_agh_instance' );
		$lic = self::entitled( $key, $ins );
		$rel = $lic ? AGHLS_Releases::get( (string) $r['version'] ) : null;
		$file = $rel ? AGHLS_Releases::dir() . $rel['file'] : '';
		if ( ! $lic || ! $rel || ! (int) $rel['published'] || ! is_readable( $file ) ) {
			AGHLS_Store::log( $lic ? (int) $lic['id'] : 0, 'download', 'denied', '', self::ip() );
			return self::err( 'aghls_forbidden', 'Not available', 403 );
		}
		AGHLS_Store::log( (int) $lic['id'], 'download', $rel['version'], '', self::ip() );
		if ( defined( 'AGHLS_TESTING' ) ) {
			return array( 'file' => $file, 'sha256' => $rel['sha256'] );
		}
		nocache_headers();
		header( 'Content-Type: application/zip' );
		header( 'Content-Length: ' . filesize( $file ) );
		header( 'Content-Disposition: attachment; filename="autogrowehome-' . $rel['version'] . '.zip"' );
		readfile( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		exit;
	}
}
