import "server-only";

import { parsePhoneNumberFromString } from "libphonenumber-js";

export type AmadeusFlight = {
  id: string;
  origin: string;
  destination: string;
  depart: string;
  arrive: string;
  duration: string;
  price: number;
  currency: string;
  airline: string;
  stops: number;
  offer: AmadeusOffer;
};

export type AmadeusOffer = {
  id: string;
  type: string;
  itineraries: Array<{
    duration?: string;
    segments: Array<{
      departure: { iataCode: string; at: string };
      arrival: { iataCode: string; at: string };
      carrierCode: string;
    }>;
  }>;
  price: { total: string; currency: string };
  validatingAirlineCodes?: string[];
  travelerPricings?: Array<{
    travelerId: string;
    fareDetailsBySegment?: Array<{
      segmentId: string;
      cabin?: string;
      fareBasis?: string;
      class?: string;
    }>;
  }>;
  [key: string]: unknown;
};

type Offer = AmadeusOffer;

const tokenCache: { value?: string; expiresAt?: number } = {};

export class AmadeusConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmadeusConfigurationError";
  }
}

export function isAmadeusOffer(value: unknown): value is AmadeusOffer {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const offer = value as Record<string, unknown>;
  if (
    typeof offer.id !== "string" ||
    typeof offer.type !== "string" ||
    !Array.isArray(offer.itineraries) ||
    !offer.price ||
    typeof offer.price !== "object"
  ) return false;
  if (
    offer.itineraries.length === 0 ||
    !Array.isArray(offer.travelerPricings) ||
    offer.travelerPricings.length === 0
  ) return false;
  const validItineraries = offer.itineraries.every((itinerary) => {
    if (!itinerary || typeof itinerary !== "object" || !("segments" in itinerary)) return false;
    const segments = (itinerary as { segments?: unknown }).segments;
    return Array.isArray(segments) && segments.length > 0 && segments.every((segment) => {
      if (!segment || typeof segment !== "object") return false;
      const flightSegment = segment as Record<string, unknown>;
      return (
        typeof flightSegment.carrierCode === "string" &&
        !!flightSegment.departure &&
        typeof flightSegment.departure === "object" &&
        typeof (flightSegment.departure as Record<string, unknown>).iataCode === "string" &&
        typeof (flightSegment.departure as Record<string, unknown>).at === "string" &&
        !!flightSegment.arrival &&
        typeof flightSegment.arrival === "object" &&
        typeof (flightSegment.arrival as Record<string, unknown>).iataCode === "string" &&
        typeof (flightSegment.arrival as Record<string, unknown>).at === "string"
      );
    });
  });
  if (!validItineraries) return false;
  const price = offer.price as Record<string, unknown>;
  return (
    typeof price.total === "string" &&
    typeof price.currency === "string" &&
    offer.travelerPricings.every((travelerPricing) =>
      !!travelerPricing &&
      typeof travelerPricing === "object" &&
      typeof (travelerPricing as Record<string, unknown>).travelerId === "string"
    )
  );
}

function getCredentials() {
  const clientId = process.env.AMADEUS_CLIENT_ID?.trim();
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new AmadeusConfigurationError(
      "Amadeus credentials are not configured. Set AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET.",
    );
  }
  return { clientId, clientSecret };
}

function baseUrl() {
  return process.env.AMADEUS_ENV === "production"
    ? "https://api.amadeus.com"
    : "https://test.api.amadeus.com";
}

