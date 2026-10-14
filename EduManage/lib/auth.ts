
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export type UserRole = "ADMIN" | "TEACHER" | "STUDENT";

export type SessionPayload = {
  userId: string;
  role: UserRole;
};

export type AuthorizedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
};

export async function getSession(): Promise<SessionPayload | null> {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    return null;
  }

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("edumanage-session")?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      { algorithms: ["HS256"] }
    );

    const userId = payload.sub;
    const role = payload.role;

    if (
      typeof userId !== "string" ||
      (role !== "ADMIN" &&
        role !== "TEACHER" &&
        role !== "STUDENT")
    ) {
      return null;
    }

    return { userId, role };
  } catch {
    return null;
  }
}

/**
 * Validates the session against the current database account.
 * Rejects inactive accounts and sessions with outdated roles.
 * Optionally restricts access to specific roles.
 */
export async function getAuthorizedUser(
  allowedRoles?: readonly UserRole[]
): Promise<AuthorizedUser | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
      },
    });

    if (
      !user ||
      !user.active ||
      user.role !== session.role
    ) {
      return null;
    }

    if (
      allowedRoles &&
      !allowedRoles.includes(user.role)
    ) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}
