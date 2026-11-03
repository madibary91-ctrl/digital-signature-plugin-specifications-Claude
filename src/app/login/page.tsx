import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { getCurrentUser } from "@/modules/auth/session";
import { ensureSeed } from "@/modules/seed";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await ensureSeed();
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/dashboard");
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="card w-full max-w-md space-y-5">
        <div className="text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-teal-700 text-2xl text-white">✒</div>
          <h1 className="text-2xl font-bold">امضاگیر</h1>
          <p className="mt-1 text-sm text-slate-500">سامانه‌ی صدور و امضای آنلاین قرارداد</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
