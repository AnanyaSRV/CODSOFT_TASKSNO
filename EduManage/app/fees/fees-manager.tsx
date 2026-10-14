"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type FeeStatus = "PENDING" | "PARTIAL" | "PAID";

type Student = {
  id: string;
  admissionNo: string;
  className: string;
  section: string;
  user: {
    name: string;
    active: boolean;
  };
};

type Fee = {
  id: string;
  studentId: string;
  title: string;
  amount: number;
  paidAmount: number;
  dueDate: string | null;
  status: FeeStatus;
  createdAt: string;
  student: Student;
};

type FeesManagerProps = {
  canManage: boolean;
};

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function formatDate(date: string | null) {
  if (!date) return "No due date";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function getErrorMessage(data: unknown, fallback: string): string {
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof data.error === "string"
  ) {
    return data.error;
  }

  return fallback;
}

function getStatusLabel(status: FeeStatus) {
  if (status === "PAID") return "Paid";
  if (status === "PARTIAL") return "Partially paid";
  return "Pending";
}

export default function FeesManager({ canManage }: FeesManagerProps) {
  const [fees, setFees] = useState<Fee[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [classFilter, setClassFilter] = useState("ALL");

  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("Tuition Fee");
  const [amount, setAmount] = useState("");
  const [initialPayment, setInitialPayment] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [creating, setCreating] = useState(false);

  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [savingPaymentId, setSavingPaymentId] = useState("");

  const loadFees = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/fees", { cache: "no-store" });
      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Failed to load fee records"));
      }

      if (
        !data ||
        typeof data !== "object" ||
        !("fees" in data) ||
        !Array.isArray(data.fees)
      ) {
        throw new Error("The server returned an unexpected fees response");
      }

      setFees(data.fees as Fee[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load fee records",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStudents = useCallback(async () => {
    setStudentsLoading(true);

    try {
      const response = await fetch("/api/students", { cache: "no-store" });
      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Failed to load students"));
      }

      if (
        !data ||
        typeof data !== "object" ||
        !("students" in data) ||
        !Array.isArray(data.students)
      ) {
        throw new Error("The server returned an unexpected students response");
      }

      const activeStudents = (data.students as Student[]).filter(
        (student) => student.user?.active,
      );

      setStudents(activeStudents);

      if (activeStudents.length > 0) {
        setStudentId((current) => current || activeStudents[0].id);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load students",
      );
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFees();
      void loadStudents();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadFees, loadStudents]);

  const classes = useMemo(
    () =>
      Array.from(
        new Set(students.map((student) => student.className)),
      ).sort((a, b) => a.localeCompare(b)),
    [students],
  );

  const filteredFees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return fees.filter((fee) => {
      const matchesSearch =
        !query ||
        fee.student.user.name.toLowerCase().includes(query) ||
        fee.student.admissionNo.toLowerCase().includes(query) ||
        fee.title.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" || fee.status === statusFilter;

      const matchesClass =
        classFilter === "ALL" || fee.student.className === classFilter;

      return matchesSearch && matchesStatus && matchesClass;
    });
  }, [fees, search, statusFilter, classFilter]);

  const summary = useMemo(() => {
    const totalFees = fees.reduce((sum, fee) => sum + fee.amount, 0);
    const collected = fees.reduce((sum, fee) => sum + fee.paidAmount, 0);
    const outstanding = fees.reduce(
      (sum, fee) => sum + Math.max(0, fee.amount - fee.paidAmount),
      0,
    );

    const today = new Date().toISOString().slice(0, 10);

    const overdue = fees
      .filter(
        (fee) =>
          fee.dueDate &&
          fee.dueDate.slice(0, 10) < today &&
          fee.status !== "PAID",
      )
      .reduce(
        (sum, fee) => sum + Math.max(0, fee.amount - fee.paidAmount),
        0,
      );

    return { totalFees, collected, outstanding, overdue };
  }, [fees]);

  async function createFee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const numericAmount = Number(amount);
    const numericPayment = Number(initialPayment);

    if (!studentId) {
      setError("Please select a student.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter a valid fee amount greater than zero.");
      return;
    }

    if (
      !Number.isFinite(numericPayment) ||
      numericPayment < 0 ||
      numericPayment > numericAmount
    ) {
      setError("The initial payment must be between zero and the total fee.");
      return;
    }

    setCreating(true);

    try {
      const response = await fetch("/api/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          title: title.trim(),
          amount: numericAmount,
          paidAmount: numericPayment,
          dueDate: dueDate || null,
        }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Failed to create fee record"));
      }

      setTitle("Tuition Fee");
      setAmount("");
      setInitialPayment("0");
      setDueDate("");
      setSuccess("Fee record created successfully.");

      await loadFees();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create fee record",
      );
    } finally {
      setCreating(false);
    }
  }

  async function recordPayment(fee: Fee) {
    setError("");
    setSuccess("");

    const paymentAmount = Number(paymentInputs[fee.id]);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      setError("Enter a payment amount greater than zero.");
      return;
    }

    const balance = Math.max(0, fee.amount - fee.paidAmount);

    if (paymentAmount > balance + 0.000001) {
      setError(`Payment cannot exceed the outstanding balance of ${currency.format(balance)}.`);
      return;
    }

    setSavingPaymentId(fee.id);

    try {
      const response = await fetch("/api/fees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeId: fee.id,
          paymentAmount,
        }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Failed to record payment"));
      }

      setPaymentInputs((current) => ({ ...current, [fee.id]: "" }));
      setSuccess(`Payment recorded for ${fee.student.user.name}.`);

      await loadFees();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to record payment",
      );
    } finally {
      setSavingPaymentId("");
    }
  }

  function exportCsv() {
    const escapeCsv = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`;

    const rows = [
      [
        "Student",
        "Admission Number",
        "Class",
        "Fee Title",
        "Total Amount",
        "Paid Amount",
        "Outstanding",
        "Due Date",
        "Status",
      ],
      ...filteredFees.map((fee) => [
        fee.student.user.name,
        fee.student.admissionNo,
        `${fee.student.className}-${fee.student.section}`,
        fee.title,
        fee.amount.toFixed(2),
        fee.paidAmount.toFixed(2),
        Math.max(0, fee.amount - fee.paidAmount).toFixed(2),
        fee.dueDate ? fee.dueDate.slice(0, 10) : "",
        getStatusLabel(fee.status),
      ]),
    ];

    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "edumanage-fees.csv";
    anchor.click();

    URL.revokeObjectURL(url);
  }

  return (
    <section className="fees-manager">
      <style>{`
        .fees-manager {
          color: #14213d;
        }

        .fees-manager * {
          box-sizing: border-box;
        }

        .fees-manager .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 26px;
        }

        .fees-manager .summary-card {
          padding: 22px;
          border: 1px solid #dce4f1;
          border-radius: 18px;
          background: #ffffff;
        }

        .fees-manager .summary-card p {
          margin: 0;
          color: #64748b;
          font-size: 14px;
        }

        .fees-manager .summary-card h2 {
          margin: 12px 0 0;
          overflow-wrap: anywhere;
          font-size: clamp(19px, 2vw, 27px);
        }

        .fees-manager .fees-panel {
          margin-bottom: 24px;
          padding: 25px;
          border: 1px solid #dce4f1;
          border-radius: 20px;
          background: #ffffff;
        }

        .fees-manager .panel-heading {
          margin: 0 0 8px;
          font-size: 22px;
        }

        .fees-manager .panel-description {
          margin: 0 0 22px;
          color: #64748b;
          line-height: 1.6;
        }

        .fees-manager .fee-form-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }

        .fees-manager .field {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 0;
        }

        .fees-manager .field label {
          color: #334155;
          font-size: 14px;
          font-weight: 700;
        }

        .fees-manager input,
        .fees-manager select {
          width: 100%;
          min-height: 44px;
          padding: 10px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background: #ffffff;
          color: #14213d;
          font: inherit;
        }

        .fees-manager input:focus,
        .fees-manager select:focus {
          border-color: #6366f1;
          outline: 2px solid #c7d2fe;
          outline-offset: 1px;
        }

        .fees-manager button {
          min-height: 42px;
          padding: 10px 15px;
          border: 0;
          border-radius: 10px;
          background: #4f46e5;
          color: #ffffff;
          font: inherit;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .fees-manager button:hover:not(:disabled) {
          background: #4338ca;
        }

        .fees-manager button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .fees-manager .secondary-button {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
        }

        .fees-manager .secondary-button:hover:not(:disabled) {
          background: #f1f5f9;
        }

        .fees-manager .form-actions {
          display: flex;
          align-items: flex-end;
        }

        .fees-manager .message {
          margin-bottom: 18px;
          padding: 13px 15px;
          border-radius: 10px;
          line-height: 1.5;
        }

        .fees-manager .error-message {
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #991b1b;
        }

        .fees-manager .success-message {
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          color: #166534;
        }

        .fees-manager .filters {
          display: grid;
          grid-template-columns: minmax(200px, 2fr) repeat(2, minmax(150px, 1fr)) auto;
          gap: 12px;
          margin-bottom: 20px;
        }

        .fees-manager .table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .fees-manager table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          white-space: nowrap;
        }

        .fees-manager th,
        .fees-manager td {
          padding: 15px 13px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
        }

        .fees-manager th {
          background: #f8fafc;
          color: #64748b;
          font-size: 12px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .fees-manager td {
          font-size: 14px;
        }

        .fees-manager .student-name {
          font-weight: 700;
        }

        .fees-manager .subtext {
          display: block;
          margin-top: 5px;
          color: #64748b;
          font-size: 12px;
        }

        .fees-manager .status {
          display: inline-block;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
        }

        .fees-manager .status-paid {
          background: #dcfce7;
          color: #166534;
        }

        .fees-manager .status-partial {
          background: #fef3c7;
          color: #92400e;
        }

        .fees-manager .status-pending {
          background: #fee2e2;
          color: #991b1b;
        }

        .fees-manager .payment-control {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 240px;
        }

        .fees-manager .payment-control input {
          width: 115px;
        }

        .fees-manager .empty-state {
          padding: 35px 15px;
          color: #64748b;
          text-align: center;
        }

        .fees-manager .section-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 15px;
          margin-bottom: 20px;
        }

        @media (max-width: 950px) {
          .fees-manager .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .fees-manager .fee-form-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .fees-manager .filters {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 600px) {
          .fees-manager .summary-grid,
          .fees-manager .fee-form-grid,
          .fees-manager .filters {
            grid-template-columns: 1fr;
          }

          .fees-manager .fees-panel {
            padding: 18px;
          }
        }
      `}</style>

      {error && (
        <div className="message error-message" role="alert">
          {error}
          <button
            type="button"
            className="secondary-button"
            style={{ marginLeft: 12 }}
            onClick={() => setError("")}
          >
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div className="message success-message" role="status">
          {success}
          <button
            type="button"
            className="secondary-button"
            style={{ marginLeft: 12 }}
            onClick={() => setSuccess("")}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="summary-grid">
        <div className="summary-card">
          <p>Total Fees</p>
          <h2>{currency.format(summary.totalFees)}</h2>
        </div>

        <div className="summary-card">
          <p>Collected</p>
          <h2>{currency.format(summary.collected)}</h2>
        </div>

        <div className="summary-card">
          <p>Outstanding</p>
          <h2>{currency.format(summary.outstanding)}</h2>
        </div>

        <div className="summary-card">
          <p>Overdue Balance</p>
          <h2>{currency.format(summary.overdue)}</h2>
        </div>
      </div>

      {canManage && (
        <section className="fees-panel">
          <h2 className="panel-heading">Create Fee Record</h2>
          <p className="panel-description">
            Assign a fee to an active student. You can record an initial
            payment when creating the record.
          </p>

          <form onSubmit={createFee}>
            <div className="fee-form-grid">
              <div className="field">
                <label htmlFor="fee-student">Student</label>
                <select
                  id="fee-student"
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  required
                  disabled={studentsLoading || students.length === 0}
                >
                  <option value="">
                    {studentsLoading ? "Loading students..." : "Select student"}
                  </option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.user.name} — {student.admissionNo} (
                      {student.className}-{student.section})
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="fee-title">Fee Type / Title</label>
                <input
                  id="fee-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  minLength={2}
                  maxLength={100}
                  required
                  placeholder="e.g. Tuition Fee"
                />
              </div>

              <div className="field">
                <label htmlFor="fee-amount">Total Amount (₹)</label>
                <input
                  id="fee-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                  placeholder="e.g. 25000"
                />
              </div>

              <div className="field">
                <label htmlFor="fee-initial-payment">
                  Initial Payment (₹)
                </label>
                <input
                  id="fee-initial-payment"
                  type="number"
                  min="0"
                  step="0.01"
                  value={initialPayment}
                  onChange={(event) => setInitialPayment(event.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="fee-due-date">Due Date (optional)</label>
                <input
                  id="fee-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  disabled={
                    creating ||
                    studentsLoading ||
                    students.length === 0 ||
                    !canManage
                  }
                >
                  {creating ? "Creating..." : "Create Fee Record"}
                </button>
              </div>
            </div>

            {!studentsLoading && students.length === 0 && (
              <p className="panel-description" style={{ marginTop: 18 }}>
                No active students were found. Add a student before creating a
                fee record.
              </p>
            )}
          </form>
        </section>
      )}

      <section className="fees-panel">
        <div className="section-top">
          <div>
            <h2 className="panel-heading">Fee Records</h2>
            <p className="panel-description" style={{ marginBottom: 0 }}>
              {filteredFees.length} of {fees.length} records shown.
            </p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={exportCsv}
            disabled={filteredFees.length === 0}
          >
            Export CSV
          </button>
        </div>

        <div className="filters">
          <input
            aria-label="Search fee records"
            placeholder="Search student, admission number, fee..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            aria-label="Filter by payment status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PARTIAL">Partially paid</option>
            <option value="PAID">Paid</option>
          </select>

          <select
            aria-label="Filter by class"
            value={classFilter}
            onChange={(event) => setClassFilter(event.target.value)}
          >
            <option value="ALL">All classes</option>
            {classes.map((className) => (
              <option key={className} value={className}>
                {className}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setSearch("");
              setStatusFilter("ALL");
              setClassFilter("ALL");
            }}
          >
            Clear filters
          </button>
        </div>

        {loading ? (
          <div className="empty-state">Loading fee records...</div>
        ) : fees.length === 0 ? (
          <div className="empty-state">
            No fee records have been created yet.
          </div>
        ) : filteredFees.length === 0 ? (
          <div className="empty-state">
            No records match your search or filters.
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Fee</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  {canManage && <th>Record Payment</th>}
                </tr>
              </thead>

              <tbody>
                {filteredFees.map((fee) => {
                  const balance = Math.max(0, fee.amount - fee.paidAmount);

                  const overdue =
                    fee.dueDate &&
                    fee.dueDate.slice(0, 10) <
                      new Date().toISOString().slice(0, 10) &&
                    fee.status !== "PAID";

                  return (
                    <tr key={fee.id}>
                      <td>
                        <span className="student-name">
                          {fee.student.user.name}
                        </span>
                        <span className="subtext">
                          {fee.student.admissionNo} · {fee.student.className}-
                          {fee.student.section}
                        </span>
                      </td>

                      <td>{fee.title}</td>
                      <td>{currency.format(fee.amount)}</td>
                      <td>{currency.format(fee.paidAmount)}</td>
                      <td>
                        <strong>{currency.format(balance)}</strong>
                      </td>
                      <td>
                        {formatDate(fee.dueDate)}
                        {overdue && (
                          <span className="subtext" style={{ color: "#b91c1c" }}>
                            Overdue
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`status status-${fee.status.toLowerCase()}`}>
                          {getStatusLabel(fee.status)}
                        </span>
                      </td>

                      {canManage && (
                        <td>
                          {balance > 0 ? (
                            <div className="payment-control">
                              <input
                                aria-label={`Payment amount for ${fee.student.user.name}`}
                                type="number"
                                min="0.01"
                                max={balance}
                                step="0.01"
                                placeholder="Amount ₹"
                                value={paymentInputs[fee.id] ?? ""}
                                onChange={(event) =>
                                  setPaymentInputs((current) => ({
                                    ...current,
                                    [fee.id]: event.target.value,
                                  }))
                                }
                              />
                              <button
                                type="button"
                                disabled={savingPaymentId === fee.id}
                                onClick={() => void recordPayment(fee)}
                              >
                                {savingPaymentId === fee.id
                                  ? "Saving..."
                                  : "Record"}
                              </button>
                            </div>
                          ) : (
                            <span className="status status-paid">
                              Fully paid
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}