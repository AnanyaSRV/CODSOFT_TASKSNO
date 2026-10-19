
import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const DEPOSIT_PER_GUEST_RUPEES = 100;

const requestSchema = z.object({
  reservationId: z.string().min(1),
  phone: z.string().min(7).max(20),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Provide a valid reservation ID and phone number." },
        { status: 400 },
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Reservation payments are not configured." },
        { status: 503 },
      );
    }

    const normalizedPhone = parsed.data.phone.replace(/[^\d+]/g, "");

    const reservation = await prisma.reservation.findUnique({
      where: { id: parsed.data.reservationId },
      include: {
        user: { select: { phone: true, name: true } },
        deposit: true,
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found." },
        { status: 404 },
      );
    }

    const storedPhone = (reservation.user.phone ?? "").replace(/[^\d+]/g, "");

    if (!storedPhone || storedPhone !== normalizedPhone) {
      return NextResponse.json(
        { error: "The phone number does not match this reservation." },
        { status: 403 },
      );
    }

    if (reservation.status === "CANCELLED" ||
        reservation.status === "COMPLETED") {
      return NextResponse.json(
        { error: "This reservation cannot accept a deposit." },
        { status: 409 },
      );
    }

    const amountRupees = reservation.guests * DEPOSIT_PER_GUEST_RUPEES;
    const amountPaise = amountRupees * 100;

    if (reservation.deposit?.status === "PAID") {
      return NextResponse.json({
        message: "The reservation deposit is already paid.",
        alreadyPaid: true,
        reservationId: reservation.id,
        amount: amountRupees,
      });
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    let deposit = reservation.deposit;

    if (!deposit) {
      deposit = await prisma.reservationDeposit.create({
        data: {
          reservationId: reservation.id,
          amount: amountRupees,
          status: "PENDING",
        },
      });
    } else if (deposit.amount.toNumber() !== amountRupees) {
      return NextResponse.json(
        { error: "The saved deposit amount does not match the guest count." },
        { status: 409 },
      );
    }

    // Reuse a pending Razorpay order when a customer retries checkout.
    if (deposit.providerRef && deposit.status === "PENDING") {
      try {
        const existingOrder = await razorpay.orders.fetch(deposit.providerRef);

        if (
          existingOrder.amount === amountPaise &&
          existingOrder.currency === "INR" &&
          existingOrder.status === "created"
        ) {
          return NextResponse.json({
            keyId,
            orderId: existingOrder.id,
            amount: amountPaise,
            currency: "INR",
            reservationId: reservation.id,
            guestCount: reservation.guests,
            depositRupees: amountRupees,
            customerName: reservation.user.name,
          });
        }
      } catch {
        // Create a fresh provider order below if the old one is unavailable.
      }
    }

    const providerOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `res_${reservation.id}`.slice(0, 40),
      notes: {
        reservationId: reservation.id,
        guestCount: String(reservation.guests),
        purpose: "DineDesk reservation deposit",
      },
    });

    await prisma.reservationDeposit.update({
      where: { reservationId: reservation.id },
      data: {
        status: "PENDING",
        providerRef: providerOrder.id,
      },
    });

    return NextResponse.json({
      keyId,
      orderId: providerOrder.id,
      amount: amountPaise,
      currency: "INR",
      reservationId: reservation.id,
      guestCount: reservation.guests,
      depositRupees: amountRupees,
      customerName: reservation.user.name,
    });
  } catch (error) {
    console.error("Reservation deposit order creation failed:", error);

    return NextResponse.json(
      { error: "Could not start reservation payment. Please try again." },
      { status: 500 },
    );
  }
}
