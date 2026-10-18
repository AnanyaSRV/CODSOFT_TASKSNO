import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/require-staff";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const access = await requireStaff(["ADMIN"]);

    if (access.response) {
      return access.response;
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => null);

    if (body?.status !== "PAID") {
      return NextResponse.json(
        { error: "Only confirming a payment as PAID is supported." },
        { status: 400 },
      );
    }

    const payment = await prisma.payment.findUnique({
      where: { id },
      select: {
        id: true,
        method: true,
        status: true,
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found." },
        { status: 404 },
      );
    }

    if (payment.method === "ONLINE" && payment.status !== "PAID") {
      return NextResponse.json(
        {
          error:
            "Online payments must be confirmed by Razorpay signature verification. They cannot be marked as paid manually.",
        },
        { status: 400 },
      );
    }

    if (payment.status === "REFUNDED") {
      return NextResponse.json(
        { error: "A refunded payment cannot be marked as paid." },
        { status: 400 },
      );
    }

    if (payment.status === "FAILED") {
      return NextResponse.json(
        {
          error:
            "This payment failed. Verify that the customer actually paid before updating it.",
        },
        { status: 400 },
      );
    }

    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: { status: "PAID" },
      select: {
        id: true,
        orderId: true,
        amount: true,
        method: true,
        status: true,
      },
    });

    return NextResponse.json({
      message: "Payment marked as paid.",
      payment: {
        ...updatedPayment,
        amount: Number(updatedPayment.amount),
      },
    });
  } catch (error) {
    console.error("Payment update error:", error);

    return NextResponse.json(
      { error: "Could not update the payment." },
      { status: 500 },
    );
  }
}
