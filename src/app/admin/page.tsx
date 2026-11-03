import Link from "next/link";
import Shell from "@/components/Shell";
import StatusBadge from "@/components/StatusBadge";
import { requireAdmin } from "@/modules/auth/session";
import { adminCounts, listContractsAdmin } from "@/modules/contracts/service";
import { deleteContractAction } from "@/modules/contracts/actions";
import { fa } from "@/lib/jalali";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "all", label: "همه" },
  { key: "sent", label: "ارسال شده" },
  { key: "signed", label: "امضا شده" },
  { key: "rejected", label: "رد شده" },
];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; issued?: string }> }) {
  const user = await requireAdmin();
  const { status = "all", q = "", issued } = await searchParams;
  const [rows, counts] = await Promise.all([listContractsAdmin(status, q.trim()), adminCounts()]);

  return (
    <Shell user={user} wide>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">قراردادهای صادر شده</h1>
        <Link href="/admin/new" className="btn btn-primary">+ صدور قرارداد جدید</Link>
      </div>
      {issued && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{issued} قرارداد با موفقیت صادر و ارسال شد.</p>}

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin?status=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`card !p-4 transition hover:border-teal-400 ${status === t.key ? "border-teal-600 bg-teal-50" : ""}`}
          >
            <div className="text-xs text-slate-500">{t.label}</div>
            <div className="text-2xl font-bold">{new Intl.NumberFormat("fa-IR").format(counts[t.key] ?? 0)}</div>
          </Link>
        ))}
      </div>

      <form className="mb-4 flex gap-2">
        <input type="hidden" name="status" value={status} />
        <input name="q" defaultValue={q} placeholder="جستجو: شماره، عنوان، نام یا ایمیل کاربر…" className="input max-w-md" />
        <button className="btn btn-secondary">جستجو</button>
      </form>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">شماره قرارداد</th>
              <th className="th">قالب / عنوان</th>
              <th className="th">کاربر</th>
              <th className="th">وضعیت</th>
              <th className="th">تاریخ صدور</th>
              <th className="th">تاریخ امضا</th>
              <th className="th">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="td font-mono text-xs" dir="ltr">{c.number}</td>
                <td className="td">
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs text-slate-500">{c.templateTitle ?? "بدون قالب"}{c.source === "shop" && " • خرید از فروشگاه"}</div>
                </td>
                <td className="td">
                  <div>{c.userName}</div>
                  <div className="text-xs text-slate-500" dir="ltr">{c.userEmail}</div>
                </td>
                <td className="td"><StatusBadge status={c.status} /></td>
                <td className="td whitespace-nowrap">{fa(c.issuedAt)}</td>
                <td className="td whitespace-nowrap">{fa(c.signedAt)}</td>
                <td className="td">
                  <div className="flex gap-2">
                    <Link href={`/contracts/${c.id}`} className="btn btn-secondary !px-3 !py-1">مشاهده</Link>
                    <form action={deleteContractAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="btn btn-secondary !px-3 !py-1 text-red-700">حذف</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">قراردادی یافت نشد.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
