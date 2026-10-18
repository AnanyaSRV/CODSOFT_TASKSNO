
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/require-staff";

export async function GET() {
  try {
    const access = await requireStaff(["ADMIN"]);
    if (access.response) return access.response;

    const [
      totalOrders,
      pendingOrders,
      confirmedOrders,
      preparingOrders,
      readyOrders,
      servedOrders,
      cancelledOrders,
      totalReservations,
      pendingReservations,
      confirmedReservations,
      seatedReservations,
      completedReservations,
      cancelledReservations,
      totalCustomers,
      totalMenuItems,
      availableMenuItems,
      activeTables,
      paidPayments,
      pendingPayments,
      servedOrderValue,
      paidDeposits,
      pendingDeposits,
      recentOrders,
      recentReservations,
    ] = await prisma.$transaction([
      prisma.order.count(),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.order.count({ where: { status: "CONFIRMED" } }),
      prisma.order.count({ where: { status: "PREPARING" } }),
      prisma.order.count({ where: { status: "READY" } }),
      prisma.order.count({ where: { status: "SERVED" } }),
      prisma.order.count({ where: { status: "CANCELLED" } }),

      prisma.reservation.count(),
      prisma.reservation.count({ where: { status: "PENDING" } }),
      prisma.reservation.count({ where: { status: "CONFIRMED" } }),
      prisma.reservation.count({ where: { status: "SEATED" } }),
      prisma.reservation.count({ where: { status: "COMPLETED" } }),
      prisma.reservation.count({ where: { status: "CANCELLED" } }),

      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.menuItem.count(),
      prisma.menuItem.count({ where: { isAvailable: true } }),
      prisma.restaurantTable.count({ where: { isActive: true } }),

      // Paid food-order payments. A deposit-credit payment has amount zero,
      // so the deposit itself is not counted twice.
      prisma.payment.aggregate({
        where: {
          status: "PAID",
          order: {
            status: { not: "CANCELLED" },
          },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),

      prisma.payment.aggregate({
        where: {
          status: "PENDING",
          order: {
            status: { not: "CANCELLED" },
          },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),

      prisma.order.aggregate({
        where: { status: "SERVED" },
        _sum: { total: true },
      }),

      // Reservation deposits count as received revenue only when paid
      // and the reservation has not been cancelled.
      prisma.reservationDeposit.aggregate({
        where: {
          status: "PAID",
          reservation: {
            status: { not: "CANCELLED" },
          },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),

      prisma.reservationDeposit.aggregate({
        where: {
          status: "PENDING",
          reservation: {
            status: { not: "CANCELLED" },
          },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),

      prisma.order.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          depositCredit: true,
          createdAt: true,
          user: {
            select: { name: true },
          },
          payment: {
            select: {
              id: true,
              status: true,
              amount: true,
              method: true,
            },
          },
        },
      }),

      prisma.reservation.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          date: true,
          startTime: true,
          guests: true,
          status: true,
          user: {
            select: { name: true },
          },
          table: {
            select: { tableNumber: true },
          },
          deposit: {
            select: {
              id: true,
              amount: true,
              status: true,
              providerRef: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              total: true,
              depositCredit: true,
              payment: {
                select: {
                  amount: true,
                  status: true,
                  method: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const paidFoodOrderPayments = Number(
      paidPayments._sum.amount ?? 0,
    );

    const paidReservationDeposits = Number(
      paidDeposits._sum.amount ?? 0,
    );

    const pendingFoodOrderPayments = Number(
      pendingPayments._sum.amount ?? 0,
    );

    const pendingReservationDeposits = Number(
      pendingDeposits._sum.amount ?? 0,
    );

    // Includes paid food-order balances and paid reservation deposits.
    // Deposit-credit payments are zero-value records and do not double-count.
    const totalPaidRevenue =
      paidFoodOrderPayments + paidReservationDeposits;

    const totalPendingPayments =
      pendingFoodOrderPayments + pendingReservationDeposits;

    return NextResponse.json({
      overview: {
        orders: {
          total: totalOrders,
          pending: pendingOrders,
          confirmed: confirmedOrders,
          preparing: preparingOrders,
          ready: readyOrders,
          served: servedOrders,
          cancelled: cancelledOrders,
        },

        reservations: {
          total: totalReservations,
          pending: pendingReservations,
          confirmed: confirmedReservations,
          seated: seatedReservations,
          completed: completedReservations,
          cancelled: cancelledReservations,
        },

        customers: totalCustomers,

        menuItems: {
          total: totalMenuItems,
          available: availableMenuItems,
        },

        activeTables,

        revenue: {
          // Backward-compatible field: now includes paid deposits.
          paid: totalPaidRevenue,

          // Food-order total value for served orders, not cash collected.
          completedOrderValue: Number(
            servedOrderValue._sum.total ?? 0,
          ),

          // Includes pending food balances and pending deposits.
          pendingPaymentsValue: totalPendingPayments,

          paidPaymentCount: paidPayments._count._all,
          pendingPaymentCount: pendingPayments._count._all,

          paidFoodOrderPayments,
          paidReservationDeposits,
          pendingFoodOrderPayments,
          pendingReservationDeposits,

          paidDepositCount: paidDeposits._count._all,
          pendingDepositCount: pendingDeposits._count._all,
        },

        // Preserve the field used by the existing admin page.
        paidRevenue: totalPaidRevenue,
      },

      recentOrders: recentOrders.map((order) => ({
        ...order,
        total: Number(order.total),
        depositCredit: Number(order.depositCredit),
        payment: order.payment
          ? {
              ...order.payment,
              amount: Number(order.payment.amount),
            }
          : null,
      })),

      recentReservations: recentReservations.map((reservation) => ({
        ...reservation,

        deposit: reservation.deposit
          ? {
              ...reservation.deposit,
              amount: Number(reservation.deposit.amount),
            }
          : null,

        order: reservation.order
          ? {
              ...reservation.order,
              total: Number(reservation.order.total),
              depositCredit: Number(
                reservation.order.depositCredit,
              ),
              payment: reservation.order.payment
                ? {
                    ...reservation.order.payment,
                    amount: Number(
                      reservation.order.payment.amount,
                    ),
                  }
                : null,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("Admin overview error:", error);

    return NextResponse.json(
      { error: "Could not load the admin overview." },
      { status: 500 },
    );
  }
}
