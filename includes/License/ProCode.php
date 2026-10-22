<?php
/**
 * Pro unlock code (1.16.1, Norbi: "a pro változat kerüljön az arculati menübe"): on the
 * Branding page the site owner can switch on the Professional plan with a code. Only the bcrypt
 * hash of the code is in the plugin (CLAUDE.md: no keys in the repository); wrong attempts are
 * limited to 5 per 15 minutes. A licence that is already Professional or Agency is never lowered.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\License;

defined( 'ABSPATH' ) || exit;

final class ProCode {

	public const OPTION = 'agh_pro_code';

	private const HASH = '$2y$12$8xcRp0DejqcFDxIrJ6Zj8O8lDf21RFqth6KEdSF2l7PKwZe0bcJKO';

	private const TRIES     = 'agh_pro_code_tries';
	private const MAX_TRIES = 5;
	private const WINDOW    = 900;

	/** The plan the code switches on. */
	public const PLAN = 'professional';

	public static function active(): bool {
		$o = get_option( self::OPTION, array() );
		return is_array( $o ) && ! empty( $o['on'] );
	}

	/**
	 * @return array{ok:bool,locked:bool}
	 */
	public static function attempt( string $code ): array {
		$tries = (int) get_transient( self::TRIES );
		if ( $tries >= self::MAX_TRIES ) {
			return array( 'ok' => false, 'locked' => true );
		}
		$code = trim( $code );
		if ( '' === $code || strlen( $code ) > 64 || ! password_verify( $code, self::HASH ) ) {
			set_transient( self::TRIES, $tries + 1, self::WINDOW );
			return array( 'ok' => false, 'locked' => $tries + 1 >= self::MAX_TRIES );
		}
		delete_transient( self::TRIES );
		update_option(
			self::OPTION,
			array(
				'on'   => true,
				'at'   => gmdate( 'c' ),
				'user' => get_current_user_id(),
			),
			false
		);
		return array( 'ok' => true, 'locked' => false );
	}

	public static function disable(): void {
		delete_option( self::OPTION );
	}

	/**
	 * The plan with the code applied: the higher of the licence's plan and Professional.
	 */
	public static function apply( string $plan ): string {
		if ( ! self::active() ) {
			return $plan;
		}
		$rank = array( 'starter' => 0, 'professional' => 1, 'agency' => 2 );
		return ( $rank[ $plan ] ?? 0 ) >= $rank[ self::PLAN ] ? $plan : self::PLAN;
	}
}
