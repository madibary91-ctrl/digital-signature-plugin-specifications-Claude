"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "./session";
import { logAudit } from "@/modules/audit/service";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "ایمیل و رمز عبور را وارد کنید" };

  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !verifyPassword(password, user.passwordHash)) {
    await logAudit({ action: "auth.failed", detail: email });
    return { error: "ایمیل یا رمز عبور اشتباه است" };
  }
  await createSession(user.id);
  await logAudit({ action: "auth.login", userId: user.id });
  redirect(user.role === "admin" ? "/admin" : "/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
