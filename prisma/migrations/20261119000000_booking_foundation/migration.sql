CREATE TYPE "BookingStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "PassengerType" AS ENUM ('ADULT', 'CHILD');

CREATE TABLE "Booking" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "userId" TEXT NOT NULL,
  "origin" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "departureDate" TIMESTAMP(3) NOT NULL,
  "returnDate" TIMESTAMP(3),
  "cabin" TEXT NOT NULL,
  "airline" TEXT,
  "fareCurrency" TEXT NOT NULL,
  "fareAmount" DECIMAL(12,2) NOT NULL,
  "amadeusOfferId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Passenger" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "type" "PassengerType" NOT NULL DEFAULT 'ADULT',
  "title" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "dateOfBirth" TIMESTAMP(3) NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "passportNumber" TEXT,
  "nationality" TEXT,
  CONSTRAINT "Passenger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ticket" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "ticketNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");
CREATE INDEX "Booking_userId_idx" ON "Booking"("userId");
CREATE INDEX "Booking_status_idx" ON "Booking"("status");
CREATE INDEX "Booking_expiresAt_idx" ON "Booking"("expiresAt");
CREATE INDEX "Passenger_bookingId_idx" ON "Passenger"("bookingId");
CREATE UNIQUE INDEX "Ticket_bookingId_key" ON "Ticket"("bookingId");
CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON "Ticket"("ticketNumber");
CREATE INDEX "Ticket_ticketNumber_idx" ON "Ticket"("ticketNumber");

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Passenger" ADD CONSTRAINT "Passenger_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
