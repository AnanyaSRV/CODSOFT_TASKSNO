import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExaminationsManager from "./examinations-manager";

export const dynamic = "force-dynamic";

async function ExaminationsContent() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      name: true,
      role: true,
      active: true,
    },
  });

  if (!user || !user.active || user.role !== session.role) {
    redirect("/");
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
          <h1>Examinations & Results</h1>
          <p className="page-description">
            Create examinations, record student marks, and review academic results.
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

      <ExaminationsManager canManage={user.role === "ADMIN"} />
    </main>
  );
}

export default function ExaminationsPage() {
  return (
    <Suspense
      fallback={
        <main className="attendance-page">
          <p>Loading examinations...</p>
        </main>
      }
    >
      <ExaminationsContent />
    </Suspense>
  );
}