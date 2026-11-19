import { NextResponse } from "next/server";
import { configurationValues, parseConfiguration } from "@/lib/admin-config";
import { getStaffSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession();
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Super-admin access required." }, { status: 403 });
  }

  const { id } = await context.params;
  const backup = await prisma.systemConfigBackup.findUnique({
    where: { id },
    select: { id: true, config: true },
  });
  if (!backup) return NextResponse.json({ error: "Configuration backup not found." }, { status: 404 });

  const configuration = parseConfiguration(backup.config);
  if (!configuration) {
    return NextResponse.json({ error: "This backup contains invalid configuration and cannot be restored." }, { status: 409 });
  }

  const restored = await prisma.systemConfiguration.upsert({
    where: { id: "primary" },
    create: { id: "primary", ...configuration, updatedById: session.user.id },
    update: { ...configuration, updatedById: session.user.id },
  });
  return NextResponse.json({
    configuration: configurationValues(restored),
    restoredBackupId: backup.id,
    dataChanged: false,
  });
}
