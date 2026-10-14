"use client";

import { useState, type FormEvent } from "react";

type PasswordResetButtonProps = {
  userId: string;
  userName: string;
};

export default function PasswordResetButton({
  userId,
  userName,
}: PasswordResetButtonProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function closeDialog() {
    if (saving) return;
    setOpen(false);
    setPassword("");
    setConfirmPassword("");
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 12) {
      setError("Password must be at least 12 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(userId)}/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        },
      );

      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Unable to reset this password.");
      }

      setSuccess(data.message || `Password reset for ${userName}.`);
      setPassword("");
      setConfirmPassword("");
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to reset this password. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="students-button students-button-secondary"
        onClick={() => {
          setError("");
          setSuccess("");
          setOpen(true);
        }}
      >
        Reset Password
      </button>

      {success && (
        <p className="students-alert students-alert-success" role="status">
          {success}
        </p>
      )}

      {open && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0, 0, 0, 0.48)",
            display: "grid",
            placeItems: "center",
            padding: "1rem",
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`reset-password-title-${userId}`}
            style={{
              width: "min(100%, 440px)",
              background: "var(--background, white)",
              color: "var(--foreground, #111827)",
              borderRadius: "12px",
              padding: "1.5rem",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)",
            }}
          >
            <h2 id={`reset-password-title-${userId}`}>Reset Password</h2>
            <p>
              Set a new password for <strong>{userName}</strong>. The password
              must contain at least 12 characters.
            </p>

            {error && (
              <div
                className="students-alert students-alert-error"
                role="alert"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="students-form">
              <label>
                New password *
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={12}
                  autoComplete="new-password"
                  required
                />
              </label>

              <label>
                Confirm new password *
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={12}
                  autoComplete="new-password"
                  required
                />
              </label>

              <div className="students-form-actions">
                <button
                  type="button"
                  className="students-button students-button-secondary"
                  onClick={closeDialog}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="students-button"
                  disabled={saving}
                >
                  {saving ? "Resetting..." : "Save New Password"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
