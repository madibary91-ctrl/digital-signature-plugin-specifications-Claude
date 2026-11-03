import Link from "next/link";
import { listContractsForUser, type UserFilter } from "@/modules/contracts/service";
import StatusBadge from "@/components/StatusBadge";
import { fa } from "@/lib/jalali";

const TABS: { key: UserFilter; label: string }[] = [
  { key: "all", label: "همه قراردادها" },
  { key: "pending", label: "در انتظار امضا" },
  { key: "signed", label: "امضا شده" },
];

/** معادل شورت‌کد [contracts_dashboard]: قابل استفاده در هر صفحه (و از طریق /embed/dashboard در سایت‌های دیگر) */
export default async function ContractsDashboard({
  userId,
  filter,
  basePath = "/dashboard",
}: {
  userId: number;
  filter: UserFilter;
  basePath?: string;
}) {
  const rows = await listContractsForUser(userId, filter);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`${basePath}?status=${t.key}`}
            className={`btn ${filter === t.key ? "btn-primary" : "btn-secondary"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="card py-12 text-center text-slate-500">قراردادی برای نمایش وجود ندارد.</div>
      ) : (
        <div className="grid gap-3">
          {rows.map((c) => (
            <Link
              key={c.id}
              href={`/contracts/${c.id}`}
              className={`card flex flex-wrap items-center justify-between gap-3 transition hover:border-teal-400 ${c.state === "my_turn" ? "border-sky-300 bg-sky-50/40" : ""}`}
            >
              <div>
                <div className="font-semibold">{c.title}</div>
                <div className="mt-1 text-xs text-slate-500">
                  <span dir="ltr" className="font-mono">{c.number}</span> • صدور: {fa(c.issuedAt)} • نقش شما: {c.myLabel}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {c.signedAt && <span className="text-xs text-slate-500">تکمیل: {fa(c.signedAt)}</span>}
                <StatusBadge status={c.state === "signed" && c.status !== "signed" ? "pending" : c.state === "signed" ? "signed" : c.state} />
                <span className="btn btn-secondary !py-1">مشاهده</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
