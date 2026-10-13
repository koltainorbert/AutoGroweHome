<?php
/**
 * Admin page views.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Admin;

use AutoGroweHome\Ai\Providers;
use AutoGroweHome\Catalog\Catalog;
use AutoGroweHome\Frontend\Help;
use AutoGroweHome\Frontend\I18n;
use AutoGroweHome\Generation\JobQueue;
use AutoGroweHome\Installer;
use AutoGroweHome\License\Features;
use AutoGroweHome\License\LicenseManager;
use AutoGroweHome\Params\Definitions;
use AutoGroweHome\Params\Registry;
use AutoGroweHome\Projects\Repository;
use AutoGroweHome\Prompt\DefaultModules;
use AutoGroweHome\Prompt\PromptEngine;
use AutoGroweHome\Quote\QuoteService;
use AutoGroweHome\Quote\Summary;
use AutoGroweHome\RateLimit\RateLimiter;
use AutoGroweHome\Rest\RestController;
use AutoGroweHome\Stats\Stats;
use AutoGroweHome\Support\Logger;
use AutoGroweHome\Support\Secrets;
use AutoGroweHome\Support\Settings;
use AutoGroweHome\Support\Storage;

defined( 'ABSPATH' ) || exit;

final class Pages {

	private static function settings_form( string $page_key, ?callable $after = null ): void {
		$specs = Admin::specs()[ $page_key ];
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" class="agh-card agh-settings">';
		wp_nonce_field( 'agh_save_agh-' . $page_key );
		echo '<input type="hidden" name="action" value="agh_save"><input type="hidden" name="agh_page" value="agh-' . esc_attr( $page_key ) . '">';
		foreach ( $specs as $group => $spec ) {
			Form::render( $group, $spec );
		}
		if ( $after ) {
			$after();
		}
		submit_button( __( 'Mentés', 'autogrowehome' ) );
		echo '</form>';
	}

	private static function badge( string $text, string $type = '' ): string {
		return '<span class="agh-pill' . ( '' !== $type ? ' is-' . esc_attr( $type ) : '' ) . '">' . esc_html( $text ) . '</span>';
	}

	/**
	 * Admin download URL of a contractor ZIP package. add_query_arg() keeps it
	 * valid with plain permalinks too, where rest_url() already contains
	 * "?rest_route=".
	 */
	public static function package_url( string $quote_uuid ): string {
		return add_query_arg( '_wpnonce', wp_create_nonce( 'wp_rest' ), rest_url( AGH_REST_NS . '/contractor/package/' . $quote_uuid ) );
	}

	/* ------------------------------------------------------------------ dashboard */

	public static function page_dashboard(): void {
		$st     = Providers::status();
		$today  = wp_date( 'Y-m-d' );
		$tot    = Stats::totals( wp_date( 'Y-m-d', time() - 29 * DAY_IN_SECONDS ), $today );
		$todayt = Stats::totals( $today, $today );
		$lic    = LicenseManager::state();
		$cur    = (string) Settings::get( 'costs.currency', 'EUR' );
		echo '<div class="agh-grid-4">';
		$cards = array(
			array( __( 'Képszolgáltató', 'autogrowehome' ), $st['image_ready'] ? $st['image_label'] : __( 'nincs beállítva', 'autogrowehome' ), $st['image_ready'] ? ( $st['image_is_test'] ? 'warn' : 'ok' ) : 'err' ),
			array( __( 'Anthropic', 'autogrowehome' ), $st['text_ready'] ? __( 'kapcsolódva', 'autogrowehome' ) : __( 'szabályalapú tervező', 'autogrowehome' ), $st['text_ready'] ? 'ok' : 'warn' ),
			array( __( 'Mai generálások', 'autogrowehome' ), (string) (int) ( $todayt['generate_request'] ?? 0 ), '' ),
			array( __( 'Feladatsor', 'autogrowehome' ), sprintf( /* translators: %d: pending */ __( '%d függő feladat', 'autogrowehome' ), JobQueue::pending_total() ), '' ),
			array( __( '30 napos kérések', 'autogrowehome' ), (string) (int) ( $tot['generate_request'] ?? 0 ), '' ),
			array( __( '30 napos ajánlatkérések', 'autogrowehome' ), (string) (int) ( $tot['quote_submitted'] ?? 0 ), '' ),
			array( __( 'Becsült költség (hó)', 'autogrowehome' ), number_format_i18n( Stats::spent( wp_date( 'Y-m-01' ), $today ), 2 ) . ' ' . $cur, '' ),
			array( __( 'Licenc', 'autogrowehome' ), Features::owner_mode() ? __( 'Tulajdonosi mód', 'autogrowehome' ) : LicenseManager::status_label( $lic['status'] ) . ( $lic['plan'] ? ' · ' . ucfirst( $lic['plan'] ) : '' ), Features::owner_mode() || 'active' === $lic['status'] ? 'ok' : 'warn' ),
		);
		foreach ( $cards as $c ) {
			echo '<div class="agh-card agh-stat"><span>' . esc_html( $c[0] ) . '</span><b class="' . ( $c[2] ? 'is-' . esc_attr( $c[2] ) : '' ) . '">' . esc_html( $c[1] ) . '</b></div>';
		}
		echo '</div>';

		$warn = Admin::warnings();
		echo '<div class="agh-card"><h2>' . esc_html__( 'Konfigurációs állapot', 'autogrowehome' ) . '</h2>';
		if ( empty( $warn ) ) {
			echo '<p class="agh-ok">✓ ' . esc_html__( 'Minden alapbeállítás rendben.', 'autogrowehome' ) . '</p>';
		} else {
			echo '<ul class="agh-checklist">';
			foreach ( $warn as $w ) {
				echo '<li class="is-' . esc_attr( $w[0] ) . '">' . wp_kses_post( $w[1] ) . '</li>';
			}
			echo '</ul>';
		}
		echo '</div>';

		echo '<div class="agh-grid-2"><div class="agh-card"><h2>' . esc_html__( 'Beépítés a weboldalba', 'autogrowehome' ) . '</h2><table class="widefat striped"><tbody>';
		foreach ( array(
			'[autogrowehome]'         => __( 'Háztervező indítógomb (a popupot nyitja)', 'autogrowehome' ),
			'[autogrowehome label="…"]' => __( 'Egyedi felirattal', 'autogrowehome' ),
			'[autogrowehome_button]'  => __( 'Az [autogrowehome] shortcode másik neve (azonos működés)', 'autogrowehome' ),
			'[autogrowehome_faq]'     => __( 'Interaktív GYIK kereséssel és kategóriákkal', 'autogrowehome' ),
			'[autogrowehome_pricing]' => __( 'Értékesítési / csomagok oldal (adatvezérelt)', 'autogrowehome' ),
			'[autogrowehome_portal]'  => __( 'Kivitelezői portál (alapértelmezett: /?agh-portal=1)', 'autogrowehome' ),
			'#agh-open'               => __( 'Az erre a horgonyra mutató link (pl. /oldal/#agh-open) megnyitja a tervezőt – azokon az oldalakon, ahol a betöltő be van töltve: a lebegő indítógomb bekapcsolásakor minden oldalon, egyébként az [autogrowehome] shortcode-ot tartalmazó oldalakon.', 'autogrowehome' ),
		) as $code => $desc ) {
			echo '<tr><td><code>' . esc_html( $code ) . '</code></td><td>' . esc_html( $desc ) . '</td></tr>';
		}
		echo '</tbody></table></div>';
		echo '<div class="agh-card"><h2>' . esc_html__( 'Gyors műveletek', 'autogrowehome' ) . '</h2><p>';
		echo '<a class="button" href="' . esc_url( Admin::action_url( 'queue_run' ) ) . '">' . esc_html__( 'Feladatsor futtatása most', 'autogrowehome' ) . '</a> ';
		echo '<a class="button" href="' . esc_url( admin_url( 'admin.php?page=agh-providers' ) ) . '">' . esc_html__( 'Szolgáltatók tesztelése', 'autogrowehome' ) . '</a> ';
		echo '<a class="button" href="' . esc_url( home_url( '/#agh-open' ) ) . '" target="_blank">' . esc_html__( 'Tervező megnyitása', 'autogrowehome' ) . '</a>';
		echo '</p><h3>' . esc_html__( 'Legutóbbi projektek', 'autogrowehome' ) . '</h3>';
		$list = Repository::list_projects( array( 'per_page' => 6 ) );
		echo '<ul class="agh-mini-list">';
		foreach ( $list['items'] as $p ) {
			echo '<li><a href="' . esc_url( admin_url( 'admin.php?page=agh-projects&project=' . $p['uuid'] ) ) . '">' . esc_html( $p['name'] ?: '#' . substr( $p['uuid'], 0, 8 ) ) . '</a> ' . self::badge( $p['status'] ) . ' <span class="description">' . esc_html( get_date_from_gmt( $p['created_at'], 'Y-m-d H:i' ) ) . '</span></li>'; // phpcs:ignore
		}
		echo '</ul></div></div>';
	}

	/* ------------------------------------------------------------------ projects */

	public static function page_projects(): void {
		$uuid = isset( $_GET['project'] ) ? sanitize_text_field( wp_unslash( $_GET['project'] ) ) : ''; // phpcs:ignore
		if ( '' !== $uuid ) {
			self::project_detail( $uuid );
			return;
		}
		$search = isset( $_GET['s'] ) ? sanitize_text_field( wp_unslash( $_GET['s'] ) ) : ''; // phpcs:ignore
		$status = isset( $_GET['status'] ) ? sanitize_key( wp_unslash( $_GET['status'] ) ) : ''; // phpcs:ignore
		$paged  = max( 1, isset( $_GET['paged'] ) ? (int) $_GET['paged'] : 1 ); // phpcs:ignore
		$list   = Repository::list_projects( array( 'search' => $search, 'status' => $status, 'page' => $paged, 'per_page' => 25 ) );
		echo '<form class="agh-card agh-filter" method="get"><input type="hidden" name="page" value="agh-projects"><input type="search" name="s" value="' . esc_attr( $search ) . '" placeholder="' . esc_attr__( 'Név vagy azonosító', 'autogrowehome' ) . '"><select name="status"><option value="">' . esc_html__( 'Minden állapot', 'autogrowehome' ) . '</option>';
		// "deleted" (anonymised) projects are never listed by Repository::list_projects(), so it is not offered here.
		foreach ( array( 'queued', 'planning', 'rendering', 'ready', 'partial', 'failed', 'cancelled' ) as $s ) {
			echo '<option ' . selected( $status, $s, false ) . '>' . esc_html( $s ) . '</option>';
		}
		echo '</select> <button class="button">' . esc_html__( 'Szűrés', 'autogrowehome' ) . '</button> <span class="description">' . esc_html( sprintf( /* translators: %d: total */ __( '%d projekt', 'autogrowehome' ), $list['total'] ) ) . '</span></form>';
		echo '<table class="widefat striped agh-table"><thead><tr><th>' . esc_html__( 'Projekt', 'autogrowehome' ) . '</th><th>' . esc_html__( 'Állapot', 'autogrowehome' ) . '</th><th>' . esc_html__( 'Mentve', 'autogrowehome' ) . '</th><th>' . esc_html__( 'Tulajdonos', 'autogrowehome' ) . '</th><th>' . esc_html__( 'Létrehozva', 'autogrowehome' ) . '</th></tr></thead><tbody>';
		foreach ( $list['items'] as $p ) {
			$owner = (int) $p['owner_user_id'] > 0 ? ( get_userdata( (int) $p['owner_user_id'] ) ? get_userdata( (int) $p['owner_user_id'] )->display_name : '#' . $p['owner_user_id'] ) : __( 'vendég', 'autogrowehome' );
			echo '<tr><td><a href="' . esc_url( add_query_arg( 'project', $p['uuid'] ) ) . '"><strong>' . esc_html( $p['name'] ?: '#' . substr( $p['uuid'], 0, 8 ) ) . '</strong></a><br><code>' . esc_html( $p['uuid'] ) . '</code></td><td>' . self::badge( $p['status'] . ( $p['stage'] ? ' / ' . $p['stage'] : '' ) ) . '</td><td>' . ( $p['saved'] ? '✓' : '–' ) . '</td><td>' . esc_html( $owner ) . '</td><td>' . esc_html( get_date_from_gmt( $p['created_at'], 'Y-m-d H:i' ) ) . '</td></tr>'; // phpcs:ignore
		}
		if ( empty( $list['items'] ) ) {
			echo '<tr><td colspan="5">' . esc_html__( 'Nincs projekt.', 'autogrowehome' ) . '</td></tr>';
		}
		echo '</tbody></table>';
		self::pager( $paged, $list['pages'] );
	}

	private static function pager( int $paged, int $pages ): void {
		if ( $pages <= 1 ) {
			return;
		}
		echo '<p class="agh-pager">';
		for ( $i = 1; $i <= $pages; $i++ ) {
			echo $i === $paged ? '<strong>' . (int) $i . '</strong> ' : '<a class="button button-small" href="' . esc_url( add_query_arg( 'paged', $i ) ) . '">' . (int) $i . '</a> ';
		}
		echo '</p>';
	}

	private static function project_detail( string $uuid ): void {
		$p = Repository::project_by_uuid( $uuid );
		if ( ! $p ) {
			echo '<div class="notice notice-error"><p>' . esc_html__( 'A projekt nem található.', 'autogrowehome' ) . '</p></div>';
			return;
		}
		$payload = RestController::project_payload( $p, 'admin' );
		echo '<p><a href="' . esc_url( admin_url( 'admin.php?page=agh-projects' ) ) . '">← ' . esc_html__( 'Vissza a listához', 'autogrowehome' ) . '</a></p>';
		echo '<div class="agh-card"><h2>' . esc_html( $p['name'] ?: '#' . substr( $p['uuid'], 0, 8 ) ) . ' ' . self::badge( $p['status'] ) . '</h2>'; // phpcs:ignore
		echo '<p><code>' . esc_html( $p['uuid'] ) . '</code> · ' . esc_html__( 'Promptverzió', 'autogrowehome' ) . ': v' . (int) $p['prompt_version'] . ' · ' . esc_html__( 'Költség', 'autogrowehome' ) . ': ' . esc_html( number_format_i18n( Stats::spent_by_project( $p['id'] ), 3 ) . ' ' . Settings::get( 'costs.currency', 'EUR' ) ) . '</p>';
		$quote_uuid = Admin::project_quote_uuid( (int) $p['id'] );
		echo '<p><a class="button" href="' . esc_url( Admin::action_url( 'project_json', array( 'project' => $p['uuid'] ) ) ) . '">' . esc_html__( 'Export (JSON)', 'autogrowehome' ) . '</a> ';
		if ( '' === $quote_uuid ) {
			echo '<a class="button agh-confirm" href="' . esc_url( Admin::action_url( 'project_delete', array( 'project' => $p['uuid'] ) ) ) . '">' . esc_html__( 'Projekt végleges törlése', 'autogrowehome' ) . '</a></p>';
		} else {
			echo '<button type="button" class="button" disabled>' . esc_html__( 'Projekt végleges törlése', 'autogrowehome' ) . '</button></p><p class="description">' . esc_html__( 'A projekthez ajánlatkérés tartozik, ezért nem törölhető (a hozzájárulási napló és a kivitelezői csomag hozzá kötődik). A személyes adatokat az ajánlatkérés anonimizálásával vagy GDPR-adattörléssel távolíthatod el.', 'autogrowehome' ) . ' <a href="' . esc_url( admin_url( 'admin.php?page=agh-quotes&quote=' . rawurlencode( $quote_uuid ) ) ) . '">' . esc_html__( 'Ajánlatkérés megnyitása', 'autogrowehome' ) . ' →</a></p>';
		}
		echo '</div>';
		foreach ( $payload['concepts'] as $c ) {
			echo '<div class="agh-card"><h3>' . esc_html( $c['variant'] . ' – ' . $c['title'] ) . ( $c['selected'] ? ' ' . self::badge( __( 'kiválasztva', 'autogrowehome' ), 'ok' ) : '' ) . ' ' . self::badge( $c['status'] ) . ' ' . self::badge( 'gallery: ' . $c['gallery_status'] ) . '</h3>'; // phpcs:ignore
			echo '<p>' . esc_html( $c['tagline'] ) . ' <span class="description">(' . esc_html( $c['planner'] ) . ')</span></p>';
			foreach ( $c['warnings'] as $w ) {
				echo '<p class="agh-warn">⚠ ' . esc_html( $w ) . '</p>';
			}
			echo '<div class="agh-thumbs">';
			$all = array_merge( $c['hero'] ? array( $c['hero'] ) : array(), $c['assets'] );
			foreach ( $all as $a ) {
				echo '<figure class="agh-thumb is-' . esc_attr( $a['status'] ) . '">';
				if ( ! empty( $a['preview'] ) && in_array( $a['kind'], array( 'render', 'plan' ), true ) ) {
					echo '<a href="' . esc_url( $a['download'] ?? $a['preview'] ) . '" target="_blank"><img src="' . esc_url( $a['preview'] ) . '" alt="" loading="lazy"></a>';
				} elseif ( ! empty( $a['preview'] ) ) {
					echo '<a class="agh-doc" href="' . esc_url( $a['download'] ?? $a['preview'] ) . '">' . esc_html( strtoupper( (string) preg_replace( '#^.*/#', '', $a['mime'] ) ) ) . '</a>';
				} else {
					echo '<div class="agh-doc">' . esc_html( $a['status'] ) . '</div>';
				}
				echo '<figcaption>' . esc_html( $a['label'] ) . '<br><small>' . esc_html( trim( $a['resolution'] . ( $a['is_test'] ? ' · TEST' : '' ) . ( ! empty( $a['provider'] ) ? ' · ' . $a['provider'] : '' ) ) ) . '</small>' . ( ! empty( $a['error'] ) ? '<br><small class="agh-err">' . esc_html( $a['error'] ) . '</small>' : '' ) . '</figcaption></figure>';
			}
			echo '</div></div>';
		}
		echo '<div class="agh-card"><h3>' . esc_html__( 'Paraméterek', 'autogrowehome' ) . '</h3><div class="agh-grid-3">';
		foreach ( Summary::rows( $p['config'] ) as $cat => $rows ) {
			echo '<div><h4>' . esc_html( $cat ) . '</h4><table class="widefat striped"><tbody>';
			foreach ( $rows as $r ) {
				echo '<tr><td>' . esc_html( $r[0] ) . '</td><td>' . ( '' !== $r[2] ? '<span class="agh-sw" style="background:' . esc_attr( $r[2] ) . '"></span>' : '' ) . esc_html( $r[1] ) . '</td></tr>';
			}
			echo '</tbody></table></div>';
		}
		echo '</div><h4>' . esc_html__( 'Ügyfél szöveges instrukciója', 'autogrowehome' ) . '</h4><blockquote>' . nl2br( esc_html( (string) ( $p['config']['custom_text'] ?? '' ) ) ) . '</blockquote></div>';
		global $wpdb;
		$logs = $wpdb->get_results( $wpdb->prepare( 'SELECT level, channel, message, created_at FROM ' . Installer::table( 'logs' ) . ' WHERE project_id = %d ORDER BY id DESC LIMIT 50', $p['id'] ), ARRAY_A ); // phpcs:ignore
		if ( $logs ) {
			echo '<div class="agh-card"><h3>' . esc_html__( 'Projektnapló', 'autogrowehome' ) . '</h3><table class="widefat striped"><tbody>';
			foreach ( $logs as $l ) {
				echo '<tr><td>' . esc_html( $l['created_at'] ) . '</td><td>' . self::badge( $l['level'], 'error' === $l['level'] ? 'err' : '' ) . '</td><td>' . esc_html( $l['channel'] ) . '</td><td>' . esc_html( $l['message'] ) . '</td></tr>'; // phpcs:ignore
			}
			echo '</tbody></table></div>';
		}
	}

	/* ------------------------------------------------------------------ quotes */

	public static function page_quotes(): void {
		$uuid = isset( $_GET['quote'] ) ? sanitize_text_field( wp_unslash( $_GET['quote'] ) ) : ''; // phpcs:ignore
		if ( '' !== $uuid && ( $q = QuoteService::get_by_uuid( $uuid ) ) ) { // phpcs:ignore
			$p = Repository::project_by_id( (int) $q['project_id'] );
			$c = Repository::concept( (int) $q['concept_id'] );
			echo '<p><a href="' . esc_url( admin_url( 'admin.php?page=agh-quotes' ) ) . '">← ' . esc_html__( 'Vissza', 'autogrowehome' ) . '</a></p>';
			echo '<div class="agh-grid-2"><div class="agh-card"><h2>' . esc_html( $q['full_name'] ) . ' ' . self::badge( $q['status'], 'notified' === $q['status'] ? 'ok' : ( 'notify_failed' === $q['status'] ? 'err' : '' ) ) . '</h2><table class="widefat striped"><tbody>'; // phpcs:ignore
			foreach ( array( 'email', 'phone', 'city', 'site_location', 'start_period', 'budget', 'note', 'created_at', 'notified_at', 'downloads' ) as $k ) {
				echo '<tr><th>' . esc_html( $k ) . '</th><td>' . nl2br( esc_html( (string) $q[ $k ] ) ) . '</td></tr>';
			}
			echo '</tbody></table><p>';
			if ( $q['package_path'] ) {
				echo '<a class="button button-primary" href="' . esc_url( self::package_url( $q['uuid'] ) ) . '">' . esc_html__( 'ZIP letöltése', 'autogrowehome' ) . '</a> ';
			}
			echo '<a class="button" href="' . esc_url( Admin::action_url( 'resend_quote', array( 'quote' => $q['uuid'] ), 'agh-quotes' ) ) . '">' . esc_html__( 'Értesítés újraküldése (új link)', 'autogrowehome' ) . '</a> ';
			echo '<a class="button agh-confirm" href="' . esc_url( Admin::action_url( 'quote_revoke', array( 'quote' => $q['uuid'] ), 'agh-quotes' ) ) . '">' . esc_html__( 'Hozzáférés visszavonása', 'autogrowehome' ) . '</a> ';
			echo '<a class="button agh-confirm" href="' . esc_url( Admin::action_url( 'quote_anonymize', array( 'quote' => $q['uuid'] ), 'agh-quotes' ) ) . '">' . esc_html__( 'Személyes adatok anonimizálása', 'autogrowehome' ) . '</a></p></div>';
			echo '<div class="agh-card"><h3>' . esc_html__( 'Hozzájárulási és továbbítási napló', 'autogrowehome' ) . '</h3><table class="widefat striped"><thead><tr><th>' . esc_html__( 'Idő', 'autogrowehome' ) . '</th><th>' . esc_html__( 'Típus', 'autogrowehome' ) . '</th><th>' . esc_html__( 'Esemény', 'autogrowehome' ) . '</th><th>' . esc_html__( 'Megadva', 'autogrowehome' ) . '</th><th>' . esc_html__( 'Dokumentum', 'autogrowehome' ) . '</th></tr></thead><tbody>';
			foreach ( QuoteService::consent_log( (int) $q['id'] ) as $l ) {
				echo '<tr><td>' . esc_html( $l['created_at'] ) . '</td><td>' . esc_html( $l['consent_type'] ) . '</td><td>' . esc_html( $l['event'] ) . '</td><td>' . ( $l['granted'] ? '✓' : '–' ) . '</td><td>' . esc_html( $l['doc_version'] ) . ( $l['doc_url'] ? ' <a href="' . esc_url( $l['doc_url'] ) . '" target="_blank">↗</a>' : '' ) . '</td></tr>';
			}
			echo '</tbody></table>';
			if ( $p ) {
				echo '<p><a href="' . esc_url( admin_url( 'admin.php?page=agh-projects&project=' . $p['uuid'] ) ) . '">' . esc_html__( 'Projekt megnyitása', 'autogrowehome' ) . ' →</a>' . ( $c ? ' · ' . esc_html( $c['variant'] . ' – ' . $c['title'] ) : '' ) . '</p>';
			}
			echo '</div></div>';
			return;
		}
		$paged = max( 1, isset( $_GET['paged'] ) ? (int) $_GET['paged'] : 1 ); // phpcs:ignore
		$list  = QuoteService::list( array( 'page' => $paged, 'per_page' => 25 ) );
		echo '<table class="widefat striped agh-table"><thead><tr><th>' . esc_html__( 'Ügyfél', 'autogrowehome' ) . '</th><th>' . esc_html__( 'Település', 'autogrowehome' ) . '</th><th>' . esc_html__( 'Állapot', 'autogrowehome' ) . '</th><th>' . esc_html__( 'Letöltések', 'autogrowehome' ) . '</th><th>' . esc_html__( 'Beérkezett', 'autogrowehome' ) . '</th></tr></thead><tbody>';
		foreach ( $list['items'] as $q ) {
			echo '<tr><td><a href="' . esc_url( add_query_arg( 'quote', $q['uuid'] ) ) . '"><strong>' . esc_html( $q['full_name'] ) . '</strong></a><br>' . esc_html( $q['email'] ) . '</td><td>' . esc_html( $q['city'] ) . '</td><td>' . self::badge( $q['status'], 'notified' === $q['status'] ? 'ok' : ( 'notify_failed' === $q['status'] ? 'err' : '' ) ) . '</td><td>' . (int) $q['downloads'] . '</td><td>' . esc_html( get_date_from_gmt( $q['created_at'], 'Y-m-d H:i' ) ) . '</td></tr>'; // phpcs:ignore
		}
		if ( empty( $list['items'] ) ) {
			echo '<tr><td colspan="5">' . esc_html__( 'Még nincs ajánlatkérés.', 'autogrowehome' ) . '</td></tr>';
		}
		echo '</tbody></table>';
		self::pager( $paged, $list['pages'] );
	}

	/* ------------------------------------------------------------------ stats */

	public static function page_stats(): void {
		$from = isset( $_GET['from'] ) ? sanitize_text_field( wp_unslash( $_GET['from'] ) ) : wp_date( 'Y-m-d', time() - 29 * DAY_IN_SECONDS ); // phpcs:ignore
		$to   = isset( $_GET['to'] ) ? sanitize_text_field( wp_unslash( $_GET['to'] ) ) : wp_date( 'Y-m-d' ); // phpcs:ignore
		$adv  = Features::enabled( 'stats_advanced' );
		echo '<form class="agh-card agh-filter" method="get" id="agh-stats-filter"><input type="hidden" name="page" value="agh-stats">';
		echo '<label>' . esc_html__( 'Tól', 'autogrowehome' ) . ' <input type="date" name="from" value="' . esc_attr( $from ) . '"></label> <label>' . esc_html__( 'Ig', 'autogrowehome' ) . ' <input type="date" name="to" value="' . esc_attr( $to ) . '"></label> <button class="button">' . esc_html__( 'Frissítés', 'autogrowehome' ) . '</button> ';
		if ( Features::enabled( 'export_advanced' ) ) {
			echo '<a class="button" href="' . esc_url( Admin::action_url( 'stats_csv', array( 'from' => $from, 'to' => $to ) ) ) . '">' . esc_html__( 'CSV export', 'autogrowehome' ) . '</a>';
		} else {
			echo '<button type="button" class="button" disabled title="' . esc_attr__( 'A CSV-export a bővített exportálás funkcióval (Agency csomag) érhető el.', 'autogrowehome' ) . '">' . esc_html__( 'CSV export', 'autogrowehome' ) . '</button>';
		}
		echo '<span class="description"> ' . esc_html__( 'Összesített, személyazonosításra nem alkalmas adatok.', 'autogrowehome' ) . '</span></form>';
		echo '<div id="agh-stats" data-from="' . esc_attr( $from ) . '" data-to="' . esc_attr( $to ) . '" data-advanced="' . ( $adv ? '1' : '0' ) . '"><p>' . esc_html__( 'Betöltés…', 'autogrowehome' ) . '</p></div>';
		if ( ! $adv ) {
			echo '<p class="description">' . esc_html__( 'A részletes bontások (stílusok, tetők, paraméterek, hibaokok, költség) a Professional csomagban érhetők el.', 'autogrowehome' ) . '</p>';
		}
	}

	/* ------------------------------------------------------------------ providers */

	public static function page_providers(): void {
		echo '<div class="agh-card agh-provider-tests"><h2>' . esc_html__( 'Kapcsolat teszt', 'autogrowehome' ) . '</h2><p class="description">' . esc_html__( 'A Magnific teszt költségmentes hitelesítés-ellenőrzés; az Anthropic teszt a modell-listát kérdezi le (nincs tokenköltség).', 'autogrowehome' ) . '</p><p>';
		foreach ( array( 'magnific' => 'Magnific', 'anthropic' => 'Anthropic', 'test' => __( 'Teszt mód (GD)', 'autogrowehome' ) ) as $id => $label ) {
			echo '<button type="button" class="button agh-test-provider" data-provider="' . esc_attr( $id ) . '">' . esc_html( $label ) . '</button> ';
		}
		echo '</p><div class="agh-test-result" aria-live="polite"></div></div>';
		self::settings_form( 'providers' );
		echo '<div class="agh-card"><h3>' . esc_html__( 'Szolgáltatói adatkezelés', 'autogrowehome' ) . '</h3><p>' . esc_html__( 'A ház paraméterei, a szabad szöveges leírás és a generált/referenciaképek a beállított AI-szolgáltatókhoz (Magnific, Anthropic) kerülnek feldolgozásra. Személyes elérhetőségek (név, e-mail, telefon) nem kerülnek továbbításra. Ezt tüntesd fel az adatkezelési tájékoztatóban, és ellenőrizd a szolgáltatók adatfeldolgozási feltételeit.', 'autogrowehome' ) . '</p>';
		echo '<p class="description">' . esc_html__( 'Javasolt: a kulcsokat wp-config.php-ban add meg (AGH_MAGNIFIC_API_KEY, AGH_ANTHROPIC_API_KEY).', 'autogrowehome' ) . '</p></div>';
	}

	/* ------------------------------------------------------------------ prompts */

	public static function page_prompts(): void {
		if ( ! Features::enabled( 'prompt_editor' ) ) {
			echo '<div class="agh-card"><p>' . esc_html__( 'A szerkeszthető promptmotor a Professional csomagtól érhető el. A gyári promptok aktívak.', 'autogrowehome' ) . '</p></div>';
			return;
		}
		$versions = PromptEngine::versions();
		$edit     = isset( $_GET['version'] ) ? (int) $_GET['version'] : 0; // phpcs:ignore
		$v        = PromptEngine::get( $edit );
		echo '<div class="agh-grid-2-1"><div>';
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" class="agh-card">';
		wp_nonce_field( 'agh_action_prompt_save' );
		echo '<input type="hidden" name="action" value="agh_action"><input type="hidden" name="do" value="prompt_save"><input type="hidden" name="back" value="agh-prompts">';
		echo '<h2>' . esc_html( sprintf( /* translators: 1: version 2: label */ __( 'Szerkesztés – v%1$d „%2$s” alapján', 'autogrowehome' ), $v['version'], $v['label'] ) ) . '</h2>';
		echo '<p class="description">' . esc_html__( 'A mentés mindig új verziót hoz létre; a korábbiak visszaállíthatók. Csak egyszerű szöveg és {változók} használhatók.', 'autogrowehome' ) . '</p>';
		echo '<h3>' . esc_html__( 'Modulok', 'autogrowehome' ) . '</h3>';
		foreach ( $v['modules'] as $k => $text ) {
			echo '<p><label class="agh-mod-label"><code>' . esc_html( $k ) . '</code></label><textarea class="large-text code agh-prompt-mod" rows="3" name="modules[' . esc_attr( $k ) . ']">' . esc_textarea( $text ) . '</textarea></p>';
		}
		echo '<h3>' . esc_html__( 'Nézetenkénti szabályok', 'autogrowehome' ) . '</h3>';
		foreach ( $v['views'] as $k => $view ) {
			echo '<fieldset class="agh-view"><legend><code>' . esc_html( $k ) . '</code></legend>';
			echo '<label>' . esc_html__( 'Név', 'autogrowehome' ) . ' <input type="text" name="views[' . esc_attr( $k ) . '][label]" value="' . esc_attr( $view['label'] ) . '"></label>';
			echo '<label>' . esc_html__( 'Szabály', 'autogrowehome' ) . '<textarea class="large-text code" rows="2" name="views[' . esc_attr( $k ) . '][rule]">' . esc_textarea( $view['rule'] ) . '</textarea></label>';
			echo '<label>' . esc_html__( 'Modulok sorrendje', 'autogrowehome' ) . ' <input type="text" class="large-text code" name="views[' . esc_attr( $k ) . '][modules]" value="' . esc_attr( $view['modules'] ) . '"></label></fieldset>';
		}
		echo '<h3>' . esc_html__( 'Stílusonkénti felülírások', 'autogrowehome' ) . '</h3><p class="description">' . esc_html__( 'Adott építészeti stílusnál a megadott modulok szövege lecserélődik.', 'autogrowehome' ) . '</p>';
		foreach ( Definitions::fields() as $f ) {
			if ( 'arch_style' !== $f['id'] ) {
				continue;
			}
			foreach ( $f['options'] as $style => $label ) {
				$ov = $v['style_overrides'][ $style ] ?? array();
				echo '<details class="agh-details"' . ( $ov ? ' open' : '' ) . '><summary>' . esc_html( $label ) . ( $ov ? ' (' . count( $ov ) . ')' : '' ) . '</summary>';
				foreach ( array( 'style', 'concept', 'facade', 'roof', 'garden', 'interiors', 'negative' ) as $mod ) {
					echo '<p><label><code>' . esc_html( $mod ) . '</code></label><textarea class="large-text code" rows="2" name="override[' . esc_attr( $style ) . '][' . esc_attr( $mod ) . ']" placeholder="' . esc_attr__( '(alapértelmezett modul)', 'autogrowehome' ) . '">' . esc_textarea( (string) ( $ov[ $mod ] ?? '' ) ) . '</textarea></p>';
				}
				echo '</details>';
			}
		}
		echo '<p><label>' . esc_html__( 'Verzió megnevezése', 'autogrowehome' ) . ' <input type="text" name="label" class="regular-text"></label> <label><input type="checkbox" name="activate" value="1" checked> ' . esc_html__( 'Aktiválás mentés után', 'autogrowehome' ) . '</label></p>';
		submit_button( __( 'Mentés új verzióként', 'autogrowehome' ) );
		echo '</form></div><div>';
		echo '<div class="agh-card agh-sticky"><h3>' . esc_html__( 'Előnézet', 'autogrowehome' ) . '</h3><p><select id="agh-prompt-view">';
		foreach ( array_keys( DefaultModules::views() ) as $k ) {
			echo '<option value="' . esc_attr( $k ) . '">' . esc_html( $k ) . '</option>';
		}
		echo '</select> <select id="agh-prompt-version">';
		foreach ( $versions as $ver ) {
			echo '<option value="' . (int) $ver['version'] . '" ' . selected( (int) $ver['version'], (int) $v['version'], false ) . '>v' . (int) $ver['version'] . ( $ver['is_active'] ? ' ★' : '' ) . '</option>';
		}
		echo '</select> <button type="button" class="button" id="agh-prompt-preview">' . esc_html__( 'Előnézet', 'autogrowehome' ) . '</button> <button type="button" class="button" id="agh-prompt-test">' . esc_html__( 'Tesztgenerálás', 'autogrowehome' ) . '</button></p>';
		echo '<pre id="agh-prompt-out" class="agh-pre"></pre><p class="description">' . esc_html__( 'Az előnézet az alapértelmezett paraméterekkel és a szabályalapú „A” koncepcióval áll össze. A tesztgenerálás valós képet kér (költség!), az eredmény a Projektek között jelenik meg.', 'autogrowehome' ) . '</p>';
		echo '<h3>' . esc_html__( 'Változók', 'autogrowehome' ) . '</h3><p class="agh-vars">';
		foreach ( PromptEngine::variable_names() as $n ) {
			echo '<code>{' . esc_html( $n ) . '}</code> ';
		}
		echo '</p></div>';
		echo '<div class="agh-card"><h3>' . esc_html__( 'Verziók', 'autogrowehome' ) . '</h3><table class="widefat striped"><tbody>';
		global $wpdb;
		foreach ( $versions as $ver ) {
			$tests = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . Installer::table( 'projects' ) . ' WHERE prompt_version = %d', (int) $ver['version'] ) ); // phpcs:ignore
			echo '<tr><td><strong>v' . (int) $ver['version'] . '</strong>' . ( $ver['is_active'] ? ' ' . self::badge( __( 'aktív', 'autogrowehome' ), 'ok' ) : '' ) . '<br><small>' . esc_html( $ver['label'] ) . ' · ' . esc_html( $ver['created_at'] ) . '</small><br><small>' . esc_html( sprintf( /* translators: %d: count */ __( '%d projekt ezzel a verzióval', 'autogrowehome' ), $tests ) ) . '</small></td><td>'; // phpcs:ignore
			echo '<a href="' . esc_url( add_query_arg( 'version', (int) $ver['version'] ) ) . '">' . esc_html__( 'Betöltés', 'autogrowehome' ) . '</a>';
			if ( ! $ver['is_active'] ) {
				echo ' · <a href="' . esc_url( Admin::action_url( 'prompt_activate', array( 'version' => (int) $ver['version'] ) ) ) . '">' . esc_html__( 'Aktiválás', 'autogrowehome' ) . '</a>';
			}
			echo ' · <a href="' . esc_url( admin_url( 'admin.php?page=agh-projects&s=' ) ) . '" class="agh-compare-link" data-version="' . (int) $ver['version'] . '">' . esc_html__( 'Összehasonlítás', 'autogrowehome' ) . '</a></td></tr>';
		}
		echo '</tbody></table><p><a class="button agh-confirm" href="' . esc_url( Admin::action_url( 'prompt_reset' ) ) . '">' . esc_html__( 'Gyári promptok visszaállítása (új verzióként)', 'autogrowehome' ) . '</a></p>';
		echo '<div id="agh-compare-out"></div></div></div></div>';
	}

	/* ------------------------------------------------------------------ params */

	public static function page_params(): void {
		$cats   = Definitions::categories();
		$fields = Registry::fields();
		$over   = (array) get_option( Registry::OVERRIDE_OPTION, array() );
		echo '<div class="agh-card"><h2>' . esc_html__( 'Új / egyedi paraméter', 'autogrowehome' ) . '</h2>';
		if ( ! Features::enabled( 'custom_params' ) ) {
			echo '<p>' . esc_html__( 'A dinamikus paraméterszerkesztő a Professional csomagtól érhető el.', 'autogrowehome' ) . '</p></div>';
		} else {
			$edit = isset( $_GET['edit'] ) ? sanitize_key( wp_unslash( $_GET['edit'] ) ) : ''; // phpcs:ignore
			$cur  = array();
			foreach ( Registry::custom() as $cp ) {
				if ( $cp['id'] === $edit ) {
					$cur = $cp;
				}
			}
			$opts = '';
			foreach ( (array) ( $cur['options'] ?? array() ) as $ov => $ol ) {
				$opts .= $ov . '|' . $ol . '|' . ( $cur['prompt_map'][ $ov ] ?? '' ) . "\n";
			}
			echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" class="agh-param-form">';
			wp_nonce_field( 'agh_action_param_save' );
			echo '<input type="hidden" name="action" value="agh_action"><input type="hidden" name="do" value="param_save"><input type="hidden" name="back" value="agh-params">';
			echo '<div class="agh-grid-3">';
			echo '<label>' . esc_html__( 'Belső azonosító', 'autogrowehome' ) . '<input type="text" name="param[id]" value="' . esc_attr( (string) ( $cur['id'] ?? '' ) ) . '" required pattern="[a-z0-9_]+"><small>' . esc_html__( 'x_ előtaggal tárolódik', 'autogrowehome' ) . '</small></label>';
			echo '<label>' . esc_html__( 'Megjelenítési név', 'autogrowehome' ) . '<input type="text" name="param[label]" value="' . esc_attr( (string) ( $cur['label'] ?? '' ) ) . '" required></label>';
			echo '<label>' . esc_html__( 'Kategória', 'autogrowehome' ) . '<select name="param[category]">';
			foreach ( $cats as $k => $c ) {
				echo '<option value="' . esc_attr( $k ) . '" ' . selected( $cur['category'] ?? 'custom', $k, false ) . '>' . esc_html( $c['label'] ) . '</option>';
			}
			echo '</select></label>';
			echo '<label>' . esc_html__( 'Adattípus', 'autogrowehome' ) . '<select name="param[type]">';
			foreach ( Registry::TYPES as $t ) {
				echo '<option ' . selected( $cur['type'] ?? 'text', $t, false ) . '>' . esc_html( $t ) . '</option>';
			}
			echo '</select></label>';
			echo '<label>' . esc_html__( 'Alapérték', 'autogrowehome' ) . '<input type="text" name="param[default]" value="' . esc_attr( is_array( $cur['default'] ?? '' ) ? implode( ',', $cur['default'] ) : (string) ( $cur['default'] ?? '' ) ) . '"></label>';
			echo '<label>' . esc_html__( 'Egység', 'autogrowehome' ) . '<input type="text" name="param[unit]" value="' . esc_attr( (string) ( $cur['unit'] ?? '' ) ) . '"></label>';
			echo '<label>' . esc_html__( 'Minimum', 'autogrowehome' ) . '<input type="number" step="any" name="param[min]" value="' . esc_attr( (string) ( $cur['min'] ?? '' ) ) . '"></label>';
			echo '<label>' . esc_html__( 'Maximum', 'autogrowehome' ) . '<input type="number" step="any" name="param[max]" value="' . esc_attr( (string) ( $cur['max'] ?? '' ) ) . '"></label>';
			echo '<label>' . esc_html__( 'Lépésköz', 'autogrowehome' ) . '<input type="number" step="any" name="param[step]" value="' . esc_attr( (string) ( $cur['step'] ?? '' ) ) . '"></label>';
			echo '<label>' . esc_html__( 'Rendezés', 'autogrowehome' ) . '<input type="number" name="param[sort]" value="' . esc_attr( (string) ( $cur['sort'] ?? 1000 ) ) . '"></label>';
			echo '<label>' . esc_html__( 'Validációs minta (regex, szövegnél)', 'autogrowehome' ) . '<input type="text" name="param[pattern]" value="' . esc_attr( (string) ( $cur['pattern'] ?? '' ) ) . '"></label>';
			echo '<label>' . esc_html__( 'Megjelenítési feltétel', 'autogrowehome' ) . '<span class="agh-inline"><input type="text" name="param[show_if_field]" placeholder="mező" value="' . esc_attr( (string) ( $cur['show_if']['field'] ?? '' ) ) . '"><select name="param[show_if_op]">';
			foreach ( array( '=', '!=', '>', '<', 'in' ) as $op ) {
				echo '<option ' . selected( $cur['show_if']['op'] ?? '=', $op, false ) . '>' . esc_html( $op ) . '</option>';
			}
			echo '</select><input type="text" name="param[show_if_value]" placeholder="' . esc_attr__( 'érték („in”: a, b)', 'autogrowehome' ) . '" value="' . esc_attr( self::show_if_value_text( $cur['show_if']['value'] ?? '' ) ) . '"></span></label>';
			echo '</div>';
			echo '<label>' . esc_html__( 'Súgó', 'autogrowehome' ) . '<input type="text" class="large-text" name="param[help]" value="' . esc_attr( (string) ( $cur['help'] ?? '' ) ) . '"></label>';
			echo '<label>' . esc_html__( 'Választható értékek (soronként: érték|felirat|angol prompt)', 'autogrowehome' ) . '<textarea class="large-text code" rows="4" name="param[options]">' . esc_textarea( $opts ) . '</textarea></label>';
			echo '<label>' . esc_html__( 'Promptba kerülő szöveg (angolul; {value}, {label}, {color})', 'autogrowehome' ) . '<input type="text" class="large-text" name="param[prompt]" value="' . esc_attr( (string) ( $cur['prompt'] ?? '' ) ) . '"></label>';
			echo '<p class="description">' . esc_html__( 'Üresen hagyva: választós típusnál (select, multiselect, cards) a kiválasztott érték(ek) angol prompt-szövege kerül a promptba (a lista 3. oszlopa; ha az hiányzik, a felirat). Más típusnál üres szöveg esetén a paraméter nem kerül a promptba.', 'autogrowehome' ) . '</p>';
			echo '<p><label><input type="checkbox" name="param[required]" value="1" ' . checked( ! empty( $cur['required'] ), true, false ) . '> ' . esc_html__( 'Kötelező', 'autogrowehome' ) . '</label> <label><input type="checkbox" name="param[advanced]" value="1" ' . checked( ! empty( $cur['advanced'] ), true, false ) . '> ' . esc_html__( 'Haladó', 'autogrowehome' ) . '</label></p>';
			echo '<details><summary>' . esc_html__( 'Fordítások (megjelenítési név)', 'autogrowehome' ) . '</summary><div class="agh-grid-3">';
			foreach ( I18n::SUPPORTED as $loc => $ln ) {
				if ( 'hu_HU' === $loc ) {
					continue;
				}
				echo '<label>' . esc_html( $ln ) . '<input type="text" name="param[translations][' . esc_attr( $loc ) . ']" value="' . esc_attr( (string) ( $cur['translations'][ $loc ] ?? '' ) ) . '"></label>';
			}
			echo '</div></details>';
			submit_button( __( 'Paraméter mentése', 'autogrowehome' ) );
			echo '</form>';
			$custom = Registry::custom();
			if ( $custom ) {
				echo '<h3>' . esc_html__( 'Egyedi paraméterek', 'autogrowehome' ) . '</h3><ul class="agh-mini-list">';
				foreach ( $custom as $cp ) {
					echo '<li><code>' . esc_html( $cp['id'] ) . '</code> ' . esc_html( $cp['label'] ) . ' (' . esc_html( $cp['type'] ) . ') – <a href="' . esc_url( add_query_arg( 'edit', $cp['id'] ) ) . '">' . esc_html__( 'Szerkesztés', 'autogrowehome' ) . '</a> · <a class="agh-confirm" href="' . esc_url( Admin::action_url( 'param_delete', array( 'id' => $cp['id'] ) ) ) . '">' . esc_html__( 'Törlés', 'autogrowehome' ) . '</a></li>';
				}
				echo '</ul>';
			}
			echo '</div>';
		}
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" class="agh-card">';
		wp_nonce_field( 'agh_action_param_overrides' );
		echo '<input type="hidden" name="action" value="agh_action"><input type="hidden" name="do" value="param_overrides"><input type="hidden" name="back" value="agh-params">';
		echo '<h2>' . esc_html__( 'Beépített paraméterek testreszabása', 'autogrowehome' ) . '</h2><p class="description">' . esc_html__( 'Elrejtés, átnevezés, alapérték, haladó jelölés, sorrend. Kötelező mezők nem rejthetők el.', 'autogrowehome' ) . '</p>';
		echo '<input type="search" class="agh-table-filter" placeholder="' . esc_attr__( 'Szűrés…', 'autogrowehome' ) . '"><table class="widefat striped agh-table agh-filterable"><thead><tr><th>' . esc_html__( 'Paraméter', 'autogrowehome' ) . '</th><th>' . esc_html__( 'Rejtett', 'autogrowehome' ) . '</th><th>' . esc_html__( 'Haladó', 'autogrowehome' ) . '</th><th>' . esc_html__( 'Felirat', 'autogrowehome' ) . '</th><th>' . esc_html__( 'Súgó', 'autogrowehome' ) . '</th><th>' . esc_html__( 'Alapérték', 'autogrowehome' ) . '</th><th>' . esc_html__( 'Sorrend', 'autogrowehome' ) . '</th></tr></thead><tbody>';
		foreach ( $fields as $id => $f ) {
			if ( empty( $f['builtin'] ) ) {
				continue;
			}
			$o   = $over[ $id ] ?? array();
			$dv  = $o['default'] ?? '';
			$dvs = is_array( $dv ) ? implode( ',', $dv ) : ( is_bool( $dv ) ? ( $dv ? '1' : '0' ) : (string) $dv );
			echo '<tr><td><strong>' . esc_html( Definitions::categories()[ $f['category'] ]['label'] ?? '' ) . '</strong> · ' . esc_html( $f['label'] ) . '<br><code>' . esc_html( $id ) . '</code>' . ( ! empty( $f['locked'] ) ? ' ' . self::badge( 'Pro', 'warn' ) : '' ) . '</td>'; // phpcs:ignore
			echo '<td><input type="checkbox" name="ov[' . esc_attr( $id ) . '][hidden]" value="1" ' . checked( ! empty( $o['hidden'] ), true, false ) . ( ! empty( $f['required'] ) ? ' disabled' : '' ) . '></td>';
			echo '<td><input type="checkbox" name="ov[' . esc_attr( $id ) . '][advanced]" value="1" ' . checked( (bool) ( $o['advanced'] ?? $f['advanced'] ), true, false ) . '></td>';
			echo '<td><input type="text" name="ov[' . esc_attr( $id ) . '][label]" value="' . esc_attr( (string) ( $o['label'] ?? '' ) ) . '" placeholder="' . esc_attr( $f['label'] ) . '"></td>';
			echo '<td><input type="text" name="ov[' . esc_attr( $id ) . '][help]" value="' . esc_attr( (string) ( $o['help'] ?? '' ) ) . '"></td>';
			echo '<td>' . ( in_array( $f['type'], array( 'rooms', 'roomitems' ), true ) ? '–' : '<input type="text" name="ov[' . esc_attr( $id ) . '][default]" value="' . esc_attr( $dvs ) . '" placeholder="' . esc_attr( is_array( $f['default'] ) ? implode( ',', $f['default'] ) : ( is_bool( $f['default'] ) ? ( $f['default'] ? '1' : '0' ) : (string) $f['default'] ) ) . '">' ) . '</td>';
			echo '<td><input type="number" style="width:70px" name="ov[' . esc_attr( $id ) . '][sort]" value="' . esc_attr( isset( $o['sort'] ) ? (string) $o['sort'] : '' ) . '"></td></tr>';
		}
		echo '</tbody></table>';
		submit_button( __( 'Mentés', 'autogrowehome' ) );
		echo '</form>';
	}

	/**
	 * Display value of a parameter condition: lists (operator "in") as "a, b".
	 *
	 * @param mixed $value Stored show_if value.
	 */
	public static function show_if_value_text( $value ): string {
		if ( is_array( $value ) ) {
			return implode( ', ', array_map( 'strval', array_filter( $value, 'is_scalar' ) ) );
		}
		return is_scalar( $value ) ? (string) $value : '';
	}

	/**
	 * Catalog item that may be neither deleted nor hidden (the mandatory roof
	 * brand – Catalog::delete() refuses it, Catalog::save() keeps it published).
	 */
	public static function catalog_locked( string $type, string $slug ): bool {
		return 'roof_brand' === $type && Catalog::SPEC_ROOF_BRAND === $slug;
	}

	/* ------------------------------------------------------------------ catalog */

	public static function page_catalog(): void {
		$type  = isset( $_GET['type'] ) ? sanitize_key( wp_unslash( $_GET['type'] ) ) : 'roof_product'; // phpcs:ignore
		$type  = isset( Catalog::TYPES[ $type ] ) ? $type : 'roof_product';
		$edit  = isset( $_GET['edit'] ) ? sanitize_key( wp_unslash( $_GET['edit'] ) ) : ''; // phpcs:ignore
		echo '<nav class="nav-tab-wrapper">';
		foreach ( Catalog::TYPES as $k => $l ) {
			echo '<a class="nav-tab' . ( $k === $type ? ' nav-tab-active' : '' ) . '" href="' . esc_url( admin_url( 'admin.php?page=agh-catalog&type=' . $k ) ) . '">' . esc_html( $l ) . '</a>';
		}
		echo '</nav>';
		if ( 'roof_product' === $type ) {
			echo '<div class="notice notice-info inline"><p>' . esc_html__( 'Csak ellenőrzött termékneveket és valós katalógusadatokat használj. Az előre feltöltött BRAMAC termékcsaládok és színnevek egy magyar viszonteladó listájából származnak (forrás a tételnél); a HEX színminták csak megjelenítési közelítések. Ellenőrzés után jelöld „ellenőrzött”-nek.', 'autogrowehome' ) . '</p></div>';
		}
		$items = Catalog::all( $type, false );
		$cur   = $edit ? Catalog::get( $type, $edit ) : null;
		$fields = array(
			'roof_brand'          => array( 'prompt' => __( 'Prompt leírás (angol)', 'autogrowehome' ), 'url' => 'URL' ),
			'roof_product'        => array( 'brand' => __( 'Márka azonosító', 'autogrowehome' ), 'line' => __( 'Termékcsalád', 'autogrowehome' ), 'color' => __( 'Szín (katalógus szerint)', 'autogrowehome' ), 'color_en' => __( 'Szín angolul (promptba)', 'autogrowehome' ), 'hex' => __( 'Színminta HEX (közelítés)', 'autogrowehome' ), 'prompt' => __( 'Prompt leírás (angol)', 'autogrowehome' ), 'source' => __( 'Forrás URL', 'autogrowehome' ), 'verified' => __( 'Ellenőrzött', 'autogrowehome' ) ),
			'material'            => array( 'group' => __( 'Csoport (facade/floor/…)', 'autogrowehome' ), 'hex' => 'HEX', 'prompt' => __( 'Prompt leírás (angol)', 'autogrowehome' ) ),
			'color_collection'    => array( 'colors' => __( 'Színek (vesszővel, #RRGGBB)', 'autogrowehome' ) ),
			'style'               => array( 'direction' => __( 'Vizuális irány (angol, promptba)', 'autogrowehome' ), 'description' => __( 'Leírás', 'autogrowehome' ), 'defaults' => __( 'Paraméterkészlet (JSON)', 'autogrowehome' ) ),
			'interior_collection' => array( 'description' => __( 'Leírás', 'autogrowehome' ), 'prompt' => __( 'Prompt leírás (angol)', 'autogrowehome' ), 'values' => __( 'Paraméterértékek (JSON)', 'autogrowehome' ) ),
			'preset'              => array( 'description' => __( 'Leírás', 'autogrowehome' ), 'values' => __( 'Paraméterértékek (JSON)', 'autogrowehome' ) ),
		)[ $type ];
		echo '<div class="agh-grid-2-1"><div class="agh-card"><table class="widefat striped agh-table"><thead><tr><th>' . esc_html__( 'Név', 'autogrowehome' ) . '</th><th>' . esc_html__( 'Azonosító', 'autogrowehome' ) . '</th><th>' . esc_html__( 'Állapot', 'autogrowehome' ) . '</th><th></th></tr></thead><tbody>';
		foreach ( $items as $it ) {
			$sw = ! empty( $it['data']['hex'] ) ? '<span class="agh-sw" style="background:' . esc_attr( $it['data']['hex'] ) . '"></span>' : '';
			if ( ! empty( $it['data']['colors'] ) ) {
				foreach ( (array) $it['data']['colors'] as $col ) {
					$sw .= '<span class="agh-sw" style="background:' . esc_attr( $col ) . '"></span>';
				}
			}
			$ver = 'roof_product' === $type ? ( empty( $it['data']['verified'] ) ? ' ' . self::badge( __( 'ellenőrizendő', 'autogrowehome' ), 'warn' ) : ' ' . self::badge( __( 'ellenőrzött', 'autogrowehome' ), 'ok' ) ) : '';
			$locked = self::catalog_locked( $type, (string) $it['slug'] );
			if ( $locked ) {
				$ver .= ' ' . self::badge( __( 'kötelező', 'autogrowehome' ), 'ok' );
			}
			$del = $locked ? '<span class="description">' . esc_html__( 'nem törölhető', 'autogrowehome' ) . '</span>' : '<a class="agh-confirm" href="' . esc_url( Admin::action_url( 'catalog_delete', array( 'type' => $type, 'slug' => $it['slug'] ), 'agh-catalog' ) ) . '">' . esc_html__( 'Törlés', 'autogrowehome' ) . '</a>';
			echo '<tr><td>' . $sw . esc_html( $it['name'] ) . $ver . '</td><td><code>' . esc_html( $it['slug'] ) . '</code></td><td>' . esc_html( $it['status'] ) . '</td><td><a href="' . esc_url( add_query_arg( array( 'type' => $type, 'edit' => $it['slug'] ) ) ) . '">' . esc_html__( 'Szerkesztés', 'autogrowehome' ) . '</a> · ' . $del . '</td></tr>'; // phpcs:ignore
		}
		echo '</tbody></table></div><div class="agh-card"><h2>' . esc_html( $cur ? __( 'Elem szerkesztése', 'autogrowehome' ) : __( 'Új elem', 'autogrowehome' ) ) . '</h2>';
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		wp_nonce_field( 'agh_action_catalog_save' );
		echo '<input type="hidden" name="action" value="agh_action"><input type="hidden" name="do" value="catalog_save"><input type="hidden" name="back" value="agh-catalog"><input type="hidden" name="type" value="' . esc_attr( $type ) . '">';
		echo '<p><label>' . esc_html__( 'Név', 'autogrowehome' ) . '<br><input class="large-text" type="text" name="item[name]" value="' . esc_attr( (string) ( $cur['name'] ?? '' ) ) . '" required></label></p>';
		echo '<p><label>' . esc_html__( 'Azonosító (slug)', 'autogrowehome' ) . '<br><input class="large-text" type="text" name="item[slug]" value="' . esc_attr( (string) ( $cur['slug'] ?? '' ) ) . '"' . ( $cur ? ' readonly' : '' ) . '></label></p>';
		foreach ( $fields as $k => $label ) {
			$val = $cur['data'][ $k ] ?? '';
			if ( 'verified' === $k ) {
				echo '<p><label><input type="hidden" name="item[data][verified]" value=""><input type="checkbox" name="item[data][verified]" value="1" ' . checked( ! empty( $val ), true, false ) . '> ' . esc_html( $label ) . '</label></p>';
				continue;
			}
			if ( is_array( $val ) ) {
				$val = 'colors' === $k ? implode( ', ', $val ) : wp_json_encode( $val, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE );
			}
			$area = in_array( $k, array( 'defaults', 'values', 'direction', 'description', 'prompt' ), true );
			echo '<p><label>' . esc_html( $label ) . '<br>' . ( $area ? '<textarea class="large-text code" rows="4" name="item[data][' . esc_attr( $k ) . ']">' . esc_textarea( (string) $val ) . '</textarea>' : '<input class="large-text" type="text" name="item[data][' . esc_attr( $k ) . ']" value="' . esc_attr( (string) $val ) . '">' ) . '</label></p>';
		}
		$img = ! empty( $cur['image_id'] ) ? wp_get_attachment_image_url( (int) $cur['image_id'], 'thumbnail' ) : '';
		echo '<p>' . esc_html__( 'Előnézeti / referenciakép', 'autogrowehome' ) . '<br><span class="agh-media"><input type="hidden" name="item[image_id]" value="' . (int) ( $cur['image_id'] ?? 0 ) . '"><img src="' . esc_url( (string) $img ) . '" alt="" ' . ( $img ? '' : 'hidden' ) . '><button type="button" class="button agh-media-pick">' . esc_html__( 'Kiválasztás', 'autogrowehome' ) . '</button> <button type="button" class="button-link agh-media-clear">' . esc_html__( 'Eltávolítás', 'autogrowehome' ) . '</button></span></p>';
		$locked = $cur && self::catalog_locked( $type, (string) $cur['slug'] );
		echo '<p><label>' . esc_html__( 'Állapot', 'autogrowehome' ) . ' ';
		if ( $locked ) {
			// Catalog::save() always keeps the mandatory brand published: no ineffective "hidden" option.
			echo '<input type="hidden" name="item[status]" value="published"><select disabled aria-describedby="agh-cat-locked"><option selected>' . esc_html__( 'Publikált', 'autogrowehome' ) . '</option></select> <span class="description" id="agh-cat-locked">' . esc_html__( 'A specifikáció szerint kötelező márka mindig publikált, nem rejthető el és nem törölhető.', 'autogrowehome' ) . '</span>';
		} else {
			echo '<select name="item[status]"><option value="published" ' . selected( $cur['status'] ?? 'published', 'published', false ) . '>' . esc_html__( 'Publikált', 'autogrowehome' ) . '</option><option value="hidden" ' . selected( $cur['status'] ?? '', 'hidden', false ) . '>' . esc_html__( 'Rejtett', 'autogrowehome' ) . '</option></select>';
		}
		echo '</label> <label>' . esc_html__( 'Sorrend', 'autogrowehome' ) . ' <input type="number" style="width:80px" name="item[sort]" value="' . (int) ( $cur['sort'] ?? 0 ) . '"></label></p>';
		submit_button( __( 'Mentés', 'autogrowehome' ) );
		echo '</form></div></div>';
	}

	/* ------------------------------------------------------------------ branding */

	public static function page_branding(): void {
		if ( ! Features::enabled( 'branding_advanced' ) ) {
			echo '<div class="notice notice-info inline"><p>' . esc_html__( 'Starter csomagban a logó, a név és a fő szín módosítható; a haladó arculati beállítások a Professional csomagtól érvényesülnek.', 'autogrowehome' ) . '</p></div>';
		}
		echo '<div class="agh-grid-2-1"><div>';
		self::settings_form( 'branding' );
		echo '</div><div><div class="agh-card agh-sticky"><h3>' . esc_html__( 'Élő előnézet', 'autogrowehome' ) . '</h3><div id="agh-brand-preview" class="agh-brand-preview"><div class="agh-bp-panel"><p class="agh-bp-eyebrow">AUTOGROWEHOME</p><h4 class="agh-bp-title">MODERN FAMILY HOME</h4><p class="agh-bp-text">' . esc_html__( 'Üvegkártya, pill gombok, állapotszínek.', 'autogrowehome' ) . '</p><div class="agh-bp-row"><span class="agh-bp-btn is-dark">' . esc_html__( 'Generálás', 'autogrowehome' ) . '</span><span class="agh-bp-btn is-primary">' . esc_html__( 'Ajánlatkérés', 'autogrowehome' ) . '</span></div><div class="agh-bp-row"><span class="agh-bp-chip is-ok">OK</span><span class="agh-bp-chip is-warn">!</span><span class="agh-bp-chip is-err">×</span></div></div></div>';
		echo '<h3>' . esc_html__( 'Korábbi designverziók', 'autogrowehome' ) . '</h3><ul class="agh-mini-list">';
		foreach ( (array) get_option( 'agh_design_history', array() ) as $i => $h ) {
			echo '<li>' . esc_html( $h['time'] ) . ' <span class="agh-sw" style="background:' . esc_attr( (string) ( $h['branding']['color_primary'] ?? '' ) ) . '"></span> <a class="agh-confirm" href="' . esc_url( Admin::action_url( 'design_restore', array( 'i' => $i ) ) ) . '">' . esc_html__( 'Visszaállítás', 'autogrowehome' ) . '</a></li>';
		}
		echo '</ul></div></div></div>';
	}

	public static function page_limits(): void {
		$st = RateLimiter::status_for_current();
		echo '<div class="agh-card"><p>' . esc_html( sprintf( /* translators: 1: day 2: limit */ __( 'Aktuális napi időszak: %1$s · effektív IP-limit (csomaggal együtt): %2$d', 'autogrowehome' ), RateLimiter::day(), RateLimiter::ip_limit() ) ) . ' · ' . esc_html( sprintf( /* translators: %d: used */ __( 'saját IP ma: %d', 'autogrowehome' ), $st['used'] ) ) . '</p></div>';
		self::settings_form( 'limits' );
	}

	public static function page_contractor(): void {
		echo '<div class="agh-card"><p><a class="button" href="' . esc_url( Admin::action_url( 'test_email' ) ) . '">' . esc_html__( 'Teszt e-mail küldése magamnak', 'autogrowehome' ) . '</a> <span class="description">' . esc_html__( 'Kivitelezői portál:', 'autogrowehome' ) . ' <code>' . esc_html( add_query_arg( 'agh-portal', '1', home_url( '/' ) ) ) . '</code> ' . esc_html__( '(a hozzáférési token csak az URL # részében utazik). WordPress-felhasználók „AutoGroweHome kivitelező” szerepkörrel bejelentkezve is elérik.', 'autogrowehome' ) . '</span></p></div>';
		self::settings_form( 'contractor' );
	}

	public static function page_legal(): void {
		echo '<div class="agh-card"><h2>' . esc_html__( 'GDPR eszközök', 'autogrowehome' ) . '</h2><p>' . esc_html__( 'A plugin regisztrálja magát a WordPress adatexportáló és -törlő eszközeiben (Eszközök → Személyes adatok exportálása / törlése). E-mail-cím alapján exportálja és anonimizálja az ajánlatkéréseket, és törli a hozzájuk tartozó csomagokat.', 'autogrowehome' ) . '</p><p><a class="button" href="' . esc_url( admin_url( 'export-personal-data.php' ) ) . '">' . esc_html__( 'Adatexport', 'autogrowehome' ) . '</a> <a class="button" href="' . esc_url( admin_url( 'erase-personal-data.php' ) ) . '">' . esc_html__( 'Adattörlés', 'autogrowehome' ) . '</a> <a class="button" href="' . esc_url( Admin::action_url( 'retention_run' ) ) . '">' . esc_html__( 'Adatmegőrzési takarítás futtatása most', 'autogrowehome' ) . '</a></p>';
		echo '<p class="description">' . esc_html__( 'Javasolt adatkezelési tájékoztató szövegrész: Tools → Privacy → Policy Guide alatt (sablon, szakértői ellenőrzés szükséges).', 'autogrowehome' ) . '</p></div>';
		self::settings_form( 'legal' );
	}

	/* ------------------------------------------------------------------ license */

	public static function page_license(): void {
		$s   = LicenseManager::state();
		$cfg = LicenseManager::config();
		echo '<div class="agh-grid-2"><div class="agh-card"><h2>' . esc_html__( 'Licencközpont', 'autogrowehome' ) . '</h2>';
		if ( Features::owner_mode() ) {
			echo '<p>' . self::badge( __( 'Tulajdonosi mód (AGH_OWNER_MODE)', 'autogrowehome' ), 'ok' ) . ' ' . esc_html__( 'Minden funkció engedélyezve, licencellenőrzés nélkül.', 'autogrowehome' ) . '</p>'; // phpcs:ignore
		}
		echo '<table class="widefat striped"><tbody>';
		$rows = array(
			__( 'Állapot', 'autogrowehome' )              => LicenseManager::status_label( $s['status'] ),
			__( 'Csomag', 'autogrowehome' )               => $s['plan'] ? ucfirst( $s['plan'] ) : '–',
			__( 'Effektív csomag', 'autogrowehome' )      => ucfirst( Features::plan() ),
			__( 'Lejárat', 'autogrowehome' )              => $s['expires_at'] ?: '–',
			__( 'Weboldalak', 'autogrowehome' )           => $s['sites_used'] . ' / ' . $s['sites_allowed'],
			__( 'Frissítési jogosultság', 'autogrowehome' ) => $s['update_entitled'] ? '✓' : '–',
			__( 'Utolsó ellenőrzés', 'autogrowehome' )    => $s['last_check'] ? wp_date( 'Y-m-d H:i', (int) $s['last_check'] ) : '–',
			__( 'Utolsó hiba', 'autogrowehome' )          => $s['last_error'] ?: '–',
			__( 'Példányazonosító', 'autogrowehome' )     => LicenseManager::instance_id(),
			__( 'API-konfiguráció', 'autogrowehome' )     => ( Secrets::has( 'magnific_api_key' ) ? 'Magnific ✓' : 'Magnific –' ) . ' · ' . ( Secrets::has( 'anthropic_api_key' ) ? 'Anthropic ✓' : 'Anthropic –' ),
		);
		foreach ( $rows as $k => $v ) {
			echo '<tr><th>' . esc_html( $k ) . '</th><td>' . esc_html( (string) $v ) . '</td></tr>';
		}
		echo '</tbody></table>';
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" style="margin-top:14px">';
		wp_nonce_field( 'agh_action_license_activate' );
		echo '<input type="hidden" name="action" value="agh_action"><input type="hidden" name="do" value="license_activate"><input type="hidden" name="back" value="agh-license">';
		echo '<input type="text" class="regular-text" name="license_key" placeholder="' . esc_attr( Secrets::mask( 'license_key' ) ?: 'XXXX-XXXX-XXXX-XXXX' ) . '"> <button class="button button-primary">' . esc_html__( 'Aktiválás', 'autogrowehome' ) . '</button> ';
		echo '<a class="button" href="' . esc_url( Admin::action_url( 'license_check' ) ) . '">' . esc_html__( 'Ellenőrzés', 'autogrowehome' ) . '</a> <a class="button agh-confirm" href="' . esc_url( Admin::action_url( 'license_deactivate' ) ) . '">' . esc_html__( 'Deaktiválás', 'autogrowehome' ) . '</a></form>';
		echo '<p class="description">' . esc_html__( 'A licenc a plugin használati jogát szabályozza; a Magnific és Anthropic díjakat a saját szolgáltatói fiókod fizeti. Lejárat vagy szerverhiba esetén a projektek és beállítások megmaradnak; 14 napos türelmi idő után a prémium funkciók kikapcsolnak.', 'autogrowehome' ) . '</p></div>';

		echo '<div class="agh-card"><h2>' . esc_html__( 'Licencszerver', 'autogrowehome' ) . '</h2><form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		wp_nonce_field( 'agh_action_license_server' );
		echo '<input type="hidden" name="action" value="agh_action"><input type="hidden" name="do" value="license_server"><input type="hidden" name="back" value="agh-license">';
		echo '<p><label>' . esc_html__( 'Szerver URL (HTTPS)', 'autogrowehome' ) . '<br><input type="url" class="large-text" name="server_url" value="' . esc_attr( $cfg['url'] ) . '"' . ( defined( 'AGH_LICENSE_SERVER' ) ? ' readonly' : '' ) . '></label></p>';
		echo '<p><label>' . esc_html__( 'Szerver nyilvános kulcsa (Ed25519, base64)', 'autogrowehome' ) . '<br><input type="text" class="large-text code" name="public_key" value="' . esc_attr( $cfg['public_key'] ) . '"' . ( defined( 'AGH_LICENSE_PUBKEY' ) ? ' readonly' : '' ) . '></label></p>';
		submit_button( __( 'Mentés', 'autogrowehome' ), 'secondary' );
		echo '</form><p class="description">' . esc_html__( 'Referencia szerver: tools/license-server/. Szerződés: docs/LICENC-ES-ELOFIZETES.md.', 'autogrowehome' ) . '</p></div></div>';

		echo self::plans_table( Admin::plans_editable() ); // phpcs:ignore WordPress.Security.EscapeOutput -- escaped inside.
	}

	/**
	 * Plan matrix. Editable form only in owner mode (shared contract 4); on
	 * customer sites a read-only table of the effective built-in plans.
	 */
	public static function plans_table( bool $editable ): string {
		$plans  = Features::plans();
		$cat    = Features::catalog();
		$urls   = (array) get_option( 'agh_checkout_urls', array() );
		$limits = array( 'sites' => __( 'Weboldalak száma', 'autogrowehome' ), 'max_ip_daily' => __( 'Max. napi IP-limit', 'autogrowehome' ), 'max_exterior_views' => __( 'Max. külső nézet', 'autogrowehome' ), 'max_interiors' => __( 'Max. belső nézet', 'autogrowehome' ) );
		$prices = array( 'month' => __( 'Havi ár / fizetési link', 'autogrowehome' ), 'year' => __( 'Éves ár / fizetési link', 'autogrowehome' ) );
		ob_start();
		if ( ! $editable ) {
			echo '<div class="agh-card"><h2>' . esc_html__( 'Csomagok (Starter / Professional / Agency)', 'autogrowehome' ) . '</h2><p class="description">' . esc_html__( 'A csomagok funkciói és limitjei rögzítettek; a csomagmátrix csak a plugin tulajdonosi példányán (AGH_OWNER_MODE) szerkeszthető.', 'autogrowehome' ) . '</p>';
			echo '<table class="widefat striped agh-plans"><thead><tr><th></th>';
			foreach ( $plans as $slug => $p ) {
				echo '<th>' . esc_html( (string) $p['label'] ) . ( Features::plan() === $slug ? ' ' . self::badge( __( 'aktív', 'autogrowehome' ), 'ok' ) : '' ) . '<br><small>' . esc_html( (string) ( $p['audience'] ?? '' ) ) . '</small></th>'; // phpcs:ignore
			}
			echo '</tr></thead><tbody>';
			foreach ( $cat as $fk => $fl ) {
				echo '<tr><td>' . esc_html( $fl ) . '</td>';
				foreach ( $plans as $p ) {
					echo '<td>' . ( in_array( $fk, (array) $p['features'], true ) ? '✓' : '–' ) . '</td>';
				}
				echo '</tr>';
			}
			foreach ( $limits + array( 'max_resolution' => __( 'Max. felbontás', 'autogrowehome' ) ) as $lk => $ll ) {
				echo '<tr><td>' . esc_html( $ll ) . '</td>';
				foreach ( $plans as $p ) {
					echo '<td>' . esc_html( (string) ( $p['limits'][ $lk ] ?? '–' ) ) . '</td>';
				}
				echo '</tr>';
			}
			foreach ( $prices as $per => $pl ) {
				echo '<tr><td>' . esc_html( $pl ) . '</td>';
				foreach ( $plans as $p ) {
					echo '<td>' . esc_html( (string) ( $p[ 'price_' . $per ] ?? '' ) ?: '–' ) . '</td>';
				}
				echo '</tr>';
			}
			echo '</tbody></table></div>';
			return (string) ob_get_clean();
		}
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" class="agh-card">';
		wp_nonce_field( 'agh_action_plans_save' );
		echo '<input type="hidden" name="action" value="agh_action"><input type="hidden" name="do" value="plans_save"><input type="hidden" name="back" value="agh-license">';
		echo '<h2>' . esc_html__( 'Csomagok (Starter / Professional / Agency)', 'autogrowehome' ) . '</h2><p class="description">' . esc_html__( 'Adatvezérelt: a funkciók, limitek, árak és fizetési linkek itt módosíthatók; az értékesítési oldal ([autogrowehome_pricing]) ezekből épül.', 'autogrowehome' ) . '</p>';
		echo '<table class="widefat agh-plans"><thead><tr><th></th>';
		foreach ( $plans as $slug => $p ) {
			echo '<th><input type="text" name="plans[' . esc_attr( $slug ) . '][label]" value="' . esc_attr( $p['label'] ) . '"><br><textarea rows="2" name="plans[' . esc_attr( $slug ) . '][audience]">' . esc_textarea( $p['audience'] ) . '</textarea></th>';
		}
		echo '</tr></thead><tbody>';
		foreach ( $cat as $fk => $fl ) {
			echo '<tr><td>' . esc_html( $fl ) . '</td>';
			foreach ( $plans as $slug => $p ) {
				echo '<td><input type="checkbox" name="plans[' . esc_attr( $slug ) . '][features][]" value="' . esc_attr( $fk ) . '" ' . checked( in_array( $fk, (array) $p['features'], true ), true, false ) . '></td>';
			}
			echo '</tr>';
		}
		foreach ( $limits as $lk => $ll ) {
			echo '<tr><td>' . esc_html( $ll ) . '</td>';
			foreach ( $plans as $slug => $p ) {
				echo '<td><input type="number" style="width:80px" name="plans[' . esc_attr( $slug ) . '][limits][' . esc_attr( $lk ) . ']" value="' . esc_attr( (string) ( $p['limits'][ $lk ] ?? '' ) ) . '"></td>';
			}
			echo '</tr>';
		}
		echo '<tr><td>' . esc_html__( 'Max. felbontás', 'autogrowehome' ) . '</td>';
		foreach ( $plans as $slug => $p ) {
			echo '<td><select name="plans[' . esc_attr( $slug ) . '][limits][max_resolution]">';
			foreach ( array( '1k', '2k', '4k' ) as $r ) {
				echo '<option ' . selected( $p['limits']['max_resolution'] ?? '2k', $r, false ) . '>' . esc_html( $r ) . '</option>';
			}
			echo '</select></td>';
		}
		echo '</tr>';
		foreach ( $prices as $per => $pl ) {
			echo '<tr><td>' . esc_html( $pl ) . '</td>';
			foreach ( $plans as $slug => $p ) {
				echo '<td><input type="text" placeholder="' . esc_attr__( 'pl. 39 € / hó', 'autogrowehome' ) . '" name="plans[' . esc_attr( $slug ) . '][price_' . esc_attr( $per ) . ']" value="' . esc_attr( (string) ( $p[ 'price_' . $per ] ?? '' ) ) . '"><br><input type="url" placeholder="https://checkout…" name="checkout[' . esc_attr( $slug ) . '][' . esc_attr( $per ) . ']" value="' . esc_attr( (string) ( $urls[ $slug ][ $per ] ?? '' ) ) . '"></td>';
			}
			echo '</tr>';
		}
		echo '</tbody></table><p class="description">' . esc_html__( 'Fizetés: a plugin nem kezel kártyaadatot; a „Megrendelés” gomb a megadott hosztolt fizetési oldalra visz (pl. Stripe Payment Link, Paddle, WooCommerce). Csak kitöltött linknél jelenik meg.', 'autogrowehome' ) . '</p>';
		submit_button( __( 'Csomagok mentése', 'autogrowehome' ) );
		echo '</form>';
		return (string) ob_get_clean();
	}

	/* ------------------------------------------------------------------ help & system */

	/**
	 * PHP extensions the plugin relies on => loaded?
	 *
	 * @return array<string,bool>
	 */
	public static function php_extensions(): array {
		return array(
			'mbstring' => extension_loaded( 'mbstring' ),
			'sodium'   => function_exists( 'sodium_crypto_secretbox' ), // Extension or the sodium_compat polyfill bundled with WordPress.
			'gd'       => function_exists( 'imagecreatetruecolor' ),
			'zip'      => class_exists( 'ZipArchive' ),
			'json'     => function_exists( 'json_encode' ),
		);
	}

	public static function page_help(): void {
		$tour = Help::tour();
		$faq  = Help::faq();
		echo '<div class="agh-grid-2"><div class="agh-card"><h2>' . esc_html__( 'Rendszerállapot', 'autogrowehome' ) . '</h2><table class="widefat striped"><tbody>';
		$health = Storage::health();
		$sys    = array(
			'PHP'       => PHP_VERSION,
			'WordPress' => get_bloginfo( 'version' ),
		);
		foreach ( self::php_extensions() as $ext => $ok ) {
			$state = $ok ? '✓ ' . _x( 'rendben', 'PHP extension status', 'autogrowehome' ) : '✗ ' . _x( 'hiányzik', 'PHP extension status', 'autogrowehome' );
			/* translators: %s: PHP extension name */
			$sys[ sprintf( __( 'PHP-kiterjesztés: %s', 'autogrowehome' ), $ext ) ] = $state;
		}
		$sys += array(
			'WP-Cron'                     => defined( 'DISABLE_WP_CRON' ) && DISABLE_WP_CRON ? __( 'kikapcsolva (valódi cron szükséges)', 'autogrowehome' ) : '✓',
			__( 'Tárhely írható', 'autogrowehome' ) => $health['writable'] ? '✓' : '✗',
			__( 'Tárhely nyilvános?', 'autogrowehome' ) => null === $health['public'] ? __( 'nem ellenőrizhető', 'autogrowehome' ) . ' (' . $health['message'] . ')' : ( $health['public'] ? __( 'IGEN – javítandó!', 'autogrowehome' ) : __( 'nem (rendben)', 'autogrowehome' ) ),
			__( 'Adatbázis-verzió', 'autogrowehome' ) => (string) get_option( 'agh_db_version' ),
			__( 'Függő feladatok', 'autogrowehome' ) => (string) JobQueue::pending_total(),
		);
		foreach ( $sys as $k => $v ) {
			echo '<tr><th>' . esc_html( $k ) . '</th><td>' . esc_html( $v ) . '</td></tr>';
		}
		echo '</tbody></table><h3>' . esc_html__( 'Nyelvi fájlok', 'autogrowehome' ) . '</h3><p>';
		foreach ( I18n::SUPPORTED as $loc => $ln ) {
			$has = 'hu_HU' === $loc || file_exists( AGH_DIR . 'languages/autogrowehome-' . $loc . '.mo' );
			echo self::badge( $ln . ( $has ? ' ✓' : ' –' ), $has ? 'ok' : 'warn' ) . ' '; // phpcs:ignore
		}
		echo '</p><p class="description">' . esc_html__( 'Forrásnyelv: magyar. Hiányzó fordításnál a magyar szöveg jelenik meg. Új fordítás: languages/autogrowehome.pot → Poedit / Loco Translate.', 'autogrowehome' ) . '</p>';
		echo '<h3>' . esc_html__( 'Dokumentáció', 'autogrowehome' ) . '</h3><p>' . esc_html__( 'A teljes dokumentáció a plugin docs/ mappájában található (telepítés, konfiguráció, admin kézikönyv, felhasználói útmutató, API, fejlesztői, biztonság, tesztjelentés).', 'autogrowehome' ) . '</p></div>';

		echo '<div class="agh-card"><h2>' . esc_html__( 'Napló', 'autogrowehome' ) . '</h2><p><a class="button agh-confirm" href="' . esc_url( Admin::action_url( 'logs_clear' ) ) . '">' . esc_html__( 'Napló törlése', 'autogrowehome' ) . '</a></p><div class="agh-log"><table class="widefat striped"><tbody>';
		foreach ( Logger::recent( 100 ) as $l ) {
			echo '<tr><td><small>' . esc_html( $l['created_at'] ) . '</small></td><td>' . self::badge( $l['level'], 'error' === $l['level'] ? 'err' : ( 'warning' === $l['level'] ? 'warn' : '' ) ) . '</td><td><small>' . esc_html( $l['channel'] ) . '</small></td><td>' . esc_html( $l['message'] ) . '</td></tr>'; // phpcs:ignore
		}
		echo '</tbody></table></div></div></div>';

		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" class="agh-card agh-help-editor">';
		wp_nonce_field( 'agh_action_help_save' );
		echo '<input type="hidden" name="action" value="agh_action"><input type="hidden" name="do" value="help_save"><input type="hidden" name="back" value="agh-help">';
		echo '<p class="description">' . esc_html__( 'A gyári gyorsbemutató és GYIK a látogató nyelvén jelenik meg (fordítható). A mentett egyedi szöveg egynyelvű: minden nyelven pontosan így látszik. A fordított gyári szövegekhez használd az „Alapértelmezés visszaállítása” gombot.', 'autogrowehome' ) . '</p>';
		echo '<h2>' . esc_html__( 'Gyorsbemutató lépései', 'autogrowehome' ) . '</h2><div class="agh-rows" data-name="tour">';
		foreach ( $tour as $i => $s ) {
			echo '<div class="agh-row"><input type="text" name="tour[' . (int) $i . '][icon]" value="' . esc_attr( $s['icon'] ) . '" style="width:90px" placeholder="icon"><input type="text" name="tour[' . (int) $i . '][title]" value="' . esc_attr( $s['title'] ) . '" class="regular-text"><textarea name="tour[' . (int) $i . '][text]" rows="2" class="large-text">' . esc_textarea( $s['text'] ) . '</textarea><button type="button" class="button-link agh-row-del">×</button></div>';
		}
		echo '</div><p><button type="button" class="button agh-row-add" data-target="tour">+ ' . esc_html__( 'Lépés', 'autogrowehome' ) . '</button></p>';
		echo '<h2>' . esc_html__( 'GYIK', 'autogrowehome' ) . '</h2><div class="agh-rows" data-name="faq">';
		foreach ( $faq as $i => $f ) {
			echo '<div class="agh-row"><input type="text" name="faq[' . (int) $i . '][cat]" value="' . esc_attr( $f['cat'] ) . '" style="width:140px" placeholder="' . esc_attr__( 'kategória', 'autogrowehome' ) . '"><input type="text" name="faq[' . (int) $i . '][q]" value="' . esc_attr( $f['q'] ) . '" class="regular-text" placeholder="' . esc_attr__( 'kérdés', 'autogrowehome' ) . '"><textarea name="faq[' . (int) $i . '][a]" rows="2" class="large-text" placeholder="' . esc_attr__( 'válasz', 'autogrowehome' ) . '">' . esc_textarea( $f['a'] ) . '</textarea><button type="button" class="button-link agh-row-del">×</button></div>';
		}
		echo '</div><p><button type="button" class="button agh-row-add" data-target="faq">+ ' . esc_html__( 'Kérdés', 'autogrowehome' ) . '</button> <a class="button agh-confirm" href="' . esc_url( Admin::action_url( 'help_reset' ) ) . '">' . esc_html__( 'Alapértelmezés visszaállítása', 'autogrowehome' ) . '</a></p>';
		submit_button( __( 'Súgótartalom mentése', 'autogrowehome' ) );
		echo '</form>';
	}
}
