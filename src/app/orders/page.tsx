"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { api, OrderDto } from "@/lib/api";

const STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: "bg-amber-50 text-amber-700 border-amber-200",
  PAID: "bg-green-50 text-green-700 border-green-200",
  CANCELLED: "bg-gray-100 text-gray-500 border-gray-200",
  RETURN_REQUESTED: "bg-blue-50 text-blue-700 border-blue-200",
  RETURNED: "bg-gray-100 text-gray-500 border-gray-200",
};

export default function OrdersPage() {
  const { isAuthenticated, isLoading: authLoading, token, role } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    api.shop.orders
      .getAll(token!)
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isAuthenticated, authLoading, token, router]);

  const handleRequestReturn = async (orderId: string) => {
    const reason = window.prompt("Reason for return:");
    if (!reason) return;
    try {
      const updated = await api.shop.orders.requestReturn(orderId, reason, token!);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    } catch (e) {
      alert("Could not request return: " + (e instanceof Error ? e.message : e));
    }
  };

  if (loading) return <div className="text-center py-16 text-gray-400">Loading orders…</div>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">Your Orders</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      )}

      {orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No orders yet.</p>
          <Link href="/shop" className="mt-2 inline-block text-blue-600 hover:underline text-sm">
            Browse the shop
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <div key={order.id} className="border rounded-xl p-4 bg-white shadow-sm">
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

              {order.returnReason && (
                <p className="mt-2 text-xs text-gray-500">Return reason: {order.returnReason}</p>
              )}

              {order.status === "PAID" && (
                <button
                  onClick={() => handleRequestReturn(order.id)}
                  className="mt-3 text-sm text-blue-600 hover:underline"
                >
                  Request a return
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {role === "ADMIN" && <AdminOrdersPanel token={token!} />}
    </div>
  );
}

// Lists every order (any owner) so an admin can find — and approve a return on — one without
// already having its id in hand, plus a manual-id fallback for when they do (e.g. from a
// support email). approveReturn itself works on any order id, gated server-side on X-User-Role.
function AdminOrdersPanel({ token }: { token: string }) {
  const [allOrders, setAllOrders] = useState<OrderDto[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [orderId, setOrderId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.shop.orders.listAllAdmin(token)
      .then(setAllOrders)
      .catch((e) => setListError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingAll(false));
  }, [token]);

  const handleApproveRow = async (id: string) => {
    setBusyId(id);
    try {
      const updated = await api.shop.orders.approveReturn(id, token);
      setAllOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
    } catch (e) {
      alert("Could not approve return: " + (e instanceof Error ? e.message : e));
    } finally {
      setBusyId(null);
    }
  };

  const handleApprove = async () => {
    if (!orderId) return;
    setBusy(true);
    setStatus(null);
    try {
      const order = await api.shop.orders.approveReturn(orderId, token);
      setStatus(`Order ${order.id.slice(0, 8)}… is now ${order.status}.`);
    } catch (e) {
      setStatus("Error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t pt-6 mt-2 flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Admin: All Orders</h2>
        {listError && <p className="mt-1 text-sm text-red-600">{listError}</p>}
        {loadingAll ? (
          <p className="mt-2 text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {allOrders.map((order) => (
              <div key={order.id} className="border rounded-lg p-3 flex items-center justify-between gap-3 text-sm">
                <div>
                  <span className="font-medium text-gray-900">{order.id.slice(0, 8)}…</span>{" "}
                  <span className="text-gray-500">${(order.totalCents / 100).toFixed(2)}</span>{" "}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}
                  >
                    {order.status.replace(/_/g, " ")}
                  </span>
                </div>
                {order.status === "RETURN_REQUESTED" && (
                  <button
                    onClick={() => handleApproveRow(order.id)}
                    disabled={busyId === order.id}
                    className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {busyId === order.id ? "Approving…" : "Approve return"}
                  </button>
                )}
              </div>
            ))}
            {allOrders.length === 0 && <p className="text-sm text-gray-400">No orders yet.</p>}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700">Or approve by order id</h2>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            placeholder="Order id"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          />
          <button
            onClick={handleApprove}
            disabled={busy || !orderId}
            className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {busy ? "Approving…" : "Approve return"}
          </button>
        </div>
        {status && <p className="mt-2 text-sm text-gray-600">{status}</p>}
      </div>
    </div>
  );
}
