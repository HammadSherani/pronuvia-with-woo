<?php
/**
 * Plugin Name: Pronuvia Commissions
 * Description: Approve, reject or modify the doctor / sales rep commission of a Pronuvia order, on the WooCommerce order page.
 * Version:     1.0.1
 * Author:      Pronuvia
 * Requires PHP: 7.4
 *
 * Pronuvia sends each order with its commissions in the order meta
 * `pronuvia_commission_review` (JSON: physician / sales_rep → status, amount,
 * original). This box shows them; an admin decision is saved back into that
 * meta with an order note, and the order save makes WooCommerce notify
 * Pronuvia (order.updated webhook), which pays only approved commission.
 * Once Pronuvia has paid the commission (`pronuvia_commission_paid` = yes),
 * the box only shows it.
 */

defined( 'ABSPATH' ) || exit;

const PRONUVIA_COMM_REVIEW_KEY = 'pronuvia_commission_review';
const PRONUVIA_COMM_PAID_KEY   = 'pronuvia_commission_paid';
const PRONUVIA_COMM_NONCE      = 'pronuvia_commission_review';

function pronuvia_comm_roles() {
	return array(
		'physician' => array( 'label' => 'Doctor', 'name_key' => 'pronuvia_physician_name' ),
		'sales_rep' => array( 'label' => 'Sales Rep', 'name_key' => 'pronuvia_sales_rep_name' ),
	);
}

function pronuvia_comm_read( $order ) {
	$raw = $order->get_meta( PRONUVIA_COMM_REVIEW_KEY );
	$val = is_array( $raw ) ? $raw : json_decode( (string) $raw, true );
	return is_array( $val ) ? $val : array();
}

/** Paid by Pronuvia, or the order no longer earns commission. */
function pronuvia_comm_locked( $order ) {
	if ( $order->get_meta( PRONUVIA_COMM_PAID_KEY ) === 'yes' ) {
		return 'Paid';
	}
	if ( in_array( $order->get_status(), array( 'cancelled', 'refunded', 'trash' ), true ) ) {
		return 'Order ' . $order->get_status();
	}
	return false;
}

// ── Meta box ──────────────────────────────────────────────────────────────

add_action( 'add_meta_boxes', function () {
	// HPOS order screen, or the classic one
	$screen = function_exists( 'wc_get_page_screen_id' ) ? wc_get_page_screen_id( 'shop-order' ) : 'shop_order';
	add_meta_box( 'pronuvia-commissions', 'Commissions', 'pronuvia_comm_box', $screen, 'normal', 'default' );
} );

