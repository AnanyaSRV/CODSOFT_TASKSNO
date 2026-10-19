
import { NextRequest, NextResponse } from "next/server";
import { Prisma, ReservationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const RESERVATION_DURATION_MINUTES = 90;
const MAX_GUESTS = 20;
const DEPOSIT_PER_GUEST_RUPEES = 100;
const INDIA_OFFSET = "+05:30";

type TableChoice = {
  id: string;
  tableNumber: string;
  capacity: number;
};

type RequestedPreorderItem = {
  menuItemId: string;
  quantity: number;
};

function getReservationWindow(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Choose a valid reservation date.");
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error("Choose a valid reservation time.");
  }

  const startTime = new Date(`${date}T${time}:00${INDIA_OFFSET}`);

  if (
    Number.isNaN(startTime.getTime()) ||
    new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date
  ) {
    throw new Error("Choose a valid reservation date and time.");
  }

  if (startTime.getTime() <= Date.now()) {
    throw new Error("Please choose a future reservation time.");
  }

  const endTime = new Date(
    startTime.getTime() + RESERVATION_DURATION_MINUTES * 60_000,
  );

  return {
    reservationDate: new Date(`${date}T00:00:00.000Z`),
    startTime,
    endTime,
  };
}

function chooseBestTableCombination(
  tables: TableChoice[],
  guests: number,
): TableChoice[] | null {
  const sorted = [...tables].sort(
    (a, b) =>
      a.capacity - b.capacity ||
      a.tableNumber.localeCompare(b.tableNumber),
  );

  let best: TableChoice[] | null = null;
  let bestExcess = Number.POSITIVE_INFINITY;
  let bestCount = Number.POSITIVE_INFINITY;

  function search(
    startIndex: number,
    selected: TableChoice[],
    totalCapacity: number,
  ) {
    if (totalCapacity >= guests) {
      const excess = totalCapacity - guests;

      if (
        excess < bestExcess ||
        (excess === bestExcess && selected.length < bestCount)
      ) {
        best = [...selected];
        bestExcess = excess;
        bestCount = selected.length;
      }

      return;
    }

    for (let index = startIndex; index < sorted.length; index += 1) {
      if (totalCapacity + sorted[index].capacity > bestExcess + guests) {
        continue;
      }

      selected.push(sorted[index]);
      search(
        index + 1,
        selected,
        totalCapacity + sorted[index].capacity,
      );
      selected.pop();
    }
  }

  search(0, [], 0);
  return best;
}

async function getOccupiedTableIds(
  client: Prisma.TransactionClient | typeof prisma,
  startTime: Date,
  endTime: Date,
  tableIds?: string[],
) {
  const reservations = await client.reservation.findMany({
    where: {
      status: { notIn: ["CANCELLED", "COMPLETED"] },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      ...(tableIds
        ? {
            OR: [
              { tableId: { in: tableIds } },
              { assignedTables: { some: { tableId: { in: tableIds } } } },
            ],
          }
        : {}),
    },
    select: {
      tableId: true,
      assignedTables: {
        select: { tableId: true },
      },
    },
  });

  const occupied = new Set<string>();

  for (const reservation of reservations) {
    occupied.add(reservation.tableId);

    for (const assignment of reservation.assignedTables) {
      occupied.add(assignment.tableId);
    }
  }

  return occupied;
}

async function getSuggestedTables(
  client: Prisma.TransactionClient | typeof prisma,
  startTime: Date,
  endTime: Date,
  guests: number,
) {
  const allTables = await client.restaurantTable.findMany({
    where: { isActive: true },
    select: {
      id: true,
      tableNumber: true,
      capacity: true,
    },
    orderBy: [{ capacity: "asc" }, { tableNumber: "asc" }],
  });

  const occupiedIds = await getOccupiedTableIds(
    client,
    startTime,
    endTime,
    allTables.map((table) => table.id),
  );

  const availableTables = allTables.filter(
    (table) => !occupiedIds.has(table.id),
  );

  return chooseBestTableCombination(availableTables, guests);
}

