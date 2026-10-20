<?php
/**
 * Plugin Name: Pronuvia Commissions
 * Description: Approve, reject or modify the doctor / sales rep commission of a Pronuvia order, on the WooCommerce order page.
 * Version:     1.6.0
 * Author:      Pronuvia
 * Requires PHP: 7.4
 *
 * Pronuvia sends each order with its commissions in the order meta
 * `pronuvia_commission_review` (JSON: physician / sales_rep → status, amount,
 * original). This box shows them; an admin decision is saved back into that
 * meta with an order note, and the order save makes WooCommerce notify
 * Pronuvia (order.updated webhook), which pays only approved commission.
 *
 * What each status offers: pending → Approve, Reject, Modify; approved →
 * Reject; rejected → Approve, Modify. Modify changes only the amount, the
 * status stays as it is. Each action is also added to the role's `history`
 * in the review meta, so Pronuvia shows the full commission history on the
 * order pages, also of actions made one right after the other.
 *
 * An order refund cuts the commission by the refunded share (Pronuvia does
 * it, and sends the total cut per role in `pronuvia_commission_cuts`). The box
 * shows what is left as the commission; Modify sets what is left (the cut
 * stays on top); with nothing left the row offers no actions.
 *
 * Once every commission on the order is reviewed it goes into the wallets and
 * Commission Payout (`pronuvia_commission_paid` = yes, "in payout"). It can
 * still be approved / rejected / modified as often as needed: Pronuvia moves
 * the wallet by the difference. When the user's payout is approved in
 * Pronuvia, that row is paid out (`pronuvia_commission_paid_out`, a JSON list
 * of roles) and fixed; the admin can then only "Refund commission": take back
 * any part of it (e.g. after the order was refunded). Pronuvia takes that off
 * the user's wallet (which may go below zero) and lists it under Rejected
 * Commission.
 */

defined( 'ABSPATH' ) || exit;

const PRONUVIA_COMM_REVIEW_KEY = 'pronuvia_commission_review';
const PRONUVIA_COMM_PAID_KEY   = 'pronuvia_commission_paid';
const PRONUVIA_COMM_OUT_KEY    = 'pronuvia_commission_paid_out';
const PRONUVIA_COMM_CUTS_KEY   = 'pronuvia_commission_cuts';
const PRONUVIA_COMM_NONCE      = 'pronuvia_commission_review';

function pronuvia_comm_roles() {
	return array(
		'physician' => array( 'label' => 'Doctor', 'name_key' => 'pronuvia_physician_name' ),
		'sales_rep' => array( 'label' => 'Sales Rep', 'name_key' => 'pronuvia_sales_rep_name' ),
	);
}

function pronuvia_comm_refunded( array $e ) {
	$sum = 0;
	foreach ( (array) ( $e['refunds'] ?? array() ) as $r ) {
		$sum += (float) ( $r['amount'] ?? 0 );
	}
	return round( $sum, 2 );
}

function pronuvia_comm_read( $order ) {
	$raw = $order->get_meta( PRONUVIA_COMM_REVIEW_KEY );
	$val = is_array( $raw ) ? $raw : json_decode( (string) $raw, true );
	return is_array( $val ) ? $val : array();
}

/** In the wallets / Commission Payout (still changeable until paid out). */
function pronuvia_comm_in_payout( $order ) {
	return $order->get_meta( PRONUVIA_COMM_PAID_KEY ) === 'yes';
}

/** Commission each role lost to order refunds (set by Pronuvia). */
function pronuvia_comm_cut( $order, $role ) {
	$raw = $order->get_meta( PRONUVIA_COMM_CUTS_KEY );
	$val = is_array( $raw ) ? $raw : json_decode( (string) $raw, true );
	return is_array( $val ) && isset( $val[ $role ] ) ? round( max( 0, (float) $val[ $role ] ), 2 ) : 0.0;
}

/** Roles whose payout Pronuvia has approved. */
function pronuvia_comm_paid_out( $order ) {
	$raw = $order->get_meta( PRONUVIA_COMM_OUT_KEY );
	$val = is_array( $raw ) ? $raw : json_decode( (string) $raw, true );
	return is_array( $val ) ? array_values( array_filter( $val, 'is_string' ) ) : array();
}

