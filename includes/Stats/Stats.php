<?php
/**
 * Aggregated, non-personal analytics (daily counters) and the cost ledger.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Stats;

use AutoGroweHome\Installer;
use AutoGroweHome\License\Features;
use AutoGroweHome\Support\Settings;
use AutoGroweHome\Support\Util;

defined( 'ABSPATH' ) || exit;

final class Stats {

	public const METRICS = array(
		'popup_open'          => 'Popupmegnyitások',
		'design_start'        => 'Tervezések elindítása',
		'design_complete'     => 'Tervezések befejezése (koncepció kiválasztva)',
		'generate_request'    => 'Generálási kérések',
		'concepts_ready'      => 'Elkészült házkoncepciók',
		'image_ok'            => 'Sikeres képgenerálások',
		'image_fail'          => 'Sikertelen képgenerálások',
		'gen_ms'              => 'Generálási idő összesen (ms)',
		'gen_count'           => 'Mért generálások száma',
		'cost'                => 'Költség (becsült)',
		'style'               => 'Kiválasztott házstílusok',
		'roof'                => 'Tetőtípusok',
		'area_bucket'         => 'Alapterület-sávok',
		'param'               => 'Paraméter-használat',
		'project_saved'       => 'Mentett projektek',
		'quote_submitted'     => 'Továbbított ajánlatkérések',
		'package_download'    => 'Kivitelezői csomag letöltések',
		'error'               => 'Hibaokok',
		'provider_ok'         => 'Szolgáltatói hívás sikeres',
		'provider_fail'       => 'Szolgáltatói hívás sikertelen',
		'limit_hit'           => 'Limit miatt elutasított kérések',
	);

	public static function inc( string $metric, string $dim = '', float $value = 1.0, ?string $day = null ): void {
		global $wpdb;
		$t   = Installer::table( 'stats' );
		$day = $day ?? wp_date( 'Y-m-d' );
		$dim = substr( sanitize_text_field( $dim ), 0, 100 );
		$wpdb->query( $wpdb->prepare( "INSERT INTO {$t} (day, metric, dim, value) VALUES (%s, %s, %s, %f) ON DUPLICATE KEY UPDATE value = value + %f", $day, $metric, $dim, $value, $value ) ); // phpcs:ignore
	}

	/**
	 * Totals per metric (dim='') between two dates.
	 */
	public static function totals( string $from, string $to ): array {
		global $wpdb;
		$t    = Installer::table( 'stats' );
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT metric, SUM(value) AS v FROM {$t} WHERE day BETWEEN %s AND %s AND dim = '' GROUP BY metric", $from, $to ), ARRAY_A ) ?: array(); // phpcs:ignore
		$out  = array();
		foreach ( $rows as $r ) {
			$out[ $r['metric'] ] = (float) $r['v'];
		}
		return $out;
	}

	public static function series( string $metric, string $from, string $to ): array {
		global $wpdb;
		$t    = Installer::table( 'stats' );
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT day, SUM(value) AS v FROM {$t} WHERE metric = %s AND dim = '' AND day BETWEEN %s AND %s GROUP BY day ORDER BY day", $metric, $from, $to ), ARRAY_A ) ?: array(); // phpcs:ignore
		$map  = array();
		foreach ( $rows as $r ) {
			$map[ $r['day'] ] = (float) $r['v'];
		}
		$out = array();
		$d   = strtotime( $from );
		$end = strtotime( $to );
		while ( $d <= $end ) {
			$k     = gmdate( 'Y-m-d', $d );
			$out[] = array( 'day' => $k, 'value' => $map[ $k ] ?? 0 );
			$d    += DAY_IN_SECONDS;
		}
		return $out;
	}

	public static function breakdown( string $metric, string $from, string $to, int $limit = 12 ): array {
		global $wpdb;
		$t = Installer::table( 'stats' );
		return $wpdb->get_results( $wpdb->prepare( "SELECT dim, SUM(value) AS value FROM {$t} WHERE metric = %s AND dim <> '' AND day BETWEEN %s AND %s GROUP BY dim ORDER BY value DESC LIMIT %d", $metric, $from, $to, $limit ), ARRAY_A ) ?: array(); // phpcs:ignore
	}

	/**
	 * Statistics CSV export – the "export_advanced" feature (Agency). Returns
	 * '' when the feature is not available, so callers must check
	 * Features::enabled( 'export_advanced' ) before offering the download.
	 * Breakdown rows (dimension ≠ '') are included only with "stats_advanced".
	 */
	public static function csv( string $from, string $to ): string {
		if ( ! Features::enabled( 'export_advanced' ) ) {
			return '';
		}
		global $wpdb;
		$t    = Installer::table( 'stats' );
		$dims = Features::enabled( 'stats_advanced' ) ? '' : " AND dim = ''";
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT day, metric, dim, value FROM {$t} WHERE day BETWEEN %s AND %s{$dims} ORDER BY day, metric, dim", $from, $to ), ARRAY_A ) ?: array(); // phpcs:ignore
		$fh   = fopen( 'php://temp', 'w+' ); // phpcs:ignore
		fwrite( $fh, "\xEF\xBB\xBF" ); // phpcs:ignore
		fputcsv( $fh, array( 'day', 'metric', 'dimension', 'value' ), ';' );
		foreach ( $rows as $r ) {
			fputcsv( $fh, array_map( array( \AutoGroweHome\Generation\FloorPlanSvg::class, 'csv_safe' ), $r ), ';' );
		}
		rewind( $fh );
		$csv = (string) stream_get_contents( $fh );
		fclose( $fh ); // phpcs:ignore
		return $csv;
	}

	/* ---------------------------------------------------------------- cost ledger */

	public static function cost_of( string $key ): float {
		return '' === $key ? 0.0 : (float) Settings::get( 'costs.' . $key, 0 );
	}

	public static function ledger( string $provider, string $operation, float $cost, int $project_id = 0, int $asset_id = 0, float $units = 1 ): void {
		global $wpdb;
		$wpdb->insert(
			Installer::table( 'ledger' ),
			array(
				'day'        => wp_date( 'Y-m-d' ),
				'provider'   => substr( $provider, 0, 40 ),
				'operation'  => substr( $operation, 0, 40 ),
				'units'      => $units,
				'cost'       => $cost,
				'project_id' => $project_id,
				'asset_id'   => $asset_id,
				'created_at' => Util::now(),
			)
		);
		if ( $cost > 0 ) {
			self::inc( 'cost', '', $cost );
			self::inc( 'cost', $provider, $cost );
		}
	}

	public static function spent( string $from, string $to ): float {
		global $wpdb;
		$t = Installer::table( 'ledger' );
		return (float) $wpdb->get_var( $wpdb->prepare( "SELECT COALESCE(SUM(cost),0) FROM {$t} WHERE day BETWEEN %s AND %s", $from, $to ) ); // phpcs:ignore
	}

	public static function spent_by_project( int $project_id ): float {
		global $wpdb;
		$t = Installer::table( 'ledger' );
		return (float) $wpdb->get_var( $wpdb->prepare( "SELECT COALESCE(SUM(cost),0) FROM {$t} WHERE project_id = %d", $project_id ) ); // phpcs:ignore
	}

	/**
	 * Budget check before a new request (estimate in admin currency).
	 */
	public static function budget_allows( float $estimate ): bool {
		$daily   = (float) Settings::get( 'costs.daily_budget', 0 );
		$monthly = (float) Settings::get( 'costs.monthly_budget', 0 );
		$today   = wp_date( 'Y-m-d' );
		if ( $daily > 0 && self::spent( $today, $today ) + $estimate > $daily ) {
			return false;
		}
		if ( $monthly > 0 && self::spent( wp_date( 'Y-m-01' ), $today ) + $estimate > $monthly ) {
			return false;
		}
		return true;
	}

	public static function area_bucket( float $area ): string {
		$b = array( 60, 90, 120, 150, 200, 300 );
		foreach ( $b as $limit ) {
			if ( $area <= $limit ) {
				return '≤' . $limit . ' m²';
			}
		}
		return '>300 m²';
	}
}
