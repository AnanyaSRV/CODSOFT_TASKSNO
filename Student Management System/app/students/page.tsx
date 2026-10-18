
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import StudentsManager from "./students-manager";

async function StudentsContent() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  if (!["ADMIN", "TEACHER"].includes(session.role)) {
    redirect("/dashboard");
  }

  return (
    <StudentsManager canManage={session.role === "ADMIN"} />
  );
}

export default function StudentsPage() {
  return (
    <Suspense fallback={<main className="dashboard-page"><p>Loading students...</p></main>}>
      <StudentsContent />
    </Suspense>
  );
}
