
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthorizedUser } from "@/lib/auth";

const teacherSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(12, "Password must be at least 12 characters"),
  employeeNo: z.string().trim().min(1, "Employee number is required"),
  subject: z.string().trim().min(1, "Subject is required"),
  phone: z.string().trim().optional(),
});

export async function GET() {
  try {
    const user = await getAuthorizedUser(["ADMIN", "TEACHER"]);

    if (!user) {
      return NextResponse.json(
        { error: "Please log in with an authorized account." },
        { status: 401 }
      );
    }

    const teachers = await prisma.teacher.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            active: true,
          },
        },
      },
    });

    return NextResponse.json({ teachers });
  } catch (error) {
    console.error("Fetch teachers failed:", error);

    return NextResponse.json(
      { error: "Unable to load teachers." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthorizedUser(["ADMIN"]);

    if (!user) {
      return NextResponse.json(
        { error: "Only active administrators can create teachers." },
        { status: 403 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const parsed = teacherSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ?? "Invalid teacher details.",
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const existingTeacher = await prisma.teacher.findUnique({
      where: { employeeNo: data.employeeNo },
      select: { id: true },
    });

    if (existingTeacher) {
      return NextResponse.json(
        { error: "This employee number is already in use." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const teacher = await prisma.$transaction(
      async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            name: data.name,
            email: data.email,
            passwordHash,
            role: "TEACHER",
            active: true,
          },
        });

        return tx.teacher.create({
          data: {
            employeeNo: data.employeeNo,
            subject: data.subject,
            phone: data.phone || undefined,
            userId: createdUser.id,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                active: true,
              },
            },
          },
        });
      },
      {
        maxWait: 15000,
        timeout: 20000,
      }
    );

    return NextResponse.json(
      { message: "Teacher created successfully.", teacher },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Create teacher failed:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "The email or employee number is already in use." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Unable to create the teacher. Please try again." },
      { status: 500 }
    );
  }
}
