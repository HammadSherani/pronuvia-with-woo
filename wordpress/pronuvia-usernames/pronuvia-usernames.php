<?php
/**
 * Plugin Name: Pronuvia Usernames
 * Description: Keeps the username of each Pronuvia rep / doctor customer account equal to their Pronuvia Login ID.
 * Version:     1.0.0
 * Author:      Pronuvia
 * Requires PHP: 7.4
 *
 * Pronuvia writes the Login ID to the customer's `pronuvia_login_id` meta
 * (when the account is created or the rep / doctor is saved). WordPress has no
 * way to change a username, so this plugin does it when that meta is set:
 * only for Pronuvia customer accounts (meta `pronuvia_role`), never for an
 * account that can manage the site, and only when no other user has that
 * username. These accounts are never used to log in.
 */

defined( 'ABSPATH' ) || exit;

add_action( 'added_user_meta', 'pronuvia_username_follow', 10, 4 );
add_action( 'updated_user_meta', 'pronuvia_username_follow', 10, 4 );

function pronuvia_username_follow( $meta_id, $user_id, $meta_key, $meta_value ) {
	if ( 'pronuvia_login_id' !== $meta_key ) {
		return;
	}
	pronuvia_username_rename( (int) $user_id, (string) $meta_value );
}

/** Renames the user; returns the reason when it doesn't. */
function pronuvia_username_rename( $user_id, $login_id ) {
	global $wpdb;
	$user = get_userdata( $user_id );
	if ( ! $user ) {
		return 'no user';
	}
	if ( '' === (string) get_user_meta( $user_id, 'pronuvia_role', true ) ) {
		return 'not a Pronuvia customer';
	}
	if ( user_can( $user, 'manage_options' ) || user_can( $user, 'manage_woocommerce' ) ) {
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
