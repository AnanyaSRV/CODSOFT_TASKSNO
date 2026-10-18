"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChefHat,
  RefreshCw,
  Clock,
  CheckCircle2,
  PackageCheck,
  AlertCircle,
  Utensils,
  LogOut,
} from "lucide-react";

type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "CANCELLED";

type KitchenOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customer: {
    name: string;
    phone: string | null;
    email: string;
  };
  subtotal: string;
  tax: string;
  total: string;
  notes: string | null;
  createdAt: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    unitPrice: string;
  }[];
  payment: {
    method: string;
    status: string;
    amount: string;
  } | null;
};

const statuses: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "SERVED",
  "CANCELLED",
];

const statusStyles: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  PREPARING: "bg-violet-100 text-violet-800",
  READY: "bg-emerald-100 text-emerald-800",
  SERVED: "bg-stone-200 text-stone-700",
  CANCELLED: "bg-red-100 text-red-800",
};

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
  READY: "SERVED",
};

function money(value: string) {
  return `₹${Number(value).toFixed(2)}`;
}

export default function KitchenPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [filter, setFilter] = useState("ACTIVE");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const redirectToLogin = useCallback(() => {
    router.replace("/staff-login");
    router.refresh();
  }, [router]);

  const loadOrders = useCallback(
    async (quiet = false) => {
      if (quiet) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        // Verify the current staff session before loading the dashboard.
        const sessionResponse = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        if (sessionResponse.status === 401 || sessionResponse.status === 403) {
          redirectToLogin();
          return;
        }

        const sessionData = await sessionResponse.json();

        if (!sessionResponse.ok) {
          throw new Error(
            sessionData.error || "Could not verify the staff session.",
          );
        }

        const role = sessionData.user?.role;

        if (role !== "ADMIN" && role !== "KITCHEN_STAFF") {
          redirectToLogin();
          return;
        }

        setAuthorized(true);

        const response = await fetch("/api/kitchen/orders", {
          cache: "no-store",
        });

        if (response.status === 401 || response.status === 403) {
          redirectToLogin();
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load orders.");
        }

        setOrders(data.orders);
        setError("");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not load orders.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [redirectToLogin],
  );

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  async function updateStatus(order: KitchenOrder, status: OrderStatus) {
    setUpdatingId(order.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/kitchen/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, status }),
      });

      if (response.status === 401 || response.status === 403) {
        redirectToLogin();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update order.");
      }

      setOrders((current) =>
        current.map((item) =>
          item.id === order.id
            ? { ...item, status: data.order.status }
            : item,
        ),
      );

      setNotice(`${order.orderNumber} updated to ${status}.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update order.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function logout() {
    setLoggingOut(true);
    setError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Could not log out. Please try again.");
      }

      router.replace("/staff-login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log out.");
      setLoggingOut(false);
    }
  }

  const visibleOrders = orders.filter((order) => {
    if (filter === "ACTIVE") {
      return !["SERVED", "CANCELLED"].includes(order.status);
    }

    if (filter === "COMPLETED") {
      return order.status === "SERVED";
    }

    if (filter === "CANCELLED") {
      return order.status === "CANCELLED";
    }

    if (filter === "ALL") {
      return true;
    }

    return order.status === filter;
  });

  const activeCount = orders.filter(
    (order) => !["SERVED", "CANCELLED"].includes(order.status),
  ).length;

  const pendingCount = orders.filter(
    (order) => order.status === "PENDING",
  ).length;

  const preparingCount = orders.filter(
    (order) => order.status === "PREPARING",
  ).length;

  if (!authorized && loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f5f0] text-[#263b2c]">
        <div className="rounded-2xl border border-[#e6e3da] bg-white p-8 text-center shadow-sm">
          <ChefHat size={32} className="mx-auto mb-4 text-[#66825d]" />
          <p className="font-semibold">Verifying staff access...</p>
          <p className="mt-2 text-sm text-[#777a70]">
            Please wait while we check your session.
          </p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f5f0] px-5 text-[#263b2c]">
        <div className="max-w-md rounded-2xl border border-[#e6e3da] bg-white p-8 text-center shadow-sm">
          <AlertCircle size={32} className="mx-auto mb-4 text-red-600" />
          <h1 className="text-xl font-semibold">Staff access required</h1>
          <p className="mt-2 text-sm text-[#777a70]">
            Sign in with an authorized staff account to access the kitchen
            dashboard.
          </p>
          {error && (
            <p role="alert" className="mt-4 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            onClick={() => redirectToLogin()}
            className="mt-5 rounded-full bg-[#263b2c] px-5 py-3 text-sm font-semibold text-white hover:bg-[#3b5540]"
          >
            Go to staff login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f5f0] text-[#263b2c]">
      <header className="bg-[#1d2c21] px-5 py-6 text-white sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-3">
              <ChefHat size={27} />
            </div>
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-[#c4d8b9] uppercase">
                DineDesk
              </p>
              <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
                Kitchen Dashboard
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadOrders(true)}
              disabled={refreshing || loggingOut}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => void logout()}
              disabled={loggingOut}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-50"
            >
              <LogOut size={16} />
              <span>{loggingOut ? "Signing out..." : "Logout"}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#e6e3da] bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#777a70]">Active orders</p>
              <Utensils className="text-[#66825d]" size={21} />
            </div>
            <p className="mt-3 text-3xl font-bold">{activeCount}</p>
          </div>

          <div className="rounded-2xl border border-[#e6e3da] bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#777a70]">Awaiting confirmation</p>
              <Clock className="text-amber-600" size={21} />
            </div>
            <p className="mt-3 text-3xl font-bold">{pendingCount}</p>
          </div>

          <div className="rounded-2xl border border-[#e6e3da] bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#777a70]">Being prepared</p>
              <PackageCheck className="text-violet-600" size={21} />
            </div>
            <p className="mt-3 text-3xl font-bold">{preparingCount}</p>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-semibold">Incoming orders</h2>
              <p className="mt-1 text-sm text-[#777a70]">
                Review each order and update its preparation status.
              </p>
            </div>

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="rounded-xl border border-[#dedfd5] bg-white px-4 py-3 text-sm outline-none focus:border-[#78916b]"
            >
              <option value="ACTIVE">Active orders</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PREPARING">Preparing</option>
              <option value="READY">Ready</option>
              <option value="COMPLETED">Served</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="ALL">All orders</option>
            </select>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              <AlertCircle size={20} className="shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {notice && (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              {notice}
            </div>
          )}

          {loading ? (
            <div className="mt-8 rounded-2xl border border-[#e6e3da] bg-white p-12 text-center text-[#777a70]">
              Loading orders from the database...
            </div>
          ) : visibleOrders.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-[#d8d8cc] bg-white p-12 text-center">
              <CheckCircle2
                size={36}
                className="mx-auto text-[#819778]"
              />
              <h3 className="mt-4 text-lg font-semibold">
                No orders in this view
              </h3>
              <p className="mt-2 text-sm text-[#777a70]">
                Place a customer order or select a different filter.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              {visibleOrders.map((order) => (
                <article
                  key={order.id}
                  className="overflow-hidden rounded-2xl border border-[#e6e3da] bg-white shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eeece5] p-5">
                    <div>
                      <p className="text-xs font-bold tracking-wider text-[#819778] uppercase">
                        Order
                      </p>
                      <h3 className="mt-1 text-xl font-bold">
                        {order.orderNumber}
                      </h3>
                      <p className="mt-1 text-sm text-[#777a70]">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusStyles[order.status]}`}
                    >
                      {order.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  <div className="p-5">
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <p>
                        <span className="text-[#777a70]">Customer: </span>
                        <strong>{order.customer.name}</strong>
                      </p>
                      <p>
                        <span className="text-[#777a70]">Phone: </span>
                        <strong>
                          {order.customer.phone || "Not provided"}
                        </strong>
                      </p>
                    </div>

                    <div className="mt-5 rounded-xl bg-[#f8f7f2] p-4">
                      <p className="mb-3 text-sm font-semibold">Order items</p>
                      <div className="space-y-3">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start justify-between gap-3 text-sm"
                          >
                            <span>
                              <strong>{item.quantity} ×</strong> {item.name}
                            </span>
                            <span className="shrink-0 font-medium">
                              {money(
                                (
                                  Number(item.unitPrice) * item.quantity
                                ).toString(),
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {order.notes && (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
                        <strong>Customer notes:</strong> {order.notes}
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between border-t border-[#eeece5] pt-4">
                      <div>
                        <p className="text-xs text-[#777a70]">
                          {order.payment
                            ? `${order.payment.method} · ${order.payment.status}`
                            : "No payment record"}
                        </p>
                        <p className="mt-1 text-xl font-bold">
                          {money(order.total)}
                        </p>
                      </div>

                      {nextStatus[order.status] ? (
                        <button
                          onClick={() =>
                            void updateStatus(order, nextStatus[order.status]!)
                          }
                          disabled={updatingId === order.id}
                          className="rounded-full bg-[#263b2c] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#3b5540] disabled:opacity-50"
                        >
                          {updatingId === order.id
                            ? "Updating..."
                            : `Mark ${nextStatus[order.status]!.toLowerCase()}`}
                        </button>
                      ) : (
                        <span className="text-sm font-medium text-[#777a70]">
                          {order.status === "SERVED"
                            ? "Order completed"
                            : order.status === "CANCELLED"
                              ? "Order cancelled"
                              : "No next action"}
                        </span>
                      )}
                    </div>

                    {order.status !== "SERVED" &&
                      order.status !== "CANCELLED" && (
                        <details className="mt-4 border-t border-[#eeece5] pt-3">
                          <summary className="cursor-pointer text-sm font-medium text-[#777a70]">
                            More status options
                          </summary>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {statuses
                              .filter((status) => status !== order.status)
                              .map((status) => (
                                <button
                                  key={status}
                                  onClick={() => void updateStatus(order, status)}
                                  disabled={updatingId === order.id}
                                  className="rounded-full border border-[#dedfd5] px-3 py-2 text-xs font-semibold transition hover:bg-[#f5f5ef] disabled:opacity-50"
                                >
                                  {status.replaceAll("_", " ")}
                                </button>
                              ))}
                          </div>
                        </details>
                      )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="py-8 text-center text-xs text-[#8b8d82]">
          DineDesk Kitchen · Orders are loaded from your PostgreSQL database.
        </footer>
      </div>
    </main>
  );
}
