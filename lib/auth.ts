import "server-only";

import { createHmac } from "node:crypto";
import { betterAuth } from "better-auth";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new AuthConfigurationError(`Missing required environment variable: ${name}`);
  }
  return value;
}

function passwordPepper(): Buffer {
  const encoded = requiredEnvironmentValue("PASSWORD_PEPPER");
  const pepper = Buffer.from(encoded, "base64");
  if (pepper.length < 32) {
    throw new AuthConfigurationError(
      "PASSWORD_PEPPER must be base64-encoded random data of at least 32 bytes.",
    );
  }
  return pepper;
}

function pepperPassword(password: string): string {
  return createHmac("sha256", passwordPepper())
    .update(password, "utf8")
    .digest("base64url");
}

function createAuth() {
  let databaseUrl: URL;
  try {
    databaseUrl = new URL(requiredEnvironmentValue("DATABASE_URL"));
  } catch (error) {
    if (error instanceof AuthConfigurationError) throw error;
    throw new AuthConfigurationError("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }
  if (databaseUrl.protocol !== "postgresql:" && databaseUrl.protocol !== "postgres:") {
    throw new AuthConfigurationError("DATABASE_URL must use PostgreSQL.");
  }

  let appUrl: URL;
  try {
    appUrl = new URL(requiredEnvironmentValue("APP_URL"));
  } catch (error) {
    if (error instanceof AuthConfigurationError) throw error;
    throw new AuthConfigurationError("APP_URL must be a valid absolute URL.");
  }
  const secret = requiredEnvironmentValue("BETTER_AUTH_SECRET");
  if (appUrl.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new AuthConfigurationError("APP_URL must use HTTPS in production.");
  }
  if (appUrl.protocol !== "https:" && appUrl.protocol !== "http:") {
    throw new AuthConfigurationError("APP_URL must use HTTP or HTTPS.");
  }
  if (Buffer.from(secret, "base64").length < 32) {
    throw new AuthConfigurationError(
      "BETTER_AUTH_SECRET must be base64-encoded random data of at least 32 bytes.",
    );
  }

  passwordPepper();
  if (secret === process.env.PASSWORD_PEPPER?.trim()) {
    throw new AuthConfigurationError(
      "BETTER_AUTH_SECRET and PASSWORD_PEPPER must be different values.",
    );
  }

  return betterAuth({
    appName: "StanBridge Airways",
    baseURL: appUrl.origin,
    secret,
    trustedOrigins: [appUrl.origin],
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 3600,
      sendResetPassword: async ({ user, url }) => {
        await sendPasswordResetEmail({ user, url });
      },
      password: {
        hash: (password) => hashPassword(pepperPassword(password)),
        verify: ({ password, hash }) =>
          verifyPassword({ password: pepperPassword(password), hash }),
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }) => {
        await sendVerificationEmail({ user, url });
      },
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          input: false,
          defaultValue: "CUSTOMER",
        },
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 20,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
      },
    },
    advanced: {
      useSecureCookies: appUrl.protocol === "https:",
    },
    plugins: [
      twoFactor({
        issuer: "StanBridge Airways",
        twoFactorCookieMaxAge: 300,
        accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 900 },
      }),
      nextCookies(),
    ],
  });

}

let authInstance: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  authInstance ??= createAuth();
  return authInstance;
}
