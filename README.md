# StanBridge Airways

Luxury airline platform for domestic and international travel.
**Connecting Continents. Elevating Journeys.**

## Current milestone: PostgreSQL and customer authentication

Requirements: Node.js 20.9 or newer and PostgreSQL.

For local development, copy `.env.example` to `.env.local` (PowerShell: `Copy-Item .env.example .env.local`).
Set `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `PASSWORD_PEPPER` in `.env.local`.
Generate independent 32-byte secrets locally with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Never commit `.env.local`, reuse the same value for both secrets, or paste credentials into chat.

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Open http://localhost:3000. Create a passenger account at `/register`; sign in at `/login`.
The protected `/account` page confirms the session.

Passwords are HMAC-peppered with `PASSWORD_PEPPER`, then hashed with Better Auth's
Scrypt implementation, which generates a unique random salt per password. The pepper
is server-only and separate from the database. Keep it stable: changing it without a
planned hash migration will prevent existing users from signing in.

The initial Prisma migration is in `prisma/migrations/`. Apply it explicitly to
production with `npm run db:migrate:deploy` after setting the production database
environment variable. Do not run development migrations against production.

Email verification and password recovery use Resend. Set `RESEND_API_KEY` and
`EMAIL_FROM` in `.env.local`; the sender domain must be verified with Resend.
New accounts must verify their email before signing in. Verification and password
reset links expire after one hour. Two-factor authentication is optional for all
accounts. Users can enroll an authenticator app from their passenger account and
use one-time backup codes if the device is unavailable. Sign-in requires a valid
authenticator or backup code when 2FA is enabled. Public registration always
assigns the `CUSTOMER` role; it cannot grant administrator access.

### Admin dashboard

The staff dashboard is available at `/admin`. `SUPER_ADMIN` can manage user roles;
operations managers and booking agents can cancel pending-payment bookings, and
finance officers can view operations metrics and payment records. Confirmed bookings
cannot be cancelled in this dashboard because refunds are not implemented.

To provision the first super-admin, register and verify the intended account, then
run this SQL against the configured PostgreSQL database:

```sql
UPDATE "User" SET "role" = 'SUPER_ADMIN' WHERE "email" = 'admin@example.com';
```

Verify exactly one intended account was changed before relying on the dashboard.
There is no public or self-service role promotion flow. Keep at least one active
super-admin; the dashboard prevents removal of the final one.

Run the available checks:

```bash
npm run lint
npm run typecheck
npm run build
```

## Deploy to Render

The root `render.yaml` configures a free Render web service and a free PostgreSQL
database for this Next.js app. The web service receives a database connection URL
and independently generated authentication secrets; it applies pending Prisma
migrations before starting the app.

Push this project to GitHub, then in Render choose **New → Blueprint**, connect the
repository, and apply the detected `render.yaml`. During setup, provide `RESEND_API_KEY`
and `EMAIL_FROM` privately in Render. The sender address must use a domain verified
with Resend. Do not put these credentials in Git or share them in chat. Without
working email delivery, registration and password recovery cannot complete.

The configured free PostgreSQL database is for temporary testing only; Render's
free databases expire and their data is not suitable for production accounts. For
real users, replace it with a persistent database and preserve/import any existing
user data before changing `DATABASE_URL`. Future pushes to the connected branch
deploy automatically.

The deployment includes passenger registration, booking, sandbox payment, staff
dashboard and account features only when PostgreSQL, required secrets, and Resend
email configuration are set in the hosting environment. Amadeus order creation and
refund processing are not implemented. Do not use test inventory for real travel or
accept live payments.

## Architecture

The existing Next.js App Router is the web entry point. New modules should keep browser UI separate from server-only services and integrations:

- `app/` — public pages and server route handlers
- `components/` — shared interface components
- `lib/auth/` — authentication, sessions and authorization
- `lib/db/` and `prisma/` — PostgreSQL access and schema
- `lib/integrations/amadeus/` — flight search and booking provider adapter
- `lib/integrations/paystack/` — payment initialization, verification and refunds
- `tests/` — unit and integration tests

Provider credentials, `BETTER_AUTH_SECRET`, `PASSWORD_PEPPER`, and database credentials must be server-only environment variables. Never use a `NEXT_PUBLIC_` prefix for secrets. Do not accept payment until a server-verified fare and a durable booking record exist.

## Current implementation boundary

The project includes the original landing page, server-side Amadeus flight search, repricing and flight-order creation/retrieval, a PostgreSQL/Prisma booking schema, customer registration/login, verified-email flows, password recovery, optional authenticator-based two-factor authentication, database-backed sessions and rate limiting, passenger account management, Paystack sandbox payment, and a role-gated staff dashboard. Configure `AMADEUS_ENV=test`, `AMADEUS_CLIENT_ID`, and `AMADEUS_CLIENT_SECRET` to enable test inventory and orders. Apply database migrations with `npm run db:migrate:deploy`, then provision the first super-admin as described above. Amadeus orders are reservations/PNRs, not e-tickets; airline ticket issuance is not supported by this integration. Order cancellation is intentionally not exposed until a refund flow is implemented. A successful Paystack charge with an Amadeus order failure remains a paid booking requiring manual review; an interrupted order request also needs reconciliation before any retry to avoid duplicate reservations.

## Development phases

1. **Project architecture and environment setup** — this phase.
2. Database design and security foundation.
3. Registration, login, password security and 2FA.
4. Airline website and customer dashboard.
5. Amadeus sandbox flight search.
6. Booking and ticket management.
7. Paystack sandbox payment integration.
8. Administration and operations dashboards.
9. Reports, audit logs and backup management.
10. Security/integration testing and deployment preparation.
