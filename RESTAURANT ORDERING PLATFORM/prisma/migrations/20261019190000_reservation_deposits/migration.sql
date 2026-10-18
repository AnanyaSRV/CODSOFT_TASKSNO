ALTER TABLE "Order"
ADD COLUMN "depositCredit" DECIMAL(10,2) NOT NULL DEFAULT 0;

CREATE TABLE "ReservationDeposit" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "providerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationDeposit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReservationDeposit_reservationId_key"
ON "ReservationDeposit"("reservationId");

CREATE INDEX "ReservationDeposit_status_createdAt_idx"
ON "ReservationDeposit"("status", "createdAt");

CREATE TABLE "ReservationPreorderItem" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationPreorderItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReservationPreorderItem_reservationId_menuItemId_key"
ON "ReservationPreorderItem"("reservationId", "menuItemId");

CREATE INDEX "ReservationPreorderItem_reservationId_idx"
ON "ReservationPreorderItem"("reservationId");

ALTER TABLE "ReservationDeposit"
ADD CONSTRAINT "ReservationDeposit_reservationId_fkey"
FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReservationPreorderItem"
ADD CONSTRAINT "ReservationPreorderItem_reservationId_fkey"
FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReservationPreorderItem"
ADD CONSTRAINT "ReservationPreorderItem_menuItemId_fkey"
FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;