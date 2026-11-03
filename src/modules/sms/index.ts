import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getAllSettings } from "@/modules/settings/service";

export interface SmsMessage {
  to: string;
  text: string;
  /** برای قالب‌های تاییدیه (مثل verify کاوه‌نگار) */
  token?: string;
}
export interface SmsResult {
  ok: boolean;
  error?: string;
}
type Cfg = Awaited<ReturnType<typeof getAllSettings>>;
export interface SmsProvider {
  id: string;
  label: string;
  send(msg: SmsMessage, cfg: Cfg): Promise<SmsResult>;
}

/** حالت آزمایشی: فقط در لاگ ذخیره می‌شود */
const logProvider: SmsProvider = {
  id: "log",
  label: "حالت آزمایشی (فقط ثبت در لاگ)",
  async send() {
    return { ok: true };
  },
};

const kavenegar: SmsProvider = {
  id: "kavenegar",
  label: "کاوه‌نگار",
  async send(msg, cfg) {
    if (!cfg.kavenegar_api_key) return { ok: false, error: "کلید API کاوه‌نگار تنظیم نشده است" };
    const base = `https://api.kavenegar.com/v1/${encodeURIComponent(cfg.kavenegar_api_key)}`;
    const url = msg.token
      ? `${base}/verify/lookup.json?receptor=${msg.to}&token=${encodeURIComponent(msg.token)}&template=${encodeURIComponent(cfg.kavenegar_template || "verify")}`
      : `${base}/sms/send.json?receptor=${msg.to}&message=${encodeURIComponent(msg.text)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  },
};

const melipayamak: SmsProvider = {
  id: "melipayamak",
  label: "ملی پیامک",
  async send(msg, cfg) {
    if (!cfg.melipayamak_username || !cfg.melipayamak_password)
      return { ok: false, error: "نام کاربری یا رمز ملی‌پیامک تنظیم نشده است" };
    const res = await fetch("https://rest.payamak-panel.com/api/SendSMS/SendSMS", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: cfg.melipayamak_username,
        password: cfg.melipayamak_password,
        to: msg.to,
        from: cfg.melipayamak_from,
        text: msg.text,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  },
};

/** برای افزودن پنل جدید کافی است یک پرووایدر به این فهرست اضافه شود */
export const SMS_PROVIDERS: SmsProvider[] = [logProvider, kavenegar, melipayamak];

export async function sendSms(msg: SmsMessage, contractId?: number | null): Promise<SmsResult & { testMode: boolean }> {
  const cfg = await getAllSettings();
  const provider = SMS_PROVIDERS.find((p) => p.id === cfg.sms_provider) ?? logProvider;
  let result: SmsResult;
  try {
    result = await provider.send(msg, cfg);
  } catch (e) {
    result = { ok: false, error: e instanceof Error ? e.message : "خطای ناشناخته" };
  }
  await db.insert(notifications).values({
    channel: "sms",
    recipient: msg.to,
    subject: provider.label,
    // متن پیامک حاوی کد در حالت آزمایشی ذخیره می‌شود؛ در حالت واقعی ذخیره نمی‌شود
    body: provider.id === "log" ? msg.text : "(ارسال شده از طریق پنل پیامک)",
    status: result.ok ? (provider.id === "log" ? "logged" : "sent") : "failed",
    error: result.error ?? null,
    contractId: contractId ?? null,
  });
  return { ...result, testMode: provider.id === "log" };
}
