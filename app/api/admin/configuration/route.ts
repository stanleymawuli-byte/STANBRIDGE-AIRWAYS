import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { defaultAdminConfiguration, validateAdminConfiguration } from "@/lib/admin-configuration";

export const dynamic = "force-dynamic";

async function readConfiguration() {
  const rows = await prisma.systemSetting.findMany();
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return { ...defaultAdminConfiguration, ...stored };
}

export async function GET() {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  return NextResponse.json({ configuration: await readConfiguration() });
}

export async function PATCH(request: NextRequest) {
  const session = await getStaffSession();
  if (!session || session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Super-admin access required." }, { status: 403 });
  let body: { configuration?: unknown };
  try { body = await request.json() as { configuration?: unknown }; }
  catch { return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 }); }
  const configuration = validateAdminConfiguration(body.configuration);
  if (!configuration) return NextResponse.json({ error: "Configuration values are invalid." }, { status: 400 });
  await prisma.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(configuration)) {
      await tx.systemSetting.upsert({ where: { key }, create: { key, value, updatedById: session.user.id }, update: { value, updatedById: session.user.id } });
    }
    await tx.auditLog.create({ data: { actorId: session.user.id, action: "SYSTEM_CONFIGURATION_UPDATED", entityType: "SystemSetting", metadata: configuration } });
  });
  return NextResponse.json({ configuration });
}
