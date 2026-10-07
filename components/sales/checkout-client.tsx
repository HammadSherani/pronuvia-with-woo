"use client";

import {
  useState,
  useEffect,
  useTransition,
  useActionState,
  forwardRef,
  useImperativeHandle,
  useRef,
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
import { confirmCardOrder } from "@/actions/sales-rep/confirm-card-order";
import { payWithWallet } from "@/actions/sales-rep/wallet-pay";
import { saveCheckoutAddress } from "@/actions/sales-rep/save-address";
import { validateCoupon }      from "@/actions/checkout/validate-coupon";
import { getShippingOptionsForCountry } from "@/lib/shipping/calculate";
import { AddressFields, EMPTY_ADDRESS, migrateAddressData, serializeAddress } from "@/components/shared/address-fields";
import type { AddressData } from "@/components/shared/address-fields";
import { StripeLoadingOverlay } from "@/components/shared/stripe-loading-overlay";
import { formatCurrency } from "@/lib/utils/currency";

type ShippingOption = { id: string; method: string; label: string; cost: number };

// ── Address helpers ─────────────────────────────────────────────────────────

function parseAddr(raw: string): AddressData {
  if (!raw) return EMPTY_ADDRESS;
  try {
    const p = JSON.parse(raw);
    if (p && typeof p.firstName === "string") return migrateAddressData(p);
  } catch { /* plain text — ignore */ }
  return EMPTY_ADDRESS;
}

function hasAddr(a: AddressData) {
  return !!(a.firstName || a.address1 || a.city);
}

function addrToString(a: AddressData): string {
  return serializeAddress(a);
}

// ── Stripe inner form (must live inside <Elements>) ─────────────────────────

type AppliedCoupon = { couponId: string; code: string; discountAmount: number };

type StripeHandle = { submit: () => void };
type StripeFormProps = {
  itemsJson:        string;
  shippingAddress:  string;
  billingAddress?:  string;
  // The structured (not serialized) address used for billing — passed
  // straight to Stripe as payment_method_data.billing_details so the card
  // form's own address/country/ZIP fields (which we hide) match what the
  // customer actually picked in our own form, instead of Stripe's default.
  billingAddressData: AddressData;
  notes:            string;
  shippingRate:     number;
  shippingMethod?:  string;
  total:            number;
  couponId?:        string;
  couponCode?:      string;
  discountAmount?:  number;
  customerEmail?:   string;
  customerPhone?:   string;
  onSuccess:        (orderNumber: string) => void;
  onProcessing:     (v: boolean) => void;
  onError:          (msg: string) => void;
  onStripeReady:    () => void;
};

const StripeInnerForm = forwardRef<StripeHandle, StripeFormProps>(
  function StripeInnerForm(
    { itemsJson, shippingAddress, billingAddress, billingAddressData, notes, shippingRate, shippingMethod, total, couponId, couponCode, discountAmount, customerEmail, customerPhone, onSuccess, onProcessing, onError, onStripeReady },
    ref
  ) {
    const stripe   = useStripe();
    const elements = useElements();
    const [elementsReady, setElementsReady] = useState(false);

    // Keep Elements amount in sync without remounting
    useEffect(() => {
      if (!elements) return;
      elements.update({ amount: Math.max(50, Math.round(total * 100)) });
    }, [elements, total]);

    const handlePay = async () => {
      if (!stripe || !elements) return;
      onProcessing(true);
      onError("");

      // Step 1: validate card fields without a network call
      const { error: submitError } = await elements.submit();
      if (submitError) {
        onError(submitError.message ?? "Please complete your payment details.");
        onProcessing(false);
        return;
      }

      // Step 2: create PaymentIntent server-side
      let clientSecret: string;
      try {
        const res  = await fetch("/api/checkout/create-payment-intent", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ amountInCents: Math.max(50, Math.round(total * 100)) }),
        });
        const data = await res.json();
        if (!data.clientSecret) throw new Error("No client secret returned.");
        clientSecret = data.clientSecret;
      } catch (err) {
        onError(err instanceof Error ? err.message : "Could not start payment. Try again.");
        onProcessing(false);
        return;
      }

      sessionStorage.setItem("sr_order", JSON.stringify({
        itemsJson, shippingAddress, billingAddress, notes, shippingRate, shippingMethod, total, couponId, couponCode, discountAmount, customerEmail, customerPhone,
      }));

      // Step 3: confirm with the real clientSecret — billing_details is passed
      // explicitly here (rather than left for Stripe's own, hidden address
      // fields) so the charge's country/postal code match what the customer
      // actually selected in our own address form, not Stripe's US default.
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
        sessionStorage.removeItem("sr_order");
        onError(stripeError.message ?? "Payment failed.");
        onProcessing(false);
        return;
      }

      if (paymentIntent?.status === "succeeded") {
        sessionStorage.removeItem("sr_order");
        const result = await confirmCardOrder({
          paymentIntentId: paymentIntent.id,
          itemsJson, shippingAddress, billingAddress, notes, shippingRate, shippingMethod, total, couponId, couponCode, discountAmount,
          customerEmail: customerEmail || undefined,
          customerPhone: customerPhone || undefined,
        });
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
  }
);

