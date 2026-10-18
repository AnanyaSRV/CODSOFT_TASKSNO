import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "You must be signed in to reset a password." },
        { status: 401 },
      );
    }

    if (session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only administrators can reset passwords." },
        { status: 403 },
      );
    }

    const admin = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, role: true, active: true },
    });

    if (!admin || !admin.active || admin.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Administrator access is required." },
        { status: 403 },
      );
    }

    const { userId } = await context.params;
    if (!userId) {
      return NextResponse.json(
        { error: "A target user is required." },
        { status: 400 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400 },
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      !("password" in body) ||
      typeof body.password !== "string"
    ) {
      return NextResponse.json(
        { error: "A new password is required." },
        { status: 400 },
      );
    }

    const password = body.password;
    if (password.length < 12 || password.length > 128) {
      return NextResponse.json(
        { error: "Password must be between 12 and 128 characters." },
        { status: 400 },
      );
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!target || (target.role !== "TEACHER" && target.role !== "STUDENT")) {
      return NextResponse.json(
        { error: "Only existing Teacher or Student accounts can be reset here." },
        { status: 404 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: target.id },
      data: { passwordHash },
    });

    return NextResponse.json({
      message: "Password reset successfully.",
    });
  } catch (error) {
    console.error("Admin password reset failed:", error);
    return NextResponse.json(
      { error: "Unable to reset the password. Please try again." },
      { status: 500 },
    );
  }
}
