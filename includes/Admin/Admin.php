<?php
/**
 * WordPress admin control centre.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Admin;

use AutoGroweHome\Ai\Providers;
use AutoGroweHome\Catalog\Catalog;
use AutoGroweHome\Frontend\Frontend;
use AutoGroweHome\Frontend\Help;
use AutoGroweHome\Frontend\I18n;
use AutoGroweHome\Generation\JobQueue;
use AutoGroweHome\Installer;
use AutoGroweHome\License\Features;
use AutoGroweHome\License\LicenseManager;
use AutoGroweHome\Mail\Mailer;
use AutoGroweHome\Params\Definitions;
use AutoGroweHome\Params\Registry;
use AutoGroweHome\Projects\Repository;
use AutoGroweHome\Prompt\DefaultModules;
use AutoGroweHome\Prompt\PromptEngine;
use AutoGroweHome\Quote\QuoteService;
use AutoGroweHome\RateLimit\RateLimiter;
use AutoGroweHome\Stats\Stats;
use AutoGroweHome\Support\Logger;
use AutoGroweHome\Support\Secrets;
use AutoGroweHome\Support\Settings;
use AutoGroweHome\Support\Storage;
use AutoGroweHome\Support\Util;

defined( 'ABSPATH' ) || exit;

final class Admin {

	public static function init(): void {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'assets' ) );
		add_action( 'admin_post_agh_save', array( __CLASS__, 'handle_save' ) );
		add_action( 'admin_post_agh_action', array( __CLASS__, 'handle_action' ) );
		add_action( 'admin_notices', array( __CLASS__, 'notices' ) );
		add_filter( 'plugin_action_links_' . AGH_BASENAME, array( __CLASS__, 'action_links' ) );
	}

	public static function pages(): array {
		return array(
			'agh-dashboard'  => array( __( 'Vezérlőpult', 'autogrowehome' ), 'agh_view_projects', 'dashboard' ),
			'agh-projects'   => array( __( 'Projektek', 'autogrowehome' ), 'agh_view_projects', 'projects' ),
			'agh-quotes'     => array( __( 'Ajánlatkérések', 'autogrowehome' ), 'agh_view_projects', 'quotes' ),
			'agh-stats'      => array( __( 'Statisztika', 'autogrowehome' ), 'agh_view_stats', 'stats' ),
			'agh-providers'  => array( __( 'AI-szolgáltatók', 'autogrowehome' ), 'agh_manage', 'providers' ),
			'agh-prompts'    => array( __( 'Promptmotor', 'autogrowehome' ), 'agh_manage', 'prompts' ),
			'agh-params'     => array( __( 'Paraméterek', 'autogrowehome' ), 'agh_manage', 'params' ),
			'agh-catalog'    => array( __( 'Katalógus', 'autogrowehome' ), 'agh_manage', 'catalog' ),
			'agh-branding'   => array( __( 'Arculat és elrendezés', 'autogrowehome' ), 'agh_manage', 'branding' ),
			'agh-limits'     => array( __( 'Limitek és hozzáférés', 'autogrowehome' ), 'agh_manage', 'limits' ),
			'agh-contractor' => array( __( 'Kivitelező és e-mail', 'autogrowehome' ), 'agh_manage', 'contractor' ),
			'agh-legal'      => array( __( 'Jogi és GDPR', 'autogrowehome' ), 'agh_manage', 'legal' ),
			'agh-license'    => array( __( 'Licenc', 'autogrowehome' ), 'agh_manage', 'license' ),
			'agh-help'       => array( __( 'Súgó és rendszer', 'autogrowehome' ), 'agh_manage', 'help' ),
		);
	}

	public static function menu(): void {
		$name = (string) Settings::get( 'general.plugin_name', 'AutoGroweHome' );
		$icon = 'data:image/svg+xml;base64,' . base64_encode( '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#a7aaad" stroke-width="1.8"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>' );
		add_menu_page( $name, $name, 'agh_view_projects', 'agh-dashboard', array( __CLASS__, 'render' ), $icon, 58 );
		foreach ( self::pages() as $slug => $p ) {
			add_submenu_page( 'agh-dashboard', $p[0] . ' – ' . $name, $p[0], $p[1], $slug, array( __CLASS__, 'render' ) );
		}
	}

	public static function action_links( array $links ): array {
		array_unshift( $links, '<a href="' . esc_url( admin_url( 'admin.php?page=agh-dashboard' ) ) . '">' . esc_html__( 'Vezérlőpult', 'autogrowehome' ) . '</a>' );
		return $links;
	}

	public static function assets( string $hook ): void {
		if ( false === strpos( $hook, 'agh-' ) ) {
			return;
		}
		wp_enqueue_style( 'wp-color-picker' );
		wp_enqueue_media();
		wp_enqueue_style( 'agh-admin', AGH_URL . 'assets/css/agh-admin.css', array(), Frontend::asset_ver( 'assets/css/agh-admin.css' ) );
		wp_enqueue_script( 'agh-admin', AGH_URL . 'assets/js/agh-admin.js', array( 'jquery', 'wp-color-picker' ), Frontend::asset_ver( 'assets/js/agh-admin.js' ), true );
		wp_localize_script(
			'agh-admin',
			'AGH_ADMIN',
			array(
				'rest'  => esc_url_raw( rest_url( AGH_REST_NS . '/' ) ),
				'nonce' => wp_create_nonce( 'wp_rest' ),
				'i18n'  => array(
					'testing'  => __( 'Tesztelés…', 'autogrowehome' ),
					'ok'       => __( 'Rendben', 'autogrowehome' ),
					'error'    => __( 'Hiba', 'autogrowehome' ),
					'confirm'  => __( 'Biztosan? A művelet nem vonható vissza.', 'autogrowehome' ),
					'pick'     => __( 'Kép kiválasztása', 'autogrowehome' ),
					'use'      => __( 'Használat', 'autogrowehome' ),
					'running'  => __( 'Futtatás…', 'autogrowehome' ),
					'started'  => __( 'Tesztgenerálás elindult:', 'autogrowehome' ),
				),
				'stats' => array(
					'popup_open'      => __( 'Popupmegnyitás', 'autogrowehome' ),
					'design_start'    => __( 'Tervezés indítása', 'autogrowehome' ),
					'generate'        => __( 'Generálási kérés', 'autogrowehome' ),
					'concepts'        => __( 'Elkészült koncepció', 'autogrowehome' ),
					'selected'        => __( 'Koncepció kiválasztva', 'autogrowehome' ),
					'saved'           => __( 'Mentett projekt', 'autogrowehome' ),
					'quotes'          => __( 'Ajánlatkérés', 'autogrowehome' ),
					'conversion'      => __( 'Ajánlatkérési konverzió', 'autogrowehome' ),
					'images'          => __( 'Sikeres / sikertelen kép', 'autogrowehome' ),
					'success_rate'    => __( 'Képsikeresség', 'autogrowehome' ),
					'avg_time'        => __( 'Átl. generálási idő', 'autogrowehome' ),
					'downloads'       => __( 'Csomagletöltés', 'autogrowehome' ),
					'cost'            => __( 'Becsült költség', 'autogrowehome' ),
					'cost_concept'    => __( 'Költség / koncepció', 'autogrowehome' ),
					'cost_quote'      => __( 'Költség / ajánlatkérés', 'autogrowehome' ),
					'limit_hit'       => __( 'Limit miatt elutasítva', 'autogrowehome' ),
					'trend'           => __( 'Napi trend', 'autogrowehome' ),
					'b_style'         => __( 'Házstílusok', 'autogrowehome' ),
					'b_roof'          => __( 'Tetőtípusok', 'autogrowehome' ),
					'b_area'          => __( 'Alapterület-sávok', 'autogrowehome' ),
					'b_param'         => __( 'Legnépszerűbb paraméterek', 'autogrowehome' ),
					'b_error'         => __( 'Hibaokok', 'autogrowehome' ),
					'b_cost'          => __( 'Költség szolgáltatónként', 'autogrowehome' ),
					'b_ok'            => __( 'Szolgáltató sikeres hívás', 'autogrowehome' ),
					'b_fail'          => __( 'Szolgáltató hiba', 'autogrowehome' ),
					'b_limit'         => __( 'Limit okok', 'autogrowehome' ),
					'l_generate'      => __( 'Generálás', 'autogrowehome' ),
					'l_popup'         => __( 'Popup', 'autogrowehome' ),
					'l_quote'         => __( 'Ajánlatkérés', 'autogrowehome' ),
				),
			)
		);
	}

	private static function current_page(): string {
		return isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : 'agh-dashboard'; // phpcs:ignore WordPress.Security.NonceVerification
	}

	public static function render(): void {
		$slug  = self::current_page();
		$pages = self::pages();
		if ( ! isset( $pages[ $slug ] ) || ! current_user_can( $pages[ $slug ][1] ) ) {
			wp_die( esc_html__( 'Nincs jogosultságod.', 'autogrowehome' ) );
		}
		echo '<div class="wrap agh-admin">';
		echo '<header class="agh-admin-head"><div class="agh-admin-mark">⌂</div><div><p class="agh-admin-eyebrow">' . esc_html( (string) Settings::get( 'general.plugin_name', 'AutoGroweHome' ) ) . ' · v' . esc_html( AGH_VERSION ) . '</p><h1>' . esc_html( $pages[ $slug ][0] ) . '</h1></div></header>';
		if ( isset( $_GET['agh_msg'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
			$msg  = sanitize_text_field( wp_unslash( $_GET['agh_msg'] ) ); // phpcs:ignore
			$type = isset( $_GET['agh_type'] ) && 'error' === $_GET['agh_type'] ? 'error' : 'success'; // phpcs:ignore
			echo '<div class="notice notice-' . esc_attr( $type ) . ' is-dismissible"><p>' . esc_html( $msg ) . '</p></div>';
		}
		$reset = get_transient( 'agh_save_warn_' . get_current_user_id() );
		if ( is_array( $reset ) ) {
			delete_transient( 'agh_save_warn_' . get_current_user_id() );
			foreach ( $reset as $w ) {
				echo '<div class="notice notice-warning is-dismissible"><p>' . esc_html( (string) $w ) . '</p></div>';
			}
		}
		$method = 'page_' . $pages[ $slug ][2];
		Pages::$method();
		echo '</div>';
	}

	/* ------------------------------------------------------------------ specs */

	public static function specs(): array {
		$views = array();
		foreach ( DefaultModules::views() as $k => $v ) {
			if ( 'interior' !== $k ) {
				$views[ $k ] = $v['label'];
			}
		}
		$locales = I18n::SUPPORTED;
		$image_providers = array();
		foreach ( Providers::images() as $id => $p ) {
			$image_providers[ $id ] = $p->label();
		}
		return array(
			'providers'  => array(
				'anthropic' => array(
					array( 'h1', 'heading', __( 'Anthropic API – szövegértelmezés és tervezés', 'autogrowehome' ), __( 'Igényértelmezés, három koncepció megtervezése, ellentmondások jelzése. A képeket nem az Anthropic készíti.', 'autogrowehome' ) ),
					array( 'enabled', 'bool', __( 'Engedélyezve', 'autogrowehome' ) ),
					array( 'key', 'secret', __( 'API-kulcs', 'autogrowehome' ), '', array( 'secret' => 'anthropic_api_key' ) ),
					array( 'endpoint', 'url', __( 'API-végpont', 'autogrowehome' ) ),
					array( 'model', 'text', __( 'Modellazonosító', 'autogrowehome' ), __( 'Pl. claude-sonnet-5-5. A „Kapcsolat teszt” kilistázza az elérhető modelleket.', 'autogrowehome' ) ),
					array( 'version', 'text', __( 'API-verzió fejléc', 'autogrowehome' ) ),
					array( 'max_tokens', 'number', __( 'Max. kimeneti token', 'autogrowehome' ), '', array( 'min' => 1000, 'max' => 64000 ) ),
					array( 'temperature', 'float', __( 'Temperature', 'autogrowehome' ), '', array( 'min' => 0, 'max' => 1, 'step' => '0.1' ) ),
					array( 'timeout', 'number', __( 'Időtúllépés', 'autogrowehome' ), '', array( 'min' => 10, 'max' => 300, 'unit' => 's' ) ),
					array( 'retries', 'number', __( 'Újrapróbálkozások', 'autogrowehome' ), '', array( 'min' => 0, 'max' => 5 ) ),
					array( 'use_for_plan', 'bool', __( 'Koncepciótervezés AI-val', 'autogrowehome' ), __( 'Kikapcsolva a beépített szabályalapú tervező készíti a három koncepciót.', 'autogrowehome' ) ),
					array( 'use_for_interpret', 'bool', __( '„AI értelmezés” gomb a látogatóknak', 'autogrowehome' ) ),
				),
				'images'    => array(
					array( 'h2', 'heading', __( 'Képgenerálás', 'autogrowehome' ) ),
					array( 'active_provider', 'select', __( 'Aktív szolgáltató', 'autogrowehome' ), '', array( 'options' => $image_providers ) ),
					array( 'fallback_provider', 'select', __( 'Tartalék szolgáltató', 'autogrowehome' ), __( 'Végleges hiba esetén ide vált. A teszt mód tartalékként csak fejlesztéshez ajánlott.', 'autogrowehome' ), array( 'options' => array( '' => __( '– nincs –', 'autogrowehome' ) ) + $image_providers ) ),
					array( 'allow_test_provider', 'bool', __( 'Teszt mód engedélyezése', 'autogrowehome' ), __( 'Helyi, egyértelműen „TESZT” feliratú vázlatképek API-kulcs nélkül – a teljes folyamat kipróbálásához.', 'autogrowehome' ) ),
				),
				'magnific'  => array(
					array( 'h3', 'heading', 'Magnific API', __( 'Hivatalos dokumentáció: <a href="https://docs.magnific.com/api-reference" target="_blank" rel="noopener">docs.magnific.com</a>', 'autogrowehome' ) ),
					array( 'enabled', 'bool', __( 'Engedélyezve', 'autogrowehome' ) ),
					array( 'key', 'secret', __( 'API-kulcs', 'autogrowehome' ), '', array( 'secret' => 'magnific_api_key' ) ),
					array( 'base_url', 'url', __( 'Alap URL', 'autogrowehome' ) ),
					array( 'hero_endpoint', 'text', __( 'Fő kép végpont (Mystic)', 'autogrowehome' ) ),
					array( 'mystic_model', 'select', __( 'Mystic modell', 'autogrowehome' ), '', array( 'options' => array( 'realism' => 'realism', 'super_real' => 'super_real', 'flexible' => 'flexible', 'fluid' => 'fluid', 'zen' => 'zen', 'editorial_portraits' => 'editorial_portraits' ) ) ),
					array( 'mystic_engine', 'select', __( 'Mystic engine', 'autogrowehome' ), '', array( 'options' => array( 'automatic' => 'automatic', 'magnific_illusio' => 'magnific_illusio', 'magnific_sharpy' => 'magnific_sharpy', 'magnific_sparkle' => 'magnific_sparkle' ) ) ),
					array( 'creative_detailing', 'number', __( 'Creative detailing', 'autogrowehome' ), '', array( 'min' => 0, 'max' => 100 ) ),
					array( 'preview_resolution', 'select', __( 'Koncepcióképek felbontása', 'autogrowehome' ), __( 'A három fő kép felbontása (költség!).', 'autogrowehome' ), array( 'options' => array( '1k' => '1K', '2k' => '2K', '4k' => '4K' ) ) ),
					array( 'final_resolution', 'select', __( 'Végleges felbontás', 'autogrowehome' ), __( '„Minden galéria” módban a fő képek ezzel készülnek. 4K-nak csak a ténylegesen ≥3840 px képek jelölődnek.', 'autogrowehome' ), array( 'options' => array( '2k' => '2K', '4k' => '4K' ) ) ),
					array( 'view_strategy', 'select', __( 'Nézetek konzisztenciája', 'autogrowehome' ), __( '„Referencia”: a fő képet bemeneti képként adja a további nézetekhez (Flux 2 Pro). „Stílus”: Mystic style_reference.', 'autogrowehome' ), array( 'options' => array( 'reference' => __( 'Referenciakép (ajánlott)', 'autogrowehome' ), 'style' => __( 'Stílusreferencia', 'autogrowehome' ) ) ) ),
					array( 'reference_endpoint', 'text', __( 'Referenciás végpont', 'autogrowehome' ) ),
					array( 'reference_width', 'number', __( 'Referenciás kép szélesség', 'autogrowehome' ), '', array( 'min' => 256, 'max' => 1440, 'unit' => 'px' ) ),
					array( 'reference_height', 'number', __( 'Referenciás kép magasság', 'autogrowehome' ), '', array( 'min' => 256, 'max' => 1440, 'unit' => 'px' ) ),
					array( 'style_adherence', 'number', __( 'Stílusreferencia erőssége', 'autogrowehome' ), '', array( 'min' => 0, 'max' => 100 ) ),
					array( 'structure_guidance', 'bool', __( 'Geometriai vezetés (tömegvázlat)', 'autogrowehome' ), __( 'A tervvázlatból renderelt tömegvázlatot structure referenceként küldi a homlokzati nézetekhez.', 'autogrowehome' ) ),
					array( 'structure_strength', 'number', __( 'Geometriai vezetés erőssége', 'autogrowehome' ), '', array( 'min' => 0, 'max' => 100 ) ),
					array( 'upscale_enabled', 'bool', __( 'Felskálázás a kiválasztott galériánál', 'autogrowehome' ), __( 'A 3840 px alatti képeket felskálázza (külön költség). A felskálázott képek jelölve vannak.', 'autogrowehome' ) ),
					array( 'upscale_endpoint', 'text', __( 'Felskálázó végpont', 'autogrowehome' ) ),
					array( 'upscale_sharpen', 'number', __( 'Élesítés', 'autogrowehome' ), '', array( 'min' => 0, 'max' => 100 ) ),
					array( 'upscale_ultra_detail', 'number', __( 'Ultra detail', 'autogrowehome' ), '', array( 'min' => 0, 'max' => 100 ) ),
					array( 'timeout', 'number', __( 'Feladat időtúllépés', 'autogrowehome' ), '', array( 'min' => 60, 'max' => 1800, 'unit' => 's' ) ),
					array( 'poll_interval', 'number', __( 'Állapotlekérdezés gyakorisága', 'autogrowehome' ), '', array( 'min' => 3, 'max' => 60, 'unit' => 's' ) ),
					array( 'retries', 'number', __( 'HTTP újrapróbálkozás', 'autogrowehome' ), '', array( 'min' => 0, 'max' => 5 ) ),
					array( 'use_webhook', 'bool', __( 'Webhook használata', 'autogrowehome' ), sprintf( /* translators: %s: url */ __( 'Webhook URL: <code>%s</code> (csak nyilvánosan elérhető HTTPS oldalon működik). Az URL titkos azonosítót tartalmaz – ne tedd közzé, ne oszd meg; a plugin automatikusan átadja a Magnificnak.', 'autogrowehome' ), esc_html( rest_url( AGH_REST_NS . '/webhook/magnific/' . Util::webhook_token() ) ) ) ),
					array( 'filter_nsfw', 'bool', __( 'Tartalomszűrés (NSFW)', 'autogrowehome' ), __( 'A Magnific tartalomszűrője a Mystic képkéréseknél (filter_nsfw). Bekapcsolva hagyása ajánlott.', 'autogrowehome' ) ),
				),
				'costs'     => array(
					array( 'h4', 'heading', __( 'Költségbecslés és költségkeret', 'autogrowehome' ), __( 'Az árakat a szolgáltató aktuális árlistája alapján te adod meg; a rendszer ezekkel becsül. A valós számlázás a szolgáltatónál történik.', 'autogrowehome' ) ),
					array( 'currency', 'text', __( 'Pénznem', 'autogrowehome' ) ),
					array( 'mystic_2k', 'float', __( 'Mystic kép (1K/2K) ára', 'autogrowehome' ), '', array( 'min' => 0, 'step' => '0.001' ) ),
					array( 'mystic_4k', 'float', __( 'Mystic kép (4K) ára', 'autogrowehome' ), '', array( 'min' => 0, 'step' => '0.001' ) ),
					array( 'reference_image', 'float', __( 'Referenciás kép ára', 'autogrowehome' ), '', array( 'min' => 0, 'step' => '0.001' ) ),
					array( 'upscale', 'float', __( 'Felskálázás ára', 'autogrowehome' ), '', array( 'min' => 0, 'step' => '0.001' ) ),
					array( 'anthropic_in_mtok', 'float', __( 'Anthropic bemenet / 1M token', 'autogrowehome' ), '', array( 'min' => 0, 'step' => '0.01' ) ),
					array( 'anthropic_out_mtok', 'float', __( 'Anthropic kimenet / 1M token', 'autogrowehome' ), '', array( 'min' => 0, 'step' => '0.01' ) ),
					array( 'daily_budget', 'float', __( 'Napi költségkeret', 'autogrowehome' ), __( '0 = nincs korlát.', 'autogrowehome' ), array( 'min' => 0 ) ),
					array( 'monthly_budget', 'float', __( 'Havi költségkeret', 'autogrowehome' ), __( '0 = nincs korlát.', 'autogrowehome' ), array( 'min' => 0 ) ),
				),
			),
			'branding'   => array(
				'general'  => array(
					array( 'h1', 'heading', __( 'Termék és megjelenés', 'autogrowehome' ) ),
					array( 'plugin_name', 'text', __( 'Plugin / termék neve', 'autogrowehome' ) ),
					array( 'author_name', 'text', __( 'Készítő neve', 'autogrowehome' ), __( 'White-label csomagban elrejthető.', 'autogrowehome' ) ),
					array( 'button_label', 'text', __( 'Indítógomb felirata', 'autogrowehome' ) ),
					array( 'floating_button', 'bool', __( 'Lebegő indítógomb minden oldalon', 'autogrowehome' ), __( 'Csak egy ~3 KB-os betöltő kerül az oldalakra; a tervező első kattintáskor töltődik be. Shortcode: <code>[autogrowehome]</code>', 'autogrowehome' ) ),
					array( 'default_mode', 'select', __( 'Alapértelmezett mód', 'autogrowehome' ), '', array( 'options' => array( 'simple' => __( 'Egyszerű', 'autogrowehome' ), 'detailed' => __( 'Részletes', 'autogrowehome' ) ) ) ),
					array( 'frontend_locale', 'select', __( 'Felület alapnyelve', 'autogrowehome' ), '', array( 'options' => array( 'auto' => __( 'A webhely nyelve', 'autogrowehome' ) ) + $locales ) ),
					array( 'enabled_locales', 'multicheck', __( 'Választható nyelvek', 'autogrowehome' ), __( 'A nyelvi fájlok állapotát a Súgó és rendszer oldal mutatja.', 'autogrowehome' ), array( 'options' => $locales ) ),
				),
				'branding' => array(
					array( 'h2', 'heading', __( 'Arculat', 'autogrowehome' ) ),
					array( 'logo_id', 'media', __( 'Logó', 'autogrowehome' ) ),
					array( 'icon_id', 'media', __( 'Ikon', 'autogrowehome' ), __( 'A tervező fejlécében a ház-jel helyett jelenik meg, ha nincs logó beállítva. Négyzetes kép ajánlott.', 'autogrowehome' ) ),
					array( 'background_image_id', 'media', __( 'Háttérkép (homályosítva)', 'autogrowehome' ) ),
					array( 'popup_title', 'text', __( 'Popup címe', 'autogrowehome' ) ),
					array( 'header_text', 'text', __( 'Fejléc alcím', 'autogrowehome' ) ),
					array( 'footer_text', 'text', __( 'Lábléc szöveg (e-mailek)', 'autogrowehome' ) ),
					array( 'color_primary', 'color', __( 'Fő márkaszín', 'autogrowehome' ) ),
					array( 'color_accent', 'color', __( 'Kiemelő szín', 'autogrowehome' ) ),
					array( 'color_success', 'color', __( 'Siker', 'autogrowehome' ) ),
					array( 'color_warning', 'color', __( 'Figyelmeztetés', 'autogrowehome' ) ),
					array( 'color_danger', 'color', __( 'Hiba', 'autogrowehome' ) ),
					array( 'color_ink', 'color', __( 'Szövegszín (világos mód)', 'autogrowehome' ) ),
					array( 'color_bg', 'color', __( 'Háttérszín (világos mód)', 'autogrowehome' ) ),
					array( 'font_body', 'text', __( 'Szövegbetűtípus (CSS font-family)', 'autogrowehome' ), __( 'Rendszer-betűkészlet ajánlott; külső betűtípus-szolgáltatás GDPR-kérdéseket vet fel.', 'autogrowehome' ) ),
					array( 'font_heading', 'text', __( 'Címbetűtípus (CSS font-family)', 'autogrowehome' ) ),
					array( 'radius', 'number', __( 'Lekerekítés', 'autogrowehome' ), '', array( 'min' => 0, 'max' => 40, 'unit' => 'px' ) ),
					array( 'blur', 'number', __( 'Üveghatás homályosítás', 'autogrowehome' ), '', array( 'min' => 0, 'max' => 40, 'unit' => 'px' ) ),
					array( 'glass_opacity', 'float', __( 'Üvegfelület átlátszatlansága', 'autogrowehome' ), '', array( 'min' => 0.2, 'max' => 0.95, 'step' => '0.01' ) ),
					array( 'shadow', 'select', __( 'Árnyékok', 'autogrowehome' ), __( 'A tervező ablakának, paneljeinek és párbeszédablakainak árnyéka.', 'autogrowehome' ), array( 'options' => array( 'soft' => __( 'Lágy', 'autogrowehome' ), 'none' => __( 'Nincs', 'autogrowehome' ), 'strong' => __( 'Erős', 'autogrowehome' ) ) ) ),
					array( 'animations', 'bool', __( 'Animációk', 'autogrowehome' ) ),
					array( 'default_theme', 'select', __( 'Alapértelmezett téma', 'autogrowehome' ), '', array( 'options' => array( 'auto' => __( 'Rendszer szerint', 'autogrowehome' ), 'light' => __( 'Világos', 'autogrowehome' ), 'dark' => __( 'Sötét', 'autogrowehome' ) ) ) ),
				),
				'layout'   => array(
					array( 'h3', 'heading', __( 'Popup elrendezés', 'autogrowehome' ) ),
					array( 'panel_order', 'select', __( 'Panelek sorrendje', 'autogrowehome' ), '', array( 'options' => array( 'params,stage,summary' => __( 'Paraméterek – Terv – Összegzés', 'autogrowehome' ), 'summary,stage,params' => __( 'Összegzés – Terv – Paraméterek', 'autogrowehome' ), 'stage,params,summary' => __( 'Terv – Paraméterek – Összegzés', 'autogrowehome' ) ) ) ),
					array( 'left_width', 'number', __( 'Paraméterpanel szélessége', 'autogrowehome' ), '', array( 'min' => 260, 'max' => 480, 'unit' => 'px' ) ),
					array( 'right_width', 'number', __( 'Összegző panel szélessége', 'autogrowehome' ), '', array( 'min' => 240, 'max' => 440, 'unit' => 'px' ) ),
					array( 'action_bar', 'select', __( 'Műveleti sáv helye', 'autogrowehome' ), '', array( 'options' => array( 'bottom' => __( 'Lent', 'autogrowehome' ), 'top' => __( 'Fent', 'autogrowehome' ) ) ) ),
					array( 'start_view', 'select', __( 'Kezdőnézet', 'autogrowehome' ), __( 'Mivel nyíljon meg a tervező. A látogató bármikor átválthat, a választását a böngészője megjegyzi.', 'autogrowehome' ), array( 'options' => array( 'wizard' => __( 'Gyors varázsló', 'autogrowehome' ), 'designer' => __( 'Teljes tervező', 'autogrowehome' ) ) ) ),
					array( 'show_tour', 'bool', __( 'Gyorsbemutató első megnyitáskor', 'autogrowehome' ) ),
				),
			),
			'limits'     => array(
				'limits' => array(
					array( 'h1', 'heading', __( 'Generálási limitek', 'autogrowehome' ), __( 'Egy teljes kérés = három házkoncepció = 1 egység.', 'autogrowehome' ) ),
					array( 'ip_daily', 'number', __( 'IP-címenkénti napi limit', 'autogrowehome' ), '', array( 'min' => 0, 'max' => 1000 ) ),
					array( 'user_daily', 'number', __( 'Felhasználónkénti napi limit', 'autogrowehome' ), __( '0 = nincs külön felhasználói limit.', 'autogrowehome' ), array( 'min' => 0, 'max' => 1000 ) ),
					array( 'global_daily', 'number', __( 'Globális napi limit', 'autogrowehome' ), __( '0 = nincs.', 'autogrowehome' ), array( 'min' => 0, 'max' => 100000 ) ),
					array( 'burst_window_min', 'number', __( 'Visszaélésvédelem – időablak', 'autogrowehome' ), '', array( 'min' => 1, 'max' => 120, 'unit' => 'perc' ) ),
					array( 'burst_max', 'number', __( 'Visszaélésvédelem – max. kérés az ablakban', 'autogrowehome' ), '', array( 'min' => 0, 'max' => 100 ) ),
					array( 'concurrent_per_ip', 'number', __( 'Egyidejű generálás / IP', 'autogrowehome' ), '', array( 'min' => 1, 'max' => 10 ) ),
					array( 'timezone', 'text', __( 'Napi időszak időzónája', 'autogrowehome' ), __( 'Üresen: a webhely időzónája. Pl. Europe/Budapest', 'autogrowehome' ) ),
					array( 'day_start_hour', 'number', __( 'Nap kezdete (óra)', 'autogrowehome' ), '', array( 'min' => 0, 'max' => 23 ) ),
					array( 'trusted_proxies', 'textarea', __( 'Megbízható proxyk / CDN (IP vagy CIDR)', 'autogrowehome' ), __( 'Csak ezekről fogadjuk el a továbbított IP-fejlécet. Cloudflare esetén add meg a Cloudflare IP-tartományait és a CF-Connecting-IP fejlécet.', 'autogrowehome' ), array( 'rows' => 3 ) ),
					array( 'proxy_header', 'text', __( 'Továbbított IP fejléc', 'autogrowehome' ) ),
					array( 'h2', 'heading', __( 'Galéria és képszám', 'autogrowehome' ) ),
					array( 'gallery_mode', 'select', __( 'Galéria készítése', 'autogrowehome' ), '', array( 'options' => array( 'selected' => __( 'Csak a kiválasztott házhoz (ajánlott)', 'autogrowehome' ), 'all' => __( 'Mindhárom házhoz azonnal', 'autogrowehome' ) ) ) ),
					array( 'exterior_views', 'multicheck', __( 'Külső nézetek', 'autogrowehome' ), '', array( 'options' => $views ) ),
					array( 'interiors_max', 'number', __( 'Belső nézetek max. száma / változat', 'autogrowehome' ), '', array( 'min' => 0, 'max' => 20 ) ),
					array( 'max_images_request', 'number', __( 'Max. kép / galéria', 'autogrowehome' ), '', array( 'min' => 1, 'max' => 60 ) ),
					array( 'gallery_rebuilds_per_day', 'number', __( 'Galéria újragenerálás / nap / IP', 'autogrowehome' ), '', array( 'min' => 0, 'max' => 50 ) ),
					array( 'auto_retry_max', 'number', __( 'Automatikus újrapróbálás átmeneti hibánál', 'autogrowehome' ), '', array( 'min' => 0, 'max' => 5 ) ),
					array( 'dedupe_minutes', 'number', __( 'Duplikált kérés szűrése', 'autogrowehome' ), '', array( 'min' => 0, 'max' => 1440, 'unit' => 'perc' ) ),
					array( 'cache_hours', 'number', __( 'Azonos konfiguráció gyorsítótár', 'autogrowehome' ), __( 'Ugyanaz a látogató azonos beállítással ennyi ideig a meglévő tervet kapja, keret levonása nélkül.', 'autogrowehome' ), array( 'min' => 0, 'max' => 720, 'unit' => 'óra' ) ),
					array( 'max_parallel_jobs', 'number', __( 'Egyszerre futó háttérfeladatok', 'autogrowehome' ), __( 'Ennyi generálási / feldolgozási feladat futhat egyszerre a szerveren, az összes látogatóra együtt. 0 = nincs korlát.', 'autogrowehome' ), array( 'min' => 0, 'max' => 50 ) ),
				),
				'access' => array(
					array( 'h3', 'heading', __( 'Ügyféloldali hozzáférés', 'autogrowehome' ), __( 'A teljes galéria soha nem nyilvános. Az ügyfél a saját projektjét látja, a kivitelező jogosultságvédett csomagot kap.', 'autogrowehome' ) ),
					array( 'client_gallery_previews', 'bool', __( 'Ügyfél láthatja a galéria előnézeteit', 'autogrowehome' ) ),
					array( 'client_plan_previews', 'bool', __( 'Ügyfél láthatja a tervvázlatokat', 'autogrowehome' ) ),
					array( 'client_download', 'select', __( 'Ügyfél letöltése', 'autogrowehome' ), '', array( 'options' => array( 'hero' => __( 'Csak a kiválasztott ház fő képe', 'autogrowehome' ), 'none' => __( 'Semmi', 'autogrowehome' ), 'all' => __( 'Minden kép teljes méretben', 'autogrowehome' ) ) ) ),
					array( 'preview_max_px', 'number', __( 'Előnézet max. mérete', 'autogrowehome' ), '', array( 'min' => 480, 'max' => 2400, 'unit' => 'px' ) ),
				),
				'general' => array(
					array( 'h4', 'heading', __( 'Feladatsor', 'autogrowehome' ) ),
					array( 'queue_tick_on_poll', 'bool', __( 'Feladatfeldolgozás állapotlekérdezéskor', 'autogrowehome' ), __( 'Megbízható működés WP-Cron nélkül is. Nagy forgalomnál javasolt valódi cron: <code>wp agh queue run</code> percenként.', 'autogrowehome' ) ),
				),
			),
			'contractor' => array(
				'contractor' => array(
					array( 'h1', 'heading', __( 'Kivitelező', 'autogrowehome' ) ),
					array( 'name', 'text', __( 'Kivitelező neve', 'autogrowehome' ) ),
					array( 'company', 'text', __( 'Vállalkozás megnevezése', 'autogrowehome' ) ),
					array( 'contact_name', 'text', __( 'Kapcsolattartó neve', 'autogrowehome' ) ),
					array( 'email', 'email', __( 'Értesítési e-mail-cím', 'autogrowehome' ) ),
					array( 'lang', 'select', __( 'Értesítések nyelve', 'autogrowehome' ), '', array( 'options' => $locales ) ),
					array( 'multi_enabled', 'bool', __( 'Több kivitelező értesítése', 'autogrowehome' ), __( 'Agency csomag funkció.', 'autogrowehome' ) ),
					array( 'extra_emails', 'textarea', __( 'További kivitelezői címek', 'autogrowehome' ), '', array( 'rows' => 2 ) ),
					array( 'link_hours', 'number', __( 'Hivatkozás érvényessége', 'autogrowehome' ), '', array( 'min' => 1, 'max' => 2160, 'unit' => 'óra' ) ),
					array( 'session_hours', 'number', __( 'Portál munkamenet hossza', 'autogrowehome' ), '', array( 'min' => 1, 'max' => 168, 'unit' => 'óra' ) ),
					array( 'retention_days', 'number', __( 'Csomag megőrzési ideje', 'autogrowehome' ), '', array( 'min' => 1, 'max' => 3650, 'unit' => 'nap' ) ),
					array( 'client_confirmation', 'bool', __( 'Visszaigazoló e-mail az ügyfélnek', 'autogrowehome' ) ),
				),
				'emails'     => array(
					array( 'h2', 'heading', __( 'E-mail-sablonok', 'autogrowehome' ), __( 'Változók: ', 'autogrowehome' ) . '<code>' . esc_html( implode( ' ', Mailer::placeholders() ) ) . '</code>. ' . __( 'Üresen hagyva az alapértelmezett szöveg érvényes.', 'autogrowehome' ) ),
					array( 'from_name', 'text', __( 'Feladó neve', 'autogrowehome' ) ),
					array( 'from_email', 'email', __( 'Feladó e-mail', 'autogrowehome' ) ),
					array( 'contractor_subject', 'text', __( 'Kivitelezői e-mail tárgya', 'autogrowehome' ), '', array( 'placeholder' => Mailer::defaults()['contractor_subject'] ) ),
					array( 'contractor_body', 'textarea', __( 'Kivitelezői e-mail szövege', 'autogrowehome' ), '', array( 'rows' => 10 ) ),
					array( 'client_subject', 'text', __( 'Ügyfél-visszaigazolás tárgya', 'autogrowehome' ), '', array( 'placeholder' => Mailer::defaults()['client_subject'] ) ),
					array( 'client_body', 'textarea', __( 'Ügyfél-visszaigazolás szövege', 'autogrowehome' ), '', array( 'rows' => 6 ) ),
				),
			),
			'legal'      => array(
				'legal'   => array(
					array( 'h1', 'heading', __( 'Dokumentumok és hozzájárulások', 'autogrowehome' ), __( 'A jogi szövegek sablonok, nem jogilag ellenőrzött dokumentumok – a végleges feltételeket szakértővel ellenőriztesd.', 'autogrowehome' ) ),
					array( 'terms_required', 'bool', __( 'ÁSZF elfogadása szükséges', 'autogrowehome' ), __( 'Csak akkor jelenik meg, ha URL is meg van adva.', 'autogrowehome' ) ),
					array( 'terms_url', 'url', __( 'ÁSZF URL', 'autogrowehome' ) ),
					array( 'terms_version', 'text', __( 'ÁSZF verzió', 'autogrowehome' ) ),
					array( 'privacy_url', 'url', __( 'Adatkezelési tájékoztató URL', 'autogrowehome' ) ),
					array( 'privacy_version', 'text', __( 'Adatkezelési tájékoztató verzió', 'autogrowehome' ) ),
					array( 'contact_text', 'textarea', __( 'Kapcsolatfelvételi hozzájárulás szövege', 'autogrowehome' ), '', array( 'rows' => 3 ) ),
					array( 'marketing_enabled', 'bool', __( 'Opcionális marketing-hozzájárulás', 'autogrowehome' ) ),
					array( 'marketing_text', 'textarea', __( 'Marketing-hozzájárulás szövege', 'autogrowehome' ), '', array( 'rows' => 3 ) ),
					array( 'store_user_agent', 'bool', __( 'Böngészőazonosító (User-Agent) rögzítése', 'autogrowehome' ), __( 'Bekapcsolva a hozzájárulási napló az ajánlatkérő böngészőjének azonosítóját is tárolja (bizonyítékként). Személyes adatnak minősülhet: a GDPR-export tartalmazza, anonimizáláskor törlődik, a kivitelezőhöz nem kerül. Alapértelmezetten ki.', 'autogrowehome' ) ),
					array( 'h2', 'heading', __( 'Adatmegőrzés', 'autogrowehome' ), __( 'Napi automatikus törlés (WP-Cron).', 'autogrowehome' ) ),
					array( 'retention_drafts_days', 'number', __( 'Nem mentett projektek', 'autogrowehome' ), '', array( 'min' => 1, 'max' => 3650, 'unit' => 'nap' ) ),
					array( 'retention_projects_days', 'number', __( 'Mentett, ajánlatkérés nélküli projektek', 'autogrowehome' ), '', array( 'min' => 1, 'max' => 3650, 'unit' => 'nap' ) ),
					array( 'retention_quotes_days', 'number', __( 'Ajánlatkérések (utána anonimizálás)', 'autogrowehome' ), '', array( 'min' => 30, 'max' => 3650, 'unit' => 'nap' ) ),
					array( 'retention_logs_days', 'number', __( 'Naplók', 'autogrowehome' ), '', array( 'min' => 1, 'max' => 365, 'unit' => 'nap' ) ),
				),
				'general' => array(
					array( 'h3', 'heading', __( 'Eltávolítás', 'autogrowehome' ) ),
					array( 'delete_on_uninstall', 'bool', __( 'Minden adat törlése a plugin eltávolításakor', 'autogrowehome' ), __( 'Alapértelmezetten ki: deaktiváláskor és eltávolításkor az adatok megmaradnak.', 'autogrowehome' ) ),
				),
			),
		);
	}

	/* ------------------------------------------------------------------ handlers */

	private static function redirect( string $page, string $msg, bool $error = false, array $extra = array() ): void {
		$url = add_query_arg( array_merge( array( 'page' => $page, 'agh_msg' => rawurlencode( $msg ), 'agh_type' => $error ? 'error' : 'success' ), $extra ), admin_url( 'admin.php' ) );
		wp_safe_redirect( $url );
		exit;
	}

	public static function handle_save(): void {
		$page = isset( $_POST['agh_page'] ) ? sanitize_key( wp_unslash( $_POST['agh_page'] ) ) : '';
		check_admin_referer( 'agh_save_' . $page );
		if ( ! current_user_can( 'agh_manage' ) ) {
			wp_die( esc_html__( 'Nincs jogosultságod.', 'autogrowehome' ) );
		}
		$specs = self::specs();
		$key   = str_replace( 'agh-', '', $page );
		if ( ! isset( $specs[ $key ] ) ) {
			self::redirect( $page, __( 'Ismeretlen oldal.', 'autogrowehome' ), true );
		}
		$posted = isset( $_POST['agh'] ) && is_array( $_POST['agh'] ) ? wp_unslash( $_POST['agh'] ) : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- sanitized per spec in Form::save().
		if ( 'branding' === $key ) {
			self::push_design_history();
		}
		$reset = array();
		foreach ( $specs[ $key ] as $group => $spec ) {
			$sent  = Form::save( $group, $spec, (array) ( $posted[ $group ] ?? array() ) );
			$reset = array_merge( $reset, self::reset_warnings( $group, $spec, $sent ) );
		}
		if ( $reset ) {
			set_transient( 'agh_save_warn_' . get_current_user_id(), $reset, 5 * MINUTE_IN_SECONDS );
		}
		if ( 'providers' === $key ) {
			Form::save_secrets( isset( $_POST['agh_secret'] ) ? (array) $_POST['agh_secret'] : array(), isset( $_POST['agh_secret_clear'] ) ? (array) $_POST['agh_secret_clear'] : array() ); // phpcs:ignore
			Providers::reset();
		}
		Settings::flush();
		Logger::info( 'admin', 'Settings saved: ' . $key, array( 'user' => get_current_user_id() ) );
		self::redirect( $page, __( 'Beállítások mentve.', 'autogrowehome' ) );
	}

	/**
	 * Fields whose submitted value the Settings sanitizer replaced with the
	 * factory default (provider URLs must be https://, endpoint paths
	 * relative) – one admin warning per field. A mere normalisation (e.g. a
	 * missing leading "/" on a path) is not reported.
	 *
	 * @param array $sent Values passed to Settings::update_group() (Form::save()).
	 * @return string[]
	 */
	public static function reset_warnings( string $group, array $spec, array $sent ): array {
		$defaults = Settings::defaults();
		$out      = array();
		foreach ( $spec as $f ) {
			$k = (string) $f[0];
			if ( ! isset( $sent[ $k ] ) || ! is_string( $sent[ $k ] ) || '' === trim( $sent[ $k ] ) ) {
				continue;
			}
			$stored  = Settings::get( $group . '.' . $k );
			$default = $defaults[ $group ][ $k ] ?? null;
			if ( ! is_string( $stored ) || $stored === $sent[ $k ] || $stored !== $default || '/' . ltrim( trim( $sent[ $k ] ), '/' ) === $stored ) {
				continue;
			}
			/* translators: 1: field label 2: rejected value 3: factory default */
			$out[] = sprintf( __( 'A(z) „%1$s” mezőbe írt érték (%2$s) nem fogadható el – csak https:// cím, illetve relatív útvonal adható meg –, ezért a gyári érték került vissza: %3$s', 'autogrowehome' ), (string) $f[2], $sent[ $k ], $default );
		}
		return $out;
	}

	private static function push_design_history(): void {
		$hist   = get_option( 'agh_design_history', array() );
		$hist   = is_array( $hist ) ? $hist : array();
		array_unshift(
			$hist,
			array(
				'time'     => Util::now(),
				'user'     => get_current_user_id(),
				'branding' => Settings::get( 'branding' ),
				'layout'   => Settings::get( 'layout' ),
				'general'  => Settings::get( 'general' ),
			)
		);
		update_option( 'agh_design_history', array_slice( $hist, 0, 10 ), false );
	}

	/** A small admin-post button for a warning (nonce-protected, back to the current page). */
	private static function action_link( string $do, string $label ): string {
		$url = wp_nonce_url( admin_url( 'admin-post.php?action=agh_action&do=' . rawurlencode( $do ) . '&back=agh-dashboard' ), 'agh_action_' . $do );
		return '<a class="button button-secondary" href="' . esc_url( $url ) . '">' . esc_html( $label ) . '</a>';
	}

	public static function handle_action(): void {
		$do = isset( $_REQUEST['do'] ) ? sanitize_key( wp_unslash( $_REQUEST['do'] ) ) : '';
		check_admin_referer( 'agh_action_' . $do );
		$back = isset( $_REQUEST['back'] ) ? sanitize_key( wp_unslash( $_REQUEST['back'] ) ) : 'agh-dashboard';
		$cap  = in_array( $do, array( 'stats_csv' ), true ) ? 'agh_view_stats' : ( in_array( $do, array( 'resend_quote', 'quote_revoke', 'project_json' ), true ) ? 'agh_view_projects' : 'agh_manage' );
		if ( ! current_user_can( $cap ) ) {
			wp_die( esc_html__( 'Nincs jogosultságod.', 'autogrowehome' ) );
		}
		$p = wp_unslash( $_REQUEST ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- sanitized per action below.
		switch ( $do ) {
			case 'storage_recheck':
				delete_transient( 'agh_storage_health' );
				$h = Storage::health();
				set_transient( 'agh_storage_health', $h, HOUR_IN_SECONDS );
				if ( true === $h['public'] ) {
					self::redirect( $back, __( 'A védett könyvtár továbbra is elérhető HTTP-n. A szerverbeállítás után töltsd újra ezt a lapot.', 'autogrowehome' ), true );
				} elseif ( null === $h['public'] ) {
					self::redirect( $back, __( 'Az ellenőrzés nem futott le (a próbakérés nem ment át). Nézd meg a hibaüzenetet a naplóban.', 'autogrowehome' ), true );
				} else {
					self::redirect( $back, __( 'Rendben: a védett tárhely könyvtár kívülről nem érhető el.', 'autogrowehome' ) );
				}
				break;
			case 'storage_move':
				$m = Storage::move_from_uploads();
				delete_transient( 'agh_storage_health' );
				if ( $m['failed'] > 0 ) {
					/* translators: 1: moved projects, 2: moved files, 3: files left behind */
					self::redirect( $back, sprintf( __( 'Áthozva %1$d projekt (%2$d fájl), de %3$d fájl a régi helyen maradt (már létezett a célban vagy nem volt írható).', 'autogrowehome' ), $m['moved'], $m['files'], $m['failed'] ), true );
				} else {
					/* translators: 1: moved projects, 2: moved files */
					self::redirect( $back, sprintf( __( 'Áthozva %1$d projekt, %2$d fájl az új, védett helyre.', 'autogrowehome' ), $m['moved'], $m['files'] ) );
				}
				break;
			case 'prompt_save':
				if ( ! Features::enabled( 'prompt_editor' ) ) {
					self::redirect( $back, __( 'A promptszerkesztő ebben a csomagban nem érhető el.', 'autogrowehome' ), true );
				}
				$modules = array_map( 'strval', (array) ( $p['modules'] ?? array() ) );
				$views   = (array) ( $p['views'] ?? array() );
				$over    = array();
				foreach ( (array) ( $p['override'] ?? array() ) as $style => $mods ) {
					$mods = array_filter( array_map( 'trim', array_map( 'strval', (array) $mods ) ) );
					if ( $mods ) {
						$over[ $style ] = $mods;
					}
				}
				$v = PromptEngine::save_version( sanitize_text_field( (string) ( $p['label'] ?? '' ) ) ?: wp_date( 'Y-m-d H:i' ), $modules, $views, $over, ! empty( $p['activate'] ) );
				self::redirect( $back, sprintf( /* translators: %d: version */ __( 'Promptverzió mentve: v%d', 'autogrowehome' ), $v ) );
				break;
			case 'prompt_activate':
				PromptEngine::activate( (int) ( $p['version'] ?? 0 ) );
				self::redirect( $back, __( 'Promptverzió aktiválva.', 'autogrowehome' ) );
				break;
			case 'prompt_reset':
				$v = PromptEngine::save_version( __( 'Gyári alapértelmezés visszaállítva', 'autogrowehome' ), DefaultModules::modules(), DefaultModules::views(), array(), true );
				self::redirect( $back, sprintf( /* translators: %d: version */ __( 'Gyári promptok visszaállítva (v%d).', 'autogrowehome' ), $v ) );
				break;
			case 'param_save':
				if ( ! Features::enabled( 'custom_params' ) ) {
					self::redirect( $back, __( 'A dinamikus paraméterszerkesztő ebben a csomagban nem érhető el.', 'autogrowehome' ), true );
				}
				$r = Registry::save_custom( (array) ( $p['param'] ?? array() ) );
				is_wp_error( $r ) ? self::redirect( $back, $r->get_error_message(), true ) : self::redirect( $back, __( 'Paraméter mentve.', 'autogrowehome' ) );
				break;
			case 'param_delete':
				Registry::delete_custom( sanitize_key( (string) ( $p['id'] ?? '' ) ) );
				self::redirect( $back, __( 'Paraméter törölve.', 'autogrowehome' ) );
				break;
			case 'param_overrides':
				$over = array();
				foreach ( (array) ( $p['ov'] ?? array() ) as $id => $o ) {
					$id = sanitize_key( $id );
					$row = array(
						'hidden'   => ! empty( $o['hidden'] ),
						'advanced' => ! empty( $o['advanced'] ),
						'label'    => sanitize_text_field( (string) ( $o['label'] ?? '' ) ),
						'help'     => sanitize_text_field( (string) ( $o['help'] ?? '' ) ),
						'sort'     => '' !== (string) ( $o['sort'] ?? '' ) ? (int) $o['sort'] : null,
					);
					if ( isset( $o['default'] ) && '' !== (string) $o['default'] ) {
						$def = Registry::get( $id );
						if ( $def ) {
							$raw = $o['default'];
							if ( 'multiselect' === $def['type'] ) {
								$raw = array_map( 'trim', explode( ',', (string) $raw ) );
							}
							$row['default'] = \AutoGroweHome\Params\Validator::sanitize_value( $def, $raw );
						}
					}
					$over[ $id ] = $row;
				}
				update_option( Registry::OVERRIDE_OPTION, $over, false );
				Registry::reset();
				self::redirect( $back, __( 'Paraméter-beállítások mentve.', 'autogrowehome' ) );
				break;
			case 'catalog_save':
				$type = sanitize_key( (string) ( $p['type'] ?? '' ) );
				$item = (array) ( $p['item'] ?? array() );
				$data = array();
				foreach ( (array) ( $item['data'] ?? array() ) as $k => $v ) {
					$k = sanitize_key( $k );
					if ( in_array( $k, array( 'defaults', 'values' ), true ) ) {
						$d          = json_decode( (string) $v, true );
						$data[ $k ] = is_array( $d ) ? $d : array();
					} elseif ( 'colors' === $k ) {
						$data[ $k ] = array_values( array_filter( array_map( static fn( $c ) => preg_match( '/^#[0-9a-fA-F]{6}$/', trim( $c ) ) ? strtoupper( trim( $c ) ) : '', explode( ',', (string) $v ) ) ) );
					} elseif ( 'verified' === $k ) {
						$data[ $k ] = ! empty( $v );
					} else {
						$data[ $k ] = (string) $v;
					}
				}
				$item['data'] = $data;
				$r            = Catalog::save( $type, $item );
				is_wp_error( $r ) ? self::redirect( $back, $r->get_error_message(), true, array( 'type' => $type ) ) : self::redirect( $back, __( 'Katalóguselem mentve.', 'autogrowehome' ), false, array( 'type' => $type ) );
				break;
			case 'catalog_delete':
				$type = sanitize_key( (string) ( $p['type'] ?? '' ) );
				if ( ! Catalog::delete( $type, sanitize_key( (string) ( $p['slug'] ?? '' ) ) ) ) {
					self::redirect( $back, __( 'Ez a katalóguselem nem törölhető: a specifikáció szerint kötelező tetőfedési márka.', 'autogrowehome' ), true, array( 'type' => $type ) );
				}
				self::redirect( $back, __( 'Katalóguselem törölve.', 'autogrowehome' ), false, array( 'type' => $type ) );
				break;
			case 'design_restore':
				$hist = (array) get_option( 'agh_design_history', array() );
				$i    = (int) ( $p['i'] ?? -1 );
				if ( isset( $hist[ $i ] ) ) {
					self::push_design_history();
					foreach ( array( 'branding', 'layout', 'general' ) as $g ) {
						Settings::update_group( $g, (array) $hist[ $i ][ $g ] );
					}
					self::redirect( $back, __( 'Korábbi designverzió visszaállítva.', 'autogrowehome' ) );
				}
				self::redirect( $back, __( 'Nincs ilyen verzió.', 'autogrowehome' ), true );
				break;
			case 'project_delete':
				$pr = Repository::project_by_uuid( (string) ( $p['project'] ?? '' ) );
				if ( ! $pr ) {
					self::redirect( 'agh-projects', __( 'A projekt nem található.', 'autogrowehome' ), true );
				}
				// Same rule as the visitor REST endpoint: a project with a quote request is refused (no orphaned quote, consent log or package).
				$res = Repository::delete_project_safe( (int) $pr['id'] );
				if ( is_wp_error( $res ) ) {
					$msg = 'agh_has_quote' === $res->get_error_code() ? __( 'A projekthez ajánlatkérés tartozik, ezért nem törölhető. A személyes adatokat az ajánlatkérés anonimizálásával vagy GDPR-adattörléssel távolíthatod el.', 'autogrowehome' ) : $res->get_error_message();
					self::redirect( 'agh-projects', $msg, true, array( 'project' => $pr['uuid'] ) );
				}
				Logger::info( 'admin', 'Project deleted', array( 'project' => $pr['uuid'], 'user' => get_current_user_id() ) );
				self::redirect( 'agh-projects', __( 'Projekt törölve.', 'autogrowehome' ) );
				break;
			case 'project_json':
				$pr = Repository::project_by_uuid( (string) ( $p['project'] ?? '' ) );
				if ( ! $pr ) {
					wp_die( 'Not found' );
				}
				$c = Repository::concepts( $pr['id'] );
				nocache_headers();
				header( 'Content-Type: application/json; charset=utf-8' );
				header( 'Content-Disposition: attachment; filename="agh-project-' . substr( $pr['uuid'], 0, 8 ) . '.json"' );
				echo wp_json_encode( array( 'project' => array_diff_key( $pr, array_flip( array( 'guest_key_hash', 'ip_hash' ) ) ), 'concepts' => $c ), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE ); // phpcs:ignore
				exit;
			case 'resend_quote':
				$q = QuoteService::get_by_uuid( (string) ( $p['quote'] ?? '' ) );
				if ( $q ) {
					JobQueue::push( '' !== $q['package_path'] ? 'notify' : 'package', (int) $q['project_id'], array( 'quote' => (int) $q['id'] ), 3, 0, 0, 3 );
					JobQueue::run( 15.0 );
				}
				self::redirect( 'agh-quotes', __( 'Értesítés újraküldése elindítva.', 'autogrowehome' ), false, array( 'quote' => (string) ( $p['quote'] ?? '' ) ) );
				break;
			case 'quote_revoke':
				$q = QuoteService::get_by_uuid( (string) ( $p['quote'] ?? '' ) );
				if ( ! $q ) {
					self::redirect( 'agh-quotes', __( 'Az ajánlatkérés nem található.', 'autogrowehome' ), true );
				}
				$n = self::revoke_quote_access( $q );
				Logger::info( 'admin', 'Contractor access revoked', array( 'quote' => $q['uuid'], 'rows' => $n, 'user' => get_current_user_id() ) );
				/* translators: %d: number of revoked links/sessions */
				self::redirect( 'agh-quotes', sprintf( __( 'Kivitelezői hozzáférés visszavonva (%d hivatkozás / munkamenet). Új link az „Értesítés újraküldése” gombbal küldhető.', 'autogrowehome' ), $n ), false, array( 'quote' => $q['uuid'] ) );
				break;
			case 'quote_anonymize':
				$q = QuoteService::get_by_uuid( (string) ( $p['quote'] ?? '' ) );
				if ( $q ) {
					QuoteService::anonymize( (int) $q['id'] );
					Logger::info( 'gdpr', 'Quote anonymized by admin', array( 'quote' => $q['uuid'], 'user' => get_current_user_id() ) );
				}
				self::redirect( 'agh-quotes', __( 'Ajánlatkérés anonimizálva.', 'autogrowehome' ) );
				break;
			case 'license_activate':
				$r = LicenseManager::activate( (string) ( $p['license_key'] ?? '' ) );
				self::redirect( $back, $r['message'], ! $r['ok'] );
				break;
			case 'license_deactivate':
				$r = LicenseManager::deactivate();
				self::redirect( $back, $r['message'] );
				break;
			case 'license_check':
				$r = LicenseManager::check();
				self::redirect( $back, $r['message'], ! $r['ok'] );
				break;
			case 'license_server':
				$url = esc_url_raw( (string) ( $p['server_url'] ?? '' ) );
				$pub = preg_replace( '/[^A-Za-z0-9+\/=]/', '', (string) ( $p['public_key'] ?? '' ) );
				update_option( 'agh_license_server', array( 'url' => $url, 'public_key' => $pub ), false );
				self::redirect( $back, __( 'Licencszerver-beállítások mentve.', 'autogrowehome' ) );
				break;
			case 'plans_save':
				if ( ! self::plans_editable() ) {
					self::redirect( $back, __( 'A csomagmátrix csak tulajdonosi módban (AGH_OWNER_MODE) szerkeszthető.', 'autogrowehome' ), true );
				}
				Features::save_plans( (array) ( $p['plans'] ?? array() ) );
				$urls = array();
				foreach ( (array) ( $p['checkout'] ?? array() ) as $plan => $periods ) {
					foreach ( (array) $periods as $period => $u ) {
						$u = esc_url_raw( (string) $u );
						$urls[ sanitize_key( $plan ) ][ 'year' === $period ? 'year' : 'month' ] = 0 === strpos( $u, 'https://' ) ? $u : '';
					}
				}
				update_option( 'agh_checkout_urls', $urls, false );
				self::redirect( $back, __( 'Csomagok mentve.', 'autogrowehome' ) );
				break;
			case 'help_save':
				$tour = array();
				foreach ( (array) ( $p['tour'] ?? array() ) as $row ) {
					$tour[] = (array) $row;
				}
				$faq = array();
				foreach ( (array) ( $p['faq'] ?? array() ) as $row ) {
					$faq[] = (array) $row;
				}
				Help::save( $tour, $faq );
				self::redirect( $back, __( 'Súgótartalom mentve.', 'autogrowehome' ) );
				break;
			case 'help_reset':
				delete_option( Help::OPTION );
				self::redirect( $back, __( 'Súgótartalom visszaállítva.', 'autogrowehome' ) );
				break;
			case 'stats_csv':
				if ( ! Features::enabled( 'export_advanced' ) ) {
					self::redirect( $back, __( 'A CSV-export a bővített exportálás funkcióval (Agency csomag) érhető el.', 'autogrowehome' ), true );
				}
				$from = preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) ( $p['from'] ?? '' ) ) ? $p['from'] : wp_date( 'Y-m-d', time() - 29 * DAY_IN_SECONDS );
				$to   = preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) ( $p['to'] ?? '' ) ) ? $p['to'] : wp_date( 'Y-m-d' );
				nocache_headers();
				header( 'Content-Type: text/csv; charset=utf-8' );
				header( 'Content-Disposition: attachment; filename="agh-stats-' . $from . '_' . $to . '.csv"' );
				echo Stats::csv( $from, $to ); // phpcs:ignore WordPress.Security.EscapeOutput
				exit;
			case 'test_email':
				$to = wp_get_current_user()->user_email;
				$ok = Mailer::send( $to, '[AutoGroweHome] ' . __( 'Teszt e-mail', 'autogrowehome' ), __( 'Ez egy teszt e-mail az AutoGroweHome pluginból. Ha megkaptad, a levélküldés működik.', 'autogrowehome' ) );
				self::redirect( $back, $ok ? sprintf( /* translators: %s: email */ __( 'Teszt e-mail elküldve: %s', 'autogrowehome' ), $to ) : __( 'A wp_mail() hibát jelzett. Ellenőrizd az SMTP beállításokat.', 'autogrowehome' ), ! $ok );
				break;
			case 'logs_clear':
				global $wpdb;
				$wpdb->query( 'DELETE FROM ' . Installer::table( 'logs' ) ); // phpcs:ignore
				self::redirect( $back, __( 'Naplók törölve.', 'autogrowehome' ) );
				break;
			case 'queue_run':
				$n = JobQueue::run( 20.0 );
				self::redirect( $back, sprintf( /* translators: %d: count */ __( '%d feladat feldolgozva.', 'autogrowehome' ), $n ) );
				break;
			case 'retention_run':
				\AutoGroweHome\Privacy\Privacy::retention();
				self::redirect( $back, __( 'Adatmegőrzési takarítás lefutott.', 'autogrowehome' ) );
				break;
		}
		self::redirect( $back, __( 'Ismeretlen művelet.', 'autogrowehome' ), true );
	}

	/**
	 * UUID of a quote attached to the project ('' when none).
	 */
	public static function project_quote_uuid( int $project_id ): string {
		global $wpdb;
		$t = Installer::table( 'quotes' );
		return (string) $wpdb->get_var( $wpdb->prepare( "SELECT uuid FROM {$t} WHERE project_id = %d ORDER BY id LIMIT 1", $project_id ) ); // phpcs:ignore
	}

	/**
	 * The plan matrix (features/limits) is editable only in owner mode – on
	 * customer sites the built-in plans apply (shared contract 4).
	 */
	public static function plans_editable(): bool {
		return Features::owner_mode();
	}

	/**
	 * Revoke every contractor link of a quote and the portal sessions opened from them.
	 *
	 * @return int Number of revoked access rows.
	 */
	public static function revoke_quote_access( array $quote ): int {
		return \AutoGroweHome\Quote\AccessTokens::revoke_quote( (int) $quote['id'], '', true );
	}

	public static function action_url( string $do, array $args = array(), string $back = '' ): string {
		$args = array_merge( array( 'action' => 'agh_action', 'do' => $do, 'back' => '' !== $back ? $back : self::current_page() ), $args );
		return wp_nonce_url( add_query_arg( $args, admin_url( 'admin-post.php' ) ), 'agh_action_' . $do );
	}

	/* ------------------------------------------------------------------ notices */

	public static function notices(): void {
		if ( ! current_user_can( 'agh_manage' ) ) {
			return;
		}
		$screen = get_current_screen();
		$on_agh = $screen && false !== strpos( (string) $screen->id, 'agh-' );
		foreach ( self::warnings() as $w ) {
			if ( $on_agh || 'error' === $w[0] ) {
				echo '<div class="notice notice-' . esc_attr( 'error' === $w[0] ? 'error' : 'warning' ) . '"><p><strong>AutoGroweHome:</strong> ' . wp_kses_post( $w[1] ) . '</p></div>';
			}
		}
		$exp = LicenseManager::expiry_notice();
		if ( '' !== $exp ) {
			echo '<div class="notice notice-warning"><p>' . esc_html( $exp ) . '</p></div>';
		}
	}

	/**
	 * Configuration warnings shown in admin.
	 *
	 * @return array<int,array{0:string,1:string}>
	 */
	public static function warnings(): array {
		$w = array();
		$st = Providers::status();
		if ( ! Secrets::has( 'magnific_api_key' ) ) {
			$w[] = array( 'warning', __( 'Nincs Magnific API-kulcs beállítva – éles képgenerálás nem lehetséges.', 'autogrowehome' ) . ' <a href="' . esc_url( admin_url( 'admin.php?page=agh-providers' ) ) . '">' . esc_html__( 'Beállítás', 'autogrowehome' ) . '</a>' );
		}
		if ( ! Secrets::has( 'anthropic_api_key' ) ) {
			$w[] = array( 'warning', __( 'Nincs Anthropic API-kulcs – a koncepciókat a beállított szabályalapú tervező készíti, az „AI értelmezés” nem érhető el.', 'autogrowehome' ) );
		}
		if ( ! Features::enabled( 'full_params' ) ) {
			$locked = count( array_filter( Registry::fields(), function ( $d ) { return ! empty( $d['locked'] ); } ) );
			/* translators: 1: number of hidden settings, 2: number of all settings. */
			$w[] = array( 'error', sprintf( __( 'A tervező alapcsomag (Starter) módban fut: a %2$d beállításból %1$d rejtve van a látogatók elől, mert nincs aktív Professional licenc (vagy lejárt a türelmi idő). Saját oldalon a wp-config.php-ba írd be: define( \'AGH_OWNER_MODE\', true ); – ügyféloldalon aktiváld a licencet.', 'autogrowehome' ), $locked, count( Registry::fields() ) ) . ' <a href="' . esc_url( admin_url( 'admin.php?page=agh-license' ) ) . '">' . esc_html__( 'Licenc', 'autogrowehome' ) . '</a>' );
		}
		if ( $st['image_is_test'] ) {
			$w[] = array( 'warning', __( 'A képgenerálás TESZT módban fut: a látogatók helyi vázlatképeket kapnak (egyértelműen jelölve).', 'autogrowehome' ) );
		}
		if ( ! $st['image_ready'] ) {
			$w[] = array( 'error', __( 'Nincs működő képszolgáltató, ezért a generálás le van tiltva: a látogatók a tervezőben azt látják, hogy a képgenerálás jelenleg nem érhető el. Add meg a Magnific API-kulcsot, vagy próbához kapcsold be a „Teszt mód engedélyezése” beállítást (és válaszd aktív szolgáltatónak).', 'autogrowehome' ) . ' <a href="' . esc_url( admin_url( 'admin.php?page=agh-providers' ) ) . '">' . esc_html__( 'AI-szolgáltatók', 'autogrowehome' ) . '</a>' );
		}
		if ( ! is_email( (string) Settings::get( 'contractor.email', '' ) ) ) {
			$w[] = array( 'warning', __( 'Nincs érvényes kivitelezői e-mail-cím.', 'autogrowehome' ) );
		}
		if ( '' === (string) Settings::get( 'legal.privacy_url', '' ) ) {
			$w[] = array( 'warning', __( 'Nincs megadva adatkezelési tájékoztató URL – az ajánlatkérő űrlap hivatkozás nélkül jelenik meg.', 'autogrowehome' ) );
		}
		$health = get_transient( 'agh_storage_health' );
		if ( false === $health ) {
			$health = Storage::health();
			set_transient( 'agh_storage_health', $health, HOUR_IN_SECONDS );
		}
		if ( ! $health['writable'] ) {
			$w[] = array( 'error', __( 'A védett tárhely könyvtár nem írható.', 'autogrowehome' ) );
		}
		if ( true === $health['public'] ) {
			$dir = untrailingslashit( Storage::base_dir() );
			// the real URL path of the directory (a custom uploads folder or a subdirectory install too)
			$loc = (string) ( wp_parse_url( Storage::base_url(), PHP_URL_PATH ) ?: '/wp-content/uploads/' . basename( $dir ) . '/' );
			$txt  = __( 'A védett tárhely könyvtár HTTP-n keresztül elérhető! A szerver nem veszi figyelembe a .htaccess tiltást (pl. Nginx). Itt vannak a koncepciókép-fájlok és a kivitelezői ZIP az ügyfél adataival, ezért ezt ki kell javítani.', 'autogrowehome' );
			$txt .= '<br><strong>' . esc_html__( 'Az érintett könyvtár:', 'autogrowehome' ) . '</strong> <code>' . esc_html( $dir ) . '</code>';
			$txt .= '<br><strong>' . esc_html__( '1. megoldás (bármilyen szerveren jó): tedd a webgyökéren kívülre.', 'autogrowehome' ) . '</strong> ' . esc_html__( 'A wp-config.php-ba, a „That’s all, stop editing” sor fölé:', 'autogrowehome' );
			$txt .= '<br><code>define( \'AGH_PRIVATE_DIR\', \'/home/FELHASZNALO/agh-private/\' );</code> ';
			$txt .= esc_html__( 'A könyvtárnak léteznie kell, a webszerver felhasználójának írnia kell tudnia bele, és nem lehet a public_html alatt. Utána ezen a lapon egy gombbal áthozhatod a meglévő fájlokat.', 'autogrowehome' );
			$txt .= '<br><strong>' . esc_html__( '2. megoldás (Nginx): tiltás a szerver beállításában.', 'autogrowehome' ) . '</strong> ' . esc_html__( 'A site szerverblokkjába, majd nginx újratöltés:', 'autogrowehome' );
			// "^~" beats every regex location, so an image rule cannot match the directory first
			$txt .= '<br><code>location ^~ ' . esc_html( $loc ) . ' { deny all; return 403; }</code>';
			$txt .= '<br><em>' . esc_html__( 'Apache esetén az AllowOverride All hiányzik: a .htaccess-t a vhost nem engedi érvényesülni.', 'autogrowehome' ) . '</em> ';
			$txt .= self::action_link( 'storage_recheck', __( 'Ellenőrzés újra', 'autogrowehome' ) );
			$w[] = array( 'error', $txt );
		}
		$stray = Storage::stray_projects();
		if ( $stray > 0 ) {
			/* translators: %d: number of project folders */
			$w[] = array( 'error', sprintf( __( 'Az AGH_PRIVATE_DIR be van állítva, de a régi helyen (uploads) még %d projekt fájljai vannak, ezekre a tervek hivatkoznak. Hozd át őket az új helyre.', 'autogrowehome' ), $stray ) . ' ' . self::action_link( 'storage_move', __( 'Fájlok áthozása', 'autogrowehome' ) ) );
		}
		if ( ! extension_loaded( 'zip' ) ) {
			$w[] = array( 'error', __( 'A PHP zip kiterjesztés hiányzik – a kivitelezői ZIP csomag nem készíthető.', 'autogrowehome' ) );
		}
		if ( ! function_exists( 'imagecreatetruecolor' ) ) {
			$w[] = array( 'warning', __( 'A PHP GD kiterjesztés hiányzik – a teszt mód és a geometriai vezetés nem érhető el.', 'autogrowehome' ) );
		}
		if ( Settings::get( 'magnific.use_webhook' ) && ! is_ssl() ) {
			$w[] = array( 'warning', __( 'A webhook HTTPS nélkül nem ajánlott.', 'autogrowehome' ) );
		}
		$unverified = 0;
		foreach ( Catalog::all( 'roof_product', false ) as $r ) {
			if ( empty( $r['data']['verified'] ) && 'published' === $r['status'] ) {
				$unverified++;
			}
		}
		if ( $unverified > 0 ) {
			$w[] = array( 'warning', sprintf( /* translators: %d: count */ __( '%d tetőfedési termék nincs ellenőrzöttként jelölve. Az előre feltöltött BRAMAC-lista viszonteladói forrásból származik – vesd össze a hivatalos bramac.hu katalógussal.', 'autogrowehome' ), $unverified ) . ' <a href="' . esc_url( admin_url( 'admin.php?page=agh-catalog&type=roof_product' ) ) . '">' . esc_html__( 'Katalógus', 'autogrowehome' ) . '</a>' );
		}
		return $w;
	}
}
