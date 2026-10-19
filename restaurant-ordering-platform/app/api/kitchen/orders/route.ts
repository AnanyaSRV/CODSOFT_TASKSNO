import { NextRequest, NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/require-staff";

const allowedStatuses = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "SERVED",
  "CANCELLED",
] as const;

export async function GET() {
  try {
    const access = await requireStaff(["ADMIN", "KITCHEN_STAFF"]);
    if (access.response) return access.response;

    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: {
          select: { name: true, phone: true, email: true },
        },
        items: {
          select: {
            id: true,
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

    return NextResponse.json({
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        customer: order.user,
        subtotal: order.subtotal.toString(),
        tax: order.tax.toString(),
        total: order.total.toString(),
        notes: order.notes,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map((item) => ({
          id: item.id,
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
      })),
    });
  } catch (error) {
    console.error("Kitchen orders GET error:", error);

    return NextResponse.json(
      { error: "Unable to load orders." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await requireStaff(["ADMIN", "KITCHEN_STAFF"]);
    if (access.response) return access.response;

    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("orderId" in body) ||
      !("status" in body) ||
      typeof body.orderId !== "string" ||
      typeof body.status !== "string"
    ) {
      return NextResponse.json(
        { error: "A valid order ID and status are required." },
        { status: 400 },
      );
    }

    if (
      !allowedStatuses.includes(
        body.status as (typeof allowedStatuses)[number],
      )
    ) {
      return NextResponse.json(
        { error: "Invalid order status." },
        { status: 400 },
      );
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: body.orderId as string },
        data: {
          status: body.status as OrderStatus,
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
        },
      });

      // When a cash-on-delivery order is marked SERVED,
      // mark its payment as PAID because the cash has been collected.
      if (body.status === "SERVED") {
        await tx.payment.updateMany({
          where: {
            orderId: body.orderId as string,
            method: "CASH",
          },
          data: {
            status: "PAID",
          },
        });
      }

      const payment = await tx.payment.findUnique({
        where: {
          orderId: body.orderId as string,
        },
        select: {
          method: true,
          status: true,
          amount: true,
        },
      });

      return {
        ...order,
        payment: payment
          ? {
              method: payment.method,
              status: payment.status,
              amount: payment.amount.toString(),
            }
          : null,
      };
    });

    return NextResponse.json({
      message:
        body.status === "SERVED"
          ? "Order marked as served. Cash payment status updated where applicable."
          : "Order status updated.",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Kitchen order PATCH error:", error);

    return NextResponse.json(
      { error: "Unable to update order. Check that the order exists." },
      { status: 500 },
    );
  }
}