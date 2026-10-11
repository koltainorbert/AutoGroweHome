<?php
/**
 * Frontend integration: shortcodes, lazy asset loading, contractor portal,
 * FAQ and sales page, plus the bootstrap payload for the designer app.
 *
 * Performance: on regular pages only a ~3 KB loader is printed (when the
 * floating button or a shortcode is used); the designer bundle is loaded on
 * first click.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Frontend;

use AutoGroweHome\Ai\Providers;
use AutoGroweHome\License\Features;
use AutoGroweHome\License\Payments;
use AutoGroweHome\Params\Registry;
use AutoGroweHome\Quote\QuoteService;
use AutoGroweHome\RateLimit\RateLimiter;
use AutoGroweHome\Support\Settings;

defined( 'ABSPATH' ) || exit;

final class Frontend {

	private static $needs_loader = false;

	public static function init(): void {
		add_shortcode( 'autogrowehome', array( __CLASS__, 'sc_designer' ) );
		add_shortcode( 'autogrowehome_button', array( __CLASS__, 'sc_button' ) );
		add_shortcode( 'autogrowehome_portal', array( __CLASS__, 'sc_portal' ) );
		add_shortcode( 'autogrowehome_faq', array( __CLASS__, 'sc_faq' ) );
		add_shortcode( 'autogrowehome_pricing', array( __CLASS__, 'sc_pricing' ) );
		add_action( 'wp_footer', array( __CLASS__, 'footer' ), 50 );
		add_filter( 'query_vars', static fn( $v ) => array_merge( $v, array( 'agh-portal' ) ) );
		add_action( 'template_redirect', array( __CLASS__, 'maybe_portal' ) );
	}

	public static function asset_ver( string $rel ): string {
		$f = AGH_DIR . $rel;
		return AGH_VERSION . '-' . ( file_exists( $f ) ? (string) filemtime( $f ) : '0' );
	}

	/**
	 * CSS custom properties from branding settings.
	 *
	 * Without the "branding_advanced" feature only the basic branding (primary
	 * colour; logo and name are handled in the bootstrap) is applied – the
	 * remaining tokens keep the stylesheet defaults. Panel widths are layout
	 * settings and always apply.
	 *
	 * @param bool|null $advanced Override the feature check (tests); null = Features.
	 */
	public static function css_vars( ?bool $advanced = null ): string {
		$advanced = null === $advanced ? Features::enabled( 'branding_advanced' ) : $advanced;
		$b        = Settings::get( 'branding' );
		$hex      = static fn( $v, $d ) => preg_match( '/^#[0-9a-fA-F]{6}$/', (string) $v ) ? $v : $d;
		$font     = static fn( $v ) => preg_replace( '/[^A-Za-z0-9 ,"\'\-]/', '', (string) $v );
		$vars     = array(
			'--agh-primary' => $hex( $b['color_primary'] ?? '', '#B9824F' ),
		);
		if ( $advanced ) {
			$vars += array(
				'--agh-accent'    => $hex( $b['color_accent'] ?? '', '#E2A85A' ),
				'--agh-success'   => $hex( $b['color_success'] ?? '', '#5E8C61' ),
				'--agh-warning'   => $hex( $b['color_warning'] ?? '', '#D69A2D' ),
				'--agh-danger'    => $hex( $b['color_danger'] ?? '', '#C2553F' ),
				'--agh-ink-l'     => $hex( $b['color_ink'] ?? '', '#1E2226' ),
				'--agh-bg-l'      => $hex( $b['color_bg'] ?? '', '#F6F3EE' ),
				'--agh-font'      => $font( $b['font_body'] ?? 'system-ui' ),
				'--agh-font-head' => $font( $b['font_heading'] ?? 'system-ui' ),
				'--agh-radius'    => max( 0, min( 40, (int) ( $b['radius'] ?? 22 ) ) ) . 'px',
				'--agh-blur'      => max( 0, min( 40, (int) ( $b['blur'] ?? 18 ) ) ) . 'px',
				'--agh-glass-a'   => (string) max( 0.2, min( 0.95, (float) ( $b['glass_opacity'] ?? 0.62 ) ) ),
			);
		}
		$vars['--agh-left-w']  = max( 260, min( 480, (int) Settings::get( 'layout.left_width', 340 ) ) ) . 'px';
		$vars['--agh-right-w'] = max( 240, min( 440, (int) Settings::get( 'layout.right_width', 320 ) ) ) . 'px';
		$css = '';
		foreach ( $vars as $k => $v ) {
			$css .= $k . ':' . $v . ';';
		}
		return '.agh-root{' . $css . '}';
	}

	public static function enqueue_loader(): void {
		self::$needs_loader = true;
	}

	public static function footer(): void {
		if ( is_admin() ) {
			return;
		}
		$floating = (bool) Settings::get( 'general.floating_button', true ) && Features::enabled( 'designer' );
		if ( ! self::$needs_loader && ! $floating ) {
			return;
		}
		echo '<script id="agh-loader-cfg" type="application/json">' . wp_json_encode( self::loader_config( $floating ), JSON_HEX_TAG | JSON_HEX_AMP ) . '</script>';
		echo '<script src="' . esc_url( AGH_URL . 'assets/js/agh-loader.js?ver=' . rawurlencode( self::asset_ver( 'assets/js/agh-loader.js' ) ) ) . '" defer></script>'; // phpcs:ignore WordPress.WP.EnqueuedResources
	}

	/**
	 * Configuration printed for the loader (window.AGH_LOADER).
	 *
	 * wpNonce: WordPress REST nonce for logged-in visitors only (empty for
	 * guests). The designer sends it as X-WP-Nonce on every REST call – also on
	 * the bootstrap request – so the REST layer sees the logged-in user.
	 */
	public static function loader_config( bool $floating ): array {
		$label = (string) Settings::get( 'general.button_label', '' );
		return array(
			'css'      => AGH_URL . 'assets/css/agh-designer.css?ver=' . rawurlencode( self::asset_ver( 'assets/css/agh-designer.css' ) ),
			'js'       => AGH_URL . 'assets/js/agh-designer.js?ver=' . rawurlencode( self::asset_ver( 'assets/js/agh-designer.js' ) ),
			'rest'     => wp_make_link_relative( esc_url_raw( rest_url( AGH_REST_NS . '/' ) ) ),
			'wpNonce'  => is_user_logged_in() ? wp_create_nonce( 'wp_rest' ) : '',
			'floating' => $floating,
			'label'    => '' !== $label ? $label : __( 'Tervezd meg álmaid otthonát', 'autogrowehome' ),
			'errBoot'  => __( 'A háztervező nem tölthető be. Kérjük, próbáld újra később.', 'autogrowehome' ),
			'vars'     => self::css_vars(),
		);
	}

	/* ------------------------------------------------------------------ shortcodes */

	public static function sc_designer( $atts ): string {
		if ( ! Features::enabled( 'designer' ) ) {
			return '';
		}
		self::enqueue_loader();
		$atts  = shortcode_atts( array( 'label' => '' ), (array) $atts );
		$label = '' !== $atts['label'] ? $atts['label'] : ( (string) Settings::get( 'general.button_label', '' ) ?: __( 'Tervezd meg álmaid otthonát', 'autogrowehome' ) );
		return '<div class="agh-cta-wrap"><button type="button" class="agh-cta" data-agh-open="1"><span class="agh-cta-ico" aria-hidden="true">⌂</span>' . esc_html( $label ) . '</button></div>';
	}

	public static function sc_button( $atts ): string {
		return self::sc_designer( $atts );
	}

	public static function sc_faq( $atts ): string {
		$items = Help::faq();
		$cats  = array_values( array_unique( array_map( static fn( $i ) => $i['cat'], $items ) ) );
		wp_enqueue_style( 'agh-pages', AGH_URL . 'assets/css/agh-pages.css', array(), self::asset_ver( 'assets/css/agh-pages.css' ) );
		wp_enqueue_script( 'agh-pages', AGH_URL . 'assets/js/agh-pages.js', array(), self::asset_ver( 'assets/js/agh-pages.js' ), true );
		ob_start();
		include AGH_DIR . 'templates/faq.php';
		return (string) ob_get_clean();
	}

	public static function sc_pricing( $atts ): string {
		$plans    = Features::plans();
		$features = Features::catalog();
		$gateway  = Payments::active();
		wp_enqueue_style( 'agh-pages', AGH_URL . 'assets/css/agh-pages.css', array(), self::asset_ver( 'assets/css/agh-pages.css' ) );
		wp_enqueue_script( 'agh-pages', AGH_URL . 'assets/js/agh-pages.js', array(), self::asset_ver( 'assets/js/agh-pages.js' ), true );
		ob_start();
		include AGH_DIR . 'templates/pricing.php';
		return (string) ob_get_clean();
	}

	public static function sc_portal( $atts ): string {
		self::portal_assets();
		ob_start();
		include AGH_DIR . 'templates/portal.php';
		return (string) ob_get_clean();
	}

	private static function portal_assets(): void {
		wp_enqueue_style( 'agh-designer', AGH_URL . 'assets/css/agh-designer.css', array(), self::asset_ver( 'assets/css/agh-designer.css' ) );
		wp_add_inline_style( 'agh-designer', self::css_vars() );
		wp_enqueue_script( 'agh-portal', AGH_URL . 'assets/js/agh-portal.js', array(), self::asset_ver( 'assets/js/agh-portal.js' ), true );
		wp_localize_script(
			'agh-portal',
			'AGH_PORTAL',
			array(
				'rest'    => wp_make_link_relative( esc_url_raw( rest_url( AGH_REST_NS . '/' ) ) ),
				'wpNonce' => is_user_logged_in() ? wp_create_nonce( 'wp_rest' ) : '', // Shared contract 1: sent as X-WP-Nonce.
				'i18n'    => Strings::portal(),
				'brand'   => (string) Settings::get( 'general.plugin_name', 'AutoGroweHome' ),
			)
		);
	}

	/**
	 * Stand-alone portal page at /?agh-portal=1 (no theme dependency, noindex).
	 */
	public static function maybe_portal(): void {
		if ( ! get_query_var( 'agh-portal' ) ) {
			return;
		}
		nocache_headers();
		header( 'X-Robots-Tag: noindex, nofollow', true );
		header( 'Referrer-Policy: no-referrer', true );
		self::portal_assets();
		include AGH_DIR . 'templates/portal-page.php';
		exit;
	}

	/* ------------------------------------------------------------------ bootstrap */

	public static function bootstrap_data(): array {
		$enabled = (array) Settings::get( 'general.enabled_locales', array( 'hu_HU' ) );
		$status  = Providers::status();
		$brand   = Settings::get( 'branding' );
		// Basic branding (logo, name, primary colour) always applies; the rest only with "branding_advanced".
		$adv     = Features::enabled( 'branding_advanced' );
		$logo    = ! empty( $brand['logo_id'] ) ? wp_get_attachment_image_url( (int) $brand['logo_id'], 'medium' ) : '';
		$icon    = $adv && ! empty( $brand['icon_id'] ) ? wp_get_attachment_image_url( (int) $brand['icon_id'], 'thumbnail' ) : '';
		$bg      = $adv && ! empty( $brand['background_image_id'] ) ? wp_get_attachment_image_url( (int) $brand['background_image_id'], 'full' ) : '';
		$shadow  = (string) ( $brand['shadow'] ?? 'soft' );
		$langs   = array();
		if ( Features::enabled( 'multilang' ) ) {
			foreach ( $enabled as $loc ) {
				$langs[] = array( 'code' => $loc, 'label' => I18n::language_name( $loc ) );
			}
		}
		$white = Features::enabled( 'white_label' );
		return array(
			'version'   => AGH_VERSION,
			'nonce'     => wp_create_nonce( 'agh_front' ),
			'wpNonce'   => is_user_logged_in() ? wp_create_nonce( 'wp_rest' ) : '',
			'logged_in' => is_user_logged_in(),
			'locale'    => (string) apply_filters( 'plugin_locale', determine_locale(), 'autogrowehome' ),
			'languages' => $langs,
			'schema'    => Registry::public_schema(),
			'defaults'  => Registry::defaults(),
			'i18n'      => Strings::designer(),
			'brand'     => array(
				'name'       => (string) Settings::get( 'general.plugin_name', 'AutoGroweHome' ),
				'author'     => $white ? '' : (string) Settings::get( 'general.author_name', '' ),
				'logo'       => $logo ? esc_url_raw( $logo ) : '',
				'icon'       => $icon ? esc_url_raw( $icon ) : '',
				'background' => $bg ? esc_url_raw( $bg ) : '',
				'title'      => $adv ? (string) ( $brand['popup_title'] ?? '' ) : '',
				'header'     => $adv ? (string) ( $brand['header_text'] ?? '' ) : '',
				'theme'      => $adv ? (string) ( $brand['default_theme'] ?? 'auto' ) : 'auto',
				'animations' => $adv ? (bool) ( $brand['animations'] ?? true ) : true,
				'shadow'     => $adv && in_array( $shadow, array( 'soft', 'none', 'strong' ), true ) ? $shadow : 'soft',
			),
			'layout'    => array(
				'order'      => array_values( array_intersect( explode( ',', (string) Settings::get( 'layout.panel_order', 'params,stage,summary' ) ), array( 'params', 'stage', 'summary' ) ) ),
				'action_bar' => 'top' === Settings::get( 'layout.action_bar' ) ? 'top' : 'bottom',
				'mode'       => 'detailed' === Settings::get( 'general.default_mode' ) ? 'detailed' : 'simple',
				'tour'       => (bool) Settings::get( 'layout.show_tour', true ),
			),
			'features'  => array(
				'save'        => Features::enabled( 'project_save' ),
				'full_params' => Features::enabled( 'full_params' ),
				'floorplans'  => Features::enabled( 'floorplans' ),
				'download'    => Features::enabled( 'hero_download' ),
				'quote'       => Features::enabled( 'contractor_email' ),
				'interpret'   => $status['text_ready'] && Settings::get( 'anthropic.use_for_interpret', true ),
			),
			'provider'  => array(
				'ready'   => $status['image_ready'],
				'test'    => $status['image_is_test'],
				'gallery' => (string) Settings::get( 'limits.gallery_mode', 'selected' ),
			),
			'limits'    => RateLimiter::status_for_current(),
			'consents'  => QuoteService::consents(),
			'tour'      => Help::tour(),
			'docs'      => array(
				'privacy' => (string) Settings::get( 'legal.privacy_url', '' ),
				'terms'   => (string) Settings::get( 'legal.terms_url', '' ),
			),
		);
	}
}
