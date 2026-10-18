
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Not provided";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(value: number | string | { toString(): string }) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function statusClass(status: string) {
  switch (status) {
    case "PRESENT":
    case "PAID":
      return "student-status student-status-success";
    case "LATE":
    case "PARTIAL":
      return "student-status student-status-warning";
    case "ABSENT":
    case "PENDING":
      return "student-status student-status-danger";
    default:
      return "student-status";
  }
}

const panelStyle = {
  background: "var(--card, #ffffff)",
  border: "1px solid var(--border, #e5e7eb)",
  borderRadius: "16px",
  padding: "24px",
  minWidth: 0,
} as const;

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse" as const,
  textAlign: "left" as const,
  fontSize: "14px",
};

const cellStyle = {
  padding: "13px 12px",
  borderBottom: "1px solid var(--border, #e5e7eb)",
  verticalAlign: "top" as const,
};

function EmptyState({ message }: { message: string }) {
  return (
    <p style={{ color: "var(--muted-foreground, #64748b)", marginBottom: 0 }}>
      {message}
    </p>
  );
}

async function StudentPortalContent() {
  const session = await getSession();

  if (!session?.userId) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
    },
  });

  if (!user || !user.active || user.role !== session.role) {
    redirect("/");
  }

  if (user.role !== "STUDENT") {
    redirect("/dashboard");
  }

  // Critical security rule: retrieve only the Student record linked
  // to the authenticated user's ID. Never accept a student ID from the URL.
  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    include: {
      attendance: {
        orderBy: { date: "desc" },
      },
      results: {
        include: {
          exam: true,
        },
        orderBy: { createdAt: "desc" },
      },
      fees: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!student) {
    return (
      <main className="students-page">
        <header className="students-heading">
          <div>
            <p className="students-eyebrow">EDUMANAGE PORTAL</p>
            <h1>My Student Portal</h1>
            <p className="students-subtitle">
              Welcome, {user.name}.
            </p>
          </div>
          <div className="students-count">
            <span>Your role</span>
            <strong>Student</strong>
          </div>
        </header>

        <section className="students-panel">
          <h2>Student profile not linked</h2>
          <p>
            Your login account is active, but there is no student record
            linked to it yet. Please contact your administrator to create
            or link your student profile.
          </p>
          <p>
            No other student&apos;s information has been displayed.
          </p>
          <Link href="/dashboard">← Back to Dashboard</Link>
        </section>

        <form action="/api/auth/logout" method="POST">
          <button type="submit" className="students-button">
            Log Out
          </button>
        </form>
      </main>
    );
  }

  const attendanceCount = student.attendance.length;
  const presentCount = student.attendance.filter(
    (record) => record.status === "PRESENT",
  ).length;
  const lateCount = student.attendance.filter(
    (record) => record.status === "LATE",
  ).length;
  const absentCount = student.attendance.filter(
    (record) => record.status === "ABSENT",
  ).length;

  const attendanceRate =
    attendanceCount === 0
      ? null
      : ((presentCount + lateCount) / attendanceCount) * 100;

  const totalFees = student.fees.reduce(
    (sum, fee) => sum + Number(fee.amount),
    0,
  );

  const totalPaid = student.fees.reduce(
    (sum, fee) => sum + Number(fee.paidAmount),
    0,
  );

  const outstandingFees = Math.max(0, totalFees - totalPaid);

  // The schema does not yet have a subject-enrolment model.
  // These are subjects represented by the student's exam results.
  const subjects = Array.from(
    new Set(student.results.map((result) => result.exam.subject)),
  );

  return (
    <main className="students-page">
      <header className="students-heading">
        <div>
          <p className="students-eyebrow">EDUMANAGE PORTAL</p>
          <h1>My Student Portal</h1>
          <p className="students-subtitle">
            Welcome back, {user.name}. Here are your academic records.
          </p>
        </div>

        <div className="students-count">
          <span>Admission number</span>
          <strong>{student.admissionNo}</strong>
        </div>
      </header>

      <nav
        aria-label="Student portal navigation"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        <Link href="/dashboard">← Dashboard</Link>
      </nav>

      <section style={{ ...panelStyle, marginBottom: "24px" }}>
        <p className="students-eyebrow">MY PROFILE</p>
        <h2 style={{ marginTop: 0 }}>{user.name}</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: "20px",
          }}
        >
          <div>
            <strong>Email</strong>
            <p>{user.email}</p>
          </div>
          <div>
            <strong>Admission number</strong>
            <p>{student.admissionNo}</p>
          </div>
          <div>
            <strong>Class and section</strong>
            <p>
              {student.className} - {student.section}
            </p>
          </div>
          <div>
            <strong>Date of birth</strong>
            <p>{formatDate(student.dateOfBirth)}</p>
          </div>
          <div>
            <strong>Guardian</strong>
            <p>{student.guardianName || "Not provided"}</p>
          </div>
          <div>
            <strong>Guardian phone</strong>
            <p>{student.guardianPhone || "Not provided"}</p>
          </div>
          <div>
            <strong>Address</strong>
            <p>{student.address || "Not provided"}</p>
          </div>
        </div>
      </section>

      <section
        aria-label="Academic summary"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div className="students-count">
          <span>Attendance recorded</span>
          <strong>{attendanceCount}</strong>
        </div>
        <div className="students-count">
          <span>Present</span>
          <strong>{presentCount}</strong>
        </div>
        <div className="students-count">
          <span>Absent</span>
          <strong>{absentCount}</strong>
        </div>
        <div className="students-count">
          <span>Attendance rate</span>
          <strong>
            {attendanceRate === null
              ? "—"
              : `${attendanceRate.toFixed(1)}%`}
          </strong>
        </div>
      </section>

      <section style={{ ...panelStyle, marginBottom: "24px" }}>
        <p className="students-eyebrow">MY ATTENDANCE</p>
        <h2 style={{ marginTop: 0 }}>Attendance History</h2>

        {student.attendance.length === 0 ? (
          <EmptyState message="No attendance records have been added yet." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={cellStyle}>Date</th>
                  <th style={cellStyle}>Status</th>
                  <th style={cellStyle}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {student.attendance.map((record) => (
                  <tr key={record.id}>
                    <td style={cellStyle}>{formatDate(record.date)}</td>
                    <td style={cellStyle}>
                      <span className={statusClass(record.status)}>
                        {record.status}
                      </span>
                    </td>
                    <td style={cellStyle}>{record.remarks || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ ...panelStyle, marginBottom: "24px" }}>
        <p className="students-eyebrow">MY ACADEMICS</p>
        <h2 style={{ marginTop: 0 }}>Examination Results</h2>

        {student.results.length === 0 ? (
          <EmptyState message="No examination results have been published for you yet." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={cellStyle}>Examination</th>
                  <th style={cellStyle}>Subject</th>
                  <th style={cellStyle}>Exam date</th>
                  <th style={cellStyle}>Marks</th>
                  <th style={cellStyle}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {student.results.map((result) => (
                  <tr key={result.id}>
                    <td style={cellStyle}>{result.exam.title}</td>
                    <td style={cellStyle}>{result.exam.subject}</td>
                    <td style={cellStyle}>
                      {formatDate(result.exam.examDate)}
                    </td>
                    <td style={cellStyle}>
                      {result.marks} / {result.exam.maxMarks}
                    </td>
                    <td style={cellStyle}>{result.remarks || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: "20px" }}>
          <strong>Subjects represented in your results</strong>
          {subjects.length === 0 ? (
            <p>No subjects are available from your results yet.</p>
          ) : (
            <p>{subjects.join(", ")}</p>
          )}
        </div>
      </section>

      <section style={{ ...panelStyle, marginBottom: "24px" }}>
        <p className="students-eyebrow">MY FEES</p>
        <h2 style={{ marginTop: 0 }}>Fees and Payments</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <div className="students-count">
            <span>Total fees recorded</span>
            <strong>{formatMoney(totalFees)}</strong>
          </div>
          <div className="students-count">
            <span>Total paid</span>
            <strong>{formatMoney(totalPaid)}</strong>
          </div>
          <div className="students-count">
            <span>Outstanding balance</span>
            <strong>{formatMoney(outstandingFees)}</strong>
          </div>
        </div>

        {student.fees.length === 0 ? (
          <EmptyState message="No fee records have been added yet." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={cellStyle}>Fee</th>
                  <th style={cellStyle}>Amount</th>
                  <th style={cellStyle}>Paid</th>
                  <th style={cellStyle}>Balance</th>
                  <th style={cellStyle}>Due date</th>
                  <th style={cellStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {student.fees.map((fee) => {
                  const balance = Math.max(
                    0,
                    Number(fee.amount) - Number(fee.paidAmount),
                  );

                  return (
                    <tr key={fee.id}>
                      <td style={cellStyle}>{fee.title}</td>
                      <td style={cellStyle}>
                        {formatMoney(fee.amount.toString())}
                      </td>
                      <td style={cellStyle}>
                        {formatMoney(fee.paidAmount.toString())}
                      </td>
                      <td style={cellStyle}>{formatMoney(balance)}</td>
                      <td style={cellStyle}>{formatDate(fee.dueDate)}</td>
                      <td style={cellStyle}>
                        <span className={statusClass(fee.status)}>
                          {fee.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <form action="/api/auth/logout" method="POST">
        <button type="submit" className="students-button">
          Log Out
        </button>
      </form>
    </main>
  );
}

export default async function StudentPortalPage() {
  return <StudentPortalContent />;
}
