"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/modules/auth/actions";

const DEMO = [
  { label: "مدیر", email: "admin@example.com", password: "admin123" },
  { label: "کاربر ۱", email: "ali@example.com", password: "user123" },
  { label: "کاربر ۲", email: "sara@example.com", password: "user123" },
];

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label">ایمیل</label>
        <input name="email" type="email" dir="ltr" required className="input" placeholder="you@example.com" />
      </div>
      <div>
        <label className="label">رمز عبور</label>
        <input name="password" type="password" dir="ltr" required className="input" />
      </div>
      {state.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="btn btn-primary w-full">
        {pending ? "در حال ورود…" : "ورود"}
      </button>
      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        <div className="mb-1 font-medium">حساب‌های نمایشی:</div>
        {DEMO.map((d) => (
          <div key={d.email} className="flex justify-between gap-2">
            <span>{d.label}</span>
            <span dir="ltr" className="font-mono">{d.email} / {d.password}</span>
          </div>
        ))}
      </div>
    </form>
  );
}
