import Shell from "@/components/Shell";
import SettingsForm from "@/components/SettingsForm";
import { requireAdmin } from "@/modules/auth/session";
import { getAllSettings } from "@/modules/settings/service";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const settings = await getAllSettings();
  // رمزها هرگز به مرورگر ارسال نمی‌شوند؛ فقط وجود/عدم وجود آن‌ها مشخص می‌شود
  const safe: Record<string, string> = { ...settings };
  for (const k of ["kavenegar_api_key", "melipayamak_password", "smtp_pass"]) safe[k] = settings[k as keyof typeof settings] ? "set" : "";
  return (
    <Shell user={admin}>
      <h1 className="mb-4 text-2xl font-bold">تنظیمات</h1>
      <SettingsForm settings={safe} />
    </Shell>
  );
}
