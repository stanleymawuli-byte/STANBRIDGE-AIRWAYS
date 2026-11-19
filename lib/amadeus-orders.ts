import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  AmadeusTravelerInput,
  createFlightOrder,
  isAmadeusOffer,
  priceFlightOffer,
} from "@/lib/amadeus";

export async function createAmadeusOrderForPaidBooking(bookingId: string) {
  const claim = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: "CONFIRMED",
      amadeusOrderStatus: "NOT_CREATED",
      payments: { some: { status: "SUCCESS" } },
    },
    data: { amadeusOrderStatus: "PROCESSING", amadeusOrderError: null },
  });
  if (claim.count === 0) {
    return prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        amadeusOrderStatus: true,
        amadeusOrderId: true,
        amadeusRecordLocator: true,
        amadeusOrderError: true,
      },
    });
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { passengers: true },
    });
    if (!booking || !isAmadeusOffer(booking.amadeusOfferData)) {
      throw new Error("Stored Amadeus offer data is missing or invalid.");
    }

    const pricedOffer = await priceFlightOffer(booking.amadeusOfferData);
    if (
      pricedOffer.price.currency !== booking.fareCurrency ||
      Math.round(Number(pricedOffer.price.total) * 100) !== Math.round(Number(booking.fareAmount) * 100)
    ) {
      throw new Error("Amadeus fare changed after payment; manual payment review is required.");
    }
    if (pricedOffer.travelerPricings && pricedOffer.travelerPricings.length !== booking.passengers.length) {
      throw new Error("Amadeus traveler count does not match the booking.");
    }

    const travelers: AmadeusTravelerInput[] = booking.passengers.map((passenger, index) => {
      if (!passenger.phone || !passenger.email || passenger.gender === "UNSPECIFIED") {
        throw new Error("Traveler contact or gender information is incomplete.");
      }
      return {
        id: String(index + 1),
        title: passenger.title,
        firstName: passenger.firstName,
        lastName: passenger.lastName,
        dateOfBirth: passenger.dateOfBirth.toISOString().slice(0, 10),
        gender: passenger.gender,
        email: passenger.email,
        phone: passenger.phone,
      };
    });
    const order = await createFlightOrder({ offer: pricedOffer, travelers });

    return await prisma.booking.update({
      where: { id: booking.id },
      data: {
        amadeusOfferData: JSON.parse(JSON.stringify(pricedOffer)) as Prisma.InputJsonValue,
        amadeusOrderStatus: "CREATED",
        amadeusOrderId: order.id,
        amadeusRecordLocator: order.recordLocator,
        amadeusOrderError: null,
        amadeusCreatedAt: new Date(),
      },
      select: {
        id: true,
        amadeusOrderStatus: true,
        amadeusOrderId: true,
        amadeusRecordLocator: true,
        amadeusOrderError: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Amadeus order creation failed.";
    console.error("Amadeus order creation failed for booking", bookingId, error);
    return prisma.booking.update({
      where: { id: bookingId },
      data: {
        amadeusOrderStatus: "FAILED",
        amadeusOrderError: message.slice(0, 500),
      },
      select: {
        id: true,
        amadeusOrderStatus: true,
        amadeusOrderId: true,
        amadeusRecordLocator: true,
        amadeusOrderError: true,
      },
    });
  }
}
