
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  LoaderCircle,
  Minus,
  Plus,
  UtensilsCrossed,
  Users,
} from "lucide-react";

type Table = {
  id: string;
  tableNumber: string;
  capacity: number;
};

type Availability = {
  available: boolean;
  suggestedTables: Table[];
  totalCapacity: number;
  message: string;
  depositPerGuest?: number;
  depositAmount?: number;
};

type MenuItem = {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string | null;
  isAvailable?: boolean;
  isVegetarian?: boolean;
  category?: { name?: string } | string | null;
};

type ReservationResult = {
  id: string;
  date: string;
  startTime?: string;
  endTime?: string;
  guests: number;
  status: string;
  table?: { tableNumber: string; capacity?: number } | null;
  tables?: Table[];
  customer?: { name: string; phone: string };
  user?: { name: string; phone?: string | null };
  deposit?: {
    amount: number | string;
    currency?: string;
    status?: string;
  } | null;
};

type CheckoutResponse = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  reservationId: string;
  guestCount: number;
  depositRupees: number;
  customerName?: string;
  alreadyPaid?: boolean;
};

const DEPOSIT_PER_GUEST = 100;

function getLocalDate() {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatRupees(amount: number | string) {
  const value = Number(amount);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function getErrorMessage(value: unknown, fallback: string) {
  if (
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return value.message;
  }

  return fallback;
}

function extractMenuItems(data: unknown): MenuItem[] {
  const found = new Map<string, MenuItem>();
  const visited = new Set<object>();

  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (visited.has(value)) return;

    visited.add(value);

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    const record = value as Record<string, unknown>;

    if (
      typeof record.id === "string" &&
      typeof record.name === "string" &&
      record.price !== undefined
    ) {
      const price = Number(record.price);

      if (Number.isFinite(price) && price >= 0) {
        found.set(record.id, {
          id: record.id,
          name: record.name,
          description:
            typeof record.description === "string"
              ? record.description
              : undefined,
          price,
          imageUrl:
            typeof record.imageUrl === "string"
              ? record.imageUrl
              : null,
          isAvailable:
            typeof record.isAvailable === "boolean"
              ? record.isAvailable
              : true,
          isVegetarian:
            typeof record.isVegetarian === "boolean"
              ? record.isVegetarian
              : false,
          category:
            typeof record.category === "string"
              ? record.category
              : record.category &&
                  typeof record.category === "object"
                ? (record.category as { name?: string })
                : null,
        });
      }
    }

    Object.values(record).forEach(visit);
  }

  visit(data);

  return Array.from(found.values()).filter(
    (item) => item.isAvailable !== false,
  );
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );

    if (existing) {
      existing.addEventListener(
        "load",
        () => resolve(Boolean(window.Razorpay)),
        { once: true },
      );
      existing.addEventListener("error", () => resolve(false), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;

    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);

    document.body.appendChild(script);
  });
}

