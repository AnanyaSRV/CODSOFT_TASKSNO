
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string | number;
  description: string;
}) {
  return (
    <article className="students-count">
      <span>{title}</span>
      <strong>{value}</strong>
      <p style={{ marginBottom: 0, marginTop: 8 }}>{description}</p>
    </article>
  );
}

const teacherModules = [
  {
    title: "Attendance",
    description: "Record and review daily student attendance.",
    href: "/attendance",
    action: "Open attendance",
  },
  {
    title: "Examinations & Results",
    description: "Review examinations and manage student results.",
    href: "/examinations",
    action: "Open examinations",
  },
  {
    title: "Student Records",
    description: "View student profiles and academic information.",
    href: "/students",
    action: "View students",
  },
  {
    title: "Academic Records",
    description: "Open the academic records section.",
    href: "/academic-records",
    action: "Open records",
  },
];

async function TeacherDashboardContent() {
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
      teacher: {
        select: {
          employeeNo: true,
          subject: true,
        },
      },
    },
  });

  if (!user || !user.active || user.role !== session.role) {
    redirect("/");
  }

  if (user.role !== "TEACHER") {
    redirect("/dashboard");
  }

  const assignments = await prisma.teacherAssignment.findMany({
    where: {
      teacher: {
        userId: user.id,
        user: {
          active: true,
        },
      },
    },
    select: {
      className: true,
      section: true,
    },
  });

  // Use exact class-section pairs, not separate class and section lists.
  // This prevents a teacher assigned to 10-A and 11-B from seeing
  // students from 10-B or 11-A.
  const assignedClassSections = assignments.map((assignment) => ({
    className: assignment.className,
    section: assignment.section,
  }));

  const studentWhere = {
    user: {
      is: {
        active: true,
      },
    },
    OR: assignedClassSections,
  };

  const assignedClassNames = Array.from(
    new Set(assignments.map((assignment) => assignment.className)),
  );

  const now = new Date();

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  const startOfTomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );

  const [
    totalStudents,
    attendanceToday,
    upcomingExams,
    recentResults,
    todayPresent,
    todayAbsent,
    todayLate,
  ] = await Promise.all([
    prisma.student.count({
      where: studentWhere,
    }),

    prisma.attendance.count({
      where: {
        date: {
          gte: startOfToday,
          lt: startOfTomorrow,
        },
        student: {
          is: studentWhere,
        },
      },
    }),

    // Exams have a className but no section field in the current schema.
    // Show exams for assigned class names.
    prisma.exam.findMany({
      where: {
        className: {
          in: assignedClassNames,
        },
        examDate: {
          gte: startOfToday,
        },
      },
      orderBy: { examDate: "asc" },
      take: 5,
      select: {
        id: true,
        title: true,
        subject: true,
        className: true,
        examDate: true,
        maxMarks: true,
      },
    }),

    // Only results belonging to students in the teacher's assignments.
    prisma.examResult.findMany({
      where: {
        student: {
          is: studentWhere,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        marks: true,
        updatedAt: true,
        student: {
          select: {
            user: {
              select: {
                name: true,
              },
            },
            className: true,
            section: true,
          },
        },
        exam: {
          select: {
            title: true,
            subject: true,
            maxMarks: true,
          },
        },
      },
    }),

    prisma.attendance.count({
      where: {
        date: {
          gte: startOfToday,
          lt: startOfTomorrow,
        },
        status: "PRESENT",
        student: {
          is: studentWhere,
        },
      },
    }),

    prisma.attendance.count({
      where: {
        date: {
          gte: startOfToday,
          lt: startOfTomorrow,
        },
        status: "ABSENT",
        student: {
          is: studentWhere,
        },
      },
    }),

    prisma.attendance.count({
      where: {
        date: {
          gte: startOfToday,
          lt: startOfTomorrow,
        },
        status: "LATE",
        student: {
          is: studentWhere,
        },
      },
    }),
  ]);

  return (
    <main className="students-page">
      <header className="students-heading">
        <div>
          <p className="students-eyebrow">
            EDUMANAGE · TEACHER WORKSPACE
          </p>
          <h1>Teacher Dashboard</h1>
          <p className="students-subtitle">
            Welcome back, {user.name}. Here is your academic overview.
          </p>
        </div>

        <div className="students-count">
          <span>Your role</span>
          <strong>Teacher</strong>
          <p style={{ marginBottom: 0, marginTop: 8 }}>
            {user.teacher?.subject || "Subject not configured"}
          </p>
        </div>
      </header>

      <section className="students-panel">
        <div className="students-form-heading">
          <p className="students-eyebrow">AT A GLANCE</p>
          <h2>Your teaching overview</h2>
          <p>
            Figures are limited to students in your assigned classes and
            sections.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 16,
          }}
        >
          <StatCard
            title="Total Students"
            value={totalStudents}
            description="Students in your assigned classes"
          />
          <StatCard
            title="Attendance Today"
            value={attendanceToday}
            description="Attendance entries for your students today"
          />
          <StatCard
            title="Upcoming Exams"
            value={upcomingExams.length}
            description="Upcoming exams shown below (maximum 5)"
          />
          <StatCard
            title="Recent Results"
            value={recentResults.length}
            description="Recently updated results for your students"
          />
        </div>

        {assignments.length === 0 && (
          <p role="status" style={{ marginTop: 16 }}>
            No classes or sections have been assigned to your account yet.
            Contact an administrator to receive your teaching assignments.
          </p>
        )}
      </section>

      <section className="students-panel">
        <div className="students-form-heading">
          <p className="students-eyebrow">QUICK ACTIONS</p>
          <h2>Teaching modules</h2>
          <p>Go directly to the tools you use during the school day.</p>
        </div>

        <div className="dashboard-grid">
          {teacherModules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="dashboard-card"
            >
              <h3>{module.title}</h3>
              <p>{module.description}</p>
              <span>{module.action} →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="students-panel">
        <div className="students-form-heading">
          <p className="students-eyebrow">ATTENDANCE</p>
          <h2>Today&apos;s attendance</h2>
          <p>Attendance entries for students in your assigned classes.</p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 16,
          }}
        >
          <StatCard
            title="Present"
            value={todayPresent}
            description="Marked present"
          />
          <StatCard
            title="Absent"
            value={todayAbsent}
            description="Marked absent"
          />
          <StatCard
            title="Late"
            value={todayLate}
            description="Marked late"
          />
        </div>

        {attendanceToday === 0 && (
          <p style={{ marginTop: 18 }}>
            No attendance entries have been recorded for your students today.
          </p>
        )}

        <div style={{ marginTop: 20 }}>
          <Link href="/attendance" className="dashboard-card">
            <h3>Open Attendance Register</h3>
            <p>Go to the attendance module to record or review entries.</p>
            <span>Manage attendance →</span>
          </Link>
        </div>
      </section>

      <section className="students-panel">
        <div className="students-form-heading">
          <p className="students-eyebrow">SCHEDULE</p>
          <h2>Upcoming examinations</h2>
          <p>
            Exams for classes to which you have been assigned.
          </p>
        </div>

        {upcomingExams.length === 0 ? (
          <p>No upcoming examinations are scheduled for your assigned classes.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {upcomingExams.map((exam) => (
              <article
                key={exam.id}
                className="dashboard-card"
                style={{ cursor: "default" }}
              >
                <h3>{exam.title}</h3>
                <p>
                  {exam.subject} · Class {exam.className}
                </p>
                <p>
                  Date: {formatDate(exam.examDate)} · Maximum marks:{" "}
                  {exam.maxMarks}
                </p>
              </article>
            ))}
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <Link href="/examinations" className="dashboard-card">
            <h3>Examinations & Results</h3>
            <p>Open the examinations module.</p>
            <span>View examinations →</span>
          </Link>
        </div>
      </section>

      <section className="students-panel">
        <div className="students-form-heading">
          <p className="students-eyebrow">RECENT ACTIVITY</p>
          <h2>Recently updated results</h2>
          <p>
            Only results for students in your assigned classes and sections
            are shown.
          </p>
        </div>

        {recentResults.length === 0 ? (
          <p>No examination results are available for your assigned students.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {recentResults.map((result) => (
              <article
                key={result.id}
                className="dashboard-card"
                style={{ cursor: "default" }}
              >
                <h3>{result.student.user.name}</h3>
                <p>
                  {result.exam.title} · {result.exam.subject}
                </p>
                <p>
                  Class {result.student.className} - Section{" "}
                  {result.student.section}
                </p>
                <p>
                  Marks: {result.marks.toString()} /{" "}
                  {result.exam.maxMarks.toString()}
                </p>
                <p>Updated: {formatDate(result.updatedAt)}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="students-panel">
        <div className="students-form-heading">
          <p className="students-eyebrow">YOUR PROFILE</p>
          <h2>Teacher information</h2>
        </div>

        <p>
          <strong>Name:</strong> {user.name}
        </p>
        <p>
          <strong>Email:</strong> {user.email}
        </p>
        <p>
          <strong>Employee number:</strong>{" "}
          {user.teacher?.employeeNo || "Not configured"}
        </p>
        <p>
          <strong>Subject:</strong>{" "}
          {user.teacher?.subject || "Not configured"}
        </p>

        {!user.teacher && (
          <p role="status">
            Your Teacher account does not have a linked teacher profile yet.
            Contact an administrator to complete your staff record.
          </p>
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

export default async function TeacherDashboardPage() {
  return <TeacherDashboardContent />;
}
