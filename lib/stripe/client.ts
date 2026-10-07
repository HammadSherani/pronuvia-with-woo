import { loadStripe } from "@stripe/stripe-js";

const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

export const stripePromise = key
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ? loadStripe(key, { advancedFraudSignals: false } as any)
  : null;
