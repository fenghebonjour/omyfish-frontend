"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import { api, OrderDto } from "@/lib/api";

const STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: "bg-amber-50 text-amber-700 border-amber-200",
  PAID: "bg-green-50 text-green-700 border-green-200",
  CANCELLED: "bg-gray-100 text-gray-500 border-gray-200",
  RETURN_REQUESTED: "bg-blue-50 text-blue-700 border-blue-200",
  RETURNED: "bg-gray-100 text-gray-500 border-gray-200",
};

export default function TrackOrderPage() {
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const lookup = useCallback(async (id: string, lookupEmail: string) => {
    setError(null);
    setOrder(null);
    setLoading(true);
    try {
      const found = await api.shop.orders.lookup(id, lookupEmail);
      setOrder(found);
    } catch {
      setError("No matching order found — check the order id and email.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Right after a guest's Stripe checkout succeeds, the cart page stashes the order id it
  // already has (handed back when the checkout session was created) so this page can look it
  // up automatically instead of making the guest copy it down themselves.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("checkout") !== "success") return;
    const raw = sessionStorage.getItem("omyfish_guest_order_lookup");
    if (!raw) return;
    sessionStorage.removeItem("omyfish_guest_order_lookup");
    try {
      const saved = JSON.parse(raw) as { orderId: string; email: string };
      setOrderId(saved.orderId);
      setEmail(saved.email);
      lookup(saved.orderId, saved.email);
    } catch {
      // ignore malformed value
    }
  }, [lookup]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    lookup(orderId.trim(), email.trim());
  };

  return (
    <div className="max-w-md mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">Track Your Order</h1>
      <p className="text-sm text-gray-500">
        Enter your order id and the email you checked out with — no account needed.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Order id</label>
          <input
            type="text"
            required
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. 3f29a1b2-…"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="you@example.com"
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Looking up…" : "Find order"}
        </button>
      </form>

      {order && (
        <div className="border rounded-xl p-4 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900">
                Order {order.id.slice(0, 8)}… — ${(order.totalCents / 100).toFixed(2)}
              </p>
              <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleString()}</p>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded-full border ${STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}
            >
              {order.status.replace(/_/g, " ")}
            </span>
          </div>

          <ul className="mt-3 text-sm text-gray-600 flex flex-col gap-1">
            {order.lines.map((line, i) => (
              <li key={i}>
                {line.quantity} × {line.productName} — ${(line.unitPriceCents / 100).toFixed(2)} each
              </li>
            ))}
          </ul>

          {order.shippingAddress && (
            <p className="mt-2 text-xs text-gray-500">
              Shipping to: {order.shippingAddress.recipientName}, {order.shippingAddress.line1}
              {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}, {order.shippingAddress.city}{" "}
              {order.shippingAddress.state} {order.shippingAddress.postalCode}, {order.shippingAddress.country}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
