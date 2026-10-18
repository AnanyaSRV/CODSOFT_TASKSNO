"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock,
  Users,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Utensils,
  LoaderCircle,
  Phone,
  ClipboardList,
  LogOut,
} from "lucide-react";

type Reservation = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  guests: number;
  status: string;
  notes: string | null;
  createdAt: string;
  user: {
    name: string;
    phone: string | null;
    email: string;
  };
  table: {
    tableNumber: string;
    capacity: number;
  };
};

const STATUSES = [
  "PENDING",
  "CONFIRMED",
  "SEATED",
  "COMPLETED",
  "CANCELLED",
] as const;

type ReservationStatus = (typeof STATUSES)[number];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function statusStyle(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "bg-blue-100 text-blue-800";
    case "SEATED":
      return "bg-purple-100 text-purple-800";
    case "COMPLETED":
      return "bg-emerald-100 text-emerald-800";
    case "CANCELLED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-amber-100 text-amber-800";
  }
}

export default function StaffReservationsPage() {
  const router = useRouter();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  const handleUnauthorized = useCallback(() => {
    router.replace("/staff-login");
  }, [router]);

  const loadReservations = useCallback(
    async (manual = false) => {
      if (manual) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const sessionResponse = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        if (sessionResponse.status === 401 ||
            sessionResponse.status === 403) {
          handleUnauthorized();
          return;
        }

        if (!sessionResponse.ok) {
          throw new Error("Could not verify staff access.");
        }

        const sessionData = await sessionResponse.json();

        if (sessionData.user?.role !== "ADMIN") {
          handleUnauthorized();
          return;
        }

        setAuthorized(true);

        const response = await fetch("/api/staff-reservations", {
          cache: "no-store",
        });

        if (response.status === 401 || response.status === 403) {
          handleUnauthorized();
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load reservations.");
        }

        setReservations(data.reservations ?? []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not load reservations.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [handleUnauthorized],
  );

  useEffect(() => {
    void loadReservations();
  }, [loadReservations]);

  async function updateStatus(id: string, status: ReservationStatus) {
    setUpdatingId(id);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/staff-reservations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });

      if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update reservation.");
      }

      setReservations((current) =>
        current.map((reservation) =>
          reservation.id === id ? data.reservation : reservation,
        ),
      );

      setMessage(`Reservation updated to ${status.toLowerCase()}.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update reservation.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Logout failed. Please try again.");
      }

      router.replace("/staff-login");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not log out.",
      );
      setLoggingOut(false);
    }
  }

  const filteredReservations =
    filter === "ALL"
      ? reservations
      : reservations.filter((reservation) => reservation.status === filter);

  const pendingCount = reservations.filter(
    (reservation) => reservation.status === "PENDING",
  ).length;

  const confirmedCount = reservations.filter(
    (reservation) => reservation.status === "CONFIRMED",
  ).length;

  const seatedCount = reservations.filter(
    (reservation) => reservation.status === "SEATED",
  ).length;

  if (!authorized && loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f6ef] text-[#243b2b]">
        <div className="flex items-center gap-3">
          <LoaderCircle className="animate-spin" size={22} />
          Verifying staff access...
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f6ef] px-5 text-[#243b2b]">
        <div className="text-center">
          <p className="font-semibold">
            {error || "Redirecting to staff login..."}
          </p>
          {error && (
            <button
              onClick={() => void loadReservations()}
              className="mt-4 rounded-xl bg-[#244c32] px-4 py-3 text-sm font-semibold text-white"
            >
              Try again
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f6ef] text-[#243b2b]">
      <header className="bg-[#183f2b] px-5 py-7 text-white sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#d7e6b7]">
              DineDesk · Staff Portal
            </p>
            <h1 className="text-3xl font-bold sm:text-4xl">
              Reservation Manager
            </h1>
            <p className="mt-2 text-sm text-white/75">
              Manage bookings, guests, tables, and reservation status.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => void loadReservations(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 px-4 py-3 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-60"
            >
              <RefreshCw
                size={17}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh bookings
            </button>

            <button
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#183f2b] transition hover:bg-[#eaf0e3] disabled:opacity-60"
            >
              <LogOut size={17} />
              {loggingOut ? "Logging out..." : "Log out"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Total reservations",
              value: reservations.length,
              icon: ClipboardList,
            },
            {
              label: "Awaiting confirmation",
              value: pendingCount,
              icon: Clock,
            },
            {
              label: "Confirmed",
              value: confirmedCount,
              icon: CheckCircle2,
            },
            {
              label: "Currently seated",
              value: seatedCount,
              icon: Users,
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <article
                key={item.label}
                className="rounded-2xl border border-[#e3e5d9] bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm text-gray-500">{item.label}</span>
                  <span className="rounded-xl bg-[#edf3e5] p-2 text-[#315d3c]">
                    <Icon size={19} />
                  </span>
                </div>
                <p className="text-3xl font-bold">{item.value}</p>
              </article>
            );
          })}
        </section>

        {message && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            {message}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-[#e3e5d9] bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-gray-100 p-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-bold">All bookings</h2>
              <p className="mt-1 text-sm text-gray-500">
                Review booking details and update reservation statuses.
              </p>
            </div>

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#315d3c]"
              aria-label="Filter reservations by status"
            >
              <option value="ALL">All statuses</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0) + status.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 p-12 text-gray-500">
              <LoaderCircle className="animate-spin" size={22} />
              Loading reservations...
            </div>
          ) : filteredReservations.length === 0 ? (
            <div className="p-12 text-center">
              <CalendarDays
                size={36}
                className="mx-auto mb-3 text-gray-400"
              />
              <h3 className="font-semibold">No reservations found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Try another status filter or refresh the bookings.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredReservations.map((reservation) => (
                <article key={reservation.id} className="p-5 sm:p-6">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-bold">
                          {reservation.user.name}
                        </h3>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle(reservation.status)}`}
                        >
                          {reservation.status}
                        </span>
                      </div>

                      <div className="grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
                        <p className="flex items-center gap-2">
                          <Phone size={16} className="shrink-0" />
                          {reservation.user.phone || "No phone provided"}
                        </p>

                        <p className="flex items-center gap-2">
                          <Utensils size={16} className="shrink-0" />
                          Table {reservation.table.tableNumber} · capacity{" "}
                          {reservation.table.capacity}
                        </p>

                        <p className="flex items-center gap-2">
                          <CalendarDays size={16} className="shrink-0" />
                          {formatDate(reservation.date)}
                        </p>

                        <p className="flex items-center gap-2">
                          <Clock size={16} className="shrink-0" />
                          {formatTime(reservation.startTime)} –{" "}
                          {formatTime(reservation.endTime)}
                        </p>

                        <p className="flex items-center gap-2">
                          <Users size={16} className="shrink-0" />
                          {reservation.guests} guest
                          {reservation.guests === 1 ? "" : "s"}
                        </p>
                      </div>

                      {reservation.notes && (
                        <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                          <span className="font-semibold">Notes:</span>{" "}
                          {reservation.notes}
                        </p>
                      )}

                      <p className="mt-3 break-all text-xs text-gray-400">
                        Reference: {reservation.id}
                      </p>
                    </div>

                    <div className="flex w-full flex-col gap-2 lg:w-52">
                      <label
                        htmlFor={`status-${reservation.id}`}
                        className="text-xs font-semibold uppercase tracking-wide text-gray-500"
                      >
                        Update status
                      </label>

                      <select
                        id={`status-${reservation.id}`}
                        value={reservation.status}
                        disabled={updatingId === reservation.id}
                        onChange={(event) =>
                          void updateStatus(
                            reservation.id,
                            event.target.value as ReservationStatus,
                          )
                        }
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#315d3c] disabled:opacity-60"
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status.charAt(0) + status.slice(1).toLowerCase()}
                          </option>
                        ))}
                      </select>

                      {updatingId === reservation.id && (
                        <p className="flex items-center gap-2 text-xs text-gray-500">
                          <LoaderCircle size={14} className="animate-spin" />
                          Saving status...
                        </p>
                      )}

                      {reservation.status === "PENDING" && (
                        <button
                          onClick={() =>
                            void updateStatus(reservation.id, "CONFIRMED")
                          }
                          disabled={updatingId === reservation.id}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#244c32] px-3 py-3 text-sm font-semibold text-white transition hover:bg-[#183f2b] disabled:opacity-50"
                        >
                          <CheckCircle2 size={16} />
                          Confirm booking
                        </button>
                      )}

                      {reservation.status !== "CANCELLED" &&
                        reservation.status !== "COMPLETED" && (
                          <button
                            onClick={() =>
                              void updateStatus(reservation.id, "CANCELLED")
                            }
                            disabled={updatingId === reservation.id}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                          >
                            <XCircle size={16} />
                            Cancel booking
                          </button>
                        )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="mt-5 text-center text-xs text-gray-500">
          DineDesk reservation management · Changes are saved to the database.
        </p>
      </div>
    </main>
  );
}