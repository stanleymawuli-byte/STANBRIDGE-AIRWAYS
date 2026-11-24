import "server-only";

import { symmetricDecrypt } from "better-auth/crypto";

export async function decryptTotpSecret(encryptedData: string): Promise<string> {
  const secretKey = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secretKey || !encryptedData) {
    return encryptedData;
  }

  try {
    const decrypted = await symmetricDecrypt({
      key: secretKey,
      data: encryptedData,
    });

    if (decrypted.startsWith("base32:")) {
      return decrypted.slice(7).toUpperCase().trim();
    }
    return decrypted.toUpperCase().trim();
  } catch (error) {
    // If decryption fails (e.g., secret is already unencrypted plaintext Base32)
    return encryptedData.toUpperCase().trim();
  }
}