/**
 * Why a row can't be approved / rejected / modified: paid out, or the order
 * no longer earns commission and none of it is in payout. False when open.
 */
function pronuvia_comm_locked( $order, $role ) {
	if ( in_array( $role, pronuvia_comm_paid_out( $order ), true ) ) {
		return 'Paid out';
	}
	$review = pronuvia_comm_read( $order );
	$cut    = pronuvia_comm_cut( $order, $role );
	if ( $cut > 0 && (float) ( $review[ $role ]['amount'] ?? 0 ) - $cut <= 0.004 ) {
		return 'Order refunded: no commission left';
	}
	if ( ! pronuvia_comm_in_payout( $order ) && in_array( $order->get_status(), array( 'cancelled', 'refunded', 'trash' ), true ) ) {
		return 'Order ' . $order->get_status();
	}
	return false;
}

/** The actions a commission in this status offers (Modify keeps the status). */
function pronuvia_comm_allowed( $status ) {
	if ( 'approved' === $status ) {
		return array( 'reject' );
	}
	if ( 'rejected' === $status ) {
		return array( 'approve', 'modify' );
	}
	return array( 'approve', 'reject', 'modify' );
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
	$review    = pronuvia_comm_read( $order );
	$in_payout = pronuvia_comm_in_payout( $order );
	$any_out   = false;
	$any_open  = false;
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
			$cut      = pronuvia_comm_cut( $order, $role );
			$net      = round( max( 0, $amount - $cut ), 2 );   // what is left after order refunds
			$locked   = pronuvia_comm_locked( $order, $role );
			$any_out  = $any_out || 'Paid out' === $locked;
			$any_open = $any_open || ! $locked;
			$shown    = 'Paid out' === $locked ? 'paid out' : ( $in_payout && 'pending' !== $status ? $status . ' (in payout)' : $status );
			?>
			<tr data-role="<?php echo esc_attr( $role ); ?>">
				<td><?php echo esc_html( $name ? $name : $info['label'] ); ?><br><small><?php echo esc_html( $info['label'] ); ?></small></td>
				<td>
					<strong><?php echo wp_kses_post( wc_price( $net ) ); ?></strong>
					<?php if ( $cut > 0 ) : ?>
						<br><small>of <del><?php echo wp_kses_post( wc_price( $amount ) ); ?></del></small>
						<br><small style="color:#b45309">−<?php echo wp_kses_post( wc_price( $cut ) ); ?> order refunded</small>
					<?php endif; ?>
					<?php if ( abs( $original - $amount ) > 0.004 ) : ?>
						<br><small>earned <?php echo wp_kses_post( wc_price( $original ) ); ?>, modified</small>
					<?php endif; ?>
				</td>
				<td><?php echo esc_html( $date ); ?></td>
				<td>
					<strong><?php echo esc_html( $shown ); ?></strong>
					<?php if ( ! empty( $e['note'] ) ) : ?><br><small><?php echo esc_html( $e['note'] ); ?></small><?php endif; ?>
					<?php if ( ! empty( $e['by'] ) ) : ?><br><small>by <?php echo esc_html( $e['by'] ); ?></small><?php endif; ?>
					<?php foreach ( (array) ( $e['refunds'] ?? array() ) as $r ) : ?>
						<br><small style="color:#b32d2e">Refunded <?php echo wp_kses_post( wc_price( (float) ( $r['amount'] ?? 0 ) ) ); ?><?php echo ! empty( $r['note'] ) ? ': ' . esc_html( $r['note'] ) : ''; ?></small>
					<?php endforeach; ?>
				</td>
				<td>
					<?php
					$left = round( $amount - $cut - pronuvia_comm_refunded( $e ), 2 );
					if ( 'Paid out' === $locked && 'approved' === $status && $left > 0 ) : ?>
						<p style="margin:0 0 6px">
							<input type="number" step="0.01" min="0.01" max="<?php echo esc_attr( number_format( $left, 2, '.', '' ) ); ?>" class="pc-amount" style="width:90px" placeholder="<?php echo esc_attr( number_format( $left, 2, '.', '' ) ); ?>">
							<button type="button" class="button" data-decision="refund">Refund commission</button>
						</p>
						<input type="text" class="pc-note" placeholder="Note (optional)" style="width:100%">
						<br><small>Up to <?php echo wp_kses_post( wc_price( $left ) ); ?></small>
					<?php elseif ( $locked ) : ?>
						<em><?php echo esc_html( $locked ); ?></em>
					<?php else :
						$allowed = pronuvia_comm_allowed( $status ); ?>
						<p style="margin:0 0 6px">
							<?php if ( in_array( 'approve', $allowed, true ) ) : ?>
								<button type="button" class="button" data-decision="approve">Approve</button>
							<?php endif; ?>
							<?php if ( in_array( 'reject', $allowed, true ) ) : ?>
								<button type="button" class="button" data-decision="reject">Reject</button>
							<?php endif; ?>
						</p>
						<?php if ( in_array( 'modify', $allowed, true ) ) : ?>
							<p style="margin:0 0 6px">
								<input type="number" step="0.01" min="0" class="pc-amount" style="width:90px" value="<?php echo esc_attr( number_format( $net, 2, '.', '' ) ); ?>">
								<button type="button" class="button" data-decision="modify">Modify</button>
							</p>
						<?php endif; ?>
						<input type="text" class="pc-note" placeholder="Note (optional)" style="width:100%">
					<?php endif; ?>
				</td>
			</tr>
		<?php endforeach; ?>
		</tbody>
	</table>
	<?php if ( $any_open ) : ?>
		<p class="description">
			<?php echo $in_payout
				? 'This commission is in Commission Payout in Pronuvia. It can still be changed until the payout is approved there; the wallet follows each change. Modify changes only the amount, not the status.'
				: 'An approved commission moves to Commission Payout in Pronuvia once every commission on this order is reviewed. It can be changed until the payout is approved there. Modify changes only the amount, not the status.'; ?>
		</p>
	<?php endif; ?>
	<?php if ( $any_out ) : ?>
		<p class="description">Paid out commission can no longer be changed. Refunding the order does not take it back: use Refund commission for the part to take back.</p>
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
			var amount = row.querySelector( '.pc-amount' ), note = row.querySelector( '.pc-note' );
			body.append( 'amount', amount ? amount.value : '' );
			body.append( 'note', note ? note.value : '' );
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
function pronuvia_comm_decide( array $review, $role, $decision, $amount_raw, $note, $by, $cut = 0.0 ) {
	$roles = pronuvia_comm_roles();
	if ( ! isset( $roles[ $role ] ) || empty( $review[ $role ] ) || ! is_array( $review[ $role ] ) ) {
		return new WP_Error( 'role', 'This order has no such commission.' );
	}
	$e        = $review[ $role ];
	$current  = (float) ( $e['amount'] ?? 0 );
	$original = isset( $e['original'] ) ? (float) $e['original'] : $current;
	$cut      = round( max( 0, (float) $cut ), 2 );
	$net      = round( max( 0, $current - $cut ), 2 );   // what is left after order refunds
	$label    = $roles[ $role ]['label'];
	$note     = trim( (string) $note );
	$status   = (string) ( $e['status'] ?? 'pending' );

	if ( 'refund' !== $decision && ! in_array( $decision, pronuvia_comm_allowed( $status ), true ) ) {
		return new WP_Error( 'decision', sprintf( 'This commission is %s: it can only be %s now.', $status, implode( ' or ', array_map( function ( $d ) { return $d . 'd'; }, pronuvia_comm_allowed( $status ) ) ) ) );
	}

	if ( 'approve' === $decision ) {
		$e['status'] = 'approved';
		$text        = sprintf( '%s commission approved: %s.', $label, wp_strip_all_tags( wc_price( $net ) ) );
	} elseif ( 'reject' === $decision ) {
		$e['status'] = 'rejected';
		$text        = sprintf( '%s commission rejected (%s).', $label, wp_strip_all_tags( wc_price( $net ) ) );
	} elseif ( 'modify' === $decision ) {
		if ( ! is_numeric( $amount_raw ) || (float) $amount_raw < 0 || (float) $amount_raw > 1000000 ) {
			return new WP_Error( 'amount', 'Enter a commission amount of 0 or more.' );
		}
		// Only the amount: the status stays as it is. The admin sets what is
		// left; the order refunds' cut stays on top of it
		$new         = round( (float) $amount_raw, 2 );
		$e['amount'] = round( $new + $cut, 2 );
		$text        = sprintf( '%s commission modified: %s → %s (still %s).', $label, wp_strip_all_tags( wc_price( $net ) ), wp_strip_all_tags( wc_price( $new ) ), $status );
	} elseif ( 'refund' === $decision ) {
		$left = round( $current - $cut - pronuvia_comm_refunded( $e ), 2 );
		if ( ! is_numeric( $amount_raw ) || (float) $amount_raw <= 0 ) {
			return new WP_Error( 'amount', 'Enter the commission amount to refund.' );
		}
		$amt = round( (float) $amount_raw, 2 );
		if ( $amt > $left ) {
			return new WP_Error( 'amount', sprintf( 'At most %s can be refunded.', wp_strip_all_tags( wc_price( $left ) ) ) );
		}
		$e['refunds']   = array_values( (array) ( $e['refunds'] ?? array() ) );
		$e['refunds'][] = array( 'id' => uniqid( 'r', true ), 'amount' => $amt, 'note' => trim( (string) $note ), 'at' => gmdate( 'c' ), 'by' => $by );
		$review[ $role ] = $e;
		$text = sprintf( '%s commission refunded: %s.', $label, wp_strip_all_tags( wc_price( $amt ) ) );
		if ( '' !== trim( (string) $note ) ) {
			$text .= ' Note: ' . trim( (string) $note );
		}
		return array( 'review' => $review, 'note' => $text );
	} else {
		return new WP_Error( 'decision', 'Unknown action.' );
	}

	$e['original'] = $original;
	$e['note']     = $note;
	$e['at']       = gmdate( 'c' );
	$e['by']       = $by;
	$history       = array_values( (array) ( $e['history'] ?? array() ) );
	$history[]     = array(
		'id'     => uniqid( 'h', true ),
		'action' => 'approve' === $decision ? 'approved' : ( 'reject' === $decision ? 'rejected' : 'modified' ),
		'amount' => round( max( 0, (float) $e['amount'] - $cut ), 2 ),
		'prev'   => 'modify' === $decision ? $net : null,
		'note'   => $note,
		'at'     => $e['at'],
		'by'     => $by,
	);
	$e['history']    = array_slice( $history, -100 );
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
	$role     = sanitize_key( wp_unslash( $_POST['role'] ?? '' ) );
	$locked   = pronuvia_comm_locked( $order, $role );
	$decision = sanitize_key( wp_unslash( $_POST['decision'] ?? '' ) );
	if ( 'refund' === $decision ) {
		if ( 'Paid out' !== $locked ) {
			wp_send_json_error( array( 'message' => 'Only a paid out commission can be refunded. Before the payout, reject or modify it instead.' ), 409 );
		}
	} elseif ( $locked ) {
		wp_send_json_error( array( 'message' => 'This commission can no longer be changed (' . $locked . ').' ), 409 );
	}

	$user   = wp_get_current_user();
	$result = pronuvia_comm_decide(
		pronuvia_comm_read( $order ),
		$role,
		$decision,
		wp_unslash( $_POST['amount'] ?? '' ),
		sanitize_text_field( wp_unslash( $_POST['note'] ?? '' ) ),
		$user && $user->exists() ? $user->display_name : 'admin',
		pronuvia_comm_cut( $order, $role )
	);
	if ( is_wp_error( $result ) ) {
		wp_send_json_error( array( 'message' => $result->get_error_message() ), 400 );
	}

	$order->update_meta_data( PRONUVIA_COMM_REVIEW_KEY, wp_json_encode( $result['review'] ) );
	$order->add_order_note( $result['note'], false, true );
	$order->save(); // fires order.updated → Pronuvia picks the decision up
	wp_send_json_success( array( 'review' => $result['review'] ) );
}
