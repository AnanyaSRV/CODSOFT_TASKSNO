"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

type TrackedOrder = {
  orderNumber: string;
  status: string;
  subtotal: string;
  tax: string;
  total: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: {
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

const stages = [
  { status: "PENDING", label: "Order received" },
  { status: "CONFIRMED", label: "Order confirmed" },
  { status: "PREPARING", label: "Preparing your food" },
  { status: "READY", label: "Ready to serve" },
  { status: "SERVED", label: "Order completed" },
];

function money(value: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function dateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderNumberFromUrl = params.get("orderNumber");

    if (orderNumberFromUrl) {
      setOrderNumber(orderNumberFromUrl);
    }
  }, []);

  async function trackOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setOrder(null);

    try {
      const response = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: orderNumber.trim(),
          phone: phone.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Unable to find this order.");
        return;
      }

      setOrder(data.order);
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const cancelled = order?.status === "CANCELLED";
  const currentStage = stages.findIndex(
    (stage) => stage.status === order?.status,
  );

  return (
    <main className="min-h-screen bg-[#f8f7f1] px-4 py-10 text-[#263b2c] sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#52734b] hover:underline"
        >
          ← Back to DineDesk
        </Link>

        <header className="mb-8 mt-8">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#78916b]">
            DineDesk
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Track your order
          </h1>
          <p className="mt-3 max-w-xl leading-7 text-[#62685b]">
            Enter your order number and the phone number you provided at
            checkout to view your order status and payment details.
          </p>
        </header>

        <form
          onSubmit={trackOrder}
          className="space-y-5 rounded-2xl border border-[#e5e5d9] bg-white p-5 shadow-sm sm:p-7"
        >
          <div>
            <label
              htmlFor="orderNumber"
              className="mb-2 block text-sm font-semibold"
            >
              Order number
            </label>
            <input
              id="orderNumber"
              required
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value)}
              placeholder="e.g. DINE-123456-ABC123"
              autoComplete="off"
              className="w-full rounded-xl border border-[#dcded2] px-4 py-3 outline-none transition focus:border-[#52734b] focus:ring-2 focus:ring-[#52734b]/15"
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="mb-2 block text-sm font-semibold"
            >
              Checkout phone number
            </label>
            <input
              id="phone"
              type="tel"
              required
              minLength={7}
              maxLength={20}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Enter the same phone number"
              autoComplete="tel"
              className="w-full rounded-xl border border-[#dcded2] px-4 py-3 outline-none transition focus:border-[#52734b] focus:ring-2 focus:ring-[#52734b]/15"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#263b2c] px-5 py-3.5 font-semibold text-white transition hover:bg-[#38553d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Looking up your order..." : "Track order"}
          </button>
        </form>

        {order && (
          <section
            aria-live="polite"
            className="mt-7 space-y-6 rounded-2xl border border-[#e5e5d9] bg-white p-5 shadow-sm sm:p-7"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm text-[#62685b]">Order number</p>
                <h2 className="mt-1 break-all text-xl font-bold">
                  {order.orderNumber}
                </h2>
                <p className="mt-2 text-sm text-[#62685b]">
                  Placed {dateTime(order.createdAt)}
                </p>
              </div>

              <span
                className={`w-fit rounded-full px-3 py-1.5 text-sm font-bold ${
                  cancelled
                    ? "bg-red-100 text-red-800"
                    : order.status === "SERVED"
                      ? "bg-green-100 text-green-800"
                      : "bg-[#edf2e8] text-[#38553d]"
                }`}
              >
                {order.status.replaceAll("_", " ")}
              </span>
            </div>

            <div className="border-t border-[#e5e5d9] pt-5">
              <h3 className="mb-5 text-lg font-bold">Order progress</h3>

              {cancelled ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
                  This order has been cancelled. Please contact the restaurant
                  if you have questions about your payment.
                </div>
              ) : (
                <ol className="space-y-4">
                  {stages.map((stage, index) => {
                    const complete =
                      currentStage >= 0 && index <= currentStage;
                    const active = index === currentStage;

                    return (
                      <li key={stage.status} className="flex gap-3">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                            complete
                              ? "bg-[#38553d] text-white"
                              : "border border-[#dcded2] bg-white text-[#7a8073]"
                          }`}
                        >
                          {complete ? "✓" : index + 1}
                        </span>
                        <div className="pt-1">
                          <p
                            className={`font-semibold ${
                              active ? "text-[#38553d]" : "text-[#62685b]"
                            }`}
                          >
                            {stage.label}
                          </p>
                          {active && (
                            <p className="mt-1 text-sm text-[#62685b]">
                              Current status
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              <p className="mt-4 text-xs leading-5 text-[#62685b]">
                Last updated {dateTime(order.updatedAt)}. Submit the tracking
                form again to retrieve the latest status.
              </p>
            </div>

            <div className="border-t border-[#e5e5d9] pt-5">
              <h3 className="mb-4 text-lg font-bold">Items ordered</h3>

              <div className="space-y-4">
                {order.items.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="flex justify-between gap-4 text-sm"
                  >
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="mt-1 text-[#62685b]">
                        Quantity: {item.quantity} × {money(item.unitPrice)}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold">
                      {money(
                        (
                          Number(item.unitPrice) * item.quantity
                        ).toFixed(2),
                      )}
                    </p>
                  </div>
                ))}
              </div>

              {order.notes && (
                <div className="mt-5 rounded-xl bg-[#f8f7f1] p-3 text-sm">
                  <span className="font-semibold">Order notes: </span>
                  {order.notes}
                </div>
              )}

              <div className="mt-5 space-y-2 border-t border-[#e5e5d9] pt-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-[#62685b]">Subtotal</span>
                  <span>{money(order.subtotal)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#62685b]">Tax</span>
                  <span>{money(order.tax)}</span>
                </div>
                <div className="flex justify-between gap-4 pt-2 text-lg font-bold">
                  <span>Total</span>
                  <span>{money(order.total)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-[#f8f7f1] p-4">
              <h3 className="font-bold">Payment details</h3>
              {order.payment ? (
                <div className="mt-3 space-y-2 text-sm">
                  <p className="flex justify-between gap-4">
                    <span className="text-[#62685b]">Method</span>
                    <span>{order.payment.method.replaceAll("_", " ")}</span>
                  </p>
                  <p className="flex justify-between gap-4">
                    <span className="text-[#62685b]">Payment status</span>
                    <span className="font-semibold">
                      {order.payment.status.replaceAll("_", " ")}
                    </span>
                  </p>
                  <p className="flex justify-between gap-4">
                    <span className="text-[#62685b]">Amount</span>
                    <span className="font-semibold">
                      {money(order.payment.amount)}
                    </span>
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-[#62685b]">
                  No payment record is available for this order.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                trackOrder({
                  preventDefault: () => {},
                } as FormEvent<HTMLFormElement>)
              }
              disabled={loading}
              className="w-full rounded-xl border border-[#dcded2] px-5 py-3 font-semibold transition hover:bg-[#f8f7f1] disabled:opacity-60"
            >
              {loading ? "Refreshing..." : "Refresh order status"}
            </button>
          </section>
        )}

        <p className="mt-8 text-center text-sm text-[#62685b]">
          Want to order something else?{" "}
          <Link href="/" className="font-semibold text-[#52734b] underline">
            Explore our menu
          </Link>
        </p>
      </div>
    </main>
  );
}