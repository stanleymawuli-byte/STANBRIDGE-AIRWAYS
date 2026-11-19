import { NextRequest, NextResponse } from "next/server";
import { configurationValues, getSystemConfiguration, parseConfiguration } from "@/lib/admin-config";
import { getStaffSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getStaffSession();
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Super-admin access required." }, { status: 403 });
  }
  const configuration = await getSystemConfiguration();
  return NextResponse.json({ configuration: configurationValues(configuration) });
}

export async function PATCH(request: NextRequest) {
  const session = await getStaffSession();
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Super-admin access required." }, { status: 403 });
  }

  const configuration = parseConfiguration(await request.json());
  if (!configuration) {
    return NextResponse.json({
      error: "Provide a valid support email, a booking hold from 5 to 120 minutes, and a maintenance-mode setting.",
    }, { status: 400 });
  }

  const saved = await prisma.systemConfiguration.upsert({
    where: { id: "primary" },
    create: { id: "primary", ...configuration, updatedById: session.user.id },
    update: { ...configuration, updatedById: session.user.id },
  });
  return NextResponse.json({ configuration: configurationValues(saved) });
}
