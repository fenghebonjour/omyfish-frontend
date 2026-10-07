import { loadStripe } from "@stripe/stripe-js";

// Publishable keys are meant to be public — safe to ship in the client bundle.
export const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");
