
import { redirect } from "next/navigation";
import { getAuthorizedUser } from "@/lib/auth";
import TeacherAssignmentsManager from "./components/TeacherAssignmentsManager";

export const dynamic = "force-dynamic";

export default async function TeacherAssignmentsPage() {
  const user = await getAuthorizedUser(["ADMIN"]);

  if (!user) {
    redirect("/dashboard");
  }

  return <TeacherAssignmentsManager />;
}
