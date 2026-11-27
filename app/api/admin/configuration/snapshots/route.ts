import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { defaultAdminConfiguration } from "@/lib/admin-configuration";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getStaffSession();
  if (!session || session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Super-admin access required." }, { status: 403 });
  const snapshots = await prisma.configurationSnapshot.findMany({ take: 50, orderBy: { createdAt: "desc" }, select: { id: true, name: true, createdAt: true, createdBy: { select: { name: true, email: true } } } });
  return NextResponse.json({ snapshots });
}

export async function POST(request: NextRequest) {
  const session = await getStaffSession();
  if (!session || session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Super-admin access required." }, { status: 403 });
  let body: { name?: string };
  try { body = await request.json() as { name?: string }; }
  catch { return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const rows = await prisma.systemSetting.findMany();
  const settings = { ...defaultAdminConfiguration, ...Object.fromEntries(rows.map((row) => [row.key, row.value])) };
  const snapshot = await prisma.$transaction(async (tx) => {
    const created = await tx.configurationSnapshot.create({ data: { name: name || "Configuration snapshot " + new Date().toISOString(), settings, createdById: session.user.id } });
    await tx.auditLog.create({ data: { actorId: session.user.id, action: "CONFIGURATION_SNAPSHOT_CREATED", entityType: "ConfigurationSnapshot", entityId: created.id, metadata: { name: created.name } } });
    return created;
  });
  return NextResponse.json({ snapshot: { id: snapshot.id, name: snapshot.name, createdAt: snapshot.createdAt } }, { status: 201 });
}
