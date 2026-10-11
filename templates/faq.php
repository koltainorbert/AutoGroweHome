<?php
/**
 * Interactive FAQ: search, categories, collapsible answers.
 * Variables: $items, $cats.
 *
 * @package AutoGroweHome
 */

defined( 'ABSPATH' ) || exit;
?>
<div class="agh-pages agh-faq" data-agh-faq>
	<div class="agh-faq-tools">
		<input type="search" class="agh-faq-search" placeholder="<?php esc_attr_e( 'Keresés a kérdések között…', 'autogrowehome' ); ?>" aria-label="<?php esc_attr_e( 'Keresés a kérdések között', 'autogrowehome' ); ?>">
		<div class="agh-faq-cats" role="tablist">
			<button type="button" class="is-on" data-cat=""><?php esc_html_e( 'Mind', 'autogrowehome' ); ?></button>
			<?php foreach ( $cats as $cat ) : ?>
				<button type="button" data-cat="<?php echo esc_attr( $cat ); ?>"><?php echo esc_html( $cat ); ?></button>
			<?php endforeach; ?>
		</div>
	</div>
	<div class="agh-faq-list">
		<?php foreach ( $items as $i => $item ) : ?>
			<details class="agh-faq-item" data-cat="<?php echo esc_attr( $item['cat'] ); ?>">
				<summary><span><?php echo esc_html( $item['q'] ); ?></span><i aria-hidden="true">+</i></summary>
				<div class="agh-faq-a"><?php echo wp_kses_post( wpautop( $item['a'] ) ); ?></div>
			</details>
		<?php endforeach; ?>
	</div>
	<p class="agh-faq-empty" hidden><?php esc_html_e( 'Nincs találat.', 'autogrowehome' ); ?></p>
</div>
