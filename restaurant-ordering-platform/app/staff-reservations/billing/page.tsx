
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: { name: string };
};

type BillItem = {
  id: string;
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
};

type PreorderItem = {
  id: string;
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal?: number;
};

type Deposit = {
  id: string;
  amount: number;
  status: string;
  providerRef?: string | null;
};

type Payment = {
  id: string;
  amount: number;
  method: string;
  status: string;
  providerRef?: string | null;
};

type ExistingOrder = {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  depositCredit?: number;
  balanceDue?: number;
  items: BillItem[];
  payment: Payment | null;
};

type Reservation = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  guests: number;
  status: string;
  user: {
    name: string;
    phone: string | null;
    email: string;
  };
  table: {
    tableNumber: string;
    capacity: number;
  };
  assignedTables: Array<{
    table: { tableNumber: string; capacity: number };
  }>;
  deposit?: Deposit | null;
  preorderItems?: PreorderItem[];
  order: ExistingOrder | null;
};

type ApiData = {
  reservations: Reservation[];
  menuItems: MenuItem[];
};

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function statusClass(status: string) {
  switch (status) {
    case "PAID":
    case "COMPLETED":
    case "SERVED":
      return "bg-emerald-100 text-emerald-800";
    case "CANCELLED":
    case "FAILED":
      return "bg-red-100 text-red-800";
    case "PENDING":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-blue-100 text-blue-800";
  }
}

function outstandingBalance(order: ExistingOrder) {
  if (typeof order.balanceDue === "number") {
    return Math.max(0, order.balanceDue);
  }

  const credit =
    typeof order.depositCredit === "number" ? order.depositCredit : 0;

  return Math.max(0, Math.round((order.total - credit) * 100) / 100);
}

