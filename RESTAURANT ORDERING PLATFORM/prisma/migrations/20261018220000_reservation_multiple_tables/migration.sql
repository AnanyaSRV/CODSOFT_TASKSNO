
-- Add support for assigning multiple tables to one reservation.
-- Existing reservations remain unchanged.

CREATE TABLE "ReservationTableAssignment" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationTableAssignment_pkey"
        PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReservationTableAssignment_reservationId_tableId_key"
    ON "ReservationTableAssignment"("reservationId", "tableId");

CREATE INDEX "ReservationTableAssignment_tableId_idx"
    ON "ReservationTableAssignment"("tableId");

CREATE INDEX "RestaurantTable_isActive_capacity_idx"
    ON "RestaurantTable"("isActive", "capacity");

ALTER TABLE "ReservationTableAssignment"
    ADD CONSTRAINT "ReservationTableAssignment_reservationId_fkey"
    FOREIGN KEY ("reservationId")
    REFERENCES "Reservation"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "ReservationTableAssignment"
    ADD CONSTRAINT "ReservationTableAssignment_tableId_fkey"
    FOREIGN KEY ("tableId")
    REFERENCES "RestaurantTable"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
