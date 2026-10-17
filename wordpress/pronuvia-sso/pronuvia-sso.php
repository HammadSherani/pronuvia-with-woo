<?php
/**
 * Plugin Name: Pronuvia SSO
 * Description: Signs the Pronuvia admin into WP admin from the Pronuvia dashboard, without a second password.
 * Version:     1.0.0
 * Author:      Pronuvia
 * Requires PHP: 7.4
 *
 * The Pronuvia dashboard (/api/woo/sso) sends the admin here with
 * ?pronuvia_sso=<token>: an HS256 JWT signed with the secret both sides share,
 * valid for 60 seconds and usable once. If it checks out, the WP user with the
 * same email (an administrator or shop manager) is logged in and taken to the
 * WP admin page in the token. Anything else stops with a message; nobody is
 * logged in.
 *
 * Setup, in wp-config.php:
 *   define( 'PRONUVIA_SSO_SECRET', '<same value as WOO_SSO_SECRET in Pronuvia>' );
 *   // Optional, only when the WP admin's email differs from the Pronuvia admin's:
 *   // define( 'PRONUVIA_SSO_USER', '<WP username>' );
 */

defined( 'ABSPATH' ) || exit;

const PRONUVIA_SSO_AUDIENCE = 'pronuvia-wp-sso';
const PRONUVIA_SSO_LEEWAY   = 30; // seconds of clock difference allowed

function pronuvia_sso_b64url_decode( $data ) {
	$data = strtr( $data, '-_', '+/' );
	$pad  = strlen( $data ) % 4;
	if ( $pad ) {
		$data .= str_repeat( '=', 4 - $pad );
	}
	return base64_decode( $data, true );
}

/**
 * The token's claims, or a WP_Error saying why it was refused.
 */
function pronuvia_sso_verify( $token, $secret ) {
	$parts = explode( '.', $token );
	if ( count( $parts ) !== 3 ) {
		return new WP_Error( 'malformed', 'Malformed sign-in link.' );
	}
	list( $h64, $p64, $s64 ) = $parts;

	$header = json_decode( (string) pronuvia_sso_b64url_decode( $h64 ), true );
	if ( ! is_array( $header ) || ( $header['alg'] ?? '' ) !== 'HS256' ) {
		return new WP_Error( 'alg', 'Unsupported sign-in link.' );
	}

	$expected = hash_hmac( 'sha256', $h64 . '.' . $p64, $secret, true );
	$given    = pronuvia_sso_b64url_decode( $s64 );
	if ( $given === false || ! hash_equals( $expected, $given ) ) {
		return new WP_Error( 'signature', 'This sign-in link is not valid.' );
	}

	$claims = json_decode( (string) pronuvia_sso_b64url_decode( $p64 ), true );
	if ( ! is_array( $claims ) ) {
		return new WP_Error( 'malformed', 'Malformed sign-in link.' );
	}
	$now = time();
	if ( ( $claims['aud'] ?? '' ) !== PRONUVIA_SSO_AUDIENCE ) {
		return new WP_Error( 'audience', 'This sign-in link is not for this site.' );
	}
	if ( empty( $claims['exp'] ) || $now > (int) $claims['exp'] + PRONUVIA_SSO_LEEWAY ) {
		return new WP_Error( 'expired', 'This sign-in link has expired. Open it again from the Pronuvia dashboard.' );
	}
	if ( ! empty( $claims['iat'] ) && (int) $claims['iat'] > $now + PRONUVIA_SSO_LEEWAY ) {
		return new WP_Error( 'future', 'This sign-in link is not valid yet. Check the server clocks.' );
	}
	if ( empty( $claims['jti'] ) || empty( $claims['email'] ) || empty( $claims['to'] ) ) {
		return new WP_Error( 'malformed', 'Malformed sign-in link.' );
	}
	return $claims;
}

/** Only pages inside WP admin, so the link can't send anyone elsewhere. */
function pronuvia_sso_is_admin_path( $path ) {
	return is_string( $path )
		&& preg_match( '#^/wp-admin/[\w\-./?=&%]*$#', $path )
		&& strpos( $path, '..' ) === false
		&& strpos( $path, '//' ) === false;
}

function pronuvia_sso_stop( $message, $status = 403 ) {
	wp_die(
		esc_html( $message ),
		esc_html__( 'Pronuvia sign-in' ),
		array( 'response' => $status, 'back_link' => false )
	);
}

function pronuvia_sso_handle() {
	if ( ! isset( $_GET['pronuvia_sso'] ) ) {
		return;
	}
	nocache_headers();

	if ( ! defined( 'PRONUVIA_SSO_SECRET' ) || strlen( PRONUVIA_SSO_SECRET ) < 32 ) {
		pronuvia_sso_stop( 'Pronuvia sign-in is not set up on this site (PRONUVIA_SSO_SECRET).', 500 );
	}

	$claims = pronuvia_sso_verify( sanitize_text_field( wp_unslash( $_GET['pronuvia_sso'] ) ), PRONUVIA_SSO_SECRET );
	if ( is_wp_error( $claims ) ) {
		pronuvia_sso_stop( $claims->get_error_message() );
	}
	if ( ! pronuvia_sso_is_admin_path( $claims['to'] ) ) {
		pronuvia_sso_stop( 'This sign-in link points outside WP admin.' );
	}

	// Each link works once
	$used_key = 'pronuvia_sso_' . md5( (string) $claims['jti'] );
	if ( get_transient( $used_key ) ) {
		pronuvia_sso_stop( 'This sign-in link was already used. Open it again from the Pronuvia dashboard.' );
	}
	set_transient( $used_key, 1, 5 * MINUTE_IN_SECONDS );

	$user = defined( 'PRONUVIA_SSO_USER' ) && PRONUVIA_SSO_USER
		? get_user_by( 'login', PRONUVIA_SSO_USER )
		: get_user_by( 'email', sanitize_email( $claims['email'] ) );
	if ( ! $user ) {
		pronuvia_sso_stop( 'No WordPress user has the email of this Pronuvia admin.' );
	}
	if ( ! user_can( $user, 'manage_options' ) && ! user_can( $user, 'manage_woocommerce' ) ) {
		pronuvia_sso_stop( 'This WordPress user is not an administrator or shop manager.' );
	}

	wp_clear_auth_cookie();
	wp_set_current_user( $user->ID );
	wp_set_auth_cookie( $user->ID, false, is_ssl() );
	do_action( 'wp_login', $user->user_login, $user );

	wp_safe_redirect( site_url( $claims['to'] ) );
	exit;
}
add_action( 'init', 'pronuvia_sso_handle', 1 );
