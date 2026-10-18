import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const feeSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  title: z.string().trim().min(2, "Fee title must contain at least 2 characters").max(100),
  amount: z.number().finite().positive("Fee amount must be greater than zero"),
  paidAmount: z.number().finite().min(0, "Paid amount cannot be negative"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD").optional().nullable(),
}).refine((data) => data.paidAmount <= data.amount, {
  message: "Paid amount cannot exceed the total fee",
  path: ["paidAmount"],
});

const paymentSchema = z.object({
  paymentAmount: z.number().finite().positive("Payment must be greater than zero"),
});

async function getAuthorizedUser() {
  const session = await getSession();

  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (session.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Only administrators can manage fee records" }, { status: 403 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true, active: true },
  });

  if (!user || !user.active || user.role !== "ADMIN" || user.role !== session.role) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user };
}

function calculateStatus(amount: number, paidAmount: number): "PENDING" | "PARTIAL" | "PAID" {
  if (paidAmount <= 0) return "PENDING";
  if (paidAmount >= amount) return "PAID";
  return "PARTIAL";
}

function serializeFee<T extends {
  amount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  dueDate: Date | null;
  [key: string]: unknown;
}>(fee: T) {
  return {
    ...fee,
    amount: Number(fee.amount),
    paidAmount: Number(fee.paidAmount),
    dueDate: fee.dueDate?.toISOString() ?? null,
  };
}

export async function GET(request: NextRequest) {
  const auth = await getAuthorizedUser();

  if ("error" in auth) return auth.error;

  const searchParams = request.nextUrl.searchParams;
  const studentId = searchParams.get("studentId");
  const status = searchParams.get("status");

  if (status && !["PENDING", "PARTIAL", "PAID"].includes(status)) {
    return NextResponse.json({ error: "Invalid fee status" }, { status: 400 });
  }

  try {
    const fees = await prisma.feeRecord.findMany({
      where: {
        ...(studentId ? { studentId } : {}),
        ...(status ? { status: status as "PENDING" | "PARTIAL" | "PAID" } : {}),
      },
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            className: true,
            section: true,
            user: { select: { name: true, active: true } },
          },
        },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ fees: fees.map(serializeFee) });
  } catch (error) {
    console.error("GET /api/fees error:", error);
    return NextResponse.json({ error: "Failed to load fee records" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthorizedUser();

  if ("error" in auth) return auth.error;

  try {
    const body: unknown = await request.json();
    const parsed = feeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid fee record" },
        { status: 400 },
      );
    }

    const data = parsed.data;

    const student = await prisma.student.findUnique({
      where: { id: data.studentId },
      select: { id: true, user: { select: { active: true } } },
    });

    if (!student || !student.user.active) {
      return NextResponse.json({ error: "Active student not found" }, { status: 404 });
    }

    let dueDate: Date | null = null;

    if (data.dueDate) {
      dueDate = new Date(`${data.dueDate}T00:00:00.000Z`);

      if (Number.isNaN(dueDate.getTime()) || dueDate.toISOString().slice(0, 10) !== data.dueDate) {
        return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
      }
    }

    const fee = await prisma.feeRecord.create({
      data: {
        studentId: data.studentId,
        title: data.title,
        amount: new Prisma.Decimal(data.amount),
        paidAmount: new Prisma.Decimal(data.paidAmount),
        dueDate,
        status: calculateStatus(data.amount, data.paidAmount),
      },
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            className: true,
            section: true,
            user: { select: { name: true, active: true } },
          },
        },
      },
    });

    return NextResponse.json({ fee: serializeFee(fee) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/fees error:", error);
    return NextResponse.json({ error: "Failed to create fee record" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthorizedUser();

  if ("error" in auth) return auth.error;

  try {
    const body: unknown = await request.json();

    const parsed = z.object({
      feeId: z.string().min(1),
      ...paymentSchema.shape,
    }).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid payment" },
        { status: 400 },
      );
    }

    const { feeId, paymentAmount } = parsed.data;

    const updatedFee = await prisma.$transaction(async (tx) => {
      const fee = await tx.feeRecord.findUnique({ where: { id: feeId } });

      if (!fee) return null;

      const amount = Number(fee.amount);
      const currentPaid = Number(fee.paidAmount);
      const newPaid = Math.round((currentPaid + paymentAmount) * 100) / 100;

      if (newPaid > amount + 0.000001) {
        throw new Error("PAYMENT_EXCEEDS_BALANCE");
      }

      return tx.feeRecord.update({
        where: { id: feeId },
        data: {
          paidAmount: new Prisma.Decimal(newPaid),
          status: calculateStatus(amount, newPaid),
        },
        include: {
          student: {
            select: {
              id: true,
              admissionNo: true,
              className: true,
              section: true,
              user: { select: { name: true, active: true } },
            },
          },
        },
      });
    });

    if (!updatedFee) {
      return NextResponse.json({ error: "Fee record not found" }, { status: 404 });
    }

    return NextResponse.json({ fee: serializeFee(updatedFee) });
  } catch (error) {
    if (error instanceof Error && error.message === "PAYMENT_EXCEEDS_BALANCE") {
      return NextResponse.json({ error: "Payment exceeds the outstanding balance" }, { status: 400 });
    }

    console.error("PATCH /api/fees error:", error);
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
  }
}