<?php
/**
 * Commercial licence module (separate from AI providers and usage costs).
 *
 * Talks to a configurable licence server over HTTPS. Every server response
 * must be signed with the server's Ed25519 key (sodium); the plugin verifies
 * the signature with the configured public key, the instance id, its own
 * one-time nonce and a ±10 minute freshness window. Failures never delete
 * settings or projects: an unreachable, failing or unverifiable server starts
 * the grace period for a working licence (status "unreachable", counted from
 * the last verified check), after which premium features switch off (Starter
 * keeps working). Licence and update calls never follow redirects (the key is
 * in the request body).
 *
 * Updates: the signed update data carries the package's SHA-256; the ZIP is
 * downloaded by this class (upgrader_pre_download) and installed only when
 * the checksum matches.
 *
 * Reference server contract: docs/LICENC-ES-ELOFIZETES.md, tools/license-server/.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\License;

use AutoGroweHome\Support\Http;
use AutoGroweHome\Support\Logger;
use AutoGroweHome\Support\Secrets;

defined( 'ABSPATH' ) || exit;

final class LicenseManager {

	public const OPTION     = 'agh_license';
	public const GRACE_DAYS = 14;

	public static function config(): array {
		$o = get_option( 'agh_license_server', array() );
		$o = is_array( $o ) ? $o : array();
		return array(
			'url'        => defined( 'AGH_LICENSE_SERVER' ) ? (string) AGH_LICENSE_SERVER : (string) ( $o['url'] ?? '' ),
			'public_key' => defined( 'AGH_LICENSE_PUBKEY' ) ? (string) AGH_LICENSE_PUBKEY : (string) ( $o['public_key'] ?? '' ),
		);
	}

	public static function state(): array {
		$s = get_option( self::OPTION, array() );
		return array_merge(
			array(
				'status'          => 'inactive',
				'plan'            => '',
				'expires_at'      => '',
				'sites_allowed'   => 0,
				'sites_used'      => 0,
				'update_entitled' => false,
				'last_check'      => 0,
				'last_ok'         => 0,
				'last_error'      => '',
				'instance_id'     => '',
			),
			is_array( $s ) ? $s : array()
		);
	}

	private static function save_state( array $s ): void {
		update_option( self::OPTION, $s, false );
	}

	public static function instance_id(): string {
		$s = self::state();
		if ( '' === $s['instance_id'] ) {
			$s['instance_id'] = wp_generate_uuid4();
			self::save_state( $s );
		}
		return $s['instance_id'];
	}

	/**
	 * Plan used for feature gating.
	 */
	public static function effective_plan(): string {
		$s = self::state();
		if ( '' === $s['plan'] ) {
			return 'starter';
		}
		$expired = '' !== $s['expires_at'] && strtotime( $s['expires_at'] ) < time();
		if ( 'active' === $s['status'] && ! $expired ) {
			return $s['plan'];
		}
		// Grace: server unreachable but last successful check is recent.
		if ( 'unreachable' === $s['status'] && ! $expired && $s['last_ok'] > time() - self::GRACE_DAYS * DAY_IN_SECONDS ) {
			return $s['plan'];
		}
		return 'starter';
	}

	public static function activate( string $key ): array {
		$key = trim( $key );
		if ( ! preg_match( '/^[A-Za-z0-9\-]{8,80}$/', $key ) ) {
			return array( 'ok' => false, 'message' => __( 'Érvénytelen licenckulcs-formátum.', 'autogrowehome' ) );
		}
		Secrets::set( 'license_key', $key );
		return self::call( 'activate' );
	}

	public static function deactivate(): array {
		$res = self::call( 'deactivate' );
		Secrets::set( 'license_key', '' );
		$s           = self::state();
		$s['status'] = 'inactive';
		$s['plan']   = '';
		self::save_state( $s );
		return $res;
	}

	public static function check(): array {
		if ( ! Secrets::has( 'license_key' ) ) {
			return array( 'ok' => false, 'message' => __( 'Nincs licenckulcs.', 'autogrowehome' ) );
		}
		return self::call( 'check' );
	}

	/**
	 * Authenticated request to the licence server.
	 */
	private static function call( string $action ): array {
		$cfg      = self::config();
		$instance = self::instance_id(); // Persist the id before the state snapshot below.
		$s        = self::state();
		if ( '' === $cfg['url'] || 0 !== strpos( $cfg['url'], 'https://' ) ) {
			return array( 'ok' => false, 'message' => __( 'Nincs beállítva HTTPS licencszerver.', 'autogrowehome' ) );
		}
		if ( '' === $cfg['public_key'] || ! function_exists( 'sodium_crypto_sign_verify_detached' ) ) {
			return array( 'ok' => false, 'message' => __( 'Hiányzik a licencszerver nyilvános kulcsa vagy a sodium kiterjesztés.', 'autogrowehome' ) );
		}
		$nonce = bin2hex( random_bytes( 12 ) );
		$body  = array(
			'action'         => $action,
			'license_key'    => Secrets::get( 'license_key' ),
			'site_url'       => home_url( '/' ),
			'instance_id'    => $instance,
			'plugin_version' => AGH_VERSION,
			'nonce'          => $nonce,
		);
		// No redirects: the licence key travels in the request body.
		$resp = Http::request( 'POST', untrailingslashit( $cfg['url'] ) . '/v1/license/' . $action, array( 'Content-Type' => 'application/json' ), $body, 20, 1, array( 'redirection' => 0 ) );
		$s['last_check'] = time();
		// Any failure below (network, HTTP error, bad signature, stale or foreign
		// response) only starts / continues the grace period: the stored plan is
		// kept but last_ok is not refreshed, so a broken or forged server cannot
		// keep premium features on beyond GRACE_DAYS after the last verified check.
		if ( ! $resp['ok'] ) {
			self::start_grace( $s, $resp['error'] );
			if ( $resp['transient'] || 0 === $resp['code'] ) {
				return array( 'ok' => false, 'message' => __( 'A licencszerver átmenetileg nem érhető el; a korábbi állapot érvényes a türelmi idő végéig.', 'autogrowehome' ) );
			}
			return array( 'ok' => false, 'message' => $resp['error'] );
		}
		$data = $resp['json']['data'] ?? null;
		$sig  = (string) ( $resp['json']['signature'] ?? '' );
		if ( ! is_array( $data ) || ! self::verify( $data, $sig, $cfg['public_key'] ) ) {
			self::start_grace( $s, 'Invalid signature' );
			Logger::warning( 'license', 'Licence response signature invalid' );
			return array( 'ok' => false, 'message' => __( 'A licencszerver válaszának aláírása érvénytelen.', 'autogrowehome' ) );
		}
		if ( ( $data['instance_id'] ?? '' ) !== $instance || ( $data['nonce'] ?? '' ) !== $nonce || abs( time() - (int) ( $data['issued_at'] ?? 0 ) ) > 600 ) {
			self::start_grace( $s, 'Response does not match the request (instance, nonce or time)' );
			return array( 'ok' => false, 'message' => __( 'A licencválasz nem ehhez a kéréshez tartozik.', 'autogrowehome' ) );
		}
		$plans                = Features::plans();
		$s['status']          = in_array( $data['status'] ?? '', array( 'active', 'expired', 'invalid', 'inactive', 'site_limit' ), true ) ? $data['status'] : 'invalid';
		$s['plan']            = isset( $plans[ $data['plan'] ?? '' ] ) ? $data['plan'] : '';
		$s['expires_at']      = sanitize_text_field( (string) ( $data['expires_at'] ?? '' ) );
		$s['sites_allowed']   = (int) ( $data['sites_allowed'] ?? 0 );
		$s['sites_used']      = (int) ( $data['sites_used'] ?? 0 );
		$s['update_entitled'] = ! empty( $data['update_entitled'] );
		$s['last_error']      = '';
		if ( 'active' === $s['status'] ) {
			$s['last_ok'] = time();
		}
		if ( 'deactivate' === $action ) {
			$s['status'] = 'inactive';
		}
		self::save_state( $s );
		Logger::info( 'license', 'Licence ' . $action . ': ' . $s['status'], array( 'plan' => $s['plan'] ) );
		return array( 'ok' => 'active' === $s['status'] || 'deactivate' === $action, 'message' => self::status_label( $s['status'] ) );
	}

	/**
	 * Failed or unverifiable check: record the error and – only when the
	 * licence was working before (status active, or already in grace) – keep
	 * the last verified plan under the grace status. An inactive, expired,
	 * invalid or site-limited licence stays as it is: a server error must
	 * never switch a plan back on for the grace period.
	 */
	private static function start_grace( array $s, string $error ): void {
		if ( '' !== $s['plan'] && in_array( $s['status'], array( 'active', 'unreachable' ), true ) ) {
			$s['status'] = 'unreachable';
		}
		$s['last_error'] = substr( $error, 0, 300 );
		self::save_state( $s );
	}

	/**
	 * Canonical JSON (sorted keys) signed by the server.
	 */
	public static function canonical( array $data ): string {
		ksort( $data );
		return (string) wp_json_encode( $data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
	}

	public static function verify( array $data, string $sig_b64, string $pub_b64 ): bool {
		$sig = base64_decode( $sig_b64, true );
		$pub = base64_decode( $pub_b64, true );
		if ( false === $sig || false === $pub || SODIUM_CRYPTO_SIGN_BYTES !== strlen( $sig ) || SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES !== strlen( $pub ) ) {
			return false;
		}
		return sodium_crypto_sign_verify_detached( $sig, self::canonical( $data ), $pub );
	}

	public static function status_label( string $status ): string {
		$map = array(
			'active'      => __( 'Aktív', 'autogrowehome' ),
			'expired'     => __( 'Lejárt', 'autogrowehome' ),
			'invalid'     => __( 'Érvénytelen', 'autogrowehome' ),
			'inactive'    => __( 'Nincs aktiválva', 'autogrowehome' ),
			'site_limit'  => __( 'Elérte a weboldal-limitet', 'autogrowehome' ),
			'unreachable' => __( 'Szerver nem elérhető (türelmi idő)', 'autogrowehome' ),
		);
		return $map[ $status ] ?? $status;
	}

	/**
	 * Expiry notice for admins (14 days before).
	 */
	public static function expiry_notice(): string {
		$s = self::state();
		if ( 'active' !== $s['status'] || '' === $s['expires_at'] ) {
			return '';
		}
		$left = ( strtotime( $s['expires_at'] ) - time() ) / DAY_IN_SECONDS;
		if ( $left > 0 && $left <= 14 ) {
			return sprintf( /* translators: %d: days */ __( 'Az AutoGroweHome licenc %d napon belül lejár. A projektek és beállítások lejárat után is megmaradnak, de a prémium funkciók kikapcsolnak.', 'autogrowehome' ), (int) ceil( $left ) );
		}
		return '';
	}

	/**
	 * Configured licence server usable for updates (HTTPS + public key).
	 */
	private static function update_server(): ?array {
		$cfg = self::config();
		if ( '' === $cfg['url'] || 0 !== strpos( $cfg['url'], 'https://' ) || '' === $cfg['public_key'] || ! function_exists( 'sodium_crypto_sign_verify_detached' ) ) {
			return null;
		}
		return $cfg;
	}

	/**
	 * Verified update data (cached 12 h in the agh_update_info site transient).
	 * The request carries a one-time nonce; the signed answer must echo it,
	 * belong to this instance and be fresh (±10 min) – otherwise it is ignored.
	 *
	 * @return array Empty when unavailable/invalid; else version, package, sha256, …
	 */
	public static function update_info( bool $force = false ): array {
		$cfg = self::update_server();
		if ( null === $cfg ) {
			return array();
		}
		$cached = $force ? false : get_site_transient( 'agh_update_info' );
		if ( is_array( $cached ) ) {
			return $cached;
		}
		$nonce = bin2hex( random_bytes( 12 ) );
		$resp  = Http::request( 'POST', untrailingslashit( $cfg['url'] ) . '/v1/update/check', array( 'Content-Type' => 'application/json' ), array( 'license_key' => Secrets::get( 'license_key' ), 'instance_id' => self::instance_id(), 'version' => AGH_VERSION, 'site_url' => home_url( '/' ), 'nonce' => $nonce ), 15, 0, array( 'redirection' => 0 ) ); // No redirects: key in the body.
		$data  = $resp['ok'] ? ( $resp['json']['data'] ?? array() ) : array();
		$valid = $resp['ok'] && is_array( $data ) && self::verify( $data, (string) ( $resp['json']['signature'] ?? '' ), $cfg['public_key'] )
			&& ( $data['instance_id'] ?? '' ) === self::instance_id()
			&& hash_equals( $nonce, (string) ( $data['nonce'] ?? '' ) )
			&& abs( time() - (int) ( $data['issued_at'] ?? 0 ) ) <= 600;
		if ( $resp['ok'] && ! $valid ) {
			Logger::warning( 'license', 'Update information rejected (signature, instance, nonce or freshness)' );
		}
		$info = $valid ? $data : array();
		set_site_transient( 'agh_update_info', $info, 12 * HOUR_IN_SECONDS );
		return $info;
	}

	/**
	 * Update check against the licence server (only with entitlement, only over
	 * HTTPS and only with a SHA-256 checksum for the package).
	 */
	public static function filter_updates( $transient ) {
		if ( ! is_object( $transient ) || empty( $transient->checked ) ) {
			return $transient;
		}
		$s   = self::state();
		$cfg = self::update_server();
		if ( ! $s['update_entitled'] || null === $cfg || ! Secrets::has( 'license_key' ) ) {
			return $transient;
		}
		$cached = self::update_info();
		if ( ! empty( $cached['version'] ) && version_compare( (string) $cached['version'], AGH_VERSION, '>' ) && ! empty( $cached['package'] ) && 0 === strpos( (string) $cached['package'], untrailingslashit( $cfg['url'] ) . '/v1/update/package/' ) && preg_match( '/^[a-f0-9]{64}$/', (string) ( $cached['sha256'] ?? '' ) ) ) {
			$transient->response[ AGH_BASENAME ] = (object) array(
				'slug'        => 'autogrowehome',
				'plugin'      => AGH_BASENAME,
				'new_version' => (string) $cached['version'],
				'package'     => (string) $cached['package'],
				'requires_php'=> (string) ( $cached['requires_php'] ?? '8.0' ),
				'tested'      => (string) ( $cached['tested'] ?? '' ),
			);
		}
		return $transient;
	}

	/**
	 * Download our update package ourselves and verify its SHA-256 against the
	 * signed update data before WordPress unpacks it (upgrader_pre_download).
	 * The licence headers are added by package_auth() (http_request_args).
	 *
	 * @param bool|string|\WP_Error $reply   Short-circuit value from earlier filters.
	 * @param string                 $package Package URL.
	 * @return bool|string|\WP_Error Local file path, WP_Error, or $reply for foreign packages.
	 */
	public static function pre_download( $reply, $package ) {
		$cfg = self::update_server();
		if ( false !== $reply || null === $cfg || ! is_string( $package ) || 0 !== strpos( $package, untrailingslashit( $cfg['url'] ) . '/v1/update/package/' ) ) {
			return $reply;
		}
		$info = self::update_info();
		if ( ( $info['package'] ?? '' ) !== $package ) {
			$info = self::update_info( true );
		}
		$expected = (string) ( $info['sha256'] ?? '' );
		if ( ( $info['package'] ?? '' ) !== $package || ! preg_match( '/^[a-f0-9]{64}$/', $expected ) ) {
			return new \WP_Error( 'agh_update_unverified', __( 'A frissítőcsomag nem ellenőrizhető (hiányzó vagy érvénytelen aláírt ellenőrzőösszeg).', 'autogrowehome' ) );
		}
		if ( ! function_exists( 'download_url' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}
		$tmp = download_url( $package, 300 );
		if ( is_wp_error( $tmp ) ) {
			return $tmp;
		}
		$actual = (string) hash_file( 'sha256', $tmp );
		if ( ! hash_equals( $expected, $actual ) ) {
			wp_delete_file( $tmp );
			Logger::error( 'license', 'Update package checksum mismatch', array( 'package' => basename( $package ) ) );
			return new \WP_Error( 'agh_update_checksum', __( 'A letöltött frissítőcsomag ellenőrzőösszege nem egyezik; a telepítés megszakítva.', 'autogrowehome' ) );
		}
		return $tmp;
	}

	/**
	 * The update package is downloaded by the WordPress upgrader. The licence
	 * key travels in request headers (never in the package URL), and only to
	 * the configured licence server's package endpoint over HTTPS.
	 *
	 * @param array  $args HTTP request arguments.
	 * @param string $url  Request URL.
	 */
	public static function package_auth( $args, $url ) {
		$cfg = self::config();
		if ( '' === $cfg['url'] || 0 !== strpos( $cfg['url'], 'https://' ) || ! is_string( $url ) ) {
			return $args;
		}
		$prefix = untrailingslashit( $cfg['url'] ) . '/v1/update/package/';
		if ( 0 !== strpos( $url, $prefix ) || ! Secrets::has( 'license_key' ) ) {
			return $args;
		}
		$args['headers']                   = isset( $args['headers'] ) && is_array( $args['headers'] ) ? $args['headers'] : array();
		$args['headers']['X-AGH-License']  = Secrets::get( 'license_key' );
		$args['headers']['X-AGH-Instance'] = self::instance_id();
		$args['sslverify']                 = true;
		$args['redirection']               = 0;
		return $args;
	}
}
