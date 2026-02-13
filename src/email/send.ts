/**
 * Email sending via Nodemailer SMTP.
 */

import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

const SMTP_TIMEOUT_MS = 10000;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const host = process.env.SMTP_HOST ?? "localhost";
    const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
  }
  return transporter;
}

export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  if (process.env.SMTP_HOST === "skip" || !process.env.SMTP_HOST) {
    console.log("[Dev] Skip SMTP. Verification URL:", verifyUrl);
    return;
  }
  const transport = getTransporter();
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("SMTP timeout")), SMTP_TIMEOUT_MS)
  );
  await Promise.race([
    transport.sendMail({
      from: process.env.SMTP_FROM ?? "News Digest <noreply@example.com>",
      to,
      subject: "Verify your email - News Digest",
      html: `
      <p>Please verify your email by clicking the link below:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>This link expires in 24 hours.</p>
    `,
    }),
    timeoutPromise,
  ]);
}

export async function sendDigestEmail(
  to: string,
  htmlTable: string,
  subject = "Your News Digest"
): Promise<void> {
  const transport = getTransporter();
  await transport.sendMail({
    from: process.env.SMTP_FROM ?? "News Digest <noreply@example.com>",
    to,
    subject,
    html: `
      <h2>News Digest</h2>
      <p>Here are your curated news articles:</p>
      ${htmlTable}
      <hr>
      <p><small>You received this because you subscribed. <a href="${process.env.APP_URL}/unsubscribe">Unsubscribe</a></small></p>
    `,
  });
}
