import { createHmac } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();
const pepper = Buffer.from(process.env.PASSWORD_PEPPER ?? "", "base64");
if (pepper.length < 32) {
  throw new Error("PASSWORD_PEPPER must be base64-encoded random data of at least 32 bytes.");
}

const demoAccounts = [
  { role: "SUPER_ADMIN", name: "Demo Super Admin", prefix: "DEMO_SUPER_ADMIN" },
  { role: "OPERATIONS_MANAGER", name: "Demo Operations Manager", prefix: "DEMO_OPERATIONS_MANAGER" },
  { role: "BOOKING_AGENT", name: "Demo Booking Agent", prefix: "DEMO_BOOKING_AGENT" },
  { role: "FINANCE_OFFICER", name: "Demo Finance Officer", prefix: "DEMO_FINANCE_OFFICER" },
];
const commonPasswords = new Set([
  "admin",
  "changeme",
  "iloveyou",
  "letmein",
  "monkey",
  "password",
  "qwerty",
  "stanbridge",
  "welcome",
]);

try {
  for (const demoAccount of demoAccounts) {
    const email = process.env[`${demoAccount.prefix}_EMAIL`]?.trim().toLowerCase();
    const password = process.env[`${demoAccount.prefix}_PASSWORD`];
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`Set a valid ${demoAccount.prefix}_EMAIL in .env.local.`);
    }
    if (!password || password.length < 12 || password.length > 128) {
      throw new Error(`${demoAccount.prefix}_PASSWORD must be 12 to 128 characters.`);
    }
    const normalizedPassword = password.toLowerCase().replace(/[^a-z]/g, "");
    if ([...commonPasswords].some((candidate) => normalizedPassword.includes(candidate))) {
      throw new Error(`${demoAccount.prefix}_PASSWORD must not contain a common dictionary password.`);
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      include: { accounts: { where: { providerId: "credential" }, select: { id: true } } },
    });
    if (existing) {
      if (existing.role !== demoAccount.role || existing.accounts.length === 0) {
        throw new Error(`${email} already exists with a different role or without a password account; no changes were made to it.`);
      }
      console.log(`Kept existing ${demoAccount.role} account ${email}; its password was not changed.`);
      continue;
    }

    const passwordHash = await hashPassword(
      createHmac("sha256", pepper).update(password, "utf8").digest("base64url"),
    );
    await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: { name: demoAccount.name, email, emailVerified: true, role: demoAccount.role },
        select: { id: true },
      });
      await transaction.account.create({
        data: {
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: passwordHash,
        },
      });
    });
    console.log(`Created ${demoAccount.role} demo account ${email}; password stored as a salted hash with a server-side pepper.`);
  }
} finally {
  await prisma.$disconnect();
}
