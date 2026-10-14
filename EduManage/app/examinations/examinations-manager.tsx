"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ExamResult = {
  id: string;
  examId: string;
  studentId: string;
  marks: number;
  remarks: string | null;
  student: {
    id: string;
    admissionNo: string;
    className: string;
    section: string;
    user: {
      name: string;
      email: string;
      active: boolean;
    };
  };
};

type Exam = {
  id: string;
  title: string;
  subject: string;
  className: string;
  examDate: string;
  maxMarks: number;
  results: ExamResult[];
};

type Student = {
  id: string;
  admissionNo: string;
  className: string;
  section: string;
  user: {
    name: string;
    email: string;
    active: boolean;
  };
};

type ResultEntry = {
  marks: string;
  remarks: string;
};

type Props = {
  canManage: boolean;
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
  if (!value) return "—";

  const [year, month, day] = value.slice(0, 10).split("-").map(Number);

  if (!year || !month || !day) return value.slice(0, 10);

  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getLocalDate() {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function ExaminationsManager({ canManage }: Props) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [entries, setEntries] = useState<Record<string, ResultEntry>>({});

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [className, setClassName] = useState("");
  const [examDate, setExamDate] = useState(getLocalDate());
  const [maxMarks, setMaxMarks] = useState("100");

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedExam = exams.find((exam) => exam.id === selectedExamId);

  const loadExams = useCallback(async (preferredExamId?: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/examinations", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Could not load examinations."),
        );
      }

      const loadedExams: Exam[] = data.exams ?? [];
      setExams(loadedExams);

      setSelectedExamId((previous) => {
        const wanted = preferredExamId || previous;

        if (wanted && loadedExams.some((exam) => exam.id === wanted)) {
          return wanted;
        }

        return loadedExams[0]?.id ?? "";
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while loading examinations.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStudentsAndResults = useCallback(async () => {
    if (!selectedExam) {
      setStudents([]);
      setEntries({});
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [studentsResponse, resultsResponse] = await Promise.all([
        fetch("/api/students", {
          method: "GET",
          cache: "no-store",
        }),
        fetch(
          `/api/examination-results?examId=${encodeURIComponent(selectedExam.id)}`,
          {
            method: "GET",
            cache: "no-store",
          },
        ),
      ]);

      const [studentsData, resultsData] = await Promise.all([
        studentsResponse.json(),
        resultsResponse.json(),
      ]);

      if (!studentsResponse.ok) {
        throw new Error(
          getErrorMessage(studentsData, "Could not load students."),
        );
      }

      if (!resultsResponse.ok) {
        throw new Error(
          getErrorMessage(resultsData, "Could not load examination results."),
        );
      }

      const allStudents: Student[] = studentsData.students ?? [];
      const classStudents = allStudents.filter(
        (student) =>
          student.className === selectedExam.className &&
          student.user.active,
      );

      const results: ExamResult[] = resultsData.results ?? [];
      const resultMap: Record<string, ResultEntry> = {};

      for (const result of results) {
        resultMap[result.studentId] = {
          marks: String(result.marks),
          remarks: result.remarks ?? "",
        };
      }

      for (const student of classStudents) {
        if (!resultMap[student.id]) {
          resultMap[student.id] = {
            marks: "",
            remarks: "",
          };
        }
      }

      setStudents(classStudents);
      setEntries(resultMap);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while loading student results.",
      );
    } finally {
      setLoading(false);
    }
  }, [selectedExam]);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      if (!cancelled) {
        void loadExams();
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadExams]);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      if (!cancelled) {
        void loadStudentsAndResults();
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadStudentsAndResults]);

  const availableClasses = useMemo(
    () => [...new Set(exams.map((exam) => exam.className))].sort(),
    [exams],
  );

  const filteredExams = useMemo(() => {
    const query = search.trim().toLowerCase();

    return exams.filter((exam) => {
      const matchesClass = !classFilter || exam.className === classFilter;
      const matchesSearch =
        !query ||
        exam.title.toLowerCase().includes(query) ||
        exam.subject.toLowerCase().includes(query) ||
        exam.className.toLowerCase().includes(query);

      return matchesClass && matchesSearch;
    });
  }, [exams, search, classFilter]);

  const savedCount = selectedExam
    ? selectedExam.results.filter((result) =>
        students.some((student) => student.id === result.studentId),
      ).length
    : 0;

  const updateEntry = (
    studentId: string,
    changes: Partial<ResultEntry>,
  ) => {
    setEntries((previous) => ({
      ...previous,
      [studentId]: {
        ...(previous[studentId] ?? { marks: "", remarks: "" }),
        ...changes,
      },
    }));

    setMessage("");
  };

  const createExam = async () => {
    if (!title.trim() || !subject.trim() || !className.trim() || !examDate) {
      setError("Complete all examination fields.");
      return;
    }

    const parsedMaxMarks = Number(maxMarks);

    if (!Number.isFinite(parsedMaxMarks) || parsedMaxMarks <= 0) {
      setError("Maximum marks must be a number greater than zero.");
      return;
    }

    setCreating(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/examinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          subject: subject.trim(),
          className: className.trim(),
          examDate,
          maxMarks: parsedMaxMarks,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Unable to create examination."),
        );
      }

      setTitle("");
      setSubject("");
      setClassName("");
      setExamDate(getLocalDate());
      setMaxMarks("100");
      setMessage("Examination created successfully.");

      await loadExams(data.exam?.id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while creating the examination.",
      );
    } finally {
      setCreating(false);
    }
  };

  const saveResults = async () => {
    if (!selectedExam) {
      setError("Select an examination first.");
      return;
    }

    if (students.length === 0) {
      setError("There are no active students in this examination's class.");
      return;
    }

    const incomplete = students.filter(
      (student) => entries[student.id]?.marks.trim() === "",
    );

    if (incomplete.length > 0) {
      setError(
        `Enter marks for all ${incomplete.length} student(s) before saving.`,
      );
      return;
    }

    for (const student of students) {
      const marks = Number(entries[student.id]?.marks);

      if (
        !Number.isFinite(marks) ||
        marks < 0 ||
        marks > selectedExam.maxMarks
      ) {
        setError(
          `Enter valid marks between 0 and ${selectedExam.maxMarks} for ${student.user.name}.`,
        );
        return;
      }
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      for (const student of students) {
        const response = await fetch("/api/examination-results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            examId: selectedExam.id,
            studentId: student.id,
            marks: Number(entries[student.id].marks),
            remarks: entries[student.id].remarks.trim(),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            `${student.user.name}: ${getErrorMessage(
              data,
              "Unable to save result.",
            )}`,
          );
        }
      }

      setMessage(`Results saved for ${students.length} student(s).`);

      await loadExams(selectedExam.id);
      await loadStudentsAndResults();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while saving results.",
      );
    } finally {
      setSaving(false);
    }
  };

  const exportResultsCsv = () => {
    if (!selectedExam || students.length === 0) {
      setError("There are no student results to export.");
      return;
    }

    const rows = [
      [
        "Exam",
        "Subject",
        "Exam Date",
        "Admission Number",
        "Student Name",
        "Class",
        "Section",
        "Marks",
        "Maximum Marks",
        "Percentage",
        "Remarks",
      ],
      ...students.map((student) => {
        const marksValue = entries[student.id]?.marks ?? "";
        const marks =
          marksValue.trim() === "" ? "" : Number(marksValue);
        const percentage =
          marks === "" ? "" : ((marks / selectedExam.maxMarks) * 100).toFixed(2);

        return [
          selectedExam.title,
          selectedExam.subject,
          formatDate(selectedExam.examDate),
          student.admissionNo,
          student.user.name,
          student.className,
          student.section,
          marks,
          selectedExam.maxMarks,
          percentage,
          entries[student.id]?.remarks ?? "",
        ];
      }),
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
    link.download = `exam-results-${selectedExam.id}-${getLocalDate()}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="examinations-manager">
      <style jsx>{`
        .examinations-manager {
          color: #182230;
          padding-bottom: 40px;
        }

        .panel {
          background: white;
          border: 1px solid #e4e7ec;
          border-radius: 14px;
          padding: 20px;
          margin: 18px 0;
        }

        .panel h2 {
          margin: 0 0 6px;
          font-size: 18px;
        }

        .muted {
          color: #667085;
          font-size: 13px;
          line-height: 1.5;
        }

        .form-grid,
        .filters {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-top: 18px;
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
          box-sizing: border-box;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          padding: 10px 11px;
          background: white;
          color: #101828;
          font: inherit;
        }

        .toolbar,
        .actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
        }

        .toolbar {
          justify-content: space-between;
          margin: 18px 0;
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

        .table-card {
          overflow: hidden;
          background: white;
          border: 1px solid #e4e7ec;
          border-radius: 14px;
          margin-top: 18px;
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
          display: block;
          font-weight: 600;
          color: #101828;
        }

        .subtext {
          display: block;
          margin-top: 4px;
          color: #667085;
          font-size: 12px;
        }

        .marks,
        .remarks {
          min-width: 110px;
          width: 100%;
          box-sizing: border-box;
          padding: 8px;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          font: inherit;
        }

        .remarks {
          min-width: 170px;
        }

        .summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
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
          font-size: 23px;
        }

        .empty {
          padding: 38px 20px;
          text-align: center;
          color: #667085;
        }

        @media (max-width: 760px) {
          .form-grid,
          .filters {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 480px) {
          .panel {
            padding: 14px;
          }

          .form-grid,
          .filters {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

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

      {canManage && (
        <section className="panel">
          <h2>Create an examination</h2>
          <p className="muted">
            Add an examination before entering student marks.
          </p>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="exam-title">Examination title</label>
              <input
                id="exam-title"
                value={title}
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Mid-Term Examination"
              />
            </div>

            <div className="field">
              <label htmlFor="exam-subject">Subject</label>
              <input
                id="exam-subject"
                value={subject}
                maxLength={100}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="e.g. Mathematics"
              />
            </div>

            <div className="field">
              <label htmlFor="exam-class">Class</label>
              <input
                id="exam-class"
                value={className}
                maxLength={50}
                onChange={(event) => setClassName(event.target.value)}
                placeholder="e.g. 10"
              />
            </div>

            <div className="field">
              <label htmlFor="exam-date">Examination date</label>
              <input
                id="exam-date"
                type="date"
                value={examDate}
                onChange={(event) => setExamDate(event.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="exam-max-marks">Maximum marks</label>
              <input
                id="exam-max-marks"
                type="number"
                min="0.01"
                step="any"
                value={maxMarks}
                onChange={(event) => setMaxMarks(event.target.value)}
              />
            </div>
          </div>

          <div className="actions" style={{ marginTop: 18 }}>
            <button
              type="button"
              className="btn primary"
              disabled={creating}
              onClick={() => void createExam()}
            >
              {creating ? "Creating..." : "Create examination"}
            </button>
          </div>
        </section>
      )}

      <section className="panel">
        <h2>Examination register</h2>
        <p className="muted">
          Select an examination to enter or update marks for its class.
        </p>

        <div className="filters">
          <div className="field">
            <label htmlFor="exam-search">Search examinations</label>
            <input
              id="exam-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Title, subject, or class"
            />
          </div>

          <div className="field">
            <label htmlFor="exam-class-filter">Filter by class</label>
            <select
              id="exam-class-filter"
              value={classFilter}
              onChange={(event) => setClassFilter(event.target.value)}
            >
              <option value="">All classes</option>
              {availableClasses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="exam-select">Selected examination</label>
            <select
              id="exam-select"
              value={selectedExamId}
              onChange={(event) => {
                setSelectedExamId(event.target.value);
                setError("");
                setMessage("");
              }}
            >
              <option value="">Select an examination</option>
              {filteredExams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title} — {exam.subject} — Class {exam.className}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="actions" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn"
            disabled={loading}
            onClick={() => void loadExams(selectedExamId)}
          >
            Refresh examinations
          </button>
        </div>
      </section>

      {selectedExam && (
        <>
          <section className="summary">
            <div className="stat">
              <span>Examinations</span>
              <strong>{exams.length}</strong>
            </div>
            <div className="stat">
              <span>Students in class</span>
              <strong>{students.length}</strong>
            </div>
            <div className="stat">
              <span>Maximum marks</span>
              <strong>{selectedExam.maxMarks}</strong>
            </div>
            <div className="stat">
              <span>Saved results</span>
              <strong>{savedCount}</strong>
            </div>
          </section>

          <section className="table-card">
            <div className="table-heading">
              <div>
                <h2>{selectedExam.title}</h2>
                <p>
                  {selectedExam.subject} · Class {selectedExam.className} ·{" "}
                  {formatDate(selectedExam.examDate)} · Maximum{" "}
                  {selectedExam.maxMarks} marks
                </p>
              </div>

              <div className="actions">
                <button
                  type="button"
                  className="btn"
                  disabled={loading}
                  onClick={() => void loadStudentsAndResults()}
                >
                  Refresh students
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={loading || students.length === 0}
                  onClick={exportResultsCsv}
                >
                  Export CSV
                </button>
              </div>
            </div>

            {loading ? (
              <div className="empty">Loading students and results...</div>
            ) : students.length === 0 ? (
              <div className="empty">
                No active students were found in class {selectedExam.className}.
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Student</th>
                      <th>Admission no.</th>
                      <th>Section</th>
                      <th>Marks / {selectedExam.maxMarks}</th>
                      <th>Percentage</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, index) => {
                      const entry = entries[student.id];
                      const marks =
                        entry?.marks.trim() === ""
                          ? null
                          : Number(entry?.marks);
                      const percentage =
                        marks === null || !Number.isFinite(marks)
                          ? null
                          : (marks / selectedExam.maxMarks) * 100;

                      return (
                        <tr key={student.id}>
                          <td>{index + 1}</td>
                          <td>
                            <span className="student-name">
                              {student.user.name || "Unnamed student"}
                            </span>
                            <span className="subtext">
                              {student.user.email}
                            </span>
                          </td>
                          <td>{student.admissionNo}</td>
                          <td>{student.section}</td>
                          <td>
                            <input
                              className="marks"
                              type="number"
                              min="0"
                              max={selectedExam.maxMarks}
                              step="any"
                              aria-label={`Marks for ${student.user.name}`}
                              value={entry?.marks ?? ""}
                              onChange={(event) =>
                                updateEntry(student.id, {
                                  marks: event.target.value,
                                })
                              }
                              disabled={!canManage}
                            />
                          </td>
                          <td>
                            {percentage === null
                              ? "—"
                              : `${percentage.toFixed(2)}%`}
                          </td>
                          <td>
                            <input
                              className="remarks"
                              type="text"
                              maxLength={500}
                              placeholder="Optional remarks"
                              aria-label={`Remarks for ${student.user.name}`}
                              value={entry?.remarks ?? ""}
                              onChange={(event) =>
                                updateEntry(student.id, {
                                  remarks: event.target.value,
                                })
                              }
                              disabled={!canManage}
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

          {canManage && (
            <div
              className="actions"
              style={{ justifyContent: "flex-end", marginTop: 18 }}
            >
              <button
                type="button"
                className="btn primary"
                disabled={saving || loading || students.length === 0}
                onClick={() => void saveResults()}
              >
                {saving ? "Saving results..." : "Save all results"}
              </button>
            </div>
          )}
        </>
      )}

      {!loading && exams.length === 0 && (
        <section className="panel">
          <div className="empty">
            No examinations have been created yet.
            {canManage
              ? " Use the form above to create your first examination."
              : " Ask an administrator to create an examination."}
          </div>
        </section>
      )}
    </div>
  );
}