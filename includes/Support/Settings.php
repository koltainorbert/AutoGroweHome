<?php
/**
 * Central settings store (single option, dot-notation access).
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Support;

defined( 'ABSPATH' ) || exit;

final class Settings {

	public const OPTION = 'agh_settings';

	/** @var array|null */
	private static $cache = null;

	/**
	 * Default configuration. Every key is documented in docs/ADMIN-KEZIKONYV.md.
	 */
	public static function defaults(): array {
		return array(
			'general'    => array(
				'plugin_name'      => 'AutoGroweHome',
				'author_name'      => 'Koltai Norbert – Infostudio',
				'frontend_locale'  => 'hu_HU',
				'enabled_locales'  => array( 'hu_HU', 'en_US', 'de_DE' ),
				'floating_button'  => true,
				'button_label'     => '',
				'default_mode'     => 'simple',
				'delete_on_uninstall' => false,
				'queue_tick_on_poll'  => true,
			),
			'anthropic'  => array(
				'enabled'      => true,
				'endpoint'     => 'https://api.anthropic.com/v1/messages',
				'model'        => 'claude-sonnet-5-5',
				'version'      => '2023-06-01',
				'max_tokens'   => 8000,
				'temperature'  => 0.6,
				'timeout'      => 90,
				'retries'      => 2,
				'use_for_plan' => true,
				'use_for_interpret' => true,
			),
			'images'     => array(
				'active_provider'   => 'magnific',
				'fallback_provider' => '',
				'allow_test_provider' => true,
			),
			'magnific'   => array(
				'enabled'            => true,
				'base_url'           => 'https://api.magnific.com',
				'hero_endpoint'      => '/v1/ai/mystic',
				'mystic_model'       => 'realism',
				'mystic_engine'      => 'automatic',
				'creative_detailing' => 33,
				'preview_resolution' => '2k',
				'final_resolution'   => '4k',
				'aspect_ratio'       => 'widescreen_16_9',
				'view_strategy'      => 'reference',
				'reference_endpoint' => '/v1/ai/text-to-image/flux-2-pro',
				'reference_width'    => 1440,
				'reference_height'   => 816,
				'style_adherence'    => 60,
				'structure_guidance' => true,
				'structure_strength' => 45,
				'upscale_enabled'    => false,
				'upscale_endpoint'   => '/v1/ai/image-upscaler-precision',
				'upscale_sharpen'    => 40,
				'upscale_ultra_detail' => 30,
				'timeout'            => 420,
				'poll_interval'      => 6,
				'retries'            => 2,
				'use_webhook'        => false,
				'filter_nsfw'        => true,
			),
			'costs'      => array(
				'currency'          => 'EUR',
				'mystic_2k'         => 0.0,
				'mystic_4k'         => 0.0,
				'reference_image'   => 0.0,
				'upscale'           => 0.0,
				'anthropic_in_mtok' => 0.0,
				'anthropic_out_mtok'=> 0.0,
				'daily_budget'      => 0.0,
				'monthly_budget'    => 0.0,
			),
			'limits'     => array(
				'ip_daily'           => 3,
				'user_daily'         => 0,
				'global_daily'       => 0,
				'burst_window_min'   => 10,
				'burst_max'          => 2,
				'concurrent_per_ip'  => 1,
				'timezone'           => '',
				'day_start_hour'     => 0,
				'trusted_proxies'    => '',
				'proxy_header'       => 'X-Forwarded-For',
				'gallery_mode'       => 'selected',
				'exterior_views'     => array( 'hero', 'front', 'back', 'left', 'right', 'aerial', 'garden', 'evening' ),
				'interiors_max'      => 4,
				'max_images_request' => 40,
				'gallery_rebuilds_per_day' => 2,
				'auto_retry_max'     => 2,
				'dedupe_minutes'     => 20,
				'cache_hours'        => 72,
				'max_parallel_jobs'  => 4,
			),
			'contractor' => array(
				'name'            => '',
				'company'         => '',
				'email'           => get_option( 'admin_email' ),
				'contact_name'    => '',
				'lang'            => 'hu_HU',
				'link_hours'      => 168,
				'session_hours'   => 12,
				'retention_days'  => 180,
				'multi_enabled'   => false,
				'extra_emails'    => '',
				'client_confirmation' => true,
			),
			'legal'      => array(
				'terms_required'  => true,
				'terms_url'       => '',
				'terms_version'   => '1.0',
				'privacy_url'     => get_privacy_policy_url(),
				'privacy_version' => '1.0',
				'contact_text'    => '',
				'marketing_enabled' => true,
				'marketing_text'  => '',
				'retention_projects_days' => 180,
				'retention_drafts_days'   => 30,
				'retention_quotes_days'   => 730,
				'retention_logs_days'     => 60,
				'store_user_agent'        => false,
			),
			'access'     => array(
				'client_gallery_previews' => true,
				'client_plan_previews'    => true,
				'client_download'         => 'hero',
				'preview_max_px'          => 1280,
			),
			'branding'   => array(
				'logo_id'        => 0,
				'icon_id'        => 0,
				'color_primary'  => '#B9824F',
				'color_accent'   => '#E2A85A',
				'color_success'  => '#5E8C61',
				'color_warning'  => '#D69A2D',
				'color_danger'   => '#C2553F',
				'color_ink'      => '#1E2226',
				'color_bg'       => '#F6F3EE',
				'font_body'      => 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
				'font_heading'   => '"Avenir Next", "Segoe UI", system-ui, sans-serif',
				'radius'         => 22,
				'blur'           => 18,
				'glass_opacity'  => 0.62,
				'shadow'         => 'soft',
				'animations'     => true,
				'default_theme'  => 'auto',
				'header_text'    => '',
				'footer_text'    => '',
				'popup_title'    => '',
				'background_image_id' => 0,
			),
			'layout'     => array(
				'left_width'   => 340,
				'right_width'  => 320,
				'action_bar'   => 'bottom',
				'panel_order'  => 'params,stage,summary',
				'show_tour'    => true,
				'start_view'   => 'wizard',
			),
			'emails'     => array(
				'contractor_subject' => '',
				'contractor_body'    => '',
				'client_subject'     => '',
				'client_body'        => '',
				'from_name'          => '',
				'from_email'         => '',
			),
		);
	}

	public static function install_defaults(): void {
		$current = get_option( self::OPTION, array() );
		if ( ! is_array( $current ) ) {
			$current = array();
		}
		$merged = self::merge( self::defaults(), $current );
		update_option( self::OPTION, $merged, false );
		self::$cache = null;
	}

	/**
	 * Recursive merge where stored values override defaults, lists replace.
	 */
	public static function merge( array $defaults, array $stored ): array {
		foreach ( $stored as $k => $v ) {
			if ( is_array( $v ) && isset( $defaults[ $k ] ) && is_array( $defaults[ $k ] ) && ! wp_is_numeric_array( $defaults[ $k ] ) ) {
				$defaults[ $k ] = self::merge( $defaults[ $k ], $v );
			} else {
				$defaults[ $k ] = $v;
			}
		}
		return $defaults;
	}

	public static function all(): array {
		if ( null === self::$cache ) {
			$stored      = get_option( self::OPTION, array() );
			$defaults    = self::defaults();
			self::$cache = self::secure( self::merge( $defaults, is_array( $stored ) ? $stored : array() ), $defaults );
		}
		return self::$cache;
	}

	/**
	 * Provider URL settings that carry API keys: absolute https:// URLs only.
	 * group => keys.
	 */
	private const SECURE_URLS = array(
		'anthropic' => array( 'endpoint' ),
		'magnific'  => array( 'base_url' ),
	);

	/**
	 * Provider endpoint paths appended to magnific.base_url.
	 */
	private const ENDPOINT_PATHS = array(
		'magnific' => array( 'hero_endpoint', 'reference_endpoint', 'upscale_endpoint' ),
	);

	/**
	 * Validate one provider URL: must be an absolute https:// URL with a host
	 * and without credentials. Returns '' when invalid.
	 */
	public static function sanitize_https_url( $value ): string {
		$v     = trim( (string) $value );
		$parts = wp_parse_url( $v );
		if ( ! is_array( $parts ) || 'https' !== strtolower( (string) ( $parts['scheme'] ?? '' ) ) || empty( $parts['host'] ) || isset( $parts['user'] ) || isset( $parts['pass'] ) || false === filter_var( $v, FILTER_VALIDATE_URL ) ) {
			return '';
		}
		return esc_url_raw( $v, array( 'https' ) );
	}

	/**
	 * Allowed provider endpoint path: "/seg/seg…", segments of letters,
	 * digits, "_" and "-" only (no dots, no empty segments, no query). The
	 * same rule validates the endpoint part of stored Magnific task
	 * references (MagnificProvider::status()), so every saved path is usable.
	 */
	public const ENDPOINT_PATH_PATTERN = '#^(?:/[A-Za-z0-9_\-]+)+$#';

	public static function is_endpoint_path( string $path ): bool {
		return 1 === preg_match( self::ENDPOINT_PATH_PATTERN, $path );
	}

	/**
	 * Validate an endpoint path ("/v1/ai/mystic"): a relative path only, so it
	 * can never change the host of the base URL. Returns '' when invalid.
	 */
	public static function sanitize_endpoint_path( $value ): string {
		$v = '/' . trim( trim( (string) $value ), '/' );
		return self::is_endpoint_path( $v ) ? $v : '';
	}

	/**
	 * Enforce the URL rules on a full settings array (invalid → factory default).
	 * Applied on read (protects values stored by earlier versions) and on save.
	 */
	private static function secure( array $all, array $defaults ): array {
		foreach ( self::SECURE_URLS as $group => $keys ) {
			foreach ( $keys as $key ) {
				if ( isset( $all[ $group ][ $key ] ) && '' === self::sanitize_https_url( $all[ $group ][ $key ] ) ) {
					$all[ $group ][ $key ] = $defaults[ $group ][ $key ];
				}
			}
		}
		foreach ( self::ENDPOINT_PATHS as $group => $keys ) {
			foreach ( $keys as $key ) {
				if ( isset( $all[ $group ][ $key ] ) && '' === self::sanitize_endpoint_path( $all[ $group ][ $key ] ) ) {
					$all[ $group ][ $key ] = $defaults[ $group ][ $key ];
				}
			}
		}
		return $all;
	}

	/**
	 * @param string $path    Dot path, e.g. "limits.ip_daily".
	 * @param mixed  $default Fallback.
	 * @return mixed
	 */
	public static function get( string $path, $default = null ) {
		$node = self::all();
		foreach ( explode( '.', $path ) as $seg ) {
			if ( ! is_array( $node ) || ! array_key_exists( $seg, $node ) ) {
				return $default;
			}
			$node = $node[ $seg ];
		}
		return $node;
	}

	public static function update_group( string $group, array $values ): void {
		$defaults = self::defaults();
		// Provider URLs: https only (http:// or malformed → factory default).
		foreach ( self::SECURE_URLS[ $group ] ?? array() as $key ) {
			if ( array_key_exists( $key, $values ) ) {
				$clean          = self::sanitize_https_url( $values[ $key ] );
				$values[ $key ] = '' !== $clean ? $clean : $defaults[ $group ][ $key ];
			}
		}
		foreach ( self::ENDPOINT_PATHS[ $group ] ?? array() as $key ) {
			if ( array_key_exists( $key, $values ) ) {
				$clean          = self::sanitize_endpoint_path( $values[ $key ] );
				$values[ $key ] = '' !== $clean ? $clean : $defaults[ $group ][ $key ];
			}
		}
		$all           = get_option( self::OPTION, array() );
		$all           = is_array( $all ) ? $all : array();
		$all[ $group ] = array_merge( isset( $all[ $group ] ) && is_array( $all[ $group ] ) ? $all[ $group ] : array(), $values );
		update_option( self::OPTION, $all, false );
		self::$cache = null;
	}

	public static function flush(): void {
		self::$cache = null;
	}
}