function pronuvia_comm_box( $post_or_order ) {
	$order = $post_or_order instanceof WP_Post ? wc_get_order( $post_or_order->ID ) : $post_or_order;
	if ( ! $order || ! $order->get_meta( 'pronuvia_order_id' ) ) {
		echo '<p>Not a Pronuvia order.</p>';
		return;
	}
	$review = pronuvia_comm_read( $order );
	$locked = pronuvia_comm_locked( $order );
	$date   = $order->get_date_created() ? $order->get_date_created()->date_i18n( 'Y-m-d H:i:s' ) : '';

	if ( ! $review ) {
		echo '<p>No commission on this order.</p>';
		return;
	}
	?>
	<table class="widefat striped pronuvia-commissions" data-order="<?php echo esc_attr( $order->get_id() ); ?>"
		data-nonce="<?php echo esc_attr( wp_create_nonce( PRONUVIA_COMM_NONCE ) ); ?>">
		<thead>
			<tr><th>User</th><th>Commission</th><th>Earned On</th><th>Status</th><th>Action</th></tr>
		</thead>
		<tbody>
		<?php foreach ( pronuvia_comm_roles() as $role => $info ) :
			if ( empty( $review[ $role ] ) || ! is_array( $review[ $role ] ) ) {
				continue;
			}
			$e        = $review[ $role ];
			$amount   = (float) ( $e['amount'] ?? 0 );
			$original = isset( $e['original'] ) ? (float) $e['original'] : $amount;
			$status   = (string) ( $e['status'] ?? 'pending' );
			$name     = (string) $order->get_meta( $info['name_key'] );
			?>
			<tr data-role="<?php echo esc_attr( $role ); ?>">
				<td><?php echo esc_html( $name ? $name : $info['label'] ); ?><br><small><?php echo esc_html( $info['label'] ); ?></small></td>
				<td>
					<?php echo wp_kses_post( wc_price( $amount ) ); ?>
					<?php if ( abs( $original - $amount ) > 0.004 ) : ?>
						<br><small>was <del><?php echo wp_kses_post( wc_price( $original ) ); ?></del></small>
					<?php endif; ?>
				</td>
				<td><?php echo esc_html( $date ); ?></td>
				<td>
					<strong><?php echo esc_html( $locked === 'Paid' ? 'paid' : $status ); ?></strong>
					<?php if ( ! empty( $e['note'] ) ) : ?><br><small><?php echo esc_html( $e['note'] ); ?></small><?php endif; ?>
					<?php if ( ! empty( $e['by'] ) ) : ?><br><small>by <?php echo esc_html( $e['by'] ); ?></small><?php endif; ?>
				</td>
				<td>
					<?php if ( $locked ) : ?>
						<em><?php echo esc_html( $locked ); ?></em>
					<?php else : ?>
						<p style="margin:0 0 6px">
							<button type="button" class="button" data-decision="approve">Approve</button>
							<button type="button" class="button" data-decision="reject">Reject</button>
						</p>
						<p style="margin:0 0 6px">
							<input type="number" step="0.01" min="0" class="pc-amount" style="width:90px" value="<?php echo esc_attr( number_format( $amount, 2, '.', '' ) ); ?>">
							<button type="button" class="button" data-decision="modify">Modify</button>
						</p>
						<input type="text" class="pc-note" placeholder="Note (optional)" style="width:100%">
					<?php endif; ?>
				</td>
			</tr>
		<?php endforeach; ?>
		</tbody>
	</table>
	<?php if ( ! $locked ) : ?>
		<p class="description">An approved commission moves to Commission Payout in Pronuvia once every commission on this order is reviewed.</p>
	<?php endif; ?>
	<script>
	( function () {
		var table = document.querySelector( 'table.pronuvia-commissions' );
		if ( ! table ) return;
		table.addEventListener( 'click', function ( ev ) {
			var btn = ev.target.closest( 'button[data-decision]' );
			if ( ! btn ) return;
			var row = btn.closest( 'tr' );
			var body = new FormData();
			body.append( 'action', 'pronuvia_commission_review' );
			body.append( 'nonce', table.dataset.nonce );
			body.append( 'order_id', table.dataset.order );
			body.append( 'role', row.dataset.role );
			body.append( 'decision', btn.dataset.decision );
			body.append( 'amount', row.querySelector( '.pc-amount' ).value );
			body.append( 'note', row.querySelector( '.pc-note' ).value );
			row.querySelectorAll( 'button' ).forEach( function ( b ) { b.disabled = true; } );
			fetch( ajaxurl, { method: 'POST', credentials: 'same-origin', body: body } )
				.then( function ( r ) { return r.json(); } )
				.then( function ( res ) {
					if ( res && res.success ) { window.location.reload(); return; }
					alert( ( res && res.data && res.data.message ) || 'Could not save the commission.' );
					row.querySelectorAll( 'button' ).forEach( function ( b ) { b.disabled = false; } );
				} )
				.catch( function () {
					alert( 'Could not save the commission.' );
					row.querySelectorAll( 'button' ).forEach( function ( b ) { b.disabled = false; } );
				} );
		} );
	} )();
	</script>
	<?php
}

// ── Saving a decision ─────────────────────────────────────────────────────

/**
 * Applies one decision to the review. Returns the updated review and the
 * order note, or a WP_Error.
 */