export default function ReservationsPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [today, setToday] = useState("");
  const [time, setTime] = useState("19:00");
  const [guests, setGuests] = useState("2");
  const [notes, setNotes] = useState("");

  const [availability, setAvailability] =
    useState<Availability | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [preorderQuantities, setPreorderQuantities] = useState<
    Record<string, number>
  >({});

  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState<ReservationResult | null>(null);
  const [pendingReservation, setPendingReservation] =
    useState<ReservationResult | null>(null);

  const depositAmount = Math.max(0, Number(guests) || 0) * DEPOSIT_PER_GUEST;

  const preorderTotal = menu.reduce((total, item) => {
    return total + item.price * (preorderQuantities[item.id] || 0);
  }, 0);

  useEffect(() => {
    const localToday = getLocalDate();
    setToday(localToday);
    setDate(localToday);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMenu() {
      setLoadingMenu(true);

      try {
        const response = await fetch("/api/menu", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load the menu.");
        }

        const result: unknown = await response.json();

        if (!cancelled) {
          setMenu(extractMenuItems(result));
        }
      } catch {
        if (!cancelled) {
          setMenu([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingMenu(false);
        }
      }
    }

    void loadMenu();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!date || !time || !guests) return;

    let cancelled = false;

    async function checkAvailability() {
      setLoadingTables(true);
      setAvailability(null);

      try {
        const params = new URLSearchParams({ date, time, guests });
        const response = await fetch(
          `/api/reservations?${params.toString()}`,
          { cache: "no-store" },
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to check table availability.",
          );
        }

        if (!cancelled) {
          setAvailability(result as Availability);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            getErrorMessage(err, "Unable to check table availability."),
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingTables(false);
        }
      }
    }

    void checkAvailability();

    return () => {
      cancelled = true;
    };
  }, [date, time, guests]);

  const changePreorderQuantity = useCallback(
    (itemId: string, difference: number) => {
      setPreorderQuantities((current) => {
        const nextQuantity = Math.max(
          0,
          Math.min(20, (current[itemId] || 0) + difference),
        );

        return {
          ...current,
          [itemId]: nextQuantity,
        };
      });
    },
    [],
  );

  async function openDepositCheckout(reservation: ReservationResult) {
    setError("");
    setNotice("");
    setVerifying(true);

    try {
      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded || !window.Razorpay) {
        throw new Error(
          "Razorpay Checkout could not be loaded. Check your internet connection and try again.",
        );
      }

      const orderResponse = await fetch(
        "/api/payments/razorpay/reservation-order",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reservationId: reservation.id,
            phone: phone.trim(),
          }),
        },
      );

      const checkout = (await orderResponse.json()) as
        | CheckoutResponse
        | { error?: string };

      if (!orderResponse.ok) {
        throw new Error(
          "error" in checkout && checkout.error
            ? checkout.error
            : "Unable to start the reservation deposit payment.",
        );
      }

      const paymentDetails = checkout as CheckoutResponse;

      if (paymentDetails.alreadyPaid) {
        setSuccess({
          ...reservation,
          deposit: {
            amount: paymentDetails.depositRupees,
            currency: "INR",
            status: "PAID",
          },
          status: "CONFIRMED",
        });
        setPendingReservation(null);
        setNotice("Your reservation deposit has already been paid.");
        return;
      }

      const razorpay = new window.Razorpay({
        key: paymentDetails.keyId,
        amount: paymentDetails.amount,
        currency: paymentDetails.currency,
        name: "DineDesk",
        description: `Reservation deposit — ${paymentDetails.guestCount} guest(s)`,
        order_id: paymentDetails.orderId,
        notes: {
          dinedeskOrderNumber: reservation.id,
        },
        prefill: {
          name:
            paymentDetails.customerName ||
            name.trim() ||
            reservation.customer?.name ||
            reservation.user?.name ||
            "",
          contact: phone.trim(),
        },
        theme: {
          color: "#166534",
        },
        handler: async (paymentResponse) => {
          setVerifying(true);
          setError("");
          setNotice("Verifying your payment. Please wait.");

          try {
            const verifyResponse = await fetch(
              "/api/payments/razorpay/reservation-verify",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  reservationId: reservation.id,
                  razorpay_order_id: paymentResponse.razorpay_order_id,
                  razorpay_payment_id: paymentResponse.razorpay_payment_id,
                  razorpay_signature: paymentResponse.razorpay_signature,
                }),
              },
            );

            const verifyResult = await verifyResponse.json();

            if (!verifyResponse.ok || verifyResult.verified !== true) {
              throw new Error(
                verifyResult.error ||
                  "Payment verification could not be completed.",
              );
            }

            setSuccess({
              ...reservation,
              status: "CONFIRMED",
              deposit: {
                amount: paymentDetails.depositRupees,
                currency: "INR",
                status: "PAID",
              },
            });

            setPendingReservation(null);
            setNotice("");
            setError("");
          } catch (err) {
            setError(
              `${getErrorMessage(
                err,
                "We could not verify your payment.",
              )} If money was deducted, do not pay again until you check the payment status or contact the restaurant.`,
            );
          } finally {
            setVerifying(false);
          }
        },
        modal: {
          ondismiss: () => {
            setVerifying(false);
            setNotice(
              "Checkout was closed. Your reservation is still pending until the deposit is paid. You can retry the payment below.",
            );
          },
        },
      });

      razorpay.open();
    } catch (err) {
      setError(
        getErrorMessage(err, "Unable to open the payment checkout."),
      );
    } finally {
      setVerifying(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!/^[0-9+\-\s()]{10,16}$/.test(phone.trim())) {
      setError("Please enter a valid contact number.");
      return;
    }

    if (!date || date < today) {
      setError("Please select today or a future date.");
      return;
    }

    const guestCount = Number(guests);

    if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 20) {
      setError("Guest count must be between 1 and 20.");
      return;
    }

    if (!availability?.available) {
      setError("Please select an available date, time, and guest count.");
      return;
    }

    setSubmitting(true);

    try {
      const preorderItems = Object.entries(preorderQuantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([menuItemId, quantity]) => ({ menuItemId, quantity }));

      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          date,
          time,
          guests: guestCount,
          notes: notes.trim(),
          preorderItems,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to create your reservation.",
        );
      }

      const createdReservation = (
        result.reservation || result
      ) as ReservationResult;

      if (!createdReservation.id) {
        throw new Error(
          "The reservation response did not include a reservation reference. Please check your reservation status before submitting again.",
        );
      }

      const reservationWithDetails: ReservationResult = {
        ...createdReservation,
        guests: createdReservation.guests || guestCount,
        customer: createdReservation.customer || {
          name: name.trim(),
          phone: phone.trim(),
        },
        deposit: createdReservation.deposit || {
          amount: depositAmount,
          currency: "INR",
          status: "PENDING",
        },
      };

      setPendingReservation(reservationWithDetails);
      await openDepositCheckout(reservationWithDetails);
    } catch (err) {
      setError(
        getErrorMessage(err, "Unable to create your reservation."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setSuccess(null);
    setPendingReservation(null);
    setError("");
    setNotice("");
    setName("");
    setPhone("");
    setNotes("");
    setGuests("2");
    setTime("19:00");
    setPreorderQuantities({});
    setDate(getLocalDate());
  }

  const selectedTables =
    success?.tables?.length
      ? success.tables
      : success?.table
        ? [success.table as Table]
        : [];

  if (success) {
    return (
      <main className="min-h-screen bg-stone-50 px-4 py-12 text-stone-900">
        <div className="mx-auto max-w-2xl rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-10">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
            <CheckCircle2 size={36} />
          </div>

          <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-green-700">
            Payment successful
          </p>

          <h1 className="mt-3 text-center text-3xl font-bold">
            Your reservation is confirmed!
          </h1>

          <p className="mt-3 text-center text-stone-600">
            Thank you for choosing DineDesk. Keep your reservation reference
            for your visit.
          </p>

          <div className="mt-8 rounded-2xl bg-stone-50 p-5">
            <div className="flex items-center justify-between gap-4 border-b border-stone-200 pb-4">
              <span className="text-stone-600">Reservation reference</span>
              <span className="break-all font-bold">{success.id}</span>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-stone-500">Date</p>
                <p className="mt-1 font-semibold">
                  {new Date(success.date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div>
                <p className="text-sm text-stone-500">Guests</p>
                <p className="mt-1 font-semibold">{success.guests}</p>
              </div>

              <div>
                <p className="text-sm text-stone-500">Table(s)</p>
                <p className="mt-1 font-semibold">
                  {selectedTables.length
                    ? selectedTables.map((table) => table.tableNumber).join(", ")
                    : "Assigned by the restaurant"}
                </p>
              </div>

              <div>
                <p className="text-sm text-stone-500">Deposit paid</p>
                <p className="mt-1 font-semibold text-green-700">
                  {formatRupees(
                    success.deposit?.amount ??
                      success.guests * DEPOSIT_PER_GUEST,
                  )}
                </p>
              </div>
            </div>

            <p className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-800">
              Your deposit is recorded as paid. The restaurant will apply the
              deposit to your final food bill according to its billing policy.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-green-800 px-5 py-3 font-semibold text-white transition hover:bg-green-900"
            >
              Browse menu
            </Link>

            <button
              type="button"
              onClick={resetForm}
              className="flex-1 rounded-xl border border-stone-300 px-5 py-3 font-semibold transition hover:bg-stone-50"
            >
              Make another reservation
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 text-stone-900 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-stone-600 transition hover:text-green-800"
        >
          <ArrowLeft size={16} />
          Back to menu
        </Link>

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-800">
            DineDesk
          </p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            Reserve your table
          </h1>
          <p className="mt-3 max-w-2xl text-stone-600">
            Choose your visit details, optionally pre-order food, and pay a
            refundable or bill-adjustable deposit according to the restaurant&apos;s
            policy.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            {notice}
          </div>
        )}

        {pendingReservation && (
          <section className="mb-6 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold">Complete your deposit payment</h2>
            <p className="mt-2 text-sm text-stone-600">
              Reservation reference:{" "}
              <span className="font-semibold">{pendingReservation.id}</span>
            </p>
            <p className="mt-1 text-sm text-stone-600">
              Deposit:{" "}
              <span className="font-semibold">
                {formatRupees(
                  pendingReservation.deposit?.amount ??
                    pendingReservation.guests * DEPOSIT_PER_GUEST,
                )}
              </span>
            </p>
            <button
              type="button"
              disabled={verifying || submitting}
              onClick={() => void openDepositCheckout(pendingReservation)}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-green-800 px-5 py-3 font-semibold text-white transition hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {verifying ? (
                <>
                  <LoaderCircle className="animate-spin" size={18} />
                  Please wait...
                </>
              ) : (
                "Retry deposit payment"
              )}
            </button>
          </section>
        )}

        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-5">
          <section className="space-y-6 lg:col-span-3">
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
              <h2 className="text-xl font-bold">Your details</h2>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium">
                    Full name
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    maxLength={100}
                    required
                    placeholder="Enter your name"
                    className="w-full rounded-xl border border-stone-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium">
                    Phone number
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    autoComplete="tel"
                    maxLength={16}
                    required
                    placeholder="Contact number"
                    className="w-full rounded-xl border border-stone-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-100"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <CalendarDays size={21} className="text-green-800" />
                Visit details
              </h2>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium">
                    Reservation date
                  </span>
                  <input
                    type="date"
                    value={date}
                    min={today}
                    onChange={(event) => setDate(event.target.value)}
                    required
                    className="w-full rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Clock size={16} />
                    Time
                  </span>
                  <select
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                    required
                    className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                  >
                    {[
                      "11:00",
                      "11:30",
                      "12:00",
                      "12:30",
                      "13:00",
                      "13:30",
                      "14:00",
                      "14:30",
                      "15:00",
                      "17:00",
                      "17:30",
                      "18:00",
                      "18:30",
                      "19:00",
                      "19:30",
                      "20:00",
                      "20:30",
                      "21:00",
                      "21:30",
                    ].map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Users size={16} />
                    Number of guests
                  </span>
                  <select
                    value={guests}
                    onChange={(event) => setGuests(event.target.value)}
                    required
                    className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                  >
                    {Array.from({ length: 20 }, (_, index) => index + 1).map(
                      (count) => (
                        <option key={count} value={String(count)}>
                          {count} {count === 1 ? "guest" : "guests"}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>

              <div className="mt-5 rounded-xl bg-stone-50 p-4">
                {loadingTables ? (
                  <p className="flex items-center gap-2 text-sm text-stone-600">
                    <LoaderCircle size={17} className="animate-spin" />
                    Checking table availability...
                  </p>
                ) : availability ? (
                  <>
                    <p
                      className={`font-semibold ${
                        availability.available
                          ? "text-green-800"
                          : "text-red-700"
                      }`}
                    >
                      {availability.message ||
                        (availability.available
                          ? "Tables are available."
                          : "No tables are available for this selection.")}
                    </p>

                    {availability.available &&
                      availability.suggestedTables?.length > 0 && (
                        <p className="mt-2 text-sm text-stone-600">
                          Suggested table(s):{" "}
                          {availability.suggestedTables
                            .map((table) => table.tableNumber)
                            .join(", ")}
                        </p>
                      )}
                  </>
                ) : (
                  <p className="text-sm text-stone-600">
                    Select a date and time to check availability.
                  </p>
                )}
              </div>

              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-medium">
                  Special requests (optional)
                </span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Birthday, seating preference, allergies, etc."
                  className="w-full resize-y rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <UtensilsCrossed size={21} className="text-green-800" />
                Pre-order food
              </h2>
              <p className="mt-2 text-sm text-stone-600">
                Optional. Select dishes to have them recorded with your
                reservation. You can leave this section empty.
              </p>

              {loadingMenu ? (
                <p className="mt-5 flex items-center gap-2 text-sm text-stone-600">
                  <LoaderCircle size={17} className="animate-spin" />
                  Loading menu...
                </p>
              ) : menu.length === 0 ? (
                <p className="mt-5 rounded-xl bg-stone-50 p-4 text-sm text-stone-600">
                  The menu is currently unavailable for pre-ordering. You can
                  still make a reservation.
                </p>
              ) : (
                <div className="mt-5 space-y-3">
                  {menu.map((item) => {
                    const quantity = preorderQuantities[item.id] || 0;

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-4 rounded-xl border border-stone-200 p-3"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold">{item.name}</p>
                          {item.description && (
                            <p className="mt-1 line-clamp-2 text-sm text-stone-500">
                              {item.description}
                            </p>
                          )}
                          <p className="mt-1 text-sm font-medium text-green-800">
                            {formatRupees(item.price)}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              changePreorderQuantity(item.id, -1)
                            }
                            disabled={quantity === 0}
                            aria-label={`Remove one ${item.name}`}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-300 disabled:opacity-40"
                          >
                            <Minus size={15} />
                          </button>
                          <span className="w-5 text-center font-semibold">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              changePreorderQuantity(item.id, 1)
                            }
                            disabled={quantity >= 20}
                            aria-label={`Add one ${item.name}`}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-300 disabled:opacity-40"
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-5 flex items-center justify-between border-t border-stone-200 pt-4">
                <span className="text-sm text-stone-600">
                  Pre-order estimate
                </span>
                <span className="font-bold">{formatRupees(preorderTotal)}</span>
              </div>
              <p className="mt-2 text-xs text-stone-500">
                This estimate is separate from the reservation deposit and
                final bill.
              </p>
            </div>
          </section>

          <aside className="h-fit rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7 lg:col-span-2">
            <h2 className="text-xl font-bold">Reservation summary</h2>

            <div className="mt-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <span className="text-sm text-stone-600">Guests</span>
                <span className="font-semibold">{guests}</span>
              </div>

              <div className="flex items-start justify-between gap-4">
                <span className="text-sm text-stone-600">
                  Deposit per guest
                </span>
                <span className="font-semibold">
                  {formatRupees(DEPOSIT_PER_GUEST)}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-4">
                <span className="text-sm text-stone-600">
                  Required deposit
                </span>
                <span className="font-bold text-green-800">
                  {formatRupees(depositAmount)}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4">
                <span className="text-sm text-stone-600">
                  Selected pre-order
                </span>
                <span className="font-semibold">
                  {formatRupees(preorderTotal)}
                </span>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              The reservation requires an online deposit of ₹100 per guest.
              Your reservation is confirmed only after the payment is
              verified.
            </div>

            <button
              type="submit"
              disabled={
                submitting ||
                verifying ||
                loadingTables ||
                !availability?.available ||
                Boolean(pendingReservation)
              }
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-800 px-5 py-4 font-semibold text-white transition hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting || verifying ? (
                <>
                  <LoaderCircle size={18} className="animate-spin" />
                  {verifying ? "Processing payment..." : "Creating reservation..."}
                </>
              ) : (
                `Reserve and pay ${formatRupees(depositAmount)}`
              )}
            </button>

            <p className="mt-3 text-center text-xs leading-5 text-stone-500">
              Payments are processed through Razorpay. Do not refresh the page
              while payment verification is in progress.
            </p>
          </aside>
        </form>
      </div>
    </main>
  );
}
