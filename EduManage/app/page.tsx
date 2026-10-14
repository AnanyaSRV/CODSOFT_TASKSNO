"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to sign in. Please try again.");
        return;
      }

router.push(
  data.role === "TEACHER" ? "/teacher-dashboard" : "/dashboard",
);
router.refresh();
    } catch {
      setError("Unable to connect to EduManage. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="login-logo" aria-hidden="true">
            E
          </div>
          <p className="login-eyebrow">EDUCATION MANAGEMENT PLATFORM</p>
          <h1>Welcome to EduManage</h1>
          <p className="login-description">
            Sign in to manage your academic records, attendance, examinations,
            and other educational services.
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="Enter your email address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={loading}
            />
          </div>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button
            className="login-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="login-footer">
          Secure access for administrators, teachers, and students.
        </p>
      </section>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 18px;
          background:
            radial-gradient(
              circle at top left,
              rgba(129, 140, 248, 0.2),
              transparent 36%
            ),
            #f3f5fb;
          color: #14213d;
          font-family: Arial, Helvetica, sans-serif;
        }

        .login-card {
          width: 100%;
          max-width: 460px;
          padding: 42px;
          border: 1px solid #e0e6f0;
          border-radius: 24px;
          background: #fff;
          box-shadow: 0 24px 65px rgba(15, 23, 42, 0.09);
        }

        .login-brand {
          text-align: center;
        }

        .login-logo {
          display: grid;
          width: 58px;
          height: 58px;
          margin: 0 auto 22px;
          place-items: center;
          border-radius: 17px;
          background: #4f46e5;
          color: #fff;
          font-size: 30px;
          font-weight: 800;
        }

        .login-eyebrow {
          margin: 0 0 12px;
          color: #6366f1;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.7px;
        }

        h1 {
          margin: 0;
          font-size: clamp(27px, 5vw, 34px);
          line-height: 1.25;
          letter-spacing: -0.8px;
        }

        .login-description {
          margin: 14px 0 0;
          color: #64748b;
          font-size: 14px;
          line-height: 1.8;
        }

        .login-form {
          display: grid;
          gap: 21px;
          margin-top: 34px;
        }

        .login-field {
          display: grid;
          gap: 9px;
        }

        label {
          color: #334155;
          font-size: 14px;
          font-weight: 700;
        }

        input {
          width: 100%;
          min-height: 49px;
          padding: 12px 14px;
          border: 1px solid #d7deea;
          border-radius: 10px;
          background: #fff;
          color: #14213d;
          font: inherit;
          font-size: 14px;
        }

        input:focus {
          border-color: #6366f1;
          outline: 3px solid rgba(99, 102, 241, 0.13);
        }

        input:disabled {
          opacity: 0.65;
        }

        .login-submit {
          min-height: 50px;
          margin-top: 2px;
          border: 0;
          border-radius: 10px;
          background: #4f46e5;
          color: #fff;
          cursor: pointer;
          font-size: 15px;
          font-weight: 700;
          transition: background 160ms ease;
        }

        .login-submit:hover:not(:disabled) {
          background: #4338ca;
        }

        .login-submit:disabled {
          cursor: wait;
          opacity: 0.7;
        }

        .login-error {
          margin: 0;
          padding: 12px;
          border: 1px solid #fecaca;
          border-radius: 9px;
          background: #fef2f2;
          color: #b91c1c;
          font-size: 13px;
          line-height: 1.6;
        }

        .login-footer {
          margin: 27px 0 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.7;
          text-align: center;
        }

        @media (max-width: 480px) {
          .login-card {
            padding: 28px 22px;
            border-radius: 18px;
          }
        }
      `}</style>
    </main>
  );
}