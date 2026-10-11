<?php
/**
 * Contract for payment / subscription gateways (own file so the PSR-4
 * autoloader can load it – third-party gateways implement it before the
 * Payments class is ever touched).
 *
 * Register an implementation through the "agh_payment_gateways" filter:
 *
 *     add_filter( 'agh_payment_gateways', function ( $list ) {
 *         $list['my_gateway'] = new My_Gateway(); // implements PaymentGatewayInterface
 *         return $list;
 *     } );
 *
 * @package AutoGroweHome
 */

namespace AutoGroweHome\License;

defined( 'ABSPATH' ) || exit;

interface PaymentGatewayInterface {
	public function id(): string;
	public function label(): string;
	public function configured(): bool;
	/** Checkout URL for a plan/period or '' when not available. */
	public function checkout_url( string $plan, string $period ): string;
}
