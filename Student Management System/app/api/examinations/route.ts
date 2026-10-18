
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthorizedUser } from "@/lib/auth";

const examSchema = z.object({
  title: z.string().trim().min(2, "Exam title must be at least 2 characters."),
  subject: z.string().trim().min(1, "Subject is required."),
  className: z.string().trim().min(1, "Class is required."),
  examDate: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Enter a valid exam date.",
  ),
  maxMarks: z.number().finite().positive(
    "Maximum marks must be greater than zero.",
  ),
});

function isValidDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export async function GET() {
  try {
    const user = await getAuthorizedUser(["ADMIN", "TEACHER"]);

    if (!user) {
      return NextResponse.json(
        { error: "Please log in with an authorized account." },
        { status: 401 },
      );
    }

    const isTeacher = user.role === "TEACHER";

    const assignments = isTeacher
      ? await prisma.teacherAssignment.findMany({
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
      : [];

    const assignedClassNames = Array.from(
      new Set(assignments.map((assignment) => assignment.className)),
    );

    const assignedClassSections = assignments.map((assignment) => ({
      className: assignment.className,
      section: assignment.section,
    }));

    const exams = await prisma.exam.findMany({
      where: isTeacher
        ? {
            // Exams have a class field, but no section field.
            // An unassigned teacher receives no exams.
            className: {
              in: assignedClassNames,
            },
          }
        : undefined,
      orderBy: { examDate: "desc" },
      include: {
        results: {
          where: isTeacher
            ? {
                student: {
                  is: {
                    OR: assignedClassSections,
                  },
                },
              }
            : undefined,
          orderBy: { createdAt: "desc" },
          include: {
            student: {
              include: {
                user: {
                  select: {
                    name: true,
                    email: true,
                    active: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ exams });
  } catch (error) {
    console.error("Fetch examinations failed:", error);

    return NextResponse.json(
      { error: "Unable to load examinations." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthorizedUser(["ADMIN"]);

    if (!user) {
      return NextResponse.json(
        { error: "Only active administrators can create examinations." },
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

    const parsed = examSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Invalid examination details.",
        },
        { status: 400 },
      );
    }

    const data = parsed.data;

    if (!isValidDate(data.examDate)) {
      return NextResponse.json(
        { error: "Enter a valid exam date." },
        { status: 400 },
      );
    }

    const exam = await prisma.exam.create({
      data: {
        title: data.title,
        subject: data.subject,
        className: data.className,
        examDate: new Date(`${data.examDate}T00:00:00.000Z`),
        maxMarks: data.maxMarks,
      },
    });

    return NextResponse.json(
      {
        message: "Examination created successfully.",
        exam,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create examination failed:", error);

    return NextResponse.json(
      { error: "Unable to create the examination. Please try again." },
      { status: 500 },
    );
  }
}
