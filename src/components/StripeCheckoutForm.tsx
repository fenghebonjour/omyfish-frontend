"use client";

import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { stripePromise } from "@/lib/stripe";

function Form({ onDone }: { onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed.");
      setSubmitting(false);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PaymentElement />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg py-3 text-sm font-medium"
      >
        {submitting ? "Confirming…" : "Confirm payment"}
      </button>
    </form>
  );
}

export function StripeCheckoutForm({
  clientSecret,
  onDone,
}: {
  clientSecret: string;
  onDone: () => void;
}) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <Form onDone={onDone} />
    </Elements>
  );
}
