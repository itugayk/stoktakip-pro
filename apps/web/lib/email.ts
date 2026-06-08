import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * SMTP mailer. Configured via env (Google Workspace / Gmail SMTP by default):
 *   SMTP_HOST   default "smtp.gmail.com"
 *   SMTP_PORT   default 587 (STARTTLS); 465 uses implicit TLS
 *   SMTP_USER   the mailbox, e.g. info@dijifa.com
 *   SMTP_PASS   a Google "App Password" (NOT the account password)
 *   EMAIL_FROM  display sender, defaults to SMTP_USER
 */
const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
const port = Number(process.env.SMTP_PORT ?? "587");
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.EMAIL_FROM ?? user ?? "info@dijifa.com";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!user || !pass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
  return transporter;
}

export function isEmailConfigured(): boolean {
  return Boolean(user && pass);
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const t = getTransporter();
  if (!t) throw new Error("email_not_configured");

  await t.sendMail({
    from: `StokTakip <${from}>`,
    to,
    subject: "StokTakip — Şifre sıfırlama",
    text:
      `Merhaba,\n\n` +
      `StokTakip hesabınız için şifre sıfırlama talebinde bulunuldu. ` +
      `Yeni şifre belirlemek için aşağıdaki bağlantıya tıklayın:\n\n${resetUrl}\n\n` +
      `Bu bağlantı 1 saat boyunca geçerlidir. Bu talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.\n`,
    html:
      `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;color:#0f172a">` +
      `<h2 style="font-size:18px;margin:0 0 16px">Şifre sıfırlama</h2>` +
      `<p style="font-size:14px;line-height:1.6;color:#334155">StokTakip hesabınız için şifre sıfırlama talebinde bulunuldu. Yeni şifre belirlemek için aşağıdaki butona tıklayın:</p>` +
      `<p style="margin:24px 0"><a href="${resetUrl}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block">Şifremi sıfırla</a></p>` +
      `<p style="font-size:12px;line-height:1.6;color:#64748b">Buton çalışmazsa şu bağlantıyı tarayıcınıza yapıştırın:<br><a href="${resetUrl}" style="color:#4f46e5;word-break:break-all">${resetUrl}</a></p>` +
      `<p style="font-size:12px;line-height:1.6;color:#94a3b8;margin-top:24px">Bu bağlantı 1 saat geçerlidir. Bu talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>` +
      `</div>`,
  });
}
