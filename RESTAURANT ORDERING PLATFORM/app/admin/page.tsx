"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  Clock,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Package,
  RefreshCw,
  ShoppingBag,
  Users,
  Utensils,
} from "lucide-react";

type Payment = {
  id: string;
  status: string;
  amount?: number;
  method?: string;
};

type OverviewData = {
  overview: {
    orders: {
      total: number;
      pending: number;
      confirmed: number;
      preparing: number;
      ready: number;
      served: number;
      cancelled: number;
    };
    reservations: {
      total: number;
      pending: number;
      confirmed: number;
      seated: number;
      completed: number;
      cancelled: number;
    };
    customers: number;
    menuItems: { total: number; available: number };
    activeTables: number;
    paidRevenue: number;
  };
  recentOrders: {
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    createdAt: string;
    user: { name: string };
    payment: Payment | null;
  }[];
  recentReservations: {
    id: string;
    date: string;
    startTime: string;
    guests: number;
    status: string;
    user: { name: string };
    table: { tableNumber: string };
  }[];
};

function money(amount: number) {
  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusStyle(status: string) {
  switch (status) {
    case "PAID":
    case "SERVED":
    case "COMPLETED":
    case "CONFIRMED":
      return "bg-emerald-100 text-emerald-800";
    case "PENDING":
      return "bg-amber-100 text-amber-800";
    case "PREPARING":
    case "SEATED":
      return "bg-violet-100 text-violet-800";
    case "READY":
      return "bg-blue-100 text-blue-800";
    case "CANCELLED":
    case "FAILED":
      return "bg-red-100 text-red-800";
    case "REFUNDED":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-stone-100 text-stone-700";
  }
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminPage() {
  const router = useRouter();

  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const redirectToLogin = useCallback(() => {
    router.replace("/staff-login");
    router.refresh();
  }, [router]);

  const loadOverview = useCallback(
    async (quiet = false) => {
      if (quiet) setRefreshing(true);
      else setLoading(true);

      try {
        const sessionResponse = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        if (
          sessionResponse.status === 401 ||
          sessionResponse.status === 403
        ) {
          redirectToLogin();
          return;
        }

        const sessionData = await sessionResponse.json();

        if (!sessionResponse.ok) {
          throw new Error(
            sessionData.error || "Could not verify staff session.",
          );
        }

        if (sessionData.user?.role !== "ADMIN") {
          redirectToLogin();
          return;
        }

        const response = await fetch("/api/admin/overview", {
          cache: "no-store",
        });

        if (response.status === 401 || response.status === 403) {
          redirectToLogin();
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Could not load admin overview.",
          );
        }

        setData(result);
        setError("");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not load admin overview.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [redirectToLogin],
  );

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  async function markAsPaid(paymentId: string, orderNumber: string) {
    const confirmed = window.confirm(
      `Confirm that payment for order ${orderNumber} has actually been received?`,
    );

    if (!confirmed) return;

    setUpdatingPayment(paymentId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/payments/${paymentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "PAID" }),
        },
      );

      const result = await response.json();

      if (response.status === 401 || response.status === 403) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        throw new Error(result.error || "Could not update payment.");
      }

      setMessage(`Payment for order ${orderNumber} marked as paid.`);
      await loadOverview(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update payment.",
      );
    } finally {
      setUpdatingPayment(null);
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

  if (loading && !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f5f0] text-[#263b2c]">
        <div className="rounded-2xl border border-[#e6e3da] bg-white p-8 text-center">
          <LayoutDashboard
            size={32}
            className="mx-auto mb-4 text-[#66825d]"
          />
          <p className="font-semibold">Loading admin dashboard...</p>
          <p className="mt-2 text-sm text-[#777a70]">
            Verifying access and retrieving restaurant statistics.
          </p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f5f0] px-5 text-[#263b2c]">
        <div className="max-w-md rounded-2xl border border-[#e6e3da] bg-white p-8 text-center">
          <AlertCircle
            size={32}
            className="mx-auto mb-4 text-red-600"
          />
          <h1 className="text-xl font-semibold">Dashboard unavailable</h1>
          <p className="mt-3 text-sm text-red-700">
            {error || "Could not retrieve restaurant statistics."}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              onClick={() => void loadOverview()}
              className="rounded-full bg-[#263b2c] px-5 py-3 text-sm font-semibold text-white"
            >
              Try again
            </button>
            <button
              onClick={redirectToLogin}
              className="rounded-full border border-[#dedfd5] px-5 py-3 text-sm font-semibold"
            >
              Staff login
            </button>
          </div>
        </div>
      </main>
    );
  }

  const { overview } = data;

  const cards = [
    {
      label: "Total orders",
      value: overview.orders.total.toLocaleString("en-IN"),
      detail: `${overview.orders.pending} awaiting confirmation`,
      icon: ShoppingBag,
    },
    {
      label: "Paid revenue",
      value: money(overview.paidRevenue),
      detail: "Paid, non-cancelled orders",
      icon: IndianRupee,
    },
    {
      label: "Reservations",
      value: overview.reservations.total.toLocaleString("en-IN"),
      detail: `${overview.reservations.pending} awaiting confirmation`,
      icon: CalendarDays,
    },
    {
      label: "Customers",
      value: overview.customers.toLocaleString("en-IN"),
      detail: "Registered customer accounts",
      icon: Users,
    },
    {
      label: "Menu items",
      value: overview.menuItems.total.toLocaleString("en-IN"),
      detail: `${overview.menuItems.available} currently available`,
      icon: Utensils,
    },
    {
      label: "Active tables",
      value: overview.activeTables.toLocaleString("en-IN"),
      detail: "Tables enabled for reservations",
      icon: Package,
    },
  ];

  return (
    <main className="min-h-screen bg-[#f6f5f0] text-[#263b2c]">
      <header className="bg-[#1d2c21] px-5 py-6 text-white sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-3">
              <ChefHat size={28} />
            </div>
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-[#c4d8b9] uppercase">
                DineDesk
              </p>
              <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
                Admin Overview
              </h1>
              <p className="mt-1 text-sm text-white/70">
                Restaurant operations at a glance
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void loadOverview(true)}
              disabled={refreshing || loggingOut}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>
            <button
              onClick={() => router.push("/staff-reservations")}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-sm font-semibold hover:bg-white/10"
            >
              <CalendarDays size={16} />
              Reservations
            </button>
            <button
              onClick={() => void logout()}
              disabled={loggingOut}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
            >
              <LogOut size={16} />
              {loggingOut ? "Signing out..." : "Logout"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle size={20} className="shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            {message}
          </div>
        )}

        <div className="mb-7 flex items-center gap-2 text-sm text-[#777a70]">
          <Activity size={17} />
          <span>Live database summary</span>
          <span className="ml-auto text-xs">
            Refresh to retrieve latest figures
          </span>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.label}
                className="rounded-2xl border border-[#e6e3da] bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[#777a70]">{card.label}</p>
                  <div className="rounded-xl bg-[#eef2e9] p-2.5">
                    <Icon size={21} className="text-[#66825d]" />
                  </div>
                </div>
                <p className="mt-4 break-words text-2xl font-bold sm:text-3xl">
                  {card.value}
                </p>
                <p className="mt-2 text-xs text-[#777a70]">
                  {card.detail}
                </p>
              </article>
            );
          })}
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <article className="rounded-2xl border border-[#e6e3da] bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Order status</h2>
                <p className="mt-1 text-sm text-[#777a70]">
                  All recorded orders by current status
                </p>
              </div>
              <ShoppingBag size={22} className="text-[#66825d]" />
            </div>
            <div className="mt-5 space-y-4">
              {[
                ["Pending", overview.orders.pending],
                ["Confirmed", overview.orders.confirmed],
                ["Preparing", overview.orders.preparing],
                ["Ready", overview.orders.ready],
                ["Served", overview.orders.served],
                ["Cancelled", overview.orders.cancelled],
              ].map(([label, value]) => {
                const count = Number(value);
                const percentage =
                  overview.orders.total > 0
                    ? (count / overview.orders.total) * 100
                    : 0;

                return (
                  <div key={String(label)}>
                    <div className="mb-1.5 flex justify-between gap-3 text-sm">
                      <span>{label}</span>
                      <strong>{count}</strong>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#efeee8]">
                      <div
                        className="h-full rounded-full bg-[#819778]"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-2xl border border-[#e6e3da] bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Reservation status</h2>
                <p className="mt-1 text-sm text-[#777a70]">
                  Current reservation breakdown
                </p>
              </div>
              <CalendarDays size={22} className="text-[#66825d]" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["Pending", overview.reservations.pending],
                ["Confirmed", overview.reservations.confirmed],
                ["Seated", overview.reservations.seated],
                ["Completed", overview.reservations.completed],
                ["Cancelled", overview.reservations.cancelled],
                ["Total", overview.reservations.total],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl bg-[#f8f7f2] p-4">
                  <p className="text-xs text-[#777a70]">{label}</p>
                  <p className="mt-2 text-2xl font-bold">{Number(value)}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => router.push("/staff-reservations")}
              className="mt-5 w-full rounded-full bg-[#263b2c] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#3b5540]"
            >
              Manage reservations
            </button>
          </article>
        </section>

        <section className="mt-8 rounded-2xl border border-[#e6e3da] bg-white p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <Clock size={22} className="text-[#66825d]" />
            <div>
              <h2 className="text-lg font-semibold">Recent orders</h2>
              <p className="mt-1 text-sm text-[#777a70]">
                The six most recently created orders
              </p>
            </div>
          </div>

          {data.recentOrders.length === 0 ? (
            <p className="mt-6 rounded-xl bg-[#f8f7f2] p-6 text-center text-sm text-[#777a70]">
              No orders have been placed yet.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#eeece5] text-xs text-[#777a70]">
                    <th className="px-3 py-3 font-semibold">Order</th>
                    <th className="px-3 py-3 font-semibold">Customer</th>
                    <th className="px-3 py-3 font-semibold">Total</th>
                    <th className="px-3 py-3 font-semibold">Payment</th>
                    <th className="px-3 py-3 font-semibold">Order status</th>
                    <th className="px-3 py-3 font-semibold">Created</th>
                    <th className="px-3 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentOrders.map((order) => {
                    const cancelledUnpaid =
                      order.status === "CANCELLED" &&
                      (!order.payment ||
                        order.payment.status === "PENDING" ||
                        order.payment.status === "FAILED");

                    return (
                      <tr
                        key={order.id}
                        className="border-b border-[#f0eee8] last:border-0"
                      >
                        <td className="px-3 py-4 font-semibold">
                          {order.orderNumber}
                        </td>
                        <td className="px-3 py-4">{order.user.name}</td>
                        <td className="px-3 py-4 font-semibold">
                          {money(order.total)}
                        </td>
                        <td className="px-3 py-4">
                          {cancelledUnpaid ? (
                            <span aria-label="No payment status">&nbsp;</span>
                          ) : order.payment?.status === "REFUNDED" ? (
                            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                              REFUND ISSUED
                            </span>
                          ) : (
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(
                                order.payment?.status ?? "PENDING",
                              )}`}
                            >
                              {formatStatus(
                                order.payment?.status ?? "NO PAYMENT",
                              )}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(
                              order.status,
                            )}`}
                          >
                            {formatStatus(order.status)}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-[#777a70]">
                          {formatDate(order.createdAt)}
                        </td>
                        <td className="px-3 py-4">
                          {order.status !== "CANCELLED" &&
                          order.payment?.status === "PENDING" ? (
                            <button
                              onClick={() =>
                                void markAsPaid(
                                  order.payment!.id,
                                  order.orderNumber,
                                )
                              }
                              disabled={updatingPayment === order.payment.id}
                              className="whitespace-nowrap rounded-full bg-[#263b2c] px-3 py-2 text-xs font-semibold text-white hover:bg-[#3b5540] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {updatingPayment === order.payment.id
                                ? "Updating..."
                                : "Mark as Paid"}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-[#e6e3da] bg-white p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={22} className="text-[#66825d]" />
            <div>
              <h2 className="text-lg font-semibold">Recent reservations</h2>
              <p className="mt-1 text-sm text-[#777a70]">
                The six most recently created reservations
              </p>
            </div>
          </div>

          {data.recentReservations.length === 0 ? (
            <p className="mt-6 rounded-xl bg-[#f8f7f2] p-6 text-center text-sm text-[#777a70]">
              No reservations have been made yet.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#eeece5] text-xs text-[#777a70]">
                    <th className="px-3 py-3 font-semibold">Customer</th>
                    <th className="px-3 py-3 font-semibold">Table</th>
                    <th className="px-3 py-3 font-semibold">Guests</th>
                    <th className="px-3 py-3 font-semibold">Date</th>
                    <th className="px-3 py-3 font-semibold">Start time</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentReservations.map((reservation) => (
                    <tr
                      key={reservation.id}
                      className="border-b border-[#f0eee8] last:border-0"
                    >
                      <td className="px-3 py-4 font-semibold">
                        {reservation.user.name}
                      </td>
                      <td className="px-3 py-4">
                        {reservation.table.tableNumber}
                      </td>
                      <td className="px-3 py-4">{reservation.guests}</td>
                      <td className="px-3 py-4">
                        {new Date(reservation.date).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-3 py-4">
                        {formatDate(reservation.startTime)}
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(
                            reservation.status,
                          )}`}
                        >
                          {formatStatus(reservation.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="py-8 text-center text-xs text-[#8b8d82]">
          DineDesk Admin · Statistics are retrieved from your PostgreSQL database.
        </footer>
      </div>
    </main>
  );
}