// ── Main component ──────────────────────────────────────────────────────────

type Props = {
  savedShippingAddress: string;
  savedBillingAddress:  string;
  walletBalance:        number;
  commission:           number;
};

export function CheckoutClient({
  savedShippingAddress,
  savedBillingAddress,
  walletBalance,
  commission,
}: Props) {
  const { items, clearCart } = useCart();
  const router = useRouter();

  const [patientEmail,  setPatientEmail]  = useState("");
  const [patientPhone,  setPatientPhone]  = useState("");

  // address
  const [shipping,      setShipping]      = useState<AddressData>(() => parseAddr(savedShippingAddress));
  const [billing,       setBilling]       = useState<AddressData>(() => {
    const b = parseAddr(savedBillingAddress);
    return hasAddr(b) ? b : parseAddr(savedShippingAddress);
  });
  const [sameAsBilling, setSameAsBilling] = useState(true);

  // shipping options
  const [shippingOptions,  setShippingOptions]  = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  const [loadingShipping,  setLoadingShipping]  = useState(false);

  useEffect(() => {
    if (!shipping.country) {
      setShippingOptions([]);
      setSelectedShipping(null);
      return;
    }
    setLoadingShipping(true);
    getShippingOptionsForCountry(shipping.country, shipping.state || undefined)
      .then((opts) => {
        setShippingOptions(opts);
        setSelectedShipping(opts.length > 0 ? opts[0] : null);
      })
      .catch(() => {
        setShippingOptions([]);
        setSelectedShipping(null);
      })
      .finally(() => setLoadingShipping(false));
  }, [shipping.country, shipping.state]);

  // coupon
  const [couponInput,    setCouponInput]    = useState("");
  const [appliedCoupon,  setAppliedCoupon]  = useState<AppliedCoupon | null>(null);
  const [couponError,    setCouponError]    = useState("");
  const [couponPending,  startCoupon]       = useTransition();

  // payment
  const [payMethod,      setPayMethod]      = useState<"CARD" | "WALLET">("CARD");
  const [notes,          setNotes]          = useState("");
  const [showNotes,      setShowNotes]      = useState(false);
  const [paymentReady,   setPaymentReady]   = useState(false);
  const [stripeError,    setStripeError]    = useState("");
  const [cardProcessing, setCardProcessing] = useState(false);

  const stripeRef    = useRef<StripeHandle>(null);
  const walletSubmit = useRef<HTMLButtonElement>(null);

  const subtotal       = parseFloat(items.reduce((s, i) => s + i.unitPrice * i.quantity, 0).toFixed(2));
  const shippingCost   = selectedShipping?.cost ?? 0;
  const discountAmount = appliedCoupon?.discountAmount ?? 0;
  const total          = parseFloat(Math.max(0, subtotal - discountAmount + shippingCost).toFixed(2));
  const cashback       = commission > 0 ? parseFloat((subtotal * commission / 100).toFixed(2)) : 0;
  const canWallet      = walletBalance > 0 && walletBalance >= total && total > 0;

  // If the total changes (coupon, shipping) and wallet can no longer cover it, fall back to card
  useEffect(() => {
    if (!canWallet && payMethod === "WALLET") setPayMethod("CARD");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canWallet]);

  const itemsJson = JSON.stringify(items.map((i) => ({
    productId:   i.productId,
    title:       i.productTitle,
    variantSize: i.variantSize,
    sku:         i.variantSku,
    unitPrice:   i.unitPrice,
    quantity:    i.quantity,
    lineTotal:   parseFloat((i.unitPrice * i.quantity).toFixed(2)),
  })));
  const shipStr = addrToString(shipping);
  const billStr = addrToString(sameAsBilling ? shipping : billing);


  // Remember the address used for this order so the next checkout starts
  // from it instead of always falling back to the (possibly stale) profile
  // address. Best-effort — never blocks the order-success flow.
  const rememberAddress = () => {
    saveCheckoutAddress({ shipping, billing: sameAsBilling ? shipping : billing }).catch(() => {});
  };

  // wallet action
  const [walletState, walletAction, walletPending] = useActionState(payWithWallet, undefined);
  useEffect(() => {
    if (!walletState) return;
    if (walletState.success && walletState.orderNumber) {
      toast.success("Order placed successfully!");
      rememberAddress();
      clearCart();
      router.push(`/sales/invoice/${walletState.orderNumber}`);
    } else if (walletState.message) {
      toast.error(walletState.message);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletState, clearCart, router]);

  const handleCardSuccess = (orderNumber: string) => {
    toast.success("Order placed successfully!");
    rememberAddress();
    clearCart();
    router.push(`/sales/invoice/${orderNumber}`);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const piId   = params.get("payment_intent");
    const status = params.get("redirect_status");
    if (!piId || status !== "succeeded") return;

    const saved = sessionStorage.getItem("sr_order");
    if (!saved) return;
    const data = JSON.parse(saved) as {
      itemsJson: string; shippingAddress: string; notes: string;
      shippingRate: number; shippingMethod?: string; total: number;
      couponId?: string; couponCode?: string; discountAmount?: number;
      customerEmail?: string; customerPhone?: string;
    };
    sessionStorage.removeItem("sr_order");
    window.history.replaceState({}, "", window.location.pathname);

    setCardProcessing(true);
    confirmCardOrder({ paymentIntentId: piId, ...data }).then((r) => {
      if (r.success && r.orderNumber) handleCardSuccess(r.orderNumber);
      else { setStripeError(r.message ?? "Order creation failed."); setCardProcessing(false); }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyCoupon = () => {
    setCouponError("");
    startCoupon(async () => {
      const res = await validateCoupon(couponInput, "SALES_REP", subtotal);
      if (res.valid) {
        setAppliedCoupon({ couponId: res.couponId, code: res.code, discountAmount: res.discountAmount });
        setCouponInput("");
        toast.success(res.message);
      } else {
        setCouponError(res.message);
      }
    });
  };

  // place order
  const handlePlaceOrder = () => {
    if (!patientEmail.trim()) {
      toast.error("Please enter the patient's email address.");
      return;
    }
    if (!hasAddr(shipping)) {
      toast.error("Please enter a shipping address.");
      return;
    }
    if (shippingOptions.length > 0 && !selectedShipping) {
      toast.error("Please select a shipping method.");
      return;
    }
    if (payMethod === "CARD") {
      stripeRef.current?.submit();
    } else {
      walletSubmit.current?.click();
    }
  };

  const isDisabled =
    cardProcessing ||
    walletPending  ||
    (payMethod === "WALLET" && !canWallet) ||
    !patientEmail.trim() ||
    !hasAddr(shipping);

  // empty cart
  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto text-center py-24">
        <p className="text-lg font-semibold text-gray-700 mb-2">Nothing to checkout</p>
        <p className="text-sm text-gray-400 mb-6">Add products to cart first.</p>
        <Link href="/sales/shop" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 transition-colors">
          Go to Shop
        </Link>
      </div>
    );
  }

  const stripeReady = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  return (
    <div className="">
      <StripeLoadingOverlay visible={stripeReady && payMethod === "CARD" && !paymentReady} />
      {/* Title */}
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Checkout</h1>
      <div className="h-0.5 bg-blue-500 mb-6" />

      {/* Cashback banner */}
      {/* {cashback > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded mb-6 text-sm text-gray-700">
          <svg className="w-5 h-5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
          </svg>
          A cashback of{" "}
          <strong className="text-gray-900">{formatCurrency(cashback)}</strong>{" "}
          will be credited to your wallet after your order is completed.
        </div>
      )} */}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">

        {/* ── LEFT COLUMN ───────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-8">

          {/* 1. Patient contact information */}
          <section>
            <h2 className="text-base font-semibold text-gray-800 mb-3">Patient contact information</h2>
            <div className="border border-gray-300 rounded divide-y divide-gray-200">
              <div className="px-4 py-3">
                <label className="text-xs text-gray-400 mb-0.5 block">
                  Patient email address <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={patientEmail}
                  onChange={(e) => setPatientEmail(e.target.value)}
                  placeholder="patient@example.com"
                  className="text-sm text-gray-800 w-full outline-none bg-transparent placeholder:text-gray-300"
                />
              </div>
            </div>
          </section>

          {/* 2. Shipping address */}
          <section>
            <h2 className="text-base font-semibold text-gray-800 mb-3">Shipping address</h2>

            <div className="border border-gray-300 rounded p-4">
              <AddressFields value={shipping} onChange={setShipping} />
            </div>

            {/* Same as billing */}
            <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sameAsBilling}
                onChange={(e) => {
                  setSameAsBilling(e.target.checked);
                  if (!e.target.checked && !hasAddr(billing)) {
                    setBilling({ ...shipping });
                  }
                }}
                className="w-4 h-4 rounded border-gray-300 accent-gray-900"
              />
              <span className="text-sm text-gray-700">Use same address for billing</span>
            </label>

            {/* Billing address */}
            {!sameAsBilling && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Billing address</p>
                <div className="border border-gray-300 rounded p-4">
                  <AddressFields value={billing} onChange={setBilling} />
                </div>
              </div>
            )}
          </section>

          {/* 3. Shipping method */}
          {shipping.country && (
            <section>
              <h2 className="text-base font-semibold text-gray-800 mb-3">Shipping method</h2>
              {loadingShipping ? (
                <div className="flex items-center gap-2 py-4 text-sm text-gray-400 border border-gray-200 rounded px-4">
                  <span className="w-4 h-4 border-2 border-gray-200 border-t-[#3DBFA4] rounded-full animate-spin" />
                  Loading shipping options…
                </div>
              ) : shippingOptions.length === 0 ? (
                <div className="border border-amber-200 bg-amber-50 rounded px-4 py-3 text-sm text-amber-700">
                  No shipping options available for {shipping.countryName}. Please contact us.
                </div>
              ) : (
                <div className="border border-gray-300 rounded divide-y divide-gray-100">
                  {shippingOptions.map((opt) => (
                    <label key={opt.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="radio"
                        name="shippingMethod"
                        checked={selectedShipping?.id === opt.id}
                        onChange={() => setSelectedShipping(opt)}
                        className="accent-gray-900"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">
                        {opt.cost === 0 ? <span className="text-emerald-600">Free</span> : formatCurrency(opt.cost)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 4. Payment options */}
          <section>
            <h2 className="text-base font-semibold text-gray-800 mb-3">Payment options</h2>
            <div className="border border-gray-300 rounded divide-y divide-gray-200">

              {/* Card */}
              <div>
                <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                  <input
                    type="radio"
                    name="payMethod"
                    checked={payMethod === "CARD"}
                    onChange={() => setPayMethod("CARD")}
                    className="accent-gray-900"
                  />
                  <span className="text-sm text-gray-800 font-medium">Credit / Debit Card</span>
                </label>

                {/* Card payment panel — Elements pre-loaded immediately, no PI needed until submit */}
                {payMethod === "CARD" && (
                  <div className="px-4 pb-4">
                    {!stripeReady ? (
                      <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-700">
                        Stripe is not configured — add <code className="font-mono text-xs bg-amber-100 px-1 rounded">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>.
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
                            appearance: {
                              theme: "stripe",
                              variables: { colorPrimary: "#3DBFA4", borderRadius: "4px", fontFamily: "inherit" },
                            },
                          }}
                        >
                          <StripeInnerForm
                            ref={stripeRef}
                            itemsJson={itemsJson}
                            shippingAddress={shipStr}
                            billingAddress={billStr}
                            billingAddressData={sameAsBilling ? shipping : billing}
                            notes={notes}
                            shippingRate={shippingCost}
                            shippingMethod={selectedShipping?.label}
                            total={total}
                            couponId={appliedCoupon?.couponId}
                            couponCode={appliedCoupon?.code}
                            discountAmount={discountAmount}
                            customerEmail={patientEmail || undefined}
                            customerPhone={patientPhone || undefined}
                            onSuccess={handleCardSuccess}
                            onProcessing={setCardProcessing}
                            onError={(msg) => { setStripeError(msg); if (msg) toast.error(msg); }}
                            onStripeReady={() => setPaymentReady(true)}
                          />
                        </Elements>
                      </div>
                    )}
                    {stripeError && (
                      <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
                        {stripeError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Wallet — only shown when balance covers the order total */}
              {canWallet && (
                <div>
                  <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                    <input
                      type="radio"
                      name="payMethod"
                      checked={payMethod === "WALLET"}
                      onChange={() => setPayMethod("WALLET")}
                      className="accent-gray-900"
                    />
                    <span className="text-sm text-gray-800 font-medium">Wallet Balance</span>
                    <span className="ml-auto text-xs font-semibold text-[#3DBFA4]">
                      {formatCurrency(walletBalance)} available
                    </span>
                  </label>
                </div>
              )}
            </div>
          </section>

          {/* 5. Notes */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showNotes}
                onChange={(e) => setShowNotes(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 accent-gray-900"
              />
              <span className="text-sm text-gray-700">Add a note to your order</span>
            </label>
            {showNotes && (
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special instructions or notes…"
                className="mt-3 w-full px-3 py-2.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 resize-none"
              />
            )}
          </div>

          {/* Terms */}
          <p className="text-xs text-gray-500">
            By proceeding with your purchase you agree to our{" "}
            <Link href="/terms" className="underline hover:text-gray-700">Terms and Conditions</Link>.
          </p>

          {/* Hidden wallet form */}
          <form action={walletAction} className="hidden">
            <input type="hidden" name="items"           value={itemsJson} />
            <input type="hidden" name="shippingAddress" value={shipStr} />
            <input type="hidden" name="billingAddress"  value={billStr} />
            <input type="hidden" name="shippingRate"    value={shippingCost} />
            <input type="hidden" name="shippingMethod"  value={selectedShipping?.label ?? ""} />
            <input type="hidden" name="total"           value={total} />
            <input type="hidden" name="notes"           value={notes} />
            <input type="hidden" name="couponCode"      value={appliedCoupon?.code      ?? ""} />
            <input type="hidden" name="couponId"        value={appliedCoupon?.couponId  ?? ""} />
            <input type="hidden" name="discountAmount"  value={discountAmount} />
            <input type="hidden" name="customerEmail"   value={patientEmail} />
            <input type="hidden" name="customerPhone"   value={patientPhone} />
            <button ref={walletSubmit} type="submit" aria-hidden="true" />
          </form>

          {/* Place Order */}
          <button
            onClick={handlePlaceOrder}
            disabled={isDisabled}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white text-sm font-bold rounded transition-colors"
          >
            {cardProcessing || walletPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Placing order…
              </span>
            ) : (
              "Place Order"
            )}
          </button>
        </div>

        {/* ── RIGHT COLUMN – Order Summary ──────────────────────── */}
        <div className="lg:col-span-2">
          <div className="sticky top-24 space-y-4">
          <div className="border border-gray-200 rounded overflow-hidden">

            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-800">Order summary</h2>
            </div>

            {/* Items */}
            <div className="px-4 py-4 space-y-4 border-b border-gray-200">
              {items.map((item) => (
                <div key={item.cartId} className="flex gap-3 items-start">
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-50 border border-gray-100">
                      {item.productImage ? (
                        <img
                          src={item.productImage}
                          alt={item.productTitle}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium truncate">{item.productTitle}</p>
                    {item.variantSize && (
                      <p className="text-xs text-gray-400">Size: {item.variantSize}</p>
                    )}
                    {/* <p className="text-[11px] text-orange-600 mt-1 leading-snug">
                      This product is distributed only through participating medical practitioners and not to patients directly.
                    </p> */}
                  </div>
                  <p className="text-sm font-semibold text-gray-800 shrink-0">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </p>
                </div>
              ))}
            </div>

            {/* Coupon input */}
            <div className="px-4 py-3 border-b border-gray-200">
              {appliedCoupon ? (
                <div className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <div>
                      <span className="text-xs font-bold text-emerald-700 font-mono">{appliedCoupon.code}</span>
                      <span className="text-xs text-emerald-600 ml-1">— −{formatCurrency(appliedCoupon.discountAmount)}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => setAppliedCoupon(null)}
                    className="text-xs text-emerald-600 hover:text-emerald-800 underline shrink-0">
                    Remove
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Coupon code"
                      value={couponInput}
                      onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 font-mono placeholder:font-sans placeholder:text-gray-400"
                    />
                    <button type="button" onClick={handleApplyCoupon} disabled={couponPending || !couponInput.trim()}
                      className="px-3 py-2 text-xs font-bold text-white bg-gray-800 hover:bg-gray-900 disabled:opacity-50 rounded transition-colors whitespace-nowrap">
                      {couponPending ? "…" : "Apply"}
                    </button>
                  </div>
                  {couponError && (
                    <p className="text-xs text-red-600">{couponError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="px-4 py-4 space-y-2 border-b border-gray-200 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Coupon ({appliedCoupon.code})</span>
                  <span>−{formatCurrency(appliedCoupon.discountAmount)}</span>
                </div>
              )}
              {/* {walletBalance > 0 && (
                <div className="flex items-center justify-between text-xs py-2 border-y border-gray-100">
                  <span>
                    You have{" "}
                    <span className="text-blue-600 font-semibold">{formatCurrency(walletBalance)}</span>{" "}
                    in your wallet to spend!
                  </span>
                </div>
              )} */}
              <div className="flex justify-between">
                <span>{selectedShipping?.label ?? "Shipping"}</span>
                {loadingShipping ? (
                  <span className="text-gray-400 italic text-xs">Calculating…</span>
                ) : selectedShipping ? (
                  <span className={selectedShipping.cost === 0 ? "text-emerald-600 font-medium" : ""}>
                    {selectedShipping.cost === 0 ? "Free" : formatCurrency(selectedShipping.cost)}
                  </span>
                ) : !shipping.country ? (
                  <span className="italic text-xs text-gray-400">Enter address first</span>
                ) : (
                  <span className="italic text-xs text-amber-600">Not available</span>
                )}
              </div>
            </div>

            {/* Total */}
            <div className="px-4 py-4">
              <div className="flex justify-between text-base font-bold text-gray-900">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
          </div>{/* end sticky wrapper */}
        </div>

      </div>
    </div>
  );
}
