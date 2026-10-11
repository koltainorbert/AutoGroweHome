<?php
/**
 * Built-in gateway: links to hosted checkout pages configured per plan and
 * period (Admin → Licenc → Csomagok, option "agh_checkout_urls").
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\License;

defined( 'ABSPATH' ) || exit;

final class ExternalCheckoutGateway implements PaymentGatewayInterface {

	public function id(): string {
		return 'external_checkout';
	}

	public function label(): string {
		return __( 'Külső (hosztolt) fizetési oldal', 'autogrowehome' );
	}

	public function configured(): bool {
		foreach ( (array) get_option( 'agh_checkout_urls', array() ) as $periods ) {
			foreach ( (array) $periods as $url ) {
				if ( '' !== $url ) {
					return true;
				}
			}
		}
		return false;
	}

	public function checkout_url( string $plan, string $period ): string {
		$urls = (array) get_option( 'agh_checkout_urls', array() );
		$url  = (string) ( $urls[ $plan ][ $period ] ?? '' );
		return 0 === strpos( $url, 'https://' ) ? $url : '';
	}
}
