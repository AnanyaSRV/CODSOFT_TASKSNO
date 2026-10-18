
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password =
      typeof body.password === "string" ? body.password : "";

    if (!email || !password || password.length > 128) {
      return NextResponse.json(
        { error: "Enter a valid email and password." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash,
    );

    if (
      !passwordMatches ||
      (user.role !== "ADMIN" && user.role !== "KITCHEN_STAFF")
    ) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    await createSession(user.id, user.role);

    return NextResponse.json({
      message: "Login successful.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Staff login error:", error);

    return NextResponse.json(
      { error: "Unable to sign in right now." },
      { status: 500 },
    );
  }
}
