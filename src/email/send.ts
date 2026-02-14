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
      subject: "请验证您的邮箱 - 新闻摘要",
      html: `
      <p>请点击下方链接验证您的邮箱：</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>此链接 24 小时内有效。</p>
    `,
    }),
    timeoutPromise,
  ]);
}

export async function sendDigestEmail(
  to: string,
  htmlTable: string,
  subject = "您的新闻摘要"
): Promise<void> {
  if (process.env.SMTP_HOST === "skip" || !process.env.SMTP_HOST) {
    console.log("[Dev] Skip SMTP. Digest would send to:", to, "| Subject:", subject);
    return;
  }
  const transport = getTransporter();
  await transport.sendMail({
    from: process.env.SMTP_FROM ?? "News Digest <noreply@example.com>",
    to,
    subject,
    html: `
      <h2>新闻摘要</h2>
      <p>以下是您订阅的精选新闻：</p>
      ${htmlTable}
      <hr>
      <p><small>您收到此邮件是因为您已订阅。<a href="${process.env.APP_URL}/unsubscribe">退订</a></small></p>
    `,
  });
}
