import Shell from "@/components/Shell";
import { db } from "@/db";
import { products, templates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/modules/auth/session";
import { buyProductAction } from "@/modules/shop/actions";
import { faNum } from "@/lib/jalali";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const user = await requireUser();
  const items = await db
    .select({ id: products.id, title: products.title, description: products.description, price: products.price, templateTitle: templates.title })
    .from(products)
    .leftJoin(templates, eq(templates.id, products.templateId));
  return (
    <Shell user={user}>
      <h1 className="mb-1 text-2xl font-bold">فروشگاه / خدمات</h1>
      <p className="mb-5 text-sm text-slate-500">پس از ثبت سفارش، قرارداد مرتبط به‌صورت خودکار صادر می‌شود و باید آن را امضا کنید.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((p) => (
          <div key={p.id} className="card flex flex-col gap-3">
            <h2 className="text-lg font-bold">{p.title}</h2>
            <p className="flex-1 text-sm text-slate-600">{p.description}</p>
            {p.templateTitle && <p className="text-xs text-teal-700">📄 قرارداد همراه: {p.templateTitle}</p>}
            <div className="flex items-center justify-between">
              <span className="font-bold">{faNum(p.price)} تومان</span>
              <form action={buyProductAction}>
                <input type="hidden" name="productId" value={p.id} />
                <button className="btn btn-primary">ثبت سفارش و امضای قرارداد</button>
              </form>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="card text-slate-500">محصولی تعریف نشده است.</div>}
      </div>
    </Shell>
  );
}
