"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { api, CartDto } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { peekGuestCartToken } from "@/lib/guestCart";

interface CartContextValue {
  count: number;
  // Re-derives the badge count from a CartDto a page already fetched/mutated, avoiding a
  // redundant round trip to GET /cart.
  applyCart: (cart: CartDto) => void;
  notify: (message: string) => void;
  toastMessage: string | null;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, token, isLoading: authLoading } = useAuth();
  const [count, setCount] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const applyCart = useCallback((cart: CartDto) => {
    setCount(cart.items.reduce((sum, item) => sum + item.quantity, 0));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    const guestCartToken = isAuthenticated ? undefined : peekGuestCartToken();
    if (!isAuthenticated && !guestCartToken) {
      setCount(0);
      return;
    }
    api.shop.cart
      .get(token ?? undefined, guestCartToken ?? undefined)
      .then(applyCart)
      .catch(() => {});
  }, [isAuthenticated, token, authLoading, applyCart]);

  const notify = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  return (
    <CartContext.Provider value={{ count, applyCart, notify, toastMessage }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
