
"use client";

import { useEffect, useState, type FormEvent } from "react";
import PasswordResetButton from "../components/password-reset-button";

type Student = {
  id: string;
  admissionNo: string;
  className: string;
  section: string;
  user: {
    id: string;
    name: string;
    email: string;
    active: boolean;
  };
};

type StudentsResponse = {
  students?: Student[];
  error?: string;
};

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export default function StudentsManager({
  canManage,
}: {
  canManage: boolean;
}) {
  const [students, setStudents] = useState<Student[]>([]);
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
  const [admissionNo, setAdmissionNo] = useState("");
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("A");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [address, setAddress] = useState("");

  async function loadStudents() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/students", {
        cache: "no-store",
      });

      const data = (await response.json()) as StudentsResponse;

      if (!response.ok) {
        throw new Error(data.error || "Unable to load students.");
      }

      setStudents(data.students ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load students."
      );
    } finally {
      setLoading(false);
    }
  }

 useEffect(() => {
  let cancelled = false;

  async function fetchStudents() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/students", {
        cache: "no-store",
      });

      const data = (await response.json()) as StudentsResponse;

      if (!response.ok) {
        throw new Error(data.error || "Unable to load students.");
      }

      if (!cancelled) {
        setStudents(data.students ?? []);
      }
    } catch (err) {
      if (!cancelled) {
        setError(
          err instanceof Error ? err.message : "Unable to load students.",
        );
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  }

  void fetchStudents();

  return () => {
    cancelled = true;
  };
}, []);

  const query = normalize(submittedSearch);

  
const filteredStudents = students.filter((student) => {
  if (!query) return true;

  const nameWords = normalize(student.user.name).split(/\s+/);
  const email = normalize(student.user.email);
  const admissionNo = normalize(student.admissionNo);

  return (
    nameWords.some((word) => word === query) ||
    email === query ||
    admissionNo === query
  );
});


  function handleSearchChange(value: string) {
    setSearch(value);

    // Clearing the input restores the complete list immediately.
    if (value.trim() === "") {
      setSubmittedSearch("");
    }
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Always submit the latest input, not the previous search.
    setSubmittedSearch(search.trim());
  }

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("");
    setAdmissionNo("");
    setClassName("");
    setSection("A");
    setDateOfBirth("");
    setGuardianName("");
    setGuardianPhone("");
    setAddress("");
  }

  async function handleCreateStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          admissionNo,
          className,
          section,
          dateOfBirth: dateOfBirth || undefined,
          guardianName,
          guardianPhone,
          address,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Unable to create student.");
      }

      resetForm();
      setShowForm(false);
      setSearch("");
      setSubmittedSearch("");
      setSuccess(data.message || "Student created successfully.");

      await loadStudents();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create student."
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
          <h1>Students</h1>
          <p className="students-subtitle">
            Manage student records and search the student directory.
          </p>
        </div>

        <div className="students-count">
          <span>Total students</span>
          <strong>{students.length}</strong>
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
            <h2>Student Directory</h2>
            <p>
              {submittedSearch
                ? `${filteredStudents.length} exact match${filteredStudents.length === 1 ? "" : "es"}`
                : "Enter a complete name, email, or admission number and press Enter."}
            </p>
          </div>

          <form className="students-search" onSubmit={handleSearchSubmit}>
            <input
              type="search"
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Search students..."
              aria-label="Search students"
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
          <div className="students-empty">Loading students...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="students-empty">
            <strong>No exact match found</strong>
            <p>
              {submittedSearch
                ? `No student matches "${submittedSearch}". Check the full name, email, or admission number.`
                : "No students have been added yet."}
            </p>
          </div>
        ) : (
          <div className="students-table-wrapper">
            <table className="students-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Admission No.</th>
                  <th>Class</th>
                  <th>Section</th>
                  <th>Email</th>
                  <th>Status</th>
                  {canManage && <th>Account Actions</th>}
                </tr>
              </thead>

              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <strong>{student.user.name}</strong>
                    </td>
                    <td>{student.admissionNo}</td>
                    <td>{student.className}</td>
                    <td>{student.section}</td>
                    <td>{student.user.email}</td>
                    <td>
                      <span
                        className={
                          student.user.active
                            ? "student-status student-status-active"
                            : "student-status student-status-inactive"
                        }
                      >
                        {student.user.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {canManage && (
                      <td>
                        <PasswordResetButton
                          userId={student.user.id}
                          userName={student.user.name}
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
              <h2>Add Student</h2>
              <p>Create a new student account and academic record.</p>
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
              {showForm ? "Close Form" : "+ Add Student"}
            </button>
          </div>

          {showForm && (
            <form className="students-form" onSubmit={handleCreateStudent}>
              <label>
                Full Name *
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                  placeholder="Enter full name"
                />
              </label>

              <label>
                Email Address *
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  placeholder="student@example.com"
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
                Admission Number *
                <input
                  value={admissionNo}
                  onChange={(event) => setAdmissionNo(event.target.value)}
                  required
                  placeholder="e.g. ADM001"
                />
              </label>

              <label>
                Class *
                <input
                  value={className}
                  onChange={(event) => setClassName(event.target.value)}
                  required
                  placeholder="e.g. 10"
                />
              </label>

              <label>
                Section *
                <input
                  value={section}
                  onChange={(event) => setSection(event.target.value)}
                  required
                  placeholder="e.g. A"
                />
              </label>

              <label>
                Date of Birth
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                />
              </label>

              <label>
                Guardian Name
                <input
                  value={guardianName}
                  onChange={(event) => setGuardianName(event.target.value)}
                  placeholder="Guardian's name"
                />
              </label>

              <label>
                Guardian Phone
                <input
                  type="tel"
                  value={guardianPhone}
                  onChange={(event) => setGuardianPhone(event.target.value)}
                  placeholder="Phone number"
                />
              </label>

              <label className="students-form-full">
                Address
                <textarea
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  rows={3}
                  placeholder="Student address"
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
                  {saving ? "Creating Student..." : "Save Student"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </main>
  );
}