function formatTableSummary(tables: TableChoice[]) {
  return {
    tableNumber: tables.map((table) => table.tableNumber).join(" + "),
    capacity: tables.reduce((total, table) => total + table.capacity, 0),
  };
}

function parsePreorderItems(value: unknown): RequestedPreorderItem[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value) || value.length > 30) {
    throw new Error("Invalid food pre-order selection.");
  }

  const quantities = new Map<string, number>();

  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      throw new Error("Invalid food pre-order item.");
    }

    const data = item as Record<string, unknown>;
    const menuItemId =
      typeof data.menuItemId === "string" ? data.menuItemId.trim() : "";
    const quantity = Number(data.quantity);

    if (
      !menuItemId ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 20
    ) {
      throw new Error("Each pre-order quantity must be between 1 and 20.");
    }

    const combinedQuantity = (quantities.get(menuItemId) ?? 0) + quantity;

    if (combinedQuantity > 20) {
      throw new Error("A maximum of 20 of each menu item can be pre-ordered.");
    }

    quantities.set(menuItemId, combinedQuantity);
  }

  return Array.from(quantities, ([menuItemId, quantity]) => ({
    menuItemId,
    quantity,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const date = params.get("date") ?? "";
    const time = params.get("time") ?? "";
    const guests = Number(params.get("guests") ?? "2");

    if (!Number.isInteger(guests) || guests < 1 || guests > MAX_GUESTS) {
      return NextResponse.json(
        { error: `Guests must be between 1 and ${MAX_GUESTS}.` },
        { status: 400 },
      );
    }

    const { startTime, endTime } = getReservationWindow(date, time);
    const suggestedTables = await getSuggestedTables(
      prisma,
      startTime,
      endTime,
      guests,
    );

    const tables = suggestedTables ?? [];
    const totalCapacity = tables.reduce(
      (total, table) => total + table.capacity,
      0,
    );

    return NextResponse.json({
      date,
      time,
      guests,
      durationMinutes: RESERVATION_DURATION_MINUTES,
      depositPerGuest: DEPOSIT_PER_GUEST_RUPEES,
      depositAmount: guests * DEPOSIT_PER_GUEST_RUPEES,
      available: tables.length > 0,
      suggestedTables: tables,
      totalCapacity,
      message:
        tables.length > 0
          ? "Suitable seating is available."
          : "No suitable table combination is available for this time. Please try another time.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to check reservation availability.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "Please provide valid reservation details." },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const phone = typeof data.phone === "string" ? data.phone.trim() : "";
    const date = typeof data.date === "string" ? data.date : "";
    const time = typeof data.time === "string" ? data.time : "";
    const guests = Number(data.guests);
    const notes = typeof data.notes === "string" ? data.notes.trim() : "";

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json(
        { error: "Name must be between 2 and 100 characters." },
        { status: 400 },
      );
    }

    if (phone.length < 7 || phone.length > 20) {
      return NextResponse.json(
        { error: "Enter a valid phone number." },
        { status: 400 },
      );
    }

    if (!Number.isInteger(guests) || guests < 1 || guests > MAX_GUESTS) {
      return NextResponse.json(
        { error: `Guests must be between 1 and ${MAX_GUESTS}.` },
        { status: 400 },
      );
    }

    if (notes.length > 500) {
      return NextResponse.json(
        { error: "Special requests cannot exceed 500 characters." },
        { status: 400 },
      );
    }

    let preorderItems: RequestedPreorderItem[];

    try {
      preorderItems = parsePreorderItems(data.preorderItems);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Invalid food pre-order selection.",
        },
        { status: 400 },
      );
    }

    const { reservationDate, startTime, endTime } =
      getReservationWindow(date, time);

    const normalizedPhone = phone.replace(/[^\d+]/g, "");
    const guestEmail =
      `guest-${normalizedPhone.replace(/\+/g, "")}@dinedesk.local`;
    const depositAmount = guests * DEPOSIT_PER_GUEST_RUPEES;

    const result = await prisma.$transaction(
      async (tx) => {
        const tables = await getSuggestedTables(
          tx,
          startTime,
          endTime,
          guests,
        );

        if (!tables || tables.length === 0) {
          throw new Error(
            "No suitable tables are available for this time. Please choose another time.",
          );
        }

        const menuItems = preorderItems.length
          ? await tx.menuItem.findMany({
              where: {
                id: { in: preorderItems.map((item) => item.menuItemId) },
                isAvailable: true,
              },
              select: {
                id: true,
                name: true,
                price: true,
              },
            })
          : [];

        if (menuItems.length !== preorderItems.length) {
          throw new Error(
            "One or more pre-ordered dishes are unavailable. Refresh the menu and try again.",
          );
        }

        const menuById = new Map(menuItems.map((item) => [item.id, item]));

        const user = await tx.user.upsert({
          where: { email: guestEmail },
          update: { name, phone },
          create: {
            name,
            email: guestEmail,
            phone,
            passwordHash: `guest-account-${crypto.randomUUID()}`,
            role: "CUSTOMER",
          },
        });

        const created = await tx.reservation.create({
          data: {
            userId: user.id,
            tableId: tables[0].id,
            date: reservationDate,
            startTime,
            endTime,
            guests,
            notes: notes || null,
            status: "PENDING",
            assignedTables: {
              create: tables.map((table) => ({ tableId: table.id })),
            },
          },
          include: {
            user: { select: { name: true, phone: true } },
            table: {
              select: { tableNumber: true, capacity: true },
            },
            assignedTables: {
              include: {
                table: {
                  select: {
                    id: true,
                    tableNumber: true,
                    capacity: true,
                  },
                },
              },
            },
          },
        });

        await tx.reservationDeposit.create({
          data: {
            reservationId: created.id,
            amount: depositAmount,
            status: "PENDING",
          },
        });

        for (const requested of preorderItems) {
          const menuItem = menuById.get(requested.menuItemId);

          if (!menuItem) {
            throw new Error("A selected menu item is no longer available.");
          }

          await tx.reservationPreorderItem.create({
            data: {
              reservationId: created.id,
              menuItemId: menuItem.id,
              itemName: menuItem.name,
              quantity: requested.quantity,
              unitPrice: menuItem.price,
            },
          });
        }

        const assignedTables =
          created.assignedTables.length > 0
            ? created.assignedTables.map((assignment) => assignment.table)
            : [{ id: created.tableId, ...created.table }];

        return {
          id: created.id,
          date,
          startTime: created.startTime,
          endTime: created.endTime,
          guests: created.guests,
          status: created.status,
          notes: created.notes,
          customer: created.user,
          tables: assignedTables,
          table: formatTableSummary(assignedTables),
          deposit: {
            amount: depositAmount,
            currency: "INR",
            status: "PENDING",
            perGuest: DEPOSIT_PER_GUEST_RUPEES,
          },
          preorderItems: preorderItems.map((item) => {
            const menuItem = menuById.get(item.menuItemId)!;
            return {
              menuItemId: menuItem.id,
              itemName: menuItem.name,
              quantity: item.quantity,
              unitPrice: menuItem.price.toNumber(),
              lineTotal: menuItem.price.toNumber() * item.quantity,
            };
          }),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 20000,
      },
    );

    return NextResponse.json(
      {
        message:
          "Reservation created. Pay the mandatory deposit to confirm your booking.",
        reservation: result,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Reservation POST error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to submit your reservation.";

    const isConflict =
      message.toLowerCase().includes("no suitable tables") ||
      (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2034");

    return NextResponse.json(
      {
        error: isConflict
          ? "Availability changed while booking. Please try again."
          : message,
      },
      { status: isConflict ? 409 : 400 },
    );
  }
}
