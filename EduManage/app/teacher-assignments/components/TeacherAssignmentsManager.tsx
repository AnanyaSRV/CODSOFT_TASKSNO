
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Teacher = {
  id: string;
  employeeNo: string;
  subject: string;
  user: {
    name: string;
    email: string;
  };
};

type Assignment = {
  id: string;
  teacherId: string;
  className: string;
  section: string;
  createdAt: string;
  teacher: {
    id: string;
    employeeNo: string;
    subject: string;
    user: {
      name: string;
      email: string;
      active: boolean;
    };
  };
};

type ApiResponse = {
  teachers?: Teacher[];
  assignments?: Assignment[];
  error?: string;
  message?: string;
};

export default function TeacherAssignmentsManager() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("A");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Used when refreshing after creating or removing an assignment.
  const loadAssignments = useCallback(async () => {
    setError("");

    try {
      const response = await fetch("/api/teacher-assignments", {
        method: "GET",
        cache: "no-store",
      });

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load assignments.");
      }

      setTeachers(data.teachers ?? []);
      setAssignments(data.assignments ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load assignments."
      );
    }
  }, []);

  // Initial loading is handled directly in the effect.
  // The AbortController prevents updates after unmounting.
  useEffect(() => {
    const controller = new AbortController();

    async function initialLoad() {
      try {
        const response = await fetch("/api/teacher-assignments", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const data: ApiResponse = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load assignments.");
        }

        setTeachers(data.teachers ?? []);
        setAssignments(data.assignments ?? []);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        setError(
          err instanceof Error ? err.message : "Unable to load assignments."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void initialLoad();

    return () => {
      controller.abort();
    };
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!teacherId || !className.trim() || !section.trim()) {
      setError("Select a teacher and enter both the class and section.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/teacher-assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teacherId,
          className: className.trim(),
          section: section.trim(),
        }),
      });

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to assign teacher.");
      }

      setNotice(data.message ?? "Assignment created successfully.");
      setClassName("");
      setSection("A");

      await loadAssignments();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to assign teacher."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(assignmentId: string) {
    const confirmed = window.confirm(
      "Remove this teacher's class assignment?"
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setNotice("");
    setRemovingId(assignmentId);

    try {
      const response = await fetch("/api/teacher-assignments", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assignmentId }),
      });

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to remove assignment.");
      }

      setNotice(data.message ?? "Assignment removed successfully.");

      await loadAssignments();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to remove assignment."
      );
    } finally {
      setRemovingId("");
    }
  }

  return (
    <main className="assignment-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .assignment-page {
          min-height: 100vh;
          padding: 36px 20px;
          background: #f3f5fb;
          color: #14213d;
          font-family: Arial, Helvetica, sans-serif;
        }

        .assignment-container {
          max-width: 1100px;
          width: 100%;
          margin: 0 auto;
        }

        .assignment-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
          margin-bottom: 28px;
        }

        .assignment-eyebrow {
          margin: 0 0 8px;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .assignment-header h1 {
          margin: 0;
          font-size: clamp(28px, 4vw, 38px);
          line-height: 1.2;
        }

        .assignment-subtitle {
          margin: 10px 0 0;
          color: #64748b;
          line-height: 1.7;
        }

        .assignment-panel {
          margin-bottom: 24px;
          padding: 28px;
          border: 1px solid #dce4f1;
          border-radius: 20px;
          background: #ffffff;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.04);
        }

        .assignment-panel h2 {
          margin: 0 0 8px;
          font-size: 23px;
        }

        .assignment-description {
          margin: 0 0 22px;
          color: #64748b;
          line-height: 1.6;
        }

        .assignment-form {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr auto;
          align-items: end;
          gap: 14px;
        }

        .assignment-field label {
          display: block;
          margin-bottom: 8px;
          color: #334155;
          font-size: 13px;
          font-weight: 700;
        }

        .assignment-field input,
        .assignment-field select {
          width: 100%;
          min-height: 46px;
          padding: 10px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background: #ffffff;
          color: #14213d;
          font-size: 14px;
        }

        .assignment-field input:focus,
        .assignment-field select:focus {
          outline: 2px solid #a5b4fc;
          outline-offset: 2px;
          border-color: #6366f1;
        }

        .assignment-button {
          min-height: 46px;
          padding: 11px 17px;
          border: 0;
          border-radius: 10px;
          background: #4f46e5;
          color: #ffffff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .assignment-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .assignment-button.remove {
          min-height: 38px;
          padding: 8px 12px;
          border: 1px solid #fecaca;
          background: #ffffff;
          color: #b91c1c;
        }

        .assignment-alert {
          margin-bottom: 18px;
          padding: 12px 14px;
          border-radius: 10px;
          line-height: 1.5;
        }

        .assignment-alert.error {
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #991b1b;
        }

        .assignment-alert.success {
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          color: #166534;
        }

        .assignment-table-wrap {
          width: 100%;
          overflow-x: auto;
        }

        .assignment-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .assignment-table th,
        .assignment-table td {
          padding: 15px 12px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
        }

        .assignment-table th {
          color: #64748b;
          font-size: 12px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .assignment-table td {
          font-size: 14px;
          line-height: 1.5;
        }

        .assignment-table td small {
          display: block;
          color: #64748b;
          overflow-wrap: anywhere;
        }

        .assignment-empty {
          padding: 26px 10px;
          color: #64748b;
          text-align: center;
          line-height: 1.7;
        }

        .assignment-back {
          display: inline-flex;
          margin-top: 4px;
          padding: 12px 16px;
          border: 1px solid #dce4f1;
          border-radius: 10px;
          background: #ffffff;
          color: #4338ca;
          font-weight: 700;
          text-decoration: none;
        }

        .assignment-back:hover {
          background: #eef2ff;
        }

        @media (max-width: 800px) {
          .assignment-form {
            grid-template-columns: 1fr 1fr;
          }

          .assignment-field.teacher-field {
            grid-column: 1 / -1;
          }

          .assignment-button.submit {
            grid-column: 1 / -1;
          }

          .assignment-panel {
            padding: 20px;
          }
        }

        @media (max-width: 520px) {
          .assignment-page {
            padding: 24px 12px;
          }

          .assignment-form {
            grid-template-columns: 1fr;
          }

          .assignment-field.teacher-field,
          .assignment-button.submit {
            grid-column: auto;
          }

          .assignment-panel {
            padding: 18px;
          }
        }
      `}</style>

      <div className="assignment-container">
        <header className="assignment-header">
          <div>
            <p className="assignment-eyebrow">
              EduManage Administration
            </p>

            <h1>Teacher Assignments</h1>

            <p className="assignment-subtitle">
              Assign teachers to classes and sections, and manage existing
              assignments.
            </p>
          </div>
        </header>

        {error && (
          <div className="assignment-alert error" role="alert">
            {error}
          </div>
        )}

        {notice && (
          <div className="assignment-alert success" role="status">
            {notice}
          </div>
        )}

        <section className="assignment-panel">
          <h2>Assign a Teacher</h2>

          <p className="assignment-description">
            Multiple teachers can be assigned to the same class and section.
            The same teacher cannot receive a duplicate assignment.
          </p>

          <form className="assignment-form" onSubmit={handleCreate}>
            <div className="assignment-field teacher-field">
              <label htmlFor="assignment-teacher">
                Teacher
              </label>

              <select
                id="assignment-teacher"
                value={teacherId}
                onChange={(event) => setTeacherId(event.target.value)}
                required
                disabled={loading || teachers.length === 0}
              >
                <option value="">Select a teacher</option>

                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.user.name} — {teacher.subject} (
                    {teacher.employeeNo})
                  </option>
                ))}
              </select>
            </div>

            <div className="assignment-field">
              <label htmlFor="assignment-class">
                Class
              </label>

              <input
                id="assignment-class"
                value={className}
                onChange={(event) => setClassName(event.target.value)}
                placeholder="e.g. Class 10"
                maxLength={50}
                required
              />
            </div>

            <div className="assignment-field">
              <label htmlFor="assignment-section">
                Section
              </label>

              <input
                id="assignment-section"
                value={section}
                onChange={(event) => setSection(event.target.value)}
                placeholder="e.g. A"
                maxLength={20}
                required
              />
            </div>

            <button
              className="assignment-button submit"
              type="submit"
              disabled={
                saving ||
                loading ||
                teachers.length === 0
              }
            >
              {saving ? "Assigning..." : "Assign Teacher"}
            </button>
          </form>

          {!loading && teachers.length === 0 && (
            <p
              className="assignment-description"
              style={{ marginTop: 16, marginBottom: 0 }}
            >
              No active teachers are available. Create a teacher account
              first.
            </p>
          )}
        </section>

        <section className="assignment-panel">
          <h2>Current Assignments</h2>

          <p className="assignment-description">
            {assignments.length} assignment
            {assignments.length === 1 ? "" : "s"} currently recorded.
          </p>

          {loading ? (
            <p className="assignment-empty">
              Loading assignments...
            </p>
          ) : assignments.length === 0 ? (
            <p className="assignment-empty">
              No assignments have been created yet. Use the form above to
              assign teachers to classes.
            </p>
          ) : (
            <div className="assignment-table-wrap">
              <table className="assignment-table">
                <thead>
                  <tr>
                    <th>Teacher</th>
                    <th>Employee No.</th>
                    <th>Subject</th>
                    <th>Class</th>
                    <th>Section</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {assignments.map((assignment) => (
                    <tr key={assignment.id}>
                      <td>
                        {assignment.teacher.user.name}

                        <small>
                          {assignment.teacher.user.email}
                        </small>

                        {!assignment.teacher.user.active && (
                          <small>Inactive account</small>
                        )}
                      </td>

                      <td>{assignment.teacher.employeeNo}</td>
                      <td>{assignment.teacher.subject}</td>
                      <td>{assignment.className}</td>
                      <td>{assignment.section}</td>

                      <td>
                        <button
                          type="button"
                          className="assignment-button remove"
                          onClick={() =>
                            void handleRemove(assignment.id)
                          }
                          disabled={removingId === assignment.id}
                        >
                          {removingId === assignment.id
                            ? "Removing..."
                            : "Remove"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <Link
          href="/administration"
          className="assignment-back"
        >
          ← Back to Administration
        </Link>
      </div>
    </main>
  );
}
