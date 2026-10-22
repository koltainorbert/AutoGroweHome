<?php
/**
 * Plugin Name:       AutoGroweHome
 * Plugin URI:        https://infostudio.hu/autogrowehome
 * Description:       AI-alapú, interaktív háztervező és kivitelezői ajánlatkérő rendszer: három házkoncepció, fotórealisztikus galériák, méretezett koncepció-tervvázlatok és jogosultságvédett kivitelezői csomag.
 * Version:           1.20.0
 * Requires at least: 6.2
 * Requires PHP:      8.0
 * Author:            Koltai Norbert – Infostudio
 * Author URI:        https://infostudio.hu
 * License:           Commercial (see LICENSE.txt)
 * Text Domain:       autogrowehome
 * Domain Path:       /languages
 *
 * @package AutoGroweHome
 */

defined( 'ABSPATH' ) || exit;

define( 'AGH_VERSION', '1.20.0' );
define( 'AGH_DB_VERSION', 9 ); // 9: style wordings without a barn wing; 8: every style has its own building form; 7: style families share a base (Catalog::upgrade_style_defaults()); 4: quote recipients, consent UA, link recipient; 5: secrets re-encryption; 6: richer style suggestions (Installer::upgrade_data()).
define( 'AGH_FILE', __FILE__ );
define( 'AGH_DIR', plugin_dir_path( __FILE__ ) );
define( 'AGH_URL', plugin_dir_url( __FILE__ ) );
define( 'AGH_BASENAME', plugin_basename( __FILE__ ) );
define( 'AGH_REST_NS', 'agh/v1' );

// Runtime requirements. When one is missing the plugin stays inert (no hooks,
// no activation routine) and only shows an admin notice explaining why.
$agh_missing_requirements = array();
if ( version_compare( PHP_VERSION, '8.0', '<' ) ) {
	$agh_missing_requirements[] = 'php';
}
// mbstring is used throughout (text limits, drawing labels – e.g. mb_strtoupper in FloorPlanSvg).
if ( ! extension_loaded( 'mbstring' ) || ! function_exists( 'mb_strtoupper' ) ) {
	$agh_missing_requirements[] = 'mbstring';
}
if ( ! empty( $agh_missing_requirements ) ) {
	add_action(
		'admin_notices',
		static function () use ( $agh_missing_requirements ) {
			$messages = array(
				'php'      => __( 'Az AutoGroweHome legalább PHP 8.0-t igényel.', 'autogrowehome' ),
				'mbstring' => __( 'Az AutoGroweHome működéséhez a PHP mbstring kiterjesztése szükséges. Kérd meg a tárhelyszolgáltatót, hogy engedélyezze; addig a plugin nem működik.', 'autogrowehome' ),
			);
			foreach ( $agh_missing_requirements as $agh_key ) {
				echo '<div class="notice notice-error"><p>' . esc_html( $messages[ $agh_key ] ) . '</p></div>';
			}
		}
	);
	return;
}
unset( $agh_missing_requirements );

require_once AGH_DIR . 'includes/Autoloader.php';
\AutoGroweHome\Autoloader::register();

register_activation_hook( __FILE__, array( \AutoGroweHome\Installer::class, 'activate' ) );
register_deactivation_hook( __FILE__, array( \AutoGroweHome\Installer::class, 'deactivate' ) );

add_action( 'plugins_loaded', array( \AutoGroweHome\Plugin::class, 'boot' ), 5 );
