import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { validateAdminConfiguration } from "@/lib/admin-configuration";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getStaffSession();
  if (!session || session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Super-admin access required." }, { status: 403 });
  const { id } = await context.params;
  const snapshot = await prisma.configurationSnapshot.findUnique({ where: { id } });
  if (!snapshot) return NextResponse.json({ error: "Configuration snapshot not found." }, { status: 404 });
  const configuration = validateAdminConfiguration(snapshot.settings);
  if (!configuration) return NextResponse.json({ error: "This snapshot is invalid and cannot be restored." }, { status: 409 });
  const entries = Object.entries(configuration);
  await prisma.$transaction(async (tx) => {
    const keys = entries.map(([key]) => key);
    await tx.systemSetting.deleteMany({ where: keys.length ? { key: { notIn: keys } } : {} });
    for (const [key, value] of entries) {
      await tx.systemSetting.upsert({ where: { key }, create: { key, value, updatedById: session.user.id }, update: { value, updatedById: session.user.id } });
    }
    await tx.auditLog.create({ data: { actorId: session.user.id, action: "CONFIGURATION_SNAPSHOT_RESTORED", entityType: "ConfigurationSnapshot", entityId: snapshot.id, metadata: { name: snapshot.name, dataTablesModified: false } } });
  });
  return NextResponse.json({ success: true, configuration, dataTablesModified: false });
}
