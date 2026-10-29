"use client";

import {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
  useActionState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { stripePromise } from "@/lib/stripe/client";
import { useCart } from "@/lib/cart/cart-context";
import { confirmPhysicianCardOrder }  from "@/actions/physician/confirm-card-order";
import { payWithPhysicianWallet }     from "@/actions/physician/wallet-pay";
import { useCheckoutQuote, checkoutSubmission, type CheckoutPayload } from "@/lib/checkout/use-checkout-quote";
import { AddressFields, EMPTY_ADDRESS, migrateAddressData, serializeAddress } from "@/components/shared/address-fields";
import type { AddressData } from "@/components/shared/address-fields";
import { CheckoutOrderSummary } from "@/components/shared/checkout-order-summary";
import { StripeLoadingOverlay } from "@/components/shared/stripe-loading-overlay";
import { formatCurrency } from "@/lib/utils/currency";

function hasAddr(a: AddressData) {
  return !!(a.firstName || a.address1 || a.city);
}

function addrToString(a: AddressData): string {
  return serializeAddress(a);
}

type StripeHandle = { submit: () => void };

const StripeInnerForm = forwardRef<StripeHandle, {
  // What to buy; null until the server quote is ready
  checkout:         CheckoutPayload | null;
  // Structured billing address, passed to Stripe as payment_method_data so
  // the card form's country/ZIP match our own form instead of defaulting to US.
  billingAddressData: AddressData;
  total:            number;
  customerEmail:    string;
  onSuccess:        (orderNumber: string) => void;
  onProcessing:     (v: boolean) => void;
  onError:          (msg: string) => void;
  onStripeReady:    () => void;
  // The server priced the order differently (prices or shipping changed)
  onQuoteChanged:   () => void;
}>(function StripeInnerForm({ checkout, billingAddressData, total, customerEmail, onSuccess, onProcessing, onError, onStripeReady, onQuoteChanged }, ref) {
  const stripe   = useStripe();
  const elements = useElements();
  const [elementsReady, setElementsReady] = useState(false);

  // Keep Stripe Elements in sync with the current total (without remounting)
  useEffect(() => {
    if (!elements || total <= 0) return;
    elements.update({ amount: Math.round(total * 100) });
  }, [elements, total]);

  const handlePay = async () => {
    if (!stripe || !elements || !checkout) return;
    onProcessing(true);
    onError("");

    // 1. Validate payment details before any network call
    const { error: submitError } = await elements.submit();
    if (submitError) {
      onError(submitError.message ?? "Payment validation failed.");
      onProcessing(false);
      return;
    }

    // Lets the order be finished after a redirect back from the bank
    sessionStorage.setItem("ph_order", "1");

    // 2. The server prices the order in WooCommerce and creates a
    // PaymentIntent for that total (never an amount from the browser)
    let clientSecret: string;
    try {
      const resp = await fetch("/api/checkout/physician-payment-intent", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ checkout }),
      });
      const data = await resp.json() as { clientSecret?: string; error?: string; code?: string };
      if (data.code === "total_changed" || data.code === "rate_changed") onQuoteChanged();
      if (!data.clientSecret) throw new Error(data.error || "Could not initialize payment. Please try again.");
      clientSecret = data.clientSecret;
    } catch (err) {
      sessionStorage.removeItem("ph_order");
      onError(err instanceof Error ? err.message : "Could not initialize payment. Please try again.");
      onProcessing(false);
      return;
    }

    // 3. Confirm payment — billing_details is passed explicitly here (rather
    // than left for Stripe's own, hidden address fields) so the charge's
    // country/postal code match what the customer selected in our own
    // address form, not Stripe's US default.
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
      sessionStorage.removeItem("ph_order");
      onError(stripeError.message ?? "Payment failed.");
      onProcessing(false);
      return;
    }
    if (paymentIntent?.status === "succeeded") {
      sessionStorage.removeItem("ph_order");
      const result = await confirmPhysicianCardOrder({ paymentIntentId: paymentIntent.id });
      if (result.success && result.orderNumber) {
        onSuccess(result.orderNumber);
      } else {
        onError(result.message ?? "Order creation failed. Contact support.");
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
          // above — don't make the customer enter it a second time inside
          // the card element, and don't let Stripe default it to US.
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
  physicianEmail:  string;
  initialAddress:  Partial<AddressData> & { country?: string; state?: string };
  walletBalance:   number;
};

export function PhysicianCheckoutClient({ physicianEmail, initialAddress, walletBalance }: Props) {
  const { items, clearCart } = useCart();
  const router = useRouter();

  const migrated = migrateAddressData({ ...EMPTY_ADDRESS, ...initialAddress });
  const [email,         setEmail]         = useState("");
  const [phone,         setPhone]         = useState("");
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

  const stripeRef    = useRef<StripeHandle>(null);
  const walletFormRef = useRef<HTMLFormElement>(null);
  const [payMethod,    setPayMethod]    = useState<"CARD" | "WALLET">("CARD");
  const [walletState, walletFormAction, walletPending] = useActionState(payWithPhysicianWallet, undefined);

  const total          = totals?.total ?? 0;
  // While the total is being worked out, keep the wallet choice as it is
  const canWallet      = walletBalance > 0 && (!totals || (walletBalance >= total && total > 0));


  const shipStr = addrToString(shipTo);
  const billStr = addrToString(billing);

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
    customerPhone:   phone,
    expectedTotal:   totals.total,
  }) : null;

  const handleCardSuccess = (orderNumber: string) => {
    toast.success("Order placed successfully!");
    clearCart();
    router.push(`/physician/invoice/${orderNumber}`);
  };

  // Handle return from PayPal redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const piId   = params.get("payment_intent");
    const status = params.get("redirect_status");
    if (!piId || status !== "succeeded") return;

    if (!sessionStorage.getItem("ph_order")) return;
    sessionStorage.removeItem("ph_order");
    window.history.replaceState({}, "", window.location.pathname);

    setCardProcessing(true);
    confirmPhysicianCardOrder({ paymentIntentId: piId }).then((r) => {
      if (r.success && r.orderNumber) handleCardSuccess(r.orderNumber);
      else { setStripeError(r.message ?? "Order creation failed."); setCardProcessing(false); }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!walletState) return;
    if (walletState.success && walletState.orderNumber) {
      toast.success("Order placed successfully!");
      clearCart();
      router.push(`/physician/invoice/${walletState.orderNumber}`);
    } else if (!walletState.success && walletState.message) {
      toast.error(walletState.message);
      // Prices, shipping or the coupon may have changed: show the new totals
      retryShipping();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletState]);

  const handlePlaceOrder = () => {
    if (!email.trim()) { toast.error("Please enter the patient's email address."); return; }
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
    if (payMethod === "WALLET") {
      walletFormRef.current?.requestSubmit();
    } else {
      stripeRef.current?.submit();
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto text-center py-24">
        <p className="text-lg font-semibold text-gray-700 mb-2">Nothing to checkout</p>
        <p className="text-sm text-gray-400 mb-6">Add products to cart first.</p>
        <Link href="/physician/shop" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 transition-colors">
          Go to Shop
        </Link>
      </div>
    );
  }

  const stripeReady = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  return (
    <div className="">
      <StripeLoadingOverlay visible={stripeReady && payMethod === "CARD" && !paymentReady} />

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
                  Patient’s Email address <span className="text-red-500">*</span>
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
              <input
                type="checkbox"
                checked={shipToDifferent}
                onChange={(e) => {
                  setShipToDifferent(e.target.checked);
                  if (e.target.checked && !hasAddr(shipping)) {
                    setShipping({ ...billing });
                  }
                }}
                className="w-4 h-4 rounded border-gray-300 accent-gray-900"
              />
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

            {/* Payment method selector — only shown when wallet can cover the order */}
            {canWallet && (
              <div className="border border-gray-300 rounded divide-y divide-gray-100 mb-4">
                <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="payMethod"
                    checked={payMethod === "CARD"}
                    onChange={() => setPayMethod("CARD")}
                    className="accent-gray-900"
                  />
                  <span className="flex-1 text-sm font-medium text-gray-800">Credit / Debit Card</span>
                </label>
                <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="payMethod"
                    checked={payMethod === "WALLET"}
                    onChange={() => setPayMethod("WALLET")}
                    className="accent-gray-900"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">Wallet Credit</p>
                    <p className="text-xs text-gray-500">Balance: {formatCurrency(walletBalance)}</p>
                  </div>
                </label>
              </div>
            )}

            {/* Card payment panel — Elements pre-loaded immediately, no PI needed until submit */}
            {payMethod === "CARD" && (
              <div className="border border-gray-300 rounded p-4">
                {!canWallet && (
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm text-gray-800 font-medium">Credit / Debit Card</span>
                  </div>
                )}
                {!stripeReady ? (
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-700">
                    Stripe is not configured.
                  </div>
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
                        checkout={checkout}
                        billingAddressData={billing}
                        total={total}
                        customerEmail={email}
                        onSuccess={handleCardSuccess}
                        onProcessing={setCardProcessing}
                        onError={(msg) => { setStripeError(msg); if (msg) toast.error(msg); }}
                        onStripeReady={() => setPaymentReady(true)}
                        onQuoteChanged={retryShipping}
                      />
                    </Elements>
                  </div>
                )}
                {stripeError && (
                  <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{stripeError}</p>
                )}
              </div>
            )}

            {/* Wallet payment panel */}
            {payMethod === "WALLET" && (
              <div className="border border-gray-300 rounded p-4 space-y-3">
                <p className="text-sm text-gray-700">
                  Your wallet balance of{" "}
                  <span className="font-semibold">{formatCurrency(walletBalance)}</span>{" "}
                  will be used to pay the order total of{" "}
                  <span className="font-semibold">{formatCurrency(total)}</span>.
                </p>
                {walletState && !walletState.success && walletState.message && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
                    {walletState.message}
                  </p>
                )}
                <form ref={walletFormRef} action={walletFormAction} className="hidden">
                  <input type="hidden" name="checkout" value={checkout ? JSON.stringify(checkout) : ""} />
                </form>
              </div>
            )}
          </section>

          <p className="text-xs text-gray-500">
            By proceeding you agree to our{" "}
            <Link href="/terms" className="underline hover:text-gray-700">Terms and Conditions</Link>.
          </p>

          <button type="button" onClick={handlePlaceOrder}
            disabled={cardProcessing || walletPending || !email.trim() || !hasAddr(billing) || !hasAddr(shipTo) || !selectedShipping || !checkout}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white text-sm font-bold rounded transition-colors">
            {(cardProcessing || walletPending) ? (
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
