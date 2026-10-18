
import { NextRequest, NextResponse } from "next/server";
import { AttendanceStatus } from "@/app/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES = new Set<string>(Object.values(AttendanceStatus));

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

type AuthorizationResult =
  | {
      error: string;
      status: 401 | 403;
      user?: never;
    }
  | {
      user: {
        id: string;
        role: "ADMIN" | "TEACHER";
        active: boolean;
      };
      error?: never;
      status?: never;
    };

function isAuthorizationError(
  result: AuthorizationResult,
): result is Extract<AuthorizationResult, { error: string }> {
  return typeof result.error === "string";
}

function isValidRole(role: string): role is "ADMIN" | "TEACHER" {
  return role === "ADMIN" || role === "TEACHER";
}

function parseDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return date;
}

async function getAuthorizedUser(): Promise<AuthorizationResult> {
  const session = await getSession();

  if (!session?.userId) {
    return {
      error: "You must sign in to continue.",
      status: 401,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      role: true,
      active: true,
    },
  });

  if (!user || !user.active || user.role !== session.role) {
    return {
      error: "Your session is no longer valid.",
      status: 401,
    };
  }

  if (!isValidRole(user.role)) {
    return {
      error:
        "Only administrators and teachers can access attendance management.",
      status: 403,
    };
  }

  return {
    user: {
      id: user.id,
      role: user.role,
      active: user.active,
    },
  };
}

async function getTeacherAssignments(userId: string) {
  return prisma.teacherAssignment.findMany({
    where: {
      teacher: {
        userId,
        user: {
          active: true,
        },
      },
    },
    select: {
      className: true,
      section: true,
    },
  });
}

function isAssignedClass(
  className: string,
  section: string,
  assignments: { className: string; section: string }[],
) {
  return assignments.some(
    (assignment) =>
      assignment.className === className &&
      assignment.section === section,
  );
}

