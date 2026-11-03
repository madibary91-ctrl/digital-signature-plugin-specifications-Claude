"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contracts, contractSigners, orders } from "@/db/schema";
import { requireUser } from "@/modules/auth/session";
import { currentSigner, getContractForUser, getSigners } from "@/modules/contracts/service";
import { logAudit } from "@/modules/audit/service";
import { getRequestInfo } from "@/lib/request";
import { sendSms } from "@/modules/sms";
import { sendMail } from "@/modules/mail";
import { getAllSettings } from "@/modules/settings/service";
import { createOtp, secondsUntilResend, verifyOtp, OTP_RESEND_SECONDS } from "./otp";
import { saveSignatureFile } from "./storage";
import { sha256 } from "@/lib/password";
import { faTime } from "@/lib/jalali";

export interface ActionResult {
  ok: boolean;
  error?: string;
  seconds?: number;
  devCode?: string;
}

/** بررسی سطح دسترسی قبل از هر درخواست: کاربر باید امضاکننده‌ی فعلی همین قرارداد باشد */
async function loadTurn(contractId: number) {
  const user = await requireUser();
  const data = await getContractForUser(user, contractId);
  if (!data) return { error: "قرارداد یافت نشد یا دسترسی ندارید" as const };
  if (data.contract.status !== "sent") return { error: "این قرارداد دیگر قابل امضا نیست" as const };
  const signer = currentSigner(data.signers);
  if (!signer || signer.userId !== user.id) return { error: "نوبت امضای شما نیست" as const };
  return { user, data, signer };
}

export async function sendOtpAction(contractId: number): Promise<ActionResult> {
  const turn = await loadTurn(contractId);
  if ("error" in turn) return { ok: false, error: turn.error };
  const { user, signer } = turn;

  if (!/^09\d{9}$/.test(user.mobile)) return { ok: false, error: "شماره موبایل معتبری برای حساب شما ثبت نشده است" };
  const wait = await secondsUntilResend(signer.id);
  if (wait > 0) return { ok: false, error: `برای ارسال مجدد ${wait} ثانیه صبر کنید`, seconds: wait };

  const code = await createOtp({ contractId, signerId: signer.id, userId: user.id });
  const cfg = await getAllSettings();
  const res = await sendSms(
    { to: user.mobile, token: code, text: `کد تایید امضای قرارداد در ${cfg.site_name}: ${code}` },
    contractId,
  );
  await logAudit({
    action: "otp.sent",
    contractId,
    userId: user.id,
    detail: `به شماره ${user.mobile.slice(0, 4)}***${user.mobile.slice(-2)}${res.ok ? "" : " (ناموفق: " + res.error + ")"}`,
  });
  if (!res.ok) return { ok: false, error: "ارسال پیامک ناموفق بود: " + res.error };
  return { ok: true, seconds: OTP_RESEND_SECONDS, devCode: res.testMode ? code : undefined };
}

export async function signContractAction(
  contractId: number,
  input: { signature: string; method: "draw" | "upload"; agree: boolean; code: string },
): Promise<ActionResult> {
  const turn = await loadTurn(contractId);
  if ("error" in turn) return { ok: false, error: turn.error };
  const { user, data, signer } = turn;

  if (!input.agree) return { ok: false, error: "تایید مطالعه‌ی قرارداد الزامی است" };
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(input.signature || "");
  if (!m) return { ok: false, error: "امضا معتبر نیست" };
  const buffer = Buffer.from(m[1], "base64");
  if (buffer.length < 300 || buffer.length > 700 * 1024) return { ok: false, error: "حجم یا محتوای امضا معتبر نیست" };
  if (buffer.subarray(0, 4).toString("hex") !== "89504e47") return { ok: false, error: "فرمت امضا باید PNG باشد" };

  const otp = await verifyOtp(signer.id, input.code || "");
  if (!otp.ok) {
    await logAudit({ action: "otp.failed", contractId, userId: user.id, detail: otp.error });
    return { ok: false, error: otp.error };
  }
  await logAudit({ action: "otp.verified", contractId, userId: user.id });

  const { ip, userAgent } = await getRequestInfo();
  const now = new Date();
  const file = await saveSignatureFile(`c${contractId}-s${signer.id}-${Date.now()}.png`, buffer);
  await db
    .update(contractSigners)
    .set({
      status: "signed",
      signedAt: now,
      ip,
      userAgent,
      signatureFile: file,
      signatureMethod: input.method === "upload" ? "upload" : "draw",
      otpVerifiedAt: now,
      mobile: user.mobile,
    })
    .where(eq(contractSigners.id, signer.id));
  await logAudit({
    action: "contract.signed",
    contractId,
    userId: user.id,
    detail: `${signer.label} — ${faTime(now)} — روش: ${input.method === "upload" ? "آپلود تصویر" : "ترسیم"}`,
  });

  const signers = await getSigners(contractId);
  if (signers.every((s) => s.status === "signed")) {
    const fingerprint = sha256(
      data.contract.bodyHtml + signers.map((s) => `${s.userId}|${s.signedAt?.toISOString()}|${s.ip}`).join(";"),
    );
    await db.update(contracts).set({ status: "signed", signedAt: now, docHash: fingerprint }).where(eq(contracts.id, contractId));
    if (data.contract.orderId) await db.update(orders).set({ status: "completed" }).where(eq(orders.id, data.contract.orderId));
    await logAudit({ action: "contract.completed", contractId, userId: user.id, detail: `اثر انگشت سند: ${fingerprint.slice(0, 16)}…` });

    const cfg = await getAllSettings();
    const link = `${cfg.app_url}/contracts/${contractId}/print?auto=1`;
    const recipients = new Set([cfg.admin_email, ...signers.map((s) => s.userEmail)].filter(Boolean));
    for (const to of recipients) {
      await sendMail({
        to,
        subject: `قرارداد ${data.contract.number} امضا شد`,
        html: `<div dir="rtl"><p>قرارداد «${data.contract.title}» توسط همه‌ی طرفین امضا شد.</p><p>دریافت نسخه‌ی PDF: <a href="${link}">${link}</a></p><hr/>${data.contract.bodyHtml}</div>`,
        contractId,
      });
    }
  } else {
    const next = currentSigner(signers);
    if (next) {
      await sendMail({
        to: next.userEmail,
        subject: `نوبت امضای شما: ${data.contract.number}`,
        html: `<div dir="rtl"><p>${next.userName} عزیز، قرارداد «${data.contract.title}» منتظر امضای شماست.</p></div>`,
        contractId,
      });
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath(`/contracts/${contractId}`);
  return { ok: true };
}

export async function rejectContractAction(contractId: number, reason: string): Promise<ActionResult> {
  const turn = await loadTurn(contractId);
  if ("error" in turn) return { ok: false, error: turn.error };
  const { user, signer } = turn;
  await db.update(contractSigners).set({ status: "rejected" }).where(eq(contractSigners.id, signer.id));
  await db.update(contracts).set({ status: "rejected" }).where(eq(contracts.id, contractId));
  await logAudit({ action: "contract.rejected", contractId, userId: user.id, detail: `${signer.label}: ${reason.slice(0, 300)}` });
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath(`/contracts/${contractId}`);
  return { ok: true };
}
