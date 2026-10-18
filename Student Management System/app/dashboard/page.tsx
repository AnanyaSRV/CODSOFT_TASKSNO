
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const roleLabels = {
  ADMIN: "Administrator",
  TEACHER: "Teacher",
  STUDENT: "Student",
} as const;

type Role = keyof typeof roleLabels;

type DashboardLink = {
  title: string;
  description: string;
  href: string;
  action: string;
};

const dashboardLinks: Record<Role, DashboardLink[]> = {
  ADMIN: [
    {
      title: "Students",
      description: "View and manage student records and accounts.",
      href: "/students",
      action: "Manage students",
    },
    {
      title: "Teachers",
      description: "Manage teacher accounts and staff information.",
      href: "/teachers",
      action: "Manage teachers",
    },
    {
      title: "Teacher Assignments",
      description:
        "Assign teachers to classes and sections and manage their teaching responsibilities.",
      href: "/teacher-assignments",
      action: "Manage assignments",
    },
  ],
  TEACHER: [
    {
      title: "Students",
      description: "View student records available to your account.",
      href: "/students",
      action: "View students",
    },
  ],
  STUDENT: [
    {
      title: "My Student Portal",
      description:
        "View your profile, attendance, examination results and fee records.",
      href: "/student-portal",
      action: "Open my portal",
    },
  ],
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="students-count">
      <span>{label}</span>
      <strong>{value}</strong>
      <p style={{ marginBottom: 0, marginTop: 8 }}>{detail}</p>
    </div>
  );
}

async function DashboardContent() {
  const session = await getSession();

  if (!session?.userId) {
    redirect("/");
  }

  if (session.role === "TEACHER") {
    redirect("/teacher-dashboard");
  }

  // Validate the session against the current database account.
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

  const links = dashboardLinks[user.role];

  // Fetch academic data only for the authenticated student.
  const student =
    user.role === "STUDENT"
      ? await prisma.student.findUnique({
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
            fees: true,
          },
        })
      : null;

  let attendanceValue = "—";
  let attendanceDetail = "No attendance records available";

  let latestResultValue = "—";
  let latestResultDetail = "No examination results available";

  let outstandingValue = "—";
  let outstandingDetail = "No fee records available";

  if (student) {
    const attendanceTotal = student.attendance.length;

    const presentOrLate = student.attendance.filter(
      (record) =>
        record.status === "PRESENT" || record.status === "LATE",
    ).length;

    if (attendanceTotal > 0) {
      attendanceValue = `${(
        (presentOrLate / attendanceTotal) *
        100
      ).toFixed(1)}%`;

      attendanceDetail = `${presentOrLate} present or late out of ${attendanceTotal} recorded days`;
    }

    const latestResult = student.results[0];

    if (latestResult) {
      const maxMarks = Number(latestResult.exam.maxMarks);
      const marks = Number(latestResult.marks);

      latestResultValue =
        maxMarks > 0 ? `${marks} / ${maxMarks}` : String(marks);

      latestResultDetail = latestResult.exam.title;
    }

    if (student.fees.length > 0) {
      const totalOutstanding = student.fees.reduce(
        (total, fee) =>
          total +
          Math.max(
            0,
            Number(fee.amount) - Number(fee.paidAmount),
          ),
        0,
      );

      outstandingValue = formatMoney(totalOutstanding);
      outstandingDetail = "Remaining balance across your fee records";
    }
  }

  return (
    <main className="students-page">
      <header className="students-heading">
        <div>
          <p className="students-eyebrow">EDUMANAGE PORTAL</p>
          <h1>Dashboard</h1>
          <p className="students-subtitle">
            Welcome back, {user.name}.
          </p>
        </div>

        <div className="students-count">
          <span>Your role</span>
          <strong>{roleLabels[user.role]}</strong>
        </div>
      </header>

      <section className="students-panel">
        <div className="students-form-heading">
          <p className="students-eyebrow">YOUR WORKSPACE</p>
          <h2>Welcome to EduManage</h2>
          <p>
            Choose a module below to access the features available to
            your account.
          </p>
        </div>

        <div className="dashboard-grid">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="dashboard-card"
            >
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <span>{item.action} →</span>
            </Link>
          ))}
        </div>
      </section>

      {user.role === "STUDENT" && (
        <section className="students-panel">
          <div className="students-form-heading">
            <p className="students-eyebrow">ACADEMIC OVERVIEW</p>
            <h2>My Academic Summary</h2>
            <p>
              A quick overview of your attendance, latest examination
              result and fee balance.
            </p>
          </div>

          {!student ? (
            <div role="status">
              <h3>Student profile not linked</h3>
              <p>
                Your account is active, but no student record is linked
                to it yet. Please contact your administrator to link
                your student profile.
              </p>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(190px, 1fr))",
                  gap: "16px",
                }}
              >
                <SummaryCard
                  label="Attendance"
                  value={attendanceValue}
                  detail={attendanceDetail}
                />

                <SummaryCard
                  label="Latest Exam Result"
                  value={latestResultValue}
                  detail={latestResultDetail}
                />

                <SummaryCard
                  label="Outstanding Fees"
                  value={outstandingValue}
                  detail={outstandingDetail}
                />
              </div>

              <div style={{ marginTop: 24 }}>
                <Link
                  href="/student-portal"
                  className="dashboard-card"
                  style={{
                    display: "block",
                    textDecoration: "none",
                  }}
                >
                  <h3>View Full Academic Records</h3>
                  <p>
                    Open your portal to see attendance history, all
                    available examination results, fee details and
                    your student profile.
                  </p>
                  <span>View my records →</span>
                </Link>
              </div>
            </>
          )}
        </section>
      )}

      {user.role !== "STUDENT" && (
        <section className="students-panel">
          <p className="students-eyebrow">YOUR WORKSPACE</p>
          <h2>
            {user.role === "ADMIN"
              ? "Administration"
              : "Teacher Workspace"}
          </h2>
          <p>
            {user.role === "ADMIN"
              ? "Use the management modules above to maintain student records, teacher accounts and class assignments."
              : "Use the student records module to access the records available to your account."}
          </p>
        </section>
      )}

      <form action="/api/auth/logout" method="POST">
        <button type="submit" className="students-button">
          Log Out
        </button>
      </form>
    </main>
  );
}

export default async function DashboardPage() {
  return <DashboardContent />;
}
