<?php
/**
 * Plugin Name: Pronuvia Order Number
 * Description: Shows the Pronuvia order number (e.g. 13045) on WooCommerce orders instead of the WooCommerce order ID, finds orders by it in the Orders search, and names the doctor / sales rep of each order in the Orders list (as Pronuvia does).
 * Version:     1.1.0
 * Author:      Pronuvia
 * Requires PHP: 7.4
 *
 * Every order Pronuvia sends to WooCommerce carries its number in the
 * pronuvia_order_number meta. Only the number shown changes (orders list,
 * order page, emails, labels and anything else using get_order_number());
 * the order ID (the one in the edit URL) stays as it is. Orders without the
 * meta keep WooCommerce's own number.
 */

defined( 'ABSPATH' ) || exit;

const PRONUVIA_ORDER_NUMBER_KEY = 'pronuvia_order_number';

add_filter( 'woocommerce_order_number', 'pronuvia_order_number', 10, 2 );
function pronuvia_order_number( $number, $order ) {
	if ( ! is_object( $order ) || ! method_exists( $order, 'get_meta' ) ) {
		return $number;
	}
	$ours = (string) $order->get_meta( PRONUVIA_ORDER_NUMBER_KEY );
	return '' !== $ours ? $ours : $number;
}

// Orders search finds the Pronuvia number: HPOS order tables, and the older posts storage
add_filter( 'woocommerce_order_table_search_query_meta_keys', 'pronuvia_order_number_search_keys' );
add_filter( 'woocommerce_shop_order_search_fields', 'pronuvia_order_number_search_keys' );
function pronuvia_order_number_search_keys( $keys ) {
	$keys   = is_array( $keys ) ? $keys : array();
	$keys[] = PRONUVIA_ORDER_NUMBER_KEY;
	return array_values( array_unique( $keys ) );
}

// Orders list: next to the number, the doctor of the order, else the sales
// rep (the same name the Pronuvia orders list shows), instead of the billing name
add_filter( 'woocommerce_admin_order_buyer_name', 'pronuvia_order_buyer_name', 10, 2 );
function pronuvia_order_buyer_name( $buyer, $order ) {
	if ( ! is_object( $order ) || ! method_exists( $order, 'get_meta' ) ) {
		return $buyer;
	}
	$doctor = trim( (string) $order->get_meta( 'pronuvia_physician_name' ) );
	if ( '' !== $doctor ) {
		return preg_replace( '/^Dr\.?\s+/i', '', $doctor );
	}
	$rep = trim( (string) $order->get_meta( 'pronuvia_sales_rep_name' ) );
	return '' !== $rep ? $rep : $buyer;
}
