import "server-only";

import { prisma } from "@/lib/prisma";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";

function getBaseAppUrl(): string {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

export async function sendBookingConfirmationNotifications(bookingId: string): Promise<{
  emailsSent: string[];
  smsSent: string[];
}> {
  const emailsSent: string[] = [];
  const smsSent: string[] = [];

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        passengers: true,
        user: { select: { id: true, name: true, email: true } },
        ticket: true,
      },
    });

    if (!booking) {
      console.warn(`[StanBridge Notifications] Booking ${bookingId} not found.`);
      return { emailsSent, smsSent };
    }

    const appUrl = getBaseAppUrl();
    const accountUrl = `${appUrl}/account`;
    const departureDateFormatted = booking.departureDate.toISOString().slice(0, 10);
    const returnDateFormatted = booking.returnDate
      ? booking.returnDate.toISOString().slice(0, 10)
      : null;

    // 1. Collect and deduplicate email recipients
    const emailRecipients = new Map<string, string>(); // email -> recipient name

    // Add user account email
    if (booking.user?.email) {
      emailRecipients.set(booking.user.email.toLowerCase(), booking.user.name || "Valued Passenger");
    }

    // Add passenger emails
    for (const passenger of booking.passengers) {
      if (passenger.email?.trim()) {
        const pEmail = passenger.email.trim().toLowerCase();
        if (!emailRecipients.has(pEmail)) {
          emailRecipients.set(pEmail, `${passenger.firstName} ${passenger.lastName}`.trim());
        }
      }
    }

    // 2. Collect and deduplicate phone recipients
    const phoneRecipients = new Set<string>();
    for (const passenger of booking.passengers) {
      if (passenger.phone?.trim()) {
        phoneRecipients.add(passenger.phone.trim());
      }
    }

    // 3. Dispatch Emails
    for (const [email, name] of emailRecipients.entries()) {
      try {
        await sendBookingConfirmationEmail({
          to: email,
          recipientName: name,
          bookingReference: booking.reference,
          origin: booking.origin,
          destination: booking.destination,
          departureDate: departureDateFormatted,
          returnDate: returnDateFormatted,
          cabin: booking.cabin,
          fareAmount: Number(booking.fareAmount).toLocaleString(),
          fareCurrency: booking.fareCurrency,
          recordLocator: booking.amadeusRecordLocator,
          ticketNumber: booking.ticket?.ticketNumber,
          passengers: booking.passengers.map((p) => ({
            firstName: p.firstName,
            lastName: p.lastName,
          })),
          accountUrl,
        });
        emailsSent.push(email);
        console.log(`[StanBridge Notifications] Confirmation email dispatched to ${email}`);
      } catch (err) {
        console.error(`[StanBridge Notifications] Failed to send email to ${email}:`, err);
      }
    }

    // 4. Dispatch SMS
    const pnrText = booking.amadeusRecordLocator ? ` PNR: ${booking.amadeusRecordLocator}.` : "";
    const ticketText = booking.ticket?.ticketNumber ? ` Ticket: ${booking.ticket.ticketNumber}.` : "";
    const smsBody = `StanBridge Airways: Flight booked & confirmed! Ref: ${booking.reference}.${pnrText}${ticketText} ${booking.origin}->${booking.destination} on ${departureDateFormatted}. View pass: ${accountUrl}`;

    for (const phone of phoneRecipients) {
      try {
        const success = await sendSms({
          to: phone,
          body: smsBody,
        });
        if (success) {
          smsSent.push(phone);
        }
      } catch (err) {
        console.error(`[StanBridge Notifications] Failed to send SMS to ${phone}:`, err);
      }
    }
  } catch (error) {
    console.error(`[StanBridge Notifications] Global error sending notifications for booking ${bookingId}:`, error);
  }

  return { emailsSent, smsSent };
}
