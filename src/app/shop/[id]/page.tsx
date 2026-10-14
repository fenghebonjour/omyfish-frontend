"use client";

import { useEffect, useState, ChangeEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { api, ProductDto } from "@/lib/api";
import { getOrCreateGuestCartToken } from "@/lib/guestCart";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, isLoading: authLoading, token, role } = useAuth();
  const [product, setProduct] = useState<ProductDto | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    api.shop.products
      .getById(id)
      .then(setProduct)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddToCart = async () => {
    setAdding(true);
    setAdded(false);
    try {
      const guestCartToken = isAuthenticated ? undefined : getOrCreateGuestCartToken();
      await api.shop.cart.addItem(id, quantity, token ?? undefined, guestCartToken);
      setAdded(true);
    } catch (e) {
      alert("Could not add to cart: " + (e instanceof Error ? e.message : e));
    } finally {
      setAdding(false);
    }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setUploadError(null);
    try {
      const updated = await api.shop.products.uploadImage(id, file, token!);
      setProduct(updated);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  if (loading) return <div className="text-center py-16 text-gray-400">Loading product…</div>;

  if (error || !product) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
        {error ?? "Product not found."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/shop" className="text-sm text-blue-600 hover:underline">
        ← Back to shop
      </Link>

      <div className="flex flex-col sm:flex-row gap-6">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full sm:w-72 h-72 object-cover rounded-xl flex-shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
          <p className="text-gray-600 mt-2">{product.description}</p>
          <p className="text-xl font-semibold text-gray-900 mt-4">
            ${(product.priceCents / 100).toFixed(2)}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {product.stockQuantity > 0 ? `${product.stockQuantity} in stock` : "Out of stock"}
          </p>

          <div className="mt-4 flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={Math.max(1, product.stockQuantity)}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            />
            <button
              onClick={handleAddToCart}
              disabled={product.stockQuantity <= 0 || adding || authLoading}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {adding ? "Adding…" : "Add to cart"}
            </button>
            {added && <span className="text-sm text-green-600">Added to cart ✓</span>}
          </div>

          {role === "ADMIN" && (
            <div className="mt-6 border-t pt-4">
              <h2 className="text-sm font-semibold text-gray-700">Admin: Replace photo</h2>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="mt-2 text-sm"
              />
              {uploadingImage && <p className="text-xs text-gray-400 mt-1">Uploading…</p>}
              {uploadError && <p className="text-xs text-red-600 mt-1">{uploadError}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
