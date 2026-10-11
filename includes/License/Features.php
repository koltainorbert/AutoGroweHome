<?php
/**
 * Data-driven feature gating: one plan matrix (features + limits per plan)
 * instead of scattered hard-coded checks.
 *
 * Shared contract 4: the matrix stored in the "agh_plans" option is editable
 * and effective only in owner mode (AGH_OWNER_MODE – the vendor's own site,
 * whose pricing page shows it). On customer sites the matrix is entirely
 * read-only: the built-in default_plans() always apply (features, limits,
 * labels and prices alike) and nothing is stored.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\License;

defined( 'ABSPATH' ) || exit;

final class Features {

	public const PLANS_OPTION = 'agh_plans';

	/**
	 * Feature catalogue. Each entry is checked with Features::enabled() in the
	 * code – except "basic_params" and "basic_gallery": these are descriptive
	 * entries for the plan comparison, always available in every plan, with
	 * no separate gate. Only features that exist may be listed here.
	 */
	public static function catalog(): array {
		return array(
			'designer'           => __( 'Háztervező popup', 'autogrowehome' ),
			'basic_params'       => __( 'Alapvető házparaméterek', 'autogrowehome' ), // Descriptive: always available, no gate.
			'three_concepts'     => __( 'Három házkoncepció generálása', 'autogrowehome' ),
			'basic_gallery'      => __( 'Alapvető képgaléria', 'autogrowehome' ), // Descriptive: always available, no gate.
			'hero_download'      => __( 'Kiemelt látványkép letöltése', 'autogrowehome' ),
			'project_save'       => __( 'Projektmentés', 'autogrowehome' ),
			'contractor_email'   => __( 'Kivitelezői e-mail-értesítés', 'autogrowehome' ),
			'full_params'        => __( 'Teljes paraméterezési rendszer (tető, homlokzat, belső)', 'autogrowehome' ),
			'prompt_editor'      => __( 'Szerkeszthető promptmotor', 'autogrowehome' ),
			'detailed_gallery'   => __( 'Részletes galéria (minden nézet)', 'autogrowehome' ),
			'floorplans'         => __( 'Tervvázlat-generáló modul', 'autogrowehome' ),
			'stats_advanced'     => __( 'Részletes statisztikák', 'autogrowehome' ),
			'branding_advanced'  => __( 'Haladó arculati beállítások', 'autogrowehome' ),
			'multilang'          => __( 'Többnyelvű működés', 'autogrowehome' ),
			'package_full'       => __( 'Részletes kivitelezői csomag (ZIP)', 'autogrowehome' ),
			'custom_params'      => __( 'Dinamikus paraméterszerkesztő', 'autogrowehome' ),
			'white_label'        => __( 'White-label (saját márka, készítő elrejtése)', 'autogrowehome' ),
			'multi_contractor'   => __( 'Több kivitelező kezelése', 'autogrowehome' ),
			'export_advanced'    => __( 'Bővített exportálás (CSV, CAD-JSON, DXF)', 'autogrowehome' ),
		);
	}

	public static function default_plans(): array {
		$starter = array( 'designer', 'basic_params', 'three_concepts', 'basic_gallery', 'hero_download', 'project_save', 'contractor_email' );
		$pro     = array_merge( $starter, array( 'full_params', 'prompt_editor', 'detailed_gallery', 'floorplans', 'stats_advanced', 'branding_advanced', 'multilang', 'package_full', 'custom_params' ) );
		$agency  = array_merge( $pro, array( 'white_label', 'multi_contractor', 'export_advanced' ) );
		return array(
			'starter'      => array(
				'label'    => 'Starter',
				'audience' => __( 'Kisebb vállalkozások és egyéni weboldal-tulajdonosok', 'autogrowehome' ),
				'features' => $starter,
				'limits'   => array( 'sites' => 1, 'max_ip_daily' => 3, 'max_exterior_views' => 4, 'max_interiors' => 2, 'max_resolution' => '2k' ),
				'price_month' => '',
				'price_year'  => '',
			),
			'professional' => array(
				'label'    => 'Professional',
				'audience' => __( 'Építőipari cégek, kivitelezők, üzleti weboldalak', 'autogrowehome' ),
				'features' => $pro,
				'limits'   => array( 'sites' => 1, 'max_ip_daily' => 10, 'max_exterior_views' => 8, 'max_interiors' => 6, 'max_resolution' => '4k' ),
				'price_month' => '',
				'price_year'  => '',
			),
			'agency'       => array(
				'label'    => 'Agency',
				'audience' => __( 'Ügynökségek, fejlesztők, több ügyfelet kiszolgáló vállalkozások', 'autogrowehome' ),
				'features' => $agency,
				'limits'   => array( 'sites' => 25, 'max_ip_daily' => 50, 'max_exterior_views' => 8, 'max_interiors' => 10, 'max_resolution' => '4k' ),
				'price_month' => '',
				'price_year'  => '',
			),
		);
	}

	public static function plans(): array {
		if ( ! self::owner_mode() ) {
			// Customer site: the built-in matrix, read-only (stored data ignored).
			return self::default_plans();
		}
		$stored = get_option( self::PLANS_OPTION );
		if ( ! is_array( $stored ) || empty( $stored ) ) {
			return self::default_plans();
		}
		// Owner mode: the stored matrix, with missing keys filled from the
		// defaults and features limited to the catalogue.
		$defaults = self::default_plans();
		$known    = array_keys( self::catalog() );
		$out      = array();
		foreach ( $stored as $slug => $plan ) {
			$base         = $defaults[ $slug ] ?? array( 'label' => (string) $slug, 'audience' => '', 'features' => array(), 'limits' => array(), 'price_month' => '', 'price_year' => '' );
			$out[ $slug ] = array_merge( $base, is_array( $plan ) ? $plan : array() );
			// Drop features not in the catalogue (e.g. removed ones in old data).
			$out[ $slug ]['features'] = array_values( array_intersect( (array) $out[ $slug ]['features'], $known ) );
		}
		return $out;
	}

	/**
	 * Owner mode = the AGH_OWNER_MODE constant. The "agh_owner_mode" filter can
	 * only switch it off (e.g. to test customer-site behaviour), never on.
	 */
	public static function owner_mode(): bool {
		return defined( 'AGH_OWNER_MODE' ) && AGH_OWNER_MODE && (bool) apply_filters( 'agh_owner_mode', true );
	}

	/**
	 * Effective plan slug (owner mode = "agency" equivalent with all features).
	 */
	public static function plan(): string {
		if ( self::owner_mode() ) {
			return 'owner';
		}
		$p = LicenseManager::effective_plan();
		return isset( self::plans()[ $p ] ) ? $p : 'starter';
	}

	public static function enabled( string $feature ): bool {
		if ( self::owner_mode() ) {
			return true;
		}
		$plans = self::plans();
		$plan  = $plans[ self::plan() ] ?? $plans['starter'] ?? array( 'features' => array() );
		return in_array( $feature, (array) $plan['features'], true );
	}

	/**
	 * @return mixed
	 */
	public static function limit( string $key, $default = null ) {
		if ( self::owner_mode() ) {
			return $default;
		}
		$plans = self::plans();
		$plan  = $plans[ self::plan() ] ?? array();
		return $plan['limits'][ $key ] ?? $default;
	}

	/**
	 * Store the plan matrix – owner mode only. On customer sites the matrix is
	 * read-only and nothing is written (the admin form is not offered there).
	 */
	public static function save_plans( array $plans ): void {
		if ( ! self::owner_mode() ) {
			return;
		}
		$clean = array();
		$known = array_keys( self::catalog() );
		foreach ( $plans as $slug => $p ) {
			$slug = sanitize_key( $slug );
			if ( '' === $slug || 'owner' === $slug ) {
				continue;
			}
			$clean[ $slug ] = array(
				'label'       => sanitize_text_field( $p['label'] ?? $slug ),
				'audience'    => sanitize_text_field( $p['audience'] ?? '' ),
				'features'    => array_values( array_intersect( (array) ( $p['features'] ?? array() ), $known ) ),
				'limits'      => array(
					'sites'              => max( 1, (int) ( $p['limits']['sites'] ?? 1 ) ),
					'max_ip_daily'       => max( 0, (int) ( $p['limits']['max_ip_daily'] ?? 3 ) ),
					'max_exterior_views' => max( 1, min( 8, (int) ( $p['limits']['max_exterior_views'] ?? 4 ) ) ),
					'max_interiors'      => max( 0, min( 20, (int) ( $p['limits']['max_interiors'] ?? 2 ) ) ),
					'max_resolution'     => in_array( $p['limits']['max_resolution'] ?? '2k', array( '1k', '2k', '4k' ), true ) ? $p['limits']['max_resolution'] : '2k',
				),
				'price_month' => sanitize_text_field( $p['price_month'] ?? '' ),
				'price_year'  => sanitize_text_field( $p['price_year'] ?? '' ),
			);
		}
		if ( ! isset( $clean['starter'] ) ) {
			$clean = array( 'starter' => self::default_plans()['starter'] ) + $clean;
		}
		update_option( self::PLANS_OPTION, $clean, false );
	}
}