async function accessToken() {
  if (tokenCache.value && tokenCache.expiresAt && Date.now() < tokenCache.expiresAt) {
    return tokenCache.value;
  }

  const { clientId, clientSecret } = getCredentials();
  const response = await fetch(`${baseUrl()}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Amadeus authentication failed (${response.status}).`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  tokenCache.value = data.access_token;
  tokenCache.expiresAt = Date.now() + Math.max(60, data.expires_in - 60) * 1000;
  return data.access_token;
}

function isoTime(value: string) {
  return new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function humanDuration(value?: string) {
  if (!value) return "";
  const match = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(value);
  if (!match) return value;
  const hours = match[1] ? `${match[1]}h` : "";
  const minutes = match[2] ? ` ${match[2]}m` : "";
  return `${hours}${minutes}`.trim();
}

export async function searchFlightOffers(input: {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  travelClass: string;
}) {
  const token = await accessToken();
  const parameters = new URLSearchParams({
    originLocationCode: input.origin,
    destinationLocationCode: input.destination,
    departureDate: input.departureDate,
    adults: String(input.adults),
    travelClass: input.travelClass,
    currencyCode: "USD",
    max: "12",
  });
  if (input.returnDate) parameters.set("returnDate", input.returnDate);

  const response = await fetch(
    `${baseUrl()}/v2/shopping/flight-offers?${parameters.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Amadeus flight search failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const data = (await response.json()) as { data?: Offer[] };
  return (data.data ?? []).map((offer): AmadeusFlight => {
    const outbound = offer.itineraries[0];
    const firstSegment = outbound?.segments[0];
    const lastSegment = outbound?.segments[outbound.segments.length - 1];
    return {
      id: offer.id,
      origin: firstSegment?.departure.iataCode ?? input.origin,
      destination: lastSegment?.arrival.iataCode ?? input.destination,
      depart: firstSegment ? isoTime(firstSegment.departure.at) : "--",
      arrive: lastSegment ? isoTime(lastSegment.arrival.at) : "--",
      duration: humanDuration(outbound?.duration),
      price: Number(offer.price.total),
      currency: offer.price.currency,
      airline: offer.validatingAirlineCodes?.join(", ") ?? firstSegment?.carrierCode ?? "",
      stops: Math.max(0, (outbound?.segments.length ?? 1) - 1),
      offer,
    };
  });
}

async function amadeusRequest(path: string, init: RequestInit = {}) {
  const token = await accessToken();
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.amadeus+json",
      "Content-Type": "application/vnd.amadeus+json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | { data?: unknown; errors?: Array<{ detail?: string; title?: string; code?: number }> }
    | null;
  if (!response.ok) {
    const detail = payload?.errors?.map((error) => error.detail ?? error.title).filter(Boolean).join("; ");
    throw new Error(`Amadeus request failed (${response.status})${detail ? `: ${detail}` : "."}`);
  }
  return payload?.data;
}

export async function priceFlightOffer(offer: AmadeusOffer): Promise<AmadeusOffer> {
  const data = await amadeusRequest("/v1/shopping/flight-offers/pricing", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "flight-offers-pricing",
        flightOffers: [offer],
      },
    }),
  });
  if (!data || typeof data !== "object" || !("flightOffers" in data)) {
    throw new Error("Amadeus returned an invalid priced flight offer.");
  }
  const flightOffers = (data as { flightOffers?: AmadeusOffer[] }).flightOffers;
  if (!flightOffers?.[0] || !isAmadeusOffer(flightOffers[0])) {
    throw new Error("Amadeus returned no valid priced flight offer.");
  }
  return flightOffers[0];
}

export type AmadeusTravelerInput = {
  id: string;
  title: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email: string;
  phone: string;
};

function splitPhoneNumber(phone: string) {
  const parsed = parsePhoneNumberFromString(phone);
  if (!parsed?.isValid()) {
    throw new Error("Passenger phone numbers must include an international country code, such as +233...");
  }
  return { countryCallingCode: parsed.countryCallingCode, number: parsed.nationalNumber };
}

export function isInternationalPhoneNumber(phone: string) {
  try {
    splitPhoneNumber(phone);
    return true;
  } catch {
    return false;
  }
}

export async function createFlightOrder(input: {
  offer: AmadeusOffer;
  travelers: AmadeusTravelerInput[];
}) {
  if (input.travelers.length === 0) throw new Error("At least one traveler is required.");
  const travelers = input.travelers.map((traveler) => {
    const phone = splitPhoneNumber(traveler.phone);
    return {
      id: traveler.id,
      dateOfBirth: traveler.dateOfBirth,
      name: {
        firstName: traveler.firstName,
        lastName: traveler.lastName,
        title: traveler.title,
      },
      gender: traveler.gender,
      contact: {
        emailAddress: traveler.email,
        phones: [{
          deviceType: "MOBILE",
          countryCallingCode: phone.countryCallingCode,
          number: phone.number,
        }],
      },
    };
  });
  const lead = input.travelers[0];
  const leadPhone = splitPhoneNumber(lead.phone);
  const data = await amadeusRequest("/v1/booking/flight-orders", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "flight-order",
        flightOffers: [input.offer],
        travelers,
        contacts: [{
          addresseeName: { firstName: lead.firstName, lastName: lead.lastName },
          companyName: "StanBridge Airways",
          purpose: "STANDARD",
          phones: [{
            deviceType: "MOBILE",
            countryCallingCode: leadPhone.countryCallingCode,
            number: leadPhone.number,
          }],
          emailAddress: lead.email,
        }],
      },
    }),
  });
  if (!data || typeof data !== "object" || !("id" in data) || typeof data.id !== "string") {
    throw new Error("Amadeus returned an invalid flight order.");
  }
  const orderData = data as {
    id: string;
    associatedRecords?: Array<{ reference?: string; originSystemCode?: string }>;
  };
  const recordLocator = orderData.associatedRecords?.find(
    (record) => record.originSystemCode === "GDS" || record.reference,
  )?.reference;
  return { id: orderData.id, recordLocator };
}

export async function getFlightOrder(orderId: string) {
  return amadeusRequest(`/v1/booking/flight-orders/${encodeURIComponent(orderId)}`);
}

export async function cancelFlightOrder(orderId: string) {
  await amadeusRequest(`/v1/booking/flight-orders/${encodeURIComponent(orderId)}`, {
    method: "DELETE",
  });
}
