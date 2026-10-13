<?php
/**
 * Activation, deactivation and database migrations.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome;

use AutoGroweHome\Support\Logger;
use AutoGroweHome\Support\Secrets;
use AutoGroweHome\Support\Settings;
use AutoGroweHome\Support\Storage;
use AutoGroweHome\Catalog\Catalog;
use AutoGroweHome\Prompt\PromptEngine;

defined( 'ABSPATH' ) || exit;

final class Installer {

	public const CAPS = array(
		'agh_manage'        => 'Beállítások kezelése',
		'agh_view_projects' => 'Projektek és ajánlatkérések megtekintése',
		'agh_view_stats'    => 'Statisztika megtekintése',
		'agh_view_packages' => 'Kivitelezői csomagok megtekintése',
	);

	/**
	 * Plugin activation.
	 */
	public static function activate(): void {
		$from = (int) get_option( 'agh_db_version', 0 );
		self::migrate();
		self::upgrade_data( $from );
		self::roles();
		Settings::install_defaults();
		Storage::ensure_private_dir();
		Catalog::seed();
		PromptEngine::seed();
		if ( ! wp_next_scheduled( 'agh_cron_queue' ) ) {
			wp_schedule_event( time() + 60, 'agh_minute', 'agh_cron_queue' );
		}
		if ( ! wp_next_scheduled( 'agh_cron_daily' ) ) {
			wp_schedule_event( time() + 3600, 'daily', 'agh_cron_daily' );
		}
		update_option( 'agh_activated_at', time(), false );
	}

	/**
	 * Plugin deactivation: only scheduled events are removed, data is kept.
	 */
	public static function deactivate(): void {
		wp_clear_scheduled_hook( 'agh_cron_queue' );
		wp_clear_scheduled_hook( 'agh_cron_daily' );
		wp_clear_scheduled_hook( 'agh_process_queue_now' );
	}

	/**
	 * Run migrations when the stored DB version is older.
	 */
	public static function maybe_upgrade(): void {
		$from = (int) get_option( 'agh_db_version', 0 );
		if ( $from < AGH_DB_VERSION ) {
			self::migrate();
			self::upgrade_data( $from );
			self::roles();
			Settings::install_defaults();
		}
	}

	/**
	 * One-off data upgrades, each tied to the DB version that introduced it
	 * (runs once when crossing that version; every step is idempotent).
	 *
	 * @param int $from DB version before the upgrade (0 = fresh install).
	 */
	private static function upgrade_data( int $from ): void {
		if ( $from < 5 ) {
			// DB v5: re-encrypt stored API / licence keys that still use the
			// legacy key derivation or format (values are read back unchanged).
			try {
				$n = Secrets::upgrade_storage();
				if ( $n > 0 ) {
					Logger::info( 'core', 'Stored secrets re-encrypted', array( 'count' => $n ) );
				}
			} catch ( \Throwable $e ) {
				Logger::error( 'core', 'Secrets storage upgrade failed: ' . $e->getMessage() );
			}
		}
		if ( $from > 0 && $from < 7 ) {
			// DB v6/v7: richer style suggestions, shared family bases (only untouched seeds).
			try {
				$n = Catalog::upgrade_style_defaults();
				Logger::info( 'core', 'Style suggestions updated', array( 'count' => $n ) );
			} catch ( \Throwable $e ) {
				Logger::error( 'core', 'Style suggestions upgrade failed: ' . $e->getMessage() );
			}
		}
	}

	public static function tables(): array {
		global $wpdb;
		$p = $wpdb->prefix . 'agh_';
		return array(
			'projects'        => $p . 'projects',
			'concepts'        => $p . 'concepts',
			'assets'          => $p . 'assets',
			'jobs'            => $p . 'jobs',
			'quotes'          => $p . 'quotes',
			'consents'        => $p . 'consents',
			'rate'            => $p . 'rate',
			'stats'           => $p . 'stats',
			'logs'            => $p . 'logs',
			'prompt_versions' => $p . 'prompt_versions',
			'catalog'         => $p . 'catalog',
			'access'          => $p . 'access',
			'ledger'          => $p . 'ledger',
		);
	}

	public static function table( string $key ): string {
		$t = self::tables();
		return $t[ $key ];
	}

	/**
	 * Create / update all tables with dbDelta.
	 */
	public static function migrate(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$c = $wpdb->get_charset_collate();
		$t = self::tables();

		$sql = array();

		// projects.status: queued|planning|rendering|ready|partial|failed|cancelled
		// (set by RestController::cancel) and deleted (scrubbed shell of a project
		// whose quote was anonymised, see Repository::anonymize_project()). The
		// column default 'draft' is never written by the plugin; rows are always
		// inserted with an explicit status.
		// projects.expires_at: reserved, currently unused. Retention is computed
		// from updated_at and the live settings (Privacy::retention()), so a
		// changed retention period applies to existing projects as well.
		$sql[] = "CREATE TABLE {$t['projects']} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			uuid char(36) NOT NULL,
			owner_user_id bigint(20) unsigned NOT NULL DEFAULT 0,
			guest_key_hash char(64) NOT NULL DEFAULT '',
			name varchar(190) NOT NULL DEFAULT '',
			status varchar(20) NOT NULL DEFAULT 'draft',
			config longtext NOT NULL,
			config_hash char(64) NOT NULL DEFAULT '',
			selected_concept_id bigint(20) unsigned NOT NULL DEFAULT 0,
			prompt_version int(11) NOT NULL DEFAULT 0,
			lang varchar(12) NOT NULL DEFAULT '',
			stage varchar(40) NOT NULL DEFAULT '',
			ip_hash char(64) NOT NULL DEFAULT '',
			saved tinyint(1) NOT NULL DEFAULT 0,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			expires_at datetime NULL DEFAULT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY uuid (uuid),
			KEY owner_user_id (owner_user_id),
			KEY guest_key_hash (guest_key_hash),
			KEY config_hash (config_hash),
			KEY status (status)
		) $c;";

		$sql[] = "CREATE TABLE {$t['concepts']} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			uuid char(36) NOT NULL,
			project_id bigint(20) unsigned NOT NULL,
			variant char(1) NOT NULL DEFAULT 'A',
			title varchar(190) NOT NULL DEFAULT '',
			brief longtext NOT NULL,
			building longtext NOT NULL,
			consistency_id char(16) NOT NULL DEFAULT '',
			status varchar(20) NOT NULL DEFAULT 'planned',
			gallery_status varchar(20) NOT NULL DEFAULT 'none',
			revision int(11) NOT NULL DEFAULT 1,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY uuid (uuid),
			KEY project_id (project_id)
		) $c;";

		$sql[] = "CREATE TABLE {$t['assets']} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			uuid char(36) NOT NULL,
			project_id bigint(20) unsigned NOT NULL,
			concept_id bigint(20) unsigned NOT NULL DEFAULT 0,
			kind varchar(20) NOT NULL DEFAULT 'render',
			view varchar(40) NOT NULL DEFAULT '',
			label varchar(190) NOT NULL DEFAULT '',
			status varchar(20) NOT NULL DEFAULT 'queued',
			provider varchar(40) NOT NULL DEFAULT '',
			model varchar(60) NOT NULL DEFAULT '',
			provider_task_id varchar(100) NOT NULL DEFAULT '',
			prompt longtext NULL,
			file_path varchar(255) NOT NULL DEFAULT '',
			preview_path varchar(255) NOT NULL DEFAULT '',
			mime varchar(60) NOT NULL DEFAULT '',
			width int(11) NOT NULL DEFAULT 0,
			height int(11) NOT NULL DEFAULT 0,
			bytes bigint(20) NOT NULL DEFAULT 0,
			native_resolution varchar(10) NOT NULL DEFAULT '',
			is_upscaled tinyint(1) NOT NULL DEFAULT 0,
			is_test tinyint(1) NOT NULL DEFAULT 0,
			access_level varchar(20) NOT NULL DEFAULT 'contractor',
			version int(11) NOT NULL DEFAULT 1,
			gen_ms int(11) NOT NULL DEFAULT 0,
			cost decimal(12,4) NOT NULL DEFAULT 0,
			error text NULL,
			sort int(11) NOT NULL DEFAULT 0,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY uuid (uuid),
			KEY project_id (project_id),
			KEY concept_id (concept_id),
			KEY status (status)
		) $c;";

		$sql[] = "CREATE TABLE {$t['jobs']} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			project_id bigint(20) unsigned NOT NULL DEFAULT 0,
			asset_id bigint(20) unsigned NOT NULL DEFAULT 0,
			type varchar(30) NOT NULL,
			payload longtext NULL,
			status varchar(20) NOT NULL DEFAULT 'queued',
			priority tinyint(3) unsigned NOT NULL DEFAULT 10,
			attempts tinyint(3) unsigned NOT NULL DEFAULT 0,
			max_attempts tinyint(3) unsigned NOT NULL DEFAULT 3,
			run_after datetime NOT NULL,
			locked_until datetime NULL DEFAULT NULL,
			lock_token char(32) NOT NULL DEFAULT '',
			started_at datetime NULL DEFAULT NULL,
			last_error text NULL,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY pick (status,run_after,priority),
			KEY project_id (project_id)
		) $c;";

		$sql[] = "CREATE TABLE {$t['quotes']} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			uuid char(36) NOT NULL,
			project_id bigint(20) unsigned NOT NULL,
			concept_id bigint(20) unsigned NOT NULL DEFAULT 0,
			full_name varchar(190) NOT NULL DEFAULT '',
			email varchar(190) NOT NULL DEFAULT '',
			phone varchar(60) NOT NULL DEFAULT '',
			city varchar(120) NOT NULL DEFAULT '',
			site_location varchar(190) NOT NULL DEFAULT '',
			start_period varchar(60) NOT NULL DEFAULT '',
			budget varchar(60) NOT NULL DEFAULT '',
			note text NULL,
			lang varchar(12) NOT NULL DEFAULT '',
			status varchar(20) NOT NULL DEFAULT 'pending',
			package_path varchar(255) NOT NULL DEFAULT '',
			notified_at datetime NULL DEFAULT NULL,
			downloads int(11) NOT NULL DEFAULT 0,
			recipients longtext NULL,
			anonymized tinyint(1) NOT NULL DEFAULT 0,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY uuid (uuid),
			KEY project_id (project_id),
			KEY email (email)
		) $c;";

		$sql[] = "CREATE TABLE {$t['consents']} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			quote_id bigint(20) unsigned NOT NULL DEFAULT 0,
			project_id bigint(20) unsigned NOT NULL DEFAULT 0,
			consent_type varchar(30) NOT NULL,
			granted tinyint(1) NOT NULL DEFAULT 0,
			doc_version varchar(40) NOT NULL DEFAULT '',
			doc_url varchar(255) NOT NULL DEFAULT '',
			event varchar(30) NOT NULL DEFAULT 'given',
			ip_hash char(64) NOT NULL DEFAULT '',
			user_agent varchar(255) NOT NULL DEFAULT '',
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY quote_id (quote_id)
		) $c;";

		$sql[] = "CREATE TABLE {$t['rate']} (
			bucket char(64) NOT NULL,
			period varchar(20) NOT NULL,
			scope varchar(20) NOT NULL,
			hits int(11) NOT NULL DEFAULT 0,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (bucket,period,scope)
		) $c;";

		$sql[] = "CREATE TABLE {$t['stats']} (
			day date NOT NULL,
			metric varchar(64) NOT NULL,
			dim varchar(100) NOT NULL DEFAULT '',
			value double NOT NULL DEFAULT 0,
			PRIMARY KEY  (day,metric,dim)
		) $c;";

		$sql[] = "CREATE TABLE {$t['logs']} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			level varchar(10) NOT NULL DEFAULT 'info',
			channel varchar(40) NOT NULL DEFAULT 'core',
			message text NOT NULL,
			context longtext NULL,
			project_id bigint(20) unsigned NOT NULL DEFAULT 0,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY level (level),
			KEY created_at (created_at)
		) $c;";

		$sql[] = "CREATE TABLE {$t['prompt_versions']} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			version int(11) NOT NULL,
			label varchar(190) NOT NULL DEFAULT '',
			modules longtext NOT NULL,
			created_by bigint(20) unsigned NOT NULL DEFAULT 0,
			is_active tinyint(1) NOT NULL DEFAULT 0,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY version (version)
		) $c;";

		$sql[] = "CREATE TABLE {$t['catalog']} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			type varchar(40) NOT NULL,
			slug varchar(100) NOT NULL,
			name varchar(190) NOT NULL DEFAULT '',
			data longtext NULL,
			image_id bigint(20) unsigned NOT NULL DEFAULT 0,
			sort int(11) NOT NULL DEFAULT 0,
			status varchar(20) NOT NULL DEFAULT 'published',
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY type_slug (type,slug)
		) $c;";

		$sql[] = "CREATE TABLE {$t['access']} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			kind varchar(20) NOT NULL DEFAULT 'link',
			token_hash char(64) NOT NULL,
			quote_id bigint(20) unsigned NOT NULL DEFAULT 0,
			project_id bigint(20) unsigned NOT NULL DEFAULT 0,
			recipient char(64) NOT NULL DEFAULT '',
			uses int(11) NOT NULL DEFAULT 0,
			max_uses int(11) NOT NULL DEFAULT 0,
			expires_at datetime NOT NULL,
			revoked tinyint(1) NOT NULL DEFAULT 0,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY token_hash (token_hash),
			KEY project_id (project_id),
			KEY quote_id (quote_id)
		) $c;";

		$sql[] = "CREATE TABLE {$t['ledger']} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			day date NOT NULL,
			provider varchar(40) NOT NULL,
			operation varchar(40) NOT NULL,
			units double NOT NULL DEFAULT 1,
			cost decimal(12,4) NOT NULL DEFAULT 0,
			project_id bigint(20) unsigned NOT NULL DEFAULT 0,
			asset_id bigint(20) unsigned NOT NULL DEFAULT 0,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY day (day),
			KEY project_id (project_id)
		) $c;";

		foreach ( $sql as $statement ) {
			dbDelta( $statement );
		}

		update_option( 'agh_db_version', AGH_DB_VERSION, false );
	}

	/**
	 * Register roles and capabilities.
	 */
	public static function roles(): void {
		$admin = get_role( 'administrator' );
		if ( $admin ) {
			foreach ( array_keys( self::CAPS ) as $cap ) {
				$admin->add_cap( $cap );
			}
		}
		if ( ! get_role( 'agh_contractor' ) ) {
			add_role(
				'agh_contractor',
				'AutoGroweHome kivitelező',
				array(
					'read'              => true,
					'agh_view_packages' => true,
				)
			);
		}
		if ( ! get_role( 'agh_manager' ) ) {
			add_role(
				'agh_manager',
				'AutoGroweHome projektkezelő',
				array(
					'read'              => true,
					'agh_view_projects' => true,
					'agh_view_stats'    => true,
					'agh_view_packages' => true,
				)
			);
		}
	}

	/**
	 * Drop everything (only called from uninstall.php when the admin opted in).
	 */
	public static function drop_all(): void {
		global $wpdb;
		foreach ( self::tables() as $table ) {
			$wpdb->query( "DROP TABLE IF EXISTS {$table}" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		}
		$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE 'agh\\_%'" );
		remove_role( 'agh_contractor' );
		remove_role( 'agh_manager' );
		$admin = get_role( 'administrator' );
		if ( $admin ) {
			foreach ( array_keys( self::CAPS ) as $cap ) {
				$admin->remove_cap( $cap );
			}
		}
	}
}
