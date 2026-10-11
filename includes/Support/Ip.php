<?php
/**
 * Client IP resolution with trusted-proxy handling and privacy-preserving hashing.
 *
 * Forwarded headers are only honoured when REMOTE_ADDR belongs to a configured
 * trusted proxy (CIDR list). Otherwise REMOTE_ADDR is used as-is.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Support;

defined( 'ABSPATH' ) || exit;

final class Ip {

	public static function client(): string {
		$remote = isset( $_SERVER['REMOTE_ADDR'] ) ? trim( (string) wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
		if ( ! filter_var( $remote, FILTER_VALIDATE_IP ) ) {
			$remote = '0.0.0.0';
		}
		$trusted = self::trusted_list();
		if ( empty( $trusted ) || ! self::in_any( $remote, $trusted ) ) {
			return $remote;
		}
		$header = (string) Settings::get( 'limits.proxy_header', 'X-Forwarded-For' );
		$key    = 'HTTP_' . strtoupper( str_replace( '-', '_', $header ) );
		if ( empty( $_SERVER[ $key ] ) ) {
			return $remote;
		}
		$chain = array_map( 'trim', explode( ',', (string) wp_unslash( $_SERVER[ $key ] ) ) );
		// Walk from the right: the first address that is not a trusted proxy is the client.
		for ( $i = count( $chain ) - 1; $i >= 0; $i-- ) {
			$candidate = $chain[ $i ];
			if ( ! filter_var( $candidate, FILTER_VALIDATE_IP ) ) {
				return $remote;
			}
			if ( ! self::in_any( $candidate, $trusted ) ) {
				return $candidate;
			}
		}
		return $remote;
	}

	/**
	 * Keyed hash of the client network used for limits and logs. Raw IPs are
	 * never stored. IPv4 addresses are hashed in full; IPv6 addresses are
	 * truncated to their /64 prefix first (one end-user network usually gets a
	 * whole /64, so rotating the interface id must not bypass daily limits).
	 */
	public static function hash( ?string $ip = null ): string {
		$ip = self::network( $ip ?? self::client() );
		return hash_hmac( 'sha256', 'agh-ip|' . $ip, wp_salt( 'nonce' ) );
	}

	/**
	 * Rate-limit key of an address: IPv4 unchanged, IPv4-mapped IPv6
	 * (::ffff:a.b.c.d) as its IPv4 address, any other IPv6 as "<prefix>::/64".
	 */
	public static function network( string $ip ): string {
		if ( ! filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6 ) ) {
			return $ip;
		}
		$bin = @inet_pton( $ip ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
		if ( false === $bin || 16 !== strlen( $bin ) ) {
			return $ip;
		}
		if ( str_repeat( "\0", 10 ) . "\xff\xff" === substr( $bin, 0, 12 ) ) {
			return (string) inet_ntop( substr( $bin, 12 ) );
		}
		return inet_ntop( substr( $bin, 0, 8 ) . str_repeat( "\0", 8 ) ) . '/64';
	}

	public static function trusted_list(): array {
		$raw = (string) Settings::get( 'limits.trusted_proxies', '' );
		$out = array();
		foreach ( preg_split( '/[\s,]+/', $raw ) as $entry ) {
			$entry = trim( $entry );
			if ( '' !== $entry ) {
				$out[] = $entry;
			}
		}
		return $out;
	}

	public static function in_any( string $ip, array $cidrs ): bool {
		foreach ( $cidrs as $cidr ) {
			if ( self::in_cidr( $ip, $cidr ) ) {
				return true;
			}
		}
		return false;
	}

	public static function in_cidr( string $ip, string $cidr ): bool {
		if ( false === strpos( $cidr, '/' ) ) {
			return $ip === $cidr;
		}
		list( $subnet, $bits ) = explode( '/', $cidr, 2 );
		$ip_bin  = @inet_pton( $ip ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
		$net_bin = @inet_pton( $subnet ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
		if ( false === $ip_bin || false === $net_bin || strlen( $ip_bin ) !== strlen( $net_bin ) ) {
			return false;
		}
		$bits  = (int) $bits;
		$bytes = intdiv( $bits, 8 );
		$rem   = $bits % 8;
		if ( substr( $ip_bin, 0, $bytes ) !== substr( $net_bin, 0, $bytes ) ) {
			return false;
		}
		if ( 0 === $rem ) {
			return true;
		}
		$mask = chr( ( 0xFF << ( 8 - $rem ) ) & 0xFF );
		return ( $ip_bin[ $bytes ] & $mask ) === ( $net_bin[ $bytes ] & $mask );
	}
}
