import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { contracts, contractSigners, users, templates, auditLogs, otpCodes } from "@/db/schema";
import type { SessionUser } from "@/modules/auth/session";
import { logAudit } from "@/modules/audit/service";
import { renderVariables } from "@/modules/variables";
import { sanitizeHtml } from "@/lib/html";
import { fa, faNum } from "@/lib/jalali";
import { getAllSettings } from "@/modules/settings/service";
import { sendMail } from "@/modules/mail";
import { deleteSignatureFile } from "@/modules/signing/storage";

export type Contract = typeof contracts.$inferSelect;
export type Signer = typeof contractSigners.$inferSelect;

export const STATUS_LABELS: Record<string, string> = {
  sent: "ارسال شده",
  signed: "امضا شده",
  rejected: "رد شده",
};

export interface IssueParams {
  title: string;
  bodyHtml: string;
  templateId?: number | null;
  customerId: number;
  /** امضاکنندگان قبل از مشتری، به ترتیب */
  extraSigners?: { label: string; userId: number }[];
  source?: "admin" | "shop";
  createdBy?: number | null;
  orderId?: number | null;
  productName?: string;
  amount?: number;
  customerLabel?: string;
}

export async function issueContract(p: IssueParams): Promise<number> {
  const [customer] = await db.select().from(users).where(eq(users.id, p.customerId));
  if (!customer) throw new Error("کاربر یافت نشد");
  const cfg = await getAllSettings();

  const [created] = await db
    .insert(contracts)
    .values({
      number: `TMP-${Math.random().toString(36).slice(2, 10)}`,
      title: p.title,
      templateId: p.templateId ?? null,
      customerId: customer.id,
      bodyHtml: "",
      source: p.source ?? "admin",
      orderId: p.orderId ?? null,
      createdBy: p.createdBy ?? null,
    })
    .returning();

  const number = `AMZ-${new Date().getFullYear()}-${String(created.id).padStart(5, "0")}`;
  const body = renderVariables(sanitizeHtml(p.bodyHtml), {
    USER_NAME: customer.name,
    USER_EMAIL: customer.email,
    USER_MOBILE: customer.mobile,
    CONTRACT_NUMBER: number,
    DATE: fa(new Date()),
    SITE_NAME: cfg.site_name,
    PRODUCT_NAME: p.productName ?? "",
    AMOUNT: p.amount !== undefined ? faNum(p.amount) : "",
  });
  await db.update(contracts).set({ number, bodyHtml: body }).where(eq(contracts.id, created.id));

  const steps = [
    ...(p.extraSigners ?? []),
    { label: p.customerLabel ?? "مشتری", userId: customer.id },
  ];
  const signerUsers = await db
    .select()
    .from(users)
    .where(inArray(users.id, steps.map((s) => s.userId)));
  await db.insert(contractSigners).values(
    steps.map((s, i) => ({
      contractId: created.id,
      position: i + 1,
      label: s.label,
      userId: s.userId,
      mobile: signerUsers.find((u) => u.id === s.userId)?.mobile ?? "",
    })),
  );

  await logAudit({
    action: "contract.issued",
    contractId: created.id,
    userId: p.createdBy ?? customer.id,
    detail: `${number} — ${steps.map((s, i) => `${i + 1}. ${s.label}`).join(" ← ")}`,
  });

  const first = signerUsers.find((u) => u.id === steps[0].userId);
  if (first) {
    await sendMail({
      to: first.email,
      subject: `قرارداد جدید برای امضا: ${number}`,
      html: `<div dir="rtl"><p>${first.name} عزیز، قرارداد «${p.title}» برای امضای شما آماده است.</p><p>${cfg.app_url ? `${cfg.app_url}/contracts/${created.id}` : `/contracts/${created.id}`}</p></div>`,
      contractId: created.id,
    });
  }
  return created.id;
}

export async function getSigners(contractId: number) {
  return db
    .select({
      id: contractSigners.id,
      contractId: contractSigners.contractId,
      position: contractSigners.position,
      label: contractSigners.label,
      userId: contractSigners.userId,
      status: contractSigners.status,
      signedAt: contractSigners.signedAt,
      ip: contractSigners.ip,
      userAgent: contractSigners.userAgent,
      signatureFile: contractSigners.signatureFile,
      signatureMethod: contractSigners.signatureMethod,
      otpVerifiedAt: contractSigners.otpVerifiedAt,
      mobile: contractSigners.mobile,
      userName: users.name,
      userEmail: users.email,
    })
    .from(contractSigners)
    .innerJoin(users, eq(users.id, contractSigners.userId))
    .where(eq(contractSigners.contractId, contractId))
    .orderBy(asc(contractSigners.position));
}
export type SignerRow = Awaited<ReturnType<typeof getSigners>>[number];

/** نوبت امضا: اولین امضاکننده‌ای که هنوز امضا نکرده */
export function currentSigner(signers: SignerRow[]) {
  return signers.find((s) => s.status === "pending") ?? null;
}

