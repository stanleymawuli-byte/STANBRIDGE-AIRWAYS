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
Database queries use Prisma's parameterized operations rather than concatenating
user input into SQL, for example:

```ts
const account = await prisma.user.findUnique({
  where: { email: submittedEmail.trim().toLowerCase() },
});
```

## Booking and payment invariants

1. Search results are not reservations; confirm current price and availability with Amadeus before creating a booking.
2. Persist a booking and its server-verified amount before initializing payment.
3. Verify Paystack transactions on the backend, including amount, currency, booking reference and transaction status.
4. Make callbacks/webhooks idempotent and reconcile payment and ticketing failures explicitly.
5. Never store card numbers or CVV. Do not report a ticket as issued until the airline/provider confirms it.

## Environment and deployment

Use `.env.local` for local secrets and a managed secret store for deployments. `.env.example` contains names and placeholders only. Production requires HTTPS, a managed PostgreSQL database, tested backups, restricted database credentials, secret rotation and monitored provider webhooks. Vercel or another host must support the server runtime and network access required by the database and providers.

## Current implementation and deployment status

The app includes customer registration and recovery, salted Scrypt password hashes
with a separate HMAC pepper, common-password rejection, database-backed
rate-limits, mandatory Google Authenticator-compatible TOTP, booking and payment flows, Amadeus
test integration, and a role-protected operations dashboard. Public sign-up can
only create `CUSTOMER` accounts. The admin interface includes reports, hard
account deletion with related-record cascade behavior, configurable booking
settings, and configuration-only restore points. The mobile experience is a
responsive installable web app, not a native iOS/Android application.

Configuration backups include only the settings stored in `SystemConfiguration`;
they cannot restore or replace users, credentials, bookings, passenger data, or
payments. Production database recovery must use separately managed PostgreSQL
backups and tested restore procedures.

This repository is not deployed to AWS. See [the AWS deployment guide](./aws-deployment.md)
for the account-owner setup and production release checklist. Email and provider
credentials, database access, HTTPS, MFA, backups, monitoring, and a validated
production environment must be configured before real users or live payments.
