"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AcademicRecord = {
  id: string;
  examId: string;
  studentId: string;
  marks: number;
  maxMarks: number;
  percentage: number;
  grade: string;
  remarks: string | null;
  exam: {
    id: string;
    title: string;
    subject: string;
    className: string;
    examDate: string;
    maxMarks: number;
  };
  student: {
    id: string;
    admissionNo: string;
    className: string;
    section: string;
    user: {
      name: string;
      active: boolean;
    };
  };
};


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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function AcademicRecordsManager() {
  const [records, setRecords] = useState<AcademicRecord[]>([]);
 

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("ALL");
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [gradeFilter, setGradeFilter] = useState("ALL");

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/academic-records", {
        cache: "no-store",
      });
      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Failed to load academic records"),
        );
      }

      if (
        !data ||
        typeof data !== "object" ||
        !("records" in data) ||
        !Array.isArray(data.records) ||
        !("summary" in data)
      ) {
        throw new Error("The server returned an unexpected response.");
      }

      setRecords(data.records as AcademicRecord[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load academic records",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRecords();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadRecords]);

  const classes = useMemo(
    () =>
      Array.from(new Set(records.map((record) => record.student.className)))
        .sort((a, b) => a.localeCompare(b)),
    [records],
  );

  const subjects = useMemo(
    () =>
      Array.from(new Set(records.map((record) => record.exam.subject))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [records],
  );

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchesSearch =
        !query ||
        record.student.user.name.toLowerCase().includes(query) ||
        record.student.admissionNo.toLowerCase().includes(query) ||
        record.exam.title.toLowerCase().includes(query) ||
        record.exam.subject.toLowerCase().includes(query);

      const matchesClass =
        classFilter === "ALL" ||
        record.student.className === classFilter;

      const matchesSubject =
        subjectFilter === "ALL" ||
        record.exam.subject === subjectFilter;

      const matchesGrade =
        gradeFilter === "ALL" || record.grade === gradeFilter;

      return (
        matchesSearch &&
        matchesClass &&
        matchesSubject &&
        matchesGrade
      );
    });
  }, [records, search, classFilter, subjectFilter, gradeFilter]);

  const filteredSummary = useMemo(() => {
    const totalRecords = filteredRecords.length;

    const averagePercentage =
      totalRecords > 0
        ? filteredRecords.reduce(
            (sum, record) => sum + record.percentage,
            0,
          ) / totalRecords
        : 0;

    const passedRecords = filteredRecords.filter(
      (record) => record.percentage >= 50,
    ).length;

    return {
      totalRecords,
      averagePercentage,
      passedRecords,
      failedRecords: totalRecords - passedRecords,
    };
  }, [filteredRecords]);

  function exportCsv() {
    const escapeCsv = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`;

    const rows = [
      [
        "Student",
        "Admission Number",
        "Class",
        "Examination",
        "Subject",
        "Exam Date",
        "Marks Obtained",
        "Maximum Marks",
        "Percentage",
        "Grade",
        "Remarks",
      ],
      ...filteredRecords.map((record) => [
        record.student.user.name,
        record.student.admissionNo,
        `${record.student.className}-${record.student.section}`,
        record.exam.title,
        record.exam.subject,
        record.exam.examDate.slice(0, 10),
        record.marks,
        record.maxMarks,
        record.percentage,
        record.grade,
        record.remarks ?? "",
      ]),
    ];

    const csv = rows
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "edumanage-academic-records.csv";
    anchor.click();

    URL.revokeObjectURL(url);
  }

  return (
    <section className="academic-manager">
      <style>{`
        .academic-manager {
          color: #14213d;
        }

        .academic-manager * {
          box-sizing: border-box;
        }

        .academic-manager .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .academic-manager .summary-card {
          padding: 22px;
          border: 1px solid #dce4f1;
          border-radius: 18px;
          background: #ffffff;
        }

        .academic-manager .summary-card p {
          margin: 0;
          color: #64748b;
          font-size: 14px;
        }

        .academic-manager .summary-card h2 {
          margin: 12px 0 0;
          font-size: clamp(21px, 2.5vw, 29px);
          overflow-wrap: anywhere;
        }

        .academic-manager .academic-panel {
          margin-bottom: 24px;
          padding: 25px;
          border: 1px solid #dce4f1;
          border-radius: 20px;
          background: #ffffff;
        }

        .academic-manager .panel-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 15px;
          margin-bottom: 20px;
        }

        .academic-manager .panel-top h2 {
          margin: 0;
          font-size: 22px;
        }

        .academic-manager .panel-top p {
          margin: 8px 0 0;
          color: #64748b;
          line-height: 1.6;
        }

        .academic-manager .filters {
          display: grid;
          grid-template-columns: minmax(200px, 2fr) repeat(3, minmax(130px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .academic-manager input,
        .academic-manager select {
          width: 100%;
          min-height: 44px;
          padding: 10px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background: #ffffff;
          color: #14213d;
          font: inherit;
        }

        .academic-manager input:focus,
        .academic-manager select:focus {
          border-color: #6366f1;
          outline: 2px solid #c7d2fe;
          outline-offset: 1px;
        }

        .academic-manager button {
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

        .academic-manager button:hover:not(:disabled) {
          background: #4338ca;
        }

        .academic-manager button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .academic-manager .secondary-button {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
        }

        .academic-manager .secondary-button:hover:not(:disabled) {
          background: #f1f5f9;
        }

        .academic-manager .table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .academic-manager table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          white-space: nowrap;
        }

        .academic-manager th,
        .academic-manager td {
          padding: 14px 12px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
        }

        .academic-manager th {
          background: #f8fafc;
          color: #64748b;
          font-size: 12px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .academic-manager td {
          font-size: 14px;
        }

        .academic-manager .student-name {
          font-weight: 700;
        }

        .academic-manager .subtext {
          display: block;
          margin-top: 5px;
          color: #64748b;
          font-size: 12px;
        }

        .academic-manager .grade {
          display: inline-block;
          min-width: 38px;
          padding: 6px 9px;
          border-radius: 8px;
          background: #eef2ff;
          color: #4338ca;
          text-align: center;
          font-weight: 700;
        }

        .academic-manager .message {
          margin-bottom: 18px;
          padding: 13px 15px;
          border: 1px solid #fecaca;
          border-radius: 10px;
          background: #fef2f2;
          color: #991b1b;
          line-height: 1.5;
        }

        .academic-manager .empty-state {
          padding: 35px 15px;
          color: #64748b;
          text-align: center;
        }

        @media (max-width: 900px) {
          .academic-manager .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .academic-manager .filters {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 600px) {
          .academic-manager .summary-grid,
          .academic-manager .filters {
            grid-template-columns: 1fr;
          }

          .academic-manager .academic-panel {
            padding: 18px;
          }
        }
      `}</style>

      {error && (
        <div className="message" role="alert">
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

      <div className="summary-grid">
        <div className="summary-card">
          <p>Result Records</p>
          <h2>{filteredSummary.totalRecords}</h2>
        </div>

        <div className="summary-card">
          <p>Average Percentage</p>
          <h2>{filteredSummary.averagePercentage.toFixed(2)}%</h2>
        </div>

        <div className="summary-card">
          <p>Passing Records</p>
          <h2>{filteredSummary.passedRecords}</h2>
        </div>

        <div className="summary-card">
          <p>Failing Records</p>
          <h2>{filteredSummary.failedRecords}</h2>
        </div>
      </div>

      <section className="academic-panel">
        <div className="panel-top">
          <div>
            <h2>Student Academic Records</h2>
            <p>
              Showing {filteredRecords.length} of {records.length} examination
              result records.
            </p>
          </div>

          <button
            type="button"
            onClick={exportCsv}
            disabled={filteredRecords.length === 0}
          >
            Export CSV
          </button>
        </div>

        <div className="filters">
          <input
            aria-label="Search academic records"
            placeholder="Search student, admission number, exam..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

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

          <select
            aria-label="Filter by subject"
            value={subjectFilter}
            onChange={(event) => setSubjectFilter(event.target.value)}
          >
            <option value="ALL">All subjects</option>
            {subjects.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by grade"
            value={gradeFilter}
            onChange={(event) => setGradeFilter(event.target.value)}
          >
            <option value="ALL">All grades</option>
            {["A+", "A", "B", "C", "D", "F"].map((grade) => (
              <option key={grade} value={grade}>
                Grade {grade}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="empty-state">Loading academic records...</div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            No examination results are available yet. Create an examination
            and enter student marks in the Examinations module first.
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="empty-state">
            No academic records match your search or filters.
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Examination</th>
                  <th>Subject</th>
                  <th>Date</th>
                  <th>Marks</th>
                  <th>Percentage</th>
                  <th>Grade</th>
                  <th>Remarks</th>
                </tr>
              </thead>

              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <span className="student-name">
                        {record.student.user.name}
                      </span>
                      <span className="subtext">
                        {record.student.admissionNo} ·{" "}
                        {record.student.className}-{record.student.section}
                      </span>
                    </td>

                    <td>{record.exam.title}</td>
                    <td>{record.exam.subject}</td>
                    <td>{formatDate(record.exam.examDate)}</td>
                    <td>
                      {record.marks} / {record.maxMarks}
                    </td>
                    <td>{record.percentage.toFixed(2)}%</td>
                    <td>
                      <span className="grade">{record.grade}</span>
                    </td>
                    <td>{record.remarks || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}