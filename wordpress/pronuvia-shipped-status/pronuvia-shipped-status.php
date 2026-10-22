<?php
/**
 * Plugin Name: Pronuvia Shipped Status
 * Description: Adds a "Shipped" order status to WooCommerce, so an order with a shipping label shows Shipped in WP admin the same as in Pronuvia.
 * Version:     1.0.0
 * Author:      Pronuvia
 * Requires PHP: 7.4
 *
 * Pronuvia marks an order Shipped when its label is bought and sets the Woo
 * status to `shipped` (it shows Shipped in its own pages too). The status
 * counts as paid (reports, customer totals). When it is delivered, the admin
 * sets Completed; Pronuvia follows.
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', 'pronuvia_shipped_register' );
function pronuvia_shipped_register() {
	register_post_status( 'wc-shipped', array(
		'label'                     => _x( 'Shipped', 'Order status', 'pronuvia' ),
		'public'                    => false,
		'exclude_from_search'       => false,
		'show_in_admin_all_list'    => true,
		'show_in_admin_status_list' => true,
		/* translators: %s: number of orders */
		'label_count'               => _n_noop( 'Shipped <span class="count">(%s)</span>', 'Shipped <span class="count">(%s)</span>', 'pronuvia' ),
	) );
}

// In the status list, right after Processing
add_filter( 'wc_order_statuses', 'pronuvia_shipped_in_list' );
function pronuvia_shipped_in_list( $statuses ) {
	$out = array();
	foreach ( $statuses as $key => $label ) {
		$out[ $key ] = $label;
		if ( 'wc-processing' === $key ) {
			$out['wc-shipped'] = _x( 'Shipped', 'Order status', 'pronuvia' );
		}
	}
	if ( ! isset( $out['wc-shipped'] ) ) {
		$out['wc-shipped'] = _x( 'Shipped', 'Order status', 'pronuvia' );
	}
	return $out;
}

// A shipped order is paid: reports and customer totals count it
add_filter( 'woocommerce_order_is_paid_statuses', 'pronuvia_shipped_paid' );
add_filter( 'woocommerce_reports_order_statuses', 'pronuvia_shipped_paid' );
function pronuvia_shipped_paid( $statuses ) {
	$statuses   = is_array( $statuses ) ? $statuses : array();
	$statuses[] = 'shipped';
	return array_values( array_unique( $statuses ) );
}

// Orders list bulk action "Change status to shipped" (HPOS and the classic screen)
add_filter( 'bulk_actions-woocommerce_page_wc-orders', 'pronuvia_shipped_bulk' );
add_filter( 'bulk_actions-edit-shop_order', 'pronuvia_shipped_bulk' );
function pronuvia_shipped_bulk( $actions ) {
	$actions['mark_shipped'] = __( 'Change status to shipped', 'pronuvia' );
	return $actions;
}
