import crypto from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { otpCodes } from "@/db/schema";
import { sha256 } from "@/lib/password";

export const OTP_RESEND_SECONDS = 117;
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const PEPPER = process.env.SESSION_SECRET || "amzagir-dev-secret-change-me";

const hashCode = (code: string, signerId: number) => sha256(`${PEPPER}:${signerId}:${code}`);

export async function secondsUntilResend(signerId: number): Promise<number> {
  const [last] = await db
    .select()
    .from(otpCodes)
    .where(eq(otpCodes.signerId, signerId))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (!last) return 0;
  const elapsed = (Date.now() - last.createdAt.getTime()) / 1000;
  return Math.max(0, Math.ceil(OTP_RESEND_SECONDS - elapsed));
}

export async function createOtp(params: { contractId: number; signerId: number; userId: number }): Promise<string> {
  const code = String(crypto.randomInt(10000, 100000));
  await db.insert(otpCodes).values({
    ...params,
    codeHash: hashCode(code, params.signerId),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
  return code;
}

export async function verifyOtp(signerId: number, code: string): Promise<{ ok: boolean; error?: string }> {
  const [row] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.signerId, signerId), isNull(otpCodes.usedAt)))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (!row) return { ok: false, error: "ابتدا کد تایید را دریافت کنید" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, error: "کد منقضی شده است؛ کد جدید دریافت کنید" };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: "تعداد تلاش‌ها بیش از حد مجاز است؛ کد جدید دریافت کنید" };
  const a = Buffer.from(row.codeHash);
  const b = Buffer.from(hashCode(code.trim(), signerId));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await db.update(otpCodes).set({ attempts: row.attempts + 1 }).where(eq(otpCodes.id, row.id));
    return { ok: false, error: "کد تایید نادرست است" };
  }
  await db.update(otpCodes).set({ usedAt: new Date() }).where(eq(otpCodes.id, row.id));
  return { ok: true };
}
