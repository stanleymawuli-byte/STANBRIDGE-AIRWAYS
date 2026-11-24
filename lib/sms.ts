import "server-only";

export type SmsMessage = {
  to: string;
  body: string;
};

export function isSmsConfigured(): boolean {
  const hasTwilio = Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
    process.env.TWILIO_AUTH_TOKEN?.trim() &&
    process.env.TWILIO_PHONE_NUMBER?.trim()
  );
  const hasTermii = Boolean(process.env.TERMII_API_KEY?.trim());
  return hasTwilio || hasTermii;
}

export async function sendSms(message: SmsMessage): Promise<boolean> {
  const to = message.to.trim();
  const body = message.body.trim();

  if (!to || !body) {
    console.warn("[StanBridge SMS] Destination phone or message body is empty. SMS skipped.");
    return false;
  }

  // 1. Twilio Integration
  const twilioSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN?.trim();
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER?.trim();

  if (twilioSid && twilioAuth && twilioFrom) {
    try {
      const authHeader = Buffer.from(`${twilioSid}:${twilioAuth}`).toString("base64");
      const params = new URLSearchParams({
        To: to,
        From: twilioFrom,
        Body: body,
      });

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[StanBridge SMS] Twilio delivery failed (${response.status}): ${errText.slice(0, 300)}`);
        return false;
      }

      console.log(`[StanBridge SMS] Dispatched SMS via Twilio to ${to}`);
      return true;
    } catch (error) {
      console.error("[StanBridge SMS] Network error sending via Twilio:", error);
      return false;
    }
  }

  // 2. Termii Integration (West African & International Gateway)
  const termiiKey = process.env.TERMII_API_KEY?.trim();
  const termiiFrom = process.env.TERMII_SENDER_ID?.trim() || "StanBridge";

  if (termiiKey) {
    try {
      const response = await fetch("https://api.ng.termii.com/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          from: termiiFrom,
          sms: body,
          type: "plain",
          channel: "generic",
          api_key: termiiKey,
        }),
        cache: "no-store",
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[StanBridge SMS] Termii delivery failed (${response.status}): ${errText.slice(0, 300)}`);
        return false;
      }

      console.log(`[StanBridge SMS] Dispatched SMS via Termii to ${to}`);
      return true;
    } catch (error) {
      console.error("[StanBridge SMS] Network error sending via Termii:", error);
      return false;
    }
  }

  // 3. Fallback / Dev Mode Logging
  console.info(
    `[StanBridge SMS] (Simulation Mode - No SMS API keys set) SMS to ${to}: "${body}"`
  );
  return true;
}
