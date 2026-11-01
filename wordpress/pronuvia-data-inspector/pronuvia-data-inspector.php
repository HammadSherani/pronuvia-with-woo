<?php
/**
 * Plugin Name: Pronuvia Data Inspector
 * Description: Read-only. Lets Pronuvia's developer read this site's data (plugins, users, orders, database tables) with a secret key, to plan the move to the new Pronuvia portal. Changes nothing. Deactivate and delete it when the check is done.
 * Version:     1.1.0
 * Author:      Pronuvia
 * Requires PHP: 7.4
 *
 * Only reads (SELECTs and WordPress / WooCommerce getters); nothing is ever
 * written, apart from the plugin's own key. The data is served at
 * /wp-json/pronuvia-inspect/v1/{summary|table|users|orders|passwords} to whoever sends
 * the key (header X-Pronuvia-Inspect, or ?key=). The key is made on
 * activation, shown under Tools → Pronuvia Data Inspector, and deleted on
 * deactivation. Tokens, API keys and card data are never sent (shown as
 * [redacted]); the API key and session tables are not served at all. Password
 * hashes are sent only by `passwords`, only for doctors, reps and accounts
 * with no role (never an admin), so they can keep their password on the new
 * portal.
 */

defined( 'ABSPATH' ) || exit;

const PRONUVIA_INSPECT_OPTION = 'pronuvia_data_inspector_key';
const PRONUVIA_INSPECT_HIDDEN = '/(pass|token|secret|session_tokens|api_?key|activation_key|private_?key|card|cvv)/i';
const PRONUVIA_INSPECT_SKIP_TABLES = '/(woocommerce_api_keys|woocommerce_sessions)$/';

register_activation_hook( __FILE__, 'pronuvia_inspect_activate' );
function pronuvia_inspect_activate() {
	if ( ! get_option( PRONUVIA_INSPECT_OPTION ) ) {
		add_option( PRONUVIA_INSPECT_OPTION, bin2hex( random_bytes( 24 ) ), '', 'no' );
	}
}

register_deactivation_hook( __FILE__, 'pronuvia_inspect_deactivate' );
function pronuvia_inspect_deactivate() {
	delete_option( PRONUVIA_INSPECT_OPTION );
}

// ── Tools → Pronuvia Data Inspector: the key and the link ──

add_action( 'admin_menu', 'pronuvia_inspect_menu' );
function pronuvia_inspect_menu() {
	add_management_page( 'Pronuvia Data Inspector', 'Pronuvia Data Inspector', 'manage_options', 'pronuvia-data-inspector', 'pronuvia_inspect_page' );
}

function pronuvia_inspect_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$key = (string) get_option( PRONUVIA_INSPECT_OPTION );
	echo '<div class="wrap"><h1>Pronuvia Data Inspector</h1>';
	echo '<p>Send these two to your Pronuvia developer. The plugin only reads data; it changes nothing.</p>';
	echo '<p><strong>Site:</strong> <code>' . esc_html( home_url() ) . '</code></p>';
	echo '<p><strong>Key:</strong> <code>' . esc_html( $key ) . '</code></p>';
	echo '<p>When the check is done, deactivate and delete this plugin: the key stops working at once.</p></div>';
}

// ── REST ──

add_action( 'rest_api_init', 'pronuvia_inspect_routes' );
function pronuvia_inspect_routes() {
	foreach ( array( 'summary', 'table', 'users', 'orders', 'passwords' ) as $what ) {
		register_rest_route(
			'pronuvia-inspect/v1',
			'/' . $what,
			array(
				'methods'             => 'GET',
				'callback'            => 'pronuvia_inspect_' . $what,
				'permission_callback' => 'pronuvia_inspect_allowed',
			)
		);
	}
}

/** The request carries the key (header X-Pronuvia-Inspect, or ?key=). */
function pronuvia_inspect_allowed( $request ) {
	$key  = (string) get_option( PRONUVIA_INSPECT_OPTION );
	$sent = (string) ( $request->get_header( 'x_pronuvia_inspect' ) ?: $request->get_param( 'key' ) );
	if ( '' === $key || '' === $sent || ! hash_equals( $key, $sent ) ) {
		return new WP_Error( 'pronuvia_inspect_forbidden', 'Wrong or missing key.', array( 'status' => 403 ) );
	}
	return true;
}

// ── values: readable, nothing secret ──

