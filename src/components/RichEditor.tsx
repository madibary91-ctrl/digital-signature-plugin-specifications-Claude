"use client";

import { useEffect, useRef } from "react";
import { VARIABLES } from "@/modules/variables";

const TOOLS: { label: string; title: string; cmd: string; value?: string }[] = [
  { label: "B", title: "ضخیم", cmd: "bold" },
  { label: "I", title: "کج", cmd: "italic" },
  { label: "U", title: "زیرخط", cmd: "underline" },
  { label: "H2", title: "تیتر", cmd: "formatBlock", value: "h2" },
  { label: "H3", title: "زیرتیتر", cmd: "formatBlock", value: "h3" },
  { label: "¶", title: "پاراگراف", cmd: "formatBlock", value: "p" },
  { label: "• لیست", title: "لیست نقطه‌ای", cmd: "insertUnorderedList" },
  { label: "۱. لیست", title: "لیست عددی", cmd: "insertOrderedList" },
  { label: "راست", title: "راست‌چین", cmd: "justifyRight" },
  { label: "وسط", title: "وسط‌چین", cmd: "justifyCenter" },
  { label: "چپ", title: "چپ‌چین", cmd: "justifyLeft" },
];

/** ویرایشگر متن غنی سبک با نوار متغیرهای پویا؛ مقدار در یک input مخفی برای فرم ذخیره می‌شود */
export default function RichEditor({ name, initialHtml }: { name: string; initialHtml: string }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  const sync = () => {
    if (hiddenRef.current && areaRef.current) hiddenRef.current.value = areaRef.current.innerHTML;
  };

  useEffect(() => {
    if (areaRef.current) {
      areaRef.current.innerHTML = initialHtml;
      sync();
    }
  }, [initialHtml]);

  const run = (cmd: string, value?: string) => {
    areaRef.current?.focus();
    document.execCommand(cmd, false, value);
    sync();
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
      <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-2">
        {TOOLS.map((t) => (
          <button
            key={t.title}
            type="button"
            title={t.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(t.cmd, t.value)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-100"
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-teal-50/50 p-2">
        <span className="ml-1 text-xs text-slate-500">درج متغیر:</span>
        {VARIABLES.map((v) => (
          <button
            key={v.key}
            type="button"
            title={v.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run("insertText", `[${v.key}]`)}
            className="rounded-full border border-teal-200 bg-white px-2 py-0.5 font-mono text-[11px] text-teal-800 hover:bg-teal-100"
          >
            [{v.key}]
          </button>
        ))}
      </div>
      <div
        ref={areaRef}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onBlur={sync}
        data-placeholder="متن قرارداد را اینجا بنویسید…"
        className="editor-area contract-body min-h-[320px] p-4 outline-none"
      />
      <input ref={hiddenRef} type="hidden" name={name} defaultValue={initialHtml} />
    </div>
  );
}
