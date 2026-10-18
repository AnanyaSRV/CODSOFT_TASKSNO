import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const verifySchema = z.object({
  orderId: z.string().min(1), // Internal DineDesk order ID
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payment verification details." },
        { status: 400 },
      );
    }

    const {
      orderId,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: suppliedSignature,
    } = parsed.data;

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Online payments are not configured." },
        { status: 503 },
      );
    }

    const payment = await prisma.payment.findUnique({
      where: { orderId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }

    if (payment.method !== "ONLINE") {
      return NextResponse.json(
        { error: "This order is not an online payment." },
        { status: 400 },
      );
    }

    // Idempotent success response if this exact payment was already verified.
    if (
      payment.status === "PAID" &&
      payment.providerRef === razorpayPaymentId
    ) {
      return NextResponse.json({
        message: "Payment verified successfully.",
        order: {
          id: payment.order.id,
          orderNumber: payment.order.orderNumber,
          status: payment.order.status,
          total: payment.order.total.toString(),
        },
        payment: { status: "PAID", method: "ONLINE" },
      });
    }

    if (payment.status !== "PENDING") {
      return NextResponse.json(
        { error: "This payment is no longer pending." },
        { status: 409 },
      );
    }

    if (payment.providerRef !== razorpayOrderId) {
      return NextResponse.json(
        { error: "The Razorpay order does not match this DineDesk order." },
        { status: 400 },
      );
    }

    const expectedSignature = createHmac("sha256", keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    let suppliedBuffer: Buffer;
    try {
      suppliedBuffer = Buffer.from(suppliedSignature, "hex");
    } catch {
      return NextResponse.json(
        { error: "Invalid payment signature." },
        { status: 400 },
      );
    }

    if (
      expectedBuffer.length !== suppliedBuffer.length ||
      !timingSafeEqual(expectedBuffer, suppliedBuffer)
    ) {
      return NextResponse.json(
        { error: "Payment signature verification failed." },
        { status: 400 },
      );
    }

    // Verify the provider's payment record too; never trust browser callback data alone.
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const providerPayment = await razorpay.payments.fetch(razorpayPaymentId);
    const expectedAmountPaise = Math.round(payment.amount.toNumber() * 100);

    if (
      providerPayment.order_id !== razorpayOrderId ||
      providerPayment.amount !== expectedAmountPaise ||
      providerPayment.currency !== "INR"
    ) {
      return NextResponse.json(
        { error: "The Razorpay payment details do not match this order." },
        { status: 400 },
      );
    }

    if (providerPayment.status !== "captured") {
      return NextResponse.json(
        {
          error:
            "Razorpay has not captured this payment yet. Please wait a moment and retry verification.",
          paymentStatus: providerPayment.status,
        },
        { status: 409 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.payment.findUnique({
        where: { orderId },
        select: { id: true, status: true, method: true, providerRef: true },
      });

      if (
        !current ||
        current.status !== "PENDING" ||
        current.method !== "ONLINE" ||
        current.providerRef !== razorpayOrderId
      ) {
        throw new Error("PAYMENT_STATE_CHANGED");
      }

      const paid = await tx.payment.update({
        where: { id: current.id },
        data: { status: "PAID", providerRef: razorpayPaymentId },
        select: { status: true, method: true },
      });

      return paid;
    });

    return NextResponse.json({
      message: "Payment verified successfully.",
      order: {
        id: payment.order.id,
        orderNumber: payment.order.orderNumber,
        status: payment.order.status,
        total: payment.order.total.toString(),
      },
      payment: updated,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PAYMENT_STATE_CHANGED") {
      return NextResponse.json(
        { error: "Payment status changed. Refresh the order before retrying." },
        { status: 409 },
      );
    }

    console.error("Razorpay verification failed:", error);
    return NextResponse.json(
      { error: "Could not verify the payment. If money was deducted, do not pay again; contact the restaurant and check the order status." },
      { status: 500 },
    );
  }
}
