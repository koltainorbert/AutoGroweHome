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
		// Validate the class name itself (namespace separators only), then build
		// the path with forward slashes. "/" works on every platform including
		// Windows; DIRECTORY_SEPARATOR must not be used here, because on Windows
		// it is "\" and sub-namespaced classes would never resolve.
		if ( ! preg_match( '/^[A-Za-z0-9_]+(?:\\\\[A-Za-z0-9_]+)*$/', $relative ) ) {
			return;
		}
		$file = AGH_DIR . 'includes/' . str_replace( '\\', '/', $relative ) . '.php';
		if ( is_readable( $file ) ) {
			require_once $file;
		}
	}
}
