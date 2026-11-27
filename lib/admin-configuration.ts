import "server-only";

export const defaultAdminConfiguration = {
  maintenanceMode: false,
  bookingEnabled: true,
  supportEmail: "support@stanbridgeairways.com",
  announcement: "",
  displayCurrency: "USD",
} as const;

export type AdminConfiguration = {
  maintenanceMode: boolean;
  bookingEnabled: boolean;
  supportEmail: string;
  announcement: string;
  displayCurrency: "USD" | "GHS" | "GBP" | "EUR";
};

export function validateAdminConfiguration(value: unknown): AdminConfiguration | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const currencies = ["USD", "GHS", "GBP", "EUR"];
  if (typeof input.maintenanceMode !== "boolean" || typeof input.bookingEnabled !== "boolean") return null;
  if (typeof input.supportEmail !== "string" || input.supportEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.supportEmail)) return null;
  if (typeof input.announcement !== "string" || input.announcement.length > 500) return null;
  if (typeof input.displayCurrency !== "string" || !currencies.includes(input.displayCurrency)) return null;
  return { maintenanceMode: input.maintenanceMode, bookingEnabled: input.bookingEnabled, supportEmail: input.supportEmail, announcement: input.announcement, displayCurrency: input.displayCurrency as AdminConfiguration["displayCurrency"] };
}