/** A serialized value as data (never builds objects); other values as they are. */
function pronuvia_inspect_value( $value ) {
	if ( is_string( $value ) && is_serialized( $value ) ) {
		$data = @unserialize( $value, array( 'allowed_classes' => false ) ); // phpcs:ignore
		if ( false !== $data || 'b:0;' === $value ) {
			return pronuvia_inspect_clean( $data );
		}
	}
	return $value;
}

/** Arrays / objects with secret-looking keys hidden, all the way down. */
function pronuvia_inspect_clean( $data ) {
	if ( is_object( $data ) ) {
		$data = get_object_vars( $data );
	}
	if ( ! is_array( $data ) ) {
		return $data;
	}
	$out = array();
	foreach ( $data as $k => $v ) {
		$out[ $k ] = ( is_string( $k ) && preg_match( PRONUVIA_INSPECT_HIDDEN, $k ) ) ? '[redacted]' : pronuvia_inspect_clean( $v );
	}
	return $out;
}

/** One value under a name (column, meta key, option name): hidden if the name looks secret. */
function pronuvia_inspect_named( $name, $value ) {
	return preg_match( PRONUVIA_INSPECT_HIDDEN, (string) $name ) ? '[redacted]' : pronuvia_inspect_value( $value );
}

/** A table row; key/value tables (options, *meta) hide by the key in the row. */
function pronuvia_inspect_row( array $row ) {
	$name_col = null;
	foreach ( array( 'option_name', 'meta_key' ) as $c ) {
		if ( array_key_exists( $c, $row ) ) {
			$name_col = $c;
		}
	}
	$out = array();
	foreach ( $row as $col => $value ) {
		if ( preg_match( PRONUVIA_INSPECT_HIDDEN, $col ) ) {
			$out[ $col ] = '[redacted]';
		} elseif ( $name_col && in_array( $col, array( 'option_value', 'meta_value' ), true ) ) {
			$out[ $col ] = pronuvia_inspect_named( $row[ $name_col ], $value );
		} else {
			$out[ $col ] = pronuvia_inspect_value( $value );
		}
	}
	return $out;
}

/** Tables of this site that may be read. */
function pronuvia_inspect_tables() {
	global $wpdb;
	$tables = $wpdb->get_col( 'SHOW TABLES' );
	return array_values( array_filter( $tables, function ( $t ) {
		return ! preg_match( PRONUVIA_INSPECT_SKIP_TABLES, $t );
	} ) );
}

function pronuvia_inspect_page_args( $request, $max ) {
	$per  = max( 1, min( $max, (int) ( $request->get_param( 'per_page' ) ?: $request->get_param( 'limit' ) ?: 100 ) ) );
	$page = max( 1, (int) ( $request->get_param( 'page' ) ?: 1 ) );
	return array( $per, $page );
}

// ── summary: what this site has ──

