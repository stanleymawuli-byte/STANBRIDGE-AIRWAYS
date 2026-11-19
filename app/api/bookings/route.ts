import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSystemConfiguration } from "@/lib/admin-config";
import { isAmadeusOffer, isInternationalPhoneNumber, priceFlightOffer } from "@/lib/amadeus";

function reference() {
  return `SB${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function GET() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const bookings = await prisma.booking.findMany({
    where: { userId: session.user.id },
    include: { passengers: true, ticket: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ bookings });
}

export async function POST(request: NextRequest) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const configuration = await getSystemConfiguration();
  if (configuration.maintenanceMode) {
    return NextResponse.json({ error: "Booking is temporarily unavailable while maintenance is in progress." }, { status: 503 });
  }

  const body = (await request.json()) as {
    offerId?: string;
    origin?: string;
    destination?: string;
    departureDate?: string;
    returnDate?: string;
    cabin?: string;
    expectedPrice?: number;
    expectedCurrency?: string;
    offer?: unknown;
    passengers?: Array<{
      title?: string;
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      email?: string;
      phone?: string;
      passportNumber?: string;
      nationality?: string;
      gender?: string;
    }>;
  };

  const passengerCount = body.passengers?.length ?? 0;
  if (!body.offerId || !body.origin || !body.destination || !body.departureDate || passengerCount < 1) {
    return NextResponse.json({ error: "Offer and passenger details are required." }, { status: 400 });
  }
  if (passengerCount > 9) {
    return NextResponse.json({ error: "A maximum of nine passengers is allowed." }, { status: 400 });
  }

  const departureDate = new Date(`${body.departureDate}T00:00:00.000Z`);
  const today = new Date().toISOString().slice(0, 10);
  if (
    Number.isNaN(departureDate.getTime()) ||
    departureDate.toISOString().slice(0, 10) !== body.departureDate ||
    body.departureDate < today
  ) {
    return NextResponse.json({ error: "Invalid departure date." }, { status: 400 });
  }
  if (body.returnDate) {
    const parsedReturnDate = new Date(`${body.returnDate}T00:00:00.000Z`);
    if (
      Number.isNaN(parsedReturnDate.getTime()) ||
      parsedReturnDate.toISOString().slice(0, 10) !== body.returnDate ||
      body.returnDate < body.departureDate
    ) {
      return NextResponse.json({ error: "Invalid return date." }, { status: 400 });
    }
  }
  if (
    !isAmadeusOffer(body.offer) ||
    body.offer.id !== body.offerId ||
    !Number.isFinite(body.expectedPrice) ||
    !body.expectedCurrency
  ) {
    return NextResponse.json({ error: "A valid selected Amadeus offer is required." }, { status: 400 });
  }

  let offer;
  try {
    offer = await priceFlightOffer(body.offer);
  } catch (error) {
    console.error("Amadeus flight repricing failed", error);
    return NextResponse.json(
      { error: "This fare can no longer be confirmed. Search again for current availability." },
      { status: 409 },
    );
  }
  const price = Number(offer.price.total);
  const displayedPrice = Number(body.expectedPrice);
  if (
    !Number.isFinite(price) ||
    offer.price.currency !== body.expectedCurrency ||
    Math.round(price * 100) !== Math.round(displayedPrice * 100)
  ) {
    return NextResponse.json(
      { error: "The fare changed. Search again and review the current price before booking." },
      { status: 409 },
    );
  }
  const firstSegment = offer.itineraries[0]?.segments[0];
  const lastSegment = offer.itineraries[0]?.segments.at(-1);
  const returnSegment = offer.itineraries[1]?.segments[0];
  if (
    !firstSegment ||
    !lastSegment ||
    firstSegment.departure.iataCode !== body.origin ||
    lastSegment.arrival.iataCode !== body.destination ||
    firstSegment.departure.at.slice(0, 10) !== body.departureDate ||
    (body.returnDate
      ? !returnSegment ||
        returnSegment.departure.iataCode !== body.destination ||
        offer.itineraries[1]?.segments.at(-1)?.arrival.iataCode !== body.origin ||
        returnSegment.departure.at.slice(0, 10) !== body.returnDate
      : offer.itineraries.length !== 1)
  ) {
    return NextResponse.json({ error: "The selected offer does not match your journey." }, { status: 400 });
  }

  for (const passenger of body.passengers ?? []) {
    if (
      !passenger.title ||
      !passenger.firstName?.trim() ||
      !passenger.lastName?.trim() ||
      !passenger.dateOfBirth ||
      !/^\d{4}-\d{2}-\d{2}$/.test(passenger.dateOfBirth) ||
      Number.isNaN(new Date(`${passenger.dateOfBirth}T00:00:00.000Z`).getTime()) ||
      new Date(`${passenger.dateOfBirth}T00:00:00.000Z`).toISOString().slice(0, 10) !== passenger.dateOfBirth ||
      passenger.dateOfBirth >= today ||
      !["MALE", "FEMALE"].includes(passenger.gender ?? "") ||
      !passenger.email?.trim() ||
      !passenger.phone?.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(passenger.email.trim()) ||
      !isInternationalPhoneNumber(passenger.phone)
    ) {
      return NextResponse.json(
        { error: "Each traveler needs a title, name, date of birth, gender, email, and international phone number." },
        { status: 400 },
      );
    }
  }

  const travelerCount = offer.travelerPricings?.length;
  if (travelerCount !== undefined && travelerCount !== passengerCount) {
    return NextResponse.json({ error: "Passenger count does not match the selected flight offer." }, { status: 400 });
  }

  const bookingReference = reference();
  const booking = await prisma.booking.create({
    data: {
      reference: bookingReference,
      userId: session.user.id,
      origin: body.origin,
      destination: body.destination,
      departureDate,
      returnDate: body.returnDate ? new Date(body.returnDate) : null,
      cabin: body.cabin ?? "Economy",
      airline: offer.validatingAirlineCodes?.join(", ") ?? firstSegment.carrierCode,
      fareCurrency: offer.price.currency,
      fareAmount: price,
      amadeusOfferId: offer.id,
      amadeusOfferData: JSON.parse(JSON.stringify(offer)) as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + configuration.bookingHoldMinutes * 60 * 1000),
      passengers: {
        create: (body.passengers ?? []).map((passenger) => ({
          type: "ADULT",
          title: passenger.title!,
          firstName: passenger.firstName!.trim(),
          lastName: passenger.lastName!.trim(),
          dateOfBirth: new Date(passenger.dateOfBirth!),
          email: passenger.email?.trim() || null,
          phone: passenger.phone?.trim() || null,
          passportNumber: passenger.passportNumber?.trim() || null,
          nationality: passenger.nationality?.trim() || null,
          gender: passenger.gender!,
        })),
      },
    },
    include: { passengers: true },
  });

  return NextResponse.json({ booking }, { status: 201 });
}
