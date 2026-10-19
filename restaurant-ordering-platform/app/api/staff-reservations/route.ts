
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/require-staff";

const VALID_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "SEATED",
  "COMPLETED",
  "CANCELLED",
] as const;

type ValidStatus = (typeof VALID_STATUSES)[number];

export async function GET() {
  try {
    const access = await requireStaff(["ADMIN"]);
    if (access.response) return access.response;

    const reservations = await prisma.reservation.findMany({
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      include: {
        user: {
          select: {
            name: true,
            phone: true,
            email: true,
          },
        },
        table: {
          select: {
            tableNumber: true,
            capacity: true,
          },
        },
      },
    });

    return NextResponse.json({ reservations });
  } catch (error) {
    console.error("Staff reservations GET error:", error);

    return NextResponse.json(
      { error: "Unable to load reservations." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await requireStaff(["ADMIN"]);
    if (access.response) return access.response;

    const body: unknown = await request.json();

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "A valid reservation ID and status are required." },
        { status: 400 },
      );
    }

    const id =
      "id" in body && typeof body.id === "string" ? body.id.trim() : "";
    const status = "status" in body ? body.status : undefined;

    if (!id || typeof status !== "string") {
      return NextResponse.json(
        { error: "Reservation ID and status are required." },
        { status: 400 },
      );
    }

    if (!VALID_STATUSES.includes(status as ValidStatus)) {
      return NextResponse.json(
        { error: "Invalid reservation status." },
        { status: 400 },
      );
    }

    const existing = await prisma.reservation.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Reservation not found." },
        { status: 404 },
      );
    }

    const reservation = await prisma.reservation.update({
      where: { id },
      data: { status: status as ValidStatus },
      include: {
        user: {
          select: { name: true, phone: true, email: true },
        },
        table: {
          select: { tableNumber: true, capacity: true },
        },
      },
    });

    return NextResponse.json({
      message: "Reservation status updated.",
      reservation,
    });
  } catch (error) {
    console.error("Staff reservations PATCH error:", error);

    return NextResponse.json(
      { error: "Unable to update reservation status." },
      { status: 500 },
    );
  }
}
