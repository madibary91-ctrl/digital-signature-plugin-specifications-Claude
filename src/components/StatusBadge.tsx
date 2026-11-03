const STYLES: Record<string, string> = {
  sent: "bg-amber-100 text-amber-800",
  signed: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  my_turn: "bg-sky-100 text-sky-800",
  waiting: "bg-slate-100 text-slate-600",
  pending: "bg-slate-100 text-slate-600",
};
const LABELS: Record<string, string> = {
  sent: "ارسال شده",
  signed: "امضا شده",
  rejected: "رد شده",
  my_turn: "در انتظار امضای شما",
  waiting: "در انتظار نوبت",
  pending: "در انتظار امضا",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status] ?? "bg-slate-100"}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
