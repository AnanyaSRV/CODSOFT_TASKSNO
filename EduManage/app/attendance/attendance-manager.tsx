
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

type StudentRecord = {
  id: string;
  admissionNo: string;
  className: string;
  section: string;
  name: string;
  email: string;
  active: boolean;
  attendance: {
    id: string;
    status: AttendanceStatus;
    remarks: string | null;
  } | null;
};

type AttendanceEntry = {
  studentId: string;
  status: AttendanceStatus | "";
  remarks: string;
};

type HistoryRecord = {
  id: string;
  studentId: string;
  date: string;
  status: AttendanceStatus;
  remarks: string | null;
  student: {
    id: string;
    admissionNo: string;
    className: string;
    section: string;
    user: {
      name: string;
      email: string;
    };
  };
};

const STATUS_OPTIONS: AttendanceStatus[] = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
];

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
};

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  if (!value) return "—";

  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split("-").map(Number);

  if (!year || !month || !day) return datePart;

  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getErrorMessage(data: unknown, fallback: string) {
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

export default function AttendanceManager() {
  const [mode, setMode] = useState<"register" | "history">("register");

  const [date, setDate] = useState(getLocalDate());
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [search, setSearch] = useState("");

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [entries, setEntries] = useState<Record<string, AttendanceEntry>>({});

  const [startDate, setStartDate] = useState(getLocalDate());
  const [endDate, setEndDate] = useState(getLocalDate());
  const [historyStatus, setHistoryStatus] = useState("ALL");
  const [history, setHistory] = useState<HistoryRecord[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadRegister = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const params = new URLSearchParams({ date });

      if (className) params.set("className", className);
      if (section) params.set("section", section);
      if (search.trim()) params.set("search", search.trim());

      const response = await fetch(`/api/attendance?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Could not load the attendance register."),
        );
      }

      const loadedStudents: StudentRecord[] = data.students ?? [];

      setStudents(loadedStudents);
      setClasses(data.classes ?? []);
      setSections(data.sections ?? []);

      const nextEntries: Record<string, AttendanceEntry> = {};

      for (const student of loadedStudents) {
        nextEntries[student.id] = {
          studentId: student.id,
          status: student.attendance?.status ?? "",
          remarks: student.attendance?.remarks ?? "",
        };
      }

      setEntries(nextEntries);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while loading attendance.",
      );
    } finally {
      setLoading(false);
    }
  }, [date, className, section, search]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const params = new URLSearchParams({
        view: "history",
        startDate,
        endDate,
        status: historyStatus,
      });

      if (className) params.set("className", className);
      if (section) params.set("section", section);
      if (search.trim()) params.set("search", search.trim());

      const response = await fetch(`/api/attendance?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Could not load attendance history."),
        );
      }

      setHistory(data.history ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while loading history.",
      );
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, historyStatus, className, section, search]);

 useEffect(() => {
  const timer = setTimeout(() => {
    if (mode === "register") {
      void loadRegister();
    } else {
      void loadHistory();
    }
  }, 0);

  return () => clearTimeout(timer);
}, [mode, loadRegister, loadHistory]);

  const updateEntry = (
    studentId: string,
    changes: Partial<AttendanceEntry>,
  ) => {
    setEntries((previous) => ({
      ...previous,
      [studentId]: {
        ...(previous[studentId] ?? {
          studentId,
          status: "",
          remarks: "",
        }),
        ...changes,
      },
    }));

    setMessage("");
  };

  const markAll = (status: AttendanceStatus) => {
    setEntries((previous) => {
      const next = { ...previous };

      for (const student of students) {
        next[student.id] = {
          ...(next[student.id] ?? {
            studentId: student.id,
            status: "",
            remarks: "",
          }),
          status,
        };
      }

      return next;
    });

    setMessage("");
  };

  const saveAttendance = async () => {
    if (!date) {
      setError("Choose an attendance date.");
      return;
    }

    if (students.length === 0) {
      setError("There are no students to save.");
      return;
    }

    const incomplete = students.filter(
      (student) => !entries[student.id]?.status,
    );

    if (incomplete.length > 0) {
      setError(
        `Please select a status for all ${incomplete.length} unmarked student(s) in this register.`,
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const records = students.map((student) => ({
        studentId: student.id,
        status: entries[student.id].status as AttendanceStatus,
        remarks: entries[student.id].remarks,
      }));

      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ date, records }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Unable to save attendance."),
        );
      }

      setMessage(
        `Attendance saved successfully for ${data.savedCount ?? records.length} student(s).`,
      );

      await loadRegister();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while saving.",
      );
    } finally {
      setSaving(false);
    }
  };

  const counts = useMemo(() => {
    const result = {
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      EXCUSED: 0,
      UNMARKED: 0,
    };

    for (const student of students) {
      const status = entries[student.id]?.status;

      if (status && STATUS_OPTIONS.includes(status as AttendanceStatus)) {
        result[status as AttendanceStatus] += 1;
      } else {
        result.UNMARKED += 1;
      }
    }

    return result;
  }, [students, entries]);

  const exportHistoryCsv = () => {
    if (history.length === 0) {
      setError("There are no history records to export.");
      return;
    }

    const rows = [
      [
        "Date",
        "Admission Number",
        "Student Name",
        "Class",
        "Section",
        "Status",
        "Remarks",
      ],
      ...history.map((record) => [
        formatDate(record.date),
        record.student.admissionNo,
        record.student.user.name,
        record.student.className,
        record.student.section,
        STATUS_LABELS[record.status],
        record.remarks ?? "",
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `attendance-history-${getLocalDate()}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="attendance-manager">
      <style jsx>{`
        .attendance-manager {
          color: #182230;
          padding-bottom: 40px;
        }

        .toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin: 20px 0;
          border-bottom: 1px solid #e4e7ec;
          padding-bottom: 14px;
        }

        .tab {
          border: 1px solid #d0d5dd;
          border-radius: 9px;
          background: white;
          color: #344054;
          padding: 10px 16px;
          font-weight: 600;
          cursor: pointer;
        }

        .tab.active {
          background: #172554;
          color: white;
          border-color: #172554;
        }

        .filters {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          padding: 20px;
          background: white;
          border: 1px solid #e4e7ec;
          border-radius: 14px;
          margin-bottom: 18px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
          min-width: 0;
        }

        .field label {
          color: #475467;
          font-size: 13px;
          font-weight: 600;
        }

        .field input,
        .field select {
          width: 100%;
          min-width: 0;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          padding: 10px 11px;
          background: white;
          color: #101828;
          font: inherit;
        }

        .summary {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
          margin: 18px 0;
        }

        .stat {
          background: white;
          border: 1px solid #e4e7ec;
          border-radius: 12px;
          padding: 15px;
        }

        .stat span {
          display: block;
          font-size: 12px;
          color: #667085;
          margin-bottom: 8px;
        }

        .stat strong {
          font-size: 25px;
        }

        .table-card {
          overflow: hidden;
          background: white;
          border: 1px solid #e4e7ec;
          border-radius: 14px;
        }

        .table-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          padding: 18px;
          border-bottom: 1px solid #e4e7ec;
        }

        .table-heading h2 {
          margin: 0;
          font-size: 17px;
        }

        .table-heading p {
          margin: 5px 0 0;
          color: #667085;
          font-size: 13px;
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          white-space: nowrap;
        }

        th,
        td {
          text-align: left;
          padding: 13px 15px;
          border-bottom: 1px solid #eaecf0;
          font-size: 13px;
        }

        th {
          background: #f9fafb;
          color: #475467;
          font-weight: 600;
        }

        tbody tr:last-child td {
          border-bottom: none;
        }

        .student-name {
          font-weight: 600;
          color: #101828;
        }

        .subtext {
          display: block;
          margin-top: 4px;
          color: #667085;
          font-size: 12px;
        }

        .status-select {
          min-width: 118px;
          padding: 8px;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          background: white;
          font: inherit;
        }

        .remarks {
          min-width: 160px;
          padding: 8px;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          font: inherit;
        }

        .status {
          display: inline-block;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 700;
        }

        .status-PRESENT {
          background: #dcfae6;
          color: #067647;
        }

        .status-ABSENT {
          background: #fee4e2;
          color: #b42318;
        }

        .status-LATE {
          background: #fef0c7;
          color: #93370d;
        }

        .status-EXCUSED {
          background: #e0eaff;
          color: #3538cd;
        }

        .status-UNMARKED {
          background: #f2f4f7;
          color: #475467;
        }

        .actions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .btn {
          border: 1px solid #d0d5dd;
          border-radius: 9px;
          padding: 10px 14px;
          background: white;
          color: #344054;
          font: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn.primary {
          background: #172554;
          border-color: #172554;
          color: white;
        }

        .btn:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .notice {
          border-radius: 9px;
          padding: 12px 14px;
          margin: 14px 0;
          font-size: 13px;
        }

        .notice.error {
          background: #fef3f2;
          border: 1px solid #fecdca;
          color: #b42318;
        }

        .notice.success {
          background: #ecfdf3;
          border: 1px solid #abefc6;
          color: #067647;
        }

        .empty {
          padding: 42px 20px;
          text-align: center;
          color: #667085;
        }

        .footer-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 18px;
        }

        .muted {
          color: #667085;
          font-size: 13px;
        }

        @media (max-width: 900px) {
          .filters {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .summary {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 520px) {
          .filters {
            grid-template-columns: 1fr;
            padding: 14px;
          }

          .summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>

      <div className="toolbar">
        <button
          type="button"
          className={`tab ${mode === "register" ? "active" : ""}`}
          onClick={() => {
            setMode("register");
            setError("");
            setMessage("");
          }}
        >
          Daily Register
        </button>

        <button
          type="button"
          className={`tab ${mode === "history" ? "active" : ""}`}
          onClick={() => {
            setMode("history");
            setError("");
            setMessage("");
          }}
        >
          Attendance History
        </button>
      </div>

      <section className="filters">
        {mode === "register" ? (
          <div className="field">
            <label htmlFor="attendance-date">Attendance date</label>
            <input
              id="attendance-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="history-start">From date</label>
              <input
                id="history-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="history-end">To date</label>
              <input
                id="history-end"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="history-status">Attendance status</label>
              <select
                id="history-status"
                value={historyStatus}
                onChange={(event) => setHistoryStatus(event.target.value)}
              >
                <option value="ALL">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor="attendance-class">Class</label>
          <select
            id="attendance-class"
            value={className}
            onChange={(event) => setClassName(event.target.value)}
          >
            <option value="">All classes</option>
            {classes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="attendance-section">Section</label>
          <select
            id="attendance-section"
            value={section}
            onChange={(event) => setSection(event.target.value)}
          >
            <option value="">All sections</option>
            {sections.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="attendance-search">Find student</label>
          <input
            id="attendance-search"
            type="search"
            placeholder="Name, admission no., or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </section>

      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="notice success" role="status">
          {message}
        </div>
      )}

      {mode === "register" ? (
        <>
          <section className="summary">
            <div className="stat">
              <span>Total students</span>
              <strong>{students.length}</strong>
            </div>

            <div className="stat">
              <span>Present</span>
              <strong>{counts.PRESENT}</strong>
            </div>

            <div className="stat">
              <span>Absent</span>
              <strong>{counts.ABSENT}</strong>
            </div>

            <div className="stat">
              <span>Late</span>
              <strong>{counts.LATE}</strong>
            </div>

            <div className="stat">
              <span>Unmarked</span>
              <strong>{counts.UNMARKED}</strong>
            </div>
          </section>

          <section className="table-card">
            <div className="table-heading">
              <div>
                <h2>Daily attendance register</h2>
                <p>
                  {formatDate(date)} · {students.length} student(s)
                </p>
              </div>

              <div className="actions">
                <button
                  type="button"
                  className="btn"
                  disabled={loading || students.length === 0}
                  onClick={() => markAll("PRESENT")}
                >
                  Mark all present
                </button>

                <button
                  type="button"
                  className="btn"
                  disabled={loading}
                  onClick={() => void loadRegister()}
                >
                  Refresh
                </button>
              </div>
            </div>

            {loading ? (
              <div className="empty">Loading students...</div>
            ) : students.length === 0 ? (
              <div className="empty">
                No students match the selected filters.
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Student</th>
                      <th>Admission no.</th>
                      <th>Class / Section</th>
                      <th>Status</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>

                  <tbody>
                    {students.map((student, index) => {
                      const entry = entries[student.id];
                      const currentStatus = entry?.status ?? "";

                      return (
                        <tr key={student.id}>
                          <td>{index + 1}</td>

                          <td>
                            <span className="student-name">
                              {student.name || "Unnamed student"}
                            </span>
                            <span className="subtext">{student.email}</span>
                          </td>

                          <td>{student.admissionNo}</td>

                          <td>
                            {student.className} / {student.section}
                          </td>

                          <td>
                            <select
                              className="status-select"
                              aria-label={`Attendance status for ${student.name}`}
                              value={currentStatus}
                              onChange={(event) =>
                                updateEntry(student.id, {
                                  status: event.target.value as
                                    | AttendanceStatus
                                    | "",
                                })
                              }
                            >
                              <option value="">Select status</option>
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {STATUS_LABELS[status]}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td>
                            <input
                              className="remarks"
                              type="text"
                              maxLength={500}
                              placeholder="Optional remarks"
                              aria-label={`Remarks for ${student.name}`}
                              value={entry?.remarks ?? ""}
                              onChange={(event) =>
                                updateEntry(student.id, {
                                  remarks: event.target.value,
                                })
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="footer-actions">
            <span className="muted">
              Unmarked students must receive a status before saving.
            </span>

            <button
              type="button"
              className="btn primary"
              disabled={saving || loading || students.length === 0}
              onClick={() => void saveAttendance()}
            >
              {saving ? "Saving..." : "Save attendance"}
            </button>
          </div>
        </>
      ) : (
        <section className="table-card">
          <div className="table-heading">
            <div>
              <h2>Attendance history</h2>
              <p>
                {history.length} record(s) returned, up to 1,000 records per
                query.
              </p>
            </div>

            <div className="actions">
              <button
                type="button"
                className="btn"
                disabled={loading}
                onClick={() => void loadHistory()}
              >
                Refresh
              </button>

              <button
                type="button"
                className="btn primary"
                disabled={loading || history.length === 0}
                onClick={exportHistoryCsv}
              >
                Export CSV
              </button>
            </div>
          </div>

          {loading ? (
            <div className="empty">Loading attendance history...</div>
          ) : history.length === 0 ? (
            <div className="empty">
              No attendance records match the selected filters.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Student</th>
                    <th>Admission no.</th>
                    <th>Class / Section</th>
                    <th>Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>

                <tbody>
                  {history.map((record) => (
                    <tr key={record.id}>
                      <td>{formatDate(record.date)}</td>

                      <td>
                        <span className="student-name">
                          {record.student.user.name || "Unnamed student"}
                        </span>
                        <span className="subtext">
                          {record.student.user.email}
                        </span>
                      </td>

                      <td>{record.student.admissionNo}</td>

                      <td>
                        {record.student.className} / {record.student.section}
                      </td>

                      <td>
                        <span className={`status status-${record.status}`}>
                          {STATUS_LABELS[record.status]}
                        </span>
                      </td>

                      <td>{record.remarks || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
