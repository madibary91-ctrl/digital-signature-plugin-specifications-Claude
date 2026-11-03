import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getRequestInfo } from "@/lib/request";

export const ACTION_LABELS: Record<string, string> = {
  "contract.issued": "صدور قرارداد",
  "contract.viewed": "مشاهده قرارداد",
  "contract.signed": "امضای قرارداد",
  "contract.completed": "تکمیل قرارداد",
  "contract.rejected": "رد قرارداد",
  "contract.deleted": "حذف قرارداد",
  "otp.sent": "ارسال کد تایید",
  "otp.failed": "کد تایید نادرست",
  "otp.verified": "تایید کد پیامکی",
  "auth.login": "ورود به سیستم",
  "auth.failed": "ورود ناموفق",
  "template.saved": "ذخیره قالب",
  "template.deleted": "حذف قالب",
  "settings.saved": "ذخیره تنظیمات",
  "order.created": "ثبت سفارش",
  "access.denied": "دسترسی غیرمجاز",
};

export async function logAudit(entry: {
  action: string;
  contractId?: number | null;
  userId?: number | null;
  detail?: string;
}) {
  let ip = "unknown";
  let userAgent = "unknown";
  try {
    const info = await getRequestInfo();
    ip = info.ip;
    userAgent = info.userAgent;
  } catch {
    /* خارج از چرخه‌ی درخواست */
  }
  await db.insert(auditLogs).values({
    action: entry.action,
    contractId: entry.contractId ?? null,
    userId: entry.userId ?? null,
    detail: entry.detail ?? "",
    ip,
    userAgent,
  });
}

export async function getContractAudit(contractId: number) {
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      detail: auditLogs.detail,
      ip: auditLogs.ip,
      userAgent: auditLogs.userAgent,
      createdAt: auditLogs.createdAt,
      userName: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(eq(auditLogs.contractId, contractId))
    .orderBy(desc(auditLogs.createdAt));
}

export async function getRecentAudit(limit = 200) {
  return db
    .select({
      id: auditLogs.id,
      contractId: auditLogs.contractId,
      action: auditLogs.action,
      detail: auditLogs.detail,
      ip: auditLogs.ip,
      userAgent: auditLogs.userAgent,
      createdAt: auditLogs.createdAt,
      userName: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}
