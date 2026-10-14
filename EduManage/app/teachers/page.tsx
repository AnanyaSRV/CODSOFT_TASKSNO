
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import TeachersManager from "./teachers-manager";

export default async function TeachersPage() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  if (session.role === "STUDENT") {
    redirect("/dashboard");
  }

  return <TeachersManager canManage={session.role === "ADMIN"} />;
}
