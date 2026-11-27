# StanBridge Airways mobile and deployment notes

## Mobile app
The web app is an installable Progressive Web App (PWA) that uses the same backend and PostgreSQL database as the desktop site. On a supported phone, open the HTTPS site and choose **Add to Home Screen** (iOS Safari) or **Install app** (Android Chrome). The service worker only provides an offline fallback; account, admin, API and payment responses are not cached. This is not a separately compiled native App Store / Google Play app.

## AWS account and backup setup
1. Create and own the AWS account at https://aws.amazon.com/ and complete account security and billing setup. Account creation requires your identity and payment details; do not share them in chat.
2. Create a private S3 bucket with server-side encryption, versioning and all public-access blocks enabled.
3. Create a dedicated least-privilege IAM role/user restricted to the application's backup object prefix; never use root credentials.
4. Store credentials only in the hosting provider's encrypted environment variables. Never commit them or use NEXT_PUBLIC_ names.
5. Configure managed PostgreSQL backups and verify recovery independently before production use.

AWS backup integration and automated scheduling still need to be wired into the hosting environment before production backups can be claimed as active.

## Kleopatra public/private key demonstration
1. Install Gpg4win (includes Kleopatra) from the official Gpg4win website on your Windows computer.
2. Open Kleopatra → File → New OpenPGP Key Pair.
3. Enter a project demonstration identity and an email address you control.
4. Choose RSA 3072-bit or a modern ECC option offered by your version, set an expiry date, and protect the private key with a strong passphrase.
5. Export the public key as `stanbridge-public-key.asc`.
6. Use **Backup Secret Keys** to save the private key to encrypted removable storage. Never upload or commit the private key or passphrase.
7. Import the public key into a second test profile, encrypt a harmless text file, then decrypt it using the private key in Kleopatra. Capture screenshots of the public-key export and successful decryption without exposing the private key.
