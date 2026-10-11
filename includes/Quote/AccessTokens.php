<?php
/**
 * Time-limited contractor access.
 *
 * The e-mail link carries its token only in the URL fragment (#…), which
 * browsers never send to servers, proxies or logs. The portal page exchanges
 * it via POST for an HttpOnly, Secure, SameSite=Strict session cookie.
 *
 * Link tokens are time-limited (contractor.link_hours) but multi-use within
 * that window (max_uses = 0): the contractor may reopen the e-mail later or
 * on another device. Each link belongs to one quote and one recipient
 * (hashed e-mail); sending a new link to a recipient revokes that
 * recipient's earlier links (QuoteService::notify()), and revoke_quote()
 * withdraws a quote's links – and optionally its portal sessions – at once.
 * Tokens are stored hashed; they can be revoked and expire.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Quote;

use AutoGroweHome\Installer;
use AutoGroweHome\Support\Settings;
use AutoGroweHome\Support\Util;

defined( 'ABSPATH' ) || exit;

final class AccessTokens {

	public const COOKIE = 'agh_cs';

	private static function hash( string $token ): string {
		return hash_hmac( 'sha256', $token, wp_salt( 'secure_auth' ) );
	}

	/**
	 * Hash identifying a recipient on access rows (no plain e-mail stored).
	 */
	public static function recipient_hash( string $email ): string {
		$email = strtolower( trim( $email ) );
		return '' === $email ? '' : hash_hmac( 'sha256', 'agh-recipient|' . $email, wp_salt( 'secure_auth' ) );
	}

	/**
	 * @param string $recipient Recipient e-mail (stored hashed), an existing
	 *                          recipient hash (sessions inherit the link's) or ''.
	 * @param int    $max_uses  0 = unlimited within the validity period.
	 */
	public static function create( string $kind, int $quote_id, int $project_id, int $hours, int $max_uses = 0, string $recipient = '' ): string {
		global $wpdb;
		$token = bin2hex( random_bytes( 32 ) );
		$wpdb->insert(
			Installer::table( 'access' ),
			array(
				'kind'       => $kind,
				'token_hash' => self::hash( $token ),
				'quote_id'   => $quote_id,
				'project_id' => $project_id,
				'recipient'  => 64 === strlen( $recipient ) && ctype_xdigit( $recipient ) ? $recipient : self::recipient_hash( $recipient ),
				'max_uses'   => $max_uses,
				'expires_at' => Util::gmt_after( max( 1, $hours ) * HOUR_IN_SECONDS ),
				'created_at' => Util::now(),
			)
		);
		return $token;
	}

	public static function portal_url( string $token ): string {
		return add_query_arg( 'agh-portal', '1', home_url( '/' ) ) . '#t=' . rawurlencode( $token );
	}

	public static function find( string $token, string $kind ): ?array {
		if ( ! preg_match( '/^[a-f0-9]{64}$/', $token ) ) {
			return null;
		}
		global $wpdb;
		$t   = Installer::table( 'access' );
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$t} WHERE token_hash = %s AND kind = %s AND revoked = 0 AND expires_at > %s", self::hash( $token ), $kind, Util::now() ), ARRAY_A ); // phpcs:ignore
		if ( ! $row ) {
			return null;
		}
		if ( (int) $row['max_uses'] > 0 && (int) $row['uses'] >= (int) $row['max_uses'] ) {
			return null;
		}
		return $row;
	}

	/**
	 * Exchange an e-mail link token for a session cookie.
	 */
	public static function exchange( string $token ): ?array {
		$link = self::find( $token, 'link' );
		if ( ! $link ) {
			return null;
		}
		global $wpdb;
		$wpdb->query( $wpdb->prepare( 'UPDATE ' . Installer::table( 'access' ) . ' SET uses = uses + 1 WHERE id = %d', (int) $link['id'] ) ); // phpcs:ignore
		$hours   = (int) Settings::get( 'contractor.session_hours', 12 );
		$session = self::create( 'session', (int) $link['quote_id'], (int) $link['project_id'], $hours, 0, (string) $link['recipient'] );
		if ( ! headers_sent() ) {
			setcookie(
				self::COOKIE,
				$session,
				array(
					'expires'  => time() + $hours * HOUR_IN_SECONDS,
					'path'     => '/',
					'secure'   => is_ssl(),
					'httponly' => true,
					'samesite' => 'Strict',
				)
			);
		}
		$_COOKIE[ self::COOKIE ] = $session;
		return $link;
	}

	/**
	 * Current contractor session (cookie) or null.
	 */
	public static function session(): ?array {
		$token = isset( $_COOKIE[ self::COOKIE ] ) ? sanitize_text_field( wp_unslash( $_COOKIE[ self::COOKIE ] ) ) : '';
		return '' === $token ? null : self::find( $token, 'session' );
	}

	public static function revoke_project( int $project_id ): void {
		global $wpdb;
		$wpdb->update( Installer::table( 'access' ), array( 'revoked' => 1 ), array( 'project_id' => $project_id ) );
	}

	/**
	 * Revoke the contractor links of a quote (admin action, resend, GDPR).
	 *
	 * @param int    $quote_id  Quote id.
	 * @param string $recipient Only this recipient's links (e-mail); links
	 *                          without a recipient (created before 1.0.0 DB v4)
	 *                          are revoked as well. '' = every recipient.
	 * @param bool   $sessions  Also end the portal sessions opened from them.
	 * @return int Number of revoked rows.
	 */
	public static function revoke_quote( int $quote_id, string $recipient = '', bool $sessions = false ): int {
		global $wpdb;
		$t     = Installer::table( 'access' );
		$kinds = $sessions ? "kind IN ('link','session')" : "kind = 'link'";
		if ( '' === $recipient ) {
			return (int) $wpdb->query( $wpdb->prepare( "UPDATE {$t} SET revoked = 1 WHERE quote_id = %d AND revoked = 0 AND {$kinds}", $quote_id ) ); // phpcs:ignore
		}
		return (int) $wpdb->query( $wpdb->prepare( "UPDATE {$t} SET revoked = 1 WHERE quote_id = %d AND revoked = 0 AND {$kinds} AND recipient IN (%s, '')", $quote_id, self::recipient_hash( $recipient ) ) ); // phpcs:ignore
	}

	public static function logout(): void {
		$s = self::session();
		if ( $s ) {
			global $wpdb;
			$wpdb->update( Installer::table( 'access' ), array( 'revoked' => 1 ), array( 'id' => (int) $s['id'] ) );
		}
		if ( ! headers_sent() ) {
			setcookie( self::COOKIE, '', array( 'expires' => time() - 3600, 'path' => '/', 'secure' => is_ssl(), 'httponly' => true, 'samesite' => 'Strict' ) );
		}
	}

	public static function cleanup(): void {
		global $wpdb;
		$t = Installer::table( 'access' );
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$t} WHERE expires_at < %s", gmdate( 'Y-m-d H:i:s', time() - 7 * DAY_IN_SECONDS ) ) ); // phpcs:ignore
	}
}
