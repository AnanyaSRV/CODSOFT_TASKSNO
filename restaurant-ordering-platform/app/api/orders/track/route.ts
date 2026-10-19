
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const trackingSchema = z.object({
  orderNumber: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(7).max(20),
});

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = trackingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter a valid order number and phone number." },
        { status: 400 },
      );
    }

    const { orderNumber, phone } = parsed.data;

    const order = await prisma.order.findFirst({
      where: {
        orderNumber: {
          equals: orderNumber,
          mode: "insensitive",
        },
      },
      select: {
        orderNumber: true,
        status: true,
        subtotal: true,
        tax: true,
        total: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { phone: true },
        },
        items: {
          select: {
            itemName: true,
            quantity: true,
            unitPrice: true,
          },
        },
        payment: {
          select: {
            method: true,
            status: true,
            amount: true,
          },
        },
      },
    });

    if (
      !order ||
      !order.user.phone ||
      normalizePhone(order.user.phone) !== normalizePhone(phone)
    ) {
      return NextResponse.json(
        {
          error:
            "We couldn't find that order. Check the order number and the phone number used at checkout.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        subtotal: order.subtotal.toString(),
        tax: order.tax.toString(),
        total: order.total.toString(),
        notes: order.notes,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        items: order.items.map((item) => ({
          name: item.itemName,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
        })),
        payment: order.payment
          ? {
              method: order.payment.method,
              status: order.payment.status,
              amount: order.payment.amount.toString(),
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Order tracking failed:", error);

    return NextResponse.json(
      { error: "Unable to retrieve this order. Please try again." },
      { status: 500 },
    );
  }
}
