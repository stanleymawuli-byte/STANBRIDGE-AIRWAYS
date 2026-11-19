CREATE TYPE "AmadeusOrderStatus" AS ENUM ('NOT_CREATED', 'PROCESSING', 'CREATED', 'FAILED', 'CANCELLED');

ALTER TABLE "Booking"
  ADD COLUMN "amadeusOfferData" JSONB,
  ADD COLUMN "amadeusOrderStatus" "AmadeusOrderStatus" NOT NULL DEFAULT 'NOT_CREATED',
  ADD COLUMN "amadeusOrderId" TEXT,
  ADD COLUMN "amadeusRecordLocator" TEXT,
  ADD COLUMN "amadeusOrderError" TEXT,
  ADD COLUMN "amadeusCreatedAt" TIMESTAMP(3);

ALTER TABLE "Passenger" ADD COLUMN "gender" TEXT NOT NULL DEFAULT 'UNSPECIFIED';

CREATE UNIQUE INDEX "Booking_amadeusOrderId_key" ON "Booking"("amadeusOrderId");
