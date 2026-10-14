import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "OMyFish — Your AI Fishing Companion",
  description: "When, Where, What you catch.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  debugger;
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <AuthProvider>
          <CartProvider>
            <NavBar />
            <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
