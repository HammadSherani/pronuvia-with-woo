"use client";

import {
  useState, useEffect,
  forwardRef, useImperativeHandle, useRef,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { stripePromise } from "@/lib/stripe/client";
import { useCart } from "@/lib/cart/cart-context";
import { confirmBehalfCardOrder } from "@/actions/admin/order-behalf";
import { useCheckoutQuote, checkoutSubmission, type CheckoutPayload } from "@/lib/checkout/use-checkout-quote";
import { AddressFields, EMPTY_ADDRESS, migrateAddressData, serializeAddress } from "@/components/shared/address-fields";
import type { AddressData } from "@/components/shared/address-fields";
import { CheckoutOrderSummary } from "@/components/shared/checkout-order-summary";
import { StripeLoadingOverlay } from "@/components/shared/stripe-loading-overlay";

function hasAddr(a: AddressData) {
  return !!(a.firstName || a.address1 || a.city);
}

type StripeHandle  = { submit: () => void };

const StripeInnerForm = forwardRef<StripeHandle, {
  physicianId:     string;
  // What to buy; null until the server quote is ready
  checkout:        CheckoutPayload | null;
  // Structured billing address, passed to Stripe as payment_method_data so
  // the card form's country/ZIP match our own form instead of defaulting to US.
  billingAddressData: AddressData;
  total:           number;
  customerEmail?:  string;
  onSuccess:       (orderNumber: string) => void;
  onProcessing:    (v: boolean) => void;
  onError:         (msg: string) => void;
  onStripeReady:   () => void;
  // The server priced the order differently (prices or shipping changed)
  onQuoteChanged:  () => void;
}>(function StripeInnerForm({ physicianId, checkout, billingAddressData, total, customerEmail, onSuccess, onProcessing, onError, onStripeReady, onQuoteChanged }, ref) {
  const stripe   = useStripe();
  const elements = useElements();
  const [elementsReady, setElementsReady] = useState(false);

  // Keep Elements amount in sync without remounting
  useEffect(() => {
    if (!elements) return;
    elements.update({ amount: Math.max(50, Math.round(total * 100)) });
  }, [elements, total]);

  const handlePay = async () => {
    if (!stripe || !elements || !checkout) return;
    onProcessing(true);
    onError("");

    // Step 1: validate card fields without a network call
    const { error: submitError } = await elements.submit();
    if (submitError) {
      onError(submitError.message ?? "Please complete your payment details.");
      onProcessing(false);
      return;
    }

    // Step 2: the server prices the order in WooCommerce and creates a
    // PaymentIntent for that total (never an amount from the browser)
    let clientSecret: string;
    try {
      const res  = await fetch("/api/checkout/admin-behalf-payment-intent", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ checkout, physicianId }),
      });
      const data = await res.json();
      if (data.code === "total_changed" || data.code === "rate_changed") onQuoteChanged();
      if (!data.clientSecret) throw new Error(data.error || "Could not start payment. Try again.");
      clientSecret = data.clientSecret;
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not start payment. Try again.");
      onProcessing(false);
      return;
    }

    // Lets the order be finished if the bank redirects back (3-D Secure)
    sessionStorage.setItem("ab_order", "1");

    // Step 3: confirm with the real clientSecret — billing_details is passed
    // explicitly here (rather than left for Stripe's own, hidden address
    // fields) so the charge's country/postal code match what was selected
    // in our own address form, not Stripe's US default.
    const billingName = [billingAddressData.firstName, billingAddressData.lastName].filter(Boolean).join(" ");
    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      redirect: "if_required",
      confirmParams: {
        return_url: `${window.location.origin}${window.location.pathname}`,
        payment_method_data: {
          billing_details: {
            name:    billingName || undefined,
            email:   customerEmail || undefined,
            phone:   billingAddressData.phone || undefined,
            address: {
              line1:       billingAddressData.address1 || undefined,
              line2:       billingAddressData.address2 || undefined,
              city:        billingAddressData.city      || undefined,
              state:       billingAddressData.state     || undefined,
              postal_code: billingAddressData.zip       || undefined,
              country:     billingAddressData.country   || undefined,
            },
          },
        },
      },
    });

    if (stripeError) {
      sessionStorage.removeItem("ab_order");
      onError(stripeError.message ?? "Payment failed.");
      onProcessing(false);
      return;
    }
    if (paymentIntent?.status === "succeeded") {
      sessionStorage.removeItem("ab_order");
      const result = await confirmBehalfCardOrder({ physicianId, paymentIntentId: paymentIntent.id });
      if (result.success && result.orderNumber) {
        onSuccess(result.orderNumber);
      } else {
        onError(result.message ?? "Order creation failed.");
        onProcessing(false);
      }
    } else {
      onError("Unexpected payment status. Please try again.");
      onProcessing(false);
    }
  };

  useEffect(() => {
    if (elementsReady) onStripeReady();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementsReady]);

  useImperativeHandle(ref, () => ({ submit: handlePay }));
  return (
    <div className="relative min-h-[180px]">
      <PaymentElement
        onReady={() => setElementsReady(true)}
        options={{
          layout: "tabs",
          wallets: { applePay: "auto", googlePay: "auto", link: "never" } as Record<string, string>,
          terms:   { card: "never", usBankAccount: "never", auBecsDebit: "never", bancontact: "never", ideal: "never", sepaDebit: "never", sofort: "never" },
          // We already collect a full billing address in our own form
          // above — don't make the admin enter it a second time inside the
          // card element, and don't let Stripe default it to US.
          fields:  { billingDetails: { address: "never" } },
        }}
      />
      {!elementsReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-white rounded">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="w-4 h-4 border-2 border-gray-200 border-t-[#3DBFA4] rounded-full animate-spin" />
            Loading secure payment fields…
          </div>
        </div>
      )}
    </div>
  );
});

