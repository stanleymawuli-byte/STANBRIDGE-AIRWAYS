import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { configurationValues, getSystemConfiguration } from "@/lib/admin-config";
import { getStaffSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getStaffSession();
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Super-admin access required." }, { status: 403 });
  }

  const backups = await prisma.systemConfigBackup.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      createdAt: true,
      createdBy: { select: { name: true, email: true } },
    },
  });
  return NextResponse.json({ backups });
}

export async function POST(request: NextRequest) {
  const session = await getStaffSession();
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Super-admin access required." }, { status: 403 });
  }

  const body = await request.json() as { label?: unknown } | null;
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  if (label.length > 80) {
    return NextResponse.json({ error: "Backup labels must be 80 characters or fewer." }, { status: 400 });
  }

  const configuration = await getSystemConfiguration();
  const backup = await prisma.systemConfigBackup.create({
    data: {
      label: label || `Configuration backup ${new Date().toISOString()}`,
      config: configurationValues(configuration) as Prisma.InputJsonValue,
      createdById: session.user.id,
    },
    select: { id: true, label: true, createdAt: true },
  });
  return NextResponse.json({ backup }, { status: 201 });
}
