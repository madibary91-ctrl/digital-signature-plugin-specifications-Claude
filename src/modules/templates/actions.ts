"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { templates } from "@/db/schema";
import { requireAdmin } from "@/modules/auth/session";
import { sanitizeHtml } from "@/lib/html";
import { logAudit } from "@/modules/audit/service";

export type TemplateState = { error?: string };

export async function saveTemplateAction(_prev: TemplateState, formData: FormData): Promise<TemplateState> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id")) || null;
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const body = sanitizeHtml(String(formData.get("body") || ""));
  if (!title) return { error: "عنوان قالب را وارد کنید" };
  if (body.replace(/<[^>]*>/g, "").trim().length < 10) return { error: "متن قالب بسیار کوتاه است" };

  if (id) {
    await db.update(templates).set({ title, description, body, updatedAt: new Date() }).where(eq(templates.id, id));
  } else {
    await db.insert(templates).values({ title, description, body });
  }
  await logAudit({ action: "template.saved", userId: admin.id, detail: title });
  revalidatePath("/admin/templates");
  redirect("/admin/templates");
}

export async function deleteTemplateAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  if (Number.isInteger(id)) {
    await db.delete(templates).where(eq(templates.id, id));
    await logAudit({ action: "template.deleted", userId: admin.id, detail: `#${id}` });
  }
  revalidatePath("/admin/templates");
  redirect("/admin/templates");
}
