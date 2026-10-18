
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/require-staff";

type BillItemInput = {
  menuItemId: string;
  quantity: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function orderNumber() {
  return `DINE-${Date.now()}-${randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
}

function money(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function serializePayment<T extends {
  amount: unknown;
} | null>(payment: T) {
  if (!payment) return null;

  return {
    ...payment,
    amount: money(payment.amount),
  };
}

export async function GET() {
  try {
    const access = await requireStaff(["ADMIN"]);
    if (access.response) return access.response;

    // Preserve the existing automatic completion behavior.
    await prisma.reservation.updateMany({
      where: {
        status: { notIn: ["CANCELLED", "COMPLETED"] },
        endTime: { lte: new Date() },
      },
      data: { status: "COMPLETED" },
    });

    const [reservations, menuItems] = await Promise.all([
      prisma.reservation.findMany({
        orderBy: [{ date: "desc" }, { startTime: "desc" }],
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
          assignedTables: {
            include: {
              table: {
                select: {
                  tableNumber: true,
                  capacity: true,
                },
              },
            },
          },
          deposit: true,
          preorderItems: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              menuItemId: true,
              itemName: true,
              quantity: true,
              unitPrice: true,
              createdAt: true,
            },
          },
          order: {
            include: {
              items: {
                select: {
                  id: true,
                  itemName: true,
                  quantity: true,
                  unitPrice: true,
                  menuItemId: true,
                },
              },
              payment: {
                select: {
                  id: true,
                  amount: true,
                  method: true,
                  status: true,
                  providerRef: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          },
        },
      }),

      prisma.menuItem.findMany({
        where: { isAvailable: true },
        orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          price: true,
          category: { select: { name: true } },
        },
      }),
    ]);

    return NextResponse.json({
      reservations: reservations.map((reservation) => ({
        ...reservation,

        deposit: reservation.deposit
          ? {
              ...reservation.deposit,
              amount: money(reservation.deposit.amount),
            }
          : null,

        preorderItems: reservation.preorderItems.map((item) => ({
          ...item,
          unitPrice: money(item.unitPrice),
          lineTotal: roundMoney(
            money(item.unitPrice) * item.quantity,
          ),
        })),

        order: reservation.order
          ? {
              ...reservation.order,
              subtotal: money(reservation.order.subtotal),
              tax: money(reservation.order.tax),
              total: money(reservation.order.total),
              depositCredit: money(reservation.order.depositCredit),

              items: reservation.order.items.map((item) => ({
                ...item,
                unitPrice: money(item.unitPrice),
                lineTotal: roundMoney(
                  money(item.unitPrice) * item.quantity,
                ),
              })),

              payment: serializePayment(reservation.order.payment),
            }
          : null,
      })),

      menuItems: menuItems.map((item) => ({
        ...item,
        price: money(item.price),
      })),
    });
  } catch (error) {
    console.error("Reservation billing GET error:", error);

    return NextResponse.json(
      { error: "Unable to load reservation billing." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireStaff(["ADMIN"]);
    if (access.response) return access.response;

    const body: unknown = await request.json();

    if (!isObject(body)) {
      return NextResponse.json(
        { error: "A valid reservation and item list are required." },
        { status: 400 },
      );
    }

    const reservationId =
      typeof body.reservationId === "string"
        ? body.reservationId.trim()
        : "";

    if (!reservationId || !Array.isArray(body.items)) {
      return NextResponse.json(
        { error: "A reservation and a valid item list are required." },
        { status: 400 },
      );
    }

    // Items submitted by staff are additional items. Saved pre-orders
    // are automatically included in the final bill.
    if (body.items.length > 100) {
      return NextResponse.json(
        { error: "Select no more than 100 distinct bill entries." },
        { status: 400 },
      );
    }

    const additionalQuantities = new Map<string, number>();

    for (const rawItem of body.items) {
      if (!isObject(rawItem)) {
        return NextResponse.json(
          { error: "One or more bill items are invalid." },
          { status: 400 },
        );
      }

      const menuItemId =
        typeof rawItem.menuItemId === "string"
          ? rawItem.menuItemId.trim()
          : "";

      const quantity = rawItem.quantity;

      if (
        !menuItemId ||
        typeof quantity !== "number" ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 100
      ) {
        return NextResponse.json(
          {
            error:
              "Each additional item needs a valid menu item and quantity from 1 to 100.",
          },
          { status: 400 },
        );
      }

      additionalQuantities.set(
        menuItemId,
        (additionalQuantities.get(menuItemId) ?? 0) + quantity,
      );
    }

    if (
      [...additionalQuantities.values()].some(
        (quantity) => quantity > 100,
      )
    ) {
      return NextResponse.json(
        { error: "The maximum additional quantity per menu item is 100." },
        { status: 400 },
      );
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        deposit: true,
        preorderItems: true,
        order: { include: { payment: true } },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found." },
        { status: 404 },
      );
    }

    if (reservation.status === "CANCELLED") {
      return NextResponse.json(
        { error: "A cancelled reservation cannot receive a bill." },
        { status: 400 },
      );
    }

    if (reservation.order) {
      return NextResponse.json(
        {
          error:
            "A bill already exists for this reservation. Use the existing bill and record its payment there.",
          orderId: reservation.order.id,
          orderNumber: reservation.order.orderNumber,
        },
        { status: 409 },
      );
    }

    if (
      additionalQuantities.size === 0 &&
      reservation.preorderItems.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "There are no saved pre-orders. Add at least one menu item before creating the bill.",
        },
        { status: 400 },
      );
    }

    // Validate and price additional items from the database.
    const additionalMenuItems =
      additionalQuantities.size > 0
        ? await prisma.menuItem.findMany({
            where: {
              id: { in: [...additionalQuantities.keys()] },
              isAvailable: true,
            },
            select: { id: true, name: true, price: true },
          })
        : [];

    if (additionalMenuItems.length !== additionalQuantities.size) {
      return NextResponse.json(
        {
          error:
            "One or more additional menu items are unavailable. Refresh the menu and try again.",
        },
        { status: 400 },
      );
    }

    // Combine saved reservation pre-orders and extra items added by staff.
    const combinedItems = new Map<
      string,
      {
        menuItemId: string;
        itemName: string;
        quantity: number;
        unitPrice: number;
      }
    >();

    for (const item of reservation.preorderItems) {
      const previous = combinedItems.get(item.menuItemId);

      const quantity = (previous?.quantity ?? 0) + item.quantity;

      if (quantity > 100) {
        return NextResponse.json(
          {
            error:
              `The combined quantity for "${item.itemName}" exceeds 100.`,
          },
          { status: 400 },
        );
      }

      combinedItems.set(item.menuItemId, {
        menuItemId: item.menuItemId,
        itemName: item.itemName,
        quantity,
        unitPrice: money(item.unitPrice),
      });
    }

    for (const item of additionalMenuItems) {
      const extraQuantity = additionalQuantities.get(item.id) ?? 0;
      const previous = combinedItems.get(item.id);

      const combinedQuantity =
        (previous?.quantity ?? 0) + extraQuantity;

      if (combinedQuantity > 100) {
        return NextResponse.json(
          {
            error:
              `The combined quantity for "${item.name}" exceeds 100.`,
          },
          { status: 400 },
        );
      }

      combinedItems.set(item.id, {
        menuItemId: item.id,
        itemName: item.name,
        quantity: combinedQuantity,
        unitPrice: previous?.unitPrice ?? money(item.price),
      });
    }

    const pricedItems = [...combinedItems.values()].map((item) => ({
      ...item,
      lineTotalPaise:
        Math.round(item.unitPrice * 100) * item.quantity,
    }));

    const subtotalPaise = pricedItems.reduce(
      (sum, item) => sum + item.lineTotalPaise,
      0,
    );

    const subtotal = subtotalPaise / 100;
    const tax = 0;
    const total = roundMoney(subtotal + tax);

    const depositAmount =
      reservation.deposit?.status === PaymentStatus.PAID
        ? money(reservation.deposit.amount)
        : 0;

    // Credit only up to the bill total, so the outstanding balance
    // can never become negative.
    const depositCredit = roundMoney(
      Math.min(depositAmount, total),
    );

    const balanceDue = roundMoney(
      Math.max(0, total - depositCredit),
    );

    // A fully covered bill is recorded as paid without asking staff
    // to collect money a second time.
    const balanceAlreadySettled = balanceDue === 0;

    const order = await prisma.$transaction(async (tx) => {
      // Recheck for a concurrently created bill.
      const latestReservation = await tx.reservation.findUnique({
        where: { id: reservation.id },
        include: { order: true, deposit: true },
      });

      if (!latestReservation) {
        throw new Error("RESERVATION_NOT_FOUND");
      }

      if (latestReservation.status === "CANCELLED") {
        throw new Error("RESERVATION_CANCELLED");
      }

      if (latestReservation.order) {
        throw new Error("BILL_ALREADY_EXISTS");
      }

      const latestDepositAmount =
        latestReservation.deposit?.status === PaymentStatus.PAID
          ? money(latestReservation.deposit.amount)
          : 0;

      // Recalculate from the deposit inside the transaction to avoid
      // using a stale payment state.
      const finalDepositCredit = roundMoney(
        Math.min(latestDepositAmount, total),
      );

      const finalBalanceDue = roundMoney(
        Math.max(0, total - finalDepositCredit),
      );

      const createdOrder = await tx.order.create({
        data: {
          orderNumber: orderNumber(),
          reservationId: latestReservation.id,
          userId: latestReservation.userId,
          status: OrderStatus.SERVED,
          subtotal,
          tax,
          total,
          depositCredit: finalDepositCredit,

          items: {
            create: pricedItems.map((item) => ({
              menuItemId: item.menuItemId,
              itemName: item.itemName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },

          payment: {
            create: {
              amount: finalBalanceDue,
              method: PaymentMethod.CASH,
              status:
                finalBalanceDue === 0
                  ? PaymentStatus.PAID
                  : PaymentStatus.PENDING,
              providerRef:
                finalBalanceDue === 0 && latestReservation.deposit
                  ? `deposit-credit:${latestReservation.deposit.id}`
                  : null,
            },
          },
        },
        include: {
          items: true,
          payment: true,
        },
      });

      return {
        ...createdOrder,
        depositCredit: finalDepositCredit,
        balanceDue: finalBalanceDue,
      };
    });

    return NextResponse.json(
      {
        message:
          order.balanceDue === 0
            ? "Dine-in bill created. The paid deposit covers the full bill."
            : "Dine-in bill created. Collect only the outstanding balance.",
        order: {
          ...order,
          subtotal: money(order.subtotal),
          tax: money(order.tax),
          total: money(order.total),
          depositCredit: money(order.depositCredit),
          balanceDue: money(order.balanceDue),
          items: order.items.map((item) => ({
            ...item,
            unitPrice: money(item.unitPrice),
            lineTotal: roundMoney(
              money(item.unitPrice) * item.quantity,
            ),
          })),
          payment: serializePayment(order.payment),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "RESERVATION_NOT_FOUND") {
        return NextResponse.json(
          { error: "Reservation not found." },
          { status: 404 },
        );
      }

      if (error.message === "RESERVATION_CANCELLED") {
        return NextResponse.json(
          { error: "A cancelled reservation cannot receive a bill." },
          { status: 400 },
        );
      }

      if (error.message === "BILL_ALREADY_EXISTS") {
        return NextResponse.json(
          {
            error:
              "A bill was created for this reservation by another request. Refresh and load the existing bill.",
          },
          { status: 409 },
        );
      }
    }

    console.error("Reservation billing POST error:", error);

    return NextResponse.json(
      {
        error:
          "Unable to create the bill. Refresh the page and check whether a bill already exists.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await requireStaff(["ADMIN"]);
    if (access.response) return access.response;

    const body: unknown = await request.json();

    if (!isObject(body)) {
      return NextResponse.json(
        { error: "A valid order ID is required." },
        { status: 400 },
      );
    }

    const orderId =
      typeof body.orderId === "string" ? body.orderId.trim() : "";
    const action = body.action;

    if (!orderId || action !== "MARK_PAID") {
      return NextResponse.json(
        { error: "Order ID and a valid payment action are required." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          payment: true,
          reservation: { include: { deposit: true } },
        },
      });

      if (!order || !order.reservationId) {
        throw new Error("DINE_IN_BILL_NOT_FOUND");
      }

      if (!order.payment) {
        throw new Error("PAYMENT_RECORD_MISSING");
      }

      if (order.status === OrderStatus.CANCELLED) {
        throw new Error("CANCELLED_ORDER");
      }

      if (order.payment.status === PaymentStatus.PAID) {
        return {
          alreadyPaid: true,
          payment: order.payment,
          balanceDue: money(order.payment.amount),
        };
      }

      const depositAmount =
        order.reservation?.deposit?.status === PaymentStatus.PAID
          ? money(order.reservation.deposit.amount)
          : 0;

      const expectedCredit = roundMoney(
        Math.min(depositAmount, money(order.total)),
      );

      const balanceDue = roundMoney(
        Math.max(0, money(order.total) - expectedCredit),
      );

      // Prevent marking a balance as paid if the payment record does not
      // represent the current amount outstanding.
      if (Math.abs(money(order.payment.amount) - balanceDue) > 0.009) {
        throw new Error("PAYMENT_BALANCE_MISMATCH");
      }

      if (balanceDue === 0) {
        throw new Error("NO_BALANCE_TO_COLLECT");
      }

      const payment = await tx.payment.update({
        where: { orderId: order.id },
        data: { status: PaymentStatus.PAID },
      });

      return {
        alreadyPaid: false,
        payment,
        balanceDue,
      };
    });

    return NextResponse.json({
      message: result.alreadyPaid
        ? "This bill is already marked as paid."
        : "Outstanding balance recorded as received.",
      payment: {
        ...result.payment,
        amount: money(result.payment.amount),
      },
      balanceDue: result.balanceDue,
      alreadyPaid: result.alreadyPaid,
    });
  } catch (error) {
    if (error instanceof Error) {
      const knownErrors: Record<
        string,
        { status: number; message: string }
      > = {
        DINE_IN_BILL_NOT_FOUND: {
          status: 404,
          message: "Dine-in bill not found.",
        },
        PAYMENT_RECORD_MISSING: {
          status: 400,
          message: "This bill has no payment record.",
        },
        CANCELLED_ORDER: {
          status: 400,
          message: "A cancelled order cannot be marked as paid.",
        },
        PAYMENT_BALANCE_MISMATCH: {
          status: 409,
          message:
            "The payment amount does not match the outstanding balance. Refresh the billing page before recording payment.",
        },
        NO_BALANCE_TO_COLLECT: {
          status: 400,
          message:
            "The paid deposit already covers the bill. No additional payment should be collected.",
        },
      };

      const known = knownErrors[error.message];

      if (known) {
        return NextResponse.json(
          { error: known.message },
          { status: known.status },
        );
      }
    }

    console.error("Reservation billing PATCH error:", error);

    return NextResponse.json(
      { error: "Unable to record payment." },
      { status: 500 },
    );
  }
}
