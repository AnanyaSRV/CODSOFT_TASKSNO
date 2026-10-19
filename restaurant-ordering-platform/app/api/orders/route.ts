
import { randomBytes, randomUUID } from "node:crypto";
import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const orderSchema = z.object({
  customerName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(20),
  notes: z.string().trim().max(500).optional().default(""),
  paymentMethod: z.enum(["CASH", "ONLINE"]).optional().default("CASH"),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(50),
});

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay server credentials are not configured.");
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = orderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid order details.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const {
      customerName,
      phone,
      notes,
      items,
      paymentMethod,
    } = parsed.data;

    const quantities = new Map<string, number>();

    for (const item of items) {
      quantities.set(
        item.menuItemId,
        (quantities.get(item.menuItemId) ?? 0) + item.quantity,
      );
    }

    const requestedItems = [...quantities.entries()].map(
      ([menuItemId, quantity]) => ({
        menuItemId,
        quantity,
      }),
    );

    if (requestedItems.some((item) => item.quantity > 20)) {
      return NextResponse.json(
        {
          error: "A maximum of 20 units per menu item is allowed.",
        },
        { status: 400 },
      );
    }

    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: {
          in: requestedItems.map((item) => item.menuItemId),
        },
        isAvailable: true,
      },
      select: {
        id: true,
        name: true,
        price: true,
      },
    });

    if (menuItems.length !== requestedItems.length) {
      return NextResponse.json(
        {
          error:
            "One or more selected dishes are unavailable. Refresh the menu and try again.",
        },
        { status: 400 },
      );
    }

    const menuById = new Map(
      menuItems.map((item) => [item.id, item]),
    );

    const orderItems = requestedItems.map((requested) => {
      const menuItem = menuById.get(requested.menuItemId);

      if (!menuItem) {
        throw new Error("A selected menu item could not be found.");
      }

      return {
        menuItemId: menuItem.id,
        itemName: menuItem.name,
        quantity: requested.quantity,
        unitPricePaise: Math.round(
          menuItem.price.toNumber() * 100,
        ),
      };
    });

    const subtotalPaise = orderItems.reduce(
      (sum, item) =>
        sum + item.unitPricePaise * item.quantity,
      0,
    );

    const taxPaise = 0;
    const totalPaise = subtotalPaise + taxPaise;

    if (
      !Number.isSafeInteger(totalPaise) ||
      totalPaise <= 0
    ) {
      return NextResponse.json(
        { error: "The order total is invalid." },
        { status: 400 },
      );
    }

    const toDecimalAmount = (paise: number) =>
      (paise / 100).toFixed(2);

    const orderNumber =
      `DINE-${Date.now()}-${randomBytes(3)
        .toString("hex")
        .toUpperCase()}`;

    if (paymentMethod === "ONLINE") {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const publicKeyId =
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;

      if (!keyId || !keySecret || !publicKeyId) {
        return NextResponse.json(
          {
            error:
              "Online payments are not configured. Please choose cash payment.",
          },
          { status: 503 },
        );
      }

      if (publicKeyId !== keyId) {
        return NextResponse.json(
          {
            error: "Razorpay key configuration does not match.",
          },
          { status: 503 },
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const guest = await tx.user.create({
        data: {
          name: customerName,
          phone,
          email: `guest-${randomUUID()}@guest.dinedesk.local`,
          passwordHash: randomBytes(32).toString("hex"),
          role: "CUSTOMER",
        },
        select: {
          id: true,
        },
      });

      return tx.order.create({
        data: {
          orderNumber,
          userId: guest.id,
          status: "PENDING",
          subtotal: toDecimalAmount(subtotalPaise),
          tax: toDecimalAmount(taxPaise),
          total: toDecimalAmount(totalPaise),
          notes: notes || null,
          items: {
            create: orderItems.map((item) => ({
              menuItemId: item.menuItemId,
              itemName: item.itemName,
              quantity: item.quantity,
              unitPrice: toDecimalAmount(
                item.unitPricePaise,
              ),
            })),
          },
          payment: {
            create: {
              amount: toDecimalAmount(totalPaise),
              method: paymentMethod,
              status: "PENDING",
            },
          },
        },
        include: {
          items: {
            select: {
              itemName: true,
              quantity: true,
              unitPrice: true,
            },
          },
          payment: {
            select: {
              id: true,
              method: true,
              status: true,
              amount: true,
            },
          },
        },
      });
    });

    // Payment is optional in the Prisma schema, so check it
    // before accessing its fields.
    const payment = result.payment;

    if (!payment) {
      throw new Error(
        "The order was created without its payment record.",
      );
    }

    let razorpayCheckout:
      | {
          keyId: string;
          orderId: string;
          amount: number;
          currency: string;
        }
      | undefined;

    if (paymentMethod === "ONLINE") {
      try {
        const razorpay = getRazorpayClient();

        const razorpayOrder = await razorpay.orders.create({
          amount: totalPaise,
          currency: "INR",
          receipt: orderNumber,
          notes: {
            dinedeskOrderId: result.id,
            dinedeskOrderNumber: orderNumber,
          },
        });

        await prisma.payment.update({
          where: {
            orderId: result.id,
          },
          data: {
            providerRef: razorpayOrder.id,
          },
        });

        razorpayCheckout = {
          keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
          orderId: razorpayOrder.id,
          amount: totalPaise,
          currency: "INR",
        };
      } catch (error) {
        console.error(
          "Razorpay order creation failed:",
          error,
        );

        await prisma.$transaction([
          prisma.payment.update({
            where: {
              orderId: result.id,
            },
            data: {
              status: "FAILED",
            },
          }),
          prisma.order.update({
            where: {
              id: result.id,
            },
            data: {
              status: "CANCELLED",
            },
          }),
        ]);

        return NextResponse.json(
          {
            error:
              "Razorpay could not start the payment. Please try again or choose cash payment.",
          },
          { status: 502 },
        );
      }
    }

    return NextResponse.json(
      {
        message:
          paymentMethod === "ONLINE"
            ? "Order created. Complete payment to confirm it."
            : "Order placed successfully.",
        order: {
          id: result.id,
          orderNumber: result.orderNumber,
          status: result.status,
          subtotal: result.subtotal.toString(),
          tax: result.tax.toString(),
          total: result.total.toString(),
          notes: result.notes,
          items: result.items.map((item) => ({
            name: item.itemName,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
          })),
          payment: {
            method: payment.method,
            status: payment.status,
            amount: payment.amount.toString(),
          },
          createdAt: result.createdAt.toISOString(),
        },
        ...(razorpayCheckout
          ? { razorpayCheckout }
          : {}),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Order creation failed:", error);

    return NextResponse.json(
      {
        error:
          "Unable to place the order. Please try again.",
      },
      { status: 500 },
    );
  }
}