function pronuvia_comm_decide( array $review, $role, $decision, $amount_raw, $note, $by ) {
	$roles = pronuvia_comm_roles();
	if ( ! isset( $roles[ $role ] ) || empty( $review[ $role ] ) || ! is_array( $review[ $role ] ) ) {
		return new WP_Error( 'role', 'This order has no such commission.' );
	}
	$e        = $review[ $role ];
	$current  = (float) ( $e['amount'] ?? 0 );
	$original = isset( $e['original'] ) ? (float) $e['original'] : $current;
	$label    = $roles[ $role ]['label'];
	$note     = trim( (string) $note );

	if ( 'approve' === $decision ) {
		$e['status'] = 'approved';
		$text        = sprintf( '%s commission approved: %s.', $label, wp_strip_all_tags( wc_price( $current ) ) );
	} elseif ( 'reject' === $decision ) {
		$e['status'] = 'rejected';
		$text        = sprintf( '%s commission rejected (%s).', $label, wp_strip_all_tags( wc_price( $current ) ) );
	} elseif ( 'modify' === $decision ) {
		if ( ! is_numeric( $amount_raw ) || (float) $amount_raw < 0 || (float) $amount_raw > 1000000 ) {
			return new WP_Error( 'amount', 'Enter a commission amount of 0 or more.' );
		}
		$new         = round( (float) $amount_raw, 2 );
		$e['status'] = 'approved';
		$e['amount'] = $new;
		$text        = sprintf( '%s commission modified: %s → %s.', $label, wp_strip_all_tags( wc_price( $current ) ), wp_strip_all_tags( wc_price( $new ) ) );
	} else {
		return new WP_Error( 'decision', 'Unknown action.' );
	}

	$e['original'] = $original;
	$e['note']     = $note;
	$e['at']       = gmdate( 'c' );
	$e['by']       = $by;
	$review[ $role ] = $e;
	if ( '' !== $note ) {
		$text .= ' Note: ' . $note;
	}
	return array( 'review' => $review, 'note' => $text );
}

add_action( 'wp_ajax_pronuvia_commission_review', 'pronuvia_comm_ajax' );

function pronuvia_comm_ajax() {
	check_ajax_referer( PRONUVIA_COMM_NONCE, 'nonce' );
	if ( ! current_user_can( 'manage_woocommerce' ) ) {
		wp_send_json_error( array( 'message' => 'You are not allowed to change commissions.' ), 403 );
	}

	$order = wc_get_order( absint( $_POST['order_id'] ?? 0 ) );
	if ( ! $order || ! $order->get_meta( 'pronuvia_order_id' ) ) {
		wp_send_json_error( array( 'message' => 'Order not found.' ), 404 );
	}
	$locked = pronuvia_comm_locked( $order );
	if ( $locked ) {
		wp_send_json_error( array( 'message' => 'This commission can no longer be changed (' . $locked . ').' ), 409 );
	}

	$user   = wp_get_current_user();
	$result = pronuvia_comm_decide(
		pronuvia_comm_read( $order ),
		sanitize_key( wp_unslash( $_POST['role'] ?? '' ) ),
		sanitize_key( wp_unslash( $_POST['decision'] ?? '' ) ),
		wp_unslash( $_POST['amount'] ?? '' ),
		sanitize_text_field( wp_unslash( $_POST['note'] ?? '' ) ),
		$user && $user->exists() ? $user->display_name : 'admin'
	);
	if ( is_wp_error( $result ) ) {
		wp_send_json_error( array( 'message' => $result->get_error_message() ), 400 );
	}

	$order->update_meta_data( PRONUVIA_COMM_REVIEW_KEY, wp_json_encode( $result['review'] ) );
	$order->add_order_note( $result['note'], false, true );
	$order->save(); // fires order.updated → Pronuvia picks the decision up
	wp_send_json_success( array( 'review' => $result['review'] ) );
}
