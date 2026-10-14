"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { api, ProductDto } from "@/lib/api";
import { getOrCreateGuestCartToken } from "@/lib/guestCart";

export default function ShopPage() {
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    api.shop.products
      .getAll()
      .then(setProducts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleAddToCart = async (productId: string) => {
    setAddingId(productId);
    try {
      const guestCartToken = isAuthenticated ? undefined : getOrCreateGuestCartToken();
      await api.shop.cart.addItem(productId, 1, token ?? undefined, guestCartToken);
    } catch (e) {
      alert("Could not add to cart: " + (e instanceof Error ? e.message : e));
    } finally {
      setAddingId(null);
    }
  };

  if (loading) return <div className="text-center py-16 text-gray-400">Loading lures…</div>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">Omyshop — Top Lures of 2026</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {products.map((p) => (
          <div key={p.id} className="border rounded-xl p-4 bg-white shadow-sm flex flex-col">
            <Link href={`/shop/${p.id}`}>
              <img
                src={p.imageUrl}
                alt={p.name}
                className="w-full h-40 object-cover rounded-lg flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </Link>
            <div className="mt-3 flex-1">
              <Link href={`/shop/${p.id}`} className="font-semibold text-gray-900 hover:text-blue-700">
                {p.name}
              </Link>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{p.description}</p>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="font-semibold text-gray-900">${(p.priceCents / 100).toFixed(2)}</span>
              <button
                onClick={() => handleAddToCart(p.id)}
                disabled={p.stockQuantity <= 0 || addingId === p.id || authLoading}
                className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {p.stockQuantity <= 0 ? "Out of stock" : addingId === p.id ? "Adding…" : "Add to cart"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
