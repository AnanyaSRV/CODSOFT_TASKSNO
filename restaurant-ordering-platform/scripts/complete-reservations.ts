
import "dotenv/config";
import { prisma } from "../lib/prisma";

async function completeOverdueReservations() {
  const result = await prisma.reservation.updateMany({
    where: {
      status: {
        notIn: ["CANCELLED", "COMPLETED"],
      },
      endTime: {
        lte: new Date(),
      },
    },
    data: {
      status: "COMPLETED",
    },
  });

  console.log(
    `[${new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    })} IST] Completed ${result.count} overdue reservation(s).`,
  );
}

completeOverdueReservations()
  .catch((error) => {
    console.error("Automatic reservation completion failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