// GET /api/attendance?date=YYYY-MM-DD&className=...&section=...
// GET /api/attendance?view=history&startDate=...&endDate=...&status=...
export async function GET(request: NextRequest) {
  try {
    const authorization = await getAuthorizedUser();

    if (isAuthorizationError(authorization)) {
      return jsonError(authorization.error, authorization.status);
    }

    const { user } = authorization;
    const params = request.nextUrl.searchParams;
    const view = params.get("view");

    const assignments =
      user.role === "TEACHER"
        ? await getTeacherAssignments(user.id)
        : [];

    // Teachers are limited to assigned class-section pairs.
    // An empty assignment list intentionally returns no student records.
    const assignmentFilter =
      user.role === "TEACHER"
        ? {
            OR: assignments.map((assignment) => ({
              className: assignment.className,
              section: assignment.section,
            })),
          }
        : {};

    if (view === "history") {
      const startValue = params.get("startDate");
      const endValue = params.get("endDate");
      const status = params.get("status");
      const className = params.get("className")?.trim();
      const section = params.get("section")?.trim();
      const search = params.get("search")?.trim();

      const startDate = startValue ? parseDate(startValue) : null;
      const endDate = endValue ? parseDate(endValue) : null;

      if (startValue && !startDate) {
        return jsonError("The start date is invalid.", 400);
      }

      if (endValue && !endDate) {
        return jsonError("The end date is invalid.", 400);
      }

      if (startDate && endDate && startDate > endDate) {
        return jsonError(
          "The start date must not be after the end date.",
          400,
        );
      }

      if (status && status !== "ALL" && !VALID_STATUSES.has(status)) {
        return jsonError("The attendance status is invalid.", 400);
      }

      const records = await prisma.attendance.findMany({
        where: {
          ...(startDate || endDate
            ? {
                date: {
                  ...(startDate ? { gte: startDate } : {}),
                  ...(endDate ? { lte: endDate } : {}),
                },
              }
            : {}),
          ...(status && status !== "ALL"
            ? { status: status as AttendanceStatus }
            : {}),
          student: {
            is: {
              ...(className ? { className } : {}),
              ...(section ? { section } : {}),
              ...(user.role === "TEACHER" ? assignmentFilter : {}),
              ...(search
                ? {
                    OR: [
                      {
                        user: {
                          is: {
                            name: {
                              contains: search,
                              mode: "insensitive" as const,
                            },
                          },
                        },
                      },
                      {
                        admissionNo: {
                          contains: search,
                          mode: "insensitive" as const,
                        },
                      },
                    ],
                  }
                : {}),
            },
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
        orderBy: [
          { date: "desc" },
          { student: { className: "asc" } },
          { student: { section: "asc" } },
        ],
        take: 1000,
      });

      return NextResponse.json({ history: records });
    }

    const dateValue = params.get("date");
    const date = parseDate(dateValue);

    if (!date) {
      return jsonError(
        "Provide a valid date in YYYY-MM-DD format.",
        400,
      );
    }

    const className = params.get("className")?.trim();
    const section = params.get("section")?.trim();

    const studentWhere = {
      user: {
        is: { active: true },
      },
      ...(className ? { className } : {}),
      ...(section ? { section } : {}),
      ...(user.role === "TEACHER" ? assignmentFilter : {}),
    };

    const students = await prisma.student.findMany({
      where: studentWhere,
      select: {
        id: true,
        admissionNo: true,
        className: true,
        section: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        attendance: {
          where: { date },
          select: {
            id: true,
            status: true,
            remarks: true,
          },
          take: 1,
        },
      },
      orderBy: [
        { className: "asc" },
        { section: "asc" },
        { user: { name: "asc" } },
      ],
    });

    const records = students.map((student) => ({
      id: student.id,
      admissionNo: student.admissionNo,
      className: student.className,
      section: student.section,
      name: student.user.name,
      email: student.user.email,
      attendance: student.attendance[0] ?? null,
    }));

    // Return only the classes and sections the current user may access.
    const classes = await prisma.student.findMany({
      where: studentWhere,
      select: {
        className: true,
        section: true,
      },
      distinct: ["className", "section"],
      orderBy: [{ className: "asc" }, { section: "asc" }],
    });

    const uniqueClasses = Array.from(
      new Set(classes.map((item) => item.className)),
    );

    const uniqueSections = Array.from(
      new Set(classes.map((item) => item.section)),
    );

    return NextResponse.json({
      students: records,
      classes: uniqueClasses,
      sections: uniqueSections,
    });
  } catch (error) {
    console.error("Attendance GET error:", error);
    return jsonError("Could not load attendance records.", 500);
  }
}

// POST /api/attendance
// Body: { date: "YYYY-MM-DD", records: [{ studentId, status, remarks }] }
export async function POST(request: NextRequest) {
  try {
    const authorization = await getAuthorizedUser();

    if (isAuthorizationError(authorization)) {
      return jsonError(authorization.error, authorization.status);
    }

    const { user } = authorization;

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError("Request body must contain valid JSON.", 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("Invalid request body.", 400);
    }

    const input = body as {
      date?: unknown;
      records?: unknown;
    };

    if (typeof input.date !== "string") {
      return jsonError("A valid attendance date is required.", 400);
    }

    const date = parseDate(input.date);

    if (!date) {
      return jsonError("The attendance date is invalid.", 400);
    }

    if (!Array.isArray(input.records) || input.records.length === 0) {
      return jsonError(
        "At least one attendance record is required.",
        400,
      );
    }

    if (input.records.length > 500) {
      return jsonError(
        "Save attendance in batches of at most 500 students.",
        400,
      );
    }

    const seenStudentIds = new Set<string>();

    const records: {
      studentId: string;
      status: AttendanceStatus;
      remarks: string | null;
    }[] = [];

    for (const item of input.records) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return jsonError("An attendance record is invalid.", 400);
      }

      const record = item as {
        studentId?: unknown;
        status?: unknown;
        remarks?: unknown;
      };

      if (
        typeof record.studentId !== "string" ||
        !record.studentId.trim()
      ) {
        return jsonError(
          "Every record must have a student ID.",
          400,
        );
      }

      const studentId = record.studentId.trim();

      if (seenStudentIds.has(studentId)) {
        return jsonError(
          "A student appears more than once in this request.",
          400,
        );
      }

      seenStudentIds.add(studentId);

      if (
        typeof record.status !== "string" ||
        !VALID_STATUSES.has(record.status)
      ) {
        return jsonError(
          `Invalid attendance status for student ${studentId}.`,
          400,
        );
      }

      if (
        record.remarks !== undefined &&
        record.remarks !== null &&
        typeof record.remarks !== "string"
      ) {
        return jsonError("Remarks must be text.", 400);
      }

      const remarks =
        typeof record.remarks === "string"
          ? record.remarks.trim()
          : "";

      if (remarks.length > 500) {
        return jsonError(
          "Remarks cannot exceed 500 characters.",
          400,
        );
      }

      records.push({
        studentId,
        status: record.status as AttendanceStatus,
        remarks: remarks || null,
      });
    }

    const existingStudents = await prisma.student.findMany({
      where: {
        id: { in: records.map((record) => record.studentId) },
        user: { is: { active: true } },
      },
      select: {
        id: true,
        className: true,
        section: true,
      },
    });

    if (existingStudents.length !== records.length) {
      return jsonError(
        "One or more students do not exist or have inactive accounts. Refresh the register and try again.",
        400,
      );
    }

    if (user.role === "TEACHER") {
      const assignments = await getTeacherAssignments(user.id);

      const unauthorizedStudent = existingStudents.some(
        (student) =>
          !isAssignedClass(
            student.className,
            student.section,
            assignments,
          ),
      );

      if (unauthorizedStudent) {
        return jsonError(
          "You can only mark attendance for students in your assigned classes and sections.",
          403,
        );
      }
    }

    await prisma.$transaction(
      records.map((record) =>
        prisma.attendance.upsert({
          where: {
            studentId_date: {
              studentId: record.studentId,
              date,
            },
          },
          create: {
            studentId: record.studentId,
            date,
            status: record.status,
            remarks: record.remarks,
          },
          update: {
            status: record.status,
            remarks: record.remarks,
          },
        }),
      ),
    );

    return NextResponse.json({
      message: `Attendance saved for ${records.length} student(s).`,
      savedCount: records.length,
    });
  } catch (error) {
    console.error("Attendance POST error:", error);
    return jsonError(
      "Could not save attendance. Please try again.",
      500,
    );
  }
}
