
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AttendanceManager from "./attendance-manager";

export const dynamic = "force-dynamic";

async function AttendanceContent() {
  const session = await getSession();

  if (!session?.userId) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.userId,
    },
    select: {
      id: true,
      name: true,
      role: true,
      active: true,
    },
  });

  if (!user || !user.active) {
    redirect("/");
  }

  if (user.role === "STUDENT") {
    redirect("/dashboard");
  }

  if (user.role !== "ADMIN" && user.role !== "TEACHER") {
    redirect("/dashboard");
  }

  return (
    <main className="attendance-page">
      <header className="attendance-header">
        <div>
          <Link href="/dashboard" className="back-link">
            ← Back to Dashboard
          </Link>

          <p className="eyebrow">EDUMANAGE · ACADEMIC MANAGEMENT</p>
          <h1>Attendance Management</h1>
          <p className="page-description">
            Mark daily attendance, update existing records, and review
            attendance history.
          </p>
        </div>

        <div className="user-chip">
          <span className="user-avatar">
            {(user.name || "U").trim().charAt(0).toUpperCase()}
          </span>
          <span>
            <strong>{user.name || "User"}</strong>
            <small>{user.role}</small>
          </span>
        </div>
      </header>

      <AttendanceManager />
    </main>
  );
}

export default function AttendancePage() {
  return (
    <Suspense
      fallback={
        <main className="attendance-page">
          <p>Loading attendance management...</p>
        </main>
      }
    >
      <AttendanceContent />
    </Suspense>
  );
}

/* Add these styles to the same file only if your project does not
   already provide global styling for this page. This is a reference;
   the component also includes its own styles. */