/**
 * جداسازی کاربران: فقط مدیر، مشتری و امضاکنندگان همین قرارداد دسترسی دارند.
 * در غیر این صورت null برمی‌گردد (و تلاش در لاگ ثبت می‌شود).
 */
export async function getContractForUser(user: SessionUser, id: number) {
  if (!Number.isInteger(id)) return null;
  const [contract] = await db.select().from(contracts).where(eq(contracts.id, id));
  if (!contract) return null;
  const signers = await getSigners(id);
  const allowed =
    user.role === "admin" || contract.customerId === user.id || signers.some((s) => s.userId === user.id);
  if (!allowed) {
    await logAudit({ action: "access.denied", contractId: id, userId: user.id });
    return null;
  }
  const [customer] = await db.select().from(users).where(eq(users.id, contract.customerId));
  return { contract, signers, customer };
}

export type UserFilter = "all" | "pending" | "signed";

export async function listContractsForUser(userId: number, filter: UserFilter) {
  const rows = await db
    .select({
      id: contracts.id,
      number: contracts.number,
      title: contracts.title,
      status: contracts.status,
      issuedAt: contracts.issuedAt,
      signedAt: contracts.signedAt,
      mySignerStatus: contractSigners.status,
      myLabel: contractSigners.label,
      myPosition: contractSigners.position,
    })
    .from(contractSigners)
    .innerJoin(contracts, eq(contracts.id, contractSigners.contractId))
    .where(eq(contractSigners.userId, userId))
    .orderBy(desc(contracts.issuedAt));

  // محاسبه‌ی «نوبت من» برای هر قرارداد
  const ids = rows.map((r) => r.id);
  const pendingSigners = ids.length
    ? await db
        .select({ contractId: contractSigners.contractId, position: contractSigners.position })
        .from(contractSigners)
        .where(and(inArray(contractSigners.contractId, ids), eq(contractSigners.status, "pending")))
    : [];
  const minPending = new Map<number, number>();
  for (const s of pendingSigners) {
    const cur = minPending.get(s.contractId);
    if (cur === undefined || s.position < cur) minPending.set(s.contractId, s.position);
  }

  const mapped = rows.map((r) => {
    let state: "my_turn" | "waiting" | "signed" | "rejected" = "waiting";
    if (r.mySignerStatus === "signed") state = "signed";
    else if (r.status === "rejected") state = "rejected";
    else if (minPending.get(r.id) === r.myPosition) state = "my_turn";
    return { ...r, state };
  });

  if (filter === "pending") return mapped.filter((r) => r.state === "my_turn" || r.state === "waiting");
  if (filter === "signed") return mapped.filter((r) => r.state === "signed");
  return mapped;
}

export async function listContractsAdmin(status: string, q: string) {
  const conds = [];
  if (["sent", "signed", "rejected"].includes(status)) conds.push(eq(contracts.status, status));
  if (q) {
    const like = `%${q}%`;
    conds.push(or(ilike(contracts.number, like), ilike(contracts.title, like), ilike(users.name, like), ilike(users.email, like)));
  }
  return db
    .select({
      id: contracts.id,
      number: contracts.number,
      title: contracts.title,
      status: contracts.status,
      source: contracts.source,
      issuedAt: contracts.issuedAt,
      signedAt: contracts.signedAt,
      userName: users.name,
      userEmail: users.email,
      templateTitle: templates.title,
    })
    .from(contracts)
    .innerJoin(users, eq(users.id, contracts.customerId))
    .leftJoin(templates, eq(templates.id, contracts.templateId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(contracts.issuedAt));
}

export async function adminCounts() {
  const rows = await db
    .select({ status: contracts.status, n: sql<number>`count(*)::int` })
    .from(contracts)
    .groupBy(contracts.status);
  const c = { all: 0, sent: 0, signed: 0, rejected: 0 } as Record<string, number>;
  for (const r of rows) {
    c[r.status] = r.n;
    c.all += r.n;
  }
  return c;
}

export async function removeContract(id: number, adminId: number) {
  const signers = await db.select().from(contractSigners).where(eq(contractSigners.contractId, id));
  for (const s of signers) if (s.signatureFile) await deleteSignatureFile(s.signatureFile);
  const [c] = await db.select().from(contracts).where(eq(contracts.id, id));
  await db.delete(otpCodes).where(eq(otpCodes.contractId, id));
  await db.delete(contractSigners).where(eq(contractSigners.contractId, id));
  await db.delete(contracts).where(eq(contracts.id, id));
  // لاگ‌های قبلی حفظ می‌شوند تا قابل پیگیری بمانند
  await db.update(auditLogs).set({ detail: sql`${auditLogs.detail} || ' [قرارداد حذف شد]'` }).where(and(eq(auditLogs.contractId, id), eq(auditLogs.action, "contract.issued")));
  await logAudit({ action: "contract.deleted", contractId: id, userId: adminId, detail: c?.number ?? String(id) });
}
