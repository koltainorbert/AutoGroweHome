<?php
/**
 * Uninstall: data is removed only when the administrator explicitly enabled
 * "delete all data on uninstall" (Admin → Jogi és GDPR). Otherwise projects,
 * quotes and settings are kept for a later reinstall; only scheduled events
 * and cache transients are removed in that case.
 *
 * @package AutoGroweHome
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

/**
 * Cache transients of the plugin (agh_*), including their timeouts and the
 * update-info site transient.
 */
function agh_uninstall_transients(): void {
	global $wpdb;
	foreach ( array( '_transient_agh_', '_transient_timeout_agh_', '_site_transient_agh_', '_site_transient_timeout_agh_' ) as $prefix ) {
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s", $wpdb->esc_like( $prefix ) . '%' ) ); // phpcs:ignore
	}
	delete_site_transient( 'agh_update_info' ); // Multisite: stored in sitemeta.
}

agh_uninstall_transients();
wp_clear_scheduled_hook( 'agh_cron_queue' );
wp_clear_scheduled_hook( 'agh_cron_daily' );
wp_clear_scheduled_hook( 'agh_process_queue_now' );

$agh_settings = get_option( 'agh_settings', array() );
if ( empty( $agh_settings['general']['delete_on_uninstall'] ) ) {
	return;
}

// The main plugin file is not loaded during uninstall: define what the
// autoloaded classes need. The version is read from the plugin header.
if ( ! defined( 'AGH_DIR' ) ) {
	define( 'AGH_DIR', plugin_dir_path( __FILE__ ) );
}
if ( ! defined( 'AGH_VERSION' ) ) {
	$agh_header = get_file_data( AGH_DIR . 'autogrowehome.php', array( 'Version' => 'Version' ) );
	define( 'AGH_VERSION', (string) $agh_header['Version'] );
}
require_once AGH_DIR . 'includes/Autoloader.php';
\AutoGroweHome\Autoloader::register();

/**
 * Remove private files. The default directory (uploads/agh-private-<random>/)
 * belongs to the plugin and is removed completely. A custom AGH_PRIVATE_DIR is
 * chosen by the site owner and may hold other files: only the plugin's own
 * content is removed there (project folders named by UUID, the probe file and
 * the protection files whose content is exactly what the plugin writes); the
 * directory itself is kept.
 */
function agh_uninstall_rmtree( string $dir ): void {
	if ( ! is_dir( $dir ) || is_link( $dir ) ) {
		return;
	}
	$it = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $dir, FilesystemIterator::SKIP_DOTS ), RecursiveIteratorIterator::CHILD_FIRST );
	foreach ( $it as $f ) {
		( $f->isDir() && ! $f->isLink() ) ? rmdir( $f->getPathname() ) : unlink( $f->getPathname() ); // phpcs:ignore
	}
	rmdir( $dir ); // phpcs:ignore
}

$agh_dir = untrailingslashit( \AutoGroweHome\Support\Storage::base_dir() );
if ( is_dir( $agh_dir ) ) {
	$agh_custom = defined( 'AGH_PRIVATE_DIR' ) && AGH_PRIVATE_DIR;
	if ( ! $agh_custom && 0 === strpos( basename( $agh_dir ), 'agh-private-' ) ) {
		agh_uninstall_rmtree( $agh_dir );
	} elseif ( $agh_custom ) {
		foreach ( (array) scandir( $agh_dir ) as $agh_entry ) {
			if ( \AutoGroweHome\Support\Util::is_uuid( (string) $agh_entry ) && is_dir( $agh_dir . '/' . $agh_entry ) ) {
				agh_uninstall_rmtree( $agh_dir . '/' . $agh_entry );
			}
		}
		if ( is_file( $agh_dir . '/agh-probe.txt' ) ) {
			unlink( $agh_dir . '/agh-probe.txt' ); // phpcs:ignore
		}
		// Protection files as written by Storage::ensure_private_dir() (keep in
		// sync). A file with any other content belongs to the site owner.
		$agh_protection = array(
			'.htaccess'  => "# AutoGroweHome – deny direct access\n<IfModule mod_authz_core.c>\n\tRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n\tOrder deny,allow\n\tDeny from all\n</IfModule>\nOptions -Indexes\n",
			'web.config' => "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<configuration><system.webServer><authorization><deny users=\"*\" /></authorization></system.webServer></configuration>\n",
			'index.php'  => "<?php\n// Silence is golden.\nhttp_response_code( 403 );\n",
			'index.html' => '',
		);
		foreach ( $agh_protection as $agh_name => $agh_content ) {
			$agh_file = $agh_dir . '/' . $agh_name;
			if ( is_file( $agh_file ) && ! is_link( $agh_file ) && trim( (string) file_get_contents( $agh_file ) ) === trim( $agh_content ) ) { // phpcs:ignore
				unlink( $agh_file ); // phpcs:ignore
			}
		}
	}
}
\AutoGroweHome\Installer::drop_all();
delete_metadata( 'user', 0, 'agh_presets', '', true );
