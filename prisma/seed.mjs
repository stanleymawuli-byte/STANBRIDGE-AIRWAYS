import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { createHmac } from "node:crypto";

const prisma = new PrismaClient();
const pepperEncoded = process.env.PASSWORD_PEPPER;
if (!pepperEncoded) throw new Error("PASSWORD_PEPPER must be configured before seeding.");
const pepper = Buffer.from(pepperEncoded, "base64");
if (pepper.length < 32) throw new Error("PASSWORD_PEPPER must decode to at least 32 random bytes.");

const demoUsers = [
  { email: process.env.DEMO_SUPER_ADMIN_EMAIL || "demo.superadmin@stanbridge.local", name: "Demo Super Administrator", role: "SUPER_ADMIN", passwordEnv: "DEMO_SUPER_ADMIN_PASSWORD" },
  { email: process.env.DEMO_OPERATIONS_EMAIL || "demo.operations@stanbridge.local", name: "Demo Operations Manager", role: "OPERATIONS_MANAGER", passwordEnv: "DEMO_OPERATIONS_PASSWORD" },
  { email: process.env.DEMO_BOOKING_EMAIL || "demo.booking@stanbridge.local", name: "Demo Booking Agent", role: "BOOKING_AGENT", passwordEnv: "DEMO_BOOKING_PASSWORD" },
  { email: process.env.DEMO_FINANCE_EMAIL || "demo.finance@stanbridge.local", name: "Demo Finance Officer", role: "FINANCE_OFFICER", passwordEnv: "DEMO_FINANCE_PASSWORD" },
];

function validatePassword(password, email) {
  const weak = ["password", "qwerty", "welcome", "admin", "stanbridge", "airways", "123456", "iloveyou", "letmein", "football", "monkey", "dragon"];
  const normalized = password.toLowerCase();
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (password.length < 12 || password.length > 128 || classes < 3 || weak.some((term) => normalized.includes(term)) || normalized.includes(email.split("@")[0].toLowerCase()) || /(.)\1{5,}/.test(password) || /(0123456789|1234567890|9876543210)/.test(password)) {
    throw new Error(email + ": use a unique 12+ character password with at least three character types; common words and patterns are not allowed.");
  }
}

async function main() {
  const users = {};
  for (const item of demoUsers) {
    const password = process.env[item.passwordEnv];
    if (!password) throw new Error("Set " + item.passwordEnv + " in .env.local before running the seed.");
    validatePassword(password, item.email);
    const user = await prisma.user.upsert({
      where: { email: item.email },
      create: { name: item.name, email: item.email, emailVerified: true, role: item.role, twoFactorEnabled: false },
      update: { name: item.name, emailVerified: true, role: item.role },
    });
    const peppered = createHmac("sha256", pepper).update(password, "utf8").digest("base64url");
    const passwordHash = await hashPassword(peppered);
    await prisma.account.upsert({
      where: { providerId_accountId: { providerId: "credential", accountId: user.id } },
      create: { accountId: user.id, providerId: "credential", userId: user.id, password: passwordHash },
      update: { password: passwordHash },
    });
    users[item.role] = user;
  }
  const samples = [
    { reference: "SB-DEMO-CANCELLED-001", origin: "ACC", destination: "LHR", fareAmount: "1250.00" },
    { reference: "SB-DEMO-CANCELLED-002", origin: "ACC", destination: "JFK", fareAmount: "1840.00" },
    { reference: "SB-DEMO-CANCELLED-003", origin: "ACC", destination: "DXB", fareAmount: "980.00" },
  ];
  for (const [index, sample] of samples.entries()) {
    await prisma.booking.upsert({
      where: { reference: sample.reference },
      create: {
        reference: sample.reference, status: "CANCELLED", userId: users.SUPER_ADMIN.id,
        origin: sample.origin, destination: sample.destination,
        departureDate: new Date(Date.now() + (index + 30) * 86400000), cabin: "ECONOMY",
        fareCurrency: "USD", fareAmount: sample.fareAmount, amadeusOfferId: "DEMO-OFFER-" + (index + 1),
        amadeusOfferData: { demo: true, note: "Seeded cancelled booking; not a live airline reservation." },
        expiresAt: new Date(Date.now() + 60 * 86400000),
      },
      update: {},
    });
  }
  console.log("Seed complete: four staff roles and three cancelled demonstration bookings.");
  console.log("All four staff accounts must enroll in 2FA before accessing the admin portal.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
