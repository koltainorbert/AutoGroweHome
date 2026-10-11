<?php
/**
 * GDPR: WordPress personal-data exporter/eraser, privacy policy text and
 * scheduled retention clean-up.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Privacy;

use AutoGroweHome\Generation\JobQueue;
use AutoGroweHome\Installer;
use AutoGroweHome\Projects\Repository;
use AutoGroweHome\Quote\AccessTokens;
use AutoGroweHome\Quote\QuoteService;
use AutoGroweHome\RateLimit\RateLimiter;
use AutoGroweHome\Support\Logger;
use AutoGroweHome\Support\Settings;

defined( 'ABSPATH' ) || exit;

final class Privacy {

	public static function init(): void {
		add_filter( 'wp_privacy_personal_data_exporters', array( __CLASS__, 'register_exporter' ) );
		add_filter( 'wp_privacy_personal_data_erasers', array( __CLASS__, 'register_eraser' ) );
		add_action( 'admin_init', array( __CLASS__, 'policy_text' ) );
		add_action( 'agh_cron_daily', array( __CLASS__, 'retention' ) );
	}

	public static function register_exporter( array $e ): array {
		$e['autogrowehome'] = array( 'exporter_friendly_name' => 'AutoGroweHome', 'callback' => array( __CLASS__, 'export' ) );
		return $e;
	}

	public static function register_eraser( array $e ): array {
		$e['autogrowehome'] = array( 'eraser_friendly_name' => 'AutoGroweHome', 'callback' => array( __CLASS__, 'erase' ) );
		return $e;
	}

	/** Items per exporter/eraser page (WordPress calls again until 'done'). */
	public const PAGE_SIZE = 20;

	private static function quotes_by_email( string $email, int $limit, int $offset = 0, bool $active_only = false ): array {
		global $wpdb;
		$t     = Installer::table( 'quotes' );
		$extra = $active_only ? ' AND anonymized = 0' : '';
		return $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$t} WHERE email = %s{$extra} ORDER BY id ASC LIMIT %d OFFSET %d", $email, $limit, $offset ), ARRAY_A ) ?: array(); // phpcs:ignore
	}

	private static function count_quotes_by_email( string $email ): int {
		global $wpdb;
		$t = Installer::table( 'quotes' );
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$t} WHERE email = %s", $email ) ); // phpcs:ignore
	}

	/**
	 * Projects of a WordPress user (not yet deleted), oldest first.
	 */
	private static function user_projects( int $user_id, int $limit, int $offset = 0 ): array {
		global $wpdb;
		$t = Installer::table( 'projects' );
		return $wpdb->get_results( $wpdb->prepare( "SELECT id, uuid, name, status, created_at FROM {$t} WHERE owner_user_id = %d AND status <> 'deleted' ORDER BY id ASC LIMIT %d OFFSET %d", $user_id, $limit, $offset ), ARRAY_A ) ?: array(); // phpcs:ignore
	}

	/**
	 * Personal data exporter (paged): pages 1..N cover the quotes of the
	 * address, the following pages the projects of the matching WP user.
	 */
	public static function export( string $email, int $page = 1 ): array {
		$page   = max( 1, $page );
		$size   = self::PAGE_SIZE;
		$items  = array();
		$qpages = (int) ceil( self::count_quotes_by_email( $email ) / $size );
		if ( $page <= $qpages ) {
			foreach ( self::quotes_by_email( $email, $size, ( $page - 1 ) * $size ) as $q ) {
				$data = array();
				foreach ( array( 'full_name' => 'Név', 'email' => 'E-mail', 'phone' => 'Telefon', 'city' => 'Település', 'site_location' => 'Építési helyszín', 'start_period' => 'Tervezett kezdés', 'budget' => 'Költségkeret', 'note' => 'Megjegyzés', 'created_at' => 'Időpont' ) as $k => $l ) {
					$data[] = array( 'name' => $l, 'value' => (string) $q[ $k ] );
				}
				foreach ( QuoteService::consent_log( (int) $q['id'], true ) as $c ) {
					$data[] = array( 'name' => 'Hozzájárulás: ' . $c['consent_type'], 'value' => ( $c['granted'] ? 'megadva' : 'nem' ) . ' · ' . $c['created_at'] . ' · v' . $c['doc_version'] . ( '' !== (string) ( $c['user_agent'] ?? '' ) ? ' · ' . $c['user_agent'] : '' ) );
				}
				$p = Repository::project_by_id( (int) $q['project_id'] );
				if ( $p ) {
					$data[] = array( 'name' => 'Projekt', 'value' => $p['uuid'] );
					$data[] = array( 'name' => 'Ház paraméterei', 'value' => (string) wp_json_encode( $p['config'], JSON_UNESCAPED_UNICODE ) );
				}
				$items[] = array( 'group_id' => 'autogrowehome', 'group_label' => 'AutoGroweHome ajánlatkérések', 'item_id' => 'agh-quote-' . $q['uuid'], 'data' => $data );
			}
			return array( 'data' => $items, 'done' => false );
		}
		$user = get_user_by( 'email', $email );
		if ( ! $user ) {
			return array( 'data' => array(), 'done' => true );
		}
		$rows = self::user_projects( (int) $user->ID, $size, ( $page - $qpages - 1 ) * $size );
		foreach ( $rows as $p ) {
			$items[] = array( 'group_id' => 'autogrowehome_projects', 'group_label' => 'AutoGroweHome projektek', 'item_id' => 'agh-project-' . $p['uuid'], 'data' => array( array( 'name' => 'Projekt', 'value' => $p['uuid'] . ' · ' . $p['name'] . ' · ' . $p['created_at'] ) ) );
		}
		return array( 'data' => $items, 'done' => count( $rows ) < $size );
	}

	/**
	 * Personal data eraser (paged). Every call handles one batch: quotes of
	 * the address are anonymised (including the linked project's free text and
	 * files, see QuoteService::anonymize()), then the WP user's projects are
	 * removed – deleted, or anonymised when a quote still references them.
	 * Handled rows drop out of the queries, so each page starts at offset 0.
	 */
	public static function erase( string $email, int $page = 1 ): array {
		$removed = 0;
		$size    = self::PAGE_SIZE;
		$quotes  = self::quotes_by_email( $email, $size, 0, true );
		foreach ( $quotes as $q ) {
			QuoteService::anonymize( (int) $q['id'] );
			$removed++;
		}
		if ( count( $quotes ) >= $size ) {
			return array( 'items_removed' => true, 'items_retained' => false, 'messages' => array(), 'done' => false );
		}
		$user     = get_user_by( 'email', $email );
		$projects = $user ? self::user_projects( (int) $user->ID, $size ) : array();
		foreach ( $projects as $p ) {
			if ( Repository::has_quote( (int) $p['id'] ) ) {
				Repository::anonymize_project( (int) $p['id'] );
			} else {
				JobQueue::cancel_project( (int) $p['id'] );
				Repository::delete_project( (int) $p['id'] );
			}
			$removed++;
		}
		$done = count( $projects ) < $size;
		if ( $done && $user ) {
			delete_user_meta( (int) $user->ID, 'agh_presets' );
		}
		Logger::info( 'gdpr', 'Personal data erased via WP eraser', array( 'items' => $removed, 'page' => $page ) );
		return array( 'items_removed' => $removed > 0, 'items_retained' => false, 'messages' => array(), 'done' => $done );
	}

	public static function policy_text(): void {
		if ( ! function_exists( 'wp_add_privacy_policy_content' ) ) {
			return;
		}
		$text = '<p>' . esc_html__( 'Sablon – szakértői ellenőrzés szükséges.', 'autogrowehome' ) . '</p>'
			. '<p>' . esc_html__( 'A háztervező használatakor a megadott házparamétereket, szabad szöveges leírást és a generált képeket tároljuk. Az IP-címet kizárólag kulcsolt kivonat (hash) formájában, a napi generálási keret és a visszaélések elleni védelem céljából kezeljük. A tervek elkészítéséhez a paramétereket és a leírást AI-szolgáltatók (Magnific – képgenerálás, Anthropic – szövegértelmezés) dolgozzák fel; személyes elérhetőségek nem kerülnek továbbításra hozzájuk.', 'autogrowehome' ) . '</p>'
			. '<p>' . esc_html__( 'Ajánlatkérés esetén a megadott nevet, e-mail-címet, telefonszámot, települést és megjegyzést a kifejezett hozzájárulásod alapján továbbítjuk a kivitelezőnek. A hozzájárulásokat a dokumentum verziójával és időpontjával naplózzuk. A marketingcélú hozzájárulás opcionális.', 'autogrowehome' ) . '</p>'
			. '<p>' . esc_html__( 'Megőrzési idők: a nem mentett projektek és a mentett projektek a beállított idő után automatikusan törlődnek; az ajánlatkérések a megőrzési idő végén anonimizálásra kerülnek.', 'autogrowehome' ) . '</p>';
		wp_add_privacy_policy_content( 'AutoGroweHome', wp_kses_post( $text ) );
	}

	/**
	 * Daily retention clean-up.
	 */
	public static function retention(): void {
		global $wpdb;
		$pt    = Installer::table( 'projects' );
		$qt    = Installer::table( 'quotes' );
		$draft = gmdate( 'Y-m-d H:i:s', time() - max( 1, (int) Settings::get( 'legal.retention_drafts_days', 30 ) ) * DAY_IN_SECONDS );
		$saved = gmdate( 'Y-m-d H:i:s', time() - max( 1, (int) Settings::get( 'legal.retention_projects_days', 180 ) ) * DAY_IN_SECONDS );
		$ids   = $wpdb->get_col( $wpdb->prepare( "SELECT p.id FROM {$pt} p LEFT JOIN {$qt} q ON q.project_id = p.id WHERE q.id IS NULL AND ( (p.saved = 0 AND p.updated_at < %s) OR (p.saved = 1 AND p.updated_at < %s) ) LIMIT 200", $draft, $saved ) ); // phpcs:ignore
		foreach ( (array) $ids as $id ) {
			JobQueue::cancel_project( (int) $id );
			Repository::delete_project( (int) $id );
		}
		// Quotes past retention: anonymised together with the linked project's
		// personal free text and files (QuoteService::anonymize()); projects with
		// a quote are never deleted above, only scrubbed here.
		$qlimit = gmdate( 'Y-m-d H:i:s', time() - max( 30, (int) Settings::get( 'legal.retention_quotes_days', 730 ) ) * DAY_IN_SECONDS );
		foreach ( (array) $wpdb->get_col( $wpdb->prepare( "SELECT id FROM {$qt} WHERE anonymized = 0 AND created_at < %s LIMIT 200", $qlimit ) ) as $qid ) { // phpcs:ignore
			QuoteService::anonymize( (int) $qid );
		}
		// Contractor packages older than their retention: delete the ZIP, keep the record.
		$plimit = gmdate( 'Y-m-d H:i:s', time() - max( 1, (int) Settings::get( 'contractor.retention_days', 180 ) ) * DAY_IN_SECONDS );
		foreach ( (array) $wpdb->get_results( $wpdb->prepare( "SELECT id, package_path FROM {$qt} WHERE package_path <> '' AND created_at < %s LIMIT 200", $plimit ), ARRAY_A ) as $q ) { // phpcs:ignore
			$path = \AutoGroweHome\Support\Storage::path( $q['package_path'] );
			if ( '' !== $path ) {
				wp_delete_file( $path );
			}
			QuoteService::update( (int) $q['id'], array( 'package_path' => '' ) );
		}
		$lt = Installer::table( 'logs' );
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$lt} WHERE created_at < %s", gmdate( 'Y-m-d H:i:s', time() - max( 1, (int) Settings::get( 'legal.retention_logs_days', 60 ) ) * DAY_IN_SECONDS ) ) ); // phpcs:ignore
		RateLimiter::cleanup();
		AccessTokens::cleanup();
		JobQueue::cleanup();
		if ( $ids ) {
			Logger::info( 'gdpr', 'Retention removed projects', array( 'count' => count( $ids ) ) );
		}
	}
}
