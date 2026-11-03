"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, products, templates } from "@/db/schema";
import { requireAdmin, requireUser } from "@/modules/auth/session";
import { issueContract } from "@/modules/contracts/service";
import { logAudit } from "@/modules/audit/service";

/** خرید محصول/خدمت ← صدور خودکار قرارداد مرتبط برای امضای آنلاین */
export async function buyProductAction(formData: FormData) {
  const user = await requireUser();
  const productId = Number(formData.get("productId"));
  const [product] = await db.select().from(products).where(eq(products.id, productId));
  if (!product) redirect("/shop");

  const [order] = await db
    .insert(orders)
    .values({ userId: user.id, productId: product.id, amount: product.price })
    .returning();
  await logAudit({ action: "order.created", userId: user.id, detail: `${product.title} — سفارش #${order.id}` });

  if (product.templateId) {
    const [tpl] = await db.select().from(templates).where(eq(templates.id, product.templateId));
    if (tpl) {
      const contractId = await issueContract({
        title: `${tpl.title} — ${product.title}`,
        bodyHtml: tpl.body,
        templateId: tpl.id,
        customerId: user.id,
        source: "shop",
        orderId: order.id,
        productName: product.title,
        amount: product.price,
        createdBy: user.id,
      });
      await db.update(orders).set({ contractId }).where(eq(orders.id, order.id));
      revalidatePath("/dashboard");
      redirect(`/contracts/${contractId}`);
    }
  }
  await db.update(orders).set({ status: "completed" }).where(eq(orders.id, order.id));
  redirect("/dashboard");
}

export async function saveProductAction(formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const price = Math.max(0, Number(formData.get("price")) || 0);
  const templateId = Number(formData.get("templateId")) || null;
  if (title) await db.insert(products).values({ title, description, price, templateId });
  revalidatePath("/admin/products");
  revalidatePath("/shop");
}

export async function deleteProductAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (Number.isInteger(id)) await db.delete(products).where(eq(products.id, id));
  revalidatePath("/admin/products");
  revalidatePath("/shop");
}
