<?php
/**
 * PSR-4 autoloader for the AutoGroweHome namespace.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome;

defined( 'ABSPATH' ) || exit;

final class Autoloader {

	public static function register(): void {
		spl_autoload_register( array( __CLASS__, 'load' ) );
	}

	public static function load( string $class ): void {
		$prefix = __NAMESPACE__ . '\\';
		if ( 0 !== strpos( $class, $prefix ) ) {
			return;
		}
		$relative = substr( $class, strlen( $prefix ) );
		$relative = str_replace( '\\', DIRECTORY_SEPARATOR, $relative );
		if ( ! preg_match( '/^[A-Za-z0-9_\/]+$/', $relative ) ) {
			return;
		}
		$file = AGH_DIR . 'includes/' . $relative . '.php';
		if ( is_readable( $file ) ) {
			require_once $file;
		}
	}
}
