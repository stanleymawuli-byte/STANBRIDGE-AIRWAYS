# StanBridge Airways: mobile, AWS backups and cryptographic demonstration

## Mobile application
StanBridge Airways now includes an installable Progressive Web App (PWA). It uses the same web backend and PostgreSQL database as the desktop site. On Android Chrome choose **Install app** from the browser menu; on iPhone Safari choose **Share → Add to Home Screen**. The service worker only provides an offline fallback. It never caches account, administration, API or payment responses.

This is a mobile-installable web app, not a separately compiled native App Store / Google Play application. Native distribution would require a separate React Native or native client.

## AWS account and S3 backups
AWS account creation must be completed by the project owner at https://aws.amazon.com/ because it requires the owner's identity, email, billing and payment verification. Do not share AWS root credentials or payment information in chat.

1. Enable MFA on the AWS root account and create a separate IAM identity for StanBridge backups. Never use root credentials in the application.
2. In CloudFormation, deploy `infra/aws-backup-bucket.yaml` in your selected region.
3. Copy the bucket name and region from the stack outputs.
4. Apply `infra/aws-backup-iam-policy.json` after replacing `REPLACE_WITH_BUCKET_NAME`. Restrict the identity to the `database/*` object prefix.
5. Add `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` to the hosting provider's encrypted environment settings. Add `AWS_SESSION_TOKEN` only when using temporary credentials. Never commit these values or expose them through `NEXT_PUBLIC_` variables.
6. Ensure the web runtime has PostgreSQL's `pg_dump` executable installed. Set `PG_DUMP_PATH` if it is not on PATH. Backups use the non-pooling database URL when configured.
7. Sign in as a super-admin after enrolling in 2FA. Open **Operations → System administration → Database backups** and create a backup.
8. Download the backup and compare its checksum with the value shown in the backup history. On Windows: `Get-FileHash .\stanbridge-postgres-....dump -Algorithm SHA256`.

The application uploads each backup to the private S3 bucket using AWS Signature Version 4 and stores its SHA-256 checksum in the database. Single-part uploads are limited to 5 GB per object; larger dumps require multipart upload before use. Local storage is supported only when `BACKUP_DIRECTORY` points to durable persistent storage. An ephemeral web filesystem is not a backup strategy.

## Scheduled backups
The endpoint `POST /api/internal/backup` is protected by a constant-time comparison against `CRON_SECRET` (at least 32 random characters). To schedule it:
1. Set the same `CRON_SECRET` in the web service and scheduled-job environment.
2. Set `APP_URL` in the scheduled-job environment to the deployed HTTPS application URL.
3. Create a Render Cron Job (or equivalent scheduler) that runs `npm ci && npm run backup:trigger` once daily at a quiet UTC hour, for example 02:00 UTC.
4. Confirm the backup appears in the admin backup history and download one sample before relying on the schedule.

The trigger script runs in the scheduled job, but `pg_dump` runs inside the web service that handles the protected endpoint. Therefore the web service itself must have the PostgreSQL client installed and network access to the database. Do not enable the schedule until a manual backup has succeeded.

## Kleopatra public/private key demonstration
1. Install Gpg4win (which includes Kleopatra) from the official Gpg4win website on your Windows computer.
2. Open Kleopatra → **File → New OpenPGP Key Pair**.
3. Enter a project demonstration identity and an email address you control.
4. Choose RSA 3072-bit or a modern ECC option offered by your version, set an expiry date, and protect the private key with a strong passphrase.
5. Export the public key as `stanbridge-public-key.asc`.
6. Use **Backup Secret Keys** to save the private key to encrypted removable storage. Never upload or commit the private key, backup or passphrase.
7. Import the public key into a second test profile, encrypt a harmless text file, then decrypt it with the private key in Kleopatra.
8. Capture screenshots of the public-key export and successful decryption without exposing the private key.

## Deployment checks
Before deploying a release, run `npm ci`, `npx prisma validate`, `npx prisma generate`, `npm run lint`, `npm run typecheck` and `npm run build`. Configure the production database, APP_URL, Better Auth secret, password pepper, email sender, Amadeus credentials, Paystack test/live credentials, S3 settings and CRON_SECRET in the hosting provider's secret environment. Complete an end-to-end booking/payment test with provider sandbox credentials before switching any payment integration to live mode.
