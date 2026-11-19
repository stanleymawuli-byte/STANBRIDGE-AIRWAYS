CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'ABANDONED');

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "provider" TEXT NOT NULL DEFAULT 'PAYSTACK',
  "currency" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "authorizationUrl" TEXT,
  "accessCode" TEXT,
  "providerResponse" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
