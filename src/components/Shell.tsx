import Link from "next/link";
import type { ReactNode } from "react";
import type { SessionUser } from "@/modules/auth/session";
import { logoutAction } from "@/modules/auth/actions";

const ADMIN_NAV = [
  { href: "/admin", label: "قراردادها" },
  { href: "/admin/new", label: "صدور قرارداد" },
  { href: "/admin/templates", label: "قالب‌ها" },
  { href: "/admin/products", label: "محصولات" },
  { href: "/admin/logs", label: "لاگ‌ها" },
  { href: "/admin/settings", label: "تنظیمات" },
];
const USER_NAV = [
  { href: "/dashboard", label: "قراردادهای من" },
  { href: "/shop", label: "فروشگاه" },
];

export default function Shell({ user, children, wide }: { user: SessionUser; children: ReactNode; wide?: boolean }) {
  const nav = user.role === "admin" ? [...ADMIN_NAV, { href: "/dashboard", label: "نمای کاربری" }] : USER_NAV;
  return (
    <div>
      <header className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link href={user.role === "admin" ? "/admin" : "/dashboard"} className="flex items-center gap-2 text-lg font-bold text-teal-800">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-700 text-white">✒</span>
            امضاگیر
          </Link>
          <nav className="flex flex-1 flex-wrap gap-1">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">
              {user.name} {user.role === "admin" && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">مدیر</span>}
            </span>
            <form action={logoutAction}>
              <button className="btn btn-secondary !py-1">خروج</button>
            </form>
          </div>
        </div>
      </header>
      <main className={`mx-auto px-4 py-6 ${wide ? "max-w-7xl" : "max-w-6xl"}`}>{children}</main>
    </div>
  );
}
