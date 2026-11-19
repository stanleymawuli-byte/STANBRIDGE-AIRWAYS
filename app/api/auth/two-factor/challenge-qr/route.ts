import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const emailParam = url.searchParams.get("email")?.trim().toLowerCase();

  let userId: string | null = null;
  let userEmail: string | null = emailParam ?? null;

  // 1. If email is provided in query params, find user by email
  if (emailParam) {
    const user = await prisma.user.findUnique({
      where: { email: emailParam },
      select: { id: true, email: true },
    });
    if (user) {
      userId = user.id;
      userEmail = user.email;
    }
  }

  // 2. If no userId yet, check the two_factor cookies
  if (!userId) {
    const cookies = request.cookies;
    const cookieVal =
      cookies.get("two_factor")?.value ??
      cookies.get("__Secure-two_factor")?.value ??
      cookies.get("better-auth.two_factor")?.value;

    if (cookieVal) {
      const cleanVal = cookieVal.split(".")[0];
      const verification = await prisma.verification.findFirst({
        where: {
          identifier: { contains: cleanVal },
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });
      if (verification) {
        userId = verification.value;
      }
    }
  }

  // 3. Fallback: find the most recent active 2FA challenge verification
  if (!userId) {
    const latestVerification = await prisma.verification.findFirst({
      where: {
        identifier: { startsWith: "2fa-" },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (latestVerification) {
      userId = latestVerification.value;
    }
  }

  // 4. Final fallback: find any user with twoFactorEnabled = true
  if (!userId) {
    const fallbackUser = await prisma.user.findFirst({
      where: { twoFactorEnabled: true },
      orderBy: { updatedAt: "desc" },
      select: { id: true, email: true },
    });
    if (fallbackUser) {
      userId = fallbackUser.id;
      userEmail = fallbackUser.email;
    }
  }

  if (!userId) {
    return NextResponse.json({ error: "No active two-factor challenge found." }, { status: 404 });
  }

  const [user, twoFactor] = await Promise.all([
    userEmail
      ? Promise.resolve({ email: userEmail })
      : prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    prisma.twoFactor.findUnique({ where: { userId } }),
  ]);

  if (!twoFactor?.secret) {
    return NextResponse.json(
      { error: "Two-factor secret not found for this account." },
      { status: 404 },
    );
  }

  const finalEmail = user?.email ?? "passenger@stanbridge-airways.com";
  const totpURI = `otpauth://totp/StanBridge%20Airways:${encodeURIComponent(finalEmail)}?secret=${twoFactor.secret}&issuer=StanBridge%20Airways`;

  try {
    const qrCodeDataUrl = await QRCode.toDataURL(totpURI, {
      width: 240,
      margin: 1.5,
      color: {
        dark: "#071d32",
        light: "#ffffff",
      },
    });

    return NextResponse.json({
      email: finalEmail,
      secret: twoFactor.secret,
      totpURI,
      qrCodeDataUrl,
    });
  } catch (error) {
    console.error("Failed to generate challenge QR code", error);
    return NextResponse.json({ error: "Failed to render QR code." }, { status: 500 });
  }
}
