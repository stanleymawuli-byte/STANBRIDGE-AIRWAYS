import { headers } from "next/headers";
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptTotpSecret } from "@/lib/totp-decrypt";

export async function GET() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const twoFactor = await prisma.twoFactor.findUnique({
    where: { userId: session.user.id },
  });

  if (!twoFactor?.secret) {
    return NextResponse.json(
      { error: "Two-factor authentication secret not found for this account." },
      { status: 404 },
    );
  }

  const plainSecret = await decryptTotpSecret(twoFactor.secret);
  const email = session.user.email;
  const totpURI = `otpauth://totp/StanBridge%20Airways:${encodeURIComponent(email)}?secret=${plainSecret}&issuer=StanBridge%20Airways`;

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
      secret: plainSecret,
      totpURI,
      qrCodeDataUrl,
    });
  } catch (error) {
    console.error("Failed to generate QR code", error);
    return NextResponse.json(
      { error: "Failed to render QR code." },
      { status: 500 },
    );
  }
}
