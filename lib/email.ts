import "server-only";

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

function getEmailCredentials() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  return { apiKey, from };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

export async function sendEmail(message: EmailMessage) {
  const { apiKey, from } = getEmailCredentials();
  if (!apiKey || !from) {
    console.warn(
      `[StanBridge Email] Resend delivery is not configured (missing RESEND_API_KEY or EMAIL_FROM). Email to ${message.to} was not sent via network.`,
    );
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const responseText = await response.text();
    console.error(`Email delivery failed (${response.status}): ${responseText.slice(0, 300)}`);
  }
}

export async function sendVerificationEmail({
  user,
  url,
}: {
  user: { name: string; email: string };
  url: string;
}) {
  const name = escapeHtml(user.name);
  const safeUrl = escapeHtml(url);
  await sendEmail({
    to: user.email,
    subject: "Verify your StanBridge Airways email",
    text: `Hello ${user.name}, verify your email address: ${url}`,
    html: `<p>Hello ${name},</p><p>Please verify your email address to activate your StanBridge Airways account.</p><p><a href="${safeUrl}">Verify email address</a></p><p>If you did not create an account, you can ignore this message.</p>`,
  });
}

export async function sendPasswordResetEmail({
  user,
  url,
}: {
  user: { name: string; email: string };
  url: string;
}) {
  const name = escapeHtml(user.name);
  const safeUrl = escapeHtml(url);
  await sendEmail({
    to: user.email,
    subject: "Reset your StanBridge Airways password",
    text: `Hello ${user.name}, reset your password: ${url}`,
    html: `<p>Hello ${name},</p><p>We received a request to reset your StanBridge Airways password.</p><p><a href="${safeUrl}">Choose a new password</a></p><p>If you did not request this, you can ignore this message. The link expires in one hour.</p>`,
  });
}

export type BookingConfirmationEmailParams = {
  to: string;
  recipientName: string;
  bookingReference: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string | null;
  cabin: string;
  fareAmount: string | number;
  fareCurrency: string;
  recordLocator?: string | null;
  ticketNumber?: string | null;
  passengers: Array<{ firstName: string; lastName: string }>;
  accountUrl: string;
};

export async function sendBookingConfirmationEmail(params: BookingConfirmationEmailParams) {
  const safeName = escapeHtml(params.recipientName);
  const safeRef = escapeHtml(params.bookingReference);
  const safeOrigin = escapeHtml(params.origin);
  const safeDest = escapeHtml(params.destination);
  const safeCabin = escapeHtml(params.cabin);
  const safeUrl = escapeHtml(params.accountUrl);
  const pnrText = params.recordLocator ? ` (PNR: ${params.recordLocator})` : "";
  const ticketText = params.ticketNumber ? `\nTicket Number: ${params.ticketNumber}` : "";

  const subject = `Confirmed: StanBridge Flight ${params.origin} → ${params.destination} [Ref: ${params.bookingReference}]`;

  const textBody = `Dear ${params.recipientName},

Your StanBridge Airways flight has been confirmed!

Booking Reference: ${params.bookingReference}${pnrText}${ticketText}
Route: ${params.origin} to ${params.destination}
Departure Date: ${params.departureDate}${params.returnDate ? `\nReturn Date: ${params.returnDate}` : ""}
Cabin Class: ${params.cabin}
Total Fare: ${params.fareCurrency} ${params.fareAmount}

Travelers:
${params.passengers.map((p) => `- ${p.firstName} ${p.lastName}`).join("\n")}

You can access your electronic boarding pass, itinerary, and receipt in your passenger dashboard:
${params.accountUrl}

Thank you for choosing StanBridge Airways.
Connecting Continents. Elevating Journeys.`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fbf8f3; margin: 0; padding: 24px; color: #142b3d; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e5ded5; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background-color: #071d32; padding: 32px 24px; text-align: center; color: #ffffff; }
    .brand { font-size: 20px; font-weight: 700; letter-spacing: 0.2em; color: #ffffff; margin: 0; }
    .brand-tag { font-size: 11px; letter-spacing: 0.35em; color: #c9a66b; margin-top: 4px; display: block; }
    .content { padding: 32px 28px; }
    .badge { display: inline-block; background-color: #eaf6ee; color: #1e7e34; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 16px; }
    .title { font-size: 22px; font-weight: 700; margin: 0 0 8px 0; color: #071d32; }
    .flight-box { background-color: #f8f7f4; border: 1px solid #e7e2d9; border-radius: 6px; padding: 20px; margin: 24px 0; }
    .route { font-size: 20px; font-weight: bold; color: #071d32; display: flex; align-items: center; justify-content: space-between; }
    .details-row { display: flex; justify-content: space-between; border-bottom: 1px solid #e7e2d9; padding: 8px 0; font-size: 14px; }
    .details-row:last-child { border-bottom: none; }
    .label { color: #667085; }
    .val { font-weight: 600; color: #071d32; }
    .btn { display: inline-block; background-color: #071d32; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 14px; margin-top: 16px; text-align: center; }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #8e8d8a; background-color: #fbf8f3; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">STANBRIDGE</div>
      <span class="brand-tag">A I R W A Y S</span>
    </div>
    <div class="content">
      <div class="badge">Booking Confirmed</div>
      <h2 class="title">You are ready to fly, ${safeName}</h2>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.5;">Your flight reservation has been successfully booked and confirmed. Below is a summary of your itinerary.</p>
      
      <div class="flight-box">
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 16px; color: #071d32;">
          ${safeOrigin} &rarr; ${safeDest}
        </div>
        <div class="details-row"><span class="label">Booking Reference</span><span class="val" style="color: #c9a66b; font-family: monospace; font-size: 16px;">${safeRef}</span></div>
        ${params.recordLocator ? `<div class="details-row"><span class="label">Airline PNR</span><span class="val" style="font-family: monospace;">${escapeHtml(params.recordLocator)}</span></div>` : ""}
        ${params.ticketNumber ? `<div class="details-row"><span class="label">E-Ticket Number</span><span class="val" style="font-family: monospace;">${escapeHtml(params.ticketNumber)}</span></div>` : ""}
        <div class="details-row"><span class="label">Departure Date</span><span class="val">${escapeHtml(params.departureDate)}</span></div>
        ${params.returnDate ? `<div class="details-row"><span class="label">Return Date</span><span class="val">${escapeHtml(params.returnDate)}</span></div>` : ""}
        <div class="details-row"><span class="label">Travel Class</span><span class="val">${safeCabin}</span></div>
        <div class="details-row"><span class="label">Total Paid</span><span class="val">${escapeHtml(params.fareCurrency)} ${params.fareAmount}</span></div>
      </div>

      <div style="margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #667085;">Confirmed Passengers</h4>
        <ul style="padding-left: 20px; margin: 0; font-size: 14px; color: #142b3d;">
          ${params.passengers.map((p) => `<li style="margin-bottom: 4px;"><strong>${escapeHtml(p.firstName)} ${escapeHtml(p.lastName)}</strong></li>`).join("")}
        </ul>
      </div>

      <div style="text-align: center; margin-top: 32px;">
        <a class="btn" href="${safeUrl}">View Flight Itinerary &amp; Boarding Pass</a>
      </div>
    </div>
    <div class="footer">
      &copy; 2026 StanBridge Airways. Connecting Continents. Elevating Journeys.<br/>
      Need assistance? Reply directly to this email or visit our help center.
    </div>
  </div>
</body>
</html>`;

  await sendEmail({
    to: params.to,
    subject,
    text: textBody,
    html: htmlBody,
  });
}
