<?php
/**
 * Licences, activations and the request log (custom tables).
 *
 * @package AGHLicenseHub
 */

defined( 'ABSPATH' ) || exit;

final class AGHLS_Store {

	/** Plans of the AutoGroweHome plugin (ids must match Features::plans() there). */
	public static function plans(): array {
		return array(
			'starter'      => array( 'label' => 'Starter', 'sites' => 1 ),
			'professional' => array( 'label' => 'Professional', 'sites' => 1 ),
			'agency'       => array( 'label' => 'Agency', 'sites' => 25 ),
		);
	}

	public static function cycles(): array {
		return array(
			'monthly'  => __( 'Havi', 'agh-license-hub' ),
			'yearly'   => __( 'Éves', 'agh-license-hub' ),
			'lifetime' => __( 'Örökös (nem jár le)', 'agh-license-hub' ),
		);
	}

	public static function t( string $name ): string {
		global $wpdb;
		return $wpdb->prefix . 'aghls_' . $name;
	}

	public static function install(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$cs = $wpdb->get_charset_collate();
		dbDelta( 'CREATE TABLE ' . self::t( 'licenses' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			key_hash char(64) NOT NULL,
			key_sealed text NOT NULL,
			key_hint varchar(40) NOT NULL DEFAULT '',
			customer varchar(190) NOT NULL DEFAULT '',
			email varchar(190) NOT NULL DEFAULT '',
			plan varchar(32) NOT NULL DEFAULT 'starter',
			billing_cycle varchar(16) NOT NULL DEFAULT 'yearly',
			expires_at datetime NULL DEFAULT NULL,
			sites_allowed int(11) NOT NULL DEFAULT 1,
			updates tinyint(1) NOT NULL DEFAULT 1,
			status varchar(16) NOT NULL DEFAULT 'active',
			notes text NULL,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY key_hash (key_hash),
			KEY status (status)
		) $cs;" );
		dbDelta( 'CREATE TABLE ' . self::t( 'activations' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			license_id bigint(20) unsigned NOT NULL,
			instance_id varchar(64) NOT NULL,
			site_url varchar(255) NOT NULL DEFAULT '',
			plugin_version varchar(32) NOT NULL DEFAULT '',
			active tinyint(1) NOT NULL DEFAULT 1,
			first_seen datetime NOT NULL,
			last_seen datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY lic_inst (license_id,instance_id),
			KEY license_id (license_id)
		) $cs;" );
		dbDelta( 'CREATE TABLE ' . self::t( 'releases' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			version varchar(32) NOT NULL,
			file varchar(190) NOT NULL,
			sha256 char(64) NOT NULL,
			size bigint(20) unsigned NOT NULL DEFAULT 0,
			requires_php varchar(16) NOT NULL DEFAULT '8.0',
			tested varchar(16) NOT NULL DEFAULT '',
			notes text NULL,
			published tinyint(1) NOT NULL DEFAULT 1,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY version (version)
		) $cs;" );
		dbDelta( 'CREATE TABLE ' . self::t( 'log' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			created_at datetime NOT NULL,
			license_id bigint(20) unsigned NOT NULL DEFAULT 0,
			action varchar(24) NOT NULL DEFAULT '',
			result varchar(24) NOT NULL DEFAULT '',
			site_url varchar(255) NOT NULL DEFAULT '',
			ip_hash char(32) NOT NULL DEFAULT '',
			PRIMARY KEY  (id),
			KEY license_id (license_id),
			KEY created_at (created_at)
		) $cs;" );
		AGHLS_Crypto::ensure_keys();
		AGHLS_Releases::protect_dir();
		update_option( 'aghls_db_version', AGHLS_DB_VERSION, false );
	}

	public static function now(): string {
		return gmdate( 'Y-m-d H:i:s' );
	}

	/* -------------------------------------------------------------- licences */

	/**
	 * Creates a licence and returns [id, plain key]. The plain key is kept only encrypted.
	 */
	public static function create( array $f ): array {
		global $wpdb;
		$key = AGHLS_Crypto::new_license_key();
		$row = self::clean( $f );
		$row['key_hash']   = AGHLS_Crypto::key_hash( $key );
		$row['key_sealed'] = AGHLS_Crypto::seal( $key );
		$row['key_hint']   = AGHLS_Crypto::key_hint( $key );
		$row['created_at'] = self::now();
		$row['updated_at'] = self::now();
		$wpdb->insert( self::t( 'licenses' ), $row );
		return array( (int) $wpdb->insert_id, $key );
	}

	public static function update( int $id, array $f ): void {
		global $wpdb;
		$row               = self::clean( $f );
		$row['updated_at'] = self::now();
		$wpdb->update( self::t( 'licenses' ), $row, array( 'id' => $id ) );
	}

	private static function clean( array $f ): array {
		$plans = self::plans();
		$plan  = isset( $plans[ $f['plan'] ?? '' ] ) ? $f['plan'] : 'starter';
		$cycle = isset( self::cycles()[ $f['billing_cycle'] ?? '' ] ) ? $f['billing_cycle'] : 'yearly';
		$exp   = trim( (string) ( $f['expires_at'] ?? '' ) );
		$exp   = 'lifetime' === $cycle || '' === $exp ? null : gmdate( 'Y-m-d H:i:s', strtotime( $exp . ( strlen( $exp ) <= 10 ? ' 23:59:59' : '' ) ) );
		return array(
			'customer'      => sanitize_text_field( (string) ( $f['customer'] ?? '' ) ),
			'email'         => sanitize_email( (string) ( $f['email'] ?? '' ) ),
			'plan'          => $plan,
			'billing_cycle' => $cycle,
			'expires_at'    => $exp,
			'sites_allowed' => max( 1, min( 1000, (int) ( $f['sites_allowed'] ?? $plans[ $plan ]['sites'] ) ) ),
			'updates'       => empty( $f['updates'] ) ? 0 : 1,
			'status'        => in_array( $f['status'] ?? 'active', array( 'active', 'revoked' ), true ) ? ( $f['status'] ?? 'active' ) : 'active',
			'notes'         => sanitize_textarea_field( (string) ( $f['notes'] ?? '' ) ),
		);
	}

	public static function get( int $id ): ?array {
		global $wpdb;
		$r = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'licenses' ) . ' WHERE id = %d', $id ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return $r ?: null;
	}

	public static function by_key( string $key ): ?array {
		global $wpdb;
		$r = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'licenses' ) . ' WHERE key_hash = %s', AGHLS_Crypto::key_hash( $key ) ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return $r ?: null;
	}

	public static function plain_key( array $lic ): string {
		return AGHLS_Crypto::open( (string) $lic['key_sealed'] );
	}

	public static function delete( int $id ): void {
		global $wpdb;
		$wpdb->delete( self::t( 'activations' ), array( 'license_id' => $id ) );
		$wpdb->delete( self::t( 'licenses' ), array( 'id' => $id ) );
	}

	/**
	 * Extends by one billing period from the later of today and the current expiry.
	 */
	public static function extend( int $id ): void {
		$l = self::get( $id );
		if ( ! $l || 'lifetime' === $l['billing_cycle'] ) {
			return;
		}
		$from = max( time(), $l['expires_at'] ? strtotime( $l['expires_at'] . ' UTC' ) : time() );
		$to   = strtotime( ( 'monthly' === $l['billing_cycle'] ? '+1 month' : '+1 year' ), $from );
		global $wpdb;
		$wpdb->update( self::t( 'licenses' ), array( 'expires_at' => gmdate( 'Y-m-d H:i:s', $to ), 'updated_at' => self::now() ), array( 'id' => $id ) );
	}

	public static function set_status( int $id, string $status ): void {
		global $wpdb;
		$wpdb->update( self::t( 'licenses' ), array( 'status' => 'revoked' === $status ? 'revoked' : 'active', 'updated_at' => self::now() ), array( 'id' => $id ) );
	}

	public static function is_expired( array $l ): bool {
		return ! empty( $l['expires_at'] ) && strtotime( $l['expires_at'] . ' UTC' ) < time();
	}

	/** Effective state of a licence for the list: active / expired / revoked. */
	public static function state( array $l ): string {
		if ( 'revoked' === $l['status'] ) {
			return 'revoked';
		}
		return self::is_expired( $l ) ? 'expired' : 'active';
	}

	public static function search( string $q = '', string $state = '', int $limit = 200 ): array {
		global $wpdb;
		$sql  = 'SELECT l.*, (SELECT COUNT(*) FROM ' . self::t( 'activations' ) . ' a WHERE a.license_id = l.id AND a.active = 1) AS sites_used FROM ' . self::t( 'licenses' ) . ' l';
		$args = array();
		if ( '' !== $q ) {
			$like  = '%' . $wpdb->esc_like( $q ) . '%';
			$sql  .= ' WHERE (l.customer LIKE %s OR l.email LIKE %s OR l.key_hint LIKE %s OR l.notes LIKE %s)';
			$args  = array( $like, $like, $like, $like );
		}
		$sql .= ' ORDER BY l.id DESC LIMIT ' . (int) $limit;
		$rows = $args ? $wpdb->get_results( $wpdb->prepare( $sql, $args ), ARRAY_A ) : $wpdb->get_results( $sql, ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$rows = is_array( $rows ) ? $rows : array();
		if ( '' !== $state ) {
			$rows = array_values( array_filter( $rows, function ( $l ) use ( $state ) { return self::state( $l ) === $state; } ) );
		}
		return $rows;
	}

	public static function counts(): array {
		$out = array( 'all' => 0, 'active' => 0, 'expired' => 0, 'revoked' => 0, 'sites' => 0 );
		foreach ( self::search( '', '', 100000 ) as $l ) {
			$out['all']++;
			$out[ self::state( $l ) ]++;
			$out['sites'] += (int) $l['sites_used'];
		}
		return $out;
	}

	/* -------------------------------------------------------------- activations */

	public static function activations( int $license_id, bool $only_active = false ): array {
		global $wpdb;
		$sql = 'SELECT * FROM ' . self::t( 'activations' ) . ' WHERE license_id = %d' . ( $only_active ? ' AND active = 1' : '' ) . ' ORDER BY active DESC, last_seen DESC';
		$r   = $wpdb->get_results( $wpdb->prepare( $sql, $license_id ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		return is_array( $r ) ? $r : array();
	}

	public static function activation( int $license_id, string $instance ): ?array {
		global $wpdb;
		$r = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'activations' ) . ' WHERE license_id = %d AND instance_id = %s', $license_id, $instance ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return $r ?: null;
	}

	public static function sites_used( int $license_id ): int {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . self::t( 'activations' ) . ' WHERE license_id = %d AND active = 1', $license_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	}

	public static function touch_activation( int $license_id, string $instance, string $url, string $version, bool $active ): void {
		global $wpdb;
		$a = self::activation( $license_id, $instance );
		if ( $a ) {
			$wpdb->update( self::t( 'activations' ), array( 'site_url' => $url, 'plugin_version' => $version, 'active' => $active ? 1 : 0, 'last_seen' => self::now() ), array( 'id' => $a['id'] ) );
		} else {
			$wpdb->insert( self::t( 'activations' ), array( 'license_id' => $license_id, 'instance_id' => $instance, 'site_url' => $url, 'plugin_version' => $version, 'active' => $active ? 1 : 0, 'first_seen' => self::now(), 'last_seen' => self::now() ) );
		}
	}

	/** Frees a site (admin action, e.g. when the old hosting is gone). */
	public static function free_site( int $activation_id ): void {
		global $wpdb;
		$wpdb->update( self::t( 'activations' ), array( 'active' => 0 ), array( 'id' => $activation_id ) );
	}

	/**
	 * Mutex per licence: an option row is unique, so add_option() succeeds for one request only.
	 * Works on MySQL and SQLite alike; stale locks (crashed request) expire after 30 s.
	 */
	public static function lock( int $id ): bool {
		$name = 'aghls_lock_' . $id;
		for ( $i = 0; $i < 100; $i++ ) {
			if ( add_option( $name, time(), '', 'no' ) ) {
				return true;
			}
			$t = (int) get_option( $name, 0 );
			if ( $t && $t < time() - 30 ) {
				delete_option( $name );
				continue;
			}
			usleep( 50000 );
		}
		return false;
	}

	public static function unlock( int $id ): void {
		delete_option( 'aghls_lock_' . $id );
	}

	/* -------------------------------------------------------------- log */

	public static function log( int $license_id, string $action, string $result, string $site_url, string $ip ): void {
		global $wpdb;
		$wpdb->insert( self::t( 'log' ), array( 'created_at' => self::now(), 'license_id' => $license_id, 'action' => substr( $action, 0, 24 ), 'result' => substr( $result, 0, 24 ), 'site_url' => substr( $site_url, 0, 255 ), 'ip_hash' => AGHLS_Crypto::ip_hash( $ip ) ) );
		if ( 1 === wp_rand( 1, 200 ) ) {
			$wpdb->query( $wpdb->prepare( 'DELETE FROM ' . self::t( 'log' ) . ' WHERE created_at < %s', gmdate( 'Y-m-d H:i:s', time() - 180 * DAY_IN_SECONDS ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		}
	}

	public static function log_rows( int $license_id = 0, int $limit = 200 ): array {
		global $wpdb;
		$sql = 'SELECT * FROM ' . self::t( 'log' ) . ( $license_id ? ' WHERE license_id = ' . (int) $license_id : '' ) . ' ORDER BY id DESC LIMIT ' . (int) $limit;
		$r   = $wpdb->get_results( $sql, ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		return is_array( $r ) ? $r : array();
	}
}
