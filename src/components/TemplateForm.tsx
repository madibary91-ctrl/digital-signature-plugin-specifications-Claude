"use client";

import { useActionState } from "react";
import RichEditor from "@/components/RichEditor";
import { saveTemplateAction, type TemplateState } from "@/modules/templates/actions";

export default function TemplateForm({ tpl }: { tpl?: { id: number; title: string; description: string; body: string } }) {
  const [state, action, pending] = useActionState<TemplateState, FormData>(saveTemplateAction, {});
  return (
    <form action={action} className="card space-y-4">
      {tpl && <input type="hidden" name="id" value={tpl.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">عنوان قالب</label>
          <input name="title" defaultValue={tpl?.title} required className="input" />
        </div>
        <div>
          <label className="label">توضیح کوتاه</label>
          <input name="description" defaultValue={tpl?.description} className="input" />
        </div>
      </div>
      <div>
        <label className="label">متن قالب</label>
        <RichEditor name="body" initialHtml={tpl?.body ?? ""} />
      </div>
      {state.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="btn btn-primary">{pending ? "در حال ذخیره…" : "ذخیره قالب"}</button>
    </form>
  );
}
