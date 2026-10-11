<?php
/**
 * Request identity & permission helpers for the REST layer.
 *
 * Identity: a logged-in WordPress user is recognised when the request carries
 * a valid X-WP-Nonce (WordPress' REST cookie authentication; without it core
 * treats the request as anonymous), otherwise the visitor is a guest
 * identified by the HttpOnly guest cookie (agh_gs).
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Rest;

use AutoGroweHome\Installer;
use AutoGroweHome\Quote\AccessTokens;
use AutoGroweHome\Quote\QuoteService;
use AutoGroweHome\Support\Settings;

defined( 'ABSPATH' ) || exit;

final class Access {

	public const GUEST_COOKIE = 'agh_gs';

	/** @var bool Guest cookie already (re)sent in this request. */
	private static $cookie_sent = false;

	/**
	 * Custom-header nonce for state-changing public requests. A custom header
	 * cannot be set cross-site without a CORS preflight, which WordPress does
	 * not allow for these routes – this blocks CSRF for guests as well.
	 *
	 * The nonce is bound to the visitor (see front_nonce()): to the guest
	 * cookie id when the browser has one, otherwise to the logged-in user and
	 * session. A nonce issued to one guest is therefore useless for another.
	 */
	public static function check_front_nonce( \WP_REST_Request $r ): bool {
		$nonce = (string) $r->get_header( 'x_agh_nonce' );
		if ( '' === $nonce || ! preg_match( '/^[a-f0-9]{10,64}$/', $nonce ) ) {
			return false;
		}
		$tick = self::nonce_tick();
		foreach ( self::nonce_bindings() as $binding ) {
			foreach ( array( $tick, $tick - 1 ) as $t ) {
				if ( hash_equals( self::nonce_for( $binding, $t ), $nonce ) ) {
					return true;
				}
			}
		}
		// Logged-in users: a WordPress nonce is already bound to user + session.
		return get_current_user_id() > 0 && false !== wp_verify_nonce( $nonce, 'agh_front' );
	}

	/**
	 * Nonce for the X-AGH-Nonce header (returned by GET /bootstrap).
	 *
	 * Bound to the guest cookie id when there is one. A visitor that is not
	 * identified as a logged-in user and has no guest cookie yet receives a
	 * new guest cookie together with the matching nonce ($create_guest).
	 */
	public static function front_nonce( bool $create_guest = false ): string {
		$guest = self::guest_token( $create_guest && 0 === get_current_user_id() );
		if ( '' !== $guest ) {
			return self::nonce_for( 'g:' . $guest, self::nonce_tick() );
		}
		if ( get_current_user_id() > 0 ) {
			return self::nonce_for( self::user_binding(), self::nonce_tick() );
		}
		// Guest without cookie and $create_guest = false: no identity to bind
		// to, so no usable nonce (check_front_nonce() would reject any value).
		return '';
	}

	/**
	 * 12-hour ticks; a nonce is valid for the current and the previous tick
	 * (12–24 h), like WordPress nonces.
	 */
	private static function nonce_tick(): int {
		return (int) ceil( time() / ( DAY_IN_SECONDS / 2 ) );
	}

	private static function nonce_for( string $binding, int $tick ): string {
		return substr( hash_hmac( 'sha256', 'agh_front|' . $tick . '|' . $binding, wp_salt( 'nonce' ) ), 0, 24 );
	}

	private static function user_binding(): string {
		return 'u:' . get_current_user_id() . '|' . wp_get_session_token();
	}

	/**
	 * Identities the current request can prove: guest cookie and/or user.
	 */
	private static function nonce_bindings(): array {
		$out   = array();
		$guest = self::guest_token();
		if ( '' !== $guest ) {
			$out[] = 'g:' . $guest;
		}
		if ( get_current_user_id() > 0 ) {
			$out[] = self::user_binding();
		}
		return $out;
	}

	/**
	 * Lifetime of the guest cookie: as long as a guest's saved project is kept
	 * (the cookie is the only key to it), never shorter than the draft retention.
	 */
	public static function guest_cookie_days(): int {
		return max( 1, (int) Settings::get( 'legal.retention_drafts_days', 30 ), (int) Settings::get( 'legal.retention_projects_days', 180 ) );
	}

	/**
	 * Guest id from the cookie. With $create the cookie is created when missing
	 * and – when present – renewed (sliding expiry, at most once per request).
	 */
	public static function guest_token( bool $create = false ): string {
		$t = isset( $_COOKIE[ self::GUEST_COOKIE ] ) ? sanitize_text_field( wp_unslash( $_COOKIE[ self::GUEST_COOKIE ] ) ) : '';
		$valid = (bool) preg_match( '/^[a-f0-9]{48}$/', $t );
		if ( ! $create ) {
			return $valid ? $t : '';
		}
		if ( ! $valid ) {
			$t = bin2hex( random_bytes( 24 ) );
		}
		if ( ! self::$cookie_sent && ! headers_sent() ) {
			setcookie(
				self::GUEST_COOKIE,
				$t,
				array(
					'expires'  => time() + self::guest_cookie_days() * DAY_IN_SECONDS,
					'path'     => '/',
					'secure'   => is_ssl(),
					'httponly' => true,
					'samesite' => 'Lax',
				)
			);
			self::$cookie_sent = true;
		}
		$_COOKIE[ self::GUEST_COOKIE ] = $t;
		return $t;
	}

	public static function guest_hash( bool $create = false ): string {
		$t = self::guest_token( $create );
		return '' === $t ? '' : hash_hmac( 'sha256', $t, wp_salt( 'logged_in' ) );
	}

	/**
	 * Renew the guest cookie on activity of a visitor who already has one.
	 */
	public static function touch_guest(): void {
		if ( 0 === get_current_user_id() && '' !== self::guest_token() ) {
			self::guest_token( true );
		}
	}

	public static function is_owner( array $project ): bool {
		$uid = get_current_user_id();
		if ( $project['owner_user_id'] > 0 ) {
			return $uid === (int) $project['owner_user_id'];
		}
		$gh = self::guest_hash();
		return '' !== $gh && hash_equals( (string) $project['guest_key_hash'], $gh );
	}

	public static function is_staff(): bool {
		return current_user_can( 'agh_view_projects' );
	}

	/**
	 * Quotes the current contractor may access.
	 *
	 * - staff (agh_manage / agh_view_projects): every quote (true);
	 * - users with agh_view_packages only (agh_contractor role): the quotes
	 *   whose notification went to the user's e-mail address;
	 * - e-mail link session (cookie): the quote of that link.
	 *
	 * @return int[]|true
	 */
	public static function contractor_quotes() {
		if ( current_user_can( 'agh_manage' ) || self::is_staff() ) {
			return true;
		}
		$ids = array();
		if ( current_user_can( 'agh_view_packages' ) ) {
			$user = wp_get_current_user();
			if ( $user && is_email( $user->user_email ) ) {
				$ids = QuoteService::quote_ids_for_recipient( (string) $user->user_email );
			}
		}
		$s = AccessTokens::session();
		if ( $s && (int) $s['quote_id'] > 0 ) {
			$ids[] = (int) $s['quote_id'];
		}
		return array_values( array_unique( array_map( 'intval', $ids ) ) );
	}

	/**
	 * Projects the current contractor may access (derived from contractor_quotes()).
	 *
	 * @return int[]|true True = all projects with a quote (staff).
	 */
	public static function contractor_projects() {
		$quotes = self::contractor_quotes();
		if ( true === $quotes ) {
			return true;
		}
		if ( empty( $quotes ) ) {
			return array();
		}
		global $wpdb;
		$t  = Installer::table( 'quotes' );
		$in = implode( ',', array_map( 'intval', $quotes ) );
		return array_map( 'intval', (array) $wpdb->get_col( "SELECT DISTINCT project_id FROM {$t} WHERE id IN ({$in})" ) ); // phpcs:ignore
	}

	public static function contractor_can( int $project_id ): bool {
		$scope = self::contractor_projects();
		if ( true === $scope ) {
			global $wpdb;
			$t = Installer::table( 'quotes' );
			return (bool) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$t} WHERE project_id = %d LIMIT 1", $project_id ) ); // phpcs:ignore
		}
		return in_array( $project_id, $scope, true );
	}

	public static function contractor_can_quote( int $quote_id ): bool {
		$scope = self::contractor_quotes();
		return true === $scope || in_array( $quote_id, $scope, true );
	}
}