function pronuvia_inspect_summary() {
	global $wpdb;
	require_once ABSPATH . 'wp-admin/includes/plugin.php';

	$active  = (array) get_option( 'active_plugins', array() );
	$plugins = array();
	foreach ( get_plugins() as $file => $p ) {
		$plugins[] = array(
			'file'    => $file,
			'name'    => $p['Name'],
			'version' => $p['Version'],
			'author'  => wp_strip_all_tags( $p['Author'] ),
			'active'  => in_array( $file, $active, true ) || is_plugin_active_for_network( $file ),
		);
	}

	$tables = array();
	foreach ( pronuvia_inspect_tables() as $t ) {
		$tables[] = array(
			'name'    => $t,
			'rows'    => (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$t}`" ), // phpcs:ignore
			'columns' => $wpdb->get_col( "SHOW COLUMNS FROM `{$t}`" ), // phpcs:ignore
		);
	}

	$roles = array();
	$count = count_users();
	foreach ( wp_roles()->roles as $slug => $r ) {
		$roles[ $slug ] = array(
			'name'  => $r['name'],
			'users' => (int) ( $count['avail_roles'][ $slug ] ?? 0 ),
		);
	}

	$hpos   = 'yes' === get_option( 'woocommerce_custom_orders_table_enabled' );
	$orders = array();
	if ( $hpos && in_array( $wpdb->prefix . 'wc_orders', $wpdb->get_col( 'SHOW TABLES' ), true ) ) {
		$orders = $wpdb->get_results( "SELECT status, YEAR(date_created_gmt) AS year, COUNT(*) AS n FROM {$wpdb->prefix}wc_orders WHERE type = 'shop_order' GROUP BY status, year ORDER BY year, status", ARRAY_A ); // phpcs:ignore
	} else {
		$orders = $wpdb->get_results( "SELECT post_status AS status, YEAR(post_date_gmt) AS year, COUNT(*) AS n FROM {$wpdb->posts} WHERE post_type = 'shop_order' GROUP BY status, year ORDER BY year, status", ARRAY_A ); // phpcs:ignore
	}

	$theme = wp_get_theme();
	return array(
		'site'          => array(
			'url'         => home_url(),
			'wp'          => get_bloginfo( 'version' ),
			'woocommerce' => defined( 'WC_VERSION' ) ? WC_VERSION : null,
			'hpos'        => $hpos,
			'currency'    => function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : null,
			'timezone'    => wp_timezone_string(),
			'php'         => PHP_VERSION,
			'theme'       => $theme->get( 'Name' ) . ' ' . $theme->get( 'Version' ),
		),
		'plugins'       => $plugins,
		'roles'         => $roles,
		'users_total'   => (int) $count['total_users'],
		'tables'        => $tables,
		'usermeta_keys' => $wpdb->get_results( "SELECT meta_key, COUNT(*) AS n FROM {$wpdb->usermeta} GROUP BY meta_key ORDER BY n DESC LIMIT 500", ARRAY_A ), // phpcs:ignore
		'post_types'    => $wpdb->get_results( "SELECT post_type, post_status, COUNT(*) AS n FROM {$wpdb->posts} GROUP BY post_type, post_status ORDER BY post_type", ARRAY_A ), // phpcs:ignore
		'orders'        => $orders,
		'option_names'  => $wpdb->get_col( "SELECT option_name FROM {$wpdb->options} WHERE option_name NOT LIKE '\_transient%' AND option_name NOT LIKE '\_site\_transient%' ORDER BY option_name" ), // phpcs:ignore
	);
}

// ── table: the rows of one table ──

function pronuvia_inspect_table( $request ) {
	global $wpdb;
	$name = (string) $request->get_param( 'name' );
	if ( ! in_array( $name, pronuvia_inspect_tables(), true ) ) {
		return new WP_Error( 'pronuvia_inspect_table', 'No such table (or it is not served).', array( 'status' => 404 ) );
	}
	$limit  = max( 1, min( 500, (int) ( $request->get_param( 'limit' ) ?: 100 ) ) );
	$offset = max( 0, (int) $request->get_param( 'offset' ) );
	$rows   = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM `{$name}` LIMIT %d OFFSET %d", $limit, $offset ), ARRAY_A ); // phpcs:ignore
	return array(
		'name'   => $name,
		'total'  => (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$name}`" ), // phpcs:ignore
		'offset' => $offset,
		'rows'   => array_map( 'pronuvia_inspect_row', $rows ),
	);
}

// ── users: each user with roles and all their meta ──

function pronuvia_inspect_users( $request ) {
	list( $per, $page ) = pronuvia_inspect_page_args( $request, 500 );
	$args = array( 'number' => $per, 'paged' => $page, 'orderby' => 'ID', 'order' => 'ASC', 'count_total' => true );
	$role = (string) $request->get_param( 'role' );
	if ( '' !== $role ) {
		$args['role'] = $role;
	}
	$query = new WP_User_Query( $args );
	$users = array();
	foreach ( $query->get_results() as $u ) {
		$meta = array();
		foreach ( get_user_meta( $u->ID ) as $k => $values ) {
			$meta[ $k ] = 1 === count( $values ) ? pronuvia_inspect_named( $k, $values[0] ) : array_map( function ( $v ) use ( $k ) {
				return pronuvia_inspect_named( $k, $v );
			}, $values );
		}
		$users[] = array(
			'id'         => $u->ID,
			'login'      => $u->user_login,
			'email'      => $u->user_email,
			'name'       => $u->display_name,
			'registered' => $u->user_registered,
			'roles'      => array_values( (array) $u->roles ),
			'meta'       => $meta,
		);
	}
	return array( 'total' => (int) $query->get_total(), 'page' => $page, 'users' => $users );
}

// ── passwords: the doctors' / reps' password hashes, so they keep their password ──

/**
 * Only doctors, reps and accounts with no role: never an admin or anyone
 * else. The hash is what WordPress stores (phpass or bcrypt), never the
 * password itself.
 */
function pronuvia_inspect_passwords() {
	global $wpdb;
	$out = array();
	foreach ( get_users( array( 'fields' => 'all', 'number' => -1 ) ) as $u ) {
		$roles = array_values( (array) $u->roles );
		$ok    = empty( $roles ) || ! array_diff( $roles, array( 'mlm_doctor', 'mlm_medial_rep' ) );
		if ( ! $ok || user_can( $u, 'manage_options' ) ) {
			continue;
		}
		$out[] = array(
			'id'   => $u->ID,
			'hash' => (string) $wpdb->get_var( $wpdb->prepare( "SELECT user_pass FROM {$wpdb->users} WHERE ID = %d", $u->ID ) ),
		);
	}
	return array( 'total' => count( $out ), 'users' => $out );
}

// ── orders: each order with items, refunds and all its meta ──

function pronuvia_inspect_orders( $request ) {
	if ( ! function_exists( 'wc_get_orders' ) ) {
		return new WP_Error( 'pronuvia_inspect_wc', 'WooCommerce is not active.', array( 'status' => 404 ) );
	}
	list( $per, $page ) = pronuvia_inspect_page_args( $request, 200 );
	$result = wc_get_orders( array(
		'type'     => 'shop_order',
		'status'   => array_keys( wc_get_order_statuses() ),
		'limit'    => $per,
		'paged'    => $page,
		'paginate' => true,
		'orderby'  => 'date',
		'order'    => 'ASC',
	) );
	$orders = array();
	foreach ( $result->orders as $o ) {
		$items = array();
		foreach ( $o->get_items() as $item ) {
			$product = $item->get_product();
			$items[] = array(
				'name'         => $item->get_name(),
				'product_id'   => $item->get_product_id(),
				'variation_id' => $item->get_variation_id(),
				'sku'          => $product ? $product->get_sku() : null,
				'qty'          => $item->get_quantity(),
				'subtotal'     => $item->get_subtotal(),
				'total'        => $item->get_total(),
				'meta'         => array_map( function ( $m ) {
					return array( 'key' => $m->key, 'value' => pronuvia_inspect_named( $m->key, $m->value ) );
				}, array_values( $item->get_meta_data() ) ),
			);
		}
		$orders[] = array(
			'id'             => $o->get_id(),
			'number'         => $o->get_order_number(),
			'status'         => $o->get_status(),
			'created'        => $o->get_date_created() ? $o->get_date_created()->date( 'c' ) : null,
			'paid'           => $o->get_date_paid() ? $o->get_date_paid()->date( 'c' ) : null,
			'completed'      => $o->get_date_completed() ? $o->get_date_completed()->date( 'c' ) : null,
			'currency'       => $o->get_currency(),
			'total'          => $o->get_total(),
			'subtotal'       => $o->get_subtotal(),
			'shipping_total' => $o->get_shipping_total(),
			'discount_total' => $o->get_discount_total(),
			'tax_total'      => $o->get_total_tax(),
			'refunded'       => $o->get_total_refunded(),
			'payment'        => $o->get_payment_method_title(),
			'customer_id'    => $o->get_customer_id(),
			'billing'        => $o->get_address( 'billing' ),
			'shipping'       => $o->get_address( 'shipping' ),
			'shipping_lines' => array_values( array_map( function ( $s ) {
				return array( 'method' => $s->get_method_title(), 'total' => $s->get_total() );
			}, $o->get_items( 'shipping' ) ) ),
			'coupons'        => $o->get_coupon_codes(),
			'refunds'        => array_map( function ( $r ) {
				return array(
					'id'     => $r->get_id(),
					'amount' => $r->get_amount(),
					'reason' => $r->get_reason(),
					'date'   => $r->get_date_created() ? $r->get_date_created()->date( 'c' ) : null,
					'items'  => array_values( array_map( function ( $i ) {
						return array( 'product_id' => $i->get_product_id(), 'variation_id' => $i->get_variation_id(), 'qty' => $i->get_quantity(), 'total' => $i->get_total() );
					}, $r->get_items() ) ),
				);
			}, $o->get_refunds() ),
			'customer_note'  => $o->get_customer_note(),
			'items'          => $items,
			'meta'           => array_map( function ( $m ) {
				return array( 'key' => $m->key, 'value' => pronuvia_inspect_named( $m->key, $m->value ) );
			}, array_values( $o->get_meta_data() ) ),
		);
	}
	return array( 'total' => (int) $result->total, 'page' => $page, 'orders' => $orders );
}
