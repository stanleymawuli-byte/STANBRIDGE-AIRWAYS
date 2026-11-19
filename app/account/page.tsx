import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuth } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { prisma } from "@/lib/prisma";
import { PaymentActions } from "@/components/payment-actions";
import { verifyPaystackPayment } from "@/lib/paystack";
import { TwoFactorSettings } from "@/components/two-factor-settings";
import { createAmadeusOrderForPaidBooking } from "@/lib/amadeus-orders";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Passenger account | StanBridge Airways",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const params = await searchParams;
  const reference = params.reference;
  if (reference) {
    const payment = await prisma.payment.findUnique({
      where: { reference },
      include: { booking: true },
    });
    if (payment?.booking.userId === session.user.id && payment.status !== "SUCCESS") {
      try {
        const transaction = await verifyPaystackPayment(reference);
        if (
          transaction?.status === "success" &&
          transaction.amount === payment.amountMinor &&
          transaction.currency === payment.currency
        ) {
          const [, bookingUpdated] = await prisma.$transaction([
            prisma.payment.update({
              where: { id: payment.id },
              data: {
                status: "SUCCESS",
                providerResponse: transaction.gateway_response ?? "success",
                verifiedAt: new Date(),
              },
            }),
            prisma.booking.updateMany({
              where: { id: payment.bookingId, status: "PENDING_PAYMENT" },
              data: { status: "CONFIRMED" },
            }),
          ]);
          if (bookingUpdated.count > 0) {
            await createAmadeusOrderForPaidBooking(payment.bookingId);
          }
        }
      } catch (error) {
        console.error("Paystack callback verification failed", error);
      }
    }
  }
  const bookings = await prisma.booking.findMany({
    where: { userId: session.user.id },
    include: { passengers: true, ticket: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="auth-page">
      <section className="auth-card account-card">
        <div className="eyebrow dark"><span /> PASSENGER ACCOUNT</div>
        <h1>Welcome, {session.user.name}</h1>
        <p className="auth-intro">You are signed in as {session.user.email}.</p>
        {session.user.role && session.user.role !== "CUSTOMER" && (
          <p className="auth-switch"><Link href="/admin">Open operations dashboard</Link></p>
        )}
        <TwoFactorSettings enabled={session.user.twoFactorEnabled ?? false} />
        <p className="auth-note">
          Booking records and ticket management are available for confirmed journeys.
        </p>
        <div className="booking-list">
          {bookings.length === 0 ? (
            <p className="auth-note">You have no bookings yet.</p>
          ) : bookings.map((booking) => (
            <article className="account-booking" key={booking.id}>
              <div>
                <strong>{booking.reference}</strong>
                <span>{booking.status.replaceAll("_", " ")}</span>
              </div>
              <h2>{booking.origin} to {booking.destination}</h2>
              <p>{booking.departureDate.toLocaleDateString()} · {booking.cabin}</p>
              <p>{booking.passengers.map((passenger) => `${passenger.firstName} ${passenger.lastName}`).join(", ")}</p>
              {booking.ticket && <p>Ticket: {booking.ticket.ticketNumber}</p>}
              <p>{booking.fareCurrency} {booking.fareAmount.toString()}</p>
              <p>Amadeus order: {booking.amadeusOrderStatus.replaceAll("_", " ")}</p>
              {booking.amadeusRecordLocator && <p>Airline record locator: {booking.amadeusRecordLocator}</p>}
              {booking.amadeusOrderError && <p className="auth-error">{booking.amadeusOrderError}</p>}
              <PaymentActions bookingId={booking.id} status={booking.status} />
            </article>
          ))}
        </div>
        <SignOutButton />
      </section>
      <Link className="auth-back" href="/">Back to StanBridge Airways</Link>
    </main>
  );
}
