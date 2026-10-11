<?php
/**
 * Regression test for the PSR-4 autoloader (runs without WordPress).
 *
 * Background: 1.0.0 was first built and tested on Linux only. The autoloader
 * built paths with DIRECTORY_SEPARATOR, which on Windows is "\" and was then
 * rejected by its own validation, so no sub-namespaced class could be loaded
 * and activation died with "Class AutoGroweHome\Support\Logger not found".
 *
 * Usage: php tests/autoloader-test.php
 * Exit code 0 = all checks passed, 1 = at least one failed.
 *
 * @package AutoGroweHome
 */

if ( PHP_SAPI !== 'cli' ) {
	exit( 1 );
}

define( 'ABSPATH', __DIR__ . '/' );
define( 'AGH_DIR', dirname( __DIR__ ) . '/' );

$agh_pass = 0;
$agh_fail = array();

/**
 * Record one check.
 *
 * @param bool   $ok    Result.
 * @param string $label What was checked.
 */
function agh_check( bool $ok, string $label ): void {
	global $agh_pass, $agh_fail;
	if ( $ok ) {
		++$agh_pass;
	} else {
		$agh_fail[] = $label;
	}
}

$agh_autoloader_file = AGH_DIR . 'includes/Autoloader.php';

// 1. The autoloader code (comments stripped) must not depend on the platform
// separator at all – this is exactly what broke on Windows.
$agh_code = '';
foreach ( token_get_all( (string) file_get_contents( $agh_autoloader_file ) ) as $agh_token ) {
	if ( is_array( $agh_token ) && in_array( $agh_token[0], array( T_COMMENT, T_DOC_COMMENT ), true ) ) {
		continue;
	}
	$agh_code .= is_array( $agh_token ) ? $agh_token[1] : $agh_token;
}
agh_check( false === strpos( $agh_code, 'DIRECTORY_SEPARATOR' ), 'Autoloader.php does not use DIRECTORY_SEPARATOR' );

// 2. Every class / interface / trait / enum under includes/ must live where
// PSR-4 expects it, with exact case (Linux is case-sensitive, Windows is not).
$agh_declared = array();
$agh_iterator = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( AGH_DIR . 'includes', FilesystemIterator::SKIP_DOTS ) );
foreach ( $agh_iterator as $agh_file ) {
	if ( 'php' !== strtolower( $agh_file->getExtension() ) ) {
		continue;
	}
	$agh_source = (string) file_get_contents( $agh_file->getPathname() );
	if ( ! preg_match( '/^\s*namespace\s+([A-Za-z0-9_\\\\]+)\s*;/m', $agh_source, $agh_ns ) ) {
		continue; // A template or view without a namespace.
	}
	if ( ! preg_match( '/^\s*(?:final\s+|abstract\s+)*(?:class|interface|trait|enum)\s+([A-Za-z0-9_]+)/m', $agh_source, $agh_cls ) ) {
		continue;
	}
	$agh_fqcn     = $agh_ns[1] . '\\' . $agh_cls[1];
	$agh_relative = str_replace( '\\', '/', substr( $agh_fqcn, strlen( 'AutoGroweHome\\' ) ) ) . '.php';
	$agh_actual   = str_replace( '\\', '/', substr( $agh_file->getPathname(), strlen( AGH_DIR . 'includes/' ) ) );
	agh_check( 0 === strpos( $agh_fqcn, 'AutoGroweHome\\' ) && $agh_relative === $agh_actual, 'PSR-4 path matches: ' . $agh_fqcn . ' (' . $agh_actual . ')' );
	$agh_declared[] = $agh_fqcn;
}
agh_check( count( $agh_declared ) > 0, 'Classes found under includes/' );

// 3. The real autoloader must resolve every one of them, including the
// sub-namespaced ones that failed on Windows.
require_once $agh_autoloader_file;
\AutoGroweHome\Autoloader::register();
foreach ( $agh_declared as $agh_fqcn ) {
	$agh_loaded = false;
	try {
		$agh_loaded = class_exists( $agh_fqcn ) || interface_exists( $agh_fqcn ) || trait_exists( $agh_fqcn ) || ( function_exists( 'enum_exists' ) && enum_exists( $agh_fqcn ) );
	} catch ( \Throwable $agh_e ) {
		$agh_loaded = false;
	}
	agh_check( $agh_loaded, 'Autoloads: ' . $agh_fqcn );
}

// 4. Names that are malformed, escape the includes/ directory or belong to
// another namespace must be ignored without touching the file system.
$agh_rejected = array(
	'AutoGroweHome\\..\\..\\wp-config',
	'AutoGroweHome\\Support/../../wp-config',
	'AutoGroweHome\\\\Support',
	'AutoGroweHome\\Support\\',
	'AutoGroweHome\\Support\\Lo.gger',
	'AutoGroweHome\\Nincs\\Ilyen',
	'Mas\\Nevter\\Osztaly',
);
foreach ( $agh_rejected as $agh_name ) {
	$agh_before = count( get_included_files() );
	\AutoGroweHome\Autoloader::load( $agh_name );
	agh_check( ! class_exists( $agh_name, false ) && count( get_included_files() ) === $agh_before, 'Ignored: ' . $agh_name );
}

$agh_total = $agh_pass + count( $agh_fail );
foreach ( $agh_fail as $agh_label ) {
	echo 'FAIL  ' . $agh_label . PHP_EOL;
}
echo 'autoloader-test: ' . $agh_pass . '/' . $agh_total . ' OK (' . count( $agh_declared ) . ' classes)' . PHP_EOL;
exit( empty( $agh_fail ) ? 0 : 1 );
