import "server-only";
import dns from "node:dns";
import nodemailer, { type Transporter } from "nodemailer";

// This host's provider blocks outbound SMTP ports (25/465/587), so the default
// transport is Resend's HTTPS API (port 443, reachable). SMTP is kept as a
// fallback for environments where it IS allowed.
//
// Env:
//   RESEND_API_KEY  → use Resend HTTPS API (preferred when set)
//   EMAIL_FROM      → sender address (must be on a Resend-verified domain),
//                     e.g. info@dijifa.com
//   SMTP_HOST/PORT/USER/PASS → nodemailer fallback (only if no RESEND_API_KEY)
dns.setDefaultResultOrder("ipv4first");

const resendKey = process.env.RESEND_API_KEY;

const smtpHost = process.env.SMTP_HOST ?? "smtp.gmail.com";
const smtpPort = Number(process.env.SMTP_PORT ?? "587");
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

const from = process.env.EMAIL_FROM ?? smtpUser ?? "info@dijifa.com";

export function isEmailConfigured(): boolean {
  return Boolean(resendKey || (smtpUser && smtpPass));
}

interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

async function sendViaResend(mail: Mail): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `StokTakip <${from}>`,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`resend_failed_${res.status}: ${body}`);
  }
}

let transporter: Transporter | null = null;
async function sendViaSmtp(mail: Mail): Promise<void> {
  if (!smtpUser || !smtpPass) throw new Error("email_not_configured");
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
  }
  await transporter.sendMail({
    from: `StokTakip <${from}>`,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
}

async function send(mail: Mail): Promise<void> {
  if (resendKey) return sendViaResend(mail);
  return sendViaSmtp(mail);
}

export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  await send({
    to,
    subject: "StokTakip — E-posta doğrulama",
    text:
      `Merhaba,\n\n` +
      `StokTakip hesabınızı oluşturdunuz. Hesabınızı etkinleştirmek ve giriş ` +
      `yapabilmek için aşağıdaki bağlantıya tıklayarak e-postanızı doğrulayın:\n\n${verifyUrl}\n\n` +
      `Bu bağlantı 24 saat boyunca geçerlidir. Bu kaydı siz yapmadıysanız bu e-postayı yok sayabilirsiniz.\n`,
    html:
      `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;color:#0f172a">` +
      `<h2 style="font-size:18px;margin:0 0 16px">E-postanızı doğrulayın</h2>` +
      `<p style="font-size:14px;line-height:1.6;color:#334155">StokTakip hesabınızı oluşturdunuz. Hesabınızı etkinleştirip giriş yapabilmek için aşağıdaki butona tıklayın:</p>` +
      `<p style="margin:24px 0"><a href="${verifyUrl}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block">E-postamı doğrula</a></p>` +
      `<p style="font-size:12px;line-height:1.6;color:#64748b">Buton çalışmazsa şu bağlantıyı tarayıcınıza yapıştırın:<br><a href="${verifyUrl}" style="color:#4f46e5;word-break:break-all">${verifyUrl}</a></p>` +
      `<p style="font-size:12px;line-height:1.6;color:#94a3b8;margin-top:24px">Bu bağlantı 24 saat geçerlidir. Bu kaydı siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>` +
      `</div>`,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await send({
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
