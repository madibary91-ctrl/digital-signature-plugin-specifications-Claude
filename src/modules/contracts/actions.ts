"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/modules/auth/session";
import { issueContract, removeContract } from "./service";

export type IssueState = { error?: string };

/** صدور تکی و گروهی: برای هر مشتری انتخاب‌شده یک قرارداد مستقل با زنجیره‌ی امضای یکسان ساخته می‌شود */
export async function issueContractsAction(_prev: IssueState, formData: FormData): Promise<IssueState> {
  const admin = await requireAdmin();
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const templateId = Number(formData.get("templateId")) || null;
  const customerIds = formData.getAll("customerId").map(Number).filter(Boolean);
  const labels = formData.getAll("signerLabel").map((v) => String(v).trim());
  const signerUsers = formData.getAll("signerUser").map(Number);

  if (!title) return { error: "عنوان قرارداد را وارد کنید" };
  if (body.replace(/<[^>]*>/g, "").trim().length < 10) return { error: "متن قرارداد خالی یا بسیار کوتاه است" };
  if (customerIds.length === 0) return { error: "حداقل یک کاربر را انتخاب کنید" };

  const extraSigners: { label: string; userId: number }[] = [];
  for (let i = 0; i < signerUsers.length; i++) {
    if (!signerUsers[i]) continue;
    extraSigners.push({ label: labels[i] || `امضاکننده ${i + 1}`, userId: signerUsers[i] });
  }

  let lastId = 0;
  for (const customerId of customerIds) {
    lastId = await issueContract({
      title,
      bodyHtml: body,
      templateId,
      customerId,
      extraSigners,
      createdBy: admin.id,
    });
  }
  revalidatePath("/admin");
  redirect(customerIds.length === 1 ? `/contracts/${lastId}` : "/admin?issued=" + customerIds.length);
}

export async function deleteContractAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  if (Number.isInteger(id)) await removeContract(id, admin.id);
  revalidatePath("/admin");
  redirect("/admin");
}
