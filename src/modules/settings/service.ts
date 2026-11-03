import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const SETTING_KEYS = [
  "site_name",
  "admin_email",
  "sms_provider", // log | kavenegar | melipayamak
  "kavenegar_api_key",
  "kavenegar_template",
  "melipayamak_username",
  "melipayamak_password",
  "melipayamak_from",
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "smtp_pass",
  "smtp_from",
  "app_url",
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

const DEFAULTS: Record<SettingKey, string> = {
  site_name: "امضاگیر",
  admin_email: "admin@example.com",
  sms_provider: "log",
  kavenegar_api_key: "",
  kavenegar_template: "verify",
  melipayamak_username: "",
  melipayamak_password: "",
  melipayamak_from: "",
  smtp_host: "",
  smtp_port: "587",
  smtp_user: "",
  smtp_pass: "",
  smtp_from: "",
  app_url: "",
};

export async function getAllSettings(): Promise<Record<SettingKey, string>> {
  const rows = await db.select().from(settings);
  const out = { ...DEFAULTS };
  for (const r of rows) if ((SETTING_KEYS as readonly string[]).includes(r.key)) out[r.key as SettingKey] = r.value;
  return out;
}

export async function getSetting(key: SettingKey): Promise<string> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return row ? row.value : DEFAULTS[key];
}

export async function saveSettings(values: Partial<Record<SettingKey, string>>) {
  for (const [key, value] of Object.entries(values)) {
    if (!(SETTING_KEYS as readonly string[]).includes(key)) continue;
    await db
      .insert(settings)
      .values({ key, value: value ?? "" })
      .onConflictDoUpdate({ target: settings.key, set: { value: value ?? "" } });
  }
}
