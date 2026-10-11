<?php
/**
 * Stand-alone contractor portal page (/?agh-portal=1), theme independent.
 *
 * @package AutoGroweHome
 */

defined( 'ABSPATH' ) || exit;
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="no-referrer">
<title><?php echo esc_html( __( 'Kivitelezői portál', 'autogrowehome' ) . ' – ' . get_bloginfo( 'name' ) ); ?></title>
<?php wp_print_styles( array( 'agh-designer' ) ); ?>
</head>
<body class="agh-portal-body">
<?php include AGH_DIR . 'templates/portal.php'; ?>
<?php wp_print_scripts( array( 'agh-portal' ) ); ?>
</body>
</html>
