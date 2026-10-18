
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthorizedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const createAssignmentSchema = z.object({
  teacherId: z.string().trim().min(1, "Select a teacher."),
  className: z.string().trim().min(1, "Class is required.").max(50),
  section: z.string().trim().min(1, "Section is required.").max(20),
});

const deleteAssignmentSchema = z.object({
  assignmentId: z.string().trim().min(1, "Assignment ID is required."),
});

export async function GET() {
  try {
    const user = await getAuthorizedUser(["ADMIN"]);

    if (!user) {
      return NextResponse.json(
        { error: "Only active administrators can view teacher assignments." },
        { status: 403 }
      );
    }

    const [teachers, assignments] = await Promise.all([
      prisma.teacher.findMany({
        where: {
          user: { active: true, role: "TEACHER" },
        },
        select: {
          id: true,
          employeeNo: true,
          subject: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { user: { name: "asc" } },
      }),
      prisma.teacherAssignment.findMany({
        include: {
          teacher: {
            select: {
              id: true,
              employeeNo: true,
              subject: true,
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
        orderBy: [
          { className: "asc" },
          { section: "asc" },
          { createdAt: "desc" },
        ],
      }),
    ]);

    return NextResponse.json({ teachers, assignments });
  } catch (error) {
    console.error("Fetch teacher assignments failed:", error);

    return NextResponse.json(
      { error: "Unable to load teacher assignments." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthorizedUser(["ADMIN"]);

    if (!user) {
      return NextResponse.json(
        { error: "Only active administrators can assign teachers." },
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

    const parsed = createAssignmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid assignment." },
        { status: 400 }
      );
    }

    const data = {
      teacherId: parsed.data.teacherId,
      className: parsed.data.className.trim(),
      section: parsed.data.section.trim(),
    };

    const teacher = await prisma.teacher.findFirst({
      where: {
        id: data.teacherId,
        user: { active: true, role: "TEACHER" },
      },
      select: { id: true },
    });

    if (!teacher) {
      return NextResponse.json(
        { error: "The selected teacher does not exist or is inactive." },
        { status: 404 }
      );
    }

    const existing = await prisma.teacherAssignment.findUnique({
      where: {
        teacherId_className_section: {
          teacherId: data.teacherId,
          className: data.className,
          section: data.section,
        },
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "This teacher is already assigned to that class and section." },
        { status: 409 }
      );
    }

    const assignment = await prisma.teacherAssignment.create({
      data,
      include: {
        teacher: {
          select: {
            id: true,
            employeeNo: true,
            subject: true,
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

    return NextResponse.json(
      {
        message: "Teacher assigned successfully.",
        assignment,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create teacher assignment failed:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "This teacher is already assigned to that class and section." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Unable to create the assignment. Please try again." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthorizedUser(["ADMIN"]);

    if (!user) {
      return NextResponse.json(
        { error: "Only active administrators can remove assignments." },
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

    const parsed = deleteAssignmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid assignment ID." },
        { status: 400 }
      );
    }

    const result = await prisma.teacherAssignment.deleteMany({
      where: { id: parsed.data.assignmentId },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Assignment not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Teacher assignment removed successfully.",
    });
  } catch (error) {
    console.error("Delete teacher assignment failed:", error);

    return NextResponse.json(
      { error: "Unable to remove the assignment. Please try again." },
      { status: 500 }
    );
  }
}
