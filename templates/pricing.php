<?php
/**
 * Data-driven sales / pricing page.
 * Variables: $plans, $features, $gateway (PaymentGatewayInterface|null).
 *
 * @package AutoGroweHome
 */

defined( 'ABSPATH' ) || exit;
?>
<div class="agh-pages agh-pricing">
	<header class="agh-pr-hero">
		<p class="agh-pr-eyebrow"><?php echo esc_html( (string) \AutoGroweHome\Support\Settings::get( 'general.plugin_name', 'AutoGroweHome' ) ); ?></p>
		<h2><?php esc_html_e( 'AI-alapú háztervező a weboldaladra', 'autogrowehome' ); ?></h2>
		<p><?php esc_html_e( 'Látogatóid három házkoncepciót kapnak fotórealisztikus látványtervekkel és tervvázlatokkal, te pedig minősített ajánlatkéréseket.', 'autogrowehome' ); ?></p>
		<div class="agh-pr-steps">
			<span><?php esc_html_e( 'Paraméterek', 'autogrowehome' ); ?></span><i>→</i>
			<span><?php esc_html_e( '3 koncepció', 'autogrowehome' ); ?></span><i>→</i>
			<span><?php esc_html_e( 'Galéria és tervvázlatok', 'autogrowehome' ); ?></span><i>→</i>
			<span><?php esc_html_e( 'Ajánlatkérés', 'autogrowehome' ); ?></span>
		</div>
		<div class="agh-pr-toggle" role="group" aria-label="<?php esc_attr_e( 'Számlázási időszak', 'autogrowehome' ); ?>">
			<button type="button" class="is-on" data-period="month"><?php esc_html_e( 'Havi', 'autogrowehome' ); ?></button>
			<button type="button" data-period="year"><?php esc_html_e( 'Éves', 'autogrowehome' ); ?></button>
		</div>
	</header>
	<div class="agh-pr-grid">
		<?php foreach ( $plans as $slug => $plan ) : ?>
			<article class="agh-pr-card<?php echo 'professional' === $slug ? ' is-featured' : ''; ?>">
				<h3><?php echo esc_html( $plan['label'] ); ?></h3>
				<p class="agh-pr-aud"><?php echo esc_html( $plan['audience'] ); ?></p>
				<p class="agh-pr-price">
					<span data-period="month"><?php echo esc_html( '' !== $plan['price_month'] ? $plan['price_month'] : __( 'Ár egyeztetés alapján', 'autogrowehome' ) ); ?></span>
					<span data-period="year" hidden><?php echo esc_html( '' !== $plan['price_year'] ? $plan['price_year'] : __( 'Ár egyeztetés alapján', 'autogrowehome' ) ); ?></span>
				</p>
				<ul>
					<?php foreach ( $features as $fkey => $flabel ) : ?>
						<li class="<?php echo in_array( $fkey, (array) $plan['features'], true ) ? 'is-on' : 'is-off'; ?>"><?php echo esc_html( $flabel ); ?></li>
					<?php endforeach; ?>
					<li class="is-on"><?php echo esc_html( sprintf( /* translators: %d: sites */ _n( '%d weboldal', '%d weboldal', (int) $plan['limits']['sites'], 'autogrowehome' ), (int) $plan['limits']['sites'] ) ); ?></li>
				</ul>
				<?php
				$m = $gateway ? $gateway->checkout_url( $slug, 'month' ) : '';
				$y = $gateway ? $gateway->checkout_url( $slug, 'year' ) : '';
				if ( $m || $y ) :
					?>
					<a class="agh-pr-btn" data-period="month" href="<?php echo esc_url( $m ?: $y ); ?>" rel="noopener"><?php esc_html_e( 'Megrendelés', 'autogrowehome' ); ?></a>
					<a class="agh-pr-btn" data-period="year" href="<?php echo esc_url( $y ?: $m ); ?>" rel="noopener" hidden><?php esc_html_e( 'Megrendelés', 'autogrowehome' ); ?></a>
				<?php else : ?>
					<p class="agh-pr-note"><?php esc_html_e( 'Online megrendelés hamarosan – érdeklődj elérhetőségeinken.', 'autogrowehome' ); ?></p>
				<?php endif; ?>
			</article>
		<?php endforeach; ?>
	</div>
	<section class="agh-pr-terms">
		<h3><?php esc_html_e( 'Fontos tudnivalók', 'autogrowehome' ); ?></h3>
		<ul>
			<li><?php esc_html_e( 'A pluginlicenc nem tartalmazza a külső AI-szolgáltatók (Magnific, Anthropic) díjait: ezeket a saját API-kulcsoddal, közvetlenül a szolgáltatónak fizeted.', 'autogrowehome' ); ?></li>
			<li><?php esc_html_e( 'A licenc nem jelent korlátlan képgenerálást; a napi limitek és költségkeretek az adminban állíthatók.', 'autogrowehome' ); ?></li>
			<li><?php esc_html_e( 'Lejárt licenc esetén a projektek és beállítások megmaradnak, a prémium funkciók kikapcsolnak.', 'autogrowehome' ); ?></li>
			<li><?php esc_html_e( 'A generált tervvázlatok koncepcionálisak, nem engedélyezési vagy kiviteli dokumentációk.', 'autogrowehome' ); ?></li>
		</ul>
	</section>
</div>
