<?php
/**
 * Payment / subscription integration point (separate module).
 *
 * No card data is ever processed or stored by this plugin. The built-in
 * gateway "external_checkout" (ExternalCheckoutGateway) only links to hosted
 * checkout pages (e.g. a Stripe Payment Link, Paddle, Lemon Squeezy or a
 * WooCommerce Subscriptions product) configured per plan and period.
 * Fulfilment (issuing licence keys) happens on the licence server via the
 * provider's webhook.
 *
 * Further gateways implement PaymentGatewayInterface and register through
 * the "agh_payment_gateways" filter.
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\License;

defined( 'ABSPATH' ) || exit;

final class Payments {

	/** Option holding the explicitly chosen gateway id ('' = automatic). */
	public const OPTION = 'agh_payment_gateway';

	/**
	 * @return array<string,PaymentGatewayInterface> Built-in gateway first,
	 *         then the registered ones in filter order.
	 */
	public static function gateways(): array {
		$list  = array( 'external_checkout' => new ExternalCheckoutGateway() );
		$extra = apply_filters( 'agh_payment_gateways', array() );
		foreach ( (array) $extra as $id => $g ) {
			if ( $g instanceof PaymentGatewayInterface ) {
				$list[ is_string( $id ) && '' !== $id ? sanitize_key( $id ) : sanitize_key( $g->id() ) ] = $g;
			}
		}
		return $list;
	}

	/**
	 * Gateway used for checkout links:
	 * 1. the explicitly selected one (option "agh_payment_gateway", filterable
	 *    via "agh_payment_gateway_id") when it is registered and configured;
	 * 2. otherwise the first configured gateway registered through the
	 *    "agh_payment_gateways" filter (a site that adds one wants to use it);
	 * 3. otherwise the built-in external checkout, when it has URLs.
	 */
	public static function active(): ?PaymentGatewayInterface {
		$list     = self::gateways();
		$selected = sanitize_key( (string) apply_filters( 'agh_payment_gateway_id', (string) get_option( self::OPTION, '' ) ) );
		if ( '' !== $selected && isset( $list[ $selected ] ) && $list[ $selected ]->configured() ) {
			return $list[ $selected ];
		}
		foreach ( $list as $id => $g ) {
			if ( 'external_checkout' !== $id && $g->configured() ) {
				return $g;
			}
		}
		return $list['external_checkout']->configured() ? $list['external_checkout'] : null;
	}
}
