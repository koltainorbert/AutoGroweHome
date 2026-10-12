<?php
/**
 * Plugin Name:       AGH Licencközpont
 * Plugin URI:        https://infostudio.hu/autogrowehome
 * Description:       Az AutoGroweHome központi licencszervere: licenckulcsok kiadása, aktiválások és weboldal-limitek kezelése, hosszabbítás, visszavonás, frissítések kiadása – Ed25519-aláírt válaszokkal. Csak a forgalmazó saját oldalára telepítendő, az ügyfelekhez nem.
 * Version:           1.0.0
 * Requires at least: 6.2
 * Requires PHP:      8.0
 * Author:            Koltai Norbert – Infostudio
 * Author URI:        https://infostudio.hu
 * License:           Commercial
 * Text Domain:       agh-license-hub
 *
 * @package AGHLicenseHub
 */

defined( 'ABSPATH' ) || exit;

define( 'AGHLS_VERSION', '1.0.0' );
define( 'AGHLS_DB_VERSION', 1 );
define( 'AGHLS_FILE', __FILE__ );
define( 'AGHLS_DIR', plugin_dir_path( __FILE__ ) );
define( 'AGHLS_URL', plugin_dir_url( __FILE__ ) );
define( 'AGHLS_NS', 'aghls/v1' );

require_once AGHLS_DIR . 'includes/Crypto.php';
require_once AGHLS_DIR . 'includes/Store.php';
require_once AGHLS_DIR . 'includes/Releases.php';
require_once AGHLS_DIR . 'includes/Api.php';
require_once AGHLS_DIR . 'includes/Admin.php';

register_activation_hook( __FILE__, array( 'AGHLS_Store', 'install' ) );

add_action( 'plugins_loaded', function () {
	if ( (int) get_option( 'aghls_db_version', 0 ) < AGHLS_DB_VERSION ) {
		AGHLS_Store::install();
	}
} );
add_action( 'rest_api_init', array( 'AGHLS_Api', 'routes' ) );
if ( is_admin() ) {
	AGHLS_Admin::init();
}
