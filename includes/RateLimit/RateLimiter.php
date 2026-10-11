<?php
/**
 * Atomic, backend-enforced generation limits.
 *
 * A "full request" (three concepts) consumes exactly one unit; rebuilding a
 * single concept consumes one "gallery" unit instead. Each scope is
 * reserved with a single conditional UPDATE (hits < limit), so parallel
 * requests cannot exceed the limit. IPs are stored only as keyed hashes.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\RateLimit;

use AutoGroweHome\Installer;
use AutoGroweHome\License\Features;
use AutoGroweHome\Support\Ip;
use AutoGroweHome\Support\Settings;
use AutoGroweHome\Support\Util;

defined( 'ABSPATH' ) || exit;

final class RateLimiter {

	public static function day(): string {
		return Util::local_day( (string) Settings::get( 'limits.timezone', '' ), (int) Settings::get( 'limits.day_start_hour', 0 ) );
	}

	public static function ip_limit(): int {
		$admin = (int) Settings::get( 'limits.ip_daily', 3 );
		$plan  = Features::limit( 'max_ip_daily', null );
		if ( null !== $plan && $admin > 0 ) {
			return min( $admin, (int) $plan );
		}
		return null !== $plan ? (int) $plan : $admin;
	}

	/**
	 * Scopes to check for the current visitor.
	 *
	 * @return array<int,array{bucket:string,period:string,scope:string,limit:int,label:string}>
	 */
	public static function scopes( string $ip_hash, int $user_id, string $kind = 'generate' ): array {
		$day    = self::day();
		$scopes = array();
		if ( 'gallery' === $kind ) {
			// Single-concept rebuilds (REST /projects/{id}/regenerate): their own
			// daily allowance per IP and – for logged-in visitors – per user.
			// 0 = unlimited (like the other limits).
			$g = (int) Settings::get( 'limits.gallery_rebuilds_per_day', 2 );
			if ( $g > 0 ) {
				$scopes[] = array( 'bucket' => $ip_hash, 'period' => $day, 'scope' => 'gallery', 'limit' => $g, 'label' => 'gallery' );
				if ( $user_id > 0 ) {
					$scopes[] = array( 'bucket' => hash( 'sha256', 'user|' . $user_id ), 'period' => $day, 'scope' => 'gallery_user', 'limit' => $g, 'label' => 'gallery' );
				}
			}
			return $scopes;
		}
		$ip = self::ip_limit();
		if ( $ip > 0 ) {
			$scopes[] = array( 'bucket' => $ip_hash, 'period' => $day, 'scope' => 'ip', 'limit' => $ip, 'label' => 'ip' );
		}
		$ud = (int) Settings::get( 'limits.user_daily', 0 );
		if ( $user_id > 0 && $ud > 0 ) {
			$scopes[] = array( 'bucket' => hash( 'sha256', 'user|' . $user_id ), 'period' => $day, 'scope' => 'user', 'limit' => $ud, 'label' => 'user' );
		}
		$gl = (int) Settings::get( 'limits.global_daily', 0 );
		if ( $gl > 0 ) {
			$scopes[] = array( 'bucket' => hash( 'sha256', 'global' ), 'period' => $day, 'scope' => 'global', 'limit' => $gl, 'label' => 'global' );
		}
		$bw = max( 1, (int) Settings::get( 'limits.burst_window_min', 10 ) );
		$bm = (int) Settings::get( 'limits.burst_max', 2 );
		if ( $bm > 0 ) {
			$scopes[] = array( 'bucket' => $ip_hash, 'period' => 'w' . (string) intdiv( time(), $bw * 60 ), 'scope' => 'burst', 'limit' => $bm, 'label' => 'burst' );
		}
		return $scopes;
	}

	/**
	 * Try to reserve one unit in all scopes. All-or-nothing.
	 *
	 * @return array{ok:bool,reserved:array,failed:string}
	 */
	public static function reserve( string $ip_hash, int $user_id, string $kind = 'generate' ): array {
		global $wpdb;
		$t        = Installer::table( 'rate' );
		$reserved = array();
		foreach ( self::scopes( $ip_hash, $user_id, $kind ) as $s ) {
			$wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$t} (bucket, period, scope, hits, updated_at) VALUES (%s, %s, %s, 0, %s)", $s['bucket'], $s['period'], $s['scope'], Util::now() ) ); // phpcs:ignore
			$affected = $wpdb->query( $wpdb->prepare( "UPDATE {$t} SET hits = hits + 1, updated_at = %s WHERE bucket = %s AND period = %s AND scope = %s AND hits < %d", Util::now(), $s['bucket'], $s['period'], $s['scope'], $s['limit'] ) ); // phpcs:ignore
			if ( 1 !== (int) $affected ) {
				self::release( $reserved );
				return array( 'ok' => false, 'reserved' => array(), 'failed' => $s['label'] );
			}
			$reserved[] = array( 'bucket' => $s['bucket'], 'period' => $s['period'], 'scope' => $s['scope'] );
		}
		return array( 'ok' => true, 'reserved' => $reserved, 'failed' => '' );
	}

	/**
	 * Single-scope daily reservation for secondary abuse protection (quotes, interpret, events).
	 */
	public static function reserve_custom( string $bucket, string $scope, int $limit ): bool {
		global $wpdb;
		$t   = Installer::table( 'rate' );
		$day = self::day();
		$wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$t} (bucket, period, scope, hits, updated_at) VALUES (%s, %s, %s, 0, %s)", $bucket, $day, $scope, Util::now() ) ); // phpcs:ignore
		return 1 === (int) $wpdb->query( $wpdb->prepare( "UPDATE {$t} SET hits = hits + 1, updated_at = %s WHERE bucket = %s AND period = %s AND scope = %s AND hits < %d", Util::now(), $bucket, $day, $scope, $limit ) ); // phpcs:ignore
	}

	/**
	 * Give back reserved units (e.g. when the request fails before any provider cost).
	 */
	public static function release( array $reserved ): void {
		global $wpdb;
		$t = Installer::table( 'rate' );
		foreach ( $reserved as $s ) {
			$wpdb->query( $wpdb->prepare( "UPDATE {$t} SET hits = hits - 1 WHERE bucket = %s AND period = %s AND scope = %s AND hits > 0", $s['bucket'], $s['period'], $s['scope'] ) ); // phpcs:ignore
		}
	}

	public static function used( string $ip_hash, string $scope = 'ip' ): int {
		global $wpdb;
		$t = Installer::table( 'rate' );
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT hits FROM {$t} WHERE bucket = %s AND period = %s AND scope = %s", $ip_hash, self::day(), $scope ) ); // phpcs:ignore
	}

	public static function status_for_current(): array {
		$hash  = Ip::hash();
		$limit = self::ip_limit();
		$used  = self::used( $hash );
		$g     = (int) Settings::get( 'limits.gallery_rebuilds_per_day', 2 );
		$g_used = self::used( $hash, 'gallery' );
		if ( get_current_user_id() > 0 ) {
			$g_used = max( $g_used, self::used( hash( 'sha256', 'user|' . get_current_user_id() ), 'gallery_user' ) );
		}
		return array(
			'limit'     => $limit,
			'used'      => $used,
			'remaining' => $limit > 0 ? max( 0, $limit - $used ) : null,
			// Single-concept rebuilds left today (null = unlimited).
			'gallery_remaining' => $g > 0 ? max( 0, $g - $g_used ) : null,
		);
	}

	public static function message( string $failed ): string {
		switch ( $failed ) {
			case 'ip':
			case 'user':
				return sprintf( /* translators: %d: limit */ __( 'Elérted a napi %d generálási keretet. Holnap újra próbálhatod, addig a mentett projektjeidet megtekintheted.', 'autogrowehome' ), self::ip_limit() );
			case 'global':
				return __( 'A szolgáltatás mai generálási kerete elfogyott. Kérjük, próbáld újra holnap.', 'autogrowehome' );
			case 'burst':
				return __( 'Túl sok kérés rövid időn belül. Kérjük, várj néhány percet.', 'autogrowehome' );
			case 'gallery':
				return __( 'A napi galéria-újragenerálási keret elfogyott.', 'autogrowehome' );
			case 'concurrent':
				return __( 'Már fut egy generálásod. Kérjük, várd meg, amíg elkészül.', 'autogrowehome' );
			case 'budget':
				return __( 'A szolgáltatás költségkerete átmenetileg kimerült. Kérjük, próbáld újra később.', 'autogrowehome' );
		}
		return __( 'A kérés jelenleg nem teljesíthető.', 'autogrowehome' );
	}

	public static function cleanup( int $days = 3 ): void {
		global $wpdb;
		$t = Installer::table( 'rate' );
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$t} WHERE updated_at < %s", gmdate( 'Y-m-d H:i:s', time() - $days * DAY_IN_SECONDS ) ) ); // phpcs:ignore
	}
}
