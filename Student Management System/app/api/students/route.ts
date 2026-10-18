
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthorizedUser } from "@/lib/auth";

const studentSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(12, "Password must be at least 12 characters"),
  admissionNo: z.string().trim().min(1, "Admission number is required"),
  className: z.string().trim().min(1, "Class is required"),
  section: z.string().trim().min(1).default("A"),
  dateOfBirth: z.string().optional(),
  guardianName: z.string().trim().optional(),
  guardianPhone: z.string().trim().optional(),
  address: z.string().trim().optional(),
});

export async function GET() {
  try {
    const user = await getAuthorizedUser(["ADMIN", "TEACHER"]);

    if (!user) {
      return NextResponse.json(
        { error: "Please log in with an authorized account." },
        { status: 401 },
      );
    }

    // Administrators can view every student.
    // Teachers can view students only in their assigned classes and sections.
    const where =
      user.role === "ADMIN"
        ? {}
        : {
            OR: (
              await prisma.teacherAssignment.findMany({
                where: {
                  teacher: {
                    userId: user.id,
                    user: {
                      active: true,
                    },
                  },
                },
                select: {
                  className: true,
                  section: true,
                },
              })
            ).map((assignment) => ({
              className: assignment.className,
              section: assignment.section,
            })),
          };

    const students = await prisma.student.findMany({
      where,
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

    return NextResponse.json({ students });
  } catch (error) {
    console.error("Fetch students failed:", error);

    return NextResponse.json(
      { error: "Unable to load students." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthorizedUser(["ADMIN"]);

    if (!user) {
      return NextResponse.json(
        { error: "Only active administrators can create students." },
        { status: 403 },
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const parsed = studentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Invalid student details.",
        },
        { status: 400 },
      );
    }

    const data = parsed.data;

    if (data.dateOfBirth) {
      const date = new Date(`${data.dateOfBirth}T00:00:00.000Z`);

      if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== data.dateOfBirth
      ) {
        return NextResponse.json(
          { error: "Enter a valid date of birth." },
          { status: 400 },
        );
      }
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    const existingAdmission = await prisma.student.findUnique({
      where: { admissionNo: data.admissionNo },
      select: { id: true },
    });

    if (existingAdmission) {
      return NextResponse.json(
        { error: "This admission number is already in use." },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const student = await prisma.$transaction(
      async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            name: data.name,
            email: data.email,
            passwordHash,
            role: "STUDENT",
            active: true,
          },
        });

        return tx.student.create({
          data: {
            admissionNo: data.admissionNo,
            className: data.className,
            section: data.section,
            dateOfBirth: data.dateOfBirth
              ? new Date(`${data.dateOfBirth}T00:00:00.000Z`)
              : undefined,
            guardianName: data.guardianName || undefined,
            guardianPhone: data.guardianPhone || undefined,
            address: data.address || undefined,
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
      },
    );

    return NextResponse.json(
      {
        message: "Student created successfully.",
        student,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("Create student failed:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "The email or admission number is already in use." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Unable to create the student. Please try again." },
      { status: 500 },
    );
  }
}