export default function ReservationBillingPage() {
  const [data, setData] = useState<ApiData>({
    reservations: [],
    menuItems: [],
  });

  const [selectedId, setSelectedId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);

    try {
      const response = await fetch("/api/staff-reservations/billing", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            (response.status === 401 || response.status === 403
              ? "Please sign in with an administrator account."
              : "Could not load reservations."),
        );
      }

      setData({
        reservations: result.reservations ?? [],
        menuItems: result.menuItems ?? [],
      });

      setSelectedId((current) => {
        if (
          current &&
          result.reservations?.some(
            (reservation: Reservation) => reservation.id === current,
          )
        ) {
          return current;
        }

        return result.reservations?.[0]?.id ?? "";
      });

      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load billing.",
      );
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(true);

    const interval = window.setInterval(() => {
      void loadData(false);
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [loadData]);

  const selectedReservation = data.reservations.find(
    (reservation) => reservation.id === selectedId,
  );

  const existingOrder = selectedReservation?.order ?? null;

  const selectedItems = useMemo(
    () =>
      data.menuItems
        .filter((item) => (quantities[item.id] ?? 0) > 0)
        .map((item) => ({
          ...item,
          quantity: quantities[item.id],
          lineTotal:
            (Math.round(item.price * 100) * quantities[item.id]) / 100,
        })),
    [data.menuItems, quantities],
  );

  const additionalTotal = selectedItems.reduce(
    (sum, item) => sum + item.lineTotal,
    0,
  );

  const preorderTotal = (selectedReservation?.preorderItems ?? []).reduce(
    (sum, item) =>
      sum +
      (item.lineTotal ??
        Math.round(item.unitPrice * 100) * item.quantity / 100),
    0,
  );

  const estimatedBillTotal = Math.round(
    (preorderTotal + additionalTotal) * 100,
  ) / 100;

  const paidDeposit =
    selectedReservation?.deposit?.status === "PAID"
      ? selectedReservation.deposit.amount
      : 0;

  const estimatedCredit = Math.min(paidDeposit, estimatedBillTotal);
  const estimatedBalance = Math.max(
    0,
    Math.round((estimatedBillTotal - estimatedCredit) * 100) / 100,
  );

  function changeQuantity(menuItemId: string, quantity: number) {
    setQuantities((current) => {
      const next = { ...current };

      if (quantity <= 0) {
        delete next[menuItemId];
      } else {
        next[menuItemId] = Math.min(100, Math.floor(quantity));
      }

      return next;
    });
  }

  async function createBill() {
    if (!selectedReservation) {
      setError("Select a reservation first.");
      return;
    }

    if (
      selectedItems.length === 0 &&
      (selectedReservation.preorderItems ?? []).length === 0
    ) {
      setError("There are no saved pre-orders. Add at least one menu item.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/staff-reservations/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: selectedReservation.id,
          items: selectedItems.map((item) => ({
            menuItemId: item.id,
            quantity: item.quantity,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not create the bill.");
      }

      const createdOrder = result.order as ExistingOrder & {
        balanceDue?: number;
      };

      const balance =
        typeof createdOrder.balanceDue === "number"
          ? createdOrder.balanceDue
          : Math.max(
              0,
              createdOrder.total - (createdOrder.depositCredit ?? 0),
            );

      setMessage(
        balance === 0
          ? `Bill ${createdOrder.orderNumber} created. The paid deposit covers the full bill of ${money(createdOrder.total)}.`
          : `Bill ${createdOrder.orderNumber} created. Total: ${money(createdOrder.total)}. Deposit credit: ${money(createdOrder.depositCredit ?? 0)}. Outstanding balance: ${money(balance)}.`,
      );

      setQuantities({});
      await loadData(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create the bill.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function markPaid(orderId: string) {
    const confirmed = window.confirm(
      "Confirm that the outstanding balance has actually been received?",
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/staff-reservations/billing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          action: "MARK_PAID",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not record payment.");
      }

      setMessage(result.message || "Payment recorded.");
      await loadData(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not record payment.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateReservationStatus(
    reservationId: string,
    status: "COMPLETED" | "CANCELLED",
  ) {
    const confirmed = window.confirm(
      status === "COMPLETED"
        ? "Mark this reservation as completed?"
        : "Cancel this reservation? This does not delete its bill.",
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/staff-reservations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reservationId, status }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not update reservation.");
      }

      setMessage("Reservation status updated.");
      await loadData(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update reservation.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8f7f2] px-4 py-8 text-[#20352b] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
              DineDesk · Administration
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              Reservation billing
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              Include saved pre-orders, add items served, apply the paid
              deposit, and record the outstanding balance.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/staff-reservations"
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold hover:bg-gray-50"
            >
              Reservations
            </Link>
            <Link
              href="/admin"
              className="rounded-xl bg-[#20352b] px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900"
            >
              Admin dashboard
            </Link>
          </div>
        </header>

        {message && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
          >
            {message}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            Loading reservations and menu...
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Reservations</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {data.reservations.length} total
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadData(true)}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>

              {data.reservations.length === 0 ? (
                <p className="rounded-xl bg-gray-50 p-5 text-sm text-gray-600">
                  No reservations found.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.reservations.map((reservation) => {
                    const active = reservation.id === selectedId;
                    const tableNames = reservation.assignedTables?.length
                      ? reservation.assignedTables
                          .map((assignment) => assignment.table.tableNumber)
                          .join(", ")
                      : reservation.table?.tableNumber ?? "Not assigned";

                    const preorderCount = (
                      reservation.preorderItems ?? []
                    ).reduce((sum, item) => sum + item.quantity, 0);

                    return (
                      <button
                        type="button"
                        key={reservation.id}
                        onClick={() => {
                          setSelectedId(reservation.id);
                          setQuantities({});
                          setMessage("");
                          setError("");
                        }}
                        className={`w-full rounded-xl border p-4 text-left transition ${
                          active
                            ? "border-emerald-700 bg-emerald-50 ring-1 ring-emerald-700"
                            : "border-gray-200 hover:border-emerald-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-bold">{reservation.user.name}</p>
                            <p className="mt-1 text-xs text-gray-500">
                              {reservation.user.phone || "No phone provided"}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(reservation.status)}`}
                          >
                            {reservation.status}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-600">
                          <span>{formatDate(reservation.date)}</span>
                          <span>{formatTime(reservation.startTime)}</span>
                          <span>{reservation.guests} guests</span>
                          <span>Table(s): {tableNames}</span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-gray-100 px-2.5 py-1">
                            Pre-orders: {preorderCount} item(s)
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 ${
                              reservation.deposit?.status === "PAID"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            Deposit: {reservation.deposit?.status ?? "NONE"}
                          </span>
                        </div>

                        {reservation.order && (
                          <div className="mt-3 border-t border-gray-200 pt-3 text-sm">
                            <p className="font-semibold">
                              {reservation.order.orderNumber}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                              <span>{money(reservation.order.total)}</span>
                              <span
                                className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(reservation.order.payment?.status ?? "PENDING")}`}
                              >
                                Payment:{" "}
                                {reservation.order.payment?.status ?? "MISSING"}
                              </span>
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="space-y-6">
              {selectedReservation ? (
                <>
                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-gray-500">
                          Selected reservation
                        </p>
                        <h2 className="mt-1 text-2xl font-bold">
                          {selectedReservation.user.name}
                        </h2>
                        <p className="mt-1 text-sm text-gray-600">
                          {formatDate(selectedReservation.date)} ·{" "}
                          {formatTime(selectedReservation.startTime)} ·{" "}
                          {selectedReservation.guests} guests
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusClass(selectedReservation.status)}`}
                      >
                        {selectedReservation.status}
                      </span>
                    </div>

                    <div className="mt-4 rounded-xl bg-gray-50 p-4">
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="text-gray-600">Deposit amount</span>
                        <span className="font-semibold">
                          {money(selectedReservation.deposit?.amount ?? 0)}
                        </span>
                      </div>
                      <div className="mt-2 flex justify-between gap-3 text-sm">
                        <span className="text-gray-600">Deposit status</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(selectedReservation.deposit?.status ?? "PENDING")}`}
                        >
                          {selectedReservation.deposit?.status ?? "NOT RECORDED"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-gray-500">
                        Only a PAID deposit is deducted from the food bill.
                      </p>
                    </div>

                    {selectedReservation.status !== "COMPLETED" &&
                      selectedReservation.status !== "CANCELLED" && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              void updateReservationStatus(
                                selectedReservation.id,
                                "COMPLETED",
                              )
                            }
                            className="rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            Mark completed
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              void updateReservationStatus(
                                selectedReservation.id,
                                "CANCELLED",
                              )
                            }
                            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            Cancel reservation
                          </button>
                        </div>
                      )}
                  </div>

                  {existingOrder ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-gray-500">Existing bill</p>
                          <h2 className="mt-1 text-xl font-bold">
                            {existingOrder.orderNumber}
                          </h2>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusClass(existingOrder.payment?.status ?? "PENDING")}`}
                        >
                          {existingOrder.payment?.status ?? "NO PAYMENT RECORD"}
                        </span>
                      </div>

                      <div className="mt-5 divide-y divide-gray-100">
                        {existingOrder.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex justify-between gap-3 py-3 text-sm"
                          >
                            <div>
                              <p className="font-semibold">{item.itemName}</p>
                              <p className="mt-1 text-gray-500">
                                {item.quantity} × {money(item.unitPrice)}
                              </p>
                            </div>
                            <p className="font-semibold">
                              {money(item.quantity * item.unitPrice)}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 space-y-3 border-t border-gray-200 pt-4 text-sm">
                        <div className="flex justify-between gap-3">
                          <span className="text-gray-600">Subtotal</span>
                          <span>{money(existingOrder.subtotal)}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-gray-600">Tax</span>
                          <span>{money(existingOrder.tax)}</span>
                        </div>
                        <div className="flex justify-between gap-3 text-lg font-bold">
                          <span>Food bill total</span>
                          <span>{money(existingOrder.total)}</span>
                        </div>
                        <div className="flex justify-between gap-3 text-emerald-800">
                          <span>Paid deposit applied</span>
                          <span>
                            −{money(existingOrder.depositCredit ?? 0)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3 border-t border-gray-200 pt-3 text-base font-bold">
                          <span>Outstanding balance</span>
                          <span>{money(outstandingBalance(existingOrder))}</span>
                        </div>
                        <div className="flex justify-between gap-3 text-gray-600">
                          <span>Balance payment method</span>
                          <span>{existingOrder.payment?.method ?? "N/A"}</span>
                        </div>
                        <div className="flex justify-between gap-3 text-gray-600">
                          <span>Balance payment status</span>
                          <span>{existingOrder.payment?.status ?? "N/A"}</span>
                        </div>
                      </div>

                      {existingOrder.payment?.status !== "PAID" &&
                        existingOrder.payment &&
                        outstandingBalance(existingOrder) > 0 && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void markPaid(existingOrder.id)}
                            className="mt-5 w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                          >
                            {saving
                              ? "Saving..."
                              : `Confirm ${money(outstandingBalance(existingOrder))} balance received`}
                          </button>
                        )}

                      {existingOrder.payment?.status === "PAID" && (
                        <p className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                          The outstanding balance is recorded as paid.
                        </p>
                      )}

                      {existingOrder.payment?.status === "PAID" &&
                        outstandingBalance(existingOrder) === 0 && (
                          <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                            No further balance collection is required. The
                            deposit credit covers this bill.
                          </p>
                        )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                      <h2 className="text-xl font-bold">Create food bill</h2>
                      <p className="mt-1 text-sm text-gray-500">
                        Saved pre-orders are included automatically. Add
                        additional items below if needed.
                      </p>

                      {selectedReservation.status === "CANCELLED" ? (
                        <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                          Cancelled reservations cannot receive a new bill.
                        </p>
                      ) : (
                        <>
                          {(selectedReservation.preorderItems ?? []).length >
                            0 && (
                            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                              <h3 className="font-bold">
                                Saved pre-orders
                              </h3>
                              <div className="mt-3 space-y-2">
                                {selectedReservation.preorderItems!.map(
                                  (item) => (
                                    <div
                                      key={item.id}
                                      className="flex justify-between gap-3 text-sm"
                                    >
                                      <span>
                                        {item.itemName} × {item.quantity}
                                      </span>
                                      <span className="font-medium">
                                        {money(
                                          item.lineTotal ??
                                            item.unitPrice * item.quantity,
                                        )}
                                      </span>
                                    </div>
                                  ),
                                )}
                              </div>
                              <div className="mt-3 flex justify-between border-t border-emerald-200 pt-3 text-sm font-bold">
                                <span>Pre-order subtotal</span>
                                <span>{money(preorderTotal)}</span>
                              </div>
                            </div>
                          )}

                          {data.menuItems.length === 0 ? (
                            <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                              No additional menu items are available. You can
                              still create a bill if saved pre-orders exist.
                            </p>
                          ) : (
                            <>
                              <h3 className="mt-6 font-semibold">
                                Add extra items
                              </h3>
                              <div className="mt-3 max-h-[400px] space-y-3 overflow-y-auto pr-1">
                                {data.menuItems.map((item) => {
                                  const quantity = quantities[item.id] ?? 0;

                                  return (
                                    <div
                                      key={item.id}
                                      className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3"
                                    >
                                      <div className="min-w-0">
                                        <p className="font-semibold">
                                          {item.name}
                                        </p>
                                        <p className="mt-1 text-xs text-gray-500">
                                          {item.category.name}
                                        </p>
                                        <p className="mt-1 text-sm font-semibold text-emerald-800">
                                          {money(item.price)}
                                        </p>
                                      </div>

                                      <div className="flex shrink-0 items-center gap-2">
                                        <button
                                          type="button"
                                          aria-label={`Remove one ${item.name}`}
                                          disabled={quantity === 0 || saving}
                                          onClick={() =>
                                            changeQuantity(
                                              item.id,
                                              quantity - 1,
                                            )
                                          }
                                          className="h-9 w-9 rounded-lg border border-gray-300 text-lg disabled:opacity-30"
                                        >
                                          −
                                        </button>
                                        <span className="w-5 text-center text-sm font-bold">
                                          {quantity}
                                        </span>
                                        <button
                                          type="button"
                                          aria-label={`Add one ${item.name}`}
                                          disabled={quantity >= 100 || saving}
                                          onClick={() =>
                                            changeQuantity(
                                              item.id,
                                              quantity + 1,
                                            )
                                          }
                                          className="h-9 w-9 rounded-lg bg-[#20352b] text-lg text-white disabled:opacity-30"
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}

                          <div className="mt-5 rounded-xl bg-[#f8f7f2] p-4">
                            <div className="space-y-3 text-sm">
                              <div className="flex justify-between gap-3">
                                <span className="text-gray-600">
                                  Saved pre-orders
                                </span>
                                <span>{money(preorderTotal)}</span>
                              </div>
                              <div className="flex justify-between gap-3">
                                <span className="text-gray-600">
                                  Additional items
                                </span>
                                <span>{money(additionalTotal)}</span>
                              </div>
                              <div className="flex justify-between gap-3 border-t border-gray-200 pt-3 text-lg font-bold">
                                <span>Estimated food bill</span>
                                <span>{money(estimatedBillTotal)}</span>
                              </div>
                              <div className="flex justify-between gap-3 text-emerald-800">
                                <span>Paid deposit credit</span>
                                <span>−{money(estimatedCredit)}</span>
                              </div>
                              <div className="flex justify-between gap-3 border-t border-gray-200 pt-3 text-base font-bold">
                                <span>Estimated balance</span>
                                <span>{money(estimatedBalance)}</span>
                              </div>
                            </div>

                            <p className="mt-3 text-xs leading-5 text-gray-500">
                              Tax is currently 0%, matching the existing
                              billing API. The server calculates the final
                              bill using database prices.
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={
                              saving ||
                              (selectedItems.length === 0 &&
                                (selectedReservation.preorderItems ?? [])
                                  .length === 0)
                            }
                            onClick={() => void createBill()}
                            className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {saving ? "Processing..." : "Create dine-in bill"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-white p-8 text-gray-600 shadow-sm">
                  Select a reservation to create or view its bill.
                </div>
              )}
            </section>
          </div>
        )}

        <p className="mt-6 text-xs leading-5 text-gray-500">
          Reservation status refreshes every 60 seconds while this page is
          open. Bills are not marked paid automatically. Confirm receipt only
          after the outstanding balance has actually been collected.
        </p>
      </div>
    </main>
  );
}
