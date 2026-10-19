
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, UtensilsCrossed } from "lucide-react";

export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to sign in.");
      }

      if (data.user?.role === "ADMIN") {
        router.replace("/staff-reservations");
      } else if (data.user?.role === "KITCHEN_STAFF") {
        router.replace("/kitchen");
      } else {
        setError("This account does not have staff access.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to sign in. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f6ef] px-4 py-10 text-[#243b2b]">
      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-[#e3e5d9] bg-white shadow-xl">
        <div className="bg-[#183f2b] px-8 py-9 text-center text-white">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
            <UtensilsCrossed size={28} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#d7e6b7]">
            DineDesk
          </p>
          <h1 className="mt-2 text-3xl font-bold">Staff sign in</h1>
          <p className="mt-2 text-sm text-white/75">
            Sign in to manage restaurant operations.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-7 sm:p-8">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-semibold"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-[#315d3c] focus:ring-2 focus:ring-[#315d3c]/10"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-semibold"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-12 outline-none transition focus:border-[#315d3c] focus:ring-2 focus:ring-[#315d3c]/10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#244c32] px-4 py-3.5 font-semibold text-white transition hover:bg-[#183f2b] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LockKeyhole size={18} />
            {loading ? "Signing in..." : "Sign in securely"}
          </button>

          <p className="text-center text-xs leading-5 text-gray-500">
            Authorized restaurant staff only. Customer accounts cannot access
            staff tools.
          </p>

          <a
            href="/"
            className="block text-center text-sm font-medium text-[#315d3c] hover:underline"
          >
            Back to restaurant homepage
          </a>
        </form>
      </section>
    </main>
  );
}
