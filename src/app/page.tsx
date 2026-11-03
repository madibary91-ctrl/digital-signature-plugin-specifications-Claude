import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";
import { ensureSeed } from "@/modules/seed";

export const dynamic = "force-dynamic";

export default async function Home() {
  await ensureSeed();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(user.role === "admin" ? "/admin" : "/dashboard");
}
