<?php
/**
 * REST API (namespace agh/v1).
 *
 * Every route has an explicit permission callback; state-changing public
 * routes require the X-AGH-Nonce header; API keys never appear in responses.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\Rest;

use AutoGroweHome\Ai\Providers;
use AutoGroweHome\Frontend\Frontend;
use AutoGroweHome\Generation\JobQueue;
use AutoGroweHome\Generation\Pipeline;
use AutoGroweHome\Generation\Planner;
use AutoGroweHome\Installer;
use AutoGroweHome\License\Features;
use AutoGroweHome\Params\RoomProgram;
use AutoGroweHome\Params\Validator;
use AutoGroweHome\Projects\Repository;
use AutoGroweHome\Prompt\PromptEngine;
use AutoGroweHome\Quote\AccessTokens;
use AutoGroweHome\Quote\QuoteService;
use AutoGroweHome\RateLimit\RateLimiter;
use AutoGroweHome\Stats\Stats;
use AutoGroweHome\Support\Ip;
use AutoGroweHome\Support\Logger;
use AutoGroweHome\Support\Settings;
use AutoGroweHome\Support\Storage;
use AutoGroweHome\Support\Util;

defined( 'ABSPATH' ) || exit;

final class RestController {

	public static function register(): void {
		$ns     = AGH_REST_NS;
		$public = '__return_true';
		$front  = array( Access::class, 'check_front_nonce' );
		$uuid   = '(?P<id>[0-9a-fA-F-]{36})';

		register_rest_route( $ns, '/bootstrap', array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'bootstrap' ), 'permission_callback' => $public ) );
		register_rest_route( $ns, '/validate', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'validate' ), 'permission_callback' => $front ) );
		register_rest_route( $ns, '/rooms/auto', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'rooms_auto' ), 'permission_callback' => $front ) );
		register_rest_route( $ns, '/interpret', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'interpret' ), 'permission_callback' => $front ) );
		register_rest_route( $ns, '/generate', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'generate' ), 'permission_callback' => $front ) );
		register_rest_route( $ns, '/projects', array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'my_projects' ), 'permission_callback' => $public ) );
		register_rest_route(
			$ns,
			'/projects/' . $uuid,
			array(
				array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'project' ), 'permission_callback' => $public ),
				array( 'methods' => 'DELETE', 'callback' => array( __CLASS__, 'delete_project' ), 'permission_callback' => $front ),
			)
		);
		register_rest_route( $ns, '/projects/' . $uuid . '/select', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'select' ), 'permission_callback' => $front ) );
		register_rest_route( $ns, '/projects/' . $uuid . '/save', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'save' ), 'permission_callback' => $front ) );
		register_rest_route( $ns, '/projects/' . $uuid . '/regenerate', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'regenerate' ), 'permission_callback' => $front ) );
		register_rest_route( $ns, '/projects/' . $uuid . '/cancel', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'cancel' ), 'permission_callback' => $front ) );
		register_rest_route( $ns, '/projects/' . $uuid . '/quote', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'quote' ), 'permission_callback' => $front ) );
		register_rest_route( $ns, '/projects/' . $uuid . '/quote-token', array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'quote_token' ), 'permission_callback' => $front ) );
		register_rest_route( $ns, '/assets/' . $uuid . '/file', array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'asset_file' ), 'permission_callback' => $public ) );
		register_rest_route( $ns, '/events', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'event' ), 'permission_callback' => $front ) );
		register_rest_route( $ns, '/presets', array( 'methods' => array( 'GET', 'POST' ), 'callback' => array( __CLASS__, 'user_presets' ), 'permission_callback' => static fn() => is_user_logged_in() ) );

		register_rest_route( $ns, '/contractor/session', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'contractor_session' ), 'permission_callback' => $public ) );
		register_rest_route( $ns, '/contractor/logout', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'contractor_logout' ), 'permission_callback' => $public ) );
		register_rest_route( $ns, '/contractor/projects', array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'contractor_projects' ), 'permission_callback' => $public ) );
		register_rest_route( $ns, '/contractor/package/' . $uuid, array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'contractor_package' ), 'permission_callback' => $public ) );

		register_rest_route( $ns, '/webhook/magnific/(?P<token>[a-f0-9]{32})', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'webhook' ), 'permission_callback' => $public ) );

		$admin = static fn() => current_user_can( 'agh_manage' );
		register_rest_route( $ns, '/admin/test-provider', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'admin_test_provider' ), 'permission_callback' => $admin ) );
		register_rest_route( $ns, '/admin/prompt/preview', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'admin_prompt_preview' ), 'permission_callback' => $admin ) );
		register_rest_route( $ns, '/admin/prompt/test', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'admin_prompt_test' ), 'permission_callback' => $admin ) );
		register_rest_route( $ns, '/admin/stats', array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'admin_stats' ), 'permission_callback' => static fn() => current_user_can( 'agh_view_stats' ) ) );
		register_rest_route( $ns, '/admin/queue/run', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'admin_queue_run' ), 'permission_callback' => $admin ) );
	}

	private static function error( string $code, string $message, int $status = 400, array $extra = array() ): \WP_REST_Response {
		return new \WP_REST_Response( array_merge( array( 'code' => $code, 'message' => $message ), $extra ), $status );
	}

	private static function nocache( \WP_REST_Response $r ): \WP_REST_Response {
		$r->header( 'Cache-Control', 'no-store, private' );
		return $r;
	}

	/* ------------------------------------------------------------------ public */

	public static function bootstrap( \WP_REST_Request $r ): \WP_REST_Response {
		$lang = sanitize_text_field( (string) $r->get_param( 'lang' ) );
		if ( '' !== $lang && Features::enabled( 'multilang' ) ) {
			\AutoGroweHome\Frontend\I18n::switch_to( $lang );
			\AutoGroweHome\Params\Registry::reset();
		}
		$data = Frontend::bootstrap_data();
		// Visitor-bound X-AGH-Nonce. For a guest this also creates the guest
		// cookie (first visit) or renews it (sliding expiry), see Access.
		$data['nonce'] = Access::front_nonce( true );
		return self::nocache( new \WP_REST_Response( $data ) );
	}

	public static function validate( \WP_REST_Request $r ): \WP_REST_Response {
		$c = Validator::sanitize( $r->get_param( 'config' ) );
		return new \WP_REST_Response( array( 'config' => $c, 'check' => Validator::check( $c ) ) );
	}

	public static function rooms_auto( \WP_REST_Request $r ): \WP_REST_Response {
		$c = Validator::sanitize( $r->get_param( 'config' ) );
		return new \WP_REST_Response( array( 'rooms' => RoomProgram::auto( $c ) ) );
	}

	public static function interpret( \WP_REST_Request $r ): \WP_REST_Response {
		if ( ! RateLimiter::reserve_custom( Ip::hash(), 'interpret', 15 ) ) {
			return self::error( 'agh_limit', __( 'Ma már elérted az AI-értelmezések keretét.', 'autogrowehome' ), 429 );
		}
		$c   = Validator::sanitize( $r->get_param( 'config' ) );
		$res = Planner::interpret( $c );
		if ( ! empty( $res['usage'] ) ) {
			$cost = ( $res['usage']['in'] ?? 0 ) / 1e6 * (float) Settings::get( 'costs.anthropic_in_mtok', 0 ) + ( $res['usage']['out'] ?? 0 ) / 1e6 * (float) Settings::get( 'costs.anthropic_out_mtok', 0 );
			Stats::ledger( 'anthropic', 'interpret', $cost );
		}
		if ( ! $res['ok'] ) {
			return self::error( 'agh_interpret', $res['error'], 503 );
		}
		return new \WP_REST_Response( $res );
	}

	public static function generate( \WP_REST_Request $r ): \WP_REST_Response {
		if ( ! Features::enabled( 'designer' ) || ! Features::enabled( 'three_concepts' ) ) {
			return self::error( 'agh_feature', __( 'A generálás ebben a csomagban nem érhető el.', 'autogrowehome' ), 403 );
		}
		$status = Providers::status();
		if ( ! $status['image_ready'] ) {
			return self::error( 'agh_not_configured', __( 'A képgeneráló szolgáltatás még nincs beállítva. Kérjük, próbáld később.', 'autogrowehome' ), 503 );
		}
		$c     = Validator::sanitize( $r->get_param( 'config' ) );
		$check = Validator::check( $c );
		if ( ! empty( $check['errors'] ) ) {
			return self::error( 'agh_invalid', __( 'Néhány beállítás javításra szorul.', 'autogrowehome' ), 422, array( 'check' => $check ) );
		}
		$user_id    = get_current_user_id();
		$guest_hash = $user_id > 0 ? '' : Access::guest_hash( true );
		$ip_hash    = Ip::hash();

		// Duplicate request / cache: identical configuration recently generated by the same owner.
		$hash = Repository::config_hash( $c );
		$dup  = Repository::find_recent_same( $hash, $user_id, $guest_hash, max( (int) Settings::get( 'limits.dedupe_minutes', 20 ), (int) Settings::get( 'limits.cache_hours', 72 ) * 60 ) );
		if ( $dup && ! $r->get_param( 'force' ) ) {
			return new \WP_REST_Response( array( 'project' => $dup['uuid'], 'reused' => true, 'message' => __( 'Ezzel a beállítással már készült terv – azt nyitottuk meg (nem vont le keretet).', 'autogrowehome' ) ) );
		}

		// Concurrency per IP.
		global $wpdb;
		$t       = Installer::table( 'projects' );
		// Only projects that still have live work count: an orphaned "running"
		// project (worker killed) must not lock the visitor out for an hour.
		$running = 0;
		foreach ( (array) $wpdb->get_col( $wpdb->prepare( "SELECT id FROM {$t} WHERE ip_hash = %s AND status IN ('queued','planning','rendering') AND created_at > %s", $ip_hash, gmdate( 'Y-m-d H:i:s', time() - HOUR_IN_SECONDS ) ) ) as $rid ) { // phpcs:ignore
			$rp = Repository::project_by_id( (int) $rid );
			if ( $rp && ! JobQueue::recover_orphan( $rp ) ) {
				$running++;
			}
		}
		if ( $running >= max( 1, (int) Settings::get( 'limits.concurrent_per_ip', 1 ) ) && ! current_user_can( 'agh_manage' ) ) {
			Stats::inc( 'limit_hit', 'concurrent' );
			return self::error( 'agh_limit', RateLimiter::message( 'concurrent' ), 429 );
		}

		// Budget.
		$estimate = 3 * Stats::cost_of( 'mystic_2k' );
		if ( ! Stats::budget_allows( $estimate ) ) {
			Stats::inc( 'limit_hit', 'budget' );
			return self::error( 'agh_budget', RateLimiter::message( 'budget' ), 429 );
		}

		$res = current_user_can( 'agh_manage' ) && $r->get_param( 'admin_test' ) ? array( 'ok' => true, 'reserved' => array() ) : RateLimiter::reserve( $ip_hash, $user_id );
		if ( ! $res['ok'] ) {
			Stats::inc( 'limit_hit', $res['failed'] ?? '' );
			return self::error( 'agh_limit', RateLimiter::message( (string) $res['failed'] ), 429, array( 'limits' => RateLimiter::status_for_current() ) );
		}
		$project = Pipeline::start(
			$c,
			array(
				'user_id'    => $user_id,
				'guest_hash' => $guest_hash,
				'ip_hash'    => $ip_hash,
				'lang'       => determine_locale(),
				'reserved'   => $res['reserved'],
			)
		);
		Stats::inc( 'generate_request' );
		foreach ( (array) ( $c['_explicit'] ?? array() ) as $f ) {
			Stats::inc( 'param', $f );
		}
		return new \WP_REST_Response( array( 'project' => $project['uuid'], 'reused' => false, 'limits' => RateLimiter::status_for_current(), 'test_mode' => $status['image_is_test'] ), 202 );
	}

	private static function load_owned( string $uuid ): ?array {
		$p = Repository::project_by_uuid( $uuid );
		if ( ! $p || 'deleted' === $p['status'] ) {
			return null;
		}
		if ( Access::is_owner( $p ) || Access::is_staff() ) {
			return $p;
		}
		return null;
	}

	public static function asset_url( array $a, string $size = 'preview', bool $download = false ): string {
		$args = array( 'size' => $size );
		if ( $download ) {
			$args['dl'] = 1;
		}
		if ( is_user_logged_in() ) {
			$args['_wpnonce'] = wp_create_nonce( 'wp_rest' );
		}
		// Relative URL: same origin as the page, so the visitor's cookies always apply.
		return add_query_arg( $args, wp_make_link_relative( rest_url( AGH_REST_NS . '/assets/' . $a['uuid'] . '/file' ) ) );
	}

	/**
	 * Can the client (owner) see this asset?
	 */
	private static function client_visible( array $a, array $p ): bool {
		if ( ! self::feature_allows( $a ) ) {
			return false;
		}
		if ( 'render' === $a['kind'] ) {
			return 'hero' === $a['view'] || Settings::get( 'access.client_gallery_previews', true );
		}
		if ( 'plan' === $a['kind'] ) {
			return 'client' === $a['access_level'];
		}
		return false;
	}

	/**
	 * Server-side feature gates for delivering existing files (e.g. after a
	 * licence downgrade): concept drawings need "floorplans", the DXF export
	 * needs "export_advanced". Staff always passes (checked by the callers).
	 */
	public static function feature_allows( array $a ): bool {
		if ( 'plan' === $a['kind'] ) {
			return Features::enabled( 'floorplans' );
		}
		if ( 'doc' === $a['kind'] && 'dxf' === $a['view'] ) {
			return Features::enabled( 'export_advanced' );
		}
		return true;
	}

	public static function project_payload( array $p, string $audience = 'client' ): array {
		$concepts = array();
		$selected = (int) $p['selected_concept_id'];
		foreach ( Repository::concepts( $p['id'] ) as $c ) {
			$assets = array();
			$hero   = null;
			foreach ( Repository::assets( $p['id'], $c['id'] ) as $a ) {
				if ( 'client' === $audience && ! self::client_visible( $a, $p ) ) {
					continue;
				}
				if ( 'contractor' === $audience && ! Access::is_staff() && ! self::feature_allows( $a ) ) {
					continue;
				}
				$pub = Repository::public_asset( $a, 'client' !== $audience );
				if ( 'done' === $a['status'] && '' !== $a['file_path'] ) {
					$pub['preview'] = self::asset_url( $a, 'preview' );
					$can_full       = 'client' !== $audience || ( 'hero' === $a['view'] && $selected === $c['id'] && in_array( Settings::get( 'access.client_download', 'hero' ), array( 'hero', 'all' ), true ) && Features::enabled( 'hero_download' ) ) || ( 'all' === Settings::get( 'access.client_download' ) );
					if ( $can_full ) {
						$pub['download'] = self::asset_url( $a, 'full', true );
					}
				}
				if ( 'hero' === $a['view'] && 'render' === $a['kind'] ) {
					$hero = $pub;
				} else {
					$assets[] = $pub;
				}
			}
			$b          = $c['brief'];
			$m          = $c['building'];
			$concepts[] = array(
				'id'              => $c['uuid'],
				'variant'         => $c['variant'],
				'title'           => $c['title'],
				'tagline'         => (string) ( $b['tagline'] ?? '' ),
				'differentiation' => (string) ( $b['differentiation'] ?? '' ),
				'warnings'        => array_values( (array) ( $b['warnings'] ?? array() ) ),
				'palette'         => array_values( (array) ( $b['palette'] ?? array() ) ),
				'planner'         => (string) ( $b['planner'] ?? '' ),
				'status'          => $c['status'],
				'gallery_status'  => $c['gallery_status'],
				'selected'        => $selected === $c['id'],
				'hero'            => $hero,
				'assets'          => $assets,
				'metrics'         => array(
					'width'       => $m['width'] ?? 0,
					'length'      => $m['length'] ?? 0,
					'net_planned' => $m['checks']['net_planned'] ?? 0,
					'footprint'   => $m['checks']['footprint'] ?? 0,
					'ridge'       => $m['roof']['ridge_height'] ?? 0,
					'shape'       => $m['shape'] ?? '',
					'rooms'       => count( (array) ( $m['rooms'] ?? array() ) ),
				),
			);
		}
		global $wpdb;
		$qt    = Installer::table( 'quotes' );
		$quote = $wpdb->get_row( $wpdb->prepare( "SELECT uuid, status, created_at FROM {$qt} WHERE project_id = %d ORDER BY id DESC LIMIT 1", $p['id'] ), ARRAY_A ); // phpcs:ignore
		return array(
			'id'        => $p['uuid'],
			'name'      => $p['name'],
			'status'    => $p['status'],
			'stage'     => $p['stage'],
			'saved'     => (bool) $p['saved'],
			'created'   => $p['created_at'],
			'config'    => $p['config'],
			'progress'  => Pipeline::progress( $p ),
			'concepts'  => $concepts,
			'quote'     => $quote ?: null,
			'disclaimer'=> __( 'A látványtervek AI-val készült koncepciók; a tervvázlatok nem engedélyezési vagy kiviteli dokumentációk.', 'autogrowehome' ),
		);
	}

	public static function project( \WP_REST_Request $r ): \WP_REST_Response {
		$p = self::load_owned( (string) $r['id'] );
		if ( ! $p ) {
			return self::error( 'agh_not_found', __( 'A projekt nem található.', 'autogrowehome' ), 404 );
		}
		if ( JobQueue::recover_orphan( $p ) ) {
			$p = Repository::project_by_id( $p['id'] );
		}
		if ( Settings::get( 'general.queue_tick_on_poll', true ) && in_array( $p['status'], array( 'queued', 'planning', 'rendering', 'ready', 'partial' ), true ) ) {
			if ( self::can_finish_early() ) {
				// The poll answers at once; the queue runs after the response
				// has been sent, so a slow provider call never blocks the visitor.
				register_shutdown_function( array( __CLASS__, 'poll_tick_after_response' ) );
			} else {
				JobQueue::poll_tick( 8.0 );
				$p = Repository::project_by_id( $p['id'] );
			}
		}
		return self::nocache( new \WP_REST_Response( self::project_payload( $p ) ) );
	}

	/** True when the server can close the HTTP response and keep running (PHP-FPM, LiteSpeed). */
	private static function can_finish_early(): bool {
		return function_exists( 'fastcgi_finish_request' ) || function_exists( 'litespeed_finish_request' );
	}

	/** Shutdown callback of project(): flush the response, then run one queue tick. */
	public static function poll_tick_after_response(): void {
		if ( function_exists( 'fastcgi_finish_request' ) ) {
			fastcgi_finish_request();
		} elseif ( function_exists( 'litespeed_finish_request' ) ) {
			litespeed_finish_request();
		}
		try {
			JobQueue::poll_tick( 8.0 );
		} catch ( \Throwable $e ) {
			Logger::error( 'queue', 'Poll tick: ' . $e->getMessage() );
		}
	}

	public static function my_projects( \WP_REST_Request $r ): \WP_REST_Response {
		Access::touch_guest();
		$items = Repository::projects_for_owner( get_current_user_id(), get_current_user_id() > 0 ? '' : Access::guest_hash() );
		$out   = array();
		foreach ( $items as $i ) {
			$out[] = array( 'id' => $i['uuid'], 'name' => $i['name'], 'status' => $i['status'], 'saved' => (bool) $i['saved'], 'created' => $i['created_at'], 'has_quote' => Repository::has_quote( (int) $i['id'] ) );
		}
		return self::nocache( new \WP_REST_Response( array( 'items' => $out ) ) );
	}

	public static function select( \WP_REST_Request $r ): \WP_REST_Response {
		$p = self::load_owned( (string) $r['id'] );
		if ( ! $p ) {
			return self::error( 'agh_not_found', __( 'A projekt nem található.', 'autogrowehome' ), 404 );
		}
		$c = Repository::concept_by_uuid( (string) $r->get_param( 'concept' ) );
		if ( ! $c || $c['project_id'] !== $p['id'] ) {
			return self::error( 'agh_bad_concept', __( 'Ismeretlen változat.', 'autogrowehome' ) );
		}
		$first = 0 === (int) $p['selected_concept_id'];
		Repository::update_project( $p['id'], array( 'selected_concept_id' => $c['id'] ) );
		if ( 'none' === $c['gallery_status'] ) {
			$hero_done = false;
			foreach ( Repository::assets( $p['id'], $c['id'] ) as $a ) {
				if ( 'hero' === $a['view'] && 'done' === $a['status'] ) {
					$hero_done = true;
				}
			}
			if ( $hero_done ) {
				Pipeline::enqueue_gallery( Repository::project_by_id( $p['id'] ), $c );
			} else {
				Repository::update_concept( $c['id'], array( 'gallery_status' => 'pending' ) );
			}
			Repository::update_project( $p['id'], array( 'stage' => 'gallery' ) );
		}
		if ( $first ) {
			Stats::inc( 'design_complete' );
		}
		return new \WP_REST_Response( self::project_payload( Repository::project_by_id( $p['id'] ) ) );
	}

	public static function save( \WP_REST_Request $r ): \WP_REST_Response {
		if ( ! Features::enabled( 'project_save' ) ) {
			return self::error( 'agh_feature', __( 'A projektmentés nem érhető el.', 'autogrowehome' ), 403 );
		}
		$p = self::load_owned( (string) $r['id'] );
		if ( ! $p ) {
			return self::error( 'agh_not_found', __( 'A projekt nem található.', 'autogrowehome' ), 404 );
		}
		$name = Util::clean_text( $r->get_param( 'name' ) ?? $p['name'], 120 );
		if ( ! $p['saved'] ) {
			Stats::inc( 'project_saved' );
		}
		Access::touch_guest(); // A saved guest project is reachable only through the guest cookie.
		Repository::update_project( $p['id'], array( 'saved' => 1, 'name' => $name ) );
		return new \WP_REST_Response( array( 'ok' => true, 'id' => $p['uuid'], 'name' => $name ) );
	}

	public static function regenerate( \WP_REST_Request $r ): \WP_REST_Response {
		$p = self::load_owned( (string) $r['id'] );
		if ( ! $p ) {
			return self::error( 'agh_not_found', __( 'A projekt nem található.', 'autogrowehome' ), 404 );
		}
		$c = Repository::concept_by_uuid( (string) $r->get_param( 'concept' ) );
		if ( ! $c || $c['project_id'] !== $p['id'] ) {
			return self::error( 'agh_bad_concept', __( 'Ismeretlen változat.', 'autogrowehome' ) );
		}
		if ( ! Features::enabled( 'designer' ) || ! Features::enabled( 'three_concepts' ) ) {
			return self::error( 'agh_feature', __( 'A generálás ebben a csomagban nem érhető el.', 'autogrowehome' ), 403 );
		}
		if ( ! Providers::status()['image_ready'] ) {
			return self::error( 'agh_not_configured', __( 'A képgeneráló szolgáltatás még nincs beállítva. Kérjük, próbáld később.', 'autogrowehome' ), 503 );
		}
		// Budget: one new hero image.
		if ( ! Stats::budget_allows( Stats::cost_of( 'mystic_2k' ) ) ) {
			Stats::inc( 'limit_hit', 'budget' );
			return self::error( 'agh_budget', RateLimiter::message( 'budget' ), 429 );
		}
		// A single-concept rebuild uses its own daily allowance
		// (limits.gallery_rebuilds_per_day per IP and per user), not a full
		// three-concept generation unit.
		$res = RateLimiter::reserve( Ip::hash(), get_current_user_id(), 'gallery' );
		if ( ! $res['ok'] ) {
			Stats::inc( 'limit_hit', (string) $res['failed'] );
			return self::error( 'agh_limit', RateLimiter::message( (string) $res['failed'] ), 429, array( 'limits' => RateLimiter::status_for_current() ) );
		}
		// Everything up to queueing the render job is free of provider cost:
		// on any failure in this part the reserved rebuild unit is given back.
		try {
			// Optional parameter changes for this concept: rebuild geometry & drawings.
			$changes = $r->get_param( 'config' );
			if ( is_array( $changes ) ) {
				$cfg = Validator::sanitize( array_merge( $p['config'], $changes ) );
				$chk = Validator::check( $cfg );
				if ( ! empty( $chk['errors'] ) ) {
					RateLimiter::release( $res['reserved'] );
					return self::error( 'agh_invalid', __( 'Néhány beállítás javításra szorul.', 'autogrowehome' ), 422, array( 'check' => $chk ) );
				}
				Repository::update_project( $p['id'], array( 'config' => $cfg ) );
				$p        = Repository::project_by_id( $p['id'] );
				$building = \AutoGroweHome\Generation\BuildingModel::build( $cfg, $c['variant'], (array) ( $c['brief']['room_areas'] ?? array() ) );
				Repository::update_concept( $c['id'], array( 'building' => $building, 'revision' => $c['revision'] + 1 ) );
				$c = Repository::concept( $c['id'] );
				foreach ( Repository::assets( $p['id'], $c['id'] ) as $a ) {
					if ( in_array( $a['kind'], array( 'plan', 'doc' ), true ) ) {
						$wpdb_t = Installer::table( 'assets' );
						global $wpdb;
						$wpdb->delete( $wpdb_t, array( 'id' => $a['id'] ) );
					}
				}
				Pipeline::documents( $p, $c );
			}
			// Retire previous renders of this concept (kept as older versions).
			$version = 1;
			foreach ( Repository::assets( $p['id'], $c['id'] ) as $a ) {
				if ( 'render' === $a['kind'] ) {
					$version = max( $version, $a['version'] + 1 );
					if ( in_array( $a['status'], array( 'queued', 'running' ), true ) ) {
						Repository::update_asset( $a['id'], array( 'status' => 'cancelled' ) );
					} else {
						Repository::update_asset( $a['id'], array( 'status' => 'archived', 'access_level' => 'admin' ) );
					}
				}
			}
			$built = PromptEngine::build( $p['config'], $c, 'hero', null, (int) $p['prompt_version'] );
			$asset = Repository::create_asset(
				array(
					'project_id'   => $p['id'],
					'concept_id'   => $c['id'],
					'kind'         => 'render',
					'view'         => 'hero',
					'label'        => __( 'Fő látványterv', 'autogrowehome' ),
					'prompt'       => PromptEngine::combined( $built ),
					'access_level' => 'client',
					'version'      => $version,
				)
			);
			Repository::update_concept( $c['id'], array( 'status' => 'planned', 'gallery_status' => (int) $p['selected_concept_id'] === $c['id'] ? 'pending' : 'none' ) );
			Repository::update_project( $p['id'], array( 'status' => 'rendering', 'stage' => 'exterior' ) );
			// The rebuild unit travels with the render job: if the new main image
			// fails without any cost, the Pipeline gives back exactly this unit
			// (once) – never the project's original generation unit.
			JobQueue::push( 'render', $p['id'], array( 'op' => 'hero', 'regenerate' => true, 'reserved' => $res['reserved'] ), 2, $asset['id'], 0, 1 + (int) Settings::get( 'limits.auto_retry_max', 2 ) );
		} catch ( \Throwable $e ) {
			RateLimiter::release( $res['reserved'] );
			Logger::error( 'rest', 'Regenerate failed: ' . $e->getMessage(), array(), (int) $p['id'] );
			return self::error( 'agh_error', __( 'Az újragenerálás nem indítható el. Kérjük, próbáld újra később.', 'autogrowehome' ), 500 );
		}
		JobQueue::spawn();
		Stats::inc( 'generate_request', 'regenerate' );
		return new \WP_REST_Response( self::project_payload( Repository::project_by_id( $p['id'] ) ), 202 );
	}

	public static function cancel( \WP_REST_Request $r ): \WP_REST_Response {
		$p = self::load_owned( (string) $r['id'] );
		if ( ! $p ) {
			return self::error( 'agh_not_found', __( 'A projekt nem található.', 'autogrowehome' ), 404 );
		}
		$n = JobQueue::cancel_project( $p['id'] );
		foreach ( Repository::assets( $p['id'] ) as $a ) {
			if ( 'queued' === $a['status'] ) {
				Repository::update_asset( $a['id'], array( 'status' => 'cancelled' ) );
			}
		}
		Pipeline::after_asset( $p['id'], 0, '' );
		$p = Repository::project_by_id( $p['id'] );
		if ( in_array( $p['status'], array( 'queued', 'planning', 'rendering' ), true ) ) {
			// Cancelled during the concept phase: 'cancelled' when no concept has a
			// finished main image (nothing usable – the Pipeline never finalises
			// such a project later), otherwise 'partial' so the finished concepts
			// stay selectable.
			$heroes_done = 0;
			foreach ( Repository::concepts( $p['id'] ) as $concept ) {
				$hero_done = false;
				foreach ( Repository::assets( $p['id'], $concept['id'] ) as $a ) {
					if ( 'render' === $a['kind'] && 'hero' === $a['view'] && 'done' === $a['status'] ) {
						$hero_done = true;
					}
				}
				if ( $hero_done ) {
					$heroes_done++;
				} elseif ( 'pending' === $concept['gallery_status'] ) {
					// The gallery waited for this (now cancelled) main image.
					Repository::update_concept( $concept['id'], array( 'gallery_status' => 'none' ) );
				}
			}
			Repository::update_project( $p['id'], array( 'status' => $heroes_done > 0 ? 'partial' : 'cancelled', 'stage' => 'done' ) );
		}
		return new \WP_REST_Response( array( 'ok' => true, 'cancelled_jobs' => $n ) );
	}

	public static function delete_project( \WP_REST_Request $r ): \WP_REST_Response {
		$p = self::load_owned( (string) $r['id'] );
		if ( ! $p ) {
			return self::error( 'agh_not_found', __( 'A projekt nem található.', 'autogrowehome' ), 404 );
		}
		// Refuses projects with a quote request (409); otherwise removes jobs,
		// contractor links, rows and the project's private files.
		$res = Repository::delete_project_safe( $p['id'] );
		if ( is_wp_error( $res ) ) {
			$data = (array) $res->get_error_data();
			return self::error( $res->get_error_code(), $res->get_error_message(), (int) ( $data['status'] ?? 409 ) );
		}
		return new \WP_REST_Response( array( 'ok' => true ) );
	}

	public static function quote( \WP_REST_Request $r ): \WP_REST_Response {
		if ( ! Features::enabled( 'contractor_email' ) ) {
			return self::error( 'agh_feature', __( 'Az ajánlatkérés ebben a csomagban nem érhető el.', 'autogrowehome' ), 403 );
		}
		$p = self::load_owned( (string) $r['id'] );
		if ( ! $p ) {
			return self::error( 'agh_not_found', __( 'A projekt nem található.', 'autogrowehome' ), 404 );
		}
		Access::touch_guest();
		$raw = (array) $r->get_json_params();
		$res = QuoteService::submit( $p, $raw );
		if ( ! $res['ok'] ) {
			return self::error( 'agh_quote_invalid', __( 'Kérjük, ellenőrizd az űrlapot.', 'autogrowehome' ), 422, array( 'errors' => $res['errors'] ) );
		}
		return new \WP_REST_Response( array( 'ok' => true, 'quote' => $res['quote']['uuid'], 'message' => __( 'Köszönjük! Ajánlatkérésedet rögzítettük, a kivitelező értesítése folyamatban.', 'autogrowehome' ) ), 201 );
	}

	/**
	 * Signed timestamp for the quote form (shared contract 2): requested when
	 * the form opens and sent back as "form_token" on submit; QuoteService
	 * rejects submissions faster than 3 s or older than 2 h.
	 */
	public static function quote_token( \WP_REST_Request $r ): \WP_REST_Response {
		if ( ! Features::enabled( 'contractor_email' ) ) {
			return self::error( 'agh_feature', __( 'Az ajánlatkérés ebben a csomagban nem érhető el.', 'autogrowehome' ), 403 );
		}
		$p = self::load_owned( (string) $r['id'] );
		if ( ! $p ) {
			return self::error( 'agh_not_found', __( 'A projekt nem található.', 'autogrowehome' ), 404 );
		}
		return self::nocache( new \WP_REST_Response( array( 'token' => QuoteService::form_token( $p['uuid'] ) ) ) );
	}

	public static function event( \WP_REST_Request $r ): \WP_REST_Response {
		$type = sanitize_key( (string) $r->get_param( 'type' ) );
		if ( in_array( $type, array( 'popup_open', 'design_start' ), true ) && RateLimiter::reserve_custom( Ip::hash(), 'ev_' . $type, 50 ) ) {
			Stats::inc( $type );
		}
		return new \WP_REST_Response( array( 'ok' => true ) );
	}

	public static function user_presets( \WP_REST_Request $r ): \WP_REST_Response {
		$uid = get_current_user_id();
		if ( 'POST' === $r->get_method() ) {
			if ( ! Access::check_front_nonce( $r ) ) {
				return self::error( 'agh_nonce', 'Invalid nonce', 403 );
			}
			$list = array();
			foreach ( array_slice( (array) $r->get_param( 'presets' ), 0, 20 ) as $p ) {
				if ( ! is_array( $p ) ) {
					continue;
				}
				$list[] = array(
					'name'   => Util::clean_text( $p['name'] ?? '', 80 ),
					'values' => Validator::sanitize( (array) ( $p['values'] ?? array() ) ),
				);
			}
			update_user_meta( $uid, 'agh_presets', $list );
		}
		return self::nocache( new \WP_REST_Response( array( 'presets' => (array) get_user_meta( $uid, 'agh_presets', true ) ) ) );
	}

	/* ------------------------------------------------------------------ files */

	/**
	 * File access decision (staff, contractor scope, or owner within client rules).
	 */
	public static function asset_permission( array $a, array $p, string $size ): bool {
		if ( Access::is_staff() ) {
			return true;
		}
		if ( Access::contractor_can( $p['id'] ) ) {
			return self::feature_allows( $a );
		}
		if ( ! Access::is_owner( $p ) || ! self::client_visible( $a, $p ) ) {
			return false;
		}
		if ( 'preview' === $size || 'plan' === $a['kind'] ) {
			return true;
		}
		$mode = (string) Settings::get( 'access.client_download', 'hero' );
		return 'all' === $mode || ( 'hero' === $mode && 'hero' === $a['view'] && (int) $p['selected_concept_id'] === $a['concept_id'] && Features::enabled( 'hero_download' ) );
	}

	public static function asset_file( \WP_REST_Request $r ) {
		$a = Repository::asset_by_uuid( (string) $r['id'] );
		if ( ! $a || 'done' !== $a['status'] ) {
			return self::error( 'agh_not_found', 'Not found', 404 );
		}
		$p = Repository::project_by_id( $a['project_id'] );
		if ( ! $p ) {
			return self::error( 'agh_not_found', 'Not found', 404 );
		}
		$size    = 'full' === $r->get_param( 'size' ) ? 'full' : 'preview';
		$allowed = self::asset_permission( $a, $p, $size );
		if ( ! $allowed ) {
			return self::error( 'agh_forbidden', __( 'Nincs jogosultságod ehhez a fájlhoz.', 'autogrowehome' ), 403 );
		}
		$rel  = 'preview' === $size && '' !== $a['preview_path'] ? $a['preview_path'] : $a['file_path'];
		$path = Storage::path( $rel );
		if ( '' === $path || ! is_readable( $path ) ) {
			return self::error( 'agh_not_found', 'File missing', 404 );
		}
		$mime = 'preview' === $size && '' !== $a['preview_path'] ? 'image/jpeg' : $a['mime'];
		$name = Util::slugify_filename( substr( $p['uuid'], 0, 8 ) . '-' . $a['view'] ) . '.' . strtolower( pathinfo( $path, PATHINFO_EXTENSION ) );
		if ( $r->get_param( 'dl' ) && 'hero' === $a['view'] && Access::is_owner( $p ) ) {
			Stats::inc( 'hero_download' );
		}
		self::stream( $path, $mime, $name, (bool) $r->get_param( 'dl' ) );
		exit;
	}

	private static function stream( string $path, string $mime, string $filename, bool $attachment ): void {
		while ( ob_get_level() > 0 ) {
			ob_end_clean();
		}
		nocache_headers();
		header( 'Content-Type: ' . $mime );
		header( 'Content-Length: ' . (string) filesize( $path ) );
		header( 'X-Content-Type-Options: nosniff' );
		header( "Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox" );
		header( 'Cache-Control: private, max-age=600' );
		header( 'Content-Disposition: ' . ( $attachment || 'image/svg+xml' !== $mime && 0 !== strpos( $mime, 'image/' ) ? 'attachment' : 'inline' ) . '; filename="' . $filename . '"' );
		readfile( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	}

	/* ------------------------------------------------------------------ contractor */

	public static function contractor_session( \WP_REST_Request $r ): \WP_REST_Response {
		if ( ! RateLimiter::reserve_custom( Ip::hash(), 'portal', 30 ) ) {
			return self::error( 'agh_limit', __( 'Túl sok próbálkozás.', 'autogrowehome' ), 429 );
		}
		$link = AccessTokens::exchange( (string) $r->get_param( 'token' ) );
		if ( ! $link ) {
			Logger::warning( 'portal', 'Invalid or expired contractor link used' );
			return self::error( 'agh_link', __( 'A hivatkozás érvénytelen vagy lejárt. Kérj újat az üzemeltetőtől.', 'autogrowehome' ), 403 );
		}
		return self::nocache( new \WP_REST_Response( array( 'ok' => true ) ) );
	}

	public static function contractor_logout( \WP_REST_Request $r ): \WP_REST_Response {
		AccessTokens::logout();
		return new \WP_REST_Response( array( 'ok' => true ) );
	}

	public static function contractor_projects( \WP_REST_Request $r ): \WP_REST_Response {
		// Quote-level scope: staff see the latest 50, a contractor user only the
		// quotes notified to their e-mail address, a link session only its quote.
		$scope = Access::contractor_quotes();
		if ( array() === $scope ) {
			return self::error( 'agh_forbidden', __( 'Nincs érvényes kivitelezői munkamenet.', 'autogrowehome' ), 401 );
		}
		global $wpdb;
		$qt = Installer::table( 'quotes' );
		if ( true === $scope ) {
			$quotes = $wpdb->get_results( "SELECT * FROM {$qt} ORDER BY id DESC LIMIT 50", ARRAY_A ) ?: array(); // phpcs:ignore
		} else {
			$in     = implode( ',', array_map( 'intval', $scope ) );
			$quotes = $wpdb->get_results( "SELECT * FROM {$qt} WHERE id IN ({$in}) ORDER BY id DESC LIMIT 50", ARRAY_A ) ?: array(); // phpcs:ignore
		}
		$out = array();
		foreach ( $quotes as $q ) {
			$p = Repository::project_by_id( (int) $q['project_id'] );
			if ( ! $p ) {
				continue;
			}
			$payload = self::project_payload( $p, 'contractor' );
			$payload['concepts'] = array_values( array_filter( $payload['concepts'], static fn( $c ) => $c['selected'] ) );
			unset( $payload['progress'] );
			$out[] = array(
				'quote'   => array(
					'id'            => $q['uuid'],
					'created'       => $q['created_at'],
					'status'        => $q['status'],
					'full_name'     => $q['full_name'],
					'email'         => $q['email'],
					'phone'         => $q['phone'],
					'city'          => $q['city'],
					'site_location' => $q['site_location'],
					'start_period'  => $q['start_period'],
					'budget'        => $q['budget'],
					'note'          => $q['note'],
					'package'       => '' !== $q['package_path'] ? add_query_arg( is_user_logged_in() ? array( '_wpnonce' => wp_create_nonce( 'wp_rest' ) ) : array(), wp_make_link_relative( rest_url( AGH_REST_NS . '/contractor/package/' . $q['uuid'] ) ) ) : '',
				),
				'project' => $payload,
				'summary' => \AutoGroweHome\Quote\Summary::rows( $p['config'] ),
				'consents'=> QuoteService::consent_log( (int) $q['id'] ),
			);
		}
		return self::nocache( new \WP_REST_Response( array( 'items' => $out ) ) );
	}

	public static function contractor_package( \WP_REST_Request $r ) {
		$q = QuoteService::get_by_uuid( (string) $r['id'] );
		if ( ! $q || '' === $q['package_path'] || ! ( Access::is_staff() || Access::contractor_can_quote( (int) $q['id'] ) ) ) {
			return self::error( 'agh_forbidden', __( 'Nincs jogosultságod ehhez a csomaghoz.', 'autogrowehome' ), 403 );
		}
		$path = Storage::path( $q['package_path'] );
		if ( '' === $path ) {
			return self::error( 'agh_not_found', 'Missing', 404 );
		}
		QuoteService::update( (int) $q['id'], array( 'downloads' => (int) $q['downloads'] + 1 ) );
		Stats::inc( 'package_download' );
		self::stream( $path, 'application/zip', 'AutoGroweHome-' . substr( $q['uuid'], 0, 8 ) . '.zip', true );
		exit;
	}

	/* ------------------------------------------------------------------ webhook */

	public static function webhook( \WP_REST_Request $r ): \WP_REST_Response {
		// The payload is never trusted: it only nudges the polling job, which then
		// queries the provider's status endpoint with our API key.
		if ( ! hash_equals( Util::webhook_token(), (string) $r['token'] ) ) {
			return new \WP_REST_Response( array( 'ok' => false ), 404 );
		}
		if ( ! RateLimiter::reserve_custom( Ip::hash(), 'webhook', 2000 ) ) {
			return new \WP_REST_Response( array( 'ok' => false ), 429 );
		}
		$task = (string) ( $r->get_param( 'task_id' ) ?? '' );
		if ( preg_match( '/^[0-9a-f-]{36}$/i', $task ) ) {
			global $wpdb;
			$t  = Installer::table( 'assets' );
			$id = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$t} WHERE provider_task_id LIKE %s LIMIT 1", '%|' . $wpdb->esc_like( $task ) ) ); // phpcs:ignore
			if ( $id ) {
				JobQueue::nudge_asset( $id );
				JobQueue::spawn();
			}
		}
		return new \WP_REST_Response( array( 'ok' => true ) );
	}

	/* ------------------------------------------------------------------ admin */

	public static function admin_test_provider( \WP_REST_Request $r ): \WP_REST_Response {
		$id = sanitize_key( (string) $r->get_param( 'provider' ) );
		if ( 'anthropic' === $id ) {
			$res = Providers::text()->test();
		} else {
			$p   = Providers::image( $id );
			$res = $p ? $p->test() : array( 'ok' => false, 'message' => 'Unknown provider' );
		}
		Stats::inc( $res['ok'] ? 'provider_ok' : 'provider_fail', $id . '_test' );
		unset( $res['models'] );
		return new \WP_REST_Response( $res );
	}

	public static function admin_prompt_preview( \WP_REST_Request $r ): \WP_REST_Response {
		$version = (int) $r->get_param( 'version' );
		$view    = sanitize_key( (string) ( $r->get_param( 'view' ) ?: 'hero' ) );
		$c       = Validator::sanitize( (array) ( $r->get_param( 'config' ) ?: \AutoGroweHome\Params\Registry::defaults() ) );
		$plan    = Planner::plan_rules( $c );
		$concept = array(
			'variant'        => 'A',
			'brief'          => $plan['concepts']['A'],
			'building'       => \AutoGroweHome\Generation\BuildingModel::build( $c, 'A' ),
			'consistency_id' => 'preview000000000',
		);
		$room  = 'interior' === $view ? ( $c['rooms'][1] ?? $c['rooms'][0] ?? null ) : null;
		$built = PromptEngine::build( $c, $concept, $view, $room, $version );
		return new \WP_REST_Response( array( 'prompt' => $built['prompt'], 'negative' => $built['negative'], 'version' => $built['version'], 'length' => strlen( PromptEngine::combined( $built ) ) ) );
	}

	public static function admin_prompt_test( \WP_REST_Request $r ): \WP_REST_Response {
		$version = (int) $r->get_param( 'version' );
		$c       = Validator::sanitize( (array) ( $r->get_param( 'config' ) ?: \AutoGroweHome\Params\Registry::defaults() ) );
		$c['project_name'] = 'Prompt test v' . $version;
		$project = Pipeline::start( $c, array( 'user_id' => get_current_user_id(), 'guest_hash' => '', 'ip_hash' => 'admin-test', 'lang' => determine_locale(), 'reserved' => array() ) );
		if ( $version > 0 ) {
			Repository::update_project( $project['id'], array( 'prompt_version' => $version ) );
		}
		return new \WP_REST_Response( array( 'project' => $project['uuid'], 'admin_url' => admin_url( 'admin.php?page=agh-projects&project=' . $project['uuid'] ) ) );
	}

	public static function admin_stats( \WP_REST_Request $r ): \WP_REST_Response {
		$from = preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) $r->get_param( 'from' ) ) ? (string) $r->get_param( 'from' ) : wp_date( 'Y-m-d', time() - 29 * DAY_IN_SECONDS );
		$to   = preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) $r->get_param( 'to' ) ) ? (string) $r->get_param( 'to' ) : wp_date( 'Y-m-d' );
		$tot  = Stats::totals( $from, $to );
		// Breakdowns (styles, roofs, parameters, error reasons, cost, …) are the
		// "stats_advanced" feature: without it the keys stay but are empty.
		$adv       = Features::enabled( 'stats_advanced' );
		$breakdown = array();
		foreach ( array( 'style' => 12, 'roof' => 12, 'area_bucket' => 12, 'param' => 15, 'error' => 12, 'cost' => 12, 'provider_ok' => 12, 'provider_fail' => 12, 'limit_hit' => 12 ) as $metric => $limit ) {
			$breakdown[ $metric ] = $adv ? Stats::breakdown( $metric, $from, $to, $limit ) : array();
		}
		$out  = array(
			'from'      => $from,
			'to'        => $to,
			'advanced'  => $adv,
			'totals'    => $tot,
			'series'    => array(
				'generate_request' => Stats::series( 'generate_request', $from, $to ),
				'popup_open'       => Stats::series( 'popup_open', $from, $to ),
				'quote_submitted'  => Stats::series( 'quote_submitted', $from, $to ),
				'cost'             => Stats::series( 'cost', $from, $to ),
			),
			'breakdown' => $breakdown,
			'derived'   => array(
				'avg_gen_seconds'     => ! empty( $tot['gen_count'] ) ? round( $tot['gen_ms'] / $tot['gen_count'] / 1000, 1 ) : null,
				'quote_conversion'    => ! empty( $tot['generate_request'] ) ? round( ( $tot['quote_submitted'] ?? 0 ) / $tot['generate_request'] * 100, 1 ) : null,
				'cost_per_concept'    => ! empty( $tot['concepts_ready'] ) ? round( ( $tot['cost'] ?? 0 ) / $tot['concepts_ready'], 3 ) : null,
				'cost_per_quote'      => ! empty( $tot['quote_submitted'] ) ? round( ( $tot['cost'] ?? 0 ) / $tot['quote_submitted'], 3 ) : null,
				'image_success_rate'  => ( $tot['image_ok'] ?? 0 ) + ( $tot['image_fail'] ?? 0 ) > 0 ? round( ( $tot['image_ok'] ?? 0 ) / ( ( $tot['image_ok'] ?? 0 ) + ( $tot['image_fail'] ?? 0 ) ) * 100, 1 ) : null,
			),
			'currency'  => Settings::get( 'costs.currency', 'EUR' ),
		);
		return new \WP_REST_Response( $out );
	}

	public static function admin_queue_run( \WP_REST_Request $r ): \WP_REST_Response {
		$n = JobQueue::run( 20.0 );
		return new \WP_REST_Response( array( 'processed' => $n, 'pending' => JobQueue::pending_total() ) );
	}
}
