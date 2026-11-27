import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const userRoles = new Set([
  "SUPER_ADMIN",
  "OPERATIONS_MANAGER",
  "BOOKING_AGENT",
  "FINANCE_OFFICER",
  "CUSTOMER",
]);

export async function GET() {
  const session = await getStaffSession();
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Super-admin access required." }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      role: true,
      twoFactorEnabled: true,
      createdAt: true,
      _count: { select: { bookings: true } },
    },
  });
  return NextResponse.json({ users });
}

export async function PATCH(request: NextRequest) {
  const session = await getStaffSession();
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Super-admin access required." }, { status: 403 });
  }

  const body = (await request.json()) as { userId?: string; role?: string };
  if (!body.userId || !body.role || !userRoles.has(body.role)) {
    return NextResponse.json({ error: "A valid userId and role are required." }, { status: 400 });
  }
  if (body.userId === session.user.id && body.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "You cannot remove your own super-admin role." }, { status: 409 });
  }

  const target = await prisma.user.findUnique({
    where: { id: body.userId },
    select: { id: true, role: true },
  });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  try {
    const updated = await prisma.$transaction(async (transaction) => {
      if (target.role === "SUPER_ADMIN" && body.role !== "SUPER_ADMIN") {
        const superAdminCount = await transaction.user.count({ where: { role: "SUPER_ADMIN" } });
        if (superAdminCount < 2) {
          throw new Error("LAST_SUPER_ADMIN");
        }
      }
      const updated = await transaction.user.update({
        where: { id: target.id },
        data: { role: body.role as "SUPER_ADMIN" | "OPERATIONS_MANAGER" | "BOOKING_AGENT" | "FINANCE_OFFICER" | "CUSTOMER" },
        select: { id: true, name: true, email: true, role: true },
      });
      await transaction.auditLog.create({
        data: { actorId: session.user.id, action: "USER_ROLE_CHANGED", entityType: "User", entityId: target.id, metadata: { previousRole: target.role, newRole: body.role } },
      });
      return updated;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ user: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "LAST_SUPER_ADMIN") {
      return NextResponse.json({ error: "At least one super-admin must remain." }, { status: 409 });
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "A concurrent role update occurred. Reload and try again." }, { status: 409 });
    }
    console.error("Admin role update failed", error);
    return NextResponse.json({ error: "Could not update this user role." }, { status: 500 });
  }
}


export async function DELETE(request: NextRequest) {
  const session = await getStaffSession();
  if (!session || session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Super-admin access required." }, { status: 403 });
  let body: { userId?: string };
  try { body = await request.json() as { userId?: string }; }
  catch { return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 }); }
  if (!body.userId || typeof body.userId !== "string") return NextResponse.json({ error: "userId is required." }, { status: 400 });
  if (body.userId === session.user.id) return NextResponse.json({ error: "You cannot delete your own active super-admin account." }, { status: 409 });
  try {
    await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: body.userId }, select: { id: true, role: true } });
      if (!target) throw new Error("USER_NOT_FOUND");
      if (target.role === "SUPER_ADMIN" && await tx.user.count({ where: { role: "SUPER_ADMIN" } }) <= 1) throw new Error("LAST_SUPER_ADMIN");
      await tx.auditLog.create({ data: { actorId: session.user.id, action: "USER_DELETED", entityType: "User", entityId: null, metadata: { deletedRole: target.role } } });
      await tx.user.delete({ where: { id: target.id } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ success: true, deletedUserId: body.userId });
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_FOUND") return NextResponse.json({ error: "User not found." }, { status: 404 });
    if (error instanceof Error && error.message === "LAST_SUPER_ADMIN") return NextResponse.json({ error: "At least one super-admin must remain." }, { status: 409 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return NextResponse.json({ error: "A concurrent user change occurred. Reload and try again." }, { status: 409 });
    console.error("Admin user deletion failed", error);
    return NextResponse.json({ error: "Could not permanently delete this user." }, { status: 500 });
  }
}