type Props = {
  physicianId:    string;
  physicianName:  string;
  physicianEmail: string;
  initialAddress: Partial<AddressData>;
};

export function BehalfCheckoutClient({ physicianId, physicianName, physicianEmail, initialAddress }: Props) {
  const { items, clearCart } = useCart();
  const router = useRouter();

  const migrated = migrateAddressData({ ...EMPTY_ADDRESS, ...initialAddress });
  const [email,         setEmail]         = useState("");
  // Billing is the main address (as on WooCommerce); shipping only when
  // "Ship to a different address?" is ticked
  const [billing,       setBilling]       = useState<AddressData>(migrated);
  const [shipping,      setShipping]      = useState<AddressData>(migrated);
  const [shipToDifferent, setShipToDifferent] = useState(false);
  const shipTo = shipToDifferent ? shipping : billing;

  // Shipping options
  const quote = useCheckoutQuote(items, shipTo);
  const {
    options:     shippingOptions,
    selected:    selectedShipping,
    loading:     loadingShipping,
    retry:       retryShipping,
    totals, coupon: appliedCoupon,
  } = quote;

  const [notes,          setNotes]          = useState("");
  const [paymentReady,   setPaymentReady]   = useState(false);
  const [stripeError,    setStripeError]    = useState("");
  const [cardProcessing, setCardProcessing] = useState(false);

  const stripeRef = useRef<StripeHandle>(null);

  const total          = totals?.total ?? 0;


  const shipStr = serializeAddress(shipTo);
  const billStr = serializeAddress(billing);

  // What the server prices and places. The only amount is the total shown,
  // so the server can refuse to charge anything different.
  const checkout: CheckoutPayload | null = totals && selectedShipping ? checkoutSubmission({
    items,
    shippingAddress: shipStr,
    billingAddress:  billStr,
    shippingRateId:  selectedShipping.id,
    couponCode:      appliedCoupon?.code ?? null,
    notes,
    customerEmail:   email,
    customerPhone:   billing.phone,
    expectedTotal:   totals.total,
  }) : null;

  const handleCardSuccess = (_orderNumber: string) => {
    toast.success("Order placed successfully!");
    clearCart();
    router.push(`/admin/orders`);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const piId   = params.get("payment_intent");
    const status = params.get("redirect_status");
    if (!piId || status !== "succeeded") return;

    if (!sessionStorage.getItem("ab_order")) return;
    sessionStorage.removeItem("ab_order");
    window.history.replaceState({}, "", window.location.pathname);

    setCardProcessing(true);
    confirmBehalfCardOrder({ physicianId, paymentIntentId: piId }).then((r) => {
      if (r.success && r.orderNumber) handleCardSuccess(r.orderNumber);
      else { setStripeError(r.message ?? "Order creation failed."); setCardProcessing(false); }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlaceOrder = () => {
    if (!hasAddr(billing)) { toast.error("Please enter the billing address."); return; }
    if (!hasAddr(shipTo)) { toast.error("Please enter the shipping address."); return; }
    if (!selectedShipping) {
      toast.error(loadingShipping ? "Shipping rates are still loading." : shippingOptions.length > 0 ? "Please select a shipping method." : "Shipping is not available for this address.");
      return;
    }
    if (!checkout) {
      toast.error("The order total is still being calculated.");
      return;
    }
    stripeRef.current?.submit();
  };

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto text-center py-24">
        <p className="text-lg font-semibold text-gray-700 mb-2">Nothing to checkout</p>
        <p className="text-sm text-gray-400 mb-6">Add products to the cart first.</p>
        <Link href={`/admin/order-behalf/${physicianId}/shop`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 transition-colors">
          Go to Shop
        </Link>
      </div>
    );
  }

  const stripeReady = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  return (
    <div className="">
      <StripeLoadingOverlay visible={stripeReady && !paymentReady} />
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Checkout</h1>
      <div className="h-0.5 bg-gray-900 mb-6" />

      {/* Laid out like the WooCommerce checkout: billing / shipping / notes on
          the left, "Your order" with payment and Place Order on the right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

        {/* LEFT */}
        <div className="space-y-8">

          {/* Billing details */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Billing details</h2>
            <AddressFields value={billing} onChange={setBilling} variant="woo">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Patient&apos;s Email address <span className="text-gray-400 font-normal">(for order confirmation)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white"
                />
              </div>
            </AddressFields>
          </section>

          {/* Ship to a different address? */}
          <section>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={shipToDifferent}
                onChange={(e) => { setShipToDifferent(e.target.checked); if (e.target.checked && !hasAddr(shipping)) setShipping({ ...billing }); }}
                className="w-4 h-4 rounded border-gray-300 accent-gray-900" />
              <span className="text-xl font-semibold text-gray-900">Ship to a different address?</span>
            </label>
            {shipToDifferent && (
              <div className="mt-4">
                <AddressFields value={shipping} onChange={setShipping} variant="woo" />
              </div>
            )}
          </section>

          {/* Additional information */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Additional information</h2>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              Order notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes about your order, e.g. special notes for delivery."
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none placeholder:text-gray-400" />
          </section>
        </div>

        {/* RIGHT — Your order */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Your order</h2>
          <CheckoutOrderSummary items={items} quote={quote} shipTo={shipTo} />

          {/* Payment */}
          <section>
            <h2 className="text-base font-semibold text-gray-800 mb-3">Payment</h2>
            <div className="border border-gray-300 rounded p-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-gray-800 font-medium">Credit / Debit Card</span>
              </div>
              {!stripeReady ? (
                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-700">Stripe is not configured.</div>
              ) : (
                <div className="relative">
                  {!paymentReady && (
                    <div className="absolute inset-0 z-10 bg-white flex flex-col gap-3 py-1 pointer-events-none">
                      <div className="h-12 rounded bg-gray-100 animate-pulse" />
                      <div className="flex gap-3">
                        <div className="h-12 rounded bg-gray-100 animate-pulse flex-1" />
                        <div className="h-12 rounded bg-gray-100 animate-pulse flex-1" />
                      </div>
                      <div className="h-4 rounded bg-gray-100 animate-pulse w-3/5" />
                    </div>
                  )}
                  <Elements
                    stripe={stripePromise}
                    options={{
                      mode:       "payment",
                      amount:     Math.max(50, Math.round(total * 100)),
                      currency:   "usd",
                      paymentMethodTypes: ["card"],
                      appearance: { theme: "stripe", variables: { colorPrimary: "#3DBFA4", borderRadius: "4px", fontFamily: "inherit" } },
                    }}
                  >
                    <StripeInnerForm
                      ref={stripeRef}
                      physicianId={physicianId}
                      checkout={checkout}
                      billingAddressData={billing}
                      total={total}
                      customerEmail={email || undefined}
                      onSuccess={handleCardSuccess}
                      onProcessing={setCardProcessing}
                      onError={(msg) => { setStripeError(msg); if (msg) toast.error(msg); }}
                      onStripeReady={() => setPaymentReady(true)}
                      onQuoteChanged={retryShipping}
                    />
                  </Elements>
                </div>
              )}
              {stripeError && <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{stripeError}</p>}
            </div>
          </section>

          <button type="button" onClick={handlePlaceOrder}
            disabled={cardProcessing || !hasAddr(billing) || !hasAddr(shipTo) || !selectedShipping || !checkout}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white text-sm font-bold rounded transition-colors">
            {cardProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Placing order…
              </span>
            ) : "Place Order"}
          </button>
        </div>
      </div>
    </div>
  );
}
