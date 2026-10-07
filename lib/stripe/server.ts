import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

// stripe is null when the key is missing — card payments will be blocked
// but wallet payments still work.
export const stripe = key ? new Stripe(key) : null;
