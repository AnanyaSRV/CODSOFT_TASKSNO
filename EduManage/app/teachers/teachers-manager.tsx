
"use client";

import { useEffect, useState, type FormEvent } from "react";
import PasswordResetButton from "../components/password-reset-button";

type Teacher = {
  id: string;
  employeeNo: string;
  subject: string;
  phone: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    active: boolean;
  };
};

type TeachersResponse = {
  teachers?: Teacher[];
  error?: string;
};

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export default function TeachersManager({
  canManage,
}: {
  canManage: boolean;
}) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [employeeNo, setEmployeeNo] = useState("");
  const [subject, setSubject] = useState("");
  const [phone, setPhone] = useState("");

  async function loadTeachers() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/teachers", {
        cache: "no-store",
      });

      const data = (await response.json()) as TeachersResponse;

      if (!response.ok) {
        throw new Error(data.error || "Unable to load teachers.");
      }

      setTeachers(data.teachers ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load teachers."
      );
    } finally {
      setLoading(false);
    }
  }

useEffect(() => {
  let cancelled = false;

  async function fetchTeachers() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/teachers", {
        cache: "no-store",
      });

      const data = (await response.json()) as TeachersResponse;

      if (!response.ok) {
        throw new Error(data.error || "Unable to load teachers.");
      }

      if (!cancelled) {
        setTeachers(data.teachers ?? []);
      }
    } catch (err) {
      if (!cancelled) {
        setError(
          err instanceof Error ? err.message : "Unable to load teachers.",
        );
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  }

  void fetchTeachers();

  return () => {
    cancelled = true;
  };
}, []);
  


const query = normalize(submittedSearch);

const filteredTeachers = teachers.filter((teacher) => {
  if (!query) return true;

  const nameWords = normalize(teacher.user.name).split(/\s+/);

  return (
    nameWords.some((word) => word === query) ||
    normalize(teacher.user.name).includes(` ${query} `) ||
    normalize(teacher.user.email) === query ||
    normalize(teacher.employeeNo) === query ||
    normalize(teacher.subject) === query
  );
});


  function handleSearchChange(value: string) {
    setSearch(value);

    if (value.trim() === "") {
      setSubmittedSearch("");
    }
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
  }

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("");
    setEmployeeNo("");
    setSubject("");
    setPhone("");
  }

  async function handleCreateTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/teachers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          employeeNo,
          subject,
          phone,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Unable to create teacher.");
      }

      resetForm();
      setShowForm(false);
      setSearch("");
      setSubmittedSearch("");
      setSuccess(data.message || "Teacher created successfully.");

      await loadTeachers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create teacher."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="students-page">
      <header className="students-heading">
        <div>
          <p className="students-eyebrow">ACADEMIC MANAGEMENT</p>
          <h1>Teachers</h1>
          <p className="students-subtitle">
            Manage teacher accounts, subjects, and employee records.
          </p>
        </div>

        <div className="students-count">
          <span>Total teachers</span>
          <strong>{teachers.length}</strong>
        </div>
      </header>

      {error && (
        <div className="students-alert students-alert-error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="students-alert students-alert-success" role="status">
          {success}
        </div>
      )}

      <section className="students-panel">
        <div className="students-toolbar">
          <div>
            <h2>Teacher Directory</h2>
            <p>
              {submittedSearch
                ? `${filteredTeachers.length} matching teacher${filteredTeachers.length === 1 ? "" : "s"}`
                : "Search by name, email, employee number, or subject."}
            </p>
          </div>

          <form className="students-search" onSubmit={handleSearchSubmit}>
            <input
              type="search"
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Search teachers..."
              aria-label="Search teachers"
            />

            <button type="submit" className="students-button">
              Search
            </button>

            <button
              type="button"
              className="students-button students-button-secondary"
              onClick={() => {
                setSearch("");
                setSubmittedSearch("");
              }}
            >
              Clear
            </button>
          </form>
        </div>

        {loading ? (
          <div className="students-empty">Loading teachers...</div>
        ) : filteredTeachers.length === 0 ? (
          <div className="students-empty">
            <strong>No matching teachers found</strong>
            <p>
              {submittedSearch
                ? `No teacher matches "${submittedSearch}". Try another search.`
                : "No teachers have been added yet."}
            </p>
          </div>
        ) : (
          <div className="students-table-wrapper">
            <table className="students-table">
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Employee No.</th>
                  <th>Subject</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  {canManage && <th>Account Actions</th>}
                </tr>
              </thead>

              <tbody>
                {filteredTeachers.map((teacher) => (
                  <tr key={teacher.id}>
                    <td>
                      <strong>{teacher.user.name}</strong>
                    </td>
                    <td>{teacher.employeeNo}</td>
                    <td>{teacher.subject}</td>
                    <td>{teacher.user.email}</td>
                    <td>{teacher.phone || "—"}</td>
                    <td>
                      <span
                        className={
                          teacher.user.active
                            ? "student-status student-status-active"
                            : "student-status student-status-inactive"
                        }
                      >
                        {teacher.user.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {canManage && (
                      <td>
                        <PasswordResetButton
                          userId={teacher.user.id}
                          userName={teacher.user.name}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canManage && (
        <section className="students-panel">
          <div className="students-toolbar">
            <div>
              <h2>Add Teacher</h2>
              <p>Create a teacher account and assign a subject.</p>
            </div>

            <button
              type="button"
              className="students-button"
              onClick={() => {
                setShowForm((current) => !current);
                setError("");
                setSuccess("");
              }}
              aria-expanded={showForm}
            >
              {showForm ? "Close Form" : "+ Add Teacher"}
            </button>
          </div>

          {showForm && (
            <form className="students-form" onSubmit={handleCreateTeacher}>
              <label>
                Full Name *
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                  placeholder="Enter teacher's name"
                />
              </label>

              <label>
                Email Address *
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  placeholder="teacher@example.com"
                />
              </label>

              <label>
                Initial Password *
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={12}
                  placeholder="At least 12 characters"
                />
              </label>

              <label>
                Employee Number *
                <input
                  value={employeeNo}
                  onChange={(event) => setEmployeeNo(event.target.value)}
                  required
                  placeholder="e.g. TCH001"
                />
              </label>

              <label>
                Subject *
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  required
                  placeholder="e.g. Mathematics"
                />
              </label>

              <label>
                Phone Number
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Enter phone number"
                />
              </label>

              <div className="students-form-actions">
                <button
                  type="button"
                  className="students-button students-button-secondary"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                    setError("");
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="students-button"
                  disabled={saving}
                >
                  {saving ? "Creating Teacher..." : "Save Teacher"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </main>
  );
}
