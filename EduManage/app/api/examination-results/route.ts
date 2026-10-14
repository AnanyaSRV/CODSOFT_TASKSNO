
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthorizedUser } from "@/lib/auth";

const resultSchema = z.object({
  examId: z.string().trim().min(1, "Select an examination."),
  studentId: z.string().trim().min(1, "Select a student."),
  marks: z.number().finite().min(0, "Marks cannot be negative."),
  remarks: z
    .string()
    .trim()
    .max(500, "Remarks cannot exceed 500 characters.")
    .optional(),
});

export async function GET(request: Request) {
  try {
    const user = await getAuthorizedUser(["ADMIN"]);

    if (!user) {
      return NextResponse.json(
        { error: "Only active administrators can view examination results." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get("examId");

    if (!examId) {
      return NextResponse.json(
        { error: "An examination ID is required." },
        { status: 400 }
      );
    }

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true },
    });

    if (!exam) {
      return NextResponse.json(
        { error: "Examination not found." },
        { status: 404 }
      );
    }

    const results = await prisma.examResult.findMany({
      where: { examId },
      orderBy: {
        student: {
          admissionNo: "asc",
        },
      },
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
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Fetch examination results failed:", error);

    return NextResponse.json(
      { error: "Unable to load examination results." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthorizedUser(["ADMIN"]);

    if (!user) {
      return NextResponse.json(
        { error: "Only active administrators can manage examination results." },
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

    const parsed = resultSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Invalid examination result details.",
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const [exam, student] = await Promise.all([
      prisma.exam.findUnique({
        where: { id: data.examId },
      }),
      prisma.student.findUnique({
        where: { id: data.studentId },
        include: {
          user: {
            select: { active: true },
          },
        },
      }),
    ]);

    if (!exam) {
      return NextResponse.json(
        { error: "Examination not found." },
        { status: 404 }
      );
    }

    if (!student || !student.user.active) {
      return NextResponse.json(
        { error: "Active student not found." },
        { status: 404 }
      );
    }

    if (student.className !== exam.className) {
      return NextResponse.json(
        {
          error:
            "The selected student does not belong to this examination's class.",
        },
        { status: 400 }
      );
    }

    if (data.marks > exam.maxMarks) {
      return NextResponse.json(
        {
          error: `Marks cannot exceed the maximum of ${exam.maxMarks}.`,
        },
        { status: 400 }
      );
    }

    const result = await prisma.examResult.upsert({
      where: {
        examId_studentId: {
          examId: data.examId,
          studentId: data.studentId,
        },
      },
      create: {
        examId: data.examId,
        studentId: data.studentId,
        marks: data.marks,
        remarks: data.remarks || null,
      },
      update: {
        marks: data.marks,
        remarks: data.remarks || null,
      },
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
    });

    return NextResponse.json({
      message: "Examination result saved successfully.",
      result,
    });
  } catch (error) {
    console.error("Save examination result failed:", error);

    return NextResponse.json(
      { error: "Unable to save the examination result. Please try again." },
      { status: 500 }
    );
  }
}
