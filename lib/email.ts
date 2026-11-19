import "server-only";

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

function getEmailCredentials() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  return { apiKey, from };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

export async function sendEmail(message: EmailMessage) {
  const { apiKey, from } = getEmailCredentials();
  if (!apiKey || !from) {
    console.warn(
      `[StanBridge Email] Resend delivery is not configured (missing RESEND_API_KEY or EMAIL_FROM). Email to ${message.to} was not sent via network.`,
    );
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const responseText = await response.text();
    console.error(`Email delivery failed (${response.status}): ${responseText.slice(0, 300)}`);
  }
}

export async function sendVerificationEmail({
  user,
  url,
}: {
  user: { name: string; email: string };
  url: string;
}) {
  const name = escapeHtml(user.name);
  const safeUrl = escapeHtml(url);
  await sendEmail({
    to: user.email,
    subject: "Verify your StanBridge Airways email",
    text: `Hello ${user.name}, verify your email address: ${url}`,
    html: `<p>Hello ${name},</p><p>Please verify your email address to activate your StanBridge Airways account.</p><p><a href="${safeUrl}">Verify email address</a></p><p>If you did not create an account, you can ignore this message.</p>`,
  });
}

export async function sendPasswordResetEmail({
  user,
  url,
}: {
  user: { name: string; email: string };
  url: string;
}) {
  const name = escapeHtml(user.name);
  const safeUrl = escapeHtml(url);
  await sendEmail({
    to: user.email,
    subject: "Reset your StanBridge Airways password",
    text: `Hello ${user.name}, reset your password: ${url}`,
    html: `<p>Hello ${name},</p><p>We received a request to reset your StanBridge Airways password.</p><p><a href="${safeUrl}">Choose a new password</a></p><p>If you did not request this, you can ignore this message. The link expires in one hour.</p>`,
  });
}
