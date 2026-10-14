
import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";


export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter a valid email address and password." },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.active) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const secret = process.env.SESSION_SECRET;

    if (!secret || secret.length < 32) {
      console.error("SESSION_SECRET is missing or too short.");

      return NextResponse.json(
        { error: "Authentication is not configured." },
        { status: 500 }
      );
    }

    const token = await new SignJWT({
      role: user.role,
      name: user.name,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(new TextEncoder().encode(secret));

    const response = NextResponse.json({
      success: true,
      role: user.role,
    });

    response.cookies.set("edumanage-session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      { error: "Unable to sign in. Please try again." },
      { status: 500 }
    );
  }
}
