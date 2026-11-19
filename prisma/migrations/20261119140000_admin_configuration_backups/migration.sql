CREATE TABLE "SystemConfiguration" (
  "id" TEXT NOT NULL DEFAULT 'primary',
  "supportEmail" TEXT NOT NULL DEFAULT 'support@stanbridgeairways.com',
  "bookingHoldMinutes" INTEGER NOT NULL DEFAULT 30,
  "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedById" TEXT,
  CONSTRAINT "SystemConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemConfigBackup" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "config" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  CONSTRAINT "SystemConfigBackup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SystemConfigBackup_createdAt_idx" ON "SystemConfigBackup"("createdAt");

ALTER TABLE "SystemConfiguration"
  ADD CONSTRAINT "SystemConfiguration_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SystemConfigBackup"
  ADD CONSTRAINT "SystemConfigBackup_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
