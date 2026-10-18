import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (
      !user ||
      !["ADMIN", "KITCHEN_STAFF"].includes(user.role)
    ) {
      return NextResponse.json(
        { error: "Staff access required." },
        { status: 403 },
      );
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Session verification failed:", error);

    return NextResponse.json(
      { error: "Could not verify the current session." },
      { status: 500 },
    );
  }
}