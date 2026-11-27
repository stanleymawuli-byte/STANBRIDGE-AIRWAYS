import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { createHmac } from "node:crypto";

const prisma = new PrismaClient();

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}. Add it to .env.local first.`);
  return value;
}

function validatePassword(password, email) {
  const common = [
    "password", "passw0rd", "p@ssword", "qwerty", "welcome", "letmein",
    "admin", "stanbridge", "airways", "iloveyou", "123456", "abc123",
    "password1", "changeme", "secret", "login", "root", "test",
  ];
  const lower = password.toLowerCase();
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (
    password.length < 12 ||
    password.length > 128 ||
    classes < 3 ||
    common.some((word) => lower.includes(word)) ||
    lower.includes(email.split("@")[0].toLowerCase()) ||
    /(.)\\1{5,}/.test(password) ||
    /(0123456789|1234567890|9876543210)/.test(password)
  ) {
    throw new Error("Use a unique 12–128 character password with at least three character types; avoid common words and predictable patterns.");
  }
}

async function main() {
  if (required("CONFIRM_ADMIN_RESET") !== "RESET_STANBRIDGE_ADMIN") {
    throw new Error("Set CONFIRM_ADMIN_RESET=RESET_STANBRIDGE_ADMIN to confirm this one-account reset.");
  }

  const email = (process.env.ADMIN_EMAIL || "demo.superadmin@stanbridge.local").trim().toLowerCase();
  const name = (process.env.ADMIN_NAME || "StanBridge Super Administrator").trim();
  const password = required("ADMIN_PASSWORD");
  const pepper = Buffer.from(required("PASSWORD_PEPPER"), "base64");
  if (pepper.length < 32) throw new Error("PASSWORD_PEPPER must decode to at least 32 random bytes.");
  if (!/^\\S+@\\S+\\.\\S+$/.test(email)) throw new Error("ADMIN_EMAIL must be a valid email address.");
  if (password === process.env.BETTER_AUTH_SECRET || password === process.env.PASSWORD_PEPPER) {
    throw new Error("Choose a password different from the application secrets.");
  }
  validatePassword(password, email);

  const pepperedPassword = createHmac("sha256", pepper).update(password, "utf8").digest("base64url");
  const passwordHash = await hashPassword(pepperedPassword);

  const user = await prisma.$transaction(async (tx) => {
    const accountUser = await tx.user.upsert({
      where: { email },
      create: { name, email, emailVerified: true, role: "SUPER_ADMIN", twoFactorEnabled: false },
      update: { name, emailVerified: true, role: "SUPER_ADMIN", twoFactorEnabled: false },
    });

    await tx.session.deleteMany({ where: { userId: accountUser.id } });
    await tx.twoFactor.deleteMany({ where: { userId: accountUser.id } });
    await tx.account.upsert({
      where: {
        providerId_accountId: {
          providerId: "credential",
          accountId: accountUser.id,
        },
      },
      create: {
        accountId: accountUser.id,
        providerId: "credential",
        userId: accountUser.id,
        password: passwordHash,
      },
      update: { password: passwordHash },
    });

    return accountUser;
  });

  console.log("StanBridge Super Admin account reset successfully.");
  console.log(`Login email: ${user.email}`);
  console.log("Password: the ADMIN_PASSWORD value you entered locally (not displayed).");
  console.log("All existing sessions for this account were revoked.");
  console.log("Two-factor enrollment was reset for this account; sign in and enroll 2FA again before opening /admin.");
  console.log("No bookings, passengers, tickets, payments, or other users were changed.");
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
