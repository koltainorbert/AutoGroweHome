<?php
/**
 * Plugin bootstrap: wires modules to WordPress hooks. Heavy modules are only
 * touched when needed (REST, admin screens, cron, shortcodes).
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome;

use AutoGroweHome\Admin\Admin;
use AutoGroweHome\Frontend\Frontend;
use AutoGroweHome\Frontend\I18n;
use AutoGroweHome\Generation\JobQueue;
use AutoGroweHome\License\LicenseManager;
use AutoGroweHome\Privacy\Privacy;
use AutoGroweHome\Rest\RestController;

defined( 'ABSPATH' ) || exit;

final class Plugin {

	private static $booted = false;

	public static function boot(): void {
		if ( self::$booted ) {
			return;
		}
		self::$booted = true;

		Installer::maybe_upgrade();
		I18n::init();

		add_filter( 'cron_schedules', array( __CLASS__, 'cron_schedules' ) );
		add_action( 'agh_cron_queue', array( __CLASS__, 'cron_queue' ) );
		add_action( 'agh_process_queue_now', array( __CLASS__, 'cron_queue' ) );
		add_action( 'agh_cron_daily', array( __CLASS__, 'cron_daily' ) );
		add_action( 'rest_api_init', array( RestController::class, 'register' ) );
		add_filter( 'pre_set_site_transient_update_plugins', array( LicenseManager::class, 'filter_updates' ) );
		add_filter( 'http_request_args', array( LicenseManager::class, 'package_auth' ), 10, 2 );
		// Our update ZIP is downloaded and SHA-256 verified before installation.
		add_filter( 'upgrader_pre_download', array( LicenseManager::class, 'pre_download' ), 10, 2 );

		Privacy::init();
		if ( is_admin() ) {
			Admin::init();
		} else {
			Frontend::init();
		}
		if ( defined( 'WP_CLI' ) && WP_CLI ) {
			\WP_CLI::add_command( 'agh', Cli\Command::class );
		}
		// Self-heal scheduled events (e.g. after migration from another host).
		if ( ! wp_next_scheduled( 'agh_cron_queue' ) ) {
			wp_schedule_event( time() + 60, 'agh_minute', 'agh_cron_queue' );
		}
		if ( ! wp_next_scheduled( 'agh_cron_daily' ) ) {
			wp_schedule_event( time() + 3600, 'daily', 'agh_cron_daily' );
		}
	}

	public static function cron_schedules( array $s ): array {
		$s['agh_minute'] = array( 'interval' => 60, 'display' => 'AutoGroweHome – every minute' );
		return $s;
	}

	public static function cron_queue(): void {
		if ( JobQueue::pending_total() > 0 ) {
			JobQueue::run( 45.0 );
		}
	}

	public static function cron_daily(): void {
		LicenseManager::check();
	}
}
