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
use AutoGroweHome\Build\Build;
use AutoGroweHome\License\Features;
use AutoGroweHome\License\Payments;
use AutoGroweHome\Params\Definitions;
use AutoGroweHome\Params\Registry;
use AutoGroweHome\Prompt\VisionPrompt;
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
	/**
	 * Every module the 3D preview imports (exact URLs of the import statements), so the loader can
	 * fetch them in parallel ahead of time instead of one import level after the other.
	 */
	private static function three_deps(): array {
		$out = array();
		foreach ( array( 'vendor/three/three.module.min.js', 'vendor/three/jsm/controls/OrbitControls.js', 'vendor/three/jsm/postprocessing/EffectComposer.js', 'vendor/three/jsm/postprocessing/RenderPass.js', 'vendor/three/jsm/postprocessing/GTAOPass.js', 'vendor/three/jsm/postprocessing/OutputPass.js', 'vendor/three/jsm/postprocessing/Pass.js', 'vendor/three/jsm/postprocessing/ShaderPass.js', 'vendor/three/jsm/postprocessing/MaskPass.js', 'vendor/three/jsm/shaders/CopyShader.js', 'vendor/three/jsm/shaders/GTAOShader.js', 'vendor/three/jsm/shaders/OutputShader.js', 'vendor/three/jsm/shaders/PoissonDenoiseShader.js', 'vendor/three/jsm/math/SimplexNoise.js', 'agh-3d-tex.js', 'agh-3d-gen.js' ) as $rel ) {
			if ( file_exists( AGH_DIR . 'assets/js/' . $rel ) ) {
				$out[] = AGH_URL . 'assets/js/' . $rel;
			}
		}
		// The interiors and the surroundings are imported with the same version query as agh-3d.js.
		$out[] = AGH_URL . 'assets/js/agh-3d-int.js?ver=' . rawurlencode( self::asset_ver( 'assets/js/agh-3d.js' ) );
		$out[] = AGH_URL . 'assets/js/agh-3d-land.js?ver=' . rawurlencode( self::asset_ver( 'assets/js/agh-3d.js' ) );
		return $out;
	}

	public static function loader_config( bool $floating ): array {
		$label = (string) Settings::get( 'general.button_label', '' );
		$cfg   = array(
			'css'      => AGH_URL . 'assets/css/agh-designer.css?ver=' . rawurlencode( self::asset_ver( 'assets/css/agh-designer.css' ) ),
			'js'       => AGH_URL . 'assets/js/agh-designer.js?ver=' . rawurlencode( self::asset_ver( 'assets/js/agh-designer.js' ) ),
			'sketch'   => AGH_URL . 'assets/js/agh-sketch.js?ver=' . rawurlencode( self::asset_ver( 'assets/js/agh-sketch.js' ) ),
			'three'    => AGH_URL . 'assets/js/agh-3d.js?ver=' . rawurlencode( self::asset_ver( 'assets/js/agh-3d.js' ) ),
			'threeDeps' => self::three_deps(),
			'rest'     => wp_make_link_relative( esc_url_raw( rest_url( AGH_REST_NS . '/' ) ) ),
			'wpNonce'  => is_user_logged_in() ? wp_create_nonce( 'wp_rest' ) : '',
			'floating' => $floating,
			'label'    => '' !== $label ? $label : __( 'Tervezd meg álmaid otthonát', 'autogrowehome' ),
			'errBoot'  => __( 'A háztervező nem tölthető be. Kérjük, próbáld újra később.', 'autogrowehome' ),
			'loading'  => __( 'A háztervező betöltése…', 'autogrowehome' ),
			'ctaIcon'  => self::cta_icon(),
			'ctaCss'   => self::cta_css(),
			'vars'     => self::css_vars(),
		);
		// build mode („Építés az alapoktól”): the core module, only while the admin switch is on
		if ( Build::enabled() ) {
			$cfg['build'] = self::asset_url( 'assets/js/agh-build.js' );
		}
		return $cfg;
	}

	/** Versioned URL of a plugin asset (the same query as the other assets). */
	private static function asset_url( string $rel ): string {
		return AGH_URL . $rel . '?ver=' . rawurlencode( self::asset_ver( $rel ) );
	}

	/**
	 * Bootstrap part of build mode (only called while it is switched on): module URLs, the
	 * defaults and rule packages (assets/data – a missing or invalid file is left out) and the room types.
	 */
	private static function build_boot(): array {
		$out = array(
			'enabled' => true,
			'ui'      => self::asset_url( 'assets/js/agh-build-ui.js' ),
			'scene'   => self::asset_url( 'assets/js/agh-3d-build.js' ),
		);
		$defaults = Build::read_json( 'assets/data/build-defaults.json' );
		if ( null !== $defaults ) {
			$out['defaults'] = $defaults;
		}
		$hu = Build::read_json( 'assets/data/rules/hu.json' );
		if ( null !== $hu ) {
			$out['rules'] = array( 'hu' => $hu );
		}
		$out['room_types'] = array();
		foreach ( Definitions::room_types() as $k => $r ) {
			$out['room_types'][] = array( 'value' => (string) $k, 'label' => $r[0] );
		}
		return $out;
	}

	/* ------------------------------------------------------------------ shortcodes */

	public static function sc_designer( $atts ): string {
		if ( ! Features::enabled( 'designer' ) ) {
			return '';
		}
		self::enqueue_loader();
		$atts  = shortcode_atts( array( 'label' => '' ), (array) $atts );
		$label = '' !== $atts['label'] ? $atts['label'] : ( (string) Settings::get( 'general.button_label', '' ) ?: __( 'Tervezd meg álmaid otthonát', 'autogrowehome' ) );
		$css = '';
		if ( ! self::$cta_css_done ) { // the button's own look, before (and without) the designer's stylesheet
			self::$cta_css_done = true;
			$css = '<style id="agh-cta-css">' . self::cta_css() . '</style>';
		}
		return $css . '<div class="agh-cta-wrap"><button type="button" class="agh-cta" data-agh-open="1">' . self::cta_icon() . '<span class="agh-cta-label">' . esc_html( $label ) . '</span></button></div>';
	}

	/** @var bool The launcher CSS is printed once per page. */
	private static $cta_css_done = false;

	/**
	 * Image on the launcher button: the uploaded brand icon (advanced branding), else the logo, else a
	 * house symbol – as markup for inside the button.
	 */
	public static function cta_icon(): string {
		$url = self::cta_image();
		if ( '' !== $url ) {
			return '<span class="agh-cta-ico is-img" aria-hidden="true"><img src="' . esc_url( $url ) . '" alt="" width="40" height="40" decoding="async"></span>';
		}
		return '<span class="agh-cta-ico" aria-hidden="true">' . self::cta_svg() . '</span>';
	}

	private static function cta_image(): string {
		$brand = (array) Settings::get( 'branding' );
		$icon  = Features::enabled( 'branding_advanced' ) && ! empty( $brand['icon_id'] ) ? wp_get_attachment_image_url( (int) $brand['icon_id'], 'thumbnail' ) : '';
		if ( ! $icon && ! empty( $brand['logo_id'] ) ) {
			$icon = wp_get_attachment_image_url( (int) $brand['logo_id'], 'thumbnail' );
		}
		return $icon ? (string) $icon : '';
	}

	private static function cta_svg(): string {
		return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>';
	}

	/**
	 * Theme-proof style of the launcher buttons (shortcode and floating): the same rules the designer
	 * stylesheet had, plus a reset of the properties themes like to put on every button.
	 */
	public static function cta_css(): string {
		$b       = (array) Settings::get( 'branding' );
		$primary = preg_match( '/^#[0-9a-fA-F]{6}$/', (string) ( $b['color_primary'] ?? '' ) ) ? $b['color_primary'] : '#B9824F';
		return '.agh-cta-wrap{margin:1em 0}'
			. '.agh-cta-wrap .agh-cta,.agh-fab{display:inline-flex;align-items:center;gap:12px;margin:0;min-height:60px;padding:6px 24px 6px 6px;border-radius:999px;border:1px solid rgba(255,255,255,.7);'
			. 'background:linear-gradient(135deg,rgba(255,255,255,.8),rgba(255,255,255,.5));-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:0 12px 34px rgba(30,34,38,.18);'
			. 'color:#1E2226;cursor:pointer;font:600 15px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.02em;text-transform:none;text-decoration:none;text-align:left;box-sizing:border-box;'
			. 'transition:transform .25s ease,box-shadow .25s}'
			. '.agh-cta-wrap .agh-cta:hover,.agh-fab:hover{transform:translateY(-2px);box-shadow:0 16px 40px rgba(30,34,38,.24);background:linear-gradient(135deg,rgba(255,255,255,.9),rgba(255,255,255,.6));color:#1E2226}'
			. '.agh-cta-wrap .agh-cta:focus-visible,.agh-fab:focus-visible{outline:3px solid ' . $primary . ';outline-offset:3px}'
			. '.agh-cta .agh-cta-ico,.agh-fab .agh-cta-ico{flex:none;display:inline-grid;place-items:center;width:48px;height:48px;margin:0;padding:0;border-radius:50%;background:' . $primary . ';color:#fff;line-height:0;overflow:hidden;box-sizing:border-box}'
			. '.agh-cta .agh-cta-ico svg,.agh-fab .agh-cta-ico svg{width:26px;height:26px;display:block}'
			. '.agh-cta .agh-cta-ico.is-img,.agh-fab .agh-cta-ico.is-img{background:#fff;border:1px solid rgba(30,34,38,.12);border-radius:12px;padding:3px}'
			. '.agh-cta .agh-cta-ico.is-img img,.agh-fab .agh-cta-ico.is-img img{width:40px;height:40px;max-width:none;object-fit:contain;display:block;margin:0;border:0;border-radius:6px;box-shadow:none}'
			. '.agh-fab{position:fixed;right:22px;bottom:22px;z-index:99990}'
			. '@media (max-width:820px){.agh-fab{right:14px;bottom:14px}}';
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
		$data  = array(
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
				'start'      => 'designer' === Settings::get( 'layout.start_view', 'wizard' ) ? 'designer' : 'wizard',
			),
			'features'  => array(
				'save'        => Features::enabled( 'project_save' ),
				'full_params' => Features::enabled( 'full_params' ),
				// settings hidden by the licence plan (Starter shows the basic set only)
				'params_locked' => count( array_filter( Registry::fields(), function ( $d ) { return ! empty( $d['locked'] ); } ) ),
				'manage'      => current_user_can( 'agh_manage' ),
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
			// the shape of the guide picture taken from the 3D model: the same as the finished image
			// clean: no vehicles, people, pets, background trees and haze on the guide (the model paints
			// them for real from the prompt); camera: "auto" lowers a high hero camera to photographer height
			// rooms: how many rooms get an interior guide
			'guide'     => array(
				'aspect' => (float) Settings::get( 'magnific.guide_aspect', 1.645 ),
				'clean'  => (bool) Settings::get( 'magnific.guide_clean', true ),
				'camera' => (string) Settings::get( 'magnific.hero_camera', 'auto' ),
				'rooms'  => min( 8, (int) Settings::get( 'limits.interiors_max', 4 ) ),
				// 1.15.0: beside a clean guide the full scene is taken too – Claude writes the prompt from it
				'scene'  => (bool) Settings::get( 'magnific.guide_clean', true ) && VisionPrompt::applies( 'view', 'hero' ) && VisionPrompt::enabled(),
			),
			'consents'  => QuoteService::consents(),
			'tour'      => Help::tour(),
			'docs'      => array(
				'privacy' => (string) Settings::get( 'legal.privacy_url', '' ),
				'terms'   => (string) Settings::get( 'legal.terms_url', '' ),
			),
		);
		if ( Build::enabled() ) {
			$data['build'] = self::build_boot();
		}
		return $data;
	}
}
