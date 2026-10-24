<?php
/**
 * Plugin Name: Pronuvia Customer Accounts
 * Description: Gives each Pronuvia rep / doctor customer account the site's sales rep / doctor role (mlm_sales_rep / doctor), and keeps its username equal to their Pronuvia Login ID.
 * Version:     1.1.0
 * Author:      Pronuvia
 * Requires PHP: 7.4
 *
 * Pronuvia creates a WooCommerce customer account for each sales rep and
 * doctor (so their orders belong to them) and writes two meta on it:
 *   - `pronuvia_role` (SALES_REP / PHYSICIAN): the account gets the site's
 *     existing role `mlm_sales_rep` / `doctor` instead of Customer (they are
 *     created, with Customer permissions, only if missing);
 *   - `pronuvia_login_id`: WordPress can't change a username, so this plugin
 *     renames the account to the Login ID.
 * `pronuvia_role` = DELETED (sent by Pronuvia right before it deletes the
 * account, when the rep / doctor is deleted there) puts the role back to
 * Customer, the only role WooCommerce lets its API delete.
 * Only Pronuvia customer accounts are touched, never an account that can
 * manage the site, and never a username another user has. These accounts are
 * never used to log in (Pronuvia login stays in Pronuvia).
 */

defined( 'ABSPATH' ) || exit;

// The site's existing roles (from its earlier setup); label used only if missing
const PRONUVIA_CUSTOMER_ROLES = array(
	'SALES_REP' => array( 'mlm_sales_rep', 'Sales Rep' ),
	'PHYSICIAN' => array( 'doctor', 'Doctor' ),
);

// Only if a role is missing: create it with what a Customer can do
add_action( 'init', 'pronuvia_customer_roles_register' );
function pronuvia_customer_roles_register() {
	$customer = get_role( 'customer' );
	$caps     = $customer ? $customer->capabilities : array( 'read' => true );
	foreach ( PRONUVIA_CUSTOMER_ROLES as $pair ) {
		if ( ! get_role( $pair[0] ) ) {
			add_role( $pair[0], $pair[1], $caps );
		}
	}
}

// On activation: the Pronuvia accounts that already exist get their role and
// username (later changes come through the meta hooks below)
register_activation_hook( __FILE__, 'pronuvia_customer_accounts_activate' );
function pronuvia_customer_accounts_activate() {
	pronuvia_customer_roles_register();
	$ids = get_users( array( 'meta_key' => 'pronuvia_role', 'fields' => 'ID', 'number' => -1 ) );
	foreach ( $ids as $id ) {
		pronuvia_customer_set_role( (int) $id, (string) get_user_meta( $id, 'pronuvia_role', true ) );
		$login = (string) get_user_meta( $id, 'pronuvia_login_id', true );
		if ( '' !== $login ) {
			pronuvia_username_rename( (int) $id, $login );
		}
	}
}

add_action( 'added_user_meta', 'pronuvia_customer_meta_follow', 10, 4 );
add_action( 'updated_user_meta', 'pronuvia_customer_meta_follow', 10, 4 );
function pronuvia_customer_meta_follow( $meta_id, $user_id, $meta_key, $meta_value ) {
	if ( 'pronuvia_login_id' === $meta_key ) {
		pronuvia_username_rename( (int) $user_id, (string) $meta_value );
	} elseif ( 'pronuvia_role' === $meta_key ) {
		pronuvia_customer_set_role( (int) $user_id, (string) $meta_value );
	}
}

function pronuvia_customer_is_admin( $user ) {
	return user_can( $user, 'manage_options' ) || user_can( $user, 'manage_woocommerce' );
}

/** Sales Rep / Doctor role from Pronuvia's role; returns what happened. */
function pronuvia_customer_set_role( $user_id, $pronuvia_role ) {
	$user = get_userdata( $user_id );
	if ( ! $user ) {
		return 'no user';
	}
	if ( 'DELETED' !== $pronuvia_role && ! isset( PRONUVIA_CUSTOMER_ROLES[ $pronuvia_role ] ) ) {
		return 'unknown role';
	}
	if ( pronuvia_customer_is_admin( $user ) ) {
		return 'admin account';
	}
	if ( 'DELETED' === $pronuvia_role ) {
		$user->set_role( 'customer' );
		return 'role reset';
	}
	pronuvia_customer_roles_register();
	$role = PRONUVIA_CUSTOMER_ROLES[ $pronuvia_role ][0];
	if ( array( $role ) === array_values( (array) $user->roles ) ) {
		return 'nothing to change';
	}
	$user->set_role( $role );
	return 'role set';
}

/** Renames the user to the Login ID; returns the reason when it doesn't. */
function pronuvia_username_rename( $user_id, $login_id ) {
	global $wpdb;
	$user = get_userdata( $user_id );
	if ( ! $user ) {
		return 'no user';
	}
	if ( '' === (string) get_user_meta( $user_id, 'pronuvia_role', true ) ) {
		return 'not a Pronuvia customer';
	}
	if ( pronuvia_customer_is_admin( $user ) ) {
		return 'admin account';
	}
	$new = sanitize_user( strtolower( trim( $login_id ) ), true );
	if ( strlen( $new ) < 3 || $new === $user->user_login ) {
		return 'nothing to change';
	}
	$taken = username_exists( $new );
	if ( $taken && (int) $taken !== $user_id ) {
		return 'username taken';
	}
	$wpdb->update( $wpdb->users, array( 'user_login' => $new ), array( 'ID' => $user_id ) );
	clean_user_cache( $user_id );
	return 'renamed';
}
