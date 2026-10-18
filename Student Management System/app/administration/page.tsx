
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthorizedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdministrationPage() {
  const user = await getAuthorizedUser(["ADMIN"]);

  if (!user) {
    redirect("/dashboard");
  }

  return (
    <main className="administration-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .administration-page {
          min-height: 100vh;
          padding: 40px 24px;
          background: #f3f5fb;
          color: #14213d;
          font-family: Arial, Helvetica, sans-serif;
        }

        .administration-container {
          width: 100%;
          max-width: 1180px;
          margin: 0 auto;
        }

        .administration-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 20px;
          margin-bottom: 28px;
        }

        .administration-eyebrow {
          margin: 0 0 10px;
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .administration-header h1 {
          margin: 0;
          font-size: clamp(28px, 4vw, 38px);
          line-height: 1.2;
        }

        .administration-subtitle {
          margin: 12px 0 0;
          color: #64748b;
          font-size: 16px;
          line-height: 1.7;
        }

        .administration-user {
          padding: 12px 16px;
          border: 1px solid #dce4f1;
          border-radius: 12px;
          background: #ffffff;
          color: #334155;
          font-size: 14px;
        }

        .administration-user strong {
          color: #4338ca;
        }

        .administration-panel {
          margin-bottom: 28px;
          padding: 32px;
          border: 1px solid #dce4f1;
          border-radius: 24px;
          background: #ffffff;
          box-shadow: 0 12px 35px rgba(15, 23, 42, 0.04);
        }

        .administration-section-label {
          margin: 0 0 10px;
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .administration-panel h2 {
          margin: 0;
          color: #14213d;
          font-size: 28px;
          line-height: 1.3;
        }

        .administration-description {
          margin: 10px 0 0;
          color: #64748b;
          font-size: 17px;
          line-height: 1.7;
        }

        .administration-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 20px;
          margin-top: 28px;
        }

        .administration-card {
          display: flex;
          min-height: 190px;
          flex-direction: column;
          align-items: flex-start;
          padding: 25px;
          border: 1px solid #dce4f1;
          border-radius: 20px;
          background: #f8fafc;
          color: inherit;
          text-decoration: none;
          transition:
            transform 160ms ease,
            border-color 160ms ease,
            box-shadow 160ms ease,
            background 160ms ease;
        }

        a.administration-card:hover,
        a.administration-card:focus-visible {
          transform: translateY(-3px);
          border-color: #818cf8;
          background: #ffffff;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.07);
          outline: none;
        }

        .administration-card h3 {
          margin: 0;
          color: #14213d;
          font-size: 22px;
          line-height: 1.4;
        }

        .administration-card p {
          margin: 12px 0 20px;
          color: #64748b;
          font-size: 16px;
          line-height: 1.7;
        }

        .administration-card-action {
          margin-top: auto;
          color: #4f46e5;
          font-size: 15px;
          font-weight: 700;
        }

        .administration-back {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
          padding: 12px 18px;
          border: 1px solid #dce4f1;
          border-radius: 12px;
          color: #4338ca;
          font-weight: 700;
          text-decoration: none;
          background: #ffffff;
        }

        .administration-back:hover {
          background: #eef2ff;
        }

        @media (max-width: 900px) {
          .administration-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .administration-panel {
            padding: 24px;
          }
        }

        @media (max-width: 600px) {
          .administration-page {
            padding: 24px 14px;
          }

          .administration-grid {
            grid-template-columns: 1fr;
          }

          .administration-panel {
            padding: 22px;
            border-radius: 18px;
          }

          .administration-card {
            min-height: 170px;
          }
        }
      `}</style>

      <div className="administration-container">
        <header className="administration-header">
          <div>
            <p className="administration-eyebrow">
              EduManage Administration
            </p>

            <h1>Administration</h1>

            <p className="administration-subtitle">
              Manage the academic and operational modules of your institution.
            </p>
          </div>

          <div className="administration-user">
            Signed in as <strong>{user.name}</strong> · {user.role}
          </div>
        </header>

        <section className="administration-panel">
          <p className="administration-section-label">
            Available Modules
          </p>

          <h2>Manage Your Institution</h2>

          <p className="administration-description">
            Open an available module to manage its information and workflows.
          </p>

          <div className="administration-grid">
            <Link href="/students" className="administration-card">
              <h3>Students</h3>
              <p>
                View and manage student profiles, admissions, and class
                information.
              </p>
              <span className="administration-card-action">
                Open Students →
              </span>
            </Link>

            <Link href="/teachers" className="administration-card">
              <h3>Teachers</h3>
              <p>
                Manage teacher profiles, employee information, and subjects.
              </p>
              <span className="administration-card-action">
                Open Teachers →
              </span>
            </Link>

            <Link
              href="/teacher-assignments"
              className="administration-card"
            >
              <h3>Teacher Assignments</h3>
              <p>
                Assign teachers to classes and sections, view existing
                assignments, and remove assignments when needed.
              </p>
              <span className="administration-card-action">
                Manage Assignments →
              </span>
            </Link>

            <Link href="/attendance" className="administration-card">
              <h3>Attendance</h3>
              <p>
                Record and review student attendance by date and class.
              </p>
              <span className="administration-card-action">
                Open Attendance →
              </span>
            </Link>
          </div>
        </section>

        <section className="administration-panel">
          <p className="administration-section-label">
            Academic Services
          </p>

          <h2>Additional Academic Services</h2>

          <p className="administration-description">
            Access examinations, fees, and academic performance records.
          </p>

          <div className="administration-grid">
            <Link href="/examinations" className="administration-card">
              <h3>Examinations</h3>
              <p>
                Create examinations, enter student marks, and manage results.
              </p>
              <span className="administration-card-action">
                Open Examinations →
              </span>
            </Link>

            <Link href="/fees" className="administration-card">
              <h3>Fees</h3>
              <p>
                Manage fee records, payments, due dates, and outstanding
                balances.
              </p>
              <span className="administration-card-action">
                Open Fees Management →
              </span>
            </Link>

            <Link
              href="/academic-records"
              className="administration-card"
            >
              <h3>Academic Records</h3>
              <p>
                Review student examination history, marks, percentages,
                grades, and academic performance.
              </p>
              <span className="administration-card-action">
                Open Academic Records →
              </span>
            </Link>
          </div>
        </section>

        <Link href="/dashboard" className="administration-back">
          ← Back to Dashboard
        </Link>
      </div>
    </main>
  );
}
