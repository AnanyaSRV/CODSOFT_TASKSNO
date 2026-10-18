
import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

type StaffAccessResult =
  | { user: { id: string; role: UserRole }; response: null }
  | { user: null; response: NextResponse };

export async function requireStaff(
  allowedRoles: UserRole[] = ["ADMIN", "KITCHEN_STAFF"],
): Promise<StaffAccessResult> {
  const session = await getSession();

  if (!session) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      ),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true },
  });

  if (!user || !allowedRoles.includes(user.role)) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "You do not have permission to perform this action." },
        { status: 403 },
      ),
    };
  }

  return { user, response: null };
}
