
import "dotenv/config";
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { prisma } from "../lib/prisma";

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    console.log("\nDineDesk — Create Administrator Account\n");

    const name = (await rl.question("Administrator name: ")).trim();
    const email = (await rl.question("Administrator email: "))
      .trim()
      .toLowerCase();

    const password = await rl.question(
      "Password (minimum 12 characters; input will be visible): ",
    );

    if (!name || !email.includes("@") || password.length < 12) {
      throw new Error(
        "Enter a name, valid email, and password of at least 12 characters.",
      );
    }

    if (password.length > 72) {
      throw new Error("Password must not exceed 72 characters.");
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });

    if (existingUser) {
      throw new Error(
        `That email already exists with role ${existingUser.role}. No changes were made.`,
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "ADMIN",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    console.log("\nAdministrator created successfully:");
    console.log(`Name: ${admin.name}`);
    console.log(`Email: ${admin.email}`);
    console.log(`Role: ${admin.role}`);
    console.log("\nKeep your password private.");
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("\nAdmin setup failed:", error.message ?? error);
  process.exitCode = 1;
});
