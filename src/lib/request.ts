import { headers } from "next/headers";

/** اطلاعات درخواست برای شناسنامه دیجیتال: IP و User-Agent */
export async function getRequestInfo(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  const ip = (fwd ? fwd.split(",")[0].trim() : h.get("x-real-ip")) || "unknown";
  const userAgent = (h.get("user-agent") || "unknown").slice(0, 500);
  return { ip, userAgent };
}
