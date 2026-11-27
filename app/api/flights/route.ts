import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  AmadeusConfigurationError,
  searchFlightOffers,
} from "@/lib/amadeus";

const allowedOrigins = new Set(["ACC", "LOS", "LHR", "DXB"]);
const allowedDestinations = new Set(["ACC", "LOS", "LHR", "DXB"]);
const travelClasses: Record<string, string> = {
  Economy: "ECONOMY",
  "Premium Economy": "PREMIUM_ECONOMY",
  Business: "BUSINESS",
  "First Class": "FIRST",
};

export async function GET(request: NextRequest) {
  const runtimeSettings = await prisma.systemSetting.findMany({ where: { key: { in: ["maintenanceMode", "bookingEnabled"] } } });
  const settings = Object.fromEntries(runtimeSettings.map((item) => [item.key, item.value]));
  if (settings.maintenanceMode === true) return NextResponse.json({ error: "Flight search is temporarily unavailable during scheduled maintenance." }, { status: 503 });
  if (settings.bookingEnabled === false) return NextResponse.json({ error: "Online booking is currently disabled." }, { status: 403 });

  const parameters = request.nextUrl.searchParams;
  const origin = parameters.get("origin")?.trim().toUpperCase();
  const destination = parameters.get("destination")?.trim().toUpperCase();
  const departureDate = parameters.get("departureDate")?.trim();
  const returnDate = parameters.get("returnDate")?.trim() || undefined;
  const adults = Number(parameters.get("adults") ?? "1");
  const travelClass = travelClasses[parameters.get("travelClass") ?? "Economy"] ?? "ECONOMY";

  if (!origin || !destination || !departureDate) {
    return NextResponse.json({ error: "origin, destination, and departureDate are required." }, { status: 400 });
  }
  if (!allowedOrigins.has(origin) || !allowedDestinations.has(destination) || origin === destination) {
    return NextResponse.json({ error: "Invalid origin or destination." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate) || !Number.isInteger(adults) || adults < 1 || adults > 9) {
    return NextResponse.json({ error: "Invalid search parameters." }, { status: 400 });
  }
  if (returnDate && (!/^\d{4}-\d{2}-\d{2}$/.test(returnDate) || returnDate < departureDate)) {
    return NextResponse.json({ error: "Invalid return date." }, { status: 400 });
  }

  try {
    const flights = await searchFlightOffers({
      origin,
      destination,
      departureDate,
      returnDate,
      adults,
      travelClass,
    });
    return NextResponse.json({ flights });
  } catch (error) {
    if (error instanceof AmadeusConfigurationError) {
      return NextResponse.json({ error: error.message, code: "not_configured" }, { status: 503 });
    }
    console.error("Amadeus flight search failed", error);
    return NextResponse.json(
      { error: "Live flight search is temporarily unavailable.", code: "provider_error" },
      { status: 502 },
    );
  }
}
