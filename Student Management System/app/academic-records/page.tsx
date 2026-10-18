import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AcademicRecordsManager from "./academic-records-manager";

export const dynamic = "force-dynamic";

export default async function AcademicRecordsPage() {
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

  if (
    !user ||
    !user.active ||
    user.role !== session.role ||
    (user.role !== "ADMIN" && user.role !== "TEACHER")
  ) {
    redirect("/dashboard");
  }

  return (
    <main className="academic-page">
      <style>{`
        .academic-page {
          min-height: 100vh;
          padding: 32px 20px;
          background: #f3f5fb;
          color: #14213d;
          font-family: Arial, Helvetica, sans-serif;
        }

        .academic-container {
          max-width: 1250px;
          margin: 0 auto;
        }

        .academic-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 18px;
          margin-bottom: 28px;
        }

        .academic-header h1 {
          margin: 0;
          font-size: clamp(28px, 4vw, 38px);
        }

        .academic-header p {
          margin: 10px 0 0;
          color: #64748b;
          line-height: 1.6;
        }

        .academic-user {
          padding: 12px 16px;
          border: 1px solid #dce4f1;
          border-radius: 12px;
          background: white;
          color: #475569;
          font-size: 14px;
        }

        .academic-user strong {
          color: #4338ca;
        }

        .academic-back {
          display: inline-block;
          margin-bottom: 22px;
          color: #4338ca;
          font-weight: 700;
          text-decoration: none;
        }

        .academic-back:hover {
          text-decoration: underline;
        }
      `}</style>

      <div className="academic-container">
        <Link href="/administration" className="academic-back">
          ← Back to Administration
        </Link>

        <header className="academic-header">
          <div>
            <h1>Academic Records</h1>
            <p>
              Review student examination history, marks, percentages, and
              academic performance.
            </p>
          </div>

          <div className="academic-user">
            Signed in as <strong>{user.name}</strong> · {user.role}
          </div>
        </header>

        <AcademicRecordsManager />
      </div>
    </main>
  );
}