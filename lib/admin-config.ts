import "server-only";

import type { SystemConfiguration } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ConfigurationValues = {
  supportEmail: string;
  bookingHoldMinutes: number;
  maintenanceMode: boolean;
};

export function configurationValues(configuration: SystemConfiguration): ConfigurationValues {
  return {
    supportEmail: configuration.supportEmail,
    bookingHoldMinutes: configuration.bookingHoldMinutes,
    maintenanceMode: configuration.maintenanceMode,
  };
}

export function parseConfiguration(value: unknown): ConfigurationValues | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const configuration = value as Record<string, unknown>;
  if (
    typeof configuration.supportEmail !== "string" ||
    configuration.supportEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuration.supportEmail) ||
    typeof configuration.bookingHoldMinutes !== "number" ||
    !Number.isInteger(configuration.bookingHoldMinutes) ||
    configuration.bookingHoldMinutes < 5 ||
    configuration.bookingHoldMinutes > 120 ||
    typeof configuration.maintenanceMode !== "boolean"
  ) {
    return null;
  }
  return {
    supportEmail: configuration.supportEmail,
    bookingHoldMinutes: configuration.bookingHoldMinutes,
    maintenanceMode: configuration.maintenanceMode,
  };
}

export function getSystemConfiguration(updatedById?: string) {
  return prisma.systemConfiguration.upsert({
    where: { id: "primary" },
    update: {},
    create: { id: "primary", ...(updatedById ? { updatedById } : {}) },
  });
}
