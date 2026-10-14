
import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "../app/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      role: { in: ["TEACHER", "STUDENT"] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: [{ role: "asc" }, { email: "asc" }],
  });

  if (users.length === 0) {
    console.log("No Teacher or Student accounts were found.");
    return;
  }

  const credentials: {
    name: string;
    email: string;
    role: string;
    temporaryPassword: string;
  }[] = [];

  for (const user of users) {
    const temporaryPassword = randomBytes(18).toString("base64url");
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    credentials.push({
      name: user.name,
      email: user.email,
      role: user.role,
      temporaryPassword,
    });
  }

  console.log("\nPassword reset completed.");
  console.log("Save these credentials securely; they are shown only once.\n");

  console.table(credentials);
}

main()
  .catch((error) => {
    console.error("Password reset failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
