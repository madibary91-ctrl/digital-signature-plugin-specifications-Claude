import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import StatusBadge from "@/components/StatusBadge";
import SignPanel from "@/components/SignPanel";
import { requireUser } from "@/modules/auth/session";
import { currentSigner, getContractForUser } from "@/modules/contracts/service";
import { ACTION_LABELS, getContractAudit, logAudit } from "@/modules/audit/service";
import { deleteContractAction } from "@/modules/contracts/actions";
import { sanitizeHtml } from "@/lib/html";
import { fa, faTime } from "@/lib/jalali";

export const dynamic = "force-dynamic";

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const data = await getContractForUser(user, Number(id));
  if (!data) notFound();
  const { contract, signers, customer } = data;
  const turn = currentSigner(signers);
  const myTurn = contract.status === "sent" && turn?.userId === user.id;
  const isAdmin = user.role === "admin";
  const audit = isAdmin ? await getContractAudit(contract.id) : [];

  if (!isAdmin) await logAudit({ action: "contract.viewed", contractId: contract.id, userId: user.id });

  const mobile = user.mobile;
  const masked = mobile.length >= 7 ? `${mobile.slice(0, 4)}***${mobile.slice(-4)}` : mobile;

  return (
    <Shell user={user}>
      <div className="space-y-5">
        <div className="card flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{contract.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              <span dir="ltr" className="font-mono">{contract.number}</span> • مشتری: {customer?.name} • صدور: {fa(contract.issuedAt)}
              {contract.signedAt && <> • تکمیل: {fa(contract.signedAt)}</>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={contract.status} />
            <Link href={`/contracts/${contract.id}/print`} target="_blank" className="btn btn-secondary">پیش‌نمایش چاپی</Link>
            {contract.status === "signed" && (
              <Link href={`/contracts/${contract.id}/print?auto=1`} target="_blank" className="btn btn-primary">دانلود PDF</Link>
            )}
            {isAdmin && (
              <form action={deleteContractAction}>
                <input type="hidden" name="id" value={contract.id} />
                <button className="btn btn-danger">حذف</button>
              </form>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="mb-3 text-sm font-bold text-slate-600">ترتیب امضاکنندگان</h2>
          <ol className="flex flex-wrap gap-3">
            {signers.map((s) => (
              <li key={s.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${s.id === turn?.id && contract.status === "sent" ? "border-sky-300 bg-sky-50" : "border-slate-200"}`}>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-200 text-xs">{s.position}</span>
                <span>
                  <b>{s.label}</b> — {s.userName}
                  {s.signedAt && <span className="block text-xs text-slate-500">{faTime(s.signedAt)}</span>}
                </span>
                <StatusBadge status={s.status === "pending" ? (s.id === turn?.id ? "my_turn" : "waiting") : s.status} />
              </li>
            ))}
          </ol>
        </div>

        <article className="card contract-body px-6 py-6 sm:px-10" dangerouslySetInnerHTML={{ __html: sanitizeHtml(contract.bodyHtml) }} />

        {myTurn && turn && <SignPanel contractId={contract.id} signerLabel={turn.label} maskedMobile={masked} />}
        {!myTurn && contract.status === "sent" && (
          <div className="card text-sm text-slate-600">
            {turn ? `این قرارداد در انتظار امضای «${turn.label} — ${turn.userName}» است.` : ""}
          </div>
        )}

        {isAdmin && (
          <div className="card overflow-x-auto">
            <h2 className="mb-3 text-lg font-bold">شناسنامه دیجیتال و لاگ تغییرات</h2>
            {contract.docHash && (
              <p className="mb-3 break-all rounded bg-slate-50 p-2 text-xs">
                اثر انگشت سند (SHA-256): <span dir="ltr" className="font-mono">{contract.docHash}</span>
              </p>
            )}
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="th">زمان</th>
                  <th className="th">رویداد</th>
                  <th className="th">کاربر</th>
                  <th className="th">IP</th>
                  <th className="th">User-Agent</th>
                  <th className="th">جزئیات</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 align-top">
                    <td className="td whitespace-nowrap text-xs">{faTime(a.createdAt)}</td>
                    <td className="td">{ACTION_LABELS[a.action] ?? a.action}</td>
                    <td className="td">{a.userName ?? "—"}</td>
                    <td className="td font-mono text-xs" dir="ltr">{a.ip}</td>
                    <td className="td max-w-xs truncate text-xs text-slate-500" title={a.userAgent ?? ""} dir="ltr">{a.userAgent}</td>
                    <td className="td text-xs text-slate-600">{a.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
