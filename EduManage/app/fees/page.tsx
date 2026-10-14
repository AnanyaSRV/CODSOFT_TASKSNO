import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import FeesManager from "./fees-manager";

export const dynamic = "force-dynamic";

export default async function FeesPage() {
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
    <main className="fees-page">
      <style>{`
        .fees-page {
          min-height: 100vh;
          padding: 32px 20px;
          background: #f3f5fb;
          color: #14213d;
          font-family: Arial, Helvetica, sans-serif;
        }

        .fees-container {
          max-width: 1250px;
          margin: 0 auto;
        }

        .fees-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 18px;
          margin-bottom: 28px;
        }

        .fees-header h1 {
          margin: 0;
          font-size: clamp(28px, 4vw, 38px);
        }

        .fees-header p {
          margin: 10px 0 0;
          color: #64748b;
          line-height: 1.6;
        }

        .fees-user {
          padding: 12px 16px;
          border: 1px solid #dce4f1;
          border-radius: 12px;
          background: white;
          color: #475569;
          font-size: 14px;
        }

        .fees-user strong {
          color: #4338ca;
        }

        .fees-back {
          display: inline-block;
          margin-bottom: 22px;
          color: #4338ca;
          font-weight: 700;
          text-decoration: none;
        }

        .fees-back:hover {
          text-decoration: underline;
        }
      `}</style>

      <div className="fees-container">
        <Link href="/administration" className="fees-back">
          ← Back to Administration
        </Link>

        <header className="fees-header">
          <div>
            <h1>Fees Management</h1>
            <p>
              Manage student fees, track payments, and review outstanding
              balances.
            </p>
          </div>

          <div className="fees-user">
            Signed in as <strong>{user.name}</strong> · {user.role}
          </div>
        </header>

        <FeesManager canManage={user.role === "ADMIN"} />
      </div>
    </main>
  );
}