<?php
/**
 * AutoGroweHome releases offered as updates (uploaded ZIPs, SHA-256, served only through the API).
 *
 * @package AGHLicenseHub
 */

defined( 'ABSPATH' ) || exit;

final class AGHLS_Releases {

	public static function dir(): string {
		$u = wp_upload_dir( null, false );
		return trailingslashit( $u['basedir'] ) . 'aghls-releases/';
	}

	/** Release files are never served directly: deny rules for Apache and an empty index. */
	public static function protect_dir(): void {
		$d = self::dir();
		if ( ! is_dir( $d ) ) {
			wp_mkdir_p( $d );
		}
		if ( ! file_exists( $d . '.htaccess' ) ) {
			file_put_contents( $d . '.htaccess', "Require all denied\nDeny from all\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		}
		if ( ! file_exists( $d . 'index.php' ) ) {
			file_put_contents( $d . 'index.php', "<?php\n// Silence.\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		}
	}

	/**
	 * Reads "Version:" and "Requires PHP:" from autogrowehome/autogrowehome.php inside the ZIP.
	 */
	public static function inspect( string $zip ): array {
		if ( ! class_exists( 'ZipArchive' ) ) {
			return array( 'error' => __( 'A ZipArchive PHP-kiterjesztés hiányzik a szerveren.', 'agh-license-hub' ) );
		}
		$z = new ZipArchive();
		if ( true !== $z->open( $zip ) ) {
			return array( 'error' => __( 'A fájl nem olvasható ZIP.', 'agh-license-hub' ) );
		}
		$main = $z->getFromName( 'autogrowehome/autogrowehome.php' );
		$z->close();
		if ( false === $main ) {
			return array( 'error' => __( 'Ez nem AutoGroweHome-csomag (hiányzik az autogrowehome/autogrowehome.php).', 'agh-license-hub' ) );
		}
		preg_match( '/^\s*\*\s*Version:\s*([0-9][0-9A-Za-z.\-]*)/m', $main, $v );
		preg_match( '/^\s*\*\s*Requires PHP:\s*([0-9.]+)/m', $main, $p );
		if ( empty( $v[1] ) ) {
			return array( 'error' => __( 'A csomagban nem található verziószám.', 'agh-license-hub' ) );
		}
		return array( 'version' => $v[1], 'requires_php' => $p[1] ?? '8.0' );
	}

	public static function add( string $tmp, string $tested, string $notes ): array {
		global $wpdb;
		$info = self::inspect( $tmp );
		if ( isset( $info['error'] ) ) {
			return $info;
		}
		if ( self::get( $info['version'] ) ) {
			return array( 'error' => sprintf( /* translators: %s: version */ __( 'A(z) %s verzió már fel van töltve.', 'agh-license-hub' ), $info['version'] ) );
		}
		self::protect_dir();
		$file = 'autogrowehome-' . preg_replace( '/[^0-9A-Za-z.\-]/', '', $info['version'] ) . '-' . bin2hex( random_bytes( 12 ) ) . '.zip';
		if ( ! @copy( $tmp, self::dir() . $file ) ) { // phpcs:ignore WordPress.PHP.NoSilencedErrors
			return array( 'error' => __( 'A fájl nem menthető a feltöltési mappába.', 'agh-license-hub' ) );
		}
		$wpdb->insert( AGHLS_Store::t( 'releases' ), array(
			'version'      => $info['version'],
			'file'         => $file,
			'sha256'       => hash_file( 'sha256', self::dir() . $file ),
			'size'         => (int) filesize( self::dir() . $file ),
			'requires_php' => $info['requires_php'],
			'tested'       => sanitize_text_field( $tested ),
			'notes'        => sanitize_textarea_field( $notes ),
			'published'    => 1,
			'created_at'   => AGHLS_Store::now(),
		) );
		return $info;
	}

	public static function all(): array {
		global $wpdb;
		$r = $wpdb->get_results( 'SELECT * FROM ' . AGHLS_Store::t( 'releases' ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$r = is_array( $r ) ? $r : array();
		usort( $r, function ( $a, $b ) { return version_compare( $b['version'], $a['version'] ); } );
		return $r;
	}

	public static function get( string $version ): ?array {
		global $wpdb;
		$r = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . AGHLS_Store::t( 'releases' ) . ' WHERE version = %s', $version ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return $r ?: null;
	}

	/** Newest published release whose file exists. */
	public static function latest(): ?array {
		foreach ( self::all() as $r ) {
			if ( (int) $r['published'] && is_readable( self::dir() . $r['file'] ) ) {
				return $r;
			}
		}
		return null;
	}

	public static function set_published( int $id, bool $on ): void {
		global $wpdb;
		$wpdb->update( AGHLS_Store::t( 'releases' ), array( 'published' => $on ? 1 : 0 ), array( 'id' => $id ) );
	}

	public static function delete( int $id ): void {
		global $wpdb;
		$r = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . AGHLS_Store::t( 'releases' ) . ' WHERE id = %d', $id ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		if ( $r ) {
			wp_delete_file( self::dir() . $r['file'] );
			$wpdb->delete( AGHLS_Store::t( 'releases' ), array( 'id' => $id ) );
		}
	}
}
