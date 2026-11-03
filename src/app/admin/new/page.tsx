import Shell from "@/components/Shell";
import IssueForm from "@/components/IssueForm";
import { db } from "@/db";
import { templates, users } from "@/db/schema";
import { asc } from "drizzle-orm";
import { requireAdmin } from "@/modules/auth/session";

export const dynamic = "force-dynamic";

export default async function NewContractPage() {
  const admin = await requireAdmin();
  const [tpls, allUsers] = await Promise.all([
    db.select({ id: templates.id, title: templates.title, body: templates.body }).from(templates).orderBy(asc(templates.title)),
    db.select({ id: users.id, name: users.name, email: users.email }).from(users).orderBy(asc(users.name)),
  ]);
  return (
    <Shell user={admin} wide>
      <h1 className="mb-4 text-2xl font-bold">صدور قرارداد جدید</h1>
      <IssueForm templates={tpls} users={allUsers} />
    </Shell>
  );
}
