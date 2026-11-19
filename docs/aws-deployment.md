# AWS deployment and operations

The application is prepared for AWS but has not been deployed. Creating an AWS
account, accepting AWS terms, choosing a billing plan, configuring DNS, and
deploying resources must be done by the account owner. Never send account
passwords, access keys, database URLs, or MFA codes in chat.

## Suggested production layout

- **AWS App Runner:** run the Next.js Node.js service from the GitHub repository.
- **Amazon RDS for PostgreSQL:** use a production-supported PostgreSQL version,
  private subnets, encryption at rest, and automated backups with an agreed
  retention period.
- **AWS Secrets Manager:** store `DATABASE_URL`, `BETTER_AUTH_SECRET`,
  `PASSWORD_PEPPER`, provider credentials, and email credentials. Inject them
  into the service as secrets, not as repository files or build arguments.
- **VPC connector and security groups:** allow the App Runner service to reach
  the private RDS endpoint; allow PostgreSQL ingress only from the service's
  security group. Do not expose RDS to the public internet.
- **CloudWatch:** retain application logs and configure alarms for service
  failures, database capacity, and backup failures. Logs must not contain
  passwords, session tokens, passenger documents, or payment secrets.

## Release checklist

1. Create the AWS account directly with AWS, enable MFA for the root identity,
   do not create root access keys, and use an IAM Identity Center administrator
   for day-to-day operations. Add a billing alarm and review AWS account
   recovery contacts.
2. Create the private RDS PostgreSQL database and App Runner VPC connector.
   Configure the database security group to accept traffic only from App Runner.
3. Generate distinct random `BETTER_AUTH_SECRET` and `PASSWORD_PEPPER` values
   locally, and store them and the remaining production settings in Secrets
   Manager. Set `APP_URL` to the final HTTPS origin. Configure a verified email
   sender, production Amadeus credentials only when approved, and live payment
   credentials only after payment-provider production approval.
4. Build the App Runner service with `npm ci && npm run build` and start it with
   `npm start`. Run `npm run db:migrate:deploy` once as a controlled release
   migration using the production database secret and a runner that can reach
   the private RDS endpoint. Do not run development migrations against
   production or have every application instance race to apply migrations.
5. Add the custom domain and HTTPS certificate, then verify registration,
   email verification, login, 2FA, role restrictions, booking, payment
   callbacks, and health monitoring using test credentials before launch.
6. Enable encrypted RDS automated backups and point-in-time recovery. Periodically
   restore a database snapshot into an isolated recovery database and verify
   that the application can start against it. A full database restore can
   replace user and booking data; it is deliberately not offered by the
   configuration restore screen.

## Restore points and data scope

The admin dashboard's configuration backups contain only support email, booking
hold duration, and maintenance mode. Restoring one changes those settings only;
it never updates or deletes users, passwords, bookings, passengers, or payments.
Keep independent RDS backups for disaster recovery and test them separately.

## Kleopatra OpenPGP keys

Generate a personal OpenPGP key in Kleopatra on the account owner's computer
using **File → New OpenPGP Key Pair**. Select a current RSA or ECC key type and
set an expiry and a strong, unique passphrase. Back up the private key and
revocation certificate to encrypted offline storage. Share only the exported
public key. Never upload or commit a private key, its passphrase, or a
revocation certificate. These keys are for signing/encryption workflows; they
are not AWS credentials or application login keys.

## CIA controls

- **Confidentiality:** passwords use a per-password random salt through the
  Better Auth Scrypt   implementation and an independent server-side HMAC pepper;
  HTTPS, private database networking, least-privilege roles, and managed secrets
  are required in production.
- **Integrity:** database writes use Prisma's parameterized operations; user
  roles are assigned only by super-admin APIs; 2FA, rate limits, role checks,
  foreign keys, and reviewed migrations protect sensitive operations.
- **Availability:** use RDS automated backups and point-in-time recovery,
  App Runner health monitoring, CloudWatch alarms, and tested recovery
  procedures. Configuration snapshots alone are not database backups.
