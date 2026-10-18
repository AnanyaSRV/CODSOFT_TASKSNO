
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getAuthorizedUser() {
  const session = await getSession();

  if (!session?.userId) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      ),
    };
  }

  if (session.role !== "ADMIN" && session.role !== "TEACHER") {
    return {
      error: NextResponse.json(
        { error: "You do not have permission to view academic records." },
        { status: 403 },
      ),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true, active: true },
  });

  if (!user || !user.active || user.role !== session.role) {
    return {
      error: NextResponse.json(
        { error: "Access denied." },
        { status: 403 },
      ),
    };
  }

  return { user };
}

export async function GET(request: NextRequest) {
  const auth = await getAuthorizedUser();

  if ("error" in auth) {
    return auth.error;
  }

  try {
    const { user } = auth;
    const searchParams = request.nextUrl.searchParams;
    const studentId = searchParams.get("studentId");
    const className = searchParams.get("className");
    const examId = searchParams.get("examId");

    const assignments =
      user.role === "TEACHER"
        ? await prisma.teacherAssignment.findMany({
            where: {
              teacher: {
                userId: user.id,
                user: { active: true },
              },
            },
            select: {
              className: true,
              section: true,
            },
          })
        : [];

    const assignedClassSections = assignments.map((assignment) => ({
      className: assignment.className,
      section: assignment.section,
    }));

    // A teacher with no assignments must not retrieve any records.
    const hasNoTeacherAssignments =
      user.role === "TEACHER" && assignedClassSections.length === 0;

    const results = hasNoTeacherAssignments
      ? []
      : await prisma.examResult.findMany({
          where: {
            ...(studentId ? { studentId } : {}),
            ...(examId ? { examId } : {}),
            student: {
              is: {
                ...(className ? { className } : {}),
                ...(user.role === "TEACHER"
                  ? { OR: assignedClassSections }
                  : {}),
              },
            },
          },
          include: {
            exam: {
              select: {
                id: true,
                title: true,
                subject: true,
                className: true,
                examDate: true,
                maxMarks: true,
              },
            },
            student: {
              select: {
                id: true,
                admissionNo: true,
                className: true,
                section: true,
                user: {
                  select: {
                    name: true,
                    active: true,
                  },
                },
              },
            },
          },
          orderBy: [
            { student: { admissionNo: "asc" } },
            { exam: { examDate: "desc" } },
          ],
        });

    const records = results.map((result) => {
      const maxMarks = Number(result.exam.maxMarks);
      const marks = Number(result.marks);
      const percentage =
        maxMarks > 0 ? (marks / maxMarks) * 100 : 0;

      let grade: string;

      if (percentage >= 90) grade = "A+";
      else if (percentage >= 80) grade = "A";
      else if (percentage >= 70) grade = "B";
      else if (percentage >= 60) grade = "C";
      else if (percentage >= 50) grade = "D";
      else grade = "F";

      return {
        id: result.id,
        examId: result.examId,
        studentId: result.studentId,
        marks,
        maxMarks,
        percentage: Number(percentage.toFixed(2)),
        grade,
        remarks: result.remarks,
        exam: {
          ...result.exam,
          examDate: result.exam.examDate.toISOString(),
        },
        student: result.student,
      };
    });

    const totalRecords = records.length;
    const averagePercentage =
      totalRecords > 0
        ? Number(
            (
              records.reduce((sum, record) => sum + record.percentage, 0) /
              totalRecords
            ).toFixed(2),
          )
        : 0;

    const passedRecords = records.filter(
      (record) => record.percentage >= 50,
    ).length;

    return NextResponse.json({
      records,
      summary: {
        totalRecords,
        averagePercentage,
        passedRecords,
        failedRecords: totalRecords - passedRecords,
      },
    });
  } catch (error) {
    console.error("GET /api/academic-records error:", error);

    return NextResponse.json(
      { error: "Failed to load academic records." },
      { status: 500 },
    );
  }
}
