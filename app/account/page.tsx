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
import { sendBookingConfirmationNotifications } from "@/lib/notifications";
import { 
  Plane, 
  Calendar, 
  Sparkles, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Passenger Dashboard | StanBridge Airways",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; payment?: string; booking?: string }>;
}) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const params = await searchParams;
  const reference = params.reference;
  let paymentVerifiedThisRequest = false;

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
          transaction.reference === payment.reference &&
          transaction.amount === payment.amountMinor
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
          paymentVerifiedThisRequest = true;
          if (bookingUpdated.count > 0) {
            try {
              await createAmadeusOrderForPaidBooking(payment.bookingId);
            } catch (err) {
              console.error("Amadeus fulfillment deferred", err);
            }
            void sendBookingConfirmationNotifications(payment.bookingId);
          }
        }
      } catch (error) {
        console.error("Paystack callback verification failed", error);
      }
    }
  }

  const isPaymentSuccess = paymentVerifiedThisRequest || params.payment === "success";

  const bookings = await prisma.booking.findMany({
    where: { userId: session.user.id },
    include: { passengers: true, ticket: true },
    orderBy: { createdAt: "desc" },
  });

  const confirmedCount = bookings.filter((b) => b.status === "CONFIRMED").length;
  const pendingCount = bookings.filter((b) => b.status === "PENDING_PAYMENT").length;
  const isStaff = session.user.role && session.user.role !== "CUSTOMER";

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-[#142b3d]">
      {/* Top Brand & Navigation Header */}
      <header className="bg-[#071d32] border-b border-[#1c3852] sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-white">
            <span className="w-10 h-10 rounded-full border border-[#c9a66b] flex items-center justify-center text-[#c9a66b] -rotate-12">
              <Plane className="w-5 h-5" />
            </span>
            <div>
              <strong className="block text-sm sm:text-base tracking-[0.2em] font-bold">STANBRIDGE</strong>
              <small className="block text-[8px] tracking-[0.35em] text-[#c9a66b] font-medium">A I R W A Y S</small>
            </div>
          </Link>

          <nav className="flex items-center gap-3 sm:gap-6">
            <Link 
              href="/#book" 
              className="text-xs sm:text-sm text-[#e1e6e9] hover:text-[#c9a66b] transition font-medium hidden sm:inline-block"
            >
              Book a Flight
            </Link>

            {isStaff && (
              <Link 
                href="/admin" 
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#c9a66b] hover:bg-[#dfc18f] text-[#071d32] text-xs font-bold tracking-wider uppercase rounded transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Operations Dashboard
              </Link>
            )}

            <div className="flex items-center gap-3 border-l border-[#244360] pl-3 sm:pl-6">
              <div className="text-right hidden md:block">
                <span className="block text-xs font-semibold text-white">{session.user.name}</span>
                <span className="block text-[10px] text-[#c9a66b] uppercase tracking-wider">
                  {session.user.role?.replaceAll("_", " ")}
                </span>
              </div>
              <SignOutButton />
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Payment Confirmation Banner */}
        {isPaymentSuccess && (
          <section className="bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0 text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-serif font-bold text-base text-emerald-950">
                  Payment Confirmed · Journey Ticketed
                </h2>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Your transaction has cleared successfully. Your airline reservation and ticket reference have been issued below.
                </p>
              </div>
            </div>
            <Link
              href="/account"
              className="text-xs font-semibold px-3.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-lg transition shrink-0"
            >
              Dismiss
            </Link>
          </section>
        )}
        {/* Operations Access Callout Banner if Staff */}
        {isStaff && (
          <section className="bg-gradient-to-r from-[#0d2b45] to-[#143a5c] text-white p-5 rounded-xl border border-[#c9a66b]/30 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-[#c9a66b]/20 rounded-lg text-[#c9a66b]">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-wide">
                  Staff Privileges Active ({session.user.role?.replaceAll("_", " ")})
                </h3>
                <p className="text-xs text-[#cad5dc] mt-0.5">
                  You have access to the Operations Dashboard to view revenue metrics, manage live flight orders, and oversee passenger manifests.
                </p>
              </div>
            </div>
            <Link
              href="/admin"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#c9a66b] hover:bg-[#d8b87e] text-[#071d32] text-xs font-bold tracking-wider uppercase rounded-lg transition shrink-0"
            >
              Open Operations Portal <ArrowRight className="w-4 h-4" />
            </Link>
          </section>
        )}

        {/* Passenger Hero / Profile Overview */}
        <section className="bg-[#071d32] text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-5 pointer-events-none flex items-center justify-center">
            <Plane className="w-96 h-96 -rotate-45" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#1c3852] pb-6">
            <div>
              <div className="flex items-center gap-2 text-[#c9a66b] text-xs font-bold tracking-[0.2em] uppercase">
                <Sparkles className="w-3.5 h-3.5" /> StanBridge Privilege Club
              </div>
              <h1 className="text-2xl sm:text-3xl font-serif font-medium mt-1 text-white">
                Welcome back, {session.user.name}
              </h1>
              <p className="text-xs sm:text-sm text-[#9fb0be] mt-1">
                Signed in as <span className="text-white font-medium">{session.user.email}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/#book"
                className="px-4 py-2.5 bg-[#c9a66b] hover:bg-[#d8b87e] text-[#071d32] text-xs font-bold tracking-wider uppercase rounded-lg transition flex items-center gap-2"
              >
                <Plane className="w-4 h-4" /> Book a New Flight
              </Link>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
            <div className="bg-[#0d2b45]/60 backdrop-blur border border-[#204464] p-4 rounded-xl">
              <span className="block text-[11px] uppercase tracking-wider text-[#9fb0be]">Total Journeys</span>
              <strong className="block text-2xl font-serif text-white mt-1">{bookings.length}</strong>
            </div>
            <div className="bg-[#0d2b45]/60 backdrop-blur border border-[#204464] p-4 rounded-xl">
              <span className="block text-[11px] uppercase tracking-wider text-[#9fb0be]">Confirmed Flights</span>
              <strong className="block text-2xl font-serif text-emerald-400 mt-1">{confirmedCount}</strong>
            </div>
            <div className="bg-[#0d2b45]/60 backdrop-blur border border-[#204464] p-4 rounded-xl">
              <span className="block text-[11px] uppercase tracking-wider text-[#9fb0be]">Pending Payment</span>
              <strong className="block text-2xl font-serif text-amber-400 mt-1">{pendingCount}</strong>
            </div>
            <div className="bg-[#0d2b45]/60 backdrop-blur border border-[#204464] p-4 rounded-xl">
              <span className="block text-[11px] uppercase tracking-wider text-[#9fb0be]">Member Tier</span>
              <strong className="block text-base font-semibold text-[#c9a66b] mt-1.5">
                {isStaff ? "Executive & Staff" : "Privilege Silver"}
              </strong>
            </div>
          </div>
        </section>

        {/* Dashboard Grid: Left Bookings (2 cols), Right Account Security (1 col) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Journeys List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-serif font-bold text-[#071d32]">Your Journeys & Bookings</h2>
                <p className="text-xs text-[#74818b] mt-0.5">Manage confirmed flights, complete pending payments, and view tickets.</p>
              </div>
              <Link 
                href="/#book" 
                className="text-xs font-semibold text-[#a17d4b] hover:text-[#071d32] flex items-center gap-1 transition"
              >
                Plan travel <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {bookings.length === 0 ? (
              <div className="bg-white border border-[#e8e4da] rounded-2xl p-10 text-center shadow-sm space-y-4">
                <div className="w-14 h-14 bg-[#f6f4ef] text-[#c9a66b] rounded-full flex items-center justify-center mx-auto">
                  <Plane className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-semibold text-[#071d32]">No Journeys Booked Yet</h3>
                  <p className="text-xs text-[#74818b] max-w-sm mx-auto mt-1">
                    Your scheduled flights, confirmed itineraries, and electronic tickets will appear here once booked.
                  </p>
                </div>
                <Link
                  href="/#book"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#071d32] hover:bg-[#143a5c] text-white text-xs font-semibold rounded-lg transition"
                >
                  Search Available Flights <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => {
                  const isConfirmed = booking.status === "CONFIRMED";
                  return (
                    <article 
                      key={booking.id}
                      className="bg-white border border-[#e8e4da] rounded-2xl p-6 shadow-sm hover:shadow-md transition relative overflow-hidden"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0eee8] pb-4">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-bold text-sm tracking-wider text-[#071d32] bg-[#f6f4ef] px-2.5 py-1 rounded">
                            {booking.reference}
                          </span>
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                            isConfirmed 
                              ? "bg-emerald-100 text-emerald-800" 
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {isConfirmed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                            {booking.status.replaceAll("_", " ")}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-xs text-[#74818b]">Total Fare: </span>
                          <span className="font-serif font-bold text-base text-[#071d32]">
                            {booking.fareCurrency} {booking.fareAmount.toString()}
                          </span>
                        </div>
                      </div>

                      {/* Flight Route Banner */}
                      <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-6">
                          <div>
                            <span className="text-2xl font-bold font-serif text-[#071d32]">{booking.origin}</span>
                            <span className="block text-[11px] text-[#74818b]">Departure</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-[#c9a66b] uppercase tracking-wider font-semibold">StanBridge</span>
                            <div className="w-20 h-0.5 bg-[#e8e4da] relative my-1">
                              <Plane className="w-3.5 h-3.5 text-[#c9a66b] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            </div>
                            <span className="text-[10px] text-[#74818b]">{booking.cabin}</span>
                          </div>
                          <div>
                            <span className="text-2xl font-bold font-serif text-[#071d32]">{booking.destination}</span>
                            <span className="block text-[11px] text-[#74818b]">Arrival</span>
                          </div>
                        </div>

                        <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-[#f0eee8]">
                          <span className="block text-xs font-semibold text-[#071d32] flex sm:justify-end items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-[#c9a66b]" />
                            {booking.departureDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                          </span>
                          <span className="block text-[11px] text-[#74818b] mt-0.5">
                            Passengers: {booking.passengers.map((p) => `${p.firstName} ${p.lastName}`).join(", ")}
                          </span>
                        </div>
                      </div>

                      {/* Ticketing & PNR Details */}
                      <div className="bg-[#fbfaf8] border border-[#f0ede6] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                          {booking.amadeusRecordLocator && (
                            <div className="flex items-center gap-2">
                              <span className="text-[#74818b]">Airline Record Locator (PNR):</span>
                              <strong className="font-mono text-[#071d32] bg-white px-2 py-0.5 border border-[#e8e4da] rounded">
                                {booking.amadeusRecordLocator}
                              </strong>
                            </div>
                          )}
                          {booking.ticket && (
                            <div className="flex items-center gap-2">
                              <span className="text-[#74818b]">Ticket Number:</span>
                              <strong className="font-mono text-emerald-800">{booking.ticket.ticketNumber}</strong>
                            </div>
                          )}
                          {!booking.amadeusRecordLocator && !booking.ticket && (
                            <span className="text-[#74818b]">
                              Amadeus Reservation: <strong className="text-[#071d32]">{booking.amadeusOrderStatus.replaceAll("_", " ")}</strong>
                            </span>
                          )}
                        </div>

                        <div>
                          <PaymentActions bookingId={booking.id} status={booking.status} />
                          {isConfirmed && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                              <CheckCircle2 className="w-4 h-4" /> Ready for Check-in
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Profile & Security Settings */}
          <div className="space-y-6">
            {/* Passenger Profile Card */}
            <div className="bg-white border border-[#e8e4da] rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3 border-b border-[#f0eee8] pb-4">
                <div className="w-10 h-10 rounded-full bg-[#f6f4ef] text-[#c9a66b] flex items-center justify-center font-bold font-serif text-lg">
                  {session.user.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#071d32]">{session.user.name}</h3>
                  <p className="text-xs text-[#74818b]">{session.user.email}</p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-[#f8f7f4]">
                  <span className="text-[#74818b]">Account Role</span>
                  <span className="font-semibold text-[#071d32]">{session.user.role?.replaceAll("_", " ")}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#f8f7f4]">
                  <span className="text-[#74818b]">Email Status</span>
                  <span className="font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#f8f7f4]">
                  <span className="text-[#74818b]">Membership</span>
                  <span className="font-semibold text-[#c9a66b]">Executive Privilege</span>
                </div>
              </div>
            </div>

            {/* Two-Factor Authentication Settings Component */}
            <div className="bg-white border border-[#e8e4da] rounded-2xl p-6 shadow-sm">
              <TwoFactorSettings enabled={session.user.twoFactorEnabled ?? false} />
            </div>

            {/* Travel Assistance Card */}
            <div className="bg-gradient-to-br from-[#071d32] to-[#122e47] text-white rounded-2xl p-6 shadow-sm space-y-3">
              <span className="text-[10px] uppercase tracking-widest text-[#c9a66b] font-bold">24/7 Concierge</span>
              <h4 className="text-base font-serif font-medium">StanBridge Private Assistance</h4>
              <p className="text-xs text-[#b8c7d3] leading-relaxed">
                Need to modify a route, request special assistance, or inquire about lounge access? Our executive desk is at your service.
              </p>
              <div className="pt-2">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 text-xs text-[#c9a66b] hover:text-[#dfc18f] font-semibold"
                >
                  Contact Airline Desk <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e8e4da] bg-white mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#74818b]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#071d32] tracking-wider">STANBRIDGE AIRWAYS</span>
            <span>· Connecting Continents. Elevating Journeys.</span>
          </div>
          <div>© {new Date().getFullYear()} StanBridge Airways. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
