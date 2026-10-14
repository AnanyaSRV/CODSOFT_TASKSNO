
import "dotenv/config";
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { PrismaClient } from "../app/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  const terminal = createInterface({ input: stdin, output: stdout });

  try {
    const name = (await terminal.question("Administrator name: ")).trim();
    const email = (
      await terminal.question("Administrator email: ")
    ).trim().toLowerCase();
    const password = await terminal.question(
      "Administrator password (minimum 12 characters): "
    );

    if (!name || !email.includes("@") || password.length < 12) {
      throw new Error(
        "Enter a name, a valid email address, and a password of at least 12 characters."
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.upsert({
      where: { email },
      update: {
        name,
        passwordHash,
        role: "ADMIN",
        active: true,
      },
      create: {
        name,
        email,
        passwordHash,
        role: "ADMIN",
        active: true,
      },
    });

    console.log(`Administrator account created or updated for ${email}.`);
  } finally {
    terminal.close();
  }
}

main()
  .catch((error) => {
    console.error("Administrator setup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
