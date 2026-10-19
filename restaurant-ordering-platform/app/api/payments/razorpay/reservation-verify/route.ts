
import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const DEPOSIT_PER_GUEST_RUPEES = 100;

const verifySchema = z.object({
  reservationId: z.string().min(1),
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
        { error: "Invalid reservation payment verification details." },
        { status: 400 },
      );
    }

    const {
      reservationId,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: suppliedSignature,
    } = parsed.data;

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Reservation payments are not configured." },
        { status: 503 },
      );
    }

    const deposit = await prisma.reservationDeposit.findUnique({
      where: { reservationId },
      include: {
        reservation: {
          select: {
            id: true,
            guests: true,
            status: true,
          },
        },
      },
    });

    if (!deposit) {
      return NextResponse.json(
        { error: "Reservation deposit not found." },
        { status: 404 },
      );
    }

    // Safe retry after this exact payment has already been verified.
    if (
      deposit.status === "PAID" &&
      deposit.providerRef === razorpayPaymentId
    ) {
      return NextResponse.json({
        message: "Reservation deposit verified successfully.",
        reservationId,
        depositStatus: "PAID",
        reservationStatus: deposit.reservation.status,
        amount: deposit.amount.toNumber(),
      });
    }

    if (deposit.status !== "PENDING") {
      return NextResponse.json(
        { error: "This reservation deposit is no longer pending." },
        { status: 409 },
      );
    }

    if (deposit.providerRef !== razorpayOrderId) {
      return NextResponse.json(
        { error: "The Razorpay order does not match this reservation." },
        { status: 400 },
      );
    }

    if (
      deposit.amount.toNumber() !==
      deposit.reservation.guests * DEPOSIT_PER_GUEST_RUPEES
    ) {
      return NextResponse.json(
        { error: "The deposit amount does not match the guest count." },
        { status: 409 },
      );
    }

    const expectedSignature = createHmac("sha256", keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const suppliedBuffer = Buffer.from(suppliedSignature, "hex");

    if (
      expectedBuffer.length !== suppliedBuffer.length ||
      !timingSafeEqual(expectedBuffer, suppliedBuffer)
    ) {
      return NextResponse.json(
        { error: "Payment signature verification failed." },
        { status: 400 },
      );
    }

    // Verify the payment with Razorpay; do not trust the browser callback alone.
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const providerPayment =
      await razorpay.payments.fetch(razorpayPaymentId);

    const expectedAmountPaise = Math.round(
      deposit.amount.toNumber() * 100,
    );

    if (
      providerPayment.order_id !== razorpayOrderId ||
      providerPayment.amount !== expectedAmountPaise ||
      providerPayment.currency !== "INR"
    ) {
      return NextResponse.json(
        { error: "The Razorpay payment details do not match this deposit." },
        { status: 400 },
      );
    }

    if (providerPayment.status !== "captured") {
      return NextResponse.json(
        {
          error:
            "The payment has not been captured yet. Wait a moment and retry verification.",
          paymentStatus: providerPayment.status,
        },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      const current = await tx.reservationDeposit.findUnique({
        where: { reservationId },
        select: {
          id: true,
          amount: true,
          status: true,
          providerRef: true,
        },
      });

      if (
        !current ||
        current.status !== "PENDING" ||
        current.providerRef !== razorpayOrderId ||
        current.amount.toNumber() !== expectedAmountPaise / 100
      ) {
        throw new Error("RESERVATION_DEPOSIT_STATE_CHANGED");
      }

      await tx.reservationDeposit.update({
        where: { id: current.id },
        data: {
          status: "PAID",
          providerRef: razorpayPaymentId,
        },
      });

      await tx.reservation.update({
        where: { id: reservationId },
        data: { status: "CONFIRMED" },
      });
    });

    return NextResponse.json({
      message: "Reservation deposit verified successfully.",
      reservationId,
      depositStatus: "PAID",
      reservationStatus: "CONFIRMED",
      amount: deposit.amount.toNumber(),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "RESERVATION_DEPOSIT_STATE_CHANGED"
    ) {
      return NextResponse.json(
        { error: "The deposit status changed. Refresh and check the reservation." },
        { status: 409 },
      );
    }

    console.error("Reservation deposit verification failed:", error);

    return NextResponse.json(
      {
        error:
          "Could not verify the deposit. If money was deducted, do not pay again; check the reservation status or contact the restaurant.",
      },
      { status: 500 },
    );
  }
}
