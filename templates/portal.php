<?php
/**
 * Contractor portal container (shortcode or stand-alone page).
 *
 * @package AutoGroweHome
 */

defined( 'ABSPATH' ) || exit;
?>
<div class="agh-root agh-portal" id="agh-portal" data-theme="light">
	<div class="agh-portal-head">
		<div class="agh-brand-mark" aria-hidden="true">⌂</div>
		<div>
			<div class="agh-eyebrow"><?php echo esc_html( (string) \AutoGroweHome\Support\Settings::get( 'general.plugin_name', 'AutoGroweHome' ) ); ?></div>
			<h1 class="agh-h" style="font-size:22px"><?php esc_html_e( 'Kivitelezői tervcsomagok', 'autogrowehome' ); ?></h1>
		</div>
	</div>
	<div id="agh-portal-app"><p class="agh-muted"><?php esc_html_e( 'Betöltés…', 'autogrowehome' ); ?></p></div>
	<noscript><p><?php esc_html_e( 'A portál használatához engedélyezd a JavaScriptet.', 'autogrowehome' ); ?></p></noscript>
</div>
