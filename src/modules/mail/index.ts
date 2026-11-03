import nodemailer from "nodemailer";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getAllSettings } from "@/modules/settings/service";

export async function sendMail(opts: { to: string; subject: string; html: string; contractId?: number | null }) {
  const cfg = await getAllSettings();
  let status: "sent" | "logged" | "failed" = "logged";
  let error: string | null = null;

  if (cfg.smtp_host) {
    try {
      const transport = nodemailer.createTransport({
        host: cfg.smtp_host,
        port: Number(cfg.smtp_port) || 587,
        secure: Number(cfg.smtp_port) === 465,
        auth: cfg.smtp_user ? { user: cfg.smtp_user, pass: cfg.smtp_pass } : undefined,
      });
      await transport.sendMail({
        from: cfg.smtp_from || cfg.smtp_user || cfg.admin_email,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      });
      status = "sent";
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message : "خطای ارسال ایمیل";
    }
  }

  await db.insert(notifications).values({
    channel: "email",
    recipient: opts.to,
    subject: opts.subject,
    body: opts.html,
    status,
    error,
    contractId: opts.contractId ?? null,
  });
  return { status, error };
}
