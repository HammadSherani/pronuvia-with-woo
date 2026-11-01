<?php
/**
 * Plugin Name: Pronuvia Staging Guard
 * Description: For a COPY of the live site only. Sends no email and calls no outside service (Stripe, HubSpot, Jetpack, FedEx, WooCommerce Shipping…), except the Pronuvia app and wordpress.org, so nothing done on the copy reaches real customers or the client's accounts.
 * Version:     1.0.0
 * Author:      Pronuvia
 * Requires PHP: 7.4
 *
 * A must-use plugin: put this file in wp-content/mu-plugins/ of the copy
 * (never on the live site). It is on before any other plugin, so even the
 * live site's plugins that come with the copy can't send anything:
 *   - every wp_mail() is stopped (and counted as sent, so nothing retries);
 *   - every outgoing HTTP request is stopped, except to this site itself,
 *     wordpress.org, *.vercel.app and the hosts in PRONUVIA_GUARD_ALLOW
 *     (wp-config.php: define( 'PRONUVIA_GUARD_ALLOW', 'app.example.com' );
 *     comma-separated) — that is where the WooCommerce webhooks go.
 * The last 50 stopped emails / requests show in a red notice in WP admin.
 * Also put define( 'DISABLE_WP_CRON', true ); in wp-config.php.
 */

defined( 'ABSPATH' ) || exit;

const PRONUVIA_GUARD_LOG = 'pronuvia_staging_guard_log';

/** True for this site, wordpress.org, *.vercel.app and PRONUVIA_GUARD_ALLOW hosts (and their subdomains). */
function pronuvia_guard_allowed( $host ) {
	$host  = strtolower( (string) $host );
	$allow = array( 'wordpress.org', 'vercel.app', 'localhost', '127.0.0.1', strtolower( (string) wp_parse_url( home_url(), PHP_URL_HOST ) ) );
	if ( defined( 'PRONUVIA_GUARD_ALLOW' ) ) {
		$allow = array_merge( $allow, array_map( 'trim', explode( ',', strtolower( (string) PRONUVIA_GUARD_ALLOW ) ) ) );
	}
	foreach ( $allow as $a ) {
		if ( '' !== $a && ( $host === $a || substr( $host, -strlen( '.' . $a ) ) === '.' . $a ) ) {
			return true;
		}
	}
	return false;
}

function pronuvia_guard_log( $kind, $what ) {
	$log   = (array) get_option( PRONUVIA_GUARD_LOG, array() );
	$log[] = array( 'at' => gmdate( 'Y-m-d H:i:s' ), 'kind' => $kind, 'what' => substr( (string) $what, 0, 200 ) );
	update_option( PRONUVIA_GUARD_LOG, array_slice( $log, -50 ), false );
}

// Outgoing HTTP: only to the allowed hosts
add_filter( 'pre_http_request', 'pronuvia_guard_http', 1, 3 );
function pronuvia_guard_http( $pre, $args, $url ) {
	if ( false !== $pre ) {
		return $pre;
	}
	$host = wp_parse_url( $url, PHP_URL_HOST );
	if ( ! $host || pronuvia_guard_allowed( $host ) ) {
		return $pre;
	}
	pronuvia_guard_log( 'http', strtok( $url, '?' ) );
	return new WP_Error( 'pronuvia_staging_guard', 'Blocked on the staging copy: ' . $host );
}

// Email: none at all (reported as sent, so nothing queues it again)
add_filter( 'pre_wp_mail', 'pronuvia_guard_mail', 1, 2 );
function pronuvia_guard_mail( $null, $atts ) {
	$to = isset( $atts['to'] ) ? ( is_array( $atts['to'] ) ? implode( ', ', $atts['to'] ) : $atts['to'] ) : '';
	pronuvia_guard_log( 'mail', $to . ' — ' . ( $atts['subject'] ?? '' ) );
	return true;
}

add_action( 'admin_notices', 'pronuvia_guard_notice' );
function pronuvia_guard_notice() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$log  = (array) get_option( PRONUVIA_GUARD_LOG, array() );
	$rows = '';
	foreach ( array_slice( array_reverse( $log ), 0, 5 ) as $e ) {
		$rows .= '<li><code>' . esc_html( $e['at'] . ' ' . $e['kind'] . ' ' . $e['what'] ) . '</code></li>';
	}
	echo '<div class="notice notice-error"><p><strong>Staging guard active:</strong> this is a copy of the live site. No email is sent and no outside service is called (only the Pronuvia app and wordpress.org). Stopped so far: ' . count( $log ) . ( $log ? ' (latest below)' : '' ) . '.</p>' . ( $rows ? '<ul>' . $rows . '</ul>' : '' ) . '</div>';
}
