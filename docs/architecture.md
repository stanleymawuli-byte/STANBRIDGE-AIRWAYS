# StanBridge Airways architecture

This document defines the intended boundaries for the phased implementation. It does not imply that the listed future modules are already implemented.

## Application layers

- **Web interface:** Next.js App Router pages and reusable React components.
- **Backend:** Next.js server route handlers and server-only application services.
- **Persistence:** PostgreSQL accessed through Prisma; credentials stay on the server.
- **Flight provider:** Amadeus sandbox, isolated behind a server-side adapter.
- **Payments:** Paystack sandbox, isolated behind a server-side adapter. The browser never supplies an authoritative amount, and the application never handles raw card details.

## Intended module layout

```text
app/                         Routes and page composition
components/                  Shared presentation components
lib/auth.ts                  Better Auth server configuration
lib/auth-client.ts           Browser-side auth client
lib/prisma.ts                Server-only Prisma client
lib/integrations/amadeus/    Flight-provider adapter
lib/integrations/paystack/   Payment-provider adapter
prisma/                      PostgreSQL schema and migrations
tests/                       Unit and integration tests
```

Keep provider credentials and database access in server-only modules. Client components call application endpoints; they must not call Amadeus or Paystack using secret credentials.

## Booking and payment invariants

1. Search results are not reservations; confirm current price and availability with Amadeus before creating a booking.
2. Persist a booking and its server-verified amount before initializing payment.
3. Verify Paystack transactions on the backend, including amount, currency, booking reference and transaction status.
4. Make callbacks/webhooks idempotent and reconcile payment and ticketing failures explicitly.
5. Never store card numbers or CVV. Do not report a ticket as issued until the airline/provider confirms it.

## Environment and deployment

Use `.env.local` for local secrets and a managed secret store for deployments. `.env.example` contains names and placeholders only. Production requires HTTPS, a managed PostgreSQL database, tested backups, restricted database credentials, secret rotation and monitored provider webhooks. Vercel or another host must support the server runtime and network access required by the database and providers.

## Phase status

The current milestone adds PostgreSQL/Prisma models for Better Auth users, accounts,
sessions, verification, database-backed rate limits and TOTP storage. Email/password
registration and login use Better Auth with Scrypt password hashes, an HMAC pepper,
server-managed sessions and rate limits. Public registration can only create
`CUSTOMER` accounts. Protected account pages verify sessions on the server.

Outbound email is not configured, so email verification and password recovery are
disabled. TOTP backend support is installed, but enrollment UI and mandatory
administrator 2FA are not complete. There is no administrator bootstrap, flight
provider integration, booking or payment workflow yet. Apply the checked-in
PostgreSQL migration only after configuring the target database; never use a
development database URL against production.
