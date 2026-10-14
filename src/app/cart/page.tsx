"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { api, CartDto, ProductDto } from "@/lib/api";
import { getOrCreateGuestCartToken } from "@/lib/guestCart";

export default function CartPage() {
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();
  const [cart, setCart] = useState<CartDto | null>(null);
  const [products, setProducts] = useState<Record<string, ProductDto>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");

  useEffect(() => {
    if (authLoading) return;
    const guestCartToken = isAuthenticated ? undefined : getOrCreateGuestCartToken();
    Promise.all([api.shop.cart.get(token ?? undefined, guestCartToken), api.shop.products.getAll()])
      .then(([cartDto, productList]) => {
        setCart(cartDto);
        setProducts(Object.fromEntries(productList.map((p) => [p.id, p])));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isAuthenticated, authLoading, token]);

  const handleUpdateQuantity = async (productId: string, quantity: number) => {
    try {
      const guestCartToken = isAuthenticated ? undefined : getOrCreateGuestCartToken();
      const updated = await api.shop.cart.updateItem(productId, quantity, token ?? undefined, guestCartToken);
      setCart(updated);
    } catch (e) {
      alert("Could not update cart: " + (e instanceof Error ? e.message : e));
    }
  };

  const handleCheckout = async () => {
    if (!isAuthenticated && !guestEmail.trim()) {
      setError("Enter your email to check out as a guest.");
      return;
    }
    setCheckingOut(true);
    setError(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      const guestCartToken = isAuthenticated ? undefined : getOrCreateGuestCartToken();
      const successUrl = isAuthenticated
        ? `${window.location.origin}/orders?checkout=success`
        : `${window.location.origin}/orders/track?checkout=success`;
      const result = await api.shop.checkout(
        successUrl,
        `${window.location.origin}/cart?checkout=cancelled`,
        idempotencyKey,
        token ?? undefined,
        guestCartToken,
        isAuthenticated ? undefined : guestEmail.trim(),
      );
      if (!isAuthenticated) {
        // The track-order page reads this on the Stripe success redirect so a guest doesn't
        // have to copy down their own order id.
        sessionStorage.setItem(
          "omyfish_guest_order_lookup",
          JSON.stringify({ orderId: result.orderId, email: guestEmail.trim() }),
        );
      }
      window.location.href = result.checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCheckingOut(false);
    }
  };

  if (authLoading || loading) return <div className="text-center py-16 text-gray-400">Loading cart…</div>;

  const items = cart?.items ?? [];
  const totalCents = items.reduce((sum, item) => {
    const product = products[item.productId];
    return sum + (product ? product.priceCents * item.quantity : 0);
  }, 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">Your Cart</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Your cart is empty.</p>
          <Link href="/shop" className="mt-2 inline-block text-blue-600 hover:underline text-sm">
            Browse the shop
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const product = products[item.productId];
            return (
              <div key={item.productId} className="border rounded-xl p-4 bg-white shadow-sm flex items-center gap-4">
                {product?.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{product?.name ?? item.productId}</p>
                  {product && (
                    <p className="text-sm text-gray-500">${(product.priceCents / 100).toFixed(2)} each</p>
                  )}
                </div>
                <input
                  type="number"
                  min={0}
                  value={item.quantity}
                  onChange={(e) => handleUpdateQuantity(item.productId, Math.max(0, Number(e.target.value)))}
                  className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                />
                <button
                  onClick={() => handleUpdateQuantity(item.productId, 0)}
                  className="text-gray-400 hover:text-red-500 transition-colors text-sm"
                  title="Remove item"
                >
                  ✕
                </button>
              </div>
            );
          })}

          {!isAuthenticated && (
            <div className="border-t pt-4 mt-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email (for your receipt and order tracking)
              </label>
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-2 text-xs text-gray-500">
                Already have an account?{" "}
                <Link href="/login" className="text-blue-600 hover:underline">
                  Log in
                </Link>{" "}
                to check out faster and see your order history.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-4 mt-2">
            <span className="text-lg font-semibold text-gray-900">
              Total: ${(totalCents / 100).toFixed(2)}
            </span>
            <button
              onClick={handleCheckout}
              disabled={checkingOut}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {checkingOut ? "Redirecting to payment…" : "Checkout"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
