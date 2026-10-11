<?php
/**
 * Localization: loads the plugin textdomain from /languages (WordPress .mo
 * files), lets the admin force the frontend language and lets visitors
 * switch between the enabled languages (only with the "multilang" feature).
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Frontend;

use AutoGroweHome\License\Features;
use AutoGroweHome\Support\Settings;

defined( 'ABSPATH' ) || exit;

final class I18n {

	public const SUPPORTED = array(
		'hu_HU' => 'Magyar',
		'de_DE' => 'Deutsch',
		'en_US' => 'English',
		'ru_RU' => 'Русский',
		'es_ES' => 'Español',
		'pl_PL' => 'Polski',
		'hr'    => 'Hrvatski',
		'ro_RO' => 'Română',
		'sl_SI' => 'Slovenščina',
		'sk_SK' => 'Slovenčina',
		'cs_CZ' => 'Čeština',
		'fr_FR' => 'Français',
		'it_IT' => 'Italiano',
		'nl_NL' => 'Nederlands',
		'sr_RS' => 'Српски',
		'uk'    => 'Українська',
	);

	/** @var string Locale switched to for this request ('' = default). */
	public static $current = '';

	public static function init(): void {
		add_action( 'init', array( __CLASS__, 'load' ), 1 );
		add_filter( 'plugin_locale', array( __CLASS__, 'frontend_locale' ), 10, 2 );
	}

	public static function load(): void {
		load_plugin_textdomain( 'autogrowehome', false, dirname( AGH_BASENAME ) . '/languages' );
		if ( is_admin() && ! wp_doing_ajax() ) {
			return;
		}
		$forced = (string) Settings::get( 'general.frontend_locale', '' );
		if ( '' !== $forced && 'auto' !== $forced && isset( self::SUPPORTED[ $forced ] ) ) {
			self::apply( $forced );
		}
		// Visitor-selected language travels with every designer API call.
		$req = isset( $_GET['agh_lang'] ) ? sanitize_text_field( wp_unslash( $_GET['agh_lang'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
		if ( '' !== $req ) {
			self::request_switch( $req, Features::enabled( 'multilang' ) );
		}
	}

	/**
	 * Apply a visitor-requested language (?agh_lang=) – only when the
	 * "multilang" feature is enabled; otherwise the forced/default locale stays.
	 */
	public static function request_switch( string $locale, bool $multilang ): bool {
		return $multilang && self::switch_to( $locale );
	}

	/**
	 * Run a callback with the plugin strings in a given locale (e-mails).
	 */
	public static function with_locale( string $locale, callable $fn ) {
		$prev = '' !== self::$current ? self::$current : (string) apply_filters( 'plugin_locale', determine_locale(), 'autogrowehome' );
		if ( isset( self::SUPPORTED[ $locale ] ) ) {
			self::apply( $locale );
		}
		try {
			return $fn();
		} finally {
			self::apply( isset( self::SUPPORTED[ $prev ] ) ? $prev : 'hu_HU' );
		}
	}

	/**
	 * Load exactly one locale for the plugin domain. Hungarian is the source
	 * language: a no-op translation object stops WordPress' just-in-time
	 * loader from falling back to the site locale.
	 */
	public static function apply( string $locale ): void {
		unload_textdomain( 'autogrowehome' );
		$file = AGH_DIR . 'languages/autogrowehome-' . $locale . '.mo';
		if ( 'hu_HU' !== $locale && file_exists( $file ) ) {
			load_textdomain( 'autogrowehome', $file, $locale );
			return;
		}
		$GLOBALS['l10n']['autogrowehome'] = new \NOOP_Translations();
	}

	public static function language_name( string $locale ): string {
		return self::SUPPORTED[ $locale ] ?? $locale;
	}

	/**
	 * Admin-forced frontend locale for this plugin's strings (not for wp-admin).
	 */
	public static function frontend_locale( $locale, $domain ) {
		if ( 'autogrowehome' !== $domain || is_admin() ) {
			return $locale;
		}
		if ( '' !== self::$current ) {
			return self::$current;
		}
		$forced = (string) Settings::get( 'general.frontend_locale', '' );
		if ( 'auto' === $forced || '' === $forced ) {
			return $locale;
		}
		return isset( self::SUPPORTED[ $forced ] ) ? $forced : $locale;
	}

	/**
	 * Switch to a visitor-selected language for the current request.
	 */
	public static function switch_to( string $locale ): bool {
		$enabled = (array) Settings::get( 'general.enabled_locales', array() );
		if ( ! in_array( $locale, $enabled, true ) || ! isset( self::SUPPORTED[ $locale ] ) ) {
			return false;
		}
		self::apply( $locale );
		self::$current = $locale;
		return true;
	}
}
