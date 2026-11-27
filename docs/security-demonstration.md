# StanBridge Airways security demonstration

## Password storage: hashing, salt and pepper
- Passwords are HMAC-SHA256 peppered with the server-only PASSWORD_PEPPER, then hashed with Better Auth's Scrypt implementation.
- Scrypt creates a unique random salt for each password hash. The hash is stored in Account.password; plaintext passwords and the pepper are not stored in PostgreSQL.
- Keep PASSWORD_PEPPER stable and in a secret manager. Rotating it without a migration plan prevents existing password verification.

## Parameterized SQL
Prisma ORM parameterizes values. If raw SQL is needed, use Prisma's tagged template:

```ts
const user = await prisma.$queryRaw<Array<{ id: string; email: string }>>`
  SELECT id, email FROM "User" WHERE email = ${email}
`;
// Never concatenate user input into SQL or use $queryRawUnsafe with request data.
```

A local classroom query showing username and hash is in `docs/sql-demonstration.sql`. Do not expose password hashes through an admin page or public API.

## Dictionary attack resistance
The application rejects common dictionary words, repeated characters, predictable number sequences, and passwords with fewer than three character classes. It requires at least 12 characters and rate-limits sign-in attempts to five per minute per Better Auth key.

Local classroom test only:
1. Try `Password123!`, `StanBridge2026!`, `qwerty123456!` and `AAAAAA123!` at registration.
2. Confirm the policy rejects them.
3. Try more than five incorrect sign-ins in one minute for a local test account.
4. Confirm rate limiting responds. Do not run password spraying against real accounts or third-party systems.

## CIA triad
| Principle | StanBridge Airways control |
|---|---|
| Confidentiality | Scrypt, salt, server-side pepper, mandatory staff 2FA, role-based access and HTTPS |
| Integrity | Prisma parameterized queries, server-side validation, Paystack signature verification and payment reference/amount/currency checks |
| Availability | Database-backed rate limiting, system health checks, provider-side database backups and tested recovery procedures |

## User roles and account deletion
Staff roles are SUPER_ADMIN, OPERATIONS_MANAGER, BOOKING_AGENT and FINANCE_OFFICER; public registration always assigns CUSTOMER. Staff access requires enrolled 2FA. The final super-admin must remain protected from removal. Deleting a user must remove the account and associated sessions/credentials/2FA data; review retention obligations before deleting bookings and financial records.


## Live salt and pepper demonstration

Set `PASSWORD_PEPPER` and a unique `DEMO_HASH_PASSWORD` in your local environment, then run `npm run security:password-demo`. The script applies the same HMAC-SHA256 pepper step and Better Auth password hasher used by the application, hashes the same input twice, and shows that the resulting salted hashes differ while both verify. It never prints the plaintext password or pepper. Do not use a real account password for this classroom demonstration.
