"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/modules/auth/session";
import { SETTING_KEYS, saveSettings, getAllSettings, type SettingKey } from "./service";
import { logAudit } from "@/modules/audit/service";

export type SettingsState = { saved?: boolean };

export async function saveSettingsAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin();
  const current = await getAllSettings();
  const values: Partial<Record<SettingKey, string>> = {};
  for (const key of SETTING_KEYS) {
    if (!formData.has(key)) continue;
    const v = String(formData.get(key) ?? "").trim();
    // فیلدهای محرمانه: اگر خالی ارسال شد مقدار قبلی حفظ شود
    if (["kavenegar_api_key", "melipayamak_password", "smtp_pass"].includes(key) && v === "") {
      values[key] = current[key];
    } else {
      values[key] = v;
    }
  }
  await saveSettings(values);
  await logAudit({ action: "settings.saved", userId: admin.id });
  revalidatePath("/admin/settings");
  return { saved: true };
}
